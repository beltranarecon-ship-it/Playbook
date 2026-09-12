/* ============================================================
   cargar.js — un ejercicio guardado, de vuelta al borrador.
   Módulo PURO: sin DOM, sin red.

   ── POR QUÉ ─────────────────────────────────────────────────
   Editar abría un editor a pantalla completa, aparte, que solo sabía
   retocar flechas: para cambiar el nombre, la dificultad o media ficha
   había que ir a otro sitio. Ahora editar abre el MISMO asistente con
   todo cargado (§6), así que hay un único camino para crear y para
   corregir, y lo que se aprende en uno vale en el otro.

   Esto es el camino de vuelta: `aRegistro` escribe, esto lee.

   ── EL DIBUJO NO SE RECONSTRUYE AQUÍ ────────────────────────
   Aquí solo se rellena el borrador. Lo que se dibuja lo abre la Pizarra
   por su cuenta, en taller/js/pizarra/motor/jugada.js: la `jugada` si el
   ejercicio se hizo con ella (§11.1), y si no `jugadaDesdeAnimacion`,
   que planta las posiciones iniciales de la animación vieja para
   rehacerla a mano (§11.4). Por eso la animación se pasa entera y sin
   tocar: no es de aquí de donde sale el dibujo.

   ── LO QUE SE GUARDÓ PENSANDO EN ESTE MOMENTO ───────────────
   Las líneas de las fases y las posiciones marcadas viajan DENTRO de la
   animación (`_fases_texto`, `_posiciones`), no fuera. Sin ellas,
   reabrir un ejercicio devolvería el dibujo pero no lo que se escribió,
   y el paso 3 se quedaría sin las líneas con las que arma la
   descripción.
   ============================================================ */

import { nuevoDraft } from './draft.js';

/* ── El borrador ───────────────────────────────────────────── */

const texto = (v) => (typeof v === 'string' ? v : '');

/**
 * Un ejercicio guardado (fila de `exercises` o ficha de la biblioteca)
 * convertido en el borrador del asistente.
 *
 * @param row  lo que devuelve getEjercicio()
 * @param opts.duplicar  true = es una VARIANTE: nombre nuevo y sin id,
 *   para que guardar cree un ejercicio en vez de pisar el original.
 * @returns { draft }
 */
export function borradorDeEjercicio(row, { duplicar = false, nombres = [] } = {}) {
  const d = nuevoDraft();
  const a = row?.animacion || null;

  d.id = duplicar ? null : (row?.id ?? null);
  d.nombre = duplicar ? nombreDeVariante(row?.name, nombres) : texto(row?.name);
  d.tipo = row?.type ?? null;
  d.category = row?.category ?? null;
  d.tipo_pista = row?.tipo_pista || a?.pista || 'entera';
  d.categoria_rama = row?.categoria_rama ?? null;
  d.categoria_nivel = Array.isArray(row?.categoria_nivel) ? [...row.categoria_nivel] : [];
  d.dificultad_valor = row?.difficulty ?? 3;
  d.intensidad = row?.intensidad ?? 3;
  d.duracion_min = row?.duration_min ?? 10;
  d.duracion_max = row?.duration_max ?? 20;
  d.autor_nombre = texto(row?.autor_nombre);
  d.tags = Array.isArray(row?.tags) ? [...row.tags] : [];
  d.description = texto(row?.description);
  d.objetivos = texto(row?.objetivos);
  d.descripcion_texto = texto(row?.descripcion_texto);
  d.notas = texto(row?.notas);
  d.animacion = a;
  /* La jugada de la Pizarra (§11.1), si la hay: es lo que se reabre para
     seguir dibujando. Una COPIA: el asistente la cambia mientras se
     dibuja, y lo que llegó de la base de datos no puede cambiar con
     ella. Los ejercicios de antes no la tienen y se abren desde las
     posiciones de su animación (§11.4). */
  d.jugada = row?.jugada && typeof row.jugada === 'object' ? JSON.parse(JSON.stringify(row.jugada)) : null;
  d.canasta = a?.canasta ?? null;

  /* Los requisitos se funden sobre los del borrador nuevo: una ficha
     vieja a la que le falte un campo del molde lo tendrá en `null`
     («sin decidir») y el listón del paso 3 lo pedirá, en vez de
     quedarse callado porque la clave no existe. */
  if (row?.requisitos && typeof row.requisitos === 'object') {
    d.requisitos = { ...d.requisitos, ...row.requisitos };
    d.requisitos.niveles = { ...d.requisitos.niveles, ...(row.requisitos.niveles || {}) };
    d.requisitos_manual = true;   // lo guardado manda sobre el conteo del tablero
  }

  /* Lo que se escribió a mano y no se puede sacar del dibujo: las líneas
     de las fases —con ellas arma el paso 3 la descripción— y las
     posiciones que se marcaron con un nombre. */
  if (Array.isArray(a?._fases_texto) && a._fases_texto.length) {
    d.fases_texto = a._fases_texto.map((f) => ({
      texto: texto(f?.texto),
      duracion_ms: Number.isFinite(f?.duracion_ms) ? f.duracion_ms : null,
      pausa_post_ms: Number.isFinite(f?.pausa_post_ms) ? f.pausa_post_ms : null,
    }));
  }
  if (a?._posiciones && typeof a._posiciones === 'object') d.posiciones = { ...a._posiciones };

  return { draft: d };
}

/* ── El nombre de una variante ─────────────────────────────── */

/*
   «X-variante de …» (§6). El número va DELANTE y no detrás por una
   razón práctica: en una lista ordenada alfabéticamente, las variantes
   de un mismo ejercicio no se separan de él —siguen empezando por su
   nombre— pero sí se distinguen entre ellas a simple vista.
*/
const RE_VARIANTE = /^(\d+)-variante de (.+)$/i;

/** El nombre original de una variante, o el mismo nombre si no lo es. */
export function nombreBase(nombre) {
  const m = RE_VARIANTE.exec(String(nombre || '').trim());
  return m ? m[2] : String(nombre || '').trim();
}

/**
 * El siguiente nombre de variante libre.
 *
 * Se parte del nombre BASE, no del que se está duplicando: duplicar una
 * variante da otra variante del original, no «1-variante de 1-variante
 * de …», que a la tercera vuelta no lo lee nadie.
 */
export function nombreDeVariante(nombre, nombres = []) {
  const base = nombreBase(nombre);
  if (!base) return '';
  const usados = new Set();
  for (const n of nombres) {
    const m = RE_VARIANTE.exec(String(n || '').trim());
    if (m && m[2].toLowerCase() === base.toLowerCase()) usados.add(Number(m[1]));
  }
  let i = 1;
  while (usados.has(i)) i += 1;
  return `${i}-variante de ${base}`;
}

/**
 * ¿Hay ya un ejercicio con este nombre?
 *
 * Se compara sin distinguir mayúsculas ni espacios de sobra: «Bote en
 * cuadrantes» y «bote en  cuadrantes» son el mismo ejercicio para
 * cualquiera que los lea en una lista, y tener los dos es exactamente
 * el problema que §6 quiere evitar.
 */
export function nombreRepetido(nombre, nombres = [], idPropio = null) {
  const k = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const mio = k(nombre);
  if (!mio) return false;
  return nombres.some((n) => (typeof n === 'string' ? k(n) === mio : k(n?.name) === mio && n?.id !== idPropio));
}
