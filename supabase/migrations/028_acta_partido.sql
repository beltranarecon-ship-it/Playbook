-- ============================================================
-- 028_acta_partido.sql — El acta del partido, en periodos
-- (Tramo 4.1).
--
-- LA CORRECCIÓN DE DOMINIO (§5.9)
-- En minibasket y alevín NO se juegan minutos: se juegan PERIODOS. El
-- reglamento entero está escrito en periodos —«dos completos jugados y
-- dos descansados de los cinco primeros»— y el acta también. Guardar
-- minutos aquí obligaría a traducir en cada consulta y a inventarse la
-- traducción, porque no existe: un periodo es una unidad, no un rato.
--
-- QUÉ SE GUARDA, Y DÓNDE
--
--   · `partido_estadisticas` — una fila por JUGADOR y partido: QUÉ
--     periodos jugó, cuántos jugó y descansó, puntos y faltas. Es una
--     tabla y no un jsonb dentro del partido porque la pregunta que se
--     hace de verdad va al revés —«¿cuántos periodos lleva Sofía esta
--     temporada?»— y eso, dentro de un jsonb por partido, obliga a
--     leerlos todos y sumar en el cliente (fila 4.4).
--
--   · En `matches`, lo que es del PARTIDO y no de un jugador: el
--     marcador por periodo (ya existía como gancho), las faltas de
--     equipo por periodo y los tiempos muertos. Eso sí es jsonb: son
--     dos listas cortas que solo se leen con el partido delante.
--
-- EL DORSAL VIAJA CONGELADO
-- Como la clave de la reflexión: un crío puede cambiar de dorsal a
-- mitad de temporada, y el acta de noviembre dice lo que decía el acta
-- de noviembre.
--
-- Idempotente. Depende de: 014 (players), 016 (matches).
-- ============================================================

-- ── 1. Lo que es del partido ────────────────────────────────
ALTER TABLE public.matches
  -- cuántos periodos se juegan en esta categoría (6 en minibasket)
  ADD COLUMN IF NOT EXISTS periodos smallint,
  -- [{favor: 3, contra: 2}, …] una entrada por periodo
  ADD COLUMN IF NOT EXISTS faltas_equipo jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tiempos_muertos jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- de dónde salió el acta: 'mano' | 'chat' (Tramo 4.2). Sirve para
  -- saber qué mirar dos veces, no para desconfiar de nadie.
  ADD COLUMN IF NOT EXISTS acta_origen text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_periodos_check') THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_periodos_check
      CHECK (periodos IS NULL OR periodos BETWEEN 1 AND 12);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_acta_origen_check') THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_acta_origen_check
      CHECK (acta_origen IS NULL OR acta_origen IN ('mano', 'chat'));
  END IF;
END $$;

COMMENT ON COLUMN public.matches.periodos IS
  'Cuántos periodos se juegan (Tramo 4.1). En minibasket, seis.';
COMMENT ON COLUMN public.matches.faltas_equipo IS
  'Faltas de equipo por periodo: [{favor, contra}, …].';

-- ── 2. Lo que es de cada jugador ────────────────────────────
CREATE TABLE IF NOT EXISTS public.partido_estadisticas (
  match_id             uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id            uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  -- congelado, como la clave de la reflexión: un crío cambia de dorsal
  -- y el acta de noviembre sigue diciendo lo que decía
  dorsal               smallint,
  -- QUÉ periodos jugó: [1, 2, 4]. El acta oficial es una rejilla jugador ×
  -- periodo, y la regla de la categoría (fila 4.3) habla de «dos completos
  -- jugados y dos descansados DE LOS CINCO PRIMEROS»: con solo un contador
  -- no se puede comprobar, porque no se sabe cuáles fueron.
  -- Puede venir vacío —un acta dictada al chat (4.2) suele dar el total y
  -- no la rejilla—; entonces mandan los contadores y 4.3 dice que esa regla
  -- no la puede mirar, que es la verdad.
  periodos             jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- El recuento. Se deriva de `periodos` cuando la rejilla está, y se guarda
  -- igualmente para que «cuántos periodos lleva Sofía esta temporada» (4.4)
  -- sea una suma y no un recorrido de jsonb.
  periodos_jugados     smallint NOT NULL DEFAULT 0 CHECK (periodos_jugados BETWEEN 0 AND 12),
  periodos_descansados smallint NOT NULL DEFAULT 0 CHECK (periodos_descansados BETWEEN 0 AND 12),
  puntos               smallint NOT NULL DEFAULT 0 CHECK (puntos BETWEEN 0 AND 200),
  faltas               smallint NOT NULL DEFAULT 0 CHECK (faltas BETWEEN 0 AND 10),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

ALTER TABLE public.partido_estadisticas ENABLE ROW LEVEL SECURITY;

-- La consulta de 4.4 va por jugador: «¿cuánto lleva esta temporada?»
CREATE INDEX IF NOT EXISTS partido_estadisticas_jugador
  ON public.partido_estadisticas (player_id);

/* Manda el partido: si lo ves, ves sus estadísticas; si lo editas, las
   escribes. Se comprueba contra `matches` para no tener dos
   definiciones de «este partido es de un equipo mío». */
DROP POLICY IF EXISTS "partido_estadisticas: lectura por partido" ON public.partido_estadisticas;
CREATE POLICY "partido_estadisticas: lectura por partido" ON public.partido_estadisticas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id));

DROP POLICY IF EXISTS "partido_estadisticas: alta por partido" ON public.partido_estadisticas;
CREATE POLICY "partido_estadisticas: alta por partido" ON public.partido_estadisticas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id));

DROP POLICY IF EXISTS "partido_estadisticas: edición por partido" ON public.partido_estadisticas;
CREATE POLICY "partido_estadisticas: edición por partido" ON public.partido_estadisticas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id));

DROP POLICY IF EXISTS "partido_estadisticas: borrado por partido" ON public.partido_estadisticas;
CREATE POLICY "partido_estadisticas: borrado por partido" ON public.partido_estadisticas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id));

DROP TRIGGER IF EXISTS partido_estadisticas_updated_at ON public.partido_estadisticas;
CREATE TRIGGER partido_estadisticas_updated_at
  BEFORE UPDATE ON public.partido_estadisticas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
