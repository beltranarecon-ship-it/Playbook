/* ============================================================
   vocabulario.mjs — contrato de datos de la biblioteca.

   Módulo PURO y sin dependencias: lo importan el linter, el
   importador y los bancos de pruebas. Es la fuente única de verdad
   de qué valores son legales en una ficha; si algo no está aquí, el
   linter lo rechaza.

   Por qué existe: 200 fichas escritas en tandas a lo largo de
   semanas derivan solas. La tanda 8 acaba etiquetando "tiro libre"
   donde la tanda 2 puso "tiros libres", y entonces el motor de
   sugerencias —que puntúa +3 por coincidencia de tag— deja de
   encontrar la mitad de la biblioteca. Un vocabulario controlado no
   es burocracia: es lo que hace que el planificador siga acertando
   cuando la biblioteca crece.
   ============================================================ */

/* ---- 1 · Taxonomía que YA usa el Taller (no se reinventa) ------
   Viene de taller/js/config.js. Se replica aquí porque este módulo
   tiene que poder correr en Node sin arrastrar el front, pero el
   dueño del vocabulario sigue siendo el Taller: si allí cambia,
   aquí también. */

export const TIPOS = [
  'Tiro', 'Bote', 'Pase', '1vs1', '2vs2', '3vs3', '4vs4', '5vs5',
  'Contraataque', 'Defensa', 'Calentamiento', 'Físico',
  'Situaciones especiales', 'Otro',
];

export const RAMAS = ['Minibasket', 'Basket'];

export const NIVELES = {
  Minibasket: ['Escuela', 'Benjamín', 'Alevín'],
  Basket: ['Infantil', 'Cadete', 'Junior'],
};

export const TODOS_LOS_NIVELES = [...NIVELES.Minibasket, ...NIVELES.Basket];

export const PISTAS = ['entera', 'media', 'entera_fiba', 'media_fiba'];

/* ---- 2 · Bloques de contenido ---------------------------------
   Van a la columna `category`. OJO: hoy el Taller guarda ahí la
   RAMA ('Minibasket'), que no es una categoría de contenido y hace
   que el filtro de la biblioteca no case nunca con nada. La
   biblioteca importada guarda aquí el bloque de contenido, que es
   lo que el filtro espera semánticamente, y el filtro se arregla en
   el Bloque C. La rama sigue viviendo en `categoria_rama`. */

export const BLOQUES = [
  { key: 'manejo',          label: 'Manejo y coordinación',   nota: 'Familiarización, motricidad y control del balón' },
  { key: 'bote',            label: 'Bote',                    nota: 'Control, avance, cambios y bote con oposición' },
  { key: 'pase',            label: 'Pase y recepción',        nota: 'Gesto, tiempo y decisión de pasar' },
  { key: 'tiro',            label: 'Tiro',                    nota: 'Mecánica, tiro tras recepción y tras bote' },
  { key: 'entrada',         label: 'Entrada a canasta',       nota: 'Doble ritmo, paradas y finalizaciones' },
  { key: 'juego-de-pies',   label: 'Juego de pies',           nota: 'Paradas, pivotes, salidas y fintas' },
  { key: '1c1',             label: '1c1',                     nota: 'Con balón, sin balón y defensivo' },
  { key: 'juego-de-2',      label: 'Juego de dos',            nota: 'Pasar y cortar, aclarado, bloqueos' },
  { key: 'contraataque',    label: 'Contraataque y transición', nota: 'Carriles, superioridades, balance' },
  { key: 'defensa',         label: 'Defensa',                 nota: 'Individual, línea de pase, ayudas' },
  { key: 'rebote',          label: 'Rebote',                  nota: 'Bloqueo de rebote, ofensivo y defensivo' },
  { key: 'juego-reducido',  label: 'Juego reducido',          nota: 'Formatos con reglas y competiciones' },
  { key: 'calentamiento',   label: 'Calentamiento',           nota: 'Activación con balón' },
  { key: 'psicomotricidad', label: 'Psicomotricidad',         nota: 'Escuela: lateralidad, equilibrio, ritmo' },
];

export const BLOQUE_KEYS = BLOQUES.map((b) => b.key);

/* ---- 3 · Tags conceptuales ------------------------------------
   El campo de MÁS palanca de todo el sistema: sugerencias.js puntúa
   +3 por tag frente a +2 por nombre y +1 por descripción, y DESCARTA
   por debajo de 2. Un tag mal escrito no es un detalle estético:
   saca al ejercicio de las sugerencias del planificador.

   Regla de escritura: minúsculas, con tilde, singular, sin guiones
   salvo que el término los lleve. `tokeniza()` normaliza tildes al
   comparar, así que la tilde no rompe la búsqueda; se conserva
   porque el tag también se le ENSEÑA al entrenador. */

export const TAGS = [
  // gesto y técnica individual
  'bote', 'cambio de mano', 'cambio de dirección', 'cambio de ritmo',
  'bote de protección', 'mano no dominante', 'cabeza levantada',
  'pase', 'recepción', 'pase de pecho', 'pase picado', 'pase de béisbol',
  'tiro', 'mecánica de tiro', 'tiro tras recepción', 'tiro tras bote',
  'tiro libre', 'entrada', 'doble ritmo', 'bandeja', 'finalización',
  'parada', 'pivote', 'salida en bote', 'finta',
  // juego individual
  '1c1', 'desmarque', 'corte', 'puerta atrás', 'aclarado',
  'lectura', 'toma de decisiones', 'ventaja',
  // juego colectivo
  'pasar y cortar', 'espaciado', 'bloqueo directo', 'bloqueo indirecto',
  'continuación', 'superioridad', 'inferioridad',
  'contraataque', 'transición', 'balance defensivo', 'carriles',
  // defensa
  'defensa individual', 'postura defensiva', 'desplazamiento defensivo',
  // Concepto propio, distinto de 'defensa individual' y de 'línea de
  // pase': con D22 el núcleo mini NO niega el pase, así que lo que se
  // enseña es colocarse viendo a la vez al par y al balón.
  'defensa sin balón',
  'línea de pase', 'ayuda', 'recuperación', 'defensa del bote',
  'rebote defensivo', 'rebote ofensivo', 'bloqueo de rebote',
  // formato y método
  'juego reducido', 'competición', 'calentamiento', 'activación',
  'coordinación', 'lateralidad', 'equilibrio', 'ritmo',
  'analítico', 'series', 'oposición',
];

/* ---- 4 · Ejes de la rúbrica -----------------------------------
   Se guardan como DATO en requisitos (jsonb), no como opinión en
   un texto, para que se puedan filtrar y auditar. */

/**
 * Densidad = acciones útiles por JUGADOR y MINUTO (contactos con
 * balón, tiros o decisiones). Es el indicador que más separa un buen
 * ejercicio de formación de uno malo: doce niños, un balón y una
 * fila suena bien y no entrena a nadie.
 */
export const DENSIDAD = {
  alta:  { min: 4,   label: 'Alta',  nota: '4 o más acciones por jugador y minuto' },
  media: { min: 2,   label: 'Media', nota: 'entre 2 y 4' },
  baja:  { min: 0,   label: 'Baja',  nota: 'menos de 2 — exige justificación explícita' },
};
export const DENSIDAD_KEYS = Object.keys(DENSIDAD);

/** Cuánta oposición real hay. Un ejercicio que se vende como táctico y no tiene a nadie enfrente es un ejercicio mal clasificado. */
export const OPOSICION = ['nula', 'pasiva', 'semiactiva', 'real'];

/* ---- 5 · Forma de `requisitos` (jsonb) ------------------------
   Todo lo estructurado de la ficha vive aquí. Se eligió jsonb en vez
   de columnas nuevas porque la columna YA existe (migración 002) y
   así la biblioteca no necesita ninguna migración para arrancar. */

export const REQUISITOS_OBLIGATORIOS = [
  'jugadores_min',     // number — con menos de esto el ejercicio no se puede montar
  'jugadores_max',     // number — a partir de aquí hay que duplicar la estación
  'canastas',          // number 0..2
  'material',          // string[] — 'conos', 'petos', 'aros', 'balones'…
  'densidad',          // 'alta' | 'media' | 'baja'
  'oposicion',         // 'nula' | 'pasiva' | 'semiactiva' | 'real'
  'requisito_previo',  // string — QUÉ hay que saber hacer ya. NUNCA una edad.
  'dosis',             // { series, cantidad, unidad, descanso } — ver DOSIS_UNIDADES
  'criterio_exito',    // string — cuándo está bien hecho y cómo se compite
];

/**
 * Unidad de la dosis. Salió del piloto: en un juego continuo como un
 * pilla-pilla, "90" no son noventa repeticiones sino noventa segundos
 * de juego, y tratarlo como repeticiones hacía que el linter calculara
 * seis minutos de trabajo donde hay minuto y medio.
 *
 * `segundosPorRepeticion` es lo que se estima que dura UNA repetición
 * discreta: sirve para comprobar que la dosis cabe en la duración
 * declarada, no para prescribir nada.
 */
export const DOSIS_UNIDADES = {
  repeticiones: { label: 'repeticiones', segundosPorRepeticion: 4 },
  segundos: { label: 'segundos de trabajo', segundosPorRepeticion: 1 },
};

/**
 * `simultaneo: true` = todos trabajan a la vez, cada uno con su balón
 * o en su espacio. No hay colas posibles, así que la comprobación de
 * fila larga (D5) no aplica. También salió del piloto.
 */
export const REQUISITOS_OPCIONALES = ['estaciones', 'simultaneo', 'aplicacion', 'justificacion_densidad'];

/**
 * Campos obligatorios SOLO en ciertos casos (DOCTRINA.md).
 *
 * `aplicacion` (D1): un ejercicio analítico debe declarar en qué formato de
 * juego se usa el patrón que entrena. La práctica bloqueada rinde mejor en la
 * sesión y peor en el partido — gana en adquisición y pierde en retención y
 * transferencia — así que el analítico se admite como PUERTA DE ENTRADA a un
 * contenido, nunca como el contenido entero. Sin aplicación declarada no entra.
 *
 * `justificacion_densidad` (D4): densidad baja solo se admite cuando el
 * ejercicio entrena algo que exige espera de verdad (un tiro libre con presión
 * de competición, por ejemplo). Se escribe, no se presupone.
 */
export const REQUISITOS_CONDICIONALES = [
  { campo: 'aplicacion', cuando: (r, tags) => (tags || []).includes('analítico'), porque: 'D1 · todo analítico declara dónde se aplica' },
  { campo: 'justificacion_densidad', cuando: (r) => r?.densidad === 'baja', porque: 'D4 · la densidad baja exige justificación explícita' },
];

/* ---- 6 · Los tres niveles de exigencia ------------------------
   El eje de la biblioteca NO es la edad: un mismo ejercicio sirve a
   un niño de 8 y a un cadete cambiando la exigencia. Por eso cada
   ficha lleva estos tres niveles en `variantes`, y `categoria_nivel`
   solo se acota cuando el ejercicio ES realmente específico. */

export const NIVELES_EXIGENCIA = ['base', 'intermedio', 'avanzado'];

/* ---- 7 · Ayudas ------------------------------------------------ */

export const esTagValido = (t) => TAGS.includes(t);
export const esBloqueValido = (b) => BLOQUE_KEYS.includes(b);
export const esNivelValido = (n) => TODOS_LOS_NIVELES.includes(n);

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'al', 'a', 'y', 'en', 'con', 'sin']);

/**
 * Palabras con peso de un término, sin tildes ni partículas.
 * "Tiros Libres" → ['tiros', 'libres'].
 */
function palabras(s) {
  return norm(s).split(/[^a-z0-9]+/).filter((w) => w && !VACIAS.has(w));
}

/**
 * Raíces POSIBLES de una palabra, no una sola. El plural español no
 * se quita con una regla: "libres"→"libre" pide cortar solo la -s,
 * pero "individuales"→"individual" pide cortar -es. Cortando por lo
 * sano se obtiene "libr" y se pierde la coincidencia.
 *
 * Se generan las tres formas y dos palabras se consideran la misma
 * si sus conjuntos se tocan. Es tosco y no necesita serlo más: esto
 * solo alimenta una SUGERENCIA para quien escribe la ficha.
 */
function raices(w) {
  const r = new Set([w]);
  if (w.endsWith('s')) r.add(w.slice(0, -1));
  if (w.endsWith('es')) r.add(w.slice(0, -2));
  return r;
}

const mismaPalabra = (a, b) => {
  const ra = raices(a);
  for (const x of raices(b)) if (ra.has(x)) return true;
  return false;
};

/** Solape entre dos términos: palabras comunes sobre palabras totales. */
function solape(a, b) {
  const pa = palabras(a), pb = palabras(b);
  if (!pa.length || !pb.length) return 0;
  const usadas = new Set();
  let comunes = 0;
  for (const x of pa) {
    const i = pb.findIndex((y, j) => !usadas.has(j) && mismaPalabra(x, y));
    if (i >= 0) { usadas.add(i); comunes++; }
  }
  return comunes / (pa.length + pb.length - comunes);
}

/**
 * Tags que no están en el vocabulario, con el más parecido si lo hay.
 * Se puntúa por solape de raíces (intersección sobre unión), así que
 * "tiros libres" cae en "tiro libre" (1,0) y no en "tiro" (0,5).
 * La sugerencia es una PISTA para quien escribe la ficha, no un
 * autocorrector: el linter la enseña, no la aplica.
 */
export function tagsDesconocidos(tags) {
  return (tags || []).filter((t) => !esTagValido(t)).map((t) => {
    const exacto = TAGS.find((v) => norm(v) === norm(t));
    if (exacto) return { tag: t, sugerencia: exacto, puntuacion: 1 };

    let mejor = null, mejorP = 0;
    for (const v of TAGS) {
      const p = solape(t, v);
      if (p > mejorP) { mejorP = p; mejor = v; }
    }
    return { tag: t, sugerencia: mejorP >= 0.5 ? mejor : null, puntuacion: Number(mejorP.toFixed(2)) };
  });
}
