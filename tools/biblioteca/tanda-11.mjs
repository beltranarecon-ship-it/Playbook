/* marco: 3 */
/* ============================================================
   tanda-11.mjs — defensa (Bloque D).

   El bloque donde más fácil se cuela lo que la doctrina prohíbe: la
   zona, que en mini está sancionada con dos tiros libres y posesión
   (D10), y la negación de la línea de pase, que se quita del núcleo
   para que ayudar y recuperar se aprendan de verdad (D22). Aquí no
   hay ni una ficha de ninguna de las dos.

   Esta tanda cierra el hueco que el linter marcaba a cero —el CIERRE
   DE REBOTE, que estaba entero en el bloque de rebote y no existía
   como hábito defensivo: buscar al par ANTES que al balón— y completa
   la defensa sin balón, la del bote y la de juego reducido.

   Doctrina que más aprieta aquí:
     D10 · nada de zona: está prohibida por reglamento
     D11 · toda ayuda lleva su recuperación
     D22 · no se niega la línea de pase; se ve al par y al balón
     D19 · la oposición sube en cuatro escalones
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_11 = [

  /* ═══ POSTURA Y DEFENSA DEL BOTE ═══════════════════════════ */
  {
    name: 'Postura con el balón delante',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Desplazamiento defensivo copiando a un atacante que sí lleva balón: los pies son los mismos, pero ya hay algo que mirar.',
    objetivos: 'Sacar la postura defensiva del vacío: los pies se entrenan igual, pero con un balón delante la mirada aprende dónde tiene que estar.',
    descripcion_texto: 'Por parejas enfrentadas a dos metros dentro de un cuadrado marcado. El atacante bota y se desplaza lateralmente, adelante y atrás, sin salir del cuadrado; el defensor le mantiene la distancia con la mano de abajo cerca del balón, sin llegar a robar. Treinta segundos y cambio. Al final de cada turno, el atacante dice si el defensor le ha mirado la cara o el balón.',
    notas: 'Puntos clave: pies más anchos que los hombros, peso en las plantas, y la mirada al PECHO del atacante —no al balón, que finta, ni a la cara, que también—; la mano de abajo va bajo el balón, con la palma hacia arriba. Error frecuentísimo: seguir el balón con la cabeza y comerse el primer cambio de mano. Segundo: cruzar los pies al desplazarse, que es justo el instante en el que un atacante pasaría. Esto es el escalón anterior a cualquier uno contra uno defensivo: si no aguanta treinta segundos aquí, no aguanta una posesión.',
    tags: ['postura defensiva', 'desplazamiento defensivo', 'defensa individual', 'defensa del bote'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva', presion: 'ninguna',
      requisito_previo: 'mantenerse agachado con los pies separados sin apoyar las manos en las rodillas',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: seis parejas a la vez, cada una en su cuadrado de conos repartido por la pista. Treinta segundos y se cambia quien defiende.',
      niveles: {
        base: 'el atacante solo se desplaza de lado y a ritmo lento.',
        intermedio: 'se desplaza en las cuatro direcciones y cambia de mano.',
        avanzado: 'el atacante puede arrancar una vez por turno y el defensor tiene que girar y perseguir sin cruzar los pies en el giro.',
      },
      criterio_exito: 'treinta segundos sin cruzar los pies y sin que el atacante le vea mirar el balón',
    },
    tablero: () => [
      jug('A', 1, 0.5265, 0.3289), jug('B', 1, 0.4288, 0.3289),
      jug('A', 2, 0.5265, 0.6424), jug('B', 2, 0.4288, 0.6424),
      cono(0.585, 0.2418), cono(0.585, 0.4508), cono(0.3703, 0.2418), cono(0.3703, 0.4508),
      cono(0.585, 0.5553), cono(0.585, 0.7643), cono(0.3703, 0.5553), cono(0.3703, 0.7643),
      balon(0.5265, 0.3289), balon(0.5265, 0.6424),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.5265, y: 0.2679 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.4288, y: 0.2679 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.5265, y: 0.5815 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.4288, y: 0.5815 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.5265, y: 0.4246 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.4288, y: 0.4246 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.5265, y: 0.7382 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.4288, y: 0.7382 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.4582, y: 0.3463 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3801, y: 0.3463 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.4582, y: 0.6598 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.3801, y: 0.6598 } },
        ] },
      ],
    },
  },
  {
    name: 'Frenar al que sube el balón',
    type: 'Defensa', category: 'defensa', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Defender a quien sube el balón desde el fondo: no se roba, se le obliga a llegar despacio y por la banda.',
    objetivos: 'Aprender que el primer trabajo defensivo del partido es quitarle velocidad al contrario, no quitarle el balón.',
    descripcion_texto: 'Atacante en el fondo con balón y defensor delante. El atacante tiene que llegar a medio campo; el defensor va de espaldas frenándole, sin robar y sin dejarse superar. Se cuenta cuánto tarda el atacante en cruzar: si tarda más de cinco segundos, punto para el defensor. Se vuelve andando y se cambian los papeles.',
    notas: 'Puntos clave: el defensor va de espaldas en pasos cortos y ligeramente ladeado hacia la banda, que es donde quiere mandarle; nunca de frente y nunca corriendo hacia atrás con los pies juntos. Error frecuente: ir a robar en el medio campo y comerse toda la pista por detrás. Aquí se ve muy claro que a esta edad la defensa se hace con los pies: el que mete la mano pierde el sitio en la primera y ya no lo recupera. Ojo con la carga, que esto es intensísimo: series cortas y descansos de verdad.',
    tags: ['defensa individual', 'defensa del bote', 'desplazamiento defensivo', 'postura defensiva', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'desplazarse en postura defensiva hacia atrás sin juntar los pies',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: seis parejas repartidas a lo ancho del fondo, saliendo de tres en tres para no chocarse. Se cambia de papel en cada viaje.',
      niveles: {
        base: 'el atacante avanza en línea recta y a ritmo medio.',
        intermedio: 'el atacante ataca libre y hay que frenarle cinco segundos.',
        avanzado: 'el atacante puede cambiar de banda dos veces y el defensor tiene que llegar antes al lado nuevo.',
      },
      criterio_exito: 'el defensor consigue que tres de cada cuatro subidas pasen de cinco segundos, sin falta',
    },
    tablero: () => [
      jug('A', 1, 0.3246, 0.8333), jug('B', 1, 0.3246, 0.7593),
      jug('A', 2, 0.6762, 0.8333), jug('B', 2, 0.6762, 0.7593),
      balon(0.3246, 0.8333), balon(0.6762, 0.8333),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2544, y: 0.6852 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2719, y: 0.6204 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.7465, y: 0.6852 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.729, y: 0.6204 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.1841, y: 0.5185 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2105, y: 0.4629 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.8168, y: 0.5185 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.7904, y: 0.4629 } },
        ] },
      ],
    },
  },
  {
    name: 'Defender la salida en bote',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El atacante recibe y sale botando por el lado que quiere: el defensor solo tiene que llegar antes con el pie.',
    objetivos: 'Ganar la primera salida, que es donde se decide la posesión: después ya solo queda perseguir.',
    descripcion_texto: 'Pasador en la punta, atacante en el 45 y defensor delante. Al pase, el defensor cierra la distancia y el atacante sale botando hacia un lado. La repetición dura solo hasta el segundo bote: se mira si el defensor tiene el pie por delante. Sin robar. Cuatro repeticiones y rotan los tres papeles.',
    notas: 'Puntos clave: al cerrar hacia el atacante se llega con pasos cortos y el cuerpo bajo, nunca corriendo de frente, o el primer bote se lo lleva; el pie del lado que quiere tapar sale primero. Error frecuente: llegar de pie y alto, que es como se come uno todos los primeros pasos. Segundo, del atacante: salir siempre por el mismo lado, con lo que el ejercicio deja de entrenar nada — dile que alterne sin avisar. Como entrenador, mira el PIE del defensor en el primer bote, no dónde acaba la jugada.',
    tags: ['defensa individual', 'defensa del bote', 'postura defensiva', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'cerrar la distancia en postura defensiva sin llegar de pie ni de frente',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, atacante y defensor cada cuatro repeticiones.',
      niveles: {
        base: 'el atacante anuncia el lado y el defensor practica el paso.',
        intermedio: 'el atacante elige y la repetición acaba en el segundo bote.',
        avanzado: 'el atacante puede fintar la salida una vez.',
      },
      criterio_exito: 'el defensor llega con el pie por delante en tres de cada cuatro salidas',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.07, M.escolta_izq[1] - 0.02),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2727, y: 0.3637 } },
        ] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.2532, y: 0.2766 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2239, y: 0.3028 } },
        ] },
      ],
    },
  },

  /* ═══ DEFENSA SIN BALÓN Y DEL CORTE ════════════════════════ */
  {
    name: 'Saltar al balón',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Cada vez que el balón cambia de manos, el defensor sin balón da un paso hacia él: si no se mueve el pase, no se mueve nadie.',
    objetivos: 'Instalar el ajuste que separa a un defensor que mira de uno que defiende: el balón se mueve, tú también.',
    descripcion_texto: 'Tres atacantes en la punta y los dos 45 se pasan el balón sin botar. Dos defensores: el del balón defiende normal, y el que no tiene balón cerca tiene que dar un paso hacia el balón en CADA pase, quedándose donde ve a su par y al balón a la vez. El entrenador grita "¡quieto!" en cualquier momento y todos se congelan: quien no pueda señalar con una mano a su par y con la otra al balón, punto en contra.',
    notas: 'Puntos clave: el cuerpo se abre hacia el balón y se retrasa un paso hacia el aro; se ve con la vista periférica, no girando la cabeza. IMPORTANTE: aquí NO se niega la línea de pase (D22). A esta edad negar, ayudar y recuperar son tres tareas a la vez y no salen; se quita la negación para que las otras dos se aprendan de verdad. Error frecuente: quedarse pegado al par y perder el balón de vista, o al revés. El congelado es lo que hace el trabajo: sin él nadie sabe si estaba bien colocado.',
    tags: ['defensa sin balón', 'defensa individual', 'postura defensiva', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'colocarse viendo a la vez a su par y al balón sin girar la cabeza',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: tres atacantes, dos defensores y uno que canta los congelados y va rotando.',
      niveles: {
        base: 'dos atacantes y un defensor sin balón, con pases lentos.',
        intermedio: 'tres atacantes, dos defensores y congelado aleatorio.',
        avanzado: 'los atacantes pueden cortar después de pasar, y el defensor tiene que ajustar y seguir viendo a los dos.',
      },
      criterio_exito: 'ningún congelado con el defensor sin balón fuera de sitio en toda la serie',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 3, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2727, y: 0.625 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A3', hacia: { x: 0.2629, y: 0.416 } },
        ] },
        { eventos: [
          { jugador: 'A2', tipo: 'pase', a: 'A1' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2922, y: 0.6076 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A3', hacia: { x: 0.2727, y: 0.4508 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A3' },
          { jugador: 'B2', tipo: 'defiende', marca: 'A3', hacia: { x: 0.2727, y: 0.3637 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2629, y: 0.5727 } },
        ] },
      ],
    },
  },
  {
    name: 'Perseguir el corte por detrás',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El atacante corta hacia el aro y el defensor le persigue por el lado del balón, sin dejarle recibir de cara.',
    objetivos: 'Defender el corte cuando ya te han ganado la espalda, que es lo que pasa casi siempre en un partido de mini.',
    descripcion_texto: 'Pasador en la punta, atacante en el 45 y defensor a su lado. El atacante corta hacia el aro por dentro; el defensor no puede cortarle el paso, tiene que perseguirle por el lado del balón con el brazo por delante para que la recepción no sea cómoda. El pasador la mete si el cortador está libre. Cuatro cortes y rotan.',
    notas: 'Puntos clave: se persigue por el lado del BALÓN, no por detrás del atacante, y el brazo de ese lado va por delante estirado, sin agarrar; los pies van a la carrera y solo se frena al final. Error frecuente: perseguir por el lado de fuera y llegar tarde a un balón que ya está dentro. Segundo: agarrar la camiseta, que es falta y además significa que ya se llegó tarde. Como entrenador vigila que no se convierta en negación: no se trata de impedir el corte, sino de que la recepción sea mala.',
    tags: ['defensa individual', 'defensa sin balón', 'desplazamiento defensivo', 'recuperación', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'correr y frenar en postura defensiva sin perder el equilibrio',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, cortador y defensor cada cuatro cortes.',
      niveles: {
        base: 'el corte va siempre por el mismo sitio y a ritmo medio.',
        intermedio: 'el cortador elige el momento y el defensor persigue por el lado del balón.',
        avanzado: 'el cortador puede fintar el corte y salir de nuevo fuera.',
      },
      criterio_exito: 'el cortador recibe cómodo como mucho una de cada cuatro veces, sin faltas',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.03, M.escolta_der[1] + 0.05),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.1751, y: 0.5553 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2141, y: 0.5031 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.1946, y: 0.5292 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Ayuda desde el fondo',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El de abajo sale a cortar la penetración y vuelve corriendo con su par: la ayuda no vale si no vuelve.',
    objetivos: 'Encadenar ayuda y recuperación en el sitio donde más se necesita, que es la penetración por el fondo.',
    descripcion_texto: 'Dos atacantes —uno en el 45 con balón y otro en la esquina contraria— y sus dos defensores. El del 45 penetra por el fondo; el defensor de la esquina tiene que salir a cortarle el camino y, en cuanto el atacante suelta el balón o para, volver corriendo con su par. Si el de la esquina anota porque su defensor no volvió, punto doble para el ataque. Tres posesiones y rotan.',
    notas: 'Puntos clave: la ayuda se hace ganando el sitio con el pecho, no saltando ni metiendo la mano; y la recuperación empieza ANTES de saber si hay pase, en cuanto el atacante ya no puede seguir. Error frecuente: ayudar y quedarse mirando el balón — que es la razón por la que D11 dice que toda ayuda lleva su recuperación. Segundo error: no ayudar por miedo a que la anoten. Cuenta las dos cosas por separado: ayudas hechas y recuperaciones a tiempo. Si solo cuentas canastas, dejan de ayudar.',
    tags: ['ayuda', 'recuperación', 'defensa individual', 'defensa sin balón', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'defender individualmente sin falta y ver a la vez al par y al balón',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos cuartetos por canasta que se turnan cada tres posesiones.',
      niveles: {
        base: 'la penetración es siempre por el fondo y el de la esquina solo practica salir y volver.',
        intermedio: 'penetración libre, ayuda y recuperación, con el pase a la esquina permitido.',
        avanzado: 'el atacante de la esquina puede desplazarse mientras se ayuda, y hay que recuperar donde esté.',
      },
      criterio_exito: 'las tres ayudas llegan a tiempo y en dos de las tres el defensor recupera antes del tiro',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, 0.1654, 0.2418),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, 0.1946, 0.294),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.1751, y: 0.6424 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2141, y: 0.6163 } },
        ] },
        // el de la esquina sale a cortar el camino
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.1458, y: 0.5727 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.1458, y: 0.4856 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.1848, y: 0.5901 } },
        ] },
        // y en cuanto el balón se suelta, vuelve con su par
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.1848, y: 0.2853 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ CIERRE DE REBOTE ═════════════════════════════════════
     El contenido que estaba a cero en este bloque. Estaba entero
     en el de rebote, y ahí es una técnica; aquí es un HÁBITO
     defensivo: al tiro, primero el par y después el balón. */
  {
    name: 'Cierre de rebote a la voz',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Se defiende normal hasta que alguien grita «¡tiro!»: entonces cada defensor tiene que estar tocando a su par en un segundo.',
    objetivos: 'Instalar el cierre de rebote como reflejo y no como una idea: el gesto tiene que salir antes de pensar dónde cae el balón.',
    descripcion_texto: 'Tres parejas repartidas por el perímetro, defendiendo sin balón. El entrenador grita «¡tiro!» en cualquier momento y a partir de ahí hay un segundo para que cada defensor gire, encuentre a su par y haga contacto de espalda con él. El entrenador cuenta en voz alta hasta uno y mira: quien no esté tocando a su par, punto en contra para su lado. Ocho señales y se cambian los papeles.',
    notas: 'Puntos clave: el giro se hace con el pie más cercano al atacante y de espaldas a él, buscándole con el trasero y los antebrazos flexionados; primero se encuentra al par y DESPUÉS el balón, aunque el balón venga hacia ti — es contraintuitivo y hay que repetirlo mil veces. Error frecuentísimo: girarse hacia el aro y perder al par, que es exactamente lo que hace todo el mundo la primera semana. Aquí no hay balón a propósito: el balón distrae del gesto y para eso ya están las fichas de rebote.',
    tags: ['bloqueo de rebote', 'rebote defensivo', 'defensa individual', 'defensa sin balón'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: [], densidad: 'alta', oposicion: 'pasiva', presion: 'tiempo',
      requisito_previo: 'hacer contacto de espalda con el cuerpo sin empujar con las manos',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por canasta. El entrenador canta desde el centro para que le oigan los dos grupos.',
      niveles: {
        base: 'los atacantes están quietos y solo se practica el giro y el contacto.',
        intermedio: 'los atacantes se mueven por el perímetro y hay un segundo para cerrar.',
        avanzado: 'los atacantes salen corriendo al aro en cuanto oyen la voz y hay que encontrarles igual.',
      },
      criterio_exito: 'siete de cada ocho señales con contacto antes de la cuenta de uno',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('A', 3, M.base[0], M.base[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      jug('B', 3, M.base[0] - 0.05, M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // suena la voz: cada defensor gira y busca a su par, que
        // intenta escaparse hacia el aro
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.2629, y: 0.6947 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2824, y: 0.6598 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2629, y: 0.3114 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2824, y: 0.3463 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.2824, y: 0.5031 } },
          { jugador: 'B3', tipo: 'defiende', marca: 'A3', hacia: { x: 0.302, y: 0.5031 } },
        ] },
      ],
    },
  },
  {
    name: 'Cierra, coge y saca',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Cierre de rebote, rebote y primer pase de salida: las tres cosas seguidas, que es como pasan de verdad.',
    objetivos: 'Encadenar el cierre con lo que viene después, porque un rebote que no sale del área no ha terminado el trabajo.',
    descripcion_texto: 'Dos parejas junto al aro y un pasador en la banda. El entrenador tira; los defensores cierran a su par, cogen el rebote y buscan al pasador de la banda con un pase por encima. El ataque puede pelear el rebote e intentar cortar ese primer pase. Punto para la defensa solo si el balón llega a la banda. Cuatro repeticiones y se cambian los papeles.',
    notas: 'Puntos clave: se coge con las dos manos y arriba, se cae con las piernas abiertas y el balón a la altura de la barbilla con los codos firmes, y solo entonces se busca la banda; el pase de salida va por encima, nunca picado entre gente. Error frecuentísimo: bajar el balón a la cintura al caer, que es donde llegan todas las manos. Segundo: botar antes de mirar. Como entrenador, la métrica no es el rebote: es cuántas veces el balón llega a la banda, que es el trabajo entero.',
    tags: ['bloqueo de rebote', 'rebote defensivo', 'pase', 'transición', 'oposición'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'coger el rebote con las dos manos en el aire y caer equilibrado',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: dos parejas peleando el rebote, un pasador en la banda y uno que espera para entrar en la repetición siguiente.',
      niveles: {
        base: 'sin ataque: solo cierre, rebote y pase a la banda.',
        intermedio: 'dos parejas peleando y el ataque puede intentar cortar el pase.',
        avanzado: 'el ataque puede además pelear el rebote ofensivo con las dos manos y el pase tiene que salir en menos de dos segundos.',
      },
      criterio_exito: 'el balón llega a la banda en tres de cada cuatro rebotes defensivos',
    },
    tablero: () => [
      jug('A', 1, M.poste_bajo_der[0] + 0.06, M.poste_bajo_der[1]),
      jug('A', 2, M.poste_bajo_izq[0] + 0.06, M.poste_bajo_izq[1]),
      jug('A', 3, 0.3508, 0.8166),
      jug('B', 1, M.poste_bajo_der[0] + 0.02, M.poste_bajo_der[1]),
      jug('B', 2, M.poste_bajo_izq[0] + 0.02, M.poste_bajo_izq[1]),
      balon(0.1702, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el tiro del entrenador ya está en el aire: primero el par
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.1946, y: 0.5988 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.1946, y: 0.4072 } },
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.2239, y: 0.6598 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2239, y: 0.3463 } },
        ] },
        { eventos: [{ jugador: 'B1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'B1', tipo: 'pase', a: 'A3' }] },
      ],
    },
  },

  /* ═══ DEFENSA EN JUEGO REDUCIDO ════════════════════════════ */
  {
    name: '3c3 sin robar',
    type: '3vs3', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 15,
    description: 'Tres contra tres donde la defensa no puede robar ni interceptar: solo puede defender con los pies y el cuerpo.',
    objetivos: 'Quitar el atajo del robo para que aparezca lo que hay debajo: posición, distancia y trabajo de pies.',
    descripcion_texto: 'Tres contra tres en media pista con una sola regla añadida: la defensa no puede tocar el balón. Ni robar, ni interceptar, ni taponar. Solo se defiende con la posición del cuerpo, y la posesión termina cuando el ataque tira o pierde el balón solo. Se juega a cinco canastas y después se levanta la prohibición y se juega otra a cinco para comparar.',
    notas: 'Puntos clave: sin la opción de robar, el defensor descubre que el sitio se gana antes; y el equipo descubre que las ayudas hay que hablarlas. Error del entrenador: saltarse la segunda partida, la de después de levantar la prohibición. Ahí es donde se ve el efecto y donde los niños lo notan. Aviso: las tres primeras veces la defensa lo pasa mal y encajan muchas canastas. Es normal y hay que decírselo antes de empezar, o se frustran y vuelven a meter la mano.',
    tags: ['juego reducido', 'defensa individual', 'ayuda', 'recuperación', 'competición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'defender individualmente sin falta y ver al par y al balón a la vez',
      dosis: { series: 2, cantidad: 5, unidad: 'repeticiones', descanso: 120 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, jugando 3c3. Nadie fuera; se cambian los tríos entre las dos partidas.',
      niveles: {
        base: '2c2 sin robar y con el ataque limitado a dos botes.',
        intermedio: '3c3 sin robar, a cinco canastas.',
        avanzado: '3c3 sin robar y sin poder cambiar de par: cada uno defiende al suyo pase lo que pase.',
      },
      criterio_exito: 'la segunda partida, ya con robo permitido, se gana con menos faltas que de costumbre',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 3, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 3, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.base[0], M.base[1]),
    ],
    // Juego abierto: se resuelve de mil maneras y animar una sería
    // enseñar una jugada cerrada donde tiene que haber lectura.
    intent: null,
  },
  {
    name: 'Dos posesiones defendiendo',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Competición donde solo puntúa la defensa: dos paradas seguidas y sales; una canasta encajada y vuelves a empezar.',
    objetivos: 'Poner el marcador del lado defensivo, que es la única forma de que un niño celebre una parada como celebra una canasta.',
    descripcion_texto: 'Dos contra dos en media pista. La pareja que defiende tiene que conseguir DOS paradas seguidas para salir y pasar a atacar; si encajan una canasta, la cuenta vuelve a cero. El ataque cambia cada posesión, así que a la defensa le entran parejas frescas. Ninguna pareja aguanta defendiendo más de dos minutos: si no lo consiguen, sale igualmente y entra otra.',
    notas: 'Puntos clave: dos paradas seguidas obligan a sostener la concentración cuando ya se ha hecho el trabajo una vez, que es exactamente lo que falla en un partido. Error del entrenador: dejar que una pareja se hunda defendiendo cinco minutos. El tope de dos minutos no es negociable. Y celebra las paradas en voz alta: si solo celebras las canastas, el mensaje de todo el ejercicio se cae. Ojo con la carga, que defender dos minutos seguidos en 2c2 es de lo más exigente que hay.',
    tags: ['defensa individual', 'juego reducido', 'competición', 'ayuda', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'defender individualmente y ayudar a un compañero recuperando después',
      dosis: { series: 3, cantidad: 120, unidad: 'segundos', descanso: 120 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas: una defiende y las otras dos atacan alternándose. Se rota en cuanto la defensa consigue dos paradas o pasan dos minutos.',
      niveles: {
        base: 'una sola parada para salir y el ataque tiene dos botes de máximo.',
        intermedio: 'dos paradas seguidas, ataque libre.',
        avanzado: 'dos paradas seguidas y el rebote defensivo tiene que ser de la defensa para que cuente como parada.',
      },
      criterio_exito: 'todas las parejas consiguen salir al menos una vez en la sesión',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: null,
  },
  {
    name: 'Cantar la ayuda',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Dos contra dos donde la defensa está obligada a hablar: quien ayuda lo dice, y quien recibe la ayuda contesta.',
    objetivos: 'Meter la voz en la defensa desde el principio, porque una ayuda callada llega tarde aunque salga a tiempo.',
    descripcion_texto: 'Dos contra dos en media pista con una regla: cada vez que un defensor sale a ayudar tiene que gritar «¡ayuda!» y su compañero contestar «¡voy!» mientras recupera. Si una ayuda se hace en silencio, la posesión se anula aunque la defensa la haya hecho bien. Se juega a cuatro posesiones y se cambian los papeles.',
    notas: 'Puntos clave: la voz sale ANTES del movimiento, no durante; y contestar no es cortesía, es lo que le dice al que ayuda que ya puede quedarse. Error frecuente y muy típico de esta edad: hablar bajito o hablar cuando ya ha pasado todo. Lo que funciona es exagerar: que se oiga desde la otra canasta. Anular la posesión aunque la defensa esté bien hecha parece injusto y por eso funciona; en dos sesiones el equipo entero habla sin que nadie lo pida.',
    tags: ['ayuda', 'recuperación', 'defensa individual', 'juego reducido', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'ayudar a un compañero y recuperar con su par sin quedarse mirando el balón',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por canasta que rotan ataque y defensa cada cuatro posesiones.',
      niveles: {
        base: 'basta con que el que ayuda diga su palabra; el compañero no tiene que contestar.',
        intermedio: 'los dos hablan y la posesión se anula si hay silencio.',
        avanzado: 'además hay que cantar el lado («¡ayuda izquierda!») y el compañero recupera por ese lado.',
      },
      criterio_exito: 'las cuatro posesiones con la ayuda cantada y contestada, sin que el entrenador tenga que recordarlo',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, 0.1848, 0.2766),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, 0.2141, 0.3289),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2141, y: 0.5901 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2434, y: 0.5727 } },
        ] },
        // «¡ayuda!» — sale el de abajo
        { eventos: [
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.1751, y: 0.5031 } },
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
        ] },
        // «¡voy!» — y vuelve con el suyo
        { eventos: [
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2044, y: 0.3201 } },
          { jugador: 'A2', tipo: 'tiro' },
        ] },
      ],
    },
  },
];
