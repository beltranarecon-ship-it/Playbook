/* ============================================================
   invitaciones.js — LA LISTA DE QUIÉN PUEDE ENTRAR (Tramo 4.9).
   Cliente de la tabla `invitaciones` (032) más el trocito puro que
   valida un correo, que es lo único que merece un banco.

   ── LO QUE ESTA PANTALLA NO HACE ────────────────────────────
   No crea contraseñas, no las ve y no las manda (decisión #31). El
   administrador escribe un correo y elige equipos; la persona entra por
   su cuenta —con Google o registrándose— y elige su propia clave. Sin
   clave maestra en el navegador y sin funciones de servidor.
   ============================================================ */

import { supabase } from './_client.js';

const COLS = 'id, email, rol, equipos, nombre, usada_at, created_at';

/** El correo, como se guarda y como se compara: minúsculas y sin espacios. */
export const normaliza = (email) => String(email || '').trim().toLowerCase();

/**
 * Qué le pasa a este correo, si es que le pasa algo.
 *
 * Deliberadamente simple: aquí no se valida si el buzón existe —eso lo
 * dirá el correo que no llegue— sino que sea escribible. Un validador
 * estricto rechaza direcciones legítimas y hace que alguien se quede
 * fuera del club por una regla nuestra.
 *
 * @returns string con el problema, o null si vale
 */
export function problemaDelCorreo(email, { yaEstan = [] } = {}) {
  const e = normaliza(email);
  if (!e) return 'Escribe un correo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return 'Eso no parece un correo.';
  if (yaEstan.map(normaliza).includes(e)) return 'Ese correo ya está invitado.';
  return null;
}

/** Cómo se lee el estado de una invitación. */
export const estadoDe = (inv) => (inv?.usada_at ? 'dentro' : 'pendiente');

export async function getInvitaciones() {
  const { data, error } = await supabase
    .from('invitaciones').select(COLS).order('created_at', { ascending: false });
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null;   // 032 sin aplicar
    throw error;
  }
  return data ?? [];
}

export async function invitar({ email, rol = 'coach', equipos = [], nombre = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('invitaciones')
    .insert({
      email: normaliza(email), rol, equipos, nombre: nombre?.trim() || null, invita: user?.id ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function cambiarInvitacion(id, patch) {
  const { error } = await supabase.from('invitaciones').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * Retira una invitación.
 *
 * Solo tiene efecto si NO se ha usado todavía: quien ya entró tiene su
 * cuenta y sus equipos, y quitarle la invitación no le echaría — daría
 * la falsa sensación de haberlo hecho. Para eso está quitarlo de sus
 * equipos, que es otra cosa y se hace en otro sitio.
 */
export async function retirar(id) {
  const { data, error } = await supabase
    .from('invitaciones').delete().eq('id', id).is('usada_at', null).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
