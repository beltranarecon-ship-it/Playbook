# Playbook CBP · Especificación de la v2.1

Documento de trabajo acordado a partir del `Informe-cambios-v2.1.docx` (110 apartados
rellenados) y de trece rondas de entrevista. Lo que está aquí como CONFIRMADO no se
vuelve a abrir sin decisión explícita.

---

## 1 · Objetivo

Que planificar, dar y revisar un entrenamiento se haga entero dentro de la app, con
animaciones que salgan siempre correctas y con un seguimiento real de cada jugador.

Tres frentes, en palabras del entrenador:

1. Un motor de animación **por acciones** que genere siempre la jugada correcta, sin depender de la IA.
2. Un planificador de sesión completo, con estados de sesión, avisos y una curva de carga que sirva para algo.
3. Un panel de administrador y una generación automática de sesiones que funcione desde los horarios semanales.

**Criterio de éxito global:** «menos cosas, mejor acabadas». Cada cambio se comprueba
antes de darlo por bueno para no arruinar lo que ya funciona.

---

## 2 · La decisión que lo ordena todo: coste 0 €

La API de Anthropic se factura por tokens y es un producto **separado** de la
suscripción de Claude. No existen «tokens gratuitos» que la app pueda gastar. De ahí:

| Dónde se pedía IA | Qué se hace |
|---|---|
| Paso 2 · animación desde el texto | **Se elimina.** El paso 2 pasa a ser determinista: fases + catálogo de acciones |
| Paso 3 · ficha técnica | **Puente al chat.** La app arma el envío, el entrenador pega la respuesta y edita |
| Acta del partido | **Puente al chat.** Los nombres de los menores no salen a ningún tercero |
| Objetivos · panel de qué vigilar | Determinista, derivado de los objetivos y del vocabulario de acciones |

Consecuencias directas: se borra `netlify/functions/generar-animacion.js`, desaparece
la variable `ANTHROPIC_API_KEY` y el apartado 14.6 queda cerrado. El paso 2 funciona sin
conexión. **Netlify Functions sigue disponible** para dos usos que no cuestan dinero:
los avisos push y la clasificación de la federación.

---

## 3 · El vocabulario único

Es la idea que conecta los tres frentes. Una misma palabra —«bote con cambio de mano»,
«entrada», «defensa al hombre con balón»— es a la vez:

```
   acción ─┬─ pieza del catálogo del paso 2 (con su animación)
           ├─ etiqueta de un ejercicio (paso 3, generada por las acciones usadas)
           ├─ diana de un objetivo (de equipo o individual)
           └─ fila de la rúbrica de un jugador (en cuatro niveles)
```

Con eso la app puede decir: *«Sofía hace el cambio de mano sola pero se le cae con
defensor; estos cuatro ejercicios son el escalón siguiente»*.

**Salvedad confirmada:** la progresión no cabe entera en el vocabulario de acciones. La
rúbrica lleva dos familias de filas:

- **Acciones** — del vocabulario común, enlazadas con ejercicios y sugerencias.
- **Conductas** — actitud y esfuerzo · escucha y atención · autonomía y decisión ·
  compañerismo y competir. No se enlazan con ningún ejercicio.

Ambas se valoran en la misma escala de cuatro niveles: **no lo hace · lo hace con ayuda ·
lo hace solo · lo hace con oposición**. Es la misma idea de exigencia con la que ya están
clasificados los 204 ejercicios.

---

## 4 · Cambios respecto a la v2

| Área | Hoy | v2.1 |
|---|---|---|
| Paso 2 del Taller | Texto libre → modelo de IA → intención | Fases + clic sobre elementos + catálogo de acciones. Sin IA |
| Vocabulario del motor | 9 eventos fijos en código | Catálogo abierto sobre 5 familias; cualquier entrenador crea acciones |
| Filas de jugadores | La cola mengua; la animación va una vez | Se describe una ronda y se repite hasta vaciar la fila, con cadencia opcional |
| Pistas | 4 SVG estilizados, no a escala | 4 pistas a escala real con banda exterior de 2 m ✅ |
| Tamaño de elementos | Relativo al lienzo; distinto en pizarra, gif y proyector | En metros; jugador ~1,3 m, idéntico en las tres superficies |
| Posiciones con nombre | Anclas del motor visibles conceptualmente | Anclas invisibles + puntos propios del entrenador, por pista |
| Zonas | No existen | Líneas, rectángulos y círculos nombrables y referenciables |
| Ficha del paso 3 | 3 cajas de texto libre | La ficha completa del molde de la biblioteca, propuesta por el chat |
| Planificador | Una pantalla para todo | Dos: programar/editar y sesión activa |
| Estados de sesión | 4 | 5, con `activa` **deducida del reloj** |
| Carga | intensidad × duración | **Minutos activos por jugador**, según densidad y nº de jugadores |
| Progresión individual | No existe | Rúbrica de acciones + conductas, con evaluación por sesión |
| Objetivos | Cumplimiento autodeclarado en la reflexión | Medido por movimiento de la rúbrica. Se retira el autodeclarado |
| Partidos | Marcador, 5 valoraciones, foto del acta | Acta leída, reglamento comprobado, estadísticas, clasificación, convocatoria |
| Altas de entrenadores | A mano en el panel de Supabase | Lista de invitaciones + Google restringido a invitados |
| Avisos | Ninguno | Cronómetro en sesión + 5 avisos push |
| Navegación | Barra superior con 3 destinos | Barra fija (arriba en PC, abajo en móvil) + pantalla de inicio |

---

## 5 · Funcionalidades nuevas

### 5.1 · Catálogo de acciones

Una acción **se configura, no se dibuja**. Cinco familias:

| Familia | Qué resuelve el motor | Ejemplos |
|---|---|---|
| Desplazamiento | De donde está a un destino (posición, elemento, fila, aro), con trayectoria recta, curva o zigzag | se mueve, corte, sprint, rodea, pasos laterales, vuelve a la fila, puerta atrás, aclarado |
| Sobre el balón | Mueve el balón entre jugadores o al aro | pasa, tiro, entrada, suelta, recoge, rebote |
| Entre dos jugadores | Coloca a uno respecto del otro y dibuja el símbolo de la relación | bloqueo, defiende, ayuda, robo, corte de pase, superar al defensor |
| Gesto en el sitio | Sin desplazamiento neto | finta, eurostep, cambio de mano, pivote, salta |
| Simulación N vs M | Secuencia corta legible + cartel con el desenlace declarado | 1vs1, 2vs1, 2vs2, 3vs2 · gana ataque / gana defensa |

- Los parámetros son **relativos** («hacia el aro», «al siguiente cono»), nunca coordenadas.
- **Cualquier entrenador crea acciones y las ve todo el club.**
- Se crean desde la biblioteca (botón «crear acción») o desde el paso 2.
- Cada acción admite nombre, símbolo, descripción y vídeo de referencia.
- Durante la animación, el nombre de la acción en curso aparece dentro de la cancha, en sitio que no tape la jugada.

### 5.2 · Paso 2 nuevo

- Botón **agregar fase**. Cada fase: cabecera con sus ajustes (duración, pausa) y una línea de descripción.
- En la descripción, clic sobre un elemento ya colocado → su nombre se inserta destacado.
  Clic en el cono de una fila = la fila entera; clic en un jugador concreto de la fila = ese hace algo distinto.
- Clic en cualquier punto de la pista → se inserta «Posición X», renombrable y guardable.
- Barra de acciones sobre la descripción: al pulsarlas se escriben solas.
- Todo se puede escribir a mano y la app lo interpreta como acción, posición o elemento.
- Al dar intro o cambiar de fase, la animación de esa fase se genera automáticamente.
- En este paso **todas las zonas y elementos son visibles** y **los elementos no se mueven** (para eso está el paso 1).
- Volver atrás no pierde nada. Cambiar una posición inicial en el paso 1 rehace la fase 1, solo si ya había animación.
- Desplegable **Manualmente**: seleccionar una fase generada o crear una nueva y editar cualquier acción.
  Al tocar una flecha a mano, el cambio se guarda y lo siguiente continúa desde donde acaba ese jugador.
  Los nodos, al doble clic, salen **en la dirección de la flecha**, no perpendiculares.

### 5.3 · Filas que generan jugadores

- Se describe **una ronda**; el motor la repite con el siguiente jugador hasta vaciar la fila.
- **Cadencia de salida** opcional: en blanco, el siguiente sale cuando acaba el anterior; con valor, las rondas se solapan.
- Destino de vuelta: la misma fila u otra, como parámetro.
- Una fila puede marcarse como **fila de defensores**.
- Al asignar balón a un jugador, pasa a jugador con balón. Ctrl + clic sobre un jugador de la fila = un balón para cada uno de la fila.
- Doble clic duplica un elemento. Más de 5 jugadores por equipo. Cuatro equipos (ya existen en la paleta).
- El contador de material **no cuenta** los jugadores de las filas como jugadores puestos a mano.
- **Corrección de fallo:** al girar la pista, la fila conserva la orientación con la que se creó.
- Proyector: ronda a ronda con contador «2 de 6» y salto a la siguiente. Miniatura y guion, solo de la primera ronda.

### 5.4 · Zonas

- Líneas, rectángulos y círculos. Se crean en el **paso 1**, se ven en el **paso 2**.
- Relleno difuminado, nombre difuminado en el centro, por defecto «ZONA X».
- Con Shift, rectas o en diagonal. Interruptor de zona invisible.
- Sus esquinas y su trazado son sitios a los que referirse y sobre los que colocar conos con Shift a distancia regular.
- La regla de juego («no salirse de la zona») se escribe en la ficha; **el motor no restringe trayectorias**.

### 5.5 · Pistas a escala real

- Cuatro pistas redibujadas a medidas reales, con **banda exterior de 2 m** para colocar filas fuera del campo.
- Todo se dimensiona **en metros**. Jugador ~1,3 m de diámetro (legible, no realista).
- Misma proporción en las cuatro pistas; en medias canchas, ligeramente más pequeños.
- Nuevos elementos: **escaleras** y **pelotas de tenis** (SVG en `D:\Claude Code\web`).
- Símbolo de defensor corregido, con borde blanco (`D:\Claude Code\web\DEFENSOR (1).svg`).
- Atajos: con Shift, imán a posiciones básicas (45°, taco, esquinas, centro). Balón asignado se coloca junto a su jugador.

### 5.6 · Sesión activa

- Estado **deducido del reloj**: de 5 min antes del inicio a 5 min después del fin.
- Cronómetro **automático con ajuste de un toque** si se empezó tarde.
- **Pasar lista** arriba del todo hasta que esté pasada; luego el contador «12 de 14».
- Bloque actual en grande + cuenta atrás + «3 de 6». Botones **Finalizado** y **+5 min**.
- Al marcar finalizado se guarda la **duración real**, que alimenta la duración estimada de ese ejercicio para ese entrenador y su tarjeta en la biblioteca.
- Anotación en caliente: **estrella rápida a un jugador**, **nota corta** y **«este ejercicio no ha funcionado»**.
- Objetivos individuales de los jugadores visibles durante la sesión.
- La sesión finalizada es **la misma pantalla en modo lectura** + lo que falte de la reflexión.

### 5.7 · Progresión individual

Tres capas, de menos a más trabajo:

| Capa | Cuesta | Recoge |
|---|---|---|
| Automática | Nada | Asistencia, minutos activos, periodos jugados, puntos, faltas |
| Un toque | En caliente | La estrella rápida del bloque |
| Rúbrica | Al cerrar la sesión | Nivel de cada jugador en cada acción y conducta |

- La rúbrica la dispara el entrenador: **elige a quien quiera, sin tope**. La app marca discretamente quién lleva más tiempo sin mirarse.
- Apartado **Progresión** dentro del equipo: se selecciona un jugador, arriba sus datos, debajo sus gráficas.
- Objetivos individuales: uno o dos vivos por niño, propuestos desde su propia rúbrica.

### 5.8 · Avisos

| Cuándo | Cómo |
|---|---|
| Fin de bloque, durante el entrenamiento | Cronómetro en pantalla (vibra y suena) **y** push de respaldo |
| Pasar lista al empezar | Push |
| Sesión de mañana sin programar | Push, la tarde anterior |
| Convocatoria sin rellenar | Push, el día de convocatoria a la hora fijada en ajustes |
| Sesión sin cerrar | Push, al día siguiente |
| Post-partido | Push, la mañana siguiente, si falta resultado, valoración o acta |

Se diseña para el móvil más limitado: **todo se puede hacer abriendo el aviso**. Los botones
dentro de la notificación son un extra que solo funciona en Android. En iPhone hace falta
tener la app instalada en la pantalla de inicio.

### 5.9 · Partidos

- **Corrección de dominio:** en minibasket y alevín se juegan **periodos**, no minutos. Todo el reglamento y el acta están en periodos.
- Del acta se extraen: alineaciones, **periodos jugados y descansados**, faltas por jugador, faltas de equipo por periodo, tiempos muertos, marcador por periodo, resultado y ganador.
- **Comprobación de reglamento** (aritmética pura, sin IA), por categoría: mínimo de inscritos, dos periodos completos jugados y dos descansados de los cinco primeros, faltas de equipo, regla de los 50 puntos. Recuadro al pie de la pantalla del partido con lo incumplido.
- Pantalla **partidos y clasificación** por equipo. Clasificación **manual ahora**, automática cuando llegue el enlace de la FBCyL.
- Valoración por jugador y del rival, con estrellas.
- **Convocatoria:** plantilla PDF por equipo subida en ajustes; se elige convocados y lugar y la app compone el documento con rival, día y hora. Se crea sola como evento del calendario al añadir el partido.
- Alta de partido con el mismo estilo que la de entrenamiento: equipo, rival, lugar, hora, local/visitante.
- **Corrección de fallo:** la pantalla de partido escribe literalmente `null` cuando no hay marcador ni valoración.

### 5.10 · Panel de administrador

- Ver y gestionar todos los equipos, temporadas y sesiones del club.
- Crear y eliminar temporadas: **solo el administrador**. Cada entrenador ve las temporadas pasadas **solo de sus equipos**.
- Definir los periodos sin entrenamiento del club.
- **Lista de invitaciones**: el administrador añade correo + equipos; la persona entra con Google o se registra y **elige su propia contraseña**; un disparador comprueba el correo contra la lista, crea el perfil y asigna equipos. Sin clave maestra en el navegador, sin funciones de servidor, sin manejar contraseñas ajenas.
- Acceso con Google **restringido a los correos invitados**.
- En ajustes de equipo, el entrenador puede añadir a sus ayudantes.
- Cada cambio de un entrenador se avisa al otro entrenador del mismo equipo.

### 5.11 · Navegación e inicio

- Barra fija: arriba en ordenador (algo mayor que la actual), abajo en móvil.
- Pantalla de inicio con: **lo de hoy arriba del todo**, sin programar de la semana que viene, programados de la semana que viene, realizados de la semana pasada, y partidos y convocatorias.

---

## 6 · Funcionalidades modificadas

| Qué | Comportamiento actual | Comportamiento nuevo | Motivo |
|---|---|---|---|
| Curva de carga | intensidad × duración, número abstracto | Minutos activos por jugador, calculados con `densidad`, `estaciones`, `simultaneo`, `jugadores_min/max` y el nº de jugadores de la sesión | Es la doctrina de densidad hecha número: se corrige cambiando un ejercicio y se ve subir |
| Reflexión post-sesión | Pregunta de cumplimiento autodeclarada | Se retira. Se añade una pregunta **obligatoria** de esfuerzo 1–5. Preguntas individuales editables desde ajustes del equipo | El cumplimiento pasa a medirse por movimiento de rúbrica |
| Bloques de sesión | Ejercicio + libre | Tercer botón **Agua** (3 min ajustables, carga 0). Vídeos de YouTube/TikTok en bloque libre, guardables y reutilizables | Pedido explícito |
| Duración de sesión | Suma libre | Suma total arriba; **nunca se puede pasar** de la duración de la sesión. Aviso de bloques repetidos | Pedido explícito |
| Selector de ejercicio | Buscador + vista previa | Filtro automático por nº estimado de jugadores (desactivable). Aviso «esto ya lo hiciste el martes», solo del mismo equipo y sin bloquear | Pedido explícito |
| Título de sesión | Libre | Heredado de fecha y equipo | Pedido explícito |
| Material | Campo libre | Cuadro calculado al pie. Balones y pelotas de tenis en función del nº de jugadores | Pedido explícito |
| Objetivos de sesión | Elegidos de los del equipo | Se añaden, editan y quitan desde la propia sesión (quitar afecta solo a esa sesión). Panel «qué vigilar hoy» con una o dos líneas por objetivo | Pedido explícito |
| Cancelar sesión | Siempre deja la sesión tachada | Si **no estaba programada**, se elimina del todo. Si **sí lo estaba**, se queda tachada y se puede reabrir o reprogramar | Pedido explícito |
| Generación de sesiones | Botón «Guardar y regenerar» sobre toda la temporada | Rango elegible (temporada, meses, mes, semanas). Horarios guardados visibles arriba en cajita del color del equipo. «Regenerar» pasa a llamarse **Editar**: regenera solo las sesiones sin programar. «Añadir nuevo día» genera solo a partir de ese día. Vista previa con recuento y conflictos | Pedido explícito |
| Editar y duplicar ejercicio | Editor a pantalla completa aparte | Mismo flujo de pasos 0 → 1 → 2 → 3 con todo cargado. Duplicar abre un ejercicio nuevo llamado «X-variante de …»; no puede haber dos con el mismo nombre | Pedido explícito |
| Ficha del ejercicio | 2 columnas | Ejercicios similares abajo, en carrusel horizontal con flecha a la derecha | Pedido explícito |
| Reproducción | Pausa solo al acabar una fase | Pausa **en cualquier momento**, también en el proyector | Pedido explícito |
| Borradores | Solo en el Taller | Mismo guardado con recuperación al **planificar sesiones** y al **editar ejercicios ya creados** | Pedido explícito |
| Equipos | Lista con correos | Nombre de los entrenadores en vez de correos, imagen por equipo, borde del color del equipo. Más colores, elegibles desde ajustes | Pedido explícito |
| Categorías de objetivo | 3 fijas | El entrenador crea categorías nuevas al añadir un objetivo | Pedido explícito |
| Sugerencias de ejercicios | Motor determinista sobre etiquetas | Igual, pero con las etiquetas generadas por las acciones del ejercicio, dando peso a las destacadas | Pedido explícito |
| Plantilla | Lista con estado | Filtros por asistencia (semana / temporada), estado y rendimiento. Jugadores de baja recuperables desde archivados. Columna de minutos activos | Pedido explícito |
| Dossier | Documento de equipo | Añade progresión individual, rúbricas, carga por jugador y datos de partido | Pedido explícito |

---

## 7 · Funcionalidades eliminadas

| Qué se va | Impacto |
|---|---|
| Llamada de IA del paso 2 y su función de servidor | La app deja de tener ningún coste variable. Se retira `ANTHROPIC_API_KEY` |
| Lector local de respaldo del paso 2 | Deja de tener sentido sin el camino de IA |
| Pregunta de cumplimiento autodeclarada de la reflexión | Sustituida por la medida de rúbrica |
| Objetivo de temporada en el paso 3 del ejercicio | «Los objetivos de la temporada nada tienen que ver al crear un ejercicio» |
| Campo **dosis** del molde de ficha | Retirado por decisión del entrenador |
| Botón «Regenerar» | Sustituido por «Editar» |
| Tipo de ejercicio en el paso 3 | Ya se elige en el paso 0; en el paso 3 se elige el **contenido** |

---

## 8 · Datos

### Tablas nuevas

| Tabla | Para qué |
|---|---|
| `acciones` | Catálogo. Nombre, familia, parámetros, símbolo, descripción, vídeo. Visible para todo el club |
| `rubrica_filas` | Definición: acción o conducta, categoría, orden |
| `rubrica_valores` | Nivel de un jugador en una fila, con fecha. Serie histórica, no se sobrescribe |
| `invitaciones` | Correo + equipos + quién invita. Disparador de alta al primer acceso |
| `push_suscripciones` | Endpoint del navegador por usuario y dispositivo |
| `bloque_tiempos` | Duración real de cada bloque, por ejercicio y entrenador |
| `clasificacion` | Tabla de la liga por equipo y temporada. Manual ahora, alimentada después |
| `partido_estadisticas` | Por jugador y partido: periodos jugados, descansados, puntos, faltas |

> **Cambio sobre lo previsto**: las **zonas** no llevan tabla propia. Van dentro de
> `animacion.zonas`, como los jugadores, los conos y el material. Una tabla aparte
> partiría la ficha en dos sitios y rompería tres cosas que ya funcionan: duplicar un
> ejercicio (2.13), exportarlo a `biblioteca.json` y pasarle el linter. El tablero
> entero es un solo documento y así se queda.

### Cambios en tablas existentes

- `posiciones_pista` — añadir `es_publica` (posiciones que el administrador publica para todo el club) y ajustar la RLS de lectura.
- `exercises` — añadir los campos del molde que faltan: `requisito_previo`, `criterio_exito`, `organizacion`, `niveles` (base/intermedio/avanzado), `densidad`, `estaciones`, `simultaneo`, `aplicacion`. Retirar `objetivo_temporada_id` del formulario.
- `objectives` — categoría pasa de enumerado cerrado a texto con catálogo propio del club; añadir enlace a acciones/conductas diana.
- `session_blocks` — añadir `duracion_real_min`, `fallido`, y tipo de bloque `agua`.
- `sessions` — **no** se añade estado `activa`: se deduce del reloj.
- `teams` — imagen, hora de aviso de convocatoria, plantilla PDF de convocatoria.
- Migraciones **016 (partidos)** y **017 (notas de equipo)**: sin aplicar. Van primero.

### Migración de coordenadas

Al redibujar las pistas cambia el marco normalizado, así que **se mueve todo lo guardado**:
jugadores, conos, balones y trayectorias de las 204 fichas, las anclas medidas y las
posiciones guardadas. Es una transformación mecánica y exacta. Se hace sobre
`tools/biblioteca/biblioteca.json`, que es la fuente local, se pasa el linter y se
reimporta con copia previa. En el mismo paso se recompilan las intenciones al catálogo nuevo.

---

## 9 · Arquitectura

- **Sin proceso de compilación.** Se mantiene HTML, CSS y JS directos, tres SPA sobre el mismo dominio y sesión.
- **Se retira** la única función de servidor actual (IA).
- **Se añaden dos funciones de Netlify**, ambas dentro de la capa gratuita:
  - envío de avisos push (programada, con claves VAPID en variables de entorno);
  - lectura de la clasificación de la FBCyL (programada, semanal) — pendiente del enlace.
- **Service worker**: pasa de solo cachear a manejar `push` y `notificationclick`.
- **Motor de animación**: el compilador deja de tener nueve eventos fijos y pasa a resolver
  acciones del catálogo sobre cinco familias. La geometría se sigue calculando en el
  cliente, de forma determinista, sobre anclas medidas.
- **Escala**: el sistema pasa de trabajar en unidades normalizadas «a ojo» a trabajar en
  metros, con las pistas a escala real como referencia.

---

## 10 · Compatibilidad

**No se toca:**

- El flujo de cuatro pasos (0, 1, 2, 3) en ese orden, también al editar y al duplicar.
- Los 204 ejercicios: nada obliga a rehacerlos.
- El guardado con borradores y su recuperación.
- El rol blindado en base de datos: nadie puede ascenderse a sí mismo.
- Que un entrenador nunca vea los equipos de otro.
- La identidad visual: papaya solo para la acción.
- Coste 0 €.
- Ninguna sesión ya realizada se altera sin querer.
- Ninguna generación pisa el trabajo hecho: una sesión planificada o realizada no se toca nunca.

**Migraciones necesarias:** coordenadas de pista, recompilación de intenciones, campos
nuevos de ficha. Todas con copia previa y verificación por linter.

---

## 11 · Casos límite contemplados

- Temporada activa terminada: la generación produciría sesiones en el pasado. Debe decirse en pantalla, no callarse.
- Regenerar tras editar un horario: solo se rehacen las preliminares intactas; programadas y realizadas no se mueven.
- Sesión que nunca se abre: como `activa` se deduce del reloj, no se queda colgada en ningún estado.
- Entrenamiento que empieza tarde: el cronómetro se ajusta de un toque para que los tiempos reales no se falseen.
- Fila con más jugadores que rondas descritas: la última ronda se repite hasta vaciar.
- Ejercicio con más jugadores que su máximo: la densidad baja y los minutos activos lo reflejan.
- Jugador ausente: no se le suma la carga de esa sesión.
- Acta ilegible en algún campo: la casilla queda vacía con aviso en ámbar; **nunca se rellena al azar**.
- Acción sin vídeo asignado: la animación y el proyector funcionan igual; el vídeo es un extra.
- iPhone sin la app instalada: no llegan avisos push. El cronómetro en pantalla sí funciona.
- Dos entrenadores en el mismo equipo editando a la vez: cada cambio avisa al otro.
- Nombre de ejercicio duplicado al duplicar: se impide; por defecto «X-variante de …».
- Periodo sin entrenamiento fuera de la temporada activa: se dice que no bloquea nada.

---

## 12 · Decisiones confirmadas

1. Paso 2 sin IA, solo catálogo. Coste 0 € real.
2. Ficha del paso 3 y lectura del acta, por puente al chat.
3. Cinco familias de acción; la acción se configura, no se dibuja.
4. Cualquier entrenador crea acciones; las ve todo el club.
5. N vs M = secuencia corta legible + cartel con el desenlace declarado.
6. El apartado 3.4 (filas) entra como **P0**.
7. Una ronda descrita + repetición automática + cadencia opcional.
8. Proyector ronda a ronda con contador; miniatura y guion, de la primera ronda.
9. Anclas del motor invisibles; los nombres del entrenador mandan.
10. Zonas como dibujo + sitio al que referirse. Creadas en el paso 1, visibles en el paso 2.
11. Pistas redibujadas a escala real con banda de 2 m.
12. Elementos en metros; jugador ~1,3 m, legible.
13. Móviles mezclados: todo se puede hacer abriendo el aviso.
14. Cronómetro en sesión activa **y** push de respaldo.
15. Seis avisos (incluido post-partido).
16. Cronómetro automático con ajuste de un toque.
17. `activa` deducida del reloj, sin columna nueva.
18. En caliente: estrella a un jugador, nota corta, «no ha funcionado».
19. Carga = minutos activos por jugador.
20. Pregunta de esfuerzo 1–5 obligatoria al cerrar.
21. Carga visible en sesión, plantilla, progresión y dossier.
22. Vocabulario único, **con** familia de conductas aparte.
23. Rúbrica disparada por el entrenador, sin tope de jugadores.
24. Escala de cuatro niveles por exigencia.
25. Cuatro familias de conducta: actitud y esfuerzo, escucha, autonomía, compañerismo.
26. Cumplimiento por movimiento de rúbrica; se retira el autodeclarado.
27. Objetivos individuales, visibles también en la sesión activa.
28. Clasificación manual ahora, automática cuando llegue el enlace.
29. Reglamento: solo lo comprobable del acta.
30. Convocatoria a partir de la plantilla PDF del equipo.
31. Lista de invitaciones en vez de contraseñas creadas por el administrador.
32. Google restringido a correos invitados.
33. Borrado de datos con copia previa, ejecutado por el entrenador.
34. Inicio con cinco secciones, «lo de hoy» arriba.
35. Paso 3 con la ficha completa del molde, **sin el campo dosis**.
36. Vídeo: YouTube con tramo exacto y pausa; TikTok como enlace al vídeo entero.
37. Orden de trabajo: primero lo roto, luego el motor.

---

## 13 · Suposiciones

- El calendario aparece vacío porque la temporada activa termina el 30/06/2026 y la generación solo puebla el rango de la temporada activa. **Sin confirmar contra la base de datos real.**
- El aviso post-partido se envía la mañana siguiente si falta resultado, valoración o acta.
- Las conductas de la rúbrica se valoran en la misma escala de cuatro niveles que las acciones.
- La cadencia de salida de las filas se expresa en segundos.
- El aviso «sesión de mañana sin programar» se envía la tarde anterior.

---

## 14 · Riesgos

| Riesgo | Gravedad | Mitigación |
|---|---|---|
| La migración de coordenadas corrompe la biblioteca | Alta | Copia previa, transformación sobre el fichero local, linter obligatorio, revisión visual de una muestra antes de reimportar |
| El catálogo de acciones se convierte en la pieza crítica de toda la app | Alta | Es lo que da valor al vocabulario único; se construye primero y con banco de pruebas |
| Redibujar cuatro pistas a escala es más trabajo del que parece | Media | Es la única forma de arreglar escala, tamaño y banda a la vez. Se hace una vez |
| Los avisos push en iPhone dependen de que se instale la app | Media | Todo lo importante se puede hacer abriendo el aviso; el cronómetro no depende del push |
| La clasificación de la FBCyL se rompe cuando cambien su web | Media | La tabla manual sigue funcionando; el enganche automático es una capa encima |
| El puente al chat añade fricción y se acaba no usando | Media | Los campos son editables a mano; el ejercicio se puede guardar sin pasar por el chat |
| 21 peticiones imprescindibles no caben en una entrega | Alta | Cuatro tramos, cada uno útil por sí solo |
| Se retira el cumplimiento autodeclarado antes de que la rúbrica tenga datos | Media | Durante el primer trimestre habrá pocos movimientos de rúbrica; se avisa en pantalla en vez de mostrar un cero |

---

## 15 · Preguntas pendientes

- **Enlace de la FBCyL** para la clasificación y los próximos partidos. Bloquea solo esa pieza.
- **Plantilla PDF de convocatoria**, una por equipo.
- **Confirmar el diagnóstico del calendario** contra la base de datos real antes de tocar la generación.

---

# Plan de implementación

Cuatro tramos. Cada uno deja la aplicación en un estado útil por sí mismo.

## Tramo 1 · Lo que está roto (arranque de temporada)

Objetivo: que la temporada 2026/27 pueda arrancar el 24 de agosto sin pelear con la app.

| # | Tarea | Ficheros | Cómo se comprueba |
|---|---|---|---|
| 1.1 | Aplicar migraciones 016 y 017 | `supabase/migrations/` | Las columnas existen; la pantalla de partido deja de fallar |
| 1.2 | Confirmar el diagnóstico del calendario | — | Se ve qué temporada está activa y con qué fechas |
| 1.3 | Script de copia + borrado de temporadas, equipos y sesiones | `tools/` | El fichero de copia existe y el recuento cuadra antes de borrar |
| 1.4 | Temporada 2026/27 (24/08/2026 – 30/06/2027) con sus 11 periodos de vacaciones | `tools/` | El calendario sombrea Navidad, Semana Santa y los festivos |
| 1.5 | Formato de fecha `dd/mm/aaaa` al pegar periodos | `equipos/js/data/schedules.js` | Se pega una lista con ese formato y entra |
| 1.6 | Horarios: cajitas del color del equipo, «Editar» en vez de «Regenerar», rango de fechas elegible, vista previa con conflictos | `equipos/js/views/equipo-detalle.js`, `data/schedules.js` | Guardar horarios genera sesiones en el rango pedido sin mover nada programado |
| 1.7 | Cancelar sesión: borrado si no estaba programada, tachada y reabrible si sí | `equipos/js/data/sessions.js`, `views/calendario.js` | Las dos rutas se comportan distinto y ninguna da error |
| 1.8 | Arreglar el `null` de la pantalla de partido | `equipos/js/views/partido.js` | Un partido sin marcador no escribe `null` |
| 1.9 | Alta de partido con el formulario completo y botón naranja | `equipos/js/views/calendario.js` | Equipo, rival, lugar, hora, local/visitante |
| 1.10 | Pinchar una sesión abre su plan; el panel del día solo al pinchar fuera | `equipos/js/views/calendario.js` | Dos zonas de clic distintas |

**Riesgo del tramo:** 1.3 es irreversible. No se ejecuta sin copia verificada.

## Tramo 2 · El motor

Objetivo: que las animaciones salgan siempre correctas.

| # | Tarea | Depende de | Cómo se comprueba |
|---|---|---|---|
| 2.1 ✅ | Redibujar las cuatro pistas a escala real con banda de 2 m | — | Las medidas reales cuadran en toda la pista, no solo junto al aro |
| 2.2 ✅ | Anclas medidas nuevas + escala en metros | 2.1 | La esquina de media pista mide 6,6 m |
| 2.3 ✅ | Migrar coordenadas de las 204 fichas, anclas y posiciones guardadas | 2.2 | Linter en verde; muestra de 20 fichas revisada a ojo |
| 2.4 ✅ | Elementos dimensionados en metros; símbolos nuevos (escalera, pelota de tenis, defensor corregido) | 2.2 | Mismo tamaño en pizarra, gif y proyector |
| 2.5 ✅ | Modelo de datos del catálogo de acciones y las cinco familias | — | Las nueve acciones actuales se expresan en el modelo nuevo |
| 2.6 ✅ | Compilador sobre el catálogo; recompilar las 204 intenciones | 2.5, 2.3 | Las 167 fichas con animación siguen animando |
| 2.7 ✅ | Zonas: creación en paso 1, referencia en paso 2, conos sobre línea con Shift | 2.4 | Se crea una zona, se nombra, se referencia y se ocultan |
| 2.8 ✅ | Filas que generan jugadores: rondas, cadencia, fila de defensores, orientación al girar | 2.6 | Un ejercicio de 6 en fila enseña las 6 rondas con contador |
| 2.9 ✅ | Paso 2 nuevo: fases, clic sobre elementos, barra de acciones, posiciones nombrables | 2.5–2.8 | Un ejercicio de 4 fases se describe casi sin escribir y sale bien a la primera |
| 2.10 ✅ | Desplegable «Manualmente» y nodos de flecha en la dirección de la flecha | 2.9 | Se corrige una sola acción de una sola fase sin tocar nada más |
| 2.11 ✅ | Retirar la función de IA, el lector local y la clave | 2.9 | La app no hace ninguna llamada de pago |
| 2.12 ✅ | Paso 3 con la ficha completa del molde (sin dosis) + puente al chat + linter | 2.9 | Un ejercicio nuevo pasa el linter de la biblioteca |
| 2.13 ✅ | Editar y duplicar con el flujo de cuatro pasos; «X-variante de …» | 2.12 | Editar abre el paso 0 con todo cargado |
| 2.14 | Vídeo por acción: YouTube con tramo y pausa; TikTok como enlace | 2.5 | En el proyector la animación se pausa, se ve el tramo y continúa sola |
| 2.15 | Pausa en cualquier momento, en ficha y proyector | — | Se pausa a mitad de una fase |

**Riesgo del tramo:** 2.3 es el punto de no retorno. Copia previa y linter obligatorios.

### Estado de 2.1 – 2.3 (hechas)

Fuente única de verdad: `taller/js/canvas/medidas.js`. De ahí salen, por derivación,
los cuatro SVG (`taller/tools/gen-pistas.mjs`), las anclas (`canvas/anclas.js`) y la
escala (`canvas/escala.js`). Los dibujos pasan de 8,0 MB de mapa de bits trazado a
36 KB de vector.

| | Antes | Ahora |
|---|---|---|
| Marco | hoja A4 (210×297) para las cuatro | 19×32 m la entera · 18×19 m la media |
| Ejes | estirados distinto (la media, 1,7×) | el metro mide lo mismo en los dos |
| Fuera de las líneas | nada | banda de 2 m |
| Escala | deducida midiendo el dibujo, exacta solo junto al aro | exacta en toda la pista |
| Esquina desde el aro | 8,9 m | **6,60 m** |
| Jugador | «el 4,2 % del lienzo», ×1,4 en media | **1,30 m**, igual en las cuatro |

**Decisiones tomadas**

- Las cuatro pistas comparten geometría FIBA; las dos «mini» se diferencian solo en
  que no llevan línea de triple. Es lo que hacían ya los SVG anteriores (tenían la
  línea de tiros libres en el mismo sitio al milímetro) y lo que dicen sus etiquetas.
  Pintar las líneas propias del minibasket del plano de referencia —tiro libre a
  4,60 m, zona de 8,00×4,60— movería el ancla `tiro_libre` 1,2 m y con ella las 176
  fichas de media pista: queda **pendiente de decidir**, no descartado.
- Se mantiene la orientación de siempre (media en paisaje, aro a la izquierda) para
  no rotar las fichas además de reescalarlas.
- El mapa de migración es una recta por eje que lleva las líneas de banda y fondo del
  dibujo viejo a las del nuevo. No hay un mapa que respete a la vez los límites y la
  zona, porque el dibujo viejo no era coherente consigo mismo: sus bandas decían una
  escala y su zona otra un 17 % distinta. Se respetan los límites, que es lo que
  estaba mirando quien colocó cada cono.
- Las posiciones con **nombre** no pasan por el mapa: se recalculan y caen exactas.

**Qué se migró**: 1742 coordenadas en las 18 tandas
(`tools/biblioteca/migrar-marco.mjs`, con copia previa y testigo anti-doble-pase), y
el diccionario de posiciones del entrenador (migración `019`, idempotente por columna
`marco`). La geometría compilada no se migró: se **recompila** desde las tandas, así
que las posiciones con nombre quedan clavadas en el ancla nueva.

**Resultado medido sobre la biblioteca ya migrada**: 0 errores de linter · 0 jugadores
fuera de la cancha · distancia de tiro con mediana 1,46 m y máximo 7,00 m · recorrido
más largo 24,77 m (una pista entera de punta a punta).

**Pendiente del usuario**: aplicar la migración `019`, regenerar las 204 miniaturas
(siguen enseñando las pistas viejas) y subir la biblioteca con
`node tools/biblioteca/importar.mjs --actualizar --confirmar`.

### Estado de 2.4 (hecha)

Todo lo que se dibuja se declara en metros (`medidas.js` → `TAMANOS`, `MATERIAL`):
jugador 1,30 · balón 0,70 · cono 0,90 · pelota de tenis 0,40 · escalera 4,00 × 0,50.
El grosor de flechas y aspas también: iba con el ancho del lienzo, así que una flecha
era más gruesa **en metros** en la media que en la entera; ahora va atado al jugador
(`escalaTrazo`), y en la entera a 600 px vale exactamente 1, o sea que los números de
`arrows.js` siguen significando lo que significaban.

**Símbolos**

- **Defensor**: arco ancho y plano, medido sobre `web/DEFENSOR (1).svg` —centro 1,145
  radios por debajo de la ficha, radio 1,95—, en el color del equipo y sobre un trazo
  blanco más grueso. El anterior era un arco de radio 1,16 centrado en la ficha, que
  se confundía con el anillo de selección: son el mismo círculo salvo por que uno
  cierra.
- **Escalera de coordinación** y **pelota de tenis**: elementos nuevos (`kind`
  `escalera` y `pelota`). Son MATERIAL: ocupan sitio y se dibujan a medida, pero no
  son direccionables —nadie las pasa, las rodea ni las recoge—, así que no entran en
  la síntesis de jugadores ni en el validador. Viajan en `animacion.materiales`, clave
  que solo aparece si hay algo: las 204 fichas actuales salen byte a byte iguales.
- La escalera tiene orientación, que se elige con el mismo mando de dirección que la
  cola de una fila.

**Un fallo que salió al ponerlo**: los símbolos se dibujan derechos para que los
dorsales se lean, así que el giro del proyector no les llegaba. Lo que tiene
dirección —la cola de una fila— apuntaba en la ficha a un sitio de la pista y en el
proyector a otro. Ahora se les suma el giro de la vista. La cola ya arrastraba ese
fallo antes de que existieran las escaleras.

### Estado de 2.5 (hecha)

`taller/js/ia/acciones.js` — módulo puro: las cinco familias, el catálogo del
sistema, el validador y el resolutor de nombres. `supabase/acciones.js` +
migración `020` para lo que crea el club, que se fusiona encima.

**Las cinco familias** declaran los huecos que el motor sabe rellenar; una acción
es un nombre puesto a una configuración de una familia. Los parámetros son siempre
relativos —«hacia el aro», «al siguiente cono»—, nunca coordenadas, y hay una prueba
que lo exige: una acción tiene que valer en las cuatro pistas y con el tablero movido.

**Las nueve acciones de siempre quedan en diez**, y ahí está el fondo del asunto.
`bote hacia canasta` y `bote hacia el aro` eran la misma palabra con distinto
argumento: una avanzaba un trozo y la otra llegaba. Escribir la primera donde
tocaba la segunda no era un error detectable — es lo que dejó trece fichas
llamadas «entrada» soltando el balón a metros del aro. Ahora son **dos acciones
distintas**, `bota` y `entra`, porque *a dónde va* y *cuánto se acerca* se han
separado en dos parámetros. La confusión deja de poder escribirse.

Y `rodea_cono` deja de ser un evento suelto que había que declarar aparte —si se
olvidaba, el jugador iba en línea recta y se saltaba los conos en silencio— para
ser lo que siempre fue: **una trayectoria**.

**El puente del vocabulario único** es el campo `tag` de cada acción: la palabra con
la que esa misma acción aparece como etiqueta del ejercicio, diana de un objetivo y
fila de la rúbrica. Vale la raíz («bloqueo» cubre «bloqueo directo» e «indirecto»:
cuál sea es propiedad del ejercicio, no del movimiento). `tag: null` significa
«mecánica del motor, no concepto que evaluar» y solo lo llevan dos —rodear y volver
a la cola—; una prueba comprueba que la lista no crece por descuido.

**Reglas de acceso**: cualquier entrenador crea acciones y las ve todo el club;
editar y borrar, solo su autor o un administrador. Los diez slugs del sistema están
reservados en el cliente **y** en un trigger: redefinir «tira» cambiaría el
significado de las 204 fichas sin tocar ninguna.

**Pendiente del usuario**: aplicar la migración `020`.

### Estado de 2.13 (hecha)

Editar abría un **editor a pantalla completa aparte** que solo sabía retocar flechas. Para
cambiar el nombre, la dificultad o media ficha había que ir a otro sitio, y el paso 2 —el
que sabe describir la jugada— no estaba. Ahora los tres caminos entran por el **mismo
asistente** (§6): crear, corregir y hacer una variante.

**Editar abre por el paso 0 con todo cargado**, que es el criterio de aceptación:
comprobado en pantalla —título «Editar ejercicio», botón «Guardar cambios», y los cuatro
pasos con el nombre, el tipo, el bloque, la pista, el tablero, **las líneas del paso 2** y
la ficha entera del molde en su sitio.

**Lo que se guardó pensando en este momento.** Las líneas de las fases y las posiciones
marcadas ya viajaban dentro de la animación (2.9, 2.12); ahora también **el tablero**
(`_elementos`). Se podía reconstruir de la animación, pero no del todo, y el fallo habría
sido mudo: la cola dibujada de una fila viene **descontada de los que salieron a
trabajar**, así que cada apertura y guardado le habría quitado un jugador a la fila hasta
vaciarla. Para las 204 fichas de la biblioteca, que son anteriores y no lo guardaron, se
reconstruye devolviendo esos jugadores a su cola — con su prueba en el banco.

**Duplicar ya no crea a ciegas.** Creaba una copia llamada «Copia de X» y te dejaba
delante de un ejercicio ya existente que casi siempre había que corregir. Ahora abre el
asistente con el original cargado, nombre de variante y **sin id**: se cambia lo que se
quiera y se guarda una vez, cuando ya es lo que se quería.

El nombre es **«X-variante de …»** con el número delante y no detrás, por algo práctico:
en una lista alfabética las variantes no se separan del ejercicio —siguen empezando por su
nombre— pero sí se distinguen entre ellas. Y duplicar una variante da otra **del
original**: si no, a la tercera vuelta sale «1-variante de 1-variante de…», que no lo lee
nadie.

**No puede haber dos con el mismo nombre** (§6). Se compara sin distinguir mayúsculas ni
espacios de sobra —«Bote en cuadrantes» y «bote en  cuadrantes» son el mismo ejercicio
para quien los lea en una lista— y nunca contra uno mismo, para que guardar sin cambiar el
nombre siga funcionando. Si no se puede consultar la lista (sin sesión, sin red) no se
bloquea: dejar de poder guardar por no haber podido comprobar un nombre sería peor que el
nombre repetido.

**Lo que se ha retirado**: `views/editor.js` (163 líneas) y `css/editor.css` (43), que se
quedaron sin entrada; y `duplicarEjercicio`, sin llamadores. El botón «Regenerar» ya era
«Editar» desde antes (§7).

**Un hallazgo del harness que conviene contar.** Al montar la comprobación escribí el
ejercicio de prueba con `bota hasta el aro` para lo que la ficha llama «entradas». El
listón del paso 3 lo cazó en vivo: *«la ficha promete una finalización y el tiro sale a 5,6
m del aro; usa hacia 'aro'»*. Es **exactamente** el defecto que costó trece fichas mal
dibujadas, detectado ahora al abrir el ejercicio en vez de al revisar la biblioteca meses
después. El linter del Tramo 2.12 funcionando sobre un caso que no era de prueba.

### Estado de 2.12 (hecha)

El paso 3 tenía tres cajas de texto libre y un conteo de fichas. La biblioteca pedía
veinte campos. Consecuencia doble y silenciosa: **un ejercicio hecho en el Taller no
pasaba su propio linter**, y al lado de los 204 importados se veía medio vacío — sin
organización para doce, sin los tres niveles, sin criterio de éxito. La ficha no mentía:
es que no se le había preguntado.

Ahora el paso 3 **es** el molde, en cuatro bloques —la tarjeta, cómo se hace, los tres
niveles, el grupo— y al pie **el listón**: las mismas reglas que corren sobre las 204,
en vivo, mientras se escribe.

**Las mismas, literalmente.** `taller/js/ia/lint.js` tiene las dos capas que aplican a
una ficha suelta (campos y geometría) y `tools/biblioteca/lint.mjs` se queda la tercera
—el conjunto: invariantes, huecos, duplicados— más el CLI. Con el vocabulario pasó lo
mismo: se ha mudado a `taller/js/ia/vocabulario.js`, que es donde §3 lo pone (una misma
palabra es pieza del catálogo, etiqueta, diana de objetivo y fila de rúbrica), y
`tools/biblioteca/vocabulario.mjs` se queda como puerta. **La app no depende de sus
herramientas: son las herramientas las que importan de la app**, igual que el linter ya
importaba las anclas y la escala.

**Tres bugs que estaban callados y salieron al montar esto:**

| Qué pasaba | Consecuencia |
|---|---|
| `category` guardaba la RAMA («Minibasket»), que no es un bloque de contenido | El ejercicio quedaba fuera de los filtros del planificador y de su propio linter |
| `description` guardaba el DESARROLLO entero | En la biblioteca, un párrafo donde las importadas tienen una línea |
| Tres de las siete etiquetas sugeridas no existían en el vocabulario | La app sugería etiquetas que su propio linter rechaza, y con ellas el ejercicio se caía de las sugerencias |

Y uno que había introducido yo en 2.9: el paso 2 volcaba las líneas de las fases encima de
`descripcion_texto`, que es el desarrollo. Ahora las **ofrece** con un botón, que es
distinto: volcarlas solas dejaba la ficha con cuatro órdenes telegráficas donde tiene que
haber un párrafo que se lee con los niños ya en la pista.

**`null` en vez de valores de fábrica.** Los requisitos nacen sin decidir. Un `densidad:
'media'` de serie se ve exactamente igual que una decisión tomada: el linter lo da por
relleno, el puente al chat no se atreve a tocarlo por no pisar lo escrito, y la ficha
acaba diciendo cosas que nadie ha elegido. Con `null`, el listón lo pide.

**El puente al chat.** La app arma el envío con lo que ya sabe del ejercicio, el hueco
exacto a rellenar y **las reglas que la biblioteca va a exigir después** — sin ellas el
modelo escribe «se adapta al grupo» en la organización y el linter lo rechaza. El
entrenador lo pega en su chat, trae la respuesta y se vuelca. Sin red, sin clave, sin
coste (§2).

Dos decisiones que lo hacen usable:
- **Pide un JSON con la forma exacta, no prosa.** El molde del envío es JSON válido —los
  valores legales van dentro de las cadenas—, así que el modelo tiene un objeto que
  imitar en vez de una gramática que interpretar. Un chat al que se le pide prosa obliga
  a copiar nueve campos a mano.
- **No pisa lo escrito.** Rellena los huecos vacíos y dice cuántos campos ha respetado.
  Un puente que borra media ficha propia se usa una vez.

**Lo que se ha ido** (§7): el tipo de ejercicio (ya se elige en el paso 0; aquí se elige
el **bloque de contenido**, que es otra pregunta), el objetivo de temporada, la **dosis**
—prescribir series desde la ficha es decidir por quien tiene el grupo delante— y
`variantes`, cuyo contenido son ahora los tres niveles. Las 204 fichas conservan su dosis
y se sigue viendo: el dato no estorba y borrarlo de todas no gana nada.

**Comprobado en el navegador**, sobre el paso 3 real: un borrador recién abierto dice las
15 cosas que faltan; se pega la respuesta del chat y baja a una —la rama, que es del
entrenador y el envío no pregunta—; se elige la rama y el panel dice **«Pasa el linter,
sin un solo aviso»**. Ese es el criterio de aceptación del tramo.

**Un accidente, y lo que deja.** Al partir el linter, una operación de corte se llevó su
cuerpo —unas 400 líneas de reglas— y el proyecto no tiene control de versiones. Se
recuperó de una copia en `.claude/worktrees/` anterior al Tramo 2.1 y se reconstruyó la
parte que faltaba (los límites: salirse de la cancha es aviso, del lienzo es error),
verificándola contra dos huellas independientes: el banco propio del linter (49/49,
incluido el caso que fija la redacción del error de límites) y las 204 fichas con sus 7
avisos textualmente idénticos. La reconstrucción se da por fiel, pero es reconstrucción.
**Merece la pena `git init`**: hoy no hay red de seguridad para nada.

### Estado de 2.11 (hecha)

**La app no hace ninguna llamada de pago.** No es una promesa: no queda a quién
llamar.

Se ha borrado `netlify/functions/generar-animacion.js` (479 líneas) y
`taller/js/ia/client.js` (451), y con ellos el puente de red, el lector de respaldo por
regex, el flujo de preguntas y la resolución de la canasta desde el texto. La variable
`ANTHROPIC_API_KEY` ya no existe en `.env.example`; en su sitio hay una nota que dice por
qué no hay ninguna clave más. Netlify Functions sigue disponible para los dos usos que no
cuestan dinero (avisos push y clasificación de la federación): lo que se ha ido es la
función, no la infraestructura.

En el paso 2 desaparece la sección plegada del generador anterior. El simulador
determinista de ataque-defensa (Tramo 5b) **no** se ha ido con ella —no tiene nada que ver
con la IA, juega la colocación que hay en la pista y sale siempre igual con la misma
semilla—: estaba metido dentro de aquella sección y ahora tiene la suya.

**Lo que sobrevivió y a dónde se fue.** `sugerirDificultad` no interpretaba nada: cuenta
fases, acciones y jugadores de una animación ya hecha. Estaba en el cliente de IA por
vecindad, y se ha ido con las otras dos funciones de dificultad, a `wizard/draft.js`.

**El banco de pruebas: de 114 casos a 79, y la cobertura intacta.** Es la parte delicada
de este tramo, así que conviene el detalle:

| Qué medía | Cuántos | Qué se ha hecho |
|---|---|---|
| Geometría del compilador, a través del extractor de texto | 6 | **Reescritos** con el intent puesto a mano: el arco alrededor de un cono, el eslalon de tres, que un jugador al que nadie ha nombrado no se mueva, el balón sintetizado, el paso del dorsal y del id |
| Resolución de la canasta desde el texto | 10 | Borrados: el paso 2 elige el aro más cercano y el chip lo cambia |
| Qué equipo defiende, por regex | 6 | Borrados: ahora se declara («B1 defiende a A1»), y lo mide eval-frase |
| Heurísticas de fila del extractor | 4 | Borrados: lo miden eval-rondas y eval-frase |
| Flujo de preguntas | 4 | Borrados: no hay interrogatorio |
| Guardas del extractor y su warning inventado | 3 | Borrados |
| Camino de red, clave ausente, payload a Anthropic | 8 | Borrados con la función |

Los 22 casos que entraban por el validador siguen ahí: un intent que no ha escrito el paso
2 —el de una ficha guardada, el del simulador— sigue pasando por él. La composición
«validar y compilar» era `compilarIntentIA`, y se ha quedado **dentro del banco**, que es
donde vive su único llamador: sacarla a un módulo de producción sin nadie que la usara
sería dejar código vivo solo para las pruebas.

Dos casos cambiaron de sentido en vez de morir. El que comprobaba que *el texto* imponía la
canasta sobre el modelo ahora comprueba que **el intent ataca la canasta que declara**
—que es lo que evita que una ficha guardada con la canasta 2 se anime hacia la 1 en cuanto
alguien mueva las fichas—; y el que respondía a una pregunta `q_pos_*` ahora inyecta la
posición marcada como lo que es, una entrada del diccionario de la pista.

**Lo que no se ha tocado**: `tools/informe-v3/` sigue diciendo que la clave de IA no está
puesta en el servidor. Era verdad cuando se escribió, y es el informe del que salió la
decisión de retirarla: corregirlo sería reescribir la pregunta después de haberla
contestado.

### Estado de 2.10 (hecha)

Dos cosas distintas con el mismo fin: **corregir una sola acción de una sola fase sin
tocar nada más**.

**El desplegable «Manualmente»** enseña la jugada acción por acción: quién · qué hace ·
hacia qué, con desplegables. Se elige una fase o se crea una nueva, se añade o se quita
una acción, y al cambiar algo **la línea se reescribe sola**.

La decisión que lo ordena: **la línea escrita sigue siendo la única verdad**. El panel no
guarda un estado propio — si lo hiciera habría dos verdades y, en cuanto se separaran,
nadie sabría cuál manda, que es justo lo que hacía confuso el paso 2 anterior. Para eso
hizo falta el **camino de vuelta**: `escribirFrase`, el inverso del lector. Y el banco
exige que **leer → escribir → leer dé exactamente los mismos eventos**; si no lo diera,
tocar un desplegable cambiaría la jugada por su cuenta.

Para que la vuelta fuera exacta hubo que hacer canónico lo que el lector devuelve: un
argumento que repite lo que la acción ya trae puesto **no se anota** («entra a canasta»
y «entra» son la misma frase), y volver a la propia fila tampoco es un destino que
apuntar.

**El fallo que salió al probarlo, y que era el criterio de aceptación entero.** Que el
sujeto se arrastre entre fases es lo que permite escribir «bota hacia el aro / tira /
recoge» sin repetir el nombre — la mitad del «casi sin escribir» de 2.9. Pero tiene un
precio: al cambiar quién actúa en la fase 1, cambiaban **en silencio** las cuatro
siguientes. Comprobado en pantalla: corregir la fase 1 dejaba a otro tirando, recogiendo
y volviendo a la fila.

Ahora, al reescribir una fase se compara quién actuaba antes con quién actuaría ahora y
**solo a las fases que se verían arrastradas se les escribe el nombre delante**. Las
demás conservan las palabras que puso el entrenador. Medido: corregir la fase 1 reescribe
la fase 1 y le pone nombre a la 2; las fases 3 y 4 se quedan letra por letra.

**Los nodos salen en la dirección de la flecha.** Antes salían siempre en horizontal
(`n.x ± 0,06`), así que en una flecha que bajaba salían atravesados: curvar un nodo pegaba
un tirón lateral que nadie había pedido y había que recolocar los dos manejadores para
volver a donde estabas. Ahora son **tangentes** al camino —dirección de «el siguiente
menos el anterior», largo un tercio del segmento vecino con un mínimo para poder
agarrarlos—, así que **curvar no cambia el trazo**: solo lo deja listo para curvarlo.
Comprobado en el navegador: el producto vectorial entre la dirección de la flecha y la de
los manejadores sale **exactamente cero**.

**Y curvar pasa a ser DOBLE clic** (§5.2). Con el clic simple no había manera de
seleccionar un nodo para borrarlo: había que curvarlo primero, sin querer, y enderezarlo
después.

**Un tercer arreglo, que salió de probar los dos anteriores**: cada arrastre re-resuelve
la animación entera y trae objetos nuevos, y la flecha que se estaba retocando **se
deseleccionaba**. En una trayectoria de cuatro nodos eran tres clics de más por curva.
Ahora se conserva, buscándola por su elemento y su tipo.

**Lo de «y lo siguiente continúa desde donde acaba ese jugador»** ya lo resolvía el
reanclado de flechas del Tramo 6.3; aquí se ha comprobado sobre el paso 2 nuevo: tras
arrastrar el final del bote de la fase 1, la fase 2 arranca exactamente en ese punto.

### Estado de 2.9 (hecha)

El paso 2 deja de adivinar. Antes era un cuadro de texto grande, un botón y un modelo de
pago al otro lado; cuando no había clave —o no había red— entraba un puñado de regex que
siempre montaba el mismo ejercicio (bota, pasa, tira). Las dos cosas fallaban por lo
mismo: **adivinaban sobre un vocabulario abierto**, y cuando no entendían algo se
inventaban lo plausible en silencio.

Ahora es una lista de fases. Cada una con su cabecera —duración y pausa— y una línea que
se escribe con tres ayudas: la barra de acciones, el clic sobre una ficha de la pista y
el clic sobre un sitio vacío.

**El criterio de aceptación, comprobado**: el ejercicio de fila de cuatro fases (bota
hacia el aro · tira · recoge · vuelve a la fila) sale entero con **siete clics y cero
tecleo**, y da 6 rondas × 4 fases = 24 fases a la primera, sin un solo aviso.

**Dos módulos puros nuevos.**

`ia/sujetos.js` es todo lo que tiene nombre en la pista: jugadores, filas, cada jugador
de una fila, conos, zonas, balones, material, el aro y las catorce anclas medidas. Genera
las **dos direcciones del mismo diccionario** —de ficha a nombre (lo que inserta el clic)
y de nombre a referencia (lo que entiende el compilador)— de una sola lista. Si fueran
dos listas, el clic insertaría un nombre que el lector no reconoce y el entrenador vería
su propia palabra subrayada en rojo.

`ia/frase.js` lee la línea. **Primero busca sujetos y después acciones**, y ese orden lo
decide una frase concreta: «vuelve a la Fila 2». La acción «vuelve a la fila» lleva la
palabra «fila» dentro, así que buscando acciones primero se comería el nombre de la fila
y el 2 quedaría suelto. Lo concreto —un nombre que ha puesto un clic— se reserva antes
que el vocabulario suelto.

Del lector salen eventos del **dialecto nuevo** `{ jugador, accion, args }`, que es
exactamente lo que `ia/intencion.js` ya sabía normalizar desde 2.6. De ahí al compilador
no hay nada nuevo: el paso 2 escribe el mismo idioma que hablan las 204 fichas.

**Lo que no se entiende, se dice.** Debajo del campo hay dos cosas distintas y a
propósito separadas: el **resaltado** sobre el propio texto (acción, sujeto, o subrayado
rojo si no está en el vocabulario) y el **resumen en palabras** de lo que va a pasar
(«Fila 1 bota → el aro»). El primero dice qué palabras han valido; el segundo, si el
ejercicio es el que se quería. Y los avisos van en dos listas —«esto no se ha
entendido» y «revisa la colocación»—: son averías distintas y se arreglan en sitios
distintos.

| | Antes | Ahora |
|---|---|---|
| De dónde sale la jugada | un modelo de pago, o regex | dos listas cerradas de palabras |
| Sin red | el mismo ejercicio siempre | idéntico: no hay red que perder |
| Lo que no entiende | se lo inventa | lo marca y lo dice |
| Sin saber quién actúa | elige por cercanía al balón | no inventa protagonista |
| Preguntas antes de generar | hasta tres rondas | ninguna |

**Detalles que se comprobaron uno a uno**:

- El **sujeto se arrastra** dentro de la línea y entre fases: «Fila 1 bota hacia el aro»
  / «tira» / «recoge». Es la mitad del «casi sin escribir».
- «A1 y A2 cortan al aro» da **dos eventos**. Los plurales se resuelven con una regla de
  una línea (en presente, la tercera del plural es la del singular con una ene detrás),
  y no llenando de conjugaciones el catálogo, que también lo escribe el club.
- Un cono va a `sorteando` **solo si la acción es de rodeo**; si no, «bota hasta el Cono
  2» acabaría haciendo eslalon alrededor del sitio al que se le mandó ir.
- **Quien defiende sigue defendiendo** hasta que haga otra cosa: el arco del defensor
  sale de `fase.defensores`, y sin arrastrarlo un defensor declarado en la fase 1 dejaba
  de dibujarse como defensor en la 2. Sigue a su par solo si el par se ha movido; si no,
  se le vería reptando hacia el aro fase tras fase sin que pase nada.
- **Renombrar una posición reescribe el texto**, y la busca como cada cual la escriba:
  da igual la caja, las tildes y los espacios.
- El **espejo del resaltado** y el campo comparten caja y métricas al píxel (comprobado:
  0 de diferencia en las cuatro medidas, y también con el texto partido en tres líneas).

**Tres añadidos pequeños al motor, ninguno visible en la biblioteca**: el compilador
resuelve destinos que son un **elemento** («corre hasta el Cono 2») y el final de **otra
fila** («vuelve a la Fila 2», §5.3), y respeta la **duración y la pausa** que fije la
cabecera de la fase. Ninguna de las 204 fichas usa nada de eso, y la biblioteca se
reconstruye byte a byte idéntica.

**El camino anterior sigue ahí, plegado**, en una sección «Describirlo todo de una vez
(modo anterior)». Se retira en 2.11; quitarlo antes de tener el nuevo rodado sería
quedarse sin ninguno.

**Límite conocido**: el paso 2 no valida baloncesto (que el receptor de un pase sea un
compañero, por ejemplo). Todas las referencias salen del tablero, así que no pueden
apuntar a nadie que no exista; lo demás es del linter y del paso 3.

### Estado de 2.8 (hecha)

`ia/rondas.js` — módulo puro. Media biblioteca son ejercicios de fila, y hasta ahora la
animación enseñaba **una salida y se acababa**. Para ver la segunda había que escribirla
entera a mano, con otro id, repitiendo los mismos eventos. Nadie lo hacía, así que las
fichas prometían una rueda y dibujaban un turno suelto.

Ahora se describe **una ronda** y el motor la repite con el siguiente hasta que han
salido todos. Un ejercicio de seis en fila da 6 rondas × 4 fases = 24 fases, con su
contador «2 de 6» y salto de ronda en los controles.

**Por qué se repite la geometría y no se recompila**: todas las rondas hacen lo mismo
desde el mismo sitio, así que la ronda 2 es la 1 con otro actor. Recompilar daría lo
mismo — con la diferencia de que *podría* no darlo, si algo del compilador dependiera
del estado acumulado, y ahí ya no habría forma de comprobarlo.

| | Sin rondas (lo de siempre) | Con rondas |
|---|---|---|
| Quién sale | solo el primero | los n de la cola |
| Dónde empiezan | todos encima del cono | cada uno en su sitio de la fila |
| Cola dibujada | fichas anónimas | ninguna: todos son jugadores |
| Direccionables | los 5 primeros | todos |

**La cadencia** va en segundos y se resuelve **por fases**: una fase es la unidad que el
motor sabe reproducir, y trocearla para clavar la cadencia daría fases de 200 ms que no
se ven. Se redondea a la fase más cercana, nunca a cero — dos rondas exactamente a la
vez no son dos rondas.

**El balón no se teletransporta**: al cambiar de ronda hace el último tramo desde donde
lo dejó el que volvió hasta las manos del que sale.

**La fila de defensores** marca a los suyos como defensores aunque en su ronda no
lleguen a defender a nadie: el rol lo da de qué cola sales, no lo que hagas ese turno.

**Miniatura y guion, solo la primera ronda.** Seis rondas son la misma: el gif saldría
seis veces más largo para enseñar seis veces lo mismo, y un guion que repita seis veces
«sale el siguiente, bota, entra y vuelve» no se lee, se salta.

**Un fallo que salió al probarlo**: una cola de seis mide casi ocho metros. Apuntando al
lado equivocado, los últimos se salían del dibujo y se amontonaban en el borde — en
pantalla, tres fichas superpuestas parecen un ejercicio raro, no un fallo de colocación.
Ahora se recorta (no hay dónde ponerlos) pero **se avisa**, con qué hacer.

**La orientación al girar** ya estaba corregida en 2.4: los símbolos se dibujan derechos
para que se lean los dorsales, así que el giro del proyector no les llegaba y la cola
apuntaba a un sitio en la ficha y a otro en el proyector.

**Límite conocido**: solo se expande la primera fila con rondas. Dos filas girando a la
vez, cada una a su ritmo, es otro ejercicio y otro problema; hacerlo a medias sería peor
que no hacerlo.

### Estado de 2.7 (hecha)

`canvas/zonas.js` — módulo puro con la geometría; el dibujo en `symbols.js`; la
creación y edición en el paso 1; el nombre resuelve como destino en el compilador.

**Tres formas, dos puntos.** Rectángulo, círculo y línea se describen igual: dos
puntos. Es exactamente lo que produce arrastrar el ratón, así que crear una zona es un
gesto y no un formulario. Un clic sin arrastre no deja una zona de tamaño cero: se
descarta, porque no se vería ni se podría volver a pinchar.

**Todo en metros, y aquí importa.** El radio de un círculo se mide en metros, no en
unidades normalizadas: el marco no es cuadrado y tomarlo en normalizado daría una
elipse. Con Shift, un rectángulo sale cuadrado **en el suelo** y una diagonal sale a
45° **sobre la pista**, no a 45° de la pantalla. Y repartir seis conos por el contorno
los deja equidistantes en metros: hacerlo en unidades de lienzo los amontona en los
lados cortos de un rectángulo alargado.

**Una zona es un sitio con nombre.** «Corta a la zona de tiro» resuelve a su centro, y
va ANTES que las anclas: si el entrenador ha dibujado una zona y la ha llamado así en
ESTE ejercicio, manda sobre cualquier ancla que se llamara parecido. Las esquinas de un
rectángulo, los extremos de una línea y los cuatro cardinales de un círculo están
disponibles como puntos (`puntosDe`), para cuando el paso 2 los necesite.

**El interruptor de invisible apaga el dibujo, no la zona**: se sigue pudiendo mandar
gente a ella. Es para las zonas que son una REGLA del ejercicio y no un decorado. En el
paso 1 se ven siempre, aunque estén marcadas como invisibles — si no, se apagan y ya no
hay forma de volver a encontrarlas para encenderlas.

**Lo que no hace, y es deliberado**: no restringe trayectorias. La regla —«no se puede
salir de la zona»— se escribe en la ficha y la hace cumplir el entrenador. Un motor que
lo impidiera convertiría cada error de colocación en una animación imposible de depurar,
y obligaría a modelar reglas de juego que cambian con cada ejercicio.

**Sobre el Shift para los conos**: la especificación pedía colocarlos «con Shift a
distancia regular». Está como **botón en el inspector de la zona** («repartir N conos»)
en vez de como Shift+clic: hace lo mismo, se descubre solo y deja el Shift para lo que
de verdad necesita una tecla, que es enderezar el trazo mientras se arrastra.

### Estado de 2.6 (hecha)

El compilador **ya no conoce ni un verbo de baloncesto**. `ia/intencion.js` resuelve
cada evento contra el catálogo y le entrega su familia y sus parámetros; a partir de
ahí `compilador.js` solo sabe resolver cinco familias. Añadir «puerta atrás» pasa de
tocar el compilador a añadir una fila al catálogo.

**Dos dialectos, una salida.** Se aceptan tanto los nueve eventos de siempre —los que
traen las 204 fichas— como el nuevo `{ jugador, accion, args }` que escribirá el paso 2.
No es una concesión: **es la prueba**. Traducir en la puerta y no en las fichas permite
reconstruir la biblioteca entera y comprobar que sale byte a byte igual. Reescribir las
intenciones a mano habría sido una reinterpretación sin forma de comprobarla.

**Resultado**: `biblioteca.json` reconstruida es **idéntica al byte** (mismo SHA-256).
Las 167 fichas con animación no solo siguen animando: animan exactamente igual.

**Lo que ha desaparecido del compilador**

| Antes | Ahora |
|---|---|
| `if (ev.tipo === 'bote' \|\| ev.tipo === 'corte')` y siete ifs más | `if (ev.familia === 'desplazamiento')` |
| `FRACCION = { bote: 0.55, corte: 0.3, defiende: 0.25 }` | parámetro `avance` de cada acción |
| Escalera de ifs sobre `hacia` | `destino` (a dónde) + `alcance` (cuánto se acerca) |
| «botar exige balón» escrito a fuego para `bote` | regla derivada del símbolo de la acción |
| `rodea_cono`, evento suelto tejido en otro camino | trayectoria del propio desplazamiento |

**Un fallo que cazó el banco**: la primera traducción solo miraba `hacia: 'aro'` en el
bote, no en el corte. El que continúa al aro tras un bloqueo se quedaba a 2,84 m de la
canasta en vez de a 1,10. Está cubierto por una prueba con ese nombre.

## Tramo 3 · Sesiones, progresión y objetivos

| # | Tarea | Depende de | Cómo se comprueba |
|---|---|---|---|
| 3.1 | Motor de minutos activos por jugador | 2.12 | Un ejercicio de fila con 14 críos da menos minutos activos que uno simultáneo |
| 3.2 | Pantalla de programar sesión: tope de duración, nº de jugadores, agua, material, avisos de repetición | 3.1 | No se puede pasar de los 90 min; el material sale solo |
| 3.3 | Bloque libre con vídeo, guardable y reutilizable | 3.2 | Un vídeo guardado se reutiliza en otra sesión |
| 3.4 | Estado `activa` deducido del reloj + cinco estados en el calendario | — | Los cinco se distinguen a la vista |
| 3.5 | Pantalla de sesión activa: cronómetro, pasar lista, finalizado/+5, anotación en caliente | 3.4 | Un entrenamiento entero se da sin apuntar nada después |
| 3.6 | Duración real por bloque → duración estimada del ejercicio | 3.5 | La segunda vez que se usa un ejercicio propone la duración real |
| 3.7 | Rúbrica: filas de acciones y conductas, cuatro niveles, evaluación al cerrar | 2.5 | Se evalúa a cinco jugadores en menos de dos minutos |
| 3.8 | Apartado Progresión dentro del equipo | 3.7 | Se elige un jugador y se ven sus datos y sus gráficas |
| 3.9 | Objetivos: categorías propias, dianas de acción, medida por rúbrica, panel «qué vigilar» | 3.7 | Un objetivo dice «trabajado en 7 sesiones · 5 de 13 han subido» |
| 3.10 | Objetivos individuales, visibles en sesión activa | 3.8 | Cada niño con uno o dos objetivos vivos |
| 3.11 | Reflexión: esfuerzo obligatorio, preguntas individuales editables | 3.5 | Se valora a jugadores sueltos, no a todos |
| 3.12 | Plantilla: filtros por asistencia, estado y rendimiento; archivados recuperables | 3.1 | Se recupera un jugador de baja |
| 3.13 | Borradores con recuperación en sesiones y en edición de ejercicios | — | Se sale a media sesión y al volver la ofrece |

## Tramo 4 · Partidos, avisos, administración y navegación

| # | Tarea | Depende de | Cómo se comprueba |
|---|---|---|---|
| 4.1 | Rediseño de la pantalla de partido con todos los datos | 1.1 | Cabe el marcador por periodo, alineaciones y estadísticas |
| 4.2 | Puente al chat para el acta + volcado a los campos, con ámbar en lo dudoso | 4.1 | Un acta manuscrita rellena marcador, periodos y faltas |
| 4.3 | Comprobación de reglamento por categoría | 4.2 | Una alineación indebida se detecta y se explica |
| 4.4 | Estadísticas por jugador y acumulados; periodos, no minutos | 4.2 | La ficha del jugador suma periodos y puntos |
| 4.5 | Pantalla partidos y clasificación, con tabla manual | 4.1 | Se rellena a mano y se ve por equipo |
| 4.6 | Convocatoria: plantilla PDF, evento automático, relleno desde la app | 4.1 | Sale el PDF con rival, día, hora y lista |
| 4.7 | Suscripciones push + service worker + función programada | — | Llega un aviso con la app cerrada en Android |
| 4.8 | Los seis avisos | 4.7, 3.5 | Cada uno llega cuando toca y abre donde toca |
| 4.9 | Panel de administrador + lista de invitaciones + disparador de alta | — | Se invita a un entrenador y entra solo, con su clave |
| 4.10 | Acceso con Google restringido a invitados + recuperar contraseña + perfil | 4.9 | Un correo no invitado no entra |
| 4.11 | Barra de navegación fija y pantalla de inicio con cinco secciones | — | En móvil abajo, en ordenador arriba |
| 4.12 | Rediseño de calendario: color e imagen por equipo, partidos distinguidos | 3.4 | Se distingue a la vista qué es cada cosa |
| 4.13 | Avisos entre entrenadores del mismo equipo | 4.7 | Un cambio de uno le llega al otro |

## Fuera de la v2.1 (marcados «no imprescindible»)

Miniaturas de más calidad · uso sin conexión · identidad visual y estética general ·
compartir por WhatsApp · rendimiento y accesibilidad · textos y mensajes de error ·
dossier hipercompleto. Se anotan y se retoman después.
