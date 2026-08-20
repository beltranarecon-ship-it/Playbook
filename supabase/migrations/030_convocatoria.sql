-- ============================================================
-- 030_convocatoria.sql — La convocatoria del partido y la imagen
-- del equipo (Tramos 4.6 y 4.12).
--
-- QUÉ SE GUARDA
--
--   · En `matches`, a quién se convoca y dónde se queda: `convocados`
--     (lista de player_id), `convocatoria_lugar` y `convocatoria_hora`.
--     El lugar y la hora de la convocatoria NO son los del partido: se
--     queda media hora antes y muchas veces en otro sitio (el pabellón
--     de casa para ir juntos), y meterlo en `lugar` y `hora` haría que
--     el calendario mintiera sobre cuándo se juega.
--
--   · En `team_settings`, lo que es del equipo: la plantilla PDF de la
--     convocatoria, la imagen del equipo (4.12) y la hora a la que
--     avisar de que falta rellenarla (4.8).
--
-- POR QUÉ `convocados` ES JSONB Y `partido_estadisticas` NO
-- Porque la pregunta va en la misma dirección que el dato: la
-- convocatoria SIEMPRE se lee con el partido delante. La del acta va al
-- revés —«¿cuántos periodos lleva Sofía esta temporada?»— y por eso
-- aquella es una tabla (028) y esta es una lista corta dentro de la
-- fila.
--
-- POR QUÉ EN `team_settings` Y NO EN `teams`
-- §7 los pone en `teams`, pero `color` y `dia_convocatoria` ya viven en
-- `team_settings`, que es la tabla de ajustes. Partirlos obligaría a
-- leer dos tablas para pintar una pantalla de ajustes, y a la fila de
-- al lado a acordarse de cuál era cuál.
--
-- Idempotente. Depende de: 007 (team_settings), 016 (matches).
-- ============================================================

-- ── 1. La convocatoria de cada partido ──────────────────────
ALTER TABLE public.matches
  -- ["uuid-jugador", …] en el orden en el que se pinta la lista
  ADD COLUMN IF NOT EXISTS convocados jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- dónde y a qué hora se queda, que no es dónde y cuándo se juega
  ADD COLUMN IF NOT EXISTS convocatoria_lugar text,
  ADD COLUMN IF NOT EXISTS convocatoria_hora time;

COMMENT ON COLUMN public.matches.convocados IS
  'Lista de player_id convocados (Tramo 4.6). Jsonb y no tabla: siempre se lee con el partido delante.';
COMMENT ON COLUMN public.matches.convocatoria_lugar IS
  'Dónde se queda, que no tiene por qué ser dónde se juega.';

-- ── 2. Lo que es del equipo ─────────────────────────────────
ALTER TABLE public.team_settings
  -- la plantilla en PDF que sube el club, en el bucket 'equipos'
  ADD COLUMN IF NOT EXISTS plantilla_path text,
  -- la imagen del equipo, para el calendario (Tramo 4.12)
  ADD COLUMN IF NOT EXISTS imagen_path text,
  -- a qué hora avisar de la convocatoria sin rellenar (Tramo 4.8)
  ADD COLUMN IF NOT EXISTS hora_convocatoria time;

COMMENT ON COLUMN public.team_settings.hora_convocatoria IS
  'Hora del aviso «convocatoria sin rellenar» el día de convocatoria (§5.8).';

-- ── 3. El bucket del equipo ─────────────────────────────────
-- Ruta '{team_id}/…', igual que 'jugadores' (008) y 'actas' (016): el
-- guard autoriza por la primera carpeta, y una ruta sin UUID cae por
-- deny en vez de por error de cast.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('equipos', 'equipos', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = false;

DROP POLICY IF EXISTS "equipos: acceso por equipo" ON storage.objects;
CREATE POLICY "equipos: acceso por equipo" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'equipos'
         AND public.current_user_can_access_team(public.storage_team_id(name)))
  WITH CHECK (bucket_id = 'equipos'
         AND public.current_user_can_access_team(public.storage_team_id(name)));
