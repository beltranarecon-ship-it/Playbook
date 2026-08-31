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
import { puntoEquipo, iniciales } from '../ui/components.js';
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
  alternarPausa, minutosPerdidos,
} from '../data/cronometro.js';
import { esActiva, minutosDesdeInicio } from '../data/estado-sesion.js';
import { esAgua, esVideo } from '../data/plan.js';
import { getObjetivos } from '../data/objectives.js';
import { router } from '../main.js';

const hhmm = (t) => (t ? t.slice(0, 5) : '');

/* Cuánto se puede uno adelantar y que «empezamos ahora» siga teniendo
   sentido. Sin tope, abrir la pantalla de una sesión del jueves ofrecía
   «empezamos ahora (3884 min antes)», que no es una ayuda: es una
   forma de estropear el plan de otro día de un toque. Tarde no lleva
   tope porque llegar tarde no tiene fondo. */
const ANTES_MAX_MIN = 120;
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
  let objetivosJug = {};        // player_id → sus objetivos vivos (Tramo 3.10)
  let extras = {};              // minutos añadidos con «+5», por bloque
  let arranque = null;
  let guardando = false;
  /* La parada del bloque en curso: { acumuladoMs, desde, motivo }.
     `desde` es el instante en que se tocó el reloj, no un contador —así
     una pantalla dormida veinte minutos vuelve sabiendo que se estuvo
     parado veinte, y no los pocos latidos que le dio el navegador. */
  let pausa = null;

  /* El arranque y los «+5» son ayudas de ESTE rato: viven en el
     navegador. Lo que queda escrito para siempre es la duración real de
     cada bloque, que sí va a la base de datos. */
  const CLAVE = `cbp-activa-${sessionId}`;
  const recordar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ arranque, extras, pausa })); } catch { /* modo privado */ }
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
  const nodoObjetivos = h('section', { class: 'eq-act-seccion' });

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
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras, pausa });
    const tarde = minutosDesdeInicio(sesion) ?? 0;
    nodoTiempo.replaceChildren(...[
      h('div', { class: 'eq-act-reloj' },
        h('span', { class: 'eq-act-reloj-h' }, `${hhmm(sesion.hora_inicio)}–${hhmm(sesion.hora_fin)}`),
        h('span', { class: `eq-act-desvio${e.desvioMin > 0 ? ' is-tarde' : ''}` }, textoDesvio(e.desvioMin)),
      ),
      /* El ajuste de un toque (§5.6). Solo mientras no se haya dado
         ningún bloque y no se haya ajustado ya: después ya no es
         «empezamos ahora», es rehacer el pasado.

         Vale en LOS DOS SENTIDOS. Antes solo salía al llegar tarde, y
         el pabellón se abre igual de pronto que tarde: quien empieza a
         y cuarenta y cinco una sesión de las cinco se quedaba con la
         cuenta atrás ya gastada y sin forma de corregirla. */
      !e.hechos && (tarde > 3 || (tarde < -3 && tarde >= -ANTES_MAX_MIN)) && !ajustado()
        ? h('button', {
            class: 'btn btn-secondary eq-act-tarde', type: 'button',
            onClick: () => {
              arranque = arranqueAhora(Date.now());
              recordar(); pintaTiempo(); pintaBloque(); pintaResto(); pintaCaliente();
              toast('Empezamos ahora: el plan entero se corre, no se recorta.');
            },
          }, tarde > 0
            ? `Empezamos ahora (${tarde} min tarde)`
            : `Empezamos ahora (${-tarde} min antes)`)
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
          onClick: () => { listaAbierta = false; pintaLista(); pintaObjetivos(); guardaLista(); },
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
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras, pausa });

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
    const perdidos = Math.floor(e.paradoMs / 60000);

    /* `replaceChildren` es el DOM nativo y NO se traga los null: los
       pinta como el TEXTO «null» debajo del título. Por eso la lista se
       filtra, igual que en pintaTiempo. */
    nodoBloque.replaceChildren(...[
      h('p', { class: 'eq-act-cuenta' }, `${e.indice + 1} de ${e.total}`),
      h('h2', { class: 'eq-act-titulo' }, b.titulo || 'Bloque'),
      marca ? h('span', { class: 'eq-act-marca' }, marca) : null,
      /* El número es el botón (§5.6: todo en un toque). Pausar no
         merece un botón más en una pantalla que se mira con un balón
         en la otra mano. */
      h('button', {
        class: `eq-act-crono${pasado ? ' is-pasado' : ''}${e.pausado ? ' is-pausado' : ''}`,
        type: 'button',
        'aria-pressed': e.pausado ? 'true' : 'false',
        title: e.pausado ? 'Tocar para reanudar' : 'Tocar para parar el tiempo',
        onClick: () => {
          pausa = alternarPausa(pausa, Date.now());
          recordar(); pintaTiempo(); pintaBloque(); pintaResto();
        },
      }, textoReloj(e.restanteMs)),
      h('p', { class: 'eq-act-previsto' },
        e.pausado ? 'Parado · tocar el reloj para seguir' : `de ${Math.round(e.previstoMs / 60000)} min`),
      /* Mientras está parado, el motivo. Opcional a propósito: en el
         pabellón se para con el pulgar y se explica si da tiempo. */
      e.pausado ? h('input', {
        class: 'field-input eq-act-motivo', type: 'text', maxLength: 120,
        value: pausa?.motivo || '',
        placeholder: '¿Por qué se ha parado? (opcional)',
        onInput: (ev) => { pausa = { ...pausa, motivo: ev.target.value }; recordar(); },
      }) : null,
      perdidos > 0 && !e.pausado
        ? h('p', { class: 'eq-act-perdido' }, `${perdidos} min parados en este bloque`)
        : null,
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
          onClick: () => finaliza(b, e.transcurridoMs, e.paradoMs),
        }, 'Finalizado'),
      ),
    ].filter(Boolean));
  }

  /**
   * Dar un bloque por acabado: se guarda lo que DE VERDAD duró, que es
   * lo que alimentará la duración estimada del ejercicio (fila 3.6).
   */
  async function finaliza(b, transcurridoMs, paradoMs = 0) {
    b.duracion_real_min = minutosReales(transcurridoMs);
    /* Lo parado va aparte: ocupó pista —y por eso sitúa al bloque
       siguiente— pero no fue entrenamiento, así que no puede ensuciar
       la duración que se le propondrá luego a este ejercicio. */
    b.tiempo_perdido_min = minutosPerdidos(paradoMs);
    b.motivo_perdido = b.tiempo_perdido_min ? (pausa?.motivo || '').trim() || null : null;
    // la parada muere con el bloque: la del siguiente empieza de cero
    pausa = null; recordar();
    pintaTiempo(); pintaBloque(); pintaResto(); pintaCaliente();
    await guardaBloques();
    toast(b.tiempo_perdido_min
      ? `${b.titulo || 'Bloque'}: ${b.duracion_real_min} min (+${b.tiempo_perdido_min} parados)`
      : `${b.titulo || 'Bloque'}: ${b.duracion_real_min} min`);
  }

  /* ---- lo que se apunta en caliente -------------------------------- */
  function pintaCaliente() {
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras, pausa });
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

    /* Filtrado como en pintaTiempo y pintaBloque: `replaceChildren` es
       el DOM nativo y pinta cada null como el TEXTO «null». Con el plan
       acabado aqui hay dos —no hay bloque en curso y no hay estrellas—
       y salia un «nullnull» debajo de la nota. */
    nodoCaliente.replaceChildren(...[
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
            /* Dorsal E INICIALES: por el dorsal solo no se sabe a quien
               se le esta poniendo la estrella —hay que acordarse de
               dieciseis numeros— y en caliente eso no se hace. */
            h('span', { class: 'eq-act-chip-n' }, f.dorsal != null ? String(f.dorsal) : ''),
            h('span', { class: 'eq-act-chip-ini' }, iniciales(f.nombre) || f.nombre.split(' ')[0]),
          )))
        : h('p', { class: 'eq-ayuda' }, 'Pasa lista y aquí saldrán los que están para darles una estrella.'),
      nota,
      b ? h('label', { class: 'eq-act-nofunciono' },
        h('input', {
          type: 'checkbox', checked: !!b.fallido,
          onChange: (ev) => { b.fallido = ev.target.checked; guardaBloques(); pintaResto(); },
        }),
        h('span', null, 'Este ejercicio no ha funcionado'),
      ) : null,
      estrellas.length
        ? h('p', { class: 'eq-ayuda' }, `${estrellas.length} ${estrellas.length === 1 ? 'estrella' : 'estrellas'} hoy. Toca otra vez para quitarla.`)
        : null,
    ].filter(Boolean));
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

  /* ---- los objetivos de cada niño (Tramo 3.10) ---------------------
     §12.27: visibles TAMBIÉN en la sesión activa. Aquí no se editan ni
     se miden: se leen. Un objetivo individual que solo vive en la ficha
     del jugador no se cumple, porque en la pista nadie abre fichas.

     Solo los de los que están: el que no ha venido hoy no se entrena. */
  function pintaObjetivos() {
    const presentes = densas.filter((f) => f.estado === 'presente' || f.estado === 'tarde');
    const conObjetivo = presentes
      .map((f) => ({ f, objs: (objetivosJug[f.player_id] || []) }))
      .filter((x) => x.objs.length);

    if (!conObjetivo.length) { nodoObjetivos.replaceChildren(); return; }

    nodoObjetivos.replaceChildren(
      h('h2', { class: 'eq-zona-titulo' }, 'Lo suyo de cada uno'),
      ...conObjetivo.map(({ f, objs }) => h('div', { class: 'eq-act-obj' },
        h('span', { class: 'eq-act-obj-n' }, f.dorsal != null ? String(f.dorsal) : f.nombre.split(' ')[0]),
        h('div', { class: 'eq-act-obj-txt' }, ...objs.map((o) => h('p', {}, o.titulo))),
      )),
    );
  }

  /* ---- lo que queda ------------------------------------------------ */
  function pintaResto() {
    const e = estadoCronometro(bloques, { arranque, ahora: Date.now(), extras, pausa });
    const quedan = bloques.filter((b, i) => (Number(b.duracion_min) || 0) > 0 && i > bloques.indexOf(e.bloque));
    nodoResto.replaceChildren(
      h('h2', { class: 'eq-zona-titulo' }, quedan.length ? 'Lo que queda' : 'Ya está todo'),
      ...bloques.map((b, i) => {
        const hecho = b.duracion_real_min != null;
        const enCurso = b === e.bloque;
        return h('div', { class: `eq-act-item${hecho ? ' is-hecho' : ''}${enCurso ? ' is-curso' : ''}` },
          h('span', { class: 'eq-act-item-n' }, String(i + 1)),
          h('span', { class: 'eq-act-item-t' }, b.titulo || 'Bloque'),
          b.fallido ? h('span', { class: 'eq-act-item-mal' }, 'no funcionó') : null,
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
      nodoObjetivos,
      nodoResto,
    );
    pintaTiempo(); pintaLista(); pintaBloque(); pintaCaliente(); pintaObjetivos(); pintaResto();
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
      /* Se vuelve a la pausa tal y como se dejó: si se cerró la app con
         el entrenamiento parado, sigue parado —y lo que se estuvo
         parado se calcula desde `desde`, no desde que se reabrió. */
      pausa = g.pausa && typeof g.pausa === 'object' ? g.pausa : null;

      /* Dar un entrenamiento es planificarlo de la forma más rápida que
         hay: si estaba sin confirmar, se confirma sola. Que quede en
         `preliminar` una sesión que se ha dado es un estado falso. */
      if (sesion.estado === 'preliminar') promoverSesion(sessionId).catch(() => {});

      /* Los objetivos individuales llegan sueltos: sin la 026 aplicada
         la sección no aparece y el entrenamiento se da igual. */
      getObjetivos(sesion.team_id, sesion.season_id)
        .then((os) => {
          objetivosJug = {};
          for (const o of os || []) {
            if (o.player_id && o.estado === 'activo') (objetivosJug[o.player_id] ||= []).push(o);
          }
          pintaObjetivos();
        })
        .catch(() => {});

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
