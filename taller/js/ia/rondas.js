/* ============================================================
   ia/rondas.js — filas que generan jugadores (Tramo 2.8).
   Módulo PURO: sin DOM, sin red.

   ── EL PROBLEMA ─────────────────────────────────────────────
   Media biblioteca son ejercicios de fila: seis críos en una cola,
   sale el primero, hace algo, vuelve, sale el siguiente. Hasta ahora
   la animación enseñaba UNA salida y se acababa. Para ver la segunda
   había que escribirla entera a mano, con otro id, repitiendo los
   mismos eventos. Nadie lo hacía, así que las fichas prometían una
   rueda y dibujaban un turno suelto.

   ── LO QUE HACE ─────────────────────────────────────────────
   Se describe UNA ronda y aquí se repite, con el siguiente de la
   cola, hasta que han salido todos. Cada fase de salida lleva su
   número de ronda, que es lo que deja al proyector decir «2 de 6» y
   saltar a la siguiente.

   ── POR QUÉ SE REPITE LA GEOMETRÍA Y NO SE RECOMPILA ────────
   Porque todas las rondas hacen LO MISMO desde el MISMO sitio: el
   siguiente sale del mismo cono y recorre el mismo camino. La
   geometría de la ronda 2 es la de la ronda 1 con otro actor. Volver
   a compilar daría exactamente lo mismo, con la diferencia de que
   podría no darlo —si algo del compilador dependiera del estado
   acumulado— y ahí ya no habría forma de comprobarlo.

   ── LA CADENCIA ─────────────────────────────────────────────
   En blanco, el siguiente sale cuando el anterior termina. Con valor
   (en segundos), las rondas se solapan: la ronda k arranca k×cadencia
   después de la primera. El solape se resuelve por FASES, no al
   milisegundo: una fase es la unidad que el motor sabe reproducir, y
   trocearla para clavar la cadencia daría fases de 200 ms que no se
   ven. Se redondea a la fase más cercana y se dice aquí.
   ============================================================ */

/** Duración de una fase, pausa incluida. */
const duracionDe = (f) => (f.duracion_ms || 0) + (f.pausa_post_ms || 0);

/**
 * Cambia el id de un actor en todas las referencias de una fase.
 * Las claves son las que emite el compilador; si mañana añade otra,
 * el banco de pruebas lo dice antes de que se pierda un movimiento.
 */
function sustituirActor(fase, de, a) {
  const id = (v) => (v === de ? a : v);
  return {
    ...fase,
    movimientos: (fase.movimientos || []).map((m) => ({ ...m, elemento_id: id(m.elemento_id) })),
    pases: (fase.pases || []).map((p) => ({ ...p, de_id: id(p.de_id), a_id: id(p.a_id) })),
    tiros: (fase.tiros || []).map((t) => ({ ...t, jugador_id: id(t.jugador_id) })),
    recogidas: (fase.recogidas || []).map((r) => ({ ...r, jugador_id: id(r.jugador_id) })),
    bloqueos: (fase.bloqueos || []).map((b) => ({
      ...b, bloqueador_id: id(b.bloqueador_id), bloqueado_id: id(b.bloqueado_id),
    })),
    defensores: (fase.defensores || []).map(id),
  };
}

/** Une dos fases que caen en el mismo hueco de tiempo. */
function fundir(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    ...a,
    // manda la más larga: si una ronda está tirando y otra corriendo,
    // cortar por la corta dejaría el tiro a medias
    duracion_ms: Math.max(a.duracion_ms || 0, b.duracion_ms || 0),
    pausa_post_ms: Math.max(a.pausa_post_ms || 0, b.pausa_post_ms || 0),
    movimientos: [...(a.movimientos || []), ...(b.movimientos || [])],
    pases: [...(a.pases || []), ...(b.pases || [])],
    tiros: [...(a.tiros || []), ...(b.tiros || [])],
    recogidas: [...(a.recogidas || []), ...(b.recogidas || [])],
    bloqueos: [...(a.bloqueos || []), ...(b.bloqueos || [])],
    defensores: [...new Set([...(a.defensores || []), ...(b.defensores || [])])],
    // Con cadencia, en un mismo hueco pueden estar entrando uno y
    // tirando otro: las dos acciones ocurren, así que las dos cuentan
    // para el vídeo (Tramo 2.14).
    acciones: [...new Set([...(a.acciones || []), ...(b.acciones || [])])],
  };
}

/**
 * Cuántas fases se retrasa cada ronda respecto a la anterior.
 * Sin cadencia, una ronda entera (el siguiente sale cuando el anterior
 * termina). Con cadencia, lo que quepa en esos segundos, y nunca menos
 * de una fase: dos rondas exactamente a la vez no son dos rondas.
 */
export function desfaseEnFases(fases, cadenciaSegundos) {
  const n = fases.length;
  if (!n) return 0;
  if (!Number.isFinite(cadenciaSegundos) || cadenciaSegundos <= 0) return n;
  const media = fases.reduce((s, f) => s + duracionDe(f), 0) / n;
  if (media <= 0) return n;
  return Math.max(1, Math.min(n, Math.round((cadenciaSegundos * 1000) / media)));
}

/**
 * Repite las fases de una ronda para cada actor de la cola.
 *
 * @param fases     las fases de la RONDA 1, ya compiladas
 * @param opciones.actor      id del que sale en la ronda 1 ('fila1')
 * @param opciones.siguientes ids del resto, en orden ('fila1_2', …)
 * @param opciones.cadencia_s segundos entre salidas; null = en fila
 * @returns { fases, rondas } — cada fase lleva `ronda` (1..n)
 */
export function expandirRondas(fases, opciones = {}) {
  const base = Array.isArray(fases) ? fases : [];
  const { actor, siguientes = [], cadencia_s = null } = opciones;
  const actores = [actor, ...siguientes].filter(Boolean);

  if (!base.length || actores.length < 2) {
    return { fases: base.map((f) => ({ ...f, ronda: 1 })), rondas: Math.max(1, base.length ? 1 : 0) };
  }

  const desfase = desfaseEnFases(base, cadencia_s);
  const salida = [];
  actores.forEach((quien, r) => {
    const inicio = r * desfase;
    base.forEach((f, i) => {
      const slot = inicio + i;
      // La ronda 1 también pasa por `sustituirActor` (cambiando el actor
      // por sí mismo). Es un rodeo aparente y evita una incoherencia
      // real: con `{...f}` la ronda 1 conservaría las listas que le
      // falten a la entrada, mientras que las demás las tendrían — y una
      // animación en la que la fase 1 no tiene `pases` y la 4 sí revienta
      // en el primer sitio que las recorra sin comprobar.
      const fase = sustituirActor(f, actor, quien);
      // La ronda de una fase es la de la PRIMERA que la ocupó: con
      // solape, «2 de 6» significa «va saliendo el segundo», no «hay
      // dos a la vez».
      salida[slot] = salida[slot] ? fundir(salida[slot], fase) : { ...fase, ronda: r + 1 };
    });
  });

  return {
    fases: salida.map((f, i) => ({ ...f, id: `fase_${i + 1}` })),
    rondas: actores.length,
  };
}

/**
 * El balón no se teletransporta entre rondas.
 *
 * Al acabar una ronda el balón está donde lo dejó quien salió —en la
 * cola, si volvió con él—, y la ronda siguiente arranca con el balón
 * ya en manos del que sale. Sin este tramo, salta de un fotograma al
 * siguiente de un lado a otro de la pista.
 *
 * Devuelve los movimientos de entrega que hay que añadir al principio
 * de cada ronda, o [] si el balón ya estaba donde tenía que estar.
 */
export function entregasEntreRondas(fases, opciones = {}) {
  const { inicioDe = null, umbral = 0.01 } = opciones;
  if (typeof inicioDe !== 'function') return [];
  const entregas = [];
  let rondaVista = 1;
  let ultimoBalon = null;

  for (let i = 0; i < fases.length; i++) {
    const f = fases[i];
    // último sitio conocido de cada balón en esta fase
    for (const m of f.movimientos || []) {
      if (m.tipo_elemento === 'balon' && m.path?.length) ultimoBalon = { id: m.elemento_id, ...m.path[m.path.length - 1] };
    }
    for (const t of f.tiros || []) {
      if (t.path?.length) ultimoBalon = { id: t.balon_id, ...t.path[t.path.length - 1] };
    }
    for (const p of f.pases || []) {
      if (p.path?.length) ultimoBalon = { id: p.balon_id, ...p.path[p.path.length - 1] };
    }

    const siguiente = fases[i + 1];
    if (!siguiente || siguiente.ronda === rondaVista) continue;
    rondaVista = siguiente.ronda;
    if (!ultimoBalon) continue;
    const destino = inicioDe(siguiente.ronda);
    if (!destino) continue;
    const d = Math.hypot(destino.x - ultimoBalon.x, destino.y - ultimoBalon.y);
    if (d <= umbral) continue;
    entregas.push({
      fase: i + 1,
      movimiento: {
        elemento_id: ultimoBalon.id, tipo_elemento: 'balon', tipo_movimiento: 'recogida',
        path: [
          { x: ultimoBalon.x, y: ultimoBalon.y, tipo_nodo: 'lineal' },
          { x: destino.x, y: destino.y, tipo_nodo: 'lineal' },
        ],
      },
    });
    ultimoBalon = { id: ultimoBalon.id, x: destino.x, y: destino.y };
  }
  return entregas;
}

/** Las fases de la primera ronda: es lo que van a enseñar la miniatura y el guion. */
export function soloPrimeraRonda(fases) {
  const conRonda = (fases || []).filter((f) => f.ronda != null);
  return conRonda.length ? conRonda.filter((f) => f.ronda === 1) : (fases || []);
}
