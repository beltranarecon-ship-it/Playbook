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

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((event, session) => cb(event, session));
}
