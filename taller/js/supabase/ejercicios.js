/* ============================================================
   supabase/ejercicios.js — persistencia del ejercicio (§13).
   Mapea el draft del Taller a la tabla compartida public.exercises.
   ============================================================ */

import { supabase } from './client.js';
import { aRegistro } from '../wizard/draft.js';
import { generarThumbnail } from '../canvas/thumbnail.js';

/** Genera póster + GIF (§19) sin bloquear el guardado si algo falla. */
async function conMiniatura(row, animacion) {
  try { const t = await generarThumbnail(animacion, { width: 160, frames: 14 }); row.poster = t.poster; row.thumbnail = t.gif; }
  catch { /* miniatura opcional */ }
  return row;
}

/** Construye una animación mínima (sin fases) desde la foto inicial del board,
 *  para no perder las posiciones cuando se guarda sin generar animación. */
export function animacionDesdeBoard(elementos, pista) {
  return {
    pista,
    jugadores: elementos.filter((e) => e.kind === 'jugador').map((e) => ({
      id: `${e.equipo}${e.label}`, equipo: e.equipo, tipo: e.tipo,
      posicion_inicial: [e.x, e.y], tiene_balon: false, dorsal: e.dorsal ?? null, nombre: e.nombre ?? null,
    })),
    balones: elementos.filter((e) => e.kind === 'balon').map((e, i) => ({ id: e.id || `balon_${i + 1}`, posicion_inicial: [e.x, e.y], portador_id: null })),
    conos: elementos.filter((e) => e.kind === 'cono').map((e, i) => ({ id: e.id || `cono_${i + 1}`, posicion: [e.x, e.y], funcion: e.funcion || 'decorativo', fila_config: e.fila_config || null })),
    fases: [],
    warnings: [],
  };
}

/** Inserta el ejercicio en Supabase. Requiere sesión activa (RLS). */
export async function guardarEjercicio(draft, elementos = []) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('SIN_SESION');

  const r = aRegistro(draft);
  const animacion = r.animacion || animacionDesdeBoard(elementos, r.tipo_pista);

  const row = {
    name: r.nombre,
    type: r.tipo,
    category: r.category,                 // BLOQUE de contenido (bote, tiro, defensa…)
    difficulty: r.dificultad_valor,
    intensidad: r.intensidad,             // intensidad física 1-5 (curva de carga · Sesiones)
    duration_min: r.duracion_min,
    duration_max: r.duracion_max,
    description: r.description || null,    // la frase de la tarjeta, no el desarrollo
    tags: r.tags,
    created_by: user.id,
    animacion,
    tipo_pista: r.tipo_pista,
    categoria_rama: r.categoria_rama,
    categoria_nivel: r.categoria_nivel,
    dificultad_label: r.dificultad_label,
    autor_nombre: r.autor_nombre || null,
    objetivos: r.objetivos || null,
    notas: r.notas || null,
    descripcion_texto: r.descripcion_texto || null,
    requisitos: r.requisitos,
    favorito: false,
  };
  await conMiniatura(row, animacion);

  const { data, error } = await supabase.from('exercises').insert(row).select('id').single();
  if (error) throw error;
  return data; // { id }
}

const DEV = location.hostname === '127.0.0.1' || location.hostname === 'localhost';

/** Carga un ejercicio por id (§14). En dev acepta un fixture window.__demoEjercicio. */
export async function getEjercicio(id) {
  if (DEV && window.__demoEjercicio && (id === 'demo' || window.__demoEjercicio.id === id)) return window.__demoEjercicio;
  const { data, error } = await supabase.from('exercises').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function actualizarEjercicio(id, campos) {
  if (campos.animacion) campos = await conMiniatura({ ...campos }, campos.animacion);
  const { data, error } = await supabase.from('exercises').update(campos).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** Favorito (§14): toggle del campo favorito. */
export async function setFavorito(id, favorito) {
  return actualizarEjercicio(id, { favorito });
}

/** Duplicar (§14): copia con nombre "Copia de …" y nuevo id. */
export async function duplicarEjercicio(ej) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('SIN_SESION');
  const row = { ...ej };
  delete row.id; delete row.created_at; delete row.updated_at;
  row.name = `Copia de ${ej.name}`;
  row.created_by = user.id;
  row.favorito = false;
  const { data, error } = await supabase.from('exercises').insert(row).select('id').single();
  if (error) throw error;
  return data;
}

/** Eliminar (§14): los coaches archivan (RLS de DELETE es solo admin). */
export async function eliminarEjercicio(id) {
  const { error } = await supabase.from('exercises').update({ is_archived: true }).eq('id', id);
  if (error) throw error;
}
