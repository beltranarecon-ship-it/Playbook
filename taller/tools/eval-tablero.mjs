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
const { Pizarra, htmlDeAviso } = await import('../js/pizarra/pizarra.js');
const { anadir, asignarBalon, reiniciarIds } = await import('../js/pizarra/elementos.js');
const { nuevoTrazo } = await import('../js/pizarra/trazo.js');
const defensaMod = await import('../js/pizarra/motor/defensa.js');
const compilarMod = await import('../js/pizarra/motor/compilar.js');
const conosMod = await import('../js/pizarra/conos.js');
const filasMod = await import('../js/pizarra/filas.js');
const { Descripcion } = await import('../js/pizarra/paneles/descripcion.js');
const { metrosEntre } = await import('../js/canvas/escala.js');
const { ponerVariantesDelClub, variantesDe } = await import('../js/pizarra/repertorio.js');
const seguirMod = await import('../js/pizarra/elementos.js');

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
    onAviso: (html) => avisos.push(['aviso', html]),
  });
  const p = Object.create(Pizarra.prototype);
  Object.assign(p, {
    tablero: t, onCambio: null,
    elAviso: { hidden: true, innerHTML: '' },
    el: { querySelector: () => null },
    panel: { recuento() {} },
    linea: { refrescar() {} },
    descripcion: { refrescar() {} },
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

console.log('\n· los conos del camino (§7.4)');

test('UN TRAZO QUE PASA JUNTO A UN CONO LO RODEA, y se guarda por qué lado', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.50, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.50 + 0.3 / 18, 0.50);
  const [a1, cono] = l;
  t.poner(l);
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  const tr = t.tramos[0];
  eq(tr.sorteando, [{ cono: cono.id, lado: tr.sorteando[0].lado, tipo: 'rodeo' }], 'el tramo dice qué cono sortea:');
  ok(['izq', 'der'].includes(tr.sorteando[0].lado), 'con su lado');
  ok(tr.trazo.length > 2, `y el trazo se ha curvado: ${tr.trazo.length} nodos`);
  const puesto = tr.trazo.find((n) => n.por_cono === cono.id);
  ok(puesto, 'con el nodo marcado por su cono');
  ok(metrosEntre('entera', puesto, ficha(t, cono.id)) > 0.5, 'y pasando por al lado, no por encima');
});

test('Y MOVER EL CONO REHACE LA CURVA', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.50, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.50 + 0.3 / 18, 0.50);
  const [a1, cono] = l;
  t.poner(l);
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  const lado = t.tramos[0].sorteando[0].lado;
  /* El cono se va al otro lado del camino. Lo que se guardó es la
     intención —«por la izquierda del cono»—, así que la curva se rehace
     alrededor de su sitio nuevo y POR EL MISMO LADO. */
  const movido = { ...ficha(t, cono.id), x: 0.5 - 0.3 / 18 };
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === cono.id ? movido : e)));
  const tr = t.tramos[0];
  eq(tr.sorteando.length, 1, 'sigue sorteándose una vez:');
  eq(tr.sorteando[0].lado, lado, 'por el mismo lado, que es lo que se guardó:');
  eq(tr.trazo.filter((n) => n.por_cono).length, 1, 'sin acumular nodos:');
  const r = conosMod.respectoAlTrazo(tr.trazo, movido, 'entera');
  eq(r.lado, lado, 'y la curva nueva lo cumple:');
  ok(Math.abs(r.metros - conosMod.CONOS.paso) < 0.15, `pasando a 0,9 m del sitio nuevo: ${r.metros.toFixed(2)}`);
  /* Y si el cono se va lejos, el trazo vuelve a ser recto. */
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === cono.id ? { ...e, x: 0.9, y: 0.9 } : e)));
  eq(t.tramos[0].sorteando, undefined, 'lejos ya no se sortea:');
  eq(t.tramos[0].trazo.length, 2, 'y el trazo vuelve a ser el que se dibujó:');
});

test('EL ICONITO DEL CONO: un clic cambia el lado, otro lo anula y otro lo devuelve (§7.4)', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.50, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.50 + 0.3 / 18, 0.50);
  const [a1, cono] = l;
  t.poner(l);
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  const tr = () => t.tramos[0];
  const lado = tr().sorteando[0].lado;
  const iconos = t.iconosDeConos();
  eq(iconos.length, 1, 'un iconito:');
  eq([iconos[0].cono, iconos[0].tipo], [cono.id, 'rodeo']);
  /* 1 · cambia el lado */
  ok(t.cambiarSorteo(tr().id, cono.id), 'el clic se atiende');
  eq(tr().sorteando[0].lado, conosMod.otroLado(lado), 'el primer clic cambia el lado:');
  eq(conosMod.respectoAlTrazo(tr().trazo, ficha(t, cono.id), 'entera').lado, conosMod.otroLado(lado), 'y el trazo lo cumple:');
  /* 2 · lo anula */
  t.cambiarSorteo(tr().id, cono.id);
  eq(tr().sorteando, [{ cono: cono.id, anulado: true }], 'el segundo lo anula:');
  eq(tr().trazo.length, 2, 'y el trazo vuelve a ser recto:');
  eq(t.iconosDeConos().map((i) => i.tipo), ['anulado'], 'con su iconito de anulado, para poder volver:');
  /* y anulado SIGUE anulado aunque se mueva algo */
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === cono.id ? { ...e, y: 0.52 } : e)));
  eq(tr().sorteando, [{ cono: cono.id, anulado: true }], 'mover el cono no lo resucita:');
  /* 3 · vuelve a lo que se lee solo */
  t.cambiarSorteo(tr().id, cono.id);
  eq(tr().sorteando.length, 1);
  ok(!tr().sorteando[0].anulado, 'el tercero lo devuelve');
});

test('UN SLALOM ES UNA SOLA INTERPRETACIÓN: el clic va para los tres conos', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.40, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.41, 0.60);
  l = anadir(l, { kind: 'cono' }, 0.40, 0.45);
  l = anadir(l, { kind: 'cono' }, 0.39, 0.30);
  const [a1, c1, c2, c3] = l;
  t.poner(l);
  corta(t, a1.id, { x: 0.40, y: 0.15 });
  const tr = () => t.tramos[0];
  eq(tr().sorteando.map((x) => x.tipo), ['zigzag', 'zigzag', 'zigzag']);
  eq(t.iconosDeConos().length, 1, 'un solo iconito:');
  const lados = tr().sorteando.map((x) => x.lado);
  t.cambiarSorteo(tr().id, c1.id);
  eq(tr().sorteando.map((x) => x.lado), lados.map(conosMod.otroLado), 'el primer clic da la vuelta al slalom entero:');
  t.cambiarSorteo(tr().id, c1.id);
  eq(tr().sorteando.map((x) => [x.cono, !!x.anulado]), [[c1.id, true], [c2.id, true], [c3.id, true]], 'el segundo lo anula entero:');
  eq(tr().trazo.length, 2, 'y el trazo vuelve a ser recto:');
  eq(t.iconosDeConos().length, 1, 'con un solo iconito para devolverlo:');
  t.cambiarSorteo(tr().id, c1.id);
  eq(tr().sorteando.map((x) => x.tipo), ['zigzag', 'zigzag', 'zigzag'], 'y el tercero lo devuelve entero:');
});

test('y el clic se atiende con el gesto, por encima de las fichas', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.50, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.50 + 0.3 / 18, 0.50);
  const [a1, cono] = l;
  t.poner(l);
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  const lado = t.tramos[0].sorteando[0].lado;
  const [icono] = t.iconosDeConos();
  const g = t._atenderIconoCono({ ...icono.punto, agarrePx: 0, tipoPuntero: 'mouse' });
  ok(g, 'encima del iconito, el gesto es suyo');
  g.tocar(icono.punto);
  eq(t.tramos[0].sorteando[0].lado, conosMod.otroLado(lado), 'y el toque cambia el lado:');
  eq(t._atenderIconoCono({ x: 0.1, y: 0.9, agarrePx: 0, tipoPuntero: 'mouse' }), null, 'lejos de todo iconito no coge nada:');
  ok(cono, 'y el cono sigue en la pista');
});

/* A1 abajo y una puerta de 2 m cruzada por el centro de la pista. */
function conPuerta(dxA = -1.0, dxB = 1.0) {
  reiniciarIds();
  const m = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.50, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.50 + dxA / 18, 0.50);
  l = anadir(l, { kind: 'cono' }, 0.50 + dxB / 18, 0.50);
  const [a1, p1, p2] = l;
  m.t.poner(l);
  return { ...m, a1, p1, p2 };
}

test('UN TRAZO QUE CRUZA UNA PUERTA LA RECUERDA, con su iconito entre los palos (§7.4.1)', () => {
  const { t, a1, p1, p2 } = conPuerta();
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  const tr = t.tramos[0];
  eq(tr.sorteando, [{ cono: p1.id, puerta: [p1.id, p2.id], tipo: 'puerta' }]);
  eq(tr.trazo.length, 2, 'por dentro ya pasaba: no se toca:');
  const [icono] = t.iconosDeConos();
  eq(icono.tipo, 'puerta');
  ok(Math.abs(icono.punto.x - 0.5) < 1e-9 && Math.abs(icono.punto.y - 0.5) < 1e-9, 'entre los dos palos');
  eq(t.fueraDePuerta(tr), false, 'y no está en rojo:');
});

test('UN TRAZO QUE ROZA UN PALO POR FUERA SE IMANTA A PASAR POR DENTRO', () => {
  const { t, a1, p1, p2 } = conPuerta(0.3, 2.3);
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  const tr = t.tramos[0];
  ok(tr.trazo.some((n) => n.puerta), 'con un nodo puesto por la puerta');
  const cruce = conosMod.cruceConPuerta(tr.trazo, ficha(t, p1.id), ficha(t, p2.id), 'entera');
  ok(cruce && cruce.dentro, 'y ahora pasa por dentro');
  eq(t.fueraDePuerta(tr), false);
});

test('FORZADO POR FUERA SE PINTA EN ROJO, y el imán no lo devuelve', () => {
  const { t, a1, p1 } = conPuerta();
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  /* El entrenador arrastra el trazo por fuera de la puerta. */
  t._editando = t.tramos[0];
  t._trazoCorregido([{ x: 0.5, y: 0.8, tipo_nodo: 'lineal' }, { x: 0.5 + 2.5 / 18, y: 0.5, tipo_nodo: 'lineal' }, { x: 0.5, y: 0.2, tipo_nodo: 'lineal' }]);
  ok(t.tramos[0].sorteando[0].forzada, 'la puerta queda forzada');
  eq(t.fueraDePuerta(t.tramos[0]), true, 'y el trazo, en rojo:');
  /* Mover un cono vuelve a leer todo: lo forzado sigue forzado. */
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === p1.id ? { ...e, y: 0.505 } : e)));
  eq(t.fueraDePuerta(t.tramos[0]), true, 'el imán no se lo lleva por dentro:');
  /* Y llevándolo otra vez por dentro, deja de estar forzado. */
  t._editando = t.tramos[0];
  t._trazoCorregido([{ x: 0.5, y: 0.8, tipo_nodo: 'lineal' }, { x: 0.5, y: 0.2, tipo_nodo: 'lineal' }]);
  ok(!t.tramos[0].sorteando[0].forzada, 'por dentro, ya no:');
  eq(t.fueraDePuerta(t.tramos[0]), false);
});

test('EL CLIC EN LA PUERTA LA ANULA —no tiene lado— y el siguiente la devuelve', () => {
  const { t, a1, p1, p2 } = conPuerta();
  corta(t, a1.id, { x: 0.5, y: 0.2 });
  const tr = () => t.tramos[0];
  t.cambiarSorteo(tr().id, p1.id);
  eq(tr().sorteando.map((x) => [x.cono, !!x.anulado]), [[p1.id, true], [p2.id, true]], 'anulados los dos palos:');
  eq(t.fueraDePuerta(tr()), false, 'y anulada no se pinta en rojo:');
  t.cambiarSorteo(tr().id, p1.id);
  eq(tr().sorteando[0].tipo, 'puerta', 'y vuelve:');
});

test('DESHACER LA PUERTA DESDE EL PANEL la anula en todos los trazos de la fase', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.45, 0.80);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.55, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.5 - 1 / 18, 0.50);
  l = anadir(l, { kind: 'cono' }, 0.5 + 1 / 18, 0.50);
  const [a1, a2, p1, p2] = l;
  t.poner(l);
  corta(t, a1.id, { x: 0.47, y: 0.2 });
  corta(t, a2.id, { x: 0.53, y: 0.2 });
  eq(t.puertasDeLaFase(), [[p1.id, p2.id]], 'una sola puerta, aunque la crucen dos:');
  eq(t.nombreDe(ficha(t, p1.id)), `el cono ${p1.id.split('_')[1]}`, 'y el cono tiene nombre:');
  ok(t.deshacerPuerta(p2.id), 'se deshace desde cualquiera de sus palos');
  eq(t.puertasDeLaFase(), [], 'ya no hay puerta:');
  ok(t.tramos.every((x) => x.sorteando.every((s) => s.anulado)), 'anulada en los dos trazos');
  eq(t.deshacerPuerta(p2.id), false, 'y deshacerla otra vez no hace nada:');
});

test('LA PIZARRA SABE QUIÉN ESTÁ CONFINADO A UNA PUERTA, con los números del proyector', () => {
  const { t, a1, a2, b1 } = conDefensa();
  const palos = [
    t.anadirFicha({ kind: 'cono' }, { x: ficha(t, b1.id).x - 1.2 / 18, y: ficha(t, b1.id).y }),
    t.anadirFicha({ kind: 'cono' }, { x: ficha(t, b1.id).x + 1.2 / 18, y: ficha(t, b1.id).y }),
  ];
  /* A1 cruza esa puerta. */
  corta(t, a1.id, { x: ficha(t, b1.id).x, y: 0.2 });
  ok(t.puertasDeLaFase().length === 1, 'hay una puerta');
  const c = t.carriles();
  ok(c[b1.id], `B1, que está encima, confinado: ${JSON.stringify(Object.keys(c))}`);
  ok(palos.length === 2 && a2, 'y todo lo demás en su sitio');
});

/* Un cono, listo para ser fila. */
function conConoDeFila() {
  reiniciarIds();
  const m = montar();
  let l = [];
  l = anadir(l, { kind: 'cono' }, 0.50, 0.60);
  m.t.poner(l);
  return { ...m, cono: l[0] };
}

test('HACER FILA DESDE EL PANEL PONE A LA COLA EN LA PISTA Y EN LA JUGADA (§7.4.2)', () => {
  const { t, cono } = conConoDeFila();
  ok(t.hacerFila(cono.id, { n: 3, equipo: 'B', balon: true }), 'se hace');
  const cola = filasMod.deLaFila(t.fichas.elementos, cono.id);
  eq(cola.length, 3);
  eq(cola.map((j) => j.en_juego), [true, false, false]);
  eq(t.fichas.elementos.filter((e) => e.kind === 'balon').length, 3, 'con su balón cada uno:');
  for (const j of cola) ok(t.fases[0].entrada[j.id], 'cada uno con su arranque');
  const b = t.fichas.elementos.find((e) => e.kind === 'balon');
  eq(t.fases[0].posesion[b.id], b.portador_id, 'y la jugada sabe de quién es cada balón:');
  eq(t.filaDe(cola[2].id), cono.id, 'y de qué fila es cada uno:');
});

test('MOVER EL CONO SE LLEVA A LA COLA, en el mismo gesto', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 3, orientacion: 90 });
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === cono.id ? { ...e, x: 0.3, y: 0.4 } : e)));
  const cola = filasMod.deLaFila(t.fichas.elementos, cono.id);
  ok(Math.abs(cola[0].x - 0.3) < 1e-9 && Math.abs(cola[0].y - 0.4) < 1e-9, 'el primero, en el cono nuevo');
  ok(cola[1].y > 0.4, 'y los demás detrás');
  eq(t.fases[0].entrada[cola[1].id], { x: cola[1].x, y: cola[1].y }, 'y es su arranque:');
});

test('EL QUE YA HA SALIDO NO VUELVE A LA COLA al mover el cono: vive en la punta de su trazo', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 2 });
  const [primero] = filasMod.deLaFila(t.fichas.elementos, cono.id);
  corta(t, primero.id, { x: 0.5, y: 0.2 });
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === cono.id ? { ...e, x: 0.3 } : e)));
  const ahora = ficha(t, primero.id);
  ok(Math.abs(ahora.y - 0.2) < 1e-9, `sigue en la punta de su trazo: ${JSON.stringify(ahora)}`);
});

test('GIRAR LA FILA CONSERVA A LOS QUE ESPERAN; y solo se hace en la fase 1', () => {
  const { t, cono, avisos } = conConoDeFila();
  t.hacerFila(cono.id, { n: 2, orientacion: 90 });
  const ids = filasMod.deLaFila(t.fichas.elementos, cono.id).map((j) => j.id);
  ok(t.orientarFila(cono.id, 0), 'se gira');
  eq(filasMod.deLaFila(t.fichas.elementos, cono.id).map((j) => j.id), ids, 'los mismos:');
  ok(filasMod.deLaFila(t.fichas.elementos, cono.id)[1].x > 0.5, 'ahora a la derecha');
  corta(t, ids[0], { x: 0.5, y: 0.2 });
  t._cerrarFase();
  avisos.length = 0;
  eq(t.hacerFila(cono.id, { n: 4 }), false, 'en la fase 2 no:');
  ok(avisos.some(([tipo]) => tipo === 'noPuede'), 'y se dice');
});

test('UNO DE LA COLA NO SE QUITA SUELTO; el cono se lleva a toda su cola', () => {
  const { t, cono, avisos } = conConoDeFila();
  t.hacerFila(cono.id, { n: 3, balon: true });
  const cola = filasMod.deLaFila(t.fichas.elementos, cono.id);
  t.fichas.seleccion = new Set([cola[1].id]);
  eq(t.quitarSeleccion(), false, 'uno de la cola, no:');
  ok(avisos.some(([, , motivo]) => /fila/.test(motivo || '')), 'y se dice por qué');
  t.fichas.seleccion = new Set([cono.id]);
  ok(t.quitarSeleccion(), 'el cono, sí');
  eq(t.fichas.elementos.length, 0, 'y con él su cola y sus balones:');
});

test('«VUELVE A LA FILA» DESDE EL ANILLO lleva al primero al final de su cola', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 3, orientacion: 90 });
  const [primero] = filasMod.deLaFila(t.fichas.elementos, cono.id);
  corta(t, primero.id, { x: 0.5, y: 0.3 });
  t._tocarFicha(ficha(t, primero.id));
  t._elegir('vuelve_a_fila', {});
  const tr = t.tramos[t.tramos.length - 1];
  eq(tr.accion, 'vuelve_a_fila');
  const fin = tr.trazo[tr.trazo.length - 1];
  ok(fin.y > 0.6, `acaba detrás de la cola: ${JSON.stringify(fin)}`);
});

test('LAS RONDAS SE VEN EN LA PIZARRA CON LA MISMA CUENTA QUE EN EL PROYECTOR (§7.4.2)', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 3, orientacion: 90 });
  const cola = filasMod.deLaFila(t.fichas.elementos, cono.id);
  corta(t, cola[0].id, { x: 0.5, y: 0.3 });
  const { tramos, tiempos, rondas } = t.conRondasEn();
  eq(tramos.map((x) => x.elemento_id), cola.map((j) => j.id), 'el primero y, detrás, los otros dos:');
  eq(Object.values(rondas).map((r) => r.ronda), [1, 2]);
  eq(t.tramos.length, 1, 'lo dibujado sigue siendo un tramo:');
  const anim = compilarMod.compilar(t.jugada());
  const enAnim = anim.fases[0].movimientos.filter((m) => m.tipo_elemento === 'jugador').map((m) => m.inicio_ms);
  eq(enAnim, tramos.map((x) => tiempos.tramos[x.id].inicio_ms), 'y salen cuando en el proyector:');
  eq(t.nombreDe(cola[2]), 'el 3.º de la fila', 'quien espera se nombra por su puesto:');
});

test('CAMBIAR CÓMO SALE UNA FILA NO LA REHACE, aunque el primero ya tenga algo dibujado', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 3, orientacion: 90 });
  const ids = filasMod.deLaFila(t.fichas.elementos, cono.id).map((j) => j.id);
  corta(t, ids[0], { x: 0.5, y: 0.3 });
  ok(t.ajustarFila(cono.id, { rondas: false }), 'se cambia');
  eq(filasMod.deLaFila(t.fichas.elementos, cono.id).map((j) => j.id), ids, 'los mismos, en su sitio:');
  eq(t.conRondasEn().tramos.length, 1, 'solo sale el primero:');
  t.ajustarFila(cono.id, { rondas: true, cadencia_ms: 1500 });
  const { tramos, tiempos } = t.conRondasEn();
  eq(tramos.slice(1).map((x) => tiempos.tramos[x.id].inicio_ms), [1500, 3000], 'y a la cadencia:');
  eq(ficha(t, cono.id).fila.cadencia_ms, 1500);
  eq(t.ajustarFila('nadie', { rondas: false }), false, 'sin cono de fila no hay nada que cambiar:');
});

test('EL BALÓN QUE VA A SALIR VA EN LAS MANOS DE QUIEN LO PASA, también en el repaso', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.30, 0.80);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.70, 0.40);
  l = anadir(l, { kind: 'balon' }, 0.34, 0.80);
  const [a1, a2, bal] = l;
  t.poner(asignarBalon(l, bal.id, a1.id, 'entera'));
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), { x: 0.30, y: 0.50 }), tipo: 'run' });
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), ficha(t, a2.id)), tipo: 'pass' });
  eq(t.tramos.map((x) => x.corre_id), [a1.id, bal.id], 'bota y pasa:');
  const { tiempos } = t.conRondasEn();
  eq(t._paraRepaso(t.tramos, tiempos).map((x) => x.manos || null), [null, a1.id], 'el pase sale de las manos de A1:');
  t.reproducirFase();
  const mitad = tiempos.tramos[t.tramos[0].id].duracion_ms / 2;
  /* El reloj, quieto: si no, entre una pregunta y otra A1 ya se ha movido. */
  const ahora = performance.now();
  t.repaso._ahora = () => ahora;
  t.repaso.activo.t0 = ahora - mitad;
  const jugador = t.repaso.posicion(a1.id);
  const balon = t.repaso.donde(ficha(t, bal.id));
  t.repaso.parar();
  ok(jugador.y < 0.79 && jugador.y > 0.51, `A1 va botando: ${JSON.stringify(jugador)}`);
  ok(Math.abs(balon.y - jugador.y) < 1e-9 && balon.x > jugador.x, `y el balón con él, a su lado: ${JSON.stringify(balon)}`);
});

test('EL CARRO DEL QUE PASA DESDE FUERA SE PINTA SOLO MIENTRAS SE REPRODUCE', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 3, orientacion: 90 });
  const cola = filasMod.deLaFila(t.fichas.elementos, cono.id);
  t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.8, y: 0.3 });
  const pasador = t.fichas.elementos[t.fichas.elementos.length - 1];
  t.anadirFicha({ kind: 'balon' }, { x: pasador.x, y: pasador.y });
  const carro = t.fichas.elementos.find((e) => e.kind === 'balon');
  eq(carro.portador_id, pasador.id, 'el balón, en las manos del que pasa:');
  corta(t, cola[0].id, { x: 0.5, y: 0.3 });
  t._trazoHecho({ elemento: ficha(t, pasador.id), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, pasador.id), ficha(t, cola[0].id)), tipo: 'pass' });
  eq(t.tramos[1].receptor_id, cola[0].id, 'le pasa al primero:');
  eq(t.fichas.extras(), [], 'quieto, no se pinta nada de más:');
  t.reproducirFase();
  eq(t.fichas.extras().map((b) => b.id), [`${carro.id}_r1`, `${carro.id}_r2`], 'reproduciendo, un balón más por ronda:');
  /* Al empezar, el del carro espera en las manos del que pasa —que no se
     mueve—, al lado de él y no encima. */
  const ahora = performance.now();
  t.repaso._ahora = () => ahora;
  t.repaso.activo.t0 = ahora;
  const enManos = t.repaso.donde(t.fichas.extras()[1]);
  const quieto = ficha(t, pasador.id);
  ok(Math.abs(enManos.y - quieto.y) < 1e-9 && enManos.x > quieto.x + 1e-6, `a su lado: ${JSON.stringify(enManos)} y ${JSON.stringify(quieto)}`);
  t.repaso.parar();
  eq(t.fichas.extras(), [], 'y al acabar, nada:');
});

test('«DALE UN BALÓN» (§7.3): uno nuevo en sus manos desde el principio, y él sigue seleccionado', () => {
  const { t, avisos, a1, a2, b1 } = sinAtacante();
  ok(t.darBalon(b1.id), 'se le da');
  const suyo = t.fichas.elementos.find((e) => e.kind === 'balon' && e.portador_id === b1.id);
  ok(suyo, 'lo lleva');
  eq(t.fases[0].posesion[suyo.id], b1.id, 'desde el principio:');
  eq([...t.fichas.seleccion], [b1.id], 'y sigue seleccionado él:');
  avisos.length = 0;
  eq(t.darBalon(b1.id), false, 'uno como mucho:');
  ok(avisos.some(([, , motivo]) => /ya lleva uno/.test(motivo || '')), 'y se dice');
  eq(t.porQueNoDarBalon(a2.id), 'A2 ya tiene algo dibujado; dale el balón antes de dibujar', 'a quien ya tiene algo dibujado, no:');
  eq(t.porQueNoDarBalon(a1.id), null, 'a quien no tiene nada, sí:');
  t._cerrarFase();
  ok(/fase 1/.test(t.porQueNoDarBalon(a1.id)), 'y solo en la fase 1');
});

test('CTRL+CLIC EN UNA FILA: un balón para cada uno, sin rehacerla ni tocar a quien ya ha salido', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 3, orientacion: 90 });
  const cola = filasMod.deLaFila(t.fichas.elementos, cono.id);
  corta(t, cola[0].id, { x: 0.5, y: 0.3 });
  t._tocarFicha(ficha(t, cola[2].id), { ctrl: true });
  const conBalon = (id) => t.fichas.elementos.some((e) => e.kind === 'balon' && e.portador_id === id);
  eq(cola.map((j) => conBalon(j.id)), [false, true, true], 'los que esperan, con balón; el que ya ha salido, como estaba:');
  eq(filasMod.deLaFila(t.fichas.elementos, cono.id).map((j) => j.id), cola.map((j) => j.id), 'los mismos:');
  eq(ficha(t, cono.id).fila.balon, true, 'y la fila lo sabe:');
  t._tocarFicha(ficha(t, cono.id), { ctrl: true });
  eq(t.fichas.elementos.filter((e) => e.kind === 'balon').length, 2, 'otra vez no da más:');
  ok(t.balonesDeLaFila(cono.id, false), '«sin balón» desde el panel');
  eq(cola.map((j) => conBalon(j.id)), [false, false, false], 'se los quita:');
  eq(ficha(t, cono.id).fila.balon, false);
  eq(Object.keys(t.fases[0].posesion || {}).length, 0, 'y la jugada tampoco los recuerda:');
});

test('LA FRASE DE LA FASE SE REESCRIBE Y SE DEVUELVE A LA AUTOMÁTICA (§9.2)', () => {
  const { t, a2 } = sinAtacante();
  ok(/^A2 corta/.test(t.frases()[0]), `sale de lo dibujado: ${t.frases()[0]}`);
  ok(t.escribirTexto('  A2 se va hacia arriba.  '), 'se escribe');
  eq(t.jugada().fases[0].texto, 'A2 se va hacia arriba.', 'y la jugada se lo lleva, sin espacios de sobra:');
  eq(t.escribirTexto('A2 se va hacia arriba.'), false, 'lo mismo otra vez no es un cambio:');
  ok(/^A2 corta/.test(t.frases()[0]), 'la automática sigue ahí, para la voz');
  t.escribirTexto('   ');
  eq(t.jugada().fases[0].texto, null, 'en blanco vuelve a la automática:');
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  ok(/y corta/.test(t.frases()[0]), `y cambia al dibujar: ${t.frases()[0]}`);
});

test('LO ESCRITO SE GUARDA EN LA FASE DE LA QUE SE ESCRIBÍA, aunque la fase cambie con la caja abierta', () => {
  const { t } = sinAtacante();
  const d = new Descripcion(falso(), t);
  const antes = globalThis.document.activeElement;
  globalThis.document.activeElement = d.caja;   // el entrenador está en la caja
  d._fase = 0;
  d.caja.value = 'A2 sube a recibir.';
  t._cerrarFase();                               // el repaso de «Siguiente fase» acaba
  d.refrescar();
  globalThis.document.activeElement = antes;
  eq([t.fases[0].texto, t.fases[1].texto], ['A2 sube a recibir.', null]);
  eq(d.etiqueta.textContent, 'Fase 2');
});

test('LA CAJA DE LA FRASE ENSEÑA LA AUTOMÁTICA O LA ESCRITA, y guardarla igual es no escribir nada', () => {
  const { t } = sinAtacante();
  const d = new Descripcion(falso(), t);
  eq(d.caja.value, t.frases()[0], 'la automática:');
  eq(d.volver.hidden, true, 'sin nada escrito no hay a qué volver:');
  d.caja.value = 'Lo escribo yo.';
  d._guardar();
  eq([t.fases[0].texto, d.volver.hidden, d.caja.value], ['Lo escribo yo.', false, 'Lo escribo yo.']);
  d.caja.value = t.frases()[0];
  d._guardar();
  eq(t.fases[0].texto, null, 'dejarla como la automática es quedarse con ella:');
});

test('ABRIR RAMA (§6.7): lo que venía pasa a ser la primera y se va a dibujar la nueva', () => {
  const { t, a2 } = sinAtacante();          // A2 ya corta en la fase 1
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });      // fase 2
  t.irAFase(0);
  ok(t.abrirRama({ primera: 'si le dejan', nueva: 'si le niegan' }), 'se abre');
  const [f1, f2] = t.todasLasFases;
  eq([f2.rama_de, f2.rama_nombre], [f1.id, 'si le dejan'], 'la que venía es la primera rama:');
  const nueva = t.fases[t.iFase];
  eq([nueva.rama_de, nueva.rama_nombre, t.fases.length, t.iFase], [f1.id, 'si le niegan', 2, 1], 'y se está en la nueva:');
  eq(t.numeroEnSuCamino(nueva.id), 2);
  eq(t.ramaDe(nueva.id), 'si le niegan');
  corta(t, a2.id, { x: 0.8, y: 0.3 });      // se dibuja en la nueva
  const j = t.jugada();
  eq(j.fases.map((f) => [f.id, f.rama_de, f.rama_nombre]), [[f1.id, null, null], [f2.id, f1.id, 'si le dejan'], [nueva.id, f1.id, 'si le niegan']]);
  const anim = compilarMod.compilar(j);
  eq(anim.ramas[0].opciones.map((o) => o.nombre), ['si le dejan', 'si le niegan'], 'y el proyector tendrá su cruce:');
  eq(t.jugadaDelCamino().fases.map((f) => f.id), [f1.id, nueva.id], 'lo que se calcula es el camino que se ve:');
  ok(!('rama_de' in t.jugadaDelCamino().fases[0]), 'sin ramas');
});

test('LO QUE SE DIBUJA DETRÁS DE UNA RAMA SIGUE EN ELLA, aunque la otra vaya después en la lista', () => {
  const { t, a2 } = sinAtacante();
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  const [f1, f2] = t.todasLasFases.map((f) => f.id);
  t.irAFaseId(f2);
  t._cerrarFase();
  const nueva = t.fases[t.iFase].id;
  eq(t.fases.map((f) => f.id), [f1, f2, nueva]);
  eq([t.numeroEnSuCamino(nueva), t.ramaDe(nueva)], [3, 'a'], 'va detrás de la rama a, y en ella se queda:');
});

test('IR A UNA FASE DE OTRA RAMA cambia el camino; y cambiar la fase del cruce reancla las dos ramas', () => {
  const { t, a2 } = sinAtacante();
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(t, a2.id, { x: 0.8, y: 0.3 });
  const [f1, f2, f3] = t.todasLasFases.map((f) => f.id);
  ok(t.irAFaseId(f2));
  eq(t.fases.map((f) => f.id), [f1, f2], 'el camino de la rama a:');
  t.irAFase(0);
  /* Se corrige la fase 1: A2 acaba en otro sitio. */
  const tr = t.tramos[0];
  t.tramos = [{ ...tr, trazo: tr.trazo.map((n, i) => (i === tr.trazo.length - 1 ? { ...n, x: 0.45, y: 0.4 } : n)) }];
  t._recalcularSiguientes();
  for (const id of [f2, f3]) {
    const f = t.faseDeId(id);
    const ini = f.tramos[0].trazo[0];
    ok(Math.abs(ini.x - 0.45) < 1e-9 && Math.abs(ini.y - 0.4) < 1e-9, `la rama ${id} sale del sitio nuevo: ${JSON.stringify(ini)}`);
  }
});

test('REUNIR Y SEPARAR; y una rama con algo dibujado no se quita', () => {
  const { t, a2 } = sinAtacante();
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.1 });       // fases 1 → 2 → 3
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' }); // se está en la nueva (vacía)
  const nueva = t.fases[t.iFase].id;
  const [, f2, f3] = t.todasLasFases.map((f) => f.id);
  ok(t.candidatasParaReunir().includes(f3), 'puede seguir por la fase 3 de la otra rama');
  ok(t.reunirCon(f3), 'se reúne');
  eq(t.faseDeId(f3).reune, [f2, nueva]);
  eq(t.fases.map((f) => f.id).slice(-1), [f3], 'y el camino sigue por ella:');
  ok(t.separarDe(f3));
  eq(t.faseDeId(f3).reune, []);
  ok(t.quitarRama(nueva), 'la nueva está vacía: se quita');
  eq(t.todasLasFases.some((f) => f.rama_de != null), false, 'y con una sola rama ya no hay ramas:');
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(t, a2.id, { x: 0.3, y: 0.3 });
  eq(t.quitarRama(t.fases[t.iFase].id), false, 'con algo dibujado, no:');
});

test('UNA REUNIÓN SE VE DESDE LA RAMA POR LA QUE SE LLEGA (§6.7), y se separa desde cualquiera de las que llegan', () => {
  const { t, a2 } = sinAtacante();
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.1 });       // fases 1 → 2 → 3
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(t, a2.id, { x: 0.8, y: 0.3 });       // la b: A2 acaba en (0.8, 0.3)
  const [f1, f2, f3, f4] = t.todasLasFases.map((f) => f.id);
  ok(t.reunirCon(f3), 'se reúne');
  const sale = (id) => t.faseDeId(id).tramos.find((x) => x.elemento_id === a2.id).trazo[0];
  const en = (p, x, y) => !!p && Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9;
  ok(en(sale(f3), 0.8, 0.3) && en(t.faseDeId(f3).entrada[a2.id], 0.8, 0.3), `por la b, A2 sale de donde le deja la b: ${JSON.stringify(sale(f3))}`);
  ok(t.irAFaseId(f3));
  eq(t.fases.map((f) => f.id), [f1, f4, f3], 'yendo a ella, se sigue por la rama en la que se estaba:');
  ok(t.irAFaseId(f2));
  ok(en(sale(f3), 0.6, 0.2), `por la a, de donde le deja la a: ${JSON.stringify(sale(f3))}`);
  const anim = compilarMod.compilar(t.jugada());
  const suyo = (f) => f.movimientos.find((m) => !m.automatico && m.elemento_id === 'A2' && m.tipo_elemento === 'jugador');
  const pa = suyo(anim.fases.find((f) => f.id === f3)).path[0];
  const pb = suyo(anim.fases_rama.find((f) => f.id.startsWith(`${f3}@`))).path[0];
  ok(en(pa, 0.6, 0.2) && en(pb, 0.8, 0.3), `y el proyector igual: ${JSON.stringify([pa, pb])}`);
  /* Desde la a, que es la que ya llegaba: la a acaba y la b sigue. */
  eq(t.reunionesDeFase(f2), [f3]);
  ok(t.separarDe(f3), 'se separa');
  eq(t.fases.map((f) => f.id), [f1, f2], 'la a acaba aquí:');
  ok(en(sale(f3), 0.8, 0.3), `y la fase 3 sigue a la b, desde donde la deja: ${JSON.stringify(sale(f3))}`);
});

test('ABRIR Y REUNIR RESPETAN EL CAMINO QUE SE VE; y quitar una rama recalcula la reunión desde la que queda', () => {
  const { t, a2 } = sinAtacante();
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.1 });       // fases 1 → 2 → 3
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(t, a2.id, { x: 0.8, y: 0.3 });
  const [f1, , f3, f4] = t.todasLasFases.map((f) => f.id);
  t.reunirCon(f3);
  t.irAFaseId(f3);                           // por la b
  t.abrirRama({ primera: 'x', nueva: 'y' });
  const [f5, f6] = t.todasLasFases.map((f) => f.id).slice(-2);
  eq(t.fases.map((f) => f.id), [f1, f4, f3, f6], 'la rama nueva, por donde se venía:');
  t.reunirCon(f5);
  eq(t.fases.map((f) => f.id), [f1, f4, f3, f6, f5], 'y la reunión, también:');

  /* Tres ramas que llegan a la misma fase; se quita la primera, vacía. */
  const s = sinAtacante();
  s.t._cerrarFase();
  s.t._cerrarFase();
  corta(s.t, s.a2.id, { x: 0.6, y: 0.1 });   // f2 vacía → f3
  s.t.irAFase(0);
  s.t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(s.t, s.a2.id, { x: 0.8, y: 0.3 });
  const [, g2, g3, g4] = s.t.todasLasFases.map((f) => f.id);
  s.t.reunirCon(g3);
  s.t.irAFase(0);
  s.t.abrirRama({ nueva: 'c' });
  corta(s.t, s.a2.id, { x: 0.2, y: 0.2 });
  s.t.reunirCon(g3);                          // se ve desde la c
  ok(s.t.quitarRama(g2), 'la a está vacía: se quita');
  eq(s.t.faseDeId(g3).reune.slice(0, 1), [g4]);
  s.t.irAFaseId(g3);
  const p = s.t.faseDeId(g3).tramos.find((x) => x.elemento_id === s.a2.id).trazo[0];
  ok(Math.abs(p.x - 0.8) < 1e-9 && Math.abs(p.y - 0.3) < 1e-9, `ahora se dibuja desde la b: ${JSON.stringify(p)}`);
});

test('RECALCULAR NO DA EL BALÓN SUELTO A QUIEN LO TIENE EN LA FASE QUE SE VE', () => {
  const { t, a1, bal } = sinAtacante();
  t.fichas.poner(t.fichas.elementos.map((e) => (e.id === bal.id ? { ...e, portador_id: a1.id } : e)));
  eq(t._jugadaDe(t.fases).elementos.find((e) => e.id === bal.id).portador_id, null, 'al empezar, suelto:');
  eq(t.jugada().elementos.find((e) => e.id === bal.id).portador_id, null, 'como en la que se guarda:');
});

test('CON RAMAS, EL AVISO DE LA DEFENSA MIRA TODOS LOS CAMINOS, y la cola sabe quién ha salido en otra rama', () => {
  const { t, a1, a2, b1 } = sinAtacante();
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(t, a1.id, { x: 0.2, y: 0.2 });       // A1 corta solo en la b
  const [, f2] = t.todasLasFases.map((f) => f.id);
  t.irAFaseId(f2);
  t.irAFase(0);
  t.anadirFicha({ kind: 'balon' }, { x: ficha(t, b1.id).x, y: ficha(t, b1.id).y });
  const malos = t.tramosQueNoEncajan().map((m) => m.tramo.elemento_id);
  ok(malos.includes(a1.id) && malos.includes(a2.id), `los de las dos ramas, en el mismo gesto: ${malos}`);
  /* La cola: el primero de la fila corta solo en la rama b. */
  const c = conConoDeFila();
  c.t.hacerFila(c.cono.id, { n: 2, orientacion: 90 });
  const cola = filasMod.deLaFila(c.t.fichas.elementos, c.cono.id);
  c.t._cerrarFase();
  c.t.irAFase(0);
  c.t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(c.t, cola[0].id, { x: 0.5, y: 0.3 });
  const [, g2] = c.t.todasLasFases.map((f) => f.id);
  c.t.irAFaseId(g2);
  c.t.irAFase(0);
  const antes = ficha(c.t, cola[0].id);
  const movida = c.t._colasEnSuSitio(c.t.fichas.elementos.map((e) => (e.id === c.cono.id ? { ...e, x: 0.3 } : e)));
  const suyo = movida.find((e) => e.id === cola[0].id);
  eq([suyo.x, suyo.y], [antes.x, antes.y], 'quien ya ha salido en otra rama no vuelve a la cola:');
});

console.log('\n· varios a la vez y atajos (§3.2, §4.6, §4.7)');

/* A1 con balón, A2 y A3 sin él. */
function tresAtacantes() {
  const m = conAtaque();
  const a3 = m.t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.5, y: 0.7 });
  m.t.cerrar();
  m.avisos.length = 0;
  return { ...m, a3 };
}
const seleccionar = (t, ...ids) => { t.fichas.seleccionar(new Set(ids)); };

test('CON VARIOS SELECCIONADOS NO SE ABRE EL ANILLO DE UNO: se ofrece lo que pueden hacer todos', () => {
  const { t, a1, a2, a3 } = tresAtacantes();
  seleccionar(t, a2.id, a3.id);
  t._tocarFicha(ficha(t, a2.id));
  eq(t.anillo.abierto, false, 'tocar a uno del grupo no abre su anillo:');
  eq(t.grupo().map((m) => m.id), [a2.id, a3.id]);
  eq(t.accionesDelGrupo().map((o) => o.slug).includes('corta'), true);
  ok(!t.accionesDelGrupo().some((o) => o.slug === 'bloquea'), 'lo de dos fichas no se dice a varios');
  /* Con balón y sin él: solo lo que valga para los dos. */
  seleccionar(t, a1.id, a2.id);
  const comunes = t.accionesDelGrupo().map((o) => o.slug);
  ok(comunes.includes('finta') && !comunes.includes('bota') && !comunes.includes('pasa'), `lo común a quien lleva balón y a quien no: ${comunes}`);
  seleccionar(t, a2.id);
  eq(t.grupo(), [], 'uno solo no es un grupo:');
});

test('LO QUE SE ELIGE LO HACEN TODOS: un gesto cada uno; un corte, al mismo punto o en paralelo', () => {
  const { t, a2, a3 } = tresAtacantes();
  seleccionar(t, a2.id, a3.id);
  ok(t.abrirAnilloDeGrupo(), 'se abre el anillo común');
  t._elegir('finta', {});
  eq(t.tramos.map((x) => [x.elemento_id, x.accion, x.tipo]), [[a2.id, 'finta', 'gesto'], [a3.id, 'finta', 'gesto']]);
  eq(t.anillo.abierto, false, 'y no se encadena el anillo de nadie:');
  /* Un corte: se dibuja el del primero y el otro va al mismo punto. */
  t.abrirAnilloDeGrupo();
  corta(t, a2.id, { x: 0.8, y: 0.3 });
  const [c2, c3] = t.tramos.slice(2);
  eq([c2.elemento_id, c3.elemento_id, c3.accion], [a2.id, a3.id, 'corta']);
  eq([[c3.trazo[0].x, c3.trazo[0].y], [c3.trazo.at(-1).x, c3.trazo.at(-1).y]], [[0.5, 0.7], [0.8, 0.3]], 'desde su sitio, al mismo punto:');
  /* En paralelo: cada uno copia el trazo desde donde está. */
  const s = tresAtacantes();
  seleccionar(s.t, s.a2.id, s.a3.id);
  s.t.setEnParalelo(true);
  s.t.abrirAnilloDeGrupo();
  corta(s.t, s.a2.id, { x: 0.6, y: 0.3 });     // A2 está en (0.7, 0.5): −0.1, −0.2
  const p3 = s.t.tramos.at(-1);
  eq(p3.elemento_id, s.a3.id);
  ok(Math.abs(p3.trazo.at(-1).x - 0.4) < 1e-9 && Math.abs(p3.trazo.at(-1).y - 0.5) < 1e-9, `el mismo movimiento, desde su sitio (0.5, 0.7): ${JSON.stringify(p3.trazo.at(-1))}`);
  /* Un anillo de grupo que se cierra sin elegir no deja al grupo puesto:
     el trazo de uno solo, después, es solo suyo. */
  s.t.abrirAnilloDeGrupo();
  s.t.anillo.cerrar();
  seleccionar(s.t, s.a2.id);
  s.t._tocarFicha(ficha(s.t, s.a2.id));
  const n = s.t.tramos.length;
  corta(s.t, s.a2.id, { x: 0.2, y: 0.2 });
  eq(s.t.tramos.length, n + 1);
});

test('SI NO HAY NADA QUE PUEDAN HACER TODOS, se dice; y quien no puede lo suyo, también', () => {
  const { t, a1, a2, avisos } = conDefensa();
  const b1 = t.fichas.elementos.find((e) => e.equipo === 'B');
  seleccionar(t, a1.id, b1.id);
  eq(t.abrirAnilloDeGrupo(), false);
  ok(/no hay nada que puedan hacer todos/.test(avisos.at(-1)[2]), JSON.stringify(avisos.at(-1)));
  ok(a2, 'a2');
});

test('LOS ATAJOS (§4.7): la letra lanza la acción de la ficha seleccionada; N, la fase siguiente', () => {
  const { t, a1, a2, a3, avisos } = tresAtacantes();
  seleccionar(t);
  eq(t.atajo('c'), false, 'sin nadie seleccionado, nada:');
  seleccionar(t, a2.id);
  eq([t.atajo('f'), t.tramos.map((x) => x.accion)], [true, ['finta']], 'F, finta:');
  t.cerrar();
  eq([t.atajo('b'), avisos.at(-1)], [true, ['noPuede', 'Bota', 'no lleva balón']], 'B sin balón se dice:');
  eq([t.atajo('C'), t.anillo.abierto], [true, true], 'C, corta: pregunta el cómo y a dibujar:');
  t.cerrar();
  eq(t.atajo('z'), false, 'una letra que no es atajo no se come:');
  corta(t, a2.id, { x: 0.6, y: 0.3 });
  ok(t.repaso.corriendo, 'el repaso del corte está en marcha');
  eq([t.atajo('z'), t.repaso.corriendo], [false, true], 'ni corta el repaso:');
  t.cerrar();
  t.repaso.parar();
  seleccionar(t, a1.id);
  eq([t.atajo('e'), t.anillo.abierto], [true, true], 'E, entra a canasta: pregunta el cómo');
  t._elegir('entra', { variante: 'bandeja' });
  eq([t.tramos.at(-1).accion, t.tramos.at(-1).elemento_id], ['entra', a1.id], 'y se dibuja sola hasta el aro:');
  t.cerrar();
  /* Con varios, se lo dice a todos. */
  seleccionar(t, a2.id, a3.id);
  const n = t.tramos.length;
  eq([t.atajo('f'), t.tramos.length - n], [true, 2]);
  eq([t.atajo('x'), avisos.at(-1)[2]], [true, 'se dice de uno en uno, no a varios a la vez']);
  /* N cierra la fase. */
  t.repaso.parar();
  eq(t.atajo('n'), true);
});

test('«SIGUIENTE FASE» CON OTRO REPASO EN MARCHA SIGUE CERRANDO LA FASE al acabar el suyo', () => {
  const { t, a2 } = tresAtacantes();
  corta(t, a2.id, { x: 0.6, y: 0.3 });
  ok(t.repaso.corriendo, 'el repaso del corte está en marcha');
  eq(t.siguienteFase(), true);
  t.repaso.onFin();
  eq(t.fases.length, 2, 'cortar el repaso de antes no se lleva el cierre recién pedido:');
});

test('LO QUE PUEDEN HACER TODOS NO DEPENDE DE QUÉ FICHA SE PUSO ANTES, y el atajo sigue la regla de una ficha', () => {
  const { t, a1, a2 } = tresAtacantes();
  const slugs = (miembros) => t.accionesDelGrupo(miembros).map((o) => o.slug).sort();
  eq(slugs([a1, a2]), slugs([a2, a1]), 'el mismo grupo en el orden contrario:');
  seleccionar(t, a1.id, a2.id);
  eq(t.atajo('c'), true);
  eq(t.anillo.abierto, true, 'C, corta: lo pueden hacer los dos, con balón y sin él:');
  t.cerrar();
  /* El gesto «solo con balón» no lo pueden hacer los dos. */
  eq(t.atajo('f'), true);
  ok(t.tramos.length === 2, 'la finta sí, a los dos');
});

test('UN PASE NO SE DICE A VARIOS: dos pases al mismo sitio dejaban dos balones en una mano', () => {
  const { t, a1, a2, avisos } = tresAtacantes();
  t.anadirFicha({ kind: 'balon' }, { x: ficha(t, a2.id).x, y: ficha(t, a2.id).y });
  seleccionar(t, a1.id, a2.id);
  eq(t.grupo().length, 2);
  ok(!t.accionesDelGrupo().some((o) => o.slug === 'pasa'), `el grupo no ofrece «Pasa»: ${t.accionesDelGrupo().map((o) => o.slug)}`);
  const n = t.tramos.length;
  eq([t.atajo('p'), t.tramos.length - n, t.anillo.abierto], [true, 0, false], 'ni con la P:');
  eq(avisos.at(-1)[2], 'se dice de uno en uno, no a varios a la vez');
});

test('«CIERRA EL REBOTE» Y «ES SOBREPASADO» LOS DECLARAN TODOS LOS DEFENSORES DEL GRUPO', () => {
  const { t, b1, b2 } = conDefensa();
  seleccionar(t, b1.id, b2.id);
  ok(t.abrirAnilloDeGrupo(), 'se abre el anillo común');
  ok(t.accionesDelGrupo().some((o) => o.slug === 'cierra_rebote'), 'se ofrece');
  t._elegir('cierra_rebote', {});
  eq(Object.keys(t.declaradas()).sort(), [b1.id, b2.id].sort(), 'los dos lo declaran:');
  eq(t._grupo, null, 'y el grupo no queda puesto:');
});

test('EL BOTÓN DEL GRUPO SE ESCONDE MIENTRAS SE ELIGE O SE DIBUJA, también con un atajo', () => {
  const { t, a2, a3 } = tresAtacantes();
  seleccionar(t, a2.id, a3.id);
  t._pintarGrupo();
  ok(t._botonGrupo, 'con el grupo y nada abierto, el botón está');
  eq(t.atajo('c'), true);
  ok(t.anillo.abierto, 'el atajo abre el anillo del cómo');
  eq(t._botonGrupo, null, 'y el botón no se queda a la vista:');
  t.cerrar();
  t._pintarGrupo();
  t.dibujo.empezar({ elemento: ficha(t, a2.id), accion: t._accionDe('corta'), variante: null, conDedo: false });
  eq(t.abrirAnilloDeGrupo(), false, 'en mitad de un trazo no se abre otro anillo:');
  t.cerrar();
});

test('MANTENER UNA LETRA NO REPITE EL ATAJO: una pulsación, una acción', () => {
  const { t, a2 } = tresAtacantes();
  seleccionar(t, a2.id);
  const ev = (repeat) => ({ key: 'f', repeat, ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, preventDefault() {} });
  t._onTecla(ev(false));
  t.cerrar();
  t._onTecla(ev(true));
  t.cerrar();
  t._onTecla(ev(true));
  eq(t.tramos.map((x) => x.accion), ['finta'], 'una sola finta:');
});

test('UN ATAJO NO DEJA UN CIERRE DE FASE PENDIENTE: N y luego otra cosa, la fase no se cierra sola', () => {
  const { t, a2 } = tresAtacantes();
  corta(t, a2.id, { x: 0.6, y: 0.3 });
  t.cerrar();
  eq(t.fases.length, 1);
  /* N arranca su repaso; una letra que no hace nada no lo corta. */
  seleccionar(t);
  eq(t.atajo('n'), true);
  ok(t.repaso.corriendo, 'el repaso de N está en marcha');
  eq([t.atajo('c'), t.repaso.corriendo], [false, true], 'una letra sin nadie seleccionado no lo corta:');
  /* Una letra que sí hace algo lo corta Y cancela el cierre. */
  seleccionar(t, a2.id);
  eq(t.atajo('f'), true);
  t.repaso.onFin();
  eq(t.fases.length, 1, 'al acabar el repaso de la finta, la fase sigue siendo la misma:');
  /* Y sin cortarlo, al acabar sí se cierra. */
  t.cerrar();
  seleccionar(t);
  t.atajo('n');
  t.repaso.onFin();
  eq(t.fases.length, 2, 'N, sin interrupciones, cierra la fase:');
});

test('DICHO A VARIOS DEFENSORES, SE LES DECLARA A TODOS (§4.6), y el grupo no se queda puesto', () => {
  const { t, b1, b2, avisos } = conDefensa();
  seleccionar(t, b1.id, b2.id);
  eq(t.accionesDelGrupo().map((o) => o.slug), ['sobrepasado', 'cierra_rebote'], 'lo que no pide señalar a nadie:');
  ok(t.abrirAnilloDeGrupo());
  t._elegir('cierra_rebote', {});
  const suyo = { accion: 'cierra_rebote', objetivo_id: null };
  eq(t.declaradas(), { [b1.id]: suyo, [b2.id]: suyo }, 'los dos, no solo el primero:');
  eq([t._grupo, avisos, t.anillo.abierto, !!t._botonGrupo], [null, [], false, true], 'sin avisos, y el botón del grupo vuelve:');
  /* Y lo que no se puede no deja al grupo esperando un trazo. */
  const s = tresAtacantes();
  seleccionar(s.t, s.a2.id, s.a3.id);
  s.t.abrirAnilloDeGrupo();
  s.t._elegir('recoge', {});           // no hay ningún balón suelto
  eq([s.t._grupo, s.avisos.length], [null, 1], 'se dice y se suelta:');
});

test('CORTAR EL REPASO DE «SIGUIENTE FASE» ES SEGUIR CORRIGIENDO: la fase no se cierra, ni entonces ni después', () => {
  const acabar = (t) => { t.repaso.activo = null; t.repaso.onFin(); };
  const { t, a2, a3 } = tresAtacantes();
  corta(t, a2.id, { x: 0.6, y: 0.3 });
  t.cerrar();
  t.repaso.parar();
  /* Una letra que no va a hacer nada no corta el repaso. */
  seleccionar(t);
  eq([t.atajo('n'), t.repaso.corriendo, t._cerrarFaseAlAcabar], [true, true, true]);
  eq([t.atajo('c'), t.repaso.corriendo, t._cerrarFaseAlAcabar], [false, true, true], 'sin nadie seleccionado, C no es nada:');
  /* Si se deja acabar, se cierra. */
  acabar(t);
  eq([t.iFase, t.fases.length, t._cerrarFaseAlAcabar], [1, 2, false]);
  /* Con alguien seleccionado, N y enseguida F: la finta corta el repaso
     y la fase sigue abierta; al acabar el de la finta no se cierra sola. */
  const s = tresAtacantes();
  corta(s.t, s.a2.id, { x: 0.6, y: 0.3 });
  s.t.cerrar();
  seleccionar(s.t, s.a3.id);
  s.t.atajo('n');
  ok(s.t._cerrarFaseAlAcabar, 'esperando a que acabe el repaso');
  s.t.atajo('f');
  eq([s.t._cerrarFaseAlAcabar, s.t.tramos.map((x) => x.accion)], [false, ['corta', 'finta']]);
  acabar(s.t);
  eq([s.t.iFase, s.t.fases.length], [0, 1], 'sigue en la fase 1:');
  /* Lo mismo con cualquier otra cosa que lo corte: cambiar de fase,
     poner una escena, insertar una fase. */
  s.t.cerrar();
  s.t.siguienteFase();
  s.t.irAFase(0);
  eq(s.t._cerrarFaseAlAcabar, false);
  s.t.siguienteFase();
  s.t.insertarFase('despues');
  eq(s.t._cerrarFaseAlAcabar, false);
  ok(a3, 'a3');
});

test('EL BOTÓN DEL GRUPO NO ESTÁ MIENTRAS SE ELIGE EL «CÓMO» NI MIENTRAS SE DIBUJA, tampoco por el atajo', () => {
  const { t, a2, a3 } = tresAtacantes();
  seleccionar(t, a2.id, a3.id);
  ok(t._botonGrupo, 'con dos seleccionados, el botón está');
  eq([t.atajo('c'), t.anillo.abierto, t._botonGrupo], [true, true, null], 'C: se pregunta el cómo, sin botón:');
  t._elegir('corta', { variante: variantesDe('corta')[0].slug });
  eq([t.dibujo.dibujando, t._botonGrupo], [true, null], 'ni al dibujar:');
  eq(t.abrirAnilloDeGrupo(), false, 'en mitad de un trazo no se abre otro anillo:');
  /* «En paralelo» cambiado con algo ya en marcha vale para eso mismo. */
  t.setEnParalelo(true);
  eq(t._grupo.paralelo, true);
  corta(t, a2.id, { x: 0.6, y: 0.3 });   // A2 está en (0.7, 0.5): −0.1, −0.2
  const suyo = t.tramos.at(-1);
  ok(suyo.elemento_id === a3.id && Math.abs(suyo.trazo.at(-1).x - 0.4) < 1e-9, `A3 copia el trazo: ${JSON.stringify(suyo.trazo.at(-1))}`);
});

test('TRAS LO DICHO A VARIOS, EL FOCO VUELVE AL LIENZO: las teclas siguen llegando', () => {
  const { t, a2, a3 } = tresAtacantes();
  let focos = 0;
  t.lienzo.el.focus = () => { focos++; };
  seleccionar(t, a2.id, a3.id);
  t.abrirAnilloDeGrupo();
  focos = 0;
  t._elegir('finta', {});
  eq(focos, 1, 'tras el gesto de los dos:');
  t.setEnParalelo(true);
  eq(focos, 2, 'y tras cambiar a «en paralelo», que rehace el botón pulsado:');
  /* Lo declarado a un defensor también cierra el anillo con el botón dentro. */
  const d = conDefensa();
  let otros = 0;
  d.t.lienzo.el.focus = () => { otros++; };
  d.t._tocarFicha(ficha(d.t, d.b1.id));
  otros = 0;
  d.t._elegir('cierra_rebote', {});
  eq(otros, 1);
});

console.log('\n· insertar, duplicar, borrar y renombrar fases (§6.8)');

/* A2 corta en la fase 1 a (0.5, 0.35), en la 2 a (0.6, 0.2) y en la 3 a (0.6, 0.1). */
function tresFases() {
  const m = sinAtacante();
  m.t._cerrarFase();
  corta(m.t, m.a2.id, { x: 0.6, y: 0.2 });
  m.t._cerrarFase();
  corta(m.t, m.a2.id, { x: 0.6, y: 0.1 });
  m.avisos.length = 0;
  return m;
}
const saleDe = (t, id, quien) => { const p = t.faseDeId(id).tramos.find((x) => x.elemento_id === quien).trazo[0]; return [Number(p.x.toFixed(6)), Number(p.y.toFixed(6))]; };

test('INSERTAR UNA FASE: vacía, donde se pide, y se va a ella; lo de detrás sigue saliendo de su sitio', () => {
  const { t, a2 } = tresFases();
  const [f1, f2, f3] = t.todasLasFases.map((f) => f.id);
  t.irAFase(0);
  ok(t.insertarFase('despues'), 'después de la 1');
  const n = t.fases[t.iFase].id;
  eq([t.fases.map((f) => f.id), t.iFase, t.tramos.length], [[f1, n, f2, f3], 1, 0]);
  eq(t.faseDeId(n).entrada[a2.id], { x: 0.5, y: 0.35 }, 'empieza donde acaba la 1:');
  eq(saleDe(t, f2, a2.id), [0.5, 0.35], 'y la 2 sigue saliendo de ahí:');
  eq(t.todasLasFases.some((f) => f.rama_de != null || (f.reune || []).length), false, 'sin ramas ni enlaces: una lista sin más');
  t.irAFase(0);
  ok(t.insertarFase('antes'), 'antes de la primera');
  const p = t.fases[0].id;
  eq([t.iFase, t.todasLasFases[0].id === p, t.fases.length], [0, true, 5]);
  eq(t.fases[0].entrada[a2.id], { x: 0.45, y: 0.6 }, 'la nueva primera guarda dónde empieza la jugada:');
  eq(t.jugada().elementos.find((e) => e.id === a2.id).y, 0.6, 'y la escena al empezar es la misma:');
  eq(saleDe(t, f1, a2.id), [0.45, 0.6], 'la que era la primera sale igual:');
});

test('BORRAR UNA FASE: lo de detrás se reancla a lo de delante; la primera deja su arranque a la siguiente', () => {
  const { t, a2, avisos } = tresFases();
  const [f1, f2, f3] = t.todasLasFases.map((f) => f.id);
  t.irAFase(1);
  ok(t.borrarFase(), 'la de en medio');
  eq([t.fases.map((f) => f.id), t.iFase], [[f1, f3], 1], 'se queda en la que la seguía:');
  eq(saleDe(t, f3, a2.id), [0.5, 0.35], 'que ahora sale de donde acaba la 1:');
  t.irAFase(0);
  ok(t.borrarFase(), 'la primera');
  eq([t.fases.map((f) => f.id), t.todasLasFases[0].id], [[f3], f3]);
  eq(saleDe(t, f3, a2.id), [0.45, 0.6], 'la que queda sale de donde empezaba la jugada:');
  eq(t.fases[0].entrada[a2.id], { x: 0.45, y: 0.6 });
  ok('posesion' in t.fases[0], 'y guarda de quién es cada balón al empezar');
  eq([t.borrarFase(), avisos.at(-1)], [false, ['noPuede', 'Borrar la fase', 'una jugada tiene al menos una fase']], 'la única no se borra:');
  ok(f2, 'f2');
});

test('DUPLICAR UNA FASE la copia como otra rama desde la anterior, con sus trazos; la primera no se puede', () => {
  const { t, a2, avisos } = tresFases();
  const [f1, f2, f3] = t.todasLasFases.map((f) => f.id);
  t.irAFase(1);
  eq(t.duplicarFase({ primera: '', nueva: 'la copia' }), false, 'cada rama necesita su nombre:');
  ok(t.duplicarFase({ primera: 'la de siempre', nueva: 'la copia' }), 'se duplica');
  const copia = t.fases[t.iFase];
  eq([t.fases.map((f) => f.id), copia.rama_de, copia.rama_nombre], [[f1, copia.id], f1, 'la copia'], 'se está en la copia, que es una rama de la fase 1:');
  eq([t.faseDeId(f2).rama_nombre, t.todasLasFases.find((f) => f.id === f3).rama_de], ['la de siempre', null]);
  const [o, c] = [t.faseDeId(f2).tramos[0], copia.tramos[0]];
  ok(o.id !== c.id && JSON.stringify(o.trazo) === JSON.stringify(c.trazo) && c.trazo !== o.trazo, 'el mismo trazo, con otro nombre y sin compartirlo');
  corta(t, a2.id, { x: 0.9, y: 0.4 });
  eq(t.faseDeId(f2).tramos.length, 1, 'cambiar la copia no toca la original:');
  t.irAFase(0);
  eq([t.duplicarFase({ primera: 'a', nueva: 'b' }), avisos.at(-1)[1]], [false, 'Duplicar'], 'la primera no tiene anterior:');
});

test('PONERLE NOMBRE A UNA FASE: se guarda con la jugada; vacío lo quita', () => {
  const { t } = tresFases();
  ok(t.renombrarFase('  Bloqueo   directo '), 'se pone');
  eq(t.jugada().fases[2].nombre, 'Bloqueo directo');
  eq(t.renombrarFase('Bloqueo directo'), false, 'el mismo no es un cambio:');
  ok(t.renombrarFase(''));
  eq(t.jugada().fases[2].nombre, null);
});

test('BORRAR UNA FASE CON RAMAS: no la del cruce; y borrar lo único de una rama deja la otra como lo que sigue', () => {
  const { t, a2, avisos } = tresFases();
  const [f1, f2] = t.todasLasFases.map((f) => f.id);
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(t, a2.id, { x: 0.8, y: 0.3 });
  const b = t.fases[t.iFase].id;
  t.irAFase(0);
  eq([t.borrarFase(), avisos.at(-1)[2]], [false, 'de esta fase salen ramas: quítalas antes']);
  t.irAFaseId(b);
  ok(t.borrarFase(), 'la rama b, aunque tenga algo dibujado');
  eq([t.todasLasFases.some((f) => f.rama_de != null), t.fases.map((f) => f.id).slice(0, 2), t.iFase], [false, [f1, f2], 0], 'ya no hay ramas, y se queda en el cruce:');
});

test('BORRAR UNA FASE QUITA LO QUE YA NO TIENE BALÓN, y lo dice; lo que vale se queda', () => {
  const { t, a1, a2, avisos } = conAtaque();
  const pasa = (de, a) => t._trazoHecho({ elemento: ficha(t, de), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, de), ficha(t, a)), tipo: 'pass' });
  const bota = (id, hasta) => t._trazoHecho({ elemento: ficha(t, id), accion: t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(t, id), hasta), tipo: 'run' });
  pasa(a1.id, a2.id);
  t.cerrar();
  t._cerrarFase();
  bota(a2.id, { x: 0.6, y: 0.3 });
  corta(t, a1.id, { x: 0.3, y: 0.2 });         // el corte de A1 no pide balón
  t.cerrar();
  t.irAFase(0);
  avisos.length = 0;
  ok(t.borrarFase(), 'se borra la fase del pase');
  eq(t.todasLasFases.length, 1);
  eq(t.tramos.map((x) => [x.elemento_id, x.accion]), [[a1.id, 'corta']], 'el bote de A2 se va; el corte de A1 se queda:');
  const dicho = avisos.find((x) => x[0] === 'aviso');
  ok(dicho && /A2 bota/.test(dicho[1]) && /ya no lleva el balón/.test(dicho[1]), `lo dice: ${JSON.stringify(dicho)}`);
  /* Y si el balón sigue siendo suyo, no se quita nada. */
  const m = conAtaque();
  m.t._trazoHecho({ elemento: ficha(m.t, m.a1.id), accion: m.t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(m.t, m.a1.id), { x: 0.4, y: 0.3 }), tipo: 'run' });
  m.t.cerrar();
  m.t._cerrarFase();
  m.t._trazoHecho({ elemento: ficha(m.t, m.a1.id), accion: m.t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(m.t, m.a1.id), { x: 0.5, y: 0.2 }), tipo: 'run' });
  m.t.cerrar();
  m.t.irAFase(0);
  m.avisos.length = 0;
  ok(m.t.borrarFase());
  eq([m.t.tramos.map((x) => x.accion), m.avisos.filter((x) => x[0] === 'aviso').length], [['bota'], 0], 'con balón, el bote sigue y no hay aviso:');
});

test('SI EL BALÓN LLEGA POR UNA RAMA Y POR LA OTRA NO, no se quita lo que vale por una de ellas', () => {
  const { t, a1, a2 } = conAtaque();
  const pasa = (de, a) => t._trazoHecho({ elemento: ficha(t, de), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, de), ficha(t, a)), tipo: 'pass' });
  const bota = (id, hasta) => t._trazoHecho({ elemento: ficha(t, id), accion: t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(t, id), hasta), tipo: 'run' });
  corta(t, a2.id, { x: 0.7, y: 0.4 });
  t.cerrar();
  t._cerrarFase();
  pasa(a1.id, a2.id);                          // la a: A1 pasa a A2
  t.cerrar();
  t._cerrarFase();
  bota(a2.id, { x: 0.6, y: 0.3 });             // y A2 bota: con balón
  t.cerrar();
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  bota(a1.id, { x: 0.4, y: 0.3 });             // la b: A1 se queda con el balón
  t.cerrar();
  const [, , f3] = t.todasLasFases.map((f) => f.id);
  ok(t.reunirCon(f3), 'la b se reúne con la a en la fase 3');
  eq(t._quitarLosSinBalon(), [], 'A2 bota con balón por la a y sin él por la b: no se toca:');
  ok(t.faseDeId(f3).tramos.some((x) => x.accion === 'bota'), 'el bote sigue');
});

test('REABRIR UNA JUGADA CON RAMAS: se abre por el camino principal y cada rama sale de su sitio', () => {
  const { t, a2 } = sinAtacante();
  t._cerrarFase();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  t.irAFase(0);
  t.abrirRama({ primera: 'a', nueva: 'b' });
  corta(t, a2.id, { x: 0.8, y: 0.3 });
  const guardada = JSON.parse(JSON.stringify(t.jugada()));
  const otro = montar().t;
  ok(otro.cargar(guardada).ok);
  const [f1, f2, f3] = guardada.fases.map((f) => f.id);
  eq(otro.fases.map((f) => f.id), [f1, f2], 'por el principal:');
  otro.irAFaseId(f3);
  eq(otro.fases.map((f) => f.id), [f1, f3]);
  ok(otro.frases()[1].length > 0, `con su frase: ${otro.frases()[1]}`);
});

test('UN TRAZO PINCHADO SE VE EN EL PANEL, y su variante se cambia sin tocar el trazo (§4.3)', () => {
  const { t, p } = sinAtacante();
  let modelo = null;
  p.derecha = { pintar: (m) => { modelo = m; } };
  let avisado = null;
  const otro = new Tablero(lienzoFalso(), { onEditando: (x) => { avisado = x; } });
  ok(otro.onEditando, 'la Pizarra se entera por la opción del constructor');
  t.onEditando = () => p._refrescarAjustes();
  const tr = t.tramos[0];
  t._editar(tr);
  eq([modelo.tipo, modelo.variante.valor], ['tramo', 'recto'], 'al pincharlo, el panel es el suyo:');
  ok(t.cambiarVariante(tr.id, 'en_v'), 'se cambia');
  eq(t.tramos[0].trazo, tr.trazo, 'sin tocar el trazo:');
  eq([t.tramos[0].variante, t.tramoEditado.variante], ['en_v', 'en_v']);
  ok(/en V/.test(t.frases()[0]), `y la frase lo dice: ${t.frases()[0]}`);
  eq([t.cambiarVariante(tr.id, 'en_v'), t.cambiarVariante(tr.id, 'volando'), t.cambiarVariante('nadie', 'recto')], [false, false, false], 'lo mismo, lo que no es de esa acción o un tramo que no está, no:');
  t.cerrar();
  ok(modelo.tipo !== 'tramo', 'al soltarlo, el panel vuelve a lo de antes');
});

/* Lo que habla con la base de datos, de mentira: se apunta qué se pide. */
async function testA(nombre, fn) {
  try { await fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
  finally { ponerVariantesDelClub([]); }
}
const datosDeMentira = (llamadas, { falla = null } = {}) => ({
  cargarVariantes: async () => [{ accion: 'corta', slug: 'flash', nombre: 'Flash' }],
  cargarVideos: async () => ({ corta__recto: { tipo: 'youtube', id: 'dQw4w9WgXcQ', desde: null, hasta: 6 } }),
  guardarVideo: async (clave, video) => { if (falla === 'video') throw new Error('sin red'); llamadas.push(['video', clave, video]); },
  borrarVideo: async (clave) => { llamadas.push(['quitar', clave]); },
  crearVariante: async (v) => { if (falla === 'variante') throw new Error('hay que aplicar la migración 044'); llamadas.push(['variante', v]); return { ...v, id: 'u1' }; },
});

await testA('AL ABRIR, LAS VARIANTES DEL CLUB Y LOS VÍDEOS LLEGAN DE FONDO', async () => {
  const { t, p } = sinAtacante();
  p.datos = datosDeMentira([]);
  p.videos = {};
  await p._cargarVariantesYVideos();
  ok(variantesDe('corta').some((v) => v.slug === 'flash'), 'la del club está en el anillo');
  eq(Object.keys(p.videos), ['corta__recto']);
  ok(t, 'tablero');
});

await testA('EL VÍDEO DE UNA VARIANTE SE COMPRUEBA, SE GUARDA PARA EL CLUB Y SE QUITA', async () => {
  const { t, p, avisos } = sinAtacante();
  const llamadas = [];
  let modelo = null;
  p.derecha = { pintar: (m) => { modelo = m; } };
  p.datos = datosDeMentira(llamadas);
  p.videos = {};
  t._editar(t.tramos[0]);
  ok(await p.guardarVideo('corta__recto', { enlace: 'https://youtu.be/dQw4w9WgXcQ', desde: '3', hasta: '0:09' }), 'se guarda');
  eq(llamadas, [['video', 'corta__recto', { tipo: 'youtube', id: 'dQw4w9WgXcQ', desde: 3, hasta: 9 }]]);
  eq(modelo.video.actual && modelo.video.actual.tramo, 'del 0:03 al 0:09', 'y el panel lo enseña:');
  eq(await p.guardarVideo('corta__recto', { enlace: 'hola' }), false, 'un enlace que no es de vídeo, no:');
  ok(/no se reconoce el enlace/.test(avisos.at(-1)), avisos.at(-1));
  eq(llamadas.length, 1, 'y no se manda nada:');
  ok(await p.quitarVideo('corta__recto'));
  eq([llamadas.at(-1), modelo.video.actual], [['quitar', 'corta__recto'], null]);
  p.datos = datosDeMentira(llamadas, { falla: 'video' });
  eq(await p.guardarVideo('corta__recto', { enlace: 'https://youtu.be/dQw4w9WgXcQ' }), false);
  ok(/sin red/.test(avisos.at(-1)), 'si falla, se dice por qué');
});

await testA('LO QUE LLEGA TARDE NO PISA LO RECIÉN GUARDADO; y lo que la base no deja quitar, se dice', async () => {
  const { t, p, avisos } = sinAtacante();
  const llamadas = [];
  p.derecha = { pintar() {} };
  let soltar;
  const lento = new Promise((ok) => { soltar = ok; });
  p.datos = { ...datosDeMentira(llamadas), cargarVariantes: () => lento.then(() => []), cargarVideos: () => lento.then(() => ({ corta__en_v: { tipo: 'youtube', id: 'aaaaaaaaaaa', desde: null, hasta: null } })) };
  p.videos = {};
  const carga = p._cargarVariantesYVideos();
  t._editar(t.tramos[0]);
  ok(await p.guardarVideo('corta__recto', { enlace: 'https://youtu.be/dQw4w9WgXcQ' }));
  ok(await p.nuevaVariante('corta', { nombre: 'Flash' }));
  soltar();
  await carga;
  eq(Object.keys(p.videos).sort(), ['corta__en_v', 'corta__recto'], 'lo guardado sigue, con lo que ha llegado:');
  ok(variantesDe('corta').some((v) => v.slug === 'flash'), 'y la variante recién creada también');
  ok(/flash/.test(t.frases()[0]), `la frase la nombra en cuanto está: ${t.frases()[0]}`);
  eq(t.tramos[0].variante_nombre, 'Flash', 'y el tramo lleva su nombre consigo:');
  /* Sin red, «no se sabe»: se sigue con las que había (aunque las cargara
     otra Pizarra antes). */
  ponerVariantesDelClub([{ accion: 'corta', slug: 'flash', nombre: 'Flash' }, { accion: 'corta', slug: 'zeta', nombre: 'Zeta' }]);
  p.datos = { ...p.datos, cargarVariantes: async () => null, cargarVideos: async () => ({}) };
  await p._cargarVariantesYVideos();
  ok(variantesDe('corta').some((v) => v.slug === 'zeta'), 'si la carga falla, no se queda sin ninguna');
  /* Un trazo guardado sin el nombre de su variante la dice en cuanto llega. */
  const otro = sinAtacante();
  ponerVariantesDelClub([]);
  otro.t.tramos = otro.t.tramos.map((x) => ({ ...x, variante: 'flash' }));
  ok(!/flash/.test(otro.t.frases()[0]), 'sin cargarla, no se nombra');
  ponerVariantesDelClub([{ accion: 'corta', slug: 'flash', nombre: 'Flash' }]);
  ok(/flash/.test(otro.t.frases()[0]), `y al llegar, la frase se rehace sin tocar el dibujo: ${otro.t.frases()[0]}`);
  eq([await p.guardarVideo('corta__en_v', { enlace: '   ' }), llamadas.filter((x) => x[0] === 'video').length], [false, 1], 'sin enlace no se guarda nada:');
  /* La base de datos no borra lo que puso otro, y no da error. */
  p.datos = { ...p.datos, borrarVideo: async () => false };
  eq(await p.quitarVideo('corta__recto'), false);
  ok('corta__recto' in p.videos && /quien lo puso/.test(avisos.at(-1)), `sigue ahí y se dice por qué: ${avisos.at(-1)}`);
  t.cambiarVariante(t.tramos[0].id, 'en_v');
  ok(!('variante_nombre' in t.tramos[0]), 'una de serie no lleva nombre');
});

await testA('LA VARIANTE NUEVA VA AL TRAZO DESDE EL QUE SE PIDIÓ, y un doble clic no la crea dos veces', async () => {
  const { t, p } = sinAtacante();
  corta(t, t.fichas.elementos[0].id, { x: 0.2, y: 0.3 });   // otro corte, de A1
  const [tr1, tr2] = t.tramos;
  const llamadas = [];
  p.derecha = { pintar() {} };
  p.datos = datosDeMentira(llamadas);
  p.videos = {};
  t._editar(tr1);
  const primera = p.nuevaVariante('corta', { nombre: 'Flash' }, tr1.id);
  const segunda = p.nuevaVariante('corta', { nombre: 'Flash' }, tr1.id);
  t._editar(tr2);                                            // mientras viaja, se pincha otro
  eq([!!(await primera), await segunda], [true, null]);
  eq(llamadas.filter((x) => x[0] === 'variante').length, 1, 'una sola vez:');
  eq(t.tramos.map((x) => x.variante), ['flash', null], 'al trazo desde el que se pidió, no al pinchado ahora:');
});

await testA('UNA VARIANTE NUEVA: se crea para el club, con su vídeo, y se le pone al trazo pinchado', async () => {
  const { t, p, avisos } = sinAtacante();
  const llamadas = [];
  p.derecha = { pintar() {} };
  p.datos = datosDeMentira(llamadas);
  p.videos = {};
  t._editar(t.tramos[0]);
  const v = await p.nuevaVariante('corta', { nombre: 'Rizo doble', descripcion: 'Dos vueltas.', enlace: 'https://youtu.be/dQw4w9WgXcQ?t=4' });
  eq(v && v.slug, 'rizo_doble');
  eq(llamadas, [
    ['variante', { accion: 'corta', slug: 'rizo_doble', nombre: 'Rizo doble', descripcion: 'Dos vueltas.' }],
    ['video', 'corta__rizo_doble', { tipo: 'youtube', id: 'dQw4w9WgXcQ', desde: 4, hasta: null }],
  ]);
  ok(variantesDe('corta').some((x) => x.slug === 'rizo_doble'), 'ya está en el anillo');
  eq(t.tramos[0].variante, 'rizo_doble', 'y el trazo pinchado la lleva:');
  ok(/rizo doble/.test(t.frases()[0]), `la frase la nombra: ${t.frases()[0]}`);
  eq(await p.nuevaVariante('corta', { nombre: 'Rizo doble' }), null, 'dos veces la misma, no:');
  p.datos = datosDeMentira(llamadas, { falla: 'variante' });
  eq(await p.nuevaVariante('corta', { nombre: 'Otra' }), null);
  ok(/migración 044/.test(avisos.at(-1)), `sin la tabla, se dice qué falta: ${avisos.at(-1)}`);
});

console.log('\n· deshacer y rehacer (§2.2)');

test('DESHACER VUELVE A COMO ESTABA, fase incluida; REHACER lo repone; y lo nuevo corta lo que se había deshecho', () => {
  const { t, p, a2, avisos } = sinAtacante();   // A2 ya corta en la fase 1
  Object.assign(p, { derecha: { pintar() {} } });
  p._montarHistorial();
  t._cerrarFase();
  p._apuntar();
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  p._apuntar();
  eq([t.todasLasFases.length, t.iFase, t.tramos.length], [2, 1, 1]);
  ok(p.deshacer(), 'se deshace el corte de la fase 2');
  eq([t.todasLasFases.length, t.iFase, t.tramos.length], [2, 1, 0], 'la fase 2, vacía, y se sigue en ella:');
  ok(p.deshacer());
  eq([t.todasLasFases.length, t.iFase, t.tramos.length], [1, 0, 1], 'antes de «Siguiente fase»:');
  eq(p.deshacer(), false, 'no hay nada antes de lo que había al montar:');
  ok(/nada que deshacer/.test(avisos.at(-1)), avisos.at(-1));
  ok(p.rehacer() && p.rehacer());
  eq([t.todasLasFases.length, t.iFase, t.tramos.map((x) => x.accion)], [2, 1, ['corta']], 'rehecho todo:');
  eq(p.rehacer(), false);
  /* Deshacer y hacer otra cosa, que todavía no se ha apuntado: cuenta
     como un paso, y ya no se puede rehacer lo de antes. */
  p.deshacer();
  t.fichas.seleccionar(new Set([a2.id]));
  t._tocarFicha(ficha(t, a2.id));
  t._elegir('finta', {});
  t.cerrar();
  ok(p.deshacer());
  eq([t.todasLasFases.length, t.iFase, t.tramos.length], [2, 1, 0], 'se deshace solo la finta:');
  ok(p.rehacer());
  eq([p.rehacer(), t.tramos.map((x) => x.accion)], [false, ['finta']], 'y lo nuevo manda sobre lo que se había deshecho:');
  p.deshacer();
  /* Y sin cambios, apuntar no añade pasos. */
  const n = p.historial.stack.length;
  p._apuntar(); p._apuntar();
  eq(p.historial.stack.length, n);
});

/* A1 bota, tira y falla; B1, que defendía, coge el rebote en la fase 3. */
function reboteDelDefensor() {
  reiniciarIds();
  const m = montar();
  const { t } = m;
  t.poner([]);
  const a1 = t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.3, y: 0.6 });
  t.anadirFicha({ kind: 'balon' }, { x: 0.3, y: 0.6 });
  const b1 = t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.5, y: 0.4 });
  t.cerrar();
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), { x: 0.6, y: 0.3 }), tipo: 'run' });
  t.cerrar(); t.repaso.parar(); t._cerrarFase();
  t._tocarFicha(ficha(t, a1.id));
  t._elegir('tira', { variante: 'suspension', desenlace: 'falla' });
  t.cerrar(); t.repaso.parar(); t._cerrarFase();
  t._tocarFicha(ficha(t, b1.id));
  t._elegir('recoge', {});
  t.cerrar(); t.repaso.parar();
  m.avisos.length = 0;
  return { ...m, a1, b1 };
}
const copia = (x) => JSON.parse(JSON.stringify(x));

test('EL TRAZO DE QUIEN VENÍA DEFENDIENDO SALE DE DONDE LE DEJÓ LA DEFENSA, y reabrir no lo mueve', () => {
  const { t, b1, avisos } = reboteDelDefensor();
  eq(avisos, []);
  const antes = copia(t.jugada());
  const suyo = antes.fases[2].tramos[0];
  const alEmpezar = antes.elementos.find((e) => e.id === b1.id);
  eq([suyo.elemento_id, suyo.accion], [b1.id, 'recoge']);
  ok(metrosEntre('entera', suyo.trazo[0], alEmpezar) > 1, 'la defensa le ha movido antes de ir a por el rebote');
  /* Reabierta: la misma, punto por punto. */
  const o = montar();
  ok(o.t.cargar(antes).ok);
  eq(copia(o.t.jugada()), antes, 'la jugada reabierta es la guardada:');
  /* Y en el proyector no da un salto entre la fase 2 y la 3. */
  const anim = compilarMod.compilar(o.t.jugada());
  const acaba = anim.fases[1].movimientos.find((x) => x.automatico && x.elemento_id === 'B1').muestras.at(-1);
  const empieza = anim.fases[2].movimientos.find((x) => !x.automatico && x.elemento_id === 'B1').path[0];
  ok(metrosEntre('entera', acaba, empieza) < 0.01, `acaba la 2 en ${JSON.stringify(acaba)} y empieza la 3 en ${JSON.stringify(empieza)}`);
});

test('DESHACER NO CAMBIA LO QUE NADIE HA TOCADO: tras deshacer un nombre, la jugada es la de antes de ponerlo', () => {
  const { t, p } = reboteDelDefensor();
  Object.assign(p, { derecha: { pintar() {} } });
  p._montarHistorial();
  const antes = copia(t.jugada());
  ok(t.renombrarFase('El rebote'));
  p._apuntar();
  ok(p.deshacer());
  eq(copia(t.jugada()), antes);
  ok(p.rehacer());
  eq(copia(t.jugada()).fases[2].tramos, antes.fases[2].tramos, 'ni al rehacerlo:');
});

test('AL CORREGIR UNA FASE ANTERIOR, el trazo del ex defensor sale de donde le deja AHORA la defensa', () => {
  const { t, a1, b1 } = reboteDelDefensor();
  const antes = copia(t.jugada()).fases[2].tramos[0].trazo[0];
  t.irAFase(0);
  /* A1 bota hasta otro sitio: la defensa le sigue hasta otro sitio. */
  t.borrarTramo(t.tramos[0].id);
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), { x: 0.4, y: 0.25 }), tipo: 'run' });
  t.cerrar(); t.repaso.parar();
  const j = copia(t.jugada());
  const ahora = j.fases[2].tramos[0].trazo[0];
  ok(metrosEntre('entera', antes, ahora) > 0.3, `se ha reanclado: ${JSON.stringify(antes)} → ${JSON.stringify(ahora)}`);
  const anim = compilarMod.compilar(j);
  const acaba = anim.fases[1].movimientos.find((x) => x.automatico && x.elemento_id === 'B1').muestras.at(-1);
  ok(metrosEntre('entera', acaba, ahora) < 0.01, `a donde acaba la fase 2: ${JSON.stringify(acaba)} / ${JSON.stringify(ahora)}`);
  ok(b1, 'b1');
});

test('REABRIR UNA JUGADA EMPIEZA EL HISTORIAL: no se deshace hasta antes de abrirla; y el fantasma se enciende y se apaga', () => {
  const { t, p } = sinAtacante();
  Object.assign(p, { derecha: { pintar() {} } });
  p._montarHistorial();
  const guardada = JSON.parse(JSON.stringify(t.jugada()));
  t._cerrarFase();
  p._apuntar();
  eq(p.historial.canUndo(), true);
  p.cargar(guardada);
  eq([p.historial.canUndo(), p.deshacer(), t.todasLasFases.length], [false, false, 1]);
  /* El fantasma de la fase anterior se pinta, o no. */
  t._cerrarFase();
  let pintados = 0;
  t._pintarTramo = () => { pintados++; };
  const lienzo = { ctx: { save() {}, restore() {}, globalAlpha: 1 }, R: {}, toPx: () => [0, 0] };
  t._dibujarFantasma(lienzo);
  eq([t.fantasma, pintados], [true, 1]);
  t.verFantasma(false);
  t._dibujarFantasma(lienzo);
  eq([t.fantasma, pintados], [false, 1], 'apagado, no se pinta:');
});

/* Una Pizarra de pruebas con el historial montado y un selector de canasta. */
function conHistorial() {
  const m = sinAtacante();
  const select = { value: 'norte' };
  Object.assign(m.p, {
    derecha: { pintar() {} },
    el: { querySelector: (s) => (s === '.pz-arriba__canasta select' ? select : null) },
  });
  m.p._montarHistorial();
  return { ...m, select };
}

test('DESHACER Y REHACER DEJAN EL SELECTOR DE CANASTA DICIENDO LO MISMO QUE EL TABLERO', () => {
  const { t, p, select } = conHistorial();
  select.value = 'sur'; t.setCanasta('sur'); p._cambio(); p._apuntar();
  p.deshacer();
  eq([t.canasta, select.value], ['norte', 'norte'], 'tras deshacer:');
  p.rehacer();
  eq([t.canasta, select.value], ['sur', 'sur'], 'tras rehacer:');
});

test('CTRL+Z CON UN TRAZO A MEDIAS SOLO LO CANCELA: no se pierde el paso de antes', () => {
  const { t, p, a1, a2 } = conHistorial();
  corta(t, a1.id, { x: 0.2, y: 0.3 });
  p._apuntar();
  t.dibujo.empezar({ elemento: ficha(t, a2.id), accion: t._accionDe('corta'), variante: null, conDedo: false });
  ok(t.dibujo.dibujando, 'se está dibujando el corte de A2');
  eq(p.deshacer(), true);
  eq([t.dibujo.dibujando, t.tramos.filter((x) => x.elemento_id === a1.id).length], [false, 1], 'el trazo a medias se va y el corte de A1 sigue:');
  ok(p.deshacer());
  eq(t.tramos.filter((x) => x.elemento_id === a1.id).length, 0, 'el siguiente Ctrl+Z sí deshace el corte:');
});

test('DESHACER CORTA LOS GESTOS VIVOS: un arrastre a medias no pisa lo deshecho', () => {
  const { t, p, a2 } = conHistorial();
  let cortados = 0;
  p.lienzo = { gestoVivo: true, cancelarGestos() { cortados++; } };
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  p._apuntar();
  p.deshacer();
  eq(cortados, 1, 'deshacer corta los gestos:');
  p.rehacer();
  eq(cortados, 2, 'y rehacer también:');
});

test('NO SE APUNTA UN PASO MIENTRAS SE ARRASTRA: pararse a mitad no es el final', () => {
  const { t, p, a2 } = conHistorial();
  const n = p.historial.stack.length;
  p.lienzo = { gestoVivo: true, cancelarGestos() {} };
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  p._apuntarSiSuelto();
  eq(p.historial.stack.length, n, 'con el gesto vivo no se apunta:');
  ok(p._relojHistorial, 'y se vuelve a mirar más tarde');
  p.lienzo.gestoVivo = false;
  p._apuntarSiSuelto();
  eq(p.historial.stack.length, n + 1, 'soltado, se apunta de una vez:');
  p.deshacer();
  eq(t.tramos.length, 1, 'y un solo deshacer vuelve a antes del arrastre:');
});

test('«SIGUIENTE FASE» Y DESHACER: el cierre de fase pendiente se va con el repaso', () => {
  const { t, p, a1 } = conHistorial();
  corta(t, a1.id, { x: 0.2, y: 0.3 });
  p._apuntar();
  eq(t.siguienteFase(), true);
  ok(t.repaso.corriendo, 'el repaso de la fase está en marcha');
  p.deshacer();
  ok(!t.repaso.corriendo, 'deshacer corta el repaso');
  t.repaso.onFin();
  eq(t.todasLasFases.length, 1, 'y su final no abre una fase que nadie pidió:');
  /* Ni ▶ después de una «Siguiente fase» cortada a medias. */
  t.siguienteFase();
  t.reproducirFase();
  t.repaso.onFin();
  eq(t.todasLasFases.length, 1, 'ver la fase con ▶ no la cierra:');
});

test('EL ESPACIO REPRODUCE UNA VEZ, y mantenido no repite; el suelto de la pista también reproduce', () => {
  const { p } = conHistorial();
  let veces = 0;
  p.ver = () => { veces++; };
  const tecla = (extra) => p._atenderTecla({ key: ' ', ctrlKey: false, metaKey: false, altKey: false, defaultPrevented: false, preventDefault() {}, target: { tagName: 'DIV' }, ...extra });
  tecla({ repeat: false });
  tecla({ repeat: true });
  tecla({ repeat: true });
  eq(veces, 1, 'una pulsación, una reproducción:');
  p._espacioSolo();
  eq(veces, 2, 'el Espacio soltado sin haber movido la pista reproduce:');
  p.tablero.dibujo.empezar({ elemento: p.tablero.fichas.elementos[0], accion: p.tablero._accionDe('corta'), variante: null, conDedo: false });
  p._espacioSolo();
  eq(veces, 2, 'pero no mientras se dibuja:');
  p.tablero.cerrar();
});

test('↶ VALE NADA MÁS CAMBIAR ALGO, sin esperar a que se apunte', () => {
  const { t, p, a2 } = conHistorial();
  p._bDeshacer = { disabled: true };
  p._bRehacer = { disabled: true };
  p._pintarHistorial();
  eq(p._bDeshacer.disabled, true, 'sin cambios, desactivado:');
  corta(t, a2.id, { x: 0.6, y: 0.2 });
  p._cambio();
  eq(p._bDeshacer.disabled, false, 'con un cambio por apuntar, activado:');
  p._apuntar();
  eq(p._bDeshacer.disabled, false, 'y apuntado, también:');
  clearTimeout(p._relojHistorial);
});

test('LOS AVISOS PINTAN COMO TEXTO lo que viene de los datos, y solo dejan las negritas', () => {
  eq(htmlDeAviso('<b>«A1»</b> no puede'), '<b>«A1»</b> no puede');
  eq(htmlDeAviso('«<img src=x onerror=alert(1)>» no se ha quitado'), '«&lt;img src=x onerror=alert(1)&gt;» no se ha quitado');
  eq(htmlDeAviso('<b>«<svg onload=alert(2)>»</b>'), '<b>«&lt;svg onload=alert(2)&gt;»</b>');
  eq(htmlDeAviso('Pepe & "Ana"'), 'Pepe &amp; &quot;Ana&quot;');
  eq(htmlDeAviso(null), '');
});

console.log('\n· plantillas: colocaciones y fases guardadas (§7.8)');

test('LAS PLANTILLAS RECUERDAN A QUÉ ARO ATACABAN, y se ponen en espejo si la jugada ataca al otro', () => {
  const montado = (canasta) => {
    reiniciarIds();
    const m = montar();
    m.t.setCanasta(canasta);
    let l = [];
    l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.30, 0.20);
    l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.70, 0.30);
    l = anadir(l, { kind: 'balon' }, 0.34, 0.20);
    m.t.poner(asignarBalon(l, l[2].id, l[0].id, 'entera'));
    return m;
  };
  const norte = montado('norte');
  const col = JSON.parse(JSON.stringify(norte.t.colocacion()));
  eq(col.canasta, 'norte', 'la colocación guarda el aro:');
  /* Puesta en una pizarra que ataca al norte, queda igual. */
  const igual = montado('norte');
  igual.t.ponerColocacion(col, 'sustituir');
  eq(igual.t.fichas.elementos.filter((e) => e.kind === 'jugador').map((e) => [e.x, e.y]), [[0.3, 0.2], [0.7, 0.3]]);
  /* En una que ataca al sur, en espejo: lo de arriba pasa abajo. */
  const sur = montado('sur');
  sur.t.ponerColocacion(col, 'sustituir');
  const ys = sur.t.fichas.elementos.filter((e) => e.kind === 'jugador').map((e) => Number(e.y.toFixed(3)));
  eq(ys, [0.8, 0.7], 'al otro lado de la pista:');
  /* Guardada atacando al sur, y puesta en una que ataca al norte: también en espejo. */
  const desdeSur = montado('sur');
  const colSur = JSON.parse(JSON.stringify(desdeSur.t.colocacion()));
  eq(colSur.canasta, 'sur', 'y recuerda que era el sur:');
  const aNorte = montado('norte');
  aNorte.t.ponerColocacion(colSur, 'sustituir');
  eq(aNorte.t.fichas.elementos.filter((e) => e.kind === 'jugador').map((e) => Number(e.y.toFixed(3))), [0.8, 0.7], 'de vuelta al otro lado:');
  /* Lo que no se entiende de una colocación se dice, y el resto se pone. */
  const rota = { ...col, elementos: [...col.elementos, { kind: 'jugador', equipo: 'A', x: 'aquí', y: null }] };
  const conAvisos = montado('norte');
  conAvisos.avisos.length = 0;
  ok(conAvisos.t.ponerColocacion(rota, 'sustituir') >= 2, 'se ponen las que valen');
  ok(conAvisos.avisos.some((x) => x[0] === 'aviso'), `y se dice lo que no se ha entendido: ${JSON.stringify(conAvisos.avisos)}`);
  const sumando = montado('norte');
  sumando.avisos.length = 0;
  ok(sumando.t.ponerColocacion(rota, 'anadir') >= 2);
  ok(sumando.avisos.some((x) => x[0] === 'aviso'), 'también al añadirla a lo que hay');
  /* Y una fase guardada atacando al norte, puesta en una que ataca al sur. */
  const f = montado('norte');
  const a1 = f.t.fichas.elementos.find((e) => e.kind === 'jugador');
  corta(f.t, a1.id, { x: 0.5, y: 0.1 });
  f.t.cerrar();
  const { datos } = f.t.plantillaDeFase();
  eq(datos.canasta, 'norte', 'la fase guarda el aro:');
  /* Una fase guardada atacando al sur recuerda su aro. */
  const fs = montado('sur');
  corta(fs.t, fs.t.fichas.elementos.find((e) => e.kind === 'jugador').id, { x: 0.5, y: 0.9 });
  fs.t.cerrar();
  eq(fs.t.plantillaDeFase().datos.canasta, 'sur', 'la fase guarda el aro, sea cual sea:');
  const g = montado('sur');
  const mapa = Object.fromEntries(datos.papeles.map((p) => [p.clave, g.t.fichas.elementos.filter((e) => e.kind === 'jugador')[datos.papeles.indexOf(p)].id]));
  const r = g.t.insertarPlantilla(datos, mapa);
  ok(r.ok, 'se inserta');
  const fin = g.t.tramos[0].trazo.at(-1);
  ok(Math.abs(fin.y - 0.9) < 1e-6, `el corte acaba al otro lado: ${fin.y}`);
});

test('UNA COLOCACIÓN GUARDADA SE AÑADE A LO QUE HAY (en la fase 1) O LO SUSTITUYE TODO', () => {
  const { t, a2, avisos } = conAtaque();
  const datos = JSON.parse(JSON.stringify(t.colocacion()));
  eq(datos.elementos.map((e) => e.kind), ['jugador', 'jugador', 'balon']);
  corta(t, a2.id, { x: 0.7, y: 0.3 });
  t.cerrar();
  eq(t.ponerColocacion(datos, 'anadir'), 3, 'añadida:');
  const jug = t.fichas.elementos.filter((e) => e.kind === 'jugador');
  eq(jug.map((e) => t.nombreDe(e)), ['A1', 'A2', 'A3', 'A4']);
  eq([t.fichas.elementos.filter((e) => e.kind === 'balon').length, t.tramos.length], [2, 1], 'con su balón, y lo dibujado sigue:');
  ok(t.fases[0].entrada[jug[3].id], 'las nuevas tienen su arranque');
  t._cerrarFase();
  eq([t.ponerColocacion(datos, 'anadir'), avisos.at(-1)[1]], [0, 'Añadir la colocación'], 'en otra fase no se ponen fichas:');
  eq(t.ponerColocacion(datos, 'sustituir'), 3, 'sustituir empieza de nuevo:');
  eq([t.fichas.elementos.length, t.todasLasFases.length, t.tramos.length, t.iFase], [3, 1, 0, 0]);
  eq(t.ponerColocacion({ elementos: [] }, 'sustituir'), 0, 'una vacía no borra nada:');
  eq(t.fichas.elementos.length, 3);
});

test('UNA FASE GUARDADA SE INSERTA CON CADA PAPEL EN SU FICHA: en la fase vacía, o en una nueva detrás', () => {
  const { t, a1, a2 } = conAtaque();
  corta(t, a2.id, { x: 0.7, y: 0.3 });
  t.cerrar();
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), ficha(t, a2.id)), tipo: 'pass' });
  t.cerrar();
  const { datos, avisos } = t.plantillaDeFase();
  eq([datos.papeles.map((p) => p.nombre), datos.tramos.map((x) => x.accion), avisos], [['A2', 'A1'], ['corta', 'pasa'], []]);
  /* Otra pizarra, con los mismos nombres en otros sitios. */
  const o = montar();
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.2, 0.8);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.8, 0.8);
  l = anadir(l, { kind: 'balon' }, 0.23, 0.8);
  const [b1, b2, bal] = l;
  o.t.poner(asignarBalon(l, bal.id, b1.id, 'entera'));
  const mapa = o.t.papelesDe(datos);
  eq(mapa, { p1: b2.id, p2: b1.id }, 'cada papel, a quien se llama igual:');
  eq(o.t.insertarPlantilla(datos, { p1: b2.id }).ok, false, 'sin decir todos los papeles, no:');
  const r = o.t.insertarPlantilla(datos, mapa);
  eq([r.ok, r.avisos, o.t.iFase, o.t.todasLasFases.length], [true, [], 0, 1], 'en la fase vacía, en ella:');
  const [corte, pase] = o.t.tramos;
  eq([[corte.trazo[0].x, corte.trazo[0].y], [corte.trazo.at(-1).x, corte.trazo.at(-1).y]], [[0.8, 0.8], [0.7, 0.3]]);
  eq([pase.corre_id, pase.receptor_id, [pase.trazo.at(-1).x, pase.trazo.at(-1).y]], [bal.id, b2.id, [0.7, 0.3]]);
  eq(ficha(o.t, bal.id).portador_id, b2.id, 'y el balón acaba en quien lo recibe:');
  ok(/A1 pasa a A2/.test(o.t.frases()[0]), o.t.frases()[0]);
  /* Si no se puede, no deja una fase vacía de más. */
  eq([o.t.insertarPlantilla(datos, { p1: b2.id, p2: b2.id }).ok, o.t.todasLasFases.length, o.t.iFase], [false, 1, 0]);
  /* Con algo ya dibujado, va en una fase nueva detrás. */
  const s = o.t.insertarPlantilla(datos, { p1: b1.id, p2: b2.id });
  eq([s.ok, o.t.iFase, o.t.todasLasFases.length, o.t.tramos.map((x) => x.accion)], [true, 1, 2, ['corta', 'pasa']]);
  eq(o.t.tramos[0].trazo[0], { ...o.t.tramos[0].trazo[0], x: 0.2, y: 0.8 }, 'cada uno desde donde le deja la fase anterior:');
});

test('UNA COLOCACIÓN AÑADIDA CUENTA COMO PUESTA A MANO: poner después otra ficha no la descoloca', () => {
  /* A1 con balón, A2 y dos defensores colocados A MANO, lejos de su par. */
  const o = conAtaque();
  const b1 = o.t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.5, y: 0.5 });
  const b2 = o.t.anadirFicha({ kind: 'jugador', equipo: 'B' }, { x: 0.5, y: 0.5 });
  o.t.cerrar();
  o.t.fichas._cambio(o.t.fichas.elementos.map((e) => (e.id === b1.id ? { ...e, x: 0.9, y: 0.9 } : e.id === b2.id ? { ...e, x: 0.1, y: 0.9 } : e)));
  o.t._recolocadas([b1.id, b2.id]);
  const datos = JSON.parse(JSON.stringify(o.t.colocacion()));
  const defensores = (t) => t.fichas.elementos.filter((e) => e.equipo === 'B').map((e) => [e.x, e.y]);
  for (const modo of ['anadir', 'sustituir']) {
    reiniciarIds();
    const { t } = montar();
    t.poner([]);
    ok(t.ponerColocacion(datos, modo) > 0);
    eq(defensores(t), [[0.9, 0.9], [0.1, 0.9]], `${modo}: donde se guardaron:`);
    t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.8, y: 0.5 });
    eq(defensores(t), [[0.9, 0.9], [0.1, 0.9]], `${modo}: y siguen ahí al poner otra ficha:`);
    eq(Object.entries(t.jugada().elementos.filter((e) => e.equipo === 'B').map((e) => [e.x, e.y])).length, 2);
  }
});

test('CAMBIAR «ATACA A» CAMBIA EL ARO CON EL QUE SE TRABAJA YA, aunque los papeles se hubieran calculado antes', () => {
  const { t, a1 } = conAtaque();
  eq([t.papeles().fases[0].canasta, t.canastaEnCurso], ['norte', 'norte']);
  t.setCanasta('sur');
  eq([t.canastaEnCurso, t.fichas.canasta, t.dibujo.canasta], ['sur', 'sur', 'sur']);
  t._tocarFicha(ficha(t, a1.id));
  t._elegir('entra', { variante: 'bandeja' });
  ok(t.tramos[0].trazo.at(-1).y > 0.5, `«entra» va al aro sur: ${JSON.stringify(t.tramos[0].trazo.at(-1))}`);
});

test('AL SUSTITUIR LA ESCENA, el botón del grupo de antes no se queda huérfano', () => {
  const { t, a1, a2 } = conAtaque();
  const datos = JSON.parse(JSON.stringify(t.colocacion()));
  seleccionar(t, a1.id, a2.id);
  ok(t._botonGrupo, 'con dos seleccionados, el botón está');
  ok(t.ponerColocacion(datos, 'sustituir') > 0);
  eq([t.grupo().length, t._botonGrupo], [0, null], 'las fichas son otras: ni grupo ni botón:');
});

test('UNA FASE GUARDADA CON UN BLOQUEO Y UN TIRO: el bloqueo, junto al compañero de ahora; el tiro, al aro que se ataca', () => {
  /* Se guarda: A2 bloquea para A1, y A1 tira. */
  const { t, a1, a2 } = conAtaque();
  t._tocarFicha(ficha(t, a2.id));
  t._elegir('bloquea', { variante: 'directo' });
  t._companeroElegido(ficha(t, a1.id), { elemento: ficha(t, a2.id), accion: t._accionDe('bloquea'), variante: 'directo' });
  t.cerrar();
  t._tocarFicha(ficha(t, a1.id));
  t._elegir('tira', { variante: 'suspension', desenlace: 'entra' });
  t.cerrar();
  const { datos } = t.plantillaDeFase();
  eq(datos.tramos.map((x) => [x.accion, x.tipo]), [['bloquea', 'bloqueo'], ['tira', 'pass']]);
  /* Otra pizarra: los mismos, en otro sitio y atacando al otro aro. */
  reiniciarIds();
  const o = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.25, 0.35);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.45, 0.5);
  l = anadir(l, { kind: 'balon' }, 0.28, 0.35);
  const [n1, n2, bal] = l;
  o.t.poner(asignarBalon(l, bal.id, n1.id, 'entera'));
  o.t.setCanasta('sur');
  const r = o.t.insertarPlantilla(datos, o.t.papelesDe(datos));
  eq([r.ok, r.avisos], [true, []]);
  const [bloqueo, tiro] = o.t.tramos;
  /* Como si se dibujara aquí a mano. */
  const m = montar();
  m.t.poner(asignarBalon(l, bal.id, n1.id, 'entera'));
  m.t.setCanasta('sur');
  m.t._tocarFicha(ficha(m.t, n2.id));
  m.t._elegir('bloquea', { variante: 'directo' });
  m.t._companeroElegido(ficha(m.t, n1.id), { elemento: ficha(m.t, n2.id), accion: m.t._accionDe('bloquea'), variante: 'directo' });
  m.t.cerrar();
  m.t._tocarFicha(ficha(m.t, n1.id));
  m.t._elegir('tira', { variante: 'suspension', desenlace: 'entra' });
  m.t.cerrar();
  eq([bloqueo.trazo.at(-1).x, bloqueo.trazo.at(-1).y], [m.t.tramos[0].trazo.at(-1).x, m.t.tramos[0].trazo.at(-1).y], 'el bloqueo, donde se pondría a mano:');
  ok(metrosEntre('entera', bloqueo.trazo.at(-1), ficha(o.t, n1.id)) < 3, 'cerca de su compañero');
  eq([tiro.trazo.at(-1).x, tiro.trazo.at(-1).y], [m.t.tramos[1].trazo.at(-1).x, m.t.tramos[1].trazo.at(-1).y], 'y el tiro, al aro sur:');
  ok(tiro.trazo.at(-1).y > 0.5, `al sur: ${JSON.stringify(tiro.trazo.at(-1))}`);
  eq(compilarMod.compilar(o.t.jugada()).warnings, []);
});

test('SI DE LA FASE GUARDADA NO SE PUEDE PONER NADA, no queda una fase vacía de más ni se da por insertada', () => {
  const { t, a1, a2 } = conAtaque();
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), ficha(t, a2.id)), tipo: 'pass' });
  t.cerrar();
  const { datos } = t.plantillaDeFase();        // un solo pase: p1 pasa a p2
  /* A1 tiene el balón; se le dice que pase a quien no lo lleva. */
  const o = tresAtacantes();
  corta(o.t, o.a2.id, { x: 0.6, y: 0.3 });
  o.t.cerrar(); o.t.repaso.parar(); o.t._cerrarFase();
  corta(o.t, o.a3.id, { x: 0.4, y: 0.3 });
  o.t.cerrar(); o.t.repaso.parar();
  o.t.irAFase(0);
  o.avisos.length = 0;
  const antes = o.t.todasLasFases.map((f) => [f.id, f.tramos.length]);
  const r = o.t.insertarPlantilla(datos, { p1: o.a3.id, p2: o.a2.id });
  eq([r.ok, o.t.todasLasFases.map((f) => [f.id, f.tramos.length]), o.t.iFase], [false, antes, 0], 'todo como estaba:');
  ok(/No lleva balón/.test(r.avisos[0]) && /no se puede hacer nada/.test(o.avisos.at(-1)[2]), JSON.stringify([r.avisos, o.avisos]));
  /* Con quien sí lo lleva, entra en una fase nueva detrás. */
  const s = o.t.insertarPlantilla(datos, { p1: o.a1.id, p2: o.a2.id });
  eq([s.ok, o.t.todasLasFases.length, o.t.iFase, o.t.tramos.map((x) => x.accion)], [true, 3, 1, ['pasa']]);
});

test('UN BOTE GUARDADO NO SE LE PONE A QUIEN NO LLEVA BALÓN', () => {
  const { t, a1 } = conAtaque();
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), { x: 0.4, y: 0.3 }), tipo: 'run' });
  t.cerrar();
  const { datos } = t.plantillaDeFase();
  eq(datos.tramos.map((x) => x.accion), ['bota'], 'se guarda sin marca de balón: lo dice el catálogo al insertar:');
  const o = conAtaque();
  const r = o.t.insertarPlantilla(datos, { p1: o.a2.id });     // A2 no lleva balón
  eq([r.ok, o.t.tramos.length], [false, 0]);
  eq(o.t.insertarPlantilla(datos, { p1: o.a1.id }).ok, true);
});

await testA('LAS PLANTILLAS SE GUARDAN PARA EL CLUB (con datos de mentira): con nombre, solo las de esta pista, y se quitan', async () => {
  const { t, p, avisos, a2 } = conAtaque();
  const llamadas = [];
  const paneles = [];
  Object.assign(p, {
    lienzo: t.lienzo, plantillas: [], derecha: { pintar() {} },
    panel: { recuento() {}, colocaciones: (l) => paneles.push(l.map((x) => x.nombre)) },
    datos: {
      crearPlantilla: async (x) => { llamadas.push(['crear', x.tipo, x.nombre, x.pista]); return { ...x, id: `u${llamadas.length}` }; },
      borrarPlantilla: async (id) => { llamadas.push(['borrar', id]); return id !== 'ajena'; },
      cargarPlantillas: async () => [{ id: 'ajena', tipo: 'colocacion', nombre: 'De otro', pista: 'entera', datos: { elementos: [] } }, { id: 'm', tipo: 'colocacion', nombre: 'De media', pista: 'media', datos: { elementos: [] } }],
    },
  });
  eq(await p.guardarPlantilla('colocacion', '  '), null);
  ok(/ponle un nombre/.test(avisos.at(-1)), avisos.at(-1));
  eq(await p.guardarPlantilla('fase', 'Vacía'), null, 'una fase sin dibujar no se guarda:');
  const c = await p.guardarPlantilla('colocacion', ' Dos   arriba ');
  eq([c && c.nombre, llamadas.at(-1)], ['Dos arriba', ['crear', 'colocacion', 'Dos arriba', 'entera']]);
  corta(t, a2.id, { x: 0.7, y: 0.3 });
  t.cerrar();
  const f = await p.guardarPlantilla('fase', 'Corte al aro');
  eq([f && f.tipo, p.plantillasDe('fase').map((x) => x.nombre), p.plantillasDe('colocacion').map((x) => x.nombre)], ['fase', ['Corte al aro'], ['Dos arriba']]);
  /* Lo que llega de la base se suma a lo recién guardado; las de otra pista no se ofrecen. */
  await p._cargarVariantesYVideos();
  eq(p.plantillasDe('colocacion').map((x) => x.nombre).sort(), ['De otro', 'Dos arriba']);
  eq(paneles.at(-1).slice().sort(), ['De otro', 'Dos arriba'], 'y el panel las enseña:');
  /* Quitar: la propia sí; la de otro, la base no deja y se dice. */
  ok(await p.quitarPlantilla(c));
  eq(await p.quitarPlantilla(p.plantillas.find((x) => x.id === 'ajena')), false);
  ok(/quien la guardó/.test(avisos.at(-1)), avisos.at(-1));
  eq(p.plantillasDe('colocacion').map((x) => x.nombre), ['De otro']);
  /* Y se pone desde la Pizarra. */
  ok(p.ponerColocacion({ datos: t.colocacion() }, 'anadir'));
  eq(t.fichas.elementos.filter((e) => e.kind === 'jugador').length, 4);
});

test('EL TIRADOR GIRA LA FILA: se coge al final de la cola y se imanta cada 15°', () => {
  const { t, cono } = conConoDeFila();
  t.hacerFila(cono.id, { n: 2, orientacion: 90 });
  t.fichas.seleccion = new Set([cono.id]);
  const tirador = t.tiradorDeFila();
  ok(tirador && tirador.cono === cono.id, 'con la fila seleccionada hay tirador');
  const g = t._atenderTirador({ ...tirador.punto, agarrePx: 0, tipoPuntero: 'mouse' });
  ok(g, 'y se coge');
  /* Se arrastra hacia la derecha y un poco arriba: 0° imantado. */
  g.soltar({ x: 0.7, y: 0.59 });
  eq(ficha(t, cono.id).fila.orientacion, 0);
  eq(t._atenderTirador({ x: 0.1, y: 0.1, agarrePx: 0, tipoPuntero: 'mouse' }), null, 'lejos de él, no coge nada:');
});

test('un PASE no rodea conos: vuela', () => {
  reiniciarIds();
  const { t } = montar();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.50, 0.80);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.50, 0.20);
  l = anadir(l, { kind: 'balon' }, 0.54, 0.80);
  l = anadir(l, { kind: 'cono' }, 0.50 + 0.3 / 18, 0.50);
  const [a1, a2, bal] = l;
  t.poner(asignarBalon(l, bal.id, a1.id, 'entera'));
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('pasa'), variante: null,
    trazo: nuevoTrazo(ficha(t, a1.id), ficha(t, a2.id)), tipo: 'pass' });
  eq(t.tramos[0].sorteando, undefined);
  eq(t.tramos[0].trazo.length, 2);
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

console.log('\n· los gestos en el sitio (§4.4)');

test('UNA FINTA SE APLICA AL MOMENTO: un trazo que sale y vuelve, y la ficha no se mueve', () => {
  const { t, a1, a2, avisos } = conAtaque();
  elegir(t, a1.id, 'finta');
  eq(avisos, [], 'ya se puede dibujar:');
  const g = t.tramos[0];
  eq([g.accion, g.tipo, g.corre_id, g.trazo.length], ['finta', 'gesto', a1.id, 3]);
  eq([[g.trazo[0].x, g.trazo[0].y], [g.trazo[2].x, g.trazo[2].y]], [[0.3, 0.5], [0.3, 0.5]]);
  eq([ficha(t, a1.id).x, ficha(t, a1.id).y], [0.3, 0.5], 'la ficha, en su sitio:');
  eq(t.estadoDe(ficha(t, a1.id)).llevaBalon, true, 'y con su balón:');
  ok(/^A1 finta/.test(t.frases()[0]), t.frases()[0]);
  /* Los que son del balón, solo con él. */
  elegir(t, a2.id, 'cambia_de_mano');
  eq(avisos.at(-1), ['noPuede', 'Cambia de mano', 'no lleva balón']);
  elegir(t, a2.id, 'finta');
  eq(t.tramos.length, 2, 'la finta sin balón, sí:');
});

test('EL GESTO VA CON SU FICHA: al moverla, se lleva entero; y con un corte delante, se estira el corte', () => {
  const { t, a2 } = conAtaque();
  elegir(t, a2.id, 'finta');
  /* Solo con gestos, moverla en la fase 1 es cambiar su arranque. */
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === a2.id ? { ...e, x: 0.6, y: 0.6 } : e)));
  t._recolocadas([a2.id]);
  const g = t.tramos[0].trazo;
  eq([[g[0].x, g[0].y], [g[2].x, g[2].y]], [[0.6, 0.6], [0.6, 0.6]], 'el gesto, entero, al sitio nuevo:');
  eq(t.fases[0].entrada[a2.id], { x: 0.6, y: 0.6 }, 'que es su arranque:');
  /* Corta y después finta: al moverla se estira el corte y la finta va detrás. */
  corta(t, a2.id, { x: 0.8, y: 0.3 });
  elegir(t, a2.id, 'finta');
  t.cerrar();
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === a2.id ? { ...e, x: 0.9, y: 0.2 } : e)));
  const [g1, c, g2] = t.tramos;
  eq([g1.trazo[0].x, g1.trazo[0].y], [0.6, 0.6], 'la finta de antes del corte no se mueve:');
  eq([c.trazo.at(-1).x, c.trazo.at(-1).y], [0.9, 0.2], 'el corte acaba donde está ahora:');
  eq([[g2.trazo[0].x, g2.trazo[0].y], [g2.trazo[2].x, g2.trazo[2].y]], [[0.9, 0.2], [0.9, 0.2]], 'y la finta de después, con ella:');
});

test('QUIEN SOLO PASA O TIRA NO CAMBIA DE ARRANQUE AL ARRASTRARLO: su finta se queda con el pase', () => {
  const { t, a1, a2, bal } = conAtaque();
  elegir(t, a1.id, 'finta');
  t.cerrar();
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), ficha(t, a2.id)), tipo: 'pass' });
  t.cerrar();
  t.fichas._cambio(t.fichas.elementos.map((e) => (e.id === a1.id ? { ...e, x: 0.2, y: 0.7 } : e)));
  t._recolocadas([a1.id]);
  const g = t.tramos[0].trazo;
  eq([[g[0].x, g[0].y], [g[2].x, g[2].y], t.fases[0].entrada[a1.id]], [[0.3, 0.5], [0.3, 0.5], { x: 0.3, y: 0.5 }], 'el gesto sigue en el arranque, que no ha cambiado:');
  ok(bal, 'balón');
});

test('RECIBE Y FINTA: mover al receptor estira el pase hasta él, y su finta va con él', () => {
  const { t, a1, a2 } = conAtaque();
  t._trazoHecho({ elemento: ficha(t, a1.id), accion: t._accionDe('pasa'), variante: null, trazo: nuevoTrazo(ficha(t, a1.id), ficha(t, a2.id)), tipo: 'pass' });
  t.cerrar();
  elegir(t, a2.id, 'finta');
  t.cerrar();
  const balon = t.fichas.elementos.find((e) => e.kind === 'balon');
  t.fichas._cambio(seguirMod.seguirAlPortador(t.fichas.elementos.map((e) => (e.id === a2.id ? { ...e, x: 0.8, y: 0.7 } : e)), 'entera'));
  t._recolocadas([a2.id]);
  const [pase, finta] = t.tramos;
  const fin = pase.trazo.at(-1);
  const b = ficha(t, balon.id);
  ok(Math.abs(fin.x - b.x) < 1e-9 && Math.abs(fin.y - b.y) < 1e-9, `el pase acaba donde está ahora el balón: ${JSON.stringify(fin)} / ${JSON.stringify([b.x, b.y])}`);
  eq([finta.trazo[0].x, finta.trazo[0].y], [0.8, 0.7], 'y la finta, con él:');
});

test('UN GESTO NO RODEA CONOS, y al borrar el bote de antes vuelve con su ficha', () => {
  const { t, a1 } = conAtaque();
  t.anadirFicha({ kind: 'cono' }, { x: 0.305, y: 0.43 });
  t.cerrar();
  elegir(t, a1.id, 'finta');
  t.cerrar();
  t.fichas._cambio(t.fichas.elementos.map((e) => ({ ...e })));
  eq([t.tramos[0].trazo.length, 'sorteando' in t.tramos[0]], [3, false], 'con un cono delante sigue siendo ida y vuelta:');
  /* Bota y finta: borrado el bote, la finta está donde está la ficha. */
  const s = conAtaque();
  s.t._trazoHecho({ elemento: ficha(s.t, s.a1.id), accion: s.t._accionDe('bota'), variante: null, trazo: nuevoTrazo(ficha(s.t, s.a1.id), { x: 0.5, y: 0.3 }), tipo: 'run' });
  s.t.cerrar();
  elegir(s.t, s.a1.id, 'finta');
  s.t.cerrar();
  ok(s.t.borrarTramo(s.t.tramos[0].id));
  const g = s.t.tramos[0].trazo;
  eq([[g[0].x, g[0].y], [g[2].x, g[2].y], [ficha(s.t, s.a1.id).x, ficha(s.t, s.a1.id).y]], [[0.3, 0.5], [0.3, 0.5], [0.3, 0.5]]);
});

test('LA DEFENSA NO PERSIGUE UNA FINTA: su defensor acaba la fase donde estaba, y el guion la llama por su nombre', () => {
  const { t, a1, b1 } = conDefensa();
  const antes = { x: ficha(t, b1.id).x, y: ficha(t, b1.id).y };
  elegir(t, a1.id, 'finta');
  t.cerrar();
  t._cerrarFase();
  const ahora = t.fases[1].entrada[b1.id];
  ok(Math.abs(ahora.x - antes.x) < 1e-6 && Math.abs(ahora.y - antes.y) < 1e-6, `B1 sigue en su sitio: ${JSON.stringify([antes, ahora])}`);
  const anim = compilarMod.compilar(t.jugada());
  eq(anim.fases[0].movimientos.find((m) => !m.automatico).gesto, 'finta', 'lo compilado dice qué gesto es:');
});

test('EL GESTO SE COMPILA Y NO MUEVE A NADIE: el proyector lo enseña y la fase siguiente sale del mismo sitio', () => {
  const { t, a1 } = conAtaque();
  elegir(t, a1.id, 'pivota');
  t.cerrar();
  t._cerrarFase();
  eq(t.fases[1].entrada[a1.id], { x: 0.3, y: 0.5 }, 'tras el gesto sigue donde estaba:');
  const anim = compilarMod.compilar(t.jugada());
  const m = anim.fases[0].movimientos.find((x) => !x.automatico);
  eq([m.tipo_movimiento, m.path.length], ['gesto_en_sitio', 3]);
  eq(anim.fases[0].acciones, ['pivota']);
  eq(anim.warnings, []);
  ok(anim.fases[0].duracion_ms >= 300 && anim.fases[0].duracion_ms <= 1500, `dura lo que un gesto: ${anim.fases[0].duracion_ms} ms`);
});

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

test('AL QUE LE ROBAN EL BALÓN NO SE LE DA OTRO: ya tenía uno al empezar (§7.3)', () => {
  const { t, a1, b1 } = conDefensa();
  elegir(t, b1.id, 'roba');
  t._companeroElegido(ficha(t, a1.id), t.companero.activo);
  eq(t.porQueNoDarBalon(a1.id), 'A1 ya lleva uno');
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

test('TRAS CAMBIAR LOS PAPELES, CAMBIAR SI UN TIRO ENTRA DEJA EL BALÓN BAJO EL ARO NUEVO', () => {
  const { t, a1, b1 } = conDefensa();
  corta(t, a1.id, { x: 0.4, y: 0.35 });
  elegir(t, b1.id, 'roba');
  t._companeroElegido(ficha(t, a1.id), t.companero.activo);
  t._cerrarFase();
  eq(t.canastaEnCurso, 'sur', 'en la fase 2 se ataca al sur:');
  const aroSur = { x: 0.5, y: 1 - 0.1007 };
  t._trazoHecho({
    elemento: ficha(t, b1.id), accion: t._accionDe('tira'), variante: null,
    trazo: nuevoTrazo(ficha(t, b1.id), aroSur), tipo: 'pass', desenlace: 'falla',
  });
  const tiro = t.tramos.find((x) => x.desenlace);
  t.cambiarDesenlace(tiro.id, 'entra');
  const balon = t.fichas.elementos.find((e) => e.kind === 'balon');
  ok(balon.y > 0.8, `el balón cae bajo el aro sur, no bajo el norte: y=${balon.y.toFixed(3)}`);
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

test('NO SE PUEDE QUITAR A QUIEN SALE EN LO QUE HACE LA DEFENSA, y se dice', () => {
  const { t, a2, b1, avisos } = conDefensa();
  elegir(t, b1.id, 'ayuda');
  t._companeroElegido(ficha(t, a2.id), t.companero.activo);
  avisos.length = 0;
  t.fichas.seleccion = new Set([a2.id]);
  eq(t.quitarSeleccion(), false, 'al que se ayuda no se le quita:');
  ok(avisos.some(([tipo, , motivo]) => tipo === 'noPuede' && /defensa/.test(motivo || '')), JSON.stringify(avisos));
  ok(ficha(t, a2.id), 'y sigue en la pista');
  t.fichas.seleccion = new Set([b1.id]);
  eq(t.quitarSeleccion(), false, 'ni al que ayuda:');
  /* Quitada la acción, ya se puede. */
  elegir(t, b1.id, 'defiende');
  t._companeroElegido(ficha(t, a2.id), t.companero.activo);
  t.fichas.seleccion = new Set([b1.id]);
  eq(t.quitarSeleccion(), true, 'sin nada declarado, se va:');
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
