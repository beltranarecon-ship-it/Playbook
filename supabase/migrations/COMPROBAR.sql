-- ============================================================
-- COMPROBAR.sql — ¿Qué migraciones están puestas de verdad?
--
-- No cambia NADA: solo mira y contesta. Pégalo entero en el editor
-- SQL de Supabase y dale a Run.
--
-- Una migración se aplicó de verdad cuando existe lo que crea. Ir por
-- la memoria («creo que esa la puse») es justo lo que hace perder una
-- tarde: la 036 se ejecutó, dio un aviso a mitad y nadie lo leyó.
-- ============================================================

SELECT * FROM (
  VALUES
    ('018 · quitar entrenamientos del calendario',
     to_regclass('public.session_slot_exclusions') IS NOT NULL),

    ('024 · rúbrica de progresión',
     to_regclass('public.rubrica_niveles') IS NOT NULL),

    ('026 · objetivos de cada jugador',
     to_regclass('public.objetivos_individuales') IS NOT NULL),

    ('033 · borrar solo lo que no dejó rastro',
     (SELECT count(*) FROM pg_policies
       WHERE schemaname = 'public'
         AND policyname IN ('sessions: borrado solo andamiaje',
                            'seasons: borrado solo admin y vacías',
                            'teams: borrado solo admin y sin historia')) = 3),

    ('034 · el documento de convocatoria',
     (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND ((table_name = 'matches'       AND column_name IN ('reservas','descansan','desplazamiento','salida_hora','regreso'))
           OR (table_name = 'team_settings' AND column_name = 'conv_club'))) = 6),

    ('035 · borrar equipo y temporada del todo',
     to_regprocedure('public.borrar_equipo_del_todo(uuid,text)')    IS NOT NULL
     AND to_regprocedure('public.borrar_temporada_del_todo(uuid,text)') IS NOT NULL),

    ('036 · que la reflexión se pueda guardar',
     EXISTS (SELECT 1 FROM pg_indexes
              WHERE schemaname = 'public'
                AND indexname = 'reflection_answers_una_por_pregunta'))
) AS t(migracion, puesta)
ORDER BY migracion;
