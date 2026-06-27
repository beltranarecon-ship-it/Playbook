-- ============================================================
-- Playbook CBP v2 — Migración inicial
-- Tablas: profiles, teams, seasons, exercises
-- ============================================================

-- ── profiles ──────────────────────────────────────────────
-- Una fila por usuario de auth.users. Se crea automáticamente
-- con el trigger de abajo al registrarse un nuevo usuario.

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'coach' CHECK (role IN ('admin', 'coach')),
  full_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger: crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'role', 'coach'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── teams ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text,                         -- 'minibasket', 'alevin', etc.
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Datos iniciales — los 3 equipos del CBP
INSERT INTO public.teams (name, category) VALUES
  ('Minibasket A',      'minibasket'),
  ('Minibasket B',      'minibasket'),
  ('Alevín Tello Téllez', 'alevin')
ON CONFLICT DO NOTHING;

-- ── seasons ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.seasons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,         -- '2025/26'
  start_date  date,
  end_date    date,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Solo puede haber una temporada activa a la vez
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active
  ON public.seasons (is_active)
  WHERE is_active = true;

-- Temporada inicial
INSERT INTO public.seasons (label, start_date, end_date, is_active) VALUES
  ('2025/26', '2025-09-01', '2026-06-30', true)
ON CONFLICT DO NOTHING;

-- ── exercises ─────────────────────────────────────────────
-- Biblioteca global — no pertenece a temporada ni equipo.
-- Sin animation_data en Fase 1: Phase 2 define ese contrato.

CREATE TABLE IF NOT EXISTS public.exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text CHECK (type IN ('técnico', 'táctico', 'físico', 'juego')),
  category      text,                       -- 'defensa', 'ataque', 'transición'...
  difficulty    smallint CHECK (difficulty BETWEEN 1 AND 5),
  duration_min  smallint CHECK (duration_min > 0),
  description   text,
  tags          text[] DEFAULT '{}',
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_archived   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS exercises_type_category ON public.exercises (type, category);
CREATE INDEX IF NOT EXISTS exercises_tags ON public.exercises USING GIN (tags);
CREATE INDEX IF NOT EXISTS exercises_created_by ON public.exercises (created_by);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER exercises_updated_at
  BEFORE UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Función auxiliar para obtener el rol del usuario actual
-- (evita subquery repetida en cada policy)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ── profiles policies ──────────────────────────────────────

CREATE POLICY "profiles: cada usuario ve el suyo, admin ve todos"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "profiles: cada usuario edita el suyo"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── teams policies ────────────────────────────────────────

CREATE POLICY "teams: lectura para todos los autenticados"
  ON public.teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "teams: escritura solo admin"
  ON public.teams FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ── seasons policies ──────────────────────────────────────

CREATE POLICY "seasons: lectura para todos los autenticados"
  ON public.seasons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "seasons: escritura solo admin"
  ON public.seasons FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- ── exercises policies ────────────────────────────────────

CREATE POLICY "exercises: lectura para todos los autenticados"
  ON public.exercises FOR SELECT
  TO authenticated
  USING (NOT is_archived OR public.current_user_role() = 'admin');

CREATE POLICY "exercises: admin puede todo"
  ON public.exercises FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY "exercises: coach crea sus propios"
  ON public.exercises FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "exercises: coach edita los suyos"
  ON public.exercises FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "exercises: coach archiva los suyos (no delete)"
  ON public.exercises FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');
