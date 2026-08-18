-- ============================================================
-- 021_videos_accion.sql — El vídeo de referencia de una acción
-- (Tramo 2.14).
--
-- QUÉ ES
-- Un vídeo corto que enseña el GESTO. La animación dibuja por dónde va
-- cada uno; el apoyo, la muñeca y el ritmo no los dibuja nadie. Con
-- esto, al llegar la fase de «entra» el proyector se para, salen los
-- siete segundos del doble ritmo y la animación sigue sola (§12.36).
--
-- POR QUÉ NO BASTA CON acciones.video (020)
-- Porque las diez acciones del sistema —bota, entra, tira, pasa…— NO
-- están en esa tabla: viven en el código (taller/js/ia/acciones.js) y
-- sus slugs están reservados por el guard de 020, con razón —redefinir
-- «entra» cambiaría el significado de las 204 fichas de la biblioteca
-- de golpe—. Pero «entra» es justo la acción a la que un entrenador
-- quiere colgarle un vídeo.
--
-- Así que el vídeo se guarda APARTE, por slug, y vale para cualquier
-- acción: del sistema o del club. `acciones.video` sigue siendo el
-- vídeo con el que NACE una acción del club; esta tabla es el que se
-- le pone después, y manda (ia/acciones.js#conVideos).
--
-- LA FORMA DEL JSON
--   {"tipo":"youtube","id":"dQw4w9WgXcQ","desde":12,"hasta":19}
--   {"tipo":"tiktok","url":"https://www.tiktok.com/@x/video/123"}
-- `desde`/`hasta` en segundos. TikTok no admite tramo: se abre entero,
-- aparte, y no interrumpe la proyección. La forma exacta la valida el
-- cliente (ia/video.js) y la prueba un banco Node; aquí solo se exige
-- que sea un objeto con un `tipo` de los dos, por lo mismo que en 020:
-- no queremos una migración por cada matiz del reproductor.
--
-- QUIÉN PUEDE QUÉ
-- Mismo reparto que las acciones (decisión #4): cualquier entrenador
-- pone un vídeo y lo ve TODO el club; cambiarlo o quitarlo, solo quien
-- lo puso, o un administrador.
--
-- Idempotente. Depende de: 001 (profiles, current_user_role).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.videos_accion (
  -- el slug de la acción, del sistema o del club. No es una FK a
  -- `acciones` a propósito: las diez del sistema no están ahí.
  slug        text PRIMARY KEY
              CHECK (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  video       jsonb NOT NULL
              CHECK (jsonb_typeof(video) = 'object'
                     AND video->>'tipo' IN ('youtube', 'tiktok')),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.videos_accion ENABLE ROW LEVEL SECURITY;

-- Todo el club los ve (mismo criterio que 005 y 020: "todo el club" =
-- cualquier usuario autenticado).
DROP POLICY IF EXISTS "videos_accion: lectura para todos" ON public.videos_accion;
CREATE POLICY "videos_accion: lectura para todos" ON public.videos_accion
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "videos_accion: alta de cualquier entrenador" ON public.videos_accion;
CREATE POLICY "videos_accion: alta de cualquier entrenador" ON public.videos_accion
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "videos_accion: edición del autor" ON public.videos_accion;
CREATE POLICY "videos_accion: edición del autor" ON public.videos_accion
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "videos_accion: borrado del autor" ON public.videos_accion;
CREATE POLICY "videos_accion: borrado del autor" ON public.videos_accion
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin');

-- Sella la autoría y mantiene updated_at, igual que acciones_guard.
CREATE OR REPLACE FUNCTION public.videos_accion_guard()
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

REVOKE EXECUTE ON FUNCTION public.videos_accion_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS videos_accion_guard ON public.videos_accion;
CREATE TRIGGER videos_accion_guard
  BEFORE INSERT OR UPDATE ON public.videos_accion
  FOR EACH ROW EXECUTE FUNCTION public.videos_accion_guard();
