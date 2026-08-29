/* ============================================================
   eval-gestos.mjs — banco de la familia `gesto` del motor.

     node taller/tools/eval-gestos.mjs

   ── DE DÓNDE SALE ESTO ──────────────────────────────────────
   `acciones.js` declaraba CINCO familias con todo su contrato desde el
   Tramo 2.5 —nombre, qué resuelven, ejemplos y parámetros con tipos y
   valores por defecto— y el catálogo solo tenía acciones en TRES. El
   compilador repartía en tres ramas y su propia cabecera decía que
   resolvía cinco.

   O sea: una finta, un pivote o una protección de balón se podían
   escribir y se compilaban a nada. La fase salía vacía, el jugador se
   quedaba quieto y no había ni un aviso. Ocho de los diecinueve
   ejercicios que el entrenador dibujó en la app son justo eso, y casi
   todos están guardados sin una sola fase.

   ── LO QUE VIGILA ───────────────────────────────────────────
     1. Que un gesto ACABE DONDE EMPEZÓ. Es toda su definición: si
        moviera al jugador, la fase siguiente saldría de un sitio
        equivocado y el error se arrastraría hasta el final del
        ejercicio sin que nada lo dijera.
     2. Que se VEA. La ficha del jugador se dibuja de 1,30 m de
        diámetro y un amago de verdad son 0,80: la primera versión
        compilaba bien, pasaba las pruebas y dibujaba el trazo entero
        DEBAJO de la ficha. En pantalla no se veía nada.
     3. Que la amplitud esté en metros de verdad, igual en las cuatro
        pistas, como todo lo demás desde el Tramo 2.4.
     4. Que una fase con alguien corriendo dure lo que tarda el que
        corre, no lo que dura la finta.
   ============================================================ */

import { compilarAnimacion } from '../js/ia/compilador.js';
import { CATALOGO_SISTEMA, FAMILIA_KEYS } from '../js/ia/acciones.js';
import { MOV_TO_ARROW } from '../js/canvas/arrows.js';
import { TAMANOS, PISTAS_M } from '../js/canvas/medidas.js';
import { metrosEntre } from '../js/canvas/escala.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const aprox = (real, esp, tol, msg = '') => {
  if (!(Math.abs(real - esp) <= tol)) throw new Error(`${msg} esperado≈${esp} real=${real} (tol ${tol})`);
};

const TODAS = Object.keys(PISTAS_M);
const GESTOS = CATALOGO_SISTEMA.filter((a) => a.familia === 'gesto');
const RADIO = TAMANOS.jugador / 2;                    // 0,65 m

const unJugador = (x = 0.5, y = 0.5) => [{ kind: 'jugador', equipo: 'A', label: '1', x, y, dorsal: 4 }];
const compilar = (slug, pista = 'media', args = {}, el = unJugador()) =>
  compilarAnimacion(
    { canasta: 'norte', fases: [{ eventos: [{ jugador: 'A1', accion: slug, args }] }] }, el, pista);

console.log('\n· la familia existe de verdad');

test('el catálogo tiene acciones de gesto', () => {
  ok(GESTOS.length >= 4, `solo hay ${GESTOS.length}; la familia se quedó declarada y vacía`);
});

test('todas se compilan a un movimiento, ninguna a nada', () => {
  for (const a of GESTOS) {
    const r = compilar(a.slug);
    const m = r.fases[0].movimientos;
    ok(m && m.length === 1, `${a.slug}: la fase sale con ${m ? m.length : 0} movimientos`);
    ok(m[0].elemento_id === 'A1', `${a.slug}: mueve a otro`);
  }
});

test('su símbolo tiene flecha asignada', () => {
  /* Sin entrada en el mapa cae en 'cut' —discontinua, de corte— y un
     gesto se dibujaría como un desplazamiento sin desplazamiento. */
  for (const a of GESTOS) {
    ok(MOV_TO_ARROW[a.simbolo], `${a.slug}: el símbolo "${a.simbolo}" no está en MOV_TO_ARROW`);
  }
});

console.log('\n· acaba donde empezó');

test('el primer y el último nodo son el mismo punto', () => {
  for (const a of GESTOS) {
    const p = compilar(a.slug).fases[0].movimientos[0].path;
    aprox(p[0].x, p[p.length - 1].x, 1e-9, `${a.slug} x:`);
    aprox(p[0].y, p[p.length - 1].y, 1e-9, `${a.slug} y:`);
  }
});

test('la fase siguiente sale del sitio de antes, no del amago', () => {
  /* El fallo que esto evita no se ve al mirar la fase del gesto: se ve
     tres fases después, con el jugador desplazado y sin motivo. */
  for (const a of GESTOS) {
    const r = compilarAnimacion({ canasta: 'norte', fases: [
      { eventos: [{ jugador: 'A1', accion: a.slug, args: {} }] },
      { eventos: [{ jugador: 'A1', accion: 'corta', args: { destino: 'aro' } }] },
    ] }, unJugador(0.42, 0.58), 'media');
    const sale = r.fases[1].movimientos[0].path[0];
    aprox(sale.x, 0.42, 1e-9, `${a.slug}: la fase 2 empieza desplazada en x`);
    aprox(sale.y, 0.58, 1e-9, `${a.slug}: la fase 2 empieza desplazada en y`);
  }
});

console.log('\n· se ve');

test('ningún nodo del trazo queda tapado por la ficha del jugador', () => {
  /* La comprobación que faltaba la primera vez. La ficha mide 1,30 m de
     diámetro —no es su tamaño real, es el que se lee en un proyector— y
     un amago de 0,80 m cabía entero debajo. */
  for (const pista of TODAS) {
    for (const a of GESTOS) {
      const p = compilar(a.slug, pista).fases[0].movimientos[0].path;
      const centro = [p[0].x, p[0].y];
      const dentro = p.slice(1, -1)
        .map((n) => metrosEntre(pista, centro, [n.x, n.y]))
        .filter((d) => d <= RADIO);
      ok(dentro.length === 0,
        `${pista}/${a.slug}: ${dentro.length} nodo(s) a ${dentro.map((d) => d.toFixed(2))} m, dentro del radio ${RADIO}`);
    }
  }
});

test('el trazo tiene al menos tres nodos: si no, no hay ida y vuelta', () => {
  for (const a of GESTOS) {
    const p = compilar(a.slug).fases[0].movimientos[0].path;
    ok(p.length >= 3, `${a.slug}: ${p.length} nodos`);
  }
});

console.log('\n· la amplitud está en metros');

test('el mismo gesto mide lo mismo en las cuatro pistas', () => {
  /* Es la promesa del Tramo 2.4 y la que se rompía cuando esto se medía
     en unidades de lienzo: el mismo número daba amagos de tamaños
     distintos según la pista y según el eje. */
  for (const a of GESTOS) {
    const medidas = TODAS.map((pista) => {
      const p = compilar(a.slug, pista).fases[0].movimientos[0].path;
      return metrosEntre(pista, [p[0].x, p[0].y], [p[2].x, p[2].y]);
    });
    const min = Math.min(...medidas), max = Math.max(...medidas);
    ok(max - min < 5e-3, `${a.slug}: entre ${min.toFixed(3)} y ${max.toFixed(3)} m según la pista`);
  }
});

console.log('\n· hacia dónde amaga');

test('sin decirle nada, amaga hacia la canasta', () => {
  /* La referencia por defecto de todo el compilador, y lo que hace un
     jugador de verdad: se finta hacia donde se quiere ir. */
  const r = compilar('finta', 'media', {}, unJugador(0.6, 0.5));
  const p = r.fases[0].movimientos[0].path;
  // en la media la canasta está a la IZQUIERDA: la punta va hacia x menor
  ok(p[2].x < p[0].x, `la punta va a x=${p[2].x} desde ${p[0].x}: no apunta al aro`);
});

test('con `hacia`, amaga hacia ahí', () => {
  const r = compilar('finta', 'media', { hacia: { x: 0.9, y: 0.5 } }, unJugador(0.5, 0.5));
  const p = r.fases[0].movimientos[0].path;
  ok(p[2].x > p[0].x, `la punta va a x=${p[2].x} desde ${p[0].x}: ignora el destino`);
});

console.log('\n· cuánto dura');

test('una fase de solo gestos es corta', () => {
  const r = compilar('finta');
  ok(r.fases[0].duracion_ms <= 900, `dura ${r.fases[0].duracion_ms} ms: se lee como cámara lenta`);
});

test('si alguien corre, manda el que corre', () => {
  /* Una fase donde uno finta y otro cruza la pista entera dura lo que
     tarda el que corre. Si mandara la finta, el que corre llegaría
     teletransportado. */
  const dos = [...unJugador(0.5, 0.5), { kind: 'jugador', equipo: 'A', label: '2', x: 0.85, y: 0.8, dorsal: 7 }];
  const r = compilarAnimacion({ canasta: 'norte', fases: [{ eventos: [
    { jugador: 'A1', accion: 'finta', args: {} },
    { jugador: 'A2', accion: 'corta', args: { destino: 'aro' } },
  ] }] }, dos, 'media');
  ok(r.fases[0].duracion_ms >= 1200, `dura ${r.fases[0].duracion_ms} ms`);
});

console.log('\n· lo que TODAVÍA falta, dicho a las claras');

test('simulacion sigue siendo una familia sin acciones', () => {
  /* Esta prueba no protege un acierto: DEJA CONSTANCIA de un hueco. La
     familia `simulacion` (1vs1, 2vs1, 2vs2, 3vs2 con el desenlace
     declarado) está diseñada con sus parámetros y no tiene ni una
     acción ni rama en el compilador, igual que estaba `gesto`.

     El día que se implemente, esta prueba se pondrá roja y habrá que
     cambiarla. Eso es lo que se busca: que el hueco no se olvide por no
     estar escrito en ningún sitio. */
  ok(FAMILIA_KEYS.includes('simulacion'), 'la familia ha desaparecido del contrato');
  const n = CATALOGO_SISTEMA.filter((a) => a.familia === 'simulacion').length;
  ok(n === 0,
    `¡Bien! La familia «simulacion» ya tiene ${n} acción(es). Comprueba que el `
    + 'compilador las resuelva y actualiza esta prueba: ya no es un hueco.');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
