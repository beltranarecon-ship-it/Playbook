/* ============================================================
   convocatoria.js — LA CONVOCATORIA DEL PARTIDO (Tramo 4.6).
   Módulo PURO: sin DOM, sin red. Lo que decide a quién se puede
   convocar, qué falta y cómo se lee el documento.

   ── EL EVENTO SE DEDUCE, NO SE GUARDA ───────────────────────
   «Se crea sola como evento del calendario al añadir el partido»
   (§5.9). Se deduce del partido y del día de convocatoria del equipo,
   igual que el estado «activa» de una sesión se deduce del reloj
   (§5.6). Guardar un evento aparte obligaría a mantenerlo al día cada
   vez que se mueve un partido, y a la primera que se olvide el
   calendario enseña una convocatoria para un partido que ya no existe.

   ── LO QUE FALTA SE DICE, NO SE INVENTA ─────────────────────
   Una convocatoria a medias es normal el miércoles. Lo que no puede
   pasar es que salga un PDF con la mitad de los campos en blanco sin
   que nadie lo haya visto: por eso `loQueFalta` va delante del botón.
   ============================================================ */

/** Cuántos caben en un acta. Más que eso no se puede convocar. */
export const CONVOCADOS_MAX = 12;

const dosDigitos = (x) => String(x).padStart(2, '0');

/** La lista de convocados de un partido, limpia y sin repetidos. */
export function convocadosDe(partido) {
  const vistos = new Set();
  const out = [];
  for (const id of Array.isArray(partido?.convocados) ? partido.convocados : []) {
    const k = String(id || '').trim();
    if (k && !vistos.has(k)) { vistos.add(k); out.push(k); }
  }
  return out;
}

/** ¿Está convocado? */
export const estaConvocado = (partido, playerId) => convocadosDe(partido).includes(String(playerId));

/**
 * Marca o desmarca a un jugador. Devuelve la lista NUEVA.
 *
 * Al llegar al tope no se desmarca a nadie por su cuenta: se devuelve
 * la lista igual y quien llama decide qué decir. Quitar a un crío para
 * meter a otro es una decisión del entrenador, no de la app.
 */
export function alternar(partido, playerId, { max = CONVOCADOS_MAX } = {}) {
  const lista = convocadosDe(partido);
  const k = String(playerId);
  if (lista.includes(k)) return lista.filter((x) => x !== k);
  if (lista.length >= max) return lista;
  return [...lista, k];
}

/**
 * Los jugadores que se pueden convocar, en el orden del acta.
 *
 * Solo los activos: a un crío dado de baja no se le convoca, y que
 * aparezca en la lista es la manera de convocarlo por error.
 */
export const convocables = (jugadores) => (jugadores || []).filter((j) => j.estado !== 'baja');

/* ── El día de la convocatoria ─────────────────────────────── */

/**
 * Qué día toca mandar la convocatoria de este partido.
 *
 * El día de la semana lo fija el equipo en ajustes (`dia_convocatoria`,
 * 1 = lunes). Se busca hacia atrás desde el día del partido: la
 * convocatoria del sábado con día 5 (viernes) sale el viernes de la
 * misma semana, y con día 3 (miércoles), el miércoles anterior.
 *
 * @returns 'YYYY-MM-DD' o null si el equipo no ha fijado día
 */
export function diaDeConvocatoria(partido, { diaSemana } = {}) {
  const dia = Number(diaSemana);
  if (!partido?.fecha || !Number.isFinite(dia) || dia < 1 || dia > 7) return null;
  const d = new Date(`${partido.fecha}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // getUTCDay: 0 = domingo. En el resto de la app 1 = lunes … 7 = domingo.
  const suyo = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  let atras = suyo - dia;
  if (atras <= 0) atras += 7;         // el mismo día del partido no vale: se avisa antes
  d.setUTCDate(d.getUTCDate() - atras);
  return `${d.getUTCFullYear()}-${dosDigitos(d.getUTCMonth() + 1)}-${dosDigitos(d.getUTCDate())}`;
}

/**
 * El evento de convocatoria de un partido, para el calendario.
 * Se DEDUCE: no hay tabla que mantener al día.
 *
 * @returns {fecha, partido, cerrada, cuantos} o null si no toca
 */
export function eventoDe(partido, { diaSemana } = {}) {
  if (!partido || partido.estado === 'cancelado') return null;
  const fecha = diaDeConvocatoria(partido, { diaSemana });
  if (!fecha) return null;
  return {
    fecha,
    partido,
    cerrada: !!partido.convocatoria_cerrada,
    cuantos: convocadosDe(partido).length,
  };
}

/* ── Lo que falta ──────────────────────────────────────────── */

/**
 * Qué le falta a la convocatoria para poder mandarla.
 *
 * No es un error: el miércoles está a medias y no pasa nada. Es la
 * lista que va delante del botón, para que nadie saque un documento
 * con la mitad de los campos en blanco sin haberlo visto.
 */
export function loQueFalta(partido, { minimo = 5 } = {}) {
  const falta = [];
  const n = convocadosDe(partido).length;
  if (!n) falta.push('a quién se convoca');
  else if (n < minimo) falta.push(`gente: hay ${n} y en pista se juega con ${minimo}`);
  if (!partido?.convocatoria_lugar?.trim()) falta.push('dónde se queda');
  if (!partido?.convocatoria_hora) falta.push('a qué hora se queda');
  return falta;
}

/** ¿Se puede sacar ya el documento? */
export const sePuedeSacar = (partido) => convocadosDe(partido).length > 0;

/* ── Cómo se lee ───────────────────────────────────────────── */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** «sábado 22 de agosto» */
export function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const dia = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return `${DIAS[dia - 1]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** «11:00» — sin los segundos que trae Postgres. */
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

/**
 * Los datos que van en el documento, ya resueltos.
 *
 * Se arma aquí, en un módulo puro, para que la vista imprimible y el
 * banco de pruebas lean exactamente lo mismo.
 */
export function datosDelDocumento(partido, jugadores, { nombreEquipo = '', escudo = null } = {}) {
  const ids = convocadosDe(partido);
  const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
  return {
    equipo: nombreEquipo,
    escudo,
    rival: partido?.rival || '',
    donde: partido?.es_local ? 'en casa' : 'fuera',
    fecha: fechaLarga(partido?.fecha),
    hora: hhmm(partido?.hora),
    lugarPartido: partido?.lugar || '',
    quedada: {
      lugar: partido?.convocatoria_lugar || '',
      hora: hhmm(partido?.convocatoria_hora),
    },
    // en el orden en que se marcaron, no alfabético: es el que ha
    // pensado el entrenador
    convocados: ids.map((id) => porId.get(id)).filter(Boolean)
      .map((j) => ({ nombre: j.nombre, dorsal: j.dorsal ?? null })),
    faltan: ids.filter((id) => !porId.has(id)).length,
  };
}

/** «vs CB Rival · sábado 22 de agosto · 11:00» */
export function titular(d) {
  return [
    d.rival ? `${d.donde === 'en casa' ? 'vs' : '@'} ${d.rival}` : null,
    d.fecha, d.hora,
  ].filter(Boolean).join(' · ');
}
