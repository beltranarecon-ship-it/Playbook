/* ============================================================
   canvas/fotograma.js — qué se ve en el instante t de una fase.

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-fotograma.mjs.

   ── POR QUÉ ESTÁ AQUÍ Y NO DENTRO DEL MOTOR ─────────────────
   Esta cuenta —montar lo que pasa en una fase y preguntarle dónde está
   cada uno en un instante— la necesitaban dos: el motor de
   reproducción, que la tenía dentro, y la defensa que se mueve sola
   (§8.4), que sigue a su par por donde se le ve. Con dos copias, la
   defensa seguiría a un atacante que en el proyector va por otro sitio,
   y eso es justo lo que el principio 4 no permite.

   Así que vive aquí, se prueba aquí, y el motor la consume.

   ── DOS MANERAS DE RECORRER UN CAMINO ───────────────────────
   Lo dibujado por el entrenador se recorre por LONGITUD DE ARCO con la
   curva de siempre (easeInOut): se sale despacio y se llega despacio.
   Lo que sale de un seguimiento —la defensa— viene ya muestreado EN EL
   TIEMPO, y ahí no hay curva que valga: cada muestra dice dónde estaba
   en ese milisegundo, y meterle una curva encima deformaría el retardo
   que se acaba de calcular.
   ============================================================ */

import { easeInOut } from './geometry.js';
import { muestreador, muestreadorPorTiempo, posicionEn, duenoEn } from './instante.js';
import { MOV_TO_ARROW } from './arrows.js';

const clonar = (m) => { const o = {}; for (const k in m) o[k] = { ...m[k] }; return o; };
const ultimoNodo = (path) => (path && path.length ? { x: path[path.length - 1].x, y: path[path.length - 1].y } : null);

/** La escena copiada: posiciones y de quién es cada balón. */
export const copiarEscena = (e) => ({ P: clonar(e.P), B: clonar(e.B), owner: { ...e.owner } });

/**
 * Monta lo que pasa en UNA fase y devuelve la escena al acabarla.
 *
 * @param fase    la fase compilada (§11.2)
 * @param escena  { P, B, owner } al EMPEZAR la fase
 * @param aro     (canasta) => { x, y }
 * @returns { meta, escena } — meta es lo que consume `fotograma`
 */
export function metaDeFase(fase, { jugadores = [], balones = [], escena, aro = () => ({ x: 0.5, y: 0.1 }) } = {}) {
  const P = clonar(escena.P), B = clonar(escena.B), owner = { ...escena.owner };
  const dur = fase.duracion_ms || 1000;
  /* CUÁNDO va cada cosa dentro de la fase (§11.2).
     Solo lleva tiempo propio lo que trae `inicio_ms`, que es la señal de
     que viene del compilador con carriles. Todo lo demás —cualquier
     animación guardada antes— ocupa la fase entera, exactamente como
     hacía el motor, así que nada de lo guardado cambia de aspecto. */
  const cuando = (x) => {
    if (!Number.isFinite(x && x.inicio_ms)) return { inicio: 0, fin: dur, dur };
    const inicio = Math.max(0, x.inicio_ms);
    const d = Number.isFinite(x.duracion_ms) && x.duracion_ms > 0 ? x.duracion_ms : Math.max(1, dur - inicio);
    return { inicio, fin: inicio + d, dur: d };
  };
  const meta = {
    movs: {},        // jugador -> [{ sampler, inicio, fin, dur }], por orden de arranque
    ballMovs: {},    // balón   -> [{ kind, sampler, inicio, fin, dur }]
    duenos: {},      // balón   -> [{ t, quien }]: cuándo cambia de manos
    /* El último movimiento de cada uno, como lo guardaba el motor de
       antes: quien lo lea desde fuera sigue encontrándolo. */
    movByEl: {}, ballMoves: {},
    bloqueos: fase.bloqueos || [], arrows: [], defenders: new Set(fase.defensores || []),
  };
  const pon = (lista, id, x) => { (lista[id] ||= []).push(x); };
  /* Dónde acaba cada uno se decide por INSTANTE, no por el orden en que
     vienen escritos: con carriles, el último de la lista no tiene por qué
     ser el último en acabar. Con empate —todo lo que ocupa la fase
     entera— gana el último escrito, como antes. */
  const alFinal = {};
  const acaba = (id, fin, punto) => { if (punto && (!alFinal[id] || fin >= alFinal[id].fin)) alFinal[id] = { fin, punto }; };

  // movimientos de jugadores y balones
  for (const mv of (fase.movimientos || [])) {
    /* Un movimiento puede venir dibujado (un camino) o MUESTREADO en el
       tiempo (la defensa del §8.4). */
    const porTiempo = Array.isArray(mv.muestras) && mv.muestras.length > 1;
    const sampler = porTiempo ? muestreadorPorTiempo(mv.muestras) : muestreador(mv.path);
    const type = MOV_TO_ARROW[mv.tipo_movimiento] || 'cut';
    const c = cuando(mv);
    if (mv.tipo_elemento === 'balon') {
      pon(meta.ballMovs, mv.elemento_id, { kind: 'mov', sampler, ...c });
      meta.ballMoves[mv.elemento_id] = { kind: 'mov', sampler };
    } else {
      pon(meta.movs, mv.elemento_id, { sampler, ...c });
      meta.movByEl[mv.elemento_id] = { sampler, type };
      /* Lo AUTOMÁTICO no lleva flecha (§8.4): la defensa se mueve sola y
         dibujar su camino llenaría la pista de flechas que nadie ha
         pedido. */
      if (!mv.automatico) meta.arrows.push({ flat: sampler.flat, type });
    }
    acaba(mv.elemento_id, c.fin, porTiempo ? sampler(1) : ultimoNodo(mv.path));
  }
  for (const j of jugadores) if (alFinal[j.id]) P[j.id] = alFinal[j.id].punto;

  // pases (el balón viaja al receptor, y es suyo al llegar)
  for (const p of (fase.pases || [])) {
    const recvEnd = P[p.a_id] || ultimoNodo(p.path) || B[p.balon_id];
    const effPath = (p.path && p.path.length >= 2) ? p.path : [escena.B[p.balon_id] || B[p.balon_id], recvEnd];
    const sampler = muestreador(effPath);
    const c = cuando(p);
    pon(meta.ballMovs, p.balon_id, { kind: 'pase', sampler, ...c });
    meta.ballMoves[p.balon_id] = { kind: 'pase', sampler };
    meta.arrows.push({ flat: sampler.flat, type: 'pass' });
    pon(meta.duenos, p.balon_id, { t: c.fin, quien: p.a_id || null });
    acaba(p.balon_id, c.fin, ultimoNodo(effPath));
  }

  // tiros (el balón viaja a canasta y deja de ser de nadie)
  for (const t of (fase.tiros || [])) {
    const start = escena.B[t.balon_id] || B[t.balon_id];
    const canasta = aro(t.canasta);
    const effPath = (t.path && t.path.length >= 2) ? t.path : [start, canasta];
    const sampler = muestreador(effPath);
    const c = cuando(t);
    pon(meta.ballMovs, t.balon_id, { kind: 'tiro', sampler, ...c });
    meta.ballMoves[t.balon_id] = { kind: 'tiro', sampler };
    meta.arrows.push({ flat: sampler.flat, type: 'pass' });
    pon(meta.duenos, t.balon_id, { t: c.fin, quien: null });
    // reposo final = último nodo del path EFECTIVO: el balón no salta al
    // aro de la pista al acabar la fase.
    acaba(t.balon_id, c.fin, ultimoNodo(effPath) || canasta);
  }

  /* recogidas: alguien va a por un balón suelto y se lo queda. Es suyo EN
     EL INSTANTE EN QUE LE LLEGA a las manos (`t_ms`). Lo de antes no lo
     trae, y se sigue fechando como siempre: el final del último viaje del
     balón en la fase, o el final de la fase si no viaja. */
  for (const rec of (fase.recogidas || [])) {
    if (!rec || !rec.balon_id) continue;
    const viajes = meta.ballMovs[rec.balon_id] || [];
    const t = Number.isFinite(rec.t_ms) ? rec.t_ms
      : (viajes.length ? Math.max(...viajes.map((x) => x.fin)) : dur);
    pon(meta.duenos, rec.balon_id, { t, quien: rec.jugador_id || null });
  }

  // dueños y sitios al acabar la fase
  for (const b of balones) {
    const lista = meta.duenos[b.id];
    if (lista) { lista.sort((a, z) => a.t - z.t); owner[b.id] = lista[lista.length - 1].quien; }
    const o = owner[b.id];
    if (o && P[o]) B[b.id] = { ...P[o] };
    else if (alFinal[b.id]) B[b.id] = alFinal[b.id].punto;
  }
  for (const id in meta.movs) meta.movs[id].sort((a, z) => a.inicio - z.inicio);
  for (const id in meta.ballMovs) meta.ballMovs[id].sort((a, z) => a.inicio - z.inicio);

  return { meta, escena: { P, B, owner } };
}

/**
 * Dónde está cada uno en el instante t de la fase.
 *
 * @param inicio  la escena al EMPEZAR la fase
 * @returns { players, balls, carrying, duenos }
 */
export function fotograma({ meta = null, inicio = null, jugadores = [], balones = [], t = 0 } = {}) {
  const players = {}, balls = {}, carrying = new Set(), duenos = {};
  for (const j of jugadores) {
    players[j.id] = posicionEn(meta && meta.movs[j.id], t) || (inicio ? { ...inicio.P[j.id] } : { x: 0.5, y: 0.5 });
  }
  for (const b of balones) {
    const movs = meta && meta.ballMovs[b.id];
    const o = duenoEn(meta && meta.duenos[b.id], t, inicio && inicio.owner[b.id]);
    duenos[b.id] = o ?? null;
    const activo = movs && movs.find((x) => t >= x.inicio && t <= x.fin);
    if (activo) { balls[b.id] = activo.sampler(easeInOut((t - activo.inicio) / activo.dur)); continue; }
    /* Sin viaje en este instante: con su dueño de AHORA, que puede no ser
       el del principio de la fase —tras un pase es del receptor, aunque el
       receptor eche a correr en esta misma fase. */
    if (o && players[o]) { balls[b.id] = { x: players[o].x + 0.012, y: players[o].y }; carrying.add(o); continue; }
    const hecho = movs ? movs.filter((x) => x.fin < t).pop() : null;
    balls[b.id] = hecho ? hecho.sampler(1) : (inicio ? { ...inicio.B[b.id] } : { x: 0.5, y: 0.5 });
  }
  return { players, balls, carrying, duenos };
}
