/* ============================================================
   tablero-node.mjs — un Tablero de la Pizarra de verdad, en Node.

   Monta un DOM de mentira (lo justo para que el Tablero se construya y
   dibuje sin pintar nada) y dibuja una jugada con los gestos de
   dev/jugadas-referencia.js. Lo comparten el banco de las jugadas de
   referencia (taller/tools/eval-referencia.mjs) y el guardado de los
   ejercicios sacados de vídeos (tools/biblioteca/guardar-video.mjs):
   si cada uno llevara su copia, el día que el Tablero pida algo más del
   DOM una de las dos dejaría de dibujar lo que dibuja la otra.

   Los globales se ponen ANTES de importar el Tablero: sus módulos los
   miran al cargarse.
   ============================================================ */

export function falso() {
  const datos = { nodeType: 1, style: { setProperty() {} }, dataset: {}, children: [], hidden: false };
  const clases = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  return new Proxy(datos, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'classList') return clases;
      if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
      if (k === 'querySelector') return () => null;
      if (k === 'querySelectorAll') return () => [];
      if (k === 'firstChild') return t.children[0] || falso();
      if (k === 'append' || k === 'appendChild') return (...c) => { t.children.push(...c); return c[0]; };
      if (typeof k === 'symbol') return undefined;
      return () => falso();
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
globalThis.document = {
  createElementNS: () => falso(), createElement: () => falso(), createTextNode: () => falso(),
  createDocumentFragment: () => falso(), body: falso(), addEventListener() {}, removeEventListener() {},
};
globalThis.window = globalThis;
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.getComputedStyle = () => ({});

const { Tablero } = await import('../js/pizarra/tablero.js');
const { reiniciarIds } = await import('../js/pizarra/elementos.js');

/** Un Tablero vacío para esa pista. `avisos` recoge lo que se niega a dibujar. */
export function tableroDe(pista) {
  const avisos = [];
  const t = new Tablero({
    el: falso(),
    vista: { pistaKey: pista, toPx: (x, y) => [x * 800, y * 600], vw: 800, vh: 600, hairline: (p) => p },
    capa: () => () => {}, gesto: () => () => {}, pintar() {}, metros: (px) => px / 100, agarre: (r) => r, cancelarGestos() {},
  }, {
    canasta: 'norte',
    onNoPuede: (a, motivo) => avisos.push(`${a && a.nombre}: ${motivo}`),
    onSinSoporte: (a) => avisos.push(`${a && a.nombre}: sin soporte`),
  });
  t.poner([]);
  return { t, avisos };
}

/** Dibuja `j` ({ pista, montar(t) }) y devuelve la jugada tal como la guardaría la Pizarra. */
export function dibujar(j) {
  reiniciarIds();
  const { t, avisos } = tableroDe(j.pista);
  j.montar(t);
  t.cerrar();
  return { t, avisos, jugada: JSON.parse(JSON.stringify(t.jugada())) };
}
