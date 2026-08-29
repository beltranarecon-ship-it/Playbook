/* ============================================================
   marco-comun.mjs — reescribir coordenadas dentro de las tandas.
   Módulo PURO: no lee ni escribe ficheros, no sabe de rutas.

   ── POR QUÉ EXISTE ──────────────────────────────────────────
   Las pistas han cambiado de marco dos veces: del dibujo estilizado
   en hoja A4 al de medidas reales (marco 1 → 2, agosto), y de ése al
   que dibujó el entrenador a mano (marco 2 → 3). Cada cambio obliga a
   reescribir las coordenadas absolutas de las 17 tandas.

   La parte peligrosa no es el mapa —son dos rectas— sino el
   ANALIZADOR: si se equivoca al decidir qué número es una coordenada,
   corrompe 1742 números en silencio y no hay forma de notarlo hasta
   que alguien mira una ficha y ve un cono en la grada. Por eso vive
   aquí, en un módulo puro y con banco propio (eval-marco.mjs), en vez
   de copiado en cada migrador.

   ── QUÉ SE TOCA Y QUÉ NO ────────────────────────────────────
   Solo lo que es una coordenada absoluta escrita como número:

     jug('A', 1, 0.34, 0.66)      →  los dos últimos
     balon(0.34, 0.66)            →  los dos
     cono(0.28, 0.62)             →  los dos
     fila(0.34, 0.66, 3, 0)       →  los dos primeros
     hacia: { x: 0.34, y: 0.66 }  →  los dos

   NO se toca nada que sea una expresión. `M.codo_der[0] - 0.06` se
   queda como está a propósito: el ancla se mueve sola (sale de
   medidas.js) y el −0,06 es un desplazamiento relativo, no un sitio.
   Reescribirlo lo movería dos veces.
   ============================================================ */

/** Recta que lleva [o0,o1] a [n0,n1]. */
export const recta = ([o0, o1], [n0, n1]) => (v) => n0 + ((v - o0) * (n1 - n0)) / (o1 - o0);

/**
 * Un mini-analizador que solo sabe hacer una cosa: dada la posición del
 * paréntesis de apertura, devolver los tramos de texto de cada
 * argumento de nivel 0.
 *
 * No entiende JavaScript; entiende paréntesis, corchetes, llaves y
 * comillas, que es todo lo que hay en estas llamadas. Basta, y no
 * arrastra una dependencia que habría que auditar.
 *
 * @returns {{args: [number,number][], fin: number} | null}
 *   null si el paréntesis no cierra — entonces el fichero se deja en paz.
 */
export function argumentos(s, iAbre) {
  const args = [];
  let d = 1, ini = iAbre + 1, i = ini, comilla = null;
  for (; i < s.length; i++) {
    const c = s[i];
    if (comilla) { if (c === '\\') i += 1; else if (c === comilla) comilla = null; continue; }
    if (c === "'" || c === '"' || c === '`') { comilla = c; continue; }
    if ('([{'.includes(c)) { d += 1; continue; }
    if (')]}'.includes(c)) {
      d -= 1;
      if (d === 0) { args.push([ini, i]); return { args, fin: i }; }
      continue;
    }
    if (d === 1 && c === ',') { args.push([ini, i]); ini = i + 1; }
  }
  return null;
}

/** Un argumento es una coordenada solo si es UN número y nada más. */
export const ES_NUMERO = /^\s*(-?\d*\.?\d+)\s*$/;

/** Nombre de la función → índice de su primer argumento de coordenada. */
export const LLAMADAS = { jug: 2, balon: 0, cono: 0, fila: 0 };

/**
 * Reescribe las coordenadas de un texto de tanda.
 *
 * @param texto    el fichero entero
 * @param mapa     { [pista]: { x: (v)=>v, y: (v)=>v } }
 * @param alConvertir  opcional, se llama con (valorNuevo, {pista, eje, fn})
 *                     después de aplicar el mapa; devuelve el valor final.
 *                     Es donde el llamante recorta a [0,1] y lleva la cuenta.
 * @returns {{texto: string, cambios: object[]}}
 */
export function migrarTexto(texto, mapa, alConvertir = (v) => v) {
  const convertir = (pista, eje, v, fn) => {
    const f = mapa[pista];
    if (!f) return null;
    return alConvertir(f[eje](v), { pista, eje, fn });
  };

  const cambios = [];
  let pista = null;           // el tipo_pista de la ficha que se está leyendo

  /* Una sola pasada. `tipo_pista` va cambiando el contexto según se
     avanza: cada ficha declara la suya y las llamadas que vienen
     después son suyas. Sin ese contexto no se puede convertir nada,
     porque el mapa es distinto en cada pista. */
  const rx = /\btipo_pista:\s*'([a-z_]+)'|\b(jug|balon|cono|fila)\s*\(|\bhacia:\s*\{/g;
  let m;
  while ((m = rx.exec(texto))) {
    if (m[1]) { pista = m[1]; continue; }
    if (!pista || !mapa[pista]) continue;

    if (m[2]) {
      const abre = m.index + m[0].length - 1;
      const r = argumentos(texto, abre);
      if (!r) continue;
      const desde = LLAMADAS[m[2]];
      for (const [tramo, eje] of [[r.args[desde], 'x'], [r.args[desde + 1], 'y']]) {
        if (!tramo) continue;
        const crudo = texto.slice(tramo[0], tramo[1]);
        const n = ES_NUMERO.exec(crudo);
        if (!n) continue;                      // expresión: no es un sitio, es un offset
        const nuevo = convertir(pista, eje, Number(n[1]), m[2]);
        if (nuevo == null) continue;
        cambios.push({ ini: tramo[0], fin: tramo[1], texto: crudo.replace(n[1], String(nuevo)), pista, fn: m[2] });
      }
      rx.lastIndex = r.fin;
      continue;
    }

    // hacia: { x: N, y: N }
    const abre = m.index + m[0].length - 1;
    const cierra = texto.indexOf('}', abre);
    if (cierra < 0) continue;
    const cuerpo = texto.slice(abre + 1, cierra);
    let tocados = 0;
    const nuevoCuerpo = cuerpo.replace(/\b([xy])\s*:\s*(-?\d*\.?\d+)/g, (todo, eje, num) => {
      const nuevo = convertir(pista, eje, Number(num), 'hacia');
      if (nuevo == null) return todo;
      tocados += 1;
      return todo.replace(num, String(nuevo));
    });
    if (tocados) cambios.push({ ini: abre + 1, fin: cierra, texto: nuevoCuerpo, pista, fn: 'hacia' });
    rx.lastIndex = cierra;
  }

  cambios.sort((a, b) => a.ini - b.ini);
  let out = '', cursor = 0;
  for (const c of cambios) { out += texto.slice(cursor, c.ini) + c.texto; cursor = c.fin; }
  out += texto.slice(cursor);
  return { texto: out, cambios };
}

/* ── El sello de marco ────────────────────────────────────────
   La migración anterior marcaba «ya hecho» con un fichero suelto en
   copias/, que está en .gitignore. En un clon nuevo ese testigo no
   existe, así que el migrador se habría creído que faltaba por hacer
   y habría movido todo una segunda vez.

   El sello va DENTRO de cada tanda: viaja en git, se ve al abrir el
   fichero y no se puede perder por separado. */

const SELLO = /\/\*\s*marco:\s*(\d+)\s*\*\//;

/** En qué marco está un texto de tanda. Sin sello, se asume el 2. */
export function marcoDe(texto, porDefecto = 2) {
  const m = SELLO.exec(texto);
  return m ? Number(m[1]) : porDefecto;
}

/**
 * Deja el texto sellado con `marco`, sustituyendo el sello si ya había.
 *
 * El sello va DESPUÉS del shebang si lo hay. `piloto.mjs` empieza por
 * `#!/usr/bin/env node`, que solo vale en la primera línea: poner el
 * sello encima lo convertía en código y Node se negaba a cargar el
 * fichero. Lo cazó la reconstrucción de la biblioteca, pero no tiene
 * que volver a pasar.
 */
export function sellar(texto, marco) {
  if (SELLO.test(texto)) return texto.replace(SELLO, `/* marco: ${marco} */`);
  const m = /^#![^\n]*\n/.exec(texto);
  return m
    ? `${m[0]}/* marco: ${marco} */\n${texto.slice(m[0].length)}`
    : `/* marco: ${marco} */\n${texto}`;
}
