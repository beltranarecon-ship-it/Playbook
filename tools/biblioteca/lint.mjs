#!/usr/bin/env node
/* ============================================================
   lint.mjs — control de calidad de la biblioteca.

   Se escribe ANTES que el contenido para que el contenido nazca ya
   conforme. Con 200 fichas no se puede revisar todo a ojo, y lo que
   no se comprueba automáticamente, no se comprueba.

   Tres capas:
     1. FICHA      — campos, vocabulario, coherencia interna
     2. GEOMETRÍA  — compila la animación de verdad y la mide
     3. CONJUNTO   — invariantes y huecos de cobertura del mapa

   Uso:
     node tools/biblioteca/lint.mjs fichas.json
     node tools/biblioteca/lint.mjs fichas.json --solo-errores

   Su banco de pruebas es su propio punto de entrada, como los otros
   ocho del proyecto (importarlo desde aquí crearía un ciclo):
     node tools/biblioteca/lint.prueba.mjs

   Sale con código 1 si hay ERRORES (no si solo hay avisos), de modo
   que se pueda encadenar antes de importar.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TIPOS, RAMAS, NIVELES, PISTAS, BLOQUE_KEYS, DENSIDAD_KEYS, OPOSICION,
  NIVELES_EXIGENCIA, REQUISITOS_OBLIGATORIOS, REQUISITOS_CONDICIONALES,
  tagsDesconocidos,
} from './vocabulario.mjs';
import { huecos, revisarInvariantes, validarMapa, MAPA, OBJETIVO_TOTAL } from './mapa.mjs';
import { aroExacto } from '../../taller/js/canvas/anclas.js';

/* Fuera de la pista dibujada. No es [0,1] a secas: un jugador en
   x=0.999 está fuera del campo aunque el número sea legal. */
const MARGEN = 0.02;
const dentro = (v) => typeof v === 'number' && v >= -MARGEN && v <= 1 + MARGEN;

/* Dos jugadores más cerca que esto se pintan encima y no se lee nada. */
const SEPARACION_MINIMA = 0.035;

/* Una fase de menos de 200 ms no se ve; de más de 8 s aburre y casi
   siempre significa un path mal calculado. */
const FASE_MS = { min: 200, max: 8000 };

/* Cuánto puede alejarse el final de un tiro del centro medido del aro. */
const TOLERANCIA_ARO = 0.06;

/* Una edad donde debería haber un requisito previo (D9). */
const HUELE_A_EDAD = /\b(a[ñn]os?|benjam[ií]n|alev[ií]n|infantil|cadete|junior|escuela|prebenjam[ií]n|sub-?\d+|u\d{1,2})\b/i;

/* ---------- capa 1 · la ficha ---------------------------------- */

export function revisaFicha(f) {
  const errores = [];
  const avisos = [];
  const E = (m) => errores.push(m);
  const A = (m) => avisos.push(m);

  if (!f.name?.trim()) E('sin nombre');
  if (!f.description?.trim()) E('sin `description` (es lo que se ve en la tarjeta y puntúa en las sugerencias)');
  if (!f.objetivos?.trim()) E('sin `objetivos`: qué se entrena y para qué');
  if (!f.descripcion_texto?.trim()) E('sin `descripcion_texto`: organización y desarrollo');
  if (!f.notas?.trim()) E('sin `notas`: puntos clave y errores frecuentes');

  if (!TIPOS.includes(f.type)) E(`type "${f.type}" fuera del vocabulario del Taller`);
  if (!BLOQUE_KEYS.includes(f.category)) E(`category "${f.category}" no es un bloque de contenido`);
  if (!PISTAS.includes(f.tipo_pista)) E(`tipo_pista "${f.tipo_pista}" desconocido`);
  if (!RAMAS.includes(f.categoria_rama)) E(`categoria_rama "${f.categoria_rama}" desconocida`);

  for (const n of f.categoria_nivel || []) {
    if (!(NIVELES[f.categoria_rama] || []).includes(n)) E(`nivel "${n}" no pertenece a la rama ${f.categoria_rama}`);
  }

  if (!(f.difficulty >= 1 && f.difficulty <= 6)) E(`difficulty ${f.difficulty} fuera de 1-6`);
  if (!(f.intensidad >= 1 && f.intensidad <= 5)) E(`intensidad ${f.intensidad} fuera de 1-5`);
  if (!(f.duration_min > 0)) E('duration_min debe ser positiva');
  if (f.duration_max != null && f.duration_min != null && f.duration_max < f.duration_min) {
    E(`duración máxima (${f.duration_max}) menor que la mínima (${f.duration_min})`);
  }

  /* Tags: el campo de más palanca. Un tag fuera de vocabulario saca
     al ejercicio de las sugerencias del planificador (D16). */
  if (!f.tags?.length) E('sin tags — quedaría invisible para el planificador');
  for (const { tag, sugerencia } of tagsDesconocidos(f.tags)) {
    E(`tag "${tag}" fuera del vocabulario${sugerencia ? ` — ¿querías "${sugerencia}"?` : ''}`);
  }

  /* Los tres niveles de exigencia (D8): es lo que sustituye a la edad. */
  const v = f.variantes || '';
  const faltan = NIVELES_EXIGENCIA.filter((n) => !new RegExp(n, 'i').test(v));
  if (faltan.length) E(`faltan niveles de exigencia en \`variantes\`: ${faltan.join(', ')} (D8)`);

  /* Requisitos. */
  const r = f.requisitos;
  if (!r || typeof r !== 'object') {
    E('sin `requisitos`');
  } else {
    for (const campo of REQUISITOS_OBLIGATORIOS) {
      if (r[campo] === undefined || r[campo] === null || r[campo] === '') E(`requisitos.${campo} vacío`);
    }
    for (const { campo, cuando, porque } of REQUISITOS_CONDICIONALES) {
      if (cuando(r, f.tags) && !r[campo]) E(`requisitos.${campo} es obligatorio aquí — ${porque}`);
    }
    if (r.densidad && !DENSIDAD_KEYS.includes(r.densidad)) E(`densidad "${r.densidad}" desconocida`);
    if (r.oposicion && !OPOSICION.includes(r.oposicion)) E(`oposicion "${r.oposicion}" fuera de la escala de D19`);
    if (r.jugadores_min > r.jugadores_max) E(`jugadores_min (${r.jugadores_min}) mayor que jugadores_max (${r.jugadores_max})`);
    if (r.canastas > 2) E(`canastas ${r.canastas}: el entrenador dispone de 2`);

    /* D9 · el "desde cuándo" es un requisito, jamás una edad. */
    if (typeof r.requisito_previo === 'string' && HUELE_A_EDAD.test(r.requisito_previo)) {
      E(`requisito_previo menciona una edad o categoría ("${r.requisito_previo}") — D9 pide saber hacer, no cumplir años`);
    }

    /* D5 · con dos canastas y pista entera no hay excusa para una cola larga. */
    const porEstacion = r.jugadores_max / Math.max(1, r.estaciones || 1);
    if (r.oposicion === 'nula' && porEstacion > 8) {
      A(`${r.jugadores_max} jugadores sin oposición y sin declarar estaciones: revisa que no salgan filas de más de 4 (D5)`);
    }

    /* La dosis tiene que caber en la duración declarada. */
    const d = r.dosis;
    if (d && f.duration_max) {
      const seg = (Number(d.series) || 1) * ((Number(d.repeticiones) || 0) * 4 + (Number(d.descanso) || 0));
      if (seg > f.duration_max * 60 * 1.5) {
        A(`la dosis (${d.series}x${d.repeticiones}, ${d.descanso}s) no cabe en ${f.duration_max} min`);
      }
    }
  }

  /* D1 · el analítico introduce, el juego consolida. */
  if ((f.tags || []).includes('analítico') && r?.oposicion === 'real') {
    A('etiquetado como analítico pero con oposición real: revisa la clasificación');
  }

  return { errores, avisos };
}

/* ---------- capa 2 · la geometría ------------------------------ */

export function revisaGeometria(f) {
  const errores = [];
  const avisos = [];
  const a = f.animacion;

  if (!a) { avisos.push('sin animación (montaje pendiente)'); return { errores, avisos }; }
  if (a.pista && a.pista !== f.tipo_pista) errores.push(`la animación es de pista "${a.pista}" y la ficha dice "${f.tipo_pista}"`);

  const fuera = [];
  const mira = (p, qué) => {
    if (!p) return;
    const [x, y] = Array.isArray(p) ? p : [p.x, p.y];
    if (!dentro(x) || !dentro(y)) fuera.push(`${qué} en (${Number(x).toFixed(2)}, ${Number(y).toFixed(2)})`);
  };

  for (const j of a.jugadores || []) mira(j.posicion_inicial, `jugador ${j.id}`);
  for (const c of a.conos || []) mira(c.posicion, `cono ${c.id}`);
  for (const b of a.balones || []) mira(b.posicion_inicial, `balón ${b.id}`);

  /* Jugadores encimados en la salida: se pintan uno sobre otro. */
  const js = a.jugadores || [];
  for (let i = 0; i < js.length; i++) {
    for (let k = i + 1; k < js.length; k++) {
      const [x1, y1] = js[i].posicion_inicial || [];
      const [x2, y2] = js[k].posicion_inicial || [];
      if (x1 == null || x2 == null) continue;
      if (Math.hypot(x1 - x2, y1 - y2) < SEPARACION_MINIMA) {
        avisos.push(`${js[i].id} y ${js[k].id} salen prácticamente encima`);
      }
    }
  }

  /* Conos de fila sin configurar: la cola no se dibuja. */
  for (const c of a.conos || []) {
    if (c.funcion === 'fila' && !c.fila_config) errores.push(`cono ${c.id} es de fila y no tiene fila_config`);
  }

  const aro = aroExacto(a.pista || f.tipo_pista, a.canasta || 'norte');

  for (const fase of a.fases || []) {
    if (!(fase.duracion_ms >= FASE_MS.min && fase.duracion_ms <= FASE_MS.max)) {
      errores.push(`${fase.id}: duración ${fase.duracion_ms} ms fuera de ${FASE_MS.min}-${FASE_MS.max}`);
    }
    for (const m of fase.movimientos || []) {
      for (const n of m.path || []) mira(n, `${fase.id} · path de ${m.elemento_id}`);
      if ((m.path || []).length < 2) errores.push(`${fase.id}: movimiento de ${m.elemento_id} con menos de dos nodos`);
    }
    for (const p of fase.pases || []) {
      for (const n of p.path || []) mira(n, `${fase.id} · pase ${p.id}`);
      if (p.de_id === p.a_id) errores.push(`${fase.id}: ${p.de_id} se pasa el balón a sí mismo`);
    }
    /* Los tiros tienen que acabar en el aro MEDIDO de esa pista. Es la
       comprobación que cazó el bug histórico de "todas las pistas
       iguales": en las medias el aro está a la izquierda, no arriba. */
    for (const t of fase.tiros || []) {
      const fin = (t.path || []).at(-1);
      if (!fin || !aro) continue;
      const d = Math.hypot(fin.x - aro[0], fin.y - aro[1]);
      if (d > TOLERANCIA_ARO) {
        errores.push(`${fase.id}: el tiro acaba a ${d.toFixed(3)} del aro (tope ${TOLERANCIA_ARO})`);
      }
    }
  }

  if (fuera.length) errores.push(`fuera de la pista: ${fuera.slice(0, 5).join('; ')}${fuera.length > 5 ? ` y ${fuera.length - 5} más` : ''}`);

  return { errores, avisos };
}

/* ---------- capa 3 · el conjunto -------------------------------- */

const clave = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function revisaConjunto(fichas) {
  const errores = [...revisarInvariantes(fichas)];
  const avisos = [];

  /* Duplicados encubiertos: el mismo ejercicio con dos nombres. */
  const vistos = new Map();
  for (const f of fichas) {
    const k = clave(f.name);
    if (vistos.has(k)) errores.push(`nombre duplicado: "${f.name}" y "${vistos.get(k)}"`);
    else vistos.set(k, f.name);
  }

  for (const h of huecos(fichas)) {
    if (h.faltan) avisos.push(`${h.bloque}: ${h.tiene}/${h.objetivo} (faltan ${h.faltan})`);
    if (h.tiene && h.contenidosSinCubrir.length) {
      avisos.push(`${h.bloque}: sin cubrir → ${h.contenidosSinCubrir.join(', ')}`);
    }
  }

  return { errores, avisos };
}

/* ---------- informe --------------------------------------------- */

export function lint(fichas) {
  const porFicha = fichas.map((f, i) => {
    const a = revisaFicha(f);
    const b = revisaGeometria(f);
    return { i, nombre: f.name || `(ficha ${i + 1})`, errores: [...a.errores, ...b.errores], avisos: [...a.avisos, ...b.avisos] };
  });
  const conjunto = revisaConjunto(fichas);
  const nErrores = porFicha.reduce((n, f) => n + f.errores.length, 0) + conjunto.errores.length;
  const nAvisos = porFicha.reduce((n, f) => n + f.avisos.length, 0) + conjunto.avisos.length;
  return { porFicha, conjunto, nErrores, nAvisos };
}

/* ---------- CLI --------------------------------------------------- */

/* Rutas resueltas, no cadenas: en Windows conviven las dos barras. */
const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) {
  const errMapa = validarMapa();
  if (errMapa.length) {
    console.error('El mapa de cobertura está mal:\n' + errMapa.map((e) => '  · ' + e).join('\n'));
    process.exit(1);
  }

  const ruta = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
  if (!ruta) {
    console.error('Uso: node tools/biblioteca/lint.mjs <fichas.json> [--solo-errores]');
    console.error(`Mapa: ${MAPA.length} bloques, ${OBJETIVO_TOTAL} ejercicios objetivo.`);
    process.exit(1);
  }

  const datos = JSON.parse(readFileSync(ruta, 'utf8'));
  const fichas = Array.isArray(datos) ? datos : (datos.fichas || datos.datos || []);
  const r = lint(fichas);
  const soloErrores = process.argv.includes('--solo-errores');

  console.log(`\n${fichas.length} ficha(s) · ${r.nErrores} error(es) · ${r.nAvisos} aviso(s)\n`);

  for (const f of r.porFicha) {
    if (!f.errores.length && (soloErrores || !f.avisos.length)) continue;
    console.log(`  ${f.nombre}`);
    for (const e of f.errores) console.log(`    ERROR  ${e}`);
    if (!soloErrores) for (const a of f.avisos) console.log(`    aviso  ${a}`);
    console.log('');
  }

  if (r.conjunto.errores.length || (!soloErrores && r.conjunto.avisos.length)) {
    console.log('  — conjunto de la biblioteca —');
    for (const e of r.conjunto.errores) console.log(`    ERROR  ${e}`);
    if (!soloErrores) for (const a of r.conjunto.avisos) console.log(`    aviso  ${a}`);
    console.log('');
  }

  process.exit(r.nErrores ? 1 : 0);
}
