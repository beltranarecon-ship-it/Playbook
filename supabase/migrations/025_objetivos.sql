-- ============================================================
-- 025_objetivos.sql — Objetivos con categoría propia y diana
-- (Tramo 3.9).
--
-- DOS CAMBIOS SOBRE `objectives`, Y UNA TABLA
--
--   1. `categoria` deja de ser un enumerado cerrado. Eran tres
--      —técnico, táctico, físico— y un entrenador que quiera trabajar
--      «actitud» este trimestre no tenía dónde ponerlo. Pasa a texto
--      libre con catálogo propio del club (§6).
--
--      El CHECK se retira; lo que NO se retira es que no esté vacía.
--      Un objetivo sin categoría se pierde en la lista.
--
--   2. `dianas` — a qué filas de la rúbrica apunta el objetivo:
--      `{"accion:entrada","conducta:autonomia"}`. Es lo que convierte
--      «trabajar la entrada» en algo MEDIBLE: desde la decisión #26 el
--      cumplimiento no lo declara el entrenador, lo dice cuántos
--      jugadores han subido de nivel en esas filas.
--
--      Mismas claves que `rubrica_valores` (024). Sin FK, por lo mismo
--      que allí: las setenta filas base viven en código.
--
--   3. `categorias_objetivo` — el catálogo del club. Existe para que
--      la segunda vez que alguien escriba «actitud» salga sugerida en
--      vez de convertirse en «Actitud», «actitud » y «ACTITUD».
--
-- POR QUÉ LAS DIANAS SON UN ARRAY Y NO UNA TABLA
-- Porque son dos o tres claves que solo se leen con el objetivo
-- delante, nunca al revés. Una tabla puente costaría un join en todas
-- las consultas de objetivos para no ganar ninguna consulta nueva.
--
-- Idempotente. Depende de: 011 (objectives).
-- ============================================================

-- ── 1. Categoría libre ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.objectives'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%categoria%técnico%'
  ) THEN
    EXECUTE (
      SELECT format('ALTER TABLE public.objectives DROP CONSTRAINT %I', conname)
      FROM pg_constraint
      WHERE conrelid = 'public.objectives'::regclass
        AND pg_get_constraintdef(oid) ILIKE '%categoria%técnico%'
      LIMIT 1
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'objectives_categoria_no_vacia') THEN
    ALTER TABLE public.objectives
      ADD CONSTRAINT objectives_categoria_no_vacia CHECK (length(btrim(categoria)) > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.objectives.categoria IS
  'Texto libre con catálogo del club (Tramo 3.9). Antes eran tres fijas.';

-- ── 2. Las dianas ───────────────────────────────────────────
ALTER TABLE public.objectives
  ADD COLUMN IF NOT EXISTS dianas text[] NOT NULL DEFAULT '{}';

/* Un CHECK no admite subconsultas, así que la comprobación va en una
   función inmutable. Se declara aparte porque la misma forma de clave
   la usan `rubrica_valores` (024) y esto: si mañana aparece una tercera
   familia, se cambia en un sitio. */
CREATE OR REPLACE FUNCTION public.claves_rubrica_validas(claves text[])
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(c ~ '^(accion|conducta):[^:]{1,60}$'), true)
  FROM unnest(coalesce(claves, '{}'::text[])) AS c;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'objectives_dianas_forma') THEN
    ALTER TABLE public.objectives
      ADD CONSTRAINT objectives_dianas_forma
      CHECK (public.claves_rubrica_validas(dianas));
  END IF;
END $$;

COMMENT ON COLUMN public.objectives.dianas IS
  'Filas de la rúbrica a las que apunta (Tramo 3.9): accion:… | conducta:…. Es lo que hace el objetivo medible.';

CREATE INDEX IF NOT EXISTS objectives_dianas ON public.objectives USING gin (dianas);

-- ── 3. El catálogo de categorías del club ───────────────────
CREATE TABLE IF NOT EXISTS public.categorias_objetivo (
  nombre     text PRIMARY KEY CHECK (length(btrim(nombre)) > 0 AND length(nombre) <= 40),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_objetivo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorias_objetivo: lectura para todos" ON public.categorias_objetivo;
CREATE POLICY "categorias_objetivo: lectura para todos" ON public.categorias_objetivo
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categorias_objetivo: alta de cualquier entrenador" ON public.categorias_objetivo;
CREATE POLICY "categorias_objetivo: alta de cualquier entrenador" ON public.categorias_objetivo
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "categorias_objetivo: borrado del autor" ON public.categorias_objetivo;
CREATE POLICY "categorias_objetivo: borrado del autor" ON public.categorias_objetivo
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin');

CREATE OR REPLACE FUNCTION public.categorias_objetivo_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.categorias_objetivo_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS categorias_objetivo_guard ON public.categorias_objetivo;
CREATE TRIGGER categorias_objetivo_guard
  BEFORE INSERT ON public.categorias_objetivo
  FOR EACH ROW EXECUTE FUNCTION public.categorias_objetivo_guard();

-- Las tres de siempre, para que el catálogo no nazca vacío y los
-- objetivos que ya existen sigan casando con algo de la lista.
INSERT INTO public.categorias_objetivo (nombre)
VALUES ('técnico'), ('táctico'), ('físico')
ON CONFLICT (nombre) DO NOTHING;
