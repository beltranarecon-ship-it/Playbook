# Grupo C — Software de otros deportes y multideporte (diseño de ejercicios, tácticas y sesiones)

Fecha de la investigación: 2026-10-04. Método: WebSearch/WebFetch, `curl` sobre HTML/JS/JSON públicos y lectura de repositorios abiertos de GitHub (solo lectura, sin cuentas ni formularios). Convención: **EVIDENCIA** = visto en código, JSON, documentación técnica o JS público; **DEDUCCIÓN** = inferido; **No verificado por dentro** = solo landing, tiendas de apps o prensa.

Nota sobre capturas: Chrome headless se quedó colgado al intentar capturar los sitios (ver nota final), por lo que este informe no aporta capturas nuevas propias.

---

## Resumen de hallazgos transversales (patrones repetidos)

1. **El tiempo se modela casi siempre como "fotogramas/escenas/pasos" con interpolación entre ellos**, no como línea de tiempo continua libre. Las 7 herramientas con evidencia real (Pitchboard, Training Ground, Sportfica, Coaching Animator, tactical-board.com, tactics-board de futsal, HockeyShare) lo hacen así. Solo HockeyShare añade una capa intermedia: cada **secuencia** contiene **transiciones por elemento** con `startTime` relativo y `duration` propios, es decir, un "mini-carril" por elemento dentro de cada paso. Es lo más cercano a nuestros carriles de línea de tiempo.
2. **Casi todos separan "foto" de "movimiento"**: el paso N guarda dónde queda cada ficha, y *cómo llega* (curva, `via`, `ease`) se guarda en el paso al que se llega (Training Ground, Pitchboard) o en el paso de salida (tactical-board.com, tactics-board de futsal). Nadie guarda un camino global por jugador.
3. **Trayectorias**: la mayoría usa Bézier cúbica o cuadrática con 1 a 3 puntos de control (tactical-board.com guarda `s, im1, im2, e`; HockeyShare guarda listas de puntos con `type: "quadratic" | "linear"`; Training Ground guarda `via: [{x,y}]` suavizado por curva). El estilo visual de la línea (sólida, discontinua, ondulada, doble) es un atributo aparte del camino.
4. **El balón no es un objeto independiente sino un "portador"** en las herramientas más maduras: Pitchboard (`carrier`), HockeyShare (`carries: [{puckId, carrierId}]`). Un pase es un cambio de portador; un bote es el balón pegado al portador. Esto evita dibujar y animar pases a mano.
5. **Una sola ruta de render**: Pitchboard (`drawBoard(ctx, doc, t, view)`), Training Ground (`BoardSvg` puro) y Sportfica usan la misma función para editor, vista previa y exportación. Así el PNG/GIF/MP4 siempre coincide con la pantalla.
6. **Coordenadas en unidades reales (metros), no píxeles**: Pitchboard y Training Ground (1 unidad SVG = 1 metro) y el futsal de gljubojevic (cm). Solo HockeyShare usa píxeles de lienzo (se ven valores 300-800), con la desventaja de ligar el dato al tamaño del lienzo.
7. **Las sesiones son listas ordenadas de bloques con minutos** (Sportfica: `Session.phases[]` con `type` y `minutes`; HockeyShare: plan con "hora de inicio calculada"; Coach Board: plan de 90 min en 8 bloques; RenderFoot: duración objetivo + ejercicios ilimitados). Ninguna sesión modela el tiempo como carriles solapados: es secuencial.
8. **Progresiones como cadena**: Coaching Animator (rugby) define cada "Progression" como el paso anterior más un cambio ("palanca" Espacio/Tiempo/Equipo/Personas); HockeyShare "Sequences" = varios diagramas por ejercicio; Training Ground usa pasos. Ninguno tiene ramas reales (variantes bifurcadas); la excepción es Coaching Animator, que encadena pero también limita (ver "NO copiar").
9. **Compartir sin servidor**: Pitchboard (`#d=<base64url(deflate(json))>`), Sportfica (`#/board?d=<gzip base64>`, con límite de 14 000 caracteres), tactical-board.com ("get link"), TacticSlate (offline-first). Patrón barato y eficaz para enlaces de solo lectura.
10. **Exportación**: PNG casi universal; GIF y MP4/WebM son habituales y se hacen en cliente (Pitchboard: `mediabunny`+`gifenc`; Training Ground: WebCodecs/`mediabunny`; Coaching Animator: `.webm`). PDF de sesión con diagramas aparece en los productos comerciales (HockeyShare Premium, Sportplan, FútbolSesión, Coach Tactic Board).
11. **Modelo de negocio**: casi todos "gratis con límites" (HockeyShare 25 ejercicios/10 planes; Tactico 3 guardados; Coaching Animator 50 animaciones cloud) y de pago por PDF/vídeo/colaboración. Eso indica qué se percibe como valor: **exportar** y **compartir**.
12. **Biblioteca**: las más grandes (HockeyShare 1,1 M de ejercicios, Sportplan 15 000, FútbolSesión 2 600) se apoyan en búsqueda, categorías, etiquetas propias, favoritos y una **"bandeja de entrada"** (HockeyShare *Drill Inbox*) para recibir ejercicios de otros entrenadores.
13. **Stack frecuente en lo moderno**: React + canvas/SVG + GSAP/Konva (HockeyShare d6: React, Konva, GSAP 3.14, Three.js, IndexedDB; Coaching Animator: Konva + Supabase, el mismo backend que el nuestro).
14. **Deshacer por gesto**: Training Ground y Pitchboard agrupan un arrastre completo en una única entrada de undo (instantáneas del documento completo + clave de gesto).

---

# FICHAS

### HockeyShare "Diagrammer d6" — https://www.hockeyshare.com (editor en https://draw.hockeyshare.com/?demo=1) — hockey hielo (también lacrosse, hockey sobre césped) — web (SaaS)
- **Qué es y para quién**: plataforma web para entrenadores de hockey: diagramador de ejercicios, planificador de entrenamientos, libros de jugadas, gestión de equipos, vault, calendario de pista. Dice tener 1 104 370 ejercicios y 544 414 planes en biblioteca, activa desde 2006. Planes: Gratis (25 ejercicios, 10 planes, animación incluida), Premium 8,25 USD/mes (76 USD/año: ilimitado, PDF, email, edición colaborativa, asistente IA beta), Asociación 20-60 USD/usuario/año. EVIDENCIA: páginas de precios y portada.
- **Cómo se crea un ejercicio**: lienzo con superficie (pista completa, medias, 6 plantillas de pista; también lacrosse), catálogo en categorías ("objects", "skating", "puck", "other-actions"). Se arrastran jugadores (numerados o no), conos, vallas, porterías; para acciones hay tipos de línea con nombre: patinaje adelante (SOLID), adelante con disco (WAVY), atrás (BACKWARD), atrás con disco (BACKWARD_PUCK), lateral (LATERAL), mariposa (BUTTERFLY), pase (DASHED), tiro (DOUBLE), línea de discos (CURVE_LINE_CIRCLE), y símbolos de giro (pivot izquierdo/derecho), escape, etc. Herramientas de dibujo: **Draw Line** (clics por puntos) y **Freehand** (arrastrar). Imán de acciones ("snapping"), numeración personalizada, cientos de colores, sombreado, objetos de texto, modo pantalla completa, modo oscuro, "Plays" (guardar una colocación como plantilla reutilizable), asistente IA (premium, beta: describir el ejercicio con una frase y coloca jugadores/discos/conos). EVIDENCIA: catálogo extraído del bundle `main-*.js`; blog "The New Diagrammer Is Here".
- **Cómo se representa**: lienzo 2D (Konva) con vista 3D opcional (Three.js) y exportaciones PNG y MP4 desde 2D o 3D. Los diagramas se sirven como WebP con PNG de respaldo (`data-fallback-src`). EVIDENCIA: bundles `canvas-vendor` (Konva), `three-vendor`, `animation-vendor` (GSAP 3.14.2), `image-exporter`.
- **Animación/reproducción**: pestaña "Animation". Cada ejercicio tiene varias **secuencias** (`Sequence 1..n`, con `order`, `name`). Cada secuencia contiene **transiciones por elemento**: `{elementId, path:{points[], duration, ease, type}, startTime}` y propiedades de secuencia `duration`, `endPause`, `carries[]` (qué jugador lleva qué disco). Los caminos son `quadratic` (varios puntos) o `linear` (2 puntos); `ease` observado: `"none"` (lineal). Animación en 2D y 3D, exportable a MP4. EVIDENCIA (documento de muestra en el bundle de la demo pública, no de un usuario).
- **Modelo de datos**: EVIDENCIA, extraída del JS de la demo anónima (`?demo=1`, sin login):
  - Elementos planos `elements[]` con campos comunes: `id` (UUID), `type` (`CURVE_LINE`, `FREE_LINE`, `NUMERABLE_SVG`, `UNNUMERABLE_SVG`, `CUSTOM_OBJ`, `UNNUMERABLE_DIVIDER`...), `x, y, angle, color, opacity, zIndex, locked, visible`; las líneas añaden `lineStyle`, `lineType:"normal"`, `strokeWidth`, `points[]`, `hasArrowStart`, `hasArrowEnd`, `endMarker`, `startConnection`/`endConnection` (la línea se **ancla a un elemento** y se poda si el elemento desaparece).
  - `surface.view` (por defecto `FULL_RINK`, valida contra una lista y cae a ese valor si es desconocida), `settings.numberingEnabled`, `settings.sport`, `logo`, `view3d`.
  - `sequences[]` como arriba; al cargar se descartan transiciones de elementos que ya no existen.
  - Persistencia: IndexedDB (`drill-diagrammer`, almacén `drills`, índice `bySyncStatus`) con cola de sincronización, `baseUpdatedAt` para detectar conflictos y comparación servidor/local ("stale-write confirmation"). El host se comunica con el iframe por `postMessage` (`REQUEST_EXPAND`, `EXPAND_STATE`).
- **Biblioteca y organización**: Mis ejercicios, Favoritos, Bandeja de ejercicios (*Drill Inbox*), ejercicios de asociación, ejercicios gratuitos; búsqueda instantánea, categorías, etiquetas propias, enlaces compartibles. **Planes**: se construyen arrastrando ejercicios; "horas de inicio calculadas" (suma de duraciones); plantillas y carpetas para estructuras repetidas; edición colaborativa con permisos "ver/editar" y **bloqueos de edición** para que dos entrenadores no se pisen; modo presentación a pie de pista; PDF y email en Premium; libros de jugadas (*Playbooks*) con texto, vídeo y animaciones vivas. EVIDENCIA: portada, blog, planes de precios.
- **Puntos fuertes / débiles**: fuerte en catálogo de acciones con nombre (el estilo de línea codifica la acción), secuencias, conexión de líneas a elementos, offline con cola de sincronización, plantillas "Plays". Débil: coordenadas en píxeles de lienzo; `ease` casi siempre `none` (sin curvas de velocidad por defecto); modelo plano de elementos con todo en `elements[]`, sin concepto de "fase/rama".
- **Ideas aplicables a nuestra app**:
  - Bandeja de entrada de ejercicios recibidos de otros entrenadores (Drill Inbox) con aceptar/rechazar. [Media] [Medio]
  - Plan = lista de ejercicios arrastrables con hora de inicio calculada por suma de duraciones. [Alta] [Fácil]
  - Bloqueos de edición (edit locks) en vez de edición simultánea: más simple que CRDT. [Media] [Medio]
  - "Plays": guardar una colocación de fichas como plantilla y soltarla en cualquier ejercicio. [Alta] [Medio]
  - Líneas ancladas a una ficha (`startConnection`/`endConnection`) con poda automática si la ficha desaparece. [Media] [Medio]
  - Modo presentación (pantalla completa a pie de pista). [Media] [Fácil]
  - Tabla de conflicto con `baseUpdatedAt` + cola de sincronización en IndexedDB (nuestra PWA ya podría beneficiarse). [Alta] [Medio]
- **Fuentes**: https://www.hockeyshare.com/ · https://www.hockeyshare.com/acp/compare/ · https://www.hockeyshare.com/demo/diagrammer · https://draw.hockeyshare.com/assets/main-DcLw4wnY.js (bundle público de la demo) · https://www.hockeyshare.com/blog/the-new-diagrammer-is-here · https://www.hockeyshare.com/blog/diagrammer-tutorial-drawing-lines · https://www.hockeyshare.com/blog/drill-diagrammer-practice-planner-now-live

---

### Pitchboard — https://pitchboard.migueljfsc.dev (código: https://github.com/migueljfsc/pitchboard, MIT) — fútbol, fútbol sala, baloncesto, balonmano, hockey sobre césped, hockey hielo, voleibol — open-source
- **Qué es y para quién**: pizarra táctica animada en navegador, un único motor para siete deportes. Gratis y sin cuenta (almacenamiento local); con cuenta, tableros en proyectos y enlaces cortos que siguen las ediciones. Despliegue en un Cloudflare Worker (D1, R2, KV).
- **Cómo se crea un ejercicio**: se dibuja una formación, se avanza de escena en escena moviendo jugadores; una flecha sobre un jugador es la curva que sigue hasta su siguiente posición. También flechas, líneas, trazo libre, zonas y texto, cada uno con **rango de escenas** (visible de la escena A a la B). "Live links": enlaces entre jugadores (cadena, polígono o relleno) recalculados cada fotograma, con distancias en metros opcionales; se deforman al moverse. Edición con selección múltiple (marquee, Shift), imán con guías (Ctrl/⌘ para libre), deshacer por instantáneas agrupadas por gesto.
- **Cómo se representa**: una sola función pura `drawBoard(ctx, doc, t, view)` sobre Canvas2D; la usan el editor, el exportador (Web Worker con `OffscreenCanvas`) y las miniaturas, por lo que no pueden divergir. Vistas: pista completa o mitad, horizontal o vertical, plana o con cámara angulada (perspectiva real, deformación por tiras). Exporta MP4 (H.264) o WebM, GIF (`gifenc`, una paleta por clip) y PNG; todo en cliente. EVIDENCIA: `docs/architecture.md`.
- **Animación/reproducción**: línea de tiempo de escenas; la escena 0 solo aporta su "hold" y cada escena siguiente una transición más un hold. `resolveAt(doc,t)` devuelve `{from, to, u, moving, index}`. Un camino se evalúa como Bézier cúbica con **reparametrización por longitud de arco** (tabla de 64 cuerdas y búsqueda binaria) para que la velocidad sea uniforme. Cada entidad puede tener su propio `travel` (duración) y `delay` (espera) dentro de la escena; la escena se estira hasta el último `delay+travel`. Estilos de carrera (gradual, brusco, "sigue de largo") mediante curvas Hermite colocadas por tiempo absoluto. **Modo flujo**: ritmo único, sin pausas, lineal. Los fotogramas del exportador se calculan fuera de tiempo real y a paso fijo. EVIDENCIA: `docs/architecture.md` y `docs/decisions.md` (D1, D14).
- **Modelo de datos**: EVIDENCIA (`docs/architecture.md`):
  - `BoardDoc {version, name, sport?, pitch, tokenScale?, flow?, grass?, origin?, teams[2], scenes[≥1], links[], annotations[]}`.
  - `Scene {id, name, note?, transitionMs, holdMs, positions{id→Vec2} (todos los jugadores en todas las escenas), paths{id→curva} (el recorrido HACIA esta escena), carrier | ballPos, ballPath, shot?, loft?, travel?, delay?, run?, hiddenRuns?, highlight?, spotlight?, unseen?}`.
  - Los caminos viven en la escena a la que se llega (borrar una escena no deja huérfanos). Campo ausente = comportamiento antiguo (no hay migración por cada campo opcional nuevo; solo `version` + `migrate.ts` cuando hay migración real). Validación con zod compartida entre app y servidor. Coordenadas en "unidades de tablero" con equivalencia a metros por deporte (`metresPerUnit`).
  - **Balón derivado**: `carrier` A→A = regate (pegado delante), A→B = pase (por `ballPath` si hay), A→null = suelto, `shot` y `loft` son banderas del tramo, no tipos. Un pase **no es un objeto**: es un cambio de portador. "Sin balón hasta que alguien lo recibe" (nunca se pone en el punto central por defecto).
  - D41: un arrastre se propaga a las escenas posteriores que no mueven a esa ficha ("el jugador que vuelve a su sitio en la escena 3 es la queja más común").
  - Compartir: `#d=<base64url(deflate-raw(json))>` (enlace congelado, solo lectura; "fork" para editar) o cuenta (`/share/<slug>` que sigue las ediciones).
  - Importa un `tracks.json` de otro proyecto (clip de TV a posiciones).
- **Biblioteca y organización**: proyectos anidados bajo una raíz por deporte (con cuenta); en local, un tablero autoguardado y exportación a JSON ("tablero completo" o "setup" = formación + once). Plantillas de formación en `src/formations/`. No hay biblioteca pública ni sesiones.
- **Puntos fuertes / débiles**: fuertes en arquitectura (render puro, un solo punto de verdad para tamaño/tiempo/vista), modelo de balón, propagación de ediciones, tiempo por entidad. Débil: es una pizarra, no un planificador (sin sesiones ni metadatos de ejercicio); la documentación reconoce que "otras pizarras tratan las formas de grupo como estáticas".
- **Ideas aplicables a nuestra app**:
  - Balón = portador; pase = cambio de portador. Encaja con nuestras acciones por jugador (pase/bote/tiro) y evita dibujar el balón por separado. [Alta] [Medio]
  - Propagar un arrastre a fases posteriores que no mueven esa ficha (D41), con modo visible en el gesto. [Alta] [Medio]
  - Tiempo por entidad (`delay` + `travel`) dentro de una fase: puede sustituir carriles manuales. [Alta] [Difícil]
  - Reparametrización por longitud de arco para velocidad uniforme en curvas. [Media] [Medio]
  - Rangos de escena para anotaciones (flecha visible de la fase A a la B). [Media] [Fácil]
  - Enlaces entre jugadores (línea de 3 defensores que se deforma, con distancias). [Baja] [Medio]
  - Enlace compartible `#d=` con JSON comprimido (cero servidor para ver). [Media] [Fácil]
  - Una función de render pura reutilizada por editor, miniaturas y exportación. [Alta] [Medio]
- **Fuentes**: https://github.com/migueljfsc/pitchboard (README.md, docs/architecture.md, docs/decisions.md D1/D14/D41/D44) · https://pitchboard.migueljfsc.dev

---

### Training Ground — https://github.com/Dukes0O/training-ground — fútbol (juvenil) — open-source (local)
- **Qué es y para quién**: diseñador y animador local de ejercicios de fútbol base. Biblioteca visual de 12 ejercicios de ejemplo; sin cuenta ni nube; los ejercicios son **un archivo JSON cada uno** y la aplicación vigila la carpeta (los cambios aparecen en menos de un segundo). Pensado para que un agente de IA (Claude/Codex) cree ejercicios escribiendo el JSON.
- **Cómo se crea un ejercicio**: paleta agrupada (jugadores con número/nombre/posición, balón(es), conos, marcadores planos, mini-porterías, escaleras, maniquíes, picas, vallas). Notación de entrenador: pase (sólida), carrera (discontinua), conducción (ondulada), tiro (gruesa); flechas con extremos anclados a jugadores (siguen la carrera); trazado suavizado o recto por puntos intermedios; zonas rectangulares, elípticas, circulares o poligonales; etiquetas. Los pasos se reordenan arrastrando (o Alt+←/→). Atajos: Espacio reproduce, `,` `.` paso anterior/siguiente, flechas mueven la selección, Supr borra, Esc vuelve a seleccionar, Ctrl+Z/Y, Ctrl+S, Ctrl+D duplica la selección con todo su movimiento. Plantillas de pista: 11v11, 9v9, 8v8, medio campo, cuadrícula redimensionable.
- **Cómo se representa**: SVG propio (sin librería de canvas), **1 unidad SVG = 1 metro**; BoardSvg es una función pura de una instantánea y la misma se renderiza en estático para PNG/GIF/MP4 ("una sola ruta de render"). Opciones de visualización guardadas solo en el navegador: miniaturas o fichas simples, estelas, conos de visión, escaneo, vistas horizontal/vertical/angulada, paletas (césped, estadio, claro, oscuro), cámara que sigue a balón o jugador. Exporta PNG 1920 px, MP4 (WebCodecs, H.264 o VP9) a 1280/1920/3840 px y 25/30/60 fps, GIF, "paquete web" (PNG+GIF+vídeo+JSON+manifiesto) y **grabaciones narradas** (tablero + voz mediante Region Capture).
- **Animación/reproducción**: pasos como fotogramas clave. `steps[0]` es la foto inicial (su `durationMs` es cuánto se mantiene, 800 ms por defecto); en los siguientes, **`durationMs` es el tiempo de animación HACIA ese paso desde el anterior** (2000 ms por defecto) y `pauseAfterMs` congela la pose llegada (300 ms) como "pausa didáctica". Por entidad: `ease` (`linear|easeIn|easeOut|easeInOut|instant`), `via` (puntos intermedios suavizados), `rotation`, `hidden`. Pases con `linear`, carreras con `easeInOut`. Reloj de reproducción con requestAnimationFrame más un "watchdog" de 100 ms que sigue contando si la pestaña está oculta. EVIDENCIA: `docs/drill-authoring.md`, `docs/project_atlas/data/decisions.json`.
- **Modelo de datos**: EVIDENCIA (JSON real `drills/passing-diamond.json` y guía):
  - Raíz: `schemaVersion`, `id` (slug = nombre de archivo), `title`, `description`, `tags[]`, `notes`, `themeColor`, `pitch{format, overrides{length,width}}`, `teams{home|away|neutral{label,fill}}`, `entities[]`, `steps[]`.
  - `entities[]`: tipos `player` (team, number, name, position), `ball`, `cone|flat|minigoal|ladder|mannequin|pole|hurdle` (color), `arrow` (`style` pass|run|dribble|shot|plain, `from`/`to` punto `{x,y}` o ancla `{ref:id}`, `via`, `pathMode` smooth|straight, `fromStep`, `toStep`), `zone` (`rect` o `points`, `shape`, `text`, `fromStep`, `toStep`), `label`.
  - `steps[]`: `{name, durationMs, pauseAfterMs, positions{entityId→{x,y,rotation,via,ease,hidden}}}`. Pasos **dispersos** permitidos (solo los que se mueven; el resto se hereda del paso anterior) y la app guarda **densos** (instantánea completa por paso). Decisión documentada: "guardar denso, cargar disperso". Coordenadas en metros con origen arriba a la izquierda, 3 m de margen exterior.
  - Visibilidad de anotaciones por rango de pasos (`fromStep`..`toStep`) con fundido de entrada/salida.
  - Servidor "tonto": CRUD de archivos con escrituras atómicas, `rev` para conflictos, papelera, SSE; marcadores/favoritos en localStorage (no en el JSON); rosters fuera del repositorio por privacidad (nombres de menores).
- **Biblioteca y organización**: tarjetas visuales con el montaje inicial, jugadores, pasos y duración de la demo; búsqueda por título/descripción/etiquetas; filtro por tema; orden por nombre o reciente; **Guardados** (favoritos), **duplicar** para variantes, papelera con "Eliminados recientemente"; roster del equipo con relleno de ficha desde plantilla y presets de formación. No tiene sesiones.
- **Puntos fuertes / débiles**: fuertes en la semántica de tiempo (duración hacia el paso + pausa didáctica), anotaciones con rango de pasos y ancladas a fichas, pasos dispersos, validación con JSON Schema, exportaciones. Débiles: sin sesiones ni calendario; las ramas/variantes se resuelven duplicando el archivo.
- **Ideas aplicables a nuestra app**:
  - `pauseAfterMs` (pausa didáctica tras llegar) por fase, además de la duración. [Alta] [Fácil]
  - Anotaciones (flechas, zonas, texto) con `fromStep/toStep` y fundido de entrada/salida. [Alta] [Medio]
  - Flechas ancladas a una ficha (`ref`) que siguen su movimiento. [Media] [Medio]
  - Guardar denso en base de datos y aceptar disperso al importar (herencia por "forward-fill"). [Media] [Fácil]
  - Esquema JSON Schema + validador como banco de pruebas (`eval-*.mjs` ya existe). [Media] [Fácil]
  - Duplicar selección con su movimiento (Ctrl+D). [Media] [Medio]
  - Exportar MP4/GIF fuera de tiempo real a paso fijo. [Media] [Difícil]
  - Tarjetas de biblioteca con la foto inicial y tiempo de demostración (no el de práctica). [Media] [Fácil]
- **Fuentes**: https://github.com/Dukes0O/training-ground (README.md, docs/drill-authoring.md, drills/passing-diamond.json, schema/drill.schema.json, docs/project_atlas/data/decisions.json)

---

### Sportfica (Coach-Soccer) — https://fracturedorbit1980.github.io/Coach-Soccer/ (código: https://github.com/FracturedOrbit1980/Coach-Soccer) — fútbol 5/7/9/11 — open-source (web estática)
- **Qué es y para quién**: pizarra táctica + planificador de sesiones para entrenadores de fútbol base y de formación (UEFA C/B/A). Todo se guarda en el navegador; compartir por enlace; exportar JSON; hoja de sesión para imprimir.
- **Cómo se crea un ejercicio**: herramientas `select, home, away, gk-home, gk-away, ball, cone, mannequin, goal, pole, pass, run, dribble, press, marker, erase`. Vistas de campo: completo, medio, área, tercios, canales. "Sugerir presión" según formato (5/7: avanzan dos jugadores; 9: curva una unidad de tres; 11: salta una línea). Hoja de plantilla de temporada: los jugadores locales usan los dorsales y nombres reales.
- **Cómo se representa**: SVG React; hoja de sesión imprimible; JSON exportable.
- **Animación/reproducción**: cada **fotograma** (`Frame`) es una instantánea completa `{id, note, tokens[], strokes[]}`. El reproductor interpola entre dos fotogramas con `smoothstep` (`t*t*(3-2t)`), empareja fichas por `id` o, si no, por tipo+equipo+dorsal (`samePiece`), hace aparecer o desaparecer fichas sin pareja a mitad del tramo (`eased > 0.5`), y cambia los trazos de golpe al 45 %. Velocidades 0,5×, 1×, 1,5×, 2×. Línea de tiempo en forma de "tira de película" con arrastre. EVIDENCIA: `src/lib/animate.ts`, `components/Timeline.tsx`.
- **Modelo de datos**: EVIDENCIA (`src/types.ts`):
  - `Session {id, title, tier(5|7|9|11), clientId?, ageGroup, duration, theme, moment(in-possession|out-of-possession|transition-attack|transition-defend), principle, what, where, who, when, why, coachBehaviours[], interventionStyles[], environment, playerFocus[], opponent{shape, buildUp, pressTrigger, weakness}, phases[], updatedAt}`.
  - `Phase {id, type(warmup|technical|functional|ssg|game), title, minutes, lengthM, widthM, zone(full|defensive-third|...|penalty-box), organisation, coachingPoints[], interventions[], questions[], frames[]}`.
  - `Frame {id, note, tokens[], strokes[]}`; `Token {id, kind, team?, number?, name?, squadPlayerId?, role?, label?, rotation?, x, y}`; `Stroke {id, kind(pass|run|dribble|press), team, points[]}`.
  - Compartir: `#/board?d=<gzip+base64url>` con límite de 14 000 caracteres (si no cabe, exportar JSON); validación y normalización al leer (`normalizeSession`).
  - **Es el único modelo de sesión formalizado** de los analizados: la sesión es una lista de **fases con minutos**, cada fase con su propio campo en metros, zona del campo, organización, puntos de coaching, preguntas e intervenciones, y sus **fotogramas** de animación.
- **Biblioteca y organización**: Biblioteca (`LibraryEntry {session, tier, savedBy}`), "Guardar" y "Guardar una copia" para conservar versiones, perfiles de jugador con 4 pilares (técnico/físico/psicológico/social), evaluación de dominio del balón, feedback por rol y **ejercicios sugeridos para cada jugador** (`suggestedDrillIds`). Pestañas del inspector: sesión, fase, método, pilares.
- **Puntos fuertes / débiles**: fuerte en la ficha de sesión (marco metodológico: qué/dónde/quién/cuándo/por qué) y en el modelo fase-minutos-fotogramas; en vincular ejercicios a plantilla. Débil: animación por interpolación lineal de instantánea sin curvas ni tiempo por ficha; trazos que cambian bruscamente.
- **Ideas aplicables a nuestra app**:
  - Sesión = lista de fases tipadas (calentamiento/técnico/funcional/juego reducido/juego) con minutos y dimensiones del espacio por fase. [Alta] [Medio]
  - Campos "puntos de coaching", "preguntas", "intervenciones" como listas, no un texto único. [Media] [Fácil]
  - Relacionar ejercicios sugeridos con jugadores (`suggestedDrillIds`). [Baja] [Medio]
  - "Guardar una copia" como versionado manual simple. [Media] [Fácil]
  - Enlace compartible con JSON gzip + aviso de límite. [Media] [Fácil]
- **Fuentes**: https://github.com/FracturedOrbit1980/Coach-Soccer (README.md, src/types.ts, src/lib/animate.ts, src/lib/share.ts, src/components/Timeline.tsx)

---

### Coaching Animator — https://github.com/footnote42/coaching-animator — rugby (también fútbol y fútbol americano) — open-source (Next.js + Konva + Supabase)
- **Qué es y para quién**: animador de ejercicios de rugby para clubes (Trojans RFC, ampliable a clubes de Hampshire RFU). Sin cuenta, datos locales; con cuenta, 50 animaciones en nube (Supabase), galería pública con votos; modo invitado de 10 fotogramas.
- **Cómo se crea un ejercicio**: colocar jugadores (ataque/defensa), balones, conos y marcadores en el campo; doble clic para dorsal/nombre; "+" en la línea de tiempo añade un fotograma; se reposicionan fichas en el siguiente; Espacio reproduce; exporta vídeo `.webm`; guarda JSON. Flechas y líneas como anotaciones; **Ghost Mode** muestra las posiciones del fotograma anterior; autoguardado cada 30 s.
- **Cómo se representa**: lienzo Konva; campos de rugby union/league, fútbol y fútbol americano.
- **Animación/reproducción**: multi-fotograma con interpolación entre ellos. **ADR 0002 (muy relevante)**: sustituyen el modelo antiguo (coordenadas crudas 0-2000 por fotograma y cada progresión como copia completa en otra fila, máximo cinco) por un **"Practice Script"**: una Práctica es un objeto con una cadena de Pasos; posiciones en **celdas de cuadrícula**; la duración sale de la **distancia y el ritmo** (steady, más lento que tiempo real; caminar/trotar/esprintar por movimiento), nunca tecleada a mano; **los pases se disparan cuando llega el receptor**; cada Progresión guarda solo su **cambio respecto al paso anterior**, de modo que editar el paso base se propaga hacia delante. El editor manual escribe el mismo guion (arrastres ajustados a celdas), por lo que lo hecho a mano y lo hecho por un agente son indistinguibles. EVIDENCIA: `docs/adr/0002-practice-script-with-chained-progressions.md`, `CONTEXT.md`.
- **Modelo de datos**: EVIDENCIA conceptual (glosario `CONTEXT.md`): **Practice** (cadena ordenada de Steps; un partido es una Práctica sin Progresiones), **Step** (paso 0 base, los demás son Progresiones), **Progression** (Step que desarrolla el anterior mediante una **Lever**: Espacio, Tiempo, Equipo, Personas — modelo STEP), **Commentary** (palancas, puntos de coaching y a futuro subtítulos temporizados), **Area** (espacio en metros desde plantilla: cuadrado, rectángulo horizontal/vertical, medio campo, campo completo; los marcadores escalan con el área), **Pace**, **Tag** (lista fija de temas, máximo 5 por práctica, nunca texto libre), **Source** (vídeo o página en que se basa, con crédito). El esquema exacto de campos JSON no se leyó (DEDUCCIÓN: derivados de lo anterior).
- **Biblioteca y organización**: Galería pública de prácticas publicadas por entrenadores, etiquetas desde lista cerrada (habilidades, conocimiento, comportamientos y principios de juego), votos, enlaces compartibles, reportes de contenido, restricción de edad (ADR 0003: cuentas solo 18+) y política de que la IA queda fuera de la app (ADR 0004) pero los agentes **pueden redactar animaciones** (ADR 0001).
- **Puntos fuertes / débiles**: fuerte en pedagogía (progresiones obligatorias como cadena de cambios, palancas), en el tiempo derivado de distancia+ritmo y en la rejilla. Débil: modelo estrictamente lineal (cadena), sin ramas; la reconstrucción tiró datos antiguos sin migrar.
- **Ideas aplicables a nuestra app**:
  - Cada fase/variante almacena solo el delta respecto a su padre (herencia hacia delante) en vez de copiar la fase entera. Encaja con nuestras fases con ramas. [Alta] [Difícil]
  - Duración derivada de distancia + ritmo (andar/trote/sprint) con opción de sobrescribir. [Alta] [Medio]
  - Pase disparado cuando llega el receptor (en vez de tiempo manual). [Alta] [Medio]
  - "Palanca" opcional por variante (espacio/tiempo/equipamiento/personas) con un punto de coaching que explique por qué es más difícil. [Media] [Fácil]
  - Lista de etiquetas cerrada (máx. 5) para filtros fiables en la biblioteca. [Media] [Fácil]
  - Modo ghost (posiciones del fotograma anterior). [Media] [Fácil]
  - Campo "Fuente" con crédito/enlace al original. [Baja] [Fácil]
- **Fuentes**: https://github.com/footnote42/coaching-animator (README.md, CONTEXT.md, docs/adr/0001-0004)

---

### tactical-board.com — https://tactical-board.com — fútbol 11, fútbol 7, fútbol sala, baloncesto, balonmano, voleibol, hockey, rugby, etc. — web (freemium con anuncios y cuenta Pro)
- **Qué es y para quién**: pizarra táctica online multideporte, una de las más populares, referencia explícita del proyecto de futsal de gljubojevic. Gratis con anuncios; cuenta Pro (FastSpring) con colecciones de tableros.
- **Cómo se crea un ejercicio**: modo "main" (colocar) y "edit animation" (marcar recorridos); acciones expuestas en el HTML (`data-action`): `animation-play`, `animation-pause`, `animation-stop`, `animation-repeat`, `animation-play-current-frame`, `edit-animation`, `download-animation`, `page-get-link`, `save-as-image`, `change-board-view`, `choose-board-background-color`, `choose-sport-markings-background-colors`, `toggle-board-cropper`, `toggle-markup`, `add-to-collection`, `show-user-collection`, `fullscreen`, `create-conference`/`get-scheme-conference-link`/`stop-conference` (colaboración en tiempo real). Se puede recortar la pista (cropper) y cambiar colores de césped y marcas.
- **Cómo se representa**: SVG generado en cliente; las marcas de la pista salen de una función (`BoardMarkup`) que calcula rutas a partir de ancho/alto (proporciones tipo FIFA). Exporta imagen (SVG a PNG vía canvas), enlace y animación descargable (GIF/vídeo; el bundle incluye utilidades de GIF y `mp4`; DEDUCCIÓN sobre el formato exacto).
- **Animación/reproducción**: EVIDENCIA en el bundle `1.js`: cada **fotograma** guarda para cada elemento un camino con **cuatro puntos** (`pos.s` inicio, `pos.im1`, `pos.im2` puntos intermedios de control, `pos.e` fin), es decir **Bézier cúbica**. Antes de reproducir, cada camino se **pre-muestrea** en una lista de puntos (`lineWayPoints`) de longitud igual para todos los elementos del fotograma (`_framePointsCount`); la reproducción avanza por **índice de punto** con un temporizador, no por interpolación temporal. Velocidad 1-9 (velocímetro): `_frameDuration = 500*(10-speed)` ms para velocidad >3, 4 s con velocidad 3, 5 s con 2, 7 s con 1; con velocidad >4/6/8 se salta de 2/4/6 puntos por tic. Hay repetición, reproducción de solo el fotograma actual y modo "solo carreras" (`_currentFrameOnlyRuns`). Los elementos nuevos se ocultan y reaparecen al empezar cada vuelta. DEDUCCIÓN: como todos los elementos de un fotograma comparten el mismo número de puntos, **todos llegan a la vez** al final de cada fotograma (sin tiempo individual).
- **Modelo de datos**: EVIDENCIA parcial (JS minificado): `_frames[]` con `elements[]` por fotograma; cada elemento con `pos{s, im1, im2, e}`; colección `_framesElements` observada (Map con callbacks). Persistencia: `localStorage` (9 referencias) y colecciones de usuario. No se obtuvo un JSON de tablero guardado (requiere cuenta).
- **Biblioteca y organización**: "Mis tableros", colecciones (`add-to-collection`), lista de tableros, idiomas. Enlace por tablero y "conferencia" colaborativa.
- **Puntos fuertes / débiles**: fuerte en rapidez de uso (sin cuenta, recorte, colores, multideporte) y en exportar. Débil: animación por pasos de puntos discretos, sin curvas de velocidad ni pausas por elemento; todos los elementos sincronizados.
- **Ideas aplicables a nuestra app**:
  - Velocidad de reproducción como escala simple 1-9 en vez de milisegundos. [Media] [Fácil]
  - Botón "reproducir solo el fotograma/fase actual" y "solo carreras". [Alta] [Fácil]
  - Recorte (crop) de la pista para exportar solo la zona de trabajo. [Media] [Medio]
  - Colaboración en directo como "conferencia" con enlace (sala compartida). [Baja] [Difícil]
- **Fuentes**: https://tactical-board.com/ · https://tactical-board.com/static/js/1.js?278 · https://tactical-board.com/static/js/board-markup-bf.js?278

---

### Tactics Board de futsal (gljubojevic) — https://github.com/gljubojevic/tactics-board — fútbol sala — open-source (React + Material UI + Firebase)
- **Qué es y para quién**: clon de tactical-board.com solo para futsal; React, SVG generado en cliente, Firebase para guardado, compartir y co-edición.
- **Cómo se crea un ejercicio**: formas predefinidas arrastrables (jugadores, conos, balones, porterías, banderines, escaleras), editores propios por tipo (`PlayerEdit`, `LineEdit`, `TextEdit`, `ContextMenu`, `RotateHandle`...). Unidad: 1 unidad SVG = 1 cm.
- **Cómo se representa**: SVG; PNG de descarga; definición JSON editable.
- **Animación/reproducción**: **keyframes**: añadir un fotograma copia posiciones y parámetros del anterior. EVIDENCIA (`src/pitch/AnimKeyFrame.js`): cada fotograma guarda `{players[], playerPaths[], balls[], ballPaths[]}`; cada camino es una `Line` con `p1, p2, c1, c2` (**Bézier cúbica con dos puntos de control**), `arrowStart`, `arrowEnd`, `dashed`. Para animar se **pre-calculan** los splines (`animPreCalcSplines`) y se recorre cada camino mediante **tres tramos de Bézier** (`splinePathPos`: posición 0-1 repartida en 3). Jugadores y balones tienen caminos separados.
- **Modelo de datos**: EVIDENCIA: método `save()`/`load()` de `AnimKeyFrame`; jugador `{id, no, name, color, pos{x,y}, rotation, posDefault, noDefault}`, balón `{id, color, pos, posDefault}`; el nombre pasa por `RemoveTags` al cargar (saneado de HTML).
- **Biblioteca y organización**: guardado por usuario (Firebase), compartir por enlace, colaboración en el mismo tablero (según README; implementación parcial).
- **Puntos fuertes / débiles**: modelo de datos muy simple y claro (fotograma = jugadores + caminos + balones + caminos de balón). Débil: sin tiempos individuales.
- **Ideas aplicables a nuestra app**: `posDefault` (posición por defecto para "restablecer" una ficha); sanear texto de nombres al cargar JSON importado. [Baja] [Fácil]
- **Fuentes**: https://github.com/gljubojevic/tactics-board (README.md, src/pitch/AnimKeyFrame.js)

---

### TacticalPad — https://www.tacticalpad.com — fútbol, fútbol sala, balonmano, baloncesto, hockey hielo y césped, rugby, GAA, voleibol, lacrosse, tenis, pádel, bádminton, floorball — app de escritorio y móvil (de pago)
- **Qué es y para quién**: la app de pizarra + planificador de sesiones más veterana (desde 2010) con clientes como Tottenham Hotspur y selección brasileña según la propia web. Licencias: completa 63 USD/año (PC/Mac + móvil), solo escritorio 39 USD/año, solo móvil 24 USD/año; paquetes para clubes (4+). Cientos de sesiones descargables gratis. **No verificado por dentro** (sin versión web pública ni formato de archivo documentado).
- **Cómo se crea un ejercicio**: tableros "estáticos" y "animados"; se añaden jugadores e ítems y se "fijan o dibujan" caminos; ítems personalizados con cualquier imagen que se puede mover y animar; efectos especiales (resaltar, estela, conectores) para atraer atención. Integración con YouTube y Vimeo, cuaderno de notas, pistas personalizadas. FUENTE: página oficial y tutoriales (YouTube), no código.
- **Cómo se representa / animación**: 2D y 3D con gráficos realistas; vídeo; el detalle de fotogramas no está en fuentes públicas leídas.
- **Biblioteca y organización**: sesiones, ejercicios descargables, importación de sesiones de otros entrenadores. No verificado en profundidad.
- **Ideas aplicables a nuestra app**: efectos de atención sobre fichas (resaltar, estela, conectores entre jugadores) como capa visual opcional. [Media] [Medio]
- **Fuentes**: https://www.tacticalpad.com/en-us/new/index.php · https://www.coach-os.com/en/wiki/fussball-zeichentool-vergleich · https://footyapps.com/product/tacticalpad

---

### Sportplan — https://www.sportplan.net — multideporte (fútbol, atletismo, natación, tenis, ultimate, etc.) — web + animador de escritorio descargable
- **Qué es y para quién**: biblioteca de 15 000+ ejercicios con planificador de sesiones online; paquetes para individuales, clubes, escuelas y estudiantes-entrenadores (precios no visibles). **No verificado por dentro**.
- **Cómo se crea un ejercicio**: tres vías: (1) *Chalkboard* online (arrastrar iconos y flechas, plantillas de pista, guardado automático en la cuenta); (2) subir foto propia y anotar con flechas y texto; (3) subir o grabar vídeo desde la app móvil (clips de menos de 30 s se convierten automáticamente a formato "ejercicio") y (4) *Animator* descargable (14 días de prueba) que sube la animación a la cuenta.
- **Biblioteca y organización**: Favoritos; sesiones antiguas pasan a una "Session Shop" tras 4 semanas de acceso gratuito; plantillas de sesión recomendadas por federaciones.
- **Planificador**: añadir título, fecha, lugar, duración y nivel; bloques/secciones con ejercicios o bocetos; compartir, imprimir, **PDF**, modo diapositivas a pantalla completa para enseñar a los jugadores, **imprimir solo los diagramas sin texto**; participantes pueden comentar.
- **Ideas aplicables a nuestra app**: imprimir/PDF solo diagramas; modo diapositivas para presentar a jugadores; comentarios de otros entrenadores sobre una sesión. [Media] [Fácil/Medio]
- **Fuentes**: https://www.sportplan.net/drills/Sports/Sports-Session-Planner.jsp · https://www.sportplan.net/drills/faq/en/tools.jsp · https://www.sportplan.net/drills/Sports/Sports-Drill-Designer.jsp

---

### Coach Board y Coach Tactic Board (Blue Linden) — https://www.coachboard.app · https://apps.apple.com/us/app/coach-tactic-board-volley/id861268156 — 16 deportes (fútbol, baloncesto, americano, flag, voleibol, balonmano, hockey, rugby, lacrosse, pádel, tenis, waterpolo...) — web de pago (Coach Board 9 USD/mes, 90 USD/año, 14 días gratis) y apps móviles
- **Qué es y para quién**: pizarra táctica + planificador + biblioteca editorial en una app web (Coach Board) y la familia de apps "Coach Tactic Board" (una por deporte, con versión "Pizarra Táctica: Balonmano/Fútbol" en español). Datos de la ficha: JSON-LD `SoftwareApplication`, `CollectionPage`, `ItemList` en la web (EVIDENCIA).
- **Cómo se crea**: arrastrar jugadores y material, 20+ tipos de línea para pases, bloqueos y conducciones (en la app de baloncesto), líneas sólidas, punteadas, curvas; modo "Animation mode"; guardado ilimitado; carpetas por rival, partido o sesión; exportar PDF o imagen; compartir por enlace, imagen o vídeo; animaciones en bucle o a cámara lenta.
- **Biblioteca (Coach Board)**: páginas públicas `/library/<deporte>` con **tipos de contenido**: *Tactics* (sistemas, p. ej. rotaciones 5-1, 6-2, 4-2), *Training Sessions* (planes completos) y *Drills*; cada ítem con **montaje, pasos, puntos de coaching y variantes**; categorías por tipo (`/category/rotations`, `/category/drills`). Una sesión de ejemplo: **8 bloques sucesivos hasta 90 minutos**, cada uno con objetivo propio, ordenados con criterio pedagógico explicado en el texto y presentados como narrativa + **tabla de bloques con tiempos** + FAQ + puntos de coaching, con enlace a "abrir y animar en Coach Board".
- **Puntos débiles**: no verificado por dentro el editor (privado tras login: `my.coachboard.app`).
- **Ideas aplicables a nuestra app**:
  - Ficha de ejercicio con la estructura **montaje / pasos / puntos de coaching / variantes** (no solo "objetivo/material"). [Alta] [Fácil]
  - Tres tipos de contenido en la biblioteca: táctica, ejercicio, sesión completa. [Media] [Medio]
  - Carpetas por rival/partido/sesión para organizar jugadas. [Media] [Fácil]
- **Fuentes**: https://www.coachboard.app/ · https://www.coachboard.app/library/volleyball · https://www.coachboard.app/library/volleyball/beginner-practice-plan · https://www.coachboard.app/sitemap.xml · tiendas de apps de Coach Tactic Board

---

### Playbook Creator (+ diseñadores de jugadas de fútbol americano) — https://github.com/obraunsdorf/playbook-creator (GPLv3, Qt/C++); comerciales: FirstDown PlayBook, Football Play Card, Playmaker X, footballplaybook.com — fútbol americano / flag — escritorio y web
- **Qué es y para quién**: editores de playbooks (5v5 flag a 11v11). Salida clave: **muñequera ("wristband")** impresa. **Los comerciales no se verificaron por dentro.**
- **Cómo se crea una jugada** (EVIDENCIA, README de Playbook Creator): "Nueva jugada" con nombre y **nombre en clave** (se muestra el código en lugar del nombre para poder cantarlo); elegir **formación**; clic derecho sobre un jugador para aplicar **ruta** (menú de rutas), **movimiento previo al snap (motion)** o color; doble clic para ruta rápida: clic por puntos, **Ctrl** para tramo curvo, doble clic para terminar. Rutas con nombre reutilizables ("crear ruta con nombre"). Categorías propias (por ejemplo "jugadas de carrera", "cuarto intento") con filtros al abrir. Exporta PDF para muñequera.
- **Modelo de datos**: EVIDENCIA (cabeceras C++ `src/models`): `Play {name, codeName, formation, categories, comment}`; `Formation = categoría + vector de jugadores {rol, color, posición, nombre, nº}`; `AbstractMovement = lista de Paths`; `Route extends AbstractMovement + name + codeName`; `Motion extends AbstractMovement + motionEndPoint`. Es decir, **una ruta es una lista de caminos con nombre reutilizable, y una formación es una colección de posiciones sin rutas** (al copiar una formación, se copian jugadores "sin sus rutas ni movimientos"). Persistencia con serialización Boost con número de versión.
- **Comerciales (landing/App Store)**: más de 75 acciones integradas (rutas, movimientos, bloqueos, coberturas), vídeo adjunto a la jugada, nube y sincronización (Playmaker X), plantillas de muñequera para juvenil y adulto, "diseñador IA" (RPOLabs).
- **Ideas aplicables a nuestra app**:
  - Separar "formación" (posiciones sin acciones) de "jugada" (formación + acciones) para reutilizar colocaciones. [Alta] [Medio]
  - Nombre de código además del nombre (para llamar la jugada con una palabra clave) y numeración. [Media] [Fácil]
  - Acciones con nombre reutilizables ("crear ruta con nombre") = biblioteca de movimientos típicos (corte en L, bloqueo directo) que se aplican a una ficha. [Alta] [Medio]
  - Categorías propias asignables con filtros al abrir. [Media] [Fácil]
  - "Muñequera" = salida impresa en miniatura de varias jugadas por hoja: análogo a una hoja de varias jugadas por página. [Baja] [Medio]
- **Fuentes**: https://github.com/obraunsdorf/playbook-creator (README.md, src/models/*.h) · https://footballplaycard.com/ · https://firstdown.playbooktech.com/ · https://footballplaybook.com/design

---

### Otros productos revisados (fichas breves, no verificados por dentro)

- **planet.training (voleibol)** — https://planet.training/drawing-tool-volleyball — editor con 12 perspectivas de pista, hasta **30 escenas** de animación y **velocidad ajustable por escena** (acelerar o frenar tramos), base de datos de prácticas accesible desde cualquier dispositivo, reenvío a ayudantes del club. Idea: velocidad por fase. [Media] [Fácil]
- **AthletePath (fútbol)** — https://www.athletepath.com/soccer-tactics-board/ — gratis sin cuenta; hasta **20 fotogramas** donde cada uno guarda posiciones, material y dibujos; **onion skin** (fantasmas semitransparentes del fotograma anterior); reproducción 0,5×-2×; exporta PNG en cuatro formatos (vertical, cuadrado, historia, apaisado). Idea: onion skin, formatos de exportación para redes. [Media] [Fácil]
- **TacticSlate** — https://tacticslate.com/ — fútbol, local-first (sin cuenta), secuencias fotograma a fotograma con controles de tiempo y posiciones fantasma, múltiples ángulos de cámara 3D, vídeo en Pro. Idea: fantasmas entre fotogramas. [Media] [Fácil]
- **Tactico** — https://tactico.pro/soccer-drill-animator — fotogramas clave añadidos moviendo jugadores; control de velocidad por tramo con easing (ease-in/out/lineal); **balón con su propia animación** (rebote, pase en profundidad, centro, tiro); exporta MP4/WebM (Pro); 3 guardados gratis con enlace, QR y pegado en WhatsApp. Idea: QR de ejercicio para el tablón. [Baja] [Fácil]
- **RenderFoot** — https://www.renderfoot.com/es/drill-planner — creador gratuito sin registro; 16 plantillas (rondos, tiro, pase, presión); sesión con nombre, duración objetivo, notas y ejercicios ilimitados; imprime el plan con diagramas y **resumen de material** (equipamiento agregado); guarda en localStorage. Idea: resumen de material agregado de la sesión. [Media] [Fácil]
- **FútbolSesión** — https://futbolsesion.com/pizarra-tactica/ — pizarra animada "paso a paso", exporta imagen, PDF y vídeo, 2 600+ ejercicios, biblioteca personal por objetivo y categoría, integra ejercicios con sesiones, calendario y alineaciones. [Medio] 
- **bcoach** — https://bcoach.app/en/home/ — diseñador de tareas animables; planificador de sesiones y **microciclos** desde la biblioteca; biblioteca "bLibrary" con novedades mensuales; reparto de ejercicios y hojas de sesión al staff; estadísticas de partido. Idea: microciclo (semana) como contenedor de sesiones. [Media] [Medio]
- **Coach OS "Sketch"** (comparativa) — https://www.coach-os.com/en/wiki/fussball-zeichentool-vergleich — según su propia comparativa, es el único que analiza el dibujo (posiciones, balón, flechas, material) y **genera título, descripción y puntos de coaching** automáticamente; es una afirmación de la propia web, no verificada.
- **Volleyball Rotations / Rotations Coach** — apps de móvil que animan rotaciones y posiciones por rotación (tabla de 6 rotaciones), con 320 ejercicios animados con "setup, objetivo y puntos de coaching". Idea: tabla de rotaciones/posiciones como plantilla. [Baja] [Medio]

---

# Patrones y decisiones de diseño detectados

**Tiempo**
- *Pasos/fotogramas con interpolación* (Training Ground, Sportfica, Coaching Animator, AthletePath, gljubojevic) frente a *transiciones por elemento con `startTime`/`duration` dentro de cada secuencia* (HockeyShare) frente a *`delay`+`travel` por entidad dentro de cada escena* (Pitchboard). El segundo y el tercero equivalen, en la práctica, a nuestros carriles dentro de una fase.
- **Duración hacia el paso** (el tiempo pertenece al paso al que se llega) es la convención más repetida (Training Ground, Pitchboard) y evita dudas sobre "a qué paso se refiere".
- **Pausa didáctica al llegar** (`pauseAfterMs`, `endPause`, `holdMs`) aparece en las tres herramientas más maduras.
- Tiempo **derivado** de distancia + ritmo (Coaching Animator, modo flujo de Pitchboard) en lugar de teclearlo.
- **Reloj con watchdog** para pestañas ocultas (Training Ground) y **exportación fuera de tiempo real a paso fijo** (Pitchboard, Training Ground).

**Trayectorias**
- Caminos como lista de puntos con tipo `linear`/`quadratic` (HockeyShare), Bézier cúbica de 4 puntos (tactical-board.com, gljubojevic) o puntos `via` suavizados (Training Ground). El estilo de línea (sólida, discontinua, ondulada, doble) es un atributo independiente del camino y codifica la acción.
- Camino guardado en el paso al que se llega, no en el de salida (Pitchboard, Training Ground): borrar un paso no deja caminos huérfanos.
- Líneas ancladas a elementos (`ref`/`startConnection`) que siguen al elemento y se podan cuando este desaparece.
- Velocidad uniforme en curvas mediante tabla de longitud de arco (Pitchboard).

**Sesiones**
- Lista ordenada de bloques con minutos (Sportfica, HockeyShare, Coach Board, RenderFoot); hora de inicio calculada; sin solapamiento.
- Bloque con tipo (calentamiento, técnico, funcional, juego reducido, juego) + dimensiones del espacio + puntos de coaching + preguntas.
- Plantillas de sesión y carpetas; modo presentación; PDF solo diagramas; resumen de material.
- Microciclo/semana como contenedor superior (bcoach, DEDUCCIÓN a partir de su descripción).

**Datos**
- Un solo JSON por ejercicio con `schemaVersion`; campos opcionales nuevos sin migración; migración real solo con subida de versión (Pitchboard).
- Guardado denso / lectura dispersa (Training Ground).
- Cola de sincronización local (IndexedDB) con `baseUpdatedAt` para conflictos (HockeyShare).
- Etiquetas de lista cerrada (Coaching Animator) en lugar de texto libre.
- Formación (posiciones) separada de jugada (formación + acciones) (Playbook Creator).

**Render y exportación**
- Una función de render pura compartida entre editor, vista previa y exportación (Pitchboard, Training Ground).
- Unidades reales (metros) y no píxeles.
- Compartir sin servidor con JSON comprimido en el fragmento de URL, con aviso de límite.
- Onion skin/fantasmas del paso anterior para ayudar a editar.

# Lo que NO deberíamos copiar

- **Coordenadas en píxeles de lienzo** (HockeyShare, Coaching Animator antiguo): atan los datos al tamaño de pantalla. Mantener metros o unidades de pista.
- **Instantáneas completas sin identidad estable entre fotogramas** (Sportfica: empareja fichas por tipo+equipo+dorsal si el `id` no coincide): las fichas pueden "teletransportarse" o duplicarse si cambia el dorsal.
- **Todos los elementos sincronizados al final del fotograma** (tactical-board.com): impide expresar que un jugador llega antes o espera.
- **Cadena lineal de variantes** como único modelo (Coaching Animator) cuando necesitamos ramas; y **copia completa por variante** (modelo antiguo del mismo proyecto, descartado por ellos por no propagar ediciones).
- **Limitar el número de fotogramas/pasos** (20 en AthletePath, 30 en planet.training, 10 invitado): son límites de producto, no de modelo.
- **Enlaces con todo el ejercicio en la URL sin límite** (Sportfica falla por encima de 14 000 caracteres): si lo hacemos, comprobarlo y degradar a enlace corto.
- **Todo en la vista de pago** (PDF, vídeo, colaboración tras suscripción): para un club, el PDF de sesión y compartir deberían ser básicos.
- **Documentos de muestra con coordenadas cruzadas entre secuencias** y `ease` casi siempre `none` (HockeyShare): una animación sin curvas de velocidad se ve mecánica; mejor permitir `ease` por ficha y por paso, como Training Ground.
- **IA generativa como pieza central** (HockeyShare, RPOLabs, Coach OS): llamativa pero fuera del alcance; solo reaprovechable la idea de un formato textual/JSON escribible por un agente (Training Ground, Coaching Animator "Practice Script").

---

## Notas de método y límites

- Capturas: no se obtuvieron nuevas (Chrome headless sin pantalla se quedó colgado; la tarea quedó en segundo plano y se ha abandonado). Las capturas que ya hay en `investigacion/capturas/` pertenecen a otros grupos.
- No se creó ninguna cuenta ni se inició sesión; los datos del modelo de HockeyShare proceden de la **demo pública anónima** (`?demo=1`) y de su bundle JS servido sin autenticación; los de tactical-board.com, del JS público de la página. Los productos de pago (TacticalPad, Sportplan, Coach Board, Coach Tactic Board, FirstDown PlayBook, Football Play Card, FútbolSesión, bcoach) quedan marcados como **no verificados por dentro**.
- Los repositorios abiertos se leyeron solo por sus archivos de texto (README, docs, tipos, JSON); no se descargó ni ejecutó ningún programa ni instalador.
