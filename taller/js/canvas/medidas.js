/* ============================================================
   canvas/medidas.js — LA PISTA, EN METROS.

   Fuente única de verdad de tres cosas que hasta ahora vivían
   separadas y se contradecían entre sí:

     1. las medidas reales de una cancha de baloncesto,
     2. el marco de cada una de las cuatro pistas dibujables,
     3. dónde cae cada posición con nombre (aro, codo, esquina…).

   De aquí salen, por derivación y no por medición:
     · los cuatro SVG de fondo   (tools/gen-pistas.mjs)
     · las anclas                (canvas/anclas.js)
     · la escala metros↔lienzo   (canvas/escala.js)

   Módulo PURO: sin DOM, sin red, sin supabase. Lo importan el
   compilador, el linter y los bancos de pruebas en Node.

   ── POR QUÉ EXISTE ──────────────────────────────────────────
   Los cuatro SVG anteriores eran dibujos estilizados encajados a
   mano en una hoja A4 (210×297). No estaban a escala y, peor, los
   dos ejes estaban estirados de forma DISTINTA: en la media pista,
   un metro a lo largo medía 10,2 mm de lienzo y un metro a lo ancho
   medía 17,7 mm. Consecuencias que se veían en pantalla:

     · un círculo de verdad se dibujaba como una elipse;
     · "termina la entrada a 1,2 m del aro" daba distancias
       distintas según la dirección desde la que llegara el jugador;
     · escala.js tenía que DEDUCIR la escala midiendo dos rasgos
       del dibujo, y solo acertaba junto al aro (documentado allí:
       la esquina salía a 8,9 m del aro cuando de verdad son 6,6);
     · no había ni un centímetro fuera de las líneas, así que las
       filas de espera se dibujaban pisando el campo.

   Ahora el marco ES la pista más dos metros de banda por cada
   lado, y el píxel es CUADRADO: un metro mide lo mismo en los dos
   ejes, en las cuatro pistas y en las tres vistas (ficha, gif y
   proyector).

   ── QUÉ SE HA DECIDIDO Y QUÉ NO ─────────────────────────────
   Las cuatro pistas comparten la MISMA geometría reglamentaria
   FIBA; las dos "mini" se diferencian solo en que no llevan línea
   de triple, que es exactamente lo que decían sus etiquetas
   ("Pista entera" frente a "Entera · triple FIBA") y lo que se ve
   en los SVG antiguos: tenían la línea de tiros libres en el mismo
   sitio, al milímetro.

   NO se han metido las líneas propias del minibasket (tiro libre a
   4,60 m y zona de 8,00 × 4,60 del plano de referencia): moverían
   el ancla `tiro_libre` un metro largo y con ella las 176 fichas de
   media pista. Está anotado como decisión pendiente, no descartada.
   ============================================================ */

/* ── 1. Reglamento, en metros ──────────────────────────────── */

export const REGLAS = {
  largo: 28,               // fondo a fondo, por dentro de las líneas
  ancho: 15,               // banda a banda
  banda: 2,                // zona libre exterior (mínimo FIBA)
  linea: 0.05,             // grosor de las líneas de marcaje

  aroRetranqueo: 1.575,    // fondo → centro del aro
  aroRadio: 0.225,         // aro de 45 cm de diámetro
  tableroAncho: 1.80,
  tableroFrente: 1.20,     // fondo → cara delantera del tablero

  zonaAncho: 4.90,         // ancho de la zona restringida
  zonaFondo: 5.80,         // fondo → línea de tiros libres
  tiroLibreLargo: 3.60,
  circuloRadio: 1.80,      // vale para el de tiros libres y el central
  noCargaRadio: 1.25,      // semicírculo de no carga, desde el centro del aro

  tripleRadio: 6.75,       // desde el centro del aro
  tripleBanda: 0.90,       // separación del tramo recto respecto a la banda
};

/** Distancia del tramo recto del triple al eje largo de la pista. */
export const TRIPLE_LATERAL = REGLAS.ancho / 2 - REGLAS.tripleBanda;   // 6,60

/**
 * Hasta qué profundidad llega el tramo recto del triple: donde corta
 * el arco. Con radio 6,75 y lateral 6,60 sale a 2,99 m del fondo, que
 * es el número que publica FIBA — sirve de comprobación de que las
 * constantes de arriba son coherentes entre sí.
 */
export const TRIPLE_CORTE = REGLAS.aroRetranqueo
  + Math.sqrt(REGLAS.tripleRadio ** 2 - TRIPLE_LATERAL ** 2);

/* ── 2. Las cuatro pistas ──────────────────────────────────── */

/**
 * `largoVisible` es cuánta pista se dibuja a lo largo: 28 m la entera,
 * 14 la media. `orientacion` dice qué eje del lienzo recorre ese largo:
 *   · 'retrato' → el largo baja por la Y, las canastas arriba y abajo;
 *   · 'paisaje' → el largo va por la X, la canasta a la IZQUIERDA.
 * Se mantiene la convención de las pistas anteriores para no rotar las
 * 204 fichas además de reescalarlas.
 *
 * En la media se deja banda también más allá del medio campo: no es
 * zona libre reglamentaria, es sitio para colocar filas y conos.
 */
export const PISTAS_M = {
  entera:      { largoVisible: 28, orientacion: 'retrato', triple: false, canastas: ['norte', 'sur'] },
  entera_fiba: { largoVisible: 28, orientacion: 'retrato', triple: true,  canastas: ['norte', 'sur'] },
  media:       { largoVisible: 14, orientacion: 'paisaje', triple: false, canastas: ['norte'] },
  media_fiba:  { largoVisible: 14, orientacion: 'paisaje', triple: true,  canastas: ['norte'] },
};

export const PISTA_POR_DEFECTO = 'entera';

/**
 * Marco de una pista, en metros.
 * @returns {{ancho, alto, aspect, largoVisible, orientacion, triple, canastas}}
 *   `ancho`/`alto` = tamaño del lienzo entero (pista + banda), en metros.
 *   `aspect` = ancho/alto, que es lo que va a `--court-aspect`.
 */
export function marcoDe(pista) {
  const p = PISTAS_M[pista] || PISTAS_M[PISTA_POR_DEFECTO];
  const b = REGLAS.banda;
  const largo = p.largoVisible + 2 * b;
  const ancho = REGLAS.ancho + 2 * b;
  const [w, hh] = p.orientacion === 'retrato' ? [ancho, largo] : [largo, ancho];
  return { ...p, ancho: w, alto: hh, aspect: w / hh };
}

/* ── 3. Coordenadas ────────────────────────────────────────── */

/*
   Tres sistemas, y conviene tenerlos separados en la cabeza:

   · PISTA (d, l)  — metros, relativo a UNA canasta. `d` = profundidad
     desde su línea de fondo hacia dentro; `l` = separación del eje
     largo, negativa a la izquierda. Es el sistema en el que se piensa
     el baloncesto y en el que están escritas las anclas.
   · MARCO (fx, fy) — metros sobre el lienzo, origen en su esquina
     superior izquierda, banda incluida.
   · NORMAL (x, y) — el [0,1] de siempre, que es lo que se guarda.
*/

/** PISTA → MARCO. */
export function pistaAMarco(pista, d, l, canasta = 'norte') {
  const m = marcoDe(pista);
  const b = REGLAS.banda;
  const eje = b + REGLAS.ancho / 2 + l;
  if (m.orientacion === 'retrato') {
    // 'sur' se refleja en Y, no se gira 180°: izquierda sigue siendo
    // izquierda en pantalla, igual que en las anclas anteriores.
    return [eje, canasta === 'sur' ? b + REGLAS.largo - d : b + d];
  }
  return [b + d, eje];
}

/** MARCO → NORMAL. */
export function marcoANorm(pista, fx, fy) {
  const m = marcoDe(pista);
  return [fx / m.ancho, fy / m.alto];
}

/** NORMAL → MARCO. */
export function normAMarco(pista, x, y) {
  const m = marcoDe(pista);
  return [x * m.ancho, y * m.alto];
}

/** PISTA → NORMAL. El atajo que usan las anclas y el generador. */
export function pistaANorm(pista, d, l, canasta = 'norte') {
  const [fx, fy] = pistaAMarco(pista, d, l, canasta);
  return marcoANorm(pista, fx, fy);
}

/**
 * Los límites de la CANCHA (las líneas de banda y fondo) en coordenadas
 * normalizadas. Todo lo que quede fuera de esta caja pero dentro de
 * [0,1] está en la banda de 2 m: sitio legítimo para una fila, un cono
 * de espera o un entrenador, pero NO campo de juego.
 * @returns {{x:[number,number], y:[number,number]}}
 */
export function limitesCancha(pista) {
  const m = marcoDe(pista);
  const b = REGLAS.banda;
  const largo = [b, b + m.largoVisible];
  const ancho = [b, b + REGLAS.ancho];
  const [ejeX, ejeY] = m.orientacion === 'retrato' ? [ancho, largo] : [largo, ancho];
  return { x: [ejeX[0] / m.ancho, ejeX[1] / m.ancho], y: [ejeY[0] / m.alto, ejeY[1] / m.alto] };
}

/**
 * Metros que mide UNA unidad normalizada en cada eje. Los dos números
 * son distintos porque el marco no es cuadrado, pero el metro sí lo es:
 * ancho/alto del marco coincide con la relación de aspecto del lienzo,
 * así que ancho_px/ancho_m == alto_px/alto_m. Un metro son los mismos
 * píxeles vaya en la dirección que vaya.
 */
export function escalaDe(pista) {
  const m = marcoDe(pista);
  return { x: m.ancho, y: m.alto };
}

/* ── 4. Las posiciones con nombre ──────────────────────────── */

/*
   Cada ancla es (d, l) en metros, y de ahí sale su coordenada en las
   cuatro pistas. Antes se medían a ojo sobre el render de cada SVG y
   no coincidían entre pistas; ahora hay una sola tabla.

   Los cuatro puestos de perímetro se reparten sobre un arco de 7,00 m
   desde el aro — un cuarto de metro por detrás de la línea de 6,75 —
   salvo la esquina, que se pega al tramo recto porque ahí la línea no
   es un arco: cae a 6,60 m clavados, que es la comprobación que pedía
   la especificación.

   La zona tiene 4,90 m de ancho, o sea 2,45 a cada lado del eje: ese
   es el `l` de postes y codos. Las tres profundidades salen de las
   plazas de rebote reglamentarias y del fondo de la zona.
*/

const MEDIA_ZONA = REGLAS.zonaAncho / 2;                    // 2,45
const R_PERIMETRO = 7.00;                                   // arco de trabajo
const grados = (g) => (g * Math.PI) / 180;
/** Punto del arco de perímetro a `g` grados contados desde la línea de fondo. */
const arco = (g) => ({
  d: REGLAS.aroRetranqueo + R_PERIMETRO * Math.sin(grados(g)),
  l: R_PERIMETRO * Math.cos(grados(g)),
});

const CENTRAL = {
  aro:         { d: REGLAS.aroRetranqueo, l: 0 },
  tiro_libre:  { d: REGLAS.zonaFondo,     l: 0 },
  base:        arco(90),
  centro:      { d: REGLAS.largo / 2,     l: 0 },   // línea de medio campo
};

// { base: {d, l} } con `l` POSITIVO; el lado izquierdo lo genera el
// espejo de abajo. Una sola definición por puesto, imposible que se
// descuadren entre sí.
const LATERAL = {
  poste_bajo:  { d: 2.80,             l: MEDIA_ZONA },
  poste_alto:  { d: 4.60,             l: MEDIA_ZONA },
  codo:        { d: REGLAS.zonaFondo, l: MEDIA_ZONA },
  esquina:     { d: REGLAS.aroRetranqueo, l: TRIPLE_LATERAL },  // 6,60 m del aro
  alero:       arco(38),
  escolta:     arco(62),
};

/** Todas las anclas de una canasta, en coordenadas de PISTA (d, l). */
export function anclasEnMetros() {
  const out = { ...CENTRAL };
  for (const [nombre, p] of Object.entries(LATERAL)) {
    out[`${nombre}_der`] = { d: p.d, l: p.l };
    out[`${nombre}_izq`] = { d: p.d, l: -p.l };
  }
  return out;
}

/**
 * Las anclas de una pista+canasta ya en normalizado, listas para
 * anclas.js. Las medias solo tienen 'norte'; `centro` cae justo sobre
 * la línea de medio campo, que en ellas es el borde del dibujo.
 */
export function anclasDe(pista, canasta = 'norte') {
  const out = {};
  for (const [nombre, { d, l }] of Object.entries(anclasEnMetros())) {
    const [x, y] = pistaANorm(pista, d, l, canasta);
    out[nombre] = [Number(x.toFixed(4)), Number(y.toFixed(4))];
  }
  return out;
}

/* ── 5. Tamaños de los elementos, en metros ────────────────── */

/*
   Un jugador mide 1,3 m de diámetro: no es su tamaño real (0,5 m de
   hombros), es el tamaño con el que una ficha con dorsal se lee en un
   proyector sin agrandar la pista. Lo que importa es que sea el MISMO
   metraje en las cuatro pistas y en las tres vistas, que es justo lo
   que no pasaba cuando el radio era "el 4,2 % del ancho del lienzo".
*/
export const TAMANOS = {
  jugador: 1.30,     // diámetro
  balon:   0.70,
  cono:    0.90,
  pelota:  0.40,     // pelota de tenis: mide 6,7 cm, pero a esa escala no se ve
  trazo:   0.16,     // grosor base de flechas y trayectorias
  pasoFila: 1.27,    // separación entre dos de la cola (≈ un jugador y medio)
};

/**
 * Elementos que no son un punto: tienen largo y ancho, y se colocan con
 * una orientación. La escalera de coordinación es la de verdad —4 m de
 * largo, 50 cm de ancho, un peldaño cada 40— porque es material que se
 * pone en el suelo y ocupa sitio: si se dibuja "a ojo", el ejercicio
 * miente sobre cuánta pista hace falta.
 */
export const MATERIAL = {
  escalera: { largo: 4.00, ancho: 0.50, peldano: 0.40 },
};

/** Radio de referencia: el del jugador en la entera con el lienzo a 600 px. */
const RADIO_REFERENCIA = (TAMANOS.jugador / 2) * (600 / (REGLAS.ancho + 2 * REGLAS.banda));

/**
 * Un desplazamiento de `metros` en la dirección `grados` (0° = hacia la
 * derecha del lienzo, sentido horario), expresado en unidades
 * normalizadas de esa pista.
 *
 * Hace falta porque el marco no es cuadrado: avanzar 1 m hacia abajo son
 * menos unidades normalizadas que avanzar 1 m hacia la derecha, aunque
 * en píxeles sean lo mismo. Sin esta conversión, dibujar una cola en
 * píxeles y calcular su final en normalizado daban dos sitios distintos
 * —y con tres jugadores la diferencia era de varios metros.
 */
export function pasoNorm(pista, grados, metros) {
  const m = marcoDe(pista);
  const rad = (grados * Math.PI) / 180;
  return { dx: (Math.cos(rad) * metros) / m.ancho, dy: (Math.sin(rad) * metros) / m.alto };
}

/** Cuántos píxeles mide un metro en un lienzo de `anchoPx` de ancho. */
export function pxPorMetro(pista, anchoPx) {
  return anchoPx / marcoDe(pista).ancho;
}

/** Radio en píxeles de un elemento, dado el ancho del lienzo en px. */
export function radioPx(pista, elemento, anchoPx) {
  const metros = TAMANOS[elemento] ?? TAMANOS.jugador;
  return (metros / 2) * pxPorMetro(pista, anchoPx);
}

/**
 * Factor de escala de los trazos —flechas, cabezas de flecha, el aspa del
 * bloqueo—, que están escritos en píxeles sueltos dentro de arrows.js.
 *
 * Se ata al tamaño del JUGADOR, que sí está en metros, en vez de al ancho
 * del lienzo. Así una flecha tiene el mismo grosor real en la entera y en
 * la media, y en la entera con el lienzo a 600 px vale exactamente 1: los
 * números de arrows.js siguen significando lo que significaban.
 */
export function escalaTrazo(pista, anchoPx) {
  return Math.max(0.6, radioPx(pista, 'jugador', anchoPx) / RADIO_REFERENCIA);
}
