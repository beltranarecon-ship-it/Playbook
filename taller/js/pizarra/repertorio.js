/* ============================================================
   pizarra/repertorio.js — qué puede hacer una ficha ahora mismo
   (§4.2, §4.3, §4.4).

   Módulo PURO: sin DOM. Lo prueba en Node
   taller/tools/eval-repertorio.mjs.

   Decide DOS cosas, y las dos salen del catálogo compartido
   (ia/acciones.js), no de una lista paralela:

     · qué seis acciones salen en el anillo, según el estado de la
       ficha —lleva balón, no lo lleva, es defensor—;
     · qué VARIANTES técnicas ofrece cada una de ellas.

   ── LA VARIANTE ES UN MODIFICADOR, NO OTRA ACCIÓN ───────────
   Un «cambio por la espalda» no es un desplazamiento distinto: es CÓMO
   se hace el bote. Como acción propia, el catálogo se multiplicaría
   —bota, bota con cambio, bota con reverso, bota entre las piernas…— y
   la geometría se duplicaría con él.

   Como modificador, la flecha sigue siendo una sola y lo que cambia es
   la etiqueta del ejercicio, la fila de la rúbrica y el vídeo. Y se
   pueden acumular: «bota → cambio por la espalda».

   ── EL VOCABULARIO SIGUE SIENDO ÚNICO ───────────────────────
   Cada variante que corresponda a un concepto de baloncesto declara su
   `tag`, y ese tag TIENE que existir ya en el vocabulario de la
   biblioteca (ia/vocabulario.js → TAGS). Es la misma regla que cumplen
   las acciones, y su banco la comprueba: si alguien inventa aquí una
   palabra nueva, el ejercicio se etiquetaría con algo que ni el
   planificador ni la rúbrica saben leer.

   Las que son solo una forma de ejecutar —«recto», «normal»— llevan
   `tag: null`, igual que las mecánicas del motor.
   ============================================================ */

import { CATALOGO_SISTEMA } from '../ia/acciones.js';

/* ── En qué estado está una ficha ──────────────────────────── */

export const ESTADOS = ['conBalon', 'sinBalon', 'defensor'];

/**
 * El estado NO es una propiedad del jugador: es lo que puede hacer en
 * este instante de esta fase. El mismo jugador con balón, sin él y
 * defendiendo ofrece tres anillos distintos.
 */
export function estadoDe({ llevaBalon = false, esDefensor = false } = {}) {
  if (esDefensor) return 'defensor';
  return llevaBalon ? 'conBalon' : 'sinBalon';
}

/* ── El anillo interior ────────────────────────────────────── */

/*
   Seis casillas, ni una más: es lo que entra por los ojos de un
   vistazo y lo que se acierta con el dedo sin afinar. Lo que no cabe
   está a un toque, en «⋯ más».

   Los iconos son de una sola figura a propósito: en una casilla de
   treinta píxeles, un dibujo con detalle no se distingue de otro.
*/
const ICONOS = {
  bota: '⛹', pasa: '➜', tira: '◎', entra: '⇥', finta: '↯', para: '■',
  corta: '⤳', bloquea: '▮', recoge: '↺', vuelve_a_fila: '⟲', pivota: '↻',
  defiende: '⌒', rodea: '∿', cambia_de_mano: '⇄', protege: '⊙',
};

/*
   Las acciones de defensa que faltan —robar, ser sobrepasado, cambiar
   de par, cerrar el rebote— NO se inventan aquí, y es deliberado:

     · «robo» no existe en el vocabulario de la biblioteca, y meter una
       palabra que la rúbrica no sabe leer rompe la promesa de que el
       vocabulario es único;
     · y las tres últimas no dibujan un movimiento: cambian a QUIÉN
       marca cada uno, que es el modelo de la capa 5.

   Así que salen en el anillo, desactivadas y diciendo por qué. Verlas
   apagadas es mejor que no verlas: enseña el plan y no se olvidan.
*/
const PENDIENTES = {
  roba: { nombre: 'Roba', icono: '✚', motivo: 'llega con la defensa (capa 5): cambia la posesión y los papeles' },
  ayuda: { nombre: 'Ayuda', icono: '↔', motivo: 'llega con la defensa (capa 5)' },
  sobrepasado: { nombre: 'Es sobrepasado', icono: '⇢', motivo: 'llega con la defensa (capa 5)' },
  cambia_marca: { nombre: 'Cambia con…', icono: '⇄', motivo: 'llega con la defensa (capa 5): cambia el emparejamiento' },
  cierra_rebote: { nombre: 'Cierra el rebote', icono: '⊔', motivo: 'llega con la defensa (capa 5)' },
};

export const ANILLO = {
  conBalon: ['bota', 'pasa', 'tira', 'entra', 'finta', 'para'],
  sinBalon: ['corta', 'bloquea', 'recoge', 'vuelve_a_fila', 'finta', 'pivota'],
  defensor: ['defiende', 'roba', 'ayuda', 'sobrepasado', 'cambia_marca', 'cierra_rebote'],
};

/**
 * Las seis casillas de un estado, ya resueltas contra el catálogo.
 *
 * @param catalogo  el fusionado (sistema + club); por defecto, el del
 *                  sistema, para que esto funcione sin red
 * @returns [{ slug, nombre, icono, accion, pendiente, motivo }]
 */
export function anilloDe(estado, catalogo = CATALOGO_SISTEMA) {
  const porSlug = new Map(catalogo.map((a) => [a.slug, a]));
  return (ANILLO[estado] || ANILLO.sinBalon).map((slug) => {
    const accion = porSlug.get(slug);
    if (accion) {
      return { slug, nombre: accion.nombre, icono: ICONOS[slug] || '•', accion, pendiente: false, motivo: null };
    }
    const p = PENDIENTES[slug];
    return {
      slug,
      nombre: p ? p.nombre : slug,
      icono: p ? p.icono : '•',
      accion: null,
      pendiente: true,
      motivo: p ? p.motivo : 'no está en el catálogo',
    };
  });
}

/** Todo lo que NO cabe en el anillo, para el «⋯ más». */
export function resto(estado, catalogo = CATALOGO_SISTEMA) {
  const dentro = new Set(ANILLO[estado] || []);
  return catalogo.filter((a) => !dentro.has(a.slug));
}

/* ── El anillo exterior: las variantes ─────────────────────── */

const V = (slug, nombre, tag = null, descripcion = '') => ({ slug, nombre, tag, descripcion, video: null });

/**
 * Cómo se hace cada acción. La primera de cada lista es la de siempre
 * —la que sale si no se elige nada— y por eso lleva `tag: null`: «un
 * pase recto» no es un concepto que evaluar, es un pase.
 */
export const VARIANTES = {
  pasa: [
    V('recto', 'Recto'),
    V('picado', 'Picado', 'pase picado', 'Bota una vez antes de llegar. El que pasa por debajo de los brazos.'),
    V('pecho', 'De pecho', 'pase de pecho'),
    V('beisbol', 'De béisbol', 'pase de béisbol', 'A una mano y a distancia, para abrir el contraataque.'),
    V('bombeado', 'Bombeado', null, 'Por encima de la defensa, al que se ha ido por detrás.'),
    V('mano_a_mano', 'Mano a mano', null, 'Entrega en corto, casi tocándose.'),
  ],
  bota: [
    V('normal', 'Normal'),
    V('cambio_mano', 'Cambio de mano', 'cambio de mano'),
    V('espalda', 'Por la espalda', 'cambio de mano'),
    V('piernas', 'Entre las piernas', 'cambio de mano'),
    V('reverso', 'Reverso', 'cambio de dirección'),
    V('protegido', 'Protegido', 'bote de protección', 'De espaldas, con el cuerpo entre el balón y el defensor.'),
  ],
  tira: [
    V('suspension', 'En suspensión', 'mecánica de tiro'),
    V('tras_bote', 'Tras bote', 'tiro tras bote'),
    V('tras_recepcion', 'Tras recepción', 'tiro tras recepción'),
    V('gancho', 'Gancho', null),
    V('palmeo', 'Palmeo', 'rebote ofensivo'),
  ],
  entra: [
    V('doble_ritmo', 'Doble ritmo', 'doble ritmo'),
    V('bandeja', 'Bandeja', 'bandeja'),
    V('reverso', 'Reverso', 'cambio de dirección'),
    V('eurostep', 'Eurostep', null),
    V('bomba', 'Bomba', null, 'Parada en dos tiempos y tiro cerca del aro.'),
  ],
  corta: [
    V('recto', 'Recto', 'corte'),
    V('puerta_atras', 'Puerta atrás', 'puerta atrás'),
    V('en_v', 'En V', 'desmarque'),
    V('en_l', 'En L', 'desmarque'),
    V('rizo', 'Rizo', 'desmarque'),
  ],
  bloquea: [
    V('directo', 'Directo', 'bloqueo directo'),
    V('indirecto', 'Indirecto', 'bloqueo indirecto'),
    V('ciego', 'Ciego', 'bloqueo indirecto'),
    V('mano_a_mano', 'Mano a mano', 'bloqueo directo'),
  ],
};

/** Las variantes de una acción, o lista vacía si no tiene. */
export const variantesDe = (slug) => VARIANTES[slug] || [];
export const tieneVariantes = (slug) => variantesDe(slug).length > 0;

/** La variante por defecto: la primera, la de toda la vida. */
export const variantePorDefecto = (slug) => variantesDe(slug)[0] || null;

/* ── Qué le falta a una acción para poder dibujarse ────────── */

/**
 * Qué hay que preguntar después de elegirla (§4.4):
 *
 *   destino    hay que dibujar un trazo hasta algún sitio
 *   companero  hay que señalar a otra ficha
 *   desenlace  hay que decir si entra o falla
 *
 * Sale de la FAMILIA y de lo que la acción declare en `pide`, no de una
 * lista de casos escrita a mano: una acción que cree el club hereda la
 * pregunta sin que nadie toque esto.
 */
export function necesita(accion) {
  if (!accion) return { destino: false, companero: false, desenlace: false };
  const pide = new Set(accion.pide || []);
  const p = accion.parametros || {};
  const familia = accion.familia;

  const destino = familia === 'desplazamiento'
    ? (pide.has('destino') || p.destino == null ? p.destino !== 'fila_propia' && p.destino !== 'aro' : false)
    : (familia === 'balon' && p.modo === 'pase');
  return {
    destino: !!destino || pide.has('destino'),
    companero: familia === 'entre_dos' && (pide.has('companero') || p.companero == null),
    desenlace: familia === 'balon' && (p.modo === 'tiro'),
  };
}
