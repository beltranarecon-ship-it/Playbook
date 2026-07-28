/* ============================================================
   ejercicios.js — lectura de la biblioteca del Taller desde el
   módulo Sesiones. La tabla public.exercises es COMPARTIDA y su
   lectura es global para autenticados (001), así que no hay filtro
   por equipo: lo único que se recorta es el archivado.

   Dos consultas distintas a propósito:
   · getEjerciciosSugeribles() (objectives.js) → columnas mínimas de
     TODA la biblioteca, para buscar y rankear. Se pide una vez.
   · getEjercicioCompleto(id) → la ficha entera de UNO, incluida la
     animación. Se pide solo cuando el entrenador abre ese ejercicio.

   La animación es un jsonb que puede pesar decenas de kB; traerla
   para los 300 ejercicios de la biblioteca solo para enseñar uno
   sería tirar el ancho de banda del pabellón.
   ============================================================ */

import { supabase } from './_client.js';

// Todo menos poster/thumbnail: son data-URI de imagen y no se pintan
// aquí (el visor dibuja la animación de verdad, no una miniatura).
const COLS_FICHA = [
  'id', 'name', 'type', 'category', 'difficulty', 'dificultad_label',
  'duration_min', 'duration_max', 'intensidad', 'description',
  'descripcion_texto', 'objetivos', 'variantes', 'notas', 'tags',
  'requisitos', 'animacion', 'tipo_pista', 'categoria_rama',
  'categoria_nivel', 'autor_nombre', 'favorito',
].join(', ');

/* Caché por id para toda la vida de la página: dentro del
   planificador se salta de un bloque a otro constantemente y volver
   a pedir la misma ficha en cada clic haría la navegación pegajosa.
   Se guarda la PROMESA, no el dato: dos clics rápidos sobre el mismo
   ejercicio comparten una sola petición. */
const cache = new Map();

/** Ficha completa de un ejercicio (con animación). Cachea por id. */
export function getEjercicioCompleto(id) {
  if (!id) return Promise.reject(new Error('Sin id de ejercicio'));
  if (cache.has(id)) return cache.get(id);
  const p = supabase
    .from('exercises').select(COLS_FICHA).eq('id', id).maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data) throw new Error('NO_EXISTE');
      return data;
    })
    .catch((e) => { cache.delete(id); throw e; });  // un fallo no se cachea
  cache.set(id, p);
  return p;
}

/** Olvida la ficha cacheada (tras editarla en el Taller, por ejemplo). */
export function olvidarEjercicio(id) { cache.delete(id); }
