/* marco: 3 */
/* ============================================================
   tanda-12.mjs — juego reducido (Bloque D).

   Donde se consolida todo lo demás (D1). D6 manda en el reparto: 1c1
   y 2c2 son los formatos de más densidad técnica, el 3c3 el mejor
   equilibrio y el 5c5 la herramienta que menos enseña — así que aquí
   no hay ni un 5c5.

   Esta tanda cierra los tres huecos que el linter marcaba a cero:
   1c1 CON REGLAS, las SUPERIORIDADES de 2c1 y 3c2, y las
   INFERIORIDADES, que es el formato que más rápido enseña a defender
   en equipo y el que menos se monta porque perder incomoda.

   Casi todas van sin animación a propósito: en un juego abierto,
   dibujar un desenlace es enseñar una jugada cerrada donde tiene que
   haber lectura. Lo que sí está cuidado es el MONTAJE, que es lo que
   el entrenador copia a la pista. Las dos superioridades sí se animan
   porque su primer tramo no es libre: la geometría del 2c1 y del 3c2
   es exactamente lo que hay que enseñar.
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_12 = [

  /* ═══ SUPERIORIDADES ═══════════════════════════════════════ */
  {
    name: 'Superioridad 2c1 con el defensor eligiendo',
    type: '2vs2', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'La más frecuente de las superioridades, dos contra uno, con el defensor eligiendo a quién parar: la ventaja se cobra leyendo, no corriendo.',
    objetivos: 'Enseñar a resolver las superioridades por lectura y no por velocidad, que es lo que las hace repetibles cuando el rival también corre.',
    descripcion_texto: 'Dos atacantes desde medio campo contra un defensor colocado en la línea de tiros libres. El defensor tiene que elegir: o para al del balón o tapa la línea de pase, pero no puede hacer las dos cosas. Los atacantes tienen tres pases de máximo y no vale terminar de lejos: la canasta solo cuenta desde dentro de la zona. Una posesión y rotan los tres.',
    notas: 'Puntos clave: el del balón ATACA al defensor antes de pasar —si pasa con el defensor lejos, no es un pase, es un traslado— y el que no lleva balón corre por su carril y con la mano pedida. Error frecuentísimo: pasar en cuanto se cruza el medio campo, con lo que el defensor solo tiene que retroceder. Otro: los dos por el mismo carril. Como entrenador, mira DÓNDE se toma la decisión: si es a la altura del tiro libre, va bien; si es en el medio campo, aún no han entendido nada.',
    tags: ['juego reducido', 'superioridad', 'ventaja', 'toma de decisiones', 'lectura'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'ninguna',
      requisito_previo: 'pasar y recibir en movimiento con un defensor cerca',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en dos tríos por canasta que se turnan. Rotan los tres papeles cada posesión.',
      niveles: {
        base: 'el defensor está fijo en el tiro libre y solo defiende al del balón.',
        intermedio: 'el defensor elige y hay tres pases de máximo.',
        avanzado: 'el defensor puede fintar la elección y los atacantes tienen dos pases.',
      },
      criterio_exito: 'tres de cada cuatro posesiones acaban en canasta dentro de la zona, y la decisión se toma en el tiro libre o más cerca',
    },
    tablero: () => [
      jug('A', 1, 0.6046, 0.4334), jug('A', 2, 0.6046, 0.6076),
      jug('B', 1, M.tiro_libre[0], M.tiro_libre[1]),
      balon(0.6046, 0.4334),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // se ataca al defensor: el pase no vale hasta que se le compromete
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3313, y: 0.4682 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.3703, y: 0.6424 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.2922, y: 0.4856 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2337, y: 0.5727 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: '3c2 desde el fondo',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 15,
    description: 'Tres atacantes contra dos defensores colocados en triángulo: hay que mover el balón hasta que uno de los dos se equivoque.',
    objetivos: 'Resolver la superioridad de tres contra dos, que es la que más aparece en un partido de mini y la que peor se aprovecha.',
    descripcion_texto: 'Tres atacantes entran desde el fondo contrario y se encuentran dos defensores colocados en triángulo, uno arriba y otro abajo. La regla es que no vale botar más de dos veces: se resuelve pasando. Cuando la defensa recupera o el ataque anota, se acaba la posesión y entra el siguiente trío. Se juega a diez canastas.',
    notas: 'Puntos clave: el balón va por delante del defensor de arriba y el que ataca el aro obliga al de abajo a decidir; el tercero ocupa el lado contrario y no se acerca al balón. Error frecuentísimo: los tres convergen hacia el aro y la superioridad se convierte en un montón. La corrección que más rinde es de espaciado, no de pase: si están anchos, el pase bueno aparece solo. Y ojo con la carga: tres contra dos a toda velocidad es de lo más exigente que hay, así que descansos largos.',
    tags: ['juego reducido', 'superioridad', 'espaciado', 'pase', 'toma de decisiones', 'ventaja'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'pasar en movimiento y ocupar un carril sin acercarse al balón',
      dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: un trío ataca, dos defienden y uno espera para entrar de defensor en la siguiente. Rotan cada posesión.',
      niveles: {
        base: 'los defensores están fijos, uno arriba y otro abajo, y no pueden cambiar de altura.',
        intermedio: 'los defensores se reparten libremente y el ataque tiene dos botes de máximo.',
        avanzado: 'tras la canasta o el rebote, dos de los atacantes vuelven en 2c1 hacia la otra canasta.',
      },
      criterio_exito: 'siete de cada diez posesiones terminan en canasta cerca del aro sin más de dos botes',
    },
    tablero: () => [
      jug('A', 1, 0.6046, 0.5031), jug('A', 2, 0.585, 0.2592), jug('A', 3, 0.585, 0.7469),
      jug('B', 1, M.tiro_libre[0], M.tiro_libre[1]),
      jug('B', 2, M.poste_bajo_der[0] + 0.02, 0.5031),
      balon(0.6046, 0.5031),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el balón por delante del de arriba, y los otros dos abiertos
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.3703, y: 0.5031 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.3313, y: 0.2592 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.3313, y: 0.7469 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.3215, y: 0.5031 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'pase', a: 'A3' },
          { jugador: 'B2', tipo: 'defiende', marca: 'A3', hacia: { x: 0.2239, y: 0.6598 } },
        ] },
        { eventos: [
          { jugador: 'A3', tipo: 'pase', a: 'A2' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2922, y: 0.3289 } },
        ] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.2141, y: 0.3811 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ INFERIORIDADES ═══════════════════════════════════════
     El formato que más rápido enseña a defender en equipo, y el que
     menos se monta porque perder incomoda. Se monta igual: si un
     equipo no ha defendido nunca en inferioridad, la primera vez que
     le pase en un partido no sabrá ni mirarse. */
  {
    name: 'Inferioridad 2c3',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Dos defensores contra tres atacantes: en las inferioridades no se puede defender a todos, así que hay que decidir a quién se le regala el tiro.',
    objetivos: 'Aprender a defender las inferioridades repartiéndose el trabajo y hablando, en vez de que los dos vayan al balón.',
    descripcion_texto: 'Tres atacantes en media pista contra dos defensores. La defensa no puede robar; solo colocarse. Los atacantes tienen ocho segundos para tirar. Se cuenta como parada si el tiro sale de fuera de la zona o si se acaba el tiempo. Los defensores se cambian cada dos posesiones porque esto cansa muchísimo.',
    notas: 'Puntos clave: en inferioridad se protege lo de cerca y se concede lo de lejos, que a esta edad es una canasta mucho menos probable; y los dos defensores tienen que HABLAR o acaban los dos en el mismo sitio. Error frecuentísimo: perseguir el balón los dos, que es exactamente lo que el ataque quiere. La regla de ocho segundos es la que hace jugable el ejercicio: sin ella el ataque acaba anotando siempre y la defensa se hunde. Y díselo antes: aquí se pierde mucho, y eso es el ejercicio, no un fracaso.',
    tags: ['juego reducido', 'inferioridad', 'defensa individual', 'ayuda', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'defender individualmente y ver a la vez a su par y al balón',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta: tres atacan, dos defienden y uno cuenta los ocho segundos en voz alta. Rotan cada dos posesiones.',
      niveles: {
        base: '2c3 con el ataque obligado a dar tres pases antes de tirar.',
        intermedio: '2c3 con ocho segundos y sin robar.',
        avanzado: '2c3 con seis segundos y la defensa además tiene que coger el rebote para que cuente la parada.',
      },
      criterio_exito: 'la defensa consigue dos paradas de cada cuatro posesiones y no acaba nunca con los dos en el mismo sitio',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 3, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.tiro_libre[0] - 0.02, M.tiro_libre[1]),
      jug('B', 2, M.poste_bajo_der[0] + 0.04, 0.5031),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },
  {
    name: 'Inferioridad 3c4 con tiempo',
    type: '4vs4', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 5, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Tres defienden a cuatro durante veinte segundos: se aguanta o no se aguanta, y hay que hablarlo todo.',
    objetivos: 'Sostener una inferioridad durante una posesión larga, que es donde la comunicación deja de ser un consejo y pasa a ser lo único que funciona.',
    descripcion_texto: 'Cuatro atacantes en media pista contra tres defensores. El ataque tiene veinte segundos para anotar y no puede botar más de dos veces por posesión. La defensa no puede robar. Si aguanta los veinte segundos sin encajar, punto para la defensa. Se juega a tres puntos de la defensa y se cambian los grupos.',
    notas: 'Puntos clave: con uno menos siempre hay un atacante libre, así que el trabajo consiste en que el libre sea SIEMPRE el que está más lejos del aro; los tres defensores se mueven a la vez con el balón, como si estuvieran unidos por una cuerda. Error frecuente: cada defensor se queda con su par y aparece un hueco enorme bajo el aro. Como entrenador, vigila que no derive en zona (D10): aquí no se defiende un espacio fijo, se defiende al balón y se ayuda. Si ves a tres quietos en la zona, para y recolócalos.',
    tags: ['juego reducido', 'inferioridad', 'ayuda', 'recuperación', 'espaciado'],
    requisitos: {
      jugadores_min: 7, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'ayudar a un compañero y recuperar con su par sin quedarse mirando el balón',
      dosis: { series: 3, cantidad: 3, unidad: 'repeticiones', descanso: 120 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, jugando 4c3 y rotando el trío defensor en cada posesión. Nadie fuera.',
      niveles: {
        base: '3c4 durante diez segundos y el ataque tiene que dar cuatro pases antes de tirar.',
        intermedio: '3c4 durante veinte segundos, dos botes por posesión.',
        avanzado: '3c4 durante treinta segundos y la defensa tiene que coger además el rebote.',
      },
      criterio_exito: 'la defensa aguanta una de cada tres posesiones enteras y el atacante libre está siempre lejos del aro',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 3, M.escolta_izq[0], M.escolta_izq[1]),
      jug('A', 4, 0.1751, 0.7643),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      jug('B', 2, M.escolta_der[0] - 0.06, M.escolta_der[1]),
      jug('B', 3, M.escolta_izq[0] - 0.06, M.escolta_izq[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },

  /* ═══ 1c1 CON REGLAS ═══════════════════════════════════════ */
  {
    name: '1c1 con reglas cambiantes',
    type: '1vs1', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Uno contra uno donde el entrenador cambia las reglas en cada posesión: un bote, sin bote, solo mano izquierda, sin tirar de fuera.',
    objetivos: 'Obligar a tener varios recursos en lugar de uno bueno, cambiando la restricción antes de que el jugador se acomode.',
    descripcion_texto: 'Uno contra uno desde el 45. Antes de cada posesión el entrenador canta la regla: «un bote», «sin bote», «solo izquierda», «solo dentro de la zona», «hay que fintar antes de salir». La regla vale solo para esa posesión. Se juega a cuatro posesiones por pareja y se cambia de rival.',
    notas: 'Puntos clave: cada regla desactiva el recurso favorito y obliga a buscar otro, que es todo el valor del ejercicio; el defensor también gana, porque sabe la regla y puede prepararse. Error del entrenador: cantar reglas al azar sin mirar al jugador. Lo bueno es elegir la regla que le quita justo lo que hace siempre — si uno solo se va por la derecha, «solo izquierda»; si otro bota sin ir a ningún sitio, «un bote». Aquí el entrenador entrena tanto como el que juega.',
    tags: ['juego reducido', '1c1', 'toma de decisiones', 'competición', 'ventaja'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'resolver el uno contra uno con bote hacia los dos lados',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por canasta. El entrenador canta la regla para las tres a la vez y se cambia de rival cada cuatro posesiones.',
      niveles: {
        base: 'una sola regla para toda la serie, anunciada al principio.',
        intermedio: 'la regla cambia en cada posesión.',
        avanzado: 'la regla se canta cuando el atacante ya ha recibido el balón.',
      },
      criterio_exito: 'anotar al menos una vez con cada una de las cuatro reglas de la serie',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.escolta_der[0], M.escolta_der[1]), balon(M.escolta_izq[0], M.escolta_izq[1]),
    ],
    intent: null,
  },
  {
    name: '2c2 con pase obligado',
    type: '2vs2', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Dos contra dos donde la canasta solo cuenta si llega después de un pase: obliga a jugar con el compañero, no al lado del compañero.',
    objetivos: 'Convertir el 2c2 en juego de dos de verdad, que es el paso natural cuando el uno contra uno ya se resuelve (D23).',
    descripcion_texto: 'Dos contra dos en media pista. La canasta solo vale si el último toque antes del tiro ha sido un pase; una canasta de uno contra uno puro no cuenta. Sí se puede botar. Se juega a cinco canastas y cambian los defensores. El que pasa tiene que moverse después de pasar: quedarse quieto anula el pase.',
    notas: 'Puntos clave: la regla del pase obliga a que aparezcan el pasar y cortar y el aclarado, que son los dos recursos del núcleo mini (D23); y la regla de moverse después de pasar impide el pase-y-mirar, que es el vicio más extendido. Error frecuente: pasar por pasar, sin que el pase cree nada. Como entrenador, pregunta después de cada canasta qué había hecho el pasador ANTES del pase. Si la respuesta es "nada", el pase era un trámite y la canasta era de uno contra uno con un rodeo.',
    tags: ['juego reducido', 'pasar y cortar', 'espaciado', 'pase', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'resolver el uno contra uno y pasar en movimiento con un defensor cerca',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, tres parejas por canasta: dos juegan y una espera para entrar en cuanto hay canasta.',
      niveles: {
        base: 'la canasta cuenta siempre, pero el pase da un punto extra.',
        intermedio: 'la canasta solo cuenta tras pase y hay que moverse después de pasar.',
        avanzado: 'además está prohibido devolver el balón a quien te lo dio.',
      },
      criterio_exito: 'al menos tres de las cinco canastas llegan tras un pase que ha creado ventaja, no tras un pase de trámite',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.escolta_izq[0], M.escolta_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]), jug('B', 2, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: null,
  },

  /* ═══ RESTRICCIONES Y COMPETICIÓN ══════════════════════════ */
  {
    name: '3c3 a doce segundos',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 15,
    description: 'Tres contra tres con doce segundos de posesión: no da tiempo a pensárselo dos veces, así que se decide con el cuerpo ya en marcha.',
    objetivos: 'Acelerar la toma de decisiones sin quitar el juego, que es lo que hace el reloj en un partido de verdad.',
    descripcion_texto: 'Tres contra tres en media pista. Cada posesión dura doce segundos, contados en voz alta por el trío que descansa. Si se acaban, la posesión es del rival. Se juega a cinco canastas. Tras canasta o rebote defensivo, el balón sale al medio campo y arranca la cuenta otra vez.',
    notas: 'Puntos clave: con doce segundos desaparece el bote de esperar y aparecen el corte y el pase rápido; y el que recibe tiene que estar ya orientado o pierde dos segundos colocándose. Error frecuente al principio: precipitarse y tirar el primer balón que llega. Dilo antes: doce segundos son muchos si nadie se para. Cuenta cuántas posesiones acaban por tiempo: si son más de dos de cada cinco, sube a quince segundos y vuelve a bajar cuando el equipo se suelte.',
    tags: ['juego reducido', 'toma de decisiones', 'espaciado', 'competición', 'transición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'pasar y recibir en movimiento con defensa y ocupar espacios sin acercarse al balón',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, jugando 3c3 y con el trío que descansa contando los segundos en voz alta. Rotan cada cinco canastas.',
      niveles: {
        base: 'veinte segundos por posesión.',
        intermedio: 'doce segundos.',
        avanzado: 'ocho segundos, y la canasta en los tres primeros segundos vale doble.',
      },
      criterio_exito: 'como mucho una de cada cinco posesiones se pierde por tiempo',
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
    intent: null,
  },
  {
    name: '4c4 con tres zonas',
    type: '4vs4', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 10, duration_max: 15,
    description: 'La media pista se divide en tres franjas y no puede haber más de dos atacantes en la misma: el espaciado deja de ser un consejo.',
    objetivos: 'Hacer que el espaciado sea obligatorio, porque explicarlo no funciona y con doce niños el montón aparece siempre.',
    descripcion_texto: 'Cuatro contra cuatro en media pista dividida en tres franjas verticales con conos. Regla única: nunca puede haber tres atacantes en la misma franja. Si pasa, la posesión cambia de dueño. Se juega a cinco canastas. Los defensores no tienen limitación de franja.',
    notas: 'Puntos clave: la regla hace visible lo que un entrenador repite todo el año — que juntarse no ayuda al que lleva el balón—; y como la penalización es inmediata, se corrige sin discurso. Error frecuente: quedarse clavados en la franja por miedo a la falta, con lo que nadie corta. Recuérdales que se puede cruzar, lo que no se puede es amontonarse. Como entrenador, cuenta las pérdidas por franja: si bajan de cinco a una en dos series, el concepto ha entrado.',
    tags: ['juego reducido', 'espaciado', 'toma de decisiones', 'pase', 'lectura'],
    requisitos: {
      jugadores_min: 8, jugadores_max: 12, canastas: 1, estaciones: 1,
      material: ['balones', 'petos', 'conos'], densidad: 'media', oposicion: 'real', presion: 'espacio',
      requisito_previo: 'pasar y recibir con defensa y moverse sin balón hacia un espacio libre',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos equipos de cuatro jugando el 4c4 y un grupo de cuatro que hace de jueces de franja desde fuera, uno por línea; los jueces entran en la serie siguiente.',
      niveles: {
        base: 'dos franjas y máximo tres atacantes por franja.',
        intermedio: 'tres franjas y máximo dos por franja.',
        avanzado: 'tres franjas, máximo dos, y además hay que tocar las tres franjas antes de tirar.',
      },
      criterio_exito: 'menos de dos pérdidas por amontonamiento en cinco canastas',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('A', 3, M.escolta_izq[0], M.escolta_izq[1]),
      jug('A', 4, 0.1751, 0.7469),
      jug('B', 1, M.base[0] - 0.05, M.base[1]),
      jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      jug('B', 3, M.escolta_izq[0] - 0.05, M.escolta_izq[1]),
      jug('B', 4, 0.2044, 0.7121),
      cono(0.097, 0.3724), cono(0.4288, 0.3724), cono(0.7217, 0.3724),
      cono(0.097, 0.6424), cono(0.4288, 0.6424), cono(0.7217, 0.6424),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },
  {
    name: 'Liguilla de 3c3',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 15, duration_max: 25,
    description: 'Cuatro equipos de tres, partidos de tres minutos, todos contra todos y clasificación en la pizarra.',
    objetivos: 'Cerrar la sesión compitiendo de verdad en el formato que mejor equilibrio tiene (D6), con todo el mundo jugando siempre.',
    descripcion_texto: 'Cuatro equipos de tres. Partidos de tres minutos, dos a la vez, uno en cada canasta. Cada equipo juega contra los otros tres. Se apuntan los resultados en la pizarra y gana la liguilla el que más partidos gane; el empate se resuelve por canastas encajadas, para que defender también cuente. Entre partido y partido, un minuto.',
    notas: 'Puntos clave: partidos cortos y muchos rivales es lo que mantiene la intensidad y evita que un equipo se hunda; el desempate por canastas encajadas es lo que hace que se defienda de verdad en el último minuto. Error del entrenador: hacer los equipos por nivel. Mézclalos, o los partidos se deciden antes de empezar. Y no arbitres todo: deja que resuelvan las dudas entre ellos salvo en lo que sea peligroso. Se aprende más de eso que de tres correcciones.',
    tags: ['juego reducido', 'competición', 'toma de decisiones', 'defensa individual', 'espaciado'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 2, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'jugar 3c3 respetando el espaciado y defender individualmente sin falta',
      dosis: { series: 3, cantidad: 180, unidad: 'segundos', descanso: 60 },
      organizacion: 'Con 12: cuatro equipos de tres, dos partidos a la vez —uno en cada canasta— y rotación de emparejamientos cada tres minutos. Nadie mira nunca.',
      niveles: {
        base: 'partidos de dos minutos y sin desempate por canastas encajadas.',
        intermedio: 'tres minutos y desempate por canastas encajadas.',
        avanzado: 'tres minutos, desempate defensivo, y una regla distinta por ronda (sin bote, dos pases mínimos, solo canastas de dentro).',
      },
      criterio_exito: 'todos los equipos ganan al menos un partido y ninguno encaja el doble que el que menos',
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
    intent: null,
  },
  {
    name: '2c2 al primer error',
    type: '2vs2', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'La pareja que gana se queda; la que pierde sale y entra otra. Se juega a una sola canasta, así que cada posesión es una final.',
    objetivos: 'Jugar con la tensión de la posesión única, que es cuando aparecen las decisiones de verdad y también los errores de verdad.',
    descripcion_texto: 'Parejas en fila junto a la canasta. Juegan dos: una posesión cada una y quien anote se queda; si ninguna anota, salen las dos y entran las siguientes. La pareja que se queda no descansa, así que las rachas largas se pagan. Se lleva la cuenta de la racha más larga del día.',
    notas: 'Puntos clave: en posesión única no hay tiempo de calentar, así que la primera acción tiene que ser buena — conviene enseñarles a acordar algo antes de entrar, aunque sea una frase; y la pareja que lleva racha está cansada, que es la ventaja de la que entra. Error del entrenador: dejar que una pareja encadene ocho. Si llegan a cuatro, mételas a la fila. Y filas de tres parejas como mucho, o hay más espera que juego (D5).',
    tags: ['juego reducido', 'competición', '1c1', 'pasar y cortar', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'jugar 2c2 con pase y corte y defender individualmente',
      dosis: { series: 3, cantidad: 240, unidad: 'segundos', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tres parejas por canasta: dos juegan y una espera. Nadie espera más de una posesión.',
      niveles: {
        base: 'dos posesiones por pareja antes de decidir quién se queda.',
        intermedio: 'una posesión cada una y quien anota se queda.',
        avanzado: 'una posesión cada una y la canasta solo cuenta tras pase.',
      },
      criterio_exito: 'ninguna pareja encadena más de cuatro y todas ganan al menos un duelo',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.base[0] + 0.04, M.base[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]), jug('B', 2, M.base[0] - 0.02, M.base[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: null,
  },
];
