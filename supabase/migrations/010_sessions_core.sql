-- ============================================================
-- 010_sessions_core.sql — Núcleo de sesiones. Módulo Sesiones · M2.
-- La tabla `sessions` SIN bloques (session_blocks llega en 013/M4);
-- las columnas caché de carga ya existen (nullable) para no migrar luego.
--
-- Contrato de fechas (CONTRACT.md):
--   · slot_date  = fecha TEÓRICA de la ocurrencia del slot (INMUTABLE).
--                  Es la clave de reconciliación de la auto-generación.
--   · fecha      = fecha PINTADA en el calendario (reprogramar la mueve).
--   Una sesión auto "no tocada" cumple fecha = slot_date. Si difieren,
--   fue movida a mano y la regeneración NI la borra NI la pisa.
-- Ciclo de vida: preliminar → programada → realizada → cancelada(motivo).
-- Idempotente. Depende de: 007 (helper), 009 (team_schedules).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            uuid NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  season_id          uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  -- NO ACTION (default): un slot con sesiones NO puede borrarse suelto
  -- (los slots se DESACTIVAN); el CASCADE de borrar un equipo sí pasa,
  -- porque valida al final de la sentencia, cuando sus sesiones ya cayeron.
  slot_id            uuid REFERENCES public.team_schedules(id),
  fecha              date NOT NULL,
  slot_date          date,                -- NOT NULL si origen='auto' (CHECK abajo)
  hora_inicio        time,
  hora_fin           time,
  lugar              text,
  titulo             text,                -- auto del objetivo (M3), editable
  notas              text,
  material           jsonb NOT NULL DEFAULT '{}',
  estado             text NOT NULL DEFAULT 'preliminar'
                     CHECK (estado IN ('preliminar','programada','realizada','cancelada')),
  origen             text NOT NULL DEFAULT 'manual'
                     CHECK (origen IN ('auto','manual')),
  cancel_motivo      text,
  slot_duracion_min  smallint,            -- duración del slot (aviso de exceso, M4)
  duracion_total_min smallint,            -- caché Σ duración bloques (trigger en 013)
  carga_total        integer,             -- caché Σ intensidad×duración (trigger en 013)
  evaluada_at        timestamptz,         -- sellado al guardar la reflexión (M5)
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- cancelar exige motivo REAL (ni NULL ni en blanco): lo verifica la BD
  CONSTRAINT sessions_cancel_motivo_check
    CHECK (estado <> 'cancelada' OR btrim(coalesce(cancel_motivo, '')) <> ''),
  -- una sesión auto siempre sabe de qué slot y ocurrencia nació
  CONSTRAINT sessions_auto_slot_check
    CHECK (origen <> 'auto' OR (slot_id IS NOT NULL AND slot_date IS NOT NULL))
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS sessions_team_fecha   ON public.sessions (team_id, fecha);
CREATE INDEX IF NOT EXISTS sessions_season_fecha ON public.sessions (season_id, fecha);
CREATE INDEX IF NOT EXISTS sessions_team_estado  ON public.sessions (team_id, estado);
-- Idempotencia de la auto-generación: UNA sesión auto por ocurrencia teórica.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_auto_unica
  ON public.sessions (slot_id, slot_date)
  WHERE origen = 'auto';
-- Soporte del chequeo de FK al borrar slots (cascade de equipo incluido).
CREATE INDEX IF NOT EXISTS sessions_slot
  ON public.sessions (slot_id) WHERE slot_id IS NOT NULL;
DROP TRIGGER IF EXISTS sessions_updated_at ON public.sessions;
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Guardián de integridad (pentest M2) ───────────────────────
-- (a) Identidad inmutable: origen/slot_id/slot_date no se tocan tras nacer
--     (son el ancla de la reconciliación; cambiarlas duplica o corrompe).
-- (b) Sin regresión a 'preliminar': impide "lavar" una realizada/manual
--     para colarla por la policy DELETE de andamiaje y borrar histórico.
-- (c) Coherencia inter-equipo: el slot referenciado pertenece al equipo
--     de la sesión (la FK sola no lo comprueba; CONTRACT §permisos 5).
-- NOTA (M4): 013 AMPLÍA este guard añadiendo la inmutabilidad de team_id/
-- season_id (protege el vínculo congelado session_objectives).
-- ESTA ES LA VERSIÓN ÚNICA Y AUTORITATIVA. Antes 013 la reescribía con más
-- comprobaciones y esta se quedaba como "base": re-ejecutar 010 (el runbook lo
-- permite, y el de 007 lo ORDENA en frío) devolvía la versión débil sin fallar
-- ni avisar, y volvía a dejar mover una sesión de equipo. No se duplica más:
-- 013 ya no la redefine. Si hay que endurecerla, se endurece AQUÍ.
CREATE OR REPLACE FUNCTION public.sessions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- autoría no falsificable (invariante del proyecto: la pone el servidor).
    -- Antes la mandaba el cliente y los uuid de los co-coaches son visibles
    -- por la policy de team_coaches: se podían firmar sesiones a nombre de otro.
    NEW.created_by  := auth.uid();
    NEW.evaluada_at := NULL;          -- una sesión nace sin evaluar
  ELSE
    IF NEW.origen IS DISTINCT FROM OLD.origen
       OR NEW.slot_id IS DISTINCT FROM OLD.slot_id
       OR NEW.slot_date IS DISTINCT FROM OLD.slot_date THEN
      RAISE EXCEPTION 'origen/slot_id/slot_date de una sesión son inmutables';
    END IF;
    -- mover una sesión de equipo dejaría session_objectives (013) enlazando
    -- una sesión de B con un objetivo de A, y la asistencia de jugadores de A
    -- colgando de una sesión de B
    IF NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.season_id IS DISTINCT FROM OLD.season_id THEN
      RAISE EXCEPTION 'team_id/season_id de una sesión son inmutables';
    END IF;
    IF NEW.estado = 'preliminar' AND OLD.estado <> 'preliminar' THEN
      RAISE EXCEPTION 'una sesión % no puede volver a preliminar', OLD.estado;
    END IF;
    NEW.created_by := OLD.created_by;
    -- `evaluada_at` es del servidor: solo la mueven los triggers de sellado de
    -- 015, que corren anidados (profundidad > 1). Un PATCH del cliente llega a
    -- profundidad 1 y no puede tocarla: si no, "evaluada" dejaría de significar
    -- "tiene respuestas" y el dossier de M7 lo repetiría como verdad.
    IF pg_trigger_depth() = 1 THEN
      NEW.evaluada_at := OLD.evaluada_at;
    END IF;
  END IF;
  IF NEW.slot_id IS NOT NULL THEN
    IF (SELECT ts.team_id FROM public.team_schedules ts WHERE ts.id = NEW.slot_id)
       IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'el horario referenciado no pertenece al equipo de la sesión';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sessions_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sessions_guard ON public.sessions;
CREATE TRIGGER sessions_guard
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sessions_guard();

-- ── Helper para tablas hijas (attendance, blocks… — M4/M5) ────
CREATE OR REPLACE FUNCTION public.current_user_can_access_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = p_session_id
      AND public.current_user_can_access_team(s.team_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_can_access_session(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_user_can_access_session(uuid) TO authenticated, service_role;

-- ── Policies ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "sessions: lectura por equipo" ON public.sessions;
CREATE POLICY "sessions: lectura por equipo" ON public.sessions
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "sessions: alta por equipo" ON public.sessions;
CREATE POLICY "sessions: alta por equipo" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "sessions: edición por equipo" ON public.sessions;
CREATE POLICY "sessions: edición por equipo" ON public.sessions
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));

-- DELETE solo del ANDAMIAJE: preliminares auto (la regeneración las poda).
-- Lo demás no se borra: se cancela con motivo (histórico intacto).
--
-- OJO CON EL DROP+CREATE: 015 §7 AMPLÍA esta policy exigiendo además que la
-- sesión no tenga asistencia ni reflexión (cuelgan con CASCADE y se perderían).
-- Si esta migración se re-ejecuta después de 015 —y el runbook permite
-- re-ejecutar cualquiera— un DROP+CREATE a secas devolvía la versión DÉBIL sin
-- avisar, dejando podable una sesión con la lista ya pasada. Una nota cruzada
-- no es una defensa: por eso se crea SOLO SI NO EXISTE. La versión de 015 es
-- la autoritativa y sobrevive a que esto se vuelva a lanzar.
-- (Corolario: para CAMBIAR esta policy hay que borrarla a mano antes, o
--  tocarla en la migración que la endurece.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'sessions'
       AND policyname = 'sessions: borrado solo andamiaje'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "sessions: borrado solo andamiaje" ON public.sessions
        FOR DELETE TO authenticated
        USING (
          public.current_user_can_access_team(team_id)
          AND origen = 'auto' AND estado = 'preliminar'
        )
    $pol$;
  END IF;
END $$;
