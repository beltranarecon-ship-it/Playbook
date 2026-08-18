/* ============================================================
   cargar.js — un ejercicio guardado, de vuelta al borrador
   (Tramo 2.13). Módulo PURO: sin DOM, sin red.

   ── POR QUÉ ─────────────────────────────────────────────────
   Editar abría un editor a pantalla completa, aparte, que solo sabía
   retocar flechas: para cambiar el nombre, la dificultad o media ficha
   había que ir a otro sitio, y el paso 2 —el que sabe describir la
   jugada— no estaba. Ahora editar abre **los mismos cuatro pasos** con
   todo cargado (§6), así que hay un único camino para crear y para
   corregir, y lo que se aprende en uno vale en el otro.

   Esto es el camino de vuelta: `aRegistro` escribe, esto lee.

   ── LO QUE SE GUARDÓ PENSANDO EN ESTE MOMENTO ───────────────
   Las líneas de las fases y las posiciones marcadas viajan DENTRO de
   la animación (`_fases_texto`, `_posiciones`, Tramo 2.9/2.12), y el
   tablero también (`_elementos`). Sin ellos, reabrir un ejercicio
   devolvería la geometría pero no lo que se escribió para generarla:
   el paso 2 saldría en blanco y cualquier retoque habría que hacerlo
   a mano sobre las flechas.

   ── Y LO QUE HAY QUE RECONSTRUIR ────────────────────────────
   Las 204 fichas de la biblioteca son anteriores y no llevan
   `_elementos`: su tablero se escribió en las tandas y se compiló. Para
   ellas se rehace desde la animación, con un cuidado que no es obvio:
   la cola dibujada de una fila viene YA DESCONTADA de los que salieron
   a trabajar, así que hay que volver a sumarlos. Sin eso, cada vez que
   alguien abriera y guardara una ficha de fila, la cola perdería un
   jugador.
   ============================================================ */

import { nuevoDraft } from './draft.js';

/* ── El tablero ────────────────────────────────────────────── */

let semilla = 0;
const uid = (p) => `${p}_carga_${++semilla}`;

/**
 * Los elementos del tablero a partir de una animación §10.
 *
 * Se usa solo cuando el ejercicio no guardó su tablero (las fichas de
 * la biblioteca). Devuelve la misma forma que produce el Board.
 */
export function elementosDeAnimacion(anim) {
  if (!anim || typeof anim !== 'object') return [];
  const out = [];

  /* Los jugadores de FILA no son fichas del tablero: los sintetiza el
     compilador desde el cono. Se apartan aquí y se cuentan abajo para
     devolverlos a su cola. */
  const deFila = new Map();   // índice de fila → cuántos salieron
  for (const j of anim.jugadores || []) {
    const m = /^fila(\d+)(?:_(\d+))?$/.exec(String(j.id || ''));
    if (m) { const i = Number(m[1]); deFila.set(i, (deFila.get(i) || 0) + 1); continue; }
    const [x, y] = j.posicion_inicial || [0.5, 0.5];
    out.push({
      id: uid('jug'), kind: 'jugador',
      equipo: j.equipo || 'A',
      label: String(j.id || '').replace(/^[A-D]/, '') || '1',
      dorsal: j.dorsal ?? null, nombre: j.nombre ?? null,
      x, y,
    });
  }

  for (const b of anim.balones || []) {
    const [x, y] = b.posicion_inicial || [0.5, 0.5];
    out.push({ id: b.id || uid('balon'), kind: 'balon', x, y, portador_id: null });
  }

  let iFila = 0;
  for (const c of anim.conos || []) {
    const [x, y] = c.posicion || [0.5, 0.5];
    const cono = { id: c.id || uid('cono'), kind: 'cono', x, y, funcion: c.funcion || 'decorativo', fila_config: null };
    if (c.funcion === 'fila' && c.fila_config) {
      iFila += 1;
      /* La cola dibujada viene descontada de los que salieron a
         trabajar; se les devuelve para que el tablero vuelva a decir
         cuántos había de verdad. */
      const salidos = deFila.get(iFila) || 0;
      cono.fila_config = { ...c.fila_config, n_jugadores: (c.fila_config.n_jugadores || 0) + salidos };
    }
    out.push(cono);
  }

  for (const z of anim.zonas || []) {
    out.push({
      id: z.id || uid('zona'), kind: 'zona',
      tipo: z.tipo || 'rect', nombre: z.nombre || '',
      visible: z.visible !== false,
      x: z.x, y: z.y, x2: z.x2, y2: z.y2,
    });
  }

  for (const m of anim.materiales || []) {
    const [x, y] = m.posicion || [0.5, 0.5];
    out.push({ id: m.id || uid('mat'), kind: m.tipo === 'pelota' ? 'pelota' : 'escalera', x, y, ...(m.rot != null ? { rot: m.rot } : {}) });
  }

  return out;
}

/* ── El borrador ───────────────────────────────────────────── */

const texto = (v) => (typeof v === 'string' ? v : '');

/**
 * Un ejercicio guardado (fila de `exercises` o ficha de la biblioteca)
 * convertido en { draft, elementos }, listo para los cuatro pasos.
 *
 * @param row  lo que devuelve getEjercicio()
 * @param opts.duplicar  true = es una VARIANTE: nombre nuevo y sin id,
 *   para que guardar cree un ejercicio en vez de pisar el original.
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

  /* Lo que el paso 2 necesita para volver a su estado, si se guardó. */
  if (Array.isArray(a?._fases_texto) && a._fases_texto.length) {
    d.fases_texto = a._fases_texto.map((f) => ({
      texto: texto(f?.texto),
      duracion_ms: Number.isFinite(f?.duracion_ms) ? f.duracion_ms : null,
      pausa_post_ms: Number.isFinite(f?.pausa_post_ms) ? f.pausa_post_ms : null,
    }));
  }
  if (a?._posiciones && typeof a._posiciones === 'object') d.posiciones = { ...a._posiciones };

  const elementos = Array.isArray(a?._elementos) && a._elementos.length
    ? a._elementos.map((e) => ({ ...e }))
    : elementosDeAnimacion(a);

  return { draft: d, elementos };
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
