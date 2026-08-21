-- ============================================================
-- 034_convocatoria_documento.sql — La convocatoria tal y como es
-- el papel de verdad.
--
-- La 030 guardaba una lista plana de convocados. El documento que usa
-- el club (CONVOCATORIA partido MINIBASKET.docx) tiene TRES grupos y
-- no uno:
--
--   CONVOCADOS  los 12 que van al acta
--   RESERVA     los que van por si acaso
--   DESCANSO    el que esa jornada no juega
--
-- ── POR QUÉ TRES LISTAS Y NO UN CAMPO «ESTADO» EN CADA UNO ──
-- Porque el grupo es del PARTIDO, no del jugador. El mismo crío está
-- convocado el sábado y descansa el siguiente, y una columna en
-- `players` solo puede decir una de las dos cosas. Tres listas dentro
-- de la fila del partido es exactamente lo que dice el papel, y se lee
-- de una sola consulta porque siempre se mira con el partido delante
-- (el mismo criterio que la 030).
--
-- ── EL TOPE DE 12 NO ES ESTÉTICA ────────────────────────────
-- «Solamente se podrán inscribir en acta oficial del partido a 12
-- jugadores», y presentarse con menos de 10-12 se sanciona con 2-0 en
-- contra aunque ganes. El tope se comprueba en la aplicación y se
-- AVISA; aquí no se pone un CHECK que impida guardar, porque una
-- convocatoria a medias el miércoles con 14 marcados mientras decides
-- es normal, y perder lo escrito por eso sería peor.
--
-- ── LO QUE NO CAMBIA DE UN PARTIDO A OTRO VA EN EL EQUIPO ───
-- Club, categoría, competición, el pabellón con su dirección y qué hay
-- que llevar se escriben UNA vez por equipo. Cambian cuando cambia la
-- fase o el pabellón, no cada sábado.
--
-- Idempotente. Depende de: 007 (team_settings), 016 (matches), 030.
-- ============================================================

-- ── 1. Los otros dos grupos y el desplazamiento ─────────────
ALTER TABLE public.matches
  -- los que van por si acaso
  ADD COLUMN IF NOT EXISTS reservas   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- el que esa jornada no juega. Sale en el documento a propósito: a un
  -- niño le importa leer su nombre aunque sea para saber que descansa
  ADD COLUMN IF NOT EXISTS descansan  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- «Desplazamiento»: cómo se va. «Autobús del club», «cada uno por su
  -- cuenta». Es una fila del papel y tenía que poder rellenarse
  ADD COLUMN IF NOT EXISTS desplazamiento text,
  -- «Hora y Lugar de Salida»: la hora. El lugar ya es
  -- `convocatoria_lugar` de la 030, que significa justo eso
  ADD COLUMN IF NOT EXISTS salida_hora time,
  -- «Hora y Lugar de Regreso (aproximado)». Texto libre porque es
  -- aproximado: «sobre las 14:30 en Campos Góticos» es la respuesta
  -- honesta, y una hora exacta prometería lo que no se puede cumplir
  ADD COLUMN IF NOT EXISTS regreso    text;

COMMENT ON COLUMN public.matches.reservas IS
  'player_id de la RESERVA del documento de convocatoria (034).';
COMMENT ON COLUMN public.matches.descansan IS
  'player_id de los que DESCANSAN esa jornada. Salen en el documento a propósito.';
COMMENT ON COLUMN public.matches.convocatoria_hora IS
  'Hora de llegada a la cancha de juego. Si está en blanco se deduce de la hora del partido menos team_settings.conv_minutos_antes.';

-- ── 2. La cabecera fija del equipo ──────────────────────────
ALTER TABLE public.team_settings
  ADD COLUMN IF NOT EXISTS conv_club          text,
  ADD COLUMN IF NOT EXISTS conv_categoria     text,
  ADD COLUMN IF NOT EXISTS conv_competicion   text,
  -- pabellón y dirección, tal cual salen en el papel
  ADD COLUMN IF NOT EXISTS conv_cancha        text,
  -- «Qué llevar al partido»: DNI, equipaciones, agua…
  ADD COLUMN IF NOT EXISTS conv_llevar        text,
  -- cuánto antes hay que estar en la cancha (45 en el modelo del club)
  ADD COLUMN IF NOT EXISTS conv_minutos_antes smallint,
  /* La línea morada de debajo del membrete, en dos campos. Van
     separados porque en el papel las etiquetas («Oficina:», «e-mail:»)
     son del sistema y van en redonda, y los datos son del club y van
     en negrita: partir una frase suelta para adivinar dónde empieza
     cada cosa se rompe el día que alguien la escriba de otra forma. */
  ADD COLUMN IF NOT EXISTS conv_oficina       text,
  ADD COLUMN IF NOT EXISTS conv_email         text,
  /* El membrete, en el bucket 'equipos'. La app trae el de CB Palencia
     como imagen por defecto (assets/convocatoria/), que es el club para
     el que se ha hecho; esta columna existe para que otro club no se
     quede encerrado con un membrete ajeno. */
  ADD COLUMN IF NOT EXISTS conv_membrete_path text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_settings_conv_minutos') THEN
    ALTER TABLE public.team_settings
      ADD CONSTRAINT team_settings_conv_minutos
      CHECK (conv_minutos_antes IS NULL OR conv_minutos_antes BETWEEN 0 AND 240);
  END IF;
END $$;

COMMENT ON COLUMN public.team_settings.conv_minutos_antes IS
  'Cuánto antes del partido hay que estar en la cancha. 45 en el modelo del club.';
COMMENT ON COLUMN public.team_settings.conv_cancha IS
  'Pabellón de casa con su dirección, tal y como va en el documento.';
COMMENT ON COLUMN public.team_settings.conv_membrete_path IS
  'Membrete del club para la convocatoria (bucket equipos). Sin él se usa el de CB Palencia que trae la app.';
