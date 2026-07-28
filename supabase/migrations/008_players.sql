-- ============================================================
-- 008_players.sql — Roster de jugadores + Storage de fotos
-- Solo `nombre` es obligatorio; todo lo demás opcional.
-- Cuelga directamente del equipo (RLS por current_user_can_access_team).
-- Fotos de jugador → Supabase Storage (bucket privado), no data URL.
-- Idempotente. Depende de: 007 (helper, storage_team_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.players (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  nombre            text NOT NULL,
  dorsal            smallint CHECK (dorsal IS NULL OR dorsal BETWEEN 0 AND 99),
  fecha_nacimiento  date,
  posicion          text CHECK (posicion IN
                      ('base','escolta','alero','ala-pivot','pivot','sin definir')),
  foto_path         text,          -- ruta en bucket 'jugadores' = '{team_id}/{uuid}'
  notas             text,
  estado            text NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo','lesionado','baja')),
  tutor_nombre      text,
  tutor_contacto    text,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS players_team ON public.players (team_id, estado);
DROP TRIGGER IF EXISTS players_updated_at ON public.players;
CREATE TRIGGER players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Acceso por equipo (lectura + escritura). Admin pasa por el helper.
DROP POLICY IF EXISTS "players: acceso por equipo" ON public.players;
CREATE POLICY "players: acceso por equipo" ON public.players
  FOR ALL TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));

-- ── Storage: bucket privado 'jugadores' (fotos de menores) ────
-- Límite 5 MB, solo imágenes. Ruta '{team_id}/...'.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('jugadores','jugadores', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = false;

-- Acceso a objetos del bucket por equipo, con guard regex (fail-closed).
DROP POLICY IF EXISTS "jugadores: acceso por equipo" ON storage.objects;
CREATE POLICY "jugadores: acceso por equipo" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'jugadores'
         AND public.current_user_can_access_team(public.storage_team_id(name)))
  WITH CHECK (bucket_id = 'jugadores'
         AND public.current_user_can_access_team(public.storage_team_id(name)));
