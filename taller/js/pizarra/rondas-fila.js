/* ============================================================
   pizarra/rondas-fila.js — los de la cola salen por turnos (§7.4.2).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-rondas-fila.mjs.

   ── UNA SOLA ANIMACIÓN ──────────────────────────────────────
   Lo decidió el entrenador (2026-09-23): una fila que sale por rondas se
   ve como UNA animación en la que los de la cola salen uno tras otro, con
   la cadencia que se diga, y la cola se va acortando. Nada de repetir la
   jugada entera una vez por cabeza.

   Por eso las rondas no se guardan: se DEDUCEN de lo que se ha dibujado
   con el primero de la cola. El compilador y la Pizarra preguntan aquí
   lo mismo, y así se ve igual al dibujar y al proyectar.

   ── QUÉ ES UNA RONDA ────────────────────────────────────────
   Todo lo dibujado en lo que sale el PRIMERO de una cola o SU BALÓN:
     · lo que hace él (correr, botar, pasar, tirar, recoger, volver);
     · lo que los de fuera hacen CON él —también lo decidió el
       entrenador—: quien le devuelve el pase se lo devuelve a cada uno,
       y el que le pasa desde fuera tiene un balón para cada uno, como
       un carro de balones;
     · y lo que cualquiera hace con su balón (el reboteador que recoge
       su tiro).
   Lo que los demás hacen por su cuenta, sin él, no se repite.

   Cada uno de los que esperan repite su ronda con SU balón, entera y
   con los mismos tiempos, un TURNO más tarde que el anterior: la
   cadencia de la fila o, sin ella, lo que dura la ronda del primero en
   esa fase. Sale de su sitio en la cola, y si vuelve a la fila, se pone
   detrás del que volvió antes.

   Dos colas que juegan entre sí (una pasa a la otra) salen A LA PAR: el
   segundo de una con el segundo de la otra. Salen tantas rondas como
   jugadores tiene la más corta.

   Quien de la cola ya tiene algo dibujado hace lo suyo y no repite; y
   si la ronda necesita balón y alguno no lo tiene, esa ronda no sale y
   se dice. Lo que cambie en una ronda concreta («el tercero tira en vez
   de entrar») llegará con la variación por ronda.
   ============================================================ */

import { carrilesDesde, tiemposDe, recalcular, esTiro, TRAS_EL_TIRO_MS } from './fases.js';
import { deLaFila, FILAS, normalizarGrados } from './filas.js';
import { escalaDe, metrosEntre } from '../canvas/escala.js';
import { CATALOGO_SISTEMA } from '../ia/acciones.js';

/* Lo que se hace CON el balón en la mano (botar, entrar): quien no tiene
   balón no lo puede repetir. Sale del catálogo, no de una lista. */
const EN_LA_MANO = new Set(CATALOGO_SISTEMA.filter((a) => a.simbolo === 'carrera_con_balon').map((a) => a.slug));

/* A cuánto del sitio de quien recibe tiene que acabar el primero para que
   el receptor sea, en la ronda siguiente, el primero de la ronda anterior. */
const RELEVO_M = 1.5;

export const AVISOS_RONDAS = Object.freeze({
  sinBalon: 'Una fila sale por rondas y la ronda necesita balón: dale un balón por cabeza para que salgan todos.',
  desiguales: 'Dos filas que salen juntas no tienen los mismos jugadores: salen tantas rondas como tenga la más corta.',
});

/* El puesto k de una cola, sin el tope de la fila: quien vuelve se pone
   detrás del último que volvió, aunque ya sean más de los que caben. */
function puesto(cono, k, pista) {
  const e = escalaDe(pista);
  const rad = (normalizarGrados(cono.fila.orientacion) * Math.PI) / 180;
  const paso = (cono.fila && cono.fila.hueco_m) || FILAS.hueco;
  return { x: cono.x + (Math.cos(rad) * paso * k) / e.x, y: cono.y + (Math.sin(rad) * paso * k) / e.y };
}

/**
 * LAS FASES CON LAS RONDAS DENTRO.
 *
 * @param fases      las de la jugada (§11.1), con sus tramos
 * @param elementos  la escena al empezar (con las filas y sus colas)
 * @returns { fases, balones, rondas, avisos }
 *   fases    las mismas, con los tramos de las rondas añadidos al final
 *   balones  los balones que hacen falta de más (el carro del que pasa
 *            desde fuera), como elementos de la escena
 *   rondas   { [tramo nuevo]: { ronda, de, fila } } — de qué tramo es
 *            copia y en qué ronda, para enseñarlo aparte
 */
export function conRondas(fases = [], elementos = [], { pista = 'entera', canasta = 'norte', canastaDe = null } = {}) {
  const lista = (elementos || []).filter(Boolean);
  const nada = { fases, balones: [], rondas: {}, avisos: [] };
  const colas = lista
    .filter((e) => e.kind === 'cono' && e.fila && e.fila.rondas !== false)
    .map((cono) => ({ cono, cola: deLaFila(lista, cono.id) }))
    .filter((q) => q.cola.length >= 2);
  if (!colas.length) return nada;

  const porId = new Map(lista.map((e) => [e.id, e]));
  const balonDe = (id) => (lista.find((b) => b.kind === 'balon' && b.portador_id === id) || {}).id || null;
  const esBalon = (id) => (porId.get(id) || {}).kind === 'balon';
  const cabeza = new Map();        // primero de la cola -> su cola
  const suBalon = new Map();       // balón del primero -> el primero
  const esperando = new Set();     // los demás de todas las colas
  for (const q of colas) {
    q.primero = q.cola[0].id;
    q.balon = balonDe(q.primero);
    cabeza.set(q.primero, q);
    if (q.balon) suBalon.set(q.balon, q.primero);
    for (const j of q.cola.slice(1)) esperando.add(j.id);
  }

  /* EL RELEVO: quien recibe del primero (un mano a mano, un pase) y el
     primero acaba su ronda DONDE ESTABA ÉL, es en la ronda siguiente el
     receptor otra vez, pero hecho por el primero de la ronda anterior:
     «el que entrega pasa a ser el siguiente en recibir». Todo lo suyo en
     la jugada es de la ronda (entra, tira, coge su rebote, vuelve a la
     fila), y en cada ronda lo hace uno distinto. Si el primero acaba
     lejos, es el de siempre: un receptor fijo, que repite con cada uno. */
  const relevoDe = new Map();      // el receptor -> el primero al que releva
  for (const q of colas) {
    const suyos = [];
    for (const f of fases || []) for (const t of (f && f.tramos) || []) if (t && t.elemento_id === q.primero) suyos.push(t);
    const ultimo = suyos[suyos.length - 1];
    const fin = ultimo && Array.isArray(ultimo.trazo) && ultimo.trazo.length ? ultimo.trazo[ultimo.trazo.length - 1] : null;
    if (!fin) continue;
    for (const t of suyos) {
      const r = t.receptor_id ? porId.get(t.receptor_id) : null;
      if (!r || r.kind !== 'jugador' || cabeza.has(r.id) || esperando.has(r.id) || relevoDe.has(r.id)) continue;
      if (metrosEntre(pista, fin, r) <= RELEVO_M) relevoDe.set(r.id, q.primero);
    }
  }

  /* De qué primeros es un tramo: en los que sale él o su balón. */
  const primerosDe = (t) => {
    const s = new Set();
    for (const id of [t.elemento_id, t.corre_id, t.receptor_id, t.companero_id]) {
      if (cabeza.has(id)) s.add(id);
      if (relevoDe.has(id)) s.add(relevoDe.get(id));
    }
    for (const id of [t.corre_id, t.balon_id]) if (suBalon.has(id)) s.add(suBalon.get(id));
    return s;
  };

  /* LOS GRUPOS: las colas que juegan entre sí salen a la par. */
  const padre = new Map([...cabeza.keys()].map((id) => [id, id]));
  const raiz = (id) => { while (padre.get(id) !== id) id = padre.get(id); return id; };
  const deRonda = (fases || []).map((f) => ((f && f.tramos) || []).filter((t) => {
    if (!t || esperando.has(t.elemento_id)) return false;
    const s = [...primerosDe(t)];
    for (const id of s.slice(1)) padre.set(raiz(id), raiz(s[0]));
    return s.length > 0;
  }));
  const grupoDe = (t) => raiz([...primerosDe(t)][0]);

  /* Quien de la cola ya tiene algo dibujado —o se lo hacen— hace lo suyo. */
  const dibujados = new Set((fases || []).flatMap((f) => ((f && f.tramos) || []))
    .filter(Boolean).flatMap((t) => [t.elemento_id, t.corre_id, t.receptor_id, t.companero_id]));

  const avisos = new Set();
  const rondas = {};
  const balones = [];
  const nuevos = (fases || []).map(() => []);
  const colasConRondas = [];       // las colas que salen, con sus tramos de la primera ronda
  /* Los tiempos de cada fase TAL Y COMO SE DIBUJÓ: la ronda k es la del
     primero, corrida k turnos. */
  const tiempos = (fases || []).map((f) => tiemposDe({ ...f, carriles: carrilesDesde((f && f.tramos) || []) }, { pista }));

  for (const g of new Set([...cabeza.keys()].map(raiz))) {
    const suyas = colas.filter((q) => raiz(q.primero) === g);
    const tramosDelGrupo = deRonda.map((ts) => ts.filter((t) => grupoDe(t) === g));
    if (!tramosDelGrupo.some((ts) => ts.length)) continue;
    const ronda0 = new Set(tramosDelGrupo.flat().map((t) => t.id));
    for (const q of suyas) { q.ronda0 = ronda0; colasConRondas.push(q); }
    const cuantas = Math.min(...suyas.map((q) => q.cola.length)) - 1;
    if (suyas.some((q) => q.cola.length - 1 !== cuantas)) avisos.add(AVISOS_RONDAS.desiguales);
    const usa = new Set(tramosDelGrupo.flat().flatMap((t) => [t.corre_id, t.balon_id]).filter(Boolean));
    /* El balón del primero hace falta si la ronda lo usa: lo pasa, lo
       tira, lo recoge, o bota con él. */
    const necesitaSuyo = (q) => q.balon && (usa.has(q.balon)
      || tramosDelGrupo.flat().some((t) => t.elemento_id === q.primero && EN_LA_MANO.has(t.accion)));
    /* Los balones que no son de ningún primero: vienen de fuera, y hay
       uno para cada ronda (el carro). */
    const deFuera = [...usa].filter((id) => esBalon(id) && !suBalon.has(id));
    /* EL TURNO de cada fase: la cadencia de la fila o lo que dura la
       ronda del primero, contando el balón de un tiro hasta que cae. */
    const cadencia = suyas.map((q) => q.cono.fila.cadencia_ms).find((c) => Number.isFinite(c) && c > 0) || null;
    const turnos = tramosDelGrupo.map((ts, i) => {
      if (!ts.length) return 0;
      if (cadencia) return cadencia;
      const m = ts.map((t) => tiempos[i].tramos[t.id]).filter(Boolean);
      const empieza = Math.min(...m.map((x) => x.inicio_ms));
      const acaba = Math.max(...ts.map((t) => {
        const x = tiempos[i].tramos[t.id];
        return x ? x.fin_ms + (esTiro(t) ? TRAS_EL_TIRO_MS : 0) : 0;
      }));
      return Math.max(1, acaba - empieza);
    });

    for (let k = 1; k <= cuantas; k++) {
      const sale = suyas.map((q) => q.cola[k]);
      if (sale.some((j) => dibujados.has(j.id))) continue;
      const cambio = new Map();
      let falta = false;
      for (const q of suyas) {
        cambio.set(q.primero, q.cola[k].id);
        if (!q.balon) continue;
        const suyo = balonDe(q.cola[k].id);
        if (suyo) cambio.set(q.balon, suyo);
        else if (necesitaSuyo(q)) falta = true;
      }
      if (falta) { avisos.add(AVISOS_RONDAS.sinBalon); continue; }
      /* El relevo: en la ronda k recibe quien entregó en la anterior. */
      for (const [recibe, primero] of relevoDe) {
        const q = cabeza.get(primero);
        if (suyas.includes(q)) cambio.set(recibe, k === 1 ? q.primero : q.cola[k - 1].id);
      }
      /* El carro: un balón más para cada ronda, donde empezaba el suyo
         —en las manos de quien lo pasa, o en el suelo si se recoge—. */
      for (const id of deFuera) {
        const b = porId.get(id);
        const nuevo = { ...b, id: `${id}_r${k}` };
        balones.push(nuevo);
        cambio.set(id, nuevo.id);
      }
      const S = (id) => (id == null ? id : (cambio.get(id) ?? id));

      tramosDelGrupo.forEach((ts, i) => {
        for (const t of ts) {
          const m = tiempos[i].tramos[t.id];
          if (!m) continue;
          const id = `${t.id}_r${k}`;
          let trazo = t.trazo;
          /* Quien vuelve a la fila se pone detrás del que volvió antes. */
          const q = cabeza.get(t.elemento_id) || (relevoDe.has(t.elemento_id) ? cabeza.get(relevoDe.get(t.elemento_id)) : null);
          if (t.accion === 'vuelve_a_fila' && q && Array.isArray(trazo) && trazo.length) {
            const vuelta = (q.cono.fila.vuelta && lista.find((e) => e.id === q.cono.fila.vuelta && e.kind === 'cono' && e.fila)) || q.cono;
            const fin = puesto(vuelta, (vuelta.fila.n | 0) + k, pista);
            trazo = trazo.map((n, x) => (x === trazo.length - 1 ? { ...n, x: fin.x, y: fin.y } : n));
          }
          const copia = {
            ...t,
            id,
            elemento_id: S(t.elemento_id),
            corre_id: S(t.corre_id),
            receptor_id: S(t.receptor_id ?? null),
            ...(t.companero_id ? { companero_id: S(t.companero_id) } : {}),
            ...(t.balon_id ? { balon_id: S(t.balon_id) } : {}),
            trazo,
            /* Con los mismos tiempos que la del primero, k turnos más
               tarde: así lo que espera a un pase sigue esperándolo. */
            manual: true,
            inicio_ms: m.inicio_ms + k * turnos[i],
          };
          rondas[id] = { ronda: k, de: t.id, fila: (cabeza.get(t.elemento_id) || suyas[0]).cono.id };
          nuevos[i].push(copia);
        }
      });
    }
  }
  if (!Object.keys(rondas).length) return { ...nada, avisos: [...avisos] };

  /* LA COLA AVANZA: cuando sale el primero, los de detrás avanzan un puesto,
     y quien vuelve se pone al final de lo que QUEDA —de su fila o de la que
     diga `vuelta`, como el que remata y va a la fila del otro lado—, no
     donde estaba el último al empezar. Se simulan TODAS las colas a la vez en
     el tiempo (quién sale, quién vuelve, cuándo y adónde), y de ahí salen los
     pasos adelante y el sitio de cada vuelta. Solo si todo ocurre en una
     misma fase; si no, se queda como estaba (un puesto fijo por vuelta). */
  const finales = new Map();                       // tramo -> dónde acaba
  const avances = (fases || []).map(() => []);     // los pasos adelante
  simulacion: {
    const filasSim = new Map();                    // cono -> los ids que hay en su cola, en orden
    const conoDe = new Map();
    const destinoDeVuelta = (q) => (q.cono.fila.vuelta && lista.find((e) => e.id === q.cono.fila.vuelta && e.kind === 'cono' && e.fila)) || q.cono;
    const registrar = (cono) => {
      if (filasSim.has(cono.id)) return;
      conoDe.set(cono.id, cono);
      filasSim.set(cono.id, deLaFila(lista, cono.id).map((j) => j.id));
    };
    for (const q of colasConRondas) { registrar(q.cono); registrar(destinoDeVuelta(q)); }

    const eventos = [];
    const fasesDeEventos = new Set();
    for (const q of colasConRondas) {
      const delGrupo = [];                         // { t, i, original }
      (fases || []).forEach((f, i) => {
        for (const t of (f && f.tramos) || []) if (t && q.ronda0 && q.ronda0.has(t.id)) delGrupo.push({ t, i, original: true });
        for (const t of nuevos[i]) if (rondas[t.id] && rondas[t.id].fila === q.cono.id) delGrupo.push({ t, i, original: false });
      });
      const inicioDe = ({ t, i, original }) => (original ? (tiempos[i].tramos[t.id] || {}).inicio_ms : t.inicio_ms);
      const duracionDe = ({ t, i, original }) => (tiempos[i].tramos[original ? t.id : rondas[t.id].de] || {}).duracion_ms;
      const sale = new Map();                      // jugador -> cuándo sale de la cola
      for (const g of delGrupo) {
        const id = g.t.elemento_id;
        if (!q.cola.some((j) => j.id === id)) continue;
        const t0 = inicioDe(g);
        if (Number.isFinite(t0) && (!sale.has(id) || t0 < sale.get(id).t)) sale.set(id, { t: t0, i: g.i });
      }
      for (const [id, v] of sale) { eventos.push({ t: v.t, i: v.i, tipo: 0, id }); fasesDeEventos.add(v.i); }
      for (const x of delGrupo) {
        if (x.t.accion !== 'vuelve_a_fila' || !Number.isFinite(inicioDe(x)) || !Number.isFinite(duracionDe(x))) continue;
        eventos.push({ t: inicioDe(x) + duracionDe(x), i: x.i, tipo: 1, id: x.t.elemento_id, tramo: x.t.id, hacia: destinoDeVuelta(q).id });
        fasesDeEventos.add(x.i);
      }
    }
    if (!eventos.length || fasesDeEventos.size > 1) break simulacion;      // en una sola fase
    eventos.sort((a, b) => a.t - b.t || a.tipo - b.tipo);

    const aplicar = { finales: new Map(), pasos: [] };
    for (const e of eventos) {
      if (e.tipo === 0) {
        const cono = [...filasSim.keys()].find((c) => filasSim.get(c).includes(e.id));
        if (!cono) continue;                       // sale quien no estaba en ninguna cola
        const fila = filasSim.get(cono);
        if (fila[0] !== e.id) break simulacion;    // sale quien no es el primero: se deja como estaba
        fila.shift();
        const c = conoDe.get(cono);
        fila.forEach((id, k) => {
          const p0 = puesto(c, k + 1, pista), p1 = puesto(c, k, pista);
          aplicar.pasos.push({
            id: `av_${id}_${Math.round(e.t)}`, elemento_id: id, corre_id: id, receptor_id: null,
            accion: 'corta', tipo: 'run', ritmo: 'andando', manual: true, avance: true, inicio_ms: e.t,
            trazo: [{ x: p0.x, y: p0.y, tipo_nodo: 'lineal', handle_in: null, handle_out: null }, { x: p1.x, y: p1.y, tipo_nodo: 'lineal', handle_in: null, handle_out: null }],
            i: e.i, fila: cono,
          });
        });
      } else {
        const fila = filasSim.get(e.hacia);
        aplicar.finales.set(e.tramo, puesto(conoDe.get(e.hacia), fila.length, pista));
        fila.push(e.id);
      }
    }
    for (const [id, p] of aplicar.finales) finales.set(id, p);
    for (const { i, fila, ...paso } of aplicar.pasos) {
      avances[i].push(paso);
      rondas[paso.id] = { ronda: 1, de: null, fila, avance: true };
    }
  }
  const conFinal = (t) => {
    const p = finales.get(t.id);
    return p && Array.isArray(t.trazo) && t.trazo.length
      ? { ...t, trazo: t.trazo.map((n, x, a) => (x === a.length - 1 ? { ...n, x: p.x, y: p.y } : n)) }
      : t;
  };
  if (finales.size || avances.some((a) => a.length)) {
    for (let i = 0; i < nuevos.length; i++) {
      nuevos[i] = [...nuevos[i].map(conFinal), ...avances[i]].sort((a, b) => (a.inicio_ms || 0) - (b.inicio_ms || 0));
    }
  }

  /* Cada uno sale de DONDE ESTÁ: el de la cola, de su sitio; el que
     devuelve el pase, de donde le dejó lo anterior. Y lo dibujado para
     después de las rondas, también: quien ha recogido el tiro de cada
     uno no está donde estaba al dibujar la fase siguiente. */
  const conCopias = (fases || []).map((f, i) => ({ ...f, tramos: [...((f && f.tramos) || []).map(conFinal), ...nuevos[i]] }));
  const entrada = Object.fromEntries([...lista, ...balones].map((e) => [e.id, { x: e.x, y: e.y }]));
  const rc = recalcular(conCopias.map((f) => ({ ...f, carriles: carrilesDesde(f.tramos) })), entrada, pista, { canasta, canastaDe });
  const salida = conCopias.map((f, i) => {
    const reanclados = new Map(rc.fases[i].carriles.flatMap((c) => c.tramos).filter((t) => !t.huerfano).map((t) => [t.id, t.trazo]));
    const tramos = f.tramos.map((t) => (reanclados.has(t.id) ? { ...t, trazo: reanclados.get(t.id) } : t));
    if (!nuevos[i].length) return { ...f, tramos };
    /* Una fase con la duración puesta a mano se alarga lo que haga falta
       para que quepan todas las rondas. */
    if (!Number.isFinite(f.duracion_ms)) return { ...f, tramos };
    const todo = tiemposDe({ ...f, tramos, duracion_ms: null, carriles: carrilesDesde(tramos) }, { pista }).duracion_ms;
    return { ...f, tramos, duracion_ms: Math.max(f.duracion_ms, todo) };
  });
  return { fases: salida, balones, rondas, avisos: [...avisos] };
}
