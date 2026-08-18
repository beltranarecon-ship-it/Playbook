/* ============================================================
   ia/acciones.js — EL CATÁLOGO DE ACCIONES (Tramo 2.5).

   Módulo PURO: sin DOM, sin red, sin supabase. Define las cinco
   familias, el catálogo del sistema, cómo se valida una acción nueva
   y cómo se resuelve un nombre escrito a mano. Lo importan el
   compilador (2.6), el paso 2 (2.9), el linter y los bancos Node.

   ── POR QUÉ EXISTE ──────────────────────────────────────────
   El motor tenía NUEVE eventos escritos a fuego en el compilador:
   bote, corte, pase, tiro, bloqueo, defiende, rodea_cono,
   vuelve_a_fila y recoge. Añadir «puerta atrás» o «eurostep» exigía
   tocar el compilador; un entrenador no podía añadir nada.

   Aquí una acción es un DATO: un nombre puesto a una configuración
   de una de las cinco familias. El compilador deja de conocer verbos
   y pasa a saber resolver cinco cosas. Cualquier entrenador crea
   acciones y las ve todo el club.

   Y es el mismo vocabulario que etiqueta el ejercicio, que apunta un
   objetivo y que da las filas de la rúbrica: una acción es una sola
   palabra que significa lo mismo en los cuatro sitios.

   ── LO QUE ESTE MODELO HACE IMPOSIBLE ───────────────────────
   El error más caro de la biblioteca fue que trece fichas llamadas
   «entrada» soltaban el balón a dos, cuatro y hasta nueve metros del
   aro. La causa: `hacia` mezclaba tres cosas distintas bajo la misma
   forma — 'canasta' avanzaba UN TROZO hacia el aro, 'aro' LLEGABA
   hasta él, y un {x,y} iba a un sitio concreto. Escribir 'canasta'
   donde tocaba 'aro' no era un error detectable: era otra palabra
   igual de válida.

   Aquí eso se parte en dos parámetros independientes —a DÓNDE va
   (`destino`) y CUÁNTO se acerca (`alcance`)—, así que la confusión
   deja de poder escribirse. El linter que caza la recaída sigue
   estando, pero ya no es la única defensa.
   ============================================================ */

import { validarVideo, normalizarVideo } from './video.js';

/* ── 1. Las cinco familias ─────────────────────────────────── */

/*
   Cada familia declara los HUECOS que el motor sabe rellenar. Una
   acción del catálogo no inventa huecos: elige una familia y decide
   qué pone en cada uno y qué deja que se pregunte al usarla.

   Los parámetros son siempre RELATIVOS —«hacia el aro», «al siguiente
   cono», «a quien lleva el balón»— y nunca coordenadas. Una acción
   tiene que valer en las cuatro pistas y con el tablero movido.
*/

/** Cosas a las que un parámetro puede apuntar. */
export const REFERENCIAS = [
  'aro',            // la canasta a la que ataca el ejercicio
  'posicion',       // ancla con nombre o punto guardado por el entrenador
  'jugador',        // otro jugador del tablero (o de una fila)
  'elemento',       // un cono, una escalera, una pelota
  'balon',          // un balón concreto
  'fila_propia',    // el final de la cola de la que salió
  'zona',           // una zona dibujada en el paso 1 (Tramo 2.7)
  'punto',          // un punto suelto de la pista
];

export const FAMILIAS = {
  desplazamiento: {
    nombre: 'Desplazamiento',
    resuelve: 'Lleva a un jugador de donde está hasta un destino.',
    ejemplos: 'se mueve, corte, sprint, rodea, pasos laterales, vuelve a la fila, puerta atrás, aclarado',
    parametros: {
      destino: { tipo: 'referencia', admite: ['aro', 'posicion', 'jugador', 'elemento', 'balon', 'fila_propia', 'zona', 'punto'], requerido: true },
      // A DÓNDE va y CUÁNTO se acerca son cosas distintas. Ver la
      // cabecera: mezclarlas costó trece fichas.
      alcance: { tipo: 'opcion', valores: ['completo', 'parcial', 'pegado'], porDefecto: 'completo' },
      avance: { tipo: 'fraccion', porDefecto: 0.5, soloSi: { alcance: 'parcial' } },
      separacion: { tipo: 'metros', porDefecto: 1.1, soloSi: { alcance: 'pegado' } },
      trayectoria: { tipo: 'opcion', valores: ['recta', 'curva', 'rodeo', 'zigzag'], porDefecto: 'recta' },
      // qué se sortea por el camino; solo con trayectoria de rodeo o zigzag
      sorteando: { tipo: 'lista_referencias', admite: ['elemento', 'jugador'], porDefecto: [] },
      ritmo: { tipo: 'opcion', valores: ['normal', 'sprint', 'lateral', 'espalda'], porDefecto: 'normal' },
    },
  },

  balon: {
    nombre: 'Sobre el balón',
    resuelve: 'Mueve el balón entre jugadores, al aro o al suelo.',
    ejemplos: 'pasa, tiro, entrada, suelta, recoge, rebote',
    parametros: {
      modo: { tipo: 'opcion', valores: ['pase', 'tiro', 'suelta', 'recoge'], requerido: true },
      destino: { tipo: 'referencia', admite: ['jugador', 'aro', 'posicion', 'punto'], requerido: false },
      balon: { tipo: 'referencia', admite: ['balon'], requerido: false },   // sin él, el que lleva o el suelto más cercano
      separacion: { tipo: 'metros', porDefecto: 0.9, soloSi: { modo: 'recoge' } },
    },
  },

  entre_dos: {
    nombre: 'Entre dos jugadores',
    resuelve: 'Coloca a uno respecto del otro y dibuja el símbolo de la relación.',
    ejemplos: 'bloqueo, defiende, ayuda, robo, corte de pase, superar al defensor',
    parametros: {
      companero: { tipo: 'referencia', admite: ['jugador'], requerido: false },  // sin él: cuenta el rol pero no se mueve
      // Destino explícito, que manda sobre la colocación. Es como se
      // escribe una AYUDA: el defensor no va contra su par, va a tapar un
      // hueco. Sin este hueco, una ayuda sin par al que marcar no movía a
      // nadie y la fase salía vacía.
      destino: { tipo: 'referencia', admite: ['aro', 'posicion', 'jugador', 'punto', 'zona'], requerido: false },
      colocacion: { tipo: 'opcion', valores: ['goal_side', 'linea_de_pase', 'al_lado', 'delante', 'ninguna'], porDefecto: 'goal_side' },
      avance: { tipo: 'fraccion', porDefecto: 0.25 },   // cuánto recorre hacia esa colocación
      simbolo_relacion: { tipo: 'opcion', valores: ['bloqueo', 'marca', 'ninguno'], porDefecto: 'ninguno' },
      rol: { tipo: 'opcion', valores: ['atacante', 'defensor', 'sin_cambio'], porDefecto: 'sin_cambio' },
    },
  },

  gesto: {
    nombre: 'Gesto en el sitio',
    resuelve: 'Una acción sin desplazamiento neto: acaba donde empezó.',
    ejemplos: 'finta, eurostep, cambio de mano, pivote, salta',
    parametros: {
      duracion_ms: { tipo: 'ms', porDefecto: 700 },
      // amplitud del amago, en metros: lo que se separa y vuelve
      amplitud: { tipo: 'metros', porDefecto: 0.8 },
      hacia: { tipo: 'referencia', admite: ['aro', 'jugador', 'posicion', 'punto'], requerido: false },
      simbolo_gesto: { tipo: 'opcion', valores: ['ninguno', 'amago', 'giro', 'salto'], porDefecto: 'ninguno' },
    },
  },

  simulacion: {
    nombre: 'Simulación N contra M',
    resuelve: 'Una secuencia corta y legible, con el desenlace declarado en un cartel.',
    ejemplos: '1vs1, 2vs1, 2vs2, 3vs2 · gana ataque / gana defensa',
    parametros: {
      atacantes: { tipo: 'lista_referencias', admite: ['jugador'], requerido: true },
      defensores: { tipo: 'lista_referencias', admite: ['jugador'], porDefecto: [] },
      desenlace: { tipo: 'opcion', valores: ['gana_ataque', 'gana_defensa', 'abierto'], porDefecto: 'abierto' },
      semilla: { tipo: 'entero', porDefecto: 1 },   // el simulador es determinista: misma semilla, misma jugada
    },
  },
};

export const FAMILIA_KEYS = Object.keys(FAMILIAS);

/* ── 2. El catálogo del sistema ────────────────────────────── */

/*
   Las nueve acciones que el motor traía escritas a fuego, ahora
   expresadas como datos. Viven en CÓDIGO y no en la base de datos a
   propósito, por lo mismo que las anclas: son el vocabulario mínimo
   sin el que el Taller no funciona, y tiene que estar disponible sin
   una llamada de red. Las que cree el club se cargan aparte y se
   fusionan encima (fusionarCatalogo).

   `_legado` es la equivalencia con el evento antiguo. Existe para que
   la recompilación de las 204 fichas (2.6) sea mecánica y demostrable,
   no una reinterpretación a mano. Un banco de pruebas comprueba que
   los nueve están cubiertos y que ninguno sobra.
*/

/*
   `tag` es el puente del VOCABULARIO ÚNICO: la palabra con la que esta
   misma acción aparece como etiqueta de un ejercicio, como diana de un
   objetivo y como fila de la rúbrica. Vale el tag exacto o su raíz —
   «bloqueo» cubre «bloqueo directo» y «bloqueo indirecto», porque cuál
   de los dos sea es una propiedad del EJERCICIO, no del movimiento.

   `tag: null` se pone a propósito y significa «esto es mecánica del
   motor, no un concepto de baloncesto»: rodear un cono y volver a la
   cola no son nada que evaluar en un jugador. Es una decisión
   declarada, no un olvido, y el banco de pruebas la exige explícita.
*/
/*
   `simbolo` NO es decorativo: es el `tipo_movimiento` que el motor sabe
   dibujar ('carrera_con_balon', 'corte', 'carrera_sin_balon') o el tipo
   de acción ('pase', 'tiro', 'bloqueo'). Y de él sale una regla que
   antes estaba escrita a fuego: quien se desplaza con `carrera_con_balon`
   coge un balón si no lo tiene. Botar exige balón.
*/
const A = (a) => ({ sinonimos: [], pide: [], video: null, origen: 'sistema', ...a });

export const CATALOGO_SISTEMA = [
  A({
    slug: 'bota', nombre: 'Bota', familia: 'desplazamiento', _legado: 'bote', tag: 'bote',
    sinonimos: ['bote', 'botar', 'conduce', 'conducir', 'avanza botando', 'sale botando', 'avanza'],
    descripcion: 'Avanza con el balón hacia donde se le diga. El balón va con él: no hace falta decirlo.',
    parametros: { destino: null, alcance: 'parcial', avance: 0.55, trayectoria: 'recta', ritmo: 'normal' },
    pide: ['destino'],
    simbolo: 'carrera_con_balon',
  }),
  A({
    slug: 'entra', nombre: 'Entra a canasta', familia: 'desplazamiento', _legado: 'bote', tag: 'entrada',
    sinonimos: ['entrada', 'penetra', 'ataca el aro', 'doble ritmo', 'bandeja'],
    // La razón de ser de esta entrada del catálogo: 'entra' LLEGA al aro
    // y se para a la distancia de apoyo. Es la que faltaba, y por no
    // tenerla se escribía 'bote hacia canasta', que avanza un trozo y
    // deja la entrada convertida en un tiro de media distancia.
    descripcion: 'Llega hasta el aro y se para donde se apoya para subir. No es «avanzar hacia canasta».',
    parametros: { destino: 'aro', alcance: 'pegado', separacion: 1.1, trayectoria: 'recta', ritmo: 'normal' },
    pide: [],
    simbolo: 'carrera_con_balon',
  }),
  A({
    slug: 'corta', nombre: 'Corta', familia: 'desplazamiento', _legado: 'corte', tag: 'corte',
    sinonimos: ['corte', 'cortar', 'se mueve', 'va a', 'desmarque', 'corre', 'correr', 'sprinta', 'se desplaza'],
    descripcion: 'Se desplaza sin balón hasta el destino.',
    parametros: { destino: null, alcance: 'parcial', avance: 0.3, trayectoria: 'recta', ritmo: 'normal' },
    pide: ['destino'],
    simbolo: 'corte',
  }),
  A({
    slug: 'rodea', nombre: 'Rodea', familia: 'desplazamiento', _legado: 'rodea_cono', tag: null,
    sinonimos: ['rodear', 'sortea', 'slalom', 'zigzag', 'esquiva'],
    // Antes era un evento SUELTO que había que declarar aparte del
    // desplazamiento, y que el compilador tejía dentro de su camino. Si
    // había conos pero nadie escribía el rodeo, el jugador iba en línea
    // recta y se los saltaba, y la ficha prometía un slalom que la
    // animación no enseñaba. Aquí el rodeo ES la trayectoria.
    descripcion: 'El mismo desplazamiento, pero sorteando lo que se le indique.',
    parametros: { destino: null, alcance: 'completo', trayectoria: 'rodeo', sorteando: [], ritmo: 'normal' },
    pide: ['destino', 'sorteando'],
    simbolo: 'carrera_con_balon',
  }),
  A({
    slug: 'vuelve_a_fila', nombre: 'Vuelve a la fila', familia: 'desplazamiento', _legado: 'vuelve_a_fila', tag: null,
    sinonimos: ['vuelve a la cola', 'vuelve', 'a la fila', 'regresa'],
    descripcion: 'Corre hasta el final de la cola de la que salió. Es lo que cierra un ejercicio de fila.',
    parametros: { destino: 'fila_propia', alcance: 'completo', trayectoria: 'recta', ritmo: 'normal' },
    pide: [],
    simbolo: 'carrera_sin_balon',
  }),
  A({
    slug: 'pasa', nombre: 'Pasa', familia: 'balon', _legado: 'pase', tag: 'pase',
    sinonimos: ['pase', 'pasar', 'da el balón', 'sirve', 'devuelve'],
    descripcion: 'Manda el balón a un compañero.',
    parametros: { modo: 'pase', destino: null, balon: null },
    pide: ['destino'],
    simbolo: 'pase',
  }),
  A({
    slug: 'tira', nombre: 'Tira', familia: 'balon', _legado: 'tiro', tag: 'tiro',
    sinonimos: ['tiro', 'tirar', 'lanza', 'lanzamiento', 'tira a canasta'],
    descripcion: 'El balón sale hacia el centro del aro.',
    parametros: { modo: 'tiro', destino: 'aro', balon: null },
    pide: [],
    simbolo: 'tiro',
  }),
  A({
    slug: 'recoge', nombre: 'Recoge', familia: 'balon', _legado: 'recoge', tag: 'rebote',
    sinonimos: ['recoger', 'coge el balón', 'rebote', 'rebotea', 'va a por el balón'],
    descripcion: 'Va a por un balón suelto y se lo queda. Sin esto, tras un tiro el balón se queda en el aro para siempre.',
    parametros: { modo: 'recoge', balon: null, separacion: 0.9 },
    pide: [],
    // el jugador corre sin balón hasta él; el tramo que hace el BALÓN
    // hasta sus manos lo emite el compilador aparte, como 'recogida'
    simbolo: 'carrera_sin_balon',
  }),
  A({
    slug: 'bloquea', nombre: 'Bloquea', familia: 'entre_dos', _legado: 'bloqueo', tag: 'bloqueo',
    sinonimos: ['bloqueo', 'pone un bloqueo', 'cortina'],
    descripcion: 'Se planta al lado del defensor del compañero para dejarle salir.',
    // `colocacion: 'ninguna'` dice la verdad de lo que hace hoy el motor:
    // al bloqueador lo coloca el entrenador en el paso 1 y el motor solo
    // dibuja la relación. Moverlo solo hasta el defensor del compañero es
    // una mejora posible, pero sería inventar movimiento que nadie pidió.
    parametros: { companero: null, colocacion: 'ninguna', avance: 0.25, simbolo_relacion: 'bloqueo', rol: 'sin_cambio' },
    pide: ['companero'],
    simbolo: 'bloqueo',
  }),
  A({
    slug: 'defiende', nombre: 'Defiende', familia: 'entre_dos', _legado: 'defiende', tag: 'defensa individual',
    sinonimos: ['defensa', 'marca', 'marcar', 'defender', 'ayuda'],
    descripcion: 'Se coloca entre su par y el aro. Sin par al que marcar, cuenta como defensor y no se mueve.',
    parametros: { companero: null, colocacion: 'goal_side', avance: 0.25, simbolo_relacion: 'marca', rol: 'defensor' },
    pide: ['companero'],
    simbolo: 'carrera_sin_balon',
  }),
];

/** Los nueve eventos del motor anterior. El banco comprueba la cobertura. */
export const EVENTOS_LEGADO = [
  'bote', 'corte', 'pase', 'tiro', 'bloqueo', 'defiende', 'rodea_cono', 'vuelve_a_fila', 'recoge',
];

/* ── 3. Validación ─────────────────────────────────────────── */

const SLUG_OK = /^[a-z][a-z0-9_]{1,39}$/;

/**
 * Comprueba que una acción es utilizable ANTES de guardarla. Es la
 * defensa del compilador: en cuanto cualquier entrenador puede crear
 * vocabulario, el compilador deja de poder confiar en que los verbos
 * que le llegan los escribió alguien que conoce el motor.
 *
 * @returns { ok, errores: string[] }
 */
export function validarAccion(a) {
  const errores = [];
  const E = (m) => errores.push(m);

  if (!a || typeof a !== 'object') return { ok: false, errores: ['no es un objeto'] };
  if (!SLUG_OK.test(String(a.slug ?? ''))) E(`slug "${a.slug}" inválido (minúsculas, números y _, de 2 a 40)`);
  if (!String(a.nombre ?? '').trim()) E('falta el nombre');

  const fam = FAMILIAS[a.familia];
  if (!fam) { E(`familia "${a.familia}" desconocida (${FAMILIA_KEYS.join(', ')})`); return { ok: false, errores }; }

  const params = a.parametros && typeof a.parametros === 'object' ? a.parametros : {};
  const pide = Array.isArray(a.pide) ? a.pide : [];

  for (const k of Object.keys(params)) {
    if (!fam.parametros[k]) E(`parámetro "${k}" no existe en la familia ${a.familia}`);
  }
  for (const p of pide) {
    if (!fam.parametros[p]) E(`"${p}" está en \`pide\` y no es un parámetro de ${a.familia}`);
  }

  for (const [k, def] of Object.entries(fam.parametros)) {
    const declarado = k in params;
    const v = params[k];
    // requerido: o lo fija la acción, o lo pregunta al usarla
    if (def.requerido && !pide.includes(k) && (!declarado || v == null)) {
      E(`"${k}" es obligatorio en ${a.familia}: fíjalo o ponlo en \`pide\``);
    }
    if (!declarado || v == null) continue;
    if (def.tipo === 'opcion' && !def.valores.includes(v)) {
      E(`"${k}" = "${v}" no está entre ${def.valores.join(' | ')}`);
    }
    if (def.tipo === 'fraccion' && !(typeof v === 'number' && v > 0 && v <= 1)) {
      E(`"${k}" tiene que ser una fracción entre 0 y 1; llegó ${JSON.stringify(v)}`);
    }
    if ((def.tipo === 'metros' || def.tipo === 'ms' || def.tipo === 'entero') && !(typeof v === 'number' && v >= 0)) {
      E(`"${k}" tiene que ser un número no negativo; llegó ${JSON.stringify(v)}`);
    }
    if (def.tipo === 'referencia' && typeof v !== 'string') {
      E(`"${k}" tiene que ser una referencia por nombre, no ${JSON.stringify(v)}`);
    }
    if (def.tipo === 'lista_referencias' && !Array.isArray(v)) {
      E(`"${k}" tiene que ser una lista`);
    }
  }

  /* El vídeo de referencia (Tramo 2.14). Se valida aquí y no solo al
     pegarlo porque una acción del club llega de la base de datos, donde
     el `jsonb` solo garantiza que es un objeto: un vídeo con la forma
     rota no falla al guardarlo, falla proyectado en la pared. */
  for (const m of validarVideo(a.video ?? null).errores) E(`vídeo: ${m}`);

  // Un parámetro con `soloSi` sin su condición no rompe nada, pero es una
  // señal de que la acción se copió de otra y quedó a medias.
  for (const [k, def] of Object.entries(fam.parametros)) {
    if (!def.soloSi || !(k in params)) continue;
    for (const [dep, valor] of Object.entries(def.soloSi)) {
      if (params[dep] !== valor && !pide.includes(dep)) {
        E(`"${k}" solo tiene sentido con ${dep} = "${valor}", y aquí ${dep} vale "${params[dep]}"`);
      }
    }
  }

  return { ok: !errores.length, errores };
}

/* ── 4. Resolver un nombre escrito a mano ──────────────────── */

/** minúsculas, sin tildes, sin signos, sin artículos. */
export function normalizarNombre(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

const RELLENO = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'a', 'en', 'se', 'y']);
const sinRelleno = (s) => normalizarNombre(s).split(' ').filter((t) => t && !RELLENO.has(t)).join(' ');

/**
 * Índice nombre→acción de un catálogo. Se construye una vez y se
 * consulta muchas: el paso 2 resuelve cada palabra que se escribe.
 */
export function indexar(catalogo) {
  const idx = new Map();
  for (const a of catalogo) {
    for (const n of [a.slug, a.nombre, ...(a.sinonimos || [])]) {
      const k = sinRelleno(n);
      if (k && !idx.has(k)) idx.set(k, a);
    }
  }
  return idx;
}

/**
 * Resuelve un texto contra el catálogo. Devuelve null si no lo
 * reconoce — y eso NO es un fallo: el paso 2 preguntará, igual que
 * hace con una posición que no conoce.
 */
export function resolverAccion(texto, idx) {
  const k = sinRelleno(texto);
  if (!k) return null;
  if (idx.has(k)) return idx.get(k);
  // la frase entera no casa: se prueba con el trozo más largo que sí
  const tokens = k.split(' ');
  for (let n = tokens.length - 1; n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const sub = tokens.slice(i, i + n).join(' ');
      if (idx.has(sub)) return idx.get(sub);
    }
  }
  return null;
}

/* ── 5. Fusión con lo que crea el club ─────────────────────── */

/**
 * Une el catálogo del sistema con las acciones que ha creado el club.
 * Los slugs del sistema están RESERVADOS: una acción de club que use
 * uno se descarta y se dice por qué. Redefinir «tira» en silencio
 * cambiaría el significado de las 204 fichas de la biblioteca.
 *
 * @returns { acciones, descartadas: [{accion, motivo}] }
 */
export function fusionarCatalogo(club = []) {
  const acciones = [...CATALOGO_SISTEMA];
  const usados = new Set(acciones.map((a) => a.slug));
  const descartadas = [];
  for (const a of club) {
    const { ok, errores } = validarAccion(a);
    if (!ok) { descartadas.push({ accion: a, motivo: errores.join('; ') }); continue; }
    if (usados.has(a.slug)) { descartadas.push({ accion: a, motivo: `el slug "${a.slug}" es del sistema y no se puede redefinir` }); continue; }
    usados.add(a.slug);
    acciones.push({ ...a, origen: 'club' });
  }
  return { acciones, descartadas };
}

/**
 * El catálogo con los vídeos de referencia puestos (Tramo 2.14).
 *
 * ── POR QUÉ NO BASTA CON `acciones.video` ───────────────────
 * Las diez acciones del sistema viven en CÓDIGO y sus slugs están
 * reservados: nadie puede crear una fila «entra» en la tabla, y con
 * razón —redefinir «entra» cambiaría las 204 fichas de golpe—. Pero
 * «entra» es justo la acción a la que un entrenador quiere colgarle el
 * vídeo del doble ritmo. Así que el vídeo se guarda aparte, por slug
 * (migración 021), y se pega aquí encima.
 *
 * Manda lo asignado por slug sobre lo que trajera la acción: es el acto
 * más reciente y más explícito de alguien que ha ido a ponerlo.
 *
 * @param acciones        catálogo ya fusionado (sistema + club)
 * @param videosPorSlug   { slug: video } de la tabla `videos_accion`
 */
export function conVideos(acciones = [], videosPorSlug = {}) {
  const v = videosPorSlug && typeof videosPorSlug === 'object' ? videosPorSlug : {};
  return acciones.map((a) => {
    const puesto = normalizarVideo(v[a.slug]);
    const propio = normalizarVideo(a.video);
    const video = puesto || propio || null;
    return video === a.video ? a : { ...a, video };
  });
}

/** Valor efectivo de un parámetro: lo que fija la acción, o el de la familia. */
export function parametroDe(accion, clave) {
  const def = FAMILIAS[accion.familia]?.parametros?.[clave];
  if (!def) return undefined;
  const v = accion.parametros?.[clave];
  return v === undefined || v === null ? def.porDefecto : v;
}
