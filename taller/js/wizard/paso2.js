/* ============================================================
   paso2.js — DESCRIBIR LA JUGADA, FASE A FASE (Tramo 2.9).

   ── LO QUE ERA ──────────────────────────────────────────────
   Un cuadro de texto grande, un botón «Generar animación» y un
   modelo de pago al otro lado que adivinaba la jugada. Cuando no
   había clave —o no había red— entraba un puñado de regex que
   siempre montaba el mismo ejercicio: bota, pasa, tira. Las dos
   cosas fallaban por lo mismo: adivinaban sobre un vocabulario
   abierto, y cuando no entendían algo se inventaban lo plausible.

   ── LO QUE ES ───────────────────────────────────────────────
   Una lista de FASES. Cada una con su cabecera —duración y pausa—
   y una línea que se escribe con tres ayudas:

     · la barra de acciones escribe la acción por ti;
     · pinchar una ficha de la pista escribe su nombre;
     · pinchar un sitio vacío crea «Posición 1», que se renombra y
       se guarda para el próximo ejercicio.

   Y todo se puede escribir a mano, porque leerlo es buscar palabras
   de dos listas cerradas (ia/frase.js). Debajo del campo se ve, en
   cada tecla, QUÉ se ha entendido y qué no: lo reconocido va
   marcado y lo que no, subrayado. Un modelo, cuando no entendía,
   callaba.

   Determinista y sin red: la animación se rehace sola al dar intro
   o al cambiar de fase. Coste 0 € (§2).

   ── Y EL DESPLEGABLE «MANUALMENTE» (Tramo 2.10) ─────────────
   La misma jugada acción por acción, con desplegables: quién · qué
   hace · hacia qué. Se elige una fase o se crea una nueva y se
   corrige UNA acción sin tocar nada más.

   No guarda un estado propio: enseña lo que el lector ha entendido y,
   al cambiar algo, vuelve a escribir la línea. Guardar aquí una
   segunda verdad y esperar que no se separara de la primera es
   exactamente lo que hacía confuso el paso 2 anterior.

   ── SIN NINGUNA LLAMADA DE PAGO (Tramo 2.11) ────────────────
   Ya no queda nada del camino anterior: ni el cuadro de texto, ni el
   puente a la función de servidor, ni el lector de respaldo por
   regex. Este paso funciona entero sin conexión.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { collapsible } from '../ui/components.js';
import { simularJugada } from '../ia/simulador.js';
import { resolverAnimacion, upsertEdicion } from '../ia/resolver.js';
import { cargarPosiciones, guardarPosicion } from '../supabase/posiciones.js';
import { cargarCatalogo } from '../supabase/acciones.js';
import { CATALOGO_SISTEMA, FAMILIAS } from '../ia/acciones.js';
import { sujetosDelTablero, siguientePosicion, nombreDeSlug } from '../ia/sujetos.js';
import { crearLexico, leerFases, textoDeAccion, escribirFrase, huecosDe, actoresDe, anclarSujetos } from '../ia/frase.js';
import { PISTAS } from '../canvas/court.js';
import { TEAM_LABEL } from '../canvas/colors.js';
import { History } from '../history.js';

const CANASTA_LABEL = { norte: 'Canasta 1', sur: 'Canasta 2' };

/*
   Lo que se puede señalar en la pista: las fichas puestas por el
   entrenador y el aro. Las catorce anclas medidas NO, y no es un
   olvido: pinchar cerca del codo tiene que crear una posición nueva
   (§5.2), y si el codo respondiera al clic no habría forma de marcar
   un sitio propio a dos palmos de él. Se escriben a mano —el lector
   las conoce— o se dejan para lo que son, un vocabulario de apoyo.
*/
const SENALABLE = new Set(['jugador', 'fila', 'fila_miembro', 'cono', 'zona', 'balon', 'material', 'aro']);

const faseVacia = () => ({ texto: '', duracion_ms: null, pausa_post_ms: null });
const seg = (ms) => (Number.isFinite(ms) ? String(Math.round(ms) / 1000) : '');
const aMs = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null; };

export function paso2(ctx) {
  const { draft, stage, onDraftChange } = ctx;

  /* ---- estado del paso ------------------------------------------ */
  if (!Array.isArray(draft.fases_texto) || !draft.fases_texto.length) draft.fases_texto = [faseVacia()];
  if (!draft.posiciones || typeof draft.posiciones !== 'object') draft.posiciones = {};
  draft.ediciones = draft.ediciones || [];

  let catalogo = CATALOGO_SISTEMA;
  let posGuardadas = {};        // las de Supabase para esta pista
  let sujetos = [];
  let lexico = crearLexico({ catalogo, sujetos });
  let lectura = { fases: [], avisos: [], tramos: [] };
  let activa = 0;               // la fase donde escriben los clics
  let edit = null;              // modo «ajustar a mano» (Tramo 6)
  const filas = [];             // { campo, marca, resumen } por fase

  /* Diccionario EFECTIVO: lo guardado para esta pista, pisado por lo
     que se haya marcado en este ejercicio. Mismo orden de prioridad
     que ia/posiciones.js. */
  const posiciones = () => ({ ...posGuardadas, ...draft.posiciones });

  /* Canasta objetivo. Sin decisión previa, la más cercana a lo que hay
     colocado: es la que acierta casi siempre, y el chip la cambia en un
     clic. Preguntarlo antes de empezar, como hacía el flujo viejo, era
     un trámite delante de una respuesta que se ve a simple vista. */
  function canastaActual() {
    const aros = (PISTAS[draft.tipo_pista] && PISTAS[draft.tipo_pista].baskets) || {};
    const claves = Object.keys(aros);
    if (!claves.length) return 'norte';
    if (draft.canasta && aros[draft.canasta]) return draft.canasta;
    if (claves.length === 1) return claves[0];
    const fichas = stage.board.getElementos().filter((e) => e.kind === 'jugador' || e.kind === 'cono');
    if (!fichas.length) return claves[0];
    const cx = fichas.reduce((s, e) => s + e.x, 0) / fichas.length;
    const cy = fichas.reduce((s, e) => s + e.y, 0) / fichas.length;
    return claves.reduce((mejor, k) => (
      Math.hypot(aros[k][0] - cx, aros[k][1] - cy) < Math.hypot(aros[mejor][0] - cx, aros[mejor][1] - cy) ? k : mejor
    ), claves[0]);
  }

  function refrescarVocabulario() {
    sujetos = sujetosDelTablero({
      elementos: stage.board.getElementos(),
      pista: draft.tipo_pista,
      canasta: canastaActual(),
      posiciones: posiciones(),
    });
    lexico = crearLexico({ catalogo, sujetos });
  }

  /* ---- el ciclo: leer, compilar, enseñar ------------------------- */

  let temporizador = null;
  const recompilarPronto = () => { clearTimeout(temporizador); temporizador = setTimeout(recompilar, 500); };

  /* Releer es barato —dos listas de palabras y una pasada por la línea—
     así que se hace en cada tecla: es lo que enseña, mientras se
     escribe, qué palabras ha reconocido la app. Compilar la geometría y
     repintar la pista se espera medio segundo, que es lo que cuesta
     terminar de escribir una palabra. */
  function releer() {
    lectura = leerFases(draft.fases_texto, lexico);
    pintarLineas();
  }

  function recompilar({ animar = false } = {}) {
    clearTimeout(temporizador);
    if (edit) return;             // ajustando flechas a mano: no se pisa
    refrescarVocabulario();
    releer();

    /* Ojo con lo que NO se escribe aquí: `descripcion_texto` es el
       DESARROLLO de la ficha —montaje, reglas, rotación— y lo escribe el
       paso 3. Las líneas de las fases son otra cosa: son la fuente de la
       animación, viven en `fases_texto` y viajan dentro de ella. Volcarlas
       encima del desarrollo dejaba la ficha con cuatro órdenes
       telegráficas donde tiene que haber un párrafo que se lee con los
       niños ya en la pista. El paso 3 las ofrece como punto de partida,
       que es distinto. */
    const hayAlgo = lectura.fases.some((f) => f.eventos.length);
    if (!hayAlgo) {
      draft.animacion = null;
      draft.baseGen = null;
      mirarSinTocar();
      pintarPanel();
      pintarManual();
      onDraftChange?.();
      return;
    }

    const elementos = stage.board.getElementos();
    draft.baseGen = { intent: { canasta: canastaActual(), fases: lectura.fases }, posiciones: posiciones() };
    const anim = resolverAnimacion(draft.baseGen, draft.ediciones, elementos, draft.tipo_pista, { posiciones: posiciones() });
    // los avisos del lector se suman a los del compilador (la fila que no
    // cabe, por ejemplo): los dos hablan de lo mismo y van en el mismo sitio
    anim.warnings = [...lectura.avisos, ...(anim.warnings || [])];
    /* El texto de las fases y las posiciones marcadas viajan DENTRO de la
       animación. Es la única forma de que reabrir un ejercicio devuelva el
       paso 2 tal como se dejó sin inventar una columna nueva, y el sitio
       donde ya vive `_intent` por la misma razón. */
    anim._fases_texto = draft.fases_texto.map((f) => ({ ...f }));
    if (Object.keys(draft.posiciones).length) anim._posiciones = { ...draft.posiciones };
    /* Y el TABLERO (Tramo 2.13). Se puede reconstruir de la animación,
       pero no del todo: la cola dibujada de una fila viene descontada de
       los que salieron a trabajar, y una zona invisible no deja rastro.
       Guardarlo cuesta nada y hace que reabrir un ejercicio devuelva
       exactamente lo que había, no una aproximación. */
    anim._elementos = elementos.map((e) => ({ ...e }));
    draft.animacion = anim;

    if (animar) { stage.showAnimation(anim); desmontarSenalar(); }
    else { stage.showPreview(anim); montarSenalar(); }
    pintarPanel();
    pintarManual();
    onDraftChange?.();
  }

  /** Sin nada escrito todavía: la pista se ve entera y no se toca. */
  function mirarSinTocar() {
    stage.showBoard();
    stage.board.setSoloMirar(true);
    montarSenalar();
  }

  /* ---- señalar en la pista -------------------------------------- */

  let soltarSenalar = null;
  function desmontarSenalar() { if (soltarSenalar) { soltarSenalar(); soltarSenalar = null; } }

  function montarSenalar() {
    if (soltarSenalar) return;    // ya está puesto: `sujetos` lo lee vivo
    soltarSenalar = stage.senalar({
      buscar: (x, y) => masCercano(x, y),
      onPick: (sujeto, xy) => {
        if (sujeto) { insertar(sujeto.nombre); return; }
        // sitio vacío: una posición nueva con nombre, que se puede
        // renombrar y guardar para el próximo ejercicio (§5.2)
        const slug = siguientePosicion(posiciones());
        draft.posiciones[slug] = [Number(xy.x.toFixed(4)), Number(xy.y.toFixed(4))];
        refrescarVocabulario();
        insertar(nombreDeSlug(slug));
      },
    });
  }

  /* El acierto se mide en PÍXELES, no en normalizado: en una media
     pista, la misma distancia normalizada vale casi el doble por el eje
     largo que por el corto, y el radio de agarre saldría ovalado. */
  function masCercano(x, y) {
    const { w, h: alto } = stage.view;
    const radio = Math.max(18, w * 0.05);
    let mejor = null, mejorD = Infinity;
    for (const s of sujetos) {
      if (!SENALABLE.has(s.tipo) || s.x == null) continue;
      const d = Math.hypot((x - s.x) * w, (y - s.y) * alto);
      if (d <= radio && d < mejorD) { mejorD = d; mejor = s; }
    }
    return mejor;
  }

  /* ---- escribir en la fase activa ------------------------------- */

  /**
   * Escribe en la fase activa, donde esté el cursor.
   *
   * `minuscula` distingue las dos cosas que se insertan y que NO son la
   * misma: una acción es vocabulario y a media frase se lee mejor en
   * minúscula; un NOMBRE —«Fila 1», «Posición 2»— es un nombre propio y
   * se escribe tal cual. Cambiarle la caja no rompería la lectura (el
   * lector no distingue mayúsculas), pero sí romper renombrar: buscar
   * «Posición 1» en un texto que dice «posición 1» no encuentra nada.
   */
  function insertar(texto, { minuscula = false } = {}) {
    const fila = filas[activa];
    if (!fila) return;
    const el = fila.campo;
    const ini = el.selectionStart ?? el.value.length;
    const fin = el.selectionEnd ?? ini;
    const antes = el.value.slice(0, ini);
    const despues = el.value.slice(fin);
    const separa = antes && !/\s$/.test(antes) ? ' ' : '';
    const trozo = (minuscula && antes.trim()) ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto;
    el.value = antes + separa + trozo + despues;
    const cursor = (antes + separa + trozo).length;
    draft.fases_texto[activa].texto = el.value;
    el.focus();
    el.setSelectionRange(cursor, cursor);
    recompilar();
  }

  /* ---- la barra de acciones ------------------------------------- */

  /* Una sola barra que se muda a la fase con el foco. Repetirla en cada
     fase llenaría la columna de lo mismo cinco veces; ponerla fija
     arriba obligaría a mirar a otro sitio para saber dónde va a
     escribir. */
  const barra = h('div', { class: 'acc-barra' });

  function pintarBarra() {
    const porFamilia = new Map();
    for (const a of catalogo) {
      if (!porFamilia.has(a.familia)) porFamilia.set(a.familia, []);
      porFamilia.get(a.familia).push(a);
    }
    mount(barra, ...[...porFamilia].map(([fam, lista]) => h('div', { class: 'acc-barra__fila' },
      h('span', { class: 'acc-barra__fam' }, FAMILIAS[fam]?.nombre || fam),
      h('div', { class: 'acc-barra__chips' }, ...lista.map((a) => h('button', {
        class: 'chip chip--accion', type: 'button',
        title: `${a.descripcion || a.nombre}${a.origen === 'club' ? ' · acción del club' : ''}`,
        onClick: () => insertar(textoDeAccion(a), { minuscula: true }),
      }, a.nombre))),
    )));
  }

  /* ---- las fases ------------------------------------------------- */

  const listaFases = h('div', { class: 'fases' });

  function pintarFases() {
    filas.length = 0;
    mount(listaFases, ...draft.fases_texto.map((f, i) => tarjetaFase(f, i)), h('button', {
      class: 'btn btn--ghost fases__add', type: 'button',
      onClick: () => { draft.fases_texto.push(faseVacia()); activa = draft.fases_texto.length - 1; pintarFases(); filas[activa].campo.focus(); recompilar(); },
    }, '+ Agregar fase'));
    colocarBarra();
    pintarLineas();
  }

  function colocarBarra() {
    const fila = filas[activa];
    if (fila) fila.barraHost.append(barra);
  }

  function tarjetaFase(f, i) {
    const campo = h('textarea', {
      class: 'frase__campo', rows: '1', spellcheck: 'false',
      placeholder: i === 0 ? 'Ej: la Fila 1 bota hacia el aro' : 'Qué pasa en esta fase',
      value: f.texto,
      onInput: (e) => { f.texto = e.target.value; releer(); recompilarPronto(); },
      onFocus: () => { if (activa !== i) { activa = i; colocarBarra(); marcarActiva(); } montarSenalar(); },
      onBlur: () => recompilar(),
      onKeyDown: (e) => {
        // Intro genera la animación de esa fase (§5.2). Mayús+Intro
        // parte la línea, por si hace falta respirar dentro de una fase.
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); recompilar(); }
      },
    });
    const marca = h('div', { class: 'frase__marca', 'aria-hidden': 'true' });
    const resumen = h('p', { class: 'frase__resumen' });
    const barraHost = h('div', { class: 'frase__barra' });

    const num = h('input', {
      class: 'input input--ms', type: 'number', min: '0.2', max: '20', step: '0.1',
      value: seg(f.duracion_ms), placeholder: 'auto', 'aria-label': `Duración de la fase ${i + 1}`,
      onChange: (e) => { f.duracion_ms = aMs(e.target.value); recompilar(); },
    });
    const pau = h('input', {
      class: 'input input--ms', type: 'number', min: '0', max: '10', step: '0.1',
      value: seg(f.pausa_post_ms), placeholder: 'auto', 'aria-label': `Pausa tras la fase ${i + 1}`,
      onChange: (e) => { f.pausa_post_ms = aMs(e.target.value); recompilar(); },
    });

    const tarjeta = h('div', { class: 'fase' + (i === activa ? ' is-activa' : ''), dataset: { fase: String(i) } },
      h('div', { class: 'fase__cab' },
        h('span', { class: 'fase__n' }, `Fase ${i + 1}`),
        h('label', { class: 'fase__ajuste' }, 'dura', num, 's'),
        h('label', { class: 'fase__ajuste' }, 'pausa', pau, 's'),
        draft.fases_texto.length > 1 ? h('button', {
          class: 'fase__quitar', type: 'button', 'aria-label': `Quitar la fase ${i + 1}`, title: 'Quitar esta fase',
          onClick: () => {
            draft.fases_texto.splice(i, 1);
            activa = Math.max(0, Math.min(activa, draft.fases_texto.length - 1));
            pintarFases(); recompilar();
          },
        }, '×') : null,
      ),
      barraHost,
      h('div', { class: 'frase' }, marca, campo),
      resumen,
    );
    filas.push({ campo, marca, resumen, tarjeta, barraHost });
    return tarjeta;
  }

  function marcarActiva() {
    filas.forEach((fila, i) => fila.tarjeta.classList.toggle('is-activa', i === activa));
  }

  /* ---- lo que se ha entendido ------------------------------------ */

  function pintarLineas() { filas.forEach((_, i) => pintarLinea(i)); }

  /**
   * Debajo de cada línea, dos cosas distintas y a propósito separadas:
   * el RESALTADO de lo que se ha reconocido (encima del propio texto) y
   * el RESUMEN de lo que va a pasar (en palabras). El primero dice qué
   * palabras han valido; el segundo, si el ejercicio es el que se quería.
   */
  function pintarLinea(i) {
    const fila = filas[i];
    if (!fila) return;
    const texto = draft.fases_texto[i]?.texto || '';
    const tramos = (lectura.tramos && lectura.tramos[i]) || [];
    const trozos = [];
    let cursor = 0;
    for (const t of tramos) {
      if (t.ini > cursor) trozos.push(document.createTextNode(texto.slice(cursor, t.ini)));
      trozos.push(h('span', { class: `mk mk--${t.clase}`, title: t.titulo }, texto.slice(t.ini, t.fin)));
      cursor = t.fin;
    }
    // el salto final evita que el espejo se quede una línea corto cuando
    // el texto acaba en intro (y con él, el campo que va encima)
    trozos.push(document.createTextNode(`${texto.slice(cursor)}\n`));
    mount(fila.marca, ...trozos);

    const fase = lectura.fases && lectura.fases[i];
    const eventos = (fase?.eventos || []).filter((e) => !e._sigueDefendiendo);
    const míos = (lectura.avisos || []).filter((a) => a.fase === i + 1);
    mount(fila.resumen,
      eventos.length ? h('span', { class: 'frase__ok' }, eventos.map(enPalabras).join(' · ')) : null,
      ...míos.map((a) => h('span', { class: 'frase__mal' }, `«${a.texto_original}»: ${a.interpretacion}`)),
    );
  }

  /** Un evento contado como se lo dirías a alguien. */
  function enPalabras(ev) {
    const accion = lexico.porSlug?.get(ev.accion);
    const quien = nombreDe(ev.jugador);
    const partes = [quien, (accion?.nombre || ev.accion).toLowerCase()];
    const a = ev.args || {};
    if (a.destino && typeof a.destino === 'string') partes.push(`→ ${nombreDe(a.destino)}`);
    if (a.companero) partes.push(`con ${nombreDe(a.companero)}`);
    if (Array.isArray(a.sorteando) && a.sorteando.length) partes.push(`pasando por ${a.sorteando.map(nombreDe).join(' y ')}`);
    return partes.join(' ');
  }
  const nombreDe = (ref) => (sujetos.find((s) => s.ref === ref) || {}).nombre || ref;

  /* ---- posiciones marcadas --------------------------------------- */

  const panelPos = h('div', { class: 'pos-panel' });

  function pintarPosiciones() {
    const slugs = Object.keys(draft.posiciones);
    if (!slugs.length) { mount(panelPos); return; }
    mount(panelPos,
      h('p', { class: 'eyebrow' }, 'Posiciones marcadas en esta pista'),
      ...slugs.map((slug) => {
        const nombre = h('input', {
          class: 'input', type: 'text', value: nombreDeSlug(slug), 'aria-label': 'Nombre de la posición',
          onChange: (e) => renombrarPosicion(slug, e.target.value),
        });
        const guardar = h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: async (e) => {
          const b = e.currentTarget;
          const prev = b.textContent;
          b.disabled = true; b.textContent = 'Guardando…';
          try {
            const [x, y] = draft.posiciones[slug];
            await guardarPosicion(draft.tipo_pista, slug, x, y);
            posGuardadas = { ...posGuardadas, [slug]: [x, y] };
            b.textContent = 'Guardada ✓';
          } catch {
            // sin sesión o sin red: la posición sigue valiendo en ESTE
            // ejercicio, que es lo que el entrenador está haciendo ahora
            b.disabled = false; b.textContent = prev;
            ctx.toast?.('No se ha podido guardar para otros ejercicios. En este sigue valiendo.', { type: 'warn' });
          }
        } }, 'Guardar para otros ejercicios');
        return h('div', { class: 'pos-panel__fila' }, nombre, guardar, h('button', {
          class: 'fase__quitar', type: 'button', title: 'Quitar esta posición', 'aria-label': `Quitar ${nombreDeSlug(slug)}`,
          onClick: () => { delete draft.posiciones[slug]; recompilar(); },
        }, '×'));
      }),
    );
  }

  /* Renombrar cambia el nombre EN EL TEXTO también: si no, la línea que
     dice «Posición 1» se quedaría hablando de algo que ya no existe. */
  function renombrarPosicion(slug, nuevo) {
    const limpio = String(nuevo || '').trim();
    const destino = limpio.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, '_').replace(/^_|_$/g, '');
    if (!destino || destino === slug) { pintarPosiciones(); return; }
    if (posiciones()[destino]) { ctx.toast?.(`Ya hay una posición llamada «${nombreDeSlug(destino)}».`, { type: 'warn' }); pintarPosiciones(); return; }
    const antes = nombreDeSlug(slug);
    draft.posiciones[destino] = draft.posiciones[slug];
    delete draft.posiciones[slug];
    const busca = comoSeEscriba(antes);
    for (const f of draft.fases_texto) {
      f.texto = f.texto.replace(busca, limpio);
    }
    pintarFases();
    recompilar();
  }

  /**
   * Un nombre, escrito como cada cual lo escriba: da igual la caja, las
   * tildes y cuántos espacios haya puesto entre palabra y palabra.
   * Renombrar tiene que encontrar la posición aunque el entrenador la
   * escribiera a mano de otra forma; si no, la línea se queda hablando
   * de algo que ya no existe y nadie sabe por qué dejó de funcionar.
   */
  function comoSeEscriba(nombre) {
    // El escapado va PRIMERO; las clases de vocales que se meten después
    // no llevan ninguno de los caracteres que se escapan aquí, así que
    // no se pisan entre ellas.
    const flexible = String(nombre)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/[aáàäâ]/gi, '[aáàäâ]')
      .replace(/[eéèëê]/gi, '[eéèëê]')
      .replace(/[iíìïî]/gi, '[iíìïî]')
      .replace(/[oóòöô]/gi, '[oóòöô]')
      .replace(/[uúùüû]/gi, '[uúùüû]')
      .replace(/\s+/g, '\\s+');
    return new RegExp(flexible, 'gi');
  }

  /* ---- el panel de abajo: chips, avisos y botones ----------------- */

  const panel = h('div', { class: 'ia-status' });

  function pintarPanel() {
    pintarPosiciones();
    const anim = draft.animacion;
    if (!anim) {
      mount(panel, h('p', { class: 'muted' },
        'Escribe qué pasa en la fase 1. Pulsa una acción de la barra, o pincha una ficha de la pista para nombrarla.'));
      return;
    }
    /* Dos listas separadas y no una: «no entiendo esta palabra» y «esta
       fila no cabe en la pista» son averías distintas y se arreglan en
       sitios distintos —una escribiendo, la otra volviendo al paso 1—.
       Bajo un solo título, la segunda parece un fallo de redacción y el
       entrenador se queda reescribiendo una frase que estaba bien. */
    const avisos = anim.warnings || [];
    const deLectura = avisos.filter((w) => w.campo === 'frase');
    const deLaPista = avisos.filter((w) => w.campo !== 'frase');
    mount(panel,
      deLectura.length ? bannerAvisos('⚠ Esto se ha quedado sin entender:', deLectura) : null,
      deLaPista.length ? bannerAvisos('⚠ Revisa la colocación:', deLaPista) : null,
      (anim._descartadas && anim._descartadas.length) ? bannerDescartadas(anim._descartadas.length) : null,
      tarjeta(anim),
    );
  }

  function tarjeta(anim) {
    const chips = [];
    const aros = Object.keys((PISTAS[anim.pista] && PISTAS[anim.pista].baskets) || {});
    if (anim.canasta) {
      const editable = aros.length > 1;
      chips.push(h('button', {
        class: 'chip' + (editable ? '' : ' chip--info'), type: 'button', disabled: !editable,
        title: editable ? 'Cambiar la canasta a la que se ataca' : null,
        onClick: editable ? () => { draft.canasta = aros[(aros.indexOf(anim.canasta) + 1) % aros.length]; recompilar(); } : null,
      }, (CANASTA_LABEL[anim.canasta] || anim.canasta) + (editable ? ' ▾' : '')));
    }
    const porEquipo = {};
    for (const j of anim.jugadores || []) porEquipo[j.equipo] = (porEquipo[j.equipo] || 0) + 1;
    const eq = Object.keys(porEquipo).sort().map((k) => `${porEquipo[k]} × ${TEAM_LABEL[k] || k}`).join(' · ');
    if (eq) chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, eq));
    if (anim.rondas > 1) chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `${anim.rondas} rondas de fila`));
    chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `${(anim.fases || []).length} fase${anim.fases.length === 1 ? '' : 's'}`));

    return h('div', { class: 'q-card preview-card' },
      h('div', { class: 'q-opts' }, ...chips),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => recompilar({ animar: true }) }, 'Animar'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { stage.showPreview(anim); montarSenalar(); } }, 'Ver el planteamiento'),
      ),
    );
  }

  function bannerAvisos(titulo, avisos) {
    return h('div', { class: 'ia-banner ia-banner--warn' },
      h('p', null, h('b', null, titulo)),
      h('ul', null, ...avisos.map((w) => h('li', null, `${w.fase ? `Fase ${w.fase} · ` : ''}«${w.texto_original}» — ${w.interpretacion}`))),
    );
  }
  function bannerDescartadas(n) {
    return h('div', { class: 'ia-banner ia-banner--warn' },
      h('span', null, `${n} retoque${n > 1 ? 's' : ''} manual${n > 1 ? 'es' : ''} ya no encaja${n > 1 ? 'n' : ''} con esta jugada.`),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => { draft.ediciones = []; recompilar(); } }, 'Descartar retoques'),
    );
  }

  /* ---- «Manualmente» (Tramo 2.10) --------------------------------
     Seleccionar una fase —o crear una nueva— y corregir UNA acción sin
     tocar nada más. Es la misma jugada vista de otra manera: los
     desplegables enseñan lo que el lector ha entendido y, al cambiar
     algo, vuelven a escribir la línea.

     La línea sigue siendo la única verdad. Guardar aquí un estado
     aparte daría dos, y en cuanto se separaran nadie sabría cuál manda
     — que es lo que hacía confuso el paso 2 anterior. El banco de
     pruebas exige que leer→escribir→leer dé los mismos eventos: si no,
     tocar un desplegable cambiaría la jugada por su cuenta. */

  const panelManual = h('div', { class: 'manual' });
  let faseManual = 0;

  const ACTOR = new Set(['jugador', 'fila', 'fila_miembro']);
  const eventosDe = (i) => (lectura.fases?.[i]?.eventos || []).filter((e) => !e._sigueDefendiendo);

  /* Reescribe la línea desde sus eventos. El sujeto se nombra SIEMPRE
     en el primer evento: dejarlo implícito ataría esta fase a lo que
     diga la anterior, y entonces corregir una fase sí tocaría otra. */
  function aplicarEventos(i, eventos) {
    /* Quién actuaba en cada fase ANTES de tocar nada. Cambiar la fase i
       puede cambiar, por el arrastre del sujeto, quién actúa en las
       siguientes; a las que se vieran afectadas se les escribe el
       nombre delante para que se queden como estaban. Corregir una
       acción de una fase no puede mover otra. */
    const actores = actoresDe(lectura.fases || []);
    draft.fases_texto[i].texto = escribirFrase(eventos, { lexico, nombreDe: (r) => nombreDe(r) });
    draft.fases_texto = anclarSujetos(draft.fases_texto, lexico, { nombreDe: (r) => nombreDe(r), actores, desde: i });
    pintarFases();
    recompilar();
  }

  function opciones(valor, lista, onChange, vacio = '—') {
    const sel = h('select', { class: 'select select--sm', onChange: (e) => onChange(e.target.value || null) },
      h('option', { value: '' }, vacio),
      ...lista.map((o) => h('option', { value: o.valor, selected: o.valor === valor }, o.texto)),
    );
    sel.value = valor == null ? '' : String(valor);
    return sel;
  }

  function filaAccion(i, k, ev) {
    const accion = lexico.porSlug?.get(ev.accion);
    if (!accion) return null;
    const cambiar = (patch) => {
      const lista = eventosDe(i).map((e, n) => (n === k ? { ...e, ...patch, args: { ...(patch.args ?? e.args) } } : e));
      aplicarEventos(i, lista);
    };

    const quien = opciones(ev.jugador,
      sujetos.filter((s) => ACTOR.has(s.tipo)).map((s) => ({ valor: s.ref, texto: s.nombre })),
      (v) => v && cambiar({ jugador: v }), 'quién');

    /* Al cambiar de acción, los complementos se sueltan: los huecos de
       «bloquea» no son los de «tira», y arrastrarlos dejaría un dato
       colgando de un sitio donde no cabe. */
    const que = opciones(ev.accion,
      catalogo.map((a) => ({ valor: a.slug, texto: a.nombre })),
      (v) => v && cambiar({ accion: v, args: {} }), 'qué hace');

    const complementos = huecosDe(accion).map((hu) => {
      const cabe = sujetos.filter((s) => hu.tipos.includes(s.tipo));
      if (!cabe.length) return null;
      if (hu.lista) {
        const puestos = Array.isArray(ev.args?.[hu.hueco]) ? ev.args[hu.hueco] : [];
        return h('span', { class: 'manual__hueco' }, h('span', { class: 'manual__prep' }, hu.etiqueta),
          h('span', { class: 'q-opts' }, ...cabe.map((s) => h('button', {
            class: 'chip chip--sm' + (puestos.includes(s.ref) ? ' is-active' : ''), type: 'button',
            onClick: () => {
              const nuevo = puestos.includes(s.ref) ? puestos.filter((r) => r !== s.ref) : [...puestos, s.ref];
              cambiar({ args: { ...ev.args, [hu.hueco]: nuevo } });
            },
          }, s.nombre))));
      }
      const actual = typeof ev.args?.[hu.hueco] === 'string' ? ev.args[hu.hueco] : null;
      return h('span', { class: 'manual__hueco' }, h('span', { class: 'manual__prep' }, hu.etiqueta),
        opciones(actual, cabe.map((s) => ({ valor: s.ref, texto: s.nombre })),
          (v) => cambiar({ args: { ...ev.args, [hu.hueco]: v } }), hu.pedido ? '(falta)' : '—'));
    }).filter(Boolean);

    return h('div', { class: 'manual__accion' + (complementos.length ? '' : ' is-simple') },
      quien, que, ...complementos,
      h('button', {
        class: 'fase__quitar', type: 'button', title: 'Quitar esta acción', 'aria-label': 'Quitar esta acción',
        onClick: () => aplicarEventos(i, eventosDe(i).filter((_, n) => n !== k)),
      }, '×'),
    );
  }

  function pintarManual() {
    if (edit) return;                     // ajustando flechas: manda su barra
    const n = draft.fases_texto.length;
    faseManual = Math.max(0, Math.min(faseManual, n - 1));
    const eventos = eventosDe(faseManual);
    const primerActor = sujetos.find((s) => ACTOR.has(s.tipo));

    mount(panelManual,
      h('div', { class: 'q-opts' },
        ...draft.fases_texto.map((_, i) => h('button', {
          class: 'chip' + (i === faseManual ? ' is-active' : ''), type: 'button',
          onClick: () => { faseManual = i; activa = i; marcarActiva(); colocarBarra(); pintarManual(); },
        }, `Fase ${i + 1}`)),
        h('button', {
          class: 'chip chip--otro', type: 'button',
          onClick: () => {
            draft.fases_texto.push(faseVacia());
            faseManual = activa = draft.fases_texto.length - 1;
            pintarFases(); recompilar();
          },
        }, '+ fase nueva'),
      ),
      eventos.length
        ? h('div', { class: 'manual__lista' }, ...eventos.map((ev, k) => filaAccion(faseManual, k, ev)))
        : h('p', { class: 'muted' }, 'Esta fase todavía no hace nada. Añade una acción o escríbela arriba.'),
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button', disabled: !primerActor,
          onClick: () => {
            const base = eventos[eventos.length - 1];
            aplicarEventos(faseManual, [...eventos, {
              jugador: base?.jugador || primerActor.ref, accion: 'corta', args: {},
            }]);
          },
        }, '+ añadir acción'),
        (draft.animacion && draft.animacion.fases?.length) ? h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onClick: () => entrarEdicion(draft.animacion, faseManual),
        }, 'Ajustar las flechas de esta fase') : null,
      ),
    );
  }

  const manual = collapsible({
    label: 'Manualmente',
    open: false,
    content: h('div', { class: 'flow' },
      h('p', { class: 'muted' }, 'Lo mismo que hay escrito arriba, acción por acción. Cambia una y la línea se reescribe sola.'),
      panelManual,
    ),
  });

  /* ---- ajustar las flechas a mano (Tramo 6, base del 2.10) -------- */

  function entrarEdicion(data, fase = 0) {
    desmontarSenalar();
    const elementos = stage.board.getElementos();
    const work = resolverAnimacion(draft.baseGen, draft.ediciones, elementos, data.pista, { posiciones: posiciones() });
    work.warnings = data.warnings || [];
    draft.animacion = work;
    const editor = stage.showEditor(work, { onChange: onEdit, onSelect: () => pintarBarraEdicion() });
    // se entra por la fase que se estaba corrigiendo, no por la primera
    editor.setFase(Math.max(0, Math.min(fase, (work.fases || []).length - 1)));
    const hist = new History(
      () => ({ ediciones: JSON.parse(JSON.stringify(draft.ediciones)) }),
      (s) => { draft.ediciones = JSON.parse(JSON.stringify(s.ediciones)); reresolver(); },
    );
    hist.onChange = () => pintarBarraEdicion();
    edit = { editor, hist, elementos, pista: data.pista };
    hist.push();
    pintarBarraEdicion();
  }

  function reresolver() {
    const nuevo = resolverAnimacion(draft.baseGen, draft.ediciones, edit.elementos, edit.pista, { posiciones: posiciones() });
    nuevo.warnings = draft.animacion?.warnings || [];
    draft.animacion = nuevo;
    edit.editor.setAnim(nuevo);
  }

  /* Traduce la flecha recién arrastrada a retoques. Siempre el trazo
     exacto ('ruta'); y además el DESTINO cuando el evento que la dibuja
     lo declaró el entrenador, para que la defensa vuelva a reaccionar al
     punto nuevo. Un defensor que solo sigue defendiendo (arrastrado por
     el lector, no escrito) no fija destino: se conserva como trazo. */
  function derivarOps(editor) {
    const sel = editor.sel;
    if (!sel || !sel.ref) return [];
    const ref = sel.ref;
    const elemento = ref.elemento_id || ref.de_id;
    if (!elemento) return [];
    const fase = editor.k;
    const path = JSON.parse(JSON.stringify(sel.path));
    const kind = ref.elemento_id ? 'mov' : 'pase';
    const ops = [{ fase, elemento, op: 'ruta', kind, valor: path }];
    if (ref.elemento_id && ['carrera_con_balon', 'corte', 'carrera_sin_balon'].includes(ref.tipo_movimiento)) {
      const evs = draft.baseGen?.intent?.fases?.[fase]?.eventos || [];
      const suyo = evs.find((e) => e && e.jugador === elemento && !e._sigueDefendiendo && !e._reactiva);
      if (suyo) {
        const fin = path[path.length - 1];
        ops.push({ fase, elemento, op: 'destino', valor: { x: fin.x, y: fin.y } });
      }
    }
    return ops;
  }

  function onEdit() {
    if (!edit) return;
    for (const op of derivarOps(edit.editor)) draft.ediciones = upsertEdicion(draft.ediciones, op);
    reresolver();
    edit.hist.push();
    onDraftChange?.();
  }

  function pintarBarraEdicion() {
    if (!edit) return;
    const { editor, hist } = edit;
    const work = draft.animacion;
    const k = editor.k, n = (work.fases || []).length;
    mount(panel, h('div', { class: 'q-card' },
      h('p', { class: 'q-text' }, 'Arrastra los puntos de una flecha; pincha en la línea para añadir uno, DOBLE clic en un punto para curvarlo, Supr para borrarlo. Mover a un atacante recoloca a su defensor y el arranque de las fases siguientes.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: k <= 0, onClick: () => { editor.setFase(k - 1); pintarBarraEdicion(); } }, '‹ Fase'),
        h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `Fase ${k + 1} / ${n}`),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: k >= n - 1, onClick: () => { editor.setFase(k + 1); pintarBarraEdicion(); } }, 'Fase ›'),
      ),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: !hist.canUndo(), onClick: () => hist.undo() }, 'Deshacer'),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: !hist.canRedo(), onClick: () => hist.redo() }, 'Rehacer'),
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { edit = null; recompilar(); pintarManual(); } }, 'Hecho'),
      ),
    ));
  }

  /* ---- simulación ataque-defensa (Tramo 5b) ---------------------- */

  function simular(canastaForzada = null) {
    if (draft.semilla_sim == null) draft.semilla_sim = 1;
    const data = simularJugada({ elementos: stage.board.getElementos(), pista: draft.tipo_pista, canasta: canastaForzada || canastaActual(), semilla: draft.semilla_sim });
    if (data.error) { mount(panel, h('div', { class: 'ia-banner ia-banner--error' }, h('span', null, data.error))); return; }
    draft.baseGen = { intent: data._intent, posiciones: posiciones() };
    draft.animacion = data;
    stage.showPreview(data);
    montarSenalar();
    pintarPanel();
  }

  /* ---- simular una jugada (Tramo 5b) -----------------------------
     No tiene nada que ver con el camino de IA que se ha retirado: es
     el simulador determinista de ataque-defensa, que juega la
     colocación que hay en la pista y sale siempre igual con la misma
     semilla. Estaba metido en la sección del generador viejo, y al
     borrarla se ha quedado en la suya. */
  const simulacion = collapsible({
    label: 'Simular una jugada',
    open: false,
    content: h('div', { class: 'flow' },
      h('p', { class: 'muted' }, 'Con la colocación que hay en la pista, el equipo del que lleva el balón ataca buscando tiro y el otro defiende. Sale siempre igual; «otra variante» prueba otra.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => simular() }, 'Simular ataque-defensa'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { draft.semilla_sim = (draft.semilla_sim || 1) + 1; simular(); } }, 'Otra variante'),
      ),
    ),
  });

  /* ---- montaje ---------------------------------------------------- */

  const el = h('div', { class: 'card flow' },
    h('p', { class: 'eyebrow' }, 'Paso 2'),
    h('h2', { class: 'section-title' }, 'Describe las acciones'),
    h('p', { class: 'muted' }, 'Una línea por fase. Pincha en la pista para nombrar una ficha o marcar un sitio; los elementos no se mueven aquí.'),
    listaFases,
    panelPos,
    panel,
    manual,
    simulacion,
  );

  pintarBarra();
  pintarFases();
  /* Rehacer la animación al entrar cubre lo que pide §5.2 —cambiar una
     posición inicial en el paso 1 rehace la fase— y lo cubre entero: se
     rehacen TODAS las fases, no solo la primera, porque mover una ficha
     puede cambiar cualquiera de ellas. */
  recompilar();

  // el vocabulario del club y las posiciones guardadas llegan por red y
  // se suman cuando llegan: el paso funciona entero sin ellos
  (async () => {
    const [cat, pos] = await Promise.all([
      cargarCatalogo().catch(() => null),
      cargarPosiciones(draft.tipo_pista).catch(() => ({})),
    ]);
    if (cat && cat.acciones && cat.acciones.length) catalogo = cat.acciones;
    posGuardadas = pos || {};
    pintarBarra();
    recompilar();
  })();

  return {
    el,
    destroy() { clearTimeout(temporizador); desmontarSenalar(); stage.board.setSoloMirar(false); },
  };
}
