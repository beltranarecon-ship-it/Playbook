/* ============================================================
   tanda-16.mjs — contraataque y transición (Bloque D).

   La única familia que justifica la pista entera de forma
   sistemática, y por eso ocho de estas ocho fichas la usan: un
   contraataque entrenado en media pista no es un contraataque, es un
   ejercicio de pase con prisa.

   Lo que más se pierde en mini no es el contraataque: es el segundo
   siguiente. Se roba un balón, se corre, y al llegar nadie sabe si
   había ventaja o no. Por eso la mitad de esta tanda entrena la
   TRANSICIÓN —el instante en que cambia la posesión— y no la carrera.

   Doctrina que más aprieta aquí:
     D2  · densidad: en pista entera es facilísimo montar un ejercicio
           bonito donde nueve miran y tres corren
     D6  · el formato se elige por objetivo: aquí manda el 2c1 y el 3c2
     D11 · el balance defensivo es la recuperación del equipo entero
   ============================================================ */

import { jug, balon, cono, fila, M, E } from './montaje.mjs';

export const TANDA_16 = [

  /* ═══ CARRILES Y PASE ══════════════════════════════════════ */
  {
    name: 'Los tres carriles sin parar',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Tres jugadores cruzan la pista por sus carriles y el balón viaja siempre por el central, sin que nadie frene.',
    objetivos: 'Instalar la forma del contraataque —tres carriles anchos y el balón por el medio—, que es lo que hace que llegue gente y no un jugador solo.',
    descripcion_texto: 'Tres jugadores salen desde el fondo, uno por carril. El del centro lleva el balón y los de fuera corren por sus bandas sin cruzarse hacia dentro. Se puede pasar cuando se quiera, pero el balón tiene que acabar volviendo al centro antes de la última línea. Se termina en canasta. Al llegar vuelven trotando por fuera y sale el siguiente trío.',
    notas: 'Puntos clave: los carriles se abren de verdad —a un metro de la banda—, porque un contraataque estrecho lo defiende un solo defensor; y el balón por el centro es lo que permite decidir a los dos lados. Error frecuentísimo: los tres convergiendo hacia el balón, que es lo que hace el instinto. Como entrenador, ponte en el medio campo y mira el ANCHO: si desde ahí los tres te caben en un abrazo, no están corriendo un contraataque. Empieza sin defensa: la forma primero, la decisión después.',
    tags: ['contraataque', 'carriles', 'transición', 'pase', 'espaciado'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 2, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'ninguna',
      requisito_previo: 'pasar y recibir en movimiento sin frenar',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: cuatro tríos que salen escalonados cada seis segundos desde el fondo y vuelven trotando por fuera; nadie espera más de un turno.',
      niveles: {
        base: 'sin pases: cada uno corre su carril y el del centro entra a canasta.',
        intermedio: 'pases libres, balón al centro antes de la última línea.',
        avanzado: 'mínimo tres pases y ningún jugador puede recibir dos veces seguidas.',
      },
      criterio_exito: 'los tres carriles siguen abiertos al llegar al medio campo en tres de cada cuatro viajes',
    },
    tablero: () => [
      jug('A', 1, 0.50, 0.84), jug('A', 2, 0.14, 0.84), jug('A', 3, 0.86, 0.84),
      balon(0.50, 0.84),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.50, y: 0.58 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.14, y: 0.54 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.86, y: 0.54 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A3' }] },
        { eventos: [
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.78, y: 0.28 } },
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.50, y: 0.30 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.20, y: 0.28 } },
        ] },
        { eventos: [{ jugador: 'A3', tipo: 'pase', a: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Pase largo al que se escapa',
    type: 'Pase', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Un compañero sale corriendo en cuanto cae el rebote y hay que servirle por delante, a la carrera y sin que frene.',
    objetivos: 'Entrenar el pase de contraataque, que es el que más canastas fáciles da y el que menos se practica porque necesita pista entera.',
    descripcion_texto: 'Un jugador con balón en el fondo y un compañero que arranca hacia la canasta contraria en cuanto se le da la señal. El del balón tiene que servirle un pase largo POR DELANTE, para que lo reciba en carrera y termine sin frenar. Un defensor sale detrás del corredor con dos pasos de desventaja. Cuatro repeticiones y se cambian los papeles.',
    notas: 'Puntos clave: el pase se lanza a donde el compañero VA A ESTAR, dos o tres metros por delante, y con las dos manos por encima de la cabeza si hay alguien cerca; el que corre mira por encima del hombro sin girar el cuerpo. Errores frecuentes: pasar a donde está, con lo que tiene que frenar y ahí acaba el contraataque; y pasar con una mano desde el pecho, que a esa distancia se queda corto. Este pase da miedo a los pequeños porque falla mucho al principio: insiste, porque la alternativa —subir botando— es siempre más lenta.',
    tags: ['pase', 'pase de béisbol', 'contraataque', 'transición', 'recepción'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 2, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'ninguna',
      requisito_previo: 'pasar de béisbol a diez metros con precisión y recibir en carrera',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno hacia cada canasta, en tríos: pasador, corredor y perseguidor. Rotan los tres papeles cada cuatro pases.',
      niveles: {
        base: 'sin perseguidor y con el corredor arrancando a media pista.',
        intermedio: 'corredor desde el fondo y perseguidor con dos pasos de desventaja.',
        avanzado: 'el perseguidor sale a la vez y el pasador tiene que decidir si el pase existe o no.',
      },
      criterio_exito: 'tres de cada cuatro pases se reciben en carrera y sin frenar',
    },
    tablero: () => [
      jug('A', 1, 0.30, 0.88), jug('A', 2, 0.62, 0.80),
      jug('B', 1, 0.62, 0.87),
      balon(0.30, 0.88),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.60, y: 0.44 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.62, y: 0.54 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.58, y: 0.26 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ SUPERIORIDADES A TODA PISTA ══════════════════════════ */
  {
    name: '2c1 tras robo',
    type: '2vs2', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'El robo arranca el contraataque: dos corren hacia el otro aro y solo hay un defensor esperando.',
    objetivos: 'Encadenar el instante del robo con la ventaja que crea, que es lo que casi nunca se entrena junto.',
    descripcion_texto: 'Dos atacantes en el medio campo y un tercero que les pasa el balón; el que iba a recibir lo roba y sale con su compañero hacia la canasta contraria en dos contra uno. En el otro fondo espera un defensor. Tres pases de máximo y la canasta solo cuenta desde dentro de la zona. Rotan los papeles en cada posesión.',
    notas: 'Puntos clave: en cuanto se roba, se corre SIN botar los dos primeros metros —botar frena— y el compañero se abre a su carril; al llegar, el del balón ataca al defensor antes de decidir. Error frecuentísimo: celebrar el robo medio segundo, que es justo lo que el rival necesita para volver. Como entrenador, cronometra el primer pase después del robo: si tarda más de dos segundos, la ventaja ya no existe y el ejercicio te lo está enseñando.',
    tags: ['contraataque', 'transición', 'superioridad', 'ventaja', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 2, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'resolver el dos contra uno en media pista atacando al defensor antes de pasar',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis, uno por cada mitad y atacando a canastas contrarias, en cuartetos que rotan: dos atacan, uno defiende y uno da el pase que se roba.',
      niveles: {
        base: 'el balón se entrega directamente y no hay robo: solo el 2c1.',
        intermedio: 'con robo y defensor esperando en el otro fondo.',
        avanzado: 'con robo y el que perdió el balón puede perseguir, así que llega un segundo defensor por detrás.',
      },
      criterio_exito: 'el primer pase tras el robo sale en menos de dos segundos en tres de cada cuatro',
    },
    tablero: () => [
      jug('A', 1, 0.36, 0.56), jug('A', 2, 0.66, 0.56),
      jug('B', 1, 0.50, 0.24),
      balon(0.36, 0.56),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.42, y: 0.34 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.70, y: 0.32 } },
          { jugador: 'B1', tipo: 'defiende', marca: 'A1', hacia: { x: 0.46, y: 0.28 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: 'aro' },
          { jugador: 'B1', tipo: 'defiende', marca: 'A2', hacia: { x: 0.58, y: 0.20 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: '3c2 continuo a pista entera',
    type: '3vs3', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 10, duration_max: 15,
    description: 'Tres atacan a dos; en cuanto acaba, dos de ellos vuelven en contraataque contra uno y no para nunca.',
    objetivos: 'Encadenar superioridad, cambio de posesión y superioridad de vuelta, que es como se juega de verdad y donde se ve quién reacciona.',
    descripcion_texto: 'Tres atacantes salen contra dos defensores. Al acabar la posesión —canasta, rebote o pérdida—, los dos defensores cogen el balón y salen en contraataque hacia la otra canasta; les persigue solo uno de los tres que atacaban, el que decida el entrenador. Y así seguido. Entran tríos nuevos cada dos minutos.',
    notas: 'Puntos clave: el trío que ataca tiene que dejar a alguien preparado para el balance ANTES de tirar, o el 2c1 de vuelta es gratis; y los dos que roban salen sin mirar atrás. Error frecuentísimo: los tres van al rebote ofensivo y el contraataque de vuelta llega solo. Es el ejercicio que más rápido enseña que el balance empieza en el momento del tiro y no cuando el balón cae (D11). Ojo con la carga: dos minutos de esto son durísimos, así que rotaciones cortas y descansos de verdad.',
    tags: ['contraataque', 'transición', 'superioridad', 'balance defensivo', 'competición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real', presion: 'marcador',
      requisito_previo: 'resolver el tres contra dos manteniendo los carriles abiertos',
      dosis: { series: 3, cantidad: 120, unidad: 'segundos', descanso: 120 },
      organizacion: 'Con 12: cuatro tríos. Dos tríos en pista y dos esperando en los fondos, que entran cuando el balón llega a su lado; nadie mira más de dos minutos.',
      niveles: {
        base: '3c2 suelto, sin la vuelta en 2c1.',
        intermedio: '3c2 con vuelta en 2c1 continua.',
        avanzado: '3c2, vuelta en 2c1, y el que persigue sale desde la línea de fondo, así que llega tarde a propósito.',
      },
      criterio_exito: 'el trío atacante deja a alguien en balance antes del tiro en la mitad de las posesiones',
    },
    tablero: () => [
      jug('A', 1, 0.50, 0.62), jug('A', 2, 0.16, 0.60), jug('A', 3, 0.84, 0.60),
      jug('B', 1, 0.50, 0.30), jug('B', 2, 0.50, 0.16),
      balon(0.50, 0.62),
    ],
    intent: null,
  },

  /* ═══ TRANSICIÓN Y BALANCE ═════════════════════════════════ */
  {
    name: 'Balance en cuanto sale el tiro',
    type: 'Defensa', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Se tira y uno de los tres tiene que estar ya corriendo hacia atrás antes de saber si entra: el balance empieza en el tiro.',
    objetivos: 'Adelantar el balance defensivo al momento del tiro, que es medio segundo antes de donde lo hace todo el mundo.',
    descripcion_texto: 'Tres atacantes en media pista con un balón. El entrenador canta un nombre; ese jugador es el que tiene que salir en balance en cuanto el balón salga de las manos del tirador, sin esperar a ver si entra. Los otros dos van al rebote. Del otro fondo salen dos rivales en contraataque, y el que hizo balance tiene que frenarles. Cuatro repeticiones y se cambian los papeles.',
    notas: 'Puntos clave: el que hace balance sale ANTES de que el balón toque el aro y corre de frente hasta el medio campo, donde ya se pone de espaldas frenando; los otros dos van al rebote sabiendo que hay alguien detrás. Error frecuentísimo: los tres se quedan mirando el tiro. Es lo más humano que hay y es lo que regala los contraataques. Como entrenador, canta el nombre ANTES del tiro las primeras veces y después ya no: el objetivo es que se repartan solos.',
    tags: ['balance defensivo', 'transición', 'contraataque', 'defensa individual', 'oposición'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 2, estaciones: 1,
      material: ['balones'], densidad: 'media', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'frenar a un atacante que sube el balón sin dejarse superar',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis. El primer grupo monta el ataque y el rebote con un trío, y otro trío espera en el fondo contrario para salir al contraataque; el segundo grupo entra en la repetición siguiente. Rotan cada cuatro tiros.',
      niveles: {
        base: 'el entrenador dice quién hace balance antes de cada tiro.',
        intermedio: 'lo dice justo cuando sale el tiro.',
        avanzado: 'no lo dice nadie: el trío tiene que repartírselo solo, y si salen dos o ninguno, punto para el rival.',
      },
      criterio_exito: 'hay alguien cruzando el medio campo antes de que el balón toque el aro en las cuatro repeticiones',
    },
    tablero: () => [
      jug('A', 1, 0.50, 0.30), jug('A', 2, 0.34, 0.22), jug('A', 3, 0.66, 0.22),
      jug('B', 1, 0.34, 0.86), jug('B', 2, 0.66, 0.86),
      balon(0.50, 0.30),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
        // el balance sale ANTES de saber si entra; los otros dos, al rebote
        { eventos: [
          { jugador: 'A1', tipo: 'defiende', hacia: { x: 0.50, y: 0.56 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.42, y: 0.14 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.58, y: 0.14 } },
        ] },
        { eventos: [
          { jugador: 'B1', tipo: 'corte', hacia: { x: 0.34, y: 0.62 } },
          { jugador: 'B2', tipo: 'corte', hacia: { x: 0.66, y: 0.62 } },
          { jugador: 'A1', tipo: 'defiende', hacia: { x: 0.50, y: 0.70 } },
        ] },
      ],
    },
  },
  {
    name: 'Sacar de fondo antes de tres segundos',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'Tras canasta encajada, el balón tiene que estar cruzando el medio campo antes de tres segundos: el contraataque más fácil es el que nadie corre.',
    objetivos: 'Aprovechar la transición tras canasta, que es la única en la que sabes con antelación que va a haber cambio de posesión.',
    descripcion_texto: 'Un equipo de tres encaja una canasta a propósito —el entrenador la mete— y tiene tres segundos para sacar de fondo y que el balón cruce el medio campo. El que coge el balón sale por el lado, uno se abre a recibir y el tercero corre el carril contrario. Enfrente hay dos defensores que empiezan replegando. Cuatro repeticiones y se cambian.',
    notas: 'Puntos clave: el que saca coge el balón SIN que toque el suelo y sale del fondo por el lado; el receptor se abre pidiendo antes de que el balón pase por la red. Error frecuentísimo: sacar de fondo esperando a que todo el mundo esté colocado, que es cuando el contraataque ya no existe. Aquí el reloj es el entrenador: tres segundos contados en voz alta. Es la transición más barata que hay y en mini casi nadie la corre.',
    tags: ['contraataque', 'transición', 'pase', 'carriles', 'competición'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 2, estaciones: 1,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva', presion: 'tiempo',
      requisito_previo: 'sacar de fondo con precisión y correr un carril sin acercarse al balón',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: dos grupos de seis que trabajan hacia canastas contrarias, cada uno con un trío que saca y dos que repliegan; se rota en cada repetición.',
      niveles: {
        base: 'sin defensores replegando, solo sacar y cruzar en tres segundos.',
        intermedio: 'con dos defensores que repliegan desde el medio campo.',
        avanzado: 'con dos defensores y uno de ellos puede presionar al que saca.',
      },
      criterio_exito: 'el balón cruza el medio campo antes de los tres segundos en tres de cada cuatro',
    },
    tablero: () => [
      jug('A', 1, 0.30, 0.90), jug('A', 2, 0.16, 0.72), jug('A', 3, 0.80, 0.74),
      jug('B', 1, 0.42, 0.60), jug('B', 2, 0.62, 0.58),
      balon(0.30, 0.90),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.14, y: 0.62 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.84, y: 0.60 } },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.44, y: 0.46 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.60, y: 0.44 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'bote', hacia: { x: 0.22, y: 0.38 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.80, y: 0.34 } },
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.46, y: 0.52 } },
        ] },
      ],
    },
  },
  {
    name: 'Cruzar en cinco segundos',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 5, duration_max: 8,
    description: 'Del fondo al aro contrario en cinco segundos, con dos pases obligatorios: correr rápido no es lo mismo que llegar pronto.',
    objetivos: 'Enseñar que el balón viaja más rápido pasando que botando, con un reloj que lo demuestra en vez de explicarlo.',
    descripcion_texto: 'Por tríos, del fondo al aro contrario en cinco segundos con al menos dos pases y terminando en canasta. Se cronometra. Después se repite la misma distancia botando sin pasar, y se comparan los tiempos: siempre gana el pase. Cuatro intentos por trío.',
    notas: 'Puntos clave: el reloj hace el argumento solo, así que no lo expliques antes — que lo descubran ellos comparando los dos tiempos; los pases van hacia delante, nunca de lado ni hacia atrás. Error frecuente: pasar dos veces al mismo compañero, que no adelanta el balón. Como entrenador, apunta los dos tiempos en la pizarra: ver la diferencia escrita vale más que diez correcciones. Empieza sin defensa y sin reloj hasta que los tres carriles salgan bien.',
    tags: ['contraataque', 'transición', 'pase', 'carriles', 'competición'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 2, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'nula', presion: 'tiempo',
      requisito_previo: 'pasar en movimiento hacia delante y terminar en canasta sin frenar',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 75 },
      organizacion: 'Con 12: cuatro tríos que salen escalonados cada ocho segundos; el trío que acaba cronometra al siguiente y apunta el tiempo en la pizarra.',
      niveles: {
        base: 'siete segundos y un solo pase.',
        intermedio: 'cinco segundos y dos pases.',
        avanzado: 'cuatro segundos, dos pases y sin que nadie reciba dos veces.',
      },
      criterio_exito: 'el tiempo con pases es más de un segundo mejor que el mismo recorrido botando',
    },
    tablero: () => [
      jug('A', 1, 0.50, 0.88), jug('A', 2, 0.18, 0.88), jug('A', 3, 0.82, 0.88),
      balon(0.50, 0.88),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.18, y: 0.56 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.82, y: 0.56 } },
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.50, y: 0.66 } },
        ] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.24, y: 0.30 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.76, y: 0.28 } },
          { jugador: 'A1', tipo: 'corte', hacia: { x: 0.50, y: 0.34 } },
        ] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'aro' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Rebote, cabeza arriba y decisión',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 8, duration_max: 12,
    description: 'Se coge el rebote y hay que decidir en un segundo: correr si hay hueco, o parar y organizar si no lo hay.',
    objetivos: 'Entrenar la decisión de la transición tras rebote, que es la que separa un contraataque de una pérdida en el medio campo.',
    descripcion_texto: 'El entrenador tira; tres jugadores pelean el rebote defensivo con dos rivales. Quien lo coge tiene un segundo para decidir: si el entrenador levanta el brazo, hay hueco y se corre; si lo cruza, no lo hay y hay que parar el balón y esperar a los compañeros. Los rivales pueden perseguir. Cuatro repeticiones y se cambian los papeles.',
    notas: 'Puntos clave: la señal obliga a levantar la cabeza inmediatamente después de coger el balón, que es todo el ejercicio; se protege primero, se mira después y se decide en el mismo movimiento. Errores frecuentes: salir corriendo siempre, que es lo que hacen todos y por eso el contraataque muere en el medio campo; y no salir nunca, que es lo que hacen después de que les riñan por lo primero. Como entrenador, alterna las señales sin patrón: en cuanto lo adivinen, dejan de mirar.',
    tags: ['contraataque', 'transición', 'rebote defensivo', 'toma de decisiones', 'lectura'],
    requisitos: {
      jugadores_min: 5, jugadores_max: 12, canastas: 2, estaciones: 1,
      material: ['balones', 'petos'], densidad: 'media', oposicion: 'real', presion: 'tiempo',
      requisito_previo: 'coger el rebote con las dos manos y salir botando protegiendo el balón',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos grupos de seis que trabajan hacia canastas contrarias; en cada uno, tres cogen el rebote y tres persiguen, rotando en cada repetición.',
      niveles: {
        base: 'la señal se da antes del tiro y solo se practica la salida.',
        intermedio: 'la señal se da al coger el rebote.',
        avanzado: 'no hay señal: el que coge el rebote lee de verdad si hay hueco, y el entrenador juzga después la decisión.',
      },
      criterio_exito: 'la decisión coincide con la señal en tres de cada cuatro rebotes',
    },
    tablero: () => [
      jug('A', 1, 0.42, 0.18), jug('A', 2, 0.58, 0.18), jug('A', 3, 0.50, 0.34),
      jug('B', 1, 0.42, 0.12), jug('B', 2, 0.58, 0.12),
      balon(0.50, 0.14),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        // el rebote cae y lo coge A1: primero proteger, después mirar
        { eventos: [
          { jugador: 'A1', tipo: 'recoge' },
          { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.44, y: 0.20 } },
          { jugador: 'B2', tipo: 'defiende', hacia: { x: 0.56, y: 0.20 } },
        ] },
        // hay hueco: se corre, y los compañeros abren carriles
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.30, y: 0.44 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.80, y: 0.42 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.52, y: 0.48 } },
        ] },
        { eventos: [
          { jugador: 'A1', tipo: 'bote', hacia: { x: 0.24, y: 0.66 } },
          { jugador: 'A2', tipo: 'corte', hacia: { x: 0.82, y: 0.64 } },
          { jugador: 'A3', tipo: 'corte', hacia: { x: 0.52, y: 0.70 } },
        ] },
      ],
    },
  },
];
