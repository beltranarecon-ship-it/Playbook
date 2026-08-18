-- ============================================================
-- 020_acciones.sql — El catálogo de acciones del club (Tramo 2.5).
--
-- QUÉ ES
-- El vocabulario con el que se describe un ejercicio en el paso 2. Una
-- acción es un nombre puesto a una configuración de una de las cinco
-- familias que el motor sabe resolver (desplazamiento, sobre el balón,
-- entre dos jugadores, gesto en el sitio, simulación N contra M).
--
-- Y es el MISMO vocabulario que etiqueta el ejercicio, que apunta un
-- objetivo y que da las filas de la rúbrica de un jugador. Por eso
-- vive en una tabla y no en una lista dentro de cada ficha: una acción
-- tiene que ser la misma cosa en los cuatro sitios.
--
-- QUÉ NO ESTÁ AQUÍ
-- Las nueve acciones de siempre —bota, entra, corta, rodea, vuelve a
-- la fila, pasa, tira, recoge, bloquea, defiende—. Viven en el código
-- (taller/js/ia/acciones.js) por la misma razón que las anclas: son el
-- vocabulario mínimo sin el que el Taller no funciona, y tiene que
-- estar disponible sin una llamada de red. Esta tabla guarda lo que
-- añade el club, y el cliente lo fusiona encima (fusionarCatalogo).
-- Los slugs del sistema están reservados: redefinir «tira» cambiaría
-- el significado de las 204 fichas de la biblioteca sin tocar ninguna.
-- La comprobación la hace el cliente Y el trigger de abajo.
--
-- QUIÉN PUEDE QUÉ
-- Cualquier entrenador crea acciones y las ve TODO el club: es la
-- decisión que se tomó en la entrevista, y es lo que hace que el
-- vocabulario crezca solo. Modificar y borrar, únicamente quien la
-- creó, o un administrador.
--
-- Idempotente. Depende de: 001 (profiles, current_user_role).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.acciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- identidad estable: es lo que guardan las intenciones de las fichas,
  -- así que renombrar la acción no rompe ningún ejercicio.
  slug         text NOT NULL UNIQUE
               CHECK (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  nombre       text NOT NULL CHECK (length(btrim(nombre)) > 0),
  familia      text NOT NULL
               CHECK (familia IN ('desplazamiento', 'balon', 'entre_dos', 'gesto', 'simulacion')),
  -- Valores que la acción FIJA, por nombre de parámetro. La forma la
  -- valida el cliente contra FAMILIAS (acciones.js#validarAccion): aquí
  -- solo se exige que sea un objeto, porque los parámetros de cada
  -- familia se amplían con el motor y no queremos una migración por
  -- cada parámetro nuevo.
  parametros   jsonb NOT NULL DEFAULT '{}'::jsonb
               CHECK (jsonb_typeof(parametros) = 'object'),
  -- los que la acción pregunta al usarla en vez de fijarlos
  pide         text[] NOT NULL DEFAULT '{}',
  -- cómo se puede escribir a mano en el paso 2
  sinonimos    text[] NOT NULL DEFAULT '{}',
  simbolo      text,
  descripcion  text,
  -- Vídeo de referencia (Tramo 2.14): YouTube con tramo
  -- {"tipo":"youtube","id":"...","desde":12,"hasta":19} o TikTok como
  -- enlace {"tipo":"tiktok","url":"..."}.
  video        jsonb CHECK (video IS NULL OR jsonb_typeof(video) = 'object'),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acciones ENABLE ROW LEVEL SECURITY;

-- Consulta caliente: el paso 2 carga el catálogo entero ordenado por familia.
CREATE INDEX IF NOT EXISTS acciones_familia ON public.acciones (familia, nombre);

-- Todo el club las ve. No hay concepto de club en el esquema (mismo
-- criterio que 005): "todo el club" = cualquier usuario autenticado.
DROP POLICY IF EXISTS "acciones: lectura para todos" ON public.acciones;
CREATE POLICY "acciones: lectura para todos" ON public.acciones
  FOR SELECT TO authenticated USING (true);

-- Crear, cualquiera. `created_by` lo sella el guard, no el cliente.
DROP POLICY IF EXISTS "acciones: alta de cualquier entrenador" ON public.acciones;
CREATE POLICY "acciones: alta de cualquier entrenador" ON public.acciones
  FOR INSERT TO authenticated WITH CHECK (true);

-- Editar y borrar, solo quien la creó o un administrador: una acción
-- que usan las fichas de otros no la cambia cualquiera.
DROP POLICY IF EXISTS "acciones: edición del autor" ON public.acciones;
CREATE POLICY "acciones: edición del autor" ON public.acciones
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "acciones: borrado del autor" ON public.acciones;
CREATE POLICY "acciones: borrado del autor" ON public.acciones
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin');

-- El guard hace tres cosas:
--  1. sella created_by con auth.uid() y no deja que se cambie después
--     (misma regla que sessions, objectives, matches y team_notes);
--  2. mantiene updated_at;
--  3. reserva los slugs del sistema. La lista se repite aquí a
--     propósito: el cliente ya la comprueba, pero un catálogo se edita
--     desde varios sitios y esta es la única defensa que no depende de
--     que el que escribe use nuestro cliente.
CREATE OR REPLACE FUNCTION public.acciones_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reservados text[] := ARRAY[
    'bota', 'entra', 'corta', 'rodea', 'vuelve_a_fila',
    'pasa', 'tira', 'recoge', 'bloquea', 'defiende'
  ];
BEGIN
  IF NEW.slug = ANY (reservados) THEN
    RAISE EXCEPTION 'el nombre corto "%" es del catálogo del sistema y no se puede redefinir', NEW.slug;
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

REVOKE EXECUTE ON FUNCTION public.acciones_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS acciones_guard ON public.acciones;
CREATE TRIGGER acciones_guard
  BEFORE INSERT OR UPDATE ON public.acciones
  FOR EACH ROW EXECUTE FUNCTION public.acciones_guard();
