/* ============================================================
   avisos.mjs — LA FUNCIÓN QUE MANDA LOS AVISOS (Tramo 4.7).
   Programada (§9). Hace tres cosas y ninguna más:

     1. lee de Supabase lo que hace falta para decidir;
     2. le pregunta a `avisos.js` —puro— qué toca ahora;
     3. encola lo nuevo y manda un push por cada suscripción.

   Esta función NO sabe de baloncesto y `avisos.js` no sabe de VAPID.
   Por eso los seis avisos se prueban con un banco Node sin red y esta
   función se queda en cien líneas de fontanería.

   ── POR QUÉ LA COLA VA ANTES QUE EL ENVÍO ───────────────────
   Porque el índice único de la 031 es lo que impide mandar dos veces el
   mismo aviso, y solo funciona si la fila se escribe ANTES. Si se
   mandara primero y se apuntara después, un reintento de Netlify —que
   los hay— dejaría al entrenador con el mismo aviso dos veces.

   Y porque en iPhone sin la app instalada el push no llega (§5.8): la
   fila encolada es lo que hace que el aviso exista igual, dentro de la
   aplicación.

   ── LOS ENDPOINTS MUERTOS SE LIMPIAN SOLOS ──────────────────
   Un navegador desinstalado devuelve 404 o 410. Esa suscripción se
   borra en el momento: si no, se le manda un push a nadie en cada
   ejecución, para siempre.

   ── QUIÉN PUEDE LLAMARLA ────────────────────────────────────
   Hasta ahora, cualquiera. Esta función sostiene la CLAVE DE SERVICIO
   —la que se salta todas las políticas— y no miraba nada: ni el
   método, ni la cabecera; el manejador ni siquiera recibía la
   petición. Lo único que la separaba de una URL pública era que
   Netlify enruta las funciones programadas fuera del espacio HTTP, y
   eso es configuración, no código: se cae al quitar el `schedule` para
   depurar, o al correr con `netlify dev`.

   No se le puede pedir el token que pide `invitar.mjs`: a esta la
   llama el PLANIFICADOR cada diez minutos y un planificador no tiene
   sesión. Así que pasan dos: el planificador y un administrador —para
   poder lanzarla a mano y ver qué sale—. Al resto se le responde 404,
   sin hacer nada y sin confirmarle que esto exista.

   ── Y ANTE LA DUDA, SE DEJA PASAR ───────────────────────────
   Los dos errores no cuestan lo mismo. Dejar entrar a un desconocido
   cuesta cupo y que se vean tres recuentos —acosar no puede: el índice
   único de la 031 hace que una segunda pasada seguida no tenga nada
   que mandar—. Cerrarle la puerta al planificador deja al club sin
   avisos EN SILENCIO, y eso tarda semanas en notarse.

   Por eso, cuando no se puede saber quién llama, se responde
   «planificador». Está en `_quien-llama.mjs`, con banco, para que no
   se endurezca luego creyendo que se mejora.

   ── QUÉ HACE FALTA PARA QUE ESTO FUNCIONE ───────────────────
   Cuatro variables de entorno en Netlify (ninguna en el repositorio):
   SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC_KEY y
   VAPID_PRIVATE_KEY. Sin ellas la función no revienta: dice qué falta y
   se va. Un error de configuración tiene que leerse en el registro, no
   deducirse de que no llega nada.
   ============================================================ */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { avisosDe } from '../../equipos/js/data/avisos.js';
import { diaDeConvocatoria } from '../../equipos/js/data/convocatoria.js';
import { comoLlaman, cuerpoDe } from './_quien-llama.mjs';

/* Cada cuánto corre. La ventana tiene que ser >= al intervalo o se
   pierden avisos entre dos ejecuciones. */
export const config = { schedule: '*/10 * * * *' };
const VENTANA_MIN = 12;

const iso = (d) => d.toISOString().slice(0, 10);

export default async function handler(peticion) {
  const {
    SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
    VAPID_CONTACTO = 'mailto:playbook@cbpalencia.es',
  } = process.env;

  /* ── Quién llama ────────────────────────────────────────────
     Esta función sostiene la clave de servicio y hasta ahora no miraba
     nada: ni el método, ni la cabecera — el manejador ni siquiera
     recibía la petición. Lo único que la separaba de una URL pública
     era que Netlify enruta las funciones programadas fuera del espacio
     HTTP, y eso es configuración, no código.

     No se le puede pedir un token: el planificador no tiene sesión. Lo
     que se hace es dejar pasar al planificador y a un administrador
     —para poder lanzarla a mano y ver qué sale— y cerrarle la puerta al
     resto. Ante la duda se deja pasar, a propósito: ver _quien-llama.mjs.

     Va lo PRIMERO, antes incluso de mirar la configuración: a un
     desconocido no se le cuenta qué variables de entorno faltan. */
  const cuerpo = await cuerpoDe(peticion);
  const llamada = comoLlaman(peticion, cuerpo);

  if (llamada.quien === 'con-token') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return new Response(JSON.stringify({ ok: false, motivo: 'sin configurar' }), { status: 500 });
    }
    const sbAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
    const { data: quien } = await sbAuth.auth.getUser(llamada.token);
    const { data: perfil } = quien?.user
      ? await sbAuth.from('profiles').select('role').eq('id', quien.user.id).single()
      : { data: null };
    if (perfil?.role !== 'admin') {
      console.warn('[avisos] llamada con token que no es de administrador; no se hace nada');
      return new Response('No encontrado', { status: 404 });
    }
    console.log('[avisos] lanzada a mano por el administrador');
  } else if (llamada.quien === 'anonimo') {
    /* 404 y no 403: a quien no debería estar aquí no se le confirma que
       esto exista. Se registra para que una llamada rara se pueda ver. */
    console.warn(`[avisos] llamada anónima rechazada (${llamada.porque})`);
    return new Response('No encontrado', { status: 404 });
  }

  const faltan = Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY })
    .filter(([, v]) => !v).map(([k]) => k);
  if (faltan.length) {
    console.warn('[avisos] sin configurar, no se manda nada. Faltan:', faltan.join(', '));
    return new Response(JSON.stringify({ ok: false, faltan }), { status: 200 });
  }

  webpush.setVapidDetails(VAPID_CONTACTO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const ahora = new Date();
  const hoy = iso(ahora);
  const ayer = iso(new Date(ahora.getTime() - 86400000));
  const manana = iso(new Date(ahora.getTime() + 86400000));

  // ── 1. lo que hace falta para decidir ──
  const [equiposR, sesionesR, partidosR, bloquesR] = await Promise.all([
    sb.from('teams').select('id, name, team_coaches(coach_id), team_settings(dia_convocatoria, hora_convocatoria)'),
    sb.from('sessions').select('id, team_id, fecha, hora_inicio, estado, evaluada_at, arranque')
      .gte('fecha', ayer).lte('fecha', manana),
    sb.from('matches').select('id, team_id, fecha, rival, es_local, estado, convocados, marcador_favor, marcador_contra, val_defensa, val_ataque, val_actitud, val_acierto, val_global, acta_path')
      .gte('fecha', ayer),
    sb.from('session_blocks').select('id, session_id, titulo, duracion_min, orden').order('orden'),
  ]);

  /* ── Una consulta que falla NO es «no hay nada que avisar» ──
     Esto es lo que escondió el fallo de `sessions.arranque` durante
     meses: la columna no existía, Postgres rechazaba la consulta ENTERA
     —no solo esa columna—, y el `|| []` de más abajo convertía el error
     en una lista vacía. El generador decidía que no tocaba ningún
     aviso, respondía que todo iba bien, y el club se quedó sin cuatro
     de los seis sin una sola señal.

     Un fallo aquí se dice y se corta. Mandar los avisos «de lo que sí
     se ha podido leer» es peor: parece que el sistema funciona. */
  const consultas = { equipos: equiposR, sesiones: sesionesR, partidos: partidosR, bloques: bloquesR };
  const rotas = Object.entries(consultas)
    .filter(([, r]) => r.error)
    .map(([que, r]) => `${que}: ${r.error.message}`);
  if (rotas.length) {
    console.error('[avisos] NO se ha mandado nada, hay consultas que fallan:', rotas.join(' · '));
    return new Response(JSON.stringify({ ok: false, motivo: 'consulta', rotas }), { status: 500 });
  }

  const equipos = (equiposR.data || []).map((t) => ({
    id: t.id,
    name: t.name,
    dia_convocatoria: t.team_settings?.dia_convocatoria ?? null,
    hora_convocatoria: t.team_settings?.hora_convocatoria ?? null,
    coaches: (t.team_coaches || []).map((c) => c.coach_id),
  }));
  const porEquipo = new Map(equipos.map((t) => [t.id, t]));

  /* Los bloques se cuelgan de su sesión: el aviso de fin de bloque los
     necesita para saber a qué hora acaba cada uno. Solo los de las
     sesiones que están en marcha; traerlos todos sería traerse la
     temporada entera cada diez minutos. */
  const enMarcha = new Set((sesionesR.data || []).filter((s) => s.arranque).map((s) => s.id));
  const bloquesDe = new Map();
  for (const b of bloquesR.data || []) {
    if (!enMarcha.has(b.session_id)) continue;
    if (!bloquesDe.has(b.session_id)) bloquesDe.set(b.session_id, []);
    bloquesDe.get(b.session_id).push(b);
  }

  /* La asistencia solo se mira de las sesiones de HOY: es el único
     aviso que la necesita y una consulta por sesión de la temporada
     sería absurda. */
  const deHoy = (sesionesR.data || []).filter((s) => s.fecha === hoy).map((s) => s.id);
  const conLista = new Set();
  if (deHoy.length) {
    const { data } = await sb.from('attendance').select('session_id').in('session_id', deHoy);
    for (const a of data || []) conLista.add(a.session_id);
  }

  const sesiones = (sesionesR.data || []).map((s) => ({
    ...s,
    bloques: bloquesDe.get(s.id) || null,
    tiene_asistencia: conLista.has(s.id),
  }));

  /* El día de convocatoria se DEDUCE (4.6), igual que en el calendario:
     no hay tabla de eventos que mantener al día. */
  const partidos = (partidosR.data || []).map((m) => ({
    ...m,
    dia_convocatoria_iso: diaDeConvocatoria(m, { diaSemana: porEquipo.get(m.team_id)?.dia_convocatoria }),
  }));

  // ── 2. qué toca (módulo puro) ──
  const toca = avisosDe({ ahora, ventanaMin: VENTANA_MIN, sesiones, partidos, equipos });

  // ── 3. encolar ANTES de mandar ──
  const filas = toca.flatMap((a) => a.para.map((user_id) => ({
    user_id, tipo: a.tipo, clave: a.clave, titulo: a.titulo, cuerpo: a.cuerpo || null, url: a.url || null,
  })));
  if (filas.length) {
    // el índice único de la 031 hace el trabajo: lo que ya estaba, se ignora
    await sb.from('avisos').upsert(filas, { onConflict: 'user_id,clave', ignoreDuplicates: true });
  }

  // ── 4. mandar lo que siga sin mandar ──
  const { data: pendientes } = await sb.from('avisos')
    .select('id, user_id, tipo, clave, titulo, cuerpo, url')
    .is('enviado_at', null)
    .limit(200);

  if (!pendientes?.length) {
    return new Response(JSON.stringify({ ok: true, encolados: filas.length, enviados: 0 }), { status: 200 });
  }

  const { data: suscripciones } = await sb.from('push_suscripciones')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', [...new Set(pendientes.map((a) => a.user_id))]);

  const porUsuario = new Map();
  for (const s of suscripciones || []) {
    if (!porUsuario.has(s.user_id)) porUsuario.set(s.user_id, []);
    porUsuario.get(s.user_id).push(s);
  }

  let enviados = 0;
  const muertas = [], mandados = [];

  for (const a of pendientes) {
    const suyas = porUsuario.get(a.user_id) || [];
    /* Sin ningún dispositivo suscrito NO se marca como enviado: así el
       aviso sigue pendiente y se manda el día que esa persona se
       suscriba. En la bandeja de la app ya se ve desde ahora. */
    if (!suyas.length) continue;

    const carga = JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tag: a.clave });
    let algunoBien = false;

    for (const s of suyas) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          carga,
        );
        algunoBien = true;
        enviados += 1;
      } catch (e) {
        // 404/410 = ese navegador ya no existe. Se limpia o se le manda
        // un push a nadie en cada ejecución, para siempre.
        if (e?.statusCode === 404 || e?.statusCode === 410) muertas.push(s.id);
        else console.warn('[avisos] fallo al mandar', s.id, e?.statusCode || e?.message);
      }
    }
    if (algunoBien) mandados.push(a.id);
  }

  if (mandados.length) {
    await sb.from('avisos').update({ enviado_at: new Date().toISOString() }).in('id', mandados);
  }
  if (muertas.length) {
    await sb.from('push_suscripciones').delete().in('id', muertas);
  }

  console.log(`[avisos] encolados ${filas.length} · enviados ${enviados} · endpoints muertos ${muertas.length}`);
  return new Response(JSON.stringify({
    ok: true, encolados: filas.length, enviados, muertas: muertas.length,
  }), { status: 200 });
}
