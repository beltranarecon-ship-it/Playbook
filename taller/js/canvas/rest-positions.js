/* ============================================================
   rest-positions.js — posiciones de reposo de cada elemento al INICIO
   de cada fase de una animación §10. Función PURA (sin DOM ni canvas):
   la usa el editor de flechas (editor-canvas.js) para dibujar cada fase
   desde donde terminó la anterior, y el banco (Node) para verificar que
   una edición del final de una fase propaga al arranque de la siguiente
   (Tramo 6). Misma regla que engine.js#_build y compilador.js#pos.
   ============================================================ */

const clone = (m) => { const o = {}; for (const k in m) o[k] = { ...m[k] }; return o; };
const last = (p) => (p && p.length ? { x: p[p.length - 1].x, y: p[p.length - 1].y } : null);

/* ---- estado inicial, común a las dos funciones de abajo ---- */
function arranque(anim) {
  const P = {}, B = {}, owner = {};
  for (const j of anim.jugadores || []) P[j.id] = j.posicion_inicial ? { x: j.posicion_inicial[0], y: j.posicion_inicial[1] } : { x: 0.5, y: 0.5 };
  for (const b of anim.balones || []) { B[b.id] = b.posicion_inicial ? { x: b.posicion_inicial[0], y: b.posicion_inicial[1] } : { x: 0.5, y: 0.5 }; owner[b.id] = b.portador_id || null; }
  return { P, B, owner };
}

/** starts[k] = { P: {jugadorId:{x,y}}, B: {balonId:{x,y}} } al INICIO de la fase k. */
export function restPositions(anim) {
  const { P, B, owner } = arranque(anim);
  const starts = [];
  for (const fase of anim.fases || []) {
    starts.push({ P: clone(P), B: clone(B) });
    for (const m of fase.movimientos || []) { const e = last(m.path); if (e) { if (m.tipo_elemento === 'balon') B[m.elemento_id] = e; else P[m.elemento_id] = e; } }
    for (const p of fase.pases || []) { owner[p.balon_id] = p.a_id; B[p.balon_id] = P[p.a_id] ? { ...P[p.a_id] } : (last(p.path) || B[p.balon_id]); }
    for (const t of fase.tiros || []) { owner[t.balon_id] = null; const e = last(t.path); if (e) B[t.balon_id] = e; } // el balón vuela al aro (último nodo del path del tiro): misma regla que engine.js#_build (si no, el editor lo pintaría en la mano del tirador en las fases posteriores al tiro)
    // recogida del rebote: cambia de dueño DESPUÉS del tiro. El viaje del
    // balón ya lo hizo el movimiento de tipo_elemento 'balon' de arriba.
    for (const rec of fase.recogidas || []) { if (!rec?.balon_id) continue; owner[rec.balon_id] = rec.jugador_id || null; if (rec.jugador_id && P[rec.jugador_id]) B[rec.balon_id] = { ...P[rec.jugador_id] }; }
    for (const b of anim.balones || []) { const o = owner[b.id]; const moved = (fase.movimientos || []).some((m) => m.tipo_elemento === 'balon' && m.elemento_id === b.id) || (fase.pases || []).some((p) => p.balon_id === b.id) || (fase.tiros || []).some((t) => t.balon_id === b.id); if (o && !moved && P[o]) B[b.id] = { ...P[o] }; }
  }
  return starts;
}

/* ============================================================
   Reanclado de flechas (Tramo 6.3)

   EL PROBLEMA. `restPositions` recoloca las FICHAS al inicio de cada
   fase, pero las flechas son coordenadas guardadas: si el entrenador
   arrastra el final del bote de la fase 2, el jugador arranca la fase 3
   en su sitio nuevo y la flecha de la fase 3 sigue saliendo del viejo.
   Medido sobre "Entradas por parejas desde el 45": 2,1 metros de
   separación entre el jugador y el origen de su propia flecha. Y en los
   pases era peor — arrastrar el extremo no movía ni al receptor ni al
   balón, así que la edición no hacía nada y tampoco lo decía.

   LA REGLA. Hay nodos que NO son del entrenador, son consecuencia:

     · el primer nodo de un movimiento  = donde está ese elemento
     · los dos extremos de un pase      = pasador y receptor
     · el origen de un tiro             = el tirador
     · el final del viaje de un rebote  = donde acaba quien lo recoge

   Todo lo demás —los nodos de en medio, las curvas, el DESTINO de un
   movimiento— sí es del entrenador y no se toca nunca. Esta función
   recalcula solo los nodos consecuencia, fase a fase y en el mismo
   orden que engine.js#_build, para que lo que se ve sea lo que pasa.

   Devuelve true si ha movido algo (el editor lo usa para no marcar el
   ejercicio como sucio cuando no ha cambiado nada de verdad).
   ============================================================ */

const EPS = 1e-6;

/** Clava el nodo `i` de un path en `pt`, arrastrando sus manejadores de
 *  curva con él. true si de verdad se ha movido. */
function fijarNodo(path, i, pt) {
  const n = path && path[i];
  if (!n || !pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return false;
  const dx = pt.x - n.x, dy = pt.y - n.y;
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return false;
  n.x = pt.x; n.y = pt.y;
  if (n.handle_in) { n.handle_in.x += dx; n.handle_in.y += dy; }
  if (n.handle_out) { n.handle_out.x += dx; n.handle_out.y += dy; }
  return true;
}

export function reanclarPaths(anim) {
  const { P, B, owner } = arranque(anim);
  let tocado = false;

  for (const fase of anim.fases || []) {
    // 1) cada flecha de movimiento arranca donde está su elemento AHORA
    for (const m of fase.movimientos || []) {
      const actual = m.tipo_elemento === 'balon' ? B[m.elemento_id] : P[m.elemento_id];
      if (fijarNodo(m.path, 0, actual)) tocado = true;
    }
    // …y una vez anclados, se aplican: de ahí salen las posiciones de fin de fase
    for (const m of fase.movimientos || []) { const e = last(m.path); if (e) { if (m.tipo_elemento === 'balon') B[m.elemento_id] = e; else P[m.elemento_id] = e; } }

    // 2) pases: los DOS extremos los mandan los jugadores, no el ratón.
    //    Se leen sus posiciones de FIN de fase (igual que el compilador:
    //    primero los movimientos, luego los pases).
    for (const p of fase.pases || []) {
      if (fijarNodo(p.path, 0, P[p.de_id])) tocado = true;
      if (fijarNodo(p.path, (p.path || []).length - 1, P[p.a_id])) tocado = true;
      owner[p.balon_id] = p.a_id;
      B[p.balon_id] = P[p.a_id] ? { ...P[p.a_id] } : (last(p.path) || B[p.balon_id]);
    }

    // 3) tiros: el origen es el tirador. El destino es el aro y no se
    //    toca — lo fijó el compilador con el ancla medida.
    for (const t of fase.tiros || []) {
      if (fijarNodo(t.path, 0, P[t.jugador_id])) tocado = true;
      owner[t.balon_id] = null;
      const e = last(t.path); if (e) B[t.balon_id] = e;
    }

    // 4) rebotes: el balón termina en las manos de quien lo recoge, así
    //    que su viaje acaba donde haya acabado ese jugador.
    for (const rec of fase.recogidas || []) {
      if (!rec?.balon_id) continue;
      const destino = rec.jugador_id ? P[rec.jugador_id] : null;
      const viaje = (fase.movimientos || []).find((m) => m.tipo_elemento === 'balon' && m.elemento_id === rec.balon_id);
      if (viaje && fijarNodo(viaje.path, (viaje.path || []).length - 1, destino)) tocado = true;
      owner[rec.balon_id] = rec.jugador_id || null;
      if (destino) B[rec.balon_id] = { ...destino };
    }

    // 5) el balón que alguien lleva y no ha viajado, va con su portador
    for (const b of anim.balones || []) {
      const o = owner[b.id];
      const viajo = (fase.movimientos || []).some((m) => m.tipo_elemento === 'balon' && m.elemento_id === b.id)
        || (fase.pases || []).some((p) => p.balon_id === b.id)
        || (fase.tiros || []).some((t) => t.balon_id === b.id);
      if (o && !viajo && P[o]) B[b.id] = { ...P[o] };
    }
  }

  return tocado;
}

/** Índices de un path que NO puede tocar el ratón: son consecuencia de
 *  dónde están las fichas, y reanclarPaths los va a devolver a su sitio.
 *  Lo usa el editor para no dejar arrastrar lo que no se puede mover. */
export function nodosFijos(tipoFlecha, nNodos) {
  const fijos = new Set([0]);                       // el origen, siempre
  if (tipoFlecha === 'pass' && nNodos > 1) fijos.add(nNodos - 1);  // y el receptor
  return fijos;
}
