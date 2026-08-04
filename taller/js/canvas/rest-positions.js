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

/** starts[k] = { P: {jugadorId:{x,y}}, B: {balonId:{x,y}} } al INICIO de la fase k. */
export function restPositions(anim) {
  const P = {}, B = {}, owner = {};
  for (const j of anim.jugadores || []) P[j.id] = j.posicion_inicial ? { x: j.posicion_inicial[0], y: j.posicion_inicial[1] } : { x: 0.5, y: 0.5 };
  for (const b of anim.balones || []) { B[b.id] = b.posicion_inicial ? { x: b.posicion_inicial[0], y: b.posicion_inicial[1] } : { x: 0.5, y: 0.5 }; owner[b.id] = b.portador_id || null; }
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
