-- ============================================================
-- 019_posiciones_marco_v2.sql — pasa el diccionario de posiciones
-- del entrenador al marco NUEVO de las pistas (Tramo 2.1).
--
-- QUÉ PASÓ
-- Las cuatro pistas se han redibujado a medidas reales, con banda de
-- 2 m alrededor. El marco cambió, así que una coordenada normalizada
-- que antes caía en el codo ahora cae en otro sitio. Las posiciones
-- ESTÁNDAR (aro, codo, esquina…) se recalculan solas desde el código
-- y no necesitan nada; las que marcó el entrenador con un clic —«el
-- refugio», «mi esquina»— están guardadas aquí y hay que convertirlas.
--
-- EL MAPA
-- Una recta por eje y por pista, la misma que se aplicó a las 1742
-- coordenadas de la biblioteca (tools/biblioteca/migrar-marco.mjs):
-- lleva las dos líneas conocidas del dibujo viejo —bandas y fondos, o
-- fondo y medio campo en las medias— a esas mismas líneas del dibujo
-- nuevo. Un punto a mitad de camino entre las bandas sigue a mitad de
-- camino.
--
-- IDEMPOTENTE, y esto importa más que de costumbre: aplicar el mapa
-- dos veces movería todo el doble y no hay forma de deshacerlo. La
-- columna `marco` marca en qué dibujo está cada fila; solo se
-- convierten las que siguen en el 1.
--
-- Depende de: 005 (posiciones_pista).
-- ============================================================

-- Las filas que ya existen nacen con marco = 1 (el dibujo viejo);
-- las que se creen a partir de ahora, con 2.
ALTER TABLE public.posiciones_pista
  ADD COLUMN IF NOT EXISTS marco smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.posiciones_pista.marco IS
  'Dibujo de pista sobre el que se tomaron x e y. 1 = SVG estilizados en hoja A4 (hasta agosto de 2026); 2 = pistas a escala real con banda de 2 m.';

UPDATE public.posiciones_pista SET
  x = LEAST(1, GREATEST(0, CASE pista
        WHEN 'entera'      THEN 0.054416 + 0.892061 * x
        WHEN 'entera_fiba' THEN 0.051671 + 0.900712 * x
        WHEN 'media'       THEN -0.055149 + 1.138767 * x
        WHEN 'media_fiba'  THEN -0.056375 + 1.147165 * x
        ELSE x END)),
  y = LEAST(1, GREATEST(0, CASE pista
        WHEN 'entera'      THEN 0.044271 + 0.911458 * y
        WHEN 'entera_fiba' THEN -0.026807 + 1.063183 * y
        WHEN 'media'       THEN 0.06106 + 0.884069 * y
        WHEN 'media_fiba'  THEN 0.009034 + 0.981932 * y
        ELSE y END)),
  marco = 2
WHERE marco = 1;

-- A partir de aquí, todo lo que llegue está ya en el marco nuevo.
ALTER TABLE public.posiciones_pista ALTER COLUMN marco SET DEFAULT 2;

-- Una fila solo puede estar en uno de los dos dibujos conocidos.
ALTER TABLE public.posiciones_pista DROP CONSTRAINT IF EXISTS posiciones_pista_marco_valido;
ALTER TABLE public.posiciones_pista
  ADD CONSTRAINT posiciones_pista_marco_valido CHECK (marco IN (1, 2));
