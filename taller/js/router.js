/* ============================================================
   router.js — router con History API (§20).
   Sin recargas. Intercepta <a data-link>. Patrones con :param.
   ============================================================ */

function compile(pattern) {
  const names = [];
  const source = pattern.replace(/:[^/]+/g, (m) => { names.push(m.slice(1)); return '([^/]+)'; });
  return { rx: new RegExp('^' + source + '/?$'), names };
}

export class Router {
  constructor() {
    this.routes = [];
    this.fallback = null;
    this._onClick = this._onClick.bind(this);
    this._onPop = this._resolve.bind(this);
  }

  on(pattern, handler) {
    this.routes.push({ ...compile(pattern), handler });
    return this;
  }

  otherwise(handler) { this.fallback = handler; return this; }

  start() {
    window.addEventListener('popstate', this._onPop);
    document.addEventListener('click', this._onClick);
    this._resolve();
    return this;
  }

  navigate(path, { replace = false } = {}) {
    if (path === location.pathname + location.search) { this._resolve(); return; }
    history[replace ? 'replaceState' : 'pushState']({}, '', path);
    this._resolve();
  }

  _onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[data-link]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http')) return;
    e.preventDefault();
    this.navigate(href);
  }

  _resolve() {
    const path = location.pathname;
    for (const r of this.routes) {
      const m = path.match(r.rx);
      if (m) {
        const params = {};
        r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
        return r.handler(params);
      }
    }
    if (this.fallback) this.fallback(path);
  }
}
