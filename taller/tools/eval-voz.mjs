/* ============================================================
   eval-voz.mjs — banco Node de la narración (taller/js/pizarra/voz.js).
   Sin red, sin DOM: un motor, una voz y un almacén de mentira.

     node taller/tools/eval-voz.mjs

   La voz lee la frase automática de cada fase al empezarla, en el
   proyector y en la ficha (§9.3). Aquí se prueba cuándo habla y cuándo
   no, qué lee, a qué velocidad, y que se acuerda.
   ============================================================ */

import {
  Narrador, VELOCIDADES_VOZ, hayVoz, leerPreferencias, guardarPreferencias, fraseParaLeer, tieneFrases,
} from '../js/pizarra/voz.js';

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

/* Un motor con lo justo: eventos, si reproduce, la fase y sus frases, y
   el gancho con el que se le pide que espere. */
function motor(fases) {
  const oyentes = {};
  return {
    fases, k: 0, playing: false, phaseElapsed: 0,
    on(ev, cb) { (oyentes[ev] ||= []).push(cb); return this; },
    off(ev, cb) { oyentes[ev] = (oyentes[ev] || []).filter((f) => f !== cb); return this; },
    emit(ev, d) { (oyentes[ev] || []).forEach((f) => f(d)); },
    oyentes,
  };
}
/* Una voz que apunta lo que dice y cuándo se calla. */
function voz() {
  const dicho = [];
  let calladas = 0;
  class SpeechSynthesisUtterance { constructor(t) { this.text = t; } }
  const r = {
    g: { speechSynthesis: { speak: (u) => { r.ultimo = u; dicho.push({ texto: u.text, lang: u.lang, rate: u.rate }); }, cancel: () => { calladas++; } }, SpeechSynthesisUtterance },
    dicho, calladas: () => calladas, ultimo: null,
  };
  return r;
}
const ultimo = (v) => v.ultimo;
function almacen(inicial = {}) {
  const datos = { ...inicial };
  return { getItem: (k) => (k in datos ? datos[k] : null), setItem: (k, v) => { datos[k] = String(v); }, datos };
}
const FASES = [{ frase: 'A1 bota hasta el codo derecho.', texto: 'Lo que escribió el entrenador.' }, { frase: 'A2 tira desde la esquina y anota.' }, { frase: '' }];

test('EMPIEZA CALLADA: sin decir nada, no habla', () => {
  const m = motor(FASES), v = voz();
  const n = new Narrador(m, { g: v.g, almacen: almacen() });
  eq(n.activa, false);
  m.playing = true; m.k = 1; m.emit('phase', { k: 1 });
  eq(v.dicho, []);
});

test('ENCENDIDA, LEE LA FRASE AUTOMÁTICA AL EMPEZAR CADA FASE, en castellano y a su velocidad', () => {
  const m = motor(FASES), v = voz(), a = almacen();
  const n = new Narrador(m, { g: v.g, almacen: a });
  n.activar(true);
  n.setVelocidad(1.25);
  m.playing = true; m.k = 1; m.emit('phase', { k: 1 });
  eq(v.dicho, [{ texto: 'A2 tira desde la esquina y anota.', lang: 'es-ES', rate: 1.25 }]);
  m.k = 0; m.emit('phase', { k: 0 });
  eq(v.dicho[1].texto, 'A1 bota hasta el codo derecho.', 'la automática, no la reescrita:');
  m.k = 2; m.emit('phase', { k: 2 });
  eq(v.dicho.length, 2, 'una fase sin frase no dice nada:');
});

test('AL DARLE AL PLAY AL PRINCIPIO DE UNA FASE, LA LEE; a mitad, no; y no la repite', () => {
  const m = motor(FASES), v = voz();
  const n = new Narrador(m, { g: v.g, almacen: almacen() });
  n.activar(true);
  m.emit('phase', { k: 0 });              // se carga, en pausa: nada
  eq(v.dicho.length, 0);
  m.playing = true; m.emit('play');       // arranca al principio: la lee
  eq(v.dicho.map((d) => d.texto), ['A1 bota hasta el codo derecho.']);
  m.emit('play');                          // otro play en la misma fase: no la repite
  eq(v.dicho.length, 1);
  m.playing = false; m.emit('pause');
  m.k = 1; m.emit('phase', { k: 1 });      // se salta de fase en pausa: nada
  m.phaseElapsed = 900; m.playing = true; m.emit('play');
  eq(v.dicho.length, 1, 'a mitad de fase ya ha pasado:');
});

test('LA PRIMERA FASE TAMBIÉN SE LEE: el motor ya ha empezado cuando se montan los mandos', () => {
  const m = motor(FASES), v = voz();
  m.playing = true;                        // el proyector arranca solo
  new Narrador(m, { g: v.g, almacen: almacen({ 'cbp-voz': JSON.stringify({ activa: true, velocidad: 1 }) }) });
  eq(v.dicho.map((d) => d.texto), ['A1 bota hasta el codo derecho.']);
  const v2 = voz(), m2 = motor(FASES);
  m2.playing = true; m2.phaseElapsed = 900;
  new Narrador(m2, { g: v2.g, almacen: almacen({ 'cbp-voz': JSON.stringify({ activa: true, velocidad: 1 }) }) });
  eq(v2.dicho, [], 'a mitad de fase, no:');
});

test('LA ANIMACIÓN ESPERA A LA VOZ: mientras lee, la fase no se acaba (lo decidió el entrenador)', () => {
  const m = motor(FASES), v = voz();
  const n = new Narrador(m, { g: v.g, almacen: almacen() });
  eq(typeof m.retener, 'function', 'le da al motor con qué esperar');
  eq(m.retener(), false, 'callada, no espera:');
  n.activar(true);
  m.playing = true; m.emit('phase', { k: 0 });
  eq(m.retener(), true, 'leyendo, espera:');
  ultimo(v).onend();
  eq(m.retener(), false, 'al acabar la frase, sigue:');
  m.emit('phase', { k: 1 });
  m.emit('pause');
  eq(m.retener(), false, 'al pausar, tampoco espera:');
  n.destroy();
  eq(m.retener, null, 'y al soltarlo, le quita el gancho:');
});

test('UN VÍDEO QUE PAUSA AL EMPEZAR LA FASE NO SE COME SU FRASE: al seguir, se lee', () => {
  const m = motor(FASES), v = voz();
  const n = new Narrador(m, { g: v.g, almacen: almacen() });
  n.activar(true);
  m.playing = true; m.k = 1; m.emit('phase', { k: 1 });
  m.playing = false; m.emit('pause');      // el proyector abre el vídeo
  m.playing = true; m.emit('play');        // y al cerrarlo sigue
  eq(v.dicho.map((d) => d.texto), ['A2 tira desde la esquina y anota.', 'A2 tira desde la esquina y anota.']);
});

test('LA FICHA Y EL PROYECTOR A LA VEZ OBEDECEN AL MISMO INTERRUPTOR', () => {
  const a = almacen();
  const v = voz();
  const ficha = new Narrador(motor(FASES), { g: v.g, almacen: a });
  const proyector = new Narrador(motor(FASES), { g: v.g, almacen: a });
  proyector.activar(true);
  proyector.setVelocidad(1.25);
  eq([ficha.activa, ficha.velocidad], [true, 1.25], 'lo que se cambia en uno vale en el otro:');
  ficha.activar(false);
  eq(leerPreferencias(a), { activa: false, velocidad: 1.25 }, 'sin pisar la velocidad elegida en el otro:');
});

test('AL PAUSAR SE CALLA, y al apagarla también', () => {
  const m = motor(FASES), v = voz();
  const n = new Narrador(m, { g: v.g, almacen: almacen() });
  n.activar(true);
  const antes = v.calladas();
  m.emit('pause');
  ok(v.calladas() > antes, 'al pausar');
  const antes2 = v.calladas();
  n.activar(false);
  ok(v.calladas() > antes2, 'al apagar');
});

test('SE ACUERDA: el interruptor y la velocidad, en el navegador', () => {
  const a = almacen();
  const m = motor(FASES), v = voz();
  const n = new Narrador(m, { g: v.g, almacen: a });
  n.activar(true);
  n.setVelocidad(0.8);
  eq(leerPreferencias(a), { activa: true, velocidad: 0.8 });
  const otro = new Narrador(motor(FASES), { g: v.g, almacen: a });
  eq([otro.activa, otro.velocidad], [true, 0.8], 'el siguiente proyector la encuentra así:');
  eq(n.setVelocidad(3), false, 'una velocidad que no se ofrece no vale:');
  eq(leerPreferencias(almacen({ 'cbp-voz': 'roto' })), { activa: false, velocidad: 1 }, 'lo roto, lo de serie:');
  eq(leerPreferencias(null), { activa: false, velocidad: 1 }, 'y sin almacén, igual:');
  guardarPreferencias({ activa: true, velocidad: 1 }, null);
  eq(VELOCIDADES_VOZ, [0.8, 1, 1.25]);
});

test('SIN VOZ EN EL NAVEGADOR no habla ni revienta; y al soltarlo deja de escuchar', () => {
  eq([hayVoz({}), hayVoz(null)], [false, false]);
  const m = motor(FASES);
  const n = new Narrador(m, { g: {}, almacen: almacen() });
  n.activar(true);
  m.playing = true; m.emit('phase', { k: 0 });
  n.destroy();
  eq(Object.values(m.oyentes).map((l) => l.length), [0, 0, 0], 'suelta a sus tres oyentes:');
});

test('QUÉ SE LEE: la frase automática; una animación sin frases no tiene nada que leer', () => {
  eq([fraseParaLeer({ frase: '  Hola.  ' }), fraseParaLeer({ texto: 'escrita' }), fraseParaLeer(null)], ['Hola.', '', '']);
  eq([tieneFrases({ fases: FASES }), tieneFrases({ fases: [{ movimientos: [] }] }), tieneFrases(null)], [true, false, false]);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
