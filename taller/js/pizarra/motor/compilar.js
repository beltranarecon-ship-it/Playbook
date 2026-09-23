/* ============================================================
   pizarra/motor/compilar.js — de la jugada a la animación (§11).

   Módulo PURO: sin DOM, sin canvas, sin red. Lo prueba en Node
   taller/tools/eval-compilar.mjs.

   ── LAS DOS COSAS QUE SE GUARDAN ────────────────────────────
   La JUGADA (§11.1) es lo que dibuja el entrenador: la escena al
   empezar, y por cada fase los tramos que hace cada ficha. Es lo que
   hay que reabrir para seguir editando.

   La ANIMACIÓN (§11.2) es lo que se reproduce: el JSON que ya leen hoy
   el proyector, las miniaturas, la ficha y el visor de Equipos. Este
   módulo es el paso de una a otra.

   ── EL FORMATO ES EL DE HOY, CON LO QUE AÑADE EL §11.2 ───────
   Se escribe exactamente lo que el motor ya entiende —movimientos,
   pases, recogidas, con sus caminos— y encima los añadidos del §11.2:
   `inicio_ms` y `duracion_ms` en cada movimiento y cada pase, y
   `variantes` junto a `acciones` en cada fase. El §11.2 lo deja dicho:
   «el resto de consumidores solo necesita ignorar lo que no entienda».

   Eso tiene una consecuencia que vale mucho: una jugada compilada aquí
   se reproduce ya en el proyector y sale ya en la miniatura, antes de
   que `engine.js` sepa nada de carriles. Sin los arranques todo se
   estira a lo largo de la fase, como hoy; con ellos, cada uno sale
   cuando le toca. Nada se rompe por el camino.

   ── LOS NOMBRES SON LOS DE SIEMPRE ──────────────────────────
   Dentro de la Pizarra un jugador es `jugador_7`, pero en la animación
   es `A1`: el motor saca el número que pinta del propio nombre cuando
   no hay dorsal, así que con el id interno el proyector pintaría un 7
   donde el entrenador ve un 1. Es la misma convención que ya usa
   `animacionDesdeBoard` al guardar sin fases.

   ── LO QUE TODAVÍA NO SE COMPILA, DECLARADO ─────────────────
   La defensa, las filas, las puertas y las zonas no los produce aún la
   Pizarra (capas 5-6). Si llegara alguno, no se inventa: sale un aviso
   en `warnings` y se sigue con lo demás.
   ============================================================ */

import { CATALOGO_SISTEMA } from '../../ia/acciones.js';
import { MOTOR_PIZARRA } from './marca.js';
import { carrilesDesde, tiemposDe, esTiro, esBloqueo, TRAS_EL_TIRO_MS } from '../fases.js';
import { trasElTiro, frenteDelBloqueo } from '../destino.js';
import { papelesDeJugada, seguirDefensa, SEGUIMIENTO } from './defensa.js';
import { metrosEntre } from '../../canvas/escala.js';
import { fraccionMasCercana, cortarTrazo } from '../trazo.js';
import { metaDeFase } from '../../canvas/fotograma.js';
import { posicionesDe } from '../../canvas/anclas.js';

export const VERSION_JUGADA = 3;

/** La pausa al final de cada fase, antes de la siguiente. Es la que
 *  usaba el compilador anterior para un movimiento: lo justo para que
 *  el ojo registre dónde ha quedado cada uno. */
export const PAUSA_POR_DEFECTO_MS = 400;

/** Qué parte del último tramo de quien recoge ocupa el balón en llegar
 *  a sus manos. Si no viajara, saltaría del suelo a la mano en un
 *  fotograma; si viajara todo el tramo, iría flotando delante de él. */
export const RECOGIDA_FRACCION = 0.25;

/* ¿La ha compilado la Pizarra? Vive en marca.js, que no depende de nada,
   para que quien solo necesita saber esto (la ficha, Equipos, la
   biblioteca) no cargue el compilador. Se reexporta aquí porque es de
   aquí de donde sale la marca. */
export { esDeLaPizarra } from './marca.js';

const porSlug = new Map(CATALOGO_SISTEMA.map((a) => [a.slug, a]));
const punto = (p) => [p.x, p.y];

/**
 * @param jugada { version, pista, canasta, elementos, fases }
 *   elementos: la escena AL EMPEZAR la fase 1, con quién tiene cada
 *              balón en ese momento
 *   fases:     [{ id, duracion_ms, pausa_post_ms, tramos, defensa }]
 * @returns la animación en el formato del §10, más lo del §11.2
 */
export function compilar(jugada) {
  const j = jugada || {};
  const pista = j.pista || 'entera';
  const canasta = j.canasta || 'norte';
  const elementos = (j.elementos || []).filter(Boolean);
  const warnings = [];

  /* ── los nombres ── */
  const nombre = new Map();
  for (const e of elementos) {
    nombre.set(e.id, e.kind === 'jugador' ? `${e.equipo || 'A'}${e.label || '0'}` : e.id);
  }
  const de = (id) => (id == null ? null : (nombre.get(id) ?? null));

  /* ── los papeles (§8.1) ── los mismos que ve la Pizarra */
  const papeles = papelesDeJugada({ ...j, pista, elementos });
  const defiendeAlEmpezar = new Set(papeles.inicio.defensores);

  /* ── la escena ── */
  const conBalon = new Set(elementos.filter((e) => e.kind === 'balon' && e.portador_id).map((e) => e.portador_id));
  const jugadores = elementos.filter((e) => e.kind === 'jugador').map((e) => ({
    id: de(e.id),
    equipo: e.equipo || 'A',
    /* El papel AL EMPEZAR. Es lo que miran la miniatura y el linter; al
       reproducir, el motor lo lee fase a fase (`defensores`). */
    tipo: defiendeAlEmpezar.has(e.id) ? 'defensor' : 'atacante',
    posicion_inicial: punto(e),
    tiene_balon: conBalon.has(e.id),
    dorsal: e.dorsal ?? null,
    nombre: e.nombre ?? null,
  }));
  const balones = elementos.filter((e) => e.kind === 'balon').map((e) => ({
    id: e.id,
    posicion_inicial: punto(e),
    portador_id: de(e.portador_id),
  }));
  /* Los conos QUE SE SORTEAN (§7.4): los que algún tramo nombra en su
     `sorteando`. Los demás son decoración: están en la pista, ocupan
     sitio y salen en el material, pero nadie los rodea. */
  const sorteados = new Set();
  const puertas = new Set();
  for (const f of j.fases || []) {
    for (const t of (f && f.tramos) || []) {
      for (const x of (t && t.sorteando) || []) {
        /* Lo anulado no se sortea. Las puertas no se rodean: se pasa por
           dentro, y sus palos salen como tales (§7.4.1). */
        if (!x || !x.cono || x.anulado) continue;
        if (x.tipo === 'puerta') for (const id of x.puerta || []) puertas.add(id);
        else sorteados.add(x.cono);
      }
    }
  }
  const conos = elementos.filter((e) => e.kind === 'cono').map((e) => ({
    id: e.id,
    posicion: punto(e),
    /* Las filas llegan en el paso 6.5. */
    funcion: puertas.has(e.id) ? 'puerta' : sorteados.has(e.id) ? 'rodear' : 'decorativo',
    fila_config: null,
  }));
  const materiales = elementos
    .filter((e) => e.kind === 'escalera' || e.kind === 'pelota')
    .map((e) => (e.kind === 'escalera'
      ? { id: e.id, tipo: 'escalera', posicion: punto(e), rot: e.rot ?? 0 }
      : { id: e.id, tipo: 'pelota', posicion: punto(e) }));
  if (elementos.some((e) => e.kind === 'zona')) {
    warnings.push('Las zonas todavía no se compilan (capa 6): se guardan en la jugada pero no salen en la animación.');
  }

  /* ── las fases ──
     Una fase sin nada dibujado no se compila: no hay nada que ver, y el
     motor la reproduciría como una pausa muda en cada vuelta. La que abre
     «Siguiente fase» está vacía hasta que se dibuja en ella, así que casi
     toda jugada acaba con una. En la jugada sí se queda: es donde se
     edita. El índice es el de la jugada, para que los avisos digan la
     fase que ve el entrenador. */
  const fases = (j.fases || [])
    .map((f, i) => (f && Array.isArray(f.tramos) && f.tramos.length
      /* La canasta es LA DE ESA FASE: si en la anterior robaron o
         anotaron, se ataca al otro aro (§8.6). */
      ? compilarFase(f, i, { pista, canasta: (papeles.fases[i] || {}).canasta || canasta, de, nombre, warnings, papeles: papeles.fases[i] })
      : null))
    .filter(Boolean);

  /* ── la defensa que se mueve sola (§8.4) ──
     Se calcula DESPUÉS del ataque y con el mismo fotograma que reproduce
     el motor, fase a fase: cada defensor sale de donde le dejó la fase
     anterior y sigue a su par por donde se le ve. */
  const aro = (cual) => {
    const pos = posicionesDe(pista, cual === 'sur' ? 'sur' : 'norte');
    return pos && pos.aro ? { x: pos.aro[0], y: pos.aro[1] } : { x: 0.5, y: 0.1 };
  };
  const reglas = Object.fromEntries(elementos
    .filter((e) => e.kind === 'jugador')
    .map((e) => [de(e.id), e.regla_defensa || null]));
  const comoFuera = (p) => ({
    ataca: p.ataca,
    atacantes: (p.atacantes || []).map(de).filter(Boolean),
    defensores: (p.defensores || []).map(de).filter(Boolean),
    pares: Object.fromEntries(Object.entries(p.pares || {}).map(([d, a]) => [de(d), a ? de(a) : null]).filter(([d]) => d)),
    situacion: p.situacion,
    retrasa: p.retrasa ? de(p.retrasa) : null,
    /* Y lo que cada defensor hace distinto en esa fase (§8.5), con los
       nombres de la animación: sin esto, la defensa del proyector no
       haría lo que el entrenador ha dicho. */
    acciones: Object.fromEntries(Object.entries(p.acciones || {})
      .map(([d, a]) => [de(d), { accion: a.accion, objetivo_id: a.objetivo_id ? de(a.objetivo_id) : null }])
      .filter(([d]) => d)),
  });
  let escena = {
    P: Object.fromEntries(jugadores.map((x) => [x.id, { x: x.posicion_inicial[0], y: x.posicion_inicial[1] }])),
    B: Object.fromEntries(balones.map((x) => [x.id, { x: x.posicion_inicial[0], y: x.posicion_inicial[1] }])),
    owner: Object.fromEntries(balones.map((x) => [x.id, x.portador_id || null])),
  };
  for (const fase of fases) {
    const papelesFase = papeles.fases[fase.indice] || papeles.inicio;
    /* Lo que algún defensor hace distinto en esta fase (§8.5), con los
       nombres de la animación: lo lee el guion de Equipos, que si no
       contaría «ajusta el marcaje» de una ayuda. */
    const declaradas = comoFuera(papelesFase).acciones;
    if (Object.keys(declaradas).length) fase.defensa = declaradas;

    /* UN ROBO (§8.6) cambia el balón de manos A MITAD DE FASE, y de las
       dos maneras que dijo el entrenador —de las dos sale lo mismo: que
       el balón acaba en manos del que roba—:

         · si al señalado le llega un PASE en esta fase, es una
           INTERCEPCIÓN: el pase se corta donde se cruza el que roba y el
           balón es suyo al llegar ahí;
         · si lo lleva ÉL, es un robo en el bote: el que roba tarda en
           llegar lo que tarde en recorrer la distancia a su velocidad
           (§8.4), y desde ese instante el balón va con él.

       Va ANTES de montar la fase porque lo que cambia es de quién es el
       balón y por dónde viaja, que es justo lo que monta `metaDeFase`. */
    for (const [quien, a] of Object.entries(declaradas)) {
      if (!a || a.accion !== 'roba' || !a.objetivo_id) continue;
      const desde = escena.P[quien];
      const pase = (fase.pases || []).find((p) => p && p.a_id === a.objetivo_id);
      if (pase) {
        const u = Math.max(0.2, Math.min(0.9, fraccionMasCercana(pase.path, desde || pase.path[0], pista)));
        pase.path = cortarTrazo(pase.path, u, pista);
        pase.duracion_ms = Math.max(1, Math.round((pase.duracion_ms || 0) * u));
        pase.a_id = quien;
        pase.interceptado = true;
        continue;
      }
      const suyos = balones.filter((b) => escena.owner[b.id] === a.objetivo_id);
      if (!suyos.length) {
        warnings.push(`Fase ${fase.indice + 1}: ${quien} roba a ${a.objetivo_id}, que en esa fase no tiene balón.`);
        continue;
      }
      for (const b of suyos) {
        const donde = escena.B[b.id] || desde;
        const metros = desde && donde ? metrosEntre(pista, desde, donde) : 0;
        const t = Math.max(0, Math.min(fase.duracion_ms, (metros / SEGUIMIENTO.velocidad) * 1000));
        (fase.recogidas || (fase.recogidas = [])).push({ jugador_id: quien, balon_id: b.id, t_ms: Math.round(t), robo: true });
      }
    }

    const r = metaDeFase(fase, { jugadores, balones, escena, aro });
    const seguida = seguirDefensa({
      pista, canasta: papelesFase.canasta || canasta, defensa: j.defensa, papeles: comoFuera(papelesFase),
      jugadores, balones, reglas, meta: r.meta, inicio: escena,
      duracion_ms: fase.duracion_ms, tiros: fase.tiros,
    });
    for (const [id, s] of Object.entries(seguida)) {
      fase.movimientos.push({
        elemento_id: id,
        tipo_elemento: 'jugador',
        tipo_movimiento: 'defensa',
        /* Automático: el motor no le dibuja flecha (§8.4), y la frase de
           Equipos lo cuenta aparte. */
        automatico: true,
        muestras: s.muestras,
        inicio_ms: 0,
        duracion_ms: fase.duracion_ms,
      });
    }
    escena = r.escena;
    for (const [id, s] of Object.entries(seguida)) escena.P[id] = { ...s.fin };
  }

  return { motor: MOTOR_PIZARRA, pista, canasta, jugadores, balones, conos, materiales, fases, warnings };
}

function compilarFase(f, i, { pista, canasta, de, nombre, warnings, papeles = null }) {
  const tramos = (f && f.tramos) || [];
  const fase = { ...(f || {}), carriles: carrilesDesde(tramos) };
  const tiempos = tiemposDe(fase, { pista });

  const movimientos = [];
  const pases = [];
  const bloqueos = [];
  const tiros = [];
  const recogidas = [];
  const acciones = [];
  const variantes = [];

  /* En el ORDEN EN QUE SE DIBUJARON, que es el orden en que ocurren: el
     motor procesa los cambios de dueño del balón en ese orden, y un
     pase y su contrapase en la misma fase tienen que salir así. */
  for (const t of tramos) {
    if (!t) continue;
    if (!nombre.has(t.elemento_id)) {
      warnings.push(`Fase ${i + 1}: un tramo de «${t.accion}» se ha quedado sin protagonista y no se compila.`);
      continue;
    }
    const accion = porSlug.get(t.accion);
    if (!accion) {
      warnings.push(`Fase ${i + 1}: «${t.accion}» no está en el catálogo y no se compila.`);
      continue;
    }
    const m = tiempos.tramos[t.id] || { inicio_ms: 0, duracion_ms: 0 };
    const cuando = { inicio_ms: m.inicio_ms, duracion_ms: m.duracion_ms };
    const modo = accion.parametros && accion.parametros.modo;

    if (!acciones.includes(t.accion)) acciones.push(t.accion);
    if (t.variante && !variantes.some((v) => v.accion === t.accion && v.variante === t.variante)) {
      variantes.push({ accion: t.accion, variante: t.variante });
    }

    if (accion.familia === 'balon' && modo === 'pase') {
      /* El que pasa no se mueve: lo que viaja es el balón. */
      pases.push({
        id: t.id,
        de_id: de(t.elemento_id),
        balon_id: t.corre_id,
        a_id: de(t.receptor_id),
        path: t.trazo,
        ...cuando,
      });
      continue;
    }

    if (accion.familia === 'balon' && modo === 'recoge') {
      /* Va el jugador a por el balón y, al llegar, se lo queda. El
         balón hace el último trozo hasta sus manos, en el último cuarto
         de la carrera: si no, saltaría del suelo a la mano. */
      movimientos.push({
        elemento_id: de(t.elemento_id),
        tipo_elemento: 'jugador',
        tipo_movimiento: accion.simbolo,
        path: t.trazo,
        ...cuando,
      });
      if (t.balon_id) {
        const fin = t.trazo[t.trazo.length - 1];
        /* De donde estaba el balón suelto a donde acaba el jugador. Ese
           sitio lo apunta el Tablero al dibujar el tramo, que es el único
           momento en que se sabe seguro. Sin él no se inventa de dónde
           venía: el camino queda en las manos del jugador, y el motor
           resuelve un camino de longitud cero como quedarse quieto. */
        const desde = t.balon_desde || fin;
        movimientos.push({
          elemento_id: t.balon_id,
          tipo_elemento: 'balon',
          tipo_movimiento: 'recogida',
          path: [{ x: desde.x, y: desde.y, tipo_nodo: 'lineal' }, { x: fin.x, y: fin.y, tipo_nodo: 'lineal' }],
          inicio_ms: m.inicio_ms + m.duracion_ms * (1 - RECOGIDA_FRACCION),
          duracion_ms: m.duracion_ms * RECOGIDA_FRACCION,
        });
        /* Y CUÁNDO es suyo: al llegarle a las manos. Sin el instante, el
           motor lo fechaba al final del último viaje del balón en la fase,
           y si después lo pasaba, el balón volvía a él. */
        recogidas.push({ jugador_id: de(t.elemento_id), balon_id: t.balon_id, t_ms: m.inicio_ms + m.duracion_ms });
      }
      continue;
    }

    if (accion.familia === 'balon' && modo === 'tiro') {
      /* El tiro, con su trazo hasta el aro —que es lo que miden el motor y
         el linter—, y lo que hace el balón DESPUÉS como un viaje aparte:
         rebota o cae bajo el aro, y queda suelto (§4.4). Así el tiro sigue
         acabando en el aro para quien lo lea. */
      const desenlace = esTiro(t) ? t.desenlace : 'entra';
      tiros.push({
        id: t.id,
        jugador_id: de(t.elemento_id),
        balon_id: t.corre_id,
        canasta,
        desenlace,
        path: t.trazo,
        ...cuando,
      });
      const fin = t.trazo[t.trazo.length - 1];
      const cae = trasElTiro({ pista, canasta, desde: t.trazo[0], desenlace });
      if (cae) {
        movimientos.push({
          elemento_id: t.corre_id,
          tipo_elemento: 'balon',
          tipo_movimiento: desenlace === 'falla' ? 'rebote' : 'caida',
          path: [{ x: fin.x, y: fin.y, tipo_nodo: 'lineal' }, { x: cae.x, y: cae.y, tipo_nodo: 'lineal' }],
          inicio_ms: m.inicio_ms + m.duracion_ms,
          duracion_ms: TRAS_EL_TIRO_MS,
        });
      }
      continue;
    }
    if (esBloqueo(t)) {
      /* El bloqueador va a su sitio —un movimiento como otro cualquiera— y
         al llegar SE PLANTA: eso es el bloqueo, con su instante. Aguanta
         hasta que vuelve a moverse o hasta que acaba la fase.
         `bloqueado_id` es el COMPAÑERO al que se le pone, que es lo que ya
         narra Equipos («el 5 bloquea para el 1»); `hacia`, el frente con
         el que llega, para que la barra mire a su defensor. */
      movimientos.push({
        elemento_id: de(t.elemento_id),
        tipo_elemento: 'jugador',
        tipo_movimiento: 'bloqueo',
        path: t.trazo,
        ...cuando,
      });
      const companero = de(t.companero_id);
      if (!companero) {
        warnings.push(`Fase ${i + 1}: un bloqueo se ha quedado sin compañero: sale el desplazamiento, sin la barra.`);
        continue;
      }
      const llega = m.inicio_ms + m.duracion_ms;
      const suyos = (fase.carriles.find((c) => c.elemento === t.elemento_id) || { tramos: [] }).tramos;
      const despues = suyos[suyos.findIndex((x) => x.id === t.id) + 1];
      const hasta = despues && tiempos.tramos[despues.id] ? tiempos.tramos[despues.id].inicio_ms : tiempos.duracion_ms;
      const frente = frenteDelBloqueo(t.trazo);
      /* A quién se le pone, si se sabe: el motor le mira A ÉL, esté
         donde esté en ese instante, en vez de a un punto fijo. */
      const defensor = de(t.defensor_id);
      bloqueos.push({
        id: t.id,
        bloqueador_id: de(t.elemento_id),
        bloqueado_id: companero,
        ...(defensor ? { defensor_id: defensor } : {}),
        ...(frente ? { hacia: [frente.x, frente.y] } : {}),
        inicio_ms: llega,
        duracion_ms: Math.max(0, hasta - llega),
      });
      continue;
    }
    if (accion.familia === 'entre_dos') {
      warnings.push(`Fase ${i + 1}: «${accion.nombre}» es entre dos fichas y todavía no se compila.`);
      continue;
    }

    movimientos.push({
      elemento_id: de(t.corre_id || t.elemento_id),
      tipo_elemento: 'jugador',
      tipo_movimiento: accion.simbolo,
      path: t.trazo,
      ...cuando,
    });
  }

  return {
    id: (f && f.id) || `fase_${i + 1}`,
    /* Qué fase de la jugada es: las vacías no se compilan, así que el
       índice de la animación no vale para volver. */
    indice: i,
    duracion_ms: Math.max(1, tiempos.duracion_ms || 0),
    pausa_post_ms: Number.isFinite(f && f.pausa_post_ms) ? f.pausa_post_ms : PAUSA_POR_DEFECTO_MS,
    movimientos,
    pases,
    bloqueos,
    tiros,
    recogidas,
    /* Quién defiende en esta fase, en TODAS: con que una fase lo diga, el
       motor deja de mirar el `tipo` del jugador y lee esto. */
    defensores: ((papeles && papeles.defensores) || []).map(de).filter(Boolean),
    acciones,
    variantes,
  };
}
