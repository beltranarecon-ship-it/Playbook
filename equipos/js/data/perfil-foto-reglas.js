/* ============================================================
   perfil-foto-reglas.js — las reglas de la foto de perfil.
   Módulo PURO: sin red, sin DOM. Lo importan perfil-foto.js y el banco.

   ── POR QUÉ ESTO ESTÁ SUELTO DEL RESTO ──────────────────────
   Por el detector de «esa columna no existe». Es la pieza que ya ha
   fallado antes en esta casa: apagar el grupo de columnas equivocado
   deja de guardar algo que funcionaba (está contado en blocks.js, con
   la 040 y su interruptor propio). Suelto se puede comprobar en un
   banco, y comprobado deja de dar sustos.

   ── LOS TRES CAMINOS POR LOS QUE ESTO SE APAGA ──────────────
   Sin la 041 la foto puede fallar de tres formas distintas, y las tres
   significan lo mismo —«esto todavía no está puesto»—:

     42703    la columna no existe;
     PGRST204 PostgREST no la encuentra en su caché de esquema;
     42501    existe pero `authenticated` no puede escribirla. Éste es el
              de verdad traicionero: lo provoca la 006, que revocó el
              UPDATE de tabla sobre `profiles` y lo devolvió columna a
              columna. Una columna nueva nace sin permiso, así que la
              RLS se ve bien, el SELECT la devuelve… y guardar contesta
              que no. Si la 041 se aplica sin su GRANT, se cae aquí.

   Y una cosa que NO puede apagar nada: un error que no NOMBRE la
   columna. Un 42501 pelado es una sesión caducada, no una migración que
   falta, y confundirlos esconde el problema de verdad.
   ============================================================ */

/** Lo que el bucket 'perfiles' acepta (041). Cliente y bucket, iguales. */
export const TIPOS_FOTO = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/* Cinco megas, el mismo tope que el bucket. Si el del cliente fuera más
   ancho, el rechazo llegaría del servidor con un mensaje en inglés que
   no dice nada; así se avisa aquí y en castellano. */
export const TOPE_FOTO = 5 * 1024 * 1024;

/**
 * ¿Vale este fichero como foto?
 * @returns {{ok: boolean, error: string|null, ext: string|null}}
 */
export function validarFoto(file) {
  if (!file) return { ok: false, error: 'No has elegido ninguna foto.', ext: null };
  const ext = TIPOS_FOTO[file.type];
  if (!ext) {
    return {
      ok: false,
      ext: null,
      error: `La foto tiene que ser ${Object.values(TIPOS_FOTO).join(', ')}.`,
    };
  }
  if (Number(file.size) > TOPE_FOTO) {
    return { ok: false, ext: null, error: 'La foto pesa más de 5 MB.' };
  }
  return { ok: true, error: null, ext };
}

/**
 * La ruta dentro del bucket. El uuid se pasa desde fuera para que esto
 * siga siendo puro y comprobable.
 *
 * La primera carpeta ES el permiso: `storage_owner_id` (041) saca de ahí
 * el uuid del dueño y la política compara con auth.uid(). Una ruta con
 * otra forma no es un fallo de estilo, es una subida denegada.
 */
export function rutaFoto(userId, uuid, ext) {
  if (!userId || !uuid || !ext) return null;
  return `${userId}/${uuid}.${ext}`;
}

const texto = (error) => `${error?.message || ''} ${error?.details || ''}`.toLowerCase();

/**
 * ¿Este error significa «la 041 no está puesta»?
 *
 * Exige que el error NOMBRE `foto_path`. Es a propósito: sin esa
 * condición, cualquier permiso denegado —una sesión caducada, por
 * ejemplo— apagaría la foto para el resto de la sesión y el entrenador
 * vería «falta una migración» ante un problema que no tiene nada que ver.
 */
export function falta041(error) {
  if (!error) return false;
  if (!texto(error).includes('foto_path')) return false;
  const code = error.code || '';
  return code === '42703' || code === 'PGRST204' || code === '42501'
    || texto(error).includes('column');
}

/** ¿Y este otro significa «el bucket 'perfiles' todavía no existe»? */
export function faltaBucket(error) {
  if (!error) return false;
  return texto(error).includes('bucket not found');
}

/**
 * Qué enseñar en la zona de la foto. Separa los dos «no» que se
 * confunden con facilidad:
 *   · `perfil === null` es NO LO SÉ — la lectura del perfil falló, que
 *     pasa con la red del pabellón. Decir ahí «falta la migración 041»
 *     sería mentir con mucha seguridad.
 *   · el perfil llega pero sin `foto_path` es NO ESTÁ.
 *
 * @returns 'cargando' | 'sin_perfil' | 'sin_migracion' | 'lista'
 */
export function estadoFoto(perfil, sin041 = false) {
  if (perfil === undefined) return 'cargando';
  if (perfil === null) return 'sin_perfil';
  if (sin041 || !('foto_path' in perfil)) return 'sin_migracion';
  return 'lista';
}
