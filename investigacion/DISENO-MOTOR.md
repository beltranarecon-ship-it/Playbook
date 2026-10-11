# Diseño del motor y la Pizarra — decisiones tomadas

Fecha: 2026-10-04. Documento vivo de la sesión de diseño (preguntas y respuestas con el entrenador). Nada de esto está implementado todavía. Origen: `INFORME-FINAL.md` (investigación) y la prueba de la Pizarra en `dev/pizarra.html`, sin guardar nada.

Cuando algo se implemente, se anota en `PROGRESO-PIZARRA.md` y se pasa al `ESPEC-PIZARRA-v3.md`.

## 1. Punto de partida

El entrenador dice que el motor «sigue sin funcionar correctamente» y que hay que «entrenarlo y corregirlo hasta que sea capaz de generar ejercicios reales». El método acordado es **probarlo con ejercicios reales del club y corregir**.

Lo reproducido en la Pizarra de pruebas:

| Queja | Lo comprobado |
|---|---|
| No se puede mover una ficha ya puesta | En la fase 1 sí. En la fase 2 sale «A1 llega aquí desde la fase 1…». Es la regla §6.6. |
| «Siguiente fase» no crea fase | Con algo dibujado sí la crea. Con la fase vacía no hace nada visible (`tablero.js`, `siguienteFase`: avisa por `onNoPuede`, pero no se ve). |
| Variantes innecesarias | Confirmado: «Corta» abre un segundo anillo con cinco variantes (Recto, Puerta atrás, En V, En L, Rizo). |
| Acumulación de flechas | Se pinta el fantasma de la fase anterior (`_dibujarFantasma`, solo `iFase - 1`) debajo de la actual. |
| Entrada a canasta | «Entra a canasta» (`entra`) es de la familia de los desplazamientos: no suelta el balón. Solo «Tira» lo suelta (`compilar.js`, `modo === 'tiro'`). |
| Pase a quien corta | El pase apunta a un punto fijo y, por §6.3, el receptor espera a que llegue el balón. |

Sin reproducir todavía: «Balones» (sin detalle), «vuelve a la fila», orientación de fila, defensa, tiempo de creación, ejercicios complejos.

## 2. Dato clave: lo que piden los 204 ejercicios reales

Análisis de `tools/biblioteca/biblioteca.json` (204 ejercicios del club; texto de `descripcion_texto`). Son búsquedas por palabras, no una lectura ejercicio a ejercicio.

| Capacidad | Ejercicios | % |
|---|---|---|
| Tiro | 51 | 25 % |
| **Rotación** («se rota…», «rotan») | **44** | **21 %** |
| Rebote | 36 | 17 % |
| Parejas | 34 | 16 % |
| Conos | 30 | 14 % |
| Fila o cola | 24 | 11 % |
| Por turnos | 14 | 6 % |
| Bloqueo | 8 | 3 % |
| Pase en carrera | 7 | 3 % |
| Cambio explícito de rol o equipo | 3 | 1 % |

Tipos: Bote 37, 1vs1 37, Defensa 27, Pase 22, Tiro 22, 2vs2 19, Calentamiento 15, 3vs3 13. Pista: 176 de media y 28 entera.

Lectura: lo que más manda después del tiro es la **rotación de papeles**. Ejemplos reales: «se rota atacante, defensor y final de la fila», «el que anota o pierde el balón pasa a defender», «el que anota saca, el que sacó corre», «rotan las tres posiciones cada cinco repeticiones». Eso engloba tres cosas que el entrenador pidió por separado: volver a la fila para rotar, cambiar de equipo a mitad de ejercicio y repetir rondas.

## 3. Decisiones cerradas

### 3.1 Ritmo del movimiento

- La curva de velocidad depende del tipo de movimiento y se decide sola, sin selector (el pase sale rápido y no frena al llegar; la carrera arranca y frena suave).
- Una ficha que acaba un tramo y empieza otro sin espera ni pausa de fase **enlaza** sin frenar. Si hay pausa, frena como ahora.
- Los ejercicios ya guardados conservan la curva antigua; los nuevos o recompilados llevan un campo `ritmo` dentro de la animación, junto a la marca `motor` (`marca.js`). Sin ese campo se usa la curva de siempre.
- Implica que `compilar.js` marque en cada tramo si enlaza con el siguiente, también entre fases.

### 3.2 Arranques

- Se queda como está (§6.3): los tres casos automáticos y el arrastre «a mano». Sin selector «arranca cuando…».

### 3.3 Variantes de ejercicio

- Un campo nuevo `variante_de` enlaza cada ejercicio duplicado con el original, solo informativo (agrupar en la biblioteca, «variantes de este ejercicio», fin del «1-variante de 1-variante…»). Si se corrige el original, las variantes no cambian.

### 3.4 Validación

- No hace falta un validador nuevo para lo dibujado: la Pizarra ya evita los errores al dibujar. Se retoma para lo que llega de fuera (importar, enlaces) en el bloque de exportar y compartir.

### 3.5 Extras de visualización

- Se añade el **modo «yo»** para el jugador. No se añaden estela, cámara que sigue al balón ni «reducir movimiento».

### 3.6 Mover fichas en fases posteriores

- Arrastrar una ficha en la fase 2 o posteriores **corrige dónde llega** (se mueve el punto de llegada del trazo de la fase anterior) y lo que viene detrás se rehace solo. Si esa ficha no se movía, se recoloca desde donde se movió por última vez. Sustituye a la regla §6.6.

### 3.7 Cambio de equipo

- Una acción **«Cambia de equipo»** en el anillo, en la fase en curso: desde esa fase la ficha es del otro equipo (color y papel), y antes sigue como estaba.
- A revisar: puede quedar absorbida por la rotación de papeles (apartado 4).

### 3.8 Variantes de las acciones

- Las acciones se dibujan **directas** (un clic y su destino), sin segundo anillo. La variante, si alguien la quiere, se elige después en el panel Ajustes. Se conservan los datos y los vídeos del club.

### 3.9 «Siguiente fase»

- Crea **siempre** una fase nueva. Con algo dibujado, reproduce y crea; con la fase vacía, crea sin reproducir.

### 3.10 Entrada a canasta

- Es un requisito del entrenador: **tiro y entrada dejan el balón suelto**. La entrada acaba como un tiro, con su desenlace (entra o falla).

### 3.11 Pase a quien corta

- Se elige «pasa», se pincha **un punto del trazo del que corta** y el balón llega justo cuando él pasa por ahí. El receptor **no espera**: sigue corriendo y lo recoge.

### 3.12 Fantasma de la fase anterior

- Se combinan dos de las cuatro opciones: **solo la ficha elegida** y **fantasma más claro y sin puntas de flecha**.
- Sin ninguna ficha elegida: el fantasma claro y sin puntas de **todas** las fichas. Al pinchar una, se queda solo su rastro.

### 3.13 Volver a la fila

- Cuando alguien vuelve a la fila, **todos los de la cola avanzan un puesto** y el que vuelve se pone el último. En la siguiente ronda sale el siguiente.

### 3.14 Tiempo de creación

- Lo que más tiempo lleva, según el entrenador, es todo a la vez: colocar fichas una a una, dibujar cada acción, repetir fases parecidas y corregir lo que sale mal.

### 3.15 Rotación (decidido con el entrenador)

Se descartó la «regla por papeles» abstracta. La rotación es **espacial y se declara sobre los conos**:

- Se pincha el **cono que hace de fila** y sale una **barra de acciones** de cono, que incluye **«Establecer rotación»**.
- Se pincha el cono siguiente, y así sucesivamente. Los conos **se numeran** según esa rotación (1, 2, 3…).
- La cadena es un **ciclo cerrado**: desde el último cono se vuelve al 1.
- Un jugador con la acción **«rotar de fila»** va a la fila siguiente de la cadena y **se pone el último**. Los de la cola avanzan un puesto (§3.13).
- Quien llega a otra fila **toma su papel y su equipo** (atacante o defensor, y su color). Esto absorbe la acción suelta «Cambia de equipo» del §3.7: queda por decidir si se conserva para los casos que no sean rotación.
- Lo que rota, según el entrenador: atacante y defensor, posiciones de una tríada o pareja, fila y equipos enteros.

### 3.16 Banco de pruebas

- La biblioteca actual (204 ejercicios) **no sirve de referencia**: al entrenador no le gusta ninguno. Solo se usó para contar qué capacidades se piden.
- El banco son **diez ejercicios clásicos de base** propuestos y aprobados:

| # | Ejercicio | Qué prueba |
|---|---|---|
| 1 | Bandejas por filas | Fila, entrada con balón suelto, recoger, rotación |
| 2 | Pase y corte 2x0 | Pase a quien corta, entrada, rotación de filas |
| 3 | Tiro con rotación (tres conos) | Cadena de conos, ciclo 1→2→3→1, rebote |
| 4 | 1c1 desde la punta con rotación atacante/defensor | Cambio de papel y equipo, defensa |
| 5 | Zigzag con conos y bote | Conos, slalom, bote, rondas |
| 6 | Tres jugadores en línea (3 contra 0 en carrera) | Pases en carrera encadenados, pista entera |
| 7 | 3 contra 2 con vuelta 2 contra 1 | Defensa, cambio de posesión, contraataque |
| 8 | Bloqueo directo 2c2 | Bloqueo con destinatario, pase en carrera, defensa |
| 9 | Jugada 5x0 con ramas (colocación 1-4 alto) | Fases, ramas, colocaciones, bloqueo |
| 10 | Pases en parejas en movimiento (calentamiento) | Parejas, pase en carrera, rondas |

- Los 12 ejercicios de `dev/jugadas-referencia.js` (§13) ya existen y pasan `eval-referencia.mjs`. Se montan con llamadas internas del Tablero (`_trazoHecho`, `_elegir`…), **no** con gestos. Por eso pasan los bancos y aun así la pantalla falla: lo que falla está en la interacción y en capacidades que no existen.

### 3.17 Balones y defensa (lo que dice el entrenador)

- **Balones**, los cuatro fallos: no sigue al que bota; tras un pase queda mal; no se puede dar o quitar bien; con varios balones se confunde o duplica.
- **Defensa**: «no la he testeado lo suficiente»; no marca a quien debe; se coloca en sitios absurdos. Se afinará con el banco, no antes.

### 3.18 Velocidad de creación y «Cambia de equipo»

- Para acelerar la creación se incluyen **colocaciones de serie** y **copiar o repetir fase**. No se incluyen, de momento, poner un equipo entero de una vez ni los atajos de teclado.
- La acción **«Cambia de equipo»** se **conserva** aunque la rotación ya cambie el papel y el equipo (§3.7).

### 3.19 Capa 1 hecha (diagnóstico)

El resultado está en `investigacion/diagnostico/RESULTADOS-CAPA1.md`. Resumen: dos fallos medidos (la entrada no suelta el balón; el pase a quien corta cae a 0,07 del receptor) y once capacidades que faltan. Los fallos de balones que cuenta el entrenador **no salen con la API interna**: hay que reproducirlos con gestos en la pantalla.

## 4. Pendiente de decidir

1. ~~Rotación~~ (cerrada en el §3.15). Falta decidir si «Cambia de equipo» (§3.7) se conserva.
2. **Velocidad de creación.** Colocaciones de serie (1-4 alto, 5 abiertos, 2-3, 3-2, saque de banda…), poner un equipo entero de una vez, atajos para las acciones, copiar fase.
3. ~~Fantasma sin ficha elegida~~ (cerrada en el §3.12).
4. **«Balones».** Falta reproducir los cuatro fallos con el banco.
5. **Defensa.** Falta reproducirla con el banco.
6. **Orientación de la fila nada más ponerla:** el tirador circular debe aparecer al crear la fila.
7. ~~Banco de pruebas~~ (cerrado en el §3.16).
8. **Bloques de la investigación que quedan:** exportar y compartir (PDF, enlace, vídeo), biblioteca y ficha, sesiones, tableta y accesibilidad.
