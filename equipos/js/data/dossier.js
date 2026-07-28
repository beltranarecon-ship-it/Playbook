/* ============================================================
   dossier.js — motor PURO del dossier exportable (M7).
   Sin DOM, sin Supabase, sin relojes: las MISMAS entradas dan
   SIEMPRE el mismo Markdown. Eso es lo que lo hace pegable en un
   chat con Claude sin sorpresas, y lo que permite testearlo entero
   en Node (equipos/tools/eval-dossier.mjs).

   Decisión congelada del proyecto: la memoria del equipo es un
   documento que TÚ pegas donde quieras, no un chat integrado. Aquí
   solo se redacta; quien lo lea decide qué hacer con él.
   ============================================================ */

import { resumenAsistencia, estadisticasJugadores } from './asistencia.js';
import { curvaCarga } from './carga.js';
import { balancePartidos, mediasPorEje, resultadoPartido, EJES_VALORACION } from './partidos.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** '2026-10-07' → '7 de octubre de 2026'. Sin Date: inmune a zonas horarias. */
export function fechaLegible(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}
const uno = (n) => (n == null ? '—' : (Math.round(n * 10) / 10).toString());
const limpio = (s) => String(s ?? '').replace(/\r/g, '').trim();
/** Texto libre a una línea: el Markdown de una tabla no soporta saltos. */
const enLinea = (s) => limpio(s).replace(/\s*\n+\s*/g, ' · ');
/** Celda de tabla: un '|' sin escapar parte la fila y añade una columna. */
const celda = (s) => enLinea(s).replace(/\|/g, '\\|');
/** Una sesión cancelada no ocurrió: no promedia ni suma en ningún sitio. */
const ocurrio = (s) => s.estado !== 'cancelada';

/**
 * Números de la temporada, ya cruzados. Se calcula aparte del Markdown
 * porque la vista también los enseña en pantalla antes de exportar.
 * @returns {sesiones:{...}, asistencia:{...}, carga:{...}, cumplimiento:{...}, partidos:{...}}
 */
export function resumenTemporada({ sesiones = [], asistenciaPorSesion = {}, cumplimientoPorSesion = {}, partidos = [] } = {}) {
  const realizadas = sesiones.filter((s) => s.estado === 'realizada');
  const canceladas = sesiones.filter((s) => s.estado === 'cancelada');

  let sumaPct = 0, nPct = 0, sumaCarga = 0, nCarga = 0, sumaCumpl = 0, nCumpl = 0;
  for (const s of sesiones) {
    // Se cancela DESPUÉS de pasar lista y las filas se quedan. La ficha del
    // equipo ya las excluía (attendance.js) y el dossier no: dos pantallas
    // daban medias distintas del mismo equipo.
    if (!ocurrio(s)) continue;
    const filas = asistenciaPorSesion[s.id];
    if (filas?.length) { sumaPct += resumenAsistencia(filas).pct; nPct++; }
    if (s.carga_total) { sumaCarga += Number(s.carga_total); nCarga++; }
    // El cumplimiento entra YA resuelto desde v_session_cumplimiento, la única
    // puerta que el contrato admite. Aquí no se toca reflection_answers.
    const cumpl = cumplimientoPorSesion[s.id];
    if (cumpl != null) { sumaCumpl += Number(cumpl); nCumpl++; }
  }

  return {
    sesiones: {
      total: sesiones.length,
      realizadas: realizadas.length,
      canceladas: canceladas.length,
      pendientes: sesiones.length - realizadas.length - canceladas.length,
    },
    asistencia: { media: nPct ? sumaPct / nPct : null, listasPasadas: nPct },
    carga: { media: nCarga ? sumaCarga / nCarga : null, conBloques: nCarga },
    cumplimiento: { media: nCumpl ? sumaCumpl / nCumpl : null, evaluadas: nCumpl },
    partidos: balancePartidos(partidos),
  };
}

// ── Secciones (cada una devuelve un bloque de líneas o []) ────

function secEquipo({ equipo, temporada, rango, jugadores }) {
  const activos = jugadores.filter((j) => j.estado === 'activo').length;
  const lesionados = jugadores.filter((j) => j.estado === 'lesionado').length;
  const bajas = jugadores.filter((j) => j.estado === 'baja').length;
  const plantilla = [
    `${activos} en activo`,
    lesionados ? `${lesionados} lesionad${lesionados === 1 ? 'o/a' : 'os/as'}` : null,
    bajas ? `${bajas} de baja` : null,
  ].filter(Boolean).join(' · ');

  return [
    `# ${equipo.name} · temporada ${temporada.label}`,
    '',
    `Periodo del dossier: **${fechaLegible(rango.desde)}** → **${fechaLegible(rango.hasta)}**.`,
    equipo.category ? `Categoría: ${equipo.category}.` : null,
    jugadores.length ? `Plantilla: ${plantilla}.` : 'Plantilla sin cargar.',
  ].filter((l) => l !== null);
}

/**
 * `dis[clave] === false` significa «la consulta FALLÓ», no «no hay nada».
 * Un dossier que dice "0 partidos" cuando la tabla no se pudo leer es peor
 * que uno que lo admite: es una afirmación falsa en un documento que el
 * entrenador pega como si fuera el registro de la temporada.
 */
const ILEGIBLE = 'no se pudo leer (dato ausente, no cero)';

function secResumen(r, dis = {}) {
  const p = r.partidos;
  return [
    '',
    '## Cómo va la temporada',
    '',
    dis.sesiones === false
      ? `- **Entrenos**: ${ILEGIBLE}`
      : `- **Entrenos**: ${r.sesiones.total} en el periodo · ${r.sesiones.realizadas} realizados`
        + (r.sesiones.canceladas ? ` · ${r.sesiones.canceladas} cancelados` : '')
        + (r.sesiones.pendientes ? ` · ${r.sesiones.pendientes} por delante` : ''),
    dis.asistencia === false
      ? `- **Asistencia**: ${ILEGIBLE}`
      : r.asistencia.media != null
        ? `- **Asistencia media**: ${Math.round(r.asistencia.media)} % (sobre ${r.asistencia.listasPasadas} listas pasadas)`
        : '- **Asistencia**: sin listas pasadas todavía',
    r.carga.media != null
      ? `- **Carga media por sesión**: ${Math.round(r.carga.media)} (intensidad × minutos)`
      : null,
    dis.cumplimiento === false
      ? `- **Cumplimiento del plan**: ${ILEGIBLE}`
      : r.cumplimiento.media != null
        ? `- **Cumplimiento del plan**: ${uno(r.cumplimiento.media)} / 5 (sobre ${r.cumplimiento.evaluadas} sesiones evaluadas)`
        : null,
    dis.partidos === false
      ? `- **Partidos**: ${ILEGIBLE}`
      : p.jugados
        ? `- **Partidos**: ${p.jugados} jugados · ${p.victorias}-${p.derrotas}${p.empates ? '-' + p.empates : ''}`
          + ` · ${p.pctVictorias} % de victorias · ${p.difMedia > 0 ? '+' : ''}${uno(p.difMedia)} de diferencia media`
        : '- **Partidos**: ninguno jugado en el periodo',
  ].filter(Boolean);
}

const PIEZAS = {
  jugadores: 'la plantilla', sesiones: 'los entrenos',
  objetivos: 'los objetivos', bloques: 'los bloques planificados',
  asistencia: 'la asistencia', reflexion: 'la reflexión',
  cumplimiento: 'el cumplimiento del plan', partidos: 'los partidos',
  notas: 'las notas del cuerpo técnico',
};

/** Cierra el dossier admitiendo qué no se pudo consultar. */
function secIlegible({ disponible }) {
  const faltan = Object.keys(PIEZAS).filter((k) => disponible[k] === false);
  if (!faltan.length) return [];
  return [
    '', '## Lo que este dossier no pudo leer', '',
    ...faltan.map((k) => `- ${PIEZAS[k]}`),
    '',
    '_No quiere decir que no haya nada: quiere decir que la consulta falló._',
    '_Los números de arriba NO lo incluyen._',
  ];
}

function secObjetivos({ objetivos, sesionesPorObjetivo }) {
  if (!objetivos.length) return [];
  const linea = (o) => {
    const n = sesionesPorObjetivo[o.id] || 0;
    return `- **${limpio(o.titulo)}** _(${o.categoria})_ · ${o.fecha_inicio} → ${o.fecha_fin}`
      + ` · trabajado en ${n} ${n === 1 ? 'sesión' : 'sesiones'}`   // el plural pierde la tilde
      + (o.descripcion ? `\n  ${enLinea(o.descripcion)}` : '');
  };
  const porEstado = (e) => objetivos.filter((o) => o.estado === e);
  const out = ['', '## Objetivos', ''];
  for (const [estado, titulo] of [['activo', 'En marcha'], ['conseguido', 'Conseguidos'], ['archivado', 'Archivados']]) {
    const lista = porEstado(estado);
    if (!lista.length) continue;
    out.push(`### ${titulo}`, '');
    out.push(...lista.map(linea), '');
  }
  return out;
}

function secAsistencia({ jugadores, filasAsistencia }) {
  const activos = jugadores.filter((j) => j.estado !== 'baja');
  if (!activos.length || !filasAsistencia.length) return [];
  const stats = estadisticasJugadores(activos, filasAsistencia)
    .filter((s) => s.total > 0)
    // a igualdad de %, desempate por player_id: dos exportaciones seguidas no
    // pueden barajar la tabla (el orden de las filas de BD no está garantizado)
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1)
      || String(a.player_id).localeCompare(String(b.player_id)));
  if (!stats.length) return [];
  return [
    '', '## Asistencia por jugador/a', '',
    '| Jugador/a | Asistencia | Entrenó | Faltas sin avisar | Faltas avisadas |',
    '|---|---:|---:|---:|---:|',
    ...stats.map((s) => `| ${celda(s.nombre)} | ${s.pct} % | ${s.entrenaron}/${s.total} | ${s.ausentes} | ${s.justificadas} |`),
  ];
}

function secSesiones({ sesiones, bloquesPorSesion, asistenciaPorSesion, respuestasPorSesion, objetivosPorSesion, detalle }) {
  const conHistoria = sesiones.filter((s) => s.estado === 'realizada' || s.estado === 'cancelada'
    || asistenciaPorSesion[s.id]?.length || respuestasPorSesion[s.id]?.length);
  if (!conHistoria.length) return [];
  const out = ['', '## Sesión a sesión', ''];

  for (const s of conHistoria) {
    const titulo = limpio(s.titulo) || (objetivosPorSesion[s.id] || []).map((o) => o.titulo).join(' + ') || 'Sesión';
    out.push(`### ${s.fecha} · ${titulo}${s.estado === 'cancelada' ? ' _(cancelada)_' : ''}`);

    if (s.estado === 'cancelada') {
      out.push(`- Motivo: ${enLinea(s.cancel_motivo) || 'sin indicar'}`, '');
      continue;
    }

    const bloques = bloquesPorSesion[s.id] || [];
    const c = curvaCarga(bloques);
    const filas = asistenciaPorSesion[s.id] || [];
    const a = resumenAsistencia(filas);
    const datos = [
      bloques.length ? `${c.duracion} min · carga ${c.carga}` : null,
      filas.length ? `asistencia ${a.entrenaron}/${a.total} (${a.pct} %)` : null,
    ].filter(Boolean).join(' · ');
    if (datos) out.push(`- ${datos}`);

    const objs = objetivosPorSesion[s.id] || [];
    if (objs.length) out.push(`- Objetivos: ${objs.map((o) => limpio(o.titulo)).join(' · ')}`);

    if (detalle && bloques.length) {
      out.push(`- Bloques: ${bloques.map((b) => `${limpio(b.titulo)} (${b.duracion_min}′, int ${b.intensidad})`).join(' · ')}`);
    }

    if (filas.length) {
      const faltas = filas.filter((f) => f.estado !== 'presente' && f.estado !== 'tarde');
      if (faltas.length) {
        out.push(`- Faltaron: ${faltas.map((f) => `${limpio(f.nombre || f.player_id)} (${f.estado}${f.motivo ? ': ' + enLinea(f.motivo) : ''})`).join(' · ')}`);
      }
    }

    for (const r of respuestasPorSesion[s.id] || []) {
      const etiqueta = limpio(r.etiqueta_snapshot) || r.clave_snapshot;
      if (r.tipo_snapshot === 'estrellas' && r.valor_num != null) out.push(`- ${etiqueta}: ${r.valor_num}/5`);
      else if (r.valor_texto) out.push(`- ${etiqueta}: ${enLinea(r.valor_texto)}`);
    }
    out.push('');
  }
  return out;
}

function secPartidos({ partidos }) {
  if (!partidos.length) return [];
  const out = ['', '## Partidos', ''];
  for (const m of partidos) {
    const res = resultadoPartido(m);
    const marcador = res ? ` — **${m.marcador_favor}-${m.marcador_contra}** (${res})` : ` — ${m.estado}`;
    out.push(`### ${m.fecha} · ${m.es_local ? 'vs' : '@'} ${limpio(m.rival)}${marcador}`);
    const vals = EJES_VALORACION
      .filter((e) => m[e.clave] != null)
      .map((e) => `${e.etiqueta} ${m[e.clave]}/5`);
    if (vals.length) out.push(`- ${vals.join(' · ')}`);
    if (m.claves) out.push(`- Claves: ${enLinea(m.claves)}`);
    out.push('');
  }
  const medias = mediasPorEje(partidos).filter((e) => e.n);
  if (medias.length) {
    out.push('**Medias de la competición**: ' + medias.map((e) => `${e.etiqueta} ${uno(e.media)}`).join(' · '), '');
  }
  return out;
}

function secNotas({ notas }) {
  if (!notas.length) return [];
  return [
    '', '## Notas del cuerpo técnico', '',
    ...notas.map((n) => {
      const cab = [n.fecha, limpio(n.titulo)].filter(Boolean).join(' · ');
      return `- ${cab ? `**${cab}** — ` : ''}${enLinea(n.cuerpo)}`;
    }),
  ];
}

/**
 * El dossier entero en Markdown. Determinista: no consulta el reloj ni
 * ordena por nada inestable. `generadoEl` es opcional y se pasa desde fuera.
 * @param datos {equipo, temporada, rango:{desde,hasta}, jugadores, sesiones,
 *   bloquesPorSesion, asistenciaPorSesion, respuestasPorSesion, objetivos,
 *   objetivosPorSesion, filasAsistencia, partidos, notas,
 *   cumplimientoPorSesion:{sessionId:1..5} — YA resuelto por
 *     v_session_cumplimiento; aquí no se toca reflection_answers,
 *   disponible:{pieza:boolean} — false = la consulta FALLÓ (≠ "no hay datos"):
 *     el documento lo dice en vez de escribir un cero falso}
 * @param opciones {detalle:boolean incluir bloques, generadoEl:'YYYY-MM-DD'}
 */
export function construirDossier(datos = {}, { detalle = true, generadoEl = null } = {}) {
  const d = {
    equipo: { name: 'Equipo' }, temporada: { label: '—' },
    rango: { desde: '', hasta: '' },
    jugadores: [], sesiones: [], objetivos: [], partidos: [], notas: [],
    bloquesPorSesion: {}, asistenciaPorSesion: {}, respuestasPorSesion: {},
    objetivosPorSesion: {}, filasAsistencia: [], cumplimientoPorSesion: {},
    disponible: {},
    ...datos,
  };
  // orden estable: por fecha y, a igualdad, por id (dos sesiones el mismo día
  // no pueden salir en orden distinto entre dos exportaciones)
  const porFecha = (a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.id).localeCompare(String(b.id)));
  d.sesiones = d.sesiones.slice().sort(porFecha);
  d.partidos = d.partidos.slice().sort(porFecha);
  d.notas = d.notas.slice().sort((a, b) =>
    String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')) || String(a.id).localeCompare(String(b.id)));
  // jugadores y objetivos también: el orden de BD no es una garantía, y sin
  // esto dos exportaciones del MISMO periodo podían salir distintas.
  d.jugadores = d.jugadores.slice().sort((a, b) =>
    (a.dorsal ?? 9999) - (b.dorsal ?? 9999)
    || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
    || String(a.id).localeCompare(String(b.id)));
  d.objetivos = d.objetivos.slice().sort((a, b) =>
    String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || ''))
    || String(a.id).localeCompare(String(b.id)));

  // las filas de una sesión cancelada no cuentan (ni en la media ni en la tabla)
  const ocurridas = new Set(d.sesiones.filter(ocurrio).map((s) => String(s.id)));
  d.filasAsistencia = d.filasAsistencia.filter(
    (f) => f.session_id == null || ocurridas.has(String(f.session_id)));

  const sesionesPorObjetivo = {};
  for (const [sesId, objs] of Object.entries(d.objetivosPorSesion)) {
    for (const o of objs) sesionesPorObjetivo[o.id] = (sesionesPorObjetivo[o.id] || 0) + 1;
  }
  const resumen = resumenTemporada(d);

  const lineas = [
    ...secEquipo(d),
    ...secResumen(resumen, d.disponible),
    ...secObjetivos({ objetivos: d.objetivos, sesionesPorObjetivo }),
    ...secAsistencia(d),
    ...secSesiones({ ...d, detalle }),
    ...secPartidos(d),
    ...secNotas(d),
    ...secIlegible(d),
  ];
  if (generadoEl) lineas.push('', '---', `_Dossier generado el ${fechaLegible(generadoEl)} desde Playbook CBP._`);

  // sin líneas en blanco de más al final ni triples saltos por el camino
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Nombre de fichero estable para la descarga. */
export function nombreFicheroDossier(equipo, rango) {
  const slug = String(equipo?.name || 'equipo')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `dossier-${slug}-${rango?.desde || ''}_${rango?.hasta || ''}.md`;
}
