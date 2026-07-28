/* ============================================================
   eval-sugerencias.mjs — banco Node del motor puro de sugerencias
   y herencia (equipos/js/data/sugerencias.js). Sin red, sin DOM.
   Ejecutar desde la raíz de cbp-v2:
     node equipos/tools/eval-sugerencias.mjs
   ============================================================ */

import {
  normaliza, tokeniza, sugerirEjercicios, objetivosEnFecha, tituloHeredado,
} from '../js/data/sugerencias.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try {
    fn();
    pasan++; console.log(`  ✓ ${nombre}`);
  } catch (e) {
    fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`);
  }
}
function eq(real, esperado, msg = '') {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
}

// ── Biblioteca de prueba ─────────────────────────────────────
const EJ = (id, name, type, extra = {}) => ({
  id, name, type,
  category: extra.category ?? null,
  description: extra.description ?? '',
  tags: extra.tags ?? [],
  is_archived: extra.is_archived ?? false,
});

const BIBLIOTECA = [
  EJ('a1', 'Rueda de entradas', 'técnico', { category: 'ataque', tags: ['entradas', 'bandeja'] }),
  EJ('b2', '1c1 desde el codo', 'técnico', { category: 'ataque', tags: ['1c1'], description: 'uno contra uno con salida de bote' }),
  EJ('c3', 'Defensa del bloqueo directo', 'táctico', { category: 'defensa', tags: ['bloqueo directo', 'pick and roll'] }),
  EJ('d4', 'Salida de presión 2-1', 'táctico', { category: 'transición', description: 'romper la presión a toda pista' }),
  EJ('e5', 'Circuito de fuerza', 'físico', { tags: ['fuerza', 'core'] }),
  EJ('f6', 'Juego de los 10 pases', 'juego', { tags: ['pase'], description: 'juego de pases sin bote' }),
  EJ('g7', 'Tiro tras bote', 'técnico', { category: 'ataque', tags: ['tiro'], is_archived: true }),
  EJ('h8', 'Antesala del tiro', 'técnico', { category: 'ataque', tags: ['tiro'] }),
  EJ('i9', 'Bote de velocidad', 'técnico', { category: 'ataque', tags: ['bote'] }),
];

console.log('· normaliza / tokeniza');

test('normaliza quita tildes y mayúsculas', () => {
  eq(normaliza('Técnico Fïsico ÑU'), 'tecnico fisico nu');
});

test('tokeniza filtra stopwords y cortas, conserva términos con dígito', () => {
  eq(tokeniza('Mejorar el 1c1 y la salida de bote'), ['1c1', 'salida', 'bote']);
});

test('tokeniza no duplica tokens', () => {
  eq(tokeniza('tiro tiro TIRO'), ['tiro']);
});

console.log('· sugerirEjercicios');

test('coincidencia de type sola puntúa 2 y entra en la lista', () => {
  const r = sugerirEjercicios({ titulo: 'zzz', categoria: 'físico' }, BIBLIOTECA);
  eq(r.map((x) => x.ejercicio.id), ['e5'], 'solo el físico;');
  eq(r[0].score, 2, 'score base;');
});

test('los tokens del título mandan: tag+nombre+type gana', () => {
  const r = sugerirEjercicios({ titulo: 'El 1c1 con bote', categoria: 'técnico' }, BIBLIOTECA);
  // b2: type(2) + tag 1c1(3) + nombre 1c1(2) + desc bote... = el primero
  eq(r[0].ejercicio.id, 'b2');
});

test('category del ejercicio también puntúa (defensa)', () => {
  const r = sugerirEjercicios({ titulo: 'defensa del bloqueo', categoria: 'táctico' }, BIBLIOTECA);
  eq(r[0].ejercicio.id, 'c3');
});

test('archivados nunca se sugieren', () => {
  const r = sugerirEjercicios({ titulo: 'tiro', categoria: 'técnico' }, BIBLIOTECA, { limite: 20 });
  eq(r.some((x) => x.ejercicio.id === 'g7'), false);
});

test('empate → orden alfabético por nombre normalizado', () => {
  const r = sugerirEjercicios({ titulo: 'zzz', categoria: 'técnico' }, BIBLIOTECA, { limite: 20 });
  // todos los técnicos no archivados empatan a 2 → orden por nombre
  eq(r.map((x) => x.ejercicio.id), ['b2', 'h8', 'i9', 'a1']);
});

test('determinista: dos llamadas idénticas, mismo resultado', () => {
  const o = { titulo: 'salida de presión', categoria: 'táctico' };
  eq(sugerirEjercicios(o, BIBLIOTECA), sugerirEjercicios(o, BIBLIOTECA));
});

test('limite respetado', () => {
  const r = sugerirEjercicios({ titulo: '', categoria: 'técnico' }, BIBLIOTECA, { limite: 2 });
  eq(r.length, 2);
});

test('sin categoría ni tokens → sin sugerencias (score < 2)', () => {
  eq(sugerirEjercicios({ titulo: '', categoria: null }, BIBLIOTECA), []);
});

test('un juego entra por tokens aunque el type no case', () => {
  const r = sugerirEjercicios({ titulo: 'línea de pase', categoria: 'táctico' }, BIBLIOTECA, { limite: 20 });
  eq(r.some((x) => x.ejercicio.id === 'f6'), true);
});

test('type LIBRE del taller ("Tiro", "1vs1") matchea por token normalizado', () => {
  const libres = [
    EJ('x1', 'Flecha de tiro', 'Tiro'),
    EJ('x2', 'o-', '1vs1'),
    EJ('x3', 'tt', 'técnico'),
  ];
  const r1 = sugerirEjercicios({ titulo: 'Mejorar el tiro', categoria: 'técnico' }, libres, { limite: 20 });
  // x1: type 'tiro' token(2) + nombre(2) = 4 → primero; x3: base técnico = 2
  eq(r1.map((x) => x.ejercicio.id), ['x1', 'x3']);
  const r2 = sugerirEjercicios({ titulo: 'el 1vs1 agresivo', categoria: 'técnico' }, libres, { limite: 20 });
  eq(r2[0].ejercicio.id, 'x2', '1vs1 por type;');
});

console.log('· objetivosEnFecha / tituloHeredado');

const OBJS = [
  { id: 'o1', team_id: 'T1', titulo: 'Salida de presión', estado: 'activo', fecha_inicio: '2026-01-12', fecha_fin: '2026-01-25' },
  { id: 'o2', team_id: 'T1', titulo: 'Bote fuerte', estado: 'conseguido', fecha_inicio: '2026-01-20', fecha_fin: '2026-02-02' },
  { id: 'o3', team_id: 'T1', titulo: 'Descartado', estado: 'archivado', fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31' },
  { id: 'o4', team_id: 'T2', titulo: 'Rebote', estado: 'activo', fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31' },
];

test('bordes inclusivos del rango', () => {
  eq(objetivosEnFecha('2026-01-12', OBJS).map((o) => o.id), ['o1', 'o4'], 'inicio;');
  eq(objetivosEnFecha('2026-01-25', OBJS).map((o) => o.id), ['o1', 'o2', 'o4'], 'fin;');
  eq(objetivosEnFecha('2026-01-11', OBJS).map((o) => o.id), ['o4'], 'víspera;');
});

test('archivados fuera; conseguidos dentro', () => {
  const ids = objetivosEnFecha('2026-01-22', OBJS).map((o) => o.id);
  eq(ids.includes('o3'), false, 'archivado;');
  eq(ids.includes('o2'), true, 'conseguido;');
});

test('solape: una fecha puede heredar varios objetivos', () => {
  eq(objetivosEnFecha('2026-01-22', OBJS).filter((o) => o.team_id === 'T1').length, 2);
});

test('tituloHeredado respeta titulo propio y filtra por equipo', () => {
  eq(tituloHeredado({ titulo: 'Mi título', fecha: '2026-01-22', team_id: 'T1' }, OBJS), 'Mi título', 'propio;');
  eq(tituloHeredado({ titulo: null, fecha: '2026-01-22', team_id: 'T1' }, OBJS), 'Salida de presión · Bote fuerte', 'herencia;');
  eq(tituloHeredado({ titulo: null, fecha: '2026-01-22', team_id: 'T2' }, OBJS), 'Rebote', 'otro equipo;');
  eq(tituloHeredado({ titulo: null, fecha: '2026-06-01', team_id: 'T2' }, OBJS), null, 'sin objetivos;');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
