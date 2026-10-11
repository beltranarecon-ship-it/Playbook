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

/* El Tablero en Node, con su DOM de mentira: taller/tools/tablero-node.mjs. */
const { tableroDe, dibujar } = await import('./tablero-node.mjs');
const { compilar } = await import('../js/pizarra/motor/compilar.js');
const { normalizarJugada } = await import('../js/pizarra/motor/jugada.js');
const { AnimationEngine } = await import('../js/canvas/engine.js');
const { todosLosCaminos } = await import('../js/pizarra/ramas.js');
const { JUGADAS_DE_REFERENCIA, sitios, jugador, balon, cono, ficha, va, pasa } = await import('../../dev/jugadas-referencia.js');

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

test('«TOCA EL CONO» Y DESPUÉS «CORTA» EN V, con los ayudantes de dev/: una fase, encadenada, sin avisos', () => {
  let a1, c;
  const { avisos, jugada } = dibujar({ pista: 'entera', montar(t) {
    const s = sitios('entera');
    a1 = jugador(t, 'A', s.base);
    const a2 = jugador(t, 'A', s.alero_der);
    balon(t, a1);
    c = cono(t, { x: 0.32, y: 0.16 });
    pasa(t, a1, a2, 'pecho');
    const sitio = ficha(t, c);
    va(t, a1, 'toca', { x: sitio.x, y: sitio.y });
    va(t, a1, 'corta', s.alero_izq, 'en_v', 'sprint');
  } });
  eq(avisos, [], 'nada se rechaza:');
  eq(jugada.fases.length, 1, 'una sola fase:');
  const [, toca, sale] = jugada.fases[0].tramos;
  eq([toca.accion, sale.accion, sale.variante, sale.ritmo], ['toca', 'corta', 'en_v', 'sprint']);
  eq([sale.trazo[0].x, sale.trazo[0].y], [toca.trazo.at(-1).x, toca.trazo.at(-1).y], 'el corte empieza donde acaba el toque (§4.5):');
  eq([toca.sorteando, sale.sorteando].map((x) => (x || []).length), [0, 0], 'y el cono no se rodea:');
  const anim = compilar(jugada);
  eq(anim.warnings, [], 'compila sin avisos:');
  const suyos = anim.fases[0].movimientos.filter((m) => m.elemento_id === 'A1');
  eq(suyos.length, 2, 'A1 se mueve dos veces:');
  eq(suyos[1].inicio_ms, suyos[0].inicio_ms + suyos[0].duracion_ms, 'llega al cono y sale cortando, sin hueco:');
  eq(suyos[0].path.at(-1), toca.trazo.at(-1), 'llega al cono:');
  eq(anim.conos.find((x) => x.id === c).funcion, 'decorativo', 'un cono que se toca no es de rodear:');
  const n = /(\d+)$/.exec(c)[1];
  eq(anim.fases[0].frase, `A1 pasa de pecho a A2, toca el cono ${n} y corta en V al alero izquierdo.`);
  eq(normalizarJugada(jugada).avisos, [], 'y se reabre sin avisos:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
