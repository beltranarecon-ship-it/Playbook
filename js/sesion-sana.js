/* ============================================================
   sesion-sana.js — QUE UNA SESIÓN CORRUPTA NO DEJE LA APP MUERTA.

   ── QUÉ PASÓ ────────────────────────────────────────────────
   El arnés de desarrollo (`/dev/*`) escribe en el localStorage REAL
   ('cbp-auth') una sesión de mentira con `access_token: 'dev'`. Está
   hecho a propósito —así el arnés puede abrir las pantallas de verdad
   sin cuenta— pero tiene un efecto que no se vio venir: al volver
   después a la aplicación de verdad en el mismo navegador, esa sesión
   falsa sigue ahí. Supabase intenta usarla, y como 'dev' no es un JWT
   (que son tres partes separadas por puntos) todas las consultas se
   caen con «Expected 3 parts in JWT; got 1».

   Y se cae TODO: inicio, calendario y equipos, cada uno con un mensaje
   de error distinto que no dice la causa. Con la sesión rota no hay
   pantalla que funcione y tampoco hay forma obvia de salir, porque
   «cerrar sesión» también habla con Supabase.

   ── QUÉ HACE ────────────────────────────────────────────────
   Antes de arrancar nada, mira lo que hay guardado. Si no es una
   sesión utilizable, la borra y sigue: el usuario acaba en el login,
   que es exactamente donde tiene que estar, en vez de en una pantalla
   rota.

   ── POR QUÉ AQUÍ Y NO EN EL ARNÉS ───────────────────────────
   El arnés también se limpia (ver `dev/planner.html`), pero eso solo
   arregla el caso de quien vuelve a abrir el arnés. Esto arregla el de
   quien NO vuelve, que es el que se queda tirado. Y de paso cubre
   cualquier otra forma de corromperse: una sesión a medio escribir, un
   localStorage manipulado, una versión vieja del formato.
   ============================================================ */

import { SESSION_STORAGE_KEY } from './config.js';

/**
 * ¿Es esto una sesión que Supabase pueda usar?
 *
 * No valida la firma ni la caducidad —de eso ya se encarga Supabase—:
 * comprueba solo que el token TENGA FORMA de JWT. Es la diferencia
 * entre «tu sesión ha caducado», que se arregla sola refrescando, y
 * «esto no es un token», que no se arregla nunca.
 */
export function pareceSesion(bruto) {
  if (!bruto) return true;                    // no hay nada: es un caso normal
  let s;
  try { s = JSON.parse(bruto); } catch { return false; }
  if (!s || typeof s !== 'object') return false;
  const t = s.access_token ?? s.currentSession?.access_token;
  if (t == null) return false;
  // un JWT son tres trozos separados por puntos
  return typeof t === 'string' && t.split('.').length === 3;
}

/**
 * Limpia la sesión si no vale. Se llama ANTES de crear el cliente.
 * @returns true si ha tenido que limpiar algo
 */
export function limpiaSesionRota(almacen = window.localStorage, clave = SESSION_STORAGE_KEY) {
  /* Con el arnés ABIERTO en esta misma página, su sesión de mentira es
     legítima: el arnés intercepta `fetch`, así que ese token no llega
     nunca a Supabase y no puede romper nada. Lo que hay que limpiar es
     la sesión que el arnés dejó ATRÁS, en una visita anterior, cuando
     ahora se está abriendo la app de verdad. La diferencia entre las
     dos es exactamente esta bandera. */
  if (typeof window !== 'undefined' && window.__ARNES_DEV__) return false;
  try {
    const bruto = almacen.getItem(clave);
    if (pareceSesion(bruto)) return false;
    almacen.removeItem(clave);
    console.warn('[sesión] había una sesión ilegible guardada; se ha borrado. '
      + 'Si venías del arnés de desarrollo, esto es lo esperado: vuelve a entrar.');
    return true;
  } catch {
    // sin localStorage (modo privado) no hay nada que limpiar
    return false;
  }
}
