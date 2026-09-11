/* ============================================================
   pizarra/motor/marca.js — ¿esta animación la ha hecho la Pizarra?
   (ESPEC-PIZARRA-v3 §11.4)

   Módulo PURO y sin dependencias, a propósito: lo leen la ficha, el
   proyector, el visor de Equipos y la biblioteca, y ninguno tiene por
   qué cargar el compilador entero para saber esto. Lo prueba en Node
   taller/tools/eval-compilar.mjs.

   ── LO GUARDADO ANTES DE LA PIZARRA ─────────────────────────
   Las animaciones de antes salían del motor viejo, que se borra entero.
   Ya no se reproducen: se ve su COLOCACIÓN INICIAL, quieta, y se ofrece
   rehacerlas en la Pizarra. Se conservan la ficha, los metadatos, las
   etiquetas y la miniatura estática.

   ── POR QUÉ UNA MARCA DENTRO Y NO LA COLUMNA `jugada` ────────
   La columna la trae la 043, que se aplica a mano: hasta entonces todo
   lo nuevo se guardaría sin ella y pasaría por viejo. La marca viaja
   dentro de la animación, que se guarda siempre.
   ============================================================ */

/** La marca que pone `compilar` en toda animación de la Pizarra. */
export const MOTOR_PIZARRA = 3;

/** ¿La ha compilado la Pizarra? */
export const esDeLaPizarra = (anim) => !!anim && typeof anim === 'object' && anim.motor === MOTOR_PIZARRA;

/** La misma escena, sin nada que reproducir: lo que queda de una
 *  animación de antes. Sin `rondas`, que solo sirven para repetir fases. */
export function soloColocacion(anim) {
  if (!anim || typeof anim !== 'object') return anim ?? null;
  const { rondas: _rondas, ...escena } = anim;
  return { ...escena, fases: [] };
}

/** Lo que se enseña de una animación guardada: entera si es de la
 *  Pizarra; si es de antes, solo su colocación. No toca la guardada. */
export const paraVer = (anim) => (esDeLaPizarra(anim) ? anim : soloColocacion(anim));

/**
 * ¿Es de antes de la Pizarra Y se movía? Solo entonces hay algo que
 * decir: un ejercicio de antes guardado sin animación no ha perdido
 * nada, y un aviso ahí solo haría dudar.
 */
export const perdioLaAnimacion = (anim) => !!anim && typeof anim === 'object'
  && !esDeLaPizarra(anim) && Array.isArray(anim.fases) && anim.fases.length > 0;
