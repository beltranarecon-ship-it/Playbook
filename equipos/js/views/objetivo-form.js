/* ============================================================
   objetivo-form.js — modal compartido de crear/editar objetivo
   (calendario y pestaña Objetivos). Muestra sugerencias de
   ejercicios EN VIVO: motor determinista de sugerencias.js sobre
   la biblioteca (sin IA, coste cero).
   ============================================================ */

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { abrirModal } from '../ui/modal.js';
import { puntoEquipo } from '../ui/components.js';
import { crearObjetivo, actualizarObjetivo, getEjerciciosSugeribles } from '../data/objectives.js';
import { sugerirEjercicios } from '../data/sugerencias.js';
import { CATEGORIAS_OBJETIVO } from '../config.js';

/**
 * @param equipos    lista de mis equipos [{id, name, color}] (para el select)
 * @param teamId     equipo fijado (desde su pestaña) — oculta el select
 * @param temporada  temporada activa {id, label, start_date, end_date}
 * @param fechas     {inicio, fin} prefijadas (selección en el calendario)
 * @param objetivo   objetivo existente → modo edición
 * @param onGuardado callback tras crear/editar
 */
export function modalObjetivo({ equipos = [], teamId = null, temporada, fechas = null, objetivo = null, onGuardado }) {
  const seasonId = temporada?.id;
  const m0 = {
    team_id: objetivo?.team_id || teamId || (equipos.length === 1 ? equipos[0].id : ''),
    titulo: objetivo?.titulo || '',
    descripcion: objetivo?.descripcion || '',
    categoria: objetivo?.categoria || '',
    fecha_inicio: objetivo?.fecha_inicio || fechas?.inicio || '',
    fecha_fin: objetivo?.fecha_fin || fechas?.fin || '',
  };

  let biblioteca = null;
  getEjerciciosSugeribles().then((b) => { biblioteca = b; pintaSugerencias(); }).catch(() => {});

  // ── sugerencias en vivo ────────────────────────────────────
  const zonaSug = h('div', { class: 'eq-sug' });
  let timer = null;
  const pideSugerencias = () => { clearTimeout(timer); timer = setTimeout(pintaSugerencias, 250); };

  function pintaSugerencias() {
    if (!biblioteca) return;
    const top = sugerirEjercicios(m0, biblioteca, { limite: 6 });
    if (!top.length) {
      zonaSug.replaceChildren(
        (m0.categoria || m0.titulo.trim())
          ? h('p', { class: 'eq-ayuda' }, 'Sin ejercicios que casen todavía — afina el título o la categoría.')
          : h('p', { class: 'eq-ayuda' }, 'Elige categoría o escribe el título y te sugiero ejercicios de la biblioteca.'));
      return;
    }
    zonaSug.replaceChildren(
      h('span', { class: 'field-label' }, 'Ejercicios sugeridos'),
      ...top.map(({ ejercicio: ej }) => h('a', {
        class: 'eq-sug-item', href: `/ejercicios/${ej.id}`, target: '_blank', rel: 'noopener',
        title: 'Abrir en la biblioteca',
      },
        h('span', { class: 'eq-sug-nombre' }, ej.name),
        h('span', { class: 'eq-sug-meta' },
          [ej.type, ej.category, ej.duration_min ? `${ej.duration_min}′` : null].filter(Boolean).join(' · ')),
      )),
    );
  }

  // ── chips de categoría ─────────────────────────────────────
  const chipsCat = h('div', { class: 'eq-catchips', role: 'radiogroup', 'aria-label': 'Categoría' });
  const pintaCats = () => {
    chipsCat.replaceChildren(...CATEGORIAS_OBJETIVO.map((c) =>
      h('button', {
        class: 'eq-catchip' + (c === m0.categoria ? ' sel' : ''),
        type: 'button', role: 'radio', 'aria-checked': String(c === m0.categoria),
        onClick: () => { m0.categoria = c; pintaCats(); pintaSugerencias(); },
      }, c)));
  };
  pintaCats();

  // ── formulario ─────────────────────────────────────────────
  let inTitulo;
  const cuerpo = h('div', { class: 'eq-form-vertical' },
    (!teamId && !objetivo && equipos.length > 1) ? h('div', { class: 'field-group' },
      h('label', { class: 'field-label' }, 'Equipo ', h('span', { class: 'required' }, '*')),
      h('select', { class: 'field-select', onChange: (e) => { m0.team_id = e.target.value; } },
        h('option', { value: '' }, '— Elige equipo —'),
        ...equipos.map((t) => h('option', { value: t.id, ...(t.id === m0.team_id ? { selected: true } : {}) }, t.name))),
    ) : null,
    h('div', { class: 'field-group' },
      h('label', { class: 'field-label' }, 'Objetivo ', h('span', { class: 'required' }, '*')),
      inTitulo = h('input', {
        class: 'field-input', type: 'text', value: m0.titulo,
        placeholder: 'Salida de presión, 1c1 defensivo…',
        onInput: (e) => { m0.titulo = e.target.value; pideSugerencias(); },
      }),
    ),
    h('div', { class: 'field-group' },
      h('label', { class: 'field-label' }, 'Categoría ', h('span', { class: 'required' }, '*')),
      chipsCat,
    ),
    h('div', { class: 'field-row' },
      h('div', { class: 'field-group' },
        h('label', { class: 'field-label' }, 'Desde ', h('span', { class: 'required' }, '*')),
        h('input', {
          class: 'field-input', type: 'date', value: m0.fecha_inicio,
          onChange: (e) => { m0.fecha_inicio = e.target.value; if (!m0.fecha_fin) m0.fecha_fin = e.target.value; },
        })),
      h('div', { class: 'field-group' },
        h('label', { class: 'field-label' }, 'Hasta ', h('span', { class: 'required' }, '*')),
        h('input', {
          class: 'field-input', type: 'date', value: m0.fecha_fin,
          onChange: (e) => { m0.fecha_fin = e.target.value; },
        })),
    ),
    h('div', { class: 'field-group' },
      h('label', { class: 'field-label' }, 'Descripción'),
      h('textarea', {
        class: 'field-textarea', rows: 2,
        placeholder: 'Qué queréis conseguir y cómo se verá en pista',
        onInput: (e) => { m0.descripcion = e.target.value; pideSugerencias(); },
      }, m0.descripcion),
    ),
    zonaSug,
  );

  const md = abrirModal({
    titulo: objetivo ? 'Editar objetivo' : 'Nuevo objetivo',
    cuerpo,
    pie: [
      h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md.cerrar() }, 'Cancelar'),
      h('button', {
        class: 'btn btn-primary', type: 'button',
        onClick: async () => {
          if (!m0.titulo.trim()) { inTitulo.focus(); inTitulo.classList.add('animate-shake'); return; }
          if (!m0.team_id) { toast('Elige un equipo', 'error'); return; }
          if (!m0.categoria) { toast('Elige la categoría', 'error'); return; }
          if (!m0.fecha_inicio || !m0.fecha_fin) { toast('Faltan las fechas', 'error'); return; }
          if (m0.fecha_fin < m0.fecha_inicio) { toast('La fecha final es anterior al inicio', 'error'); return; }
          // coherencia con la temporada: evita objetivos "fantasma" (la pestaña
          // filtra por temporada; el calendario, por fechas). Solo si hay límites.
          if (temporada?.start_date && temporada?.end_date
              && (m0.fecha_inicio < temporada.start_date || m0.fecha_fin > temporada.end_date)) {
            toast(`Las fechas deben caer dentro de la temporada (${temporada.start_date} → ${temporada.end_date})`, 'error');
            return;
          }
          try {
            if (objetivo) {
              await actualizarObjetivo(objetivo.id, {
                titulo: m0.titulo.trim(),
                descripcion: m0.descripcion.trim() || null,
                categoria: m0.categoria,
                fecha_inicio: m0.fecha_inicio,
                fecha_fin: m0.fecha_fin,
              });
            } else {
              await crearObjetivo({ ...m0, season_id: seasonId });
            }
            md.cerrar();
            toast(objetivo ? 'Objetivo actualizado' : 'Objetivo creado');
            onGuardado?.();
          } catch (e) { toast('Error: ' + e.message, 'error'); }
        },
      }, objetivo ? 'Guardar' : 'Crear objetivo'),
    ],
  });
  pintaSugerencias();
  inTitulo.focus();
  return md;
}

/** Badge de categoría (texto, neutro — el color es identidad de equipo). */
export const badgeCategoria = (categoria) =>
  h('span', { class: 'eq-obj-badge' }, categoria);

/** Fila compacta de objetivo (panel de día y listados). */
export function filaObjetivo(o, { color = null, nombreEquipo = null, acciones = null } = {}) {
  return h('div', { class: 'eq-obj' + (o.estado !== 'activo' ? ` eq-obj-${o.estado}` : '') },
    h('div', { class: 'eq-obj-info' },
      h('span', { class: 'eq-obj-titulo' },
        color !== null ? puntoEquipo(color) : null,
        nombreEquipo ? h('span', { class: 'eq-obj-equipo' }, nombreEquipo + ' · ') : null,
        o.titulo,
        ' ', badgeCategoria(o.categoria),
        o.estado === 'conseguido' ? h('span', { class: 'eq-obj-badge eq-obj-badge-ok' }, '✓ conseguido') : null,
        o.estado === 'archivado' ? h('span', { class: 'eq-obj-badge' }, 'archivado') : null,
      ),
      h('span', { class: 'eq-obj-fechas' },
        o.fecha_inicio === o.fecha_fin ? o.fecha_inicio : `${o.fecha_inicio} → ${o.fecha_fin}`),
      o.descripcion ? h('span', { class: 'eq-obj-desc' }, o.descripcion) : null,
    ),
    acciones ? h('div', { class: 'eq-obj-acciones' }, acciones) : null,
  );
}
