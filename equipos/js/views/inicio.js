/* ============================================================
   inicio.js — /inicio · la pantalla de abrir la app (Tramo 4.11).

   §5.11: «lo de hoy arriba del todo, sin programar de la semana que
   viene, programados de la semana que viene, realizados de la semana
   pasada, y partidos y convocatorias». Literalmente eso y en ese orden.
   El reparto lo hace `data/inicio.js`, que es puro y tiene su banco;
   aquí solo se pinta.

   ── LO PRIMERO ES LO QUE HAY QUE HACER ──────────────────────
   Y por eso las secciones vacías se quedan, apagadas, en vez de
   desaparecer: una pantalla que cambia de forma cada día no se aprende
   nunca, y el entrenador acaba leyéndola entera todas las veces.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { puntoEquipo } from '../ui/components.js';
import { getMisEquipos } from '../data/teams.js';
import { getTemporadaActiva, getSesionesRango } from '../data/sessions.js';
import { getPartidosRango } from '../data/matches.js';
import { eventoDe as eventoConvocatoria, rutaConvocatoria } from '../data/convocatoria.js';
import { secciones, semanas, iso as isoDe } from '../data/inicio.js';
import { sinLeer, marcarLeido } from '../data/push.js';
import { router } from '../main.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

function fechaCorta(f) {
  const d = new Date(`${f}T12:00:00`);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  return `${DIAS[dow - 1].slice(0, 3)} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function render(root) {
  const cont = h('div', { class: 'eq-page eq-inicio' });
  mount(root, cont);

  (async () => {
    const hoy = isoDe(new Date());
    const s = semanas(hoy);
    let equipos = [], temporada = null, sesiones = [], partidos = [], avisos = [];

    try {
      [equipos, temporada] = await Promise.all([getMisEquipos(), getTemporadaActiva()]);
      const desde = s.pasada.desde, hasta = s.proxima.hasta;
      [sesiones, partidos, avisos] = await Promise.all([
        getSesionesRango({ desde, hasta }).catch(() => []),
        getPartidosRango({ desde, hasta }).catch(() => []),
        sinLeer({ limite: 10 }).catch(() => []),
      ]);
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir el inicio'),
        h('p', {}, e.message)));
      return;
    }

    const color = new Map(equipos.map((t) => [t.id, t.color]));
    const nombre = new Map(equipos.map((t) => [t.id, t.name]));
    const diaConv = new Map(equipos.map((t) => [t.id, t.dia_convocatoria]));

    const convocatorias = partidos
      .map((m) => eventoConvocatoria(m, { diaSemana: diaConv.get(m.team_id) }))
      .filter(Boolean);

    const secs = secciones({ hoy, sesiones, partidos, convocatorias });

    /* Una fila por cosa. Las tres clases de cosa se leen igual —fecha,
       equipo, qué es— y se distinguen por la marca de la izquierda, que
       es la misma del calendario (4.12). */
    const fila = (x) => {
      /* Si no viene dicho QUÉ es, no se adivina. Lo de adivinar acabó
         mandando entrenamientos a /partidos/<id-de-sesión>: un enlace
         roto que además pintaba «@ undefined». Más vale una fila que no
         lleva a ningún sitio y lo dice. */
      if (!['sesion', 'partido', 'convocatoria'].includes(x.que)) {
        console.warn('[inicio] cosa sin tipo, no se enlaza:', x);
        return h('div', { class: 'eq-ini-fila' },
          h('span', { class: 'eq-ini-cuando' }, fechaCorta(x.fecha)),
          h('span', { class: 'eq-ini-que' }, x.titulo || 'Sin identificar'));
      }
      const esConv = x.que === 'convocatoria';
      const m = esConv ? x.partido : x;
      const teamId = m.team_id;
      /* La convocatoria lleva a la convocatoria, no al partido: quien
         la toca viene a rellenarla, no a ver el marcador. */
      const destino = x.que === 'sesion' ? `/sesiones/${x.id}`
        : (esConv ? rutaConvocatoria(m.id) : `/partidos/${m.id}`);
      const que = x.que === 'sesion'
        ? (x.titulo || 'Entrenamiento')
        : (esConv ? `Convocatoria · ${m.es_local ? 'vs' : '@'} ${m.rival}` : `${m.es_local ? 'vs' : '@'} ${m.rival}`);
      const cuando = [fechaCorta(x.fecha), hhmm(x.hora_inicio || x.hora)].filter(Boolean).join(' · ');
      const pendiente = x.que === 'sesion'
        ? (x.estado === 'preliminar' ? 'sin plan' : (x.estado === 'realizada' && !x.evaluada_at ? 'sin cerrar' : null))
        : (esConv && !x.cuantos ? 'sin rellenar' : null);

      return h('a', {
        class: 'eq-ini-fila' + (esConv ? ' es-convo' : '') + (x.que === 'partido' ? ' es-partido' : ''),
        href: destino, 'data-link': true,
        style: { '--team-color': color.get(teamId) || 'var(--muted)' },
        onClick: (e) => { e.preventDefault(); router.navigate(destino); },
      },
        h('span', { class: 'eq-ini-cuando' }, cuando),
        h('span', { class: 'eq-ini-que' }, que),
        h('span', { class: 'eq-ini-equipo' }, puntoEquipo(color.get(teamId)), ' ', nombre.get(teamId) || ''),
        pendiente ? h('span', { class: 'eq-ini-pendiente' }, pendiente) : null,
      );
    };

    const seccion = (sec) => h('section', { class: 'eq-ini-sec' + (sec.cosas.length ? '' : ' vacia') },
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, sec.titulo),
        sec.cosas.length ? h('span', { class: 'eq-ayuda' }, String(sec.cosas.length)) : null,
      ),
      sec.ayuda && sec.cosas.length ? h('p', { class: 'eq-ayuda' }, sec.ayuda) : null,
      sec.cosas.length
        ? h('div', { class: 'eq-ini-lista' }, ...sec.cosas.map(fila))
        : h('p', { class: 'eq-ayuda' }, 'Nada.'),
    );

    mount(cont,
      h('div', { class: 'view-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, temporada ? `Temporada ${temporada.label}` : 'Playbook CBP'),
          h('h1', { class: 'display view-title' }, fechaCorta(hoy)),
          h('p', { class: 'view-meta' },
            equipos.length
              ? `${equipos.length} equipo${equipos.length === 1 ? '' : 's'}`
              : 'Todavía no tienes ningún equipo'),
        ),
      ),

      /* La bandeja va arriba y solo si hay algo. Es lo que hace que los
         avisos existan en un iPhone sin la app instalada, donde el push
         no llega nunca (§5.8). */
      avisos.length
        ? h('section', { class: 'eq-ini-avisos' },
            h('div', { class: 'eq-zona-head' },
              h('h2', { class: 'eq-zona-titulo' }, `Avisos (${avisos.length})`),
              h('button', {
                class: 'btn btn-secondary eq-btn-mini', type: 'button',
                onClick: async (e) => {
                  await marcarLeido(avisos.map((a) => a.id)).catch(() => {});
                  e.target.closest('.eq-ini-avisos').remove();
                },
              }, 'Marcar leídos'),
            ),
            ...avisos.map((a) => h('a', {
              class: 'eq-ini-aviso', href: a.url || '/inicio', 'data-link': true,
              onClick: async (e) => {
                e.preventDefault();
                await marcarLeido(a.id).catch(() => {});
                router.navigate(a.url || '/inicio');
              },
            },
              h('b', {}, a.titulo),
              a.cuerpo ? h('span', {}, a.cuerpo) : null,
            )),
          )
        : null,

      ...secs.map(seccion),
    );
  })();

  return { destroy() {} };
}
