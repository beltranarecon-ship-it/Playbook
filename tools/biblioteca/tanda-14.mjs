/* ============================================================
   tanda-14.mjs — entrada a canasta (Bloque D).

   El bloque donde vive el error histórico de esta biblioteca: trece
   fichas llamadas «entrada» o «doble ritmo» soltaban el balón a dos,
   tres y hasta nueve metros del aro, porque el compilador AVANZA con
   `hacia: 'canasta'` y solo LLEGA con `hacia: 'aro'`. Aquí todas las
   finalizaciones terminan en el aro, y el linter lo comprueba.

   Doctrina que más aprieta aquí:
     D17 · se empieza cerca y la distancia se gana; una entrada es la
           canasta más rentable del minibasket y la que más se falla
     D19 · la oposición sube en cuatro escalones: primero el gesto
           limpio, después el perseguidor, después el que llega de
           frente y por último el contacto
     D5  · un ejercicio de fila que acaba en tiro cierra el ciclo:
           recoge el rebote y vuelve a la cola, o no se puede repetir
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_14 = [

  /* ═══ EL GESTO LIMPIO, POR LOS DOS LADOS ═══════════════════ */
  {
    name: 'Dos pasos desde el cono',
    type: 'Bote', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Sin bote y sin carrera: se recoge el balón en el cono y solo se dan los dos pasos del doble ritmo.',
    objetivos: 'Aislar el ritmo de los dos apoyos antes de meterle velocidad, que es lo que hace que después no salgan pasos.',
    descripcion_texto: 'Un cono a tres metros del aro, en el 45. Se llega andando, se coge el balón del cono con las dos manos y desde ahí solo se dan los dos pasos: el primero largo, el segundo corto para frenar y subir, y se deja el balón en el tablero con la mano de fuera. Sin bote y sin correr. Ocho por lado.',
    notas: 'Puntos clave: paso LARGO y paso CORTO, en ese orden y siempre; se sube la rodilla del lado del brazo que tira, que es lo que da altura y además protege; el balón se deja arriba en el cuadrado del tablero, no se lanza. Errores frecuentes: dos pasos iguales, con lo que no hay impulso; y subir la rodilla contraria, que descoloca el cuerpo entero. Empieza SIEMPRE aquí con los que aún hacen pasos: quitar la carrera y el bote deja el gesto solo, y en dos sesiones se instala. Y no lo alargues más de cinco minutos: es la puerta de entrada, no el ejercicio.',
    tags: ['entrada', 'doble ritmo', 'finalización', 'analítico', 'series'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'sostener el balón con las dos manos y saltar sobre un pie sin perder el equilibrio',
      dosis: { series: 2, cantidad: 8, unidad: 'repeticiones', descanso: 30 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación en dos filas de tres —una por lado del aro— para que se trabajen los dos lados a la vez.',
      niveles: {
        base: 'los dos pasos andando y por el lado dominante.',
        intermedio: 'los dos pasos a trote y por los dos lados.',
        avanzado: 'los dos pasos llegando en carrera desde tres metros más atrás.',
      },
      criterio_exito: 'ocho repeticiones por lado con el primer paso más largo que el segundo y sin pasos',
      aplicacion: 'la entrada tras recepción en el 45, donde ese mismo ritmo de dos apoyos tiene que salir en carrera y con un pase de por medio',
    },
    tablero: () => [
      fila(0.332, 0.6445, 3, 0),
      cono(0.2637, 0.6092),
      balon(0.332, 0.6445),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Entrada por el lado malo',
    type: 'Bote', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Doble ritmo por el lado no dominante y terminando con esa mano: la mitad del aro que casi nadie tiene.',
    objetivos: 'Tener las dos entradas, porque un jugador que solo entra por un lado es un jugador al que se defiende con medio cuerpo.',
    descripcion_texto: 'Fila en el 45 del lado no dominante. Se sale botando con esa mano, dos botes, y se termina en doble ritmo apoyando el balón con la misma mano. La mano buena no toca el balón en el último tramo. Cinco repeticiones, se coge el propio rebote y se vuelve por fuera. Después se hace la serie por el lado bueno para comparar.',
    notas: 'Puntos clave: por el lado malo hay que salir un paso ANTES, porque el control es peor y hace falta margen; la rodilla que sube es la del lado del balón. Error frecuentísimo: cambiar el balón a la mano buena en el último paso, que es lo que hace el cuerpo solo — si lo ves, para la repetición y que la repita, aunque falle. Lo que hay que celebrar aquí no es la canasta: es que termine con esa mano. La canasta llega en dos meses, y si celebras la canasta se pasarán dos meses cambiándose el balón.',
    tags: ['entrada', 'doble ritmo', 'mano no dominante', 'bote', 'series'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'botar en carrera con la mano no dominante sin mirar el balón',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación en dos filas de tres. Una serie por el lado malo y otra por el bueno, y se comparan.',
      niveles: {
        base: 'sin bote: se recibe en carrera y se dan los dos pasos con la mano mala.',
        intermedio: 'dos botes con la mano no dominante y finalización con esa mano.',
        avanzado: 'salida desde medio campo, con un cono a rodear antes de entrar.',
      },
      criterio_exito: 'cinco entradas terminadas con la mano no dominante, entren o no entren',
    },
    tablero: () => [
      fila(M.escolta_izq[0] + 0.10, M.escolta_izq[1], 4, 180),
      balon(M.escolta_izq[0] + 0.10, M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.2865, y: 0.397 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Entrada tras recepción en el 45',
    type: 'Pase', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Recibir corriendo desde la esquina y atacar el aro sin botar más de una vez: la entrada que llega de un pase, no de un bote.',
    objetivos: 'Encadenar recepción y finalización, que es como aparece la entrada en el juego real y no como se entrena casi nunca.',
    descripcion_texto: 'Pasador en la punta y fila en la esquina. Se arranca hacia el 45, se recibe en carrera y se ataca el aro con un bote como máximo, terminando en doble ritmo. El que tira coge su rebote y pasa a ser pasador; el pasador va al final de la fila. Cinco por lado.',
    notas: 'Puntos clave: el balón se recibe con los dos pies en el aire o en el primer apoyo, para que el doble ritmo empiece de ahí; con un bote de máximo, el primer paso tiene que ir hacia el aro y no de lado. Errores frecuentes: recibir parado y arrancar después, que regala medio segundo; y dar tres botes porque se ha recibido lejos. Como entrenador, mira el PASE: si llega detrás del receptor, la entrada no puede salir bien y el problema no es del que entra.',
    tags: ['entrada', 'doble ritmo', 'recepción', 'tiro tras recepción', 'finalización'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'recibir en carrera con las dos manos sin frenar y hacer el doble ritmo',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cuatro en la esquina, un pasador y un reboteador que rotan.',
      niveles: {
        base: 'se recibe parado en el 45 y se entra con dos botes.',
        intermedio: 'se recibe en carrera y se entra con un bote.',
        avanzado: 'se recibe en carrera y se entra sin botar.',
      },
      criterio_exito: 'cinco entradas recibiendo en movimiento y con un bote como máximo',
    },
    tablero: () => [
      fila(0.2182, 0.8214, 4, 270),
      jug('A', 1, M.base[0], M.base[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'corte', hacia: { x: 0.332, y: 0.6622 } }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'fila1' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },

  /* ═══ CON ALGUIEN DELANTE ══════════════════════════════════ */
  {
    name: 'Entrada con el defensor de frente',
    type: '1vs1', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'El defensor no persigue: espera colocado bajo el aro, así que hay que elegir el lado antes de llegar.',
    objetivos: 'Decidir por dónde se entra cuando ya hay alguien esperando, que es distinto de escaparse de alguien que viene detrás.',
    descripcion_texto: 'Fila en el 45 con balón y un defensor colocado en el poste bajo, sin poder salir de la zona. Se ataca el aro y hay que terminar por el lado que el defensor deja libre; si se entra encima de él, la repetición no cuenta aunque entre. El defensor no salta ni tapona: solo ocupa el sitio. Cuatro repeticiones y se cambia.',
    notas: 'Puntos clave: la decisión se toma a la altura del tiro libre, no debajo del aro; el último bote va al lado contrario del defensor y el cuerpo se mete entre los dos. Error frecuentísimo: ir siempre en línea recta al aro y estrellarse contra alguien que estaba parado. Otro: decidir tan pronto que el defensor se mueve y ya no vale. Como entrenador, prohíbe la finalización de frente durante dos series: obliga a mirar, que es lo que falta.',
    tags: ['entrada', 'doble ritmo', 'finalización', 'lectura', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'entrar en doble ritmo por los dos lados sin oposición',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cuatro, un defensor y un reboteador. Rotan los tres papeles cada cuatro entradas.',
      niveles: {
        base: 'el defensor se coloca fijo en un lado y lo dice en voz alta.',
        intermedio: 'el defensor elige el lado y no se mueve una vez colocado.',
        avanzado: 'el defensor puede cambiarse de lado una vez mientras el atacante llega.',
      },
      criterio_exito: 'tres de cada cuatro entradas terminan por el lado libre, entren o no entren',
    },
    tablero: () => [
      fila(M.escolta_der[0] + 0.10, M.escolta_der[1], 4, 180),
      jug('B', 1, M.poste_bajo_der[0] + 0.03, M.poste_bajo_der[1] - 0.04),
      balon(M.escolta_der[0] + 0.10, M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.3093, y: 0.6092 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.2068, y: 0.5296 } },
        ] },
        // el defensor ha ocupado el lado de dentro: se termina por fuera
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.1954, y: 0.4943 } },
        ] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Entrar con la mano lejos',
    type: 'Bote', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 6, duration_max: 10,
    description: 'Finalización con mano cambiada: se ataca por un lado y se deja el balón con la mano de fuera al pasar por debajo del aro.',
    objetivos: 'Tener un recurso cuando el defensor ya ha ganado el lado de la entrada, en vez de forzar contra su cuerpo.',
    descripcion_texto: 'Fila en el 45 y un defensor que espera en el poste bajo cerrando el lado corto. Se ataca hacia el aro y, al llegar, se pasa por debajo y se deja el balón al otro lado del tablero con la mano de fuera. El defensor solo ocupa el sitio y levanta un brazo. Cuatro por lado.',
    notas: 'Puntos clave: se pasa POR DEBAJO del aro, no por delante del defensor, y el balón se protege con el cuerpo hasta el último instante; la mano que deja el balón es la más lejana al defensor, y el balón se apoya en el tablero desde el otro lado. Error frecuente: girar el cuerpo demasiado pronto y quedarse sin ángulo con el tablero. Otro: intentar la mano cambiada cuando el lado normal estaba libre — este recurso es para cuando NO está, y si se usa siempre se convierte en un adorno.',
    tags: ['entrada', 'finalización', 'mano no dominante', 'bote de protección', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'entrar en doble ritmo por los dos lados y apoyar el balón en el tablero con las dos manos',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cuatro, un defensor que ocupa el sitio y un reboteador. Rotan cada cuatro entradas.',
      niveles: {
        base: 'sin defensor: solo pasar por debajo y dejar el balón al otro lado.',
        intermedio: 'con defensor que cierra el lado corto.',
        avanzado: 'el defensor elige el lado que cierra y el atacante decide si hace mano cambiada o entrada normal.',
      },
      criterio_exito: 'tres de cada cuatro con el balón apoyado desde el lado contrario y sin contacto de frente',
    },
    tablero: () => [
      fila(M.escolta_der[0] + 0.10, M.escolta_der[1], 4, 180),
      jug('B', 1, M.poste_bajo_der[0] + 0.02, M.poste_bajo_der[1] + 0.02),
      balon(M.escolta_der[0] + 0.10, M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.2865, y: 0.5915 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.1954, y: 0.5738 } },
        ] },
        // se pasa por debajo del aro y se apoya al otro lado
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: { x: 0.1726, y: 0.4501 } }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Entrada con el brazo dentro',
    type: '1vs1', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 5, duration_max: 8,
    description: 'Finalización con contacto legal: el defensor mete el antebrazo y hay que terminar igual, sin perder el equilibrio.',
    objetivos: 'Sostener la finalización cuando llega el contacto, que es lo que separa una canasta de una pérdida cerca del aro.',
    descripcion_texto: 'Fila en el 45 y un defensor junto al aro que acompaña la entrada metiendo el antebrazo en el costado del atacante, sin empujar hacia fuera ni golpear. El atacante tiene que terminar igual, apoyando el balón arriba y cayendo equilibrado. Cuatro repeticiones y se cambia el defensor.',
    notas: 'Puntos clave: el balón sube por el lado CONTRARIO al contacto y con el brazo libre firme para sostener el equilibrio; se salta hacia arriba y no hacia el defensor, que es lo que provoca la falta en ataque. Errores frecuentes: bajar el balón al notar el contacto, y buscar la falta lanzándose. Aviso de seguridad: el defensor acompaña con el antebrazo pegado al cuerpo y nunca golpea el brazo de tiro; si alguien se cae, has subido demasiado. Y explica la diferencia entre contacto legal y falta: la aprenden aquí o la aprenden a base de pitidos.',
    tags: ['entrada', 'finalización', 'equilibrio', 'doble ritmo', 'oposición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'entrar en doble ritmo por los dos lados y caer equilibrado',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cuatro, un defensor que acompaña y un reboteador. Se rota en cada entrada para que nadie encaje contacto seguido.',
      niveles: {
        base: 'el defensor solo levanta los brazos, sin contacto.',
        intermedio: 'antebrazo en el costado durante toda la entrada.',
        avanzado: 'el contacto llega justo al despegar y el defensor puede elegir el lado.',
      },
      criterio_exito: 'tres de cada cuatro entradas terminan arriba y con caída equilibrada, entren o no',
    },
    tablero: () => [
      fila(M.escolta_izq[0] + 0.10, M.escolta_izq[1], 4, 180),
      jug('B', 1, 0.2409, 0.4324),
      balon(M.escolta_izq[0] + 0.10, M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.2865, y: 0.4147 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'fila1', hacia: { x: 0.2523, y: 0.4589 } },
        ] },
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'fila1', hacia: { x: 0.2068, y: 0.4677 } },
        ] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },

  /* ═══ ENTRADA DENTRO DEL JUEGO ═════════════════════════════ */
  {
    name: 'Slalom, cambio y entrada por el otro lado',
    type: 'Bote', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Dos conos que obligan a cambiar de mano y una entrada que hay que terminar con la mano con la que se acabó botando.',
    objetivos: 'Encadenar cambio de mano y finalización, que es donde se rompe la técnica: se cambia bien y se termina con la mano de siempre.',
    descripcion_texto: 'Dos conos entre medio campo y el aro, en diagonal. Se sortea cada uno con un cambio de mano por delante y se ataca el aro terminando OBLIGATORIAMENTE con la mano con la que se salió del último cono. Cinco repeticiones, cogiendo el propio rebote y volviendo por fuera.',
    notas: 'Puntos clave: el cambio se hace antes del cono y el cuerpo se mete entre el cono y el balón; al salir del último, el primer paso del doble ritmo ya va hacia el aro. Error frecuentísimo: cambiar de mano dos veces en el último tramo para poder terminar con la buena — es exactamente lo que la regla prohíbe, y por eso está la regla. Si a alguien no le sale, quítale un cono en vez de la regla: lo que hay que mantener es que la mano de finalización la decida el recorrido.',
    tags: ['entrada', 'cambio de mano', 'bote', 'doble ritmo', 'mano no dominante'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'cambiar de mano en carrera y entrar en doble ritmo por los dos lados',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación en dos filas de tres con su juego de conos; el que termina vuelve a su fila por fuera.',
      niveles: {
        base: 'un cono y finalización libre.',
        intermedio: 'dos conos y la mano de finalización la manda el último cambio.',
        avanzado: 'dos conos, un compañero que señala por qué lado rodear el segundo, y la misma regla de mano.',
      },
      criterio_exito: 'cinco entradas terminadas con la mano que tocaba, entren o no entren',
    },
    /* La cola arranca en 0,62 y no en 0,70: con cuatro esperando y paso
       de 0,06 el último caía en 0,94, y el medio campo acaba en 0,829. */
    tablero: () => [
      fila(0.6509, 0.5031, 4, 0),
      cono(0.537, 0.4501, 'rodear'), cono(0.4004, 0.5561, 'rodear'),
      balon(0.6509, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'fila1', tipo: 'bote', hacia: { x: 0.3548, y: 0.5561 } },
          { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'el_cono_2' },
          { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'el_cono_3' },
        ] },
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: 'Entrada o pase al que ayuda',
    type: '2vs2', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Se entra a canasta y un segundo defensor sale a ayudar: o se termina antes de que llegue, o se suelta al compañero libre.',
    objetivos: 'Meter la entrada dentro de una decisión, que es lo que la convierte en jugada y no en un ejercicio de recorrido.',
    descripcion_texto: 'Atacante en el 45 con balón y compañero en la esquina contraria, con sus dos defensores. El atacante entra; el defensor de la esquina decide si sale a ayudar. Si sale, hay que pasar al compañero libre; si no sale, hay que terminar la entrada. Punto solo si la decisión fue la correcta. Tres posesiones y rotan.',
    notas: 'Puntos clave: la decisión se toma en el aire o justo antes de despegar, mirando si la ayuda ha llegado de verdad; y el pase sale con las dos manos y por encima, nunca con una desde el aire. Error frecuentísimo: decidir el pase antes de saltar y regalar el balón a un defensor que no había salido. Otro, contrario: no ver la ayuda y estrellarse. Como entrenador cuenta las DECISIONES, no las canastas: un pase bueno a un compañero que falla vale lo mismo que una entrada metida.',
    tags: ['entrada', 'finalización', 'toma de decisiones', 'pase', 'ayuda', 'oposición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'entrar en doble ritmo con un defensor cerca y pasar en movimiento',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos cuartetos por canasta que se turnan cada tres posesiones.',
      niveles: {
        base: 'la ayuda sale siempre y solo se practica el pase.',
        intermedio: 'la ayuda decide y el atacante lee.',
        avanzado: 'la ayuda puede fintar la salida y volver con su par.',
      },
      criterio_exito: 'la decisión es la correcta en dos de cada tres posesiones',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, 0.2068, 0.2556),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 2, 0.2409, 0.3086),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.2637, y: 0.6092 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2979, y: 0.5915 } },
        ] },
        // la ayuda NO sale: hay entrada. El compañero de la esquina se
        // abre igual, porque su trabajo es estar disponible por si sale
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2409, y: 0.5738 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.2865, y: 0.2202 } },
          { jugador: 'B2', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2751, y: 0.2644 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Diez entradas contra el reloj',
    type: 'Bote', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Competición por parejas: diez entradas alternando lado, contando las que entran y el tiempo total.',
    objetivos: 'Meter la entrada en competición cuando el gesto ya está, que es cuando se ve si aguanta con prisa.',
    descripcion_texto: 'Por parejas, un balón. Uno entra y el otro coge el rebote y se lo devuelve en el 45 contrario; se alternan los lados en cada entrada. Diez entradas seguidas por jugador, contando aciertos y tiempo. Se apunta el mejor registro de la pareja y se intenta batir en la serie siguiente.',
    notas: 'Puntos clave: con prisa lo primero que se rompe es el orden de los pasos, así que el que rebotea también vigila; alternar lado impide que nadie haga diez por su lado bueno. Error del entrenador: cronometrar antes de que el gesto esté instalado — entonces esto entrena a hacerlo mal deprisa. Es el último escalón del bloque, no el primero. Si ves que aparecen pasos, quita el reloj y cuenta solo aciertos durante dos sesiones.',
    tags: ['entrada', 'doble ritmo', 'competición', 'series', 'mano no dominante'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'marcador',
      requisito_previo: 'entrar en doble ritmo por los dos lados sin pasos',
      dosis: { series: 3, cantidad: 10, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos estaciones, una por canasta, tres parejas por estación turnándose; mientras una pareja corre el reloj, otra cuenta y la tercera descansa.',
      niveles: {
        base: 'diez entradas sin reloj, contando solo aciertos y por el lado bueno.',
        intermedio: 'diez alternando lado, con reloj.',
        avanzado: 'diez alternando lado y con un bote de máximo por entrada.',
      },
      criterio_exito: 'siete de diez dentro sin que aparezca ningún paso, según el compañero',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 2, M.poste_bajo_izq[0] + 0.04, M.poste_bajo_izq[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
        // se devuelve el balón en el 45 CONTRARIO: la siguiente va por
        // el otro lado, que es lo que impide hacer diez por el bueno
        { eventos: [
          { jugador: 'A1', tipo: 'corte', hacia: { x: M.escolta_izq[0], y: M.escolta_izq[1] } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
      ],
    },
  },
];
