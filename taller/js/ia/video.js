/* ============================================================
   ia/video.js — EL VÍDEO DE REFERENCIA DE UNA ACCIÓN (Tramo 2.14).

   Módulo PURO: sin DOM, sin red. Lo importan el proyector, el paso 2,
   el cliente de Supabase y el banco Node.

   ── QUÉ RESUELVE ────────────────────────────────────────────
   Un entrenador enseña el doble ritmo diciendo «mira, así». La
   animación dibuja POR DÓNDE va cada uno, pero no enseña el gesto: la
   pizarra no sabe de apoyos ni de muñeca. Un vídeo de siete segundos
   sí, y es lo que se pega en el grupo de WhatsApp cuatro veces al año.

   Aquí el vídeo cuelga de la ACCIÓN, no del ejercicio (§5.1): «entra»
   se enseña igual en los treinta ejercicios que la usan, así que se
   explica una vez y aparece en los treinta.

   ── LAS DOS FORMAS, Y POR QUÉ NO SON LA MISMA ───────────────
   YouTube admite decirle a su reproductor dónde empieza y dónde acaba
   (`start`/`end`), así que se puede pedir EL TRAMO: los siete segundos
   del gesto, sin el minuto de presentación. Eso es lo que deja al
   proyector pararse, enseñarlo y seguir solo (§12.36).

   TikTok no. Su incrustado no admite segundo de entrada ni de salida, y
   pararlo o arrancarlo desde fuera exige cargar SU librería —una
   llamada a un tercero desde la pantalla que se proyecta en el
   pabellón—. Así que un TikTok es un ENLACE al vídeo entero, que se
   abre aparte y no secuestra la proyección. Es una decisión, no una
   carencia: media hacerlo es peor que decir lo que hay.

   ── Y POR QUÉ EL TRAMO SE MIDE AQUÍ ─────────────────────────
   El proyector necesita saber CUÁNTO dura el tramo para volver solo a
   la animación. Sin la librería de YouTube no hay forma de que el
   reproductor nos avise de que ha terminado, así que se cuenta el
   tiempo: `hasta - desde`, que es un dato que ya tenemos y que es
   exacto. Sin `hasta` no hay cuenta posible, y entonces no se vuelve
   solo: se enseña un botón. Se prefiere eso a adivinar.
   ============================================================ */

/** Las dos formas que admite un vídeo de referencia. */
export const TIPOS = ['youtube', 'tiktok'];

/* ── 1. Tiempos ────────────────────────────────────────────── */

/**
 * Segundos a partir de lo que escriba una persona: «7», «1:07»,
 * «1m30s», «90». Devuelve null si no hay número que sacar.
 *
 * Se admite el formato de YouTube (`1m30s`) porque es lo que sale
 * pegado en la URL al copiar «compartir a partir de aquí».
 */
export function segundosDe(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;

  // 1:07 · 1:02:03
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    return s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
  }
  // 1m30s · 2h3m4s · 45s
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(s);
  if (m && (m[1] || m[2] || m[3])) {
    return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  }
  return null;
}

/** Segundos a «0:07» / «1:02:03», que es como se lee un tramo. */
export function mmss(total) {
  const n = Math.max(0, Math.round(Number(total) || 0));
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  const dos = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}

/* ── 2. Leer lo que se pega ────────────────────────────────── */

/*
   Los cinco sitios de los que se copia un enlace de YouTube. El id son
   once caracteres y no puede confundirse con nada: si el texto pegado
   no lo trae, no es un vídeo de YouTube y se dice, en vez de guardar
   una URL rota que solo fallará en el pabellón.
*/
const YT_ID = '([A-Za-z0-9_-]{11})';
const YT_PATRONES = [
  new RegExp(`youtu\\.be/${YT_ID}`),
  new RegExp(`youtube\\.com/watch\\?(?:[^#]*&)?v=${YT_ID}`),
  new RegExp(`youtube\\.com/shorts/${YT_ID}`),
  new RegExp(`youtube\\.com/embed/${YT_ID}`),
  new RegExp(`youtube\\.com/live/${YT_ID}`),
];

const TIKTOK = /tiktok\.com\/(?:@[\w.-]+\/video\/\d+|t\/[\w]+|v\/\d+|[\w]+)/i;

/** El valor de un parámetro de la URL pegada (`t`, `start`, `end`). */
function param(texto, clave) {
  const m = new RegExp(`[?&#]${clave}=([^&#\\s]+)`, 'i').exec(texto);
  return m ? m[1] : null;
}

/**
 * Un vídeo a partir de lo que se pega en un cuadro de texto.
 *
 * De YouTube saca el id y, si el enlace los trae, el segundo de
 * entrada (`t`/`start`) y el de salida (`end`) — que es exactamente lo
 * que pega el «compartir a partir del minuto…». De TikTok, la URL
 * limpia. Cualquier otra cosa: null.
 *
 * @returns {{tipo,id,desde,hasta}|{tipo,url}|null}
 */
export function leerVideo(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;

  for (const re of YT_PATRONES) {
    const m = re.exec(t);
    if (!m) continue;
    const desde = segundosDe(param(t, 't') ?? param(t, 'start'));
    const hasta = segundosDe(param(t, 'end'));
    return normalizarVideo({ tipo: 'youtube', id: m[1], desde, hasta });
  }

  if (TIKTOK.test(t)) {
    // se queda la URL tal cual (sin parámetros de seguimiento): el
    // enlace corto de la app redirige, y resolverlo exige una llamada
    const limpia = t.split(/[?#]/)[0];
    return normalizarVideo({ tipo: 'tiktok', url: limpia });
  }

  return null;
}

/* ── 3. Sanear y validar ───────────────────────────────────── */

/**
 * Deja el vídeo en su forma canónica, o null si no es utilizable.
 *
 * `desde`/`hasta` siempre en segundos enteros, y `hasta` estrictamente
 * después de `desde`: un tramo de cero segundos no es un tramo, y
 * dejarlo pasar haría que el proyector se parase para no enseñar nada.
 */
export function normalizarVideo(v) {
  if (!v || typeof v !== 'object') return null;

  if (v.tipo === 'youtube') {
    const id = String(v.id ?? '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    let desde = segundosDe(v.desde);
    let hasta = segundosDe(v.hasta);
    if (desde == null) desde = null;
    if (hasta != null && (desde ?? 0) >= hasta) hasta = null;
    return { tipo: 'youtube', id, desde, hasta };
  }

  if (v.tipo === 'tiktok') {
    const url = String(v.url ?? '').trim();
    if (!TIKTOK.test(url)) return null;
    return { tipo: 'tiktok', url: url.split(/[?#]/)[0] };
  }

  return null;
}

/**
 * ¿Se puede guardar? Devuelve el porqué, no solo un no: es lo que
 * enseña el cuadro de «añadir vídeo» cuando alguien pega otra cosa.
 */
export function validarVideo(v) {
  if (v == null) return { ok: true, errores: [] };          // sin vídeo es válido
  if (!v || typeof v !== 'object') return { ok: false, errores: ['no es un vídeo'] };
  if (!TIPOS.includes(v.tipo)) return { ok: false, errores: [`tipo "${v.tipo}" desconocido (youtube o tiktok)`] };
  if (v.tipo === 'youtube' && !/^[A-Za-z0-9_-]{11}$/.test(String(v.id ?? ''))) {
    return { ok: false, errores: ['no se reconoce el id del vídeo de YouTube'] };
  }
  if (v.tipo === 'tiktok' && !TIKTOK.test(String(v.url ?? ''))) {
    return { ok: false, errores: ['no se reconoce el enlace de TikTok'] };
  }
  const d = segundosDe(v.desde), h = segundosDe(v.hasta);
  if (h != null && (d ?? 0) >= h) return { ok: false, errores: ['el final del tramo va antes que el principio'] };
  return { ok: true, errores: [] };
}

/* ── 4. Lo que necesita quien lo enseña ────────────────────── */

/**
 * La URL para incrustar. Solo YouTube: ver la cabecera.
 *
 * `start`/`end` son el tramo. `autoplay=1` porque el proyector ya ha
 * parado la animación para esto —un vídeo que hay que arrancar a mano
 * rompe el «continúa sola»—. `rel=0` y `modestbranding=1` para que al
 * acabar no aparezca una rejilla de vídeos sugeridos EN LA PARED del
 * pabellón, delante de doce críos.
 */
export function urlIncrustado(v) {
  const n = normalizarVideo(v);
  if (!n || n.tipo !== 'youtube') return null;
  const q = ['autoplay=1', 'rel=0', 'modestbranding=1', 'playsinline=1'];
  if (n.desde != null) q.push(`start=${n.desde}`);
  if (n.hasta != null) q.push(`end=${n.hasta}`);
  return `https://www.youtube-nocookie.com/embed/${n.id}?${q.join('&')}`;
}

/** El enlace de siempre, para abrirlo aparte (y el único de TikTok). */
export function urlPublica(v) {
  const n = normalizarVideo(v);
  if (!n) return null;
  if (n.tipo === 'tiktok') return n.url;
  const t = n.desde != null ? `&t=${n.desde}` : '';
  return `https://www.youtube.com/watch?v=${n.id}${t}`;
}

/** «del 0:12 al 0:19», «desde 0:12», o null si es el vídeo entero. */
export function textoTramo(v) {
  const n = normalizarVideo(v);
  if (!n || n.tipo !== 'youtube') return null;
  if (n.desde != null && n.hasta != null) return `del ${mmss(n.desde)} al ${mmss(n.hasta)}`;
  if (n.desde != null) return `desde ${mmss(n.desde)}`;
  return null;
}

/**
 * Cuánto hay que esperar antes de volver a la animación, o null si no
 * se puede saber (sin `hasta`, o TikTok). null significa «no vuelvas
 * sola»: quien lo enseñe pondrá un botón.
 *
 * Se suma un margen corto porque el reproductor tarda en arrancar; sin
 * él, el último segundo del gesto —justo el que se quiere ver— se corta.
 */
export function duracionMs(v, { margen_ms = 900 } = {}) {
  const n = normalizarVideo(v);
  if (!n || n.tipo !== 'youtube' || n.hasta == null) return null;
  return (n.hasta - (n.desde ?? 0)) * 1000 + margen_ms;
}

/** ¿Este vídeo puede parar la animación y devolverla sola? (§2.14) */
export function seIncrusta(v) {
  return urlIncrustado(v) != null;
}
