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

   ── EL SITIO DE UN BLOQUEO ──────────────────────────────────
   «Bloquea» tampoco pregunta a dónde: se pincha al compañero y el
   bloqueador va solo a pegarse a su defensor (§4.4). Ver
   `sitioDelBloqueo`.
   ============================================================ */

import { posicionesDe } from '../canvas/anclas.js';
import { finalDeFila } from './filas.js';
import { puntoADistanciaDe, metrosEntre, escalaDe } from '../canvas/escala.js';
import { limitesCancha } from '../canvas/medidas.js';
import { FAMILIAS } from '../ia/acciones.js';
import { flattenPath } from '../canvas/geometry.js';
import { PARAMETROS, enCancha } from './motor/defensa.js';

/** A cuánto del aro se para quien acaba «pegado», en metros. Del
 *  catálogo: una acción puede traer la suya, y esta es la de reserva. */
export const METROS_FINALIZACION = FAMILIAS.desplazamiento.parametros.separacion.porDefecto;
/** Y a cuánto del balón se para quien va a recogerlo. */
export const METROS_RECOGIDA = FAMILIAS.balon.parametros.separacion.porDefecto;

/** A cuánto del aro rebota un tiro que falla, en metros. */
export const METROS_REBOTE = 2.5;
/** Y cuánto por delante del aro cae uno que entra. */
export const METROS_CAIDA = 0.6;

/** Dónde espera el defensor de alguien con la regla de serie, «entre su
 *  par y el aro» (§8.3): a 1,2 m si su par lleva balón y a 2,0 m si no.
 *  Y a cuánto de ese defensor se planta quien le bloquea: cuerpo con
 *  cuerpo, sin llegar a pisarle. Los números viven en motor/defensa.js,
 *  que es donde se ajustan por ejercicio; aquí solo se leen. */
export const METROS_PAR_CON_BALON = PARAMETROS.par_con_balon;
export const METROS_PAR_SIN_BALON = PARAMETROS.par_sin_balon;
export const METROS_BLOQUEO = PARAMETROS.bloqueo;

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
    /* AL FINAL DE SU FILA (§7.4.2): la del cono del que salió, o la que
       diga su fila como vuelta. Quien no salió de ninguna no tiene a
       dónde volver, y no se inventa. */
    const suya = elemento.fila_de ? (elementos || []).find((e) => e && e.id === elemento.fila_de && e.kind === 'cono') : null;
    if (!suya || !suya.fila) return { motivo: 'no ha salido de ninguna fila' };
    const vuelta = suya.fila.vuelta
      ? (elementos || []).find((e) => e && e.id === suya.fila.vuelta && e.kind === 'cono' && e.fila)
      : null;
    const cono = vuelta || suya;
    return { punto: finalDeFila(cono, cono.fila.n, cono.fila.orientacion, pista) };
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

  return enCancha(pista, { x: aro.x + (dir.x * metros) / e.x, y: aro.y + (dir.y * metros) / e.y });
}

/* ── El bloqueo (§4.4) ─────────────────────────────────────── */

/**
 * ¿Esta acción es un bloqueo? Lo dice la relación que dibuja, en el
 * catálogo, y no su nombre: un bloqueo que cree el club vale igual.
 */
export const esAccionDeBloqueo = (accion) => !!accion && accion.familia === 'entre_dos'
  && !!accion.parametros && accion.parametros.simbolo_relacion === 'bloqueo';

/**
 * Dónde está el defensor de alguien mientras la defensa no exista: donde
 * lo pondría la regla de serie, entre él y el aro (§8.3).
 *
 * @returns { x, y } o null si la pista no tiene aro conocido
 */
export function defensorSupuesto({ pista = 'entera', canasta = 'norte', par = null, conBalon = false } = {}) {
  if (!par || !Number.isFinite(par.x) || !Number.isFinite(par.y)) return null;
  const pos = posicionesDe(pista, canasta);
  if (!pos || !pos.aro) return null;
  const aro = { x: pos.aro[0], y: pos.aro[1] };
  return puntoADistanciaDe(pista, aro, par, conBalon ? METROS_PAR_CON_BALON : METROS_PAR_SIN_BALON);
}

/**
 * Dónde se planta quien bloquea (§4.4: «el que actúa se desplaza hasta el
 * sitio que le corresponde»).
 *
 * Un bloqueo se le pone AL DEFENSOR del compañero, y se pone AL LADO: a
 * METROS_BLOQUEO de él, en perpendicular a la línea compañero→aro, por el
 * lado por el que llega el bloqueador. Es por ahí por donde el compañero
 * sale rozándole. Parándose en su camino, el bloqueador que llegaba desde
 * la altura del compañero se quedaba encima de él.
 *
 * Mientras no haya defensa, el defensor es el supuesto
 * (`defensorSupuesto`) cuando no hay defensa en la pista; si la hay, se
 * pone al lado del defensor de verdad, que es a quien se bloquea.
 *
 * Es automático y ajustable, como «entra»: si no gusta, se pincha el trazo
 * y se mueve su final. Todo en METROS, y dentro de la cancha.
 *
 * @param desde      dónde está el bloqueador
 * @param companero  dónde está el compañero al que se le pone
 * @param conBalon   si el compañero lleva balón
 * @returns { x, y } o null si no se puede saber
 */
export function sitioDelBloqueo({ pista = 'entera', canasta = 'norte', desde = null, companero = null, conBalon = false, defensor: suDefensor = null } = {}) {
  if (!desde || !Number.isFinite(desde.x) || !Number.isFinite(desde.y)) return null;
  if (!companero || !Number.isFinite(companero.x) || !Number.isFinite(companero.y)) return null;
  /* Con defensa en la pista se bloquea al DEFENSOR DE VERDAD, donde
     está. El supuesto es para cuando no hay ninguno: entonces se pone
     donde lo pondría la regla de serie. */
  const defensor = (suDefensor && Number.isFinite(suDefensor.x) && Number.isFinite(suDefensor.y))
    ? { x: suDefensor.x, y: suDefensor.y }
    : defensorSupuesto({ pista, canasta, par: companero, conBalon });
  if (!defensor) return null;
  const e = escalaDe(pista);
  // la línea compañero→defensor (que va hacia el aro), en metros
  const lx = (defensor.x - companero.x) * e.x, ly = (defensor.y - companero.y) * e.y;
  const largo = Math.hypot(lx, ly);
  /* Con el compañero debajo del aro no hay línea de la que ponerse al
     lado: se acerca al defensor por su camino. */
  if (largo < 1e-9) return enCancha(pista, puntoADistanciaDe(pista, desde, defensor, METROS_BLOQUEO));
  const px = -ly / largo, py = lx / largo;
  const lado = ((desde.x - defensor.x) * e.x * px + (desde.y - defensor.y) * e.y * py) < 0 ? -1 : 1;
  return enCancha(pista, {
    x: defensor.x + (px * lado * METROS_BLOQUEO) / e.x,
    y: defensor.y + (py * lado * METROS_BLOQUEO) / e.y,
  });
}

/**
 * Hacia dónde mira la barra de un bloqueo: hacia delante, en la dirección
 * con la que el bloqueador llega a su sitio, que es hacia el defensor al
 * que se planta.
 *
 * Es un PUNTO un poco más allá del final y no un ángulo: así lo gira bien
 * cualquier vista, también la del proyector, que rota la pista 90°.
 *
 * @returns { x, y } o null si el trazo no avanza (ya estaba en su sitio)
 */
export function frenteDelBloqueo(trazo) {
  if (!Array.isArray(trazo) || trazo.length < 2) return null;
  const flat = flattenPath(trazo);
  const fin = flat[flat.length - 1];
  for (let i = flat.length - 2; i >= 0; i--) {
    const dx = fin.x - flat[i].x, dy = fin.y - flat[i].y;
    const largo = Math.hypot(dx, dy);
    if (largo > 1e-9) return { x: fin.x + (dx / largo) * 0.05, y: fin.y + (dy / largo) * 0.05 };
  }
  return null;
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
