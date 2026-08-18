/* ============================================================
   gen-pistas.mjs — dibuja los cuatro SVG de fondo a partir de
   canvas/medidas.js.

     node taller/tools/gen-pistas.mjs            → escribe los SVG
     node taller/tools/gen-pistas.mjs --check    → solo comprueba

   Sustituye a cuatro ficheros de 2,4 MB que eran una foto trazada
   metida en una hoja A4: no estaban a escala, cada eje estaba
   estirado de forma distinta y no dejaban ni un centímetro fuera de
   las líneas. Estos pesan unos 10 KB, son vectoriales de verdad y
   cada línea está donde dice el reglamento porque sale de la misma
   tabla que las anclas y que la escala.

   Los arcos se dibujan como polilíneas de 2° en vez de con el
   comando A de SVG: con dos orientaciones distintas (retrato y
   paisaje) los flags de barrido se equivocan de lado con una
   facilidad extraordinaria, y a 6,75 m de radio la cuerda de 2°
   se separa un milímetro del arco de verdad. No se ve, y no hay
   forma de que salga del revés.
   ============================================================ */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REGLAS, PISTAS_M, TRIPLE_LATERAL, TRIPLE_CORTE, marcoDe, pistaAMarco,
} from '../js/canvas/medidas.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(AQUI, '../assets/pistas');

/* ── Paleta ────────────────────────────────────────────────── */
const COLOR = {
  banda:   '#063E52',   // zona libre exterior: el mismo azul, más apagado
  suelo:   '#056D8D',   // el teal de las pistas anteriores, tal cual
  linea:   '#FFFFFF',
  zona:    'rgba(255,255,255,.07)',
  aro:     '#EA580C',   // el naranja del balón: la canasta se encuentra sola
  tablero: '#FFFFFF',
};
const OPACIDAD_LINEA = 0.92;

/* ── Utilidades de dibujo, en coordenadas de PISTA (d, l) ──── */

const n = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

/** Crea el juego de helpers atado a una pista y una canasta. */
function lapiz(pista, canasta) {
  const p = (d, l) => pistaAMarco(pista, d, l, canasta).map(n);

  const linea = (d1, l1, d2, l2, o = {}) => {
    const [x1, y1] = p(d1, l1);
    const [x2, y2] = p(d2, l2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${attrs(o)}/>`;
  };

  const poli = (puntos, o = {}) => {
    const d = puntos.map(([dd, ll], i) => `${i ? 'L' : 'M'}${p(dd, ll).join(' ')}`).join('');
    return `<path d="${d}"${attrs(o)}/>`;
  };

  /**
   * Arco centrado en (cd, cl) entre dos ángulos. El ángulo se mide de
   * forma que 0° apunta al lado derecho, 90° hacia el centro de la
   * pista (d creciente), 180° al lado izquierdo y 270° al fondo: o
   * sea, el semicírculo "que se aleja del aro" es 0→180 y el "que va
   * hacia el aro", 180→360.
   */
  const arco = (cd, cl, r, g1, g2, o = {}) => {
    const paso = g1 < g2 ? 2 : -2;
    const pts = [];
    for (let g = g1; paso > 0 ? g < g2 : g > g2; g += paso) {
      pts.push([cd + r * Math.sin((g * Math.PI) / 180), cl + r * Math.cos((g * Math.PI) / 180)]);
    }
    pts.push([cd + r * Math.sin((g2 * Math.PI) / 180), cl + r * Math.cos((g2 * Math.PI) / 180)]);
    return poli(pts, o);
  };

  const circulo = (cd, cl, r, o = {}) => {
    const [cx, cy] = p(cd, cl);
    return `<circle cx="${cx}" cy="${cy}" r="${n(r)}"${attrs(o)}/>`;
  };

  /** Rectángulo dado por sus dos esquinas en (d, l); sale bien en las dos orientaciones. */
  const rect = (d1, l1, d2, l2, o = {}) => {
    const [xa, ya] = p(d1, l1);
    const [xb, yb] = p(d2, l2);
    const x = Math.min(xa, xb); const y = Math.min(ya, yb);
    return `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.abs(xb - xa))}" height="${n(Math.abs(yb - ya))}"${attrs(o)}/>`;
  };

  return { p, linea, poli, arco, circulo, rect };
}

function attrs(o) {
  return Object.entries(o).map(([k, v]) => ` ${k}="${v}"`).join('');
}

/* ── Las piezas de una canasta ─────────────────────────────── */

function canastaSVG(pista, canasta, conTriple) {
  const { linea, poli, arco, circulo, rect } = lapiz(pista, canasta);
  const R = REGLAS;
  const z = R.zonaAncho / 2;
  const out = [];

  // zona restringida
  out.push(rect(0, -z, R.zonaFondo, z, { fill: COLOR.zona, stroke: 'none' }));
  out.push(poli([[0, -z], [R.zonaFondo, -z], [R.zonaFondo, z], [0, z]], { fill: 'none' }));

  // plazas de rebote: cuatro marcas por lado, a las distancias del
  // reglamento (1,75 / 2,15 / 3,00 / 3,85 desde el fondo)
  for (const d of [1.75, 2.15, 3.00, 3.85]) {
    for (const s of [-1, 1]) out.push(linea(d, s * z, d, s * (z + 0.20)));
  }

  // círculo de tiros libres: entero hacia fuera, discontinuo hacia el
  // aro (la mitad que cae dentro de la zona, como marca el reglamento)
  out.push(arco(R.zonaFondo, 0, R.circuloRadio, 0, 180));
  out.push(arco(R.zonaFondo, 0, R.circuloRadio, 180, 360, { 'stroke-dasharray': '0.35 0.35' }));

  // semicírculo de no carga
  out.push(linea(R.tableroFrente, -R.noCargaRadio, R.aroRetranqueo, -R.noCargaRadio));
  out.push(linea(R.tableroFrente, R.noCargaRadio, R.aroRetranqueo, R.noCargaRadio));
  out.push(arco(R.aroRetranqueo, 0, R.noCargaRadio, 0, 180));

  if (conTriple) {
    const corte = TRIPLE_CORTE;
    for (const s of [-1, 1]) out.push(linea(0, s * TRIPLE_LATERAL, corte, s * TRIPLE_LATERAL));
    // el arco arranca justo donde muere el tramo recto
    const g0 = (Math.atan2(corte - R.aroRetranqueo, TRIPLE_LATERAL) * 180) / Math.PI;
    out.push(arco(R.aroRetranqueo, 0, R.tripleRadio, g0, 180 - g0));
  }

  // tablero y aro, por encima de todo lo demás
  out.push(linea(R.tableroFrente, -R.tableroAncho / 2, R.tableroFrente, R.tableroAncho / 2,
    { stroke: COLOR.tablero, 'stroke-width': 0.12, 'stroke-linecap': 'round', opacity: 1 }));
  out.push(linea(R.tableroFrente, 0, R.aroRetranqueo, 0, { stroke: COLOR.aro, 'stroke-width': 0.09, opacity: 1 }));
  out.push(circulo(R.aroRetranqueo, 0, R.aroRadio,
    { fill: 'none', stroke: COLOR.aro, 'stroke-width': 0.09, opacity: 1 }));

  return out;
}

/* ── La pista entera ───────────────────────────────────────── */

function pistaSVG(pista) {
  const m = marcoDe(pista);
  const R = REGLAS;
  const { linea, arco, circulo, rect } = lapiz(pista, 'norte');
  const cuerpo = [];

  // suelo de juego (la banda es el fondo del propio lienzo)
  cuerpo.push(rect(0, -R.ancho / 2, m.largoVisible, R.ancho / 2,
    { fill: COLOR.suelo, stroke: 'none' }));

  // límites: en la media, el borde de medio campo no es una banda —
  // se dibuja igual porque ahí ES donde acaba lo dibujado.
  cuerpo.push(rect(0, -R.ancho / 2, m.largoVisible, R.ancho / 2, { fill: 'none' }));

  if (m.largoVisible === R.largo) {
    cuerpo.push(linea(R.largo / 2, -R.ancho / 2, R.largo / 2, R.ancho / 2));
    cuerpo.push(circulo(R.largo / 2, 0, R.circuloRadio, { fill: 'none' }));
  } else {
    // media pista: se ve la mitad del círculo central que cae dentro
    cuerpo.push(arco(R.largo / 2, 0, R.circuloRadio, 180, 360));
  }

  for (const c of m.canastas) cuerpo.push(...canastaSVG(pista, c, m.triple));

  const ancho = n(m.ancho); const alto = n(m.alto);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERADO por taller/tools/gen-pistas.mjs desde taller/js/canvas/medidas.js.
     No editar a mano: cambia las medidas allí y vuelve a generar.
     El viewBox está EN METROS: 1 unidad = 1 m, y el metro mide lo mismo
     en los dos ejes. Marco = ${n(m.largoVisible)} × ${R.ancho} m de pista
     + ${R.banda} m de banda por cada lado. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}"
     width="${ancho * 40}" height="${alto * 40}" preserveAspectRatio="none">
  <rect x="0" y="0" width="${ancho}" height="${alto}" fill="${COLOR.banda}"/>
  <g fill="none" stroke="${COLOR.linea}" stroke-width="${REGLAS.linea}"
     stroke-linejoin="round" stroke-linecap="butt" opacity="${OPACIDAD_LINEA}">
${cuerpo.map((s) => `    ${s}`).join('\n')}
  </g>
</svg>
`;
}

/* ── Comprobaciones que se ejecutan siempre ────────────────── */

function comprobar() {
  const fallos = [];
  const casi = (a, b, tol, msg) => {
    if (Math.abs(a - b) > tol) fallos.push(`${msg}: ${a.toFixed(3)} ≠ ${b} (±${tol})`);
  };

  // el corte del triple es un número publicado por FIBA: si las
  // constantes de medidas.js se tocan y dejan de cuadrar, salta aquí
  casi(TRIPLE_CORTE, 2.99, 0.01, 'corte del tramo recto del triple');
  casi(TRIPLE_LATERAL, 6.60, 0.001, 'separación del tramo recto al eje');

  for (const pista of Object.keys(PISTAS_M)) {
    const m = marcoDe(pista);
    // el metro tiene que medir lo mismo en los dos ejes: el marco en
    // metros y el lienzo en píxeles han de ser la misma proporción
    const [x1, y1] = pistaAMarco(pista, 0, -REGLAS.ancho / 2, 'norte');
    const [x2, y2] = pistaAMarco(pista, 0, REGLAS.ancho / 2, 'norte');
    casi(Math.hypot(x2 - x1, y2 - y1), REGLAS.ancho, 0.001, `${pista}: ancho de la línea de fondo`);
    casi(m.ancho * m.alto > 0 ? m.aspect : 0, m.ancho / m.alto, 1e-9, `${pista}: aspecto`);

    // todo lo dibujado cae dentro del marco, con la banda de margen
    for (const c of m.canastas) {
      for (const [d, l] of [[0, -REGLAS.ancho / 2], [m.largoVisible, REGLAS.ancho / 2]]) {
        const [fx, fy] = pistaAMarco(pista, d, l, c);
        if (fx < -1e-9 || fy < -1e-9 || fx > m.ancho + 1e-9 || fy > m.alto + 1e-9) {
          fallos.push(`${pista}/${c}: (${d},${l}) se sale del marco`);
        }
      }
    }
  }
  return fallos;
}

/* ── Main ──────────────────────────────────────────────────── */

const soloCheck = process.argv.includes('--check');
const fallos = comprobar();
if (fallos.length) {
  console.error('✗ las medidas no cuadran:');
  for (const f of fallos) console.error('  ·', f);
  process.exit(1);
}

if (!existsSync(DESTINO)) mkdirSync(DESTINO, { recursive: true });

const NOMBRE = {
  entera: 'pista-entera.svg',
  media: 'pista-media.svg',
  entera_fiba: 'pista-entera-fiba.svg',
  media_fiba: 'pista-media-fiba.svg',
};

let cambios = 0;
for (const [pista, fichero] of Object.entries(NOMBRE)) {
  const svg = pistaSVG(pista);
  const ruta = resolve(DESTINO, fichero);
  const antes = existsSync(ruta) ? readFileSync(ruta, 'utf8') : null;
  const igual = antes === svg;
  if (!igual) cambios += 1;
  if (!soloCheck && !igual) writeFileSync(ruta, svg, 'utf8');
  const m = marcoDe(pista);
  console.log(`${igual ? '=' : soloCheck ? '≠' : '→'} ${fichero.padEnd(22)} `
    + `${m.ancho} × ${m.alto} m · aspecto ${m.aspect.toFixed(4)} · ${(svg.length / 1024).toFixed(1)} KB`);
}

if (soloCheck && cambios) {
  console.error(`✗ ${cambios} SVG están desincronizados con medidas.js — ejecuta gen-pistas.mjs`);
  process.exit(1);
}
console.log(cambios ? `✓ ${cambios} SVG escritos` : '✓ todo al día');
