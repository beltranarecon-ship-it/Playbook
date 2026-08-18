# Informe de cambios para la v3

Genera `Informe-cambios-v3.docx`: el formulario que recorre los 110 apartados de
la aplicación para que el entrenador marque, uno a uno, qué se queda igual y qué
cambia en la versión 3.

Se guarda aquí para poder **regenerarlo** cuando la v2 cambie (una pantalla
nueva, un apartado que ya no existe) sin volver a montar el documento entero.

## Cómo se regenera

```bash
npm install docx        # única dependencia; no la usa la app, solo esta herramienta
node informe.js ../../Informe-cambios-v3.docx
```

## Dónde se toca qué

- **`contenido.js`** — lo único que hay que editar normalmente. Un objeto por
  bloque, y dentro un objeto por apartado:
  - `hoy` — qué hace la aplicación hoy en ese apartado. Va en gris y **no se
    rellena**: está para que se decida sobre lo que hay de verdad y no sobre lo
    que se recuerda. Si la v2 cambia, esto es lo que se queda obsoleto.
  - `piezas` — los elementos sueltos del apartado, cada uno con su casilla.
  - `libre: true` — añade un recuadro grande de escritura (solo lo usa 15.7).
- **`informe.js`** — maquetación. Solo se toca para cambiar la forma del
  documento, no el contenido.

## Dos detalles de maquetación que cuestan de encontrar

- **`keepNext` en todas las filas menos la última** de cada ficha: es lo único
  que impide que Word parta un apartado entre dos páginas. Las fichas miden unos
  9 cm, así que siempre caben enteras y entran dos por página.
- **La casilla va pegada a su etiqueta con espacio duro** (`NBSP`). Con un
  espacio normal, Word rompe la línea entre el cuadrito y su texto y aparecen
  casillas huérfanas al final del renglón.
