-- ============================================================
-- 037_posiciones_marco_v3.sql — pasa las posiciones que marcó el
-- entrenador al marco 3: las pistas que dibujó él a mano.
--
-- ── QUÉ HA PASADO ───────────────────────────────────────────
-- Los cuatro SVG de pista se han sustituido por los dibujos del
-- entrenador. El lienzo cambia de tamaño en las cuatro, así que una
-- coordenada normalizada que antes caía en el codo ahora cae en otro
-- sitio.
--
--                     marco 2        marco 3
--   entera           19 × 32 m      18 × 27 m
--   entera_fiba      19 × 32 m      18 × 27 m
--   media            18 × 19 m      18 × 18 m
--   media_fiba       18 × 19 m      17 × 18 m
--
-- Las posiciones ESTÁNDAR (aro, codo, esquina…) se recalculan solas
-- desde medidas.js y no necesitan nada. Las que marcó el entrenador
-- con un clic —«el refugio», «mi esquina»— están guardadas aquí y hay
-- que convertirlas.
--
-- ── EL MAPA ─────────────────────────────────────────────────
-- Una recta por eje y por pista, la misma que se ha aplicado a las
-- 1742 coordenadas de la biblioteca (tools/biblioteca/migrar-marco-3.mjs):
-- lleva las dos líneas conocidas del dibujo viejo a esas mismas líneas
-- del nuevo. Los fondos y las bandas en la entera; el fondo y el medio
-- campo en las medias.
--
-- Los coeficientes NO están escritos a mano: salen de
-- `limitesCancha()` de medidas.js, que es la misma fuente que usa la
-- app para pintar. Comprobado punto por punto: el fondo cae en el
-- fondo, la banda en la banda y el medio campo en el medio campo.
--
-- ── DOS COSAS QUE LA 019 DEJÓ CERRADAS ──────────────────────
-- 1. `CHECK (marco IN (1, 2))`. Tal cual, la base RECHAZA una fila en
--    marco 3: esta migración fallaría entera en el UPDATE. Se amplía.
-- 2. `DEFAULT 2`. Desde que se cambiaron los SVG, cada posición nueva
--    se toma sobre el dibujo del marco 3 y se guardaría etiquetada
--    como 2 — y la siguiente migración la movería otra vez. Se pone
--    el 3 ANTES del UPDATE, para que no quede ni un hueco.
--
-- IDEMPOTENTE, y esto importa más que de costumbre: aplicar el mapa
-- dos veces movería todo el doble y no hay forma de deshacerlo. Solo
-- se convierten las filas que siguen en el marco 2.
--
-- Depende de: 005 (posiciones_pista), 019.
-- ============================================================

-- ── 1. Que el marco 3 sea un valor legal ────────────────────
ALTER TABLE public.posiciones_pista DROP CONSTRAINT IF EXISTS posiciones_pista_marco_valido;
ALTER TABLE public.posiciones_pista
  ADD CONSTRAINT posiciones_pista_marco_valido CHECK (marco IN (1, 2, 3));

-- ── 2. Que lo que llegue a partir de ahora nazca en el 3 ────
/* Va ANTES del UPDATE a propósito. Si fuese después, una posición
   guardada entre las dos sentencias nacería como marco 2 y el UPDATE
   la movería sin que le tocara. */
ALTER TABLE public.posiciones_pista ALTER COLUMN marco SET DEFAULT 3;

-- ── 3. Las que están en el 2, al 3 ──────────────────────────
UPDATE public.posiciones_pista SET
  x = LEAST(1, GREATEST(0, CASE pista
        WHEN 'entera'      THEN  0.007407 + 0.985185 * x
        WHEN 'entera_fiba' THEN  0.007407 + 0.985185 * x
        WHEN 'media'       THEN -0.011905 + 0.857143 * x
        WHEN 'media_fiba'  THEN -0.012605 + 0.907563 * x
        ELSE x END)),
  y = LEAST(1, GREATEST(0, CASE pista
        WHEN 'entera'      THEN -0.007937 + 1.015873 * y
        WHEN 'entera_fiba' THEN -0.007937 + 1.015873 * y
        WHEN 'media'       THEN  0.007407 + 0.985185 * y
        WHEN 'media_fiba'  THEN  0.007407 + 0.985185 * y
        ELSE y END)),
  marco = 3
WHERE marco = 2;

COMMENT ON COLUMN public.posiciones_pista.marco IS
  'Dibujo de pista sobre el que se tomaron x e y. 1 = SVG estilizados en hoja A4 (hasta agosto de 2026); 2 = pistas generadas a medidas FIBA; 3 = las que dibujó el entrenador a mano, que son las que hay.';

-- ── Y se dice cómo ha quedado ───────────────────────────────
SELECT marco, count(*) AS posiciones
  FROM public.posiciones_pista
 GROUP BY marco
 ORDER BY marco;
