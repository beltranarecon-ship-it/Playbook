/* ============================================================
   eval-invitacion.mjs — banco de la invitación por correo.
   Sin red, sin DOM: equipos/js/data/invitacion-envio.js, donde vive
   todo lo que se puede comprobar sin levantar nada.

     node equipos/tools/eval-invitacion.mjs

   ── QUÉ CAMBIÓ Y POR QUÉ HAY QUE VIGILARLO ──────────────────
   Invitar era una fila en una tabla: el administrador escribía el
   correo y avisaba a esa persona por su cuenta. Ahora además se manda
   un correo con un enlace para poner la contraseña, y el correo puede
   fallar POR SU CUENTA sin que la invitación deje de valer.

   Son cuatro finales y a quien está delante del botón le cambian lo
   que tiene que hacer después. Decir «Invitado» en los cuatro —que es
   lo que haría un catch genérico— deja al administrador esperando un
   correo que no salió, y a la persona invitada esperando un aviso que
   no le llega.

   Lo que más se vigila aquí es el caso incómodo: correo NO enviado
   pero invitación GUARDADA. Es el único en el que hay que hacer algo,
   y el único que se puede confundir con un éxito o con un fracaso.
   ============================================================ */

import {
  problemaDelCorreo, normaliza, estadoDe,
  resultadoDeInvitar, motivoDeCorreo, ESTADOS, saneaInvitacion, correoValido,
} from '../js/data/invitacion-envio.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  if (real !== esp) throw new Error(`${msg} esperado=${JSON.stringify(esp)} real=${JSON.stringify(real)}`);
};

const INV = { id: 'i1', email: 'nico@x.es', rol: 'coach', equipos: [], usada_at: null };

console.log('\n· el correo, antes de mandar nada');

test('normaliza recorta y baja a minúsculas', () => {
  eq(normaliza('  Nico@X.ES '), 'nico@x.es');
  eq(normaliza(null), '');
});

test('un correo escribible pasa y uno roto no', () => {
  eq(problemaDelCorreo('nico@x.es'), null);
  ok(problemaDelCorreo(''), 'debería quejarse de un vacío');
  ok(problemaDelCorreo('nico'), 'debería quejarse de algo sin arroba');
  ok(problemaDelCorreo('nico@x'), 'debería quejarse de algo sin dominio');
});

test('no se valida más de la cuenta', () => {
  /* Un validador estricto rechaza direcciones legítimas y deja a
     alguien fuera del club por una regla nuestra. Lo que no exista lo
     dirá el correo que no llegue. */
  for (const bueno of ['a+etiqueta@x.es', "o'brien@club.co.uk", 'nombre.apellido@sub.dominio.org']) {
    eq(problemaDelCorreo(bueno), null, `rechaza «${bueno}»:`);
  }
});

test('un correo ya invitado se detecta con cualquier mayúscula', () => {
  ok(problemaDelCorreo(' NICO@X.ES ', { yaEstan: ['nico@x.es'] }), 'no ha visto el repetido');
});

console.log('\n· lo que se guarda, venga por donde venga');

test('el rol solo puede ser uno de los dos', () => {
  eq(saneaInvitacion({ rol: 'admin' }).rol, 'admin');
  eq(saneaInvitacion({ rol: 'coach' }).rol, 'coach');
  for (const raro of ['superadmin', '', null, 0, {}, 'ADMIN']) {
    eq(saneaInvitacion({ rol: raro }).rol, 'coach', `«${JSON.stringify(raro)}» debería caer a coach:`);
  }
});

test('los equipos que no son uuid se tiran', () => {
  /* Van a una columna uuid[] y de ahí a team_coaches. Con una cadena
     cualquiera el INSERT revienta con un error de casteo que no le dice
     nada a nadie. */
  const uuid = '3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6a7b';
  eq(saneaInvitacion({ equipos: [uuid, 'DROP TABLE', 42, null, uuid] }).equipos.join(','), uuid);
  eq(saneaInvitacion({ equipos: 'no es un array' }).equipos.length, 0);
  eq(saneaInvitacion({}).equipos.length, 0);
});

test('el nombre y el correo tienen tope', () => {
  eq(saneaInvitacion({ nombre: 'A'.repeat(500) }).nombre.length, 120);
  eq(saneaInvitacion({ nombre: '   ' }).nombre, null);
  eq(saneaInvitacion({ email: '  Nico@X.ES ' }).email, 'nico@x.es');
});

test('un correo con salto de línea NO pasa', () => {
  /* Es como se inyectan cabeceras en el correo que se manda: sin esto,
     «nico@x.es\\nbcc: otro@x.es» sería una dirección válida. */
  ok(!correoValido('nico@x.es\nbcc: otro@x.es'), 'deja pasar un salto de línea');
  ok(!correoValido('nico@x.es\r\nbcc: otro@x.es'), 'deja pasar un retorno de carro');
  ok(!correoValido(`${'a'.repeat(300)}@x.es`), 'deja pasar uno de 300 caracteres');
  ok(correoValido('nico@x.es'), 'rechaza uno normal');
});

test('las dos vías de escritura aplican LAS MISMAS reglas', () => {
  /* Hay dos caminos a la tabla: la función de Netlify y el plan B del
     navegador. Con las comprobaciones copiadas se separan, y lo que
     entre por el camino que no valida acaba igual en la base. Por eso
     `saneaInvitacion` vive en un módulo puro que importan los dos. */
  const sucia = { email: ' A@B.ES ', rol: 'root', equipos: ['x'], nombre: ' ñ '.repeat(200) };
  const a = saneaInvitacion(sucia);
  const b = saneaInvitacion({ ...sucia });
  eq(JSON.stringify(a), JSON.stringify(b), 'no es determinista:');
  eq(a.email, 'a@b.es'); eq(a.rol, 'coach'); eq(a.equipos.length, 0);
  ok(a.nombre.length <= 120, `nombre de ${a.nombre.length}`);
});

console.log('\n· los cuatro finales de invitar');

test('enviado: se dice que le llega un correo', () => {
  const r = resultadoDeInvitar({ ok: true, estado: 'enviado', email: 'nico@x.es', invitacion: INV });
  eq(r.ok, true);
  eq(r.estado, 'enviado');
  ok(/correo/i.test(r.mensaje) && /contrase/i.test(r.mensaje), r.mensaje);
  eq(r.invitacion, INV);
});

test('sin correo: se dice que la invitación VALE y que hay que avisar', () => {
  /* El caso que más importa contar bien. La persona puede darse de
     alta igualmente; lo único que falta es que se entere. */
  const r = resultadoDeInvitar({
    ok: true, estado: 'sin_correo', email: 'nico@x.es', invitacion: INV,
    motivo: 'falta configurar el envío de correo en Supabase',
  });
  eq(r.ok, true, 'no es un fracaso: la invitación está guardada');
  eq(r.estado, 'sin_correo');
  ok(/guardada/i.test(r.mensaje), r.mensaje);
  ok(/av[íi]sale/i.test(r.mensaje), 'no dice que haya que avisar: ' + r.mensaje);
  ok(/primera vez/i.test(r.mensaje), 'no dice por dónde entra: ' + r.mensaje);
  ok(r.mensaje.includes('configurar el envío'), 'se ha comido el motivo: ' + r.mensaje);
  eq(r.invitacion, INV, 'tiene que traer la fila: la lista se repinta igual');
});

test('ya registrado: no es un fallo, esa persona ya puede entrar', () => {
  const r = resultadoDeInvitar({ ok: true, estado: 'ya_registrado', email: 'nico@x.es', invitacion: INV });
  eq(r.ok, true);
  ok(/ya tiene cuenta/i.test(r.mensaje), r.mensaje);
  ok(/no te acuerdas/i.test(r.mensaje), 'no dice qué hacer si no recuerda la clave: ' + r.mensaje);
  ok(!/no se ha podido/i.test(r.mensaje), 'lo cuenta como un fallo: ' + r.mensaje);
});

test('fallo: se enseña el motivo REAL, no uno inventado', () => {
  /* Inventar un mensaje bonito para algo que no se entiende esconde la
     causa y deja sin pistas a quien tenga que arreglarlo. */
  const r = resultadoDeInvitar({ ok: false, estado: 'fallo', motivo: 'Solo el administrador puede invitar.' });
  eq(r.ok, false);
  eq(r.mensaje, 'Solo el administrador puede invitar.');
});

test('una respuesta vacía o rara no promete nada', () => {
  for (const v of [null, undefined, {}, { ok: true }, { estado: 'loquesea' }]) {
    const r = resultadoDeInvitar(v);
    eq(r.ok, false, JSON.stringify(v));
    ok(r.mensaje && r.mensaje.length > 10, 'sin mensaje útil para ' + JSON.stringify(v));
  }
});

test('los estados son los cuatro declarados, ni uno más', () => {
  /* Si mañana el servidor devuelve un estado nuevo y aquí no está, cae
     en «fallo» y el administrador ve un error donde no lo hay. */
  const vistos = ESTADOS.map((estado) => resultadoDeInvitar({ ok: true, estado, email: 'a@b.es' }).estado);
  eq(vistos.join(','), ESTADOS.join(','), 'algún estado declarado no se reconoce:');
});

console.log('\n· por qué no salió el correo');

test('cada motivo lleva a una cosa distinta que configurar', () => {
  /* Aplastar los tres en «no se pudo enviar» obliga a adivinar dónde
     mirar. Son tres sitios distintos del panel de Supabase. */
  ok(/hora/i.test(motivoDeCorreo({ message: 'email rate limit exceeded' })));
  ok(/configurar el env[íi]o/i.test(motivoDeCorreo({ message: 'SMTP provider not configured' })));
  ok(/lista blanca/i.test(motivoDeCorreo({ message: 'redirect_to url is not allowed' })));
});

test('un motivo que no se reconoce se pasa tal cual', () => {
  eq(motivoDeCorreo({ message: 'algo muy raro' }), 'algo muy raro');
  eq(motivoDeCorreo(null), 'motivo desconocido');
});

console.log('\n· el estado de una invitación');

test('pendiente hasta que se usa', () => {
  eq(estadoDe({ usada_at: null }), 'pendiente');
  eq(estadoDe({ usada_at: '2026-08-29T10:00:00Z' }), 'dentro');
  eq(estadoDe(null), 'pendiente');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
