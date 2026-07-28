-- ============================================================
-- 007_team_foundation.sql — Fundación del módulo Sesiones
-- Introduce propiedad por EQUIPO (hoy todo es created_by=auth.uid()).
--   · team_coaches (puente N:N coach↔equipo, RAÍZ de permisos)
--   · helper canónico current_user_can_access_team() + storage_team_id()
--   · team_settings (color / día de convocatoria, editable por coach)
--   · RLS: el coach crea y gestiona SUS equipos; escritura de team_coaches
--     solo admin (anti auto-asignación) + auto-asignación del creador
--   · semilla de los 3 equipos existentes (evita el arranque en frío)
-- Idempotente y RE-EJECUTABLE (ver runbook de la semilla en §6).
-- Depende de: 001 (teams, profiles, current_user_role), 006 (hardening).
-- ORDEN INTERNO OBLIGATORIO: tabla team_coaches ANTES que el helper
-- (LANGUAGE sql valida el cuerpo en CREATE FUNCTION: si la tabla no
-- existe, la migración entera aborta), y las policies DESPUÉS del helper.
-- ============================================================

-- ── 1) team_coaches — puente coach ↔ equipo (raíz de permisos) ─
CREATE TABLE IF NOT EXISTS public.team_coaches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  coach_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rol         text NOT NULL DEFAULT 'principal'
              CHECK (rol IN ('principal','ayudante')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_coaches_unico UNIQUE (team_id, coach_id)
);
ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS team_coaches_coach ON public.team_coaches (coach_id);
CREATE INDEX IF NOT EXISTS team_coaches_team  ON public.team_coaches (team_id);

-- ── 2) Helpers (terreno de RLS) ───────────────────────────────
-- Acceso por equipo: admin, o coach presente en team_coaches.
-- SECURITY DEFINER (owner postgres, BYPASSRLS) evita la recursión al
-- usarlo dentro de la propia policy de team_coaches.
CREATE OR REPLACE FUNCTION public.current_user_can_access_team(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_team_id IS NOT NULL AND (
    public.current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.team_coaches tc
      WHERE tc.team_id = p_team_id AND tc.coach_id = auth.uid()
    )
  );
$$;

-- Extrae el team_id de la 1ª carpeta de una ruta de Storage con guard regex.
-- Ruta sin UUID en la 1ª carpeta → NULL → deny (fail-closed), sin cast error.
CREATE OR REPLACE FUNCTION public.storage_team_id(object_name text)
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

-- CONTRACT §"Modelo de permisos": REVOKE EXECUTE de PUBLIC/anon en helpers.
-- El GRANT a authenticated es OBLIGATORIO: las policies RLS los invocan
-- como ese rol; sin él, RLS falla con 'permission denied for function'.
REVOKE EXECUTE ON FUNCTION public.current_user_can_access_team(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_can_access_team(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.storage_team_id(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.storage_team_id(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

-- ── 3) Policies de team_coaches (tras el helper que las alimenta) ─
-- Lectura: co-coaches de mis equipos (o admin). Escritura: SOLO admin
-- (anti auto-asignación; el creador entra por el trigger de §5).
DROP POLICY IF EXISTS "team_coaches: lectura por equipo" ON public.team_coaches;
CREATE POLICY "team_coaches: lectura por equipo" ON public.team_coaches
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "team_coaches: escritura admin" ON public.team_coaches;
CREATE POLICY "team_coaches: escritura admin" ON public.team_coaches
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ── 4) team_settings — config presentacional editable por coach ─
-- color y día de convocatoria NO van en teams (admin-only): aquí sí.
CREATE TABLE IF NOT EXISTS public.team_settings (
  team_id           uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  color             text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  dia_convocatoria  smallint CHECK (dia_convocatoria IS NULL OR dia_convocatoria BETWEEN 1 AND 7),
  reflexion_activa  boolean NOT NULL DEFAULT true,
  asistencia_activa boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_settings ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS team_settings_updated_at ON public.team_settings;
CREATE TRIGGER team_settings_updated_at BEFORE UPDATE ON public.team_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP POLICY IF EXISTS "team_settings: acceso por equipo" ON public.team_settings;
CREATE POLICY "team_settings: acceso por equipo" ON public.team_settings
  FOR ALL TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));

-- ── 5) teams: coach crea/edita + auto-asignación del creador ──
-- (Se suman por OR a la policy admin-FOR-ALL existente de 001.)
DROP POLICY IF EXISTS "teams: coach crea equipos" ON public.teams;
CREATE POLICY "teams: coach crea equipos" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "teams: coach edita sus equipos" ON public.teams;
CREATE POLICY "teams: coach edita sus equipos" ON public.teams
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_team(id))
  WITH CHECK (public.current_user_can_access_team(id));

-- El coach no puede INSERT en team_coaches (admin-only); este trigger
-- SECURITY DEFINER lo hace por él y crea la fila de settings.
-- NOTA (M5): 015 NO reescribe esta función — añade su propio trigger
-- `teams_on_created_reflection` sobre teams. Es a propósito: el runbook de
-- §6 manda re-ejecutar 007 entera en un arranque en frío, y una ampliación
-- hecha aquí se perdería en silencio. Si añades algo al alta de equipo desde
-- otra migración, hazlo también con trigger propio.
CREATE OR REPLACE FUNCTION public.on_team_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.team_coaches (team_id, coach_id, rol)
    VALUES (NEW.id, auth.uid(), 'principal')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  END IF;
  INSERT INTO public.team_settings (team_id)
  VALUES (NEW.id)
  ON CONFLICT (team_id) DO NOTHING;
  RETURN NEW;
END;
$$;
-- Trigger-only: nadie la invoca directamente (ni como RPC).
REVOKE EXECUTE ON FUNCTION public.on_team_created() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS teams_on_created ON public.teams;
CREATE TRIGGER teams_on_created
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.on_team_created();

-- ── 6) Semilla de los 3 equipos existentes (arranque en frío) ──
-- Asigna cada equipo preexistente a cada perfil admin. RUNBOOK: esta
-- semilla exige que el perfil admin YA exista (promoción del paso A6 de
-- GUIA-BACKEND). En la BD actual se cumple. En un entorno recreado desde
-- cero, promociona primero al admin y RE-EJECUTA esta migración entera
-- (es idempotente): la semilla rellenará team_coaches entonces.
-- Nota: un admin ve todo por el helper aunque no tenga fila; la fila le
-- protege si algún día se le degrada a coach.
INSERT INTO public.team_coaches (team_id, coach_id, rol)
SELECT t.id, p.id, 'principal'
FROM public.teams t
CROSS JOIN public.profiles p
WHERE p.role = 'admin'
ON CONFLICT (team_id, coach_id) DO NOTHING;

-- Fila de settings por defecto para los equipos existentes.
INSERT INTO public.team_settings (team_id)
SELECT id FROM public.teams
ON CONFLICT (team_id) DO NOTHING;
