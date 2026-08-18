/* ============================================================
   ia/frase.js — EL LECTOR DE LA DESCRIPCIÓN (Tramo 2.9).
   Módulo PURO: sin DOM, sin red, sin IA.

   ── QUÉ SUSTITUYE ───────────────────────────────────────────
   Hasta ahora el paso 2 mandaba el texto libre a un modelo de pago
   para que adivinara la jugada, y cuando no había clave, a un puñado
   de regex que siempre montaban el mismo ejercicio (bota, pasa,
   tira). Las dos cosas fallaban por lo mismo: intentaban adivinar
   sobre un vocabulario abierto.

   Aquí el vocabulario está CERRADO por los dos lados —las acciones
   del catálogo (ia/acciones.js) y los sujetos del tablero
   (ia/sujetos.js)— y las dos listas son las mismas que el paso 2
   enseña en pantalla. Leer la frase deja de ser adivinar y pasa a ser
   buscar palabras conocidas y colocarlas en los huecos que la familia
   de la acción declara.

   Consecuencia práctica: lo que no se entiende SE DICE, con el trozo
   exacto de texto marcado. Un modelo, cuando no entendía, se
   inventaba algo plausible.

   ── EL ORDEN DE LAS DOS PASADAS ─────────────────────────────
   Primero los SUJETOS y después las acciones, no al revés. La razón
   es una frase concreta: «vuelve a la Fila 2». La acción «vuelve a la
   fila» se escribe con la palabra «fila» dentro, así que buscando
   acciones primero se comería el nombre de la fila y el 2 quedaría
   suelto. Los sujetos son nombres exactos —los inserta un clic— y las
   acciones son vocabulario suelto: lo concreto se reserva primero.

   ── LO QUE NO HACE ──────────────────────────────────────────
   No valida el baloncesto ni resuelve geometría. Produce eventos del
   dialecto nuevo, { jugador, accion, args }, que es exactamente lo que
   ia/intencion.js sabe normalizar. De ahí al compilador no hay nada
   nuevo: el paso 2 escribe el mismo idioma que ya hablaban las 204
   fichas de la biblioteca.
   ============================================================ */

import { CATALOGO_SISTEMA, FAMILIAS, indexar, parametroDe } from './acciones.js';
import { normalizar, indexarSujetos, RELLENO } from './sujetos.js';

/* ── Palabras que estructuran la frase ─────────────────────── */

/*
   Separadores de cláusula. Cada cláusula lleva como mucho un sujeto y
   una acción, así que aquí es donde «A1 bota y A2 corta» se convierte
   en dos cosas.
*/
const SEPARADOR = new Set([
  'y', 'e', 'luego', 'despues', 'mientras', 'entonces', 'ademas',
  'tambien', 'seguidamente', 'finalmente', 'acto', 'seguido',
]);

/*
   Conectores: no son ni acción ni sujeto, y tampoco son un error. Se
   listan para NO subrayarlos en rojo — subrayar «hasta» en «bota hasta
   el codo» diría que algo va mal cuando todo va bien.
*/
const CONECTOR = new Set([
  'hasta', 'hacia', 'para', 'con', 'sobre', 'contra', 'desde', 'entre',
  'tras', 'que', 'su', 'sus', 'le', 'lo', 'ya', 'donde', 'alli', 'ahi',
  'por', 'como', 'sin',
]);

/* ── Los huecos de cada familia ────────────────────────────── */

/*
   En qué orden se ofrecen los huecos de cada familia a lo que venga
   escrito detrás de la acción. `pide` manda por delante: es lo que la
   propia acción declara que le falta.
*/
const HUECOS = {
  desplazamiento: ['destino', 'sorteando'],
  balon: ['destino', 'balon'],
  entre_dos: ['companero', 'destino'],
  gesto: ['hacia'],
  simulacion: ['atacantes', 'defensores'],
};

/** Tipo de sujeto → la referencia que declara el catálogo. */
const TIPO_A_REFERENCIA = {
  jugador: 'jugador', fila: 'jugador', fila_miembro: 'jugador',
  cono: 'elemento', material: 'elemento',
  zona: 'zona', balon: 'balon', aro: 'aro', posicion: 'posicion',
};

/** Quién puede HACER algo. Una posición no corre. */
const ACTORES = new Set(['jugador', 'fila', 'fila_miembro']);

/** A qué hueco tira cada tipo, por orden de preferencia. */
const PREFERENCIA = {
  aro: ['destino', 'hacia'],
  posicion: ['destino', 'hacia'],
  zona: ['destino', 'hacia'],
  jugador: ['companero', 'atacantes', 'destino', 'hacia'],
  fila: ['companero', 'atacantes', 'destino', 'hacia'],
  fila_miembro: ['companero', 'atacantes', 'destino', 'hacia'],
  balon: ['balon', 'destino'],
  // los elementos se resuelven aparte: depende de si la acción rodea
  cono: ['destino', 'sorteando'],
  material: ['destino', 'sorteando'],
};

const esLista = (familia, hueco) => FAMILIAS[familia]?.parametros?.[hueco]?.tipo === 'lista_referencias';
const admite = (familia, hueco, ref) => Boolean(FAMILIAS[familia]?.parametros?.[hueco]?.admite?.includes(ref));

/* ── Léxico ────────────────────────────────────────────────── */

/**
 * Las dos listas de palabras conocidas, indexadas para buscar.
 * Se construye una vez por tablero y se consulta en cada tecla.
 */
export function crearLexico({ catalogo = CATALOGO_SISTEMA, sujetos = [] } = {}) {
  const lista = catalogo && catalogo.length ? catalogo : CATALOGO_SISTEMA;
  const acciones = conPlurales(indexar(lista));
  const idxSujetos = indexarSujetos(sujetos);
  const largo = (m) => Math.max(1, ...[...m.keys()].map((k) => k.split(' ').length));
  return {
    acciones, sujetos: idxSujetos,
    porSlug: new Map(lista.map((a) => [a.slug, a])),
    maxAccion: acciones.size ? largo(acciones) : 1,
    maxSujeto: idxSujetos.size ? largo(idxSujetos) : 1,
  };
}

/**
 * «A1 y A2 CORTAN al aro».
 *
 * El catálogo escribe cada acción en singular —«corta», «bota»,
 * «vuelve»— porque es su nombre, y un entrenador que manda a dos las
 * escribe en plural. Antes que llenar de conjugaciones la lista de
 * sinónimos de cada acción (que también la escribe el club, y a mano),
 * se registra aquí la única forma que falta: en presente, la tercera
 * persona del plural es la del singular con una ene detrás. Vale para
 * las tres conjugaciones —bota/botan, recoge/recogen, defiende/
 * defienden— y no hace falta ninguna excepción.
 */
function conPlurales(idx) {
  for (const [k, accion] of [...idx]) {
    const palabras = k.split(' ');
    const ultima = palabras[palabras.length - 1];
    if (!/[ae]$/.test(ultima)) continue;
    const plural = [...palabras.slice(0, -1), `${ultima}n`].join(' ');
    if (!idx.has(plural)) idx.set(plural, accion);
  }
  return idx;
}

/* ── Tokenizado ────────────────────────────────────────────── */

/** Palabras con su sitio EXACTO en el texto original (para resaltar). */
export function tokenizar(texto) {
  const out = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = re.exec(String(texto ?? ''))) !== null) {
    const norm = normalizar(m[0]);
    if (!norm) continue;
    out.push({ crudo: m[0], norm, ini: m.index, fin: m.index + m[0].length });
  }
  return out;
}

/** Trocea en cláusulas por puntuación o por palabra separadora. */
function partirEnClausulas(tokens, texto) {
  const clausulas = [];
  let actual = [];
  let anterior = 0;
  for (const t of tokens) {
    const hueco = String(texto).slice(anterior, t.ini);
    anterior = t.fin;
    if (/[,;.:\n·—–]/.test(hueco) && actual.length) { clausulas.push(actual); actual = []; }
    if (SEPARADOR.has(t.norm)) { if (actual.length) { clausulas.push(actual); actual = []; } continue; }
    actual.push(t);
  }
  if (actual.length) clausulas.push(actual);
  return clausulas;
}

/* ── Búsqueda de la frase más larga ────────────────────────── */

/**
 * Marca en `tokens` todo lo que esté en `idx`, empezando por las frases
 * más largas. Los tokens ya tomados por una pasada anterior no se
 * vuelven a mirar: por eso el orden sujetos→acciones importa.
 */
function barrer(tokens, tomado, idx, clase, max, marcas) {
  let i = 0;
  while (i < tokens.length) {
    if (tomado[i] || RELLENO.has(tokens[i].norm)) { i++; continue; }
    let mejor = null;
    for (let n = Math.min(max, tokens.length - i); n >= 1; n--) {
      const palabras = [];
      let j = i;
      while (j < tokens.length && palabras.length < n) {
        if (tomado[j]) break;
        // el relleno («el», «la», «de») se salta DENTRO de la frase: así
        // «vuelve a la fila» encuentra la acción «vuelve fila»
        if (RELLENO.has(tokens[j].norm) && palabras.length) { j++; continue; }
        if (RELLENO.has(tokens[j].norm)) break;
        palabras.push(tokens[j].norm);
        j++;
      }
      if (palabras.length < n) continue;
      const dato = idx.get(palabras.join(' '));
      if (dato) { mejor = { dato, hasta: j - 1 }; break; }
    }
    if (!mejor) { i++; continue; }
    for (let k = i; k <= mejor.hasta; k++) tomado[k] = true;
    marcas.push({
      clase, dato: mejor.dato,
      iniTok: i, finTok: mejor.hasta,
      ini: tokens[i].ini, fin: tokens[mejor.hasta].fin,
    });
    i = mejor.hasta + 1;
  }
}

/** Marcas de una cláusula, en orden de aparición. */
function marcar(tokens, lexico) {
  const tomado = new Array(tokens.length).fill(false);
  const marcas = [];
  barrer(tokens, tomado, lexico.sujetos, 'sujeto', lexico.maxSujeto, marcas);
  barrer(tokens, tomado, lexico.acciones, 'accion', lexico.maxAccion, marcas);
  marcas.sort((a, b) => a.iniTok - b.iniTok);
  return { marcas, tomado };
}

/* ── Reparto de complementos en los huecos ─────────────────── */

/**
 * Coloca las referencias escritas detrás de la acción en los huecos
 * que su familia declara.
 *
 * @returns { args, sobras } — `sobras` son las referencias que no caben
 *   en ningún hueco, para poder DECIRLO en vez de tragárselas.
 */
export function repartir(accion, refs = [], previos = null) {
  const familia = accion.familia;
  const declarados = Array.isArray(accion.pide) ? accion.pide : [];
  const orden = [...declarados, ...(HUECOS[familia] || []).filter((h) => !declarados.includes(h))];
  // `previos` permite seguir rellenando una acción ya escrita («rodea el
  // Cono 1 y el Cono 2 hasta el aro»): se trabaja sobre una COPIA, y el
  // que llama decide si se la queda según lo que sobre.
  const args = {};
  for (const [k, v] of Object.entries(previos || {})) args[k] = Array.isArray(v) ? [...v] : v;
  const sobras = [];
  // Solo un desplazamiento que ES un rodeo manda un cono a `sorteando`.
  // Si no, «bota hasta el Cono 2» acabaría haciendo eslalon alrededor
  // del sitio al que se le mandó ir.
  const rodea = ['rodeo', 'zigzag'].includes(parametroDe(accion, 'trayectoria'));

  for (const s of refs) {
    const ref = TIPO_A_REFERENCIA[s.tipo];
    let pref = PREFERENCIA[s.tipo] || ['destino'];
    if ((s.tipo === 'cono' || s.tipo === 'material') && rodea) pref = ['sorteando', 'destino'];
    const hueco = pref.find((hu) => orden.includes(hu) && admite(familia, hu, ref)
      && (esLista(familia, hu) || args[hu] === undefined));
    if (!hueco) { sobras.push(s); continue; }
    if (esLista(familia, hueco)) (args[hueco] ||= []).push(s.ref);
    else args[hueco] = s.ref;
  }
  return { args, sobras };
}

/**
 * Los huecos que una acción admite, en el orden en que se rellenan y con
 * los tipos de sujeto que caben en cada uno.
 *
 * Lo usa el panel «Manualmente» del paso 2 (Tramo 2.10) para saber qué
 * desplegables pintar. Vive AQUÍ y no allí a propósito: quién cabe en
 * qué hueco es la misma regla que aplica `repartir` al leer la frase, y
 * en dos sitios acabaría diciendo dos cosas distintas.
 */
export function huecosDe(accion) {
  const familia = accion.familia;
  const declarados = Array.isArray(accion.pide) ? accion.pide : [];
  const rodea = ['rodeo', 'zigzag'].includes(parametroDe(accion, 'trayectoria'));
  const orden = [...declarados, ...(HUECOS[familia] || []).filter((h) => !declarados.includes(h))]
    // «qué rodea» solo lo enseña una acción que de suyo rodea. Ofrecérselo
    // a un bote sería ofrecer un eslalon que ese bote no va a hacer: el
    // lector tampoco manda ahí un cono si la acción no es de rodeo.
    .filter((h) => h !== 'sorteando' || rodea);
  return orden.map((hueco) => ({
    hueco,
    lista: esLista(familia, hueco),
    pedido: declarados.includes(hueco),
    etiqueta: ETIQUETA_CORTA[hueco] || hueco,
    tipos: Object.keys(TIPO_A_REFERENCIA).filter((t) => admite(familia, hueco, TIPO_A_REFERENCIA[t])),
  }));
}

const ETIQUETA_CORTA = {
  destino: 'hacia', companero: 'con', sorteando: 'rodeando',
  balon: 'balón', hacia: 'hacia', atacantes: 'atacan', defensores: 'defienden',
};

/** Los huecos que la acción declara necesitar y se han quedado vacíos. */
function faltantes(accion, args) {
  return (Array.isArray(accion.pide) ? accion.pide : []).filter((h) => {
    const v = args[h];
    if (esLista(accion.familia, h)) return !Array.isArray(v) || !v.length;
    return v === undefined || v === null;
  });
}

/* ── El lector ─────────────────────────────────────────────── */

const aviso = (texto, dice, campo = 'frase') => ({ texto_original: texto, interpretacion: dice, campo });

/**
 * Lee UNA línea de descripción.
 *
 * @param texto   la línea tal cual la escribió el entrenador
 * @param lexico  el de crearLexico()
 * @param estado  { sujeto, pendientes } que viene de la línea anterior:
 *   `sujeto` es quién actuaba (para «tira» sin decir quién) y
 *   `pendientes`, sujetos nombrados sin acción todavía.
 * @returns { eventos, avisos, tramos, sujeto, pendientes }
 *   `tramos` son los trozos de texto reconocidos —o no—, con su sitio
 *   exacto, que es lo que el paso 2 pinta debajo de lo escrito.
 */
export function leerFrase(texto = '', lexico, estado = {}) {
  const tokens = tokenizar(texto);
  const eventos = [];
  const avisos = [];
  const tramos = [];
  let sujeto = estado.sujeto || null;
  let pendientes = [...(estado.pendientes || [])];
  let ultimo = null;   // { accion, args, familia } del último evento emitido
  const desconocidas = new Set();

  for (const clausula of partirEnClausulas(tokens, texto)) {
    const { marcas, tomado } = marcar(clausula, lexico);

    // lo que no ha casado con nada y tampoco es conector: se subraya
    clausula.forEach((t, i) => {
      if (tomado[i] || RELLENO.has(t.norm) || CONECTOR.has(t.norm)) return;
      tramos.push({ ini: t.ini, fin: t.fin, clase: 'nada', titulo: `«${t.crudo}» no está en el vocabulario` });
      desconocidas.add(t.crudo);
    });
    for (const m of marcas) {
      tramos.push({
        ini: m.ini, fin: m.fin, clase: m.clase,
        titulo: m.clase === 'accion' ? m.dato.nombre : `${m.dato.nombre} · ${etiquetaTipo(m.dato.tipo)}`,
      });
    }

    const acciones = marcas.filter((m) => m.clase === 'accion');
    const sujetos = marcas.filter((m) => m.clase === 'sujeto').map((m) => m.dato);

    /* --- cláusula SIN acción --------------------------------------
       O continúa la anterior («rodea el Cono 1 y el Cono 2»), o nombra
       a quien va a actuar en la siguiente («A1 y A2 cortan al aro»).
       Lo decide lo que la acción anterior sea capaz de admitir: solo
       una acción con un hueco de LISTA puede seguir sumando. */
    if (!acciones.length) {
      if (!sujetos.length) continue;
      /* Se continúa la anterior solo si TODO lo nombrado cabe en lo que
         a esa acción todavía le falta. Con ese listón, «rodea el Cono 1
         y el Cono 2 hasta el aro» sigue sumando —hay hueco de lista y un
         destino libre— y «bota hasta el codo y A2» no convierte a A2 en
         un obstáculo que nadie ha pedido: no le cabe, así que espera a
         la acción siguiente. */
      const cabe = ultimo && repartir(ultimo.accion, sujetos, ultimo.ev.args);
      if (cabe && !cabe.sobras.length) {
        // se escribe SOBRE el evento ya emitido: es la misma acción, que
        // sigue recibiendo complementos
        Object.assign(ultimo.ev.args, cabe.args);
      } else {
        pendientes.push(...sujetos);
      }
      continue;
    }

    /* --- cláusula CON acción --------------------------------------
       Los sujetos anteriores a la primera acción, más los que quedaran
       pendientes de la cláusula previa, son quien actúa. Los que no
       pueden actuar (una posición, una zona) no son un error: son un
       complemento escrito por delante. */
    const antes = marcas.filter((m) => m.clase === 'sujeto' && m.iniTok < acciones[0].iniTok).map((m) => m.dato);
    const candidatos = [...pendientes, ...antes];
    pendientes = [];
    const actores = candidatos.filter((s) => ACTORES.has(s.tipo));
    const complementosPrevios = candidatos.filter((s) => !ACTORES.has(s.tipo));

    let quienes = actores.map((s) => s.ref);
    if (!quienes.length) {
      if (!sujeto) {
        avisos.push(aviso(textoDe(texto, clausula), 'no se sabe quién lo hace: pincha antes al jugador en la pista'));
        continue;
      }
      quienes = [sujeto];
    }

    acciones.forEach((ma, k) => {
      const siguiente = acciones[k + 1];
      const complementos = marcas
        .filter((m) => m.clase === 'sujeto' && m.iniTok > ma.iniTok && (!siguiente || m.iniTok < siguiente.iniTok))
        .map((m) => m.dato);
      // los complementos escritos por delante solo cuentan para la
      // PRIMERA acción de la cláusula
      const refs = k === 0 ? [...complementosPrevios, ...complementos] : complementos;

      for (const quien of quienes) {
        const { args, sobras } = repartir(ma.dato, refs.filter((s) => s.ref !== quien));
        for (const s of sobras) {
          avisos.push(aviso(s.nombre, `«${ma.dato.nombre}» no sabe qué hacer con esto`));
        }
        for (const hueco of faltantes(ma.dato, args)) {
          avisos.push(aviso(ma.dato.nombre, `falta ${etiquetaHueco(hueco)}`));
        }
        /* Lo escrito que ya venía puesto en la acción no se repite: decir
           «entra a canasta» y «entra» es decir lo mismo, y guardar el
           argumento en un caso y no en el otro haría que dos frases
           idénticas para el motor se vieran distintas al releerlas.
           Y el destino de vuelta a la PROPIA fila es el que la acción ya
           trae: nombrarla no la convierte en otra. */
        for (const [k, v] of Object.entries(args)) {
          if (Array.isArray(v) || v === null || v === undefined) continue;
          if (v === parametroDe(ma.dato, k)) delete args[k];
        }
        if (parametroDe(ma.dato, 'destino') === 'fila_propia' && esSuFila(args.destino, quien)) delete args.destino;

        const ev = { jugador: quien, accion: ma.dato.slug, args };
        eventos.push(ev);
        ultimo = { accion: ma.dato, familia: ma.dato.familia, ev };
      }
      sujeto = quienes[quienes.length - 1];
    });
  }

  /* Una palabra que no está en ninguna de las dos listas es LA causa
     de casi todo lo que sale mal en esta línea, así que se dice
     primero y con lo que hay que hacer. Y cuando la hay, no se
     amontona encima el «nombrado pero sin acción» de los sujetos que
     se quedaron colgando: es la misma avería contada dos veces. */
  for (const palabra of desconocidas) {
    avisos.unshift(aviso(palabra, 'no está en el vocabulario: púlsala en la barra de acciones o créala'));
  }
  if (!desconocidas.size) {
    for (const s of pendientes) avisos.push(aviso(s.nombre, 'nombrado pero sin acción'));
  }

  tramos.sort((a, b) => a.ini - b.ini);
  return { eventos, avisos, tramos, sujeto, pendientes: [] };
}

/**
 * Lee todas las fases de un ejercicio. El sujeto se arrastra de una
 * fase a la siguiente: «A1 bota hasta el codo» / «tira» es lo que un
 * entrenador escribe de verdad, y repetir el nombre en cada línea es
 * exactamente el trabajo que este paso viene a quitar.
 *
 * @param fases [{ texto, duracion_ms?, pausa_post_ms? }]
 * @returns { fases: [{ eventos, duracion_ms?, pausa_post_ms? }], avisos, tramos }
 *   `tramos` viene por fase, en el mismo orden.
 */
export function leerFases(fases = [], lexico) {
  const salida = [];
  const avisos = [];
  const tramos = [];
  let estado = { sujeto: null, pendientes: [] };
  /* Quien defiende sigue defendiendo hasta que haga otra cosa.
     El arco del defensor lo dibuja el motor a partir de `fase.defensores`,
     que se llena con quien tenga un evento de rol defensor EN ESA FASE.
     Sin arrastrarlo, un defensor declarado en la fase 1 dejaría de
     dibujarse como defensor en la 2 —el jugador es el mismo y no ha
     cambiado de bando—, y eso en pantalla se lee como que ha dejado de
     defender. El evento que se arrastra va sin par y sin destino: cuenta
     el rol y no mueve a nadie. */
  const defienden = new Map();   // jugador -> { slug, par }
  const accionDe = (slug) => lexico.porSlug?.get(slug) || null;
  const esDefensiva = (slug) => Boolean(accionDe(slug) && parametroDe(accionDe(slug), 'rol') === 'defensor');

  fases.forEach((f, i) => {
    const r = leerFrase(f && f.texto, lexico, estado);
    estado = { sujeto: r.sujeto, pendientes: [] };
    tramos.push(r.tramos);
    for (const a of r.avisos) avisos.push({ ...a, fase: i + 1 });

    const yaDefiende = new Set(r.eventos.filter((e) => esDefensiva(e.accion)).map((e) => e.jugador));
    // quién se ha desplazado ESTA fase: es lo que decide si su defensor
    // tiene a quien seguir o se queda donde está
    const seMueven = new Set(r.eventos
      .filter((e) => accionDe(e.accion)?.familia === 'desplazamiento')
      .map((e) => e.jugador));

    const eventos = [...r.eventos];
    for (const [quien, d] of defienden) {
      if (yaDefiende.has(quien)) continue;
      // Con el par quieto, el defensor se queda quieto: sin esto se le
      // vería reptando hacia el aro fase tras fase sin que pase nada.
      const sigue = d.par && seMueven.has(d.par) ? d.par : null;
      eventos.push({ jugador: quien, accion: d.slug, args: { companero: sigue, destino: null }, _sigueDefendiendo: true });
    }
    for (const e of r.eventos) {
      if (!esDefensiva(e.accion)) continue;
      defienden.set(e.jugador, { slug: e.accion, par: e.args?.companero ?? defienden.get(e.jugador)?.par ?? null });
    }

    const fase = { eventos };
    // Duración y pausa de ESTA fase, si el entrenador las tocó en la
    // cabecera. Sin ellas manda el criterio de siempre del compilador
    // (un tiro dura lo que dura un tiro).
    if (Number.isFinite(f?.duracion_ms)) fase.duracion_ms = f.duracion_ms;
    if (Number.isFinite(f?.pausa_post_ms)) fase.pausa_post_ms = f.pausa_post_ms;
    salida.push(fase);
  });
  return { fases: salida, avisos, tramos };
}

/** ¿El destino es la cola de la que salió el propio actor? */
function esSuFila(destino, actor) {
  const d = /^fila(\d+)/.exec(String(destino ?? ''));
  const a = /^fila(\d+)/.exec(String(actor ?? ''));
  return Boolean(d && a && d[1] === a[1]);
}

/* ── Escribir: el camino de vuelta ─────────────────────────── */

/*
   El paso 2 tiene DOS caras de lo mismo: la línea escrita y el panel
   «Manualmente», donde cada acción se cambia con desplegables. Si cada
   una guardara su propio estado habría dos verdades, y en cuanto se
   separaran nadie sabría cuál manda — que es exactamente lo que hacía
   confuso el paso 2 anterior.

   Aquí solo hay una: el TEXTO. El panel enseña lo que el lector ha
   entendido y, al cambiar algo, vuelve a escribir la línea. Por eso
   hace falta el camino de vuelta, y por eso el banco de pruebas exige
   que leer→escribir→leer dé exactamente los mismos eventos: si no lo
   diera, tocar un desplegable cambiaría la jugada por su cuenta.
*/

/** Con qué palabra se introduce cada hueco al escribirlo. */
const PREPOSICION = {
  companero: 'a',
  sorteando: 'el',
  destino: { desplazamiento: 'hasta', balon: 'a', entre_dos: 'en', gesto: 'hacia' },
  hacia: 'hacia',
  balon: 'el',
};

/* El orden en que se escriben los complementos: con quién, qué sortea,
   a dónde, con qué balón. Es el orden en que se dicen en voz alta. */
const ORDEN_ESCRITURA = ['companero', 'sorteando', 'destino', 'hacia', 'balon'];

const preposicionDe = (hueco, familia) => {
  const p = PREPOSICION[hueco];
  return (p && typeof p === 'object') ? (p[familia] || '') : (p || '');
};

/**
 * Un evento escrito como se diría. Sin el sujeto: lo pone
 * `escribirFrase`, que sabe si ha cambiado respecto al anterior.
 */
export function escribirEvento(ev, { lexico, nombreDe } = {}) {
  const accion = lexico?.porSlug?.get(ev.accion);
  if (!accion) return '';
  const partes = [accion.nombre];
  const args = ev.args || {};
  for (const hueco of ORDEN_ESCRITURA) {
    const v = args[hueco];
    if (v === undefined || v === null || v === '') continue;
    // un punto suelto no tiene nombre que escribir: es un retoque de
    // flecha, y vive en la capa de ediciones, no en la frase
    if (typeof v === 'object' && !Array.isArray(v)) continue;
    const prep = preposicionDe(hueco, accion.familia);
    const lista = Array.isArray(v) ? v : [v];
    if (!lista.length) continue;
    const texto = lista.map((r) => `${prep ? `${prep} ` : ''}${nombreDe(r)}`).join(' y ');
    partes.push(texto);
  }
  return partes.join(' ');
}

/**
 * Una línea entera desde sus eventos. El sujeto se escribe solo cuando
 * CAMBIA: es como se habla, y es lo que el lector espera de vuelta.
 *
 * @param eventos  los del lector (los arrastrados —un defensor que sigue
 *                 defendiendo— no se escriben: no los puso nadie)
 * @param opts.lexico     el de crearLexico()
 * @param opts.nombreDe   referencia → nombre que se lee
 * @param opts.sujeto     quién actuaba al acabar la línea anterior
 */
export function escribirFrase(eventos = [], { lexico, nombreDe, sujeto = null } = {}) {
  const nombre = typeof nombreDe === 'function' ? nombreDe : (r) => String(r);
  const trozos = [];
  let actor = sujeto;
  for (const ev of eventos) {
    if (!ev || ev._sigueDefendiendo) continue;
    const cuerpo = escribirEvento(ev, { lexico, nombreDe: nombre });
    if (!cuerpo) continue;
    if (ev.jugador !== actor) {
      trozos.push(`${nombre(ev.jugador)} ${cuerpo.charAt(0).toLowerCase()}${cuerpo.slice(1)}`);
      actor = ev.jugador;
    } else {
      trozos.push(`${cuerpo.charAt(0).toLowerCase()}${cuerpo.slice(1)}`);
    }
  }
  const linea = trozos.join(', ');
  return linea ? linea.charAt(0).toUpperCase() + linea.slice(1) : '';
}

/** Quién actúa en cada fase (el primer evento que alguien escribió). */
export function actoresDe(fases = []) {
  return fases.map((f) => {
    const propio = (f?.eventos || []).find((e) => e && !e._sigueDefendiendo);
    return propio ? propio.jugador : null;
  });
}

/**
 * Congela el sujeto de las fases que se apoyaban en la anterior.
 *
 * ── EL PROBLEMA ─────────────────────────────────────────────
 * Que el sujeto se arrastre entre fases es lo que permite escribir
 * «bota hacia el aro / tira / recoge» sin repetir el nombre — la mitad
 * del «casi sin escribir» del paso 2. Pero tiene un precio: cambiar
 * quién actúa en la fase 1 cambia, en silencio, quién actúa en las
 * cuatro siguientes. Y el panel «Manualmente» promete justo lo
 * contrario: corregir UNA acción de UNA fase sin tocar nada más.
 *
 * ── LO QUE HACE ─────────────────────────────────────────────
 * Compara quién actuaba antes con quién actuaría ahora y, a las fases
 * donde eso haya cambiado, les escribe el nombre delante. Solo a esas:
 * las que ya lo decían, o las que no se ven afectadas, se quedan con
 * las palabras que puso el entrenador.
 *
 * Se recorre fase a fase releyendo, porque anclar una arregla también
 * a la siguiente y no hay que tocarla dos veces.
 *
 * @param fasesTexto [{ texto, … }] — no se muta
 * @param actores    quién actuaba en cada fase ANTES del cambio
 * @returns fasesTexto nuevas
 */
export function anclarSujetos(fasesTexto = [], lexico, { nombreDe, actores = [], desde = 0 } = {}) {
  const nombre = typeof nombreDe === 'function' ? nombreDe : (r) => String(r);
  const salida = fasesTexto.map((f) => ({ ...f }));
  for (let k = desde + 1; k < salida.length; k++) {
    const previo = actores[k];
    if (!previo) continue;
    const ahora = actoresDe(leerFases(salida, lexico).fases)[k];
    if (ahora === previo) continue;
    const texto = String(salida[k].texto || '').trim();
    if (!texto) continue;
    salida[k] = { ...salida[k], texto: `${nombre(previo)} ${texto.charAt(0).toLowerCase()}${texto.slice(1)}` };
  }
  return salida;
}

/* ── Ayudas de redacción ───────────────────────────────────── */

const ETIQUETA_TIPO = {
  jugador: 'jugador', fila: 'fila', fila_miembro: 'de la fila', cono: 'cono',
  zona: 'zona', balon: 'balón', material: 'material', aro: 'canasta', posicion: 'posición',
};
function etiquetaTipo(t) { return ETIQUETA_TIPO[t] || t; }

const ETIQUETA_HUECO = {
  destino: 'decir a dónde', companero: 'decir con quién', sorteando: 'decir qué rodea',
  balon: 'decir qué balón', hacia: 'decir hacia dónde', atacantes: 'decir quién ataca',
  defensores: 'decir quién defiende',
};
function etiquetaHueco(h) { return ETIQUETA_HUECO[h] || `el dato «${h}»`; }

/** El trozo de texto que ocupa una cláusula (para citarla en un aviso). */
function textoDe(texto, clausula) {
  if (!clausula.length) return '';
  return String(texto).slice(clausula[0].ini, clausula[clausula.length - 1].fin);
}

/**
 * Lo que la barra de acciones escribe al pulsar una acción: su nombre y,
 * si le falta algo, la preposición que invita a completarlo. Escribir
 * «Pasa a » y dejar el cursor detrás es la diferencia entre una barra
 * que ayuda y una que obliga a acordarse de la sintaxis.
 */
export function textoDeAccion(accion) {
  const pide = Array.isArray(accion.pide) ? accion.pide : [];
  if (pide.includes('companero')) return `${accion.nombre} a `;
  if (pide.includes('sorteando')) return `${accion.nombre} el `;
  if (pide.includes('destino')) return `${accion.nombre} hasta `;
  return accion.nombre;
}
