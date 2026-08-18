/* ============================================================
   tanda-02.mjs — tiro y bote (Bloque D).

   Los dos bloques más grandes del mapa y los más usados en
   minibasket. Cubre lo que el linter marcaba como sin cubrir: tiro
   cercano, tiro libre, tiro con fatiga, tiro con oposición y
   concurso; bote de control, de avance, de protección, mano no
   dominante y cabeza levantada. Más pase contra defensa, una
   superioridad y el bloque de rebote, que estaba a cero.

   Escrita contra DOCTRINA.md igual que el piloto. Recordatorio de las
   que más aprietan aquí:
     D1  · todo analítico declara dónde se aplica
     D17 · el tiro empieza bajo el aro y la distancia se gana
     D19 · la oposición sube en cuatro escalones
     D20 · nada de manejo descontextualizado como bloque principal
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_02 = [

  /* ═══ TIRO ═════════════════════════════════════════════════ */
  {
    name: 'Las cinco posiciones',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Serie de tiro cercano por las cinco posiciones clásicas, con rebote del compañero y sin parar.',
    objetivos: 'Repetir la mecánica desde ángulos distintos sin alejarse tanto como para tener que empujar el balón.',
    descripcion_texto: 'Cinco puntos marcados con conos a dos metros del aro: los dos postes bajos, los dos codos y el frontal. Por parejas: uno tira desde una posición, el compañero coge el rebote y se lo devuelve en el siguiente punto. Cinco tiros por posición y se cambia de papel. La vuelta completa son veinticinco tiros por jugador.',
    notas: 'Puntos clave: los pies se recolocan hacia el aro en CADA posición, que es lo que cambia de un punto a otro; desde los codos el ángulo con el tablero desaparece y hay que tirar limpio. Error frecuente: llegar corriendo y tirar en desequilibrio por no querer perder ritmo. Vale más ir despacio y llegar equilibrado. Segundo error: usar tablero desde el frontal, donde no existe.',
    tags: ['tiro', 'mecánica de tiro', 'analítico', 'series'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'tirar bajo el aro con la mecánica estable y sin empujar',
      dosis: { series: 2, cantidad: 25, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en parejas (uno tira y el otro devuelve). Cada pareja empieza en una posición distinta para no cruzarse.',
      niveles: {
        base: 'tres posiciones (los dos postes bajos y el frontal), a metro y medio.',
        intermedio: 'las cinco posiciones a dos metros.',
        avanzado: 'las cinco posiciones desde la distancia del codo, y hay que anotar tres seguidas para pasar a la siguiente.',
      },
      criterio_exito: 'quince de veinticinco dentro, y ninguna posición por debajo de dos de cinco',
      aplicacion: 'tiro tras recepción con cierre, donde el mismo gesto sale con un defensor encima',
    },
    tablero: () => [
      jug('A', 1, M.codo_der[0] - 0.06, M.codo_der[1]),
      jug('A', 2, M.poste_bajo_izq[0] + 0.04, M.poste_bajo_izq[1]),
      cono(M.poste_bajo_der[0] + 0.03, M.poste_bajo_der[1]),
      cono(M.poste_bajo_izq[0] + 0.03, M.poste_bajo_izq[1]),
      cono(M.codo_der[0] - 0.06, M.codo_der[1]),
      cono(M.codo_izq[0] - 0.06, M.codo_izq[1]),
      cono(M.tiro_libre[0] - 0.06, M.tiro_libre[1]),
      balon(M.codo_der[0] - 0.06, M.codo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }, { jugador: 'A2', tipo: 'corte', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
      ],
    },
  },
  {
    name: 'Tiro tras bote con parada',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Dos botes desde el 45, parada en dos tiempos y tiro, con un defensor que sale a cerrar.',
    objetivos: 'Encadenar bote, parada y tiro sin perder el equilibrio, que es donde se cae casi todo el tiro tras bote.',
    descripcion_texto: 'Fila en el 45 con balón. Se sale botando hacia el centro, se dan dos botes, se para en dos tiempos y se tira. Un defensor parte del poste bajo y sale a cerrar cuando el atacante recoge el balón. Se rota atacante, defensor y final de la fila.',
    notas: 'Puntos clave: el último bote es más fuerte y más bajo, para que el balón llegue a las manos a la altura de tirar; los pies se orientan al aro DURANTE la parada, no después. Error frecuente: parar y luego reajustar los pies, lo que da tiempo al defensor. Otro clásico: tirar cayendo hacia atrás por haber frenado mal.',
    tags: ['tiro', 'tiro tras bote', 'parada', 'bote', 'lectura'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'parar en dos tiempos tras bote sin arrastrar el pie de pivote',
      dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cinco y un defensor que sale a cerrar. Se rota atacante, defensor y final de la fila.',
      niveles: {
        base: 'sin defensor, dos botes y tiro.',
        intermedio: 'defensor que sale a cerrar.',
        avanzado: 'el defensor sale antes y el atacante decide entre tirar o meter un bote más y entrar.',
      },
      criterio_exito: 'seis paradas de seis equilibradas, con los pies orientados al aro antes de subir el balón',
    },
    tablero: () => [
      fila(M.escolta_der[0] + 0.06, M.escolta_der[1], 4, 180),
      jug('B', 1, M.poste_bajo_der[0] + 0.03, M.poste_bajo_der[1]),
      balon(M.escolta_der[0] + 0.06, M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'fila1' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        // el ciclo lo cierra el propio tirador: "se rota atacante,
        // defensor y final de la fila"
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Tiros libres con presión de equipo',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 1, duration_min: 5, duration_max: 8,
    description: 'Tiros libres donde el fallo lo paga el equipo: la rutina se entrena con algo en juego, no en silencio.',
    objetivos: 'Instalar una rutina de tiro libre estable y sostenerla cuando el tiro importa.',
    descripcion_texto: 'Dos equipos. Por turnos, un jugador tira dos tiros libres. Cada tiro fallado son cinco segundos de plancha para su equipo al terminar la ronda; cada dos tiros anotados, se restan cinco. Todos tiran una vez antes de repetir. Antes de cada tiro el jugador hace su rutina completa: mismos apoyos, mismos botes, misma respiración.',
    notas: 'Puntos clave: la rutina es SIEMPRE la misma, y eso es lo que se corrige aquí, no el porcentaje. Si un niño bota tres veces, que boten tres siempre. Error frecuente: acelerar cuando hay presión, que es justo cuando la rutina sirve para algo. La densidad de este ejercicio es baja por naturaleza y está bien que lo sea: el tiro libre se entrena esperando, igual que en el partido.',
    tags: ['tiro', 'tiro libre', 'competición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'baja', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'tirar desde la línea de tiros libres llegando al aro sin lanzar desde el pecho',
      dosis: { series: 2, cantidad: 2, unidad: 'repeticiones', descanso: 20 },
      organizacion: 'Con 12: dos equipos de seis, uno en cada canasta, y al terminar se comparan los fallos. Todos tiran una vez antes de que nadie repita.',
      niveles: {
        base: 'sin consecuencia de equipo, solo la rutina y contar aciertos.',
        intermedio: 'con consecuencia para el equipo.',
        avanzado: 'el resto del equipo puede hacer ruido, y el que falla dos tira otra vez al final con todo el mundo mirando.',
      },
      criterio_exito: 'la rutina es idéntica en los dos tiros, la meta o la falle',
      justificacion_densidad: 'el tiro libre se entrena esperando el turno con el equipo mirando, que es exactamente la situación del partido; quitarle la espera le quita el sentido',
    },
    tablero: () => [
      jug('A', 1, M.tiro_libre[0], M.tiro_libre[1]),
      jug('A', 2, M.poste_bajo_der[0], M.poste_bajo_der[1]),
      jug('A', 3, M.poste_bajo_izq[0], M.poste_bajo_izq[1]),
      jug('B', 1, M.codo_der[0], M.codo_der[1]),
      jug('B', 2, M.codo_izq[0], M.codo_izq[1]),
      balon(M.tiro_libre[0], M.tiro_libre[1]),
    ],
    intent: {
      canasta: 'norte',
      /* Los de los postes van al rebote en cuanto sale el balón: en un
         tiro libre de verdad tampoco se quedan mirando. */
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'canasta' }, { jugador: 'A3', tipo: 'corte', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Ida y vuelta: tiro con fatiga',
    type: 'Tiro', category: 'tiro', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Tiro después de correr la pista entera: el gesto tiene que aguantar cuando ya no quedan piernas.',
    objetivos: 'Sostener la mecánica con el pulso alto, que es la condición en la que se tira de verdad en un partido.',
    descripcion_texto: 'El jugador sale desde el fondo botando hasta la canasta contraria, entra a canasta, coge su rebote y vuelve botando. Al llegar recibe un pase de un compañero situado en el codo y tira. Cuatro idas y vueltas seguidas, contando cuántos tiros mete al final de cada una. El compañero que pasa sale a cerrar el tiro sin saltar.',
    notas: 'Puntos clave: cuando llega el cansancio lo primero que se cae son las piernas, y el tiro se queda corto; hay que insistir en flexionar aunque cueste. Error frecuente: compensar la falta de piernas empujando con el brazo, que es exactamente el hábito que no queremos. Si ves que el tiro se convierte en empujón, baja a tres idas y vueltas: el objetivo es tirar cansado, no tirar mal.',
    tags: ['tiro', 'tiro tras recepción', 'contraataque', 'bote'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 2, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'botar la pista entera a velocidad alta sin perder el balón',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: seis parejas repartidas entre las dos canastas. Salen escalonadas cada quince segundos para no chocarse en el medio campo.',
      niveles: {
        base: 'dos idas y vueltas y tiro desde el poste bajo.',
        intermedio: 'cuatro idas y vueltas y tiro desde el codo.',
        avanzado: 'seis idas y vueltas, y hay que meter dos seguidas para terminar.',
      },
      criterio_exito: 'el porcentaje de la cuarta ida y vuelta no baja más de un tiro respecto a la primera',
    },
    tablero: () => [
      jug('A', 1, E.escolta_der[0], 0.7734),
      jug('A', 2, E.codo_der[0], E.codo_der[1]),
      balon(E.escolta_der[0], 0.7734),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'tiro_libre' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        // "El compañero que pasa SALE A CERRAR el tiro sin saltar": la
        // ficha declaraba oposición semiactiva y no había nadie
        // cerrando en toda la animación. El pasador es el que cierra.
        { eventos: [
          { jugador: 'A1', tipo: 'tiro', hacia: 'canasta' },
          { jugador: 'A2', tipo: 'defiende', marca: 'A1' },
        ] },
      ],
    },
  },
  {
    name: '1c1 al tirador',
    type: '1vs1', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El tirador recibe y el defensor le llega de verdad: tirar solo si hay hueco, y si no, atacar el cierre.',
    objetivos: 'Decidir bajo presión real entre tirar y atacar, con el defensor llegando a tiempo de castigar la decisión mala.',
    descripcion_texto: 'Pasador en la punta, tirador en el 45 y defensor tocando el aro con la mano. Al pase, el defensor sale a defender de verdad y el tirador tiene una posesión libre: tirar, entrar o parar y tirar. Punto para el atacante si anota, punto para el defensor si le obliga a fallar o le roba. Tres posesiones cada uno.',
    notas: 'Puntos clave: se ataca el pie adelantado del defensor, no su centro; si llega con las manos abajo, hay tiro. Error frecuente: tirar encima del cierre por haberlo decidido antes de recibir. Como entrenador, no mires si entra: mira si la decisión era la buena. Un tiro fallado con hueco es mejor ejecución que una canasta metida encima de una mano.',
    tags: ['tiro', 'tiro tras recepción', '1c1', 'toma de decisiones', 'lectura', 'competición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'tirar tras recepción con los pies ya orientados al aro',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, tirador y defensor.',
      niveles: {
        base: 'el defensor sale desde más lejos y no puede saltar.',
        intermedio: 'sale desde el aro, defensa completa, una posesión.',
        avanzado: 'el defensor elige salir a cerrar o quedarse esperando, y el atacante tiene que leerlo en el aire del pase.',
      },
      criterio_exito: 'la decisión es la correcta en dos de cada tres posesiones, entre o no entre el tiro',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.poste_bajo_der[0], M.poste_bajo_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Concurso de las cinco estaciones',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Competición por parejas: recorrer cinco estaciones de tiro contra el reloj y contra la otra pareja.',
    objetivos: 'Meter el tiro en un contexto de competición y prisa, que es cuando se ve si la mecánica está instalada de verdad.',
    descripcion_texto: 'Cinco conos a distinta distancia del aro. Por parejas: uno tira y otro rebotea y pasa, y hay que anotar en una estación para pasar a la siguiente. Gana la pareja que complete antes las cinco. El reboteador puede levantar las manos delante del tirador, pero sin saltar ni tocar. A la vuelta se cambian los papeles.',
    notas: 'Puntos clave: la prisa se gestiona con los pies, no con el brazo; el que rebotea marca el ritmo, así que si pasa mal el tirador tira mal. Error frecuente: encadenar tiros sin recolocar los apoyos. Si ves que todo el mundo tira peor que en la serie analítica, no es mala señal: significa que la competición está haciendo su trabajo y que aún falta automatismo.',
    tags: ['tiro', 'competición', 'mecánica de tiro', 'tiro tras recepción'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva', presion: 'marcador',
      requisito_previo: 'anotar desde dos metros con la mecánica estable',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en parejas. Cada pareja recorre las cinco estaciones y apunta su total.',
      niveles: {
        base: 'tres estaciones, todas cerca del aro, sin manos delante.',
        intermedio: 'cinco estaciones y manos arriba del compañero.',
        avanzado: 'cinco estaciones y hay que meter dos seguidas en cada una.',
      },
      criterio_exito: 'completar las cinco estaciones sin que el gesto se convierta en empujón',
    },
    tablero: () => [
      jug('A', 1, M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
      jug('A', 2, M.poste_bajo_izq[0] + 0.03, M.poste_bajo_izq[1]),
      cono(M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
      cono(M.codo_der[0], M.codo_der[1]),
      cono(M.tiro_libre[0], M.tiro_libre[1]),
      cono(M.codo_izq[0], M.codo_izq[1]),
      cono(M.poste_bajo_izq[0] + 0.05, M.poste_bajo_izq[1]),
      balon(M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }, { jugador: 'A2', tipo: 'corte', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        // "El reboteador puede levantar las manos delante del tirador":
        // eso ES la oposición pasiva que declara la ficha, y no estaba
        // dibujada por ninguna parte. Se coloca delante y se queda.
        { eventos: [{ jugador: 'A2', tipo: 'defiende', marca: 'A1' }] },
      ],
    },
  },

  /* ═══ BOTE ═════════════════════════════════════════════════ */
  {
    name: 'Números y bote',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 2, duration_min: 4, duration_max: 8,
    description: 'Bote de control en el sitio mientras se leen los dedos que levanta el compañero de enfrente.',
    objetivos: 'Despegar la mirada del balón teniendo algo real que mirar, no una orden de mirar arriba.',
    descripcion_texto: 'Por parejas, uno enfrente del otro a cinco metros. Uno bota y el otro levanta dedos de una mano; el que bota tiene que decir el número en voz alta. Cada quince segundos se cambia de mano; cada treinta, se cambia de papel. La mano libre siempre protege el balón por delante.',
    notas: 'Puntos clave: bote por debajo de la cintura y a un lado, con la yema de los dedos y no con la palma. Este ejercicio existe para tener DÓNDE mirar: sin los dedos del compañero, "mira arriba" no se sostiene ni diez segundos (D20). Error frecuente en los pequeños: golpear el balón en vez de acompañarlo con la muñeca. Si el niño acierta los números pero bota altísimo, baja la altura antes que la velocidad.',
    tags: ['bote', 'cabeza levantada', 'analítico', 'coordinación'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'botar en el sitio sin que el balón se escape',
      dosis: { series: 4, cantidad: 30, unidad: 'segundos', descanso: 20 },
      organizacion: 'Con 12: los doce a la vez en una media pista, un balón cada uno. El entrenador canta los números desde fuera para verlos a todos.',
      niveles: {
        base: 'quince segundos por mano, mano dominante primero.',
        intermedio: 'alternando manos y con el compañero moviéndose.',
        avanzado: 'dos números a la vez, uno con cada mano del compañero, y hay que sumarlos.',
      },
      criterio_exito: 'acertar nueve de cada diez números sin mirar el balón ni una vez',
      aplicacion: 'el túnel, donde la cabeza levantada sirve para ver por dónde no viene nadie',
    },
    tablero: () => [
      jug('A', 1, 0.2865, 0.3263), jug('A', 2, 0.5712, 0.3263),
      jug('A', 3, 0.2865, 0.6799), jug('A', 4, 0.5712, 0.6799),
      balon(0.2865, 0.3263), balon(0.2865, 0.6799),
    ],
    intent: null,
  },
  {
    name: 'Carrera de ida y vuelta',
    type: 'Bote', category: 'bote', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 5, duration_min: 5, duration_max: 8,
    description: 'Carrera botando hasta el fondo contrario y vuelta, con la mano de fuera y sin perder el balón.',
    objetivos: 'Botar a la máxima velocidad a la que se puede mantener el control, que no es la máxima velocidad de correr.',
    descripcion_texto: 'Dos filas en el fondo. A la señal, los primeros de cada fila salen botando hasta el fondo contrario y vuelven. Ida con la mano derecha, vuelta con la izquierda. Quien pierde el balón vuelve al punto donde lo perdió antes de seguir. Gana la fila que antes complete el relevo entero.',
    notas: 'Puntos clave: el bote de avance va delante del cuerpo y alto, para poder correr; nada que ver con el bote de control. Error frecuente y muy revelador: correr tan rápido que el balón se queda atrás; ahí es donde hay que bajar una marcha. La penalización de volver al punto donde se pierde el balón hace el trabajo solo: en dos rondas todos encuentran su velocidad.',
    tags: ['bote', 'cambio de ritmo', 'competición', 'mano no dominante'],
    requisitos: {
      /* Cuatro filas y no dos: con dieciséis jugadores, dos filas dejan
         colas de ocho y D5 no admite más de cuatro esperando. Además el
         relevo se hace más corto y todos tocan más balón. */
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 4,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'botar en carrera sin mirar el balón continuamente',
      dosis: { series: 4, cantidad: 2, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: cuatro filas de tres en la línea de fondo, compitiendo entre ellas a lo largo de toda la pista. No usa canastas.',
      niveles: {
        base: 'media pista, ida y vuelta, con la mano que quieran.',
        intermedio: 'pista entera, ida con una mano y vuelta con la otra.',
        avanzado: 'pista entera con dos balones a la vez.',
      },
      criterio_exito: 'completar la ida y la vuelta sin perder el balón ni una vez',
      aplicacion: 'dos contra uno continuo, donde ese bote de avance es el que sube el balón al contraataque',
    },
    tablero: () => [
      fila(E.escolta_izq[0], 0.8281, 4, 270),
      fila(E.escolta_der[0], 0.8281, 4, 270),
      balon(E.escolta_izq[0], 0.8281), balon(E.escolta_der[0], 0.8281),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'centro' }, { jugador: 'fila2', tipo: 'bote', hacia: 'centro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'tiro_libre' }, { jugador: 'fila2', tipo: 'bote', hacia: 'tiro_libre' }] },
      ],
    },
  },
  {
    name: 'Protege y gira',
    type: '1vs1', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Conservar el bote dentro de un círculo con un defensor que intenta robarlo: proteger, girar y salir.',
    objetivos: 'Proteger el balón con el cuerpo y el bote bajo cuando ya no se puede avanzar.',
    descripcion_texto: 'Un círculo de conos de cuatro metros. Atacante dentro botando y defensor dentro intentando robar. El atacante no puede salir del círculo durante veinte segundos, así que no le queda avanzar: solo proteger, girar y cambiar de mano. Si le roban o pierde el balón fuera, cambio. Al final de los veinte segundos sale del círculo y ataca la canasta.',
    notas: 'Puntos clave: el cuerpo se mete entre el balón y el defensor, y el brazo libre se usa como barrera con el codo alto pero sin empujar; el bote baja hasta la rodilla. Error frecuente: girar dando la espalda y quedarse quieto, con lo que el defensor rodea y roba por el otro lado. Hay que girar Y salir. Segundo error: mirar el balón, que es cuando entra la mano por detrás.',
    tags: ['bote', 'bote de protección', 'pivote', '1c1', 'defensa del bote'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'botar con las dos manos y pivotar sin levantar el pie de apoyo',
      dosis: { series: 4, cantidad: 20, unidad: 'segundos', descanso: 40 },
      organizacion: 'Con 12: seis parejas repartidas por la pista, sin invadirse. Treinta segundos y cambio de rol.',
      niveles: {
        base: 'círculo grande y defensor que solo puede tocar el balón con una mano.',
        intermedio: 'círculo de cuatro metros y defensa completa.',
        avanzado: 'dos defensores durante quince segundos.',
      },
      criterio_exito: 'conservar el balón los veinte segundos completos en tres de cada cuatro intentos',
    },
    tablero: () => [
      jug('A', 1, 0.4231, 0.5031), jug('B', 1, 0.4915, 0.5031),
      cono(0.332, 0.5031), cono(0.5142, 0.5031), cono(0.4231, 0.4147), cono(0.4231, 0.5915),
      balon(0.4231, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: { x: 0.3776, y: 0.4501 } }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: { x: 0.4459, y: 0.5738 } }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
      ],
    },
  },
  {
    name: 'Solo izquierda',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Todo el ejercicio con la mano no dominante: botar, entrar y terminar, con un defensor que obliga a usarla.',
    objetivos: 'Hacer utilizable la mano mala, que a estas edades se gana o no se gana nunca.',
    descripcion_texto: 'Se juega un 1c1 desde el 45 en el que el atacante solo puede botar con la mano no dominante y solo puede terminar por ese lado. El defensor lo sabe y defiende ese lado, de modo que no hay atajo posible. Cinco ataques y se cambia. Con zurdos, al revés.',
    notas: 'Puntos clave: la mano mala no se entrena repitiendo despacio en el vacío, se entrena teniendo que usarla con alguien delante. Error frecuente: cambiar a la mano buena en el último bote, justo antes de terminar, casi sin darse cuenta; el defensor es el mejor detector de eso. Espera que el porcentaje baje mucho: es correcto, el objetivo aquí no es anotar.',
    tags: ['bote', 'mano no dominante', '1c1', 'entrada'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'botar diez veces seguidas con la mano no dominante sin perder el balón',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos canastas, seis por canasta, tres parejas que se turnan. Cinco ataques y se cambia atacante y defensor.',
      niveles: {
        base: 'sin defensor, recorrido libre con la mano mala.',
        intermedio: '1c1 con la restricción y defensor que defiende ese lado.',
        avanzado: 'la restricción vale también para el defensor, que solo puede robar con su mano mala.',
      },
      criterio_exito: 'terminar los cinco ataques sin cambiar de mano ni una sola vez, entre o no entre',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.escolta_izq[0], M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_izq' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        // 'aro': la ficha dice "solo puede terminar por ese lado", y
        // terminar es llegar. Con 'canasta' se quedaba a 1,9 m.
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'El túnel',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Cruzar la media pista botando mientras varios defensores en zonas fijas intentan tocar el balón.',
    objetivos: 'Elegir por dónde pasar leyendo dónde no hay nadie, que es para lo que sirve botar con la cabeza levantada.',
    descripcion_texto: 'Tres defensores se colocan en tres franjas transversales de la media pista y no pueden salir de la suya. Los atacantes cruzan de un fondo al otro botando; si les tocan el balón, vuelven a empezar. Salen de dos en dos para que haya que elegir hueco y no seguir al de delante.',
    notas: 'Puntos clave: se decide el hueco ANTES de entrar en la franja, no dentro; el cambio de ritmo vale más que el cambio de mano. Error frecuente: ir siempre por el mismo sitio y a la misma velocidad. Si dos atacantes salen a la vez y van juntos, hazlos salir por lados opuestos: aprenden a leer antes.',
    tags: ['bote', 'cabeza levantada', 'cambio de ritmo', 'toma de decisiones', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real', presion: 'espacio',
      requisito_previo: 'botar en carrera sin mirar el balón',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: los doce a la vez en dos túneles paralelos de seis. Se cruza y se vuelve al final del propio túnel, sin parar.',
      niveles: {
        base: 'dos defensores y franjas anchas.',
        intermedio: 'tres defensores.',
        avanzado: 'tres defensores que además pueden dar un paso fuera de su franja, y los atacantes cruzan de uno en uno con todos mirando.',
      },
      criterio_exito: 'cruzar tres de cada cuatro veces sin que le toquen el balón',
    },
    tablero: () => [
      jug('A', 1, 0.7648, 0.3705), jug('A', 2, 0.7648, 0.6357),
      jug('B', 1, 0.6053, 0.5031), jug('B', 2, 0.4459, 0.344), jug('B', 3, 0.2865, 0.6092),
      cono(0.6053, 0.1495), cono(0.6053, 0.8567), cono(0.4459, 0.1495), cono(0.4459, 0.8567), cono(0.2865, 0.1495), cono(0.2865, 0.8567),
      balon(0.7648, 0.3705), balon(0.7648, 0.6357),
    ],
    /* Una fase por franja, y el hueco lo dice el defensor: en la
       primera está en el medio y los dos salen por fuera; en la
       segunda está arriba y se cruza por abajo; en la tercera está
       abajo y se cruza por arriba. Es LA decisión del ejercicio, y
       en el montaje estático no se veía por ninguna parte. */
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.537, y: 0.2909 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.537, y: 0.7506 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.6053, y: 0.397 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3776, y: 0.5738 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.3776, y: 0.733 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.4459, y: 0.4501 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.1954, y: 0.3616 } },
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.1954, y: 0.2379 } },
          { jugador: 'B3', tipo: 'defiende', hacia: { x: 0.2865, y: 0.5031 } },
        ] },
      ],
    },
  },

  /* ═══ HUECOS QUE MARCABA EL LINTER ═════════════════════════ */
  {
    name: 'Dos contra uno con pase obligado',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Superioridad de dos contra uno donde solo vale la canasta que llega tras pase: obliga a pasar contra alguien.',
    objetivos: 'Pasar con un defensor de por medio, eligiendo el tipo de pase y el momento según cómo se coloque.',
    descripcion_texto: 'Dos atacantes desde el medio campo contra un defensor. La canasta solo cuenta si llega después de un pase, así que el que lleva el balón tiene que atraer al defensor y soltarla. Máximo tres pases. Se rota: el que anota o pierde el balón pasa a defender.',
    notas: 'Puntos clave: se ataca al defensor antes de pasar; un pase con el defensor lejos no es un pase, es un traslado. El tipo de pase lo decide dónde tenga las manos: arriba, picado; abajo, de pecho. Error frecuente: pasar por delante del defensor cuando el picado es lo que corresponde, y perder el balón. Otro: el receptor se queda parado esperando en vez de ir hacia el hueco.',
    tags: ['pase', 'superioridad', 'toma de decisiones', 'lectura', 'ventaja'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'pasar en movimiento y recibir sin frenar del todo',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, trabajando en tríos. Rotan las tres posiciones cada ataque.',
      niveles: {
        base: 'el defensor solo puede defender al del balón, y no puede interceptar.',
        intermedio: 'defensa completa y máximo tres pases.',
        avanzado: 'máximo dos pases y el defensor arranca desde delante, no desde el aro.',
      },
      criterio_exito: 'anotar tras pase en tres de cada cuatro superioridades',
    },
    tablero: () => [
      jug('A', 1, M.escolta_izq[0] + 0.10, M.escolta_izq[1]),
      jug('A', 2, M.escolta_der[0] + 0.10, M.escolta_der[1]),
      jug('B', 1, M.tiro_libre[0], M.tiro_libre[1]),
      balon(M.escolta_izq[0] + 0.10, M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_izq' }, { jugador: 'A2', tipo: 'corte', hacia: 'poste_bajo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Tres contra dos continuo',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 10, duration_max: 20,
    description: 'Superioridad de tres contra dos de canasta a canasta, encadenada, donde los defensores van cambiando.',
    objetivos: 'Leer una defensa en inferioridad y castigarla rápido, sin dejar que se recompongan.',
    descripcion_texto: 'Tres atacantes salen contra dos defensores. Al terminar la jugada, dos de los atacantes se quedan a defender y los dos defensores más uno que entra desde el fondo atacan hacia la otra canasta. El ejercicio no para nunca. Máximo tres pases y hay que terminar en menos de seis segundos.',
    notas: 'Puntos clave: los tres corren por carriles distintos, y el del balón ataca al primer defensor; nunca se pasa por encima de un defensor que ya está comprometido. Error frecuente: precipitarse y pasar antes de que el defensor decida. Otro: los tres convergen al centro y la superioridad desaparece sola. Es el ejercicio que más rápido enseña espaciado, porque el castigo es inmediato.',
    tags: ['juego reducido', 'superioridad', 'contraataque', 'espaciado', 'toma de decisiones', 'transición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'correr el contraataque por carriles y pasar sin frenar',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: un solo grupo en pista entera. Salen de cinco en cinco y el resto espera al fondo; se entra en cuanto la jugada anterior cruza el medio.',
      niveles: {
        base: '3c2 en media pista, sin límite de tiempo.',
        intermedio: 'pista entera, tres pases, seis segundos.',
        avanzado: '4c3, que obliga a leer a tres defensores y a ocupar cuatro espacios.',
      },
      criterio_exito: 'anotar en tres de cada cuatro superioridades dentro de los seis segundos',
    },
    tablero: () => [
      jug('A', 1, E.escolta_izq[0], 0.7005), jug('A', 2, E.base[0], 0.737), jug('A', 3, E.escolta_der[0], 0.7005),
      jug('B', 1, E.tiro_libre[0], E.tiro_libre[1]), jug('B', 2, E.poste_bajo_der[0], E.poste_bajo_der[1]),
      balon(E.base[0], 0.737),
    ],
    intent: null,
  },
  {
    name: 'Bloqueo de rebote por parejas',
    type: 'Defensa', category: 'rebote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El entrenador tira y falla a propósito: el defensor tiene que buscar a su par, bloquearle y coger el balón.',
    objetivos: 'Automatizar el gesto de ir a por el atacante antes que a por el balón, que es lo contrario de lo que sale solo.',
    descripcion_texto: 'Parejas repartidas alrededor de la zona, atacante y defensor. El entrenador tira y falla. Cada defensor tiene que girar, encontrar a su par, hacer contacto con el cuerpo y solo entonces ir al rebote. Si el atacante coge el rebote, punto para el ataque. Se juega a cinco.',
    notas: 'Puntos clave: primero se busca al ATACANTE y después el balón, que es exactamente al revés de lo que hace un niño por instinto; el contacto es con el trasero y los codos altos, no empujando con las manos. Error frecuente: mirar el balón y salir corriendo hacia él, dejando la espalda del atacante libre. Consejo: los dos primeros minutos, prohíbe coger el rebote — solo bloquear. Cuando eso sale, ya se coge.',
    tags: ['rebote defensivo', 'bloqueo de rebote', 'rebote ofensivo', 'defensa individual'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'mantener la postura defensiva y girar sin perder el equilibrio',
      dosis: { series: 4, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta. En cada uno, dos parejas alrededor de la zona y dos que se turnan para tirar y fallar.',
      niveles: {
        base: 'el atacante no se mueve y solo hay que hacer el contacto.',
        intermedio: 'el atacante busca el rebote de verdad.',
        avanzado: 'dos contra dos, con el atacante pudiendo cambiar de lado antes del tiro.',
      },
      criterio_exito: 'el defensor hace contacto antes de ir al balón en cuatro de cada cinco tiros',
    },
    tablero: () => [
      jug('A', 1, M.poste_bajo_der[0] + 0.06, M.poste_bajo_der[1]),
      jug('A', 2, M.poste_bajo_izq[0] + 0.06, M.poste_bajo_izq[1]),
      jug('B', 1, M.poste_bajo_der[0], M.poste_bajo_der[1]),
      jug('B', 2, M.poste_bajo_izq[0], M.poste_bajo_izq[1]),
      jug('A', 3, M.tiro_libre[0] + 0.04, M.tiro_libre[1]),
      balon(M.tiro_libre[0] + 0.04, M.tiro_libre[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A3', tipo: 'tiro', hacia: 'canasta' }] },
        {
          /* `defiende` solo MUEVE al defensor si lleva `marca`: sin ella
             solo lo registra como defensor y se queda clavado. El `hacia`
             es el punto de bloqueo, entre su par y el aro. */
          eventos: [
            /* Los atacantes ATACAN el rebote: la ficha les da punto si lo
               cogen. Antes eran las dos únicas fichas quietas de toda la
               animación, justo en el ejercicio que trata de impedirles
               llegar — se veía a dos defensores bloqueando a nadie. */
            { jugador: 'A1', tipo: 'corte', hacia: { x: M.poste_bajo_der[0] + 0.045, y: M.poste_bajo_der[1] - 0.01 } },
            { jugador: 'A2', tipo: 'corte', hacia: { x: M.poste_bajo_izq[0] + 0.045, y: M.poste_bajo_izq[1] + 0.01 } },
            { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: M.poste_bajo_der[0] + 0.03, y: M.poste_bajo_der[1] } },
            { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: M.poste_bajo_izq[0] + 0.03, y: M.poste_bajo_izq[1] } },
          ],
        },
        // y el bloqueo sirve para algo: el defensor coge el rebote
        { eventos: [{ jugador: 'B1', tipo: 'recoge' }] },
      ],
    },
  },
];
