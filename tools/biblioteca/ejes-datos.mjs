/* ============================================================
   ejes-datos.mjs — los dos ejes separados, ficha a ficha.

   `oposicion` había acabado significando dos cosas a la vez: "hay un
   rival que disputa" y "esto aprieta". Con las dos mezcladas, diez
   fichas declaraban oposición sin tener un solo defensor que dibujar —
   el compañero que levanta dedos para que mires arriba, el que te
   devuelve el rebote, el equipo que tira a la vez en la otra canasta.
   Ninguno disputa nada, y sin embargo los tres ejercicios aprietan.

   Desde aquí son dos ejes (vocabulario.mjs):

     oposicion · cuánto RIVAL hay      nula · pasiva · semiactiva · real
     presion   · qué aprieta sin rival ninguna · espacio · tiempo · marcador

   CORRECCIONES son las fichas cuya `oposicion` estaba contando presión.
   PRESION es el valor del eje nuevo para las noventa y siete.

   El criterio para separar, que es el que usa el linter:
   hay oposición cuando existe alguien a quien HAY QUE GANAR o que te
   puede quitar el balón. El compañero que hace de modelo, de pasador o
   de reboteador no es oposición aunque esté delante.
   ============================================================ */

/** Fichas cuya `oposicion` describía presión y no rival. */
export const CORRECCIONES = {
  'Los cuatro cuadrantes': 'nula',          // nadie disputa: aprieta compartir el cuadrante
  'Manejo en el caos': 'nula',              // lo que aprieta es el espacio que se estrecha
  'Relevo de calentamiento por equipos': 'nula', // un relevo no se defiende, se corre
  'Duelo de tiro por equipos': 'nula',      // el otro equipo tira, no defiende
  'El reloj': 'nula',                       // aprieta la orden del entrenador
  'Rebote a dos manos y salida': 'nula',    // el balón lo lanza el entrenador
  'Cadena de nombres': 'nula',              // cadena de pases en movimiento, sin rival
  'Dos balones y un compañero': 'nula',     // el compañero señala, no disputa
  'Pasar sin mirar la pared': 'nula',       // el compañero canta números
  'El espejo con balón': 'nula',            // se copia un gesto; no hay nada que ganar
};

/* Lo que aprieta cuando no hay rival enfrente. `marcador` sale del tag
   'competición', que ya estaba curado ficha a ficha, así que no se
   escribe aquí: lo pone el aplicador. Estas dos listas son las que
   exigen criterio. */

/** Hay una señal o un reloj al que responder ya. */
export const PRESION_TIEMPO = [
  'El semáforo con balón',
  'Números y bote',
  'El reloj',
  'Pasar sin mirar la pared',
  'Los aros de colores',
  'Los cuatro rincones',
  'El espejo con balón',
  'Pivotar con presión',            // tres segundos con el balón en las manos
  'Cuatro esquinas con intruso',    // dos segundos en el nivel avanzado
  'Parada y salida ante el cono',   // se sale hacia el lado que señalan
];

/** El espacio se comparte o se estrecha: hay que esquivar y proteger. */
export const PRESION_ESPACIO = [
  'Los cuatro cuadrantes',
  'Manejo en el caos',
  'Pilla-pilla con balón',
  'Cadena de nombres',
  'El túnel',                       // la decisión es por dónde cruzar
];

/**
 * Presión de una ficha. Precedencia: marcador > tiempo > espacio >
 * ninguna. `marcador` gana porque cuando hay tanteo lo demás pasa a
 * segundo plano — es lo que el niño mira.
 */
export function presionDe(ficha) {
  if ((ficha.tags || []).includes('competición')) return 'marcador';
  if (PRESION_TIEMPO.includes(ficha.name)) return 'tiempo';
  if (PRESION_ESPACIO.includes(ficha.name)) return 'espacio';
  return 'ninguna';
}
