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

   ── LAS CUENTAS NO SE COPIAN, SE PIDEN ──────────────────────
   `puntoADistanciaDe` sale de canvas/escala.js y las dos distancias de
   parada, del CATÁLOGO de acciones (ia/acciones.js), que es donde cada
   familia declara la suya. Con dos copias del número, el trazo que se
   ve al dibujar y el que anima el motor acabarían a distinta distancia
   del aro, y eso no se ve hasta que se proyecta.

   ── LO QUE NO SE PUEDE SABER, SE DICE ───────────────────────
   «Vuelve a la fila» necesita saber de qué fila salió, y las filas son
   de los conos (§7), que todavía no existen. Devuelve `null` con su
   motivo en vez de inventarse una esquina.
   ============================================================ */

import { posicionesDe } from '../canvas/anclas.js';
import { puntoADistanciaDe, metrosEntre, escalaDe } from '../canvas/escala.js';
import { limitesCancha } from '../canvas/medidas.js';
import { FAMILIAS } from '../ia/acciones.js';

/** A cuánto del aro se para quien acaba «pegado», en metros. Del
 *  catálogo: una acción puede traer la suya, y esta es la de reserva. */
export const METROS_FINALIZACION = FAMILIAS.desplazamiento.parametros.separacion.porDefecto;
/** Y a cuánto del balón se para quien va a recogerlo. */
export const METROS_RECOGIDA = FAMILIAS.balon.parametros.separacion.porDefecto;

/** A cuánto del aro rebota un tiro que falla, en metros. */
export const METROS_REBOTE = 2.5;
/** Y cuánto por delante del aro cae uno que entra. */
export const METROS_CAIDA = 0.6;

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
 * Dónde queda el balón SUELTO después de un tiro (§4.4).
 *
 *   falla  rebota a METROS_REBOTE del aro, hacia dentro de la pista y
 *          hacia el lado CONTRARIO al del tirador (desde la izquierda,
 *          sale por la derecha); desde el centro, recto hacia fuera.
 *   entra  cae bajo el aro, METROS_CAIDA hacia dentro de la pista.
 *
 * Es un cálculo y no un dato guardado: si el tirador se mueve en una
 * fase anterior, el rebote cambia con él. Todo se mide en METROS —los
 * dos ejes no escalan igual— y se recorta dentro de la cancha.
 *
 * @param desde  de dónde sale el tiro (el primer nodo de su trazo)
 * @returns { x, y } o null si la pista no tiene aro conocido
 */
export function trasElTiro({ pista = 'entera', canasta = 'norte', desde = null, desenlace = 'entra' } = {}) {
  const pos = posicionesDe(pista, canasta);
  if (!pos || !pos.aro) return null;
  const aro = { x: pos.aro[0], y: pos.aro[1] };
  const e = escalaDe(pista);
  const lim = limitesCancha(pista);

  /* HACIA DENTRO DE LA PISTA es el eje largo, del aro hacia el centro de
     la cancha: así vale igual en vertical y en horizontal, y para las
     dos canastas. Lo de al lado es el eje perpendicular. */
  const cx = ((lim.x[0] + lim.x[1]) / 2 - aro.x) * e.x;
  const cy = ((lim.y[0] + lim.y[1]) / 2 - aro.y) * e.y;
  const dentro = Math.abs(cx) >= Math.abs(cy) ? { x: Math.sign(cx) || 1, y: 0 } : { x: 0, y: Math.sign(cy) || 1 };
  const lado = { x: dentro.y, y: dentro.x };

  let dir = dentro;
  let metros = METROS_CAIDA;
  if (desenlace === 'falla') {
    metros = METROS_REBOTE;
    const d = desde && Number.isFinite(desde.x) ? { x: (desde.x - aro.x) * e.x, y: (desde.y - aro.y) * e.y } : { x: 0, y: 0 };
    const deLado = d.x * lado.x + d.y * lado.y;
    /* Medio metro de margen: un tiro casi centrado no elige lado por un
       centímetro, sale recto. */
    const signo = deLado > 0.5 ? -1 : deLado < -0.5 ? 1 : 0;
    const v = { x: dentro.x + lado.x * signo, y: dentro.y + lado.y * signo };
    const largo = Math.hypot(v.x, v.y) || 1;
    dir = { x: v.x / largo, y: v.y / largo };
  }

  const margen = 0.3;
  const dentroDe = (v, [a, b], escala) => Math.min(b - margen / escala, Math.max(a + margen / escala, v));
  return {
    x: dentroDe(aro.x + (dir.x * metros) / e.x, lim.x, e.x),
    y: dentroDe(aro.y + (dir.y * metros) / e.y, lim.y, e.y),
  };
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
