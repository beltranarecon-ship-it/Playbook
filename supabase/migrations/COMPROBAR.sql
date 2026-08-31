-- ============================================================
-- COMPROBAR.sql — ¿Qué migraciones están puestas de verdad?
--
-- No cambia NADA: solo mira y contesta. Pégalo entero en el editor SQL
-- de Supabase y dale a Run. Salen 36 filas, una por migración.
--
-- ── POR QUÉ ESTO EXISTE ─────────────────────────────────────
-- Ir por la memoria («creo que esa la puse») es lo que hace perder una
-- tarde. Y haber corrido la migración tampoco prueba nada: puede haber
-- salido a medias, haber dado un aviso que el editor no enseña, o haber
-- hecho ROLLBACK entero por un fallo en la última línea.
--
-- La única prueba de que una migración entró es que EXISTA lo que crea.
-- Eso es lo que se mira aquí, objeto por objeto.
--
-- ── CÓMO SE LEE ─────────────────────────────────────────────
--   puesta = 'sí'  → está entera. No hay nada que hacer.
--   puesta = 'NO'  → la columna `falta` dice qué objeto no aparece y
--                    `que_hacer` qué fichero aplicar.
--
-- Una migración a medias —«NO» pero con casi todo presente— es peor que
-- una sin aplicar, porque la app se cree que está. Por eso se enseña lo
-- que falta y no un simple sí/no.
-- ============================================================

WITH esperado(mig, trae, clase, obj) AS (
  VALUES
    -- ── El esqueleto ──────────────────────────────────────
    ('001', 'perfiles, equipos, temporadas y ejercicios', 'tabla',   'profiles'),
    ('001', 'perfiles, equipos, temporadas y ejercicios', 'tabla',   'teams'),
    ('001', 'perfiles, equipos, temporadas y ejercicios', 'tabla',   'seasons'),
    ('001', 'perfiles, equipos, temporadas y ejercicios', 'tabla',   'exercises'),
    ('001', 'perfiles, equipos, temporadas y ejercicios', 'funcion', 'current_user_role'),

    -- ── El taller de ejercicios ───────────────────────────
    ('002', 'la ficha completa del ejercicio',    'columna', 'exercises.animacion'),
    ('002', 'la ficha completa del ejercicio',    'columna', 'exercises.categoria_rama'),
    ('003', 'miniatura y póster del ejercicio',   'columna', 'exercises.thumbnail'),
    ('004', 'duración máxima del ejercicio',      'columna', 'exercises.duration_max'),
    ('005', 'posiciones con nombre en la pista',  'tabla',   'posiciones_pista'),
    ('006', 'que nadie se cambie el rol a sí mismo', 'funcion', 'guard_profiles_role'),

    -- ── Equipos y plantilla ───────────────────────────────
    ('007', 'equipos, entrenadores y ajustes',    'tabla',   'team_coaches'),
    ('007', 'equipos, entrenadores y ajustes',    'tabla',   'team_settings'),
    ('007', 'equipos, entrenadores y ajustes',    'funcion', 'current_user_can_access_team'),
    ('008', 'los jugadores',                      'tabla',   'players'),
    ('009', 'horarios y periodos sin entrenar',   'tabla',   'team_schedules'),
    ('009', 'horarios y periodos sin entrenar',   'tabla',   'no_training_periods'),

    -- ── Sesiones ──────────────────────────────────────────
    ('010', 'las sesiones de entrenamiento',      'tabla',   'sessions'),
    ('010', 'las sesiones de entrenamiento',      'funcion', 'current_user_can_access_session'),
    ('011', 'los objetivos de temporada',         'tabla',   'objectives'),
    ('012', 'la intensidad del ejercicio',        'columna', 'exercises.intensidad'),
    ('013', 'los bloques del guion y su carga',   'tabla',   'session_blocks'),
    ('013', 'los bloques del guion y su carga',   'tabla',   'session_objectives'),
    ('013', 'los bloques del guion y su carga',   'funcion', 'recompute_session_carga'),
    ('014', 'la asistencia',                      'tabla',   'attendance'),
    ('015', 'la reflexión de después del entreno', 'tabla',  'reflection_questions'),
    ('015', 'la reflexión de después del entreno', 'tabla',  'reflection_answers'),
    ('015', 'la reflexión de después del entreno', 'vista',  'v_session_cumplimiento'),

    -- ── Partidos y notas ──────────────────────────────────
    ('016', 'los partidos',                       'tabla',   'matches'),
    ('017', 'las notas del equipo',               'tabla',   'team_notes'),
    ('018', 'quitar entrenamientos del calendario', 'tabla', 'session_slot_exclusions'),

    -- ── Taller, segunda vuelta ────────────────────────────
    ('019', 'saber en qué dibujo se marcó cada posición', 'columna', 'posiciones_pista.marco'),
    ('020', 'el catálogo de acciones',            'tabla',   'acciones'),
    ('021', 'los vídeos de las acciones',         'tabla',   'videos_accion'),
    ('022', 'vídeo en el bloque del guion',       'columna', 'session_blocks.video'),
    ('022', 'vídeo en el bloque del guion',       'tabla',   'videos_bloque'),
    ('023', 'la sesión activa: tiempo real y estrellas', 'columna', 'session_blocks.duracion_real_min'),
    ('023', 'la sesión activa: tiempo real y estrellas', 'tabla',   'session_stars'),

    -- ── Rúbrica y objetivos ───────────────────────────────
    ('024', 'la rúbrica de progresión',           'tabla',   'rubrica_filas'),
    ('024', 'la rúbrica de progresión',           'tabla',   'rubrica_valores'),
    ('025', 'dianas y categorías de objetivo',    'columna', 'objectives.dianas'),
    ('025', 'dianas y categorías de objetivo',    'tabla',   'categorias_objetivo'),
    ('026', 'un objetivo para UN niño',           'columna', 'objectives.player_id'),
    ('027', 'preguntas de reflexión por jugador', 'columna', 'reflection_answers.player_id'),
    ('027', 'preguntas de reflexión por jugador', 'columna', 'reflection_questions.ambito'),

    -- ── Acta, clasificación, convocatoria ─────────────────
    ('028', 'el acta del partido',                'columna', 'matches.periodos'),
    ('028', 'el acta del partido',                'tabla',   'partido_estadisticas'),
    ('029', 'la clasificación de la liga',        'tabla',   'clasificacion'),
    ('030', 'la convocatoria: quién va y a qué hora', 'columna', 'matches.convocados'),
    ('030', 'la convocatoria: quién va y a qué hora', 'columna', 'team_settings.plantilla_path'),

    -- ── Avisos e invitaciones ─────────────────────────────
    ('031', 'los avisos y el push al móvil',      'tabla',   'push_suscripciones'),
    ('031', 'los avisos y el push al móvil',      'tabla',   'avisos'),
    ('032', 'la lista de quién puede entrar',     'tabla',   'invitaciones'),

    -- ── Borrados y documento de convocatoria ──────────────
    ('033', 'borrar solo lo que no dejó rastro',  'politica', 'teams: borrado solo admin y sin historia'),
    ('033', 'borrar solo lo que no dejó rastro',  'politica', 'seasons: borrado solo admin y vacías'),
    ('033', 'borrar solo lo que no dejó rastro',  'politica', 'sessions: borrado solo andamiaje'),
    ('034', 'el documento de convocatoria del club', 'columna', 'matches.reservas'),
    ('034', 'el documento de convocatoria del club', 'columna', 'matches.salida_hora'),
    ('034', 'el documento de convocatoria del club', 'columna', 'team_settings.conv_club'),
    ('035', 'borrar equipo y temporada del todo', 'funcion', 'borrar_equipo_del_todo'),
    ('035', 'borrar equipo y temporada del todo', 'funcion', 'borrar_temporada_del_todo'),
    ('036', 'que la reflexión se pueda guardar',  'indice',  'reflection_answers_una_por_pregunta'),
    /* La 037 no crea nada: mueve coordenadas. Lo único que deja como
       huella es que el marco 3 pase a ser el valor por defecto — y eso
       sirve además para saber que el UPDATE llegó a correr, porque va
       en la misma transacción. */
    ('037', 'las posiciones, al dibujo hecho a mano', 'defecto', 'posiciones_pista.marco=3'),
    ('038', 'saber en qué dibujo está cada ejercicio', 'columna', 'exercises.marco'),
    ('038', 'saber en qué dibujo está cada ejercicio', 'defecto', 'exercises.marco=3'),
    /* Sin ésta, invitar por correo falla SIEMPRE: el upsert apunta a la
       columna `email` y la 032 dejó el índice sobre lower(trim(email)),
       que es una expresión y ON CONFLICT no puede resolverse contra
       ella. Si sale «NO», nadie recibe su invitación. */
    ('039', 'que se pueda invitar y reinvitar por correo', 'indice', 'invitaciones_email_unico'),
    /* Sin ésta se puede parar el tiempo en el entrenamiento, pero lo
       parado no queda escrito: al cerrar no habrá «12 min parados» ni
       el motivo. Nada más deja de funcionar. */
    ('040', 'guardar el tiempo perdido y por qué', 'columna', 'session_blocks.tiempo_perdido_min'),
    ('040', 'guardar el tiempo perdido y por qué', 'columna', 'session_blocks.motivo_perdido')
),

/* Cada clase se busca donde el catálogo de Postgres la guarda. Una
   columna se escribe «tabla.columna» y se parte aquí en dos. */
mirado AS (
  SELECT e.mig, e.trae, e.clase, e.obj,
    CASE e.clase
      WHEN 'tabla'   THEN to_regclass('public.' || e.obj) IS NOT NULL
      WHEN 'vista'   THEN to_regclass('public.' || e.obj) IS NOT NULL
      WHEN 'columna' THEN EXISTS (
        SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = 'public'
           AND c.table_name  = split_part(e.obj, '.', 1)
           AND c.column_name = split_part(e.obj, '.', 2))
      WHEN 'funcion' THEN EXISTS (
        SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = e.obj)
      WHEN 'indice'  THEN EXISTS (
        SELECT 1 FROM pg_indexes i
         WHERE i.schemaname = 'public' AND i.indexname = e.obj)
      WHEN 'politica' THEN EXISTS (
        SELECT 1 FROM pg_policies pp
         WHERE pp.schemaname = 'public' AND pp.policyname = e.obj)
      /* «tabla.columna=valor»: el valor POR DEFECTO de una columna. Es
         la huella de una migración que no crea nada, solo mueve datos. */
      WHEN 'defecto' THEN EXISTS (
        SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = 'public'
           AND c.table_name  = split_part(e.obj, '.', 1)
           AND c.column_name = split_part(split_part(e.obj, '.', 2), '=', 1)
           AND c.column_default = split_part(e.obj, '=', 2))
    END AS hay
  FROM esperado e
)

SELECT
  m.mig                                             AS migracion,
  min(m.trae)                                       AS que_trae,
  CASE WHEN bool_and(m.hay) THEN 'sí' ELSE 'NO' END AS puesta,
  string_agg(m.clase || ' ' || m.obj, ' · ' ORDER BY m.obj)
    FILTER (WHERE NOT m.hay)                        AS falta,
  CASE
    WHEN bool_and(m.hay) THEN ''
    /* La 036 es la única que puede ser IMPOSIBLE en vez de estar
       pendiente: NULLS NOT DISTINCT es de PostgreSQL 15. Si la base es
       anterior no hay nada que aplicar — la app se da cuenta sola y
       guarda fila a fila, que funciona igual. */
    WHEN m.mig = '036' AND current_setting('server_version_num')::int < 150000
      THEN 'No se puede: esta base es PostgreSQL ' || current_setting('server_version')
           || ' y hace falta la 15. No pasa nada: la app guarda fila a fila.'
    ELSE 'Aplica supabase/migrations/' || m.mig || '_*.sql'
  END                                               AS que_hacer
FROM mirado m
GROUP BY m.mig
ORDER BY m.mig;
