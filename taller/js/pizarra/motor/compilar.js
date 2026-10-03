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
import { carrilesDesde, tiemposDe, esTiro, esBloqueo, TRAS_EL_TIRO_MS, recalcular } from '../fases.js';
import { trasElTiro, frenteDelBloqueo } from '../destino.js';
import { papelesDeJugada, seguirDefensa, SEGUIMIENTO } from './defensa.js';
import { metrosEntre } from '../../canvas/escala.js';
import { fraccionMasCercana, cortarTrazo } from '../trazo.js';
import { puertasDe } from '../conos.js';
import { metaDeFase } from '../../canvas/fotograma.js';
import { posicionesDe } from '../../canvas/anclas.js';
import { conRondas } from '../rondas-fila.js';
import { frasesDeJugada } from './frase.js';
import { tieneRamas, todosLosCaminos, grafoDe, cuantosCaminos, MAX_CAMINOS } from '../ramas.js';
import { varianteDe, variantePorDefecto } from '../repertorio.js';

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
  return tieneRamas(j.fases) ? compilarConRamas(j) : compilarCamino(j);
}

/**
 * UNA JUGADA CON RAMAS (§6.7, §11.2) se compila camino a camino: cada uno
 * es una jugada de las de siempre, así que los arranques, la defensa, la
 * posesión y la frase salen como en cualquier otra. Una reunión se
 * compila una vez por cada rama que llega a ella: sus trazos salen de
 * donde la deja esa rama.
 *
 *   · `fases`       el camino principal —la primera rama de cada cruce—,
 *                   que es lo que enseñan la miniatura, el guion y la
 *                   ficha (§6.7) sin saber nada de ramas;
 *   · `fases_rama`  lo de los demás caminos, desde donde se separan;
 *   · `ramas`       [{ desde, opciones: [{ nombre, fase }] }]: en qué
 *                   fase se para el proyector y qué ofrece;
 *   · `siguiente`   en cada fase, la que va detrás por su camino.
 *
 * Todos los caminos se reanclan, también el principal: la Pizarra guarda
 * cada reunión tal y como se vio la última vez, y por cada camino tiene
 * que salir de donde la deja la rama por la que se llega.
 */
function compilarConRamas(j) {
  const porId = new Map((j.fases || []).filter(Boolean).map((f) => [f.id, f]));
  const caminos = todosLosCaminos(j.fases);
  const opciones = {
    /* Quien espera en una fila y sale en alguna rama es un jugador en
       todas: en la que sale se le tiene que ver. */
    conTramosEn: j.fases,
    /* Un cruce se compila aunque esté vacío: es donde se para y pregunta. */
    mantener: new Set([...grafoDe(j.fases).despues].filter(([, sale]) => sale.length > 1).map(([id]) => id)),
  };
  /* Lo que deja la defensa en cada principio de camino, una vez. */
  const memo = new Map();
  const deCamino = (camino) => compilarCamino({ ...j, fases: reanclarCamino(j, camino.map((id) => porId.get(id)), memo) }, opciones);
  const principal = deCamino(caminos[0]);
  const warnings = new Set(principal.warnings);
  if (cuantosCaminos(j.fases) > caminos.length) warnings.add(`La jugada tiene más de ${MAX_CAMINOS} caminos distintos: solo se reproducen los ${MAX_CAMINOS} primeros.`);
  /* Los balones de todos los caminos: las rondas de una rama pueden traer
     los suyos. */
  const balones = new Map(principal.balones.map((b) => [b.id, b]));
  /* Lo compilado de cada prefijo de camino: { clave: fase compilada|null }. */
  const deClave = new Map();
  const clave = (camino, i) => camino.slice(0, i + 1).join('>');
  const apuntar = (camino, anim, sufijo = '') => {
    const porIndice = new Map(anim.fases.map((f) => [f.indice, f]));
    camino.forEach((_, i) => {
      if (deClave.has(clave(camino, i))) return;
      const f = porIndice.get(i) || null;
      deClave.set(clave(camino, i), f ? (sufijo ? { ...f, id: `${f.id}${sufijo}` } : f) : null);
    });
  };
  apuntar(caminos[0], principal);
  const cruces = new Map();   // id del cruce -> [{ nombre, fase }]
  const opcion = (desde, nombre, fase) => {
    const k = desde ?? '';
    if (!cruces.has(k)) cruces.set(k, []);
    if (!cruces.get(k).some((o) => o.nombre === nombre && o.fase === fase)) cruces.get(k).push({ nombre, fase });
  };
  const primeraDesde = (camino, i) => {
    for (let k = i; k < camino.length; k++) { const f = deClave.get(clave(camino, k)); if (f) return f.id; }
    return null;
  };
  const ultimaAntes = (camino, i) => {
    for (let k = i - 1; k >= 0; k--) { const f = deClave.get(clave(camino, k)); if (f) return f.id; }
    return null;
  };
  caminos.forEach((camino, n) => {
    if (n > 0) {
      /* Donde se separa de lo ya compilado empieza lo suyo. */
      let i = 0;
      while (i < camino.length && deClave.has(clave(camino, i))) i++;
      const anim = deCamino(camino);
      for (const w of anim.warnings) warnings.add(w);
      for (const b of anim.balones) if (!balones.has(b.id)) balones.set(b.id, b);
      apuntar(camino, anim, `@${n}`);
    }
  });
  /* Los cruces y sus opciones, con los nombres de las ramas. */
  caminos.forEach((camino) => {
    camino.forEach((id, i) => {
      if (i === 0) return;
      const f = porId.get(id);
      if (f.rama_de == null || f.rama_de !== camino[i - 1]) return;
      opcion(ultimaAntes(camino, i), f.rama_nombre || 'Rama', primeraDesde(camino, i));
    });
  });
  /* Cada fase compilada, una vez, con la que le sigue por su camino. */
  const todas = new Map();
  for (const camino of caminos) {
    const suyas = camino.map((_, i) => deClave.get(clave(camino, i))).filter(Boolean);
    suyas.forEach((f, k) => {
      if (todas.has(f.id)) return;
      todas.set(f.id, { ...f, siguiente: suyas[k + 1] ? suyas[k + 1].id : null });
    });
  }
  const fases = principal.fases.map((f) => todas.get(f.id));
  const enPrincipal = new Set(fases.map((f) => f.id));
  const ramas = [...cruces].map(([desde, opciones]) => ({ desde: desde || null, opciones }));
  return {
    ...principal,
    balones: [...balones.values()],
    fases,
    fases_rama: [...todas.values()].filter((f) => !enPrincipal.has(f.id)),
    ramas,
    warnings: [...warnings],
  };
}

/* CÓMO SE LLAMA UNA FICHA EN LA ANIMACIÓN. Quien espera en una fila no
   lleva dorsal (§7.1): si sale, se le nombra por su ficha para que no se
   llame igual que otro, y en la pista va sin número, como en la Pizarra. */
const sinNumero = (e) => e.kind === 'jugador' && e.fila_de && (e.label == null || e.label === '');
export function nombreEnLaAnimacion(e) {
  if (e.kind !== 'jugador') return e.id;
  return sinNumero(e) ? `${e.equipo || 'A'}_${e.id}` : `${e.equipo || 'A'}${e.label || '0'}`;
}

/**
 * DÓNDE DEJA A CADA DEFENSOR EL SEGUIMIENTO (§8.4) de la ÚLTIMA fase de
 * esta jugada (sin ramas), por ficha: { [id]: { x, y } }.
 *
 * Es la misma cuenta que reproduce el proyector —se compila y se mira
 * dónde acaba lo automático—, así que la Pizarra y la animación no
 * pueden decir dos cosas distintas.
 */
export function finDeLaDefensa(jugada) {
  const j = jugada || {};
  const fases = j.fases || [];
  const elementos = (j.elementos || []).filter(Boolean);
  /* Sin dos equipos en la pista no hay defensa que se mueva. */
  if (!fases.length || new Set(elementos.filter((e) => e.kind === 'jugador').map((e) => e.equipo || 'A')).size < 2) return {};
  let anim = null;
  try { anim = compilarCamino(j); } catch { return {}; }
  const fase = anim.fases.find((f) => f.indice === fases.length - 1);
  if (!fase) return {};
  const ficha = new Map(elementos.filter((e) => e.kind === 'jugador').map((e) => [nombreEnLaAnimacion(e), e.id]));
  const fin = {};
  for (const m of fase.movimientos || []) {
    if (!m.automatico || !Array.isArray(m.muestras) || m.muestras.length < 2) continue;
    const id = ficha.get(m.elemento_id);
    const u = m.muestras[m.muestras.length - 1];
    if (id) fin[id] = { x: u.x, y: u.y };
  }
  return fin;
}

/**
 * Lo que `recalcular` (fases.js) no puede saber solo: dónde acaba cada
 * fase quien se ha movido sin trazo. Devuelve su `alAcabar`, o `null` si
 * en esta jugada nadie defiende.
 *
 * @param jugada  la del camino que se recalcula; de ella se usa la escena
 *                del principio y lo que no son fases
 * @param memo    para no compilar dos veces el mismo principio de camino
 *                dentro de un mismo recálculo
 */
export function alAcabarConDefensa(jugada, memo = new Map()) {
  const j = jugada || {};
  const elementos = (j.elementos || []).filter(Boolean);
  if (new Set(elementos.filter((e) => e.kind === 'jugador').map((e) => e.equipo || 'A')).size < 2) return null;
  const plana = (f) => ({
    id: f.id, duracion_ms: f.duracion_ms ?? null, pausa_post_ms: f.pausa_post_ms ?? null, defensa: f.defensa || {},
    tramos: (f.carriles || []).flatMap((c) => c.tramos).sort((a, z) => a.orden - z.orden).map(({ orden, huerfano, ...t }) => t),
  });
  return (i, reancladas) => {
    const hasta = reancladas.slice(0, i + 1);
    const clave = hasta.map((f) => f.id).join('>');
    if (!memo.has(clave)) memo.set(clave, finDeLaDefensa({ ...j, elementos, fases: hasta.map(plana) }));
    return memo.get(clave);
  };
}

/* Por otro camino, cada uno sale de donde le deja lo anterior: los trazos
   de una reunión se dibujaron desde la primera rama, y se reanclan
   (§5.5) a donde deja esta, conservando su destino. */
function reanclarCamino(j, fases, memo) {
  const pista = j.pista || 'entera';
  const canasta = j.canasta || 'norte';
  const entrada = Object.fromEntries((j.elementos || []).filter(Boolean).map((e) => [e.id, { x: e.x, y: e.y }]));
  let papeles = null;
  try { papeles = papelesDeJugada({ ...j, pista, fases, elementos: (j.elementos || []).filter(Boolean) }); } catch { papeles = null; }
  const r = recalcular(fases.map((f) => ({ ...f, carriles: carrilesDesde((f && f.tramos) || []) })), entrada, pista, {
    canasta, canastaDe: (i) => ((papeles && papeles.fases[i]) || {}).canasta,
    alAcabar: alAcabarConDefensa({ ...j, pista, canasta }, memo),
  });
  return fases.map((f, i) => ({
    ...f,
    tramos: r.fases[i].carriles.flatMap((cc) => cc.tramos).sort((a, z) => a.orden - z.orden)
      .map(({ orden, huerfano, ...t }) => t),
  }));
}

/* Un camino: una jugada de las de siempre, fase tras fase.
   · `conTramosEn` las fases en las que mirar quién sale (con ramas, todas);
   · `mantener`    las fases que se compilan aunque estén vacías (los cruces). */
function compilarCamino(jugada, { conTramosEn = null, mantener = null } = {}) {
  const dibujada = jugada || {};
  const pista = dibujada.pista || 'entera';
  const canasta = dibujada.canasta || 'norte';
  const warnings = [];

  /* ── los papeles (§8.1) ── los mismos que ve la Pizarra, de lo dibujado */
  const papeles = papelesDeJugada({ ...dibujada, pista, elementos: (dibujada.elementos || []).filter(Boolean) });
  const defiendeAlEmpezar = new Set(papeles.inicio.defensores);

  /* ── las rondas (§7.4.2) ── los de la cola salen uno tras otro. Se
     deducen de lo dibujado con el primero, con la misma cuenta que
     enseña la Pizarra, y traen los balones del carro de quien pasa desde
     fuera. */
  const conLasRondas = conRondas(dibujada.fases || [], (dibujada.elementos || []).filter(Boolean), {
    pista, canasta, canastaDe: (i) => (papeles.fases[i] || {}).canasta,
  });
  warnings.push(...conLasRondas.avisos);
  const j = { ...dibujada, fases: conLasRondas.fases };
  const elementos = [...(dibujada.elementos || []).filter(Boolean), ...conLasRondas.balones];
  const repeticionDe = (id) => (conLasRondas.rondas[id] || {}).ronda || 0;
  /* ── la frase de cada fase (§9.1) ── de lo dibujado, sin las rondas:
     la voz y la ficha cuentan una. */
  let frases = [];
  try { frases = frasesDeJugada({ ...dibujada, pista, canasta }); } catch { frases = []; }
  const conRondasEn = new Set(Object.values(conLasRondas.rondas).map((r) => r.fila));

  /* ── los nombres ── */
  const nombre = new Map();
  for (const e of elementos) nombre.set(e.id, nombreEnLaAnimacion(e));
  const de = (id) => (id == null ? null : (nombre.get(id) ?? null));

  /* ── la escena ── */
  /* LOS QUE ESPERAN EN UNA FILA (§7.4.2) sin hacer nada en ninguna fase
     no son jugadores de la animación: son la cola que el motor pinta
     detrás de su cono. Tampoco sus balones, que van con ellos. */
  const conosFila = new Set(elementos.filter((e) => e.kind === 'cono' && e.fila).map((e) => e.id));
  const conTramos = new Set([...(j.fases || []), ...(conTramosEn || [])]
    .flatMap((f) => (f && Array.isArray(f.tramos) ? f.tramos : []))
    .flatMap((t) => (t ? [t.elemento_id, t.corre_id, t.receptor_id, t.companero_id] : []))
    .filter(Boolean));
  /* Una fila que sale por rondas no deja a nadie en la cola del motor:
     quien no sale espera en su sitio, como en la Pizarra. */
  const esperan = elementos.filter((e) => e.kind === 'jugador' && e.fila_de && conosFila.has(e.fila_de)
    && e.en_juego === false && !conTramos.has(e.id) && !conRondasEn.has(e.fila_de));
  const enLaCola = new Set(esperan.map((e) => e.id));
  const balonesDeLaCola = new Set(elementos.filter((e) => e.kind === 'balon' && enLaCola.has(e.portador_id)).map((e) => e.id));
  const conBalon = new Set(elementos.filter((e) => e.kind === 'balon' && e.portador_id).map((e) => e.portador_id));
  const jugadores = elementos.filter((e) => e.kind === 'jugador' && !enLaCola.has(e.id)).map((e) => ({
    id: de(e.id),
    equipo: e.equipo || 'A',
    /* El papel AL EMPEZAR. Es lo que miran la miniatura y el linter; al
       reproducir, el motor lo lee fase a fase (`defensores`). */
    tipo: defiendeAlEmpezar.has(e.id) ? 'defensor' : 'atacante',
    posicion_inicial: punto(e),
    tiene_balon: conBalon.has(e.id),
    dorsal: e.dorsal ?? (sinNumero(e) ? '' : null),
    nombre: e.nombre ?? null,
  }));
  const balones = elementos.filter((e) => e.kind === 'balon' && !balonesDeLaCola.has(e.id)).map((e) => ({
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
  /* LAS FILAS (§7.4.2): el motor pinta la cola de un cono de fila, así
     que los que ESPERAN y no hacen nada en ninguna fase no se compilan
     como jugadores, sino como la cola de su cono. Quien sale —o tiene
     algo dibujado— sí es un jugador. */
  const conosDeFila = conosFila;
  const conos = elementos.filter((e) => e.kind === 'cono').map((e) => ({
    id: e.id,
    posicion: punto(e),
    funcion: conosDeFila.has(e.id) ? 'fila'
      : puertas.has(e.id) ? 'puerta' : sorteados.has(e.id) ? 'rodear' : 'decorativo',
    fila_config: conosDeFila.has(e.id)
      ? { n_jugadores: esperan.filter((j) => j.fila_de === e.id).length, direccion_grados: e.fila.orientacion, equipo: e.fila.equipo }
      : null,
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
    .map((f, i) => (f && Array.isArray(f.tramos) && (f.tramos.length || (mantener && mantener.has(f.id)))
      /* La canasta es LA DE ESA FASE: si en la anterior robaron o
         anotaron, se ataca al otro aro (§8.6). */
      ? { ...compilarFase(f, i, { pista, canasta: (papeles.fases[i] || {}).canasta || canasta, de, nombre, warnings, papeles: papeles.fases[i], repeticionDe }),
        /* Lo que pasa, en palabras (§9): la automática —la que lee la voz—
           y la reescrita, que manda en la ficha. Y el hueco para un audio
           grabado más adelante (§9.3). */
        frase: frases[i] || '',
        texto: typeof f.texto === 'string' && f.texto.trim() ? f.texto.trim() : null,
        audio_url: null }
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
    /* LA DEFENSA NO PERSIGUE UN GESTO EN EL SITIO: quien finta o pivota no
       se va a ningún lado, y su defensor se queda con él. Siguiendo el
       amago, acababa la fase un metro más atrás y la siguiente arrancaba
       desde ahí. */
    const hayGestos = fase.movimientos.some((m) => m.tipo_movimiento === 'gesto_en_sitio');
    const paraDefender = hayGestos
      ? metaDeFase({ ...fase, movimientos: fase.movimientos.filter((m) => m.tipo_movimiento !== 'gesto_en_sitio') }, { jugadores, balones, escena, aro })
      : r;
    const seguida = seguirDefensa({
      /* Las puertas de la fase, por si algún defensor está sobre una
         (§7.4.1): queda confinado a su carril. */
      puertas: puertasDe(((j.fases || [])[fase.indice] || {}).tramos, elementos.filter((e) => e.kind === 'cono')),
      pista, canasta: papelesFase.canasta || canasta, defensa: j.defensa, papeles: comoFuera(papelesFase),
      jugadores, balones, reglas, meta: paraDefender.meta, inicio: escena,
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

  /* Cuántas rondas: la miniatura y el guion cuentan una (§7.4.2). */
  const rondas = 1 + Math.max(0, ...Object.values(conLasRondas.rondas).map((r) => r.ronda));
  return { motor: MOTOR_PIZARRA, pista, canasta, jugadores, balones, conos, materiales, fases, warnings, ...(rondas > 1 ? { rondas } : {}) };
}

function compilarFase(f, i, { pista, canasta, de, nombre, warnings, papeles = null, repeticionDe = () => 0 }) {
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
    /* Lo de una ronda que no es la primera va marcado: la miniatura y el
       guion enseñan una sola (§7.4.2). */
    const k = repeticionDe(t.id);
    const ronda = k ? { repeticion: k } : {};
    const cuando = { inicio_ms: m.inicio_ms, duracion_ms: m.duracion_ms, ...ronda };
    const modo = accion.parametros && accion.parametros.modo;

    if (!acciones.includes(t.accion)) acciones.push(t.accion);
    /* LA VARIANTE DE CADA TRAMO (§11.2), con su nombre: la columna del
       proyector lo titula así (§10.2), y una variante del club no la
       conoce quien no la ha cargado —por eso el tramo lleva el suyo—. Sin
       elegir, es la de siempre de esa acción, y se dice. */
    const deSiempre = t.variante ? null : variantePorDefecto(t.accion);
    const suya = t.variante
      ? { accion: t.accion, variante: t.variante, nombre: (varianteDe(t.accion, t.variante) || {}).nombre || t.variante_nombre || null }
      : deSiempre ? { accion: t.accion, variante: deSiempre.slug, nombre: deSiempre.nombre, de_siempre: true } : null;
    if (suya && !variantes.some((v) => v.accion === suya.accion && v.variante === suya.variante)) variantes.push(suya);

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
          ...ronda,
        });
        /* Y CUÁNDO es suyo: al llegarle a las manos. Sin el instante, el
           motor lo fechaba al final del último viaje del balón en la fase,
           y si después lo pasaba, el balón volvía a él. */
        recogidas.push({ jugador_id: de(t.elemento_id), balon_id: t.balon_id, t_ms: m.inicio_ms + m.duracion_ms, ...ronda });
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
          ...ronda,
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
        ...ronda,
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
      /* Qué gesto es: quien lo cuenta (el guion de Equipos) no puede
         deducirlo de un camino que vuelve a su sitio. */
      ...(accion.familia === 'gesto' ? { gesto: t.accion } : {}),
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
