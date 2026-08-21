/* ============================================================
   convocatoria-pdf.js — el PDF que se manda al grupo, clavado sobre
   el papel del club.

   ── DE DÓNDE SALEN ESTOS NÚMEROS ────────────────────────────
   No están elegidos a ojo: son las medidas del documento real
   (`CONVOCATORIA partido MINIBASKET.pdf`), leídas del propio PDF
   —posiciones, tamaños de letra, colores de resaltado y grosores de
   línea— y reproducidas aquí en puntos sobre A4. Cada constante lleva
   al lado el valor del original del que sale, para que dentro de un año
   se sepa qué se puede tocar y qué no.

   La primera versión de este módulo dibujaba «un documento parecido»:
   una tabla con recuadros, sin membrete y sin resaltados. Se parecía a
   una hoja de cálculo, no a la convocatoria del club. Un papel que
   llega al grupo de padres con otra pinta es un papel del que se
   desconfía, aunque diga exactamente lo mismo.

   ── QUÉ ES DEL SISTEMA Y QUÉ ES DEL CLUB ────────────────────
   La maquetación es del sistema y vive aquí. El membrete, la línea de
   la oficina, el nombre del club, la categoría y la competición son del
   CLUB y viven en `team_settings` — se escriben una vez y se cambian
   sin tocar código. El membrete de CB Palencia va como imagen por
   defecto en `assets/convocatoria/`, y cualquier equipo puede subir el
   suyo encima.

   ── POR QUÉ UN FICHERO Y NO «IMPRIMIR → GUARDAR COMO PDF» ───
   Porque esto acaba en un grupo de WhatsApp desde el móvil. Imprimir
   son cuatro toques, un cuadro de diálogo distinto en cada teléfono y
   unos márgenes que pone el navegador. Un botón que deja el fichero en
   Descargas se adjunta en dos toques.

   ── LA LIBRERÍA SE TRAE AL PULSAR, NO AL ABRIR ──────────────
   `import()` dinámico desde el mismo sitio del que ya viene Supabase.
   Así la pantalla de convocatoria abre igual de rápido que antes y
   quien solo viene a marcar convocados no descarga nada.
   ============================================================ */

import { nombreFichero } from './convocatoria.js';

const JSPDF = 'https://esm.sh/jspdf@2.5.2';

/** El membrete de CB Palencia, por si el equipo no ha subido el suyo. */
export const MEMBRETE_POR_DEFECTO = '/assets/convocatoria/membrete-cbp.jpg';

/* Las métricas de la Helvetica (= Arial), en fracción del tamaño. De
   aquí sale TODO lo vertical: dónde cae la línea base dentro de su
   renglón y qué alto tiene un resaltado.

   Se llegó a ellas por el camino largo. Primero se ajustó a ojo contra
   el `y0` que reporta un lector de PDF, y cuadraba en los números y
   fallaba en el papel: el original lleva la Arial incrustada y este
   documento usa la Helvetica de serie, y cada lector deduce el alto de
   la caja de forma distinta. El texto acababa medio punto más abajo de
   la cuenta, lo justo para que la raya de la fila cruzara «(aproximado)»
   y el amarillo cortara los números por la mitad. Con la línea base
   puesta a mano, eso no puede pasar. */
const ASCENDENTE = 0.905;
const DESCENDENTE = 0.212;
const ALTO_RESALTE = ASCENDENTE + DESCENDENTE;

/* ── Colores, tal cual salen del original ──────────────────── */
export const C = {
  morado:   [0x80, 0x00, 0x80],   // #800080 · el club y CONVOCADOS
  amarillo: [0xff, 0xff, 0x00],   // #ffff00 · lo que se rellena cada semana
  gris:     [0xd3, 0xd3, 0xd3],   // #d3d3d3 · la banda del título
  negro:    [0, 0, 0],
  blanco:   [255, 255, 255],
};

/* ── Geometría, en puntos sobre A4 (595.2 × 841.9) ─────────── */
export const G = {
  ancho: 595.2, alto: 841.9,

  membrete: { x: 0, y: 0, w: 595.2, h: 87 },        // ocupa el ancho entero
  paginaDe: { x: 525.8, base: 22.6, size: 9.1 },    // «Página 1 de 1», arriba a la derecha
  oficina:  { x: 14.2, base: 98.0, size: 11 },

  titulo: { x: 148.1, base: 138.5, size: 25.9, fondoY: 114.3, fondoH: 29.8 },

  // la tabla de datos: dos columnas y SOLO rayas horizontales
  tabla: {
    top: 156.5,
    etiquetaX: 53.3, etiquetaRaya0: 48.0, etiquetaRaya1: 182.7, etiquetaSize: 12,
    valorX: 188.2, valorRaya0: 183.2, valorRaya1: 551.5,
    grosor: 0.5,
    /* `padArriba` coloca el texto dentro de su fila. `padCrecer` es
       otra cosa: el aire mínimo que se le deja al contenido ANTES de
       empujar la fila por debajo de su altura de original. Son dos
       números distintos porque Word aprieta las filas de dos renglones
       y las de uno las deja sueltas, y copiar ese capricho fila a fila
       era la única forma de que los renglones cayeran donde caen. */
    padArriba: 5.4, padCrecer: 4,
    // interlineado = tamaño × esto (medido: 12 pt → 13.6; 13.9 → 15.8)
    interlineado: 1.135,
  },

  convocados: { x: 188.7, size: 12, base: 11.3, huecoArriba: 13.2, huecoAbajo: 12.7, y: 573.5, topRejilla: 599.9 },

  // la rejilla de la izquierda: dorsal | nombre
  rejilla: {
    x0: 14.2, x1: 42.5, x2: 191.4,
    fila: 13.15, base: 10.8, size: 11, grosor: 0.5, nombreX: 48.3,
  },

  // reserva y descanso, en la columna de la derecha
  aparte: {
    tituloX: 270, itemX: 262.4, size: 12, base: 11.3,
    /* El original deja 20,7 pt bajo RESERVA y 27,6 bajo DESCANSO. Es
       irregular porque lo escribió una persona con la tecla de intro,
       pero es SU papel: copiarlo deja los renglones donde la gente los
       espera, y unificarlo a un solo hueco los movía dos milímetros. */
    paso: 13.7, trasTitulo: { reserva: 20.7, descanso: 27.6 }, entreBloques: 27.6,
  },
};

let cargando = null;
async function jsPDF() {
  if (!cargando) cargando = import(/* @vite-ignore */ JSPDF).then((m) => m.jsPDF || m.default?.jsPDF || m.default);
  const F = await cargando;
  if (typeof F !== 'function') throw new Error('No se pudo cargar el generador de PDF.');
  return F;
}

/**
 * Trae una imagen y la deja en data URI, que es lo que come jsPDF.
 * Si falla —sin cobertura, ruta mala, el club no ha subido nada—
 * devuelve null y el documento sale SIN membrete, en vez de no salir.
 */
export async function comoDataURI(url, traer = (typeof fetch === 'function' ? fetch : null)) {
  if (!url || !traer) return null;
  try {
    const r = await traer(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((ok, mal) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.onerror = mal;
      fr.readAsDataURL(b);
    });
  } catch { return null; }
}

/**
 * Las filas de la tabla, en el orden y con la forma del papel.
 *
 * Cada línea de valor es una lista de TROZOS `{t, size, bold, color,
 * fondo}`. Van en trozos y no en una cadena porque en el original el
 * nombre del club lleva su recuadro morado y lo de al lado no, y
 * «Polideportivo» y «CAMPOS GÓTICOS» son dos tamaños distintos dentro
 * de la misma línea.
 *
 * Las tres filas del desplazamiento salen SIEMPRE, aunque estén vacías:
 * están en el papel del club, y en un documento que la gente lleva años
 * leyendo, un hueco conocido informa más que una fila que desaparece.
 */
export function filasDelDocumento(d) {
  const T = (t, extra = {}) => ({ t: String(t ?? ''), size: 12, bold: true, color: C.negro, ...extra });
  const amarillo = (t, extra = {}) => T(t, { fondo: C.amarillo, ...extra });
  const nuestro = (t) => T(t, { size: 16.1, color: C.blanco, fondo: C.morado });

  // el partido: el local delante, y el recuadro morado siempre sobre los nuestros
  const rival = d.rival || '-';
  const partido = d.localPrimero
    ? [nuestro(` ${d.nuestroNombre} `), T(`  -  ${rival}`, { size: 16.1 })]
    : [T(`${rival}  -  `, { size: 16.1 }), nuestro(` ${d.nuestroNombre} `)];

  // la cancha: el nombre en grande y resaltado, la dirección debajo
  const cancha = [];
  for (const [i, l] of String(d.cancha || '').split('\n').filter((x) => x.trim()).entries()) {
    cancha.push(i === 0 ? [amarillo(l, { size: 13.9 })] : [T(l)]);
  }

  const llevar = String(d.llevar || '').split('\n');

  /* `altoMin` son las alturas de fila del original, de raya a raya. Con
     ellas, un documento normal sale renglón por renglón donde el suyo.
     Y como es un MÍNIMO y no una altura fija, una dirección de tres
     líneas o un «qué llevar» más largo empujan la fila hacia abajo en
     vez de salirse por encima del texto de al lado. */
  return [
    { etiqueta: ['Equipo del Club'], altoMin: 30.3, valor: [[nuestro(` ${d.club || d.equipo} `)]] },
    { etiqueta: ['Categoría'], altoMin: 24.5, valor: [[amarillo(d.categoria)]] },
    { etiqueta: ['Competición'], altoMin: 25.9, valor: [[amarillo(d.competicion)]] },
    // el original le da 4,5 pt más de aire arriba que al resto
    { etiqueta: ['Partido'], etiquetaSize: 13.9, altoMin: 33.8, offExtra: 4.5, valor: [partido] },
    { etiqueta: ['Fecha'], altoMin: 28.1, valor: [[amarillo(d.fecha, { size: 13.9 })]] },
    /* 42 pt es la altura del original, que lleva pabellón y dirección.
       Con una sola línea ese alto deja un hueco muerto en mitad de la
       hoja, así que baja al de una fila normal. */
    { etiqueta: ['Cancha de juego'], altoMin: cancha.length > 1 ? 42.0 : 28.1,
      valor: cancha.length ? cancha : [[T('')]] },
    { etiqueta: ['Hora del partido'], altoMin: 28.1, valor: [[amarillo(d.hora, { size: 13.9 })]] },
    { etiqueta: ['Hora de llegada', 'a la cancha de juego'], altoMin: 39.6,
      valor: [[amarillo(d.horaLlegada, { size: 13.9 })]] },
    { etiqueta: ['Desplazamiento'], altoMin: 28.1, valor: [[T(d.desplazamiento)]] },
    { etiqueta: ['Hora y Lugar de Salida'], altoMin: 23.5, valor: [[T(d.salida)]] },
    { etiqueta: ['Hora y Lugar de Regreso', '(aproximado)'], altoMin: 32.7, valor: [[T(d.regreso)]] },
    { etiqueta: ['Qué llevar al partido:'], altoMin: 67.2, valor: llevar.map((l) => [T(l)]) },
  ];
}

/**
 * Compone el documento y devuelve el objeto de jsPDF, sin guardarlo.
 * Separado del guardado para poder MIRARLO: un PDF que se descarga y no
 * se abre nunca es un PDF que nadie ha comprobado.
 */
export async function componerPDF(d, { membrete = MEMBRETE_POR_DEFECTO, traer } = {}) {
  const Doc = await jsPDF();
  const doc = new Doc({ unit: 'pt', format: 'a4', compress: true });

  const fuente = (size, bold) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); };
  const pinta = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const rellena = (c) => doc.setFillColor(c[0], c[1], c[2]);

  /* ── 1. El membrete ─────────────────────────────────────── */
  const img = await comoDataURI(d.membrete || membrete, traer);
  if (img) {
    const m = G.membrete;
    try { doc.addImage(img, 'JPEG', m.x, m.y, m.w, m.h); } catch { /* sale sin membrete */ }
  }

  fuente(G.paginaDe.size, false); pinta(C.morado);
  doc.text('Página 1 de 1', G.paginaDe.x, G.paginaDe.base);

  /* La línea de la oficina va con las etiquetas en redonda y los datos
     en negrita, como el papel: «Oficina: **la dirección** · e-mail:
     **el correo**». Por eso son dos campos y no una cadena suelta —
     partir una frase por «e-mail:» para adivinar dónde empieza la
     negrita se rompe el día que alguien la escriba de otra forma. */
  if (d.oficina || d.email) {
    let x = G.oficina.x;
    const escribe = (t, bold) => {
      if (!t) return;
      fuente(G.oficina.size, bold);
      doc.text(t, x, G.oficina.base);
      x += doc.getTextWidth(t);
    };
    pinta(C.morado);
    if (d.oficina) { escribe('Oficina: ', false); escribe(d.oficina, true); }
    if (d.email) { escribe(d.oficina ? ' · e-mail: ' : 'e-mail: ', false); escribe(d.email, true); }
  }

  /* ── 2. El título, sobre su banda gris ──────────────────── */
  fuente(G.titulo.size, true);
  const tit = 'Convocatoria de partido';
  rellena(C.gris);
  /* La banda gris empieza EXACTAMENTE donde el texto, no seis puntos
     antes: en el original el rectángulo y la primera letra comparten
     borde izquierdo, y esa sangría de cortesía se ve. */
  doc.rect(G.titulo.x, G.titulo.fondoY, doc.getTextWidth(tit) + 4, G.titulo.fondoH, 'F');
  pinta(C.negro);
  doc.text(tit, G.titulo.x, G.titulo.base);

  /* ── 3. La tabla ────────────────────────────────────────── */
  const t = G.tabla;
  let y = t.top;
  const altoLinea = (trozos) => Math.max(...trozos.map((x) => x.size)) * t.interlineado;

  for (const fila of filasDelDocumento(d)) {
    const sizeEt = fila.etiquetaSize || t.etiquetaSize;
    const altoEt = fila.etiqueta.length * sizeEt * t.interlineado;
    const altoVal = fila.valor.reduce((s, l) => s + altoLinea(l), 0);
    const alto = Math.max(fila.altoMin || 0, Math.max(altoEt, altoVal) + t.padCrecer);

    /* La etiqueta, en redonda. Se encoge si no cabe en su columna en
       vez de meterse debajo del valor: «Hora y Lugar de Regreso» a 12 pt
       se come los cinco puntos que la separan de la columna de al lado,
       y en el original esa fila va vacía, así que no se veía. */
    const huecoEt = t.valorX - t.etiquetaX - 5;
    fuente(sizeEt, false); pinta(C.negro);
    let sizeEtReal = sizeEt;
    for (const l of fila.etiqueta) {
      while (sizeEtReal > 8 && doc.getTextWidth(l) > huecoEt) {
        sizeEtReal -= 0.2; fuente(sizeEtReal, false);
      }
    }
    fuente(sizeEtReal, false);
    let yy = y + t.padArriba + (fila.offExtra || 0);
    for (const l of fila.etiqueta) {
      doc.text(l, t.etiquetaX, yy + sizeEtReal * ASCENDENTE);
      yy += sizeEt * t.interlineado;
    }

    // el valor, en negrita y con sus resaltados
    yy = y + t.padArriba + (fila.offExtra || 0);
    const huecoVal = t.valorRaya1 - t.valorX;
    for (const linea of fila.valor) {
      const lh = altoLinea(linea);
      /* Un rival con nombre de cuatro palabras —«AGRUPACIÓN DEPORTIVA
         VALLADOLID NORTE»— se salía por el borde derecho de la hoja y
         se cortaba a media palabra. Se encoge la línea entera, no solo
         el trozo que sobra: si se encogiera uno, la frase saldría con
         dos tamaños de letra. */
      let escala = 1;
      let anchoTotal = 0;
      for (const tr of linea) { fuente(tr.size, tr.bold); anchoTotal += doc.getTextWidth(tr.t); }
      if (anchoTotal > huecoVal) escala = Math.max(0.55, huecoVal / anchoTotal);

      let x = t.valorX;
      for (const tr0 of linea) {
        const tr = escala === 1 ? tr0 : { ...tr0, size: tr0.size * escala };
        fuente(tr.size, tr.bold);
        const w = doc.getTextWidth(tr.t);
        if (tr.t.trim()) {
          /* Los renglones de distinto tamaño dentro de una línea se
             alinean por la BASE, no por arriba: «Polideportivo» a 12 y
             «CAMPOS GÓTICOS» a 13,9 se leen como una sola frase. */
          const linBase = yy + lh - tr.size * (t.interlineado - ASCENDENTE);
          if (tr.fondo) {
            // el resaltado envuelve la letra: de su ascendente a su descendente
            rellena(tr.fondo);
            doc.rect(x, linBase - tr.size * ASCENDENTE, w, tr.size * ALTO_RESALTE, 'F');
          }
          pinta(tr.color);
          doc.text(tr.t, x, linBase);
        }
        x += w;
      }
      yy += lh;
    }

    // la raya de abajo, partida en dos como en el original
    y += alto;
    rellena(C.negro);
    doc.rect(t.etiquetaRaya0, y, t.etiquetaRaya1 - t.etiquetaRaya0, t.grosor, 'F');
    doc.rect(t.valorRaya0, y, t.valorRaya1 - t.valorRaya0, t.grosor, 'F');
  }

  /* ── 4. CONVOCADOS, en su recuadro morado ───────────────── */
  const c = G.convocados;
  /* Su sitio del original mientras la tabla mida lo que mide. Si algún
     equipo escribe una dirección de cuatro líneas, la tabla empuja y
     esto baja con ella en vez de quedarse encima. */
  const yConv = Math.max(y + c.huecoArriba, c.y);
  fuente(c.size, true);
  const rotulo = 'CONVOCADOS';
  const anchoRot = doc.getTextWidth(rotulo);
  const baseConv = yConv + c.base;
  rellena(C.morado);
  doc.rect(c.x, baseConv - c.size * ASCENDENTE, anchoRot + 2, c.size * ALTO_RESALTE, 'F');
  pinta(C.blanco);
  doc.text(rotulo, c.x, baseConv);
  pinta(C.negro); fuente(11, false);
  doc.text(':', c.x + anchoRot + 3, baseConv);

  const topAbajo = Math.max(baseConv + c.size * DESCENDENTE + c.huecoAbajo, c.topRejilla);

  /* ── 5. La rejilla de convocados, a la izquierda ─────────── */
  const r = G.rejilla;
  const centroDorsal = (r.x0 + r.x1) / 2;
  d.convocados.forEach((j, i) => {
    const y0 = topAbajo + i * r.fila;
    rellena(C.negro);
    doc.rect(r.x0, y0, r.grosor, r.fila, 'F');                       // vertical izquierda
    doc.rect(r.x1, y0, r.grosor, r.fila, 'F');                       // separador
    doc.rect(r.x2, y0, r.grosor, r.fila, 'F');                       // vertical derecha
    doc.rect(r.x0, y0, r.x2 - r.x0 + r.grosor, r.grosor, 'F');       // raya de arriba

    pinta(C.negro); fuente(r.size, true);
    doc.text(j.dorsal == null ? '—' : String(j.dorsal), centroDorsal, y0 + r.base, { align: 'center' });
    // un nombre largo se encoge antes que cortarse: a un niño no se le trunca
    const hueco = r.x2 - r.nombreX - 4;
    let sz = r.size;
    while (sz > 7 && doc.getTextWidth(String(j.nombre || '')) > hueco) { sz -= 0.5; fuente(sz, true); }
    doc.text(String(j.nombre || ''), r.nombreX, y0 + r.base);
  });
  if (d.convocados.length) {
    rellena(C.negro);
    doc.rect(r.x0, topAbajo + d.convocados.length * r.fila, r.x2 - r.x0 + r.grosor, r.grosor, 'F');
  }

  /* ── 6. Reserva y descanso, a la derecha ─────────────────── */
  const a = G.aparte;
  let yAp = topAbajo + a.base;     // la primera línea, a la altura de la primera de la rejilla

  const bloqueAparte = (rotulo2, gente, hueco) => {
    if (!gente.length) return;
    fuente(a.size, true);
    rellena(C.amarillo);
    doc.rect(a.tituloX, yAp - a.size * ASCENDENTE, doc.getTextWidth(rotulo2), a.size * ALTO_RESALTE, 'F');
    pinta(C.negro);
    doc.text(rotulo2, a.tituloX, yAp);
    yAp += hueco;
    const huecoAp = G.ancho - a.itemX - 14;
    for (const j of gente) {
      const t2 = `${j.dorsal == null ? '' : `${j.dorsal}.- `}${j.nombre || ''}`;
      let sz = a.size;
      while (sz > 7 && doc.getTextWidth(t2) > huecoAp) { sz -= 0.5; fuente(sz, true); }
      doc.text(t2, a.itemX, yAp);
      fuente(a.size, true);
      yAp += a.paso;
    }
    yAp += a.entreBloques;
  };

  bloqueAparte('RESERVA:', d.reservas, a.trasTitulo.reserva);
  bloqueAparte('DESCANSO:', d.descansan, a.trasTitulo.descanso);

  return doc;
}

/** Compone y descarga. Es lo que hace el botón. */
export async function descargarPDF(d, opciones) {
  const doc = await componerPDF(d, opciones);
  doc.save(nombreFichero(d));
  return true;
}
