/* ============================================================
   eval-migraciones.mjs — banco Node del traductor de errores de
   migración (equipos/js/data/migraciones.js). Sin red, sin DOM.

     node equipos/tools/eval-migraciones.mjs

   Lo que vigila:

     1. Que un «Could not find the table …» se convierta en una frase
        que dice QUÉ migración falta y dónde. El error crudo de
        PostgREST no lo entiende nadie.
     2. Que NO se dé por ausente una tabla porque el error hablaba de
        otra. Apagar media pantalla por un error que iba de otra cosa
        es peor que el fallo original.
     3. Que un error que no tiene nada que ver con migraciones pase tal
        cual: inventarle un mensaje mejor esconde la causa de verdad.
   ============================================================ */

import { faltaTabla, tablaQueFalta, explica, TABLA_DE } from '../js/data/migraciones.js';

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

/* El error tal cual lo mandó Supabase el día que esto salió. */
const REAL = {
  code: 'PGRST205',
  message: "Could not find the table 'public.session_slot_exclusions' in the schema cache",
  details: null, hint: null,
};

console.log('\n· reconocer qué falta');

test('el error de verdad se reconoce', () => {
  ok(faltaTabla(REAL, 'session_slot_exclusions'), JSON.stringify(REAL));
  eq(tablaQueFalta(REAL), 'session_slot_exclusions');
});

test('y también el de Postgres a pelo', () => {
  const e = { code: '42P01', message: 'relation "public.partido_estadisticas" does not exist' };
  ok(faltaTabla(e, 'partido_estadisticas'));
  eq(tablaQueFalta(e), 'partido_estadisticas');
});

test('un error de OTRA tabla no da por ausente la nuestra', () => {
  /* El fallo que esto evita: apagar las exclusiones porque el acta se
     quejó de lo suyo. Se comprueba el NOMBRE, no solo el código. */
  ok(!faltaTabla(REAL, 'partido_estadisticas'), 'no debería reconocerla');
  ok(!faltaTabla({ code: '42P01', message: 'relation "public.avisos" does not exist' },
    'session_slot_exclusions'));
});

test('un error que no es de migración no se toca', () => {
  const e = { code: '23505', message: 'duplicate key value violates unique constraint' };
  eq(tablaQueFalta(e), null);
  eq(explica(e), 'duplicate key value violates unique constraint');
  eq(tablaQueFalta(null), null);
  eq(faltaTabla(null, 'avisos'), false);
  eq(faltaTabla(REAL, null), false);
});

console.log('\n· decirlo en castellano');

test('dice la migración, para qué es y que lo demás sigue', () => {
  const t = explica(REAL);
  ok(t.includes('018'), t);
  ok(/migraci[óo]n/i.test(t), t);
  ok(t.includes('Supabase'), t);
  ok(/todo lo dem[áa]s sigue/i.test(t), t);
  ok(!t.includes('schema cache'), 'no repite la jerga: ' + t);
});

test('y se puede decir qué se estaba intentando', () => {
  const t = explica(REAL, { queSeIntentaba: 'No se han guardado los horarios' });
  ok(t.startsWith('No se han guardado los horarios: falta aplicar la migración 018'), t);
});

test('todas las tablas del mapa saben decir su migración', () => {
  for (const [tabla, info] of Object.entries(TABLA_DE)) {
    const e = { code: 'PGRST205', message: `Could not find the table 'public.${tabla}' in the schema cache` };
    eq(tablaQueFalta(e), tabla, `no se reconoce ${tabla}:`);
    const t = explica(e);
    ok(t.includes(info.migracion), `${tabla} no nombra la ${info.migracion}: ${t}`);
    ok(t.includes(info.para), `${tabla} no dice para qué sirve: ${t}`);
  }
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
