/* ============================================================
   ia/puente.js — EL PUENTE AL CHAT (Tramo 2.12). Módulo PURO.

   ── QUÉ ES ──────────────────────────────────────────────────
   La app arma el envío, el entrenador lo pega en su chat, trae la
   respuesta y la app la vuelca en los campos (§2). No hay llamada de
   red, ni clave, ni coste: el trabajo lo hace la suscripción que el
   entrenador ya paga, y la app se encarga de las dos partes tediosas
   —redactar la pregunta bien y colocar la respuesta donde va—.

   ── POR QUÉ ASÍ Y NO CON UNA API ────────────────────────────
   Porque la API se factura por tokens y es un producto separado de la
   suscripción (§2). Esa es toda la razón, y es suficiente.

   ── LO QUE DECIDE QUE ESTO FUNCIONE ─────────────────────────
   Que la respuesta se pueda VOLCAR sin releerla a mano. Por eso el
   envío no pide «una ficha»: pide un JSON con nombres de campo
   exactos y con las listas cerradas de valores legales dentro. Un
   modelo al que se le enseña el hueco lo rellena; a uno al que se le
   pide prosa hay que copiarle a mano nueve campos.

   Y por eso el lector de abajo es TOLERANTE: acepta el JSON pelado,
   el JSON dentro de una valla de código y el JSON con texto delante y
   detrás, que es lo que devuelve un chat de verdad.
   ============================================================ */

import {
  BLOQUE_KEYS, TAGS, DENSIDAD_KEYS, OPOSICION, PRESION,
  NIVELES_EXIGENCIA, ORGANIZACION_REFERENCIA, MATERIAL_SUGERIDO,
} from './vocabulario.js';

/* ── El envío ──────────────────────────────────────────────── */

/* Los valores legales van DENTRO de la cadena, no como una unión de
   tipos: así el molde del envío es JSON válido y el modelo tiene un
   objeto exacto que imitar en vez de una gramática que interpretar.
   Con `"densidad": "alta" | "media" | "baja"` había que adivinar si se
   copia la barra; con `"densidad": "uno de: alta | media | baja"` no. */
const lista = (xs) => `uno de: ${xs.join(' | ')}`;

/**
 * El texto que el entrenador pega en su chat.
 *
 * Lleva TRES cosas y ninguna más: lo que ya sabemos del ejercicio (lo
 * que se ha dibujado y descrito), el hueco exacto que hay que rellenar
 * y las reglas que la biblioteca va a exigir después. Poner las reglas
 * aquí es lo que evita la segunda vuelta: sin ellas el modelo escribe
 * «se adapta al grupo» en la organización y el linter lo rechaza.
 */
export function armarEnvio(d, { guion = '' } = {}) {
  const r = d.requisitos || {};
  const sabemos = [
    ['Nombre', d.nombre],
    ['Tipo', d.tipo],
    ['Pista', d.tipo_pista],
    ['Rama', d.categoria_rama],
    ['Duración', d.duracion_min && `${d.duracion_min}–${d.duracion_max} min`],
    ['Jugadores en la pizarra', r.jugadores_min],
    ['Lo que pasa en la pista', guion || d.descripcion_texto],
  ].filter(([, v]) => v != null && v !== '').map(([k, v]) => `- ${k}: ${v}`).join('\n');

  return `Eres entrenador de baloncesto de formación y escribes fichas de ejercicio para el cuerpo técnico de un club.

ESTE ES EL EJERCICIO:
${sabemos}

Devuélveme SOLO un bloque JSON con esta forma exacta, sin texto alrededor:

{
  "description": "una sola frase, concreta, que se lee en la tarjeta. Sin adjetivos de folleto.",
  "category": "${lista(BLOQUE_KEYS)}",
  "objetivos": "qué se entrena y PARA QUÉ, con el porqué dentro. Una o dos frases.",
  "descripcion_texto": "el desarrollo: montaje, reglas, rotación y cuándo se acaba. Es lo que se lee con los niños ya en la pista.",
  "notas": "el oficio: qué corregir, qué NO corregir y qué hacer si no sale.",
  "tags": ["2 a 5 del vocabulario de abajo, EXACTAMENTE como están escritas"],
  "requisitos": {
    "jugadores_min": 0,
    "jugadores_max": 0,
    "canastas": 0,
    "estaciones": 1,
    "simultaneo": true,
    "material": ["de esta lista o cualquier otro: ${MATERIAL_SUGERIDO.join(' | ')}"],
    "densidad": "${lista(DENSIDAD_KEYS)}",
    "oposicion": "${lista(OPOSICION)}",
    "presion": "${lista(PRESION)}",
    "requisito_previo": "qué hay que SABER HACER ya. Nunca una edad ni una categoría.",
    "organizacion": "qué se hace con ${ORGANIZACION_REFERENCIA} jugadores: tiene que decir el número ${ORGANIZACION_REFERENCIA} y un reparto concreto (grupos, parejas, filas, estaciones…).",
    "criterio_exito": "cuándo está bien hecho, medible.",
    "niveles": {
      "base": "el escalón fácil",
      "intermedio": "el de en medio",
      "avanzado": "el difícil"
    },
    "aplicacion": "solo si etiquetas 'analítico': en qué formato de juego se usa lo que entrena.",
    "justificacion_densidad": "solo si la densidad es 'baja': por qué merece la pena."
  }
}

REGLAS QUE SE COMPRUEBAN DESPUÉS (si no se cumplen, hay que rehacerlo):
- Los tres niveles tienen que decir tres cosas DISTINTAS, no la misma con otras palabras. Sustituyen a la etiqueta de edad.
- "organizacion" tiene que contener el número ${ORGANIZACION_REFERENCIA} y un reparto concreto. "Se adapta al grupo" no vale.
- "requisito_previo" es un saber hacer ("botar en carrera sin mirar el balón"), jamás una edad ("a partir de alevín").
- "oposicion" es si hay alguien a quien ganar o que te quita el balón. "presion" es lo que aprieta cuando no hay rival (el reloj, el espacio, el marcador). Son dos preguntas distintas.
- Los tags salen SOLO de esta lista: ${TAGS.join(', ')}.
- Los niveles se llaman exactamente ${NIVELES_EXIGENCIA.join(', ')}.`;
}

/* ── La respuesta ──────────────────────────────────────────── */

/**
 * Saca el JSON de lo que sea que haya pegado el entrenador: el bloque
 * pelado, dentro de una valla ```json, o con dos párrafos de cortesía
 * delante. Se busca la llave que abre y la que cierra, y se prueba;
 * es más robusto que cualquier regex sobre un formato que no
 * controlamos.
 */
export function extraerJSON(texto) {
  const s = String(texto || '').trim();
  if (!s) return null;
  const valla = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidatos = [valla && valla[1], s].filter(Boolean);
  for (const c of candidatos) {
    const i = c.indexOf('{');
    const j = c.lastIndexOf('}');
    if (i < 0 || j <= i) continue;
    try { return JSON.parse(c.slice(i, j + 1)); } catch { /* siguiente */ }
  }
  return null;
}

/** Campos de primer nivel que el puente sabe volcar. */
const CAMPOS = ['description', 'category', 'objetivos', 'descripcion_texto', 'notas', 'tags'];
const REQUISITOS = [
  'jugadores_min', 'jugadores_max', 'canastas', 'estaciones', 'simultaneo', 'material',
  'densidad', 'oposicion', 'presion', 'requisito_previo', 'organizacion', 'criterio_exito',
  'aplicacion', 'justificacion_densidad',
];

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Vuelca la respuesta sobre el borrador.
 *
 * No pisa lo que el entrenador ya ha escrito: si un campo tiene algo,
 * se queda. Lo que llega se ofrece para los huecos. Es la diferencia
 * entre una ayuda y un secuestro — y evita el caso feo de pedir una
 * segunda opinión y perder media ficha propia.
 *
 * @returns { puestos, ignorados } — nombres de campo, para poder DECIR
 *   qué ha entrado y qué se ha respetado.
 */
export function volcar(d, respuesta, { pisar = false } = {}) {
  const j = extraerJSON(respuesta);
  if (!j || typeof j !== 'object') return { error: 'No he encontrado el bloque JSON en lo que has pegado. Copia la respuesta entera del chat, con las llaves incluidas.' };

  const puestos = [];
  const ignorados = [];
  const poner = (obj, clave, valor, etiqueta) => {
    if (valor === null || valor === undefined || valor === '') return;
    const actual = obj[clave];
    const vacio = actual === null || actual === undefined || actual === ''
      || (Array.isArray(actual) && !actual.length);
    if (!vacio && !pisar) { ignorados.push(etiqueta); return; }
    obj[clave] = valor;
    puestos.push(etiqueta);
  };

  for (const k of CAMPOS) {
    if (k === 'tags') poner(d, k, Array.isArray(j.tags) ? j.tags.map(texto).filter(Boolean) : null, 'etiquetas');
    else poner(d, k, texto(j[k]), k);
  }

  const rj = j.requisitos && typeof j.requisitos === 'object' ? j.requisitos : {};
  d.requisitos = d.requisitos || {};
  for (const k of REQUISITOS) {
    const v = rj[k];
    if (k === 'material') poner(d.requisitos, k, Array.isArray(v) ? v.map(texto).filter(Boolean) : null, 'material');
    else if (k === 'simultaneo') { if (typeof v === 'boolean') poner(d.requisitos, k, v, k); }
    else if (['jugadores_min', 'jugadores_max', 'canastas', 'estaciones'].includes(k)) poner(d.requisitos, k, numero(v), k);
    else poner(d.requisitos, k, texto(v), k);
  }

  /* Los tres niveles van juntos o no van: medio escalón es peor que
     ninguno, porque el linter lo da por relleno y nadie lo revisa. */
  const nj = rj.niveles && typeof rj.niveles === 'object' ? rj.niveles : {};
  d.requisitos.niveles = d.requisitos.niveles || { base: '', intermedio: '', avanzado: '' };
  for (const n of NIVELES_EXIGENCIA) poner(d.requisitos.niveles, n, texto(nj[n]), `nivel ${n}`);

  return { puestos, ignorados };
}
