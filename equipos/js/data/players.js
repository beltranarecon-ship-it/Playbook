/* ============================================================
   players.js — roster del equipo. Solo `nombre` obligatorio.
   Baja = estado 'baja' (soft), nunca DELETE (histórico intacto).
   ============================================================ */

import { supabase } from './_client.js';

export async function getJugadores(teamId, { incluirBajas = false } = {}) {
  let q = supabase
    .from('players')
    .select('id, team_id, nombre, dorsal, fecha_nacimiento, posicion, foto_path, notas, estado, tutor_nombre, tutor_contacto')
    .eq('team_id', teamId)
    .order('dorsal', { ascending: true, nullsFirst: false })
    .order('nombre');
  if (!incluirBajas) q = q.neq('estado', 'baja');
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function crearJugador(campos) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('players')
    .insert({
      team_id: campos.team_id,
      nombre: campos.nombre.trim(),
      dorsal: campos.dorsal != null && campos.dorsal !== '' ? Number(campos.dorsal) : null,
      fecha_nacimiento: campos.fecha_nacimiento || null,
      posicion: campos.posicion || null,
      notas: campos.notas?.trim() || null,
      tutor_nombre: campos.tutor_nombre?.trim() || null,
      tutor_contacto: campos.tutor_contacto?.trim() || null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Alta masiva: un nombre por línea (opcional "12 Nombre" → dorsal). */
export async function crearJugadoresBulk(teamId, texto) {
  const { data: { user } } = await supabase.auth.getUser();
  const filas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      const m = linea.match(/^(\d{1,2})[\s.·-]+(.+)$/);
      return {
        team_id: teamId,
        nombre: (m ? m[2] : linea).trim(),
        dorsal: m ? Number(m[1]) : null,
        created_by: user.id,
      };
    });
  if (!filas.length) return [];
  const { data, error } = await supabase.from('players').insert(filas).select();
  if (error) throw error;
  return data ?? [];
}

export async function actualizarJugador(id, campos) {
  const { error } = await supabase.from('players').update(campos).eq('id', id);
  if (error) throw error;
}
