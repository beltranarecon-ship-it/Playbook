# CONTRACT.md — Contrato de esquema del módulo Sesiones / Gestión de equipos (CBP v2)

> **M0 · Fuente única de verdad.** Todo `data/*.js` y todo SQL del módulo se escribe
> contra estos nombres. Ningún subsistema redefine tablas, columnas ni el helper de
> permisos con otro nombre. Congelado en M0; los cambios pasan por aquí primero.
>
> Origen: reconciliación de la revisión adversarial (21 agentes). Ver el plan maestro.

## Convenciones transversales (no negociables)

| Regla | Valor |
|---|---|
| Idioma de columnas de dominio | **español** (`fecha`, `estado`, `intensidad`, `titulo`…) — coherente con 005 |
| Día de la semana | **ISO 1–7** (1=lun … 7=dom) en *todas* las columnas. Cliente: `EXTRACT(ISODOW)`, nunca `getDay()` 0–6 |
| Categorías de objetivo | `'técnico' | 'táctico' | 'físico'` **con tilde** (casan con `exercises.type` de 001) |
| Posición de jugador | `'base'|'escolta'|'alero'|'ala-pivot'|'pivot'|'sin definir'` (literal con espacio) |
| Dominios (estados, roles…) | `text CHECK (col IN (...))`, no `ENUM` (estilo 001–005) |
| Identidad / tiempo | `uuid PK DEFAULT gen_random_uuid()`, `timestamptz DEFAULT now()`, trigger `update_updated_at()` |
| `created_by` | `uuid REFERENCES public.profiles(id) ON DELETE SET NULL` |
| `season_id` | `NOT NULL ON DELETE RESTRICT` en tablas operativas. Temporadas se **archivan** (flag), no se borran |
| Migraciones | serie contigua con **dueño único** por fichero; idempotentes (`IF NOT EXISTS`, `DROP … IF EXISTS`) |
| Puntos de integración | `sw.js`, `netlify.toml`, `serve.py`, el helper RLS y la topbar: **solo** los toca el hito de integración |

## Helper canónico de permisos (uno solo)

```
public.current_user_can_access_team(p_team_id uuid) -> boolean
  SECURITY DEFINER STABLE SET search_path = public
  = current_user_role() = 'admin'
    OR EXISTS (team_coaches donde team_id = p_team_id AND coach_id = auth.uid())
```

- Tablas que cuelgan **directas** del equipo → `USING (current_user_can_access_team(team_id))`.
- Tablas **hijas** (via `session_id`) → helper derivado `current_user_can_access_session(uuid)` con el mismo patrón.
- Toda función `SECURITY DEFINER` que reciba un id de entidad **reautoriza por equipo** en su 1ª línea + `REVOKE EXECUTE FROM public`.
- Toda VISTA lleva `security_invoker = on` (exige PG ≥ 15 — a confirmar) **y** filtro por equipo como defensa en profundidad.

## Mapa de migraciones (dueño único, orden por dependencias)

| Nº | Fichero | Contenido | Hito |
|----|---------|-----------|------|
| 006 | `security_hardening` | fix `profiles.role`, `search_path` en `current_user_role` | **M1** ✔ |
| 007 | `team_foundation` | helper `can_access_team` + `storage_team_id` + `team_coaches` + `team_settings` + teams RLS (coach crea) + auto-asignación + semilla | **M1** ✔ |
| 008 | `players` | roster + bucket `jugadores` + RLS + Storage | **M1** ✔ |
| 009 | `schedules_no_training` | `team_schedules` + `no_training_periods` (daterange) | **M2** |
| 010 | `sessions_core` | `sessions` (tabla + RLS + helper `can_access_session`) — SIN bloques | **M2** |
| 011 | `objectives` | `objectives` (daterange, solapables) + sugerencia | M3 |
| 012 | `exercise_intensidad` | `exercises.intensidad` 1–5 + control en Taller + backfill | M4 |
| 013 | `session_blocks` | `session_blocks` + `session_objectives` + trigger carga | M4 |
| 014 | `attendance` | `attendance` (snapshot denso) | M5 |
| 015 | `reflection` | `reflection_questions` (plantilla) + `reflection_answers` + `v_session_cumplimiento` | M5 |
| 016 | `matches` | `matches` (+hooks jsonb v2) + bucket `actas` | M6 |
| 017 | `team_notes` | `team_notes` | M7 |

> **Enmienda M7 (2026-07-27):** dossier exportable. `017` añade `team_notes`
> (`fecha` NULLABLE = vale para toda la temporada, `titulo`, `cuerpo`) con
> `team_notes_guard` (autoría por `auth.uid()`, `team_id`/`season_id`
> inmutables) y acceso por equipo. A diferencia de sesiones/partidos/objetivos,
> una nota **sí se borra**: es un apunte, no un registro del que dependa nada.
> El corazón de M7 es el motor **puro y determinista** `equipos/js/data/dossier.js`
> (banco 19/19): `construirDossier()` devuelve Markdown y **no consulta el reloj**
> — la fecha de generación entra por parámetro — y ordena por (fecha, id), de
> modo que las mismas entradas dan SIEMPRE el mismo texto (test explícito
> reordenando las entradas). Secciones: equipo · resumen de la temporada ·
> objetivos por estado con en cuántas sesiones se trabajaron · tabla de
> asistencia por jugador · sesión a sesión (carga, asistencia, quién faltó y por
> qué, objetivos y la reflexión) · partidos con marcador, valoraciones y claves ·
> notas. Los textos multilínea se aplanan para no romper el Markdown.
> `dossier-fuente.js` recoge de Supabase con **degradación por bloque** (una
> migración sin aplicar resta una sección, no tumba el documento) y reutiliza la
> asistencia ya traída para el acumulado. Vista `/dossier/:teamId`: rango con
> atajos, resumen en pantalla, editor de notas y **copiar al portapapeles /
> descargar .md**. Sigue la decisión congelada: **ni chat integrado ni llamadas
> a IA — coste cero**; el documento es el producto.
> **Integración (arreglo M6+M7):** `serve.py` y `netlify.toml` solo enrutaban
> `/equipos/*` y `/sesiones/*`; `/partidos/*` (M6) y `/dossier/*` (M7) daban
> **404 al recargar o al pegar el enlace** (la navegación con pushState sí
> funcionaba, y por eso se cuela fácil). Ambos ficheros incluyen ya las rutas.
> Toda ruta nueva de la SPA debe darse de alta en los dos.
>
> **Enmienda M6 (2026-07-27):** partidos. `016` añade `matches`: identidad
> (`team_id`, `season_id`, `fecha`, `hora`, `lugar`, `rival`, `es_local`),
> `estado('programado'|'jugado'|'aplazado'|'cancelado')`, marcador 0-300,
> las **cinco valoraciones 1-5** (`val_defensa/ataque/actitud/acierto/global`),
> `claves`, `acta_path`, `valorada_at`, `convocatoria_cerrada` y los ganchos
> **v2 vacíos** (`marcador_cuartos`, `convocados`, `estadisticas` jsonb) para no
> volver a migrar la tabla. CHECK duro: **un `jugado` exige marcador** (si no,
> el balance mentiría). `matches_guard` (BEFORE, SECURITY DEFINER) fija
> `created_by := auth.uid()`, hace `team_id`/`season_id` inmutables y calcula
> `valorada_at` ⇔ hay alguna valoración — misma doctrina que `evaluada_at` en
> 015, pero en la propia fila (basta un BEFORE). DELETE **solo `programado`**:
> lo jugado/aplazado/cancelado es histórico, se corrige, no se borra. Bucket
> privado **`actas`** (10 MB; JPG/PNG/WebP/PDF) con el mismo guard `storage_team_id`
> que `jugadores` (008). Motor puro `equipos/js/data/partidos.js` (banco 17/17):
> `resultadoPartido` solo habla si el partido está jugado y con marcador;
> `balancePartidos` (V-D-E, puntos, dif. media, %victorias y **racha**, que los
> no jugados no cortan); `mediasPorEje`; `validaPartido` avisa en lenguaje de
> entrenador antes de que lo rechace la BD. Vista `/partidos/:matchId`
> (`partido.js`), chips de partido en el calendario (mes y semana) + alta rápida
> en el panel de día, y pestaña **Partidos** en la ficha del equipo con el
> balance de la temporada. El widget de estrellas se unifica en
> `ui/components.js` (`estrellas()`), compartido con la reflexión de M5.
> **Convocatoria + PDF y valoración por jugador siguen siendo v2**, según la
> decisión congelada.
>
> **Enmienda TEMPORADAS (2026-07-27, fuera de hito):** la app no tenía forma de
> abrir una temporada nueva y `getTemporadaActiva` exigía `is_active=true` con
> `.single()`. Con la 2025/26 ya terminada (30-jun-2026), la auto-generación
> seguía poblando **solo ese rango**: 86 sesiones en el pasado y un calendario
> vacío donde el entrenador miraba, sin explicación. Ahora: `data/seasons.js`
> (getTemporadas · crearTemporada · activarTemporada, escritura admin por la RLS
> de 001) con **lectura tolerante** (activa → la que contiene hoy → la más
> reciente), de modo que el hueco entre desactivar una y activar otra no tumba
> la app; helpers puros en `programacion.js` (`temporadaCubre`, `estadoTemporada`,
> `proponerTemporada` — el año deportivo arranca el 1-sep) con 4 casos en el
> banco; `views/temporada-form.js` = banner de aviso cuando hoy cae fuera +
> modal de gestión/alta; el calendario **abre por el inicio de temporada** si hoy
> queda fuera; la confirmación de regenerar **dice siempre el rango**; los días
> sin entreno fuera de temporada se marcan «fuera de temporada» y se avisa al
> darlos de alta; y al abrir temporada nueva se ofrece **copiar los horarios**
> de la anterior (son por temporada y había que reescribirlos a mano).
>
> **Enmienda M5 (2026-07-26):** post-sesión. `014` añade `attendance`
> (**snapshot DENSO**: una fila por jugador del roster al pasar lista, no solo
> los ausentes → "3 de 12" sigue significando lo mismo dentro de dos meses).
> PK `(session_id, player_id)`; estados `presente·tarde·justificado·lesionado·
> ausente` (tarde cuenta como entrenó; justificado/lesionado = falta avisada).
> `player_id` **sin CASCADE** (NO ACTION, mismo truco que `sessions.slot_id`):
> un jugador con historial no se borra en duro, pero borrar el EQUIPO sigue
> funcionando (la FK se comprueba al final de la sentencia). Guard: jugador y
> sesión del mismo equipo **y** una sesión `cancelada` no tiene asistencia.
> `015` añade `reflection_questions` (plantilla por equipo: estrellas 1-5 y
> texto, con `clave` estable + `orden` + `activa`) y `reflection_answers` con
> **PK `(session_id, clave_snapshot)`** — la clave ES la identidad, así la
> respuesta sobrevive a que la pregunta se edite o se borre (`question_id`
> ON DELETE SET NULL). **Clave reservada `cumplimiento`** (solo `estrellas`,
> atada por CHECK): es la que alimenta `v_session_cumplimiento(session_id,
> team_id, season_id, fecha, cumplimiento 1-5, evaluada_at)`, con
> `security_invoker` cuando el servidor es PG ≥ 15 **y** filtro por equipo en
> el cuerpo como única barrera si es anterior. Plantilla por defecto
> (3 estrellas + 2 textos) en `seed_reflection_template()` como fuente única:
> la usan la semilla, un trigger **propio** (`teams_on_created_reflection`) y
> el RPC `ensure_reflection_template()` ("Restaurar plantilla"). `on_team_created`
> (007) **NO se reescribe** a propósito: su runbook manda re-ejecutar 007 entera
> en frío y la ampliación se perdería en silencio. `sessions.evaluada_at` se
> sella y **se DESsella** en BD (dos triggers de sentencia con tabla de
> transición) → `evaluada_at IS NOT NULL` ⇔ "hay respuestas", equivalencia y no
> implicación. Motores puros `equipos/js/data/asistencia.js` (banco 17/17) y
> `reflexion.js` (21/21). Vista `/sesiones/:sessionId/cierre` (`sesion-cierre.js`);
> `team_settings.asistencia_activa`/`reflexion_activa` se respetan; editor de
> preguntas y ambos interruptores en la pestaña Ajustes; % de asistencia
> acumulado en la pestaña Plantilla.
> **Blindaje M5 (verificación adversarial):** (a) **§7 de 015 AMPLÍA la policy
> DELETE de `sessions` (010)**: una preliminar con asistencia o reflexión ya no
> es andamiaje podable — sin esto, la regeneración del calendario (o "Eliminar
> preliminar") se llevaba por CASCADE la lista recién pasada; (b) el cierre
> **promueve preliminar→programada al primer guardado** (simétrico al planner
> de M4, que era justo lo que tapaba el agujero); (c) `aplicarPlan` cuenta las
> sesiones **realmente** borradas (`.select('id')`) y reporta las conservadas;
> (d) una respuesta guardada en otro formato (la pregunta cambió de tipo o se
> reutilizó la clave) viaja como `conflicto`: se enseña y **no se borra** al
> guardar; (e) `claveDesdeEtiqueta` trata `cumplimiento` como reservada si el
> tipo no es estrellas (evitaba un error crudo de Postgres en pantalla);
> (f) volver a "presente" borra el motivo. NOTA de honestidad: de las 4 lentes
> adversariales solo completó la de **contrato** (límite de gasto mensual); sus
> 5 hallazgos se verificaron a mano contra el código y se arreglaron todos. Las
> dimensiones SQL/RLS, motor/datos y UI quedaron cubiertas por revisión propia
> + 85 tests de banco + verificación del grafo de imports (230 imports).
>
> **Enmienda M4 (2026-07-23):** planificador de sesión. `012` añade
> `exercises.intensidad` 1-5 (carga FÍSICA, distinta de `difficulty` técnica 1-6);
> **sin backfill** desde difficulty (ejes distintos → daría cargas falsas): NULL =
> "sin fijar", el planificador arranca cada bloque en 3. Control de intensidad
> añadido al Taller (wizard `paso3` + `editor`, mapeado en `draft.aRegistro` y
> `guardarEjercicio`). `013` añade `session_blocks` (orden · duración · intensidad
> 1-5; `titulo` = snapshot del nombre para sobrevivir al archivado del ejercicio;
> `exercise_id` ON DELETE SET NULL, bloque sin ejercicio válido) y `session_objectives`
> (vínculo congelado; **`objective_id` ON DELETE RESTRICT** — cumple el compromiso M3;
> guard de coherencia inter-equipo). Trigger `recompute_session_carga` recalcula
> `sessions.duracion_total_min` y `sessions.carga_total (=Σ int×min)` ante cualquier
> cambio de bloques. Curva de carga = motor puro `equipos/js/data/carga.js` (banco
> Node 13/13). Guardar el plan de una preliminar la promueve a `programada`.
> **Blindaje 013 (verificación adversarial, 5 media/3 baja, sin bloqueantes):**
> `recompute_session_carga` recalcula AMBAS sesiones si un bloque cambia de
> `session_id` (no solo la destino); `sessions_guard` **ampliado** en 013 para hacer
> `team_id`/`season_id` inmutables (protege el vínculo congelado, simétrico a
> objectives_guard); `sessions.duracion_total_min` promovido a **integer** +
> `session_blocks.duracion_min BETWEEN 1 AND 600` (evita overflow); `guardarBloques`
> decide insert/update contra lo que HAY en BD (no pierde bloques por id obsoleto);
> `guardarObjetivosSesion` upsert idempotente; planner **solo-lectura** en
> realizada/cancelada; auto-marca de objetivos solo si la sesión nunca se planificó
> (sin bloques); aviso de cambios sin guardar (beforeunload + confirmación al salir).
>
> **Enmienda M3 (2026-07-23):** la premisa "categorías de objetivo casan con
> `exercises.type`" quedó rota en datos: **002 eliminó `exercises_type_check`** y el
> Taller escribe types libres ('Tiro', '1vs1'…). `objectives.categoria` mantiene su
> dominio cerrado ('técnico'|'táctico'|'físico'), pero el motor de sugerencias
> (`equipos/js/data/sugerencias.js`) trata `exercises.type` como señal de TEXTO
> normalizado (token match), nunca como enum. Herencia viva M3 = calculada en cliente
> por fechas; el vínculo congelado por sesión (`session_objectives`) sigue en 013/M4.
> **Blindaje 011 (verificación adversarial):** (a) `objectives_guard` trigger
> (SECURITY DEFINER) fija `created_by := auth.uid()` en INSERT y hace `team_id`/
> `season_id` INMUTABLES en UPDATE — igual que `sessions_guard`; (b) el DELETE de
> `objectives` solo alcanza a `estado='archivado'` (flujo archivar→eliminar): el
> histórico ('conseguido') no se borra de un tiro. **Compromiso para 013:**
> `session_objectives.objective_id` será **`ON DELETE RESTRICT`** — un objetivo
> realmente usado en una sesión no podrá eliminarse aunque se archive.
>
> **Enmienda M2 (2026-07-23):** `sessions` (núcleo, sin bloques) se adelanta a M2 como
> `010_sessions_core` — la auto-generación del calendario escribe en `sessions`, así que
> no podía esperar a M4. Los bloques (`session_blocks`) siguen en M4 (013). El resto se
> renumera en cadena. La auto-generación se ejecuta EN CLIENTE como motor puro y
> determinista (`equipos/js/data/programacion.js`, testeado en Node) que produce un plan
> {insertar, actualizar, borrar}; la capa de datos lo aplica bajo RLS. El índice único
> parcial `(slot_id, slot_date) WHERE origen='auto'` protege contra duplicados en BD.

> **Enmienda VERIFICACIÓN M5·M6·M7 (2026-07-27):** revisión adversarial multi-agente de
> los tres hitos (5 lentes: SQL/RLS, motores puros, capa de datos, vistas, contrato).
> **19 defectos confirmados y arreglados.** Reglas que quedan fijadas:
>
> 1. **Un DELETE rechazado por RLS no da error**: PostgREST filtra la fila y responde 0.
>    Toda función de borrado devuelve el recuento real (`.select('id')`) y la vista actúa
>    en consecuencia. Ya lo hacía `sessions.aplicarPlan`; ahora también `borrarPreliminar`
>    y `borrarPartido`. **Ningún botón puede decir «eliminado» sin comprobarlo.**
> 2. **Supabase corta en `max-rows` (1000) sin avisar.** Toda lectura que pueda crecer con
>    la temporada usa `leerTodo()` de `data/_client.js` (paginación por filas realmente
>    devueltas) + un `.order()` determinista, obligatorio para que las páginas no repitan
>    ni omitan. El snapshot denso de asistencia pasa de mil en una temporada normal.
> 3. **`disponible[pieza] === false` significa «la consulta falló», nunca «no hay datos».**
>    El dossier escribe «no se pudo leer» y una sección final con lo que no pudo consultar,
>    en vez de un cero. Un dossier que dice «0 partidos» cuando la tabla no existe es una
>    afirmación falsa en un documento que el entrenador pega como registro.
> 4. **El cumplimiento entra al motor del dossier YA resuelto por `v_session_cumplimiento`**
>    (`cumplimientoPorSesion`). El motor no toca `reflection_answers`: la vista es la única
>    puerta, como decía este contrato y no cumplía el código.
> 5. **Una sesión cancelada no promedia**, ni en la media de asistencia ni en la tabla por
>    jugador — coincide ya con `getAsistenciaEquipo`, que sí las excluía.
> 6. **Determinismo del dossier**: se ordenan también jugadores y objetivos, y la tabla de
>    asistencia desempata por `player_id`. Las celdas Markdown escapan el `|`.
> 7. **Toda navegación que salga de una vista con cambios sin guardar pasa por su guardián.**
>    Un `<a data-link>` pelado lo esquiva (pushState no dispara `beforeunload`): usar el
>    helper `enlaceGuardado()` de la vista.
> 8. **Toda carga asíncrona re-disparable lleva token de turno** (`mio !== turno → descartar`)
>    y todo botón que escribe se deshabilita durante el `await`.
> 9. **UNA MIGRACIÓN NUNCA REDEFINE UN OBJETO QUE OTRA POSTERIOR ENDURECE.** Era el fallo
>    más caro de la revisión, y había DOS casos, los dos en `010`, los dos silenciosos:
>    `013` reescribía `sessions_guard()` (para hacer `team_id`/`season_id` inmutables) y
>    `015 §7` reescribía la policy de DELETE de `sessions`. Re-ejecutar `010` —que el
>    runbook permite y el de `007` ordena en frío— devolvía las versiones débiles sin
>    fallar ni avisar: volvía a poder moverse una sesión de equipo, y la regeneración del
>    calendario volvía a poder podar una preliminar con lista y reflexión ya guardadas.
>    Ahora: `sessions_guard()` vive **solo en `010`**, ya completo (`013` ya no lo toca), y
>    la policy de DELETE de `010` se crea **solo si no existe**, para que mande la de `015`.
>    Comentarios cruzados como «la versión de 013 es la autoritativa» NO son un control.
> 10. **La autoría y los sellos temporales son del servidor, siempre.** `sessions.created_by`
>    lo ponía el cliente (los uuid de los co-coaches son visibles): ahora lo impone
>    `sessions_guard` con `auth.uid()`, como ya hacían objectives/matches/team_notes.
>    `sessions.evaluada_at` solo la mueven los triggers de sellado de `015` (se protege con
>    `pg_trigger_depth() = 1`), y `matches.valorada_at` ignora lo que mande el cliente.
> 11. **Un estado histórico no regresa.** `matches` no vuelve a `'programado'` desde
>    jugado/aplazado/cancelado (era el camino para borrar en dos clics un partido con
>    marcador, valoraciones y acta), simétrico a la no-regresión a `'preliminar'` de
>    `sessions`. La UI apaga el chip para que la regla se vea antes de chocar con ella.
> 12. **La PK de una tabla hija es inmutable**: `attendance(session_id, player_id)` y
>    `reflection_answers(session_id, clave_snapshot)`. Moverla por UPDATE reescribía el
>    histórico de dos sesiones sin rastro y esquivaba el sellado de `evaluada_at`.
> 13. **Borrar un partido borra su acta**: el fichero vive en Storage, no en la fila; si se
>    borra la fila primero, la ruta se pierde y el fichero queda huérfano en el bucket.
>
> Cobertura: 133 tests en 7 bancos + las 5 lentes. **Pendiente de comprobar contra un
> Postgres real** (no había ninguno disponible en la revisión): la nota de `014:19-23` sobre
> `attendance.player_id` sin CASCADE afirma que borrar un EQUIPO sigue funcionando porque la
> comprobación de FK es al final de la sentencia; depende del orden real de disparo de los
> triggers RI en cascada. Merece un `DELETE FROM teams` sobre un equipo con asistencia antes
> de darla por buena.

## Contrato de columnas clave (resumen — detalle en cada migración)

- **`sessions`**: `id, team_id, season_id, slot_id, fecha date, slot_date date (inmutable, reconciliación), hora_inicio, hora_fin, lugar, titulo, notas, material jsonb, estado('preliminar'|'programada'|'realizada'|'cancelada'), origen('auto'|'manual'), cancel_motivo, slot_duracion_min, duracion_total_min (caché), carga_total (caché), evaluada_at, created_by, created_at, updated_at`. Índice único parcial `(slot_id, slot_date) WHERE origen='auto'`.
- **`matches`**: `rival, es_local boolean, marcador_favor, marcador_contra, estado('programado'|'jugado'|'aplazado'|'cancelado'), val_defensa/ataque/actitud/acierto/global (1–5), claves, acta_path, valorada_at, convocatoria_cerrada boolean DEFAULT false, + hooks jsonb (marcador_cuartos, convocados, estadisticas)`.
- **Reflexión**: fuente = `reflection_answers(session_id, question_id, clave_snapshot, valor_num, valor_texto)`. Consumidores (dossier, progreso de objetivos) leen SIEMPRE la vista `v_session_cumplimiento(session_id, cumplimiento)`, nunca la tabla física.
- **`team_settings`** (coach-editable): `team_id PK, color, dia_convocatoria (ISO 1–7), reflexion_activa, asistencia_activa`. `color`/`dia_convocatoria` NO viven en `teams` (admin-only).

## Modelo de permisos — reglas de RLS

1. `profiles.role` blindado (M1): `REVOKE UPDATE … FROM authenticated; GRANT UPDATE(full_name)`; trigger `guard_profiles_role`.
2. `team_coaches`: lectura por equipo; **escritura solo admin** (anti auto-asignación). El creador se auto-asigna vía trigger `SECURITY DEFINER`.
3. `teams`: coach puede `INSERT` (crea sus equipos) y `UPDATE` sus equipos; `DELETE` admin.
4. `no_training_periods` club-wide (`team_id IS NULL`): lectura amplia, **escritura solo admin**.
5. Triggers de coherencia inter-equipo **obligatorios**: `attendance.player_id`, `session_objectives.objective_id`, jugadores de partido ∈ equipo de su padre.
6. Storage: buckets privados `jugadores`, `actas`; ruta `{team_id}/…`; guard `storage_team_id()` con regex (ruta sin UUID → deny); límites MIME/tamaño.
7. Anon (`auth.uid() IS NULL`) denegado en todo; todas las policies `TO authenticated`.
