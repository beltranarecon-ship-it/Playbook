import { supabase } from './supabase-client.js';

const LOGIN_URL = '/index.html';
const APP_URL   = '/app.html';

// ── Sesión ───────────────────────────────────────────────

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Comprueba que hay sesión activa; si no, redirige a login.
// Llámalo al inicio de cualquier página protegida.
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.replace(LOGIN_URL);
    return null;
  }
  return session;
}

// Comprueba que NO hay sesión; si la hay, redirige a la app.
// Llámalo en index.html para evitar que usuarios ya autenticados vean el login.
export async function redirectIfAuthenticated() {
  const session = await getSession();
  if (session) {
    window.location.replace(APP_URL);
  }
}

// ── Login / Logout ───────────────────────────────────────

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.replace(LOGIN_URL);
}

// ── Perfil del usuario ───────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export function isAdmin(profile) {
  return profile?.role === 'admin';
}

// ── Listener global de cambios de auth ───────────────────
// Úsalo en app.html para reaccionar a logout/expiración.

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
