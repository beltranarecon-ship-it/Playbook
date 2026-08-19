-- ============================================================
-- 023_sesion_activa.sql — Lo que se apunta DURANTE el entrenamiento
-- (Tramo 3.5).
--
-- QUÉ RESUELVE
-- El criterio de la fila es «un entrenamiento entero se da sin apuntar
-- nada después». Para eso hacen falta tres sitios donde escribir en
-- caliente, con el móvil en una mano y un balón en la otra:
--
--   1. `session_blocks.duracion_real_min` — lo que de verdad duró el
--      bloque, no lo que se planificó. De ahí sale la duración
--      estimada del ejercicio la próxima vez (fila 3.6).
--   2. `session_blocks.no_funciono` — «este ejercicio no ha
--      funcionado». Se marca en el momento, que es cuando se sabe;
--      dos días después ya nadie se acuerda de cuál era.
--   3. `session_stars` — la estrella rápida a un jugador. Es la capa
--      de «un toque» de la progresión individual (§5.7): no cuesta
--      nada y es lo único que se va a apuntar de verdad los días que
--      no dé tiempo a la rúbrica.
--
-- LA NOTA CORTA no necesita nada nuevo: es `session_blocks.notas`, que
-- ya existe desde 013 y ya se escribe desde el visor.
--
-- POR QUÉ LA ESTRELLA NO ES UNA COLUMNA DE `attendance`
-- Porque no es una propiedad del jugador en la sesión, es un HECHO con
-- su momento: «en el 3c3, el 7 hizo algo que hay que recordar». Puede
-- haber varias en una sesión y cada una cuelga de su bloque. En una
-- columna solo cabría la última, y sin saber de qué ejercicio.
--
-- QUIÉN PUEDE QUÉ
-- Manda la sesión: quien puede ver la sesión ve sus estrellas, y quien
-- puede editarla las pone. Se apoya en las mismas funciones de 010/013
-- para no tener dos definiciones de «este equipo es mío».
--
-- Idempotente. Depende de: 010 (sessions), 013 (session_blocks),
-- 014 (players/attendance).
-- ============================================================

-- ── 1. Lo que de verdad duró, y lo que no funcionó ──────────
ALTER TABLE public.session_blocks
  ADD COLUMN IF NOT EXISTS duracion_real_min smallint,
  ADD COLUMN IF NOT EXISTS no_funciono boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_blocks_real_positiva') THEN
    ALTER TABLE public.session_blocks
      ADD CONSTRAINT session_blocks_real_positiva
      CHECK (duracion_real_min IS NULL OR duracion_real_min BETWEEN 0 AND 300);
  END IF;
END $$;

COMMENT ON COLUMN public.session_blocks.duracion_real_min IS
  'Minutos que de verdad duró el bloque (Tramo 3.5). Alimenta la duración estimada del ejercicio (3.6).';
COMMENT ON COLUMN public.session_blocks.no_funciono IS
  'Marcado en caliente: este ejercicio no ha funcionado (Tramo 3.5).';

-- ── 2. La estrella rápida ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_stars (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  -- de qué bloque salió. Puede quedarse en null: una estrella puesta
  -- entre bloques sigue valiendo, y perderla por no saber dónde
  -- colocarla sería tirar justo lo que se quería apuntar.
  block_id   uuid REFERENCES public.session_blocks(id) ON DELETE SET NULL,
  nota       text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_stars ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS session_stars_sesion ON public.session_stars (session_id);
CREATE INDEX IF NOT EXISTS session_stars_jugador ON public.session_stars (player_id, created_at DESC);

/* Manda la sesión: si la ves, ves sus estrellas; si la editas, las
   pones. Se comprueba contra `sessions` para no tener dos definiciones
   de «este equipo es mío». */
DROP POLICY IF EXISTS "session_stars: lectura por sesión" ON public.session_stars;
CREATE POLICY "session_stars: lectura por sesión" ON public.session_stars
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id));

DROP POLICY IF EXISTS "session_stars: alta por sesión" ON public.session_stars;
CREATE POLICY "session_stars: alta por sesión" ON public.session_stars
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id));

DROP POLICY IF EXISTS "session_stars: borrado por sesión" ON public.session_stars;
CREATE POLICY "session_stars: borrado por sesión" ON public.session_stars
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id));

-- Sella la autoría, como en el resto de tablas con `created_by`.
CREATE OR REPLACE FUNCTION public.session_stars_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.session_stars_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS session_stars_guard ON public.session_stars;
CREATE TRIGGER session_stars_guard
  BEFORE INSERT ON public.session_stars
  FOR EACH ROW EXECUTE FUNCTION public.session_stars_guard();
