/* ============================================================
   calendario.js — /sesiones · vistas MES y SEMANA.
   Color por equipo (banda), estado por estilo (preliminar=contorno
   discontinuo, programada=relleno suave, realizada=sólido,
   cancelada=tachado), sombreado de días sin entreno, filtro por
   equipo, panel de día con acciones y alta manual.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast, toastDeshacer } from '../ui/toast.js';
import { abrirModal, confirmar, pedirTexto } from '../ui/modal.js';
import { puntoEquipo } from '../ui/components.js';
import { getMisEquipos } from '../data/teams.js';
import { getPeriodos } from '../data/schedules.js';
import {
  getTemporadaActiva, getSesionesRango, crearSesionManual,
  reprogramarSesion, promoverSesion, cancelarSesion, restaurarSesion, borrarPreliminar,
} from '../data/sessions.js';
import { getState, setState, esAdmin } from '../store.js';
import { diasEntre, isoWeekday, enPeriodo, temporadaCubre } from '../data/programacion.js';
import { avisoTemporada, modalTemporada } from './temporada-form.js';
import { getObjetivosRango } from '../data/objectives.js';
import { getPartidosRango, crearPartido } from '../data/matches.js';
import { resultadoPartido, ESTADOS_PARTIDO } from '../data/partidos.js';
import { objetivosEnFecha, tituloHeredado } from '../data/sugerencias.js';
import { modalObjetivo, filaObjetivo } from './objetivo-form.js';
import { ESTADOS_SESION, WEEKDAYS } from '../config.js';
import { router } from '../main.js';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const lunesDe = (iso) => {
  const t = Date.parse(iso + 'T00:00:00Z') - (isoWeekday(iso) - 1) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};
const sumaDias = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const hhmm = (t) => (t ? t.slice(0, 5) : '');

export function render(root) {
  const qs = new URLSearchParams(location.search);
  const st = getState();
  const estado = {
    vista: st.vistaCal || 'mes',                       // 'mes' | 'semana'
    filtro: qs.get('equipo') || st.filtroCalendario || 'todos',
    cursor: hoyISO(),                                  // un día dentro del mes/semana visible
  };
  let equipos = [], temporada = null, colores = new Map(), nombres = new Map();
  let objetivos = [];                                  // los del rango visible
  const sel = { activo: false, inicio: null };         // modo "crear objetivo"
  const celdas = new Map();                            // fecha → celda pintada

  const cont = h('div', { class: 'eq-page' });
  mount(root, cont);

  // ── selección de días → nuevo objetivo ─────────────────────
  let hintEl = null;
  const pintaHint = () => {
    if (!hintEl) return;
    hintEl.style.display = sel.activo ? '' : 'none';
    if (sel.activo) hintEl.querySelector('span').textContent = sel.inicio
      ? `Del ${sel.inicio}… toca el último día del objetivo`
      : 'Toca el primer día del objetivo';
  };
  const salirSeleccion = () => {
    sel.activo = false; sel.inicio = null;
    for (const c of celdas.values()) c.classList.remove('sel-obj');
    pintaHint();
  };
  const entrarSeleccion = () => {
    if (!equipos.length) { toast('Crea antes un equipo', 'error'); return; }
    sel.activo = true; sel.inicio = null;
    pintaHint();
  };

  function clickDia(fecha) {
    if (!sel.activo) { panelDia(fecha); return; }
    if (!sel.inicio) {
      sel.inicio = fecha;
      celdas.get(fecha)?.classList.add('sel-obj');
      pintaHint();
      return;
    }
    const [inicio, fin] = [sel.inicio, fecha].sort();
    salirSeleccion();
    modalObjetivo({
      equipos,
      teamId: estado.filtro !== 'todos' ? estado.filtro : null,
      temporada,
      fechas: { inicio, fin },
      onGuardado: refrescar,
    });
  }

  // ── rango visible ──────────────────────────────────────────
  function rango() {
    if (estado.vista === 'semana') {
      const ini = lunesDe(estado.cursor);
      return { desde: ini, hasta: sumaDias(ini, 6) };
    }
    const [y, m] = estado.cursor.split('-').map(Number);
    const primero = `${y}-${String(m).padStart(2, '0')}-01`;
    const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { desde: lunesDe(primero), hasta: sumaDias(lunesDe(ultimo), 6), primero, ultimo };
  }

  function mueve(n) {
    if (estado.vista === 'semana') estado.cursor = sumaDias(lunesDe(estado.cursor), n * 7);
    else {
      const [y, m] = estado.cursor.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + n, 1));
      estado.cursor = d.toISOString().slice(0, 10);
    }
    refrescar();
  }

  // ── chip de sesión ─────────────────────────────────────────
  const chip = (s) => h('button', {
    class: `eq-ses eq-ses-${s.estado}`, type: 'button',
    style: { '--team-color': colores.get(s.team_id) || 'var(--muted)' },
    title: `${nombres.get(s.team_id) || ''} · ${ESTADOS_SESION[s.estado]}`,
    onClick: (e) => { e.stopPropagation(); panelDia(s.fecha); },
  },
    h('span', { class: 'eq-ses-hora' }, hhmm(s.hora_inicio) || '·'),
    h('span', { class: 'eq-ses-equipo' }, nombres.get(s.team_id) || '—'),
  );

  // Chip de partido: se distingue de un entreno de un vistazo (borde sólido
  // del color del equipo + marcador si ya está jugado).
  const chipPartido = (m) => {
    const res = resultadoPartido(m);
    return h('button', {
      class: `eq-part-chip${res ? ' eq-part-' + res : ''}${m.estado === 'cancelado' || m.estado === 'aplazado' ? ' atenuado' : ''}`,
      type: 'button',
      style: { '--team-color': colores.get(m.team_id) || 'var(--muted)' },
      title: `${nombres.get(m.team_id) || ''} · ${m.es_local ? 'vs' : '@'} ${m.rival} · ${ESTADOS_PARTIDO[m.estado]}`,
      onClick: (e) => { e.stopPropagation(); router.navigate(`/partidos/${m.id}`); },
    },
      h('span', { class: 'eq-part-chip-vs' }, m.es_local ? 'vs' : '@'),
      h('span', { class: 'eq-part-chip-rival' }, m.rival),
      res ? h('span', { class: 'eq-part-chip-res' }, `${m.marcador_favor}-${m.marcador_contra}`) : null,
    );
  };

  // ── panel de día ───────────────────────────────────────────
  async function panelDia(fecha) {
    const filtroDia = estado.filtro === 'todos' ? null : estado.filtro;
    const [sesiones, partidosDia] = await Promise.all([
      getSesionesRango({ desde: fecha, hasta: fecha, teamId: filtroDia }),
      getPartidosRango({ desde: fecha, hasta: fecha, teamId: filtroDia }).catch(() => []),
    ]);
    const [y, m, d] = fecha.split('-').map(Number);
    const titulo = `${WEEKDAYS[isoWeekday(fecha) - 1].nombre} ${d} de ${MESES[m - 1]}`;

    const filaSesion = (s) => h('div', { class: 'eq-dia-ses', style: { '--team-color': colores.get(s.team_id) || 'var(--muted)' } },
      h('div', { class: 'eq-dia-ses-info' },
        h('span', { class: 'eq-dia-ses-equipo' }, puntoEquipo(colores.get(s.team_id)), ' ', nombres.get(s.team_id) || '—'),
        // herencia viva (M3): sin título propio, hereda el de los objetivos del día
        tituloHeredado(s, objetivos) ? h('span', { class: 'eq-dia-ses-titulo' }, tituloHeredado(s, objetivos)) : null,
        h('span', { class: 'eq-dia-ses-meta' },
          [hhmm(s.hora_inicio) && `${hhmm(s.hora_inicio)}–${hhmm(s.hora_fin)}`, s.lugar, ESTADOS_SESION[s.estado]]
            .filter(Boolean).join(' · ')),
        s.estado === 'cancelada' && s.cancel_motivo ? h('span', { class: 'eq-dia-ses-meta' }, `Motivo: ${s.cancel_motivo}`) : null,
      ),
      h('div', { class: 'eq-dia-ses-acciones' },
        // el foco cambia con el tiempo: lo de mañana se planifica, lo de ayer
        // se cierra (pasar lista + reflexión)
        h('button', {
          class: `btn ${s.fecha <= hoyISO() && s.estado !== 'cancelada' ? 'btn-secondary' : 'btn-primary'} eq-btn-mini`,
          type: 'button',
          onClick: () => { md.cerrar(); router.navigate(`/sesiones/${s.id}`); },
        }, s.estado === 'preliminar' ? 'Planificar' : 'Abrir plan'),
        s.estado !== 'cancelada' && (s.fecha <= hoyISO() || s.estado === 'realizada') ? h('button', {
          class: `btn ${s.estado === 'realizada' ? 'btn-secondary' : 'btn-primary'} eq-btn-mini`,
          type: 'button',
          onClick: () => { md.cerrar(); router.navigate(`/sesiones/${s.id}/cierre`); },
        }, s.estado === 'realizada' ? 'Ver cierre' : 'Cerrar sesión') : null,
        (s.estado === 'preliminar' || s.estado === 'programada') ? h('button', {
          class: 'btn btn-secondary eq-btn-mini', type: 'button',
          onClick: () => {
            const inp = h('input', { class: 'field-input', type: 'date', value: s.fecha });
            const md2 = abrirModal({
              titulo: 'Reprogramar sesión',
              cuerpo: h('div', { class: 'field-group' }, h('label', { class: 'field-label' }, 'Nueva fecha'), inp),
              pie: [
                h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md2.cerrar() }, 'Cancelar'),
                h('button', {
                  class: 'btn btn-primary', type: 'button',
                  onClick: async () => {
                    if (!inp.value) return;
                    await reprogramarSesion(s.id, inp.value);
                    md2.cerrar(); md.cerrar(); refrescar();
                    toast(`Movida al ${inp.value}`);
                  },
                }, 'Mover'),
              ],
            });
          },
        }, 'Reprogramar') : null,
        (s.estado === 'preliminar' || s.estado === 'programada') ? h('button', {
          class: 'btn btn-secondary eq-btn-mini eq-btn-peligro', type: 'button',
          onClick: async () => {
            const motivo = await pedirTexto({
              titulo: 'Cancelar sesión',
              etiqueta: 'Motivo (obligatorio)', placeholder: 'Lluvia, pabellón cerrado…',
            });
            if (!motivo) return;
            await cancelarSesion(s.id, motivo);
            md.cerrar(); refrescar();
            toastDeshacer('Sesión cancelada', async () => { await restaurarSesion(s.id); refrescar(); });
          },
        }, 'Cancelar') : null,
        (s.origen === 'auto' && s.estado === 'preliminar') ? h('button', {
          class: 'btn btn-secondary eq-btn-mini', type: 'button', title: 'Eliminar esta preliminar',
          onClick: async () => {
            if (!(await confirmar({ titulo: 'Eliminar preliminar', mensaje: '¿Eliminar esta sesión preliminar? (solo se borra el hueco automático)', textoOk: 'Eliminar' }))) return;
            // la RLS la protege si ya tiene lista o reflexión (015 §7), y lo
            // hace en silencio: sin comprobarlo diríamos "eliminada" mintiendo
            const fue = await borrarPreliminar(s.id);
            md.cerrar(); refrescar();
            toast(fue
              ? 'Preliminar eliminada'
              : 'No se eliminó: esta sesión ya tiene lista o reflexión guardadas', fue ? undefined : 'error');
          },
        }, 'Eliminar') : null,
      ),
    );

    const filaPartido = (m) => h('div', { class: 'eq-dia-ses', style: { '--team-color': colores.get(m.team_id) || 'var(--muted)' } },
      h('div', { class: 'eq-dia-ses-info' },
        h('span', { class: 'eq-dia-ses-equipo' }, puntoEquipo(colores.get(m.team_id)), ' ', nombres.get(m.team_id) || '—'),
        h('span', { class: 'eq-dia-ses-titulo' }, `${m.es_local ? 'vs' : '@'} ${m.rival}`),
        h('span', { class: 'eq-dia-ses-meta' },
          [hhmm(m.hora), m.lugar, ESTADOS_PARTIDO[m.estado],
            resultadoPartido(m) ? `${m.marcador_favor}-${m.marcador_contra}` : null]
            .filter(Boolean).join(' · ')),
      ),
      h('div', { class: 'eq-dia-ses-acciones' },
        h('button', {
          class: 'btn btn-primary eq-btn-mini', type: 'button',
          onClick: () => { md.cerrar(); router.navigate(`/partidos/${m.id}`); },
        }, m.estado === 'jugado' ? 'Ver partido' : 'Abrir partido'),
      ),
    );

    const formAlta = () => {
      const m0 = {
        team_id: estado.filtro !== 'todos' ? estado.filtro : (equipos[0]?.id || ''),
        hora_inicio: '', hora_fin: '', lugar: '', rival: '', es_local: true,
      };
      return h('div', { class: 'eq-dia-alta' },
        h('div', { class: 'field-row' },
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Equipo'),
            h('select', { class: 'field-select', onChange: (e) => { m0.team_id = e.target.value; } },
              ...equipos.map((t) => h('option', { value: t.id, ...(t.id === m0.team_id ? { selected: true } : {}) }, t.name))),
          ),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Lugar'),
            h('input', { class: 'field-input', type: 'text', onInput: (e) => { m0.lugar = e.target.value; } }),
          ),
        ),
        h('div', { class: 'field-row' },
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Inicio'),
            h('input', { class: 'field-input', type: 'time', onChange: (e) => { m0.hora_inicio = e.target.value; } })),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Fin'),
            h('input', { class: 'field-input', type: 'time', onChange: (e) => { m0.hora_fin = e.target.value; } })),
        ),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onClick: async () => {
            if (!m0.team_id) { toast('Elige un equipo', 'error'); return; }
            try {
              await crearSesionManual({ team_id: m0.team_id, season_id: temporada.id, fecha, ...m0 });
              md.cerrar(); refrescar(); toast('Sesión añadida');
            } catch (e) { toast('Error: ' + e.message, 'error'); }
          },
        }, 'Añadir sesión este día'),

        // …o un PARTIDO: mismo día, mismo equipo, otra naturaleza
        h('div', { class: 'eq-dia-alta-part' },
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Rival'),
            h('input', {
              class: 'field-input', type: 'text', placeholder: 'CB Palencia',
              onInput: (e) => { m0.rival = e.target.value; },
            }),
          ),
          h('div', { class: 'eq-catchips', role: 'radiogroup', 'aria-label': 'Local o visitante' },
            ...[[true, 'Local'], [false, 'Visitante']].map(([v, txt]) => h('button', {
              class: 'eq-catchip' + (m0.es_local === v ? ' sel' : ''), type: 'button',
              role: 'radio', 'aria-checked': String(m0.es_local === v),
              onClick: (e) => {
                m0.es_local = v;
                [...e.target.parentNode.children].forEach((b, i) => b.classList.toggle('sel', i === (v ? 0 : 1)));
              },
            }, txt)),
          ),
          h('button', {
            class: 'btn btn-secondary', type: 'button',
            onClick: async () => {
              if (!m0.team_id) { toast('Elige un equipo', 'error'); return; }
              if (!m0.rival.trim()) { toast('Falta el rival', 'error'); return; }
              try {
                const nuevo = await crearPartido({
                  team_id: m0.team_id, season_id: temporada.id, fecha,
                  hora: m0.hora_inicio, lugar: m0.lugar, rival: m0.rival, es_local: m0.es_local,
                });
                md.cerrar(); toast('Partido añadido');
                router.navigate(`/partidos/${nuevo.id}`);
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Añadir partido este día'),
        ),
      );
    };

    const objsDia = objetivosEnFecha(fecha, objetivos)
      .filter((o) => estado.filtro === 'todos' || o.team_id === estado.filtro);

    const md = abrirModal({
      titulo,
      cuerpo: h('div', {},
        objsDia.length ? h('div', { class: 'eq-dia-objs' },
          ...objsDia.map((o) => filaObjetivo(o, {
            color: colores.get(o.team_id),
            nombreEquipo: estado.filtro === 'todos' ? nombres.get(o.team_id) : null,
          })),
        ) : null,
        partidosDia.length ? h('div', { class: 'eq-dia-lista' }, partidosDia.map(filaPartido)) : null,
        sesiones.length
          ? h('div', { class: 'eq-dia-lista' }, sesiones.map(filaSesion))
          : h('p', { class: 'eq-ayuda' }, partidosDia.length ? 'Sin entrenos este día.' : 'Sin sesiones este día.'),
        equipos.length ? formAlta() : null,
      ),
    });
  }

  // ── celdas ─────────────────────────────────────────────────
  const celdaDia = (fecha, { fueraDeMes = false, sesiones, partidos, periodos }) => {
    const esHoy = fecha === hoyISO();
    const sinEntreno = enPeriodo(fecha, periodos);
    const objs = objetivosEnFecha(fecha, objetivos);
    const celda = h('div', {
      class: 'eq-cal-dia' + (fueraDeMes ? ' fuera' : '') + (esHoy ? ' hoy' : '')
        + (sinEntreno ? ' sin-entreno' : '') + (sel.inicio === fecha ? ' sel-obj' : ''),
      role: 'button', tabindex: 0,
      onClick: () => clickDia(fecha),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickDia(fecha); } },
    },
      h('span', { class: 'eq-cal-num' }, Number(fecha.slice(8, 10))),
      // bandas finas de objetivo: color = equipo (identidad); detalle en el panel
      objs.length ? h('div', { class: 'eq-cal-objs' }, objs.slice(0, 4).map((o) =>
        h('span', {
          class: 'eq-cal-obj',
          style: { background: colores.get(o.team_id) || 'var(--muted)' },
          title: `${o.titulo} · ${nombres.get(o.team_id) || ''}`,
        }))) : null,
      h('div', { class: 'eq-cal-chips' },
        (partidos || []).map(chipPartido),
        (sesiones || []).map(chip)),
    );
    celdas.set(fecha, celda);
    return celda;
  };

  // ── pintado principal ──────────────────────────────────────
  async function refrescar() {
    const r = rango();
    const filtroId = estado.filtro === 'todos' ? null : estado.filtro;
    let sesiones = [], periodos = [], partidos = [];
    celdas.clear();
    try {
      [sesiones, periodos, objetivos, partidos] = await Promise.all([
        getSesionesRango({ desde: r.desde, hasta: r.hasta, teamId: filtroId }),
        getPeriodos(temporada.id, filtroId),
        // ni los objetivos ni los partidos tumban el calendario si su
        // migración (011 / 016) todavía no está aplicada
        getObjetivosRango({ desde: r.desde, hasta: r.hasta, teamId: filtroId }).catch(() => []),
        getPartidosRango({ desde: r.desde, hasta: r.hasta, teamId: filtroId }).catch(() => []),
      ]);
    } catch (e) { toast('Error al cargar el calendario: ' + e.message, 'error'); }

    const porDia = new Map();
    for (const s of sesiones) {
      if (!porDia.has(s.fecha)) porDia.set(s.fecha, []);
      porDia.get(s.fecha).push(s);
    }
    const partidosPorDia = new Map();
    for (const m of partidos) {
      if (!partidosPorDia.has(m.fecha)) partidosPorDia.set(m.fecha, []);
      partidosPorDia.get(m.fecha).push(m);
    }

    const [y, m] = estado.cursor.split('-').map(Number);
    const tituloMes = estado.vista === 'mes'
      ? `${MESES[m - 1]} ${y}`
      : `Semana del ${Number(r.desde.slice(8, 10))} de ${MESES[Number(r.desde.slice(5, 7)) - 1]}`;

    const barra = h('div', { class: 'eq-cal-barra' },
      h('div', { class: 'eq-cal-nav' },
        h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', 'aria-label': 'Anterior', onClick: () => mueve(-1) }, '‹'),
        h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: () => { estado.cursor = hoyISO(); refrescar(); } }, 'Hoy'),
        h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', 'aria-label': 'Siguiente', onClick: () => mueve(1) }, '›'),
        h('h2', { class: 'eq-cal-titulo' }, tituloMes),
      ),
      h('div', { class: 'eq-cal-controles' },
        h('select', {
          class: 'select', 'aria-label': 'Filtrar por equipo',
          onChange: (e) => { estado.filtro = e.target.value; setState({ filtroCalendario: estado.filtro }); refrescar(); },
        },
          h('option', { value: 'todos', ...(estado.filtro === 'todos' ? { selected: true } : {}) }, 'Todos los equipos'),
          ...equipos.map((t) => h('option', { value: t.id, ...(t.id === estado.filtro ? { selected: true } : {}) }, t.name)),
        ),
        h('div', { class: 'eq-segmento', role: 'radiogroup', 'aria-label': 'Vista' },
          ...[['mes', 'Mes'], ['semana', 'Semana']].map(([v, txt]) =>
            h('button', {
              class: 'eq-segmento-btn' + (estado.vista === v ? ' sel' : ''),
              type: 'button', role: 'radio', 'aria-checked': String(estado.vista === v),
              onClick: () => { estado.vista = v; setState({ vistaCal: v }); refrescar(); },
            }, txt)),
        ),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: entrarSeleccion }, '+ Objetivo'),
      ),
    );

    hintEl = h('div', { class: 'eq-cal-hint', role: 'status' },
      h('span', {}, ''),
      h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: salirSeleccion }, 'Cancelar'),
    );
    pintaHint();

    let cuerpo;
    if (estado.vista === 'mes') {
      const dias = diasEntre(r.desde, r.hasta);
      cuerpo = h('div', { class: 'eq-cal' },
        h('div', { class: 'eq-cal-cabecera' }, ...WEEKDAYS.map((d) => h('span', {}, d.corto))),
        h('div', { class: 'eq-cal-grid' },
          ...dias.map((f) => celdaDia(f, {
            fueraDeMes: f < r.primero || f > r.ultimo,
            sesiones: porDia.get(f),
            partidos: partidosPorDia.get(f),
            periodos,
          }))),
      );
    } else {
      cuerpo = h('div', { class: 'eq-semana' },
        ...diasEntre(r.desde, r.hasta).map((f) => {
          const del = porDia.get(f) || [];
          const delPartidos = partidosPorDia.get(f) || [];
          const sinEntreno = enPeriodo(f, periodos);
          const objs = objetivosEnFecha(f, objetivos);
          const celda = h('div', {
            class: 'eq-semana-dia' + (f === hoyISO() ? ' hoy' : '') + (sinEntreno ? ' sin-entreno' : ''),
            role: 'button', tabindex: 0,
            onClick: () => clickDia(f),
            onKeydown: (e) => { if (e.key === 'Enter') clickDia(f); },
          },
            h('div', { class: 'eq-semana-fecha' },
              h('span', { class: 'eq-semana-dow' }, WEEKDAYS[isoWeekday(f) - 1].nombre),
              h('span', { class: 'eq-cal-num' }, Number(f.slice(8, 10)))),
            (del.length || delPartidos.length)
              ? h('div', { class: 'eq-semana-chips' }, delPartidos.map(chipPartido), del.map(chip))
              : h('span', { class: 'eq-semana-vacio' }, sinEntreno ? 'Sin entreno' : '—'),
            objs.length ? h('div', { class: 'eq-semana-objs' }, objs.slice(0, 3).map((o) =>
              h('span', { class: 'eq-semana-obj', title: o.titulo },
                puntoEquipo(colores.get(o.team_id)), ' ', o.titulo))) : null,
          );
          celdas.set(f, celda);
          return celda;
        }),
      );
    }

    mount(cont,
      h('div', { class: 'view-hero' },
        h('div', { class: 'view-hero-text' },
          temporada && esAdmin()
            ? h('button', {
                class: 'eyebrow eq-eyebrow-btn', type: 'button',
                title: 'Gestionar temporadas',
                onClick: () => modalTemporada({ onCambiada: recargarTemporada }),
              }, `Temporada ${temporada.label}`)
            : h('span', { class: 'eyebrow' }, temporada ? `Temporada ${temporada.label}` : 'Planificación'),
          h('h1', { class: 'display view-title' },
            h('span', { class: 'solid' }, 'Calendario'),
            h('span', { class: 'ghost' }, 'de sesiones')),
        ),
      ),
      avisoTemporada(temporada, { onCambiada: recargarTemporada }),
      barra, hintEl, cuerpo,
      h('div', { class: 'eq-leyenda' },
        h('span', { class: 'eq-leyenda-item eq-ses-preliminar' }, 'Preliminar'),
        h('span', { class: 'eq-leyenda-item eq-ses-programada' }, 'Programada'),
        h('span', { class: 'eq-leyenda-item eq-ses-realizada' }, 'Realizada'),
        h('span', { class: 'eq-leyenda-item eq-ses-cancelada' }, 'Cancelada'),
        h('span', { class: 'eq-leyenda-item eq-leyenda-part' },
          h('span', { class: 'eq-part-chip eq-leyenda-chip', 'aria-hidden': 'true' }, 'vs'), ' Partido'),
        h('span', { class: 'eq-leyenda-item eq-leyenda-obj' }, h('span', { class: 'eq-cal-obj', 'aria-hidden': 'true' }), ' Objetivo'),
      ),
    );
  }

  // tras crear o cambiar de temporada: todo el calendario depende de ella
  async function recargarTemporada() {
    temporada = await getTemporadaActiva();
    setState({ temporada });
    estado.cursor = cursorInicial();
    await refrescar();
  }

  // Abrir por el mes de hoy solo tiene sentido si hoy está DENTRO de la
  // temporada: si terminó (o no ha empezado), hoy es un mes vacío que no
  // explica nada. Se abre entonces por su primer mes, donde sí hay sesiones.
  const cursorInicial = () =>
    (temporada && !temporadaCubre(temporada, hoyISO()) && temporada.start_date)
      ? temporada.start_date
      : hoyISO();

  (async () => {
    try {
      const st2 = getState();
      temporada = st2.temporada || await getTemporadaActiva();
      equipos = st2.equipos || await getMisEquipos();
      setState({ temporada, equipos });
      colores = new Map(equipos.map((t) => [t.id, t.color]));
      nombres = new Map(equipos.map((t) => [t.id, t.name]));
      if (estado.filtro !== 'todos' && !colores.has(estado.filtro)) estado.filtro = 'todos';
      estado.cursor = cursorInicial();
      await refrescar();
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'Calendario no disponible'),
        h('p', {}, e.message)));
    }
  })();

  return { destroy() {} };
}
