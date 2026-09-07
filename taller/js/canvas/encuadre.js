/* ============================================================
   encuadre.js — la matriz de encuadre de la Pizarra (§3.1).
   Módulo PURO: sin DOM, sin canvas, sin red. Lo prueba en Node
   taller/tools/eval-encuadre.mjs.

   ── QUÉ RESUELVE ────────────────────────────────────────────
   La Pizarra necesita zoom (50 %–400 %) y desplazamiento libres. Los
   otros seis sitios que dibujan pista —el motor, el proyector, la
   miniatura, la ficha— NO lo quieren: enseñan la pista entera y
   encajada, como hasta hoy.

   Así que el zoom no vive en el DOM ni en la matriz del contexto 2D:
   vive en las COORDENADAS. Tres números —escala, ox, oy— que se
   aplican DESPUÉS del mapeo normalizado→píxel y se invierten al leer
   el puntero.

   ── POR QUÉ NO EN EL DOM NI EN EL CONTEXTO ──────────────────
   · Un `transform: scale()` sobre el lienzo ESTIRA el mapa de bits: al
     400 % los dorsales y las flechas saldrían a un cuarto de
     resolución. Redimensionar el lienzo a pista×zoom para arreglarlo
     son ~400 MB en una tablet al 400 %.
   · `ctx.setTransform(z·dpr, …)` sí re-rasteriza, pero asignar
     `canvas.width` RESETEA la matriz del contexto — y eso pasa en cada
     redimensionado, o sea cada vez que se pliega un panel. El zoom se
     destruiría de forma intermitente. Además escalaría también lo que
     NO debe escalar: el trazo de un píxel, el marco de selección, el
     área de agarre del dedo.

   Con el zoom en las coordenadas, el lienzo mide siempre la VENTANA:
   cada símbolo se vuelve a rasterizar desde su geometría a resolución
   de dispositivo, y la memoria del lienzo no crece con el zoom.

   ── EL TRUCO QUE LO SOSTIENE TODO ───────────────────────────
   `anchoPista(enc)` = baseW × escala, o sea el ancho de LA PISTA al
   zoom actual. Es lo que hay que pasarle a `radii()` y a
   `pxPorMetro()` de medidas.js. Así, al 400 % un jugador se dibuja
   cuatro veces más grande en pantalla y sigue midiendo 1,30 m de
   verdad, sin tocar una línea de symbols.js ni de medidas.js. Y el
   imán (0,60 m) y el suavizado del trazo (0,25 m) salen invariantes al
   zoom por construcción, no por cuidado.

   ── LA FORMA DEL DATO ───────────────────────────────────────
     { baseW, baseH, escala, ox, oy, rot }

     baseW/baseH  tamaño en píxeles CSS de la pista ENCAJADA (escala 1)
     escala       0,5–4
     ox/oy        desplazamiento de la pista dentro de la ventana, en px
     rot          0 | 90 (el giro del proyector, misma convención que
                  court.js: 90 dibuja la pista apaisada)

   Todas las funciones son puras y devuelven objetos NUEVOS. Nadie muta
   un encuadre: se sustituye.
   ============================================================ */

/** Límites de zoom (§3.1). 1 = la pista encajada en la ventana. */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;

/** Aire entre la pista encajada y el borde de la ventana, en px CSS. */
export const MARGEN = 24;

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const finito = (v, porDefecto) => (Number.isFinite(v) ? v : porDefecto);

/**
 * El encuadre NEUTRO: la pista ocupa la ventana entera, sin zoom ni
 * desplazamiento.
 *
 * Es la pieza que hace que esto no rompa nada. Con él,
 * `proyectar(neutro(w, h, rot), x, y)` se reduce algebraicamente a
 * `[x*w, y*h]` — carácter por carácter el `toPx` que court.js lleva
 * usando desde el principio. Por eso el modo clásico de CourtView
 * puede pasar por aquí sin que ninguno de sus consumidores lo note.
 */
export function neutro(vw, vh, rot = 0) {
  return {
    baseW: Math.max(1, finito(vw, 1)),
    baseH: Math.max(1, finito(vh, 1)),
    escala: 1,
    ox: 0,
    oy: 0,
    rot: rot === 90 ? 90 : 0,
  };
}

/**
 * Encaja la pista entera dentro de la ventana, centrada y con aire.
 *
 * `aspect` es el del MARCO de la pista (ancho/alto en metros, tal y
 * como lo da `marcoDe()` de medidas.js). Con rot 90 se invierte, igual
 * que hace `setPista` con `--court-aspect`: la pista se dibuja
 * apaisada y su relación se da la vuelta.
 */
export function ajustar({ vw, vh, aspect, rot = 0, margen = MARGEN } = {}) {
  const gira = rot === 90;
  const a = Math.max(1e-6, gira ? 1 / finito(aspect, 1) : finito(aspect, 1));
  const w = Math.max(1, finito(vw, 1));
  const h = Math.max(1, finito(vh, 1));
  /* El margen no puede comerse la pista: en una ventana estrecha
     —el cajón del móvil— restar 48 px dejaría un ancho negativo y la
     pista saldría del revés. */
  const cabeW = Math.max(1, w - 2 * margen);
  const cabeH = Math.max(1, h - 2 * margen);

  let baseW = cabeW;
  let baseH = baseW / a;
  if (baseH > cabeH) { baseH = cabeH; baseW = baseH * a; }

  return {
    baseW: Math.max(1, baseW),
    baseH: Math.max(1, baseH),
    escala: 1,
    ox: (w - baseW) / 2,
    oy: (h - baseH) / 2,
    rot: gira ? 90 : 0,
  };
}

/** Ancho y alto de LA PISTA al zoom actual, en píxeles CSS. */
export const anchoPista = (enc) => enc.baseW * enc.escala;
export const altoPista = (enc) => enc.baseH * enc.escala;

/**
 * NORMALIZADO → píxeles de la ventana.
 *
 * La rama de rot 90 es la misma de court.js#toPx: un giro horario, con
 * el eje X normalizado bajando por la altura. No se clampa nada, a
 * propósito: una flecha puede salirse del marco y hay que poder
 * dibujarla.
 */
export function proyectar(enc, x, y) {
  const W = anchoPista(enc);
  const H = altoPista(enc);
  return enc.rot === 90
    ? [(1 - y) * W + enc.ox, x * H + enc.oy]
    : [x * W + enc.ox, y * H + enc.oy];
}

/**
 * Píxeles de la ventana → NORMALIZADO, SIN recortar.
 *
 * Devuelve valores fuera de [0,1] cuando el puntero cae en la banda o
 * fuera de la pista, y eso es lo que se quiere: quien decide si un
 * punto vale es quien lo usa. Recortar aquí, como hace hoy
 * `toNorm`, convierte «has soltado fuera» en «has soltado en el
 * borde», que es una mentira silenciosa.
 */
export function despoyectar(enc, px, py) {
  const W = anchoPista(enc);
  const H = altoPista(enc);
  const ux = px - enc.ox;
  const uy = py - enc.oy;
  return enc.rot === 90 ? [uy / H, 1 - ux / W] : [ux / W, uy / H];
}

/**
 * Zoom anclado a un punto de PANTALLA: lo que hay bajo el puntero (o
 * bajo el centro del pellizco) no se mueve. Es la única cuenta del
 * zoom, y hacerla mal es lo que produce esa sensación de que la pista
 * «se escapa» al acercar.
 */
export function zoomA(enc, escala, cx, cy) {
  const e2 = clamp(finito(escala, enc.escala), ZOOM_MIN, ZOOM_MAX);
  if (e2 === enc.escala) return { ...enc };
  const s = e2 / enc.escala;
  return {
    ...enc,
    escala: e2,
    ox: cx - (cx - enc.ox) * s,
    oy: cy - (cy - enc.oy) * s,
  };
}

/** Desplaza el encuadre por un incremento en píxeles de pantalla. */
export function desplazar(enc, dx, dy) {
  return { ...enc, ox: enc.ox + finito(dx, 0), oy: enc.oy + finito(dy, 0) };
}

/**
 * Escalar y mover A LA VEZ, con UN SOLO recorte al final. Es lo que
 * hace un pellizco de dos dedos: la mano abre y se desplaza en el
 * mismo gesto.
 *
 * Y tiene que ser una sola función, no `zoomA` seguido de `desplazar`,
 * por dos motivos que solo se ven con los topes puestos:
 *
 *  · Recortando dos veces, el estado intermedio ya viene pegado al
 *    tope y el segundo recorte trabaja sobre él: el punto que hay bajo
 *    los dedos se escapa, que es justo lo que `zoomA` existe para
 *    evitar.
 *  · Cuando la pista CABE en un eje, `limitar` lo RECENTRA. Recortar
 *    en medio anula el desplazamiento de ese eje y el gesto se siente
 *    trabado.
 */
export function pellizcar(enc, escala, cx, cy, dx, dy, vw, vh, margen = MARGEN) {
  return limitar(desplazar(zoomA(enc, escala, cx, cy), dx, dy), vw, vh, margen);
}

/**
 * Recorta el desplazamiento para que la pista no se pueda perder de
 * vista. Eje a eje y con dos comportamientos distintos, que es lo que
 * hace que no se sienta raro:
 *   · si la pista CABE en ese eje, se centra (no se puede descentrar);
 *   · si NO cabe, se permite mover hasta dejar `margen` de aire.
 */
export function limitar(enc, vw, vh, margen = MARGEN) {
  const W = anchoPista(enc);
  const H = altoPista(enc);
  const w = Math.max(1, finito(vw, 1));
  const h = Math.max(1, finito(vh, 1));
  const eje = (tam, ventana, v) => (tam <= ventana
    ? (ventana - tam) / 2
    : clamp(v, ventana - tam - margen, margen));
  return { ...enc, ox: eje(W, w, enc.ox), oy: eje(H, h, enc.oy) };
}

/**
 * Qué trozo de pista se está viendo, en normalizado. Sirve para no
 * dibujar lo que no se ve: al 400 % se pinta una decimosexta parte de
 * los elementos.
 *
 * Se calculan las CUATRO esquinas y se toman los extremos, en vez de
 * suponer que la esquina de arriba a la izquierda de la ventana es la
 * de menor x normalizada: con rot 90 no lo es.
 */
export function ventana(enc, vw, vh) {
  const esquinas = [
    despoyectar(enc, 0, 0),
    despoyectar(enc, vw, 0),
    despoyectar(enc, 0, vh),
    despoyectar(enc, vw, vh),
  ];
  const xs = esquinas.map((p) => p[0]);
  const ys = esquinas.map((p) => p[1]);
  return {
    x0: Math.min(...xs), x1: Math.max(...xs),
    y0: Math.min(...ys), y1: Math.max(...ys),
  };
}

/** ¿Cae este punto normalizado dentro de lo que se ve, con holgura? */
export function seVe(v, x, y, holgura = 0) {
  return x >= v.x0 - holgura && x <= v.x1 + holgura
    && y >= v.y0 - holgura && y <= v.y1 + holgura;
}

/* ── La rejilla de metros ─────────────────────────────────────
   Al acercar aparece una rejilla tenue cada tantos metros. No es
   decoración: es lo que deja ver de un vistazo si dos jugadores están
   a tres metros o a seis, que sobre una pista vacía no se aprecia.

   El paso se elige para que NUNCA se amontonen las líneas: se sube al
   siguiente escalón en cuanto entrarían más de catorce. Los escalones
   son 1, 2, 5 y 10 m, que es la progresión de toda la vida y además
   cae en números con los que un entrenador piensa. */
export const PASOS_REJILLA = [1, 2, 5, 10];
export const LINEAS_MAX = 14;

export function pasoRejilla(metrosVisibles) {
  const m = Math.max(0, finito(metrosVisibles, 0));
  for (const p of PASOS_REJILLA) if (m / p <= LINEAS_MAX) return p;
  return PASOS_REJILLA[PASOS_REJILLA.length - 1];
}

/**
 * Las líneas de la rejilla que se ven ahora, en NORMALIZADO.
 *
 * Solo las que caen dentro de la pista: prolongarlas por la banda
 * ensuciaría el dibujo sin decir nada, porque ahí no se juega.
 *
 * El bucle va por índice entero y no acumulando `m += paso`: sumando
 * en coma flotante, a los treinta pasos la línea de los 24 m cae en
 * 23,999 y se pierde por el redondeo del borde.
 */
export function lineasRejilla(vis, anchoM, altoM, paso) {
  const p = Math.max(1e-6, finito(paso, 1));
  const eje = (m0, m1, total) => {
    const salida = [];
    const desde = Math.max(0, m0);
    const hasta = Math.min(total, m1);
    if (!(hasta >= desde)) return salida;
    const primero = Math.ceil(desde / p - 1e-9);
    const ultimo = Math.floor(hasta / p + 1e-9);
    for (let i = primero; i <= ultimo; i++) salida.push((i * p) / total);
    return salida;
  };
  return {
    paso: p,
    xs: eje(vis.x0 * anchoM, vis.x1 * anchoM, anchoM),
    ys: eje(vis.y0 * altoM, vis.y1 * altoM, altoM),
  };
}

/**
 * Grosor de una línea que tiene que medir un píxel EN PANTALLA, caiga
 * el zoom donde caiga: el borde de un panel, el marco de selección, la
 * rejilla de metros.
 *
 * El contexto va con `setTransform(dpr, …)`, así que un `lineWidth` de
 * 1 con dpr 2,5 cae entre dos píxeles del dispositivo y la línea sale
 * gris y a dos filas. El medio píxel es lo que la centra.
 */
export function hairline(v, dpr) {
  const d = Math.max(1, finito(dpr, 1));
  return (Math.round(finito(v, 1) * d) + 0.5) / d;
}

/**
 * El encuadre listo para guardar y para volver a poner. Se guarda en
 * localStorage por ejercicio, NUNCA en el JSON de la jugada: el zoom
 * es de quien mira, no del ejercicio (§11.1). Un ejercicio dibujado al
 * 300 % se proyecta igual que uno dibujado al 100 %.
 */
export function guardable(enc) {
  return { escala: enc.escala, ox: enc.ox, oy: enc.oy };
}

/**
 * Repone un encuadre guardado sobre la ventana ACTUAL, que puede no
 * ser la de entonces (otra pantalla, otro panel plegado). La base y la
 * rotación se recalculan siempre desde la ventana de ahora; solo se
 * recupera el zoom y el desplazamiento, y se recorta.
 */
export function desdeGuardado(base, guardado, vw, vh, margen = MARGEN) {
  if (!guardado || typeof guardado !== 'object') return base;
  const enc = {
    ...base,
    escala: clamp(finito(guardado.escala, 1), ZOOM_MIN, ZOOM_MAX),
    ox: finito(guardado.ox, base.ox),
    oy: finito(guardado.oy, base.oy),
  };
  return limitar(enc, vw, vh, margen);
}
