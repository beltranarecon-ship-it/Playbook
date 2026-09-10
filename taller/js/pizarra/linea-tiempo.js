/* ============================================================
   pizarra/linea-tiempo.js — la tira de abajo (§2.5).

   Dos cosas, y las dos hacen falta para entender una jugada de un
   vistazo:

     · LA TIRA DE FASES, para saber por dónde vas y poder volver a
       cualquiera a corregirla (§6.5);
     · LOS CARRILES de la fase activa, una barra por ficha, que es donde
       se ve de un golpe quién se mueve, cuándo arranca cada uno y
       cuánto dura la fase.

   Toca el DOM, así que no tiene banco propio: lo que se puede probar en
   Node —los carriles, las duraciones, los arranques— vive en fases.js,
   que sí lo tiene. Aquí solo queda el pegamento.

   ── POR QUÉ LAS BARRAS Y NO UNA LISTA ───────────────────────
   Una lista dice lo mismo, pero en una lista «A1 arranca a 1,2 s» hay
   que leerlo y compararlo a mano con lo que hace A2. En barras se ve.
   Y arrastrar una barra es la única manera de decir «este sale un poco
   antes» sin escribir un número (§2.5).

   ── ARRASTRAR UNA BARRA LA MARCA A MANO ─────────────────────
   El §6.3 lo dice: al mover el arranque, ese tramo deja de
   recalcularse. Si no, el siguiente cambio en la fase lo devolvería a
   su sitio automático y el entrenador vería deshacerse lo que acaba de
   ajustar. Los tramos a mano se ven con un borde distinto, para que se
   sepa cuáles ya no siguen la corriente.
   ============================================================ */

import { h } from '../ui/dom.js';
import { carrilesDesde, tiemposDe, duracionDeCarril } from './fases.js';

/** Cuánto hay que arrastrar para que sea mover y no un clic. */
const UMBRAL_PX = 4;

const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

export class LineaTiempo {
  /**
   * @param host     dónde se cuelga
   * @param tablero  de quien se lee todo; no se guarda copia de nada
   */
  constructor(host, tablero) {
    this.host = host;
    this.tablero = tablero;
    this.el = h('div', { class: 'pz-tiempo' });
    this.host.append(this.el);
    this.refrescar();
  }

  /** Vuelve a pintarse desde el estado del Tablero. Se llama en cada
   *  cambio: la línea de tiempo no guarda nada suyo, y así no puede
   *  desincronizarse de lo que hay dibujado. */
  refrescar() {
    const t = this.tablero;
    const fase = { ...t.fases[t.iFase], carriles: carrilesDesde(t.tramos) };
    const tiempos = tiemposDe(fase, { pista: t.lienzo.vista.pistaKey });
    this.el.replaceChildren(
      this._mandos(tiempos),
      this._tira(),
      this._carriles(fase, tiempos),
    );
  }

  /* ---- los mandos ------------------------------------------- */

  _mandos(tiempos) {
    const t = this.tablero;
    const ver = h('button', {
      class: 'pz-tiempo__mando', type: 'button',
      title: 'Reproducir esta fase',
      disabled: t.tramos.length ? null : '',
    }, '▶');
    ver.addEventListener('click', () => t.reproducirFase());

    /* «Desde el principio» solo tiene sentido con más de una fase: con
       una sola es lo mismo que reproducir, y un botón que hace lo mismo
       que el de al lado solo hace dudar. */
    const todo = h('button', {
      class: 'pz-tiempo__mando', type: 'button',
      title: 'Ver la jugada desde el principio',
      disabled: t.fases.length > 1 ? null : '',
    }, '↺');
    todo.addEventListener('click', () => t.reproducirJugada());

    return h('div', { class: 'pz-tiempo__mandos' },
      ver, todo,
      h('span', { class: 'pz-tiempo__dur' }, tiempos.duracion_ms ? segundos(tiempos.duracion_ms) : '—'));
  }

  /* ---- la tira de fases ------------------------------------- */

  _tira() {
    const t = this.tablero;
    const tira = h('div', { class: 'pz-tiempo__fases' });
    t.fases.forEach((f, i) => {
      const vacia = !f.tramos.length;
      const b = h('button', {
        class: 'pz-fase'
          + (i === t.iFase ? ' is-activa' : '')
          + (vacia ? ' is-vacia' : ''),
        type: 'button',
        /* Una fase vacía que no es la activa es la que se acaba de
           abrir y todavía no tiene nada: se dice, en vez de dejar un
           hueco que parece un fallo. */
        title: vacia ? 'sin dibujar todavía' : `${f.tramos.length} tramos`,
      }, `Fase ${i + 1}`);
      b.addEventListener('click', () => { t.irAFase(i); });
      tira.append(b);
    });
    const mas = h('button', { class: 'pz-fase pz-fase--mas', type: 'button' }, 'Siguiente fase →');
    mas.disabled = !t.tramos.length;
    mas.addEventListener('click', () => t.siguienteFase());
    tira.append(mas);
    return tira;
  }

  /* ---- los carriles ----------------------------------------- */

  _carriles(fase, tiempos) {
    const t = this.tablero;
    const caja = h('div', { class: 'pz-tiempo__carriles' });
    if (!fase.carriles.length) {
      caja.append(h('p', { class: 'pz-tiempo__nada' }, 'Nadie se mueve en esta fase todavía.'));
      return caja;
    }
    const total = Math.max(1, tiempos.duracion_ms);
    for (const c of fase.carriles) {
      const ficha = t.fichas.elementos.find((e) => e.id === c.elemento);
      const fila = h('div', { class: 'pz-carril' },
        h('span', { class: 'pz-carril__quien' }, ficha ? t.nombreDe(ficha) : '—'));
      const pista = h('div', { class: 'pz-carril__pista' });
      for (const tr of c.tramos) {
        const m = tiempos.tramos[tr.id];
        const barra = h('div', {
          class: 'pz-barra' + (tr.manual ? ' is-manual' : ''),
          title: `${tr.accion} · ${segundos(m.duracion_ms)}`
            + (tr.manual ? ' · arranque a mano' : ''),
        }, tr.accion);
        barra.style.left = `${(m.inicio_ms / total) * 100}%`;
        barra.style.width = `${Math.max(2, (m.duracion_ms / total) * 100)}%`;
        this._arrastrable(barra, tr, total);
        pista.append(barra);
      }
      fila.append(pista, h('span', { class: 'pz-carril__dur' }, segundos(duracionDeCarril(c, tiempos))));
      caja.append(fila);
    }
    return caja;
  }

  /* Arrastrar una barra adelanta o retrasa ese tramo (§2.5), y al
     hacerlo queda marcado como «a mano» (§6.3). Se mide sobre el ancho
     de la pista de carriles y no sobre la barra: el porcentaje que se
     mueve tiene que ser el mismo mire donde mire el ratón. */
  _arrastrable(barra, tramo, total) {
    barra.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const pista = barra.parentElement;
      const ancho = pista.getBoundingClientRect().width || 1;
      const x0 = ev.clientX;
      const inicio0 = (parseFloat(barra.style.left) / 100) * total;
      let movido = false;
      /* Capturar el puntero puede lanzar si ya no está activo —uno
         sintético, o uno que se soltó entre el `down` y esta línea—, y
         al lanzar se lleva por delante el resto del manejador: el
         arrastre no llegaba ni a empezar. Es el mismo cuidado que ya
         tiene el Lienzo. */
      try { barra.setPointerCapture(ev.pointerId); } catch { /* puntero que ya no está */ }

      const mover = (e) => {
        const dx = e.clientX - x0;
        if (!movido && Math.abs(dx) < UMBRAL_PX) return;
        movido = true;
        const ms = Math.max(0, Math.round(inicio0 + (dx / ancho) * total));
        barra.style.left = `${(ms / total) * 100}%`;
        barra.dataset.ms = String(ms);
      };
      const soltar = () => {
        barra.removeEventListener('pointermove', mover);
        barra.removeEventListener('pointerup', soltar);
        barra.removeEventListener('pointercancel', soltar);
        if (!movido) return;
        this.tablero.moverArranque(tramo.id, Number(barra.dataset.ms || 0));
      };
      barra.addEventListener('pointermove', mover);
      barra.addEventListener('pointerup', soltar);
      barra.addEventListener('pointercancel', soltar);
    });
  }

  destroy() { this.el.remove(); }
}
