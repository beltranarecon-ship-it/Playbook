/* ============================================================
   paso2.js — Descripción de acciones e IA (§8).
   Textarea collapsible + "Generar animación" -> Netlify Function
   (con mock local). Flujo de preguntas tipo A (posición en pista)
   y tipo B (opciones), y banner de warnings.
   ============================================================ */

import { h, mount, icon } from '../ui/dom.js';
import { collapsible } from '../ui/components.js';
import { generarAnimacion, necesitaPreguntaCanasta, recompilarConCanasta } from '../ia/client.js';
import { simularJugada } from '../ia/simulador.js';
import { resolverAnimacion, upsertEdicion } from '../ia/resolver.js';
import { cargarPosiciones, guardarPosicion } from '../supabase/posiciones.js';
import { PISTAS } from '../canvas/court.js';
import { TEAM_LABEL } from '../canvas/colors.js';
import { History } from '../history.js';

// Nombre de cada aro de cara al entrenador (misma convención que stage.js e
// ia/client.js: Canasta 1 = clave 'norte', Canasta 2 = clave 'sur').
const CANASTA_LABEL = { norte: 'Canasta 1', sur: 'Canasta 2' };

const PLACEHOLDER = `Escríbelo como se lo explicarías a un compañero entrenador.

Ej: El base (1) parte desde el centro con balón. Bota hacia la derecha y pasa al alero (3) en el ala. El alero recibe, corta a canasta y entra. Mientras, el base corre al lado contrario para el rebote de ataque.`;

export function paso2(ctx) {
  const { draft, stage } = ctx;
  let generated = !!draft.animacion;

  const ta = h('textarea', {
    class: 'textarea', rows: '8', placeholder: PLACEHOLDER, value: draft.descripcion_texto,
    onInput: (e) => { draft.descripcion_texto = e.target.value; },
  });
  const statusHost = h('div', { class: 'ia-status' });
  const btn = h('button', { class: 'btn btn--primary has-arrow', type: 'button', onClick: () => generar() },
    generated ? 'Regenerar animación' : 'Generar animación');
  // Tramo 5b: simulación completa — el equipo del portador ataca buscando
  // tiro y el otro defiende (individual con ayudas). Sin texto ni preguntas.
  const btnSimular = h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => simular() }, 'Simular ataque-defensa');

  /* Simula con la colocación actual del tablero. Determinista: misma
     colocación + misma semilla ⇒ misma jugada; "Otra variante" (en la
     tarjeta de confirmación) incrementa la semilla. canastaForzada
     permite al chip de canasta re-simular hacia el otro aro. */
  function simular(canastaForzada = null) {
    if (draft.semilla_sim == null) draft.semilla_sim = 1;
    btnSimular.disabled = true;
    mount(statusHost);
    const data = simularJugada({ elementos: stage.board.getElementos(), pista: draft.tipo_pista, canasta: canastaForzada, semilla: draft.semilla_sim });
    btnSimular.disabled = false;
    if (data.error) { mount(statusHost, banner('error', data.error)); return; }
    const shown = aplicarBaseConEdiciones(data);
    generated = true;
    btn.textContent = 'Regenerar animación';
    mostrarConfirmacion(shown);
  }

  // Tope de rondas de preguntas: un modelo que pregunte algo nuevo en cada
  // vuelta no puede tener al entrenador en un interrogatorio infinito.
  const MAX_RONDAS = 3;

  // Diccionario custom de posiciones con nombre (Tramo 2.3): se carga de
  // Supabase UNA vez por pista (caché) al generar y se inyecta al motor.
  // Los clics a preguntas q_pos_* lo actualizan en caliente (y se persisten).
  let posCustom = null;
  let posCustomPista = null;
  async function posicionesDePista(pista) {
    if (posCustomPista !== pista) {
      posCustom = await cargarPosiciones(pista); // {} si no hay sesión/red
      posCustomPista = pista;
    }
    return posCustom;
  }

  async function generar(respuestas = null, ronda = 0) {
    // Pregunta obligatoria de canasta (pista de dos aros sin resolver): es
    // determinista y local — se pregunta ANTES de llamar al generador, por el
    // mismo flujo de preguntas de la IA. generarAnimacion() la re-comprueba
    // igualmente por si otro llamador se salta este paso.
    const qCanasta = necesitaPreguntaCanasta(draft.descripcion_texto, draft.tipo_pista, respuestas);
    if (qCanasta) { runPreguntas([qCanasta], respuestas || [], ronda + 1); return; }
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = 'Procesando…';
    btn.classList.add('is-loading');
    mount(statusHost);
    const posicionesCustom = await posicionesDePista(draft.tipo_pista);
    const data = await generarAnimacion({ texto: draft.descripcion_texto, elementos: stage.board.getElementos(), pista: draft.tipo_pista, respuestas, posicionesCustom });
    btn.disabled = false;
    btn.classList.remove('is-loading');

    if (data.error) { mount(statusHost, banner('error', data.error)); btn.textContent = prev; return; }
    if (Array.isArray(data.preguntas) && data.preguntas.length) {
      btn.textContent = prev;
      // dedupe: no repetir preguntas cuyo id ya fue respondido en rondas previas
      const contestadas = new Set((respuestas || []).map((r) => r && r.id));
      const nuevas = data.preguntas.filter((q) => q && q.id && !contestadas.has(q.id));
      if (!nuevas.length || ronda >= MAX_RONDAS) {
        // sin preguntas nuevas (todo repetido) o tope alcanzado: error
        // accionable en vez de otra vuelta de interrogatorio.
        mount(statusHost, banner('error', 'No se pudo concretar la jugada con estas respuestas. Amplía la descripción del ejercicio y vuelve a generar.'));
        return;
      }
      runPreguntas(nuevas, respuestas || [], ronda + 1);
      return;
    }

    // éxito: READBACK visual (§Tramo 1) — vista previa del planteamiento
    // (fotograma 0 en pausa, canasta objetivo resaltada) + tarjeta de
    // confirmación con chips. La animación solo arranca con "Animar".
    // Tramo 6.2: si había retoques manuales, se re-resuelven sobre la nueva
    // base y los que no encajan se avisan.
    const shown = aplicarBaseConEdiciones(data);
    generated = true;
    btn.textContent = 'Regenerar animación';
    mostrarConfirmacion(shown);
  }

  /* ---- confirmación visual (§Tramo 1.1) ----
     Pinta la vista previa en la pista y, en statusHost, el warningsBanner de
     siempre (si hay warnings) + aviso de retoques descartados (Tramo 6.2) +
     la tarjeta con chips y "Animar"/"Corregir"/"Ajustar a mano". */
  function mostrarConfirmacion(data) {
    stage.showPreview(data);
    mount(statusHost,
      (data.warnings && data.warnings.length) ? warningsBanner(data.warnings) : null,
      (data._descartadas && data._descartadas.length) ? bannerDescartadas(data._descartadas.length) : null,
      tarjetaPreview(data),
    );
  }

  /* ---- intención base + capa de overrides (Tramo 6.2) ---------------------
     draft.baseGen = la intención con la que re-resolver (la dejan regex/IA/
     simulador en _intent). draft.ediciones = los retoques manuales. Cada
     generación nueva conserva las ediciones y las re-resuelve sobre la nueva
     base; las que ya no encajan se avisan (data._descartadas). */
  function setBase(data) {
    draft.baseGen = (data && data._intent)
      ? { intent: data._intent, posiciones: posCustom || null }
      : null; // geometría legada sin intención: solo edición directa
  }
  function aplicarBaseConEdiciones(data) {
    setBase(data);
    const eds = draft.ediciones || [];
    if (draft.baseGen && eds.length) {
      const resuelto = resolverAnimacion(draft.baseGen, eds, stage.board.getElementos(), data.pista, { posiciones: draft.baseGen.posiciones });
      resuelto.warnings = data.warnings || [];
      resuelto._mock = data._mock;
      if ('_ia' in data) resuelto._ia = data._ia;
      if (data._sim) resuelto._sim = data._sim;
      draft.animacion = resuelto;
      return resuelto;
    }
    draft.animacion = data;
    return data;
  }

  function bannerDescartadas(n) {
    return h('div', { class: 'ia-banner ia-banner--warn' },
      h('span', null, `${n} retoque${n > 1 ? 's' : ''} manual${n > 1 ? 'es' : ''} ya no encaja${n > 1 ? 'n' : ''} con esta jugada.`),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => descartarRetoques() }, 'Descartar retoques'),
    );
  }
  function descartarRetoques() {
    draft.ediciones = [];
    const base = draft.baseGen; const prev = draft.animacion;
    if (base && base.intent) {
      const limpio = resolverAnimacion(base, [], stage.board.getElementos(), prev.pista, { posiciones: base.posiciones });
      limpio.warnings = (prev.warnings || []).filter((w) => w && w.campo !== 'canasta');
      limpio._mock = prev._mock; if ('_ia' in prev) limpio._ia = prev._ia; if (prev._sim) limpio._sim = prev._sim;
      draft.animacion = limpio;
      mostrarConfirmacion(limpio);
    }
  }

  /* ---- modo edición manual (Tramo 6) --------------------------------------
     Monta el EditorCanvas sobre la pista para retocar flechas y trayectorias.
     Con intención base los retoques se guardan como overrides (draft.ediciones)
     y cada cambio RE-RESUELVE: la defensa reactiva vuelve a colocarse y las
     fases siguientes arrancan de la nueva posición. Sin intención base
     (geometría legada) se edita la geometría directa (restPositions propaga).
     Undo/redo con la misma pila del editor grande. */
  let edit = null; // { editor, hist, base, resolver, elementos, pista } al editar
  function entrarEdicion(data) {
    const base = draft.baseGen;
    const resolver = !!(base && base.intent);
    draft.ediciones = draft.ediciones || [];
    const elementos = stage.board.getElementos();
    const work = resolver
      ? resolverAnimacion(base, draft.ediciones, elementos, data.pista, { posiciones: base.posiciones })
      : JSON.parse(JSON.stringify(data));
    work.warnings = data.warnings || [];
    draft.animacion = work;
    generated = true;
    const editor = stage.showEditor(work, { onChange: onEdit, onSelect: () => paintToolbar() });
    const hist = new History(snapshotEdit, restoreEdit);
    hist.onChange = () => paintToolbar();
    edit = { editor, hist, base, resolver, elementos, pista: data.pista };
    hist.push();
    paintToolbar();
  }

  function snapshotEdit() {
    return edit && edit.resolver
      ? { ediciones: JSON.parse(JSON.stringify(draft.ediciones)) }
      : { anim: JSON.parse(JSON.stringify(draft.animacion)) };
  }
  function restoreEdit(s) {
    if (!edit) return;
    if (edit.resolver) { draft.ediciones = JSON.parse(JSON.stringify(s.ediciones)); reresolver(); }
    else {
      const w = draft.animacion, a = s.anim;
      w.jugadores = a.jugadores; w.balones = a.balones; w.conos = a.conos; w.fases = a.fases;
      edit.editor.refresh();
    }
  }

  // re-resuelve la geometría desde la base + las ediciones actuales y la vuelca
  // al editor conservando la fase visible.
  function reresolver() {
    const prevWarn = draft.animacion && draft.animacion.warnings;
    const nuevo = resolverAnimacion(edit.base, draft.ediciones, edit.elementos, edit.pista, { posiciones: edit.base.posiciones });
    nuevo.warnings = prevWarn || [];
    draft.animacion = nuevo;
    edit.editor.setAnim(nuevo);
  }

  // traduce la flecha recién editada a operaciones de override (Tramo 6.2):
  // siempre 'ruta' (el trazo exacto) y, para bote/corte/defiende que EXISTAN en
  // la intención base, también 'destino' (para que la defensa re-reaccione al
  // nuevo punto). Un defensor reactivo inyectado no está en la base: solo 'ruta'
  // (sin falso descartado).
  function derivarOps(editor, base) {
    const sel = editor.sel;
    if (!sel || !sel.ref) return [];
    const ref = sel.ref;
    const fase = editor.k;
    const elemento = ref.elemento_id || ref.de_id;
    if (!elemento) return [];
    const path = JSON.parse(JSON.stringify(sel.path));
    // kind distingue el trazo cuando un jugador tiene movimiento Y pase en la
    // MISMA fase (un pase trae de_id, no elemento_id): sin él el resolver
    // localizaría por id y el movimiento ganaría siempre, pisando el pase.
    const kind = ref.elemento_id ? 'mov' : 'pase';
    const ops = [{ fase, elemento, op: 'ruta', kind, valor: path }];
    if (ref.elemento_id && ['carrera_con_balon', 'corte', 'carrera_sin_balon'].includes(ref.tipo_movimiento)) {
      const evs = (base && base.intent && base.intent.fases && base.intent.fases[fase] && base.intent.fases[fase].eventos) || [];
      // solo un evento DECLARADO por el entrenador fija su destino en la
      // intención; un `defiende` inyectado por la defensa reactiva (_reactiva)
      // NO — así el defensor reactivo arrastrado se conserva como trazo ('ruta')
      // y sigue re-reaccionando (evita, además, un falso "retoque no encaja").
      if (evs.some((e) => e && e.jugador === elemento && !e._reactiva && (e.tipo === 'bote' || e.tipo === 'corte' || e.tipo === 'defiende'))) {
        const fin = path[path.length - 1];
        ops.push({ fase, elemento, op: 'destino', valor: { x: fin.x, y: fin.y } });
      }
    }
    return ops;
  }

  function onEdit() {
    if (!edit) return;
    if (edit.resolver) {
      for (const op of derivarOps(edit.editor, edit.base)) draft.ediciones = upsertEdicion(draft.ediciones, op);
      reresolver();
    }
    edit.hist.push();
  }

  function paintToolbar() {
    if (!edit) return;
    const { editor, hist } = edit;
    const work = draft.animacion;
    const k = editor.k, n = (work.fases || []).length;
    const desc = (work._descartadas || []).length;
    mount(statusHost, h('div', { class: 'q-card' },
      h('p', { class: 'q-text' }, 'Ajusta las flechas: arrastra sus puntos, clic en la línea para añadir uno, clic en un punto para curvarlo, Supr para borrarlo. Mover a un atacante recoloca a su defensor y el arranque de las fases siguientes.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: k <= 0, onClick: () => { editor.setFase(k - 1); paintToolbar(); } }, '‹ Fase'),
        h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `Fase ${k + 1} / ${n}`),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: k >= n - 1, onClick: () => { editor.setFase(k + 1); paintToolbar(); } }, 'Fase ›'),
      ),
      desc ? h('p', { class: 'muted' }, `${desc} retoque${desc > 1 ? 's' : ''} no encaja${desc > 1 ? 'n' : ''} con esta jugada.`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: !hist.canUndo(), onClick: () => hist.undo() }, 'Deshacer'),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: !hist.canRedo(), onClick: () => hist.redo() }, 'Rehacer'),
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => salirEdicion() }, 'Hecho'),
      ),
    ));
  }

  function salirEdicion() {
    const work = draft.animacion;
    edit = null;
    mostrarConfirmacion(work); // showPreview desmonta el editor y repinta chips
  }

  /* ---- tarjeta y chips de readback (§Tramo 1.2) ----
     Los chips se derivan del resultado COMPILADO (data + data._intent), nunca
     del texto crudo. En esta iteración solo el chip de CANASTA es editable
     (clic → alterna de aro y recompila vía recompilarConCanasta, sin tocar el
     prompt); jugadores, conos/filas y fases quedan INFORMATIVOS — editarlos
     exige re-extraer la intención y llega con el Tramo 2. */
  function tarjetaPreview(data) {
    const chips = [];

    if (data.canasta) {
      const keys = Object.keys((PISTAS[data.pista] && PISTAS[data.pista].baskets) || {});
      // editable solo con DOS aros y con el intent guardado para recompilar
      // (o con datos de simulación: en ese caso cambiar de aro RE-SIMULA —
      // recompilar el intent viejo dejaría la defensa calculada al aro viejo).
      const editable = keys.length > 1 && !!(data._intent || data._sim);
      chips.push(h('button', {
        class: 'chip' + (editable ? '' : ' chip--info'), type: 'button', disabled: !editable,
        title: editable ? 'Cambiar la canasta objetivo' : null,
        onClick: editable ? () => {
          const next = keys[(keys.indexOf(data.canasta) + 1) % keys.length];
          if (data._sim) { simular(next); return; }
          // Tramo 6.2: con intención base y retoques, cambiar de aro re-resuelve
          // conservando los overrides (recompilarConCanasta los perdería).
          if (draft.baseGen && draft.baseGen.intent) {
            const baseN = { ...draft.baseGen, intent: { ...draft.baseGen.intent, canasta: next } };
            const nuevo = resolverAnimacion(baseN, draft.ediciones || [], stage.board.getElementos(), data.pista, { posiciones: draft.baseGen.posiciones });
            nuevo.warnings = (data.warnings || []).filter((w) => w && w.campo !== 'canasta');
            nuevo._mock = data._mock; if ('_ia' in data) nuevo._ia = data._ia;
            draft.baseGen = baseN;
            draft.animacion = nuevo;
            mostrarConfirmacion(nuevo);
            return;
          }
          const nuevo = recompilarConCanasta(data, next, stage.board.getElementos(), data.pista);
          draft.animacion = nuevo;
          mostrarConfirmacion(nuevo); // refresca vista previa + chips
        } : null,
      }, (CANASTA_LABEL[data.canasta] || data.canasta) + (editable ? ' ▾' : '')));
    }

    // datos de simulación (Tramo 5b): chip informativo de la variante
    if (data._sim) chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `Simulación · variante ${data._sim.semilla}`));

    // jugadores por equipo (incluye los sintetizados de fila) — informativo
    const porEquipo = {};
    for (const j of data.jugadores || []) porEquipo[j.equipo] = (porEquipo[j.equipo] || 0) + 1;
    const eqTxt = Object.keys(porEquipo).sort().map((eq) => `${porEquipo[eq]} × ${TEAM_LABEL[eq] || eq}`).join(' · ');
    if (eqTxt) chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, eqTxt));

    // conos: filas con su cola visible y conos a rodear — informativos
    for (const c of data.conos || []) {
      if (c.funcion === 'fila' && c.fila_config) chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `cono = fila (${c.fila_config.n_jugadores} en cola)`));
    }
    const nRodear = (data.conos || []).filter((c) => c.funcion === 'rodear').length;
    if (nRodear) chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `${nRodear} cono${nRodear > 1 ? 's' : ''} a rodear`));

    const nFases = (data.fases || []).length;
    chips.push(h('button', { class: 'chip chip--info', type: 'button', disabled: true }, `${nFases} fase${nFases === 1 ? '' : 's'}`));

    return h('div', { class: 'q-card preview-card' },
      h('p', { class: 'q-text' }, 'Esto es lo que se ha entendido. Revisa el planteamiento dibujado en la pista:'),
      h('div', { class: 'q-opts' }, ...chips),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => {
          stage.showAnimation(data);
          mount(statusHost, (data.warnings && data.warnings.length) ? warningsBanner(data.warnings) : banner('ok', 'Animación generada. Se reproduce en la pista.'));
        } }, 'Animar'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => {
          // corregir: la pista vuelve al modo edición y el textarea queda
          // abierto y con foco para retocar la descripción y regenerar.
          stage.showBoard();
          mount(statusHost);
          abrirDescripcion();
          ta.focus();
        } }, 'Corregir'),
        // Tramo 6: retoque manual de flechas/trayectorias sobre la pista.
        (data.fases && data.fases.length) ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => entrarEdicion(data) }, 'Ajustar a mano') : null,
        // Tramo 5b: variante de la simulación — misma colocación y mismo aro,
        // semilla siguiente (determinista: se puede volver bajando la semilla).
        data._sim ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => {
          draft.semilla_sim = (data._sim.semilla || 1) + 1;
          simular(data.canasta);
        } }, 'Otra variante') : null,
      ),
    );
  }

  /* ---- flujo de preguntas §8.3 (una a una) ---- */
  async function runPreguntas(preguntas, prev, ronda = 1) {
    const answers = [...prev];
    for (let i = 0; i < preguntas.length; i++) {
      const q = preguntas[i];
      const r = await askOne(q, i + 1, preguntas.length);
      answers.push({ id: q.id, tipo: q.tipo, respuesta: r });
      // q_pos_* tipo A (Tramo 2.3): el clic define una posición con nombre
      // NUEVA de ESTA pista — se guarda en Supabase (guardarPosicion, upsert)
      // para reutilizarla en próximos ejercicios, y en el caché local para
      // que resuelva YA en la regeneración de esta misma ronda. El guardado
      // remoto es no-fatal (dev sin sesión / sin red: la respuesta viaja
      // igualmente en `respuestas` y la generación no se bloquea).
      if (q.tipo === 'A' && /^q_pos_/.test(String(q.id)) && Array.isArray(r) && r.length >= 2) {
        const nombre = q.nombre || String(q.id).slice('q_pos_'.length);
        posCustom = { ...(posCustom || {}), [nombre]: [r[0], r[1]] };
        posCustomPista = draft.tipo_pista;
        guardarPosicion(draft.tipo_pista, nombre, r[0], r[1]).catch(() => { /* sin sesión/offline */ });
      }
    }
    generar(answers, ronda);
  }

  function askOne(q, idx, total) {
    return new Promise((resolve) => {
      const head = h('div', { class: 'q-head' }, h('span', { class: 'q-progress mono' }, `Pregunta ${idx} de ${total}`), h('p', { class: 'q-text' }, q.texto));
      if (q.tipo === 'A') {
        // posición en la pista
        const overlay = h('div', { class: 'court-ask' }, h('span', null, 'Haz clic en la pista'));
        stage.view.root.append(overlay);
        let dot = null; let pos = null;
        const onDown = (ev) => {
          const [x, y] = stage.view.pointerNorm(ev);
          pos = [x, y];
          if (!dot) { dot = h('div', { class: 'court-dot' }); stage.view.root.append(dot); }
          dot.style.left = `${x * 100}%`; dot.style.top = `${y * 100}%`;
          confirm.disabled = false;
        };
        stage.view.canvas.addEventListener('pointerdown', onDown);
        const confirm = h('button', { class: 'btn btn--primary', type: 'button', disabled: true, onClick: () => {
          stage.view.canvas.removeEventListener('pointerdown', onDown);
          overlay.remove(); if (dot) dot.remove();
          resolve(pos);
        } }, 'Confirmar posición');
        mount(statusHost, h('div', { class: 'q-card' }, head, confirm));
      } else {
        // opciones (tipo B) + "Otro…"
        let chosen = null;
        const otroInput = h('input', { class: 'input', placeholder: 'Otra respuesta…', oninput: () => { chosen = otroInput.value; confirm.disabled = !chosen; } });
        const opts = h('div', { class: 'q-opts' },
          ...(q.opciones || []).map((o) => h('button', { class: 'chip', type: 'button', onClick: (e) => {
            opts.querySelectorAll('.is-active').forEach((x) => x.classList.remove('is-active'));
            e.currentTarget.classList.add('is-active'); chosen = o; otroInput.value = ''; confirm.disabled = false;
          } }, o)),
          h('button', { class: 'chip chip--otro', type: 'button', onClick: () => otroInput.focus() }, 'Otro…'),
        );
        const confirm = h('button', { class: 'btn btn--primary', type: 'button', disabled: true, onClick: () => resolve(chosen) }, 'Confirmar');
        mount(statusHost, h('div', { class: 'q-card' }, head, opts, otroInput, confirm));
      }
    });
  }

  const desc = collapsible({ label: 'Describir acciones con texto', open: !!draft.descripcion_texto,
    content: h('div', { class: 'flow' }, h('label', { class: 'field__label' }, 'Describe el ejercicio'), ta) });

  // Despliega la sección de descripción si está plegada (botón "Corregir").
  function abrirDescripcion() {
    const body = desc.querySelector('.collapsible__body');
    if (body && body.hidden) desc.querySelector('.collapsible__toggle')?.click();
  }

  const el = h('div', { class: 'card flow' },
    h('p', { class: 'eyebrow' }, 'Paso 2'),
    h('h2', { class: 'section-title' }, 'Describe las acciones'),
    desc,
    h('div', { class: 'row' }, btn, btnSimular),
    statusHost,
  );

  return { el };
}

function banner(type, text) {
  return h('div', { class: `ia-banner ia-banner--${type}` }, h('span', null, text));
}

function warningsBanner(warnings) {
  return h('div', { class: 'ia-banner ia-banner--warn' },
    h('p', null, h('b', null, '⚠ Algunas partes se interpretaron automáticamente:')),
    h('ul', null, ...warnings.map((w) => h('li', null, `"${w.texto_original}" — ${w.interpretacion}`))),
    h('p', { class: 'muted' }, 'Ajusta la descripción y pulsa "Regenerar" para actualizar.'),
  );
}
