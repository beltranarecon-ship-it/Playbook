/* ============================================================
   eval-guardar-video.mjs — banco Node de la fila que lleva un
   ejercicio de dev/ejercicios-video.js a `exercises`
   (tools/biblioteca/fila-video.mjs). SIN RED: lo que habla con
   Supabase es guardar-video.mjs, y aquí no se carga.

     node tools/eval-guardar-video.mjs

   Lo que vigila:
     1. Que la fila trae las columnas de `guardarEjercicio`, ni una más,
        con los valores de la ficha y las reglas de `aRegistro`.
     2. Que el dibujo se hace y compila SIN AVISOS.
     3. Que una ficha con errores de linter no se guarda.
     4. Que un nombre repetido aborta el alta, y que corregir exige uno.
     5. Que no se inventa nada que la ficha no traiga.
   ============================================================ */

const { EJERCICIOS_DE_VIDEO } = await import('../dev/ejercicios-video.js');
const {
  COLUMNAS_ALTA, preparar, decidir, elegir, camposDeActualizacion,
} = await import('./biblioteca/fila-video.mjs');
const { compilar } = await import('../taller/js/pizarra/motor/compilar.js');
const { MARCO_ACTUAL } = await import('../taller/js/canvas/marco-lectura.js');

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  if (JSON.stringify(real) !== JSON.stringify(esp)) {
    throw new Error(`${msg} esperado=${JSON.stringify(esp)} real=${JSON.stringify(real)}`);
  }
};

const V1 = EJERCICIOS_DE_VIDEO[0];
const AUTOR = '00000000-0000-0000-0000-000000000001';
/* El mismo ejercicio con la ficha cambiada: el dibujo no se toca. */
const conFicha = (cambia) => ({ ...V1, ficha: cambia(JSON.parse(JSON.stringify(V1.ficha))) });

console.log('\n· la fila de V1');

const p = preparar(V1, { autor: AUTOR });

/* Solo los ERRORES: un aviso del linter (p. ej. alguien quieto en una
   fase) puede ser legítimo y no impide guardar. */
test('V1 sale sin errores del linter ni del dibujo', () => {
  eq(p.errores, [], 'errores:');
});

test('trae exactamente las columnas de guardarEjercicio, en su orden', () => {
  eq(Object.keys(p.fila), COLUMNAS_ALTA);
  ok(!('poster' in p.fila) && !('thumbnail' in p.fila), 'sin miniatura: la columna se queda como esté por defecto');
});

test('los valores salen de la ficha, con las reglas de aRegistro', () => {
  const f = V1.ficha;
  eq(p.fila.name, f.name);
  eq([p.fila.type, p.fila.category, p.fila.tipo_pista, p.fila.categoria_rama], [f.type, f.category, f.tipo_pista, f.categoria_rama]);
  eq([p.fila.difficulty, p.fila.intensidad, p.fila.duration_min, p.fila.duration_max], [f.difficulty, f.intensidad, f.duration_min, f.duration_max]);
  eq(p.fila.dificultad_label, 'Medio', 'dificultad 3 es «Medio» (config.js#dificultadDe):');
  eq(p.fila.tags, f.tags);
  eq(p.fila.requisitos, f.requisitos, 'los requisitos, tal cual:');
  eq([p.fila.description, p.fila.objetivos, p.fila.notas, p.fila.descripcion_texto], [f.description, f.objetivos, f.notas, f.descripcion_texto]);
  eq([p.fila.created_by, p.fila.autor_nombre, p.fila.favorito, p.fila.marco], [AUTOR, null, false, MARCO_ACTUAL]);
});

test('la animación es la jugada compilada, sin avisos y con su frase', () => {
  eq(p.animacion.warnings, [], 'avisos de compilar:');
  eq(p.fila.animacion, compilar(p.jugada), 'la fila lleva la compilación de su propia jugada:');
  eq(p.fila.jugada, p.jugada);
  eq([p.jugada.version, p.jugada.pista, p.animacion.pista], [3, 'media', 'media']);
  ok(p.animacion.fases.length >= 1 && p.animacion.fases.every((f) => f.duracion_ms > 0 && f.frase.length > 3), 'cada fase dura algo y se cuenta');
  ok(p.jugada.fases.some((f) => f.tramos.length), 'hay algo dibujado');
});

console.log('\n· lo que no se guarda');

test('una ficha con errores de linter se rechaza, y dice cuáles', () => {
  const malo = preparar(conFicha((f) => { delete f.description; f.tags = [...f.tags, 'pasecito']; return f; }));
  ok(malo.errores.some((e) => /sin `description`/.test(e)), `falta description: ${malo.errores}`);
  ok(malo.errores.some((e) => /tag "pasecito"/.test(e)), `tag fuera de vocabulario: ${malo.errores}`);
});

test('un campo de la ficha que la app no guarda se rechaza en vez de perderse', () => {
  const r = preparar(conFicha((f) => ({ ...f, variantes: 'con dos balones' })));
  ok(r.errores.some((e) => /variantes/.test(e)), `${r.errores}`);
});

test('una ficha que dice otra pista que el dibujo se rechaza', () => {
  const r = preparar(conFicha((f) => ({ ...f, tipo_pista: 'entera' })));
  ok(r.errores.some((e) => /pista/.test(e)), `${r.errores}`);
});

test('no se inventa lo que la ficha no trae: sin duración máxima va a null, no a 20', () => {
  const r = preparar(conFicha((f) => { delete f.duration_max; delete f.autor_nombre; return f; }));
  eq(r.fila.duration_max, null);
  eq(r.fila.autor_nombre, null);
});

test('la etiqueta de dificultad la decide aRegistro, no la ficha', () => {
  eq(preparar(conFicha((f) => ({ ...f, difficulty: 5 }))).fila.dificultad_label, 'Avanzado');
  eq(preparar(conFicha((f) => ({ ...f, difficulty: 2 }))).fila.dificultad_label, 'Iniciación');
});

console.log('\n· el nombre frente a la base');

const NOMBRE = V1.ficha.name;

test('un nombre que ya está aborta el alta, aunque cambien mayúsculas o espacios', () => {
  const d = decidir(NOMBRE, [{ id: 'e1', name: `  ${NOMBRE.toUpperCase().replace(/ /g, '  ')} ` }]);
  eq(d.accion, 'abortar');
  ok(/--actualizar/.test(d.motivo), `dice cómo corregirlo: ${d.motivo}`);
});

test('un nombre nuevo se da de alta', () => {
  eq(decidir(NOMBRE, [{ id: 'e1', name: 'Otro ejercicio' }]), { accion: 'alta' });
  eq(decidir(NOMBRE, []), { accion: 'alta' });
});

test('--actualizar corrige el que hay, por su id', () => {
  eq(decidir(NOMBRE, [{ id: 'e1', name: 'Otro' }, { id: 'e7', name: NOMBRE }], { actualizar: true }),
    { accion: 'actualizar', id: 'e7', nombreEnBase: NOMBRE });
});

test('--actualizar sin ninguno, o con dos iguales, aborta', () => {
  eq(decidir(NOMBRE, [], { actualizar: true }).accion, 'abortar');
  eq(decidir(NOMBRE, [{ id: 'a', name: NOMBRE }, { id: 'b', name: NOMBRE.toLowerCase() }], { actualizar: true }).accion, 'abortar');
});

test('corregir no toca autor ni favorito, y deja la miniatura para regenerar', () => {
  const c = camposDeActualizacion(p.fila);
  ok(!('created_by' in c) && !('favorito' in c), 'sin autor ni favorito');
  eq([c.poster, c.thumbnail], [null, null]);
  const { created_by: _a, favorito: _f, ...resto } = p.fila;
  eq({ ...c, poster: undefined, thumbnail: undefined }, resto, 'el resto, igual que el alta:');
});

console.log('\n· elegir el ejercicio');

test('sin selector, el único; por código sin mayúsculas; uno que no está, lanza', () => {
  eq(elegir([V1]).nombre, V1.nombre);
  eq(elegir(EJERCICIOS_DE_VIDEO, 'v1').nombre, V1.nombre);
  eq(elegir(EJERCICIOS_DE_VIDEO, V1.ficha.name).nombre, V1.nombre);
  let lanzo = false;
  try { elegir(EJERCICIOS_DE_VIDEO, 'V99'); } catch { lanzo = true; }
  ok(lanzo, 'V99 no existe');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
