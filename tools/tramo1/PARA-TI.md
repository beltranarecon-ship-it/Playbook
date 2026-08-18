# Tramo 1 · lo que tienes que hacer tú

Actualizado con lo que han dicho tus consultas. Lo de antes (mi hipótesis de que
la temporada activa se había acabado en junio) **era falso**; esto ya lo sabe.

---

## Hecho ✔

- **Migraciones 016 y 017** aplicadas.
- **Diagnóstico del calendario** confirmado. Ver abajo qué salió de verdad.

---

## 1 · Aplicar la migración 018 (nueva)

Es pequeña e idempotente, como las otras. Crea la tabla que impide que un
entrenamiento que quitas del calendario **reaparezca** la próxima vez que
regeneres los horarios.

En Supabase → SQL Editor: copia entero `supabase/migrations/018_session_slot_exclusions.sql`,
pégalo y Run. Para comprobar:

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name = 'session_slot_exclusions';
```

**Hasta que no la apliques, el botón «Quitar» de una sesión preliminar dará
error.** El resto de la app funciona igual.

---

## 2 · Qué dijeron tus consultas (y por qué me equivoqué)

Yo dije: «el calendario está vacío porque la temporada activa terminó en junio».
Los datos dicen otra cosa:

| Temporada | Rango | Activa |
|---|---|---|
| 2026/27 | 24/08/2026 → 30/06/2027 | no |
| **prueba** | 01/08/2026 → 30/09/2026 | **sí** |
| 2025/26 | 01/09/2025 → 30/06/2026 | no |

La activa **sí** cubre hoy. Lo que salta es que **no hay ni una sesión en estado
preliminar**: la generación automática no ha producido nada nunca. Las 11 que hay
(10 programadas y 1 realizada) las creaste a mano.

Y los horarios están repartidos entre temporadas:

| Equipo | Horarios en | ¿Es la activa? |
|---|---|---|
| Alevín Tello Téllez | prueba | sí |
| **Minibasket CBP** | **2025/26** | **no** |
| Sofia Tártilan C | 2025/26 y prueba | una sí, otra no |

Para **Minibasket CBP** la causa está clara y demostrada: sus horarios cuelgan de
una temporada que no está activa, así que para la activa no tiene ninguno y no hay
nada que generar. La pantalla no dice nada de eso — se limita a responder «el
calendario ya está al día».

Para los otros dos, con dos franjas semanales sobre agosto y septiembre saldrían
unas 17 sesiones por equipo y no hay ninguna: la generación no se ha llegado a
ejecutar. Eso lo arregla la tarea 1.6, que además va a **enseñar en pantalla
cuántas sesiones existen ya** para que «no se ha generado nada» se vea.

---

## 3 · Reiniciar los datos y montar la temporada (tareas 1.3 y 1.4)

La herramienta ya está. **No borres nada a mano**: hazlo con ella, que saca la copia
primero y te enseña el recuento antes de tocar nada.

Con el servidor de desarrollo levantado:

```bash
python serve.py 8139
```

1. **Entra en la app** en `http://localhost:8139` con tu cuenta de administrador.
2. En otra pestaña abre `http://localhost:8139/dev/reinicio.html`.
3. Sigue los tres pasos **en orden**. El botón de borrar no se activa hasta que
   marques que has descargado la copia y la has abierto.

Detalles que conviene saber:

- **La copia se descarga como un `.json`**. Ábrelo y comprueba que tiene contenido
  antes de seguir. Es la única vuelta atrás que hay.
- Hay una casilla para decidir si **borrar también las temporadas antiguas**
  («prueba» y 2025/26) o dejarlas vacías pero conservadas. Borrar los equipos ya
  vacía todo su contenido, así que conservar 2025/26 como histórico es gratis.
- La temporada **2026/27 ya existe**: la herramienta la reutiliza, le corrige las
  fechas al 24/08/2026 → 30/06/2027 y la activa. No crea una duplicada.
- Los 11 periodos de vacaciones se cargan solos, y **no se duplican** si vuelves a
  pulsar el botón.

La página vive en `/dev/`, que en producción devuelve 404 a la fuerza, y además se
niega a arrancar fuera de `localhost`. No se puede ejecutar desde internet.

---

## 4 · Después de eso

Crea tus equipos y, en la pestaña **Horarios** de cada uno, pulsa **«Añadir día de
entreno»**. Ahora cada horario es una cajita con su propio botón de editar, eliges
para qué tramo generar y ves antes lo que va a pasar. Arriba te dice cuántos
entrenamientos hay ya en el calendario — que es justo el dato que faltaba para
darse cuenta de que no se había generado nada.
