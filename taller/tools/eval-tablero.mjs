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
  const t = new Tablero(lienzoFalso(pista), { canasta: 'norte' });
  const p = Object.create(Pizarra.prototype);
  const avisos = [];
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

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
