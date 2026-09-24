/* ============================================================
   wizard/llevar.js — «llevar al paso 3» (ESPEC-PIZARRA-v3 §9.4).

   Módulo PURO: sin DOM, sin red. Lo prueba en Node
   taller/tools/eval-llevar.mjs.

   Al pasar de la Pizarra a la ficha, lo que la pizarra ya sabe pasa a
   ella con plantillas deterministas —sin IA—: el contenido (de las
   acciones usadas), las etiquetas (acciones y variantes), el material
   (lo que hay en la pizarra) y el desarrollo (las frases de las fases).
   El número de jugadores ya lo propone el paso 3 con el recuento.

   ── SOLO DONDE NO HA ESCRITO EL ENTRENADOR ──────────────────
   Se rellena lo que está vacío y lo que se trajo de la pizarra la vez
   anterior sin que nadie lo haya tocado: así, al volver a dibujar, lo
   traído se pone al día, y lo escrito a mano no se pisa nunca. Lo traído
   queda apuntado en el borrador (`traido_de_la_pizarra`), que no se
   guarda con el ejercicio; el puente al chat lo trata como hueco.

   La duración NO se rellena (lo decidió el entrenador, 2026-09-24): lo
   dibujado dura segundos y la ficha habla de minutos de sesión. Se da el
   dato —lo que dura una vuelta completa— como ayuda.
   ============================================================ */

import { CATALOGO_SISTEMA } from '../ia/acciones.js';
import { VARIANTES } from '../pizarra/repertorio.js';
import { esTagValido, esBloqueValido } from '../ia/vocabulario.js';
import { frasesDeJugada } from '../pizarra/motor/frase.js';
import { papelesDeJugada } from '../pizarra/motor/defensa.js';
import { aroExacto } from '../canvas/anclas.js';
import { metrosEntre } from '../canvas/escala.js';

const porSlug = new Map(CATALOGO_SISTEMA.map((a) => [a.slug, a]));

/* Las etiquetas que prometen una FINALIZACIÓN. El linter de la biblioteca
   exige entonces que todos los tiros salgan pegados al aro (1,6 m): si
   hay un tiro de fuera en el ejercicio, ponerlas haría fallar un listón
   que el entrenador no ha tocado. */
const FINALIZA = /\bentrada|doble ritmo|bandeja|finaliza/i;
const METROS_JUNTO_AL_ARO = 1.6;

const CAMPOS = ['category', 'tags', 'material', 'descripcion_texto'];

/* ¿Un tiro de fuera, lejos del aro? */
function hayTiroDeFuera(j, papeles) {
  const pista = j.pista || 'entera';
  return (j.fases || []).some((f, i) => ((f && f.tramos) || []).some((t) => {
    if (!t || t.accion !== 'tira' || !Array.isArray(t.trazo) || !t.trazo.length) return false;
    const aro = aroExacto(pista, (papeles && papeles.fases[i] && papeles.fases[i].canasta) || j.canasta || 'norte');
    return aro && metrosEntre(pista, t.trazo[0], { x: aro[0], y: aro[1] }) > METROS_JUNTO_AL_ARO;
  }));
}

/**
 * EL CONTENIDO: una plantilla por prioridad. Lo que remata la jugada
 * manda sobre lo que la prepara —una entrada con bote antes es un
 * ejercicio de entrada—, salvo el juego entre dos, que se reconoce por
 * cómo se llega: un bloqueo o un pasar y cortar lo es aunque acabe en
 * canasta (así lo tiene la biblioteca).
 */
function contenidoDe(usadas, { hayDefensa, pasarYCortar, dichas }) {
  const hay = (s) => usadas.has(s);
  if (hay('bloquea') || pasarYCortar) return 'juego-de-2';
  if (dichas.has('cierra_rebote')) return 'rebote';
  if (hay('entra')) return 'entrada';
  if (hay('tira')) return 'tiro';
  if (hay('pasa')) return 'pase';
  if (hay('bota') || hay('cambia_de_mano') || hay('protege')) return 'bote';
  if (hay('finta') || hay('para') || hay('pivota')) return 'juego-de-pies';
  if (hay('recoge')) return 'rebote';
  if (hayDefensa) return 'defensa';
  return null;
}

/**
 * LO QUE LA PIZARRA PROPONE para la ficha.
 *
 * @param jugada  la de la Pizarra (§11.1)
 * @returns { category, tags, material, desarrollo }
 */
export function propuestaDesdeLaJugada(jugada) {
  const j = jugada || {};
  const fases = (j.fases || []).map((f) => (f && typeof f === 'object' ? { ...f, tramos: (f.tramos || []).filter(Boolean) } : { tramos: [] }));
  const elementos = (j.elementos || []).filter(Boolean);
  const tramos = fases.flatMap((f) => f.tramos);
  const usadas = new Set(tramos.map((t) => t.accion));

  let papeles = null;
  try { papeles = papelesDeJugada({ ...j, fases, elementos }); } catch { papeles = null; }
  const hayDefensa = !!(papeles && (papeles.inicio.defensores || []).length);
  const dichas = new Set(fases.flatMap((f) => Object.values(f.defensa || {}).map((a) => a && a.accion)).filter(Boolean));
  /* Pasar y cortar: el mismo jugador pasa y luego corta, en la misma fase. */
  const pasarYCortar = fases.some((f) => f.tramos.some((p, i) => p.accion === 'pasa'
    && f.tramos.slice(i + 1).some((c) => c.accion === 'corta' && c.elemento_id === p.elemento_id)));

  /* LAS ETIQUETAS: las del catálogo para cada acción usada —dibujada o
     dicha de la defensa— y sus variantes, y la situación. Solo las del
     vocabulario de la biblioteca, que es lo que puntúa en el
     planificador. */
  const tags = [];
  const pon = (t) => { if (t && esTagValido(t) && !tags.includes(t)) tags.push(t); };
  const sinFinalizar = hayTiroDeFuera(j, papeles);
  fases.forEach((f, i) => {
    const defienden = new Set((papeles && papeles.fases[i] && papeles.fases[i].defensores) || []);
    for (const t of f.tramos) {
      const a = porSlug.get(t.accion) || {};
      const v = (VARIANTES[t.accion] || []).find((x) => x.slug === t.variante);
      /* Recoger es rebote ofensivo o defensivo según quién lo coge. */
      if (t.accion === 'recoge') pon(defienden.has(t.elemento_id) ? 'rebote defensivo' : 'rebote ofensivo');
      else if (esTagValido(a.tag)) pon(a.tag);
      /* Sin variante elegida, la de toda la vida, si su etiqueta es la
         que falta (un bloqueo es directo mientras no se diga otra cosa). */
      else if (!v) pon(((VARIANTES[t.accion] || [])[0] || {}).tag);
      if (v) pon(v.tag);
    }
    for (const a of Object.values(f.defensa || {})) pon((porSlug.get(a && a.accion) || {}).tag);
  });
  if (pasarYCortar) pon('pasar y cortar');
  /* La situación se cuenta desde el ATAQUE, como en la biblioteca: la
     defensa mide al revés (§8.2), y un 2c1 es inferioridad para ella. */
  const situacion = papeles && papeles.inicio.situacion;
  if (situacion === 'inferioridad') pon('superioridad');
  if (situacion === 'superioridad') pon('inferioridad');
  const etiquetas = sinFinalizar ? tags.filter((t) => !FINALIZA.test(t)) : tags;

  /* EL MATERIAL: lo que hay en la pizarra, con los nombres que ofrece el
     paso 3. */
  const hayKind = (k) => elementos.some((e) => e.kind === k);
  const material = [
    hayKind('balon') ? 'balones' : null,
    hayKind('cono') ? 'conos' : null,
    hayKind('escalera') ? 'escaleras' : null,
    hayKind('pelota') ? 'pelotas de tenis' : null,
  ].filter(Boolean);

  /* EL DESARROLLO: la frase de cada fase dibujada —la reescrita si la
     hay, que es la que manda para la ficha (§9.2)—, numeradas si son
     varias. Las fases vacías no se reproducen, y no cuentan. */
  let automaticas = [];
  try { automaticas = frasesDeJugada({ ...j, fases, elementos }); } catch { automaticas = []; }
  const lineas = fases
    .map((f, i) => (f.tramos.length ? ((typeof f.texto === 'string' && f.texto.trim()) || automaticas[i] || '').trim() : ''))
    .filter(Boolean);
  const desarrollo = lineas.length > 1 ? lineas.map((l, i) => `${i + 1}. ${l}`).join('\n') : (lineas[0] || '');

  const category = contenidoDe(usadas, { hayDefensa, pasarYCortar, dichas });
  return { category: category && esBloqueValido(category) ? category : null, tags: etiquetas, material, desarrollo };
}

const NOMBRE = { category: 'el contenido', tags: 'las etiquetas', material: 'el material', descripcion_texto: 'el desarrollo' };
const vacio = (v) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim());
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Dónde vive cada campo en el borrador. */
const leer = (d, k) => (k === 'material' ? (d.requisitos || {}).material : d[k]);
function escribir(d, k, v) {
  if (k === 'material') { d.requisitos = d.requisitos || {}; d.requisitos.material = v; } else d[k] = v;
}

/**
 * RELLENA LA FICHA con lo que propone la pizarra: donde está vacía, y
 * donde sigue lo que se trajo la vez anterior. Toca el borrador que
 * recibe, y apunta lo que ha traído.
 *
 * @returns { puestos } — los campos que han cambiado, con su nombre de
 *          cara al entrenador
 */
export function llevarAlPaso3(draft, jugada) {
  const d = draft;
  const p = propuestaDesdeLaJugada(jugada);
  const propuesto = { category: p.category, tags: p.tags, material: p.material, descripcion_texto: p.desarrollo };
  const antes = d.traido_de_la_pizarra || {};
  const traido = {};
  const puestos = [];
  for (const k of CAMPOS) {
    const actual = leer(d, k);
    const libre = vacio(actual) || (k in antes && igual(antes[k], actual));
    if (!libre) continue;   // lo ha escrito el entrenador: no se toca
    const nuevo = vacio(propuesto[k]) ? (Array.isArray(actual) ? [] : k === 'category' ? null : '') : propuesto[k];
    if (!igual(actual, nuevo)) {
      escribir(d, k, Array.isArray(nuevo) ? [...nuevo] : nuevo);
      if (!vacio(nuevo)) puestos.push(NOMBRE[k]);
    }
    if (!vacio(nuevo)) traido[k] = Array.isArray(nuevo) ? [...nuevo] : nuevo;
  }
  d.traido_de_la_pizarra = traido;
  return { puestos };
}

/** ¿Este valor de este campo es el que trajo la pizarra, sin tocar? Lo
 *  pregunta el puente al chat, que puede ponerle encima lo suyo. */
export function esTraidoDeLaPizarra(d, campo, valor) {
  const t = (d && d.traido_de_la_pizarra) || {};
  return campo in t && igual(t[campo], valor);
}

/** Lo que dura una VUELTA COMPLETA de lo dibujado, en ms: todas las
 *  fases con sus pausas —y, con ellas, todas las rondas—. */
export function duracionDeUnaVuelta(animacion) {
  return ((animacion && animacion.fases) || [])
    .reduce((s, f) => s + (Number(f && f.duracion_ms) || 0) + (Number(f && f.pausa_post_ms) || 0), 0);
}
