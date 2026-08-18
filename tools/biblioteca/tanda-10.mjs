/* ============================================================
   tanda-10.mjs — 1c1 (Bloque D).

   El formato de más densidad técnica y más carga (D6), y el requisito
   previo del juego de dos (D23): hasta que el uno contra uno no está
   resuelto, un bloqueo solo sirve para juntar a dos que no saben qué
   hacer con la ventaja.

   Esta tanda cierra el hueco que el linter marcaba a cero —el 1c1
   DEFENSIVO, que en la biblioteca no existía: había nueve fichas de
   uno contra uno y en las nueve el protagonista era el atacante— y
   completa el 1c1 SIN BALÓN, que es el que decide si el balón llega.

   Doctrina que más aprieta aquí:
     D19 · la oposición sube en cuatro escalones
     D22 · en el núcleo mini NO se niega la línea de pase: el defensor
           aprende a contener, ayudar y recuperar, que ya son tres
     D23 · el 1c1 resuelto es lo que abre el juego de dos
     D4  · con parejas rotando, vigilar que nadie mire más de lo que juega
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_10 = [

  /* ═══ 1c1 DEFENSIVO ════════════════════════════════════════
     El contenido que estaba a cero. Son fichas donde el que gana
     el ejercicio es el defensor, y eso cambia lo que se corrige,
     lo que se cuenta y lo que se celebra. */
  {
    name: 'Defender el primer paso',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Uno contra uno defensivo que termina en cuanto el atacante da el primer bote: se puntúa solo si el defensor ha ganado el sitio.',
    objetivos: 'Aislar el instante que decide el uno contra uno defensivo: el paso que el defensor da antes de que el atacante salga.',
    descripcion_texto: 'Atacante en el 45 con balón y defensor delante. El atacante ataca de verdad, pero la repetición TERMINA en cuanto da el primer bote: se congela ahí y se mira si el defensor tiene el pie y el cuerpo por delante del camino elegido. Punto para el defensor si lo ha ganado, punto para el atacante si no. Cuatro cada uno y rotan.',
    notas: 'Puntos clave: el primer paso defensivo es un empuje corto y bajo con el pie de ese lado, nunca un salto ni un cruce; el peso ya tiene que estar repartido antes de que el atacante se mueva. Errores frecuentes: dar un paso atrás por miedo, que regala el metro que hacía falta; y adivinar el lado antes de tiempo. Como entrenador, congela de verdad: el valor del ejercicio está en que los dos VEAN quién tenía el sitio. Si dejas que siga la jugada, en tres repeticiones vuelve a ser un uno contra uno normal.',
    tags: ['1c1', 'defensa individual', 'postura defensiva', 'desplazamiento defensivo', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'mantener la postura defensiva y desplazarse lateralmente sin cruzar los pies',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas repartidas por el perímetro. Rotan atacante y defensor cada cuatro repeticiones.',
      niveles: {
        base: 'el atacante anuncia el lado antes de salir y el defensor solo practica el paso.',
        intermedio: 'el atacante elige y la repetición se congela en el primer bote.',
        avanzado: 'el atacante puede fintar una vez antes de salir.',
      },
      criterio_exito: 'el defensor gana el sitio en tres de cada cuatro salidas',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1] - 0.01),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el atacante elige lado y da UN bote; ahí se congela
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.332, y: 0.6976 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2979, y: 0.6887 } },
        ] },
      ],
    },
  },
  {
    name: 'Mandar hacia la banda',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Defender con el cuerpo ladeado para que el atacante solo pueda ir hacia fuera: la banda es un defensor más.',
    objetivos: 'Que el defensor deje de defender en el centro y empiece a decidir por dónde quiere que pase el atacante.',
    descripcion_texto: 'Atacante en el 45 y defensor con un pie adelantado tapando la línea de fondo. El atacante ataca libre; si va hacia el centro, el defensor ha fallado. La repetición vale para el defensor si consigue que el ataque termine en la banda o en la esquina, sin robar y sin falta. Tres posesiones cada uno.',
    notas: 'Puntos clave: se orienta con el CUERPO, no con las manos: pie de fondo adelantado, hombro cerrando ese lado y el otro invitando; y se acompaña, no se corta el paso. Error frecuente: adelantar tanto el pie que el atacante se va por detrás en un cambio; y meter la mano, que a esta edad es falta segura. Esto es de lo poco de defensa que sí conviene enseñar pronto, porque no exige entender ayudas: solo entender que hay un lado bueno y uno malo (D22 nos deja las manos libres al quitar la negación).',
    tags: ['1c1', 'defensa individual', 'defensa del bote', 'postura defensiva', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'desplazarse lateralmente en postura defensiva sin juntar los pies',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas por los dos 45 y la punta. Rotan atacante y defensor cada tres posesiones.',
      niveles: {
        base: 'el atacante solo puede ir en línea recta y el defensor practica la orientación.',
        intermedio: 'el atacante ataca libre y el defensor le manda a la banda.',
        avanzado: 'el entrenador canta el lado al que hay que mandarle justo antes de empezar.',
      },
      criterio_exito: 'el ataque termina en banda o esquina en dos de cada tres posesiones, sin falta',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.05, M.escolta_izq[1] + 0.02),
      balon(M.escolta_izq[0], M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el defensor tapa el fondo y el bote sale hacia fuera
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3548, y: 0.2556 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3093, y: 0.2909 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2865, y: 0.1848 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2523, y: 0.2379 } },
        ] },
      ],
    },
  },
  {
    name: 'Aguantar tres botes',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 5, duration_max: 8,
    description: 'El atacante tiene tres botes para llegar y el defensor solo tiene que aguantar: gana el que dure.',
    objetivos: 'Entrenar la contención defensiva pura, sin manos y sin robar, que es el 90 % del trabajo defensivo real en mini.',
    descripcion_texto: 'Atacante en la punta con balón, defensor delante. El atacante tiene tres botes para llegar a la zona; el defensor no puede robar ni meter la mano, solo mover los pies y aguantar el cuerpo por delante. Si el atacante entra en la zona antes del tercer bote, punto para él; si no, para el defensor. Cinco repeticiones y se cambia.',
    notas: 'Puntos clave: los pies se mueven en pasos cortos y el pecho se mantiene por delante del balón; las manos van abajo y abiertas, no buscando. Error frecuentísimo a esta edad: ir a robar en cuanto se ve el balón, perder el sitio y comer una falta. Prohibir robar es lo que hace el ejercicio: durante tres o cuatro sesiones se defiende mucho peor y después se defiende mucho mejor. Vigila también la respiración: cinco repeticiones seguidas de esto cansan más que un sprint, así que no encadenes series.',
    tags: ['1c1', 'defensa individual', 'defensa del bote', 'desplazamiento defensivo', 'competición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'mantenerse en postura defensiva y desplazarse sin cruzar los pies durante veinte segundos',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por grupo que se turnan; mientras dos parejas juegan, la tercera cuenta los botes en voz alta.',
      niveles: {
        base: 'cuatro botes y el defensor solo tiene que quedarse delante.',
        intermedio: 'tres botes y contención sin manos.',
        avanzado: 'tres botes, y el defensor puede robar solo cuando el atacante recoge el balón.',
      },
      criterio_exito: 'el defensor aguanta tres de cada cinco repeticiones sin falta y sin meter la mano',
    },
    tablero: () => [
      jug('A', 1, M.base[0] + 0.06, M.base[1]),
      jug('B', 1, M.base[0], M.base[1] + 0.01),
      balon(M.base[0] + 0.06, M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.4004, y: 0.5915 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3662, y: 0.5738 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3548, y: 0.4147 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3206, y: 0.4324 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3093, y: 0.5473 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2751, y: 0.5296 } },
        ] },
      ],
    },
  },

  /* ═══ 1c1 SIN BALÓN ════════════════════════════════════════ */
  {
    name: 'Corte al lado contrario',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Salir hacia un lado para que el defensor se vaya, y cortar por el otro a recibir bajo el aro.',
    objetivos: 'Aprender que el hueco no se busca: se fabrica yendo primero al sitio donde NO se quiere ir.',
    descripcion_texto: 'Pasador en la punta con balón, atacante en el 45 sin balón y defensor a su lado. El atacante da dos o tres pasos decididos hacia fuera y, cuando el defensor le sigue, cambia de dirección y corta hacia el aro pidiendo con la mano. El pasador se la da si el corte gana ventaja; si no, no. Cuatro cortes y rotan los tres papeles.',
    notas: 'Puntos clave: los primeros pasos tienen que ser de verdad —si no se cree el defensor, no se cree nadie—, el cambio se hace pisando fuerte con el pie de fuera, y la mano se pide en el lado contrario al defensor. Error frecuente: cortar sin haber vendido nada antes, que es correr hacia el aro para nada. Otro, del pasador: dársela igual aunque no haya ventaja, con lo que el atacante nunca aprende si su corte funcionó. La regla del pase condicionado es la mitad del ejercicio.',
    tags: ['1c1', 'corte', 'desmarque', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'cambiar de dirección al correr sin frenar del todo',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, cortador y defensor. Rotan los tres papeles cada cuatro cortes.',
      niveles: {
        base: 'el defensor sigue el primer movimiento siempre y el corte es libre.',
        intermedio: 'el defensor decide si se lo cree y el pase solo llega si hay ventaja.',
        avanzado: 'el defensor puede quedarse en el camino del corte y el atacante tiene que leerlo y volver a salir fuera.',
      },
      criterio_exito: 'tres de cada cuatro cortes reciben el balón con ventaja clara sobre el defensor',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.04, M.escolta_der[1] + 0.03),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // primero se vende la salida hacia fuera
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.4231, y: 0.733 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.389, y: 0.7153 } },
        ] },
        // y se corta por dentro, que es donde ya no está
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2182, y: 0.5738 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.3206, y: 0.6622 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Sellar y pedirla',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Ganar el sitio en el poste bajo con el cuerpo y aguantarlo tres segundos pidiendo el balón con la mano de fuera.',
    objetivos: 'Recibir cerca del aro peleando la posición, que es la forma más rentable de conseguir puntos fáciles a esta edad.',
    descripcion_texto: 'Pasador en el 45 y dos jugadores en el poste bajo, uno atacando y otro defendiendo por detrás. El atacante busca el contacto con la espalda y el antebrazo, gana medio cuerpo y mantiene la posición pidiendo con la mano de fuera. El pasador solo se la da si la mano está clara. Al recibir, se termina con un giro y tiro. Tres posesiones y rotan.',
    notas: 'Puntos clave: se sella con el antebrazo y el trasero, con las piernas anchas y bajas, no empujando con las manos; la mano de fuera es la que dice al pasador que la posición está ganada. Error frecuente: pedir con la mano del lado del defensor, que convierte el pase en un regalo. Ojo con el reglamento y con el cuerpo: nada de meter el brazo por detrás para enganchar. A esta edad el poste bajo no es cosa de altos: es del que sabe usar el cuerpo, y conviene que pasen todos.',
    tags: ['1c1', 'desmarque', 'recepción', 'pivote', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'sostener la posición con el cuerpo sin empujar con las manos y pivotar sin levantar el pie de apoyo',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, poste y defensor. Se cambia de lado del aro en cada serie.',
      niveles: {
        base: 'el defensor solo acompaña y el atacante practica sellar y pedir.',
        intermedio: 'el defensor pelea la posición y hay tres segundos para recibir.',
        avanzado: 'el defensor puede cambiarse de lado mientras el pasador busca el ángulo.',
      },
      criterio_exito: 'ganar y mantener el sitio con la mano de fuera clara en dos de cada tres posesiones',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.poste_bajo_der[0] + 0.04, M.poste_bajo_der[1]),
      jug('B', 1, M.poste_bajo_der[0] + 0.09, M.poste_bajo_der[1] - 0.01),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // se gana medio cuerpo: el atacante se mete y el defensor queda detrás
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.1897, y: 0.618 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2523, y: 0.6092 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'tiro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2295, y: 0.5915 } },
        ] },
      ],
    },
  },

  /* ═══ 1c1 CON BALÓN: RESTRICCIONES Y CONTEXTOS ═════════════ */
  {
    name: 'Un solo bote',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Uno contra uno desde el 45 con un bote de máximo: o el primer paso gana, o no hay jugada.',
    objetivos: 'Concentrar todo el uno contra uno en la salida, que es donde se gana de verdad y donde menos se insiste.',
    descripcion_texto: 'Atacante en el 45 con balón y defensor delante. Solo se puede dar UN bote: se puede fintar, pivotar y salir, pero al segundo bote la posesión se pierde. Se puede terminar tirando desde donde se llegue. Tres posesiones cada uno y se cambia de pareja.',
    notas: 'Puntos clave: con un solo bote el primer paso tiene que ir largo y hacia el aro, no de lado; y el balón sale antes que el pie de pivote, o son pasos. Error frecuente: gastar el bote en un movimiento lateral que no gana nada y quedarse sin recursos. Este es el ejercicio que mejor enseña que el bote no es para pensar: es para ir a algún sitio. Si ves que salen tirando de lejos porque no llegan, baja la salida al codo y vuelve a probar.',
    tags: ['1c1', 'salida en bote', 'ventaja', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'salir en bote con un primer paso largo sin arrastrar el pie de pivote',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por grupo repartidas por el perímetro. Se cambia de pareja en cada serie.',
      niveles: {
        base: 'dos botes y el defensor solo contiene.',
        intermedio: 'un bote y defensa real.',
        avanzado: 'un bote y el defensor puede empezar tocando al atacante, que tiene que crear el espacio antes de salir.',
      },
      criterio_exito: 'llegar a tiro cómodo en dos de cada tres posesiones sin gastar el bote de lado',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0] + 0.02, M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.04, M.escolta_der[1]),
      balon(M.escolta_der[0] + 0.02, M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2751, y: 0.5915 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'El defensor sale antes',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Uno contra uno en el que el defensor arranca con ventaja: el atacante llega en desventaja y tiene que resolverlo igual.',
    objetivos: 'Atacar cuando ya no hay ventaja, que es la situación más frecuente del partido y la que menos se entrena.',
    descripcion_texto: 'Atacante y defensor tumbados en el fondo. El entrenador lanza el balón hacia la zona; el defensor puede levantarse al primer bote del balón y el atacante al segundo. El atacante coge el balón y ataca la canasta con el defensor ya colocado. Una posesión, se cambian los papeles y otra.',
    notas: 'Puntos clave: en desventaja no vale atacar de frente; hay que usar la finta y el cambio de ritmo para volver a crear el hueco, y aceptar terminar lejos del aro si es lo que hay. Error frecuente: intentar irse de velocidad contra un defensor ya colocado y estrellarse. Como entrenador, valora la DECISIÓN: un pase a nadie no existe aquí, así que lo que hay que ver es si sabe fabricarse otra ventaja o si se limita a lanzar. Ojo con el suelo: si está resbaladizo, se empieza sentados y no tumbados.',
    tags: ['1c1', 'ventaja', 'finta', 'cambio de ritmo', 'competición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'resolver el uno contra uno con bote desde una posición de igualdad',
      dosis: { series: 3, cantidad: 2, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por grupo que se turnan; el entrenador o el que descansa lanza el balón.',
      niveles: {
        base: 'los dos salen a la vez y el atacante coge el balón primero.',
        intermedio: 'el defensor sale un bote antes.',
        avanzado: 'el defensor sale dos botes antes y el atacante tiene cinco segundos.',
      },
      criterio_exito: 'el atacante se fabrica una segunda ventaja en la mitad de las posesiones, entre o no entre',
    },
    tablero: () => [
      jug('A', 1, 0.2182, 0.3263), jug('B', 1, 0.2182, 0.4147),
      balon(0.3093, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el defensor ya está colocado cuando el atacante llega al balón
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.2751, y: 0.4766 } },
          { jugador: 'A1', tipo: 'recoge' },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.4004, y: 0.6092 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3548, y: 0.5827 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2409, y: 0.5738 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: '1c1 desde el fondo',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Atacar desde la línea de fondo hacia fuera y volver: sin espacio detrás, todo se resuelve con el cuerpo y el primer paso.',
    objetivos: 'Jugar el uno contra uno en el rincón más incómodo de la pista, donde la banda y el fondo ya hacen de defensores.',
    descripcion_texto: 'Atacante en la esquina con balón, de cara al aro, y defensor delante. Solo se puede atacar hacia dentro o hacia la banda, nunca salir por el fondo. Tres botes de máximo. Punto para el defensor si consigue que el ataque termine en la esquina o pierda el balón. Tres posesiones cada uno.',
    notas: 'Puntos clave: en la esquina no hay sitio para el rodeo, así que el primer paso tiene que ser recto y protegido; el bote va bajo porque las manos rivales están cerca. Error frecuente: botar hacia el fondo buscando un hueco que no existe y salirse. Este ejercicio enseña algo que no se dice bastante: hay zonas de la pista donde lo correcto es no atacar y devolver el balón. Si un niño lo entiende aquí, ha ganado más que con tres canastas.',
    tags: ['1c1', 'bote de protección', 'toma de decisiones', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'espacio',
      requisito_previo: 'botar protegiendo con el cuerpo en espacio reducido',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, trabajando en las dos esquinas a la vez: tres parejas por canasta que rotan.',
      niveles: {
        base: 'desde el 45 en vez de la esquina, con tres botes.',
        intermedio: 'desde la esquina, tres botes, sin salir por el fondo.',
        avanzado: 'desde la esquina, dos botes, y el defensor puede tocar el balón.',
      },
      criterio_exito: 'salir de la esquina con ventaja o devolver el balón a tiempo en dos de cada tres posesiones',
    },
    tablero: () => [
      jug('A', 1, 0.2068, 0.786), jug('B', 1, 0.2751, 0.7595),
      balon(0.2068, 0.786),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2865, y: 0.6622 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.332, y: 0.6799 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2409, y: 0.6092 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: '1c1 tras rebote',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'El entrenador tira, los dos van al rebote, y quien lo coge ataca inmediatamente al que lo ha perdido.',
    objetivos: 'Encadenar rebote y ataque sin pausa, que es como aparece el uno contra uno en el juego de verdad.',
    descripcion_texto: 'Dos jugadores junto al aro y el entrenador tira desde el 45. Los dos pelean el rebote; quien lo coge sale botando hasta el cono del medio campo, gira y ataca la canasta. El otro pasa a defender inmediatamente. Se juega una posesión y entra la siguiente pareja. Se llevan los puntos por parejas.',
    notas: 'Puntos clave: el que coge el rebote tiene que proteger el balón ANTES de mirar a dónde va, y salir a la primera; el que lo pierde no puede quedarse quejándose, que es donde se pierden la mitad de las canastas fáciles. Error frecuente del entrenador: tirar siempre desde el mismo sitio, con lo que el rebote cae siempre igual y deja de haber pelea. Varía el punto de tiro. Ojo con la carga: rebote más carrera más 1c1 son quince segundos muy exigentes, así que no metas más de tres seguidos.',
    tags: ['1c1', 'rebote defensivo', 'transición', 'competición', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'coger el rebote con las dos manos y salir botando protegiendo el balón',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en parejas que entran de dos en dos. Mientras una pareja juega, la siguiente ya está en el fondo lista para entrar.',
      niveles: {
        base: 'el balón se entrega a uno y el otro defiende, sin pelea de rebote.',
        intermedio: 'rebote disputado y ataque hasta el cono y vuelta.',
        avanzado: 'rebote disputado, y el que ataca tiene cinco segundos desde que coge el balón.',
      },
      criterio_exito: 'el que coge el rebote sale botando a la primera en tres de cada tres, sin que le roben en la salida',
    },
    tablero: () => [
      jug('A', 1, 0.2068, 0.4501), jug('B', 1, 0.2068, 0.5561),
      cono(0.7648, 0.5031),
      balon(0.2637, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el rebote cae y lo coge A1: sale botando antes de que el otro reaccione
        { eventos: [
          { jugador: 'A1', tipo: 'recoge' },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.2979, y: 0.5561 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.7192, y: 0.5031 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.6281, y: 0.5296 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2637, y: 0.5208 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Duelo a tres posesiones',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 8, duration_max: 15,
    description: 'Liguilla de uno contra uno a tres posesiones por duelo, con marcador acumulado y cambio de rival cada ronda.',
    objetivos: 'Competir en uno contra uno contra rivales distintos, que es lo que obliga a tener más de un recurso.',
    descripcion_texto: 'Todos emparejados por canasta. Cada duelo son tres posesiones para cada uno, empezando desde el 45. Se anotan los puntos y se cambia de rival: cada ronda te toca uno distinto, así que el que solo sabe irse por la derecha se queda sin puntos en cuanto le toca alguien que se lo ha visto. Se lleva la cuenta acumulada de toda la sesión.',
    notas: 'Puntos clave: contra un rival nuevo la primera posesión es de información, no de resultado; conviene enseñar a probar un lado y quedarse con el que funciona. Error del entrenador: emparejar siempre por nivel. Aquí interesa mezclar, porque el que va sobrado con uno tiene que buscar recursos con otro. Y corta los duelos cortos: tres posesiones y cambio mantiene el ritmo y evita que nadie se hunda.',
    tags: ['1c1', 'competición', 'toma de decisiones', 'ventaja', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'resolver el uno contra uno con bote y defender individualmente sin falta',
      dosis: { series: 4, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por canasta jugando en el 45 derecho, el izquierdo y la punta. Rotan los rivales cada duelo.',
      niveles: {
        base: 'tres botes de máximo y sin cambio de rival.',
        intermedio: 'libre, tres posesiones y cambio de rival cada duelo.',
        avanzado: 'tres posesiones, cambio de rival, y la canasta con la mano no dominante vale doble.',
      },
      criterio_exito: 'anotar contra al menos tres rivales distintos a lo largo de la liguilla',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.escolta_izq[0], M.escolta_izq[1]), balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    // Duelo abierto: cada pareja resuelve a su manera y animar un
    // desenlace sería enseñar una jugada donde tiene que haber lectura.
    intent: null,
  },
  {
    name: 'Recibir de cara en el poste bajo',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Recibir junto al aro ya de cara y resolver en un bote: la canasta más rentable del minibasket y la que menos se practica.',
    objetivos: 'Convertir la recepción cerca del aro en puntos, que a esta edad vale más que cualquier tiro exterior.',
    descripcion_texto: 'Pasador en el 45, atacante en el poste bajo del lado contrario y defensor delante de él, no detrás. El atacante se abre para recibir DE CARA al aro y desde ahí resuelve con un bote como máximo. El defensor defiende de verdad. Tres posesiones y rotan los tres papeles.',
    notas: 'Puntos clave: al recibir de cara ya se está mirando el aro, así que se decide antes de botar; con un bote de máximo, el pie que sale es el que apunta al hueco. Errores frecuentes: recibir y bajar el balón a la cintura, donde llegan todas las manos; y botar hacia el fondo sin salida. Como entrenador insiste en el primer gesto tras recibir: balón arriba, ojos al aro. La mitad de las pérdidas de esta zona pasan en el medio segundo posterior a la recepción.',
    tags: ['1c1', 'recepción', 'finalización', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'recibir con las dos manos y salir en bote hacia cualquiera de los dos lados',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, atacante y defensor. Se cambia de lado del aro cada serie.',
      niveles: {
        base: 'sin defensor: recepción de cara y finalización libre.',
        intermedio: 'defensor delante y un bote de máximo.',
        avanzado: 'defensor delante, un bote, y una ayuda que llega desde el lado contrario tras el primer bote.',
      },
      criterio_exito: 'terminar cerca del aro en dos de cada tres posesiones sin bajar el balón al recibir',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.poste_bajo_izq[0] + 0.05, M.poste_bajo_izq[1]),
      jug('B', 1, M.poste_bajo_izq[0] + 0.01, M.poste_bajo_izq[1] - 0.02),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2409, y: 0.3616 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.1954, y: 0.3705 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.184, y: 0.4324 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
];
