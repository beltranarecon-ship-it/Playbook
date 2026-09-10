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

   ── LO QUE FALTA, DECLARADO ─────────────────────────────────
   El §6.3 tiene un tercer arranque evidente: quien sale de un bloqueo
   espera a que el bloqueador haya llegado. No está aquí porque
   «bloquea» todavía no se dibuja —pide compañero, y eso es de la capa
   4—, así que no hay ningún dato del que sacar la dependencia. Se
   declara en `PENDIENTES` en vez de olvidarse.
   ============================================================ */

import { duracionDe, longitudMetros, reanclar } from './trazo.js';

/** Ningún tramo dura menos que esto: un movimiento de dos palmos
 *  seguiría siendo un movimiento, y con duración cero el motor tendría
 *  que dividir por cero para repartir el recorrido. */
export const MINIMO_TRAMO_MS = 120;

/** Los arranques del §6.3 que todavía no se pueden calcular, con su
 *  motivo. Verlos declarados enseña el plan; que falten sin más los
 *  convierte en un olvido. */
export const PENDIENTES = {
  bloqueo: 'quien sale de un bloqueo espera al bloqueador, pero «bloquea» '
    + 'pide compañero y eso todavía no se dibuja (capa 4)',
};

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

/* De qué tramo depende otro para poder arrancar.
   Se lee de lo que la capa 2 ya guarda —quién recibe un pase, qué
   balón recoge alguien— y no de una lista escrita a mano. */
function dependencias(carriles) {
  const espera = new Map();   // id de tramo -> id del tramo que tiene que acabar antes
  const todos = carriles.flatMap((c) => c.tramos);

  for (const p of todos) {
    /* UN PASE MANDA SOBRE EL SIGUIENTE MOVIMIENTO DEL RECEPTOR.
       El receptor no sale hasta que el balón llega; si ya se estaba
       moviendo cuando se lo pasan, ese tramo suyo empezó antes y no se
       toca — lo que espera es el PRIMERO que venga después. */
    if (p.receptor_id) {
      const suyos = (carriles.find((c) => c.elemento === p.receptor_id) || { tramos: [] }).tramos;
      const siguiente = suyos.find((t) => t.orden > p.orden);
      if (siguiente && !espera.has(siguiente.id)) espera.set(siguiente.id, p.id);
    }
    /* IR A POR UN BALÓN SUELTO ESPERA A QUE ESTÉ SUELTO. El tramo que
       lo soltó es el pase o el tiro anterior sobre ESE balón. */
    if (p.accion === 'recoge' && p.balon_id) {
      const suelta = todos.find((t) => t.corre_id === p.balon_id && t.orden < p.orden);
      if (suelta && !espera.has(p.id)) espera.set(p.id, suelta.id);
    }
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
 * TAL Y COMO ESTÁN LAS REGLAS HOY, NO PUEDE HABER CICLOS: las dos
 * dependencias apuntan siempre hacia atrás en el orden de dibujo —el
 * receptor espera a un pase ANTERIOR, y quien recoge espera a la suelta
 * ANTERIOR—, así que el grafo es acíclico por construcción y el banco lo
 * comprueba. El tope de pasadas y la rama de «nadie ha avanzado» se
 * quedan de todas formas: una regla nueva que mire hacia delante
 * colgaría la pizarra, y colgarse es mucho peor que arrancar pronto.
 */
export function tiemposDe(fase, { pista = 'entera' } = {}) {
  const carriles = (fase && fase.carriles) || [];
  const todos = carriles.flatMap((c) => c.tramos);
  const espera = dependencias(carriles);
  const avisos = [];

  const dur = new Map(todos.map((t) => [t.id, duracionDeTramo(t, pista)]));
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
      const esperado = espera.get(t.id);
      if ((previo && !fin.has(previo)) || (esperado && !fin.has(esperado))) { siguen.push(t); continue; }
      const desde = Math.max(
        previo ? fin.get(previo) : 0,
        esperado ? fin.get(esperado) : 0,
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
  const calculada = todos.length ? Math.max(...todos.map((t) => tramos[t.id].fin_ms)) : 0;
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
export function recalcular(fases, entrada = {}, pista = 'entera') {
  const salida = [];
  const entradas = [];
  const huerfanos = [];
  let actual = { ...entrada };
  for (const f of fases || []) {
    entradas.push(actual);
    const reanclada = reanclarFase(f, actual, pista);
    for (const c of reanclada.carriles) {
      for (const t of c.tramos) if (t.huerfano) huerfanos.push({ fase: reanclada.id, tramo: t.id, elemento: c.elemento });
    }
    salida.push(reanclada);
    actual = posicionesFinales(reanclada, actual);
  }
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
export function posicionesFinales(fase, entrada = {}) {
  const salida = { ...entrada };
  for (const c of (fase && fase.carriles) || []) {
    for (const t of c.tramos) {
      if (!t.trazo || t.trazo.length < 2) continue;
      const fin = t.trazo[t.trazo.length - 1];
      /* Se mueve QUIEN RECORRE el trazo. En un pase eso es el balón, y
         el que pasa se queda donde estaba. */
      salida[t.corre_id || t.elemento_id] = { x: fin.x, y: fin.y };
    }
  }
  return salida;
}
