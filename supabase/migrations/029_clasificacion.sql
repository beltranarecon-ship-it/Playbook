-- ============================================================
-- 029_clasificacion.sql — La clasificación de la liga, a mano
-- (Tramo 4.5).
--
-- DECISIÓN #28: «clasificación manual ahora, automática cuando llegue
-- el enlace». La federación publica la clasificación en una web que hoy
-- no tenemos forma de leer; hasta entonces se copia a mano, que son
-- doce filas cada dos semanas y se hace en un minuto.
--
-- POR QUÉ UNA TABLA Y NO UN JSONB EN `teams`
-- Porque una fila por equipo rival deja editar una sola sin reescribir
-- las otras once, y porque el día que llegue el enlace se rellenan
-- estas mismas filas desde fuera sin cambiar ni una consulta de la app.
--
-- LO QUE NO SE GUARDA: la posición. Es una consecuencia del orden, no
-- un dato; guardarla obligaría a renumerar doce filas cada vez que se
-- corrige un resultado, y a la primera que se olvide, la tabla miente.
-- Se calcula al pintar (`clasificacion.js`, módulo puro).
--
-- Idempotente. Depende de: 002 (teams), 013 (seasons).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clasificacion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  season_id    uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
  -- el nombre tal y como lo publica la federación, con sus abreviaturas
  nombre       text NOT NULL CHECK (length(trim(nombre)) > 0),
  -- cuál de las filas somos nosotros: se pinta distinta y se busca sola
  es_nuestro   boolean NOT NULL DEFAULT false,
  jugados      smallint NOT NULL DEFAULT 0 CHECK (jugados BETWEEN 0 AND 99),
  ganados      smallint NOT NULL DEFAULT 0 CHECK (ganados BETWEEN 0 AND 99),
  perdidos     smallint NOT NULL DEFAULT 0 CHECK (perdidos BETWEEN 0 AND 99),
  puntos_favor  integer NOT NULL DEFAULT 0 CHECK (puntos_favor BETWEEN 0 AND 9999),
  puntos_contra integer NOT NULL DEFAULT 0 CHECK (puntos_contra BETWEEN 0 AND 9999),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clasificacion ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS clasificacion_equipo
  ON public.clasificacion (team_id, season_id);

-- Un equipo no puede aparecer dos veces en la misma clasificación: al
-- copiarla a mano es fácil pegar dos veces y quedarse con la tabla
-- duplicada sin verlo.
CREATE UNIQUE INDEX IF NOT EXISTS clasificacion_sin_repetidos
  ON public.clasificacion (team_id, season_id, lower(trim(nombre)));

COMMENT ON TABLE public.clasificacion IS
  'Clasificación de la liga, copiada a mano (decisión #28). La posición NO se guarda: se calcula al pintar.';

/* Manda el equipo, como en todo el módulo: la ve y la edita quien
   entrena a ese equipo. Se comprueba contra `teams` para no tener dos
   definiciones de «este equipo es mío». */
DROP POLICY IF EXISTS "clasificacion: lectura por equipo" ON public.clasificacion;
CREATE POLICY "clasificacion: lectura por equipo" ON public.clasificacion
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id));

DROP POLICY IF EXISTS "clasificacion: alta por equipo" ON public.clasificacion;
CREATE POLICY "clasificacion: alta por equipo" ON public.clasificacion
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id));

DROP POLICY IF EXISTS "clasificacion: edición por equipo" ON public.clasificacion;
CREATE POLICY "clasificacion: edición por equipo" ON public.clasificacion
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id));

DROP POLICY IF EXISTS "clasificacion: borrado por equipo" ON public.clasificacion;
CREATE POLICY "clasificacion: borrado por equipo" ON public.clasificacion
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id));

DROP TRIGGER IF EXISTS clasificacion_updated_at ON public.clasificacion;
CREATE TRIGGER clasificacion_updated_at
  BEFORE UPDATE ON public.clasificacion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
