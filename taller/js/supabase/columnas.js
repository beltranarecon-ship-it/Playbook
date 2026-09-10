/* ============================================================
   supabase/columnas.js — guardar aunque falte una columna nueva.

   Módulo PURO: no habla con la red, recibe la función que lo hace. Lo
   prueba en Node taller/tools/eval-guardar-columnas.mjs.

   ── EL PROBLEMA ─────────────────────────────────────────────
   Las migraciones de Supabase se aplican A MANO en el editor SQL, así
   que la app puede ir por delante de la base de datos. Si la app manda
   una columna que la base todavía no tiene, PostgREST rechaza el insert
   ENTERO, y quien acaba de dibujar un ejercicio lo pierde.

   Pasó con `marco` (038) y va a pasar con `jugada` (043). Es
   preferible guardar sin la columna que falta —y que se vea bien igual—
   a perder el trabajo.

   ── POR QUÉ UN BUCLE Y NO UN REINTENTO ──────────────────────
   Si faltan las DOS columnas, PostgREST solo nombra una en cada error.
   Con un solo reintento, el segundo fallo se tragaba el ejercicio. Se
   reintenta tantas veces como columnas nuevas hay, y ni una más: una
   columna que ya no está en la fila no se puede quitar dos veces, así
   que el bucle no puede no terminar.
   ============================================================ */

/** Las columnas que la app puede mandar antes de que existan. */
export const COLUMNAS_NUEVAS = ['marco', 'jugada'];

/**
 * Si el error dice que falta una de las columnas nuevas y la fila la
 * lleva, devuelve la fila sin ella. Si no, `null`: el error es otro y
 * no se arregla quitando nada.
 */
export function sinColumnaQueFalta(error, fila, columnas = COLUMNAS_NUEVAS) {
  const msg = (error && error.message) || '';
  if (!msg || !fila || typeof fila !== 'object') return null;
  /* Con la palabra entera: un error que hable de «marcos» no es la
     columna `marco`. */
  const falta = columnas.find((c) => c in fila && new RegExp(`\\b${c}\\b`).test(msg));
  if (!falta) return null;
  const { [falta]: _quitada, ...resto } = fila;
  return { fila: resto, quitada: falta };
}

/**
 * Intenta `hacer(fila)` y, mientras falle porque falta una columna
 * nueva, lo repite sin ella.
 *
 * @param hacer  (fila) => Promise<{ data, error }> — el insert o el
 *               update de Supabase
 * @returns { data, error, quitadas } — `quitadas` dice qué columnas no
 *          se han podido guardar, para poder avisar
 */
export async function guardarSinLasQueFalten(hacer, fila, columnas = COLUMNAS_NUEVAS) {
  let actual = fila;
  const quitadas = [];
  let r = await hacer(actual);
  for (let i = 0; i < columnas.length && r && r.error; i++) {
    const sin = sinColumnaQueFalta(r.error, actual, columnas);
    if (!sin) break;
    actual = sin.fila;
    quitadas.push(sin.quitada);
    r = await hacer(actual);
  }
  return { ...(r || {}), quitadas };
}
