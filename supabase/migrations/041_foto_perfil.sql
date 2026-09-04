-- ============================================================
-- 041_foto_perfil.sql — ponerle cara al entrenador.
--
-- ── EL AGUJERO ──────────────────────────────────────────────
-- `public.profiles` es (id, role, full_name, created_at) desde la 001 y
-- no hay dónde dejar una foto. Los tres buckets que existen —'jugadores'
-- (008), 'actas' (016) y 'equipos' (030)— autorizan POR EQUIPO, con
-- current_user_can_access_team sobre la primera carpeta de la ruta. Una
-- foto de perfil no es de ningún equipo: no hay bucket que le sirva.
--
-- ── LA TRAMPA QUE ESTA MIGRACIÓN EVITA ──────────────────────
-- La 006 revocó el UPDATE de tabla sobre `profiles` y lo devolvió
-- COLUMNA A COLUMNA (006:19-20), con este contrato escrito: «un UPDATE a
-- profiles debe enviar SOLO full_name en el SET».
--
-- O sea que una columna nueva nace SIN PERMISO DE ESCRITURA. Sin el
-- GRANT de abajo, la RLS se ve correcta, la columna existe, el SELECT la
-- devuelve… y guardar la foto contesta «permission denied for column
-- foto_path of relation profiles» SIEMPRE, no a veces. Es el fallo que
-- se pasa una tarde buscándose en el sitio equivocado.
--
-- ── QUÉ HACE ────────────────────────────────────────────────
-- La columna, su permiso de escritura, un guard gemelo del de equipos
-- que saca el uuid del dueño de la ruta, el bucket privado 'perfiles' y
-- su política: cada uno solo dentro de su carpeta.
--
-- Idempotente. Depende de: 001 (profiles), 006 (el UPDATE por columna).
-- ============================================================

-- ── 1) Dónde queda escrita la foto ────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS foto_path text;

COMMENT ON COLUMN public.profiles.foto_path IS
  'Ruta en el bucket privado perfiles: {auth.uid()}/{uuid}.{ext}. Igual que players.foto_path (008), la foto NO se guarda como data URL: la primera carpeta es lo que autoriza el guard de Storage. NULL = sin foto, que es lo normal.';

-- ── 2) El permiso de escritura (la pieza que se olvida) ───────
/* Ver la cabecera. La 006 dejó `profiles` sin UPDATE de tabla; cada
   columna editable necesita su GRANT explícito o el navegador no puede
   escribirla nunca. */
GRANT UPDATE (foto_path) ON public.profiles TO authenticated;

-- ── 3) De quién es esta ruta ──────────────────────────────────
/* Gemelo exacto de public.storage_team_id (007:51-62): mismo cuerpo y
   mismo guard regex, otra pregunta. Una ruta que no empiece por un uuid
   canónico devuelve NULL y la política deniega —fail-closed— en vez de
   reventar con un error de cast. */
CREATE OR REPLACE FUNCTION public.storage_owner_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN split_part(object_name, '/', 1)
         ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN split_part(object_name, '/', 1)::uuid
    ELSE NULL
  END;
$$;

/* El GRANT a authenticated es OBLIGATORIO, por lo mismo que avisa la
   007:64-66: la política lo invoca como ese rol y sin él la RLS falla
   con 'permission denied for function'. */
REVOKE EXECUTE ON FUNCTION public.storage_owner_id(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.storage_owner_id(text) TO authenticated, service_role;

-- ── 4) El bucket ──────────────────────────────────────────────
/* Privado y con el mismo trato que 'jugadores' (008), porque el
   contenido es el mismo: la foto de una persona. Cinco megas y solo
   imagen: aquí no caben PDFs como en 'actas'. */
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('perfiles', 'perfiles', false, 5242880,
        ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = false;

-- ── 5) Cada uno en su carpeta ─────────────────────────────────
/* La forma de las otras tres políticas de Storage, preguntando por el
   USUARIO en vez de por el equipo. Un entrenador no ve la foto de otro:
   es coherente con la 001, que tampoco le deja leer su perfil. */
DROP POLICY IF EXISTS "perfiles: cada uno en su carpeta" ON storage.objects;
CREATE POLICY "perfiles: cada uno en su carpeta" ON storage.objects
  FOR ALL TO authenticated
  USING      (bucket_id = 'perfiles' AND public.storage_owner_id(name) = auth.uid())
  WITH CHECK (bucket_id = 'perfiles' AND public.storage_owner_id(name) = auth.uid());

-- ── Y se dice cómo ha quedado ─────────────────────────────────
/* Las cuatro tienen que salir true. `puede_escribir` es la única que
   destapa el fallo de la 006 sin abrir la app: con ella en false, la
   foto se sube al bucket y luego no hay manera de guardar su ruta. */
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'profiles'
             AND column_name = 'foto_path')                        AS columna,
  has_column_privilege('authenticated', 'public.profiles',
                       'foto_path', 'UPDATE')                      AS puede_escribir,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'perfiles')     AS bucket,
  EXISTS (SELECT 1 FROM pg_policies
           WHERE schemaname = 'storage' AND tablename = 'objects'
             AND policyname = 'perfiles: cada uno en su carpeta')   AS politica;
