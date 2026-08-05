/* ============================================================
   tanda-13.mjs — pase y recepción (Bloque D).

   El bloque donde más se confunde el gesto con el juego: se pueden
   dar dos mil pases de pecho perfectos y no saber cuándo hay que dar
   uno. Por eso el mapa pide expresamente que aquí se entrene la
   DECISIÓN de pasar, que era el contenido que el linter marcaba a
   cero.

   Doctrina que más aprieta aquí:
     D1  · el analítico introduce y el juego consolida
     D2  · densidad: un pase por jugador y minuto no es entrenar pase
     D19 · la oposición sube en cuatro escalones; sin defensa no hay
           decisión que tomar, solo un traslado del balón
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_13 = [

  /* ═══ LA DECISIÓN DE PASAR ═════════════════════════════════
     El contenido que estaba a cero. Un pase con el defensor lejos
     no es un pase: es un traslado. Estas tres fichas ponen al
     jugador delante de la pregunta, no del gesto. */
  {
    name: 'Pasar o no pasar',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Dos contra dos donde el pase solo cuenta si el compañero estaba libre: entrena la decisión de pasar, no el pase.',
    objetivos: 'Separar el gesto de la elección: lo que hay que aprender es cuándo hay pase y cuándo no lo hay, que es lo que decide las pérdidas.',
    descripcion_texto: 'Dos contra dos en media pista sin bote. El que tiene el balón puede pasar o esperar hasta tres segundos. Cada pase se juzga en voz alta por la pareja que descansa: «bueno» si el receptor estaba libre y el pase llegó cómodo, «malo» si el defensor podía tocarlo. Tres pases malos y la posesión se pierde. Se juega a cuatro canastas.',
    notas: 'Puntos clave: el pase se decide MIRANDO al defensor del receptor, no al receptor; si el defensor está en la línea, no hay pase aunque el compañero pida. Error frecuentísimo: pasar en cuanto alguien levanta la mano, que es como se regalan la mitad de los balones. Lo que hace este ejercicio distinto es el juicio en voz alta: sin él, un pase arriesgado que sale bien se archiva como bueno y se repite. Y no juzgues tú: que lo hagan ellos, que es cuando aprenden a mirar lo que hay que mirar.',
    tags: ['pase', 'toma de decisiones', 'lectura', 'recepción', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'pasar de pecho y picado con precisión a cinco metros y recibir con las dos manos',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas: dos juegan y la tercera juzga los pases en voz alta. Rotan cada cuatro canastas.',
      niveles: {
        base: 'los defensores solo levantan los brazos y el juicio lo hace el entrenador.',
        intermedio: 'defensa real, tres segundos y juicio de la pareja que descansa.',
        avanzado: 'dos segundos y además hay que decir en voz alta por qué el pase era bueno.',
      },
      criterio_exito: 'menos de tres pases juzgados malos por cada cuatro canastas',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]), jug('B', 2, M.escolta_izq[0] - 0.04, M.escolta_izq[1] + 0.04),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el defensor del receptor está en la línea: NO hay pase, se espera
        { eventos: [
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.36, y: 0.39 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.34, y: 0.64 } },
        ] },
        // el receptor no se abre: sin bote, el hueco bueno está DENTRO,
        // y cortando saca al defensor de la línea de paso
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.26, y: 0.36 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.31, y: 0.34 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Pecho o picado según las manos',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'El defensor coloca las manos arriba o abajo y el pasador tiene que elegir el tipo de pase que corresponde.',
    objetivos: 'Que el tipo de pase deje de ser una preferencia y pase a ser una lectura de dónde están las manos del defensor.',
    descripcion_texto: 'Por tríos: pasador, receptor a cinco metros y defensor entre los dos. El defensor pone las manos arriba o abajo justo antes del pase y las mantiene. Si están arriba, toca picado; si están abajo, de pecho. El pase se cuenta bueno solo si es el que tocaba Y llega a las manos del receptor. Diez pases y rotan los tres papeles.',
    notas: 'Puntos clave: el picado bota a dos tercios de la distancia y llega a la altura de la cadera del receptor, no a los pies; el de pecho sale de la barbilla con los pulgares abajo al terminar. Errores frecuentes: picar demasiado cerca del receptor, con lo que el balón le llega botando alto; y dar el de pecho por encima de la cabeza, que es otro pase distinto. Este es de los pocos ejercicios de pase analíticos que se justifican, porque la señal del defensor mantiene la decisión dentro (D1).',
    tags: ['pase', 'pase de pecho', 'pase picado', 'lectura', 'analítico'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 15, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'pasiva', presion: 'ninguna',
      requisito_previo: 'pasar de pecho y picado a cinco metros sin que el balón pierda dirección',
      dosis: { series: 3, cantidad: 10, unidad: 'repeticiones', descanso: 30 },
      organizacion: 'Con 12: cuatro tríos a la vez repartidos a lo ancho de la pista, sin canastas. Rotan los tres papeles cada diez pases.',
      niveles: {
        base: 'el defensor anuncia en voz alta dónde pone las manos.',
        intermedio: 'las coloca sin avisar justo antes del pase.',
        avanzado: 'las cambia mientras el pasador ya está sacando el balón, y hay que corregir sobre la marcha.',
      },
      criterio_exito: 'ocho de cada diez pases son el que tocaba y llegan a las manos del receptor',
      aplicacion: 'el rondo 4c2, donde esa misma elección hay que hacerla con dos defensores moviéndose',
    },
    tablero: () => [
      jug('A', 1, 0.66, 0.28), jug('A', 3, 0.42, 0.28), jug('B', 1, 0.54, 0.28),
      jug('A', 2, 0.66, 0.66), jug('A', 4, 0.42, 0.66), jug('B', 2, 0.54, 0.66),
      balon(0.66, 0.28), balon(0.66, 0.66),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.55, y: 0.26 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.55, y: 0.68 } },
          { jugador: 'A1', tipo: 'pase', a: 'A3' },
        ] },
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.53, y: 0.30 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.53, y: 0.64 } },
          { jugador: 'A3', tipo: 'pase', a: 'A1' },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A4' }] },
      ],
    },
  },
  {
    name: 'No mires a quien pasas',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Rondo de cuatro con un intruso donde está prohibido mirar al receptor en el último instante: el pase se telegrafía con los ojos.',
    objetivos: 'Quitar el aviso que el pasador le da al defensor sin querer, que es por donde se van la mitad de los balones robados.',
    descripcion_texto: 'Cuatro atacantes en cuadrado y un defensor dentro. No se puede botar. Regla añadida: en el momento de soltar el balón, los ojos tienen que estar en otro sitio, no en el receptor. El defensor va cantando en voz alta a quién cree que van a pasar antes de que salga el balón; si acierta, punto para él. Noventa segundos y se cambia el intruso.',
    notas: 'Puntos clave: mirar a otro sitio no es mirar al techo — se mira a OTRO compañero, que además es lo que hay que hacer para saber si está libre; y el balón sale igual de fuerte, o el truco no sirve de nada. Error frecuente: girar la cabeza tan exageradamente que el defensor lo lee igual. IMPORTANTE de método: esto no se enseña antes de que el pase básico esté; a un niño que aún no llega con precisión, quitarle la mirada le rompe el gesto. Es el escalón de después.',
    tags: ['pase', 'lectura', 'toma de decisiones', 'recepción', 'oposición'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 15, canastas: 0, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'pasar de pecho y picado con precisión a cinco metros mirando al receptor',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: dos rondos de cinco a la vez, uno en cada media pista, y dos que cuentan los aciertos del intruso desde fuera y entran en la serie siguiente.',
      niveles: {
        base: 'rondo normal mirando al receptor, para asentar el pase.',
        intermedio: 'prohibido mirar al receptor al soltar el balón.',
        avanzado: 'además está prohibido devolver el balón a quien te lo dio.',
      },
      criterio_exito: 'el intruso acierta menos de una de cada cuatro veces a quién va el pase',
    },
    tablero: () => [
      jug('A', 1, 0.28, 0.28), jug('A', 2, 0.28, 0.72),
      jug('A', 3, 0.60, 0.28), jug('A', 4, 0.60, 0.72),
      jug('B', 1, 0.44, 0.50),
      balon(0.28, 0.28),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.36, y: 0.42 } },
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
        ] },
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.38, y: 0.62 } },
          { jugador: 'A2', tipo: 'pase', a: 'A4' },
        ] },
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.52, y: 0.62 } },
          { jugador: 'A4', tipo: 'pase', a: 'A3' },
        ] },
      ],
    },
  },

  /* ═══ RECEPCIÓN EN MOVIMIENTO Y PASE TRAS BOTE ═════════════ */
  {
    name: 'Recibir corriendo y soltarla sin parar',
    type: 'Pase', category: 'pase', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Tres carriles a pista entera pasándose el balón sin que nadie bote ni frene: si alguien para, se vuelve a empezar.',
    objetivos: 'Recibir y pasar en carrera, que es lo que sostiene un contraataque y lo que se rompe en cuanto alguien necesita frenar para pasar.',
    descripcion_texto: 'Tres jugadores por carril cruzan la pista entera pasándose el balón, sin botar ni una vez y sin que nadie deje de correr. El pase va por delante del receptor, a la altura del pecho y hacia donde va a estar, no donde está. Al llegar al fondo se termina en canasta. Si el balón toca el suelo o alguien frena, se vuelve al principio.',
    notas: 'Puntos clave: el pase se da HACIA DELANTE del compañero y con las dos manos; el receptor pide con las manos altas y no gira el cuerpo hacia el balón, solo la cabeza. Errores frecuentes: pasar a donde está el compañero, con lo que tiene que frenar; y esperar el balón parado. Error del entrenador: montar esto antes de que sepan pasar en movimiento por parejas — con tres carriles a la vez, un grupo que no lo domina no completa un viaje en toda la sesión y se frustra.',
    tags: ['pase', 'recepción', 'carriles', 'contraataque', 'transición'],
    requisitos: {
      // simultaneo: los tríos salen escalonados cada seis segundos y
      // vuelven por fuera, así que todo el mundo está en marcha siempre
      // y no hay cola donde esperar (D5).
      jugadores_min: 3, jugadores_max: 12, canastas: 2, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'pasar y recibir en movimiento por parejas sin frenar',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: cuatro tríos que salen escalonados cada seis segundos desde el mismo fondo; al llegar vuelven por fuera y se ponen al final.',
      niveles: {
        base: 'por parejas y a media pista, con un bote permitido.',
        intermedio: 'tres carriles a pista entera, sin botar.',
        avanzado: 'sin botar, con un tope de cinco pases y terminando en canasta antes de que el balón toque el suelo.',
      },
      criterio_exito: 'tres de cada cuatro viajes se completan sin que nadie frene ni bote',
    },
    tablero: () => [
      jug('A', 1, 0.50, 0.80), jug('A', 2, 0.16, 0.80), jug('A', 3, 0.84, 0.80),
      balon(0.50, 0.80),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.50, y: 0.60 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.16, y: 0.58 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.84, y: 0.58 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.20, y: 0.36 } },
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.50, y: 0.36 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.80, y: 0.36 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'aro' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Parar de botar y encontrar el pase',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Se bota hasta que el defensor corta el camino, se para en dos tiempos y desde ahí hay que encontrar al compañero.',
    objetivos: 'Resolver el momento en que el bote se acaba, que es donde se pierden más balones que en ningún otro sitio del juego.',
    descripcion_texto: 'Atacante con balón en el 45, compañero en la esquina contraria y un defensor que corta el camino del bote. En cuanto el defensor corta, el atacante para en dos tiempos —sin recoger el balón antes de tiempo— y busca al compañero, que se ha desplazado buscando línea. Tres segundos para pasar. Cuatro repeticiones y rotan los tres.',
    notas: 'Puntos clave: se para equilibrado y con el balón protegido a la altura del pecho, y se pivota para abrir ángulo antes de pasar, nunca se pasa desde donde se paró; el compañero tiene que MOVERSE, porque un receptor parado no da línea. Error frecuentísimo: recoger el balón sin haber decidido nada y quedarse atrapado — de ahí salen las pérdidas y los pasos. Como entrenador, cuenta cuántas veces el receptor se mueve: si no lo hace, el problema no es del que bota.',
    tags: ['pase', 'pivote', 'parada', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'parar en dos tiempos tras bote y pivotar sin levantar el pie de apoyo',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos tríos por canasta trabajando en lados opuestos. Rotan los tres papeles cada cuatro repeticiones.',
      niveles: {
        base: 'el defensor corta siempre en el mismo sitio y el receptor está fijo.',
        intermedio: 'el defensor elige cuándo corta y el receptor busca línea.',
        avanzado: 'un segundo defensor puede salir a tapar la línea de pase tras la parada.',
      },
      criterio_exito: 'las cuatro repeticiones acaban en pase bueno dentro de los tres segundos, sin pasos',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, 0.26, 0.20),
      jug('B', 1, M.codo_der[0] - 0.02, M.codo_der[1] - 0.02),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.34, y: 0.58 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.30, y: 0.56 } },
        ] },
        // el compañero se mueve a buscar línea, no espera
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: { x: 0.34, y: 0.22 } }] },
        // la repetición termina en el pase: lo que se entrena es salir
        // del bote, no lo que pase después
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
      ],
    },
  },

  /* ═══ PASE CONTRA DEFENSA ══════════════════════════════════ */
  {
    name: 'Sacar de banda con presión',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Cinco segundos para sacar de banda con un defensor delante y dos compañeros defendidos: la situación que más balones regala en mini.',
    objetivos: 'Resolver el saque de banda, que aparece veinte veces por partido y no se entrena casi nunca.',
    descripcion_texto: 'Un jugador saca de banda con un defensor delante y dos compañeros dentro, cada uno con su defensor. Cinco segundos para que el balón entre. Los receptores tienen que desmarcarse de verdad —cambiando de dirección, no solo levantando la mano— y el sacador puede usar el pase por encima o picado. Si no entra, punto para la defensa. Cuatro saques y rotan.',
    notas: 'Puntos clave: el sacador da un paso lateral para abrir ángulo antes de decidir; el pase por encima es el que salva las manos del defensor de delante; y el que recibe llega al balón, no lo espera. Errores frecuentes: quedarse clavado en el sitio del saque, y pasar al primero que levanta la mano sin mirar dónde está su defensor. Como entrenador cuenta los balones que entran de cuatro: por debajo de tres, el problema casi nunca es del sacador sino de que nadie se mueve.',
    tags: ['pase', 'pase picado', 'desmarque', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'pasar por encima y picado con precisión y desmarcarse cambiando de dirección',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, montando el saque 3c3 completo. Rota el sacador en cada saque.',
      niveles: {
        base: 'sin defensor sobre el sacador y con un solo receptor defendido.',
        intermedio: 'defensor sobre el sacador, dos receptores defendidos y cinco segundos.',
        avanzado: 'lo mismo, y el balón tiene que cruzar el medio campo antes de tres segundos más.',
      },
      criterio_exito: 'el balón entra en tres de cada cuatro saques sin que la defensa lo toque',
    },
    tablero: () => [
      jug('A', 1, 0.44, 0.92), jug('A', 2, M.codo_der[0], M.codo_der[1]), jug('A', 3, M.base[0], M.base[1]),
      jug('B', 1, 0.44, 0.86), jug('B', 2, M.codo_der[0] - 0.04, M.codo_der[1] - 0.03), jug('B', 3, M.base[0] - 0.05, M.base[1]),
      balon(0.44, 0.92),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.28, y: 0.68 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.31, y: 0.66 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.44, y: 0.87 } },
        ] },
        // se vende el corte hacia dentro y se sale a buscar el balón;
        // el segundo receptor también se mueve, porque un receptor
        // parado no da línea y el saque se queda sin opciones
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.40, y: 0.78 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.34, y: 0.72 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.48, y: 0.62 } },
          { jugador: 'B3', tipo: 'defiende', marca: 'A3', hacia: { x: 0.43, y: 0.60 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
      ],
    },
  },
  {
    name: 'Pasar al que corta',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El compañero corta hacia el aro con su defensor pegado y hay que meterle el balón en el momento exacto: ni antes ni después.',
    objetivos: 'Entrenar el tiempo del pase, que es lo que convierte un corte bueno en una canasta y un corte bueno mal servido en una pérdida.',
    descripcion_texto: 'Pasador en la punta con balón, cortador en el 45 con su defensor detrás. El cortador corta hacia el aro; el pasador tiene que meter el balón cuando el cortador ya ha ganado la espalda pero todavía no está bajo el aro. Se cuenta bueno solo si el cortador recibe en carrera y termina sin botar. Cuatro cortes y rotan los tres.',
    notas: 'Puntos clave: el pase sale cuando el cortador cruza la línea del defensor, ni un instante después; y va picado o por encima según dónde tenga las manos el defensor, nunca de pecho entre los dos. Errores frecuentes: pasar tarde y obligar al cortador a frenar bajo el aro; y pasar pronto, cuando el defensor aún tiene el brazo dentro. Como entrenador, dilo en voz alta mientras pasa: «¡ahora!». En dos sesiones lo dicen ellos solos y después ya no hace falta.',
    tags: ['pase', 'corte', 'pase picado', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'pasar picado con precisión y cortar cambiando de dirección',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos tríos por canasta trabajando desde los dos 45. Rotan los tres papeles cada cuatro cortes.',
      niveles: {
        base: 'el defensor acompaña sin apretar y el pase se da al primer paso del corte.',
        intermedio: 'el defensor persigue de verdad y el pase se da al cruzar su línea.',
        avanzado: 'el cortador puede fintar el corte y salir de nuevo fuera; el pasador decide si hay pase o no.',
      },
      criterio_exito: 'tres de cada cuatro cortes reciben en carrera y terminan sin botar',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.03, M.escolta_izq[1] - 0.05),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.26, y: 0.42 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.30, y: 0.37 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ VOLUMEN Y COMPETICIÓN ════════════════════════════════ */
  {
    name: 'Relevo de pases sin botar',
    type: 'Pase', category: 'pase', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Relevo por equipos donde el balón cruza la pista solo con pases y sin tocar el suelo: gana el equipo que menos pases necesita.',
    objetivos: 'Meter volumen de pase largo en competición, y de paso enseñar que menos pases bien dados llegan antes que muchos cortos.',
    descripcion_texto: 'Tres equipos, cada uno en su carril, repartidos de fondo a fondo. El balón tiene que llegar del primero al último solo con pases: nadie puede botar ni caminar con él, y si el balón toca el suelo se vuelve al principio. Se cuenta cuántos pases ha necesitado cada equipo. Después se recolocan para intentar bajar el número.',
    notas: 'Puntos clave: para pasar largo se usa el pase de béisbol con un paso adelante, y el receptor sale a buscar el balón en vez de esperarlo; la clave está en la RECOLOCACIÓN entre rondas, que es donde entienden que la distancia entre compañeros es una decisión. Error frecuente: colocarse todos juntos para no fallar, con lo que hacen falta ocho pases. Deja que les pase y que lo descubran; corregirlo antes les quita el aprendizaje.',
    tags: ['pase', 'pase de béisbol', 'recepción', 'competición', 'espaciado'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 3,
      material: ['balones'], densidad: 'media', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'pasar de béisbol a diez metros con precisión y recibir con las dos manos',
      dosis: { series: 4, cantidad: 2, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: tres equipos de cuatro, un carril por equipo, colocados a lo largo de la pista. Entre rondas cada equipo decide dónde se coloca.',
      niveles: {
        base: 'el balón puede botar una vez entre pases.',
        intermedio: 'sin botes y contando los pases.',
        avanzado: 'sin botes, contando pases y con un tope de tiempo por viaje.',
      },
      criterio_exito: 'el equipo baja su número de pases entre la primera ronda y la última',
    },
    tablero: () => [
      jug('A', 1, 0.18, 0.86), jug('A', 2, 0.18, 0.56), jug('A', 3, 0.18, 0.24),
      jug('A', 4, 0.50, 0.86), jug('A', 5, 0.50, 0.56), jug('A', 6, 0.50, 0.24),
      jug('A', 7, 0.82, 0.86), jug('A', 8, 0.82, 0.56), jug('A', 9, 0.82, 0.24),
      balon(0.18, 0.86), balon(0.50, 0.86), balon(0.82, 0.86),
    ],
    intent: {
      canasta: null,
      fases: [
        // el receptor SALE a buscar el balón: esperarlo parado es lo
        // que obliga a dar dos pases donde cabía uno
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.18, y: 0.64 } },
          { jugador: 'A5', tipo: 'corte', hacia: { x: 0.50, y: 0.64 } },
          { jugador: 'A8', tipo: 'corte', hacia: { x: 0.82, y: 0.64 } },
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'A4', tipo: 'pase', a: 'A5' },
          { jugador: 'A7', tipo: 'pase', a: 'A8' },
        ] },
        { eventos: [
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.18, y: 0.34 } },
          { jugador: 'A6', tipo: 'corte', hacia: { x: 0.50, y: 0.34 } },
          { jugador: 'A9', tipo: 'corte', hacia: { x: 0.82, y: 0.34 } },
          { jugador: 'A2', tipo: 'pase', a: 'A3' },
          { jugador: 'A5', tipo: 'pase', a: 'A6' },
          { jugador: 'A8', tipo: 'pase', a: 'A9' },
        ] },
      ],
    },
  },
  {
    name: 'Cadena de tres con intruso',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Tres atacantes en movimiento contra un defensor: conservar el balón sin botar mientras todos se desplazan sin parar.',
    objetivos: 'Pasar y recibir con todo el mundo en marcha, que es lo que separa un rondo estático del juego de verdad.',
    descripcion_texto: 'Tres atacantes y un defensor dentro de media pista. No se puede botar y nadie puede estar quieto más de dos segundos, ni siquiera el que tiene el balón. Se cuentan los pases seguidos sin pérdida y se intenta batir el récord del grupo. Noventa segundos y se cambia el defensor.',
    notas: 'Puntos clave: al moverse todos, la línea de pase aparece y desaparece cada segundo, así que hay que mirar ANTES de recibir; el que pasa se va inmediatamente a otro sitio, o el defensor le usa de referencia. Error frecuente: los tres orbitando alrededor del que tiene el balón, con lo que el defensor los cubre a todos. Recuérdales que el que está lejos también es una opción. Como entrenador vigila que nadie se pare a descansar con el balón en las manos: ahí se acaba el ejercicio.',
    tags: ['pase', 'recepción', 'espaciado', 'toma de decisiones', 'competición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'pasar y recibir en movimiento con un defensor cerca',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 60 },
      organizacion: 'Con 12: tres grupos de cuatro repartidos por la pista, cada uno con su intruso. Se cambia el intruso cada noventa segundos.',
      niveles: {
        base: 'cuatro atacantes y un defensor, y se puede estar quieto.',
        intermedio: 'tres atacantes, nadie parado más de dos segundos.',
        avanzado: 'tres atacantes, dos defensores y prohibido devolver el balón a quien te lo dio.',
      },
      criterio_exito: 'batir el récord de pases seguidos del grupo al menos una vez por serie',
    },
    tablero: () => [
      jug('A', 1, 0.34, 0.32), jug('A', 2, 0.34, 0.68), jug('A', 3, 0.62, 0.50),
      jug('B', 1, 0.44, 0.46),
      balon(0.34, 0.32),
    ],
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.44, y: 0.74 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.40, y: 0.40 } },
          { jugador: 'A1', tipo: 'pase', a: 'A3' },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.28, y: 0.44 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.52, y: 0.50 } },
          { jugador: 'A3', tipo: 'pase', a: 'A2' },
        ] },
        { eventos: [
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.58, y: 0.34 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.46, y: 0.62 } },
          { jugador: 'A2', tipo: 'pase', a: 'A1' },
        ] },
      ],
    },
  },
];
