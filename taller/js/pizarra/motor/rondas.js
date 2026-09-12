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

/** Las fases de la primera ronda: es lo que van a enseñar la miniatura
 *  y el guion. Una animación sin rondas se devuelve entera. */
export function soloPrimeraRonda(fases) {
  const conRonda = (fases || []).filter((f) => f.ronda != null);
  return conRonda.length ? conRonda.filter((f) => f.ronda === 1) : (fases || []);
}
