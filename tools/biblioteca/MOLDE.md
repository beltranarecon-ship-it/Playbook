# Molde de ficha · cómo se escribe una tanda

Contrato único para añadir ejercicios a la biblioteca. Lo que no esté aquí,
está en [`vocabulario.mjs`](vocabulario.mjs) (valores legales),
[`mapa.mjs`](mapa.mjs) (qué falta por cubrir) y [`DOCTRINA.md`](DOCTRINA.md)
(por qué). El linter es el árbitro: `node tools/biblioteca/lint-tanda.mjs
tanda-XX.mjs --avisos` tiene que salir con **0 errores**.

---

## 1 · La forma del fichero

```js
/* ============================================================
   tanda-XX.mjs — <bloques que cubre y por qué esta tanda existe>
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_XX = [
  { …ficha… },
  { …ficha… },
];
```

`M` y `E` son los anclas medidas de media pista y pista entera. Se usan por
nombre, nunca a ojo: son las mismas que nombra el guion automático, así que el
texto de la ficha y el texto generado hablan igual.

---

## 2 · La ficha, campo a campo

```js
{
  name: 'Nombre corto y concreto',      // único en las 200; no se repite ni con otro nombre
  type: 'Bote',                         // vocabulario del Taller (TIPOS)
  category: 'bote',                     // BLOQUE de contenido (BLOQUE_KEYS)
  tipo_pista: 'media',                  // 'media' | 'entera'
  categoria_rama: 'Minibasket',
  categoria_nivel: [],                  // SIEMPRE vacío salvo psicomotricidad (D9)
  difficulty: 3,                        // 1–6
  intensidad: 4,                        // 1–5
  duration_min: 8, duration_max: 12,    // minutos

  // La frase de la tarjeta. Es lo primero que se lee y puntúa en las
  // sugerencias del planificador: concreta, sin adjetivos de folleto.
  description: '…',

  // QUÉ se entrena y PARA QUÉ. Una frase, con el porqué dentro.
  objetivos: '…',

  // El desarrollo: montaje, reglas, rotación y cuándo se acaba. Es lo que
  // el entrenador lee con los niños ya en la pista.
  descripcion_texto: '…',

  // Puntos clave, errores frecuentes y qué mirar como entrenador. Aquí va
  // el oficio: qué corregir, qué NO corregir, y qué hacer si no sale.
  notas: '…',

  tags: ['bote', 'cambio de mano'],     // SOLO de TAGS; mal tag = invisible

  requisitos: {
    jugadores_min: 4, jugadores_max: 12,
    canastas: 1,                        // 0, 1 o 2 — POR ESTACIÓN
    estaciones: 2,                      // opcional; cuántas van en paralelo
    simultaneo: true,                   // opcional; todos trabajan a la vez, no hay colas
    material: ['balones', 'conos'],
    densidad: 'alta',                   // alta | media | baja
    oposicion: 'real',                  // nula | pasiva | semiactiva | real
    presion: 'marcador',                // ninguna | espacio | tiempo | marcador
    requisito_previo: 'saber hacer X',  // NUNCA una edad ni una categoría (D9)
    dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 45 },
    organizacion: 'Con 12: …',          // OBLIGATORIO decir «12» y el reparto concreto
    niveles: {                          // los tres, distintos entre sí (D8)
      base: '…', intermedio: '…', avanzado: '…',
    },
    criterio_exito: 'cuándo está bien hecho',
    aplicacion: '…',                    // OBLIGATORIO si tags incluye 'analítico' (D1)
    justificacion_densidad: '…',        // OBLIGATORIO si densidad es 'baja' (D4)
  },

  tablero: () => [ … ],                 // ver §3
  intent: { … } | null,                 // ver §4
}
```

### Los campos que más se escriben mal

| Campo | La trampa |
|---|---|
| `organizacion` | Tiene que **contener el número 12** y un reparto concreto: «Con 12: dos estaciones, una por canasta, seis por estación en dos filas de tres». «Se puede adaptar al grupo» es un error del linter, no un aviso. |
| `requisito_previo` | Es un **saber hacer**, no una edad. «botar en carrera sin mirar el balón», no «a partir de alevín». |
| `dosis.unidad` | En un juego continuo, `cantidad: 240` son **240 segundos**, no 240 repeticiones. Confundirlo multiplica el trabajo por cuatro. |
| `niveles` | Tres escalones **distintos** que cambian la exigencia de verdad, no el mismo texto con otras palabras. Sustituyen a la etiqueta de edad. |
| `canastas` | Es por estación. `estaciones: 2, canastas: 1` = hacen falta dos aros. |
| `tags` | Solo los de `TAGS`. Un tag inventado saca el ejercicio de las sugerencias del planificador. |
| `oposicion` vs `presion` | Ver §5. |

---

## 3 · El tablero

Devuelve el array de elementos. Cuatro ayudantes:

```js
jug('A', 1, x, y)        // jugador; equipo 'A' (ataque) o 'B' (defensa) y etiqueta
balon(x, y)              // balón suelto o en manos de quien esté en (x,y)
balon(x, y, 'balon_der') // con id propio, solo si la intención lo nombra
cono(x, y)               // cono decorativo
cono(x, y, 'rodear')     // cono que hay que sortear (exige un evento rodea_cono)
fila(x, y, n, grados)    // cola de n jugadores avanzando en `grados`
                         // 0 = hacia la derecha del lienzo, sentido horario
```

**Los ids se derivan solos**: `jug('A', 1, …)` es `'A1'` en la intención. El
primero de una `fila` es `'fila1'` (la segunda fila del tablero, `'fila2'`), y
los siguientes de esa cola son `'fila1_2'`, `'fila1_3'`… hasta el quinto.

### Anclas medidas

**Media pista** — está dibujada en **paisaje**: el aro queda a la **izquierda**
y el campo va de `x` 0,146 (fondo) a 0,829 (medio campo); `y` es el ancho, de
0,05 a 0,943.

```
aro [0.172, 0.500]              base [0.406, 0.496]
poste_bajo_izq [0.192, 0.386]   escolta_izq [0.386, 0.336]
poste_bajo_der [0.192, 0.606]   escolta_der [0.386, 0.656]
codo_izq [0.336, 0.386]         alero_izq [0.366, 0.100]
codo_der [0.336, 0.606]         alero_der [0.366, 0.893]
tiro_libre [0.336, 0.496]       esquina_izq [0.206, 0.100]
centro [0.487, 0.496]           esquina_der [0.206, 0.893]
```

**Pista entera** — retrato, aro norte arriba. Campo: `x` 0,057–0,942,
`y` 0,02–0,98.

```
aro [0.499, 0.091]              base [0.499, 0.306]
poste_bajo_izq [0.376, 0.111]   escolta_izq [0.339, 0.286]
poste_bajo_der [0.622, 0.111]   escolta_der [0.659, 0.286]
poste_alto_izq [0.376, 0.186]   alero_izq [0.107, 0.266]
poste_alto_der [0.622, 0.186]   alero_der [0.892, 0.266]
codo_izq [0.376, 0.236]         esquina_izq [0.087, 0.080]
codo_der [0.622, 0.236]         esquina_der [0.912, 0.080]
tiro_libre [0.499, 0.236]       centro [0.499, 0.500]
```

Reglas de dibujo que comprueba el linter:

- Nada fuera del campo (con 0,04 de holgura).
- Dos jugadores a menos de **0,035** se pintan encima: no vale.
- Una `fila` de `n` avanza 0,06 por puesto: comprueba que el último cabe.
- Si dibujas conos de `rodear`, la intención **tiene** que sortearlos.

---

## 4 · La intención

El compilador traduce intención→geometría de forma determinista. **No se
escriben coordenadas de curvas: se escribe baloncesto.**

```js
intent: {
  canasta: 'norte' | null,        // null cuando el ejercicio no usa aro
  balones: [{ id, portador }],    // opcional: quién sale con cada balón
  fases: [
    { eventos: [ … ] },           // una fase = un golpe de la jugada
  ],
}
```

### Los nueve eventos

| tipo | qué hace | campos |
|---|---|---|
| `bote` | avanza con balón | `hacia` |
| `corte` | se mueve sin balón | `hacia` |
| `pase` | pasa a otro | `a` |
| `tiro` | tira al aro resuelto | — |
| `bloqueo` | bloqueo **indirecto** (se pone para un compañero) | `bloqueado_id` |
| `defiende` | cuenta como defensor; se mueve si le das `marca` o `hacia` | `marca`, `hacia` |
| `rodea_cono` | teje el slalom en el `bote`/`corte` del mismo jugador | `cono_id` |
| `vuelve_a_fila` | vuelve al final de su cola | — |
| `recoge` | va a por un balón suelto y se lo queda | `balon_id` (opcional) |

### `hacia`, que es donde más se falla

- `{ x, y }` — punto exacto.
- `'aro'` — **llega** al aro y se para a un metro largo. Es lo que usa una
  **entrada, bandeja o doble ritmo**.
- `'canasta'` — **avanza** hacia el aro sin llegar (55 % con bote, 30 % con
  corte). Es una penetración que aún no termina.
- `'codo_der'`, `'poste_bajo_izq'`… — cualquier ancla por nombre.

> **La regla que costó trece fichas mal dibujadas:** si el ejercicio dice
> «entrada», «doble ritmo» o «finalización», el destino es `'aro'`. Con
> `'canasta'` el jugador se planta a media distancia y la entrada sale
> dibujada como un tiro de cuatro metros. El linter lo caza.

### El ciclo se cierra

Un ejercicio de fila que acaba en tiro **tiene que** recoger el balón y volver
a la cola, o el balón se queda en el aro para siempre:

```js
{ eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'aro' }] },
{ eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
{ eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
{ eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
```

### Cuándo `intent: null`

Cuando el ejercicio es **juego abierto** (2c2, 3c3, un pilla-pilla): animar un
desenlace sería enseñar una jugada cerrada donde debe haber lectura. Y cuando
el trabajo es **en el sitio** y no hay nada que desplazar. En los dos casos
queda el montaje, que es la verdad de ese ejercicio.

En todo lo demás, **anima**: una ficha con secuencia y sin animación es media
ficha.

### Que no se quede nadie quieto

Todo jugador dibujado tiene que participar en alguna fase. Un jugador inerte es
un aviso del linter, y casi siempre significa que falta media jugada.

---

## 5 · Los dos ejes: oposición y presión

Son **dos preguntas distintas** y durante noventa y siete fichas fueron una
sola (D19b).

- **`oposicion`** — ¿hay alguien a quien **ganar** o que te puede **quitar el
  balón**? `nula` · `pasiva` (está, no disputa) · `semiactiva` (condiciona, no
  impide) · `real`.
- **`presion`** — qué aprieta cuando no hay rival. `ninguna` · `espacio` (se
  comparte o se estrecha) · `tiempo` (una señal o un reloj) · `marcador` (se
  compite).

El compañero que levanta dedos para que mires arriba, el que te devuelve el
rebote y el equipo que tira a la vez en la otra canasta **aprietan pero no
oponen**. Y son ortogonales: un 1c1 puede tener defensa real **y** marcador.

**El linter falla** si declaras oposición y no hay un defensor en la pizarra.
Si dices `oposicion: 'real'`, dibuja al defensor (`jug('B', …)`) y dale un
evento `defiende`.

---

## 6 · Las invariantes del conjunto

Se miden sobre la biblioteca entera, así que una tanda sola no puede romperlas
—pero sí empujarlas—:

- **Al menos la mitad** de cada bloque técnico con oposición `semiactiva` o
  `real`. Sin esto la biblioteca deriva sola hacia el ejercicio bonito sin
  defensa, que es el que más fácil se escribe y peor transfiere.
- **Máximo 25 %** de la biblioteca sin oposición **ni** presión.
- **Máximo 10 %** con densidad `baja`, y cada una con su justificación escrita.
- **Sin duplicados**: ni el mismo nombre ni el mismo ejercicio con otro nombre.

---

## 7 · El listón: qué se descarta

Un ejercicio entra si pasa las cinco:

1. **Densidad real.** Cuenta las acciones por jugador y minuto con el reparto
   que declaras. Doce niños, un balón y una fila suena bien y no entrena a
   nadie (D2, D4).
2. **Tiene algo que mirar.** El manejo descontextualizado no transfiere (D20).
   Si el jugador solo mira el balón, no es baloncesto: es circo.
3. **Escala a doce.** Si con doce se convierte en cuatro colas de tres, no
   entra tal cual: cámbialo hasta que escale, y escríbelo en `organizacion`.
4. **Se puede dibujar.** Si no eres capaz de decir quién se mueve y adónde en
   tres o cuatro fases, probablemente el ejercicio no está claro ni en tu
   cabeza.
5. **La ficha enseña oficio.** `notas` tiene que decir qué corregir, qué NO
   corregir y qué hacer cuando no sale. Sin eso es una descripción, no una
   ficha de entrenador.

---

## 8 · El bucle de trabajo

```bash
node tools/biblioteca/lint-tanda.mjs tanda-08.mjs --avisos
```

Hasta **0 errores**. Después, con la tanda enchufada en `construir.mjs`:

```bash
node tools/biblioteca/construir.mjs --lint
```
