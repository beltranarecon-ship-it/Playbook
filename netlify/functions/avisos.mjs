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

/* Cada cuánto corre. La ventana tiene que ser >= al intervalo o se
   pierden avisos entre dos ejecuciones. */
export const config = { schedule: '*/10 * * * *' };
const VENTANA_MIN = 12;

const iso = (d) => d.toISOString().slice(0, 10);

export default async function handler() {
  const {
    SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
    VAPID_CONTACTO = 'mailto:playbook@cbpalencia.es',
  } = process.env;

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
