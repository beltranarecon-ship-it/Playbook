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
    eq(r.activo.id, 'j2', 'manda el último:');
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

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
