#!/usr/bin/env node
/* ============================================================
   migrar-marco.mjs — pasa las coordenadas escritas a mano en las
   tandas del marco VIEJO (los SVG estilizados en hoja A4) al marco
   NUEVO (pistas a escala real con banda de 2 m, Tramo 2.1).

     node tools/biblioteca/migrar-marco.mjs            → ensayo, no toca nada
     node tools/biblioteca/migrar-marco.mjs --aplicar  → reescribe las tandas

   ── QUÉ SE TOCA Y QUÉ NO ────────────────────────────────────
   La fuente de verdad de la biblioteca NO es biblioteca.json: es el
   conjunto de tanda-*.mjs, donde cada ficha declara su tablero y su
   intención, y construir.mjs compila la geometría. Migrar el JSON
   habría durado hasta el siguiente `construir`.

   Dentro de las tandas se reescribe SOLO lo que es una coordenada
   absoluta escrita como número:

     jug('A', 1, 0.34, 0.66)      →  los dos últimos
     balon(0.34, 0.66)            →  los dos
     cono(0.28, 0.62)             →  los dos
     fila(0.34, 0.66, 3, 0)       →  los dos primeros
     hacia: { x: 0.34, y: 0.66 }  →  los dos

   NO se toca nada que sea una expresión. `M.codo_der[0] - 0.06` se
   queda como está a propósito: el ancla se mueve sola (ahora sale de
   medidas.js) y el −0.06 es un desplazamiento relativo, no un sitio.
   Reescribirlo lo movería dos veces.

   ── EL MAPA ─────────────────────────────────────────────────
   Por eje y por pista, una recta que lleva las dos líneas conocidas
   del dibujo viejo a las mismas dos líneas del dibujo nuevo: las
   bandas y los fondos en la entera; el fondo, el medio campo y las
   bandas en la media. Un punto a mitad de camino entre las dos
   bandas sigue a mitad de camino; uno que estaba fuera del campo
   sigue fuera, y ahora además cabe, porque hay banda de 2 m.

   Se ha elegido este mapa —y no uno calcado sobre la zona o el aro—
   porque el dibujo viejo NO era coherente consigo mismo: sus líneas
   de banda decían una escala y su zona decía otra un 17 % distinta.
   No hay un mapa que respete las dos. Este respeta los límites del
   campo, que es lo que estaba mirando quien colocó cada cono.

   Las posiciones con NOMBRE no pasan por aquí: se recalculan solas
   desde medidas.js y caen exactamente donde toca.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limitesCancha } from '../../taller/js/canvas/medidas.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIAS = resolve(AQUI, 'copias');
const TESTIGO = resolve(AQUI, 'copias/.marco-migrado');

/* ── El marco viejo ───────────────────────────────────────────
   Posición normalizada, en el dibujo ANTERIOR, de dos líneas por
   eje. Son las que estaban en taller/tools/anclas-medidas.json,
   escaneadas sobre el arte de cada SVG. Se copian aquí porque este
   script es lo último que las necesita: cuando termine, ese marco
   deja de existir. */
const VIEJO = {
  entera:      { x: [0.057, 0.942], y: [0.020, 0.980] },   // bandas / fondos
  entera_fiba: { x: [0.0595, 0.936], y: [0.084, 0.907] },
  media:       { x: [0.146, 0.829], y: [0.050, 0.943] },   // fondo→medio campo / bandas
  media_fiba:  { x: [0.146, 0.824], y: [0.098, 0.902] },
};

/** Recta que lleva [o0,o1] a [n0,n1]. */
const recta = ([o0, o1], [n0, n1]) => (v) => n0 + ((v - o0) * (n1 - n0)) / (o1 - o0);

const MAPA = Object.fromEntries(Object.keys(VIEJO).map((p) => {
  const nuevo = limitesCancha(p);
  return [p, { x: recta(VIEJO[p].x, nuevo.x), y: recta(VIEJO[p].y, nuevo.y) }];
}));

/** Redondeo a 4 decimales y recorte a [0,1] (contando los recortes). */
let recortados = 0;
function convertir(pista, eje, v) {
  const f = MAPA[pista];
  if (!f) return null;
  let r = f[eje](v);
  if (r < 0 || r > 1) { recortados += 1; r = Math.min(1, Math.max(0, r)); }
  return Number(r.toFixed(4));
}

/* ── Lectura de argumentos ───────────────────────────────────
   Un mini-analizador que solo sabe hacer una cosa: dada la posición
   del paréntesis de apertura, devolver los tramos de texto de cada
   argumento de nivel 0. No entiende JavaScript; entiende paréntesis,
   corchetes, llaves y comillas, que es todo lo que hay en estas
   llamadas. Basta y no arrastra una dependencia. */
function argumentos(s, iAbre) {
  const args = [];
  let d = 1, ini = iAbre + 1, i = ini, comilla = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (comilla) { if (c === '\\') i += 1; else if (c === comilla) comilla = null; continue; }
    if (c === "'" || c === '"' || c === '`') { comilla = c; continue; }
    if ('([{'.includes(c)) { d += 1; continue; }
    if (')]}'.includes(c)) {
      d -= 1;
      if (d === 0) { args.push([ini, i]); return { args, fin: i }; }
      continue;
    }
    if (d === 1 && c === ',') { args.push([ini, i]); ini = i + 1; }
  }
  return null;   // paréntesis sin cerrar: se deja el fichero en paz
}

const ES_NUMERO = /^\s*(-?\d*\.?\d+)\s*$/;

/* ── Reescritura de un fichero ───────────────────────────────── */

// nombre de la función → índice del primer argumento de coordenada
const LLAMADAS = { jug: 2, balon: 0, cono: 0, fila: 0 };

function migrarFichero(texto) {
  const cambios = [];
  let out = '';
  let i = 0;
  let pista = null;           // el tipo_pista de la ficha que se está leyendo

  const rx = /\btipo_pista:\s*'([a-z_]+)'|\b(jug|balon|cono|fila)\s*\(|\bhacia:\s*\{/g;
  let m;
  while ((m = rx.exec(texto))) {
    if (m[1]) { pista = m[1]; continue; }                   // marca de pista
    if (!pista || !MAPA[pista]) continue;                    // sin pista conocida, no se toca

    if (m[2]) {
      // llamada jug/balon/cono/fila
      const abre = m.index + m[0].length - 1;
      const r = argumentos(texto, abre);
      if (!r) continue;
      const desde = LLAMADAS[m[2]];
      const pares = [[r.args[desde], 'x'], [r.args[desde + 1], 'y']];
      for (const [tramo, eje] of pares) {
        if (!tramo) continue;
        const crudo = texto.slice(tramo[0], tramo[1]);
        const n = ES_NUMERO.exec(crudo);
        if (!n) continue;
        const nuevo = convertir(pista, eje, Number(n[1]));
        if (nuevo == null) continue;
        cambios.push({ ini: tramo[0], fin: tramo[1], texto: crudo.replace(n[1], String(nuevo)), pista, fn: m[2] });
      }
      rx.lastIndex = r.fin;
      continue;
    }

    // hacia: { x: N, y: N }
    const abre = m.index + m[0].length - 1;
    const cierra = texto.indexOf('}', abre);
    if (cierra < 0) continue;
    const cuerpo = texto.slice(abre + 1, cierra);
    let desplazado = 0;
    const nuevoCuerpo = cuerpo.replace(/\b([xy])\s*:\s*(-?\d*\.?\d+)/g, (todo, eje, num) => {
      const nuevo = convertir(pista, eje, Number(num));
      if (nuevo == null) return todo;
      desplazado += 1;
      return todo.replace(num, String(nuevo));
    });
    if (desplazado) cambios.push({ ini: abre + 1, fin: cierra, texto: nuevoCuerpo, pista, fn: 'hacia' });
    rx.lastIndex = cierra;
  }

  cambios.sort((a, b) => a.ini - b.ini);
  let cursor = 0;
  for (const c of cambios) { out += texto.slice(cursor, c.ini) + c.texto; cursor = c.fin; }
  out += texto.slice(cursor);
  return { texto: out, cambios };
}

/* ── Main ────────────────────────────────────────────────────── */

const aplicar = process.argv.includes('--aplicar');

if (aplicar && existsSync(TESTIGO)) {
  console.error('✗ las tandas ya están en el marco nuevo (testigo en copias/.marco-migrado).');
  console.error('  Aplicar el mapa dos veces movería todo el doble. Borra el testigo a mano si de verdad quieres repetirlo.');
  process.exit(1);
}

const ficheros = readdirSync(AQUI)
  .filter((f) => /^tanda-\d+\.mjs$/.test(f) || f === 'piloto.mjs')
  .sort();

const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
if (aplicar && !existsSync(COPIAS)) mkdirSync(COPIAS, { recursive: true });

let total = 0;
const porFn = {};
for (const f of ficheros) {
  const ruta = resolve(AQUI, f);
  const antes = readFileSync(ruta, 'utf8');
  const { texto, cambios } = migrarFichero(antes);
  total += cambios.length;
  for (const c of cambios) porFn[c.fn] = (porFn[c.fn] || 0) + 1;
  console.log(`${cambios.length ? '→' : '='} ${f.padEnd(16)} ${String(cambios.length).padStart(4)} coordenadas`);
  if (aplicar && cambios.length) {
    copyFileSync(ruta, resolve(COPIAS, `${basename(f, '.mjs')}-marco-viejo-${sello}.mjs`));
    writeFileSync(ruta, texto, 'utf8');
  }
}

console.log();
console.log('por sitio:', Object.entries(porFn).map(([k, v]) => `${k} ${v}`).join(' · ') || 'nada');
console.log(`total: ${total} coordenadas${recortados ? ` · ${recortados} recortadas a [0,1]` : ''}`);

if (!aplicar) {
  console.log('\nEnsayo. Nada escrito. Repite con --aplicar para hacerlo de verdad.');
} else {
  writeFileSync(TESTIGO, `${sello}\n${total} coordenadas\n`, 'utf8');
  console.log(`\n✓ tandas reescritas · copia del original en copias/*-marco-viejo-${sello}.mjs`);
  console.log('  Ahora: node tools/biblioteca/construir.mjs --lint');
}
