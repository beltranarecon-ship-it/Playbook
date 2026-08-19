/* ============================================================
   eval-borradores.mjs — banco Node de los borradores compartidos
   (taller/js/borradores.js). Sin red, sin DOM: se le pone un
   `localStorage` de mentira, que es todo lo que el módulo toca.

     node taller/tools/eval-borradores.mjs

   Lo que vigila: que un borrador NUNCA pise lo guardado por su cuenta.
   Perder media sesión escrita es malo; que un borrador de hace tres
   semanas sobrescriba el plan bueno es peor, porque eso no se nota
   hasta que ya no hay nada que recuperar.
   ============================================================ */

/* localStorage de mentira, antes de importar el módulo. */
const almacen = new Map();
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
  get length() { return almacen.size; },
  key: (i) => [...almacen.keys()][i] ?? null,
};
// Object.keys(localStorage) tiene que devolver las claves, como en el navegador
globalThis.localStorage = new Proxy(globalThis.localStorage, {
  ownKeys: () => [...almacen.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

const {
  DIAS_VIDA, claveEjercicio, claveSesion,
  guardar, leer, borrar, estaViejo, hayQueOfrecer, fechaDe, limpiarViejos,
} = await import('../js/borradores.js');

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

const DIA = 86400000;
const AHORA = Date.UTC(2026, 9, 15, 19, 0, 0);

/* ── 1. Las claves ─────────────────────────────────────────── */

console.log('\n· las claves');

test('un ejercicio nuevo y uno que se está corrigiendo NO comparten borrador', () => {
  /* Antes había una sola clave: empezar un ejercicio nuevo pisaba el
     borrador de la corrección que estaba a medias. */
  ok(claveEjercicio() !== claveEjercicio('abc'), `${claveEjercicio()} vs ${claveEjercicio('abc')}`);
  eq(claveEjercicio(), 'cbp_borrador_ejercicio');
  eq(claveEjercicio('abc'), 'cbp_borrador_ejercicio:abc');
});

test('ni dos sesiones distintas', () => {
  ok(claveSesion('s1') !== claveSesion('s2'));
});

/* ── 2. Guardar y leer ─────────────────────────────────────── */

console.log('\n· guardar y leer');

test('lo guardado vuelve con su fecha', () => {
  almacen.clear();
  ok(guardar('k', { titulo: 'Plan del martes' }));
  const b = leer('k');
  eq(b.titulo, 'Plan del martes');
  ok(Number.isFinite(b.fecha), 'lleva fecha');
});

test('leer lo que no existe, o basura, no revienta', () => {
  eq(leer('no_existe'), null);
  almacen.set('roto', '{{{');
  eq(leer('roto'), null);
});

test('borrar borra', () => {
  guardar('k2', { a: 1 });
  borrar('k2');
  eq(leer('k2'), null);
});

/* ── 3. Cuándo se ofrece ───────────────────────────────────── */

console.log('\n· cuándo se ofrece');

const B = (datos, dias = 0) => ({ ...datos, fecha: AHORA - dias * DIA });

test('un borrador de hace un mes ya no es «lo que estaba escribiendo»', () => {
  eq(DIAS_VIDA, 14);
  ok(!estaViejo(B({}, 13), AHORA));
  ok(estaViejo(B({}, 30), AHORA));
  ok(estaViejo(null, AHORA), 'sin fecha, viejo');
});

test('se ofrece cuando DIFIERE de lo guardado', () => {
  ok(hayQueOfrecer(B({ titulo: 'A' }), { titulo: 'B' }, { huella: (x) => x?.titulo, ahora: AHORA }));
});

test('y NO cuando dice lo mismo: un cartel que sale siempre no lo lee nadie', () => {
  ok(!hayQueOfrecer(B({ titulo: 'A' }), { titulo: 'A' }, { huella: (x) => x?.titulo, ahora: AHORA }));
});

test('nunca se ofrece uno viejo, aunque difiera', () => {
  /* Que un borrador de hace tres semanas sobrescriba el plan bueno es
     peor que perderlo: no se nota hasta que ya no hay nada que
     recuperar. */
  ok(!hayQueOfrecer(B({ titulo: 'A' }, 30), { titulo: 'B' }, { huella: (x) => x?.titulo, ahora: AHORA }));
});

test('ni uno vacío', () => {
  ok(!hayQueOfrecer(B({ bloques: [] }), { bloques: [{ x: 1 }] }, {
    tieneAlgo: (b) => b.bloques.length, ahora: AHORA,
  }));
});

test('si no se pueden comparar, se pregunta: mejor eso que perderlo', () => {
  const revienta = () => { throw new Error('no se puede'); };
  ok(hayQueOfrecer(B({ x: 1 }), {}, { huella: revienta, ahora: AHORA }));
});

test('sin borrador, no hay nada que ofrecer', () => {
  ok(!hayQueOfrecer(null, { a: 1 }, { ahora: AHORA }));
});

/* ── 4. La limpieza ────────────────────────────────────────── */

console.log('\n· la limpieza');

test('los caducados se van; los vivos se quedan', () => {
  almacen.clear();
  almacen.set('cbp_borrador_sesion:s1', JSON.stringify(B({ a: 1 }, 30)));
  almacen.set('cbp_borrador_sesion:s2', JSON.stringify(B({ a: 2 }, 2)));
  almacen.set('otra_cosa', JSON.stringify(B({ a: 3 }, 90)));
  eq(limpiarViejos({ ahora: AHORA }), 1);
  eq(leer('cbp_borrador_sesion:s1'), null);
  ok(leer('cbp_borrador_sesion:s2'), 'el de hace dos días se queda');
  ok(almacen.has('otra_cosa'), 'lo que no es nuestro no se toca');
});

test('la fecha se lee en castellano', () => {
  const t = fechaDe({ fecha: AHORA });
  ok(t && t.length > 4, t);
  eq(fechaDe({}), '');
  eq(fechaDe(null), '');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
