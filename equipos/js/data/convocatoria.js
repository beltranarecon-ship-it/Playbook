/* ============================================================
   convocatoria.js — LA CONVOCATORIA DEL PARTIDO.
   Módulo PURO: sin DOM, sin red. Lo que decide a quién se convoca, en
   qué grupo, qué falta y qué dice el documento.

   ── EL DOCUMENTO MANDA SOBRE EL MODELO ──────────────────────
   Esto no es una lista de gente: es el papel que el club cuelga en el
   grupo, y el papel tiene TRES grupos —CONVOCADOS, RESERVA,
   DESCANSO—, una cabecera fija del equipo y un bloque de
   desplazamiento. El modelo de datos es ese papel, no un invento
   nuestro que luego haya que traducir.

   ── EL TOPE DE 12 SE AVISA, NO SE IMPIDE ────────────────────
   «Solamente se podrán inscribir en acta oficial del partido a 12
   jugadores», y presentarse con menos de 10-12 se sanciona con 2-0 en
   contra aunque ganes el partido. Así que el número importa de verdad.
   Pero el miércoles, decidiendo, es normal tener catorce marcados: el
   tope se DICE, y quitar a un crío para meter a otro es una decisión
   del entrenador, no de la app.

   ── EL EVENTO SE DEDUCE, NO SE GUARDA ───────────────────────
   «Se crea sola como evento del calendario al añadir el partido»
   (§5.9). Se deduce del partido y del día de convocatoria del equipo,
   igual que el estado «activa» de una sesión se deduce del reloj
   (§5.6). Guardar un evento aparte obligaría a mantenerlo al día cada
   vez que se mueve un partido, y a la primera que se olvide el
   calendario enseña una convocatoria para un partido que ya no existe.

   ── LO QUE FALTA SE DICE, NO SE INVENTA ─────────────────────
   Una convocatoria a medias es normal el miércoles. Lo que no puede
   pasar es que salga un PDF con la mitad de los campos en blanco sin
   que nadie lo haya visto: por eso `loQueFalta` va delante del botón.
   ============================================================ */

/** Cuántos caben en un acta (regla 1 de minibasket, alevín y benjamín). */
export const CONVOCADOS_MAX = 12;

/** El mínimo de la fase de clasificación. Por debajo, 2-0 en contra. */
export const CONVOCADOS_MIN = 10;

/** Los tres grupos del documento, en el orden en que se imprimen. */
export const GRUPOS = ['convocados', 'reservas', 'descansan'];

/** Cómo se llama cada uno en el papel. */
export const GRUPO_LABEL = {
  convocados: 'Convocados',
  reservas: 'Reserva',
  descansan: 'Descanso',
};

/** La columna de `matches` de cada grupo. */
const COLUMNA = { convocados: 'convocados', reservas: 'reservas', descansan: 'descansan' };

const dosDigitos = (x) => String(x).padStart(2, '0');

/** Una lista de ids limpia: sin vacíos, sin repetidos, en su orden. */
function listaLimpia(bruto) {
  const vistos = new Set();
  const out = [];
  for (const id of Array.isArray(bruto) ? bruto : []) {
    const k = String(id ?? '').trim();
    if (k && !vistos.has(k)) { vistos.add(k); out.push(k); }
  }
  return out;
}

/** Los ids de un grupo del partido. */
export const grupoIds = (partido, grupo = 'convocados') =>
  listaLimpia(partido?.[COLUMNA[grupo] || 'convocados']);

/** La lista de convocados. Se conserva el nombre de siempre. */
export const convocadosDe = (partido) => grupoIds(partido, 'convocados');

/** Los tres grupos de una vez, ya limpios y sin solapes. */
export function gruposDe(partido) {
  /* Sin solapes y con prioridad por orden: si un id aparece en dos
     listas —que solo pasa con datos escritos a mano o por una carrera
     entre dos entrenadores—, manda el grupo de más arriba. Dejar al
     mismo niño en convocados y en descanso saca un papel que se
     contradice a sí mismo, y eso lo lee un padre. */
  const usados = new Set();
  const out = {};
  for (const g of GRUPOS) {
    out[g] = grupoIds(partido, g).filter((id) => !usados.has(id));
    for (const id of out[g]) usados.add(id);
  }
  return out;
}

/** En qué grupo está, o null si no está en ninguno. */
export function grupoDe(partido, playerId) {
  const k = String(playerId);
  const g = gruposDe(partido);
  for (const nombre of GRUPOS) if (g[nombre].includes(k)) return nombre;
  return null;
}

/** ¿Está convocado? (no cuenta reserva ni descanso) */
export const estaConvocado = (partido, playerId) => grupoDe(partido, playerId) === 'convocados';

/**
 * Mueve a un jugador a un grupo, o lo saca si ya estaba en ese mismo.
 * Devuelve los TRES grupos nuevos: un jugador solo puede estar en uno,
 * así que moverlo a un sitio es siempre quitarlo de otro.
 *
 * Al llegar al tope de convocados NO se desmarca a nadie por su cuenta:
 * se devuelven los grupos igual y quien llama decide qué decir.
 *
 * @returns {convocados, reservas, descansan}
 */
export function moverA(partido, playerId, grupo, { max = CONVOCADOS_MAX } = {}) {
  const k = String(playerId);
  const g = gruposDe(partido);
  const actual = GRUPOS.find((n) => g[n].includes(k)) || null;

  // fuera de todos, siempre: se vuelve a meter donde toque
  for (const n of GRUPOS) g[n] = g[n].filter((x) => x !== k);

  // tocar el grupo en el que ya estaba = sacarlo
  if (actual === grupo || !grupo) return g;

  if (!GRUPOS.includes(grupo)) return gruposDe(partido);   // grupo inventado: nada cambia
  if (grupo === 'convocados' && g.convocados.length >= max) return gruposDe(partido);

  g[grupo] = [...g[grupo], k];
  return g;
}

/**
 * Los jugadores que se pueden convocar.
 *
 * Solo los activos: a un crío dado de baja no se le convoca, y que
 * aparezca en la lista es la manera de convocarlo por error.
 */
export const convocables = (jugadores) => (jugadores || []).filter((j) => j.estado !== 'baja');

/**
 * Ordena por dorsal de menor a mayor, como el papel del club
 * (1, 2, 17, 20, 24, 33, 50, 67, 72, 77, 81, 99).
 *
 * Sin dorsal van al final y por nombre: no se les inventa un número,
 * porque el dorsal es lo que la mesa canta y equivocarlo es una falta
 * técnica. Que aparezcan sin número es la señal de que falta ficharlos.
 */
export function porDorsal(jugadores) {
  return [...(jugadores || [])].sort((a, b) => {
    const da = Number.isFinite(Number(a?.dorsal)) && a?.dorsal != null ? Number(a.dorsal) : null;
    const db = Number.isFinite(Number(b?.dorsal)) && b?.dorsal != null ? Number(b.dorsal) : null;
    if (da == null && db == null) return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es');
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  });
}

/* ── El día de la convocatoria ─────────────────────────────── */

/**
 * Qué día toca mandar la convocatoria de este partido.
 *
 * El día de la semana lo fija el equipo en ajustes (`dia_convocatoria`,
 * 1 = lunes). Se busca hacia atrás desde el día del partido: la
 * convocatoria del sábado con día 5 (viernes) sale el viernes de la
 * misma semana, y con día 3 (miércoles), el miércoles anterior.
 *
 * @returns 'YYYY-MM-DD' o null si el equipo no ha fijado día
 */
export function diaDeConvocatoria(partido, { diaSemana } = {}) {
  const dia = Number(diaSemana);
  if (!partido?.fecha || !Number.isFinite(dia) || dia < 1 || dia > 7) return null;
  const d = new Date(`${partido.fecha}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  // getUTCDay: 0 = domingo. En el resto de la app 1 = lunes … 7 = domingo.
  const suyo = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  let atras = suyo - dia;
  if (atras <= 0) atras += 7;         // el mismo día del partido no vale: se avisa antes
  d.setUTCDate(d.getUTCDate() - atras);
  return `${d.getUTCFullYear()}-${dosDigitos(d.getUTCMonth() + 1)}-${dosDigitos(d.getUTCDate())}`;
}

/**
 * A dónde lleva una convocatoria. Vive aquí y no en cada pantalla
 * porque hay tres sitios que enlazan a ella —el inicio, el chip del
 * calendario y el aviso push— y los tres llevaban al PARTIDO. Lo que
 * quiere quien toca «convocatoria» es rellenarla, no ver el marcador.
 */
export const rutaConvocatoria = (matchId) => `/partidos/${matchId}/convocatoria`;

/**
 * El evento de convocatoria de un partido, para el calendario.
 * Se DEDUCE: no hay tabla que mantener al día.
 *
 * @returns {fecha, partido, cerrada, cuantos, url} o null si no toca
 */
export function eventoDe(partido, { diaSemana } = {}) {
  if (!partido || partido.estado === 'cancelado') return null;
  const fecha = diaDeConvocatoria(partido, { diaSemana });
  if (!fecha) return null;
  return {
    fecha,
    partido,
    cerrada: !!partido.convocatoria_cerrada,
    cuantos: convocadosDe(partido).length,
    url: rutaConvocatoria(partido.id),
  };
}

/* ── La hora de llegada ────────────────────────────────────── */

/** «11:00» — sin los segundos que trae Postgres. */
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

/**
 * «12,00» — con coma, que es como las escribe el club en su papel.
 * No es un capricho de estilo: el documento va a un grupo de padres que
 * lleva años recibiéndolo así, y una hora escrita de otra forma es lo
 * primero que hace dudar de si el papel es el bueno.
 */
export const horaComa = (t) => hhmm(t).replace(':', ',');

/** 'HH:MM' → minutos desde medianoche, o null. */
function enMinutos(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return null;
  const h = Number(m[1]), mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

/**
 * A qué hora hay que estar en la cancha.
 *
 * Si el entrenador la ha escrito, esa. Si no, se deduce de la hora del
 * partido menos los minutos que el equipo tenga fijados (45 en el
 * modelo del club). Deducirla es lo correcto: es siempre el mismo
 * cálculo y escribirlo cada sábado es una ocasión de equivocarse.
 *
 * @returns 'HH:MM' o '' si no hay con qué calcularla
 */
export function horaLlegada(partido, { minutosAntes = null } = {}) {
  const puesta = hhmm(partido?.convocatoria_hora);
  if (puesta) return puesta;
  const inicio = enMinutos(hhmm(partido?.hora));
  /* `Number(null)` es 0, no NaN. Sin esta comprobación explícita, un
     equipo que NO ha fijado los minutos daba «cero minutos antes», es
     decir, la hora exacta del partido: catorce familias llegando
     cuando ya ha empezado. Es el mismo tropiezo que dio un periodo en
     vez de seis en el acta; aquí se corta a la entrada. */
  const antes = (minutosAntes === null || minutosAntes === undefined || minutosAntes === '')
    ? NaN : Number(minutosAntes);
  if (inicio == null || !Number.isFinite(antes) || antes < 0) return '';
  const t = ((inicio - antes) % 1440 + 1440) % 1440;
  return `${dosDigitos(Math.floor(t / 60))}:${dosDigitos(t % 60)}`;
}

/* ── Lo que falta ──────────────────────────────────────────── */

/**
 * Qué le falta a la convocatoria para poder mandarla.
 *
 * No es un error: el miércoles está a medias y no pasa nada. Es la
 * lista que va delante del botón, para que nadie saque un documento
 * con la mitad de los campos en blanco sin haberlo visto.
 */
export function loQueFalta(partido, { minimo = CONVOCADOS_MIN, ajustes = null } = {}) {
  const falta = [];
  const n = convocadosDe(partido).length;
  if (!n) falta.push('a quién se convoca');
  else if (n < minimo) falta.push(`gente: hay ${n} convocado${n === 1 ? '' : 's'} y el reglamento pide ${minimo}`);
  if (!horaLlegada(partido, { minutosAntes: ajustes?.conv_minutos_antes })) {
    falta.push('a qué hora hay que estar en la cancha');
  }
  if (!lugarDeJuego(partido, ajustes)) falta.push('en qué cancha se juega');
  // el desplazamiento solo se echa en falta cuando se juega fuera
  if (partido && partido.es_local === false && !partido.convocatoria_lugar?.trim()) {
    falta.push('de dónde se sale');
  }
  return falta;
}

/**
 * Los avisos del reglamento sobre el número de convocados. Van al lado
 * de la lista, mientras se marca, no cuando ya es tarde.
 */
export function avisosDeCupo(partido, { max = CONVOCADOS_MAX, minimo = CONVOCADOS_MIN } = {}) {
  const n = convocadosDe(partido).length;
  const avisos = [];
  if (n > max) {
    avisos.push(`Hay ${n} convocados y en el acta solo caben ${max}.`);
  } else if (n && n < minimo) {
    avisos.push(`Hay ${n} y el reglamento pide ${minimo}. Presentarse con menos se da por perdido 2-0 aunque se gane.`);
  }
  return avisos;
}

/** ¿Se puede sacar ya el documento? */
export const sePuedeSacar = (partido) => convocadosDe(partido).length > 0;

/* ── Cómo se lee ───────────────────────────────────────────── */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** «sábado 22 de agosto» */
export function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const dia = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return `${DIAS[dia - 1]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** «SÁBADO 22 DE AGOSTO» — como va en el papel. */
export const fechaDocumento = (iso) => fechaLarga(iso).toUpperCase();

/**
 * En qué cancha se juega. Si el partido dice una, esa; si no y se juega
 * en casa, la del equipo. Fuera de casa sin lugar escrito no se
 * inventa nada: se queda en blanco y `loQueFalta` lo dice.
 */
export function lugarDeJuego(partido, ajustes = null) {
  const suyo = partido?.lugar?.trim();
  if (suyo) return suyo;
  if (partido?.es_local && ajustes?.conv_cancha?.trim()) return ajustes.conv_cancha.trim();
  return '';
}

/** «CB PALENCIA - CB RIVAL», con el local delante. */
export function tituloPartido(partido, ajustes = null) {
  const nuestro = (ajustes?.conv_club || '').trim() || (ajustes?.nombreEquipo || '').trim();
  const rival = (partido?.rival || '').trim();
  if (!nuestro && !rival) return '';
  return partido?.es_local === false ? `${rival} - ${nuestro}` : `${nuestro} - ${rival}`;
}

/**
 * Los datos que van en el documento, ya resueltos y en el orden del
 * papel. Se arma aquí, en un módulo puro, para que la pantalla, el PDF
 * y el banco de pruebas lean exactamente lo mismo.
 */
export function datosDelDocumento(partido, jugadores, { nombreEquipo = '', escudo = null, ajustes = null } = {}) {
  const a = ajustes || {};
  const porId = new Map((jugadores || []).map((j) => [String(j.id), j]));
  const g = gruposDe(partido);

  /* Por dorsal, como el papel. El orden en que el entrenador los fue
     marcando no significa nada para quien lo lee: en la mesa se buscan
     por número. */
  const resuelve = (ids) => porDorsal(
    ids.map((id) => porId.get(id)).filter(Boolean)
       .map((j) => ({ id: String(j.id), nombre: j.nombre, dorsal: j.dorsal ?? null })),
  );

  const desconocidos = GRUPOS.reduce((n, k) => n + g[k].filter((id) => !porId.has(id)).length, 0);

  const nuestro = (a.conv_club || '').trim() || nombreEquipo;
  const rival = (partido?.rival || '').trim();

  return {
    // membrete y cabecera fija del equipo
    club: (a.conv_club || '').trim(),
    equipo: nombreEquipo,
    escudo,
    membrete: a.conv_membrete || null,
    oficina: (a.conv_oficina || '').trim(),
    email: (a.conv_email || '').trim(),
    categoria: (a.conv_categoria || '').trim(),
    competicion: (a.conv_competicion || '').trim(),
    llevar: (a.conv_llevar || '').trim(),
    // el partido. Las dos mitades van sueltas además de juntas: en el
    // papel el nombre del club lleva su recuadro morado y el del rival
    // no, así que quien pinta necesita saber cuál es cuál.
    partido: tituloPartido(partido, { ...a, nombreEquipo }),
    nuestroNombre: nuestro,
    rival,
    localPrimero: partido?.es_local !== false,
    donde: partido?.es_local === false ? 'fuera' : 'en casa',
    fecha: fechaDocumento(partido?.fecha),
    fechaISO: partido?.fecha || '',
    hora: horaComa(partido?.hora),
    cancha: lugarDeJuego(partido, a),
    horaLlegada: horaComa(horaLlegada(partido, { minutosAntes: a.conv_minutos_antes })),
    // desplazamiento (solo tiene sentido fuera de casa, pero se
    // devuelve siempre: quien pinta decide si lo enseña)
    salida: [horaComa(partido?.salida_hora), (partido?.convocatoria_lugar || '').trim()]
      .filter(Boolean).join(' · '),
    desplazamiento: (partido?.desplazamiento || '').trim(),
    regreso: (partido?.regreso || '').trim(),
    // las tres listas
    convocados: resuelve(g.convocados),
    reservas: resuelve(g.reservas),
    descansan: resuelve(g.descansan),
    // gente marcada que ya no está en la plantilla
    faltan: desconocidos,
  };
}

/** «vs CB Rival · sábado 22 de agosto · 11:00» — para la cabecera de la pantalla. */
export function titular(d) {
  return [
    d.rival ? `${d.donde === 'en casa' ? 'vs' : '@'} ${d.rival}` : null,
    (d.fechaISO ? fechaLarga(d.fechaISO) : ''),
    // en la cabecera de la PANTALLA, con dos puntos: es la app, no el papel
    d.hora ? d.hora.replace(',', ':') : '',
  ].filter(Boolean).join(' · ');
}

/** Nombre del fichero que se descarga: se reconoce en la carpeta del móvil. */
export function nombreFichero(d) {
  const trozo = (s) => String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return ['convocatoria', trozo(d.equipo), d.fechaISO || trozo(d.rival)]
    .filter(Boolean).join('-') + '.pdf';
}
