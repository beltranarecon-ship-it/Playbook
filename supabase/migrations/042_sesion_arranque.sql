-- ============================================================
-- 042_sesion_arranque.sql — a qué hora empezó DE VERDAD.
--
-- ── EL AGUJERO, Y ES GRANDE ─────────────────────────────────
-- La función programada de avisos pedía esto desde el primer día:
--
--   select('id, team_id, fecha, hora_inicio, estado, evaluada_at, arranque')
--
-- y `sessions.arranque` NO EXISTÍA. Postgres no descarta la columna
-- desconocida: rechaza la consulta ENTERA. Y la línea siguiente de la
-- función hacía `(sesionesR.data || [])`, así que el error se tragaba
-- en silencio: la lista de sesiones quedaba vacía y el generador
-- decidía, cada diez minutos, que no había nada que avisar.
--
-- Resultado: cuatro de los seis avisos —fin de bloque, pasar lista, sin
-- programar y sin cerrar— no han salido nunca, sin un solo error a la
-- vista. El banco de avisos estaba en verde todo ese tiempo porque
-- prueba al que DECIDE, con datos de mentira; la consulta que trae esos
-- datos no la probaba nadie.
--
-- ── POR QUÉ LA COLUMNA Y NO OTRA COSA ───────────────────────
-- El arranque vivía solo en el navegador a propósito (sesion-activa.js:
-- «son ayudas de ESTE rato»), y para la pantalla eso está bien: es la
-- que lo usa. Pero el aviso de fin de bloque lo manda un servidor a las
-- ocho de la tarde, y un servidor no puede leer el localStorage del
-- móvil del entrenador. Sin este dato, ese aviso solo puede salir a la
-- hora del horario, y un entrenamiento que empieza a y cuarto lo
-- recibiría cuarto de hora antes de tiempo, todos los bloques.
--
-- Se guarda cuando el entrenador empieza —o corrige el arranque con
-- «empezamos ahora»—, y NO se toca al planificar: una sesión que no se
-- ha dado tiene `arranque` a NULL, que es como se sabe que no está en
-- marcha.
--
-- ── LO QUE NO CAMBIA ────────────────────────────────────────
-- Los «+5 min» siguen en el navegador. Ésos sí son de ese rato: no los
-- necesita nadie más y lo que queda escrito para siempre es la duración
-- REAL de cada bloque (023) y su tiempo perdido (040).
--
-- `sessions` no tiene REVOKE por columna —a diferencia de `profiles`,
-- ver la 006 y la 041—, así que la columna nace escribible y no hace
-- falta ningún GRANT. La policy «sessions: edición por equipo» (010) ya
-- deja escribirla a los entrenadores del equipo, y solo a ellos.
--
-- Idempotente. Depende de: 010.
-- ============================================================

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS arranque timestamptz;

COMMENT ON COLUMN public.sessions.arranque IS
  'Instante en que el entrenamiento empezo de verdad, escrito por la pantalla de sesion activa. NULL = no se ha llegado a empezar. Lo necesita la funcion programada de avisos para saber a que hora acaba cada bloque: el localStorage del entrenador no lo puede leer un servidor.';

/* Los avisos preguntan por las sesiones de una ventana de tres días y
   miran cuáles están en marcha. Sin índice eso es un recorrido de la
   tabla entera cada diez minutos, para siempre. Parcial: las que tienen
   arranque son unas pocas, y son las únicas por las que se pregunta. */
CREATE INDEX IF NOT EXISTS sessions_arranque
  ON public.sessions (fecha)
  WHERE arranque IS NOT NULL;

-- ── Y se dice cómo ha quedado ─────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'sessions'
             AND column_name = 'arranque')                    AS columna,
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public'
             AND indexname = 'sessions_arranque')             AS indice;
