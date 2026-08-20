/* ============================================================
   convocatoria.js — /partidos/:matchId/convocatoria (Tramo 4.6).
   El documento que se cuelga en el grupo: rival, día, hora, dónde se
   queda y la lista.

   ── POR QUÉ UNA PÁGINA IMPRIMIBLE Y NO UN PDF COMPUESTO ─────
   §5.9 dice «plantilla PDF por equipo subida en ajustes; la app compone
   el documento». Rellenar una plantilla escaneada exige saber en qué
   coordenada exacta va cada campo de ESE papel, y eso hay que calibrarlo
   con el fichero del club delante, uno por club y cada vez que la
   federación cambia el formato. Componer aquí la página y dejar que el
   navegador la imprima a PDF —«Guardar como PDF», que está en el móvil
   y en el ordenador— da el mismo documento, sale hoy y no depende de
   ninguna librería (§9: sin proceso de compilación).

   La plantilla que suba el club se guarda igual y se ofrece al lado,
   para quien tenga que entregar ese papel concreto en la mesa.

   ── LO QUE SE IMPRIME ES LO QUE SE VE ───────────────────────
   Sin cabecera de la app, sin botones, sin colores de fondo: una hoja.
   Todo lo que no es el documento lleva `no-imprimir`.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { getPartido } from '../data/matches.js';
import { getMisEquipos } from '../data/teams.js';
import { getJugadores } from '../data/players.js';
import { urlImagenEquipo } from '../data/equipo-archivos.js';
import { datosDelDocumento, titular, loQueFalta } from '../data/convocatoria.js';
import { router } from '../main.js';

export function render(root, params) {
  const cont = h('div', { class: 'eq-conv-hoja' });
  mount(root, cont);

  (async () => {
    let p, equipo, jugadores = [], escudo = null;
    try {
      p = await getPartido(params.matchId);
      const equipos = await getMisEquipos();
      equipo = equipos.find((t) => t.id === p.team_id) || null;
      jugadores = await getJugadores(p.team_id, { incluirBajas: true });
      /* Con bajas incluidas a propósito: si un crío se dio de baja
         DESPUÉS de convocarlo, el documento tiene que seguir diciendo
         su nombre. Quitarlo de la lista sin decir nada sería peor. */
      if (equipo?.imagen_path) escudo = await urlImagenEquipo(equipo.imagen_path).catch(() => null);
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir la convocatoria'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary no-imprimir', href: '/sesiones', 'data-link': true }, 'Volver')));
      return;
    }

    const d = datosDelDocumento(p, jugadores, {
      nombreEquipo: equipo?.name || '', escudo,
    });
    const falta = loQueFalta(p);

    mount(cont,
      h('div', { class: 'eq-conv-barra no-imprimir' },
        h('a', {
          class: 'eq-volver', href: `/partidos/${p.id}`,
          onClick: (e) => { e.preventDefault(); router.navigate(`/partidos/${p.id}`); },
        }, '‹ Volver al partido'),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onClick: () => window.print(),
        }, 'Imprimir o guardar en PDF'),
      ),
      falta.length
        ? h('p', { class: 'eq-acta-descuadre no-imprimir' },
            `Ojo, falta por poner: ${falta.join(', ')}.`)
        : null,

      h('article', { class: 'eq-conv' },
        h('header', { class: 'eq-conv-cab' },
          escudo ? h('img', { class: 'eq-conv-escudo', src: escudo, alt: '' }) : null,
          h('div', {},
            h('h1', { class: 'eq-conv-tit' }, 'Convocatoria'),
            h('p', { class: 'eq-conv-equipo' }, d.equipo),
          ),
        ),
        h('p', { class: 'eq-conv-titular' }, titular(d)),
        h('dl', { class: 'eq-conv-datos' },
          h('div', {}, h('dt', {}, 'Partido'), h('dd', {}, `${d.donde === 'en casa' ? 'En casa contra' : 'Fuera, contra'} ${d.rival || '—'}`)),
          h('div', {}, h('dt', {}, 'Día'), h('dd', {}, d.fecha || '—')),
          h('div', {}, h('dt', {}, 'Hora del partido'), h('dd', {}, d.hora || '—')),
          h('div', {}, h('dt', {}, 'Dónde se juega'), h('dd', {}, d.lugarPartido || '—')),
          h('div', { class: 'eq-conv-quedada' },
            h('dt', {}, 'Quedamos'),
            h('dd', {}, [d.quedada.hora, d.quedada.lugar].filter(Boolean).join(' · ') || '—')),
        ),
        h('h2', { class: 'eq-conv-sub' },
          `Convocados (${d.convocados.length})`),
        d.convocados.length
          ? h('ol', { class: 'eq-conv-lista' },
              ...d.convocados.map((j) => h('li', {},
                h('span', { class: 'eq-conv-dorsal' }, j.dorsal != null ? String(j.dorsal) : '—'),
                h('span', {}, j.nombre),
              )),
            )
          : h('p', { class: 'eq-ayuda' }, 'Todavía no hay nadie convocado.'),
        d.faltan
          ? h('p', { class: 'eq-ayuda' },
              `${d.faltan} convocado(s) ya no están en la plantilla y no salen en la lista.`)
          : null,
        h('footer', { class: 'eq-conv-pie' },
          h('p', {}, 'Puntualidad, ropa de juego y agua. Si alguien no puede venir, avisad cuanto antes.'),
        ),
      ),
    );
  })();

  return { destroy() {} };
}
