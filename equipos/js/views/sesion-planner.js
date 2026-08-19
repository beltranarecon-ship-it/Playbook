/* ============================================================
   sesion-planner.js — /sesiones/:sessionId · planificador.

   Dos columnas en escritorio: a la izquierda el plan (objetivos,
   bloques, curva de carga), a la derecha el VISOR del bloque
   seleccionado — la pizarra animada, el paso a paso y la ficha, sin
   salir de la sesión. En móvil el visor se abre en un modal.

   Los bloques se reordenan arrastrando (y con ↑/↓, que es lo que
   funciona con teclado y con guantes de invierno en el pabellón).
   La curva de carga es navegable: cada escalón es su bloque.
   ============================================================ */

import { h, mount, icon } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { abrirModal, pedirTexto } from '../ui/modal.js';
import { puntoEquipo } from '../ui/components.js';
import { crearVisor } from '../ui/visor.js';
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
import { objetivosEnFecha, sugerirEjercicios, normaliza } from '../data/sugerencias.js';
import {
  curvaCarga, avisoDuracion, INTENSIDAD_MAX, INTENSIDAD_LABEL,
} from '../data/carga.js';
import { minutosDeSesion, avisoAforo } from '../data/minutos.js';
import {
  bloqueAgua, esAgua, esVideo, bloqueDeVideo, huecoDisponible, ajustarADisponible,
  materialDeSesion, textoMaterial, repetidosEnSesion, repetidosRecientes,
  textoHace, cabeEnGrupo,
} from '../data/plan.js';
import { getSesionesRango } from '../data/sessions.js';
import { esActiva } from '../data/estado-sesion.js';
import { getRubricaEquipo } from '../data/rubrica.js';
import { queVigilarHoy } from '../data/objetivos-medida.js';
import { filasDeRubrica } from '../../../taller/js/rubrica.js';
import { getDuracionesReales } from '../../../taller/js/supabase/duraciones.js';
import { duracionPropuesta, textoDuracion } from '../../../taller/js/duracion.js';
import { getVideosGuardados, guardarVideoBloque, borrarVideoBloque } from '../data/videos.js';
import { leerVideo, textoTramo } from '../../../taller/js/ia/video.js';
import { abrirVideo } from '../../../taller/js/ui/video.js';
import { getBloquesSesiones } from '../data/blocks.js';
import { getJugadores } from '../data/players.js';
import { ESTADOS_SESION, WEEKDAYS } from '../config.js';
import { router } from '../main.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const isoWeekday = (iso) => { const d = new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay(); return d === 0 ? 7 : d; };
const hhmm = (t) => (t ? t.slice(0, 5) : '');
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ICO = {
  arrastrar: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  duplicar: 'M8 8h11v11H8zM5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1',
  quitar: 'M6 18 18 6M6 6l12 12',
};

/** El visor solo cabe al lado con sitio de sobra; por debajo va en modal. */
const ESCRITORIO = '(min-width: 1100px)';
const hayHueco = () => window.matchMedia(ESCRITORIO).matches;

let uidSeq = 0;
const nuevoUid = () => `b${++uidSeq}`;

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

/** Nodo ANTE el que soltar, según dónde está el cursor. null = al final.
 *  Se ignora el que se arrastra: si no, se compararía consigo mismo. */
function nodoTrasCursor(cont, y) {
  const otros = [...cont.querySelectorAll('.eq-bloque:not(.is-arrastrando)')];
  return otros.find((el) => {
    const r = el.getBoundingClientRect();
    return y < r.top + r.height / 2;
  }) || null;
}

export function render(root, params) {
  const sessionId = params.sessionId;
  const cont = h('div', { class: 'eq-page eq-planner' });
  mount(root, cont);

  let sesion = null, equipos = [], color = 'var(--muted)', nombreEquipo = '—';
  let bloques = [];              // [{uid, id?, exercise_id, titulo, duracion_min, intensidad, notas}]
  let objetivosEquipo = [];
  let objetivosSel = new Set();
  let biblioteca = [];
  let porId = new Map();         // id de ejercicio → fila de la biblioteca
  /* Cuántos van a estar en la pista (Tramo 3.1). De la plantilla, sin
     las bajas: es la mejor estimación que hay ANTES de pasar lista, y
     es lo que decide si un ejercicio de doce se convierte en una cola
     de dieciocho. Si no se puede saber, los minutos se calculan solo
     con la densidad y se dice en pantalla. */
  let jugadoresEquipo = null;
  /* El número que el entrenador AJUSTA para este día: «hoy vienen 10».
     No se guarda en la base de datos porque es una estimación, no un
     registro —el número de verdad sale de pasar lista—, pero sí en el
     navegador, para que no haya que volver a ponerlo al recargar. */
  let jugadoresSesion = null;
  let filtrarPorGrupo = true;
  let historial = { sesiones: [], bloquesPorSesion: {} };
  /* Lo que de verdad duró cada ejercicio las últimas veces (Tramo 3.6).
     Llega por red y se suma cuando llega: sin ello se propone lo que
     dice la ficha, que es lo que se hacía antes. */
  let reales = {};
  /* Para el panel «qué vigilar hoy» (Tramo 3.9): la rúbrica del equipo
     dice quién está más bajo en las dianas de los objetivos de la
     sesión, que es lo único accionable de un objetivo en la pista. */
  let rubrica = {};
  let plantillaEq = [];
  let titulo = '';
  let soloLectura = false;
  let sucio = false;
  let selUid = null;             // bloque enfocado en el visor
  let modalVisor = null;
  let modalPicker = null;
  let ordenAntesDeArrastrar = null;

  const marcaSucio = () => { sucio = true; pintaEstadoGuardado(); };

  /* ---- cuánta gente va a haber (Tramo 3.2) ------------------------
     Manda lo que el entrenador ponga para ESTE día; si no ha puesto
     nada, la plantilla del equipo. Se recuerda en el navegador y no en
     la base de datos: es una estimación para planificar, y el dato de
     verdad lo da la asistencia. */
  const CLAVE_JUGADORES = `cbp-jugadores-${sessionId}`;
  const jugadores = () => jugadoresSesion ?? jugadoresEquipo;
  function ponJugadores(n) {
    const v = Number(n);
    jugadoresSesion = Number.isFinite(v) && v > 0 ? Math.min(60, Math.round(v)) : null;
    try {
      if (jugadoresSesion) localStorage.setItem(CLAVE_JUGADORES, String(jugadoresSesion));
      else localStorage.removeItem(CLAVE_JUGADORES);
    } catch { /* modo privado: se pierde al recargar y no pasa nada */ }
    dibujaCurva();
    pintaBloques();
  }
  try {
    const g = Number(localStorage.getItem(CLAVE_JUGADORES));
    if (Number.isFinite(g) && g > 0) jugadoresSesion = g;
  } catch { /* sin localStorage se usa la plantilla */ }

  /** El tope de pista, o null si esta sesión no tiene horario. */
  const tope = () => Number(sesion?.slot_duracion_min) || null;
  const nodoCurva = h('div', { class: 'eq-curva-wrap' });
  const nodoBloques = h('div', { class: 'eq-bloques' });
  const nodoTotales = h('div', { class: 'eq-carga-totales' });
  const nodoNotaMinutos = h('p', { class: 'eq-minutos-nota' });
  const nodoJugadores = h('div', { class: 'eq-plan-gente' });
  const nodoMaterial = h('div', { class: 'eq-material' });
  const nodoEstado = h('span', { class: 'eq-guardado' });
  const anfitrionVisor = h('div', { class: 'eq-planner-visor' });

  const visor = crearVisor({
    soloLectura: () => soloLectura,
    onNotas: (b) => { marcaSucio(); refrescaMarcaNotas(b); },
  });
  anfitrionVisor.append(visor.el);

  // aviso al cerrar/recargar la pestaña con cambios pendientes
  const onBeforeUnload = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  const salir = (destino) => {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir y descartarlos?')) return false;
    sucio = false; router.navigate(destino); return true;
  };
  /** Enlace que respeta el aviso de cambios sin guardar. */
  const enlaceGuardado = (destino, texto, clase) => h('a', {
    class: clase, href: destino,
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); salir(destino); },
  }, texto);

  function pintaEstadoGuardado() {
    if (soloLectura) { nodoEstado.replaceChildren(); return; }
    nodoEstado.className = 'eq-guardado' + (sucio ? ' is-sucio' : '');
    nodoEstado.textContent = sucio ? 'Cambios sin guardar' : 'Todo guardado';
  }

  // ── selección ──────────────────────────────────────────────
  function marcaSeleccion() {
    for (const el of nodoBloques.querySelectorAll('.eq-bloque')) {
      el.classList.toggle('is-sel', el.dataset.uid === selUid);
    }
    dibujaCurva();
  }

  function selecciona(b, { abrirEnMovil = true } = {}) {
    // Si ya hay sitio al lado, el modal sobra: se cierra ANTES de pintar para
    // que el visor vuelva a su columna. Cubre el caso en que la ventana creció
    // sin que llegara el evento 'resize' (pasa en navegadores embebidos y al
    // girar algunos móviles), sin depender de que ningún evento se dispare.
    if (hayHueco() && modalVisor) modalVisor.cerrar();
    selUid = b.uid;
    marcaSeleccion();
    visor.mostrar(b);
    if (abrirEnMovil && !hayHueco()) abreVisorModal();
  }

  function deselecciona() {
    selUid = null;
    marcaSeleccion();
    visor.vaciar();
  }

  /** En móvil el visor no cabe al lado: se presta al modal y vuelve al cerrar. */
  function abreVisorModal() {
    if (modalVisor) return;
    modalVisor = abrirModal({
      titulo: 'Ejercicio',
      clase: 'modal-visor',
      cuerpo: visor.el,
      alCerrar: () => {
        modalVisor = null;
        anfitrionVisor.append(visor.el);
        // vuelve a una columna oculta: parar el reloj o seguiría animando
        // un lienzo invisible mientras el entrenador edita el plan
        visor.pausar();
      },
    });
  }

  // Si la ventana cruza a escritorio con el modal abierto (girar la tablet,
  // ensanchar), la columna del visor aparece VACÍA porque el visor sigue
  // prestado al modal. Se cierra el modal y el nodo vuelve a su sitio.
  // Se escucha 'resize' y no el 'change' de matchMedia porque resize llega
  // en más sitios (incluidos los navegadores embebidos que emulan el
  // viewport sin notificar las media queries) y aquí el coste es cero: solo
  // se hace algo si además hay un modal abierto.
  const alRedimensionar = () => { if (modalVisor && hayHueco()) modalVisor.cerrar(); };
  window.addEventListener('resize', alRedimensionar);

  // ── curva de carga ─────────────────────────────────────────
  function dibujaCurva() {
    const c = curvaCarga(bloques);
    const slot = Number(sesion?.slot_duracion_min) || 0;
    const aviso = avisoDuracion(c.duracion, slot);

    /* Los MINUTOS ACTIVOS por jugador (Tramo 3.1) van los primeros y en
       grande, porque son el número que decide si el plan sirve. La
       carga de siempre —intensidad × minutos— se queda detrás: no
       distingue doce niños trabajando de doce haciendo cola, pero es
       con la que se han leído las sesiones hasta hoy. */
    const m = minutosDeSesion(bloques, { jugadores: jugadores(), requisitosDe });

    // Totales. Ojo: replaceChildren NO filtra null (lo pintaría como el
    // texto "null"), a diferencia de h(); por eso el .filter(Boolean).
    nodoTotales.replaceChildren(...[
      dato(String(Math.round(m.minutos)), 'min activos por jugador', tituloMinutos()),
      dato(m.duracion ? `${Math.round(m.aprovechamiento * 100)} %` : '0 %', 'del entreno'),
      dato(String(c.duracion), 'min totales'),
      dato(c.cargaMedia ? c.cargaMedia.toFixed(1) : '0', 'intensidad media'),
      dato(String(bloques.length), bloques.length === 1 ? 'bloque' : 'bloques'),
      // Pasarse ya no es posible al añadir (Tramo 3.2), pero un plan
      // escrito antes de esta regla puede llegar pasado: se sigue
      // diciendo en vez de disimularlo.
      aviso && aviso.tipo === 'excede'
        ? h('span', { class: 'eq-carga-aviso is-excede' }, `${aviso.diff} min de más para un entreno de ${slot}′`)
        : null,
      slot && !(aviso && aviso.tipo === 'excede')
        ? h('span', { class: 'eq-carga-aviso is-corto' }, huecoDisponible(bloques, slot)
          ? `Quedan ${huecoDisponible(bloques, slot)} min de los ${slot} de pista`
          : `Los ${slot} min de pista, completos`)
        : null,
    ].filter(Boolean));

    nodoNotaMinutos.replaceChildren(...notaMinutos(m).filter(Boolean));
    pintaJugadores();
    pintaMaterial();

    nodoCurva.replaceChildren(c.segmentos.length
      ? svgCurva(c, slot)
      : h('div', { class: 'eq-curva-vacia' }, 'Añade bloques y aquí verás cómo sube y baja la intensidad del entreno.'));
  }

  const dato = (num, lbl, titulo = null) => h('div', { class: 'eq-carga-dato', ...(titulo ? { title: titulo } : {}) },
    h('span', { class: 'eq-carga-num' }, num),
    h('span', { class: 'eq-carga-lbl' }, lbl));

  /* ---- cuánta gente y qué material (Tramo 3.2) --------------------
     Los dos van juntos porque el segundo depende del primero: cuántos
     balones hay que sacar del almacén sale de cuántos críos vienen. */
  function pintaJugadores() {
    if (soloLectura) { nodoJugadores.replaceChildren(); return; }
    const campo = h('input', {
      class: 'field-input eq-plan-gente-n', type: 'number', min: 1, max: 60,
      value: jugadores() ?? '', placeholder: String(jugadoresEquipo ?? ''),
      'aria-label': 'Cuántos jugadores vienen a esta sesión',
      onChange: (e) => ponJugadores(e.target.value),
    });
    // replaceChildren NO filtra null (lo pintaría como el texto "null"),
    // a diferencia de h(): de ahí el .filter(Boolean).
    nodoJugadores.replaceChildren(...[
      h('label', { class: 'eq-plan-gente-lbl' }, 'Hoy vienen', campo, 'jugadores'),
      jugadoresSesion && jugadoresEquipo && jugadoresSesion !== jugadoresEquipo
        ? h('button', {
            class: 'btn btn-secondary eq-btn-mini', type: 'button',
            onClick: () => ponJugadores(null),
          }, `Volver a la plantilla (${jugadoresEquipo})`)
        : null,
      h('span', { class: 'eq-ayuda' }, 'Es una estimación para planificar; el número de verdad sale de pasar lista.'),
    ].filter(Boolean));
  }

  function pintaMaterial() {
    const filas = materialDeSesion(bloques, { jugadores: jugadores(), requisitosDe });
    if (!filas.length) {
      nodoMaterial.replaceChildren(bloques.length
        ? h('p', { class: 'eq-ayuda' }, 'Ninguna ficha del plan declara material.')
        : h('p', { class: 'eq-ayuda' }, 'Añade bloques y aquí saldrá lo que hay que sacar del almacén.'));
      return;
    }
    nodoMaterial.replaceChildren(
      h('div', { class: 'eq-material-fila' }, ...filas.map((f) => h('span', { class: 'eq-material-item', title: `De: ${f.deQuien.join(' · ')}` },
        f.cantidad ? h('strong', null, String(f.cantidad)) : null,
        f.cantidad ? ' ' : null,
        f.nombre,
      ))),
      h('p', { class: 'eq-ayuda' }, 'Sale de lo que declara cada ficha. Solo se cuentan balones y pelotas de tenis, que son lo que se usa uno por crío; del resto, la ficha no dice cuántos.'),
    );
  }

  /* ---- lo repetido (Tramo 3.2) ------------------------------------
     Ninguno de los dos avisos bloquea: repetir un ejercicio a los tres
     días puede ser exactamente lo que se quiere. Lo que no puede pasar
     es enterarse en la pista. */
  function avisoRepeticion(b) {
    if (!b?.exercise_id) return null;
    const dosVeces = repetidosEnSesion(bloques).find((r) => r.exercise_id === b.exercise_id);
    if (dosVeces) return `Está ${dosVeces.veces} veces en esta sesión`;
    const reciente = repetidosRecientes([b], { ...historial, fecha: sesion?.fecha }).at(0);
    if (reciente) return `Ya lo hiciste ${textoHace(reciente.dias)} (${reciente.fecha})`;
    return null;
  }

  /* ---- minutos activos (Tramo 3.1) --------------------------------
     Los requisitos salen de la lista LIGERA de la biblioteca, que ya
     está cargada: no hay ninguna consulta más por mover un bloque. Un
     bloque libre —una charla, el agua— no tiene ficha, y eso es `null`:
     cuenta entero, porque nadie está esperando turno para beber. */
  const requisitosDe = (b) => (b?.exercise_id ? (porId.get(b.exercise_id)?.requisitos || null) : null);

  const tituloMinutos = () => (jugadores()
    ? `Con ${jugadores()} jugadores en la pista. Cuenta la densidad de cada ejercicio y a cuántos admite su montaje.`
    : 'Sin plantilla cargada: solo cuenta la densidad de cada ejercicio.');

  /*
     La nota al pie no es un adorno: el número se construye con lo que
     las fichas declaran, y un número redondo encima de huecos es peor
     que un número con una advertencia. Se dice cuántos bloques lo
     sostienen y qué ejercicio no cabe con la gente que hay.
  */
  function notaMinutos(m) {
    const partes = [];
    if (!m.duracion) return partes;

    if (!jugadores()) {
      partes.push(h('span', { class: 'eq-minutos-supuesto' },
        'Sin plantilla: no se puede saber quién hace cola, así que solo cuenta la densidad.'));
    }
    if (m.conSupuestos) {
      partes.push(h('span', { class: 'eq-minutos-supuesto' },
        m.conSupuestos === 1
          ? '1 ejercicio no declara densidad o aforo: cuenta como si nadie esperase. Complétalo en su ficha.'
          : `${m.conSupuestos} ejercicios no declaran densidad o aforo: cuentan como si nadie esperase. Complétalos en su ficha.`));
    }
    if (m.libres) {
      // no es un dato que falte: es otro tipo de bloque
      partes.push(h('span', { class: 'eq-minutos-supuesto' },
        m.libres === 1
          ? '1 bloque libre (sin ficha) cuenta entero: la app no sabe si es juego o charla.'
          : `${m.libres} bloques libres (sin ficha) cuentan enteros: la app no sabe si son juego o charla.`));
    }

    // qué ejercicio concreto no cabe, y qué haría falta para que quepa
    for (const b of bloques) {
      const av = avisoAforo(requisitosDe(b), jugadores());
      if (!av) continue;
      partes.push(h('span', { class: 'eq-minutos-aforo' },
        `«${b.titulo || 'Bloque'}» se queda corto para ${jugadores()}: sobran ${av.sobran}. `
        + `Harían falta ${av.estacionesNecesarias} estaciones`
        + (av.canastasNecesarias ? ` y ${av.canastasNecesarias} canastas.` : '.')));
    }
    return partes;
  }

  /**
   * Curva escalón con ejes de verdad: intensidad 1-5 a la izquierda,
   * minutos abajo y una marca del horario del equipo. Cada escalón es
   * pulsable y lleva al bloque que lo produce.
   */
  function svgCurva(c, slot) {
    const W = 680, H = 176;
    const padL = 26, padR = 10, padT = 12, padB = 30;
    const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB;
    const anchoPlot = x1 - x0, altoPlot = y1 - y0;

    // El eje X llega hasta lo que dure el plan O hasta el horario, lo que
    // sea mayor: así la marca del horario SIEMPRE se ve, y un plan corto
    // se lee de un vistazo como lo que es (una barra que no llega).
    const fin = Math.max(c.duracion, slot || 0) || 1;
    const X = (min) => x0 + (min / fin) * anchoPlot;
    const Y = (int) => y1 - (Math.max(0, Math.min(int, INTENSIDAD_MAX)) / INTENSIDAD_MAX) * altoPlot;

    // paso de rejilla: ni un tick por minuto ni dos en toda la curva
    const paso = fin <= 30 ? 5 : fin <= 75 ? 15 : 30;
    const ticks = [];
    for (let m = 0; m <= fin + 0.001; m += paso) ticks.push(Math.round(m));

    const hijos = [];

    // rejilla horizontal + etiquetas de intensidad
    for (let i = 0; i <= INTENSIDAD_MAX; i++) {
      const y = Y(i);
      hijos.push(h('line', { class: 'eq-curva-guia', x1: x0, y1: y, x2: x1, y2: y }));
      if (i > 0) hijos.push(h('text', { class: 'eq-curva-eje', x: x0 - 6, y: y + 3, 'text-anchor': 'end' }, String(i)));
    }

    // Escalones: un rect por bloque, pulsable. El índice del segmento se
    // cruza con los bloques QUE DURAN ALGO, no con la lista entera:
    // curvaCarga() se salta los de duración 0 y si no, un solo bloque
    // raro desalinearía todos los clics de ahí en adelante.
    const conDuracion = bloques.filter((b) => (Number(b.duracion_min) || 0) > 0);
    c.segmentos.forEach((s, i) => {
      const b = conDuracion[i];
      const sel = b && b.uid === selUid;
      const xa = X(s.x0), xb = X(s.x1);
      hijos.push(h('rect', {
        class: 'eq-curva-seg' + (sel ? ' is-sel' : ''),
        x: xa, y: Y(s.intensidad), width: Math.max(1, xb - xa), height: y1 - Y(s.intensidad),
        onClick: () => { if (b) selecciona(b); },
      }, h('title', {}, `${s.titulo || 'Bloque libre'} · ${s.duracion} min · intensidad ${s.intensidad}`)));
    });

    // línea superior del escalón (perfil de la sesión)
    const perfil = c.segmentos.flatMap((s) => [
      `${X(s.x0).toFixed(1)},${Y(s.intensidad).toFixed(1)}`,
      `${X(s.x1).toFixed(1)},${Y(s.intensidad).toFixed(1)}`,
    ]).join(' ');
    hijos.push(h('polyline', { class: 'eq-curva-linea', points: perfil }));

    // marca del horario del equipo
    if (slot > 0) {
      const xs = X(slot);
      hijos.push(h('line', { class: 'eq-curva-slot', x1: xs, y1: y0, x2: xs, y2: y1 }));
      hijos.push(h('text', {
        class: 'eq-curva-slot-lbl',
        x: Math.min(xs + 5, x1 - 2), y: y0 + 9,
        'text-anchor': xs > x1 - 70 ? 'end' : 'start',
      }, `${slot}′ de pista`));
    }

    // eje X
    hijos.push(h('line', { class: 'eq-curva-ejex', x1: x0, y1: y1, x2: x1, y2: y1 }));
    for (const m of ticks) {
      hijos.push(h('text', { class: 'eq-curva-eje', x: X(m), y: y1 + 14, 'text-anchor': 'middle' }, String(m)));
    }
    hijos.push(h('text', { class: 'eq-curva-eje eq-curva-eje-u', x: x1, y: y1 + 26, 'text-anchor': 'end' }, 'minutos'));
    hijos.push(h('text', {
      class: 'eq-curva-eje eq-curva-eje-u', x: x0 - 6, y: y0 + 2,
      'text-anchor': 'end',
    }, 'int.'));

    return h('svg', {
      class: 'eq-curva', viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `Curva de carga: ${c.duracion} minutos, carga ${c.carga}, intensidad media ${c.cargaMedia.toFixed(1)}`,
    }, ...hijos);
  }

  // ── un bloque ──────────────────────────────────────────────
  function metaBloque(b) {
    if (!b.exercise_id) return 'Bloque libre';
    const ej = porId.get(b.exercise_id);
    // Solo se avisa si la biblioteca SÍ llegó: si la consulta falló,
    // el mapa está vacío y todos parecerían borrados.
    if (!ej) return biblioteca.length ? 'Ya no está en la biblioteca' : '';
    return [ej.type, ej.duration_min ? `${ej.duration_min}′ de referencia` : null]
      .filter(Boolean).join(' · ');
  }

  function filaBloque(b, i) {
    const meta = metaBloque(b);

    const tituloEl = b.exercise_id || soloLectura
      ? h('span', { class: 'eq-bloque-titulo' }, b.titulo || '(bloque libre)')
      : h('input', {
          class: 'field-input eq-bloque-titulo-input', type: 'text', value: b.titulo,
          placeholder: 'Bloque libre (calentamiento, charla…)',
          onInput: (e) => { b.titulo = e.target.value; marcaSucio(); },
          onClick: (e) => e.stopPropagation(),
        });

    const cuerpo = h('div', { class: 'eq-bloque-cuerpo' },
      h('div', { class: 'eq-bloque-cab' },
        tituloEl,
        tieneNotas(b) ? h('span', { class: 'eq-bloque-marca', title: 'Tiene notas para esta sesión' }, '✎') : null,
      ),
      meta ? h('p', { class: 'eq-bloque-meta' + (meta === 'Ya no está en la biblioteca' ? ' is-roto' : '') }, meta) : null,
      (() => { const r = avisoRepeticion(b); return r ? h('p', { class: 'eq-bloque-repe' }, r) : null; })(),
      esVideo(b) ? h('p', { class: 'eq-bloque-video' },
        '▶ Vídeo · ',
        [b.video.tipo === 'tiktok' ? 'TikTok' : 'YouTube', textoTramo(b.video)].filter(Boolean).join(' · '),
      ) : null,
      soloLectura
        ? h('div', { class: 'eq-bloque-ctrls eq-bloque-ctrls-ro' },
            h('span', { class: 'eq-bloque-ro-dato' }, `${b.duracion_min} min`),
            h('span', { class: 'eq-bloque-ro-dato' }, `Intensidad ${b.intensidad}/${INTENSIDAD_MAX}`))
        : h('div', { class: 'eq-bloque-ctrls', onClick: (e) => e.stopPropagation() },
            h('label', { class: 'eq-bloque-dur' },
              h('input', {
                class: 'field-input', type: 'number', min: 1, max: 240, value: b.duracion_min,
                'aria-label': `Duración en minutos de ${b.titulo || 'el bloque'}`,
                onChange: (e) => {
                  const pedida = Math.max(1, Math.min(240, Number(e.target.value) || 1));
                  // el propio bloque no cuenta contra sí mismo: subirlo
                  // puede llegar hasta lo que dejen LOS DEMÁS
                  const { duracion, recortado } = ajustarADisponible(bloques, tope(), pedida, { excepto: b.uid });
                  b.duracion_min = Math.max(1, duracion);
                  e.target.value = b.duracion_min;
                  if (recortado) toast(`Hasta ${b.duracion_min} min: es lo que queda de los ${tope()} de pista.`);
                  marcaSucio(); dibujaCurva(); visor.refrescarCabecera();
                },
              }),
              h('span', { class: 'eq-bloque-dur-u' }, 'min')),
            intensidadSelector(b.intensidad, (v) => {
              b.intensidad = v; marcaSucio(); dibujaCurva(); visor.refrescarCabecera();
            }),
          ),
    );

    const fila = h('div', {
      class: 'eq-bloque' + (b.uid === selUid ? ' is-sel' : ''),
      dataset: { uid: b.uid },
      role: 'button', tabindex: '0',
      'aria-label': `Ver ${b.titulo || 'bloque'} en el visor`,
      onClick: () => selecciona(b),
      // La fila es un botón y DENTRO lleva campos. Los eventos de teclado de
      // esos campos burbujean hasta aquí: sin este filtro, la barra
      // espaciadora del título de un bloque libre se la comía el preventDefault
      // y no se podía escribir "Charla táctica" — solo "Charlatáctica".
      onKeydown: (e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecciona(b); }
      },
    },
      h('div', { class: 'eq-bloque-orden', onClick: (e) => e.stopPropagation() },
        soloLectura ? null : h('button', {
          class: 'eq-mov', type: 'button', 'aria-label': 'Subir', disabled: i === 0,
          onClick: () => mueveBloque(i, -1),
        }, '↑'),
        h('span', { class: 'eq-bloque-n' }, String(i + 1)),
        soloLectura ? null : h('button', {
          class: 'eq-mov', type: 'button', 'aria-label': 'Bajar', disabled: i === bloques.length - 1,
          onClick: () => mueveBloque(i, 1),
        }, '↓'),
      ),
      cuerpo,
      soloLectura ? null : h('div', { class: 'eq-bloque-acc', onClick: (e) => e.stopPropagation() },
        h('button', {
          class: 'eq-bloque-icono', type: 'button', title: 'Duplicar bloque', 'aria-label': 'Duplicar bloque',
          onClick: () => duplicaBloque(i),
        }, icon(ICO.duplicar, { size: 15 })),
        h('button', {
          class: 'eq-bloque-icono eq-bloque-icono-x', type: 'button', title: 'Quitar bloque', 'aria-label': 'Quitar bloque',
          onClick: () => quitaBloque(i),
        }, icon(ICO.quitar, { size: 15 })),
      ),
    );

    if (soloLectura) { fila.classList.add('eq-bloque-ro'); return fila; }

    // arrastrar para reordenar: el asa evita que arrastrar sobre el input
    // de minutos se coma el gesto de seleccionar texto.
    const asa = h('span', {
      class: 'eq-bloque-asa', title: 'Arrastra para reordenar', 'aria-hidden': 'true',
      onMousedown: () => { fila.draggable = true; },
      onMouseup: () => { fila.draggable = false; },
    }, icon(ICO.arrastrar, { size: 16 }));
    fila.prepend(asa);

    fila.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', b.uid);   // Firefox no arranca sin datos
      fila.classList.add('is-arrastrando');
      ordenAntesDeArrastrar = bloques.map((x) => x.uid);
    });
    fila.addEventListener('dragend', (e) => {
      fila.classList.remove('is-arrastrando');
      fila.draggable = false;
      // Arrastre CANCELADO (Escape, o soltar fuera de la lista): el navegador
      // no deshace nada porque los nodos los movió dragover a mano, así que
      // el cambio se quedaba puesto y se daba por bueno. Se restaura.
      if (e.dataTransfer?.dropEffect === 'none' && ordenAntesDeArrastrar) {
        const porUid = new Map(bloques.map((x) => [x.uid, x]));
        bloques = ordenAntesDeArrastrar.map((u) => porUid.get(u)).filter(Boolean);
        ordenAntesDeArrastrar = null;
        pintaBloques();
        return;
      }
      ordenAntesDeArrastrar = null;
      sincronizaOrdenDesdeDOM();
    });
    return fila;
  }

  /** Tras soltar, el DOM manda: se reordena el array para que case. */
  function sincronizaOrdenDesdeDOM() {
    const orden = [...nodoBloques.querySelectorAll('.eq-bloque')].map((el) => el.dataset.uid);
    const mismo = orden.length === bloques.length && orden.every((u, i) => bloques[i].uid === u);
    if (mismo) return;
    const porUid = new Map(bloques.map((b) => [b.uid, b]));
    bloques = orden.map((u) => porUid.get(u)).filter(Boolean);
    marcaSucio();
    pintaBloques();
  }

  const tieneNotas = (b) => !!String(b?.notas || '').trim();

  /** Enciende o apaga el ✎ de la fila SIN repintar la lista: repintar
   *  mientras se escribe en el visor robaría el cursor del textarea. */
  function refrescaMarcaNotas(b) {
    const cab = nodoBloques.querySelector(`.eq-bloque[data-uid="${b.uid}"] .eq-bloque-cab`);
    if (!cab) return;
    const marca = cab.querySelector('.eq-bloque-marca');
    if (tieneNotas(b) && !marca) {
      cab.append(h('span', { class: 'eq-bloque-marca', title: 'Tiene notas para esta sesión' }, '✎'));
    } else if (!tieneNotas(b) && marca) {
      marca.remove();
    }
  }

  function pintaBloques() {
    if (!bloques.length) {
      nodoBloques.replaceChildren(h('p', { class: 'eq-ayuda' },
        'Sesión sin bloques todavía. Añade ejercicios de tu biblioteca o un bloque libre.'));
    } else {
      nodoBloques.replaceChildren(...bloques.map(filaBloque));
    }
    dibujaCurva();
  }

  function mueveBloque(i, d) {
    const j = i + d;
    if (j < 0 || j >= bloques.length) return;
    [bloques[i], bloques[j]] = [bloques[j], bloques[i]];
    marcaSucio(); pintaBloques();
    // pintaBloques() rehace la lista entera, así que el botón que se acaba de
    // pulsar deja de existir y el foco se cae al body: con teclado había que
    // volver a tabular hasta la fila para dar el segundo salto. Se devuelve el
    // foco al mismo botón de la fila, ya en su posición nueva.
    const filaNueva = nodoBloques.querySelectorAll('.eq-bloque')[j];
    filaNueva?.querySelectorAll('.eq-mov')[d > 0 ? 1 : 0]?.focus();
  }

  function quitaBloque(i) {
    const fuera = bloques[i];
    bloques.splice(i, 1);
    marcaSucio(); pintaBloques();
    if (fuera.uid === selUid) deselecciona();
  }

  function duplicaBloque(i) {
    // sin id: es un bloque NUEVO, no el mismo dos veces (guardarBloques
    // hace UPDATE por id y el original se perdería).
    const { duracion, recortado } = ajustarADisponible(bloques, tope(), bloques[i].duracion_min);
    if (duracion <= 0) { toast(`No cabe: la sesión ya suma los ${tope()} min de pista.`, 'error'); return; }
    const copia = { ...bloques[i], id: undefined, duracion_min: duracion, uid: nuevoUid() };
    bloques.splice(i + 1, 0, copia);
    if (recortado) toast(`La copia entra con ${duracion} min: es lo que quedaba.`);
    marcaSucio(); pintaBloques(); selecciona(copia, { abrirEnMovil: false });
  }

  /**
   * Añade un bloque SIN pasarse de la hora de pista (Tramo 3.2).
   *
   * Lo que no cabe entero entra recortado y se dice; lo que no cabe
   * nada, no entra. Un plan de 110 minutos para 90 de pista no es un
   * plan: es una lista de la que alguien va a tener que tachar algo
   * con los críos ya cambiados.
   */
  function añadeBloque(b, { seleccionar = true } = {}) {
    const { duracion, recortado } = ajustarADisponible(bloques, tope(), b.duracion_min);
    if (duracion <= 0) {
      toast(`No cabe: la sesión ya suma los ${tope()} min de pista.`, 'error');
      return null;
    }
    const nuevo = { ...b, duracion_min: duracion, uid: nuevoUid() };
    bloques.push(nuevo);
    if (recortado) toast(`Entra con ${duracion} min: es lo que quedaba de los ${tope()}.`);
    marcaSucio(); pintaBloques();
    if (seleccionar) selecciona(nuevo, { abrirEnMovil: false });
    return nuevo;
  }

  /** Sesiones del equipo de las dos semanas anteriores, con sus bloques. */
  async function cargarHistorial() {
    if (!sesion?.fecha) return;
    const hasta = sesion.fecha;
    const desde = new Date(Date.parse(`${hasta}T00:00:00Z`) - 14 * 86400000).toISOString().slice(0, 10);
    const sesiones = (await getSesionesRango({ desde, hasta, teamId: sesion.team_id }))
      .filter((x) => x.id !== sessionId);
    if (!sesiones.length) return;
    const bloquesPorSesion = await getBloquesSesiones(sesiones.map((x) => x.id));
    historial = { sesiones, bloquesPorSesion };
    pintaBloques();
  }

  /* ---- vídeos como bloque del plan (Tramo 3.3) --------------------
     Dos caminos en el mismo cuadro: elegir uno de los que ya ha
     guardado el club, o pegar un enlace nuevo. El primero es el que da
     sentido al segundo — un vídeo que hay que volver a buscar cada
     martes es lo que ya se hacía por WhatsApp. */
  function abreVideos() {
    let guardados = [];
    const lista = h('div', { class: 'eq-videos-lista' },
      h('p', { class: 'eq-ayuda' }, 'Cargando los vídeos guardados…'));

    const enlace = h('input', {
      class: 'field-input', type: 'url', placeholder: 'Pega un enlace de YouTube o de TikTok',
      'aria-label': 'Enlace del vídeo',
    });
    const nombre = h('input', {
      class: 'field-input', type: 'text', placeholder: 'Cómo se llama (p. ej. «La jugada del sábado»)',
      'aria-label': 'Nombre del bloque',
    });
    const minutos = h('input', {
      class: 'field-input eq-videos-min', type: 'number', min: 1, max: 60, value: 5,
      'aria-label': 'Minutos',
    });
    const guardarTambien = h('input', { type: 'checkbox', checked: true });
    const aviso = h('p', { class: 'eq-videos-aviso' });

    async function pintaLista() {
      guardados = await getVideosGuardados();
      if (!guardados.length) {
        lista.replaceChildren(h('p', { class: 'eq-ayuda' },
          'Todavía no hay vídeos guardados. El primero que guardes aquí lo tendrá todo el club.'));
        return;
      }
      lista.replaceChildren(...guardados.map((g) => h('div', { class: 'eq-videos-item' },
        h('button', {
          class: 'eq-videos-elegir', type: 'button',
          onClick: () => { meter(bloqueDeVideo(g)); },
        },
          h('span', { class: 'eq-videos-nombre' }, g.titulo),
          h('span', { class: 'eq-videos-meta' },
            [g.video.tipo === 'tiktok' ? 'TikTok' : 'YouTube', textoTramo(g.video), g.duracion_min ? `${g.duracion_min}′` : null]
              .filter(Boolean).join(' · ')),
        ),
        h('button', {
          class: 'eq-videos-icono', type: 'button', title: 'Verlo', 'aria-label': `Ver ${g.titulo}`,
          onClick: () => abrirVideo(g.video, { titulo: g.titulo }),
        }, '▶'),
        h('button', {
          class: 'eq-videos-icono eq-videos-x', type: 'button', title: 'Quitar de la lista', 'aria-label': `Quitar ${g.titulo} de la lista`,
          onClick: async () => {
            try {
              const fuera = await borrarVideoBloque(g.id);
              if (!fuera) { toast('Lo guardó otro entrenador: solo puede quitarlo quien lo guardó, o un administrador.', 'error'); return; }
              pintaLista();
            } catch (e) { toast(`No se pudo quitar: ${e.message}`, 'error'); }
          },
        }, '×'),
      )));
    }

    /** Mete el bloque en el plan y cierra. El tope de 3.2 sigue mandando. */
    const meter = (b) => { if (añadeBloque(b)) md.cerrar(); };

    async function nuevo() {
      aviso.textContent = '';
      const v = leerVideo(enlace.value);
      if (!v) { aviso.textContent = 'No se reconoce ese enlace. Tiene que ser de YouTube o de TikTok.'; return; }
      const titulo = nombre.value.trim() || 'Vídeo';
      const dur = Math.max(1, Math.min(60, Number(minutos.value) || 5));

      if (guardarTambien.checked) {
        /* Guardar puede fallar —sin migración, sin red— y eso NO debe
           impedir meter el vídeo en el plan de hoy: son dos cosas
           distintas y la urgente es la del martes. */
        try {
          await guardarVideoBloque({ titulo, video: v, duracion_min: dur });
        } catch (e) {
          toast(`El bloque entra, pero no se ha podido guardar para reutilizar: ${e.message}`, 'error');
        }
      }
      meter(bloqueDeVideo({ titulo, video: v, duracion_min: dur }, dur));
    }

    const md = modalPicker = abrirModal({
      titulo: 'Vídeo como bloque',
      clase: 'modal-videos',
      cuerpo: h('div', { class: 'eq-videos' },
        h('div', { class: 'eq-videos-col' },
          h('h4', { class: 'eq-vsec-t' }, 'Guardados del club'),
          lista,
        ),
        h('div', { class: 'eq-videos-col' },
          h('h4', { class: 'eq-vsec-t' }, 'Uno nuevo'),
          enlace,
          nombre,
          h('div', { class: 'eq-videos-fila' },
            h('label', { class: 'eq-videos-lbl' }, minutos, 'min'),
            h('label', { class: 'eq-videos-lbl' }, guardarTambien, 'Guardar para reutilizar'),
            h('button', { class: 'btn btn-primary', type: 'button', onClick: nuevo }, 'Añadir al plan'),
          ),
          h('p', { class: 'eq-ayuda' }, 'De YouTube se puede pegar el enlace de «compartir a partir de aquí» y se queda con el segundo de entrada. Un vídeo ocupa minutos de pista y no cuenta como minutos activos: nadie entrena mirando.'),
          aviso,
        ),
      ),
      alCerrar: () => { modalPicker = null; },
    });
    pintaLista();
    enlace.focus();
  }

  // ── picker de ejercicios ───────────────────────────────────
  function abrePicker() {
    const objsSesion = objetivosEquipo.filter((o) => objetivosSel.has(o.id));
    const pista = objsSesion.map((o) => `${o.titulo} ${o.descripcion || ''}`).join(' ');
    const tipos = [...new Set(biblioteca.map((e) => e.type).filter(Boolean))].sort();

    let q = '', tipo = null, añadidos = 0;
    let listaEl, contadorEl, selId = null;
    const previo = crearVisor({ soloLectura: true });

    /**
     * Devuelve DOS listas: los que casan con los objetivos y el resto.
     * sugerirEjercicios() puntúa y DESCARTA lo que baja de 2 puntos, así
     * que usarlo tal cual escondía media biblioteca sin decirlo (con un
     * objetivo de tiro, un ejercicio de bote desaparecía). Aquí el
     * ranking solo decide el ORDEN: nada se esconde, y la frontera entre
     * "esto va con tus objetivos" y "esto es lo demás" se ve.
     */
    /* El filtro por grupo esconde SOLO lo que no se puede montar con
       los que vienen: no llegar al mínimo (un 5c5 con seis no es un
       5c5). Pasarse del máximo no esconde nada —se hace cola, y los
       minutos activos ya lo penalizan—. Y se puede apagar (§6). */
    const conGrupo = (l) => (filtrarPorGrupo && jugadores()
      ? l.filter((e) => cabeEnGrupo(e.requisitos, jugadores()))
      : l);
    const escondidos = () => (filtrarPorGrupo && jugadores()
      ? biblioteca.length - conGrupo(biblioteca).length
      : 0);

    const filtra = () => {
      const porTipo = (l) => conGrupo(tipo ? l.filter((e) => e.type === tipo) : l);
      const term = normaliza(q);
      if (term) {
        return {
          sugeridos: [],
          resto: porTipo(biblioteca.filter((e) =>
            normaliza(e.name).includes(term)
            || (e.tags || []).some((t) => normaliza(t).includes(term))
            || normaliza(e.type || '').includes(term))),
        };
      }
      if (!pista) return { sugeridos: [], resto: porTipo(biblioteca.slice()) };
      const ranking = sugerirEjercicios(
        { titulo: pista, categoria: objsSesion[0]?.categoria }, biblioteca, { limite: 999 },
      ).map((x) => x.ejercicio);
      const yaEstan = new Set(ranking.map((e) => e.id));
      return {
        sugeridos: porTipo(ranking),
        resto: porTipo(biblioteca.filter((e) => !yaEstan.has(e.id))),
      };
    };

    const añade = (e) => {
      /* La duración que se propone sale de lo que DE VERDAD ha durado
         las últimas veces (Tramo 3.6); solo si nunca se ha dado manda
         lo que estimó la ficha. */
      const p = duracionPropuesta(reales[e.id], e.duration_min);
      añadeBloque({
        exercise_id: e.id, titulo: e.name,
        duracion_min: p.minutos || 10,
        intensidad: e.intensidad || 3, notas: null,
      }, { seleccionar: false });
      añadidos++;
      pintaContador(listaEl.querySelectorAll('.eq-picker-item').length);
      toast(`+ ${e.name}`);
    };

    const previsualiza = (e) => {
      selId = e.id;
      for (const el of listaEl.querySelectorAll('.eq-picker-item')) {
        el.classList.toggle('is-sel', el.dataset.id === e.id);
      }
      previo.mostrar({
        uid: 'preview', exercise_id: e.id, titulo: e.name,
        duracion_min: e.duration_min || 10, intensidad: e.intensidad || 3, notas: null,
      });
      botonAñadir.disabled = false;
      botonAñadir.dataset.id = e.id;
    };

    const botonAñadir = h('button', {
      class: 'btn btn-primary eq-picker-add', type: 'button', disabled: true,
      onClick: () => { const e = biblioteca.find((x) => x.id === botonAñadir.dataset.id); if (e) añade(e); },
    }, 'Añadir al plan');

    const pintaLista = () => {
      const { sugeridos, resto } = filtra();
      if (!sugeridos.length && !resto.length) {
        listaEl.replaceChildren(h('p', { class: 'eq-ayuda' },
          'Sin ejercicios que casen. Prueba otra palabra, quita el filtro de tipo o añade un bloque libre.'));
        contadorEl.textContent = '0 ejercicios';
        return;
      }
      const separador = (txt) => h('p', { class: 'eq-picker-sep' }, txt);
      listaEl.replaceChildren(
        ...(sugeridos.length ? [separador('Van con los objetivos de la sesión')] : []),
        ...sugeridos.map(item),
        ...(resto.length && sugeridos.length ? [separador('El resto de tu biblioteca')] : []),
        ...resto.map(item),
      );
      pintaContador(sugeridos.length + resto.length);
    };

    /** Cuántos hay a la vista y cuántos llevas metidos en el plan. */
    const pintaContador = (n) => {
      const cuantos = `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`;
      contadorEl.textContent = añadidos
        ? `${añadidos} ${añadidos === 1 ? 'bloque añadido' : 'bloques añadidos'} · ${cuantos}`
        : cuantos;
    };

    const item = (e) => h('div', {
        class: 'eq-picker-item' + (e.id === selId ? ' is-sel' : ''),
        dataset: { id: e.id }, role: 'button', tabindex: '0',
        onClick: () => previsualiza(e),
        onDblclick: () => añade(e),
        onKeydown: (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); previsualiza(e); }
        },
      },
        h('div', { class: 'eq-picker-txt' },
          h('span', { class: 'eq-picker-nombre' }, e.name),
          (() => {
            const p = duracionPropuesta(reales[e.id], e.duration_min);
            return h('span', { class: 'eq-picker-meta' + (p.origen === 'real' ? ' es-real' : '') },
              [e.type, p.minutos ? `${p.minutos}′${p.origen === 'real' ? ' reales' : ''}` : null,
               e.intensidad ? `int ${e.intensidad}` : null].filter(Boolean).join(' · '));
          })(),
        ),
        h('button', {
          class: 'eq-picker-mas', type: 'button', title: 'Añadir al plan', 'aria-label': `Añadir ${e.name} al plan`,
          onClick: (ev) => { ev.stopPropagation(); añade(e); },
        }, '+'),
      );

    const buscador = h('input', {
      class: 'field-input', type: 'search', placeholder: 'Buscar en tu biblioteca…',
      'aria-label': 'Buscar ejercicio',
      onInput: (e) => { q = e.target.value; pintaLista(); },
    });

    const chipsTipo = h('div', { class: 'eq-picker-tipos' },
      ...tipos.map((t) => h('button', {
        class: 'eq-picker-tipo', type: 'button', dataset: { tipo: t },
        onClick: (ev) => {
          tipo = tipo === t ? null : t;
          for (const c of chipsTipo.children) c.classList.toggle('is-on', c.dataset.tipo === tipo);
          pintaLista();
        },
      }, t)));

    contadorEl = h('span', { class: 'eq-picker-contador' });

    /* Desactivable a propósito: el entrenador puede estar montando el
       plan de un día en el que todavía no sabe cuántos vienen, o
       queriendo ver la biblioteca entera. Y se dice CUÁNTOS esconde,
       que es la diferencia entre un filtro y una desaparición. */
    const filtroGrupo = jugadores() ? h('label', { class: 'eq-picker-grupo' },
      h('input', {
        type: 'checkbox', checked: filtrarPorGrupo,
        onChange: (ev) => { filtrarPorGrupo = ev.target.checked; pintaLista(); pintaEscondidos(); },
      }),
      h('span', null, `Solo lo que se puede montar con ${jugadores()}`),
      h('span', { class: 'eq-picker-escondidos' }),
    ) : null;
    const pintaEscondidos = () => {
      if (!filtroGrupo) return;
      const n = escondidos();
      filtroGrupo.querySelector('.eq-picker-escondidos').textContent = n
        ? `— ${n} ${n === 1 ? 'escondido' : 'escondidos'}`
        : '';
    };

    const md = modalPicker = abrirModal({
      titulo: 'Añadir ejercicios',
      clase: 'modal-picker',
      cuerpo: h('div', { class: 'eq-picker' },
        h('div', { class: 'eq-picker-col' },
          buscador,
          filtroGrupo,
          tipos.length ? chipsTipo : null,
          listaEl = h('div', { class: 'eq-picker-lista' }),
          contadorEl,
        ),
        h('div', { class: 'eq-picker-previo' }, previo.el, botonAñadir),
      ),
      pie: [
        h('button', {
          class: 'btn btn-secondary', type: 'button',
          onClick: () => {
            añadeBloque({ exercise_id: null, titulo: '', duracion_min: 10, intensidad: 3, notas: null });
            md.cerrar();
          },
        }, '+ Bloque libre'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => md.cerrar() }, 'Listo'),
      ],
      alCerrar: () => { modalPicker = null; previo.destroy(); },
    });
    pintaLista();
    pintaEscondidos();
    buscador.focus();
  }

  // ── objetivos ──────────────────────────────────────────────
  /* ---- «qué vigilar hoy» (Tramo 3.9, §6) --------------------------
     Una o dos líneas por objetivo de la sesión. No es un resumen del
     objetivo: es lo que hay que MIRAR en la pista, con nombres. «Vigila
     la entrada, sobre todo en Ana y Bruno» sirve; «objetivo: mejorar la
     entrada» no. */
  const nodoVigilar = h('div', { class: 'eq-vigilar' });
  function pintaVigilar() {
    const elegidos = objetivosEquipo.filter((o) => objetivosSel.has(o.id));
    if (!elegidos.length) { nodoVigilar.replaceChildren(); return; }

    const filas = filasDeRubrica();
    const nombreDe = (c) => filas.find((f) => f.clave === c)?.nombre || c.split(':')[1];
    const panel = queVigilarHoy(elegidos, {
      jugadores: plantillaEq.map((j) => ({ id: j.id, nombre: j.nombre })),
      porJugador: rubrica,
      nombreDe,
    });

    nodoVigilar.replaceChildren(
      h('h3', { class: 'eq-vigilar-t' }, 'Qué vigilar hoy'),
      ...panel.map(({ objetivo, lineas }) => h('div', { class: 'eq-vigilar-obj' },
        h('strong', null, objetivo.titulo),
        ...lineas.map((l) => h('p', { class: 'eq-vigilar-l' }, l)),
      )),
    );
  }

  function seccionObjetivos() {
    const cubren = new Set(objetivosEnFecha(sesion.fecha, objetivosEquipo).map((o) => o.id));
    const activos = objetivosEquipo.filter((o) => o.estado !== 'archivado');
    if (!activos.length) {
      return h('div', { class: 'eq-planner-obj' },
        h('p', { class: 'eq-ayuda' },
          'Este equipo no tiene objetivos. Créalos en la ficha del equipo o desde el calendario.'));
    }
    activos.sort((a, b) => (cubren.has(b.id) ? 1 : 0) - (cubren.has(a.id) ? 1 : 0));
    return h('div', { class: 'eq-planner-obj' },
      ...activos.map((o) => {
        const id = `obj-${o.id}`;
        return h('label', { class: 'eq-obj-check', for: id },
          h('input', {
            id, type: 'checkbox', checked: objetivosSel.has(o.id), disabled: soloLectura,
            onChange: (e) => { e.target.checked ? objetivosSel.add(o.id) : objetivosSel.delete(o.id); marcaSucio(); pintaVigilar(); },
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
    const [, m, d] = sesion.fecha.split('-').map(Number);
    const fechaTxt = `${WEEKDAYS[isoWeekday(sesion.fecha) - 1].nombre} ${d} de ${MESES[m - 1]}`;
    const horaTxt = [hhmm(sesion.hora_inicio) && `${hhmm(sesion.hora_inicio)}–${hhmm(sesion.hora_fin)}`, sesion.lugar]
      .filter(Boolean).join(' · ');

    mount(cont,
      h('div', { class: 'eq-planner-top' },
        enlaceGuardado(`/sesiones?equipo=${sesion.team_id}`, '‹ Calendario', 'eq-volver'),
        h('div', { class: 'eq-planner-top-der' },
          nodoEstado,
          h('span', { class: `eq-estado-badge eq-ses-${sesion.estado}` }, ESTADOS_SESION[sesion.estado]),
        ),
      ),
      h('div', { class: 'view-hero eq-planner-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, puntoEquipo(color), ' ', nombreEquipo),
          h('h1', { class: 'display view-title' }, fechaTxt),
          horaTxt ? h('p', { class: 'view-meta' }, horaTxt) : null,
        ),
      ),

      h('div', { class: 'eq-planner-grid' },
        h('div', { class: 'eq-planner-col' },
          h('div', { class: 'field-group eq-planner-titulo' },
            h('label', { class: 'field-label', for: 'ses-titulo' },
              'Título de la sesión (opcional — si lo dejas vacío, hereda de los objetivos)'),
            h('input', {
              id: 'ses-titulo', class: 'field-input', type: 'text', value: titulo, readOnly: soloLectura,
              placeholder: 'p. ej. Salida de presión + tiro tras bote',
              onInput: (e) => { titulo = e.target.value; marcaSucio(); },
            }),
          ),

          h('section', { class: 'eq-planner-seccion' },
            h('h2', { class: 'eq-zona-titulo' }, 'Objetivos de la sesión'),
            seccionObjetivos(),
            nodoVigilar,
          ),

          h('section', { class: 'eq-planner-seccion' },
            h('div', { class: 'eq-zona-head' },
              h('h2', { class: 'eq-zona-titulo' }, 'Bloques'),
              soloLectura ? null : h('div', { class: 'eq-zona-acciones' },
                h('button', {
                  class: 'btn btn-secondary btn-sm', type: 'button',
                  onClick: () => añadeBloque({ exercise_id: null, titulo: '', duracion_min: 10, intensidad: 3, notas: null }),
                }, '+ Bloque libre'),
                // El agua ocupa pista y no entrena a nadie. Tenerla como
                // botón la mete en el plan en vez de dejarla de propina
                // sobre los 90 minutos (§6).
                h('button', {
                  class: 'btn btn-secondary btn-sm', type: 'button',
                  title: 'Tres minutos de agua. Cuentan de pista y no cuentan como minutos activos.',
                  onClick: () => añadeBloque(bloqueAgua(), { seleccionar: false }),
                }, '+ Agua'),
                h('button', {
                  class: 'btn btn-secondary btn-sm', type: 'button',
                  title: 'Un vídeo de YouTube o TikTok como bloque del plan',
                  onClick: abreVideos,
                }, '+ Vídeo'),
                h('button', { class: 'btn btn-primary btn-sm', type: 'button', onClick: abrePicker }, '+ Ejercicios'),
              ),
            ),
            nodoBloques,
          ),

          h('section', { class: 'eq-planner-seccion' },
            h('h2', { class: 'eq-zona-titulo' }, 'Cuánto entrena cada uno'),
            nodoJugadores,
            nodoTotales,
            nodoNotaMinutos,
            nodoCurva,
          ),

          h('section', { class: 'eq-planner-seccion' },
            h('h2', { class: 'eq-zona-titulo' }, 'Material'),
            nodoMaterial,
          ),

          barraAcciones(),
        ),
        anfitrionVisor,
      ),
    );
    pintaBloques();
    pintaEstadoGuardado();
    pintaVigilar();
  }

  function barraAcciones() {
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
            const motivo = await pedirTexto({
              titulo: 'Cancelar sesión', etiqueta: 'Motivo (obligatorio)',
              placeholder: 'Lluvia, pabellón cerrado…',
            });
            if (!motivo) return;
            try {
              await cancelarSesion(sessionId, motivo);
              sucio = false; toast('Sesión cancelada');
              router.navigate(`/sesiones?equipo=${sesion.team_id}`);
            } catch (e) { toast('Error: ' + e.message, 'error'); }
          },
        }, 'Cancelar sesión') : null,
        sesion.fecha <= hoyISO() ? h('button', {
          class: 'btn btn-secondary', type: 'button', onClick: irCierre,
        }, 'Pasar lista') : null,
      ),
      /* Con la sesión ocurriendo, guardar el plan deja de ser lo
         principal: lo que se quiere es empezar (Tramo 3.5). */
      esActiva(sesion) ? h('button', {
        class: 'btn btn-primary eq-planner-guardar', type: 'button',
        onClick: async () => { await guardar({ callado: true }); salir(`/sesiones/${sessionId}/activa`); },
      }, 'Entrenar ahora') : null,
      h('button', {
        class: `btn ${esActiva(sesion) ? 'btn-secondary' : 'btn-primary'} eq-planner-guardar`, type: 'button', onClick: guardar,
      }, esPreliminar ? 'Guardar y confirmar' : 'Guardar plan'),
    );
  }

  /**
   * @param opts.callado  guarda sin avisar ni navegar. Lo usa «Entrenar
   *   ahora»: ahí guardar es un trámite de camino a otra pantalla, y
   *   mandar al calendario en medio sería tirar al entrenador fuera.
   */
  async function guardar({ callado = false } = {}) {
    if (soloLectura) return true;
    const libreSinTitulo = bloques.find((b) => !b.exercise_id && !(b.titulo || '').trim());
    if (libreSinTitulo) { toast('Un bloque libre está sin título', 'error'); return false; }
    const esPreliminar = sesion.estado === 'preliminar';
    try {
      await guardarBloques(sessionId, bloques);
      await guardarObjetivosSesion(sessionId, [...objetivosSel]);
      await guardarCabeceraSesion(sessionId, { titulo });
      if (esPreliminar) await promoverSesion(sessionId);
      sucio = false;
      if (callado) return true;
      toast(esPreliminar ? 'Sesión planificada y confirmada' : 'Plan guardado');
      router.navigate(`/sesiones?equipo=${sesion.team_id}`);
      return true;
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
      return false;
    }
  }

  // arrastrar y soltar sobre la lista (delegado: sobrevive al re-pintado)
  nodoBloques.addEventListener('dragover', (e) => {
    const movido = nodoBloques.querySelector('.is-arrastrando');
    if (!movido) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const ref = nodoTrasCursor(nodoBloques, e.clientY);
    if (ref === movido) return;
    if (ref) nodoBloques.insertBefore(movido, ref);
    else nodoBloques.append(movido);
  });
  nodoBloques.addEventListener('drop', (e) => { e.preventDefault(); sincronizaOrdenDesdeDOM(); });

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
      bloques = blks.map((b) => ({ ...b, uid: nuevoUid() }));
      objetivosSel = new Set(objsSes);

      let plantilla = [];
      [objetivosEquipo, biblioteca, plantilla] = await Promise.all([
        getObjetivos(sesion.team_id, sesion.season_id),
        getEjerciciosSugeribles().catch(() => []),
        // sin plantilla el plan se sigue haciendo: los minutos activos
        // salen solo de la densidad y la pantalla lo dice
        getJugadores(sesion.team_id).catch(() => []),
      ]);
      jugadoresEquipo = plantilla.length || null;
      plantillaEq = plantilla;

      // la rúbrica llega suelta: sin ella el panel dice que no hay nada
      getRubricaEquipo(plantilla.map((j) => j.id))
        .then((r) => { rubrica = r || {}; pintaVigilar(); })
        .catch(() => {});

      /* Lo que este equipo ha entrenado en las dos semanas anteriores,
         para el aviso «esto ya lo hiciste el martes» (Tramo 3.2). Va
         suelto y sin bloquear el pintado: si falla, el plan se escribe
         igual y simplemente no hay aviso. */
      cargarHistorial().catch(() => {});

      /* Y lo que de verdad han durado los ejercicios de este equipo
         (Tramo 3.6). También suelto: si falla, se propone lo de la
         ficha y no se entera nadie. */
      getDuracionesReales({ teamId: sesion.team_id })
        .then((d) => { reales = d || {}; dibujaCurva(); })
        .catch(() => {});
      porId = new Map(biblioteca.map((e) => [e.id, e]));

      // pre-marca los objetivos que cubren la fecha SOLO si la sesión nunca se
      // planificó (sin bloques ni congelados previos). Así "0 objetivos" tras
      // guardar es una elección deliberada que no se re-autorrellena al reabrir;
      // cubre también las sesiones manuales (nacen 'programada', no 'preliminar').
      if (!objetivosSel.size && !bloques.length) {
        for (const o of objetivosEnFecha(sesion.fecha, objetivosEquipo)) objetivosSel.add(o.id);
      }
      pinta();
      // arrancar con el primer bloque puesto ahorra un clic y explica el panel
      if (bloques.length && hayHueco()) selecciona(bloques[0], { abrirEnMovil: false });
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir la sesión'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/sesiones', 'data-link': true }, 'Volver al calendario')));
    }
  })();

  return {
    // Los modales cuelgan de <body>, no de #app: el router solo vacía #app, así
    // que si no se cierran aquí, volver atrás con el picker abierto dejaba un
    // telón fijo tapando el calendario, con su Escape y su segundo visor
    // (CourtView + motor a 60 fps) vivos para siempre.
    destroy() {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('resize', alRedimensionar);
      modalPicker?.cerrar?.();
      modalVisor?.cerrar?.();
      visor.destroy();
    },
  };
}
