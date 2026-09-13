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
| 5 · Defensa | ⏳ en curso: plan CONFIRMADO, empezando por el paso 5.0 (ver «Capa 5, paso a paso») | — |
| 6 · Conos y elementos | pendiente | — |
| 7 · Texto y voz | pendiente | — |
| 8 · Ramas | pendiente | — |
| 9 · Variantes y vídeo | pendiente | — |
| 10 · Plantillas y remate | pendiente | — |

Las capas 1 a 3 están en `main` en GitHub; la 4 está en la rama
`pizarra-v3`, subida, y **no en `main`**. Bancos: **61 en verde, 1363
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
| 5.1 | Tiros con desenlace: Tira → Entra/Falla → al aro; si falla rebota a ~2,5 m por el lado contrario al tirador, si entra cae bajo el aro suelto; «Recoge» lo encuentra. Entra/falla se cambia tocando el tiro | pendiente |
| 5.2 | «Pincha a quién» y bloqueo: se pincha al COMPAÑERO, el bloqueador va a su sitio, el compañero sale cuando llega. Formato: `bloqueado_id` = compañero + `defensor_id` opcional | pendiente |
| 5.3 | Papeles y pares: `motor/defensa.js` + `eval-defensa.mjs`. Quién ataca, pares por dorsal y libre más cercano, situación por fase, arco del defensor y línea discontinua | pendiente |
| 5.4 | Colocar por regla (las 6 del §8.3), pestaña «Ajustes» del panel derecho (solo defensa) y ver la regla (§8.7) | pendiente |
| 5.5 | Seguimiento continuo (§8.4): la defensa se mueve sola igual en Pizarra y proyector; movimiento «por tiempo» en el motor (aditivo); cierra el rebote automático; carril gris «automático» | pendiente |
| 5.6 | Acciones declaradas del defensor: ayuda y recupera, es sobrepasado, cambia con…, cierra el rebote, va al dos contra uno | pendiente |
| 5.7 | Robo, rebote defensivo y canasta: cambio de papeles y de aro desde la fase siguiente. Cierre de la capa | pendiente |

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

**No tocar:** la marca `motor: 3` (lo guardado con la capa 4 dejaría de
reproducirse); todo lo nuevo del formato de animación, aditivo.

**Bancos que cambiarán a propósito** (no son regresiones, decirlo al
tocarlos): `eval-repertorio` (anillo del defensor con pendientes;
«defender no se pierde»), `eval-fases` (`PENDIENTES.bloqueo`),
`eval-compilar` (B1 pasa a defender y a moverse), `eval-dibujo` (texto
del bloqueo) y `eval-acciones` si cambian las mecánicas.

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

- `resto()` ofrece *Pasa* y *Tira* en «⋯ más» a quien no lleva balón. Hoy
  avisa al elegirlos; no debería ofrecerlos.
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
- Una vez, en una prueba automatizada, apareció un aviso de «Defiende» que
  nadie eligió. No se ha podido reproducir; se comprobó que las 12 casillas
  de los anillos disparan exactamente su acción.

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
