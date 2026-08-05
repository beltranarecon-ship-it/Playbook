/* ============================================================
   tanda-08.mjs — bote (Bloque D).

   El bloque más grande del mapa y el que peor se entrena: es donde
   viven las filas de doce esperando turno para hacer un slalom, y el
   manejo de circo del que avisa D20.

   Esta tanda cierra el hueco que el linter marcaba a cero —el BOTE DE
   AVANCE, que no es el de control con otra velocidad sino otro gesto:
   largo, alto y por delante del cuerpo— y sube la proporción con
   oposición del bloque, que es lo que separa botar de jugar.

   Doctrina que más aprieta aquí:
     D19 · la oposición sube en cuatro escalones
     D20 · el jugador SIEMPRE tiene algo que mirar que no sea el balón
     D21 · dos manos → dominante → ambas; la mirada se despega por
           juego, nunca por orden verbal
     D5  · con dos canastas y pista entera no hay excusa para una cola
           de más de cuatro
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_08 = [

  /* ═══ BOTE DE AVANCE ═══════════════════════════════════════
     El contenido que estaba a cero. Va primero porque es el que
     ordena el resto: hasta que un niño no distingue el bote que
     sirve para correr del que sirve para esperar, todo lo demás
     son matices de un gesto que no tiene. */
  {
    name: 'Cuenta tus botes',
    type: 'Bote', category: 'bote', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Cruzar la pista entera en el menor número de botes posible: el bote de avance es largo, alto y por delante.',
    objetivos: 'Separar el bote de avance del bote de control, que es la distinción que más rápido cambia la velocidad de un equipo entero.',
    descripcion_texto: 'Cuatro filas en el fondo, una por carril. Se cruza la pista entera botando a velocidad de carrera y contando los botes en voz alta; se vuelve por el mismo carril con la otra mano. Cada uno apunta su récord y en las series siguientes intenta bajarlo. No vale ir andando: si el número baja porque se ha ido más despacio, no cuenta.',
    notas: 'Puntos clave: el balón se empuja hacia delante y alto —a la altura de la cadera o más—, no se golpea hacia abajo al lado del pie; la mano va DETRÁS del balón, no encima, o el balón se queda atrás. Error frecuentísimo: correr con el bote de control, que es el que tienen automatizado, y acabar dando doce botes en veintiocho metros. La cuenta en voz alta es lo que hace el trabajo: en cuanto oyen que el compañero ha dado ocho y ellos catorce, corrigen solos sin que digas nada.',
    tags: ['bote', 'mano no dominante', 'competición', 'series'],
    requisitos: {
      // Cuatro carriles = cuatro estaciones en paralelo: es lo que
      // mantiene las colas en tres y no en doce (D5).
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 4,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'botar en carrera con cualquiera de las dos manos sin perder el balón',
      dosis: { series: 4, cantidad: 2, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: cuatro filas de tres en el fondo, una por carril. Salen los cuatro primeros a la vez y la fila corre; nadie espera más de dos turnos.',
      niveles: {
        base: 'media pista, solo ida, con la mano dominante y sin contar.',
        intermedio: 'pista entera, ida con una mano y vuelta con la otra, contando en voz alta.',
        avanzado: 'pista entera con un tope de botes anunciado antes de salir; quien lo pasa, repite.',
      },
      criterio_exito: 'bajar el récord propio de botes en la ida y en la vuelta sin perder el balón ni una vez',
    },
    tablero: () => [
      fila(0.16, 0.78, 3, 90), fila(0.39, 0.78, 3, 90),
      fila(0.61, 0.78, 3, 90), fila(0.84, 0.78, 3, 90),
      balon(0.16, 0.78), balon(0.39, 0.78), balon(0.61, 0.78), balon(0.84, 0.78),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.16, y: 0.16 } },
          { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.39, y: 0.16 } },
          { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.61, y: 0.16 } },
          { jugador: 'fila4', tipo: 'bote', hacia: { x: 0.84, y: 0.16 } },
        ] },
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.16, y: 0.72 } },
          { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.39, y: 0.72 } },
          { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.61, y: 0.72 } },
          { jugador: 'fila4', tipo: 'bote', hacia: { x: 0.84, y: 0.72 } },
        ] },
        { eventos: [
          { jugador: 'fila1', tipo: 'vuelve_a_fila' },
          { jugador: 'fila2', tipo: 'vuelve_a_fila' },
          { jugador: 'fila3', tipo: 'vuelve_a_fila' },
          { jugador: 'fila4', tipo: 'vuelve_a_fila' },
        ] },
      ],
    },
  },
  {
    name: 'Carril con perseguidor',
    type: 'Bote', category: 'bote', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Bote de avance a máxima velocidad con alguien pisándote los talones, y canasta al llegar.',
    objetivos: 'Sostener el bote de avance cuando la prisa aprieta, que es cuando se destapa quién corre y quién corre con el balón.',
    descripcion_texto: 'Fila en el fondo con balón y un perseguidor un paso por detrás. A la señal el atacante cruza la pista botando y termina en canasta; el perseguidor intenta tocar el balón por detrás, sin agarrar ni empujar. Si lo toca, punto para él. El atacante coge su rebote y vuelve por fuera; el perseguidor pasa a atacar y entra un perseguidor nuevo.',
    notas: 'Puntos clave: con alguien detrás el balón se protege POR DELANTE, con el cuerpo entre el perseguidor y el bote, y eso obliga a botar con la mano de fuera del carril; frenar es regalar el balón. Error frecuente: mirar hacia atrás para ver dónde viene, que cuesta medio segundo y la posesión. Como entrenador, el perseguidor no puede salir a la vez: un paso por detrás es lo que hace que el ejercicio sea de bote y no de 1c1.',
    tags: ['bote', 'cambio de ritmo', 'bote de protección', 'entrada', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 2, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'tiempo',
      requisito_previo: 'botar la pista entera a velocidad alta sin perder el balón',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos carriles, uno por banda y cada uno a su canasta, seis por carril: fila de cuatro, un atacante y un perseguidor que rotan.',
      niveles: {
        base: 'el perseguidor sale tres pasos por detrás y solo persigue, sin tocar.',
        intermedio: 'un paso por detrás y puede tocar el balón.',
        avanzado: 'salen a la vez desde la misma línea y el atacante tiene que ganarle el carril.',
      },
      criterio_exito: 'llegar y anotar en tres de cada cuatro carreras sin que le toquen el balón',
    },
    tablero: () => [
      fila(0.30, 0.78, 3, 90),
      jug('B', 1, 0.30, 0.86),
      balon(0.30, 0.78),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.31, y: 0.46 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'fila1', hacia: { x: 0.30, y: 0.55 } },
        ] },
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'fila1', hacia: { x: 0.38, y: 0.24 } },
        ] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },

  /* ═══ CAMBIOS ══════════════════════════════════════════════ */
  {
    name: 'Cambio de mano al toque',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'El compañero pone la mano en el lado del balón y hay que cambiárselo antes de que llegue.',
    objetivos: 'Que el cambio de mano aparezca como respuesta a algo real y no como un gesto que se repite en el aire.',
    descripcion_texto: 'Por parejas enfrentadas, avanzando despacio por el ancho de la pista. El que bota va de un lado al otro; el compañero, andando hacia atrás, va poniendo una mano abierta en el lado donde está el balón, sin tocarlo. Cada vez que la pone, hay que cambiar de mano y seguir. Se llega al otro lado y se cambian los papeles.',
    notas: 'Puntos clave: el cambio se hace por delante y BAJO —a la altura de la rodilla—, con el cuerpo interponiéndose; el balón cruza en un solo bote, no en tres. Errores frecuentes: cambiar alto y por delante del pecho, que es donde una mano rival lo intercepta; y frenar para cambiar, que anula la ventaja que el cambio acaba de crear. La mano del compañero no es un adorno: sin ella el niño cambia cuando le apetece y aprende a cambiar en el vacío (D20).',
    tags: ['bote', 'cambio de mano', 'mano no dominante', 'analítico'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'pasiva', presion: 'ninguna',
      requisito_previo: 'botar con las dos manos en movimiento sin mirar el balón continuamente',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: seis parejas a la vez, repartidas a lo ancho y avanzando en la misma dirección para no cruzarse. Se cambia quien bota en cada viaje.',
      niveles: {
        base: 'el compañero anuncia el lado en voz alta antes de poner la mano.',
        intermedio: 'pone la mano sin avisar y el que bota reacciona.',
        avanzado: 'el compañero puede tocar el balón si el cambio llega tarde, y se cuentan las pérdidas.',
      },
      criterio_exito: 'cambiar de mano antes de que la mano del compañero llegue en nueve de cada diez señales',
      aplicacion: 'el uno contra uno desde el 45, donde el cambio sirve para pasar por el lado que el defensor deja abierto',
    },
    tablero: () => [
      jug('A', 1, 0.62, 0.28), jug('B', 1, 0.54, 0.28),
      jug('A', 2, 0.62, 0.50), jug('B', 2, 0.54, 0.50),
      jug('A', 3, 0.62, 0.72), jug('B', 3, 0.54, 0.72),
      balon(0.62, 0.28), balon(0.62, 0.50), balon(0.62, 0.72),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.48, y: 0.24 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.40, y: 0.26 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.48, y: 0.54 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.40, y: 0.52 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.48, y: 0.76 } },
          { jugador: 'B3', tipo: 'defiende', marca: 'A3', hacia: { x: 0.40, y: 0.74 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.34, y: 0.30 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.26, y: 0.28 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.34, y: 0.48 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.26, y: 0.50 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.34, y: 0.70 } },
          { jugador: 'B3', tipo: 'defiende', marca: 'A3', hacia: { x: 0.26, y: 0.72 } },
        ] },
      ],
    },
  },
  {
    name: 'Frena y arranca',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Botar a tope, frenar en seco sin coger el balón y volver a arrancar: el cambio de ritmo, que se enseña poco y gana más partidos que el de mano.',
    objetivos: 'Instalar el cambio de ritmo como recurso propio, que es el que supera a un defensor que ya se sabe todos los cambios de mano.',
    descripcion_texto: 'Recorrido de ida y vuelta por el ancho de la media pista con tres conos. Se llega a cada cono a máxima velocidad, se frena ahí bajando el bote y el centro de gravedad —sin coger el balón—, se cuentan dos botes en el sitio y se arranca otra vez a tope. Un compañero enfrente levanta un brazo u otro en cada arranque para decidir por qué lado se sale.',
    notas: 'Puntos clave: al frenar, el bote baja hasta la rodilla y el pecho se queda por delante del balón; al arrancar, el primer bote va largo. Error frecuente y muy caro: coger el balón al frenar, que es lo que hace el cuerpo solo y convierte el cambio de ritmo en una parada con pasos detrás. Segundo error: frenar a medias, que no engaña a nadie. Si no ves que el defensor imaginario se comería el freno, no es un cambio de ritmo: es ir más despacio.',
    tags: ['bote', 'cambio de ritmo', 'cabeza levantada', 'lectura'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva', presion: 'tiempo',
      requisito_previo: 'botar en carrera y bajar la altura del bote sin perder el control',
      dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos recorridos en paralelo, uno en cada media pista, seis por recorrido: cuatro que van rotando y dos que hacen de señal. Se cambia la señal cada vuelta.',
      niveles: {
        base: 'sin señal: se frena y se arranca por el mismo lado, contando dos botes.',
        intermedio: 'con señal del compañero para elegir el lado de salida.',
        avanzado: 'la señal llega DURANTE el freno y el arranque tiene que salir en un solo bote.',
      },
      criterio_exito: 'seis frenos seguidos sin coger el balón y arrancando por el lado señalado',
    },
    /* La cola arranca en 0,66 y no en 0,70: con tres esperando y paso
       de 0,06 el último caía en 0,88, y el medio campo acaba en 0,829 —
       el que volvía a la fila se salía de la pista. */
    tablero: () => [
      fila(0.66, 0.30, 3, 0),
      cono(0.54, 0.30, 'rodear'), cono(0.42, 0.30, 'rodear'),
      jug('B', 1, 0.34, 0.42),
      balon(0.66, 0.30),
    ],
    intent: {
      canasta: null,
      fases: [
        // el slalom entre los dos conos ES el recorrido: se llega a tope,
        // se frena en cada uno y se sale por el lado que marca la señal
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.36, y: 0.34 } },
          { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'el_cono_2' },
          { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'el_cono_3' },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.32, y: 0.38 } },
        ] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.58, y: 0.36 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },

  /* ═══ PROTECCIÓN Y OPOSICIÓN ═══════════════════════════════ */
  {
    name: 'El pasillo estrecho',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Avanzar por un pasillo de dos metros con un defensor al lado que va a por el balón: o se protege con el cuerpo, o se pierde.',
    objetivos: 'Botar protegiendo cuando no hay espacio para escaparse, que es la situación real del bote en un partido de mini.',
    descripcion_texto: 'Pasillo de unos dos metros de ancho marcado con conos, de fondo a medio campo. El atacante lo recorre botando; el defensor va a su lado, dentro del pasillo, e intenta tocar el balón sin agarrar. Ninguno de los dos puede salirse. Si el balón se pierde o sale del pasillo, vuelta a empezar. Tres viajes y se cambian los papeles.',
    notas: 'Puntos clave: el brazo libre se pone firme entre el defensor y el balón —codo pegado al cuerpo, mano abierta, sin empujar—, y el bote va del lado contrario y bajo; los hombros giran hacia el defensor, no hacia delante. Error frecuente: usar el brazo libre para apartar, que es falta, y además deja el balón solo. Otro: subir el bote al ponerse nervioso. Vigila los codos: firmes sí, girando como aspas no.',
    tags: ['bote', 'bote de protección', 'mano no dominante', 'oposición', '1c1'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real', presion: 'espacio',
      requisito_previo: 'botar con la mano de fuera manteniendo el cuerpo entre el balón y el rival',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos pasillos, uno en cada media pista, seis por pasillo: tres parejas que se turnan y rotan atacante y defensor cada tres viajes.',
      niveles: {
        base: 'pasillo de cuatro metros y el defensor solo acompaña con las manos abajo.',
        intermedio: 'dos metros y el defensor va a por el balón.',
        avanzado: 'dos metros, el defensor puede cambiarse de lado una vez, y hay que llegar en menos de cinco segundos.',
      },
      criterio_exito: 'completar los tres viajes sin perder el balón ni salir del pasillo',
    },
    tablero: () => [
      jug('A', 1, 0.74, 0.44), jug('B', 1, 0.74, 0.56),
      cono(0.74, 0.36), cono(0.74, 0.64), cono(0.50, 0.36), cono(0.50, 0.64),
      cono(0.26, 0.36), cono(0.26, 0.64),
      balon(0.74, 0.44),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.50, y: 0.42 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.52, y: 0.55 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.28, y: 0.45 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.30, y: 0.57 } },
        ] },
      ],
    },
  },
  {
    name: 'Cazadores en el círculo',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 5, duration_max: 10,
    description: 'Todos botan dentro de un círculo y dos cazadores sin balón van a sacar balones fuera: el que lo pierde, caza.',
    objetivos: 'Botar mirando a la vez el espacio, al que viene y a los que se apartan, que es la única forma de que la cabeza se levante de verdad.',
    descripcion_texto: 'Círculo grande marcado con conos. Todos dentro con balón menos dos, que son los cazadores y entran sin balón. Los cazadores intentan sacar de un manotazo el balón de cualquiera, o hacer que se salga del círculo. El que pierde su balón deja de botar y pasa a cazar; el círculo no se agranda nunca, así que cada vez hay menos sitio y más cazadores. Se juega hasta que quedan dos.',
    notas: 'Puntos clave: se bota con la mano más lejos del cazador más cercano y a la altura de la rodilla; el que se queda quieto en el borde es el primero que cae. Error frecuente: mirar solo al cazador que tienen delante y no ver al que llega por detrás. Lo bueno de este juego es que se corrige solo: el que bota alto dura veinte segundos y no hace falta decírselo. Corta las rondas antes de que quede uno: la última parte es un dos contra ocho y ya no entrena a nadie.',
    tags: ['bote', 'bote de protección', 'cabeza levantada', 'competición', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real', presion: 'espacio',
      requisito_previo: 'botar en movimiento protegiendo el balón con el cuerpo',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 60 },
      organizacion: 'Con 12: los doce en un círculo de la media pista, diez con balón y dos cazadores. Cada ronda empieza con cazadores distintos.',
      niveles: {
        base: 'un cazador y círculo amplio; el que pierde el balón lo recupera y sigue.',
        intermedio: 'dos cazadores y el que pierde pasa a cazar.',
        avanzado: 'dos cazadores, y quien salga del círculo o coja el balón con las dos manos también pasa a cazar.',
      },
      criterio_exito: 'quedar entre los cuatro últimos en dos de las tres rondas',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.36), jug('A', 2, 0.34, 0.64), jug('A', 3, 0.50, 0.30),
      jug('A', 4, 0.50, 0.70), jug('A', 5, 0.62, 0.50),
      jug('B', 1, 0.44, 0.46), jug('B', 2, 0.50, 0.58),
      cono(0.28, 0.50), cono(0.36, 0.26), cono(0.52, 0.22), cono(0.66, 0.34),
      cono(0.68, 0.62), cono(0.54, 0.76), cono(0.38, 0.74),
      balon(0.34, 0.36), balon(0.34, 0.64), balon(0.50, 0.30), balon(0.50, 0.70), balon(0.62, 0.50),
    ],
    // Juego abierto: acaba de mil maneras y animar una sería enseñar
    // un desenlace donde tiene que haber lectura. Queda el montaje.
    intent: null,
  },
  {
    name: 'Zigzag defendido',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El clásico zigzag, pero el cambio de dirección lo manda el defensor y no un cono: se cambia cuando te cortan el camino.',
    objetivos: 'Cambiar de dirección porque alguien te obliga, no porque toque; es la diferencia entre saber el gesto y saber cuándo.',
    descripcion_texto: 'De fondo a medio campo por una banda. El atacante bota y el defensor le corta el camino colocándose delante; cada vez que lo consigue, el atacante cambia de dirección y sale por el otro lado. El defensor no roba, solo corta: se trata de que haya cuatro o cinco cambios en el recorrido. Al llegar a medio campo cambian los papeles y vuelven.',
    notas: 'Puntos clave: se cambia cuando el defensor ya ha comprometido el pie, ni antes ni después; el cambio va acompañado de un tirón de velocidad o no sirve de nada. Error frecuente: encadenar cambios sin avanzar, un baile bonito que deja al equipo mirando. Como entrenador, cuenta los METROS ganados, no los cambios: si tras cinco cambios sigue en el mismo sitio, el ejercicio le está enseñando lo contrario de lo que quieres.',
    tags: ['bote', 'cambio de dirección', 'cambio de mano', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'cambiar de mano en movimiento sin frenar del todo',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: cuatro parejas trabajando por las bandas y las diagonales de la pista entera, y dos parejas descansando que entran en la serie siguiente.',
      niveles: {
        base: 'el defensor anuncia el corte con la voz y el atacante cambia.',
        intermedio: 'el defensor corta sin avisar y el atacante lee.',
        avanzado: 'el defensor además puede ir a por el balón después de cortar.',
      },
      criterio_exito: 'llegar a medio campo con cuatro cambios y sin haber retrocedido nunca',
    },
    tablero: () => [
      jug('A', 1, 0.74, 0.24), jug('B', 1, 0.66, 0.28),
      balon(0.74, 0.24),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.60, y: 0.42 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.56, y: 0.40 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.46, y: 0.24 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.42, y: 0.28 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.30, y: 0.44 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.26, y: 0.42 } },
        ] },
      ],
    },
  },

  /* ═══ MANO NO DOMINANTE Y CABEZA LEVANTADA ═════════════════ */
  {
    name: 'La mano mala manda',
    type: '1vs1', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Uno contra uno con una regla sola: solo vale botar con la mano no dominante, y el defensor lo sabe.',
    objetivos: 'Obligar a que la mano mala se use con alguien delante, que es el único contexto donde deja de ser mala.',
    descripcion_texto: 'Uno contra uno desde el 45 hasta la canasta, con una sola regla: el atacante solo puede botar con su mano no dominante. Si bota con la buena, pierde la posesión. El defensor sabe cuál es y puede taparle ese lado, así que hay que salir igualmente. Dos posesiones cada uno y se cambia de pareja.',
    notas: 'Puntos clave: con la mano mala el primer paso tiene que ser más largo y el balón más bajo, porque el control es peor; y hay que usar el cuerpo mucho antes. Error del entrenador: montar esto antes de que la mano mala aguante un bote en carrera sin oposición — entonces solo se entrena a perder el balón. Lo que hay que celebrar aquí no es la canasta: es que salga botando con esa mano sin mirarla. La canasta llega en dos meses.',
    tags: ['bote', 'mano no dominante', '1c1', 'oposición', 'competición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'botar en carrera con la mano no dominante sin mirar el balón',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en parejas que rotan atacante y defensor. Cada pareja apunta sus puntos y se cambian las parejas cada serie.',
      niveles: {
        base: 'sin defensor: solo salida y entrada con la mano no dominante.',
        intermedio: 'defensor real y dos botes de máximo.',
        avanzado: 'defensor real, botes libres, y la canasta con la mano no dominante vale doble.',
      },
      criterio_exito: 'salir botando con la mano no dominante en las cuatro posesiones, entre o no entre',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.06, M.escolta_der[1] - 0.02),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.30, y: 0.70 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.28, y: 0.62 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.23, y: 0.57 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Sigue al de delante',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Por parejas y botando los dos: el de detrás tiene que copiar el recorrido del de delante sin perderle ni chocarse.',
    objetivos: 'Mantener la cabeza arriba porque hay algo que seguir, que es lo que D20 pide y lo que ninguna orden verbal consigue.',
    descripcion_texto: 'Por parejas, los dos con balón. El de delante se mueve libre por la media pista cambiando de dirección y de ritmo cuando quiere; el de detrás le sigue a dos metros copiando su recorrido, sin perderle y sin chocarse con las otras parejas. Treinta segundos y se cambia quien manda. Nadie puede dejar de botar en ningún momento.',
    notas: 'Puntos clave: el que sigue no puede mirar el balón ni un segundo, y ahí está todo el ejercicio; el que manda tiene que hacerlo difícil pero jugable, no imposible. Error frecuente del que manda: correr en línea recta lo más rápido posible, con lo que el ejercicio se convierte en una carrera y deja de entrenar la mirada. Dilo antes de empezar: se trata de cambiar, no de correr. Con seis parejas a la vez el tráfico hace el resto.',
    tags: ['bote', 'cabeza levantada', 'cambio de dirección', 'cambio de ritmo', 'coordinación'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'espacio',
      requisito_previo: 'botar en movimiento y cambiar de dirección sin perder el balón',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: seis parejas a la vez dentro de una media pista, cada uno con balón. Se cambia quien manda cada treinta segundos.',
      niveles: {
        base: 'el de delante anda y solo cambia de dirección.',
        intermedio: 'corre y cambia de dirección y de ritmo.',
        avanzado: 'el de delante puede parar en seco y salir al lado contrario, y el de detrás no puede quedarse a más de dos metros.',
      },
      criterio_exito: 'treinta segundos sin perder el balón, sin chocar y sin quedarse a más de dos metros',
    },
    tablero: () => [
      jug('A', 1, 0.62, 0.30), jug('A', 3, 0.54, 0.30),
      jug('A', 2, 0.62, 0.64), jug('A', 4, 0.54, 0.64),
      balon(0.62, 0.30), balon(0.54, 0.30), balon(0.62, 0.64), balon(0.54, 0.64),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.46, y: 0.20 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.54, y: 0.22 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.46, y: 0.74 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.54, y: 0.72 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.30, y: 0.42 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.38, y: 0.30 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.30, y: 0.60 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.38, y: 0.70 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.44, y: 0.50 } },
          { jugador: 'A3', tipo: 'bote', hacia: { x: 0.32, y: 0.48 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.56, y: 0.56 } },
          { jugador: 'A4', tipo: 'bote', hacia: { x: 0.44, y: 0.64 } },
        ] },
      ],
    },
  },

  /* ═══ COMPETICIÓN ══════════════════════════════════════════ */
  {
    name: 'Relevo con cambio obligado',
    type: 'Bote', category: 'bote', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Relevo por equipos donde cada cono obliga a un cambio distinto: gana el equipo que llega antes sin saltarse ninguno.',
    objetivos: 'Meter los cambios en competición, que es donde se ve cuáles están instalados y cuáles solo salen despacio.',
    descripcion_texto: 'Tres equipos en fila en el fondo, cada uno con su carril y tres conos. En el primer cono se cambia de mano por delante, en el segundo se cambia de dirección, y en el tercero se frena y se arranca. Se llega al fondo contrario, se vuelve y se entrega el balón en mano al siguiente. Gana el equipo que termine antes sin saltarse ningún cambio: el entrenador o un jugador que descansa hace de juez.',
    notas: 'Puntos clave: en un relevo se acelera y lo primero que se cae es la calidad del cambio, así que el juez es imprescindible — sin él, esto entrena a hacerlo mal deprisa. Error del entrenador: penalizar con vueltas al que falla. Se penaliza repitiendo el cambio en el sitio, que es lo que hay que entrenar. Y ojo con el orden de la sesión: esto viene DESPUÉS de haber trabajado los tres cambios, nunca como forma de aprenderlos.',
    tags: ['bote', 'cambio de mano', 'cambio de dirección', 'cambio de ritmo', 'competición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 3,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'hacer el cambio de mano, el de dirección y el de ritmo por separado y sin oposición',
      dosis: { series: 3, cantidad: 2, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: tres equipos de cuatro, un carril y un juego de conos por equipo. El que acaba su relevo hace de juez del equipo de al lado.',
      niveles: {
        base: 'un solo cambio, el de mano, en los tres conos.',
        intermedio: 'un cambio distinto en cada cono.',
        avanzado: 'el entrenador canta el orden de los tres cambios justo antes de salir.',
      },
      criterio_exito: 'completar el relevo sin que el juez anule ningún cambio',
    },
    tablero: () => [
      fila(0.18, 0.82, 4, 90), fila(0.50, 0.82, 4, 90), fila(0.82, 0.82, 4, 90),
      cono(0.18, 0.62), cono(0.18, 0.42), cono(0.18, 0.22),
      cono(0.50, 0.62), cono(0.50, 0.42), cono(0.50, 0.22),
      cono(0.82, 0.62), cono(0.82, 0.42), cono(0.82, 0.22),
      balon(0.18, 0.82), balon(0.50, 0.82), balon(0.82, 0.82),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.18, y: 0.16 } },
          { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.50, y: 0.16 } },
          { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.82, y: 0.16 } },
        ] },
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.18, y: 0.76 } },
          { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.50, y: 0.76 } },
          { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.82, y: 0.76 } },
        ] },
        // La entrega en mano al siguiente no se dibuja a propósito: el
        // que espera arranca EN el cono, así que su ficha saldría
        // pintada encima de la del que vuelve. El relevo lo cuenta el
        // texto; la pizarra cuenta el recorrido, que es lo que se ve.
        { eventos: [
          { jugador: 'fila1', tipo: 'vuelve_a_fila' },
          { jugador: 'fila2', tipo: 'vuelve_a_fila' },
          { jugador: 'fila3', tipo: 'vuelve_a_fila' },
        ] },
      ],
    },
  },
  {
    name: 'Bote y número al fondo',
    type: 'Bote', category: 'bote', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Bote de avance a tope mientras el entrenador cambia los dedos que levanta desde el otro fondo: hay que llegar y decir el último número.',
    objetivos: 'Juntar velocidad de avance y cabeza levantada, que por separado salen y juntas casi nunca.',
    descripcion_texto: 'Filas en un fondo. El entrenador se coloca en el fondo contrario y va cambiando los dedos que levanta cada dos segundos. Se cruza la pista botando a máxima velocidad y al llegar hay que decir cuántos dedos había en el último cambio. Quien no lo sepa, vuelve a cruzar. Ida con una mano, vuelta con la otra.',
    notas: 'Puntos clave: para ver los dedos desde treinta metros hay que llevar la cabeza alta de verdad, no a medias, y eso solo aguanta si el bote es largo y por delante; si el bote se acorta, la mirada baja. Error frecuente: mirar arriba pero bajar la vista en cada bote, que se detecta porque aciertan el número solo cuando aflojan. Truco de entrenador: cambia los dedos justo en el último tercio, que es cuando llega el cansancio y se rompe la técnica.',
    tags: ['bote', 'cabeza levantada', 'mano no dominante', 'series'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 3,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'botar en carrera a velocidad alta con las dos manos',
      dosis: { series: 4, cantidad: 2, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: tres filas de cuatro en el fondo, saliendo de tres en tres. El entrenador en el fondo contrario, donde le ven los tres carriles a la vez.',
      niveles: {
        base: 'media pista y el número se mantiene fijo todo el recorrido.',
        intermedio: 'pista entera y el número cambia cada dos segundos.',
        avanzado: 'dos manos distintas del entrenador y hay que decir la suma, cruzando con la mano no dominante.',
      },
      criterio_exito: 'acertar el número en tres de cada cuatro cruces sin bajar la velocidad',
    },
    tablero: () => [
      fila(0.22, 0.80, 4, 90), fila(0.50, 0.80, 4, 90), fila(0.78, 0.80, 4, 90),
      cono(0.50, 0.06),
      balon(0.22, 0.80), balon(0.50, 0.80), balon(0.78, 0.80),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.22, y: 0.14 } },
          { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.50, y: 0.14 } },
          { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.78, y: 0.14 } },
        ] },
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.22, y: 0.74 } },
          { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.50, y: 0.74 } },
          { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.78, y: 0.74 } },
        ] },
        { eventos: [
          { jugador: 'fila1', tipo: 'vuelve_a_fila' },
          { jugador: 'fila2', tipo: 'vuelve_a_fila' },
          { jugador: 'fila3', tipo: 'vuelve_a_fila' },
        ] },
      ],
    },
  },
];
