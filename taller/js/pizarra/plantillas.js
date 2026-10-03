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
   —`anadir`, `asignarBalon`, `hacerFila`—: se numera sola (el dorsal
   escrito a mano no viaja), coge su balón y su fila se rehace con su
   cola.

   ── LOS BALONES DE UNA FASE NO SE GUARDAN ───────────────────
   Un pase lo hace «el balón que lleve quien pasa» en ese momento: al
   insertar la fase se sigue quién lo tiene tramo a tramo, y si quien
   tiene que pasar, tirar o botar no lo lleva, ese tramo no se pone y
   se dice.

   ── LA CANASTA ──────────────────────────────────────────────
   Cada plantilla guarda a qué canasta se atacaba (`datos.canasta`,
   'norte' o 'sur'; las de antes, sin ella, son de la norte). Puesta en
   una jugada que ataca a la otra, va EN ESPEJO: las fichas, los nodos,
   el tiro y la orientación de filas y escaleras. Es el mismo espejo que
   el de las anclas (canvas/medidas.js): la sur se refleja en Y.

   ── LO QUE LLEGA DE LA BASE DE DATOS NO SE DA POR BUENO ─────
   La tabla solo exige que `datos` sea un objeto. Así que lo de dentro
   se sanea aquí: los textos pasan a texto recortado y con tope, y lo
   que no se entiende (un papel vacío, un tramo de alguien que no es un
   papel, un trazo roto) se deja fuera y se cuenta, en vez de romper.
   ============================================================ */

import { anadir, asignarBalon, enJuego, numeroDe, COLOCABLES, EQUIPOS } from './elementos.js';
import { hacerFila, normalizarFila, normalizarGrados } from './filas.js';
import { reanclar, trasladar, nuevoTrazo } from './trazo.js';
import { saleEn } from './repertorio.js';
import { CATALOGO_SISTEMA } from '../ia/acciones.js';
import { metrosEntre } from '../canvas/escala.js';
import { PISTAS_M, pistaANorm } from '../canvas/medidas.js';

export const TIPOS_PLANTILLA = ['colocacion', 'fase'];
export const MAX_NOMBRE_PLANTILLA = 60;
/** Tope de los textos que vienen dentro de `datos` (nombres, papeles). */
export const MAX_TEXTO_PLANTILLA = 40;
export const CANASTAS_PLANTILLA = ['norte', 'sur'];

const MAX_DORSAL = 4;
const MAX_ID = 64;
const MAX_CLAVE = 8;

const finito = (v) => Number.isFinite(v);
const copia = (x) => JSON.parse(JSON.stringify(x));
const ultima = (lista) => lista[lista.length - 1];
const nombrePorDefecto = (e) => `${e.equipo || ''}${numeroDe(e) || ''}`;

/* ── Saneado de lo que llega de fuera ─────────────────────── */

/** Texto recortado, sin espacios de más y con tope; '' si no es texto. */
function texto(v, max = MAX_TEXTO_PLANTILLA) {
  if (typeof v === 'number' && finito(v)) v = String(v);
  if (typeof v !== 'string') return '';
  return v.trim().replace(/\s+/g, ' ').slice(0, max);
}
const textoONull = (v, max) => texto(v, max) || null;
const SLUG = /^[a-z][a-z0-9_]{0,39}$/;
const slug = (v) => (typeof v === 'string' && SLUG.test(v) ? v : null);
const punto = (p) => (p && typeof p === 'object' && finito(p.x) && finito(p.y) ? { x: p.x, y: p.y } : null);
const entre01 = (v) => Math.min(1, Math.max(0, v));
const canastaDe = (c) => (CANASTAS_PLANTILLA.includes(c) ? c : 'norte');

function nodo(n) {
  const p = punto(n);
  if (!p) return null;
  return { ...p, tipo_nodo: n.tipo_nodo === 'bezier' ? 'bezier' : 'lineal', handle_in: punto(n.handle_in), handle_out: punto(n.handle_out) };
}

/* Una ficha de una colocación guardada, saneada, o null. */
function fichaGuardada(e) {
  if (!e || typeof e !== 'object' || !COLOCABLES.includes(e.kind) || !finito(e.x) || !finito(e.y)) return null;
  const id = textoONull(e.id, MAX_ID);
  if (!id) return null;
  const base = { id, kind: e.kind, x: entre01(e.x), y: entre01(e.y) };
  switch (e.kind) {
    case 'jugador':
      return {
        ...base,
        equipo: EQUIPOS.includes(e.equipo) ? e.equipo : 'A',
        dorsal: textoONull(e.dorsal, MAX_DORSAL),
        nombre: textoONull(e.nombre),
        en_juego: e.en_juego !== false,
        defiende_a: textoONull(e.defiende_a, MAX_ID),
        regla_defensa: slug(e.regla_defensa),
        fila_de: textoONull(e.fila_de, MAX_ID),
        ...(Number.isInteger(e.puesto) && e.puesto >= 0 ? { puesto: e.puesto } : {}),
      };
    case 'balon':
      return { ...base, portador_id: textoONull(e.portador_id, MAX_ID) };
    case 'cono':
      return { ...base, nombre: textoONull(e.nombre), fila: normalizarFila(e.fila), puerta_con: textoONull(e.puerta_con, MAX_ID) };
    case 'escalera':
      return { ...base, rot: finito(e.rot) ? e.rot : 0 };
    default:
      return base;
  }
}

/** Los datos de una colocación, saneados: { datos: { elementos, canasta }, descartados }. */
function datosDeColocacion(d) {
  const elementos = [];
  const vistos = new Set();
  let descartados = 0;
  for (const e of (d && Array.isArray(d.elementos) ? d.elementos : [])) {
    const f = fichaGuardada(e);
    /* Lo que no es una ficha del panel (una zona) no cuenta como roto. */
    if (!f) { if (e && typeof e === 'object' && !COLOCABLES.includes(e.kind) && typeof e.kind === 'string') continue; descartados++; continue; }
    if (vistos.has(f.id)) { descartados++; continue; }
    vistos.add(f.id);
    elementos.push(f);
  }
  return { datos: { elementos, canasta: canastaDe(d && d.canasta) }, descartados };
}

/* Un tramo de una fase guardada, saneado, o null si no se entiende. */
function tramoGuardado(t, claves) {
  if (!t || typeof t !== 'object') return null;
  const accion = slug(t.accion);
  const quien = textoONull(t.quien, MAX_CLAVE);
  if (!accion || !quien || !claves.has(quien)) return null;
  const tipo = typeof t.tipo === 'string' && /^[a-z_]{1,16}$/.test(t.tipo) ? t.tipo : null;
  if (!tipo) return null;
  const trazo = Array.isArray(t.trazo) ? t.trazo.map(nodo) : null;
  if (!trazo || trazo.length < 2 || trazo.some((n) => !n)) return null;
  /* Un receptor o un compañero que no es ninguno de los papeles: roto. */
  const ref = (v) => (v == null ? null : (claves.has(v) ? v : undefined));
  const receptor = ref(t.receptor);
  const companero = ref(t.companero);
  if (receptor === undefined || companero === undefined) return null;
  const variante_nombre = textoONull(t.variante_nombre);
  return {
    accion,
    variante: slug(t.variante),
    ...(variante_nombre ? { variante_nombre } : {}),
    tipo,
    ritmo: slug(t.ritmo) || 'normal',
    ...(t.desenlace === 'entra' || t.desenlace === 'falla' ? { desenlace: t.desenlace } : {}),
    trazo,
    quien,
    receptor,
    companero,
    vuela: t.vuela === true,
  };
}

/** Los datos de una fase, saneados: { datos: { canasta, papeles, tramos }, descartados }. */
function datosDeFase(d) {
  let descartados = 0;
  const claves = new Set();
  const todos = [];
  for (const p of (d && Array.isArray(d.papeles) ? d.papeles : [])) {
    const clave = p && typeof p === 'object' ? textoONull(p.clave, MAX_CLAVE) : null;
    const en = p && typeof p === 'object' ? punto(p.en) : null;
    if (!clave || !en || claves.has(clave)) { descartados++; continue; }
    claves.add(clave);
    todos.push({ clave, equipo: EQUIPOS.includes(p.equipo) ? p.equipo : 'A', nombre: texto(p.nombre) || clave, en });
  }
  const tramos = [];
  for (const t of (d && Array.isArray(d.tramos) ? d.tramos : [])) {
    const r = tramoGuardado(t, claves);
    if (r) tramos.push(r); else descartados++;
  }
  /* Un papel que ya no sale en ningún tramo no se pide al insertar. */
  const usados = new Set(tramos.flatMap((t) => [t.quien, t.receptor, t.companero]).filter(Boolean));
  const papeles = todos.filter((p) => usados.has(p.clave));
  return { datos: { canasta: canastaDe(d && d.canasta), papeles, tramos }, descartados };
}

/* ── El espejo de una canasta a la otra ───────────────────── */

/* La suma de la Y de las dos canastas en el [0,1]: el espejo es
   y → suma − y. null si la pista no tiene dos canastas (las medias). */
function sumaDelEspejo(pista) {
  const p = PISTAS_M[pista];
  if (!p || !(p.canastas || []).includes('norte') || !(p.canastas || []).includes('sur')) return null;
  const [, a] = pistaANorm(pista, 0, 0, 'norte');
  const [, b] = pistaANorm(pista, 0, 0, 'sur');
  return Number((a + b).toFixed(12));
}

/** La suma del espejo si hay que ponerla en espejo, o null. */
function espejoEntre(origen, destino, pista) {
  if (canastaDe(origen) === canastaDe(destino)) return null;
  return sumaDelEspejo(pista);
}

const enEspejo = (p, s) => (p ? { ...p, y: s - p.y } : p);
const nodoEnEspejo = (n, s) => ({ ...n, y: s - n.y, handle_in: enEspejo(n.handle_in, s), handle_out: enEspejo(n.handle_out, s) });

function fichaEnEspejo(e, s) {
  const f = { ...e, y: entre01(s - e.y) };
  /* Un ángulo en la pantalla (y hacia abajo) se refleja cambiándole el signo. */
  if (e.kind === 'escalera') f.rot = normalizarGrados(-(e.rot || 0));
  if (e.kind === 'cono' && e.fila) f.fila = { ...e.fila, orientacion: normalizarGrados(-(e.fila.orientacion || 0)) };
  return f;
}

function faseEnEspejo(d, s) {
  return {
    ...d,
    papeles: d.papeles.map((p) => ({ ...p, en: enEspejo(p.en, s) })),
    tramos: d.tramos.map((t) => ({ ...t, trazo: t.trazo.map((n) => nodoEnEspejo(n, s)) })),
  };
}

/* ── El nombre y la fila de la tabla ──────────────────────── */

/** El nombre de una plantilla, limpio, o por qué no vale. */
export function nombreDePlantilla(nombre) {
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (!n) return { nombre: null, error: 'ponle un nombre' };
  if (n.length > MAX_NOMBRE_PLANTILLA) return { nombre: null, error: `el nombre es demasiado largo (${MAX_NOMBRE_PLANTILLA} letras como mucho)` };
  return { nombre: n, error: null };
}

/**
 * Una fila de la tabla `plantillas`, lista para usar, o null si no vale.
 * Sus `datos` salen saneados y copiados; si se ha dejado algo fuera,
 * `descartados` dice cuánto.
 */
export function normalizarPlantilla(fila) {
  if (!fila || typeof fila !== 'object' || !TIPOS_PLANTILLA.includes(fila.tipo)) return null;
  if (typeof fila.nombre !== 'string') return null;
  const { nombre } = nombreDePlantilla(fila.nombre);
  const d = fila.datos;
  if (!nombre || !d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (fila.tipo === 'colocacion' && !Array.isArray(d.elementos)) return null;
  if (fila.tipo === 'fase' && (!Array.isArray(d.papeles) || !Array.isArray(d.tramos))) return null;
  const r = fila.tipo === 'colocacion' ? datosDeColocacion(d) : datosDeFase(d);
  /* Una fase en la que no queda nada que se entienda no se ofrece. */
  if (fila.tipo === 'fase' && !r.datos.tramos.length) return null;
  return {
    id: fila.id == null ? null : textoONull(fila.id, MAX_ID),
    tipo: fila.tipo,
    nombre,
    pista: textoONull(fila.pista, MAX_TEXTO_PLANTILLA) || 'entera',
    datos: r.datos,
    ...(r.descartados ? { descartados: r.descartados } : {}),
  };
}

/**
 * Lo que se le dice al entrenador cuando la base de datos no deja
 * guardar o quitar una plantilla.
 * @param que 'guardar' | 'borrar'
 */
export function errorDePlantilla(error, que = 'guardar') {
  const m = String((error && error.message) || '');
  const code = error && error.code;
  if (code === 'PGRST205' || /Could not find the table/i.test(m)) {
    return 'todavía no está la tabla de plantillas. Hay que aplicar la migración 045 en Supabase.';
  }
  if (code === '42501' || /row-level security|permission denied/i.test(m)) {
    return que === 'borrar'
      ? 'esa plantilla la guardó otro entrenador: solo puede tocarla quien la guardó, o un administrador.'
      : 'la base de datos no te deja guardar plantillas: comprueba que has entrado con tu cuenta.';
  }
  return m || 'error desconocido';
}

/* ── Colocaciones ──────────────────────────────────────────── */

/**
 * LA COLOCACIÓN de una escena: las fichas con su sitio, y nada más, y
 * a qué canasta se atacaba.
 */
export function colocacionDe(elementos, { canasta = 'norte' } = {}) {
  return {
    elementos: copia((elementos || []).filter((e) => e && COLOCABLES.includes(e.kind) && finito(e.x) && finito(e.y))),
    canasta: canastaDe(canasta),
  };
}

/**
 * PONE UNA COLOCACIÓN sobre una lista de fichas: vacía, la sustituye; con
 * las que ya hay, se añade. Cada ficha se pone como desde el panel, y si
 * la jugada ataca a la otra canasta, en espejo.
 *
 * @param canasta  la canasta a la que ataca la jugada donde se pone
 * @returns { elementos, puestas, avisos } — `puestas`, cuántas fichas ha traído
 */
export function ponerColocacion(lista, datos, pista = 'entera', canasta = 'norte', { nombreDe = nombrePorDefecto } = {}) {
  const { datos: limpio, descartados } = datosDeColocacion(datos);
  const s = espejoEntre(limpio.canasta, canasta, pista);
  const suyas = s == null ? limpio.elementos : limpio.elementos.map((e) => fichaEnEspejo(e, s));
  /* Los que esperan en una fila, y sus balones, los pone la fila. */
  const deFila = new Set(suyas.filter((e) => e.kind === 'jugador' && e.fila_de).map((e) => e.id));
  const delaFila = (e) => deFila.has(e.id) || (e.kind === 'balon' && deFila.has(e.portador_id));
  let l = [...(lista || [])];
  const nuevo = new Map();   // nombre de la guardada -> nombre de la puesta
  const avisos = descartados
    ? [`${descartados === 1 ? 'Una ficha' : `${descartados} fichas`} de la colocación no se ${descartados === 1 ? 'entendía' : 'entendían'}. Eso no se ha puesto.`]
    : [];
  let puestas = 0;
  for (const e of suyas) {
    if (delaFila(e)) continue;
    l = anadir(l, { kind: e.kind, equipo: e.equipo }, e.x, e.y);
    const id = l[l.length - 1].id;
    nuevo.set(e.id, id);
    puestas++;
    /* El dorsal escrito a mano NO viaja: la colocación se numera sola. */
    const extra = {};
    if (e.kind === 'jugador') {
      if (e.nombre) extra.nombre = e.nombre;
      if (e.regla_defensa) extra.regla_defensa = e.regla_defensa;
    }
    if (e.kind === 'cono' && e.nombre) extra.nombre = e.nombre;
    if (e.kind === 'escalera') extra.rot = e.rot;
    if (Object.keys(extra).length) l = l.map((x) => (x.id === id ? { ...x, ...extra } : x));
    if (e.kind === 'jugador' && e.en_juego === false) l = enJuego(l, id, false);
  }
  for (const e of suyas) {
    const id = nuevo.get(e.id);
    if (!id) continue;
    if (e.kind === 'balon' && e.portador_id && nuevo.has(e.portador_id)) l = asignarBalon(l, id, nuevo.get(e.portador_id), pista);
    if (e.kind === 'cono' && e.fila) {
      /* La vuelta es OTRO cono: con su nombre de ahora, o sin ella. */
      const vuelta = e.fila.vuelta && nuevo.has(e.fila.vuelta) ? nuevo.get(e.fila.vuelta) : null;
      l = hacerFila(l, id, { ...e.fila, vuelta }, pista);
    }
    if (e.kind === 'cono' && e.puerta_con && nuevo.has(e.puerta_con)) l = l.map((x) => (x.id === id ? { ...x, puerta_con: nuevo.get(e.puerta_con) } : x));
    if (e.kind === 'jugador' && e.defiende_a) {
      if (nuevo.has(e.defiende_a)) l = l.map((x) => (x.id === id ? { ...x, defiende_a: nuevo.get(e.defiende_a) } : x));
      else if (deFila.has(e.defiende_a)) {
        const suyo = l.find((x) => x.id === id);
        avisos.push(`No se pone a quién defiende ${nombreDe(suyo)}: era uno de una fila, y la fila se rehace. Se empareja solo.`);
      }
    }
  }
  return { elementos: l, puestas, avisos };
}

/* ── Fases ─────────────────────────────────────────────────── */

/**
 * LA PLANTILLA DE UNA FASE: sus tramos, con papeles («p1», «p2»…) en vez
 * de fichas. Solo lo que hacen los jugadores: lo que cuelga de un balón
 * suelto (recoger), los conos que rodea un trazo, a qué defensor se pone
 * un bloqueo y lo que declaran los defensores no se pueden llevar a otra
 * escena, y se dice.
 *
 * @param fase     { tramos, defensa }
 * @param elementos la escena
 * @param entrada  { id: {x,y} } dónde está cada uno al empezar la fase
 * @param nombreDe (elemento) => «A1»
 * @param canasta  a qué canasta se ataca en esa fase
 * @returns { datos: { canasta, papeles, tramos }, avisos }
 */
export function plantillaDeFase(fase, elementos, { entrada = {}, nombreDe = (e) => e.id, canasta = 'norte' } = {}) {
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
  const conDefensor = new Set();
  const conConos = new Set();
  for (const t of (fase && fase.tramos) || []) {
    if (!t || !Array.isArray(t.trazo) || t.trazo.length < 2) continue;
    if (!esJugador(t.elemento_id) || t.balon_id) { fuera.add(t.accion); continue; }
    const quien = claveDe(t.elemento_id);
    if (t.defensor_id) conDefensor.add(t.accion);
    if ((Array.isArray(t.sorteando) && t.sorteando.length) || t.trazo.some((n) => n && n.por_cono)) conConos.add(t.accion);
    tramos.push({
      accion: t.accion,
      variante: t.variante ?? null,
      ...(t.variante_nombre ? { variante_nombre: t.variante_nombre } : {}),
      tipo: t.tipo,
      ritmo: t.ritmo || 'normal',
      ...(t.desenlace ? { desenlace: t.desenlace } : {}),
      trazo: copia(t.trazo).map(({ por_cono: _c, lado: _l, puerta: _p, ...n }) => n),
      quien,
      receptor: t.receptor_id ? claveDe(t.receptor_id) : null,
      companero: t.companero_id ? claveDe(t.companero_id) : null,
      /* ¿lo recorre el balón (un pase, un tiro) y no quien actúa? */
      vuela: !!t.corre_id && t.corre_id !== t.elemento_id,
    });
  }
  const avisos = [];
  if (fuera.size) avisos.push(`No se guarda lo que cuelga de un balón suelto o de otra ficha que no es un jugador (${[...fuera].join(', ')}).`);
  if (conDefensor.size) avisos.push(`No se guarda a qué defensor se le pone el bloqueo (${[...conDefensor].join(', ')}): al insertarla, la barra mira hacia donde llega.`);
  if (conConos.size) avisos.push(`No se guardan los conos que se rodean (${[...conConos].join(', ')}): el camino se queda con su forma, sin ellos.`);
  if (fase && fase.defensa && typeof fase.defensa === 'object' && Object.keys(fase.defensa).length) {
    avisos.push('No se guarda lo que hacen distinto los defensores en esta fase: al insertarla, defienden como diga la regla.');
  }
  return { datos: { canasta: canastaDe(canasta), papeles, tramos }, avisos };
}

/** A qué ficha le toca cada papel si nadie dice otra cosa: la que se
 *  llama igual («A1»); y si no, ninguna. */
export function papelesPorDefecto(datos, elementos, nombreDe = (e) => e.id) {
  const jugadores = (elementos || []).filter((e) => e && e.kind === 'jugador');
  const cogidos = new Set();
  const mapa = {};
  for (const p of datosDeFase(datos).datos.papeles) {
    const suyo = jugadores.find((e) => !cogidos.has(e.id) && nombreDe(e) === p.nombre);
    mapa[p.clave] = suyo ? suyo.id : null;
    if (suyo) cogidos.add(suyo.id);
  }
  return mapa;
}

const accionDelCatalogo = (s) => CATALOGO_SISTEMA.find((a) => a.slug === s) || null;

/* Lo que sale con balón y no sin él: botar, entrar, rodear, cambiar de
   mano… (el pase y el tiro vuelan, y van aparte). */
const necesitaBalon = (accion) => !!accion && saleEn(accion, 'conBalon') && !saleEn(accion, 'sinBalon');

/**
 * LOS TRAMOS DE UNA PLANTILLA PARA ESTA ESCENA: cada papel es ya una
 * ficha, y lo dibujado sale de donde esté. Los desplazamientos conservan
 * su destino (§5.5), un gesto va entero con su ficha, y un pase va a
 * donde esté quien lo recibe en ese momento. Si la escena ataca a la
 * otra canasta, todo va en espejo.
 *
 * Se recorre en el orden en que se dibujó: es el orden en que pasan las
 * cosas de cada uno, y un pase solo pudo dibujarse hacia donde estaba
 * entonces el receptor (y si estuvo dos veces en el mismo sitio, en la
 * última).
 *
 * @param mapa     { clave: id de la ficha }
 * @param entrada  { id: {x,y} } al empezar la fase donde se inserta
 * @param posesion { balon: jugador|null } al empezar esa fase
 * @param canasta  a qué canasta se ataca en esa fase
 * @param nuevoId  () => nombre para cada tramo
 * @param accionDe (slug) => la acción del catálogo, para saber qué
 *                 necesita balón
 * @returns { tramos, avisos } o { motivo }
 */
export function tramosDePlantilla(datos, mapa, {
  entrada = {}, posesion = {}, pista = 'entera', canasta = 'norte', nuevoId, nombreDe = (id) => id, accionDe = accionDelCatalogo,
} = {}) {
  /* Saneado y COPIADO: lo insertado no comparte ni un nodo con la plantilla. */
  const { datos: limpio, descartados } = datosDeFase(datos);
  const s = espejoEntre(limpio.canasta, canasta, pista);
  const d = s == null ? limpio : faseEnEspejo(limpio, s);
  const papeles = d.papeles;
  const fichas = papeles.map((p) => (mapa || {})[p.clave]);
  if (fichas.some((id) => !id || !entrada[id])) return { motivo: 'hay que decir qué ficha hace cada papel' };
  if (new Set(fichas).size !== fichas.length) return { motivo: 'una ficha no puede hacer dos papeles' };
  const de = (clave) => (clave ? mapa[clave] : null);

  /* Por dónde va pasando cada uno, en la plantilla y aquí, tramo a tramo
     suyo: es lo que dice a qué sitio de AHORA corresponde el final de un
     pase de ENTONCES. Las dos listas van a la par: si un tramo no se
     pone, aquí se queda donde estaba. */
  const antes = Object.fromEntries(papeles.map((p) => [p.clave, [{ ...p.en }]]));
  const ahora = Object.fromEntries(papeles.map((p) => [mapa[p.clave], [{ ...entrada[mapa[p.clave]] }]]));

  const balonDe = {};
  for (const [balon, jugador] of Object.entries(posesion || {})) if (jugador && !(jugador in balonDe)) balonDe[jugador] = balon;
  const tramos = [];
  const sinBalon = [];
  for (const t of d.tramos) {
    const id = de(t.quien);
    const desde = ultima(ahora[id]);
    const fin = ultima(t.trazo);
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
      if (necesitaBalon(accionDe(t.accion)) && !balonDe[id]) {
        sinBalon.push(`${nombreDe(id)} (${t.accion})`);
        antes[t.quien].push({ x: fin.x, y: fin.y });
        ahora[id].push({ ...desde });
        continue;
      }
      const trazo = t.tipo === 'gesto' ? trasladar(t.trazo, desde) : reanclar(t.trazo, desde, pista);
      antes[t.quien].push({ x: fin.x, y: fin.y });
      ahora[id].push({ x: ultima(trazo).x, y: ultima(trazo).y });
      tramos.push({ ...comun, corre_id: id, receptor_id: null, trazo: copia(trazo), ...(t.companero && de(t.companero) ? { companero_id: de(t.companero) } : {}) });
      continue;
    }
    const balon = balonDe[id];
    if (!balon) { sinBalon.push(`${nombreDe(id)} (${t.accion})`); continue; }
    const receptor = de(t.receptor);
    let trazo;
    if (receptor) {
      /* Donde estaba el receptor en la plantilla cuando le llegaba: el más
         cercano al final del pase de los sitios por los que había pasado
         hasta entonces, y si hay empate, el último. Aquí, el mismo. */
      const sitios = antes[t.receptor];
      let mejor = 0;
      let dMejor = Infinity;
      sitios.forEach((p, i) => {
        const dist = metrosEntre(pista, p, fin);
        if (dist <= dMejor + 1e-9) { mejor = i; dMejor = Math.min(dist, dMejor); }
      });
      trazo = nuevoTrazo(desde, ahora[receptor][Math.min(mejor, ahora[receptor].length - 1)]);
    } else {
      trazo = reanclar(t.trazo, desde, pista);
    }
    tramos.push({ ...comun, corre_id: balon, receptor_id: receptor || null, trazo: copia(trazo), ...(t.desenlace ? { desenlace: t.desenlace } : {}) });
    delete balonDe[id];
    if (receptor) balonDe[receptor] = balon;
  }
  const avisos = [];
  if (sinBalon.length) avisos.push(`No lleva balón para lo suyo: ${sinBalon.join(', ')}. Eso no se ha puesto.`);
  if (descartados) avisos.push(`${descartados === 1 ? 'Una parte' : `${descartados} partes`} de la plantilla no se ${descartados === 1 ? 'entendía' : 'entendían'}. Eso no se ha puesto.`);
  return { tramos, avisos };
}
