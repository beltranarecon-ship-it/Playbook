/* ============================================================
   editor-canvas.js — lienzo editable de UNA fase (modo edición §3).
   Dibuja la fase con sus fichas y flechas, y permite editar las
   flechas como paths vectoriales con nodos lineales/Bézier (§9.3):
   arrastrar nodos y handles, insertar nodo en un segmento, borrar
   nodo (Supr) y curvar/enderezar con DOBLE clic (§5.2).
   ============================================================ */

import { h } from '../ui/dom.js';
import { CourtView, clamp01 } from './court.js';
import { drawArrow } from './arrows.js';
import { drawPlayer, drawBall, drawCone, radii } from './symbols.js';
import { flattenPath, manejadoresTangentes } from './geometry.js';
import { COLORS, TAU } from './colors.js';
import { restPositions, reanclarPaths, nodosFijos } from './rest-positions.js';

// restPositions vive en su propio módulo puro (sin DOM) para que el banco
// (Node) pueda probar la propagación de posiciones; se re-exporta aquí por
// compatibilidad con quien la importara desde este archivo.
export { restPositions };

const MOV_TO_ARROW = { carrera_con_balon: 'run', carrera_sin_balon: 'cut', corte: 'cut' };
const numLabel = (j) => (j.dorsal ?? (String(j.id).match(/\d+/)?.[0] ?? j.id));

export class EditorCanvas {
  /** opts.view: CourtView externa compartida (Stage, edición dentro del paso 2,
   *  Tramo 6). Sin ella crea la suya (editor a pantalla completa,
   *  views/editor.js). Con vista compartida NO toca view.onResize ni la
   *  destruye: de eso se ocupa el Stage según su modo. */
  constructor(anim, opts = {}) {
    this.ownsView = !opts.view;
    this.view = opts.view || new CourtView({ pista: anim.pista || 'entera' });
    this.el = this.ownsView ? h('div', { class: 'court-wrap' }, this.view.root) : this.view.root;
    this.anim = anim;
    this.k = 0;
    this.sel = null;        // { path, type } de la flecha seleccionada
    this.selNode = -1;
    this._drag = null;
    this._listeners = {};
    reanclarPaths(anim);
    this.starts = restPositions(anim);
    // Rol por fase (§10), igual que AnimationEngine: si alguna fase declara
    // "defensores" es el modelo nuevo (equipos neutrales); si ninguna lo
    // hace, es una animación del modelo antiguo y cae a jugador.tipo.
    this.usesPhaseRoles = (anim.fases || []).some((f) => Array.isArray(f.defensores));
    if (this.ownsView) this.view.onResize = () => this.render();
    this._bind();
    requestAnimationFrame(() => this.render());
  }

  on(ev, cb) { (this._listeners[ev] ||= []).push(cb); return this; }
  _emit(ev, d) { (this._listeners[ev] || []).forEach((f) => f(d)); }

  setFase(k) { this.k = k; this.sel = null; this.selNode = -1; this._ultimoClic = null; this.render(); }

  /* Reanclar ANTES de recolocar las fichas es lo que hace que mover una
     flecha arrastre a las fases siguientes: si no, el jugador aparecía
     en su sitio nuevo y su flecha seguía saliendo del viejo. */
  refresh() {
    reanclarPaths(this.anim);
    this.starts = restPositions(this.anim);
    this.render();
  }

  /** Reemplaza la animación mostrada conservando la fase actual (Tramo 6.2:
   *  re-resolución tras cada edición). Suelta la selección y recalcula los
   *  inicios de fase; no re-vincula listeners. */
  setAnim(anim) {
    /* La flecha que se estaba retocando se conserva. Cada arrastre
       re-resuelve la animación entera y trae objetos nuevos, así que
       soltar la selección aquí obligaba a volver a pinchar la flecha
       después de mover CADA punto — y eso, en una trayectoria de cuatro
       nodos, son tres clics de más por curva. Se busca la misma flecha
       por su elemento y su tipo, que es lo que la identifica. */
    const antes = this.sel ? { id: this.sel.ref.elemento_id || this.sel.ref.de_id, tipo: this.sel.type } : null;
    const nodo = this.selNode;
    this.anim = anim;
    this.usesPhaseRoles = (anim.fases || []).some((f) => Array.isArray(f.defensores));
    this.sel = null; this.selNode = -1; this._ultimoClic = null;
    reanclarPaths(anim);
    this.starts = restPositions(anim);
    this.k = Math.max(0, Math.min(this.k, (anim.fases || []).length - 1));
    if (antes) {
      const igual = this._arrows().find((a) => (a.ref.elemento_id || a.ref.de_id) === antes.id && a.type === antes.tipo);
      if (igual) {
        this.sel = igual;
        this.selNode = nodo >= 0 ? Math.min(nodo, igual.path.length - 1) : -1;
      }
    }
    this.render();
  }

  /* flechas editables de la fase actual */
  _arrows() {
    const fase = this.anim.fases?.[this.k]; if (!fase) return [];
    const out = [];
    for (const m of fase.movimientos || []) if (m.tipo_elemento !== 'balon') out.push({ path: m.path, type: MOV_TO_ARROW[m.tipo_movimiento] || 'cut', ref: m });
    for (const p of fase.pases || []) out.push({ path: p.path, type: 'pass', ref: p });
    return out;
  }

  _bind() {
    const c = this.view.canvas;
    // Handlers guardados en `this` para poder desvincularlos (_unbind) cuando
    // el editor comparte la vista con el Stage (Tramo 6): sin eso, al salir
    // del modo edición seguirían capturando clics del tablero/reproducción.
    this._onDown = (ev) => {
      ev.preventDefault();
      this.el.focus?.({ preventScroll: true });
      const pt = this._pt(ev);
      // 1) sobre la flecha seleccionada: handle / nodo / segmento
      if (this.sel) {
        const hk = this._hitHandle(pt); if (hk) { this._drag = hk; try { c.setPointerCapture(ev.pointerId); } catch {} return; }
        const hn = this._hitNode(pt); if (hn >= 0) { this.selNode = hn; this._drag = { kind: 'node', i: hn, moved: false, start: pt }; this.render(); try { c.setPointerCapture(ev.pointerId); } catch {} return; }
        const seg = this._hitSegment(pt); if (seg >= 0) { this._insertNode(seg, pt); this._drag = { kind: 'node', i: seg + 1, moved: true, start: pt }; this.render(); try { c.setPointerCapture(ev.pointerId); } catch {} return; }
      }
      // 2) seleccionar otra flecha
      const a = this._hitArrow(pt);
      // cambiar de flecha corta el doble clic: dos clics en nodos de
      // flechas distintas no son un doble clic
      this._ultimoClic = null;
      this.sel = a; this.selNode = -1; this.render();
      this._emit('select', a);
    };
    this._onMove = (ev) => {
      if (!this._drag) return;
      const pt = this._pt(ev);
      const d = this._drag;
      if (d.kind === 'node') { const n = this.sel.path[d.i]; const dx = pt.x - n.x, dy = pt.y - n.y; n.x = pt.x; n.y = pt.y; if (n.handle_in) { n.handle_in.x += dx; n.handle_in.y += dy; } if (n.handle_out) { n.handle_out.x += dx; n.handle_out.y += dy; } d.moved = d.moved || Math.hypot(pt.x - d.start.x, pt.y - d.start.y) > 0.01; }
      else if (d.kind === 'handle') { const n = this.sel.path[d.i]; n[d.which] = { x: pt.x, y: pt.y }; }
      this.refresh();
    };
    /* Un clic SELECCIONA el nodo; el DOBLE clic lo curva o lo endereza
       (§5.2). Antes curvaba el clic simple, y eso dejaba sin manera de
       seleccionar un nodo para borrarlo: había que curvarlo primero,
       sin querer, y enderezarlo después. */
    this._onUp = () => {
      if (!this._drag) return;
      const d = this._drag;
      this._drag = null;
      if (d.kind === 'node' && !d.moved) {
        const ahora = Date.now();
        const doble = this._ultimoClic && this._ultimoClic.i === d.i && (ahora - this._ultimoClic.t) < 400;
        this._ultimoClic = doble ? null : { i: d.i, t: ahora };
        if (doble) this._toggleNode(d.i);
        else return;   // solo seleccionar: nada que registrar en el historial
      }
      this._emit('change');
    };
    this._onKey = (ev) => {
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.sel && this.selNode >= 0 && this.sel.path.length > 2) {
        ev.preventDefault(); this.sel.path.splice(this.selNode, 1); this.selNode = -1; this.refresh(); this._emit('change');
      }
    };
    c.addEventListener('pointerdown', this._onDown);
    c.addEventListener('pointermove', this._onMove);
    c.addEventListener('pointerup', this._onUp);
    c.addEventListener('pointercancel', this._onUp);
    this.el.tabIndex = 0;
    this.el.addEventListener('keydown', this._onKey);
  }

  _unbind() {
    const c = this.view.canvas;
    c.removeEventListener('pointerdown', this._onDown);
    c.removeEventListener('pointermove', this._onMove);
    c.removeEventListener('pointerup', this._onUp);
    c.removeEventListener('pointercancel', this._onUp);
    this.el.removeEventListener('keydown', this._onKey);
  }

  _pt(ev) { const [x, y] = this.view.pointerNorm(ev); return { x, y }; }
  _r() { return Math.max(0.014, 14 / (this.view.w || 600)); } // radio de nodo en norm

  /** Nodos de la flecha seleccionada que NO se pueden arrastrar: son
   *  consecuencia de dónde están las fichas (origen de cualquier flecha,
   *  y también el destino de un pase, que lo pone el receptor). Dejar
   *  arrastrarlos sería mentir: reanclarPaths los devuelve a su sitio. */
  _fijos() { return this.sel ? nodosFijos(this.sel.type, this.sel.path.length) : new Set(); }

  _hitNode(pt) {
    if (!this.sel) return -1;
    const r = this._r();
    const fijos = this._fijos();
    for (let i = this.sel.path.length - 1; i >= 0; i--) {
      if (fijos.has(i)) continue;
      const n = this.sel.path[i];
      if (Math.hypot(pt.x - n.x, pt.y - n.y) <= r) return i;
    }
    return -1;
  }
  _hitHandle(pt) {
    if (!this.sel) return null; const r = this._r();
    for (let i = 0; i < this.sel.path.length; i++) { const n = this.sel.path[i]; for (const w of ['handle_in', 'handle_out']) { const hh = n[w]; if (hh && Math.hypot(pt.x - hh.x, pt.y - hh.y) <= r) return { kind: 'handle', i, which: w }; } }
    return null;
  }
  _hitSegment(pt) {
    if (!this.sel) return -1; const flat = flattenPath(this.sel.path); const r = this._r();
    // mapear el punto al segmento de nodos más cercano cuya distancia < r
    for (let i = 0; i < this.sel.path.length - 1; i++) { const a = this.sel.path[i], b = this.sel.path[i + 1]; if (this._distSeg(pt, a, b) < r) return i; }
    return -1;
  }
  _hitArrow(pt) {
    const r = this._r() * 1.2;
    for (const a of this._arrows()) { const flat = flattenPath(a.path); for (let i = 0; i < flat.length - 1; i++) if (this._distSeg(pt, flat[i], flat[i + 1]) < r) return a; }
    return null;
  }
  _distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1e-9;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  _insertNode(seg, pt) { this.sel.path.splice(seg + 1, 0, { x: clamp01(pt.x), y: clamp01(pt.y), tipo_nodo: 'lineal', handle_in: null, handle_out: null }); }

  /**
   * Curva o endereza un nodo (doble clic, §5.2).
   *
   * Los manejadores salen EN LA DIRECCIÓN DE LA FLECHA, tangentes al
   * camino, no en horizontal. Antes salían siempre a izquierda y
   * derecha (`n.x ± 0.06`), así que en una flecha que bajaba salían
   * atravesados: curvar un nodo pegaba un tirón lateral que nadie había
   * pedido, y había que recolocar los dos manejadores para volver a
   * donde estabas. Tangentes, curvar no cambia el trazo — solo lo deja
   * listo para curvarlo, que es lo que se quería.
   *
   * El largo sale de los segmentos vecinos (un tercio, la regla de
   * siempre para que una Bézier pase suave por el nodo), con un mínimo
   * para que el cuadradito se pueda agarrar con el dedo.
   */
  _toggleNode(i) {
    const path = this.sel.path;
    const n = path[i];
    if (n.handle_in || n.handle_out) {
      n.handle_in = null; n.handle_out = null; n.tipo_nodo = 'lineal';
      this.refresh();
      return;
    }
    const { handle_in, handle_out } = manejadoresTangentes(path, i, this._r() * 1.8);
    n.handle_in = { x: clamp01(handle_in.x), y: clamp01(handle_in.y) };
    n.handle_out = { x: clamp01(handle_out.x), y: clamp01(handle_out.y) };
    n.tipo_nodo = 'bezier';
    this.refresh(); // el 'change' lo emite pointerup (evita doble registro en el historial)
  }

  render() {
    const { ctx } = this.view; if (!this.view.w) return;
    this.view.clear();
    const R = radii(this.view.w, this.view.pistaKey);
    const toPx = (p) => { const [x, y] = this.view.toPx(p.x, p.y); return { x, y }; };
    const start = this.starts[this.k] || { P: {}, B: {} };

    // conos
    for (const c of this.anim.conos || []) { const [px, py] = this.view.toPx(c.posicion[0], c.posicion[1]); drawCone(ctx, px, py, R.cono, {}); }
    // flechas de la fase
    for (const a of this._arrows()) drawArrow(ctx, flattenPath(a.path).map(toPx), a.type, R.scale);
    // jugadores en su posición de inicio de fase — arco de defensor por rol de
    // ESTA fase (fase.defensores) si el modelo lo soporta; si no, legado (tipo).
    const defsFase = this.anim.fases?.[this.k]?.defensores;
    for (const j of this.anim.jugadores || []) {
      const p = start.P[j.id]; if (!p) continue;
      const [px, py] = this.view.toPx(p.x, p.y);
      const esDef = this.usesPhaseRoles ? !!(defsFase && defsFase.includes(j.id)) : (j.tipo === 'defensor');
      drawPlayer(ctx, px, py, R.jugador, { color: COLORS[j.equipo] || COLORS.A, label: numLabel(j), defender: esDef });
    }
    for (const b of this.anim.balones || []) { const p = start.B[b.id]; if (!p) continue; const [px, py] = this.view.toPx(p.x, p.y); drawBall(ctx, px, py, R.balon, {}); }

    // nodos + handles de la flecha seleccionada
    if (this.sel) this._drawNodes(ctx, toPx, R.scale);
  }

  _drawNodes(ctx, toPx, scale) {
    const path = this.sel.path;
    ctx.save();
    // líneas a los handles
    for (let i = 0; i < path.length; i++) {
      const n = path[i], np = toPx(n);
      for (const w of ['handle_in', 'handle_out']) {
        if (!n[w]) continue; const hp = toPx(n[w]);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5 * scale; ctx.setLineDash([4 * scale, 3 * scale]);
        ctx.beginPath(); ctx.moveTo(np.x, np.y); ctx.lineTo(hp.x, hp.y); ctx.stroke(); ctx.setLineDash([]);
        // cuadrado del handle
        const s = 6 * scale; ctx.fillStyle = '#94A3B8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * scale;
        ctx.beginPath(); ctx.rect(hp.x - s, hp.y - s, s * 2, s * 2); ctx.fill(); ctx.stroke();
      }
    }
    // Nodos. Los que se pueden mover son círculos blancos (el
    // seleccionado, papaya). Los ANCLADOS —el origen de la flecha, y el
    // destino si es un pase— se dibujan como un aro pequeño y hueco: no
    // se pueden arrastrar porque los pone la ficha, y verlos distintos
    // ahorra el intento y el desconcierto de que "no se mueve".
    const fijos = this._fijos();
    for (let i = 0; i < path.length; i++) {
      const np = toPx(path[i]);
      if (fijos.has(i)) {
        ctx.beginPath(); ctx.arc(np.x, np.y, 4.5 * scale, 0, TAU);
        ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.5 * scale;
        ctx.setLineDash([2.5 * scale, 2 * scale]); ctx.stroke(); ctx.setLineDash([]);
        continue;
      }
      ctx.beginPath(); ctx.arc(np.x, np.y, 6.5 * scale, 0, TAU);
      ctx.fillStyle = i === this.selNode ? COLORS.ball : '#fff';
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 2 * scale;
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  destroy() { this._unbind(); if (this.ownsView) this.view.destroy(); }
}
