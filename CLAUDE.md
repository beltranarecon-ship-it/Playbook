# Playbook CBP — instrucciones del proyecto

App del Club Baloncesto Pozuelo. La especificación funcional está en
`ESPECIFICACION-v2.1.md` y manda sobre cualquier suposición.

## Reglas permanentes

- **Todo en español**: comentarios del código, nombres de las pruebas,
  mensajes de commit y cualquier informe que yo lea.
- **Cada cambio se comprueba antes de darlo por bueno**, para no arruinar
  lo que ya funciona. Cada módulo puro tiene su banco de pruebas en
  `tools/`, `taller/tools/` o `equipos/tools/`; todos tienen que pasar en
  verde antes de dar nada por terminado.
- **Lo que no cuadra se dice, no se arregla por tu cuenta.**

Lo que sigue es el protocolo que se aplica a CUALQUIER petición mía sobre
esta app.

---

# PROTOCOLO MAESTRO PARA MODIFICACIONES Y CORRECCIÓN DE ERRORES — PLAYBOOK

A partir de ahora, **cada vez que te solicite una modificación, mejora, nueva funcionalidad o corrección de un error en la app Playbook**, debes seguir obligatoriamente este protocolo.

## 1. COMPRENDER ANTES DE ACTUAR

No ejecutes ningún cambio inmediatamente después de recibir mi petición.

Primero debes analizar exactamente qué estoy intentando conseguir y comprobar si tienes toda la información necesaria para realizarlo correctamente.

Debes distinguir entre:
- Lo que te estoy pidiendo explícitamente.
- Lo que necesitas averiguar para poder hacerlo correctamente.
- Posibles consecuencias del cambio sobre otras partes de la aplicación.
- Casos límite o situaciones que podrían generar errores.
- Decisiones de diseño, UX o funcionamiento que todavía no estén definidas.

Si algo no está suficientemente claro, **pregúntame antes de modificar nada**.

---

## 2. PREGUNTAS INTERACTIVAS OBLIGATORIAS

Hazme **todas las preguntas que sean realmente necesarias** para definir correctamente la modificación.

Quiero que las preguntas sean:
- Claras y concretas.
- Interactivas siempre que sea posible.
- Una por una o en pequeños bloques cuando estén relacionadas.
- Con opciones de respuesta cuando existan alternativas razonables.

Por ejemplo:

> ¿Qué debería ocurrir al pulsar el botón?
>
> **A)** Abrir una pantalla nueva  
> **B)** Abrir un modal  
> **C)** Desplegar contenido en la misma pantalla  
> **D)** Otra opción

No hagas preguntas innecesarias si puedes deducir razonablemente la respuesta a partir de la aplicación, su código existente o mis instrucciones.

### IMPORTANTE

Si existe una decisión que puede afectar significativamente al resultado final y no puede deducirse de forma fiable, **no la inventes**. Pregúntamela.

Debes continuar haciendo preguntas hasta tener la información suficiente para ejecutar la modificación correctamente.

---

## 3. SUGERENCIAS DE MEJORA

Mientras analizas mi petición, debes detectar también **mejoras o ideas que tengan sentido específicamente para el apartado que estamos modificando**.

No quiero sugerencias genéricas.

Las sugerencias deben estar directamente relacionadas con la modificación solicitada y pueden incluir:
- Mejoras de UX/UI.
- Casos límite.
- Prevención de errores.
- Mejoras de rendimiento.
- Automatizaciones.
- Mejoras de accesibilidad.
- Mejoras de navegación.
- Mejoras de coherencia con el resto de Playbook.
- Funcionalidades complementarias.
- Situaciones que quizá no haya tenido en cuenta.

Preséntamelas de forma breve y explícita.

Ejemplo:

> **Sugerencias que considero interesantes:**
> 1. Mostrar una confirmación antes de eliminar el elemento.
> 2. Mantener el estado anterior si el usuario cancela.
> 3. Añadir una búsqueda si el número de elementos puede crecer mucho.

### NO HAGAS ESTO

No añadas automáticamente ninguna sugerencia al producto.

Primero debes indicármela y preguntarme si quiero incorporarla cuando sea necesario.

Mi petición original siempre tiene prioridad sobre tus sugerencias.

---

## 4. COMPROBAR EL CÓDIGO Y LA ARQUITECTURA

Antes de diseñar la solución definitiva, inspecciona el código relevante de Playbook.

Debes averiguar:
- Qué componentes están implicados.
- Qué páginas están implicadas.
- Qué lógica existe actualmente.
- Qué datos utiliza.
- Qué tablas, relaciones o estructuras de base de datos intervienen, si las hay.
- Qué APIs o servicios intervienen.
- Qué otros componentes podrían verse afectados.
- Si existe código reutilizable que pueda aprovecharse.
- Si ya existe una solución parcial que deba modificarse en lugar de crear otra.

**No dupliques funcionalidades ni lógica si ya existe una implementación reutilizable.**

Prioriza siempre modificar la arquitectura existente de forma limpia antes que crear soluciones paralelas.

---

## 5. PLAN DE IMPLEMENTACIÓN

Cuando hayas entendido completamente la petición y hayas resuelto las dudas necesarias, crea un plan concreto de implementación.

El plan debe ajustarse exactamente a lo que buscamos.

Debe indicar, de forma resumida pero suficientemente precisa:

1. Qué archivos/componentes se modificarán.
2. Qué lógica se cambiará.
3. Qué elementos nuevos se crearán, si son necesarios.
4. Qué datos se modificarán, si procede.
5. Si afecta a base de datos, qué cambios serán necesarios.
6. Qué partes existentes deben mantenerse intactas.
7. Cómo se comprobará que el cambio funciona.
8. Qué posibles efectos secundarios se deben revisar.

No hagas un plan innecesariamente largo.

---

## 6. RESUMEN OBLIGATORIO ANTES DE EJECUTAR

**Antes de realizar cualquier modificación**, debes explicarme MUY BREVEMENTE qué vas a cambiar exactamente.

Utiliza un formato similar a:

> **Plan que voy a ejecutar:**
> - Cambiaré X para que haga Y.
> - Modificaré X componente para conseguir Z.
> - Mantendré intacto A y B.
> - Añadiré C.
> - Comprobaré finalmente D y E.

Después, pregúntame si procedemos.

**No ejecutes la modificación hasta que yo haya confirmado el plan**, salvo que te indique explícitamente que puedes ejecutar directamente sin confirmación.

---

## 7. EJECUTAR

Una vez confirmado el plan:

- Ejecuta la modificación.
- No cambies otras cosas que no estén relacionadas con la petición.
- Mantén el diseño y comportamiento existente de Playbook siempre que no se haya solicitado modificarlos.
- Reutiliza componentes y patrones existentes.
- Evita introducir dependencias innecesarias.
- Mantén el código limpio y coherente con la arquitectura actual.
- No hagas cambios "por si acaso".
- No elimines funcionalidades existentes sin consultármelo.

Si durante la implementación descubres algo que obliga a cambiar sustancialmente el plan aprobado, **detente y consúltamelo antes de continuar**.

---

## 8. COMPROBACIÓN FINAL

Después de ejecutar el cambio, comprueba que:

- La funcionalidad solicitada funciona correctamente.
- No se han introducido errores.
- Las funcionalidades relacionadas siguen funcionando.
- La interfaz mantiene la coherencia visual de Playbook.
- No existen errores evidentes de consola.
- Los datos se guardan, cargan y actualizan correctamente cuando corresponda.
- Los estados de carga, vacío y error están correctamente contemplados cuando sean relevantes.
- La solución funciona también en los casos límite importantes.

Si detectas un problema durante esta comprobación, corrígelo si forma parte del mismo cambio y no altera los requisitos aprobados.

---

# REGLAS GENERALES

### Regla 1 — No asumir
Si una decisión importante no está clara, pregunta.

### Regla 2 — No ejecutar prematuramente
Primero comprender → preguntar → sugerir → planificar → resumir → confirmar → ejecutar → comprobar.

### Regla 3 — Sugerir, no imponer
Puedes proponer mejoras, pero nunca incorporarlas por tu cuenta si modifican el alcance de mi petición.

### Regla 4 — Respetar Playbook
Antes de crear algo nuevo, comprueba cómo está implementado actualmente y reutiliza los patrones existentes.

### Regla 5 — Cambios mínimos
Modifica únicamente lo necesario para conseguir el resultado solicitado.

### Regla 6 — Pensar en consecuencias
Antes de modificar una parte, comprueba qué otras partes de la aplicación podrían depender de ella.

### Regla 7 — No inventar requisitos
Si yo no he especificado algo y no puede deducirse con seguridad, pregúntame.

### Regla 8 — Prioridad absoluta
Mis requisitos explícitos tienen prioridad sobre tus sugerencias o preferencias técnicas.

---

# FLUJO OBLIGATORIO

Para **TODAS** las futuras modificaciones o correcciones de Playbook, sigue este flujo:

**PETICIÓN**
↓
**ANÁLISIS**
↓
**PREGUNTAS NECESARIAS**
↓
**SUGERENCIAS ESPECÍFICAS**
↓
**INSPECCIÓN DEL CÓDIGO**
↓
**PLAN**
↓
**RESUMEN MUY BREVE DE LOS CAMBIOS EXACTOS**
↓
**MI CONFIRMACIÓN**
↓
**IMPLEMENTACIÓN**
↓
**COMPROBACIÓN**
↓
**RESULTADO FINAL**

Este protocolo se aplica a partir de ahora a **cualquier modificación, mejora, funcionalidad o corrección de errores que te solicite en Playbook**.