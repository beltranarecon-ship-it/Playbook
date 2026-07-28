-- ============================================================
-- 012_exercise_intensidad.sql — Intensidad física por ejercicio.
-- Módulo Sesiones · M4.
--   · intensidad 1-5 = carga FÍSICA (distinta de `difficulty`, que es
--     dificultad TÉCNICA 1-6). Alimenta la curva de carga de la sesión.
--   · Es un DEFAULT de biblioteca: el valor real de cada bloque se fija
--     (y se puede sobreescribir) en session_blocks (013). Un mismo
--     ejercicio puede correrse a distinta intensidad según cómo se use.
--   · NO se hace backfill desde `difficulty`: son ejes distintos (técnico
--     vs físico); rellenarlo mecánicamente daría cargas falsas. Se deja
--     NULL = "sin fijar"; el planificador arranca cada bloque en 3.
-- Idempotente. Depende de: 001/002 (exercises).
-- ============================================================

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS intensidad smallint;

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_intensidad_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_intensidad_check
  CHECK (intensidad IS NULL OR intensidad BETWEEN 1 AND 5);

COMMENT ON COLUMN public.exercises.intensidad IS
  'Intensidad física por defecto 1-5 (carga). NULL = sin fijar; el planificador de sesión usa 3. El valor real por uso vive en session_blocks.intensidad (013).';
