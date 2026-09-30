/* ============================================================
   pizarra/variantes.js — las variantes técnicas y sus vídeos (§4.3,
   §10).

   Módulo PURO: sin DOM, sin red. Lo prueba en Node
   taller/tools/eval-variantes.mjs.

   ── EL VÍDEO CUELGA DE LA VARIANTE (§10.1) ───────────────────
   «Pase picado» se enseña igual en todos los ejercicios que lo usan: se
   pone una vez y sale en todos. Vive en la misma tabla que los vídeos de
   las acciones (videos_accion, migración 021), por slug, y la variante
   se escribe con dos guiones bajos detrás de su acción: `pasa__picado`.
   Así no hace falta otra tabla, y el slug sigue cumpliendo la regla de
   la 021 (minúsculas, cifras y guiones bajos; 40 como mucho).

   Una fase enseña, por orden: el vídeo de la variante elegida; si no se
   eligió ninguna, el de la variante de siempre (la primera); y si
   tampoco, el de la acción, que es lo que había antes de las variantes.

   ── LAS VARIANTES DEL CLUB (§4.3) ─────────────────────────────
   El entrenador las va añadiendo poco a poco (lo decidió él,
   2026-09-30): nombre, descripción y vídeo, y las ve todo el club
   (tabla `variantes`, migración 044). Solo para las acciones que ya
   tienen variantes de serie: son las que abren el anillo exterior.
   ============================================================ */

import { VARIANTES, variantesDe, varianteDe, variantePorDefecto } from './repertorio.js';
import { CATALOGO_SISTEMA } from '../ia/acciones.js';
import { leerVideo, normalizarVideo, validarVideo, segundosDe, seIncrusta } from '../ia/video.js';

/** Las acciones a las que el club puede añadir variantes. */
export const ACCIONES_CON_VARIANTES = Object.keys(VARIANTES);

/** El slug de una variante del club, como mucho: con su acción delante
 *  tiene que caber en los 40 del slug de un vídeo. */
export const MAX_SLUG_VARIANTE = 24;

/** El nombre de una variante del club, como mucho. */
export const MAX_NOMBRE_VARIANTE = 40;

const SLUG_VIDEO = /^[a-z][a-z0-9_]{1,39}$/;
const SLUG_VARIANTE = new RegExp(`^[a-z][a-z0-9_]{0,${MAX_SLUG_VARIANTE - 1}}$`);
const nombreAccion = new Map(CATALOGO_SISTEMA.map((a) => [a.slug, a.nombre]));

/**
 * El slug con el que se guarda el vídeo: el de la acción, o
 * `accion__variante`. null si no cabría en la tabla.
 */
export function claveDeVideo(accion, variante = null) {
  if (!accion) return null;
  const k = variante ? `${accion}__${variante}` : String(accion);
  return SLUG_VIDEO.test(k) ? k : null;
}

/** Un slug para una variante nueva a partir de su nombre, que no esté
 *  ya en esa acción («Por detrás» → `por_detras`). */
export function slugDeVariante(nombre, accion) {
  let base = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) return null;
  if (!/^[a-z]/.test(base)) base = `v_${base}`;
  const corta = (s, n) => s.slice(0, n).replace(/_+$/, '');
  base = corta(base, MAX_SLUG_VARIANTE);
  const usados = new Set(variantesDe(accion).map((v) => v.slug));
  let s = base;
  for (let n = 2; usados.has(s); n++) s = `${corta(base, MAX_SLUG_VARIANTE - String(n).length - 1)}_${n}`;
  return s;
}

/**
 * Una fila de la tabla `variantes`, lista para usar, o null si no vale:
 * de una acción sin variantes, con un slug roto o que pisa uno de serie.
 */
export function normalizarVarianteDelClub(fila) {
  if (!fila || typeof fila !== 'object') return null;
  const accion = String(fila.accion || '');
  const slug = String(fila.slug || '');
  const nombre = String(fila.nombre || '').trim();
  if (!VARIANTES[accion] || !SLUG_VARIANTE.test(slug) || !nombre) return null;
  if (VARIANTES[accion].some((v) => v.slug === slug)) return null;
  return { id: fila.id ?? null, accion, slug, nombre, descripcion: String(fila.descripcion || '').trim() };
}

/**
 * EL VÍDEO QUE SE ESCRIBE: el enlace pegado y, si se quiere, desde y
 * hasta (7, 1:07, 1m7s). Lo escrito en las casillas manda sobre lo que
 * traiga el enlace.
 *
 * @returns { video, error } — video null y error null si no hay nada
 */
export function videoDeLoEscrito({ enlace = '', desde = '', hasta = '' } = {}) {
  const t = String(enlace || '').trim();
  if (!t) return { video: null, error: null };
  const v = leerVideo(t);
  if (!v) return { video: null, error: 'no se reconoce el enlace: tiene que ser de YouTube o de TikTok' };
  if (v.tipo !== 'youtube') return { video: v, error: null };
  const escrito = (x) => String(x ?? '').trim();
  const d = escrito(desde) ? segundosDe(desde) : v.desde;
  const h = escrito(hasta) ? segundosDe(hasta) : v.hasta;
  if (escrito(desde) && d == null) return { video: null, error: 'no se entiende el segundo de inicio (7, 1:07…)' };
  if (escrito(hasta) && h == null) return { video: null, error: 'no se entiende el segundo del final (7, 1:07…)' };
  const r = { tipo: 'youtube', id: v.id, desde: d, hasta: h };
  const { ok, errores } = validarVideo(r);
  if (!ok) return { video: null, error: errores[0] };
  return { video: normalizarVideo(r), error: null };
}

/**
 * UNA VARIANTE NUEVA, comprobada antes de mandarla.
 *
 * @returns { ok, errores, variante: { accion, slug, nombre, descripcion }, video }
 */
export function validarVarianteNueva({ accion, nombre = '', descripcion = '', enlace = '', desde = '', hasta = '' } = {}) {
  const errores = [];
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (!VARIANTES[accion]) errores.push('esa acción no tiene variantes');
  if (!n) errores.push('la variante necesita un nombre');
  else if (n.length > MAX_NOMBRE_VARIANTE) errores.push(`el nombre es demasiado largo (${MAX_NOMBRE_VARIANTE} letras como mucho)`);
  else if (VARIANTES[accion] && variantesDe(accion).some((v) => v.nombre.toLocaleLowerCase('es') === n.toLocaleLowerCase('es'))) {
    errores.push(`«${n}» ya está`);
  }
  const { video, error } = videoDeLoEscrito({ enlace, desde, hasta });
  if (error) errores.push(error);
  const slug = errores.length ? null : slugDeVariante(n, accion);
  if (!errores.length && !slug) errores.push('el nombre necesita alguna letra');
  return {
    ok: !errores.length,
    errores,
    variante: errores.length ? null : { accion, slug, nombre: n, descripcion: String(descripcion || '').trim() },
    video,
  };
}

/** «Pasa · Picado»: cómo se titula el vídeo de una variante. */
export function tituloDeVariante(accion, variante, nombre = null) {
  const a = nombreAccion.get(accion) || accion;
  const v = nombre || varianteDe(accion, variante)?.nombre || variante;
  return v ? `${a} · ${v}` : a;
}

/**
 * TODOS LOS VÍDEOS DE UNA ANIMACIÓN, sin repetir, para los botones de la
 * cabecera del proyector: los de sus variantes, los de la variante de
 * siempre de sus acciones y los de las acciones, también los TikTok (que
 * se abren aparte).
 */
export function videosDeAnimacion(animacion, { videos = {}, catalogo = [] } = {}) {
  const tabla = videos && typeof videos === 'object' ? videos : {};
  const porSlug = new Map((Array.isArray(catalogo) ? catalogo : []).filter((a) => a && a.slug).map((a) => [a.slug, a]));
  const fases = [...((animacion && animacion.fases) || []), ...((animacion && animacion.fases_rama) || [])];
  const salida = new Map();
  const poner = (clave, v, titulo) => {
    const n = normalizarVideo(v);
    if (clave && n && !salida.has(clave)) salida.set(clave, { clave, video: n, titulo });
  };
  for (const f of fases) {
    const conVariante = new Set();
    for (const x of (f && Array.isArray(f.variantes) ? f.variantes : [])) {
      if (!x || !x.accion) continue;
      conVariante.add(x.accion);
      const k = claveDeVideo(x.accion, x.variante);
      poner(k, tabla[k], tituloDeVariante(x.accion, x.variante, x.nombre));
    }
    for (const slug of (f && Array.isArray(f.acciones) ? f.acciones : [])) {
      const def = conVariante.has(slug) ? null : variantePorDefecto(slug);
      const k = def && claveDeVideo(slug, def.slug);
      if (k) poner(k, tabla[k], tituloDeVariante(slug, def.slug));
      poner(slug, tabla[slug] || (porSlug.get(slug) || {}).video, (porSlug.get(slug) || {}).nombre || nombreAccion.get(slug) || slug);
    }
  }
  return [...salida.values()];
}

/**
 * EL VÍDEO DE UNA FASE para la columna del proyector (§10.2): el de la
 * primera variante que lo tenga; si no, el de la variante de siempre de
 * sus acciones; y si no, el de la acción. Solo los que se incrustan: un
 * TikTok no se puede repetir en una columna.
 *
 * @param fase     una fase compilada ({ acciones, variantes })
 * @param videos   { slug: vídeo } de la tabla videos_accion
 * @param catalogo las acciones con su vídeo (ia/acciones.js#conVideos)
 * @returns { clave, video, titulo } o null
 */
export function videoDeFase(fase, { videos = {}, catalogo = [] } = {}) {
  if (!fase) return null;
  const tabla = videos && typeof videos === 'object' ? videos : {};
  const vale = (v) => { const n = normalizarVideo(v); return n && seIncrusta(n) ? n : null; };
  const conVariante = new Set();
  for (const x of Array.isArray(fase.variantes) ? fase.variantes : []) {
    if (!x || !x.accion) continue;
    conVariante.add(x.accion);
    const k = claveDeVideo(x.accion, x.variante);
    const v = k && vale(tabla[k]);
    if (v) return { clave: k, video: v, titulo: tituloDeVariante(x.accion, x.variante, x.nombre) };
  }
  const acciones = Array.isArray(fase.acciones) ? fase.acciones : [];
  for (const slug of acciones) {
    if (conVariante.has(slug)) continue;
    const def = variantePorDefecto(slug);
    const k = def && claveDeVideo(slug, def.slug);
    const v = k && vale(tabla[k]);
    if (v) return { clave: k, video: v, titulo: tituloDeVariante(slug, def.slug) };
  }
  const porSlug = new Map((Array.isArray(catalogo) ? catalogo : []).filter((a) => a && a.slug).map((a) => [a.slug, a]));
  for (const slug of acciones) {
    const v = vale(tabla[slug]) || vale(porSlug.get(slug)?.video);
    if (v) return { clave: slug, video: v, titulo: porSlug.get(slug)?.nombre || nombreAccion.get(slug) || slug };
  }
  return null;
}
