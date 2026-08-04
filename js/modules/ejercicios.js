import { supabase } from '../supabase-client.js';

// ── Listado ──────────────────────────────────────────────

/* Tope de seguridad. PostgREST corta en 1000 filas SIN AVISAR, así que
   una biblioteca que crezca por encima se quedaría a medias en silencio
   y el entrenador buscaría un ejercicio que sí existe y no aparecería.
   Se pide uno de más: si vuelven TOPE+1, es que hay más y hay que
   paginar de verdad — y se dice en la consola en vez de disimularlo. */
const TOPE = 500;

/**
 * La biblioteca entera para la rejilla. El filtrado y la búsqueda son
 * de cliente (app.js) porque son instantáneos y hay que combinarlos:
 * el servidor solo recorta lo archivado.
 *
 * Antes esta consulta aceptaba `busqueda`, `type` y `category` y los
 * traducía a filtros de servidor que NADIE le pasaba nunca — app.js
 * llama a getEjercicios() sin argumentos y filtra por su cuenta. Eran
 * tres caminos muertos, y uno de ellos (ilike solo sobre `name`)
 * describía mal lo que la aplicación hace de verdad.
 */
export async function getEjercicios() {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, type, category, difficulty, dificultad_label, duration_min, description, tags, poster, created_by, created_at')
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(TOPE + 1);

  if (error) throw error;
  const filas = data ?? [];
  if (filas.length > TOPE) {
    console.warn(`[CBP] La biblioteca pasa de ${TOPE} ejercicios: la rejilla los está mostrando todos y hay que paginar.`);
  }
  return filas;
}

/* ── Crear, actualizar y archivar: NO viven aquí ──────────
   Se quitaron createEjercicio(), updateEjercicio() y
   archivarEjercicio(): ninguna tenía ya quien la llamara y las tres
   eran una segunda puerta a la misma tabla.

   Alta y edición pasan por el Taller (taller/js/supabase/ejercicios.js),
   que escribe la ficha ENTERA — animación, requisitos, objetivos,
   variantes, notas. La de aquí insertaba media docena de campos sueltos
   y dejaba un ejercicio sin pizarra ni requisitos, que es justo lo que
   la ficha nueva y el linter no pueden completar solos. Mantenerla era
   dejar una trampa cargada para el siguiente que pasara por aquí. */

// ── GIF de la miniatura (carga diferida en hover §19) ────

export async function getThumbnailGif(id) {
  const { data, error } = await supabase
    .from('exercises')
    .select('thumbnail')
    .eq('id', id)
    .single();
  if (error) return null;
  return data?.thumbnail || null;
}

