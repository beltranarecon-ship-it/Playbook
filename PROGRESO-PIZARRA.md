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
| 4 · El motor | ⏳ en curso — 4.1 y 4.2 hechos, 4.3 en marcha | — |
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
| 4.3 | Reabrir una jugada guardada y seguir editándola (`Tablero.cargar`) | ⏳ |
| 4.4 | Guardar jugada + animación en Supabase — **necesita decisiones**, ver abajo | pendiente |

En 4.1 salió un fallo de la capa 3: recolocar en la fase 1 una ficha sin
trazos no cambiaba su arranque, y al pasar de fase o volver a la 1 saltaba
a su sitio viejo. Arreglado: se actualiza al soltar el arrastre, y solo
para lo que no participa todavía en la fase.

## Siguiente paso

**Capa 4 · El motor** (§14): compilador nuevo `jugada → animación`,
`engine.js` con carriles conservando su interfaz pública, guardado de
jugada + animación, y reabrir para seguir editando.

Tiene tres decisiones que no se pueden tomar solas, porque rompen cosas
que hoy funcionan o tocan la base de datos en producción:

1. El §12 borra el creador actual (`wizard/paso1.js`, `paso2.js`) y todo
   el motor viejo, pero la pantalla de la Pizarra (ruta, paneles) todavía
   no existe: borrar ahora dejaría la app **sin creador de ejercicios**.
2. El §11.3 pide `alter table exercises add column jugada jsonb` en
   Supabase.
3. El §11.4 dice que las animaciones guardadas hasta hoy se pierden.

Lo que se puede hacer sin esperar, porque solo añade: el compilador nuevo
en `taller/js/pizarra/motor/compilar.js` con su banco, y los carriles en
`engine.js` sin cambiar su interfaz.

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
