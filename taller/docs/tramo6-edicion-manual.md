# Tramo 6 · Edición manual de la animación en el paso 2

Prompt de implementación. El objetivo: que en el paso 2, además de generar la
animación (IA / regex / simulador), el usuario pueda **retocar a mano** flechas,
trayectorias, posiciones de salida y movimientos de cualquier elemento, y que
**las fases siguientes se recalculen a partir de la posición editada**, sin
perder los retoques al regenerar.

## Decisiones cerradas (pop-out con el usuario)

1. **Alcance:** las cuatro cosas — mover el destino de una flecha, mover la
   posición de inicio de un elemento, curvar la trayectoria con waypoints, y
   añadir / eliminar / cambiar el tipo de un movimiento.
2. **Propagación:** *re-resolver desde la edición*. No basta con desplazar la
   trayectoria: al mover a un atacante, su **defensor debe volver a reaccionar**
   (la defensa reactiva se recalcula desde la nueva posición).
3. **Persistencia:** *capa de overrides que se preserva*. Los retoques viven
   aparte del intent generado; al pulsar "Regenerar" / "Otra variante" se
   re-aplican sobre la nueva base y los que ya no encajan se avisan (no se
   pierden en silencio).
4. **Interacción:** *handles en la pista + selector de fase*. Arrastrar los
   puntos directamente sobre el canvas, con un control para moverse entre fases.

## Qué ya existe y se reutiliza (no reimplementar)

- **`taller/js/canvas/editor-canvas.js` — `EditorCanvas`**: edición vectorial de
  las flechas de UNA fase. Ya hace: seleccionar flecha, arrastrar nodos y
  handles Bézier, insertar nodo en un segmento (clic sobre la línea), borrar
  nodo (Supr), alternar recto/curva (clic en el nodo). Emite `'change'` y
  `'select'`. Muta `m.path` in situ.
- **`restPositions(anim)`** (mismo archivo): calcula el inicio de cada fase
  leyendo el final de la anterior. **La propagación de posiciones aguas abajo ya
  funciona** — el motor y el editor arrancan cada fase desde ahí.
- **`taller/js/views/editor.js`**: editor a pantalla completa que envuelve
  `EditorCanvas` con storyboard de fases reordenable (añadir/borrar/reordenar),
  panel lateral (duración, pausa, lista de movimientos), **undo/redo**
  (`History`) y guardado. Buena fuente de patrones; parte se puede compartir.
- **Pipeline intent→geometría**: `defensaReactiva(intent, elementos, pista)` →
  `compilarAnimacion(intent, elementos, pista, {posiciones})`. `simularJugada`
  para el ataque-defensa. En `client.js`, `generarLocal` / `compilarIntentIA`.
  La salida compilada lleva `_intent`, `_sim`, `canasta`, `warnings`, `_mock`.
- **Banco**: `taller/tools/eval-animacion.mjs`, Node puro, sin red. Todo lo nuevo
  se verifica ahí antes de darlo por bueno.

Forma de la animación (recordatorio):
`{pista, jugadores[], balones[], conos[], fases[]}`; `fase = {id, duracion_ms,
pausa_post_ms, movimientos[], pases[], tiros[], bloqueos[], defensores[]}`;
`movimiento = {elemento_id, tipo_elemento, tipo_movimiento, path:[{x,y,tipo_nodo,
handle_in,handle_out}]}`.

## Arquitectura: resolver + capa de overrides

El punto delicado es reconciliar *re-resolver* con *overrides preservados*. Se
resuelve con **dos capas de edición** y un **resolver puro**.

### Estado nuevo en el draft

- `draft.intent` — el intent de la última generación (ya se guarda dentro de
  `draft.animacion._intent`; promoverlo a campo propio del draft). Es la BASE.
- `draft.ediciones` — lista ordenada de overrides manuales. Cada uno:

  ```
  { id, fase, elemento_id, tipo_elemento, op, valor }
  op ∈ 'destino' | 'inicio' | 'ruta' | 'tipo' | 'add' | 'delete'
  ```

  - `destino`  → fija el punto de llegada de `elemento_id` en `fase`: `{x,y}`.
  - `inicio`   → mueve la posición de salida (edita `posicion_inicial`).
  - `ruta`     → reemplaza la lista de nodos completa de un movimiento (curvas).
  - `tipo`     → cambia `tipo_movimiento` o convierte pase↔tiro↔bote.
  - `add`      → inserta un movimiento nuevo en una fase.
  - `delete`   → elimina un movimiento de una fase.

### `resolverAnimacion(intent, ediciones, elementos, pista) → animacion`

Función **pura** (Node, testeable en el banco), que reconstruye la geometría
desde cero cada vez:

1. Parte del `intent` base (vacío si la jugada se construyó 100% a mano).
2. **Capa intent** — pliega las ediciones expresables como intención:
   `tipo`, `add`, `delete`, y `destino` cuando el objetivo es un pase / tiro /
   bote (se traduce a `hacia:{x,y}` — el compilador ya respeta destino
   explícito, cambio del Tramo 5).
3. `intentEff = defensaReactiva(intentEff, elementos, pista)` →
   **la defensa vuelve a reaccionar** a las posiciones nuevas.
4. `geo = compilarAnimacion(intentEff, elementos, pista, {posiciones})`.
5. **Capa geometría** — aplica encima las ediciones puramente geométricas:
   `ruta` (waypoints/curvas), `inicio` (posicion_inicial), y los `destino` que
   el compilador no sabe expresar. `restPositions` propaga los inicios de las
   fases siguientes automáticamente.
6. Devuelve `geo`. Se re-renderiza preview + storyboard.

**Round-trip con Regenerar / Otra variante:** el nuevo intent sustituye a
`draft.intent`, pero `draft.ediciones` se conserva y se re-resuelve encima. Las
ediciones cuyo `(fase, elemento_id)` ya no existe en la nueva base se recogen en
`descartadas` y se muestran como chips descartables ("2 retoques ya no encajan").

**Honestidad del modelo:** las ediciones de intención (mover un destino, cambiar
tipo) sí disparan re-resolución real (defensa incluida); las puramente
geométricas (curvar una línea) se re-aplican como override y sobreviven, pero no
"reaccionan" — una curva es una curva. Coincide con la intuición del usuario.

## Subtramos

### 6.1 — Editor dentro del paso 2 (reutilización, sin semántica nueva)
Montar `EditorCanvas` en un modo "Ajustar" del paso 2 tras generar. Selector de
fase explícito (el motor ya tiene prev/next; exponer un scrubber). Undo/redo
reutilizando `History`. En este subtramo las ediciones aún mutan una copia de
trabajo y `restPositions` propaga.
- **Aceptación:** arrastrar un nodo → el inicio de la fase siguiente se desplaza;
  undo/redo funciona; cambiar de fase conserva la selección.
- **Banco:** test node-puro de `restPositions` (mover final de fase k ⇒ inicio de
  k+1 igual al nuevo final).

### 6.2 — Modelo de overrides + resolver
Introducir `draft.ediciones` y `resolverAnimacion`. Enrutar cada `'change'` del
`EditorCanvas` a una operación de override en vez de mutar la geometría directa.
Preservar a través de Regenerar/Otra variante; superficie de `descartadas`.
- **Aceptación:** un override `destino` sobre un atacante ⇒ su defensor termina
  goal-side de la NUEVA posición; el override sobrevive a "Otra variante".
- **Banco:**
  - `edit_destino_reresuelve_defensa`
  - `edit_sobrevive_regenerar` (+ `descartadas` cuando no encaja)
  - `edit_resolver_determinista` (mismo intent+ediciones ⇒ geometría idéntica)
  - `edit_ruta_curva_se_preserva`

### 6.3 — Mover inicio + añadir / borrar / cambiar tipo
Handles sobre los símbolos (arrastrar la ficha para mover su salida). Menú por
movimiento: añadir flecha desde una ficha, borrar, cambiar tipo (incl.
pase↔tiro↔bote). Traducir cada gesto a su `op` de override.
- **Aceptación:** mover el inicio de un jugador re-resuelve toda su cadena;
  convertir un pase en bote cambia el tipo de flecha y la posesión del balón.
- **Banco:** `edit_mover_inicio_recompila`, `edit_cambia_tipo_pase_a_bote`,
  `edit_add_movimiento`, `edit_delete_movimiento`.

### 6.4 — Persistencia
Guardar `intent` + `ediciones` junto al ejercicio, además de `animacion` (la
geometría horneada para reproducción/thumbnail). Al reabrir en `editor.js`, los
retoques siguen ahí y se pueden seguir editando. Requiere columna/campo nuevo
(migración Supabase — la corre el USUARIO, no yo).
- **Aceptación:** guardar → reabrir → los retoques persisten y "Regenerar"
  sigue respetándolos.

## Riesgos / tensiones a vigilar

- **Re-resolución mueve cosas que no tocaste** (la defensa re-reacciona). Se
  limita a que solo la capa de defensa reactiva se recalcula; las trayectorias
  de ataque editadas quedan pinneadas. Si molesta, en un futuro un toggle
  "bloquear esta fase".
- **El intent no expresa un movimiento añadido a mano** (p. ej. un corte extra
  arbitrario). Vive como override puramente geométrico y no participa en la
  reacción de defensa — documentado, no es bug.
- **Bug preexistente** de restaurar el valor del textarea en paso2 — fuera de
  alcance, no tocar aquí.

## Regla operativa
Sin red ni Supabase en el banco (stubs). Migraciones las corre el usuario.
Verificación: `node taller/tools/eval-animacion.mjs` en verde + smoke test en el
navegador (arrastrar, propagar, regenerar, deshacer) antes de dar por bueno cada
subtramo.
