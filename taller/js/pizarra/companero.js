/* ============================================================
   pizarra/companero.js — «pincha a quién» (§4.4, §2.2).

   Entre elegir en el anillo una acción entre dos fichas —hoy, «bloquea»—
   y tener señalada la otra. Como Dibujo, se cuelga del Lienzo y se queda
   con TODOS los gestos mientras dura: el toque que elige al compañero no
   puede arrastrar a nadie ni abrirle su anillo.

   ── QUÉ SE PUEDE PINCHAR ────────────────────────────────────
   Lo decide quien nos usa (`vale`), porque depende de la acción: a un
   bloqueo solo le vale alguien de su equipo. Los que valen llevan un aro
   alrededor, y el que está debajo del ratón, uno más grueso: ver a quién
   se puede pinchar ANTES de pinchar es lo que evita el «¿por qué no hace
   nada?».

     toque en quien vale      elegido
     toque en quien no vale   se dice por qué, y se sigue esperando
     toque en el suelo        se cancela, como fuera del anillo (§4.1)
     Esc                      se cancela
     arrastrar                nada: no es elegir
   ============================================================ */

import { COLORS } from '../canvas/colors.js';
import { acierto } from './seleccion.js';

export class Companero {
  /**
   * @param elementos   () => lo que hay en la pista ahora
   * @param onElegido   (ficha, { elemento, accion, variante })
   * @param onNoVale    (ficha, motivo, accion) — se ha pinchado a quien no vale
   * @param onCancelar  ()
   */
  constructor(lienzo, { elementos = () => [], onElegido, onNoVale, onCancelar } = {}) {
    this.lienzo = lienzo;
    this.elementos = elementos;
    this.onElegido = onElegido;
    this.onNoVale = onNoVale;
    this.onCancelar = onCancelar;

    this.activo = null;     // { elemento, accion, variante, vale }
    this._encima = null;    // id del que vale y está debajo del ratón
    this._conDedo = false;

    this._quitarCapa = lienzo.capa('companero', (c) => this._dibujar(c), { tipo: 'mundo', orden: 21 });
    /* Por encima de Dibujo (100) y por debajo de colocar (200): mientras
       se elige, gana a las fichas y a los nodos. Con Dibujo no coincide
       nunca: o se traza o se elige. */
    this._quitarGesto = lienzo.gesto('companero', (i) => this._atender(i), { orden: 120 });

    this._onMoverRaton = (ev) => this._seguir(ev);
    this._onTecla = (ev) => this._tecla(ev);
    lienzo.el.addEventListener('pointermove', this._onMoverRaton);
    lienzo.el.addEventListener('keydown', this._onTecla);
  }

  get eligiendo() { return !!this.activo; }

  /** Lo que tiene que decir la barra de arriba (§2.2). */
  ayuda() {
    if (!this.activo) return null;
    const verbo = String(this.activo.accion.nombre || '').toLowerCase();
    return this._conDedo
      ? `Toca a quién ${verbo} · tocar el suelo cancela`
      : `Pincha a quién ${verbo} · pinchar en el suelo o <b>Esc</b> cancela`;
  }

  /**
   * @param vale  (ficha) => motivo por el que no vale, o null
   */
  empezar({ elemento, accion, variante = null, vale = null, conDedo = false }) {
    this._conDedo = !!conDedo;
    this.activo = { elemento, accion, variante, vale };
    this._encima = null;
    this.lienzo.el.focus?.({ preventScroll: true });
    this.lienzo.pintar();
  }

  cancelar() {
    if (!this.activo) return;
    this.activo = null;
    this._encima = null;
    this.onCancelar?.();
    this.lienzo.pintar();
  }

  _motivo(ficha) { return this.activo && this.activo.vale ? this.activo.vale(ficha) : null; }

  _bajo(p, minimoM = 0) {
    return acierto(this.elementos().filter((e) => e.kind === 'jugador'), p, {
      pista: this.lienzo.vista.pistaKey, minimoM,
    });
  }

  /* ---- el puntero -------------------------------------------- */

  _seguir(ev) {
    if (!this.activo) return;
    const [x, y] = this.lienzo.vista.pointerNormRaw(ev);
    const ficha = this._bajo({ x, y });
    const encima = ficha && !this._motivo(ficha) ? ficha.id : null;
    if (encima !== this._encima) { this._encima = encima; this.lienzo.pintar(); }
  }

  _tecla(ev) {
    if (!this.activo || ev.key !== 'Escape') return;
    ev.preventDefault();
    this.cancelar();
  }

  _atender(intento) {
    if (!this.activo) return null;
    this._conDedo = intento.tipoPuntero === 'touch';
    /* El suelo de agarre del dedo, en metros con el zoom de ahora. Con la
       vista sin medir eso no es un número —o es infinito—, y entonces
       cualquier toque acertaba en el jugador más cercano de toda la
       pista: sin suelo, se acierta con el radio de la ficha. */
    const m = this.lienzo.metros(intento.agarrePx);
    const minimoM = Number.isFinite(m) ? m : 0;
    const decidir = (p) => {
      if (!this.activo) return;
      const ficha = this._bajo(p, minimoM);
      if (!ficha) { this.cancelar(); return; }
      const motivo = this._motivo(ficha);
      if (motivo) { this.onNoVale?.(ficha, motivo, this.activo.accion); return; }
      const { elemento, accion, variante } = this.activo;
      this.activo = null;
      this._encima = null;
      this.lienzo.pintar();
      this.onElegido?.(ficha, { elemento, accion, variante });
    };
    return { mover: () => {}, soltar: () => {}, tocar: decidir, abortar: () => {} };
  }

  /* ---- dibujo ------------------------------------------------ */

  _dibujar({ ctx, R, toPx, hairline }) {
    if (!this.activo) return;
    for (const e of this.elementos()) {
      if (e.kind !== 'jugador' || this._motivo(e)) continue;
      const [x, y] = toPx(e.x, e.y);
      const encima = e.id === this._encima;
      ctx.save();
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = hairline(encima ? 3 : 2);
      ctx.setLineDash(encima ? [] : [5, 4]);
      ctx.beginPath();
      ctx.arc(x, y, R.jugador * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  destroy() {
    this.lienzo.el.removeEventListener('pointermove', this._onMoverRaton);
    this.lienzo.el.removeEventListener('keydown', this._onTecla);
    this._quitarCapa?.();
    this._quitarGesto?.();
  }
}
