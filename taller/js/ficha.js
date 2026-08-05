/* ============================================================
   ficha.js — cómo se LEE una ficha de ejercicio. Módulo puro: sin DOM,
   sin red, sin canvas.

   Existe porque la misma ficha se enseña en dos sitios con dos motores
   de plantillas distintos —la vista de detalle del Taller y el visor
   embebido del planificador— y la lógica de "cómo se escribe una dosis
   en castellano" o "cómo se parten los tres niveles de exigencia" no
   puede vivir dos veces: en cuanto vive dos veces, diverge, y el
   entrenador ve dos fichas distintas del mismo ejercicio. Ya pasó: una
   vista enseñaba el desarrollo y la otra no.

   Cada vista pone el HTML; esto pone el texto.
   ============================================================ */

export const PISTA_LABEL = {
  entera: 'Pista entera',
  media: 'Media pista',
  entera_fiba: 'Entera · triple FIBA',
  media_fiba: 'Media · triple FIBA',
};

/* Los dos ejes de la doctrina, explicados al pasar por encima: el chip
   dice el nivel y el title dice qué significa, para que no haya que
   tener el documento abierto al lado. */
export const DENSIDAD_AYUDA = {
  alta: 'cada jugador hace 4 o más acciones por minuto',
  media: 'entre 2 y 4 acciones por jugador y minuto',
  baja: 'menos de 2 acciones por jugador y minuto',
};

export const OPOSICION_AYUDA = {
  nula: 'sin defensor: el gesto se aprende limpio',
  pasiva: 'el defensor está, pero no disputa',
  semiactiva: 'el defensor condiciona sin llegar a impedir',
  real: 'defensa de verdad, se puede perder el balón',
};

/* El tercer eje, y el que faltaba. `oposicion` respondía a dos
   preguntas a la vez —"¿hay rival?" y "¿esto aprieta?"— y por eso diez
   fichas decían tener oposición sin un solo defensor: el compañero que
   levanta dedos, el que devuelve el rebote, el equipo que tira a la
   vez. Ninguno disputa nada, y los tres ejercicios aprietan. Aquí va
   lo que aprieta cuando no hay nadie enfrente. */
export const PRESION_AYUDA = {
  ninguna: 'nada aprieta: se repite el gesto tranquilo',
  espacio: 'el espacio se comparte o se estrecha',
  tiempo: 'hay una señal o un reloj al que responder ya',
  marcador: 'se compite: tanteo, duelo o récord',
};

/**
 * "4 series × 5 repeticiones · 40 s de descanso".
 *
 * La UNIDAD no es decorativa: en un juego continuo `cantidad: 240`
 * son 240 segundos de juego, no 240 repeticiones. Escribirlo mal
 * convierte un juego de 4 minutos en una serie imposible.
 */
export function textoDosis(d) {
  if (!d || typeof d !== 'object') return null;
  const cantidad = Number(d.cantidad) || 0;
  const unidad = d.unidad === 'segundos'
    ? (cantidad === 1 ? 'segundo' : 'segundos')
    : (cantidad === 1 ? 'repetición' : 'repeticiones');
  const partes = [];
  if (d.series) partes.push(`${d.series} ${d.series === 1 ? 'serie' : 'series'}`);
  if (cantidad) partes.push(`${cantidad} ${unidad}`);
  if (!partes.length) return null;
  const trabajo = partes.join(' × ');
  return d.descanso ? `${trabajo} · ${d.descanso} s de descanso` : trabajo;
}

/** "4–12" a partir de jugadores_min/jugadores_max, o null si no hay dato. */
export function textoJugadores(r) {
  const min = r?.jugadores_min, max = r?.jugadores_max;
  if (min == null) return null;
  return (max != null && max !== min) ? `${min}–${max}` : String(min);
}

/** "1 por estación" / "1" / "ninguna". */
export function textoCanastas(r) {
  if (r?.canastas == null) return null;
  if (r.canastas === 0) return 'ninguna';
  return r.estaciones > 1 ? `${r.canastas} por estación` : String(r.canastas);
}

/** "8–12 min" o "10 min". */
export function textoDuracion(ej) {
  if (!ej?.duration_min) return null;
  const { duration_min: a, duration_max: b } = ej;
  return (b && b !== a) ? `${a}–${b} min` : `${a} min`;
}

/** Los tres escalones, en orden. Es el eje que ordena la biblioteca. */
export const NIVELES = ['base', 'intermedio', 'avanzado'];

/**
 * Los tres escalones de exigencia de una ficha, vengan de donde vengan.
 *
 * Primero mira el DATO (`requisitos.niveles`), que es como está la
 * biblioteca desde que se estructuró. Si no lo hay —un ejercicio
 * escrito a mano en el Taller, que tiene un hueco de texto libre— cae a
 * partir la prosa de `variantes`. Y si tampoco casa, devuelve null y
 * quien llama enseña `variantes` tal cual: nunca se pierde contenido.
 *
 * Que exista el respaldo no lo convierte en lo mismo: partir prosa es
 * una regla de formato tácita, y una ficha que no la siga se enseñaba
 * como un párrafo denso sin que nadie se enterara.
 */
export function nivelesDe(ficha) {
  const n = ficha?.requisitos?.niveles;
  if (n && typeof n === 'object') {
    const escalones = NIVELES
      .filter((k) => String(n[k] || '').trim())
      .map((k) => ({ nivel: k[0].toUpperCase() + k.slice(1), clave: k, texto: String(n[k]).trim() }));
    if (escalones.length) return escalones;
  }
  return niveles(ficha?.variantes);
}

/**
 * Parte la prosa "Base: … Intermedio: … Avanzado: …" en tres escalones.
 * Es el RESPALDO de nivelesDe() para fichas sin el dato estructurado;
 * la biblioteca ya no pasa por aquí.
 *
 * Devuelve null si el texto no sigue el patrón.
 */
export function niveles(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  const partes = t.split(/(?=\b(?:Base|Intermedio|Avanzado)\s*:)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const escalones = [];
  for (const p of partes) {
    const m = p.match(/^(Base|Intermedio|Avanzado)\s*:\s*([\s\S]+)$/i);
    if (!m) return null;                         // hay prosa suelta: no es una lista de niveles
    const cuerpo = m[2].trim();
    escalones.push({
      nivel: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(),
      clave: m[1].toLowerCase(),
      texto: /[.!?]$/.test(cuerpo) ? cuerpo : `${cuerpo}.`,
    });
  }
  return escalones.length >= 2 ? escalones : null;
}
