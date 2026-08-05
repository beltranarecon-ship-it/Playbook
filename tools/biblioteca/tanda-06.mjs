/* ============================================================
   tanda-06.mjs — profundizar donde más falta: juego reducido, tiro,
   bote, 1c1 y defensa.

   Ya no hay bloques vacíos, así que a partir de aquí el trabajo no es
   cubrir sino DAR PROFUNDIDAD: variantes de formato, restricciones
   distintas y situaciones que el bloque todavía no tenía.

   D6 manda en el juego reducido: 1c1 y 2c2 son los formatos de más
   densidad técnica, 3c3 el mejor equilibrio, y el 5c5 la herramienta
   que menos enseña. Por eso esta tanda engorda los formatos pequeños
   y no toca el 5c5.
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_06 = [

  /* ═══ JUEGO REDUCIDO ═══════════════════════════════════════ */
  {
    name: '2c2 con comodín',
    type: '2vs2', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 15,
    description: 'Dos contra dos con un jugador neutral que siempre juega con quien ataca: superioridad permanente.',
    objetivos: 'Jugar siempre con ventaja para que aparezcan el pase extra y la ocupación de espacios, en lugar del uno contra uno constante.',
    descripcion_texto: 'Dos contra dos en media pista más un comodín que juega con el equipo que tenga el balón, pero que no puede tirar. Cuando cambia la posesión, el comodín cambia de bando. Se juega a cinco canastas. El comodín rota cada dos canastas para que todos pasen por ese papel.',
    notas: 'Puntos clave: el comodín tiene que ocupar el espacio que dejan los otros dos, no acercarse al balón; como no puede tirar, se convierte en el que da el pase bueno. Error frecuente: los dos atacantes le usan de pared y siguen jugando 1c1 igual. Si pasa, prohíbe devolver el balón a quien te lo dio. Este es el ejercicio que más rápido enseña qué es una ventaja de tres contra dos.',
    tags: ['juego reducido', 'superioridad', 'espaciado', 'pase', 'toma de decisiones', 'ventaja'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'pasar y recibir en movimiento con un defensor cerca',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: 2c2 más comodín y uno que espera para entrar de comodín en la siguiente.',
      niveles: {
        base: 'el comodín se coloca fijo en la punta y solo recibe y devuelve.',
        intermedio: 'comodín móvil que no puede tirar.',
        avanzado: 'el comodín puede tirar solo desde fuera de la zona, con lo que la defensa ya no puede ignorarle.',
      },
      criterio_exito: 'al menos la mitad de las canastas llegan tras pase del comodín o del compañero, no de un uno contra uno',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0], M.escolta_izq[1]), jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_izq[0] - 0.05, M.escolta_izq[1]), jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('C', 1, M.base[0], M.base[1]),
      balon(M.escolta_izq[0], M.escolta_izq[1]),
    ],
    intent: null,
  },
  {
    name: '3c3 con transición',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 10, duration_max: 20,
    description: 'Tres contra tres a pista entera y sin pausas: quien coge el rebote ataca la otra canasta inmediatamente.',
    objetivos: 'Encadenar ataque, defensa y transición sin la pausa que da la media pista, que es como se juega de verdad.',
    descripcion_texto: 'Tres contra tres en pista entera. No hay saques: tras canasta o rebote, el equipo que tiene el balón ataca la canasta contraria directamente. Se juega cuatro minutos seguidos, y hay dos tríos esperando que entran cada dos minutos. La transición es la mitad del ejercicio.',
    notas: 'Puntos clave: en cuanto cambia la posesión, el primero que reaccione manda; el balance defensivo empieza al tirar, no al fallar. Error frecuente: celebrar la canasta y quedarse parado, con lo que el rival ya está corriendo. Ojo con la carga: cuatro minutos de esto son muy exigentes y la calidad cae en el último. Mejor tres minutos bien que cinco arrastrándose.',
    tags: ['juego reducido', 'transición', 'contraataque', 'balance defensivo', 'competición', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'defender individualmente y correr el contraataque por carriles',
      dosis: { series: 3, cantidad: 180, unidad: 'segundos', descanso: 120 },
      organizacion: 'Con 12: cuatro equipos de tres en pista entera. Juegan dos y los otros dos esperan al fondo; entran en cuanto hay canasta.',
      niveles: {
        base: '3c3 en media pista con saque tras canasta.',
        intermedio: 'pista entera sin saques, cuatro minutos.',
        avanzado: 'pista entera y la canasta en transición vale doble.',
      },
      criterio_exito: 'nadie se queda parado tras una canasta en ninguna de las transiciones',
    },
    tablero: () => [
      jug('A', 1, E.base[0], 0.60), jug('A', 2, E.alero_izq[0], 0.50), jug('A', 3, E.alero_der[0], 0.50),
      jug('B', 1, E.base[0], 0.40), jug('B', 2, E.escolta_izq[0], E.escolta_izq[1]), jug('B', 3, E.escolta_der[0], E.escolta_der[1]),
      balon(E.base[0], 0.60),
    ],
    intent: null,
  },
  {
    name: 'El rey de la pista',
    type: '1vs1', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 8, duration_max: 15,
    description: 'Uno contra uno encadenado: quien gana se queda y entra el siguiente de la fila, sin descanso.',
    objetivos: 'Competir en uno contra uno con fatiga acumulada, que es cuando se ve quién resuelve de verdad.',
    descripcion_texto: 'Una fila de retadores. El rey defiende la canasta; el retador ataca. Si el retador anota, se convierte en rey y el anterior va al final de la fila. Si falla o le roban, el rey sigue. Una sola posesión por duelo. El rey no descansa nunca, y ahí está la gracia.',
    notas: 'Puntos clave: como rey, con cansancio hay que defender con los pies y no con las manos, que es cuando llegan las faltas; como retador, el rey está cansado y hay que atacarle rápido y no dejarle respirar. Error del entrenador: dejar que un rey se eternice. Si alguien lleva cinco seguidas, mételo a la fila y que empiece otro. Filas de cuatro o cinco como mucho (D5).',
    tags: ['1c1', 'juego reducido', 'competición', 'defensa individual', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'resolver el uno contra uno con bote y defender individualmente',
      dosis: { series: 3, cantidad: 240, unidad: 'segundos', descanso: 90 },
      organizacion: 'Con 12: dos reinos, uno en cada canasta, seis en cada uno: el rey y cinco retadores en fila. Así nadie espera más de cuatro duelos seguidos.',
      niveles: {
        base: 'dos posesiones por duelo y el rey descansa cada tres.',
        intermedio: 'una posesión, el rey no descansa.',
        avanzado: 'el retador entra corriendo desde medio campo con el balón, sin pausa entre duelos.',
      },
      criterio_exito: 'nadie defiende con las manos por cansancio: si llegan las faltas, se para y se descansa',
    },
    tablero: () => [
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      fila(M.base[0] + 0.06, M.base[1], 4, 0),
      balon(M.base[0] + 0.06, M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        /* Se dibuja el duelo entero con una de las dos salidas que
           permite la ficha —el retador falla y va al final de la fila—,
           porque la otra (anota y se queda de rey) deja al balón parado
           en el aro y no se entiende que el ejercicio no para. */
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'aro' }, { jugador: 'B1', tipo: 'defiende', marca: 'fila1' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: '4c4 con zonas de puntuación',
    type: '4vs4', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 10, duration_max: 20,
    description: 'Cuatro contra cuatro donde solo cuenta la canasta anotada desde las zonas marcadas: la regla dirige el ataque.',
    objetivos: 'Dirigir dónde se ataca sin decirlo, obligando a mover el balón hasta encontrar las zonas buenas.',
    descripcion_texto: 'Cuatro contra cuatro en media pista con dos zonas marcadas con conos: las dos esquinas. La canasta anotada desde una esquina vale 3; desde cualquier otro sitio, 1. Como las esquinas están lejos del balón inicial, hay que mover el balón de lado a lado. Se juega a siete.',
    notas: 'Puntos clave: para que el balón llegue a la esquina hay que invertir el lado, y eso obliga a que alguien ocupe la esquina antes; el que ataca la zona tiene que llegar antes que el balón. Error frecuente: todos se van a las esquinas y se vacía el centro, con lo que la defensa se junta. Es el ejemplo de cómo la puntuación enseña más rápido que la explicación.',
    tags: ['juego reducido', 'espaciado', 'competición', 'pase', 'toma de decisiones', 'lectura'],
    requisitos: {
      jugadores_min: 8, jugadores_max: 16, canastas: 1, estaciones: 2,
      material: ['balones', 'petos', 'conos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'pasar y recibir bajo presión y defender individualmente a un par',
      dosis: { series: 3, cantidad: 7, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos, uno de ocho jugando 4c4 en una canasta y otro de cuatro jugando 2c2 en la otra. Se cambian a la mitad del tiempo.',
      niveles: {
        base: '3c3 y una sola zona de puntuación.',
        intermedio: '4c4 y las dos esquinas.',
        avanzado: '4c4, dos esquinas y la canasta desde esquina solo cuenta si llega tras dos pases o más.',
      },
      criterio_exito: 'la mayoría de los puntos llegan desde las zonas marcadas y tras haber invertido el lado',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.alero_der[0], M.alero_der[1]),
      jug('A', 3, M.alero_izq[0], M.alero_izq[1]), jug('A', 4, M.codo_der[0], M.codo_der[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]), jug('B', 2, M.alero_der[0] - 0.05, M.alero_der[1]),
      jug('B', 3, M.alero_izq[0] - 0.05, M.alero_izq[1]), jug('B', 4, M.codo_der[0] - 0.05, M.codo_der[1]),
      cono(M.esquina_der[0], M.esquina_der[1]), cono(M.esquina_izq[0], M.esquina_izq[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },

  /* ═══ TIRO ═════════════════════════════════════════════════ */
  {
    name: 'Tiro tras corte',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Cortar al aro, no recibir, salir al lado contrario y tirar allí: el tiro que llega después de moverse.',
    objetivos: 'Tirar con las piernas cansadas de haberse movido, que es como llega la mayoría de los tiros en un partido.',
    descripcion_texto: 'Pasador en la punta. El tirador corta desde el 45 hacia el aro, no recibe, sigue hasta el lado contrario y allí recibe y tira. Un defensor le acompaña sin llegar a impedir el tiro. Cinco por lado y se rota.',
    notas: 'Puntos clave: se llega al punto de tiro con los pies ya listos, lo que exige frenar un paso antes; el balón se pide con las dos manos al llegar. Error frecuente: llegar y tirar en carrera, sin equilibrio, porque no se ha preparado la parada. Otro: cortar sin intención, paseando — si el corte no amenaza, el tiro tampoco existiría en un partido.',
    tags: ['tiro', 'tiro tras recepción', 'corte', 'desmarque', 'parada'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'tirar tras recepción con los pies orientados al aro',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, cortador y defensor. Cinco por lado y se rota.',
      niveles: {
        base: 'sin defensor y sin corte, solo desplazarse y tirar.',
        intermedio: 'con corte completo y defensor que acompaña.',
        avanzado: 'el defensor puede impedir el tiro, y entonces hay que botar y buscar otra cosa.',
      },
      criterio_exito: 'llegar equilibrado y con los pies listos en cuatro de cada cinco tiros',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'escolta_izq' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Duelo de tiro por equipos',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Dos equipos tirando a la vez desde el mismo punto contra el reloj: el primero en llegar a diez canastas gana.',
    objetivos: 'Sostener la mecánica con prisa y con el ruido de la competición alrededor.',
    descripcion_texto: 'Dos equipos, cada uno con su balón y su reboteador, tirando desde el mismo punto por turnos. El primer equipo que llegue a diez canastas gana la ronda. Tres rondas desde tres puntos distintos. Quien tira coge su rebote y pasa al siguiente de su equipo.',
    notas: 'Puntos clave: la prisa se gestiona teniendo la rutina automatizada; el que rebotea marca el ritmo de su equipo, y si pasa mal hunde a los suyos. Error frecuente: tirar antes de estar equilibrado por ir ganando o perdiendo. Si ves que la técnica se rompe en las rondas de competición, vuelve un día a las series analíticas: significa que el gesto aún no está instalado.',
    tags: ['tiro', 'competición', 'mecánica de tiro', 'tiro tras recepción'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'anotar desde dos metros con la mecánica estable',
      dosis: { series: 3, cantidad: 10, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos equipos de seis, uno en cada canasta, y se comparan los aciertos al terminar.',
      niveles: {
        base: 'sin reloj ni equipo contrario, solo contar aciertos por equipo.',
        intermedio: 'duelo a diez canastas.',
        avanzado: 'duelo a diez pero cada fallo resta uno, con lo que la prisa se paga.',
      },
      criterio_exito: 'llegar a diez canastas sin que el gesto se convierta en empujón',
    },
    tablero: () => [
      jug('A', 1, M.codo_der[0], M.codo_der[1]), jug('A', 2, M.poste_bajo_der[0] + 0.04, M.poste_bajo_der[1]),
      jug('B', 1, M.codo_izq[0], M.codo_izq[1]), jug('B', 2, M.poste_bajo_izq[0] + 0.04, M.poste_bajo_izq[1]),
      // Con id propio porque la intención los nombra: los dos acaban en
      // el mismo aro, y sin nombrarlos los dos reboteadores irían a por
      // el mismo balón.
      balon(M.codo_der[0], M.codo_der[1], 'balon_der'), balon(M.codo_izq[0], M.codo_izq[1], 'balon_izq'),
    ],
    /* El ciclo entero, que es lo que hace que el ejercicio no pare:
       tiro — el reboteador coge SU balón — se lo devuelve al siguiente.
       Los dos equipos a la vez, porque compiten a la vez. */
    intent: {
      canasta: 'norte',
      balones: [{ id: 'balon_der', portador: 'A1' }, { id: 'balon_izq', portador: 'B1' }],
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'tiro' },
          { jugador: 'B1', tipo: 'tiro' },
        ] },
        { eventos: [
          { jugador: 'A2', tipo: 'recoge', balon_id: 'balon_der' },
          { jugador: 'B2', tipo: 'recoge', balon_id: 'balon_izq' },
        ] },
        { eventos: [
          { jugador: 'A2', tipo: 'pase', a: 'A1' },
          { jugador: 'B2', tipo: 'pase', a: 'B1' },
        ] },
      ],
    },
  },
  {
    name: 'Tiro desde el lateral en carrera',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Recibir corriendo desde la banda y parar para tirar desde el lateral, con un perseguidor detrás y el tablero que engaña.',
    objetivos: 'Tirar desde el ángulo lateral, que se practica poco y aparece constantemente en el juego, y hacerlo con alguien llegando.',
    descripcion_texto: 'Fila en la banda a la altura del tiro libre. Se corre hacia el aro recibiendo del pasador de la punta, se para en dos tiempos a la altura del poste alto y se tira desde ahí. Un defensor persigue desde atrás y llega a molestar sin saltar. Cinco por lado. El pasador cambia cada cinco.',
    notas: 'Puntos clave: desde el lateral el tablero ya casi no ayuda, así que hay que tirar limpio y con más arco; los hombros se abren al aro durante la parada. Error frecuente: buscar tablero desde un ángulo donde no existe, que hace que el balón salga disparado. Segundo: parar de lado y tirar girando el tronco. Este tiro es de los que más se falla y de los que menos se entrena.',
    tags: ['tiro', 'tiro tras recepción', 'parada', 'recepción', 'mecánica de tiro'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'parar en dos tiempos tras recibir en carrera',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una por canasta: fila de cuatro en la banda, un pasador y un defensor. El pasador cambia cada cinco tiros.',
      niveles: {
        base: 'sin perseguidor ni pase, tirando desde parado en ese punto.',
        intermedio: 'recepción en carrera, parada y perseguidor que llega.',
        avanzado: 'el perseguidor puede impedir el tiro, y entonces hay que meter un bote hacia el centro antes de tirar.',
      },
      criterio_exito: 'tres de cada cinco dentro, y ninguna tocando el tablero de lado',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      fila(M.alero_der[0] + 0.08, M.alero_der[1], 4, 180),
      jug('B', 1, M.alero_der[0] + 0.04, M.alero_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'corte', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'fila1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'fila1' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },

  /* ═══ BOTE ═════════════════════════════════════════════════ */
  {
    name: 'Salir de la trampa',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Dos defensores atrapan al que bota en una esquina: hay que salir botando o encontrar el pase.',
    objetivos: 'Resolver la trampa sin perder el balón, que es la situación en que más balones se pierden en minibasket.',
    descripcion_texto: 'El atacante bota hacia una esquina y dos defensores le atrapan. Tiene cinco segundos para salir botando por el hueco o pasar a un compañero situado en el centro. No vale quedarse parado botando. Tres intentos y rotan los cuatro papeles.',
    notas: 'Puntos clave: se sale por donde los dos defensores no se han juntado del todo, casi siempre por abajo; si no hay hueco, el pase sale por encima y al centro, nunca por la banda. Error frecuentísimo: recoger el balón al ver llegar a los dos, con lo que ya no puede botar y la trampa funciona. Regla: "el balón no se coge dentro de la trampa".',
    tags: ['bote de protección', 'bote', 'pase', 'toma de decisiones', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'botar protegiendo con el cuerpo y pasar sin botar antes',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: tres grupos de cuatro repartidos por la pista, sin canastas. Dentro de cada grupo se rota atacante cada dos salidas.',
      niveles: {
        base: 'un solo defensor y el compañero muy cerca.',
        intermedio: 'dos defensores y compañero en el centro.',
        avanzado: 'dos defensores y el compañero también defendido.',
      },
      criterio_exito: 'salir de la trampa sin perder el balón en dos de cada tres intentos',
    },
    tablero: () => [
      jug('A', 1, M.esquina_der[0], M.esquina_der[1]),
      jug('A', 2, M.tiro_libre[0], M.tiro_libre[1]),
      jug('B', 1, M.esquina_der[0] - 0.05, M.esquina_der[1] - 0.02),
      jug('B', 2, M.esquina_der[0] + 0.02, M.esquina_der[1] - 0.06),
      balon(M.esquina_der[0], M.esquina_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'B1', tipo: 'defiende', marca: 'A1' }, { jugador: 'B2', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Bote y pase al que aparece',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Botar con un defensor delante mientras dos compañeros aparecen y desaparecen: hay que ver y pasar sin parar el bote.',
    objetivos: 'Mantener el bote vivo mientras se lee el campo, en vez de botar mirando al suelo y luego levantar la cabeza.',
    descripcion_texto: 'El atacante bota en el perímetro con un defensor encima. Dos compañeros se mueven por detrás de la línea, apareciendo y tapándose alternativamente. Cuando uno levanta la mano, hay que pasarle sin haber parado de botar. Cinco pases y rota.',
    notas: 'Puntos clave: el bote se mantiene bajo y protegido mientras la vista está arriba; el pase sale desde el bote, sin recoger el balón primero. Error frecuente: recoger el balón para pasar, que en un partido significa quedarse sin bote y perderlo. Otro: mirar al compañero fijamente antes de pasar, que se lo dice al defensor.',
    tags: ['bote', 'cabeza levantada', 'pase', 'lectura', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'botar con la cabeza levantada sin perder el balón',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: tres grupos de cuatro repartidos por la pista. Cinco pases y rota el que bota.',
      niveles: {
        base: 'sin defensor, con un solo compañero apareciendo.',
        intermedio: 'con defensor y dos compañeros.',
        avanzado: 'con defensor y hay que pasar al compañero que NO levanta la mano, para obligar a mirar a los dos.',
      },
      criterio_exito: 'los cinco pases salen desde el bote, sin recoger el balón antes',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]), jug('A', 3, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        /* Los DOS compañeros se mueven "apareciendo y tapándose
           alternativamente": esa alternancia es el ejercicio. Antes A2 no
           se movía y no había nada que leer — el pase iba al único que
           existía. Y no hay tiro: la ficha termina en el pase ("cinco
           pases y rota"), no en canasta. */
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        {
          eventos: [
            { jugador: 'A3', tipo: 'corte', hacia: 'alero_izq' },
            { jugador: 'A2', tipo: 'corte', hacia: 'esquina_der' },
          ],
        },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A3' }] },
      ],
    },
  },

  /* ═══ 1c1 ══════════════════════════════════════════════════ */
  {
    name: '1c1 desde el poste alto',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Recibir de cara en el poste alto, con la zona vacía por delante y el defensor entre tú y el aro.',
    objetivos: 'Atacar de frente desde el poste alto, que es la posición con más opciones y la que menos se practica.',
    descripcion_texto: 'Pasador en la punta, atacante en el poste alto de cara al aro y defensor detrás. Al recibir, el atacante puede tirar, entrar por cualquiera de los dos lados o fintar y salir. Máximo dos botes. Tres posesiones y rotan.',
    notas: 'Puntos clave: se recibe de CARA, no de espaldas, lo que exige girar antes de que llegue el balón; desde ahí el aro está a la misma distancia por los dos lados y por eso el defensor lo tiene difícil. Error frecuente: recibir de espaldas por costumbre y perder todas las opciones de golpe. Es la posición desde la que más fácil es enseñar que fintar sirve para algo.',
    tags: ['1c1', 'recepción', 'finta', 'toma de decisiones', 'tiro tras recepción', 'ventaja'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'recibir orientado al aro y salir en bote por los dos lados',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, atacante y defensor.',
      niveles: {
        base: 'recibir de cara y solo tirar.',
        intermedio: 'tirar, entrar o fintar, con dos botes.',
        avanzado: 'además hay un segundo defensor que puede ayudar desde el poste bajo, con lo que aparece el pase.',
      },
      criterio_exito: 'recibir siempre de cara, en tres de cada tres posesiones',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.tiro_libre[0], M.tiro_libre[1]),
      jug('B', 1, M.tiro_libre[0] - 0.05, M.tiro_libre[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'poste_bajo_izq' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: '1c1 con ayuda que llega',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 5, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Uno contra uno normal, pero si el atacante gana la posición aparece una ayuda: hay que decidir entre seguir o pasar.',
    objetivos: 'Aprender que ganar el uno contra uno no es el final: lo que viene después es la decisión importante.',
    descripcion_texto: 'Atacante y defensor en el 45, más un compañero en la esquina contraria con su propio defensor esperando en el poste bajo. Cuando el atacante supera a su par, el defensor del poste sale a ayudar. El atacante decide: terminar o pasar al de la esquina, que ahora está libre. Tres cada uno.',
    notas: 'Puntos clave: se mira la ayuda mientras se bota, no después de saltar; el pase sale bajo y rápido, casi siempre picado. Error frecuentísimo: seguir hacia el aro sin mirar y estrellarse contra la ayuda. Otro, del compañero: no moverse a la línea de pase mientras su defensor está ayudando. Es el ejercicio que conecta el 1c1 con el juego colectivo, y por eso es el más difícil de la tanda.',
    tags: ['1c1', 'ayuda', 'lectura', 'toma de decisiones', 'pase', 'ventaja'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'resolver el uno contra uno con bote y pasar desde el bote',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; entran cada tres ataques.',
      niveles: {
        base: 'la ayuda llega siempre y el pase está siempre libre.',
        intermedio: 'la ayuda decide si sale o no.',
        avanzado: 'dos ayudas posibles, con lo que hay que leer cuál sale.',
      },
      criterio_exito: 'acertar la decisión —seguir o pasar— en dos de cada tres penetraciones',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.esquina_izq[0], M.esquina_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]), jug('B', 2, M.poste_bajo_izq[0], M.poste_bajo_izq[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'B2', tipo: 'defiende', hacia: { x: M.poste_bajo_izq[0] + 0.05, y: M.poste_bajo_izq[1] } }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        /* "el de la esquina, que ahora está libre" recibe y ATACA: antes
           tiraba desde la esquina, a 6,6 m del aro. Estar libre a esa
           distancia no sirve de nada en minibasket; estar libre y poder
           atacar el aro, sí. */
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'aro' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ DEFENSA ══════════════════════════════════════════════ */
  {
    name: 'Defender sin manos',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Uno contra uno defensivo con las manos a la espalda: solo se puede defender con los pies y el cuerpo.',
    objetivos: 'Quitar la muleta de las manos para que la defensa se sostenga sobre la posición y el desplazamiento.',
    descripcion_texto: 'Uno contra uno desde el 45. El defensor lleva las manos a la espalda durante todo el ejercicio y no puede tocar el balón. Su única forma de defender es llegar antes con los pies. Punto para el defensor si el atacante no consigue tirar cómodo. Tres cada uno.',
    notas: 'Puntos clave: sin manos, la única defensa es la posición, así que hay que anticipar y no reaccionar; los pies se mueven antes de que el atacante bote. Error que este ejercicio hace desaparecer: defender manoteando, que es lo que hacen todos y lo que trae las faltas. Cuando vuelvan a defender con manos, la diferencia se nota mucho. No lo alargues: es agotador.',
    tags: ['defensa individual', 'postura defensiva', 'desplazamiento defensivo', 'defensa del bote', '1c1'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'desplazarse en postura defensiva sin cruzar los pies',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: seis parejas, tres en cada canasta, separadas para no estorbarse. Treinta segundos y cambio.',
      niveles: {
        base: 'manos a la espalda y el atacante avanza a ritmo constante sin fintas.',
        intermedio: 'manos a la espalda y atacante libre.',
        avanzado: 'manos a la espalda y dos atacantes que se pasan el balón, teniendo que defender al de balón siempre.',
      },
      criterio_exito: 'el atacante no consigue tiro cómodo en dos de cada tres ataques, sin una sola falta',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
      ],
    },
  },
  {
    name: 'Defensa de la esquina',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Defender a quien recibe en la esquina, donde la línea de fondo y la banda ya hacen de defensores.',
    objetivos: 'Aprovechar las líneas del campo: en la esquina, el atacante tiene la mitad de las salidas que en cualquier otro sitio.',
    descripcion_texto: 'Pasador en la punta, atacante en la esquina y defensor. Al llegar el pase, el defensor cierra sesgado obligando al atacante hacia la línea de fondo, donde tiene menos sitio. Punto para la defensa si consigue que termine por fondo sin tiro cómodo. Tres cada uno.',
    notas: 'Puntos clave: se cierra por el lado del centro para empujar al fondo, no de frente; en la esquina, la banda y el fondo defienden gratis y hay que usarlas. Error frecuente: cerrar de frente y dejar los dos lados abiertos, que en la esquina es regalar la mejor posición del campo. Es un concepto que se entiende de golpe cuando se dice: "la línea es un compañero".',
    tags: ['defensa individual', 'recuperación', 'desplazamiento defensivo', 'defensa del bote', 'lectura'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'cerrar a un tirador llegando frenado y en postura',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante en la esquina y defensor. Rotan.',
      niveles: {
        base: 'el atacante ataca siempre por fondo y el defensor practica el cierre sesgado.',
        intermedio: 'el atacante elige lado.',
        avanzado: 'con un compañero en el 45 al que se puede pasar, y el defensor tiene que cerrar sin abrir esa línea.',
      },
      criterio_exito: 'el atacante termina por fondo y sin tiro cómodo en dos de cada tres',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.esquina_der[0], M.esquina_der[1]),
      jug('B', 1, M.poste_bajo_der[0], M.poste_bajo_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'poste_bajo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
      ],
    },
  },
];
