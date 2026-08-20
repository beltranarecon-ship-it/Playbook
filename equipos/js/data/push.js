/* ============================================================
   push.js — SUSCRIBIRSE A LOS AVISOS (Tramo 4.7).
   Habla con el navegador (Notification, PushManager) y con la tabla
   `push_suscripciones` de la 031. La decisión de QUÉ avisar no está
   aquí: está en `avisos.js`, que es puro.

   ── EL ESTADO SE MIRA, NO SE SUPONE ─────────────────────────
   Hay cinco situaciones distintas y decir la verdad en cada una es la
   mitad del trabajo:

     no_soportado · el navegador no tiene push (iPhone sin instalar)
     sin_permiso  · nunca se ha preguntado
     denegado     · se dijo que no; NO se puede volver a preguntar
     suscrito     · funcionando
     sin_claves   · falta la clave VAPID pública en la configuración

   `denegado` es el importante: una vez que alguien dice que no, el
   navegador no vuelve a preguntar nunca, y un botón que lo intenta otra
   vez parece roto. Hay que decirle que lo cambie en el navegador.

   ── EN iPHONE HACE FALTA INSTALAR LA APP ────────────────────
   §5.8 lo asume: sin la app en la pantalla de inicio no hay push. Se
   detecta y se dice, porque la alternativa es un botón que no hace nada
   y un entrenador convencido de que la app está rota.
   ============================================================ */

import { supabase } from './_client.js';
import { VAPID_PUBLIC_KEY } from '../config.js';

/** La clave VAPID viaja en base64url y el navegador la quiere en bytes. */
function claveEnBytes(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(b64);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

const hayApi = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Si la página se está viendo como app instalada. */
export const instalada = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent);

/**
 * En qué situación estamos.
 * @returns {estado, porque}
 */
export async function situacion() {
  if (!hayApi()) {
    return {
      estado: 'no_soportado',
      porque: esIOS() && !instalada()
        ? 'En iPhone los avisos solo llegan con la app instalada en la pantalla de inicio: '
          + 'compártela desde Safari y elige «Añadir a inicio».'
        : 'Este navegador no admite avisos.',
    };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { estado: 'sin_claves', porque: 'Falta la clave pública de avisos en la configuración de la app.' };
  }
  if (Notification.permission === 'denied') {
    return {
      estado: 'denegado',
      porque: 'Dijiste que no a los avisos y el navegador ya no vuelve a preguntar. '
        + 'Se cambia en el candado de la barra de direcciones, en «Notificaciones».',
    };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sus = await reg.pushManager.getSubscription();
    if (sus) return { estado: 'suscrito', porque: '' };
  } catch { /* sin service worker todavía */ }
  return { estado: 'sin_permiso', porque: '' };
}

/**
 * Pide permiso, se suscribe y lo guarda.
 * @returns {ok, estado, porque}
 */
export async function suscribir({ dispositivo = null } = {}) {
  const s = await situacion();
  if (s.estado === 'suscrito') return { ok: true, ...s };
  if (s.estado !== 'sin_permiso') return { ok: false, ...s };

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    return {
      ok: false, estado: permiso === 'denied' ? 'denegado' : 'sin_permiso',
      porque: 'Sin permiso no se pueden mandar avisos.',
    };
  }

  const reg = await navigator.serviceWorker.ready;
  const sus = await reg.pushManager.subscribe({
    userVisibleOnly: true,   // obligatorio: todo push muestra notificación
    applicationServerKey: claveEnBytes(VAPID_PUBLIC_KEY),
  });

  const j = sus.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  /* upsert por endpoint: el mismo navegador reinstalado devuelve el
     mismo endpoint, y sin esto se acumularían filas muertas a las que
     se manda un push que nadie recibe. */
  const { error } = await supabase.from('push_suscripciones').upsert({
    user_id: user.id,
    endpoint: j.endpoint,
    p256dh: j.keys?.p256dh,
    auth: j.keys?.auth,
    dispositivo: dispositivo || navigator.userAgent.slice(0, 120),
    visto_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw error;

  return { ok: true, estado: 'suscrito', porque: '' };
}

/** Deja de recibir avisos en ESTE dispositivo. */
export async function desuscribir() {
  if (!hayApi()) return;
  const reg = await navigator.serviceWorker.ready;
  const sus = await reg.pushManager.getSubscription();
  if (!sus) return;
  const endpoint = sus.endpoint;
  await sus.unsubscribe().catch(() => {});
  // se quita también de la base: si no, se le seguiría mandando a un
  // endpoint muerto hasta que el servicio de push devuelva 410
  await supabase.from('push_suscripciones').delete().eq('endpoint', endpoint);
}

/* ── La bandeja (§5.8, y el iPhone sin instalar) ───────────── */

/**
 * Los avisos sin leer.
 *
 * La cola existe precisamente para esto: donde el push no llega —un
 * iPhone sin la app instalada— el aviso sigue estando, y se ve al abrir
 * la aplicación. Sin bandeja, ese entrenador no se entera de nada.
 */
export async function sinLeer({ limite = 20 } = {}) {
  const { data, error } = await supabase
    .from('avisos')
    .select('id, tipo, clave, titulo, cuerpo, url, creado_at')
    .is('leido_at', null)
    .order('creado_at', { ascending: false })
    .limit(limite);
  if (error) {
    // sin la 031 aplicada no hay bandeja, pero tampoco hay excusa para
    // tumbar la pantalla que la enseña
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw error;
  }
  return data ?? [];
}

export async function marcarLeido(ids) {
  const lista = [].concat(ids || []).filter(Boolean);
  if (!lista.length) return;
  await supabase.from('avisos').update({ leido_at: new Date().toISOString() }).in('id', lista);
}

/** Encola un aviso para otra persona (4.13). La RLS comprueba el equipo. */
export async function encolar(aviso) {
  const filas = (aviso.para || []).map((user_id) => ({
    user_id, tipo: aviso.tipo, clave: aviso.clave,
    titulo: aviso.titulo, cuerpo: aviso.cuerpo || null, url: aviso.url || null,
  }));
  if (!filas.length) return 0;
  /* `ignoreDuplicates`: el índice único de la 031 es lo que impide el
     acoso, y chocar con él NO es un error que deba ver nadie. */
  const { error } = await supabase.from('avisos').upsert(filas, {
    onConflict: 'user_id,clave', ignoreDuplicates: true,
  });
  if (error && error.code !== '42P01' && error.code !== 'PGRST205') throw error;
  return filas.length;
}
