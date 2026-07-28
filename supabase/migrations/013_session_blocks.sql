-- ============================================================
-- 013_session_blocks.sql — Planificador de sesión. Módulo Sesiones · M4.
--   · session_blocks: los bloques (ejercicios) de una sesión, en orden,
--     con duración e intensidad 1-5. La intensidad se SNAPSHOTEA por bloque
--     (editable), no se lee en vivo del ejercicio. El nombre también se
--     copia (`titulo`) para sobrevivir a que el ejercicio se archive/borre.
--   · session_objectives: vínculo CONGELADO sesión↔objetivo (qué objetivos
--     trabaja esta sesión). objective_id ON DELETE RESTRICT (compromiso M3:
--     un objetivo usado en una sesión no se puede eliminar).
--   · Trigger de carga: recalcula sessions.duracion_total_min y
--     sessions.carga_total (=Σ intensidad×duración) ante cualquier cambio
--     de bloques. Las columnas caché ya existen (010, nullable).
-- Idempotente. Depende de: 010 (sessions + helper can_access_session),
--   011 (objectives), 001 (exercises).
-- ============================================================

-- ── 1) session_blocks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  -- SET NULL: si el ejercicio se archiva/borra, el bloque sobrevive con su
  -- `titulo` (snapshot). Un bloque sin ejercicio es válido (calentamiento, charla).
  exercise_id  uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  orden        smallint NOT NULL DEFAULT 0,
  titulo       text NOT NULL,                 -- snapshot del nombre o texto libre
  -- cota superior además de >0: la caché sessions.duracion_total_min es finita
  -- (ver ALTER a integer abajo) y ningún bloque real dura más de ~10 h.
  duracion_min smallint NOT NULL CHECK (duracion_min BETWEEN 1 AND 600),
  intensidad   smallint NOT NULL CHECK (intensidad BETWEEN 1 AND 5),
  notas        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_blocks_titulo_check CHECK (btrim(titulo) <> '')
);
ALTER TABLE public.session_blocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS session_blocks_sesion ON public.session_blocks (session_id, orden);
DROP TRIGGER IF EXISTS session_blocks_updated_at ON public.session_blocks;
CREATE TRIGGER session_blocks_updated_at BEFORE UPDATE ON public.session_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Endurecimiento de `sessions` (verificación M4) ────────────
-- (i) duracion_total_min pasa a integer: era smallint (010) pero acumula una
--     SUMA de duraciones; con la cota de 600 min/bloque el desbordamiento ya no
--     es alcanzable, pero el tipo estrecho seguía siendo un riesgo. Idempotente
--     (integer→integer es no-op).
ALTER TABLE public.sessions ALTER COLUMN duracion_total_min TYPE integer;

-- (ii) team_id/season_id de una sesión pasan a INMUTABLES, simétrico a lo que
--      011 hace en objectives_guard. Sin esto, mover una sesión a otro equipo
--      (un coach con 2 equipos) dejaría session_objectives (013) enlazando una
--      sesión de B con un objetivo de A — el estado cross-team que el guard del
--      vínculo prohíbe al insertar.
--
--      ESTA MIGRACIÓN YA NO REDEFINE sessions_guard(). Lo hacía con
--      CREATE OR REPLACE sobre la versión de 010, y como 010 también la crea,
--      re-ejecutar 010 (permitido por el runbook) devolvía la versión sin esta
--      protección, en silencio. Dos copias de la misma función divergen: ahora
--      hay UNA, la de 010, que ya incluye esta comprobación.
--      → si necesitas endurecer el guard, hazlo en 010_sessions_core.sql.

-- ── 2) session_objectives (vínculo congelado) ─────────────────
CREATE TABLE IF NOT EXISTS public.session_objectives (
  session_id   uuid NOT NULL REFERENCES public.sessions(id)   ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES public.objectives(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, objective_id)
);
ALTER TABLE public.session_objectives ENABLE ROW LEVEL SECURITY;
-- Soporte del ON DELETE RESTRICT (evita el seq-scan al borrar un objetivo).
CREATE INDEX IF NOT EXISTS session_objectives_objetivo ON public.session_objectives (objective_id);

-- Coherencia inter-equipo (CONTRACT §permisos regla 5): el objetivo y la
-- sesión pertenecen al MISMO equipo. La FK sola no lo comprueba.
CREATE OR REPLACE FUNCTION public.session_objectives_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ses_team uuid;
  v_obj_team uuid;
BEGIN
  SELECT team_id INTO v_ses_team FROM public.sessions   WHERE id = NEW.session_id;
  SELECT team_id INTO v_obj_team FROM public.objectives WHERE id = NEW.objective_id;
  IF v_ses_team IS DISTINCT FROM v_obj_team THEN
    RAISE EXCEPTION 'el objetivo y la sesión no pertenecen al mismo equipo';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.session_objectives_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS session_objectives_guard ON public.session_objectives;
CREATE TRIGGER session_objectives_guard
  BEFORE INSERT OR UPDATE ON public.session_objectives
  FOR EACH ROW EXECUTE FUNCTION public.session_objectives_guard();

-- ── 3) Trigger de carga: recalcula la caché de la sesión ──────
-- carga_total = Σ (intensidad × duración); duracion_total_min = Σ duración.
-- SECURITY DEFINER para actualizar la sesión padre con independencia de la
-- RLS del invocante (que igualmente la cumple: es su equipo). sessions_guard
-- (010) no se opone: no tocamos origen/slot_id/slot_date ni el estado.
CREATE OR REPLACE FUNCTION public.recompute_session_carga()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Ambas sesiones afectadas: si un bloque se MUEVE de S1 a S2 (UPDATE de
  -- session_id), hay que recalcular las DOS, o la origen queda inflada.
  -- En INSERT OLD es NULL; en DELETE NEW es NULL → el filtro los descarta.
  v_ids uuid[] := ARRAY(
    SELECT DISTINCT x FROM unnest(ARRAY[NEW.session_id, OLD.session_id]) AS x
    WHERE x IS NOT NULL);
BEGIN
  UPDATE public.sessions s SET
    duracion_total_min = COALESCE((
      SELECT SUM(b.duracion_min) FROM public.session_blocks b WHERE b.session_id = s.id), 0),
    carga_total = COALESCE((
      SELECT SUM(b.intensidad::int * b.duracion_min) FROM public.session_blocks b WHERE b.session_id = s.id), 0)
  WHERE s.id = ANY(v_ids);
  RETURN NULL;  -- AFTER trigger
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recompute_session_carga() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS session_blocks_carga ON public.session_blocks;
CREATE TRIGGER session_blocks_carga
  AFTER INSERT OR UPDATE OR DELETE ON public.session_blocks
  FOR EACH ROW EXECUTE FUNCTION public.recompute_session_carga();

-- ── 4) Policies (por acceso a la SESIÓN padre) ────────────────
-- session_blocks
DROP POLICY IF EXISTS "session_blocks: lectura" ON public.session_blocks;
CREATE POLICY "session_blocks: lectura" ON public.session_blocks
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "session_blocks: alta" ON public.session_blocks;
CREATE POLICY "session_blocks: alta" ON public.session_blocks
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "session_blocks: edición" ON public.session_blocks;
CREATE POLICY "session_blocks: edición" ON public.session_blocks
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_session(session_id))
  WITH CHECK (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "session_blocks: borrado" ON public.session_blocks;
CREATE POLICY "session_blocks: borrado" ON public.session_blocks
  FOR DELETE TO authenticated
  USING (public.current_user_can_access_session(session_id));

-- session_objectives
DROP POLICY IF EXISTS "session_objectives: lectura" ON public.session_objectives;
CREATE POLICY "session_objectives: lectura" ON public.session_objectives
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "session_objectives: alta" ON public.session_objectives;
CREATE POLICY "session_objectives: alta" ON public.session_objectives
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "session_objectives: borrado" ON public.session_objectives;
CREATE POLICY "session_objectives: borrado" ON public.session_objectives
  FOR DELETE TO authenticated
  USING (public.current_user_can_access_session(session_id));
