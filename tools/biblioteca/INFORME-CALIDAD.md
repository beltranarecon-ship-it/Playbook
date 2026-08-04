# Informe de calidad de la biblioteca de ejercicios

**Fecha:** 4 de agosto de 2026 · **Alcance:** las 97 fichas importadas, las tres
vistas que las enseñan (ficha del Taller, visor del planificador, proyector), el
editor de animación y el buscador de la biblioteca.

**Método:** auditoría automática sobre la biblioteca compilada (distancias
medidas en metros reales sobre las anclas de pista), lectura del código de las
cuatro vistas y revisión como entrenador de una muestra de fichas de cada
bloque.

**Veredicto en una línea:** el texto de los ejercicios es sólido; lo que está
roto es la capa que los dibuja y la capa que los enseña. No hay que reescribir
la biblioteca, hay que arreglar el compilador, las vistas y una parte concreta
de las intenciones.

---

## Estado

| | |
|---|---|
| ✅ **Hecho** | Prioridad 1 (la ficha enseña lo que tiene), Prioridad 2 (geometría de las finalizaciones + cierre de ciclo, con reglas de linter que impiden la recaída y las 97 fichas actualizadas en Supabase) y Prioridad 3 (buscador y filtros). |
| ⬜ **Pendiente** | Prioridades 4 a 8: propagación en el editor, campo de organización para 12, miniaturas, niveles como dato, y la limpieza de coherencia que queda. |

Lo verificado sobre la base de datos después de los arreglos:

| Medida | Antes | Ahora |
|---|---|---|
| Finalizaciones que sueltan el balón lejos del aro | 13 de 16 | **0** |
| Ejercicios de fila que no cierran el ciclo | 7 | **0** |
| Ejercicios con el rebote recogido | 0 | **10** |
| Fases muertas («nadie se mueve») | 1 | **0** |
| Fichas de jugador inertes | 13 | **4**, todas legítimas |
| Campos de la ficha invisibles en el Taller | 13 + el desarrollo | **0** |
| Ejercicios que encuentra el filtro de tipo | 0 de 97 | **97** |
| Ejercicios alcanzables por el filtro de contenido | 45 de 97 | **97** |
| Campos sobre los que busca el buscador | 1 (el nombre) | **5**, y sin tildes |
| Casos en los dos bancos tocados (motor + linter) | 132 | **138**, todos en verde |

---

## 0 · Las dos causas raíz

Casi todos los defectos que se ven en pantalla salen de estas dos decisiones.
Arreglarlas de golpe cura muchos síntomas a la vez.

### Causa raíz 1 · El compilador *aproxima* el destino, y nadie declaró el real

`taller/js/ia/compilador.js:141`

```js
const FRACCION = { bote: 0.55, corte: 0.3, defiende: 0.25 };
```

Cuando una intención dice `hacia: 'canasta'`, el jugador **no llega a la
canasta**: avanza el 55 % del camino si bota, el 30 % si corta. Es un valor por
defecto razonable para «progresa hacia el aro» y desastroso para cualquier
acción de finalización, que por definición termina **en** el aro.

Como las tandas se escribieron usando `hacia: 'canasta'` en vez de coordenadas
explícitas, toda entrada a canasta de la biblioteca acaba siendo un tiro desde
media distancia. Es exactamente lo que se ve en pantalla.

### Causa raíz 2 · La animación es la única fuente de verdad de tres superficies

El mismo JSON alimenta el lienzo, el **guion automático** («paso a paso» del
visor) y el proyector. Un error geométrico no se queda en el dibujo: se
convierte en texto y se le cuenta al entrenador como si fuera el ejercicio.

Prueba, con el guion real que genera hoy `Slalom y entrada`:

> 1. El 1 bota hacia la línea de tiros libres.
> 2. El 1 tira desde la línea de tiros libres.

El slalom no aparece por ningún lado y la entrada es un tiro desde el tiro
libre. La ficha dice otra cosa completamente distinta. Y `Entradas por parejas
desde el 45`:

> 2. El 2 bota hacia el codo izquierdo.
> 3. El 2 tira desde el codo izquierdo.

Un ejercicio que se llama «entradas» y cuyo criterio de éxito habla del tablero
se está explicando como un tiro de media distancia desde el codo.

---

## 1 · Defectos de animación

### 1.1 · Las finalizaciones se dibujan como tiros — **13 de 16**

Distancia real desde donde arranca el balón hasta el centro del aro, en
ejercicios cuyo nombre, descripción o etiquetas hablan de entrada, doble ritmo,
bandeja o finalización:

| Distancia | Bloque | Ejercicio |
|---|---|---|
| **8,4 m** | calentamiento | Pases en movimiento por parejas |
| **6,8 m** | defensa | Ayuda y recuperación en 2c2 |
| **5,2 m** | tiro | Tiro tras corte |
| **3,8 m** | bote | Slalom y entrada |
| **2,5 m** | entrada | Entradas por parejas desde el 45 |
| 2,1 m | 1c1 | 1c1 con ventaja inicial |
| 2,1 m | tiro | Mecánica bajo el aro |
| 2,0 m | 1c1 | 1c1 tras recepción en carrera |
| 2,0 m | entrada | Finalización con contacto |
| 2,0 m | entrada | Mano cambiada bajo el aro |
| 2,0 m | 1c1 | 1c1 desde el poste alto |
| 1,8 m | entrada | Entrada con perseguidor |
| 1,8 m | entrada | Entrada desde el fondo |

Una entrada termina a 0,6–1,2 m del aro. `Mecánica bajo el aro` es el caso más
sangrante: la ficha dice literalmente «el tirador se coloca **a un metro** del
aro» y la pizarra lo pone a 2,1 m.

### 1.2 · Cuatro tiros imposibles en minibasket

| Distancia | Ejercicio |
|---|---|
| 8,4 m | Pases en movimiento por parejas |
| 6,8 m | Ayuda y recuperación en 2c2 |
| 6,8 m | Dos ayudas seguidas |
| 6,8 m | 1c1 con ayuda que llega |

La línea de tres está a 6,75 m. Un alevín no llega, y un ejercicio de
calentamiento que termina en un tiro de 8,4 m no es un calentamiento. En los
tres de defensa el problema es el mismo de siempre: el atacante de la esquina
recibe y «tira» sin haberse movido, y la esquina está lejos.

### 1.3 · Trece fichas de jugador que no se mueven nunca

Están dibujadas, ocupan sitio y no participan en ninguna fase. El entrenador
las ve y no entiende qué pintan.

| Inertes | Bloque | Ejercicio | Quién |
|---|---|---|---|
| 2 de 5 | tiro | Tiros libres con presión de equipo | B1, B2 |
| 2 de 5 | rebote | Bloqueo de rebote por parejas | A1, A2 |
| 2 de 6 | defensa | Dos ayudas seguidas | A2, B2 |
| 1 de 4 | pase | Triángulo de pase y sigue | B1 |
| 1 de 2 | juego-de-pies | Parada y salida ante el cono | B1 |
| 1 de 4 | defensa | Ver balón y ver a mi par | A1 |
| 1 de 2 | entrada | Mano cambiada bajo el aro | B1 |
| 1 de 5 | juego-de-2 | Bloqueo indirecto para el tirador | B2 |
| 1 de 4 | bote | Bote y pase al que aparece | A2 |
| 1 de 4 | rebote | Rebote en superioridad | A1 |

Los casos de `rebote` son los peores: en **Bloqueo de rebote por parejas** los
dos que no se mueven son justo los que tienen que bloquear el rebote. El
ejercicio enseña lo contrario de lo que dice.

### 1.4 · Siete ejercicios de fila no cierran el ciclo

Terminan con el balón en el aro y el jugador plantado allí. Nadie coge el
rebote y nadie vuelve a la fila; al repetirse el bucle, el jugador reaparece de
golpe en su sitio. La ficha sí describe la vuelta («coge su rebote y vuelve al
final de la fila por fuera»), pero la animación no la enseña.

`Slalom y entrada` · `Entradas por parejas desde el 45` ·
`Parada y salida ante el cono` · `Tiro tras bote con parada` ·
`Parada en un tiempo tras recepción` · `El rey de la pista` ·
`Tiro desde el lateral en carrera`

### 1.5 · El slalom no existe en el guion

El compilador teje los conos en el trazado (`rodea_cono`), pero el generador de
guion no verbaliza ese evento. Resultado: el ejercicio estrella del bloque de
bote se explica por escrito como «bota hacia la línea de tiros libres».

### 1.6 · Una fase muerta

`Ayuda y recuperación en 2c2`, fase 2 de 4: el guion dice «Pausa (nadie se
mueve)». Justo la fase donde el ayudante debería estar recuperando a su par.

### 1.7 · Catorce ejercicios analíticos sin animar

De los 32 sin fases, 18 son juego abierto, psicomotricidad o calentamiento —
esos van sin animar a propósito (decisión tomada: animar un juego abierto es
enseñar una jugada cerrada donde debe haber lectura). Los otros **14 sí tienen
una secuencia concreta que contar** y se quedaron en foto fija:

`Los cuatro cuadrantes` · `Cuatro esquinas con intruso` · `Números y bote` ·
`El túnel` · `Espejo defensivo` · `Rondo 4c2` · `Dos balones y un compañero` ·
`Manejo en el caos` · `Pivotar con presión` · `Tres contra tres al rebote` ·
`Duelo de tiro por equipos` · `El reloj` · `Pasar sin mirar la pared` ·
`Bote sentado y de rodillas`

---

## 2 · La ficha: qué se enseña, qué se esconde, qué sobra

### 2.1 · La descripción del ejercicio es invisible

`taller/js/views/detalle.js:109-131` — la función `ficha()` pinta tipo,
categoría, dificultad, duración, autor, tres filas de material que no existen,
las etiquetas, objetivos, variantes y notas.

**No pinta `description` ni `descripcion_texto`.** El desarrollo del ejercicio
—el campo más largo y más útil de la ficha, el que dice cómo se monta y qué se
corrige— no aparece en la vista de detalle. Es el defecto número uno que
reportaste y está confirmado.

Incoherencia añadida: el **visor del planificador** sí lo enseña, bajo el título
«La idea» (`equipos/js/ui/visor.js:198`). Dos vistas de la misma ficha con
contenido distinto.

### 2.2 · Trece campos de `requisitos` que nadie ve nunca

La ficha del Taller busca `requisitos.jugadores`, `requisitos.balones` y
`requisitos.conos`. **Esos tres campos no existen en ninguna de las 97 fichas.**
Las tres filas se descartan siempre en silencio (la función `row()` devuelve
`null` si el valor es `undefined`).

Lo que sí existe, y no se enseña en ningún sitio:

| Campo | Qué contiene | Por qué importa en el pabellón |
|---|---|---|
| `jugadores_min` / `jugadores_max` | 2–16 | decide si el ejercicio entra hoy con los que han venido |
| `canastas` | 0–2 | decide si cabe con lo que hay libre |
| `estaciones` | 1–4 | decide cuántos grupos se montan |
| `material` | balones, conos, petos, aros | lo que hay que sacar del armario |
| `densidad` | alta / media / baja | cuánto trabaja cada niño |
| `oposicion` | nula / pasiva / semiactiva / real | dónde cae en la progresión |
| `requisito_previo` | qué hay que saber ya | si el grupo está listo o no |
| `dosis` | series, cantidad, unidad, descanso | **cuánto se hace** |
| `criterio_exito` | cuándo está bien hecho | cómo se compite y se corrige |
| `aplicacion` | dónde se transfiere | por qué el analítico no es gratis |
| `justificacion_densidad` | por qué se acepta baja | control de calidad |
| `simultaneo` | si todos trabajan a la vez | organización |

La dosis y el criterio de éxito son lo que un entrenador mira treinta segundos
antes de empezar. Hoy hay que abrir la base de datos para verlos.

### 2.3 · El proyector recibe seis datos y usa uno

`detalle.js:81` le pasa al proyector `tipo`, `dificultad_label`,
`duracion_min`, `categoria_rama`, `categoria_nivel` y `requisitos`.
`proyector.js:34` solo usa `meta.nombre`. Todo lo demás se descarta.

El proyector es la pantalla que se mira **en la pista, con el balón en la
mano**. Debería enseñar la dosis, el criterio de éxito y los puntos clave. Hoy
enseña un título.

### 2.4 · Los tres niveles de exigencia están enterrados en prosa

Cada ficha tiene sus tres niveles, y son buenos:

> Base: a un metro del aro y sin saltar, sentado o de rodillas si hace falta
> para quitar las piernas de la ecuación. Intermedio: de pie, a dos metros,
> alternando los dos lados del poste bajo. Avanzado: desde el codo, y cada dos
> tiros uno tras recepción del compañero.

Están metidos en un único campo de texto `variantes`. Consecuencias: no se
pueden filtrar («enséñame la versión base de todo»), no se pueden enseñar como
tres opciones seleccionables, y en pantalla salen como un párrafo denso que
nadie lee con prisa. El eje de exigencia —que es **la** decisión de diseño de
esta biblioteca— no existe como dato.

### 2.5 · Las 97 fichas dicen «Minibasket» y eso contradice la doctrina

`categoria_rama` = `Minibasket` en las 97. `categoria_nivel` está vacío en 91,
que es lo correcto (D9: el eje es la exigencia, no la edad). Pero la rama sigue
etiquetando toda la biblioteca como minibasket, así que la ficha le dice al
entrenador «Categoría: Minibasket» en ejercicios que valen perfectamente para
infantil o cadete subiendo el nivel de exigencia.

O la rama se vacía también, o pasa a ser un rango («desde Escuela»), o se
sustituye por el nivel de exigencia, que es lo que de verdad la ordena.

### 2.6 · La rejilla de la biblioteca son 97 tarjetas de texto idénticas

El importador (`tools/biblioteca/importar.mjs:145-168`) no escribe `poster` ni
`thumbnail`. La tarjeta tiene sitio para una miniatura y el *hover* está
programado para cambiar el póster por un GIF animado
(`js/app.js:131-144`) — código que hoy no hace nada porque no hay imágenes.

Con 97 ejercicios, elegir uno leyendo 97 títulos es el peor caso posible. La
miniatura no es decoración: es el mecanismo de búsqueda visual.

### 2.7 · Falta el campo más útil de todos: cómo se monta con los que hay

No existe ningún campo que diga **cómo se organiza el grupo**. La pizarra
dibuja una muestra (2 a 4 jugadores en 62 de las 97 fichas) y la ficha declara
`jugadores_max` y `estaciones`, pero nadie escribe en ninguna parte:

> Con 12: seis parejas, tres en cada canasta, rotación cada 2 minutos.

Eso es lo que hace falta a las siete de la tarde con doce niños delante, y es
justo lo que hoy hay que improvisar. De aquí viene tu sensación de que
«algunos ejercicios no tienen sentido en un grupo de 12»: casi todos escalan
bien, pero **ninguno explica cómo**.

---

## 3 · El editor: la propagación entre fases

### 3.1 · La ficha se recoloca, la flecha no

Confirmado y medido. Sobre `Entradas por parejas desde el 45`, arrastrando el
final del bote de la fase 2 hasta el aro:

```
antes    fin del bote ............... (0,279 · 0,425)
antes    el tiro de la F3 sale de ... (0,279 · 0,425)   ✓ pegados

después  la ficha arranca la F3 en .. (0,190 · 0,500)   ✓ se recoloca
después  el tiro sigue saliendo de .. (0,279 · 0,425)   ✗ flecha huérfana

desfase entre el jugador y el origen de su propia flecha: 2,1 m
```

La causa está en `editor-canvas.js:103`: al arrastrar se llama a `refresh()`,
que recalcula `restPositions(anim)` —las **posiciones** de inicio de cada
fase— pero no toca los `path` de las fases siguientes. El jugador aparece en
su sitio nuevo y su flecha sale de donde estaba antes.

Es exactamente lo que pediste: **al mover una flecha, la fase siguiente debe
recalcular sus flechas en función de dónde está ahora el jugador y dónde está
el balón.**

### 3.2 · En los pases, mover la flecha no mueve nada

`rest-positions.js:22` coloca el balón en la posición **del receptor**, no en el
final del trazado del pase. Así que arrastrar el final de una flecha de pase no
mueve ni al receptor ni al balón: la flecha queda apuntando a un sitio donde no
va a pasar nada. Es peor que no propagarse, porque no da ninguna señal de que
la edición no ha servido.

### 3.3 · El editor no permite añadir ni quitar acciones

Se pueden editar los nodos de las flechas que ya existen, y añadir o borrar
fases vacías. No hay forma de **añadir un movimiento, un pase o un tiro** a un
jugador. Si a un ejercicio le falta el rebote y la vuelta a la fila —los siete
del punto 1.4— no se pueden añadir desde la aplicación.

### 3.4 · El contenido de la ficha no es editable en ningún sitio

El panel de metadatos del editor (`editor.js:125-131`) ofrece tres controles:
duración, dificultad e intensidad. No hay campo para nombre de bloque,
descripción, desarrollo, objetivos, variantes, notas, etiquetas ni requisitos.
Corregir una errata en una descripción hoy exige tocar la base de datos.

### 3.5 · Dos escalas de dificultad conviviendo

`js/config.js:22` define `DIFFICULTY_LABELS` de 1 a 5 con cinco nombres
(Iniciación, Básico, Medio, Avanzado, Experto). `taller/js/config.js:31`
define `dificultadDe()` de 1 a 6 con tres (Iniciación, Medio, Avanzado). El
deslizador del editor va de 1 a 6. La misma columna se lee con dos reglas
distintas según la pantalla.

---

## 4 · Coherencia entre lo escrito y lo dibujado

### 4.1 · El texto dice una cosa y la pizarra otra

| Ejercicio | Texto | Pizarra |
|---|---|---|
| Triángulo de pase y sigue | «Tres filas» | 0 filas, 4 jugadores sueltos |
| Entradas por parejas desde el 45 | «con dos balones el ejercicio no para» | 1 balón |
| Dos balones y un compañero | «dos balones» | 4 balones |

### 4.2 · Ocho fichas declaran oposición y no dibujan a nadie que se oponga

| Oposición declarada | Ejercicio |
|---|---|
| real | Relevo de calentamiento por equipos |
| semiactiva | Ida y vuelta: tiro con fatiga |
| pasiva | Los cuatro cuadrantes · Concurso de las cinco estaciones · Manejo en el caos · El reloj · Rebote a dos manos y salida · Cadena de nombres |

En varios la oposición es real pero no es un defensor (competir contra otro
equipo, o contra el reloj). El campo `oposicion` está mezclando dos cosas
distintas: **si hay alguien defendiendo** y **si hay presión competitiva**. Son
ejes independientes y deberían ser dos campos.

### 4.3 · Veinticinco fichas dibujan menos gente de la que declaran necesitar

Ejemplos: `Dos contra uno continuo` pide 6 y dibuja 3; `Balance defensivo` pide
6 y dibuja 4; `Triángulo de pase y sigue` pide 6 y dibuja 4.

No siempre es un error —dibujar una muestra representativa es legítimo— pero
hoy no hay forma de distinguir «la pizarra es una muestra» de «a la pizarra le
faltan jugadores». Hace falta declararlo (ver 2.7).

### 4.4 · `estaciones` y `canastas` no se pueden interpretar

63 fichas declaran `estaciones: 2` y `canastas: 1`. ¿Una canasta en total, o una
por estación? Está definido como «por estación», así que en realidad hacen
falta dos aros — pero el dato, leído tal cual, dice uno. Como además no se
enseña en ninguna pantalla, hoy da igual; en cuanto se enseñe, hay que
desambiguarlo o mentirá.

### 4.5 · Una cola de cinco (la doctrina fija cuatro)

`Slalom y entrada`. Con pista entera y dos canastas no hay excusa: se duplica
la estación.

---

## 5 · Buscador, filtros y taxonomía

### 5.1 · El filtro de tipo no encuentra nada. Ninguna opción, nunca.

`app.html:91-97` ofrece: técnico · táctico · físico · juego.
Las 97 fichas tienen: Bote · 1vs1 · Pase · Tiro · 2vs2 · Defensa ·
Contraataque · 3vs3 · Calentamiento · 4vs4.

**Coincidencias: 0 de 4.** Elegir cualquier opción del desplegable vacía la
rejilla.

La causa es que hay dos vocabularios para la misma columna: `EXERCISE_TYPES` en
`js/config.js:17` y `TIPOS_EJERCICIO` en `taller/js/config.js:13`. El Taller
escribe con el segundo, la biblioteca filtra con el primero.

### 5.2 · El filtro de categoría no alcanza a 52 de los 97

El desplegable ofrece 10 categorías, de las cuales 4 (**ataque, transición,
bloqueo, presión**) no existen en ninguna ficha. Y 8 de los 14 bloques de
contenido reales **no están en el desplegable**: manejo, entrada,
juego-de-pies, 1c1, juego-de-2, juego-reducido, calentamiento,
psicomotricidad.

Es decir: más de la mitad de la biblioteca es inalcanzable por categoría, y
justo los bloques con más fichas.

### 5.3 · La búsqueda solo mira el nombre

`js/modules/ejercicios.js:13` filtra en el servidor con `ilike` sobre `name`, y
`js/app.js:172` vuelve a filtrar en el cliente, otra vez solo por `name`.
Buscar «doble ritmo», «cambio de mano» o «ayuda» —que están en las
descripciones y en las etiquetas de decenas de fichas— no devuelve nada.

Las etiquetas existen (5 de media por ficha, 66 términos controlados) y no se
buscan.

### 5.4 · Se descarga la biblioteca entera, con imágenes y sin paginar

`getEjercicios()` pide `poster` para todas las filas y no pagina. Hoy no duele
porque no hay pósters, pero en cuanto se generen las miniaturas del punto 2.6
la primera carga se convierte en varios megas. Y PostgREST corta en 1000 filas
sin avisar.

### 5.5 · Los escuchadores del buscador se acumulan

`showEjercicios()` llama a `setupEjerciciosToolbar()` cada vez que se entra en
la vista, y esa función añade escuchadores nuevos sin quitar los anteriores.
Volver a la pestaña de ejercicios cinco veces deja cinco escuchadores; cada
tecla dispara cinco repintados.

### 5.6 · Dos claves públicas distintas para el mismo proyecto

`js/config.js:7` usa la clave anónima JWT antigua; `taller/js/config.js:9` usa
una `sb_publishable_`. Las dos son públicas y las dos funcionan, así que no es
un problema de seguridad — pero al rotar claves hay que acordarse de los dos
sitios, y ya sabemos cómo acabó la última vez que hubo una clave en un config.

---

## 6 · Qué hacer, por orden

Ordenado por relación entre lo que arregla y lo que cuesta.

### Prioridad 1 — Que la ficha enseñe lo que tiene *(medio día)*

Reescribir `ficha()` en `detalle.js` para que enseñe el desarrollo, la dosis, el
criterio de éxito, el requisito previo, la aplicación, la densidad y la
oposición; y quitar las tres filas que buscan campos inexistentes. Alinear el
visor del planificador con la misma ficha. **Cero riesgo, y de golpe la
biblioteca deja de parecer vacía.**

### Prioridad 2 — Arreglar la geometría de las finalizaciones *(1 día)*

Dos cosas a la vez:

1. En el compilador, añadir un tipo de evento `finaliza` (o admitir
   `hacia: 'aro'`) que lleve al jugador **al aro**, no al 55 % del camino.
2. Repasar las intenciones de las 13 fichas del punto 1.1 para que la
   finalización termine donde tiene que terminar, y añadir rebote y vuelta a la
   fila en las 7 del punto 1.4.

Esto cura el dibujo, el guion y el proyector de una sola vez.

### Prioridad 3 — Que los filtros encuentren los ejercicios *(2 horas)*

Unificar el vocabulario de `type` en un único sitio y generar los dos
desplegables **desde los valores que hay en la biblioteca**, no desde una lista
escrita a mano que se desincroniza sola. Extender la búsqueda a descripción y
etiquetas.

### Prioridad 4 — Propagación en el editor *(1 día)*

Recalcular los `path` de las fases siguientes cuando cambia una anterior:
reanclar el primer nodo de cada flecha a la posición real del jugador, y el
origen de pases y tiros a la posición real del balón. Y decidir qué significa
arrastrar el final de un pase (o bloquear ese nodo, que también es una
respuesta válida).

### Prioridad 5 — El campo de organización *(medio día + repasar 97 fichas)*

Añadir `organizacion` a `requisitos` y escribirlo en las 97: cuántos grupos,
en qué canastas, cada cuánto se rota, con 12. Es el campo que más se va a leer.

### Prioridad 6 — Miniaturas *(medio día)*

Generar póster y GIF de las 97 en una pasada de navegador (`thumbnail.js`
necesita `document`). Es la única pieza pendiente que ya está programada y solo
le faltan los datos.

### Prioridad 7 — Los tres niveles como dato *(medio día + repasar 97)*

Sacar base/intermedio/avanzado de `variantes` a un campo estructurado. Habilita
filtrar por exigencia, que es el eje que ordena esta biblioteca.

### Prioridad 8 — Limpieza de coherencia

Las 14 fichas analíticas sin animar (1.7), las 13 fichas de jugador inertes
(1.3), los 3 desajustes texto/pizarra (4.1), la separación de `oposicion` en
dos campos (4.2), la cola de cinco (4.5), la rama «Minibasket» (2.5), las dos
escalas de dificultad (3.5) y los escuchadores acumulados (5.5).

---

## Anexo · Lo que está bien y no hay que tocar

Para que el informe no engañe: la parte cara ya está hecha y aguanta.

- **El texto de las 97 fichas.** Objetivos, desarrollo, variantes y notas están
  escritos como los escribiría un entrenador, con puntos clave, errores
  frecuentes y la corrección que más rinde. Ninguna de las correcciones de
  arriba obliga a reescribirlos.
- **La doctrina y el mapa de cobertura.** Las decisiones D1–D23 con evidencia
  siguen siendo válidas; los defectos de este informe son incumplimientos de la
  doctrina, no fallos de la doctrina.
- **El linter.** Encontró un defecto real en cada tanda. Lo que no cubría son
  precisamente las comprobaciones geométricas de este informe: se le pueden
  añadir como reglas nuevas y entonces ninguno de estos fallos vuelve a entrar.
- **El compilador determinista.** La arquitectura —intención declarada,
  geometría calculada— es la correcta. El defecto está en una constante y en un
  tipo de evento que falta, no en el diseño.
- **El motor de animación, el visor y el proyector.** Funcionan; el problema es
  lo que les llega y lo que deciden enseñar.
