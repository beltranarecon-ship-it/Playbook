# Grupo A — Webs y herramientas de baloncesto en español / mundo hispano

Fecha de la investigación: 2026-10-04. Método: solo lectura (curl, WebSearch/WebFetch, un navegador integrado para ver páginas públicas). Sin cuentas, sin login, sin formularios, sin descargas de programas. Los banners de cookies no se aceptaron.

Convención: **[EVIDENCIA]** = visto en HTML/JS/JSON/imágenes públicas descargados. **[DEDUCCIÓN]** = inferido. **[NO VERIFICADO]** = requiere login/pago/instalación y solo se ve la parte de marketing.

Capturas guardadas en `D:/Claude Code/v2/cbp-v2/investigacion/capturas/`:
- `entrenamientosdebaloncesto-listado-tacticos.jpg` (listado por categoría)
- `entrenamientosdebaloncesto-ficha-tac0005.jpg` (ficha de ejercicio)
- `entrenamientosdebaloncesto-gif-tac0005-fotogramas.png` y `...-gif-tec0100-fotogramas.png` (fotogramas extraídos de los GIF de ejercicio)
- `sportdesigner-interfaz-editor.jpg` (captura de marketing del editor de escritorio que está detrás de la semilla)

---

## Resumen de hallazgos transversales

1. **La semilla (entrenamientosdebaloncesto.es) no tiene editor ni WordPress.** Es un sitio ASP.NET MVC sobre IIS (Grupo Campus, Bilbao) que publica **GIF animados de 200×190 px generados con "Sport Designer"**, un programa de escritorio de Windows (9,90 EUR). Los diagramas se crean fuera de la web, se exportan a GIF y se suben como imagen. El "modelo de datos" de la web es una tabla de metadatos plana (códigos `Tec-0100bas`, categoría, dificultad, intensidad, duración, objetivos por tipo) y un GIF por ejercicio.
2. **Hay dos filosofías de representación.** (a) Imagen/GIF/PNG pregenerada, sin estructura (semilla, ejerciciosdebaloncesto.com). (b) Diagrama como **datos estructurados** que se renderiza en SVG/canvas (Drills&Plays, Controla.Club, TeamBranch, CourtSensei). La segunda permite buscar, reanimar, reexportar y traducir; la primera solo mostrar.
3. **Drills&Plays es la referencia más cercana a nuestro modelo.** Su JSON v2 (visto en el HTML público) tiene `objects` + `steps[]` + `actions[]` con `participantId`, `duration`, `delay`, `destination`, `path` (catmull-rom con 4 puntos de control), `variants[]` y `zones[]`. Es casi isomorfo a nuestras fases con ramas y carriles de tiempo.
4. **Vocabulario de acciones muy estable entre herramientas:** movimiento/corte, bote, pase, tiro, bloqueo (screen), entrega/mano a mano. Se repiten en Drills&Plays (`move/dribble/pass/shot/screen/handoff`), CourtSensei (líneas V/M/P/D/S/B/G/T/H/E), Controla.Club (`arrow-run/pass/shot/dribble`) y TeamBranch. Convención visual repetida: **bote = línea continua/ondulada, pase = línea discontinua, corte = línea continua con flecha, bloqueo = trazo perpendicular, tiro = flecha al aro**.
5. **La animación se modela por "pasos" que se encadenan** (TeamBranch: "cada paso es un fotograma clave", el nuevo paso copia posiciones y trazos del anterior; Drills&Plays: `steps[]` con acciones simultáneas por paso y `delay`). Nadie interpola entre ejercicios de forma continua tipo timeline libre; es secuencial por pasos con acciones paralelas dentro del paso.
6. **El motor de reglas del editor ayuda al usuario.** Drills&Plays valida (solo quien tiene balón puede pasar, un defensor no puede ejecutar acciones ofensivas hasta que cambia la posesión, un tiro requiere canasta objetivo, máximo un balón en modo "jugada") y mantiene `possession` y `roles` derivados paso a paso.
7. **Plantillas de arranque (presets) reducen fricción:** saque de banda, saque de fondo, defensa individual, zona 2-3, zona 3-2 (Drills&Plays); "Formación" con 1-5 y DEF (CourtSensei); quinteto titular (TeamBranch).
8. **Biblioteca y taxonomía:** filtros por categoría/edad/dificultad/duración/nº de jugadores son universales. La semilla además clasifica por **objetivos en 6 familias** (específicos, estratégicos, físicos, psicológicos, tácticos, técnicos) y cada ejercicio lleva muchos tags de esas familias. ejerciciosdebaloncesto.com usa categoría principal + subcategoría con **una categoría primaria** y varias secundarias.
9. **Ficha de ejercicio:** campos recurrentes = título, descripción/desarrollo, objetivos, material, nº jugadores (mín-máx), duración, edad, dificultad, intensidad, espacio/dimensiones, variantes/progresiones, aspectos a incidir/evitar ("coaching points"). Sport Designer añade series, FC media (frecuencia cardiaca) y dimensiones.
10. **Exportaciones:** PNG (casi todos), GIF (semilla, TeamBranch, Sport Designer), PDF (Controla.Club, Bluelinden, Sport Designer, Drills&Plays PRO), vídeo (Drills&Plays, Bluelinden), enlace compartible (CourtSensei, TeamBranch, Drills&Plays), Excel (Drills&Plays).
11. **Comunidad/UGC con moderación:** ejerciciosdebaloncesto.com crea ejercicios con `status: "pending"` (moderación), votos, favoritos, comentarios, reportes; Drills&Plays tiene popularidad, likes, guardados, "agrupaciones" y perfiles de autor.
12. **Stacks vistos:** Drills&Plays = Rails + Fabric.js 5.3 (editor) + Three.js (visor 2D/3D, `schemaVersion 2`); ejerciciosdebaloncesto.com = React + Vite + **Supabase** (mismo backend que nuestra app) y SVG propio exportado a PNG vía canvas; Controla.Club = Next.js con SVG generado por código; la semilla = GIF estáticos en carpeta.

---

## Fichas

### Entrenamientos de Baloncesto (Ejercicios de Baloncesto Base) — https://entrenamientosdebaloncesto.es/ — baloncesto — web (biblioteca) respaldada por software de escritorio

- **Qué es y para quién.** Biblioteca pública y gratuita de ejercicios de baloncesto de formación, de Grupo Campus (Bilbao; la marca aparece como "by Grupo Campus"). Sirve de escaparate del programa de pago **Sport Designer** (banners en cada página enlazan a sport-designer.com). Audiencia: entrenadores de base. Ingresos: publicidad/captación del software (9,90 EUR en descarga para Windows, antes 14,90 EUR en la web matriz). **[EVIDENCIA]**: banners `banner1.gif`/`banner2.gif`, enlaces a sport-designer.com, páginas `sport-designer.com/es/Comprar` (9,90 EUR, PayPal, solo Windows XP-11, "No compatible con Android, iOS y Mac OSX").
- **Cómo se crea un ejercicio.** En la web **no se crea nada**: no hay editor, ni login visible, ni envío de ejercicios. Los ejercicios los diseña el equipo editorial con Sport Designer (escritorio): barra lateral de herramientas (goma, lápiz, línea recta, línea curva, rectángulo, rectángulo relleno, círculo, círculo relleno, texto, deshacer, rehacer), diálogo de iconos con pestañas (Movimientos, Numerados, Otros, Porterías; y Balones-Pelotas, Canastas, Conos-Picas, Físico, Jugadores), botones "Nuevo / Abrir / Guardar / Generar Gif / Generar Pdf" y un panel "Datos Extendidos" con Título, Objetivos, Variantes, Progresiones, Aspectos a incidir, Desarrollo, Dimensiones, Series, Fc. Media, Duración y Nº jugadores. **[EVIDENCIA]**: captura de marketing `sportdesigner-interfaz-editor.jpg` (editor para fútbol con campo verde) y la página de la matriz `campusdeportivo.com/cas/software-entrenamiento-baloncesto.asp` ("diseño de sesiones mediante gráficos deportivos (formato GIF)", "ejercicios gráfico + texto (formato HTML)", 14 disciplinas, "se pueden modificar e imprimir"). El flujo interno del editor es **[NO VERIFICADO]** (hay que comprar e instalar).
- **Cómo se representa.** **GIF animado en bucle infinito**, siempre 200×190 px, cabecera `GIF87a` + `NETSCAPE2.0` (loop 0), alojado en `/Ejercicios/Baloncesto_Castellano/<codigo>.gif`, más una miniatura JPG en `/Ejercicios/Baloncesto_Castellano/images/<codigo>.jpg` (usada en `og:image`). Visual: parquet de madera naranja con líneas blancas de media pista (aro arriba), jugadores = círculos amarillos numerados, balón = círculo naranja pequeño pegado al jugador, conos = triángulos pardos. **No hay flechas ni símbolos de trazo: el movimiento mismo (la animación) es la notación.** **[EVIDENCIA]**: descarga y análisis de 9 GIF con Pillow; ver `capturas/entrenamientosdebaloncesto-gif-*-fotogramas.png`.
- **Animación/reproducción.** Fotogramas pregenerados (no keyframes interpolados: son frames rasterizados). Duraciones medidas: `Tac-0001` 24 frames/6,5 s; `Tac-0005` 38 frames/8,8 s (retardos 200 ms y pausas de 1400 ms); `Tac-0009` 30 frames/4,8 s (160 ms constantes); `Tec-0100` 100 frames/20 s (200 ms); `Est-0003` 82 frames/17,2 s; `Tec-0118` 67 frames/14 s; `Pfi-0063` 23 frames/2,5 s; `Pfi-0079` 9 frames/1,9 s. El movimiento se ve en pasos de ~5-20 px por frame con **pausas largas (800-1400 ms) en los instantes clave** (recepción, bloqueo). Sin controles de usuario (ni pausa, ni velocidad, ni paso a paso). **[EVIDENCIA]**
- **Modelo de datos.** **[EVIDENCIA]** (HTML renderizado por servidor, un registro por ejercicio):
  - Identificador `Cat-NNNNbas` (prefijo por categoría: `Tec`=técnicos, `Tac`=tácticos, `Est`=estratégicos, `Glo`=globalizados, `Pfi`=físicos, `Psi`, `Esp`; sufijo `bas` = baloncesto base) + slug: `/ejercicio/Tac-0005bas/tiro-con-bloqueo-directo-y-continuacion`.
  - Campos de la ficha: `título`, `descripción` (texto con saltos `<br/>`, una frase por línea = una fase del ejercicio), `edad recomendada` (rango tipo `0-99` o `11-99`), `dificultad` (Baja/Media/Alta/Máxima), `intensidad` (mismo escalado), `duración` (min), `categoría` principal, `Elementos` (material: Canastas, Pivotes, Petos, Vallas, Cuerdas...; `N Equipos (n Balones, n Porterías)`; `a - b Jugadores (n Porteros)`; `Dimensiones del campo: Nm` con un nivel 0-4 en metros que parece un código y no una medida real), `CONSEJOS` en tres claves fijas (**Incidir**, **Evitar**, **Progresión**) y `OBJETIVOS` agrupados en 6 familias (Específicos = posición del jugador: bases, escoltas, aleros, ala-pívot, pívot("porteros" por herencia de fútbol); Estratégicos; Físicos; Psicológicos; Tácticos; Técnicos) con ~80 tags en total.
  - No hay JSON-LD, ni API, ni sitemap (`/sitemap.xml` y `/robots.txt` devuelven 404 de IIS; `/wp-json` 404 = no es WordPress). Meta `generator` = "#". Cabecera `X-Powered-By: ASP.NET`, `Server: Microsoft-IIS/10.0`, `Plesk`. jQuery + Bootstrap 3 + animsition.
  - Búsqueda: formulario `POST /Publico/Buscar` (término + filtros) y URLs GET de enlace permanente por tag (`/Buscar/2x1`, `/objetivo-bloqueos-directos/`, `/edad-8-a-11-anos/`, `/dificultad-media/`, `/categoria-tacticos/?pagina=2`).
- **Biblioteca y organización.** Home con ejercicios destacados y chips de búsquedas frecuentes; menú con 4 desplegables (Categorías, Edades, Dificultad, Objetivos) y buscador avanzado plegable; listado en tarjetas de 2 columnas con GIF, categoría (etiqueta naranja), título, extracto de descripción, **semáforo de dificultad** (verde/amarillo) y botón "Ver"; paginación `?pagina=N` (23 por página). Tamaño del catálogo medido: 7 categorías con 6/22+/15/23+/11/23+/23+ ejercicios por primera página (decenas por categoría, del orden de ~150-200 en total). Ficha: GIF grande + banner de producto, título, descripción, panel de 3 métricas (edad, dificultad, intensidad), duración con icono, compartir en Facebook/Twitter, bloque Elementos, bloque Consejos, acordeón de objetivos con chips clicables que llevan a la lista filtrada por ese tag. **No hay favoritos, sesiones, PDF, ni login.** **[EVIDENCIA]** (ver 8 fichas analizadas: Tec-0100, Tec-0118, Est-0003, Glo-0012, Tac-0005, Tac-0009, Tac-0017, Pfi-0063, Pfi-0079).
- **Puntos fuertes / débiles.**
  - Fuertes: taxonomía de objetivos muy rica y navegable (cada chip es un filtro); ficha muy escaneable (tres métricas + tres consejos fijos); GIF autocontenido que enseña el ejercicio sin leer; semáforo de dificultad; URL legibles.
  - Débiles: el GIF es diminuto (200×190), sin símbolos de trazo ni leyenda; no hay control de reproducción; el contenido es estático e inmutable (no editable ni reutilizable); sin favoritos/sesiones/PDF; el campo "Dimensiones del campo" es un nivel opaco; "Edad recomendada 0-99" casi siempre vacío de significado; textos con codificación rota (`ï¿½`) en la salida; sin sitemap ni datos estructurados (mal SEO técnico).
- **Ideas aplicables a nuestra app.**
  - [Alta][Fácil] Añadir a la ficha del ejercicio los tres campos de consejos fijos **Incidir / Evitar / Progresión** (además de objetivo y material); estructura corta y muy escaneable.
  - [Alta][Fácil] Chips de objetivos agrupados por familia (técnico, táctico, físico, psicológico) en la ficha, **clicables como filtros** en la biblioteca.
  - [Media][Fácil] Semáforo de dificultad e intensidad como dos métricas en cabecera de la tarjeta/ficha.
  - [Media][Medio] Exportar un **GIF animado** desde la Pizarra (nuestro motor ya reproduce fases): generaría miniaturas "vivas" en la biblioteca y material compartible (WhatsApp). Pausar 800-1400 ms en los hitos del ejercicio es lo que hace legible su GIF; reflejar eso en nuestro tempo por defecto (pausa tras pase/bloqueo).
  - [Media][Fácil] Tarjeta de listado con miniatura + dificultad + botón único "Ver"; paginación simple.
  - [Baja][Fácil] Códigos de ejercicio por categoría (`TEC-0100`) como referencia legible para entrenadores.
- **Fuentes.** https://entrenamientosdebaloncesto.es/ ; `/categoria-tacticos/` ; `/categoria-tecnicos/?pagina=2` ; fichas `/ejercicio/Tac-0005bas/...`, `/ejercicio/Tac-0009bas/...`, `/ejercicio/Tac-0017bas/...`, `/ejercicio/Tec-0100bas/...`, `/ejercicio/Tec-0118bas/...`, `/ejercicio/Est-0003bas/...`, `/ejercicio/Glo-0012bas/...`, `/ejercicio/Pfi-0063bas/...`, `/ejercicio/Pfi-0079bas/...` ; GIF `/Ejercicios/Baloncesto_Castellano/*.gif` ; https://www.sport-designer.com (home, /es/Demo, /es/Descarga, /es/Comprar, `/Content/Images/captura.jpg`) ; http://www.campusdeportivo.com/cas/software-entrenamiento-baloncesto.asp

---

### Sport Designer (software de Grupo Campus) — https://www.sport-designer.com — 14 deportes (fútbol, baloncesto, balonmano, fútbol sala, voleibol, pelota, gimnasia...) — programa de escritorio Windows

- **Qué es y para quién.** Software para entrenadores que diseña ejercicios en movimiento, crea jugadas, "books" de ejercicios y convocatorias, con una parte online (red social privada, biblioteca compartida, acceso móvil). Licencia de 16 dígitos, descarga de 44 MB, `.EXE`, solo Windows. Precio 9,90 EUR (PayPal). **[EVIDENCIA]** (páginas Home/Descarga/Comprar). El producto en sí es **[NO VERIFICADO]**: no se descargó ni instaló.
- **Cómo se crea un ejercicio.** Ver ficha anterior: barra lateral vertical de herramientas de dibujo, diálogo flotante de iconos por pestañas, botones superiores Nuevo/Abrir/Guardar/Generar Gif/Generar Pdf, panel "Datos Extendidos". La captura de marketing muestra el diálogo "Iconos" con una rejilla de fichas por pestaña y botón "Actualizar". **[EVIDENCIA parcial]** (imagen) — no se sabe cómo se definen los pasos de animación (se deduce que se manejan como fotogramas clave y se exportan a GIF).
- **Cómo se representa.** Campo de juego rasterizado por deporte (césped con franjas para fútbol); iconos propios; salida GIF animado y PDF; HTML (gráfico + texto) para web.
- **Animación/reproducción.** "Ejercicios en movimiento": se exportan como GIF. Detalles de edición **[NO VERIFICADO]**.
- **Modelo de datos.** Fichero propio (formato desconocido) + biblioteca online. Panel lateral "Ejercicios" visto en la captura: búsqueda por **Título, Propios (mis ejercicios), Deporte, Área, Idioma, Puntuación**; ordenación **recientes / puntuación / votos / descargas**; cada resultado = miniatura + título + "subido por <usuario> el <fecha>" + estrellas (nº de votos) + nº de descargas; "Resultados: 29". **[EVIDENCIA]** (captura). Esto es una **biblioteca comunitaria dentro del propio editor**.
- **Biblioteca y organización.** Como arriba: comunidad con votos, descargas y ordenación por popularidad; "propios" separados de los de la comunidad.
- **Puntos fuertes / débiles.** Fuerte: editor y biblioteca integrados, metadatos muy específicos de entrenador (series, FC media). Débil: escritorio Windows-only, tecnología de 2010, sin móvil, sin colaboración en tiempo real; marketing dice "acceso mobile" pero no se verifica.
- **Ideas aplicables.**
  - [Alta][Fácil] Campos de "Datos Extendidos" útiles para nuestra ficha: **series**, **frecuencia cardiaca media** (para físicos), nº de jugadores como rango, dimensiones del espacio.
  - [Media][Medio] Panel lateral de biblioteca dentro del propio editor (insertar o abrir ejercicio sin salir) con búsqueda y ordenación por recientes/valoración.
  - [Baja][Medio] Valoración por estrellas y contador de descargas/uso en ejercicios compartidos entre equipos del club.
- **Fuentes.** https://www.sport-designer.com/es/home, /es/Demo, /es/Descarga, /es/Comprar, `/Content/Images/captura.jpg`.

---

### Drills&Plays — https://www.drillsandplays.com/es/welcome/index — baloncesto — web (plataforma, freemium con PRO)

- **Qué es y para quién.** Plataforma web gratuita (con plan PRO) para entrenadores de baloncesto: editor de diagramas (jugadas y ejercicios), biblioteca pública de jugadas/ejercicios creados por la comunidad (~1.320 jugadas y ~125 ejercicios solo de "bote" visibles el día del análisis), planificador semanal, scouting, gestión de equipos, asistencia. Idiomas: es, en, fr, ca, pt. Inicio de sesión con Google/Facebook. Modelo: publicidad (Google Funding Choices, enlaces de afiliados a Amazon) + PRO. **[EVIDENCIA]** (HTML público).
- **Cómo se crea un ejercicio.** Flujo (deducido de las cadenas de i18n del bundle público del visor `playbook_viewer/app-*.js` y de las pantallas citadas) **[EVIDENCIA parcial en textos / DEDUCCIÓN en flujo]**:
  1. "Inicia un diagrama nuevo" → **modo** "Jugada" o "Ejercicio", y **pista** (media/completa).
  2. "Elige una situación inicial": presets **en blanco, saque de banda, saque de fondo, defensa individual, zona 2-3, zona 3-2** (editables al instante).
  3. "Añadir a la cancha": jugador atacante, jugador defensor, entrenador (solo en modo ejercicio), balón, cono.
  4. Seleccionar jugador → panel de **Acciones**: Movimiento, Bote, Pase, Tiro, Bloqueo, Mano a mano; para pase/mano a mano "Selecciona un receptor", para tiro canasta objetivo. Se dibuja la trayectoria sobre la pista.
  5. **Inspector** de propiedades: tipo de objeto, número/nombre, tipo (jugador/entrenador), rol base, rol actual, con balón, duración (s), trayectoria (directa/arco), final X/Y, retardo, **variante**.
  6. **Pasos** ("Añadir paso", duplicar paso, eliminar paso, descripción por paso, "Continuar con el siguiente paso"); borrar el último paso pide confirmación doble.
  7. **Vista**: retransmisión, superior, línea de fondo (2D/3D); **tema**: cancha clásica, alto contraste, cancha azul, cancha oscura.
  8. Deshacer/Rehacer, Importar/Exportar **JSON canónico** (el propio editor expone el JSON), guardar en privado / guardar y publicar.
- **Cómo se representa.** Dos renderizadores: el **editor** usa Fabric.js 5.3.0 (CDN cdnjs) **[EVIDENCIA]**; el **visor** de la página pública empaqueta Three.js (cámara perspectiva y ortográfica, vista 2D/3D, dimensiones reales de cancha NBA en pies convertidas a metros) y genera una **imagen PNG por paso** (`/playbooks/<id>/v2_step_image?step_id=step-1&view=2d`, PNG RGBA 1600×1524) que sirve de miniatura y de SEO (JSON-LD `HowTo` con `step[]`). Exportaciones: imagen, vídeo, PDF/Excel (PRO). Páginas públicas con botones Me gusta, Guardar, Compartir (Facebook, X, copiar enlace, Telegram).
- **Animación/reproducción.** Botón "Reproducir/Pausar" y contador "Paso n / N". Cada paso contiene acciones **simultáneas** con `duration` (típico 0,8 s) y `delay` por acción; entre pasos el estado (posiciones, posesión, roles, bloqueos activos) se reconstruye aplicando las acciones (función `Ac`/`Ys` en el bundle: `positions`, `possession`, `screening`, `roles`). Los trazos de movimiento usan **spline Catmull-Rom** de 4 puntos de control. En la página analizada el texto decía "La reproducción interactiva no está disponible" y mostraba solo los diagramas por paso: la reproducción depende de la versión/compatibilidad del navegador. **[EVIDENCIA]**
- **Modelo de datos. [EVIDENCIA real]** Un bloque `<script type="application/json" data-v2-playback-document>` en cada página pública de jugada (`/es/playbooks/<id>`). Estructura (jugada 12846):
  ```
  { schemaVersion: 2, sourceLocale: "ca", theme: "classic", mode: "play"|"drill",
    court: { mode: "half"|"full", type: "nba" },
    startingPreset: "sidelineInbound"|"blank"|...,
    objects: [
      { id, type:"player", position:{x,y}, rotation, label:"1"|"D1",
        participantType:"player"|"coach", baseRole:"offense"|"defense" },
      { id, type:"ball", position:{x,y}, rotation, ownerId:<playerId>|null }
      (+ "cone" en modo ejercicio) ],
    steps: [ { id:"step-1", name:"Setup",
      descriptions:{es,en,ca,fr,pt}, duration:0,
      actions:[ { id, type:"move"|"screen"|"dribble"|"pass"|"shot"|"handoff",
                  participantId, duration:0.8, delay:0,
                  destination:{x,y}, trajectory:"direct"|"arc",
                  path:{ type:"catmullrom", points:[{x,y}x4] },   // move/dribble/screen
                  ballId, targetId, basketTarget } ],            // pass/handoff/shot
      variants:[], zones:[] } ],
    activeStepId }
  ```
  Coordenadas en metros con origen en el centro de la pista (ejemplo: x entre -8 y 7, y entre -13 y -2). Reglas deducidas del código: `possession[ballId]=targetId` tras pase/mano a mano; `shot` pone la posesión a null y la posición del balón en `basketTarget`; `roleTransitions` permite que un defensor pase a ofensivo al recibir posesión; los `variants` son pases alternativos del jugador y sólo están disponibles "cuando el jugador tiene un movimiento, un bote, un bloqueo o un pase"; `zones[]` lleva texto (zona con nota). Máximo un balón en modo jugada; el entrenador solo en modo ejercicio. Normalizador `ad()` migra v1→v2 (`team:"defense"` → `baseRole`). Textos del paso en 5 idiomas con `sourceLocale`.
  - Listados: `/es/playbooks/index_all_plays?page=N&sort_by=published_at|popularity`; categorías `/es/categories/<id>-<slug>`: **jugadas** (media pista, presión en toda la pista, banda, fondo, contraataque, defensa en zona, final de partido, especiales) y **ejercicios** (bote, tiro, pase, pies y desplazamientos, rebote, forma física, equipo, simulación de partido). Metadatos visibles: título, descripción, hashtags (`#controldebalón`), autor, tipo (Jugada/Ejercicio), fecha, vistas, likes, guardados, "Pertenece a la agrupación" (colecciones tipo "Drills", "Activaciones").
- **Biblioteca y organización.** Categorías múltiples por ejercicio, agrupaciones (colecciones del autor), orden por fecha/popularidad, perfiles de autor, "Gestiona tus equipos", planificador semanal y calendario, "diseño de entrenamientos" con la biblioteca, scouting de rivales, asistencia, comentarios, compartir, afiliados, `CoachBot` (asistente). Robots permite todo salvo `.webm`; sitemap público.
- **Puntos fuertes / débiles.** Fuertes: **modelo de datos limpio y exportable (JSON)**; reglas de dominio (posesión, roles); presets de formación; modo jugada vs. ejercicio; multi-idioma por paso; páginas indexables con imagen por paso. Débiles: depende de login y de un visor pesado (Three.js 640 KB) para ver la animación; mucha publicidad; la mayoría del contenido público tiene poca descripción; ejercicios con cono/escalera de coordinación limitados; PRO para exportar profesional.
- **Ideas aplicables a nuestra app.**
  - [Alta][Fácil] **Presets de situación inicial** al crear un ejercicio (saque de banda/fondo, 5 contra 5 individual, zonas 2-3/3-2/1-3-1). Reduce el trabajo de colocar fichas.
  - [Alta][Medio] **Estado derivado por paso** (posesión del balón y roles ataque/defensa) calculado desde las acciones, con **validaciones** que avisen al usuario (no puede pasar quien no tiene balón; tiro necesita canasta). Evita datos incoherentes en nuestras fases.
  - [Alta][Fácil] **Importar/Exportar JSON canónico** del ejercicio (copia de seguridad, compartir entre dispositivos, depuración). Bluelinden recibió quejas precisamente por no poder pasar pizarras entre dispositivos.
  - [Alta][Medio] Trayectorias como **spline Catmull-Rom con 4 puntos** (inicio, 2 controles, fin) en lugar de segmentos rectos: da cortes y botes más naturales; se renderiza con un `path` SVG.
  - [Media][Medio] **Imagen por paso** (`step_image`) para SEO/miniaturas y para PDF de sesión (una fila por fase).
  - [Media][Fácil] Descripción por fase (campo "descriptions" por paso) además del texto global.
  - [Media][Fácil] Temas de pista (clásica, alto contraste, oscura) y vistas (superior).
  - [Media][Medio] **Agrupaciones/colecciones** y orden por popularidad en la biblioteca.
  - [Baja][Difícil] Vista 3D (Three.js): coste alto, valor bajo para nuestro caso.
- **Fuentes.** https://www.drillsandplays.com/es/welcome/index ; `/jugadas-baloncesto` ; `/es/playbooks/12846`, `/12840`, `/12833`, `/12827`, `/12812`, `/12765` ; `/assets/playbook_viewer/app-35cfe539...js` ; `/es/categories/35-ejercicios-de-baloncesto-de-bote-de-balon` ; `/robots.txt`. Artículo de apoyo: https://jgbasket.net/drills-and-plays/

---

### Ejercicios de Baloncesto (directorio comunitario) — https://ejerciciosdebaloncesto.com/ — baloncesto — web (SPA React + Supabase)

- **Qué es y para quién.** "Directorio para entrenadores": buscador avanzado, filtros por nivel y edad, pizarra táctica online sencilla, creación y publicación de ejercicios por usuarios, "embajadores". Modelo freemium: regístrate y crea 10 ejercicios para conseguir Premium; usuarios gratuitos guardan hasta 5 favoritos; Premium incluye exportar planes a PDF, analíticas y funciones exclusivas. Publicidad (AdSense + consentimiento). **[EVIDENCIA]** (bundle JS).
- **Cómo se crea un ejercicio.** Formulario (no diagrama): nombre único (comprueba duplicados con `ilike`), descripción, categorías múltiples con **una marcada como principal**, rangos de edad, dificultad, duración, jugadores mín-máx, material, objetivos, objetivos de aprendizaje, variaciones, **subir imágenes o enlazar vídeos de YouTube** (al menos uno obligatorio). Al enviar queda `status: "pending"` (moderación). Hay además un flujo de **importación con origen** (`exercise_imports`: `source_url`, `source_site`, `import_method`, `imported_with_ai`, `needs_review`, `original_payload`). **[EVIDENCIA]**
- **Pizarra online (herramienta aparte, sin guardar).** Barra: Seleccionar, Cono, Ataque, Defensa, Flecha y tipo de flecha (Movimiento, Bote, Pase), borrar seleccionado, Tipo de pista (pista completa/media), **Descargar PNG**. Los elementos se guardan en estado React como `{id, type:"attack"|"defense"|"cone", x, y, playerNumber}` y las flechas como `{id, type:"move"|"dribble"|"pass", fromX, fromY, toX, toY}`; el SVG usa `marker-end="url(#arrowhead)"`; **pase = línea discontinua `10 8`**, bote = `path` (línea quebrada/ondulada), movimiento = línea recta; el SVG se serializa, se pinta en un `canvas` blanco y se descarga como `diagrama-baloncesto-<timestamp>.png`. Posición del puntero convertida con `getBoundingClientRect` + `viewBox`. **[EVIDENCIA]** (código del bundle). El diagrama NO se persiste en BD, solo la imagen subida.
- **Cómo se representa.** Ficha con carrusel de imágenes (o vídeo YouTube), chips de dificultad (colores) y de duración/edad sobre la imagen; listados en tarjetas con `images[0]`.
- **Animación/reproducción.** No hay animación en la pizarra; el vídeo se resuelve con YouTube. **[EVIDENCIA]**
- **Modelo de datos. [EVIDENCIA]** Tablas Supabase vistas en `.from()`: `exercises` (name, description, age_range, difficulty, duration, players_min, players_max, image_url, images[], videos[], equipment[], objectives[], learning_objectives[], variations[], category/main_category/subcategory, primary_main_category, primary_subcategory, user_id, status, slug), `exercise_categories` (exercise_id, main_category, subcategory, is_primary), `profiles`, `votes`, `favorites`, `comments`, `comment_votes`, `comment_reports`, `exercise_reports`, `user_feedback`, `exercise_imports`; RPC `get_all_users_with_profiles`; Storage buckets `exercises` y `profiles`. Taxonomía: **Técnica** (Juego de pies, Paradas y salidas, Finalizaciones, Tiro, Pase, Bote, Paso 0), **Táctica** (Desplazamiento defensivo, Rebote, Juego sin balón, Defensa, Mano a mano, Contraataque, Bloqueo indirecto, Bloqueo directo, Sistemas de juego), **Físico** (Entrenamiento físico baloncesto). Niveles: Principiante/Intermedio/Avanzado. Edades: U-6, U-10, U-12, U-14, U-16, U-18+. Jugadores: 1-2, 3-5, 6-10, 11+ (Equipo completo). Orden: recientes (y otros). Caché local de resultados de listados. Panel admin: dashboard, ejercicios reportados, feedback, usuarios, todos los ejercicios.
- **Biblioteca y organización.** Navegación por cabecera Táctica/Técnica/Físico con submenú de subcategorías; vista "categorías" y filtros combinables (dificultad, edad, jugadores, ordenación); favoritos, votos, comentarios con votos y reportes; perfiles; moderación previa.
- **Puntos fuertes / débiles.** Fuertes: **mismo stack que nuestra app (Supabase)** con esquema relacional simple y moderación; categorías múltiples con primaria; comprobación de duplicados; reportes. Débiles: los ejercicios son **imágenes/vídeo, no diagramas estructurados** (no se pueden buscar, reanimar ni editar); la pizarra no guarda ni anima; la taxonomía de 17 etiquetas es pobre frente a la de la semilla.
- **Ideas aplicables a nuestra app.**
  - [Alta][Fácil] Categorías múltiples con **categoría principal** (`is_primary`) en tabla puente `exercise_categories`.
  - [Media][Fácil] Estado `pending/approved` + reportes para ejercicios compartidos entre equipos o públicos del club (si algún día se comparte entre clubes).
  - [Media][Fácil] Comprobación de nombre duplicado al guardar.
  - [Media][Medio] "Importación con origen" (`source_url`, `needs_review`) para pasar ejercicios de papel/otros sitios a la biblioteca con trazabilidad.
  - [Baja][Fácil] Filtro por **nº de jugadores en cubos** (1-2, 3-5, 6-10, 11+) y edad en Sub/U.
- **Fuentes.** https://ejerciciosdebaloncesto.com/ ; `/assets/index-C9scgdvZ.js` (bundle) ; `/sitemap.xml` ; `/pizarra-baloncesto-online` ; `/ejercicios`.

---

### Controla.Club — Biblioteca de entrenamientos de baloncesto — https://controla.club/herramientas/entrenamientos-baloncesto — baloncesto — web (Next.js; SaaS de gestión de clubes con herramienta gratuita)

- **Qué es y para quién.** Herramienta gratuita de captación del SaaS Controla.Club (gestión de clubes en Latinoamérica: cobros, WhatsApp, acceso QR). Presenta un "Libro de entrenamientos" con 30 ejercicios con diagramas, filtros y **descarga en PDF** sin registro. **[EVIDENCIA]**
- **Cómo se crea un ejercicio.** No hay editor: contenido editorial fijo en el código del cliente. **[EVIDENCIA]**
- **Cómo se representa.** **Diagramas SVG generados por código** a partir de datos (viewBox 1000×950, pista con zona, círculo de tiros libres, arco de 3 puntos y aro dibujados con `rect/circle/path`; fondo con `pattern`). Jugador = círculo con letra/número (equipo A rojo, B, neutros), balón = círculo blanco con pentágono, cono, y **tres `marker` de flecha por tipo** (carrera amarillo `#facc15`, pase blanco, tiro rojo `#ef4444`); pase = `stroke-dasharray="10 8"`. Descarga PDF por ejercicio y "Descargar libro (30)". **[EVIDENCIA]** (SVG del HTML).
- **Animación/reproducción.** No existe.
- **Modelo de datos. [EVIDENCIA real]** (objeto JS en un chunk del cliente):
  ```
  { id:"bb-006", slug, title, category:"pase", ageGroups:["sub-12",...,"adultos"],
    difficulty:"principiante"|"intermedio"|"avanzado", duration:12,
    minPlayers:4, maxPlayers:12, spaceSize:"Medio campo"|"20x6 m"|"Zona de tiro",
    equipment:["Balones","Petos"], objectives:[...], description,
    steps:[...], variations:[...], coachingPoints:[...],
    diagram:{ pitch:"half-court"|"court"|"key"|"small",
      elements:[ {type:"player-a"|"player-b"|"player-n", x,y, label}, {type:"ball",x,y},
                 {type:"cone",x,y}, {type:"text"...},
                 {type:"arrow-run|arrow-pass|arrow-shot|arrow-dribble", x,y,x2,y2} ],
      legend:"..." } }
  ```
  Coordenadas **en porcentaje (0-100)** de la pista; 4 tipos de pista (completa, media, "zona" y "reducida"); 12 categorías (calentamiento, fundamentos, dribling, pase, tiro, finalización, defensa, rebote, táctica, transición, juego reducido, físico); edades sub-6...adultos; 3 dificultades. Es el **modelo de diagrama estático más simple y limpio** visto.
- **Biblioteca y organización.** Filtros por categoría, edad, duración, nº de jugadores; contador "Mostrando 30 de 30 · 404 min acumulados"; chips de edades; botón **PDF por ejercicio** y libro completo; "Crea tu sesión perfecta" (selección de varios ejercicios para componer sesión [DEDUCCIÓN a partir del contador de minutos acumulados y del botón "Descargar libro"]). `llms.txt`/`llms-full.txt` publicados para IA.
- **Puntos fuertes / débiles.** Fuertes: modelo de datos mínimo y claro; PDF sin registro; la lista de `coachingPoints`, `steps`, `variations` separa bien las ideas de la ficha. Débiles: sin editor; contenido genérico; sin animación; solo 30 ejercicios.
- **Ideas aplicables a nuestra app.**
  - [Alta][Fácil] Separar en la ficha **pasos numerados** (`steps`), **variantes** (`variations`) y **puntos de coaching** (`coachingPoints`) como listas, no un único texto.
  - [Alta][Medio] **PDF de sesión**: sumar ejercicios (contador de minutos acumulados) y descargar un único PDF con diagrama + ficha de cada uno; es el patrón más pedido por entrenadores.
  - [Media][Fácil] Leyenda corta del diagrama (`legend`) y colores/estilos de flecha por tipo de acción (amarillo carrera, blanco discontinuo pase, rojo tiro).
  - [Media][Fácil] Formato de espacio (`spaceSize`): "Medio campo", "Cancha completa", "20x6 m" como texto libre con autocompletado.
- **Fuentes.** https://controla.club/herramientas/entrenamientos-baloncesto ; chunk JS `/_next/static/chunks/0wf4_a5cbfh3v.js` ; https://controla.club/llms-full.txt

---

### CourtSensei — Pizarra de baloncesto online — https://www.courtsensei.com/ (herramienta gratuita y blog en español) — baloncesto — web (Next.js, freemium)

- **Qué es y para quién.** Pizarra gratuita sin registro (genera un fotograma), enlazada a un producto de pago que añade animación, playbook, entrenamientos cronometrados, scouting y vídeo. Blog SEO en español sobre planificación semanal y ejercicios por edad. **[EVIDENCIA]** (página y WebFetch). Los precios y la parte de pago son **[NO VERIFICADO]**.
- **Cómo se crea un ejercicio.** Elige media pista/pista completa → arrastra jugadores → barra de herramientas con **atajos de una tecla**: Seleccionar y mover (V), Línea de movimiento (M), Línea de pase (P), Bote (D), Bloqueo (S), Balón (B), Mirada (G), Anotación (T), Entrega (H), Borrador (E), y panel "Formación" con jugadores 1-5 y DEF → "Descargar / copiar PNG" y "Copy share link". **[EVIDENCIA]** (texto de la página).
- **Cómo se representa.** Canvas/SVG en el navegador; PNG; enlace de compartir (probablemente codifica el estado en la URL [DEDUCCIÓN]). Elementos propios: "Mirada" (dirección de la vista del jugador) y "Anotación" (texto).
- **Animación/reproducción.** Solo en la versión de pago ("animar jugadas"): **[NO VERIFICADO]**.
- **Modelo de datos.** **[NO VERIFICADO]** (no hay API pública).
- **Biblioteca y organización.** Producto de pago: playbook, entrenamientos cronometrados, conexión con scouting y vídeo. El blog recomienda conectar objetivos semanales con una biblioteca de ejercicios.
- **Puntos fuertes / débiles.** Fuertes: **atajos de teclado de una letra por herramienta**, herramienta de "Mirada" y "Anotación", sin registro, copiar imagen al portapapeles. Débiles: un solo fotograma en la versión gratuita.
- **Ideas aplicables.**
  - [Alta][Fácil] **Atajos de teclado de una tecla por acción** en la Pizarra (M mover, P pase, D bote, S bloqueo, B balón, T texto, E borrar) y Ctrl+Z/Ctrl+Y.
  - [Media][Fácil] Acción/anotación de "mirada" (dirección de visión) como flecha ligera.
  - [Media][Fácil] Botón "Copiar enlace" y "Copiar imagen al portapapeles" (compartir con un clic por WhatsApp).
- **Fuentes.** https://www.courtsensei.com/blog/es/pizarra-tactica-baloncesto-online-guia-entrenadores ; https://www.courtsensei.com/blog/es/pizarra-entrenador-baloncesto-online-planificacion-semana

---

### TeamBranch — Pizarra táctica de baloncesto online (versión por país: Uruguay, Argentina...) — https://teambranch.io/uy/equipo-de-basquetbol/tactique — baloncesto y otros deportes — web (Next.js; gratis, sin registro)

- **Qué es y para quién.** Plataforma generalista de "equipos de ensueño" y formaciones, con una pizarra táctica para baloncesto y otros 12 deportes. Se localiza por país con la misma plantilla de texto SEO ("Pizarra táctica de baloncesto online · Uruguay"). Gratis, con publicidad (Mediavine). **[EVIDENCIA]**
- **Cómo se crea un ejercicio.** Coloca el quinteto titular (opción de **fotos reales de jugadores**), dibuja trazos (Corte/desplazamiento, Pase, Bote, Tiro, Bloqueo (screen), Zona y anotación, cada uno **en el color elegido**), añade pasos; **el nuevo paso copia posiciones y trazos del anterior** y solo se mueve lo que cambia; editar paso → duración en segundos (**0,3-10 s por fotograma**); Ctrl+Z/Ctrl+Y con historial completo; "Guardar y compartir → Animación GIF → Descargar"; media pista o completa; parquet "a línea limpia"; **modo oscuro**; opción "aparecer en creaciones públicas" con plantilla (título, descripción) y enlace compartido de **solo lectura** que muestra la última versión guardada (`teambranch.io/uy/tactique/pnr-7c4`). **[EVIDENCIA]** (texto de la página). La interfaz real del editor es **[NO VERIFICADO]**.
- **Cómo se representa.** Exportaciones: GIF animado optimizado en peso (incluido formato 9:16 para Stories/Reels/TikTok), PNG HD, enlace compartible. Los pasos se muestran como storyboard (Paso 1 · base, Paso 2 · bloqueo, Paso 3 · roll...).
- **Animación/reproducción.** "Cada paso es un fotograma clave y la herramienta los encadena"; 3-5 pasos suelen bastar para un pick-and-roll o un saque; duración por paso 0,3-10 s. **[EVIDENCIA textual]** — interpolación entre posiciones: [DEDUCCIÓN] (probablemente lineal).
- **Modelo de datos.** **[NO VERIFICADO]**; por el comportamiento: lista de pasos con (posiciones + trazos + duración) y un identificador corto de enlace público.
- **Biblioteca y organización.** Feed, Top 100 y creaciones públicas; plantillas de jugadas conocidas (pick-and-roll, saque, defensa zona, "números especiales de sistemas de juego" de 1936-2026) como contenido editorial.
- **Puntos fuertes / débiles.** Fuertes: **duplicar paso copiando todo** (flujo mínimo para animar), GIF/PNG/enlace en un clic, sin registro, tema oscuro. Débiles: enfoque de aficionado y redes; no hay planificación de sesión ni ficha de ejercicio; contenido SEO largo.
- **Ideas aplicables.**
  - [Alta][Fácil] Al **añadir fase, copiar automáticamente la anterior** (posiciones finales como inicio de la nueva) — comprobar que nuestro flujo ya lo hace; si no, es la mejora de UX más rentable.
  - [Media][Medio] Exportar **GIF vertical 9:16 / cuadrado** para compartir por WhatsApp con jugadores.
  - [Media][Fácil] **Enlace de solo lectura** con "versión guardada más reciente".
  - [Baja][Fácil] Tema oscuro de pista.
- **Fuentes.** https://teambranch.io/uy/equipo-de-basquetbol/tactique ; https://teambranch.io/ar/equipo-de-basquet/tactique

---

### bcoach (Bcoach Basket) — https://basket.bcoach.app/ — baloncesto — app + web (Valencia, España)

- **Qué es y para quién.** App de gestión para entrenadores de baloncesto: **diseño de tareas** con "hojas de sesión" (animar, guardar, compartir), **pizarra táctica** (configurar jugadores, colores, tipos de cancha, cargar imágenes del partido, editar imágenes y vídeos importados), **estadísticas de partido**. Pruebas 7 días gratis; precios en `/precios`. Testimonios de entrenadores profesionales españoles. **[EVIDENCIA]** (landing en WordPress+Elementor); producto **[NO VERIFICADO]** (app cerrada, `apps.apple.com/es/app/bcoach-for-basket-coaches`).
- **Cómo se crea un ejercicio.** "Hojas de sesión" que incluyen el cinco inicial, suplentes, duración, camisetas; elementos técnicos y de preparación física; animación para visualizar la ejecución. Paso a paso no visible. **[NO VERIFICADO]**
- **Cómo se representa.** Hoja de tarea con diagrama + datos; animación; pizarra con imágenes/vídeo importados.
- **Animación/reproducción.** Existe ("crear animaciones para visualizar la ejecución de la tarea"). Sin detalles.
- **Modelo de datos.** **[NO VERIFICADO]**.
- **Biblioteca y organización.** bcoach Club, tutoriales, blog; compartir con el equipo.
- **Puntos fuertes / débiles.** Fuerte: integración de ejercicios + pizarra + estadísticas hecha por entrenadores; **importar imágenes y vídeo del partido sobre la pizarra** para analizar. Débil: sin información pública sobre editor y datos.
- **Ideas aplicables.**
  - [Media][Medio] Poder **superponer dibujo sobre una imagen o captura de vídeo** (fondo de pizarra alternativo a la pista).
  - [Baja][Medio] Datos de sesión: quinteto inicial, suplentes y camisetas en la hoja de tarea.
- **Fuentes.** https://basket.bcoach.app/ ; https://basket.bcoach.app/precios/ ; https://basket.bcoach.app/tutoriales-de-bcoach/

---

### planet.training — Biblioteca de ejercicios, herramienta de dibujo/animación y gestión de equipos — https://planet.training/es/baloncesto — multideporte (baloncesto, fútbol, voleibol, balonmano, hockey) — web/app SaaS (Next.js + Storyblok; empresa de Singapur, localizada a español)

- **Qué es y para quién.** Plataforma de gestión de equipos: calendario, **ejercicios**, **tácticas** (editor de dibujo y animación), base de conocimientos, entrenamientos, partidos, estadísticas, gestión de clubes y federaciones. Precios en la propia web: **Essential 9,99 EUR/mes** (ejercicios, tácticas, entrenamientos, jornadas, gestión de club), **Performance 19,99 EUR/mes** (seguimiento, salud/lesiones, scouting, informes), **Organización** a medida (multiclub, marca blanca), complemento de vídeo por almacenamiento; precio por número de equipos y descuento del 20% anual. **[EVIDENCIA]**
- **Cómo se crea un ejercicio.** "Editor de ejercicios y tácticas": desde tablet o ordenador, dibujar ejercicios y crear **animaciones de juego**; "Biblioteca de ejercicios & Playbook" para crear, organizar y compartir con el staff; un entrenamiento se compone con ejercicios de la biblioteca, asistencia y notas. Pasos exactos **[NO VERIFICADO]** (login).
- **Cómo se representa / animación.** Dibujo y animación por deporte; ejemplos de la biblioteca visibles en la landing ("Cone Dribbling", "3-Player Shooting Drill", "5v5 – Full Court Game", "3v3 – Half Court", todos "Coach planet.training"). Detalles **[NO VERIFICADO]**.
- **Modelo de datos.** **[NO VERIFICADO]**.
- **Biblioteca y organización.** Ejercicios propios y premium, organización por equipo, **planificación de entrenamientos con ejercicios de la biblioteca**, asistencia, notas, evolución; planificación de partidos con sede, roster, quinteto inicial, rotaciones y jugadas preparadas; roles y permisos por club.
- **Puntos fuertes / débiles.** Fuertes: un único producto para ejercicio → sesión → partido → seguimiento; escalado a clubes y federaciones; plan de organización con marca blanca. Débiles: de pago, mensualidad por equipo; sin datos abiertos; traducción automática en la web.
- **Ideas aplicables.**
  - [Alta][Medio] **Composición de sesión** = lista ordenada de ejercicios de la biblioteca + duración total + asistencia + notas del entrenador (pantalla "Sesión" que ya está en la hoja de ruta de la biblioteca).
  - [Media][Medio] Roles y permisos por equipo (entrenador principal, ayudante, jugador solo lectura) para compartir ejercicios dentro del club.
- **Fuentes.** https://planet.training/es/baloncesto ; https://planet.training/es/herramienta-dibujo ; https://planet.training/es/precios

---

### Pizarra Táctica Baloncesto (BLUELINDEN) — https://apps.apple.com/es/app/pizarra-t%C3%A1ctica-baloncesto/id861249866 — baloncesto (otros deportes de la misma saga) — app iOS/iPad (también Android)

- **Qué es y para quién.** App para entrenadores, gratis con compras integradas (Coach PRO). 96 valoraciones, 4,6. 25 idiomas. 82 MB. Entrena y colabora con el cuerpo técnico mediante **Coach Messenger** (chats de grupo con tácticas y ejercicios, comentarios, invitación por enlace). **[EVIDENCIA]** (ficha de App Store).
- **Cómo se crea un ejercicio.** Editor con **herramientas de dibujo, distintos estilos de línea, flechas y formas**; material de entrenamiento (conos, balones, **escaleras de coordinación**...); diseños de campo y estilos de pizarra (campo completo, medio campo, campo de entrenamiento, **pizarra en blanco**); alineaciones con nombres, números, posiciones y fotos; **sustituciones por arrastrar y soltar**; colores de equipación personalizables. **[EVIDENCIA]**
- **Cómo se representa.** Exportación como **imagen, PDF y vídeo** (los animados), guardado en Fotos/Dropbox.
- **Animación/reproducción.** "Crea jugadas animadas" y "exporta ejercicios animados como vídeo". Mecánica interna **[NO VERIFICADO]**.
- **Modelo de datos.** **[NO VERIFICADO]**. Reseña real (24 feb): el usuario no encontraba cómo exportar pizarras a otro dispositivo; la app lo "incorporó" después → hay un formato de archivo propio exportable.
- **Biblioteca y organización.** "Guarda un número ilimitado", **carpetas**, **agrupar tácticas por rival, partido o sesión de entrenamiento**.
- **Puntos fuertes / débiles.** Fuertes: carpetas/agrupaciones por rival/partido/sesión; vídeo exportado; Coach Messenger. Débiles: críticas por "premium" demasiado restrictivo y por la falta inicial de exportar/sincronizar entre dispositivos.
- **Ideas aplicables.**
  - [Alta][Fácil] **Carpetas o etiquetas de agrupación** ("rival", "partido", "sesión") sobre los ejercicios de la biblioteca.
  - [Media][Medio] **Comentarios sobre un ejercicio** entre entrenadores del club (hilo en la ficha).
  - [Media][Fácil] Exportar/importar archivo del ejercicio para pasarlo entre dispositivos (lección de las reseñas).
- **Fuentes.** https://apps.apple.com/es/app/pizarra-t%C3%A1ctica-baloncesto/id861249866 (WebFetch devolvió 429; se obtuvo por descarga directa de la ficha pública).

---

## Patrones y decisiones de diseño detectados

1. **Cuatro formas de representar un ejercicio** (de menos a más estructurada): GIF/imagen subida (semilla, ejerciciosdebaloncesto.com) → SVG generado por datos estáticos con porcentajes (Controla.Club) → pasos con acciones y trayectorias (Drills&Plays, TeamBranch) → modelo completo con estado derivado (posesión, roles) (Drills&Plays). Nuestro modelo de fases + carriles está en el nivel más alto, junto con Drills&Plays.
2. **Paso = unidad atómica** de animación y de descripción: nombre, descripción (multi-idioma), duración y acciones simultáneas con retardo por acción. Se encadenan; no hay interpolación libre entre ejercicios.
3. **Estado derivado + reglas**: posesión, roles, bloqueos activos se calculan aplicando las acciones paso a paso; el editor valida con mensajes concretos y deshabilita acciones imposibles.
4. **Vocabulario común de acciones** (movimiento/corte, bote, pase, tiro, bloqueo, mano a mano) y **convención visual común** (bote continuo/ondulado, pase discontinuo, corte continuo con flecha, bloqueo trazo en T, tiro flecha roja al aro).
5. **Presets de arranque** (formaciones y saques) y **modos** (jugada vs. ejercicio; el entrenador solo en ejercicio).
6. **Trayectorias como splines** de pocos puntos de control en lugar de polilíneas.
7. **Imagen por paso** y **GIF/PNG/PDF** como salidas "de bajo coste" para compartir; el enlace de solo lectura como alternativa a exportar.
8. **Taxonomía en dos ejes**: categoría (qué es: técnica, táctica, físico...) y objetivos/tags (para qué sirve) más metadatos numéricos (edad, jugadores, duración, dificultad/intensidad). La semilla es la más rica en tags; ejerciciosdebaloncesto.com la mejor en tabla puente con categoría primaria.
9. **Ficha estable**: título, descripción en pasos numerados, material, jugadores (rango), duración, edad, dificultad, intensidad, espacio, variantes/progresión, aspectos a incidir y a evitar.
10. **Comunidad con moderación** (pendiente → aprobado), votos, favoritos, comentarios, reportes, agrupaciones y orden por popularidad/fecha.
11. **Atajos de una tecla** por herramienta y deshacer/rehacer con historial.

## Lo que NO deberíamos copiar

- **GIF de 200×190 px sin controles** como único formato (semilla): es opaco, no editable y no permite pausar, ir a un paso ni cambiar velocidad. Útil solo como exportación secundaria.
- **Editor de escritorio / archivo propio sin API** (Sport Designer): limita a un solo sistema operativo y datos no consultables.
- **Ejercicios como imagen subida** (ejerciciosdebaloncesto.com): pierde la ventaja de nuestro modelo estructurado.
- **Visor 3D con Three.js** (Drills&Plays): 640 KB y complejidad altísima para poco valor en entrenamiento de base.
- **Muros de publicidad, consentimientos agresivos y "premium" que bloquea lo básico** (Drills&Plays, Bluelinden, ejerciciosdebaloncesto.com).
- **Campo opaco "Dimensiones del campo: 3m"** o rangos de edad `0-99` sin significado (semilla): usar texto libre con autocompletado y rangos reales (Sub-8, Sub-10...).
- **Codificación rota de caracteres** (`ï¿½`) y falta de sitemap/datos estructurados (semilla).
- **Dependencias externas para reproducir** (login para ver la animación, CDN pesados): nuestra PWA debe reproducir sin conexión desde datos locales.

---

Nota de método: durante las capturas se ejecutó un cierre global de procesos `chrome.exe` en Windows (comando `taskkill`) para liberar un Chrome headless colgado; si el usuario tenía el navegador abierto, pudo cerrarse. No se tocó ningún archivo del proyecto salvo este informe y las capturas.
