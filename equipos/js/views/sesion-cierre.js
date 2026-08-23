/* ============================================================
   sesion-cierre.js — /sesiones/:sessionId/cierre · post-sesión.
   Pasar lista (snapshot denso) + reflexión (plantilla del equipo)
   + resumen del plan. "Guardar y cerrar" marca la sesión realizada.
   Una sesión CANCELADA no se cierra: la BD lo rechaza y aquí ni se
   ofrece (solo lectura).
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { confirmar } from '../ui/modal.js';
import { puntoEquipo, avatar, estrellas } from '../ui/components.js';
import { getMisEquipos, getEquipo } from '../data/teams.js';
import { getJugadores } from '../data/players.js';
import { getSesion, marcarRealizada, promoverSesion } from '../data/sessions.js';
import { getAsistencia, guardarAsistencia } from '../data/attendance.js';
import { getPreguntas, getRespuestas, guardarRespuestas, restaurarPlantilla } from '../data/reflection.js';
import { getBloques, getObjetivosSesion } from '../data/blocks.js';
import { getObjetivos } from '../data/objectives.js';
import {
  ESTADOS_ASISTENCIA, filasDensas, resumenAsistencia, filasParaGuardar, hayCambios,
} from '../data/asistencia.js';
import {
  plantillaEfectiva, filasRespuesta, mediaEstrellas, ESTRELLAS_MAX, ESTRELLA_LABEL,
  itemsDeJugador, faltaEsfuerzo, CLAVE_ESFUERZO,
} from '../data/reflexion.js';
import { curvaCarga, INTENSIDAD_MAX } from '../data/carga.js';
import { minutosDeSesion, textoMinutos } from '../data/minutos.js';
import { getRubricaEquipo, getFilasClub, valorar } from '../data/rubrica.js';
import { claveAccion } from '../../../taller/js/rubrica.js';
import {
  NIVELES, filasDeRubrica, estadoDe, movimiento, ordenSugerido,
  textoSinMirar, porDondeEmpezar,
} from '../../../taller/js/rubrica.js';
import { getEjerciciosSugeribles } from '../data/objectives.js';
import { ESTADOS_SESION, WEEKDAYS } from '../config.js';
import { router } from '../main.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const isoWeekday = (iso) => { const d = new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay(); return d === 0 ? 7 : d; };
const hhmm = (t) => (t ? t.slice(0, 5) : '');
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Estrellas 1-5 con las etiquetas de la reflexión (widget en components.js). */
const estrellasSelector = (valor, onChange, { soloLectura = false } = {}) =>
  estrellas(valor, onChange, { max: ESTRELLAS_MAX, labels: ESTRELLA_LABEL, soloLectura });

export function render(root, params) {
  const sessionId = params.sessionId;
  const cont = h('div', { class: 'eq-page eq-cierre' });
  mount(root, cont);

  let sesion = null, color = 'var(--muted)', nombreEquipo = '—';
  let ajustes = { asistencia_activa: true, reflexion_activa: true };
  let jugadores = [], filasBD = [], densas = [];
  let preguntas = [], items = [];
  /* ¿Hay ya algo guardado de esta sesión? Cambia lo que dicen los
     botones: «Guardar» promete crear algo, y cuando ya existe lo que
     de verdad se está haciendo es EDITAR lo guardado. Decirlo mal es
     lo que hace dudar de si se va a duplicar o a machacar. */
  let yaGuardado = false;
  let bloques = [], objetivosSesion = [];
  let itemsJug = [];   // preguntas de jugador (Tramo 3.11)
  /* Requisitos de las fichas del plan (Tramo 3.1). Aquí los minutos
     activos se calculan con la asistencia REAL —los que de verdad
     entrenaron—, así que este es el número más honesto de los tres
     sitios donde aparece. La consulta es la lista ligera de la
     biblioteca, que ya viene cacheada del planificador. */
  let requisitosPorEjercicio = new Map();
  let tagsPorEjercicio = new Map();

  /* La rúbrica al cerrar (Tramo 3.7). `porGuardar` son los toques que
     todavía no han salido: se mandan de una tacada, porque una petición
     por toque haría el pabellón insoportable. */
  let rubricaEquipo = {};      // player_id → serie
  let filasClub = [];          // las que ha añadido el club
  let rubAbierto = null;       // qué jugador está desplegado
  let rubExtra = new Set();    // filas añadidas a mano a la lista corta
  let porGuardar = {};         // `player|clave` → nivel
  let soloLectura = false;      // cancelada = no se cierra ni se pasa lista
  let sucio = false;
  const marcaSucio = () => { sucio = true; };

  const nodoLista = h('div', { class: 'eq-as-lista' });
  const nodoResumen = h('div', { class: 'eq-as-resumen' });

  const onBeforeUnload = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  const salir = (destino) => {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir y descartarlos?')) return false;
    sucio = false; router.navigate(destino); return true;
  };
  /**
   * Enlace interno que PASA por el guardián. Un `<a data-link>` pelado lo
   * esquiva: el router hace pushState y ni `salir()` ni `beforeunload` se
   * enteran, así que la lista y la reflexión sin guardar se evaporaban de
   * un clic. Todo enlace que salga de esta vista debe usar esto.
   */
  const enlaceGuardado = (destino, texto, clase) => h('a', {
    class: clase, href: destino,
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); salir(destino); },
  }, texto);

  // ── Asistencia ─────────────────────────────────────────────
  function actualizaResumen() {
    const r = resumenAsistencia(densas);
    // mount y NO nodoResumen.replaceChildren: con todos presentes, las tres
    // últimas líneas valen null y el nativo las pintaba como texto "null".
    mount(nodoResumen,
      h('div', { class: 'eq-carga-dato' },
        h('span', { class: 'eq-carga-num' }, `${r.entrenaron}/${r.total}`),
        h('span', { class: 'eq-carga-lbl' }, 'entrenaron')),
      h('div', { class: 'eq-carga-dato' },
        h('span', { class: 'eq-carga-num' }, `${r.pct}%`),
        h('span', { class: 'eq-carga-lbl' }, 'asistencia')),
      r.justificadas ? h('div', { class: 'eq-carga-dato' },
        h('span', { class: 'eq-carga-num' }, String(r.justificadas)),
        h('span', { class: 'eq-carga-lbl' }, 'faltas avisadas')) : null,
      r.ausente ? h('div', { class: 'eq-carga-dato' },
        h('span', { class: 'eq-carga-num' }, String(r.ausente)),
        h('span', { class: 'eq-carga-lbl' }, 'sin avisar')) : null,
      // el estado por defecto ("todos presentes") es una PROPUESTA, no un dato
      // guardado: se dice claramente para que nadie se vaya creyendo que ya está
      estadoLista() ? h('span', { class: 'eq-as-pendiente' }, estadoLista()) : null,
    );
  }

  const estadoLista = () => {
    if (soloLectura || !densas.length) return null;
    if (!filasBD.length) return 'Lista sin pasar';
    return hayCambios(densas, filasBD) ? 'Cambios sin guardar' : null;
  };

  function filaAsistencia(f) {
    const motivoEl = h('input', {
      class: 'field-input eq-as-motivo', type: 'text', value: f.motivo || '',
      placeholder: 'Motivo (opcional)', 'aria-label': `Motivo de ${f.nombre}`,
      readOnly: soloLectura,
      onInput: (e) => { f.motivo = e.target.value; marcaSucio(); },
    });
    // se muestra en cuanto el jugador no está "presente"; no se re-pinta la
    // fila al cambiar de estado (perdería el foco de este mismo input)
    const syncMotivo = () => { motivoEl.style.display = f.estado === 'presente' ? 'none' : ''; };

    const botones = ESTADOS_ASISTENCIA.map((e) => h('button', {
      class: `eq-as-seg tono-${e.tono}` + (f.estado === e.clave ? ' on' : ''),
      type: 'button', role: 'radio', 'aria-checked': String(f.estado === e.clave),
      'aria-label': `${f.nombre}: ${e.nombre}`, title: e.nombre, disabled: soloLectura,
      onClick: () => {
        f.estado = e.clave;
        // volver a "presente" borra el motivo: si no, quedaría guardado un
        // «médico» invisible en la fila de alguien que sí entrenó
        if (f.estado === 'presente' && f.motivo) { f.motivo = null; motivoEl.value = ''; }
        botones.forEach((b, i) => {
          b.classList.toggle('on', ESTADOS_ASISTENCIA[i].clave === f.estado);
          b.setAttribute('aria-checked', String(ESTADOS_ASISTENCIA[i].clave === f.estado));
        });
        syncMotivo(); marcaSucio(); actualizaResumen();
      },
    }, e.corto));

    syncMotivo();
    return h('div', { class: 'eq-as-fila' + (f.esBaja ? ' atenuado' : '') },
      avatar(f.nombre, color, 30),
      h('span', { class: 'eq-jugador-dorsal' }, f.dorsal != null ? String(f.dorsal) : '·'),
      h('div', { class: 'eq-as-datos' },
        h('span', { class: 'eq-jugador-nombre' },
          f.nombre,
          f.esBaja ? h('span', { class: 'eq-obj-badge' }, 'baja') : null),
        motivoEl,
      ),
      h('div', { class: 'eq-as-segmentado', role: 'radiogroup', 'aria-label': `Asistencia de ${f.nombre}` }, ...botones),
    );
  }

  function pintaLista() {
    nodoLista.replaceChildren(...densas.map(filaAsistencia));
    actualizaResumen();
  }

  function seccionAsistencia() {
    if (!jugadores.length) {
      return h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'Sin plantilla'),
        h('p', {}, 'Añade jugadores al equipo para poder pasar lista.'),
        enlaceGuardado(`/equipos/${sesion.team_id}?tab=plantilla`, 'Ir a la plantilla', 'btn btn-secondary'));
    }
    return h('div', {},
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, 'Asistencia'),
        soloLectura ? null : h('button', {
          class: 'btn btn-secondary eq-btn-mini', type: 'button',
          onClick: () => {
            densas.forEach((f) => { f.estado = 'presente'; f.motivo = null; });
            marcaSucio(); pintaLista();
          },
        }, 'Todos presentes'),
      ),
      nodoResumen,
      nodoLista,
    );
  }

  // ── Reflexión ──────────────────────────────────────────────
  function seccionReflexion() {
    if (!items.length) {
      return h('div', { class: 'eq-reflex-vacia' },
        h('p', { class: 'eq-ayuda' }, 'Este equipo no tiene preguntas de reflexión.'),
        soloLectura ? null : h('button', {
          class: 'btn btn-secondary', type: 'button',
          onClick: async () => {
            try {
              const n = await restaurarPlantilla(sesion.team_id);
              toast(n ? `${n} preguntas restauradas` : 'La plantilla ya estaba completa');
              preguntas = await getPreguntas(sesion.team_id);
              items = plantillaEfectiva(preguntas, await getRespuestas(sessionId));
              pinta();
            } catch (e) { toast('Error: ' + e.message, 'error'); }
          },
        }, 'Restaurar plantilla por defecto'),
      );
    }
    return h('div', { class: 'eq-reflex' },
      ...items.map((it) => h('div', {
        class: 'eq-reflex-item' + (it.clave === CLAVE_ESFUERZO ? ' es-obligatoria' : ''),
        dataset: { clave: it.clave },
      },
        h('label', { class: 'field-label eq-reflex-label' },
          it.etiqueta,
          it.clave === CLAVE_ESFUERZO ? h('span', { class: 'required' }, ' *') : null,
          it.huerfana ? h('span', { class: 'eq-obj-badge' }, 'ya no se pregunta') : null,
        ),
        it.tipo === 'estrellas'
          ? estrellasSelector(it.valor_num, (v) => { it.valor_num = v; marcaSucio(); }, { soloLectura })
          : h('textarea', {
              class: 'field-textarea', rows: 2, readOnly: soloLectura,
              placeholder: 'Escribe lo que recuerdes ahora; en frío se pierde.',
              onInput: (e) => { it.valor_texto = e.target.value; marcaSucio(); },
            }, it.valor_texto || ''),
        // la pregunta cambió de formato después de responderse: se enseña lo
        // que había en vez de tragárselo (y no se borra al guardar)
        it.conflicto ? h('p', { class: 'eq-ayuda' },
          'Respuesta anterior, guardada con otro formato: ',
          h('strong', {}, it.conflicto.tipo === 'estrellas'
            ? `${it.conflicto.valor_num} de ${ESTRELLAS_MAX} ★`
            : `«${it.conflicto.valor_texto}»`),
          '. Se conserva; si respondes aquí, la sustituirás.') : null,
      )),
      enlaceGuardado(`/equipos/${sesion.team_id}?tab=ajustes`,
        'Editar las preguntas del equipo →', 'eq-ayuda eq-reflex-editar'),
    );
  }

  /* ---- preguntas de jugador (Tramo 3.11) --------------------------
     «Se valoran a jugadores sueltos, no a todos»: salen todos para
     poder elegir, y lo que no se conteste sencillamente no se guarda.
     Colapsadas por defecto — con catorce críos y dos preguntas, abrir
     el cierre y encontrarse veintiocho campos es cerrar el cierre. */
  function seccionJugadores() {
    if (!itemsJug.length) return null;
    const porPregunta = new Map();
    for (const x of itemsJug) {
      if (!porPregunta.has(x.pregunta.clave)) porPregunta.set(x.pregunta.clave, { pregunta: x.pregunta, filas: [] });
      porPregunta.get(x.pregunta.clave).filas.push(x);
    }

    return h('section', { class: 'eq-cierre-seccion' },
      h('h2', { class: 'eq-zona-titulo' }, 'De cada uno'),
      ...[...porPregunta.values()].map(({ pregunta, filas }) => {
        const contestadas = filas.filter((x) => x.item.valor_num != null || (x.item.valor_texto || '').trim()).length;
        return h('details', { class: 'eq-reflexj', ...(contestadas ? { open: true } : {}) },
          h('summary', {},
            pregunta.etiqueta,
            h('span', { class: 'eq-ayuda' }, contestadas
              ? ` · ${contestadas} contestada${contestadas === 1 ? '' : 's'}`
              : ' · de quien quieras'),
          ),
          h('div', { class: 'eq-reflexj-filas' }, ...filas.map(({ jugador, item }) => h('div', { class: 'eq-reflexj-fila' },
            h('span', { class: 'eq-reflexj-n' }, jugador.dorsal != null ? String(jugador.dorsal) : '·'),
            h('span', { class: 'eq-reflexj-nombre' }, jugador.nombre),
            pregunta.tipo === 'estrellas'
              ? estrellasSelector(item.valor_num, (v) => { item.valor_num = v; marcaSucio(); }, { soloLectura })
              : h('input', {
                  class: 'field-input', type: 'text', readOnly: soloLectura,
                  placeholder: 'Solo si hay algo que decir',
                  value: item.valor_texto || '',
                  onInput: (e) => { item.valor_texto = e.target.value; marcaSucio(); },
                }),
          ))),
        );
      }),
    );
  }

  // ── Resumen del plan (solo lectura) ────────────────────────
  function seccionPlan() {
    if (!bloques.length && !objetivosSesion.length) return null;
    const c = curvaCarga(bloques);
    /* Con la asistencia ya pasada, «cuántos había» no se estima: se
       sabe. Si todavía no se ha pasado lista, se cae a la plantilla. */
    const entrenaron = resumenAsistencia(densas).entrenaron || jugadores.length || null;
    const m = minutosDeSesion(bloques, {
      jugadores: entrenaron,
      requisitosDe: (b) => (b.exercise_id ? requisitosPorEjercicio.get(b.exercise_id) || null : null),
    });
    return h('section', { class: 'eq-cierre-seccion' },
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, 'Lo que estaba planificado'),
        h('a', { class: 'btn btn-secondary eq-btn-mini', href: `/sesiones/${sessionId}`, onClick: (e) => { e.preventDefault(); e.stopPropagation(); salir(`/sesiones/${sessionId}`); } }, 'Ver plan'),
      ),
      objetivosSesion.length ? h('div', { class: 'eq-cierre-objs' },
        ...objetivosSesion.map((o) => h('span', { class: 'eq-obj-badge' }, o.titulo))) : null,
      bloques.length ? h('div', { class: 'eq-cierre-plan' },
        ...bloques.map((b, i) => h('div', { class: 'eq-cierre-bloque' },
          h('span', { class: 'eq-bloque-n' }, String(i + 1)),
          h('span', { class: 'eq-cierre-bloque-titulo' }, b.titulo),
          h('span', { class: 'eq-bloque-ro-dato' }, `${b.duracion_min}′`),
          h('span', { class: 'eq-bloque-ro-dato' }, `int ${b.intensidad}/${INTENSIDAD_MAX}`),
        )),
        h('p', { class: 'eq-ayuda' }, textoMinutos(m)),
        h('p', { class: 'eq-ayuda' }, `${c.duracion} min · intensidad media ${c.cargaMedia.toFixed(1)}`),
      ) : null,
    );
  }

  // ── Guardado ───────────────────────────────────────────────
  async function guardar({ cerrar = false } = {}) {
    if (soloLectura) return;
    if (cerrar && sesion.fecha > hoyISO()) {
      const ok = await confirmar({
        titulo: 'Sesión futura',
        mensaje: `Esta sesión es del ${sesion.fecha} (aún no ha llegado). ¿Marcarla como realizada igualmente?`,
        textoOk: 'Marcar realizada',
      });
      if (!ok) return;
    }
    /* El esfuerzo es OBLIGATORIO al cerrar (decisión #20). Se comprueba
       aquí y no en la base de datos a propósito: rechazar el guardado
       dejaría al entrenador con la lista pasada, la rúbrica puesta y
       todo lo demás escrito, y sin poder guardarlo. */
    if (cerrar && ajustes.reflexion_activa && faltaEsfuerzo(items)) {
      toast('Falta decir cómo han trabajado hoy: es la única pregunta obligatoria.', 'error');
      const el = cont.querySelector(`[data-clave="${CLAVE_ESFUERZO}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.classList.add('animate-shake');
      return;
    }
    try {
      if (ajustes.asistencia_activa && densas.length) {
        await guardarAsistencia(filasParaGuardar(sessionId, densas));
        filasBD = densas.map((f) => ({ player_id: f.player_id, estado: f.estado, motivo: (f.motivo || '').trim() || null }));
      }
      if (ajustes.reflexion_activa && (items.length || itemsJug.length)) {
        // las del equipo y las de cada crío van en la misma tacada
        const todas = [...items, ...itemsJug.map((x) => x.item)];
        await guardarRespuestas(sessionId, filasRespuesta(sessionId, todas));
      }
      if (cerrar && sesion.estado !== 'realizada') {
        await marcarRealizada(sessionId);
        sesion.estado = 'realizada';
      } else if (sesion.estado === 'preliminar') {
        // Pasar lista CONFIRMA que la sesión existió: deja de ser andamiaje.
        // Sin esto seguiría siendo una preliminar auto "intacta" y la próxima
        // regeneración del calendario la podaría, llevándose por delante —vía
        // CASCADE— la lista y la reflexión que se acaban de guardar.
        await promoverSesion(sessionId);
        sesion.estado = 'programada';
      }
      sucio = false;
      // se mira ANTES de marcarlo: si no, el primer guardado ya diría «cambios»
      const eraEdicion = yaGuardado;
      yaGuardado = true;
      if (cerrar) {
        toast('Sesión cerrada');
        router.navigate(`/sesiones?equipo=${sesion.team_id}`);
      } else {
        toast(eraEdicion ? 'Cambios guardados' : 'Guardado');
        pinta();
      }
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
    }
  }

  function barraAcciones() {
    if (soloLectura) {
      return h('div', { class: 'eq-planner-barra' },
        h('p', { class: 'eq-ayuda' }, 'Sesión cancelada: no se pasa lista ni se reflexiona.'));
    }
    const yaRealizada = sesion.estado === 'realizada';
    return h('div', { class: 'eq-planner-barra' },
      h('div', { class: 'eq-planner-barra-sec' },
        yaRealizada ? h('button', {
          class: 'btn btn-secondary', type: 'button',
          onClick: async () => {
            const ok = await confirmar({
              titulo: 'Reabrir sesión',
              mensaje: 'Volverá a estado «programada» y podrás editar su plan. La asistencia y la reflexión se conservan.',
              textoOk: 'Reabrir',
            });
            if (!ok) return;
            try {
              await promoverSesion(sessionId);   // realizada → programada
              sesion.estado = 'programada';
              toast('Sesión reabierta'); pinta();
            } catch (e) { toast('Error: ' + e.message, 'error'); }
          },
        }, 'Reabrir sesión') : null,
      ),
      h('div', { class: 'eq-planner-barra-sec' },
        /* Cuando ya hay algo guardado, el botón dice que se están
           guardando CAMBIOS. Y si además la sesión está cerrada ya no
           hay «guardar y cerrar», así que éste pasa a ser el principal:
           un botón secundario solitario parece que no hace nada. */
        h('button', {
          class: (yaRealizada ? 'btn btn-primary eq-planner-guardar' : 'btn btn-secondary'),
          type: 'button', onClick: () => guardar(),
        }, yaGuardado || yaRealizada ? 'Guardar cambios' : 'Guardar'),
        yaRealizada ? null : h('button', {
          class: 'btn btn-primary eq-planner-guardar', type: 'button',
          onClick: () => guardar({ cerrar: true }),
        }, yaGuardado ? 'Guardar cambios y cerrar sesión' : 'Guardar y cerrar sesión'),
      ),
    );
  }

  // ── Pintado ────────────────────────────────────────────────
  /* ---- la rúbrica, al cerrar (Tramo 3.7) --------------------------
     El criterio de la fila es «se evalúa a cinco jugadores en menos de
     dos minutos»: veinticuatro segundos por crío. Eso decide toda la
     pantalla — se abre UN jugador, salen las seis filas por las que
     conviene empezar, y cada fila es un toque entre cuatro botones.

     La app NO elige a quién mirar (§5.7: lo dispara el entrenador y
     elige a quien quiera, sin tope). Lo único que hace es ORDENAR:
     delante el que lleva más tiempo sin mirarse, que es lo que evita
     que se evalúe siempre a los mismos cinco. */
  function seccionRubrica() {
    const filas = filasDeRubrica(filasClub);
    const orden = ordenSugerido(
      densas.filter((f) => !f.esBaja).map((f) => ({ id: f.player_id, nombre: f.nombre })),
      rubricaEquipo,
    );

    const pendientes = Object.keys(porGuardar).length;

    return h('div', { class: 'eq-rub' },
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, 'Rúbrica'),
        pendientes
          ? h('button', {
              class: 'btn btn-primary eq-btn-mini', type: 'button', onClick: guardaRubrica,
            }, `Guardar ${pendientes} ${pendientes === 1 ? 'valoración' : 'valoraciones'}`)
          : h('span', { class: 'eq-ayuda' }, 'Elige a quien quieras: no hay que evaluar a todos.'),
      ),
      ...orden.map(({ jugador, dias }) => filaJugador(jugador, dias, filas)),
    );
  }

  function filaJugador(jugador, dias, filas) {
    const abierto = rubAbierto === jugador.id;
    const estado = estadoDe(rubricaEquipo[jugador.id]);
    const tocadas = Object.keys(porGuardar).filter((k) => k.startsWith(`${jugador.id}|`)).length;

    const cab = h('button', {
      class: 'eq-rub-jug' + (abierto ? ' is-abierto' : ''), type: 'button',
      'aria-expanded': String(abierto),
      onClick: () => {
        // al cerrar un jugador se guarda lo suyo: si hay que acordarse
        // de pulsar guardar, con doce críos delante no se pulsa
        if (abierto && tocadas) guardaRubrica();
        rubAbierto = abierto ? null : jugador.id;
        pintaRubrica();
      },
    },
      h('span', { class: 'eq-rub-nombre' }, jugador.nombre),
      tocadas ? h('span', { class: 'eq-rub-tocadas' }, `${tocadas} sin guardar`) : null,
      h('span', { class: 'eq-rub-dias' + (dias == null ? ' is-nunca' : '') }, textoSinMirar(dias)),
    );

    if (!abierto) return h('div', { class: 'eq-rub-item' }, cab);

    const sugeridas = porDondeEmpezar(estado, filas, { cuantas: 6, preferidas: entrenadoHoy() });
    const extra = filas.filter((f) => rubExtra.has(f.clave) && !sugeridas.includes(f));

    return h('div', { class: 'eq-rub-item is-abierto' }, cab,
      h('div', { class: 'eq-rub-filas' },
        ...[...sugeridas, ...extra].map((f) => filaRubrica(jugador, f, estado)),
        h('details', { class: 'eq-rub-mas' },
          h('summary', {}, 'Otra fila'),
          h('div', { class: 'eq-rub-catalogo' },
            ...filas.filter((f) => !sugeridas.includes(f) && !rubExtra.has(f.clave)).map((f) => h('button', {
              class: 'eq-rub-add', type: 'button',
              onClick: () => { rubExtra.add(f.clave); pintaRubrica(); },
            }, f.nombre)),
          ),
        ),
      ),
    );
  }

  function filaRubrica(jugador, fila, estado) {
    const clave = `${jugador.id}|${fila.clave}`;
    const puesto = porGuardar[clave];
    const actual = puesto != null ? puesto : estado[fila.clave]?.nivel;
    const mov = movimiento(estado, fila.clave);

    return h('div', { class: 'eq-rub-fila' },
      h('span', { class: 'eq-rub-fila-t' + (fila.tipo === 'conducta' ? ' es-conducta' : '') }, fila.nombre),
      mov ? h('span', { class: 'eq-rub-mov' + (mov > 0 ? ' es-sube' : ' es-baja') }, mov > 0 ? '↑' : '↓') : null,
      h('div', { class: 'eq-rub-niveles' }, ...NIVELES.map((n) => h('button', {
        class: 'eq-rub-nivel' + (actual === n.valor ? ' is-on' : ''),
        type: 'button', title: `${n.nombre} — ${n.nota}`,
        'aria-label': `${jugador.nombre}, ${fila.nombre}: ${n.nombre}`,
        'aria-pressed': String(actual === n.valor),
        onClick: () => {
          // volver a tocar el mismo nivel lo quita: el toque que no era
          if (porGuardar[clave] === n.valor) delete porGuardar[clave];
          else porGuardar[clave] = n.valor;
          pintaRubrica();
        },
      }, n.corto))),
    );
  }

  /** Manda de una tacada lo que se haya tocado. Una petición por toque
   *  haría el pabellón insoportable. */
  async function guardaRubrica() {
    const entradas = Object.entries(porGuardar);
    if (!entradas.length) return;
    const valores = entradas.map(([k, nivel]) => {
      const [player_id, ...resto] = k.split('|');
      return { player_id, clave: resto.join('|'), nivel };
    });
    try {
      const nuevos = await valorar(valores, { sessionId });
      // la serie en memoria se actualiza con lo que ha vuelto: así el
      // «↑» y el «hace N días» se enteran sin volver a pedir nada
      for (const v of nuevos) (rubricaEquipo[v.player_id] ||= []).unshift(v);
      porGuardar = {};
      toast(`${valores.length} ${valores.length === 1 ? 'valoración guardada' : 'valoraciones guardadas'}`);
    } catch (e) {
      toast(`No se han podido guardar: ${e.message}`, 'error');
    }
    pintaRubrica();
  }

  /**
   * Las acciones que se han entrenado HOY, sacadas de las etiquetas de
   * los ejercicios del plan.
   *
   * Es el eslabón del vocabulario único hecho pantalla: la misma
   * palabra que etiqueta un ejercicio es una fila de la rúbrica, así
   * que al cerrar se pregunta por lo que se acaba de ver — que es lo
   * único que el entrenador puede juzgar con la sesión fresca.
   */
  function entrenadoHoy() {
    const out = new Set();
    for (const b of bloques) {
      for (const t of tagsPorEjercicio.get(b.exercise_id) || []) out.add(claveAccion(t));
    }
    return out;
  }

  const nodoRubrica = h('section', { class: 'eq-cierre-seccion' });
  const pintaRubrica = () => mount(nodoRubrica, seccionRubrica());

  function pinta() {
    const [, m, d] = sesion.fecha.split('-').map(Number);
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
          h('span', { class: 'eyebrow' }, puntoEquipo(color), ' ', nombreEquipo, ' · Cierre'),
          h('h1', { class: 'display view-title' }, fechaTxt),
          horaTxt ? h('p', { class: 'view-meta' }, horaTxt) : null,
          sesion.titulo ? h('p', { class: 'view-meta' }, sesion.titulo) : null,
        ),
      ),

      ajustes.asistencia_activa
        ? h('section', { class: 'eq-cierre-seccion' }, seccionAsistencia())
        : null,

      seccionJugadores(),

      nodoRubrica,

      ajustes.reflexion_activa
        ? h('section', { class: 'eq-cierre-seccion' },
            h('div', { class: 'eq-zona-head' },
              h('h2', { class: 'eq-zona-titulo' }, 'Reflexión'),
              mediaEstrellas(items) != null
                ? h('span', { class: 'eq-ayuda' }, `media ${mediaEstrellas(items).toFixed(1)} / ${ESTRELLAS_MAX}`)
                : null,
            ),
            seccionReflexion(),
          )
        : null,

      (!ajustes.asistencia_activa && !ajustes.reflexion_activa)
        ? h('div', { class: 'empty-state' },
            h('p', { class: 'empty-state-display' }, 'Cierre desactivado'),
            h('p', {}, 'Este equipo tiene la asistencia y la reflexión apagadas en sus ajustes.'),
            h('a', { class: 'btn btn-secondary', href: `/equipos/${sesion.team_id}?tab=ajustes`, 'data-link': true }, 'Ajustes del equipo'))
        : null,

      seccionPlan(),
      barraAcciones(),
    );
    if (ajustes.asistencia_activa && jugadores.length) pintaLista();
    pintaRubrica();
  }

  // ── Carga inicial ──────────────────────────────────────────
  (async () => {
    try {
      sesion = await getSesion(sessionId);
      soloLectura = sesion.estado === 'cancelada';

      const [equipos, equipo] = await Promise.all([
        getMisEquipos(),
        getEquipo(sesion.team_id).catch(() => null),
      ]);
      const eq = equipos.find((t) => t.id === sesion.team_id);
      color = eq?.color || 'var(--muted)';
      nombreEquipo = eq?.name || '—';
      const s = equipo?.team_settings;
      ajustes = {
        asistencia_activa: s?.asistencia_activa !== false,
        reflexion_activa: s?.reflexion_activa !== false,
      };

      // cada bloque degrada solo: sin 014/015 aplicadas, la vista sigue en pie
      const [js, fbd, qs, rs, blks, objIds, bib] = await Promise.all([
        getJugadores(sesion.team_id, { incluirBajas: true }).catch(() => []),
        getAsistencia(sessionId).catch(() => []),
        getPreguntas(sesion.team_id).catch(() => []),
        getRespuestas(sessionId).catch(() => []),
        getBloques(sessionId).catch(() => []),
        getObjetivosSesion(sessionId).catch(() => []),
        getEjerciciosSugeribles().catch(() => []),
      ]);
      jugadores = js; filasBD = fbd; preguntas = qs; bloques = blks;
      requisitosPorEjercicio = new Map((bib || []).map((e) => [e.id, e.requisitos || null]));
      tagsPorEjercicio = new Map((bib || []).map((e) => [e.id, e.tags || []]));

      /* La rúbrica llega suelta y no bloquea el pintado (Tramo 3.7): si
         falta la migración 024, el cierre se hace igual y la sección
         dice que todavía no hay nada. */
      Promise.all([
        getRubricaEquipo(js.map((j) => j.id)),
        getFilasClub(),
      ]).then(([serie, club]) => {
        rubricaEquipo = serie || {};
        filasClub = club || [];
        pintaRubrica();
      }).catch(() => {});
      densas = filasDensas(jugadores, filasBD);
      items = plantillaEfectiva(preguntas, rs);
      /* Con lista pasada o con reflexión escrita, ya hay algo guardado:
         lo que se va a hacer es editarlo. */
      if ((rs && rs.length) || (fbd && fbd.length) || sesion.estado === 'realizada') yaGuardado = true;
      // las de jugador (Tramo 3.11), una por pregunta y crío
      itemsJug = itemsDeJugador(preguntas, rs, jugadores.filter((j) => j.estado !== 'baja'));

      if (objIds.length) {
        const todos = await getObjetivos(sesion.team_id, sesion.season_id).catch(() => []);
        const set = new Set(objIds);
        objetivosSesion = todos.filter((o) => set.has(o.id));
      }

      pinta();
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir el cierre'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/sesiones', 'data-link': true }, 'Volver al calendario')));
    }
  })();

  return { destroy() { window.removeEventListener('beforeunload', onBeforeUnload); } };
}
