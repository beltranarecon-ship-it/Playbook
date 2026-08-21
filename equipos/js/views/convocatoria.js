/* ============================================================
   convocatoria.js — /partidos/:matchId/convocatoria
   El documento que se cuelga en el grupo, y la pantalla donde se hace.

   ── UNA SOLA PANTALLA, NO DOS ───────────────────────────────
   Antes se marcaba a la gente en la pantalla del partido y el
   documento se veía aquí. Eran dos sitios para una sola tarea, y la
   mitad de los campos del papel —de dónde se sale, a qué hora se
   vuelve— no tenían dónde escribirse. Ahora todo pasa aquí: arriba se
   elige y se rellena, abajo se ve exactamente lo que va a salir.

   ── LO QUE SE VE ES LO QUE SE DESCARGA ──────────────────────
   La hoja de abajo y el PDF salen de la MISMA función
   (`datosDelDocumento`). Si la pantalla enseña una cosa y el fichero
   otra, el que se entera es el que ya lo ha mandado.

   ── TRES GRUPOS PORQUE EL PAPEL TIENE TRES ──────────────────
   CONVOCADOS (los 12 del acta), RESERVA y DESCANSO. El que descansa
   sale en el documento a propósito: a un niño le importa leer su
   nombre aunque sea para saber que esa jornada no juega.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { getPartido, actualizarPartido, hayGruposConvocatoria } from '../data/matches.js';
import { getMisEquipos } from '../data/teams.js';
import { getJugadores } from '../data/players.js';
import { urlImagenEquipo } from '../data/equipo-archivos.js';
import {
  GRUPOS, GRUPO_LABEL, CONVOCADOS_MAX,
  datosDelDocumento, titular, loQueFalta, avisosDeCupo,
  gruposDe, grupoDe, moverA, convocables, porDorsal, hhmm,
} from '../data/convocatoria.js';
import { descargarPDF } from '../data/convocatoria-pdf.js';
import { router } from '../main.js';

export function render(root, params) {
  const cont = h('div', { class: 'eq-conv-pantalla' });
  mount(root, cont);

  /* Dos listas a propósito. `jugadores` lleva TODOS, bajas incluidas,
     porque el documento tiene que seguir diciendo el nombre de un crío
     que se dio de baja DESPUÉS de convocarlo. `elegibles` lleva solo
     los activos, porque que un jugador de baja salga en el selector es
     exactamente la manera de convocarlo por error. */
  let p = null, equipo = null, ajustes = {}, jugadores = [], elegibles = [], escudo = null;
  let sucio = false, guardando = false;

  const marcaSucio = () => { sucio = true; pinta(); };

  /* Se guarda al soltar, no en cada tecla: son campos cortos y el
     entrenador los rellena de una sentada. */
  async function guardar() {
    if (guardando) return;
    guardando = true;
    try {
      await actualizarPartido(p.id, {
        convocados: p.convocados, reservas: p.reservas, descansan: p.descansan,
        convocatoria_hora: p.convocatoria_hora || null,
        convocatoria_lugar: p.convocatoria_lugar?.trim() || null,
        salida_hora: p.salida_hora || null,
        regreso: p.regreso?.trim() || null,
      });
      sucio = false;
      toast('Convocatoria guardada');
    } catch (e) {
      toast(`No se ha guardado: ${e.message}`, { type: 'error' });
    } finally {
      guardando = false;
      pinta();
    }
  }

  async function bajarPDF() {
    const d = datos();
    try {
      await descargarPDF(d);
    } catch (e) {
      /* El generador se trae de la red al pulsar. Sin cobertura no hay
         PDF, pero sí hoja: se dice cuál es la salida, no «error». */
      toast(`No se ha podido crear el PDF (${e.message}). Puedes imprimir la hoja de abajo y guardarla como PDF.`,
        { type: 'error' });
    }
  }

  const datos = () => datosDelDocumento(p, jugadores, {
    nombreEquipo: equipo?.name || '', escudo, ajustes,
  });

  /* ── El selector de los tres grupos ───────────────────────── */

  function filaJugador(j) {
    const suyo = grupoDe(p, j.id);
    return h('div', { class: 'eq-conv-fila' + (suyo ? ` es-${suyo}` : '') },
      h('span', { class: 'eq-conv-num' }, j.dorsal != null ? String(j.dorsal) : '—'),
      h('span', { class: 'eq-conv-nombre' }, j.nombre),
      h('div', { class: 'eq-conv-btns' },
        ...GRUPOS.map((g) => h('button', {
          class: 'eq-conv-btn' + (suyo === g ? ' is-on' : ''),
          type: 'button', 'aria-pressed': String(suyo === g),
          title: suyo === g ? `Quitar de ${GRUPO_LABEL[g].toLowerCase()}` : `Poner en ${GRUPO_LABEL[g].toLowerCase()}`,
          onClick: () => {
            const antes = gruposDe(p).convocados.length;
            const nuevos = moverA(p, j.id, g);
            /* Al llegar al tope el módulo no echa a nadie: lo dice. */
            if (g === 'convocados' && suyo !== g && nuevos.convocados.length === antes) {
              toast(`Ya hay ${CONVOCADOS_MAX} convocados, que es lo que cabe en el acta. Quita a alguien primero.`);
              return;
            }
            Object.assign(p, nuevos);
            marcaSucio();
          },
        }, GRUPO_LABEL[g])),
      ),
    );
  }

  const campo = (etiqueta, control, ayuda = null) => h('label', { class: 'field-group' },
    h('span', { class: 'field-label' }, etiqueta),
    control,
    ayuda ? h('span', { class: 'eq-ayuda' }, ayuda) : null,
  );

  /* ── La hoja: lo mismo que va al PDF ──────────────────────── */

  function hoja(d) {
    const fila = (etiqueta, valor) => (String(valor ?? '').trim()
      ? h('div', { class: 'eq-hoja-fila' },
          h('div', { class: 'eq-hoja-et' }, etiqueta),
          h('div', { class: 'eq-hoja-val' },
            ...String(valor).split('\n').map((t) => h('div', {}, t))),
        )
      : null);

    const lista = (titulo, gente, numerada) => (gente.length
      ? h('section', { class: 'eq-hoja-grupo' },
          h('h3', { class: 'eq-hoja-sub' }, `${titulo}:`),
          numerada
            ? h('div', { class: 'eq-hoja-rejilla' },
                ...gente.flatMap((j) => [
                  h('div', { class: 'eq-hoja-dorsal' }, j.dorsal == null ? '—' : String(j.dorsal)),
                  h('div', { class: 'eq-hoja-jug' }, j.nombre),
                ]))
            : h('ul', { class: 'eq-hoja-sueltos' },
                ...gente.map((j) => h('li', {},
                  `${j.dorsal == null ? '' : `${j.dorsal}.- `}${j.nombre}`))),
        )
      : null);

    const conDesplazamiento = d.donde === 'fuera' || d.salida || d.regreso;

    return h('article', { class: 'eq-hoja' },
      h('header', { class: 'eq-hoja-cab' },
        escudo ? h('img', { class: 'eq-conv-escudo', src: escudo, alt: '' }) : null,
        h('h2', { class: 'eq-hoja-tit' }, 'Convocatoria de partido'),
      ),
      h('div', { class: 'eq-hoja-tabla' },
        fila('Equipo del Club', d.club || d.equipo),
        fila('Categoría', d.categoria),
        fila('Competición', d.competicion),
        fila('Partido', d.partido),
        fila('Fecha', d.fecha),
        fila('Cancha de juego', d.cancha),
        fila('Hora del partido', d.hora),
        fila('Hora de llegada a la cancha de juego', d.horaLlegada),
        conDesplazamiento ? fila('Hora y Lugar de Salida', d.salida) : null,
        conDesplazamiento ? fila('Hora y Lugar de Regreso (aproximado)', d.regreso) : null,
        fila('Qué llevar al partido', d.llevar),
      ),
      lista('CONVOCADOS', d.convocados, true),
      lista('RESERVA', d.reservas, false),
      lista('DESCANSO', d.descansan, false),
    );
  }

  /* ── Pintado ──────────────────────────────────────────────── */

  function pinta() {
    const d = datos();
    const g = gruposDe(p);
    const falta = loQueFalta(p, { ajustes });
    const avisos = avisosDeCupo(p);
    const fuera = p.es_local === false;

    mount(cont,
      h('div', { class: 'eq-conv-barra no-imprimir' },
        h('a', {
          class: 'eq-volver', href: `/partidos/${p.id}`,
          onClick: (e) => { e.preventDefault(); router.navigate(`/partidos/${p.id}`); },
        }, '‹ Volver al partido'),
        h('div', { class: 'eq-conv-acciones' },
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => window.print() }, 'Imprimir'),
          h('button', {
            class: 'btn btn-primary', type: 'button', onClick: bajarPDF,
          }, 'Descargar PDF'),
        ),
      ),

      h('div', { class: 'view-hero no-imprimir' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, 'Convocatoria'),
          h('h1', { class: 'display view-title' }, equipo?.name || 'Partido'),
          h('p', { class: 'view-meta' }, titular(d)),
        ),
      ),

      !hayGruposConvocatoria()
        ? h('p', { class: 'eq-acta-descuadre no-imprimir' },
            'Falta aplicar la migración 034: la reserva, el descanso y el desplazamiento '
            + 'no se van a guardar todavía. Los convocados sí.')
        : null,

      ...avisos.map((a) => h('p', { class: 'eq-acta-descuadre no-imprimir' }, a)),

      falta.length
        ? h('p', { class: 'eq-ayuda no-imprimir eq-conv-falta' },
            `Falta por poner: ${falta.join(', ')}.`)
        : null,

      /* ── Quién va ─────────────────────────────────────────── */
      h('section', { class: 'eq-cierre-seccion no-imprimir' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'Quién va'),
          h('span', { class: 'eq-ayuda' },
            `${g.convocados.length} de ${CONVOCADOS_MAX} convocados`
            + (g.reservas.length ? ` · ${g.reservas.length} de reserva` : '')
            + (g.descansan.length ? ` · ${g.descansan.length} descansa${g.descansan.length === 1 ? '' : 'n'}` : '')),
        ),
        elegibles.length
          ? h('div', { class: 'eq-conv-plantilla' }, ...porDorsal(elegibles).map(filaJugador))
          : h('p', { class: 'eq-ayuda' }, 'Este equipo no tiene plantilla todavía.'),
      ),

      /* ── Los datos del día ────────────────────────────────── */
      h('section', { class: 'eq-cierre-seccion no-imprimir' },
        h('h2', { class: 'eq-zona-titulo' }, 'El día del partido'),
        h('div', { class: 'eq-conv-campos' },
          campo('Hora de llegada a la cancha',
            h('input', {
              class: 'field-input', type: 'time', value: hhmm(p.convocatoria_hora),
              onChange: (e) => { p.convocatoria_hora = e.target.value || null; marcaSucio(); },
            }),
            ajustes.conv_minutos_antes != null && !p.convocatoria_hora
              ? `En blanco sale ${d.horaLlegada || '—'}: ${ajustes.conv_minutos_antes} minutos antes, como dicen los ajustes del equipo.`
              : 'Si se deja en blanco se calcula sola con los minutos que ponga en ajustes del equipo.'),
          fuera ? campo('Hora de salida',
            h('input', {
              class: 'field-input', type: 'time', value: hhmm(p.salida_hora),
              onChange: (e) => { p.salida_hora = e.target.value || null; marcaSucio(); },
            })) : null,
          fuera ? campo('Lugar de salida',
            h('input', {
              class: 'field-input', type: 'text', maxlength: 120,
              value: p.convocatoria_lugar || '', placeholder: 'Campos Góticos',
              onInput: (e) => { p.convocatoria_lugar = e.target.value; sucio = true; },
              onChange: () => marcaSucio(),
            })) : null,
          fuera ? campo('Regreso (aproximado)',
            h('input', {
              class: 'field-input', type: 'text', maxlength: 160,
              value: p.regreso || '', placeholder: 'sobre las 14:30 en Campos Góticos',
              onInput: (e) => { p.regreso = e.target.value; sucio = true; },
              onChange: () => marcaSucio(),
            }),
            'Aproximado a propósito: una hora exacta promete lo que no se puede cumplir.') : null,
        ),
        !fuera
          ? h('p', { class: 'eq-ayuda' },
              'Se juega en casa, así que no hay desplazamiento que anunciar.')
          : null,
        h('p', { class: 'eq-ayuda' },
          'El club, la categoría, la competición, el pabellón y qué hay que llevar se '
          + 'escriben una vez en los ajustes del equipo y salen solos aquí.'),
      ),

      /* ── La hoja ──────────────────────────────────────────── */
      h('section', { class: 'eq-cierre-seccion eq-conv-vista' },
        h('h2', { class: 'eq-zona-titulo no-imprimir' }, 'Así se va a mandar'),
        d.faltan
          ? h('p', { class: 'eq-ayuda no-imprimir' },
              `${d.faltan} de los marcados ya no están en la plantilla y no salen en el documento.`)
          : null,
        hoja(d),
      ),

      h('div', { class: 'eq-planner-barra no-imprimir' },
        h('div', { class: 'eq-planner-barra-sec' },
          h('span', { class: 'eq-ayuda' }, sucio ? 'Sin guardar' : 'Todo guardado'),
        ),
        h('button', {
          class: 'btn btn-primary', type: 'button', disabled: !sucio || guardando,
          onClick: guardar,
        }, guardando ? 'Guardando…' : 'Guardar'),
      ),
    );
  }

  (async () => {
    try {
      p = await getPartido(params.matchId);
      const equipos = await getMisEquipos();
      equipo = equipos.find((t) => t.id === p.team_id) || null;
      ajustes = equipo || {};
      /* Con bajas incluidas a propósito en el documento: si un crío se
         dio de baja DESPUÉS de convocarlo, el papel tiene que seguir
         diciendo su nombre. Para elegir, solo los activos. */
      jugadores = await getJugadores(p.team_id, { incluirBajas: true });
      elegibles = convocables(jugadores);
      if (equipo?.imagen_path) escudo = await urlImagenEquipo(equipo.imagen_path).catch(() => null);
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir la convocatoria'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary no-imprimir', href: '/sesiones', 'data-link': true }, 'Volver')));
      return;
    }
    pinta();
  })();

  return { destroy() {} };
}
