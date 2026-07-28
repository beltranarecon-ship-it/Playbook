-- ============================================================
-- 015_reflection.sql — Reflexión post-sesión. Módulo Sesiones · M5.
--   · reflection_questions: PLANTILLA por equipo (estrellas 1-5 y
--     texto), configurable por el coach. Cada pregunta tiene una
--     `clave` estable dentro del equipo — la identidad semántica.
--   · reflection_answers: la respuesta de UNA sesión. Guarda
--     `clave_snapshot` + `etiqueta_snapshot` + `tipo_snapshot` para
--     que el histórico siga siendo legible aunque la plantilla cambie
--     o la pregunta se borre (question_id ON DELETE SET NULL).
--     PK = (session_id, clave_snapshot): la clave ES la identidad.
--   · CLAVE RESERVADA 'cumplimiento' (estrellas): es la que alimenta
--     v_session_cumplimiento, la ÚNICA puerta por la que el dossier
--     (M7) y el progreso de objetivos leen el cumplimiento. Nadie
--     consulta reflection_answers directamente (CONTRACT §columnas).
--   · §7 AMPLÍA la policy de borrado de `sessions` (010): una sesión
--     con asistencia o reflexión ya no es andamiaje podable.
-- Idempotente. Depende de: 007 (helper de equipo), 010 (sessions +
--   helper de sesión), 001 (update_updated_at) y **014 (attendance:
--   la policy de §7 la referencia)**. ORDEN: 014 ANTES que 015.
-- ============================================================

-- ── 1) Plantilla de preguntas (por equipo) ────────────────────
CREATE TABLE IF NOT EXISTS public.reflection_questions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  -- identidad estable y legible: viaja a la respuesta como clave_snapshot
  clave      text NOT NULL CHECK (clave ~ '^[a-z][a-z0-9_]{1,39}$'),
  etiqueta   text NOT NULL CHECK (btrim(etiqueta) <> ''),
  tipo       text NOT NULL CHECK (tipo IN ('estrellas','texto')),
  orden      smallint NOT NULL DEFAULT 0,
  activa     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reflection_questions_clave_unica UNIQUE (team_id, clave),
  -- la clave reservada solo puede ser de estrellas: v_session_cumplimiento
  -- lee valor_num, y un texto ahí dejaría el cumplimiento mudo para siempre
  CONSTRAINT reflection_questions_cumplimiento_check
    CHECK (clave <> 'cumplimiento' OR tipo = 'estrellas')
);
ALTER TABLE public.reflection_questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS reflection_questions_team
  ON public.reflection_questions (team_id, orden);
DROP TRIGGER IF EXISTS reflection_questions_updated_at ON public.reflection_questions;
CREATE TRIGGER reflection_questions_updated_at BEFORE UPDATE ON public.reflection_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- team_id inmutable: si una pregunta saltara de equipo, sus respuestas
-- (ya escritas) quedarían apuntando a la plantilla de otro. Mismo patrón
-- que objectives_guard (011) y sessions_guard (013).
CREATE OR REPLACE FUNCTION public.reflection_questions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'team_id de una pregunta de reflexión es inmutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reflection_questions_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reflection_questions_guard ON public.reflection_questions;
CREATE TRIGGER reflection_questions_guard
  BEFORE UPDATE ON public.reflection_questions
  FOR EACH ROW EXECUTE FUNCTION public.reflection_questions_guard();

-- ── 2) Respuestas de la sesión ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reflection_answers (
  session_id        uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  -- la clave manda: sobrevive a que la pregunta se edite o se borre
  clave_snapshot    text NOT NULL,
  question_id       uuid REFERENCES public.reflection_questions(id) ON DELETE SET NULL,
  etiqueta_snapshot text,
  tipo_snapshot     text NOT NULL CHECK (tipo_snapshot IN ('estrellas','texto')),
  valor_num         smallint CHECK (valor_num IS NULL OR valor_num BETWEEN 1 AND 5),
  valor_texto       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, clave_snapshot),
  -- una respuesta vacía no es una respuesta: no se guarda (se borra la fila).
  -- Así "hay reflexión" es un hecho comprobable, no una fila en blanco.
  CONSTRAINT reflection_answers_valor_check CHECK (
    (tipo_snapshot = 'estrellas' AND valor_num IS NOT NULL AND valor_texto IS NULL)
    OR
    (tipo_snapshot = 'texto' AND valor_num IS NULL AND btrim(coalesce(valor_texto,'')) <> '')
  )
);
ALTER TABLE public.reflection_answers ENABLE ROW LEVEL SECURITY;
-- soporte del ON DELETE SET NULL al borrar una pregunta
CREATE INDEX IF NOT EXISTS reflection_answers_question
  ON public.reflection_answers (question_id) WHERE question_id IS NOT NULL;
DROP TRIGGER IF EXISTS reflection_answers_updated_at ON public.reflection_answers;
CREATE TRIGGER reflection_answers_updated_at BEFORE UPDATE ON public.reflection_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Coherencia inter-equipo (CONTRACT §permisos regla 5) + sesión cancelada.
CREATE OR REPLACE FUNCTION public.reflection_answers_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ses_team   uuid;
  v_ses_estado text;
  v_q_team     uuid;
BEGIN
  -- La PK (session_id, clave_snapshot) ES la identidad: moverla por UPDATE
  -- traslada una respuesta de una sesión a otra —o le cambia el significado—
  -- y además esquiva el sellado de `evaluada_at`, que solo mira INSERT y
  -- DELETE. La UI hace upsert con la clave correcta; la API REST no tenía
  -- por qué comportarse igual.
  IF TG_OP = 'UPDATE'
     AND (NEW.session_id IS DISTINCT FROM OLD.session_id
          OR NEW.clave_snapshot IS DISTINCT FROM OLD.clave_snapshot) THEN
    RAISE EXCEPTION 'session_id/clave_snapshot de una respuesta son inmutables';
  END IF;

  SELECT s.team_id, s.estado INTO v_ses_team, v_ses_estado
    FROM public.sessions s WHERE s.id = NEW.session_id;
  IF v_ses_estado = 'cancelada' THEN
    RAISE EXCEPTION 'una sesión cancelada no se reflexiona';
  END IF;
  IF NEW.question_id IS NOT NULL THEN
    SELECT q.team_id INTO v_q_team
      FROM public.reflection_questions q WHERE q.id = NEW.question_id;
    IF v_q_team IS DISTINCT FROM v_ses_team THEN
      RAISE EXCEPTION 'la pregunta y la sesión no pertenecen al mismo equipo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reflection_answers_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reflection_answers_guard ON public.reflection_answers;
CREATE TRIGGER reflection_answers_guard
  BEFORE INSERT OR UPDATE ON public.reflection_answers
  FOR EACH ROW EXECUTE FUNCTION public.reflection_answers_guard();

-- ── 3) Sellado de sessions.evaluada_at ────────────────────────
-- La columna existe desde 010 esperando este momento. Se sella en la BD,
-- no en el cliente, para que "evaluada_at IS NOT NULL" ⇔ "hay respuestas"
-- sea una verdad del esquema (M7 leerá esa bandera). Es una EQUIVALENCIA,
-- no una implicación: por eso hay dos triggers, uno que sella al escribir
-- y otro que DESSELLA si la sesión se queda sin respuestas — y vaciar una
-- respuesta es el camino normal, no un caso raro (el CHECK prohíbe filas
-- en blanco, así que el cliente las borra).
-- Se sella la PRIMERA evaluación (editar luego no reescribe la fecha).
-- Triggers de SENTENCIA con tabla de transición: un save de 5 respuestas
-- hace UN update, no cinco.
CREATE OR REPLACE FUNCTION public.stamp_session_evaluada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.sessions s
     SET evaluada_at = now()
    FROM (SELECT DISTINCT session_id FROM nuevas) n
   WHERE s.id = n.session_id
     AND s.evaluada_at IS NULL;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stamp_session_evaluada() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reflection_answers_sellado ON public.reflection_answers;
CREATE TRIGGER reflection_answers_sellado
  AFTER INSERT ON public.reflection_answers
  REFERENCING NEW TABLE AS nuevas
  FOR EACH STATEMENT EXECUTE FUNCTION public.stamp_session_evaluada();

-- Borrar la última respuesta deja la sesión SIN evaluar otra vez.
-- (Si la sesión entera se ha borrado en la misma sentencia —CASCADE—, el
-- UPDATE simplemente no encuentra fila: la tupla ya no es visible.)
CREATE OR REPLACE FUNCTION public.unstamp_session_evaluada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.sessions s
     SET evaluada_at = NULL
    FROM (SELECT DISTINCT session_id FROM viejas) v
   WHERE s.id = v.session_id
     AND s.evaluada_at IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.reflection_answers r WHERE r.session_id = s.id);
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.unstamp_session_evaluada() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reflection_answers_dessellado ON public.reflection_answers;
CREATE TRIGGER reflection_answers_dessellado
  AFTER DELETE ON public.reflection_answers
  REFERENCING OLD TABLE AS viejas
  FOR EACH STATEMENT EXECUTE FUNCTION public.unstamp_session_evaluada();

-- ── 4) Plantilla por defecto (3 estrellas + 2 textos) ─────────
-- Fuente ÚNICA de la plantilla: la usan el trigger de alta de equipo, la
-- semilla de los equipos existentes y el botón "Restaurar plantilla" del
-- cliente (vía el wrapper RPC de abajo). Interna: sin comprobación de
-- permisos, y por eso REVOCADA de todo el mundo.
-- ON CONFLICT DO NOTHING: nunca pisa lo que el coach haya personalizado;
-- solo repone las preguntas por defecto que falten.
CREATE OR REPLACE FUNCTION public.seed_reflection_template(p_team_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_n integer;
BEGIN
  INSERT INTO public.reflection_questions (team_id, clave, etiqueta, tipo, orden) VALUES
    (p_team_id, 'cumplimiento',    '¿Se cumplió el plan de la sesión?', 'estrellas', 1),
    (p_team_id, 'intensidad_real', 'Intensidad real del grupo',         'estrellas', 2),
    (p_team_id, 'actitud',         'Actitud y compromiso',              'estrellas', 3),
    (p_team_id, 'que_funciono',    '¿Qué funcionó?',                    'texto',     4),
    (p_team_id, 'que_cambiar',     '¿Qué cambiarías para la próxima?',  'texto',     5)
  ON CONFLICT (team_id, clave) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_reflection_template(uuid) FROM PUBLIC, anon, authenticated;

-- Wrapper RPC: reautoriza por equipo en su 1ª línea (CONTRACT §permisos)
-- y delega. Es lo que llama el cliente para "Restaurar plantilla".
CREATE OR REPLACE FUNCTION public.ensure_reflection_template(p_team_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_can_access_team(p_team_id) THEN
    RAISE EXCEPTION 'sin acceso a este equipo';
  END IF;
  RETURN public.seed_reflection_template(p_team_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_reflection_template(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.ensure_reflection_template(uuid) TO authenticated, service_role;

-- Equipos NUEVOS: trigger PROPIO, no una reescritura de on_team_created (007).
-- Deliberado: el runbook de 007 manda re-ejecutar esa migración entera en un
-- arranque en frío, y una versión ampliada de on_team_created se perdería ahí
-- en silencio (los equipos nuevos nacerían sin preguntas y nadie sabría por
-- qué). Con un trigger aparte, 007 puede re-ejecutarse las veces que haga
-- falta sin tocar esto. Orden de disparo = orden alfabético del nombre:
-- teams_on_created (007) va primero; da igual, la semilla no depende de él.
CREATE OR REPLACE FUNCTION public.on_team_created_reflection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_reflection_template(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.on_team_created_reflection() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS teams_on_created_reflection ON public.teams;
CREATE TRIGGER teams_on_created_reflection
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.on_team_created_reflection();

-- Equipos EXISTENTES: semilla idempotente (re-ejecutable sin efectos).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT id FROM public.teams LOOP
    PERFORM public.seed_reflection_template(t.id);
  END LOOP;
END $$;

-- ── 5) Policies ───────────────────────────────────────────────
DROP POLICY IF EXISTS "reflection_questions: acceso por equipo" ON public.reflection_questions;
CREATE POLICY "reflection_questions: acceso por equipo" ON public.reflection_questions
  FOR ALL TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "reflection_answers: lectura" ON public.reflection_answers;
CREATE POLICY "reflection_answers: lectura" ON public.reflection_answers
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "reflection_answers: alta" ON public.reflection_answers;
CREATE POLICY "reflection_answers: alta" ON public.reflection_answers
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "reflection_answers: edición" ON public.reflection_answers;
CREATE POLICY "reflection_answers: edición" ON public.reflection_answers
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_session(session_id))
  WITH CHECK (public.current_user_can_access_session(session_id));

DROP POLICY IF EXISTS "reflection_answers: borrado" ON public.reflection_answers;
CREATE POLICY "reflection_answers: borrado" ON public.reflection_answers
  FOR DELETE TO authenticated
  USING (public.current_user_can_access_session(session_id));

-- ── 6) v_session_cumplimiento — la puerta única del cumplimiento ─
-- Consumidores (dossier M7, progreso de objetivos) leen SIEMPRE esta
-- vista, nunca reflection_answers: si mañana el cumplimiento se calcula
-- de otra forma, solo cambia esta definición.
-- DROP+CREATE (no OR REPLACE): permite cambiar la lista de columnas al
-- re-ejecutar la migración.
DROP VIEW IF EXISTS public.v_session_cumplimiento;
CREATE VIEW public.v_session_cumplimiento AS
  SELECT
    a.session_id,
    s.team_id,
    s.season_id,
    s.fecha,
    a.valor_num AS cumplimiento,     -- 1..5 (estrellas)
    s.evaluada_at
  FROM public.reflection_answers a
  JOIN public.sessions s ON s.id = a.session_id
  WHERE a.clave_snapshot = 'cumplimiento'
    AND a.tipo_snapshot  = 'estrellas'
    AND a.valor_num IS NOT NULL
    -- Defensa en profundidad Y única barrera si el servidor es PG < 15
    -- (sin security_invoker la vista corre como su dueño, que salta RLS).
    -- current_user_can_access_team() lee auth.uid() del JWT, así que
    -- filtra igual de bien en los dos casos.
    AND public.current_user_can_access_team(s.team_id);

-- security_invoker exige PG ≥ 15 (CONTRACT: versión a confirmar). Si el
-- servidor es anterior, la vista queda igualmente cerrada por el filtro
-- de arriba; esto solo añade la RLS de las tablas base cuando se puede.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    EXECUTE 'ALTER VIEW public.v_session_cumplimiento SET (security_invoker = on)';
  END IF;
END $$;

REVOKE ALL ON public.v_session_cumplimiento FROM PUBLIC, anon;
GRANT SELECT ON public.v_session_cumplimiento TO authenticated, service_role;

-- ── 7) Blindaje del borrado de sesiones (amplía 010) ──────────
-- 010 dejó que se borrara el ANDAMIAJE: preliminares auto intactas. Con M5
-- ese andamiaje puede llevar dentro la lista de asistencia y la reflexión
-- (ambas cuelgan con ON DELETE CASCADE), y la poda del calendario o el botón
-- "Eliminar preliminar" se las llevarían por delante sin aviso ni deshacer.
-- Regla nueva: una sesión de la que ya se ha registrado algo NO es andamiaje.
-- El cliente además promueve a 'programada' al primer guardado del cierre;
-- esto es el cinturón por si esa promoción falla o llega tarde.
-- (Los CASCADE de borrar un equipo no pasan por aquí: las policies no
-- aplican al borrado en cascada.)
DROP POLICY IF EXISTS "sessions: borrado solo andamiaje" ON public.sessions;
CREATE POLICY "sessions: borrado solo andamiaje" ON public.sessions
  FOR DELETE TO authenticated
  USING (
    public.current_user_can_access_team(team_id)
    AND origen = 'auto' AND estado = 'preliminar'
    AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.session_id = sessions.id)
    AND NOT EXISTS (SELECT 1 FROM public.reflection_answers r WHERE r.session_id = sessions.id)
  );
