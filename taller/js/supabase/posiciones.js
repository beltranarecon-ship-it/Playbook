/* ============================================================
   supabase/posiciones.js — diccionario CUSTOM de posiciones con
   nombre, por pista (Tramo 2.3, tabla public.posiciones_pista —
   migración 005). Cada posición es ESPECÍFICA de su pista: la
   consulta filtra por `pista` y la tabla tiene UNIQUE(pista,
   nombre, created_by) — el mismo nombre en dos pistas son DOS
   filas independientes, nunca se comparten coordenadas.

   Identidad: la app no tiene concepto de "club" en el esquema
   (001–004); todo se ancla al usuario autenticado (created_by =
   auth.uid()), igual que exercises.created_by. Si algún día llega
   un club_id real, migrar esta columna es un ALTER + backfill.

   Este módulo NO lo importa nadie del motor de IA (compilador/
   validador/posiciones.js son puros y el banco Node los importa);
   solo paso2.js (navegador), que INYECTA el diccionario cargado.
   ============================================================ */

import { supabase } from './client.js';

/**
 * Posiciones custom del usuario para UNA pista.
 * @returns objeto plano { nombre: [x,y] } — el formato que consumen
 *          resolverPosicion / validarIntent / compilarAnimacion.
 *          Nunca lanza: sin sesión, sin tabla o sin red → {} (el
 *          Taller funciona igual, solo sin diccionario custom).
 */
export async function cargarPosiciones(pista) {
  try {
    const { data, error } = await supabase
      .from('posiciones_pista')
      .select('nombre,x,y')
      .eq('pista', pista);
    if (error) return {};
    const out = {};
    for (const r of data || []) {
      const x = Number(r.x), y = Number(r.y);
      if (r.nombre && Number.isFinite(x) && Number.isFinite(y)) out[r.nombre] = [x, y];
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Guarda (o actualiza: upsert sobre UNIQUE(pista,nombre,created_by)) una
 * posición marcada por el entrenador con un clic (pregunta tipo A).
 * `nombre` llega ya normalizado (slug de ia/posiciones.js). Requiere
 * sesión; los llamadores tratan el fallo como no-fatal (.catch).
 */
export async function guardarPosicion(pista, nombre, x, y) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('SIN_SESION');
  const { error } = await supabase.from('posiciones_pista').upsert(
    { pista, nombre, x, y, created_by: user.id },
    { onConflict: 'pista,nombre,created_by' },
  );
  if (error) throw error;
}
