/* ============================================================
   acta-chat.js — EL PUENTE AL CHAT PARA EL ACTA (Tramo 4.2).
   Módulo PURO: sin DOM, sin red, sin clave, sin coste (§2).

   ── QUÉ ES ──────────────────────────────────────────────────
   La app arma el envío, el entrenador lo pega en su chat junto con la
   foto del acta, trae la respuesta y la app la vuelca en los campos.
   El trabajo de leer la letra lo hace la suscripción que el entrenador
   ya paga; la app se encarga de las dos partes tediosas: redactar la
   pregunta bien y colocar cuarenta números donde van.

   ── LOS NOMBRES NO VAN EN EL ENVÍO ──────────────────────────
   Por dorsal, y solo por dorsal. La app no escribe ni un nombre de un
   crío en el texto que se pega fuera (§2), y el casado dorsal → jugador
   se hace aquí dentro, contra la plantilla. Lo que el entrenador
   fotografíe es cosa suya; lo que compone la app no lleva nombres.

   Efecto colateral bueno: el acta se lee igual aunque el chat no sepa
   descifrar los apellidos manuscritos, que es justo lo que peor se lee.

   ── ÁMBAR EN LO DUDOSO ──────────────────────────────────────
   Un acta manuscrita leída por un modelo NO es un dato: es una
   propuesta. Todo lo que entra por aquí se marca para que se mire, y
   la duda viene de tres sitios distintos:

     1. lo que el chat dice que no ha leído claro (se le pide la lista);
     2. lo que NO CUADRA con la aritmética del acta (`acta.descuadres`);
     3. lo que la app ha tenido que recortar o no ha sabido casar.

   La segunda y la tercera son nuestras y son las que más valen: un
   modelo seguro de sí mismo se equivoca igual, y el único juez que no
   opina es la suma.

   ── Y NO PISA LO ESCRITO ────────────────────────────────────
   Como el puente del Taller (§2.12): rellena huecos y dice cuántos
   campos ha respetado. Un puente que borra media acta se usa una vez.
   ============================================================ */

import { periodosDe, FALTAS_MAX, saneaFila, recuenta, rejillaDe } from './acta.js';

/* ── El envío ──────────────────────────────────────────────── */

/**
 * El texto que el entrenador pega en su chat, con la foto del acta.
 *
 * Lleva lo que la app ya sabe —cuántos periodos, quién es quién en el
 * papel, qué dorsales existen— y el hueco exacto a rellenar. Los
 * dorsales van porque son la llave del casado y porque acotan: un «7»
 * mal leído se detecta solo si sabemos que el 7 existe y el 1 no.
 */
export function armarEnvio(partido, jugadores, { nombreEquipo = 'nuestro equipo' } = {}) {
  const P = periodosDe(partido);
  const dorsales = (jugadores || [])
    .map((j) => j.dorsal)
    .filter((d) => d != null)
    .sort((a, b) => a - b);
  const sinDorsal = (jugadores || []).filter((j) => j.dorsal == null).length;

  const lado = partido?.es_local ? 'LOCAL' : 'VISITANTE';
  const otro = partido?.es_local ? 'VISITANTE' : 'LOCAL';
  const par = Array.from({ length: P }, () => '{"favor": 0, "contra": 0}').join(', ');

  const avisoSinDorsal = sinDorsal
    ? `\n- Hay ${sinDorsal} jugador(es) sin dorsal apuntado en la app; puede que en el acta sí lo lleven.`
    : '';

  return `Lee el acta de baloncesto de la foto y devuélveme sus números.

LO QUE HAY QUE SABER PARA LEERLA:
- El partido se juega a ${P} periodos.
- Nosotros somos el equipo ${lado} del acta (en la foto, "${nombreEquipo}"). El rival${partido?.rival ? ` ("${partido.rival}")` : ''} es el ${otro}.
- Los dorsales de nuestro equipo son: ${dorsales.length ? dorsales.join(', ') : '(no los sé)'}. Si lees uno que no está en esa lista, ponlo igual: ya lo miraré yo.${avisoSinDorsal}
- En el acta oficial cada jugador tiene una casilla por periodo y se marca en los que jugó. Dime CUÁLES jugó, no cuántos.

Devuélveme SOLO un bloque JSON con esta forma exacta, sin texto alrededor:

{
  "periodos": ${P},
  "marcador": { "favor": 0, "contra": 0 },
  "por_periodo": [${par}],
  "faltas_equipo": [${par}],
  "tiempos_muertos": [${par}],
  "jugadores": [
    { "dorsal": 0, "periodos": [1, 2], "puntos": 0, "faltas": 0 }
  ],
  "dudoso": ["la lista de lo que NO has leído con seguridad; deja [] si lo has leído todo"]
}

REGLAS:
- "favor" es SIEMPRE lo nuestro (el equipo ${lado}) y "contra" lo del rival. No lo cambies aunque en el acta estén en otro orden.
- Los "periodos" de cada jugador son los números de periodo que jugó: [1, 2, 4]. Si en el acta no se ve la rejilla, pon [] y dilo en "dudoso".
- Pon SOLO a los jugadores que aparecen en el acta. A los que no jugaron, no los pongas.
- Si un número no se lee, NO lo adivines y NO pongas 0: pon null y añade a "dudoso" qué era, por ejemplo "los puntos del 7" o "el periodo 3 del rival". Un 0 significa que ese jugador no anotó, que es otra cosa.
- No escribas nombres de jugadores en la respuesta. Solo dorsales.
- Las faltas de un jugador no pasan de ${FALTAS_MAX}.`;
}

/* ── La respuesta ──────────────────────────────────────────── */

/* Las claves que tiene un acta. Sirven para reconocerla entre varios
   bloques y para no volcar cualquier objeto que traiga la respuesta. */
const CLAVES = ['periodos', 'marcador', 'por_periodo', 'faltas_equipo', 'tiempos_muertos', 'jugadores', 'dudoso'];

/**
 * Cuánto se parece esto a un acta LEÍDA. Negativo si ni siquiera es un
 * objeto.
 *
 * Las claves cuentan poco y los NÚMEROS cuentan mucho, y esa proporción
 * es a propósito: un chat que repite el formato antes de contestar deja
 * en la respuesta dos bloques con las MISMAS claves, uno a cero —la
 * plantilla que le mandamos— y otro con el acta. Lo único que los
 * distingue es que uno tiene números dentro. Sin esto se volcaba la
 * plantilla de ceros como si fuera el partido.
 */
function pareceActa(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return -1;
  let n = CLAVES.filter((k) => k in j).length;
  const suma = (x) => { const v = entero(x); return v ? Math.abs(v) : 0; };
  /* Se puntua con los MISMOS lectores tolerantes que usa el volcado: si
     aquí se leyera «favor/contra» a secas, un acta escrita con
     «nosotros/ellos» puntuaría cero y se descartaría por parecerse al
     molde vacío. La regla es una sola: lo que el volcado sabe leer,
     cuenta. */
  n += suma(lado(j.marcador, 'favor')) + suma(lado(j.marcador, 'contra'));
  for (const c of Array.isArray(j.por_periodo) ? j.por_periodo : []) {
    n += suma(lado(c, 'favor')) + suma(lado(c, 'contra'));
  }
  for (const g of filasLeidas(j).filas) n += suma(g?.puntos) + suma(g?.faltas);
  return n;
}

/**
 * Las filas de jugadores de una respuesta.
 *
 * Tendrían que ser una lista, pero un chat las devuelve a veces como
 * objeto indexado por dorsal. Se acepta —son las mismas filas— y en
 * cualquier otra forma se dice: perder el acta entera de los jugadores
 * sin una palabra era lo peor que podía pasar aquí, porque el resumen
 * seguía diciendo que todo había ido bien.
 */
function filasLeidas(j) {
  if (Array.isArray(j?.jugadores)) return { filas: j.jugadores, rareza: null };
  if (j?.jugadores && typeof j.jugadores === 'object') {
    const filas = Object.entries(j.jugadores)
      .map(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...v, dorsal: v.dorsal ?? k } : null))
      .filter(Boolean);
    return {
      filas,
      rareza: filas.length ? 'La lista de jugadores venía como objeto y no como lista; se ha entendido igual.' : null,
    };
  }
  if (j?.jugadores != null) {
    return { filas: [], rareza: 'La lista de jugadores venía en un formato que no entiendo: no ha entrado ninguno.' };
  }
  return { filas: [], rareza: null };
}

/* Un JSON escrito por un modelo trae a veces una coma de más antes de
   cerrar, o un comentario `//` explicando un campo. `JSON.parse` lo
   rechaza entero, y con él se pierde el acta completa por una coma. */
function parseTolerante(txt) {
  try { return JSON.parse(txt); } catch { /* se intenta limpiar */ }
  const limpio = txt
    .replace(/^\s*\/\/.*$/gm, '')          // comentarios de línea
    .replace(/,(\s*[}\]])/g, '$1');         // comas finales
  try { return JSON.parse(limpio); } catch { return undefined; }
}

/**
 * Saca el acta de lo que sea que haya pegado el entrenador: el JSON
 * pelado, dentro de una valla ```json, con dos párrafos de cortesía
 * delante, en la segunda de dos vallas, o envuelto en otro objeto
 * (`{"acta": {…}}`).
 *
 * Se prueban TODOS los candidatos y gana el que más se parece a un acta
 * leída, no el primero que parsee: el primero suele ser el formato que
 * el propio chat repite antes de ponerse a contestar.
 */
export function extraerJSON(texto) {
  const s = String(texto || '').trim();
  if (!s) return null;

  const trozos = [];
  for (const m of s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) trozos.push(m[1]);
  trozos.push(s);

  const vistos = [];
  for (const c of trozos) {
    const i = c.indexOf('{');
    const j = c.lastIndexOf('}');
    if (i < 0 || j <= i) continue;
    const obj = parseTolerante(c.slice(i, j + 1));
    if (!obj || typeof obj !== 'object') continue;
    vistos.push(obj);
    // y un nivel hacia dentro: {"acta": {…}}, {"resultado": {…}}
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) vistos.push(v);
    }
  }

  let mejor = null, tope = 0;
  for (const v of vistos) {
    const n = pareceActa(v);
    // `>=` y no `>`: a igualdad gana el ÚLTIMO, que es el que el chat
    // escribió después de pensar, no el formato que copió al empezar
    if (n >= tope) { tope = n; mejor = v; }
  }
  return mejor;
}

/* ── Lo que se entiende de cada trozo ──────────────────────── */

/**
 * Un entero, o null si no lo es.
 *
 * `null`, `''` y «no se lee» NO son cero: la diferencia entre «cero
 * puntos» y «no lo sé» es justo la que este puente tiene que respetar.
 */
export function entero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return null;
  const s = String(v).trim();
  if (!/^[+-]?\d+([.,]\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s.replace(',', '.')));
  return Number.isFinite(n) ? n : null;
}

/* Cómo llama un chat a cada lado. Se le pide «favor» y «contra», y
   normalmente obedece; cuando no, dice «nosotros/ellos» o
   «local/visitante», que es como está escrito el papel que está
   mirando. Entenderlo no es adivinar: son las mismas dos columnas. */
const ALIAS = {
  favor: ['favor', 'a_favor', 'nosotros', 'nuestro', 'propio', 'casa'],
  contra: ['contra', 'en_contra', 'ellos', 'rival', 'contrario', 'fuera'],
};

/** El número de un lado de un par, venga como venga. */
export function lado(c, cual, esLocal = true) {
  if (c == null) return null;
  // [6, 5] — nuestro primero, como en el molde del envío
  if (Array.isArray(c)) return entero(c[cual === 'favor' ? 0 : 1]);
  if (typeof c !== 'object') return null;
  for (const k of ALIAS[cual]) if (k in c) return entero(c[k]);
  /* «local» y «visitante» dicen dónde se juega, no de quién es: cuál de
     los dos es el nuestro depende del partido. */
  const mio = esLocal ? 'local' : 'visitante';
  const suyo = esLocal ? 'visitante' : 'local';
  const k = cual === 'favor' ? mio : suyo;
  return k in c ? entero(c[k]) : null;
}

/** Una lista de {favor, contra} con tantas entradas como periodos. */
export function paresDe(lista, P, esLocal = true) {
  const out = [];
  for (let i = 0; i < P; i++) {
    const c = (Array.isArray(lista) ? lista : [])[i];
    out.push({ favor: lado(c, 'favor', esLocal), contra: lado(c, 'contra', esLocal) });
  }
  return out;
}

/**
 * La rejilla de periodos de un jugador, tal y como venga.
 *
 * Se entiende la lista de números y la lista escrita en texto
 * («1, 2, 4»), que es lo que un chat suelta cuando se le olvida el
 * formato. Un número suelto NO se interpreta: un «4» puede ser «jugó el
 * cuarto» o «jugó cuatro periodos», y colocarlo mal es peor que
 * dejarlo vacío y decirlo.
 *
 * @returns [periodos] o null si no se entiende
 */
export function rejillaLeida(v, P) {
  let crudo = v;
  if (typeof crudo === 'string') {
    const t = crudo.trim();
    if (!t) return [];
    // solo separadores inequívocos: un «1-4» puede ser un rango
    if (!/^\d+(\s*[,;\s]\s*\d+)*$/.test(t)) return null;
    crudo = t.split(/[,;\s]+/);
  }
  if (!Array.isArray(crudo)) return null;
  const out = [];
  for (const x of crudo) {
    const k = entero(x);
    if (k != null && k >= 1 && k <= P) out.push(k);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

const vacio = (v) => v === null || v === undefined || v === ''
  || (Array.isArray(v) && !v.length);

/* ── El volcado ────────────────────────────────────────────── */

/**
 * Vuelca la respuesta del chat sobre el partido y las filas del acta.
 *
 * NO muta nada de lo que recibe: devuelve copias. La pantalla decide si
 * se queda con ellas, y hasta que no se guarda no hay nada perdido.
 *
 * @param partido    el partido tal y como está en pantalla
 * @param filas      una fila por jugador de la plantilla (`acta.filaVacia`)
 * @param respuesta  el texto pegado del chat
 * @param opts.pisar si true, machaca lo que ya hubiera escrito
 *
 * @returns {
 *   error?,                     // si no hay JSON que valga
 *   partido, filas,             // las copias con lo volcado
 *   puestos: [etiqueta],        // qué ha entrado
 *   ignorados: [etiqueta],      // qué se ha respetado por estar escrito
 *   dudosos: [clave],           // qué hay que MIRAR (ámbar)
 *   confiesa: [texto],          // lo que el chat dice que no leyó seguro
 *   sinCasar: [{dorsal, por}],  // dorsales del acta que no son de nadie
 * }
 */
export function volcar(partido, filas, respuesta, { pisar = false } = {}) {
  const j = extraerJSON(respuesta);
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    return { error: 'No he encontrado el bloque JSON en lo que has pegado. Copia la respuesta entera del chat, con las llaves incluidas.' };
  }

  const P = periodosDe(partido);
  const esLocal = partido?.es_local !== false;

  /* Lo que nos han pegado es el MOLDE que la app le dio al chat, no su
     respuesta: todas las claves y ni un número dentro. Pasa cuando se
     copia el bloque de arriba del modal en vez del de abajo, y volcarlo
     dejaría el acta a cero con pinta de leída. */
  const claves = CLAVES.filter((k) => k in j).length;
  if (claves >= 4 && pareceActa(j) === claves
      && filasLeidas(j).filas.every((g) => !entero(g?.dorsal))) {
    return { error: 'Eso es el formato que te ha dado la app, no la respuesta del chat: está todo a cero. Pega lo que te haya devuelto el chat.' };
  }

  const p = { ...partido };
  const nuevas = (filas || []).map((f) => ({ ...f, periodos: [...rejillaDe(f)] }));
  const puestos = [], ignorados = [], sinCasar = [], rarezas = [];
  const dudosos = new Set();

  /* El chat dice a cuántos periodos cree que se jugó. No se le hace
     caso —manda el partido— pero si no coinciden hay que decirlo: o el
     partido está mal configurado o el chat ha leído otra cosa, y en los
     dos casos la rejilla que viene detrás no vale. */
  const dice = entero(j.periodos);
  if (dice != null && dice !== P) {
    rarezas.push(`El chat dice que el acta tiene ${dice} periodos y el partido está a ${P}.`);
  }

  /* Lo que el chat confiesa que no ha leído bien. Va aparte de las
     claves de ámbar porque es texto suyo, no un campo de la pantalla. */
  const confiesa = (Array.isArray(j.dudoso) ? j.dudoso : [])
    .map((x) => String(x || '').trim()).filter(Boolean);

  const poner = (obj, clave, valor, etiqueta, marca) => {
    if (vacio(valor)) return false;
    if (!vacio(obj[clave]) && !pisar) { ignorados.push(etiqueta); return false; }
    obj[clave] = valor;
    puestos.push(etiqueta);
    if (marca) dudosos.add(marca);
    return true;
  };

  // ── el marcador final ──
  poner(p, 'marcador_favor', lado(j.marcador, 'favor', esLocal), 'el marcador nuestro', 'marcador.favor');
  poner(p, 'marcador_contra', lado(j.marcador, 'contra', esLocal), 'el del rival', 'marcador.contra');

  // ── las tres listas por periodo ──
  const listas = [
    ['marcador_cuartos', j.por_periodo, 'el marcador por periodos', 'periodo'],
    ['faltas_equipo', j.faltas_equipo, 'las faltas de equipo', 'faltas'],
    ['tiempos_muertos', j.tiempos_muertos, 'los tiempos muertos', 'tm'],
  ];
  for (const [clave, cruda, etiqueta, prefijo] of listas) {
    const leidos = paresDe(cruda, P, esLocal);
    if (leidos.every((c) => c.favor == null && c.contra == null)) continue;
    /* Una lista de ceros no cuenta como escrita: la pantalla estira las
       tres a la longitud del partido para poder pintar los campos, y si
       eso ocupara sitio el puente no rellenaría nunca nada. */
    const actual = Array.isArray(p[clave]) ? p[clave] : [];
    const tieneAlgo = actual.some((c) => Number(c?.favor) || Number(c?.contra));
    if (tieneAlgo && !pisar) { ignorados.push(etiqueta); continue; }
    p[clave] = leidos.map((c, i) => {
      dudosos.add(`${prefijo}.${i + 1}.favor`);
      dudosos.add(`${prefijo}.${i + 1}.contra`);
      return { favor: c.favor ?? 0, contra: c.contra ?? 0 };
    });
    puestos.push(etiqueta);
  }

  // ── los jugadores, por dorsal ──
  /* El casado va contra la plantilla y NUNCA inventa: un dorsal que no
     es de nadie se dice, y uno repetido tampoco se resuelve por su
     cuenta. Meterle el acta al jugador equivocado es peor que dejar la
     fila vacía, porque el error viaja a la temporada entera (4.4). */
  const porDorsal = new Map();
  for (const f of nuevas) {
    if (f.dorsal == null) continue;
    const k = Number(f.dorsal);
    porDorsal.set(k, porDorsal.has(k) ? null : f);   // null = lo llevan dos
  }

  const { filas: leidos, rareza } = filasLeidas(j);
  if (rareza) rarezas.push(rareza);

  /* Un dorsal que aparece DOS VECES en la respuesta. Antes ganaba el
     primero y el segundo se contaba como «respetado lo que ya estaba
     escrito», que dice justo lo contrario de lo que pasa. */
  const yaLeido = new Set();

  for (const leido of leidos) {
    const d = entero(leido?.dorsal);
    if (d == null) { sinCasar.push({ dorsal: null, por: 'no trae dorsal' }); continue; }
    if (yaLeido.has(d)) { sinCasar.push({ dorsal: d, por: 'aparece dos veces en la respuesta' }); continue; }
    if (!porDorsal.has(d)) { sinCasar.push({ dorsal: d, por: 'no hay nadie con ese dorsal' }); continue; }
    const f = porDorsal.get(d);
    if (!f) { sinCasar.push({ dorsal: d, por: 'lo llevan dos jugadores' }); continue; }
    yaLeido.add(d);

    const etq = `dorsal ${d}`;
    const yaTiene = rejillaDe(f).length || f.periodos_jugados || f.puntos || f.faltas;
    if (yaTiene && !pisar) { ignorados.push(etq); continue; }

    let rejilla = rejillaLeida(leido.periodos, P);
    if (rejilla === null) {
      // se entiende el resto de la fila; la rejilla se queda vacía y se dice
      rarezas.push(`El dorsal ${d} trae los periodos en un formato que no entiendo: esa rejilla hay que marcarla a mano.`);
      rejilla = [];
    }
    const pts = entero(leido.puntos);
    const fal = entero(leido.faltas);

    Object.assign(f, recuenta({ ...f, periodos: rejilla }, p, { aunqueVacia: true }));
    if (pts != null) f.puntos = pts;
    if (fal != null) f.faltas = fal;

    /* Se recorta a los límites, igual que al teclear a mano: perder la
       fila entera por un número imposible sería peor. Pero se marca,
       porque un recorte silencioso es un dato inventado. */
    const antes = { puntos: f.puntos, faltas: f.faltas };
    Object.assign(f, saneaFila(f, p), { nombre: f.nombre });
    if (f.puntos !== antes.puntos || f.faltas !== antes.faltas) {
      dudosos.add(`jugador.${f.player_id}.recortado`);
    }

    puestos.push(etq);
    dudosos.add(`jugador.${f.player_id}.periodos`);
    dudosos.add(`jugador.${f.player_id}.puntos`);
    dudosos.add(`jugador.${f.player_id}.faltas`);
  }

  // el acta ha entrado por aquí, y eso se recuerda (columna de la 028)
  if (puestos.length) p.acta_origen = 'chat';

  return { partido: p, filas: nuevas, puestos, ignorados, dudosos: [...dudosos], confiesa, sinCasar, rarezas };
}

/* ── Cómo se cuenta lo que ha pasado ───────────────────────── */

/** «Ha entrado: el marcador, el marcador por periodos y 10 jugadores.» */
export function resumen(r) {
  if (!r || r.error) return r?.error || '';
  if (!r.puestos.length) return 'No he encontrado nada que volcar en esa respuesta.';
  const n = r.puestos.filter((x) => x.startsWith('dorsal')).length;
  const partes = r.puestos.filter((x) => !x.startsWith('dorsal'));
  if (n) partes.push(`${n} jugador${n === 1 ? '' : 'es'}`);
  const cola = r.ignorados.length
    ? ` Se ha respetado lo que ya estaba escrito (${r.ignorados.length}).`
    : '';
  return `Ha entrado: ${partes.join(', ')}.${cola}`;
}

/** Lo que hay que mirar antes de darlo por bueno, en cristiano. */
export function avisos(r, { descuadres = [], sinDorsal = 0 } = {}) {
  const out = [];
  const perdidos = (r?.sinCasar || []).filter((d) => d.por === 'no hay nadie con ese dorsal').length;
  for (const d of r?.sinCasar || []) {
    out.push(d.dorsal == null
      ? 'Hay una fila del acta sin dorsal: esa hay que ponerla a mano.'
      : `El dorsal ${d.dorsal} no se ha podido casar: ${d.por}.`);
  }
  /* El porqué casi siempre es este, y sin decirlo el entrenador busca el
     fallo en el acta cuando está en su plantilla. */
  if (perdidos && sinDorsal) {
    out.push(`Hay ${sinDorsal} jugador${sinDorsal === 1 ? '' : 'es'} sin dorsal en la plantilla: ponles el suyo y vuelve a volcar.`);
  }
  for (const t of r?.rarezas || []) out.push(t);
  for (const t of r?.confiesa || []) out.push(`El chat no lo ha leído seguro: ${t}.`);
  for (const d of descuadres || []) out.push(d.texto);
  return out;
}
