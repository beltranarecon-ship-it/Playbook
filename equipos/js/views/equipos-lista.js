/* ============================================================
   equipos-lista.js — /equipos · hub "mis equipos".
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { puntoEquipo } from '../ui/components.js';
import { getMisEquipos } from '../data/teams.js';
import { urlImagenEquipo } from '../data/equipo-archivos.js';
import { getState, setState } from '../store.js';
import { weekdayNombre } from '../config.js';

/**
 * «Equipos de Beltrán», con el nombre de quien ha entrado.
 *
 * Cae a «del club» si todavía no ha puesto su nombre: `full_name` es
 * NULLABLE y una cuenta recién invitada lo tiene vacío. «Equipos de »
 * a secas se lee como un error de la app.
 */
const tituloDe = (perfil) => {
  const n = (perfil?.full_name || '').trim();
  return n ? `de ${n}` : 'del club';
};

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
            h('span', { class: 'ghost' }, tituloDe(getState().perfil))),
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

  const tarjeta = (t) => {
    /* La banda de imagen se pinta VACÍA y la foto entra cuando llega su
       URL firmada. El bucket es privado, así que cada imagen es una
       petición: esperarlas todas dejaría la pantalla más visitada en
       blanco un segundo cada vez que se abre. Mismo criterio que el
       calendario, que también sustituye el hueco cuando puede. */
    const banda = t.imagen_path ? h('div', { class: 'eq-card-banda' }) : null;
    if (banda) {
      urlImagenEquipo(t.imagen_path)
        .then((url) => {
          if (!url) return;
          banda.append(h('img', {
            class: 'eq-card-img', src: url, alt: '', loading: 'lazy',
            // si la firma caduca o el fichero ya no está, se queda la banda lisa
            onError: (e) => e.target.remove(),
          }));
        })
        .catch(() => { /* sin imagen, la banda se queda del color del equipo */ });
    }

    return h('a', {
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
      banda,
    );
  };

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
