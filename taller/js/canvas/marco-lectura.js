/* ============================================================
   marco-lectura.js — recolocar una ficha guardada en un dibujo
   ANTERIOR de la pista. Módulo PURO: sin DOM, sin red.

   ── EL PROBLEMA ─────────────────────────────────────────────
   Las coordenadas de una ficha son NORMALIZADAS: (0,5, 0,5) significa
   «a la mitad del lienzo», no «en el centro del campo». Cuando el
   lienzo cambia de tamaño, el mismo número señala otro sitio de la
   pista.

   Al cambiar a las pistas dibujadas a mano, el lienzo de la entera
   pasó de 19 × 32 m a 18 × 27. Medido: una ficha guardada en el centro
   del campo se pinta 2,55 m más allá, y una en la banda, 2,66. Eso es
   un jugador entero de distancia — el ejercicio deja de decir lo que
   decía.

   ── POR QUÉ AQUÍ Y NO EN LA BASE DE DATOS ───────────────────
   Se puede arreglar convirtiendo las filas una vez y para siempre
   (`migrar-marco-3-base.mjs`), y es lo correcto cuando ya no queda
   nada que rehacer. Pero mientras el entrenador rehace sus fichas a
   mano, una migración obliga a elegir: o se convierte todo, o se ve
   todo torcido.

   Convirtiendo AL LEER no hay que elegir. La base no se toca, las
   fichas viejas se ven donde deben, las nuevas se guardan ya en el
   dibujo de ahora, y el día que no quede ninguna vieja esto se puede
   borrar sin más.

   ── CÓMO SABE CUÁL ES CUÁL ──────────────────────────────────
   Por `exercises.marco` (migración 038). SIN esa columna no se toca
   nada: es preferible dejarlo como está hoy a recolocar una ficha que
   ya estaba bien, que sería moverla dos veces y sin vuelta atrás.
   ============================================================ */

/** El dibujo de pista en el que se guarda a partir de ahora. */
export const MARCO_ACTUAL = 3;

/* Los límites de cancha del marco 2, en coordenada normalizada. Se
   escriben como la fracción de la que salen para poder comprobarlos de
   un vistazo: lienzo 19 × 32 la entera (cancha 15 × 28 + 2 de banda) y
   18 × 19 las medias. */
const ENTERA_2 = { x: [2 / 19, 17 / 19], y: [2 / 32, 30 / 32] };
const MEDIA_2 = { x: [2 / 18, 16 / 18], y: [2 / 19, 17 / 19] };
const VIEJO = {
  entera: ENTERA_2, entera_fiba: ENTERA_2,
  media: MEDIA_2, media_fiba: MEDIA_2,
};

/** Recta que lleva [o0,o1] a [n0,n1]. */
const recta = ([o0, o1], [n0, n1]) => (v) => n0 + ((v - o0) * (n1 - n0)) / (o1 - o0);
const ajusta = (v) => Number(Math.min(1, Math.max(0, v)).toFixed(4));

/**
 * El mapa de un marco al actual, para una pista.
 * @param limitesActuales `limitesCancha(pista)` — se pasa en vez de
 *   importarse para que este módulo no dependa de medidas.js y el banco
 *   pueda comprobarlo con números a mano.
 */
export function mapaDe(pista, limitesActuales) {
  const viejo = VIEJO[pista];
  if (!viejo || !limitesActuales) return null;
  return {
    x: recta(viejo.x, limitesActuales.x),
    y: recta(viejo.y, limitesActuales.y),
  };
}

/**
 * Convierte, EN SITIO, todo objeto con `x` e `y` numéricos, y también
 * los pares `[x, y]` de las claves que los usan.
 *
 * La regla es ESTRUCTURAL y no una lista de campos: una lista se queda
 * corta en cuanto alguien añade uno, y lo que se queda sin convertir no
 * avisa — se ve como un cono suelto en mitad de la pista.
 */
function convertir(nodo, f, cuenta = { n: 0 }) {
  if (!nodo || typeof nodo !== 'object') return cuenta.n;

  if (Array.isArray(nodo)) {
    for (const v of nodo) convertir(v, f, cuenta);
    return cuenta.n;
  }

  if (typeof nodo.x === 'number' && typeof nodo.y === 'number') {
    nodo.x = ajusta(f.x(nodo.x));
    nodo.y = ajusta(f.y(nodo.y));
    cuenta.n += 1;
  }

  /* `posicion_inicial: [x, y]` y `posicion: [x, y]` son pares, no
     objetos: el recorrido de arriba los vería como dos números sueltos
     y no los tocaría. Son justo donde están los jugadores, los balones
     y los conos, o sea casi todo lo que se ve. */
  for (const clave of ['posicion_inicial', 'posicion']) {
    const p = nodo[clave];
    if (Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number') {
      nodo[clave] = [ajusta(f.x(p[0])), ajusta(f.y(p[1]))];
      cuenta.n += 1;
    }
  }

  for (const [k, v] of Object.entries(nodo)) {
    if (k === 'posicion_inicial' || k === 'posicion') continue;
    convertir(v, f, cuenta);
  }
  return cuenta.n;
}

/**
 * La animación de una ficha, recolocada al dibujo de ahora.
 *
 * @param animacion  el JSON §10 tal y como viene de la base
 * @param marco      `exercises.marco`; sin él (columna sin migrar) NO se toca
 * @param limitesActuales `limitesCancha(pista)`
 * @returns {{animacion, movidas:number}} — copia nueva; el original no se toca
 */
export function alMarcoActual(animacion, marco, limitesActuales) {
  if (!animacion || typeof animacion !== 'object') return { animacion, movidas: 0 };

  /* Sin marco declarado no se toca. Recolocar una ficha que ya estaba
     bien es moverla dos veces, y de eso no se vuelve. */
  if (!Number.isFinite(marco) || marco >= MARCO_ACTUAL) return { animacion, movidas: 0 };

  const pista = animacion.pista || 'entera';
  const f = mapaDe(pista, limitesActuales);
  if (!f) return { animacion, movidas: 0 };

  const copia = JSON.parse(JSON.stringify(animacion));
  const movidas = convertir(copia, f);
  return { animacion: copia, movidas };
}
