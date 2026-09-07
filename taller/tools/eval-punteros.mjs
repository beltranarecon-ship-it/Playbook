/* ============================================================
   eval-punteros.mjs — banco Node de la máquina de gestos de la
   Pizarra (taller/js/pizarra/gestos.js). Sin red, sin DOM, sin dedos.

     node taller/tools/eval-punteros.mjs

   Cada prueba de aquí es un caso que alguien encontraría en la tablet
   y que costaría media hora reproducir a mano. Son los diez «rompe»
   que salieron al enumerar los fallos de los gestos multitáctiles:
   el meñique que se apoya a mitad de un trazo, el dedo que se levanta
   de dos, el navegador que se lleva el gesto por el borde, el id de
   puntero que el sistema recicla.

   Si aparece uno nuevo en la pista, se añade aquí y deja de poder
   volver.
   ============================================================ */

import {
  nuevoEstado, reducir, umbralDe, radioAcierto, separacion, centroide,
  UMBRAL_PX, VENTANA_ARME, AGARRE_DEDO, SEP_MIN, SEP_ARRANQUE,
} from '../js/pizarra/gestos.js';
import { ZOOM_MIN, ZOOM_MAX } from '../js/canvas/encuadre.js';

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
const aprox = (real, esp, tol = 1e-6, msg = '') => {
  if (!(Math.abs(real - esp) <= tol)) throw new Error(`${msg} esperado≈${esp} real=${real}`);
};

/* Un pequeño teatro de dedos: se apuntan las órdenes que salen y se
   consultan por tipo, que es como se lee una prueba de esto. */
function mesa(escalaInicial = 1) {
  const e = nuevoEstado();
  const historial = [];
  /* La mesa hace de VISTA: guarda la escala que se va aplicando y se
     la devuelve a la máquina en el evento siguiente, igual que hace el
     adaptador de verdad leyendo `vista.enc.escala`. Sin esto, las
     pruebas del zoom mienten: al rebasar (un dedo que entra o sale)
     la máquina toma la escala de ahora como base, y si la mesa siempre
     dijera 1, la escala se caería al suelo en cada rebase. */
  let escalaActual = escalaInicial;
  const mandar = (ev) => {
    const { ordenes } = reducir(e, { escalaActual, t: 0, botones: 1, boton: 0, ...ev });
    for (const o of ordenes) if (o.tipo === 'pellizco') escalaActual = o.escala;
    historial.push(...ordenes);
    return ordenes;
  };
  return {
    estado: e,
    historial,
    escala: () => escalaActual,
    modo: () => e.modo,
    down: (id, x, y, o = {}) => mandar({ tipo: 'down', id, x, y, tipoPuntero: 'touch', ...o }),
    move: (id, x, y, o = {}) => mandar({ tipo: 'move', id, x, y, tipoPuntero: 'touch', ...o }),
    up: (id, o = {}) => mandar({ tipo: 'up', id, tipoPuntero: 'touch', ...o }),
    cancel: (id, o = {}) => mandar({ tipo: 'cancel', id, tipoPuntero: 'touch', ...o }),
    purga: () => mandar({ tipo: 'purga' }),
    tipos: (ords) => ords.map((o) => o.tipo),
  };
}
const soloTipos = (ords) => ords.map((o) => o.tipo);

/* ── 1. El gesto de un dedo ──────────────────────────────── */

test('un dedo que no llega al umbral es un TOQUE, no un arrastre', () => {
  const m = mesa();
  eq(soloTipos(m.down(1, 100, 100)), ['capturar', 'abrir']);
  eq(soloTipos(m.move(1, 105, 103)), []);        // 5,8 px: por debajo de 10
  eq(soloTipos(m.up(1)), ['tocar']);
  eq(m.modo(), 'libre');
});

test('pasado el umbral se promueve a arrastre y avisa en ese mismo evento', () => {
  const m = mesa();
  m.down(1, 100, 100);
  eq(soloTipos(m.move(1, 108, 0 + 100)), []);    // 8 px: aún no
  eq(soloTipos(m.move(1, 112, 100)), ['mover']); // 12 px: sí
  eq(m.modo(), 'uno');
  eq(soloTipos(m.up(1)), ['soltar']);            // ya no es un toque
});

test('el arrastre se ancla en el ORIGEN, no en el punto donde se promovió', () => {
  const m = mesa();
  m.down(1, 100, 100);
  const [orden] = m.move(1, 120, 100);
  eq(orden.p.px0, 100, 'origen:');
  eq(orden.p.dpx, 20, 'desplazamiento acumulado:');
});

test('el ratón y el lápiz se promueven antes que el dedo', () => {
  eq(umbralDe('touch'), 10);
  eq(umbralDe('mouse'), 4);
  eq(umbralDe('pen'), 4);
  eq(umbralDe('loquesea'), UMBRAL_PX.mouse);
  const m = mesa();
  m.down(1, 100, 100, { tipoPuntero: 'mouse' });
  eq(soloTipos(m.move(1, 106, 100, { tipoPuntero: 'mouse' })), ['mover']);
});

/* ── 2. El segundo dedo: pellizco o meñique ──────────────── */

test('CASO GRAVE · el segundo dedo revoca un gesto que aún no ha hecho nada', () => {
  const m = mesa();
  m.down(1, 100, 100);
  const o = m.down(2, 300, 100, { t: 500 });     // tarde, pero no importa: no había nada
  eq(soloTipos(o), ['abortar']);
  eq(m.modo(), 'ver');
});

test('CASO GRAVE · el segundo dedo revoca un arrastre recién empezado', () => {
  const m = mesa();
  m.down(1, 100, 100, { t: 0 });
  m.move(1, 130, 100, { t: 40 });                 // ya arrastra una ficha
  const o = m.down(2, 300, 100, { t: 90 });       // dentro de los 120 ms
  eq(soloTipos(o), ['abortar']);
  eq(m.modo(), 'ver');
});

test('CASO GRAVE · el meñique apoyado a mitad de un trazo NO lo roba', () => {
  const m = mesa();
  m.down(1, 100, 100, { t: 0 });
  m.move(1, 200, 200, { t: 300 });                 // lleva un rato dibujando
  const o = m.down(2, 400, 400, { t: 1500 });      // muy fuera de la ventana
  eq(soloTipos(o), []);                            // ni aborta ni pellizca
  eq(m.modo(), 'uno');
  eq(soloTipos(m.move(1, 260, 260, { t: 1600 })), ['mover']);  // el trazo sigue vivo
});

test('un dedo apoyado durante un arrastre con RATÓN no forma pareja', () => {
  const m = mesa();
  m.down(1, 100, 100, { tipoPuntero: 'mouse', t: 0 });
  m.move(1, 140, 100, { tipoPuntero: 'mouse', t: 20 });
  const o = m.down(2, 300, 100, { tipoPuntero: 'touch', t: 40 });
  eq(soloTipos(o), []);
  eq(m.modo(), 'uno');   // el ratón sigue mandando; medir entre dedo y cursor no tiene sentido
});

/* ── 3. El pellizco ─────────────────────────────────────── */

test('dos dedos desplazan desde el primer momento, sin esperar al zoom', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 200, 100);
  const [o] = m.move(1, 120, 100);
  eq(o.tipo, 'pellizco');
  eq(o.escala, 1, 'sin zoom todavía:');
  aprox(o.dx, 10, 1e-9, 'el centroide se ha movido la mitad:');
});

test('el zoom no se arma con un temblor pequeño', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 200, 100);       // separación 100
  const [o] = m.move(1, 90, 100);                  // separación 110: +10, menos de 16
  eq(o.escala, 1, 'no debería haberse armado:');
});

test('al armarse, el zoom arranca en 1,00 y no pega el salto de lo ya abierto', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 200, 100);
  const [o1] = m.move(1, 80, 100);                 // separación 120: +20, se arma
  eq(o1.escala, 1, 'arranca sin salto:');
  const [o2] = m.move(1, 40, 100);                 // separación 160 sobre base 120
  aprox(o2.escala, 160 / 120, 1e-9, 'a partir de ahí, proporcional:');
});

test('dos contactos pegados no pellizcan (son un dedo y su nudillo)', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 130, 100);       // 30 px: menos que SEP_MIN
  const [o] = m.move(1, 60, 100);                  // separación 70, +40
  eq(o.escala, 1, 'no debería armarse con la base tan corta:');
});

test('CASO GRAVE · el zoom se rebasa al llegar al tope, sin zona muerta', () => {
  const m = mesa(1);
  m.down(1, 200, 100); m.down(2, 300, 100);        // base 100
  m.move(1, 180, 100);                              // se arma (separación 120)
  const [o] = m.move(1, -1300, 100);                // separación enorme: pide más de ×4
  eq(o.escala, ZOOM_MAX, 'recortada al tope:');
  // y ahora, al cerrar un poco, tiene que bajar YA (no recorrer de vuelta lo que se pasó)
  const [o2] = m.move(1, -640, 100);
  ok(o2.escala < ZOOM_MAX, `esperaba bajar del tope, salió ${o2.escala}`);
});

test('el tope de alejar también se rebasa', () => {
  const m = mesa(1);
  m.down(1, 100, 100); m.down(2, 900, 100);        // base 800
  m.move(1, 116, 100);                              // se arma
  const [o] = m.move(1, 800, 100);                  // se juntan muchísimo
  eq(o.escala, ZOOM_MIN, 'recortada al tope de abajo:');
});

/* ── 4. Dedos que entran y salen ────────────────────────── */

test('CASO GRAVE · levantar un dedo de dos NO devuelve el control a un dedo', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 300, 100);
  m.up(1);
  eq(m.modo(), 'ver', 'sigue en modo ver:');
  const o = m.move(2, 500, 400);
  eq(soloTipos(o), ['pellizco'], 'el dedo que queda solo desplaza');
  eq(o[0].escala, 1, 'y sin zoom');
  // al levantar el último, se vuelve a poder empezar
  m.up(2);
  eq(m.modo(), 'libre');
});

test('CASO GRAVE · el dedo que sobrevive a un pellizco no dibuja ni selecciona', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 300, 100);
  m.up(1);
  const o = m.move(2, 900, 900);
  ok(!soloTipos(o).includes('abrir'), 'no puede abrir un gesto nuevo');
  ok(!soloTipos(o).includes('mover'), 'ni mover una ficha');
});

test('CASO GRAVE · un tercer dedo no descoloca la pareja ni hace saltar la escala', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 300, 100);
  m.move(1, 80, 100);                                // arma el zoom, base 220
  const antes = m.move(1, 60, 100)[0].escala;
  m.down(3, 700, 700);                               // el canto de la mano
  const despues = m.move(1, 60, 100)[0].escala;
  aprox(despues, antes, 1e-9, 'la escala no puede saltar al entrar un tercero:');
});

test('levantar uno de la pareja rebasa contra los que quedan', () => {
  const m = mesa();
  m.down(1, 100, 100); m.down(2, 300, 100); m.down(3, 500, 100);
  m.move(1, 80, 100);
  const o = m.up(1);                                  // se va uno de la pareja
  eq(soloTipos(o), [], 'levantar un dedo de ver no manda nada hacia arriba');
  const [p] = m.move(2, 310, 100);
  ok(Number.isFinite(p.escala) && p.escala > 0, `escala rara tras rebasar: ${p.escala}`);
});

/* ── 5. Lo que el navegador se lleva ────────────────────── */

test('CASO GRAVE · una cancelación aborta, no suelta', () => {
  const m = mesa();
  m.down(1, 100, 100);
  m.move(1, 200, 100);
  eq(soloTipos(m.cancel(1)), ['abortar']);
  eq(m.modo(), 'libre');
});

test('CASO GRAVE · tras una cancelación, el siguiente toque empieza de cero', () => {
  const m = mesa();
  m.down(1, 100, 100); m.move(1, 300, 300); m.cancel(1);
  const o = m.down(1, 50, 50);                        // MISMO id: el sistema lo recicla
  eq(soloTipos(o), ['capturar', 'abrir']);
  const [mv] = m.move(1, 70, 50);
  eq(mv.p.px0, 50, 'el origen es el nuevo, no el del gesto muerto:');
});

test('CASO GRAVE · un down con un id que ya estaba REEMPLAZA en vez de ignorarse', () => {
  const m = mesa();
  m.down(1, 100, 100);
  m.move(1, 200, 100);                                 // arrastrando
  const o = m.down(1, 400, 400);                       // llega otro down con el mismo id
  eq(soloTipos(o), ['abortar', 'capturar', 'abrir'], 'aborta el viejo y abre el nuevo:');
});

test('perder el foco con dedos apoyados aborta todo y deja la mesa limpia', () => {
  const m = mesa();
  m.down(1, 100, 100); m.move(1, 200, 200);
  m.down(2, 400, 400, { t: 900 });
  const o = m.purga();
  eq(soloTipos(o), ['abortar'], 'solo aborta el que tenía dueño:');
  eq(m.modo(), 'libre');
  eq(m.estado.punteros.size, 0);
});

test('el ratón que se suelta fuera de la ventana se da por levantado', () => {
  const m = mesa();
  m.down(1, 100, 100, { tipoPuntero: 'mouse' });
  m.move(1, 200, 100, { tipoPuntero: 'mouse' });
  const o = m.move(1, 260, 100, { tipoPuntero: 'mouse', botones: 0 });
  eq(soloTipos(o), ['soltar']);
  eq(m.modo(), 'libre');
});

test('un dedo apoyado y quieto NO se da por levantado (no hay barrido por tiempo)', () => {
  const m = mesa();
  m.down(1, 100, 100, { t: 0 });
  m.down(2, 300, 100, { t: 50 });
  const o = m.move(1, 100, 100, { t: 30000 });        // treinta segundos después
  eq(soloTipos(o), ['pellizco'], 'el pellizco sigue vivo:');
});

test('un move de un puntero que nunca bajó se ignora (el lápiz en vuelo)', () => {
  const m = mesa();
  eq(soloTipos(m.move(7, 100, 100, { tipoPuntero: 'pen' })), []);
  eq(m.modo(), 'libre');
});

/* ── 6. El ratón, que no puede cambiar ──────────────────── */

test('el botón central desplaza el encuadre, como hasta hoy', () => {
  const m = mesa();
  eq(soloTipos(m.down(1, 100, 100, { tipoPuntero: 'mouse', boton: 1 })), ['capturar', 'clase']);
  eq(m.modo(), 'mano');
  const [o] = m.move(1, 130, 120, { tipoPuntero: 'mouse' });
  eq([o.tipo, o.dx, o.dy], ['desplazar', 30, 20]);
  eq(soloTipos(m.up(1, { tipoPuntero: 'mouse' })), ['clase']);
  eq(m.modo(), 'libre');
});

test('el izquierdo con la barra espaciadora también, y el dedo no', () => {
  const m = mesa();
  m.down(1, 100, 100, { tipoPuntero: 'mouse', boton: 0, espacio: true });
  eq(m.modo(), 'mano');
  const m2 = mesa();
  m2.down(1, 100, 100, { tipoPuntero: 'touch', boton: 0, espacio: true });
  eq(m2.modo(), 'arme', 'con el dedo, la barra espaciadora no cuenta:');
});

test('CASO GRAVE · mientras se arrastra con el ratón, otro puntero no mueve el encuadre', () => {
  const m = mesa();
  m.down(1, 100, 100, { tipoPuntero: 'mouse', boton: 1 });
  const o = m.move(9, 900, 900, { tipoPuntero: 'touch' });
  eq(soloTipos(o), [], 'un id que no es el del arrastre no puede desplazar:');
});

test('el encuadre se queda donde esté aunque se cancele el arrastre', () => {
  const m = mesa();
  m.down(1, 100, 100, { tipoPuntero: 'mouse', boton: 1 });
  m.move(1, 300, 300, { tipoPuntero: 'mouse' });
  const o = m.cancel(1, { tipoPuntero: 'mouse' });
  eq(soloTipos(o), ['clase'], 'ni abortar ni deshacer: la vista se queda');
});

/* ── 7. El radio de acierto ─────────────────────────────── */

test('con el dedo el agarre es un SUELO de 22 px, con ratón no se aplica', () => {
  eq(radioAcierto(8, 'touch'), AGARRE_DEDO, 'ficha pequeña con el dedo:');
  eq(radioAcierto(63, 'touch'), 63, 'ficha grande con el dedo: manda la real');
  eq(radioAcierto(8, 'mouse'), 8, 'con ratón vale el radio de verdad:');
  eq(radioAcierto(8, 'pen'), 8);
});

/* ── 8. Las cuentas de apoyo ────────────────────────────── */

test('separación y centroide', () => {
  eq(separacion({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  eq(centroide([{ x: 0, y: 0 }, { x: 10, y: 20 }]), { x: 5, y: 10 });
  eq(centroide([]), { x: 0, y: 0 }, 'sin puntos no revienta ni da NaN:');
});

test('los umbrales son los acordados y están en píxeles de pantalla', () => {
  eq(UMBRAL_PX, { touch: 10, pen: 4, mouse: 4 });
  eq(VENTANA_ARME, 120);
  eq(AGARRE_DEDO, 22);
  eq(SEP_MIN, 40);
  eq(SEP_ARRANQUE, 16);
  ok(SEP_ARRANQUE > UMBRAL_PX.touch, 'la separación es ruido de dos dedos: tiene que pedir más que uno');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
