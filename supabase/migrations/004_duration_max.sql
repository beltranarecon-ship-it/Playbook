-- ============================================================
-- Playbook CBP — Migración 004 (Taller: duración mín.–máx.)
-- La "Duración estimada" pasa de un valor único a un rango con dos
-- extremos. duration_min ya existe (001); añadimos duration_max.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS duration_max smallint;

-- duration_max, si está, debe ser >= duration_min (ambos opcionales).
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_duration_range_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_duration_range_check
  CHECK (duration_max IS NULL OR duration_min IS NULL OR duration_max >= duration_min);

-- Backfill: ejercicios antiguos con un único valor pasan a un rango degenerado
-- (máx = mín) para que la ficha muestre "X min" en vez de quedar sin máximo.
UPDATE public.exercises
  SET duration_max = duration_min
  WHERE duration_max IS NULL AND duration_min IS NOT NULL;
