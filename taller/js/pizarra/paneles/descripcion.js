/* ============================================================
   pizarra/paneles/descripcion.js — la frase de la fase (§9.1, §9.2).

   Debajo de la línea de tiempo: lo que pasa en la fase que se edita,
   escrito solo a partir de lo dibujado (motor/frase.js). Se puede
   reescribir; lo escrito manda para la ficha y el paso 3, y «Volver a
   la automática» lo deshace. La voz lee siempre la automática (§9.3).

   No guarda nada suyo: lo lee todo del Tablero en cada `refrescar`, igual
   que la línea de tiempo, y así no se puede desincronizar de lo dibujado.
   ============================================================ */

import { h } from '../../ui/dom.js';

export class Descripcion {
  /**
   * @param host     dónde se cuelga
   * @param tablero  de quien se lee la frase y a quien se le dice lo escrito
   */
  constructor(host, tablero) {
    this.tablero = tablero;
    this.etiqueta = h('span', { class: 'pz-desc__fase' });
    this.estado = h('span', { class: 'pz-desc__estado' });
    this.volver = h('button', { class: 'pz-desc__volver', type: 'button', title: 'Olvidar lo escrito y volver a la frase que sale de lo dibujado' }, 'Volver a la automática');
    this.caja = h('textarea', {
      class: 'pz-desc__texto', rows: '2', 'aria-label': 'Lo que pasa en esta fase',
      placeholder: 'Dibuja algo y aquí saldrá, en palabras, lo que pasa en esta fase.',
    });
    this.el = h('div', { class: 'pz-desc' },
      h('div', { class: 'pz-desc__cabeza' }, this.etiqueta, this.estado, this.volver),
      this.caja);
    host.append(this.el);
    /* La fase de la que se escribe es la que había al ENTRAR en la caja:
       el repaso de «Siguiente fase» cambia de fase sin que se mueva el
       foco, y lo escrito no puede irse a la siguiente. */
    this._fase = tablero.iFase;
    this._reloj = null;
    this.caja.addEventListener('focus', () => { this._fase = this.tablero.iFase; });
    /* Se guarda al poco de dejar de teclear —así entra en el borrador
       aunque se recargue sin salir de la caja— y al salir. Guardar al
       salir solo cambia algo si queda algo por guardar: si no, el clic
       que hace salir (una fase, ▶) se perdía al rehacer la línea de
       tiempo debajo del ratón. */
    this.caja.addEventListener('input', () => {
      clearTimeout(this._reloj);
      this._reloj = setTimeout(() => this._guardar({ repintar: false }), 500);
    });
    this.caja.addEventListener('change', () => this._guardar());
    this.volver.addEventListener('click', () => { this.tablero.escribirTexto(null, this.tablero.iFase); this.refrescar(); });
    this.refrescar();
  }

  /** Vuelve a leer la fase del Tablero. */
  refrescar() {
    const t = this.tablero;
    const escribiendo = typeof document !== 'undefined' && document.activeElement === this.caja;
    /* Si la fase ha cambiado con la caja a medio escribir, lo escrito se
       guarda en SU fase antes de enseñar la nueva. */
    if (escribiendo && this._fase !== t.iFase) {
      this._guardar({ repintar: false });
      this._fase = t.iFase;
      this.caja.value = (t.fases[t.iFase] || {}).texto ?? (t.frases()[t.iFase] || '');
    }
    const fase = t.fases[t.iFase] || {};
    const escrita = fase.texto ?? null;
    this.etiqueta.textContent = `Fase ${t.iFase + 1}`;
    this.estado.textContent = escrita != null ? '· escrita por ti' : '· sale de lo dibujado';
    this.volver.hidden = escrita == null;
    /* Mientras se escribe no se toca: repintar se comería el cursor. */
    if (!escribiendo) {
      this._fase = t.iFase;
      this.caja.value = escrita ?? (t.frases()[t.iFase] || '');
    }
  }

  _guardar({ repintar = true } = {}) {
    clearTimeout(this._reloj);
    const t = this.tablero;
    const i = this._fase ?? t.iFase;
    const automatica = t.frases()[i] || '';
    const v = this.caja.value.trim();
    /* Dejarla como estaba, o vaciarla, es quedarse con la automática. */
    t.escribirTexto(!v || v === automatica ? null : v, i);
    if (repintar) this.refrescar();
  }

  destroy() { clearTimeout(this._reloj); this.el.remove(); }
}
