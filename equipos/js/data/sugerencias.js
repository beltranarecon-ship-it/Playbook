/* ============================================================
   sugerencias.js — motor PURO y determinista de sugerencia de
   ejercicios y de herencia viva de objetivos (módulo Sesiones · M3).
   Sin DOM, sin Supabase: lo importan las vistas y el banco Node
   (equipos/tools/eval-sugerencias.mjs).

   Contrato (CONTRACT.md):
   · objectives.categoria ∈ {'técnico','táctico','físico'} casa con
     exercises.type (que además tiene 'juego').
   · Determinista: mismo objetivo + misma biblioteca → mismo orden.
     Nada de aleatoriedad ni de IA en v1 (coste cero).
   ============================================================ */

/** Palabras vacías del español que no aportan señal de búsqueda. */
export const STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas',
  'en', 'con', 'sin', 'por', 'para', 'que', 'como', 'mas', 'más',
  'al', 'a', 'y', 'o', 'u', 'e', 'se', 'su', 'sus', 'lo', 'nos',
  'mejorar', 'trabajar', 'trabajo', 'sobre', 'desde', 'hasta',
]);

/** minúsculas + sin tildes/diacríticos ('Técnico' → 'tecnico'). */
export function normaliza(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Tokens útiles de un texto: normalizados, sin stopwords, de 3+ letras
 * (o con dígito: '1c1', '2c2' y compañía siempre cuentan).
 */
export function tokeniza(txt) {
  const out = [];
  for (const t of normaliza(txt).split(/[^a-z0-9]+/)) {
    if (!t || STOPWORDS.has(t)) continue;
    if (t.length < 3 && !/\d/.test(t)) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * Puntúa y ordena la biblioteca contra un objetivo. Determinista.
 * Puntos por token: tag exacto/contenido +3 · nombre +2 · type/category
 * del ejercicio +2 · descripción +1. Si el type del ejercicio ES la
 * categoría del objetivo (comparación normalizada) suma +2 de base.
 * Con score < 2 no se sugiere.
 * OJO: exercises.type es texto LIBRE desde 002 ('Tiro', '1vs1'…) — por
 * eso se trata como señal de texto normalizada, nunca como enum.
 * @param objetivo   {titulo, descripcion, categoria}
 * @param ejercicios [{id, name, type, category, description, tags, is_archived, …}]
 * @returns top `limite` como [{ejercicio, score}]
 */
export function sugerirEjercicios(objetivo, ejercicios, { limite = 6 } = {}) {
  const tokens = tokeniza(`${objetivo.titulo || ''} ${objetivo.descripcion || ''}`);
  const catObjetivo = normaliza(objetivo.categoria);
  const puntuados = [];

  for (const ej of ejercicios || []) {
    if (!ej || ej.is_archived) continue;
    const nombre = normaliza(ej.name);
    const desc = normaliza(ej.description);
    const tipo = normaliza(ej.type);
    const cat = normaliza(ej.category);
    const tags = (ej.tags || []).map(normaliza);
    let score = catObjetivo && tipo === catObjetivo ? 2 : 0;
    for (const t of tokens) {
      if (tags.some((tag) => tag === t || tag.includes(t))) score += 3;
      if (nombre.includes(t)) score += 2;
      if (tipo && tipo.includes(t)) score += 2;
      if (cat && cat.includes(t)) score += 2;
      if (desc.includes(t)) score += 1;
    }
    if (score >= 2) puntuados.push({ ejercicio: ej, score, _nombre: nombre });
  }

  puntuados.sort((a, b) =>
    b.score - a.score
    || (a._nombre < b._nombre ? -1 : a._nombre > b._nombre ? 1 : 0)
    || (a.ejercicio.id < b.ejercicio.id ? -1 : 1));

  return puntuados.slice(0, limite).map(({ ejercicio, score }) => ({ ejercicio, score }));
}

/**
 * Herencia VIVA: objetivos que cubren una fecha (bordes inclusivos).
 * Los archivados quedan fuera (el coach los descartó); los conseguidos
 * siguen contando: son un hecho del periodo.
 */
export function objetivosEnFecha(fecha, objetivos) {
  return (objetivos || []).filter((o) =>
    o && o.estado !== 'archivado'
    && o.fecha_inicio <= fecha && fecha <= o.fecha_fin);
}

/**
 * Título heredado de una sesión: su `titulo` si lo tiene; si no, los
 * títulos de los objetivos de SU equipo que cubren su fecha.
 */
export function tituloHeredado(sesion, objetivos) {
  if (sesion.titulo) return sesion.titulo;
  return objetivosEnFecha(sesion.fecha, objetivos)
    .filter((o) => o.team_id === sesion.team_id)
    .map((o) => o.titulo)
    .join(' · ') || null;
}
