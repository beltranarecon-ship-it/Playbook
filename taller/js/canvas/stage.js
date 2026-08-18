/* ============================================================
   stage.js — escenario del canvas. Una sola CourtView compartida
   por el editor de colocación (Board, §7) y el motor de animación
   (Engine, §9). Cambia entre "edit" (colocar la foto inicial) y
   "play" (reproducir la animación). El canvas es persistente.
   ============================================================ */

import { h } from '../ui/dom.js';
import { CourtView } from './court.js';
import { Board } from './board.js';
import { AnimationEngine } from './engine.js';
import { EditorCanvas } from './editor-canvas.js';
import { controls } from './controls.js';

// Nombre de cada aro de cara al entrenador (misma convención que el paso 2:
// Canasta 1 = clave 'norte', Canasta 2 = clave 'sur').
const CANASTA_LABEL = { norte: 'Canasta 1', sur: 'Canasta 2' };

export class Stage {
  constructor({ pista = 'entera', elementos = [] } = {}) {
    this.view = new CourtView({ pista });
    this.board = new Board({ view: this.view, elementos });
    this.engine = null;
    this.editor = null;   // EditorCanvas del modo edición del paso 2 (Tramo 6)
    this.mode = 'edit';
    this.controlsSlot = h('div', { class: 'court-controls-slot' });
    this.el = h('div', { class: 'court-wrap' }, this.view.root, this.controlsSlot);
    this.view.onResize = () => {
      if (this.mode === 'editando') this.editor?.render();
      else if (this.mode === 'play') this.engine?.render();
      else this.board.render();
    };
    this._bindBasketTip();
  }

  /* ---- Etiqueta "Canasta 1/2" al pasar el ratón por un aro --------
     Solo en modo edición (colocar/describir) y solo en pistas con DOS
     aros: enseña al entrenador el nombre con el que puede referirse a
     cada canasta en la descripción del paso 2. Es un overlay
     pointer-events:none guiado por pointermove, así que no roba ningún
     clic/arrastre al tablero de colocación. */
  _bindBasketTip() {
    this._basketTip = h('div', { class: 'court-basket-tip' });
    this.view.root.append(this._basketTip);
    this.view.canvas.addEventListener('pointermove', (ev) => this._basketTipMove(ev));
    this.view.canvas.addEventListener('pointerleave', () => this._hideBasketTip());
  }
  _basketTipMove(ev) {
    const baskets = (this.view.pista && this.view.pista.baskets) || {};
    const keys = Object.keys(baskets);
    if (this.mode !== 'edit' || keys.length < 2) { this._hideBasketTip(); return; }
    const r = this.view.canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const hotR = Math.max(26, this.view.w * 0.055);
    for (const k of keys) {
      // siempre vía toPx: respeta la rotación de CourtView (modo proyector).
      const [bx, by] = this.view.toPx(baskets[k][0], baskets[k][1]);
      if (Math.hypot(mx - bx, my - by) <= hotR) {
        this._basketTip.textContent = CANASTA_LABEL[k] || k;
        this._basketTip.style.left = `${bx}px`;
        this._basketTip.style.top = `${by}px`;
        this._basketTip.classList.add('is-on');
        return;
      }
    }
    this._hideBasketTip();
  }
  _hideBasketTip() { this._basketTip.classList.remove('is-on'); }

  /** Desmonta el editor de flechas del paso 2 (Tramo 6) si estaba activo,
   *  soltando sus listeners sobre la vista compartida. */
  _tearDownEditor() { if (this.editor) { this.editor.destroy(); this.editor = null; } }

  /** Vuelve a la edición de la foto inicial. */
  showBoard() {
    this._tearDownEditor();
    this.mode = 'edit';
    this.engine?.pause();
    this.controlsSlot.replaceChildren();
    this.board.setActive(true);
  }

  /** Carga y reproduce una animación (§10), con controles (§11). */
  showAnimation(anim) {
    this._tearDownEditor();
    this.mode = 'play';
    this._hideBasketTip();
    this.board.setActive(false);
    if (!this.engine) this.engine = new AnimationEngine(this.view, anim, { autoplay: true, loop: true });
    else { this.engine.preview = null; this.engine.load(anim); }
    this.controlsSlot.replaceChildren(controls(this.engine).el);
  }

  /** Modo edición manual (Tramo 6): monta un EditorCanvas sobre la MISMA vista
   *  para retocar flechas/trayectorias de la animación `anim`. El scrubber de
   *  fases y el undo/redo los pinta el paso 2, que llama a los métodos del
   *  editor devuelto (this.editor). `onChange`/`onSelect` se propagan. */
  showEditor(anim, { onChange, onSelect } = {}) {
    this._tearDownEditor();
    // señalar y editar flechas se pelearían por el mismo clic
    this._tearDownSenalar();
    this.mode = 'editando';
    this._hideBasketTip();
    this.engine?.pause();
    this.board.setActive(false);
    this.controlsSlot.replaceChildren();
    this.editor = new EditorCanvas(anim, { view: this.view });
    if (onChange) this.editor.on('change', onChange);
    if (onSelect) this.editor.on('select', onSelect);
    return this.editor;
  }

  /** Vista previa del PLANTEAMIENTO (§Tramo 1): fotograma 0 EN PAUSA con la
   *  canasta objetivo resaltada. Mismo motor y pipeline de dibujo que
   *  showAnimation (AnimationEngine.render), solo que el reloj no arranca y
   *  no hay controles hasta que el entrenador confirma con "Animar". */
  showPreview(anim) {
    this._tearDownEditor();
    this.mode = 'play'; // el canvas deja de ser editable, igual que en reproducción
    this._hideBasketTip();
    this.board.setActive(false);
    if (!this.engine) this.engine = new AnimationEngine(this.view, anim, { autoplay: true, loop: true, paused: true });
    else this.engine.load(anim, { paused: true });
    // el resaltado se activa tras cargar y se repinta (data.canasta la expone
    // el compilador; si falta — geometría legada — simplemente no se resalta).
    this.engine.preview = { canasta: anim.canasta || null };
    this.engine.render();
    this.controlsSlot.replaceChildren();
  }

  /* ---- Señalar sobre la pista (Tramo 2.9) ------------------------
     En el paso 2 la pista deja de ser un sitio donde colocar y pasa a
     ser un sitio al que SEÑALAR: cada clic escribe en la descripción
     el nombre de lo que hay debajo, o crea una posición si no hay nada.

     Va en el Stage y no en el Board a propósito: mientras se describe,
     lo que se ve suele ser la VISTA PREVIA de la animación (el Board
     está desactivado), y señalar tiene que funcionar igual en los dos
     casos. Por eso el acierto no se busca contra los elementos del
     tablero sino contra la lista de sujetos, que es la misma que se
     escribe y que se lee (ia/sujetos.js).

     @param onPick  (sujeto|null, {x,y}) — sujeto null = sitio vacío
     @param onHover (sujeto|null) — para resaltar lo que se va a insertar
     @returns una función que lo desmonta
  */
  senalar({ onPick, onHover, buscar } = {}) {
    this._tearDownSenalar();
    const cursor = h('div', { class: 'court-senalar' });
    this.view.root.append(cursor);
    this.view.root.classList.add('is-senalando');

    const bajo = (ev) => {
      const [x, y] = this.view.pointerNorm(ev);
      return { xy: { x, y }, sujeto: typeof buscar === 'function' ? buscar(x, y) : null };
    };
    const mover = (ev) => {
      const { xy, sujeto } = bajo(ev);
      const [px, py] = this.view.toPx(sujeto && sujeto.x != null ? sujeto.x : xy.x, sujeto && sujeto.y != null ? sujeto.y : xy.y);
      cursor.style.left = `${px}px`;
      cursor.style.top = `${py}px`;
      cursor.textContent = sujeto ? sujeto.nombre : 'Posición nueva';
      cursor.classList.toggle('is-sujeto', !!sujeto);
      cursor.classList.add('is-on');
      onHover?.(sujeto);
    };
    const salir = () => { cursor.classList.remove('is-on'); onHover?.(null); };
    const pinchar = (ev) => {
      ev.preventDefault();
      const { xy, sujeto } = bajo(ev);
      onPick?.(sujeto, xy);
    };

    const c = this.view.canvas;
    c.addEventListener('pointermove', mover);
    c.addEventListener('pointerleave', salir);
    c.addEventListener('pointerdown', pinchar);
    this._senalar = () => {
      c.removeEventListener('pointermove', mover);
      c.removeEventListener('pointerleave', salir);
      c.removeEventListener('pointerdown', pinchar);
      cursor.remove();
      this.view.root.classList.remove('is-senalando');
      this._senalar = null;
    };
    return this._senalar;
  }
  _tearDownSenalar() { if (this._senalar) this._senalar(); }

  setPista(key) {
    this.view.setPista(key);
    this._hideBasketTip();
    (this.mode === 'play' ? this.engine : this.board)?.render();
  }

  destroy() { this._tearDownSenalar(); this.engine?.destroy(); this.board.destroy(); this.view.destroy(); }
}
