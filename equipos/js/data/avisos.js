/* ============================================================
   avisos.js — QUÉ AVISO TOCA AHORA (Tramo 4.8). Módulo PURO:
   sin DOM, sin red, sin reloj propio. La hora se pasa siempre por
   parámetro, y por eso los seis avisos se pueden probar sin esperar
   a que sean las ocho de la tarde de un jueves.

   Lo usan la función programada (netlify/functions/avisos.mjs) y su
   banco. La función no sabe de baloncesto y este módulo no sabe de
   VAPID: el que decide y el que manda no se conocen.

   ── LOS SEIS DE §5.8 ────────────────────────────────────────
     bloque        · fin de bloque, durante el entrenamiento
     lista         · pasar lista al empezar
     sin_programar · la sesión de mañana no está planificada (tarde antes)
     convocatoria  · sin rellenar, el día y a la hora del equipo
     sin_cerrar    · la sesión de ayer sigue sin cerrar
     post_partido  · la mañana siguiente, si falta resultado, valoración o acta

   ── TODO SE PUEDE HACER ABRIENDO EL AVISO ───────────────────
   §5.8, y por eso cada aviso lleva `url`: los botones dentro de la
   notificación solo funcionan en Android, así que no puede haber
   ninguna acción que dependa de ellos. Se toca el aviso y se está en la
   pantalla donde se hace.

   ── LA CLAVE ES EL HECHO, NO EL ENVÍO ───────────────────────
   `sin_cerrar:<session_id>`. Con el índice único de la 031, el mismo
   hecho no se manda dos veces por mucho que la función se reintente.
   La única clave que lleva la hora dentro es la del fin de bloque,
   porque el hecho es distinto en cada bloque.
   ============================================================ */

export const TIPOS = ['bloque', 'lista', 'sin_programar', 'convocatoria', 'sin_cerrar', 'post_partido'];

/* ── Herramientas de reloj ─────────────────────────────────── */

const p2 = (x) => String(x).padStart(2, '0');

/** 'YYYY-MM-DD' de una fecha, en horario local del club. */
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Minutos desde medianoche de un 'HH:MM(:SS)'. */
export function minutosDe(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Los minutos desde medianoche de un instante. */
export const minutosDelDia = (d) => d.getHours() * 60 + d.getMinutes();

/** Suma días a una fecha ISO. */
export function masDias(fechaIso, n) {
  const d = new Date(`${fechaIso}T12:00:00`);   // mediodía: inmune al cambio de hora
  d.setDate(d.getDate() + n);
  return iso(d);
}

/**
 * ¿Cae este minuto dentro de la ventana que se está mirando?
 *
 * La función programada corre cada pocos minutos y pregunta «¿qué tocaba
 * entre la vez anterior y ahora?». Sin ventana, un aviso de las 19:00
 * con la función corriendo a las 19:02 no se manda nunca.
 */
export const enVentana = (minuto, ahoraMin, ventana) =>
  minuto != null && minuto <= ahoraMin && minuto > ahoraMin - ventana;

/* ── Los seis ──────────────────────────────────────────────── */

/**
 * Qué avisos tocan ahora.
 *
 * @param datos.ahora        Date
 * @param datos.ventanaMin   cuántos minutos hacia atrás se mira
 * @param datos.sesiones     las de ayer, hoy y mañana, con sus bloques
 * @param datos.partidos     los de ayer y los próximos
 * @param datos.equipos      [{id, name, dia_convocatoria, hora_convocatoria, coaches:[user_id]}]
 *
 * @returns [{tipo, clave, titulo, cuerpo, url, para: [user_id]}]
 */
export function avisosDe({ ahora, ventanaMin = 15, sesiones = [], partidos = [], equipos = [] } = {}) {
  if (!(ahora instanceof Date) || Number.isNaN(ahora.getTime())) return [];
  const hoy = iso(ahora);
  const ayer = masDias(hoy, -1);
  const manana = masDias(hoy, 1);
  const min = minutosDelDia(ahora);
  const porEquipo = new Map(equipos.map((t) => [t.id, t]));
  const out = [];

  const quien = (teamId) => porEquipo.get(teamId)?.coaches || [];
  const nombre = (teamId) => porEquipo.get(teamId)?.name || 'tu equipo';
  const mete = (a) => { if (a.para.length) out.push(a); };

  for (const s of sesiones) {
    const eq = nombre(s.team_id);

    // ── 1. fin de bloque, con la sesión en marcha ──
    /* El cronómetro de la pantalla ya avisa (3.5). Esto es el respaldo
       de §5.8 para el móvil bloqueado en el bolsillo, que es donde está
       la mitad de las veces. */
    if (s.arranque && s.fecha === hoy && Array.isArray(s.bloques)) {
      const arr = new Date(s.arranque);
      if (!Number.isNaN(arr.getTime())) {
        let acumulado = 0;
        for (const b of s.bloques) {
          acumulado += Number(b.duracion_min) || 0;
          const finMin = minutosDelDia(arr) + acumulado;
          if (!enVentana(finMin, min, ventanaMin)) continue;
          mete({
            tipo: 'bloque',
            // el hecho es ESTE bloque de ESTA sesión, no la sesión
            clave: `bloque:${s.id}:${b.id}`,
            titulo: `Se acabó «${b.titulo || 'el bloque'}»`,
            cuerpo: `${eq} · toca cambiar`,
            url: `/sesiones/${s.id}/activa`,
            para: quien(s.team_id),
          });
        }
      }
    }

    // ── 2. pasar lista al empezar ──
    if (s.fecha === hoy && s.estado !== 'cancelada' && !s.tiene_asistencia
        && enVentana(minutosDe(s.hora_inicio), min, ventanaMin)) {
      mete({
        tipo: 'lista',
        clave: `lista:${s.id}`,
        titulo: 'Pasa lista',
        cuerpo: `${eq} · empieza ahora`,
        url: `/sesiones/${s.id}/activa`,
        para: quien(s.team_id),
      });
    }

    // ── 3. la de mañana sin programar ──
    /* La tarde anterior (§7). A esa hora todavía se puede sentar uno
       diez minutos; a las siete de la mañana del día siguiente, no. */
    if (s.fecha === manana && s.estado === 'preliminar'
        && enVentana(HORA_TARDE, min, ventanaMin)) {
      mete({
        tipo: 'sin_programar',
        clave: `sin_programar:${s.id}`,
        titulo: 'Mañana entrenáis y no hay plan',
        cuerpo: `${eq} · ${s.hora_inicio ? s.hora_inicio.slice(0, 5) : 'mañana'}`,
        url: `/sesiones/${s.id}`,
        para: quien(s.team_id),
      });
    }

    // ── 5. la de ayer sin cerrar ──
    if (s.fecha === ayer && s.estado !== 'cancelada' && !s.evaluada_at
        && enVentana(HORA_TARDE, min, ventanaMin)) {
      mete({
        tipo: 'sin_cerrar',
        clave: `sin_cerrar:${s.id}`,
        titulo: 'Te queda cerrar el entrenamiento de ayer',
        cuerpo: `${eq} · dos minutos`,
        url: `/sesiones/${s.id}/cierre`,
        para: quien(s.team_id),
      });
    }
  }

  for (const m of partidos) {
    const eq = porEquipo.get(m.team_id);
    if (!eq) continue;

    // ── 4. convocatoria sin rellenar ──
    /* El día que diga el equipo y a la hora que diga el equipo. Sin hora
       puesta NO se avisa: mejor callarse que despertar a alguien. */
    if (m.dia_convocatoria_iso === hoy && eq.hora_convocatoria
        && !(m.convocados || []).length
        && enVentana(minutosDe(eq.hora_convocatoria), min, ventanaMin)) {
      mete({
        tipo: 'convocatoria',
        clave: `convocatoria:${m.id}`,
        titulo: 'Falta la convocatoria',
        cuerpo: `${eq.name} · ${m.es_local ? 'vs' : '@'} ${m.rival}`,
        // «todo se puede hacer abriendo el aviso» (§5.8): el aviso de que
        // falta la convocatoria abre la convocatoria, no el marcador
        url: `/partidos/${m.id}/convocatoria`,
        para: eq.coaches || [],
      });
    }

    // ── 6. post-partido ──
    /* La mañana siguiente, y solo si falta algo. Un aviso que llega
       cuando ya está todo hecho enseña a ignorar los avisos. */
    if (m.fecha === ayer && m.estado === 'jugado'
        && enVentana(HORA_MANANA, min, ventanaMin)) {
      const falta = faltaDelPartido(m);
      if (falta.length) {
        mete({
          tipo: 'post_partido',
          clave: `post_partido:${m.id}`,
          titulo: 'El partido de ayer está a medias',
          cuerpo: `${eq.name} · falta ${falta.join(', ')}`,
          url: `/partidos/${m.id}`,
          para: eq.coaches || [],
        });
      }
    }
  }

  return out;
}

/** La tarde: la hora a la que un entrenador todavía puede sentarse. */
export const HORA_TARDE = 19 * 60;
/** La mañana siguiente a un partido. */
export const HORA_MANANA = 10 * 60;

/** Qué le falta a un partido jugado (§5.8: resultado, valoración o acta). */
export function faltaDelPartido(m) {
  const falta = [];
  if (m?.marcador_favor == null || m?.marcador_contra == null) falta.push('el resultado');
  const ejes = ['val_defensa', 'val_ataque', 'val_actitud', 'val_acierto', 'val_global'];
  if (!ejes.some((k) => m?.[k] != null)) falta.push('la valoración');
  if (!m?.acta_path) falta.push('el acta');
  return falta;
}

/* ── Los de entrenador a entrenador (4.13) ─────────────────── */

/**
 * El aviso de que un compañero ha tocado algo del equipo.
 *
 * `clave` lleva la hora dentro a propósito: aquí el hecho es «lo cambió
 * a las siete y veinte», y dos cambios distintos del mismo plan son dos
 * avisos. Si compartieran clave, el segundo no llegaría nunca y el otro
 * entrenador se quedaría con la versión de antes creyendo que está al
 * día — que es exactamente lo que esta fila viene a evitar.
 */
export function avisoDeCambio({ quienCambia, nombreQuienCambia, equipo, que, url, cuando }) {
  const sello = cuando instanceof Date ? cuando.toISOString().slice(0, 16) : String(cuando || '');
  return {
    tipo: 'equipo',
    clave: `equipo:${equipo?.id || '?'}:${que}:${sello}`,
    titulo: `${nombreQuienCambia || 'Alguien'} ha tocado ${que}`,
    cuerpo: equipo?.name || '',
    url: url || null,
    // a los del equipo MENOS al que lo ha cambiado: avisarle de lo que
    // acaba de hacer él es la manera más rápida de que silencie la app
    para: (equipo?.coaches || []).filter((u) => u !== quienCambia),
  };
}
