/* ============================================================
   eval-tablero.mjs — banco Node del Tablero de la Pizarra
   (taller/js/pizarra/tablero.js), con un DOM DE MENTIRA.

     node taller/tools/eval-tablero.mjs

   El Tablero toca el DOM y el canvas, y por eso no tenía banco: todo lo
   que se podía se había sacado a módulos puros. Pero hay fallos que solo
   viven en el pegamento —en qué ORDEN se avisa, qué se estira al mover
   algo— y esos se escapaban. Aquí se monta un Tablero de verdad sobre un
   lienzo y unos nodos de mentira que aceptan cualquier cosa, y se le
   hacen los gestos por sus métodos.

   Lo que NO prueba: cómo se ve. Eso sigue siendo del navegador.
   ============================================================ */

/* Un nodo que acepta cualquier cosa: cualquier propiedad que se le pida
   que no tenga es una función que devuelve otro nodo así. */
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

const { Tablero } = await import('../js/pizarra/tablero.js');
const { Pizarra } = await import('../js/pizarra/pizarra.js');
const { anadir, asignarBalon, reiniciarIds } = await import('../js/pizarra/elementos.js');
const { nuevoTrazo } = await import('../js/pizarra/trazo.js');
const defensaMod = await import('../js/pizarra/motor/defensa.js');
const compilarMod = await import('../js/pizarra/motor/compilar.js');
const { metrosEntre } = await import('../js/canvas/escala.js');

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  const r = JSON.stringify(real), e = JSON.stringify(esp);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
};

function lienzoFalso(pista = 'entera') {
  return {
    el: falso(),
    vista: { pistaKey: pista, toPx: (x, y) => [x * 800, y * 600], vw: 800, vh: 600, hairline: (p) => p },
    capa: () => () => {},
    gesto: () => () => {},
    pintar() {},
    metros: (px) => px / 100,
    agarre: (r) => r,
    cancelarGestos() {},
  };
}

/* Un Tablero con la Pizarra de verdad por encima SOLO para lo que decide
   qué se avisa y cuándo (sus métodos, sin su DOM). */
function montar(pista = 'entera') {
  const avisos = [];
  const t = new Tablero(lienzoFalso(pista), {
    canasta: 'norte',
    onNoPuede: (a, motivo) => avisos.push(['noPuede', a && a.nombre, motivo]),
    onSinSoporte: (a) => avisos.push(['sinSoporte', a && a.nombre, null]),
  });
  const p = Object.create(Pizarra.prototype);
  Object.assign(p, {
    tablero: t, onCambio: null,
    elAviso: { hidden: true, innerHTML: '' },
    el: { querySelector: () => null },
    panel: { recuento() {} },
    linea: { refrescar() {} },
  });
  p.avisar = (html) => avisos.push(html);
  t.onTramos = () => p._cambio();
  t.onFases = () => p._cambio();
  t.onEscena = () => p._cambio();
  return { t, p, avisos };
}
const ficha = (t, id) => t.fichas.elementos.find((e) => e.id === id);
const corta = (t, id, hasta) => t._trazoHecho({ elemento: ficha(t, id), accion: t._accionDe('corta'), variante: null, trazo: nuevoTrazo(ficha(t, id), hasta), tipo: 'cut' });

/* A1, A2, B1 y un balón SUELTO: nadie ataca, así que A2 corta sin
   problema. Luego el balón acaba en B1 y A2 pasa a defender. */
function sinAtacante() {
  reiniciarIds();
  const m = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.30, 0.60);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.45, 0.60);
  l = anadir(l, { kind: 'jugador', equipo: 'B' }, 0.70, 0.60);
  l = anadir(l, { kind: 'balon' }, 0.20, 0.30);
  const [a1, a2, b1, bal] = l;
  m.t.poner(l);
  corta(m.t, a2.id, { x: 0.5, y: 0.35 });
  m.t.cerrar();
  m.avisos.length = 0;
  return { ...m, a1, a2, b1, bal };
}

console.log('· el aviso de «defiende y tiene trazos de ataque»');

test('DAR EL BALÓN DESDE EL PANEL A OTRO EQUIPO AVISA EN EL MISMO GESTO, con una sola fase', () => {
  const { t, avisos, b1 } = sinAtacante();
  t.anadirFicha({ kind: 'balon' }, { x: ficha(t, b1.id).x, y: ficha(t, b1.id).y });
  eq(t.papeles().inicio.ataca, 'B');
  ok(t.tramosQueNoEncajan().length === 1, 'el corte de A2 ya no encaja');
  eq(avisos.length, 1, 'y se dice ahora, no al tocar otra cosa:');
});

test('Y ARRASTRAR EL BALÓN SUELTO ENCIMA DE ALGUIEN, TAMBIÉN', () => {
  const { t, avisos, b1, bal } = sinAtacante();
  t.fichas.seleccion = new Set([bal.id]);
  const g = t.fichas._arrastrar({ x: ficha(t, bal.id).x, y: ficha(t, bal.id).y }, ficha(t, bal.id));
  g.mover({ x: ficha(t, b1.id).x, y: ficha(t, b1.id).y });
  g.soltar({ x: ficha(t, b1.id).x, y: ficha(t, b1.id).y });
  eq(t.fases[0].posesion[bal.id], b1.id, 'el balón es de B1 al empezar:');
  eq(avisos.length, 1, 'y se avisa en el mismo gesto:');
});

test('AL REABRIR, EL AVISO DE LA DEFENSA VA JUNTO A LOS DE LA CARGA, no tapado por ellos', () => {
  const { p, avisos } = montar();
  const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
  p.cargar({
    version: 3, pista: 'entera', canasta: 'norte',
    elementos: [
      { id: 'jugador_1', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6, en_juego: true },
      { id: 'jugador_2', kind: 'jugador', equipo: 'B', label: '1', x: 0.7, y: 0.6, en_juego: true },
      { id: 'balon_3', kind: 'balon', x: 0.5, y: 0.6, portador_id: 'jugador_1' },
    ],
    fases: [{ id: 'f1', tramos: [
      { id: 'tr1', elemento_id: 'jugador_2', corre_id: 'jugador_2', accion: 'corta', trazo: [N(0.7, 0.6), N(0.6, 0.3)], tipo: 'cut', ritmo: 'normal' },
      { id: 'tr2', elemento_id: 'jugador_1', corre_id: 'balon_3', accion: 'tira', trazo: [N(0.5, 0.6), N(0.5, 0.1)], tipo: 'pass', ritmo: 'tiro' },
    ] }],
  });
  const ultimo = avisos[avisos.length - 1];
  ok(/sin desenlace/.test(ultimo) && /defiende y tiene trazos/.test(ultimo), `lo que queda a la vista lo dice todo: ${ultimo}`);
});

console.log('\n· lo dibujado no se deforma solo');

test('SI EL RECEPTOR BOTA DESPUÉS, EL PASE SIGUE ACABANDO DONDE LO RECIBIÓ', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.30, 0.70);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.70, 0.70);
  l = anadir(l, { kind: 'balon' }, 0.34, 0.70);
  const [a1, a2, bal] = l;
  t.poner(asignarBalon(l, bal.id, a1.id, 'entera'));
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), ficha(t, a2.id)), tipo: 'pass' });
  const pase = JSON.stringify(t.tramos[0].trazo);
  t._trazoHecho({ elemento: ficha(t, a2.id), accion: t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(t, a2.id), { x: 0.7, y: 0.4 }), tipo: 'run' });
  eq(JSON.stringify(t.tramos[0].trazo), pase, 'el final del pase no se ha movido:');
  ok(t.tramos[1].trazo[1].y === 0.4, 'y el bote acaba donde se dibujó');
});

console.log('\n· los papeles');

test('QUIÉN DEFIENDE CAMBIA EN CUANTO CAMBIA QUIÉN TIENE EL BALÓN, y el anillo lo sabe', () => {
  const { t, a2, b1 } = sinAtacante();
  eq(t.estadoDe(ficha(t, b1.id)).esDefensor, false, 'sin atacante, nadie defiende:');
  t.anadirFicha({ kind: 'balon' }, { x: ficha(t, b1.id).x, y: ficha(t, b1.id).y });
  eq([t.estadoDe(ficha(t, a2.id)).esDefensor, t.estadoDe(ficha(t, b1.id)).esDefensor], [true, false]);
  eq(t.jugada().defensa.preajuste, 'entre_par_y_aro', 'y la jugada guarda sus ajustes:');
});

console.log('\n· los ajustes de la defensa (§8.1, §8.3)');

/* A1 con balón y A2 del equipo A; nada más. */
function conAtaque() {
  reiniciarIds();
  const m = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.30, 0.50);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.70, 0.50);
  l = anadir(l, { kind: 'balon' }, 0.34, 0.50);
  const [a1, a2, bal] = l;
  m.t.poner(asignarBalon(l, bal.id, a1.id, 'entera'));
  return { ...m, a1, a2, bal };
}

test('AL PONER UN DEFENSOR SE RECOLOCAN TAMBIÉN LOS QUE NO SE HAN MOVIDO A MANO', () => {
  /* 3 contra 2: el primero retrasa; al poner el segundo, el papel pasa a
     uno de los dos y los dos tienen que quedar en su sitio, no encima. */
  const { t } = conAtaque();
  t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.5, y: 0.75 });
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.9, y: 0.9 });
  const b2 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.1, y: 0.9 });
  const d = Math.hypot(ficha(t, b1.id).x - ficha(t, b2.id).x, ficha(t, b1.id).y - ficha(t, b2.id).y);
  ok(d > 0.02, `no quedan uno encima de otro: ${d.toFixed(4)}`);
  const papeles = t.papelesDeFase();
  const sitios = defensaMod.colocar({ pista: 'entera', canasta: 'norte', elementos: t.fichas.elementos, papeles, defensa: t.defensa });
  for (const id of [b1.id, b2.id]) {
    ok(Math.abs(ficha(t, id).x - sitios[id].x) < 1e-9 && Math.abs(ficha(t, id).y - sitios[id].y) < 1e-9, `${id} en su sitio`);
  }
});

test('PERO AL QUE SE HA ARRASTRADO A MANO NO SE LE VUELVE A MOVER', () => {
  const { t } = conAtaque();
  t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.5, y: 0.75 });
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.9, y: 0.9 });
  // el entrenador lo arrastra a donde quiere
  t.fichas.seleccion = new Set([b1.id]);
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === b1.id ? { ...e, x: 0.62, y: 0.62 } : e)));
  t._recolocadas([b1.id]);
  t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.1, y: 0.9 });
  eq([ficha(t, b1.id).x, ficha(t, b1.id).y], [0.62, 0.62], 'sigue donde lo dejó:');
});

test('SE COLOCA SEGÚN LA REGLA VIGENTE: con presión, pegado al que lleva el balón', () => {
  const { t, a1 } = conAtaque();
  t.setDefensa({ preajuste: 'presion' });
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.9, y: 0.9 });
  t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.1, y: 0.9 });   // dos contra dos: sin inferioridad
  const d = metrosEntre('entera', ficha(t, b1.id), ficha(t, a1.id));
  ok(Math.abs(d - 1.0) < 1e-6, `a 1 m del que lleva el balón: ${d}`);
});

test('UN DEFENSOR PUESTO DESDE EL PANEL SE COLOCA SOLO donde le toca, y ahí empieza', () => {
  const { t } = conAtaque();
  const b = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.9, y: 0.9 });
  const { colocar } = defensaMod;
  const j = t.jugada();
  const esperado = colocar({ pista: 'entera', canasta: 'norte', elementos: j.elementos, papeles: t.papeles().inicio, defensa: t.defensa })[b.id];
  ok(esperado && Math.abs(b.x - esperado.x) < 1e-9 && Math.abs(b.y - esperado.y) < 1e-9, `en su sitio: ${JSON.stringify(b)} y ${JSON.stringify(esperado)}`);
  eq(t.fases[0].entrada[b.id], { x: b.x, y: b.y }, 'y es su arranque:');
  ok(b.x !== 0.9, 'no se queda donde se soltó');
  /* Y con una fase más, ese arranque llega a la siguiente: si no, en la
     fase 2 aparecería donde se soltó. */
  t._cerrarFase();
  t.irAFase(0);
  const otro = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.05, y: 0.95 });
  eq(t.fases[1].entrada[otro.id], { x: ficha(t, otro.id).x, y: ficha(t, otro.id).y }, 'la fase 2 arranca donde se le ha colocado:');
});

test('UN ATACANTE PUESTO DESDE EL PANEL SE QUEDA DONDE SE SUELTA', () => {
  const { t } = conAtaque();
  const a3 = t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.5, y: 0.8 });
  eq([a3.x, a3.y], [0.5, 0.8]);
});

test('«DEFIENDE A…» CAMBIA EL PAR, y si el atacante ya tenía defensor, se intercambian', () => {
  const { t, a1, a2 } = conAtaque();
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.3, y: 0.6 });
  const b2 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.7, y: 0.6 });
  eq(t.papeles().inicio.pares, { [b1.id]: a1.id, [b2.id]: a2.id }, 'por dorsal:');
  ok(t.setParDe(b1.id, a2.id), 'se cambia');
  eq(t.papeles().inicio.pares, { [b1.id]: a2.id, [b2.id]: a1.id }, 'intercambiados:');
  eq(ficha(t, b2.id).defiende_a, a1.id, 'y al otro se le apunta a quién defiende, no se deja al azar:');
  ok(!t.setParDe(b1.id, b2.id), 'a un defensor no se le puede defender');
  ok(!t.setParDe(a1.id, a2.id), 'y un atacante no defiende');
  ok(t.setParDe(b1.id, null) && t.fichas.elementos.find((e) => e.id === b1.id).defiende_a === null, 'null lo deja emparejarse solo');
});

test('LA REGLA PROPIA Y LOS AJUSTES DEL EJERCICIO se guardan y cambian lo que se explica', () => {
  const { t } = conAtaque();
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.3, y: 0.6 });
  // dos contra dos: con uno solo habría inferioridad, y retrasaría
  t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.7, y: 0.6 });
  ok(t.setReglaDe(b1.id, 'presion'));
  ok(!t.setReglaDe(b1.id, 'zona'), 'una regla que no existe no se pone');
  t.fichas.seleccionar([b1.id]);
  eq(t.explicarSeleccion().aplica, 'presion');
  t.setDefensa({ ataca: 'nadie' });
  eq(t.defensa.ataca, 'nadie');
  eq(t.explicarSeleccion(), null, 'con «nadie defiende» no hay regla que explicar:');
  t.setDefensa({ ataca: 'Z', preajuste: 'niega_linea' });
  eq([t.defensa.ataca, t.defensa.preajuste], ['nadie', 'niega_linea'], 'lo que no vale se queda como estaba:');
  eq(t.jugada().defensa.preajuste, 'niega_linea', 'y la jugada lo guarda:');
  t.setDefensa({ parametros: { presion: 0.6 } });
  t.setDefensa({ parametros: { trampa: -1 } });
  eq(t.defensa.parametros, { presion: 0.6 }, 'un número que no vale no se lleva por delante los que ya estaban:');
  t.setDefensa({ parametros: { trampa: 2.5 } });
  eq([t.defensa.parametros.presion, t.defensa.parametros.trampa], [0.6, 2.5], 'y uno nuevo se suma a los de antes:');
});

test('CAMBIAR LOS AJUSTES AVISA, para que se guarde el borrador', () => {
  const { t, p, avisos } = montar();
  let cambios = 0;
  const antes = p._cambio.bind(p);
  p._cambio = () => { cambios++; antes(); };
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.30, 0.50);
  l = anadir(l, { kind: 'jugador', equipo: 'B' }, 0.30, 0.60);
  l = anadir(l, { kind: 'balon' }, 0.34, 0.50);
  const [a1, b1, bal] = l;
  t.poner(asignarBalon(l, bal.id, a1.id, 'entera'));
  cambios = 0;
  t.setDefensa({ preajuste: 'presion' });
  ok(cambios > 0, 'setDefensa avisa');
  cambios = 0;
  t.setParDe(b1.id, a1.id);
  ok(cambios > 0, 'setParDe avisa');
  cambios = 0;
  t.setReglaDe(b1.id, 'niega_linea');
  ok(cambios > 0, 'setReglaDe avisa');
  void avisos;
});

test('ARRASTRAR LA LÍNEA DE UN PAR A OTRO ATACANTE CAMBIA EL PAR; un toque es tocar el suelo', () => {
  const { t, a1, a2, avisos } = conAtaque();
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.3, y: 0.6 });
  const b2 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.7, y: 0.6 });
  t.fichas.seleccionar([]);
  /* La línea de B2 con A2, sin balón: 2 m, así que su mitad queda lejos
     de las dos fichas (la de B1 con A1, con balón, mide 1,2 m). */
  const donde = (id) => t.fichas.elementos.find((e) => e.id === id);
  const mitad = (a, b) => ({ x: (donde(a).x + donde(b).x) / 2, y: (donde(a).y + donde(b).y) / 2 });
  ok(t._atenderPareja({ x: 0.5, y: 0.95, agarrePx: 0, tipoPuntero: 'mouse' }) === null, 'lejos de una línea no coge nada');
  ok(t._atenderPareja({ ...donde(a2.id), agarrePx: 0, tipoPuntero: 'mouse' }) === null, 'encima de una ficha, tampoco: es de las fichas');
  const g = t._atenderPareja({ ...mitad(b2.id, a2.id), agarrePx: 0, tipoPuntero: 'mouse' });
  ok(g, 'sobre la línea sí');
  g.mover({ x: 0.5, y: 0.5 });
  ok(t._arrastrePareja && t._arrastrePareja.defensor === b2.id, 'se ve la línea arrastrándose');
  g.soltar({ ...donde(a1.id) });
  ok(!t._arrastrePareja, 'y al soltar deja de verse');
  eq(t.papeles().inicio.pares[b2.id], a1.id, 'soltada encima de A1:');
  eq(t.papeles().inicio.pares[b1.id], a2.id, 'y el otro se queda con el que había:');
  let tocado = null;
  t._tocarSuelo = (p) => { tocado = p; };
  const g2 = t._atenderPareja({ ...mitad(b1.id, a2.id), agarrePx: 0, tipoPuntero: 'mouse' });
  ok(g2, 'la línea nueva también se coge');
  g2.tocar({ x: 0.5, y: 0.55, tipoPuntero: 'mouse' });
  ok(tocado, 'un toque sin arrastrar va al suelo');
  /* Y soltarla en el suelo vacío no cambia nada, pero lo dice. */
  const pares = JSON.stringify(t.papeles().inicio.pares);
  const g3 = t._atenderPareja({ ...mitad(b2.id, a1.id), agarrePx: 0, tipoPuntero: 'mouse' });
  g3.mover({ x: 0.5, y: 0.9 });
  g3.soltar({ x: 0.5, y: 0.9 });
  eq(JSON.stringify(t.papeles().inicio.pares), pares, 'los pares no cambian:');
  ok(avisos.some(([tipo, , motivo]) => tipo === 'noPuede' && /atacante/.test(motivo || '')), `y se avisa: ${JSON.stringify(avisos)}`);
});

test('UN BLOQUEO SE LE PONE AL DEFENSOR DE VERDAD, y se guarda a quién', () => {
  const { t, a2 } = conAtaque();
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.9, y: 0.9 });
  /* B1 defiende a A1 (el del balón); el bloqueo se le pone a él. */
  const par = t.papelesDeFase().pares[b1.id];
  t._companeroElegido(ficha(t, par), { elemento: ficha(t, a2.id), accion: t._accionDe('bloquea'), variante: null });
  const tr = t.tramos[t.tramos.length - 1];
  eq([tr.companero_id, tr.defensor_id], [par, b1.id], 'el tramo dice a quién y contra quién:');
  const fin = tr.trazo[tr.trazo.length - 1];
  const d = ficha(t, b1.id);
  const m = metrosEntre('entera', fin, { x: d.x, y: d.y });
  ok(Math.abs(m - defensaMod.PARAMETROS.bloqueo) < 1e-6, `se planta a ${m.toFixed(2)} m del defensor de verdad`);
});

console.log('\n· lo que un defensor hace distinto (§8.5)');

/* A1 con balón, A2 sin él, y dos defensores puestos desde el panel. */
function conDefensa() {
  const m = conAtaque();
  const b1 = m.t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.35, y: 0.40 });
  const b2 = m.t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.75, y: 0.40 });
  m.avisos.length = 0;
  return { ...m, b1, b2 };
}
const elegir = (t, id, slug) => { t._tocarFicha(ficha(t, id)); t._elegir(slug, {}); };

test('DECLARAR DESDE EL ANILLO: se guarda en la fase y no dibuja ningún tramo', () => {
  const { t, b1 } = conDefensa();
  elegir(t, b1.id, 'sobrepasado');
  eq(t.declaradas()[b1.id], { accion: 'sobrepasado', objetivo_id: null });
  eq(t.tramos.length, 0, 'lo declarado no es un trazo (§11.1):');
  eq(t.jugada().fases[0].defensa[b1.id].accion, 'sobrepasado', 'y la jugada se lo lleva:');
});

test('«AYUDA» PREGUNTA A QUIÉN, y solo vale un atacante', () => {
  const { t, a2, b1, b2 } = conDefensa();
  elegir(t, b1.id, 'ayuda');
  ok(t.companero.eligiendo, 'se queda esperando a que se pinche a alguien');
  const vale = t.companero.activo.vale;
  ok(vale(ficha(t, b2.id)), 'otro defensor no vale para ayudar');
  eq(vale(ficha(t, a2.id)), null, 'un atacante sí:');
  t._companeroElegido(ficha(t, a2.id), t.companero.activo);
  eq(t.declaradas()[b1.id], { accion: 'ayuda', objetivo_id: a2.id });
});

test('«CAMBIA CON…» CRUZA LOS PARES, y sigue cruzado en la fase siguiente', () => {
  const { t, a1, a2, b1, b2 } = conDefensa();
  eq([t.papelesDeFase().pares[b1.id], t.papelesDeFase().pares[b2.id]], [a1.id, a2.id], 'cada uno con el suyo:');
  elegir(t, b1.id, 'cambia_marca');
  const vale = t.companero.activo.vale;
  ok(vale(ficha(t, a1.id)), 'con un atacante no se cambia el par');
  eq(vale(ficha(t, b2.id)), null, 'con otro defensor sí:');
  t._companeroElegido(ficha(t, b2.id), t.companero.activo);
  eq([t.papelesDeFase().pares[b1.id], t.papelesDeFase().pares[b2.id]], [a2.id, a1.id], 'cruzados:');
  corta(t, a2.id, { x: 0.5, y: 0.3 });
  t._cerrarFase();
  eq([t.papelesDeFase().pares[b1.id], t.papelesDeFase().pares[b2.id]], [a2.id, a1.id], 'y en la fase 2 siguen cruzados:');
});

test('«DEFIENDE» ES VOLVER A LO NORMAL: marca a quien se le diga y deja de hacer lo declarado', () => {
  const { t, a1, a2, b1 } = conDefensa();
  elegir(t, b1.id, 'cierra_rebote');
  eq(t.declaradas()[b1.id].accion, 'cierra_rebote');
  elegir(t, b1.id, 'defiende');
  t._companeroElegido(ficha(t, a2.id), t.companero.activo);
  eq(t.declaradas()[b1.id], undefined, 'ya no hace nada distinto:');
  eq(t.papelesDeFase().pares[b1.id], a2.id, 'y marca al que se le ha dicho:');
  eq(t.papeles().inicio.pares[b1.id], a2.id, 'desde el principio, que es donde vive el par:');
  ok(a1, 'y el otro atacante sigue ahí');
});

test('un atacante no puede hacer lo de la defensa, y se dice', () => {
  const { t, a1, avisos } = conDefensa();
  elegir(t, a1.id, 'cierra_rebote');
  eq(t.declaradas(), {}, 'no se guarda nada:');
  ok(avisos.some(([tipo, , motivo]) => tipo === 'noPuede' && /no está defendiendo/.test(motivo || '')), JSON.stringify(avisos));
});

test('Y LO DECLARADO MUEVE A LA DEFENSA DE VERDAD: al que superan se queda por detrás', () => {
  const { t, a1, b1 } = conDefensa();
  corta(t, a1.id, { x: 0.45, y: 0.30 });   // A1 avanza hacia el aro
  const normal = t._defensaDeLasFases()[0][b1.id].fin;
  elegir(t, b1.id, 'sobrepasado');
  const detras = t._defensaDeLasFases()[0][b1.id].fin;
  /* Defendiendo se queda ENTRE su par y el aro; superado, al otro lado:
     más lejos del aro que antes, y bastante. */
  const alAro = (q) => metrosEntre('entera', q, { x: 0.5, y: 0.1007 });   // el aro norte
  ok(alAro(detras) > alAro(normal) + 1, `más lejos del aro: ${alAro(detras).toFixed(2)} m frente a ${alAro(normal).toFixed(2)}`);
});

test('«ROBA» SE DECLARA SEÑALANDO AL QUE TIENE EL BALÓN, y cambia quién ataca', () => {
  const { t, a1, a2, b1 } = conDefensa();
  corta(t, a1.id, { x: 0.4, y: 0.35 });
  elegir(t, b1.id, 'roba');
  ok(t.companero.eligiendo, 'pregunta a quién');
  eq(t.companero.activo.vale(ficha(t, a1.id)), null, 'un atacante vale:');
  t._companeroElegido(ficha(t, a1.id), t.companero.activo);
  eq(t.declaradas()[b1.id], { accion: 'roba', objetivo_id: a1.id });
  t._cerrarFase();
  eq(t.papelesDeFase().ataca, 'B', 'en la fase siguiente ataca el equipo del que robó:');
  eq(t.canastaEnCurso, 'sur', 'y se ataca al otro aro:');
  eq(t.papelesDeFase().pares[a1.id], b1.id, 'con el emparejamiento invertido:');
  ok(a2, 'y el otro atacante sigue en la pista');
});

test('CAMBIAR SI EL TIRO ENTRA O FALLA CAMBIA QUIÉN ATACA EN LA FASE SIGUIENTE', () => {
  const { t, a1 } = conDefensa();
  /* A1 tira y falla: nadie coge el rebote, así que sigue atacando A. */
  t._trazoHecho({
    elemento: ficha(t, a1.id), accion: t._accionDe('tira'), variante: null,
    trazo: nuevoTrazo(ficha(t, a1.id), { x: 0.5, y: 0.1007 }), tipo: 'pass', desenlace: 'falla',
  });
  t._cerrarFase();
  eq(t.papelesDeFase().ataca, 'A', 'con el tiro fallado, sigue atacando el mismo:');
  t.irAFase(0);
  const tiro = t.tramos.find((x) => x.desenlace);
  t.cambiarDesenlace(tiro.id, 'entra');
  t.irAFase(1);
  eq(t.papelesDeFase().ataca, 'B', 'y en cuanto entra, ataca el otro:');
  eq(t.canastaEnCurso, 'sur');
});

test('TRAS UN ROBO, LO QUE EL ROBADO TENÍA DIBUJADO YA NO ENCAJA', () => {
  const { t, a1, b1 } = conDefensa();
  corta(t, a1.id, { x: 0.4, y: 0.35 });
  elegir(t, b1.id, 'roba');
  t._companeroElegido(ficha(t, a1.id), t.companero.activo);
  t._cerrarFase();
  /* En la fase 2, A1 ya defiende: un corte suyo es de ataque. */
  corta(t, a1.id, { x: 0.4, y: 0.7 });
  const sueltos = t.tramosQueNoEncajan();
  ok(sueltos.some((x) => x.tramo.elemento_id === a1.id && x.fase === 1),
    `el trazo de A1 en la fase 2 no encaja: ${JSON.stringify(sueltos.map((x) => [x.fase, x.tramo.accion]))}`);
});

console.log('\n· la defensa se mueve sola (§8.4)');

/* A1 con balón, B1 defendiéndole, y A1 bota hacia el aro. */
function conSeguimiento() {
  const m = conAtaque();
  const b1 = m.t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.9, y: 0.9 });
  m.t._trazoHecho({
    elemento: ficha(m.t, m.a1.id), accion: m.t._accionDe('bota'), variante: null,
    trazo: nuevoTrazo(ficha(m.t, m.a1.id), { x: 0.40, y: 0.25 }), tipo: 'run',
  });
  return { ...m, b1 };
}

test('LA PIZARRA ENSEÑA LA MISMA DEFENSA QUE EL PROYECTOR: las muestras del compilador', () => {
  const { t, b1 } = conSeguimiento();
  const suya = t._defensaDeLasFases()[0][b1.id];
  ok(suya, 'la fase 1 trae el seguimiento de B1');
  eq(suya.muestras.length, defensaMod.SEGUIMIENTO.muestras, 'las mismas muestras que el §8.4:');
  eq(suya.fin, { x: suya.muestras[20].x, y: suya.muestras[20].y }, 'y acaba en la última:');
  /* Y son LAS DEL COMPILADOR, no unas parecidas calculadas aquí. */
  const anim = compilarMod.compilar(t.jugada());
  const delMotor = anim.fases[0].movimientos.find((m) => m.automatico && m.elemento_id === 'B1');
  eq(suya.muestras, delMotor.muestras);
});

test('Y EL REPASO LA REPRODUCE: un carril sin trazo, con sus muestras', () => {
  const { t, b1 } = conSeguimiento();
  const { tiempos } = t.faseEnCurso();
  const lista = t._paraRepaso(t.tramos, tiempos, 0, t._defensaDeLasFases()[0]);
  const suyo = lista.find((x) => x.corre_id === b1.id);
  ok(suyo && !suyo.trazo && suyo.muestras.length === 21, `el carril de B1: ${JSON.stringify(suyo && suyo.corre_id)}`);
  eq([suyo.inicio_ms, suyo.duracion_ms], [0, tiempos.duracion_ms], 'y dura toda la fase:');
  ok(lista.some((x) => x.trazo), 'sin quitar lo dibujado');
});

test('AL PASAR DE FASE, EL DEFENSOR SE QUEDA DONDE LE DEJÓ SU SEGUIMIENTO', () => {
  const { t, b1 } = conSeguimiento();
  const fin = t._defensaDeLasFases()[0][b1.id].fin;
  const antes = { x: ficha(t, b1.id).x, y: ficha(t, b1.id).y };
  t._cerrarFase();
  const ahora = ficha(t, b1.id);
  ok(Math.abs(ahora.x - fin.x) < 1e-9 && Math.abs(ahora.y - fin.y) < 1e-9, `en la fase 2 arranca donde acabó: ${JSON.stringify(ahora)} y ${JSON.stringify(fin)}`);
  ok(Math.hypot(ahora.x - antes.x, ahora.y - antes.y) > 1e-6, 'y se ha movido de verdad');
  eq(t.fases[1].entrada[b1.id], { x: fin.x, y: fin.y }, 'y la fase 2 lo guarda como su arranque:');
  /* Volver a la fase 1 le devuelve a donde acaba la fase 1, que es lo
     mismo: es la única posición coherente con lo que se reproduce. */
  t.irAFase(0);
  const vuelta = ficha(t, b1.id);
  ok(Math.abs(vuelta.x - fin.x) < 1e-9 && Math.abs(vuelta.y - fin.y) < 1e-9, `y al volver, igual: ${JSON.stringify(vuelta)}`);
});

test('sin defensa, el repaso es exactamente lo de siempre', () => {
  const { t } = conAtaque();
  t._trazoHecho({
    elemento: ficha(t, t.fichas.elementos[0].id), accion: t._accionDe('bota'), variante: null,
    trazo: nuevoTrazo(ficha(t, t.fichas.elementos[0].id), { x: 0.40, y: 0.25 }), tipo: 'run',
  });
  eq(t._defensaDeLasFases(), {}, 'no hay defensa que calcular:');
  const { tiempos } = t.faseEnCurso();
  eq(t._paraRepaso(t.tramos, tiempos).length, 1, 'y el repaso solo lleva lo dibujado:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
