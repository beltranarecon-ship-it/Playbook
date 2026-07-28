/* ============================================================
   ia/posiciones.js — diccionario de posiciones con nombre (Tramo 2.2).

   resolverPosicion(pista, nombre, canasta, custom) → [x,y] | null.
   Normaliza el nombre (minúsculas, sin tildes, sin artículos,
   sinónimos, lateralidad) y lo resuelve PRIMERO contra el
   diccionario custom del entrenador (Supabase, por pista — llega ya
   cargado como objeto plano { slug: [x,y] }) y después contra las
   ANCLAS medidas (canvas/anclas.js). null = nombre desconocido: el
   llamador decide si pregunta (validador → pregunta tipo A, §2.3).

   PURO a propósito: sin red, sin DOM, sin supabase — el banco Node
   (eval-animacion.mjs) lo importa tal cual; la persistencia vive en
   supabase/posiciones.js y se INYECTA vía el parámetro `custom`.
   ============================================================ */

import { posicionesDe } from '../canvas/anclas.js';

/* ---- normalización --------------------------------------------------
   "Al Poste Bajo Izquierdo" → tokens ['poste','bajo'] + lado 'izq' +
   slug 'poste_bajo_izq'. El slug identifica la posición de cara al
   diccionario custom y a los ids de pregunta (q_pos_<slug>). */

// artículos/preposiciones que no aportan significado posicional
const RELLENO = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'a', 'en']);

// tokens de lateralidad → clave interna. En las medias (paisaje, aro a
// la izquierda) izq/der de los nombres = arriba/abajo en pantalla; las
// coords de ANCLAS ya lo llevan resuelto, aquí solo se detecta el token.
const LADOS = new Map([
  ['izquierda', 'izq'], ['izquierdo', 'izq'], ['izq', 'izq'], ['left', 'izq'],
  ['derecha', 'der'], ['derecho', 'der'], ['der', 'der'], ['right', 'der'],
]);

// sinónimos: frase normalizada (tokens sin lado, unidos por espacio) →
// clave base de ANCLAS. Las bases con variante _izq/_der se marcan en
// LATERALES; el resto (base, tiro_libre, centro, aro) son únicas.
const SINONIMOS = new Map([
  ['base', 'base'], ['punta', 'base'], ['top', 'base'], ['point', 'base'],
  ['escolta', 'escolta'], ['45', 'escolta'], ['guard', 'escolta'],
  ['alero', 'alero'], ['ala', 'alero'], ['wing', 'alero'],
  ['esquina', 'esquina'], ['corner', 'esquina'],
  ['codo', 'codo'], ['elbow', 'codo'],
  ['poste bajo', 'poste_bajo'], ['low post', 'poste_bajo'], ['poste', 'poste_bajo'], ['post', 'poste_bajo'],
  ['poste alto', 'poste_alto'], ['high post', 'poste_alto'],
  ['tiro libre', 'tiro_libre'], ['tiros libres', 'tiro_libre'], ['linea tiro libre', 'tiro_libre'], ['linea tiros libres', 'tiro_libre'], ['free throw', 'tiro_libre'], ['personal', 'tiro_libre'],
  ['centro', 'centro'], ['medio campo', 'centro'], ['mediocampo', 'centro'], ['circulo central', 'centro'],
  ['aro', 'aro'], ['canasta', 'aro'], ['rim', 'aro'],
]);

const LATERALES = new Set(['escolta', 'alero', 'esquina', 'codo', 'poste_bajo', 'poste_alto']);

/**
 * Analiza un nombre libre. Devuelve null si no queda nada tras limpiar.
 * @returns { slug, frase, lado } — slug: identidad estable (custom/ids de
 *          pregunta); frase: tokens sin lado unidos por espacio (lookup
 *          de sinónimos); lado: 'izq'|'der'|null.
 */
export function normalizarPosicion(nombre) {
  const tokens = String(nombre ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin tildes (diacríticos combinantes)
    .replace(/[^a-z0-9ñ]+/g, ' ')                       // separadores/underscores → espacio
    .trim().split(/\s+/)
    .filter((t) => t && !RELLENO.has(t));
  if (!tokens.length) return null;
  let lado = null;
  const resto = tokens.filter((t) => {
    if (LADOS.has(t)) { lado = lado || LADOS.get(t); return false; }
    return true;
  });
  const slug = [...resto, ...(lado ? [lado] : [])].join('_');
  return { slug, frase: resto.join(' '), lado };
}

/** Slug estable de un nombre libre ('' si no hay nada). Para ids de
 *  pregunta (q_pos_<slug>) y claves del diccionario custom. */
export function slugPosicion(nombre) {
  const n = normalizarPosicion(nombre);
  return n ? n.slug : '';
}

/**
 * Resolución con detalle: además de las coords dice DE DÓNDE salió y si
 * el lado se eligió por defecto (nombre lateral sin lado explícito →
 * derecha; eso es una interpretación y el validador la avisa §8.4).
 * @param custom objeto plano { slug: [x,y] } YA de esta pista (la tabla
 *        posiciones_pista guarda cada nombre POR pista; nunca se mezclan).
 * @returns { xy:[x,y], clave, origen:'custom'|'ancla', ladoPorDefecto } | null
 */
export function resolverPosicionDetallada(pista, nombre, canasta = 'norte', custom = null) {
  const n = normalizarPosicion(nombre);
  if (!n) return null;

  // 1) diccionario custom del entrenador: su definición manda sobre la
  //    estándar (puede redefinir incluso un nombre de ANCLAS a su gusto).
  if (custom) {
    const c = custom[n.slug];
    if (Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) {
      return { xy: [Number(c[0]), Number(c[1])], clave: n.slug, origen: 'custom', ladoPorDefecto: false };
    }
  }

  // 2) anclas estándar medidas
  const base = SINONIMOS.get(n.frase);
  if (!base) return null;
  const pos = posicionesDe(pista, canasta);
  if (!pos) return null;
  if (!LATERALES.has(base)) {
    return pos[base] ? { xy: pos[base], clave: base, origen: 'ancla', ladoPorDefecto: false } : null;
  }
  const clave = `${base}_${n.lado || 'der'}`; // sin lado explícito: derecha (documentado; el validador avisa)
  return pos[clave] ? { xy: pos[clave], clave, origen: 'ancla', ladoPorDefecto: !n.lado } : null; // p.ej. poste_alto en medias: no existe → null
}

/** Forma simple: solo las coordenadas. [x,y] | null. */
export function resolverPosicion(pista, nombre, canasta = 'norte', custom = null) {
  const r = resolverPosicionDetallada(pista, nombre, canasta, custom);
  return r ? r.xy : null;
}
