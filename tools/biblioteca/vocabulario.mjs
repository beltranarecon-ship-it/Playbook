/* ============================================================
   vocabulario.mjs — el vocabulario compartido, ahora en la app.

   Se mudó a `taller/js/ia/vocabulario.js` en el Tramo 2.12. No es un
   detalle de organización: §3 dice que una misma palabra —«bote con
   cambio de mano», «entrada»— es a la vez pieza del catálogo del paso
   2, etiqueta del ejercicio, diana de un objetivo y fila de la
   rúbrica. Eso es de la app, no de sus herramientas; y el paso 3
   necesita estas listas para pintar sus chips.

   Este fichero se queda como puerta, para que las tandas y el resto
   de herramientas sigan importando de donde siempre.
   ============================================================ */

export * from '../../taller/js/ia/vocabulario.js';
