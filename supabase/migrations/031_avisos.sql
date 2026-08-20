-- ============================================================
-- 031_avisos.sql — Suscripciones push y cola de avisos
-- (Tramos 4.7, 4.8 y 4.13).
--
-- DOS TABLAS Y UNA IDEA
--
--   · `push_suscripciones` — a qué navegador hay que llamar. Una fila
--     por usuario Y dispositivo: la misma persona tiene el móvil y el
--     portátil, y el endpoint es distinto en cada uno.
--
--   · `avisos` — LA COLA. Una fila por aviso y persona, con su
--     `clave`, y un único índice que impide mandar dos veces el mismo.
--
-- POR QUÉ UNA COLA Y NO ENVIAR DIRECTAMENTE
-- Porque los avisos tienen dos productores muy distintos —la función
-- programada (4.8) y los cambios de un entrenador (4.13)— y un solo
-- consumidor. Con una cola, el que produce no sabe nada de VAPID ni de
-- endpoints, y el que envía no sabe nada de baloncesto.
--
-- Y porque en iPhone, sin la app instalada, el push NO llega (§5.8). La
-- cola se puede leer DENTRO de la aplicación, así que el aviso existe
-- aunque la notificación no aparezca. Sin cola, ese entrenador
-- simplemente no se entera de nada.
--
-- LA CLAVE ES LO QUE EVITA EL ACOSO
-- «Sesión sin cerrar» del 22 de agosto es un aviso, no uno cada hora.
-- La clave lo dice: `sesion-sin-cerrar:<session_id>`. El índice único
-- por (usuario, clave) hace imposible el duplicado, incluso si la
-- función programada se ejecuta dos veces por un reintento.
--
-- Idempotente. Depende de: 001 (profiles).
-- ============================================================

-- ── 1. A qué navegador llamar ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_suscripciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  -- para que alguien pueda reconocer y quitar un dispositivo viejo
  dispositivo text,
  -- cuándo se usó por última vez con éxito; el que lleva meses fallando
  -- se puede limpiar sin borrar al usuario
  visto_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

ALTER TABLE public.push_suscripciones ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS push_suscripciones_usuario ON public.push_suscripciones (user_id);

/* Cada uno gestiona SUS dispositivos y nada más. Un entrenador no tiene
   por qué poder listar los endpoints de otro: son direcciones a las que
   se le puede escribir. */
DROP POLICY IF EXISTS "push: solo lo mío" ON public.push_suscripciones;
CREATE POLICY "push: solo lo mío" ON public.push_suscripciones
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 2. La cola de avisos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.avisos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- de los seis de §5.8, o 'equipo' para los de entrenador a entrenador
  tipo        text NOT NULL,
  -- identifica el HECHO, no el envío: 'sesion-sin-cerrar:<uuid>'
  clave       text NOT NULL,
  titulo      text NOT NULL,
  cuerpo      text,
  -- adónde lleva al tocarlo. §5.8: «todo se puede hacer abriendo el aviso»
  url         text,
  creado_at   timestamptz NOT NULL DEFAULT now(),
  -- null = todavía no se ha mandado el push
  enviado_at  timestamptz,
  -- null = no se ha visto ni en la app ni tocando la notificación
  leido_at    timestamptz
);

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

/* El índice que evita el acoso: el mismo hecho, a la misma persona, una
   sola vez. Es un índice y no un CHECK a propósito — así el propio
   INSERT del que produce falla en vez de tener que acordarse de mirar
   antes, y una función programada que se reintenta no duplica nada. */
CREATE UNIQUE INDEX IF NOT EXISTS avisos_sin_repetir
  ON public.avisos (user_id, clave);

CREATE INDEX IF NOT EXISTS avisos_por_mandar
  ON public.avisos (enviado_at) WHERE enviado_at IS NULL;
CREATE INDEX IF NOT EXISTS avisos_sin_leer
  ON public.avisos (user_id, leido_at) WHERE leido_at IS NULL;

COMMENT ON COLUMN public.avisos.clave IS
  'Identifica el HECHO. Con el índice único por (user_id, clave), el mismo aviso no se manda dos veces.';

/* Cada uno ve los suyos. El alta la hace la función programada con la
   clave de servicio, y también un entrenador cuando avisa al otro de su
   equipo (4.13) — de ahí que INSERT no se limite a `auth.uid()`. Lo que
   NO se puede es leer los de otro. */
DROP POLICY IF EXISTS "avisos: leo los míos" ON public.avisos;
CREATE POLICY "avisos: leo los míos" ON public.avisos
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "avisos: marco los míos" ON public.avisos;
CREATE POLICY "avisos: marco los míos" ON public.avisos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "avisos: borro los míos" ON public.avisos;
CREATE POLICY "avisos: borro los míos" ON public.avisos
  FOR DELETE TO authenticated USING (user_id = auth.uid());

/* Avisar a un compañero de equipo (4.13). Se comprueba que el
   destinatario comparte equipo con quien avisa: sin esto, cualquiera
   con sesión podría escribirle una notificación a cualquiera. */
DROP POLICY IF EXISTS "avisos: aviso a los de mi equipo" ON public.avisos;
CREATE POLICY "avisos: aviso a los de mi equipo" ON public.avisos
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.team_coaches mio
      JOIN public.team_coaches suyo ON suyo.team_id = mio.team_id
      WHERE mio.coach_id = auth.uid()
        AND suyo.coach_id = avisos.user_id
    )
  );
