-- ============================================================
-- 043_exercises_jugada.sql — guardar lo que se DIBUJA, no solo lo que se ve.
--
-- ── EL AGUJERO ──────────────────────────────────────────────
-- `exercises.animacion` guarda la animación ya compilada: posiciones,
-- caminos, pases, cuándo sale cada uno. Es lo que leen el proyector,
-- las miniaturas y el visor de Equipos, y sirve de maravilla para
-- REPRODUCIR un ejercicio. Pero no sirve para seguir EDITÁNDOLO: en la
-- animación ya no está qué acción eligió el entrenador, ni su variante,
-- ni qué tramo es de qué fase, ni qué arranque puso a mano. De una
-- animación no se puede volver a la pizarra sin inventarse la mitad.
--
-- ── QUÉ HACE ────────────────────────────────────────────────
-- Añade `jugada` (§11.3 de ESPEC-PIZARRA-v3.md): la jugada tal y como
-- se dibujó en la Pizarra —la escena al empezar y los tramos de cada
-- fase—, para poder reabrirla y seguir. `animacion` se sigue guardando
-- a la vez, compilada desde la jugada: los que la leen hoy no se
-- enteran de nada.
--
-- Sin valor por defecto y sin rellenar nada: los ejercicios de antes
-- de la Pizarra se quedan con `jugada` a null, y al abrirlos la app los
-- rehace desde las posiciones iniciales de su animación (§11.4).
--
-- ── CÓMO SE APLICA ──────────────────────────────────────────
-- A mano, en el editor SQL de Supabase, como las anteriores. Hasta que
-- se aplique, la app guarda igual que siempre: si la base de datos
-- rechaza la columna, se reintenta sin ella —el mismo trato que ya
-- recibe `marco` desde la 038—. Se puede lanzar dos veces sin miedo.
-- ============================================================

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS jugada jsonb;

COMMENT ON COLUMN public.exercises.jugada IS
  'La jugada de la Pizarra v3 (escena inicial + tramos por fase), para reabrirla y seguir editándola. null = ejercicio anterior a la Pizarra.';
