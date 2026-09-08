/* ============================================================
   pizarra/destino.js — a dónde va lo que ya sabe a dónde va (§4.4).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-destino.mjs.

   ── EL PROBLEMA QUE RESUELVE ────────────────────────────────
   El §4.4 mete cinco acciones en la fila «con destino»: bota, corta,
   entra, recoge y vuelve a la fila. Pero tres de ellas ya saben a
   dónde van y por eso el catálogo se lo dice: «entra» va al aro,
   «recoge» va a por el balón suelto y «vuelve a la fila» va a su cola.
   Preguntarle al entrenador un destino que la app ya conoce es hacerle
   trabajo.

   Así que se calcula, se dibuja el trazo hecho, y si no le gusta lo
   corrige pinchándolo y moviendo sus nodos, que es lo que ya funciona.
   Es la decisión tomada: automático y ajustable.

   ── LAS CUENTAS SON LAS DEL MOTOR, NO UNAS PARECIDAS ────────
   `puntoADistanciaDe` y las dos distancias de parada salen de donde
   ya estaban —canvas/escala.js y ia/compilador.js— en vez de copiarse
   aquí. Con dos copias del número, el trazo que se ve al dibujar y el
   que anima el motor acabarían a distinta distancia del aro, y eso no
   se ve hasta que se proyecta.

   ── LO QUE NO SE PUEDE SABER, SE DICE ───────────────────────
   «Vuelve a la fila» necesita saber de qué fila salió, y las filas son
   de los conos (§7), que todavía no existen. Devuelve `null` con su
   motivo en vez de inventarse una esquina.
   ============================================================ */

import { posicionesDe } from '../canvas/anclas.js';
import { puntoADistanciaDe, metrosEntre } from '../canvas/escala.js';
import { METROS_FINALIZACION, METROS_RECOGIDA } from '../ia/compilador.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const punto = (p) => ({ x: clamp01(p.x), y: clamp01(p.y) });

/**
 * ¿Esta acción sabe sola a dónde va?
 *
 * Sale del catálogo —del `destino` cerrado o del `modo`— y no de una
 * lista de slugs: una acción nueva del club que apunte al aro hereda
 * esto sin tocar nada.
 */
export function tieneDestinoPropio(accion) {
  const p = (accion && accion.parametros) || {};
  return p.destino === 'aro' || p.destino === 'fila_propia' || p.modo === 'recoge';
}

/**
 * Dónde termina el trazo de una acción que ya sabe a dónde va.
 *
 * @returns { punto } si se puede calcular, o { motivo } si no.
 */
export function destinoDe(accion, elemento, {
  pista = 'entera', canasta = 'norte', elementos = [],
} = {}) {
  const p = (accion && accion.parametros) || {};
  if (!elemento || !Number.isFinite(elemento.x)) return { motivo: 'no sé desde dónde sale' };
  const desde = { x: elemento.x, y: elemento.y };

  if (p.destino === 'aro') return { punto: alAro(desde, p, pista, canasta) };
  if (p.modo === 'recoge') return alBalon(desde, p, pista, elementos);
  if (p.destino === 'fila_propia') {
    /* Las filas son de los conos (§7). Hasta que existan, esto no se
       puede saber y no se inventa. */
    return { motivo: 'todavía no hay filas en la pista' };
  }
  return { motivo: 'esta acción no tiene un destino propio' };
}

/**
 * Al aro, pero no ENCIMA del aro: se para donde uno se apoya para
 * subir. Con la ficha encima, el símbolo taparía la canasta entera y
 * no se vería si entra o no.
 */
function alAro(desde, p, pista, canasta) {
  const aro = posicionesDe(pista, canasta).aro;
  const meta = { x: aro[0], y: aro[1] };
  if (p.alcance === 'pegado') {
    const sep = Number.isFinite(p.separacion) ? p.separacion : METROS_FINALIZACION;
    return punto(puntoADistanciaDe(pista, desde, meta, sep));
  }
  if (p.alcance === 'parcial') {
    /* Una penetración que aún no termina: avanza su fracción hacia la
       canasta y se queda ahí. */
    const a = Number.isFinite(p.avance) ? p.avance : 0.5;
    return punto({ x: desde.x + (meta.x - desde.x) * a, y: desde.y + (meta.y - desde.y) * a });
  }
  return punto(meta);
}

/**
 * A por el balón SUELTO más cercano — que en la práctica es el que
 * acaba de tirar quien va a recogerlo—, y se para al lado, no encima,
 * por lo mismo que el aro.
 */
function alBalon(desde, p, pista, elementos) {
  const sueltos = (elementos || []).filter((e) => e && e.kind === 'balon' && !e.portador_id && Number.isFinite(e.x));
  if (!sueltos.length) return { motivo: 'no hay ningún balón suelto que recoger' };
  let mejor = null, corta = Infinity;
  for (const b of sueltos) {
    const d = metrosEntre(pista, desde, b);
    if (d < corta) { corta = d; mejor = b; }
  }
  const sep = Number.isFinite(p.separacion) ? p.separacion : METROS_RECOGIDA;
  return { punto: punto(puntoADistanciaDe(pista, desde, mejor, sep)), balon: mejor.id };
}
