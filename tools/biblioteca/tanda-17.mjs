/* marco: 3 */
/* ============================================================
   tanda-17.mjs — manejo y juego de pies (Bloque D).

   Los dos bloques donde más fácil se cuela el ejercicio de circo. D20
   es tajante con el manejo: el criterio que separa uno bueno de uno
   inútil es si el jugador tiene ALGO QUE MIRAR que no sea el balón.
   Nada de dos balones sin contexto, pelotas de tenis ni gafas: eso
   entrena a botar una pelota de tenis.

   Esta tanda cierra los dos contenidos de manejo que el linter
   marcaba a cero —familiarización y contacto con el balón, y los
   desplazamientos con balón— y completa el juego de pies, donde
   faltaban la parada en dos tiempos, el pivote de protección y la
   finta de salida.

   Doctrina que más aprieta aquí:
     D20 · entrenar baloncesto, no bote aislado
     D21 · dos manos → dominante → ambas; la mirada se despega por
           juego, nunca por orden verbal
     D5  · con doce niños, todo esto va simultáneo: aquí no hay colas
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_17 = [

  /* ═══ MANEJO ═══════════════════════════════════════════════ */
  {
    name: 'Familiarización: manos rápidas y balón que vuelve',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 2, duration_min: 4, duration_max: 6,
    description: 'Contacto con el balón por parejas: se suelta, se toca el suelo y se recoge antes de que bote dos veces, con el compañero cantando cuántas palmadas.',
    objetivos: 'Ganar sensibilidad y velocidad de manos con el balón, que es el primer escalón de todo, sin caer en el manejo que no mira a nada.',
    descripcion_texto: 'Por parejas enfrentadas a tres metros. Uno sostiene el balón con los brazos estirados, lo suelta, da una palmada, toca el suelo y lo recoge antes del segundo bote. El compañero de enfrente levanta dedos mientras cae el balón y hay que decir cuántos al recogerlo. Diez repeticiones y se cambia. Después, lo mismo pasándolo alrededor de la cintura y de las rodillas sin mirarlo.',
    notas: 'Puntos clave: el balón se recoge con las YEMAS y las dos manos, nunca atrapándolo contra el cuerpo; el compañero no es un adorno — sin los dedos que contar, esto es exactamente el manejo descontextualizado que D20 prohíbe, y por eso no vale hacerlo solo. Error frecuente en los pequeños: mirar el balón todo el rato y acertar cero números. Empieza permitiendo que miren, y quítalo en la segunda serie. Cuatro minutos y a otra cosa: esto abre la sesión, no la ocupa.',
    tags: ['coordinación', 'cabeza levantada', 'equilibrio', 'analítico', 'calentamiento'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'sostener el balón con las dos manos sin que se caiga',
      dosis: { series: 3, cantidad: 10, unidad: 'repeticiones', descanso: 20 },
      organizacion: 'Con 12: seis parejas a la vez repartidas a lo ancho de la pista, cada una con un balón. Se cambia quien maneja cada diez repeticiones.',
      niveles: {
        base: 'sin números: soltar, palmada y recoger antes del segundo bote.',
        intermedio: 'con números del compañero y una sola palmada.',
        avanzado: 'dos palmadas y tocar el suelo antes de recoger, y el número se dice sumando las dos manos del compañero.',
      },
      criterio_exito: 'nueve de cada diez recogidas antes del segundo bote y con el número acertado',
      aplicacion: 'la recogida de un balón suelto en el juego, donde esa misma velocidad de manos decide de quién es la posesión',
    },
    tablero: () => [
      jug('A', 1, 0.546, 0.3114), jug('A', 3, 0.4288, 0.3114),
      jug('A', 2, 0.546, 0.6598), jug('A', 4, 0.4288, 0.6598),
      balon(0.546, 0.3114), balon(0.546, 0.6598),
    ],
    // Trabajo EN EL SITIO: no hay nada que desplazar, y una animación
    // inventada contaría un ejercicio que no es. Queda el montaje, que
    // es lo que de verdad hay que copiar a la pista: parejas enfrentadas.
    intent: null,
  },
  {
    name: 'Desplazamientos con balón a la señal',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Cuatro formas de moverse con el balón —de frente, de espaldas, de lado y a la pata coja— y el entrenador va cambiando cuál toca.',
    objetivos: 'Ampliar el repertorio de desplazamientos con balón más allá de correr hacia delante, que es lo único que sale solo.',
    descripcion_texto: 'Todos con balón dentro de la media pista. El entrenador canta un desplazamiento y hay que hacerlo sin dejar de botar: de frente, de espaldas, deslizándose de lado o a la pata coja. Cada quince segundos cambia. Nadie puede chocar con nadie, y quien pierde el balón hace tres cambios de mano en el sitio antes de seguir.',
    notas: 'Puntos clave: de espaldas el bote se hace a un lado del cuerpo y bajo, o el balón se queda atrás; de lado, los pies no se juntan nunca, que es el mismo pie del desplazamiento defensivo. Error frecuente: girar el cuerpo para no tener que botar de espaldas de verdad. Este ejercicio sirve doble: es manejo y es el trabajo de pies que después se usa defendiendo, y conviene decírselo para que lo tomen en serio.',
    tags: ['bote', 'coordinación', 'desplazamiento defensivo', 'cabeza levantada', 'lateralidad'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'espacio',
      requisito_previo: 'botar en movimiento sin mirar el balón continuamente',
      dosis: { series: 3, cantidad: 60, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: los doce a la vez dentro de una media pista, un balón cada uno. El entrenador canta desde fuera, donde le vean todos.',
      niveles: {
        base: 'dos desplazamientos —de frente y de lado— y cambios cada treinta segundos.',
        intermedio: 'los cuatro, cambiando cada quince segundos.',
        avanzado: 'los cuatro, cambio cada diez segundos y con la mano no dominante.',
      },
      criterio_exito: 'sesenta segundos sin perder el balón, sin chocar y cambiando a la primera en todas las señales',
    },
    tablero: () => [
      jug('A', 1, 0.2727, 0.3289), jug('A', 2, 0.2727, 0.6424), jug('A', 3, 0.4288, 0.3289),
      jug('A', 4, 0.4288, 0.6424), jug('A', 5, 0.546, 0.4856),
      balon(0.2727, 0.3289), balon(0.2727, 0.6424), balon(0.4288, 0.3289), balon(0.4288, 0.6424), balon(0.546, 0.4856),
    ],
    intent: {
      canasta: null,
      fases: [
        // «¡de lado!» — todos deslizándose sin juntar los pies
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2727, y: 0.2418 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.2727, y: 0.7295 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.4288, y: 0.2418 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.4288, y: 0.7295 } },
          { jugador: 'A5', tipo: 'bote', hacia: { x: 0.546, y: 0.3985 } },
        ] },
        // «¡de espaldas!» — se retrocede con el bote protegido
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.4094, y: 0.2766 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.4094, y: 0.6947 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.5656, y: 0.2766 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.5656, y: 0.6947 } },
          { jugador: 'A5', tipo: 'bote', hacia: { x: 0.6436, y: 0.4508 } },
        ] },
        // «¡de frente!» — y se cruza el espacio otra vez
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2337, y: 0.3637 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.2337, y: 0.6076 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.3703, y: 0.3637 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.3703, y: 0.6076 } },
          { jugador: 'A5', tipo: 'bote', hacia: { x: 0.4875, y: 0.4856 } },
        ] },
      ],
    },
  },
  {
    name: 'Circuito con obstáculos y una decisión al final',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Recorrido de conos que termina con un compañero que señala por qué lado salir: el manejo se cobra en una decisión.',
    objetivos: 'Cerrar el manejo con una lectura, para que el recorrido no sea el objetivo sino la preparación de la decisión final.',
    descripcion_texto: 'Tres conos en zigzag desde el medio campo. Se recorren botando y cambiando de mano en cada uno. Al salir del último, un compañero situado al final levanta un brazo u otro y hay que salir por el lado contrario, terminando con dos botes fuertes. Cinco repeticiones y se cambia el que señala.',
    notas: 'Puntos clave: el recorrido se hace a la velocidad a la que se puede mirar al final, no a la máxima; si llegan al último cono sin haber visto el brazo, van demasiado rápido. Error frecuentísimo: hacer el circuito perfecto mirando los conos y fallar la única decisión que hay. Como entrenador, el dato que importa es cuántas señales acierta, no cuánto tarda. Y si un niño acierta todas y va lentísimo, entonces sí: sube la velocidad. En ese orden.',
    tags: ['bote', 'cambio de mano', 'cabeza levantada', 'toma de decisiones', 'lectura'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva', presion: 'tiempo',
      requisito_previo: 'cambiar de mano en carrera sin frenar y sin mirar el balón',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos circuitos, uno en cada media pista, seis por circuito: fila de cuatro, uno que señala y uno que devuelve los balones. Rotan cada cinco vueltas.',
      niveles: {
        base: 'el compañero levanta el brazo antes de que empiece el recorrido.',
        intermedio: 'lo levanta al salir del segundo cono.',
        avanzado: 'lo levanta al salir del último y puede cambiarlo una vez.',
      },
      criterio_exito: 'acertar cuatro de cada cinco señales sin perder el balón en el circuito',
    },
    /* La cola arranca en 0,58: con cuatro esperando y paso de 0,06 el
       último caía en 0,90 y el medio campo acaba en 0,829, así que el
       que volvía a la fila se salía de la pista. */
    tablero: () => [
      fila(0.5069, 0.5031, 4, 0),
      cono(0.4288, 0.4334, 'rodear'), cono(0.3313, 0.5727, 'rodear'),
      jug('B', 1, 0.2141, 0.5031),
      balon(0.5069, 0.5031),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.2727, y: 0.5553 } },
          { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'el_cono_2' },
          { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'el_cono_3' },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.2141, y: 0.4508 } },
        ] },
        // el brazo señala un lado: se sale por el contrario
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.1751, y: 0.625 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Manejo con el compañero que aparece',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Se bota por el espacio y en cualquier momento un compañero levanta la mano: hay que pasarle el balón en menos de un segundo.',
    objetivos: 'Sostener el manejo mientras se vigila a los compañeros, que es exactamente lo que pasa en un partido y casi nunca en un ejercicio de manejo.',
    descripcion_texto: 'La mitad del grupo bota por el espacio; la otra mitad se mueve sin balón. En cualquier momento, uno de los que no tienen balón levanta la mano: el botador más cercano tiene que pasarle en menos de un segundo, seguir moviéndose sin balón, y ahora es él quien puede pedir. Noventa segundos y se cuentan los pases perdidos.',
    notas: 'Puntos clave: el que bota mira arriba porque hay algo que ver de verdad, y ese algo aparece sin avisar; el que pide se abre a un hueco, no se acerca al balón. Error frecuentísimo: dos que piden a la vez y el botador se queda paralizado — pasa siempre y es parte del ejercicio, se resuelve pasando al primero que se vio. Este es el manejo que sí transfiere: nadie ha hecho nada raro con el balón y todos han pasado noventa segundos con la cabeza levantada.',
    tags: ['bote', 'cabeza levantada', 'pase', 'recepción', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'espacio',
      requisito_previo: 'botar en movimiento y pasar de pecho a cinco metros sin frenar',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: los doce a la vez en una media pista, seis con balón y seis sin él. Se cuentan los pases perdidos del grupo entero y se intenta bajar el número cada serie.',
      niveles: {
        base: 'el que pide lo dice también en voz alta con el nombre del botador.',
        intermedio: 'solo la mano, y un segundo para pasar.',
        avanzado: 'dos pueden pedir a la vez y hay que elegir al que esté mejor colocado.',
      },
      criterio_exito: 'menos de cinco pases perdidos del grupo en noventa segundos',
    },
    tablero: () => [
      jug('A', 1, 0.2922, 0.3289), jug('A', 2, 0.2922, 0.6598), jug('A', 3, 0.5265, 0.5031),
      jug('A', 4, 0.4094, 0.2766), jug('A', 5, 0.4094, 0.7121), jug('A', 6, 0.2141, 0.5031),
      balon(0.2922, 0.3289), balon(0.2922, 0.6598), balon(0.5265, 0.5031),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A4', tipo: 'corte', hacia: { x: 0.4875, y: 0.3114 } },
          { jugador: 'A5', tipo: 'corte', hacia: { x: 0.3313, y: 0.7643 } },
          { jugador: 'A6', tipo: 'corte', hacia: { x: 0.1946, y: 0.3985 } },
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3508, y: 0.3811 } },
        ] },
        // A4 levanta la mano y el balón sale en menos de un segundo
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A4' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.3703, y: 0.6598 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.4679, y: 0.4508 } },
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.2727, y: 0.4334 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A5' }] },
      ],
    },
  },
  {
    name: 'Quitar el balón sin tocar al que bota',
    type: '1vs1', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 5, duration_max: 8,
    description: 'Por parejas dentro de un círculo pequeño: uno bota y el otro intenta sacarle el balón sin tocarle el cuerpo ni las manos.',
    objetivos: 'Meter oposición real en el manejo, que es el bloque de la biblioteca que menos la tenía y donde más se nota la diferencia.',
    descripcion_texto: 'Círculo de tres metros marcado con conos, una pareja dentro. Uno bota sin poder salir del círculo; el otro intenta sacar el balón fuera de un manotazo limpio, sin tocar el cuerpo ni las manos del botador. Treinta segundos y se cambia. Se cuentan los balones sacados de cada uno.',
    notas: 'Puntos clave: en tres metros no hay dónde huir, así que todo depende del bote bajo y del cuerpo interpuesto; la mano libre se pone firme, con el codo pegado, y NO empuja. Error frecuente del que roba: ir a las manos, que es falta y además no funciona — hay que ir al balón cuando sube. Ojo con el contacto a esta edad: si ves agarrones, para y recuérdales que el punto se anula si tocan. Es corto y muy intenso: treinta segundos y cambio.',
    tags: ['bote de protección', 'bote', '1c1', 'competición', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real', presion: 'espacio',
      requisito_previo: 'botar bajo y protegido con el cuerpo sin mirar el balón',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: seis círculos de conos repartidos por la pista, una pareja en cada uno. Se cambia de papel cada treinta segundos y de pareja cada serie.',
      niveles: {
        base: 'círculo de cinco metros y el que roba solo puede molestar, sin sacar el balón.',
        intermedio: 'tres metros y se puede sacar el balón de un manotazo.',
        avanzado: 'tres metros y el botador tiene que botar con la mano no dominante.',
      },
      criterio_exito: 'aguantar los treinta segundos sin que le saquen el balón más de una vez',
    },
    tablero: () => [
      jug('A', 1, 0.3703, 0.3289), jug('B', 1, 0.4484, 0.3289),
      jug('A', 2, 0.3703, 0.6598), jug('B', 2, 0.4484, 0.6598),
      cono(0.3118, 0.2766), cono(0.5069, 0.2766), cono(0.3118, 0.3985), cono(0.5069, 0.3985),
      cono(0.3118, 0.6076), cono(0.5069, 0.6076), cono(0.3118, 0.7295), cono(0.5069, 0.7295),
      balon(0.3703, 0.3289), balon(0.3703, 0.6598),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3508, y: 0.3811 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.4191, y: 0.3724 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.3508, y: 0.7121 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.4191, y: 0.7033 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.4484, y: 0.294 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3801, y: 0.3028 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.4484, y: 0.625 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.3801, y: 0.6337 } },
        ] },
      ],
    },
  },

  /* ═══ JUEGO DE PIES ════════════════════════════════════════ */
  {
    name: 'Parar en dos tiempos a toda velocidad',
    type: 'Bote', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Llegar a tope al cono y frenar con dos apoyos, uno detrás de otro, quedando equilibrado y con el balón cogido.',
    objetivos: 'Instalar la parada en dos tiempos a velocidad real, que es la que salva de los pasos cuando el bote se acaba corriendo.',
    descripcion_texto: 'Fila con balón en el medio campo y un cono a la altura del tiro libre. Se llega botando a máxima velocidad y se para en dos tiempos justo antes del cono: primero un pie, después el otro, con las rodillas flexionadas y el balón recogido con las dos manos a la altura del pecho. Se aguanta la posición dos segundos y se vuelve. Ocho paradas.',
    notas: 'Puntos clave: el primer apoyo es el que frena y va por DELANTE del centro de gravedad; el segundo solo equilibra. El balón se recoge en el primer apoyo, no antes ni después. Errores frecuentes: caer con los dos pies a la vez cuando se pretendía dos tiempos, que ya es otra parada; y frenar con el tronco echado hacia atrás, que deja la salida muerta. Como entrenador, mírale desde el LADO: de frente los dos apoyos parecen uno.',
    tags: ['parada', 'bote', 'analítico', 'equilibrio', 'series'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 14, canastas: 0, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'botar en carrera a velocidad alta sin perder el balón',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 40 },
      organizacion: 'Con 12: dos recorridos en paralelo, uno en cada media pista, seis por recorrido en dos filas de tres con su cono; el que para vuelve trotando por fuera.',
      niveles: {
        base: 'llegando a trote y sin balón.',
        intermedio: 'botando a máxima velocidad y aguantando dos segundos.',
        avanzado: 'a máxima velocidad y con un compañero que canta el cono en el último momento.',
      },
      criterio_exito: 'ocho paradas seguidas con dos apoyos claros vistos desde el lado y sin perder el equilibrio',
      aplicacion: 'el tiro tras bote con parada, donde esa misma parada es lo que permite que el tiro salga equilibrado',
    },
    tablero: () => [
      fila(0.546, 0.4508, 4, 0),
      cono(0.3118, 0.4508),
      balon(0.546, 0.4508),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.3313, y: 0.4508 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Elegir la parada',
    type: 'Bote', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El compañero canta «uno» o «dos» mientras se llega: hay que parar con la que toca y salir después por el lado que se pueda.',
    objetivos: 'Tener las dos paradas disponibles y saber qué deja cada una, en vez de usar siempre la que sale sola.',
    descripcion_texto: 'Fila con balón y un compañero a la altura del tiro libre. Se llega botando y el compañero canta «uno» o «dos» cuando el atacante está a tres metros. Con «uno» se para a pies juntos, y desde ahí se puede pivotar con cualquiera; con «dos», parada en dos tiempos y solo vale pivotar sobre el primer apoyo. Se demuestra pivotando dos veces antes de volver. Seis repeticiones.',
    notas: 'Puntos clave: la parada en un tiempo deja los dos pies libres y por eso da más opciones; la de dos tiempos frena mejor a velocidad alta. Eso es todo lo que hay que entender, y se entiende pivotando, no escuchándolo. Error frecuentísimo: hacer siempre la misma diga lo que diga el compañero. Otro, del entrenador: mezclar las dos paradas antes de que cada una salga sola por separado — entonces no se aprende ninguna. Esta ficha es la de después.',
    tags: ['parada', 'pivote', 'lectura', 'bote', 'coordinación'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 14, canastas: 0, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva', presion: 'tiempo',
      requisito_previo: 'parar en un tiempo y en dos tiempos por separado sin arrastrar el pie',
      dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una en cada media pista, seis por estación: fila de cuatro, uno que canta y uno que devuelve balones. Rota el que canta cada vuelta.',
      niveles: {
        base: 'el compañero canta antes de que empiece la carrera.',
        intermedio: 'canta a tres metros del cono.',
        avanzado: 'canta a un metro, y después señala un lado por el que hay que salir.',
      },
      criterio_exito: 'seis paradas con la que tocaba y sin arrastrar el pie de pivote',
    },
    tablero: () => [
      fila(0.546, 0.5553, 4, 0),
      jug('B', 1, 0.2727, 0.5031),
      cono(0.3313, 0.5553),
      balon(0.546, 0.5553),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.3508, y: 0.5553 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.2727, y: 0.5553 } },
        ] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.3703, y: 0.6598 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Pivotar de espaldas para proteger',
    type: '1vs1', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Con el defensor encima y el bote gastado: pivote hacia atrás para alejar el balón, y solo entonces buscar la salida.',
    objetivos: 'Usar el pivote para lo que sirve —crear distancia y cambiar el ángulo—, no para ganar tiempo esperando a que pase algo.',
    descripcion_texto: 'Por parejas. El atacante recibe con el balón ya cogido y el defensor a un brazo. No se puede botar. El atacante pivota HACIA ATRÁS sobre un pie para alejar el balón del defensor, y desde ahí abre el ángulo hacia un lado. El defensor presiona sin robar durante cinco segundos. Cuatro repeticiones y se cambia.',
    notas: 'Puntos clave: se pivota hacia atrás, no hacia delante, porque hacia delante el balón entra en las manos del defensor; el balón viaja pegado al cuerpo durante el giro, a la altura de la cadera. Errores frecuentes: levantar el pie de pivote —pasos, y a esta edad no se lo pitan casi nunca, así que tienes que pitarlo tú—; y pivotar cinco veces sin decidir nada. El pivote es para encontrar la salida, no para esconderse.',
    tags: ['pivote', 'bote de protección', 'parada', '1c1', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'pivotar sobre los dos pies sin levantar el de apoyo',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: seis parejas a la vez repartidas por la pista, sin canastas. Se cambia de papel cada cuatro repeticiones.',
      niveles: {
        base: 'el defensor solo levanta los brazos sin acercarse.',
        intermedio: 'presión real a un brazo durante cinco segundos.',
        avanzado: 'el defensor puede cambiarse de lado y hay que volver a pivotar para reencontrar el ángulo.',
      },
      criterio_exito: 'las cuatro repeticiones con pivote hacia atrás, sin pasos y terminando con el balón fuera del alcance del defensor',
    },
    tablero: () => [
      jug('A', 1, 0.4288, 0.3289), jug('B', 1, 0.3703, 0.3289),
      jug('A', 2, 0.4288, 0.6598), jug('B', 2, 0.3703, 0.6598),
      balon(0.4288, 0.3289), balon(0.4288, 0.6598),
    ],
    intent: {
      canasta: null,
      fases: [
        // se pivota hacia atrás: el balón se aleja del defensor
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.4875, y: 0.294 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.4288, y: 0.3028 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.4875, y: 0.6947 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.4288, y: 0.6859 } },
        ] },
        // y solo entonces se abre el ángulo hacia un lado
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.5069, y: 0.3811 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.4484, y: 0.3637 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.5069, y: 0.6076 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.4484, y: 0.625 } },
        ] },
      ],
    },
  },
  {
    name: 'Finta de salida y salida',
    type: 'Bote', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Se enseña el pie hacia un lado, se espera a que el defensor lo compre, y se sale por el otro sin haber levantado el pie de pivote.',
    objetivos: 'Ganar la salida sin velocidad, que es lo que le queda al que no es el más rápido y lo que casi nadie enseña.',
    descripcion_texto: 'Atacante en el 45 con balón parado y defensor a un brazo. Se hace una finta de salida —paso corto y decidido hacia un lado, con el balón acompañando y sin levantar el pie de pivote— y, si el defensor se mueve, se sale por el contrario. Si no se mueve, se sale por el mismo. Cuatro repeticiones y se cambia.',
    notas: 'Puntos clave: la finta es CORTA y baja, y tiene que parecer la salida de verdad, o nadie la compra; y el balón sale antes que el pie de pivote, siempre. Error frecuentísimo: fintar con el cuerpo alto y lento, que no engaña ni a un cono. Otro: levantar el pie de pivote en la finta, que son pasos. Como entrenador, mira ese pie y píta​selo: si no se lo pitas en el entrenamiento, se lo pitarán en el partido.',
    tags: ['finta', 'salida en bote', 'pivote', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'salir en bote hacia los dos lados sin arrastrar el pie de pivote',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas repartidas por el perímetro. Se cambia de papel cada cuatro repeticiones.',
      niveles: {
        base: 'el defensor muerde siempre la finta y solo se practica salir por el contrario.',
        intermedio: 'el defensor decide y el atacante lee.',
        avanzado: 'dos fintas seguidas y el defensor puede aguantar la primera.',
      },
      criterio_exito: 'las cuatro salidas sin levantar el pie de pivote en la finta y por el lado que el defensor deja',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el defensor compra la finta y se abre a ese lado
        { eventos: [{ jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2727, y: 0.6772 } }] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2532, y: 0.5379 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2532, y: 0.625 } },
        ] },
      ],
    },
  },
  {
    name: 'Cuatro esquinas de pies',
    type: 'Bote', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Circuito de cuatro conos donde en cada uno toca una cosa distinta: parada de uno, de dos, pivote y salida cruzada.',
    objetivos: 'Encadenar todo el juego de pies en un recorrido continuo, que es donde se ve cuál de las cuatro cosas no está instalada.',
    descripcion_texto: 'Cuatro conos formando un cuadrado grande. Se recorre botando: en el primero, parada en un tiempo y pivote; en el segundo, parada en dos tiempos; en el tercero, salida directa; en el cuarto, salida cruzada. Dos vueltas seguidas por jugador, contando los errores que ve el compañero que espera. Se cambia de sentido en la segunda serie.',
    notas: 'Puntos clave: encadenar es lo difícil — cada gesto sale bien suelto y se rompe cuando viene después de otro; el compañero que mira es el que hace el ejercicio útil, así que dale una cosa concreta que vigilar (el pie de pivote, por ejemplo) en vez de «mira si lo hace bien». Error del entrenador: montar esto antes de tener las cuatro cosas por separado. Es el ejercicio de cierre del bloque, no el de entrada.',
    tags: ['parada', 'pivote', 'salida en bote', 'bote', 'series'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'parar en un tiempo, parar en dos tiempos, pivotar y salir en bote por los dos lados',
      dosis: { series: 3, cantidad: 2, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos circuitos, uno en cada media pista, seis por circuito trabajando en parejas: uno recorre y el otro cuenta los errores de una sola cosa acordada antes.',
      niveles: {
        base: 'dos conos y dos gestos, y se anda entre ellos.',
        intermedio: 'cuatro conos y cuatro gestos botando.',
        avanzado: 'cuatro conos, y el compañero canta el gesto de cada uno justo al llegar.',
      },
      criterio_exito: 'dos vueltas con menos de dos errores según el compañero',
    },
    tablero: () => [
      fila(0.585, 0.3289, 3, 0),
      cono(0.585, 0.3289), cono(0.585, 0.6772), cono(0.2922, 0.6772), cono(0.2922, 0.3289),
      balon(0.585, 0.3289),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.585, y: 0.6598 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.3118, y: 0.6772 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.2922, y: 0.3463 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
];
