/* ============================================================
   pizarra/linea-tiempo.js — la tira de abajo (§2.5).

   Una sola fila, fina, con lo que se usa en cada momento:

     · LOS MANDOS, para ver la fase que se edita o la jugada entera, y
       cuánto dura la fase;
     · LA TIRA DE FASES, para saber por dónde vas y poder volver a
       cualquiera a corregirla (§6.5), con las RAMAS en árbol (§6.7);
     · «SIGUIENTE FASE», que no se desplaza con la tira: es lo que más se
       pulsa mientras se dibuja y no puede quedar fuera de la vista.

   Los carriles de la fase, su nombre y lo que se le puede hacer ya no
   están aquí: se comían la pista. Viven en la pestaña «Fases» del panel
   derecho (paneles/fases.js).

   Toca el DOM, así que no tiene banco propio: lo que se puede probar en
   Node —los carriles, las duraciones, los arranques— vive en fases.js,
   que sí lo tiene. Aquí solo queda el pegamento.
   ============================================================ */

import { h } from '../ui/dom.js';
import { icono } from './iconos.js';

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
    /* Con las rondas de las filas (§7.4.2): la fase dura hasta que sale
       el último. */
    const { tiempos } = this.tablero.conRondasEn();
    this.el.replaceChildren(this._mandos(tiempos), this._tira(), this._siguiente());
  }

  /* ---- los mandos ------------------------------------------- */

  _mandos(tiempos) {
    const t = this.tablero;
    const ver = h('button', {
      class: 'pz-tiempo__mando pz-tiempo__mando--primario', type: 'button',
      title: 'Reproducir esta fase',
      disabled: t.tramos.length ? null : '',
    }, icono('reproducir', { size: 13 }), h('span', null, 'Fase'));
    ver.addEventListener('click', () => t.reproducirFase());

    /* «Desde el principio» solo tiene sentido con más de una fase: con
       una sola es lo mismo que reproducir, y un botón que hace lo mismo
       que el de al lado solo hace dudar. */
    const todo = h('button', {
      class: 'pz-tiempo__mando', type: 'button',
      title: 'Ver la jugada desde el principio',
      disabled: t.fases.length > 1 ? null : '',
    }, icono('repetir', { size: 15 }), h('span', null, 'Toda la jugada'));
    todo.addEventListener('click', () => t.reproducirJugada());

    return h('div', { class: 'pz-tiempo__mandos' },
      ver, todo,
      h('span', { class: 'pz-tiempo__dur', title: 'Lo que dura la fase que se edita' }, tiempos.duracion_ms ? segundos(tiempos.duracion_ms) : '—'));
  }

  /* ---- la tira de fases ------------------------------------- */

  _tira() {
    const t = this.tablero;
    const tira = h('div', { class: 'pz-tiempo__fases' });
    const actual = t.fases[t.iFase] ? t.fases[t.iFase].id : null;
    const enElCamino = new Set(t.fases.map((f) => f.id));
    const boton = (id) => {
      const f = t.faseDeId(id);
      const vacia = !(f.tramos || []).length;
      const b = h('button', {
        class: 'pz-fase'
          + (id === actual ? ' is-activa' : '')
          + (vacia ? ' is-vacia' : '')
          + (id !== actual && enElCamino.has(id) ? ' is-camino' : ''),
        type: 'button',
        /* Una fase vacía que no es la activa es la que se acaba de
           abrir y todavía no tiene nada: se dice, en vez de dejar un
           hueco que parece un fallo. */
        title: vacia ? 'sin dibujar todavía' : `${f.tramos.length} tramos`,
      }, `Fase ${t.numeroEnSuCamino(id)}${f.nombre ? ` · ${f.nombre}` : ''}`);
      b.addEventListener('click', () => t.irAFaseId(id));
      return b;
    };
    /* LAS RAMAS (§6.7), EN ÁRBOL (lo decidió el entrenador): tras la fase
       del cruce salen una debajo de otra, cada una con su nombre. Sin
       ramas, es la fila de siempre. */
    const tramo = (r) => {
      const fila = h('div', { class: 'pz-tira__tramo' }, ...r.fases.map(boton));
      if (r.sigueEn) fila.append(h('span', { class: 'pz-tira__sigue', title: 'Esta rama se reúne con otra' }, `→ sigue en la fase ${t.numeroEnSuCamino(r.sigueEn)}`));
      if (!r.ramas.length) return fila;
      return h('div', { class: 'pz-tira__cruce' }, fila,
        h('div', { class: 'pz-tira__ramas' }, ...r.ramas.map((x) => h('div', { class: 'pz-tira__rama' },
          h('span', { class: 'pz-tira__nombre' }, x.nombre || 'rama'), tramo(x)))));
    };
    tira.append(tramo(t.arbolDeFases()));
    return tira;
  }

  _siguiente() {
    const t = this.tablero;
    const mas = h('button', {
      class: 'pz-fase pz-fase--mas', type: 'button',
      title: 'Reproduce lo dibujado, deja a todos donde acaban y abre la fase nueva', 'aria-label': 'Siguiente fase',
    }, h('span', null, 'Siguiente fase'), icono('flecha', { size: 16 }));
    mas.disabled = !t.tramos.length;
    mas.addEventListener('click', () => t.siguienteFase());
    return mas;
  }

  destroy() { this.el.remove(); }
}
