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

| Capa | Estado | Último commit |
|---|---|---|
| 1 · Lienzo, zoom, gestos, fichas | ✅ cerrada | `57255ed` |
| 2 · Dibujar: anillo, trazo, nodos, encadenado, repaso | ✅ cerrada | `2db2b91` |
| 3 · Fases: carriles, arranques, «Siguiente fase», línea de tiempo, editar fases anteriores | ✅ cerrada | `63d4cf6` |
| 4 · El motor | ⏳ en curso — 4.1 a 4.3 hechos, 4.4 a medias: **esperando decisiones** | — |
| 5 · Defensa | pendiente | — |
| 6 · Conos y elementos | pendiente | — |
| 7 · Texto y voz | pendiente | — |
| 8 · Ramas | pendiente | — |
| 9 · Variantes y vídeo | pendiente | — |
| 10 · Plantillas y remate | pendiente | — |

Todo lo cerrado está en `main` en GitHub. Bancos: **59 en verde, 1441
pruebas**. Arnés para probar de punta a punta: `dev/pizarra-dibujar.html`.

## Capa 4, paso a paso

| Paso | Qué | Estado |
|---|---|---|
| 4.1 | Compilador `jugada → animación` (`pizarra/motor/compilar.js`), con el formato que ya leen proyector, miniaturas y visor. `Tablero.jugada()` | ✅ |
| 4.2 | `engine.js` con carriles: varios tramos por ficha y fase, arranques propios, el dueño del balón cambiando a mitad de fase. Sin cambiar cómo se ven las animaciones guardadas | ✅ |
| 4.3 | Reabrir una jugada guardada y seguir editándola (`Tablero.cargar`), y abrir desde su animación un ejercicio de antes de la Pizarra (§11.4) | ✅ |
| 4.4a | Guardar aunque falte una columna nueva (`supabase/columnas.js`), y la migración 043 con su comprobación. **La 043 hay que aplicarla a mano** en Supabase | ✅ |
| 4.4b | Conectar guardar y abrir a una pantalla, y borrar lo viejo — plan presentado, **esperando confirmación** (ver «Siguiente paso») | esperando |

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
   trazos). Bancos: 63 en verde, 1529 pruebas.
3. §11.4 en la ficha, el proyector, el visor de Equipos y la lista.
4. Borrado del §12, mudando lo que sobrevive, y bancos adaptados.

## Pendiente de decidir o de arreglar (no se toca sin avisar)

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
Beltrán). Hubo un 400 en consola antes del éxito: casi seguro el primer
intento rechazado por la columna `jugada` (la 043 no está aplicada) y el
reintento sin ella, que es lo que tiene que pasar.

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
