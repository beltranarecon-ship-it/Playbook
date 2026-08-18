/* ============================================================
   ia/sujetos.js — TODO LO QUE TIENE NOMBRE EN LA PISTA (Tramo 2.9).
   Módulo PURO: sin DOM, sin red.

   ── POR QUÉ EXISTE ──────────────────────────────────────────
   El paso 2 nuevo se apoya en una idea sencilla: el entrenador no
   escribe coordenadas ni ids, escribe NOMBRES —«A1», «la Fila 1», «el
   codo derecho», «ZONA A»— y pincha en la pista para insertarlos.

   Para que eso funcione hacen falta las dos direcciones del mismo
   diccionario, y tienen que ser LA MISMA lista:

     · de elemento a nombre — clic en una ficha → el texto que se
       inserta en la descripción;
     · de nombre a referencia — lo escrito → el id que entiende el
       compilador ('A1', 'fila1', 'cono_3', 'codo_der', 'aro').

   Si fueran dos listas distintas pasaría lo de siempre: el clic
   insertaría un nombre que el lector no reconoce, y el entrenador
   vería su propia palabra subrayada en rojo. Aquí se generan las dos
   del mismo sitio, así que eso no puede pasar.

   ── LO QUE UN SUJETO NO ES ──────────────────────────────────
   No es una coordenada. `ref` es siempre una REFERENCIA que el
   compilador resuelve con la pista puesta: el nombre de una posición,
   el id de un jugador, 'aro'. Guardar aquí un [x,y] convertiría cada
   descripción en algo que solo vale para la pista en la que se
   escribió, que es justo lo que el catálogo de acciones evita.
   ============================================================ */

import { posicionesDe } from '../canvas/anclas.js';
import { sintetizarJugadores } from './compilador.js';

/* ── Normalización ─────────────────────────────────────────── */

/*
   La MISMA que usa el catálogo de acciones (acciones.js#normalizarNombre
   + su lista de relleno). Tiene que ser idéntica: acciones y sujetos se
   buscan sobre el mismo flujo de palabras, y si una tolerase «el» y la
   otra no, la frase se partiría en un sitio distinto según qué se
   estuviera buscando.
*/
export const RELLENO = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'a', 'en', 'se', 'y']);

/** minúsculas, sin tildes, sin signos. */
export function normalizar(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** La forma con la que una frase entra en el índice: sin relleno. */
export function clave(s) {
  return normalizar(s).split(' ').filter((t) => t && !RELLENO.has(t)).join(' ');
}

/* ── Nombres de cara al entrenador ─────────────────────────── */

const ORDINAL = ['', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º'];
const ORDINAL_PALABRA = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'septimo', 'octavo', 'noveno', 'decimo'];

/*
   Las catorce anclas medidas, con el nombre que un entrenador usa en
   pista. Las claves son las de canvas/medidas.js#anclasEnMetros: si
   mañana se añade una, aquí falta su nombre y el banco lo dice.

   'aro' no está a propósito: la canasta se nombra aparte («el aro»,
   «la canasta»), porque no es un sitio más de la lista sino EL
   objetivo del ejercicio, y como destino significa «hasta la canasta
   a la que se ataca», no «hasta este punto».
*/
export const NOMBRE_ANCLA = {
  base: 'Base',
  centro: 'Centro',
  tiro_libre: 'Tiro libre',
  escolta_der: 'Escolta derecho',
  escolta_izq: 'Escolta izquierdo',
  alero_der: 'Alero derecho',
  alero_izq: 'Alero izquierdo',
  esquina_der: 'Esquina derecha',
  esquina_izq: 'Esquina izquierda',
  codo_der: 'Codo derecho',
  codo_izq: 'Codo izquierdo',
  poste_bajo_der: 'Poste bajo derecho',
  poste_bajo_izq: 'Poste bajo izquierdo',
  poste_alto_der: 'Poste alto derecho',
  poste_alto_izq: 'Poste alto izquierdo',
};

/** Un slug custom («posicion_1», «codo_falso») escrito como se lee. */
export function nombreDeSlug(slug) {
  // Las que crea un clic en la pista se enseñan bien escritas. El slug
  // no lleva tilde —es una clave, y una clave con tilde es una clave
  // que alguien acabará escribiendo de dos maneras—, pero lo que se
  // lee en pantalla y en la descripción sí. Da igual para buscarla:
  // `clave()` quita las tildes antes de comparar.
  const auto = /^posicion_(\d+)$/.exec(String(slug ?? ''));
  if (auto) return `Posición ${auto[1]}`;
  const s = String(slug ?? '').replace(/_/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

/* ── El diccionario ────────────────────────────────────────── */

/**
 * Un sujeto:
 *   id      identidad estable dentro de la lista (para el UI)
 *   nombre  el texto que se INSERTA al pinchar y que se lee al escribir
 *   alias   otras formas admitidas al escribirlo a mano
 *   tipo    'jugador' | 'fila' | 'fila_miembro' | 'cono' | 'zona' |
 *           'balon' | 'material' | 'aro' | 'posicion'
 *   ref     lo que va al intent: id de jugador, nombre de zona, slug de
 *           posición, id de elemento o 'aro'
 *   x, y    dónde está, para el UI (resaltar al pasar por encima).
 *           NO se usa para compilar: eso es cosa de `ref`.
 */
const S = (s) => ({ alias: [], x: null, y: null, ...s });

/**
 * Todo lo que se puede nombrar con este tablero y esta pista.
 *
 * @param elementos  array crudo del tablero (kind: jugador|balon|cono|zona|…)
 * @param pista      'entera' | 'entera_fiba' | 'media' | 'media_fiba'
 * @param canasta    'norte' | 'sur' — a la que ataca el ejercicio
 * @param posiciones diccionario custom { slug: [x,y] } de ESTA pista
 * @returns sujeto[]  en el orden en que conviene enseñarlos
 */
export function sujetosDelTablero({ elementos = [], pista = 'entera', canasta = 'norte', posiciones = null } = {}) {
  const out = [];
  const J = sintetizarJugadores(elementos, pista);
  const jugadoresBoard = elementos.filter((e) => e.kind === 'jugador');
  const conos = elementos.filter((e) => e.kind === 'cono');
  const filas = conos.filter((c) => c.funcion === 'fila' && c.fila_config && (c.fila_config.n_jugadores || 0) > 0);

  /* --- jugadores colocados a mano ---------------------------------
     El nombre es 'A1' porque es lo que se ve escrito en la ficha. El
     dorsal y el nombre propio, si los tiene, son alias: nadie que haya
     puesto un dorsal quiere escribir 'A1' para referirse al 7. */
  for (const e of jugadoresBoard) {
    const id = `${e.equipo}${e.label}`;
    const alias = [`jugador ${id}`];
    // El dorsal como alias va con su palabra delante. «el 7», a secas, se
    // comería cualquier número suelto de la frase —«el 7» y «Posición 7»
    // empiezan igual— y el entrenador vería resaltada una cosa por otra.
    if (e.dorsal != null && String(e.dorsal).trim()) alias.push(`dorsal ${e.dorsal}`);
    if (e.nombre && String(e.nombre).trim()) alias.push(String(e.nombre).trim());
    out.push(S({ id, nombre: id, alias, tipo: 'jugador', ref: id, x: e.x, y: e.y }));
  }

  /* --- filas -------------------------------------------------------
     Pinchar el CONO de una fila es referirse a la fila entera; pinchar
     a uno de sus jugadores es referirse a ese, que hará algo distinto
     (§5.2). Son dos sujetos diferentes y por eso están los dos aquí. */
  filas.forEach((c, i) => {
    const n = i + 1;
    const idFila = `fila${n}`;
    const frente = J.find((j) => j.id === idFila);
    const alias = [`cola ${n}`, `la fila ${n}`, idFila];
    // «la fila», a secas, solo vale cuando no hay dos: si no, sería
    // adivinar cuál, y adivinar es lo que este paso 2 viene a quitar.
    if (filas.length === 1) alias.push('fila', 'cola');
    out.push(S({
      id: idFila, nombre: `Fila ${n}`, alias, tipo: 'fila', ref: idFila,
      x: frente ? frente.x : c.x, y: frente ? frente.y : c.y,
    }));

    const total = c.fila_config.n_jugadores || 0;
    for (let k = 2; k <= total; k++) {
      const id = `${idFila}_${k}`;
      const j = J.find((p) => p.id === id);
      if (!j) break;   // sin rondas la cola solo es direccionable hasta el 5º
      const orden = ORDINAL[k] || `${k}º`;
      out.push(S({
        id, nombre: `${orden} de la Fila ${n}`, tipo: 'fila_miembro', ref: id,
        alias: [
          `${ORDINAL_PALABRA[k] || k} de la fila ${n}`,
          `jugador ${k} de la fila ${n}`,
          `${k} de la fila ${n}`,
          id,
        ],
        x: j.x, y: j.y,
      }));
    }
  });

  /* --- zonas -------------------------------------------------------
     La referencia de una zona es su NOMBRE, no su id: es lo que
     resuelve el compilador (zonaPorNombre) y lo que el entrenador
     escribió al crearla. Renombrar la zona renombra la referencia, que
     es exactamente lo que espera quien la renombra. */
  for (const z of elementos.filter((e) => e.kind === 'zona' && String(e.nombre ?? '').trim())) {
    const nombre = String(z.nombre).trim();
    out.push(S({ id: z.id, nombre, alias: [`zona ${nombre}`], tipo: 'zona', ref: nombre, x: (z.x + z.x2) / 2, y: (z.y + z.y2) / 2 }));
  }

  /* --- conos ------------------------------------------------------
     Los conos de fila ya están arriba, como filas: pinchar el cono de
     una fila es referirse a la fila entera, no al cono.

     Dos contadores, y no es un descuido: el NÚMERO QUE SE VE cuenta
     solo los conos sueltos —enseñar «Cono 2» cuando en la pista hay un
     único cono no lo encuentra nadie—, mientras que el id de repuesto
     de un cono sin id sigue siendo su índice en el tablero, que es el
     que usa el compilador. */
  let iTablero = 0, nVisible = 0;
  for (const c of conos) {
    iTablero++;
    if (c.funcion === 'fila' && c.fila_config && (c.fila_config.n_jugadores || 0) > 0) continue;
    nVisible++;
    const ref = c.id || `cono_${iTablero}`;
    out.push(S({ id: ref, nombre: `Cono ${nVisible}`, alias: [ref], tipo: 'cono', ref, x: c.x, y: c.y }));
  }

  /* --- balones ---------------------------------------------------- */
  elementos.filter((e) => e.kind === 'balon').forEach((b, i) => {
    const ref = b.id || `balon_${i + 1}`;
    out.push(S({ id: ref, nombre: `Balón ${i + 1}`, alias: [ref, `balon ${i + 1}`], tipo: 'balon', ref, x: b.x, y: b.y }));
  });

  /* --- material ---------------------------------------------------- */
  let nEsc = 0, nPel = 0;
  for (const e of elementos) {
    if (e.kind !== 'escalera' && e.kind !== 'pelota') continue;
    const n = e.kind === 'escalera' ? ++nEsc : ++nPel;
    const etiqueta = e.kind === 'escalera' ? 'Escalera' : 'Pelota';
    const ref = e.id || `mat_${nEsc + nPel}`;
    out.push(S({ id: ref, nombre: `${etiqueta} ${n}`, alias: [ref], tipo: 'material', ref, x: e.x, y: e.y }));
  }

  /* --- la canasta --------------------------------------------------
     Una sola, sin número: como destino, 'aro' significa «la canasta a
     la que ataca este ejercicio». Cuál sea es una propiedad del
     ejercicio (el chip de canasta), no de cada frase. */
  const anclas = posicionesDe(pista, canasta) || {};
  out.push(S({
    id: 'aro', nombre: 'el aro', tipo: 'aro', ref: 'aro',
    alias: ['aro', 'canasta', 'la canasta', 'el aro', 'cesta'],
    x: anclas.aro ? anclas.aro[0] : null, y: anclas.aro ? anclas.aro[1] : null,
  }));

  /* --- posiciones con nombre ---------------------------------------
     Primero las del entrenador (mandan sobre las estándar, igual que en
     ia/posiciones.js) y luego las catorce anclas medidas. */
  const vistos = new Set();
  for (const [slug, xy] of Object.entries(posiciones || {})) {
    if (!Array.isArray(xy) || xy.length < 2) continue;
    vistos.add(slug);
    out.push(S({
      id: `pos:${slug}`, nombre: nombreDeSlug(slug), alias: [slug], tipo: 'posicion',
      ref: slug, x: Number(xy[0]), y: Number(xy[1]), custom: true,
    }));
  }
  for (const [slug, nombre] of Object.entries(NOMBRE_ANCLA)) {
    if (vistos.has(slug) || !anclas[slug]) continue;
    out.push(S({
      id: `pos:${slug}`, nombre, alias: [slug], tipo: 'posicion',
      ref: slug, x: anclas[slug][0], y: anclas[slug][1],
    }));
  }

  return out;
}

/* ── Índice para leer ──────────────────────────────────────── */

/**
 * Índice frase→sujeto. Con dos sujetos que se llamen igual gana el
 * PRIMERO —el orden de `sujetosDelTablero` no es casual: las fichas
 * del tablero van antes que las anclas, así que una zona llamada
 * «Base» tapa al ancla `base` mientras exista, que es lo que quiere
 * quien la ha puesto y nombrado.
 */
export function indexarSujetos(sujetos = []) {
  const idx = new Map();
  for (const s of sujetos) {
    for (const n of [s.nombre, ...(s.alias || [])]) {
      const k = clave(n);
      // Una clave que es solo un número se comería cualquier cifra de la
      // frase: el «1» de «Cono 1» acabaría señalando a un jugador. Los
      // números solo cuentan acompañados de su palabra.
      if (!k || /^[0-9]+$/.test(k) || idx.has(k)) continue;
      idx.set(k, s);
    }
  }
  return idx;
}

/** Busca un sujeto por su `ref` (para pintar de vuelta lo compilado). */
export function porRef(sujetos = [], ref) {
  return sujetos.find((s) => s.ref === ref) || null;
}

/* ── Nombres nuevos ────────────────────────────────────────── */

/**
 * El siguiente «Posición N» libre. Se pincha un punto de la pista y
 * hay que llamarlo de ALGO antes de que el entrenador decida cómo; el
 * número se elige mirando lo que ya existe para no pisar una posición
 * guardada de otro ejercicio.
 */
export function siguientePosicion(posiciones = {}) {
  const usados = new Set(Object.keys(posiciones || {}));
  let n = 1;
  while (usados.has(`posicion_${n}`)) n++;
  return `posicion_${n}`;
}
