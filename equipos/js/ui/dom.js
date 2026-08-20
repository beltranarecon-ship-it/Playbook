/* ============================================================
   dom.js — hyperscript mínimo. Se usa en todas las vistas.
   h('div', { class:'x', onClick:fn }, 'texto', childNode)
   ============================================================ */

export function h(tag, attrs = {}, ...children) {
  const el = document.createElementNS(
    tag === 'svg' || SVG_TAGS.has(tag) ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml',
    tag
  );
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    // Object.assign sobre el.style IGNORA en silencio las variables CSS:
    // `style['--x'] = v` no es una propiedad de CSSStyleDeclaration y se
    // pierde sin error. Las siete llamadas del módulo que pasan
    // `--team-color` no llegaban al DOM, y el calendario y las listas
    // caían al gris de reserva creyendo que el equipo no tenía color.
    // (El mismo arreglo que ya lleva taller/js/ui/dom.js.)
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (val == null) continue;
        if (prop.startsWith('--')) el.style.setProperty(prop, String(val));
        else el.style[prop] = val;
      }
    }
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'ref' && typeof v === 'function') v(el);
    // <textarea> NO tiene atributo `value`: su contenido es el nodo de texto
    // hijo. Con setAttribute el campo salía EN BLANCO aunque hubiera texto
    // guardado, y al escribir encima se perdía lo anterior. Se asigna la
    // propiedad. (Las demás vistas ya lo pasaban como hijo; esto cubre el
    // día que alguien vuelva a escribir `value:` sin acordarse.)
    else if (k === 'value' && tag === 'textarea') el.value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/**
 * Limpia un nodo y le mete contenido nuevo. ES EL SUSTITUTO de
 * host.replaceChildren(...) para los re-pintados parciales: el nativo NO filtra
 * null y lo pinta como el texto "null" en pantalla. Si los hijos son fijos da
 * igual cuál uses; en cuanto haya un `cond ? nodo : null`, tiene que ser mount
 * (o .filter(Boolean) antes del spread).
 */
export function mount(host, ...children) {
  host.replaceChildren();
  append(host, children);
  return host;
}

/** Crea un <svg> con icono de path(s). d puede ser string o array de strings. */
export function icon(d, { size = 22, fill = 'none', stroke = 'currentColor', width = 2 } = {}) {
  const paths = (Array.isArray(d) ? d : [d]).map((p) =>
    h('path', { d: p, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
  );
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill, stroke, 'stroke-width': width, 'aria-hidden': 'true',
  }, ...paths);
}

// 'title' está aquí porque dentro de un <svg> es el tooltip nativo del
// elemento (y sin el namespace SVG el navegador no lo enseña). Nadie
// construye el <title> del documento con h(), así que no hay conflicto.
const SVG_TAGS = new Set([
  'svg', 'path', 'g', 'circle', 'rect', 'line', 'polygon', 'polyline',
  'ellipse', 'text', 'defs', 'use', 'marker', 'image', 'tspan', 'clipPath',
  'title',
]);
