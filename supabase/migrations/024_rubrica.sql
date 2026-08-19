-- ============================================================
-- 024_rubrica.sql — La rúbrica de un jugador (Tramo 3.7).
--
-- QUÉ ES
-- El nivel de cada jugador en cada acción y en cada conducta, en la
-- escala de cuatro de §3: no lo hace · con ayuda · solo · con
-- oposición. Es la misma escala de exigencia con la que están
-- clasificados los 204 ejercicios, y por eso «subir de nivel» y
-- «subir de ejercicio» significan lo mismo.
--
-- POR QUÉ `rubrica_valores` NO SE SOBRESCRIBE
-- Porque una progresión no es un número, es una serie. Cada
-- valoración es una fila con su fecha; el nivel de hoy es la última y
-- la de hace tres meses sigue estando. Sin eso no hay nada que
-- enseñar en Progresión (3.8), y el cumplimiento de un objetivo —que
-- desde la decisión #26 se mide por MOVIMIENTO de rúbrica y no por lo
-- que el entrenador declare— no se podría calcular.
--
-- POR QUÉ LA FILA SE IDENTIFICA POR TEXTO Y NO POR uuid
-- Las setenta filas base —cuatro conductas y el vocabulario de
-- acciones— viven en CÓDIGO (taller/js/rubrica.js), por lo mismo que
-- el catálogo de acciones y las anclas: tienen que existir sin una
-- llamada de red. `rubrica_filas` guarda solo lo que añade el club, y
-- el cliente lo fusiona encima. Una FK a una tabla que no contiene las
-- filas base sería mentira.
--
-- La clave lleva su familia delante: `accion:bote`, `conducta:actitud`.
--
-- QUIÉN PUEDE QUÉ
-- Los VALORES van por jugador, así que manda el equipo del jugador:
-- se apoya en las mismas policies de `players` (014) para no tener dos
-- definiciones de «este jugador es de un equipo mío». Las FILAS que
-- añade el club las ve todo el club, como las acciones (decisión #4).
--
-- Idempotente. Depende de: 001 (profiles), 014 (players).
-- ============================================================

-- ── 1. Las filas que añade el club ──────────────────────────
CREATE TABLE IF NOT EXISTS public.rubrica_filas (
  -- `accion:algo` | `conducta:algo`. Es la misma clave con la que se
  -- guardan los valores, así que renombrar la fila no pierde historia.
  clave      text PRIMARY KEY
             CHECK (clave ~ '^(accion|conducta):[^:]{1,60}$'),
  nombre     text NOT NULL CHECK (length(btrim(nombre)) > 0),
  categoria  text,
  orden      integer NOT NULL DEFAULT 1000,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rubrica_filas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rubrica_filas: lectura para todos" ON public.rubrica_filas;
CREATE POLICY "rubrica_filas: lectura para todos" ON public.rubrica_filas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rubrica_filas: alta de cualquier entrenador" ON public.rubrica_filas;
CREATE POLICY "rubrica_filas: alta de cualquier entrenador" ON public.rubrica_filas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rubrica_filas: edición del autor" ON public.rubrica_filas;
CREATE POLICY "rubrica_filas: edición del autor" ON public.rubrica_filas
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (created_by = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "rubrica_filas: borrado del autor" ON public.rubrica_filas;
CREATE POLICY "rubrica_filas: borrado del autor" ON public.rubrica_filas
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() = 'admin');

-- ── 2. La serie histórica ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rubrica_valores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  clave      text NOT NULL
             CHECK (clave ~ '^(accion|conducta):[^:]{1,60}$'),
  -- 0 no lo hace · 1 con ayuda · 2 solo · 3 con oposición
  nivel      smallint NOT NULL CHECK (nivel BETWEEN 0 AND 3),
  -- dónde se miró. Puede ir en null: una valoración fuera de una
  -- sesión —viendo un partido, hablando con otro entrenador— vale
  -- igual, y perderla por no saber dónde colgarla sería tirar el dato.
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  nota       text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rubrica_valores ENABLE ROW LEVEL SECURITY;

-- Consulta caliente: la serie de un jugador, de lo más nuevo a lo más
-- viejo. Y la de una fila para todo un equipo (objetivos, 3.9).
CREATE INDEX IF NOT EXISTS rubrica_valores_jugador
  ON public.rubrica_valores (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rubrica_valores_clave
  ON public.rubrica_valores (clave, created_at DESC);

/* Manda el jugador: si puedes ver al jugador, ves su rúbrica. Se
   comprueba contra `players` para no tener dos definiciones de «este
   jugador es de un equipo mío». */
DROP POLICY IF EXISTS "rubrica_valores: lectura por jugador" ON public.rubrica_valores;
CREATE POLICY "rubrica_valores: lectura por jugador" ON public.rubrica_valores
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id));

DROP POLICY IF EXISTS "rubrica_valores: alta por jugador" ON public.rubrica_valores;
CREATE POLICY "rubrica_valores: alta por jugador" ON public.rubrica_valores
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id));

/* Se puede BORRAR una valoración —el toque que no era— pero NO
   cambiarla: corregir un nivel es valorar otra vez, y eso es una fila
   nueva. Sin esta regla la serie dejaría de ser una serie. */
DROP POLICY IF EXISTS "rubrica_valores: borrado por jugador" ON public.rubrica_valores;
CREATE POLICY "rubrica_valores: borrado por jugador" ON public.rubrica_valores
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.id = player_id));

-- Sella la autoría, como en el resto de tablas con `created_by`.
CREATE OR REPLACE FUNCTION public.rubrica_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  IF TG_TABLE_NAME = 'rubrica_filas' THEN NEW.updated_at := now(); END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rubrica_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rubrica_filas_guard ON public.rubrica_filas;
CREATE TRIGGER rubrica_filas_guard
  BEFORE INSERT OR UPDATE ON public.rubrica_filas
  FOR EACH ROW EXECUTE FUNCTION public.rubrica_guard();

DROP TRIGGER IF EXISTS rubrica_valores_guard ON public.rubrica_valores;
CREATE TRIGGER rubrica_valores_guard
  BEFORE INSERT ON public.rubrica_valores
  FOR EACH ROW EXECUTE FUNCTION public.rubrica_guard();
