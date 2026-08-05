/* ============================================================
   mapa.mjs — mapa de cobertura de la biblioteca.

   El eje NO es la edad (DOCTRINA D8/D9): es el contenido y la
   exigencia. Este fichero dice QUÉ hay que cubrir y CUÁNTO, para
   que el linter pueda contar los huecos en vez de descubrirlos
   cuando ya hay 200 fichas escritas.

   Los objetivos por bloque son un destino, no una cuota: si un
   contenido no da para 20 ejercicios que superen la rúbrica, se
   quedan los que la superen. La calidad manda sobre el número
   (queda dicho en el plan: mejor 180 impecables que 300 con 60 de
   relleno).
   ============================================================ */

import { BLOQUE_KEYS, OPOSICION } from './vocabulario.mjs';

/* ---- Invariantes de la biblioteca entera ----------------------
   Comprobables por el linter sobre el conjunto, no sobre la ficha
   suelta. Nacen de D1 (el analítico introduce, el juego consolida)
   y de D6 (el formato se elige por objetivo). */

export const INVARIANTES = {
  /* Al menos la mitad de cada bloque técnico tiene que tener
     oposición de verdad. Sin esto la biblioteca deriva sola hacia
     el ejercicio bonito sin defensa, que es el que más fácil se
     escribe y peor transfiere. */
  minProporcionConOposicion: 0.5,

  /* Tope global de ejercicios sin ningún defensor. Incluye el
     calentamiento y la psicomotricidad, que por naturaleza no la
     tienen: por eso el tope es del conjunto y no de cada bloque. */
  maxProporcionOposicionNula: 0.25,

  /* Densidad baja = descarte salvo justificación (D4). Se tolera una
     minoría porque hay contenidos que exigen espera de verdad. */
  maxProporcionDensidadBaja: 0.1,

  /* Toda ficha lleva sus tres niveles de exigencia (D8). Sin
     excepción: es lo que sustituye a la etiqueta de edad. */
  nivelesExigenciaObligatorios: 3,

  /* Tamaño mínimo para que una proporción signifique algo. Sin esto,
     una biblioteca de una ficha sin oposición da "100 % sin oposición"
     y la tanda piloto se llenaría de falsas alarmas que enseñan a
     ignorar al linter — que es la peor cosa que le puede pasar. */
  muestraMinimaGlobal: 10,
  muestraMinimaPorBloque: 4,
};

/* ---- Bloques ---------------------------------------------------
   `contenidos` es la lista de lo que hay que cubrir dentro del
   bloque; sirve para detectar huecos finos («hay 12 de tiro pero
   ninguno de tiro tras bote»).
   `excluido` marca contenido que la doctrina saca del núcleo
   Minibasket, con la decisión que lo justifica. */

export const MAPA = [
  {
    bloque: 'manejo',
    objetivo: 12,
    contenidos: [
      'familiarización y contacto con el balón', 'coordinación óculo-manual',
      'desplazamientos con balón', 'manejo con obstáculos y decisión',
    ],
    nota: 'D20 · nada de manejo descontextualizado como bloque principal; el jugador siempre tiene algo que mirar',
  },
  {
    bloque: 'bote',
    objetivo: 20,
    contenidos: [
      'bote de control', 'bote de avance', 'cambio de mano', 'cambio de dirección',
      'cambio de ritmo', 'bote de protección', 'mano no dominante',
      'cabeza levantada', 'bote contra oposición',
    ],
    nota: 'D19 · los cuatro escalones de oposición · D21 · dos manos → dominante → ambas',
  },
  {
    bloque: 'pase',
    objetivo: 16,
    contenidos: [
      'pase de pecho', 'pase picado', 'pase por encima', 'pase de béisbol',
      'recepción en movimiento', 'pase tras bote', 'decisión de pasar',
      'pase contra defensa',
    ],
    nota: 'se entrena la DECISIÓN de pasar, no solo el gesto',
  },
  {
    bloque: 'tiro',
    objetivo: 22,
    contenidos: [
      'mecánica bajo el aro', 'tiro cercano', 'tiro tras recepción',
      'tiro tras bote', 'tiro tras finta', 'tiro libre', 'tiro con fatiga',
      'tiro con oposición', 'concurso y competición de tiro',
    ],
    nota: 'D17 · se empieza bajo el aro y la distancia se gana · D12 · referencias a la línea de 4 m, nunca al triple FIBA',
  },
  {
    bloque: 'entrada',
    objetivo: 14,
    contenidos: [
      'doble ritmo lado dominante', 'doble ritmo lado no dominante',
      'entrada tras bote', 'entrada tras recepción', 'finalización con contacto',
      'finalización con mano cambiada',
    ],
    nota: 'paso largo de entrada, paso corto de impulso, extensión con la pierna contraria al brazo de tiro',
  },
  {
    bloque: 'juego-de-pies',
    objetivo: 10,
    contenidos: [
      'parada en un tiempo', 'parada en dos tiempos', 'pivote',
      'salida en bote', 'finta de salida', 'finta de recepción',
    ],
    nota: '[PENDIENTE §8] el orden entre parada en uno y en dos tiempos no está zanjado',
  },
  {
    bloque: '1c1',
    objetivo: 20,
    contenidos: [
      '1c1 con balón desde el perímetro', '1c1 tras recepción', '1c1 de espaldas',
      '1c1 sin balón: desmarque', '1c1 sin balón: corte', '1c1 defensivo',
      '1c1 en espacio reducido', '1c1 con ventaja inicial',
    ],
    nota: 'D6 · el formato de más densidad técnica y más carga; y D23 lo convierte en requisito previo del bloqueo',
  },
  {
    bloque: 'juego-de-2',
    objetivo: 14,
    contenidos: [
      'pasar y cortar', 'puerta atrás', 'aclarado', 'mano a mano',
      'bloqueo indirecto', 'bloqueo directo', 'continuación',
    ],
    excluido: [
      { contenido: 'bloqueo directo', de: 'Minibasket', porque: 'D23 · entra cuando el 1c1 está resuelto, no por edad' },
    ],
    nota: 'D23 · en el núcleo, pasar y cortar y aclarado: dan ventaja con dos sin necesidad de contacto',
  },
  {
    bloque: 'contraataque',
    objetivo: 12,
    contenidos: [
      'carriles', 'pase de contraataque', '2c1', '3c2', 'balance defensivo',
      'transición tras rebote',
    ],
    nota: 'única familia que justifica pista entera de forma sistemática',
  },
  {
    bloque: 'defensa',
    objetivo: 20,
    contenidos: [
      'postura y desplazamientos', 'defensa del jugador con balón',
      'defensa del bote', 'defensa sin balón', 'ayuda y recuperación',
      'defensa del corte', 'cierre de rebote', 'defensa en juego reducido',
    ],
    excluido: [
      { contenido: 'defensa en zona', de: 'Minibasket', porque: 'D10 · prohibida por reglamento, sancionada con 2 TL y posesión' },
      { contenido: 'negación de línea de pase', de: 'Minibasket', porque: 'D22 · se quita para que ayudar y recuperar se aprendan de verdad' },
    ],
    nota: 'D11 · toda ayuda lleva su recuperación, que además es lo que exige el reglamento',
  },
  {
    bloque: 'rebote',
    objetivo: 8,
    contenidos: ['bloqueo de rebote', 'rebote defensivo', 'rebote ofensivo', 'salida tras rebote'],
    nota: 'poco volumen a propósito: se entrena mejor dentro de los formatos reducidos',
  },
  {
    bloque: 'juego-reducido',
    objetivo: 20,
    contenidos: [
      '1c1 con reglas', '2c2', '3c3', '4c4', 'superioridades 2c1 y 3c2',
      'inferioridades', 'juego con restricciones', 'competición por equipos',
    ],
    nota: 'D6 · 3c3 es el mejor equilibrio; el 5c5 es la herramienta menos eficiente para enseñar · montaje sin movimiento (decisión del entrenador)',
  },
  {
    bloque: 'calentamiento',
    objetivo: 8,
    contenidos: ['activación con balón', 'movilidad con balón', 'coordinación previa', 'calentamiento competitivo'],
    nota: 'siempre con balón: el calentamiento es tiempo de contacto con el balón, no tiempo perdido',
  },
  {
    bloque: 'psicomotricidad',
    objetivo: 8,
    contenidos: ['lateralidad', 'equilibrio', 'ritmo', 'percepción espacial'],
    nota: 'único bloque que SÍ se acota por categoría: Escuela (D9 admite la excepción cuando el ejercicio es específico de verdad)',
  },
];

export const OBJETIVO_TOTAL = MAPA.reduce((n, b) => n + b.objetivo, 0);

/* ---- Comprobaciones del propio mapa --------------------------- */

/** El mapa no puede nombrar bloques que el vocabulario no conozca. */
export function validarMapa() {
  const errores = [];
  const vistos = new Set();
  for (const b of MAPA) {
    if (!BLOQUE_KEYS.includes(b.bloque)) errores.push(`bloque desconocido: ${b.bloque}`);
    if (vistos.has(b.bloque)) errores.push(`bloque repetido: ${b.bloque}`);
    vistos.add(b.bloque);
    if (!(b.objetivo > 0)) errores.push(`${b.bloque}: objetivo debe ser positivo`);
    if (!b.contenidos?.length) errores.push(`${b.bloque}: sin contenidos que cubrir`);
  }
  for (const k of BLOQUE_KEYS) if (!vistos.has(k)) errores.push(`bloque sin entrada en el mapa: ${k}`);
  return errores;
}

/**
 * Huecos de cobertura: qué falta por bloque y por contenido.
 * @param fichas [{ category, tags, requisitos, name, description, … }]
 */
export function huecos(fichas = []) {
  const porBloque = new Map();
  for (const f of fichas) {
    const b = f.category;
    if (!porBloque.has(b)) porBloque.set(b, []);
    porBloque.get(b).push(f);
  }

  return MAPA.map((m) => {
    const suyas = porBloque.get(m.bloque) || [];
    const texto = suyas.map((f) => `${f.name || ''} ${f.description || ''} ${(f.tags || []).join(' ')}`.toLowerCase()).join(' | ');
    const sinCubrir = m.contenidos.filter((c) => {
      const clave = c.split(' ').filter((w) => w.length > 4)[0];
      return clave ? !texto.includes(clave.toLowerCase()) : false;
    });
    const conOposicion = suyas.filter((f) => ['semiactiva', 'real'].includes(f.requisitos?.oposicion)).length;
    return {
      bloque: m.bloque,
      tiene: suyas.length,
      objetivo: m.objetivo,
      faltan: Math.max(0, m.objetivo - suyas.length),
      proporcionConOposicion: suyas.length ? Number((conOposicion / suyas.length).toFixed(2)) : 0,
      contenidosSinCubrir: sinCubrir,
    };
  });
}

/** Invariantes sobre el conjunto de la biblioteca. */
export function revisarInvariantes(fichas = []) {
  const n = fichas.length;
  if (!n) return [];
  const fallos = [];

  /* Las proporciones solo se juzgan con muestra suficiente. */
  const hayMuestra = n >= INVARIANTES.muestraMinimaGlobal;

  /* D1 se mide sobre los DOS ejes desde que están separados. Lo que la
     doctrina prohíbe acumular no es el ejercicio sin defensor —el
     manejo en un espacio que se estrecha no tiene defensores y aprieta
     más que muchos 1c1— sino el gesto suelto: sin nadie enfrente Y sin
     nada que apriete. Medido así el tope es más estricto de verdad, y
     además señala las fichas correctas. La proporción a secas se sigue
     enseñando, como aviso, para que la deuda no desaparezca de la
     vista: hoy va por el 26 %, y es real. */
  const nulas = fichas.filter((f) => (f.requisitos?.oposicion || 'nula') === 'nula').length;
  const sueltas = fichas.filter((f) => (f.requisitos?.oposicion || 'nula') === 'nula'
    && (f.requisitos?.presion || 'ninguna') === 'ninguna').length;
  if (hayMuestra && sueltas / n > INVARIANTES.maxProporcionOposicionNula) {
    fallos.push(`${(sueltas / n * 100).toFixed(0)} % de la biblioteca sin oposición ni presión (tope ${INVARIANTES.maxProporcionOposicionNula * 100} %) — D1`);
  }

  const bajas = fichas.filter((f) => f.requisitos?.densidad === 'baja').length;
  if (hayMuestra && bajas / n > INVARIANTES.maxProporcionDensidadBaja) {
    fallos.push(`${(bajas / n * 100).toFixed(0)} % con densidad baja (tope ${INVARIANTES.maxProporcionDensidadBaja * 100} %) — D4`);
  }

  const TECNICOS = ['bote', 'pase', 'tiro', 'entrada', '1c1', 'juego-de-2', 'defensa', 'contraataque'];
  for (const h of huecos(fichas)) {
    if (!TECNICOS.includes(h.bloque)) continue;
    if (h.tiene < INVARIANTES.muestraMinimaPorBloque) continue;
    if (h.proporcionConOposicion < INVARIANTES.minProporcionConOposicion) {
      fallos.push(`${h.bloque}: solo ${(h.proporcionConOposicion * 100).toFixed(0)} % con oposición real o semiactiva (mínimo ${INVARIANTES.minProporcionConOposicion * 100} %) — D1`);
    }
  }

  const oposicionesValidas = new Set(OPOSICION);
  const malas = fichas.filter((f) => f.requisitos && !oposicionesValidas.has(f.requisitos.oposicion));
  if (malas.length) fallos.push(`${malas.length} ficha(s) con oposición fuera de la escala de D19`);

  return fallos;
}
