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
   —`anadir`, `asignarBalon`, `hacerFila`—: se numera sola, coge su
   balón y su fila se rehace con su cola.

   ── LOS BALONES DE UNA FASE NO SE GUARDAN ───────────────────
   Un pase lo hace «el balón que lleve quien pasa» en ese momento: al
   insertar la fase se sigue quién lo tiene tramo a tramo, y si quien
   tiene que pasar o tirar no lo lleva, ese tramo no se pone y se dice.
   ============================================================ */

import { anadir, asignarBalon, enJuego, COLOCABLES, EQUIPOS } from './elementos.js';
import { hacerFila } from './filas.js';
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
  /* Los que esperan en una fila, y sus balones, los pone la fila. */
  const deFila = new Set(suyas.filter((e) => e.kind === 'jugador' && e.fila_de).map((e) => e.id));
  const delaFila = (e) => deFila.has(e.id) || (e.kind === 'balon' && deFila.has(e.portador_id));
  let l = [...(lista || [])];
  const nuevo = new Map();   // nombre de la guardada -> nombre de la puesta
  let puestas = 0;
  for (const e of suyas) {
    if (delaFila(e)) continue;
    l = anadir(l, { kind: e.kind, equipo: EQUIPOS.includes(e.equipo) ? e.equipo : 'A' }, e.x, e.y);
    const id = l[l.length - 1].id;
    nuevo.set(e.id, id);
    puestas++;
    const extra = {};
    if (e.kind === 'jugador') {
      if (e.dorsal != null) extra.dorsal = e.dorsal;
      if (e.nombre) extra.nombre = e.nombre;
      if (e.regla_defensa) extra.regla_defensa = e.regla_defensa;
    }
    if (e.kind === 'cono' && e.nombre) extra.nombre = e.nombre;
    if (e.kind === 'escalera' && finito(e.rot)) extra.rot = e.rot;
    if (Object.keys(extra).length) l = l.map((x) => (x.id === id ? { ...x, ...extra } : x));
    if (e.kind === 'jugador' && e.en_juego === false) l = enJuego(l, id, false);
  }
  for (const e of suyas) {
    const id = nuevo.get(e.id);
    if (!id) continue;
    if (e.kind === 'balon' && e.portador_id && nuevo.has(e.portador_id)) l = asignarBalon(l, id, nuevo.get(e.portador_id), pista);
    if (e.kind === 'cono' && e.fila) l = hacerFila(l, id, e.fila, pista);
    if (e.kind === 'cono' && e.puerta_con && nuevo.has(e.puerta_con)) l = l.map((x) => (x.id === id ? { ...x, puerta_con: nuevo.get(e.puerta_con) } : x));
    if (e.kind === 'jugador' && e.defiende_a && nuevo.has(e.defiende_a)) l = l.map((x) => (x.id === id ? { ...x, defiende_a: nuevo.get(e.defiende_a) } : x));
  }
  return { elementos: l, puestas };
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
 * @returns { datos: { papeles, tramos }, avisos }
 */
export function plantillaDeFase(fase, elementos, { entrada = {}, nombreDe = (e) => e.id } = {}) {
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
      trazo: copia(t.trazo).map(({ por_cono: _c, ...n }) => n),
      quien,
      receptor: t.receptor_id ? claveDe(t.receptor_id) : null,
      companero: t.companero_id ? claveDe(t.companero_id) : null,
      /* ¿lo recorre el balón (un pase, un tiro) y no quien actúa? */
      vuela: !!t.corre_id && t.corre_id !== t.elemento_id,
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
 * @returns { tramos, avisos } o { motivo }
 */
export function tramosDePlantilla(datos, mapa, { entrada = {}, posesion = {}, pista = 'entera', nuevoId, nombreDe = (id) => id } = {}) {
  const papeles = (datos && datos.papeles) || [];
  const fichas = papeles.map((p) => (mapa || {})[p.clave]);
  if (fichas.some((id) => !id || !entrada[id])) return { motivo: 'hay que decir qué ficha hace cada papel' };
  if (new Set(fichas).size !== fichas.length) return { motivo: 'una ficha no puede hacer dos papeles' };
  const de = (clave) => (clave ? mapa[clave] : null);
  const guardados = (datos && datos.tramos) || [];

  /* Por dónde va pasando cada uno, en la plantilla y aquí: es lo que dice
     a qué sitio de AHORA corresponde el final de un pase de ENTONCES. */
  const antes = Object.fromEntries(papeles.map((p) => [p.clave, [{ ...p.en }]]));
  const ahora = Object.fromEntries(papeles.map((p) => [mapa[p.clave], [{ ...entrada[mapa[p.clave]] }]]));
  const ultima = (lista) => lista[lista.length - 1];
  const trazos = guardados.map((t) => {
    if (t.vuela) return null;
    const id = de(t.quien);
    const desde = ultima(ahora[id]);
    const trazo = t.tipo === 'gesto' ? trasladar(t.trazo, desde) : reanclar(t.trazo, desde, pista);
    antes[t.quien].push({ x: ultima(t.trazo).x, y: ultima(t.trazo).y });
    ahora[id].push({ x: ultima(trazo).x, y: ultima(trazo).y });
    return trazo;
  });

  const balonDe = {};
  for (const [balon, jugador] of Object.entries(posesion || {})) if (jugador && !(jugador in balonDe)) balonDe[jugador] = balon;
  const pasos = Object.fromEntries(Object.keys(ahora).map((id) => [id, 0]));   // cuántos tramos suyos van ya
  const tramos = [];
  const sinBalon = [];
  guardados.forEach((t, k) => {
    const id = de(t.quien);
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
      inicio_ms: null, duracion_ms: null, manual: false,
    };
    if (!t.vuela) {
      pasos[id]++;
      tramos.push({ ...comun, corre_id: id, receptor_id: null, trazo: trazos[k], ...(t.companero && de(t.companero) ? { companero_id: de(t.companero) } : {}) });
      return;
    }
    const balon = balonDe[id];
    if (!balon) { sinBalon.push(`${nombreDe(id)} (${t.accion})`); return; }
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
    const trazo = receptor ? nuevoTrazo(desde, hasta) : reanclar(t.trazo, desde, pista);
    tramos.push({ ...comun, corre_id: balon, receptor_id: receptor || null, trazo, ...(t.desenlace ? { desenlace: t.desenlace } : {}) });
    delete balonDe[id];
    if (receptor) balonDe[receptor] = balon;
  });
  const avisos = sinBalon.length ? [`No lleva balón para lo suyo: ${sinBalon.join(', ')}. Eso no se ha puesto.`] : [];
  return { tramos, avisos };
}
