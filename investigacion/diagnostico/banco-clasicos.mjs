/* ============================================================
   banco-clasicos.mjs — DIAGNÓSTICO (capa 1 del plan del motor).

     node investigacion/diagnostico/banco-clasicos.mjs

   NO es un banco de pruebas: no falla nunca por lo que encuentra. Monta
   diez ejercicios clásicos de base sobre un Tablero de verdad, igual que
   eval-referencia.mjs, y por cada uno cuenta:

     · si cada paso se pudo dibujar (o por qué se rechazó);
     · si la jugada compila sin avisos;
     · qué hace el balón y qué hace la defensa, muestreado en el tiempo
       sobre el mismo motor que reproduce (AnimationEngine).

   Cada hallazgo sale con un código para poder citarlo:
     [FALLO]  algo que debería funcionar y no funciona;
     [FALTA]  una capacidad que decidimos tener y todavía no existe;
     [OK]     comprobado.
   ============================================================ */

function falso() {
  const datos = { nodeType: 1, style: { setProperty() {} }, dataset: {}, children: [], hidden: false };
  const clases = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  return new Proxy(datos, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'classList') return clases;
      if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
      if (k === 'querySelector') return () => null;
      if (k === 'querySelectorAll') return () => [];
      if (k === 'firstChild') return t.children[0] || falso();
      if (k === 'append' || k === 'appendChild') return (...c) => { t.children.push(...c); return c[0]; };
      if (typeof k === 'symbol') return undefined;
      return () => falso();
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
globalThis.document = {
  createElementNS: () => falso(), createElement: () => falso(), createTextNode: () => falso(),
  createDocumentFragment: () => falso(), body: falso(), addEventListener() {}, removeEventListener() {},
};
globalThis.window = globalThis;
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.getComputedStyle = () => ({});

const base = '../../taller/js';
const { Tablero } = await import(`${base}/pizarra/tablero.js`);
const { compilar, nombreEnLaAnimacion } = await import(`${base}/pizarra/motor/compilar.js`);
const { AnimationEngine } = await import(`${base}/canvas/engine.js`);
const { reiniciarIds } = await import(`${base}/pizarra/elementos.js`);
const { posicionesDe } = await import(`${base}/canvas/anclas.js`);
const { nuevoTrazo } = await import(`${base}/pizarra/trazo.js`);
const { tipoFlecha } = await import(`${base}/pizarra/dibujo.js`);

/* ── el entorno ───────────────────────────────────────────── */

function tableroDe(pista) {
  const avisos = [];
  const t = new Tablero({
    el: falso(),
    vista: { pistaKey: pista, toPx: (x, y) => [x * 800, y * 600], vw: 800, vh: 600, hairline: (p) => p },
    capa: () => () => {}, gesto: () => () => {}, pintar() {}, metros: (px) => px / 100, agarre: (r) => r, cancelarGestos() {},
  }, {
    canasta: 'norte',
    onNoPuede: (a, motivo) => avisos.push(`${a && a.nombre}: ${motivo}`),
    onSinSoporte: (a) => avisos.push(`${a && a.nombre}: sin soporte`),
  });
  t.poner([]);
  return { t, avisos };
}

const sitios = (pista) => Object.fromEntries(Object.entries(posicionesDe(pista, 'norte')).map(([k, [x, y]]) => [k, { x, y }]));
const ficha = (t, id) => t.fichas.elementos.find((e) => e.id === id);

/* Los gestos del entrenador, como en dev/jugadas-referencia.js. */
const G = {
  jugador(t, equipo, en) { const e = t.anadirFicha({ kind: 'jugador', equipo }, en); t.cerrar(); return e.id; },
  balon(t, id) { const j = ficha(t, id); t.anadirFicha({ kind: 'balon' }, { x: j.x, y: j.y }); t.cerrar(); },
  cono(t, en) { const e = t.anadirFicha({ kind: 'cono' }, en); t.cerrar(); return e.id; },
  va(t, id, slug, hasta, variante = null) {
    const e = ficha(t, id); const accion = t._accionDe(slug);
    t._trazoHecho({ elemento: e, accion, variante, trazo: nuevoTrazo({ x: e.x, y: e.y }, hasta), tipo: tipoFlecha(accion) });
    t.cerrar();
  },
  pasa(t, id, aQuien, variante = null) { const r = ficha(t, aQuien); G.va(t, id, 'pasa', { x: r.x, y: r.y }, variante); },
  hace(t, id, slug, op = {}) { t._tocarFicha(ficha(t, id)); t._elegir(slug, op); t.cerrar(); },
  bloquea(t, id, aQuien, variante = 'directo') {
    t._tocarFicha(ficha(t, id)); t._elegir('bloquea', { variante });
    t._companeroElegido(ficha(t, aQuien), { elemento: ficha(t, id), accion: t._accionDe('bloquea'), variante });
    t.cerrar();
  },
  siguiente(t) { t.cerrar(); t.repaso.parar(); t._cerrarFase(); },
  fila(t, en, parcial) { const c = G.cono(t, en); t.hacerFila(c, parcial); return { cono: c, gente: t.fichas.elementos.filter((e) => e.fila_de === c).sort((a, b) => a.puesto - b.puesto).map((e) => e.id) }; },
};

/* ── muestreo del motor ───────────────────────────────────── */

const d = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity);

function motorDe(anim) {
  const m = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  return m;
}
/** El fotograma de la fase k en el instante t (ms). */
function en(m, k, t) {
  m.k = k; m.phaseElapsed = t;
  return m._computePositions();
}

/* ── el informe ───────────────────────────────────────────── */

const informe = [];
function ejercicio(num, nombre, pista, fn) {
  const r = { num, nombre, pista, pasos: [], hallazgos: [], avisosDeCompilar: [] };
  reiniciarIds();
  const { t, avisos } = tableroDe(pista);
  r.avisos = avisos;
  const ctx = {
    t, S: sitios(pista), r,
    paso(txt, f) { try { const antes = avisos.length; const v = f(); if (avisos.length > antes) r.pasos.push(`✗ ${txt} → ${avisos.slice(antes).join(' / ')}`); else r.pasos.push(`✓ ${txt}`); return v; } catch (e) { r.pasos.push(`✗ ${txt} → ERROR ${e.message}`); return null; } },
    falta(txt) { r.hallazgos.push(`[FALTA] ${txt}`); },
    fallo(txt) { r.hallazgos.push(`[FALLO] ${txt}`); },
    ok(txt) { r.hallazgos.push(`[OK]    ${txt}`); },
  };
  try { fn(ctx); } catch (e) { r.hallazgos.push(`[FALLO] el montaje se rompió: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  /* Compilar y medir, si hay algo dibujado. */
  try {
    t.cerrar();
    const jugada = JSON.parse(JSON.stringify(t.jugada()));
    const anim = compilar(jugada);
    r.avisosDeCompilar = anim.warnings || [];
    r.anim = anim; r.jugada = jugada;
    if (!(anim.fases || []).length) r.hallazgos.push('[FALLO] no salió ninguna fase de la animación');
    else medir(r, anim, ctx);
  } catch (e) { r.hallazgos.push(`[FALLO] no compila: ${e.message}`); }
  informe.push(r);
}

/** Lo que se mide siempre, lo haga el ejercicio que lo haga. */
function medir(r, anim) {
  const m = motorDe(anim);
  const balones = (anim.balones || []).map((b) => b.id);
  const jug = (anim.jugadores || []);
  const duenosDuplicados = new Set();
  anim.fases.forEach((f, k) => {
    const fin = en(m, k, f.duracion_ms);
    for (const b of balones) {
      const o = fin.duenos[b];
      if (o && fin.players[o]) {
        const lejos = d(fin.balls[b], fin.players[o]);
        if (lejos > 0.05) r.hallazgos.push(`[FALLO] fase ${k + 1}: el balón ${b} es de ${o} pero está a ${lejos.toFixed(2)} de él al acabar`);
      }
    }
    const cuenta = {};
    for (const b of balones) { const o = fin.duenos[b]; if (o) cuenta[o] = (cuenta[o] || 0) + 1; }
    for (const [o, n] of Object.entries(cuenta)) if (n > 1) duenosDuplicados.add(`fase ${k + 1}: ${o} tiene ${n} balones`);
    /* ¿Cada pase llega a quien lo recibe, y en el instante en que llega está ahí? */
    for (const p of f.pases || []) {
      const llega = (p.inicio_ms || 0) + (p.duracion_ms || f.duracion_ms);
      const e = en(m, k, Math.min(llega, f.duracion_ms));
      const quien = p.a_id;
      if (quien && e.players[quien]) {
        const lejos = d(e.balls[p.balon_id], e.players[quien]);
        if (lejos > 0.06) r.hallazgos.push(`[FALLO] fase ${k + 1}: el pase a ${quien} llega a ${lejos.toFixed(2)} de él (el receptor no está donde cae el balón)`);
      }
    }
    /* ¿Cada tiro deja el balón suelto? */
    for (const tr of f.tiros || []) {
      if (fin.duenos[tr.balon_id]) r.hallazgos.push(`[FALLO] fase ${k + 1}: tras tirar, el balón ${tr.balon_id} sigue siendo de ${fin.duenos[tr.balon_id]}`);
    }
    /* ¿El balón sigue a quien bota, a mitad de cada tramo suyo? */
    for (const mv of f.movimientos || []) {
      if (mv.tipo_elemento !== 'jugador') continue;
      const quien = mv.elemento_id;
      const ini = mv.inicio_ms || 0, dur = mv.duracion_ms || f.duracion_ms;
      const mitad = en(m, k, ini + dur / 2);
      const dueno = Object.entries(mitad.duenos).find(([, o]) => o === quien);
      if (dueno) {
        const lejos = d(mitad.balls[dueno[0]], mitad.players[quien]);
        if (lejos > 0.05) r.hallazgos.push(`[FALLO] fase ${k + 1}: ${quien} lleva el balón ${dueno[0]} pero a mitad de su recorrido está a ${lejos.toFixed(2)}`);
      }
    }
    /* La defensa: ¿cerca de alguien, o perdida? */
    for (const dfn of f.defensores || []) {
      const p = fin.players[dfn];
      if (!p) continue;
      const atacantes = jug.filter((j) => !(f.defensores || []).includes(j.id)).map((j) => fin.players[j.id]).filter(Boolean);
      const cerca = Math.min(...atacantes.map((a) => d(a, p)));
      if (atacantes.length && cerca > 0.2) r.hallazgos.push(`[FALLO] fase ${k + 1}: el defensor ${dfn} acaba a ${cerca.toFixed(2)} del atacante más cercano (perdido)`);
    }
  });
  for (const x of duenosDuplicados) r.hallazgos.push(`[FALLO] ${x}`);
  if (!r.hallazgos.some((h) => h.startsWith('[FALLO]'))) r.hallazgos.push('[OK]    balones, pases, tiros y defensa coherentes en el muestreo');
}

/* ── los diez ─────────────────────────────────────────────── */

ejercicio(1, 'Bandejas por filas', 'media', ({ t, S, paso, falta, fallo, ok, r }) => {
  const A = paso('fila A (4, con balón) en el ala', () => G.fila(t, { x: 0.62, y: 0.78 }, { n: 4, equipo: 'A', balon: true, orientacion: 0 }));
  const B = paso('fila B (3, rebotistas) bajo el aro', () => G.fila(t, { x: 0.27, y: 0.34 }, { n: 3, equipo: 'A', balon: false, orientacion: 90 }));
  if (!A || !B) return;
  const a1 = A.gente[0], b1 = B.gente[0];
  paso('A1 bota hacia el aro', () => G.va(t, a1, 'bota', { x: 0.34, y: 0.62 }));
  paso('A1 entra a canasta (bandeja)', () => G.hace(t, a1, 'entra', { variante: 'bandeja' }));
  const j = JSON.parse(JSON.stringify(t.jugada()));
  const entra = j.fases[0].tramos.find((x) => x.accion === 'entra');
  if (entra && !entra.desenlace) falta('«Entra a canasta» no tiene desenlace (entra/falla): no suelta el balón como un tiro');
  paso('siguiente fase', () => G.siguiente(t));
  paso('B1 recoge el balón suelto', () => G.hace(t, b1, 'recoge'));
  paso('A1 vuelve a la fila', () => G.hace(t, a1, 'vuelve_a_fila'));
  paso('B1 vuelve a la fila', () => G.hace(t, b1, 'vuelve_a_fila'));
  if (typeof t.establecerRotacion !== 'function') falta('rotación entre las dos filas (cadena de conos): no existe «Establecer rotación»');
  /* ¿tras la entrada el balón está suelto? */
  try {
    const anim = compilar(JSON.parse(JSON.stringify(t.jugada())));
    const m = motorDe(anim);
    const f1 = anim.fases[0];
    const fin = en(m, 0, f1.duracion_ms);
    const nombre = nombreEnLaAnimacion(ficha(t, a1));
    const dueno = Object.values(fin.duenos).filter(Boolean);
    if (dueno.includes(nombre)) fallo(`fase 1: tras «entra» el balón sigue siendo de ${nombre} al acabar la fase: no queda suelto (y la fase 2 no puede «recoger»)`);
    else ok('tras «entra» el balón queda suelto');
  } catch (e) { fallo(`no se pudo medir la entrada: ${e.message}`); }
});

ejercicio(2, 'Pase y corte 2x0', 'media', ({ t, S, paso, falta, fallo, r }) => {
  const a1 = paso('A1 con balón en el ala derecha', () => { const id = G.jugador(t, 'A', S.alero_der); G.balon(t, id); return id; });
  const a2 = paso('A2 en la punta', () => G.jugador(t, 'A', S.escolta_izq));
  if (!a1 || !a2) return;
  paso('A1 pasa a A2', () => G.pasa(t, a1, a2));
  paso('A1 corta hacia el aro', () => G.va(t, a1, 'corta', { x: 0.24, y: 0.58 }));
  paso('A2 pasa a A1 MIENTRAS A1 CORTA (misma fase)', () => G.pasa(t, a2, a1));
  paso('A1 entra', () => G.hace(t, a1, 'entra', { variante: 'bandeja' }));
  /* ¿El pase de A2 sale cuando A1 ya está cortando? */
  try {
    const anim = compilar(JSON.parse(JSON.stringify(t.jugada())));
    const f = anim.fases[0];
    const p1 = f.pases[0], p2 = f.pases[1];
    const mvA1 = f.movimientos.find((x) => x.tipo_elemento === 'jugador');
    const lineas = [];
    lineas.push(`pase 1: ${p1 && p1.inicio_ms}-${p1 && (p1.inicio_ms + p1.duracion_ms)} ms`);
    lineas.push(`corte de A1: ${mvA1 && mvA1.inicio_ms}-${mvA1 && (mvA1.inicio_ms + mvA1.duracion_ms)} ms`);
    lineas.push(`pase 2 (a A1 cortando): ${p2 && p2.inicio_ms}-${p2 && (p2.inicio_ms + p2.duracion_ms)} ms`);
    r.hallazgos.push('[DATO]  ' + lineas.join(' · '));
    if (p2 && mvA1 && p2.inicio_ms >= mvA1.inicio_ms + mvA1.duracion_ms - 1) fallo('el segundo pase sale cuando A1 YA HA ACABADO de cortar: A1 no recibe en carrera, espera a que acabe');
    else if (p2 && mvA1) r.hallazgos.push('[DATO]  el segundo pase sale mientras A1 todavía corta: se solapan');
  } catch (e) { fallo(`no se pudo medir el pase en carrera: ${e.message}`); }
  falta('pase en carrera: elegir un punto del corte del receptor y que él no espere');
  if (typeof t.establecerRotacion !== 'function') falta('rotación de filas');
});

ejercicio(3, 'Tiro con rotación (tres conos)', 'media', ({ t, S, paso, falta, fallo }) => {
  const c1 = paso('cono 1 (tirador) en el codo', () => G.cono(t, S.codo_der));
  const c2 = paso('cono 2 (pasador) en la punta', () => G.cono(t, { x: 0.46, y: 0.5 }));
  const c3 = paso('cono 3 (rebotista) bajo el aro', () => G.cono(t, S.poste_bajo_izq));
  const tir = paso('tirador A1 en el cono 1 con balón', () => { const id = G.jugador(t, 'A', S.codo_der); G.balon(t, id); return id; });
  const pas = paso('pasador A2 en el cono 2', () => G.jugador(t, 'A', { x: 0.46, y: 0.5 }));
  const reb = paso('rebotista A3 en el cono 3', () => G.jugador(t, 'A', S.poste_bajo_izq));
  if (!tir || !pas || !reb) return;
  paso('A1 tira y falla', () => G.hace(t, tir, 'tira', { variante: 'suspension', desenlace: 'falla' }));
  paso('siguiente fase', () => G.siguiente(t));
  paso('A3 recoge', () => G.hace(t, reb, 'recoge'));
  paso('A3 pasa a A2', () => G.pasa(t, reb, pas));
  falta('rotación 1→2→3→1: «Establecer rotación» en el cono y acción «rotar de fila» en el jugador');
  void c1; void c2; void c3;
});

ejercicio(4, '1c1 desde la punta con rotación atacante/defensor', 'media', ({ t, S, paso, falta }) => {
  const a1 = paso('A1 en la punta con balón', () => { const id = G.jugador(t, 'A', S.base); G.balon(t, id); return id; });
  const b1 = paso('B1 defensor', () => G.jugador(t, 'B', { x: 0.42, y: 0.5 }));
  if (!a1 || !b1) return;
  paso('A1 bota hacia el aro', () => G.va(t, a1, 'bota', { x: 0.3, y: 0.58 }));
  paso('A1 tira', () => G.hace(t, a1, 'tira', { variante: 'suspension', desenlace: 'entra' }));
  paso('siguiente fase', () => G.siguiente(t));
  paso('B1 recoge el rebote', () => G.hace(t, b1, 'recoge'));
  falta('rotación: A1 pasa a defender (equipo y color de la fila de destino) y B1 va a la fila');
  falta('acción «Cambia de equipo» en el anillo (decidida y conservada)');
});

ejercicio(5, 'Zigzag con conos y bote', 'media', ({ t, S, paso, falta }) => {
  const F = paso('fila de 4 con balón', () => G.fila(t, { x: 0.66, y: 0.5 }, { n: 4, equipo: 'A', balon: true, orientacion: 0 }));
  if (!F) return;
  for (const x of [0.56, 0.48, 0.40, 0.32]) paso(`cono de zigzag en ${x}`, () => G.cono(t, { x, y: 0.5 }));
  paso('el primero bota hasta el último cono', () => G.va(t, F.gente[0], 'bota', { x: 0.27, y: 0.5 }));
  paso('entra', () => G.hace(t, F.gente[0], 'entra', { variante: 'bandeja' }));
  paso('vuelve a la fila', () => G.hace(t, F.gente[0], 'vuelve_a_fila'));
  const jugada = t.jugada();
  const tr = jugada.fases[0].tramos.find((x) => x.accion === 'bota');
  if (tr && !(tr.args && tr.args.sorteando && tr.args.sorteando.length) && !tr.sorteando) falta('el bote entre los conos no guarda que sortea cada cono (zigzag): va en línea recta con los conos a un lado');
});

ejercicio(6, 'Tres en línea, 3 contra 0 en carrera (pista entera)', 'entera', ({ t, S, paso, falta }) => {
  const a1 = paso('A1 izquierda', () => G.jugador(t, 'A', { x: 0.2, y: 0.9 }));
  const a2 = paso('A2 centro con balón', () => { const id = G.jugador(t, 'A', { x: 0.5, y: 0.9 }); G.balon(t, id); return id; });
  const a3 = paso('A3 derecha', () => G.jugador(t, 'A', { x: 0.8, y: 0.9 }));
  if (!a1 || !a2 || !a3) return;
  paso('A2 pasa a A1', () => G.pasa(t, a2, a1));
  paso('A2 corre por detrás de A1', () => G.va(t, a2, 'corta', { x: 0.25, y: 0.7 }));
  paso('A1 pasa a A3 EN CARRERA', () => G.pasa(t, a1, a3));
  paso('A1 corre por detrás de A3', () => G.va(t, a1, 'corta', { x: 0.75, y: 0.6 }));
  paso('siguiente fase', () => G.siguiente(t));
  paso('A3 pasa a A2', () => G.pasa(t, a3, a2));
  paso('A3 corre detrás', () => G.va(t, a3, 'corta', { x: 0.5, y: 0.4 }));
  falta('pase en carrera encadenado: cada pase debe llegar a quien ya va corriendo');
});

ejercicio(7, '3 contra 2 con vuelta', 'media', ({ t, S, paso, falta }) => {
  const a1 = paso('A1', () => G.jugador(t, 'A', S.base));
  const a2 = paso('A2 con balón', () => { const id = G.jugador(t, 'A', S.alero_der); G.balon(t, id); return id; });
  const a3 = paso('A3', () => G.jugador(t, 'A', S.alero_izq));
  const b1 = paso('B1', () => G.jugador(t, 'B', { x: 0.32, y: 0.4 }));
  const b2 = paso('B2', () => G.jugador(t, 'B', { x: 0.32, y: 0.6 }));
  if (!a1 || !a2 || !a3 || !b1 || !b2) return;
  paso('A2 pasa a A1', () => G.pasa(t, a2, a1));
  paso('A1 pasa a A3', () => G.pasa(t, a1, a3));
  paso('A3 tira', () => G.hace(t, a3, 'tira', { variante: 'suspension', desenlace: 'falla' }));
  paso('siguiente fase', () => G.siguiente(t));
  paso('B1 recoge el rebote (cambio de posesión)', () => G.hace(t, b1, 'recoge'));
  paso('B1 bota hacia el otro lado', () => G.va(t, b1, 'bota', { x: 0.7, y: 0.5 }));
  falta('al recoger el rebote B1 pasa a ATACAR y A pasa a defender (rotación de papeles en cambio de posesión)');
});

ejercicio(8, 'Bloqueo directo 2c2', 'media', ({ t, S, paso, falta }) => {
  const a1 = paso('A1 con balón', () => { const id = G.jugador(t, 'A', S.base); G.balon(t, id); return id; });
  const a2 = paso('A2 bloqueador', () => G.jugador(t, 'A', S.codo_izq));
  const b1 = paso('B1', () => G.jugador(t, 'B', { x: 0.4, y: 0.5 }));
  const b2 = paso('B2', () => G.jugador(t, 'B', { x: 0.3, y: 0.38 }));
  if (!a1 || !a2) return;
  paso('A2 bloquea para A1', () => G.bloquea(t, a2, a1));
  paso('A1 bota usando el bloqueo', () => G.va(t, a1, 'bota', { x: 0.3, y: 0.62 }));
  paso('A2 rueda al aro', () => G.va(t, a2, 'corta', { x: 0.2, y: 0.45 }));
  paso('A1 pasa a A2 EN CARRERA', () => G.pasa(t, a1, a2));
  paso('A2 tira', () => G.hace(t, a2, 'tira', { variante: 'suspension', desenlace: 'entra' }));
  void b1; void b2;
});

ejercicio(9, 'Jugada 5x0 con ramas (colocación 1-4 alto)', 'media', ({ t, S, paso, falta }) => {
  const a1 = paso('A1 con balón (el 1)', () => { const id = G.jugador(t, 'A', S.base); G.balon(t, id); return id; });
  const a2 = paso('A2', () => G.jugador(t, 'A', S.codo_der));
  const a3 = paso('A3', () => G.jugador(t, 'A', S.codo_izq));
  const a4 = paso('A4', () => G.jugador(t, 'A', S.alero_der));
  const a5 = paso('A5', () => G.jugador(t, 'A', S.alero_izq));
  if (![a1, a2, a3, a4, a5].every(Boolean)) return;
  paso('A1 pasa a A4', () => G.pasa(t, a1, a4));
  paso('A2 bloquea para A5', () => G.bloquea(t, a2, a5, 'indirecto'));
  paso('siguiente fase', () => G.siguiente(t));
  paso('A4 pasa a A5', () => G.pasa(t, a4, a5));
  paso('A5 tira', () => G.hace(t, a5, 'tira', { variante: 'tras_recepcion', desenlace: 'entra' }));
  paso('rama «si le niegan»', () => { t.irAFase(0); t.abrirRama({ primera: 'si le dejan', nueva: 'si le niegan' }); G.va(t, a3, 'corta', S.poste_bajo_izq); G.pasa(t, a4, a3); t.irAFase(0); });
  ok_si(t, 'colocación de serie «1-4 alto»', typeof t.colocarSerie === 'function', falta);
});

ejercicio(10, 'Pases en parejas en movimiento (calentamiento)', 'entera', ({ t, S, paso, falta }) => {
  const parejas = [];
  for (const x of [0.2, 0.5, 0.8]) {
    const a = paso(`pareja en x=${x}: izquierda con balón`, () => { const id = G.jugador(t, 'A', { x: x - 0.04, y: 0.85 }); G.balon(t, id); return id; });
    const b = paso(`pareja en x=${x}: derecha`, () => G.jugador(t, 'A', { x: x + 0.04, y: 0.85 }));
    parejas.push([a, b]);
  }
  for (const [a, b] of parejas) { if (!a || !b) continue; paso('pase de ida', () => G.pasa(t, a, b)); }
  paso('siguiente fase', () => G.siguiente(t));
  for (const [a, b] of parejas) { if (!a || !b) continue; paso('pase de vuelta', () => G.pasa(t, b, a)); }
  paso('avanzan por la pista', () => { for (const [a, b] of parejas) { if (a) G.va(t, a, 'corta', { x: ficha(t, a).x, y: 0.4 }); if (b) G.va(t, b, 'corta', { x: ficha(t, b).x, y: 0.4 }); } });
  falta('pasar mientras se avanza: el pase debe hacerse con los dos en movimiento');
});

function ok_si(t, txt, cond, falta) { if (!cond) falta(txt + ': no hay colocaciones de serie, hay que montarla ficha a ficha'); }

/* ── salida ───────────────────────────────────────────────── */

let nFallo = 0, nFalta = 0;
for (const r of informe) {
  console.log(`\n=== ${r.num}. ${r.nombre} (${r.pista}) ===`);
  for (const p of r.pasos) console.log('  ' + p);
  if (r.avisosDeCompilar.length) for (const w of r.avisosDeCompilar) console.log('  [AVISO AL COMPILAR] ' + w);
  for (const h of [...new Set(r.hallazgos)]) { console.log('  ' + h); if (h.startsWith('[FALLO]')) nFallo++; if (h.startsWith('[FALTA]')) nFalta++; }
}
console.log(`\nResumen: ${informe.length} ejercicios · ${nFallo} fallos · ${nFalta} capacidades que faltan`);
