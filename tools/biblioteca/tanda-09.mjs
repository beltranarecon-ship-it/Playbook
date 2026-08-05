/* ============================================================
   tanda-09.mjs — tiro (Bloque D).

   El bloque más grande del mapa después del bote, y el que peor
   envejece: lo que un niño aprende tirando desde cinco metros sin
   fuerza no se corrige después, se arrastra.

   Esta tanda cierra el hueco que el linter marcaba a cero —el TIRO
   CON OPOSICIÓN, que no es el mismo gesto con prisa sino otra
   decisión: tirar o no tirar— y trae la escalera de distancia, que es
   la forma de aplicar D17 sin que sea una frase.

   Doctrina que más aprieta aquí:
     D17 · se empieza bajo el aro y la distancia SE GANA
     D12 · las referencias van a la línea de 4 m, nunca al triple FIBA
     D19 · la oposición sube en cuatro escalones
     D1  · el analítico introduce y el juego consolida: la mitad de
           este bloque tiene que tener a alguien enfrente
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_09 = [

  /* ═══ MECÁNICA Y DISTANCIA GANADA ══════════════════════════ */
  {
    name: 'Tiro de rodillas',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 2, duration_min: 4, duration_max: 6,
    description: 'De rodillas y a metro y medio del aro: sin piernas, el tiro sale del brazo o no sale.',
    objetivos: 'Aislar la parte alta del tiro durante unos minutos para que el niño note qué hace la muñeca cuando las piernas no pueden tapar el error.',
    descripcion_texto: 'Por parejas, uno de rodillas a metro y medio del aro y el otro reboteando. Diez tiros y se cambia. De rodillas no se puede empujar con el cuerpo: el balón sube por delante de la cara, la mano de tiro va debajo, la guía al lado sin empujar, y la muñeca acaba colgando hacia el aro. En cuanto el gesto sale limpio se pasa a estar de pie: esto abre la serie, no la ocupa.',
    notas: 'PUNTO CLAVE del bloque: esto dura cuatro minutos y no veinte. Es la excepción a que todo se entrene en contexto —el objetivo es SENTIR el gesto—, y funciona precisamente porque es corto. Errores frecuentes: la mano guía empuja y el balón sale girando de lado; el codo se abre hacia fuera; el niño mira el balón en vez del aro. Corrección que más rinde a esta edad: que se quede con el brazo arriba hasta que el balón toque el aro. Y no subas la distancia aquí: si no llega de rodillas, es que la distancia ya es la buena.',
    tags: ['tiro', 'mecánica de tiro', 'analítico', 'series'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'sostener el balón con una mano debajo y la otra al lado sin que se caiga',
      dosis: { series: 2, cantidad: 10, unidad: 'repeticiones', descanso: 30 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: uno tira, uno rebotea y uno mira el codo desde el lado. Rotan cada diez tiros.',
      niveles: {
        base: 'sentado en el suelo a un metro, solo cinco tiros.',
        intermedio: 'de rodillas a metro y medio, diez tiros.',
        avanzado: 'de rodillas, y hay que meter tres seguidas para poder levantarse y seguir de pie.',
      },
      criterio_exito: 'ocho de diez con la muñeca colgando y el brazo arriba hasta que el balón toca el aro',
      aplicacion: 'el tiro tras recepción con cierre, donde ese mismo gesto tiene que salir con una mano delante',
    },
    tablero: () => [
      jug('A', 1, M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
      jug('A', 2, M.poste_bajo_izq[0] + 0.02, M.poste_bajo_izq[1]),
      balon(M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'tiro' },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.21, y: 0.44 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
      ],
    },
  },
  {
    name: 'La escalera del tiro',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Cinco marcas desde debajo del aro hacia fuera: se sube un escalón al anotar y se baja al fallar. La distancia se gana.',
    objetivos: 'Convertir D17 en una regla del juego: nadie tira desde donde no llega, y el que llega avanza sin que haya que decírselo.',
    descripcion_texto: 'Cinco conos en el mismo eje, desde debajo del aro hasta la línea de cuatro metros. Por parejas, uno tira y el otro rebotea y devuelve. Se empieza en el cono uno: si anota, sube al siguiente; si falla, baja uno. Dos minutos por turno y se apunta el escalón más alto alcanzado. Nadie puede saltarse un cono.',
    notas: 'Puntos clave: la mecánica manda sobre el escalón; en cuanto el tiro se convierte en empujón, es que ha subido demasiado y la regla ya le va a bajar sola. Aquí está el valor del ejercicio: la distancia deja de ser una discusión con el entrenador y pasa a ser un dato del propio niño. Error del entrenador: colocar el último cono en el triple. En mini la referencia es la línea de cuatro metros (D12), y con el balón de talla 5 llegar más lejos solo rompe el gesto.',
    tags: ['tiro', 'mecánica de tiro', 'competición', 'series'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'anotar desde un metro con la mecánica estable y sin empujar',
      dosis: { series: 3, cantidad: 120, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: dos escaleras, una por canasta, seis por escalera en tres parejas que se turnan cada dos minutos y apuntan su escalón.',
      niveles: {
        base: 'tres conos, todos dentro de la zona, y no se baja al fallar.',
        intermedio: 'cinco conos hasta los cuatro metros, se sube y se baja.',
        avanzado: 'cinco conos y hay que anotar dos seguidas para subir, con el reboteador levantando las manos.',
      },
      criterio_exito: 'llegar al cono tres o más manteniendo el gesto, sin ningún tiro empujado desde el pecho',
    },
    tablero: () => [
      jug('A', 1, 0.24, 0.50), jug('A', 2, 0.21, 0.62),
      cono(0.24, 0.50), cono(0.30, 0.50), cono(0.36, 0.50), cono(0.42, 0.50), cono(0.48, 0.50),
      balon(0.24, 0.50),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'tiro' },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.22, y: 0.55 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
        // anotó: sube un escalón y recibe en el cono siguiente
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.30, y: 0.50 } },
          { jugador: 'A2', tipo: 'pase', a: 'A1' },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ TIRO TRAS RECEPCIÓN Y TRAS BOTE ══════════════════════ */
  {
    name: 'Tiro de esquina con el pasador encima',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Recibir en la esquina corta y tirar antes de que el pasador llegue a taparte: el ángulo donde el tablero ya no ayuda.',
    objetivos: 'Tirar desde la esquina con los pies orientados y con alguien llegando, que es como aparece siempre en el juego.',
    descripcion_texto: 'Tirador en la ESQUINA CORTA —a la altura del poste bajo, no en el vértice del fondo— y pasador en la punta. El tirador se prepara con los pies ya hacia el aro, recibe y tira; el pasador sale a cerrar en cuanto suelta el balón, sin saltar. Cinco tiros por esquina y se cambia de lado y de papel. El tirador coge su rebote y devuelve.',
    notas: 'Puntos clave: desde la esquina el tablero no existe, así que el tiro va limpio y con más arco; los pies se colocan ANTES de que llegue el balón, no al recibirlo. Error frecuentísimo: recibir de lado y girar el tronco para tirar, con lo que el balón sale cruzado. Segundo: buscar tablero desde ahí, que es un ángulo donde no lo hay. Como entrenador, mira los pies en el momento del pase: si están orientados, el tiro ya está medio metido. Y no lo montes en el vértice del fondo: desde ahí son casi siete metros y con balón de talla 5 el gesto se rompe (D17).',
    tags: ['tiro', 'tiro tras recepción', 'mecánica de tiro', 'recepción', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'tirar tras recepción con los pies ya orientados al aro',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: dos tríos trabajando en las dos esquinas a la vez. Rotan tirador, pasador y reboteador cada cinco tiros.',
      niveles: {
        base: 'sin cierre: el pasador se queda donde está.',
        intermedio: 'el pasador sale a cerrar sin saltar.',
        avanzado: 'el pasador sale a cerrar de verdad y el tirador puede elegir entre tirar o salir botando.',
      },
      criterio_exito: 'cinco tiros con los pies orientados antes de recibir, tapado o no',
    },
    tablero: () => [
      jug('A', 1, 0.22, 0.78),
      jug('A', 2, M.base[0], M.base[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        { eventos: [
          { jugador: 'A1', tipo: 'tiro' },
          { jugador: 'A2', tipo: 'defiende', marca: 'A1' },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'recoge' }] },
      ],
    },
  },
  {
    name: 'Dos botes con la mano mala y tiro',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Salir hacia el lado malo, dos botes, parada y tiro: el lado que todo el mundo evita y todos los defensores conocen.',
    objetivos: 'Tener tiro tras bote por los dos lados, que es lo que hace que un defensor no pueda taparte uno y olvidarse.',
    descripcion_texto: 'Fila en el 45 con balón y un defensor que se coloca tapando el lado dominante. Se sale obligatoriamente por el lado malo, dos botes, parada en dos tiempos y tiro. El defensor persigue por detrás sin llegar a robar. Cinco por lado. Quien tira coge su rebote y vuelve a la fila por fuera.',
    notas: 'Puntos clave: el último bote con la mano mala tiene que ser más fuerte y más bajo para que el balón llegue a las manos a la altura de tirar; los pies se orientan durante la parada, no después. Error frecuente: dar tres botes en vez de dos porque el control con esa mano es peor — mejor bajar la velocidad que añadir botes. Y ojo con el orden: esto viene después de que la mano mala aguante un bote en carrera; antes, solo entrena a perder el balón.',
    tags: ['tiro', 'tiro tras bote', 'mano no dominante', 'parada', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'tiempo',
      requisito_previo: 'botar en carrera con la mano no dominante y parar en dos tiempos sin arrastrar el pie',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cuatro, un defensor que tapa el lado y un reboteador. Rotan los tres papeles.',
      niveles: {
        base: 'sin defensor, dos botes por el lado malo y tiro.',
        intermedio: 'defensor que tapa el lado bueno y persigue.',
        avanzado: 'el defensor elige el lado justo antes de la salida y el atacante lee cuál le dejan.',
      },
      criterio_exito: 'cinco salidas por el lado no dominante en dos botes, sin arrastrar el pie de pivote',
    },
    tablero: () => [
      fila(M.escolta_der[0] + 0.08, M.escolta_der[1], 4, 180),
      jug('B', 1, M.escolta_der[0] + 0.02, M.escolta_der[1] + 0.06),
      balon(M.escolta_der[0] + 0.08, M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.34, y: 0.55 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'fila1', hacia: { x: 0.38, y: 0.60 } },
        ] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Recibe de espaldas, gira y tira',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Llegar al codo de espaldas al aro, recibir, girar sobre un pie y tirar sin bote.',
    objetivos: 'Resolver la recepción de espaldas con un giro y un tiro, que es la forma más rápida de castigar a un defensor que te sigue por detrás.',
    descripcion_texto: 'Pasador en la punta y tirador que sube desde el poste bajo hasta el codo, de espaldas al aro, con un defensor detrás que le acompaña sin robar. Al recibir, se pivota sobre el pie de dentro para quedar de cara y se tira sin botar. Cinco por lado y rotan los tres papeles.',
    notas: 'Puntos clave: se pide el balón con la mano de fuera y se recibe con los dos pies en el suelo, o el giro sale con pasos; el pivote es corto —un cuarto de vuelta basta— y el balón sube durante el giro, no después. Error frecuente: girar y quedarse quieto un segundo buscando el aro, que es el tiempo que el defensor necesita para llegar. Otro: bajar el balón al girar y ofrecerlo. El tiro sale del giro, no de una pausa detrás del giro.',
    tags: ['tiro', 'tiro tras recepción', 'pivote', 'recepción', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'pivotar sobre los dos pies sin levantar el de apoyo y recibir con las dos manos',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, tirador y defensor. Rotan cada cinco tiros y se cambia de lado en cada serie.',
      niveles: {
        base: 'sin defensor y recibiendo ya de cara al aro.',
        intermedio: 'de espaldas, con defensor que acompaña, giro y tiro.',
        avanzado: 'el defensor elige el lado por el que aprieta y el tirador gira hacia el contrario.',
      },
      criterio_exito: 'cinco giros seguidos sin pasos y con el tiro saliendo del propio giro',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.poste_bajo_der[0] + 0.04, M.poste_bajo_der[1]),
      jug('B', 1, M.poste_bajo_der[0] + 0.09, M.poste_bajo_der[1] + 0.02),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: 'codo_der' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.40, y: 0.63 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'tiro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.36, y: 0.64 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
      ],
    },
  },

  /* ═══ TIRO CON OPOSICIÓN ═══════════════════════════════════
     El contenido que estaba a cero. No es el mismo tiro con prisa:
     es otra decisión —tirar o no tirar— y por eso son fichas
     distintas y no una variante de las de arriba. */
  {
    name: 'Mano en la cara',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Tirar con una mano delante de los ojos que no salta ni toca: el primer escalón del tiro con oposición.',
    objetivos: 'Sostener el arco y la mirada al aro cuando aparece una mano, que es lo primero que se rompe.',
    descripcion_texto: 'Por tríos junto al aro: tirador, defensor y reboteador. El defensor se coloca a un brazo con la mano arriba, delante de la cara, y la mantiene ahí; no salta, no toca y no se mueve. El tirador tira desde tres puntos distintos, cinco de cada. Se rotan los tres papeles.',
    notas: 'Puntos clave: se mira el aro POR ENCIMA de la mano, no se busca un hueco al lado; el arco sube un poco y el resto del gesto no cambia nada. Errores frecuentes: echarse hacia atrás al tirar, que acorta todos los tiros; y tirar más plano y más rápido para esquivar la mano, que es exactamente lo contrario. Al defensor hay que decírselo claro: mano quieta y sin saltar. En cuanto salta, el ejercicio se convierte en otro y el tirador aprende a tener prisa.',
    tags: ['tiro', 'mecánica de tiro', 'oposición', 'series'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'pasiva', presion: 'ninguna',
      requisito_previo: 'anotar desde dos metros con la mecánica estable',
      dosis: { series: 3, cantidad: 15, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos tríos por canasta trabajando en lados opuestos. Rotan los tres papeles cada cinco tiros.',
      niveles: {
        base: 'la mano se levanta cuando el balón ya está subiendo.',
        intermedio: 'la mano está arriba desde antes y se mantiene.',
        avanzado: 'el defensor puede mover la mano de un lado a otro sin saltar ni tocar.',
      },
      criterio_exito: 'el porcentaje con mano delante no baja más de dos tiros de cada quince respecto a la serie sin mano',
    },
    tablero: () => [
      jug('A', 1, M.codo_der[0] - 0.04, M.codo_der[1]),
      jug('B', 1, M.codo_der[0] - 0.09, M.codo_der[1]),
      jug('A', 2, M.poste_bajo_der[0] + 0.03, M.poste_bajo_der[1] - 0.03),
      balon(M.codo_der[0] - 0.04, M.codo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'tiro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1' },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
      ],
    },
  },
  {
    name: 'Tirar o botar',
    type: '1vs1', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El defensor sale desde debajo del aro y a veces llega y a veces no: la decisión es tirar o atacar el cierre.',
    objetivos: 'Entrenar la decisión, no el gesto: con oposición el tiro deja de ser una acción y pasa a ser una de las dos respuestas posibles.',
    descripcion_texto: 'Pasador en la punta, tirador en el 45 y defensor tocando el aro con la mano. Al pase, el defensor sale a cerrar; según lo lejos que esté cuando el tirador recibe, se tira o se sale botando hacia el hueco que deja. Punto para el atacante si anota, punto para el defensor si le obliga a fallar o llega a tiempo de tapar. Tres posesiones cada uno.',
    notas: 'Puntos clave: la decisión se toma MIENTRAS el balón viaja, mirando dónde está el defensor, no después de recibir; si llega con las manos abajo, hay tiro; si llega corriendo y descolocado, hay bote. Error frecuentísimo: haber decidido tirar antes de recibir y tirar igual encima del cierre. Como entrenador, no mires si entra: mira si la decisión era la buena. Un tiro fallado con hueco es mejor ejecución que una canasta metida encima de una mano.',
    tags: ['tiro', 'tiro tras recepción', '1c1', 'toma de decisiones', 'lectura', 'competición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'tirar tras recepción y salir en bote hacia los dos lados',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, tirador y defensor tras cada posesión.',
      niveles: {
        base: 'el defensor sale siempre tarde: solo se practica tirar con alguien acercándose.',
        intermedio: 'el defensor sale a cerrar de verdad y el atacante elige.',
        avanzado: 'el defensor decide salir a cerrar o quedarse, y el atacante tiene dos segundos para resolver.',
      },
      criterio_exito: 'la decisión es la correcta en cinco de las seis posesiones, entre o no entre',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.poste_bajo_der[0] + 0.02, M.poste_bajo_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.31, y: 0.63 } },
        ] },
        // el cierre llega descolocado: se ataca por el lado que deja
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.26, y: 0.60 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Tiro con contacto',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Tirar cerca del aro mientras un compañero empuja con una colchoneta o con el hombro: el equilibrio se entrena, no se tiene.',
    objetivos: 'Mantener la línea del tiro cuando llega un contacto legal, que a esta edad decide la mitad de los tiros cerca del aro.',
    descripcion_texto: 'Junto al aro, por tríos. El tirador recibe y tira desde metro y medio mientras un compañero le empuja de lado con una colchoneta pequeña —o con el hombro y las manos detrás de la espalda, si no hay material—. El empujón es firme y constante, nunca un golpe. Ocho tiros y rotan.',
    notas: 'Puntos clave: los pies se abren un poco más y el tiro sube RECTO aunque el cuerpo se venza; se aguanta el equilibrio con las piernas, no con el brazo. Errores frecuentes: tirar de lado siguiendo al empujón, y protegerse con el brazo de tiro. Aviso de seguridad: nada de empujar por detrás ni en el aire, y el que empuja siempre tiene las manos detrás si no hay colchoneta. Si un niño se cae, has subido demasiado la intensidad: esto es equilibrio, no un placaje.',
    tags: ['tiro', 'finalización', 'equilibrio', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'anotar desde metro y medio con la mecánica estable y caer equilibrado',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: tirador, el que empuja y el reboteador. Rotan cada ocho tiros.',
      niveles: {
        base: 'sin contacto: solo tiro cerca del aro cayendo equilibrado.',
        intermedio: 'contacto lateral firme y constante durante todo el tiro.',
        avanzado: 'el contacto llega justo al subir el balón y desde un lado que el tirador no sabe.',
      },
      criterio_exito: 'seis de ocho dentro con los dos pies cayendo dentro de una baldosa del sitio de donde salieron',
    },
    // El tirador a metro y medio del aro, que es lo que dice el texto:
    // más lejos deja de ser una finalización con contacto y pasa a ser
    // un tiro de media distancia con alguien empujando, que no es esto.
    tablero: () => [
      jug('A', 1, 0.20, 0.555), jug('B', 1, 0.20, 0.615),
      jug('A', 2, M.poste_bajo_izq[0] + 0.03, M.poste_bajo_izq[1]),
      balon(0.20, 0.555),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'tiro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1' },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
      ],
    },
  },

  /* ═══ FINTA, FATIGA Y COMPETICIÓN ══════════════════════════ */
  {
    name: 'Finta de tiro y tiro',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Enseñar el balón, esperar a que el defensor salte, y entonces tirar: la finta que más rápido da resultado a esta edad.',
    objetivos: 'Usar la finta de tiro para conseguir el tiro, no para inventar un bote: primero se enseña a cobrarla tirando.',
    descripcion_texto: 'Tirador en el 45 con balón y defensor a un brazo con las manos arriba. El tirador enseña el balón subiéndolo hasta los ojos SIN despegar los pies; si el defensor salta o levanta el peso, se espera a que baje y se tira; si no se lo cree, se tira igual. Cuatro repeticiones y se cambia. El defensor tiene que intentar taparlo de verdad.',
    notas: 'Puntos clave: la finta es del balón y de la mirada, no de las piernas — si los talones se despegan, después no queda tiro; y hay que esperar de verdad a que el defensor baje, que es medio segundo eterno. Errores frecuentes: fintar y tirar en el mismo movimiento, con lo que no engaña a nadie; y fintar tan despacio que se ve venir. Al defensor dile que salte a taparlo de verdad las primeras veces: sin alguien que muerda, la finta se aprende en el vacío.',
    tags: ['tiro', 'finta', 'tiro tras recepción', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'tirar tras recepción con los pies orientados y sin desequilibrarse',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas por canasta repartidas por el perímetro. Se cambia de papel cada cuatro repeticiones.',
      niveles: {
        base: 'el defensor salta siempre a la finta y solo se practica esperar y tirar.',
        intermedio: 'el defensor decide si se lo cree, y el tirador lee.',
        avanzado: 'si el defensor no salta, el tirador puede salir botando en vez de tirar.',
      },
      criterio_exito: 'las cuatro fintas con los pies en el suelo y el tiro saliendo equilibrado',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.05, M.escolta_izq[1] + 0.01),
      balon(M.escolta_izq[0], M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el defensor muerde la finta y sube; el tirador espera
        { eventos: [{ jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.35, y: 0.34 } }] },
        { eventos: [
          { jugador: 'A1', tipo: 'tiro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.32, y: 0.34 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'recoge' }] },
      ],
    },
  },
  {
    name: 'Cinco tiros, cinco sprints',
    type: 'Tiro', category: 'tiro', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Un sprint hasta medio campo entre tiro y tiro: cinco veces, contando cuántas caen con el pulso arriba.',
    objetivos: 'Ver qué queda de la mecánica cuando faltan las piernas, que es el estado en el que se tira en el último cuarto.',
    descripcion_texto: 'El jugador tira desde el codo, coge su rebote, deja el balón al reboteador y sale corriendo hasta medio campo y vuelve. Al llegar recibe y tira otra vez. Cinco tiros y cinco sprints seguidos, contando aciertos. Se compara con la misma serie hecha en frío al principio de la sesión.',
    notas: 'Puntos clave: con cansancio lo primero que se cae son las piernas y el tiro se queda corto, así que hay que insistir en flexionar aunque cueste; el error es compensar empujando con el brazo, que es justo el hábito que no queremos instalar. Si ves que el tiro se convierte en empujón, baja a tres tiros: el objetivo es tirar cansado, no tirar mal. Comparar con la serie en frío es lo que le da sentido al ejercicio; sin ese número, es solo correr.',
    tags: ['tiro', 'mecánica de tiro', 'series', 'competición'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 2, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'anotar desde el codo con la mecánica estable en frío',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: seis parejas repartidas entre las dos canastas, tirador y reboteador. Salen escalonadas cada diez segundos para no chocarse en el medio campo.',
      niveles: {
        base: 'tres tiros y tres sprints hasta la línea de tiros libres contraria.',
        intermedio: 'cinco tiros y cinco sprints hasta medio campo.',
        avanzado: 'cinco tiros y cinco sprints de pista entera, y hay que meter dos seguidas para terminar.',
      },
      criterio_exito: 'la serie con sprints no baja más de un tiro respecto a la misma serie en frío',
    },
    tablero: () => [
      jug('A', 1, E.codo_der[0], E.codo_der[1]),
      jug('A', 2, E.poste_bajo_der[0], E.poste_bajo_der[1]),
      balon(E.codo_der[0], E.codo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: { x: 0.60, y: 0.50 } }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'codo_der' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Veintiuno',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Competición clásica: dos puntos el tiro desde fuera, uno el rebote metido, y hay que caer justo en veintiuno.',
    objetivos: 'Competir tirando con la mecánica ya instalada, y de paso meter el rebote ofensivo del propio fallo, que casi nadie entrena.',
    descripcion_texto: 'Grupos de cuatro por canasta. Cada uno tira desde la línea de tiros libres; si anota son dos puntos y tira otra vez. Si falla, el rebote es de todos: quien lo coja anota desde donde lo cogió y vale un punto, y sigue tirando desde el tiro libre. Se juega a veintiuno EXACTOS: quien se pasa vuelve a quince. La pelea por el rebote es parte del juego.',
    notas: 'Puntos clave: es de los pocos sitios donde el rebote ofensivo aparece solo y con ganas, así que aprovéchalo para corregir la salida rápida al balón; el que se queda mirando su fallo no coge un rebote en toda la partida. Error del entrenador: dejar que la pelea del rebote se convierta en agarrones. Regla que lo arregla: quien agarra, pierde dos puntos. Y ojo con los grupos: más de cuatro por canasta y hay más espera que tiro.',
    tags: ['tiro', 'competición', 'rebote ofensivo', 'mecánica de tiro', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'anotar desde la línea de tiros libres con la mecánica estable',
      dosis: { series: 2, cantidad: 300, unidad: 'segundos', descanso: 90 },
      organizacion: 'Con 12: tres grupos de cuatro repartidos en las dos canastas y una tercera improvisada si la hay; si solo hay dos aros, dos grupos de seis y se juega por parejas sumando puntos.',
      niveles: {
        base: 'se tira desde dos metros y se juega a once, sin rebote disputado.',
        intermedio: 'desde el tiro libre, a veintiuno exactos, con rebote disputado.',
        avanzado: 'a veintiuno exactos y el rebote hay que meterlo antes de que el balón toque el suelo.',
      },
      criterio_exito: 'nadie se queda sin tirar más de treinta segundos seguidos, y la mecánica aguanta hasta el final',
    },
    tablero: () => [
      jug('A', 1, M.tiro_libre[0], M.tiro_libre[1]),
      jug('A', 2, M.poste_bajo_der[0] + 0.03, M.poste_bajo_der[1]),
      jug('B', 1, M.poste_bajo_izq[0] + 0.03, M.poste_bajo_izq[1]),
      jug('B', 2, M.codo_izq[0] - 0.04, M.codo_izq[1]),
      balon(M.tiro_libre[0], M.tiro_libre[1]),
    ],
    // Juego abierto: el rebote cae donde cae y quien lo coge decide.
    // Animar un desenlace sería enseñar una jugada cerrada.
    intent: null,
  },
];
