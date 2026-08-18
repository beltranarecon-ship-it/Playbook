/* ============================================================
   wizard.js — los CUATRO PASOS, para crear y para corregir.
   Orquesta los 4 pasos sobre un Stage persistente, autoguarda el
   borrador en localStorage, ofrece recuperarlo, y guarda en Supabase.

   ── TRES MANERAS DE ENTRAR (Tramo 2.13) ─────────────────────
     nuevo      un ejercicio en blanco
     editar     uno guardado, con TODO cargado — abre por el paso 0
     duplicar   uno guardado como base, con nombre de variante y sin
                id, así que guardar crea otro en vez de pisar el suyo

   Antes, editar abría un editor a pantalla completa aparte que solo
   sabía retocar flechas: para cambiar el nombre o media ficha había
   que ir a otro sitio, y el paso 2 —el que sabe describir la jugada—
   no estaba. Un solo camino para las tres cosas (§6): lo que se
   aprende creando vale corrigiendo.
   ============================================================ */

import { h, mount, icon } from '../ui/dom.js';
import { header, savebar, stepNav } from '../ui/chrome.js';
import { Stage } from '../canvas/stage.js';
import { toast, confirmToast } from '../ui/toast.js';
import { nuevoDraft, puedeGuardar } from '../wizard/draft.js';
import { borradorDeEjercicio, nombreRepetido } from '../wizard/cargar.js';
import { guardarBorrador, leerBorrador, borrarBorrador, borradorConContenido, fechaBorrador } from '../wizard/borrador.js';
import { getUser } from '../supabase/auth.js';
import { guardarEjercicio, actualizarEjercicio, getEjercicio, nombresDeEjercicios } from '../supabase/ejercicios.js';
import { paso0 } from '../wizard/paso0.js';
import { paso1 } from '../wizard/paso1.js';
import { paso2 } from '../wizard/paso2.js';
import { paso3 } from '../wizard/paso3.js';

const STEPS = [
  { n: 0, label: 'Identificación' },
  { n: 1, label: 'Elementos' },
  { n: 2, label: 'Acciones' },
  { n: 3, label: 'Metadatos' },
];
const STEP_FNS = [paso0, paso1, paso2, paso3];

export function render(root, { id = null, modo = 'nuevo' } = {}) {
  const draft = nuevoDraft();
  const stage = new Stage({ pista: draft.tipo_pista });

  const state = { step: 0 };
  let current = null;
  // nombres del resto de ejercicios: para el nombre de la variante y
  // para no dejar dos iguales (§6). Sin red se queda vacío y no bloquea.
  let otros = [];

  const navHost = h('div');
  const stepHost = h('div', { class: 'wizard-step' });
  const footHost = h('div');

  // ---- autoguardado de borrador (§13) ----
  let saveTimer = null;
  const scheduleSave = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => guardarBorrador(draft, stage.board.getElementos(), state.step), 600); };

  const onDraftChange = () => { if (btnGuardar) btnGuardar.disabled = !puedeGuardar(draft); scheduleSave(); };
  const ctx = { draft, stage, onDraftChange, goTo, toast };
  stage.board.on('change', scheduleSave);

  function paint() {
    // cada paso puede tener que soltar lo suyo al salir (el paso 2
    // deja la pista en modo «señalar» y con un temporizador vivo)
    current?.destroy?.();
    current = STEP_FNS[state.step](ctx);
    mount(navHost, stepNav(STEPS, state.step, { onJump: goTo }));
    mount(stepHost, current.el);
    mount(footHost, footer());
    onDraftChange();
  }

  function goTo(target) {
    if (target === state.step) return;
    if (state.step === 0 && target > 0 && current?.validate && !current.validate()) {
      toast('Completa el nombre, el tipo y la pista para continuar.', { type: 'warn' });
      return;
    }
    state.step = Math.max(0, Math.min(STEPS.length - 1, target));
    paint();
    window.scrollTo(0, 0);
  }

  function footer() {
    return h('div', { class: 'wizard-foot' },
      state.step > 0 ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => goTo(state.step - 1) }, '← Atrás') : h('span'),
      state.step < STEPS.length - 1 ? h('button', { class: 'btn btn--secondary has-arrow', type: 'button', onClick: () => goTo(state.step + 1) }, 'Siguiente ', icon('M9 18l6-6-6-6', { size: 16 })) : null,
    );
  }

  function aplicarBorrador(b) {
    Object.assign(draft, b.draft);
    stage.setPista(draft.tipo_pista);
    stage.board.setElementos(b.elementos || []);
    state.step = b.step || 0;
    paint();
    if (draft.animacion) stage.showAnimation(draft.animacion);
    toast('Borrador recuperado.', { type: 'ok' });
  }

  async function guardar() {
    if (!puedeGuardar(draft)) { toast('Faltan el nombre y el tipo del ejercicio.', { type: 'warn' }); goTo(0); return; }
    /* Dos ejercicios con el mismo nombre son dos ejercicios que nadie
       distingue en la lista del planificador (§6). Se comprueba contra
       los demás, nunca contra uno mismo: guardar sin cambiar el nombre
       tiene que seguir funcionando. */
    if (nombreRepetido(draft.nombre, otros, draft.id)) {
      toast(`Ya hay un ejercicio llamado «${draft.nombre.trim()}». Cámbiale el nombre.`, { type: 'warn', timeout: 6000 });
      goTo(0);
      return;
    }
    if (!draft.animacion) {
      const ok = await confirmToast('Estás guardando sin animación. ¿Continuar?');
      if (!ok) return;
    }
    const prev = btnGuardar.textContent;
    btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…';
    try {
      const user = await getUser();
      if (!user) { toast('Inicia sesión en Playbook CBP para guardar en la nube.', { type: 'warn', timeout: 5000 }); return; }
      // con id, se corrige el que ya existe; sin él, se crea uno nuevo
      const { id: guardadoId } = draft.id
        ? await actualizarEjercicio(draft.id, draft, stage.board.getElementos())
        : await guardarEjercicio(draft, stage.board.getElementos());
      borrarBorrador();
      toast(draft.id ? 'Cambios guardados.' : 'Ejercicio guardado.', { type: 'ok' });
      history.pushState({}, '', `/ejercicios/${guardadoId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      const msg = e.message === 'SIN_SESION' ? 'Inicia sesión para guardar.' : (e.message || 'Error desconocido');
      toast('No se pudo guardar: ' + msg, { type: 'error', timeout: 6000 });
    } finally {
      btnGuardar.disabled = false; btnGuardar.textContent = prev;
    }
  }

  /* El título dice en qué se está: crear, corregir o hacer una
     variante. Se guarda el nodo porque la carga llega después. */
  const TITULOS = { nuevo: 'Nuevo ejercicio', editar: 'Editar ejercicio', duplicar: 'Variante de un ejercicio' };
  const cabecera = header({ title: TITULOS[modo] || TITULOS.nuevo, backHref: '/app.html' });
  const titulo = cabecera.querySelector('.header-title') || h('span');

  const bar = savebar({
    onSave: guardar,
    saveLabel: modo === 'editar' ? 'Guardar cambios' : 'Guardar',
    hint: modo === 'editar'
      ? 'Los cambios sustituyen al ejercicio; el original no se conserva.'
      : 'Tu progreso se autoguarda como borrador.',
  });
  const btnGuardar = bar.querySelector('#btn-guardar');

  const view = h('div', { class: 'taller taller--wizard' },
    cabecera,
    h('div', { class: 'taller-body' },
      h('div', { class: 'wizard-grid' },
        h('section', { class: 'wizard-form' }, navHost, stepHost, footHost),
        h('aside', { class: 'canvas-col' }, stage.el),
      ),
    ),
    bar,
  );

  paint();
  root.append(view);

  /* ---- entrar con un ejercicio cargado (Tramo 2.13) --------------
     Se hace en segundo plano y se repinta al llegar: el asistente ya
     está en pantalla, así que abrir para editar no deja al entrenador
     mirando un hueco en blanco mientras viaja la consulta. */
  const cargando = (id && modo !== 'nuevo') ? (async () => {
    try {
      const fila = await getEjercicio(id);
      otros = await nombresDeEjercicios().catch(() => []);
      const { draft: cargado, elementos } = borradorDeEjercicio(fila, {
        duplicar: modo === 'duplicar',
        nombres: otros.map((o) => o.name),
      });
      Object.assign(draft, cargado);
      stage.setPista(draft.tipo_pista);
      stage.board.setElementos(elementos);
      paint();
      if (draft.animacion) stage.showPreview(draft.animacion);
      titulo.textContent = modo === 'duplicar' ? 'Variante de un ejercicio' : 'Editar ejercicio';
      toast(modo === 'duplicar'
        ? `Variante de «${fila.name}». Cambia lo que quieras: se guardará como un ejercicio nuevo.`
        : 'Ejercicio cargado en los cuatro pasos.', { type: 'ok', timeout: 5000 });
    } catch (e) {
      toast('No se pudo cargar el ejercicio: ' + (e.message || 'error'), { type: 'error', timeout: 6000 });
    }
  })() : (async () => { otros = await nombresDeEjercicios().catch(() => []); })();

  /* El borrador sin guardar solo se ofrece al crear: al abrir un
     ejercicio existente, lo que hay que cargar es ESE ejercicio, y
     preguntar por un borrador de otra cosa a media pantalla es la
     manera más rápida de perder lo que se acaba de abrir. */
  if (modo === 'nuevo') {
    const b = leerBorrador();
    if (borradorConContenido(b)) {
      toast(`Tienes un borrador sin guardar del ${fechaBorrador(b)}. ¿Retomar?`, {
        type: 'info', timeout: 0,
        actions: [
          { label: 'Retomar', onClick: () => aplicarBorrador(b) },
          { label: 'Descartar', onClick: () => borrarBorrador() },
        ],
      });
    }
  }

  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') { window.__stage = stage; window.__draft = draft; window.__wizard = { guardar, aplicarBorrador }; }
  return { destroy() { clearTimeout(saveTimer); current?.destroy?.(); stage.destroy(); view.remove(); } };
}
