/* ============================================================
   eval-referencia.mjs — las doce jugadas de referencia
   (dev/jugadas-referencia.js, ESPEC-PIZARRA-v3 §13), en Node.

     node taller/tools/eval-referencia.mjs

   Cada una se dibuja sobre un Tablero de verdad (con un DOM de mentira,
   como en eval-tablero.mjs) y se comprueba la cadena entera: que se
   dibuja, que se compila SIN AVISOS, que cada fase dibujada tiene su
   frase, que el motor la carga, y que guardada y vuelta a abrir da la
   misma jugada. Lo que NO prueba es cómo se ve: para eso está
   dev/jugadas.html.
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

const { Tablero } = await import('../js/pizarra/tablero.js');
const { compilar } = await import('../js/pizarra/motor/compilar.js');
const { normalizarJugada } = await import('../js/pizarra/motor/jugada.js');
const { AnimationEngine } = await import('../js/canvas/engine.js');
const { reiniciarIds } = await import('../js/pizarra/elementos.js');
const { todosLosCaminos } = await import('../js/pizarra/ramas.js');
const { JUGADAS_DE_REFERENCIA } = await import('../../dev/jugadas-referencia.js');

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

function dibujar(j) {
  reiniciarIds();
  const { t, avisos } = tableroDe(j.pista);
  j.montar(t);
  t.cerrar();
  return { t, avisos, jugada: JSON.parse(JSON.stringify(t.jugada())) };
}

test('SON DOCE, cada una con su nombre', () => {
  eq(JUGADAS_DE_REFERENCIA.length, 12);
  eq(new Set(JUGADAS_DE_REFERENCIA.map((j) => j.nombre)).size, 12);
});

for (const j of JUGADAS_DE_REFERENCIA) {
  test(`${j.nombre}: se dibuja, se compila sin avisos, se cuenta y se reabre igual`, () => {
    const { t, avisos, jugada } = dibujar(j);
    eq(avisos, [], 'nada de lo que se pide dibujar se rechaza:');
    const dibujadas = jugada.fases.filter((f) => f.tramos.length);
    ok(dibujadas.length >= 1, 'tiene algo dibujado');
    const anim = compilar(jugada);
    eq(anim.warnings, [], 'compila sin avisos:');
    const compiladas = [...anim.fases, ...(anim.fases_rama || [])];
    ok(compiladas.length >= dibujadas.length, `todas las fases dibujadas salen: ${compiladas.length} de ${dibujadas.length}`);
    ok(compiladas.every((f) => f.duracion_ms > 0 && typeof f.frase === 'string' && f.frase.length > 3), `cada una dura algo y tiene su frase: ${compiladas.map((f) => f.frase).join(' | ')}`);
    /* El motor la carga y la recorre entera sin reventar. */
    const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
    for (let k = 0; k < motor.phaseCount; k++) { motor.k = k; motor.phaseElapsed = motor.fases[k].duracion_ms; motor._computePositions(); }
    /* Guardada y vuelta a abrir: la misma jugada, sin avisos. */
    const r = normalizarJugada(jugada);
    eq(r.avisos, [], 'se reabre sin avisos:');
    const otro = tableroDe(j.pista).t;
    ok(otro.cargar(jugada).ok, 'se carga');
    eq(JSON.parse(JSON.stringify(otro.jugada())), jugada, 'la misma, punto por punto:');
    eq(compilar(otro.jugada()).fases.map((f) => f.frase), anim.fases.map((f) => f.frase), 'y cuenta lo mismo:');
    ok(t, 'tablero');
  });
}

test('LA DE LAS RAMAS tiene su cruce, y la del robo cambia quién ataca', () => {
  const ramas = dibujar(JUGADAS_DE_REFERENCIA[9]).jugada;
  eq(todosLosCaminos(ramas.fases).length, 2);
  const anim = compilar(ramas);
  eq(anim.ramas.map((r) => r.opciones.map((o) => o.nombre)), [['si le dejan', 'si le niegan']]);
  const robo = compilar(dibujar(JUGADAS_DE_REFERENCIA[8]).jugada);
  ok(robo.fases[0].pases.some((p) => p.interceptado), 'el pase se intercepta');
  ok(robo.fases[1].defensores.length === 2, `y en la fase siguiente defienden los que atacaban: ${robo.fases[1].defensores}`);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
