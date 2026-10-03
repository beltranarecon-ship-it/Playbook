/* ============================================================
   eval-teclas.mjs — banco Node de las TECLAS y el FOCO de la Pizarra
   entera (taller/js/pizarra/pizarra.js con su Lienzo y su Tablero).

     node taller/tools/eval-teclas.mjs

   eval-tablero.mjs monta el Tablero sobre nodos que aceptan cualquier
   cosa, y con eso basta para lo que se le pide por sus métodos. Pero una
   tecla no se le pide a nadie: sale de donde está el foco y SUBE, y por
   el camino se la puede quedar el Lienzo (Espacio es su mano de
   desplazar), el Tablero (los atajos) o la Pizarra (reproducir,
   deshacer). Quién se la queda, y si llega, solo se ve con los tres
   montados y un DOM que recuerde tres cosas: los oyentes de cada nodo,
   quién es hijo de quién y dónde está el foco.

   Eso es lo que hay aquí. Lo que NO prueba: cómo se ve.
   ============================================================ */

const doc = { activeElement: null, body: null };

function nodo(tag = 'div') {
  const oyentes = new Map();
  const datos = {
    nodeType: 1, tagName: String(tag).toUpperCase(), style: { setProperty() {} }, dataset: {}, children: [],
    parentNode: null, hidden: false, disabled: false, value: '', _attrs: {}, _oyentes: oyentes,
  };
  const clases = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const yo = new Proxy(datos, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'classList') return clases;
      if (k === 'isConnected') { for (let n = yo; n; n = n.parentNode) if (n === doc.body) return true; return false; }
      if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
      if (k === 'querySelector') return () => null;
      if (k === 'querySelectorAll') return () => [];
      if (k === 'firstChild') return t.children[0] || nodo();
      if (k === 'addEventListener') return (tipo, fn) => { if (!oyentes.has(tipo)) oyentes.set(tipo, []); oyentes.get(tipo).push(fn); };
      if (k === 'removeEventListener') return (tipo, fn) => { oyentes.set(tipo, (oyentes.get(tipo) || []).filter((f) => f !== fn)); };
      if (k === 'setAttribute') return (a, v) => { t._attrs[a] = String(v); };
      if (k === 'getAttribute') return (a) => t._attrs[a] ?? null;
      if (k === 'contains') return (o) => { for (let n = o; n; n = n.parentNode) if (n === yo) return true; return false; };
      if (k === 'focus') return () => { doc.activeElement = yo; };
      if (k === 'remove') return () => {
        const p = t.parentNode;
        if (p) { const i = p.children.indexOf(yo); if (i >= 0) p.children.splice(i, 1); }
        /* Lo que hace el navegador: si lo enfocado se va del árbol, el
           foco cae al cuerpo de la página. */
        if (yo.contains(doc.activeElement)) doc.activeElement = doc.body;
        t.parentNode = null;
      };
      if (k === 'append' || k === 'appendChild') return (...c) => {
        for (const x of c) {
          if (x && x.nodeType === 1) { if (x.parentNode) x.remove(); x.parentNode = yo; }
          t.children.push(x);
        }
        return c[0];
      };
      if (k === 'replaceChildren') return (...c) => {
        for (const x of [...t.children]) if (x && x.nodeType === 1) x.remove();
        t.children.length = 0;
        yo.append(...c);
      };
      if (k === 'getContext') {
        return () => new Proxy({}, {
          get: (o, p) => (p in o ? o[p] : (p === 'canvas' ? yo : () => ({ width: 0 }))),
          set: (o, p, v) => { o[p] = v; return true; },
        });
      }
      if (typeof k === 'symbol') return undefined;
      return () => nodo();
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return yo;
}

/** Manda un evento desde `destino`: sube burbujeando, como en el navegador. */
function mandar(destino, tipo, datos = {}) {
  const ev = {
    type: tipo, target: destino, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this._parado = true; },
    ...datos,
  };
  for (let n = destino; n && !ev._parado; n = n.parentNode) {
    for (const fn of [...(n._oyentes?.get(tipo) || [])]) fn(ev);
  }
  return ev;
}
/** Una tecla sale de donde está el foco. */
const tecla = (datos) => mandar(doc.activeElement, 'keydown', datos);
const soltar = (datos) => mandar(doc.activeElement, 'keyup', datos);
const ESPACIO = { key: ' ', code: 'Space' };
/** Pulsar un botón con el ratón: se queda el foco y hace clic. */
function pulsar(boton) {
  boton.focus();
  return mandar(boton, 'click');
}
const textoDe = (n) => (!n ? '' : n.nodeType === 3 ? n.data : (n.children || []).map(textoDe).join(''));
function buscar(raiz, pred) {
  if (!raiz || raiz.nodeType !== 1) return null;
  if (pred(raiz)) return raiz;
  for (const c of raiz.children) { const r = buscar(c, pred); if (r) return r; }
  return null;
}

doc.body = nodo('body');
doc.activeElement = doc.body;
globalThis.document = {
  createElementNS: (_, tag) => nodo(tag), createElement: (tag) => nodo(tag),
  createTextNode: (data) => ({ nodeType: 3, data: String(data) }),
  createDocumentFragment: () => nodo('frag'),
  get body() { return doc.body; },
  get activeElement() { return doc.activeElement; },
  addEventListener() {}, removeEventListener() {}, visibilityState: 'visible',
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
globalThis.devicePixelRatio = 1;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
try { globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch { /* ya lo hay */ }

const { Pizarra } = await import('../js/pizarra/pizarra.js');
const { reiniciarIds } = await import('../js/pizarra/elementos.js');
const { nuevoTrazo } = await import('../js/pizarra/trazo.js');

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  const r = JSON.stringify(real), e = JSON.stringify(esp);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
};

/* Una Pizarra de verdad, en la página, con A1 (con balón) y A2. `vistas`
   cuenta las veces que se ha pedido reproducir. */
function montar() {
  reiniciarIds();
  doc.body.replaceChildren();
  doc.activeElement = doc.body;
  const avisos = [];
  const p = new Pizarra({ pista: 'entera' });
  doc.body.append(p.el);
  p.avisar = (html) => avisos.push(html);
  const cuenta = { vistas: 0 };
  p.ver = () => { cuenta.vistas++; };
  const t = p.tablero;
  const a1 = t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.3, y: 0.5 });
  t.anadirFicha({ kind: 'balon' }, { x: 0.3, y: 0.5 });
  const a2 = t.anadirFicha({ kind: 'jugador', equipo: 'A' }, { x: 0.7, y: 0.5 });
  t.cerrar();
  t.fichas.seleccionar(new Set());
  p.lienzo.el.focus();
  return { p, t, a1, a2, cuenta, avisos, lz: p.lienzo.el };
}
const ficha = (t, id) => t.fichas.elementos.find((e) => e.id === id);
const corta = (t, id, hasta) => t._trazoHecho({ elemento: ficha(t, id), accion: t._accionDe('corta'), variante: null, trazo: nuevoTrazo(ficha(t, id), hasta), tipo: 'cut' });

console.log('· la Pizarra se monta entera sobre el DOM de mentira');

test('LA PIZARRA ESTÁ EN LA PÁGINA, su lienzo cuelga de ella y el foco está en la pista', () => {
  const { p, lz } = montar();
  ok(p.el.isConnected && p.el.contains(lz), 'el lienzo es de la pizarra');
  eq(doc.activeElement === lz, true);
});

console.log('\n· Espacio: un toque reproduce, mantenerlo desplaza (§2.2, §3.1)');

test('UN TOQUE DE ESPACIO CON EL FOCO EN LA PISTA REPRODUCE, una vez y al soltar', () => {
  const { p, cuenta } = montar();
  const ev = tecla(ESPACIO);
  eq([ev.defaultPrevented, p.lienzo._espacio, cuenta.vistas], [true, true, 0], 'al pulsar, es la mano del lienzo:');
  soltar(ESPACIO);
  eq([p.lienzo._espacio, cuenta.vistas], [false, 1], 'al soltar sin haber arrastrado, reproduce:');
});

test('MANTENERLO PARA DESPLAZAR NO REPRODUCE: ni en cada repetición de la tecla, ni al soltar', () => {
  const { p, cuenta } = montar();
  tecla(ESPACIO);
  const repes = Array.from({ length: 20 }, () => tecla({ ...ESPACIO, repeat: true }));
  eq([cuenta.vistas, repes.every((ev) => ev.defaultPrevented)], [0, true], 'las repeticiones se quedan en el lienzo (y la página no se desplaza):');
  p.lienzo._espacioUsado = true;     // se ha arrastrado la pista con la mano
  soltar(ESPACIO);
  eq(cuenta.vistas, 0, 'era para desplazar:');
  /* Y el siguiente toque vuelve a ser un toque. */
  tecla(ESPACIO);
  soltar(ESPACIO);
  eq(cuenta.vistas, 1);
});

test('MIENTRAS SE DIBUJA, Espacio no reproduce', () => {
  const { t, a2, cuenta } = montar();
  t._tocarFicha(ficha(t, a2.id));
  t._elegir('corta', { variante: 'recto' });
  ok(t.dibujo.dibujando, 'en modo destino');
  tecla(ESPACIO);
  soltar(ESPACIO);
  eq(cuenta.vistas, 0);
});

test('CON EL FOCO EN OTRA PARTE DE LA PIZARRA también reproduce; escribiendo en una casilla, no', () => {
  const { p, cuenta } = montar();
  const fuera = nodo('div');
  p.el.append(fuera);
  fuera.focus();
  const ev = tecla(ESPACIO);
  eq([cuenta.vistas, ev.defaultPrevented], [1, true]);
  tecla({ ...ESPACIO, repeat: true });
  eq(cuenta.vistas, 1, 'una tecla que se queda pulsada no reproduce otra vez:');
  const casilla = nodo('input');
  p.el.append(casilla);
  casilla.focus();
  const suya = tecla(ESPACIO);
  eq([cuenta.vistas, suya.defaultPrevented], [1, false], 'el espacio es de lo que se escribe:');
});

console.log('\n· una tecla que se queda pulsada no repite la acción (§4.7)');

test('F MANTENIDA ES UNA FINTA, no doce', () => {
  const { t, a2 } = montar();
  t.fichas.seleccionar(new Set([a2.id]));
  tecla({ key: 'f', code: 'KeyF' });
  for (let i = 0; i < 11; i++) tecla({ key: 'f', code: 'KeyF', repeat: true });
  eq(t.tramos.map((x) => x.accion), ['finta']);
});

test('G MANTENIDA cambia el fantasma una vez', () => {
  const { t } = montar();
  const antes = t.fantasma;
  tecla({ key: 'g', code: 'KeyG' });
  eq(t.fantasma, !antes);
  tecla({ key: 'g', code: 'KeyG', repeat: true });
  eq(t.fantasma, !antes, 'la repetición no lo devuelve:');
});

test('Ctrl+Z MANTENIDO sí sigue deshaciendo: es como se deshacen varios pasos', () => {
  const { p, t, a2 } = montar();
  p._apuntar();
  corta(t, a2.id, { x: 0.6, y: 0.3 });
  t.cerrar();
  p._apuntar();
  t.fichas.seleccionar(new Set([a2.id]));
  tecla({ key: 'f', code: 'KeyF' });
  t.cerrar();
  p._apuntar();
  eq(t.tramos.length, 2);
  tecla({ key: 'z', code: 'KeyZ', ctrlKey: true });
  tecla({ key: 'z', code: 'KeyZ', ctrlKey: true, repeat: true });
  eq(t.tramos.length, 0);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
