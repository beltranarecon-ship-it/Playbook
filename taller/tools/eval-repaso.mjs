/* ============================================================
   eval-repaso.mjs — banco Node del repaso del tramo
   (taller/js/pizarra/repaso.js). Sin red, sin DOM.

     node taller/tools/eval-repaso.mjs

   La clase necesita un lienzo y un reloj, y se prueba en el navegador.
   Aquí va lo único que se puede equivocar en silencio: CUÁNTO DURA.

   Y lo que más importa no es el número sino que salga de los mismos
   tiempos que la animación de verdad. Si el repaso contara por su
   cuenta, el entrenador vería un ritmo al dibujar y otro al
   reproducir, y no habría manera de saber cuál de los dos miente.
   ============================================================ */

import { VELOCIDAD_REPASO, MINIMO_S, duracionRepaso, Repaso } from '../js/pizarra/repaso.js';
import { nuevoTrazo, desdePuntos, duracionDe, longitudMetros, RITMOS } from '../js/pizarra/trazo.js';

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
const aprox = (real, esp, tol = 1e-9, msg = '') => {
  if (!(Math.abs(real - esp) <= tol)) throw new Error(`${msg} esperado≈${esp} real=${real}`);
};

const largo = nuevoTrazo({ x: 0.15, y: 0.10 }, { x: 0.85, y: 0.90 });
const corto = nuevoTrazo({ x: 0.50, y: 0.50 }, { x: 0.505, y: 0.502 });

/* ── 1. Sale de los tiempos de siempre ───────────────────── */

test('LA DURACIÓN ES LA DE LA ANIMACIÓN DIVIDIDA POR LA VELOCIDAD', () => {
  /* Lo único que no puede desviarse: si el repaso contara por su
     cuenta, se vería un ritmo al dibujar y otro al reproducir. */
  const real = duracionDe(longitudMetros(largo, 'entera'), 'normal');
  aprox(duracionRepaso(largo, 'entera', 'normal'), real / VELOCIDAD_REPASO, 1e-12);
});

test('se repasa MÁS RÁPIDO que de verdad: es una confirmación', () => {
  const real = duracionDe(longitudMetros(largo, 'entera'), 'normal');
  ok(duracionRepaso(largo, 'entera', 'normal') < real, 'el repaso tiene que ser más corto');
  eq(VELOCIDAD_REPASO, 1.5, 'la velocidad que dice el §5.4:');
});

test('cada ritmo se repasa a lo suyo, y en el orden que toca', () => {
  const t = (r) => duracionRepaso(largo, 'entera', r);
  ok(t('sprint') < t('normal'), 'esprintando se tarda menos que corriendo');
  ok(t('normal') < t('lateral'), 'corriendo menos que de lado');
  ok(t('lateral') < t('andando'), 'de lado menos que andando');
  ok(t('pase') < t('sprint'), 'y el balón llega antes que nadie');
});

test('todo ritmo de RITMOS da un repaso que se puede reproducir', () => {
  for (const r of [...Object.keys(RITMOS), 'pase']) {
    const s = duracionRepaso(largo, 'entera', r);
    ok(Number.isFinite(s) && s > 0, `el ritmo "${r}" da ${s}`);
  }
});

/* ── 2. El suelo ─────────────────────────────────────────── */

test('un tramo diminuto NO se repasa en un parpadeo', () => {
  /* Medio metro a velocidad normal y por 1,5 son ochenta milisegundos:
     no se vería moverse nada, solo un salto. */
  const s = duracionRepaso(corto, 'entera', 'normal');
  eq(s, MINIMO_S, 'tiene que caer en el suelo:');
  ok(MINIMO_S > 0.15 && MINIMO_S < 0.6, `${MINIMO_S} s no es un golpe de vista`);
});

test('el suelo no alarga lo que ya dura bastante', () => {
  ok(duracionRepaso(largo, 'entera', 'normal') > MINIMO_S,
    'un trazo de media pista no puede quedarse en el mínimo');
});

/* ── 3. La pista importa ─────────────────────────────────── */

test('el mismo trazo normalizado dura MENOS en media pista', () => {
  // media pista mide la mitad de largo, así que el mismo 0→1 son menos metros
  const entera = duracionRepaso(largo, 'entera', 'normal');
  const media = duracionRepaso(largo, 'media', 'normal');
  ok(media < entera, `media=${media} tendría que ser menor que entera=${entera}`);
});

/* ── 4. Entradas imposibles ──────────────────────────────── */

test('un trazo de un nodo o vacío no da NaN', () => {
  for (const t of [[], [{ x: 0.5, y: 0.5 }]]) {
    const s = duracionRepaso(t, 'entera', 'normal');
    ok(Number.isFinite(s) && s > 0, `${JSON.stringify(t)} da ${s}`);
  }
});

test('un ritmo que no existe se repasa a lo normal', () => {
  eq(duracionRepaso(largo, 'entera', 'volando'), duracionRepaso(largo, 'entera', 'normal'));
});

test('un trazo con vueltas dura más que la recta entre sus extremos', () => {
  const rodeo = desdePuntos([{ x: 0.15, y: 0.10 }, { x: 0.85, y: 0.20 }, { x: 0.15, y: 0.80 }, { x: 0.85, y: 0.90 }]);
  ok(duracionRepaso(rodeo, 'entera', 'normal') > duracionRepaso(largo, 'entera', 'normal'),
    'se tarda lo que se anda, no lo que se avanza');
});

/* ── El bucle: por fotograma Y por reloj, pero uno solo ── */

/* Un planificador de mentira. El repaso late por `requestAnimationFrame`
   y por `setTimeout`, porque hay entornos donde el primero no dispara
   nunca. Eso obliga a que el que llegue CANCELE al otro: si no, los dos
   se ejecutan y cada uno vuelve a programar los dos. Aquí se puede
   comprobar de verdad, disparando siempre los dos a propósito, que es
   el peor caso posible. */
function bancoDePruebas() {
  const rafs = new Map(); const relojes = new Map();
  let n = 0; let ejecutados = 0;
  const antes = {
    raf: globalThis.requestAnimationFrame, car: globalThis.cancelAnimationFrame,
    st: globalThis.setTimeout, ct: globalThis.clearTimeout,
  };
  globalThis.requestAnimationFrame = (f) => { const id = ++n; rafs.set(id, f); return id; };
  globalThis.cancelAnimationFrame = (id) => { rafs.delete(id); };
  globalThis.setTimeout = (f, ms) => { const id = ++n; relojes.set(id, f); return id; };
  globalThis.clearTimeout = (id) => { relojes.delete(id); };
  return {
    pendientes: () => rafs.size + relojes.size,
    ejecutados: () => ejecutados,
    /* Dispara TODO lo que hubiera pendiente, en el orden en que se pidió.
       Lo que uno cancele al ejecutarse desaparece antes de que le toque. */
    ronda() {
      const cola = [...rafs.entries(), ...relojes.entries()].sort((a, b) => a[0] - b[0]);
      for (const [id, f] of cola) {
        if (!rafs.has(id) && !relojes.has(id)) continue;   // lo canceló otro
        rafs.delete(id); relojes.delete(id);
        ejecutados++;
        f(0);
      }
    },
    soltar() { Object.assign(globalThis, { requestAnimationFrame: antes.raf, cancelAnimationFrame: antes.car, setTimeout: antes.st, clearTimeout: antes.ct }); },
  };
}

const lienzoDeMentira = () => ({ vista: { pistaKey: 'entera' }, pintar() {} });

test('EL BUCLE NO SE DUPLICA aunque disparen el fotograma Y el reloj', () => {
  /* El fallo que esto vigila: poniendo solo las referencias a null sin
     cancelar al hermano, cada latido programaba dos y los dos se
     ejecutaban, así que en la ronda k había 2^k callbacks vivos. En un
     repaso de un segundo eso son miles de temporizadores. */
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    r.reproducir({ elemento: { id: 'j1' }, trazo: largo, ritmo: 'normal' });
    const vistos = [];
    for (let i = 0; i < 12; i++) { vistos.push(banco.pendientes()); banco.ronda(); }
    const tope = Math.max(...vistos);
    ok(tope <= 2, `nunca puede haber más de dos callbacks vivos (uno por vía); hubo ${tope}: ${vistos}`);
    ok(banco.ejecutados() <= 24, `doce rondas no pueden dar ${banco.ejecutados()} ejecuciones: se está duplicando`);
    r.destroy();
  } finally { banco.soltar(); }
});

test('parar() deja el planificador limpio', () => {
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    r.reproducir({ elemento: { id: 'j1' }, trazo: largo, ritmo: 'normal' });
    ok(banco.pendientes() > 0, 'reproducir tiene que dejar algo programado');
    r.parar();
    eq(banco.pendientes(), 0, 'parar no deja nada colgando:');
    eq(r.corriendo, false);
    r.destroy();
  } finally { banco.soltar(); }
});

test('reproducir dos veces seguidas CORTA el anterior, no lo encadena', () => {
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    r.reproducir({ elemento: { id: 'j1' }, trazo: largo, ritmo: 'normal' });
    r.reproducir({ elemento: { id: 'j2' }, trazo: largo, ritmo: 'normal' });
    ok(banco.pendientes() <= 2, `dos repasos seguidos dejan ${banco.pendientes()} callbacks vivos`);
    ok(r.activo.porElemento.has('j2'), 'manda el último:');
    ok(!r.activo.porElemento.has('j1'), 'y el anterior ya no está:');
    r.destroy();
  } finally { banco.soltar(); }
});

test('el gancho `donde` solo habla de quien viaja', () => {
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    r.reproducir({ elemento: { id: 'j1' }, trazo: largo, ritmo: 'normal' });
    ok(r.donde({ id: 'j1', kind: 'jugador' }), 'del que corre sí dice dónde');
    eq(r.donde({ id: 'j9', kind: 'jugador' }), null, 'de los demás no:');
    ok(r.donde({ id: 'b1', kind: 'balon', portador_id: 'j1' }), 'el balón que lleva va con él');
    eq(r.donde({ id: 'b2', kind: 'balon', portador_id: 'j9' }), null, 'el de otro no:');
    eq(r.donde(null), null, 'y nada no rompe');
    r.parar();
    eq(r.donde({ id: 'j1', kind: 'jugador' }), null, 'parado, cada uno donde dice el modelo:');
    r.destroy();
  } finally { banco.soltar(); }
});

/* ── Una fase entera: varios carriles a la vez (§6.1) ──── */

test('LOS CARRILES VAN EN PARALELO, cada uno arrancando cuando le toca', () => {
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    const a = nuevoTrazo({ x: 0.2, y: 0.8 }, { x: 0.2, y: 0.2 });
    const b = nuevoTrazo({ x: 0.8, y: 0.8 }, { x: 0.8, y: 0.2 });
    r.reproducirFase({ tramos: [
      { corre_id: 'A1', trazo: a, inicio_ms: 0, duracion_ms: 1000 },
      { corre_id: 'A2', trazo: b, inicio_ms: 500, duracion_ms: 1000 },
    ] });
    /* En el instante cero: A1 ya en su salida y A2 también en la suya,
       porque todavía no le toca. Lo importante es que A2 NO esté en su
       destino, que es donde el modelo le tiene puesto. */
    const p1 = r.posicion('A1'), p2 = r.posicion('A2');
    ok(p1 && p2, 'los dos tienen sitio desde el principio');
    aprox(p2.y, 0.8, 1e-6, 'A2 espera EN SU ARRANQUE, no en su destino:');
    eq(r.posicion('A9'), null, 'quien no sale en la fase no se pinta en otro sitio:');
    /* Y a mitad: A1 ya casi ha llegado y A2 acaba de arrancar. */
    r.activo.t0 -= 750;
    const q1 = r.posicion('A1'), q2 = r.posicion('A2');
    ok(q1.y < 0.4, `A1 tendría que ir por el final de su trazo: ${q1.y}`);
    ok(q2.y > 0.6 && q2.y < 0.8, `y A2 recén salido: ${q2.y}`);
    r.destroy();
  } finally { banco.soltar(); }
});

test('entre dos tramos suyos, la ficha se queda donde acabó el primero', () => {
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    r.reproducirFase({ tramos: [
      { corre_id: 'A1', trazo: nuevoTrazo({ x: 0.2, y: 0.8 }, { x: 0.5, y: 0.5 }), inicio_ms: 0, duracion_ms: 1 },
      { corre_id: 'A1', trazo: nuevoTrazo({ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.1 }), inicio_ms: 100000, duracion_ms: 1000 },
    ] });
    /* Se ADELANTA EL RELOJ cinco segundos en vez de esperarlos: así la
       prueba no depende del reloj de pared, que en un banco es la
       diferencia entre verde siempre y verde casi siempre. */
    r.activo.t0 -= 5000;
    /* El primero ya ha acabado y el segundo tarda un siglo en empezar:
       tiene que estar plantada en el final del primero, y no de vuelta
       en su salida ni ya en el destino final. */
    const p = r.posicion('A1');
    aprox(p.x, 0.5, 1e-6, 'esperando donde acabó el primero:');
    aprox(p.y, 0.5, 1e-6);
    r.destroy();
  } finally { banco.soltar(); }
});

test('la fase dura hasta que acaba el carril más largo', () => {
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    r.reproducirFase({ tramos: [
      { corre_id: 'A1', trazo: largo, inicio_ms: 0, duracion_ms: 1000 },
      { corre_id: 'A2', trazo: largo, inicio_ms: 2000, duracion_ms: 1500 },
    ] });
    eq(r.activo.dur, 3500, 'el que arranca tarde y dura mucho manda:');
    r.destroy();
  } finally { banco.soltar(); }
});

test('un tramo sin longitud no arrastra a los demás: se descarta él solo', () => {
  const banco = bancoDePruebas();
  try {
    const r = new Repaso(lienzoDeMentira());
    r.reproducirFase({ tramos: [
      { corre_id: 'A1', trazo: nuevoTrazo({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }), inicio_ms: 0, duracion_ms: 500 },
      { corre_id: 'A2', trazo: largo, inicio_ms: 0, duracion_ms: 1000 },
    ] });
    ok(r.corriendo, 'la fase sigue reproduciéndose');
    eq(r.posicion('A1'), null, 'el de longitud cero no se pinta en ningún sitio raro:');
    ok(r.posicion('A2'), 'y el otro sí');
    r.destroy();
  } finally { banco.soltar(); }
});

test('una fase sin nada que reproducir avisa y no se queda corriendo', () => {
  const banco = bancoDePruebas();
  try {
    let fines = 0;
    const r = new Repaso(lienzoDeMentira(), { onFin: () => { fines++; } });
    r.reproducirFase({ tramos: [] });
    eq(r.corriendo, false);
    eq(fines, 1, 'avisa de que ha terminado, para que nadie se quede esperando:');
    eq(banco.pendientes(), 0, 'y no deja nada programado:');
    r.destroy();
  } finally { banco.soltar(); }
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
