-- ============================================================
-- 014_attendance.sql — Asistencia por sesión. Módulo Sesiones · M5.
--   · Snapshot DENSO: al pasar lista se escribe UNA fila por jugador
--     del roster (no solo los ausentes). Así el histórico no cambia
--     cuando el roster cambia después: lo que se guardó, se guardó,
--     y "3 de 12" sigue significando lo mismo dentro de dos meses.
--   · La identidad del jugador NO se copia (a diferencia de
--     session_blocks.titulo): `players` no se borra en duro —la baja
--     es un estado— y la FK sin CASCADE lo garantiza.
--   · Estados: presente · tarde · justificado · lesionado · ausente.
--     'tarde' cuenta como entrenó; 'justificado'/'lesionado' son falta
--     avisada; 'ausente' es la falta que el coach quiere ver.
-- Idempotente. Depende de: 008 (players), 010 (sessions + helper
--   current_user_can_access_session), 001 (update_updated_at).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attendance (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  -- NO ACTION (sin CASCADE) a propósito, mismo truco que sessions.slot_id
  -- (010): un jugador CON historial de asistencia no se puede borrar en duro
  -- (la UI solo da de baja; el histórico no se evapora). Pero borrar el
  -- EQUIPO sigue funcionando: la comprobación es al final de la sentencia,
  -- cuando el CASCADE de sessions ya se llevó estas filas por delante.
  player_id  uuid NOT NULL REFERENCES public.players(id),
  estado     text NOT NULL DEFAULT 'presente'
             CHECK (estado IN ('presente','tarde','justificado','lesionado','ausente')),
  motivo     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, player_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
-- La PK ya indexa (session_id, …) para "la lista de esta sesión".
-- Este índice sirve al chequeo de FK al borrar jugadores Y a la consulta
-- caliente de M5/M7: "% de asistencia de este jugador en la temporada".
CREATE INDEX IF NOT EXISTS attendance_player ON public.attendance (player_id);

DROP TRIGGER IF EXISTS attendance_updated_at ON public.attendance;
CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Guardián de coherencia (CONTRACT §permisos regla 5) ───────
-- (a) El jugador y la sesión son del MISMO equipo. La FK sola no lo
--     comprueba: un coach con dos equipos podría colar a un jugador de A
--     en la lista de B (ambos ids le son visibles) y corromper las dos
--     estadísticas de golpe.
-- (b) Una sesión CANCELADA no tiene asistencia: no se celebró. Se bloquea
--     el alta/edición, no el borrado (limpiar es siempre legítimo).
CREATE OR REPLACE FUNCTION public.attendance_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ses_team   uuid;
  v_ses_estado text;
  v_pl_team    uuid;
BEGIN
  -- (c) la PK es la identidad de la fila: un UPDATE que la mueva reescribe el
  --     histórico de DOS sesiones (o de dos jugadores) sin dejar rastro. La UI
  --     siempre hace upsert con la clave correcta, pero la API REST con el
  --     mismo JWT no tenía nada que se lo impidiera.
  IF TG_OP = 'UPDATE'
     AND (NEW.session_id IS DISTINCT FROM OLD.session_id
          OR NEW.player_id IS DISTINCT FROM OLD.player_id) THEN
    RAISE EXCEPTION 'session_id/player_id de una fila de asistencia son inmutables';
  END IF;

  SELECT s.team_id, s.estado INTO v_ses_team, v_ses_estado
    FROM public.sessions s WHERE s.id = NEW.session_id;
  SELECT p.team_id INTO v_pl_team
    FROM public.players p WHERE p.id = NEW.player_id;

  IF v_ses_team IS DISTINCT FROM v_pl_team THEN
    RAISE EXCEPTION 'el jugador y la sesión no pertenecen al mismo equipo';
  END IF;
  IF v_ses_estado = 'cancelada' THEN
    RAISE EXCEPTION 'una sesión cancelada no tiene asistencia';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.attendance_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS attendance_guard ON public.attendance;
CREATE TRIGGER attendance_guard
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_guard();

-- ── Policies (por acceso a la SESIÓN padre) ───────────────────
DROP POLICY IF EXISTS "attendance: lectura" ON public.attendance;
CREATE POLICY "attendance: lectura" ON public.attendance
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "attendance: alta" ON public.attendance;
CREATE POLICY "attendance: alta" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "attendance: edición" ON public.attendance;
CREATE POLICY "attendance: edición" ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_session(session_id))
  WITH CHECK (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "attendance: borrado" ON public.attendance;
CREATE POLICY "attendance: borrado" ON public.attendance
  FOR DELETE TO authenticated
  USING (public.current_user_can_access_session(session_id));
