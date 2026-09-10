/* ============================================================
   pizarra/motor/compilar.js — de la jugada a la animación (§11).

   Módulo PURO: sin DOM, sin canvas, sin red. Lo prueba en Node
   taller/tools/eval-compilar.mjs.

   ── LAS DOS COSAS QUE SE GUARDAN ────────────────────────────
   La JUGADA (§11.1) es lo que dibuja el entrenador: la escena al
   empezar, y por cada fase los tramos que hace cada ficha. Es lo que
   hay que reabrir para seguir editando.

   La ANIMACIÓN (§11.2) es lo que se reproduce: el JSON que ya leen hoy
   el proyector, las miniaturas, la ficha y el visor de Equipos. Este
   módulo es el paso de una a otra.

   ── EL FORMATO ES EL DE HOY, CON LO QUE AÑADE EL §11.2 ───────
   Se escribe exactamente lo que el motor ya entiende —movimientos,
   pases, recogidas, con sus caminos— y encima los añadidos del §11.2:
   `inicio_ms` y `duracion_ms` en cada movimiento y cada pase, y
   `variantes` junto a `acciones` en cada fase. El §11.2 lo deja dicho:
   «el resto de consumidores solo necesita ignorar lo que no entienda».

   Eso tiene una consecuencia que vale mucho: una jugada compilada aquí
   se reproduce ya en el proyector y sale ya en la miniatura, antes de
   que `engine.js` sepa nada de carriles. Sin los arranques todo se
   estira a lo largo de la fase, como hoy; con ellos, cada uno sale
   cuando le toca. Nada se rompe por el camino.

   ── LOS NOMBRES SON LOS DE SIEMPRE ──────────────────────────
   Dentro de la Pizarra un jugador es `jugador_7`, pero en la animación
   es `A1`: el motor saca el número que pinta del propio nombre cuando
   no hay dorsal, así que con el id interno el proyector pintaría un 7
   donde el entrenador ve un 1. Es la misma convención que ya usa
   `animacionDesdeBoard` al guardar sin fases.

   ── LO QUE TODAVÍA NO SE COMPILA, DECLARADO ─────────────────
   Tiros, bloqueos, defensa, filas, puertas y zonas no los produce aún
   la Pizarra (capas 4-6). Si llegara alguno, no se inventa: sale un
   aviso en `warnings` y se sigue con lo demás.
   ============================================================ */

import { CATALOGO_SISTEMA } from '../../ia/acciones.js';
import { carrilesDesde, tiemposDe } from '../fases.js';

export const VERSION_JUGADA = 3;

/** La pausa al final de cada fase, antes de la siguiente. Es la que
 *  usaba el compilador anterior para un movimiento: lo justo para que
 *  el ojo registre dónde ha quedado cada uno. */
export const PAUSA_POR_DEFECTO_MS = 400;

/** Qué parte del último tramo de quien recoge ocupa el balón en llegar
 *  a sus manos. Si no viajara, saltaría del suelo a la mano en un
 *  fotograma; si viajara todo el tramo, iría flotando delante de él. */
export const RECOGIDA_FRACCION = 0.25;

const porSlug = new Map(CATALOGO_SISTEMA.map((a) => [a.slug, a]));
const punto = (p) => [p.x, p.y];

/**
 * @param jugada { version, pista, canasta, elementos, fases }
 *   elementos: la escena AL EMPEZAR la fase 1, con quién tiene cada
 *              balón en ese momento
 *   fases:     [{ id, duracion_ms, pausa_post_ms, tramos }]
 * @returns la animación en el formato del §10, más lo del §11.2
 */
export function compilar(jugada) {
  const j = jugada || {};
  const pista = j.pista || 'entera';
  const canasta = j.canasta || 'norte';
  const elementos = (j.elementos || []).filter(Boolean);
  const warnings = [];

  /* ── los nombres ── */
  const nombre = new Map();
  for (const e of elementos) {
    nombre.set(e.id, e.kind === 'jugador' ? `${e.equipo || 'A'}${e.label || '0'}` : e.id);
  }
  const de = (id) => (id == null ? null : (nombre.get(id) ?? null));

  /* ── la escena ── */
  const conBalon = new Set(elementos.filter((e) => e.kind === 'balon' && e.portador_id).map((e) => e.portador_id));
  const jugadores = elementos.filter((e) => e.kind === 'jugador').map((e) => ({
    id: de(e.id),
    equipo: e.equipo || 'A',
    /* El papel de defensor lo reparte el §8, que es de la capa 5. Hasta
       entonces todos atacan; el motor lo leerá por fase cuando exista. */
    tipo: 'atacante',
    posicion_inicial: punto(e),
    tiene_balon: conBalon.has(e.id),
    dorsal: e.dorsal ?? null,
    nombre: e.nombre ?? null,
  }));
  const balones = elementos.filter((e) => e.kind === 'balon').map((e) => ({
    id: e.id,
    posicion_inicial: punto(e),
    portador_id: de(e.portador_id),
  }));
  const conos = elementos.filter((e) => e.kind === 'cono').map((e) => ({
    id: e.id,
    posicion: punto(e),
    /* Filas y puertas son de la capa 6: por ahora un cono es un cono. */
    funcion: 'decorativo',
    fila_config: null,
  }));
  const materiales = elementos
    .filter((e) => e.kind === 'escalera' || e.kind === 'pelota')
    .map((e) => (e.kind === 'escalera'
      ? { id: e.id, tipo: 'escalera', posicion: punto(e), rot: e.rot ?? 0 }
      : { id: e.id, tipo: 'pelota', posicion: punto(e) }));
  if (elementos.some((e) => e.kind === 'zona')) {
    warnings.push('Las zonas todavía no se compilan (capa 6): se guardan en la jugada pero no salen en la animación.');
  }

  /* ── las fases ── */
  const fases = (j.fases || []).map((f, i) => compilarFase(f, i, { pista, canasta, de, nombre, warnings }));

  return { pista, canasta, jugadores, balones, conos, materiales, fases, warnings };
}

function compilarFase(f, i, { pista, canasta, de, nombre, warnings }) {
  const tramos = (f && f.tramos) || [];
  const fase = { ...(f || {}), carriles: carrilesDesde(tramos) };
  const tiempos = tiemposDe(fase, { pista });

  const movimientos = [];
  const pases = [];
  const recogidas = [];
  const acciones = [];
  const variantes = [];

  /* En el ORDEN EN QUE SE DIBUJARON, que es el orden en que ocurren: el
     motor procesa los cambios de dueño del balón en ese orden, y un
     pase y su contrapase en la misma fase tienen que salir así. */
  for (const t of tramos) {
    if (!t) continue;
    if (!nombre.has(t.elemento_id)) {
      warnings.push(`Fase ${i + 1}: un tramo de «${t.accion}» se ha quedado sin protagonista y no se compila.`);
      continue;
    }
    const accion = porSlug.get(t.accion);
    if (!accion) {
      warnings.push(`Fase ${i + 1}: «${t.accion}» no está en el catálogo y no se compila.`);
      continue;
    }
    const m = tiempos.tramos[t.id] || { inicio_ms: 0, duracion_ms: 0 };
    const cuando = { inicio_ms: m.inicio_ms, duracion_ms: m.duracion_ms };
    const modo = accion.parametros && accion.parametros.modo;

    if (!acciones.includes(t.accion)) acciones.push(t.accion);
    if (t.variante && !variantes.some((v) => v.accion === t.accion && v.variante === t.variante)) {
      variantes.push({ accion: t.accion, variante: t.variante });
    }

    if (accion.familia === 'balon' && modo === 'pase') {
      /* El que pasa no se mueve: lo que viaja es el balón. */
      pases.push({
        id: t.id,
        de_id: de(t.elemento_id),
        balon_id: t.corre_id,
        a_id: de(t.receptor_id),
        path: t.trazo,
        ...cuando,
      });
      continue;
    }

    if (accion.familia === 'balon' && modo === 'recoge') {
      /* Va el jugador a por el balón y, al llegar, se lo queda. El
         balón hace el último trozo hasta sus manos, en el último cuarto
         de la carrera: si no, saltaría del suelo a la mano. */
      movimientos.push({
        elemento_id: de(t.elemento_id),
        tipo_elemento: 'jugador',
        tipo_movimiento: accion.simbolo,
        path: t.trazo,
        ...cuando,
      });
      if (t.balon_id) {
        const fin = t.trazo[t.trazo.length - 1];
        /* De donde estaba el balón suelto a donde acaba el jugador. Ese
           sitio lo apunta el Tablero al dibujar el tramo, que es el único
           momento en que se sabe seguro. Sin él no se inventa de dónde
           venía: el camino queda en las manos del jugador, y el motor
           resuelve un camino de longitud cero como quedarse quieto. */
        const desde = t.balon_desde || fin;
        movimientos.push({
          elemento_id: t.balon_id,
          tipo_elemento: 'balon',
          tipo_movimiento: 'recogida',
          path: [{ x: desde.x, y: desde.y, tipo_nodo: 'lineal' }, { x: fin.x, y: fin.y, tipo_nodo: 'lineal' }],
          inicio_ms: m.inicio_ms + m.duracion_ms * (1 - RECOGIDA_FRACCION),
          duracion_ms: m.duracion_ms * RECOGIDA_FRACCION,
        });
        recogidas.push({ jugador_id: de(t.elemento_id), balon_id: t.balon_id });
      }
      continue;
    }

    if (accion.familia === 'balon' && modo === 'tiro') {
      warnings.push(`Fase ${i + 1}: los tiros todavía no se compilan (capa 4).`);
      continue;
    }
    if (accion.familia === 'entre_dos') {
      warnings.push(`Fase ${i + 1}: «${accion.nombre}» es entre dos fichas y todavía no se compila.`);
      continue;
    }

    movimientos.push({
      elemento_id: de(t.corre_id || t.elemento_id),
      tipo_elemento: 'jugador',
      tipo_movimiento: accion.simbolo,
      path: t.trazo,
      ...cuando,
    });
  }

  return {
    id: (f && f.id) || `fase_${i + 1}`,
    duracion_ms: Math.max(1, tiempos.duracion_ms || 0),
    pausa_post_ms: Number.isFinite(f && f.pausa_post_ms) ? f.pausa_post_ms : PAUSA_POR_DEFECTO_MS,
    movimientos,
    pases,
    bloqueos: [],
    tiros: [],
    recogidas,
    acciones,
    variantes,
  };
}
