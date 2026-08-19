/* ============================================================
   sesion-activa.js — /sesiones/:sessionId/activa (Tramo 3.5).

   LA PANTALLA QUE SE MIRA CON UN BALÓN EN LA OTRA MANO.

   El criterio de la fila es «un entrenamiento entero se da sin apuntar
   nada después». Eso obliga a que todo lo que se recoge quepa en un
   toque: el cronómetro no se configura, la lista se pasa con el pulgar
   y la estrella es un botón con un dorsal.

   ── LO QUE HAY, DE ARRIBA ABAJO ─────────────────────────────
   · cómo va de tiempo, y el arranque corregible de un toque;
   · pasar lista, arriba del todo HASTA que esté pasada, y después
     reducida a «12 de 14» (§5.6);
   · el bloque en curso EN GRANDE, con su cuenta atrás, «3 de 6» y los
     dos botones que de verdad se pulsan: Finalizado y +5 min;
   · lo que se apunta en caliente: estrella a un jugador, nota corta y
     «este ejercicio no ha funcionado»;
   · lo que queda por dar.

   ── POR QUÉ EL RELOJ NO CUENTA, CALCULA ─────────────────────
   Ver data/cronometro.js: un cronómetro con `setInterval` miente en
   cuanto el móvil se bloquea en el bolsillo. Aquí el latido solo sirve
   para repintar; la hora se pregunta cada vez.

   ── LO QUE SE GUARDA, Y CUÁNDO ──────────────────────────────
   En cuanto se toca. Un entrenamiento no es el sitio donde pulsar
   «guardar»: si hay que acordarse de hacerlo, no se hace. La duración
   real y el «no ha funcionado» viajan con los bloques; la estrella,
   sola, en su tabla.

   El ARRANQUE y los «+5» viven en el navegador y no en la base de
   datos: son ayudas de este rato, y lo que queda escrito para siempre
   es la duración real de cada bloque.
   ============================================================ */

import { h, mount, icon } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { confirmar } from '../ui/modal.js';
import { puntoEquipo } from '../ui/components.js';
import { getMisEquipos } from '../data/teams.js';
import { getJugadores } from '../data/players.js';
import { getSesion, promoverSesion } from '../data/sessions.js';
import { getBloques, guardarBloques } from '../data/blocks.js';
import { getAsistencia, guardarAsistencia } from '../data/attendance.js';
import { getEstrellas, ponerEstrella, quitarEstrella } from '../data/estrellas.js';
import {
  ESTADOS_ASISTENCIA, filasDensas, resumenAsistencia, filasParaGuardar,
} from '../data/asistencia.js';
import {
  MAS_MIN, estadoCronometro, minutosReales, arranqueAhora,
  textoReloj, textoDesvio, claveDe,
} from '../data/cronometro.js';
import { esActiva, minutosDesdeInicio } from '../data/estado-sesion.js';
import { esAgua, esVideo } from '../data/plan.js';
import { router } from '../main.js';

const hhmm = (t) => (t ? t.slice(0, 5) : '');
const ICO = {
  estrella: 'M11.48 3.5a.56.56 0 0 1 1.04 0l2.17 4.4 4.85.7a.56.56 0 0 1 .31.96l-3.51 3.42.83 4.83a.56.56 0 0 1-.81.59L12 16.9l-4.34 2.28a.56.56 0 0 1-.81-.59l.83-4.83-3.51-3.42a.56.56 0 0 1 .31-.96l4.85-.7Z',
  atras: 'M15 18l-6-6 6-6',
};

export function render(root, params) {
  const sessionId = params.sessionId;
  const cont = h('div', { class: 'eq-page eq-activa' });
  mount(root, cont);

  let sesion = null, equipo = null;
  let bloques = [], jugadores = [], densas = [], estrellas = [];
  let listaAbierta = true;      // pasar lista ocupa arriba hasta que se pasa
  let extras = {};              // minutos añadidos con «+5», por bloque
  let arranque = null;
  let guardando = false;

  /* El arranque y los «+5» son ayudas de ESTE rato: viven en el
     navegador. Lo que queda escrito para siempre es la duración real de
     cada bloque, que sí va a la base de datos. */
  const CLAVE = `cbp-activa-${sessionId}`;
  const recordar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ arranque, extras })); } catch { /* modo privado */ }
  };
  const recordado = () => {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { return {}; }
  };

  /** ¿Ya se ha corregido el arranque? Entonces «empezamos ahora» sobra. */
  const ajustado = () => sesion && Math.abs(arranque - instanteInicio(sesion)) > 60000;

  const nodoTiempo = h('div', { class: 'eq-act-tiempo' });
  const nodoLista = h('section', { class: 'eq-act-seccion' });
  const nodoBloque = h('section', { class: 'eq-act-bloque' });
  const nodoCaliente = h('section', { class: 'eq-act-seccion' });
  const nodoResto = h('section', { class: 'eq-act-seccion' });

  /* El latido solo REPINTA. La hora se pregunta cada vez (cronometro.js),
     así que un móvil bloqueado diez minutos vuelve con la cuenta bien. */
  const latido = setInterval(() => { pintaTiempo(); pintaBloque(); }, 1000);

  /* ---- guardar sin que nadie pulse guardar ------------------------
     Un entrenamiento no es el sitio donde acordarse de guardar. Se
     escribe en cuanto se toca, y si falla se dice sin tirar el gesto:
     lo de la pantalla sigue siendo lo que el entrenador acaba de hacer. */
  async function guardaBloques() {
    if (guardando) return;
    guardando = true;
    try {
      await guardarBloques(sessionId, bloques);
    } catch (e) {
      toast(`No se ha podido guardar: ${e.message}`, 'error');
    } finally {
      guardando = false;
    }
  }

  async function guardaLista() {
    try {
      await guardarAsistencia(filasParaGuardar(sessionId, densas));
    } catch (e) {
      toast(`La lista no se ha guardado: ${e.message}`, 'error');
    }
  }

  /* ---- cómo va de tiempo ----------------------------------------- */
  function pintaTiempo() {
    if (!sesion) return;
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras });
    const tarde = minutosDesdeInicio(sesion) ?? 0;
    nodoTiempo.replaceChildren(...[
      h('div', { class: 'eq-act-reloj' },
        h('span', { class: 'eq-act-reloj-h' }, `${hhmm(sesion.hora_inicio)}–${hhmm(sesion.hora_fin)}`),
        h('span', { class: `eq-act-desvio${e.desvioMin > 0 ? ' is-tarde' : ''}` }, textoDesvio(e.desvioMin)),
      ),
      /* El ajuste de un toque (§5.6). Solo aparece cuando de verdad se
         ha empezado tarde, no se ha dado ningún bloque y no se ha
         ajustado ya: después ya no es «empezamos ahora», es rehacer el
         pasado. */
      !e.hechos && tarde > 3 && !ajustado()
        ? h('button', {
            class: 'btn btn-secondary eq-act-tarde', type: 'button',
            onClick: () => {
              arranque = arranqueAhora(Date.now());
              recordar(); pintaTiempo(); pintaBloque(); pintaResto(); pintaCaliente();
              toast('Empezamos ahora: el plan entero se corre, no se recorta.');
            },
          }, `Empezamos ahora (${tarde} min tarde)`)
        : null,
    ].filter(Boolean));
  }

  /* ---- pasar lista ------------------------------------------------ */
  function pintaLista() {
    const r = resumenAsistencia(densas);
    if (!listaAbierta) {
      nodoLista.replaceChildren(h('div', { class: 'eq-act-lista-cerrada' },
        h('strong', null, `${r.entrenaron} de ${r.total}`),
        h('span', { class: 'eq-ayuda' }, 'han entrenado'),
        h('button', {
          class: 'btn btn-secondary eq-btn-mini', type: 'button',
          onClick: () => { listaAbierta = true; pintaLista(); },
        }, 'Corregir'),
      ));
      return;
    }

    const fila = (f) => h('div', { class: 'eq-act-jug' },
      h('span', { class: 'eq-act-jug-n' }, f.dorsal != null ? String(f.dorsal) : '·'),
      h('span', { class: 'eq-act-jug-nombre' }, f.nombre),
      h('div', { class: 'eq-act-jug-estados' }, ...ESTADOS_ASISTENCIA.map((x) => h('button', {
        class: `eq-act-est eq-act-est-${x.tono}` + (f.estado === x.clave ? ' is-on' : ''),
        type: 'button', title: x.nombre, 'aria-label': `${f.nombre}: ${x.nombre}`,
        'aria-pressed': String(f.estado === x.clave),
        onClick: () => { f.estado = x.clave; pintaLista(); guardaLista(); },
      }, x.corto))),
    );

    nodoLista.replaceChildren(
      h('div', { class: 'eq-zona-head' },
        h('h2', { class: 'eq-zona-titulo' }, 'Pasar lista'),
        h('button', {
          class: 'btn btn-primary eq-btn-mini', type: 'button',
          onClick: () => { listaAbierta = false; pintaLista(); guardaLista(); },
        }, `Listo · ${r.entrenaron} de ${r.total}`),
      ),
      densas.length
        ? h('div', { class: 'eq-act-jugs' }, ...densas.map(fila))
        : h('p', { class: 'eq-ayuda' }, 'Este equipo no tiene jugadores en la plantilla.'),
    );
  }

  /* ---- el bloque en curso ----------------------------------------- */
  function pintaBloque() {
    if (!sesion) return;
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras });

    if (e.terminada) {
      nodoBloque.replaceChildren(
        h('p', { class: 'eq-act-fin' }, 'Se acabó el plan.'),
        h('button', {
          class: 'btn btn-primary eq-act-btn-grande', type: 'button',
          onClick: cerrar,
        }, 'Terminar y cerrar la sesión'),
      );
      return;
    }

    const b = e.bloque;
    const pasado = e.restanteMs < 0;
    const marca = esAgua(b) ? 'Agua' : esVideo(b) ? 'Vídeo' : null;

    nodoBloque.replaceChildren(
      h('p', { class: 'eq-act-cuenta' }, `${e.indice + 1} de ${e.total}`),
      h('h2', { class: 'eq-act-titulo' }, b.titulo || 'Bloque'),
      marca ? h('span', { class: 'eq-act-marca' }, marca) : null,
      h('div', { class: `eq-act-crono${pasado ? ' is-pasado' : ''}` }, textoReloj(e.restanteMs)),
      h('p', { class: 'eq-act-previsto' }, `de ${Math.round(e.previstoMs / 60000)} min`),
      h('div', { class: 'eq-act-acciones' },
        h('button', {
          class: 'btn btn-secondary eq-act-btn-grande', type: 'button',
          onClick: () => {
            extras = { ...extras, [claveDe(b)]: (Number(extras[claveDe(b)]) || 0) + MAS_MIN };
            recordar(); pintaTiempo(); pintaBloque(); pintaResto();
          },
        }, `+${MAS_MIN} min`),
        h('button', {
          class: 'btn btn-primary eq-act-btn-grande', type: 'button',
          onClick: () => finaliza(b, e.transcurridoMs),
        }, 'Finalizado'),
      ),
    );
  }

  /**
   * Dar un bloque por acabado: se guarda lo que DE VERDAD duró, que es
   * lo que alimentará la duración estimada del ejercicio (fila 3.6).
   */
  async function finaliza(b, transcurridoMs) {
    b.duracion_real_min = minutosReales(transcurridoMs);
    pintaTiempo(); pintaBloque(); pintaResto(); pintaCaliente();
    await guardaBloques();
    toast(`${b.titulo || 'Bloque'}: ${b.duracion_real_min} min`);
  }

  /* ---- lo que se apunta en caliente -------------------------------- */
  function pintaCaliente() {
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras });
    const b = e.bloque;
    const presentes = densas.filter((f) => f.estado === 'presente' || f.estado === 'tarde');
    const conEstrella = new Set(estrellas.map((x) => x.player_id));

    const nota = h('input', {
      class: 'field-input', type: 'text', maxlength: 140,
      placeholder: 'Nota corta de lo que acaba de pasar',
      'aria-label': 'Nota corta',
      value: b?.notas || '',
      onChange: (ev) => {
        if (!b) return;
        b.notas = ev.target.value.trim() || null;
        guardaBloques();
      },
    });

    nodoCaliente.replaceChildren(
      h('h2', { class: 'eq-zona-titulo' }, 'En caliente'),
      presentes.length
        ? h('div', { class: 'eq-act-estrellas' }, ...presentes.map((f) => h('button', {
            class: 'eq-act-estrella' + (conEstrella.has(f.player_id) ? ' is-on' : ''),
            type: 'button',
            title: `${f.nombre}${conEstrella.has(f.player_id) ? ' · ya tiene estrella hoy' : ''}`,
            'aria-label': `Estrella para ${f.nombre}`,
            onClick: () => estrella(f, b),
          },
            icon(ICO.estrella, { size: 15, fill: conEstrella.has(f.player_id) ? 'currentColor' : 'none' }),
            h('span', null, f.dorsal != null ? String(f.dorsal) : f.nombre.split(' ')[0]),
          )))
        : h('p', { class: 'eq-ayuda' }, 'Pasa lista y aquí saldrán los que están para darles una estrella.'),
      nota,
      b ? h('label', { class: 'eq-act-nofunciono' },
        h('input', {
          type: 'checkbox', checked: !!b.no_funciono,
          onChange: (ev) => { b.no_funciono = ev.target.checked; guardaBloques(); pintaResto(); },
        }),
        h('span', null, 'Este ejercicio no ha funcionado'),
      ) : null,
      estrellas.length
        ? h('p', { class: 'eq-ayuda' }, `${estrellas.length} ${estrellas.length === 1 ? 'estrella' : 'estrellas'} hoy. Toca otra vez para quitarla.`)
        : null,
    );
  }

  async function estrella(f, bloque) {
    const ya = estrellas.find((x) => x.player_id === f.player_id);
    try {
      if (ya) {
        await quitarEstrella(ya.id);
        estrellas = estrellas.filter((x) => x.id !== ya.id);
      } else {
        const nueva = await ponerEstrella({
          sessionId, playerId: f.player_id, blockId: bloque?.id || null,
        });
        estrellas = [nueva, ...estrellas];
        toast(`★ ${f.nombre}`);
      }
    } catch (e) {
      toast(`No se ha podido apuntar: ${e.message}`, 'error');
    }
    pintaCaliente();
  }

  /* ---- lo que queda ------------------------------------------------ */
  function pintaResto() {
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras });
    const quedan = bloques.filter((b, i) => (Number(b.duracion_min) || 0) > 0 && i > bloques.indexOf(e.bloque));
    nodoResto.replaceChildren(
      h('h2', { class: 'eq-zona-titulo' }, quedan.length ? 'Lo que queda' : 'Ya está todo'),
      ...bloques.map((b, i) => {
        const hecho = b.duracion_real_min != null;
        const enCurso = b === e.bloque;
        return h('div', { class: `eq-act-item${hecho ? ' is-hecho' : ''}${enCurso ? ' is-curso' : ''}` },
          h('span', { class: 'eq-act-item-n' }, String(i + 1)),
          h('span', { class: 'eq-act-item-t' }, b.titulo || 'Bloque'),
          b.no_funciono ? h('span', { class: 'eq-act-item-mal' }, 'no funcionó') : null,
          h('span', { class: 'eq-act-item-min' }, hecho ? `${b.duracion_real_min}′ reales` : `${b.duracion_min}′`),
        );
      }),
    );
  }

  async function cerrar() {
    const ok = await confirmar({
      titulo: 'Terminar el entrenamiento',
      mensaje: 'Se guarda lo que llevas y se abre el cierre para la reflexión.',
    });
    if (!ok) return;
    await guardaBloques();
    await guardaLista();
    router.navigate(`/sesiones/${sessionId}/cierre`);
  }

  /* ---- montaje ----------------------------------------------------- */
  function pinta() {
    mount(cont,
      h('div', { class: 'eq-act-head' },
        h('a', {
          class: 'eq-act-volver', href: `/sesiones/${sessionId}`,
          onClick: (e) => { e.preventDefault(); router.navigate(`/sesiones/${sessionId}`); },
        }, icon(ICO.atras, { size: 18 }), 'Plan'),
        h('div', { class: 'eq-act-equipo' }, puntoEquipo(equipo?.team_settings?.color), ' ', equipo?.name || '—'),
        nodoTiempo,
      ),
      nodoLista,
      nodoBloque,
      nodoCaliente,
      nodoResto,
    );
    pintaTiempo(); pintaLista(); pintaBloque(); pintaCaliente(); pintaResto();
  }

  (async () => {
    try {
      sesion = await getSesion(sessionId);
      const [eqs, js, fbd, blks, ests] = await Promise.all([
        getMisEquipos(),
        getJugadores(sesion.team_id, { incluirBajas: true }).catch(() => []),
        getAsistencia(sessionId).catch(() => []),
        getBloques(sessionId).catch(() => []),
        getEstrellas(sessionId),
      ]);
      equipo = eqs.find((t) => t.id === sesion.team_id) || null;
      jugadores = js; bloques = blks; estrellas = ests;
      densas = filasDensas(jugadores, fbd);
      // si ya se había pasado lista, no vuelve a ocupar toda la pantalla
      listaAbierta = !fbd.length;

      const g = recordado();
      extras = g.extras && typeof g.extras === 'object' ? g.extras : {};
      arranque = Number(g.arranque) || instanteInicio(sesion);

      /* Dar un entrenamiento es planificarlo de la forma más rápida que
         hay: si estaba sin confirmar, se confirma sola. Que quede en
         `preliminar` una sesión que se ha dado es un estado falso. */
      if (sesion.estado === 'preliminar') promoverSesion(sessionId).catch(() => {});

      pinta();
      if (!esActiva(sesion)) {
        toast('Esta sesión no está en su hora: el reloj cuenta igual, pero mira la fecha.', 'error');
      }
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir el entrenamiento'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/sesiones', 'data-link': true }, 'Volver al calendario')));
    }
  })();

  return { destroy() { clearInterval(latido); } };
}

/** La hora de pista como instante local; si no la hay, ahora. */
function instanteInicio(sesion) {
  const f = String(sesion?.fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !sesion?.hora_inicio) return Date.now();
  const [Y, M, D] = f.split('-').map(Number);
  const [hh = 0, mm = 0] = String(sesion.hora_inicio).split(':').map(Number);
  return new Date(Y, M - 1, D, hh, mm, 0, 0).getTime();
}
