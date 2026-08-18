/* ============================================================
   ia/intencion.js — normaliza una INTENCIÓN a eventos resueltos
   contra el catálogo de acciones (Tramo 2.6). Módulo PURO.

   Es la única puerta por la que entra al compilador lo que hay que
   animar, y acepta DOS dialectos:

     · el NUEVO — { jugador, accion: 'entra', args: { … } }, que es lo
       que escribirá el paso 2 pinchando acciones del catálogo;
     · el ANTIGUO — { jugador, tipo: 'bote', hacia: 'aro', … }, los
       nueve eventos escritos a fuego que traen las 204 fichas de la
       biblioteca y los bancos de pruebas.

   Los dos salen por el mismo sitio: un evento resuelto con su acción
   del catálogo, su familia y sus parámetros ya fusionados. El
   compilador deja de saber qué es «botar» y pasa a saber resolver
   cinco familias.

   ── POR QUÉ EL DIALECTO ANTIGUO SE QUEDA ────────────────────
   Porque es la prueba. Traducir aquí y no en las fichas permite
   reconstruir la biblioteca entera y comprobar que sale BYTE A BYTE
   igual que antes: si la traducción tuviera el más mínimo desvío, las
   204 fichas lo dirían. Reescribir las intenciones a mano habría sido
   una reinterpretación sin forma de comprobarla.

   ── LO QUE NO HACE ──────────────────────────────────────────
   No valida el baloncesto (que el receptor de un pase exista, que
   nadie se bloquee a sí mismo): de eso sigue encargándose
   ia/validador.js antes de llegar aquí. Lo que sí hace es no dejar
   pasar nunca un evento que el compilador no sepa resolver — si no
   reconoce la acción o le falta algo imprescindible, lo descarta y lo
   dice. El compilador nunca recibe algo que no pueda dibujar.
   ============================================================ */

import { CATALOGO_SISTEMA, FAMILIAS, parametroDe } from './acciones.js';

/* ── Equivalencias con los nueve eventos de siempre ─────────── */

/*
   Cada entrada dice a qué acción del catálogo corresponde el evento
   antiguo y cómo se leen sus campos. Un caso no es 1 a 1, y es JUSTO el
   que dio problemas: `bote` era dos acciones según lo que llevara en
   `hacia` — 'aro' llegaba hasta la canasta ('entra') y cualquier otra
   cosa avanzaba un trozo ('bota'). Ver la cabecera de acciones.js.
*/
const LEGADO = {
  bote:          (ev) => ({ slug: ev.hacia === 'aro' ? 'entra' : 'bota', args: destinoDe(ev) }),
  corte:         (ev) => ({ slug: 'corta', args: destinoDe(ev) }),
  vuelve_a_fila: () => ({ slug: 'vuelve_a_fila', args: {} }),
  recoge:        (ev) => ({ slug: 'recoge', args: { balon: ev.balon_id ?? null } }),
  pase:          (ev) => ({ slug: 'pasa', args: { destino: ev.a ?? null } }),
  tiro:          () => ({ slug: 'tira', args: {} }),
  bloqueo:       (ev) => ({ slug: 'bloquea', args: { companero: ev.bloqueado_id ?? null } }),
  defiende:      (ev) => ({ slug: 'defiende', args: { companero: ev.marca ?? null, destino: puntoDe(ev.hacia) } }),
  // rodea_cono no llega hasta aquí: se pliega dentro del desplazamiento
  // del mismo jugador (ver plegarRodeos). Si llegara suelto no habría
  // camino al que pegarlo, y no hay nada que dibujar.
};

/** {x,y} si `hacia` es un punto; null si no. */
function puntoDe(hacia) {
  if (hacia && typeof hacia === 'object' && Number.isFinite(hacia.x) && Number.isFinite(hacia.y)) {
    return { x: hacia.x, y: hacia.y };
  }
  return null;
}

/**
 * Cómo se lee el `hacia` de un bote o un corte.
 *
 * 'canasta' era el valor por defecto —avanzar un trozo hacia el aro— y
 * es lo que la acción ya trae puesto, así que no se toca nada. Con un
 * PUNTO se va hasta él: por eso `alcance: 'completo'` pisa ahí el
 * 'parcial' de la acción. Decir exactamente dónde y que aun así se
 * quede a medio camino no lo espera nadie.
 *
 * Con un NOMBRE de posición el alcance se decide en el compilador, con
 * el nombre ya resuelto: si lo reconoce va hasta él, y si no, cae al
 * avance parcial de siempre. Decidirlo aquí sería a ciegas.
 */
function destinoDe(ev) {
  const punto = puntoDe(ev.hacia);
  if (punto) return { destino: punto, alcance: 'completo' };
  // 'aro' significa LLEGAR hasta la canasta y pararse donde se apoya para
  // subir. Vale igual para un bote (que se traduce a la acción «entra»,
  // porque eso tiene nombre propio en baloncesto) que para un corte sin
  // balón — el que continúa al aro tras un bloqueo. La separación no se
  // repite aquí: la pone la familia (1,10 m), que es de donde salía ya.
  if (ev.hacia === 'aro') return { destino: 'aro', alcance: 'pegado' };
  if (typeof ev.hacia === 'string' && ev.hacia !== 'canasta') {
    return { destino: ev.hacia };
  }
  return {};
}

/* ── Plegado de los rodeos ──────────────────────────────────── */

/**
 * `rodea_cono` era un evento SUELTO que había que declarar aparte del
 * desplazamiento, y que el compilador tejía dentro de su camino. Aquí
 * se convierte en lo que siempre fue: la trayectoria de ese mismo
 * desplazamiento.
 *
 * @returns { eventos } sin los rodeos y { sorteos }: jugador → conos
 *   que sortea en esta fase.
 */
function plegarRodeos(eventos) {
  const sorteos = new Map();
  const resto = [];
  for (const ev of eventos) {
    if (ev && ev.tipo === 'rodea_cono') {
      if (!sorteos.has(ev.jugador)) sorteos.set(ev.jugador, []);
      sorteos.get(ev.jugador).push(ev.cono_id);
    } else {
      resto.push(ev);
    }
  }
  return { eventos: resto, sorteos };
}

/* ── Normalización ─────────────────────────────────────────── */

const esNuevo = (ev) => ev && typeof ev.accion === 'string';

/**
 * Resuelve UN evento contra el catálogo.
 * @returns { jugador, accion, familia, params } | { error }
 */
function resolverEvento(ev, idx, sorteos) {
  if (!ev || typeof ev !== 'object') return { error: 'evento vacío' };
  if (!ev.jugador) return { error: 'evento sin jugador' };

  let slug; let args;
  if (esNuevo(ev)) {
    slug = ev.accion;
    args = ev.args && typeof ev.args === 'object' ? { ...ev.args } : {};
  } else {
    const traducir = LEGADO[ev.tipo];
    if (!traducir) return { error: `acción desconocida: ${ev.tipo ?? '(sin tipo)'}` };
    const t = traducir(ev);
    slug = t.slug;
    args = t.args;
  }

  const accion = idx.get(slug);
  if (!accion) return { error: `la acción "${slug}" no está en el catálogo` };
  const fam = FAMILIAS[accion.familia];
  if (!fam) return { error: `la acción "${slug}" declara una familia que no existe` };

  // Parámetros efectivos: los de la familia, pisados por los que fija la
  // acción, pisados por los que trae este uso concreto.
  //
  // Aquí es donde el modelo se dobla a propósito: el CATÁLOGO no admite
  // coordenadas —una acción tiene que valer en las cuatro pistas—, pero
  // un USO concreto sí puede apuntar a un sitio exacto de esta pista.
  // Son dos cosas distintas: el vocabulario y la frase.
  const params = {};
  for (const clave of Object.keys(fam.parametros)) {
    const v = args[clave];
    params[clave] = v === undefined ? parametroDe(accion, clave) : v;
  }

  // Los conos que este jugador sortea en esta fase mandan sobre lo que
  // diga la acción: son de ESTE uso, no del vocabulario.
  const conos = sorteos.get(ev.jugador);
  if (conos && conos.length && 'sorteando' in fam.parametros) {
    params.sorteando = conos;
    params.trayectoria = 'rodeo';
  }

  return { jugador: ev.jugador, accion, familia: accion.familia, params };
}

/**
 * Normaliza un intent entero.
 *
 * @param intent  { canasta, fases: [{ eventos: [...] }], balones? }
 * @param opts.catalogo  catálogo completo (sistema + club). Sin él, el
 *        del sistema: el Taller tiene que funcionar sin red.
 * @returns { canasta, balones, fases: [{ eventos: [resuelto] }], descartados }
 *   `descartados` son los eventos que no se han podido resolver, con su
 *   porqué, para que la pantalla pueda DECIRLO en vez de tragárselo.
 */
export function normalizarIntent(intent, opts = {}) {
  const catalogo = opts.catalogo && opts.catalogo.length ? opts.catalogo : CATALOGO_SISTEMA;
  const idx = new Map(catalogo.map((a) => [a.slug, a]));
  const descartados = [];
  const fases = [];

  for (const fase of (intent && intent.fases) || []) {
    const { eventos: crudos, sorteos } = plegarRodeos(fase.eventos || []);
    const eventos = [];
    for (const ev of crudos) {
      const r = resolverEvento(ev, idx, sorteos);
      if (r.error) { descartados.push({ evento: ev, motivo: r.error }); continue; }
      eventos.push(r);
    }
    fases.push({ ...fase, eventos });
  }

  return {
    canasta: intent?.canasta ?? null,
    balones: intent?.balones,
    fases,
    descartados,
  };
}
