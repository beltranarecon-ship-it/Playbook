/* ============================================================
   dev/jugadas-referencia.js — las doce jugadas de referencia
   (ESPEC-PIZARRA-v3 §13): de un 1x0 de tiro a un 3x3 con ramas.

   NO se sirve en producción. Cada jugada se DIBUJA sobre un Tablero de
   verdad, con los mismos gestos que hace el entrenador —poner fichas,
   elegir una acción, trazar hasta un sitio, «Siguiente fase»—, así que
   lo que sale es exactamente lo que guardaría la Pizarra.

   Las usan dos sitios:
     · taller/tools/eval-referencia.mjs, que las compila en Node y
       comprueba que salen sin avisos y vuelven a abrirse igual;
     · dev/jugadas.html, que las enseña animadas para mirar con los ojos
       lo que los bancos miden.
   ============================================================ */

import { posicionesDe } from '../taller/js/canvas/anclas.js';
import { nuevoTrazo } from '../taller/js/pizarra/trazo.js';
import { tipoFlecha } from '../taller/js/pizarra/dibujo.js';

/* ── los gestos del entrenador, en una línea cada uno ─────── */

const sitios = (pista, canasta = 'norte') => Object.fromEntries(
  Object.entries(posicionesDe(pista, canasta)).map(([k, [x, y]]) => [k, { x, y }]));
const ficha = (t, id) => t.fichas.elementos.find((e) => e.id === id);

/** Pone un jugador (y devuelve su id). */
function jugador(t, equipo, en) {
  const e = t.anadirFicha({ kind: 'jugador', equipo }, en);
  t.cerrar();
  return e.id;
}
/** Le da un balón a un jugador. */
function balon(t, id) {
  const j = ficha(t, id);
  t.anadirFicha({ kind: 'balon' }, { x: j.x, y: j.y });
  t.cerrar();
}
function cono(t, en) {
  const e = t.anadirFicha({ kind: 'cono' }, en);
  t.cerrar();
  return e.id;
}
/** Una acción con destino: bota, corta. */
function va(t, id, slug, hasta, variante = null) {
  const e = ficha(t, id);
  const accion = t._accionDe(slug);
  t._trazoHecho({ elemento: e, accion, variante, trazo: nuevoTrazo({ x: e.x, y: e.y }, hasta), tipo: tipoFlecha(accion) });
  t.cerrar();
}
/** Un pase a un compañero. */
function pasa(t, id, aQuien, variante = null) {
  const r = ficha(t, aQuien);
  va(t, id, 'pasa', { x: r.x, y: r.y }, variante);
}
/** Lo que no pide destino: entra, tira, recoge, vuelve a la fila, un gesto. */
function hace(t, id, slug, opciones = {}) {
  t._tocarFicha(ficha(t, id));
  t._elegir(slug, opciones);
  t.cerrar();
}
function bloquea(t, id, aQuien, variante = 'directo') {
  t._tocarFicha(ficha(t, id));
  t._elegir('bloquea', { variante });
  t._companeroElegido(ficha(t, aQuien), { elemento: ficha(t, id), accion: t._accionDe('bloquea'), variante });
  t.cerrar();
}
const siguiente = (t) => { t.cerrar(); t.repaso.parar(); t._cerrarFase(); };

/* ── las doce ──────────────────────────────────────────────── */

export const JUGADAS_DE_REFERENCIA = [
  {
    nombre: '1 · 1x0: bota y tira',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', S.base);
      balon(t, a1);
      va(t, a1, 'bota', S.codo_der);
      hace(t, a1, 'tira', { variante: 'suspension', desenlace: 'entra' });
    },
  },
  {
    nombre: '2 · 1x0: finta y entrada',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', S.alero_der);
      balon(t, a1);
      hace(t, a1, 'finta');
      hace(t, a1, 'entra', { variante: 'bandeja' });
      hace(t, a1, 'tira', { variante: 'suspension', desenlace: 'entra' });
    },
  },
  {
    nombre: '3 · 2x0: pasar y cortar',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', S.base);
      const a2 = jugador(t, 'A', S.alero_der);
      balon(t, a1);
      pasa(t, a1, a2);
      va(t, a1, 'corta', S.poste_bajo_izq, 'puerta_atras');
      siguiente(t);
      pasa(t, a2, a1, 'picado');
      hace(t, a1, 'tira', { variante: 'suspension', desenlace: 'entra' });
    },
  },
  {
    nombre: '4 · 1x0: zigzag entre conos',
    pista: 'entera',
    montar(t) {
      const a1 = jugador(t, 'A', { x: 0.5, y: 0.66 });
      balon(t, a1);
      for (const y of [0.56, 0.48, 0.40]) cono(t, { x: 0.5, y });
      va(t, a1, 'bota', { x: 0.5, y: 0.31 });
      siguiente(t);
      hace(t, a1, 'entra', { variante: 'doble_ritmo' });
      hace(t, a1, 'tira', { variante: 'suspension', desenlace: 'entra' });
    },
  },
  {
    nombre: '5 · 2x0: por la puerta y pase',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', { x: 0.42, y: 0.60 });
      const a2 = jugador(t, 'A', S.alero_der);
      balon(t, a1);
      cono(t, { x: 0.38, y: 0.46 });
      cono(t, { x: 0.46, y: 0.46 });
      va(t, a1, 'bota', { x: 0.42, y: 0.34 });
      pasa(t, a1, a2, 'pecho');
      siguiente(t);
      hace(t, a2, 'tira', { variante: 'tras_recepcion', desenlace: 'entra' });
    },
  },
  {
    nombre: '6 · Fila: bota, tira, rebote y vuelve',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const c = cono(t, { x: 0.5, y: 0.56 });
      t.hacerFila(c, { n: 4, equipo: 'A', balon: true, orientacion: 90 });
      const primero = t.fichas.elementos.find((e) => e.fila_de === c && e.puesto === 0).id;
      va(t, primero, 'bota', S.tiro_libre);
      hace(t, primero, 'tira', { variante: 'suspension', desenlace: 'falla' });
      hace(t, primero, 'recoge');
      hace(t, primero, 'vuelve_a_fila');
    },
  },
  {
    nombre: '7 · 2x2: bloqueo directo y continuación',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', S.escolta_der);
      const a2 = jugador(t, 'A', S.poste_alto_der);
      balon(t, a1);
      jugador(t, 'B', { x: 0.62, y: 0.26 });
      jugador(t, 'B', { x: 0.6, y: 0.16 });
      bloquea(t, a2, a1);
      va(t, a1, 'bota', S.codo_izq);
      va(t, a2, 'corta', { x: 0.54, y: 0.14 });
      siguiente(t);
      pasa(t, a1, a2, 'picado');
      hace(t, a2, 'tira', { variante: 'suspension', desenlace: 'entra' });
    },
  },
  {
    nombre: '8 · 2x1: fijar y doblar',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', { x: 0.5, y: 0.45 });
      const a2 = jugador(t, 'A', S.alero_izq);
      balon(t, a1);
      jugador(t, 'B', S.tiro_libre);
      va(t, a1, 'bota', S.codo_der);
      siguiente(t);
      pasa(t, a1, a2);
      siguiente(t);
      hace(t, a2, 'entra', { variante: 'bandeja' });
      hace(t, a2, 'tira', { variante: 'suspension', desenlace: 'entra' });
    },
  },
  {
    nombre: '9 · 2x1: robo y contraataque',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', S.base);
      const a2 = jugador(t, 'A', S.alero_der);
      balon(t, a1);
      const b1 = jugador(t, 'B', { x: 0.66, y: 0.22 });
      pasa(t, a1, a2);
      t.declararDefensa(b1, { accion: 'roba', objetivo_id: a2 });
      siguiente(t);
      va(t, b1, 'bota', { x: 0.6, y: 0.6 });
    },
  },
  {
    nombre: '10 · 3x3 con ramas: si le dejan o si le niegan',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', S.base);
      const a2 = jugador(t, 'A', S.alero_der);
      const a3 = jugador(t, 'A', S.alero_izq);
      balon(t, a1);
      jugador(t, 'B', { x: 0.5, y: 0.27 });
      jugador(t, 'B', { x: 0.74, y: 0.2 });
      jugador(t, 'B', { x: 0.26, y: 0.2 });
      va(t, a2, 'corta', { x: 0.74, y: 0.31 }, 'en_v');
      siguiente(t);
      pasa(t, a1, a2);
      hace(t, a2, 'tira', { variante: 'tras_recepcion', desenlace: 'entra' });
      t.irAFase(0);
      t.abrirRama({ primera: 'si le dejan', nueva: 'si le niegan' });
      va(t, a2, 'corta', S.poste_bajo_der, 'puerta_atras');
      pasa(t, a1, a3);
      t.irAFase(0);
    },
  },
  {
    nombre: '11 · 2x1: tiro fallado y rebote de ataque',
    pista: 'entera',
    montar(t) {
      const S = sitios('entera');
      const a1 = jugador(t, 'A', S.codo_der);
      const a2 = jugador(t, 'A', S.poste_bajo_izq);
      balon(t, a1);
      jugador(t, 'B', { x: 0.6, y: 0.18 });
      hace(t, a1, 'tira', { variante: 'suspension', desenlace: 'falla' });
      siguiente(t);
      hace(t, a2, 'recoge');
      hace(t, a2, 'tira', { variante: 'palmeo', desenlace: 'entra' });
    },
  },
  {
    nombre: '12 · Media pista: mano a mano y tiro',
    pista: 'media',
    montar(t) {
      const S = sitios('media');
      const a1 = jugador(t, 'A', S.base);
      const a2 = jugador(t, 'A', S.alero_der);
      balon(t, a1);
      va(t, a1, 'bota', { x: 0.4, y: 0.7 });
      pasa(t, a1, a2, 'mano_a_mano');
      siguiente(t);
      va(t, a2, 'bota', S.codo_der);
      hace(t, a2, 'tira', { variante: 'tras_bote', desenlace: 'entra' });
    },
  },
];
