/* ============================================================
   tanda-05.mjs — manejo, juego de pies, rebote, calentamiento y
   psicomotricidad.

   Los cinco bloques que iban a una ficha. Son los que más fácil se
   escriben mal, porque son justo donde vive el ejercicio de circo:
   manejo descontextualizado, calentamientos sin balón y
   psicomotricidad que no lleva a ninguna parte.

   Doctrina que gobierna esta tanda:
     D20 · «entrenar baloncesto, no bote aislado». El criterio que
           separa un ejercicio de manejo bueno de uno de circo es si el
           jugador tiene ALGO QUE MIRAR que no sea el balón.
     D4  · densidad medida; estos bloques son los que más se prestan a
           la fila larga y hay que vigilarlos.
     D9  · psicomotricidad es el único bloque que SÍ se acota por
           categoría, porque ahí el ejercicio es específico de verdad.
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_05 = [

  /* ═══ MANEJO ═══════════════════════════════════════════════ */
  {
    name: 'Dos balones y un compañero',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Botar dos balones a la vez mientras el compañero de enfrente marca lo que hay que hacer con el cuerpo.',
    objetivos: 'Ganar control de las dos manos a la vez sin caer en el manejo descontextualizado: siempre hay que estar mirando algo.',
    descripcion_texto: 'Por parejas enfrentadas a cuatro metros. Uno bota dos balones —alternos, simultáneos o uno alto y otro bajo— y el otro va cambiando de posición: si se agacha, hay que botar bajo; si levanta los brazos, alto; si se desplaza a un lado, hay que seguirle sin dejar de botar. Treinta segundos y cambio.',
    notas: 'Puntos clave: cada mano trabaja por su cuenta, y eso es lo que cuesta; el bote alterno es más difícil que el simultáneo y por ahí hay que empezar al revés de lo que parece. IMPORTANTE (D20): dos balones sin nada que mirar es un ejercicio de circo que no transfiere. El compañero no es un adorno: es lo que hace que esto sea baloncesto. Si lo quitas, quítalo del entrenamiento entero.',
    variantes: 'Base: dos balones simultáneos en el sitio, sin compañero, quince segundos. Intermedio: alternos, con compañero marcando altura. Avanzado: alternos, con compañero que se desplaza y hay que seguirle, más un cambio de mano cruzando los dos balones.',
    tags: ['bote', 'coordinación', 'mano no dominante', 'cabeza levantada'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'pasiva',
      requisito_previo: 'botar con cada mano por separado sin mirar el balón',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: seis parejas a la vez, repartidas a lo ancho de la pista y separadas cuatro metros. Treinta segundos y se cambia quien bota.',
      criterio_exito: 'treinta segundos sin perder ninguno de los dos balones y respondiendo a todas las señales',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.30), jug('B', 1, 0.48, 0.30),
      jug('A', 2, 0.34, 0.70), jug('B', 2, 0.48, 0.70),
      // los dos balones de cada botador, separados: puestos en la MISMA
      // coordenada se dibujaban uno encima del otro y parecía uno solo,
      // en el ejercicio que se llama precisamente "dos balones"
      balon(0.325, 0.285), balon(0.325, 0.315),
      balon(0.325, 0.685), balon(0.325, 0.715),
    ],
    intent: null,
  },
  {
    name: 'Recoge y protege',
    type: '1vs1', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'El balón está en el suelo y dos van a por él: quien lo coja tiene que protegerlo tres segundos.',
    objetivos: 'Ganar la posesión de un balón suelto y protegerlo inmediatamente, que es una situación de partido y casi nadie entrena.',
    descripcion_texto: 'Dos jugadores enfrentados a tres metros de un balón en el suelo. A la señal van los dos. Quien lo coge tiene que protegerlo tres segundos sin que el otro se lo quite: puede pivotar, agacharse y usar el cuerpo, pero no salir corriendo. Al tercer segundo, sale botando y ataca la canasta.',
    notas: 'Puntos clave: se coge con las dos manos y se lleva inmediatamente al pecho o a la cadera lejos del rival, nunca por encima de la cabeza; se abren los codos —firme, sin golpear— y se baja el centro de gravedad. Error frecuente: coger el balón y quedarse de pie erguido, que es regalarlo. Vigila los codos: firmes sí, girando como aspas no.',
    variantes: 'Base: el balón se le entrega a uno y el otro llega un segundo después. Intermedio: los dos salen a la vez. Avanzado: tres jugadores a por el mismo balón.',
    tags: ['bote de protección', 'pivote', '1c1', 'competición', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'pivotar sin levantar el pie de apoyo',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: seis parejas repartidas por la pista, sin canastas. Se cambia de rol cada treinta segundos.',
      criterio_exito: 'quien coge el balón lo conserva los tres segundos en tres de cada cuatro duelos',
    },
    tablero: () => [
      jug('A', 1, 0.52, 0.42), jug('B', 1, 0.52, 0.58),
      balon(0.46, 0.50),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: { x: 0.46, y: 0.50 } }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Manejo en el caos',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Todos botando en un espacio cada vez más pequeño, esquivándose sin chocar ni perder el balón.',
    objetivos: 'Controlar el balón mientras el espacio se llena de gente, que es la única forma realista de entrenar el manejo.',
    descripcion_texto: 'Todos con balón dentro de un espacio marcado con conos. Cada treinta segundos se reduce el espacio moviendo los conos hacia dentro. Nadie puede chocar ni perder el balón. Al final quedan todos apretados en un cuadrado pequeño y el bote tiene que ser bajo y protegido por fuerza.',
    notas: 'Puntos clave: cuando el espacio se reduce, el bote baja solo — y esa es la lección, que no hace falta explicarla; la cabeza tiene que estar arriba para no chocar. Error frecuente: mirar el suelo cuando aumenta la presión, que es justo cuando hay que mirar más. Este ejercicio es el ejemplo de manejo bien planteado: no hay que decir "mira arriba", el espacio lo obliga.',
    variantes: 'Base: espacio amplio y fijo. Intermedio: el espacio se reduce cada treinta segundos. Avanzado: además hay dos jugadores sin balón que intentan tocar balones ajenos.',
    tags: ['bote', 'cabeza levantada', 'bote de protección', 'coordinación', 'competición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva',
      requisito_previo: 'botar en movimiento sin mirar el balón continuamente',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: los doce a la vez dentro de una media pista, un balón cada uno. Si sobra espacio, se estrecha con conos.',
      criterio_exito: 'llegar al espacio más pequeño sin haber chocado ni perdido el balón',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.32), jug('A', 2, 0.34, 0.66), jug('A', 3, 0.50, 0.32),
      jug('A', 4, 0.50, 0.66), jug('A', 5, 0.42, 0.50),
      cono(0.28, 0.24), cono(0.28, 0.76), cono(0.58, 0.24), cono(0.58, 0.76),
      balon(0.34, 0.32), balon(0.34, 0.66), balon(0.50, 0.32), balon(0.50, 0.66), balon(0.42, 0.50),
    ],
    intent: null,
  },

  /* ═══ JUEGO DE PIES ════════════════════════════════════════ */
  {
    name: 'Parada en un tiempo tras recepción',
    type: 'Pase', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Recibir corriendo y frenar con los dos pies a la vez, quedando libre para pivotar con cualquiera.',
    objetivos: 'Dominar la parada simultánea, que deja los dos pies disponibles y por eso da más opciones que la de dos tiempos.',
    descripcion_texto: 'Fila en la esquina, pasador en la punta. Se corre hacia el 45 recibiendo en carrera y se para con los DOS pies a la vez, quedando de cara al aro. Después se pivota una vez con cada pie para comprobar que ninguno está bloqueado, y se tira. Un compañero con las manos arriba obliga a hacerlo con algo de prisa.',
    notas: 'Puntos clave: los dos pies tocan el suelo a la vez y con las rodillas flexionadas, si no es parada en dos tiempos aunque lo parezca; el balón se recoge antes del último salto. Error frecuente: caer con un pie ligerísimamente antes, que ya bloquea el pivote — se ve mirando desde el lado, no de frente. Enseña las dos paradas, pero no las mezcles en el mismo ejercicio hasta que cada una salga sola.',
    variantes: 'Base: andando, sin pase, solo la parada y los dos pivotes. Intermedio: en carrera con pase y compañero con manos arriba. Avanzado: la parada llega tras un cambio de dirección, que es cuando de verdad cuesta caer a la vez.',
    tags: ['parada', 'pivote', 'recepción', 'tiro tras recepción'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'pasiva',
      requisito_previo: 'recibir en carrera sin que se le escape el balón',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 40 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cuatro, un pasador y el que molesta con las manos arriba. Rotan los tres papeles.',
      criterio_exito: 'ocho paradas de ocho con los dos pies a la vez, comprobado pivotando con ambos',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      fila(M.esquina_der[0], M.esquina_der[1], 4, 0),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'corte', hacia: 'escolta_der' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'fila1' }, { jugador: 'B1', tipo: 'defiende', marca: 'fila1' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Fintas de recepción',
    type: '1vs1', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Ir hacia dentro para salir fuera, o al revés: separarse del defensor con los pies antes de pedir el balón.',
    objetivos: 'Aprender que el desmarque se gana con una finta de pies, no corriendo más rápido.',
    descripcion_texto: 'Pasador en la punta. Atacante en el 45 con defensor pegado. El atacante tiene que hacer una finta clara —tres pasos hacia canasta y salida rápida al 45, o al revés— antes de pedir. Solo cuenta el balón recibido después de una finta; si recibe sin fintar, no vale. Cinco intentos y se rota.',
    notas: 'Puntos clave: la finta tiene que ser larga y creíble —tres pasos, no uno—, con cambio de ritmo al salir; se pide con la mano de fuera. Error frecuente: fintar con la cabeza o con medio paso, que no se lo cree nadie. Como entrenador, mira al DEFENSOR: si no ha movido los pies, la finta no existió. Es el ejercicio hermano del desmarque, pero centrado en los apoyos.',
    variantes: 'Base: el defensor sigue sin anticipar y la finta se hace despacio y marcada. Intermedio: defensa normal y finta a velocidad. Avanzado: el defensor puede adelantarse, con lo que a veces la respuesta correcta es la puerta atrás y no la finta de salida.',
    tags: ['finta', 'desmarque', 'recepción', 'cambio de ritmo', '1c1'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'semiactiva',
      requisito_previo: 'correr cambiando de dirección sin perder el equilibrio',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, receptor y defensor. Rotan cada tres recepciones.',
      criterio_exito: 'el defensor mueve los pies con la finta en cuatro de cada cinco intentos',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1] - 0.03),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'poste_bajo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'escolta_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
      ],
    },
  },
  {
    name: 'Pivotar con presión',
    type: 'Pase', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Recibir con un defensor encima y encontrar el pase pivotando, sin botar y sin perder el balón.',
    objetivos: 'Usar el pivote para cambiar el ángulo de pase, que es para lo que sirve de verdad y no para ganar tiempo.',
    descripcion_texto: 'Tres atacantes formando un triángulo amplio y un defensor que presiona siempre al que tiene el balón. No se puede botar. Quien recibe tiene que pivotar para abrir línea de pase y soltarla en menos de tres segundos. Diez pases seguidos es un punto. El defensor cambia cada dos puntos.',
    notas: 'Puntos clave: se pivota HACIA ATRÁS para alejar el balón del defensor y luego se abre; el balón viaja pegado al cuerpo durante el giro, nunca por delante. Error frecuente: pivotar hacia delante metiendo el balón en las manos del defensor. Otro: pivotar mucho y no pasar nunca — el pivote es para encontrar el pase, no para esconderse.',
    variantes: 'Base: defensor pasivo que solo levanta los brazos. Intermedio: presión real y tres segundos. Avanzado: dos defensores y máximo dos segundos.',
    tags: ['pivote', 'pase', 'recepción', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'pivotar sobre los dos pies sin levantar el de apoyo',
      dosis: { series: 3, cantidad: 10, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: seis parejas repartidas por la pista, sin canastas. Se cambia de rol cada treinta segundos.',
      criterio_exito: 'llegar a diez pases seguidos sin pérdida al menos dos veces por serie',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.32), jug('A', 2, 0.34, 0.68), jug('A', 3, 0.56, 0.50),
      jug('B', 1, 0.38, 0.36),
      balon(0.34, 0.32),
    ],
    intent: null,
  },
  {
    name: 'Salida directa y salida cruzada',
    type: 'Bote', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Las dos formas de salir botando desde parado, eligiendo según por dónde te defiendan.',
    objetivos: 'Tener dos salidas distintas y saber cuál toca, en vez de una sola que el defensor ya conoce.',
    descripcion_texto: 'Atacante en el 45 con balón parado y defensor delante ligeramente ladeado. Si el defensor tapa el lado derecho, salida cruzada por la izquierda; si tapa la izquierda, salida directa por la derecha. El defensor elige lado antes de cada repetición y lo mantiene. Cinco salidas y se cambia.',
    notas: 'Puntos clave: en la salida directa el primer paso va con el pie del mismo lado y el balón sale antes que el pie; en la cruzada, el pie de fuera cruza por delante del defensor pegado a él, no dando un rodeo. Error frecuente en la cruzada: separarse al cruzar, con lo que el defensor la ve venir y la corta. Y ojo con los pasos: el balón bota ANTES de levantar el pie de pivote.',
    variantes: 'Base: solo salida directa, defensor estático que tapa siempre el mismo lado. Intermedio: las dos salidas, el defensor elige y lo mantiene. Avanzado: el defensor puede cambiar de lado mientras el atacante finta.',
    tags: ['salida en bote', 'pivote', 'finta', 'bote', 'lectura'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva',
      requisito_previo: 'botar con las dos manos y pivotar sin levantar el pie de apoyo',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: seis parejas, tres en cada canasta, cada una en un punto distinto del perímetro.',
      criterio_exito: 'elegir la salida correcta en cinco de cada cinco, y ningún paso',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1] + 0.03),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ REBOTE ═══════════════════════════════════════════════ */
  {
    name: 'Rebote ofensivo tras tiro propio',
    type: 'Defensa', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Tirar y salir inmediatamente a por el rebote propio, ganando la espalda del que intenta bloquear.',
    objetivos: 'Instalar el reflejo de seguir el tiro, y aprender a escapar de un bloqueo de rebote.',
    descripcion_texto: 'El atacante tira desde el codo y su defensor intenta bloquearle el rebote. El atacante tiene que reaccionar antes que el defensor y rodearle por el lado contrario al que se gira. Si coge el rebote, tiene un tiro extra que vale doble. Cinco tiros cada uno.',
    notas: 'Puntos clave: se sale a por el rebote EN el tiro, no cuando el balón toca el aro; se rodea al bloqueador por el lado contrario al que gira, con un paso corto y el contacto ganado. Error frecuente: quedarse mirando el propio tiro, que es lo que hace todo el mundo. Segundo: empujar por la espalda en vez de rodear, que es falta. El tiro extra que vale doble hace el trabajo de motivación solo.',
    variantes: 'Base: el defensor no bloquea, solo va al rebote; el atacante practica salir en el tiro. Intermedio: el defensor bloquea de verdad. Avanzado: dos contra dos al rebote tras tiro del entrenador.',
    tags: ['rebote ofensivo', 'bloqueo de rebote', 'tiro', 'competición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'tirar desde el codo y mantener el equilibrio al caer',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: seis parejas, tres en cada canasta, cada una en un lado distinto de la zona.',
      criterio_exito: 'salir a por el rebote antes de que el balón toque el aro en cuatro de cada cinco tiros',
    },
    tablero: () => [
      jug('A', 1, M.codo_der[0], M.codo_der[1]),
      jug('B', 1, M.codo_der[0] - 0.05, M.codo_der[1]),
      balon(M.codo_der[0], M.codo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
      ],
    },
  },
  {
    name: 'Tres contra tres al rebote',
    type: '3vs3', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'El entrenador tira y seis jugadores pelean el rebote: tres bloquean y tres intentan escaparse.',
    objetivos: 'Trasladar el bloqueo de rebote a una situación de verdad, con tres parejas a la vez y el balón cayendo donde caiga.',
    descripcion_texto: 'Tres atacantes repartidos por el perímetro con sus tres defensores. El entrenador tira. Cada defensor busca a su par y bloquea; después se va el balón. El equipo que coge el rebote suma punto; si lo coge el ataque, tiene un tiro extra libre. Se juega a cinco.',
    notas: 'Puntos clave: primero se encuentra al par y después el balón, incluso si el balón viene hacia ti — es contraintuitivo y hay que insistir; el contacto se mantiene un segundo y luego se va al balón. Error frecuente: los tres defensores van al balón y el ataque coge rebotes fáciles. Truco: los dos primeros minutos, prohíbe coger el rebote. Solo bloquear. Cuando eso salga, se levanta la prohibición.',
    variantes: 'Base: dos contra dos y el entrenador avisa desde dónde tira. Intermedio: tres contra tres. Avanzado: tres contra tres y el ataque puede moverse antes del tiro, con lo que hay que encontrar al par en movimiento.',
    tags: ['rebote defensivo', 'bloqueo de rebote', 'rebote ofensivo', 'defensa individual', 'competición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'hacer contacto de bloqueo con el cuerpo sin empujar con las manos',
      dosis: { series: 4, cantidad: 5, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, jugando 3c3 al rebote. Nadie fuera.',
      criterio_exito: 'la defensa coge cuatro de cada cinco rebotes cuando los tres bloquean',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]), jug('A', 3, M.esquina_der[0], M.esquina_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]), jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]), jug('B', 3, M.esquina_der[0] - 0.05, M.esquina_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },

  /* ═══ CALENTAMIENTO ════════════════════════════════════════ */
  {
    name: 'Movilidad con balón',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 2, duration_min: 5, duration_max: 8,
    description: 'Recorrido de movilidad articular haciendo pasar el balón por debajo de la pierna, alrededor del cuerpo y por encima.',
    objetivos: 'Preparar el cuerpo sin separar al niño del balón, que es tiempo de contacto que no se recupera después.',
    descripcion_texto: 'Andando de un fondo al otro, cada tramo con un gesto: rodillas al pecho pasando el balón por debajo de la pierna que sube; talones al glúteo con el balón alrededor de la cintura; zancada con el balón por encima de la cabeza; y desplazamiento lateral con el balón rodeando las rodillas. Ida y vuelta dos veces.',
    notas: 'Puntos clave: el gesto de movilidad manda y el balón acompaña, no al revés; si por hacer el balón se hace mal la zancada, se quita el balón en esa. Es calentamiento, así que el ritmo es tranquilo. Lo único que hay que vigilar es que no se convierta en una carrera. En minibasket el calentamiento sin balón es tiempo perdido: siempre hay una forma de meterlo.',
    variantes: 'Base: solo dos gestos, con el balón sostenido sin manipular. Intermedio: los cuatro gestos con manipulación. Avanzado: los cuatro gestos botando con la otra mano al mismo tiempo.',
    tags: ['calentamiento', 'activación', 'coordinación', 'equilibrio'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'media', oposicion: 'nula',
      requisito_previo: 'sostener y manipular el balón con las dos manos en movimiento',
      dosis: { series: 2, cantidad: 4, unidad: 'repeticiones', descanso: 30 },
      organizacion: 'Con 12: los doce a la vez recorriendo la pista a lo largo, en dos filas de seis para que no se pisen.',
      criterio_exito: 'completar los cuatro tramos sin que se caiga el balón y sin perder la calidad del gesto',
      aplicacion: 'todo el bloque de manejo: es el mismo control de balón, aquí sin exigencia',
    },
    tablero: () => [
      jug('A', 1, 0.62, 0.25), jug('A', 2, 0.62, 0.45), jug('A', 3, 0.62, 0.65), jug('A', 4, 0.62, 0.85),
      balon(0.62, 0.25), balon(0.62, 0.45), balon(0.62, 0.65), balon(0.62, 0.85),
    ],
    intent: null,
  },
  {
    name: 'Relevo de calentamiento por equipos',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 4, duration_min: 5, duration_max: 10,
    description: 'Relevos por equipos con balón: ida botando, tarea en el cono y vuelta pasando al siguiente.',
    objetivos: 'Subir pulsaciones compitiendo, que es la forma en que un niño calienta de verdad sin darse cuenta.',
    descripcion_texto: 'Dos o tres equipos en filas. El primero sale botando hasta el cono, hace la tarea que toque —cinco cambios de mano, dos vueltas al cono botando bajo, o cinco pases contra la pared— y vuelve para entregar el balón en mano al siguiente. Gana el equipo que termine antes. Tres rondas con tarea distinta.',
    notas: 'Puntos clave: la entrega es en mano, no un pase lanzado, para que no se pierda tiempo persiguiendo balones; la tarea se hace completa aunque se vaya perdiendo. Error habitual y divertido: hacen cuatro cambios en vez de cinco cuando van perdiendo. Ponles un juez de cada equipo en el cono contrario y se acaba. Filas de cuatro como mucho (D5).',
    variantes: 'Base: relevo simple de ida y vuelta botando. Intermedio: con tarea en el cono. Avanzado: con tarea en el cono y con la mano no dominante todo el recorrido.',
    tags: ['calentamiento', 'activación', 'bote', 'competición', 'cambio de mano'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 4,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'botar en carrera sin perder el balón',
      dosis: { series: 3, cantidad: 2, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: cuatro equipos de tres en la línea de fondo, compitiendo a la vez a lo largo de la pista.',
      criterio_exito: 'todos completan su tarea entera, gane quien gane',
    },
    /* Las filas van en x=0.54 y no más atrás: la cola se dibuja hacia
       la derecha con un paso de 0.06 por jugador, así que una fila de
       cuatro ocupa 0.24 y desde 0.66 el último caía en 0.90 — por
       detrás de la línea de medio campo, que en esta pista está en
       0.829. Lo cazó el linter comprobando los límites MEDIDOS. */
    tablero: () => [
      fila(0.54, 0.30, 4, 0), fila(0.54, 0.50, 4, 0), fila(0.54, 0.70, 4, 0),
      cono(0.24, 0.30), cono(0.24, 0.50), cono(0.24, 0.70),
      balon(0.54, 0.30), balon(0.54, 0.50), balon(0.54, 0.70),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.24, y: 0.30 } }, { jugador: 'fila2', tipo: 'bote', hacia: { x: 0.24, y: 0.50 } }, { jugador: 'fila3', tipo: 'bote', hacia: { x: 0.24, y: 0.70 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }, { jugador: 'fila2', tipo: 'vuelve_a_fila' }, { jugador: 'fila3', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },

  /* ═══ PSICOMOTRICIDAD ══════════════════════════════════════
     Único bloque que SÍ se acota por categoría: aquí el ejercicio es
     específico de verdad y D9 admite la excepción. */
  {
    name: 'Los aros de colores',
    type: 'Calentamiento', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela'],
    difficulty: 1, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Aros repartidos por el suelo: hay que llegar al color que se diga, con el pie que se diga y con el balón controlado.',
    objetivos: 'Percepción espacial y lateralidad con una tarea que además exige no perder el balón.',
    descripcion_texto: 'Ocho o diez aros de colores repartidos por la media pista. Todos botan por el espacio. El entrenador dice un color y un pie: "azul, pie derecho". Hay que llegar al aro de ese color y meter dentro ese pie, sin dejar de botar. Si el aro ya está ocupado, hay que buscar otro del mismo color.',
    notas: 'Puntos clave: lo que se entrena es la decisión espacial y la lateralidad, no el bote; el bote es la carga añadida. No corrijas técnica de bote aquí. Sí hay que vigilar que no siempre usen el mismo pie por comodidad — di el pie no dominante más veces de las que parece justo. En Escuela, que sepan cuál es su izquierda ya es contenido.',
    variantes: 'Base: solo el color, sin especificar pie y sin botar. Intermedio: color y pie, botando. Avanzado: dos consignas encadenadas ("azul con el derecho, luego rojo con el izquierdo") y hay que recordar las dos.',
    tags: ['lateralidad', 'equilibrio', 'coordinación', 'ritmo', 'bote'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'aros'], densidad: 'alta', oposicion: 'nula',
      requisito_previo: 'botar en movimiento sin perder el balón la mayor parte del tiempo',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 40 },
      organizacion: 'Con 12: los doce a la vez, con los aros repartidos por una media pista.',
      criterio_exito: 'acertar color y pie en ocho de cada diez consignas',
      aplicacion: 'los cuatro cuadrantes, que es la misma respuesta a un estímulo pero ya con espacio compartido',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.30), jug('A', 2, 0.34, 0.70), jug('A', 3, 0.58, 0.30), jug('A', 4, 0.58, 0.70),
      cono(0.28, 0.20), cono(0.28, 0.50), cono(0.28, 0.80),
      cono(0.46, 0.20), cono(0.46, 0.50), cono(0.46, 0.80),
      cono(0.64, 0.20), cono(0.64, 0.50), cono(0.64, 0.80),
      balon(0.34, 0.30), balon(0.34, 0.70), balon(0.58, 0.30), balon(0.58, 0.70),
    ],
    intent: null,
  },
  {
    name: 'El espejo con balón',
    type: 'Calentamiento', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela', 'Benjamín'],
    difficulty: 1, intensidad: 2, duration_min: 4, duration_max: 8,
    description: 'Por parejas: uno hace un gesto con el balón y el otro lo copia como un espejo, cambiando de lado.',
    objetivos: 'Trabajar la imitación cruzada y el esquema corporal, que es lo que sostiene todo lo demás a estas edades.',
    descripcion_texto: 'Por parejas enfrentadas. Uno hace gestos con el balón: levantarlo con la mano derecha, pasarlo alrededor de la cintura hacia un lado, apoyarlo en un pie, botarlo dos veces a un lado. El otro copia como un espejo, es decir, con el lado contrario. Treinta segundos y cambio.',
    notas: 'Puntos clave: como espejo, la derecha del uno es la izquierda del otro, y ese cruce es exactamente el contenido; no corrijas si se confunden, ese es el trabajo. En Escuela habrá muchos que no distingan lados, y está bien: por eso se hace. Empieza despacio y con gestos grandes. Si van muy sobrados, que el que dirige se mueva mientras hace los gestos.',
    variantes: 'Base: gestos estáticos y lentos, sin cruce (copia igual, no espejo). Intermedio: espejo con gestos estáticos. Avanzado: espejo con desplazamiento y dos gestos a la vez.',
    tags: ['lateralidad', 'coordinación', 'equilibrio', 'ritmo'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'media', oposicion: 'pasiva',
      requisito_previo: 'sostener el balón con las dos manos sin que se caiga',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 30 },
      organizacion: 'Con 12: seis parejas a la vez, repartidas a lo ancho y mirándose.',
      criterio_exito: 'copiar en espejo la mayoría de los gestos sin que haya que recordárselo',
    },
    tablero: () => [
      jug('A', 1, 0.36, 0.30), jug('B', 1, 0.50, 0.30),
      jug('A', 2, 0.36, 0.70), jug('B', 2, 0.50, 0.70),
      balon(0.36, 0.30), balon(0.36, 0.70),
    ],
    intent: null,
  },
];
