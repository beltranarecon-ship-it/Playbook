/* ============================================================
   duracion.js — LO QUE DE VERDAD DURA UN EJERCICIO (Tramo 3.6).
   Módulo PURO: sin DOM, sin red. Vive aquí, en el Taller, porque lo
   usan las DOS aplicaciones —la biblioteca lo enseña en la tarjeta y
   el planificador lo propone al meter el ejercicio en un plan—, y el
   Taller es el sitio que las dos importan (como `ficha.js`).

   ── QUÉ RESUELVE ────────────────────────────────────────────
   La ficha de un ejercicio dice «10 minutos» porque alguien lo estimó
   al escribirla. Después se da en el pabellón y dura catorce. Y la
   siguiente vez vuelve a proponerse diez, y vuelve a durar catorce, y
   el plan de 90 minutos vuelve a irse a 100.

   Desde el Tramo 3.5, dar un bloque por finalizado guarda lo que DE
   VERDAD duró. Aquí eso se convierte en la duración que se propone la
   próxima vez.

   ── POR QUÉ LA MEDIANA Y NO LA MEDIA ────────────────────────
   Porque un día un bloque duró cuarenta minutos —se hizo daño un
   crío, entró el conserje, se lió el 3c3— y ese día no dice nada de
   cuánto dura el ejercicio. La media se lo traga entero y arrastra la
   propuesta; la mediana lo ignora. Con dos valores la mediana es su
   punto medio, que es lo razonable cuando aún no hay historia.

   ── Y POR QUÉ SOLO LAS ÚLTIMAS ──────────────────────────────
   Un ejercicio que hace un año duraba veinte minutos con el infantil
   y ahora dura doce con el cadete no tiene una duración: tiene dos, y
   la que importa es la de ahora.
   ============================================================ */

/** Con una vez ya se propone: «la segunda vez que se usa» (fila 3.6). */
export const MINIMO_VECES = 1;

/** Cuántas se miran. Más allá, es historia de otro equipo o de otro año. */
export const ULTIMAS = 5;

/*
   Menos de un minuto no es la duración de un bloque: `duracion_real_min`
   se guarda en minutos enteros y `minutosReales()` (3.5) nunca devuelve
   menos de uno. Lo que llegue por debajo es ruido, no un dato corto.
*/
const creible = (n) => Number.isFinite(n) && n >= 1;

/** La mediana de una lista de números. null si no hay ninguno. */
export function mediana(nums) {
  const xs = (nums || []).map(Number).filter(creible).sort((a, b) => a - b);
  if (!xs.length) return null;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

/**
 * La duración que hay que proponer para un ejercicio.
 *
 * @param reales  minutos reales, DEL MÁS RECIENTE AL MÁS ANTIGUO
 * @param deFicha lo que dice la ficha (`duration_min`)
 * @returns {minutos, veces, origen: 'real'|'ficha'}
 *   `origen` no es un detalle: es lo que deja a la pantalla decir de
 *   dónde sale el número en vez de soltarlo sin más.
 */
export function duracionPropuesta(reales, deFicha = null) {
  const ultimas = (Array.isArray(reales) ? reales : [])
    .map(Number).filter(creible)
    .slice(0, ULTIMAS);

  const ficha = Number(deFicha);
  const porFicha = Number.isFinite(ficha) && ficha > 0 ? Math.round(ficha) : null;

  if (ultimas.length < MINIMO_VECES) {
    return { minutos: porFicha, veces: 0, origen: 'ficha' };
  }
  const m = Math.max(1, Math.round(mediana(ultimas)));
  return { minutos: m, veces: ultimas.length, origen: 'real' };
}

/**
 * De dónde sale el número, en castellano. Se enseña al lado de la
 * duración porque «12 min» y «12 min porque las tres veces que lo has
 * dado ha durado eso» no son la misma información.
 */
export function textoDuracion({ minutos, veces, origen }) {
  if (minutos == null) return 'sin duración';
  if (origen !== 'real') return `${minutos} min de la ficha`;
  return veces === 1
    ? `${minutos} min · lo que duró la última vez`
    : `${minutos} min · lo que dura tus últimas ${veces} veces`;
}

/**
 * Agrupa filas de bloques ya dados en { exercise_id: [minutos…] }, del
 * más reciente al más antiguo.
 *
 * Se hace aquí y no en la consulta porque es la misma cuenta para las
 * dos aplicaciones, y porque así se puede probar sin base de datos.
 *
 * @param filas [{exercise_id, duracion_real_min, fecha?}]
 */
export function agruparReales(filas) {
  const out = {};
  const orden = (Array.isArray(filas) ? filas : [])
    .filter((f) => f?.exercise_id && Number(f.duracion_real_min) > 0)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  for (const f of orden) {
    (out[f.exercise_id] ||= []).push(Math.round(Number(f.duracion_real_min)));
  }
  return out;
}
