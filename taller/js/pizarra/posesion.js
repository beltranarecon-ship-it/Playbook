/* ============================================================
   pizarra/posesion.js — de quién es cada balón al acabar una fase.

   Módulo PURO: sin DOM, sin canvas. Lo prueban en Node
   taller/tools/eval-fases.mjs (que lo reexporta) y eval-defensa.mjs.

   ── POR QUÉ ESTÁ SOLO EN SU FICHERO ─────────────────────────
   Esta cuenta la necesitan dos que no se pueden conocer: las fases
   (para colocar las fichas al volver a una fase anterior) y la defensa
   (para saber quién ataca en la siguiente, §8.6). Dejándola en fases.js
   se cerraba un círculo —defensa → fases → destino → defensa— que el
   navegador resuelve leyendo constantes a medio construir: la primera
   vez que se abría la Pizarra reventaba con «Cannot access PARAMETROS
   before initialization».

   Así que vive aquí, sin importar nada, y la reexporta quien la tenía.
   ============================================================ */

/**
 * De quién es cada balón AL ACABAR la fase `hasta`, repasando lo
 * dibujado desde el principio.
 *
 * El modelo solo sabe de quién es AHORA —lo último que se dibujó—, y al
 * volver a una fase anterior eso ya no vale.
 *
 * Cuentan tres cosas:
 *   · un pase o un tiro (el balón viaja): pasa a ser del receptor, o de
 *     nadie si va al aro;
 *   · una recogida (`balon_id`): pasa a ser del que lo recoge;
 *   · un ROBO declarado (§8.6): el que roba se queda el balón del
 *     robado. Va después de los tramos de la fase, porque el robo pasa
 *     mientras el otro lo lleva y lo que el robado tuviera dibujado
 *     después ya no encaja.
 *
 * @param fases    las de la jugada (§11.1)
 * @param hasta    índice de la última fase que cuenta
 * @param inicial  { [balon]: jugador|null } al empezar la jugada
 */
export function posesionAlFinal(fases, hasta, inicial = {}) {
  const duenos = { ...inicial };
  const lista = fases || [];
  for (let i = 0; i <= hasta && i < lista.length; i++) {
    for (const t of (lista[i] && lista[i].tramos) || []) {
      if (!t) continue;
      if (t.corre_id && t.corre_id !== t.elemento_id && t.corre_id in duenos) duenos[t.corre_id] = t.receptor_id || null;
      if (t.balon_id) duenos[t.balon_id] = t.elemento_id;
    }
    for (const [quien, a] of Object.entries((lista[i] && lista[i].defensa) || {})) {
      if (!a || a.accion !== 'roba' || !a.objetivo_id) continue;
      for (const b of Object.keys(duenos)) if (duenos[b] === a.objetivo_id) duenos[b] = quien;
    }
  }
  return duenos;
}
