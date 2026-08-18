/* ============================================================
   tanda-15.mjs — juego de dos (Bloque D).

   El bloque que más fácil se desvía hacia lo que se ve en la tele. D23
   es tajante: en el núcleo mini mandan PASAR Y CORTAR y el ACLARADO,
   que dan ventaja con dos sin necesidad de contacto y sin pedirle al
   niño que entienda tres cosas a la vez. El bloqueo directo entra
   cuando el 1c1 está resuelto —no por edad—, así que aquí ocupa dos
   fichas de nueve y las dos lo dicen en su requisito previo.

   Doctrina que más aprieta aquí:
     D23 · el 1c1 resuelto es el requisito del juego de dos
     D1  · el analítico introduce y el juego consolida: casi todo esto
           se entrena en 2c2 real, no en recorridos sin defensa
     D11 · toda ayuda lleva su recuperación, también contra el bloqueo
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_15 = [

  /* ═══ PASAR Y CORTAR ═══════════════════════════════════════
     El recurso número uno del núcleo. Tres fichas, porque es lo
     que más se usa y lo que peor se hace: casi todos pasan y se
     quedan mirando. */
  {
    name: 'Pasa y corta hasta el aro',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Después de pasar hay que cortar hasta debajo del aro, siempre: la posesión se anula si el pasador se queda quieto.',
    objetivos: 'Instalar el corte tras el pase como reflejo, que es lo único que convierte un pase en una ventaja.',
    descripcion_texto: 'Dos contra dos en media pista. Regla única: quien pasa tiene que cortar hasta tocar la zona antes de volver a salir. Si se queda mirando, la posesión pasa al rival aunque haya anotado. El receptor decide si le da el balón en el corte o si ataca él. Se juega a cuatro canastas y se cambian los papeles.',
    notas: 'Puntos clave: el corte se hace POR DELANTE del defensor o por detrás, pero decidido; y hay que pedir con la mano y con la voz, o el pasador no sabe que estás. Error frecuentísimo del mini: pasar y quedarse admirando el pase, que es lo que la regla castiga. Error del receptor: mirar solo al aro y no ver el corte. Como entrenador, canta en voz alta «¡corta!» las dos primeras series y después cállate: si a la tercera no cortan solos, la regla no la estás aplicando de verdad.',
    tags: ['pasar y cortar', 'corte', 'pase', 'espaciado', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'resolver el uno contra uno con bote y pasar en movimiento con un defensor cerca',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas: dos juegan el 2c2 y la tercera espera para entrar en cuanto hay canasta.',
      niveles: {
        base: 'sin defensa: solo pasar, cortar y recibir.',
        intermedio: '2c2 con la regla de cortar siempre.',
        avanzado: '2c2, corte obligatorio, y prohibido botar más de dos veces por posesión.',
      },
      criterio_exito: 'ninguna posesión anulada por quedarse quieto en las cuatro canastas',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.332, y: 0.6269 } },
        ] },
        // el pasador corta: es el gesto entero del ejercicio
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.2295, y: 0.5208 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2979, y: 0.5119 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Pasa, corta y el tercero reemplaza',
    type: '3vs3', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El que corta deja un hueco y el tercero lo ocupa: así el ataque nunca se queda sin sitio donde recibir.',
    objetivos: 'Enseñar el reemplazo, que es lo que hace que un pasar y cortar se pueda encadenar en vez de morir en el primer intento.',
    descripcion_texto: 'Tres contra tres en media pista, sin bote. Cada vez que alguien pasa, corta hasta la zona; y el tercer atacante tiene que ocupar el sitio que ese corte ha dejado libre. Si el cortador no recibe, sale por el lado contrario y se coloca en el hueco que quede. Se juega a cuatro canastas.',
    notas: 'Puntos clave: el reemplazo empieza cuando el corte empieza, no cuando termina; y el que reemplaza llega al sitio ya orientado al aro. Error frecuentísimo: los tres se juntan en el mismo lado y el balón deja de tener a dónde ir. Es más fácil de ver que de explicar: para el ejercicio con todos quietos y enséñales el hueco. Sin bote a propósito — con bote, el que tiene el balón resuelve solo y el reemplazo no hace falta, así que no se aprende.',
    tags: ['pasar y cortar', 'espaciado', 'corte', 'pase', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'pasar y cortar en 2c2 recibiendo en el corte',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, jugando 3c3. Se cambian ataque y defensa cada cuatro canastas; nadie fuera.',
      niveles: {
        base: 'sin defensa: tres atacantes encadenando pase, corte y reemplazo.',
        intermedio: '3c3 sin bote con reemplazo obligatorio.',
        avanzado: '3c3 con un bote permitido y el reemplazo tiene que llegar antes de que el balón cambie de manos.',
      },
      criterio_exito: 'el ataque encadena al menos tres pases con reemplazo antes de tirar en la mitad de las posesiones',
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
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.332, y: 0.6269 } },
        ] },
        // A1 corta y A3 ocupa el sitio que A1 acaba de dejar
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.2295, y: 0.5385 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2979, y: 0.5296 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: M.base[0], y: M.base[1] } },
          { jugador: 'B3', tipo: 'defiende', marca: 'A3', hacia: { x: 0.3662, y: 0.4766 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A3' }] },
      ],
    },
  },
  {
    name: 'Corte por delante o por detrás',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El cortador tiene que elegir el lado según dónde le mire el defensor, y el pasador servir el balón por el lado que toca.',
    objetivos: 'Convertir el corte en una lectura y no en un recorrido, que es lo que separa el pasar y cortar que funciona del que se ve venir.',
    descripcion_texto: 'Pasador en la punta y compañero en el 45 con su defensor. Se pasa y se corta: si el defensor mira el balón, se corta por detrás de él; si mira al cortador, se corta por delante. El pasador tiene que servir picado o por encima según el lado. Cuatro cortes y rotan los tres papeles.',
    notas: 'Puntos clave: se mira la CABEZA del defensor, que es lo que dice a dónde está atendiendo; y el cambio de ritmo al iniciar el corte importa más que el lado elegido. Error frecuente: cortar siempre por el mismo sitio, con lo que el defensor lo aprende en dos posesiones. Otro, del pasador: dar el pase antes de ver por dónde ha cortado. Como entrenador pregunta después de cada corte: «¿dónde miraba?». Si no lo saben, no estaban leyendo: estaban corriendo.',
    tags: ['pasar y cortar', 'corte', 'lectura', 'pase picado', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'cortar cambiando de ritmo y pedir el balón con la mano de fuera',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos tríos por canasta trabajando desde los dos 45. Rotan los tres papeles cada cuatro cortes.',
      niveles: {
        base: 'el defensor anuncia en voz alta a dónde mira.',
        intermedio: 'el defensor elige y el cortador lee.',
        avanzado: 'el defensor puede cambiar la mirada mientras el corte ya ha empezado.',
      },
      criterio_exito: 'el cortador acierta el lado en tres de cada cuatro y recibe cómodo',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.04, M.escolta_izq[1] - 0.04),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el defensor mira el balón: se corta por detrás de él
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2409, y: 0.4147 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2979, y: 0.3793 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ ACLARADO ═════════════════════════════════════════════ */
  {
    name: 'Aclarar y contar hasta tres',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El compañero se lleva a su defensor al lado contrario y el del balón tiene tres segundos de uno contra uno limpio.',
    objetivos: 'Enseñar que despejar el espacio es una acción de ataque, aunque el que la hace no toque el balón.',
    descripcion_texto: 'Dos contra dos en media pista. Cuando uno de los dos atacantes recibe en el 45, el otro tiene que aclarar: irse al lado contrario, más allá de la zona, llevándose a su defensor. Desde ahí, el del balón cuenta tres segundos en voz alta y ataca. Si el que aclara vuelve antes, la posesión se anula. Cuatro posesiones y rotan.',
    notas: 'Puntos clave: aclarar es irse LEJOS y quedarse disponible, no esconderse en una esquina de espaldas; y el que ataca tiene que empezar antes de que la ayuda se acuerde de volver. Error frecuentísimo: el que aclara se va dos metros y su defensor sigue pudiendo ayudar — si el defensor puede tocar a los dos, no ha aclarado nada. Como entrenador, mide con los pies: el que aclara tiene que estar al otro lado de la zona. Es el recurso que más rápido da puntos en mini y casi nadie lo enseña.',
    tags: ['aclarado', 'espaciado', '1c1', 'ventaja', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'resolver el uno contra uno con bote hacia los dos lados',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas: dos juegan y la tercera espera y cuenta los tres segundos en voz alta.',
      niveles: {
        base: 'el que aclara se coloca fijo en la esquina contraria antes de empezar.',
        intermedio: 'aclarado en movimiento y tres segundos para atacar.',
        avanzado: 'el que aclaró puede volver a recibir si el ataque no ha salido en tres segundos.',
      },
      criterio_exito: 'las cuatro posesiones con el que aclara al otro lado de la zona y su defensor con él',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // aclarar: irse LEJOS y llevarse al defensor
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2182, y: 0.2025 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2637, y: 0.2379 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2637, y: 0.5915 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Aclarado con salida de emergencia',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Si el uno contra uno del aclarado no sale, el que aclaró vuelve a pedirla: el aclarado no es un billete de ida.',
    objetivos: 'Cerrar el aclarado por el otro lado: qué se hace cuando el uno contra uno no aparece, que es la mitad de las veces.',
    descripcion_texto: 'Dos contra dos con aclarado, igual que el anterior, pero con una regla más: si el del balón no ha atacado en tres segundos, el que aclaró tiene que volver a ofrecerse subiendo hacia el balón, y el del balón está obligado a pasársela. Desde ahí se juega libre. Cuatro posesiones y rotan.',
    notas: 'Puntos clave: el que vuelve sube al balón con las manos preparadas y en línea, no en diagonal, o el pase no existe; y el del balón tiene que verle sin dejar de mirar al aro. Error frecuentísimo: quedarse botando de lado esperando a que pase algo, que es como se pierden las posesiones en mini. Esta ficha existe porque el aclarado enseñado a medias produce jugadores que se atascan: hay que enseñar la salida a la vez que la entrada.',
    tags: ['aclarado', 'toma de decisiones', 'pase', 'espaciado', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'aclarar el lado y resolver el uno contra uno desde el 45',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por canasta: dos juegan y la tercera cuenta los tres segundos en voz alta.',
      niveles: {
        base: 'el que aclaró vuelve siempre y solo se practica el pase de vuelta.',
        intermedio: 'vuelve solo si no ha habido ataque en tres segundos.',
        avanzado: 'al recibir de vuelta, el que aclaró tiene dos segundos para atacar o volver a mover el balón.',
      },
      criterio_exito: 'ninguna posesión se muere botando: o hay ataque en tres segundos o hay pase de vuelta',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, 0.2409, 0.2202),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, 0.2751, 0.2556),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el 1c1 no aparece: el defensor aguanta
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.4004, y: 0.6092 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3662, y: 0.5915 } },
        ] },
        // el que aclaró sube EN LÍNEA a ofrecerse
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.4231, y: 0.2909 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.389, y: 0.3174 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
      ],
    },
  },

  /* ═══ MANO A MANO Y CONTINUACIÓN ═══════════════════════════ */
  {
    name: 'Mano a mano y el que entrega se va al aro',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Se entrega el balón en mano y el que lo entrega no se queda: corta al aro aprovechando que su defensor mira el balón.',
    objetivos: 'Enseñar la continuación en su forma más simple, que es la del mano a mano: el que da también ataca.',
    descripcion_texto: 'Un atacante con balón en el codo y otro que llega desde el 45 con su defensor. Se entrega el balón en mano, cuerpo con cuerpo, y en cuanto lo suelta el que entrega corta hacia el aro pidiendo. El que recibe decide: ataca él o le devuelve el balón al que cortó. Cuatro repeticiones y rotan los cuatro papeles.',
    notas: 'Puntos clave: la entrega se hace parado y protegiendo con el cuerpo, para que el defensor no pueda meterse entre los dos; y el corte sale INMEDIATAMENTE, porque la ventaja dura lo que tarda su defensor en volver a mirarle. Error frecuentísimo: entregar y quedarse quieto, con lo que el mano a mano se convierte en un pase raro. Otro: entregar en movimiento y perder el balón en el intercambio. Empieza siempre con los dos parados.',
    tags: ['juego reducido', 'continuación', 'corte', 'pase', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'entregar y recibir el balón en mano sin perderlo y cortar cambiando de ritmo',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos cuartetos por canasta que trabajan en lados opuestos y rotan los cuatro papeles.',
      niveles: {
        base: 'sin defensa: entrega, corte y devolución.',
        intermedio: '2c2 con la entrega parada y corte obligatorio.',
        avanzado: 'la entrega se hace en movimiento y el que recibe decide entre atacar o servir el corte.',
      },
      criterio_exito: 'las cuatro entregas terminan con el que entregó cortando de verdad hacia el aro',
    },
    tablero: () => [
      jug('A', 1, M.codo_der[0], M.codo_der[1]),
      jug('A', 2, M.escolta_der[0] + 0.04, M.escolta_der[1]),
      jug('B', 1, M.codo_der[0] - 0.05, M.codo_der[1]),
      jug('B', 2, M.escolta_der[0] - 0.02, M.escolta_der[1] + 0.02),
      balon(M.codo_der[0], M.codo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.3434, y: 0.6092 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.3776, y: 0.6269 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        // el que entrega no se queda: corta al aro
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.2182, y: 0.5561 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2865, y: 0.5738 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Bloqueo indirecto: salir o quedarse',
    type: '3vs3', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El que usa un bloqueo sin balón elige según cómo le sigan: sale por fuera si le persiguen, se queda dentro si le cortan el camino.',
    objetivos: 'Aprender que un bloqueo no da una jugada sino dos, y que la elige el que lo usa mirando a su defensor.',
    descripcion_texto: 'Tres atacantes: uno con balón en la punta, otro que pone el bloqueo en el codo y otro que lo usa desde la esquina. El que usa el bloqueo mira a su defensor: si le sigue por detrás, sale hacia fuera a recibir; si le cortan por arriba, se mete hacia el aro. El pasador sirve donde haya ventaja. Tres repeticiones y rotan los seis papeles.',
    notas: 'Puntos clave: el bloqueador se planta QUIETO y con los pies anchos, o es falta; el que usa el bloqueo pasa rozándole, porque un hueco entre los dos es por donde pasa el defensor. Error frecuentísimo: salir siempre por fuera aunque esté cortado, que es hacer el recorrido en vez de leer. Ojo con el reglamento y con los cuerpos a esta edad: bloqueo quieto, sin abrir las piernas al último momento y sin apoyar las manos.',
    tags: ['bloqueo indirecto', 'lectura', 'desmarque', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'resolver el uno contra uno sin balón desmarcándose con cambio de dirección',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, jugando el 3c3 completo y rotando los seis papeles cada tres repeticiones.',
      niveles: {
        base: 'el defensor sigue siempre por detrás y solo se practica salir por fuera.',
        intermedio: 'el defensor elige y el que usa el bloqueo lee.',
        avanzado: 'los dos defensores pueden cambiarse el par, y el ataque tiene que ver el cambio y castigarlo.',
      },
      criterio_exito: 'el que usa el bloqueo elige bien en dos de cada tres, reciba o no',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.codo_izq[0], M.codo_izq[1]),
      jug('A', 3, 0.2182, 0.2202),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      jug('B', 2, M.codo_izq[0] - 0.05, M.codo_izq[1]),
      jug('B', 3, 0.2637, 0.2556),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el bloqueador se planta y el usuario sale rozándole
        { eventos: [
          { jugador: 'A2', tipo: 'bloqueo', bloqueado_id: 'A3' },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.332, y: 0.3263 } },
          { jugador: 'B3', tipo: 'defiende', marca: 'A3', hacia: { x: 0.2865, y: 0.2909 } },
          // los otros dos defensores no se quedan de estatuas: uno
          // ajusta al balón y el del bloqueador tiene que decidir si
          // ayuda en el cruce o se queda con el suyo (D11)
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3776, y: 0.4943 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.3093, y: 0.4147 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A3' }] },
        { eventos: [{ jugador: 'A3', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ BLOQUEO DIRECTO ══════════════════════════════════════
     Dos fichas de nueve, y las dos con el requisito previo bien
     puesto: D23 lo mete cuando el 1c1 está resuelto, no por edad.
     Antes de eso, un bloqueo solo junta a dos que no saben qué
     hacer con la ventaja. */
  {
    name: 'Directo: leer al defensor del bloqueador',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 5, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Quien lleva el balón usa el bloqueo y decide mirando al defensor del bloqueador: si sale a por él, hay pase; si se queda, hay tiro o entrada.',
    objetivos: 'Que el bloqueo directo entre como una lectura y no como una coreografía de dos que se cruzan.',
    descripcion_texto: 'Dos contra dos en el 45. Uno lleva el balón y el otro le pone el bloqueo. El botador tiene que pasar pegado al bloqueador y mirar al defensor de este: si sale a cortarle, el bloqueador queda libre y hay pase; si se queda abajo, hay espacio para tirar o entrar. Tres posesiones y se cambian los papeles.',
    notas: 'Puntos clave: se pasa ROZANDO al bloqueador —un hueco es por donde vuelve el defensor— y la mirada va al defensor de abajo mientras se bota. Error frecuentísimo: botar mirando el aro y no enterarse de nada, con lo que el bloqueo no ha servido para nada. Aviso de método: no montes esto con un grupo que aún no resuelve el uno contra uno (D23). Si el que lleva el balón no sabe atacar un hueco, un bloqueo solo le da un hueco que no va a usar.',
    tags: ['bloqueo directo', 'lectura', 'toma de decisiones', 'ventaja', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'resolver el uno contra uno con bote hacia los dos lados y terminar cerca del aro',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas: una pareja ataca, otra defiende y la tercera espera. Rotan cada tres posesiones.',
      niveles: {
        base: 'sin defensa: solo pasar pegado al bloqueo y decidir con el compañero.',
        intermedio: '2c2 con el defensor del bloqueador eligiendo salir o quedarse.',
        avanzado: 'los dos defensores pueden cambiarse el par y el ataque tiene que verlo.',
      },
      criterio_exito: 'la decisión es la correcta en dos de cada tres usos del bloqueo',
    },
    tablero: () => [
      // el bloqueador arranca por encima del defensor del balón: pegado
      // del todo, las dos fichas se dibujan una sobre otra y no se ve
      // dónde está el bloqueo, que es lo único que hay que mirar aquí
      jug('A', 1, M.escolta_der[0] + 0.04, M.escolta_der[1]),
      jug('A', 2, 0.373, 0.5915),
      jug('B', 1, M.escolta_der[0] - 0.02, M.escolta_der[1]),
      jug('B', 2, M.codo_der[0] - 0.03, M.codo_der[1] + 0.03),
      balon(M.escolta_der[0] + 0.04, M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'bloqueo', bloqueado_id: 'A1' },
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.332, y: 0.5738 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3662, y: 0.6092 } },
        ] },
        // el defensor del bloqueador SALE a por el balón: el bloqueador
        // queda libre y se va al aro, que es donde ya no hay nadie
        { eventos: [
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.2979, y: 0.5561 } },
          { jugador: 'A2', tipo: 'corte', hacia: 'aro' },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Continuación: el bloqueador rueda al aro',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 5, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Después de bloquear no se descansa: se gira y se va al aro, que es donde nadie está mirando.',
    objetivos: 'Cerrar el bloqueo directo por donde de verdad hace daño en mini: el bloqueador que rueda a un aro vacío.',
    descripcion_texto: 'Dos contra dos igual que el anterior, pero ahora el bloqueador está obligado a rodar hacia el aro en cuanto el botador pasa a su lado: gira sobre el pie de dentro, abre el pecho al balón y va. El botador decide entre servirle o terminar él. Tres posesiones y se cambian los papeles.',
    notas: 'Puntos clave: se gira sobre el pie MÁS CERCANO al balón para no perderlo de vista, y se va con las manos pedidas; el pase que llega es picado casi siempre, porque hay cuerpos en medio. Error frecuentísimo: rodar de espaldas al balón, con lo que ni ve el pase ni el pasador le ve. Otro: rodar tarde, cuando la ayuda ya se ha colocado. A esta edad la continuación es más rentable que el tiro tras bloqueo: el aro suele quedarse solo, y ahí es donde hay que insistir.',
    tags: ['bloqueo directo', 'continuación', 'finalización', 'pase picado', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'usar un bloqueo directo leyendo al defensor del bloqueador',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por canasta rotando ataque, defensa y espera cada tres posesiones.',
      niveles: {
        base: 'sin defensa: bloqueo, continuación y pase al aro.',
        intermedio: '2c2 con continuación obligatoria.',
        avanzado: '2c2 y el bloqueador elige entre rodar al aro o abrirse fuera según dónde esté la ayuda.',
      },
      criterio_exito: 'las tres continuaciones salen de cara al balón y con las manos pedidas',
    },
    tablero: () => [
      // mismo motivo que en la ficha anterior: el bloqueador arranca
      // por encima del defensor del balón para que el bloqueo se vea
      jug('A', 1, M.escolta_izq[0] + 0.04, M.escolta_izq[1]),
      jug('A', 2, 0.373, 0.4076),
      jug('B', 1, M.escolta_izq[0] - 0.02, M.escolta_izq[1]),
      jug('B', 2, M.codo_izq[0] - 0.03, M.codo_izq[1] - 0.03),
      balon(M.escolta_izq[0] + 0.04, M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'bloqueo', bloqueado_id: 'A1' },
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.332, y: 0.4324 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3662, y: 0.397 } },
        ] },
        // el bloqueador rueda al aro de cara al balón, y llega HASTA el
        // aro: la continuación que se para a media distancia no es una
        // continuación, es un tiro sin nadie que lo haya generado
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: 'aro' },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2751, y: 0.4147 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
];
