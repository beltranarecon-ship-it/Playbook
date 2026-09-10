/* ============================================================
   pizarra/motor/jugada.js — reabrir lo guardado (§11.1, §11.4).

   Módulo PURO: sin DOM, sin canvas, sin red. Lo prueba en Node
   taller/tools/eval-jugada.mjs.

   ── LO QUE LLEGA DE LA BASE DE DATOS NO SE DA POR BUENO ─────
   La jugada vive en una columna jsonb. Puede no estar —los ejercicios de
   antes de la Pizarra—, puede venir de una versión más nueva de la app
   abierta en otro ordenador, o puede venir a medias. Abrir un ejercicio
   no puede reventar la pantalla por nada de eso: lo que no se entiende
   se deja fuera y SE DICE, y lo demás se abre.

   ── LO QUE NO SE BORRA EN SILENCIO ──────────────────────────
   Un tramo cuyo protagonista ya no está se CONSERVA: el §6.5 manda
   marcarlo y ofrecer quitarlo, no hacerlo desaparecer. Solo se deja
   fuera lo que no se puede ni dibujar —un trazo roto—, y también se
   avisa.

   ── LOS EJERCICIOS DE ANTES ─────────────────────────────────
   El §11.4: un ejercicio guardado antes de la Pizarra no tiene jugada,
   solo animación. Se abre con sus posiciones iniciales ya colocadas y
   una fase vacía, para rehacer la pizarra desde ahí.
   ============================================================ */

import { VERSION_JUGADA } from './compilar.js';

const finito = (v) => Number.isFinite(v);
const nodoBueno = (n) => !!n && finito(n.x) && finito(n.y);
const faseVacia = (id = 'f1') => ({ id, nombre: null, duracion_ms: null, pausa_post_ms: null, tramos: [] });

/**
 * Deja una jugada guardada en condiciones de abrirse.
 *
 * @returns { jugada, avisos, siguienteTramo }
 *   jugada          la jugada lista, o `null` si no hay nada que abrir
 *   avisos          lo que se ha dejado fuera o se ha arreglado, en frases
 *   siguienteTramo  por dónde tiene que seguir la numeración de tramos:
 *                   empezando otra vez desde 1, el primer tramo nuevo se
 *                   llamaría igual que uno guardado
 */
export function normalizarJugada(bruta) {
  const avisos = [];
  if (!bruta || typeof bruta !== 'object' || !Array.isArray(bruta.elementos)) {
    return { jugada: null, avisos: ['No hay jugada guardada que abrir.'], siguienteTramo: 1 };
  }
  if (finito(bruta.version) && bruta.version > VERSION_JUGADA) {
    avisos.push('Esta jugada se guardó con una versión más nueva de la app: puede que falte algo.');
  }

  /* ── las fichas ── */
  const ids = new Set();
  const elementos = [];
  for (const e of bruta.elementos) {
    if (!e || typeof e !== 'object' || !e.id || !e.kind || !finito(e.x) || !finito(e.y)) {
      avisos.push('Una ficha guardada estaba incompleta y se ha dejado fuera.');
      continue;
    }
    if (ids.has(e.id)) {
      avisos.push(`Había dos fichas con el mismo nombre («${e.id}»): se ha quedado la primera.`);
      continue;
    }
    ids.add(e.id);
    elementos.push({ ...e });
  }
  for (const b of elementos) {
    if (b.kind === 'balon' && b.portador_id && !ids.has(b.portador_id)) {
      avisos.push('Un balón era de alguien que ya no está: se ha quedado suelto.');
      b.portador_id = null;
    }
  }

  /* ── las fases y sus tramos ── */
  const deTramo = new Set();
  const deFase = new Set();
  let mayor = 0;
  let fases = (Array.isArray(bruta.fases) ? bruta.fases : [])
    .filter((f) => f && typeof f === 'object')
    .map((f, i) => {
      const tramos = [];
      for (const t of Array.isArray(f.tramos) ? f.tramos : []) {
        if (!t || typeof t !== 'object' || !t.id || !t.accion || !t.elemento_id) {
          avisos.push(`Fase ${i + 1}: un tramo estaba incompleto y se ha dejado fuera.`);
          continue;
        }
        if (!Array.isArray(t.trazo) || t.trazo.length < 2 || !t.trazo.every(nodoBueno)) {
          avisos.push(`Fase ${i + 1}: el trazo de «${t.accion}» estaba roto y no se puede dibujar.`);
          continue;
        }
        if (deTramo.has(t.id)) {
          avisos.push(`Fase ${i + 1}: había dos tramos con el mismo nombre: se ha quedado el primero.`);
          continue;
        }
        deTramo.add(t.id);
        /* Sin protagonista SE CONSERVA (§6.5): lo marcará el recálculo
           de fases y el entrenador decidirá si lo quita. */
        if (!ids.has(t.elemento_id)) avisos.push(`Fase ${i + 1}: un tramo de «${t.accion}» se ha quedado sin protagonista.`);
        const n = /(\d+)$/.exec(String(t.id));
        if (n) mayor = Math.max(mayor, Number(n[1]));
        tramos.push({ ...t, trazo: t.trazo.map((x) => ({ ...x })) });
      }
      let id = f.id || `f${i + 1}`;
      if (deFase.has(id)) id = `f${i + 1}_${deFase.size}`;
      deFase.add(id);
      return {
        id,
        nombre: f.nombre ?? null,
        duracion_ms: finito(f.duracion_ms) ? f.duracion_ms : null,
        pausa_post_ms: finito(f.pausa_post_ms) ? f.pausa_post_ms : null,
        tramos,
      };
    });
  /* Una jugada sin fases no se puede editar: siempre hay por lo menos
     la primera, aunque esté vacía. */
  if (!fases.length) fases = [faseVacia()];

  return {
    jugada: {
      version: VERSION_JUGADA,
      pista: typeof bruta.pista === 'string' && bruta.pista ? bruta.pista : 'entera',
      canasta: bruta.canasta === 'sur' ? 'sur' : 'norte',
      elementos,
      fases,
    },
    avisos,
    siguienteTramo: mayor + 1,
  };
}

/**
 * Un ejercicio guardado ANTES de la Pizarra (§11.4): de su animación se
 * sacan las posiciones iniciales y se abre con una fase vacía, para
 * rehacer la pizarra desde ahí.
 *
 * Los nombres se conservan tal cual (`A1`, `balon_1`): el número que se
 * pinta sale del propio nombre, así que cada jugador sigue siendo el
 * mismo que se veía en la ficha.
 */
export function jugadaDesdeAnimacion(anim) {
  if (!anim || typeof anim !== 'object') return null;
  const par = (p) => Array.isArray(p) && finito(p[0]) && finito(p[1]);
  const elementos = [];
  for (const j of anim.jugadores || []) {
    if (!j || !j.id || !par(j.posicion_inicial)) continue;
    elementos.push({
      id: j.id,
      kind: 'jugador',
      x: j.posicion_inicial[0],
      y: j.posicion_inicial[1],
      equipo: j.equipo || 'A',
      label: String(j.id).match(/\d+/)?.[0] ?? '0',
      dorsal: j.dorsal ?? null,
      nombre: j.nombre ?? null,
      en_juego: true,
    });
  }
  for (const b of anim.balones || []) {
    if (!b || !b.id || !par(b.posicion_inicial)) continue;
    elementos.push({ id: b.id, kind: 'balon', x: b.posicion_inicial[0], y: b.posicion_inicial[1], portador_id: b.portador_id || null });
  }
  for (const c of anim.conos || []) {
    if (!c || !c.id || !par(c.posicion)) continue;
    elementos.push({ id: c.id, kind: 'cono', x: c.posicion[0], y: c.posicion[1], nombre: null, fila: null, puerta_con: null });
  }
  for (const m of anim.materiales || []) {
    if (!m || !par(m.posicion)) continue;
    const id = m.id || `${m.tipo}_${elementos.length + 1}`;
    elementos.push(m.tipo === 'escalera'
      ? { id, kind: 'escalera', x: m.posicion[0], y: m.posicion[1], rot: m.rot ?? 0 }
      : { id, kind: 'pelota', x: m.posicion[0], y: m.posicion[1] });
  }
  return {
    version: VERSION_JUGADA,
    pista: anim.pista || 'entera',
    canasta: anim.canasta === 'sur' ? 'sur' : 'norte',
    elementos,
    fases: [faseVacia()],
  };
}
