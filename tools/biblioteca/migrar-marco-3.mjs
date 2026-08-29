#!/usr/bin/env node
/* ============================================================
   migrar-marco-3.mjs — pasa las coordenadas de las tandas del marco 2
   (pistas generadas a medidas FIBA) al marco 3 (las que dibujó el
   entrenador a mano).

     node tools/biblioteca/migrar-marco-3.mjs            → ensayo, no toca nada
     node tools/biblioteca/migrar-marco-3.mjs --aplicar  → reescribe las tandas

   ── QUÉ HA CAMBIADO ─────────────────────────────────────────
   El marco 2 era una cancha FIBA de 28 × 15 m con 2 m de banda por los
   cuatro lados. El 3 es el dibujo del club: 24 × 14 m, 2 m de banda a
   los lados y 1,5 tras el fondo, y en las medias un trozo de pista más
   allá del medio campo distinto en cada una. Los cuatro lienzos cambian
   de proporción, así que una coordenada normalizada que antes caía en el
   codo ahora cae en otro sitio.

                        marco 2        marco 3
     entera            19 × 32 m      18 × 27 m
     entera_fiba       19 × 32 m      18 × 27 m
     media             18 × 19 m      18 × 18 m
     media_fiba        18 × 19 m      17 × 18 m

   ── EL MAPA ─────────────────────────────────────────────────
   El mismo criterio que en el paso 1 → 2: por eje y por pista, una
   recta que lleva las dos líneas conocidas del dibujo viejo a esas
   mismas líneas del nuevo. Las bandas y los fondos en la entera; el
   fondo y el medio campo en las medias.

   Se respetan los LÍMITES DEL CAMPO y no la zona ni el aro, y esta vez
   hay un motivo extra: el dibujo nuevo es de minibasket —tiro libre a
   4,63 en vez de 5,80— así que ningún mapa puede respetar a la vez los
   fondos y la zona. Quien colocó cada cono estaba mirando los límites
   del campo, no la línea de tiros libres.

   Consecuencia que conviene saber: un jugador que estaba en la línea de
   tiros libres del marco 2 aterriza cerca —no encima— de la del 3.
   Corregirlo caso por caso sería inventar dónde quiso ponerlo el
   entrenador. Las posiciones con NOMBRE no tienen ese problema: se
   recalculan solas desde medidas.js y caen exactamente sobre su línea.

   ── IDEMPOTENCIA ────────────────────────────────────────────
   Importa más que de costumbre: aplicar el mapa dos veces movería todo
   el doble y no hay forma de deshacerlo. Cada tanda lleva su marco
   escrito dentro (`/* marco: N *​/`), que viaja en git. La migración
   anterior usaba un fichero suelto en copias/, que está en .gitignore:
   en un clon nuevo no existía y el migrador se habría creído que
   faltaba por hacer.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limitesCancha } from '../../taller/js/canvas/medidas.js';
import { recta, migrarTexto, marcoDe, sellar } from './marco-comun.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIAS = resolve(AQUI, 'copias');
const DESDE = 2, HASTA = 3;

/* ── El marco 2, en coordenada normalizada ────────────────────
   Sus límites de cancha, escritos como la fracción de la que salen para
   que se puedan comprobar de un vistazo. Se copian aquí porque este
   script es lo último que los necesita: cuando termine, ese marco deja
   de existir en el repositorio.

     entera / entera_fiba : lienzo 19 × 32 (cancha 15 × 28 + 2 de banda)
     media  / media_fiba  : lienzo 18 × 19 (media cancha 14 de largo)  */
const ENTERA_2 = { x: [2 / 19, 17 / 19], y: [2 / 32, 30 / 32] };   // bandas / fondos
const MEDIA_2  = { x: [2 / 18, 16 / 18], y: [2 / 19, 17 / 19] };   // fondo→medio campo / bandas
const VIEJO = {
  entera: ENTERA_2, entera_fiba: ENTERA_2,
  media: MEDIA_2,   media_fiba: MEDIA_2,
};

const MAPA = Object.fromEntries(Object.keys(VIEJO).map((p) => {
  const nuevo = limitesCancha(p);          // el marco 3, leído de medidas.js
  return [p, { x: recta(VIEJO[p].x, nuevo.x), y: recta(VIEJO[p].y, nuevo.y) }];
}));

/* Redondeo a 4 decimales —lo mismo que guardan las anclas— y recorte a
   [0,1], contando los recortes: si son muchos, es que el mapa está mal
   y hay que mirarlo antes de aplicar nada. */
let recortados = 0;
const ajustar = (v) => {
  let r = v;
  if (r < 0 || r > 1) { recortados += 1; r = Math.min(1, Math.max(0, r)); }
  return Number(r.toFixed(4));
};

/* ── Main ────────────────────────────────────────────────────── */

const aplicar = process.argv.includes('--aplicar');

const ficheros = readdirSync(AQUI)
  .filter((f) => /^tanda-\d+\.mjs$/.test(f) || f === 'piloto.mjs')
  .sort();

const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
if (aplicar && !existsSync(COPIAS)) mkdirSync(COPIAS, { recursive: true });

let total = 0, saltados = 0;
const porFn = {}, porPista = {};

for (const f of ficheros) {
  const ruta = resolve(AQUI, f);
  const antes = readFileSync(ruta, 'utf8');

  const marco = marcoDe(antes, DESDE);
  if (marco !== DESDE) {
    saltados += 1;
    console.log(`· ${f.padEnd(16)} ya está en el marco ${marco}, se salta`);
    continue;
  }

  const { texto, cambios } = migrarTexto(antes, MAPA, ajustar);
  total += cambios.length;
  for (const c of cambios) {
    porFn[c.fn] = (porFn[c.fn] || 0) + 1;
    porPista[c.pista] = (porPista[c.pista] || 0) + 1;
  }
  console.log(`${cambios.length ? '→' : '='} ${f.padEnd(16)} ${String(cambios.length).padStart(4)} coordenadas`);

  if (aplicar) {
    copyFileSync(ruta, resolve(COPIAS, `${basename(f, '.mjs')}-marco${DESDE}-${sello}.mjs`));
    writeFileSync(ruta, sellar(texto, HASTA), 'utf8');
  }
}

console.log();
console.log('por sitio: ', Object.entries(porFn).map(([k, v]) => `${k} ${v}`).join(' · ') || 'nada');
console.log('por pista: ', Object.entries(porPista).map(([k, v]) => `${k} ${v}`).join(' · ') || 'nada');
console.log(`total: ${total} coordenadas${saltados ? ` · ${saltados} ficheros ya migrados` : ''}`);
if (recortados) console.log(`AVISO: ${recortados} coordenadas se salían del lienzo y se han recortado a [0,1].`);

if (!aplicar) {
  console.log('\nEnsayo. Nada escrito. Repite con --aplicar para hacerlo de verdad.');
} else if (total) {
  console.log(`\n✓ tandas reescritas y selladas como marco ${HASTA} · original en copias/*-marco${DESDE}-${sello}.mjs`);
  console.log('  Ahora: node tools/biblioteca/construir.mjs --lint');
}
