/* ============================================================
   invitacion-envio.js — QUÉ HA PASADO AL INVITAR, DICHO EN CASTELLANO.
   Módulo PURO: sin DOM, sin red, sin supabase.

   ── POR QUÉ EXISTE ──────────────────────────────────────────
   Invitar pasó de ser una fila en una tabla a ser una fila MÁS un
   correo, y el correo puede fallar por su cuenta sin que la invitación
   deje de valer. Son cuatro finales distintos y a la persona que está
   delante del botón le cambian lo que tiene que hacer después:

     · se ha mandado          → no hay que hacer nada más
     · no se ha podido mandar → la invitación vale igual; hay que
                                avisar a esa persona por WhatsApp
     · ya tenía cuenta        → no hace falta invitación: que entre
     · no ha entrado          → no está invitado, y hay que repetirlo

   Decir «Invitado» en los cuatro casos —que es lo que haría un `catch`
   genérico— deja al administrador esperando un correo que no salió.

   ── LO QUE ESTO NO HACE ─────────────────────────────────────
   No manda nada. Solo traduce. Mandar es cosa de la función de
   servidor, que es la única que puede tener la clave de servicio.
   ============================================================ */

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

/** Los finales posibles. Se exportan para que el banco no los invente. */
export const ESTADOS = ['enviado', 'sin_correo', 'ya_registrado', 'fallo'];

/**
 * Traduce la respuesta de la función `invitar` a lo que se enseña.
 *
 * @param r respuesta ya parseada { ok, estado, email, motivo, invitacion }
 * @returns {{ok:boolean, estado:string, mensaje:string, invitacion:object|null}}
 */
export function resultadoDeInvitar(r) {
  const email = String(r?.email || '').trim().toLowerCase();
  const quien = email ? `a ${email}` : '';
  const inv = r?.invitacion ?? null;

  if (r?.estado === 'enviado') {
    return {
      ok: true, estado: 'enviado', invitacion: inv,
      mensaje: `Invitación mandada ${quien}. Le llega un correo con un enlace para poner su contraseña.`.replace('  ', ' '),
    };
  }

  if (r?.estado === 'ya_registrado') {
    /* No es un fallo: esa persona ya puede entrar. Lo que NO hay que
       hacer es dejarla esperando un correo de invitación que Supabase
       no manda a una cuenta que ya existe. */
    return {
      ok: true, estado: 'ya_registrado', invitacion: inv,
      mensaje: `${email || 'Ese correo'} ya tiene cuenta: puede entrar directamente. `
        + 'Si no se acuerda de la contraseña, que use «¿No te acuerdas de la clave?».',
    };
  }

  if (r?.estado === 'sin_correo') {
    /* El caso que más importa contar bien: la invitación SÍ está
       guardada y esa persona puede darse de alta ella misma. Lo único
       que falta es avisarla, y eso ahora le toca al administrador. */
    return {
      ok: true, estado: 'sin_correo', invitacion: inv,
      mensaje: `Invitación guardada, pero el correo no ha salido${r?.motivo ? ` (${r.motivo})` : ''}. `
        + 'Avísale tú: puede entrar con «Tengo invitación y es mi primera vez».',
    };
  }

  return {
    ok: false, estado: 'fallo', invitacion: inv,
    mensaje: r?.motivo || 'No se ha podido invitar y no ha dicho por qué.',
  };
}

/**
 * Lo que devuelve el servidor de Supabase cuando no puede mandar el
 * correo, traducido. Se queda con el motivo REAL —no se inventa uno
 * bonito— porque de estos tres depende qué hay que ir a configurar.
 */
export function motivoDeCorreo(error) {
  const m = `${error?.message || error || ''}`.toLowerCase();
  if (/rate limit|too many|429/.test(m)) {
    return 'Supabase limita los correos por hora; prueba dentro de un rato';
  }
  if (/smtp|email provider|sending|not configured/.test(m)) {
    return 'falta configurar el envío de correo en Supabase';
  }
  if (/redirect|not allowed|url/.test(m)) {
    return 'la dirección de vuelta no está en la lista blanca de Supabase';
  }
  return error?.message || 'motivo desconocido';
}
