/* ============================================================
   pizarra/motor/frase.js — la frase automática de cada fase (§9.1).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-frase.mjs.

   ── SALIDA, NO ENTRADA ──────────────────────────────────────
   La frase se escribe A PARTIR de lo dibujado; nunca al revés. Es lo
   que la Pizarra enseña debajo de cada fase, lo que lee la voz (§9.3) y
   el desarrollo que se lleva al paso 3 (§9.4). Sale siempre igual para
   la misma jugada: sin modelos, sin red, sin coste.

   ── CÓMO SE REDACTA (§9.1) ──────────────────────────────────
     · el sujeto, por su dorsal (A1, B2); quien espera en una fila, por
       su puesto («el 2.º de la fila»);
     · el verbo de la acción, con su variante técnica si se ha elegido
       («pasa picado», «bota con cambio de mano»);
     · el destino por su nombre: una zona de la pista («el codo
       derecho»), un cono («el cono 2») u otro jugador;
     · lo que hace cada uno va seguido y unido con «y», en el orden en que
       empieza; y quien recibe un pase después de cortar se cuenta en el
       mismo pase: «pasa a A2, que ha cortado a la esquina»;
     · la defensa, al final y en una oración aparte: primero lo que ha
       dicho el entrenador (§8.5) y luego lo que hace sola cada uno,
       según su regla.
   ============================================================ */

import { CATALOGO_SISTEMA } from '../../ia/acciones.js';
import { carrilesDesde, tiemposDe, recalcular, esTiro } from '../fases.js';
import { posesionAlFinal } from '../posesion.js';
import { papelesDeJugada, colocar } from './defensa.js';
import { zonaDe, aroExacto } from '../../canvas/anclas.js';
import { metrosEntre } from '../../canvas/escala.js';
import { numeroDe } from '../elementos.js';
import { conRondas } from '../rondas-fila.js';

const porSlug = new Map(CATALOGO_SISTEMA.map((a) => [a.slug, a]));

/**
 * CÓMO SE DICE CADA VARIANTE dentro de la frase. Una por cada una del
 * catálogo (`VARIANTES` de repertorio.js); el banco comprueba que no falte ninguna. La
 * que va vacía es la de toda la vida y no se nombra.
 */
export const COMO_SE_DICE = Object.freeze({
  pasa: { recto: '', picado: ' picado', pecho: ' de pecho', beisbol: ' de béisbol', bombeado: ' bombeado', mano_a_mano: ' en mano' },
  bota: {
    normal: '', cambio_mano: ' con cambio de mano', espalda: ' con cambio por la espalda',
    piernas: ' con cambio entre las piernas', reverso: ' con reverso', protegido: ' protegiendo el balón',
  },
  tira: { suspension: ' en suspensión', tras_bote: ' tras bote', tras_recepcion: ' tras recepción', gancho: ' de gancho', palmeo: '' },
  entra: { doble_ritmo: ' en doble ritmo', bandeja: ' en bandeja', reverso: ' con reverso', eurostep: ' con eurostep', bomba: ' con una bomba' },
  corta: { recto: '', puerta_atras: ' por la puerta atrás', en_v: ' en V', en_l: ' en L', rizo: ' con un rizo' },
  bloquea: { directo: ' directo', indirecto: ' indirecto', ciego: ' ciego', mano_a_mano: '' },
});

/* A menos de esto del aro, un tiro no se «tira desde» ningún sitio: es
   una finalización (lo mismo que el guion de Equipos). */
const METROS_JUNTO_AL_ARO = 1.6;
/* A menos de esto de un cono, el destino es ese cono. */
const METROS_AL_CONO = 1.2;

/** «a» + «el codo» es «al codo»; «de» + «el aro», «del aro». */
const contraer = (prep, sn) => (sn.startsWith('el ') ? `${prep === 'a' ? 'al' : 'del'} ${sn.slice(3)}` : `${prep} ${sn}`);
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** «a, b y c». */
export function unir(lista) {
  const l = (lista || []).filter(Boolean);
  if (l.length < 2) return l[0] || '';
  return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}

/** Cómo se nombra a una ficha en la frase. */
export function nombreEnFrase(e) {
  if (!e) return 'otro jugador';
  if (e.kind === 'jugador') {
    const n = numeroDe(e);
    if ((n === '' || n == null) && e.fila_de) return `el ${(e.puesto ?? 0) + 1}.º de la fila`;
    return `${e.equipo || 'A'}${n ?? ''}`;
  }
  if (e.kind === 'cono') {
    if (e.nombre) return e.nombre;
    const n = /(\d+)$/.exec(String(e.id));
    return n ? `el cono ${n[1]}` : 'el cono';
  }
  return e.nombre || 'eso';
}

const variante = (t) => ((COMO_SE_DICE[t.accion] || {})[t.variante] ?? '');

/* Una fase o un tramo roto no deja sin frase a toda la jugada. */
const sano = (f) => (f && typeof f === 'object' ? { ...f, tramos: (Array.isArray(f.tramos) ? f.tramos : []).filter((t) => t && t.id != null) } : { tramos: [] });

/**
 * LAS FRASES DE TODAS LAS FASES de una jugada (§11.1), en orden. Una fase
 * sin nada dibujado da '' —la que abre «Siguiente fase» y el compilador
 * no compila—: no hay nada que contar, ni de la defensa.
 */
export function frasesDeJugada(jugada) {
  const j = jugada || {};
  const pista = j.pista || 'entera';
  const fases = (j.fases || []).map(sano);
  const elementos = (j.elementos || []).filter(Boolean);
  if (!fases.length) return [];
  const porId = new Map(elementos.map((e) => [e.id, e]));
  const papeles = papelesDeJugada({ ...j, fases, pista, elementos });
  const canastaDe = (i) => (papeles.fases[i] || {}).canasta || j.canasta || 'norte';
  /* Dónde está cada uno al EMPEZAR cada fase, y de quién es cada balón:
     lo necesita la defensa, que se cuenta según su regla. */
  const entrada = Object.fromEntries(elementos.map((e) => [e.id, { x: e.x, y: e.y }]));
  const { entradas } = recalcular(fases.map((f) => ({ ...f, carriles: carrilesDesde(f.tramos) })), entrada, pista, {
    canasta: j.canasta || 'norte', canastaDe,
  });
  const inicial = Object.fromEntries(elementos.filter((e) => e.kind === 'balon').map((e) => [e.id, e.portador_id ?? null]));
  /* Las rondas de las filas (§7.4.2): se cuentan en una línea, no ronda
     a ronda. Los que repiten son los DE LA COLA: el que pasa desde fuera
     también tiene copias, pero no sale de ninguna fila. */
  const rondas = conRondas(fases, elementos, { pista, canasta: j.canasta || 'norte', canastaDe });
  const repitenEn = (i) => {
    const suyos = new Set((rondas.fases[i].tramos || [])
      .filter((t) => rondas.rondas[t.id])
      .map((t) => t.elemento_id)
      .filter((id) => (porId.get(id) || {}).fila_de));
    const filas = new Set([...suyos].map((id) => porId.get(id).fila_de));
    return { n: suyos.size, filas: filas.size };
  };

  return fases.map((f, i) => {
    if (!f.tramos.some((t) => porId.has(t.elemento_id))) return '';
    const ataque = fraseDelAtaque(f, i, { fases, porId, pista, canasta: canastaDe(i) });
    const { n, filas } = repitenEn(i);
    const rondaTexto = n
      ? `Detrás, lo repite${n > 1 ? 'n' : ''} uno a uno ${n > 1 ? `los otros ${n}` : 'el otro'} de ${filas > 1 ? 'las filas' : 'la fila'}.`
      : '';
    const enLaFase = Object.fromEntries(elementos.map((e) => [e.id, { ...e, ...(entradas[i] || {})[e.id] }]));
    const duenos = i > 0 ? posesionAlFinal(fases, i - 1, inicial) : inicial;
    const escena = Object.values(enLaFase).map((e) => (e.kind === 'balon' ? { ...e, portador_id: duenos[e.id] ?? null } : e));
    const defensa = fraseDeLaDefensa(f, papeles.fases[i], { escena, porId, pista, canasta: canastaDe(i), defensaDelEjercicio: j.defensa });
    /* La defensa, al final (§9.1). */
    return [ataque, rondaTexto, defensa].filter(Boolean).join(' ');
  });
}

/** La frase de UNA fase. */
export function fraseDeFase(jugada, i) {
  return frasesDeJugada(jugada)[i] || '';
}

/* ── El ataque ──────────────────────────────────────────────── */

/* A menos de esto de un cono, se ha ido AL cono aunque caiga en una zona:
   el trazo acaba imantado en él. */
const METROS_EN_EL_CONO = 0.6;

/**
 * Lo que pasa, EN EL ORDEN EN QUE PASA. Lo seguido de un mismo jugador
 * va en una oración («A1 bota hasta el codo y pasa a A2»); cuando actúa
 * otro, empieza otra. Así un «dame y va» se cuenta como ocurre: A1 pasa
 * a A2; A2 se lo devuelve; A1 tira.
 */
function fraseDelAtaque(f, i, { fases, porId, pista, canasta }) {
  const tramos = f.tramos.filter((t) => porId.has(t.elemento_id));
  if (!tramos.length) return '';
  const tiempos = tiemposDe({ ...f, carriles: carrilesDesde(tramos) }, { pista });
  const cuando = (t) => (tiempos.tramos[t.id] || {}).inicio_ms ?? 0;
  const acaba = (t) => (tiempos.tramos[t.id] || {}).fin_ms ?? 0;
  const orden = new Map(tramos.map((t, k) => [t.id, k]));
  const antes = (a, z) => cuando(a) - cuando(z) || orden.get(a.id) - orden.get(z.id);
  const nombre = (id) => nombreEnFrase(porId.get(id));

  /* QUIEN CORTA PARA RECIBIR se cuenta en el pase: los cortes con los que
     empieza su fase, si salen antes de que le llegue el balón. */
  const enElPase = new Map();    // corte -> pase
  const cortesDe = new Map();    // pase -> [cortes]
  for (const p of [...tramos].sort(antes)) {
    if (p.accion !== 'pasa' || !p.receptor_id) continue;
    const suyos = tramos.filter((t) => t.elemento_id === p.receptor_id).sort(antes);
    const cortes = [];
    for (const t of suyos) {
      if (t.accion !== 'corta' || cuando(t) >= acaba(p) || enElPase.has(t.id)) break;
      cortes.push(t);
    }
    if (!cortes.length) continue;
    for (const c of cortes) enElPase.set(c.id, p.id);
    cortesDe.set(p.id, cortes);
  }

  /* Las oraciones: lo seguido de un mismo jugador, junto. */
  const tandas = [];
  for (const t of [...tramos].sort(antes)) {
    if (enElPase.has(t.id)) continue;
    const ultima = tandas[tandas.length - 1];
    if (ultima && ultima.quien === t.elemento_id) ultima.tramos.push(t);
    else tandas.push({ quien: t.elemento_id, tramos: [t] });
  }
  const ctx = { fases, i, porId, pista, canasta, nombre };
  return tandas.map(({ quien, tramos: suyos }) => {
    const partes = suyos.map((t, k) => clausula(t, { ...ctx, anterior: suyos[k - 1], cortes: cortesDe.get(t.id) || null }));
    /* Una subordinada («…, que ha cortado a la esquina») se cierra con
       coma si detrás viene otra cosa: si no, lo siguiente parecería del
       que recibe. */
    const textos = partes.map((p, k) => (p.subordinada && k < partes.length - 1 ? `${p.texto},` : p.texto));
    return `${capital(nombre(quien))} ${unir(textos)}.`;
  }).join(' ');
}

/** El destino por su nombre: el cono en el que acaba, la zona, o el cono
 *  cercano si no cae en ninguna zona. */
function destinoDe(punto, { porId, pista, canasta }) {
  if (!punto) return null;
  let mejor = null;
  for (const e of porId.values()) {
    if (e.kind !== 'cono') continue;
    const m = metrosEntre(pista, punto, e);
    if (m <= METROS_AL_CONO && (!mejor || m < mejor.m)) mejor = { e, m };
  }
  if (mejor && mejor.m <= METROS_EN_EL_CONO) return nombreEnFrase(mejor.e);
  return zonaDe(pista, canasta, punto) || (mejor ? nombreEnFrase(mejor.e) : null);
}

/** Lo que hace un tramo, sin el sujeto: { texto, subordinada }. */
function clausula(t, { anterior, cortes, fases, i, porId, pista, canasta, nombre }) {
  const accion = porSlug.get(t.accion);
  const fin = Array.isArray(t.trazo) && t.trazo.length ? t.trazo[t.trazo.length - 1] : null;
  const ini = Array.isArray(t.trazo) && t.trazo.length ? t.trazo[0] : null;
  const destino = destinoDe(fin, { porId, pista, canasta });
  const sorteo = sorteoDe(t, porId);
  const v = variante(t);
  const solo = (texto) => ({ texto, subordinada: false });

  switch (t.accion) {
    case 'pasa': {
      const para = t.receptor_id ? nombre(t.receptor_id) : null;
      if (!para) return solo(`pasa${v}${destino ? ` hacia ${destino}` : ''}`);
      if (!cortes) return solo(`pasa${v} ${contraer('a', para)}`);
      /* El corte del que recibe, con su variante y sus conos. */
      const tramosCorte = cortes.map((c) => {
        const d = destinoDe(c.trazo && c.trazo[c.trazo.length - 1], { porId, pista, canasta });
        return `${variante(c)}${d ? ` ${contraer('a', d)}` : ''}${sorteoDe(c, porId)}`.trim();
      }).filter(Boolean);
      const como = tramosCorte.length > 1
        ? `${tramosCorte.slice(0, -1).join(', ')} y después ${tramosCorte[tramosCorte.length - 1]}`
        : (tramosCorte[0] || '');
      return { texto: `pasa${v} ${contraer('a', para)}, que ha cortado${como ? ` ${como}` : ''}`, subordinada: true };
    }
    case 'tira': {
      const final = t.desenlace === 'entra' ? ' y anota' : t.desenlace === 'falla' ? ' y falla' : '';
      /* Tras entrar a canasta, el tiro es la finalización de la entrada. */
      if (anterior && anterior.accion === 'entra') return solo(t.desenlace === 'falla' ? 'falla' : t.desenlace === 'entra' ? 'anota' : 'finaliza');
      if (t.variante === 'palmeo') return solo(`palmea${final}`);
      const aro = aroExacto(pista, canasta);
      const desde = ini ? zonaDe(pista, canasta, ini) : null;
      const cerca = (aro && ini && metrosEntre(pista, ini, { x: aro[0], y: aro[1] }) <= METROS_JUNTO_AL_ARO) || desde === 'el aro';
      if (cerca) return solo(`finaliza junto al aro${v}${final}`);
      return solo(`tira${v}${desde ? ` desde ${desde}` : ''}${final}`);
    }
    case 'entra':
      return solo(`entra a canasta${v}${sorteo}`);
    case 'bota':
      return solo(`bota${v}${destino && destino !== 'el aro' ? ` hasta ${destino}` : destino ? ' hacia el aro' : ''}${sorteo}`);
    case 'corta':
      return solo(`corta${v}${destino ? ` ${contraer('a', destino)}` : ''}${sorteo}`);
    case 'recoge':
      return solo(vieneDeUnFallo(t, fases, i) ? 'coge el rebote' : 'recoge el balón');
    case 'vuelve_a_fila':
      return solo('vuelve al final de la fila');
    case 'bloquea': {
      const para = t.companero_id ? nombre(t.companero_id) : null;
      if (t.variante === 'mano_a_mano') return solo(`hace un mano a mano${para ? ` con ${para}` : ''}`);
      if (v) return solo(`pone un bloqueo${v}${para ? ` ${contraer('a', para)}` : ''}`);
      return solo(`bloquea${para ? ` para ${para}` : ''}`);
    }
    default: {
      const nombreAccion = accion ? accion.nombre.toLowerCase() : String(t.accion || 'se mueve');
      const para = t.companero_id ? ` con ${nombre(t.companero_id)}` : '';
      return solo(`${nombreAccion}${v}${para}${destino ? ` hacia ${destino}` : ''}${sorteo}`);
    }
  }
}

/* Por qué conos pasa (§7.4): la intención guardada, no la curva. */
function sorteoDe(t, porId) {
  const lista = (t.sorteando || []).filter((x) => x && !x.anulado);
  if (!lista.length) return '';
  if (lista.some((x) => x.tipo === 'puerta')) {
    const puertas = lista.filter((x) => x.tipo === 'puerta').length;
    return puertas > 1 ? ' pasando por las puertas' : ' pasando por la puerta';
  }
  if (lista.length > 1) return ' sorteando los conos';
  const x = lista[0];
  const cono = porId.get(x.cono);
  const lado = x.lado === 'der' ? ' por la derecha' : x.lado === 'izq' ? ' por la izquierda' : '';
  return ` rodeando ${cono ? nombreEnFrase(cono) : 'el cono'}${lado}`;
}

/* ¿El balón que recoge viene de un tiro FALLADO? Lo último que le pasó a
   ESE balón antes de recogerlo, en esta fase o en las anteriores. Tras
   una canasta no hay rebote: se recoge el balón. */
function vieneDeUnFallo(t, fases, i) {
  if (!t.balon_id) return false;
  const antes = [];
  for (let k = 0; k <= i; k++) {
    for (const x of ((fases[k] && fases[k].tramos) || [])) {
      if (k === i && x.id === t.id) break;
      if (x && x.corre_id === t.balon_id) antes.push(x);
    }
  }
  const ultimo = antes[antes.length - 1];
  return !!(ultimo && esTiro(ultimo) && ultimo.desenlace === 'falla');
}

/* ── La defensa ─────────────────────────────────────────────── */

/* Lo que ha DICHO el entrenador (§8.5), como se vería desde la banda. */
const DICHO = {
  ayuda: (q, o) => `${q} ayuda${o ? ` sobre ${o}` : ''} y vuelve con su par`,
  sobrepasado: (q) => `${q} es superado y persigue por detrás`,
  cambia_marca: (q, o) => `${q} cambia el marcaje${o ? ` con ${o}` : ''}`,
  cierra_rebote: (q) => `${q} cierra el rebote`,
  dos_contra_uno: (q) => `${q} va al dos contra uno sobre el balón`,
};

/* Lo que hace SOLA, según la regla que cumple en ese momento (§8.3). */
const SOLO = {
  entre_par_y_aro: (qs, pares) => (qs.length === 1
    ? `${qs[0]} sigue ${contraer('a', pares[0])} por el lado de canasta`
    : `${unir(qs)} siguen a su par por el lado de canasta`),
  niega_linea: (qs, pares) => (qs.length === 1 ? `${qs[0]} niega la línea de pase ${contraer('a', pares[0])}` : `${unir(qs)} niegan la línea de pase`),
  ayuda_y_flota: (qs) => `${unir(qs)} flota${qs.length > 1 ? 'n' : ''} para ayudar`,
  presion: (qs, pares) => (qs.length === 1 ? `${qs[0]} presiona ${contraer('a', pares[0])}` : `${unir(qs)} presionan a su par`),
  retrasa: (qs) => `${unir(qs)} retrasa${qs.length > 1 ? 'n' : ''} y protege${qs.length > 1 ? 'n' : ''} el aro`,
  trampa: (qs) => `${unir(qs)} hace${qs.length > 1 ? 'n' : ''} la trampa sobre el balón`,
  protege: (qs) => `${unir(qs)} protege${qs.length > 1 ? 'n' : ''} el aro entre el balón y la canasta`,
};

/**
 * La defensa, al final y aparte (§9.1): cada cosa que ha DICHO el
 * entrenador en su oración, y lo que sale solo en una más. Quien ha
 * dibujado algo suyo en la fase (un rebote) ya está contado arriba.
 */
function fraseDeLaDefensa(f, papeles, { escena, porId, pista, canasta, defensaDelEjercicio }) {
  if (!papeles || !(papeles.defensores || []).length) return '';
  const nombre = (id) => nombreEnFrase(porId.get(id));
  const oraciones = [];
  const dichas = (f && f.defensa) || {};
  for (const [d, a] of Object.entries(dichas)) {
    if (!a || !porId.has(d)) continue;
    const q = nombre(d);
    const o = a.objetivo_id ? nombre(a.objetivo_id) : null;
    if (a.accion === 'roba') {
      const intercepta = f.tramos.some((t) => t.accion === 'pasa' && t.receptor_id === a.objetivo_id);
      oraciones.push(intercepta
        ? `${q} intercepta el pase${o ? ` para ${o}` : ''}, y su equipo pasa a atacar`
        : `${q} le roba el balón${o ? ` ${contraer('a', o)}` : ''}, y su equipo pasa a atacar`);
      continue;
    }
    oraciones.push(DICHO[a.accion] ? DICHO[a.accion](q, o) : `${q} ${a.accion}`);
  }
  const conTramo = new Set(f.tramos.map((t) => t.elemento_id));
  const solos = papeles.defensores.filter((d) => !dichas[d] && !conTramo.has(d));
  let sitios = {};
  try {
    sitios = colocar({ pista, canasta, elementos: escena, papeles, defensa: defensaDelEjercicio });
  } catch { sitios = {}; }
  const grupos = new Map();
  for (const d of solos) {
    if (!sitios[d]) continue;
    const aplica = sitios[d].aplica || 'entre_par_y_aro';
    if (!grupos.has(aplica)) grupos.set(aplica, []);
    grupos.get(aplica).push(d);
  }
  const automaticas = [...grupos].map(([aplica, ds]) => (SOLO[aplica] || SOLO.entre_par_y_aro)(
    ds.map(nombre), ds.map((d) => (papeles.pares[d] ? nombre(papeles.pares[d]) : 'su par')),
  ));
  if (automaticas.length) oraciones.push(unir(automaticas));
  /* TRAS UN TIRO QUE FALLA, cierran el rebote solos (§8.3): lo hace la
     animación, y se cuenta. */
  const cierran = solos.filter((d) => papeles.pares[d]);
  if (cierran.length && f.tramos.some((t) => esTiro(t) && t.desenlace === 'falla')) {
    oraciones.push(`tras el tiro, ${unir(cierran.map(nombre))} cierra${cierran.length > 1 ? 'n' : ''} el rebote`);
  }
  return oraciones.map((o) => `${capital(o)}.`).join(' ');
}
