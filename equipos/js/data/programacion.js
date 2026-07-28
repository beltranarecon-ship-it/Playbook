/* ============================================================
   programacion.js — motor PURO y determinista de auto-generación
   de sesiones preliminares (módulo Sesiones · M2). Sin DOM, sin
   Supabase: lo importa la capa de datos (schedules.js) y el banco
   Node (equipos/tools/eval-programacion.mjs).

   Contrato (CONTRACT.md):
   · weekday ISO 1-7 (1=lun … 7=dom). Aquí se calcula en UTC sobre
     fechas 'YYYY-MM-DD' → inmune a DST y a la zona del navegador.
   · slot_date = fecha teórica INMUTABLE de la ocurrencia (clave de
     reconciliación). fecha = la pintada (reprogramar la mueve).
   · Los periodos sin entreno SOLO condicionan la auto-generación;
     las sesiones manuales no son asunto de este motor.
   ============================================================ */

/** Días 'YYYY-MM-DD' de un rango inclusivo. Iteración UTC (sin DST). */
export function diasEntre(desdeISO, hastaISO) {
  const out = [];
  if (!desdeISO || !hastaISO) return out;
  let t = Date.parse(desdeISO + 'T00:00:00Z');
  const fin = Date.parse(hastaISO + 'T00:00:00Z');
  if (!Number.isFinite(t) || !Number.isFinite(fin)) return out;
  for (; t <= fin; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Día de la semana ISO 1-7 (1=lun … 7=dom) de una fecha 'YYYY-MM-DD'. */
export function isoWeekday(fechaISO) {
  const dow = new Date(Date.parse(fechaISO + 'T00:00:00Z')).getUTCDay(); // 0=dom..6=sáb
  return dow === 0 ? 7 : dow;
}

/** ¿La fecha cae dentro de algún periodo [fecha_inicio, fecha_fin]? */
export function enPeriodo(fechaISO, periodos) {
  return (periodos || []).some(
    (p) => p && fechaISO >= p.fecha_inicio && fechaISO <= p.fecha_fin
  );
}

/** Minutos entre dos horas 'HH:MM[:SS]' (para slot_duracion_min). */
export function duracionMin(horaInicio, horaFin) {
  if (!horaInicio || !horaFin) return null;
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  if (![h1, m1, h2, m2].every(Number.isFinite)) return null;
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

// ── Temporada: dónde cae "hoy" y cuál tocaría crear ───────────
// La auto-generación SOLO puebla el rango de la temporada activa. Si esa
// temporada ya terminó, generar produce 86 sesiones en el pasado y un
// calendario vacío donde el entrenador está mirando. Estas tres funciones
// existen para que la app pueda DECIRLO en vez de callarse.

/** ¿La fecha cae dentro de la temporada (bordes inclusivos)? */
export function temporadaCubre(temporada, fechaISO) {
  if (!temporada?.start_date || !temporada?.end_date || !fechaISO) return false;
  return fechaISO >= temporada.start_date && fechaISO <= temporada.end_date;
}

/** 'vigente' | 'terminada' | 'futura' | 'sin-fechas' respecto a `hoyISO`. */
export function estadoTemporada(temporada, hoyISO) {
  if (!temporada?.start_date || !temporada?.end_date) return 'sin-fechas';
  if (hoyISO < temporada.start_date) return 'futura';
  if (hoyISO > temporada.end_date) return 'terminada';
  return 'vigente';
}

/**
 * La temporada que le tocaría a `hoyISO` en el calendario deportivo español:
 * arranca el 1 de septiembre y acaba el 30 de junio. De julio en adelante ya
 * se prepara la siguiente; hasta junio, se sigue en la que empezó el año pasado.
 * @returns {label:'2026/27', start_date:'2026-09-01', end_date:'2027-06-30'}
 */
export function proponerTemporada(hoyISO) {
  const anio = Number(String(hoyISO).slice(0, 4));
  const mes = Number(String(hoyISO).slice(5, 7));
  const ini = mes >= 7 ? anio : anio - 1;
  return {
    label: `${ini}/${String(ini + 1).slice(2)}`,
    start_date: `${ini}-09-01`,
    end_date: `${ini + 1}-06-30`,
  };
}

/**
 * Expande los slots semanales sobre el rango de la temporada, saltando
 * los periodos sin entreno. Devuelve las ocurrencias TEÓRICAS.
 * @param temporada {start_date, end_date}    (throw si faltan: una temporada
 *                                             sin límites no puede generar)
 * @param slots     [{id, weekday 1-7, hora_inicio, hora_fin, lugar, activo}]
 * @param periodos  [{fecha_inicio, fecha_fin}]  (ya filtrados: club + este equipo)
 * @returns [{slot_id, slot_date, hora_inicio, hora_fin, lugar, slot_duracion_min}]
 */
export function expandirTemporada(temporada, slots, periodos = []) {
  if (!temporada || !temporada.start_date || !temporada.end_date) {
    throw new Error('La temporada activa no tiene fechas de inicio/fin definidas.');
  }
  const activos = (slots || []).filter((s) => s && s.activo !== false);
  if (!activos.length) return [];
  const porDia = new Map(); // weekday → slots de ese día
  for (const s of activos) {
    if (!porDia.has(s.weekday)) porDia.set(s.weekday, []);
    porDia.get(s.weekday).push(s);
  }
  const out = [];
  for (const fecha of diasEntre(temporada.start_date, temporada.end_date)) {
    const delDia = porDia.get(isoWeekday(fecha));
    if (!delDia || enPeriodo(fecha, periodos)) continue;
    for (const s of delDia) {
      out.push({
        slot_id: s.id,
        slot_date: fecha,
        hora_inicio: s.hora_inicio,
        hora_fin: s.hora_fin,
        lugar: s.lugar ?? null,
        slot_duracion_min: duracionMin(s.hora_inicio, s.hora_fin),
      });
    }
  }
  return out;
}

const key = (slotId, slotDate) => slotId + '|' + slotDate;
/** Sesión auto que nadie ha tocado: sigue preliminar y en su fecha teórica. */
const intacta = (s) => s.origen === 'auto' && s.estado === 'preliminar' && s.fecha === s.slot_date;

/**
 * Reconciliación idempotente entre las ocurrencias teóricas y las sesiones
 * existentes. NUNCA toca: manuales, programadas/realizadas/canceladas, ni
 * preliminares movidas a mano (fecha ≠ slot_date).
 * @param ocurrencias  salida de expandirTemporada()
 * @param existentes   sesiones de la BD (origen, estado, slot_id, slot_date,
 *                     fecha, hora_inicio, hora_fin, lugar, id)
 * @returns { aInsertar: [ocurrencia], aActualizar: [{id, patch}], aBorrar: [id] }
 */
export function planRegeneracion(ocurrencias, existentes) {
  const teoricas = new Map(ocurrencias.map((o) => [key(o.slot_id, o.slot_date), o]));
  const vivas = new Map(); // ocurrencias ya representadas en BD (cualquier estado)
  for (const s of existentes || []) {
    if (s.origen === 'auto' && s.slot_id && s.slot_date) {
      vivas.set(key(s.slot_id, s.slot_date), s);
    }
  }

  const aInsertar = [];
  for (const [k, o] of teoricas) {
    if (!vivas.has(k)) aInsertar.push(o);
  }

  const aActualizar = [];
  const aBorrar = [];
  for (const [k, s] of vivas) {
    const o = teoricas.get(k);
    if (!o) {
      // la ocurrencia ya no existe (slot borrado/desactivado o periodo nuevo):
      // se poda SOLO el andamiaje intacto; lo tocado se respeta.
      if (intacta(s)) aBorrar.push(s.id);
      continue;
    }
    // slot editado (hora/lugar): propagar SOLO a preliminares intactas.
    if (intacta(s)) {
      const patch = {};
      if (s.hora_inicio !== o.hora_inicio) patch.hora_inicio = o.hora_inicio;
      if (s.hora_fin !== o.hora_fin) patch.hora_fin = o.hora_fin;
      if ((s.lugar ?? null) !== (o.lugar ?? null)) patch.lugar = o.lugar;
      if ((s.slot_duracion_min ?? null) !== (o.slot_duracion_min ?? null)) {
        patch.slot_duracion_min = o.slot_duracion_min;
      }
      // slot_date acompaña al patch: la capa de datos lo usa como guarda de
      // "sigue intacta" al aplicar (otro tab pudo promoverla/moverla entretanto)
      if (Object.keys(patch).length) aActualizar.push({ id: s.id, patch, slot_date: s.slot_date });
    }
  }

  return { aInsertar, aActualizar, aBorrar };
}
