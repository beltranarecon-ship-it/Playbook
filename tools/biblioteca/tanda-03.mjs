/* ============================================================
   tanda-03.mjs — 1c1, defensa y juego reducido (Bloque D).

   Los tres bloques de veinte que iban a dos. Aquí la oposición viene
   sola —es lo que son estos contenidos—, así que esta tanda además
   baja la proporción de ejercicios sin defensa, que iba pegada al
   tope del 25 %.

   Doctrina que más aprieta en estos bloques:
     D6  · el formato se elige por objetivo; 1c1 y 2c2 son los de más
           densidad técnica, el 5c5 el que menos enseña
     D10 · nada de zona en el núcleo mini: está prohibida por reglamento
     D11 · toda ayuda lleva su recuperación
     D22 · en el núcleo se quita la negación de línea de pase: un niño
           de nueve no puede negar, ayudar y recuperar a la vez
     D23 · el 1c1 resuelto es el requisito previo del juego de dos
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_03 = [

  /* ═══ 1c1 ══════════════════════════════════════════════════ */
  {
    name: '1c1 de espaldas desde el poste',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Recibir de espaldas en el poste bajo y resolver con un giro, leyendo por qué lado le defienden.',
    objetivos: 'Jugar de espaldas al aro: sentir dónde está el defensor sin mirarle y girar hacia el lado libre.',
    descripcion_texto: 'Pasador en el 45 y atacante en el poste bajo, de espaldas, con el defensor detrás. El atacante pide el balón con la mano de fuera y, al recibir, tiene que notar con el cuerpo por dónde le defienden y girar hacia el lado contrario. Máximo un bote. Tres posesiones cada uno y rotan.',
    notas: 'Puntos clave: se pide con la mano lejos del defensor y se sostiene la posición con el antebrazo y el trasero, no empujando con la mano; el giro va hacia donde NO está el defensor, y eso se sabe por contacto, no mirando. Error frecuente: girar siempre hacia el mismo lado, que es el que tienen ensayado. Otro: recibir y quedarse de espaldas botando sin decidir. Con un bote de máximo eso se acaba solo.',
    variantes: 'Base: el defensor se coloca fijo a un lado y avisa en voz alta de cuál; el atacante solo practica girar al contrario. Intermedio: el defensor elige y el atacante lee, con un bote. Avanzado: el defensor puede cambiar de lado mientras llega el pase.',
    tags: ['1c1', 'pivote', 'recepción', 'lectura', 'finalización', 'ventaja'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real',
      requisito_previo: 'pivotar sobre los dos pies sin levantar el de apoyo',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      criterio_exito: 'gira hacia el lado libre en dos de cada tres posesiones, entre o no entre',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
      jug('B', 1, M.poste_bajo_der[0] + 0.09, M.poste_bajo_der[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: '1c1 en el cuadrado',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Uno contra uno dentro de un cuadrado pequeño: sin espacio para correr, todo se resuelve con pies y protección.',
    objetivos: 'Resolver en espacio muy reducido, donde no vale la velocidad y sí el cambio de ritmo y la protección.',
    descripcion_texto: 'Cuadrado de cuatro metros marcado con conos, con el aro fuera. El atacante tiene que salir del cuadrado botando por cualquiera de los dos lados marcados; el defensor lo impide. Si sale, ataca la canasta libre. Si le roban o pisa fuera por otro lado, cambio. Veinte segundos como máximo por intento.',
    notas: 'Puntos clave: en poco espacio manda el primer paso, no la velocidad punta; el bote baja y el cuerpo se interpone siempre. Error frecuente: intentar irse de velocidad y estrellarse contra el cono. Es el ejercicio donde mejor se ve quién sabe usar el cambio de ritmo: los que solo tienen cambio de mano aquí no pasan.',
    variantes: 'Base: cuadrado de seis metros y una sola salida obligatoria. Intermedio: cuatro metros y dos salidas. Avanzado: cuatro metros, dos salidas y máximo tres botes.',
    tags: ['1c1', 'bote de protección', 'cambio de ritmo', 'bote', 'competición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'botar protegiendo con el cuerpo sin perder el balón',
      dosis: { series: 4, cantidad: 20, unidad: 'segundos', descanso: 45 },
      criterio_exito: 'salir del cuadrado en tres de cada cuatro intentos',
    },
    tablero: () => [
      jug('A', 1, 0.52, 0.50), jug('B', 1, 0.46, 0.50),
      cono(0.58, 0.40), cono(0.58, 0.60), cono(0.42, 0.40), cono(0.42, 0.60),
      balon(0.52, 0.50),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: { x: 0.46, y: 0.40 } }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: '1c1 con ventaja inicial',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El atacante empieza medio metro por delante: hay que castigar la ventaja antes de que se cierre.',
    objetivos: 'Aprender que una ventaja dura poco y que se aprovecha yendo hacia el aro, no administrándola.',
    descripcion_texto: 'Atacante en el 45 con balón y defensor un paso por detrás y a un lado. A la señal, el atacante ataca. La ventaja es real pero pequeña: si duda un segundo, desaparece. Se cuenta cuántas veces termina en canasta o en tiro cómodo. Tres cada uno y rotan.',
    notas: 'Puntos clave: la ventaja se conserva yendo en línea recta hacia el aro, no hacia fuera; el primer bote es largo. Error frecuentísimo: recibir la ventaja y botar de lado, con lo que el defensor recupera la posición y ya no hay nada. Es el ejercicio que mejor enseña por qué el pase del compañero vale tanto: la ventaja te la dan y hay que no perderla.',
    variantes: 'Base: la ventaja es de dos pasos y el defensor no puede saltar. Intermedio: un paso y defensa completa. Avanzado: el atacante recibe un pase y la ventaja depende de si el defensor sale bien; puede no haberla.',
    tags: ['1c1', 'ventaja', 'bote', 'entrada', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'salir en bote con un primer paso largo hacia el aro',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      criterio_exito: 'la ventaja acaba en canasta o en tiro cómodo en dos de cada tres ataques',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.03, M.escolta_izq[1] - 0.05),
      balon(M.escolta_izq[0], M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: '1c1 al primer bote',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Un solo bote para terminar: obliga a que la finta y el primer paso sirvan de algo.',
    objetivos: 'Concentrar toda la resolución en el primer movimiento, que es donde se gana el uno contra uno de verdad.',
    descripcion_texto: 'Atacante en la punta con balón, defensor delante. Solo se permite UN bote. Se puede fintar todo lo que se quiera antes, pero en cuanto se bota hay que terminar. Tres posesiones cada uno; el defensor suma punto si obliga a fallar o a no poder terminar.',
    notas: 'Puntos clave: la finta es con el balón y los ojos, no solo con los pies; el primer paso va pegado al defensor, no rodeándole. Error frecuente: fintar sin intención, moviendo el balón sin que el defensor se lo crea. Como entrenador, mira si el defensor reacciona: si no se mueve, la finta no existía. Este ejercicio quita de un plumazo el bote de tanteo.',
    variantes: 'Base: dos botes y defensor pasivo que solo acompaña. Intermedio: un bote y defensa completa. Avanzado: un bote y el atacante empieza con el balón en el suelo, teniendo que recogerlo con el defensor encima.',
    tags: ['1c1', 'finta', 'salida en bote', 'toma de decisiones', 'competición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real',
      requisito_previo: 'salir en bote sin dar pasos y parar en dos tiempos',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      criterio_exito: 'terminar dentro del bote permitido en tres de cada tres, y que el defensor se mueva con la finta al menos la mitad de las veces',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_izq' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: '1c1 tras recepción en carrera',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Se recibe corriendo desde la esquina y hay que resolver sin parar: llegar, leer y terminar.',
    objetivos: 'Encadenar recepción en movimiento y uno contra uno sin ese medio segundo de parón que lo estropea todo.',
    descripcion_texto: 'El atacante arranca desde la esquina hacia el 45 y recibe en carrera del pasador de la punta. Su defensor le persigue desde el fondo. Al recibir tiene que atacar directamente: parar y tirar, o seguir hacia el aro. No se puede botar de lado para recolocarse. Tres cada uno.',
    notas: 'Puntos clave: se recibe con los pies orientados al aro, lo que exige preparar el último apoyo antes del balón; la decisión ya viene tomada de camino. Error frecuente: recibir, parar, mirar y entonces decidir — para cuando decide, el defensor ya llegó. Consejo: que diga en voz alta "tiro" o "entro" ANTES de recibir; se equivocará, y esa es la lección.',
    variantes: 'Base: sin defensor, solo recibir en carrera y terminar. Intermedio: con defensor que persigue desde el fondo. Avanzado: el defensor sale a la vez que el atacante y puede llegar antes al 45.',
    tags: ['1c1', 'recepción', 'lectura', 'toma de decisiones', 'finalización', 'desmarque'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'recibir en carrera sin que se le escape el balón',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      criterio_exito: 'atacar sin parón en dos de cada tres recepciones',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.esquina_der[0], M.esquina_der[1]),
      jug('B', 1, M.esquina_der[0] - 0.06, M.esquina_der[1] - 0.03),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'escolta_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ DEFENSA ══════════════════════════════════════════════ */
  {
    name: 'Espejo defensivo',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 4, duration_min: 4, duration_max: 8,
    description: 'Por parejas y sin balón: uno se desplaza y el otro le copia manteniendo la postura y la distancia.',
    objetivos: 'Instalar la postura y el desplazamiento defensivo con alguien real delante marcando el ritmo.',
    descripcion_texto: 'Por parejas, enfrentados a dos metros. Uno se desplaza lateralmente, adelante y atrás dentro de un espacio marcado; el otro le copia como un espejo manteniendo siempre la misma distancia. Treinta segundos y se cambia. Sin balón: aquí solo se entrenan los pies.',
    notas: 'Puntos clave: pies más anchos que los hombros, peso en las plantas, y NUNCA juntar los pies al desplazarse. Error frecuente: cruzar los pies, que es justo el instante en que un atacante pasaría. Segundo error: subir el cuerpo cuando llega el cansancio, que es cuando hay que insistir. Esto es de las pocas cosas que sí tiene sentido entrenar sin balón, porque el gesto es puramente de pies.',
    variantes: 'Base: solo desplazamiento lateral, quince segundos. Intermedio: lateral, adelante y atrás, treinta segundos. Avanzado: el que dirige puede arrancar a correr y el otro tiene que girar y perseguir sin cruzar los pies en el giro.',
    tags: ['postura defensiva', 'desplazamiento defensivo', 'defensa individual', 'coordinación'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: [], densidad: 'alta', oposicion: 'pasiva',
      requisito_previo: 'mantenerse agachado con los pies separados sin apoyar las manos',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 30 },
      criterio_exito: 'treinta segundos sin cruzar los pies ni una vez, comprobado por la pareja',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.30), jug('B', 1, 0.44, 0.30),
      jug('A', 2, 0.34, 0.70), jug('B', 2, 0.44, 0.70),
    ],
    intent: null,
  },
  {
    name: 'Ver balón y ver a mi par',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Defender a un atacante sin balón colocándose donde se pueda ver a los dos, sin negar el pase.',
    objetivos: 'Aprender la posición de defensa sin balón: abierto, viendo al par y al balón a la vez.',
    descripcion_texto: 'Dos atacantes —uno con balón en la punta y otro moviéndose por el lado— y dos defensores. El del balón defiende normal. El otro tiene que colocarse de manera que pueda señalar con una mano a su par y con la otra al balón sin girar la cabeza. El entrenador grita "¡mira!" en cualquier momento y todos se congelan: quien no pueda señalar a los dos, punto en contra.',
    notas: 'Puntos clave: el cuerpo se abre hacia el balón y se retrasa un paso hacia el aro; se ve con la vista periférica, no girando la cabeza. IMPORTANTE: aquí NO se niega la línea de pase. A estas edades negar, ayudar y recuperar son tres tareas a la vez y no salen; se quita la negación para que las otras dos se aprendan de verdad, y la negación llega en Infantil.',
    variantes: 'Base: el atacante sin balón se mueve despacio y el balón no se mueve. Intermedio: los dos se mueven. Avanzado: tres atacantes y tres defensores, con el balón circulando.',
    tags: ['defensa individual', 'defensa sin balón', 'postura defensiva', 'lectura'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'semiactiva',
      requisito_previo: 'mantener la postura defensiva desplazándose',
      dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 45 },
      criterio_exito: 'poder señalar a par y balón en cinco de cada seis congelaciones',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.alero_der[0], M.alero_der[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]), jug('B', 2, M.alero_der[0] - 0.08, M.alero_der[1] - 0.10),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'esquina_der' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'escolta_der' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
      ],
    },
  },
  {
    name: 'Defensa del corte',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El atacante pasa y corta a canasta; el defensor tiene que acompañarle sin perderle de vista ni dejarle el carril.',
    objetivos: 'Defender el pasar y cortar, que es la forma más simple de generar ventaja y la que más veces vamos a sufrir.',
    descripcion_texto: 'Dos atacantes —punta y 45— y sus defensores. El de la punta pasa y corta a canasta. Su defensor tiene que dar un paso hacia el balón al salir el pase y acompañar el corte por delante, sin quedarse detrás. Si el cortador recibe libre, punto para el ataque. Tres posesiones y rotan.',
    notas: 'Puntos clave: el paso al balón se da EN EL PASE, no cuando el atacante ya arrancó; se acompaña el corte con el brazo y la vista, sin agarrar. Error frecuente: mirar el balón y perder al cortador, que es exactamente lo que busca el ataque. Es el reverso del ejercicio de pasar y cortar del piloto y conviene ponerlos seguidos: los mismos niños ven las dos caras.',
    variantes: 'Base: el corte es siempre por el mismo lado y el defensor lo sabe. Intermedio: el cortador elige lado. Avanzado: el cortador puede cortar o quedarse y volver a pedir arriba.',
    tags: ['defensa individual', 'defensa sin balón', 'corte', 'pasar y cortar', 'recuperación'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'defender al jugador con balón manteniendo la postura',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      criterio_exito: 'el cortador no recibe libre en dos de cada tres posesiones',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]), jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
      ],
    },
  },
  {
    name: 'Cerrar y contener',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Salir corriendo a cerrar a un tirador y llegar frenado, capaz de defender la penetración que viene después.',
    objetivos: 'Aprender a cerrar sin pasarse: llegar a molestar el tiro y seguir en pie para el bote siguiente.',
    descripcion_texto: 'El defensor empieza tocando el aro. El entrenador pasa a un atacante situado en el 45 y el defensor sale a cerrar. El atacante decide: si el cierre llega volando y descontrolado, bota y entra; si llega frenado, tira. Se puntúa al defensor, no al atacante: punto si molesta el tiro sin que le superen.',
    notas: 'Puntos clave: se sale a toda velocidad y se frena con pasos cortos en los últimos dos metros, con la mano alta del lado del balón; se llega con el peso atrás, no encima del atacante. Error frecuente: saltar hacia el tirador y quedar vendido. Regla que ayuda: "corre largo y frena corto". Segundo error: cerrar de frente en lugar de sesgado hacia el lado fuerte.',
    variantes: 'Base: el atacante solo tira, nunca bota; el defensor practica llegar y frenar. Intermedio: el atacante decide. Avanzado: el defensor sale desde más lejos y el atacante puede pasar a un tercero en la esquina.',
    tags: ['defensa individual', 'recuperación', 'desplazamiento defensivo', 'defensa del bote', 'lectura'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'desplazarse en postura defensiva sin cruzar los pies',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      criterio_exito: 'molestar el tiro sin ser superado en tres de cada cuatro cierres',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.poste_bajo_der[0], M.poste_bajo_der[1]),
      jug('A', 2, M.base[0], M.base[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
      ],
    },
  },
  {
    name: 'Dos ayudas seguidas',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 5, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Tres contra tres donde el balón cambia de lado dos veces: hay que ayudar, recuperar y volver a ayudar.',
    objetivos: 'Sostener el ciclo de ayuda y recuperación más de una vez seguida, que es donde se cae la defensa de verdad.',
    descripcion_texto: 'Tres atacantes repartidos —punta y las dos esquinas— y tres defensores. El de la punta penetra por un lado, el defensor del lado contrario ayuda y recupera; el balón sale a esa esquina y el nuevo poseedor penetra otra vez, obligando a una segunda ayuda. Solo dos penetraciones y luego se termina la jugada.',
    notas: 'Puntos clave: la ayuda es corta y la recuperación es inmediata; nadie se queda dentro (D11 — y además está sancionado por reglamento estar tres segundos en la zona sin defender). Error frecuente: la primera ayuda sale bien y la segunda llega tarde porque el defensor no volvió a su sitio después de la primera. La recuperación es la mitad que se olvida.',
    variantes: 'Base: una sola penetración y una sola ayuda. Intermedio: dos penetraciones encadenadas. Avanzado: tres penetraciones y el ataque puede tirar en cualquier momento.',
    tags: ['ayuda', 'recuperación', 'defensa individual', 'desplazamiento defensivo', 'lectura'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'ayudar y recuperar una vez sin quedarse dentro de la zona',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      criterio_exito: 'las dos ayudas llegan a tiempo y los dos ayudantes recuperan a su par en tres de cada cuatro jugadas',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.esquina_der[0], M.esquina_der[1]), jug('A', 3, M.esquina_izq[0], M.esquina_izq[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      jug('B', 2, M.esquina_der[0] + 0.05, M.esquina_der[1] - 0.05),
      jug('B', 3, M.esquina_izq[0] + 0.05, M.esquina_izq[1] + 0.05),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'B3', tipo: 'defiende', marca: 'A1', hacia: { x: M.poste_bajo_izq[0] + 0.04, y: M.poste_bajo_izq[1] } }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A3' }, { jugador: 'B3', tipo: 'defiende', marca: 'A3' }] },
        { eventos: [{ jugador: 'A3', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ JUEGO REDUCIDO ═══════════════════════════════════════ */
  {
    name: '1c1 con zonas de puntuación',
    type: '1vs1', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 8, duration_max: 15,
    description: 'Uno contra uno donde la canasta vale distinto según desde dónde se anote: la regla dirige el aprendizaje.',
    objetivos: 'Dirigir la conducta con la puntuación en lugar de con instrucciones: si entrar vale más, entrarán.',
    descripcion_texto: 'Uno contra uno desde la punta. La canasta anotada desde dentro de la zona vale 3; desde fuera, 1. Se juega a 7. Como entrar vale el triple, el atacante busca el aro y el defensor tiene que aprender a protegerlo. Cambiando la puntuación se cambia lo que se entrena sin decir una palabra.',
    notas: 'Puntos clave: no hay que explicar nada, la puntuación explica sola. Si quieres que trabajen el tiro exterior, inviértela. Error del entrenador, no del jugador: cambiar la puntuación a media serie; hay que dejar que descubran la lógica. Este es el ejemplo más claro de enseñar cambiando las reglas del juego en vez de con series analíticas.',
    variantes: 'Base: dentro de la zona 3, fuera 1, sin límite de botes. Intermedio: lo mismo con máximo tres botes. Avanzado: se invierte —fuera 3 y dentro 1— y hay que rehacer todo el plan de ataque.',
    tags: ['juego reducido', '1c1', 'competición', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'resolver el uno contra uno con bote y con tiro',
      dosis: { series: 3, cantidad: 7, unidad: 'repeticiones', descanso: 75 },
      criterio_exito: 'la mayoría de los ataques van a la zona de más valor sin que nadie lo haya dicho',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('B', 1, M.base[0] - 0.05, M.base[1]),
      cono(M.codo_der[0], M.codo_der[1]), cono(M.codo_izq[0], M.codo_izq[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },
  {
    name: '2c2 a dos toques',
    type: '2vs2', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 15,
    description: 'Dos contra dos donde solo se puede recibir y hacer una cosa: tirar, entrar o pasar. Nada de pensar con el balón en las manos.',
    objetivos: 'Acelerar la toma de decisiones obligando a decidir antes de recibir.',
    descripcion_texto: 'Dos contra dos en media pista. Al recibir solo se puede hacer una acción: tirar, dar un bote y terminar, o pasar. No se puede recibir, botar, parar y pensar. Se juega a cuatro canastas. Tras rebote o robo hay que sacar el balón por encima del tiro libre.',
    notas: 'Puntos clave: la decisión se toma ANTES de recibir, mirando dónde está la defensa mientras llega el balón; el receptor pide con las manos y con los pies ya orientados. Error frecuente al empezar: recibir y quedarse bloqueado, porque hasta ahora pensaban con el balón cogido. Dales dos posesiones de margen para que se acostumbren; a partir de la tercera empiezan a mirar antes.',
    variantes: 'Base: 2c2 normal, sin restricción. Intermedio: una sola acción al recibir. Avanzado: una sola acción y máximo tres segundos por posesión de equipo.',
    tags: ['juego reducido', 'toma de decisiones', 'lectura', 'pase', 'espaciado', 'competición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'recibir orientado al aro y pasar en movimiento',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      criterio_exito: 'ninguna posesión se queda parada con el balón en las manos más de dos segundos',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0], M.escolta_izq[1]), jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_izq[0] - 0.05, M.escolta_izq[1]), jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.escolta_izq[0], M.escolta_izq[1]),
    ],
    intent: null,
  },
  {
    name: '4c4 sin bote',
    type: '4vs4', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 10, duration_max: 20,
    description: 'Cuatro contra cuatro prohibiendo botar: solo quedan el pase, el corte y ocupar espacios.',
    objetivos: 'Obligar al juego sin balón, que es lo que desaparece en cuanto se permite botar.',
    descripcion_texto: 'Cuatro contra cuatro en media pista sin bote. Quien recibe puede pivotar, pasar o tirar, pero no botar. La consecuencia es inmediata: si nadie se mueve, no hay a quién pasar. Se juega a cuatro canastas. Tras rebote defensivo, saque desde fuera.',
    notas: 'Puntos clave: después de pasar hay que hacer algo —cortar o separarse—; los cuatro no pueden estar en el mismo lado. Error frecuente y muy visible: los primeros dos minutos se quedan todos quietos pasándose el balón por el perímetro. No lo corrijas hablando: espera. El propio juego les obliga a moverse porque si no, no hay salida.',
    variantes: 'Base: 3c3 sin bote, que es más fácil de leer. Intermedio: 4c4 sin bote. Avanzado: 4c4 sin bote y con tres segundos por posesión individual.',
    tags: ['juego reducido', 'espaciado', 'pasar y cortar', 'desmarque', 'pase', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 8, jugadores_max: 16, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'pasar y recibir en movimiento con un defensor cerca',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      criterio_exito: 'ninguna posesión termina por no encontrar a quién pasar',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.alero_der[0], M.alero_der[1]),
      jug('A', 3, M.alero_izq[0], M.alero_izq[1]), jug('A', 4, M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]), jug('B', 2, M.alero_der[0] - 0.05, M.alero_der[1]),
      jug('B', 3, M.alero_izq[0] - 0.05, M.alero_izq[1]), jug('B', 4, M.poste_bajo_der[0] + 0.09, M.poste_bajo_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },
  {
    name: '3c2 e inferioridad de vuelta',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 5, intensidad: 5, duration_min: 10, duration_max: 20,
    description: 'Superioridad de ida y, al fallar o anotar, inferioridad de vuelta: hay que defender siendo menos.',
    objetivos: 'Defender en inferioridad, que es la situación que nadie entrena y todos sufren.',
    descripcion_texto: 'Tres atacan contra dos hacia una canasta. Al terminar, dos de los tres atacantes vuelven atacando y los dos defensores más uno que entra desde el fondo defienden — es decir, ahora la inferioridad la sufre el otro lado. Los defensores en inferioridad tienen que proteger el aro primero y presionar el balón después.',
    notas: 'Puntos clave defendiendo en inferioridad: el de atrás protege el aro y el de delante frena el balón; nunca los dos al mismo hombre. Se defiende el PASE, no al jugador. Error frecuente: los dos defensores van al balón y dejan una entrada libre. Regla que ayuda: "uno arriba, uno abajo, y el de abajo no sube hasta que el balón se suelte". Ojo con el cansancio: este ejercicio agota, y es donde peor se defiende.',
    variantes: 'Base: 2c1 de ida y 1c1 de vuelta. Intermedio: 3c2 de ida y 2c2 de vuelta. Avanzado: 4c3 de ida y 3c3 de vuelta, sin parar durante cuatro minutos.',
    tags: ['juego reducido', 'inferioridad', 'superioridad', 'transición', 'balance defensivo', 'defensa individual'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'defender individualmente a un par y correr el contraataque por carriles',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 120 },
      criterio_exito: 'la defensa en inferioridad evita la canasta fácil en la mitad de las jugadas',
    },
    tablero: () => [
      jug('A', 1, E.escolta_izq[0], 0.70), jug('A', 2, E.base[0], 0.74), jug('A', 3, E.escolta_der[0], 0.70),
      jug('B', 1, E.tiro_libre[0], E.tiro_libre[1]), jug('B', 2, E.poste_bajo_izq[0], E.poste_bajo_izq[1]),
      balon(E.base[0], 0.74),
    ],
    intent: null,
  },
];
