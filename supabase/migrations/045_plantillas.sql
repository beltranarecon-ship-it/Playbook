-- ============================================================
-- 045_plantillas.sql — colocaciones y fases guardadas de la Pizarra
-- (ESPEC-PIZARRA-v3 §7.8).
--
-- QUÉ ES
-- Dos cosas que un entrenador repite y no quiere volver a colocar ni a
-- dibujar cada vez:
--   · una COLOCACIÓN («1-4 alto», «5 abiertos»): dónde está cada ficha
--     al empezar;
--   · una FASE («bloqueo directo», «entrada por el 45»): lo dibujado en
--     una fase, con papeles en lugar de fichas.
-- Las dos son del club, como las acciones (020) y las variantes (044):
-- se guardan una vez y las ve todo el club.
--
-- LA FORMA DE `datos`
--   colocación: {"elementos": [ …las fichas, como en la jugada (§11.1)… ]}
--   fase:       {"papeles": [{"clave","equipo","nombre","en":{x,y}}],
--                "tramos":  [{"accion","variante","tipo","trazo","quien",
--                             "receptor","companero","vuela",…}]}
-- La valida y la sanea el cliente (taller/js/pizarra/plantillas.js, con
-- su banco Node); aquí solo se exige que sea un objeto, por lo mismo que
-- en 020 y 021: no queremos una migración por cada campo nuevo.
--
-- `pista` es la pista en la que se guardó: las coordenadas son de esa, y
-- la Pizarra solo ofrece las de la pista que tiene delante.
--
-- QUIÉN PUEDE QUÉ
-- Cualquier entrenador guarda plantillas y las ve TODO el club;
-- cambiarlas o borrarlas, solo quien las guardó, o un administrador.
--
-- CÓMO SE APLICA
-- A mano, en el editor SQL de Supabase, como las anteriores. Hasta que
-- se aplique, la Pizarra funciona igual: solo que guardar una plantilla
-- dice que falta esta migración. Idempotente. Depende de: 001.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plantillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text NOT NULL CHECK (tipo IN ('colocacion', 'fase')),
  nombre      text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 60),
  pista       text NOT NULL DEFAULT 'entera'
              CHECK (pista ~ '^[a-z][a-z0-9_]{1,39}$'),
  datos       jsonb NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plantillas ENABLE ROW LEVEL SECURITY;

-- Consulta caliente: la Pizarra las carga todas al abrirse, por tipo.
CREATE INDEX IF NOT EXISTS plantillas_tipo ON public.plantillas (tipo, nombre);

DROP POLICY IF EXISTS "plantillas: lectura para todos" ON public.plantillas;
CREATE POLICY "plantillas: lectura para todos" ON public.plantillas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "plantillas: alta de cualquier entrenador" ON public.plantillas;
CREATE POLICY "plantillas: alta de cualquier entrenador" ON public.plantillas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "plantillas: edición del autor" ON public.plantillas;
CREATE POLICY "plantillas: edición del autor" ON public.plantillas
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "plantillas: borrado del autor" ON public.plantillas;
CREATE POLICY "plantillas: borrado del autor" ON public.plantillas
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin');

-- Sella la autoría y mantiene updated_at, igual que los demás guards.
CREATE OR REPLACE FUNCTION public.plantillas_guard()
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

REVOKE EXECUTE ON FUNCTION public.plantillas_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS plantillas_guard ON public.plantillas;
CREATE TRIGGER plantillas_guard
  BEFORE INSERT OR UPDATE ON public.plantillas
  FOR EACH ROW EXECUTE FUNCTION public.plantillas_guard();
