/* ============================================================
   _quien-llama.mjs — quién está llamando a una función de servidor.
   Módulo PURO: no toca la red, no lee `process.env`, no decide nada
   sobre Supabase. Solo mira la FORMA de la petición.

   Lo usan las dos funciones que sostienen la clave de servicio, y hay
   banco (tools/eval-quien-llama.mjs) porque de esto depende que el club
   siga recibiendo avisos.

   ── EL PROBLEMA QUE RESUELVE ────────────────────────────────
   `invitar.mjs` la llama una persona con sesión, así que puede exigir
   un token. `avisos.mjs` la llama el PLANIFICADOR de Netlify cada diez
   minutos, y un planificador no tiene sesión ni puede llevar cabeceras
   propias: pedirle un token es apagarle los avisos al club.

   Así que no se puede aplicar «la misma comprobación». Lo que se hace
   es distinguir tres formas de llamada y que cada función decida qué
   acepta.

   ── LA REGLA DE ORO: ANTE LA DUDA, SE DEJA PASAR ────────────
   Los dos errores posibles NO cuestan lo mismo.

     · Dejar entrar a un desconocido cuesta cupo de Netlify y de
       Supabase, y que se vean tres recuentos. No puede acosar a nadie:
       el índice único de la 031 hace que una segunda pasada seguida no
       tenga nada que mandar.
     · Cerrarle la puerta al planificador cuesta que el club deje de
       recibir avisos, en silencio y hasta que alguien se dé cuenta de
       que lleva semanas sin saltarle el móvil.

   El segundo es mucho peor, así que cuando no se puede saber quién
   llama —un entorno que no pasa la petición, un cuerpo ilegible— se
   responde `planificador`. Es una decisión, no un descuido.
   ============================================================ */

/**
 * @param peticion  el Request de la función, o nada
 * @param cuerpo    el cuerpo ya leído (o null si no se pudo)
 * @returns {{quien: 'planificador'|'con-token'|'anonimo', token: string|null, porque: string}}
 */
export function comoLlaman(peticion, cuerpo = null) {
  /* Sin objeto de petición no hay nada que mirar. Pasa en las
     invocaciones programadas de algunos entornos de Netlify, donde el
     manejador se llama sin argumentos — que es justo como estaba
     escrito `avisos.mjs` hasta ahora. */
  if (!peticion || typeof peticion.headers?.get !== 'function') {
    return { quien: 'planificador', token: null, porque: 'sin objeto de petición' };
  }

  /* La marca del planificador de Netlify: una llamada suya trae
     `next_run` en el cuerpo, que es cuándo toca la siguiente. Nadie de
     fuera gana nada falsificándolo —lo peor que consigue es lo mismo
     que consigue ahora— y a cambio esto no puede dejar al club sin
     avisos por un cambio de formato. */
  if (cuerpo && typeof cuerpo === 'object' && 'next_run' in cuerpo) {
    return { quien: 'planificador', token: null, porque: 'trae next_run' };
  }

  const cabecera = peticion.headers.get('authorization') || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
  /* Tres tramos separados por puntos: la forma de un JWT. Lo que ni
     siquiera la tiene se descarta ANTES de salir a la red, para que un
     bucle de peticiones basura no cueste una consulta a Supabase por
     cada una. */
  if (token && token.split('.').length === 3) {
    return { quien: 'con-token', token, porque: 'trae un Bearer con forma de JWT' };
  }

  return { quien: 'anonimo', token: null, porque: token ? 'el Bearer no tiene forma de JWT' : 'sin Authorization' };
}

/** Lee el cuerpo sin reventar si no es JSON. */
export async function cuerpoDe(peticion) {
  if (!peticion || typeof peticion.json !== 'function') return null;
  try { return await peticion.json(); } catch { return null; }
}
