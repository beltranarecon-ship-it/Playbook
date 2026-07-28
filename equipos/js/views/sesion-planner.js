/* ============================================================
   sesion-planner.js — /sesiones/:sessionId · planificador.
   Bloques de ejercicios (orden · duración · intensidad 1-5),
   curva de carga en vivo, objetivos congelados (herencia M3) y
   promoción preliminar→programada al guardar.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { abrirModal } from '../ui/modal.js';
import { puntoEquipo } from '../ui/components.js';
import { badgeCategoria } from './objetivo-form.js';
import { getMisEquipos } from '../data/teams.js';
import {
  getSesion, promoverSesion, cancelarSesion, guardarCabeceraSesion,
} from '../data/sessions.js';
import {
  getBloques, guardarBloques, getObjetivosSesion, guardarObjetivosSesion,
} from '../data/blocks.js';
import {
  getObjetivos, getEjerciciosSugeribles,
} from '../data/objectives.js';
import { objetivosEnFecha } from '../data/sugerencias.js';
import { sugerirEjercicios, normaliza } from '../data/sugerencias.js';
import {
  curvaCarga, geometriaCurva, avisoDuracion, INTENSIDAD_MAX, INTENSIDAD_LABEL,
} from '../data/carga.js';
import { ESTADOS_SESION, WEEKDAYS } from '../config.js';
import { router } from '../main.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const isoWeekday = (iso) => { const d = new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay(); return d === 0 ? 7 : d; };
const hhmm = (t) => (t ? t.slice(0, 5) : '');
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Selector de intensidad 1-5 tipo medidor (relleno papaya hasta el nivel). */
function intensidadSelector(valor, onChange) {
  let sel = valor || 3;
  const wrap = h('div', { class: 'eq-int', role: 'radiogroup', 'aria-label': 'Intensidad 1 a 5' });
  const pinta = () => wrap.replaceChildren(...Array.from({ length: INTENSIDAD_MAX }, (_, i) => {
    const n = i + 1;
    return h('button', {
      class: 'eq-int-seg' + (n <= sel ? ' on' : ''), type: 'button', role: 'radio',
      'aria-checked': String(n === sel), 'aria-label': `${n} · ${INTENSIDAD_LABEL[n]}`,
      title: `${n} · ${INTENSIDAD_LABEL[n]}`,
      onClick: () => { sel = n; pinta(); onChange(n); },
    });
  }));
  pinta();
  return wrap;
}

export function render(root, params) {
  const sessionId = params.sessionId;
  const cont = h('div', { class: 'eq-page eq-planner' });
  mount(root, cont);

  let sesion = null, equipos = [], color = 'var(--muted)', nombreEquipo = '—';
  let bloques = [];              // [{id?, exercise_id, titulo, duracion_min, intensidad, notas}]
  let objetivosEquipo = [];      // objetivos activos/conseguidos del equipo
  let objetivosSel = new Set();  // ids congelados
  let biblioteca = [];
  let titulo = '';
  let soloLectura = false;       // realizada/cancelada = histórico, no editable
  let sucio = false;             // hay cambios sin guardar
  const marcaSucio = () => { sucio = true; };
  const nodoCurva = h('div', { class: 'eq-curva-wrap' });
  const nodoBloques = h('div', { class: 'eq-bloques' });
  const nodoTotales = h('div', { class: 'eq-carga-totales' });

  // aviso al cerrar/recargar la pestaña con cambios pendientes
  const onBeforeUnload = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  const salir = (destino) => {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir y descartarlos?')) return false;
    sucio = false; router.navigate(destino); return true;
  };

  // ── curva + totales (recalcular sin re-pintar la lista) ────
  function actualizaCurva() {
    const c = curvaCarga(bloques);
    const aviso = avisoDuracion(c.duracion, sesion?.slot_duracion_min);

    const ancho = 640, alto = 120, padY = 8;
    const g = geometriaCurva(c.segmentos, { ancho, alto: alto - padY * 2, maxIntensidad: INTENSIDAD_MAX });
    const desplaza = (pts) => pts.map((p) => `${p.x.toFixed(1)},${(p.y + padY).toFixed(1)}`).join(' ');

    const svg = c.segmentos.length
      ? h('svg', {
          class: 'eq-curva', viewBox: `0 0 ${ancho} ${alto}`, preserveAspectRatio: 'none',
          role: 'img', 'aria-label': `Curva de carga: ${c.duracion} minutos, carga ${c.carga}`,
        },
          // líneas guía de intensidad
          ...Array.from({ length: INTENSIDAD_MAX + 1 }, (_, i) => {
            const y = padY + (alto - padY * 2) * (i / INTENSIDAD_MAX);
            return h('line', { class: 'eq-curva-guia', x1: 0, y1: y, x2: ancho, y2: y });
          }),
          h('polygon', { class: 'eq-curva-area', points: desplaza(g.area) }),
          h('polyline', { class: 'eq-curva-linea', points: desplaza(g.top) }),
        )
      : h('div', { class: 'eq-curva-vacia' }, 'Añade bloques para ver la curva de carga');

    nodoCurva.replaceChildren(svg);

    nodoTotales.replaceChildren(
      h('div', { class: 'eq-carga-dato' },
        h('span', { class: 'eq-carga-num' }, String(c.duracion)),
        h('span', { class: 'eq-carga-lbl' }, 'min totales')),
      h('div', { class: 'eq-carga-dato' },
        h('span', { class: 'eq-carga-num' }, String(c.carga)),
        h('span', { class: 'eq-carga-lbl' }, 'carga (int×min)')),
      h('div', { class: 'eq-carga-dato' },
        h('span', { class: 'eq-carga-num' }, c.cargaMedia ? c.cargaMedia.toFixed(1) : '0'),
        h('span', { class: 'eq-carga-lbl' }, 'intensidad media')),
      aviso ? h('div', { class: 'eq-carga-aviso' },
        aviso.tipo === 'excede'
          ? `⚠ ${aviso.diff} min por encima del horario (${sesion.slot_duracion_min}′)`
          : `${aviso.diff} min por debajo del horario (${sesion.slot_duracion_min}′)`) : null,
    );
  }

  // ── un bloque ──────────────────────────────────────────────
  function filaBloque(b, i) {
    const tituloEl = b.exercise_id
      ? h('a', { class: 'eq-bloque-titulo eq-bloque-link', href: `/ejercicios/${b.exercise_id}`, target: '_blank', rel: 'noopener', title: 'Abrir en la biblioteca' }, b.titulo)
      : soloLectura
        ? h('span', { class: 'eq-bloque-titulo' }, b.titulo || '(bloque libre)')
        : h('input', {
            class: 'field-input eq-bloque-titulo-input', type: 'text', value: b.titulo,
            placeholder: 'Bloque libre (calentamiento, charla…)',
            onInput: (e) => { b.titulo = e.target.value; marcaSucio(); },
          });

    if (soloLectura) {
      return h('div', { class: 'eq-bloque eq-bloque-ro' },
        h('div', { class: 'eq-bloque-orden' }, h('span', { class: 'eq-bloque-n' }, String(i + 1))),
        h('div', { class: 'eq-bloque-cuerpo' },
          h('div', { class: 'eq-bloque-cab' }, tituloEl),
          h('div', { class: 'eq-bloque-ctrls eq-bloque-ctrls-ro' },
            h('span', { class: 'eq-bloque-ro-dato' }, `${b.duracion_min} min`),
            h('span', { class: 'eq-bloque-ro-dato' }, `Intensidad ${b.intensidad}/${INTENSIDAD_MAX}`),
          ),
        ),
      );
    }

    return h('div', { class: 'eq-bloque' },
      h('div', { class: 'eq-bloque-orden' },
        h('button', { class: 'eq-mov', type: 'button', 'aria-label': 'Subir', disabled: i === 0, onClick: () => mueveBloque(i, -1) }, '↑'),
        h('span', { class: 'eq-bloque-n' }, String(i + 1)),
        h('button', { class: 'eq-mov', type: 'button', 'aria-label': 'Bajar', disabled: i === bloques.length - 1, onClick: () => mueveBloque(i, 1) }, '↓'),
      ),
      h('div', { class: 'eq-bloque-cuerpo' },
        h('div', { class: 'eq-bloque-cab' },
          tituloEl,
          h('button', { class: 'eq-slot-quitar', type: 'button', 'aria-label': 'Quitar bloque', onClick: () => quitaBloque(i) }, '×'),
        ),
        h('div', { class: 'eq-bloque-ctrls' },
          h('label', { class: 'eq-bloque-dur' },
            h('input', {
              class: 'field-input', type: 'number', min: 1, max: 240, value: b.duracion_min,
              'aria-label': 'Duración en minutos',
              onChange: (e) => { b.duracion_min = Math.max(1, Number(e.target.value) || 1); e.target.value = b.duracion_min; marcaSucio(); actualizaCurva(); },
            }),
            h('span', { class: 'eq-bloque-dur-u' }, 'min'),
          ),
          intensidadSelector(b.intensidad, (v) => { b.intensidad = v; marcaSucio(); actualizaCurva(); }),
        ),
      ),
    );
  }

  function pintaBloques() {
    if (!bloques.length) {
      nodoBloques.replaceChildren(h('p', { class: 'eq-ayuda' }, 'Sesión sin bloques todavía. Añade ejercicios de tu biblioteca o un bloque libre.'));
    } else {
      nodoBloques.replaceChildren(...bloques.map(filaBloque));
    }
    actualizaCurva();
  }

  function mueveBloque(i, d) {
    const j = i + d;
    if (j < 0 || j >= bloques.length) return;
    [bloques[i], bloques[j]] = [bloques[j], bloques[i]];
    marcaSucio(); pintaBloques();
  }
  function quitaBloque(i) { bloques.splice(i, 1); marcaSucio(); pintaBloques(); }
  function añadeBloque(b) { bloques.push(b); marcaSucio(); pintaBloques(); }

  // ── picker de ejercicios ───────────────────────────────────
  function abrePicker() {
    const objsSesion = objetivosEquipo.filter((o) => objetivosSel.has(o.id));
    const pista = objsSesion.map((o) => `${o.titulo} ${o.descripcion || ''}`).join(' ');
    let listaEl, input;

    const render = (q) => {
      const term = normaliza(q);
      let items;
      if (term) {
        items = biblioteca.filter((e) =>
          normaliza(e.name).includes(term)
          || (e.tags || []).some((t) => normaliza(t).includes(term))
          || normaliza(e.type).includes(term));
      } else if (pista) {
        // sin búsqueda: prioriza por los objetivos congelados de la sesión
        items = sugerirEjercicios({ titulo: pista, categoria: objsSesion[0]?.categoria }, biblioteca, { limite: 30 }).map((x) => x.ejercicio);
      } else {
        items = biblioteca.slice(0, 30);
      }
      listaEl.replaceChildren(...(items.length ? items.map((e) => h('button', {
        class: 'eq-picker-item', type: 'button',
        onClick: () => {
          añadeBloque({
            exercise_id: e.id, titulo: e.name,
            duracion_min: e.duration_min || 10,
            intensidad: e.intensidad || 3, notas: null,
          });
          toast(`+ ${e.name}`);
        },
      },
        h('span', { class: 'eq-picker-nombre' }, e.name),
        h('span', { class: 'eq-picker-meta' }, [e.type, e.duration_min ? `${e.duration_min}′` : null, e.intensidad ? `int ${e.intensidad}` : null].filter(Boolean).join(' · ')),
      )) : [h('p', { class: 'eq-ayuda' }, 'Sin ejercicios que casen. Prueba otra palabra o añade un bloque libre.')]));
    };

    const md = abrirModal({
      titulo: 'Añadir ejercicios',
      cuerpo: h('div', { class: 'eq-picker' },
        input = h('input', {
          class: 'field-input', type: 'search', placeholder: 'Buscar en tu biblioteca…',
          'aria-label': 'Buscar ejercicio', onInput: (e) => render(e.target.value),
        }),
        pista ? h('p', { class: 'eq-ayuda' }, 'Ordenado por los objetivos de la sesión. Escribe para buscar.') : null,
        listaEl = h('div', { class: 'eq-picker-lista' }),
      ),
      pie: [
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { añadeBloque({ exercise_id: null, titulo: '', duracion_min: 10, intensidad: 3, notas: null }); md.cerrar(); } }, '+ Bloque libre'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => md.cerrar() }, 'Listo'),
      ],
    });
    render('');
    input.focus();
  }

  // ── sección de objetivos (congelar herencia) ───────────────
  function seccionObjetivos() {
    const cubren = new Set(objetivosEnFecha(sesion.fecha, objetivosEquipo).map((o) => o.id));
    const activos = objetivosEquipo.filter((o) => o.estado !== 'archivado');
    if (!activos.length) {
      return h('div', { class: 'eq-planner-obj' },
        h('p', { class: 'eq-ayuda' }, 'Este equipo no tiene objetivos. Créalos en la ficha del equipo o desde el calendario.'));
    }
    // orden: primero los que cubren la fecha (herencia viva)
    activos.sort((a, b) => (cubren.has(b.id) ? 1 : 0) - (cubren.has(a.id) ? 1 : 0));
    return h('div', { class: 'eq-planner-obj' },
      ...activos.map((o) => {
        const id = `obj-${o.id}`;
        return h('label', { class: 'eq-obj-check', for: id },
          h('input', {
            id, type: 'checkbox', checked: objetivosSel.has(o.id), disabled: soloLectura,
            onChange: (e) => { e.target.checked ? objetivosSel.add(o.id) : objetivosSel.delete(o.id); marcaSucio(); },
          }),
          h('span', { class: 'eq-obj-check-txt' },
            o.titulo, ' ', badgeCategoria(o.categoria),
            cubren.has(o.id) ? h('span', { class: 'eq-obj-badge eq-obj-badge-viva' }, 'estas fechas') : null,
          ),
        );
      }),
    );
  }

  // ── pintado principal ──────────────────────────────────────
  function pinta() {
    const [y, m, d] = sesion.fecha.split('-').map(Number);
    const fechaTxt = `${WEEKDAYS[isoWeekday(sesion.fecha) - 1].nombre} ${d} de ${MESES[m - 1]}`;
    const horaTxt = [hhmm(sesion.hora_inicio) && `${hhmm(sesion.hora_inicio)}–${hhmm(sesion.hora_fin)}`, sesion.lugar].filter(Boolean).join(' · ');

    mount(cont,
      h('div', { class: 'eq-planner-top' },
        h('a', {
          class: 'eq-volver', href: `/sesiones?equipo=${sesion.team_id}`,
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); salir(`/sesiones?equipo=${sesion.team_id}`); },
        }, '‹ Calendario'),
        h('span', { class: `eq-estado-badge eq-ses-${sesion.estado}` }, ESTADOS_SESION[sesion.estado]),
      ),
      h('div', { class: 'view-hero eq-planner-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, puntoEquipo(color), ' ', nombreEquipo),
          h('h1', { class: 'display view-title' }, fechaTxt),
          horaTxt ? h('p', { class: 'view-meta' }, horaTxt) : null,
        ),
      ),

      h('div', { class: 'field-group eq-planner-titulo' },
        h('label', { class: 'field-label' }, 'Título de la sesión (opcional — si lo dejas vacío, hereda de los objetivos)'),
        h('input', {
          class: 'field-input', type: 'text', value: titulo, readOnly: soloLectura,
          placeholder: 'p. ej. Salida de presión + tiro tras bote',
          onInput: (e) => { titulo = e.target.value; marcaSucio(); },
        }),
      ),

      h('section', { class: 'eq-planner-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Objetivos de la sesión'),
        seccionObjetivos(),
      ),

      h('section', { class: 'eq-planner-seccion' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'Bloques'),
          soloLectura ? null : h('button', { class: 'btn btn-secondary', type: 'button', onClick: abrePicker }, '+ Añadir ejercicios'),
        ),
        nodoBloques,
      ),

      h('section', { class: 'eq-planner-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Curva de carga'),
        nodoTotales,
        nodoCurva,
      ),

      barraAcciones(),
    );
    pintaBloques();
  }

  function barraAcciones() {
    // el cierre (M5) es la otra mitad de la sesión: lista + reflexión
    const irCierre = () => salir(`/sesiones/${sessionId}/cierre`);
    if (soloLectura) {
      return h('div', { class: 'eq-planner-barra' },
        h('p', { class: 'eq-ayuda' },
          sesion.estado === 'realizada'
            ? 'Sesión realizada: el plan queda como histórico y no se edita.'
            : 'Sesión cancelada: el plan queda como histórico y no se edita.'),
        sesion.estado === 'realizada'
          ? h('button', { class: 'btn btn-secondary', type: 'button', onClick: irCierre }, 'Ver cierre')
          : null,
      );
    }
    const esPreliminar = sesion.estado === 'preliminar';
    return h('div', { class: 'eq-planner-barra' },
      h('div', { class: 'eq-planner-barra-sec' },
        (sesion.estado === 'preliminar' || sesion.estado === 'programada') ? h('button', {
          class: 'btn btn-secondary eq-btn-peligro', type: 'button',
          onClick: async () => {
            const motivo = await pedirMotivo();
            if (!motivo) return;
            try { await cancelarSesion(sessionId, motivo); sucio = false; toast('Sesión cancelada'); router.navigate(`/sesiones?equipo=${sesion.team_id}`); }
            catch (e) { toast('Error: ' + e.message, 'error'); }
          },
        }, 'Cancelar sesión') : null,
        sesion.fecha <= hoyISO() ? h('button', {
          class: 'btn btn-secondary', type: 'button', onClick: irCierre,
        }, 'Pasar lista') : null,
      ),
      h('button', {
        class: 'btn btn-primary eq-planner-guardar', type: 'button',
        onClick: guardar,
      }, esPreliminar ? 'Guardar y confirmar' : 'Guardar plan'),
    );
  }

  async function pedirMotivo() {
    return new Promise((resolve) => {
      let inp;
      const md = abrirModal({
        titulo: 'Cancelar sesión',
        cuerpo: h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Motivo (obligatorio)'),
          inp = h('input', { class: 'field-input', type: 'text', placeholder: 'Lluvia, pabellón cerrado…' })),
        pie: [
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { md.cerrar(); resolve(null); } }, 'Volver'),
          h('button', { class: 'btn btn-primary', type: 'button', onClick: () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } md.cerrar(); resolve(v); } }, 'Cancelar sesión'),
        ],
      });
      inp.focus();
    });
  }

  async function guardar() {
    if (soloLectura) return;   // histórico: no se re-guarda
    // valida bloques libres sin título
    const libreSinTitulo = bloques.find((b) => !b.exercise_id && !(b.titulo || '').trim());
    if (libreSinTitulo) { toast('Un bloque libre está sin título', 'error'); return; }
    const esPreliminar = sesion.estado === 'preliminar';
    try {
      await guardarBloques(sessionId, bloques);
      await guardarObjetivosSesion(sessionId, [...objetivosSel]);
      await guardarCabeceraSesion(sessionId, { titulo });
      if (esPreliminar) await promoverSesion(sessionId);
      sucio = false;
      toast(esPreliminar ? 'Sesión planificada y confirmada' : 'Plan guardado');
      router.navigate(`/sesiones?equipo=${sesion.team_id}`);
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  }

  // ── carga inicial ──────────────────────────────────────────
  (async () => {
    try {
      sesion = await getSesion(sessionId);
      soloLectura = sesion.estado === 'realizada' || sesion.estado === 'cancelada';
      titulo = sesion.titulo || '';
      const [eqs, blks, objsSes] = await Promise.all([
        getMisEquipos(), getBloques(sessionId), getObjetivosSesion(sessionId),
      ]);
      equipos = eqs;
      const eq = equipos.find((t) => t.id === sesion.team_id);
      color = eq?.color || 'var(--muted)';
      nombreEquipo = eq?.name || '—';
      bloques = blks.map((b) => ({ ...b }));
      objetivosSel = new Set(objsSes);

      [objetivosEquipo, biblioteca] = await Promise.all([
        getObjetivos(sesion.team_id, sesion.season_id),
        getEjerciciosSugeribles().catch(() => []),
      ]);

      // pre-marca los objetivos que cubren la fecha SOLO si la sesión nunca se
      // planificó (sin bloques ni congelados previos). Así "0 objetivos" tras
      // guardar es una elección deliberada que no se re-autorrellena al reabrir;
      // cubre también las sesiones manuales (nacen 'programada', no 'preliminar').
      if (!objetivosSel.size && !bloques.length) {
        for (const o of objetivosEnFecha(sesion.fecha, objetivosEquipo)) objetivosSel.add(o.id);
      }
      pinta();
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir la sesión'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/sesiones', 'data-link': true }, 'Volver al calendario')));
    }
  })();

  return { destroy() { window.removeEventListener('beforeunload', onBeforeUnload); } };
}
