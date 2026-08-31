-- ============================================================
-- 040_tiempo_perdido.sql — el tiempo que se fue sin entrenar.
--
-- ── POR QUÉ HACEN FALTA DOS NÚMEROS Y NO UNO ────────────────
-- La pantalla de sesión activa (Tramo 3.5) ya guarda
-- `duracion_real_min`: lo que de verdad duró cada bloque. De ahí sale
-- la duración que se le propone después al ejercicio en la biblioteca
-- (fila 3.6), así que ese número tiene que ser TIEMPO ENTRENADO.
--
-- Pero el reloj del entrenamiento sitúa cada bloque sumando lo que
-- ocuparon los anteriores. Si los diez minutos que se pasaron
-- esperando a que se fuera el otro equipo se descontaran de ahí, todos
-- los bloques siguientes empezarían diez minutos antes de lo que
-- marca el reloj de pared, y la cuenta atrás mentiría el resto del
-- entrenamiento.
--
-- Por eso se separan:
--   · `duracion_real_min`   lo que se entrenó → alimenta la ficha
--   · `tiempo_perdido_min`  lo que se perdió  → sitúa el reloj
--     (un bloque ocupó de pista real + perdido)
--
-- `motivo_perdido` es opcional a propósito: en mitad del pabellón se
-- pausa con el pulgar y se escribe el motivo si da tiempo. Obligarlo
-- haría que no se pausara.
--
-- ── QUÉ HACE ────────────────────────────────────────────────
-- Dos columnas nuevas, ambas nulas. NULL significa «no se pausó», que
-- es distinto de «se pausó cero minutos» y es lo que había en todos
-- los entrenamientos anteriores a esta migración.
--
-- El front degrada solo si esto no se ha aplicado (equipos/js/data/
-- blocks.js, COLS_NUEVAS): se puede pausar igual, pero lo pausado no
-- queda escrito.
--
-- Idempotente. Depende de: 013.
-- ============================================================

ALTER TABLE public.session_blocks
  ADD COLUMN IF NOT EXISTS tiempo_perdido_min smallint,
  ADD COLUMN IF NOT EXISTS motivo_perdido text;

COMMENT ON COLUMN public.session_blocks.tiempo_perdido_min IS
  'Minutos que el bloque estuvo en pausa. Ocupan pista pero NO son tiempo entrenado: la duracion que alimenta la ficha del ejercicio es duracion_real_min. NULL = no se pauso.';
COMMENT ON COLUMN public.session_blocks.motivo_perdido IS
  'Por que se paro, escrito por el entrenador. Opcional: en el pabellon se pausa con el pulgar y se explica si da tiempo.';

/* Un motivo sin tiempo perdido no dice nada, y un tiempo perdido
   negativo no existe. Se comprueba aqui porque es lo unico que puede
   defender la tabla de un front con un fallo. */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_blocks_perdido_coherente'
      AND conrelid = 'public.session_blocks'::regclass
  ) THEN
    ALTER TABLE public.session_blocks
      ADD CONSTRAINT session_blocks_perdido_coherente
      CHECK (
        (tiempo_perdido_min IS NULL OR tiempo_perdido_min >= 0)
        AND (motivo_perdido IS NULL OR tiempo_perdido_min IS NOT NULL)
      );
  END IF;
END $$;

/* ── COMPROBACIÓN ────────────────────────────────────────────
   Tiene que devolver las dos columnas y la restricción:

     SELECT column_name FROM information_schema.columns
      WHERE table_name = 'session_blocks'
        AND column_name IN ('tiempo_perdido_min', 'motivo_perdido');

     SELECT conname FROM pg_constraint
      WHERE conname = 'session_blocks_perdido_coherente';
   ============================================================ */
