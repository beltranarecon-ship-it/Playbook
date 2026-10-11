#!/usr/bin/env node
/* ============================================================
   guardar-video.mjs — lleva un ejercicio de dev/ejercicios-video.js a
   la tabla `exercises`, por la vía de servicio.

   El navegador de pruebas no guarda (tiene la sesión real del
   entrenador), así que los ejercicios sacados de vídeos entran por
   aquí: se dibujan en Node con el Tablero de la Pizarra, se compilan,
   se pasa la ficha por el linter de la app y la fila se construye con
   las reglas de `guardarEjercicio` (fila-video.mjs).

     node tools/biblioteca/guardar-video.mjs [V1]               → ensayo, no escribe
     node tools/biblioteca/guardar-video.mjs V1 --confirmar     → da de alta
     node tools/biblioteca/guardar-video.mjs V1 --actualizar    → ensayo de corrección
     node tools/biblioteca/guardar-video.mjs V1 --actualizar --confirmar
     node tools/biblioteca/guardar-video.mjs --revertir <manifiesto.json>
     (y --autor <uuid> para fijar el autor, como en importar.mjs)

   Sin código de ejercicio, coge el único que haya. Un nombre que ya
   está en la base ABORTA el alta; --actualizar corrige ese ejercicio por
   su id (PATCH), que conserva los bloques de sesión que ya lo usan.
   Toda escritura deja manifiesto en tools/biblioteca/manifiestos/ para
   revertirla.

   LA MINIATURA NO SE GENERA AQUÍ. `generarThumbnail` necesita el lienzo
   del navegador (canvas 2D, la imagen de la pista, WebP y gif.js), y en
   Node no lo hay sin dependencias nuevas. La ficha entra sin póster
   —la tarjeta de la biblioteca sale sin imagen, como las importadas
   antes de la pasada de miniaturas— y se completa después con
   taller/tools/miniaturas.html → «Generar las que faltan», que necesita
   la sesión del AUTOR de la ficha.
   ============================================================ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { conectar, resolverAutor, revertir, DIR_MANIFIESTOS } from './servicio.mjs';
import { guardarSinLasQueFalten } from '../../taller/js/supabase/columnas.js';

const argv = process.argv.slice(2);

/* Salir con un respiro, como importar.mjs: `process.exit()` con el socket
   de la última petición todavía cerrándose hace que libuv suelte en
   Windows un «Assertion failed» debajo de lo que había que leer. */
const salir = async (codigo) => { await new Promise((r) => setTimeout(r, 120)); process.exit(codigo); };
const tiene = (f) => argv.includes(f);
const CONFIRMAR = tiene('--confirmar');
const ACTUALIZAR = tiene('--actualizar');

/* ---- revertir ---------------------------------------------------- */

const iRev = argv.indexOf('--revertir');
if (iRev >= 0) {
  await revertir(argv[iRev + 1], conectar());
  await salir(0);
}

const { EJERCICIOS_DE_VIDEO } = await import('../../dev/ejercicios-video.js');
const { elegir, codigoDe, preparar, decidir, camposDeActualizacion } = await import('./fila-video.mjs');

/* El primer argumento que no es opción (ni el valor de --autor). */
const iAutor = argv.indexOf('--autor');
const sel = argv.find((a, i) => !a.startsWith('--') && !(iAutor >= 0 && i === iAutor + 1));

/* ---- 1 · dibujar, compilar y revisar (sin red) -------------------- */

let ej, prep;
try {
  ej = elegir(EJERCICIOS_DE_VIDEO, sel);
  prep = preparar(ej);
} catch (e) {
  console.error(`\n  ${e.message}\n`);
  process.exit(1);
}

console.log(`\n─── ${ej.nombre} ───\n`);
console.log(`  Fuente: ${ej.fuente || '(sin fuente)'}`);
console.log(`  Linter y dibujo: ${prep.errores.length} error(es) · ${prep.avisos.length} aviso(s)`);
for (const a of prep.avisos) console.log(`    aviso: ${a}`);
if (prep.errores.length) {
  console.error('\n  No se guarda nada con errores. Corrígelos en dev/ejercicios-video.js:\n');
  for (const e of prep.errores) console.error(`    · ${e}`);
  console.error('');
  process.exit(1);
}

/* ---- 2 · autor y nombre (solo lee) -------------------------------- */

const pedir = conectar();
const autor = await resolverAutor(pedir, process.argv);
const fila = { ...prep.fila, created_by: autor };
const existentes = await (await pedir('exercises?select=id,name')).json();
const decision = decidir(fila.name, existentes, { actualizar: ACTUALIZAR });
console.log(`  En la base hay ya ${existentes.length} ejercicio(s)`);

/* ---- 3 · la fila, resumida ---------------------------------------- */

const kB = (v) => `${(JSON.stringify(v).length / 1024).toFixed(1)} kB`;
const corta = (s, n = 72) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
function resumen(k, v) {
  const a = prep.animacion;
  const j = prep.jugada;
  if (k === 'animacion') {
    const fases = [...a.fases, ...(a.fases_rama || [])];
    return `motor ${a.motor} · pista ${a.pista} · ${a.jugadores.length} jugador(es), ${a.balones.length} balón(es), ${a.conos.length} cono(s) · ${fases.length} fase(s) de ${fases.map((f) => f.duracion_ms).join('+')} ms · sin avisos · ${kB(v)}`;
  }
  if (k === 'jugada') {
    const tramos = j.fases.reduce((n, f) => n + (f.tramos || []).length, 0);
    return `v${j.version} · ${j.elementos.length} elemento(s) · ${j.fases.length} fase(s) · ${tramos} tramo(s) · ${kB(v)}`;
  }
  if (k === 'requisitos') return `${Object.keys(v).length} campos: ${corta(Object.keys(v).join(', '), 90)}`;
  if (Array.isArray(v)) return v.length ? v.join(', ') : '[]';
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'string') return `«${corta(v)}»`;
  return String(v);
}

const escribe = decision.accion === 'actualizar' ? camposDeActualizacion(fila) : fila;
console.log(`\n─── Fila (${Object.keys(escribe).length} columnas) ───\n`);
for (const [k, v] of Object.entries(escribe)) console.log(`  ${k.padEnd(18)} ${resumen(k, v)}`);
if (decision.accion !== 'actualizar') console.log(`  ${'poster/thumbnail'.padEnd(18)} sin generar (ver más abajo)`);
console.log(`\n  Frase de la animación: ${corta(prep.animacion.fases[0]?.frase || '', 200)}`);

/* ---- 4 · qué se haría --------------------------------------------- */

console.log('\n─── Qué haría ───\n');
if (decision.accion === 'abortar') {
  console.error(`  ABORTA: ${decision.motivo}\n`);
  await salir(1);
}
const codigo = codigoDe(ej);
if (decision.accion === 'alta') {
  console.log(`  INSERT de «${fila.name}» en exercises (si a la base le falta marco o jugada, se reintenta sin ella, como la app).`);
} else {
  console.log(`  PATCH de «${decision.nombreEnBase}» (id ${decision.id}): reescribe ficha, dibujo y marco; conserva id, autor y favorito; deja póster y GIF en null.`);
}
console.log('  Miniatura: la genera taller/tools/miniaturas.html → «Generar las que faltan», con la sesión del autor.');

if (!CONFIRMAR) {
  console.log('\n  Ensayo: no se ha escrito nada. Para hacerlo de verdad:\n');
  console.log(`      node tools/biblioteca/guardar-video.mjs ${codigo}${ACTUALIZAR ? ' --actualizar' : ''} --confirmar\n`);
  await salir(0);
}

/* ---- 5 · escribir -------------------------------------------------- */

/* La fila que no cabe en la base por una columna nueva sin migrar se
   reintenta sin ella, con el mismo bucle que usa la app. */
const conRed = (fn) => async (f) => {
  try { return { data: await fn(f), error: null }; }
  catch (e) { return { data: null, error: { message: e.message } }; }
};

mkdirSync(DIR_MANIFIESTOS, { recursive: true });
const sello = new Date().toISOString().replace(/[:.]/g, '-');
const manifiesto = join(DIR_MANIFIESTOS, `video-${codigo}-${sello}.json`);

if (decision.accion === 'alta') {
  const { data, error, quitadas } = await guardarSinLasQueFalten(conRed(async (f) => {
    const r = await pedir('exercises?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(f) });
    return (await r.json())[0];
  }), fila);
  if (error) { console.error(`\n  No se ha guardado: ${error.message}\n`); await salir(1); }
  writeFileSync(manifiesto, JSON.stringify({ generado: new Date().toISOString(), origen: 'guardar-video', nombre: fila.name, autor, total: 1, ids: [data.id] }, null, 2), 'utf8');
  console.log(`\n  Dado de alta: ${data.id}${quitadas.length ? ` (sin ${quitadas.join(', ')}: falta su migración)` : ''}`);
} else {
  /* Lo que había antes, al manifiesto ANTES de escribir: si el PATCH
     sale bien y algo falla después, la copia ya está en disco. */
  const [actual] = await (await pedir(`exercises?id=eq.${decision.id}&select=*`)).json();
  const campos = camposDeActualizacion(fila);
  const antes = Object.fromEntries(Object.keys(campos).filter((k) => k in actual).map((k) => [k, actual[k]]));
  writeFileSync(manifiesto, JSON.stringify({ generado: new Date().toISOString(), origen: 'guardar-video', tipo: 'actualizacion', nombre: fila.name, id: decision.id, antes }, null, 2), 'utf8');
  const { error, quitadas } = await guardarSinLasQueFalten(conRed(async (f) => {
    await pedir(`exercises?id=eq.${decision.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(f) });
    return { id: decision.id };
  }), campos);
  if (error) { console.error(`\n  No se ha actualizado: ${error.message}\n`); await salir(1); }
  console.log(`\n  Actualizado: ${decision.id}${quitadas.length ? ` (sin ${quitadas.join(', ')}: falta su migración)` : ''}`);
}
console.log(`  Manifiesto: ${manifiesto}`);
console.log('\n  Para deshacerlo:');
console.log(`      node tools/biblioteca/guardar-video.mjs --revertir "${manifiesto}"\n`);
