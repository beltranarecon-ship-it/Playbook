-- ============================================================
-- 026_objetivos_individuales.sql — Un objetivo para UN niño
-- (Tramo 3.10).
--
-- QUÉ CAMBIA
-- Una columna: `objectives.player_id`. Con ella puesta, el objetivo es
-- de ese jugador; en null, del equipo, como hasta ahora.
--
-- POR QUÉ NO UNA TABLA APARTE
-- Porque es exactamente la misma cosa: un título, un periodo, una
-- categoría y una diana de la rúbrica. Una tabla `objetivos_jugador`
-- duplicaría las cinco columnas, la RLS, el formulario, la medida
-- (3.9) y el panel «qué vigilar hoy» — y al mes siguiente una de las
-- dos copias se quedaría atrás.
--
-- El equipo sigue mandando para los permisos: un objetivo individual
-- pertenece a un jugador, y ese jugador es de un equipo. La RLS de
-- `objectives` (011) ya funciona por `team_id` y no hay que tocarla.
--
-- «UNO O DOS VIVOS POR NIÑO» (§5.7) NO SE FUERZA AQUÍ
-- Es una guía de trabajo, no una regla del dato. Un entrenador que en
-- una semana rara tenga tres objetivos abiertos para un crío no está
-- corrompiendo nada: está trabajando. La app se lo dice en pantalla y
-- le deja seguir. Una restricción en la base de datos ahí solo
-- serviría para que alguien no pudiera guardar.
--
-- Idempotente. Depende de: 011 (objectives), 014 (players).
-- ============================================================

ALTER TABLE public.objectives
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.objectives.player_id IS
  'Con valor, el objetivo es de ese jugador (Tramo 3.10). En null, del equipo.';

-- Consulta caliente: los objetivos vivos de los jugadores de un equipo,
-- que es lo que carga la sesión activa en cuanto se abre.
CREATE INDEX IF NOT EXISTS objectives_jugador
  ON public.objectives (player_id, estado)
  WHERE player_id IS NOT NULL;
