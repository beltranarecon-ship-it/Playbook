/* ============================================================
   supabase/auth.js — sesión del entrenador. El Taller no tiene login
   propio: usa la sesión compartida con cbp-v2 (mismo storageKey). Si
   no hay sesión, el guardado avisa en vez de redirigir.
   ============================================================ */

import { supabase } from './client.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/* Se pide UNA vez por visita y se guarda la promesa: el asistente puede
   abrirse varias veces sin recargar la página y el nombre del
   entrenador no cambia entre una y otra. */
let nombrePedido = null;

/**
 * Cómo se llama quien está usando el Taller, para firmar lo que crea.
 *
 * Mira `profiles.full_name` primero porque ÉSE es el nombre que ven los
 * demás entrenadores del club —lo dice la propia pantalla de perfil— y
 * el de la cuenta puede ser otro: hoy mismo hay una cuenta con «Beltrán»
 * en el perfil y «Beltrán Arenas» en el metadato. Firmar con uno y
 * salir con el otro en la lista de equipos no cuadra.
 *
 * La RLS de `profiles` (001) deja ver el propio perfil, así que esta
 * consulta funciona para cualquier entrenador, no solo para un admin.
 *
 * Nunca lanza: sin sesión, sin red o sin nombre puesto devuelve '' y el
 * campo se queda vacío, que es exactamente como estaba antes.
 */
export function nombreDelEntrenador() {
  if (nombrePedido) return nombrePedido;
  nombrePedido = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return '';
      const { data } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      return (data?.full_name || user.user_metadata?.full_name || '').trim();
    } catch { return ''; }
  })();
  return nombrePedido;
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((event, session) => cb(event, session));
}
