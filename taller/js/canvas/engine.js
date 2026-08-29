/* ============================================================
   engine.js — motor de animación v2 (§9). Consume el JSON del §10,
   interpola posiciones por fases con ease-in-out sobre rAF y dibuja
   las flechas de la fase activa (que desaparecen al cambiar de fase).
   Estado del motor §9.5. Coordenadas normalizadas [0–1].
   ============================================================ */

import { makeSampler, easeInOut } from './geometry.js';
import { drawArrow, drawBloqueo, MOV_TO_ARROW } from './arrows.js';
import { drawPlayer, drawBall, drawCone, drawFila, drawPelotaTenis, drawEscalera, drawZona, radii } from './symbols.js';
import { zonaDesdeGuardada, contornoDe, centroDe as centroZona } from './zonas.js';
import { COLORS, TAU } from './colors.js';

const clone = (m) => { const o = {}; for (const k in m) o[k] = { ...m[k] }; return o; };
const lastNode = (path) => (path && path.length ? { x: path[path.length - 1].x, y: path[path.length - 1].y } : null);
const numLabel = (j) => (j.dorsal ?? (String(j.id).match(/\d+/)?.[0] ?? j.id));

export class AnimationEngine {
  constructor(view, animacion, opts = {}) {
    this.view = view;
    this.loop = opts.loop !== false;
    this.speed = opts.speed || 1;
    this.autoplay = opts.autoplay !== false;
    this._listeners = {};
    this._raf = null;
    this.playing = false;
    // Vista previa (§Tramo 1): null en reproducción normal; en modo preview,
    // { canasta } — render() omite las flechas de fase y resalta ese aro.
    this.preview = null;
    this.load(animacion, { paused: opts.paused });
  }

  on(ev, cb) { (this._listeners[ev] ||= []).push(cb); return this; }
  _emit(ev, d) { (this._listeners[ev] || []).forEach((f) => f(d)); }

  /* ---- carga y construcción de la línea de tiempo ----
     opts.paused (§Tramo 1, vista previa): carga y pinta el fotograma 0 sin
     arrancar el reloj, aunque el motor sea autoplay. */
  load(anim, opts = {}) {
    this.anim = anim || {};
    this.jugadores = this.anim.jugadores || [];
    this.balones = this.anim.balones || [];
    this.conos = this.anim.conos || [];
    this.fases = this.anim.fases || [];
    // El rol (defensor) se define por fase con fase.defensores (§10). Si ninguna
    // fase lo declara, es una animación del modelo antiguo: caemos a jugador.tipo.
    this.usesPhaseRoles = this.fases.some((f) => Array.isArray(f.defensores));
    this._build();
    this.k = 0; this.phaseElapsed = 0; this.mode = 'play'; this.pauseElapsed = 0;
    this.cumDur = []; let acc = 0;
    for (const f of this.fases) { this.cumDur.push(acc); acc += (f.duracion_ms || 1000); }
    this.totalDuration = acc || 1;
    this._emit('phase', this._infoFase(this.k));
    if (!opts.paused && this.autoplay && this.fases.length) this.play();
    else if (this.playing) this.pause(); // venía reproduciendo: parar el rAF y pintar el fotograma 0
    else { this.render(); this._emitFrame(); }
  }

  _basket(which) { const k = this.view.basket(which === 'sur' ? 'sur' : 'norte'); return { x: k[0], y: k[1] }; }

  _build() {
    const P = {}, B = {}, owner = {};
    for (const j of this.jugadores) P[j.id] = j.posicion_inicial ? { x: j.posicion_inicial[0], y: j.posicion_inicial[1] } : { x: 0.5, y: 0.5 };
    for (const b of this.balones) { B[b.id] = b.posicion_inicial ? { x: b.posicion_inicial[0], y: b.posicion_inicial[1] } : { x: 0.5, y: 0.5 }; owner[b.id] = b.portador_id || null; }

    this.restStart = [];
    this.meta = [];

    for (const fase of this.fases) {
      this.restStart.push({ P: clone(P), B: clone(B), owner: { ...owner } });
      const m = { movByEl: {}, ballMoves: {}, bloqueos: fase.bloqueos || [], arrows: [], defenders: new Set(fase.defensores || []) };

      // movimientos de jugadores y balones
      for (const mv of (fase.movimientos || [])) {
        const sampler = makeSampler(mv.path);
        const type = MOV_TO_ARROW[mv.tipo_movimiento] || 'cut';
        if (mv.tipo_elemento === 'balon') m.ballMoves[mv.elemento_id] = { kind: 'mov', sampler };
        else { m.movByEl[mv.elemento_id] = { sampler, type }; m.arrows.push({ flat: sampler.flat, type }); }
        const end = lastNode(mv.path);
        if (end) { if (mv.tipo_elemento === 'balon') B[mv.elemento_id] = end; else P[mv.elemento_id] = end; }
      }

      // pases (el balón viaja al receptor)
      for (const p of (fase.pases || [])) {
        const recvEnd = P[p.a_id] || lastNode(p.path) || B[p.balon_id];
        const effPath = (p.path && p.path.length >= 2) ? p.path : [this.restStart[this.restStart.length - 1].B[p.balon_id] || B[p.balon_id], recvEnd];
        const sampler = makeSampler(effPath);
        m.ballMoves[p.balon_id] = { kind: 'pase', sampler };
        m.arrows.push({ flat: sampler.flat, type: 'pass' });
        owner[p.balon_id] = p.a_id;
        B[p.balon_id] = { ...recvEnd };
      }

      // tiros (el balón viaja a canasta)
      for (const t of (fase.tiros || [])) {
        const start = this.restStart[this.restStart.length - 1].B[t.balon_id] || B[t.balon_id];
        const basket = this._basket(t.canasta);
        const effPath = (t.path && t.path.length >= 2) ? t.path : [start, basket];
        const sampler = makeSampler(effPath);
        m.ballMoves[t.balon_id] = { kind: 'tiro', sampler };
        m.arrows.push({ flat: sampler.flat, type: 'pass' });
        owner[t.balon_id] = null;
        // reposo final = último nodo del path EFECTIVO: con path explícito
        // (Tramo 2: el compilador apunta al centro MEDIDO del aro, anclas.js)
        // el balón no salta al aro de court.js al acabar la fase.
        B[t.balon_id] = lastNode(effPath) || basket;
      }

      // recogidas: alguien va a por un balón suelto y se lo queda. El
      // VIAJE del balón ya viaja como movimiento de tipo_elemento
      // 'balon' (lo emite el compilador); esto solo cambia de dueño, que
      // es lo que hace que el balón le siga en las fases siguientes.
      // Va DESPUÉS de los tiros: en la misma fase, primero se suelta.
      for (const rec of (fase.recogidas || [])) {
        if (!rec || !rec.balon_id) continue;
        owner[rec.balon_id] = rec.jugador_id || null;
        if (rec.jugador_id && P[rec.jugador_id]) B[rec.balon_id] = { ...P[rec.jugador_id] };
      }

      // balones en posesión que no se mueven explícitamente: siguen al portador
      for (const b of this.balones) {
        if (m.ballMoves[b.id]) continue;
        const o = owner[b.id];
        if (o && P[o]) B[b.id] = { ...P[o] };
      }

      this.meta.push(m);
    }
  }

  /* ---- estado de reproducción §9.5 ---- */
  get phaseCount() { return this.fases.length; }
  _dur() { return this.fases[this.k]?.duracion_ms || 1000; }
  tNorm() { return Math.min(1, this.phaseElapsed / this._dur()); }
  progress() { return Math.min(1, ((this.cumDur[this.k] || 0) + this.phaseElapsed) / this.totalDuration); }

  /* ¿Se acabó? Solo puede estarlo sin bucle: con bucle, `_advance`
     vuelve al principio y nunca se queda quieta al final. */
  _agotada() { return !this.loop && this.k >= this.phaseCount - 1 && this.phaseElapsed >= this._dur(); }

  play() {
    if (this.playing || !this.fases.length) return;
    /* Terminada y sin bucle, `play` no hacía NADA (Tramo 2.15): el
       reloj arrancaba con la última fase ya consumida, así que el
       primer latido volvía a darla por acabada y se paraba otra vez.
       El botón cambiaba de icono y volvía, y para verlo de nuevo había
       que descubrir que el de al lado era «reiniciar». Darle al play
       cuando algo ha terminado significa verlo otra vez. */
    if (this._agotada()) { this.k = 0; this.phaseElapsed = 0; this.mode = 'play'; this.pauseElapsed = 0; this._emit('phase', this._infoFase(0)); }
    this.playing = true; this._last = performance.now(); this._schedule(); this._emit('play'); this._emitFrame();
  }
  pause() { this.playing = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } this.render(); this._emit('pause'); this._emitFrame(); }
  toggle() { this.playing ? this.pause() : this.play(); }
  restart() { this.k = 0; this.phaseElapsed = 0; this.mode = 'play'; this.pauseElapsed = 0; this._emit('phase', this._infoFase(0)); this.play(); }
  nextPhase() { this._goPhase(Math.min(this.k + 1, this.phaseCount - 1)); }
  prevPhase() { this._goPhase(Math.max(this.k - 1, 0)); }

  /* ---- rondas de fila (Tramo 2.8) ----------------------------------
     Un ejercicio de seis en fila son seis rondas de las mismas fases.
     El proyector enseña «2 de 6» y salta de una a otra: ver las seis
     seguidas fase a fase no aporta nada, porque son la misma. */
  get rondas() { return this.anim?.rondas || 1; }
  rondaActual() { return this.fases[this.k]?.ronda || 1; }
  /** Primera fase de una ronda; -1 si esa ronda no existe. */
  _inicioDeRonda(r) { return this.fases.findIndex((f) => (f.ronda || 1) === r); }
  siguienteRonda() {
    const i = this._inicioDeRonda(this.rondaActual() + 1);
    if (i >= 0) this._goPhase(i);
  }
  rondaAnterior() {
    const i = this._inicioDeRonda(Math.max(1, this.rondaActual() - 1));
    if (i >= 0) this._goPhase(i);
  }

  _goPhase(k) { this.k = k; this.phaseElapsed = 0; this.mode = 'play'; this.pauseElapsed = 0; this.render(); this._emit('phase', this._infoFase(k)); this._emitFrame(); }
  /* Qué acciones ocurren en una fase (Tramo 2.14). Lo escribe el
     compilador; una fase dibujada a mano en el editor de flechas no
     tiene ninguna, y eso es una lista vacía, no un fallo. */
  accionesDeFase(k) { const a = this.fases[k]?.acciones; return Array.isArray(a) ? a : []; }
  _infoFase(k) { return { k, n: this.phaseCount, ronda: this.fases[k]?.ronda || 1, rondas: this.rondas, acciones: this.accionesDeFase(k) }; }
  setSpeed(s) { this.speed = s; this._emitFrame(); }
  setLoop(b) { this.loop = b; this._emitFrame(); }
  seek(u) {
    const ms = Math.max(0, Math.min(1, u)) * this.totalDuration;
    let k = 0;
    while (k < this.phaseCount - 1 && (this.cumDur[k + 1] || Infinity) <= ms) k++;
    this.k = k; this.phaseElapsed = ms - (this.cumDur[k] || 0); this.mode = 'play'; this.pauseElapsed = 0;
    this.render(); this._emit('phase', this._infoFase(k)); this._emitFrame();
  }

  _schedule() { this._raf = requestAnimationFrame((t) => this._tick(t)); }
  _tick(now) {
    const dt = Math.min(now - this._last, 60); this._last = now;
    if (this.playing) {
      if (this.mode === 'play') {
        this.phaseElapsed += dt * this.speed;
        if (this.phaseElapsed >= this._dur()) { this.phaseElapsed = this._dur(); this.mode = 'pausePost'; this.pauseElapsed = 0; }
      } else {
        this.pauseElapsed += dt * this.speed;
        if (this.pauseElapsed >= (this.fases[this.k]?.pausa_post_ms ?? 400)) this._advance();
      }
    }
    this.render();
    this._emitFrame();
    if (this.playing) this._schedule(); else this._raf = null;
  }
  _advance() {
    if (this.k < this.phaseCount - 1) { this.k++; this.phaseElapsed = 0; this.mode = 'play'; this._emit('phase', this._infoFase(this.k)); }
    else if (this.loop) { this.k = 0; this.phaseElapsed = 0; this.mode = 'play'; this._emit('phase', this._infoFase(0)); }
    else { this.playing = false; this.phaseElapsed = this._dur(); this.mode = 'play'; this._emit('ended'); this._emit('pause'); }
  }

  _emitFrame() { this._emit('frame', { k: this.k, t: this.tNorm(), progress: this.progress(), playing: this.playing, phase: `${Math.min(this.k + 1, this.phaseCount) || 0} / ${this.phaseCount}` }); }

  /* ---- cálculo del fotograma actual ---- */
  _computePositions() {
    const meta = this.meta[this.k], start = this.restStart[this.k];
    const te = easeInOut(this.tNorm());
    const players = {}, balls = {};
    for (const j of this.jugadores) {
      const mv = meta?.movByEl[j.id];
      players[j.id] = mv ? mv.sampler(te) : (start ? { ...start.P[j.id] } : { x: 0.5, y: 0.5 });
    }
    for (const b of this.balones) {
      const bm = meta?.ballMoves[b.id];
      if (bm) balls[b.id] = bm.sampler(te);
      else {
        const o = start?.owner[b.id];
        balls[b.id] = (o && players[o]) ? { x: players[o].x + 0.012, y: players[o].y } : (start ? { ...start.B[b.id] } : { x: 0.5, y: 0.5 });
      }
    }
    return { players, balls };
  }

  render() {
    const { ctx } = this.view;
    if (!this.view.w) return;
    this.view.clear();
    const R = radii(this.view.w, this.anim.pista);
    const toPx = (p) => { const [x, y] = this.view.toPx(p.x, p.y); return { x, y }; };

    /* Los símbolos se dibujan DERECHOS (para que los dorsales se lean),
       así que el giro del proyector no les llega solo: toPx rota las
       posiciones, no las orientaciones. Lo que tiene dirección —la cola de
       una fila, una escalera tumbada— hay que girarlo a mano los mismos
       90°, o en el proyector apuntaría a otro sitio de la pista que en la
       ficha. (La cola ya arrastraba este fallo antes de que existieran las
       escaleras.) */
    const giro = this.view.rot || 0;

    /* Zonas: el suelo del dibujo. Aquí sí manda `visible`, al contrario
       que en el paso 1: una zona invisible sigue existiendo como sitio al
       que referirse, pero no se pinta. Son las zonas que son una REGLA
       («no salirse del pasillo») y no un decorado. */
    for (const g of this.anim.zonas || []) {
      if (g.visible === false) continue;
      const z = zonaDesdeGuardada(g);
      const { puntos, cerrado } = contornoDe(this.anim.pista, z);
      const c = centroZona(this.anim.pista, z);
      drawZona(ctx, {
        puntos: puntos.map((p) => { const [px, py] = this.view.toPx(p.x, p.y); return { x: px, y: py }; }),
        cerrado,
        centro: (([px, py]) => ({ x: px, y: py }))(this.view.toPx(c.x, c.y)),
        nombre: z.nombre,
      }, { trazo: R.metro * 0.08, texto: Math.max(11, R.metro * 0.9) });
    }

    // material del suelo, debajo de todo: se pisa, no se esquiva
    for (const m of this.anim.materiales || []) {
      const [px, py] = this.view.toPx(m.posicion[0], m.posicion[1]);
      if (m.tipo === 'escalera') drawEscalera(ctx, px, py, R.metro, (m.rot ?? 0) + giro, {});
      else drawPelotaTenis(ctx, px, py, R.pelota, {});
    }

    // conos (estáticos)
    for (const c of this.conos) {
      const [px, py] = this.view.toPx(c.posicion[0], c.posicion[1]);
      if (c.funcion === 'fila' && c.fila_config) drawFila(ctx, px, py, R.cono, (c.fila_config.direccion_grados ?? 0) + giro, c.fila_config.n_jugadores ?? 0, R.jugador, COLORS[c.fila_config.equipo] || COLORS.A);
      drawCone(ctx, px, py, R.cono, {});
    }

    const f = this._computePositions();
    const meta = this.meta[this.k];

    // flechas de la fase activa (bajo las fichas) — en vista previa no se
    // dibujan: el fotograma 0 es el PLANTEAMIENTO estático, sin acciones.
    if (meta && !this.preview) {
      for (const ar of meta.arrows) drawArrow(ctx, ar.flat.map(toPx), ar.type, R.scale);
      for (const bl of meta.bloqueos) {
        const a = f.players[bl.bloqueador_id], b = f.players[bl.bloqueado_id];
        if (a && b) drawBloqueo(ctx, toPx(a), toPx(b), R.scale);
      }
    }

    // jugadores — el arco de defensor sale del rol de ESTA fase (fase.defensores);
    // si la animación no usa roles por fase, se mira el tipo del jugador (legado).
    const defs = meta?.defenders;
    // posesión ACTUAL del balón (para el anillo naranja, independiente de la
    // selección): un jugador "lleva" un balón si, para ese balón, no hay
    // entrada en meta.ballMoves (no está en vuelo esta fase) y era su dueño
    // al INICIO de la fase (restStart[k].owner). En vuelo (pase/tiro) nadie
    // lo lleva mientras dura el viaje.
    const start = this.restStart[this.k];
    const carrying = new Set();
    if (start) {
      for (const b of this.balones) {
        if (meta && meta.ballMoves[b.id]) continue;
        const owner = start.owner[b.id];
        if (owner) carrying.add(owner);
      }
    }
    for (const j of this.jugadores) {
      const p = f.players[j.id]; if (!p) continue;
      const [px, py] = this.view.toPx(p.x, p.y);
      const esDef = this.usesPhaseRoles ? !!(defs && defs.has(j.id)) : (j.tipo === 'defensor');
      drawPlayer(ctx, px, py, R.jugador, { color: COLORS[j.equipo] || COLORS.A, label: numLabel(j), defender: esDef, carrying: carrying.has(j.id) });
    }
    // balones encima
    for (const b of this.balones) {
      const p = f.balls[b.id]; if (!p) continue;
      const [px, py] = this.view.toPx(p.x, p.y);
      drawBall(ctx, px, py, R.balon, {});
    }

    // vista previa (§Tramo 1): la canasta OBJETIVO resaltada con halo + anillo
    // discontinuo naranja. Siempre vía toPx, así que respeta la rotación 90°
    // de las medias pistas en modo proyector.
    if (this.preview && this.preview.canasta) {
      const bk = this.view.basket(this.preview.canasta);
      const [bx, by] = this.view.toPx(bk[0], bk[1]);
      const r = R.jugador * 1.1;
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, TAU);
      ctx.fillStyle = 'rgba(234, 88, 12, .16)';
      ctx.fill();
      ctx.lineWidth = Math.max(3, R.scale * 3);
      ctx.strokeStyle = COLORS.ball;
      ctx.setLineDash([6 * R.scale, 5 * R.scale]);
      ctx.stroke();
      ctx.restore();
    }
  }

  destroy() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; this.playing = false; }
}
