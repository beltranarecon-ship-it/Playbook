/* ============================================================
   equipos-lista.js — /equipos · hub "mis equipos".
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { puntoEquipo } from '../ui/components.js';
import { getMisEquipos } from '../data/teams.js';
import { getState, setState } from '../store.js';
import { weekdayNombre } from '../config.js';

export function render(root) {
  const cont = h('div', { class: 'eq-page' });
  mount(root, cont);

  const pinta = (equipos) => {
    mount(cont,
      h('div', { class: 'view-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, 'Gestión'),
          h('h1', { class: 'display view-title' },
            h('span', { class: 'solid' }, 'Equipos'),
            h('span', { class: 'ghost' }, 'del club')),
          h('p', { class: 'view-meta' }, `${equipos.length} equipo${equipos.length === 1 ? '' : 's'}`),
        ),
        h('a', { class: 'btn btn-primary has-arrow', href: '/equipos/nuevo', 'data-link': true },
          'Nuevo equipo', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '↗')),
      ),
      equipos.length
        ? h('div', { class: 'eq-grid' }, equipos.map(tarjeta))
        : h('div', { class: 'empty-state' },
            h('p', { class: 'empty-state-display' }, 'Sin equipos'),
            h('p', {}, 'Aún no gestionas ningún equipo. Crea el tuyo o pide a un administrador que te asigne uno.'),
            h('a', { class: 'btn btn-primary', href: '/equipos/nuevo', 'data-link': true }, 'Crear mi primer equipo'),
          ),
    );
  };

  const tarjeta = (t) => h('a', {
    class: 'eq-card', href: `/equipos/${t.id}`, 'data-link': true,
    style: { '--team-color': t.color || 'var(--muted)' },
  },
    h('div', { class: 'eq-card-head' },
      puntoEquipo(t.color),
      h('h2', { class: 'eq-card-nombre' }, t.name),
    ),
    t.category ? h('span', { class: 'badge badge-type' }, t.category) : null,
    h('p', { class: 'eq-card-meta' },
      t.coaches.length ? t.coaches.join(' · ') : '—',
    ),
    t.dia_convocatoria
      ? h('p', { class: 'eq-card-meta' }, `Convocatoria: ${weekdayNombre(t.dia_convocatoria)}`)
      : null,
  );

  (async () => {
    try {
      const cache = getState().equipos;
      const equipos = cache ?? await getMisEquipos();
      if (!cache) setState({ equipos });
      pinta(equipos);
    } catch (e) {
      toast('No se pudieron cargar los equipos: ' + e.message, 'error');
      pinta([]);
    }
  })();

  return { destroy() {} };
}
