/* ============================================================
   board.js — editor de colocación (§7). Coloca y arrastra jugadores
   (4 equipos), balones y conos sobre la pista. Estado en coordenadas
   normalizadas [0–1]. Emite 'change' (con conteo de requisitos §7.3),
   'select' y 'placing'.
   ============================================================ */

import { CourtView, clamp01 } from './court.js';
import { drawPlayer, drawBall, drawCone, drawFila, drawPelotaTenis, drawEscalera, drawZona, radii } from './symbols.js';
import { crearZona, contornoDe, centroDe, cajaDe, ajustarConShift, TIPOS_ZONA } from './zonas.js';
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

  /**
   * Mirar sin tocar (paso 2, §5.2): se sigue viendo todo —zonas y
   * elementos— y no se mueve nada. Colocar es cosa del paso 1, y un
   * arrastre involuntario mientras se describe la jugada cambiaría la
   * animación por debajo sin que nadie lo pidiera.
   *
   * No es lo mismo que `setActive(false)`, que además deja de pintar:
   * aquí hay que seguir viendo la pista para poder señalar sobre ella.
   */
  setSoloMirar(on) {
    this._soloMirar = !!on;
    if (on) { this._drag = null; this.cancelPlacing(); }
    this.el.classList.toggle('is-solo-mirar', !!on);
    this.el.tabIndex = on ? -1 : 0;
    this.render();
  }

  /* ---- eventos ---- */
  on(ev, cb) { (this._listeners[ev] ||= []).push(cb); return this; }
  _emit(ev, d) { (this._listeners[ev] || []).forEach((f) => f(d)); }

  /* ---- tamaños según ancho del lienzo y pista (fórmula compartida) ---- */
  get radii() { return radii(this.view.w, this.view.pistaKey); }
  /* Radio a efectos de SELECCIÓN. La escalera no es un círculo: se le da
     un radio de agarre que cubre aproximadamente su mitad, para poder
     pincharla sin tener que acertar en el borde. */
  rOf(e) {
    if (e.kind === 'escalera') return this.radii.metro * 1.1;
    return this.radii[e.kind] ?? this.radii.jugador;
  }

  /* ---- conteo de requisitos (§7.3) ---- */
  counts() {
    const c = { jugadores: 0, balones: 0, conos: 0, material: 0, zonas: 0 };
    for (const e of this.elementos) {
      if (e.kind === 'jugador') c.jugadores++;
      else if (e.kind === 'balon') c.balones++;
      else if (e.kind === 'cono') c.conos++;
      else if (e.kind === 'escalera' || e.kind === 'pelota') c.material++;
      else if (e.kind === 'zona') c.zonas++;
    }
    return c;
  }
  teamCount(team) { return this.elementos.filter((e) => e.kind === 'jugador' && e.equipo === team).length; }
  zonas() { return this.elementos.filter((e) => e.kind === 'zona'); }

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
    // la escalera se tumba hacia la derecha por defecto; se gira desde el paso 1
    if (spec.kind === 'escalera') base.rot = 0;
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
      if (!this._active || this._soloMirar) return;
      ev.preventDefault();
      this.el.focus({ preventScroll: true });
      const [x, y] = this.view.pointerNorm(ev);
      if (this._placing) {
        // Una zona no se coloca con un clic: se ARRASTRA, porque hacen
        // falta dos puntos. El resto de elementos sí caen donde pinchas.
        if (this._placing.kind === 'zona') {
          const z = { ...crearZona(this._placing.tipo, x, y, x, y, this.zonas()), id: uid('zona') };
          this.elementos.push(z);
          this.select(z.id);
          this._drag = { id: z.id, modo: 'estirar' };
          try { c.setPointerCapture(ev.pointerId); } catch { /* puntero sintético */ }
          this.cancelPlacing();
          return;
        }
        this.add(this._placing, x, y); this.cancelPlacing(); return;
      }
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
      if (!this._active || this._soloMirar || !this._drag) return;
      const [x, y] = this.view.pointerNorm(ev);
      const e = this.get(this._drag.id);
      if (!e) return;
      if (this._drag.modo === 'estirar') {
        // con Shift, recto o a 45° SOBRE LA PISTA (zonas.js lo calcula en
        // metros: 45° del lienzo no serían 45° del suelo)
        const fin = ev.shiftKey
          ? ajustarConShift(this.view.pistaKey, e.tipo, e.x, e.y, clamp01(x), clamp01(y))
          : { x2: clamp01(x), y2: clamp01(y) };
        e.x2 = clamp01(fin.x2); e.y2 = clamp01(fin.y2);
        this.render();
        return;
      }
      if (e.kind === 'zona') {
        // mover una zona mueve sus DOS puntos: conserva forma y tamaño
        const nx = clamp01(x + this._drag.dx), ny = clamp01(y + this._drag.dy);
        e.x2 += nx - e.x; e.y2 += ny - e.y;
        e.x = nx; e.y = ny;
        this.render();
        return;
      }
      e.x = clamp01(x + this._drag.dx);
      e.y = clamp01(y + this._drag.dy);
      this.render();
    });
    const up = () => {
      if (!this._drag) return;
      // Un clic sin arrastre deja una zona de tamaño cero, que no se ve ni
      // se puede volver a pinchar: se descarta en vez de dejarla ahí.
      const e = this.get(this._drag.id);
      if (this._drag.modo === 'estirar' && e && Math.hypot(e.x2 - e.x, e.y2 - e.y) < 0.02) {
        this.elementos = this.elementos.filter((z) => z.id !== e.id);
        this.selected = null;
      }
      this._drag = null;
      this._changed();
      this._emit('select', this.get(this.selected) || null);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    this.el.addEventListener('keydown', (ev) => {
      if (!this._active || this._soloMirar) return;
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selected) {
        ev.preventDefault(); this.remove(this.selected);
      } else if (ev.key === 'Escape') {
        if (this._placing) this.cancelPlacing(); else this.select(null);
      }
    });
  }

  /** ¿Cae (x,y) dentro de una zona, o lo bastante cerca de su trazo? */
  _dentroDeZona(z, x, y) {
    const px = (a, b) => Math.hypot((x - a) * this.view.w, (y - b) * this.view.h);
    if (z.tipo === 'linea') {
      // distancia del punto al segmento, en píxeles
      const ax = z.x * this.view.w, ay = z.y * this.view.h;
      const bx = z.x2 * this.view.w, by = z.y2 * this.view.h;
      const vx = bx - ax, vy = by - ay;
      const largo2 = vx * vx + vy * vy;
      const t = largo2 ? Math.max(0, Math.min(1, ((x * this.view.w - ax) * vx + (y * this.view.h - ay) * vy) / largo2)) : 0;
      return Math.hypot(x * this.view.w - (ax + vx * t), y * this.view.h - (ay + vy * t)) <= this.radii.cono;
    }
    const c = cajaDe(this.view.pistaKey, z);
    if (z.tipo === 'circulo') {
      const centro = centroDe(this.view.pistaKey, z);
      const rx = (c.x1 - c.x0) / 2, ry = (c.y1 - c.y0) / 2;
      const dx = (x - centro.x) / (rx || 1e-9), dy = (y - centro.y) / (ry || 1e-9);
      return dx * dx + dy * dy <= 1;
    }
    return x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1;
  }

  /* Las ZONAS se comprueban al final, y a propósito: son el escenario, no
     los actores. Una zona grande por debajo de tres jugadores se comería
     todos los clics si entrara en el mismo reparto. */
  _hit(x, y) {
    for (let i = this.elementos.length - 1; i >= 0; i--) {
      const e = this.elementos[i];
      if (e.kind === 'zona') continue;
      const dpx = (x - e.x) * this.view.w;
      const dpy = (y - e.y) * this.view.h;
      if (Math.hypot(dpx, dpy) <= this.rOf(e) * 1.15) return e;
    }
    for (let i = this.elementos.length - 1; i >= 0; i--) {
      const e = this.elementos[i];
      if (e.kind === 'zona' && this._dentroDeZona(e, x, y)) return e;
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
    // las zonas son el suelo del dibujo; el material va encima de ellas,
    // y las fichas encima de todo
    const order = { zona: -2, escalera: -1, pelota: 0, cono: 0, jugador: 1, balon: 2 };
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
      } else if (e.kind === 'zona') {
        // en el PASO 1 se ven siempre, aunque estén marcadas como
        // invisibles: si no, se apagan y ya no hay forma de volver a
        // encontrarlas para encenderlas. Lo que respeta `visible` es la
        // animación (engine.js).
        this._dibujarZona(ctx, e, sel);
        continue;
      } else if (e.kind === 'pelota') {
        drawPelotaTenis(ctx, px, py, R.pelota, { selected: sel });
      } else if (e.kind === 'escalera') {
        drawEscalera(ctx, px, py, R.metro, e.rot ?? 0, { selected: sel });
      }
    }
  }

  _dibujarZona(ctx, z, sel) {
    const R = this.radii;
    const { puntos, cerrado } = contornoDe(this.view.pistaKey, z);
    const centro = centroDe(this.view.pistaKey, z);
    drawZona(ctx, {
      puntos: puntos.map((p) => { const [px, py] = this.view.toPx(p.x, p.y); return { x: px, y: py }; }),
      cerrado,
      centro: (([px, py]) => ({ x: px, y: py }))(this.view.toPx(centro.x, centro.y)),
      nombre: z.visible === false ? `${z.nombre} (oculta)` : z.nombre,
    }, { selected: sel, trazo: R.metro * 0.08, texto: Math.max(11, R.metro * 0.9) });
  }

  destroy() { if (this.ownsView) this.view.destroy(); }
}
