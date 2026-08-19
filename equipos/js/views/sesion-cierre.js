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
} from '../data/reflexion.js';
import { curvaCarga, INTENSIDAD_MAX } from '../data/carga.js';
import { minutosDeSesion, textoMinutos } from '../data/minutos.js';
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
  let bloques = [], objetivosSesion = [];
  /* Requisitos de las fichas del plan (Tramo 3.1). Aquí los minutos
     activos se calculan con la asistencia REAL —los que de verdad
     entrenaron—, así que este es el número más honesto de los tres
     sitios donde aparece. La consulta es la lista ligera de la
     biblioteca, que ya viene cacheada del planificador. */
  let requisitosPorEjercicio = new Map();
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
      ...items.map((it) => h('div', { class: 'eq-reflex-item' },
        h('label', { class: 'field-label eq-reflex-label' },
          it.etiqueta,
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
    try {
      if (ajustes.asistencia_activa && densas.length) {
        await guardarAsistencia(filasParaGuardar(sessionId, densas));
        filasBD = densas.map((f) => ({ player_id: f.player_id, estado: f.estado, motivo: (f.motivo || '').trim() || null }));
      }
      if (ajustes.reflexion_activa && items.length) {
        await guardarRespuestas(sessionId, filasRespuesta(sessionId, items));
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
      if (cerrar) {
        toast('Sesión cerrada');
        router.navigate(`/sesiones?equipo=${sesion.team_id}`);
      } else {
        toast('Guardado');
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
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => guardar() }, 'Guardar'),
        yaRealizada ? null : h('button', {
          class: 'btn btn-primary eq-planner-guardar', type: 'button',
          onClick: () => guardar({ cerrar: true }),
        }, 'Guardar y cerrar sesión'),
      ),
    );
  }

  // ── Pintado ────────────────────────────────────────────────
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
      densas = filasDensas(jugadores, filasBD);
      items = plantillaEfectiva(preguntas, rs);

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
