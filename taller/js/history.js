/* ============================================================
   history.js — pila de deshacer/rehacer (§15). Snapshots de estado
   (hasta 50). El consumidor aporta get() (snapshot) y set(snapshot).
   ============================================================ */

export class History {
  constructor(get, set, { limit = 50 } = {}) {
    this.get = get; this.set = set; this.limit = limit;
    this.stack = []; this.idx = -1;
    this.onChange = null;
  }

  /** Guarda el estado actual como nuevo punto del historial. */
  push() {
    this.stack = this.stack.slice(0, this.idx + 1);
    this.stack.push(this.get());
    if (this.stack.length > this.limit) this.stack.shift();
    this.idx = this.stack.length - 1;
    this.onChange?.();
  }

  undo() {
    if (this.idx <= 0) return false;
    this.idx--; this.set(this.stack[this.idx]); this.onChange?.(); return true;
  }
  redo() {
    if (this.idx >= this.stack.length - 1) return false;
    this.idx++; this.set(this.stack[this.idx]); this.onChange?.(); return true;
  }
  canUndo() { return this.idx > 0; }
  canRedo() { return this.idx < this.stack.length - 1; }
}
