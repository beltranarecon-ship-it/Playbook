/* ============================================================
   borradores.js — LO QUE SE ESTABA ESCRIBIENDO (Tramo 3.13).
   Módulo compartido por las dos aplicaciones. Toca `localStorage` y
   nada más: sin DOM, sin red, y todo lo que decide —si un borrador
   merece ofrecerse, si está viejo, si dice lo mismo que lo guardado—
   es puro y lo prueba un banco Node.

   ── QUÉ RESUELVE ────────────────────────────────────────────
   El Taller ya guardaba el ejercicio a medio hacer y lo ofrecía al
   volver. Fuera de ahí no: cerrar la pestaña con media sesión
   planificada, o con un ejercicio ya creado a medio corregir, perdía
   el trabajo sin avisar. Y no es un caso raro — es un martes con un
   crío llamando a la puerta.

   ── POR QUÉ NO SE RESTAURA SOLO ─────────────────────────────
   Porque un borrador puede ser viejo, puede ser de otro ordenador y
   puede haber quedado atrás respecto a lo que hay guardado. Restaurar
   sin preguntar convierte «recuperé lo que estaba escribiendo» en «me
   ha sobrescrito el plan bueno con uno de hace tres semanas». Se
   OFRECE, con su fecha, y decide quien lo escribió.

   ── Y POR QUÉ SE OFRECE SOLO SI DIFIERE ─────────────────────
   Un borrador idéntico a lo guardado no es una recuperación, es un
   ruido: si cada vez que se abre una sesión salta un cartel, a la
   tercera nadie lo lee. Se compara con lo que se acaba de cargar y
   solo se ofrece si de verdad hay algo distinto.
   ============================================================ */

/** Cuánto vive un borrador. Más allá, lo que hay guardado manda. */
export const DIAS_VIDA = 14;
const DIA = 86400000;

/* Las claves. Se construyen aquí para que nadie las escriba a mano en
   dos sitios y se separen por un guion de diferencia. */
export const claveEjercicio = (id = null) => (id ? `cbp_borrador_ejercicio:${id}` : 'cbp_borrador_ejercicio');
export const claveSesion = (id) => `cbp_borrador_sesion:${id}`;

/* ── Guardar y leer ────────────────────────────────────────── */

export function guardar(clave, datos) {
  try {
    localStorage.setItem(clave, JSON.stringify({ ...datos, fecha: Date.now() }));
    return true;
  } catch {
    // almacenamiento lleno o modo privado: se pierde y no pasa nada
    return false;
  }
}

export function leer(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
}

export function borrar(clave) {
  try { localStorage.removeItem(clave); } catch { /* noop */ }
}

/* ── Decidir si se ofrece ──────────────────────────────────── */

/** ¿Está viejo? Un borrador de hace un mes ya no es «lo que estaba escribiendo». */
export function estaViejo(b, ahora = Date.now()) {
  const f = Number(b?.fecha);
  if (!Number.isFinite(f)) return true;
  return (ahora - f) > DIAS_VIDA * DIA;
}

/**
 * ¿Hay que ofrecer este borrador?
 *
 * @param b        lo guardado en el navegador
 * @param actual   lo que se acaba de cargar de la base de datos
 * @param opts.huella  (x) => string — qué se compara de cada uno. Se
 *   inyecta porque «lo mismo» significa cosas distintas en un plan de
 *   sesión y en un ejercicio, y esa decisión es de quien lo usa.
 * @param opts.tieneAlgo (b) => boolean — si el borrador merece la pena
 */
export function hayQueOfrecer(b, actual, { huella = JSON.stringify, tieneAlgo = () => true, ahora = Date.now() } = {}) {
  if (!b || estaViejo(b, ahora)) return false;
  if (!tieneAlgo(b)) return false;
  try {
    return huella(b) !== huella(actual);
  } catch {
    return true;   // si no se pueden comparar, mejor preguntar que perder
  }
}

/** «12 de marzo, 19:04» — la fecha decide si merece la pena recuperarlo. */
export function fechaDe(b) {
  const f = Number(b?.fecha);
  if (!Number.isFinite(f)) return '';
  try {
    return new Date(f).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

/**
 * Limpia los borradores caducados.
 *
 * Se llama al arrancar: sin esto, cada ejercicio y cada sesión que se
 * hayan tocado alguna vez dejan una entrada para siempre, y el
 * almacenamiento del navegador es pequeño y compartido.
 *
 * @returns cuántos se han quitado
 */
export function limpiarViejos({ prefijos = ['cbp_borrador_'], ahora = Date.now() } = {}) {
  let n = 0;
  try {
    for (const clave of Object.keys(localStorage)) {
      if (!prefijos.some((p) => clave.startsWith(p))) continue;
      if (estaViejo(leer(clave), ahora)) { borrar(clave); n += 1; }
    }
  } catch { /* sin localStorage no hay nada que limpiar */ }
  return n;
}
