/* ============================================================
   perfil-foto.js — la foto del entrenador (migración 041).

   Calcado de equipo-archivos.js, que es como se sube un fichero a un
   bucket PRIVADO en esta app: subir con validación, pedir una URL
   firmada para verlo y borrar cuando se sustituye. Lo único distinto
   es de quién es la carpeta — aquí del usuario, no del equipo —, y eso
   ya lo decide la política de la 041.

   ── EL CONTRATO DE LA 006, QUE NO ES OPCIONAL ───────────────
   La 006 revocó el UPDATE de tabla sobre `profiles` y lo devolvió
   columna a columna, y lo dejó escrito: «un UPDATE a profiles debe
   enviar SOLO full_name en el SET; cualquier otra columna referenciada
   da permission denied».

   Por eso aquí se manda `{ foto_path }` y NADA más. Un
   `update({ ...perfil, foto_path })` referencia `role`, `full_name` y
   `created_at`, y muere con un 42501 aunque la 041 esté entera.

   Las reglas puras —qué se acepta, qué forma tiene la ruta y cuándo
   hay que apagar todo esto— están en perfil-foto-reglas.js, con banco.
   ============================================================ */

import { supabase } from './_client.js';
import { validarFoto, rutaFoto, falta041 } from './perfil-foto-reglas.js';

const BUCKET = 'perfiles';

/**
 * Sube la foto y devuelve su ruta. No toca `profiles`: guardar la ruta
 * es el paso siguiente y puede fallar por su cuenta (ver `guardarRuta`).
 */
export async function subirFotoPerfil(userId, file) {
  const v = validarFoto(file);
  if (!v.ok) throw new Error(v.error);
  const path = rutaFoto(userId, crypto.randomUUID(), v.ext);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  return path;
}

/** URL firmada para verla. El bucket es privado: no hay URL fija. */
export async function urlFotoPerfil(path, segundos = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, segundos);
  if (error) throw error;
  return data?.signedUrl || null;
}

/** Borra el fichero del bucket. Un fallo aquí no es grave: no se ve. */
export async function borrarFotoPerfil(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

/**
 * Escribe la ruta en `profiles`. `null` quita la foto.
 *
 * @returns {{guardado: boolean, sin041: boolean}} — `guardado:false` con
 *   `sin041:true` NO es un error que haya que gritar: es la 041 sin
 *   aplicar. Quien llama tiene que recoger el fichero que acaba de
 *   subir, porque en un bucket privado un huérfano no se puede borrar
 *   después: nadie conoce su nombre.
 */
export async function guardarRutaFoto(userId, path) {
  // SOLO esta columna. Ver la cabecera: es el contrato de la 006.
  const { error } = await supabase
    .from('profiles')
    .update({ foto_path: path })
    .eq('id', userId);

  if (!error) return { guardado: true, sin041: false };
  if (falta041(error)) return { guardado: false, sin041: true };
  throw error;
}
