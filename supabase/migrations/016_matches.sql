-- ============================================================
-- 016_matches.sql — Partidos. Módulo Sesiones · M6.
--   · v1 = lo que un entrenador apunta de verdad al acabar: marcador,
--     cinco valoraciones de 1 a 5 y las claves del partido, más la
--     foto del acta. La convocatoria (PDF) y las estadísticas por
--     jugador son v2: sus columnas jsonb ya existen aquí vacías para
--     no migrar la tabla entera después.
--   · Un partido NO es una sesión: no tiene bloques ni carga. Comparte
--     equipo, temporada y calendario, y poco más.
--   · `valorada_at` se sella y se dessella en BD, igual que
--     sessions.evaluada_at (015): "valorada" significa siempre lo mismo.
-- Idempotente. Depende de: 007 (helper de equipo + storage_team_id),
--   001 (teams, seasons, profiles, update_updated_at).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.matches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              uuid NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  season_id            uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  fecha                date NOT NULL,
  hora                 time,
  lugar                text,
  rival                text NOT NULL,
  es_local             boolean NOT NULL DEFAULT true,
  estado               text NOT NULL DEFAULT 'programado'
                       CHECK (estado IN ('programado','jugado','aplazado','cancelado')),
  marcador_favor       smallint CHECK (marcador_favor  IS NULL OR marcador_favor  BETWEEN 0 AND 300),
  marcador_contra      smallint CHECK (marcador_contra IS NULL OR marcador_contra BETWEEN 0 AND 300),
  -- las cinco valoraciones del entrenador (1-5). Ninguna es obligatoria:
  -- un partido puede quedarse con el marcador y nada más.
  val_defensa          smallint CHECK (val_defensa IS NULL OR val_defensa BETWEEN 1 AND 5),
  val_ataque           smallint CHECK (val_ataque  IS NULL OR val_ataque  BETWEEN 1 AND 5),
  val_actitud          smallint CHECK (val_actitud IS NULL OR val_actitud BETWEEN 1 AND 5),
  val_acierto          smallint CHECK (val_acierto IS NULL OR val_acierto BETWEEN 1 AND 5),
  val_global           smallint CHECK (val_global  IS NULL OR val_global  BETWEEN 1 AND 5),
  claves               text,
  acta_path            text,                 -- ruta en bucket 'actas' = '{team_id}/…'
  valorada_at          timestamptz,          -- sellado por trigger, no por el cliente
  convocatoria_cerrada boolean NOT NULL DEFAULT false,
  -- ── ganchos v2 (vacíos en v1, ya en su sitio) ──
  marcador_cuartos     jsonb NOT NULL DEFAULT '[]'::jsonb,
  convocados           jsonb NOT NULL DEFAULT '[]'::jsonb,
  estadisticas         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matches_rival_check CHECK (btrim(rival) <> ''),
  -- un partido JUGADO tiene marcador: si no, el balance de la temporada
  -- mentiría (partidos "jugados" que no cuentan ni como victoria ni derrota)
  CONSTRAINT matches_jugado_marcador_check CHECK (
    estado <> 'jugado' OR (marcador_favor IS NOT NULL AND marcador_contra IS NOT NULL)
  )
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS matches_team_fecha   ON public.matches (team_id, fecha);
CREATE INDEX IF NOT EXISTS matches_season_fecha ON public.matches (season_id, fecha);
DROP TRIGGER IF EXISTS matches_updated_at ON public.matches;
CREATE TRIGGER matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Guardián: autoría, identidad y sellado de la valoración ───
-- Mismo patrón que objectives_guard (011) y sessions_guard (013):
-- (a) created_by lo pone el servidor, no el cliente;
-- (b) team_id/season_id inmutables (mover un partido de equipo falsearía
--     dos balances de golpe);
-- (c) valorada_at ⇔ hay alguna valoración. Se calcula aquí, en la misma
--     fila, así que no hace falta trigger AFTER: BEFORE basta y es exacto.
CREATE OR REPLACE FUNCTION public.matches_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_hay boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.season_id IS DISTINCT FROM OLD.season_id THEN
      RAISE EXCEPTION 'team_id/season_id de un partido son inmutables';
    END IF;
    -- Sin esto, un partido JUGADO se "lavaba" a 'programado' y entonces la
    -- policy de borrado lo dejaba desaparecer con marcador, valoraciones,
    -- claves y acta. Dos clics contra "el histórico no se borra en duro".
    -- Simétrico a la no-regresión a 'preliminar' de sessions_guard (010).
    IF NEW.estado = 'programado' AND OLD.estado <> 'programado' THEN
      RAISE EXCEPTION 'un partido % no puede volver a programado', OLD.estado;
    END IF;
    NEW.created_by := OLD.created_by;
  END IF;

  v_hay := (NEW.val_defensa IS NOT NULL OR NEW.val_ataque IS NOT NULL
            OR NEW.val_actitud IS NOT NULL OR NEW.val_acierto IS NOT NULL
            OR NEW.val_global IS NOT NULL);
  -- `valorada_at` la sella el servidor y NADA más: el valor que mande el
  -- cliente se ignora siempre. Antes, en la primera valoración (OLD nulo) el
  -- COALESCE se quedaba con NEW.valorada_at y se podía antedatar a voluntad;
  -- y en INSERT esa rama tocaba OLD, que no está asignado (error crudo 55000).
  IF v_hay THEN
    NEW.valorada_at := COALESCE(
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.valorada_at END, now());
  ELSE
    NEW.valorada_at := NULL;               -- se borraron todas
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.matches_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS matches_guard ON public.matches;
CREATE TRIGGER matches_guard
  BEFORE INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.matches_guard();

-- ── Policies ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "matches: lectura por equipo" ON public.matches;
CREATE POLICY "matches: lectura por equipo" ON public.matches
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "matches: alta por equipo" ON public.matches;
CREATE POLICY "matches: alta por equipo" ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "matches: edición por equipo" ON public.matches;
CREATE POLICY "matches: edición por equipo" ON public.matches
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));

-- DELETE solo de lo que aún no ha pasado: un partido JUGADO (o aplazado /
-- cancelado, que son historia del calendario) no se borra de un tiro.
-- Mismo criterio que sessions (010) y objectives (011).
DROP POLICY IF EXISTS "matches: borrado solo programados" ON public.matches;
CREATE POLICY "matches: borrado solo programados" ON public.matches
  FOR DELETE TO authenticated
  USING (
    public.current_user_can_access_team(team_id)
    AND estado = 'programado'
  );

-- ── Storage: bucket privado 'actas' ───────────────────────────
-- Foto o PDF del acta. Ruta '{team_id}/…' con el mismo guard regex que
-- 'jugadores' (008): ruta sin UUID → deny, sin error de cast.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('actas','actas', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = false;

DROP POLICY IF EXISTS "actas: acceso por equipo" ON storage.objects;
CREATE POLICY "actas: acceso por equipo" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'actas'
         AND public.current_user_can_access_team(public.storage_team_id(name)))
  WITH CHECK (bucket_id = 'actas'
         AND public.current_user_can_access_team(public.storage_team_id(name)));
