/* ============================================================
   eval-alta.mjs — banco Node del alta por invitación
   (js/auth.js: mensajeDeAlta y resultadoDeAlta). Sin red, sin DOM.

     node tools/eval-alta.mjs

   Lo que vigila:

     1. Que un alta que YA trae sesión lleve a la persona dentro. El
        fallo que esto evita es el que se veía como «no funciona»: la
        cuenta se creaba, la sesión se abría, y la pantalla se quedaba
        en el acceso diciendo «cuenta creada».
     2. Que el rechazo del disparador se lea. Supabase Auth no deja
        pasar el mensaje del disparador: manda «Database error saving
        new user», que no le dice nada a nadie.
     3. Que a quien YA tiene cuenta no se le mande a esperar un correo
        que no va a llegar.
   ============================================================ */

import { mensajeDeAlta, resultadoDeAlta } from '../js/alta.js';

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

console.log('\n· después de un alta que sale bien');

test('con sesión, se entra: no se deja a nadie mirando el acceso', () => {
  /* Con la confirmación por correo desactivada —lo normal en un club
     pequeño— `signUp` devuelve la sesión ya abierta. */
  const r = resultadoDeAlta({
    user: { id: 'u9', email: 'nico@x.es', identities: [{ id: 'i1' }] },
    session: { access_token: 'a.b.c' },
  });
  eq(r.entra, true);
  eq(r.ok, true);
  ok(/entrando/i.test(r.mensaje), r.mensaje);
});

test('sin sesión, se dice que hay que confirmar el correo', () => {
  const r = resultadoDeAlta({
    user: { id: 'u9', email: 'nico@x.es', identities: [{ id: 'i1' }] },
    session: null,
  });
  eq(r.entra, false);
  eq(r.ok, true, 'la cuenta SÍ se ha creado: es un éxito, aunque falte confirmar');
  ok(/correo para confirmarla/i.test(r.mensaje), r.mensaje);
});

test('un correo que YA tenía cuenta no se manda a esperar un correo', () => {
  /* Supabase no da error en este caso —para no chivar quién está
     registrado— y devuelve el usuario SIN identidades. Decirle «mira tu
     bandeja» sería mandarle a esperar algo que no llega. */
  const r = resultadoDeAlta({
    user: { id: 'u9', email: 'nico@x.es', identities: [] },
    session: null,
  });
  eq(r.entra, false);
  eq(r.ok, false, 'no es un éxito: no se ha creado nada');
  ok(/ya tiene cuenta/i.test(r.mensaje), r.mensaje);
  ok(!/bandeja|confirmar/i.test(r.mensaje), 'no debería mandarle a mirar el correo: ' + r.mensaje);
});

test('una respuesta vacía no rompe ni promete nada', () => {
  for (const d of [null, undefined, {}, { user: null, session: null }]) {
    const r = resultadoDeAlta(d);
    eq(r.entra, false, JSON.stringify(d));
    ok(r.mensaje && r.mensaje.length > 10, 'sin mensaje útil');
  }
});

console.log('\n· cuando el alta falla');

test('el rechazo del disparador se traduce', () => {
  /* Lo que manda Supabase Auth de verdad cuando el disparador de la 032
     rechaza el alta: NO su mensaje, sino este. */
  const m = mensajeDeAlta({ message: 'Database error saving new user' });
  ok(/no est[ée] invitado/i.test(m), m);
  ok(/administrador/i.test(m), m);
  ok(!/database|error saving/i.test(m), 'no repite la jerga: ' + m);
});

test('y también si llega como unexpected_failure', () => {
  const m = mensajeDeAlta({ message: '', error_description: 'unexpected_failure' });
  ok(/invitado/i.test(m), m);
});

test('si el mensaje del disparador SÍ llega, se usa el suyo', () => {
  const m = mensajeDeAlta({ message: 'Este correo no está invitado al Playbook del club.' });
  ok(/no está invitado al Playbook/i.test(m), m);
});

test('los demás casos, en castellano y sin jerga', () => {
  ok(/ya tiene cuenta/i.test(mensajeDeAlta({ message: 'User already registered' })));
  ok(/seis caracteres/i.test(mensajeDeAlta({ message: 'Password should be at least 6 characters' })));
  ok(/no parece válido/i.test(mensajeDeAlta({ message: 'Unable to validate email address: invalid format' })));
  ok(/espera un minuto/i.test(mensajeDeAlta({ message: 'Email rate limit exceeded' })));
});

test('un error que no se reconoce se enseña tal cual, no se esconde', () => {
  /* Inventar un mensaje bonito para algo que no se entiende esconde la
     causa de verdad y deja sin pistas a quien tenga que arreglarlo. */
  eq(mensajeDeAlta({ message: 'algo muy raro' }), 'algo muy raro');
  eq(mensajeDeAlta({}), 'No se ha podido completar.');
  eq(mensajeDeAlta(null), 'No se ha podido completar.');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
