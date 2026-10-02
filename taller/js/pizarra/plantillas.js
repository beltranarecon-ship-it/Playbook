/* ============================================================
   pizarra/plantillas.js — colocaciones y fases guardadas (§7.8).

   Módulo PURO: sin DOM, sin red. Lo prueba en Node
   taller/tools/eval-plantillas.mjs.

   Dos cosas que se guardan con un nombre para no repetirlas, y que son
   del club, como las acciones (tabla `plantillas`, migración 045):

     · UNA COLOCACIÓN («1-4 alto», «5 abiertos»): dónde está cada ficha
       al empezar, sin nada dibujado. Se pone sustituyendo lo que hay o
       añadiéndose a ello.
     · UNA FASE («bloqueo directo», «entrada por el 45»): lo dibujado en
       una fase, con PAPELES en lugar de fichas. Al insertarla se dice
       qué ficha hace cada papel, y lo dibujado sale de donde esté cada
       una.

   ── LAS FICHAS SE PONEN, NO SE COPIAN ───────────────────────
   Una colocación guardada trae los nombres de las fichas de cuando se
   guardó, que en otra pizarra chocarían con los de las que ya hay. Así
   que cada ficha se vuelve a poner con las mismas piezas que el panel
   —`anadir`, `asignarBalon`—, EN EL ORDEN EN QUE SE GUARDÓ: se numera
   sola y le toca el mismo número, coge su balón, y los que esperan en
   una fila vuelven a su cono cada uno con lo suyo.

   ── LO QUE TIENE SU SITIO, VA A SU SITIO DE AHORA ───────────
   Un bloqueo se pone junto al compañero, y una entrada o un tiro van al
   aro que se ataca: su final no es un punto de la pista sino una cuenta.
   Al insertar una fase guardada esa cuenta se vuelve a hacer con la
   escena de ahora (lo dice quien inserta, con `destino`).

   ── LOS BALONES DE UNA FASE NO SE GUARDAN ───────────────────
   Un pase lo hace «el balón que lleve quien pasa» en ese momento: al
   insertar la fase se sigue quién lo tiene tramo a tramo, y si quien
   tiene que pasar o tirar no lo lleva, ese tramo no se pone y se dice.
   ============================================================ */

import { anadir, asignarBalon, renumerar, COLOCABLES, EQUIPOS } from './elementos.js';
import { hacerFila, normalizarFila } from './filas.js';
import { reanclar, trasladar, nuevoTrazo } from './trazo.js';
import { metrosEntre } from '../canvas/escala.js';

export const TIPOS_PLANTILLA = ['colocacion', 'fase'];
export const MAX_NOMBRE_PLANTILLA = 60;

const finito = (v) => Number.isFinite(v);
const copia = (x) => JSON.parse(JSON.stringify(x));

/** El nombre de una plantilla, limpio, o por qué no vale. */
export function nombreDePlantilla(nombre) {
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (!n) return { nombre: null, error: 'ponle un nombre' };
  if (n.length > MAX_NOMBRE_PLANTILLA) return { nombre: null, error: `el nombre es demasiado largo (${MAX_NOMBRE_PLANTILLA} letras como mucho)` };
  return { nombre: n, error: null };
}

/**
 * Una fila de la tabla `plantillas`, lista para usar, o null si no vale.
 */
export function normalizarPlantilla(fila) {
  if (!fila || typeof fila !== 'object' || !TIPOS_PLANTILLA.includes(fila.tipo)) return null;
  const { nombre } = nombreDePlantilla(fila.nombre);
  const d = fila.datos;
  if (!nombre || !d || typeof d !== 'object') return null;
  if (fila.tipo === 'colocacion' && !Array.isArray(d.elementos)) return null;
  if (fila.tipo === 'fase' && (!Array.isArray(d.papeles) || !Array.isArray(d.tramos))) return null;
  return { id: fila.id ?? null, tipo: fila.tipo, nombre, pista: String(fila.pista || 'entera'), datos: d };
}

/* ── Colocaciones ──────────────────────────────────────────── */

/** LA COLOCACIÓN de una escena: las fichas con su sitio, y nada más. */
export function colocacionDe(elementos) {
  return { elementos: copia((elementos || []).filter((e) => e && COLOCABLES.includes(e.kind) && finito(e.x) && finito(e.y))) };
}

/**
 * PONE UNA COLOCACIÓN sobre una lista de fichas: vacía, la sustituye; con
 * las que ya hay, se añade. Cada ficha se pone como desde el panel.
 *
 * @returns { elementos, puestas } — `puestas`, cuántas fichas ha traído
 */
export function ponerColocacion(lista, datos, pista = 'entera') {
  const suyas = ((datos && datos.elementos) || []).filter((e) => e && COLOCABLES.includes(e.kind) && finito(e.x) && finito(e.y));
  const guardada = new Map(suyas.map((e) => [e.id, e]));
  /* Quien espera en una fila es de su cono; sin él, es un jugador suelto. */
  const conoDe = (e) => {
    const c = e.kind === 'jugador' && e.fila_de ? guardada.get(e.fila_de) : null;
    return c && c.kind === 'cono' && normalizarFila(c.fila) ? c : null;
  };
  let l = [...(lista || [])];
  const nuevo = new Map();   // nombre de la guardada -> nombre de la puesta
  /* TODAS, Y EN SU ORDEN. Los dorsales se cuentan por orden de lista y la
     defensa se empareja por dorsal (§8.1): poniendo aparte a los de las
     filas, al final, el primero de una fila cambiaba de número y los
     pares de la defensa salían cruzados. */
  for (const e of suyas) {
    l = anadir(l, { kind: e.kind, equipo: EQUIPOS.includes(e.equipo) ? e.equipo : 'A' }, e.x, e.y);
    const id = l[l.length - 1].id;
    nuevo.set(e.id, id);
    const extra = {};
    if (e.kind === 'jugador') {
      if (e.dorsal != null) extra.dorsal = e.dorsal;
      if (e.nombre) extra.nombre = e.nombre;
      if (e.regla_defensa) extra.regla_defensa = e.regla_defensa;
      if (e.en_juego === false) extra.en_juego = false;
      if (conoDe(e)) extra.puesto = finito(e.puesto) ? e.puesto : 0;
    }
    if (e.kind === 'cono' && e.nombre) extra.nombre = e.nombre;
    if (e.kind === 'escalera' && finito(e.rot)) extra.rot = e.rot;
    if (Object.keys(extra).length) l = l.map((x) => (x.id === id ? { ...x, ...extra } : x));
  }
  /* Y lo que nombra a otra ficha, con su nombre de ahora: de quién es cada
     balón, la otra pata de una puerta, a quién se defiende, de qué cono es
     cada uno de la cola y a qué fila se vuelve. */
  const de = (id) => (id && nuevo.has(id) ? nuevo.get(id) : null);
  const sinCola = [];
  for (const e of suyas) {
    const id = nuevo.get(e.id);
    const cambios = {};
    if (e.kind === 'cono' && e.puerta_con && de(e.puerta_con)) cambios.puerta_con = de(e.puerta_con);
    if (e.kind === 'jugador' && e.defiende_a && de(e.defiende_a)) cambios.defiende_a = de(e.defiende_a);
    if (e.kind === 'jugador' && conoDe(e)) cambios.fila_de = de(e.fila_de);
    if (e.kind === 'cono' && normalizarFila(e.fila)) {
      cambios.fila = { ...normalizarFila(e.fila), vuelta: de(e.fila.vuelta) };
      if (!suyas.some((x) => conoDe(x) === e)) sinCola.push(id);
    }
    if (Object.keys(cambios).length) l = l.map((x) => (x.id === id ? { ...x, ...cambios } : x));
  }
  for (const e of suyas) {
    if (e.kind === 'balon' && de(e.portador_id)) l = asignarBalon(l, nuevo.get(e.id), de(e.portador_id), pista);
  }
  /* Una fila que llegó sin su cola (de la tabla puede llegar cualquier
     cosa) se rehace, como desde el panel. */
  for (const id of sinCola) l = hacerFila(l, id, l.find((x) => x.id === id).fila, pista);
  return { elementos: renumerar(l), puestas: suyas.length };
}

/* ── Fases ─────────────────────────────────────────────────── */

/**
 * LA PLANTILLA DE UNA FASE: sus tramos, con papeles («p1», «p2»…) en vez
 * de fichas. Solo lo que hacen los jugadores: lo que cuelga de un balón
 * suelto (recoger) o de un cono (rodearlo) no se puede llevar a otra
 * escena, y se dice.
 *
 * @param fase     { tramos }
 * @param elementos la escena
 * @param entrada  { id: {x,y} } dónde está cada uno al empezar la fase
 * @param nombreDe (elemento) => «A1»
 * @param conBalon (tramo) => si lo que hace solo se puede hacer con balón
 *                 (botar, entrar…): al insertarla, sin balón no se pone
 * @returns { datos: { papeles, tramos }, avisos }
 */
export function plantillaDeFase(fase, elementos, { entrada = {}, nombreDe = (e) => e.id, conBalon = () => false } = {}) {
  const porId = new Map((elementos || []).filter(Boolean).map((e) => [e.id, e]));
  const esJugador = (id) => porId.has(id) && porId.get(id).kind === 'jugador';
  const claves = new Map();
  const papeles = [];
  const claveDe = (id) => {
    if (!esJugador(id)) return null;
    if (!claves.has(id)) {
      const e = porId.get(id);
      const en = entrada[id] || { x: e.x, y: e.y };
      claves.set(id, `p${claves.size + 1}`);
      papeles.push({ clave: claves.get(id), equipo: e.equipo || 'A', nombre: nombreDe(e), en: { x: en.x, y: en.y } });
    }
    return claves.get(id);
  };
  const tramos = [];
  const fuera = new Set();
  for (const t of (fase && fase.tramos) || []) {
    if (!t || !Array.isArray(t.trazo) || t.trazo.length < 2) continue;
    if (!esJugador(t.elemento_id) || t.balon_id) { fuera.add(t.accion); continue; }
    const quien = claveDe(t.elemento_id);
    tramos.push({
      accion: t.accion,
      variante: t.variante ?? null,
      ...(t.variante_nombre ? { variante_nombre: t.variante_nombre } : {}),
      tipo: t.tipo,
      ritmo: t.ritmo || 'normal',
      ...(t.desenlace ? { desenlace: t.desenlace } : {}),
      /* Sin los nodos que puso un cono al rodearlo (§7.4): el cono no
         viaja con la fase, y su quiebro se quedaba en una pista sin él. */
      trazo: copia(t.trazo).filter((n) => !n.por_cono),
      quien,
      receptor: t.receptor_id ? claveDe(t.receptor_id) : null,
      companero: t.companero_id ? claveDe(t.companero_id) : null,
      /* ¿lo recorre el balón (un pase, un tiro) y no quien actúa? */
      vuela: !!t.corre_id && t.corre_id !== t.elemento_id,
      /* ¿hace falta llevar balón para hacerlo, aunque lo recorra la ficha? */
      ...(conBalon(t) ? { con_balon: true } : {}),
      /* El arranque puesto a mano en la línea de tiempo (§6.3). */
      ...(t.manual && finito(t.inicio_ms) ? { inicio_ms: Math.max(0, Math.round(t.inicio_ms)) } : {}),
    });
  }
  const avisos = fuera.size ? [`No se guarda lo que cuelga de un balón suelto o de otra ficha que no es un jugador (${[...fuera].join(', ')}).`] : [];
  return { datos: { papeles, tramos }, avisos };
}

/** A qué ficha le toca cada papel si nadie dice otra cosa: la que se
 *  llama igual («A1»); y si no, ninguna. */
export function papelesPorDefecto(datos, elementos, nombreDe = (e) => e.id) {
  const jugadores = (elementos || []).filter((e) => e && e.kind === 'jugador');
  const cogidos = new Set();
  const mapa = {};
  for (const p of (datos && datos.papeles) || []) {
    const suyo = jugadores.find((e) => !cogidos.has(e.id) && nombreDe(e) === p.nombre);
    mapa[p.clave] = suyo ? suyo.id : null;
    if (suyo) cogidos.add(suyo.id);
  }
  return mapa;
}

/**
 * LOS TRAMOS DE UNA PLANTILLA PARA ESTA ESCENA: cada papel es ya una
 * ficha, y lo dibujado sale de donde esté. Los desplazamientos conservan
 * su destino (§5.5), un gesto va entero con su ficha, y un pase va a
 * donde esté quien lo recibe en ese momento.
 *
 * @param mapa     { clave: id de la ficha }
 * @param entrada  { id: {x,y} } al empezar la fase donde se inserta
 * @param posesion { balon: jugador|null } al empezar esa fase
 * @param nuevoId  () => nombre para cada tramo
 * @param destino  ({ accion, tipo, id, desde, companero }) => { x, y } | null
 *                 — a dónde va AQUÍ lo que tiene su sitio (un bloqueo, una
 *                 entrada, un tiro). `companero` es { id, en }. Sin él, o
 *                 si no sabe, se conserva el destino guardado
 * @returns { tramos, avisos } o { motivo }
 */
export function tramosDePlantilla(datos, mapa, { entrada = {}, posesion = {}, pista = 'entera', nuevoId, nombreDe = (id) => id, destino = null } = {}) {
  const papeles = (datos && datos.papeles) || [];
  const fichas = papeles.map((p) => (mapa || {})[p.clave]);
  if (fichas.some((id) => !id || !entrada[id])) return { motivo: 'hay que decir qué ficha hace cada papel' };
  if (new Set(fichas).size !== fichas.length) return { motivo: 'una ficha no puede hacer dos papeles' };
  const de = (clave) => (clave ? mapa[clave] : null);

  /* PRIMERO, QUIÉN TIENE EL BALÓN EN CADA MOMENTO, tramo a tramo: lo que
     pide balón —pasar, tirar, y también botar o entrar— y le toca a quien
     no lo lleva, no se pone. Va antes que la geometría: lo que no se pone
     tampoco mueve a nadie. */
  const balonDe = {};
  for (const [balon, jugador] of Object.entries(posesion || {})) if (jugador && !(jugador in balonDe)) balonDe[jugador] = balon;
  const sinBalon = [];
  const conSuBalon = [];
  for (const t of (datos && datos.tramos) || []) {
    const id = de(t.quien);
    const balon = balonDe[id] || null;
    if ((t.vuela || t.con_balon) && !balon) { sinBalon.push(`${nombreDe(id)} (${t.accion})`); continue; }
    conSuBalon.push({ t, balon });
    if (!t.vuela) continue;
    delete balonDe[id];
    if (de(t.receptor)) balonDe[de(t.receptor)] = balon;
  }
  const guardados = conSuBalon.map((x) => x.t);
  const aDonde = (t, id, desde, companero = null) => (destino && t.tipo !== 'gesto'
    ? destino({ accion: t.accion, tipo: t.tipo, id, desde: { x: desde.x, y: desde.y }, companero }) : null);

  /* Por dónde va pasando cada uno, en la plantilla y aquí: es lo que dice
     a qué sitio de AHORA corresponde el final de un pase de ENTONCES. */
  const antes = Object.fromEntries(papeles.map((p) => [p.clave, [{ ...p.en }]]));
  const ahora = Object.fromEntries(papeles.map((p) => [mapa[p.clave], [{ ...entrada[mapa[p.clave]] }]]));
  const ultima = (lista) => lista[lista.length - 1];
  const trazos = guardados.map((t) => {
    if (t.vuela) return null;
    const id = de(t.quien);
    const desde = ultima(ahora[id]);
    const comp = de(t.companero);
    const suSitio = aDonde(t, id, desde, comp ? { id: comp, en: { ...ultima(ahora[comp]) } } : null);
    const trazo = t.tipo === 'gesto' ? trasladar(t.trazo, desde)
      : suSitio ? nuevoTrazo(desde, suSitio) : reanclar(t.trazo, desde, pista);
    antes[t.quien].push({ x: ultima(t.trazo).x, y: ultima(t.trazo).y });
    ahora[id].push({ x: ultima(trazo).x, y: ultima(trazo).y });
    return trazo;
  });

  const pasos = Object.fromEntries(Object.keys(ahora).map((id) => [id, 0]));   // cuántos tramos suyos van ya
  const tramos = [];
  guardados.forEach((t, k) => {
    const id = de(t.quien);
    const aMano = finito(t.inicio_ms);
    const comun = {
      id: nuevoId(),
      elemento_id: id,
      accion: t.accion,
      variante: t.variante ?? null,
      ...(t.variante_nombre ? { variante_nombre: t.variante_nombre } : {}),
      tipo: t.tipo,
      ritmo: t.ritmo || 'normal',
      balon_id: null,
      balon_desde: null,
      inicio_ms: aMano ? Math.max(0, Math.round(t.inicio_ms)) : null, duracion_ms: null, manual: aMano,
    };
    if (!t.vuela) {
      pasos[id]++;
      tramos.push({ ...comun, corre_id: id, receptor_id: null, trazo: trazos[k], ...(t.companero && de(t.companero) ? { companero_id: de(t.companero) } : {}) });
      return;
    }
    const { balon } = conSuBalon[k];
    const desde = ahora[id][pasos[id]];
    const fin = ultima(t.trazo);
    const receptor = de(t.receptor);
    let hasta = { x: fin.x, y: fin.y };
    if (receptor) {
      /* Donde estaba el receptor en la plantilla cuando le llegaba: el más
         cercano de sus sitios al final del pase. Aquí, el mismo. */
      const sitios = antes[t.receptor];
      let mejor = 0;
      sitios.forEach((s, i) => { if (metrosEntre(pista, s, fin) < metrosEntre(pista, sitios[mejor], fin)) mejor = i; });
      hasta = ahora[receptor][Math.min(mejor, ahora[receptor].length - 1)];
    }
    /* Un tiro va al aro que se ataque AHORA, no al de cuando se guardó. */
    const suSitio = receptor ? null : aDonde(t, id, desde);
    const trazo = receptor ? nuevoTrazo(desde, hasta) : suSitio ? nuevoTrazo(desde, suSitio) : reanclar(t.trazo, desde, pista);
    tramos.push({ ...comun, corre_id: balon, receptor_id: receptor || null, trazo, ...(t.desenlace ? { desenlace: t.desenlace } : {}) });
  });
  const avisos = sinBalon.length ? [`No lleva balón para lo suyo: ${sinBalon.join(', ')}. Eso no se ha puesto.`] : [];
  return { tramos, avisos };
}
