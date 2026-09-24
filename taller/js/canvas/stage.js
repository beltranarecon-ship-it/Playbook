/* ============================================================
   stage.js — escenario de REPRODUCCIÓN: una CourtView con el motor de
   animación (Engine, §9) encima. Solo sabe enseñar una jugada ya
   hecha, en movimiento o quieta en su fotograma 0.

   Dibujar y colocar no pasan aquí: eso es la Pizarra
   (ESPEC-PIZARRA-v3 §0). Este escenario es el de la ficha del
   ejercicio y el de la columna del asistente.
   ============================================================ */

import { h } from '../ui/dom.js';
import { CourtView } from './court.js';
import { AnimationEngine } from './engine.js';
import { controls } from './controls.js';

export class Stage {
  /**
   * @param voz  con la narración en los mandos (§9.3): la ficha del
   *             ejercicio sí; la columna del asistente, no.
   */
  constructor({ pista = 'entera', voz = false } = {}) {
    this.voz = voz;
    this.view = new CourtView({ pista });
    this.engine = null;
    this._mandos = null;
    this.controlsSlot = h('div', { class: 'court-controls-slot' });
    this.el = h('div', { class: 'court-wrap' }, this.view.root, this.controlsSlot);
    // al cambiar de tamaño solo hay una cosa que repintar: el fotograma actual
    this.view.onResize = () => this.engine?.render();
    this._bindTocarPausa();
  }

  /* ---- Tocar la pista para pausar (Tramo 2.15) -------------------
     «Pausar en cualquier momento» en el pabellón no es encontrar un
     botón de veinte píxeles con el móvil en una mano: es tocar lo que
     se está mirando. Mientras se REPRODUCE, un toque en la pista para
     y otro sigue.

     Solo en reproducción de verdad: en la vista previa el fotograma ya
     está quieto a propósito, así que ahí el atajo no tendría nada que
     pausar y solo confundiría. */
  _bindTocarPausa() {
    this._tocarPausa = false;
    this.view.canvas.addEventListener('click', () => {
      if (!this._tocarPausa || !this.engine) return;
      this.engine.toggle();
    });
  }
  _setTocarPausa(on) {
    this._tocarPausa = !!on;
    this.el.classList.toggle('is-tocable', !!on);
  }

  /** Carga y reproduce una animación (§10), con controles (§11). */
  showAnimation(anim) {
    if (!this.engine) this.engine = new AnimationEngine(this.view, anim, { autoplay: true, loop: true });
    else { this.engine.preview = null; this.engine.load(anim); }
    /* Los mandos se crean de nuevo —deciden al crearse, por ejemplo, si
       hay botón de ronda—, pero antes se sueltan los de antes: el motor
       es el mismo y seguiría avisándoles en cada fotograma. */
    this._mandos?.destroy();
    this._mandos = controls(this.engine, { voz: this.voz });
    this.controlsSlot.replaceChildren(this._mandos.el);
    this._setTocarPausa(true);
  }

  /** Vista previa del PLANTEAMIENTO: fotograma 0 EN PAUSA con la canasta
   *  objetivo resaltada. Mismo motor y pipeline de dibujo que
   *  showAnimation (AnimationEngine.render), solo que el reloj no
   *  arranca y no hay mandos: nada que reproducir, nada que pulsar. */
  showPreview(anim) {
    if (!this.engine) this.engine = new AnimationEngine(this.view, anim, { autoplay: true, loop: true, paused: true });
    else this.engine.load(anim, { paused: true });
    // el resaltado se activa tras cargar y se repinta (data.canasta la expone
    // el compilador; si falta — geometría legada — simplemente no se resalta).
    this.engine.preview = { canasta: anim.canasta || null };
    this.engine.render();
    this._setTocarPausa(false);
    this._mandos?.destroy();
    this._mandos = null;
    this.controlsSlot.replaceChildren();
  }

  /** Para la reproducción sin descargar nada: para cuando el escenario
   *  deja de verse y no tiene sentido que siga pintando. */
  pausar() { this.engine?.pause(); }

  setPista(key) {
    this.view.setPista(key);
    this.engine?.render();
  }

  destroy() { this._mandos?.destroy(); this.engine?.destroy(); this.view.destroy(); }
}
