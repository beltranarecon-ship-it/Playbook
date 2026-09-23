# Progreso de la Pizarra v3

Registro para poder retomar el trabajo después de cualquier corte —de
créditos, de sesión o del ordenador— sin empezar de nuevo. Se actualiza al
cerrar cada paso. La especificación que manda es `ESPEC-PIZARRA-v3.md`.

**Cómo retomar:** leer «Dónde estamos» y «Siguiente paso», comprobar que
`git status` está limpio y que los bancos pasan, y seguir por ahí.

```bash
git status --short --branch        # rama pizarra-v3, sin cambios
node taller/tools/eval-fases.mjs   # y el resto de bancos: todos en verde
```

---

## Dónde estamos

**Decisión del entrenador (2026-09-13): NADA se sube a `main` ni se
publica hasta que estén acabadas TODAS las capas (1 a 10).** Todo sigue
en la rama `pizarra-v3`. La 043 ya está aplicada.

**Capa 5, decidido (2026-09-13):** ataca el equipo que tiene el balón al
empezar y los demás defienden (se puede cambiar en los ajustes); los
ajustes de la defensa van en la pestaña «Ajustes» del panel derecho,
solo con lo de la defensa; entran además los tiros con su desenlace y
el «pincha a quién» con el bloqueo; «romper la regla a propósito»
(§8.8) NO entra en esta capa.

| Capa | Estado | Último commit |
|---|---|---|
| 1 · Lienzo, zoom, gestos, fichas | ✅ cerrada | `57255ed` |
| 2 · Dibujar: anillo, trazo, nodos, encadenado, repaso | ✅ cerrada | `2db2b91` |
| 3 · Fases: carriles, arranques, «Siguiente fase», línea de tiempo, editar fases anteriores | ✅ cerrada | `63d4cf6` |
| 4 · El motor | ✅ cerrada en la rama `pizarra-v3` (043 aplicada) | `1a4097c` |
| 5 · Defensa | ✅ cerrada en la rama `pizarra-v3` (pasos 5.0 a 5.7) | `fba775b` |
| 6 · Conos y elementos | ✅ cerrada en la rama `pizarra-v3` (pasos 6.0 a 6.7; los equipos del club, para más adelante) | ver «Capa 6» |
| 7 · Texto y voz | pendiente | — |
| 8 · Ramas | pendiente | — |
| 9 · Variantes y vídeo | pendiente | — |
| 10 · Plantillas y remate | pendiente | — |

Las capas 1 a 3 están en `main` en GitHub; la 4 está en la rama
`pizarra-v3`, subida, y **no en `main`**. Bancos: **68 en verde, 1668
pruebas**, más el del linter de la biblioteca (`node
tools/biblioteca/lint.prueba.mjs`, 52/52), que no entra en el recuento y
hay que lanzar aparte. Arneses: `dev/pizarra.html` (la pantalla) y
`dev/pizarra-dibujar.html`.

## Capa 5, paso a paso

Plan confirmado por el entrenador el 2026-09-13. Sale de un mapa de solo
lectura (6 lectores, uno por subsistema, y un crítico que ordenó los
pasos y separó las preguntas de verdad). Cada paso deja algo que se prueba
de punta a punta, con sus bancos en verde y commit en la rama.

| Paso | Qué queda funcionando | Estado |
|---|---|---|
| 5.0 | Arreglos que la capa destapa, ya fallando en la capa 4: recoger y pasar en la misma fase (el balón volvía al que recogió), tirar-recoger-tirar, tiro sin trazo que sale del sitio del principio. Un módulo puro del INSTANTE (muestreo, posición y dueño en t) compartido por el motor y el repaso. Guion de Equipos: el balón contado por instante | ✅ (61 bancos, 1363 pruebas; las 6 pruebas nuevas fallan con el código viejo) |
| 5.1 | Tiros con desenlace: Tira → Entra/Falla → al aro; si falla rebota a ~2,5 m por el lado contrario al tirador, si entra cae bajo el aro suelto; «Recoge» lo encuentra. Entra/falla se cambia tocando el tiro | ✅ (61 bancos, 1376 pruebas; probado en la Pizarra: tirar, cambiar el desenlace, recoger el rebote, compilar y reabrir) |
| 5.2 | «Pincha a quién» y bloqueo: se pincha al COMPAÑERO, el bloqueador va a su sitio, el compañero sale cuando llega. Formato: `bloqueado_id` = compañero + `defensor_id` opcional | ✅ (61 bancos, 1395 pruebas; probado en la Pizarra y en el motor: elegir, avisos, Esc y suelo, Supr, arranque, compilar y reabrir) |
| 5.3 | Papeles y pares: `motor/defensa.js` + `eval-defensa.mjs`. Quién ataca, pares por dorsal y libre más cercano, situación por fase, arco del defensor y línea discontinua | ✅ (63 bancos, 1432 pruebas; revisión adversarial con 11 hallazgos confirmados, todos arreglados; banco nuevo del Tablero; probado en la Pizarra) |
| 5.4 | Colocar por regla (las 6 del §8.3), pestaña «Ajustes» del panel derecho (solo defensa) y ver la regla (§8.7) | ✅ (64 bancos, 1474 pruebas; revisión adversarial de 28 hallazgos, arreglados los ciertos; bancos nuevos eval-ajustes y más pruebas de defensa) |
| 5.5 | Seguimiento continuo (§8.4): la defensa se mueve sola igual en Pizarra y proyector; movimiento «por tiempo» en el motor (aditivo); cierra el rebote automático; carril gris «automático» | ✅ (65 bancos, 1507 pruebas; 16 mutantes, los 16 muertos; probado en la Pizarra y en el motor sobre la misma jugada) |
| 5.6 | Acciones declaradas del defensor: ayuda y recupera, es sobrepasado, cambia con…, cierra el rebote, va al dos contra uno | ✅ (65 bancos, 1531 pruebas; 23 mutantes, los 23 muertos; probado en la Pizarra: anillo, «pincha a quién», panel y carriles) |
| 5.7 | Robo, rebote defensivo y canasta: cambio de papeles y de aro desde la fase siguiente. Cierre de la capa | ✅ (65 bancos, 1552 pruebas; 20 mutantes, los 20 muertos; probado en la Pizarra: robar, cambiar de papeles y de aro) |

**Respuestas del entrenador (2026-09-13):**

- Sin atacante claro (nadie tiene el balón, o lo tienen dos equipos):
  **nadie defiende** hasta elegirlo en Ajustes, que ofrece además
  «nadie defiende» (ejercicios de dos colores sin oposición).
- Cambian los papeles: **el robo, el rebote defensivo y la canasta
  anotada**. El que roba o recoge se queda el balón en ese instante; el
  resto cambia de papel (y de aro, si hay dos) **desde la fase
  siguiente** —así casan el §8.2 («nadie cambia a mitad de fase») y el
  §8.6—.
- El robo se señala **pinchando al portador (en el bote) o el trazo del
  pase (intercepción)**; lo que el receptor tuviera dibujado después se
  marca «ya no encaja».
- Tras el tiro: si **falla**, rebota solo a ~2,5 m del aro por el lado
  contrario al tirador; si **entra**, cae bajo el aro y queda suelto.
- Guion de Equipos: **adaptarlo lo mínimo** (la defensa automática en una
  frase aparte, desenlace, robo y balón por instante).
- Números que la especificación no fija, **aceptados** y ajustables por
  ejercicio: paso hacia el balón de negar = 0,8 m; zona de tiro de
  retrasa = 6,75 m del aro; «metro largo» de es sobrepasado = 1,2 m;
  cierra el rebote a 0,8 m de su par hasta el final de la fase.
- Movimientos automáticos de la defensa al reproducir: **sin flecha**.

**Decidido sin preguntar (se le dijo al entrenador):** bloqueo pinchando
al compañero; un defensor arrastrado en la fase 1 se queda donde se deja
y la regla lo lleva desde ahí (al sacarlo del panel sí se coloca solo,
§8.1); «Defiende a…» y la línea cambian el par desde el principio, y
«Defiende» del anillo desde esa fase; si el atacante ya tiene defensor,
se intercambian; con varios balones cada defensor mira el de su par;
etiquetas de las acciones nuevas con palabras que ya existen; los tramos
se siguen guardando PLANOS como en la capa 4 (se aparta del §11.1, que
habla de `args`), y `jugada.defensa` añade `ataca` y usa como preajuste
una de las cuatro reglas.

**Respuestas del entrenador (2026-09-17 y 2026-09-18):**

- INFERIORIDAD: retrasa **el defensor más cercano al aro que no marca al
  que tiene el balón**; con uno solo, él.
- SUPERIORIDAD con varios que sobran: **el primero hace la V** con el
  defensor del portador; **los demás, entre el balón y el aro a 2 m del
  balón**.
- Al soltar un defensor del panel se **recolocan todos los defensores que
  no se hayan arrastrado a mano**; el que se movió a mano se queda.

**Decidido en el paso 5.4 (dicho al entrenador):**

- El que retrasa **sale al que tiene el balón solo si no le marca nadie**;
  si ya tiene defensor, se queda protegiendo el aro un paso por detrás.
  Sin esto los dos acababan en el mismo punto.
- **Quién retrasa se decide al empezar la fase**, con la escena de salida
  (§8.2): decidiéndolo por dónde está cada uno, colocar los movía y en la
  consulta siguiente retrasaba el otro.
- Los que sobran en superioridad van **sobre el arco de 2 m del balón**,
  abiertos a los lados para no taparse: así es verdad lo que dice la
  explicación.
- La **trampa es de dos**: con un solo defensor —o con la superioridad
  forzada sin nadie que sobre— cada uno se queda con su regla. Y si la
  separación pedida no cabe en el círculo de la presión, el segundo se
  aleja lo justo para que sea la pedida.
- Solo cuentan los **balones que se pueden jugar**: los de un atacante en
  juego y los sueltos.
- El defensor se coloca con **la escena que se está viendo**, que es la
  misma con la que se explica su regla.
- El panel **conserva el bloque de números abierto y el foco** al
  repintarse: si no, escribir dos números seguidos era imposible.

**Revisión adversarial del 5.4 (2026-09-18)**, 3 revisores y 2 escépticos
por hallazgo: 28 hallazgos (7 de geometría, 9 de integración, 12 de los
bancos). Dos quedaron confirmados por votación antes de que se agotara el
límite de sesión y el resto se comprobó leyendo y reproduciendo. Lo
arreglado: dos defensores en el mismo punto; el papel de retrasar que se
intercambiaba en cada consulta; el panel que perdía foco y bloque abierto;
los balones que no se pueden jugar moviendo a la defensa; la separación de
la trampa y la trampa de uno solo; flotar con un límite menor que 2 m; el
«lo que saldría solo» de Ajustes calculado con la pista de después de lo
dibujado; el equipo forzado que desaparecía del desplegable al quedarse
sin fichas; el gesto de la línea, que cogía la primera y no la más
cercana, y que borraba la selección con Mayús; y `setDefensa`, que perdía
los números ya cambiados. Y ocho pruebas que pasaban por casualidad.

**Decidido en el paso 5.5 (dicho al entrenador):**

- **La cuenta de la fase vive en un solo sitio** (`canvas/fotograma.js`):
  qué pasa en una fase y dónde está cada uno en el instante *t*. La usan
  el motor de reproducción y el seguimiento de la defensa. Con dos
  copias, la defensa seguiría a un atacante que en el proyector va por
  otro sitio.
- **La Pizarra no calcula su propia defensa: se la pide al compilador**,
  que es quien la calcula para el proyector. Es una cuenta cara, así que
  se recuerda mientras la jugada no cambie.
- Un movimiento automático viene **muestreado en el tiempo** (21 muestras
  = 20 tramos por fase, §8.4) y se recorre SIN la curva de aceleración:
  meterle la curva deformaría el retardo recién calculado. No lleva
  flecha, y el guion de Equipos lo cuenta en **una sola frase**.
- **Apartarse no es correr**: si su par le pasa por encima más rápido que
  él, se lo lleva por delante, pero nunca más de lo que se ha movido su
  par. Así el metro de separación se cumple sin saltos. Con un atacante
  dibujado a 6 m/s se ve al defensor ser rebasado, que es lo que pasaría
  en la pista.
- **Cerrar el rebote es ponerse a 1,0 m de su par**, no a 0,8: menos no
  cabe, porque el §8.4 no deja acercarse más y el §3.6 avisaría de
  choque.
- **Al cambiar de fase, cada defensor se queda donde le deja su
  seguimiento** (y ese es el arranque que guarda la fase siguiente).
  Mientras se dibuja una fase, la defensa se ve en su SALIDA: es la
  posición que se ajusta; el movimiento se ve al reproducir.
- **El bloqueo se le pone al defensor de verdad** cuando lo hay
  (`defensor_id` en el tramo y en la animación), y la barra le mira a él
  esté donde esté. Sin defensa en la pista se sigue usando el supuesto.
- **Arrastrar un defensor en una fase que no es la primera no se guarda**:
  la defensa de esa fase la manda el seguimiento, así que al cambiar de
  fase vuelve a donde le toca. Mover a un defensor «a mano» a mitad de
  jugada es de las acciones declaradas (5.6).

**Decidido en el paso 5.6 (dicho al entrenador):**

- **Lo que un defensor hace distinto entra en el CATÁLOGO** (familia
  «entre dos»), no en una lista aparte de la Pizarra: el nombre, los
  sinónimos, el icono y a quién se señala salen de ahí, y una acción del
  club lo hereda sin tocar nada.
- **«ayuda» deja de ser sinónimo de «defiende»**: es otra acción. Un
  ejercicio que decía «ayuda» se leía como «marca», que es justo lo
  contrario de lo que hace una ayuda.
- **No se guardan como tramos, sino como excepciones de la fase**
  (`fase.defensa`), que es lo que manda el §11.1: no dibujan un camino,
  dicen a qué apunta el defensor mientras dura la fase.
- **A quién se puede señalar lo dice la acción** (`senala`: compañero,
  rival o cualquiera), no una lista de slugs. Y **preguntar a quién sale
  solo de `pide`**: en «entre dos» el compañero es opcional, así que
  mirar si estaba fijado hacía preguntar también por las que no señalan a
  nadie.
- **Orden de mando al colocar**: lo dicho por el entrenador → el cierre
  automático del rebote → la situación → la regla de cada uno. Quien ya
  tiene sitio no se recoloca; de paso se arregla que el que retrasa se
  ponía encima de lo ya decidido.
- **Ayuda y recupera**: se pone entre el que tapa y el aro, y vuelve con
  su par en el último cuarto de la fase.
- **Es sobrepasado**: al otro lado de su par mirando desde el aro, a
  1,2 m, hasta el final de la fase.
- **Va al dos contra uno**: se coloca AL FINAL, junto a donde acaba el
  defensor que ya está —no junto a un sitio ideal que el otro no ocupa—,
  a 1,0 m del balón y 1,5 m de él.
- **«Cambia con…» sigue valiendo en las fases siguientes** (§8.5); las
  demás son de su fase.
- **«Defiende» es como se quita lo declarado**: marca a quien se le
  señale y deja de hacer lo que hubiera dicho.
- El panel «Ajustes» enseña **«En esta fase»** con las que no hay que
  señalar a nadie; ayudar y cambiar el par se eligen en el anillo.
- En la línea de tiempo, **lo dicho por el entrenador se ve en celeste** y
  lo que sale solo, en gris.

**Revisión de la capa 5 (2026-09-19).** Se lanzó una revisión adversarial
de los pasos 5.5 y 5.6 con seis revisores; el límite de uso tumbó a cinco
y a todos los escépticos, así que solo llegó entera la del FORMATO, con 7
hallazgos, y los he comprobado yo uno a uno. Arreglado (con su prueba y
su mutante):

- unas `fases` que no son una lista abrían la jugada en blanco **sin un
  solo aviso**; ahora se dice;
- una fase rota se caía del filtro **en silencio** y además renumeraba
  los avisos de las demás («Fase 3» salía como «Fase 2»); ahora se dice
  cuál era y los números son los que ve el entrenador;
- dos fases con el mismo nombre podían acabar **las dos con el mismo id**
  si el nombre inventado ya estaba cogido;
- una acción de la defensa podía apuntar **a un cono o a sí mismo**, y la
  Pizarra la dibujaba: ahora tiene que ser un jugador, y se dice;
- **borrar una ficha que sale en lo que hace la defensa** (la que ayuda o
  a la que se ayuda) no avisaba y dejaba la fase apuntando a alguien que
  ya no está: ahora no se puede sin quitarlo antes, y `sinFichas` limpia
  lo declarado.

Refutado a mano: nada. Queda por comprobar lo que no llegó a revisarse
—geometría, Pizarra, motor, vocabulario y bancos—: **la revisión de esas
cinco dimensiones sigue pendiente.**

**Decidido en el paso 5.7 (dicho al entrenador):**

- **Los papeles se cuentan fase a fase** y cambian desde la SIGUIENTE, no
  a mitad (§8.2 + §8.6): quien acaba una fase con el balón ataca en la
  siguiente, y una canasta anotada le pasa el ataque al otro equipo. Al
  cambiar, el emparejamiento **se invierte** (el que era su par pasa a
  defenderle) y **se ataca al otro aro** si la pista tiene dos.
- **Lo que haya dicho el entrenador manda**: con «quién ataca» forzado en
  Ajustes, no cambia nada aunque roben o anoten.
- **Robar es una acción declarada más** (§8.5), y se señala a quién:
  · si al señalado le llega un PASE en esa fase, es una **intercepción**:
    el pase se corta donde se cruza el que roba y el balón es suyo ahí;
  · si lo lleva él, es un robo **en el bote**: el que roba tarda en
    llegar lo que tarde a su velocidad (§8.4), y desde ese instante el
    balón va con él.
  El entrenador pidió señalar «el trazo del pase» para interceptar;
  señalar al RECEPTOR hace lo mismo con el gesto que ya existe («pincha a
  quién»), y es lo que se ha hecho. **Queda por confirmar.**
- **El que va a robar no se aparta de nadie**: el metro de separación del
  §8.4 no cuenta para él, porque el robo es justo un contacto.
- **Lo que el robado tuviera dibujado después ya no encaja**, y lo dice
  el aviso de siempre: al cambiar los papeles, sus trazos de ataque son
  de alguien que ahora defiende.
- **`posesionAlFinal` vive en su propio fichero** (`pizarra/posesion.js`):
  la necesitan las fases y la defensa, y dejarla en `fases.js` cerraba un
  círculo de imports que reventaba al abrir la Pizarra.

**Lo que no cuadra, dicho y NO tocado (revisión de la capa 5):**

- **`recalcular` no sabe dónde deja la defensa a cada uno**: encadena las
  fases con `posicionesFinales`, que solo mueve a quien tiene trazos, y
  un defensor no dibuja nada. Las entradas que guarda para las fases
  siguientes se quedan con el sitio de la primera. NO SE VE —al ir a una
  fase, el Tablero coloca a los defensores donde los deja el seguimiento
  (`_finDeLaDefensa`), y el fantasma pinta trazos, no entradas—, pero el
  dato guardado y lo que se ve dicen cosas distintas. Arreglarlo de
  verdad pide que `fases.js` sepa de la defensa, que hoy vive en el
  compilador; conviene decidirlo con calma.
- **Un tramo con una acción que no está en el catálogo se abre y se
  dibuja, pero no se compila**, y el aviso del compilador no lo lee
  ninguna pantalla. Es de antes de la capa 5 y toca decidir dónde se
  enseñan los avisos de compilación.

**Lo que no cuadra, dicho y NO tocado (paso 5.6):**

- **Una acción declarada sola en una fase no se puede cerrar**:
  «Siguiente fase» pide que haya algo dibujado, y la línea de tiempo no
  enseña carriles si no hay ningún trazo. Una fase que solo dijera «el 4
  cierra el rebote» no se puede dejar cerrada. Pendiente de decidir si
  una fase así debe valer.
- **Arrastrar un defensor en una fase que no es la primera sigue sin
  guardarse** (viene del 5.5): la defensa de esa fase la manda el
  seguimiento.

**Lo que no cuadra, dicho y NO tocado (paso 5.5):**

- **Un bloqueo solo en su fase no llega a enseñar la barra**: el
  bloqueador llega justo al acabar la fase, así que la barra dura 0 ms.
  Viene del paso 5.2 (la barra aguanta «hasta que el compañero le pasa»)
  y solo pasa cuando en esa fase no hay nada más dibujado. Se arregla
  decidiendo qué se prefiere: que la barra llegue hasta el final de la
  fase, o que la fase se alargue un poco. Pendiente de que lo diga el
  entrenador.

**No tocar:** la marca `motor: 3` (lo guardado con la capa 4 dejaría de
reproducirse); todo lo nuevo del formato de animación, aditivo.

**Decidido en el paso 5.2 (dicho al entrenador al cerrarlo):**

- **Sin defensa todavía, el bloqueador se planta junto a un defensor
  SUPUESTO**: el que pondría la regla de serie, entre el compañero y el
  aro (1,2 m si lleva balón, 2,0 si no). Se pone AL LADO de ese defensor,
  a **0,7 m** (número nuevo, ajustable), en perpendicular a la línea
  compañero→aro y del lado por el que llega. Primero se probó pararse en
  su camino, y quien llegaba desde la altura del compañero acababa ficha
  sobre ficha. En 5.5 el defensor será el de verdad.
- **La barra sale al plantarse y aguanta** hasta que el bloqueador vuelve
  a moverse o acaba la fase; mira hacia donde llega (`hacia` en la
  animación, un punto y no un ángulo, para que el proyector lo gire bien).
  `defensor_id` no se escribe todavía: llega con la defensa.
- A un bloqueo **solo le vale un jugador del mismo equipo**; pinchar a
  otro lo dice y sigue esperando; pinchar el suelo o Esc cancela.
- Un tramo puede **esperar a varias cosas** a la vez (un pase y un
  bloqueo): sale cuando han pasado todas. Antes guardaba solo la primera.
- La barra del bloqueo va **fuera del disco** de la ficha, en la Pizarra y
  en el motor: a 16 px fijos quedaba tapada en el proyector.
- Guion de Equipos: el camino del bloqueador no se cuenta aparte, ya lo
  dice «el 5 bloquea para el 1».
- Queda sin hacer, y es de este mismo tipo que «entra»: el sitio del
  bloqueo se calcula al dibujarlo y no se rehace si luego se mueve al
  compañero en la fase 1 (se corrige pinchando el trazo).

**Respuestas del entrenador (2026-09-14 y 2026-09-17):**

- Bloqueo y continuación: **el bloqueador aguanta hasta que su compañero
  le pasa** (el punto del trazo del compañero más cercano al bloqueo); su
  siguiente movimiento sale entonces, y la barra se ve hasta ese instante.
  En un «mano a mano» (lo siguiente es entregarle el balón) no se aguanta:
  la entrega es ese momento.
- Paso 5.4, INFERIORIDAD: retrasa **el defensor más cercano al aro que no
  marca al que tiene el balón**; los demás siguen con su par; con un solo
  defensor, retrasa él.
- Paso 5.4, SUPERIORIDAD con varios sobrantes: **el primero forma la V**
  con el defensor del portador; **los demás, entre el balón y el aro a 2 m
  del balón**.

**Decidido en el paso 5.3 (dicho al entrenador):** los pares se deciden
al empezar la jugada y se mantienen (los cambian las acciones, no el
sitio); a un defensor, «⋯ más» solo le ofrece recoger un balón suelto;
«Defiende» del anillo sigue avisando que llega después y se hace en el
5.6 junto a «Cambia con…»; si al dar el balón a otro equipo un defensor
se queda con trazos de ataque, se avisa y no se borra nada; con tres o
cuatro equipos defienden todos los que no tienen el balón; los números
de la defensa viven en `motor/defensa.js` (`PARAMETROS`) y destino.js los
lee de ahí.

**Revisión adversarial de 5.2 y 5.3 (2026-09-17)**, 5 revisores y 2
escépticos por hallazgo: 17 hallazgos, 11 confirmados, 1 dudoso, 5
refutados. Arreglados: el aviso de «defiende y tiene trazos de ataque»
llegaba tarde con una sola fase y al reabrir lo tapaba el aviso de la
carga; la barra del bloqueo duraba 0 ms en bloqueo y continuación (se
resolvió con la respuesta del entrenador); **un fallo de antes de la capa
5**: al botar el receptor después de un pase, el final del pase se
desplazaba y en el proyector el balón volaba al sitio equivocado; y
pruebas que no vigilaban lo que decían (dorsal a mano, dos «defiende a…»
al mismo atacante, perpendicular del bloqueo en diagonal, situación
forzada sin defensa). También, aunque se refutaron por no poder darse
hoy: claves heredadas en los números de la defensa, números que no son un
objeto y el empate por redondeo en sitios simétricos. Banco nuevo:
`eval-tablero.mjs`, un Tablero de verdad sobre un DOM de mentira, para
los fallos que solo viven en el pegamento.

**Bancos que cambiarán a propósito** (no son regresiones, decirlo al
tocarlos): `eval-repertorio` (anillo del defensor con pendientes;
«defender no se pierde»), `eval-fases` (`PENDIENTES.bloqueo`),
`eval-compilar` (B1 pasa a defender y a moverse), `eval-dibujo` (texto
del bloqueo) y `eval-acciones` si cambian las mecánicas.

## Capa 6, paso a paso

Plan propuesto el 2026-09-19, **sin confirmar todavía por el entrenador**
(sigue el mismo criterio que la capa 5: cada paso deja algo que se prueba
de punta a punta, con sus bancos en verde y su commit en la rama).

| Paso | Qué queda funcionando | Estado |
|---|---|---|
| 6.0 | El módulo PURO de «qué hace este cono con este trazo» (§7.4): rodeo, slalom y puerta, con sus números y su banco. Y los arreglos que la capa destape | ✅ (66 bancos, 1577 pruebas; banco nuevo `eval-conos.mjs`, 18 pruebas; 11 mutantes, 10 muertos y 1 equivalente) |
| 6.1 | Rodear un cono al dibujar: el trazo se curva por el lado de entrada, con su iconito encima; un clic cambia el lado y otro lo anula. Se guarda la intención, así que mover el cono rehace la curva. Compila como `funcion: 'rodear'` y el guion lo cuenta | ✅ (66 bancos, 1594 pruebas; 13 mutantes, los 13 muertos; probado en la Pizarra: dibujar, los tres clics y compilar). El slalom (6.2) ha salido con él: el módulo ya lo leía |
| 6.2 | Slalom: tres o más conos alineados cerca del trazo, alternando lados desde el de entrada | ✅ con el 6.1 |
| 6.3 | Puertas (§7.4.1): emparejamiento automático por distancia, la banda, el trazo imantado a pasar por dentro y en rojo si se fuerza por fuera; deshacer el par en el panel | ✅ (66 bancos, 1607 pruebas; 14 mutantes, los 14 muertos; probado en la Pizarra: cruzar, imantar, forzar en rojo, el iconito y deshacerla desde el panel) |
| 6.4 | El defensor confinado al carril de la puerta: su regla se proyecta sobre el carril | ✅ (66 bancos, 1616 pruebas; 8 mutantes: 7 muertos y 1 equivalente; probado en la Pizarra y con el fotograma del proyector: nunca sale de la puerta y, al cruzarla su par, se aparta 1,0 m deslizándose por ella) |
| 6.5 | Filas (§7.4.2): un cono es cola —jugadores, equipo, papel, un balón por cabeza—, con su tirador de orientación y su destino de vuelta. Se enciende «Vuelve a la fila», que hoy no puede | ✅ (67 bancos, 1640 pruebas; banco nuevo `eval-filas.mjs`; probado en la Pizarra: hacerla desde el panel, cambiarla, el tirador, mover el cono con su cola, «Vuelve a la fila» y compilar) |
| 6.6 | Rondas: salen todos uno tras otro, con cadencia. La variación por ronda queda para más adelante (lo decidió el entrenador) | ✅ (68 bancos, 1664 pruebas; banco nuevo `eval-rondas-fila.mjs`, 16 pruebas; 37 mutantes, los 37 muertos; probado en la Pizarra: la línea de tiempo con una barra por ronda, el panel «Salen» y «Cadencia», reproducir, reabrir lo dibujado, y lo mismo en el compilador y en el motor del proyector) |
| 6.7 | Balones múltiples (§7.3): «Dale un balón» en el panel del jugador y `Ctrl`+clic en una fila, que da uno a cada uno sin rehacerla. Los equipos del club, para más adelante (lo decidió el entrenador). Cierre de la capa: `sw.js` a la v16 | ✅ (68 bancos, 1668 pruebas; 13 mutantes: 12 muertos, y el que vivía destapó una comprobación que sobraba y se quitó; probado en la Pizarra con el ratón de verdad: `Ctrl`+clic en uno de la cola y el botón del panel) |

**Decidido en los pasos 6.1 y 6.2 (dicho al entrenador):**

- **Se guarda la intención y manda ella**: qué cono se sortea y por qué
  lado. Si el cono se mueve —incluso al otro lado del camino—, la curva
  se rehace alrededor de su sitio nuevo y **por el mismo lado**; si se
  aleja más de 1,5 m, deja de sortearse. Un cono que se acerca a un
  trazo ya dibujado empieza a sortearse por su lado de entrada.
- **Los tres clics del iconito**: el primero cambia el lado, el segundo
  lo anula (el trazo pasa recto y el cono ya no se vuelve a leer aunque
  se mueva) y el tercero lo devuelve a lo que se leería solo.
- **Un slalom es UNA interpretación**: un solo iconito (⇄), y el clic va
  para todos sus conos. Sin el tercero —anulando uno de tres— los otros
  dos quedaban como dos rodeos sueltos.
- Se pasa a **0,9 m** del cono (número nuevo, ajustable): ni pisándolo
  ni dando un rodeo que no ha pedido nadie.
- **Un pase no rodea conos**: vuela. Solo el camino de quien corre.
- Mover un cono rehace las curvas **de la fase que se está editando**:
  es lo que se tiene delante, y rehacer las de todas movería trazos que
  no se ven.
- Los conos de una PUERTA quedan como decoración al compilar hasta el
  paso 6.3, que les da su papel.

**Decidido en el paso 6.3 (dicho al entrenador):**

- **Una puerta existe cuando un trazo la cruza**: dos conos a menos de
  3 m y el trazo pasando entre ellos DE TRAVÉS (45° como mínimo). Así los
  conos de un slalom apretado —también a menos de 3 m— no salen como
  puertas: el trazo los recorre a lo largo, no los cruza. El «emparejamiento
  automático por distancia» del §7.4.1 se ha leído así; si el entrenador
  quiere puertas que existan aunque nadie las cruce (para la defensa del
  6.4, por ejemplo), hay que decidirlo.
- **La banda**: rozar un palo por fuera, a menos de 0,6 m, cuenta como ir
  por la puerta y el trazo **se imanta** a pasar por el medio. Más lejos
  ya no es cosa de la puerta.
- **Forzarlo por fuera a mano** (moviendo sus nodos) deja la puerta
  FORZADA: el trazo se pinta en rojo y el imán no lo devuelve aunque se
  muevan conos. Llevándolo otra vez por dentro, deja de estarlo.
- **Una puerta no tiene lado**: el clic en su iconito (⌷) la anula —los
  dos palos— y el siguiente la devuelve. Desde el panel, «Deshacer la
  puerta» la anula en todos los trazos de la fase.
- Los palos se compilan como `funcion: 'puerta'` y el guion dice «…pasando
  por la puerta».

**Decidido en el paso 6.4 (dicho al entrenador):**

- **Está «sobre la puerta» el defensor que empieza la fase a menos de
  0,75 m de la línea entre los dos palos** (número nuevo). Se decide al
  empezar la fase y no cambia a mitad (§8.2).
- **Su regla manda y el carril la recorta**: va al punto de la puerta más
  cercano a donde le pondría su regla —cualquiera, también lo declarado y
  la situación—, y por ella se mueve a su velocidad de siempre.
- **Cuando su par cruza la puerta, se aparta deslizándose por ella** hasta
  quedar a 1,0 m, hacia el lado en el que ya estaba; si la puerta no da
  para tanto, se queda en su punta. Apartarse de frente le habría sacado
  de la puerta.
- **«A menos de 3 m» es estricto**: dos conos a 3,0 m justos ya no son
  puerta. Probándolo en el navegador con los palos a 3 m exactos no salía
  la puerta; es lo que dice el §7.4, pero conviene saberlo al colocarlos.

**Decidido en el paso 6.5 (dicho al entrenador):**

- **Los de la cola son jugadores de verdad** (§7.1): el primero, EN el
  cono y en juego (lleva dorsal y puede defender o atacar); los demás
  detrás, sin dorsal y sin contar para la defensa. Se ponen justo donde
  el proyector pinta la cola, así que se ven igual al dibujar y al
  proyectar.
- **La fila se hace y se cambia desde el panel del cono**: cuántos (1 a
  12), equipo, papel, un balón por cabeza, orientación y a qué cola se
  vuelve. Cambiar cualquier cosa menos la orientación la rehace entera;
  girarla conserva a los que esperan. Seleccionar a uno que espera
  enseña la fila de su cono.
- **El tirador**: un círculo al final de la cola, con la fila
  seleccionada; se arrastra alrededor del cono, imán cada 15°, libre con
  Mayús.
- **Mover el cono se lleva a la cola en el mismo gesto**; quien ya ha
  salido —tiene algo dibujado— se queda en la punta de su trazo.
- **Uno de la cola no se quita suelto** (la fila dice cuántos son); el
  cono se lleva a toda su cola y sus balones. Y no se rehace ni se
  deshace una fila con alguien que ya tiene algo dibujado.
- **«Vuelve a la fila»** lleva al final de su cola (un hueco detrás del
  último) o de la que diga su fila.
- Al compilar, los que esperan sin hacer nada no son jugadores de la
  animación: son la cola que el motor ya sabía pintar
  (`funcion: 'fila'`, `n_jugadores`); sus balones, igual.
- **El «papel» de la fila se guarda y se enseña, pero todavía no decide
  quién ataca** —eso lo sigue decidiendo el balón, o los Ajustes—. Si el
  entrenador quiere que una fila de defensores defienda aunque no haya
  balón, hay que decidirlo.

**Decidido por el entrenador para el paso 6.6 (2026-09-23):**

1. **Rondas: UNA sola animación** en la que los de la cola salen uno
   tras otro, con la cadencia que se diga, y la cola se va acortando. Nada
   de repetir la jugada entera una vez por cabeza.
2. **La variación por ronda** («el tercero tira en vez de entrar") **queda
   para más adelante**.
3. **Los de fuera que juegan con el que sale lo repiten con cada uno**:
   el que devuelve el pase se lo devuelve a cada uno con su balón, y el
   que pasa desde fuera tiene un balón para cada uno, como un carro de
   balones. Lo que hacen por su cuenta, sin el que sale, no se repite.

**Decidido en el paso 6.6 (detalles, sin preguntar):**

- **Las rondas no se guardan: se deducen** de lo dibujado con el primero
  de la cola (`pizarra/rondas-fila.js`). La Pizarra y el compilador hacen
  la misma cuenta, así que se ve igual al dibujar y al proyectar.
- **Una ronda es todo lo dibujado en lo que sale el primero o su balón**:
  lo que hace él, los pases que le hacen, y lo que cualquiera hace con su
  balón (el reboteador que recoge su tiro).
- **Por rondas es lo de serie** en una fila; en el panel del cono,
  «Salen: todos, uno tras otro / solo el primero». Cambiarlo, o la
  cadencia, NO rehace la fila: vale aunque el primero ya tenga algo
  dibujado, y en cualquier fase.
- **El turno**: sin cadencia, cada uno sale cuando acaba la ronda del
  anterior en esa fase (contando el balón de un tiro hasta que cae); con
  cadencia (de 1 a 5 s en el panel), cada tantos segundos aunque el
  anterior no haya acabado. Cada ronda repite los tiempos de la del
  primero, así que lo que esperaba un pase lo sigue esperando.
- **Cada uno sale de su sitio en la cola** —el primero, del cono— y
  **«vuelve a la fila» le pone detrás del que volvió antes**.
- **Con varias fases, la cascada va fase a fase**: todos hacen lo de la
  fase 1, uno tras otro, y luego lo de la fase 2.
- **Dos colas que juegan entre sí salen a la par** (el segundo de una con
  el segundo de la otra), tantas rondas como jugadores tenga la más corta;
  si no son iguales, se avisa.
- **Quien de la cola ya tiene algo dibujado hace lo suyo** y no repite; su
  hueco en la cascada se queda para él.
- **Sin balón**: si la ronda lo necesita (pasar, tirar, botar, recoger el
  suyo) y alguno no lo tiene, **esa ronda no sale y se avisa**; lo que no
  necesita balón se repite igual.
- **Una fase con la duración puesta a mano se alarga** lo que haga falta
  para que quepan todas las rondas.
- **En la línea de tiempo**, lo de cada ronda va en gris con un filo azul
  y no se arrastra (se cambia cambiando lo del primero); los que esperan
  se ven por su puesto («2.º», «3.º»), y en los mensajes, «el 2.º de la
  fila».
- **Al compilar**, los que salen son jugadores sin número (como en la
  Pizarra), con nombre propio para no chocar entre sí; lo de cada ronda
  va marcado (`repeticion`) y la animación dice cuántas rondas son
  (`rondas`), así que **la miniatura y el guion de Equipos cuentan una**.
  Si alguno de la cola no sale, espera en su sitio (ya no en la cola que
  pintaba el motor, que le pondría en el cono). En el guion, quien sale
  de una fila es «uno de la fila».
- **Arreglado de paso, en el repaso de la Pizarra**: un balón que va a
  salir en un pase o un tiro va en las manos de quien lo hace hasta que
  sale. Antes esperaba plantado en el sitio del pase mientras su jugador
  botaba hasta allí; con las rondas, cada balón de la cola flotaba en el
  sitio del tiro.

**Decidido por el entrenador para el paso 6.7 (2026-09-24):**

- **«Cargar equipo del club» (§7.2) queda para más adelante.**
- Cuando se haga, **el segundo equipo se empareja POR POSICIÓN**: el base
  es el 1, el escolta el 2, el alero el 3, el ala-pívot el 4 y el pívot
  el 5 (la plantilla del club ya guarda la posición de cada jugador); si
  hay dos de la misma posición, se hace automático y luego se ajusta a
  mano.

**Decidido en el paso 6.7 (detalles, sin preguntar):**

- **«Dale un balón»** sale en el panel de un jugador —ataque, defensa o
  sin papel— solo si se puede: en la fase 1, si no empieza la jugada con
  balón y no tiene nada dibujado (lo dibujado se hizo sin él). El balón
  es suyo desde el principio y él sigue seleccionado.
- **`Ctrl`+clic (o `Cmd`+clic) en una fila** —en su cono o en uno de la
  cola— da un balón a cada uno que no lo tenga y no haya salido todavía,
  sin rehacer la fila. «Balones» en el panel de la fila hace lo mismo, y
  «Sin balón» se los quita a los que no han salido (salvo el que ya se
  usa en algo dibujado).
- **El balón va AL LADO de la ficha, no centrado** como dice el §7.3: se
  decidió en la capa 1 para poder cogerlo con el dedo (0,75 m; ver
  `SEPARACION_BALON`). El anillo naranja marca a quien lo lleva.

## Capa 4, paso a paso

| Paso | Qué | Estado |
|---|---|---|
| 4.1 | Compilador `jugada → animación` (`pizarra/motor/compilar.js`), con el formato que ya leen proyector, miniaturas y visor. `Tablero.jugada()` | ✅ |
| 4.2 | `engine.js` con carriles: varios tramos por ficha y fase, arranques propios, el dueño del balón cambiando a mitad de fase. Sin cambiar cómo se ven las animaciones guardadas | ✅ |
| 4.3 | Reabrir una jugada guardada y seguir editándola (`Tablero.cargar`), y abrir desde su animación un ejercicio de antes de la Pizarra (§11.4) | ✅ |
| 4.4a | Guardar aunque falte una columna nueva (`supabase/columnas.js`), y la migración 043 con su comprobación. **La 043 hay que aplicarla a mano** en Supabase | ✅ |
| 4.4b | La pantalla de la Pizarra, el asistente de tres pasos, lo guardado antes (§11.4) y el borrado del motor viejo (§12) | ✅ en la rama |

En 4.1 salió un fallo de la capa 3: recolocar en la fase 1 una ficha sin
trazos no cambiaba su arranque, y al pasar de fase o volver a la 1 saltaba
a su sitio viejo. Arreglado: se actualiza al soltar el arrastre, y solo
para lo que no participa todavía en la fase.

En 4.3 salió otro: al volver a una fase, `irAFase` colocaba las
posiciones de esa fase pero dejaba el balón en las manos de quien lo
tuviera AHORA (lo último dibujado), y el balón de quien botó se quedaba
atrás. Arreglado con `posesionAlFinal` en `fases.js`, que repasa lo
dibujado desde el principio.

## Siguiente paso

**Hoy (2026-09-24): la capa 7, texto y voz** (§9): la frase automática
de cada fase, el panel de descripción, la narración y «llevar al paso 3».
La capa 6 está cerrada. Lo que viene después de esta línea es el
siguiente paso de la capa 4, que ya está hecho; se deja como historia.

**4.4b**, con dos decisiones ya tomadas (2026-09-11): el creador v2.1 se
borra ya, como dice el §12, y lo guardado se trata como dice el §11.4.

**Hallazgo al inspeccionar (2026-09-11):** la capa 1 se dio por cerrada,
pero la PANTALLA de la Pizarra no existe: no hay panel izquierdo
(`paneles/izquierda.js`, §2.3), así que **no hay forma de añadir fichas**;
tampoco barra superior con herramientas ni paneles plegables (§2.1-2.2).
Solo existen los arneses de `dev/`, con una escena fija. Sin eso la
Pizarra no puede sustituir al paso 1, y borrar primero dejaría la app sin
creador.

Otras cosas que hay que saber antes de borrar:

- `netlify.toml` publica `main`: lo que se sube a `main` va a producción.
- Los 204 ejercicios de la biblioteca son todos «de antes»: con el §11.4
  pierden la animación en la ficha, el proyector y el planificador.
- Sin la 043 aplicada, lo guardado desde la Pizarra se reabre solo con
  posiciones (sin sus acciones). Para distinguir viejo de nuevo no se usa
  la columna `jugada` sino una marca dentro de la animación (`motor: 3`),
  que se guarda siempre.
- `pizarra/destino.js` importa dos constantes de `ia/compilador.js`; el
  paso 3 usa `ia/molde.js`, `ia/puente.js` e `ia/lint.js`; la miniatura y
  el guion de Equipos usan `soloPrimeraRonda` de `ia/rondas.js`; las
  herramientas de `tools/biblioteca` usan el compilador viejo y `lint.js`.
- Bancos que dependen del motor viejo: `eval-animacion`, `eval-frase`,
  `eval-gestos`, `eval-rondas` (se van) y `eval-cargar`, `eval-video`,
  `eval-acciones`, `eval-destino`, `eval-molde` (se adaptan). El recuento
  de pruebas bajará, y no es una regresión.

**Plan CONFIRMADO el 2026-09-11**, con estas respuestas:

- Orden: pantalla → asistente → §11.4 → borrado. Todo en `pizarra-v3`
  subida a GitHub como rama; **a `main` solo al final**, con los bancos en
  verde, probado en el navegador y la 043 aplicada.
- Pantalla: **lo imprescindible** (fichas, recuento, ayuda, zoom, encajar,
  ▶, Supr, canasta). Zonas, «Traer» y las pestañas Fases/Texto, en sus
  capas (6, 7, 10).
- Equipos, ejercicio viejo: colocación quieta, aviso y **sin narración**.
- `tools/biblioteca`: **siguen, solo con posiciones**; el linter de
  fichas se muda junto al paso 3.

Los pasos:

1. Pantalla de la Pizarra: `pizarra/pizarra.js` + panel izquierdo con
   fichas y recuento + barra superior. Solo añade. **Escrita**
   (`pizarra.js`, `paneles/izquierda.js`, arnés `dev/pizarra.html`); el
   Tablero ya pone fichas, las quita con Supr (se niega si tienen
   trazos), borra un trazo (Supr sin nodo elegido), cambia la canasta y
   da el balón al soltarlo encima de alguien. Bancos: 63 en verde, 1522
   pruebas. La prueba en el navegador encontró que al reabrir no se
   adoptaba la canasta de la jugada: arreglado.
2. El asistente pasa a tres pasos: Identificación · Pizarra · Metadatos.
   Guardar = jugada + animación compilada con marca; abrir = `cargar`.
   **Escrito** (commit de la pantalla: `bea3089`): `wizard.js` reescrito
   con la Pizarra a todo el ancho y viva mientras vive el asistente; al
   salir de ella o al guardar se vuelca `draft.jugada` + `compilar()`.
   Un ejercicio viejo abierto y sin tocar la pizarra se guarda con su
   animación de antes. `compilar` lleva la marca `motor: 3`
   (`esDeLaPizarra`) y no compila fases vacías. `ejercicios.js` guarda
   `jugada`; `cargar.js` la devuelve; el paso 3 cuenta desde la Pizarra.
   **Probado en el navegador, sin tocar la base de datos:** crear
   (colocar, pase, Metadatos con la animación en marcha), volver a la
   Pizarra sin perder nada, abrir un ejercicio viejo (fixture de dev
   `window.__demoEjercicio`) sin tocar y tocándolo, y retomar un
   borrador de la v2.1. Salieron y se arreglaron: `pizarra.css` no se
   cargaba en `taller/index.html`, y el motor pintaba a todos en el
   centro cuando la animación no tiene fases (ya pasaba antes con lo
   guardado «sin animación»; con la Pizarra pasa con toda colocación sin
   trazos). Bancos: 63 en verde, 1529 pruebas. ✅ commit `32477f3`
   (rama `pizarra-v3`, subida; `main` sin tocar).
3. §11.4 en la ficha, el proyector, el visor de Equipos y la lista.
   **Escrito:** `pizarra/motor/marca.js` (`esDeLaPizarra`, `paraVer`,
   `soloColocacion`, `perdioLaAnimacion`; sin dependencias, probado en
   eval-compilar). La ficha enseña lo de antes quieto, con aviso y
   «Rehacer la pizarra» (ruta nueva `/ejercicios/:id/rehacer`, que abre
   el asistente en la Pizarra). El proyector y el visor de Equipos
   enseñan `paraVer(...)`; el visor dice que es de antes y no narra
   fases. La biblioteca pide `motor:animacion->motor` y solo anima al
   pasar el ratón la miniatura de lo de la Pizarra; `sw.js` pasa a v14.
   El proyector no repintaba al tomar tamaño: con una colocación sola
   salía la pista vacía. Probado en el navegador: ficha, «Rehacer»,
   visor (arnés `dev/planner.html`). **Sin probar en vivo:** la lista de
   la biblioteca, porque el navegador de pruebas ya no tiene sesión real.
   ✅ commit `795af81` (rama `pizarra-v3`, subida).
4. **Borrado del §12** (en curso, 2026-09-12). El mapa lo hicieron 7
   agentes de solo lectura y un crítico: no falta ningún importador por
   prever, y las 14 contradicciones entre bloques están resueltas.
   Decisiones del entrenador: las dos reglas del linter que miran el
   movimiento (conos de rodear, oposición sin defensor) solo saltan si
   la ficha tiene fases; los `.json` de la biblioteca NO se regeneran y
   `importar.mjs --actualizar` deja de escribir la columna `animacion`;
   `elementosDeAnimacion` se borra sin portar filas ni zonas («los
   ejercicios actuales me importan poco, quiero el motor nuevo para
   rehacerlos a mano»); y los nombres de las anclas se guardan en
   `canvas/anclas.js`. Lo demás lo decidí yo: las dos distancias de
   `pizarra/destino.js` salen del catálogo de `ia/acciones.js`, de
   `rondas.js` solo sobrevive `soloPrimeraRonda`, y se borran
   `canvas/palette.js` y los cinco arneses del creador viejo.

   **Hecho (2026-09-12).** Primero las mudanzas: `lint.js`, `molde.js` y
   `puente.js` con `git mv` a `taller/js/wizard/`; `soloPrimeraRonda` a
   `taller/js/pizarra/motor/rondas.js`; `NOMBRE_ANCLA` a
   `canvas/anclas.js` con su prueba en `eval-medidas`; y `destino.js`
   tomando las distancias del catálogo. Después, siete agentes en
   paralelo, cada uno con sus archivos y su banco: `eval-acciones` (fuera
   las 12 pruebas de `normalizarIntent`, dentro 5 de catálogo rescatadas
   de `eval-gestos` y `eval-frase`), `eval-video`, `cargar.js` sin
   `elementosDeAnimacion`, 3 pruebas rescatadas de `eval-animacion` (2 de
   geometría a `eval-trazo`, 1 del balón en el aro tras un tiro a
   `eval-motor`), `stage.js` reducido a reproducir, el CSS muerto de
   `canvas.css` y `wizard.css`, y la biblioteca. El agente de la
   biblioteca se cortó por el límite de uso; lo rematé yo, corrigiendo
   una desviación: había quitado `animacion` también del ALTA de
   `importar.mjs`, y una ficha nueva habría entrado sin colocación.
   Resultado de la biblioteca, medido con `lint-tanda` sin escribir nada:
   las 18 tandas y el piloto, **0 errores**.
   Por último, el borrado: 24 archivos. Comprobado: ningún archivo que se
   queda importa nada borrado (los 728 imports relativos del repo
   resuelven), 60 bancos y 1351 pruebas en verde, y en el navegador —sin
   tocar la base de datos— crear con un pase, Metadatos con la
   animación, la ficha y el proyector de uno viejo, «Rehacer», la ficha
   de uno de la Pizarra (reproduce y se pausa tocando) y «Editar».
   ✅ commit `4351ebf`.

   **Revisión adversarial del borrado** (6 revisores + un escéptico por
   hallazgo): 8 confirmados, ninguno refutado; 6 distintos, todos
   arreglados. El importante, metido en este mismo borrado:
   `importar.mjs --actualizar` seguía sellando `marco = 3` sin reescribir
   la animación, y una ficha que siga en marco 2 se habría pintado
   descolocada sin aviso. Ahora `marco` solo viaja con `animacion`, en el
   alta, y `eval-marco` lo vigila. Los otros: una prueba de `eval-cargar`
   que comparaba la animación consigo misma; la columna del asistente,
   que seguía reproduciendo oculta mientras se dibuja; los mandos, que
   se acumulaban en el motor en cada ida y vuelta entre pasos (nuevo
   `off` en el motor y `destroy` en los mandos); el montaje, que perdía
   la canasta sur y los ids de los balones de las tandas; y la
   justificación de dos pruebas rescatadas. 60 bancos, 1352 pruebas; el
   linter 52/52; las 204 fichas, 0 errores. Probado en el navegador.

## Pendiente de decidir o de arreglar (no se toca sin avisar)

Salido del borrado del motor viejo (avisos de los agentes, 2026-09-12):

- **Cobertura que se ha ido con el motor viejo** y que la Pizarra tendrá
  que volver a vigilar cuando haga esas cosas: las invariantes de los
  gestos (que acaben donde empezaron, que el trazo no quede tapado por la
  ficha, la amplitud igual en las cuatro pistas) → capa 9; las rondas
  con cadencia y la fusión de sus acciones → capa 6; qué desplegables
  declara cada acción → capa 7.
- Comentarios que todavía nombran el motor viejo: la cabecera de
  `eval-acciones.mjs`, el de `.court-wrap.is-tocable` en `canvas.css`
  («en el paso 1 y en el paso 2»), `cargar.js` («el conteo del tablero»)
  y `supabase/posiciones.js` (líneas 14-15 y 49).
- Código que se queda sin usuario: en `ia/acciones.js`, `resolverAccion`,
  `indexar`, `parametroDe` y `EVENTOS_LEGADO` (los leían la frase y el
  compilador viejos; `eval-acciones` los sigue vigilando porque el
  catálogo se conserva); `draft.posiciones` (solo lo leía el
  paso 2), `supabase/posiciones.js` y `supabase/videos.js`,
  `taller/js/history.js`, `.btn.is-loading` en `wizard.css`, y en
  `base.css` las clases `.stub`, `.canvas-stub` y `.editor-*`, que ya
  estaban muertas desde antes.
- `.claude/worktrees/jolly-chatelet-6ef063/` guarda una copia vieja de
  `stage.js`, `detalle.js` y `wizard.js`: sale en cualquier búsqueda y
  despista.

- ~~`resto()` ofrece *Pasa* y *Tira* en «⋯ más» a quien no lleva balón.~~
  Arreglado en la 5.3 (`saleEn`), salvo los gestos con balón (ver abajo).
- El anillo promete «o pincha ya en la pista» y su velo se come ese clic.
- `fichas.js`: abortar el arrastre de un balón no se lo devuelve a su
  portador, ni restaura la selección que cambió el `pointerdown`.
- `makeSampler` (`canvas/geometry.js`) revienta con un camino de longitud
  cero. Blindado en el repaso, pero lo usa también el motor.
- `gen-pistas.mjs --check` está en rojo (asertos FIBA contra las medidas
  del club).
- `engine.js:239` usa `view.w` donde `rotate: 90` necesita `view.h`: los
  símbolos del proyector salen un 50 % más grandes en pista entera.
- Probar los gestos con dedos en una tablet de verdad.
- **Capa 6, filas:** quién ataca cuenta también a los que esperan (`en_juego:
  false`). Con una fila de atacantes con balón y un defensor en pista es lo
  que se quiere (ataca la fila); pero si en una fila espera alguien del otro
  equipo con balón, nadie defendería. Decidirlo con el entrenador al hacer
  las filas (lo señaló la revisión de la 5.3).
- «⋯ más» ofrece «Cambia de mano» y «Protege el balón» a quien no lleva
  balón: el catálogo no dice qué gestos necesitan balón. Decidir cómo se
  marca cuando los gestos en el sitio se puedan dibujar.
- Una vez, en una prueba automatizada, apareció un aviso de «Defiende» que
  nadie eligió. No se ha podido reproducir; se comprobó que las 12 casillas
  de los anillos disparan exactamente su acción.
- **Capa 6, rondas (6.6):** en la Pizarra, al pasar a la fase siguiente,
  los de la cola se ven en su sitio aunque en el proyector ya hayan
  salido: el arranque de la fase 2 cuenta lo dibujado, no las rondas. El
  repaso de la jugada entera y el proyector sí lo hacen bien. Solo
  importa si se dibuja algo DESPUÉS de las rondas; decidir si hace falta.
- **Capa 6, rondas:** mientras salen, los de la cola se pintan
  semitransparentes en la Pizarra (como mientras esperan); en el proyector
  van opacos.
- **Capa 6, rondas:** si lo dibujado con el primero no le lleva de vuelta,
  todos acaban en el mismo sitio, unos encima de otros. Es lo dibujado;
  se arregla dibujando «vuelve a la fila» o, más adelante, con la
  variación por ronda.
- Un jugador fuera de juego que NO está en una fila sigue sin dorsal y el
  compilador lo llama «A0»; dos así chocarían. Viene de antes de las
  filas; a los de las filas ya no les pasa.

---

## Incidentes

### 2026-09-11 · Un ejercicio de prueba guardado en la base de datos real

**Qué pasó.** Probando el asistente nuevo en el navegador, se pulsó
«Guardar» creyendo que no había sesión: se buscaron claves `sb-…` en
`localStorage` y la sesión del Playbook se guarda en `cbp-auth`. El
guardado llegó a Supabase de verdad y creó el ejercicio **«Prueba
Pizarra pase»** (id `4d4408b1-02af-4de0-bb7b-202e67674ef3`, autor
Beltrán). En la consola salió un 400, pero **su origen no está
confirmado**: vuelve a salir al abrir cualquier ficha, así que puede ser
de la ficha y no del guardado. No se sabe si la `jugada` llegó a
guardarse (es decir, si la 043 está aplicada): la comprobación de solo
lectura falló porque `dev/planner.html` había cambiado la sesión de
`cbp-auth` por la suya, falsa. Desde entonces ese navegador de pruebas
no tiene sesión real.

**Decidido (2026-09-11).** El entrenador lo archiva él; aquí no se
toca. Y el guardado se prueba **siempre sin red**.

**Qué se ha aprendido.** En el navegador de pruebas HAY sesión (clave
`cbp-auth`): nada de pulsar «Guardar», «Eliminar» ni «Favorito» en el
Taller. Lo que se guardaría se comprueba con `aRegistro` o
interceptando la red, nunca contra la base de datos.

### 2026-09-10 · Cierre brusco con el trabajo recién subido

**Qué pasó.** Justo después de hacer commit y subir `63d4cf6` (el cierre de
la capa 3), un cierre brusco del sistema dejó a ceros —bytes `NUL`, con su
tamaño original— lo último que se había escrito: los 6 archivos de ese
commit y los metadatos de git (`HEAD`, `index`, `ORIG_HEAD`,
`COMMIT_EDITMSG`, los punteros de `main`, `pizarra-v3` y `origin/main`, y
la cola de cuatro registros). Git dejó de reconocer el repositorio.

**Qué no se perdió.** Nada: `63d4cf6` estaba en GitHub. Sus 6 archivos
tenían exactamente el mismo número de bytes que los que quedaron a ceros, y
pasaban los 59 bancos. La base de objetos estaba sana (619 objetos sueltos,
ninguno dañado) y las ramas que solo existen en local (`v2.1/pistas`,
`v2.1/pistas-2`, `v2.1/tramo-1`, `claude/jolly-chatelet-6ef063`) estaban
intactas.

**Cómo se arregló.** En el sitio, sin cambiar `.git` por un clon —eso habría
borrado las ramas locales—:

1. Copia completa del `.git` dañado, verificada por md5, en
   `D:/Claude Code/v2/cbp-v2-rescate-2026-09-10/git`.
2. Se reescribieron los tres punteros y `HEAD`, se quitó la cola de ceros
   de los registros y se reconstruyó el índice desde `HEAD`.
3. Los 6 archivos se restauraron desde el propio repositorio y se
   comprobaron byte a byte contra GitHub.
4. `git fsck --full` limpio, árbol limpio, 59 bancos en verde.

Las últimas líneas del registro de git (el commit, la fusión y la subida de
`63d4cf6`) se perdieron: no afecta a nada, es solo historial de comodidad.

**Qué se ha aprendido.** Registrar el progreso en un archivo del propio
repositorio, como este, para que un corte no obligue a reconstruir el
estado a partir de la conversación.
