/* ============================================================
   tanda-04.mjs — pase, entrada, juego de dos y contraataque.

   Los cuatro bloques que iban más rezagados. Cubre los contenidos
   que el linter marcaba sin cubrir: pase por encima, pase de
   béisbol, pase al poste; finalización con contacto y con mano
   cambiada; puerta atrás, aclarado, mano a mano y continuación;
   transición tras rebote y balance defensivo.

   Nota de doctrina para el juego de dos: D23 saca el BLOQUEO DIRECTO
   del núcleo mini —entra cuando el 1c1 está resuelto, no por edad—,
   así que aquí van las herramientas que dan ventaja entre dos SIN
   contacto: puerta atrás, aclarado y mano a mano. El indirecto sí
   aparece, con su requisito previo declarado.
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_04 = [

  /* ═══ PASE ═════════════════════════════════════════════════ */
  {
    name: 'Pase por encima al poste',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Entrar el balón al poste bajo por encima de un defensor que lo defiende por delante.',
    objetivos: 'Elegir el pase que pasa por encima cuando el de pecho no cabe, y hacerlo sin que se convierta en un globo.',
    descripcion_texto: 'Pasador en el 45, receptor en el poste bajo y un defensor delante del receptor, entre él y el balón. El pasador tiene que meterle el balón por encima. El receptor pide con las dos manos altas y sostiene la posición. Cinco pases y rotan las tres posiciones.',
    notas: 'Puntos clave: el pase sale desde encima de la cabeza y va tenso y descendente, no en parábola; el pasador da un paso lateral primero para cambiar el ángulo. Error frecuente: lanzar un globo alto, que da tiempo a que llegue una ayuda y se convierte en pérdida. Segundo error, del receptor: pedir con una mano y perder la posición. Si el pase no entra nunca, mueve al pasador un metro: casi siempre es cuestión de ángulo, no de fuerza.',
    tags: ['pase', 'recepción', 'lectura', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'pasar con las dos manos desde encima de la cabeza a cinco metros',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, poste y defensor. Se rota al terminar cada serie.',
      niveles: {
        base: 'sin defensor, practicando la trayectoria tensa por encima.',
        intermedio: 'con defensor por delante que no puede saltar.',
        avanzado: 'defensor completo más un segundo defensor que puede ayudar desde el lado contrario.',
      },
      criterio_exito: 'el balón entra al poste en tres de cada cinco intentos sin que lo toque el defensor',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.poste_bajo_der[0] + 0.05, M.poste_bajo_der[1]),
      jug('B', 1, M.poste_bajo_der[0] + 0.02, M.poste_bajo_der[1] - 0.02),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Pase de béisbol y carrera',
    type: 'Pase', category: 'pase', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Sacar rápido tras canasta con un pase largo a un compañero que ya corre, y terminar al otro lado.',
    objetivos: 'Dominar el pase largo con una mano, que es el que abre el contraataque cuando nadie ha vuelto todavía.',
    descripcion_texto: 'Un jugador saca de fondo tras canasta y otro arranca desde su lado hacia la canasta contraria. El saque tiene que ser un pase de béisbol que le llegue en carrera, sin que tenga que frenar. Un tercero persigue al receptor desde media pista. Se rota: el que anota saca, el que sacó corre.',
    notas: 'Puntos clave: el pase sale desde detrás de la oreja con una mano, con el pie contrario adelantado, y se dirige DELANTE del receptor, no a él. Error frecuentísimo: pasar a donde está el compañero, con lo que tiene que frenar y se pierde toda la ventaja. Otro: pasar con las dos manos desde el pecho, que no llega. Enséñales a mirar el campo antes de coger el balón del suelo.',
    tags: ['pase', 'pase de béisbol', 'contraataque', 'transición', 'recepción'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 2, estaciones: 1,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'pasar con una mano a diez metros manteniendo la dirección',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: pista entera y las dos canastas, cuatro tríos que salen escalonados desde el fondo cada diez segundos.',
      niveles: {
        base: 'media pista y sin perseguidor.',
        intermedio: 'pista entera con perseguidor desde el medio.',
        avanzado: 'dos receptores por lados distintos y el pasador elige, con dos perseguidores.',
      },
      criterio_exito: 'el receptor no tiene que frenar en cuatro de cada cinco pases',
    },
    tablero: () => [
      jug('A', 1, E.esquina_der[0], 0.901),
      jug('A', 2, E.alero_izq[0], 0.6823),
      jug('B', 1, E.centro[0], E.centro[1]),
      balon(E.esquina_der[0], 0.901),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'alero_izq' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Rondo 4c2',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 12,
    description: 'Cuatro por fuera y dos dentro persiguiendo el balón: conservar con presión constante y sin bote.',
    objetivos: 'Pasar y recibir bajo presión continua, decidiendo el tipo de pase en función de dónde estén los dos de dentro.',
    descripcion_texto: 'Cuatro atacantes forman un cuadrado grande y dos defensores están dentro. No se puede botar. Los de fuera pueden desplazarse por su lado. Quien pierde el balón entra a defender. Se cuenta el récord de pases seguidos del grupo y se intenta batir cada ronda.',
    notas: 'Puntos clave: el pase al de enfrente casi nunca está; el bueno es el del lado, y por eso hay que mover los pies para abrir ángulo. Se decide ANTES de recibir. Error frecuente: mirar solo al que va a recibir, que se lo dice a los defensores. Enséñales a mirar a uno y pasar a otro solo cuando ya dominen lo básico; antes de eso, mirar al receptor está bien.',
    tags: ['pase', 'recepción', 'toma de decisiones', 'lectura', 'competición', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'pasar de pecho y picado con precisión a cinco metros',
      dosis: { series: 4, cantidad: 90, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: dos rondos de seis a la vez, uno en cada media pista. No usa canastas.',
      niveles: {
        base: '5c1 en un espacio grande, y se puede devolver el pase.',
        intermedio: '4c2 sin devolver.',
        avanzado: '4c2 con máximo dos segundos con el balón y sin poder repetir receptor dos veces seguidas.',
      },
      criterio_exito: 'batir el récord de pases seguidos del grupo al menos una vez por sesión',
    },
    tablero: () => [
      jug('A', 1, 0.2637, 0.3086), jug('A', 2, 0.2637, 0.6976),
      jug('A', 3, 0.6281, 0.3086), jug('A', 4, 0.6281, 0.6976),
      jug('B', 1, 0.4004, 0.4501), jug('B', 2, 0.4915, 0.5738),
      balon(0.2637, 0.3086),
    ],
    /* Tres pases DE LADO y ninguno de enfrente, que es literalmente lo
       que dicen las notas: el de enfrente casi nunca está. Los dos de
       dentro se mueven con el balón en cada fase, para que se vea por
       qué el pase bueno es el corto. */
    intent: {
      canasta: null,
      fases: [
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.3548, y: 0.5561 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.4459, y: 0.4501 } },
          { jugador: 'A1', tipo: 'pase', a: 'A2' },
        ] },
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.4231, y: 0.6445 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.3548, y: 0.5208 } },
          { jugador: 'A2', tipo: 'pase', a: 'A4' },
        ] },
        { eventos: [
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.5598, y: 0.5915 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.4687, y: 0.4854 } },
          { jugador: 'A4', tipo: 'pase', a: 'A3' },
        ] },
      ],
    },
  },
  {
    name: 'Pasa y mira antes',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Tres atacantes, dos defensores y una consigna: decir en voz alta a quién vas a pasar antes de recibir.',
    objetivos: 'Adelantar la lectura al momento anterior a la recepción, que es lo que separa a quien pasa bien de quien pasa tarde.',
    descripcion_texto: 'Tres atacantes en la punta y los dos 45, dos defensores. Antes de que el balón le llegue, el que va a recibir tiene que decir en voz alta el nombre del compañero al que va a pasar. Si al recibir la situación ha cambiado, puede cambiar de idea, pero tiene que decirlo también. Se juega a ocho pases sin pérdida.',
    notas: 'Puntos clave: para poder decirlo, hay que mirar mientras el balón viaja, y eso es todo el ejercicio. Espera muchos errores al principio y no los corrijas: equivocarse en voz alta es exactamente el aprendizaje. Error del entrenador: exigir que acierten. Lo que hay que exigir es que HABLEN antes de recibir; el acierto llega solo.',
    tags: ['pase', 'lectura', 'toma de decisiones', 'recepción', 'espaciado'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'pasar y recibir en movimiento con un defensor cerca',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta. Juegan cinco y el que sobra cuenta los pases buenos; se cambia cada minuto.',
      niveles: {
        base: 'dos atacantes y un defensor, diciendo el nombre.',
        intermedio: 'tres contra dos.',
        avanzado: 'tres contra dos y quien recibe tiene que pasar obligatoriamente a quien dijo, con lo que la lectura tiene que ser buena de verdad.',
      },
      criterio_exito: 'todos dicen el nombre antes de recibir en ocho pases seguidos, acierten o no',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.escolta_der[0], M.escolta_der[1]), jug('A', 3, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]), jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A3' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A3', tipo: 'pase', a: 'A2' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ ENTRADA ══════════════════════════════════════════════ */
  {
    name: 'Finalización con contacto',
    type: '1vs1', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Entrar recibiendo un choque controlado del defensor: terminar aunque te empujen.',
    objetivos: 'Aprender a finalizar con contacto sin perder el equilibrio ni la trayectoria del balón.',
    descripcion_texto: 'El atacante entra desde el 45 y el defensor, que espera bajo el aro, le hace un contacto controlado en el cuerpo —nunca en el brazo de tiro— cuando salta. El atacante tiene que terminar igualmente. Cinco entradas y se cambia. El defensor lleva un peto enrollado o una colchoneta pequeña si se quiere suavizar.',
    notas: 'Puntos clave: se protege el balón con el cuerpo y se sube con el brazo lejos del defensor; el salto va hacia ARRIBA, no hacia el contacto. Error frecuente: encoger los brazos al notar el choque, con lo que el tiro se queda corto. Segundo error, del defensor: buscar el brazo. Esto hay que vigilarlo de cerca; si no puedes supervisarlo, no lo pongas.',
    tags: ['entrada', 'finalización', 'doble ritmo', '1c1'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'entrar en doble ritmo por los dos lados sin defensa',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: seis parejas, tres en cada canasta, entrando por turnos. Cinco entradas y se cambia quien hace el contacto.',
      niveles: {
        base: 'el defensor solo pone las manos arriba sin contacto.',
        intermedio: 'contacto controlado en el cuerpo al saltar.',
        avanzado: 'contacto y además el atacante llega con menos velocidad, teniendo que resolver con el pie de dentro.',
      },
      criterio_exito: 'anotar tres de cada cinco con contacto, sin encoger los brazos',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.poste_bajo_der[0], M.poste_bajo_der[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      // 'aro': el contacto es AL SALTAR bajo el aro. Con 'canasta' el
      // atacante frenaba a 2,6 m, donde no hay contacto que aguantar.
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Mano cambiada bajo el aro',
    type: 'Tiro', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Entrar por un lado y terminar con la otra mano al otro lado del aro, esquivando al que espera debajo.',
    objetivos: 'Ampliar el repertorio de finalización para cuando el camino directo está tapado.',
    descripcion_texto: 'Por parejas. El atacante entra desde el 45 derecho y tiene que terminar con la mano izquierda al otro lado del aro, pasando por debajo. Un compañero con los brazos en alto ocupa el camino directo, sin saltar. Cinco entradas y se cambia de lado y de papel.',
    notas: 'Puntos clave: el balón cruza por debajo del aro protegido con las dos manos hasta el último momento; el apoyo de salto es el pie de fuera. Error frecuente: cambiar de mano demasiado pronto y quedar vendido delante del defensor. Otro: mirar el aro desde el principio; hay que mirar el punto del tablero del otro lado. Es difícil y da igual que fallen mucho al empezar.',
    tags: ['entrada', 'finalización', 'mano no dominante', 'bandeja'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'pasiva', presion: 'ninguna',
      requisito_previo: 'entrar en doble ritmo con la mano no dominante',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: seis parejas, tres en cada canasta, entrando por turnos desde el 45. Cinco cada uno y se cambia.',
      niveles: {
        base: 'sin nadie debajo, solo el recorrido y el cambio de mano.',
        intermedio: 'con un compañero con los brazos arriba.',
        avanzado: 'el que espera puede moverse un paso, y el atacante decide entre terminar directo o cambiar de mano.',
      },
      criterio_exito: 'dos de cada cinco dentro terminando de verdad con la mano cambiada',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.poste_bajo_der[0] + 0.02, M.poste_bajo_der[1] - 0.04),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        /* El defensor esperaba bajo el aro sin hacer nada en toda la
           animación; ahora al menos consta como defensor y se ajusta.
           Y el cruce termina PEGADO al aro por el lado izquierdo (que es
           lo que significa "mano cambiada bajo el aro"): antes acababa en
           el ancla del poste bajo, a 2,6 m, y desde ahí ya no es una
           mano cambiada, es un tiro. */
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'poste_bajo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: { x: 0.168, y: 0.4633 } }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Entrada desde el fondo',
    type: '1vs1', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Recibir en la esquina y atacar por línea de fondo, donde el espacio es estrecho y el tablero ayuda menos.',
    objetivos: 'Finalizar desde el ángulo más incómodo de la pista, que además es por donde más se ataca en minibasket.',
    descripcion_texto: 'Pasador en la punta y atacante en la esquina, con su defensor. El atacante recibe y ataca obligatoriamente por línea de fondo. El defensor le acompaña. Como el espacio es estrecho, hay que ir pegado al fondo y decidir pronto. Tres cada uno.',
    notas: 'Puntos clave: se ataca pegado a la línea, y el tablero desde ahí no sirve casi, así que hay que tirar limpio o cruzar bajo el aro; el paso de salida es largo y bajo. Error frecuente: abrirse hacia el centro para tener más sitio, que es justo lo que quiere el defensor. Ojo con pisar la línea: cuenta como pérdida y conviene que lo sepan desde el principio.',
    tags: ['entrada', 'finalización', '1c1', 'recepción', 'bote'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'entrar en doble ritmo y proteger el balón con el cuerpo',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante y defensor. Tres cada uno y rotan.',
      niveles: {
        base: 'sin defensor, solo el recorrido por fondo y la finalización.',
        intermedio: 'con defensor que acompaña.',
        avanzado: 'con un segundo defensor que puede ayudar desde el poste bajo.',
      },
      criterio_exito: 'terminar sin pisar la línea de fondo en tres de cada tres ataques',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.esquina_der[0], M.esquina_der[1]),
      jug('B', 1, M.esquina_der[0] - 0.04, M.esquina_der[1] - 0.04),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        /* "por línea de fondo" quiere decir pegado al fondo: primero se
           mete por el pasillo estrecho (el punto explícito va casi sobre
           la línea) y solo después se termina en el aro. Antes acababa en
           el ancla del poste bajo y tiraba desde 2,4 m, que no es una
           entrada por el fondo sino una parada a media distancia. */
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: { x: 0.1567, y: 0.6445 } }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'aro' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ JUEGO DE DOS ═════════════════════════════════════════ */
  {
    name: 'Puerta atrás al que se pasa de listo',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Cuando el defensor se adelanta para interceptar, el atacante corta por detrás y recibe en camino a canasta.',
    objetivos: 'Castigar al defensor que se pasa de agresivo, que es el único caso en que la puerta atrás existe.',
    descripcion_texto: 'Pasador en la punta, atacante en el 45 y defensor. El defensor tiene instrucciones de adelantarse a interceptar el pase. El atacante finge pedirlo, ve el brazo adelantado y corta por detrás hacia canasta. El pasador tiene que verlo y meter el balón. Tres cada uno.',
    notas: 'Puntos clave: la puerta atrás se hace contra un defensor ADELANTADO, y no de otra forma; el corte cambia de ritmo de golpe y va con la mano de dentro pidiendo. En el núcleo mini nosotros no enseñamos a negar la línea de pase (D22), pero eso no impide que el rival lo haga, o que un compañero se entusiasme: por eso conviene tener la respuesta. Error frecuente: cortar cuando el defensor no está adelantado, con lo que solo se pierde la posición.',
    tags: ['puerta atrás', 'corte', 'lectura', 'pase', 'desmarque', 'ventaja'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'cortar cambiando de ritmo y recibir en movimiento',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos. Rotan pasador, receptor y defensor.',
      niveles: {
        base: 'el defensor se adelanta siempre y el corte va libre.',
        intermedio: 'el defensor elige adelantarse o no, y el atacante lee.',
        avanzado: 'el pasador también decide, y si no ve la puerta atrás pierde la posesión.',
      },
      criterio_exito: 'el corte sale solo cuando el defensor está adelantado, en tres de cada tres lecturas',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.alero_der[0], M.alero_der[1]),
      jug('B', 1, M.alero_der[0] - 0.04, M.alero_der[1] - 0.06),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Aclarado y uno contra uno',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'El compañero se lleva a su defensor al lado contrario para dejar el lado libre: el 1c1 con espacio de verdad.',
    objetivos: 'Entender que ayudar a un compañero muchas veces consiste en irse, no en acercarse.',
    descripcion_texto: 'Dos atacantes y dos defensores. El que no tiene balón se marcha al lado contrario llevándose a su defensor, dejando todo un lado libre. El del balón ataca ese espacio en uno contra uno. Si le ayudan, pasa al compañero, que ahora está solo. Se juega a tres canastas.',
    notas: 'Puntos clave: el aclarado tiene que ser LEJOS —hasta la esquina contraria—, si no el defensor sigue ayudando; el que ataca espera a que el compañero haya llegado. Error frecuente: aclarar dos metros, que no aclara nada. Otro, muy común: el que aclara se queda mirando en vez de prepararse para recibir. Es la herramienta de juego de dos que mejor funciona en minibasket, mejor que cualquier bloqueo (D23).',
    tags: ['aclarado', 'espaciado', '1c1', 'ventaja', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'resolver el uno contra uno con bote y decidir entre tirar y pasar',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; entran cada dos ataques.',
      niveles: {
        base: 'el aclarado ya está hecho al empezar y solo se juega el 1c1 con espacio.',
        intermedio: 'hay que aclarar y luego atacar.',
        avanzado: 'tres atacantes, con dos aclarando y una esquina que puede recibir.',
      },
      criterio_exito: 'el aclarado llega hasta la esquina contraria en tres de cada tres jugadas',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]), jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'esquina_izq' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Mano a mano',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Entregar el balón en mano al compañero que llega corriendo, y que salga con ventaja hacia el aro.',
    objetivos: 'Generar ventaja entre dos sin contacto ni bloqueo, solo con la entrega y el momento.',
    descripcion_texto: 'Un atacante espera con balón en el codo. El otro llega corriendo desde la esquina, recoge el balón en mano y ataca la canasta. Los dos defensores tienen que resolver el cruce. El que entrega puede quedarse o irse al lado contrario. Tres jugadas por pareja.',
    notas: 'Puntos clave: el que entrega sostiene el balón con las dos manos y NO lo suelta hasta que el otro lo tiene agarrado; el que recibe llega a velocidad y sale ya botando. Error frecuente: soltarlo antes de tiempo y convertirlo en un pase malo. Segundo: llegar despacio, con lo que no hay ventaja ninguna. Es la puerta de entrada al bloqueo directo, pero sin contacto, así que encaja en el núcleo mucho antes (D23).',
    tags: ['continuación', 'ventaja', 'salida en bote', 'lectura', '1c1'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'salir en bote a velocidad tras recibir el balón en movimiento',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; se rota cada dos jugadas.',
      niveles: {
        base: 'sin defensores, solo la mecánica de la entrega y la salida.',
        intermedio: 'con los dos defensores.',
        avanzado: 'el que entrega puede quedarse el balón y atacar él si ve que el defensor se anticipa al cruce.',
      },
      criterio_exito: 'la entrega sale limpia y el receptor arranca ya botando en tres de cada tres',
    },
    tablero: () => [
      jug('A', 1, M.codo_der[0], M.codo_der[1]), jug('A', 2, M.esquina_der[0], M.esquina_der[1]),
      jug('B', 1, M.codo_der[0] - 0.05, M.codo_der[1]), jug('B', 2, M.esquina_der[0] - 0.04, M.esquina_der[1] - 0.04),
      balon(M.codo_der[0], M.codo_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'codo_der' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Bloqueo indirecto para el tirador',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 5, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Un atacante sin balón se libra usando el bloqueo de un compañero y recibe para tirar.',
    objetivos: 'Usar y poner un bloqueo lejos del balón, que es más simple de leer que el directo y no exige tener el balón.',
    descripcion_texto: 'Pasador en la punta con balón. Dos atacantes en el lado: uno pone el bloqueo y otro lo usa para salir a recibir al 45. Sus dos defensores intentan impedirlo. El que sale recibe y tira. El bloqueador, después de bloquear, se abre a la esquina. Tres jugadas y rotan.',
    notas: 'Puntos clave: el bloqueador llega quieto y con los pies anchos ANTES de que pase el compañero — si se mueve, es falta; el que lo usa pasa rozando el hombro, no a un metro. Error frecuentísimo: separarse del bloqueo, con lo que el defensor pasa por en medio y no ha servido de nada. REQUISITO: esto se introduce cuando el 1c1 ya está resuelto (D23); antes solo se copia el gesto sin entenderlo.',
    tags: ['bloqueo indirecto', 'continuación', 'desmarque', 'tiro tras recepción', 'lectura'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'resolver el uno contra uno con balón y desmarcarse para recibir sin él',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: cinco jugando y uno que entra en la jugada siguiente. Tres jugadas y rotan.',
      niveles: {
        base: 'sin defensores, solo la mecánica de bloquear quieto y salir rozando.',
        intermedio: 'con los dos defensores.',
        avanzado: 'el que usa el bloqueo puede salir por los dos lados según cómo le defiendan, y el bloqueador puede abrirse o ir al aro.',
      },
      criterio_exito: 'el bloqueador llega parado y el usuario pasa rozando en tres de cada tres',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.codo_izq[0], M.codo_izq[1]),
      jug('A', 3, M.esquina_izq[0], M.esquina_izq[1]),
      jug('B', 2, M.codo_izq[0] - 0.05, M.codo_izq[1]),
      jug('B', 3, M.esquina_izq[0] - 0.04, M.esquina_izq[1] + 0.04),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        /* Faltaban dos cosas que la ficha sí cuenta: que los DOS
           defensores intentan impedirlo (B2 no aparecía en ninguna fase,
           quieto toda la animación) y que "el bloqueador, después de
           bloquear, se abre a la esquina" — que es la continuación que
           hace del bloqueo indirecto algo más que un obstáculo. */
        { eventos: [{ jugador: 'A2', tipo: 'bloqueo', bloqueado_id: 'B3' }, { jugador: 'B3', tipo: 'defiende', marca: 'A3' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A3', tipo: 'corte', hacia: 'escolta_izq' }, { jugador: 'B3', tipo: 'defiende', marca: 'A3' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        {
          eventos: [
            { jugador: 'A2', tipo: 'corte', hacia: 'esquina_izq' },
            { jugador: 'A1', tipo: 'pase', a: 'A3' },
            { jugador: 'B2', tipo: 'defiende', marca: 'A2' },
          ],
        },
        { eventos: [{ jugador: 'A3', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ CONTRAATAQUE ═════════════════════════════════════════ */
  {
    name: 'Rebote y salida',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Coger el rebote defensivo y sacar el balón al lado en un segundo, antes de que la defensa se coloque.',
    objetivos: 'Convertir el rebote en contraataque, que es donde se pierden casi todas las oportunidades fáciles.',
    descripcion_texto: 'El entrenador tira y falla. Tres defensores cogen el rebote y tienen que sacar el balón por el lado con un pase y salir corriendo los tres por carriles distintos hasta la canasta contraria, donde esperan dos defensores. El que coge el rebote no bota: pasa.',
    notas: 'Puntos clave: el que coge el rebote busca el pase de salida ANTES de caer al suelo, y el receptor aparece por el lado, no por delante; los otros dos ya están corriendo. Error frecuentísimo: coger el rebote y botar hacia el centro, que es lo más lento y lo más peligroso. Regla que ayuda: "el rebote no bota". Segundo error: los tres corren por el mismo carril.',
    tags: ['rebote defensivo', 'contraataque', 'transición', 'carriles', 'pase'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'coger el rebote con las dos manos y pasar sin botar',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: pista entera, tres grupos de cuatro que salen por turnos desde la línea de fondo. Se entra en cuanto el grupo anterior cruza el medio.',
      niveles: {
        base: 'rebote y pase de salida, sin correr la pista.',
        intermedio: 'rebote, salida y contraataque 3c2.',
        avanzado: 'rebote, salida y contraataque con los dos defensores saliendo desde media pista, lo que quita casi toda la ventaja.',
      },
      criterio_exito: 'el balón sale al lado con un solo pase en tres de cada cuatro rebotes',
    },
    tablero: () => [
      jug('A', 1, E.poste_bajo_der[0], E.poste_bajo_der[1]),
      jug('A', 2, E.poste_bajo_izq[0], E.poste_bajo_izq[1]),
      jug('A', 3, E.alero_izq[0], E.alero_izq[1]),
      jug('B', 1, E.tiro_libre[0], 0.5911),
      balon(E.poste_bajo_der[0], E.poste_bajo_der[1]),
    ],
    intent: {
      canasta: 'sur',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A3' }] },
        { eventos: [{ jugador: 'A3', tipo: 'bote', hacia: 'centro' }, { jugador: 'A2', tipo: 'corte', hacia: 'centro' }, { jugador: 'B1', tipo: 'defiende', marca: 'A3' }] },
        { eventos: [{ jugador: 'A3', tipo: 'bote', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A3', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Balance defensivo',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Tras tirar, correr hacia atrás para frenar el contraataque contrario en inferioridad.',
    objetivos: 'Automatizar el reflejo de volver, que no es natural: después de tirar, todo el mundo mira el balón.',
    descripcion_texto: 'Tres atacantes terminan una jugada con tiro. En cuanto sale el balón, dos de ellos tienen que salir corriendo hacia su canasta mientras los otros cogen el rebote y contraatacan. Los que balancean llegan en inferioridad y tienen que frenar el balón y proteger el aro. Se rota constantemente.',
    notas: 'Puntos clave: se balancea EN EL TIRO, no cuando se ve que el rebote es del rival; el primero que llega frena el balón y el segundo protege el aro. Error frecuente y universal: quedarse mirando el propio tiro. Este es de los pocos ejercicios donde el objetivo es instalar un reflejo, así que la repetición seguida vale más que la explicación. Si se olvidan, no lo expliques otra vez: haz que corran la vuelta.',
    tags: ['balance defensivo', 'transición', 'inferioridad', 'defensa individual', 'contraataque'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'defender individualmente y correr la pista entera',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: pista entera, tres grupos de cuatro que salen por turnos. El grupo que termina se queda al fondo esperando su vuelta.',
      niveles: {
        base: 'dos atacantes tiran y uno balancea contra un contraataque de uno.',
        intermedio: 'dos balancean contra tres.',
        avanzado: 'dos balancean contra tres y el tirador también tiene que volver, con lo que llegan escalonados y hay que comunicarse.',
      },
      criterio_exito: 'los dos que balancean salen antes de que el balón toque el aro en tres de cada cuatro jugadas',
    },
    tablero: () => [
      jug('A', 1, E.escolta_der[0], E.escolta_der[1]), jug('A', 2, E.esquina_izq[0], E.esquina_izq[1]),
      jug('B', 1, E.poste_bajo_der[0], E.poste_bajo_der[1]), jug('B', 2, E.poste_bajo_izq[0], E.poste_bajo_izq[1]),
      balon(E.escolta_der[0], E.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'centro' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
      ],
    },
  },
  {
    name: 'Tres carriles',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Subir la pista de tres en tres por carriles separados, con el balón por el centro y sin frenar.',
    objetivos: 'Instalar la forma del contraataque: tres carriles, balón al centro y anchura hasta el final.',
    descripcion_texto: 'Tres jugadores salen del fondo, uno por cada carril: banda izquierda, centro y banda derecha. El balón sube por el centro y se pasa a una banda antes de la línea de tiros libres. Nadie puede invadir el carril de otro hasta pasar el medio campo. Un defensor espera para dar algo de decisión.',
    notas: 'Puntos clave: la anchura se mantiene hasta el último momento; el del centro mira a los dos lados antes de decidir. Error frecuentísimo: los tres convergen hacia el balón y llegan en fila, que es como perder la superioridad sin que nadie te la quite. Marca los carriles con conos las primeras veces: se entiende mucho antes viéndolo que oyéndolo.',
    tags: ['contraataque', 'carriles', 'transición', 'espaciado', 'pase'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'botar en carrera a velocidad alta y pasar sin frenar',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: pista entera, cuatro tríos que salen escalonados. El trío que llega al otro lado espera allí su turno para volver.',
      niveles: {
        base: 'tres carriles sin defensor, solo la forma.',
        intermedio: 'con un defensor esperando.',
        avanzado: 'con dos defensores y sin poder pasar por el centro después del medio campo.',
      },
      criterio_exito: 'los tres llegan separados por más de tres metros en cuatro de cada cuatro subidas',
    },
    tablero: () => [
      jug('A', 1, E.alero_izq[0], 0.7734), jug('A', 2, E.base[0], 0.8099), jug('A', 3, E.alero_der[0], 0.7734),
      jug('B', 1, E.tiro_libre[0], E.tiro_libre[1]),
      cono(E.alero_izq[0], E.centro[1]), cono(E.alero_der[0], E.centro[1]),
      balon(E.base[0], 0.8099),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'bote', hacia: 'centro' }, { jugador: 'A1', tipo: 'corte', hacia: 'alero_izq' }, { jugador: 'A3', tipo: 'corte', hacia: 'alero_der' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A3' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A3', tipo: 'bote', hacia: 'canasta' }] },
        { eventos: [{ jugador: 'A3', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
];
