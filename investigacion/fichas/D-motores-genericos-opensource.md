# Grupo D — Motores genéricos y open-source (pizarras, diagramas, animación) y repos deportivos reales

Fecha de la pasada: 2026-10-04. Método: sólo lectura (WebSearch/WebFetch, `curl` sobre `raw.githubusercontent.com` y la API de GitHub; no se clonó nada, no se ejecutó código ajeno, no se crearon cuentas). Los ficheros descargados quedaron en el scratchpad de la sesión, no en el proyecto.

Convención de etiquetas: **EVIDENCIA** = visto en código/JSON/doc real descargado. **DEDUCCIÓN** = inferencia mía. **NO VERIFICADO** = sólo descripción de buscador o recuerdo, no comprobado por dentro.

Para valorar relevancia he mirado también (sólo lectura) el estado de nuestra Pizarra: `taller/js/canvas/geometry.js` (Bézier con manejadores, `flattenPath`, `makeSampler` por longitud de arco, `easeInOut` cúbica), `canvas/instante.js` (posición en el instante t), `history.js` (pila de snapshots, 50), `pizarra/iman.js` (`RADIO_IMAN = 0.60`), `pizarra/gestos.js` (umbrales por tipo de puntero, agarre de dedo 22 px), `pizarra/trazo.js` (Ramer–Douglas–Peucker para trazos a pulso), `canvas/encuadre.js` (zoom 50–400 %, pan). Es decir: **varias de las «técnicas clásicas» ya las tenemos** y lo valioso de esta investigación está en lo que no tenemos todavía.

---

## Resumen de hallazgos transversales

1. **Los mejores repos deportivos convergen en la misma arquitectura**: documento JSON puro (coordenadas en metros/unidades reales) → función pura `estadoEn(documento, t)` → renderizador que sólo lee ese estado. Lo declaran por escrito Pitchboard («el renderizador es función pura de `(documento, tiempo, vista)`»), soccer-tactics (`stateAt(compiled, t)`) y Training Ground (`resolve.ts`). Es exactamente la dirección de nuestro `instante.js`/`fotograma.js`; confirma que vamos bien.
2. **Dos modelos de animación en la práctica**: (a) *fotogramas completos* (cada paso guarda posiciones de todos: Basketball Play Designer, Coach Tools, gljubojevic, PlayWrite) y (b) *tramos/disparadores* donde cada ficha tiene su propio movimiento y se encadenan por eventos («cuando B recibe el pase», «cuando A termine su carrera»): coaching-animator, soccer-tactics ADR-0003, Pitchboard (retraso y duración por entidad). El segundo es el que escala a jugadas reales; el primero es el más fácil de editar.
3. **La duración no se teclea: sale de distancia ÷ ritmo** (andar/trotar/esprintar en m/s). Lo hacen coaching-animator («Pace… durations come from distance and Pace, never typed»), soccer-tactics (walk 1.5, jog 3.5, run 5.5, sprint 8 m/s) y Pitchboard (`travel` por entidad derivado de posiciones).
4. **Interpolar por longitud de arco**, no por parámetro de la curva: Pitchboard lo documenta («una cúbica con `u` uniforme se acelera y se frena»; tabla de 64 cuerdas + búsqueda binaria; razón de cuerdas ≤1,05 tras corregir, >1,5 antes). Nosotros ya lo hacemos (`makeSampler`). Training Ground usa Catmull-Rom con peso por longitud de cuerda (aproximación más tosca).
5. **Parar en cada frontera de fase es un defecto conocido**: Pitchboard lo resolvió con eases Hermite con pendiente de entrada/salida elegible («corre a través», runsThrough) y un «modo flujo». Nuestro `instante.js` aplica `easeInOut` por tramo → un jugador que sigue corriendo entre fases se detiene un instante en cada frontera (DEDUCCIÓN a partir de su comentario de cabecera). Candidato real.
6. **El balón se deriva del portador**: «un pase es un cambio de portador, no un objeto» (Pitchboard D44, `BallState possessed|none|atPosition` en Basketball Play Designer, `possessed/travel/loose` en soccer-tactics). Evita balones desincronizados.
7. **Edición con arrastre «que se propaga»** (Pitchboard D41): mover una ficha en la fase 1 desplaza la misma ficha en las fases siguientes que sólo eran copia; es la queja nº1 de las herramientas por fases. coaching-animator lo plantea como «progresión = paso anterior + cambio» (deltas). Directamente aplicable a fases/ramas.
8. **Deshacer**: todos usan snapshots o diffs con **fusión por gesto** (un arrastre = un paso): Pitchboard (`merge` por clave, tope 60), soccer-tactics (transacciones begin/update/commit/cancel con Esc), tldraw (`mark`/`bailToMark`/`squashToMark`), Excalidraw (`CaptureUpdateAction.IMMEDIATELY|NEVER|EVENTUALLY`). Nuestro `History.push()` es manual: conviene comprobar que ningún arrastre empuje N pasos.
9. **Compartir sin servidor**: Pitchboard (`#d=<base64url(deflate-raw(json))>`, ~3 300 caracteres para 10 escenas con trazos) y hockey-drill-board (`#drill=<base64>`). Con `CompressionStream` nativo es muy barato; útil para «enlace de sólo lectura» de un ejercicio.
10. **Validación con esquema + banco de pruebas** como en nuestras `eval-*.mjs`: Training Ground (`schema.ts` con zod → JSON Schema generado + `npm run validate`), coaching-animator (zod con límites `MAX_MARKERS`…), oche0809 (`validate.js` compartido por app y build; táctica inválida **no se anima** y muestra «error de datos» con motivo).
11. **Lo genérico (Excalidraw, tldraw, draw.io, Konva, Fabric) aporta ideas de formato y de historial, no código**: sobreingeniería para nuestro caso, y tldraw tiene licencia con clave para producción (no es open-source clásico).
12. **Animación declarativa (GSAP, Theatre, SVG.js, Lottie, Rive)**: lo trasladable es el vocabulario (posición relativa `"<"`, `">"`, `"+=0.5"`, etiquetas; keyframes con bézier por tramo; `hold`); adoptar la librería romperíamos el determinismo y la exportación.
13. **Móvil/táctil y accesibilidad**: los repos deportivos casi no resuelven pinza con dos dedos (sólo rueda con ctrl = pinza de trackpad). Las referencias normativas (WCAG 2.5.7 arrastre con alternativa; ARIA Graphics; `prefers-reduced-motion`) dan una lista concreta de comprobación; nuestro lienzo es canvas 2D, así que la accesibilidad exige un espejo DOM.
14. **Antipatrón confirmado en la práctica**: el «Hockey Coach Whiteboard» vende «animación de recorridos» pero su `renderAnimatedFrame` sólo dibuja un destello pulsante sobre el disco (EVIDENCIA, `app.js` L2278); guarda en una API pública sin login (`restful-api.dev`). Ver «Lo que NO deberíamos copiar».

---

# PARTE 1 — Proyectos open-source de pizarras deportivas (código real)

### Training Ground — https://github.com/Dukes0O/training-ground — fútbol (soccer) — open-source (sin licencia declarada en el repo; 2026-09)
- **Qué es y para quién**: diseñador y animador local de ejercicios de fútbol para un entrenador juvenil. SPA React+TypeScript+Vite con tablero SVG; un pequeño servidor Express sirve la app y hace CRUD de ficheros; **cada ejercicio es un `.json` en `drills/` y esa carpeta es la base de datos**. Sin cuenta ni precio (uso local). Pensado también para que un agente de IA escriba ejercicios a mano (hay `docs/drill-authoring.md`).
- **Cómo se crea un ejercicio**: barra de herramientas agrupada; arrastrar jugadores/balón/material (conos, vallas, miniporterías, escaleras, maniquíes); flechas con estilo (`pass` sólido, `run` discontinuo, `dribble` ondulado, `shot` grueso, `plain`); flechas multipunto (un punto por clic, Enter/doble clic cierra, Backspace quita el último) con manejadores amarillos; zonas rectángulo/elipse/polígono; etiquetas; formaciones predefinidas; «Duplicar selección» (reasigna ids y conserva anclajes a elementos no seleccionados); tarjetas de paso con reordenación por arrastre y **Alt+←/→** por teclado. Atajos sólo del tablero (`useHotkeys`), respetando foco y diálogos.
- **Cómo se representa**: SVG (`BoardSvg`, glifos por tipo: `PlayerToken`, `BallGlyph`, `EquipmentGlyph`, `ArrowGlyph`, `ZoneGlyph`); cámaras Landscape/Portrait/Angled (proyección afín SVG, no 3D; las fichas quedan verticales); «Seguir balón»/jugador con zoom 1–3×. Exporta PNG, GIF (`gifenc`, 720 px/12 fps por defecto) y MP4/WebM (`mediabunny` sobre WebCodecs, 1280 px/30 fps) por un **bucle de fotogramas offline compartido** (`renderFrames`); aviso si el GIF pasa de 20 s.
- **Animación/reproducción**: pasos = fotogramas clave. `durationMs` es el tiempo de animación **hacia** ese paso; `pauseAfterMs` (pausa didáctica, 300 por defecto); paso 0: `durationMs` es cuánto aguanta la imagen inicial (800). Por ficha: `ease` (`linear|easeIn|easeOut|easeInOut|instant`), `via` (puntos intermedios), `rotation` con arco más corto. Reloj (`usePlaybackClock`): `requestAnimationFrame` + un `setInterval` de 100 ms «guardián» por si el navegador estrangula rAF en pestañas ocultas; velocidad y bucle en el estado.
- **Modelo de datos (EVIDENCIA)**: `drills/passing-diamond.json`: `{schemaVersion, id, title, description, tags[], notes, themeColor, pitch{format,overrides{length,width}}, entities[], steps[]}`. Entidades declaradas una vez (`{kind:"player",id,team,number}`, `{kind:"ball"}`, `{kind:"cone",color}`, `{kind:"arrow", style, from:{ref:"p1"}|{x,y}, to, via[], pathMode:"smooth|straight", fromStep, toStep}`, `zone`, `label`). `steps[k].positions` es un mapa `id → {x,y,rotation?,via?[],ease?,hidden?}` en **metros**, origen arriba-izquierda. **Pasos dispersos legales**: sólo se listan las entidades que se mueven y el resto «forward-fill» desde el último paso que las colocó; la app guarda en forma densa. Visibilidad de anotaciones por rango `fromStep..toStep` con fundido de 150 ms. `schema.ts` (zod) ↔ `types.ts` con comprobación en compilación; `schema/drill.schema.json` se genera; `npm run validate`. Interpolación (`tween.ts`): Catmull-Rom uniforme sobre `[from, ...via, to]` eligiendo segmento por longitud de cuerda; ease sobre la progresión; `lerpAngle` por el arco corto.
- **Biblioteca y organización**: tarjetas con **vista previa real** dibujada con el mismo `BoardSvg` (caché `WeakMap` por objeto-resumen), búsqueda, filtro por etiquetas (todas a la vez), orden, duplicar/papelera, «guardados» por navegador. Sin sesiones ni PDF. El servidor vigila la carpeta (`chokidar`): un fichero válido aparece en la biblioteca en un segundo.
- **Puntos fuertes / débiles**: + modelo muy limpio, esquema generado, export determinista, pasos dispersos; + trazas de movimiento y «visión» como capas derivadas del documento. − sólo fútbol y uso local; − Catmull-Rom por cuerdas no iguala la velocidad (EVIDENCIA: pesa segmentos por `dist`, no por longitud de arco real); − `pathMode` por flecha pero sin editor de curvas con manejadores.
- **Ideas aplicables a nuestra app**:
  - [Alta][Fácil] Esquema de ejercicio + `validar()` puro (reglas del dominio: 5 atacantes, ids únicos, rangos de fase válidos…) compartido por editor, importación y banco `eval-*.mjs`. Ver también oche0809.
  - [Media][Fácil] Visibilidad de anotaciones por rango de fase con **fundido corto** (150 ms) en vez de aparecer/desaparecer de golpe.
  - [Media][Medio] Exportación GIF/MP4 con bucle offline determinista (ver Pitchboard); GIF con `gifenc` (librería pequeña en JS puro) y MP4 con WebCodecs sólo si el navegador lo ofrece.
  - [Media][Fácil] Vista previa de tarjeta de biblioteca renderizada con el motor real (no imagen subida) + caché por versión del ejercicio.
  - [Baja][Fácil] Reloj con «guardián» de intervalo para pestañas ocultas (si nuestra reproducción debe terminar aunque el entrenador cambie de pestaña).
- **Fuentes**: https://github.com/Dukes0O/training-ground ; raw: `docs/drill-authoring.md`, `drills/passing-diamond.json`, `src/model/tween.ts`, `src/model/resolve.ts`, `src/timeline/usePlaybackClock.ts`, `src/export/exportGif.ts`, `src/export/exportVideo.ts`, `CLAUDE.md`.

---

### Pitchboard — https://github.com/migueljfsc/pitchboard — fútbol, fútbol sala, balonmano, hockey (hielo/hierba), voleibol — open-source (MIT, 2026-10)
- **Qué es y para quién**: pizarra táctica animada en el navegador: dibujas una formación, mueves jugadores entre escenas por trayectorias curvas y exportas MP4/GIF/PNG, todo en cliente. Hay cuentas (Cloudflare Workers + D1), enlaces públicos y tienda de «presets» de plantilla. Es el repo **mejor documentado** que he encontrado (`docs/architecture.md`, `docs/decisions.md` con ~125 decisiones numeradas).
- **Cómo se crea un ejercicio**: elegir deporte y formación; arrastrar fichas por escenas; curvas de carrera con manejadores; anotaciones (flechas, líneas, mano alzada, zonas, texto); **«links»** (cadenas/polígonos entre jugadores que se recalculan cada fotograma, con distancias en metros); foco/«spotlight» que oscurece el resto; menú contextual y paleta de comandos (⌘/Ctrl+K); atajos; deshacer con **historial nombrado** («qué hizo la edición», calculado comparando documentos, `describe.ts`); tour inicial sobre un tablero de ejemplo aislado.
- **Cómo se representa**: **canvas 2D** (no SVG), con `drawBoard(ctx, doc, t, view)` puro; orden de dibujo plano de 13 capas (zonas, links, estela, fantasmas de otras escenas, halos, fichas, balón, marcas, foco…) y el *hit-test* recorre el mismo orden al revés. Vista 3D como homografía (suelo plano deformado por tiras + «billboards»). Exporta MP4 (H.264) o WebM, GIF (`gifenc`, una paleta por clip) y PNG, **en un Web Worker con OffscreenCanvas**: el mismo `drawBoard` con `t = 0…duración` a 1/fps, así vista previa y exportación no pueden divergir.
- **Animación/reproducción**: línea de tiempo = `hold` de la escena 0, y por cada escena posterior `transición + hold`. `resolveAt(doc,t)` devuelve `{from,to,u,moving,index}`. Sin trayectoria: `lerp` con ease; con trayectoria: **Bézier cúbica con reparametrización por longitud de arco** (64 cuerdas, tabla acumulada, búsqueda binaria; sin caché a propósito). Ease por defecto `easeInOutCubic`; **«gradual / brusco / corre a través»** por carrera (Hermite con pendientes `m0,m1` en [0,3] en unidades de velocidad media); `delay` y `travel` **por entidad** (la escena dura el máximo de `delay+travel`); **modo flujo** (ritmo único, lineal, sin pausas). Pase con `easeOutQuad` (decelera) y pase en globo a velocidad constante.
- **Modelo de datos (EVIDENCIA, `architecture.md` + `types.ts`)**: `BoardDoc{version,name,sport?,pitch,tokenScale?,flow?,teams[2]{id,name,color,players[{id,number,label}]},scenes[],links[],annotations[]}`. `Scene{id,name,note?,transitionMs,holdMs,positions:{id→Vec2}(todos),paths:{id→{c1,c2}|null}(la carrera HACIA esta escena),carrier|ballPos,ballPath,shot?,loft?,travel?,delay?,run?,hiddenRuns?,highlight?,spotlight?}`. Los caminos viven en la escena a la que se llega («borrar una escena no deja huérfanos»). Invariantes: toda escena posiciona a todos; un portador es un jugador real y no coexiste con `ballPos`. **Campo ausente = comportamiento antiguo** → no hace falta migrar para añadir campos opcionales; una migración real sube `version` y `migrate.ts` convierte **antes** de validar con zod (esquema compartido por app y Worker). Coordenadas en «unidades de tablero» (metros de campo de fútbol; otras pistas escaladas a 105 de largo).
- **Biblioteca y organización**: cuenta → proyectos anidados (lista de adyacencia con guardas de ciclo y profundidad) → tableros; mover/borrar en bloque; publicar (`/share/<slug>` que sigue las ediciones) o **enlace congelado `#d=<base64url(deflate-raw(json))>`** que se abre en modo lectura con «bifurcar» (D7). Autoguardado en `localStorage` con validación en cada lectura que nunca lanza. Límite de documento 256 KB. Importador de `tracks.json` (seguimiento real) a tablero.
- **Puntos fuertes / débiles**: + arquitectura determinista ejemplar, decisiones razonadas, 3D y exportación en worker; + UX de edición cuidada (D41, D103). − enorme (el renderizador sólo pesa 113 KB); − React + zod + Cloudflare: nada de eso se copia, sí las ideas.
- **Ideas aplicables a nuestra app**:
  - [Alta][Medio] **«Una edición se propaga a las fases siguientes que no hacían nada con esa ficha»** (D41): al mover una ficha en una fase, aplicar el mismo desplazamiento a las fases posteriores en las que esa ficha sólo estaba copiada. Cada fase se compara con la anterior (no con la editada), el modo («sólo aquí / hasta el próximo cambio / todas») se fija al agarrar y es visible. Encaja con nuestras fases encadenadas y ramas.
  - [Alta][Medio] **Ease con pendiente de entrada/salida («corre a través»)** para que un jugador que sigue corriendo no se detenga en la frontera de fase. Implementación vanilla: función `hermite(u,m0,m1)` de 4 líneas (EVIDENCIA, `geometry.ts`) y aplicar según si la fase siguiente continúa el movimiento de la misma ficha. Cuidado: el ease se coloca por TIEMPO, no por `u`, porque el corredor sigue durante el «hold».
  - [Media][Fácil] **Retraso y duración por ficha** dentro de una fase (nosotros tenemos carriles; comprobar si ya equivale a `delay`/`travel`).
  - [Media][Fácil] **Historial nombrado** calculado por comparación de documentos (no un texto en cada punto de llamada): «Movido 3», «Añadido pase de 5 a 4». Permite lista de pasos atrás.
  - [Media][Fácil] Enlace de sólo lectura `#d=` con `CompressionStream('deflate-raw')` + base64url, abierto en un visor con «copiar a mi biblioteca»; sin servidor, sin tocar Supabase.
  - [Baja][Medio] «Links» (cadena/polígono entre jugadores recalculados por fotograma, con distancias): útil para mostrar triángulos de ayuda, «defensa en cuña» o espaciado en ataque 5 contra 5.
  - [Media][Medio] Exportar GIF/MP4/PNG con el mismo `dibujar(ctx, estado)` fuera de pantalla (nuestro `fotograma.js` ya produce el estado; faltaría el bucle a 1/fps). Más fácil que un worker: bucle `await` con `canvas` normal.
- **Fuentes**: https://github.com/migueljfsc/pitchboard ; raw: `docs/architecture.md`, `docs/decisions.md` (D7, D14, D26, D41, D44, D93, D100, D103, D115), `src/board/geometry.ts`, `src/board/types.ts`, `src/lib/history.ts`, `src/board/describe.ts`, `src/components/BoardCanvas.tsx`.

---

### soccer-tactics (Football Tactics Sequencer) — https://github.com/BlueSky8bya/soccer-tactics — fútbol — open-source (sin licencia; el repo es de documentación de agente muy extensa)
- **Qué es y para quién**: secuenciador táctico con editor de trayectorias, línea de tiempo y reproductor determinista; carriles independientes por jugador con retraso/secuencia/disparadores. Interesa por sus **ADR escritos** (decisiones razonadas con alternativas), no por el código.
- **Cómo se crea un ejercicio** (según ADR-0006/0009, EVIDENCIA documental): herramientas como máquina de estados (seleccionar, mover, trayecto, balón, dibujar); arrastre con deshacer atómico; Inspector acoplado a la derecha **siempre visible** cambiando sólo el contenido (descubrieron que mostrarlo sólo al seleccionar «entra y sale» y molesta); zonas de impacto: ficha ≥28 px, waypoints/manejadores/playhead ≥16 px (visual 8–10 px) con relleno invisible; modo «simple».
- **Cómo se representa**: **SVG con `viewBox` = pista en metros** (105×68), React; token/balón actualizados por `ref` y `transform` en rAF durante la reproducción (sin re-render); canvas sólo si hay mucho trazo libre. Conversión puntero→dominio por `getScreenCTM().inverse()` en un único sitio. Zoom/pan = manipular el `viewBox`; media pista = mitad del `viewBox`; datos inalterados. Konva/WebGL descartados por perder accesibilidad, exportación y declaratividad.
- **Animación/reproducción (EVIDENCIA, ADR-0003)**: documento → `compile()` (memoizado por revisión) → `CompiledTimeline` (disparadores resueltos a tiempos absolutos, LUT de longitud de arco por trayecto, tabla de eventos) → `stateAt(compiled,t)` → renderizador. Segmentos: `move{path,facing}`, `hold`; balón: `possessed{holderId,offset}`, `travel{pass|throughBall|cross|shot|clearance|deflection|loose, path, receiverId, flight:ground|lofted}`, `loose`. `Timing = {duration}|{speed m/s}` (la duración se calcula con `longitudArco/velocidad`); variante `{speed, decel}` para «tiro seco». **Disparadores**: `at t`, `afterSegment(id, start|end, +offset)`, `atWaypoint(segmento, n, +offset)`, `onEvent(ball.released|ball.received…)`, `atMarker`. Resolución por grafo + orden topológico; **ciclo = error de compilación visible**, no reproducible. Presets de ritmo: andar 1,5, trotar 3,5, correr 5,5, esprintar 8 m/s; pase 12–18, tiro 20+.
- **Modelo de datos (EVIDENCIA)**: `TacticDocument{schemaVersion,id,meta,pitch{length,width,unit,view},teams[],players[{id,teamId,number,home}],ball,drawings[{kind,geometry,style,visible?:TimeRange}],scenes[{timeline{tracks[{entityId,segments[]}],markers[]}}]}`; `Waypoint{id,p,handleIn?,handleOut?,hold?}` (Bézier opcional por waypoint). Historial: tres stores (documento / historial / UI), transacciones `begin→update*→commit|cancel` (Esc revierte), nudge fusionado con ventana de 500 ms; el historial guarda referencias a documentos con estructura compartida (inmer), no parches.
- **Biblioteca y organización**: no hay (producto en construcción).
- **Puntos fuertes / débiles**: + el contrato `compile/stateAt` y los disparadores por evento son lo más cercano a «una jugada real» que he visto; + decisiones con alternativas y criterios de reapertura. − enorme coste de proceso (CHANGELOG de 348 KB), producto sin biblioteca; − el modelo de disparadores es potente pero exige UI de línea de tiempo con dependencias (en su repo tardó muchos planes).
- **Ideas aplicables a nuestra app**:
  - [Alta][Medio] **Disparadores por evento** («B empieza cuando recibe el pase de A», «A sale cuando el bloqueo llega a su sitio»): sustituyen a mover bloques de tiempo a mano y hacen que cambiar un pase retime la jugada. Comprobar cuánto de esto ya hace `motor/compilar.js` (721 líneas; no lo he leído entero) antes de decidir.
  - [Media][Fácil] **Ritmo con nombre (andar/trotar/esprintar) y duración derivada** (ya parcialmente en `dibujo.js`: «a qué ritmo se recorre, para poder decir los segundos»); ampliar a pases (corto/seco/picado).
  - [Alta][Fácil] **Error visible de ciclo/dependencia** en vez de reproducción rara.
  - [Media][Fácil] Transacción con **Esc que cancela** durante arrastre (begin/update/commit/cancel).
  - [Media][Fácil] Mínimos de zona táctil (ficha ≥28 px; manejador ≥16 px con visual menor) — ya aplicamos 22 px de agarre de dedo (`AGARRE_DEDO`); revisar el de los manejadores de curva.
- **Fuentes**: https://github.com/BlueSky8bya/soccer-tactics ; raw `docs/agent/decisions/ADR-0003-…md`, `ADR-0004-…md`, `ADR-0005-…md`, `ADR-0006-…md`.

---

### Basketball Play Designer — https://github.com/matthiashuschle/basketball_play_designer — baloncesto — open-source (sin licencia declarada, 2026-09)
- **Qué es y para quién**: diseñador de media pista en el navegador, un único HTML sin dependencias (bundle con esbuild), 15 × 14 m FIBA. Es el repo **de baloncesto** más cercano a nuestro propósito entre los de «animación».
- **Cómo se crea un ejercicio (EVIDENCIA, README)**: colocar jugadores «Home/Away» (atajos `H`/`A`; `V` seleccionar); clic en jugador alterna posesión; arrastrar la ficha dibuja una flecha de movimiento (roja) y **un clic posterior fija hacia dónde mira**; arrastrar el balón a un compañero (<1,5 m) o al aro (≤3 m) crea un **pase/tiro** (azul discontinuo, etiqueta «PASS»); balón a espacio libre = movimiento de balón (naranja punteado). Regla: **una flecha por jugador y fotograma** (la nueva sustituye). Botón **+ Add Frame** calcula el siguiente fotograma a partir de las flechas y avanza. Doble clic = número de camiseta. Espacio reproduce, ←/→ navegan, Supr borra.
- **Cómo se representa**: **canvas 2D**; pista con medidas FIBA (aro a 1,575 m de la línea de fondo, arco de 6,75 m…). Tipos con «marca»: `WorldPoint`/`ScreenPoint` para no mezclar coordenadas (EVIDENCIA, `types.ts`). Flechas dibujadas a mano (`MovementArrow.draw`: línea hasta `to − cos·cabeza`, triángulo con ángulo ±π/6).
- **Animación/reproducción**: `lerp` de posición y de rotación por arco corto entre fotogramas; velocidad 1–100 → `playSpeed = 1100 − 10·valor` ms por transición; opción de bucle y de **suavizado `easeInOutCubic`** (EVIDENCIA, `App.ts` L573–610); barra de fotograma con scrubbing.
- **Modelo de datos (EVIDENCIA, `types.ts` + `initial-plays.json`)**: `PlaysCollection{plays[],currentPlayIndex}`, `PlayData{name,frames[],createdAt}`, `FrameData{players[{id:"home-1",team,number,position:{x,y} en metros,rotation}],ball:{state:{type:'possessed',playerId}|{type:'none'}|{type:'atPosition',position}}}`. **Cada fotograma es una instantánea completa**; las flechas no se guardan: se **deducen** al generar el siguiente fotograma (por diferencia). Exporta/importa JSON.
- **Biblioteca y organización**: varias jugadas en barra lateral (crear, renombrar, cambiar, borrar); JSON de colección. Sin etiquetas ni búsqueda.
- **Puntos fuertes / débiles**: + el flujo «arrastrar y soltar → nuevo fotograma» es muy rápido para jugadas simples; + balón con unión discriminada de tres estados. − sin trayectorias curvas ni retrasos; − una flecha por ficha y fotograma limita acciones encadenadas (pase y luego corte); − lo que se muestra como flecha se pierde al guardar (sólo quedan posiciones).
- **Ideas aplicables a nuestra app**:
  - [Media][Fácil] El gesto **«soltar y luego clic para fijar hacia dónde mira»** (orientación del jugador) como ajuste opcional; coherente con acciones de defensa o recepción.
  - [Baja][Fácil] Unión discriminada de estado de balón (`possessed|none|atPosition`) como contrato entre editor y motor (comprobar `posesion.js`).
  - [Baja][Fácil] Cancelar un movimiento arrastrando la ficha **a su propio sitio** (<15 cm) — gesto de anulación sin botón.
- **Fuentes**: https://github.com/matthiashuschle/basketball_play_designer ; raw: `README.md`, `src/types.ts`, `src/Movement.ts`, `src/initial-plays.json`, `src/App.ts` (L24–30, 540–610).

---

### Basketball Tactics Board (作戦盤) — https://github.com/oche0809/basketball-tactics-board — baloncesto — open-source (sin licencia; 2026-09; textos en japonés)
- **Qué es y para quién**: pizarra «de aprendizaje» para un club escolar: jugadas de **saque de banda (BLOB/SLOB), media pista y sets U16** con tipos de movimiento y defensa. JS vanilla en IIFE, sin framework ni build para el uso (`index.html` abre con `data/bundle.js` generado por `node build.js`), PWA, pruebas con `node --test`. **Es el más parecido a nuestro estilo de trabajo.**
- **Cómo se crea un ejercicio**: no es un editor de dibujo libre: los datos se **escriben** en `data/diagrams.json` siguiendo una receta (fuente → variante → 5 posiciones → pasos → primera/segunda opción → build). Hay edición «versión de equipo» desde la app (el profesor registra su versión y la defensa) sin tocar el original ni la capa de dibujo.
- **Cómo se representa (EVIDENCIA, `board.js`)**: **SVG** creado con `el(tag, attrs)` (sin librería), pista en unidades de 10 cm (0–150 × 0–140; aro en [75, 15.75]), `mirror` para espejar. Marcadores SVG por tipo: `cut, move, pass, option, unc, def`. Corte = línea con flecha; **bloqueo con línea en zigzag** (`zigzagD`, paso 2,6 amplitud 1,6; se acorta 5 al final); `trimEnd/trimStart` acortan la línea para que la flecha no quede tapada por la ficha; **modo «yo»** (`opts.mode="me"` + `focus`): el jugador elegido a opacidad 1, aquel para quien bloquea 0,75 y el resto 0,2.
- **Animación/reproducción (EVIDENCIA)**: `computeStates(d)` calcula la posición y el portador **al final de cada paso**; `draw(k, t)` interpola dentro del paso: fase «mover» (hasta 55 % del paso) con `ease` cuadrática in-out sobre `pointAt(pts,u)` (polilínea con `via`) y fase «pase» después con `lerp` de portador a receptor. Un paso = una acción conceptual.
- **Modelo de datos (EVIDENCIA, `diagrams.json`, 89 KB)**: `meta{coords,move_types,pass_types,roster_rule,defense}`; `diagrams["BLOB-01"]{layout_status:"provisional"|"source_diagram", inbounder, inbound:[x,y], on_court_players[], players{"2":[x,y]…}, unknown_notes[], source_steps_ja[], roles_ja{}, steps[]}`; cada `step{src:[índices a la ficha original], label, moves[{p, to:[x,y], via?:[[x,y]…], type:"cut|move|screen|dribble", for:"2"?, uncertain?}], passes[{from,to,type?:"handoff"}], options[{from,to,label}]}`. Defensa: `defense{enabled, players[{id,guards,pos}], steps[{step,moves[{id,to,via}],note}]}` y `matchups`, con acciones `stay/follow/switch/switch_back/recover/closeout/screen_avoid/help/hedge/deny` (método under/over/go_through/switch). Recuento real: 42 `cut`, 27 `move`, 26 `screen`, 4 `dribble`, 38 `options`, 1 `handoff`.
- **Biblioteca y organización**: catálogo de tácticas (BLOB/SLOB/HC/SET) por URL hash, biblioteca de patrones defensivos (15) con **quiz** (`quizzes:[{pattern_id, step, question, choices, answer_index, explanation}]`), estado de verificación por táctica (`verified`, `layout_status`, `fix_notes`).
- **Reglas de validación (EVIDENCIA, README + `validate.js`)**: «BLOB/SLOB: 4 en pista + 1 sacador; media pista: 5; defensa 5; ids O1–O5 sin repetir»; una táctica que no cumple se muestra como «error de datos — requiere corrección» y **no se anima**; si `verified:false` o no hay pasos, «en revisión» y tampoco. Nada se rellena por conjetura: «lo que no está en la fuente no se dibuja».
- **Puntos fuertes / débiles**: + vocabulario de acciones de baloncesto con **para quién** (`for`) en pantallas, `options` que **no mueven balón** (alternativas) frente a `passes` que sí; + defensa tipificada y vinculada a la acción del atacante; + disciplina de datos (original inmutable + capa de dibujo + versión de equipo). − sin editor visual de dibujo; − estructura pensada para catálogo cerrado.
- **Ideas aplicables a nuestra app**:
  - [Alta][Fácil] **Distinguir «pase que ocurre» de «opción que se muestra»** (alternativa sin mover balón): en nuestras ramas/variantes, una flecha de «opción» punteada que no cambia la posesión.
  - [Alta][Fácil] **Acción con destinatario** (`screen` + `for`): el bloqueo sabe para quién es; permite frases («bloquea para 2») y el modo «yo».
  - [Media][Fácil] **Modo «Yo» (foco en una ficha)** para que cada jugador vea su rol: opacidad 1/0,75/0,2 (EVIDENCIA); coste mínimo en `ctx.globalAlpha`.
  - [Alta][Fácil] **`validar()` con reglas de dominio y «no animar si es inválido»**, con mensaje legible y estado `verificado/provisional` visible en la biblioteca.
  - [Media][Medio] Quiz/«¿qué haces tú?» por paso: útil para formación de jugadores jóvenes; fuera de alcance del editor, dentro del visor.
  - [Baja][Fácil] Línea en zigzag para bloqueo (si no la tenemos ya: ver `canvas/arrows.js`).
- **Fuentes**: https://github.com/oche0809/basketball-tactics-board ; raw: `README.md`, `data/diagrams.json`, `board.js`.

---

### Coach Tools — Play Diagram Builder — https://github.com/LoganBrose/Basketball — baloncesto — open-source (sin build ni dependencias)
- **Qué es y para quién**: dos herramientas estáticas para entrenador (estadísticas con Google Sheets y **editor de jugadas**), desplegables en GitHub Pages. ES modules sin bundler, `node --test`.
- **Cómo se crea un ejercicio (EVIDENCIA, README + `playbook.js`)**: soltar jugadores en posiciones por defecto (`SPOTS` ataque/defensa, para montar un set en segundos), arrastrar; herramientas **Cut, Pass, Dribble, Screen, Text** (atajos V, C, P, D, S, T; Ctrl+Z / Mayús+Z); «pasos» (frames) donde los jugadores mantienen posición o se reinicia; imán a **0,5 pies**; tipos de pista media/completa y línea de tres (instituto/universidad/NBA); alineación de plantilla (`lineup.js`: quién ocupa cada «slot» para mostrar nombres, **sólo visual, nunca guardado en la jugada**).
- **Cómo se representa**: **SVG con unidades = pies** («un token en el JSON es una posición real en una pista real, por eso la jugada sigue siendo editable años después»). Flecha = `{kind, from, to, ctrl?}` con **un punto de control cuadrático**; el regate se dibuja como **onda de amplitud decreciente** (`dribbleD`: 72 muestras, `off = sin(t·ondas·2π)·amp·sin(πt)` sobre la normal); la pantalla termina en barra perpendicular; **fantasma** (`ghost`) del fotograma anterior; marcadores de flecha `ah` y `ah-ghost`.
- **Animación**: no la hay (los pasos son diagramas estáticos que se ven en secuencia). *(Búsqueda de `animate|requestAnimationFrame` sin resultados en `playbook.js`.)*
- **Modelo de datos (EVIDENCIA, `library.js`)**: `play{schema, id, name, category, playbook, tags[], notes, courtType, preset, youtube, frames[{label, tokens[{id,kind:offense|defense|ball|cone|coach,label,x,y,hasBall}], arrows[{id,kind,from,to,ctrl?}], texts[]}], createdAt, updatedAt}`. `emptyFrame(label)`; `normalizePlay` al importar.
- **Biblioteca y organización**: filtros `q` (texto), `category`, `tag`, `playbook`; guardado local con estado visible **«Guardado / Guardando… / Sin guardar»**; exportar jugada o libro entero a **PDF con índice numerado** (`printout.js`: `printPlay`, `printPlaybook`) y a JSON; publicación opcional a «libro de equipo» con Apps Script y token de administrador (con sesión).
- **Puntos fuertes / débiles**: + el patrón técnico más cercano al nuestro (vanilla + SVG + pruebas Node); biblioteca con categorías/etiquetas/«playbooks»; PDF. − sin animación; arco cuadrático único.
- **Ideas aplicables a nuestra app**:
  - [Media][Fácil] **Píldora de estado de guardado** (Guardado/Guardando/Sin guardar/Error) siempre visible en el editor.
  - [Media][Medio] PDF del libro de jugadas con **índice numerado** (nuestra Biblioteca → sesión ya exporta PDF; revisar si cubre «libro» de varios ejercicios).
  - [Media][Fácil] **Alineación mostrada pero no guardada** (nombres de jugadores sobre los números sin tocar el ejercicio) — para reutilizar el mismo ejercicio con otra plantilla.
  - [Baja][Fácil] Onda de regate con envolvente `sin(πt)` (el trazo empalma limpio con la ficha y con la punta de flecha).
- **Fuentes**: https://github.com/LoganBrose/Basketball ; raw `README.md`, `assets/js/playbook.js` (L1–60, 124–200), `assets/js/library.js` (L38–60).

---

### coaching-animator — https://github.com/footnote42/coaching-animator — rugby/fútbol/fútbol americano — open-source (2026-10; TypeScript, Next/Supabase)
- **Qué es y para quién**: animador de «prácticas» de rugby para entrenadores de club; Galería pública, cuentas (18+), etiquetas desde una lista cerrada, **Practice Script** escribible a mano o por un agente. Stack con Supabase como nosotros (`database.types.ts`).
- **Cómo se crea un ejercicio**: marcadores colocados en celdas de una cuadrícula de 1 m; **movimientos por waypoints a un ritmo (walk/jog/sprint)**; pases disparados por llegada; progresiones como cambios sobre el paso anterior.
- **Cómo se representa / Animación**: duración = distancia ÷ ritmo (más lento que el tiempo real a propósito, para que se entienda); exporta `.webm`.
- **Modelo de datos (EVIDENCIA, `schema.ts` zod → JSON Schema público)**: `Area{template,width,length}`; `Marker{id,kind:attacker|defender|ball|cone|tackle-shield|coach,team?,label≤4}`; paso 0 `{placements[],moves[],passes[],commentary{points[]}}`; `Move{marker, waypoints[Cell]≤50, pace?, after?:{move|pass}}`; `Pass{id, from, to, ball?, at?:índice de waypoint del receptor}` («coger al vuelo»: el pase sale cuando el receptor llega a ese waypoint y sigue corriendo con el balón); **progresiones**: lista de cambios tipados `addMarker | removeMarker | placeMarker | setMove | removeMove | setPass | removePass…` sobre el paso previo; palanca STEP (`space/time/equipment/people`) y un punto de coaching que explica por qué es más difícil. Límites duros (`MAX_MARKERS 60`, `MAX_PASSES 50`, `MAX_BALLS 3`).
- **Biblioteca**: Galería pública con etiquetas cerradas (máx. 5); fuente enlazada (vídeo/página de origen) con crédito.
- **Puntos fuertes / débiles**: + el esquema describe **intención** (esperar al pase, coger al vuelo) y no sólo posiciones; + las progresiones como deltas encajan con «ramas»; ADR sobre IA fuera de la app. − cuadrícula entera de 1 m (menos expresivo para baloncesto); sin editor de curvas.
- **Ideas aplicables a nuestra app**:
  - [Alta][Medio] **Variantes como deltas sobre la fase base** (`setMove`, `addMarker`, `setPass`…) en vez de copiar la fase entera: una corrección en la base se propaga a las ramas (mismo principio que D41 de Pitchboard). Riesgo: migración del modelo actual de ramas; hay que decidirlo con el entrenador.
  - [Media][Fácil] **Palanca/«por qué es más difícil»** en cada variante: un campo de texto estructurado (espacio, tiempo, material, personas) como metadato; refuerza el valor pedagógico de las ramas.
  - [Media][Fácil] **«Fuente» enlazada** (de dónde sale el ejercicio) en metadatos.
  - [Media][Medio] `pase.at = waypoint` (recibir en carrera) como opción de sincronía.
- **Fuentes**: https://github.com/footnote42/coaching-animator ; raw `CONTEXT.md`, `src/features/practice/schema.ts`.

---

### Hockey Coach Whiteboard — https://github.com/lc85/hockey-drill-board — hockey — open-source (PWA, JS vanilla, 2026-10)
- **Qué es y para quién**: pizarra de hockey sin dependencias, PWA instalable en iPad/iPhone/Android; el repo más pequeño y también el más parecido a nuestro stack (app.js de 2 730 líneas en un IIFE). Valioso por lo que **muestra de bueno y de malo**.
- **Cómo se crea un ejercicio (EVIDENCIA)**: estado único `state{currentTool, objects[], selectedObjectId, history[], historyIndex, animTime…}`; herramientas select, flecha de camino, línea ondulada, línea, texto, borrador; fichas por rol (`C, LW, RW, LD, RD, G`), oponentes `X`, puck, conos, neumáticos, redes; **asas de esquina** para redimensionar; barra flotante contextual; «traer al frente / enviar atrás» para que las fichas no queden atrapadas bajo una zona; guías de alineación.
- **Cómo se representa**: pista de hielo en **SVG** (`renderRinkSVG`, `createSvgElement`) y objetos en **canvas 2D** encima; PNG de alta resolución; coordenadas de ratón → canvas con `getBoundingClientRect` y recorte al área visible (`getCanvasCoords`); eventos táctiles de un dedo duplicados a mano (`onTouchStart/Move/End` con `preventDefault`).
- **Animación**: **no existe de verdad** — `playAnimation` usa `setInterval(50 ms)` y `renderAnimatedFrame(t)` sólo repinta y dibuja un destello pulsante alrededor del disco (EVIDENCIA, L2234–2296). Las rutas no mueven fichas.
- **Modelo de datos (EVIDENCIA)**: lista plana `objects[]` de `{id:'obj_'+Date.now(), type:'player'|'opponent'|'puck'|'cone'|'line'|'shape'|'text', x, y, color, radius…}`; ejercicio guardado = `{id:'drill_'+Date.now(), title, duration:'10 Mins', rink, description, coachingPoints, objects, savedAt}`; `localStorage['hockey_drills']`. **Historial**: `JSON.stringify(state.objects)` apilado y truncado al ramificar (el patrón más sencillo posible).
- **Biblioteca y compartir**: modal «Mis ejercicios / Predefinidos»; enlace `#drill=<base64 del JSON>`; **sincronización a un «cloud playbook» público sin login** (`api.restful-api.dev`) — cualquiera puede leer/pisar.
- **Puntos fuertes / débiles**: + 100 % offline, onda de línea simple y reconocible; + «traer al frente»; − animación ficticia, sin `ids` estables entre guardados, sin esquema ni validación, nube pública sin autenticación, `prompt()/confirm()` nativos.
- **Ideas aplicables a nuestra app**:
  - [Baja][Fácil] Orden de apilado explícito («traer al frente/atrás») para ayudas visuales (zonas) frente a fichas — comprobar nuestro orden de capas (`lienzo.capa(..., {orden})` ya lo gestiona por capas).
  - [Baja][Fácil] Enlace `#drill=` como el de Pitchboard, **pero comprimido** y validado al abrir.
  - Ver «Lo que NO deberíamos copiar».
- **Fuentes**: https://github.com/lc85/hockey-drill-board ; raw `README.md`, `app.js` (L1–60, 837–872, 1347–1360, 2177–2296, 2394–2500, 1657–1722).

---

### Tactics board futsal (gljubojevic) — https://github.com/gljubojevic/tactics-board — fútbol sala — open-source (React + Firebase, 2026-02)
- **Qué es**: clon declarado de tactical-board.com para fútbol sala; **SVG generado en cliente** con unidades de **1 cm** y editor de elementos (fichas, conos, porterías, escaleras, líneas con control, elipses, textos). Firebase para guardar/compartir/colaborar.
- **Animación (EVIDENCIA, `AnimKeyFrame.js`)**: un fotograma clave = `{players[], playerPaths[], balls[], ballPaths[]}` con `save()/load()` a JSON y **pre-cálculo de splines** una vez (`animPreCalcSplines`); cada línea (`Line{p1,p2,c1,c2,arrowStart,arrowEnd,dashed}`) se parte en **3 cúbicas** y el progreso se reparte en tercios (`splinePathPos`: `scale = pos·3`, `idx = floor(scale)`, `t = scale − idx`) — es **parametrización uniforme por segmento, no por longitud de arco**: si los tres tramos tienen longitudes distintas, la velocidad varía (DEDUCCIÓN).
- **Modelo de datos**: JSON de parámetros editable (no sólo imagen); PNG por descarga.
- **Ideas aplicables**: [Baja][Fácil] pre-calcular la tabla de muestreo al cargar la fase y no en cada fotograma (ya lo hace `makeSampler` por tramo; comprobar que se cachea por fase y no se rehace por fotograma).
- **Fuentes**: https://github.com/gljubojevic/tactics-board ; raw `README.md`, `src/pitch/AnimKeyFrame.js`.

---

### PlayWrite — https://github.com/Sam-Briney/PlayWrite — baloncesto — open-source (MIT, 2025; NW.js + jQuery)
- **Qué es**: software de dibujo de jugadas de baloncesto, antes propietario (CoachesBrain), liberado; de escritorio con NW.js, jQuery 1.10, **jsPDF** y **gifshot** (GIF). Código de 2013–15, valor histórico.
- **Cómo funciona (EVIDENCIA parcial)**: `project{frames[], players[], path, title}`; cada fotograma tiene `full_court`, `outside_lines`, `line_arr[{type…}]`; fotogramas **reordenables con multi-selección** (`jquery.multisortable`, campo `order`); lista de **jugadores del proyecto** con importación (BSON) que detecta duplicados por id/nombre/número; **deshacer con `global.actions`** (objetos `construct.action{type, …}`); PDF (`pdf.js`): **1 fotograma por página** o varios, modo «apto impresión», `selection_only` para exportar sólo los fotogramas seleccionados; modo presentación.
- **Ideas aplicables**: [Baja][Medio] PDF de «sólo los seleccionados» y de varios diagramas por hoja (si nuestro PDF de sesión no lo permite); [Baja][Fácil] importación de jugadores con detección de duplicados.
- **Fuentes**: https://github.com/Sam-Briney/PlayWrite ; raw `README.md`, `node_modules/code/frame.js`, `players.js`, `pdf.js` (el repo trae su propio código bajo `node_modules/code/`).

---

### Otros repos localizados (no analizados por dentro)
- **Open Handball Tactics** (https://github.com/estevE11/open-handball-tactics, MIT): según su README (WebFetch): React 19 + Zustand, **motor táctico SVG nativo** con trayectorias Bézier editables, **pasos clave editables con «onion skinning» del paso anterior**, deshacer/rehacer acotado, autoguardado con estados pendiente/error y reintento, **biblioteca con carpetas anidadas, búsqueda, etiquetas y notas**, IndexedDB con tablas `projects/folders/assets`, exporta `.hbd` (con recursos) y PNG/SVG. *No verificado por dentro* (no pude leer código por límite de la API de GitHub); su descripción coincide con lo que buscamos para la biblioteca.
- **SportTactic** (https://github.com/sporttactic/sporttactic.github.io): balonmano, **HTML/CSS/JS puro + IndexedDB**, tablero con línea de tiempo multi-fotograma, «imán» de balón con detección de pase/tiro/parada, grabación a WebM. README leído; código no.
- **Playmaker** (MilosLord/playmaker, baloncesto) y **Coachable** (EricIshekwene/coachable, Konva+React): sólo descripciones de buscador; **NO VERIFICADO** (la ruta raw devolvió 404, posiblemente privado o renombrado). Según el snippet, Playmaker modela la jugada como «formación inicial + pasos con acciones en paralelo (pantalla, corte, pase, rodar, tiro) que compilan a una línea de tiempo muestreable»; si es cierto, convendría revisarlo manualmente.
- **tacticalboard/tacticalboard** (Vue + two.js, MIT, 2022, 17 estrellas), **marwanemhl/futsal-tactics** (rAF + interpolación, coordenadas lógicas 1000×600), **estevE11**, **k1-tactics-board**, **kayhardam/coachboard**, **ssbreon/Playboard** (fútbol americano, repo con mucho andamiaje Azure): sólo listados.
- **Yuge-U/basketball-tactics-board**: PWA de baloncesto (app.js de 338 KB, sincroniza con OneDrive vía MSAL, carpetas `U12/U15 × BLOB/SLOB/Offense/Defense/Practice` para los JSON): sólo árbol de ficheros, no leí el código. La **estructura de carpetas por categoría/formato de jugada** es una referencia de taxonomía.

---

# PARTE 2 — Software genérico (pizarra, diagramas, animación)

### Excalidraw — https://github.com/excalidraw/excalidraw — genérico — open-source (MIT, conocido; no re-verificado en esta pasada)
- **Qué es y para quién**: pizarra vectorial de estilo «a mano» con colaboración en tiempo real; embebible como componente React.
- **Cómo se crea**: herramientas de forma/flecha/texto/mano alzada; **flechas enlazadas a formas** (`startBinding`/`endBinding` con `elementId`, `fixedPoint` como razón 0–1 dentro del elemento y `mode`) — la flecha sigue al objeto; bibliotecas `.excalidrawlib` de elementos reutilizables; marcos (`frame`).
- **Cómo se representa**: canvas con rough.js; `seed` por elemento para que el trazo «a mano» sea idéntico en cada pintado (determinismo).
- **Modelo de datos (EVIDENCIA, `types.ts`, `json.ts`)**: archivo `.excalidraw` = `{type:"excalidraw", version:2, source, elements[], appState{…limpiado}, files{}}`. Cada elemento: `id,x,y,width,height,angle,strokeColor,backgroundColor,strokeStyle,strokeWidth,opacity,roundness,seed,**version**,**versionNonce**,**index**(FractionalIndex),isDeleted,groupIds[],frameId,boundElements[],updated,created,link,locked,customData`. `customData` = hueco oficial para datos propios.
- **Historial/colaboración (EVIDENCIA, `store.ts`, `delta.ts`, `reconcile.ts`)**: `Store` emite incrementos; `CaptureUpdateAction.IMMEDIATELY` (deshacible ya), `NEVER` (remoto/inicial) y `EVENTUALLY` (se captura más tarde: arrastres y redimensionados); historial por **deltas invertibles** (`ElementsDelta.inverse()/applyTo()/squash()`). Conciliación remota: gana el de mayor `version`; si empatan, el de **menor `versionNonce`**; no se pisa lo que el usuario local está editando; orden por **índice fraccionario** (rocicorp) para que reordenar no reescriba el resto; borrados como *tombstones* (`isDeleted`).
- **Biblioteca**: bibliotecas de elementos y enlaces con cifrado extremo a extremo (`encryption.ts`) para colaboración (no analizado).
- **Puntos fuertes / débiles**: + ejemplo canónico de formato abierto con campos de versionado; − pensado para lienzo infinito y sin semántica de tiempo ni de dominio.
- **Ideas aplicables**:
  - [Alta][Fácil] **Sobre del archivo de exportación** `{type:'cbp-ejercicio', version, source, …}` + función `migrar()` anterior a validar (como Pitchboard `migrate.ts`): importar/exportar JSON de ejercicios entre dispositivos o entre versiones de la app.
  - [Media][Fácil] **Tres modos de captura de historial** (inmediato/nunca/eventual) en una función `commit({captura})`: arrastres y previsualizaciones no ensucian el historial.
  - [Baja][Difícil] `version`+`versionNonce` por registro e índices fraccionarios, sólo si algún día hay **edición simultánea** de un mismo ejercicio por dos entrenadores (hoy no).
  - [Media][Medio] Ancla `fixedPoint` (razón dentro de la ficha) para flechas ligadas a otra ficha (nuestro `anclas.js` ya liga; revisar si guarda razón o punto absoluto).
- **Fuentes**: https://github.com/excalidraw/excalidraw ; raw `packages/element/src/types.ts`, `store.ts`, `delta.ts`; `packages/excalidraw/data/json.ts`, `reconcile.ts`, `types.ts`.

---

### tldraw — https://github.com/tldraw/tldraw — genérico — **licencia propia con clave** (no open-source clásico)
- **Qué es**: SDK de lienzo infinito (React) con un **store de registros reactivo** (signals). *EVIDENCIA licencia*: `LICENSE.md` permite desarrollo, modificación e inclusión; la **producción** requiere clave de licencia («License Key controls functionality»); hay licencias alternativas de pago.
- **Modelo (EVIDENCIA, `Store.ts`, `TLPage.ts`, `TLCamera.ts`)**: todo es un **registro** `{id:"tipo:uuid", typeName, …}` en un mapa; cada tipo declara `scope`: `document` (persistente: páginas, formas), `session` (por usuario/pestaña: cámara `{x,y,z}`, instancia) o `presence` (cursores). `store.serialize('document')`, `getStoreSnapshot()` que **incluye el esquema** para migrar al cargar, `loadStoreSnapshot()`. Cambios como `RecordsDiff {added, updated, removed}` con `listen({source:'user'|'remote', scope})`; `createComputedCache` para derivados.
- **Historial (EVIDENCIA, `HistoryManager.ts`)**: pila de `diff`s y de **marcas** (`mark(id)`, `bailToMark(id)` = cancelar el gesto, `squashToMark(id)` = fusionar todo el gesto en un paso), `batch(fn,{history:'record'|'ignore'})`.
- **Snapping (EVIDENCIA, `SnapManager`/`BoundsSnaps.ts`)**: umbral `snapThreshold / zoom` (constante en píxeles de pantalla); snaps de borde/centro y **de hueco** (`gap_center`, `gap_duplicate`: igualar separaciones entre elementos) con deduplicación visual.
- **Ideas aplicables**:
  - [Media][Fácil] **Separar «documento» de «sesión/vista»** (cámara, selección, panel abierto): ya lo hace nuestro `memoria.js` (`cbp_pizarra_encuadre`), confirma el criterio.
  - [Media][Fácil] **Umbral de imán en píxeles/zoom** en vez de metros fijos: nuestro `RADIO_IMAN = 0.60` (unidades de pista, DEDUCCIÓN) sale distinto en pantalla según el zoom 50–400 %; con `radioPx / escala` se siente igual con cualquier zoom.
  - [Baja][Medio] **Snaps de hueco** (igualar separación entre fichas) para colocar formaciones: «línea de 3 equidistantes».
  - [Baja][Difícil] No adoptar tldraw (licencia, tamaño, no es táctico).
- **Fuentes**: https://github.com/tldraw/tldraw ; raw `LICENSE.md`, `packages/store/src/lib/Store.ts`, `packages/tlschema/src/records/TLPage.ts`, `TLCamera.ts`, `packages/editor/src/lib/editor/managers/HistoryManager/HistoryManager.ts`, `SnapManager/BoundsSnaps.ts`.

---

### draw.io / diagrams.net — https://github.com/jgraph/drawio — genérico — open-source (Apache-2.0; las librerías de iconos tienen restricciones)
- **Qué es**: editor de diagramas (mxGraph). El repo no acepta PR; sin colaboración en tiempo real en esta versión (README).
- **Formato (EVIDENCIA, `blog/animations.drawio` de `drawio-diagrams`)**: `<mxfile><diagram name id><mxGraphModel dx dy grid gridSize guides … pageWidth pageHeight><root><mxCell id="0"/><mxCell id="1" parent="0"/>…`. **Lista plana de celdas** con `parent`, `vertex="1"`/`edge="1"` y `source`/`target`; **estilo como cadena** `clave=valor;` (`edgeStyle=orthogonalEdgeStyle;curved=1;endArrow=classic;dashed=1;strokeColor=#FF0000;flowAnimation=1;`) y `<mxGeometry x y width height as="geometry"/>`; **varias páginas** en un fichero (`pages="3"`). Datos extra con `UserObject`/`object` (atributos propios).
- **Animación (EVIDENCIA)**: atributo `animation` con JSON `{"animation":{"steps":[{"fadeOut":{"cells":["*"],"delay":300}},{"fadeIn":{"cells":[ids…],"delay":300}}…],"loop":false}}` — es una **secuencia de pasos de aparecer/desaparecer por conjuntos de celdas**, más `flowAnimation=1` en estilo (guiones que «circulan» por la arista). En el ejemplo: 10 aristas con `flowAnimation=0` y 6 con `=1`, 31 `curved=1`, 41 `orthogonalEdgeStyle`.
- **Puntos fuertes / débiles**: + modelo universal y estable; **flujo animado de líneas** muy legible; − el estilo en cadena no se valida; la animación sólo muestra/oculta; no hay semántica de movimiento.
- **Ideas aplicables**:
  - [Media][Fácil] **«Hormigas marchando»** (`stroke-dashoffset` animado) sobre la flecha de pase/corte activa durante la reproducción o al seleccionarla: indica dirección y estado sin añadir símbolos; en canvas, `ctx.lineDashOffset = -t*velocidad`.
  - [Baja][Fácil] Aparición escalonada de anotaciones (`fadeIn` con retardo) para «ir contando» la jugada en modo explicación.
  - No copiar el estilo-en-cadena ni el XML.
- **Fuentes**: https://github.com/jgraph/drawio ; https://github.com/jgraph/drawio-diagrams (`blog/animations.drawio`, rama `dev`).

---

### Konva, Fabric.js, Paper.js, SVG.js — serialización de escenas, animación y trayectorias — genérico — open-source (MIT, conocido)
- **Konva** (canvas por capas): escena = JSON `{"attrs":{…},"className":"Stage","children":[{"attrs":{},"className":"Layer","children":[{"attrs":{x,y,sides,radius,fill},"className":"RegularPolygon"}]}]}`; `Konva.Node.create(json,'contenedor')` reconstruye; **no serializa** manejadores de eventos, imágenes ni funciones/ formas propias (hay que volver a enlazarlos); recomendación oficial **3–5 capas como máximo** y separar contenido estático del animado; `toDataURL({mimeType,quality})` exporta (error de seguridad con imágenes de otro dominio). *EVIDENCIA (docs)*.
- **Fabric.js**: `canvas.toObject()/toJSON()`, `loadFromJSON`, `toSVG` (conversión bidireccional con SVG), `toDatalessJSON` (referencia a SVG externo en vez de los caminos completos), propiedades propias con `toObject` extendido o `stateProperties`. *EVIDENCIA (docs v1 «intro part 3»)*.
- **Paper.js**: `Path.getPointAt(offset)`, `getTangentAt`, `getNormalAt`, `getLocationAt`, `getOffsetOf(punto)`; **`smooth({type:'continuous'|'asymmetric'|'catmull-rom'|'geometric'})`** ajusta los manejadores; **`simplify(tolerancia)`** ajusta pocas curvas Bézier a una nube de puntos (para mano alzada); `flatten(error)`; `exportJSON/exportSVG`. *EVIDENCIA (docs)*.
- **SVG.js**: modelo **Runner + Timeline** (`animate(duración, retraso, cuándo)` con modos `'after'|'with-last'|'now'|'absolute'`; ease `'<>'`, `'<'`, `'>'`, `'-'`; `timeline.seek/speed/reverse`; interpolación afín de transformaciones; controladores `Spring` y `PID`). *EVIDENCIA (docs)*.
- **Valoración**: todos serializan **la vista**, mezclando datos del dominio con atributos de dibujo. Para nosotros el documento del ejercicio debe seguir siendo **datos de dominio** (como ya es) y el dibujo, una función. Adoptar cualquiera de ellos añadiría una capa de persistencia y de eventos que ya tenemos (`lienzo.js`, hit-test, capas).
- **Ideas aplicables**:
  - [Media][Fácil] De Konva: **separar capa estática (pista, marcas) de dinámica (fichas, trayectorias)** y volver a pintar sólo la dinámica durante la reproducción. Nuestro `lienzo.capa(..., {orden})` ya apunta ahí; comprobar si la pista se repinta en cada fotograma o se cachea en un canvas fuera de pantalla (`drawImage`). Coste de una caché de pista: Fácil; ahorro: apreciable en tablet.
  - [Media][Medio] De Paper: modo **«suavizar por los puntos»** (`catmull-rom`/`geometric`) como alternativa a manejadores manuales: el entrenador marca 3–4 puntos y la curva sale bien. Ver Catmull-Rom abajo.
  - [Baja][Fácil] De SVG.js: modos de programación **`after / with-last / absolute`** como vocabulario de nuestros carriles («empieza con la anterior», «después de la anterior», «en el segundo 1,5»).
- **Fuentes**: https://konvajs.org/docs/data_and_serialization/Complex_Load.html ; https://konvajs.org/docs/performance/Layer_Management.html ; https://konvajs.org/docs/data_and_serialization/Stage_Data_URL.html ; https://fabricjs.com/docs/old-docs/fabric-intro-part-3/ ; https://paperjs.org/reference/path/ ; https://svgjs.dev/docs/3.2/animating/

---

### Librerías y formatos de animación por keyframes — GSAP, Motion/Popmotion, Theatre.js, Lottie, Rive — genérico
- **GSAP** (timelines): **parámetro de posición**: número absoluto, etiqueta (`"pase"`), `"<"` (inicio del anterior), `">"` (final del anterior), `"+=1"` (hueco), `"-=0.5"` (solape), `"etiqueta+=2"`, porcentajes; `addPause`, `seek`, `progress`, `timeScale`, `reverse`. *EVIDENCIA (docs)*. Licencia: no verificada en esta pasada.
- **Motion (antes Framer Motion/Popmotion)**: secuencias `[elemento, keyframes, opciones]` con `at` absoluto/relativo/etiqueta; **no verificado** (la página de docs devolvió 404).
- **Theatre.js**: jerarquía **Proyecto → Hoja → Objeto → Secuencia → Pistas → Keyframes**; keyframes con función de tiempo bézier cúbica; «aggregate keyframes»; editor «Studio» frente al «Core» programático; el estado se guarda en JSON propio. *EVIDENCIA (docs de secuencias)*; detalle del JSON y licencia no verificados.
- **Lottie (EVIDENCIA, lottie-docs)**: propiedad animada = `{a:0|1, k:valor|[keyframes]}`; keyframe `{t:tiempo(fotograma), s:valor inicial, i:{x,y}, o:{x,y}, h?:1}`: `o` y `i` son las **asas de una cúbica de easing** entre (0,0) y (1,1) **por tramo** (x = tiempo normalizado, y = factor de interpolación; en propiedades multidimensionales, una por dimensión); `h:1` = **hold** (mantener hasta el siguiente); los Lottie viejos llevan además `e` (valor final) y un keyframe final sólo con `t`. Para posición hay **tangentes espaciales** (`to/ti`) que curvan el camino (esquema Lottie; no re-verificado en esta pasada). Composición con `fr` (fotogramas/s), `ip/op` (entrada/salida).
- **Rive (EVIDENCIA, docs)**: ficheros `.riv` **binarios** con **máquinas de estados** (entradas booleana/numérica/disparador); pensado para micro-interacciones de UI; no encaja con datos editables de ejercicios.
- **Valoración**: el **vocabulario** es útil; las librerías no. Una librería imperativa (GSAP/Motion) crea el movimiento «dentro» del DOM y no se deja evaluar en Node ni renderizar fotograma a fotograma para exportar; Lottie y Rive son **formatos de reproducción**, no modelos de edición.
- **Ideas aplicables**:
  - [Media][Fácil] **Easing por tramo como `cubic-bezier(x1,y1,x2,y2)`** en lugar de una lista fija: se resuelve con Newton–Raphson (unas 25 líneas, sin dependencias) y permite «seco» para pases y «arranque lento» para sprints; encaja con el `hermite(m0,m1)` de Pitchboard (dos formas de lo mismo: pendientes o asas).
  - [Media][Fácil] **«Hold» (mantener)** y `instant` (Training Ground) como easings válidos: apariciones/teleports de material sin interpolar.
  - [Media][Fácil] **Etiquetas con nombre en la línea de tiempo** («pase», «tiro») para anclar otras acciones a ellas (equivale a `atMarker` de soccer-tactics y a las etiquetas de GSAP). Si ya tenemos disparadores por evento, las etiquetas son la versión visible.
  - [Baja][Medio] Editor de curva de easing por clic derecho en un bloque (a lo Theatre): sólo si el entrenador lo pide; hoy sobra.
- **Fuentes**: https://gsap.com/resources/position-parameter/ ; https://www.theatrejs.com/docs/latest/manual/sequences ; https://github.com/LottieFiles/lottie-docs (`docs/properties.md`) ; https://rive.app/docs/runtimes/state-machines

---

### SVG SMIL, CSS `offset-path`, WAAPI y `getPointAtLength` — trayectorias nativas — web estándar
- **SMIL `<animateMotion>` (EVIDENCIA, MDN)**: atributos `path`, `keyPoints`/`keyTimes`, `rotate` (`auto`, `auto-reverse`), `calcMode` (por defecto `paced` = velocidad constante), hijo `<mpath>` para reutilizar un `<path>`; «Baseline: ampliamente disponible» desde enero de 2020, sin aviso de obsolescencia. Control desde JS: `setCurrentTime/pauseAnimations` (conocido; no re-verificado aquí).
- **CSS `offset-path`/`offset-distance`/`offset-rotate` (EVIDENCIA, MDN)**: `offset-path: path("M…")` o `url(#id)`; se anima `offset-distance` de 0 % a 100 %; `offset-rotate` orienta la ficha; Baseline desde marzo de 2022; crea contexto de apilamiento; sólo elementos transformables.
- **`getPointAtLength(d)`/`getTotalLength()` (EVIDENCIA, MDN)**: devuelven `DOMPoint` a la distancia `d` del trazo; Baseline desde 2020. MDN no documenta coste ni precisión en curvas (hay que medirlo).
- **Valoración (DEDUCCIÓN)**:
  - Para el **editor** (arrastrar la barra de tiempo, velocidad variable, pausar en cualquier instante, exportar GIF/vídeo, probar en Node) **gana el reloj propio + función pura** que ya tenemos. SMIL/WAAPI/`offset-path` dan movimiento «gratis» pero sin ease por fase coordinado con el resto, sin salida a vídeo y sin pruebas headless.
  - Para el **visor ligero** (tarjeta de biblioteca que se mueve al pasar el ratón, enlace público de sólo lectura, incrustación en la web del club) **`offset-path` + `@keyframes` o SMIL** serían una opción barata: se genera un `<svg>` estático con un `<animateMotion>` por ficha y listo, sin JS; el coste es mantener dos motores, y dos motores acaban discrepando (justo lo que `instante.js` documenta que quiso evitar).
  - `getPointAtLength` evitaría escribir `makeSampler`, pero obliga a tener nodos DOM (rompe el banco en Node) y a recrear un `<path>` por trayecto; nuestro muestreador puro es mejor para el banco `eval-*.mjs`.
- **Ideas aplicables**: [Baja][Medio] visor SVG con SMIL para miniaturas animadas en la biblioteca, **sólo si** se acepta el coste de dos motores. [Media][Fácil] respetar `prefers-reduced-motion` (ver Accesibilidad).
- **Fuentes**: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/animateMotion ; https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path ; https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getPointAtLength

---

### Suavizado de curvas — Catmull-Rom y Bézier (técnica)
- **Qué hay en la práctica (EVIDENCIA)**: Training Ground interpola con **Catmull-Rom uniforme** (fórmula con 4 puntos y coeficientes `0.5·(2p1 + (−p0+p2)t + (2p0−5p1+4p2−p3)t² + (−p0+3p1−3p2+p3)t³)`) y elige el segmento por longitud de cuerda; Pitchboard y nosotros usamos **Bézier cúbica con manejadores** + tabla de longitud de arco; Coach Tools usa **una cuadrática con un solo punto de control**; Paper.js ofrece `smooth('catmull-rom')` convirtiendo a manejadores Bézier.
- **Conversión Catmull-Rom → Bézier (fórmula, DEDUCCIÓN/estándar)**: para el tramo `p1→p2` con vecinos `p0,p3`: `c1 = p1 + (p2 − p0)/6`, `c2 = p2 − (p3 − p1)/6` (uniforme, tensión 0,5). Esto permite **generar los `handle_in/handle_out` de nuestros nodos automáticamente** y seguir usando `flattenPath` y `makeSampler` sin tocar el motor.
- **Variantes**: uniforme (más simple; puede «formar bucles» si los puntos están muy desiguales), **centrípeta** (α = 0,5; evita bucles y cúspides, recomendable para puntos tomados por clic), cordal (α = 1).
- **Ideas aplicables**: [Media][Fácil] botón/gesto **«suavizar»** que convierte una poli-línea en curva con manejadores calculados por Catmull-Rom centrípeta; nuestro `manejadoresTangentes` ya calcula tangentes por nodo con un tercio del segmento vecino (equivalente a Catmull-Rom uniforme con tensión 1/3), así que el coste real es una opción de UI. [Baja][Fácil] mantener **recto** como modo explícito (Training Ground `pathMode`) para pases.
- **Fuentes**: `src/model/tween.ts` (Training Ground); https://paperjs.org/reference/path/ ; nuestro `taller/js/canvas/geometry.js`.

---

### Imán / magnetismo (snapping) — técnica
- **Casos reales**: tldraw (umbral en píxeles dividido por zoom; snaps de borde/centro y de hueco); Pitchboard (cada eje se ajusta por separado a marcas de la pista, a otros textos y al centro del encuadre; **⌘/Ctrl lo desactiva** mientras se arrastra); Training Ground (puntas de flecha se ajustan a fichas/balón y se recortan al borde de la ficha); Coach Tools (rejilla de 0,5 pies); soccer-tactics (imán de bloques en la línea de tiempo).
- **Nosotros**: `pizarra/iman.js` con `RADIO_IMAN = 0.60`, `puntosDeIman` y `imantar` (puntos de pista y anclas de la ficha).
- **Ideas**: [Media][Fácil] atajo/gesto para **soltar sin imán** (Ctrl o mantener pulsado) **y mostrarlo en pantalla** (guías); [Media][Fácil] radio en píxeles/zoom; [Baja][Medio] imán a **posiciones estándar de baloncesto** (bloque alto, ala, esquina, punta de la zona, línea de tiro libre) con etiqueta («esquina derecha»). Esto último ya parece cubierto por `nombreDeAncla` (DEDUCCIÓN).

---

### Gestos táctiles (pan / zoom / pinza) — técnica
- **MDN (EVIDENCIA)**: patrón de pinza con **Pointer Events**: caché de punteros activos en `pointerdown`, actualizar en `pointermove`, medir la distancia con `Math.hypot` entre los dos y compararla con la anterior; limpiar en `pointerup/cancel/out/leave`; `touch-action: none` para que el navegador no robe los gestos; sin él, el navegador dispara `pointercancel` cuando decide hacer scroll/zoom. **Aviso de MDN**: `touch-action: none` puede impedir el zoom del navegador a personas con baja visión → conservar zoom propio (nosotros: botones y 50–400 %).
- **Repos**: Pitchboard y Training Ground gestionan la rueda con `{passive:false}`: **pinza de trackpad = rueda con `ctrlKey`**; zoom hacia el puntero (`BoardViewport`: rueda, botón central o Alt+arrastre para panear). Ninguno resuelve la pinza de dos dedos en pantalla táctil en el código que leí (el de Pitchboard sólo aparece como «rueda»); es un hueco real que ya tendremos que cubrir con una tablet.
- **Nosotros**: `gestos.js` (umbrales por `pointerType`, agarre de dedo 22 px, `reducir(estado, ev)` como máquina pura) y `lienzo.js` con `setPointerCapture`; los comentarios hablan de «tableta de verdad: pendiente de probar» en `PROGRESO-PIZARRA.md`.
- **Ideas**: [Alta][Medio] **pinza de dos dedos + arrastre de dos dedos para panear**, implementados en la misma máquina pura `reducir` (estado `pinza{p1,p2,distInicial,centroInicial}`), con **cancelación del gesto de un dedo** cuando aparece el segundo (un dedo ya iniciado debe anularse sin dejar una flecha a medias); verificable en Node alimentando eventos sintéticos. [Media][Fácil] pantalla de «gesto cancelado» limpia ante `pointercancel`.
- **Fuentes**: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures ; https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action ; Pitchboard `BoardCanvas.tsx` (L528–555); Training Ground `BoardViewport.tsx`.

---

### Accesibilidad en lienzos — técnica
- **Normativa y guías consultadas (EVIDENCIA)**:
  - **WCAG 2.2 SC 2.5.7 Dragging Movements**: toda función de arrastre debe poder hacerse con un puntero **sin arrastrar** (clic/toque), salvo que arrastrar sea esencial; técnica G219. Nuestro menú circular + «destino por toque» (`destino.js`) apunta a esto (DEDUCCIÓN: habría que comprobar que mover una ficha no exige arrastre).
  - **ARIA Graphics Module**: `graphics-document` (el diagrama), `graphics-object` (partes con significado propio), `graphics-symbol` (iconos atómicos); exige nombre accesible (`aria-label`/`aria-labelledby`); `role="none"`/`presentation` para excluir decoración; `aria-roledescription`.
  - **`prefers-reduced-motion`** (MDN): el movimiento esencial se mantiene (aquí la animación **es** el contenido) pero se simplifica el decorativo (fundidos, destellos, hormigas marchando); `matchMedia(...).addEventListener('change')` para reaccionar. soccer-tactics añade un **interruptor en la app** además de la preferencia del sistema.
- **Realidad en los repos**: ninguno de los repos deportivos ofrece accesibilidad real del lienzo; el único con intención escrita es soccer-tactics (SVG por `role/aria`, foco) y Pitchboard (menús con teclado, `describe.ts` sólo para historial). Excalidraw/tldraw tienen soporte parcial por teclado (no auditado aquí).
- **Nosotros (DEDUCCIÓN)**: el tablero es **canvas 2D** (`lienzo.capa(...)`), invisible para lectores de pantalla; el anillo/tarjetas sí tienen `role="dialog"` y `aria-label` (28 coincidencias de `role/aria/tabindex` en `taller/js/pizarra` y `canvas`).
- **Ideas aplicables**:
  - [Alta][Medio] **Espejo DOM del tablero**: una lista oculta visualmente (`<ul role="list">` con una fila por ficha: «Atacante 3, en la esquina derecha, tiene el balón») que se actualiza con la fase y sirve de foco/teclado para seleccionar fichas; es el patrón estándar para canvas.
  - [Media][Fácil] **Reutilizar la «frase» del motor** (`motor/frase.js`, que ya describe la jugada con palabras) como descripción accesible (`aria-describedby` / `aria-live="polite"` al cambiar de fase).
  - [Media][Fácil] Interruptor «Reducir movimiento» (preferencia del sistema + ajuste propio) que quita el destello y fundidos pero deja la animación de las fichas.
  - [Media][Medio] **Teclado**: Tab entre fichas, flechas para empujar 10 cm (Mayús = 1 m), Enter abre el anillo, Esc cancela; con `Alt+←/→` para reordenar fases (patrón de Training Ground).
  - [Media][Fácil] Contraste y **no depender sólo del color** (atacante/defensa por forma o número además de color) para daltonismo.
- **Fuentes**: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html ; https://www.w3.org/TR/graphics-aria-1.0/ ; https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion ; soccer-tactics `ADR-0006`.

---

# Patrones y decisiones de diseño detectados

Ordenados por valor para nuestra Pizarra; cada uno con cómo se aplicaría con SVG/canvas + JS puro y el coste.

| # | Patrón | Evidencia | Cómo aplicarlo en vanilla | Valor / Coste |
|---|---|---|---|---|
| 1 | **Edición que se propaga a fases siguientes** que sólo copiaban esa ficha (D41) | Pitchboard | Al terminar un arrastre en la fase *k*: para *j>k*, si la ficha no «viaja» hacia la fase *j* (sin trayecto propio) y su posición en *j* era igual a la de *j−1* antes de editar, sumarle el mismo delta; parar en la primera fase donde la ficha tiene acción. Modo («aquí / hasta el próximo cambio / todas») elegido al agarrar y mostrado en la UI. Función pura `propagar(ejercicio, idFicha, delta, desdeFase, modo)` + banco | Alta / Medio |
| 2 | **Variantes como deltas** sobre la fase base | coaching-animator | Rama = `{base: faseId, cambios:[{tipo:'ponerFicha'|'quitar'|'mover'|'poner pase'…}]}`; `resolverRama(ejercicio, rama)` produce la fase completa. Necesita decidir con el entrenador; hoy las ramas son copias | Alta / Medio–Difícil |
| 3 | **Ease con pendientes (Hermite) / «corre a través»** | Pitchboard D14 | `hermite(u,m0,m1)` + marcar en el tramo si la ficha continúa en la fase siguiente; colocar por TIEMPO global; opción «modo flujo» | Alta / Medio |
| 4 | **Disparadores por evento** («cuando reciba», «al llegar a»). Resolver por orden topológico; ciclo = error | soccer-tactics, coaching-animator | `compilar()` ya existe: añadir campo `despues:{ficha|pase|marca}` y `delay`; calcular `t0` absoluto con DFS y detección de ciclo | Alta / Medio |
| 5 | **`validar()` de dominio** + «no se anima lo inválido» + estado `verificado/provisional` | oche0809, Training Ground, coaching-animator | Módulo puro `validar.js` (devuelve lista de `{codigo, mensaje, donde}`) usado por editor, importación y `eval-validar.mjs`; chip en la biblioteca | Alta / Fácil |
| 6 | **Acciones con destinatario** (`screen for`) y **opciones que no mueven balón** | oche0809 | Campos `para` en bloqueo y tipo `opcion` en pase (línea punteada, sin cambiar posesión); también alimenta la frase y el modo «yo» | Alta / Fácil |
| 7 | **Sobre de archivo versionado** `{type, version, source, …}` + `migrar()` antes de validar; «campo ausente = comportamiento anterior» | Excalidraw, Pitchboard | `exportarEjercicio()`/`importarEjercicio(json)` con `migrar` por salto de versión; campos nuevos siempre opcionales | Alta / Fácil |
| 8 | **Historial fusionado por gesto, con Esc que cancela y lista nombrada** | Pitchboard, tldraw, soccer-tactics, Excalidraw | `History.push(clave)`: si `clave` igual a la anterior, sustituir el tope; `commit({captura:'inmediata'|'nunca'|'eventual'})`; `describir(antes,después)` por comparación | Media / Fácil |
| 9 | **Exportar GIF/MP4/PNG con el mismo renderizador** fuera de pantalla | Pitchboard, Training Ground | Bucle `for (t=0; t<dur; t+=1/fps) { fotograma(t); ctx.drawImage…; encoder.add(canvas) }`; GIF con `gifenc`; MP4 con WebCodecs si existe, si no WebM con `MediaRecorder` o sólo GIF | Media / Medio |
| 10 | **Enlace congelado `#d=…`** (deflate-raw + base64url) | Pitchboard | `new CompressionStream('deflate-raw')` sobre el JSON; abrir en visor de sólo lectura con «Guardar copia»; aviso si supera N caracteres | Media / Fácil |
| 11 | **Modo «yo» (foco)** | oche0809 | `ctx.globalAlpha` 1/0,75/0,2 según relación con la ficha elegida; en el visor del jugador | Media / Fácil |
| 12 | **Duración derivada de distancia y ritmo con nombre** | soccer-tactics, coaching-animator | Tabla `{andar:1.5, trote:3.5, rapido:5.5, esprint:8}` m/s y `dur = longitudArco/velocidad`; cuidado con tramos de longitud 0 (ya lo tratamos en `instante.js`) | Media / Fácil |
| 13 | **Hormigas marchando / fundido corto** en trazos activos | draw.io, Training Ground | `lineDashOffset` ligado al tiempo; fundido de 150 ms por rango de fase | Media / Fácil |
| 14 | **Imán en px/zoom + desactivar al vuelo + guías visibles** | tldraw, Pitchboard | `radio = RADIO_PX / escala`; Ctrl desactiva; pintar guía en la capa de edición | Media / Fácil |
| 15 | **Pinza de dos dedos** en la misma máquina de gestos | MDN, Pitchboard (rueda) | Estado `pinza` en `reducir()`; cancelar gesto de un dedo; pruebas con eventos sintéticos | Alta / Medio |
| 16 | **Espejo DOM accesible + frase como `aria-live`** | ARIA Graphics, WCAG 2.5.7 | Lista oculta sincronizada con la fase actual; `frase.js` ya existe | Alta / Medio |
| 17 | **Easing por tramo en cubic-bezier** | Lottie, Theatre | `bezierEase(x1,y1,x2,y2)(t)` con Newton–Raphson (4–8 iteraciones) | Media / Fácil |
| 18 | **Caché de pista (capa estática) fuera de pantalla** | Konva | Pintar pista una vez en `OffscreenCanvas`/canvas y `drawImage` por fotograma; invalidar con zoom/rotación | Media / Fácil |
| 19 | **«Links» dinámicos entre jugadores** (cadena/polígono con distancias) | Pitchboard | Lista `{miembros[], estilo}` evaluada por fotograma con posiciones interpoladas; etiquetas de metros en vertical | Baja / Medio |
| 20 | **Píldora de estado de guardado** | Coach Tools, Open Handball | Estado global `Guardado/Guardando/Sin guardar/Error` + reintento | Media / Fácil |

## Sobre lo que ya tenemos y no hay que rehacer
- Longitud de arco + Bézier con manejadores tangentes + RDP en mano alzada (`geometry.js`, `trazo.js`): a la altura de Pitchboard.
- Pila de deshacer por snapshots (50) y zoom/pan 50–400 % con memoria por ejercicio y pista (`memoria.js`).
- Máquina de gestos pura con umbrales por tipo de puntero y agarre de dedo.
- Banco de pruebas `eval-*.mjs` de módulos puros: es la práctica que los repos más serios (Pitchboard, Training Ground, oche0809) describen como su mayor seguro.

---

# Lo que NO deberíamos copiar

1. **Animación ficticia** (hockey-drill-board): una barra «Play Drill» que sólo hace parpadear el disco. Si la reproducción no mueve a quien se ve en el dibujo, desorienta; nuestro motor sí mueve.
2. **Nube pública sin autenticación** como «playbook» compartido (hockey-drill-board): cualquiera lee y sobrescribe. Para compartir usar enlaces congelados o Supabase con RLS.
3. **Serializar la vista** (Konva/Fabric `toJSON`, draw.io estilo en cadena): mezcla datos del ejercicio con atributos de dibujo, no valida y ata el dato al motor de dibujo. Mantener documento de dominio + función de dibujo.
4. **Estado de balón con coordenadas libres** además del portador (varios repos): provoca balones que «se quedan atrás» tras un pase; derivar del portador (patrón D44).
5. **Duraciones tecleadas a mano por paso** (Basketball Play Designer: 1–100 «velocidad» global; hockey `animDuration: 4.0`): dan jugadas rígidas; usar ritmo + distancia.
6. **Fotogramas completos como única verdad** (Basketball Play Designer, Coach Tools, gljubojevic, PlayWrite): corregir un jugador exige tocar todos los pasos y no se sabe qué era cambio y qué copia; es lo que D41 y las «progresiones como deltas» corrigen.
7. **Diálogos nativos `prompt()/confirm()`** (hockey-drill-board) en un editor táctil; en tablet son torpes y no se pueden estilizar.
8. **tldraw / Theatre Studio / GSAP / Konva como dependencias**: licencias (tldraw con clave de producción), tamaño, y motores imperativos que rompen el determinismo y las pruebas en Node. Sólo robar el vocabulario.
9. **Colaboración en tiempo real** (`versionNonce`, índices fraccionarios, cifrado E2E de Excalidraw): coste enorme para un caso que hoy no tenemos (un ejercicio lo edita un entrenador cada vez).
10. **Proceso desmesurado** (soccer-tactics: CHANGELOG de agente de ~348 KB, 60+ documentos): sus ADR son útiles; su volumen no. Mantener nuestro `PROGRESO-PIZARRA.md` conciso.
11. **Duplicar motores** (SMIL/`offset-path` para miniaturas y el motor propio para el editor): dos fuentes de verdad acaban discrepando; si algún día se hace un visor ligero, que lea el mismo `fotograma(t)`.
12. **Dato vendido como verificado sin serlo**: oche0809 marca explícitamente `provisional/verified:false`; copiar esa honestidad, no las coordenadas «imaginadas» de otros catálogos.

---

## Notas de verificación y límites de esta pasada
- La API de GitHub (60 peticiones/hora sin token) se agotó a mitad de la pasada; los repos tardíos (Playmaker, Coachable, Open Handball Tactics, SportTactic, Yuge-U) sólo se pudieron describir por README/buscador. Los 9 repos de las fichas completas se leyeron en `raw.githubusercontent.com` (archivos concretos).
- Excalidraw, tldraw, draw.io, Konva, Fabric, Paper.js, SVG.js, GSAP, Theatre, Lottie, Rive, MDN y W3C se consultaron por documentación o código fuente; las **licencias** de Excalidraw/Konva/Fabric/Paper/SVG.js/GSAP/Theatre se citan de memoria y **no** se han comprobado en esta pasada (la de tldraw y draw.io sí).
- No se hicieron capturas de pantalla: son repositorios de código, no sitios con interfaz pública relevante que justificara capturas.
- Fichero de salida: `D:/Claude Code/v2/cbp-v2/investigacion/fichas/D-motores-genericos-opensource.md`.
