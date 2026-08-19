/* ============================================================
   plan.js — LAS REGLAS DE UN PLAN DE SESIÓN (Tramo 3.2).
   Módulo PURO: sin DOM, sin Supabase. Lo importan el planificador y
   el banco Node (equipos/tools/eval-plan.mjs).

   Aquí vive lo que antes estaba repartido entre la cabeza del
   entrenador y ningún sitio: cuánto tiempo queda de verdad, qué
   material hay que sacar del almacén, y si esto que estás metiendo ya
   lo hiciste el martes.

   ── EL TOPE DE DURACIÓN NO ES UN AVISO ──────────────────────
   Hasta ahora la suma de los bloques podía pasarse de la hora de
   pista y solo salía un aviso en ámbar. Un plan de 110 minutos para
   90 de pista no es un plan: es una lista de la que alguien va a
   tener que tachar algo con los críos ya cambiados. Ahora el hueco
   que queda MANDA: lo que no cabe, no entra, y lo que cabe a medias
   entra recortado y se dice.

   Solo cuando se sabe cuánto dura la pista. Una sesión suelta sin
   horario no tiene tope, y ahí no se inventa ninguno.

   ── EL AGUA ES UN BLOQUE LIBRE QUE SE LLAMA «AGUA» ──────────
   No hace falta una columna nueva ni una migración: el marcador es la
   palabra que el entrenador LEE. Un bloque sin ejercicio titulado
   «Agua» es agua, cuenta sus minutos de pista y NO cuenta como
   minutos activos —beber no es entrenar—, y eso vale también para los
   bloques de agua que ya existieran escritos a mano.

   Nace con intensidad 1 y no 0 porque la columna la exige entre 1 y 5
   (migración 013). La «carga 0» que pide la especificación se cumple
   donde importa: en los minutos activos.
   ============================================================ */

const norm = (s) => String(s ?? '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ── 1. El bloque de agua ──────────────────────────────────── */

export const MINUTOS_AGUA = 3;

/** Un bloque de agua recién hecho. Ajustable como cualquier otro. */
export const bloqueAgua = (duracion_min = MINUTOS_AGUA) => ({
  exercise_id: null, titulo: 'Agua', duracion_min, intensidad: 1, notas: null,
});

/**
 * ¿Este bloque es agua? Un bloque LIBRE (sin ficha) cuyo título
 * empieza por «agua». Generoso a propósito: «Agua y charla» también
 * lo es, porque en los dos casos nadie está entrenando.
 */
export function esAgua(bloque) {
  if (!bloque || bloque.exercise_id) return false;
  return /^agua\b/.test(norm(bloque.titulo));
}

/* ── 1b. El bloque con vídeo (Tramo 3.3) ───────────────────── */

/**
 * Un bloque LIBRE que lleva un vídeo. Un ejercicio de la biblioteca no
 * lo es: los suyos cuelgan de la acción (Tramo 2.14) y salen solos en
 * el proyector.
 */
export const esVideo = (bloque) => !!bloque && !bloque.exercise_id && !!bloque.video;

/** Un bloque listo para meter en el plan a partir de un vídeo guardado. */
export const bloqueDeVideo = (guardado, duracion_min = null) => ({
  exercise_id: null,
  titulo: String(guardado?.titulo || 'Vídeo').trim(),
  duracion_min: Number(duracion_min) || Number(guardado?.duracion_min) || 5,
  intensidad: 1,
  notas: null,
  video: guardado?.video ?? null,
});

/**
 * ¿Este bloque ocupa pista sin que nadie entrene?
 *
 * El agua y un vídeo. Los dos cuentan minutos de pista y cero minutos
 * activos, por la misma razón: nadie está haciendo nada. Con el vídeo
 * no es una suposición —de una charla no se sabe si es charla o juego,
 * de un vídeo sí—, y por eso aquí sí se puede afirmar.
 */
export const noEntrena = (bloque) => esAgua(bloque) || esVideo(bloque);

/* ── 2. El tope de duración ────────────────────────────────── */

/** Suma de minutos de una lista de bloques. */
export const duracionTotal = (bloques) => (bloques || [])
  .reduce((s, b) => s + (Math.max(0, Number(b?.duracion_min) || 0)), 0);

/**
 * Minutos que quedan libres de la hora de pista.
 *
 * @param tope   duración de la sesión en minutos; null = sin horario
 * @param opts.excepto  uid de un bloque que NO cuenta (se está editando)
 * @returns Infinity si no hay tope — «cabe todo» es la verdad, no un
 *   número grande disfrazado.
 */
export function huecoDisponible(bloques, tope, { excepto = null } = {}) {
  const t = Number(tope);
  if (!Number.isFinite(t) || t <= 0) return Infinity;
  const usados = duracionTotal((bloques || []).filter((b) => excepto == null || b?.uid !== excepto));
  return Math.max(0, t - usados);
}

/**
 * Cuántos minutos se le pueden dar de verdad a un bloque.
 *
 * @returns {duracion, recortado} — `recortado` es lo que se ha tenido
 *   que quitar, para poder decirlo en pantalla en vez de cambiar el
 *   número por la espalda.
 */
export function ajustarADisponible(bloques, tope, pedida, { excepto = null } = {}) {
  const hueco = huecoDisponible(bloques, tope, { excepto });
  const p = Math.max(0, Number(pedida) || 0);
  if (!Number.isFinite(hueco)) return { duracion: p, recortado: 0 };
  const duracion = Math.min(p, hueco);
  return { duracion, recortado: p - duracion };
}

/* ── 3. El material que hay que sacar del almacén ───────────── */

/*
   Las fichas declaran QUÉ material hace falta (`requisitos.material`:
   'balones', 'petos', 'conos'…) pero nunca CUÁNTO, porque el cuánto
   depende de la gente que venga. Así que se cuenta lo único que se
   puede contar sin inventar: lo que se usa uno por jugador.

   Un ejercicio SIMULTÁNEO con balones necesita un balón por crío —esa
   es la definición de simultáneo—. Uno por turnos necesita uno por
   estación. Lo demás (conos, petos, aros) se lista sin número: la
   ficha no lo dice y ponerlo a ojo sería peor que no ponerlo.
*/
const POR_JUGADOR = new Set(['balones', 'pelotas de tenis']);

/**
 * El cuadro de material de una sesión.
 * @returns [{nombre, cantidad|null, deQuien:[títulos]}] ordenado
 */
export function materialDeSesion(bloques, { jugadores = null, requisitosDe = null } = {}) {
  const n = Number(jugadores);
  const acc = new Map();   // nombre → { cantidad, deQuien:Set }

  for (const b of bloques || []) {
    const req = typeof requisitosDe === 'function' ? requisitosDe(b) : null;
    const lista = Array.isArray(req?.material) ? req.material : [];
    for (const bruto of lista) {
      const nombre = norm(bruto);
      if (!nombre) continue;
      const fila = acc.get(nombre) || { cantidad: null, deQuien: new Set() };
      fila.deQuien.add(b?.titulo || 'un bloque');
      if (POR_JUGADOR.has(nombre) && Number.isFinite(n) && n > 0) {
        // uno por crío si todos trabajan a la vez; si no, uno por estación
        const cuantos = req?.simultaneo === true ? n : Math.max(1, Number(req?.estaciones) || 1);
        fila.cantidad = Math.max(fila.cantidad || 0, cuantos);
      }
      acc.set(nombre, fila);
    }
  }

  return [...acc.entries()]
    .map(([nombre, v]) => ({ nombre, cantidad: v.cantidad, deQuien: [...v.deQuien] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** «14 balones · petos · 8 conos» — lo que se lee al pie del plan. */
export function textoMaterial(filas) {
  if (!filas?.length) return '';
  return filas.map((f) => (f.cantidad ? `${f.cantidad} ${f.nombre}` : f.nombre)).join(' · ');
}

/* ── 4. Lo repetido ────────────────────────────────────────── */

/**
 * El mismo ejercicio dos veces en la MISMA sesión.
 *
 * No siempre es un error —hay quien vuelve al mismo ejercicio al
 * final para medir— así que se dice y no se impide. Los bloques
 * libres no cuentan: dos charlas no son una repetición.
 */
export function repetidosEnSesion(bloques) {
  const cuenta = new Map();
  for (const b of bloques || []) {
    if (!b?.exercise_id) continue;
    const f = cuenta.get(b.exercise_id) || { exercise_id: b.exercise_id, titulo: b.titulo || 'Ejercicio', veces: 0 };
    f.veces += 1;
    cuenta.set(b.exercise_id, f);
  }
  return [...cuenta.values()].filter((f) => f.veces > 1);
}

const DIA_MS = 86400000;
const aFecha = (iso) => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);

/**
 * «Esto ya lo hiciste el martes».
 *
 * Solo del MISMO equipo y sin bloquear: repetir un ejercicio a los
 * tres días puede ser exactamente lo que se quiere hacer. Lo que no
 * puede pasar es enterarse en la pista.
 *
 * @param bloques           los del plan que se está escribiendo
 * @param opts.sesiones     [{id, fecha, estado}] otras del equipo
 * @param opts.bloquesPorSesion {sessionId: [bloques]}
 * @param opts.fecha        la fecha de ESTA sesión (ISO)
 * @param opts.dias         cuántos días atrás se mira (14 por defecto)
 * @returns [{exercise_id, titulo, fecha, dias}] — la vez más reciente
 */
export function repetidosRecientes(bloques, { sesiones = [], bloquesPorSesion = {}, fecha = null, dias = 14 } = {}) {
  const hoy = aFecha(fecha);
  if (!Number.isFinite(hoy)) return [];

  // ejercicio → la fecha más reciente en la que se usó, dentro de la ventana
  const ultimaVez = new Map();
  for (const s of sesiones) {
    if (!s || s.estado === 'cancelada') continue;
    const f = aFecha(s.fecha);
    // solo hacia atrás: lo que está planificado para el viernes no es
    // «ya lo hiciste», es otro plan que todavía se puede cambiar
    if (!Number.isFinite(f) || f >= hoy || hoy - f > dias * DIA_MS) continue;
    for (const b of bloquesPorSesion[s.id] || []) {
      if (!b?.exercise_id) continue;
      const previa = ultimaVez.get(b.exercise_id);
      if (!previa || f > previa) ultimaVez.set(b.exercise_id, f);
    }
  }

  const out = [], vistos = new Set();
  for (const b of bloques || []) {
    if (!b?.exercise_id || vistos.has(b.exercise_id)) continue;
    const f = ultimaVez.get(b.exercise_id);
    if (f == null) continue;
    vistos.add(b.exercise_id);
    out.push({
      exercise_id: b.exercise_id,
      titulo: b.titulo || 'Ejercicio',
      fecha: new Date(f).toISOString().slice(0, 10),
      dias: Math.round((hoy - f) / DIA_MS),
    });
  }
  return out;
}

/** «hace 3 días» / «ayer» — para no obligar a restar fechas de cabeza. */
export function textoHace(dias) {
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 14) return 'la semana pasada';
  return `hace ${Math.round(dias / 7)} semanas`;
}

/* ── 5. El filtro del picker ───────────────────────────────── */

/**
 * ¿Se puede montar este ejercicio con la gente que hay?
 *
 * Solo mira el MÍNIMO. Pasarse del máximo no impide montarlo —se hace
 * cola, y los minutos activos ya lo cuentan (Tramo 3.1)—, así que
 * esconderlo por eso taparía media biblioteca con catorce críos. No
 * llegar al mínimo sí lo impide: un 5c5 con seis no es un 5c5.
 */
export function cabeEnGrupo(requisitos, jugadores) {
  const n = Number(jugadores);
  if (!Number.isFinite(n) || n <= 0) return true;      // sin dato, no se filtra nada
  const min = Number(requisitos?.jugadores_min);
  if (!Number.isFinite(min) || min <= 0) return true;   // la ficha no lo dice
  return n >= min;
}
