/* ============================================================
   pizarra/fases.js — el compás de la jugada (§6.1, §6.2, §6.3).

   Módulo PURO: sin DOM, sin canvas, sin red. Lo prueba en Node
   taller/tools/eval-fases.mjs.

   ── QUÉ ES UNA FASE ─────────────────────────────────────────
   Un compás con UN CARRIL POR FICHA:

     · dentro de un carril, los tramos van EN SERIE — una ficha no
       puede cortar y botar a la vez;
     · entre carriles, EN PARALELO — cinco jugadores se mueven a la vez,
       que es de lo que va el baloncesto;
     · la fase dura lo que el carril más largo, y quien acaba antes se
       queda quieto esperando.

   Eso es lo que contesta la pregunta que quedó abierta en su día: «si
   encadeno secuencias, ¿cómo hago que dos jugadores hagan algo a la
   vez?». No se hace nada especial — se dibuja lo de cada uno, y como
   están en carriles distintos, salen a la vez.

   ── LOS ARRANQUES SON LO ÚNICO DIFÍCIL (§6.3) ───────────────
   Por defecto todos los carriles arrancan a la vez, en el cero de la
   fase. Pero hay cosas que no pueden empezar antes de que pase otra, y
   son EVIDENTES para un entrenador aunque nadie las escriba:

     · quien recibe un pase no sale hasta que el balón llega;
     · quien va a por un balón suelto no sale hasta que está suelto.

   Sin esto, el receptor echa a correr con el balón todavía en el aire y
   la jugada se ve mal sin que nadie sepa decir por qué. Con esto, sale
   bien sin que el entrenador toque un solo número.

   Y todo se puede forzar a mano: un tramo con `manual: true` conserva su
   `inicio_ms` y deja de recalcularse (§6.3).

   El tercer arranque evidente del §6.3 es el del bloqueo: quien sale de
   un bloqueo no sale hasta que el bloqueador ha llegado. Se lee del
   tramo del bloqueo, que sabe para quién es (`companero_id`).

   Un tramo puede esperar a VARIAS cosas a la vez —que le llegue el balón
   y que le pongan el bloqueo—, y entonces espera a la que acabe más
   tarde.

   Y el bloqueador AGUANTA: lo siguiente que haga después de bloquear
   —rodar al aro, abrirse— no sale hasta que su compañero le pasa por el
   lado, que es el punto de su trazo más cercano al bloqueo. Lo decidió el
   entrenador: saliendo en cuanto llegaba, la barra del bloqueo duraba cero
   y en el proyector no se veía.
   ============================================================ */

import { duracionDe, longitudMetros, reanclar, fraccionMasCercana } from './trazo.js';
import { tiempoDeRecorrido } from '../canvas/instante.js';
import { trasElTiro } from './destino.js';

/** Ningún tramo dura menos que esto: un movimiento de dos palmos
 *  seguiría siendo un movimiento, y con duración cero el motor tendría
 *  que dividir por cero para repartir el recorrido. */
export const MINIMO_TRAMO_MS = 120;

/** Lo que tarda el balón en caer o rebotar después de llegar al aro
 *  (§6.2: «más 0,3 s de vuelo»). */
export const TRAS_EL_TIRO_MS = 300;

/** ¿Es un tiro? Se lee del DATO —el tramo sabe si entra o falla—, no del
 *  nombre de la acción: una acción de tiro del club vale igual. */
export const esTiro = (t) => !!t && (t.desenlace === 'entra' || t.desenlace === 'falla');

/** ¿Es un bloqueo? Del DATO: su trazo acaba en la barra y sabe para quién
 *  es. Un bloqueo que cree el club vale igual. */
export const esBloqueo = (t) => !!t && t.tipo === 'bloqueo' && !!t.companero_id;

/* ── El armazón ────────────────────────────────────────────── */

export function nuevaFase(id, { nombre = null } = {}) {
  return {
    id,
    nombre,
    duracion_ms: null,      // null = calculada
    pausa_post_ms: null,
    rama_de: null,
    rama_nombre: null,
    reune: [],
    carriles: [],
    /* Lo que algún defensor haga distinto en esta fase (§8.5). No son
       tramos: no dibujan un camino (§11.1). */
    defensa: {},
    texto: null,            // null = frase automática
  };
}

/**
 * Agrupa una lista plana de tramos en carriles, UNO POR FICHA.
 *
 * El orden importa dos veces y de dos maneras distintas: los carriles
 * salen en el orden en que cada ficha entró en escena —para que la
 * línea de tiempo no baile de sitio cada vez que se dibuja algo— y
 * dentro de cada carril, los tramos salen en el orden en que se
 * dibujaron, que es el orden en que ocurren.
 *
 * Se agrupa por QUIEN ACTÚA y no por quien recorre el trazo: un pase lo
 * recorre el balón, pero el carril es del que pasa. Si no, cada balón
 * abriría su propio carril y la línea de tiempo tendría filas que no
 * corresponden a nadie de la pista.
 */
export function carrilesDesde(tramos) {
  const porElemento = new Map();
  (tramos || []).forEach((t, i) => {
    if (!t || !t.elemento_id) return;
    if (!porElemento.has(t.elemento_id)) porElemento.set(t.elemento_id, []);
    /* EL ORDEN EN QUE SE DIBUJÓ VIAJA CON EL TRAMO. Al agrupar por ficha
       se pierde: en la lista quedan primero todos los de A2 y luego los
       de A1, aunque el pase de A1 se dibujara en medio. Y los arranques
       lo necesitan —«el primer tramo del receptor DESPUÉS del pase» no
       significa nada sin él—, así que se anota, en una copia, en vez de
       deducirlo de un orden que ya no está. */
    porElemento.get(t.elemento_id).push({ ...t, orden: i });
  });
  return [...porElemento].map(([elemento, lista]) => ({ elemento, tramos: lista }));
}

/** Los tramos de una ficha en esta fase, en orden. */
export function tramosDe(fase, elementoId) {
  const c = (fase.carriles || []).find((x) => x.elemento === elementoId);
  return c ? c.tramos : [];
}

/* ── Cuánto dura cada cosa (§6.2) ──────────────────────────── */

/**
 * Lo que dura recorrer un tramo, en milisegundos.
 *
 * Sale de la distancia y del ritmo, con las mismas cuentas que usa el
 * repaso al dibujarlo: si aquí se contara distinto, el tramo duraría
 * una cosa al soltarlo y otra al reproducir la fase.
 *
 * Un `duracion_ms` puesto a mano manda sobre todo lo demás — es el
 * «todo es ajustable» del §6.2.
 */
export function duracionDeTramo(tramo, pista = 'entera') {
  if (Number.isFinite(tramo && tramo.duracion_ms)) return Math.max(MINIMO_TRAMO_MS, tramo.duracion_ms);
  if (!tramo || !tramo.trazo || tramo.trazo.length < 2) return MINIMO_TRAMO_MS;
  const s = duracionDe(longitudMetros(tramo.trazo, pista), tramo.ritmo || 'normal');
  return Math.max(MINIMO_TRAMO_MS, Math.round(s * 1000));
}

/* ── Los arranques (§6.3) ──────────────────────────────────── */

/* De qué tramos depende otro para poder arrancar.
   Se lee de lo que ya guarda cada tramo —quién recibe un pase, qué balón
   recoge alguien, para quién es un bloqueo— y no de una lista escrita a
   mano.

   Cada espera es { id, u }: esperar a que el tramo `id` llegue a la
   fracción `u` de su TIEMPO. u = 1 es esperar a que acabe, que es lo de
   casi siempre; menos de 1 es esperar a que pase por un sitio. */
function dependencias(carriles, pista = 'entera') {
  const espera = new Map();   // id de tramo -> [{ id, u }] que tienen que haber pasado antes
  const todos = carriles.flatMap((c) => c.tramos);
  const carrilDe = (id) => (carriles.find((c) => c.elemento === id) || { tramos: [] }).tramos;
  /* VARIAS ESPERAS, NO LA PRIMERA. Guardando una sola, si a alguien le
     pasaban el balón y le ponían un bloqueo, esperaba a lo que se hubiera
     mirado antes —que es el orden de los carriles, no el de la jugada— y
     podía salir con el bloqueador todavía de camino. */
  const apunta = (id, previo, u = 1) => {
    const lista = espera.get(id) || [];
    if (!lista.some((e) => e.id === previo && e.u === u)) espera.set(id, [...lista, { id: previo, u }]);
  };
  const aguantes = [];

  for (const p of todos) {
    /* UN PASE MANDA SOBRE EL SIGUIENTE MOVIMIENTO DEL RECEPTOR.
       El receptor no sale hasta que el balón llega; si ya se estaba
       moviendo cuando se lo pasan, ese tramo suyo empezó antes y no se
       toca — lo que espera es el PRIMERO que venga después. */
    if (p.receptor_id) {
      const suyos = (carriles.find((c) => c.elemento === p.receptor_id) || { tramos: [] }).tramos;
      const siguiente = suyos.find((t) => t.orden > p.orden);
      if (siguiente) apunta(siguiente.id, p.id);
    }
    /* IR A POR UN BALÓN SUELTO ESPERA A QUE ESTÉ SUELTO. El tramo que
       lo soltó es el ÚLTIMO pase o tiro anterior sobre ESE balón. Con el
       primero que se encontrara —y se buscaba carril a carril—, en «A1
       pasa a A2, A2 tira y A3 recoge», A3 salía al acabar el pase, con el
       balón todavía en las manos de A2. */
    if (p.accion === 'recoge' && p.balon_id) {
      const suelta = todos
        .filter((t) => t.corre_id === p.balon_id && t.orden < p.orden)
        .reduce((ultima, t) => (!ultima || t.orden > ultima.orden ? t : ultima), null);
      if (suelta) apunta(p.id, suelta.id);
    }
    /* QUIEN SALE DE UN BLOQUEO ESPERA A QUE EL BLOQUEADOR HAYA LLEGADO.
       Como con el receptor: lo que espera es lo PRIMERO que el compañero
       haga después de dibujado el bloqueo, y lo que ya estaba haciendo no
       se retrasa. */
    if (esBloqueo(p)) {
      const siguiente = carrilDe(p.companero_id).find((t) => t.orden > p.orden);
      if (siguiente) apunta(siguiente.id, p.id);
      /* Y lo siguiente del BLOQUEADOR espera a que ese compañero le pase. */
      const propios = carrilDe(p.elemento_id);
      const despues = propios[propios.findIndex((t) => t.id === p.id) + 1];
      if (siguiente && despues && Array.isArray(p.trazo) && p.trazo.length) {
        aguantes.push({ quien: despues.id, espera: siguiente, sitio: p.trazo[p.trazo.length - 1] });
      }
    }
  }

  /* El aguante es la única espera que puede mirar HACIA DELANTE en el
     orden de dibujo, así que se comprueba que no cierra un círculo. Pasa
     en un bloqueo «mano a mano»: el bloqueador entrega el balón a su
     compañero, y el compañero ya espera a esa entrega. Ahí no se aguanta:
     la entrega ES el momento en que le pasa. */
  const anterior = new Map();
  for (const c of carriles) for (let i = 1; i < c.tramos.length; i++) anterior.set(c.tramos[i].id, c.tramos[i - 1].id);
  const depende = (desde, de) => {
    const vistos = new Set();
    const pila = [desde];
    while (pila.length) {
      const x = pila.pop();
      if (x === de) return true;
      if (vistos.has(x)) continue;
      vistos.add(x);
      if (anterior.has(x)) pila.push(anterior.get(x));
      for (const e of espera.get(x) || []) pila.push(e.id);
    }
    return false;
  };
  for (const a of aguantes) {
    if (depende(a.espera.id, a.quien)) continue;
    const trazo = a.espera.trazo;
    const s = Array.isArray(trazo) && trazo.length >= 2 ? fraccionMasCercana(trazo, a.sitio, pista) : 0;
    apunta(a.quien, a.espera.id, tiempoDeRecorrido(s));
  }
  return espera;
}

/**
 * Cuándo empieza y cuándo acaba cada tramo, y cuánto dura la fase.
 *
 * @returns { tramos: { [id]: { inicio_ms, duracion_ms, fin_ms } },
 *            duracion_ms, avisos: [] }
 *
 * Se resuelve por pasadas y no de un tirón porque un arranque puede
 * depender de otro que a su vez depende de un tercero.
 *
 * TAL Y COMO ESTÁN LAS REGLAS HOY, NO PUEDE HABER CICLOS: tres de las
 * dependencias apuntan siempre hacia atrás en el orden de dibujo —el
 * receptor espera a un pase ANTERIOR, quien recoge espera a la suelta
 * ANTERIOR y quien sale de un bloqueo, a un bloqueo ANTERIOR—, y la cuarta
 * —el bloqueador que aguanta— se descarta si cerraría un círculo. El banco
 * lo comprueba. El tope de pasadas y la rama de «nadie ha avanzado» se
 * quedan de todas formas: una regla nueva que mire hacia delante
 * colgaría la pizarra, y colgarse es mucho peor que arrancar pronto.
 */
export function tiemposDe(fase, { pista = 'entera' } = {}) {
  const carriles = (fase && fase.carriles) || [];
  const todos = carriles.flatMap((c) => c.tramos);
  const espera = dependencias(carriles, pista);
  const avisos = [];

  const dur = new Map(todos.map((t) => [t.id, duracionDeTramo(t, pista)]));
  const porId = new Map(todos.map((t) => [t.id, t]));
  const inicio = new Map();
  const fin = new Map();

  /* El tramo anterior EN SU CARRIL: los tramos de una ficha van en
     serie, siempre, pase lo que pase con las dependencias. */
  const anterior = new Map();
  for (const c of carriles) {
    for (let i = 1; i < c.tramos.length; i++) anterior.set(c.tramos[i].id, c.tramos[i - 1].id);
  }

  let quedan = todos.slice();
  let vueltas = 0;
  while (quedan.length && vueltas <= todos.length) {
    vueltas++;
    const siguen = [];
    for (const t of quedan) {
      const previo = anterior.get(t.id);
      const esperados = espera.get(t.id) || [];
      if ((previo && !fin.has(previo)) || esperados.some((e) => !fin.has(e.id))) { siguen.push(t); continue; }
      /* Lo que espera a que acabe un TIRO espera además a que caiga el
         balón: nadie recoge un rebote que todavía está en el aro. Lo que
         espera a que otro pase por un sitio, a ese instante de su tramo. */
      const desde = Math.max(
        previo ? fin.get(previo) : 0,
        ...esperados.map((e) => (e.u >= 1
          ? fin.get(e.id) + (esTiro(porId.get(e.id)) ? TRAS_EL_TIRO_MS : 0)
          : inicio.get(e.id) + dur.get(e.id) * e.u)),
      );
      const i = (t.manual && Number.isFinite(t.inicio_ms)) ? t.inicio_ms : desde;
      inicio.set(t.id, i);
      fin.set(t.id, i + dur.get(t.id));
    }
    if (siguen.length === quedan.length) {
      /* Nadie ha avanzado: lo que queda se espera en círculo. */
      avisos.push({ tipo: 'ciclo', tramos: siguen.map((t) => t.id) });
      for (const t of siguen) {
        const previo = anterior.get(t.id);
        const i = (t.manual && Number.isFinite(t.inicio_ms)) ? t.inicio_ms : (previo && fin.has(previo) ? fin.get(previo) : 0);
        inicio.set(t.id, i);
        fin.set(t.id, i + dur.get(t.id));
      }
      quedan = [];
      break;
    }
    quedan = siguen;
  }

  const tramos = {};
  for (const t of todos) {
    tramos[t.id] = { inicio_ms: inicio.get(t.id) || 0, duracion_ms: dur.get(t.id), fin_ms: fin.get(t.id) || 0 };
  }
  /* Y la fase no acaba mientras el balón de un tiro siga en el aire. */
  const calculada = todos.length ? Math.max(...todos.map((t) => tramos[t.id].fin_ms + (esTiro(t) ? TRAS_EL_TIRO_MS : 0))) : 0;
  return {
    tramos,
    /* La fase dura lo que el carril más largo, salvo que se le haya
       puesto una duración a mano. */
    duracion_ms: Number.isFinite(fase && fase.duracion_ms) ? fase.duracion_ms : calculada,
    avisos,
  };
}

/** Lo que dura un carril: desde el cero de la fase hasta que su ficha
 *  se para. Es lo que dibuja su barra en la línea de tiempo. */
export function duracionDeCarril(carril, tiempos) {
  if (!carril || !carril.tramos.length) return 0;
  return Math.max(...carril.tramos.map((t) => (tiempos.tramos[t.id] || {}).fin_ms || 0));
}

/* ── Volver atrás y arrastrar a las siguientes (§6.5) ──── */

/**
 * Reancla los trazos de una fase a unas posiciones de entrada nuevas.
 *
 * Es el §5.5 aplicado a lo largo de un carril: cada trazo se estira
 * desde donde ahora está quien lo hace, y SU DESTINO SE QUEDA QUIETO,
 * porque el destino es una decisión del entrenador y el arranque es una
 * consecuencia de la fase anterior.
 *
 * EL ORIGEN LO PONE QUIEN ACTÚA, NO QUIEN VIAJA. En un pase el trazo
 * sale del pasador aunque lo recorra el balón, así que el arranque
 * sigue al pasador. Y por eso mismo, dentro de un carril, el trazo
 * siguiente solo arranca donde acabó el anterior SI la ficha lo
 * recorrió: después de pasar, el pasador se quedó donde estaba.
 *
 * Un tramo cuyo protagonista ya no está en la pista no se toca y se
 * marca `huerfano` (§6.5): borrarlo en silencio sería hacer desaparecer
 * trabajo del entrenador sin decirle nada.
 */
export function reanclarFase(fase, entrada = {}, pista = 'entera') {
  const carriles = ((fase && fase.carriles) || []).map((c) => {
    let pos = entrada[c.elemento];
    const tramos = c.tramos.map((t) => {
      if (!pos) return { ...t, huerfano: true };
      const trazo = reanclar(t.trazo, pos, pista);
      /* Solo avanza el cursor si esta ficha ha recorrido el trazo. */
      if (t.corre_id === c.elemento && trazo.length) {
        const fin = trazo[trazo.length - 1];
        pos = { x: fin.x, y: fin.y };
      }
      return { ...t, trazo, huerfano: false };
    });
    return { ...c, tramos };
  });
  return { ...fase, carriles };
}

/**
 * Recalcula una jugada entera desde una fase en adelante.
 *
 * Es lo que pasa al volver atrás y cambiar algo (§6.5): las posiciones
 * de arranque de las siguientes se recalculan y sus trazos se reanclan,
 * manteniendo sus destinos. Sin esto, corregir la fase 1 dejaba las
 * fases 2 y 3 dibujadas desde sitios donde ya no hay nadie.
 *
 * @param fases    todas, en orden
 * @param entrada  dónde está cada ficha al empezar la PRIMERA
 * @returns { fases, entradas, huerfanos }
 */
export function recalcular(fases, entrada = {}, pista = 'entera', { canasta = 'norte', canastaDe = null } = {}) {
  const salida = [];
  const entradas = [];
  const huerfanos = [];
  let actual = { ...entrada };
  (fases || []).forEach((f, i) => {
    entradas.push(actual);
    const reanclada = reanclarFase(f, actual, pista);
    for (const c of reanclada.carriles) {
      for (const t of c.tramos) if (t.huerfano) huerfanos.push({ fase: reanclada.id, tramo: t.id, elemento: c.elemento });
    }
    salida.push(reanclada);
    /* CADA FASE ATACA A SU ARO (§8.6): tras un robo o una canasta se
       ataca al contrario, y de eso depende dónde cae un tiro. */
    actual = posicionesFinales(reanclada, actual, { pista, canasta: (canastaDe && canastaDe(i)) || canasta });
  });
  return { fases: salida, entradas, huerfanos };
}

/* ── Dónde acaba cada ficha ────────────────────────────────── */

/**
 * Las posiciones al terminar la fase, que son las de arranque de la
 * siguiente (§6.4).
 *
 * Quien no se mueve en esta fase se queda donde estaba: por eso hay que
 * partir de las posiciones de entrada y no de los carriles, que solo
 * hablan de quien hace algo.
 */
export function posicionesFinales(fase, entrada = {}, { pista = null, canasta = 'norte' } = {}) {
  const salida = { ...entrada };
  /* EN EL ORDEN EN QUE OCURREN, no carril a carril. Un mismo balón pasa
     por varios carriles —lo pasa A1 y lo tira A2—, y recorriéndolos por
     carril ganaba el que venía después en la lista: si A2 tenía un corte
     dibujado antes del pase, su carril iba primero y el balón acababa en
     sus manos en vez de en el aro. `orden` es el orden en que se
     dibujaron, que es el orden en que pasan. */
  const tramos = ((fase && fase.carriles) || [])
    .flatMap((c) => c.tramos)
    .map((t, i) => ({ t, i }))
    .sort((a, z) => ((a.t.orden ?? a.i) - (z.t.orden ?? z.i)) || (a.i - z.i))
    .map((x) => x.t);
  for (const t of tramos) {
    if (!t.trazo || t.trazo.length < 2) continue;
    const fin = t.trazo[t.trazo.length - 1];
    /* Se mueve QUIEN RECORRE el trazo. En un pase eso es el balón, y
       el que pasa se queda donde estaba. */
    salida[t.corre_id || t.elemento_id] = { x: fin.x, y: fin.y };
    /* Un tiro deja el balón donde cae, no en el aro. Hace falta saber la
       pista y la canasta; sin ellas se queda en la punta del trazo, como
       antes. */
    if (esTiro(t) && pista) {
      const cae = trasElTiro({ pista, canasta, desde: t.trazo[0], desenlace: t.desenlace });
      if (cae) salida[t.corre_id] = cae;
    }
  }
  return salida;
}

/* De quién es cada balón al acabar una fase: vive en posesion.js, para
   que la defensa pueda contarlo sin cerrar un círculo de imports. Se
   reexporta desde aquí porque es donde lo busca todo el mundo. */
export { posesionAlFinal } from './posesion.js';

/* ---- La escena: poner y quitar (§2.2, §2.3) --------------------
   Añadir o quitar una ficha no es solo cambiar la lista de lo que hay
   en la pista. La jugada guarda, por cada fase, DÓNDE EMPIEZA cada
   ficha (`entrada`) y, en la primera, DE QUIÉN ES cada balón al empezar
   (`posesion`). Si esas dos cosas no cambian a la vez que la lista, una
   ficha recién puesta salta a ninguna parte al cambiar de fase, y una
   quitada sigue viva en la jugada que se guarda. */

/**
 * Los tramos, de cualquier fase, en los que sale una ficha: la que
 * actúa, la que recorre el trazo, la que recibe, el balón que se recoge
 * o el compañero al que se le pone un bloqueo. Sin este último, Supr se
 * llevaba al compañero y el bloqueo se quedaba apuntando a nadie.
 *
 * @returns [{ fase, tramo }] — `fase` es el índice
 */
/**
 * Dónde sale esta ficha en lo que hace la defensa (§8.5): o lo hace ella,
 * o se lo hacen a ella.
 *
 * Lo mira quien va a quitarla de la pista: un defensor no dibuja nada, y
 * sin esto se podía borrar al que ayuda —o a quien se ayuda— dejando la
 * fase apuntando a alguien que ya no está.
 */
export function declaradasConFicha(fases, id) {
  if (id == null) return [];
  const r = [];
  (fases || []).forEach((f, i) => {
    for (const [d, a] of Object.entries((f && f.defensa) || {})) {
      if (d === id || (a && a.objetivo_id === id)) r.push({ fase: i, defensor: d, accion: a && a.accion });
    }
  });
  return r;
}

export function tramosConFicha(fases, id) {
  if (id == null) return [];
  const r = [];
  (fases || []).forEach((f, i) => {
    for (const t of (f && f.tramos) || []) {
      if (!t) continue;
      if (t.elemento_id === id || t.corre_id === id || t.receptor_id === id || t.balon_id === id || t.companero_id === id) r.push({ fase: i, tramo: t });
    }
  });
  return r;
}

/**
 * ¿Sale este balón en algo dibujado? Mientras sí, quién lo tiene al
 * empezar no se cambia desde la pista: dárselo a otro dejaría pases de
 * alguien que no tiene el balón.
 */
export const balonEnJuego = (fases, id) => tramosConFicha(fases, id).length > 0;

/**
 * Una ficha nueva entra en la escena del PRINCIPIO: su sitio es su
 * arranque en la fase 1 y, si es un balón, se apunta de quién es al
 * empezar. Las fases siguientes no se tocan aquí: sus entradas se
 * deducen recalculando (`recalcular`), y quien no hace nada en una fase
 * sigue donde estaba.
 */
export function conFichaNueva(fases, ficha) {
  if (!ficha || ficha.id == null || !(fases || []).length) return fases;
  return fases.map((f, i) => {
    if (i !== 0) return f;
    const nueva = { ...f, entrada: { ...(f.entrada || {}), [ficha.id]: { x: ficha.x, y: ficha.y } } };
    if (ficha.kind === 'balon') nueva.posesion = { ...(f.posesion || {}), [ficha.id]: ficha.portador_id ?? null };
    return nueva;
  });
}

/**
 * Quita fichas de la escena de TODAS las fases. Un balón cuyo portador
 * se quita empieza la jugada suelto, que es lo mismo que hace `quitar`
 * en la pista: perder un balón sin decirlo sería peor.
 *
 * Los tramos no se tocan: quitar una ficha que tiene trazos es una
 * decisión que se toma antes, fuera de aquí (ver `tramosConFicha`).
 */
export function sinFichas(fases, ids) {
  const fuera = new Set(Array.isArray(ids) ? ids : [ids]);
  if (!fuera.size) return fases;
  return (fases || []).map((f) => {
    const entrada = Object.fromEntries(Object.entries(f.entrada || {}).filter(([id]) => !fuera.has(id)));
    /* Y lo que hiciera la defensa con quien se va (§8.5): sin esto, la
       fase se quedaba con una ayuda a alguien que ya no está. */
    const defensa = {};
    for (const [d, a] of Object.entries(f.defensa || {})) {
      if (fuera.has(d) || (a && a.objetivo_id && fuera.has(a.objetivo_id))) continue;
      defensa[d] = a;
    }
    if (!f.posesion) return { ...f, entrada, ...(f.defensa ? { defensa } : {}) };
    const posesion = {};
    for (const [balon, dueno] of Object.entries(f.posesion)) {
      if (fuera.has(balon)) continue;
      posesion[balon] = fuera.has(dueno) ? null : dueno;
    }
    return { ...f, entrada, posesion, ...(f.defensa ? { defensa } : {}) };
  });
}
