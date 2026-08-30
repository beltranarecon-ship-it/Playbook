/* ============================================================
   invitaciones.js — LA LISTA DE QUIÉN PUEDE ENTRAR (Tramo 4.9).
   Cliente de la tabla `invitaciones` (032) y de la función que manda
   el correo. Lo que no toca la red vive en invitacion-envio.js.

   ── LO QUE ESTA PANTALLA NO HACE ────────────────────────────
   No crea contraseñas y no las ve. El administrador escribe un correo
   y elige equipos; a esa persona le llega un enlace y elige su propia
   clave, que nadie más conoce.

   ── LO QUE CAMBIÓ (y por qué se dice aquí) ──────────────────
   Aquí ponía «y no las manda… sin funciones de servidor», que era la
   decisión #31: invitar era solo una fila en una tabla y avisar a esa
   persona le tocaba al administrador por WhatsApp. Funcionaba, pero
   había que acordarse, y quien recibía el aviso tenía que entender qué
   era eso de «regístrate con tu correo».

   Mandar el correo obliga a `auth.admin.inviteUserByEmail`, que solo
   existe con la CLAVE DE SERVICIO. Esa clave abre la base entera
   saltándose las políticas, así que en el navegador no puede estar: se
   lee mirando el código fuente de la página. Vive en una variable de
   entorno de Netlify y solo la toca netlify/functions/invitar.mjs.

   La decisión #31 se mantiene en lo que importaba —ninguna clave con
   permisos en el navegador— y cae en lo accesorio: ahora sí hay una
   función de servidor, y hace una sola cosa.
   ============================================================ */

import { supabase } from './_client.js';
import { resultadoDeInvitar, saneaInvitacion } from './invitacion-envio.js';

/* Lo PURO vive en invitacion-envio.js —sin red, sin DOM— para que
   tenga banco en Node: este fichero importa el cliente de Supabase y
   con él dentro no se puede cargar fuera del navegador. Se reexporta
   para que quien ya los importaba de aquí siga funcionando. */
export { normaliza, problemaDelCorreo, estadoDe } from './invitacion-envio.js';

const COLS = 'id, email, rol, equipos, nombre, usada_at, created_at';

export async function getInvitaciones() {
  const { data, error } = await supabase
    .from('invitaciones').select(COLS).order('created_at', { ascending: false });
  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return null;   // 032 sin aplicar
    throw error;
  }
  return data ?? [];
}

/**
 * Invita a un correo Y le manda el enlace para poner su contraseña.
 *
 * ── POR QUÉ PASA POR UNA FUNCIÓN DE SERVIDOR ────────────────
 * Mandar el correo es `auth.admin.inviteUserByEmail`, que solo existe
 * con la clave de servicio. Esa clave abre la base entera saltándose
 * las políticas, así que en el navegador no puede estar: se lee
 * mirando el código fuente. Vive en Netlify y aquí solo se la llama.
 *
 * ── Y POR QUÉ HAY UN PLAN B ─────────────────────────────────
 * En local no hay funciones de Netlify: `python serve.py` devuelve un
 * 404 y el administrador se quedaría sin poder invitar mientras
 * trabaja. Sin servidor se guarda la invitación igual —que es lo que
 * se hacía hasta ahora— y se dice que el correo no ha salido.
 *
 * @returns {{ok, estado, mensaje, invitacion}} — ver invitacion-envio.js
 */
export async function invitar({ email, rol = 'coach', equipos = [], nombre = null }) {
  /* Las mismas reglas por los dos caminos. Antes el plan B insertaba
     `rol` y `equipos` tal y como llegaban, y lo único que lo salvaba era
     el CHECK de la tabla: la validación del servidor era decorativa
     porque el otro camino no la aplicaba. */
  const limpia = saneaInvitacion({ email, rol, equipos, nombre });
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    try {
      const r = await fetch('/.netlify/functions/invitar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(limpia),
      });
      /* Un 404 es «aquí no hay funciones» (local); un 500 con cuerpo sí
         es una respuesta que hay que enseñar. Se distinguen porque solo
         el segundo trae JSON. */
      if (r.status !== 404) {
        const cuerpo = await r.json().catch(() => null);
        if (cuerpo) return resultadoDeInvitar(cuerpo);
      }
    } catch {
      // sin red o sin servidor: se sigue por el plan B
    }
  }

  // ── Plan B: guardar la invitación sin mandar nada ──
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('invitaciones')
    .insert({ ...limpia, invita: user?.id ?? null })
    .select(COLS)
    .single();
  if (error) throw error;
  return resultadoDeInvitar({
    ok: true, estado: 'sin_correo', email: limpia.email, invitacion: data,
    motivo: 'aquí no hay servidor de correo; en la web publicada sí',
  });
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
