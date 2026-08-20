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

/* ============================================================
   ENTRAR CON GOOGLE, REGISTRARSE Y RECUPERAR LA CLAVE
   (Tramo 4.10)

   Las tres pasan por la MISMA puerta: el disparador de alta de la 032,
   que comprueba el correo contra la lista de invitaciones. Aquí no hay
   ninguna comprobación de quién puede entrar, y es a propósito: una
   lista de correos en el navegador la lee cualquiera, y una segunda
   comprobación en el cliente solo sirve para que un día discrepe de la
   de verdad.
   ============================================================ */

/** El mensaje del disparador llega envuelto; se saca para poder enseñarlo. */
export function mensajeDeAlta(error) {
  const t = `${error?.message || ''}`;
  if (t.includes('no está invitado')) {
    return 'Este correo no está invitado al Playbook del club. Pídele al administrador que te añada.';
  }
  if (t.includes('already registered') || t.includes('User already registered')) {
    return 'Ese correo ya tiene cuenta. Entra con tu contraseña o usa «¿No te acuerdas?».';
  }
  if (t.includes('Password should be')) return 'La contraseña tiene que tener al menos seis caracteres.';
  return t || 'No se ha podido completar.';
}

/** Entrar con Google. Vuelve a la app; si el correo no está invitado, el alta falla. */
export async function entrarConGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/app.html` },
  });
  if (error) throw error;
}

/**
 * Registrarse eligiendo la contraseña uno mismo (decisión #31).
 *
 * Si el correo no está en la lista de invitaciones, el disparador de la
 * 032 hace fallar el alta y el usuario no llega a existir.
 */
export async function registrarse(email, password, nombre = null) {
  const { data, error } = await supabase.auth.signUp({
    email: String(email || '').trim().toLowerCase(),
    password,
    options: { data: nombre ? { full_name: nombre.trim() } : {} },
  });
  if (error) throw error;
  return data;
}

/** Manda el correo para poner una contraseña nueva. */
export async function recuperarClave(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    String(email || '').trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/clave.html` },
  );
  if (error) throw error;
}

/** Cambia la contraseña de quien ya tiene sesión (o viene del enlace). */
export async function cambiarClave(nueva) {
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw error;
}

/** Cambia el nombre que se ve en el club. */
export async function cambiarNombre(userId, nombre) {
  const limpio = String(nombre || '').trim();
  if (!limpio) throw new Error('El nombre no puede quedar vacío.');
  const { error } = await supabase.from('profiles').update({ full_name: limpio }).eq('id', userId);
  if (error) throw error;
  // y en la cuenta, para que el saludo cuadre con lo que se ve
  await supabase.auth.updateUser({ data: { full_name: limpio } }).catch(() => {});
  return limpio;
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
