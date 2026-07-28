/* ============================================================
   board.js — editor de colocación (§7). Coloca y arrastra jugadores
   (4 equipos), balones y conos sobre la pista. Estado en coordenadas
   normalizadas [0–1]. Emite 'change' (con conteo de requisitos §7.3),
   'select' y 'placing'.
   ============================================================ */

import { CourtView, clamp01 } from './court.js';
import { drawPlayer, drawBall, drawCone, drawFila, radii } from './symbols.js';
import { COLORS } from './colors.js';

let _seq = 0;
const uid = (p) => `${p}_${++_seq}`;
const MAX_POR_EQUIPO = 5;

export class Board {
  constructor({ view, pista = 'entera', elementos = [], readonly = false } = {}) {
    this.ownsView = !view;
    this.view = view || new CourtView({ pista });
    this.el = this.view.root;
    this.el.tabIndex = readonly ? -1 : 0;
    this.readonly = readonly;
    this._active = true;            // el Stage lo desactiva durante la reproducción
    this.elementos = [];
    this.selected = null;
    this._placing = null;
    this._drag = null;
    this._listeners = {};
    if (this.ownsView) this.view.onResize = () => this.render();
    elementos.forEach((e) => this.elementos.push({ ...e }));
    if (!readonly) this._bind();
    requestAnimationFrame(() => this.render());
  }

  /** Activa/desactiva la interacción y el repintado de colocación. */
  setActive(on) { this._active = on; if (on) this.render(); }

  /* ---- eventos ---- */
  on(ev, cb) { (this._listeners[ev] ||= []).push(cb); return this; }
  _emit(ev, d) { (this._listeners[ev] || []).forEach((f) => f(d)); }

  /* ---- tamaños según ancho del lienzo y pista (fórmula compartida) ---- */
  get radii() { return radii(this.view.w, this.view.pistaKey); }
  rOf(e) { return this.radii[e.kind] ?? this.radii.jugador; }

  /* ---- conteo de requisitos (§7.3) ---- */
  counts() {
    const c = { jugadores: 0, balones: 0, conos: 0 };
    for (const e of this.elementos) {
      if (e.kind === 'jugador') c.jugadores++;
      else if (e.kind === 'balon') c.balones++;
      else if (e.kind === 'cono') c.conos++;
    }
    return c;
  }
  teamCount(team) { return this.elementos.filter((e) => e.kind === 'jugador' && e.equipo === team).length; }

  /* ---- modo colocación (§7.2) ---- */
  startPlacing(spec) {
    if (this.readonly) return;
    this._placing = spec;
    this.el.classList.add('is-placing');
    this._emit('placing', spec);
  }
  cancelPlacing() {
    this._placing = null;
    this.el.classList.remove('is-placing');
    this._emit('placing', null);
  }

  /* ---- altas / bajas ---- */
  add(spec, x = 0.5, y = 0.5) {
    if (spec.kind === 'jugador') {
      if (this.teamCount(spec.equipo) >= MAX_POR_EQUIPO) { this._emit('limit', spec.equipo); return null; }
      // Sin rol fijo: el equipo solo define color/identidad. El rol atacante/
      // defensor lo asigna la acción por fase (§8/§10), no la colocación.
      // El label real lo pone _renumerar(): 1..n contiguos y únicos por equipo.
      const el = {
        id: uid('jug'), kind: 'jugador', equipo: spec.equipo,
        label: '0', dorsal: null, nombre: null, x, y,
      };
      this.elementos.push(el);
      this._renumerar();
      this._changed(); this.select(el.id); return el;
    }
    const base = { id: uid(spec.kind), kind: spec.kind, x, y };
    if (spec.kind === 'cono') Object.assign(base, { funcion: 'decorativo', fila_config: null });
    if (spec.kind === 'balon') base.portador_id = null;
    this.elementos.push(base);
    this._changed(); this.select(base.id); return base;
  }
  remove(id) {
    this.elementos = this.elementos.filter((e) => e.id !== id);
    if (this.selected === id) this.selected = null;
    this._renumerar();
    this._changed();
  }

  /* Etiquetas visibles 1..n CONTIGUAS y ÚNICAS por equipo (en orden de
     tablero). Sin esto, "añadir A1,A2,A3, borrar el 2, añadir otro A" creaba
     dos jugadores con label '3' → id derivado 'A3' duplicado, y uno de los
     dos quedaba inalcanzable para la IA/el compilador. El id interno de
     elemento (uid) no cambia: selección y arrastre no se ven afectados. */
  _renumerar() {
    const porEquipo = {};
    for (const e of this.elementos) {
      if (e.kind !== 'jugador') continue;
      porEquipo[e.equipo] = (porEquipo[e.equipo] || 0) + 1;
      e.label = String(porEquipo[e.equipo]);
    }
  }
  clear() { this.elementos = []; this.selected = null; this._changed(); }

  get(id) { return this.elementos.find((e) => e.id === id); }
  select(id) { this.selected = id; this.render(); this._emit('select', this.get(id) || null); }

  setPista(key) { this.view.setPista(key); this.render(); }

  /* ---- serialización (para §10 / persistencia) ---- */
  getElementos() { return this.elementos.map((e) => ({ ...e })); }
  setElementos(list) { this.elementos = (list || []).map((e) => ({ ...e })); this.selected = null; this._changed(); }

  _changed() {
    this.render();
    this._emit('change', { elementos: this.elementos, counts: this.counts() });
  }

  /* ---- interacción ---- */
  _bind() {
    const c = this.view.canvas;
    c.addEventListener('pointerdown', (ev) => {
      if (!this._active) return;
      ev.preventDefault();
      this.el.focus({ preventScroll: true });
      const [x, y] = this.view.pointerNorm(ev);
      if (this._placing) { this.add(this._placing, x, y); this.cancelPlacing(); return; }
      const hit = this._hit(x, y);
      if (hit) {
        this.select(hit.id);
        this._drag = { id: hit.id, dx: hit.x - x, dy: hit.y - y };
        try { c.setPointerCapture(ev.pointerId); } catch { /* puntero sintético */ }
      } else {
        this.select(null);
      }
    });
    c.addEventListener('pointermove', (ev) => {
      if (!this._active || !this._drag) return;
      const [x, y] = this.view.pointerNorm(ev);
      const e = this.get(this._drag.id);
      if (!e) return;
      e.x = clamp01(x + this._drag.dx);
      e.y = clamp01(y + this._drag.dy);
      this.render();
    });
    const up = () => { if (this._drag) { this._drag = null; this._emit('change', { elementos: this.elementos, counts: this.counts() }); } };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    this.el.addEventListener('keydown', (ev) => {
      if (!this._active) return;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selected) {
        ev.preventDefault(); this.remove(this.selected);
      } else if (ev.key === 'Escape') {
        if (this._placing) this.cancelPlacing(); else this.select(null);
      }
    });
  }

  _hit(x, y) {
    for (let i = this.elementos.length - 1; i >= 0; i--) {
      const e = this.elementos[i];
      const dpx = (x - e.x) * this.view.w;
      const dpy = (y - e.y) * this.view.h;
      if (Math.hypot(dpx, dpy) <= this.rOf(e) * 1.15) return e;
    }
    return null;
  }

  /* ---- render de la foto inicial ---- */
  render() {
    const { ctx } = this.view;
    if (!this._active || !this.view.w) return;
    this.view.clear();
    const R = this.radii;
    // conos primero, jugadores, balón encima
    const order = { cono: 0, jugador: 1, balon: 2 };
    const list = [...this.elementos].sort((a, b) => (order[a.kind] ?? 1) - (order[b.kind] ?? 1));
    for (const e of list) {
      const [px, py] = this.view.toPx(e.x, e.y);
      const sel = e.id === this.selected;
      if (e.kind === 'jugador') {
        drawPlayer(ctx, px, py, R.jugador, { color: COLORS[e.equipo], label: e.dorsal ?? e.label, selected: sel });
      } else if (e.kind === 'balon') {
        drawBall(ctx, px, py, R.balon, { selected: sel });
      } else if (e.kind === 'cono') {
        if (e.funcion === 'fila' && e.fila_config) {
          drawFila(ctx, px, py, R.cono, e.fila_config.direccion_grados ?? 0, e.fila_config.n_jugadores ?? 0, R.jugador, COLORS[e.fila_config.equipo] || COLORS.A);
        }
        drawCone(ctx, px, py, R.cono, { selected: sel });
      }
    }
  }

  destroy() { if (this.ownsView) this.view.destroy(); }
}
