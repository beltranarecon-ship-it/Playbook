/* ============================================================
   alta.js — LO QUE SE LE DICE A QUIEN SE ESTÁ DANDO DE ALTA.
   Módulo PURO: sin red, sin DOM, sin Supabase. Por eso tiene banco
   (tools/eval-alta.mjs), que es lo que hacía falta para poder
   comprobar de verdad los tres caminos del registro sin una base de
   datos delante.

   Vivía dentro de auth.js, que importa el cliente de Supabase desde la
   red; con eso, Node no podía cargarlo ni para leer una función que no
   toca nada.
   ============================================================ */

export function mensajeDeAlta(error) {
  const t = `${error?.message || ''} ${error?.error_description || ''}`;
  if (t.includes('no está invitado')) {
    return 'Este correo no está invitado al Playbook del club. Pídele al administrador que te añada.';
  }
  /* El disparador de la 032 rechaza el alta con su propio mensaje, pero
     Supabase Auth NO lo deja pasar: cualquier error del disparador
     llega como «Database error saving new user», que no le dice nada a
     nadie. Y en esta app ese disparador solo tiene un motivo para
     rechazar un alta — que el correo no esté invitado—, así que se
     traduce a eso y se añade la otra causa posible por si acaso. */
  if (/database error saving new user|unexpected_failure/i.test(t)) {
    return 'No se ha podido crear la cuenta. Lo más probable es que este correo no esté '
      + 'invitado al Playbook del club: pídele al administrador que te añada y vuelve a intentarlo.';
  }
  if (/already registered|already exists/i.test(t)) {
    return 'Ese correo ya tiene cuenta. Entra con tu contraseña o usa «¿No te acuerdas?».';
  }
  if (t.includes('Password should be')) return 'La contraseña tiene que tener al menos seis caracteres.';
  if (/invalid.*email|email.*invalid/i.test(t)) return 'Ese correo no parece válido.';
  if (/rate limit|too many/i.test(t)) return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  return t.trim() || 'No se ha podido completar.';
}

/**
 * Qué hacer después de un alta que NO ha dado error.
 *
 * ── EL FALLO QUE ESTO ARREGLA ───────────────────────────────
 * El alta salía bien, la pantalla decía «Cuenta creada» … y ahí se
 * quedaba. Con la confirmación por correo desactivada —que es lo normal
 * en un club pequeño— `signUp` devuelve la SESIÓN YA INICIADA: la
 * persona estaba dentro y seguía mirando la pantalla de acceso. Desde
 * fuera eso es exactamente «no funciona».
 *
 * El login normal navega a /inicio; el alta no lo hacía.
 *
 * `ok` distingue lo que ha SALIDO BIEN de lo que solo es un aviso: la
 * pantalla pinta en verde lo primero y en rojo lo segundo. «Ese correo
 * ya tiene cuenta» en verde se lee como que todo ha ido bien, y no ha
 * ido: no se ha creado nada y hay que hacer otra cosa.
 *
 * @returns {{entra: boolean, ok: boolean, mensaje: string}}
 */
export function resultadoDeAlta(data) {
  if (data?.session) {
    return { entra: true, ok: true, mensaje: 'Cuenta creada. Entrando…' };
  }
  /* Sin sesión hay dos casos y conviene distinguirlos: cuando el correo
     YA tenía cuenta, Supabase devuelve un usuario sin identidades en
     vez de un error —lo hace a propósito, para no chivar quién está
     registrado—. Mandar a esa persona a mirar su bandeja sería mandarla
     a esperar un correo que no va a llegar. */
  const identidades = data?.user?.identities;
  if (Array.isArray(identidades) && identidades.length === 0) {
    return { entra: false, ok: false,
      mensaje: 'Ese correo ya tiene cuenta. Entra con tu contraseña, o usa «¿No te acuerdas?» si la has olvidado.' };
  }
  return { entra: false, ok: true,
    mensaje: 'Cuenta creada. Te hemos mandado un correo para confirmarla: ábrelo y vuelve aquí a entrar.' };
}
