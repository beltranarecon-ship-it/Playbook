/* ============================================================
   netlify/functions/generar-animacion.js
   Proxy hacia la API de Anthropic (Claude Haiku). ÚNICO punto que
   ve la API key (variable de entorno ANTHROPIC_API_KEY en Netlify).
   El cliente nunca la recibe.

   Fase 2b: el modelo ya NO devuelve geometría (paths, coordenadas
   de trayectoria, tiempos) — devuelve la INTENCIÓN del ejercicio
   ({ intent }: quién hace qué, fase a fase — ver el esquema en
   taller/js/ia/compilador.js). El cliente la valida y repara
   (taller/js/ia/validador.js) y la compila a geometría §10 con el
   MISMO compilador determinista que usa el camino local. Menos
   superficie de alucinación: el modelo decide QUÉ pasa; el código
   calcula DÓNDE y CUÁNDO.

   Recibe (POST JSON): { texto, posiciones, pista, respuestas? }
   Devuelve: { intent, warnings? } | { preguntas:[...] } (§8.3) |
   { error: "..." }.
   ============================================================ */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5'; // el spec elige Haiku (revisión: Fase 3)

// Claves de canasta válidas por pista (§10). Las COORDENADAS de los aros ya
// no viajan al modelo: la geometría la resuelve el cliente (compilador.js
// lee PISTAS de canvas/court.js).
const BASKET_KEYS = {
  entera: ['norte', 'sur'],
  media: ['norte'],
  entera_fiba: ['norte', 'sur'],
  media_fiba: ['norte'],
};

// Posiciones con NOMBRE válidas por pista (Tramo 2.2). Solo viajan los
// nombres: las coordenadas las resuelve el cliente contra sus anclas
// medidas (taller/js/canvas/anclas.js) — paridad con ia/posiciones.js.
// Las medias no tienen poste alto medido (media pista dibujada).
const POS_ENTERA = [
  'aro', 'poste_bajo_izq', 'poste_bajo_der', 'poste_alto_izq', 'poste_alto_der',
  'codo_izq', 'codo_der', 'tiro_libre', 'base', 'escolta_izq', 'escolta_der',
  'alero_izq', 'alero_der', 'esquina_izq', 'esquina_der', 'centro',
];
const POS_MEDIA = POS_ENTERA.filter((p) => !/^poste_alto/.test(p));
const POSICION_KEYS = {
  entera: POS_ENTERA,
  media: POS_MEDIA,
  entera_fiba: POS_ENTERA,
  media_fiba: POS_MEDIA,
};

const SYSTEM = `Eres el motor táctico de Playbook CBP. INTERPRETAS la descripción en lenguaje natural de un ejercicio de baloncesto y devuelves su INTENCIÓN estructurada: quién hace qué, en qué orden. NUNCA devuelves trayectorias, coordenadas de paths ni duraciones — la geometría la calcula la aplicación de forma determinista a partir de tu intención.

Respondes SIEMPRE con UN ÚNICO objeto JSON válido, sin texto adicional, sin markdown, sin comentarios.

FORMATO DE RESPUESTA (tres casos posibles):
1. Caso normal:
{ "intent": { "canasta": "norte" | "sur", "fases": [ { "eventos": [ EVENTO, ... ] }, ... ] }, "warnings": [ { "texto_original": "...", "interpretacion": "...", "campo": "..." } ] }
2. Ambigüedad importante (NO inventes):
{ "preguntas": [ { "id": "q1", "tipo": "A" | "B", "texto": "...", "opciones": ["...", "..."] } ] }
Usa tipo "B" para elegir entre opciones concretas y tipo "A" solo cuando necesites una posición en la pista (el entrenador hará clic).
3. Ininterpretable: { "error": "..." }

EVENTO — una acción de UN jugador dentro de una fase (campos no aplicables: null):
{ "jugador": "<id>", "tipo": "bote" | "corte" | "pase" | "tiro" | "bloqueo" | "defiende" | "rodea_cono" | "vuelve_a_fila" | "recoge", "hacia": "canasta" | "aro" | "<posicion>" | {"x": 0-1, "y": 0-1} | null, "a": "<id>" | null, "cono_id": "<id>" | null, "marca": "<id>" | null, "bloqueado_id": "<id>" | null, "balon_id": "<id>" | null }

REGLAS:
- Todos los ids ("jugador", "a", "marca", "bloqueado_id", "cono_id") DEBEN salir de las listas JUGADORES y CONOS del mensaje del usuario. No inventes ids: los eventos con ids desconocidos se descartan.
- IDENTIDAD: el id de jugador es LETRA de equipo + número de orden (A = Equipo 1, naranja; B = Equipo 2, verde; C = Equipo 3, rojo; D = Equipo 4, azul marino). Cada jugador trae además "dorsal" (el número VISIBLE de su ficha; por defecto coincide con el número del id, pero el entrenador puede cambiarlo) y "nombre" si se lo puso. Si el texto dice "el 7 verde" o "Ana", busca en JUGADORES el que tenga ese dorsal/nombre y usa SU id.
- BALONES: el mensaje trae la lista de balones, cada uno con su posición y "en_manos_de" (id del jugador que lo tiene al inicio, o null si está suelto). Puede haber VARIOS balones (rondos, series de tiro): pases de balones DISTINTOS pueden ir en paralelo en la misma fase; cada bote/pase/tiro usa el balón que su jugador tenga en ese momento. Si el texto asigna un balón inicial a OTRO jugador distinto de "en_manos_de", decláralo en el intent con "balones": [{"id": "<id del balón>", "portador": "<id de jugador>"}]; omite "balones" cuando coincida con lo que ya ves. Si con varios balones no queda claro quién empieza con cuál, pregunta (tipo "B").
- FASES = momentos consecutivos del ejercicio. Las acciones SIMULTÁNEAS van en la MISMA fase; lo que ocurre después va en la siguiente. Un pase y el tiro del receptor son fases distintas (primero viaja el balón, luego se tira).
- Movimiento PARCIAL: en cada fase incluye SOLO a los jugadores que la descripción implica en ese momento. Una fase puede tener un único evento. No añadas cortes ni desplazamientos "de relleno".
- "bote" (con balón) / "corte" (sin balón): "hacia" es "canasta" (lo normal: penetraciones, cortes al aro), un NOMBRE de posición, o {"x","y"} como último recurso. Coordenadas normalizadas: x de 0 (izquierda) a 1 (derecha), y de 0 (arriba) a 1 (abajo).
- "canasta" frente a "aro" — DISTINCIÓN IMPORTANTE: "canasta" AVANZA hacia el aro sin llegar (penetración que sigue, corte que busca ventaja); "aro" LLEGA hasta el aro y termina ahí. Toda acción que acaba en canasta —entrada, bandeja, doble ritmo, "ataca el aro", "termina en el aro"— usa "aro". Usar "canasta" para una entrada deja al jugador plantado a media distancia y el tiro sale de ahí: la entrada se convierte en un tiro de media distancia.
- POSICIONES CON NOMBRE: si el texto nombra un lugar de la pista ("al poste bajo derecho", "hasta la esquina izquierda", "al codo"...), emite en "hacia" el nombre EXACTO de POSICIONES_VALIDAS del mensaje (o de "posiciones_custom": nombres propios que este entrenador ya tiene definidos). Las coordenadas del nombre las resuelve la aplicación — prefiere SIEMPRE el nombre a inventar {"x","y"}. Si el lugar nombrado NO está en ninguna de las dos listas, pregunta con tipo "A" e id "q_pos_<nombre_en_snake_case>" (p.ej. "q_pos_refugio" para "el refugio"): el entrenador lo marcará con un clic.
- "pase": "a" = id del receptor. El viaje del balón lo calcula la aplicación.
- "tiro": el jugador que tira. Sin más campos.
- "defiende": ese jugador es DEFENSOR en ESA fase; "marca" = id del atacante al que marca, o null si su atacante no se mueve en esa fase (cuenta como defensor pero se queda quieto). Los ROLES son POR FASE y pueden cambiar: quien defiende en una fase puede atacar en la siguiente (y entonces ya no emites "defiende" para él). Emite el evento "defiende" de cada defensor en CADA fase en la que defienda.
- "rodea_cono": emítelo ADEMÁS del evento "bote"/"corte" del mismo jugador en la MISMA fase, uno por cada cono que sortea, con su "cono_id".
- "vuelve_a_fila": el jugador (salido de una fila) corre hasta el final de su cola. Sin más campos.
- "recoge": el jugador va a por un balón suelto y se lo queda (rebote propio, balón que quedó en el aro tras un tiro, balón parado en el suelo). "balon_id" solo si hay varios balones y el texto concreta cuál; con uno solo, null. CIERRA EL CICLO: en cualquier ejercicio de fila que termine tirando, la secuencia completa es tiro → "recoge" → "vuelve_a_fila". Sin el "recoge", el balón se queda en el aro para siempre y el jugador vuelve a la fila con las manos vacías.
- "bloqueo": "jugador" es el bloqueador; "bloqueado_id" es a quién bloquea (el defensor apantallado; si no hay defensa en pista, el compañero con balón que usa el bloqueo).
- BLOQUEO DIRECTO (pick & roll) = eventos encadenados, nunca un evento único: (1) fase de APROXIMACIÓN — el bloqueador hace "corte" hasta un punto pegado al portador ({"x","y"} junto a él) y, en la MISMA fase, su evento "bloqueo"; (2) fase de USO y CONTINUACIÓN — el portador hace "bote" usando el bloqueo (hacia canasta o donde diga el texto) y en esa MISMA fase el bloqueador continúa: "corte" hacia "aro" si rueda al aro (roll) o hacia una posición nombrada ("codo_der", "base"...) si se abre para el tiro (pop); (3) si el que continúa recibe y tira, el pase y el tiro van en fases SIGUIENTES.
- Equipos NEUTRALES: el entrenador los llama "equipo 1..4" (= letras A..D de los ids: A=1, B=2, C=3, D=4). NADIE defiende salvo que el texto (o una respuesta previa) lo diga.
- Canasta: de cara al entrenador, "Canasta 1" = "norte" y "Canasta 2" = "sur". "intent.canasta" debe ser una de las CANASTAS_VALIDAS del mensaje. Si solo hay "norte", usa "norte". Si hay dos, el texto o las "respuestas" (id "q_canasta") ya la concretan casi siempre — usa esa.
- Filas de espera: el PRIMERO de cada fila ya existe como jugador (ids "fila1", "fila2"... en JUGADORES, con su equipo y su cono de origen). Si el texto pone a trabajar "al primero de la fila", ese es su id. Los SIGUIENTES de cada cola también existen — ids "fila1_2", "fila1_3"... (hasta el 5º; campo "orden_en_cola") — pero úsalos SOLO para SERIES: si el ejercicio encadena salidas ("luego sale el siguiente", rondos, series de tiro), el que termina hace "vuelve_a_fila" y el siguiente (filaN_2, luego filaN_3...) sale en la fase SIGUIENTE repitiendo el trabajo. El resto de la cola no existe como ids.
- "respuestas": respuestas del entrenador a preguntas previas — trátalas como parte de la descripción y NO vuelvas a preguntar lo ya respondido.
- Pregunta SOLO cuando algo importante es ambiguo (quién tira, a quién se pasa, quién defiende...). Máximo 2 preguntas, concretas, con opciones que usen los ids/equipos reales del tablero.
- "warnings": anota ahí las interpretaciones dudosas que hayas decidido tú (términos vagos de posición, etc.).`;

/* ---- ejemplos resueltos (few-shot): pares user→assistant reales ------
   Cubren el espacio de formatos: defensa con roles y movimiento parcial,
   fila + rodear cono + vuelta a la cola, y ambigüedad → preguntas (con
   una respuesta previa ya dada que NO se vuelve a preguntar). */
const EJEMPLOS = [
  {
    user: {
      texto: 'El equipo 2 defiende. A1 penetra y dobla a A2 para el tiro.',
      pista: 'media',
      canastas_validas: ['norte'],
      posiciones_validas: POS_MEDIA,
      posiciones_custom: [],
      jugadores: [
        { id: 'A1', equipo: 'A', dorsal: 1, x: 0.7, y: 0.55 }, { id: 'A2', equipo: 'A', dorsal: 2, x: 0.45, y: 0.3 },
        { id: 'B1', equipo: 'B', dorsal: 1, x: 0.6, y: 0.5 }, { id: 'B2', equipo: 'B', dorsal: 2, x: 0.4, y: 0.35 },
      ],
      balones: [{ id: 'balon_1', x: 0.71, y: 0.55, en_manos_de: 'A1' }],
      conos: [],
      respuestas: null,
    },
    assistant: {
      intent: {
        canasta: 'norte',
        fases: [
          { eventos: [
            { jugador: 'A1', tipo: 'bote', hacia: 'canasta', a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
            { jugador: 'B2', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
          ] },
          { eventos: [
            { jugador: 'A1', tipo: 'pase', hacia: null, a: 'A2', cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B2', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
          ] },
          { eventos: [
            { jugador: 'A2', tipo: 'tiro', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B2', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A2', bloqueado_id: null },
          ] },
        ],
      },
      warnings: [],
    },
  },
  // Fila + rotación (serie, Tramo 3c): sale el 1º (fila1), vuelve a la cola
  // y en la fase SIGUIENTE sale el 2º (fila1_2) repitiendo el trabajo.
  {
    user: {
      texto: 'Serie: el primero de la fila sale botando, rodea el cono, entra a canasta y vuelve a la fila. Entonces sale el segundo y hace lo mismo.',
      pista: 'media',
      canastas_validas: ['norte'],
      posiciones_validas: POS_MEDIA,
      posiciones_custom: [],
      jugadores: [
        { id: 'fila1', equipo: 'A', x: 0.8, y: 0.3, desde_cono: 'cono_f', en_cola: 4 },
        { id: 'fila1_2', equipo: 'A', x: 0.8, y: 0.3, desde_cono: 'cono_f', orden_en_cola: 2 },
        { id: 'fila1_3', equipo: 'A', x: 0.8, y: 0.3, desde_cono: 'cono_f', orden_en_cola: 3 },
        { id: 'fila1_4', equipo: 'A', x: 0.8, y: 0.3, desde_cono: 'cono_f', orden_en_cola: 4 },
      ],
      balones: [{ id: 'balon_1', x: 0.79, y: 0.31, en_manos_de: 'fila1' }],
      conos: [
        { id: 'cono_f', funcion: 'fila', x: 0.8, y: 0.3 },
        { id: 'cono_r', funcion: 'rodear', x: 0.5, y: 0.45 },
      ],
      respuestas: null,
    },
    assistant: {
      intent: {
        canasta: 'norte',
        fases: [
          { eventos: [
            { jugador: 'fila1', tipo: 'bote', hacia: 'canasta', a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'fila1', tipo: 'rodea_cono', hacia: null, a: null, cono_id: 'cono_r', marca: null, bloqueado_id: null },
          ] },
          { eventos: [{ jugador: 'fila1', tipo: 'tiro', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null }] },
          { eventos: [
            { jugador: 'fila1', tipo: 'vuelve_a_fila', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'fila1_2', tipo: 'bote', hacia: 'canasta', a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'fila1_2', tipo: 'rodea_cono', hacia: null, a: null, cono_id: 'cono_r', marca: null, bloqueado_id: null },
          ] },
          { eventos: [{ jugador: 'fila1_2', tipo: 'tiro', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null }] },
        ],
      },
      warnings: [],
    },
  },
  {
    user: {
      texto: 'Trabajo de pies en el poste bajo y finalización.',
      pista: 'entera',
      canastas_validas: ['norte', 'sur'],
      posiciones_validas: POS_ENTERA,
      posiciones_custom: [],
      jugadores: [{ id: 'A1', equipo: 'A', dorsal: 1, x: 0.4, y: 0.25 }, { id: 'A2', equipo: 'A', dorsal: 2, x: 0.6, y: 0.3 }],
      balones: [{ id: 'balon_1', x: 0.41, y: 0.25, en_manos_de: 'A1' }],
      conos: [],
      respuestas: [{ id: 'q_canasta', tipo: 'B', respuesta: 'Canasta 1' }],
    },
    assistant: {
      preguntas: [
        { id: 'q1', tipo: 'B', texto: '¿Quién trabaja el poste bajo y finaliza?', opciones: ['A1', 'A2', 'Los dos alternando'] },
      ],
    },
  },
  // Posiciones con NOMBRE (Tramo 2.2): el corte lleva el nombre exacto de
  // POSICIONES_VALIDAS en "hacia"; la aplicación resuelve sus coordenadas.
  {
    user: {
      texto: 'A2 corta al poste bajo derecho, recibe de A1 y tira.',
      pista: 'media',
      canastas_validas: ['norte'],
      posiciones_validas: POS_MEDIA,
      posiciones_custom: [],
      jugadores: [{ id: 'A1', equipo: 'A', dorsal: 1, x: 0.6, y: 0.55 }, { id: 'A2', equipo: 'A', dorsal: 2, x: 0.5, y: 0.25 }],
      balones: [{ id: 'balon_1', x: 0.61, y: 0.55, en_manos_de: 'A1' }],
      conos: [],
      respuestas: null,
    },
    assistant: {
      intent: {
        canasta: 'norte',
        fases: [
          { eventos: [
            { jugador: 'A2', tipo: 'corte', hacia: 'poste_bajo_der', a: null, cono_id: null, marca: null, bloqueado_id: null },
          ] },
          { eventos: [
            { jugador: 'A1', tipo: 'pase', hacia: null, a: 'A2', cono_id: null, marca: null, bloqueado_id: null },
          ] },
          { eventos: [
            { jugador: 'A2', tipo: 'tiro', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
          ] },
        ],
      },
      warnings: [],
    },
  },
  // BLOQUEO DIRECTO (pick & roll, Tramo 3c): aproximación (corte + bloqueo
  // en la misma fase) → uso y continuación (bote del portador + roll del
  // bloqueador hacia "aro" en la misma fase) → pase y tiro en fases aparte.
  // Para un pop, la continuación iría a una posición nombrada ("codo_der"...).
  {
    user: {
      texto: 'B1 defiende a A1. A2 le pone un bloqueo directo a A1, que penetra usando el bloqueo; A2 continúa al aro, recibe y tira.',
      pista: 'media',
      canastas_validas: ['norte'],
      posiciones_validas: POS_MEDIA,
      posiciones_custom: [],
      jugadores: [
        { id: 'A1', equipo: 'A', dorsal: 1, x: 0.45, y: 0.5 },
        { id: 'A2', equipo: 'A', dorsal: 2, x: 0.3, y: 0.68 },
        { id: 'B1', equipo: 'B', dorsal: 1, x: 0.4, y: 0.47 },
      ],
      balones: [{ id: 'balon_1', x: 0.46, y: 0.5, en_manos_de: 'A1' }],
      conos: [],
      respuestas: null,
    },
    assistant: {
      intent: {
        canasta: 'norte',
        fases: [
          { eventos: [
            { jugador: 'A2', tipo: 'corte', hacia: { x: 0.42, y: 0.54 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'A2', tipo: 'bloqueo', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: 'B1' },
            { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
          ] },
          { eventos: [
            { jugador: 'A1', tipo: 'bote', hacia: 'canasta', a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'A2', tipo: 'corte', hacia: 'aro', a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
          ] },
          { eventos: [
            { jugador: 'A1', tipo: 'pase', hacia: null, a: 'A2', cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
          ] },
          { eventos: [
            { jugador: 'A2', tipo: 'tiro', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
            { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A2', bloqueado_id: null },
          ] },
        ],
      },
      warnings: [],
    },
  },
];

/* ---- payload curado para el modelo -----------------------------------
   En vez de volcar `posiciones` crudo, se construye el roster con los ids
   EXACTOS que el cliente reconocerá al compilar. OJO paridad crítica con
   taller/js/ia/compilador.js#sintetizarJugadores: jugadores = equipo+label
   ("A1"); filas = "fila1","fila2"... numeradas en el ORDEN de los conos
   fila con n_jugadores>0. Y con validador.js: id de cono con fallback
   "cono_<i+1>" indexado sobre TODOS los conos. */
const rd = (v) => Math.round((Number(v) || 0) * 100) / 100;

// tope de salidas direccionables por fila (paridad con SALIDAS_MAX_FILA de
// taller/js/ia/compilador.js: mismos ids filaN, filaN_2..filaN_5).
const SALIDAS_MAX_FILA = 5;

function jugadoresDe(posiciones = []) {
  const out = posiciones
    .filter((e) => e && e.kind === 'jugador')
    .map((e) => {
      // dorsal = número VISIBLE de la ficha (el custom si lo hay; si no, el
      // label de orden). El id NO cambia con el dorsal: sigue siendo equipo+label.
      const j = { id: `${e.equipo}${e.label}`, equipo: e.equipo, dorsal: e.dorsal ?? (Number(e.label) || null), x: rd(e.x), y: rd(e.y) };
      if (e.nombre) j.nombre = e.nombre;
      return j;
    });
  const conos = posiciones.filter((e) => e && e.kind === 'cono');
  let nFila = 0;
  conos.forEach((c, i) => {
    if (c.funcion === 'fila' && c.fila_config && (c.fila_config.n_jugadores || 0) > 0) {
      nFila += 1;
      const conoId = c.id || `cono_${i + 1}`;
      out.push({
        id: `fila${nFila}`, equipo: c.fila_config.equipo || 'A',
        x: rd(c.x), y: rd(c.y),
        desde_cono: conoId, en_cola: c.fila_config.n_jugadores,
      });
      // los SIGUIENTES de la cola (rotación de series, Tramo 3c): mismos ids
      // que sintetiza el cliente (compilador.js#sintetizarJugadores).
      for (let k = 2; k <= Math.min(c.fila_config.n_jugadores, SALIDAS_MAX_FILA); k++) {
        out.push({
          id: `fila${nFila}_${k}`, equipo: c.fila_config.equipo || 'A',
          x: rd(c.x), y: rd(c.y), desde_cono: conoId, orden_en_cola: k,
        });
      }
    }
  });
  return out;
}

/* Balones con su poseedor INICIAL visible para el modelo (Tramo 3a):
   portador_id explícito del tablero si existe; si no, el jugador MÁS
   CERCANO dentro de un radio corto (regla determinista de tablero — la
   posesión durante la jugada la sigue decidiendo la cadena de eventos del
   compilador, que respeta el "balones[].portador" que declare el modelo).
   Cada jugador puede quedar como poseedor de UN solo balón. */
const CERCA_BALON = 0.06;
function balonesDe(posiciones = [], jugadores = []) {
  const cogidos = new Set();
  return posiciones
    .filter((e) => e && e.kind === 'balon')
    .map((b, i) => {
      let owner = null;
      if (b.portador_id && jugadores.some((j) => j.id === b.portador_id) && !cogidos.has(b.portador_id)) {
        owner = b.portador_id;
      } else {
        let best = CERCA_BALON;
        for (const j of jugadores) {
          if (cogidos.has(j.id)) continue;
          const d = Math.hypot(rd(b.x) - j.x, rd(b.y) - j.y);
          if (d < best) { best = d; owner = j.id; }
        }
      }
      if (owner) cogidos.add(owner);
      return { id: b.id || `balon_${i + 1}`, x: rd(b.x), y: rd(b.y), en_manos_de: owner };
    });
}

function conosDe(posiciones = []) {
  return posiciones
    .filter((e) => e && e.kind === 'cono')
    .map((c, i) => ({ id: c.id || `cono_${i + 1}`, funcion: c.funcion || 'decorativo', x: rd(c.x), y: rd(c.y) }));
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}

/** Extrae el primer objeto JSON de un texto (tolera fences ```json). */
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  return JSON.parse(body.slice(start, end + 1));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(500, { error: 'Falta ANTHROPIC_API_KEY en el servidor.' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Cuerpo JSON inválido.' }); }

  const { texto = '', posiciones = [], pista = 'entera', respuestas = null, posiciones_custom = null } = payload;

  const messages = [];
  for (const ej of EJEMPLOS) {
    messages.push({ role: 'user', content: JSON.stringify(ej.user) });
    messages.push({ role: 'assistant', content: JSON.stringify(ej.assistant) });
  }
  const jugadores = jugadoresDe(posiciones);
  messages.push({
    role: 'user',
    content: JSON.stringify({
      texto,
      pista,
      canastas_validas: BASKET_KEYS[pista] || BASKET_KEYS.entera,
      posiciones_validas: POSICION_KEYS[pista] || POSICION_KEYS.entera,
      // nombres que ESTE entrenador ya definió con un clic (Supabase, por
      // pista): el modelo puede emitirlos en "hacia" igual que los estándar.
      posiciones_custom: Array.isArray(posiciones_custom) ? posiciones_custom.slice(0, 50) : [],
      jugadores,
      // el modelo ahora VE el balón (Tramo 3a): posición + en_manos_de.
      balones: balonesDe(posiciones, jugadores),
      conos: conosDe(posiciones),
      respuestas,
    }),
  });

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        // Techo MEDIDO (Tramo 3b): un intent 5v5 con todos los campos pesa
        // ≈3.4k chars (~1.0k tokens) a 3 fases, ≈2.0k tokens a 6 fases y
        // ≈2.7k a 8 — el techo viejo (2000) cortaba un 5v5 multifase. Con
        // 4096 cabe un 5v5 de ~12 fases con margen; si aún así se corta,
        // stop_reason === 'max_tokens' lo detecta abajo y se devuelve un
        // error accionable, nunca un JSON truncado parseado a medias.
        max_tokens: 4096,
        system: SYSTEM,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json(502, { error: `La IA respondió con error (${res.status}).`, detail: detail.slice(0, 300) });
    }

    const data = await res.json();
    // Respuesta CORTADA por el techo de tokens (Tramo 3b): el JSON viene
    // incompleto — parsearlo "con suerte" produciría una jugada a medias.
    // Error accionable y fuera.
    if (data && data.stop_reason === 'max_tokens') {
      return json(200, { error: 'La jugada es demasiado larga para interpretarla de una vez: divídela en menos fases o simplifica la descripción y vuelve a generar.' });
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    let parsed = null;
    try { parsed = extractJson(text); } catch { /* JSON roto: cae al error de abajo */ }
    // Forma mínima exigida; la validación fina (ids, canasta, coords) la hace
    // el cliente (taller/js/ia/validador.js), que puede reparar con warnings.
    if (!parsed || (!parsed.intent && !parsed.preguntas && !parsed.error)) {
      return json(200, { error: 'No pude interpretar la respuesta de la IA. Detalla más el ejercicio y regenera.' });
    }
    return json(200, parsed);
  } catch (err) {
    return json(502, { error: 'No se pudo contactar con la IA.', detail: String(err).slice(0, 200) });
  }
};
