/* marco: 3 */
/* ============================================================
   tanda-18.mjs — rebote, calentamiento y psicomotricidad.

   Los tres bloques pequeños que cierran el mapa. Cada uno con su
   trampa propia:

   REBOTE tiene poco volumen a propósito: se entrena mejor dentro de
   los formatos reducidos que en series aisladas. Estas tres son las
   que sí necesitan trabajo separado.

   CALENTAMIENTO va SIEMPRE con balón. En minibasket, calentar sin
   balón es tiempo de contacto que no se recupera después.

   PSICOMOTRICIDAD es el único bloque que sí se acota por categoría
   (D9 admite la excepción cuando el ejercicio es específico de la
   edad de verdad), y aquí se cierra el último contenido que quedaba
   a cero en toda la biblioteca: la percepción espacial.
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_18 = [

  /* ═══ REBOTE ═══════════════════════════════════════════════ */
  {
    name: 'El rebote es del que salta segundo',
    type: 'Defensa', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Por parejas bajo el aro: gana el balón el que aguanta sin saltar hasta que el rebote empieza a caer.',
    objetivos: 'Quitar el salto prematuro, que es por lo que se pierden la mitad de los rebotes a esta edad: se salta al tiro, no al rebote.',
    descripcion_texto: 'Por parejas junto al aro, uno con peto. El entrenador lanza al tablero. Nadie puede despegar los pies hasta que el balón toque el aro: quien salte antes, pierde el punto aunque coja el balón. Se juega a cinco rebotes por pareja y se cambian los papeles.',
    notas: 'Puntos clave: se salta cuando el balón YA está bajando hacia donde vas, no cuando sale la mano del tirador; y se sube con las dos manos y los codos fuera. Error frecuentísimo del mini: saltar con el tiro, caer, y ver cómo el balón bota a tu lado mientras estás en el suelo. La regla de no despegar los pies parece artificial y es exactamente lo que corrige el hábito: en dos sesiones esperan solos. Vigila también la caída: piernas abiertas, o el primer contacto les tira.',
    tags: ['rebote defensivo', 'rebote ofensivo', 'equilibrio', 'competición', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'coger el balón en el aire con las dos manos y caer equilibrado',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas que se turnan; las dos que esperan vigilan que nadie despegue los pies antes de tiempo.',
      niveles: {
        base: 'sin pareja: solo esperar al bote en el aro y coger el rebote.',
        intermedio: 'por parejas, con la regla de no despegar los pies.',
        avanzado: 'por parejas, sin poder despegar los pies y con el que coge el balón obligado a salir botando dos metros sin que se lo quiten.',
      },
      criterio_exito: 'cinco rebotes disputados sin ninguna salida en falso',
    },
    tablero: () => [
      jug('A', 1, 0.1654, 0.4508), jug('B', 1, 0.1654, 0.5553),
      jug('A', 2, 0.2044, 0.3637), jug('B', 2, 0.2044, 0.6424),
      balon(0.1702, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // nadie se mueve hasta que el balón toca el aro; entonces, a por él
        { eventos: [
          { jugador: 'A1', tipo: 'recoge' },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.1946, y: 0.5466 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.1848, y: 0.416 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.1848, y: 0.5988 } },
        ] },
      ],
    },
  },
  {
    name: 'Tres rebotes seguidos sin que toque el suelo',
    type: 'Defensa', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 4, duration_max: 6,
    description: 'Se lanza al tablero y hay que coger y volver a lanzar tres veces seguidas sin que el balón toque el suelo ni bajarlo del pecho.',
    objetivos: 'Ganar fuerza y continuidad en el rebote ofensivo, que a esta edad es la segunda oportunidad más barata que existe.',
    descripcion_texto: 'Individual, junto al aro. Se lanza el balón contra el tablero, se salta a cogerlo con las dos manos y, sin bajarlo ni tocar el suelo con el balón, se vuelve a lanzar. Tres seguidas y a la tercera se termina en canasta. Se hace por los dos lados. Un compañero cuenta y avisa si el balón baja de la barbilla.',
    notas: 'Puntos clave: el balón NO baja de la barbilla entre salto y salto, que es lo único que se entrena aquí; se cae con las piernas abiertas y se vuelve a subir sin recolocar los pies. Error frecuentísimo: bajar el balón a la cintura al caer, que es donde llegan todas las manos rivales y donde se pierden los rebotes cogidos. Es corto y muy exigente de brazos: cuatro minutos como mucho, y si ves que el balón empieza a bajar, se acabó la serie.',
    tags: ['rebote ofensivo', 'finalización', 'equilibrio', 'analítico', 'series'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'coger el balón en el aire con las dos manos y caer equilibrado',
      dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en parejas trabajando a los dos lados del aro: uno hace la serie y el otro cuenta y vigila la altura del balón.',
      niveles: {
        base: 'dos seguidas y se puede dejar botar el balón entre medias.',
        intermedio: 'tres seguidas sin que toque el suelo y terminando en canasta.',
        avanzado: 'cinco seguidas alternando lado del tablero.',
      },
      criterio_exito: 'tres seguidas sin que el balón baje de la barbilla, según el compañero',
      aplicacion: 'el rebote ofensivo en el 3c3, donde esa continuidad es lo que convierte un fallo en dos puntos',
    },
    // Pegado al tablero: el ejercicio entero pasa dentro de metro y
    // medio del aro, y desde más lejos ya no es rebote ofensivo.
    tablero: () => [
      jug('A', 1, 0.136, 0.5423), jug('A', 2, 0.1946, 0.4334),
      balon(0.136, 0.5423),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'A1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
        { eventos: [
          { jugador: 'A1', tipo: 'recoge' },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2141, y: 0.4682 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Rebote y primer pase con presión',
    type: 'Defensa', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Se coge el rebote con dos rivales encima y hay que sacar el balón a la banda antes de tres segundos y sin botar.',
    objetivos: 'Cerrar el rebote por donde de verdad se pierde: el segundo posterior, con dos manos buscando el balón y ninguna salida clara.',
    descripcion_texto: 'Un reboteador bajo el aro con dos rivales que le rodean en cuanto coge el balón, sin poder agarrarle. Un compañero espera en la banda. El reboteador tiene tres segundos para sacarle el balón sin botar: puede pivotar todo lo que quiera. Si bota o tarda más, punto para los rivales. Cinco repeticiones y rotan.',
    notas: 'Puntos clave: al caer, el balón se sube a la barbilla con los codos firmes y se pivota buscando el hueco, sin bajarlo nunca; el pase sale por encima, jamás picado entre dos cuerpos. Errores frecuentes: botar por instinto —que es cuando se lo quitan— y girarse hacia el lado cerrado. El compañero de la banda también trabaja: si no se mueve para dar línea, no hay pase posible y la culpa no es del que rebotea.',
    tags: ['rebote defensivo', 'pivote', 'pase', 'transición', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'coger el rebote con las dos manos y pivotar sin levantar el pie de apoyo',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: un reboteador, dos que aprietan, uno en la banda y dos que esperan y cuentan los tres segundos en voz alta. Rotan cada repetición.',
      niveles: {
        base: 'un solo rival y cinco segundos.',
        intermedio: 'dos rivales, tres segundos y sin botar.',
        avanzado: 'dos rivales, dos segundos, y el de la banda tiene que estar en movimiento.',
      },
      criterio_exito: 'el balón sale a la banda en cuatro de cada cinco rebotes, sin botes y sin pérdidas',
    },
    tablero: () => [
      jug('A', 1, 0.1751, 0.5031), jug('A', 2, 0.3703, 0.834),
      jug('B', 1, 0.2141, 0.4334), jug('B', 2, 0.2141, 0.5727),
      balon(0.1702, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'recoge' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2044, y: 0.4595 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2044, y: 0.5553 } },
        ] },
        // el de la banda se mueve a dar línea: sin eso no hay pase
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: { x: 0.3118, y: 0.7992 } }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
      ],
    },
  },

  /* ═══ CALENTAMIENTO ════════════════════════════════════════ */
  {
    name: 'Calentar pasando en círculo',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Círculo grande, dos balones que giran en sentidos contrarios y hay que estar atento a los dos.',
    objetivos: 'Activar el cuerpo y la atención a la vez, que es lo que un calentamiento tiene que hacer y lo que trotar en fila no hace.',
    descripcion_texto: 'Todos en círculo separados tres metros. Empieza un balón girando hacia la derecha con pase de pecho. Cuando ya va rodado, entra un segundo balón en sentido contrario. Después se cambia el tipo de pase —picado, por encima— y por último se pide que, al pasar, se diga el nombre del que recibe. Cinco minutos.',
    notas: 'Puntos clave: los pies no se quedan quietos entre pase y pase, y las manos están siempre preparadas por delante; con dos balones aparece el momento en que a alguien le llegan los dos, y ahí está la gracia. Error del entrenador: meter el segundo balón demasiado pronto, con lo que se cae al suelo cada diez segundos y se convierte en recogerlos. Espera a que el primero dé dos vueltas limpias. Sirve de calentamiento y sirve de repaso del pase: en mini el calentamiento sin balón es tiempo perdido.',
    tags: ['calentamiento', 'activación', 'pase', 'recepción', 'coordinación'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'pasar de pecho a tres metros y recibir con las dos manos',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 20 },
      organizacion: 'Con 12: un solo círculo de doce en el centro de la pista, separados tres metros. Si el grupo es más grande, dos círculos de seis a ocho.',
      niveles: {
        base: 'un balón, pase de pecho y sin nombres.',
        intermedio: 'dos balones en sentidos contrarios.',
        avanzado: 'dos balones, tipos de pase alternos y hay que decir el nombre del receptor.',
      },
      criterio_exito: 'noventa segundos con los dos balones sin que ninguno toque el suelo',
    },
    tablero: () => [
      jug('A', 1, 0.4094, 0.2766), jug('A', 2, 0.546, 0.3637), jug('A', 3, 0.585, 0.5031),
      jug('A', 4, 0.546, 0.6424), jug('A', 5, 0.4094, 0.7295), jug('A', 6, 0.2727, 0.6424),
      jug('A', 7, 0.2337, 0.5031), jug('A', 8, 0.2727, 0.3637),
      balon(0.4094, 0.2766), balon(0.585, 0.5031),
    ],
    intent: {
      canasta: null,
      fases: [
        // los dos balones giran en sentidos contrarios, y los pies no
        // se quedan quietos entre pase y pase: es calentamiento
        { eventos: [
          { jugador: 'A5', tipo: 'corte', hacia: { x: 0.4094, y: 0.6947 } },
          { jugador: 'A7', tipo: 'corte', hacia: { x: 0.2629, y: 0.5031 } },
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'A3', tipo: 'pase', a: 'A2' },
        ] },
        { eventos: [
          { jugador: 'A2', tipo: 'pase', a: 'A3' },
        ] },
        { eventos: [
          { jugador: 'A3', tipo: 'pase', a: 'A4' },
        ] },
        { eventos: [
          { jugador: 'A4', tipo: 'pase', a: 'A5' },
          { jugador: 'A6', tipo: 'pase', a: 'A7' },
          { jugador: 'A8', tipo: 'pase', a: 'A1' },
        ] },
      ],
    },
  },
  {
    name: 'Sombras por el espacio',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 3, duration_min: 4, duration_max: 8,
    description: 'Por parejas y los dos con balón: uno se mueve libre por el espacio y el otro le sigue a dos metros copiando lo que hace.',
    objetivos: 'Subir pulsaciones con el balón en la mano y con algo que mirar, en vez de dar vueltas al campo en fila.',
    descripcion_texto: 'Por parejas, los dos con balón. El de delante se mueve por la media pista alternando andar, trotar, desplazarse de lado y arrancar; el de detrás le copia a dos metros sin perderle. Cada treinta segundos se cambia quien manda. En los últimos treinta segundos, el que manda puede parar en seco y el otro tiene que parar igual.',
    notas: 'Puntos clave: se calienta de menos a más, así que el que manda empieza andando y termina arrancando — díselo, porque si no arrancan desde el primer segundo; y el que sigue lleva la cabeza alta por narices. Error del entrenador: dejar que se convierta en una carrera, que es lo que pasa si no pones el orden de las intensidades. Es el calentamiento que mejor funciona con doce: nadie espera, nadie da vueltas y todos tocan balón desde el minuto uno.',
    tags: ['calentamiento', 'activación', 'bote', 'cabeza levantada', 'coordinación'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'espacio',
      requisito_previo: 'botar en movimiento sin mirar el balón continuamente',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 15 },
      organizacion: 'Con 12: seis parejas a la vez dentro de una media pista, cada uno con balón. Se cambia quien manda cada treinta segundos.',
      niveles: {
        base: 'andando y trotando, sin arrancadas.',
        intermedio: 'con desplazamientos laterales y arrancadas.',
        avanzado: 'con paradas en seco y cambios de dirección, y el que sigue no puede quedarse a más de dos metros.',
      },
      criterio_exito: 'los cuatro turnos sin perder el balón, sin chocar y sin descolgarse de la pareja',
    },
    tablero: () => [
      jug('A', 1, 0.5265, 0.3289), jug('A', 3, 0.4484, 0.3289),
      jug('A', 2, 0.5265, 0.6424), jug('A', 4, 0.4484, 0.6424),
      balon(0.5265, 0.3289), balon(0.4484, 0.3289), balon(0.5265, 0.6424), balon(0.4484, 0.6424),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3703, y: 0.2592 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.4484, y: 0.2766 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.3703, y: 0.7121 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.4484, y: 0.6947 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2337, y: 0.416 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.3118, y: 0.3289 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.2337, y: 0.5901 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.3118, y: 0.6772 } },
        ] },
      ],
    },
  },
  {
    name: 'Relevo de calentamiento con tarea de tiro',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Relevo por equipos que termina en canasta: no vale volver hasta que el balón entra, así que el equipo entero anima al que tira.',
    objetivos: 'Cerrar el calentamiento activando también el tiro cercano y con el grupo ya competitivo, que es como se llega bien a la parte principal.',
    descripcion_texto: 'Tres equipos en fila en el fondo. El primero sale botando hasta la canasta contraria, entra a canasta y no puede volver hasta que la mete; vuelve botando y entrega el balón en mano al siguiente. Gana el equipo que termine antes. Dos rondas: la segunda con la mano no dominante.',
    notas: 'Puntos clave: es calentamiento, así que la primera ronda va al setenta por ciento y la segunda ya a tope; el «hasta que la meta» hace que el equipo entero mire cada tiro, que es lo que sube el ambiente al empezar. Error del entrenador: ponerlo al principio del todo, con el cuerpo frío y un tiro que no está caliente — va DESPUÉS de la movilidad, como último paso antes de la parte principal. Y si alguien se atasca sin meter, que valga a la tercera: el objetivo es entrar en calor, no humillar a nadie.',
    tags: ['calentamiento', 'activación', 'competición', 'entrada', 'bote'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 2, estaciones: 3,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'botar la pista entera sin perder el balón y anotar desde debajo del aro',
      dosis: { series: 2, cantidad: 2, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: tres equipos de cuatro, un carril por equipo y un balón cada uno. Los tres compiten a la vez hacia la misma canasta, cada uno por su lado del aro.',
      niveles: {
        base: 'media pista y el tiro vale al segundo intento.',
        intermedio: 'pista entera y hasta meterla.',
        avanzado: 'pista entera, hasta meterla, y la segunda ronda entera con la mano no dominante.',
      },
      criterio_exito: 'las dos rondas completas sin que nadie tenga que esperar más de un turno',
    },
    tablero: () => [
      fila(0.2368, 0.7593, 4, 90), fila(0.5004, 0.7593, 4, 90), fila(0.7641, 0.7593, 4, 90),
      balon(0.2368, 0.7593), balon(0.5004, 0.7593), balon(0.7641, 0.7593),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.3598, y: 0.3148 } },
          { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.5004, y: 0.3148 } },
          { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.6411, y: 0.3148 } },
        ] },
        { eventos: [{ jugador: 'fila2', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'fila2', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila2', tipo: 'recoge' }] },
        { eventos: [
          { jugador: 'fila1', tipo: 'vuelve_a_fila' },
          { jugador: 'fila2', tipo: 'vuelve_a_fila' },
          { jugador: 'fila3', tipo: 'vuelve_a_fila' },
        ] },
      ],
    },
  },

  /* ═══ PSICOMOTRICIDAD ══════════════════════════════════════
     El único bloque con categoria_nivel, porque aquí el ejercicio
     sí es específico de la edad (D9). Y el último contenido que
     quedaba a cero en toda la biblioteca: la percepción espacial. */
  {
    name: 'Percepción del espacio: el cuadrado que encoge',
    type: 'Calentamiento', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela'],
    difficulty: 1, intensidad: 3, duration_min: 4, duration_max: 8,
    description: 'Todos se mueven con balón por un cuadrado que se va haciendo pequeño, y hay que ocupar el espacio libre sin chocar y sin salirse.',
    objetivos: 'Trabajar la percepción del espacio propio y el de los demás, que es lo que después permite entender el espaciado en un ataque.',
    descripcion_texto: 'Cuadrado marcado con conos. Todos dentro llevando el balón como diga el entrenador: en las manos, botando, sobre la cabeza. Cada treinta segundos los conos se meten hacia dentro y el cuadrado encoge. Nadie puede chocar ni salirse ni parar. Al final quedan todos en un cuadrado pequeñísimo, moviéndose muy despacio y muy juntos.',
    notas: 'Puntos clave: lo que se aprende es a mirar los HUECOS, no a los compañeros — díselo así, porque cambia por completo cómo se mueven; y cuando queda poco espacio el ritmo baja solo, que es la lección. Error frecuente: quedarse quieto en un rincón para no chocar, que es hacer trampa al ejercicio. Regla que lo arregla: nadie puede pisar dos veces seguidas el mismo sitio. Es la base de lo que después llamamos espaciado, y a estas edades se entiende con los pies mucho antes que con una pizarra.',
    tags: ['coordinación', 'equilibrio', 'ritmo', 'lateralidad', 'calentamiento'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'media', oposicion: 'nula', presion: 'espacio',
      requisito_previo: 'desplazarse llevando el balón sin que se caiga',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: los doce a la vez en un cuadrado del tamaño de la zona ampliada. El entrenador mueve los conos cada treinta segundos sin parar el ejercicio.',
      niveles: {
        base: 'cuadrado grande, andando y con el balón en las manos.',
        intermedio: 'el cuadrado encoge cada treinta segundos y se va botando.',
        avanzado: 'el cuadrado encoge y además hay que ir cambiando la forma de llevar el balón a la voz.',
      },
      criterio_exito: 'llegar al cuadrado más pequeño sin choques, sin salidas y sin que nadie se pare',
    },
    tablero: () => [
      jug('A', 1, 0.2922, 0.3463), jug('A', 2, 0.2922, 0.6424), jug('A', 3, 0.4288, 0.3463),
      jug('A', 4, 0.4288, 0.6424), jug('A', 5, 0.3703, 0.5031), jug('A', 6, 0.5069, 0.5031),
      cono(0.2337, 0.2766), cono(0.2337, 0.7295), cono(0.5656, 0.2766), cono(0.5656, 0.7295),
      balon(0.2922, 0.3463), balon(0.2922, 0.6424), balon(0.4288, 0.3463),
      balon(0.4288, 0.6424), balon(0.3703, 0.5031), balon(0.5069, 0.5031),
    ],
    intent: {
      canasta: null,
      fases: [
        // se ocupa el hueco, no se sigue al compañero
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.4484, y: 0.4334 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.4484, y: 0.5727 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.3118, y: 0.4334 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.3118, y: 0.5727 } },
          { jugador: 'A5', tipo: 'bote', hacia: { x: 0.3703, y: 0.3114 } },
          { jugador: 'A6', tipo: 'bote', hacia: { x: 0.5069, y: 0.6947 } },
        ] },
        // el cuadrado ha encogido: los mismos seis en menos sitio
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3508, y: 0.4508 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.3508, y: 0.5553 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.4288, y: 0.4508 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.4288, y: 0.5553 } },
          { jugador: 'A5', tipo: 'bote', hacia: { x: 0.3898, y: 0.3985 } },
          { jugador: 'A6', tipo: 'bote', hacia: { x: 0.4679, y: 0.6076 } },
        ] },
      ],
    },
  },
  {
    name: 'Percepción de la distancia: pasar a ciegas',
    type: 'Pase', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela', 'Benjamín'],
    difficulty: 2, intensidad: 2, duration_min: 4, duration_max: 6,
    description: 'Se mira al compañero, se cierran los ojos y se pasa: hay que calcular la fuerza sin verle.',
    objetivos: 'Construir la percepción de la distancia, que es lo que hace que un pase llegue con la fuerza justa sin tener que pensarlo.',
    descripcion_texto: 'Por parejas a cuatro metros. Se mira al compañero, se cierran los ojos y se pasa de pecho intentando que llegue a sus manos. El compañero dice si llegó corto, largo o bien. Diez pases y se cambia. Después se repite a seis metros y se compara: casi todos aciertan la corta y fallan la larga, y ahí está la lección.',
    notas: 'Puntos clave: se calcula con el cuerpo entero, no con el brazo — un paso adelante al pasar cambia más la distancia que apretar más; y el niño tiene que decir en voz alta si cree que se ha quedado corto ANTES de que se lo digan, para que compare su sensación con lo que pasó. Aviso: es un ejercicio de percepción, no de pase, y por eso los ojos cerrados sí se justifican aquí y no en un ejercicio de pase de verdad (D20). Cuatro minutos y fuera.',
    tags: ['pase', 'coordinación', 'equilibrio', 'analítico'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'media', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'pasar de pecho a cuatro metros con las dos manos',
      dosis: { series: 3, cantidad: 10, unidad: 'repeticiones', descanso: 20 },
      organizacion: 'Con 12: seis parejas a la vez repartidas a lo ancho, todas pasando en la misma dirección para que ningún balón perdido cruce por delante de otra pareja.',
      niveles: {
        base: 'a tres metros y con los ojos abiertos, solo calculando la fuerza.',
        intermedio: 'a cuatro metros con los ojos cerrados.',
        avanzado: 'a seis metros, ojos cerrados, y hay que decir antes de abrirlos si ha ido corto o largo.',
      },
      criterio_exito: 'siete de cada diez pases llegan a las manos, y el que pasa acierta su propia sensación en la mayoría',
      aplicacion: 'el pase largo de contraataque, donde calcular la distancia mal es exactamente lo que lo convierte en pérdida',
    },
    tablero: () => [
      jug('A', 1, 0.546, 0.3114), jug('A', 3, 0.3508, 0.3114),
      jug('A', 2, 0.546, 0.5031), jug('A', 4, 0.3508, 0.5031),
      jug('A', 5, 0.546, 0.6947), jug('A', 6, 0.3508, 0.6947),
      balon(0.546, 0.3114), balon(0.546, 0.5031), balon(0.546, 0.6947),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A3' },
          { jugador: 'A2', tipo: 'pase', a: 'A4' },
          { jugador: 'A5', tipo: 'pase', a: 'A6' },
        ] },
        // y después se repite la serie a seis metros: se da un paso
        // atrás, que es donde casi todos empiezan a quedarse cortos
        { eventos: [
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.2727, y: 0.3114 } },
          { jugador: 'A4', tipo: 'corte', hacia: { x: 0.2727, y: 0.5031 } },
          { jugador: 'A6', tipo: 'corte', hacia: { x: 0.2727, y: 0.6947 } },
        ] },
        { eventos: [
          { jugador: 'A3', tipo: 'pase', a: 'A1' },
          { jugador: 'A4', tipo: 'pase', a: 'A2' },
          { jugador: 'A6', tipo: 'pase', a: 'A5' },
        ] },
      ],
    },
  },
];
