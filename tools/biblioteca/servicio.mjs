/* ============================================================
   servicio.mjs — hablar con Supabase con la clave de SERVICIO.

   Salió de importar.mjs para que lo usen también los ejercicios
   sacados de vídeos (guardar-video.mjs) sin copiar la guarda de la
   clave, la búsqueda del autor ni el revertir: tres copias de la guarda
   serían tres sitios donde olvidarse de que una clave pública no da
   error, simplemente no escribe.

   La clave sale de la variable de entorno SUPABASE_SERVICE_ROLE o del
   .env de la raíz (en .gitignore). Nunca se imprime.
   ============================================================ */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
export const DIR_MANIFIESTOS = join(AQUI, 'manifiestos');
export const URL_BASE = 'https://tsskjoewviqixnwonpkx.supabase.co';
export const LOTE = 20;   // lotes cortos: un fallo a medias deja menos ids sueltos

/* ---- clave ------------------------------------------------------ */

export function claveDeServicio() {
  if (process.env.SUPABASE_SERVICE_ROLE) return process.env.SUPABASE_SERVICE_ROLE.trim();
  const env = join(RAIZ, '.env');
  if (existsSync(env)) {
    for (const linea of readFileSync(env, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*SUPABASE_SERVICE_ROLE\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

export function esDeServicio(k) {
  if (!k) return false;
  if (k.startsWith('sb_secret_')) return true;
  if (k.startsWith('sb_publishable_')) return false;
  const p = k.split('.');
  if (p.length !== 3) return false;
  try { return JSON.parse(Buffer.from(p[1], 'base64').toString('utf8')).role === 'service_role'; }
  catch { return false; }
}

/**
 * Comprueba la clave y devuelve `pedir(ruta, opciones)`, que lanza si
 * PostgREST contesta con error. Sin clave de servicio sale del proceso:
 * con una pública el insert fallaría por RLS.
 */
export function conectar() {
  const clave = claveDeServicio();
  if (!esDeServicio(clave)) {
    console.error('\nFalta la clave de servicio en .env, o la que hay no lo es.');
    console.error('Con una clave pública el insert fallaría por RLS.\n');
    process.exit(1);
  }
  const cabeceras = { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' };
  return async function pedir(ruta, opciones = {}) {
    const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...opciones, headers: { ...cabeceras, ...(opciones.headers || {}) } });
    if (!r.ok) throw new Error(`${opciones.method || 'GET'} ${ruta} → ${r.status}: ${(await r.text()).slice(0, 400)}`);
    return r;
  };
}

/* ---- autor ------------------------------------------------------
   `exercises.created_by` apunta a profiles(id). Con service_role no
   hay auth.uid(), así que hay que decir explícitamente de quién son.
   Se coge el perfil más antiguo, que es el del entrenador que montó
   el proyecto; si hay varios, se puede fijar con --autor <uuid>. */

export async function resolverAutor(pedir, argv = process.argv) {
  const iAutor = argv.indexOf('--autor');
  const autor = iAutor >= 0 ? argv[iAutor + 1] : null;
  if (autor) return autor;

  const perfiles = await (await pedir('profiles?select=id,full_name,created_at&order=created_at.asc&limit=5')).json();
  if (!perfiles.length) {
    console.error('\n  No hay ningún perfil en la base: no se puede asignar autoría.\n');
    process.exit(1);
  }
  console.log(`  Autor: ${perfiles[0].full_name || '(sin nombre)'} · ${perfiles[0].id}`);
  if (perfiles.length > 1) console.log(`  (hay ${perfiles.length} perfiles; usa --autor <uuid> para elegir otro)`);
  return perfiles[0].id;
}

/* ---- revertir ---------------------------------------------------
   Dos clases de manifiesto:
     · de ALTA ({ ids }): se borran esos ids, nada más;
     · de ACTUALIZACIÓN ({ id, antes }): se vuelve a escribir en esa fila
       lo que tenía antes, conservando el id (y con él los bloques de
       sesión que ya lo usan). Solo lo deja guardar-video.mjs. */

export async function revertir(ruta, pedir) {
  if (!ruta) { console.error('Falta la ruta del manifiesto.'); process.exit(1); }
  const man = JSON.parse(readFileSync(ruta, 'utf8'));
  if (man.antes && man.id) {
    console.log(`\nDevolviendo «${man.nombre || man.id}» a como estaba antes de ${man.generado}…`);
    await pedir(`exercises?id=eq.${man.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(man.antes) });
    console.log('Hecho. La ficha vuelve a estar como antes de esa actualización.\n');
    return;
  }
  console.log(`\nRevirtiendo ${man.ids.length} fichas de ${man.generado}…`);
  for (let i = 0; i < man.ids.length; i += LOTE) {
    const trozo = man.ids.slice(i, i + LOTE);
    await pedir(`exercises?id=in.(${trozo.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
  console.log('Hecho. La biblioteca vuelve a estar como antes de esa importación.\n');
}
