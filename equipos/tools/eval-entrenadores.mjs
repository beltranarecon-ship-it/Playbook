/* ============================================================
   eval-entrenadores.mjs — banco del cuadro técnico de un equipo
   (equipos/js/data/entrenadores.js). Sin red, sin DOM.

     node equipos/tools/eval-entrenadores.mjs

   ── QUÉ ESTÁ EN JUEGO ───────────────────────────────────────
   Una sola cosa, y es grande: quitar al ÚLTIMO entrenador de un equipo
   no lo deja sin entrenador, lo hace DESAPARECER. `getMisEquipos`
   descarta los equipos con el cuadro vacío, así que el equipo se cae de
   la lista de todo el mundo —incluida la propia pantalla de
   administración desde la que se acaba de quitar— y a partir de ahí
   solo se recupera desde el editor SQL de Supabase.

   La base de datos NO lo impide: la policy de team_coaches (007) mira
   si eres admin, no cuántos quedan. Esta regla es lo único que hay
   entre un clic y un equipo perdido, así que se comprueba aquí.
   ============================================================ */

import {
  ROLES, ROL_LABEL, rolValido, yaEsta, puedeQuitar, puedeAñadir,
  candidatos, nombreDe, ordenarCuadro,
} from '../js/data/entrenadores.js';

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

const c = (id, rol = 'principal', nombre = id) => ({ coach_id: id, rol, nombre });

/* ── 1. El último no se quita ──────────────────────────────── */

console.log('\n· quitar entrenadores');

test('con dos, se puede quitar a cualquiera', () => {
  const cuadro = [c('a'), c('b', 'ayudante')];
  ok(puedeQuitar(cuadro, 'a').ok, 'no deja quitar al principal habiendo otro');
  ok(puedeQuitar(cuadro, 'b').ok, 'no deja quitar al ayudante');
});

test('al ÚLTIMO no, y se dice la CONSECUENCIA', () => {
  const r = puedeQuitar([c('a')], 'a');
  eq(r.ok, false);
  ok(/desaparece/.test(r.porque), `el motivo no dice qué pasa: «${r.porque}»`);
  ok(/base de datos|Añade antes/.test(r.porque), `no dice cómo salir: «${r.porque}»`);
});

test('a uno que no está tampoco', () => {
  eq(puedeQuitar([c('a'), c('b')], 'z').ok, false);
});

test('un cuadro vacío o roto no revienta ni autoriza', () => {
  for (const v of [null, undefined, [], [null], [undefined]]) {
    eq(puedeQuitar(v, 'a').ok, false, JSON.stringify(v));
  }
});

test('los huecos del array no cuentan como entrenadores', () => {
  /* Si contaran, un cuadro de [uno, null] dejaría quitar al único: la
     lista mediría dos y el equipo se caería igual. */
  const r = puedeQuitar([c('a'), null, undefined], 'a');
  eq(r.ok, false, 'ha contado los huecos:');
});

/* ── 2. Añadir ─────────────────────────────────────────────── */

console.log('\n· añadir entrenadores');

test('uno nuevo entra, con cualquiera de los dos papeles', () => {
  const cuadro = [c('a')];
  for (const rol of ROLES) ok(puedeAñadir(cuadro, 'b', rol).ok, rol);
});

test('repetir no: la tabla tiene UNIQUE (team_id, coach_id)', () => {
  const r = puedeAñadir([c('a')], 'a', 'ayudante');
  eq(r.ok, false);
  ok(/Ya está/.test(r.porque), r.porque);
});

test('un papel inventado no llega a la base', () => {
  /* El CHECK de la 007 lo rechazaría con un mensaje de Postgres en
     inglés; mejor pararlo aquí. */
  for (const rol of ['jefe', '', null, undefined, 'PRINCIPAL']) {
    eq(puedeAñadir([], 'b', rol).ok, false, String(rol));
  }
});

test('sin elegir a nadie, no se añade nada', () => {
  eq(puedeAñadir([c('a')], null, 'ayudante').ok, false);
  eq(puedeAñadir([c('a')], '', 'ayudante').ok, false);
});

test('un equipo huérfano SÍ admite el primero', () => {
  /* Es justo el caso que hay que poder arreglar desde la pantalla. */
  ok(puedeAñadir([], 'a', 'principal').ok);
});

/* ── 3. A quién se puede añadir ────────────────────────────── */

console.log('\n· la lista de candidatos');

test('salen los del club que no están ya, ordenados por nombre', () => {
  const perfiles = [
    { id: 'c', full_name: 'Zoe' },
    { id: 'a', full_name: 'Ana' },
    { id: 'b', full_name: 'Beltrán' },
  ];
  const r = candidatos(perfiles, [c('a')]);
  eq(r.map((p) => p.id), ['b', 'c']);
});

test('se ordena en castellano', () => {
  const r = candidatos([{ id: '1', full_name: 'Zulema' }, { id: '2', full_name: 'Ángel' }], []);
  eq(r.map((p) => p.full_name), ['Ángel', 'Zulema'], 'la Á no se ha ordenado como A:');
});

test('no se modifica la lista que llega', () => {
  const perfiles = [{ id: 'b', full_name: 'B' }, { id: 'a', full_name: 'A' }];
  candidatos(perfiles, []);
  eq(perfiles.map((p) => p.id), ['b', 'a'], 'ha ordenado el original:');
});

test('sin perfiles o sin cuadro no revienta', () => {
  eq(candidatos(null, null), []);
  eq(candidatos([], [c('a')]), []);
  eq(candidatos([{ id: 'a' }], null).length, 1);
});

/* ── 4. Quien no puso su nombre ────────────────────────────── */

console.log('\n· nombres que faltan');

test('sin nombre se distingue por el principio del id', () => {
  /* `full_name` es NULLABLE (001) y hay cuentas recién invitadas que no
     lo han puesto. Un desplegable con filas vacías no se puede usar. */
  const n = nombreDe({ id: '3f2a1b7c-0000-0000-0000-000000000000' });
  ok(/Sin nombre/.test(n), n);
  ok(/3f2a1b7c/.test(n), `no se puede distinguir de otra: «${n}»`);
});

test('un nombre en blanco cuenta como que no lo hay', () => {
  ok(/Sin nombre/.test(nombreDe({ id: 'aaaaaaaa-bbbb', full_name: '   ' })));
});

test('con nombre, el nombre y sin espacios de más', () => {
  eq(nombreDe({ id: 'x', full_name: '  Beltrán  ' }), 'Beltrán');
});

test('sin perfil no revienta', () => {
  eq(nombreDe(null), 'Sin nombre');
  eq(nombreDe({}), 'Sin nombre');
});

/* ── 5. El orden en que se lee ─────────────────────────────── */

console.log('\n· cómo se ordena el cuadro');

test('los principales delante y después por nombre', () => {
  const r = ordenarCuadro([
    c('3', 'ayudante', 'Ana'),
    c('1', 'principal', 'Zoe'),
    c('2', 'principal', 'Beltrán'),
  ]);
  eq(r.map((x) => x.nombre), ['Beltrán', 'Zoe', 'Ana']);
});

test('no toca el original y aguanta los huecos', () => {
  const cuadro = [c('2', 'ayudante', 'B'), null, c('1', 'principal', 'A')];
  const r = ordenarCuadro(cuadro);
  eq(r.length, 2, 'ha colado un hueco:');
  eq(cuadro[0].nombre, 'B', 'ha ordenado el original:');
});

test('las etiquetas están para los dos papeles', () => {
  for (const rol of ROLES) ok(ROL_LABEL[rol], rol);
  ok(rolValido('principal') && rolValido('ayudante'));
  eq(rolValido('otro'), false);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
