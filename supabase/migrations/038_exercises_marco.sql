-- ============================================================
-- 038_exercises_marco.sql — saber en qué dibujo está cada ejercicio.
--
-- ── EL AGUJERO ──────────────────────────────────────────────
-- `exercises.animacion` guarda TODAS las coordenadas de una ficha
-- —posiciones, conos, trayectorias, pases, tiros y los tiradores del
-- bezier— en normalizado, o sea relativas al lienzo. Cuando el lienzo
-- cambia, cambian de sitio.
--
-- La 019 le puso a `posiciones_pista` una columna `marco` justo por
-- esto, y gracias a ella la 037 ha podido convertir solo lo que hacía
-- falta. `exercises` no la tiene. Con los SVG nuevos hay 223 fichas en
-- la base cuyas coordenadas están sobre el dibujo anterior y NO hay
-- forma de distinguir las convertidas de las que no.
--
-- Sin esa columna, la única defensa contra convertir dos veces sería
-- un fichero suelto en el portátil de quien lo lance. Aplicar el mapa
-- dos veces mueve todo el doble y no hay vuelta atrás.
--
-- ── QUÉ HACE ────────────────────────────────────────────────
-- Añade `marco`, marca lo que YA existe como marco 2 —que es donde
-- está— y deja el 3 por defecto, para que todo lo que se dibuje a
-- partir de ahora nazca etiquetado en el dibujo que se está viendo.
--
-- Después:
--   · las 204 de la biblioteca se rehacen desde la fuente
--     (tools/biblioteca/importar.mjs --actualizar --confirmar),
--     que ya escribe marco = 3;
--   · las 19 que creó el entrenador en la app las convierte
--     tools/biblioteca/migrar-marco-3-base.mjs, que solo toca
--     `marco = 2` y las deja en 3.
--
-- Idempotente. Depende de: 001, 002.
-- ============================================================

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS marco smallint NOT NULL DEFAULT 2;

/* Lo que ya estaba, estaba en el 2. La columna nace con DEFAULT 2 para
   que el ADD COLUMN rellene las filas existentes con el valor correcto
   de una sola pasada; el DEFAULT se cambia al 3 justo después, cuando
   ya no queda ninguna fila sin marcar. */
ALTER TABLE public.exercises ALTER COLUMN marco SET DEFAULT 3;

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_marco_valido;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_marco_valido CHECK (marco IN (1, 2, 3));

COMMENT ON COLUMN public.exercises.marco IS
  'Dibujo de pista sobre el que están las coordenadas de `animacion`. 2 = pistas generadas a medidas FIBA; 3 = las que dibujó el entrenador a mano, que son las que hay. Sin esto no se puede saber qué falta por convertir, y convertir dos veces mueve todo el doble (038).';

-- ── Y se dice cómo ha quedado ───────────────────────────────
SELECT marco, count(*) AS ejercicios
  FROM public.exercises
 GROUP BY marco
 ORDER BY marco;
