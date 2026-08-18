/* ============================================================
   ia/molde.js — el borrador del Taller, visto como una ficha de la
   biblioteca (Tramo 2.12). Módulo PURO: sin DOM, sin red.

   ── EL PROBLEMA ─────────────────────────────────────────────
   El paso 3 tenía tres cajas de texto y un conteo de fichas. La
   biblioteca pide veinte campos. Consecuencia doble y silenciosa: un
   ejercicio hecho en el Taller no pasaba su propio linter, y al lado
   de los 204 importados se veía medio vacío — sin organización para
   doce, sin los tres niveles, sin criterio de éxito. La ficha no
   mentía: es que no se le había preguntado.

   ── LO QUE HACE ─────────────────────────────────────────────
   Traduce el borrador a la forma que espera el linter y lo pasa por
   él. Dos capas: la FICHA (campos y vocabulario) y la GEOMETRÍA (la
   animación ya compilada). La tercera —el conjunto— no aplica: un
   ejercicio que se está escribiendo no puede evaluar las
   proporciones de una biblioteca en la que todavía no está.

   Las reglas son LAS MISMAS que corren sobre las 204 (ia/lint.js).
   Ese es todo el punto: lo que aquí sale en verde, entra.
   ============================================================ */

import { revisaFicha, revisaGeometria } from './lint.js';
import { BLOQUES, MATERIAL_SUGERIDO } from './vocabulario.js';

/**
 * El borrador con los nombres que usa la biblioteca.
 *
 * Los dos vocabularios existen por historia —el Taller nació con
 * `nombre`/`dificultad_valor` y la biblioteca con `name`/`difficulty`—
 * y unificarlos tocaría las 204 fichas, el importador y la tabla. La
 * traducción vive aquí, en un sitio, y es la que usan tanto el linter
 * del paso 3 como lo que se guarda.
 */
export function fichaDeBorrador(d) {
  return {
    name: (d.nombre || '').trim(),
    type: d.tipo,
    category: d.category,
    tipo_pista: d.tipo_pista,
    categoria_rama: d.categoria_rama,
    categoria_nivel: d.categoria_nivel || [],
    difficulty: d.dificultad_valor,
    intensidad: d.intensidad,
    duration_min: d.duracion_min,
    duration_max: d.duracion_max,
    description: d.description,
    objetivos: d.objetivos,
    descripcion_texto: d.descripcion_texto,
    notas: d.notas,
    tags: d.tags || [],
    requisitos: d.requisitos,
    animacion: d.animacion,
  };
}

/**
 * Lo que el linter de la biblioteca diría de este borrador.
 *
 * `sinAnimacion` no es un aviso que haya que enseñar mientras se
 * escribe: hay ejercicios que a propósito no llevan animación (juego
 * abierto, trabajo en el sitio), y el paso 2 ya dice lo suyo. Se
 * filtra aquí para que el panel no repita lo que no es un problema.
 */
export function revisarBorrador(d) {
  const f = fichaDeBorrador(d);
  const a = revisaFicha(f);
  const b = revisaGeometria(f);
  return {
    errores: [...a.errores, ...b.errores],
    avisos: [...a.avisos, ...b.avisos].filter((x) => !/^sin animación/.test(x)),
  };
}

/* ── Lo que se puede rellenar solo ─────────────────────────── */

/**
 * Propone requisitos a partir de lo que hay dibujado. Son un punto de
 * partida, no una respuesta: el número de jugadores del tablero es la
 * MUESTRA (dos, tres, los justos para que se entienda), y el grupo de
 * verdad son doce. Por eso el máximo se propone al alza y la
 * organización se deja en blanco: ese hueco lo tiene que rellenar
 * quien tiene el grupo delante.
 */
export function requisitosSugeridos(counts = {}, previos = {}) {
  const enPista = Math.max(1, counts.jugadores || 0);
  const material = [];
  if (counts.balones) material.push('balones');
  if (counts.conos) material.push('conos');
  if (counts.material) material.push('material auxiliar');
  return {
    ...previos,
    jugadores_min: previos.jugadores_min || enPista,
    jugadores_max: previos.jugadores_max || Math.max(enPista, 12),
    material: (previos.material || []).length ? previos.material : material,
  };
}

/** Los bloques de contenido, para los chips del paso 3. */
export const BLOQUES_CONTENIDO = BLOQUES;

/** Material que se ofrece marcar. Se puede escribir cualquier otro. */
export const MATERIAL = MATERIAL_SUGERIDO;
