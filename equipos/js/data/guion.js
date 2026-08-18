/* ============================================================
   guion.js — motor PURO que traduce una animación del Taller a una
   explicación en castellano, fase a fase ("el 3 bota hacia el codo
   derecho · pasa al 5 · el 5 tira desde el poste bajo izquierdo").

   Por qué existe: en el planificador el entrenador ve la animación,
   pero una animación muda no se puede leer de un vistazo ni dictar a
   un ayudante. El guion la pone en palabras SIN llamar a ningún
   modelo: se deriva de la geometría ya compilada (fases, paths,
   pases, tiros), así que cuesta 0 € y siempre dice lo mismo para la
   misma animación — decisión congelada de v1 (coste de API cero).

   Sin DOM, sin red: lo importan el visor del planificador y el banco
   Node (equipos/tools/eval-guion.mjs). La única dependencia es la
   tabla de ANCLAS medidas del Taller, que es un objeto de datos puro.
   ============================================================ */

import { posicionesDe, aroExacto } from '../../../taller/js/canvas/anclas.js';
import { metrosEntre } from '../../../taller/js/canvas/escala.js';
import { soloPrimeraRonda } from '../../../taller/js/ia/rondas.js';

/* ── Nombres de zona ──────────────────────────────────────────
   Se escriben ENTEROS (con artículo y género ya resueltos) en vez de
   componer "base + lado": en castellano "la esquina izquierda" y "el
   codo izquierdo" no comparten terminación, y una tabla plana es más
   barata de leer que un motor de concordancia. */
const ZONA = {
  aro:            'el aro',
  tiro_libre:     'la línea de tiros libres',
  base:           'la punta',
  centro:         'el centro del campo',
  poste_bajo_izq: 'el poste bajo izquierdo',
  poste_bajo_der: 'el poste bajo derecho',
  poste_alto_izq: 'el poste alto izquierdo',
  poste_alto_der: 'el poste alto derecho',
  codo_izq:       'el codo izquierdo',
  codo_der:       'el codo derecho',
  escolta_izq:    'el 45 izquierdo',
  escolta_der:    'el 45 derecho',
  alero_izq:      'el alero izquierdo',
  alero_der:      'el alero derecho',
  esquina_izq:    'la esquina izquierda',
  esquina_der:    'la esquina derecha',
};

/* Radio de "esto ES esa zona", en coordenadas normalizadas [0-1] del
   lienzo. 0.09 ≈ 2,5 m en una pista entera: más lejos, nombrar la zona
   sería mentir, y preferimos no decir nada a decir algo falso. */
const RADIO_ZONA = 0.09;

/** Nombre humano de la zona más cercana a un punto, o null si ninguna
 *  ancla queda dentro del radio. Exportada para el banco de pruebas. */
export function zonaDe(pista, canasta, punto) {
  if (!punto) return null;
  const anclas = posicionesDe(pista || 'entera', canasta || 'norte');
  if (!anclas) return null;
  let mejor = null, mejorD = Infinity;
  for (const [slug, xy] of Object.entries(anclas)) {
    if (!ZONA[slug]) continue;
    const d = Math.hypot(punto.x - xy[0], punto.y - xy[1]);
    // empate: gana el slug alfabéticamente menor → guion determinista
    if (d < mejorD || (d === mejorD && slug < mejor)) { mejorD = d; mejor = slug; }
  }
  return mejorD <= RADIO_ZONA ? ZONA[mejor] : null;
}

/* ── Nombres de jugador ─────────────────────────────────────── */

const soloDigitos = (s) => String(s).match(/\d+/)?.[0] ?? String(s);

/** Etiqueta corta de un jugador: dorsal si lo tiene, si no los dígitos
 *  de su id ('A3' → '3'). Es la MISMA que pinta el motor sobre la
 *  ficha, así que lo que se lee casa con lo que se ve. */
export function etiquetaJugador(j) {
  return String(j?.dorsal ?? soloDigitos(j?.id ?? '?'));
}

const EQUIPO_ORDINAL = { A: '1', B: '2', C: '3', D: '4' };

/**
 * Referencias de todos los jugadores, resueltas de una vez para poder
 * DESAMBIGUAR: si el 3 existe en dos equipos, ambos pasan a llamarse
 * "el 3 del equipo 1" / "el 3 del equipo 2"; si no hay choque, se
 * quedan en "el 3" (más corto y es como habla un entrenador).
 * Un jugador con nombre propio siempre gana: "Marcos".
 */
function referencias(jugadores) {
  const veces = new Map();
  for (const j of jugadores) {
    const e = etiquetaJugador(j);
    veces.set(e, (veces.get(e) || new Set()).add(j.equipo || 'A'));
  }
  const ref = new Map();
  for (const j of jugadores) {
    const nombre = String(j.nombre || '').trim();
    if (nombre) { ref.set(j.id, { txt: nombre, propio: true }); continue; }
    const e = etiquetaJugador(j);
    const ambiguo = (veces.get(e)?.size ?? 0) > 1;
    const eq = EQUIPO_ORDINAL[j.equipo] || '1';
    ref.set(j.id, { txt: ambiguo ? `el ${e} del equipo ${eq}` : `el ${e}`, propio: false });
  }
  return ref;
}

/* "a" + "el 5" en castellano es "al 5". Los nombres propios no
   contraen ("a Marcos"), por eso la marca `propio`. */
const aRef = (r) => (r ? (r.txt.startsWith('el ') ? `al ${r.txt.slice(3)}` : `a ${r.txt}`) : 'a otro jugador');
const deRef = (r) => (r ? (r.txt.startsWith('el ') ? `del ${r.txt.slice(3)}` : `de ${r.txt}`) : 'de otro jugador');
const txt = (r) => (r ? r.txt : 'un jugador');

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const nodoFin = (path) => (path?.length ? path[path.length - 1] : null);
const nodoIni = (path) => (path?.length ? path[0] : null);

/* ── Reconstrucción de la posesión ───────────────────────────
   Quién lleva cada balón al EMPEZAR cada fase. Es la misma cadena que
   sigue el motor de animación (engine._build): arranca en
   balon.portador_id y cambia con los pases (nuevo dueño) y los tiros
   (el balón vuela: nadie lo lleva). Sin esto no se puede decir "bota"
   frente a "corta". */
function posesionPorFase(anim) {
  const owner = {};
  for (const b of anim.balones || []) owner[b.id] = b.portador_id || null;
  const porFase = [];
  for (const f of anim.fases || []) {
    porFase.push({ ...owner });
    for (const p of f.pases || []) owner[p.balon_id] = p.a_id || null;
    for (const t of f.tiros || []) owner[t.balon_id] = null;
    // el rebote devuelve la posesión: sin esto, quien coge su propio
    // tiro y vuelve botando aparecería "cortando" en la fase siguiente.
    for (const r of f.recogidas || []) owner[r.balon_id] = r.jugador_id || null;
  }
  return porFase;
}

/* ── Conos sorteados ──────────────────────────────────────────
   El compilador teje los conos de "rodear" DENTRO del trazado, así que
   en la animación no queda ninguna marca que diga "aquí hay un slalom":
   solo un path con nodos de más. Sin esto, el ejercicio estrella del
   bloque de bote se explicaba como "bota hacia la línea de tiros
   libres" y el slalom no aparecía por ningún lado.

   Se detecta al revés: un cono de rodear que cae pegado a alguno de los
   nodos INTERMEDIOS del trazado es un cono que ese jugador sortea. */
const RADIO_CONO = 0.075;

/* Un movimiento que TERMINA en un sitio de la cola es la vuelta a la
   fila. Se detecta igual que el slalom, porque en la animación tampoco
   queda marca de que lo sea — y narrarlo como "bota" (que es verdad,
   vuelve con el balón) no cuenta lo que de verdad pasa ahí.

   No termina EN el cono, sino en un SITIO concreto de la cola, que
   puede estar a media pista si son cuatro esperando. Se comprueba
   contra los sitios uno a uno —cono + dirección × paso × k— y no
   contra una banda alrededor del eje: con una banda, una entrada a
   canasta que pasaba cerca del eje de una fila se narraba como "vuelve
   al final de su fila", que es lo contrario de lo que hacía.

   Dos filtros más, por el mismo motivo:
     · un DEFENSOR ajustando el marcaje no vuelve a ninguna fila, por
       muy cerca del cono que acabe;
     · una vuelta a la cola es un viaje largo, no un ajuste de medio
       metro. */
const FILA_STEP = 0.06;
const SITIOS_COLA = 6;          // hasta dónde puede llegar una cola razonable
const VIAJE_MINIMO = 0.10;      // por debajo de esto es un ajuste, no una vuelta

function vuelveAFila(path, conos, esDefensor) {
  if (esDefensor) return false;
  if (!path || path.length < 2) return false;
  const ini = path[0], fin = path[path.length - 1];
  if (Math.hypot(fin.x - ini.x, fin.y - ini.y) < VIAJE_MINIMO) return false;
  for (const c of conos || []) {
    if (c.funcion !== 'fila' || !c.posicion) continue;
    const rad = (c.fila_config?.direccion_grados || 0) * Math.PI / 180;
    for (let k = 0; k <= SITIOS_COLA; k++) {
      const sx = c.posicion[0] + Math.cos(rad) * FILA_STEP * k;
      const sy = c.posicion[1] + Math.sin(rad) * FILA_STEP * k;
      if (Math.hypot(fin.x - sx, fin.y - sy) <= RADIO_CONO) return true;
    }
  }
  return false;
}

/* Distancia, en metros de verdad, a la que se suelta un tiro. Por
   debajo de esto es una finalización y se narra como tal: "tira desde
   el aro" no lo dice ningún entrenador. */
const METROS_ENTRADA = 1.6;

function esFinalizacion(pista, canasta, punto) {
  const aro = aroExacto(pista, canasta);
  if (!aro || !punto) return false;
  return metrosEntre(pista, punto, aro) <= METROS_ENTRADA;
}

function conosSorteados(path, conos) {
  if (!path || path.length < 3) return 0;
  const rodear = (conos || []).filter((c) => c.funcion === 'rodear' && c.posicion);
  if (!rodear.length) return 0;
  let n = 0;
  for (const c of rodear) {
    for (let i = 1; i < path.length - 1; i++) {
      if (Math.hypot(path[i].x - c.posicion[0], path[i].y - c.posicion[1]) <= RADIO_CONO) { n++; break; }
    }
  }
  return n;
}

/* ── Guion ───────────────────────────────────────────────────── */

/**
 * Explicación fase a fase de una animación.
 * @param anim JSON §10 del Taller ({pista, jugadores, balones, conos, fases})
 * @returns {{
 *   vacio: boolean,                       // sin fases que narrar
 *   resumen: {jugadores, porEquipo, balones, conos, filas, fases, duracionSeg, pista},
 *   fases: [{ n, ms, lineas: string[] }]  // n empieza en 1
 * }}
 */
export function guionDeAnimacion(anim) {
  /* De un ejercicio de seis en fila se narra UNA ronda (Tramo 2.8). Las
     seis son la misma, y un guion que repita seis veces «sale el
     siguiente, bota, entra y vuelve» no se lee: se salta. */
  const a = (anim && anim.rondas > 1)
    ? { ...anim, fases: soloPrimeraRonda(anim.fases) }
    : (anim || {});
  const jugadores = a.jugadores || [];
  const balones = a.balones || [];
  const conos = a.conos || [];
  const fases = a.fases || [];
  const pista = a.pista || 'entera';
  const canastaGlobal = a.canasta || 'norte';

  const ref = referencias(jugadores);
  const porEquipo = {};
  for (const j of jugadores) porEquipo[j.equipo || 'A'] = (porEquipo[j.equipo || 'A'] || 0) + 1;

  // Los conos de tipo 'fila' son colas de espera, no material suelto:
  // se cuentan aparte porque el entrenador los prepara distinto.
  const filas = conos.filter((c) => c.funcion === 'fila').length;

  const resumen = {
    jugadores: jugadores.length,
    porEquipo,
    balones: balones.length,
    conos: conos.length - filas,
    filas,
    fases: fases.length,
    duracionSeg: Math.round(fases.reduce((s, f) => s + (f.duracion_ms || 0) + (f.pausa_post_ms ?? 0), 0) / 1000),
    pista,
  };

  if (!fases.length) return { vacio: true, resumen, fases: [] };

  const posesion = posesionPorFase(a);

  const guionFases = fases.map((f, k) => {
    const lineas = [];
    const defensores = new Set(f.defensores || []);
    const lleva = new Set(
      Object.entries(posesion[k] || {}).filter(([, id]) => id).map(([, id]) => id)
    );

    // 1) bloqueos: van primero porque explican el movimiento que sigue
    for (const b of f.bloqueos || []) {
      lineas.push(`${txt(ref.get(b.bloqueador_id))} bloquea para ${txt(ref.get(b.bloqueado_id))}`);
    }

    // 2) movimientos de jugador. Quien va a por un balón suelto se narra
    //    en el punto 5 (rebote), no aquí: "corta hacia el aro" y "coge el
    //    rebote" serían dos frases para el mismo desplazamiento.
    const recogen = new Set((f.recogidas || []).map((r) => r.jugador_id));
    for (const m of f.movimientos || []) {
      if (m.tipo_elemento === 'balon') continue;      // el balón se narra en pases/tiros
      if (recogen.has(m.elemento_id)) continue;
      const r = ref.get(m.elemento_id);
      const conBalon = m.tipo_movimiento === 'carrera_con_balon' || lleva.has(m.elemento_id);
      if (vuelveAFila(m.path, conos, defensores.has(m.elemento_id))) {
        lineas.push(`${txt(r)} vuelve al final de su fila${conBalon ? ' con el balón' : ''}`);
        continue;
      }
      const destino = zonaDe(pista, canastaGlobal, nodoFin(m.path));
      const hacia = destino ? ` hacia ${destino}` : '';
      const nConos = conosSorteados(m.path, conos);
      const sorteo = nConos > 1 ? ' sorteando los conos' : nConos === 1 ? ' rodeando el cono' : '';
      const verbo = defensores.has(m.elemento_id) ? 'ajusta el marcaje' : conBalon ? 'bota' : 'corta';
      lineas.push(`${txt(r)} ${verbo}${hacia}${sorteo}`);
    }

    // 3) pases
    for (const p of f.pases || []) {
      const de = ref.get(p.de_id);
      const para = ref.get(p.a_id);
      const donde = zonaDe(pista, canastaGlobal, nodoFin(p.path));
      // sin de_id (animaciones editadas a mano) el pase se narra en pasiva
      const base = de ? `${txt(de)} pasa ${aRef(para)}` : `el balón va ${aRef(para)}`;
      lineas.push(donde ? `${base}, que recibe en ${donde}` : base);
    }

    // 4) tiros
    for (const t of f.tiros || []) {
      const r = ref.get(t.jugador_id);
      const canasta = t.canasta || canastaGlobal;
      const salida = nodoIni(t.path);
      // pegado al aro no es un tiro, es una entrada: "tira desde el aro"
      // no lo dice ningún entrenador.
      if (esFinalizacion(pista, canasta, salida)) {
        lineas.push(r ? `${txt(r)} entra a canasta` : 'entrada a canasta');
        continue;
      }
      const desde = zonaDe(pista, canasta, salida);
      lineas.push(r
        ? `${txt(r)} tira${desde ? ` desde ${desde}` : ' a canasta'}`
        : `tiro a canasta${desde ? ` desde ${desde}` : ''}`);
    }

    // 5) recogidas: el rebote. Va al final porque cierra la acción — y
    //    porque de dónde sale el balón ya lo ha contado el tiro.
    for (const rec of f.recogidas || []) {
      const r = ref.get(rec.jugador_id);
      if (!r) continue;
      // si el balón venía de un tiro (de esta fase o de la anterior) es un
      // rebote; si estaba parado en el suelo, es recogerlo y ya.
      const veniaDeTiro = (fases[k - 1]?.tiros || []).some((t) => t.balon_id === rec.balon_id)
        || (f.tiros || []).some((t) => t.balon_id === rec.balon_id);
      lineas.push(`${txt(r)} ${veniaDeTiro ? 'coge el rebote' : 'recoge el balón'}`);
    }

    return {
      n: k + 1,
      ms: (f.duracion_ms || 0) + (f.pausa_post_ms ?? 0),
      lineas: lineas.map(capital),
    };
  });

  return { vacio: false, resumen, fases: guionFases };
}

/** Línea de material para la cabecera del visor: "5 jugadores · 1 balón
 *  · 2 filas". Omite lo que vale cero en vez de escribir "0 conos". */
export function resumenMaterial(resumen) {
  if (!resumen) return '';
  const plural = (n, uno, muchos) => `${n} ${n === 1 ? uno : muchos}`;
  return [
    resumen.jugadores ? plural(resumen.jugadores, 'jugador', 'jugadores') : null,
    resumen.balones ? plural(resumen.balones, 'balón', 'balones') : null,
    resumen.conos ? plural(resumen.conos, 'cono', 'conos') : null,
    resumen.filas ? plural(resumen.filas, 'fila', 'filas') : null,
  ].filter(Boolean).join(' · ');
}
