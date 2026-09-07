/* ============================================================
   pizarra/guias.js — las líneas que avisan de que algo está
   alineado (§3.5).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-iman.mjs, junto al imán, porque son las dos caras
   del mismo problema.

   ── QUÉ RESUELVE, Y EN QUÉ SE DIFERENCIA DEL IMÁN ───────────
   El imán PEGA: mueve lo que sueltas a un sitio exacto. Las guías solo
   AVISAN: aparece una línea fina cuando lo que arrastras queda a la
   misma altura que otra ficha, y se apaga al soltar. No mueven nada.

   Esa diferencia está en la especificación y es deliberada. Colocar
   cinco jugadores simétricos es «buen ojo» hoy; con las guías deja de
   serlo, pero sin quitarle al entrenador el control de dónde acaba
   cada uno. Un imán aquí se sentiría como pelear con la pizarra.

   ── LA TOLERANCIA VA EN METROS ──────────────────────────────
   0,25 m, no un número de píxeles. El marco de la pista entera es
   18 × 27 m, así que un mismo incremento normalizado vale metro y
   medio más a lo largo que a lo ancho: comparar en normalizado daría
   guías que aparecen antes en un eje que en el otro sin motivo. Y en
   píxeles, la ayuda cambiaría con el zoom.
   ============================================================ */

import { marcoDe } from '../canvas/medidas.js';
import { posicionesDe } from '../canvas/anclas.js';

/** Cuánto se puede desviar algo y seguir contando como alineado. */
export const TOLERANCIA = 0.25;

/** Cuántas guías se enseñan como mucho por eje. Más de dos es ruido:
 *  con cinco jugadores en una fila salen cuatro líneas iguales y no se
 *  distingue con cuál te has alineado. */
export const MAX_POR_EJE = 2;

/**
 * Con qué está alineado lo que se está moviendo.
 *
 * @param movido    { id, x, y } lo que se arrastra
 * @param elementos los demás (el propio se descarta por id)
 * @param pista     clave de pista, para convertir a metros
 * @param opciones  { tolerancia, canasta, conAnclas }
 * @returns { verticales: [{ x, con: [id] }], horizontales: [{ y, con: [id] }] }
 *
 * Una guía VERTICAL significa «comparten la misma x»: se dibuja como
 * una línea de arriba abajo. La horizontal, al revés. Se devuelven las
 * coordenadas de la REFERENCIA, no las del que se mueve, porque la
 * línea tiene que pasar por lo que ya estaba quieto.
 */
export function guiasDe(movido, elementos = [], pista = 'entera', opciones = {}) {
  const vacio = { verticales: [], horizontales: [] };
  if (!movido || !Number.isFinite(movido.x) || !Number.isFinite(movido.y)) return vacio;

  const tol = Number.isFinite(opciones.tolerancia) ? opciones.tolerancia : TOLERANCIA;
  const marco = marcoDe(pista);
  /* La tolerancia, de metros a normalizado, POR EJE. Es todo el motivo
     de que este módulo conozca el marco. */
  const tolX = tol / marco.ancho;
  const tolY = tol / marco.alto;

  const refs = [];
  for (const e of elementos) {
    if (!e || e.id === movido.id || e.kind === 'zona') continue;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
    refs.push({ x: e.x, y: e.y, id: e.id });
  }
  /* El aro y los puntos de la cancha también alinean: «en línea con el
     aro» es una colocación que se pide todos los días. Se añaden solo
     si se piden, porque en una pizarra con dos fichas llenarían la
     pantalla de líneas. */
  if (opciones.conAnclas) {
    const anclas = posicionesDe(pista, opciones.canasta || 'norte') || {};
    for (const [slug, xy] of Object.entries(anclas)) refs.push({ x: xy[0], y: xy[1], id: `ancla:${slug}` });
  }

  const eje = (clave, tolerancia) => {
    const cerca = refs
      .map((r) => ({ v: r[clave], d: Math.abs(r[clave] - movido[clave]), id: r.id }))
      .filter((r) => r.d <= tolerancia)
      .sort((a, b) => a.d - b.d);
    /* Varias referencias a la MISMA altura son una sola guía: cinco
       jugadores en fila producen una línea, no cinco. Se agrupan por
       coordenada, con la misma tolerancia. */
    const grupos = [];
    for (const r of cerca) {
      const g = grupos.find((x) => Math.abs(x.v - r.v) <= tolerancia);
      if (g) { g.con.push(r.id); continue; }
      grupos.push({ v: r.v, con: [r.id] });
    }
    return grupos.slice(0, MAX_POR_EJE);
  };

  return {
    verticales: eje('x', tolX).map((g) => ({ x: g.v, con: g.con })),
    horizontales: eje('y', tolY).map((g) => ({ y: g.v, con: g.con })),
  };
}

/** ¿Hay algo que enseñar? Para no repintar por gusto. */
export const hayGuias = (g) => !!g && (g.verticales.length > 0 || g.horizontales.length > 0);
