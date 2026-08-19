-- ============================================================
-- 027_reflexion.sql — Esfuerzo obligatorio y preguntas de jugador
-- (Tramo 3.11).
--
-- TRES CAMBIOS
--
--   1. `esfuerzo` pasa a ser clave reservada, como `cumplimiento`:
--      estrellas 1–5 y obligatoria al cerrar (decisión #20). Lo de
--      «obligatoria» lo hace la pantalla —una sesión a medio cerrar no
--      se puede rechazar en la base de datos sin dejar al entrenador
--      con el trabajo hecho y sin poder guardarlo—, pero la clave se
--      reserva aquí para que nadie la use para otra cosa.
--
--   2. `cumplimiento` se JUBILA. Desde la decisión #26 el cumplimiento
--      se mide por movimiento de rúbrica (3.9), no por lo que declare
--      el entrenador. Las preguntas existentes se desactivan; NO se
--      borran, y las respuestas ya dadas se quedan donde están: es
--      histórico, y `v_session_cumplimiento` sigue en pie para lo que
--      ya se contestó.
--
--   3. Preguntas de JUGADOR. Una pregunta puede ser del equipo (como
--      hasta ahora) o de un jugador — «¿cómo ha ido con X?» — y en ese
--      caso se contesta **de quien se quiera, no de todos**: ese es el
--      criterio de la fila. Para eso la respuesta necesita saber de
--      quién es, y la clave primaria deja de ser (sesión, clave).
--
-- POR QUÉ LA PK CAMBIA Y NO SE AÑADE UNA TABLA
-- Porque una respuesta individual es una respuesta: misma etiqueta,
-- mismo tipo, mismo congelado de la clave, mismos disparadores. Lo
-- único que cambia es que además tiene jugador. Una tabla paralela
-- duplicaría el congelado —que es lo delicado de este módulo— y
-- tendría que mantenerse a la par con esta para siempre.
--
-- La PK pasa a (session_id, clave_snapshot, player_id) con player_id
-- NULL para las del equipo. En Postgres NULL no es igual a NULL en un
-- índice único, así que la unicidad de las del equipo se garantiza con
-- un índice PARCIAL aparte.
--
-- Idempotente. Depende de: 015 (reflection).
-- ============================================================

-- ── 1. La clave reservada del esfuerzo ──────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reflection_questions'::regclass
      AND conname = 'reflection_questions_cumplimiento_estrellas'
  ) THEN
    ALTER TABLE public.reflection_questions
      DROP CONSTRAINT reflection_questions_cumplimiento_estrellas;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reflection_questions_reservadas') THEN
    ALTER TABLE public.reflection_questions
      ADD CONSTRAINT reflection_questions_reservadas
      CHECK (clave NOT IN ('cumplimiento', 'esfuerzo') OR tipo = 'estrellas');
  END IF;
END $$;

-- ── 2. Preguntas de jugador ─────────────────────────────────
ALTER TABLE public.reflection_questions
  ADD COLUMN IF NOT EXISTS ambito text NOT NULL DEFAULT 'equipo';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reflection_questions_ambito') THEN
    ALTER TABLE public.reflection_questions
      ADD CONSTRAINT reflection_questions_ambito CHECK (ambito IN ('equipo', 'jugador'));
  END IF;
END $$;

COMMENT ON COLUMN public.reflection_questions.ambito IS
  'equipo (una respuesta por sesión) | jugador (una por jugador, y solo de quien se quiera) — Tramo 3.11.';

-- ── 3. La respuesta sabe de quién es ────────────────────────
ALTER TABLE public.reflection_answers
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE CASCADE;

DO $$
BEGIN
  -- la PK vieja (session_id, clave_snapshot) impide dos respuestas de
  -- la misma pregunta para dos jugadores distintos
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reflection_answers'::regclass AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (session_id, clave_snapshot)'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE public.reflection_answers DROP CONSTRAINT %I', conname)
      FROM pg_constraint
      WHERE conrelid = 'public.reflection_answers'::regclass AND contype = 'p'
    );
    ALTER TABLE public.reflection_answers
      ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE public.reflection_answers ADD PRIMARY KEY (id);
  END IF;
END $$;

/* Una respuesta por sesión y pregunta: dos índices parciales porque en
   un único NULL no colisiona con NULL, y sin esto se podrían meter dos
   respuestas de equipo de la misma pregunta. */
CREATE UNIQUE INDEX IF NOT EXISTS reflection_answers_equipo
  ON public.reflection_answers (session_id, clave_snapshot)
  WHERE player_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reflection_answers_jugador
  ON public.reflection_answers (session_id, clave_snapshot, player_id)
  WHERE player_id IS NOT NULL;

COMMENT ON COLUMN public.reflection_answers.player_id IS
  'De quién es la respuesta (Tramo 3.11). NULL = del equipo.';

-- ── 4. Jubilar el cumplimiento autodeclarado (§7) ───────────
/* Se DESACTIVAN, no se borran: lo ya contestado es histórico y
   `v_session_cumplimiento` sigue leyéndolo. Lo que deja de pasar es
   que se pregunte. */
UPDATE public.reflection_questions
   SET activa = false
 WHERE clave = 'cumplimiento' AND activa;

-- Y el esfuerzo entra en la plantilla de todos los equipos, primero.
INSERT INTO public.reflection_questions (team_id, clave, etiqueta, tipo, orden, ambito)
SELECT t.id, 'esfuerzo', '¿Cómo han trabajado hoy?', 'estrellas', -1, 'equipo'
  FROM public.teams t
ON CONFLICT (team_id, clave) DO NOTHING;
