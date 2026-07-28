import { supabase } from '../supabase-client.js';

// ── Listado ──────────────────────────────────────────────

export async function getEjercicios({ busqueda, type, category } = {}) {
  let query = supabase
    .from('exercises')
    .select('id, name, type, category, difficulty, duration_min, description, tags, poster, created_by, created_at')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (busqueda?.trim()) {
    query = query.ilike('name', `%${busqueda.trim()}%`);
  }
  if (type) {
    query = query.eq('type', type);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ── Crear ────────────────────────────────────────────────

export async function createEjercicio({ name, type, category, difficulty, duration_min, description, tags }) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name:         name.trim(),
      type:         type || null,
      category:     category || null,
      difficulty:   difficulty ? Number(difficulty) : null,
      duration_min: duration_min ? Number(duration_min) : null,
      description:  description?.trim() || null,
      tags:         tags ?? [],
      created_by:   user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Actualizar ───────────────────────────────────────────

export async function updateEjercicio(id, campos) {
  const { data, error } = await supabase
    .from('exercises')
    .update(campos)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── GIF de la miniatura (carga diferida en hover §19) ────

export async function getThumbnailGif(id) {
  const { data, error } = await supabase
    .from('exercises')
    .select('thumbnail')
    .eq('id', id)
    .single();
  if (error) return null;
  return data?.thumbnail || null;
}

// ── Archivar (soft delete) ───────────────────────────────

export async function archivarEjercicio(id) {
  const { error } = await supabase
    .from('exercises')
    .update({ is_archived: true })
    .eq('id', id);

  if (error) throw error;
}
