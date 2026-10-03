-- ============================================================
-- 044_variantes.sql — las variantes técnicas que añade el club
-- (ESPEC-PIZARRA-v3 §4.3).
--
-- QUÉ ES
-- Una variante es CÓMO se hace una acción: un pase picado, un bote con
-- cambio por la espalda, un corte en V. No cambia por dónde va nadie,
-- solo cómo se llama, cómo se cuenta y qué vídeo se enseña (§10). Las
-- de serie viven en el código (taller/js/pizarra/repertorio.js), como
-- las acciones del sistema; aquí van las que añade el club, poco a poco
-- (lo decidió el entrenador, 2026-09-30): nombre y descripción.
--
-- Y SU VÍDEO NO VA AQUÍ
-- Va en `videos_accion` (021), por slug, con la variante detrás de su
-- acción y dos guiones bajos: `pasa__por_detras`. Es la misma tabla para
-- todos los vídeos —los de las acciones, los de las variantes de serie
-- y los de estas—, así que se pone igual y se lee de una vez.
--
-- QUIÉN PUEDE QUÉ
-- Como las acciones (020) y los vídeos (021): cualquier entrenador crea
-- variantes y las ve TODO el club; cambiarlas o borrarlas, solo quien
-- las creó, o un administrador.
--
-- CÓMO SE APLICA
-- A mano, en el editor SQL de Supabase, como las anteriores. Hasta que
-- se aplique, la Pizarra funciona igual: solo que «Nueva variante» dice
-- que falta esta migración. Idempotente. Depende de: 001 (profiles,
-- current_user_role).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.variantes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- la acción de la que es variante: una de las que ya tienen variantes
  -- de serie (lo comprueba el cliente, que es quien las conoce)
  accion       text NOT NULL
               CHECK (accion ~ '^[a-z][a-z0-9_]{1,39}$'),
  -- identidad estable: es lo que guardan los tramos de las jugadas, así
  -- que renombrar la variante no rompe ningún ejercicio. Corto, para que
  -- con su acción delante quepa en el slug de un vídeo (40).
  slug         text NOT NULL
               CHECK (slug ~ '^[a-z][a-z0-9_]{0,23}$'),
  nombre       text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 40),
  descripcion  text,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (accion, slug)
);

ALTER TABLE public.variantes ENABLE ROW LEVEL SECURITY;

-- Todo el club las ve ("todo el club" = cualquier usuario autenticado,
-- el mismo criterio que 005, 020 y 021).
DROP POLICY IF EXISTS "variantes: lectura para todos" ON public.variantes;
CREATE POLICY "variantes: lectura para todos" ON public.variantes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "variantes: alta de cualquier entrenador" ON public.variantes;
CREATE POLICY "variantes: alta de cualquier entrenador" ON public.variantes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "variantes: edición del autor" ON public.variantes;
CREATE POLICY "variantes: edición del autor" ON public.variantes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "variantes: borrado del autor" ON public.variantes;
CREATE POLICY "variantes: borrado del autor" ON public.variantes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin');

-- El guard, como el de las acciones:
--  1. sella created_by con auth.uid() y no deja que se cambie después;
--  2. mantiene updated_at;
--  3. reserva las variantes de serie. La lista se repite aquí a
--     propósito (el cliente ya la comprueba): redefinir «pasa/picado»
--     cambiaría lo que dicen todos los ejercicios que lo usan.
CREATE OR REPLACE FUNCTION public.variantes_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  de_serie text[] := ARRAY[
    'pasa/recto', 'pasa/picado', 'pasa/pecho', 'pasa/beisbol', 'pasa/bombeado', 'pasa/mano_a_mano',
    'bota/normal', 'bota/cambio_mano', 'bota/espalda', 'bota/piernas', 'bota/reverso', 'bota/protegido',
    'tira/suspension', 'tira/tras_bote', 'tira/tras_recepcion', 'tira/gancho', 'tira/palmeo',
    'entra/doble_ritmo', 'entra/bandeja', 'entra/reverso', 'entra/eurostep', 'entra/bomba',
    'corta/recto', 'corta/puerta_atras', 'corta/en_v', 'corta/en_l', 'corta/rizo',
    'bloquea/directo', 'bloquea/indirecto', 'bloquea/ciego', 'bloquea/mano_a_mano'
  ];
BEGIN
  IF (NEW.accion || '/' || NEW.slug) = ANY (de_serie) THEN
    RAISE EXCEPTION 'la variante "%" de "%" es de serie y no se puede redefinir', NEW.slug, NEW.accion;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.variantes_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS variantes_guard ON public.variantes;
CREATE TRIGGER variantes_guard
  BEFORE INSERT OR UPDATE ON public.variantes
  FOR EACH ROW EXECUTE FUNCTION public.variantes_guard();
