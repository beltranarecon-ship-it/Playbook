/* ============================================================
   pizarra/motor/rondas.js — leer las rondas de lo guardado (§11.4).

   Módulo PURO y sin dependencias. Lo prueba en Node
   taller/tools/eval-rondas.mjs.

   ── QUÉ QUEDA AQUÍ, Y QUÉ NO ────────────────────────────────
   Viene de `ia/rondas.js`, del motor viejo, que sabía repetir una fila
   entera: expandir las rondas, desfasarlas con una cadencia y entregar
   el balón de una a la siguiente. Eso NO se muda: la Pizarra lo rehace
   en su capa 6 (§7.4.2 — número, cadencia y variación por ronda) con
   carriles, no repitiendo fases, así que copiarlo aquí sería guardar
   una segunda verdad que nadie va a mantener.

   Lo que sí sigue haciendo falta es LEER una animación que ya traiga
   rondas —las que se guardaron antes de la Pizarra— para no contarlas
   seis veces: la miniatura y el guion del planificador enseñan una.
   ============================================================ */

/* Lo que la Pizarra marca como de otra ronda dentro de una fase. */
const LISTAS = ['movimientos', 'pases', 'tiros', 'recogidas', 'bloqueos'];
const deLaPrimera = (x) => !(x && x.repeticion >= 1);

/** Las fases de la primera ronda: es lo que van a enseñar la miniatura
 *  y el guion. Una animación sin rondas se devuelve entera.
 *
 *  Las rondas vienen de dos maneras: las guardadas antes de la Pizarra
 *  repetían FASES (`fase.ronda`), y las de la Pizarra van DENTRO de cada
 *  fase, con lo de cada repetición marcado (`repeticion`, §7.4.2). */
export function soloPrimeraRonda(fases) {
  const conRonda = (fases || []).filter((f) => f.ronda != null);
  const primeras = conRonda.length ? conRonda.filter((f) => f.ronda === 1) : (fases || []);
  return primeras.map((f) => {
    if (!f || !LISTAS.some((k) => Array.isArray(f[k]) && !f[k].every(deLaPrimera))) return f;
    const limpia = { ...f };
    for (const k of LISTAS) if (Array.isArray(f[k])) limpia[k] = f[k].filter(deLaPrimera);
    return limpia;
  });
}
