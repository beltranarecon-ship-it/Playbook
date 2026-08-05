/* ============================================================
   tanda-07.mjs — manejo, rebote, calentamiento y psicomotricidad.

   Los cuatro bloques que quedan más lejos de su objetivo tras seis
   tandas. Son también los que menos oposición admiten por naturaleza,
   así que aquí es donde se gasta el margen de fichas sin defensor —
   que está en el 11 %, con tope del 25 %.
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_07 = [

  /* ═══ MANEJO ═══════════════════════════════════════════════ */
  {
    name: 'El reloj',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Conos en círculo numerados como un reloj: hay que ir botando a la hora que se diga, por dentro o por fuera.',
    objetivos: 'Cambiar de dirección constantemente mientras se procesa una orden, sin que el balón mande.',
    descripcion_texto: 'Doce conos en círculo, numerados del uno al doce. Todos botan dentro del círculo. El entrenador dice una hora —"las cuatro"— y hay que ir al cono correspondiente rodeándolo por fuera y volver al centro. Si dice "y media", hay que ir al cono de enfrente. Nadie puede chocar.',
    notas: 'Puntos clave: el cambio de dirección se hace con el pie de fuera y bajando el bote; la orden obliga a levantar la vista antes de arrancar. Error frecuente: salir corriendo antes de saber adónde. Este ejercicio funciona porque hay que pensar Y botar: quitarle la parte de pensar lo convierte en el ejercicio de circo del que avisa D20.',
    tags: ['bote', 'cambio de dirección', 'cabeza levantada', 'coordinación', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'botar en movimiento cambiando de dirección sin perder el balón',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: cuatro grupos de tres a la vez, repartidos por la pista. No usa canastas.',
      niveles: {
        base: 'seis conos y solo el número.',
        intermedio: 'doce conos con horas.',
        avanzado: 'horas con "y media", y hay que ir con la mano no dominante.',
      },
      criterio_exito: 'acertar el cono en nueve de cada diez órdenes sin perder el balón',
    },
    tablero: () => [
      jug('A', 1, 0.42, 0.44), jug('A', 2, 0.42, 0.56), jug('A', 3, 0.48, 0.50),
      cono(0.30, 0.50), cono(0.34, 0.36), cono(0.42, 0.28), cono(0.52, 0.30),
      cono(0.58, 0.42), cono(0.58, 0.58), cono(0.52, 0.70), cono(0.42, 0.72),
      cono(0.34, 0.64),
      balon(0.42, 0.44), balon(0.42, 0.56), balon(0.48, 0.50),
    ],
    /* Ida y vuelta: cada uno sale del centro hacia SU hora, la rodea
       por fuera y vuelve. Tres jugadores a tres horas distintas para
       que se vea lo que de verdad tiene que verse — que hay que
       levantar la cabeza antes de arrancar o te llevas al de al lado. */
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.42, y: 0.25 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.53, y: 0.73 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.61, y: 0.41 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.42, y: 0.44 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.42, y: 0.56 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.48, y: 0.50 } },
        ] },
      ],
    },
  },
  {
    name: 'Pasar sin mirar la pared',
    type: 'Pase', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 4, duration_max: 8,
    description: 'Pases contra la pared a distintas alturas y velocidades, con el compañero cantando números que hay que leer.',
    objetivos: 'Manipular y recibir a alta frecuencia sin que la vista se quede pegada al balón.',
    descripcion_texto: 'Cada jugador frente a una pared a dos metros, pasando y recibiendo sin parar. Un compañero al lado va levantando dedos y hay que decir el número en voz alta. Se alterna: pase de pecho, picado contra la pared y pase con una mano. Treinta segundos por tipo.',
    notas: 'Puntos clave: se recibe con las manos preparadas por delante, no pegadas al cuerpo; el pase sale y vuelve sin que los pies se muevan del sitio. Error frecuente: acercarse a la pared cuando aumenta el ritmo, con lo que deja de ser un pase. Marca la distancia con un cono. Si no hay pared disponible, se hace por parejas y funciona igual de bien.',
    tags: ['pase', 'recepción', 'coordinación', 'cabeza levantada', 'analítico'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'pasar de pecho y recibir con las dos manos sin que se caiga',
      dosis: { series: 3, cantidad: 30, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: los doce a la vez contra la pared o la valla, separados metro y medio para no invadirse.',
      niveles: {
        base: 'solo pase de pecho, sin números, quince segundos.',
        intermedio: 'tres tipos de pase con números.',
        avanzado: 'dos balones alternos contra la pared.',
      },
      criterio_exito: 'treinta segundos sin que el balón toque el suelo y acertando todos los números',
      aplicacion: 'el rondo 4c2, donde esa misma velocidad de manos se usa con gente encima',
    },
    tablero: () => [
      // El que canta los números es compañero, no defensor.
      jug('A', 1, 0.30, 0.30), jug('A', 3, 0.36, 0.30),
      jug('A', 2, 0.30, 0.70), jug('A', 4, 0.36, 0.70),
      balon(0.30, 0.30), balon(0.30, 0.70),
    ],
    intent: null,
  },
  {
    name: 'Bote sentado y de rodillas',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 2, duration_min: 4, duration_max: 6,
    description: 'Botar sentado, de rodillas y tumbado: sin piernas, todo el control depende de la muñeca y los dedos.',
    objetivos: 'Aislar el gesto de la muñeca y las yemas, que es lo que de verdad controla el balón.',
    descripcion_texto: 'Cada uno con su balón. Se bota sentado en el suelo con las piernas estiradas, luego de rodillas, luego tumbado boca arriba pasando el balón por encima. Veinte segundos en cada posición, alternando manos. Al terminar, treinta segundos de pie para notar la diferencia.',
    notas: 'Puntos clave: sin poder usar las piernas, el bote sale de la muñeca y de las yemas, nunca de la palma; ahí se ve quién golpea el balón y quién lo acompaña. Este es un caso donde el aislamiento SÍ se justifica: el objetivo es sentir el gesto, y por eso dura cuatro minutos y no veinte. Que quede claro en el orden de la sesión: esto abre, no ocupa.',
    tags: ['bote', 'coordinación', 'mano no dominante', 'analítico', 'calentamiento'],
    requisitos: {
      jugadores_min: 1, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'botar el balón en el sitio con cualquiera de las dos manos',
      dosis: { series: 3, cantidad: 60, unidad: 'segundos', descanso: 20 },
      organizacion: 'Con 12: los doce a la vez, un balón cada uno, en dos filas a lo ancho para que el entrenador los vea a todos de frente.',
      niveles: {
        base: 'sentado y de rodillas, mano dominante.',
        intermedio: 'las tres posiciones alternando manos.',
        avanzado: 'sentado con dos balones a la vez.',
      },
      criterio_exito: 'mantener el bote los sesenta segundos en todas las posiciones sin perder el balón',
      aplicacion: 'el bote de protección, donde ese mismo control bajo con la muñeca es lo único que salva el balón',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.28), jug('A', 2, 0.34, 0.50), jug('A', 3, 0.34, 0.72),
      jug('A', 4, 0.52, 0.28), jug('A', 5, 0.52, 0.50),
      balon(0.34, 0.28), balon(0.34, 0.50), balon(0.34, 0.72), balon(0.52, 0.28), balon(0.52, 0.50),
    ],
    intent: null,
  },

  /* ═══ REBOTE ═══════════════════════════════════════════════ */
  {
    name: 'Rebote a dos manos y salida',
    type: 'Defensa', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Coger el rebote con las dos manos en el aire, caer con las piernas abiertas y proteger antes de pasar.',
    objetivos: 'Asegurar el rebote, que es lo que más se pierde: la mitad de los rebotes cogidos se pierden en el segundo siguiente.',
    descripcion_texto: 'El entrenador o un compañero lanza el balón al tablero. El jugador salta, lo coge con las DOS manos en el punto más alto, cae con las piernas abiertas y los codos firmes, y solo entonces busca el pase a un compañero en la banda. Ocho repeticiones y se cambia.',
    notas: 'Puntos clave: se coge en el aire y no se espera a que bote; al caer, el balón queda a la altura de la barbilla con los codos abiertos; nada de bajarlo a la cintura, que es donde llegan las manos rivales. Error frecuentísimo: coger con una mano y perderlo. Segundo: caer con los pies juntos y perder el equilibrio con cualquier contacto.',
    tags: ['rebote defensivo', 'pase', 'equilibrio'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'saltar y coger un balón en el aire con las dos manos',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: seis parejas, tres en cada canasta, turnándose para tirar y coger.',
      niveles: {
        base: 'el balón se lanza suave y sin oposición.',
        intermedio: 'lanzamiento al tablero y salida con pase.',
        avanzado: 'un compañero intenta quitárselo al caer, sin saltar.',
      },
      criterio_exito: 'ocho de ocho cogidos con dos manos y protegidos a la altura de la barbilla al caer',
    },
    tablero: () => [
      jug('A', 1, M.poste_bajo_der[0] + 0.04, M.poste_bajo_der[1]),
      jug('A', 2, M.alero_der[0], M.alero_der[1]),
      balon(M.tiro_libre[0], M.tiro_libre[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
      ],
    },
  },
  {
    name: 'Rebote en superioridad',
    type: 'Defensa', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Dos atacantes contra un defensor al rebote: el que bloquea tiene que elegir a quién y aceptar que el otro va libre.',
    objetivos: 'Decidir a quién bloquear cuando no se puede bloquear a todos, que es lo que pasa siempre en el rebote real.',
    descripcion_texto: 'Un defensor bajo el aro y dos atacantes en el perímetro. El entrenador tira. El defensor tiene que elegir a cuál bloquear —el que esté en mejor posición para el rebote— y hacerlo de verdad. Si el otro coge el rebote, no es un error si la elección fue correcta. Cinco tiros y rotan.',
    notas: 'Puntos clave: se bloquea al que está más cerca del lado donde va a caer el balón, que casi siempre es el lado contrario al tiro; el defensor tiene que cantar en voz alta a quién bloquea. Error del entrenador: culpar al defensor porque el otro cogió el rebote. Lo que se evalúa es la ELECCIÓN, no el resultado, y conviene decírselo a ellos.',
    tags: ['rebote defensivo', 'bloqueo de rebote', 'lectura', 'toma de decisiones', 'inferioridad'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'hacer contacto de bloqueo con el cuerpo antes de ir al balón',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: un defensor, dos atacantes y tres esperando que rotan cada cinco tiros.',
      niveles: {
        base: 'los dos atacantes están fijos y el tiro sale siempre del mismo sitio.',
        intermedio: 'atacantes móviles y tiro variable.',
        avanzado: 'dos defensores contra tres atacantes.',
      },
      criterio_exito: 'la elección de a quién bloquear es la correcta en cuatro de cada cinco tiros',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.tiro_libre[0] - 0.08, M.tiro_libre[1]),
      jug('A', 3, M.base[0], M.base[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A3', tipo: 'tiro', hacia: 'canasta' }] },
        /* Los DOS atacantes van al rebote —esa es la elección que tiene
           que hacer el defensor—; antes A1 se quedaba clavado y no se
           entendía a qué elegía B1. Y el rebote lo coge A2, el que se
           queda sin bloquear: es literalmente lo que dice la ficha ("si
           el otro coge el rebote, no es un error"). */
        {
          eventos: [
            { jugador: 'A1', tipo: 'corte', hacia: { x: M.poste_bajo_der[0] + 0.05, y: M.poste_bajo_der[1] } },
            { jugador: 'A2', tipo: 'corte', hacia: 'canasta' },
            { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: M.poste_bajo_der[0] + 0.03, y: M.poste_bajo_der[1] } },
          ],
        },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
      ],
    },
  },

  /* ═══ CALENTAMIENTO ════════════════════════════════════════ */
  {
    name: 'Pases en movimiento por parejas',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Recorrer la pista por parejas pasándose el balón sin que toque el suelo y terminando en canasta.',
    objetivos: 'Activar corriendo y pasando a la vez, que sube pulsaciones y entrena el pase en carrera de paso.',
    descripcion_texto: 'Por parejas, de fondo a fondo. Se corre en paralelo separados unos cinco metros pasándose el balón sin que bote. Al llegar, entrada a canasta y se vuelve por el lado contrario. Tres idas y vueltas, cambiando quién termina.',
    notas: 'Puntos clave: el pase va DELANTE del compañero, a la altura del pecho, y sale sin frenar; la separación se mantiene, que es lo primero que se pierde. Error frecuente: acercarse el uno al otro hasta acabar corriendo juntos, con lo que el pase deja de tener valor. Marca los carriles con conos las primeras veces.',
    tags: ['calentamiento', 'activación', 'pase', 'recepción', 'carriles', 'entrada'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 2, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'pasar y recibir en carrera sin frenar',
      dosis: { series: 2, cantidad: 3, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: seis parejas recorriendo la pista a lo largo, saliendo escalonadas cada cinco segundos y terminando en las dos canastas.',
      niveles: {
        base: 'media pista, pases de pecho, sin terminar en canasta.',
        intermedio: 'pista entera con entrada final.',
        avanzado: 'pista entera con tres jugadores y el balón cruzando en zigzag.',
      },
      criterio_exito: 'completar la pista entera sin que el balón toque el suelo ni una vez',
      aplicacion: 'el contraataque de tres carriles, que es lo mismo con defensa delante',
    },
    tablero: () => [
      jug('A', 1, E.escolta_izq[0], 0.88), jug('A', 2, E.escolta_der[0], 0.88),
      balon(E.escolta_izq[0], 0.88),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'centro' }, { jugador: 'A1', tipo: 'corte', hacia: 'alero_izq' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        /* Un calentamiento de pases y carrera termina EN CANASTA, no con
           un tiro desde el alero: así salía a 9,3 m del aro, el tiro más
           largo de toda la biblioteca, y en el bloque de calentamiento. */
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Cadena de nombres',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 3, duration_min: 4, duration_max: 8,
    description: 'Pasarse el balón en un orden fijo diciendo el nombre de quien recibe, mientras todos se desplazan sin parar.',
    objetivos: 'Activar mirando y hablando, que además arranca la sesión con el grupo comunicándose.',
    descripcion_texto: 'Todos moviéndose por el espacio. Se establece un orden fijo de pase —cada uno pasa siempre al mismo compañero— y hay que decir su nombre al pasarle. Nadie puede parar de moverse. Cuando la cadena funciona, se mete un segundo balón, y luego un tercero.',
    notas: 'Puntos clave: como todos se mueven, hay que buscar al de tu cadena con la vista mientras te desplazas; decir el nombre no es un adorno, es lo que avisa al que va a recibir. Error frecuente: pararse a pasar. El segundo balón es donde empieza el ejercicio de verdad. Es también un buen momento para que los nuevos aprendan los nombres del grupo.',
    tags: ['calentamiento', 'activación', 'pase', 'recepción', 'coordinación'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'media', oposicion: 'nula', presion: 'espacio',
      requisito_previo: 'pasar y recibir en movimiento',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: los doce en un solo círculo. Con más de dieciséis se parte en dos, porque la espera se hace larga.',
      niveles: {
        base: 'en círculo y sin moverse, con un balón.',
        intermedio: 'moviéndose, con dos balones.',
        avanzado: 'tres balones y dos cadenas distintas a la vez.',
      },
      criterio_exito: 'sostener dos balones en la cadena durante noventa segundos sin pérdidas',
    },
    tablero: () => [
      jug('A', 1, 0.32, 0.30), jug('A', 2, 0.32, 0.70), jug('A', 3, 0.48, 0.24),
      jug('A', 4, 0.48, 0.76), jug('A', 5, 0.60, 0.50), jug('A', 6, 0.40, 0.50),
      balon(0.32, 0.30), balon(0.48, 0.76),
    ],
    intent: null,
  },

  /* ═══ PSICOMOTRICIDAD ══════════════════════════════════════ */
  {
    name: 'Saltar los ríos',
    type: 'Calentamiento', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela'],
    difficulty: 1, intensidad: 3, duration_min: 4, duration_max: 8,
    description: 'Recorrido de saltos entre líneas de conos, con el balón en las manos y cayendo siempre equilibrado.',
    objetivos: 'Trabajar el salto, la caída y el equilibrio con el balón, que es la base de todo lo que vendrá después.',
    descripcion_texto: 'Cuatro "ríos" marcados con dos líneas de conos cada uno, de anchura creciente. Se recorren saltando: el primero a pies juntos, el segundo con un pie, el tercero cayendo a pies juntos desde un pie, el cuarto lo más ancho posible. Siempre con el balón sujeto con las dos manos y aguantando la caída tres segundos.',
    notas: 'Puntos clave: la caída es lo que se entrena, no el salto — rodillas flexionadas y quieto tres segundos; el balón no se usa para equilibrarse moviendo los brazos. Error frecuente: caer y dar un pasito, que en baloncesto son pasos. En Escuela hay que aceptar que muchos no caerán equilibrados: por eso está aquí. Cuida el suelo y la separación entre niños.',
    tags: ['equilibrio', 'coordinación', 'ritmo', 'lateralidad'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'media', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'saltar y caer con los dos pies sin apoyar las manos',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 40 },
      organizacion: 'Con 12: dos recorridos en paralelo de seis, para que nadie espere su turno más de dos saltos.',
      niveles: {
        base: 'dos ríos estrechos, salto a pies juntos, sin balón.',
        intermedio: 'los cuatro ríos con balón.',
        avanzado: 'los cuatro ríos con giro de 180 grados en el aire en el último.',
      },
      criterio_exito: 'aguantar tres segundos quieto en las cuatro caídas, sin dar pasitos',
      aplicacion: 'la entrada a canasta, donde el doble ritmo es exactamente un salto y una caída controlada',
    },
    tablero: () => [
      jug('A', 1, 0.64, 0.30), jug('A', 2, 0.64, 0.70),
      cono(0.56, 0.24), cono(0.52, 0.24), cono(0.44, 0.24), cono(0.38, 0.24),
      cono(0.56, 0.76), cono(0.52, 0.76), cono(0.44, 0.76), cono(0.38, 0.76),
      balon(0.64, 0.30), balon(0.64, 0.70),
    ],
    intent: null,
  },
  {
    name: 'Los cuatro rincones',
    type: 'Calentamiento', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela', 'Benjamín'],
    difficulty: 1, intensidad: 4, duration_min: 4, duration_max: 8,
    description: 'Cuatro rincones con una forma de desplazarse cada uno: al oír el rincón, hay que llegar como toque.',
    objetivos: 'Asociar una orden a un patrón motor distinto y cambiarlo sobre la marcha, con el balón siempre en las manos.',
    descripcion_texto: 'Cuatro rincones marcados: en el primero se llega corriendo de frente, en el segundo de espaldas, en el tercero de lado deslizándose y en el cuarto a la pata coja. El entrenador dice el número y todos van con el desplazamiento que le toca a ese rincón, botando o llevando el balón según se diga.',
    notas: 'Puntos clave: cada desplazamiento tiene su forma correcta y hay que exigirla —el lateral sin cruzar los pies, el de espaldas mirando por encima del hombro—; lo que se entrena es asociar orden y patrón. Error frecuente: ir a todos los rincones corriendo de frente porque es más fácil. Si pasa, quita un rincón y quédate con tres bien hechos.',
    tags: ['lateralidad', 'coordinación', 'ritmo', 'equilibrio', 'desplazamiento defensivo'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'correr y desplazarse lateralmente sin caerse',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: los doce a la vez, tres en cada rincón.',
      niveles: {
        base: 'tres rincones y sin balón.',
        intermedio: 'cuatro rincones llevando el balón.',
        avanzado: 'cuatro rincones botando, y el entrenador puede decir dos seguidos que hay que recordar.',
      },
      criterio_exito: 'usar el desplazamiento correcto en nueve de cada diez órdenes',
      aplicacion: 'el espejo defensivo, que es el mismo desplazamiento lateral pero ya con un rival delante',
    },
    tablero: () => [
      jug('A', 1, 0.42, 0.40), jug('A', 2, 0.42, 0.60), jug('A', 3, 0.50, 0.50),
      cono(0.30, 0.26), cono(0.30, 0.74), cono(0.60, 0.26), cono(0.60, 0.74),
      balon(0.42, 0.40), balon(0.42, 0.60), balon(0.50, 0.50),
    ],
    intent: null,
  },
  {
    name: 'El balón que no se cae',
    type: 'Calentamiento', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela'],
    difficulty: 1, intensidad: 2, duration_min: 4, duration_max: 6,
    description: 'Llevar el balón apoyado en distintas partes del cuerpo mientras se camina, sin sujetarlo con las manos.',
    objetivos: 'Conciencia corporal y equilibrio con un objeto, que es lo que sostiene después todo el manejo.',
    descripcion_texto: 'Se camina por el espacio llevando el balón como diga el entrenador: entre las rodillas, sobre la cabeza sin manos, en la espalda con las manos por detrás, sujeto con el codo y el costado. Si se cae, se recoge y se sigue. Sin prisa y sin competir.',
    notas: 'Puntos clave: no hay velocidad, hay control; el niño tiene que notar dónde está el balón sin mirarlo. Es de los pocos ejercicios donde el balón no se bota, y tiene sentido justo en Escuela: primero saber que existe el balón y dónde está el propio cuerpo. Error del entrenador: convertirlo en carrera. Si se convierte en carrera, deja de servir.',
    tags: ['equilibrio', 'coordinación', 'lateralidad'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'media', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'caminar sosteniendo un balón con las dos manos',
      dosis: { series: 3, cantidad: 60, unidad: 'segundos', descanso: 20 },
      organizacion: 'Con 12: los doce a la vez, un balón cada uno, repartidos por una media pista.',
      niveles: {
        base: 'dos formas de llevarlo, andando despacio.',
        intermedio: 'cuatro formas.',
        avanzado: 'cuatro formas con recorrido entre conos y cambio a la orden.',
      },
      criterio_exito: 'completar cada forma sin que el balón se caiga más de dos veces',
      aplicacion: 'todo el bloque de manejo: es el paso previo a controlar el balón botando',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.30), jug('A', 2, 0.34, 0.70), jug('A', 3, 0.52, 0.30), jug('A', 4, 0.52, 0.70),
      balon(0.34, 0.30), balon(0.34, 0.70), balon(0.52, 0.30), balon(0.52, 0.70),
    ],
    intent: null,
  },
];
