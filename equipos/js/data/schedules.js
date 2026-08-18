/* ============================================================
   schedules.js — horarios semanales (slots) + periodos sin
   entreno + orquestación de la regeneración (motor puro).
   Los slots que se quitan se DESACTIVAN (activo=false), nunca se
   borran: sus sesiones conservan slot_id y la reconciliación puede
   podar las preliminares intactas (regla del motor).
   ============================================================ */

import { supabase } from './_client.js';
import {
  expandirTemporada, planRegeneracion, parsearPeriodos, recortarTemporada,
} from './programacion.js';
import { getSesionesAuto, getSesionesRango } from './sessions.js';

// ── Slots ────────────────────────────────────────────────────
export async function getSlots(teamId, seasonId, { soloActivos = true } = {}) {
  let q = supabase
    .from('team_schedules')
    .select('id, team_id, season_id, weekday, hora_inicio, hora_fin, lugar, activo')
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .order('weekday')
    .order('hora_inicio');
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Slots ACTIVOS del equipo en OTRAS temporadas. Al abrir temporada nueva el
 * equipo se queda sin horarios (son de cada temporada) y hay que reescribir a
 * mano lo mismo de siempre; esto permite ofrecer "copiar los del año pasado".
 */
export async function getSlotsOtrasTemporadas(teamId, seasonIdActual) {
  const { data, error } = await supabase
    .from('team_schedules')
    .select('id, season_id, weekday, hora_inicio, hora_fin, lugar')
    .eq('team_id', teamId)
    .eq('activo', true)
    .neq('season_id', seasonIdActual)
    .order('weekday')
    .order('hora_inicio');
  if (error) throw error;
  return data ?? [];
}

/**
 * Sincroniza los slots editados con la BD.
 * @param editados [{id?, weekday, hora_inicio, hora_fin, lugar}] — sin id = nuevo
 */
export async function guardarSlots(teamId, seasonId, editados) {
  const { data: { user } } = await supabase.auth.getUser();
  const actuales = await getSlots(teamId, seasonId);
  const editadosConId = new Map(editados.filter((s) => s.id).map((s) => [s.id, s]));

  // desactivar los que ya no están
  const aDesactivar = actuales.filter((a) => !editadosConId.has(a.id)).map((a) => a.id);
  if (aDesactivar.length) {
    const { error } = await supabase
      .from('team_schedules').update({ activo: false }).in('id', aDesactivar);
    if (error) throw error;
  }
  // actualizar los que cambian
  for (const a of actuales) {
    const e = editadosConId.get(a.id);
    if (!e) continue;
    if (e.weekday !== a.weekday || e.hora_inicio !== a.hora_inicio
        || e.hora_fin !== a.hora_fin || (e.lugar ?? null) !== (a.lugar ?? null)) {
      const { error } = await supabase
        .from('team_schedules')
        .update({ weekday: e.weekday, hora_inicio: e.hora_inicio, hora_fin: e.hora_fin, lugar: e.lugar?.trim() || null })
        .eq('id', a.id);
      if (error) throw error;
    }
  }
  // insertar los nuevos
  const nuevos = editados.filter((s) => !s.id);
  if (nuevos.length) {
    const { error } = await supabase.from('team_schedules').insert(nuevos.map((s) => ({
      team_id: teamId, season_id: seasonId,
      weekday: s.weekday, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin,
      lugar: s.lugar?.trim() || null, created_by: user.id,
    })));
    if (error) throw error;
  }
}

/**
 * Alta o edición de UN horario. guardarSlots() sincroniza la lista ENTERA y
 * desactiva lo que no le pases, así que no vale para editar uno suelto.
 * @returns la fila guardada, con su id
 */
export async function guardarSlot(teamId, seasonId, slot) {
  const { data: { user } } = await supabase.auth.getUser();
  const campos = {
    weekday: slot.weekday,
    hora_inicio: slot.hora_inicio,
    hora_fin: slot.hora_fin,
    lugar: slot.lugar?.trim() || null,
  };
  const q = slot.id
    ? supabase.from('team_schedules').update(campos).eq('id', slot.id)
    : supabase.from('team_schedules')
        .insert({ ...campos, team_id: teamId, season_id: seasonId, created_by: user.id });
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

/** Un horario nunca se borra: se desactiva, para no cortar el vínculo con sus sesiones. */
export async function desactivarSlot(id) {
  const { error } = await supabase.from('team_schedules').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

/** Vuelta atrás de la anterior: si la poda falla a medias, el horario reaparece. */
export async function reactivarSlot(id) {
  const { error } = await supabase.from('team_schedules').update({ activo: true }).eq('id', id);
  if (error) throw error;
}

// ── Periodos sin entreno ─────────────────────────────────────
/** Periodos que afectan a un equipo: los de club (team_id NULL) + los suyos. */
export async function getPeriodos(seasonId, teamId = null) {
  let q = supabase
    .from('no_training_periods')
    .select('id, season_id, team_id, fecha_inicio, fecha_fin, motivo')
    .eq('season_id', seasonId)
    .order('fecha_inicio');
  if (teamId) q = q.or(`team_id.is.null,team_id.eq.${teamId}`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** clubWide=true → team_id NULL (solo admin, lo impone la RLS). */
export async function addPeriodo({ season_id, team_id = null, fecha_inicio, fecha_fin, motivo }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('no_training_periods')
    .insert({ season_id, team_id, fecha_inicio, fecha_fin, motivo: motivo?.trim() || null, created_by: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Alta en bloque desde el texto pegado. El formato lo decide parsearPeriodos()
 * (motor puro, con banco de pruebas): «12/10/2026 Fiesta» o «23/12/2026
 * 10/01/2027 Navidad», y también el ISO de siempre.
 * @returns {filas, ignoradas} — `ignoradas` son las líneas que no se han
 *   entendido, con su porqué, para que la pantalla pueda DECIRLO en vez de
 *   tragárselas.
 */
export async function addPeriodosBulk({ season_id, team_id = null, texto }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { filas: leidas, ignoradas } = parsearPeriodos(texto);
  if (!leidas.length) return { filas: [], ignoradas };
  const { data, error } = await supabase
    .from('no_training_periods')
    .insert(leidas.map((f) => ({ ...f, season_id, team_id, created_by: user.id })))
    .select();
  if (error) throw error;
  return { filas: data ?? [], ignoradas };
}

export async function borrarPeriodo(id) {
  const { error } = await supabase.from('no_training_periods').delete().eq('id', id);
  if (error) throw error;
}

// ── Regeneración (motor puro + datos frescos) ────────────────
/**
 * Calcula el plan SIN aplicarlo (para el modal de previsualización).
 * @returns { plan, resumen: {insertar, actualizar, borrar, saltadas} }
 */
/** Ocurrencias que el entrenador descartó a mano (018): no vuelven a generarse. */
export async function getExclusiones(teamId, seasonId) {
  const { data, error } = await supabase
    .from('session_slot_exclusions')
    .select('id, slot_id, slot_date, motivo')
    .eq('team_id', teamId)
    .eq('season_id', seasonId);
  if (error) throw error;
  return data ?? [];
}

const PLAN_VACIO = { aInsertar: [], aActualizar: [], aBorrar: [] };

/**
 * Calcula el plan SIN aplicarlo, acotado al tramo y a los horarios que se pidan.
 * @param opciones.desde/hasta  tramo a generar. Sin ellos, la temporada entera.
 * @param opciones.slotIds      generar solo estos horarios. Sin ellos, todos.
 * @returns { plan, resumen, conflictos, tramo }
 *   · conflictos = días en los que ya hay algo de ese equipo y aun así se
 *     insertaría una sesión nueva. No bloquean: se enseñan y se decide.
 */
export async function previewRegeneracion(teamId, temporada, opciones = {}) {
  const { desde = null, hasta = null, slotIds = null } = opciones || {};
  const tramo = recortarTemporada(temporada, desde, hasta);
  if (!tramo) {
    return {
      plan: PLAN_VACIO, tramo: null, conflictos: [],
      resumen: { insertar: 0, actualizar: 0, borrar: 0, saltadas: 0, descartadas: 0 },
    };
  }

  const [slots, periodos, existentes, exclusiones, delTramo] = await Promise.all([
    getSlots(teamId, temporada.id),
    getPeriodos(temporada.id, teamId),
    getSesionesAuto(teamId, temporada.id),
    getExclusiones(teamId, temporada.id),
    getSesionesRango({ desde: tramo.start_date, hasta: tramo.end_date, teamId }),
  ]);

  // Al generar solo unos horarios hay que recortar TAMBIÉN las sesiones que se
  // le pasan al motor: si no, las de los otros horarios se quedan sin ocurrencia
  // teórica con la que casar y el motor las leería como andamiaje muerto.
  const usados = slotIds ? slots.filter((s) => slotIds.includes(s.id)) : slots;
  const suyas = slotIds ? existentes.filter((s) => slotIds.includes(s.slot_id)) : existentes;

  const sinFiltro = expandirTemporada(tramo, usados, []);
  const ocurrencias = expandirTemporada(tramo, usados, periodos);
  const plan = planRegeneracion(ocurrencias, suyas, {
    exclusiones,
    desde: tramo.start_date,
    hasta: tramo.end_date,
  });

  // ¿algún día en el que ya hay algo del equipo y aun así entraría otra sesión?
  const ocupados = new Map();
  for (const s of delTramo) {
    if (s.estado === 'cancelada') continue;
    if (!ocupados.has(s.fecha)) ocupados.set(s.fecha, []);
    ocupados.get(s.fecha).push(s);
  }
  const conflictos = plan.aInsertar
    .filter((o) => ocupados.has(o.slot_date))
    .map((o) => ({ fecha: o.slot_date, con: ocupados.get(o.slot_date) }));

  return {
    plan,
    tramo,
    conflictos,
    resumen: {
      insertar: plan.aInsertar.length,
      actualizar: plan.aActualizar.length,
      borrar: plan.aBorrar.length,
      saltadas: sinFiltro.length - ocurrencias.length, // días en periodos sin entreno
      // solo las que caen en ESTE tramo y en ESTOS horarios: contarlas todas
      // decía "12 quitadas a mano" en una previa que abarcaba una semana
      descartadas: exclusiones.filter((e) =>
        (!slotIds || slotIds.includes(e.slot_id))
        && e.slot_date >= tramo.start_date && e.slot_date <= tramo.end_date).length,
    },
  };
}

/**
 * Cuántas sesiones tiene ya este equipo en la temporada, por estado. Es el dato
 * que faltaba en pantalla: sin él, «no se genera nada» y «ya está todo generado»
 * se ven exactamente igual.
 */
export async function contarSesiones(teamId, seasonId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('estado')
    .eq('team_id', teamId)
    .eq('season_id', seasonId);
  if (error) throw error;
  const por = { preliminar: 0, programada: 0, realizada: 0, cancelada: 0 };
  for (const s of data ?? []) if (s.estado in por) por[s.estado] += 1;
  return { total: (data ?? []).length, por };
}
