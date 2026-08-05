/* ============================================================
   organizacion-datos.mjs — el texto de `requisitos.organizacion` de
   cada ficha, para inyectarlo de una pasada en las tandas.

   Es un fichero DE PASO: `node tools/biblioteca/organizacion-aplicar.mjs`
   mete cada texto en su ficha y después esto ya no hace falta. Se deja
   en el repositorio porque es donde se ve el criterio de un vistazo —
   noventa y siete fichas repartidas por siete archivos no se comparan
   entre sí, y aquí sí.

   CRITERIO, el mismo para todas: doce jugadores, pista entera, dos
   canastas, un solo entrenador. Se dice cuántos grupos, dónde va cada
   uno y cuándo se rota. Si el ejercicio no necesita canasta se dice,
   porque entonces puede ir en paralelo con otro que sí.
   ============================================================ */

export const ORGANIZACION = {
  /* ── manejo ─────────────────────────────────────────────── */
  'Los cuatro cuadrantes': 'Con 12: los doce a la vez, un balón cada uno, tres por cuadrante. No usa canastas, así que puede ir en paralelo con algo de tiro en los aros.',
  'Dos balones y un compañero': 'Con 12: seis parejas a la vez, repartidas a lo ancho de la pista y separadas cuatro metros. Treinta segundos y se cambia quien bota.',
  'Recoge y protege': 'Con 12: seis parejas repartidas por la pista, sin canastas. Se cambia de rol cada treinta segundos.',
  'Manejo en el caos': 'Con 12: los doce a la vez dentro de una media pista, un balón cada uno. Si sobra espacio, se estrecha con conos.',
  'El reloj': 'Con 12: cuatro grupos de tres a la vez, repartidos por la pista. No usa canastas.',
  'Pasar sin mirar la pared': 'Con 12: los doce a la vez contra la pared o la valla, separados metro y medio para no invadirse.',
  'Bote sentado y de rodillas': 'Con 12: los doce a la vez, un balón cada uno, en dos filas a lo ancho para que el entrenador los vea a todos de frente.',

  /* ── bote ───────────────────────────────────────────────── */
  'Slalom y entrada': 'Con 12: dos estaciones, una en cada canasta, seis por estación en dos filas de tres. Cada fila con su juego de conos; el que termina vuelve a la suya.',
  '1c1 en pasillo': 'Con 12: dos pasillos de conos, uno hacia cada canasta, seis en cada uno. Tres parejas por pasillo que se turnan; los que esperan, detrás del cono de salida.',
  'Números y bote': 'Con 12: los doce a la vez en una media pista, un balón cada uno. El entrenador canta los números desde fuera para verlos a todos.',
  'Carrera de ida y vuelta': 'Con 12: cuatro filas de tres en la línea de fondo, compitiendo entre ellas a lo largo de toda la pista. No usa canastas.',
  'Protege y gira': 'Con 12: seis parejas repartidas por la pista, sin invadirse. Treinta segundos y cambio de rol.',
  'Solo izquierda': 'Con 12: dos canastas, seis por canasta, tres parejas que se turnan. Cinco ataques y se cambia atacante y defensor.',
  'El túnel': 'Con 12: los doce a la vez en dos túneles paralelos de seis. Se cruza y se vuelve al final del propio túnel, sin parar.',
  'Salir de la trampa': 'Con 12: tres grupos de cuatro repartidos por la pista, sin canastas. Dentro de cada grupo se rota atacante cada dos salidas.',
  'Bote y pase al que aparece': 'Con 12: tres grupos de cuatro repartidos por la pista. Cinco pases y rota el que bota.',

  /* ── pase ───────────────────────────────────────────────── */
  'Triángulo de pase y sigue': 'Con 12: dos triángulos en paralelo, uno en cada media pista, seis en cada uno (tres filas de dos). No usa canastas.',
  'Cuatro esquinas con intruso': 'Con 12: dos cuadrados, uno en cada media pista, seis por cuadrado: cuatro en las esquinas y dos de intrusos. Los intrusos cambian cada minuto.',
  'Dos contra uno con pase obligado': 'Con 12: dos grupos de seis, uno por canasta, trabajando en tríos. Rotan las tres posiciones cada ataque.',
  'Pase por encima al poste': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, poste y defensor. Se rota al terminar cada serie.',
  'Pase de béisbol y carrera': 'Con 12: pista entera y las dos canastas, cuatro tríos que salen escalonados desde el fondo cada diez segundos.',
  'Rondo 4c2': 'Con 12: dos rondos de seis a la vez, uno en cada media pista. No usa canastas.',
  'Pasa y mira antes': 'Con 12: dos grupos de seis, uno por canasta. Juegan cinco y el que sobra cuenta los pases buenos; se cambia cada minuto.',

  /* ── tiro ───────────────────────────────────────────────── */
  'Mecánica bajo el aro': 'Con 12: seis parejas, tres en cada canasta, repartidas a un metro del aro por los dos lados y el frontal. Diez tiros y cambio dentro de la pareja.',
  'Tiro tras recepción con cierre': 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan tirador, pasador y defensor.',
  'Las cinco posiciones': 'Con 12: dos grupos de seis, uno por canasta, en parejas (uno tira y el otro devuelve). Cada pareja empieza en una posición distinta para no cruzarse.',
  'Tiro tras bote con parada': 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cinco y un defensor que sale a cerrar. Se rota atacante, defensor y final de la fila.',
  'Tiros libres con presión de equipo': 'Con 12: dos equipos de seis, uno en cada canasta, y al terminar se comparan los fallos. Todos tiran una vez antes de que nadie repita.',
  'Ida y vuelta: tiro con fatiga': 'Con 12: seis parejas repartidas entre las dos canastas. Salen escalonadas cada quince segundos para no chocarse en el medio campo.',
  '1c1 al tirador': 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, tirador y defensor.',
  'Concurso de las cinco estaciones': 'Con 12: dos grupos de seis, uno por canasta, en parejas. Cada pareja recorre las cinco estaciones y apunta su total.',
  'Tiro tras corte': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, cortador y defensor. Cinco por lado y se rota.',
  'Duelo de tiro por equipos': 'Con 12: dos equipos de seis, uno en cada canasta, y se comparan los aciertos al terminar.',
  'Tiro desde el lateral en carrera': 'Con 12: dos estaciones, una por canasta: fila de cuatro en la banda, un pasador y un defensor. El pasador cambia cada cinco tiros.',

  /* ── entrada ────────────────────────────────────────────── */
  'Entradas por parejas desde el 45': 'Con 12: dos estaciones, una por canasta, seis por estación en dos filas de tres (una en cada 45). Dos balones por estación para que no pare.',
  'Entrada con perseguidor': 'Con 12: dos estaciones, una por canasta, seis por estación. Tres parejas que se turnan; se cambia atacante y perseguidor cada tres entradas.',
  'Finalización con contacto': 'Con 12: seis parejas, tres en cada canasta, entrando por turnos. Cinco entradas y se cambia quien hace el contacto.',
  'Mano cambiada bajo el aro': 'Con 12: seis parejas, tres en cada canasta, entrando por turnos desde el 45. Cinco cada uno y se cambia.',
  'Entrada desde el fondo': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante y defensor. Tres cada uno y rotan.',

  /* ── juego de pies ──────────────────────────────────────── */
  'Parada y salida ante el cono': 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cinco y el compañero que señala el lado. El que señala cambia cada vuelta.',
  'Parada en un tiempo tras recepción': 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cuatro, un pasador y el que molesta con las manos arriba. Rotan los tres papeles.',
  'Fintas de recepción': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, receptor y defensor. Rotan cada tres recepciones.',
  'Pivotar con presión': 'Con 12: seis parejas repartidas por la pista, sin canastas. Se cambia de rol cada treinta segundos.',
  'Salida directa y salida cruzada': 'Con 12: seis parejas, tres en cada canasta, cada una en un punto distinto del perímetro.',

  /* ── 1c1 ────────────────────────────────────────────────── */
  '1c1 desde el 45 con dos botes': 'Con 12: dos canastas, seis por canasta. Tres parejas que se turnan; las que esperan, en el 45 contrario y listas para entrar sin pausa.',
  'Desmarque para recibir': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante y defensor. Rotan las tres posiciones.',
  '1c1 de espaldas desde el poste': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante de espaldas y defensor. Rotan cada ataque.',
  '1c1 en el cuadrado': 'Con 12: dos cuadrados de conos, uno en cada media pista, seis en cada uno. Tres parejas que se turnan.',
  '1c1 con ventaja inicial': 'Con 12: dos canastas, seis por canasta, tres parejas turnándose. Se cambia atacante y defensor cada ataque.',
  '1c1 al primer bote': 'Con 12: dos canastas, seis por canasta, tres parejas turnándose. Se cambia de rol cada ataque.',
  '1c1 tras recepción en carrera': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante y defensor. Rotan cada ataque.',
  '1c1 desde el poste alto': 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan pasador, atacante y defensor.',
  '1c1 con ayuda que llega': 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; entran cada tres ataques.',

  /* ── juego de dos ───────────────────────────────────────── */
  'Pasar y cortar en 2c2': 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan fuera; entran cada dos ataques.',
  'Puerta atrás al que se pasa de listo': 'Con 12: dos grupos de seis, uno por canasta, en tríos. Rotan pasador, receptor y defensor.',
  'Aclarado y uno contra uno': 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; entran cada dos ataques.',
  'Mano a mano': 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; se rota cada dos jugadas.',
  'Bloqueo indirecto para el tirador': 'Con 12: dos grupos de seis, uno por canasta: cinco jugando y uno que entra en la jugada siguiente. Tres jugadas y rotan.',

  /* ── defensa ────────────────────────────────────────────── */
  'Ayuda y recuperación en 2c2': 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; se cambia ataque y defensa cada cuatro posesiones.',
  'Defensa del bote en pasillo': 'Con 12: dos pasillos de conos, uno hacia cada canasta, seis en cada uno. Tres parejas que se turnan atacante y defensor.',
  'Espejo defensivo': 'Con 12: seis parejas a la vez, repartidas a lo ancho de la pista y mirándose. Treinta segundos y cambio. No usa canastas.',
  'Ver balón y ver a mi par': 'Con 12: tres grupos de cuatro repartidos por la pista, dos atacantes y dos defensores en cada uno. El entrenador grita para los tres a la vez.',
  'Defensa del corte': 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; se rota cada tres cortes.',
  'Cerrar y contener': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante y defensor. Rotan cada tres cierres.',
  'Dos ayudas seguidas': 'Con 12: dos grupos de seis, uno por canasta. Los seis juegan a la vez, tres atacando y tres defendiendo, y se cambia de rol cada dos jugadas.',
  'Defender sin manos': 'Con 12: seis parejas, tres en cada canasta, separadas para no estorbarse. Treinta segundos y cambio.',
  'Defensa de la esquina': 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante en la esquina y defensor. Rotan.',

  /* ── contraataque ───────────────────────────────────────── */
  'Dos contra uno continuo': 'Con 12: un solo grupo en pista entera con las dos canastas. Salen de tres en tres sin parar; los otros nueve esperan por orden en la línea de fondo.',
  'Rebote y salida': 'Con 12: pista entera, tres grupos de cuatro que salen por turnos desde la línea de fondo. Se entra en cuanto el grupo anterior cruza el medio.',
  'Balance defensivo': 'Con 12: pista entera, tres grupos de cuatro que salen por turnos. El grupo que termina se queda al fondo esperando su vuelta.',
  'Tres carriles': 'Con 12: pista entera, cuatro tríos que salen escalonados. El trío que llega al otro lado espera allí su turno para volver.',

  /* ── juego reducido ─────────────────────────────────────── */
  '3c3 con dos botes': 'Con 12: dos partidos de 3c3 a la vez, uno en cada canasta. Nadie fuera.',
  'Tres contra dos continuo': 'Con 12: un solo grupo en pista entera. Salen de cinco en cinco y el resto espera al fondo; se entra en cuanto la jugada anterior cruza el medio.',
  '1c1 con zonas de puntuación': 'Con 12: dos canastas, seis por canasta, tres parejas que se turnan. Cada duelo, una posesión.',
  '2c2 a dos toques': 'Con 12: dos partidos de 2c2, uno por canasta, con dos esperando en cada uno que entran cada dos ataques.',
  '4c4 sin bote': 'Con 12: dos grupos, uno de ocho jugando 4c4 en una canasta y otro de cuatro jugando 2c2 en la otra. Se cambian a la mitad del tiempo.',
  '3c2 e inferioridad de vuelta': 'Con 12: un solo grupo en pista entera. Salen de cinco en cinco y el resto espera al fondo por orden.',
  '2c2 con comodín': 'Con 12: dos grupos de seis, uno por canasta: 2c2 más comodín y uno que espera para entrar de comodín en la siguiente.',
  '3c3 con transición': 'Con 12: cuatro equipos de tres en pista entera. Juegan dos y los otros dos esperan al fondo; entran en cuanto hay canasta.',
  'El rey de la pista': 'Con 12: dos reinos, uno en cada canasta, seis en cada uno: el rey y cinco retadores en fila. Así nadie espera más de cuatro duelos seguidos.',
  '4c4 con zonas de puntuación': 'Con 12: dos grupos, uno de ocho jugando 4c4 en una canasta y otro de cuatro jugando 2c2 en la otra. Se cambian a la mitad del tiempo.',

  /* ── rebote ─────────────────────────────────────────────── */
  'Bloqueo de rebote por parejas': 'Con 12: dos grupos de seis, uno por canasta. En cada uno, dos parejas alrededor de la zona y dos que se turnan para tirar y fallar.',
  'Rebote ofensivo tras tiro propio': 'Con 12: seis parejas, tres en cada canasta, cada una en un lado distinto de la zona.',
  'Tres contra tres al rebote': 'Con 12: dos grupos de seis, uno por canasta, jugando 3c3 al rebote. Nadie fuera.',
  'Rebote a dos manos y salida': 'Con 12: seis parejas, tres en cada canasta, turnándose para tirar y coger.',
  'Rebote en superioridad': 'Con 12: dos grupos de seis, uno por canasta: un defensor, dos atacantes y tres esperando que rotan cada cinco tiros.',

  /* ── calentamiento ──────────────────────────────────────── */
  'Pilla-pilla con balón': 'Con 12: los doce a la vez en una media pista, con dos que la ligan. Si se hace fácil, se estrecha el espacio en vez de añadir gente que liga.',
  'Movilidad con balón': 'Con 12: los doce a la vez recorriendo la pista a lo largo, en dos filas de seis para que no se pisen.',
  'Relevo de calentamiento por equipos': 'Con 12: cuatro equipos de tres en la línea de fondo, compitiendo a la vez a lo largo de la pista.',
  'Pases en movimiento por parejas': 'Con 12: seis parejas recorriendo la pista a lo largo, saliendo escalonadas cada cinco segundos y terminando en las dos canastas.',
  'Cadena de nombres': 'Con 12: los doce en un solo círculo. Con más de dieciséis se parte en dos, porque la espera se hace larga.',

  /* ── psicomotricidad ────────────────────────────────────── */
  'El semáforo con balón': 'Con 12: los doce a la vez en una media pista, un balón cada uno. Sin canastas.',
  'Los aros de colores': 'Con 12: los doce a la vez, con los aros repartidos por una media pista.',
  'El espejo con balón': 'Con 12: seis parejas a la vez, repartidas a lo ancho y mirándose.',
  'Saltar los ríos': 'Con 12: dos recorridos en paralelo de seis, para que nadie espere su turno más de dos saltos.',
  'Los cuatro rincones': 'Con 12: los doce a la vez, tres en cada rincón.',
  'El balón que no se cae': 'Con 12: los doce a la vez, un balón cada uno, repartidos por una media pista.',
};
