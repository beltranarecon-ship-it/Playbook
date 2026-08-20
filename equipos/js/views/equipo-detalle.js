/* ============================================================
   equipo-detalle.js — /equipos/:teamId · pestañas ?tab=
   plantilla (roster + pegar lista) | horarios (una cajita por día, se
   edita y se genera de uno en uno, con tramo elegible y vista previa +
   periodos sin entreno) | ajustes (color, convocatoria, nombre).
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast, toastDeshacer } from '../ui/toast.js';
import { abrirModal, confirmar } from '../ui/modal.js';
import { colorPicker, diaChips, avatar, puntoEquipo } from '../ui/components.js';
import { getEquipo, actualizarEquipo, guardarAjustes } from '../data/teams.js';
import { getJugadores, crearJugador, crearJugadoresBulk, actualizarJugador } from '../data/players.js';
import {
  getSlots, guardarSlots, guardarSlot, desactivarSlot, reactivarSlot, previewRegeneracion,
  contarSesiones, getPeriodos, addPeriodo, addPeriodosBulk, borrarPeriodo,
  getSlotsOtrasTemporadas,
} from '../data/schedules.js';
import { getTemporadas } from '../data/seasons.js';
import { getPartidosEquipo } from '../data/matches.js';
import { getEstadisticasDePartidos } from '../data/estadisticas.js';
import {
  subirImagenEquipo, subirPlantilla, urlImagenEquipo, borrarArchivoEquipo,
} from '../data/equipo-archivos.js';
import {
  acumular, tabla as tablaTemporada, reparto, textoReparto, conUnDecimal,
} from '../data/temporada-stats.js';
import {
  getClasificacion, crearFilas, actualizarFila, borrarFila, borrarTodo,
  hayTabla as hayClasificacion, ordenar, nuestra, leerPegado,
  descuadres as descuadresClasi,
} from '../data/clasificacion.js';
import {
  balancePartidos, mediasPorEje, resultadoPartido, mediaValoracion, ESTADOS_PARTIDO,
} from '../data/partidos.js';
import { getTemporadaActiva, aplicarPlan } from '../data/sessions.js';
import { getObjetivos, actualizarObjetivo, borrarObjetivo, getSesionesPorObjetivo } from '../data/objectives.js';
import { getRubricaEquipo } from '../data/rubrica.js';
import { medirObjetivo } from '../data/objetivos-medida.js';
import { getAsistenciaEquipo } from '../data/attendance.js';
import { estadisticasJugadores } from '../data/asistencia.js';
import {
  getPreguntas, crearPregunta, actualizarPregunta, borrarPregunta,
  guardarOrdenPreguntas, restaurarPlantilla,
} from '../data/reflection.js';
import { claveDesdeEtiqueta, TIPOS_REFLEXION, CLAVE_CUMPLIMIENTO, CLAVE_ESFUERZO } from '../data/reflexion.js';
import { modalObjetivo, filaObjetivo } from './objetivo-form.js';
import { pintaProgresion } from './equipo-progresion.js';
import {
  minutosPorJugador, asistenciaPorPeriodo, ultimaSemana, pasaFiltros,
  textoAsistencia, textoMinutos, FILTROS_ESTADO, FILTROS_RENDIMIENTO,
} from '../data/plantilla.js';
import { getSesionesRango } from '../data/sessions.js';
import { getBloquesSesiones } from '../data/blocks.js';
import { getEjerciciosSugeribles } from '../data/objectives.js';
import { estadoDe, resumenDe } from '../../../taller/js/rubrica.js';
import { avisoTemporada, fechaLarga } from './temporada-form.js';
import { temporadaCubre } from '../data/programacion.js';
import { invalidarEquipos, esAdmin } from '../store.js';
import { CATEGORIAS_EQUIPO, POSICIONES, ESTADOS_JUGADOR, weekdayNombre, WEEKDAYS } from '../config.js';
import { router } from '../main.js';

export function render(root, params) {
  const teamId = params.teamId;
  const tab = new URLSearchParams(location.search).get('tab') || 'plantilla';
  const cont = h('div', { class: 'eq-page' });
  mount(root, cont);

  let equipo = null, temporada = null;

  const irTab = (t) => router.navigate(`/equipos/${teamId}?tab=${t}`);

  const cabecera = () => h('div', { class: 'view-hero' },
    h('div', { class: 'view-hero-text' },
      h('span', { class: 'eyebrow' }, equipo.category || 'Equipo'),
      h('h1', { class: 'display view-title eq-titulo-equipo' },
        puntoEquipo(equipo.team_settings?.color),
        h('span', { class: 'solid' }, equipo.name)),
      h('p', { class: 'view-meta' },
        (equipo.team_coaches ?? []).map((c) => c.profiles?.full_name).filter(Boolean).join(' · ') || '—'),
    ),
    h('div', { class: 'eq-zona-acciones' },
      h('a', {
        class: 'btn btn-secondary', href: `/dossier/${teamId}`, 'data-link': true,
        title: 'La memoria del equipo en Markdown, lista para llevártela',
      }, 'Dossier'),
      h('a', {
        class: 'btn btn-secondary', href: `/sesiones?equipo=${teamId}`, 'data-link': true,
      }, 'Ver calendario'),
    ),
  );

  const tabs = () => h('nav', { class: 'eq-tabs', 'aria-label': 'Secciones del equipo' },
    ...[['plantilla', 'Plantilla'], ['progresion', 'Progresión'], ['objetivos', 'Objetivos'], ['partidos', 'Partidos'], ['horarios', 'Horarios'], ['ajustes', 'Ajustes']].map(([k, txt]) =>
      h('button', {
        class: 'eq-tab-btn' + (tab === k ? ' active' : ''), type: 'button',
        'aria-current': tab === k ? 'page' : null,
        onClick: () => irTab(k),
      }, txt)),
  );

  /* La barra se desliza (panel.css): si la activa es de las últimas,
     al entrar por ?tab= caería fuera de la vista. Se centra a mano en
     lugar de con scrollIntoView, que también arrastraría la página. */
  const centraTabActiva = () => {
    const nav = cont.querySelector('.eq-tabs');
    const activa = nav?.querySelector('.eq-tab-btn.active');
    if (!nav || !activa) return;
    const caja = nav.getBoundingClientRect(), btn = activa.getBoundingClientRect();
    nav.scrollLeft += (btn.left - caja.left) - (caja.width - btn.width) / 2;
  };

  // ── Pestaña PLANTILLA ──────────────────────────────────────
  async function pintaPlantilla(zona) {
    /* La plantilla ahora se puede INTERROGAR (Tramo 3.12). Todo lo que
       hace falta ya se recogía —asistencia (M5), rúbrica (3.7) y
       minutos activos (3.1)—; lo que faltaba era poder preguntar.

       `incluirBajas` porque los archivados tienen que poder
       recuperarse, y para eso hay que verlos. */
    const [jugadores, filasAsis] = await Promise.all([
      getJugadores(teamId, { incluirBajas: true }),
      getAsistenciaEquipo(teamId, temporada.id).catch(() => []),
    ]);
    const color = equipo.team_settings?.color;
    const stats = new Map(estadisticasJugadores(jugadores, filasAsis).map((s) => [s.player_id, s]));

    /* ---- lo que se puede preguntar (Tramo 3.12) -------------------- */
    const filtro = { periodo: 'temporada', estados: [], rendimiento: [], asistenciaMax: null };
    let minutos = {};      // player_id → {minutos, sesiones}
    let resumenes = {};    // player_id → resumen de rúbrica

    const asisDe = () => (filtro.periodo === 'semana'
      ? asistenciaPorPeriodo(filasAsis, ultimaSemana())
      : asistenciaPorPeriodo(filasAsis));

    const nodoLista = h('div', { class: 'eq-jugadores' });
    const nodoCuenta = h('span', { class: 'eq-ayuda' });

    const chip = (txt, activo, onClick, extra = '') => h('button', {
      class: `eq-catchip${activo ? ' sel' : ''} ${extra}`, type: 'button',
      'aria-pressed': String(activo), onClick,
    }, txt);

    const alterna = (lista, k) => {
      const i = lista.indexOf(k);
      if (i >= 0) lista.splice(i, 1); else lista.push(k);
      pintaLista();
    };

    const FILTROS_REND_ORDEN = FILTROS_RENDIMIENTO;
    const ETQ_ESTADO = { activo: 'Activos', lesionado: 'Lesionados', baja: 'Archivados' };
    const ETQ_REND = { subido: 'Han subido', bajado: 'Han bajado', sin_mirar: 'Sin mirar' };

    const barraFiltros = () => h('div', { class: 'eq-plant-filtros' },
      h('div', { class: 'eq-plant-grupo' },
        h('span', { class: 'eq-plant-etq' }, 'Asistencia'),
        chip('Temporada', filtro.periodo === 'temporada', () => { filtro.periodo = 'temporada'; pintaLista(); }),
        chip('Última semana', filtro.periodo === 'semana', () => { filtro.periodo = 'semana'; pintaLista(); }),
        chip('Por debajo del 60 %', filtro.asistenciaMax != null,
          () => { filtro.asistenciaMax = filtro.asistenciaMax == null ? 60 : null; pintaLista(); }),
      ),
      h('div', { class: 'eq-plant-grupo' },
        h('span', { class: 'eq-plant-etq' }, 'Estado'),
        ...FILTROS_ESTADO.map((k) => chip(ETQ_ESTADO[k], filtro.estados.includes(k), () => alterna(filtro.estados, k))),
      ),
      h('div', { class: 'eq-plant-grupo' },
        h('span', { class: 'eq-plant-etq' }, 'Rendimiento'),
        ...FILTROS_REND_ORDEN.map((k) => chip(ETQ_REND[k], filtro.rendimiento.includes(k), () => alterna(filtro.rendimiento, k))),
      ),
      h('div', { class: 'eq-plant-grupo' },
        nodoCuenta,
        (filtro.estados.length || filtro.rendimiento.length || filtro.asistenciaMax != null)
          ? h('button', {
              class: 'btn btn-secondary eq-btn-mini', type: 'button',
              onClick: () => { filtro.estados = []; filtro.rendimiento = []; filtro.asistenciaMax = null; pintaLista(); },
            }, 'Quitar filtros')
          : null,
      ),
    );

    function pintaLista() {
      const asis = asisDe();
      const visibles = jugadores.filter((j) => pasaFiltros(j, {
        estados: filtro.estados, rendimiento: filtro.rendimiento,
        asistenciaMax: filtro.asistenciaMax, resumenes, asistencia: asis,
      }));

      nodoCuenta.textContent = visibles.length === jugadores.length
        ? `${jugadores.length} en plantilla`
        : `${visibles.length} de ${jugadores.length}`;

      nodoLista.replaceChildren(...(visibles.length
        ? visibles.map((j) => fila(j, asis))
        : [h('p', { class: 'eq-ayuda' }, 'Ningún jugador casa con lo que has pedido.')]));
      // los filtros se repintan aparte para que los chips reflejen el estado
      zonaFiltros.replaceChildren(barraFiltros());
    }

    const zonaFiltros = h('div', {});


    const fila = (j, asis) => h('div', { class: 'eq-jugador' + (j.estado !== 'activo' ? ' atenuado' : '') },
      avatar(j.nombre, color),
      h('span', { class: 'eq-jugador-dorsal' }, j.dorsal != null ? String(j.dorsal) : '·'),
      h('div', { class: 'eq-jugador-datos' },
        h('span', { class: 'eq-jugador-nombre' }, j.nombre),
        h('span', { class: 'eq-jugador-sub' },
          [
            j.posicion,
            j.estado !== 'activo' ? ESTADOS_JUGADOR[j.estado] : null,
            `${filtro.periodo === 'semana' ? 'semana' : 'temporada'}: ${textoAsistencia(asis[j.id])}`,
            // los minutos activos (Tramo 3.1 → 3.12): lo que de verdad
            // ha entrenado, no las sesiones a las que vino
            textoMinutos(minutos[j.id]),
          ].filter(Boolean).join(' · ') || ' '),
      ),
      /* Recuperar un archivado desde aquí: dar de baja es reversible, y
         si el camino de vuelta no existe la gente deja de dar de baja y
         empieza a borrar. */
      j.estado === 'baja'
        ? h('button', {
            class: 'btn btn-secondary eq-btn-mini', type: 'button',
            onClick: async () => {
              try {
                await actualizarJugador(j.id, { estado: 'activo' });
                j.estado = 'activo';
                toast(`${j.nombre} vuelve a la plantilla`);
                pintaLista();
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Recuperar')
        : null,
      h('button', {
        class: 'btn btn-secondary eq-btn-mini', type: 'button',
        onClick: () => modalJugador(j),
      }, 'Editar'),
    );

    const modalJugador = (j = null) => {
      const m0 = {
        nombre: j?.nombre || '', dorsal: j?.dorsal ?? '', posicion: j?.posicion || '',
        fecha_nacimiento: j?.fecha_nacimiento || '', notas: j?.notas || '',
        tutor_nombre: j?.tutor_nombre || '', tutor_contacto: j?.tutor_contacto || '',
        estado: j?.estado || 'activo',
      };
      let inNombre;
      const md = abrirModal({
        titulo: j ? 'Editar jugador' : 'Nuevo jugador',
        cuerpo: h('div', { class: 'eq-form-vertical' },
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Nombre ', h('span', { class: 'required' }, '*')),
            inNombre = h('input', { class: 'field-input', type: 'text', value: m0.nombre, onInput: (e) => { m0.nombre = e.target.value; } }),
          ),
          h('div', { class: 'field-row' },
            h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Dorsal'),
              h('input', { class: 'field-input', type: 'number', min: 0, max: 99, value: m0.dorsal, onInput: (e) => { m0.dorsal = e.target.value; } }),
            ),
            h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Posición'),
              h('select', { class: 'field-select', onChange: (e) => { m0.posicion = e.target.value; } },
                h('option', { value: '' }, '—'),
                ...POSICIONES.map((p) => h('option', { value: p, ...(p === m0.posicion ? { selected: true } : {}) }, p))),
            ),
          ),
          h('div', { class: 'field-row' },
            h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Nacimiento'),
              h('input', { class: 'field-input', type: 'date', value: m0.fecha_nacimiento, onChange: (e) => { m0.fecha_nacimiento = e.target.value; } }),
            ),
            j ? h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Estado'),
              h('select', { class: 'field-select', onChange: (e) => { m0.estado = e.target.value; } },
                ...Object.entries(ESTADOS_JUGADOR).map(([v, txt]) =>
                  h('option', { value: v, ...(v === m0.estado ? { selected: true } : {}) }, txt))),
            ) : null,
          ),
          h('div', { class: 'field-row' },
            h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Tutor/a'),
              h('input', { class: 'field-input', type: 'text', value: m0.tutor_nombre, onInput: (e) => { m0.tutor_nombre = e.target.value; } }),
            ),
            h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Contacto tutor/a'),
              h('input', { class: 'field-input', type: 'text', value: m0.tutor_contacto, placeholder: '600 000 000', onInput: (e) => { m0.tutor_contacto = e.target.value; } }),
            ),
          ),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Notas'),
            h('textarea', { class: 'field-textarea', rows: 2, onInput: (e) => { m0.notas = e.target.value; } }, m0.notas),
          ),
        ),
        pie: [
          j && m0.estado !== 'baja' ? h('button', {
            class: 'btn btn-secondary eq-btn-peligro', type: 'button',
            onClick: async () => {
              md.cerrar();
              await actualizarJugador(j.id, { estado: 'baja' });
              refrescar();
              toastDeshacer(`${j.nombre} dado de baja`, async () => {
                await actualizarJugador(j.id, { estado: 'activo' }); refrescar();
              });
            },
          }, 'Dar de baja') : null,
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md.cerrar() }, 'Cancelar'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              if (!m0.nombre.trim()) { inNombre.focus(); inNombre.classList.add('animate-shake'); return; }
              try {
                if (j) await actualizarJugador(j.id, {
                  nombre: m0.nombre.trim(),
                  dorsal: m0.dorsal !== '' ? Number(m0.dorsal) : null,
                  posicion: m0.posicion || null,
                  fecha_nacimiento: m0.fecha_nacimiento || null,
                  notas: m0.notas.trim() || null,
                  tutor_nombre: m0.tutor_nombre.trim() || null,
                  tutor_contacto: m0.tutor_contacto.trim() || null,
                  estado: m0.estado,
                });
                else await crearJugador({ team_id: teamId, ...m0 });
                md.cerrar(); refrescar();
                toast(j ? 'Jugador actualizado' : 'Jugador añadido');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Guardar'),
        ],
      });
      inNombre.focus();
    };

    const modalPegar = () => {
      let ta;
      const md = abrirModal({
        titulo: 'Pegar lista de jugadores',
        cuerpo: h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Un jugador por línea (opcional: dorsal delante)'),
          ta = h('textarea', { class: 'field-textarea', rows: 8, placeholder: '4 María López\n7 Carla Ruiz\nJimena Ortega' }),
        ),
        pie: [
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md.cerrar() }, 'Cancelar'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              try {
                const creados = await crearJugadoresBulk(teamId, ta.value);
                md.cerrar(); refrescar();
                toast(`${creados.length} jugador${creados.length === 1 ? '' : 'es'} añadidos`);
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Añadir'),
        ],
      });
      ta.focus();
    };

    mount(zona,
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, `Plantilla · ${jugadores.length}`),
        h('div', { class: 'eq-zona-acciones' },
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: modalPegar }, 'Pegar lista'),
          h('button', { class: 'btn btn-primary', type: 'button', onClick: () => modalJugador() }, 'Añadir jugador'),
        ),
      ),
      jugadores.length ? zonaFiltros : null,
      jugadores.length
        ? nodoLista
        : h('div', { class: 'empty-state' },
            h('p', { class: 'empty-state-display' }, 'Sin jugadores'),
            h('p', {}, 'Añade la plantilla para poder pasar lista. El truco rápido: «Pegar lista».')),
    );
    pintaLista();

    /* Los minutos activos y el rendimiento llegan DESPUÉS: la plantilla
       se abre con lo que ya está en memoria y se enriquece cuando llega.
       Tres consultas para una columna no pueden retrasar la lista. */
    (async () => {
      try {
        const ids = jugadores.map((j) => j.id);
        const sesiones = await getSesionesRango({
          desde: temporada.start_date || '2000-01-01',
          hasta: temporada.end_date || '2100-01-01',
          teamId,
        });
        const [bloquesPorSesion, bib, rub] = await Promise.all([
          getBloquesSesiones(sesiones.map((x) => x.id)),
          getEjerciciosSugeribles().catch(() => []),
          getRubricaEquipo(ids).catch(() => ({})),
        ]);
        const reqs = new Map((bib || []).map((e) => [e.id, e.requisitos || null]));
        minutos = minutosPorJugador({
          sesiones, bloquesPorSesion, asistencia: filasAsis,
          requisitosDe: (b) => (b.exercise_id ? reqs.get(b.exercise_id) || null : null),
        });
        resumenes = {};
        for (const id of ids) resumenes[id] = resumenDe(estadoDe(rub[id]));
        pintaLista();
      } catch { /* la plantilla se ve igual, sin la columna */ }
    })();
  }

  // ── Pestaña OBJETIVOS ──────────────────────────────────────
  async function pintaObjetivos(zona) {
    /* Los del EQUIPO. Los individuales (3.10) viven en Progresión, con
       el jugador delante: mezclados aquí, catorce críos con dos
       objetivos cada uno taparían los tres del equipo. */
    const todos = (await getObjetivos(teamId, temporada.id)).filter((o) => !o.player_id);
    /* La medida de cada objetivo (Tramo 3.9). Las dos consultas van
       sueltas y toleran el fallo: sin ellas la lista se pinta igual,
       solo que sin el «5 de 13 han subido». */
    const jugadoresEq = await getJugadores(teamId).catch(() => []);
    const [porObjetivo, rubrica] = await Promise.all([
      getSesionesPorObjetivo(teamId, temporada.id).catch(() => ({})),
      getRubricaEquipo(jugadoresEq.map((j) => j.id)).catch(() => ({})),
    ]);
    const medidaDe = (o) => medirObjetivo(o, {
      jugadores: jugadoresEq, porJugador: rubrica, sesiones: porObjetivo[o.id] || 0,
    });
    const activos = todos.filter((o) => o.estado === 'activo');
    const conseguidos = todos.filter((o) => o.estado === 'conseguido');
    const archivados = todos.filter((o) => o.estado === 'archivado');

    const btn = (txt, onClick, extra = '') => h('button', {
      class: 'btn btn-secondary eq-btn-mini' + extra, type: 'button', onClick,
    }, txt);

    const cambiar = async (o, patch, msg) => {
      try { await actualizarObjetivo(o.id, patch); refrescar(); if (msg) toast(msg); }
      catch (e) { toast('Error: ' + e.message, 'error'); }
    };

    const fila = (o) => filaObjetivo(o, {
      medida: medidaDe(o),
      acciones: [
        o.estado === 'activo'
          ? btn('✓ Conseguido', () => cambiar(o, { estado: 'conseguido' }, `«${o.titulo}» conseguido 🏀`))
          : btn('Reabrir', () => cambiar(o, { estado: 'activo' })),
        o.estado !== 'archivado'
          ? btn('Editar', () => modalObjetivo({ teamId, temporada, objetivo: o, onGuardado: refrescar }))
          : null,
        o.estado !== 'archivado'
          ? btn('Archivar', () => cambiar(o, { estado: 'archivado' }))
          : btn('Eliminar', async () => {
              if (!(await confirmar({ titulo: 'Eliminar objetivo', mensaje: `«${o.titulo}» se eliminará definitivamente. ¿Continuar?`, textoOk: 'Eliminar' }))) return;
              try { await borrarObjetivo(o.id); refrescar(); toast('Objetivo eliminado'); }
              catch (e) { toast('Error: ' + e.message, 'error'); }
            }, ' eq-btn-peligro'),
      ],
    });

    mount(zona,
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, `Objetivos · ${activos.length} activo${activos.length === 1 ? '' : 's'}`),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onClick: () => modalObjetivo({ teamId, temporada, onGuardado: refrescar }),
        }, 'Añadir objetivo'),
      ),
      todos.length ? null : h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'Sin objetivos'),
        h('p', {}, 'Marca qué trabajáis y cuándo: las sesiones de esas fechas lo heredan. También puedes crearlos desde el calendario tocando el primer y el último día.')),
      activos.length ? h('div', { class: 'eq-objs' }, activos.map(fila)) : null,
      conseguidos.length ? h('div', { class: 'eq-zona-head eq-zona-head-sep' },
        h('h2', { class: 'eq-zona-titulo' }, 'Conseguidos')) : null,
      conseguidos.length ? h('div', { class: 'eq-objs' }, conseguidos.map(fila)) : null,
      archivados.length ? h('div', { class: 'eq-zona-head eq-zona-head-sep' },
        h('h2', { class: 'eq-zona-titulo' }, 'Archivados')) : null,
      archivados.length ? h('div', { class: 'eq-objs' }, archivados.map(fila)) : null,
    );
  }

  // ── Pestaña PARTIDOS ───────────────────────────────────────
  /* ---- acumulados de la temporada (Tramo 4.4) ---------------------
     «Estadísticas por jugador y acumulados; periodos, no minutos».

     La tabla se ordena por PERIODOS y no por puntos, y eso no es un
     detalle: ordenada por anotación, el que menos juega queda escondido
     en medio de la lista, que es justo el nombre que hay que ver. Aquí
     el último de la tabla es la conversación del martes. */
  async function seccionAcumulados(partidos) {
    const jugados = partidos.filter((m) => m.estado === 'jugado');
    if (!jugados.length) return null;

    let jugadores = [], mapa = new Map();
    try {
      jugadores = await getJugadores(teamId);
      mapa = acumular(await getEstadisticasDePartidos(jugados.map((m) => m.id)), partidos);
    } catch (e) {
      return h('p', { class: 'eq-ayuda' }, `Las estadísticas por jugador no están disponibles: ${e.message}`);
    }
    if (!jugadores.length) return null;

    const filas = tablaTemporada(mapa, jugadores);
    if (!filas.some((f) => f.partidos)) {
      return h('div', { class: 'eq-acum' },
        h('h3', { class: 'eq-acum-tit' }, 'Acumulados'),
        h('p', { class: 'eq-ayuda' },
          `Hay ${jugados.length} partido${jugados.length === 1 ? '' : 's'} jugado${jugados.length === 1 ? '' : 's'} `
          + 'pero ninguna acta apuntada todavía. Se apuntan en la pantalla del partido.'),
      );
    }

    const r = reparto(mapa, jugadores);
    const aviso = textoReparto(r);

    return h('div', { class: 'eq-acum' },
      h('div', { class: 'eq-zona-head' },
        h('h3', { class: 'eq-acum-tit' }, 'Acumulados · periodos'),
        h('span', { class: 'eq-ayuda' }, `${jugados.length} partido${jugados.length === 1 ? '' : 's'} jugado${jugados.length === 1 ? '' : 's'}`),
      ),
      aviso ? h('p', { class: r && r.brecha >= 6 ? 'eq-acum-brecha' : 'eq-ayuda' }, aviso) : null,
      h('div', { class: 'eq-acta-scroll' },
        h('table', { class: 'eq-acta-tabla eq-acum-tabla' },
          h('thead', {},
            h('tr', {},
              h('th', { scope: 'col' }, 'Jugador'),
              h('th', { scope: 'col', title: 'Partidos con acta' }, 'PJ'),
              h('th', { scope: 'col', title: 'Periodos jugados' }, 'Per'),
              h('th', { scope: 'col', title: 'Periodos por partido' }, '/PJ'),
              h('th', { scope: 'col', title: 'Puntos' }, 'Pt'),
              h('th', { scope: 'col', title: 'Faltas' }, 'F'),
            ),
          ),
          h('tbody', {}, ...filas.map((f) => h('tr', { class: 'eq-acta-fila' + (f.partidos ? '' : ' eq-acum-sin') },
            h('th', { scope: 'row', class: 'eq-acta-quien' },
              f.jugador.dorsal != null ? h('span', { class: 'eq-acta-dorsal' }, String(f.jugador.dorsal)) : null,
              h('span', { class: 'eq-acta-nombre' }, f.jugador.nombre),
            ),
            h('td', {}, String(f.partidos)),
            h('td', { class: 'eq-acum-per' }, String(f.periodos)),
            h('td', {}, f.partidos ? conUnDecimal(f.periodosPorPartido) : '—'),
            h('td', {}, String(f.puntos)),
            h('td', {}, String(f.faltas)),
          ))),
        ),
      ),
      h('p', { class: 'eq-ayuda' },
        'En periodos, no en minutos (§5.9). Los que no aparecen en ninguna acta salen a cero: '
        + 'no jugar también es un dato.'),
    );
  }

  /* ---- clasificación (Tramo 4.5) ----------------------------------
     A mano (decisión #28): la federación la publica en una web que hoy
     no sabemos leer, y copiar doce filas cada dos semanas es un minuto.
     Se puede PEGAR entera, que es un gesto en vez de setenta y dos
     números.

     La posición no se guarda: se calcula. Guardarla obligaría a
     renumerar doce filas cada vez que se corrige un resultado, y a la
     primera que se olvide, la tabla miente. */
  function seccionClasificacion(zona) {
    const nodo = h('div', { class: 'eq-clasi' });
    let filas = [];

    const modalFila = (f = null) => {
      const campo = (clave, etiqueta, max = 999) => h('label', { class: 'eq-clasi-campo' },
        h('span', { class: 'field-label' }, etiqueta),
        h('input', {
          class: 'field-input', type: 'number', min: 0, max, inputmode: 'numeric',
          name: clave, value: f ? String(f[clave] ?? 0) : '',
        }),
      );
      const nombre = h('input', {
        class: 'field-input', type: 'text', maxlength: 80,
        value: f?.nombre || '', placeholder: 'CB Ejemplo A',
      });
      const nuestro = h('input', { type: 'checkbox', checked: !!f?.es_nuestro });
      const caja = h('div', { class: 'eq-clasi-form' },
        h('label', { class: 'field-group' }, h('span', { class: 'field-label' }, 'Equipo'), nombre),
        h('div', { class: 'eq-clasi-nums' },
          campo('jugados', 'J', 99), campo('ganados', 'G', 99), campo('perdidos', 'P', 99),
          campo('puntos_favor', 'PF', 9999), campo('puntos_contra', 'PC', 9999),
        ),
        h('label', { class: 'eq-puente-pisar' }, nuestro, h('span', {}, 'Este equipo somos nosotros')),
      );
      const leer = () => {
        const num = (k) => Math.max(0, Math.round(Number(caja.querySelector(`[name="${k}"]`).value) || 0));
        return {
          nombre: nombre.value.trim(), es_nuestro: nuestro.checked,
          jugados: num('jugados'), ganados: num('ganados'), perdidos: num('perdidos'),
          puntos_favor: num('puntos_favor'), puntos_contra: num('puntos_contra'),
        };
      };
      const m = abrirModal({
        titulo: f ? 'Editar equipo' : 'Añadir equipo',
        cuerpo: caja,
        pie: [
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => m.cerrar() }, 'Cancelar'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              const datos = leer();
              if (!datos.nombre) { toast('Ponle nombre al equipo', 'error'); return; }
              try {
                if (f) { await actualizarFila(f.id, datos); Object.assign(f, datos); }
                else filas.push(...await crearFilas(teamId, temporada.id, [datos]));
                m.cerrar(); pintaTabla();
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Guardar'),
        ],
      });
    };

    const modalPegar = () => {
      const area = h('textarea', {
        class: 'field-textarea', rows: 10,
        placeholder: '1  CB EJEMPLO A   6  6  0  312  198\n2  CD SAN JOSÉ    6  4  2  280  245',
      });
      const previo = h('p', { class: 'eq-ayuda' });
      /* Se enseña lo que se ha entendido ANTES de guardar. Una tabla mal
         leída que entra sin verse se queda con pinta de buena y nadie la
         vuelve a mirar. */
      area.addEventListener('input', () => {
        const n = leerPegado(area.value).length;
        mount(previo, h('span', { class: n ? 'eq-acta-ok' : 'eq-ayuda' },
          n ? `Entiendo ${n} equipo${n === 1 ? '' : 's'}.`
            : 'Todavía no entiendo ninguna fila: cada línea necesita el nombre y cinco números (J, G, P, PF, PC).'));
      });
      const m = abrirModal({
        titulo: 'Pegar la clasificación',
        cuerpo: h('div', { class: 'flow' },
          h('p', { class: 'eq-ayuda' },
            'Copia la tabla de la web de la federación y pégala aquí. Cada línea: el nombre '
            + 'y luego jugados, ganados, perdidos, puntos a favor y en contra.'),
          area, previo,
        ),
        pie: [
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => m.cerrar() }, 'Cancelar'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              const nuevas = leerPegado(area.value);
              if (!nuevas.length) { toast('No he entendido ninguna fila', 'error'); return; }
              if (filas.length && !(await confirmar({
                titulo: 'Sustituir la clasificación',
                mensaje: `Se borran los ${filas.length} equipos de ahora y se ponen los ${nuevas.length} pegados. ¿Seguir?`,
                textoOk: 'Sustituir',
              }))) return;
              try {
                if (filas.length) await borrarTodo(teamId, temporada.id);
                filas = await crearFilas(teamId, temporada.id, nuevas);
                m.cerrar(); pintaTabla();
                toast(`Clasificación con ${filas.length} equipos`);
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Guardar'),
        ],
      });
    };

    function pintaTabla() {
      const t = ordenar(filas);
      const nos = nuestra(t);
      const mal = descuadresClasi(filas);

      mount(nodo,
        h('div', { class: 'eq-zona-head' },
          h('h3', { class: 'eq-acum-tit' }, 'Clasificación'),
          h('div', { class: 'eq-clasi-acciones' },
            h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: modalPegar },
              filas.length ? 'Volver a pegarla' : 'Pegar la tabla'),
            h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: () => modalFila() }, 'Añadir equipo'),
          ),
        ),
        !filas.length
          ? h('p', { class: 'eq-ayuda' },
              'Sin clasificación todavía. Se copia a mano de la web de la federación '
              + '—o se pega entera— hasta que se pueda leer sola.')
          : h('div', { class: 'eq-acta-scroll' },
              h('table', { class: 'eq-acta-tabla eq-clasi-tabla' },
                h('thead', {},
                  h('tr', {},
                    h('th', { scope: 'col' }, ''),
                    h('th', { scope: 'col' }, 'Equipo'),
                    h('th', { scope: 'col', title: 'Jugados' }, 'J'),
                    h('th', { scope: 'col', title: 'Ganados' }, 'G'),
                    h('th', { scope: 'col', title: 'Perdidos' }, 'P'),
                    h('th', { scope: 'col', title: 'Puntos a favor' }, 'PF'),
                    h('th', { scope: 'col', title: 'Puntos en contra' }, 'PC'),
                    h('th', { scope: 'col', title: 'Diferencia' }, 'Dif'),
                    h('th', { scope: 'col', title: 'Puntos de clasificación' }, 'Pts'),
                    h('th', { scope: 'col' }, ''),
                  ),
                ),
                h('tbody', {}, ...t.map((f) => h('tr', { class: 'eq-acta-fila' + (f.es_nuestro ? ' eq-clasi-nos' : '') },
                  h('td', { class: 'eq-clasi-pos' },
                    String(f.pos),
                    // empatado a puntos Y a diferencia: ahí manda el
                    // particular, que la app no conoce
                    f.empatadoCon ? h('span', { class: 'eq-clasi-emp', title: 'Empatado: el desempate es el resultado particular, que la app no sabe' }, '=') : null,
                  ),
                  h('th', { scope: 'row', class: 'eq-acta-quien' }, f.nombre),
                  h('td', {}, String(f.jugados)),
                  h('td', {}, String(f.ganados)),
                  h('td', {}, String(f.perdidos)),
                  h('td', {}, String(f.puntos_favor)),
                  h('td', {}, String(f.puntos_contra)),
                  h('td', { class: f.dif > 0 ? 'eq-clasi-mas' : (f.dif < 0 ? 'eq-clasi-menos' : '') },
                    f.dif > 0 ? `+${f.dif}` : String(f.dif)),
                  h('td', { class: 'eq-clasi-pts' }, String(f.puntos)),
                  h('td', { class: 'eq-clasi-cel' },
                    h('button', {
                      class: 'eq-btn-icono', type: 'button', title: 'Editar', 'aria-label': `Editar ${f.nombre}`,
                      onClick: () => modalFila(filas.find((x) => x.id === f.id)),
                    }, '✎'),
                    h('button', {
                      class: 'eq-btn-icono', type: 'button', title: 'Quitar', 'aria-label': `Quitar ${f.nombre}`,
                      onClick: async () => {
                        if (!(await confirmar({ titulo: 'Quitar equipo', mensaje: `Se quita «${f.nombre}» de la clasificación.`, textoOk: 'Quitar' }))) return;
                        try {
                          await borrarFila(f.id);
                          filas = filas.filter((x) => x.id !== f.id);
                          pintaTabla();
                        } catch (e) { toast('Error: ' + e.message, 'error'); }
                      },
                    }, '×'),
                  ),
                ))),
              ),
            ),
        nos ? h('p', { class: 'eq-ayuda' }, `Vamos ${nos.pos}.º de ${t.length}, con ${nos.puntos} puntos.`) : null,
        ...mal.map((x) => h('p', { class: 'eq-acta-descuadre' }, x)),
        filas.length && !nos
          ? h('p', { class: 'eq-ayuda' }, 'Ninguna fila está marcada como nuestra: edita la nuestra y márcala.')
          : null,
      );
    }

    (async () => {
      try { filas = await getClasificacion(teamId, temporada.id); }
      catch (e) { console.warn('[clasificación]', e.message); }
      if (!hayClasificacion()) {
        mount(nodo, h('p', { class: 'eq-ayuda' },
          'Para la clasificación falta aplicar la migración 029 en la base de datos.'));
        return;
      }
      pintaTabla();
    })();

    mount(zona, nodo);
    return nodo;
  }

  async function pintaPartidos(zona) {
    const nodoAcum = h('div', {});
    const nodoClasi = h('div', {});
    let partidos = [];
    try { partidos = await getPartidosEquipo(teamId, temporada.id); }
    catch {
      mount(zona, h('p', { class: 'eq-ayuda' }, 'Los partidos todavía no están disponibles en esta base de datos.'));
      return;
    }
    const b = balancePartidos(partidos);
    const ejes = mediasPorEje(partidos);

    const dato = (num, lbl) => h('div', { class: 'eq-carga-dato' },
      h('span', { class: 'eq-carga-num' }, num),
      h('span', { class: 'eq-carga-lbl' }, lbl));

    const fila = (m) => {
      const res = resultadoPartido(m);
      return h('a', {
        class: 'eq-partido-fila' + (res ? ' eq-part-' + res : ''),
        href: `/partidos/${m.id}`, 'data-link': true,
        style: { '--team-color': equipo.team_settings?.color || 'var(--muted)' },
      },
        h('span', { class: 'eq-periodo-fechas' }, m.fecha),
        h('span', { class: 'eq-partido-rival' }, `${m.es_local ? 'vs' : '@'} ${m.rival}`),
        h('span', { class: 'eq-partido-marcador' },
          res ? `${m.marcador_favor}-${m.marcador_contra}` : ESTADOS_PARTIDO[m.estado]),
        res ? h('span', { class: `eq-res eq-res-${res}` }, res[0].toUpperCase()) : null,
        mediaValoracion(m) != null
          ? h('span', { class: 'eq-partido-val' }, `${mediaValoracion(m).toFixed(1)}★`)
          : null,
      );
    };

    mount(zona,
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, `Partidos · ${temporada.label}`),
        h('a', { class: 'btn btn-secondary', href: `/sesiones?equipo=${teamId}`, 'data-link': true },
          'Añadir desde el calendario'),
      ),
      b.jugados ? h('div', { class: 'eq-as-resumen' },
        dato(`${b.victorias}-${b.derrotas}${b.empates ? '-' + b.empates : ''}`, 'balance'),
        dato(`${b.pctVictorias}%`, 'victorias'),
        dato(b.difMedia > 0 ? `+${b.difMedia.toFixed(1)}` : b.difMedia.toFixed(1), 'dif. media'),
        dato(`${b.favor}-${b.contra}`, 'puntos'),
        b.racha ? h('span', { class: 'eq-as-pendiente' },
          `${b.racha.n} ${b.racha.tipo}${b.racha.n > 1 ? 's' : ''} seguida${b.racha.n > 1 ? 's' : ''}`) : null,
      ) : null,
      // dónde se gana y dónde se pierde: media por eje sobre lo valorado
      ejes.some((e) => e.n) ? h('div', { class: 'eq-ejes eq-ejes-resumen' },
        ...ejes.filter((e) => e.n).map((e) => h('div', { class: 'eq-eje' },
          h('span', { class: 'eq-eje-lbl' }, e.etiqueta),
          h('span', { class: 'eq-eje-media' }, `${e.media.toFixed(1)}`),
          h('span', { class: 'eq-ayuda' }, `${e.n} partido${e.n === 1 ? '' : 's'}`),
        )),
      ) : null,
      partidos.length
        ? h('div', { class: 'eq-partidos' }, partidos.slice().reverse().map(fila))
        : h('div', { class: 'empty-state' },
            h('p', { class: 'empty-state-display' }, 'Sin partidos'),
            h('p', {}, 'Añádelos desde el calendario, en el día que se juegan.')),
      // ── lo de la temporada, debajo de los partidos sueltos ──
      h('div', { class: 'eq-part-temporada' }, nodoAcum, nodoClasi),
    );

    /* Los acumulados van después y aparte: leen otra tabla, pueden
       tardar y no pueden retrasar la lista de partidos, que es lo que
       se viene a ver. */
    seccionAcumulados(partidos).then((n) => { if (n) mount(nodoAcum, n); });
    seccionClasificacion(nodoClasi);
  }

  // ── Pestaña HORARIOS ───────────────────────────────────────
  async function pintaHorarios(zona) {
    const [slots, periodos, conteo] = await Promise.all([
      getSlots(teamId, temporada.id),
      getPeriodos(temporada.id, teamId),
      contarSesiones(teamId, temporada.id).catch(() => null),
    ]);
    const colorEquipo = equipo.team_settings?.color || 'var(--muted)';

    // Los horarios son de cada temporada. Al abrir una nueva el equipo se
    // queda en blanco y tocaría reescribir lo mismo de siempre: se ofrece
    // copiarlo de la última temporada que sí los tenga.
    let heredables = [];
    if (!slots.length) {
      try {
        const otros = await getSlotsOtrasTemporadas(teamId, temporada.id);
        if (otros.length) {
          const temporadas = await getTemporadas();
          const orden = new Map(temporadas.map((t, i) => [t.id, i]));   // ya vienen de más reciente a más antigua
          const mejorId = otros
            .map((s) => s.season_id)
            .sort((a, b) => (orden.get(a) ?? 99) - (orden.get(b) ?? 99))[0];
          heredables = otros.filter((s) => s.season_id === mejorId);
          heredables.label = temporadas.find((t) => t.id === mejorId)?.label || 'la anterior';
        }
      } catch { /* si falla, simplemente no se ofrece */ }
    }

    const copiarHorarios = async () => {
      try {
        await guardarSlots(teamId, temporada.id, heredables.map((s) => ({
          weekday: s.weekday, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, lugar: s.lugar,
        })));
        refrescar();
        toast(`${heredables.length} horarios copiados de ${heredables.label}. Ábrelos con «Editar» para crear sus entrenamientos.`);
      } catch (e) { toast('Error: ' + e.message, 'error'); }
    };

    const soloHora = (t) => (t ? String(t).slice(0, 5) : '');
    const hoy = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const masDias = (iso, n) =>
      new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    const finDeMes = (iso) => {
      const [y, m] = iso.split('-').map(Number);
      return `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
    };
    const corta = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

    // Tramos que se pueden generar. Al AÑADIR un día nuevo se propone «de hoy en
    // adelante»: generar hacia atrás llenaría el calendario de entrenamientos
    // que nunca existieron.
    const TRAMOS = [
      { id: 'temporada', txt: 'Toda la temporada', rango: () => ({ desde: null, hasta: null }) },
      { id: 'hoy', txt: 'De hoy en adelante', rango: () => ({ desde: hoy(), hasta: null }) },
      { id: 'mes', txt: 'Hasta fin de mes', rango: () => ({ desde: hoy(), hasta: finDeMes(hoy()) }) },
      { id: 'semanas', txt: 'Las próximas 4 semanas', rango: () => ({ desde: hoy(), hasta: masDias(hoy(), 28) }) },
    ];

    /** Alta o edición de UN horario, con tramo a generar y vista previa. */
    const modalHorario = (slot) => {
      const esNuevo = !slot;
      const s0 = esNuevo
        ? { weekday: 1, hora_inicio: '18:00', hora_fin: '19:30', lugar: '' }
        : {
            id: slot.id, weekday: slot.weekday, lugar: slot.lugar || '',
            hora_inicio: soloHora(slot.hora_inicio), hora_fin: soloHora(slot.hora_fin),
          };
      // SIEMPRE 'hoy', también al editar. Con 'temporada' por defecto, cambiar en
      // febrero el horario de los lunes al miércoles llenaba el calendario de
      // veintidós miércoles de septiembre a enero que nunca se entrenaron. Que
      // el tramo largo se elija a mano.
      let tramoId = 'hoy';
      let pendiente = null;   // { plan, resumen, conflictos, tramo, opciones } del paso 2

      const cuerpo = h('div', {});
      const btnSec = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Cancelar');
      const btnPri = h('button', { class: 'btn btn-primary', type: 'button' }, 'Guardar y ver qué pasa');

      const campo = (etiqueta, control) => h('div', { class: 'field-group' },
        h('label', { class: 'field-label' }, etiqueta), control);

      const pasoDatos = () => {
        pendiente = null;
        btnSec.textContent = 'Cancelar';
        btnSec.onclick = () => md.cerrar();
        btnPri.textContent = 'Guardar y ver qué pasa';
        btnPri.onclick = verPrevia;
        mount(cuerpo,
          h('div', { class: 'field-row' },
            campo('Día', h('select', {
              class: 'field-select', onChange: (e) => { s0.weekday = Number(e.target.value); },
            }, ...WEEKDAYS.map((d) => h('option', {
              value: d.iso, ...(d.iso === s0.weekday ? { selected: true } : {}),
            }, d.nombre)))),
            campo('Lugar', h('input', {
              class: 'field-input', type: 'text', value: s0.lugar, placeholder: 'Pabellón',
              onInput: (e) => { s0.lugar = e.target.value; },
            })),
          ),
          h('div', { class: 'field-row' },
            campo('Empieza', h('input', {
              class: 'field-input', type: 'time', value: s0.hora_inicio,
              onChange: (e) => { s0.hora_inicio = e.target.value; },
            })),
            campo('Acaba', h('input', {
              class: 'field-input', type: 'time', value: s0.hora_fin,
              onChange: (e) => { s0.hora_fin = e.target.value; },
            })),
          ),
          h('div', { class: 'eq-tramo' },
            h('span', { class: 'field-label' }, 'Crear los entrenamientos de este horario en:'),
            h('div', { class: 'eq-catchips', role: 'radiogroup', 'aria-label': 'Tramo a generar' },
              ...TRAMOS.map((t) => h('button', {
                class: 'eq-catchip' + (t.id === tramoId ? ' sel' : ''), type: 'button',
                role: 'radio', 'aria-checked': String(t.id === tramoId),
                onClick: (e) => {
                  tramoId = t.id;
                  [...e.target.parentNode.children].forEach((b) => {
                    const sel = b === e.target;
                    b.classList.toggle('sel', sel);
                    b.setAttribute('aria-checked', String(sel));
                  });
                },
              }, t.txt)),
            ),
          ),
        );
      };

      const verPrevia = async () => {
        if (!s0.hora_inicio || !s0.hora_fin) { toast('Faltan las horas', 'error'); return; }
        if (s0.hora_fin <= s0.hora_inicio) { toast('La hora de fin va después de la de inicio', 'error'); return; }
        btnPri.disabled = true;
        try {
          const guardado = await guardarSlot(teamId, temporada.id, s0);
          s0.id = guardado.id;   // segunda pasada tras «Atrás» → actualiza, no duplica
          const { desde, hasta } = TRAMOS.find((t) => t.id === tramoId).rango();
          const opciones = { desde, hasta, slotIds: [guardado.id] };
          pendiente = { ...(await previewRegeneracion(teamId, temporada, opciones)), opciones };
          pasoPrevia();
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        } finally { btnPri.disabled = false; }
      };

      const pasoPrevia = () => {
        const { resumen, conflictos, tramo } = pendiente;
        const nada = !resumen.insertar && !resumen.actualizar && !resumen.borrar;
        btnSec.textContent = 'Atrás';
        btnSec.onclick = pasoDatos;
        btnPri.textContent = nada ? 'Cerrar' : 'Crear los entrenamientos';
        btnPri.onclick = nada ? () => md.cerrar() : aplicar;

        const linea = (txt, clase = '') => h('li', { class: clase }, txt);
        mount(cuerpo,
          h('p', { class: 'eq-ayuda' }, tramo
            ? `Del ${fechaLarga(tramo.start_date)} al ${fechaLarga(tramo.end_date)}.`
            : (!temporada.start_date || !temporada.end_date)
                ? `La temporada ${temporada.label} no tiene fechas de inicio y fin: sin eso no se puede generar nada.`
                : 'Ese tramo no cae dentro de la temporada.'),
          h('ul', { class: 'eq-previa' },
            resumen.insertar
              ? linea(`Se crearán ${resumen.insertar} entrenamientos.`, 'eq-previa-alta')
              : linea('No hay ningún entrenamiento nuevo que crear.'),
            resumen.actualizar ? linea(`${resumen.actualizar} cambian de hora o de lugar.`) : null,
            resumen.borrar ? linea(`${resumen.borrar} sin programar se quitan.`, 'eq-previa-baja') : null,
            resumen.saltadas ? linea(`${resumen.saltadas} no se crean: caen en días sin entreno.`) : null,
            resumen.descartadas ? linea(`${resumen.descartadas} las quitaste tú a mano y no vuelven.`) : null,
          ),
          conflictos.length ? h('div', { class: 'eq-aviso' },
            h('strong', {}, `${conflictos.length} días ya tienen algo de este equipo`),
            h('ul', { class: 'eq-previa' }, ...conflictos.slice(0, 6).map((c) => h('li', {},
              `${corta(c.fecha)} · ya hay ${c.con.length === 1 ? 'una sesión' : `${c.con.length} sesiones`}`))),
            conflictos.length > 6 ? h('p', { class: 'eq-ayuda' }, `…y ${conflictos.length - 6} más.`) : null,
            h('p', { class: 'eq-ayuda' }, 'No lo impide: se crearán igual y podrás quitar la que sobre.'),
          ) : null,
          h('p', { class: 'eq-ayuda' },
            'Lo ya programado, realizado o movido a mano no se toca nunca.'),
        );
      };

      const aplicar = async () => {
        btnPri.disabled = true;
        try {
          // Se RECALCULA justo antes de aplicar. El plan de la vista previa
          // envejece: entre que se mira y se acepta, el entrenador puede haber
          // quitado un entrenamiento desde el calendario (y aplicar el plan
          // viejo se lo devolvería, rompiendo la promesa de que no vuelve) o
          // el otro entrenador del equipo puede haber tocado algo.
          const fresco = await previewRegeneracion(teamId, temporada, pendiente.opciones);
          const r = await aplicarPlan(teamId, temporada.id, fresco.plan);
          md.cerrar();
          toast(`${r.insertadas} entrenamientos creados`
            + (r.actualizadas ? ` · ${r.actualizadas} actualizados` : '')
            + (r.borradas ? ` · ${r.borradas} quitados` : '')
            + (r.conservadas ? ` · ${r.conservadas} conservados (ya tenían lista)` : ''));
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        } finally { btnPri.disabled = false; }
      };

      const md = abrirModal({
        titulo: esNuevo ? 'Nuevo día de entreno' : 'Editar horario',
        cuerpo,
        pie: [btnSec, btnPri],
        // Se repinta SIEMPRE al cerrar, salga por donde salga (Cancelar, Atrás,
        // Escape, la × o el clic fuera). El horario ya se guardó al pedir la
        // vista previa: si al cerrar la lista siguiera igual, parecería que no
        // se guardó nada y se acabaría creando el mismo día dos veces.
        alCerrar: () => refrescar(),
      });
      pasoDatos();
    };

    const quitarHorario = async (slot) => {
      const ok = await confirmar({
        titulo: 'Quitar este horario',
        mensaje: `Se deja de entrenar los ${weekdayNombre(slot.weekday).toLowerCase()}. `
          + 'Los entrenamientos que ya estén programados o realizados se quedan; '
          + 'se quitan solo los que nadie ha tocado.',
        textoOk: 'Quitar',
      });
      if (!ok) return;
      try {
        await desactivarSlot(slot.id);
        try {
          const { plan } = await previewRegeneracion(teamId, temporada, { slotIds: [slot.id] });
          const r = await aplicarPlan(teamId, temporada.id, plan);
          refrescar();
          toast(`Horario quitado${r.borradas ? ` · ${r.borradas} entrenamientos sin programar retirados` : ''}`);
        } catch (e) {
          // el horario ya estaba desactivado: sin esto desaparecería de la lista
          // y sus entrenamientos se quedarían colgando sin ninguna pantalla
          // desde la que volver a limpiarlos
          await reactivarSlot(slot.id);
          refrescar();
          throw e;
        }
      } catch (e) { toast('No se pudo quitar el horario: ' + e.message, 'error'); }
    };

    const tarjetaHorario = (s) => h('div', {
      class: 'eq-horario', style: { '--team-color': colorEquipo },
    },
      h('div', { class: 'eq-horario-info' },
        h('span', { class: 'eq-horario-dia' }, weekdayNombre(s.weekday)),
        h('span', { class: 'eq-horario-hora' }, `${soloHora(s.hora_inicio)}–${soloHora(s.hora_fin)}`),
        s.lugar ? h('span', { class: 'eq-horario-lugar' }, s.lugar) : null,
      ),
      h('div', { class: 'eq-horario-acciones' },
        h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: () => modalHorario(s) }, 'Editar'),
        h('button', {
          class: 'btn btn-secondary eq-btn-mini eq-btn-peligro', type: 'button',
          onClick: () => quitarHorario(s),
        }, 'Quitar'),
      ),
    );

    // un periodo cuyas fechas no rozan la temporada activa no bloquea nada:
    // se dice, en vez de dejar al entrenador creyendo que sí cuenta
    const fueraDeTemporada = (p) => !(temporada.start_date && temporada.end_date)
      || p.fecha_fin < temporada.start_date || p.fecha_inicio > temporada.end_date;

    const filaPeriodo = (p) => h('div', { class: 'eq-periodo' },
      h('span', { class: 'eq-periodo-fechas' },
        p.fecha_inicio === p.fecha_fin ? p.fecha_inicio : `${p.fecha_inicio} → ${p.fecha_fin}`),
      h('span', { class: 'eq-periodo-motivo' }, p.motivo || '—'),
      fueraDeTemporada(p)
        ? h('span', { class: 'eq-obj-badge eq-badge-alerta', title: `Fuera de la temporada ${temporada.label}: no afecta a la generación` }, 'fuera de temporada')
        : null,
      p.team_id === null
        ? h('span', { class: 'badge badge-type' }, 'club')
        : h('button', {
            class: 'eq-slot-quitar', type: 'button', 'aria-label': 'Eliminar periodo',
            onClick: async () => {
              if (!(await confirmar({ titulo: 'Eliminar periodo', mensaje: '¿Eliminar este periodo sin entreno?', textoOk: 'Eliminar' }))) return;
              await borrarPeriodo(p.id); refrescar();
            },
          }, '×'),
      p.team_id === null && esAdmin()
        ? h('button', {
            class: 'eq-slot-quitar', type: 'button', 'aria-label': 'Eliminar periodo de club',
            onClick: async () => {
              if (!(await confirmar({ titulo: 'Eliminar periodo de club', mensaje: 'Afecta a TODOS los equipos. ¿Eliminar?', textoOk: 'Eliminar' }))) return;
              await borrarPeriodo(p.id); refrescar();
            },
          }, '×')
        : null,
    );

    const modalPeriodo = () => {
      const m0 = { fecha_inicio: '', fecha_fin: '', motivo: '', club: false };
      const md = abrirModal({
        titulo: 'Añadir periodo sin entreno',
        cuerpo: h('div', { class: 'eq-form-vertical' },
          h('div', { class: 'field-row' },
            h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Desde ', h('span', { class: 'required' }, '*')),
              h('input', { class: 'field-input', type: 'date', onChange: (e) => { m0.fecha_inicio = e.target.value; if (!m0.fecha_fin) m0.fecha_fin = e.target.value; } })),
            h('div', { class: 'field-group' },
              h('label', { class: 'field-label' }, 'Hasta'),
              h('input', { class: 'field-input', type: 'date', onChange: (e) => { m0.fecha_fin = e.target.value; } })),
          ),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Motivo'),
            h('input', { class: 'field-input', type: 'text', placeholder: 'Navidad, festivo…', onInput: (e) => { m0.motivo = e.target.value; } })),
          esAdmin() ? h('label', { class: 'eq-check' },
            h('input', { type: 'checkbox', onChange: (e) => { m0.club = e.target.checked; } }),
            ' Aplicar a todo el club (todos los equipos)') : null,
          h('p', { class: 'eq-ayuda' }, 'Solo bloquea la generación automática: siempre podrás añadir sesiones a mano cualquier día.'),
        ),
        pie: [
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md.cerrar() }, 'Cancelar'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              if (!m0.fecha_inicio) { toast('Falta la fecha de inicio', 'error'); return; }
              try {
                const fin = m0.fecha_fin || m0.fecha_inicio;
                await addPeriodo({
                  season_id: temporada.id,
                  team_id: m0.club ? null : teamId,
                  fecha_inicio: m0.fecha_inicio,
                  fecha_fin: fin,
                  motivo: m0.motivo,
                });
                md.cerrar(); refrescar();
                toast(temporadaCubre(temporada, m0.fecha_inicio) || temporadaCubre(temporada, fin)
                  ? 'Periodo añadido'
                  : `Añadido, pero cae fuera de la temporada ${temporada.label}: no bloqueará nada`,
                  temporadaCubre(temporada, m0.fecha_inicio) ? 'success' : 'error');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Añadir'),
        ],
      });
    };

    const modalPegarPeriodos = () => {
      let ta;
      // las líneas que no se entienden se dicen aquí, y el modal NO se cierra:
      // antes se descartaban en silencio y faltaban periodos sin previo aviso
      const aviso = h('div', { class: 'eq-aviso', hidden: true });
      const md = abrirModal({
        titulo: 'Pegar calendario escolar',
        cuerpo: h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Una línea por periodo: «12/10/2026 Fiesta» o «23/12/2026 10/01/2027 Navidad»'),
          ta = h('textarea', { class: 'field-textarea', rows: 8, placeholder: '12/10/2026 Fiesta Nacional\n23/12/2026 10/01/2027 Navidad' }),
          aviso,
          esAdmin() ? h('p', { class: 'eq-ayuda' }, 'Se añadirán como periodos de CLUB (todos los equipos).') : null,
        ),
        pie: [
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md.cerrar() }, 'Cancelar'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              try {
                const { filas, ignoradas } = await addPeriodosBulk({
                  season_id: temporada.id,
                  team_id: esAdmin() ? null : teamId,
                  texto: ta.value,
                });
                const fuera = filas.filter((f) =>
                  !temporadaCubre(temporada, f.fecha_inicio) && !temporadaCubre(temporada, f.fecha_fin)).length;
                const resumen = `${filas.length} periodos añadidos`
                  + (fuera ? ` · ${fuera} fuera de la temporada ${temporada.label}` : '');
                if (ignoradas.length) {
                  // lo añadido ya está guardado: se refresca por detrás y el modal
                  // se queda abierto con lo que falta por corregir
                  refrescar();
                  ta.value = ignoradas.map((i) => i.linea).join('\n');
                  mount(aviso, h('strong', {}, `${ignoradas.length} líneas sin entender`),
                    h('p', { class: 'eq-ayuda' },
                      'Se han quedado arriba para que las corrijas. ' + ignoradas[0].porque + '.'));
                  aviso.hidden = false;
                  toast(resumen + ` · ${ignoradas.length} sin entender`, 'error');
                  return;
                }
                md.cerrar(); refrescar();
                toast(resumen, fuera ? 'error' : 'success');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Añadir'),
        ],
      });
      ta.focus();
    };

    mount(zona,
      avisoTemporada(temporada, { onCambiada: refrescar }),
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, `Horario semanal · ${temporada.label}`),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => modalHorario(null) },
          'Añadir día de entreno'),
      ),
      // Cuántos entrenamientos hay YA. Sin este dato, "no se ha generado nada"
      // y "ya está todo generado" se ven exactamente igual en pantalla, que es
      // justo lo que hacía parecer que la generación estaba rota.
      conteo && conteo.total === 0
        ? h('div', { class: 'eq-aviso eq-aviso-temporada' },
            h('span', {}, `Todavía no hay ningún entrenamiento en el calendario de ${temporada.label}. `
              + 'Añade un día de entreno, o abre uno de los de abajo con «Editar», para crearlos.'))
        : conteo
          ? h('p', { class: 'eq-ayuda' },
              `${conteo.total} entrenamientos en el calendario de ${temporada.label}: `
              + [
                  conteo.por.preliminar ? `${conteo.por.preliminar} sin programar` : null,
                  conteo.por.programada ? `${conteo.por.programada} programados` : null,
                  conteo.por.realizada ? `${conteo.por.realizada} realizados` : null,
                  conteo.por.cancelada ? `${conteo.por.cancelada} cancelados` : null,
                ].filter(Boolean).join(' · '))
          : null,
      heredables.length ? h('div', { class: 'eq-aviso eq-aviso-temporada' },
        h('span', {}, `Este equipo no tiene horarios en ${temporada.label}, pero sí ${heredables.length} en ${heredables.label}.`),
        h('button', { class: 'btn btn-primary eq-btn-mini', type: 'button', onClick: copiarHorarios },
          `Copiar los de ${heredables.label}`),
      ) : null,
      slots.length
        ? h('div', { class: 'eq-horarios' }, ...slots.map(tarjetaHorario))
        : h('p', { class: 'eq-ayuda' },
            'Sin horarios en esta temporada. Añade un día de entreno para que el calendario se llene solo.'),
      h('div', { class: 'eq-zona-head eq-zona-head-sep' },
        h('h2', { class: 'eq-zona-titulo' }, 'Días sin entreno'),
        h('div', { class: 'eq-zona-acciones' },
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: modalPegarPeriodos }, 'Pegar calendario'),
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: modalPeriodo }, 'Añadir periodo'),
        ),
      ),
      periodos.length
        ? h('div', { class: 'eq-periodos' }, periodos.map(filaPeriodo))
        : h('p', { class: 'eq-ayuda' }, 'Sin periodos cargados: la auto-generación creará sesiones también en festivos. Sube aquí el calendario escolar.'),
    );
  }

  // ── Pestaña AJUSTES ────────────────────────────────────────
  async function pintaAjustes(zona) {
    const s = equipo.team_settings || {};
    const m0 = {
      name: equipo.name, category: equipo.category || '',
      color: s.color || null, dia_convocatoria: s.dia_convocatoria || null,
      asistencia_activa: s.asistencia_activa !== false,
      reflexion_activa: s.reflexion_activa !== false,
      // 030: la imagen del equipo (4.12), la plantilla PDF y la hora
      // del aviso de convocatoria (4.6 y 4.8)
      imagen_path: s.imagen_path || null,
      plantilla_path: s.plantilla_path || null,
      hora_convocatoria: s.hora_convocatoria || null,
    };
    // null = la reflexión aún no existe en esta BD (015 sin aplicar)
    let preguntas = null;
    try { preguntas = await getPreguntas(teamId); } catch { preguntas = null; }

    /* Un fichero del equipo (imagen o plantilla), en el bucket privado
       'equipos' de la 030. Se sube al elegirlo y se guarda la ruta en
       el momento: dejarlo para el botón «Guardar ajustes» significaría
       que un fichero subido y no guardado se queda huérfano en el
       bucket para siempre. */
    function archivoEquipo({ etiqueta, ayuda, clave, acepta, subir, conVistaPrevia }) {
      const zona = h('div', { class: 'field-group eq-arch' });

      const pinta = async () => {
        const path = m0[clave];
        if (!path) {
          mount(zona,
            h('label', { class: 'field-label' }, etiqueta),
            h('label', { class: 'btn btn-secondary eq-acta-subir' }, 'Subir',
              h('input', {
                type: 'file', accept: acepta, class: 'eq-acta-input',
                onChange: async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const nueva = await subir(teamId, file);
                    await guardarAjustes(teamId, { [clave]: nueva });
                    m0[clave] = nueva;
                    invalidarEquipos(); toast('Guardado'); pinta();
                  } catch (err) { toast('Error: ' + err.message, 'error'); }
                },
              })),
            h('p', { class: 'eq-ayuda' }, ayuda),
          );
          return;
        }
        let url = null;
        if (conVistaPrevia) { try { url = await urlImagenEquipo(path); } catch { /* enlace fallido */ } }
        mount(zona,
          h('label', { class: 'field-label' }, etiqueta),
          h('div', { class: 'eq-arch-hay' },
            url
              ? h('img', { class: 'eq-arch-img', src: url, alt: '' })
              : h('span', { class: 'eq-obj-badge eq-obj-badge-ok' }, 'Subida'),
            h('button', {
              class: 'btn btn-secondary eq-btn-mini eq-btn-peligro', type: 'button',
              onClick: async () => {
                if (!(await confirmar({ titulo: 'Quitar', mensaje: `Se borrará: ${etiqueta.toLowerCase()}.`, textoOk: 'Quitar' }))) return;
                try {
                  const vieja = m0[clave];
                  await guardarAjustes(teamId, { [clave]: null });
                  m0[clave] = null;
                  // la fila ya no la referencia: ahora sí se puede borrar
                  await borrarArchivoEquipo(vieja).catch(() => {});
                  invalidarEquipos(); pinta();
                } catch (err) { toast('Error: ' + err.message, 'error'); }
              },
            }, 'Quitar'),
          ),
          h('p', { class: 'eq-ayuda' }, ayuda),
        );
      };
      pinta();
      return zona;
    }

    // ── preguntas de reflexión (plantilla del equipo) ────────
    const nuevo = { etiqueta: '', tipo: 'estrellas', ambito: 'equipo' };

    const filaPregunta = (q, i) => h('div', { class: 'eq-preg' + (q.activa ? '' : ' atenuado') },
      h('div', { class: 'eq-preg-orden' },
        h('button', { class: 'eq-mov', type: 'button', 'aria-label': 'Subir', disabled: i === 0, onClick: () => mover(i, -1) }, '↑'),
        h('button', { class: 'eq-mov', type: 'button', 'aria-label': 'Bajar', disabled: i === preguntas.length - 1, onClick: () => mover(i, 1) }, '↓'),
      ),
      h('input', {
        class: 'field-input eq-preg-etiqueta', type: 'text', value: q.etiqueta,
        'aria-label': 'Texto de la pregunta',
        onChange: async (e) => {
          const v = e.target.value.trim();
          if (!v || v === q.etiqueta) { e.target.value = q.etiqueta; return; }
          try { await actualizarPregunta(q.id, { etiqueta: v }); q.etiqueta = v; toast('Pregunta actualizada'); }
          catch (err) { e.target.value = q.etiqueta; toast('Error: ' + err.message, 'error'); }
        },
      }),
      h('span', { class: 'eq-obj-badge' }, q.tipo === 'estrellas' ? '★ 1-5' : 'texto'),
      q.clave === CLAVE_CUMPLIMIENTO
        ? h('span', { class: 'eq-obj-badge eq-obj-badge-ok', title: 'Es la pregunta que mide el cumplimiento de la sesión' }, 'cumplimiento')
        : null,
      h('label', { class: 'eq-check eq-preg-activa' },
        h('input', {
          type: 'checkbox', checked: q.activa,
          onChange: async (e) => {
            try { await actualizarPregunta(q.id, { activa: e.target.checked }); q.activa = e.target.checked; refrescar(); }
            catch (err) { e.target.checked = q.activa; toast('Error: ' + err.message, 'error'); }
          },
        }),
        ' Se pregunta'),
      h('button', {
        class: 'eq-slot-quitar', type: 'button', 'aria-label': 'Eliminar pregunta',
        onClick: async () => {
          const ok = await confirmar({
            titulo: 'Eliminar pregunta',
            mensaje: q.clave === CLAVE_ESFUERZO
              ? 'Es la pregunta de ESFUERZO: es la única obligatoria al cerrar y la que da la serie con la que se compara todo lo demás. Las respuestas ya dadas se conservan. ¿Eliminar?'
              : q.clave === CLAVE_CUMPLIMIENTO
              ? 'Es la pregunta de CUMPLIMIENTO: sin ella, las sesiones dejarán de medir si se cumplió el plan. Las respuestas ya dadas se conservan. ¿Eliminar?'
              : 'Dejará de preguntarse. Las respuestas ya guardadas se conservan en sus sesiones. ¿Eliminar?',
            textoOk: 'Eliminar',
          });
          if (!ok) return;
          try { await borrarPregunta(q.id); refrescar(); toast('Pregunta eliminada'); }
          catch (err) { toast('Error: ' + err.message, 'error'); }
        },
      }, '×'),
    );

    const mover = async (i, d) => {
      const j = i + d;
      if (j < 0 || j >= preguntas.length) return;
      [preguntas[i], preguntas[j]] = [preguntas[j], preguntas[i]];
      try {
        await guardarOrdenPreguntas(preguntas.map((q, k) => ({ id: q.id, orden: k + 1 })));
        refrescar();
      } catch (e) { toast('Error: ' + e.message, 'error'); }
    };

    const cardReflexion = () => {
      if (preguntas === null) {
        return h('div', { class: 'eq-form-card' },
          h('div', { class: 'eq-form-seccion' }, 'Preguntas de reflexión'),
          h('p', { class: 'eq-ayuda' }, 'La reflexión post-sesión todavía no está disponible en esta base de datos.'));
      }
      return h('div', { class: 'eq-form-card' },
        h('div', { class: 'eq-form-seccion' }, 'Preguntas de reflexión'),
        h('p', { class: 'eq-ayuda' },
          'Lo que te preguntará la app al cerrar cada sesión. Las estrellas van de 1 a 5; los textos son libres. '
          + 'Las de jugador se contestan de quien quieras, no de todos, y «¿Cómo han trabajado hoy?» es la única obligatoria.'),
        preguntas.length
          ? h('div', { class: 'eq-pregs' }, preguntas.map(filaPregunta))
          : h('p', { class: 'eq-ayuda' }, 'Sin preguntas: al cerrar una sesión no se pedirá reflexión.'),
        h('div', { class: 'eq-preg-nueva' },
          h('input', {
            class: 'field-input', type: 'text', placeholder: 'Nueva pregunta…',
            'aria-label': 'Texto de la pregunta nueva',
            onInput: (e) => { nuevo.etiqueta = e.target.value; },
          }),
          h('select', {
            class: 'field-select', 'aria-label': 'Tipo de respuesta',
            onChange: (e) => { nuevo.tipo = e.target.value; },
          }, ...TIPOS_REFLEXION.map((t) => h('option', { value: t }, t === 'estrellas' ? 'Estrellas 1-5' : 'Texto'))),
          /* De equipo o de jugador (Tramo 3.11). Una de jugador se
             contesta de quien se quiera, no de todos. */
          h('select', {
            class: 'field-select', 'aria-label': 'De quién es la pregunta',
            onChange: (e) => { nuevo.ambito = e.target.value; },
          },
            h('option', { value: 'equipo' }, 'Del equipo'),
            h('option', { value: 'jugador' }, 'De cada jugador'),
          ),
          h('button', {
            class: 'btn btn-secondary', type: 'button',
            onClick: async () => {
              const etiqueta = nuevo.etiqueta.trim();
              if (!etiqueta) { toast('Escribe la pregunta', 'error'); return; }
              try {
                await crearPregunta({
                  team_id: teamId,
                  clave: claveDesdeEtiqueta(etiqueta, preguntas.map((q) => q.clave), { tipo: nuevo.tipo }),
                  etiqueta, tipo: nuevo.tipo, ambito: nuevo.ambito,
                  orden: preguntas.reduce((mx, q) => Math.max(mx, q.orden ?? 0), 0) + 1,
                });
                refrescar(); toast('Pregunta añadida');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Añadir'),
        ),
        h('div', { class: 'eq-form-acciones' },
          h('button', {
            class: 'btn btn-secondary', type: 'button',
            onClick: async () => {
              try {
                const n = await restaurarPlantilla(teamId);
                refrescar();
                toast(n ? `${n} preguntas restauradas` : 'La plantilla por defecto ya estaba completa');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Restaurar plantilla por defecto'),
        ),
      );
    };

    mount(zona,
      h('div', { class: 'eq-form-card' },
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Nombre'),
          h('input', { class: 'field-input', type: 'text', value: m0.name, onInput: (e) => { m0.name = e.target.value; } }),
        ),
        h('div', { class: 'field-row' },
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Categoría'),
            h('select', { class: 'field-select', onChange: (e) => { m0.category = e.target.value; } },
              h('option', { value: '' }, 'Sin categoría'),
              ...CATEGORIAS_EQUIPO.map((c) => h('option', { value: c, ...(c === m0.category ? { selected: true } : {}) }, c))),
          ),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Color'),
            colorPicker(m0.color, (c) => { m0.color = c; }),
          ),
        ),
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, `Día de convocatoria${m0.dia_convocatoria ? ` · ${weekdayNombre(m0.dia_convocatoria)}` : ''}`),
          diaChips(m0.dia_convocatoria, (d) => { m0.dia_convocatoria = d; }),
          h('label', { class: 'field-group eq-conv-hora' },
            h('span', { class: 'field-label' }, 'Hora del aviso'),
            h('input', {
              class: 'field-input', type: 'time',
              value: (m0.hora_convocatoria || '').slice(0, 5),
              // a esta hora, ese día, sale el aviso de «convocatoria sin
              // rellenar» (§5.8). Sin hora no se avisa: mejor callarse
              // que despertar a alguien a las siete de la mañana.
              onInput: (e) => { m0.hora_convocatoria = e.target.value || null; },
            }),
          ),
        ),
        archivoEquipo({
          etiqueta: 'Imagen del equipo',
          ayuda: 'Se ve en el calendario y en la convocatoria. JPG, PNG o WebP.',
          clave: 'imagen_path',
          acepta: 'image/jpeg,image/png,image/webp',
          subir: subirImagenEquipo,
          conVistaPrevia: true,
        }),
        archivoEquipo({
          etiqueta: 'Plantilla de convocatoria (PDF)',
          ayuda: 'El papel del club, por si hay que entregarlo en la mesa. La app compone '
            + 'su propio documento aparte, con el rival, el día, la hora y la lista.',
          clave: 'plantilla_path',
          acepta: 'application/pdf,image/jpeg,image/png,image/webp',
          subir: subirPlantilla,
          conVistaPrevia: false,
        }),
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Al cerrar una sesión'),
          h('label', { class: 'eq-check' },
            h('input', {
              type: 'checkbox', checked: m0.asistencia_activa,
              onChange: (e) => { m0.asistencia_activa = e.target.checked; },
            }),
            ' Pasar lista (asistencia)'),
          h('label', { class: 'eq-check' },
            h('input', {
              type: 'checkbox', checked: m0.reflexion_activa,
              onChange: (e) => { m0.reflexion_activa = e.target.checked; },
            }),
            ' Pedir reflexión'),
        ),
        h('div', { class: 'eq-form-acciones' },
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              try {
                if (!m0.name.trim()) { toast('El nombre no puede quedar vacío', 'error'); return; }
                await actualizarEquipo(teamId, { name: m0.name, category: m0.category });
                await guardarAjustes(teamId, {
                  color: m0.color, dia_convocatoria: m0.dia_convocatoria,
                  asistencia_activa: m0.asistencia_activa, reflexion_activa: m0.reflexion_activa,
                  hora_convocatoria: m0.hora_convocatoria || null,
                });
                invalidarEquipos(); refrescar(); toast('Ajustes guardados');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Guardar ajustes'),
        ),
      ),
      cardReflexion(),
    );
  }

  // ── Carga y orquestación ───────────────────────────────────
  async function refrescar() {
    try {
      [equipo, temporada] = await Promise.all([getEquipo(teamId), getTemporadaActiva()]);
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'Equipo no disponible'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/equipos', 'data-link': true }, 'Volver a equipos')));
      return;
    }
    const zona = h('div', { class: 'eq-zona' }, h('div', { class: 'skeleton eq-skeleton' }));
    mount(cont, cabecera(), tabs(), zona);
    centraTabActiva();
    try {
      if (tab === 'progresion') await pintaProgresion(zona, { teamId, seasonId: temporada?.id || null });
      else if (tab === 'horarios') await pintaHorarios(zona);
      else if (tab === 'objetivos') await pintaObjetivos(zona);
      else if (tab === 'partidos') await pintaPartidos(zona);
      else if (tab === 'ajustes') await pintaAjustes(zona);
      else await pintaPlantilla(zona);
    } catch (e) {
      mount(zona, h('p', { class: 'eq-ayuda' }, 'Error al cargar: ' + e.message));
    }
  }
  refrescar();

  return { destroy() {} };
}
