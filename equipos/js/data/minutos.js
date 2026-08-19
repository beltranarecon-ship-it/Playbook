/* ============================================================
   minutos.js — MINUTOS ACTIVOS POR JUGADOR (Tramo 3.1).
   Módulo PURO: sin DOM, sin Supabase. Lo importan el planificador,
   el cierre de sesión, el dossier y el banco Node.

   ── QUÉ SUSTITUYE, Y POR QUÉ ────────────────────────────────
   La carga de una sesión era `intensidad × duración`: un número
   abstracto que subía igual poniendo un ejercicio más duro que
   poniendo uno más largo, y que no distinguía doce niños trabajando
   a la vez de doce niños haciendo cola. Como medida de lo que un
   crío se lleva de un entrenamiento, no medía nada.

   Aquí se cuenta lo único que importa de verdad: **cuántos minutos
   de esos noventa ha estado ESE niño haciendo algo**. Es la doctrina
   de densidad (D4) convertida en número, y por eso se puede corregir:
   se cambia un ejercicio de la sesión y el número sube en pantalla.

   ── DE DÓNDE SALE CADA FACTOR ───────────────────────────────
   minutos = duración × compromiso × turno

   `compromiso` sale de la DENSIDAD declarada en la ficha, que D4
   define en acciones útiles por jugador y minuto: alta ≥ 4, media
   entre 2 y 4, baja < 2. La fracción es el punto medio de la banda
   dividido por el umbral de «alta»; así los tres escalones salen de
   los números de la doctrina y no de una tabla inventada.

   `turno` es el aforo: una ficha declara con cuántos se puede montar
   (`jugadores_max`). Si vienen más, los de más esperan turno y el
   tiempo de trabajo se reparte. Es §11: «ejercicio con más jugadores
   que su máximo: la densidad baja y los minutos activos lo reflejan».

   ── LO QUE NO SE INVENTA ────────────────────────────────────
   Una ficha nueva nace con los requisitos en `null` («sin decidir»,
   Tramo 2.12). Un bloque así NO se penaliza ni se descarta: cuenta
   como si nadie esperase, y se apunta en `supuestos` para que la
   pantalla pueda decir de cuántos ejercicios sale el número de
   verdad. Un número redondo construido sobre huecos es peor que un
   número con una nota al pie.

   ── DÓNDE NO ENTRAN `estaciones` NI `canastas` ──────────────
   En el número no entran, y es a propósito. Se miró la biblioteca:
   `jugadores_max` es el tope del montaje ENTERO (12, 14, 16), no el
   de cada estación —las 149 fichas con `estaciones: 2` declaran
   `jugadores_max: 12`, no 6—. Multiplicar por las estaciones contaría
   dos veces lo mismo. Lo que sí hacen es decir QUÉ HACER cuando no
   cabe la gente: ver `avisoAforo`.
   ============================================================ */

import { DENSIDAD_KEYS } from '../../../taller/js/ia/vocabulario.js';
import { noEntrena } from './plan.js';

/**
 * Qué fracción del tiempo está haciendo algo un jugador, según la
 * densidad declarada (D4).
 *
 * El punto medio de cada banda, dividido por el umbral de «alta» (4
 * acciones por jugador y minuto):
 *   alta  → 4/4 = 1     · media → 3/4 = 0,75   · baja → 1/4 = 0,25
 *
 * No es una medida, es una convención — pero es la convención que ya
 * está escrita en la doctrina, no una tabla nueva.
 */
export const COMPROMISO = { alta: 1, media: 0.75, baja: 0.25 };

/** Compromiso de una ficha, o null si no lo ha declarado. */
export function compromisoDe(requisitos) {
  const d = requisitos?.densidad;
  return DENSIDAD_KEYS.includes(d) ? COMPROMISO[d] : null;
}

/**
 * Con cuántos se puede montar el ejercicio a la vez, o null si la
 * ficha no lo dice. Un ejercicio SIMULTÁNEO no tiene tope de turno:
 * todos trabajan a la vez, cada uno con su balón o en su espacio.
 */
export function aforoDe(requisitos) {
  if (requisitos?.simultaneo === true) return Infinity;
  const n = Number(requisitos?.jugadores_max);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const redondea = (x) => Math.round(x * 10) / 10;

/**
 * Minutos activos de UN bloque, por jugador.
 *
 * @param bloque      {duracion_min, titulo?, exercise_id?}
 * @param opts.jugadores  cuántos hay en la pista
 * @param opts.requisitos requisitos de la ficha del bloque (o null)
 * @returns {minutos, duracion, fraccion, compromiso, turno, supuestos:[]}
 *   `supuestos` nombra lo que la ficha NO declara y se ha contado a
 *   favor. Lista vacía = el número no depende de ninguna suposición.
 */
export function minutosDeBloque(bloque, { jugadores = null, requisitos = null } = {}) {
  const duracion = Math.max(0, Number(bloque?.duracion_min) || 0);
  /* Un bloque LIBRE —una charla, el agua, un juego improvisado— no
     tiene ficha, así que no hay nada que declarar y no es un hueco de
     datos: es otro tipo de bloque. Cuenta entero, como el resto de lo
     que no se sabe, pero se distingue, porque lo que hay que hacer con
     él es distinto: una ficha a medias se termina de rellenar; una
     charla de cinco minutos es lo que es. */
  const libre = !bloque?.exercise_id;
  const supuestos = [];

  /* El agua (3.2) y un vídeo (3.3) no entrenan a nadie. Ocupan pista
     —cuentan en la duración— pero cero minutos activos, y por eso bajar
     el porcentaje al meterlos es correcto: son minutos que no son
     entrenamiento. Con estos dos no es una suposición: de una charla no
     se sabe si es charla o juego; de un vídeo, sí. */
  if (noEntrena(bloque)) {
    return { minutos: 0, duracion, fraccion: 0, compromiso: 0, turno: 0, libre: true, agua: true, supuestos };
  }

  let compromiso = compromisoDe(requisitos);
  if (compromiso == null) { compromiso = 1; if (!libre) supuestos.push('densidad'); }

  const aforo = aforoDe(requisitos);
  const n = Number(jugadores);
  let turno = 1;
  if (aforo == null) {
    if (!libre) supuestos.push('aforo');
  } else if (Number.isFinite(n) && n > 0 && Number.isFinite(aforo) && n > aforo) {
    // los de más esperan turno: el tiempo de trabajo se reparte
    turno = aforo / n;
  }

  const fraccion = compromiso * turno;
  return {
    minutos: redondea(duracion * fraccion),
    duracion,
    fraccion,
    compromiso,
    turno,
    libre,
    agua: false,
    supuestos,
  };
}

/**
 * Minutos activos de una SESIÓN entera, por jugador.
 *
 * @param bloques  [{duracion_min, exercise_id, titulo}] en orden
 * @param opts.jugadores    cuántos van a estar (plantilla o asistencia)
 * @param opts.requisitosDe (bloque) => requisitos|null — se inyecta para
 *   que este módulo no sepa nada de dónde salen las fichas.
 * @returns {minutos, duracion, aprovechamiento, porBloque, conSupuestos, bloquesConDatos}
 *   · aprovechamiento = minutos / duración — el «tiempo de compromiso
 *     motor» de la sesión, que la doctrina sitúa de media en el 54 %.
 */
export function minutosDeSesion(bloques, { jugadores = null, requisitosDe = null } = {}) {
  const lista = Array.isArray(bloques) ? bloques : [];
  const porBloque = [];
  let minutos = 0, duracion = 0, conSupuestos = 0, libres = 0;

  for (const b of lista) {
    const req = typeof requisitosDe === 'function' ? requisitosDe(b) : null;
    const m = minutosDeBloque(b, { jugadores, requisitos: req });
    if (m.duracion <= 0) continue;
    porBloque.push({ ...m, titulo: b?.titulo ?? null, exercise_id: b?.exercise_id ?? null });
    minutos += m.minutos;
    duracion += m.duracion;
    if (m.supuestos.length) conSupuestos += 1;
    if (m.libre) libres += 1;
  }

  return {
    minutos: redondea(minutos),
    duracion,
    aprovechamiento: duracion ? minutos / duracion : 0,
    porBloque,
    conSupuestos,
    libres,
    bloquesConDatos: porBloque.length - conSupuestos - libres,
  };
}

/**
 * Qué hacer cuando no cabe la gente.
 *
 * Aquí sí entran `estaciones` y `canastas`: no cambian el número, pero
 * son lo que convierte «trabajan la mitad» en algo que se puede
 * arreglar antes del entrenamiento. Si el montaje declara dos
 * estaciones y una canasta, duplicarlo para dieciocho no es gratis.
 *
 * @returns null si cabe; si no, {sobran, estacionesNecesarias, canastasNecesarias}
 */
export function avisoAforo(requisitos, jugadores) {
  const aforo = aforoDe(requisitos);
  const n = Number(jugadores);
  if (aforo == null || !Number.isFinite(aforo)) return null;   // sin tope o sin declarar
  if (!Number.isFinite(n) || n <= aforo) return null;

  const copias = Math.ceil(n / aforo);
  const estaciones = Math.max(1, Number(requisitos?.estaciones) || 1);
  const canastas = Math.max(0, Number(requisitos?.canastas) || 0);
  return {
    sobran: n - aforo,
    estacionesNecesarias: copias * estaciones,
    canastasNecesarias: copias * canastas,
  };
}

/**
 * Lo que se lee debajo del número, en castellano.
 * «58 de 90 min · cada jugador trabaja el 64 % del entreno»
 */
export function textoMinutos({ minutos, duracion, aprovechamiento }) {
  if (!duracion) return 'Sin bloques todavía.';
  return `${Math.round(minutos)} de ${Math.round(duracion)} min · cada jugador trabaja el ${Math.round(aprovechamiento * 100)} % del entreno`;
}
