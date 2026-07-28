-- ============================================================
-- Playbook CBP — Migración 002 (Taller de ejercicios §13)
-- Extiende public.exercises (creada en cbp-v2/001) con los campos
-- que necesita el Taller, sin romper la biblioteca de la Fase 1.
-- Idempotente: se puede ejecutar más de una vez sin error.
-- Ejecútala en el MISMO proyecto Supabase de cbp-v2.
-- ============================================================

-- 1) Relajar restricciones de la Fase 1 que chocan con la taxonomía
--    del Taller (tipo: Tiro/Bote/1vs1...; dificultad 1–6).
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_type_check;
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_difficulty_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_difficulty_check
  CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 6);

-- 2) Columnas nuevas del Taller (§13)
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS animacion             jsonb,
  ADD COLUMN IF NOT EXISTS tipo_pista            text,
  ADD COLUMN IF NOT EXISTS categoria_rama        text,
  ADD COLUMN IF NOT EXISTS categoria_nivel       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dificultad_label      text,
  ADD COLUMN IF NOT EXISTS autor_nombre          text,
  ADD COLUMN IF NOT EXISTS objetivo_temporada_id uuid,
  ADD COLUMN IF NOT EXISTS objetivos             text,
  ADD COLUMN IF NOT EXISTS variantes             text,
  ADD COLUMN IF NOT EXISTS notas                 text,
  ADD COLUMN IF NOT EXISTS descripcion_texto     text,
  ADD COLUMN IF NOT EXISTS requisitos            jsonb,
  ADD COLUMN IF NOT EXISTS favorito              boolean NOT NULL DEFAULT false;

-- 3) Índices útiles para la biblioteca y los favoritos
CREATE INDEX IF NOT EXISTS exercises_favorito ON public.exercises (favorito) WHERE favorito = true;
CREATE INDEX IF NOT EXISTS exercises_categoria_rama ON public.exercises (categoria_rama);

-- Las políticas RLS de 001 ya cubren el Taller:
--   · "exercises: coach crea sus propios"  (INSERT con created_by = auth.uid())
--   · "exercises: coach edita los suyos"   (UPDATE)
--   · "exercises: lectura para autenticados"
-- No hace falta nada más para guardar desde el Taller.
