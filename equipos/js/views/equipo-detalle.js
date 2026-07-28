/* ============================================================
   equipo-detalle.js — /equipos/:teamId · pestañas ?tab=
   plantilla (roster + pegar lista) | horarios (slots + periodos +
   regenerar con preview) | ajustes (color, convocatoria, nombre).
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast, toastDeshacer } from '../ui/toast.js';
import { abrirModal, confirmar } from '../ui/modal.js';
import { colorPicker, diaChips, slotsEditor, avatar, puntoEquipo } from '../ui/components.js';
import { getEquipo, actualizarEquipo, guardarAjustes } from '../data/teams.js';
import { getJugadores, crearJugador, crearJugadoresBulk, actualizarJugador } from '../data/players.js';
import { getSlots, guardarSlots, previewRegeneracion, getPeriodos, addPeriodo, addPeriodosBulk, borrarPeriodo, getSlotsOtrasTemporadas } from '../data/schedules.js';
import { getTemporadas } from '../data/seasons.js';
import { getPartidosEquipo } from '../data/matches.js';
import {
  balancePartidos, mediasPorEje, resultadoPartido, mediaValoracion, ESTADOS_PARTIDO,
} from '../data/partidos.js';
import { getTemporadaActiva, aplicarPlan } from '../data/sessions.js';
import { getObjetivos, actualizarObjetivo, borrarObjetivo } from '../data/objectives.js';
import { getAsistenciaEquipo } from '../data/attendance.js';
import { estadisticasJugadores } from '../data/asistencia.js';
import {
  getPreguntas, crearPregunta, actualizarPregunta, borrarPregunta,
  guardarOrdenPreguntas, restaurarPlantilla,
} from '../data/reflection.js';
import { claveDesdeEtiqueta, TIPOS_REFLEXION, CLAVE_CUMPLIMIENTO } from '../data/reflexion.js';
import { modalObjetivo, filaObjetivo } from './objetivo-form.js';
import { avisoTemporada, fechaLarga } from './temporada-form.js';
import { temporadaCubre } from '../data/programacion.js';
import { invalidarEquipos, esAdmin } from '../store.js';
import { CATEGORIAS_EQUIPO, POSICIONES, ESTADOS_JUGADOR, weekdayNombre } from '../config.js';
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
    ...[['plantilla', 'Plantilla'], ['objetivos', 'Objetivos'], ['partidos', 'Partidos'], ['horarios', 'Horarios'], ['ajustes', 'Ajustes']].map(([k, txt]) =>
      h('button', {
        class: 'eq-tab-btn' + (tab === k ? ' active' : ''), type: 'button',
        'aria-current': tab === k ? 'page' : null,
        onClick: () => irTab(k),
      }, txt)),
  );

  // ── Pestaña PLANTILLA ──────────────────────────────────────
  async function pintaPlantilla(zona) {
    // la asistencia acumulada (M5) es el pago de pasar lista; si 014 no está
    // aplicada o no hay listas todavía, la ficha sigue igual de útil
    const [jugadores, filasAsis] = await Promise.all([
      getJugadores(teamId),
      getAsistenciaEquipo(teamId, temporada.id).catch(() => []),
    ]);
    const color = equipo.team_settings?.color;
    const stats = new Map(estadisticasJugadores(jugadores, filasAsis).map((s) => [s.player_id, s]));

    const fila = (j) => h('div', { class: 'eq-jugador' + (j.estado !== 'activo' ? ' atenuado' : '') },
      avatar(j.nombre, color),
      h('span', { class: 'eq-jugador-dorsal' }, j.dorsal != null ? String(j.dorsal) : '·'),
      h('div', { class: 'eq-jugador-datos' },
        h('span', { class: 'eq-jugador-nombre' }, j.nombre),
        h('span', { class: 'eq-jugador-sub' },
          [
            j.posicion,
            j.estado !== 'activo' ? ESTADOS_JUGADOR[j.estado] : null,
            stats.get(j.id)?.pct != null
              ? `${stats.get(j.id).pct}% asistencia (${stats.get(j.id).entrenaron}/${stats.get(j.id).total})`
              : null,
          ].filter(Boolean).join(' · ') || ' '),
      ),
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
      jugadores.length
        ? h('div', { class: 'eq-jugadores' }, jugadores.map(fila))
        : h('div', { class: 'empty-state' },
            h('p', { class: 'empty-state-display' }, 'Sin jugadores'),
            h('p', {}, 'Añade la plantilla para poder pasar lista. El truco rápido: «Pegar lista».')),
    );
  }

  // ── Pestaña OBJETIVOS ──────────────────────────────────────
  async function pintaObjetivos(zona) {
    const todos = await getObjetivos(teamId, temporada.id);
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
  async function pintaPartidos(zona) {
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
    );
  }

  // ── Pestaña HORARIOS ───────────────────────────────────────
  async function pintaHorarios(zona) {
    const [slots, periodos] = await Promise.all([
      getSlots(teamId, temporada.id),
      getPeriodos(temporada.id, teamId),
    ]);
    const editor = slotsEditor(slots);

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
        toast(`${heredables.length} horarios copiados de ${heredables.label}. Revísalos y pulsa «Guardar y regenerar».`);
      } catch (e) { toast('Error: ' + e.message, 'error'); }
    };

    const regenerar = async () => {
      try {
        await guardarSlots(teamId, temporada.id, editor.leer());
        const { plan, resumen } = await previewRegeneracion(teamId, temporada);
        if (!resumen.insertar && !resumen.actualizar && !resumen.borrar) {
          toast('El calendario ya está al día'); return;
        }
        const partes = [];
        if (resumen.insertar) partes.push(`${resumen.insertar} nuevas`);
        if (resumen.actualizar) partes.push(`${resumen.actualizar} actualizadas (hora/lugar)`);
        if (resumen.borrar) partes.push(`${resumen.borrar} preliminares eliminadas`);
        // el rango se dice SIEMPRE: la generación solo puebla la temporada
        // activa, y verlo aquí evita el "no se generan" cuando en realidad
        // se generaron 86 sesiones en fechas ya pasadas
        const rango = `Se generarán entre el ${fechaLarga(temporada.start_date)} y el ${fechaLarga(temporada.end_date)} (temporada ${temporada.label}).`;
        const ok = await confirmar({
          titulo: 'Regenerar calendario',
          mensaje: `${rango} Sesiones preliminares: ${partes.join(', ')}. Las programadas, realizadas o movidas a mano no se tocan. ¿Continuar?`,
          textoOk: 'Regenerar',
        });
        if (!ok) return;
        const r = await aplicarPlan(teamId, temporada.id, plan);
        toast(`Calendario actualizado: +${r.insertadas} · ~${r.actualizadas} · −${r.borradas}`
          + (r.conservadas ? ` · ${r.conservadas} conservadas (ya tenían lista pasada)` : ''));
      } catch (e) { toast('Error al regenerar: ' + e.message, 'error'); }
    };

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
      const md = abrirModal({
        titulo: 'Pegar calendario escolar',
        cuerpo: h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Una línea por periodo: «2025-12-22 2026-01-07 Navidad» (o una sola fecha)'),
          ta = h('textarea', { class: 'field-textarea', rows: 8, placeholder: '2025-10-13 Fiesta local\n2025-12-22 2026-01-07 Navidad' }),
          esAdmin() ? h('p', { class: 'eq-ayuda' }, 'Se añadirán como periodos de CLUB (todos los equipos).') : null,
        ),
        pie: [
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md.cerrar() }, 'Cancelar'),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              try {
                const filas = await addPeriodosBulk({
                  season_id: temporada.id,
                  team_id: esAdmin() ? null : teamId,
                  texto: ta.value,
                });
                md.cerrar(); refrescar();
                const fuera = filas.filter((f) =>
                  !temporadaCubre(temporada, f.fecha_inicio) && !temporadaCubre(temporada, f.fecha_fin)).length;
                toast(`${filas.length} periodos añadidos`
                  + (fuera ? ` · ${fuera} fuera de la temporada ${temporada.label}` : ''),
                  fuera ? 'error' : 'success');
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
        h('button', { class: 'btn btn-primary', type: 'button', onClick: regenerar }, 'Guardar y regenerar'),
      ),
      h('p', { class: 'eq-ayuda' },
        `Estos días se repetirán del ${fechaLarga(temporada.start_date)} al ${fechaLarga(temporada.end_date)}.`),
      heredables.length ? h('div', { class: 'eq-aviso eq-aviso-temporada' },
        h('span', {}, `Este equipo no tiene horarios en ${temporada.label}, pero sí ${heredables.length} en ${heredables.label}.`),
        h('button', { class: 'btn btn-primary eq-btn-mini', type: 'button', onClick: copiarHorarios },
          `Copiar los de ${heredables.label}`),
      ) : null,
      editor,
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
    };
    // null = la reflexión aún no existe en esta BD (015 sin aplicar)
    let preguntas = null;
    try { preguntas = await getPreguntas(teamId); } catch { preguntas = null; }

    // ── preguntas de reflexión (plantilla del equipo) ────────
    const nuevo = { etiqueta: '', tipo: 'estrellas' };

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
            mensaje: q.clave === CLAVE_CUMPLIMIENTO
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
        h('p', { class: 'eq-ayuda' }, 'Lo que te preguntará la app al cerrar cada sesión. Las estrellas van de 1 a 5; los textos son libres.'),
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
          h('button', {
            class: 'btn btn-secondary', type: 'button',
            onClick: async () => {
              const etiqueta = nuevo.etiqueta.trim();
              if (!etiqueta) { toast('Escribe la pregunta', 'error'); return; }
              try {
                await crearPregunta({
                  team_id: teamId,
                  clave: claveDesdeEtiqueta(etiqueta, preguntas.map((q) => q.clave), { tipo: nuevo.tipo }),
                  etiqueta, tipo: nuevo.tipo,
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
        ),
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
    try {
      if (tab === 'horarios') await pintaHorarios(zona);
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
