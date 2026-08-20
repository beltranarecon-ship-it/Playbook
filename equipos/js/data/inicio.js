/* ============================================================
   inicio.js — QUÉ SE VE AL ABRIR LA APP (Tramo 4.11).
   Módulo PURO: sin DOM, sin red, sin reloj propio.

   §5.11 pide cinco secciones, en este orden:

     1. lo de HOY, arriba del todo
     2. sin programar de la semana que viene
     3. programados de la semana que viene
     4. realizados de la semana pasada
     5. partidos y convocatorias

   ── EL ORDEN ES EL MENSAJE ──────────────────────────────────
   Primero lo que hay que hacer hoy; después lo que hay que preparar;
   después lo que hay que cerrar; y al final lo que ya pasó. Una
   pantalla de inicio que empieza por el histórico convierte la app en
   un archivo, y esta es una herramienta de martes por la tarde.

   ── LA SEMANA QUE VIENE ES DE LUNES A DOMINGO ───────────────
   No «los próximos siete días». Un entrenador planifica por semanas, y
   el jueves «la semana que viene» empieza el lunes, no el viernes. Con
   una ventana móvil, el domingo por la noche desaparecería de golpe
   media pantalla.
   ============================================================ */

const p2 = (x) => String(x).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** El lunes de la semana de esa fecha (ISO: la semana empieza en lunes). */
export function lunesDe(fechaIso) {
  const d = new Date(`${fechaIso}T12:00:00`);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (dow - 1));
  return iso(d);
}

export function masDias(fechaIso, n) {
  const d = new Date(`${fechaIso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/**
 * Las tres semanas que importan: la pasada, esta y la que viene.
 * @returns {pasada:{desde,hasta}, esta:{...}, proxima:{...}, hoy}
 */
export function semanas(hoyIso) {
  const lunes = lunesDe(hoyIso);
  return {
    hoy: hoyIso,
    pasada: { desde: masDias(lunes, -7), hasta: masDias(lunes, -1) },
    esta: { desde: lunes, hasta: masDias(lunes, 6) },
    proxima: { desde: masDias(lunes, 7), hasta: masDias(lunes, 13) },
  };
}

const dentro = (fecha, r) => fecha >= r.desde && fecha <= r.hasta;

/**
 * Reparte todo en las cinco secciones.
 *
 * @param datos.hoy       'YYYY-MM-DD'
 * @param datos.sesiones  las de las tres semanas
 * @param datos.partidos  los de las tres semanas
 * @param datos.convocatorias  eventos deducidos (`convocatoria.eventoDe`)
 *
 * @returns [{clave, titulo, ayuda, cosas:[...]}] — siempre las cinco,
 *   también las vacías: una sección que desaparece cuando no hay nada
 *   hace que la pantalla cambie de forma cada día y no se aprenda nunca.
 */
export function secciones({ hoy, sesiones = [], partidos = [], convocatorias = [] } = {}) {
  if (!hoy) return [];
  const s = semanas(hoy);

  const deHoy = [
    ...sesiones.filter((x) => x.fecha === hoy && x.estado !== 'cancelada')
      .map((x) => ({ ...x, que: 'sesion' })),
    ...partidos.filter((x) => x.fecha === hoy && x.estado !== 'cancelado')
      .map((x) => ({ ...x, que: 'partido' })),
    ...convocatorias.filter((x) => x.fecha === hoy)
      .map((x) => ({ ...x, que: 'convocatoria' })),
  ].sort(porHora);

  const proximaSinPlan = sesiones
    .filter((x) => dentro(x.fecha, s.proxima) && x.estado === 'preliminar')
    .sort(porFecha);

  const proximaConPlan = sesiones
    .filter((x) => dentro(x.fecha, s.proxima) && x.estado === 'programada')
    .sort(porFecha);

  /* «Realizados de la semana pasada» incluye lo que sigue SIN CERRAR, y
     eso va primero: es lo único de esta sección sobre lo que todavía se
     puede hacer algo. */
  const pasada = sesiones
    .filter((x) => dentro(x.fecha, s.pasada) && x.estado === 'realizada')
    .sort((a, b) => (!!a.evaluada_at) - (!!b.evaluada_at) || porFecha(b, a));

  /* Partidos y convocatorias, de hoy en adelante. Lo de ayer ya está en
     el calendario; aquí interesa lo que hay por delante. */
  const competicion = [
    ...partidos.filter((x) => x.fecha >= hoy && x.estado !== 'cancelado')
      .map((x) => ({ ...x, que: 'partido' })),
    ...convocatorias.filter((x) => x.fecha >= hoy)
      .map((x) => ({ ...x, que: 'convocatoria' })),
  ].sort(porFecha);

  return [
    { clave: 'hoy', titulo: 'Hoy', ayuda: 'Lo que toca ahora mismo.', cosas: deHoy },
    { clave: 'sin_plan', titulo: 'La semana que viene, sin plan', ayuda: 'Esto es lo que hay que sentarse a preparar.', cosas: proximaSinPlan },
    { clave: 'con_plan', titulo: 'La semana que viene, ya planificado', ayuda: '', cosas: proximaConPlan },
    { clave: 'pasada', titulo: 'La semana pasada', ayuda: 'Lo que queda por cerrar sale primero.', cosas: pasada },
    { clave: 'competicion', titulo: 'Partidos y convocatorias', ayuda: '', cosas: competicion },
  ];
}

const hora = (x) => x.hora_inicio || x.hora || '99:99';
const porHora = (a, b) => String(hora(a)).localeCompare(String(hora(b)));
const porFecha = (a, b) => String(a.fecha).localeCompare(String(b.fecha)) || porHora(a, b);

/** «3 sin plan» — el número que hace que se abra la sección. */
export function resumen(secs) {
  const n = (k) => secs.find((s) => s.clave === k)?.cosas.length || 0;
  const partes = [];
  if (n('hoy')) partes.push(`${n('hoy')} cosa${n('hoy') === 1 ? '' : 's'} hoy`);
  if (n('sin_plan')) partes.push(`${n('sin_plan')} sin plan`);
  const sinCerrar = (secs.find((s) => s.clave === 'pasada')?.cosas || []).filter((x) => !x.evaluada_at).length;
  if (sinCerrar) partes.push(`${sinCerrar} sin cerrar`);
  return partes.join(' · ');
}
