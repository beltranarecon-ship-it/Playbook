-- ============================================================
-- 022_video_bloque.sql — Vídeo en un bloque libre, guardable y
-- reutilizable (Tramo 3.3).
--
-- QUÉ RESUELVE
-- Un bloque libre es lo que no sale de la biblioteca: una charla, un
-- juego, "ver la jugada del sábado". Ese último caso no se podía
-- montar: el vídeo se mandaba por WhatsApp antes del entrenamiento y
-- en la pista había que buscarlo otra vez.
--
-- Ahora el bloque lleva su vídeo, y el vídeo se puede GUARDAR con un
-- nombre para volver a ponerlo en otra sesión sin volver a buscar el
-- enlace. Eso es lo que pide la fila 3.3: guardable y reutilizable.
--
-- DOS COSAS, UNA MIGRACIÓN
--   1. `session_blocks.video` — el vídeo de ESTE bloque de ESTA sesión.
--   2. `videos_bloque` — la lista del club: los vídeos guardados con
--      nombre, para elegir uno en vez de pegar el enlace otra vez.
--
-- Van juntas porque son la misma función y por separado ninguna sirve:
-- sin la columna no hay dónde ponerlo, y sin la tabla no se reutiliza.
--
-- LA FORMA DEL JSON — la misma de 021 (taller/js/ia/video.js):
--   {"tipo":"youtube","id":"dQw4w9WgXcQ","desde":12,"hasta":19}
--   {"tipo":"tiktok","url":"https://www.tiktok.com/@x/video/123"}
--
-- POR QUÉ NO SE REUSA `videos_accion` (021)
-- Porque significan cosas distintas. Aquel cuelga de una ACCIÓN del
-- vocabulario —«así se hace una entrada»— y sale solo en el proyector
-- al llegar esa fase. Este es un TROZO DE SESIÓN que alguien decidió
-- poner un martes. Meterlos en la misma tabla obligaría a inventar un
-- campo para distinguirlos y a explicar por qué un vídeo de sesión
-- aparece en el catálogo de acciones.
--
-- QUIÉN PUEDE QUÉ
-- Mismo reparto que las acciones (decisión #4): cualquier entrenador
-- guarda un vídeo y lo ve TODO el club; cambiarlo o borrarlo, solo
-- quien lo guardó, o un administrador. La columna del bloque va con la
-- sesión: manda la RLS de `session_blocks`, que ya existe (013).
--
-- Idempotente. Depende de: 001 (profiles, current_user_role),
-- 013 (session_blocks).
-- ============================================================

-- ── 1. El vídeo de un bloque ────────────────────────────────
ALTER TABLE public.session_blocks
  ADD COLUMN IF NOT EXISTS video jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_blocks_video_forma'
  ) THEN
    ALTER TABLE public.session_blocks
      ADD CONSTRAINT session_blocks_video_forma
      CHECK (video IS NULL OR (jsonb_typeof(video) = 'object'
             AND video->>'tipo' IN ('youtube', 'tiktok')));
  END IF;
END $$;

COMMENT ON COLUMN public.session_blocks.video IS
  'Vídeo de un bloque libre (Tramo 3.3). Forma en taller/js/ia/video.js.';

-- ── 2. Los vídeos guardados del club ────────────────────────
CREATE TABLE IF NOT EXISTS public.videos_bloque (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- con qué nombre se reconoce en la lista. Es lo único que se lee al
  -- elegirlo, así que no puede estar vacío.
  titulo      text NOT NULL CHECK (length(btrim(titulo)) > 0),
  video       jsonb NOT NULL
              CHECK (jsonb_typeof(video) = 'object'
                     AND video->>'tipo' IN ('youtube', 'tiktok')),
  -- minutos que suele durar el bloque cuando se pone. Orientativo: al
  -- reutilizarlo se puede cambiar como en cualquier bloque.
  duracion_min smallint CHECK (duracion_min IS NULL OR duracion_min BETWEEN 1 AND 240),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.videos_bloque ENABLE ROW LEVEL SECURITY;

-- Consulta caliente: la lista entera, ordenada por nombre.
CREATE INDEX IF NOT EXISTS videos_bloque_titulo ON public.videos_bloque (titulo);

DROP POLICY IF EXISTS "videos_bloque: lectura para todos" ON public.videos_bloque;
CREATE POLICY "videos_bloque: lectura para todos" ON public.videos_bloque
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "videos_bloque: alta de cualquier entrenador" ON public.videos_bloque;
CREATE POLICY "videos_bloque: alta de cualquier entrenador" ON public.videos_bloque
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "videos_bloque: edición del autor" ON public.videos_bloque;
CREATE POLICY "videos_bloque: edición del autor" ON public.videos_bloque
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "videos_bloque: borrado del autor" ON public.videos_bloque;
CREATE POLICY "videos_bloque: borrado del autor" ON public.videos_bloque
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin');

-- Sella la autoría y mantiene updated_at, igual que acciones_guard.
CREATE OR REPLACE FUNCTION public.videos_bloque_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;   -- la autoría no se transfiere
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.videos_bloque_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS videos_bloque_guard ON public.videos_bloque;
CREATE TRIGGER videos_bloque_guard
  BEFORE INSERT OR UPDATE ON public.videos_bloque
  FOR EACH ROW EXECUTE FUNCTION public.videos_bloque_guard();
