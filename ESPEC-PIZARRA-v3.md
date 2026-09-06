# La Pizarra · especificación completa (v3)

Sustituye a los pasos 1 y 2 del Taller. Manda sobre `ESPECIFICACION-v2.1.md`
en todo lo que aquí se contradiga; el resto de la v2.1 sigue vigente.

Documento de trabajo: **nada implementado todavía**. Cada apartado está
escrito para poder programarse sin volver a preguntar.

---

## 0 · Las decisiones que lo ordenan todo

| # | Decisión | Consecuencia |
|---|---|---|
| 1 | **El dibujo manda.** El texto se escribe solo y es salida, no entrada | Desaparece el lector de frases (`ia/frase.js`) como fuente de la animación |
| 2 | **Se guarda intención + trazo exacto** | Mover una ficha o cambiar la defensa recalcula lo que dependa; tu trazo se respeta |
| 3 | **Colocar y animar son el mismo sitio** | Fuera los pasos 1 y 2 separados; queda una Pizarra |
| 4 | **Fase = carriles en paralelo, tramos en serie dentro de cada carril** | El motor necesita instantes de arranque por tramo (hoy todo va a la vez) |
| 5 | **La defensa es una regla, no un dibujo** | Los defensores se animan solos; se calcula al compilar, muestreando |
| 6 | **Un solo tipo de cono; el papel lo pone el contexto** | Fuera «decorativo / fila / rodear» como decisión previa |
| 7 | **El motor de animación antiguo se borra entero** | Los ejercicios guardados conservan ficha, metadatos y miniatura estática; pierden la animación |
| 8 | **Las jugadas pueden tener ramas** | Línea de tiempo, guardado y proyector dejan de ser lineales |
| 9 | **Coste 0 €** | Nada de IA en el paso 3 por ahora; la voz es la del navegador |

---

## 1 · Principios de diseño

1. **Nada interpretado puede ser invisible.** Si la app decide algo (rodear un
   cono, emparejar un defensor, adelantar un arranque), se ve en la pista y se
   puede corregir con un clic.
2. **Un gesto, un significado.** Arrastrar una ficha la mueve. El anillo dibuja.
   Pinchar un trazo lo edita. No hay modos que recordar.
3. **Todo en metros.** Distancias, velocidades, umbrales y tamaños. Un ejercicio
   se comporta igual en pista entera que en media.
4. **Lo que se dibuja se ve al momento.** Cada trazo se reproduce una vez al
   soltarlo.
5. **Ratón y dedo, lo mismo.** Ningún gesto depende de pasar el ratón por encima
   ni de una tecla.

---

## 2 · La pantalla

### 2.1 Reparto

```
┌──────────────────────────────────────────────────────────────────────┐
│ BARRA SUPERIOR · herramientas a la izquierda · ayuda a la derecha     │
├───┬──────────────────────────────────────────────────┬───────────────┤
│ H │                                                  │  PANEL        │
│ E │                                                  │  DERECHO      │
│ R │                  P I Z A R R A                   │  ┌──────────┐ │
│ R │                                                  │  │ Ajustes  │ │
│ A │                                                  │  │ Fases    │ │
│ M │                                                  │  │ Texto    │ │
│ . │                                                  │  └──────────┘ │
├───┴──────────────────────────────────────────────────┴───────────────┤
│ LÍNEA DE TIEMPO · fases · ramas · carriles · reproducción            │
└──────────────────────────────────────────────────────────────────────┘
```

- Los dos paneles laterales se **pliegan y se ensanchan arrastrando su borde**
  (como los de Claude Code). El ancho elegido se recuerda entre sesiones.
- Plegados quedan como una tira de iconos de 44 px.
- La pizarra siempre ocupa lo que sobra y se reencuadra sola al plegar.

### 2.2 Barra superior

Izquierda, herramientas de uso continuo:

| Icono | Qué hace | Atajo |
|---|---|---|
| ↶ ↷ | Deshacer / rehacer | `Ctrl+Z` / `Ctrl+Shift+Z` |
| 🔍− 🔍+ | Zoom | `−` / `+` |
| ⛶ | Encajar la pista | `0` |
| 🧲 | Imán (indicador; se activa con Shift) | — |
| 👻 | Fantasma de la fase anterior | `G` |
| ▶ | Reproducir la fase / la jugada | `Espacio` |
| 🔊 | Voz | `V` |

Derecha, **la ayuda contextual**: una línea que dice qué puedes hacer *ahora
mismo* y cómo. Cambia con el estado:

| Estado | Texto |
|---|---|
| Nada seleccionado | «Arrastra un elemento a la pista, o pincha una ficha para ver lo que puede hacer.» |
| Ficha seleccionada | «Elige una acción, o arrastra la ficha para recolocarla. Supr la quita.» |
| Acción elegida, esperando destino | «Clic para el destino · clics para ir marcando el camino · arrastra para dibujarlo a pulso · doble clic o Intro para terminar · Esc cancela.» |
| Acción entre dos, esperando compañero | «Pincha a quién bloquea.» |
| Trazo seleccionado | «Arrastra un nodo · clic en la línea añade uno · doble clic lo curva · Supr lo borra.» |
| Intento de mover en fase > 1 | «Aquí llega desde la fase anterior. [Ir a la fase 2 y corregirlo].» |

La ayuda **nunca es un aviso de error**: los errores van en la propia pista.

### 2.3 Panel izquierdo · herramientas y elementos

Una columna estrecha (56 px plegada, 220 px abierta), en tres bloques:

1. **Fichas** — Equipo 1 · 2 · 3 · 4 (color), Balón, Cono, Escalera, Pelota de tenis.
   Se **arrastran a la pista** o se pulsan y luego se pincha (los dos gestos).
2. **Zonas** — rectángulo, círculo, línea. Se arrastran (necesitan dos puntos).
3. **Traer** — «Cargar equipo del club», «Colocaciones guardadas», «Fases guardadas».

Debajo, el **recuento en vivo**: jugadores en juego, balones, conos, material, zonas.

### 2.4 Panel derecho · tres pestañas

**Ajustes** (contextual, lo que haya seleccionado):

| Selección | Qué ofrece |
|---|---|
| Jugador | Equipo · dorsal · nombre · **en juego / esperando** · **lleva balón** · **defiende a…** · **regla propia** (o «la del ejercicio») · quitar |
| Varios jugadores | Equipo · en juego/esperando · alinear · repartir · quitar |
| Balón | Portador · quitar |
| Cono | Nombre · **hacer fila** (nº, dirección con tirador, rondas, cadencia, equipo, rol, un balón por cabeza) · emparejar como puerta · quitar |
| Zona | Nombre · forma · se ve en la animación · repartir conos por el contorno · quitar |
| Escalera / pelota | Orientación · quitar |
| Trazo | Acción · variante técnica · ritmo · duración · arranque dentro de la fase · quitar |
| Nada | **Ajustes del ejercicio**: pista, canasta objetivo, preajuste defensivo, velocidad de reproducción, bucle, mostrar rastro |

**Fases** — la lista de la fase activa, carril a carril:

```
Fase 2 · 2,4 s                                    [+ nueva fase]
├ A1  bota al codo (1,1 s) · pasa a A2 (0,4 s)              ⋮
├ A2  corta a la esquina (1,6 s)                            ⋮
└ B1  sigue a A1 — automático                               ⋮
   Nadie más se mueve en esta fase.
```
Cada tramo se puede seleccionar (lo resalta en la pista), reordenar dentro de su
carril, borrar, y cambiarle acción, variante y ritmo. Los tramos automáticos
(defensa) salen en gris y con la etiqueta «automático».

**Texto** — la frase de cada fase, escrita sola y editable. Botón
«llevar al paso 3».

### 2.5 Línea de tiempo inferior

```
 ◀ ▶ ↺ 1×   ┃ [Fase 1] [Fase 2] [Fase 3]─┬─[3a Si le niegan] ...
                                          └─[3b Si le dejan]  ...   [+ Siguiente fase]
 ┃ A1 ▓▓▓▓▓▓▓▓░░░▓▓▓
 ┃ A2 ░░░▓▓▓▓▓▓▓▓▓▓▓
 ┃ B1 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

- **Tira de fases** con miniatura de cada una. Arrastrar reordena; el menú de
  cada una ofrece duplicar, insertar antes/después, borrar, **abrir rama**.
- **«Siguiente fase»** al final: reproduce la fase recién dibujada, deja a todos
  en su posición final y abre la fase nueva.
- **Carriles** de la fase activa: una barra por ficha. Arrastrar una barra
  adelanta o retrasa ese tramo dentro de la fase; estirar su borde cambia su
  duración.
- **Controles** de reproducción: anterior / reproducir / siguiente / reiniciar /
  velocidad / bucle.

### 2.6 Tablet y móvil

- **Tablet**: mismo reparto; los paneles se pliegan solos por debajo de 1100 px.
  Anillo y nodos con área de agarre de 44 px.
- **Móvil**: los paneles son **cajones** que se abren sobre la pizarra y se
  cierran al tocar la pista. La línea de tiempo queda como tira fina abajo, y
  los carriles se abren al pulsarla. La pizarra siempre manda.

### 2.7 Lenguaje visual

Los tokens de `css/tokens.css` no cambian. Lo que cambia es la **maquetación**:
paneles acoplados con cabecera de 32 px, separadores de 1 px, densidad alta,
sin tarjetas flotantes con sombra dentro de los paneles. Las sombras se reservan
para lo que flota de verdad: el anillo, los menús y los cajones del móvil.

---

## 3 · La pizarra

### 3.1 Zoom y encuadre

- Rueda / pellizco: zoom entre **50 % y 400 %**, centrado en el puntero.
- Barra espaciadora + arrastrar, botón central, o dos dedos: desplazar.
- `0` o el botón ⛶: encajar la pista entera.
- **Las coordenadas siguen siendo normalizadas [0–1] sobre la pista.** El zoom
  vive en la vista, no en los datos: un ejercicio hecho al 300 % se reproduce
  igual en el proyector.
- Al pasar del 150 %, aparecen las **líneas de metro** atenuadas cada 2 m.

### 3.2 Selección

- Clic en una ficha: la selecciona **y abre su anillo** (§4).
- `Shift`+clic: añade a la selección. Arrastrar sobre suelo vacío: marco de selección.
- Con varios seleccionados **no se abre el anillo automáticamente**: aparece un
  botón único «¿qué hacen los 3?» junto al grupo; al pulsarlo se abre un anillo
  común y la acción se aplica a todos (§4.6).
- `Esc` deselecciona. `Supr` quita las fichas seleccionadas.

### 3.3 Arrastrar mueve · el anillo dibuja

Regla única:

- **Arrastrar una ficha siempre la mueve** (solo en la fase 1 — ver §6.6).
- **Un trazo nunca empieza sobre la ficha.** Solo se dibuja después de elegir una
  acción; entonces la pizarra entra en *modo destino* y nada se mueve hasta que
  terminas o cancelas con `Esc`.

### 3.4 Imán

- **Solo con `Shift` pulsado** (decisión tomada; coherente con la v2.1).
- Puntos de imán: aro, punto de apoyo bajo el aro, codos, tiro libre, 45°,
  esquinas, poste alto y bajo, centro, prolongación de personal, vértices y
  puntos medios de cada zona, conos, fichas, y **las posiciones con nombre**
  guardadas del entrenador.
- Radio de atracción: **0,60 m** (constante en metros).
- Mientras el imán agarra, el cursor dice a qué («codo derecho»).

### 3.5 Guías de alineación

Al mover una ficha con el ratón (sin Shift), aparecen líneas finas cuando queda
alineada en horizontal o vertical con otra ficha, con un cono, con el aro o con
una línea de la pista. Tolerancia **0,25 m**. No imantan: solo avisan.

### 3.6 Avisos sobre la pista

| Aviso | Cuándo | Cómo se ve |
|---|---|---|
| Choque | Dos fichas acaban a menos de **1,0 m** | Halo ámbar en las dos + línea entre ellas |
| Fuera | Un nodo cae fuera de la pista + banda de 2 m | El nodo en rojo, el trazo punteado |
| Fila que no cabe | La cola se sale del dibujo | Aviso sobre el cono |

Ninguno bloquea. Todos aparecen también en la pestaña Fases, junto al tramo.

---

## 4 · El anillo de acciones

### 4.1 Apertura y cierre

- Se abre con **un clic** sobre la ficha, centrado en ella.
- Se cierra con `Esc`, con un clic fuera, o al elegir una acción.
- Si la ficha ya tiene acciones en esta fase, el clic **sigue abriendo el anillo**
  (significa «y ahora qué hace»). Para retocar lo dibujado se pincha el trazo.

### 4.2 Anillo interior · contextual

Seis casillas rectangulares con icono y nombre, más una séptima «⋯ más».
El contenido depende del estado de la ficha en **ese instante de la fase**:

| Estado | Casillas |
|---|---|
| Con balón | Bota · Pasa · Tira · Entra · Finta · Para |
| Sin balón | Corta · Recibe · Bloquea · Recoge · Vuelve a la fila · Finta |
| Defensor | Defiende · Roba · Ayuda y recupera · Es sobrepasado · Cambia con… · Cierra el rebote |
| En una fila | Sale · Corta · Bota · Pasa · Vuelve a la fila · ⋯ |

«⋯ más» abre el catálogo completo en una lista buscable (incluye las acciones
que haya creado el club).

### 4.3 Anillo exterior · variantes técnicas

Al elegir una acción del anillo interior, **el anillo se transforma**: el centro
pasa a ser la acción elegida («Pasa — clic en la pista para el destino») y
alrededor aparecen sus variantes:

| Acción | Variantes de serie |
|---|---|
| Pasa | recto · picado · de béisbol · bombeado · mano a mano · por detrás |
| Bota | normal · cambio de mano · por la espalda · entre las piernas · reverso · protegido |
| Tira | en suspensión · bandeja · gancho · tras finta · palmeo |
| Entra | doble ritmo · reverso · eurostep · paso cero · bomba |
| Corta | recto · en L · en V · puerta atrás · rizo |
| Bloquea | directo · indirecto · ciego · de mano a mano |

- **La variante es opcional**: puedes ignorar el anillo exterior y pinchar
  directamente en la pista.
- **La variante no cambia la geometría**, solo la etiqueta, la frase, la fila de
  la rúbrica y **el vídeo** (§10).
- Se pueden crear variantes nuevas desde «⋯ más → nueva variante», con nombre,
  descripción y vídeo. Quedan disponibles para todo el club.

### 4.4 Qué pide cada acción

| Tipo | Qué pasa al elegirla |
|---|---|
| Con destino (bota, corta, entra, recoge, vuelve a la fila) | Entra en modo destino: dibujas el trazo (§5) |
| Sin destino (tira, finta, pivota, para, protege) | Se aplica al momento sobre la ficha y se dibuja su símbolo |
| Entre dos (bloquea, defiende, ayuda, cambia con…) | La ayuda pide «¿a quién?»; pinchas la otra ficha; **el que actúa se desplaza** hasta el sitio que le corresponde y se dibuja el símbolo de la relación |
| Pasa | Pide receptor: pinchas la ficha (o el suelo, y es un pase a un sitio) |
| Tira | Pide desenlace: **entra** o **falla** (dos botones grandes junto al aro) |

### 4.5 Encadenado

Terminado un tramo, **el anillo reaparece en la punta de la flecha**, ya
contextual al nuevo estado (si acabas de pasar, ya no tienes balón). Cada
elección **alarga el carril de esa ficha dentro de la misma fase**. Clic fuera o
`Esc` cierra y guarda.

### 4.6 Selección múltiple

Con varias fichas seleccionadas, la acción se aplica a todas:

- **Con destino**: cada una dibuja su propio trazo hacia el mismo punto, o —si
  mantienes `Alt`— dibujas uno y las demás lo copian trasladado desde su sitio.
- **Sin destino**: todas la ejecutan a la vez.
- **Entre dos**: no se permite; el anillo lo dice.

### 4.7 Atajos

`B` bota · `P` pasa · `T` tira · `C` corta · `E` entra · `R` recoge · `D` defiende ·
`X` bloquea · `F` finta · `N` fase nueva · `Supr` borrar · `Esc` cancelar.
Con una ficha seleccionada, la letra lanza la acción sin abrir el anillo.

---

## 5 · Dibujar el trazo

### 5.1 Los tres gestos (conviven)

| Gesto | Resultado |
|---|---|
| **Un clic** en el destino | Recta desde la ficha hasta ahí |
| **Clics sucesivos** | Polilínea, nodo a nodo; **doble clic** o `Intro` termina |
| **Arrastrar** | Trazo a pulso; al soltar se **suaviza** y se convierte en 4–8 nodos Bézier |

Suavizado: simplificación Ramer–Douglas–Peucker con tolerancia **0,25 m**, y
tangentes calculadas por vecinos (el algoritmo que ya usa `manejadoresTangentes`).

Mientras dibujas: la flecha sigue al puntero con su estilo real (blanca sólida
para carrera con balón, discontinua para corte, naranja punteada para pase), y
un rótulo dice **los metros y los segundos** que lleva.

### 5.2 Nodos

- **Arrastrar** un nodo lo mueve; sus manejadores le siguen.
- **Clic en la línea** inserta un nodo ahí, **ya curvado** (tangente al trazo,
  así que no da tirón). Es la decisión pedida: los nodos nuevos salen curvos.
- **Doble clic** en un nodo lo endereza o lo vuelve a curvar.
- `Supr` borra el nodo seleccionado (mínimo dos nodos).
- **Con el dedo**: al tocar un nodo salen dos botoncitos junto a él —curvar y
  borrar—, que desaparecen al tocar en otro sitio.

### 5.3 Nodos que no se pueden mover

Se dibujan como un aro pequeño discontinuo, y son consecuencia, no decisión:

- el **origen** de cualquier trazo (donde está la ficha),
- los **dos extremos de un pase** (pasador y receptor),
- el **origen de un tiro** y su punto de llegada al aro,
- el final del viaje de un rebote.

### 5.4 Al soltar

El tramo se reproduce **una vez, a 1,5×**, y las fichas se quedan en su posición
final. Nada entra en bucle.

### 5.5 Reanclado

Si cambia el arranque de un trazo (porque la fase anterior cambió), **el destino
se queda quieto** y el trazo se estira desde el nuevo origen. Los nodos
intermedios se reparten proporcionalmente.

---

## 6 · Fases, carriles y ramas

### 6.1 Qué es una fase

Una fase es un **compás con un carril por ficha**:

- Dentro de un carril, los tramos van **en serie**.
- Entre carriles, **en paralelo**.
- La fase dura lo que el carril más largo. Quien acaba antes se queda quieto.

### 6.2 Duración

Se calcula por **distancia y ritmo**:

| Ritmo | m/s |
|---|---|
| Andando | 1,5 |
| Normal | 4,0 |
| Sprint | 6,5 |
| Defensivo lateral | 2,5 |
| De espaldas | 2,0 |

Pases: **9 m/s**, mínimo 0,25 s. Tiros: 0,9 s hasta el aro más 0,3 s de vuelo.
Gestos: la duración que declare la acción (0,5–0,9 s).

Todo es ajustable: por tramo (panel derecho), por fase (cabecera) y globalmente
(velocidad de reproducción).

### 6.3 Arranques

Por defecto todos los carriles arrancan al principio de la fase, **salvo lo
evidente**:

- quien **recibe** un pase arranca cuando el balón llega;
- quien sale de un **bloqueo** arranca cuando el bloqueador ha llegado;
- quien **recoge** un balón arranca cuando el balón está suelto.

Cada tramo guarda su `inicio_ms`; arrastrar la barra en la línea de tiempo lo
cambia y entonces queda marcado como «a mano» (deja de recalcularse).

### 6.4 «Siguiente fase»

1. Reproduce la fase recién dibujada a 1×.
2. Deja a cada ficha en su posición final.
3. Crea la fase siguiente y la selecciona.
4. La pizarra queda lista para dibujar, con el **fantasma** de la fase anterior.

Al lado, «ver desde el principio» reproduce la jugada entera.

### 6.5 Editar una fase anterior

Se puede volver a cualquier fase y cambiarla. Al hacerlo:

- las posiciones de arranque de las siguientes **se recalculan**;
- los trazos de las siguientes **se reanclan** (§5.5) manteniendo su destino;
- si un trazo se queda sin sentido (su protagonista ya no existe, o su destino
  era una ficha borrada), **no se borra en silencio**: se marca en la pestaña
  Fases con «esto ya no encaja» y un botón para quitarlo.

### 6.6 Mover una ficha en una fase que no es la primera

**No se puede.** Su sitio ahí es consecuencia de la fase anterior. Al intentarlo,
la ficha no se mueve y la barra superior dice:

> «A1 llega aquí desde la fase 2. [Ir a la fase 2 y corregirlo]»

En la **fase 1**, mover una ficha es recolocarla y no tiene ninguna consecuencia
rara.

### 6.7 Ramas

- **Cualquier fase puede abrir hasta 3 ramas.**
- Cada rama tiene **nombre** («si le niegan el pase»), obligatorio.
- Cada rama continúa con sus propias fases.
- **Pueden reunirse**: una fase puede declararse como continuación común de
  varias ramas. La línea de tiempo lo dibuja con las dos flechas entrando.
- Al reunirse, las posiciones de arranque son las de la rama que se esté
  reproduciendo.
- La miniatura y la frase de la ficha usan **el camino principal** (la primera
  rama de cada cruce), marcado con un punto.
- En el proyector, al llegar al cruce la animación se para y aparece un cartel
  con los nombres de las ramas; se elige con el dedo o con `←` `→` (§10.2).

### 6.8 Operaciones sobre fases

Duplicar · insertar antes/después · borrar · reordenar arrastrando · renombrar ·
fijar duración y pausa · **guardar como plantilla** (§7.8).

---

## 7 · Los elementos

### 7.1 Jugadores

- **Sin límite de 5 por equipo** (se retira `MAX_POR_EQUIPO`).
- Cuatro equipos por color, como hoy.
- **Dorsal automático** por orden de colocación dentro del equipo, editable.
- **En juego / esperando**: quien está en pista y participa lleva dorsal; quien
  espera en una fila, no. Se deduce solo y hay un interruptor por ficha para los
  casos raros. Solo los que están **en juego** cuentan para la situación (§8.2).
- Nombre opcional (lo trae la plantilla del club).

### 7.2 Equipos

- **Genéricos** por defecto: Equipo 1…4, dorsales automáticos.
- **«Cargar equipo del club»**: trae nombres y dorsales reales del módulo de
  equipos. El ejercicio guarda solo los dorsales; los nombres son decoración de
  la pizarra y no se guardan con el ejercicio (un ejercicio no pertenece a una
  plantilla).
- Al cargar un segundo equipo con el primero ya colocado, **se coloca como
  defensa**: cada uno enfrente del atacante de su mismo dorsal, cumpliendo la
  regla defensiva del ejercicio (§8).

### 7.3 Balones

- **Multi-balón real.** El motor ya lo soporta; lo que faltaba era asignarlo.
- Dos formas de asignar: **arrastrar el balón sobre un jugador**, o seleccionar
  al jugador y pulsar «dale un balón» en el panel derecho.
- Asignado: el balón se centra en la ficha, que pasa a dibujarse como **jugador
  con balón** (anillo naranja).
- `Ctrl`+clic sobre una fila: un balón para cada uno de la cola.
- Arrastrarlo fuera de la ficha lo suelta ahí.
- Un jugador lleva **como mucho un balón**.
- La posesión viaja sola: pase, tiro, robo, recogida.

### 7.4 Conos

**Un solo tipo de cono.** El papel lo pone el contexto, en vivo mientras dibujas:

| Situación | Qué hace |
|---|---|
| Un cono a menos de **1,5 m** del trazo | El trazo lo rodea por el lado de entrada |
| **Tres o más** conos alineados cerca del trazo | Slalom alternando lados desde el lado de entrada |
| **Dos** conos a menos de **3 m** entre sí y el trazo cruza el segmento que los une, con uno a cada lado | **Puerta** (§7.4.1) |
| Cono junto al origen o al destino (< 1,0 m) | No pasa nada: se sale o se llega |
| Cono que es fila | Nunca se sortea: es un sitio, no un obstáculo |

Cada interpretación deja un **iconito sobre el trazo** (↻ rodeo · ⇄ zigzag ·
⌷ puerta). Un clic cambia el lado; otro la anula. Se guarda la intención
(«sorteando el cono 3 por la izquierda»), así que mover el cono rehace la curva.

#### 7.4.1 Puerta

Dos conos emparejados son una restricción, no un punto de paso:

- **El atacante pasa obligatoriamente entre ellos.** Cualquier trazo que cruce la
  banda de la puerta se imanta a pasar por dentro; si lo fuerzas por fuera, se
  marca en rojo (que es justo lo que el ejercicio quiere corregir).
- **El defensor que quede sobre la línea de la puerta queda confinado a ella**:
  se mueve solo por ese carril, que se dibuja como una banda fina. Su regla
  defensiva se proyecta sobre el carril (va al punto del carril más cercano al
  que le tocaría).
- El emparejamiento es automático por distancia y se puede deshacer en el panel.

#### 7.4.2 Fila

Un cono se convierte en cola desde el panel derecho o soltando un equipo encima:

- número de jugadores, equipo, **rol atacante o defensor**, un balón por cabeza;
- **rondas**: salen todos, uno tras otro, con cadencia opcional;
- **variación por ronda**: se puede decir que una ronda concreta haga otra cosa
  («el tercero tira en vez de entrar»);
- **orientación con tirador circular sobre la pista** (imán cada 15°, libre con
  `Shift`). Fuera el pad de ocho flechas;
- destino de vuelta: su propia cola u otra.

#### 7.4.3 Marca

Todo cono es un sitio con nombre («Cono 2»), renombrable, al que se puede mandar
a alguien y al que se imanta el destino. Aparece en el material de la ficha.

### 7.5 Zonas

Como en la v2.1 (rectángulo, círculo, línea; nombre; invisible; repartir conos
por el contorno a distancia regular), con dos añadidos: sus **vértices y puntos
medios son puntos de imán**, y su centro es un destino con nombre.

### 7.6 Material

Escalera (4,00 × 0,50 m) y pelota de tenis, con orientación por tirador. No
participan en la animación; ocupan sitio y salen en el material de la ficha.

### 7.7 Posiciones con nombre

- Las de la pista vienen puestas y no se pueden borrar.
- Marcar una propia: en modo destino, `Shift`+clic sobre suelo vacío crea
  «Posición 1», renombrable.
- **No se guardan por defecto.** En Ajustes hay «guardar para otros ejercicios».

### 7.8 Plantillas

- **Colocaciones**: guardar la disposición actual con un nombre («1-4 alto»,
  «5 abiertos»). Se insertan desde el panel izquierdo y **sustituyen o añaden**.
- **Fases**: guardar una fase o un grupo con un nombre («bloqueo directo»,
  «entrada por el 45»). Al insertarla, pide a qué fichas corresponde cada papel.
- Ambas son del club, como las acciones.

---

## 8 · La defensa

### 8.1 Emparejamiento

- **Por dorsal**: el defensor 3 defiende al atacante 3. Al soltar un defensor en
  la pista se coloca solo donde le toca según la regla vigente.
- Entre par y par se dibuja una **línea fina discontinua**. Arrastrarla a otro
  atacante cambia el par.
- Sin dorsal coincidente (números distintos, filas), se empareja con el atacante
  **libre más cercano**.
- Un atacante puede tener 0 o 1 defensor; un defensor, 0 o 1 par.

### 8.2 Situación

Se calcula **al empezar cada fase** contando los que están *en juego*, y no
cambia dentro de ella (nadie cambia de comportamiento a mitad de un movimiento):

| Situación | Comportamiento |
|---|---|
| Igualdad (n vs n) | Cada uno con su par, según la regla del ejercicio |
| **Inferioridad** (menos defensores) | Los emparejados siguen; los que sobran de ataque quedan libres y el defensor que quede sin par **retrasa y protege el aro** (§8.3) |
| **Superioridad** (más defensores) | Los que sobran forman **trampa** sobre el balón (§8.3) |

En Ajustes del ejercicio se puede **forzar** la situación.

### 8.3 Las reglas

Un preajuste para todo el ejercicio, y excepción por defensor:

| Regla | Dónde se coloca | Parámetros de serie |
|---|---|---|
| **Entre su par y el aro** | Sobre la línea par→aro | 1,2 m del par si lleva balón; 2,0 m si no |
| **Negar la línea de pase** | Sobre la línea balón→par, un paso hacia el balón | Solo si su par está a menos de 7 m del balón |
| **Ayuda y flota** | Se hunde hacia la línea balón→aro sin pasar de X del par | Hasta 3,5 m del par |
| **Presión al balón** | Pegado al portador, cortando el avance | 1,0 m |
| **Retrasa (inferioridad)** | Entre los dos atacantes, sobre la línea balón→aro, cediendo terreno | Sale al receptor solo cuando entra en zona de tiro |
| **Trampa (superioridad)** | Uno corta la línea al aro; el otro tapa la salida hacia el medio, formando una V sobre el portador | Separación 1,5 m |

Además: **«cierra el rebote»** se aplica sola tras un tiro que falla (el defensor
se interpone entre su par y el aro), salvo que tenga otra acción declarada.

Todos los números son ajustables por ejercicio.

### 8.4 Seguimiento

- **Continuo con retardo natural.** El defensor apunta a donde estaba su
  referencia hace **0,25 s** y se mueve como mucho a su velocidad lateral
  (2,5 m/s): así no teletransporta ni corta por dentro en las curvas.
- Se resuelve **al compilar**: se muestrea la trayectoria del par en **20 puntos
  por fase** y sale una polilínea. En reproducción no cuesta nada.
- Nunca atraviesa a su par: si coincidirían, se aparta a 1,0 m (§3.6).

### 8.5 Acciones propias del defensor

| Acción | Qué hace |
|---|---|
| **Roba / intercepta** | Va a por el balón (en el pase o en el bote) y se lo queda. **Cambian los papeles** (§8.6) |
| **Es sobrepasado** | Deja pasar al atacante y le persigue por detrás, a un metro largo, hasta el final de la fase |
| **Ayuda y recupera** | Va a tapar a otro atacante (lo señalas) y vuelve a su par al terminar la fase |
| **Cambia con…** | Intercambia el par con otro defensor (lo señalas). Vale tras un bloqueo, tras ser sobrepasado, o porque sí. El cambio **persiste** en las fases siguientes |
| **Cierra el rebote** | Se interpone entre su par y el aro y aguanta |
| **Va al dos contra uno** | Se suma a la trampa sobre el portador junto al defensor que ya está |

### 8.6 Cambio de papeles

Cuando un defensor roba:

- pasa a llevar el balón y a ser **atacante**;
- su equipo pasa a atacar y el otro a defender, con el emparejamiento invertido
  (el que era su par pasa a defenderle a él);
- la canasta objetivo **cambia a la contraria** si la pista tiene dos aros;
- se anota en la frase de la fase: «B2 roba y el equipo 2 pasa a atacar».

### 8.7 Ver por qué está ahí

Al seleccionar un defensor, la pizarra dibuja la regla que está cumpliendo: la
línea par→aro, el cono de la línea de pase, el radio de ayuda o la V de la
trampa. Se apaga al deseleccionar.

### 8.8 Romper la regla a propósito

En el panel derecho de un defensor, «esta fase lo hace mal»: queda quieto o va a
donde le mandes, y el motor no le corrige. Se marca con un aspa pequeña sobre su
ficha, para que se vea que es intencionado.

---

## 9 · El texto y la voz

### 9.1 La frase automática

Cada fase genera una frase en lenguaje de entrenador a partir de sus carriles:

> **Fase 2** — A1 bota hasta el codo derecho y pasa picado a A2, que ha cortado
> a la esquina. B1 le sigue por el lado de canasta.

Reglas de redacción: sujeto por dorsal, verbo de la acción, variante técnica si
la hay, destino por su nombre (aro, codo, cono 2, Posición 1, otro jugador), y
los automáticos de defensa al final, en una oración aparte.

### 9.2 Edición

La frase se puede reescribir; lo escrito manda **para la ficha y el paso 3**.
Un botón «volver a la automática» deshace.

### 9.3 La voz

- **`speechSynthesis` del navegador** (coste 0 €, sin conexión).
- Lee **siempre la frase automática**, no la reescrita, para que la narración sea
  uniforme entre ejercicios.
- **Al empezar cada fase**, en el proyector y en la ficha del ejercicio.
- Interruptor y velocidad en los controles de reproducción; se recuerda.
- El modelo deja hueco (`audio_url` por fase) para poner audios generados más
  adelante sin tocar nada más.

### 9.4 Lo que alimenta al paso 3

Al terminar, «llevar al paso 3» rellena con plantillas deterministas: contenido
(de las acciones usadas), etiquetas (acciones y variantes), material (lo que hay
en la pizarra), número de jugadores (los que están en juego), duración estimada
(la suma de las fases × rondas) y desarrollo (las frases de las fases). **Sin
IA.** El paso 3 se depura en otra tanda.

---

## 10 · Vídeos de técnica

### 10.1 Cuelgan de la variante

El vídeo se asocia a la **variante técnica** (pase picado, cambio por la
espalda), no al ejercicio. Se pone una vez y aparece en todos los ejercicios que
la usan. Sigue viviendo en la tabla por slug, ampliada a variantes.

Formatos: enlace de YouTube (con tramo desde/hasta) o de TikTok, como hoy. Para
los clips generados por IA, la vía de coste 0 es **subirlos a YouTube como no
listados**; queda anotado que Supabase Storage es la alternativa si se prefiere
control.

### 10.2 En el proyector

- **Columna lateral en bucle**: mientras la pista se anima, a la derecha se
  reproduce el clip de la variante de la fase en curso, **mudo, en bucle,
  recortado a los primeros segundos** (la demostración a velocidad normal).
- Al cambiar de fase, cambia el clip. Sin clip, la columna se pliega y la pista
  ocupa todo.
- **Se conserva la interrupción a pantalla completa** como opción, para explicar
  el desglose paso a paso.
- **Cartel de rama** (§6.7): al llegar a un cruce, la animación se para y salen
  los nombres de las ramas.

---

## 11 · Modelo de datos

### 11.1 La jugada (lo que se autoría)

```jsonc
{
  "version": 3,
  "pista": "media",
  "canasta": "norte",
  "elementos": [ /* jugadores, balones, conos, zonas, material — como hoy + */
    // jugador: { id, kind:'jugador', equipo, dorsal, nombre, en_juego, x, y,
    //            balon_id, defiende_a, regla_defensa }
    // cono:    { id, kind:'cono', nombre, x, y, fila: {...}|null, puerta_con: id|null }
  ],
  "defensa": { "preajuste": "individual", "parametros": { /* §8.3 */ }, "situacion": null },
  "fases": [{
    "id": "f1",
    "nombre": null,
    "duracion_ms": null,          // null = calculada
    "pausa_post_ms": null,
    "rama_de": null,              // id de la fase de la que cuelga
    "rama_nombre": null,          // «si le niegan el pase»
    "reune": ["f3a", "f3b"],      // fases que desembocan aquí
    "carriles": [{
      "elemento": "A1",
      "tramos": [{
        "accion": "bota",
        "variante": "cambio_de_mano",
        "args": { "destino": { "tipo": "ancla", "ref": "codo_derecho" },
                  "sorteando": [{ "cono": "cono_3", "lado": "izq" }],
                  "ritmo": "normal", "desenlace": null },
        "trazo": [ { "x":0.5,"y":0.8,"tipo_nodo":"lineal" }, /* … */ ],
        "inicio_ms": null,        // null = automático (§6.3)
        "duracion_ms": null,      // null = por distancia y ritmo
        "manual": false
      }]
    }],
    "texto": null                 // null = frase automática
  }]
}
```

Claves del diseño:

- **El destino es una referencia, no un punto**, siempre que se pueda (ancla,
  cono, zona, jugador, posición con nombre). Solo cuando es suelo vacío se
  guarda `{tipo:'punto', x, y}`. Es lo que hace que mover un cono rehaga la curva.
- **El trazo se guarda entero** junto a la intención. Si la intención se
  recalcula, el trazo se reancla (§5.5).
- **La defensa no se guarda como tramos**: se genera al compilar. Solo se guardan
  las **excepciones** (acciones declaradas y «lo hace mal»).

### 11.2 La animación (lo que se reproduce)

El compilador produce el JSON que consumen motor, proyector, miniatura y ficha.
Es el de hoy **con tres añadidos**:

- `inicio_ms` y `duracion_ms` por movimiento/pase/tiro (los carriles);
- `variantes: []` junto a `acciones: []` por fase (para los vídeos y la voz);
- `ramas: [{ desde, opciones: [{ nombre, fase }] }]` a nivel de animación.

`engine.js` se reescribe para honrar los instantes de arranque; el resto de
consumidores solo necesita ignorar lo que no entienda.

### 11.3 Persistencia

- Columna `animacion` (jsonb): la **animación compilada**, como hoy.
- Columna nueva `jugada` (jsonb): **la jugada**, para poder reabrirla y editarla.
- `poster` y `thumbnail`: igual que hoy.
- Migración: una sola `alter table exercises add column jugada jsonb`.

### 11.4 Lo guardado hasta hoy

- Se conservan **ficha, metadatos, etiquetas y la miniatura estática** con las
  posiciones iniciales.
- **Se pierde la animación**: el motor antiguo se borra entero. Al abrirlos, la
  ficha lo dice y ofrece «rehacer la pizarra», que arranca el editor nuevo con
  las posiciones iniciales ya colocadas.

---

## 12 · Arquitectura

### Se crea

```
taller/js/pizarra/
  pizarra.js        orquestador: estado, historial, atajos, montaje
  lienzo.js         CourtView + zoom/encuadre + capas de dibujo
  seleccion.js      selección simple/múltiple, marco, arrastre de fichas
  anillo.js         menú radial (interior, exterior, contextual)
  trazo.js          los tres gestos, suavizado, modo destino
  nodos.js          edición de nodos (ratón y dedo)
  iman.js           puntos de imán y guías de alineación
  fases.js          modelo de fases, carriles, tramos, ramas
  linea-tiempo.js   la tira de fases y los carriles
  paneles/
    izquierda.js    herramientas y elementos
    ajustes.js      panel contextual
    lista-fase.js   los carriles en texto
    descripcion.js  la frase por fase
  motor/
    compilar.js     jugada → animación
    defensa.js      reglas, situación, seguimiento, trampa
    conos.js        interpretación (rodeo, zigzag, puerta)
    duracion.js     distancias, ritmos, arranques
    frase.js        la frase automática (SALIDA, no entrada)
  voz.js            narración con speechSynthesis
```

### Se conserva

`canvas/court.js`, `medidas.js`, `escala.js`, `anclas.js`, `zonas.js`,
`symbols.js`, `arrows.js`, `geometry.js`, `colors.js`, `thumbnail.js`,
`marco-lectura.js` (revisado), `supabase/*`, `ui/*`, `history.js`.

`canvas/engine.js` se reescribe (carriles) conservando su interfaz pública.

### Se borra

`wizard/paso1.js`, `wizard/paso2.js`, `canvas/board.js`, `canvas/editor-canvas.js`,
`canvas/rest-positions.js`, `ia/frase.js`, `ia/compilador.js`, `ia/intencion.js`,
`ia/simulador.js`, `ia/resolver.js`, `ia/validador.js`, `ia/sujetos.js`,
`ia/posiciones.js` (lo que sobreviva se muda a `pizarra/motor/`), `ia/rondas.js`
(se reescribe dentro del motor nuevo), `ia/lint.js`, `ia/puente.js`,
`ia/molde.js` (lo que use el paso 3 se traslada).

`ia/acciones.js` **se conserva y se amplía** con las variantes técnicas: es la
pieza mejor resuelta del motor actual.

---

## 13 · Bancos de pruebas

Uno por módulo puro, en `taller/tools/`, todos en verde antes de dar nada por
terminado (regla del proyecto):

| Banco | Comprueba |
|---|---|
| `eval-duracion.mjs` | Distancias, ritmos, arranques automáticos, fase = carril más largo |
| `eval-conos.mjs` | Rodeo, zigzag, puerta, los cuatro casos límite de §7.4 |
| `eval-defensa.mjs` | Colocación por regla, situación, retardo, trampa, robo con cambio de papeles |
| `eval-fases.mjs` | Reanclado, editar una fase anterior, ramas, reunión de ramas |
| `eval-trazo.mjs` | Suavizado, nodos fijos, nodos nuevos curvos, reanclado proporcional |
| `eval-compilar.mjs` | Jugada → animación, ida y vuelta sin pérdida |
| `eval-frase.mjs` | Frase automática de cada combinación de acción y variante |

Y un banco visual (`tools/pizarra.html`) con doce jugadas de referencia —de un
1x0 de tiro a un 3x3 con ramas— para mirar con los ojos lo que los bancos miden.

---

## 14 · Plan por capas

Cada capa deja algo **utilizable de punta a punta** y con sus pruebas en verde.

| Capa | Qué queda funcionando al terminarla |
|---|---|
| **1 · El lienzo** | Pizarra con zoom, encuadre, paneles plegables, barra superior con ayuda, colocar y arrastrar fichas, guías e imán con Shift. Sin animación todavía |
| **2 · Dibujar** | Anillo contextual, los tres gestos de trazo, nodos, encadenado en la punta, reproducción del tramo al soltar. Una fase |
| **3 · Fases** | Carriles, duración por distancia, arranques, «Siguiente fase», línea de tiempo, editar fases anteriores, reanclado |
| **4 · El motor** | Compilador nuevo, `engine.js` con carriles, guardado de jugada + animación, reabrir y seguir editando |
| **5 · Defensa** | Emparejamiento, reglas, situación, seguimiento continuo, acciones del defensor, cambio de papeles, ver la regla |
| **6 · Conos y elementos** | Interpretación de conos, puertas, filas con tirador y rondas con variación, balones múltiples, equipos del club |
| **7 · Texto y voz** | Frase automática, panel de descripción, narración, «llevar al paso 3» |
| **8 · Ramas** | Ramas, reunión, cartel en el proyector |
| **9 · Variantes y vídeo** | Anillo exterior, catálogo de variantes, columna de vídeo en el proyector |
| **10 · Plantillas y remate** | Colocaciones y fases guardadas, selección múltiple, atajos, limpieza del motor antiguo, aviso en los ejercicios viejos |

---

## 15 · Fuera de esta reforma

- El paso 0 y el paso 3 (se depuran después, sin IA).
- La biblioteca, el planificador, las sesiones y el módulo de equipos.
- La generación de vídeos con IA (aquí solo se consumen).
- Audios de narración generados (queda el hueco en el modelo).
- El simulador automático de ataque-defensa: **se retira**.
