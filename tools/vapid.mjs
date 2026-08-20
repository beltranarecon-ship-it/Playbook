/* ============================================================
   vapid.mjs — genera el par de claves de los avisos push (Tramo 4.7).

     node tools/vapid.mjs

   ── POR QUÉ NO `npx web-push generate-vapid-keys` ───────────
   Porque no hace falta. Una clave VAPID es un par ECDSA sobre la curva
   P-256, y Node lo genera con su propio módulo `crypto`: sin instalar
   nada, sin red y sin pelearse con la política de ejecución de
   PowerShell, que bloquea el envoltorio `npx.ps1` de Windows.

   El proyecto no tiene proceso de compilación (§9) y no tener que
   traerse un paquete para esto encaja con eso.

   ── QUÉ ES CADA UNA ─────────────────────────────────────────
   La PÚBLICA es el punto de la curva sin comprimir (0x04 ‖ X ‖ Y) en
   base64url: 87 caracteres. Es pública por diseño —el navegador la
   necesita para suscribirse y viaja en cada suscripción—, así que va
   en `equipos/js/config.js`.

   La PRIVADA es el escalar de 32 bytes en base64url: 43 caracteres.
   Va SOLO en las variables de entorno de Netlify. No se escribe en
   ningún fichero del repositorio, no se pega en un chat y no se sube a
   ningún sitio. Si alguna vez se filtra, se genera un par nuevo y se
   cambian las dos: las suscripciones viejas dejan de valer y cada
   navegador se vuelve a suscribir solo la próxima vez que entre.

   ── COMPROBAR SIN ENSEÑAR NADA ──────────────────────────────
   `node tools/vapid.mjs --comprobar` genera un par y dice solo si
   tiene la forma correcta. Sirve para verificar la herramienta sin que
   una clave privada acabe en el registro de una consola compartida.
   ============================================================ */

import { generateKeyPairSync } from 'node:crypto';

/** Un par nuevo. Nada se guarda en ningún sitio: se imprime y ya. */
export function generar() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

  /* El JWK ya trae X, Y y D en base64url, que es justo la codificación
     que quiere VAPID. Ahorra media docena de conversiones a mano. */
  const jwk = privateKey.export({ format: 'jwk' });
  const bytes = (b64url) => Buffer.from(b64url, 'base64url');

  // la pública es el punto sin comprimir: 0x04 ‖ X ‖ Y
  const publica = Buffer.concat([Buffer.from([0x04]), bytes(jwk.x), bytes(jwk.y)])
    .toString('base64url');

  return { publica, privada: jwk.d };
}

/** ¿Tiene la forma que espera un navegador? */
export const valida = ({ publica, privada }) =>
  typeof publica === 'string' && publica.length === 87
  && Buffer.from(publica, 'base64url').length === 65
  && Buffer.from(publica, 'base64url')[0] === 0x04
  && typeof privada === 'string' && privada.length === 43
  && Buffer.from(privada, 'base64url').length === 32;

/* ── Cuando se ejecuta a mano ──────────────────────────────── */

/* `process.argv[1]` no existe cuando el módulo se importa desde otro
   sitio —por ejemplo, un banco de pruebas—. Sin el `?.`, importarlo
   revienta en vez de exportar sus dos funciones. */
if (process.argv[1]?.endsWith('vapid.mjs')) {
  const par = generar();

  if (process.argv.includes('--comprobar')) {
    console.log(valida(par)
      ? '✓ El par generado tiene la forma correcta (87 y 43 caracteres). No se enseña ninguna clave.'
      : '✗ Algo no cuadra en el par generado.');
    process.exit(valida(par) ? 0 : 1);
  }

  console.log(`
Claves VAPID nuevas. Se usan UNA vez y valen para siempre.

── 1. La PÚBLICA va en equipos/js/config.js ──────────────────
     export const VAPID_PUBLIC_KEY = '${par.publica}';

── 2. La PRIVADA va SOLO en Netlify ──────────────────────────
     Site settings → Environment variables:

       VAPID_PUBLIC_KEY   = ${par.publica}
       VAPID_PRIVATE_KEY  = ${par.privada}

     Y ahí mismo, las dos que ya conoces:
       SUPABASE_URL           = https://…supabase.co
       SUPABASE_SERVICE_ROLE  = (la de administrador)

La privada no se escribe en ningún fichero del repositorio ni se pega
en un chat. Si se filtra, vuelve a ejecutar esto y cambia las dos: las
suscripciones viejas dejan de valer y cada navegador se vuelve a
suscribir solo la próxima vez que alguien entre.
`);
}
