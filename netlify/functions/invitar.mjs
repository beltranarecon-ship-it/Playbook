/* ============================================================
   invitar.mjs — manda la invitación por correo.

   POST /.netlify/functions/invitar
     cabecera: Authorization: Bearer <token de sesión del administrador>
     cuerpo:   { email, rol, equipos, nombre }

   ── POR QUÉ HAY UNA FUNCIÓN DE SERVIDOR ─────────────────────
   Hasta ahora invitar era una fila en una tabla: el administrador
   escribía el correo y tenía que avisar a esa persona por su cuenta.
   Estaba decidido así (decisión #31) justo para NO tener que meter una
   clave con permisos en ningún sitio.

   Mandar el correo cambia eso, porque `auth.admin.inviteUserByEmail`
   solo existe con la CLAVE DE SERVICIO, y esa clave abre la base
   entera saltándose las políticas. En el navegador no puede estar: se
   lee mirando el código fuente de la página. Así que vive aquí, en una
   variable de entorno de Netlify, y el navegador solo habla con esta
   función.

   ── QUIÉN PUEDE LLAMARLA ────────────────────────────────────
   Solo un administrador con sesión abierta, y se comprueba DOS veces:

     1. que el token que trae sea un token válido de este proyecto
        (se lo preguntamos a Supabase, no lo decodificamos aquí);
     2. que ese usuario tenga `role = 'admin'` en `profiles`.

   La segunda no sobra: cualquiera con cuenta en el club tiene un token
   válido. Sin ella, un entrenador podría invitar a quien quisiera —y
   como administrador— llamando a esta URL a mano.

   ── EL ORDEN IMPORTA ────────────────────────────────────────
   Primero se guarda la invitación y DESPUÉS se manda el correo. No al
   revés: `inviteUserByEmail` crea la cuenta en `auth.users`, y eso
   dispara `handle_new_user` (032), que comprueba que el correo esté en
   la lista de invitados y RECHAZA el alta si no está. Invitando antes
   de guardar, el disparador tumbaría su propia invitación.

   Y si el correo falla, la invitación se queda. Es lo correcto: esa
   persona puede darse de alta igualmente con «Tengo invitación y es mi
   primera vez». Lo que se devuelve dice cuál de los dos ha pasado.
   ============================================================ */

import { createClient } from '@supabase/supabase-js';
/* Las mismas reglas que aplica el navegador cuando esta funcion no
   esta (el plan B de invitaciones.js). Se IMPORTAN en vez de
   copiarse: con dos copias, lo que entre por el camino que no
   valida acaba igual en la tabla. El modulo no toca la red ni el
   DOM, asi que vale en los dos lados — avisos.mjs ya hace lo mismo
   con equipos/js/data/avisos.js. */
import { saneaInvitacion, correoValido } from '../../equipos/js/data/invitacion-envio.js';

const JSONR = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});


/* Los motivos por los que Supabase no manda un correo, traducidos. De
   cuál sea depende qué hay que ir a configurar, así que NO se aplastan
   todos en un «no se pudo enviar». */
function motivoDeCorreo(error) {
  const m = `${error?.message || error || ''}`.toLowerCase();
  if (/rate limit|too many|429/.test(m)) return 'Supabase limita los correos por hora; prueba dentro de un rato';
  if (/smtp|email provider|sending|not configured/.test(m)) return 'falta configurar el envío de correo en Supabase';
  if (/redirect|not allowed|url/.test(m)) return 'la dirección de vuelta no está en la lista blanca de Supabase';
  return error?.message || 'motivo desconocido';
}

export default async function handler(req) {
  if (req.method !== 'POST') return JSONR({ ok: false, motivo: 'Solo POST.' }, 405);

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, URL: SITIO, DEPLOY_PRIME_URL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    /* Sin la clave no se puede hacer nada, y hay que decir cuál falta:
       este error se lee una sola vez, el día del despliegue. */
    const faltan = [!SUPABASE_URL && 'SUPABASE_URL', !SUPABASE_SERVICE_ROLE && 'SUPABASE_SERVICE_ROLE'].filter(Boolean);
    return JSONR({ ok: false, estado: 'fallo', motivo: `falta configurar ${faltan.join(' y ')} en Netlify` }, 500);
  }

  /* Manda la URL CANÓNICA del sitio, no la del despliegue.
     `DEPLOY_PRIME_URL` cambia en cada rama de vista previa
     (deploy-preview-3--sitio.netlify.app), y esas direcciones no están
     —ni deben estar— en la lista blanca de Supabase: obligaría a meter
     un comodín, que es abrir la puerta a que un enlace de invitación
     lleve a cualquier subdominio. Solo se usa si no hay otra. */
  const base = (SITIO || DEPLOY_PRIME_URL || '').replace(/\/$/, '');

  // ── 1. ¿Quién llama? ──────────────────────────────────────
  const cabecera = req.headers.get('authorization') || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
  /* Se descarta aquí lo que ni siquiera tiene FORMA de JWT —tres
     tramos separados por puntos— antes de salir a la red. Sin esto, un
     bucle con `Bearer x` desde cualquier sitio provoca una consulta a
     Supabase por cada llamada: no consigue nada, pero quema el cupo del
     proyecto, y quedarse sin cupo es quedarse sin poder entrar. */
  if (!token || token.split('.').length !== 3) {
    return JSONR({ ok: false, estado: 'fallo', motivo: 'Hace falta una sesión.' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: quien, error: errUser } = await admin.auth.getUser(token);
  if (errUser || !quien?.user) {
    return JSONR({ ok: false, estado: 'fallo', motivo: 'La sesión no vale o ha caducado.' }, 401);
  }

  const { data: perfil, error: errPerfil } = await admin
    .from('profiles').select('role').eq('id', quien.user.id).single();
  if (errPerfil || perfil?.role !== 'admin') {
    /* Se responde lo mismo tanto si no es admin como si no tiene perfil:
       esta URL no tiene por qué contar quién es quién en el club. */
    return JSONR({ ok: false, estado: 'fallo', motivo: 'Solo el administrador puede invitar.' }, 403);
  }

  // ── 2. ¿Qué se pide? ──────────────────────────────────────
  let cuerpo;
  try { cuerpo = await req.json(); } catch { cuerpo = null; }
  /* `correoValido` comprueba forma Y tamaño. El tope importa porque
     `[^\s@]+` acepta un correo de cien mil caracteres; y el `\s` de esa
     expresión es lo que impide colar un salto de línea en la dirección,
     que es como se inyectan cabeceras en un correo. */
  if (!correoValido(cuerpo?.email)) {
    return JSONR({ ok: false, estado: 'fallo', motivo: 'Eso no parece un correo.' }, 400);
  }
  const { email, rol, equipos, nombre } = saneaInvitacion(cuerpo);

  // ── 3. La invitación, ANTES del correo ────────────────────
  /* `upsert` y no `insert`: reinvitar a alguien que ya estaba en la
     lista tiene que servir para volver a mandarle el correo, que es
     justo lo que se hace cuando alguien dice «no me ha llegado».

     `onConflict: 'email'` necesita un índice único sobre esa COLUMNA.
     La 032 lo había puesto sobre `lower(trim(email))` —una expresión— y
     contra eso ON CONFLICT no puede resolverse: fallaba en TODAS las
     invitaciones. Lo mueve la 039, que además garantiza con un CHECK
     que la columna esté siempre normalizada, que es lo que hacía falta
     para que el índice pelado proteja lo mismo que el de expresión. */
  const { data: invitacion, error: errInv } = await admin
    .from('invitaciones')
    .upsert({ email, rol, equipos, nombre, invita: quien.user.id }, { onConflict: 'email' })
    .select('id, email, rol, equipos, nombre, usada_at, created_at')
    .single();

  if (errInv) {
    if (errInv.code === '42P01' || errInv.code === 'PGRST205') {
      return JSONR({ ok: false, estado: 'fallo', email, motivo: 'Falta aplicar la migración 032 en Supabase.' }, 500);
    }
    if (errInv.code === '42P10' || /no unique or exclusion constraint/i.test(errInv.message || '')) {
      /* El upsert apunta a `email` y necesita un índice único sobre esa
         columna. La 032 lo dejó sobre lower(trim(email)) —una expresión—
         y ahí ON CONFLICT no puede resolverse. Lo arregla la 039. */
      return JSONR({ ok: false, estado: 'fallo', email, motivo: 'Falta aplicar la migración 039 en Supabase.' }, 500);
    }
    /* El mensaje crudo de PostgreSQL cuenta nombres de restricciones y
       de columnas. Va al registro de Netlify, donde sirve para
       arreglarlo, y no a una pantalla, donde solo asusta. */
    console.error('[invitar] fallo al guardar la invitación:', errInv.code, errInv.message);
    return JSONR({ ok: false, estado: 'fallo', email, motivo: 'No se ha podido guardar la invitación. El motivo está en el registro de Netlify.' }, 500);
  }

  // ── 4. El correo ──────────────────────────────────────────
  /* `?nueva=1` lo lee clave.html para cambiar el texto: quien viene de
     una invitación no está poniendo una contraseña «nueva», está
     poniendo la primera. */
  const volverA = `${base}/clave.html?nueva=1`;
  const { error: errMail } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: volverA,
    data: nombre ? { full_name: nombre } : undefined,
  });

  if (!errMail) return JSONR({ ok: true, estado: 'enviado', email, invitacion });

  /* Cuenta ya existente: Supabase se niega a invitar, y hace bien. No
     es un fallo — esa persona ya puede entrar — así que se dice tal
     cual en vez de dejar al administrador esperando un correo. */
  const yaEsta = /already been registered|already registered|user already exists/i.test(errMail.message || '');
  if (yaEsta) return JSONR({ ok: true, estado: 'ya_registrado', email, invitacion });

  /* Cualquier otro fallo del correo NO tumba la invitación: está
     guardada y esa persona puede darse de alta por su cuenta. Se
     devuelve `ok` con el motivo, para que la pantalla diga qué hacer. */
  return JSONR({ ok: true, estado: 'sin_correo', email, invitacion, motivo: motivoDeCorreo(errMail) });
}
