/* ============================================================
   paso3.js — LA FICHA COMPLETA (Tramo 2.12).

   ── LO QUE ERA ──────────────────────────────────────────────
   Tres cajas de texto libre (objetivos, variantes, notas), un conteo
   de fichas y un desplegable de objetivo de temporada. La biblioteca,
   entretanto, pedía veinte campos. Consecuencia doble y silenciosa:
   un ejercicio hecho en el Taller no pasaba su propio linter, y al
   lado de los 204 importados se veía medio vacío — sin organización
   para doce, sin los tres niveles, sin criterio de éxito. La ficha no
   mentía: es que no se le había preguntado.

   ── LO QUE ES ───────────────────────────────────────────────
   El molde de la biblioteca, entero, en cuatro bloques: la tarjeta,
   cómo se hace, los tres niveles y el grupo. Y al pie, **el listón**:
   las mismas reglas que corren sobre las 204 fichas, en vivo, mientras
   se escribe (ia/lint.js). Lo que aquí sale en verde, entra.

   ── LO QUE SE HA IDO ────────────────────────────────────────
   · el TIPO de ejercicio — ya se elige en el paso 0; aquí se elige el
     BLOQUE DE CONTENIDO, que es otra pregunta (§7);
   · el OBJETIVO DE TEMPORADA — «nada tiene que ver al crear un
     ejercicio» (§7);
   · la DOSIS — retirada del molde por decisión del entrenador (§7):
     prescribir series desde la ficha es decidir por quien tiene el
     grupo delante;
   · VARIANTES — su contenido son ahora los tres niveles de exigencia,
     que son un dato y no un párrafo (D8).

   ── EL PUENTE AL CHAT ───────────────────────────────────────
   Un desplegable arma el envío, el entrenador lo pega en su chat y
   trae la respuesta; la app la vuelca en los huecos VACÍOS y respeta
   lo que ya haya escrito (§2, ia/puente.js). Sin red y sin coste.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { field, chipsSingle, chipsMulti, slider, rangeSlider, spinner, tagInput, collapsible } from '../ui/components.js';
import { CATEGORIAS, dificultadDe } from '../config.js';
import { sugerirDificultad } from './draft.js';
import { revisarBorrador, requisitosSugeridos, BLOQUES_CONTENIDO, MATERIAL } from '../ia/molde.js';
import { DENSIDAD, OPOSICION, PRESION, TAGS } from '../ia/vocabulario.js';
import { armarEnvio, volcar } from '../ia/puente.js';
import { toast } from '../ui/toast.js';

const SIN_DECIDIR = 'sin decidir';

/* Cada eje con su palabra de cara al entrenador. `oposicion` y
   `presion` son DOS preguntas distintas y durante noventa y siete
   fichas fueron una sola: se etiquetan aparte y con su ayuda. */
const OPOSICION_LBL = {
  nula: 'nadie enfrente', pasiva: 'está, no disputa',
  semiactiva: 'condiciona, no impide', real: 'disputa de verdad',
};
const PRESION_LBL = {
  ninguna: 'nada aprieta', espacio: 'el espacio',
  tiempo: 'el reloj', marcador: 'se compite',
};

export function paso3(ctx) {
  const { draft, stage, goTo, onDraftChange } = ctx;

  const r = draft.requisitos;
  // El conteo del tablero es una PROPUESTA: lo dibujado es la muestra
  // (dos o tres fichas, las justas para entender el mecanismo) y el
  // grupo de verdad son doce. Solo rellena lo que esté sin decidir.
  if (!draft.requisitos_manual) Object.assign(r, requisitosSugeridos(stage.board.counts(), r));
  draft.dificultad_sugerida = draft.animacion ? sugerirDificultad(draft.animacion) : null;

  const cambio = () => { pintarListon(); onDraftChange?.(); };

  /* ---- helpers de campo ------------------------------------------ */
  const linea = (key, ph, obj = draft) => h('input', {
    class: 'input', type: 'text', value: obj[key] ?? '', placeholder: ph,
    onInput: (e) => { obj[key] = e.target.value; cambio(); },
  });
  const parrafo = (key, ph, filas = 3, obj = draft) => h('textarea', {
    class: 'textarea', rows: String(filas), placeholder: ph, value: obj[key] ?? '',
    onInput: (e) => { obj[key] = e.target.value; cambio(); },
  });
  const num = (key, { min, max, ph }) => h('input', {
    class: 'input input--num', type: 'number', min: String(min), max: String(max),
    value: r[key] ?? '', placeholder: ph,
    onInput: (e) => { const v = Number(e.target.value); r[key] = Number.isFinite(v) && e.target.value !== '' ? v : null; draft.requisitos_manual = true; cambio(); },
  });
  /* Un eje con «sin decidir» explícito: hasta que se elige, el linter
     lo dice. Un valor de fábrica se vería igual que una decisión. */
  const eje = (key, valores, etiquetas) => chipsSingle(
    valores.map((v) => ({ value: v, label: etiquetas ? `${v} · ${etiquetas[v]}` : v })),
    r[key], (v) => { r[key] = v; cambio(); },
  );

  /* ---- 1 · La tarjeta -------------------------------------------- */
  const bloque = chipsSingle(
    BLOQUES_CONTENIDO.map((b) => ({ value: b.key, label: b.label })),
    draft.category, (v) => { draft.category = v; cambio(); },
  );

  const nivelHost = h('div');
  const pintarNiveles = () => mount(nivelHost, chipsMulti(CATEGORIAS[draft.categoria_rama] || [], draft.categoria_nivel, (vals) => { draft.categoria_nivel = vals; cambio(); }));
  const ramaChips = chipsSingle(['Minibasket', 'Basket'], draft.categoria_rama, (v) => { draft.categoria_rama = v; draft.categoria_nivel = []; pintarNiveles(); cambio(); });
  if (draft.categoria_rama) pintarNiveles();

  const difLabel = h('span', { class: 'dif-pill' });
  const setDif = (v) => { const d = dificultadDe(v); difLabel.textContent = d.label; difLabel.className = `dif-pill ${d.clase}`; };
  const difSlider = slider({ min: 1, max: 6, value: draft.dificultad_valor, onInput: (v) => { draft.dificultad_valor = v; setDif(v); cambio(); }, format: String });
  setDif(draft.dificultad_valor);
  const difSugerida = draft.dificultad_sugerida
    ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => { draft.dificultad_valor = draft.dificultad_sugerida; difSlider.setValue(draft.dificultad_sugerida); setDif(draft.dificultad_sugerida); cambio(); } },
      `La jugada sugiere ${dificultadDe(draft.dificultad_sugerida).label}`)
    : null;

  const INT_LBL = { 1: 'Muy suave', 2: 'Suave', 3: 'Media', 4: 'Alta', 5: 'Máxima' };
  const intLabel = h('span', { class: 'dif-pill' }, INT_LBL[draft.intensidad]);
  const intSlider = slider({ min: 1, max: 5, value: draft.intensidad, onInput: (v) => { draft.intensidad = v; intLabel.textContent = INT_LBL[v]; cambio(); }, format: String });

  const durSlider = rangeSlider({
    min: 1, max: 60, gap: 0,
    valueMin: draft.duracion_min, valueMax: draft.duracion_max ?? draft.duracion_min,
    onInput: ({ min, max }) => { draft.duracion_min = min; draft.duracion_max = max; cambio(); },
    format: (a, b) => (a === b ? `${a} min` : `${a}–${b} min`),
  });

  /* Las sugerencias salen del VOCABULARIO de verdad, no de una lista
     aparte. La que había en config.js tenía siete etiquetas y tres de
     ellas —«pick and roll», «tiro exterior», «2x1»— no existen en
     TAGS: la app sugería etiquetas que su propio linter rechaza, y con
     ellas el ejercicio se caía de las sugerencias del planificador. */
  const tags = tagInput({ value: draft.tags, suggestions: TAGS, onChange: (v) => { draft.tags = v; cambio(); } });

  /* ---- 2 · Cómo se hace ------------------------------------------ */
  /* El paso 2 escribió las líneas de las fases: son un buen punto de
     partida para el desarrollo, pero no son el desarrollo. Se ofrecen,
     no se imponen — volcarlas solas dejaba la ficha con cuatro órdenes
     telegráficas donde tiene que haber un párrafo. */
  const desarrollo = parrafo('descripcion_texto', 'Montaje, reglas, rotación y cuándo se acaba. Es lo que se lee con los niños ya en la pista.', 5);
  const lineasPaso2 = (draft.fases_texto || []).map((f) => (f.texto || '').trim()).filter(Boolean);
  const traer = lineasPaso2.length
    ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => {
      const semilla = lineasPaso2.map((t, i) => `${i + 1}. ${t}`).join('\n');
      draft.descripcion_texto = draft.descripcion_texto ? `${draft.descripcion_texto}\n${semilla}` : semilla;
      desarrollo.value = draft.descripcion_texto;
      cambio();
    } }, 'Traer las fases del paso 2')
    : null;

  /* ---- 3 · Los tres niveles -------------------------------------- */
  const nivel = (k, ph) => parrafo(k, ph, 2, r.niveles);

  /* ---- 4 · El grupo ---------------------------------------------- */
  const material = chipsMulti(MATERIAL, r.material || [], (v) => { r.material = v; cambio(); });
  const simultaneo = chipsSingle(
    [{ value: 'si', label: 'todos a la vez' }, { value: 'no', label: 'por turnos' }],
    r.simultaneo === null || r.simultaneo === undefined ? null : (r.simultaneo ? 'si' : 'no'),
    (v) => { r.simultaneo = v === 'si'; cambio(); },
  );

  const condicionalHost = h('div', { class: 'flow' });
  function pintarCondicionales() {
    /* Dos campos que solo existen en su caso, y por eso solo aparecen
       en su caso: pedirlos siempre entrena a rellenarlos sin mirar. */
    const esAnalitico = (draft.tags || []).includes('analítico');
    mount(condicionalHost,
      esAnalitico ? field('¿Dónde se aplica lo que entrena?', parrafo('aplicacion', 'Un analítico declara en qué formato de juego se usa el patrón (D1).', 2, r)) : null,
      r.densidad === 'baja' ? field('¿Por qué merece la pena con densidad baja?', parrafo('justificacion_densidad', 'La densidad baja exige justificarse (D4).', 2, r)) : null,
    );
  }

  /* ---- El puente al chat ----------------------------------------- */
  const envioHost = h('textarea', { class: 'textarea textarea--mono', rows: '6', readonly: true, 'aria-label': 'Envío para el chat' });
  const respuesta = h('textarea', { class: 'textarea', rows: '5', placeholder: 'Pega aquí la respuesta del chat, entera.' });

  function refrescarEnvio() {
    envioHost.value = armarEnvio(draft, { guion: lineasPaso2.join('. ') });
  }
  refrescarEnvio();

  const puente = collapsible({
    label: 'Pedirle la ficha a tu chat',
    open: false,
    content: h('div', { class: 'flow' },
      h('p', { class: 'muted' }, 'La app arma el envío con lo que ya sabe del ejercicio y con las reglas que la biblioteca va a exigir. Lo pegas en tu chat, traes la respuesta y se vuelca en los huecos vacíos: lo que ya hayas escrito no se toca.'),
      envioHost,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--secondary', type: 'button', onClick: async (e) => {
          refrescarEnvio();
          try { await navigator.clipboard.writeText(envioHost.value); toast('Envío copiado. Pégalo en tu chat.', { type: 'ok' }); }
          catch { envioHost.select(); toast('Selecciónalo y cópialo con Ctrl+C.', { type: 'info' }); }
        } }, 'Copiar el envío'),
      ),
      field('La respuesta', respuesta),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => aplicarRespuesta(false) }, 'Volcar en los huecos'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => aplicarRespuesta(true) }, 'Volcar y pisar lo escrito'),
      ),
    ),
  });

  function aplicarRespuesta(pisar) {
    const res = volcar(draft, respuesta.value, { pisar });
    if (res.error) { toast(res.error, { type: 'error', timeout: 6000 }); return; }
    if (!res.puestos.length) { toast('La respuesta no traía nada nuevo que colocar.', { type: 'warn' }); return; }
    toast(`${res.puestos.length} campo(s) rellenados${res.ignorados.length ? ` · ${res.ignorados.length} respetados porque ya tenían algo` : ''}.`, { type: 'ok', timeout: 5000 });
    repintar();
  }

  /* ---- El listón de la biblioteca -------------------------------- */
  const liston = h('div', { class: 'liston' });

  function pintarListon() {
    const { errores, avisos } = revisarBorrador(draft);
    mount(liston,
      h('p', { class: 'eyebrow' }, 'El listón de la biblioteca'),
      !errores.length
        ? h('p', { class: 'liston__ok' }, avisos.length
          ? `Pasa el linter. ${avisos.length} cosa(s) que mirar, ninguna bloquea.`
          : 'Pasa el linter, sin un solo aviso.')
        : h('p', { class: 'liston__mal' }, `${errores.length} cosa(s) sin resolver. Un ejercicio así no entra en la biblioteca.`),
      errores.length ? h('ul', { class: 'liston__lista liston__lista--error' }, ...errores.map((x) => h('li', null, x))) : null,
      avisos.length ? h('ul', { class: 'liston__lista' }, ...avisos.map((x) => h('li', null, x))) : null,
      h('p', { class: 'muted' }, 'Son las mismas reglas que corren sobre los 204 ejercicios importados. Se puede guardar sin pasarlas; lo que no se puede es que la ficha diga menos de lo que el ejercicio da.'),
    );
    pintarCondicionales();
  }

  /* ---- Montaje ---------------------------------------------------- */
  const el = h('div', { class: 'flow' });

  function repintar() {
    // los campos leen del borrador al construirse, así que volcar la
    // respuesta del chat obliga a rehacerlos
    const nuevo = paso3(ctx);
    el.replaceChildren(...nuevo.el.childNodes);
  }

  el.append(
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Paso 3 · La tarjeta'),
      h('h2', { class: 'section-title' }, 'La ficha del ejercicio'),
      field('La frase de la tarjeta', linea('description', 'Una sola frase, concreta. Es lo primero que se lee y lo que puntúa en las sugerencias.'), { required: true }),
      field('Bloque de contenido', bloque, { required: true, hint: 'Qué se entrena. El tipo de ejercicio se eligió en el paso 0.' }),
      field('Etiquetas', tags, { required: true, hint: 'Sin etiquetas, el ejercicio no aparece en las sugerencias del planificador.' }),
      field('Categoría', h('div', { class: 'flow' }, ramaChips, nivelHost), { hint: 'El nivel solo se acota si el ejercicio es específico de él: para lo demás están los tres niveles de exigencia.' }),
      field('Dificultad', h('div', { class: 'row row--wrap' }, difSlider, difLabel, difSugerida)),
      field('Intensidad física', h('div', { class: 'row row--wrap' }, intSlider, intLabel)),
      field('Duración estimada', durSlider),
      field('Autor', linea('autor_nombre', 'Tu nombre')),
    ),
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Cómo se hace'),
      field('Objetivos', parrafo('objetivos', 'Qué se entrena y PARA QUÉ, con el porqué dentro.'), { required: true }),
      field('Desarrollo', h('div', { class: 'flow' }, desarrollo, traer), { required: true }),
      field('Notas del entrenador', parrafo('notas', 'Qué corregir, qué NO corregir y qué hacer si no sale. Aquí va el oficio.'), { required: true }),
    ),
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Los tres niveles de exigencia'),
      h('p', { class: 'muted' }, 'Sustituyen a la etiqueta de edad: el mismo ejercicio sirve a un niño de 8 y a un cadete cambiando la exigencia. Tres escalones que cambien algo de verdad, no el mismo texto con otras palabras.'),
      field('Base', nivel('base', 'El escalón fácil.'), { required: true }),
      field('Intermedio', nivel('intermedio', 'El de en medio.'), { required: true }),
      field('Avanzado', nivel('avanzado', 'El difícil.'), { required: true }),
    ),
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'El grupo'),
      h('div', { class: 'reqs-grid' },
        field('Jugadores (mínimo)', num('jugadores_min', { min: 1, max: 30, ph: SIN_DECIDIR })),
        field('Jugadores (máximo)', num('jugadores_max', { min: 1, max: 30, ph: SIN_DECIDIR })),
        field('Canastas por estación', num('canastas', { min: 0, max: 2, ph: SIN_DECIDIR })),
        field('Estaciones en paralelo', num('estaciones', { min: 1, max: 6, ph: '1' })),
      ),
      field('¿Trabajan a la vez o por turnos?', simultaneo),
      field('Material', material),
      field('Densidad', eje('densidad', Object.keys(DENSIDAD)), { required: true, hint: 'Acciones por jugador y minuto con el reparto que declaras.' }),
      field('Oposición', eje('oposicion', OPOSICION, OPOSICION_LBL), { required: true, hint: '¿Hay alguien a quien ganar o que te pueda quitar el balón?' }),
      field('Presión', eje('presion', PRESION, PRESION_LBL), { hint: 'Qué aprieta cuando no hay rival. Es otra pregunta que la oposición.' }),
      field('Requisito previo', linea('requisito_previo', 'Qué hay que saber hacer ya. Nunca una edad.', r), { required: true }),
      field('Organización con 12', parrafo('organizacion', 'Qué se hace con doce: cuántos grupos, en qué canasta y cada cuánto se rota.', 3, r), { required: true, hint: 'Tiene que decir el número 12 y un reparto concreto. «Se adapta al grupo» no vale.' }),
      field('Criterio de éxito', parrafo('criterio_exito', 'Cuándo está bien hecho, medible.', 2, r), { required: true }),
      condicionalHost,
      h('div', { class: 'field' },
        h('span', { class: 'field__label' }, 'Tipo de pista'),
        h('p', { class: 'muted mono' }, draft.tipo_pista),
        h('a', { class: 'link', href: '#', onClick: (e) => { e.preventDefault(); goTo(0); } }, 'Cambiar pista'),
      ),
    ),
    puente,
    h('div', { class: 'card' }, liston),
  );

  pintarListon();

  return { el };
}
