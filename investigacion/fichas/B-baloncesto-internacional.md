# Grupo B — Herramientas de baloncesto internacionales (pizarras, diseñadores de jugadas, planificadores)

Fecha de la investigación: 2026-10-04. Método: solo lectura (curl de HTML/JS públicos, clonado superficial de repos públicos de GitHub en la carpeta temporal, WebFetch/WebSearch). No se creó ninguna cuenta ni se llamó a APIs privadas. No se obtuvieron capturas de pantalla: Chrome headless se colgó con los sitios con publicidad (Hoop Coach, Tactical Board), así que se omitieron.

Convención: **EVIDENCIA** = visto en código/JSON/HTML real descargado. **DEDUCCIÓN** = inferido. **MARKETING** = declarado por la web, no verificado por dentro.

## Resumen de hallazgos transversales

1. **Dos familias de modelo de datos.** (a) *Fotogramas como instantáneas completas*: cada fotograma guarda la posición de todos los objetos (Hoop Coach, Tactical Board, matthiashuschle, BC-Tactics, sosonamo). La animación interpola entre dos instantáneas consecutivas. (b) *Acciones como entidades con orden*: cada jugador tiene una cadena de trazos y un contador global `seq` ordena todo (Brisbane Blackboard), o cada movimiento lleva marcas de tiempo (HoopStrategist). Nuestro modelo (fases encadenadas con carriles y reproducción) está más cerca de (b) con ramas, que ninguna de las herramientas analizadas tiene.
2. **Simbología casi universal en los editores reales**: movimiento = línea continua con punta de flecha; pase = línea de puntos o discontinua; bote = línea doble, en zigzag/ondulada o con "dientes"; pantalla = línea que termina en barra perpendicular (T). Hoop Coach tiene 5 tipos numerados 1-5; Brisbane 4 más 2 derivados; BC-Tactics 10 subtipos. Es el vocabulario que ya usa la skill `basket-diagram` (simbología FCYL).
3. **Hay dos estilos de "dibujo→fotograma"**: manual (botón "añadir fotograma": Tactical Board, matthiashuschle) o automático (FastDraw "avanza solo al siguiente fotograma al dibujar", según marketing). Hoop Coach crea el fotograma pulsando "nuevo movimiento".
4. **Las flechas casi nunca se guardan como dato autónomo** en los editores sencillos: en matthiashuschle se *derivan* de la diferencia entre fotogramas; en Tactical Board el trayecto se guarda como `pos.s → pos.e` más trazos ("shps"). Brisbane sí guarda el trazo a mano alzada (puntos) y lo reproduce a lo largo de la polilínea.
5. **Temporización**: casi todos usan tween lineal por fotograma con duración constante (Hoop Coach: `speed` ms; Tactical Board: `500*(10-velocidad)` ms; sosonamo: 1400 ms / velocidad). Brisbane reparte el reloj 0→1 proporcional a la longitud del trazo (mínimo y máximo de duración total). Solo matthiashuschle ofrece easing (easeInOutCubic opcional) y rotación por ángulo más corto.
6. **Velocidad**: control de 1-9 (Tactical Board), 1-100 (matthiashuschle), 0,5x-2x (Brisbane, sosonamo, Playmaker según su descripción), repetir/bucle en casi todas.
7. **Exportación**: PNG/JPG (todas), PDF (CoachCanvas, Diagram the Game, Hoops Geek, FIBA vía playbook), vídeo MP4 (Tactical Board en servidor; CoachCanvas y sosonamo en el navegador con WebCodecs/MediaRecorder), enlace compartible (casi todas), JSON (open source).
8. **Exportación de vídeo en cliente es viable**: sosonamo usa `canvas.captureStream(30)` + `MediaRecorder` (MP4/H.264, 1280x720, 8 Mbps); CoachCanvas carga `mediabunny` (WebCodecs). Ideal para un PWA sin servidor de vídeo.
9. **Modelo de negocio dominante**: gratis limitado por número de jugadas (Hoop Coach 5, Hoops Geek 5, Diagram the Game 2 jugadas/2 ejercicios, Hoops Lab 10, CoachCanvas 30) y de pago anual para ilimitado (~65-100 USD/año). El compartir por enlace de solo lectura sin cuenta es la palanca de adopción.
10. **Biblioteca**: carpetas propias + etiquetas + categoría (Hoop Coach, FIBA Europe), banco comunitario (PlayBank de FastDraw ~10.000 jugadas, MARKETING), plantillas precargadas (Hoops Geek, HoopStrategist) y categorías tácticas fijas (BC-Tactics: Ataque, Transición, ATO, SLOB, BLOB, Defensa, Quick Hitters, Especiales).
11. **FIBA Europe** separa tres productos con entidades distintas: *jugadas* (privadas hasta que se publican), *ejercicios* (visibles a todos los usuarios registrados) y *plan de entrenamiento* (compone ejercicios y se imprime). Modelo conceptual directamente aplicable a nuestra biblioteca y sesiones.
12. **Novedad con valor**: HoopStrategist integra un asistente de IA que devuelve JSON (`playerMoves`, `ballPasses`, `steps`) que se "aplica" al tablero como demostración. Viable como idea futura, no prioritaria.
13. **Patrón de testabilidad**: los repos serios (matthiashuschle, sosonamo, Brisbane) mantienen la lógica pura (geometría, tiempo, almacenamiento) en módulos aparte con tests, igual que nuestras baterías `eval-*.mjs`.

---

### Hoop Coach (Playbook) — https://www.hoopcoach.org/playbook/play.php — baloncesto — web
- **Qué es y para quién**: diseñador de jugadas gratuito para entrenadores de base y de instituto, de la web hoopcoach.org (biblioteca de jugadas y ejercicios). Plan gratuito limitado a 5 jugadas; el plan Pro desbloquea más jugadas, exportar vídeo sin marca de agua y grabación de audio (MARKETING + texto en el HTML).
- **Cómo se crea un ejercicio** (EVIDENCIA, HTML + JS descargados):
  1. Elegir pista (`#court`: media pista o pista completa) y "formación" inicial (`#formation_add`); botón "añadir defensas automáticamente" (`#autoadd_def`).
  2. Arrastrar piezas desde el panel: ataque `p1..p15`, defensa `x1..x15` (categoría "Forward"), balones `b0..b2`, conos `c1..c15`.
  3. Dibujar líneas con herramientas de flecha: tipo 1 movimiento (línea continua con punta), 2 pase (discontinua `dashArray [10,5]`), 3 bote (imagen `dribble.png` repetida a lo largo de la línea cada 13 px), 4 pantalla (barra perpendicular al final), 5 curva libre (spline con tensión 0,5 y punta).
  4. "Nuevo movimiento" (`#newmove-modal`, con nombre y comentarios) crea un fotograma nuevo; un selector `#moves` lista los fotogramas y cada uno tiene su comentario (`#comment`).
  5. Etiquetas (`#tags`), categoría al guardar (`#cat`) y nombre.
- **Cómo se representa**: lienzo con **Kinetic.js 4.5.5** (antecesor de Konva) sobre jQuery/Bootstrap; existe también "skin" de fondo (`changeSkin`, `skin` guardado como hash). Exporta a PDF (`pdf(no)` genera una página por movimiento con nombre y comentario), enlace compartible (`#share-modal`) y descarga de vídeo/imagen (Pro, MARKETING).
- **Animación/reproducción** (EVIDENCIA): `playNow()` anima de un fotograma al siguiente emparejando objetos por `id`; cada pieza recibe un `Kinetic.Tween` lineal de duración `speed` ms (valor del control `#speed`), uno tras otro hasta el último fotograma (`nextFrame` recursivo con bandera `pause`). Durante la reproducción se oculta la capa de edición y se pinta una capa `playLayer` con las flechas del movimiento en curso. No hay easing ni interpolación de trayecto: la pieza va en línea recta de posición inicial a final (las curvas dibujadas son solo notación). Hay incluso grabación de **narración de audio** por jugada (WAV subido a S3 vía `audio_recording.php`).
- **Modelo de datos** (EVIDENCIA, `save.php`/`load.php`): se guarda `data = {halfcourt, name, skin, frames: moves[], speed}` más `names` y `comment` concatenados con el carácter "`" y `tags`. Cada elemento de `moves[]` es `{name, comment, frame: [ {category, x, y, id, type?, points?} ]}`. `category` ∈ {Arrow, Player, Ball, Forward, Cone}; las flechas llevan `type` 1-5 y `points` (2 puntos, o N en la spline) y `x,y` de desplazamiento. Una instantánea completa por fotograma; las flechas se copian aparte (`category != 'Arrow'` al duplicar el fotograma). Código con parches heredados (p. ej. al cambiar de pista completa a media se recoloca restando 255 a `y` y se eliminan piezas fuera). Backend PHP + Supabase (cliente supabase-js cargado; sesión sincronizada) y S3.
- **Biblioteca y organización**: "Mis jugadas" (`#myplays-modal`), categoría + etiquetas al guardar, enlace público para compartir, copiar jugada (`#copy-play-modal`), votos ("uped/downed" en la carga), buscador y biblioteca pública en hoopcoach.org (MARKETING). PWA con banner de instalación (EVIDENCIA).
- **Puntos fuertes / débiles**: fuerte: modelo simplísimo y probado, 5 tipos de línea claros, narración de audio, comentario por fotograma. Débil: tecnología antigua (jQuery, Kinetic 2013), animación solo lineal punto a punto, líneas de solo 2 puntos salvo el tipo 5, ids de pieza globales (`p1`...) reutilizados entre fotogramas, publicidad en el editor.
- **Ideas aplicables**:
  - [Alta][Fácil] Comentario/nota de texto por fase visible al reproducir y en el PDF (ya tenemos Fase/Texto; asegurar que el PDF lo incluya por fase).
  - [Media][Medio] Etiquetas libres + categoría al guardar, además de los metadatos fijos.
  - [Baja][Medio] Narración de audio por ejercicio (útil para vídeo-explicación a jugadores).
  - [Media][Fácil] Botón "añadir defensas automáticamente" que coloca un defensor por atacante.
- **Fuentes**: https://www.hoopcoach.org/playbook/play.php ; js/acetrik1b_test.js, js/main_test.js, js/recorder.js (mismos dominio).

---

### Tactical Board Online (tactical-board.com) — https://tactical-board.com/uk/basketball-new — baloncesto y otros 15 deportes — web
- **Qué es y para quién**: pizarra táctica web multideporte con editor SVG, creador de animaciones y "conferencia" en tiempo real. Gratis con publicidad; cuenta de pago (FastSpring) para quitar límites y exportar vídeo (EVIDENCIA: script FastSpring; MARKETING para los límites).
- **Cómo se crea un ejercicio** (EVIDENCIA, HTML):
  1. Elegir pista (baloncesto 28×15 m, línea de tiros libres rectangular o "old marking"), colocar jugadores (símbolos con 24 rotaciones de 15° para porterías/canastas, `sym_goal_a_0…345`), balón y manos (`sym_ball`, `sym_hands`).
  2. Herramienta de formas (`data-value`): texto, polígono, área, rectángulo, elipse, línea doble, línea ondulada, polilínea, línea. Cada línea tiene **remate inicial y final** independientes (ninguno / flecha / pantalla) y **trazo** continuo o discontinuo, color y tamaño de fuente; botones "borrar última línea" y "borrar todas".
  3. "Crear animación" abre la página de animación: se mueven las piezas y se pulsa añadir fotograma. Solo se permite añadir fotograma si algo se movió en el anterior (mensaje "no moves on last frame"); las formas del fotograma anterior se **clonan** al nuevo.
- **Cómo se representa**: un único `<svg id="svg_canvas">` con patrones (`grid_2…grid_8`) y la pista generada por una función JS con **proporciones fraccionarias del ancho** (p. ej. 0,0697·W de margen, 0,07175·W de franja de parquet), en vez de imagen. Opción de ocultar marcas, recortar área (`board-cropper`), capturar imagen, descargar animación (HTML y vídeo) y "añadir a la colección".
- **Animación/reproducción** (EVIDENCIA, `tb_1.js`): controles Play, "reproducir solo el fotograma actual", Pausa, Stop, Repetir (por defecto activado) y velocímetro 1-9 (por defecto 5). Duración de fotograma `500·(10−v)` ms si v>3; 4000/5000/7000 ms para 3/2/1. Salto de puntos del trayecto (`_lineWayPointIndexStep`) 2/4/6 según velocidad. Cada pieza se mueve por su trayecto de puntos ("line way", radio de nodo 0,42, ancho de línea 0,1) de `pos.s` a `pos.e`. Exporta el vídeo en servidor: se generan PNG por fotograma y `convertToMovie({speed, rawFileType:'png', fileWidth 400-1920, startFrame, endFrame, hideBoardMarkup})`.
- **Modelo de datos** (EVIDENCIA, getter `storeInfo`): `{frames:[{elements:{<id>:{pos:{s:{x,y}, e:{x,y}}, ang}}, shps:[…]}], frames_elements:{<id>:{…}}, speed, repeat}`. Cada elemento guarda posición **inicial (`s`) y final (`e`)** y ángulo; al añadir fotograma, `s` del nuevo = `e` del anterior. `shps` son las formas. Persistencia: `localStorage` (clave `<página>_<tablero>`) y envío al servidor troceado en bloques de 100 KB con UUID (`<uuid>_<tablero><idioma>`) que forma la URL pública (`/animation/dd5044da5b8305_bbuk`). Endpoints vistos en el JS (no se llamaron): `storeLinkData`, `getStoredInfo`, `addToCollection`, `userCollection`, `logMovie`.
- **Biblioteca y organización**: "colección" por usuario (añadir/editar/quitar), enlaces con hash para compartir, modo conferencia (varios usuarios editando a la vez, `conference_users_list`).
- **Puntos fuertes / débiles**: fuerte: SVG puro, motor de pista paramétrico, `s→e` explícito (facilita reproducir/retroceder), exportación a vídeo con rango de fotogramas, formas ricas. Débil: la animación exige mover piezas manualmente por fotograma; UI recargada y con anuncios; vídeo en servidor (dependencia).
- **Ideas aplicables**:
  - [Media][Medio] Guardar en cada paso posición inicial y final de cada pieza (facilita saltos de línea de tiempo y reproducción desde un punto).
  - [Media][Fácil] Rango de fotogramas de inicio y fin al exportar o reproducir ("reproducir solo esta fase" ya lo tenemos; añadir "desde-hasta").
  - [Baja][Medio] Pista generada por proporciones (útil para pista completa/media/mini sin imágenes).
  - [Media][Fácil] Clonar formas del paso anterior al crear el siguiente.
- **Fuentes**: https://tactical-board.com/uk/basketball-new ; https://tactical-board.com/animation/dd5044da5b8305_bbuk ; /static/js/1.js y /static/js/board-markup-bf.js (EVIDENCIA).

---

### FastDraw (FastModel Sports, hoy parte de Hudl) — https://www.hudl.com/products/fastmodel — baloncesto (también hockey, fútbol, voleibol…) — software de escritorio/app
- **Qué es y para quién**: referente histórico en diagramas de jugadas, usado por equipos NBA y universitarios (MARKETING de un competidor: "los 30 equipos NBA y ~85% de programas universitarios"). Software instalado en escritorio con apps iOS/Android, suite con FastScout y FastRecruit. Sin precio público ni prueba gratuita (según el competidor CoachCanvas; no verificado).
- **Cómo se crea un ejercicio** (MARKETING): se dibuja un corte o pase y el programa **avanza solo al siguiente fotograma**, suaviza la línea y añade la acción final adecuada (pantalla, flecha...). Defensores añadibles arrastrando o con "FastDefense". Color por jugador o acción. Pistas por nivel de competición, media o completa.
- **Cómo se representa**: diagramas numerados con línea de tiempo de fotogramas visible en la interfaz (MARKETING: "numbered player movements and a frame-by-frame animation timeline"). Exporta a vídeo/imagen/PDF y se importa en CoachCanvas (formato propio no público).
- **Animación/reproducción**: animación por fotogramas, vídeo adjunto a jugadas en apps de jugador; seguimiento de visualizaciones por jugador (MARKETING).
- **Modelo de datos**: no verificado por dentro (archivo propietario, instalador no descargable). DEDUCCIÓN: fotogramas con acciones por jugador numeradas.
- **Biblioteca y organización**: **PlayBank** (~10.000 jugadas y ejercicios gratuitos, MARKETING), carpetas y etiquetas, playbooks digitalizados con informes de scouting, compartir a jugadores por correo/app, Hudl guarda una plantilla de cada tarjeta para no redibujar formaciones.
- **Puntos fuertes / débiles**: fuerte: flujo "dibujo→fotograma automático", madurez, ecosistema. Débil: de pago y sin precio visible, instalación, compartir exige asientos de pago (según competidor).
- **Ideas aplicables**:
  - [Alta][Medio] Al terminar un trazo, ofrecer "continuar en nueva fase" (autocrear la fase siguiente con las posiciones finales). Encaja con nuestras fases encadenadas.
  - [Media][Fácil] Plantillas de formación reutilizables ("5 fuera", "4 fuera 1 dentro", "horns") para empezar un ejercicio.
  - [Media][Medio] Importador (FastDraw → nuestra app) solo si el club tuviera archivos; no hay formato público.
- **Fuentes**: https://www.hudl.com/products/fastmodel ; https://www.hudl.com/blog/how-fastdraw-elevates-your-playbook ; https://coachcanvas.app/coachcanvas-vs-fastdraw (competidor, tomar con cautela).

---

### CoachCanvas — https://coachcanvas.app/ — baloncesto — web/PWA
- **Qué es y para quién**: diseñador de jugadas rápido para entrenadores, sin registro para empezar. Gratis hasta 30 jugadas y playbooks ilimitados; Pro 78 USD/año (6,50/mes) quita el límite, añade marca de equipo y app instalable con notificaciones (MARKETING).
- **Cómo se crea un ejercicio**: editor "como PowerPoint" con acciones de pantalla, corte y bote (MARKETING). No verificado por dentro: el editor está tras `use.coachcanvas.app` (inicio de sesión).
- **Cómo se representa** (EVIDENCIA, HTML de `use.` y `share.`): la aplicación del editor y de los playbooks compartidos es **Flutter web** (cargador `flutter` con WASM/CanvasKit), con pica (redimensionado de imágenes), pdf.js y **mediabunny** (codificación de vídeo en el navegador con WebCodecs). Exporta PDF y vídeo (el gratuito lleva logo). La landing es Nuxt.
- **Animación/reproducción**: jugadas animadas con "pulsar para reproducir" y exportación a vídeo (MARKETING). Sin detalle de fotogramas.
- **Modelo de datos**: la app comparte vía `api.coachcanvas.app` con un `publicationId` corto (p. ej. `hDBvQ8`) en `__APP_CONFIG__` (EVIDENCIA). Estructura de la jugada no accesible (canvas Flutter, API no consultada).
- **Biblioteca y organización**: playbooks con secciones y orden arrastrando; biblioteca de jugadas; importación de bibliotecas FastDraw (plan gratuito); enlaces privados sin login; app de equipo con marca (Pro). No tiene planificador de entrenos ni biblioteca precargada (según su propia comparativa).
- **Puntos fuertes / débiles**: fuerte: onboarding sin registro, enlaces compartibles de solo lectura, vídeo en cliente. Débil: Flutter web pesado y sin DOM (accesibilidad y SEO nulos), sin apps nativas aún.
- **Ideas aplicables**:
  - [Alta][Fácil] Enlace de solo lectura con identificador corto para jugadores, sin login (hoy lo tenemos de forma limitada con Supabase; evaluar enlaces públicos por ejercicio/sesión).
  - [Media][Medio] Exportar a vídeo en cliente (MediaRecorder; ver sosonamo).
  - [Baja][Fácil] Playbook como colección ordenada con secciones.
- **Fuentes**: https://coachcanvas.app/ ; https://share.coachcanvas.app/hDBvQ8 ; https://use.coachcanvas.app/ ; https://coachcanvas.app/coachcanvas-vs-hoops-geek

---

### Coach Board — https://www.coachboard.app/sports/basketball — 16 deportes (incl. baloncesto) — web
- **Qué es y para quién**: pizarra táctica y planificador de sesiones en el navegador para 16 deportes con pista a escala. 14 días de prueba, luego 9 USD/mes o 90 USD/año (EVIDENCIA, texto del HTML).
- **Cómo se crea un ejercicio** (MARKETING): colocar los cinco, dibujar cortes/pantallas/pases/rotaciones, pulsar play. Arrastrar jugadores, conos, porterías y formas desde un selector; ajustar número, nombre, color y tamaño de cada jugador; repartir una sesión en tantas "pizarras" como se quiera.
- **Cómo se representa**: web Next.js (EVIDENCIA: chunks `/_next/static`), editor en `my.coachboard.app` (con cuenta, no verificado). Exporta imagen y vídeo; enlaces cortos tipo `my.coachboard.app/s/g7k2x9`.
- **Animación/reproducción**: la jugada se anima como posesión continua; "repetir, ralentizar, compartir" (MARKETING).
- **Modelo de datos**: no verificado.
- **Biblioteca y organización**: pizarras ilimitadas organizadas por tipo de jugada, rival o categoría de edad y buscables; equipos, plantillas y formaciones; plan para clubes con asientos para el cuerpo técnico.
- **Puntos fuertes / débiles**: fuerte: jugador personalizable (número, nombre, color, tamaño), pizarras por sesión. Débil: genérico (16 deportes), de pago.
- **Ideas aplicables**:
  - [Media][Fácil] Etiquetar ejercicios por "rival" o "categoría" (ya tenemos categoría; valorar etiqueta libre).
  - [Baja][Medio] Varias pizarras dentro de una sesión (nuestras sesiones ya agrupan ejercicios).
- **Fuentes**: https://www.coachboard.app/sports/basketball ; https://www.coachboard.app/

---

### Diagram the Game — https://diagramthegame.com/basketball-play-maker — baloncesto y otros — web
- **Qué es y para quién**: creador de jugadas y ejercicios con colaboración de equipo y acceso de lectura para jugadores. Gratis: 2 jugadas, 2 ejercicios, 1 playbook; planes de pago con asientos de entrenador (MARKETING).
- **Cómo se crea un ejercicio** (MARKETING): colocar jugadores y dibujar cortes, pantallas, pases, entregas ("handoffs") y rotaciones defensivas. Las flechas se **curvan arrastrando** (asas de spline) y se pueden **alternar entre estados**: corte, bote, pantalla, y pase o pase alto ("lob") como variantes de transferencia de balón.
- **Cómo se representa**: tres pistas con medidas oficiales (NBA/profesional, FIBA, instituto/universidad). Exporta PDF de jugadas o playbooks completos. Stack: Rails con Sentry (EVIDENCIA, assets).
- **Animación/reproducción**: **hasta 10 fotogramas por jugada**; reproducir fotograma a fotograma (MARKETING).
- **Modelo de datos**: no verificado (editor tras login).
- **Biblioteca y organización**: jugadas, ejercicios y playbooks separados; jugadores con acceso de solo lectura; varios entrenadores en equipo.
- **Puntos fuertes / débiles**: fuerte: ciclo de estado de la flecha (un toque cambia de corte a bote a pantalla) y spline con asas; elección de pista FIBA. Débil: límite de 10 fotogramas, gratis muy recortado.
- **Ideas aplicables**:
  - [Alta][Fácil] Cambiar el tipo de una acción ya dibujada por ciclo de toque o menú (sin borrar y redibujar).
  - [Media][Medio] Asas de spline para curvar trazos.
  - [Media][Fácil] Distinguir pase normal y pase alto.
- **Fuentes**: https://diagramthegame.com/basketball-play-maker

---

### The Hoops Geek — https://app.thehoopsgeek.com/ — baloncesto — web + apps iOS/Android (Expo)
- **Qué es y para quién**: suite para entrenadores: diseñador de jugadas animadas, planificador de entrenamientos, creador de rotaciones, gestor de sustituciones en directo y biblioteca de jugadas y ejercicios. Gratis hasta 5 jugadas; solo 99 USD/año, equipo ~198 USD/año por 4 entrenadores; vídeo con suscripción (MARKETING, según competidor y fichas de tienda).
- **Cómo se crea un ejercicio**: arrastrar y soltar jugadores y definir movimientos con clic y arrastre; se definen acciones (pase, pantalla, tiro) en momentos concretos, con acciones opcionales y sincronizadas (MARKETING).
- **Cómo se representa**: anima automáticamente cada acción dibujada; exporta MP4 y enlaces; PDF de entrenamiento con "incluir/excluir jugadas", escalado y maquetación (MARKETING).
- **Animación/reproducción**: temporización por acción y sincronización ("optional actions, timing-based movements, synchronized actions"); sin detalle técnico.
- **Modelo de datos**: no verificado (SPA tras login). DEDUCCIÓN: modelo de acciones con tiempo, parecido a Brisbane/Sportplan.
- **Biblioteca y organización**: planificador de **línea de tiempo con arrastrar-y-soltar** (reordenar bloques o cambiar su duración), jugadas/ejercicios de la biblioteca adjuntables a cualquier bloque, vídeos, imágenes, notas de voz y YouTube, plantillas de sesión ("el esquema ya está, tú pones nombres, tiempos y detalles"), enlace seguro para compartir sin cuenta del receptor.
- **Puntos fuertes / débiles**: fuerte: planificador integrado con la biblioteca, PDF configurable, adjuntos multimedia. Débil: interfaz genérica, inicio de sesión individual.
- **Ideas aplicables**:
  - [Alta][Medio] Línea de tiempo de sesión con bloques arrastrables y duración editable que adjuntan ejercicios de la biblioteca.
  - [Media][Medio] PDF de sesión con opción de incluir/excluir diagramas y escalar.
  - [Media][Fácil] Plantillas de sesión (calentamiento, técnica, 5x5, vuelta a la calma).
  - [Baja][Medio] Adjuntar vídeo/imagen/nota de voz a un ejercicio.
- **Fuentes**: https://app.thehoopsgeek.com/features/practice-planner ; https://coachcanvas.app/coachcanvas-vs-hoops-geek (competidor)

---

### FIBA Europe Coaching (web y app «Basketball Coaching») — https://coaching.fibaeurope.com / app en iOS y Android — baloncesto — web + app
- **Qué es y para quién**: servicio gratuito de FIBA Europe para entrenadores: dibujar jugadas y ejercicios, compartir con la comunidad, biblioteca propia con carpetas, plan de entrenamiento y pizarra rápida; funciona con o sin conexión.
- **Cómo se crea un ejercicio**: herramienta de dibujo "diseñada para aprovechar las capacidades de tablet/móvil" (MARKETING); detalles de líneas no verificados (requiere registro).
- **Cómo se representa**: gráficos exportables a **JPG** con el botón de exportar de cada gráfico; las jugadas se imprimen desde un playbook y los ejercicios desde el plan de entrenamiento (EVIDENCIA: FAQ oficial en PDF).
- **Animación/reproducción**: no hay evidencia de animación en la web; sí de gráficos estáticos (DEDUCCIÓN a partir del FAQ, que solo habla de JPG).
- **Modelo de datos**: no verificado. El FAQ confirma tres entidades separadas: **jugadas** (sección "Mis jugadas", privadas hasta publicarlas), **ejercicios** (visibles para todos los usuarios registrados), **plan de entrenamiento** (compone ejercicios, imprimible total o parcialmente) y **playbooks** (colección de jugadas imprimible). (EVIDENCIA)
- **Biblioteca y organización**: **estructura de carpetas y subcarpetas** propia (crear carpeta con un campo de texto al pie de la página), publicación voluntaria de jugadas para la comunidad, foro, calendario de clínics y torneos, artículos.
- **Puntos fuertes / débiles**: fuerte: modelo conceptual claro (jugada vs ejercicio vs plan vs playbook), carpetas con subcarpetas, publicar/privado, oficial y gratuito. Débil: gráficos estáticos, funcionalidad con apariencia anticuada.
- **Ideas aplicables**:
  - [Alta][Medio] Carpetas y subcarpetas en la biblioteca del club (además de filtros).
  - [Alta][Fácil] Estado de visibilidad por ejercicio: privado / compartido con el club / público.
  - [Media][Medio] "Playbook" imprimible como colección ordenada de ejercicios.
- **Fuentes**: https://about.fiba.basketball/en/news/fiba-launches-coaching-app ; https://coaching.fibaeurope.com (FAQ oficial en PDF) ; https://play.google.com/store/apps/details?id=com.fibaeurope.coaching.app

---

### Sportplan Coaching Animator — https://www.sportplan.net/drills/Basketball/Basketball-Coaching-Animator.jsp — baloncesto (y otros) — web
- **Qué es y para quién**: biblioteca de 650+ ejercicios con vídeo y animaciones, planificador de sesiones y un "Coaching Animator" para crear animaciones propias, orientado a entrenadores sin conocimientos de animación.
- **Cómo se crea un ejercicio** (MARKETING): posicionar jugadores "con dos clics", elegir velocidad de movimiento y de pase, pases con código de colores según tipo; tutorial de cinco semanas (navegación, movimiento, posesión, fases de pase avanzadas, compartir).
- **Cómo se representa**: animación incrustable con tamaño de ventana configurable, guardado con puntos de coaching.
- **Animación/reproducción**: tecnología "basada en acciones: cada acción de un jugador depende de la anterior"; no hay línea de tiempo, se describe la jugada como se cuenta de palabra. Controles de reproducir/pausar.
- **Modelo de datos**: no verificado. DEDUCCIÓN: lista ordenada de acciones encadenadas por jugador (similar a Brisbane Blackboard).
- **Biblioteca y organización**: biblioteca por categorías con vídeo y animación de cada ejercicio, instrucciones de organización y puntos de coaching, planificador de sesiones con insertar ejercicios de la biblioteca o bocetos propios.
- **Puntos fuertes / débiles**: fuerte: modelo "acción tras acción" sin línea de tiempo explícita, color por tipo de pase. Débil: producto veterano y cerrado, tutorial largo (indica curva de aprendizaje).
- **Ideas aplicables**:
  - [Media][Fácil] Etiqueta "puntos de coaching" estructurada por ejercicio (ya tenemos objetivo y texto; valorar campo propio).
  - [Baja][Medio] Color por tipo de pase (pase de pecho, picado, por encima).
- **Fuentes**: https://www.sportplan.net/drills/Basketball/Basketball-Coaching-Animator.jsp ; https://www.sportplan.net/drills/Basketball/index.jsp

---

### matthiashuschle/basketball_play_designer — https://github.com/matthiashuschle/basketball_play_designer — baloncesto — open source (TypeScript, canvas)
- **Qué es y para quién**: diseñador de jugadas de media pista, un solo archivo HTML sin dependencias (script `build.js`), con medidas FIBA y animación a 60 FPS. Pruebas con vitest.
- **Cómo se crea un ejercicio** (EVIDENCIA, README + código): atajos `V` seleccionar, `H` añadir local, `A` añadir visitante, `Espacio` reproducir, `←/→` fotograma, `Supr` borrar, doble clic para cambiar dorsal (1-99). Se coloca el fotograma inicial; luego se arrastra cada jugador al destino (flecha roja) y se hace clic para fijar hacia dónde mira; arrastrar el balón a un compañero (<1,5 m) = pase (flecha azul discontinua `[5,10]` con etiqueta "PASS"), a la zona del aro (≤3 m) = tiro, a espacio libre = balón suelto (punteada naranja `[10,5]`). Botón **"+ Add Frame"** calcula las posiciones y avanza. Una flecha por jugador y fotograma; arrastrar a <15 cm de su posición cancela la flecha.
- **Cómo se representa**: canvas 2D con clases `Court`, `Player`, `Ball`, `MovementArrow` (flecha con cabeza triangular de 15 px y 30° de apertura), coordenadas de mundo en metros (tipos de marca `WorldPoint`/`ScreenPoint` para no mezclar sistemas).
- **Animación/reproducción** (EVIDENCIA, `App.ts`): `requestAnimationFrame` con progreso `elapsed/duración`; `lerp` de posición y **rotación por el ángulo más corto**; `easeInOutCubic` opcional ("smooth playback"); control de velocidad 1-100, bucle, scrubbing con deslizador y flechas; el balón vuela de posición origen a destino entre jugadores.
- **Modelo de datos** (EVIDENCIA, `types.ts`): `PlaysCollection{plays[], currentPlayIndex}`; `PlayData{name, frames[], createdAt}`; `FrameData{players[{id, team, number, position{x,y}, rotation}], ball{state}}`; `BallState = {type:'possessed',playerId} | {type:'none'} | {type:'atPosition',position}`. **Las flechas no se guardan**: se derivan de la diferencia entre el fotograma actual y el siguiente. Import/export JSON de una jugada o de toda la colección; ejemplo `initial-plays.json` (1171 líneas).
- **Biblioteca y organización**: varias jugadas con renombrar/cambiar/borrar en barra lateral; sin etiquetas ni filtros.
- **Puntos fuertes / débiles**: fuerte: estado del balón como unión discriminada (posesión/suelto/en posición), rotación por camino corto, tests. Débil: sin tipos de línea (bote, pantalla), sin defensas con acciones, el modelo derivado impide anotar intención (qué fue pase y qué fue bote tras un movimiento).
- **Ideas aplicables**:
  - [Alta][Fácil] Modelar el balón como `{posesión:jugadorId} | {suelto} | {enPosición}` en cada fase (revisar que nuestro modelo lo representa así).
  - [Media][Fácil] Rotación de ficha por camino angular más corto al reproducir.
  - [Baja][Fácil] Easing suave opcional (ease-in-out) en la reproducción.
- **Fuentes**: https://github.com/matthiashuschle/basketball_play_designer (clonado y leído: README.md, src/types.ts, Play.ts, Movement.ts, App.ts).

---

### Brisbane Blackboard (charliebischoff/BrisbaneBlackboard) — https://github.com/charliebischoff/BrisbaneBlackboard — baloncesto — open source (React, TypeScript, react-konva, PWA)
- **Qué es y para quién**: playbook animado para los Brisbane Bullets (club profesional): formaciones, rutas a mano alzada, animación en pista completa o media, con plantilla (roster) con fotos. PWA con `vite-plugin-pwa`; incluye `CLAUDE.md` con la arquitectura (EVIDENCIA).
- **Cómo se crea un ejercicio** (EVIDENCIA): colocar jugadores del roster en la pista (máx. atacantes en pista por pista), elegir tipo de línea (`motion`, `pass`, `dribble`, `screen`) y dibujar **a mano alzada** (pulsar-arrastrar-soltar). Los trazos se encadenan: cada uno empieza donde acabó el anterior. Modo "arrastrar" donde el estilo se infiere de la posesión: el bote lleva el balón, un pase termina cerca de otro jugador, y arrastrar el balón crea una transferencia (`balltransfer`). `hidden_features.md` lista funciones ocultas por simplificar (elección de tipo de línea, reproducir/pausar/rebobinar, velocidad, guardar), porque la pizarra pasó a ser "una larga cadena de acciones, como una pizarra real" sin inicio ni fin.
- **Cómo se representa** (EVIDENCIA, `RouteLine.tsx`, `types/index.ts`): Konva sobre imagen de pista (el espacio de coordenadas ES el tamaño en píxeles de la imagen, sin escala guardada); movimiento = línea con flecha; pase = puntos `[2,7]` + flecha; bote = **dos líneas paralelas desplazadas ±2,5** + flecha; "carry" (mover con balón) = onda `squigglePoints`; `balltransfer` = guiones `[9,6]`; pantalla = línea con **tapa en T** (`screenCapPoints`). Geometría pura en `lib/routeGeometry.ts` (aplanar, longitud de arco, punto a fracción).
- **Animación/reproducción** (EVIDENCIA, `usePlayEditor.ts`): línea de tiempo con **reloj normalizado 0→1**. Todas las acciones (trazos de jugador y pases) se ordenan por `seq` global y ocupan **ventanas consecutivas**, de longitud proporcional a la longitud del trazo (peso mínimo 40 unidades). Duración total = 1,2 s × número de acciones, acotada entre 3,5 y 12 s; velocidad 0,5x-2x; `requestAnimationFrame`. Entre ventanas el jugador permanece en el final de su última acción. El balón sigue al portador o vuela entre jugadores usando la misma geometría que la flecha. Las acciones **nunca se solapan** (limitación reconocida en el README: sin escalonar salidas, p. ej. "el bloqueo termina antes de que el cortador salga"; la posesión tampoco depende del tiempo).
- **Modelo de datos** (EVIDENCIA, `types/index.ts`): `Play{id, name, createdAt, updatedAt, players[{id, number, team:'offense'|'defense', x, y, name?, photoUrl?}], routes[{playerId, segments[{type, points[], seq}]}], courtType, ballHolderId, ballOffset?, ballTransfers?[{fromId, toId, points[], seq}], isFormationOnly}`. `seq` compartido por trazos y pases. Cada pista tiene su propio tablero (`courtBoard.ts` guarda/restaura al cambiar). Plays y roster en `localStorage` detrás de dos módulos (`storage.ts` cap 100, `rosterStore.ts`) para cambiar a Supabase sin tocar componentes. Verificaciones con scripts esbuild (`tools/`, `npm run check`) por módulo puro.
- **Biblioteca y organización**: `PlaysLibrary` simple (guardar/cargar/borrar, máx. 100), gestor de plantilla con fotos; sin etiquetas ni carpetas.
- **Puntos fuertes / débiles**: fuerte: separación estricta estado/geometría, trazo a mano alzada con tipos de línea claros, modelo de reloj normalizado, tests de módulos puros. Débil: acciones secuenciales, sin defensa interactiva, sin fases ni ramas, guardado y reproducción desactivados.
- **Ideas aplicables**:
  - [Media][Medio] Peso del paso proporcional a la longitud del trazo para que un corte largo dure más que uno corto (útil si algún carril usa duración automática).
  - [Media][Fácil] Línea de bote como doble línea paralela y pantalla con tapa en T (confirmar que nuestro render coincide).
  - [Baja][Medio] Inferir tipo de línea a partir de la posesión del balón (bote si tiene balón, corte si no).
- **Fuentes**: https://github.com/charliebischoff/BrisbaneBlackboard (README.md, CLAUDE.md, hidden_features.md, src/types/index.ts, src/hooks/usePlayEditor.ts, src/components/RouteLine.tsx, src/lib/storage.ts).

---

### dannyderooijbup-dev/BC---Tactics — https://github.com/dannyderooijbup-dev/BC---Tactics — baloncesto — open source (React, TypeScript, SVG, IndexedDB)
- **Qué es y para quién**: pizarra de entrenador con biblioteca de jugadas, fotogramas, categorías y favoritos, generada con Google AI Studio (README de plantilla).
- **Cómo se crea un ejercicio** (EVIDENCIA): objetos `player`, `ball`, `cone`, `hoop`, `text`, `shape`, `line`; roles `attacker/defender/coach/neutral`; líneas de 10 subtipos (`straight`, `curved`, `arrow`, `double-arrow`, `dribble`, `screen`, `hand-off`, `cut`, `fade`, `zigzag`) con estilo sólido/discontinuo/punteado/zigzag y flechas de inicio/fin; formas `circle`, `square`, `zone`, `highlight`. `undo/redo` con historial de hasta 100 instantáneas de fotogramas.
- **Cómo se representa**: SVG con viewBox 800×500 (horizontal) u 500×800 (vertical), pistas `half/full/vertical/horizontal` y normas NBA/FIBA/NCAA; exportación SVG y PNG a 2x en cliente.
- **Animación/reproducción**: sin evidencia (no se encontró `requestAnimationFrame`; DEDUCCIÓN: solo navegación entre fotogramas).
- **Modelo de datos** (EVIDENCIA, `types.ts`): `Play{id, name, description, category, favorite, courtType, courtStandard, frames[], createdAt, updatedAt}`; `PlayFrame{id, objects[PlayObject], description?}`; `PlayObject{id, type, subType, x, y, width, height, rotation, locked, label, role, color, size, strokeWidth, points[], lineStyle, arrowStart, arrowEnd, zIndex}`. Persistencia en **IndexedDB** (`BasketballPlaybookDB`, almacén `plays`, clave `id`) con copia de respaldo en localStorage.
- **Biblioteca y organización**: categorías fijas (Ataque, Transición, ATO, SLOB, BLOB, Defensa, Quick Hitters, Especiales), favorito, descripción por jugada y por fotograma; línea de tiempo en tarjetas con reordenar, duplicar y eliminar.
- **Puntos fuertes / débiles**: fuerte: vocabulario completo de tipos de línea, categorías de balonceso reales (ATO, SLOB, BLOB), objeto genérico con `zIndex`, bloqueo y rotación. Débil: sin reproducción, modelo "todo es un objeto" plano (fotograma = lista de objetos con ids no estables entre fotogramas).
- **Ideas aplicables**:
  - [Alta][Fácil] Categorías tácticas de baloncesto como lista de referencia (ATO = jugada tras tiempo muerto, SLOB/BLOB = saques de banda/fondo, Quick Hitters).
  - [Media][Fácil] Favorito por usuario (ya lo tenemos), descripción por fase.
  - [Baja][Medio] `locked` por objeto para evitar mover fichas fijas (conos).
- **Fuentes**: https://github.com/dannyderooijbup-dev/BC---Tactics (types.ts, utils/db.ts, stores/PlaybookContext.tsx, components/Toolbar.tsx, Timeline.tsx).

---

### sosonamo/BasketballTacticsboard — https://github.com/sosonamo/BasketballTacticsboard — baloncesto — open source (React, TypeScript)
- **Qué es y para quién**: pizarra de baloncesto en coreano: escenas, reproducción y **exportación a MP4 desde el navegador**, con pruebas unitarias.
- **Cómo se crea un ejercicio** (EVIDENCIA, README): banquillo de 12 jugadores por equipo; tocar para meter en pista (máx. 5 por equipo, `MAX_ON_COURT`); pulsación larga de 0,6 s para editar dorsal, nombre y posición; herramientas `mover`, `pasar`, `pantalla` y goma; `Ctrl+Z`; "añadir escena" guarda la colocación; rotación de pista (0/90/180/270).
- **Cómo se representa**: pista FIBA 28×15 m / 14×15 m con rotación; local rojo, visitante azul.
- **Animación/reproducción** (EVIDENCIA): transiciones entre escenas de 1400 ms/velocidad con velocidades 0,5/1/1,5/2x vía `requestAnimationFrame`; **exportación MP4**: `canvas.captureStream(30)` + `MediaRecorder` con códec `avc1`, 1280×720, 8 Mbps, con retención de la primera escena y barra de progreso (`getVideoExportDurationMs`).
- **Modelo de datos** (EVIDENCIA, `types.ts`): `BoardDocument{version:1, title, courtMode, courtRotation, players[], awayPlayers[], ball, drawings[], scenes[]}`; `Scene{id, label, playerPoints: Record<id, Point|null>, ball, drawings[]}`; `Drawing{id, type:'move'|'pass'|'screen', start, end}` (línea recta de dos puntos); coordenadas porcentuales 0-100 con `clampPoint` (3..97, 5..95); `version` para migraciones. Importar/exportar JSON; no guarda automáticamente (cada arranque es una pizarra vacía).
- **Biblioteca y organización**: ninguna (roadmap: guardado local por nombre y luego nube).
- **Puntos fuertes / débiles**: fuerte: vídeo en cliente, `version` en el documento, coordenadas porcentuales independientes de tamaño, tests del dominio. Débil: trazos rectos de dos puntos y sin bote.
- **Ideas aplicables**:
  - [Alta][Medio] Exportar vídeo en cliente con `MediaRecorder` sobre un canvas donde se repinte la reproducción.
  - [Media][Fácil] Campo `version` en el JSON del ejercicio para migrar formatos.
  - [Baja][Fácil] Límite de 5 jugadores por equipo en pista como regla opcional.
- **Fuentes**: https://github.com/sosonamo/BasketballTacticsboard (src/domain/types.ts, board.ts, videoExport.ts, App.tsx).

---

### bingryan/hoopstrategist (HoopStrategist) — https://github.com/bingryan/hoopstrategist — baloncesto — open source (React 19, TypeScript, Cloudflare Pages)
- **Qué es y para quién**: pizarra con **grabación temporal de trazos y movimientos**, reproducción y un **asistente de IA** (proveedores configurables) que propone tácticas en JSON.
- **Cómo se crea un ejercicio** (EVIDENCIA, `types.ts`): herramientas `POINTER`, `PEN`, `ARROW`, `ERASER`, `MOVE_PLAYER`, `BALL_PASS`; formatos 3v3/4v4/5v5; 14 colores de equipo; plantillas precargadas (`playTemplates.ts`) construidas con ayudas `createMovement`/`createArrow`.
- **Cómo se representa**: tablero con porcentajes 0-100, trazos con punta de flecha y opción discontinua (pase); temas visuales y traducción zh/en.
- **Animación/reproducción** (EVIDENCIA): modelo **de grabación**: cada punto lleva `timestamp` absoluto; los trazos (`Stroke.points[{x,y,timestamp}]`), los movimientos (`PlayerMovement{playerId, path[{x,y,timestamp}]}`) y los pases (`BallPass{fromPlayerId, toPlayerId, timestamp}`) se reproducen sincronizados según el reloj. Las demos asignan 2 s por movimiento y 300 ms por pase.
- **Modelo de datos** (EVIDENCIA): `SavedPlay{id, name, strokes[], playerMovements[], players[], courtType, gameFormat, timestamp, metadata{description, steps, playerMoves, ballPasses}}` en `localStorage` (`hoopstrategist_plays`). El asistente (función Cloudflare `/api/chat`) recibe `messages`, `players` y `courtType` y exige respuesta JSON con título, descripción, pasos, movimientos y pases; el cliente puede "Demo" (aplicar) o guardar la estrategia.
- **Biblioteca y organización**: lista local de tácticas guardadas; plantillas; sin etiquetas.
- **Puntos fuertes / débiles**: fuerte: modelo temporal continuo que permite simultaneidad, IA que genera jugadas estructuradas. Débil: reproducción sin fases, trazos a mano alzada con marca de tiempo (datos grandes), IA con calidad táctica dudosa.
- **Ideas aplicables**:
  - [Baja][Difícil] Asistente de IA que proponga un ejercicio a partir de texto y lo vuelque en nuestro formato (requiere validación y revisión del entrenador).
  - [Media][Medio] Pases como evento puntual con duración corta (300 ms) en vez de carril largo.
- **Fuentes**: https://github.com/bingryan/hoopstrategist (types.ts, utils/playTemplates.ts, App.tsx, functions/api/chat.ts).

---

### Otras herramientas revisadas (sin ficha completa)
- **Hoops Lab (Labrador Sports)** — https://labradorsports.com/basketball-features/ : diseñador arrastrar-y-soltar con reproducción animada, media pista/pista completa/saques, comentario para explicar lecturas; gratis 10 jugadas, 5 USD/mes ilimitado; analítica de qué jugadas se ven más y estudio por jugador (MARKETING). Idea [Media][Medio]: saber qué jugadores han visto cada ejercicio asignado.
- **Basketball Practice Plans — Play Creator** — https://basketballpracticeplans.com/basketball-play-creator/ : orientado a base e instituto como alternativa a FastModel; plantillas de jugadas, animación automática, playbook arrastrando jugadas, exportación a PDF y enlace (MARKETING; WordPress/Elementor).
- **TeamBranch** — https://teambranch.io : pizarra con exportación a **GIF animado** en formatos Estándar, Apaisado, Cuadrado y vertical para redes (MARKETING). Idea [Media][Medio]: GIF/vídeo cuadrado o vertical para compartir por WhatsApp.
- **Playmaker (MilosLord)** — la búsqueda describe un motor declarativo (formación inicial + pasos con acciones en paralelo, plantillas como pick&roll o UCLA cut, velocidad 0,5x-2x), pero el repositorio devolvió 404 y **no se pudo verificar** nada por dentro. Concepto útil: pasos con acciones paralelas y plantillas de jugadas con nombres tácticos.
- **tacticalboard/tacticalboard** — https://github.com/tacticalboard/tacticalboard : Vue + Tailwind + two.js + interact.js; pizarra sin fotogramas ni animación (no analizada a fondo).
- **TacticsJournal/board** — https://github.com/TacticsJournal/board : pizarra TypeScript con Konva (fútbol, flechas sólida/discontinua/punteada como PNG) — cae en el grupo de otros deportes.

---

## Patrones y decisiones de diseño detectados

1. **Instantánea por fotograma + interpolación lineal** es el patrón dominante y el más barato (Hoop Coach, Tactical Board, matthiashuschle, sosonamo). Las limitaciones (todo se mueve a la vez, sin simultaneidad parcial) se resuelven en nuestra app con carriles y fases; es una ventaja competitiva real.
2. **Flecha como notación + trayecto guardado**: en Tactical Board, Hoop Coach y Brisbane la flecha dibujada es notación, y la pieza se mueve en línea recta o por la polilínea según el caso. Es una decisión explícita que conviene documentar: ¿la ficha recorre el trazo o va en recta al destino?
3. **Estado del balón como dato de primera clase** por fotograma: poseído por X, suelto, o en posición (matthiashuschle); `ballHolderId` + transferencias con `seq` (Brisbane).
4. **Tipos de línea** casi canónicos: movimiento, pase, bote, pantalla (+ corte, entrega, finta en BC-Tactics). Cada herramienta usa 4-5 tipos principales; más de 6 se considera ruido.
5. **Reloj normalizado 0-1 con ventanas por acción** (Brisbane) permite barra de progreso, scrubbing y velocidad globales con un único `t`. Compatible con nuestra línea de tiempo.
6. **Pista paramétrica** (Tactical Board) o imagen con coordenadas del tamaño de la imagen (Brisbane); coordenadas en metros de mundo (matthiashuschle) o porcentajes (sosonamo, HoopStrategist). La más robusta ante cambios de pista es guardar en unidades de pista y no en píxeles.
7. **Persistencia detrás de una interfaz de 4 funciones** (`getAll/save/remove/clear` en Brisbane) para cambiar de almacén sin tocar la UI; con `version` en el documento (sosonamo).
8. **Compartir sin fricción**: URL corta + solo lectura + sin cuenta (CoachCanvas, Hoops Geek, Tactical Board, Coach Board) es el estándar del mercado.
9. **Exportación escalonada**: imagen (SVG/PNG/JPG) → PDF (por fase o por sesión) → vídeo/GIF. El vídeo en cliente con `MediaRecorder` evita servidor.
10. **Entidades separadas de biblioteca**: jugada / ejercicio / sesión (plan) / playbook (FIBA Europe), con visibilidad privada/publicada.
11. **Planificador de sesión por bloques con duración** que referencia ejercicios de la biblioteca (Hoops Geek, Sportplan, FIBA).

## Lo que NO deberíamos copiar

- **Límite duro de fotogramas** (10 en Diagram the Game) y límites de jugadas por plan gratuito: no aplican a un club.
- **Animación solo punto a punto lineal sin simultaneidad** (Hoop Coach): perderíamos lo que ya tenemos con carriles.
- **Guardar flechas derivadas por diferencia entre fotogramas** (matthiashuschle): pierde la intención (bote vs. corte vs. pantalla).
- **Ids globales reutilizados entre fotogramas con parches de coordenadas** (Hoop Coach, `y -= 255` al cambiar pista): preferir ids estables y coordenadas de pista.
- **Vídeo exportado en servidor** (Tactical Board): innecesario con `MediaRecorder` en el navegador.
- **Editor en canvas opaco** (CoachCanvas/Flutter): mala accesibilidad y SEO, no inspeccionable; mantener SVG/DOM.
- **Animación estrictamente secuencial** (Brisbane, aceptada por el propio proyecto como limitación): no queremos que dos jugadores no puedan moverse a la vez.
- **IA que escribe jugadas sin revisión** (HoopStrategist): riesgo de contenido táctico incorrecto en un club; si se hiciera, solo como borrador editable.
- **Interfaces recargadas con anuncios** (Hoop Coach, Tactical Board): contrario al diseño plegable y limpio que ya tenemos.
