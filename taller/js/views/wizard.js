/* ============================================================
   wizard.js — los TRES PASOS, para crear y para corregir:
   Identificación · Pizarra · Metadatos. Autoguarda el borrador en
   localStorage, ofrece recuperarlo, y guarda en Supabase.

   ── TRES MANERAS DE ENTRAR (Tramo 2.13) ─────────────────────
     nuevo      un ejercicio en blanco
     editar     uno guardado, con TODO cargado — abre por el paso 0
     duplicar   uno guardado como base, con nombre de variante y sin
                id, así que guardar crea otro en vez de pisar el suyo

   Un solo camino para las tres cosas (§6): lo que se aprende creando
   vale corrigiendo.

   ── LA PIZARRA SUSTITUYE A LOS PASOS 1 Y 2 (ESPEC-PIZARRA-v3 §0) ──
   Colocar y animar son el mismo sitio. El paso de la Pizarra ocupa
   toda la anchura, y la Pizarra vive mientras vive el asistente: ir a
   los metadatos y volver no pierde nada de lo dibujado.

   Lo dibujado se vuelca al borrador al SALIR de la Pizarra y al
   guardar: la jugada (§11.1), para reabrirla, y la animación compilada
   desde ella, que es lo que leen el proyector, las miniaturas y Equipos.

   ── LO GUARDADO ANTES DE LA PIZARRA (§11.4) ─────────────────
   Un ejercicio de antes se abre en la Pizarra con sus posiciones
   iniciales, para rehacerlo. Si se guarda SIN haber tocado la pizarra
   —solo para corregir la ficha—, su animación se queda como estaba:
   compilar encima unas posiciones quietas la borraría para siempre, y
   nadie lo ha pedido.
   ============================================================ */

import { h, mount, icon } from '../ui/dom.js';
import { header, savebar, stepNav } from '../ui/chrome.js';
import { Stage } from '../canvas/stage.js';
import { toast, confirmToast } from '../ui/toast.js';
import { nuevoDraft, puedeGuardar } from '../wizard/draft.js';
import { borradorDeEjercicio, nombreRepetido } from '../wizard/cargar.js';
import { guardarBorrador, leerBorrador, borrarBorrador, borradorConContenido, fechaBorrador } from '../wizard/borrador.js';
import { estaViejo } from '../borradores.js';
import { getUser, nombreDelEntrenador } from '../supabase/auth.js';
import { guardarEjercicio, actualizarEjercicio, getEjercicio, nombresDeEjercicios } from '../supabase/ejercicios.js';
import { Pizarra } from '../pizarra/pizarra.js';
import { compilar, esDeLaPizarra } from '../pizarra/motor/compilar.js';
import { jugadaDesdeAnimacion } from '../pizarra/motor/jugada.js';
import { recuento } from '../pizarra/elementos.js';
import { paso0 } from '../wizard/paso0.js';
import { paso3 } from '../wizard/paso3.js';

const STEPS = [
  { n: 0, label: 'Identificación' },
  { n: 1, label: 'Pizarra' },
  { n: 2, label: 'Metadatos' },
];
const PASO_PIZARRA = 1;

/* Los borradores de antes de la Pizarra contaban cuatro pasos: el 1
   (colocar) y el 2 (describir) son hoy la Pizarra, y el 3 los
   metadatos. Se reconocen porque su borrador no tiene `jugada`. */
function pasoDelBorrador(b) {
  const paso = b.draft && 'jugada' in b.draft ? b.step : ({ 0: 0, 1: 1, 2: 1, 3: 2 })[b.step];
  return Math.max(0, Math.min(STEPS.length - 1, Number(paso) || 0));
}

export function render(root, { id = null, modo = 'nuevo', paso = 0 } = {}) {
  const draft = nuevoDraft();
  /* La columna de la derecha, fuera de la Pizarra: enseña lo dibujado
     mientras se rellena la ficha. */
  const stage = new Stage({ pista: draft.tipo_pista });

  // «Rehacer la pizarra» entra directamente por la Pizarra (§11.4)
  const state = { step: Math.max(0, Math.min(STEPS.length - 1, Number(paso) || 0)) };
  let current = null;
  // nombres del resto de ejercicios: para el nombre de la variante y
  // para no dejar dos iguales (§6). Sin red se queda vacío y no bloquea.
  let otros = [];

  /* La Pizarra se crea al entrar en su paso por primera vez, y vive
     hasta que se sale del asistente. */
  let pizarra = null;
  /* La jugada de un ejercicio de ANTES de la Pizarra tal y como se abre
     en ella (sus posiciones iniciales), en texto. Mientras lo dibujado
     sea eso, no se ha tocado nada y lo guardado no se recompila. */
  let huellaVieja = null;

  const navHost = h('div');
  const stepHost = h('div', { class: 'wizard-step' });
  const footHost = h('div');

  // ---- autoguardado de borrador (§13) ----
  let saveTimer = null;
  /* Cada ejercicio guarda SU borrador (Tramo 3.13): al editar uno ya
     creado, el suyo; al crear, el del ejercicio nuevo. Con una sola
     clave, empezar un ejercicio nuevo pisaba la corrección a medias. */
  const claveBorrador = () => (modo === 'nuevo' ? null : id);
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => guardarBorrador({ ...draft, jugada: jugadaActual() }, [], state.step, claveBorrador()), 600);
  };

  const onDraftChange = () => { if (btnGuardar) btnGuardar.disabled = !puedeGuardar(draft); scheduleSave(); };
  const ctx = { draft, stage, onDraftChange, goTo, toast, recuento: () => recuentoActual() };

  /* ---- la Pizarra --------------------------------------------- */

  /** Lo dibujado, o `null` si es un ejercicio de antes de la Pizarra que
   *  nadie ha tocado (ver `huellaVieja`). */
  function jugadaActual() {
    if (!pizarra) return draft.jugada ?? null;
    const j = pizarra.jugada();
    if (draft.jugada == null && huellaVieja !== null && JSON.stringify(j) === huellaVieja) return null;
    return j;
  }

  /** Pasa lo dibujado al borrador: la jugada, y la animación compilada
   *  desde ella. */
  function volcarPizarra() {
    const j = jugadaActual();
    if (!j) return;
    draft.jugada = j;
    draft.canasta = j.canasta;
    draft.animacion = compilar(j);
  }

  /** Cuántos hay de cada cosa, para los requisitos del paso 3. */
  function recuentoActual() {
    if (pizarra) return pizarra.recuento();
    if (draft.jugada) return recuento(draft.jugada.elementos || []);
    const vieja = draft.animacion ? jugadaDesdeAnimacion(draft.animacion) : null;
    return recuento(vieja ? vieja.elementos : []);
  }

  /**
   * Deja la Pizarra lista para su paso. Si ya existía con otra pista —se
   * ha cambiado en el paso 0—, se rehace llevándose lo dibujado: las
   * posiciones son normalizadas y valen en las dos.
   * @returns lo que hay que cargar en ella una vez montada, o null
   */
  function prepararPizarra() {
    if (pizarra && pizarra.lienzo.vista.pistaKey === draft.tipo_pista) return null;
    let jugada = null;
    if (pizarra) {
      jugada = jugadaActual();
      pizarra.destroy();
      huellaVieja = null;
    } else {
      jugada = draft.jugada;
    }
    pizarra = new Pizarra({ pista: draft.tipo_pista, canasta: draft.canasta || 'norte', onCambio: scheduleSave });
    return () => {
      if (jugada) { pizarra.cargar({ ...jugada, pista: draft.tipo_pista }); return; }
      if (draft.animacion) {
        /* De antes de la Pizarra: sus posiciones iniciales, para
           rehacerlo (§11.4). Lo dice la propia Pizarra al cargar. */
        pizarra.cargar(null, { animacion: { ...draft.animacion, pista: draft.tipo_pista } });
        huellaVieja = JSON.stringify(pizarra.jugada());
      }
    };
  }

  function pasoPizarra() {
    const el = h('div', { class: 'wizard-pizarra' });
    return {
      el,
      /* Montar y medir DESPUÉS de estar en el DOM: medida antes, la pista
         sale de 0×0 (ver Lienzo.medir). */
      alMontar() {
        const cargar = prepararPizarra();
        el.append(pizarra.el);
        pizarra.medir();
        cargar?.();
      },
      destroy() {
        volcarPizarra();
        pizarra?.el.remove();
      },
    };
  }

  const STEP_FNS = [paso0, pasoPizarra, paso3];

  /** La columna de la derecha: lo dibujado, en movimiento si es de la
   *  Pizarra y quieto si es de antes (§11.4). */
  function verEnLaColumna() {
    const anim = draft.animacion;
    if (anim && esDeLaPizarra(anim) && (anim.fases || []).length) stage.showAnimation(anim);
    else stage.showPreview(anim || { pista: draft.tipo_pista, jugadores: [], balones: [], conos: [], fases: [] });
  }

  function paint() {
    // cada paso puede tener que soltar lo suyo al salir; el de la
    // Pizarra vuelca lo dibujado al borrador
    current?.destroy?.();
    current = STEP_FNS[state.step](ctx);
    const enPizarra = state.step === PASO_PIZARRA;
    view.classList.toggle('taller--pizarra', enPizarra);
    mount(navHost, stepNav(STEPS, state.step, { onJump: goTo }));
    mount(stepHost, current.el);
    mount(footHost, footer());
    current.alMontar?.();
    if (!enPizarra) verEnLaColumna();
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

  /** Olvida la Pizarra: se rehará con lo que haya en el borrador la
   *  próxima vez que se entre en su paso. */
  function soltarPizarra() {
    pizarra?.destroy();
    pizarra = null;
    huellaVieja = null;
  }

  function aplicarBorrador(b) {
    soltarPizarra();
    Object.assign(draft, b.draft);
    /* Un borrador de antes de la Pizarra traía las fichas aparte, sin
       jugada: se abren en la Pizarra tal cual, sin trazos. */
    if (!draft.jugada && Array.isArray(b.elementos) && b.elementos.length) {
      draft.jugada = { version: 3, pista: draft.tipo_pista, canasta: draft.canasta || 'norte', elementos: b.elementos, fases: [] };
    }
    stage.setPista(draft.tipo_pista);
    state.step = pasoDelBorrador(b);
    current = null;   // lo que había se ha soltado ya: no hay nada que volcar
    paint();
    toast('Borrador recuperado.', { type: 'ok' });
  }

  async function guardar() {
    // guardar desde la Pizarra, sin salir de ella: lo dibujado primero
    volcarPizarra();
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
    const dibujado = (draft.jugada?.fases || []).some((f) => (f.tramos || []).length);
    if (!draft.animacion || (draft.jugada && !dibujado)) {
      const ok = await confirmToast('No hay nada dibujado en la Pizarra. ¿Guardar igual?');
      if (!ok) return;
    }
    const prev = btnGuardar.textContent;
    btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…';
    try {
      const user = await getUser();
      if (!user) { toast('Inicia sesión en Playbook CBP para guardar en la nube.', { type: 'warn', timeout: 5000 }); return; }
      // con id, se corrige el que ya existe; sin él, se crea uno nuevo
      const { id: guardadoId } = draft.id
        ? await actualizarEjercicio(draft.id, draft, [])
        : await guardarEjercicio(draft, []);
      borrarBorrador(claveBorrador());
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

  root.append(view);
  paint();

  /* ---- entrar con un ejercicio cargado (Tramo 2.13) --------------
     Se hace en segundo plano y se repinta al llegar: el asistente ya
     está en pantalla, así que abrir para editar no deja al entrenador
     mirando un hueco en blanco mientras viaja la consulta. */
  const cargando = (id && modo !== 'nuevo') ? (async () => {
    try {
      const fila = await getEjercicio(id);
      otros = await nombresDeEjercicios().catch(() => []);
      const { draft: cargado } = borradorDeEjercicio(fila, {
        duplicar: modo === 'duplicar',
        nombres: otros.map((o) => o.name),
      });
      soltarPizarra();
      Object.assign(draft, cargado);
      stage.setPista(draft.tipo_pista);
      current = null;   // lo que había era del ejercicio vacío: nada que volcar
      paint();
      titulo.textContent = modo === 'duplicar' ? 'Variante de un ejercicio' : 'Editar ejercicio';
      const deAntes = !draft.jugada && draft.animacion && !esDeLaPizarra(draft.animacion);
      toast(modo === 'duplicar'
        ? `Variante de «${fila.name}». Cambia lo que quieras: se guardará como un ejercicio nuevo.`
        : 'Ejercicio cargado.', { type: 'ok', timeout: 5000 });
      if (deAntes) {
        toast('Es de antes de la Pizarra: su animación ya no se reproduce. En la Pizarra puedes rehacerla desde sus posiciones iniciales.', { type: 'info', timeout: 8000 });
      }
    } catch (e) {
      toast('No se pudo cargar el ejercicio: ' + (e.message || 'error'), { type: 'error', timeout: 6000 });
    }
  })() : (async () => { otros = await nombresDeEjercicios().catch(() => []); })();

  /* ---- el autor, puesto solo (Tramo 3.8) -------------------------
     Solo al CREAR. Al editar o duplicar, el autor ya viene del
     ejercicio (cargar.js) y machacarlo pondría tu nombre en el trabajo
     de otro; y si ese ejercicio venía sin autor, rellenarlo al abrirlo
     sería atribuírtelo por haber pasado por delante.

     Se pone solo si el campo sigue vacío: si se ha escrito algo
     mientras viajaba la consulta, manda lo escrito. Y se repinta solo
     si se está mirando el paso donde vive el campo. */
  if (modo === 'nuevo') {
    nombreDelEntrenador().then((nombre) => {
      if (!nombre || draft.autor_nombre) return;
      draft.autor_nombre = nombre;
      if (state.step === STEPS.length - 1) paint();
    });
  }

  /* El borrador sin guardar se ofrece SIEMPRE, pero el suyo (Tramo
     3.13). Antes solo al crear, y con razón: con una sola clave, abrir
     un ejercicio existente y encontrarse el borrador de OTRA cosa era
     la manera más rápida de perder lo que se acababa de abrir. Ahora
     cada ejercicio tiene el suyo y esa confusión ya no puede darse.

     Se espera a que el ejercicio esté cargado: primero se ve lo
     guardado y después se pregunta si se quiere lo de encima. */
  (cargando || Promise.resolve()).then(() => {
    const b = leerBorrador(claveBorrador());
    if (!borradorConContenido(b) || estaViejo(b)) return;
    toast(
      modo === 'nuevo'
        ? `Tienes un borrador sin guardar del ${fechaBorrador(b)}. ¿Retomar?`
        : `Dejaste cambios sin guardar el ${fechaBorrador(b)}. ¿Retomarlos?`,
      {
        type: 'info', timeout: 0,
        actions: [
          { label: 'Retomar', onClick: () => aplicarBorrador(b) },
          { label: 'Descartar', onClick: () => borrarBorrador(claveBorrador()) },
        ],
      },
    );
  }).catch(() => {});

  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    window.__stage = stage; window.__draft = draft;
    window.__wizard = { guardar, aplicarBorrador, pizarra: () => pizarra, goTo };
  }
  return { destroy() { clearTimeout(saveTimer); current?.destroy?.(); pizarra?.destroy(); stage.destroy(); view.remove(); } };
}
