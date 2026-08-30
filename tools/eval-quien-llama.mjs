/* ============================================================
   eval-quien-llama.mjs — banco de la guardia de las funciones de
   servidor (netlify/functions/_quien-llama.mjs). Sin red, sin DOM.

     node tools/eval-quien-llama.mjs

   ── POR QUÉ ESTE BANCO IMPORTA MÁS DE LO QUE PARECE ─────────
   De estas veinte líneas depende que el club siga recibiendo avisos.
   `avisos.mjs` la llama el PLANIFICADOR de Netlify cada diez minutos, y
   si la guardia se equivoca y lo toma por un desconocido, los avisos
   dejan de salir EN SILENCIO: nadie recibe un error, simplemente el
   móvil deja de sonar y pasan semanas hasta que alguien lo nota.

   Por eso la regla es «ante la duda, se deja pasar», y por eso está
   escrita aquí en forma de pruebas: para que nadie la endurezca luego
   creyendo que la está mejorando.

   El otro error —dejar entrar a un desconocido— cuesta cupo y que se
   vean tres recuentos. No puede acosar a nadie: el índice único de la
   031 hace que una segunda pasada seguida no tenga nada que mandar.
   ============================================================ */

import { comoLlaman, cuerpoDe } from '../netlify/functions/_quien-llama.mjs';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
/* Para las pruebas con `await` dentro. Con el `test` de arriba, una
   función async devuelve una promesa que nadie espera: la prueba
   contaría como pasada sin haberse ejecutado, y un fallo dentro sería
   un rechazo no capturado que ni siquiera sale por pantalla. */
async function testAsync(nombre, fn) {
  try { await fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  if (real !== esp) throw new Error(`${msg} esperado=${JSON.stringify(esp)} real=${JSON.stringify(real)}`);
};

/** Una petición de mentira con las cabeceras que se le digan. */
const peticion = (cabeceras = {}, cuerpo = undefined) => ({
  headers: { get: (k) => cabeceras[k.toLowerCase()] ?? null },
  json: async () => { if (cuerpo === undefined) throw new Error('no es JSON'); return cuerpo; },
});

const JWT = 'eyJhbGciOi.eyJzdWIiOi.firmafirma';

console.log('\n· el planificador entra siempre');

test('sin objeto de petición, es el planificador', () => {
  /* Así estaba escrito `avisos.mjs` hasta ahora: `handler()`, sin
     argumentos. Si esto devolviera «anonimo», la guardia apagaría los
     avisos el mismo día que se despliega. */
  eq(comoLlaman(undefined).quien, 'planificador');
  eq(comoLlaman(null).quien, 'planificador');
  eq(comoLlaman({}).quien, 'planificador', 'un objeto sin headers tampoco se puede interrogar');
  eq(comoLlaman({ headers: {} }).quien, 'planificador');
});

test('con next_run en el cuerpo, es el planificador', () => {
  eq(comoLlaman(peticion(), { next_run: '2026-08-29T18:00:00Z' }).quien, 'planificador');
});

test('el planificador entra aunque traiga cabeceras raras', () => {
  /* El `next_run` manda sobre todo lo demás: si un día Netlify añade
     una cabecera cualquiera, esto no puede empezar a rechazarlo. */
  eq(comoLlaman(peticion({ authorization: 'Bearer basura' }), { next_run: 'x' }).quien, 'planificador');
});

console.log('\n· quien trae sesión se identifica');

test('un Bearer con forma de JWT se marca para comprobar', () => {
  const r = comoLlaman(peticion({ authorization: `Bearer ${JWT}` }), null);
  eq(r.quien, 'con-token');
  eq(r.token, JWT);
});

test('la cabecera se lee sin importar las mayúsculas', () => {
  const p = { headers: { get: (k) => (k.toLowerCase() === 'authorization' ? `Bearer ${JWT}` : null) } };
  eq(comoLlaman(p, null).quien, 'con-token');
});

console.log('\n· lo demás se queda fuera');

test('sin Authorization y sin next_run, es anónimo', () => {
  const r = comoLlaman(peticion(), null);
  eq(r.quien, 'anonimo');
  eq(r.token, null);
  ok(/sin Authorization/i.test(r.porque), r.porque);
});

test('un Bearer que no tiene forma de JWT no llega a la red', () => {
  /* Un bucle con «Bearer x» costaba una consulta a Supabase por cada
     llamada. No consigue nada, pero quemar el cupo del proyecto es
     dejar al club sin poder entrar. */
  for (const malo of ['x', 'a.b', 'a.b.c.d', '']) {
    eq(comoLlaman(peticion({ authorization: `Bearer ${malo}` }), null).quien, 'anonimo', `«${malo}»:`);
  }
});

test('otro esquema de autorización no cuela', () => {
  eq(comoLlaman(peticion({ authorization: `Basic ${JWT}` }), null).quien, 'anonimo');
  eq(comoLlaman(peticion({ authorization: JWT }), null).quien, 'anonimo', 'sin «Bearer» delante');
});

test('un cuerpo que no sea el del planificador no abre la puerta', () => {
  for (const c of [null, {}, { otra: 'cosa' }, [], 'next_run', 42]) {
    eq(comoLlaman(peticion(), c).quien, 'anonimo', `${JSON.stringify(c)}:`);
  }
});

console.log('\n· leer el cuerpo no puede reventar');

await testAsync('un cuerpo ilegible devuelve null en vez de lanzar', async () => {
  /* Si esto lanzara, la función caería antes de decidir nada — y una
     función programada que revienta no manda avisos. */
  eq(await cuerpoDe(peticion()), null);
  eq(await cuerpoDe(undefined), null);
  eq(await cuerpoDe({}), null);
});

await testAsync('un cuerpo bueno se devuelve tal cual', async () => {
  const c = await cuerpoDe(peticion({}, { next_run: 'x' }));
  eq(c.next_run, 'x');
});

console.log('\n· la regla de oro, escrita');

test('NINGUNA forma de duda acaba en «anonimo»', () => {
  /* La prueba que impide que alguien endurezca esto luego. Cerrarle la
     puerta al planificador cuesta que el club deje de recibir avisos,
     en silencio; dejar entrar a un desconocido cuesta cupo. Los dos
     errores no valen lo mismo. */
  const dudosas = [undefined, null, {}, { headers: null }, { headers: {} }, { headers: { get: 'no soy función' } }];
  for (const d of dudosas) {
    eq(comoLlaman(d).quien, 'planificador', `${JSON.stringify(d)} debería dejarse pasar:`);
  }
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
