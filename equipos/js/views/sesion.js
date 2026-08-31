/* ============================================================
   sesion.js — /sesiones/:sessionId · LA pantalla de una sesión.

   Antes eran dos: el plan en /sesiones/:id y el cierre en
   /sesiones/:id/cierre. Estando separadas, el cierre tenía que
   llevar una copia resumida del plan («Lo que estaba planificado»)
   y un botón para ir a verlo — una copia que solo podía quedarse
   desfasada, y un viaje de ida y vuelta cada vez que había que
   mirar qué tocaba.

   Ahora son dos PESTAÑAS de la misma pantalla, con una sola
   cabecera, un solo botón de guardar y un solo aviso de cambios sin
   guardar.

   ── CUÁNDO APARECE EL CIERRE ────────────────────────────────
   Cuando la sesión ya pasó, DEDUCIDO DEL RELOJ (`yaPaso`), igual
   que el estado «activa» y por la misma razón (decisión #17): si
   `realizada` se escribiera sola al pasar la hora, las sesiones que
   nunca ocurrieron quedarían marcadas como hechas para siempre. La
   columna solo cambia cuando el entrenador cierra.

   También aparece si se ha entrado pidiéndola por la URL: el aviso
   push, el calendario y el cronómetro llevan ahí, y entrar por uno
   de esos tres ya es decir que el entrenamiento se ha acabado.

   ── EL PLAN, DESPUÉS ────────────────────────────────────────
   Se ve entero pero en solo lectura: es el histórico de lo que se
   iba a hacer. La reflexión y la rúbrica SÍ se editan siempre —son
   justamente lo que se escribe después—. Y el candado del plan se
   puede quitar a mano desde su pestaña.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { puntoEquipo } from '../ui/components.js';
import { getSesion } from '../data/sessions.js';
import { getMisEquipos } from '../data/teams.js';
import { yaPaso, estadoEfectivo, ACTIVA } from '../data/estado-sesion.js';
import { ESTADOS_SESION, WEEKDAYS } from '../config.js';
import * as planner from './sesion-planner.js';
import * as cierre from './sesion-cierre.js';
import { router } from '../main.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const isoWeekday = (iso) => { const d = new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay(); return d === 0 ? 7 : d; };
const hhmm = (t) => (t ? t.slice(0, 5) : '');

/** Etiqueta del estado, contando el deducido del reloj. */
const etiquetaEstado = (s) => {
  const e = estadoEfectivo(s);
  return e === ACTIVA ? 'En pista' : (ESTADOS_SESION[e] || e);
};

export function render(root, params) {
  const sessionId = params.sessionId;
  /* Se ha entrado pidiendo el cierre (el aviso push, el calendario o
     el cronómetro al terminar). Eso ABRE la pestaña aunque el reloj
     todavía no la diera por pasada: quien viene de ahí ya ha acabado. */
  const pedidoCierre = params.tab === 'cierre';

  const cont = h('div', { class: 'eq-page eq-sesion' });
  mount(root, cont);

  let sesion = null, color = 'var(--muted)', nombreEquipo = '—';
  let pestana = pedidoCierre ? 'cierre' : 'plan';
  let hayCierre = false;
  let guardando = false;

  let plan = null;     // handle del planificador
  let cier = null;     // handle del cierre (se crea al abrir la pestaña)

  const nodoCabecera = h('div', { class: 'eq-ses-cabecera' });
  const nodoTabs = h('nav', { class: 'eq-tabs', 'aria-label': 'Partes de la sesión' });
  const panelPlan = h('div', { class: 'eq-ses-panel' });
  const panelCierre = h('div', { class: 'eq-ses-panel', hidden: true });
  const nodoBarra = h('div', { class: 'eq-planner-barra eq-ses-barra' });

  // ── El guardián, uno solo para las dos pestañas ────────────
  const hayCambios = () => !!(plan?.estaSucio?.() || cier?.estaSucio?.());
  const onBeforeUnload = (e) => { if (hayCambios()) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  /* Lo usan las dos pestañas (se les pasa como `opts.salir`): un solo
     aviso por salida, mire quien mire. */
  const salir = (destino) => {
    if (hayCambios() && !confirm('Tienes cambios sin guardar. ¿Salir y descartarlos?')) return false;
    router.navigate(destino);
    return true;
  };

  // ── Pestañas ───────────────────────────────────────────────
  /**
   * Cambia de pestaña SIN pasar por el router: navegar volvería a
   * montar la pantalla entera —el planificador con su visor, la
   * biblioteca, la rúbrica— y se perdería lo escrito a medias. La URL
   * se corrige a mano para que recargar caiga donde estabas.
   */
  function verPestana(cual) {
    if (cual === 'cierre' && !hayCierre) return;
    pestana = cual;
    if (cual === 'cierre' && !cier) creaCierre();
    panelPlan.hidden = cual !== 'plan';
    panelCierre.hidden = cual !== 'cierre';
    const url = cual === 'cierre' ? `/sesiones/${sessionId}/cierre` : `/sesiones/${sessionId}`;
    if (location.pathname !== url) history.replaceState({}, '', url);
    pintaTabs();
    pintaBarra();
    window.scrollTo(0, 0);
  }

  function pintaTabs() {
    const boton = (clave, texto) => h('button', {
      class: 'eq-tab-btn' + (pestana === clave ? ' active' : ''),
      type: 'button',
      'aria-current': pestana === clave ? 'page' : null,
      onClick: () => verPestana(clave),
    }, texto);
    mount(nodoTabs,
      boton('plan', 'Plan'),
      hayCierre ? boton('cierre', 'Cierre') : null);
  }

  // ── Cabecera común ─────────────────────────────────────────
  function pintaCabecera() {
    const [, m, d] = sesion.fecha.split('-').map(Number);
    const fechaTxt = `${WEEKDAYS[isoWeekday(sesion.fecha) - 1].nombre} ${d} de ${MESES[m - 1]}`;
    const horaTxt = [hhmm(sesion.hora_inicio) && `${hhmm(sesion.hora_inicio)}–${hhmm(sesion.hora_fin)}`, sesion.lugar]
      .filter(Boolean).join(' · ');
    mount(nodoCabecera,
      h('div', { class: 'eq-planner-top' },
        h('a', {
          class: 'eq-volver', href: `/sesiones?equipo=${sesion.team_id}`,
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); salir(`/sesiones?equipo=${sesion.team_id}`); },
        }, '‹ Calendario'),
        h('div', { class: 'eq-planner-top-der' },
          plan?.nodoEstado || null,
          h('span', { class: `eq-estado-badge eq-ses-${estadoEfectivo(sesion)}` }, etiquetaEstado(sesion)),
        ),
      ),
      h('div', { class: 'view-hero eq-planner-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, puntoEquipo(color), ' ', nombreEquipo),
          h('h1', { class: 'display view-title' }, fechaTxt),
          horaTxt ? h('p', { class: 'view-meta' }, horaTxt) : null,
          sesion.titulo ? h('p', { class: 'view-meta' }, sesion.titulo) : null,
        ),
      ),
    );
  }

  // ── La barra: lo de la pestaña + UN botón de guardar ───────
  function pintaBarra() {
    const activo = pestana === 'cierre' ? cier : plan;
    const acciones = activo?.accionesBarra?.() || [];
    /* El plan en solo lectura no tiene nada que guardar; el cierre sí,
       siempre (salvo cancelada, que ya devuelve su aviso y ningún
       botón). Sin nada guardable, el botón no sale: uno que no hace
       nada es peor que ninguno. */
    const guardable = (plan && !plan.esSoloLectura?.()) || (pestana === 'cierre' && cier);
    mount(nodoBarra,
      ...acciones,
      guardable ? h('button', {
        class: 'btn btn-primary eq-planner-guardar', type: 'button',
        disabled: guardando || null,
        onClick: guardarTodo,
      }, guardando ? 'Guardando…' : 'Guardar') : null,
    );
  }

  /**
   * El botón único. Guarda LAS DOS pestañas, no solo la que se ve: se
   * pasa lista, se salta al plan a mirar un bloque y se guarda desde
   * ahí, y lo de la lista no puede quedarse por el camino.
   *
   * Cerrar la sesión —marcarla realizada— sigue siendo su propio botón
   * en la pestaña de cierre: exige decir cómo han trabajado (decisión
   * #20) y no es lo mismo que guardar a medias.
   */
  async function guardarTodo() {
    if (guardando) return;
    guardando = true; pintaBarra();
    try {
      const tareas = [];
      if (plan && !plan.esSoloLectura?.()) tareas.push(plan.guardar());
      if (cier) tareas.push(cier.guardar());
      if (!tareas.length) return;
      const res = await Promise.all(tareas);
      // cada pestaña ya ha dicho lo suyo si ha fallado; aquí solo el ok
      if (res.every((x) => x !== false)) toast('Guardado');
    } finally {
      guardando = false;
      pintaBarra();
      pintaCabecera();
    }
  }

  // ── Montaje de las pestañas ────────────────────────────────
  const enlaces = {
    incrustado: true,
    sesion: null,          // se rellena tras cargar
    salir,
    alCambiar: () => pintaBarra(),
    alCambiarModo: () => { pintaBarra(); pintaCabecera(); },
  };

  function creaCierre() {
    cier = cierre.render(panelCierre, { sessionId }, { ...enlaces });
  }

  // ── Carga ──────────────────────────────────────────────────
  (async () => {
    try {
      sesion = await getSesion(sessionId);
      enlaces.sesion = sesion;
      hayCierre = yaPaso(sesion) || pedidoCierre;
      if (!hayCierre && pestana === 'cierre') pestana = 'plan';

      const equipos = await getMisEquipos().catch(() => []);
      const eq = equipos.find((t) => t.id === sesion.team_id);
      color = eq?.color || 'var(--muted)';
      nombreEquipo = eq?.name || '—';

      mount(cont, nodoCabecera, nodoTabs, panelPlan, panelCierre, nodoBarra);
      pintaCabecera();
      pintaTabs();

      plan = planner.render(panelPlan, { sessionId }, {
        ...enlaces,
        irACierre: () => verPestana('cierre'),
        alCargar: () => { pintaCabecera(); pintaBarra(); },
      });

      if (pestana === 'cierre') verPestana('cierre');
      else { panelCierre.hidden = true; pintaBarra(); }
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir la sesión'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/sesiones', 'data-link': true }, 'Volver al calendario')));
    }
  })();

  return {
    destroy() {
      window.removeEventListener('beforeunload', onBeforeUnload);
      plan?.destroy?.();
      cier?.destroy?.();
    },
  };
}
