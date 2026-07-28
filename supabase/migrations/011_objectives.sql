-- ============================================================
-- 011_objectives.sql — Objetivos de trabajo por equipo. Módulo
-- Sesiones · M3.
--   · Un objetivo cubre un RANGO de fechas (solapables entre sí):
--     "del 12 al 25 de enero: salida de presión". Las sesiones cuyo
--     `fecha` cae dentro lo HEREDAN en vivo (se calcula en cliente);
--     el vínculo congelado por sesión (session_objectives) llega en
--     013/M4 junto al planificador.
--   · categoria casa con exercises.type (con tilde) → la sugerencia
--     determinista de ejercicios filtra/puntúa por ella en cliente.
--   · Los objetivos se ARCHIVAN para sacarlos de la vista sin perder
--     historia; el DELETE solo alcanza a los ya archivados (archivar→
--     eliminar), de modo que el histórico nunca se borra de un tiro.
-- Idempotente. Depende de: 007 (helper current_user_can_access_team).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.objectives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  season_id     uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  titulo        text NOT NULL,
  descripcion   text,
  categoria     text NOT NULL CHECK (categoria IN ('técnico','táctico','físico')),
  fecha_inicio  date NOT NULL,
  fecha_fin     date NOT NULL,
  estado        text NOT NULL DEFAULT 'activo'
                CHECK (estado IN ('activo','conseguido','archivado')),
  periodo       daterange GENERATED ALWAYS AS
                (daterange(fecha_inicio, fecha_fin, '[]')) STORED,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT objectives_titulo_check CHECK (btrim(titulo) <> ''),
  CONSTRAINT objectives_rango_check  CHECK (fecha_fin >= fecha_inicio)
);
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

-- Consulta caliente del calendario: objetivos que tocan el rango visible.
CREATE INDEX IF NOT EXISTS objectives_team_fechas
  ON public.objectives (team_id, season_id, fecha_inicio);
-- Consumidores SQL futuros (progreso de objetivos, M5): solape por rango.
CREATE INDEX IF NOT EXISTS objectives_periodo_gist
  ON public.objectives USING GIST (periodo);

DROP TRIGGER IF EXISTS objectives_updated_at ON public.objectives;
CREATE TRIGGER objectives_updated_at BEFORE UPDATE ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Guardián de identidad y autoría (verificación M3) ─────────
-- Mismo patrón que sessions_guard (010):
-- (a) Autoría no falsificable: created_by lo fija el servidor con auth.uid(),
--     nunca el cliente (los uuid de co-coaches son visibles vía team_coaches).
-- (b) Identidad inmutable: team_id/season_id no cambian tras nacer. Si un coach
--     con dos equipos moviera un objetivo de A→B por UPDATE, la herencia viva y
--     el calendario del equipo A lo perderían en silencio, y el vínculo congelado
--     session_objectives (013/M4) quedaría descuadrado (sesión de A ↔ objetivo de B).
CREATE OR REPLACE FUNCTION public.objectives_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
      RAISE EXCEPTION 'team_id de un objetivo es inmutable';
    END IF;
    IF NEW.season_id IS DISTINCT FROM OLD.season_id THEN
      RAISE EXCEPTION 'season_id de un objetivo es inmutable';
    END IF;
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.objectives_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS objectives_guard ON public.objectives;
CREATE TRIGGER objectives_guard
  BEFORE INSERT OR UPDATE ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION public.objectives_guard();

-- ── Policies: todo por acceso al equipo ───────────────────────
DROP POLICY IF EXISTS "objectives: lectura por equipo" ON public.objectives;
CREATE POLICY "objectives: lectura por equipo" ON public.objectives
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "objectives: alta por equipo" ON public.objectives;
CREATE POLICY "objectives: alta por equipo" ON public.objectives
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "objectives: edición por equipo" ON public.objectives;
CREATE POLICY "objectives: edición por equipo" ON public.objectives
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));

-- DELETE solo del ANDAMIAJE: objetivos ya ARCHIVADOS (flujo archivar→eliminar,
-- igual que la UI). Los 'activo'/'conseguido' no se borran de un tiro por la API:
-- para eliminar un objetivo hay que archivarlo antes (acto deliberado), y un
-- conseguido exige reabrir→archivar. Así el histórico no desaparece por un
-- `DELETE ?id=eq.X` suelto, y cuando 013 cree session_objectives(objective_id)
-- ON DELETE RESTRICT, un objetivo realmente usado en sesiones tampoco caerá.
DROP POLICY IF EXISTS "objectives: borrado por equipo" ON public.objectives;
DROP POLICY IF EXISTS "objectives: borrado solo archivados" ON public.objectives;
CREATE POLICY "objectives: borrado solo archivados" ON public.objectives
  FOR DELETE TO authenticated
  USING (
    public.current_user_can_access_team(team_id)
    AND estado = 'archivado'
  );
