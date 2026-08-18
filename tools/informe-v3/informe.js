/* Genera el informe de cambios v3 de Playbook CBP en .docx */
const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  PageBreak, Footer, Header, PageNumber, TableOfContents, LevelFormat,
  VerticalAlign, HeightRule, PageOrientation,
} = require('docx');

const { bloques } = require('./contenido.js');

/* ── Paleta y medidas ───────────────────────────────────── */
const INK = '111318';
const ACC = 'FF6A00';      // papaya CBP
const ACC_DK = 'B24A00';   // papaya legible sobre blanco en cuerpo de texto
const MUTED = '6A7280';
const LINE = 'D6D9DE';
const SH_HEAD = 'F1F2F4';
const SH_HOY = 'FBFBFC';
const SH_FILL = 'FFFFFF';

const W = 9860;            // ancho útil de tabla
const C1 = 2080, C2 = W - C1;
const FONT = 'Calibri';

const borde = (color = LINE, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const bordesCaja = (color = LINE) => ({ top: borde(color), bottom: borde(color), left: borde(color), right: borde(color) });

/* ── Átomos de texto ────────────────────────────────────── */
function p(text, o = {}) {
  return new Paragraph({
    alignment: o.align,
    keepNext: o.keep,
    spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 264 },
    indent: o.indent,
    border: o.border,
    children: [new TextRun({
      text, bold: o.bold, italics: o.italics, size: o.size ?? 20,
      color: o.color ?? INK, font: FONT, allCaps: o.caps, characterSpacing: o.spacing,
    })],
  });
}
function runs(children, o = {}) {
  return new Paragraph({
    alignment: o.align,
    keepNext: o.keep,
    spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 264 },
    children: children.map((c) => new TextRun({
      text: c.t, bold: c.b, italics: c.i, size: c.s ?? o.size ?? 20,
      color: c.c ?? o.color ?? INK, font: FONT, allCaps: c.caps, characterSpacing: c.sp,
    })),
  });
}
const vacio = (h = 60, keep = false) =>
  new Paragraph({ spacing: { after: h }, keepNext: keep, children: [] });

/* Lista con viñeta (numbering configurado abajo) */
function li(text, o = {}) {
  return new Paragraph({
    numbering: { reference: 'vinetas', level: 0 },
    spacing: { after: o.after ?? 60, line: 264 },
    children: [new TextRun({ text, size: o.size ?? 20, color: o.color ?? INK, font: FONT, bold: o.bold })],
  });
}

/* ── Átomos de tabla ────────────────────────────────────── */
function celda(children, o = {}) {
  return new TableCell({
    width: { size: o.w ?? C2, type: WidthType.DXA },
    columnSpan: o.span,
    shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
    margins: { top: o.mt ?? 70, bottom: o.mb ?? 70, left: 120, right: 120 },
    verticalAlign: o.valign ?? VerticalAlign.TOP,
    borders: o.borders,
    children,
  });
}
function fila(etiqueta, contenido, o = {}) {
  return new TableRow({
    height: o.h ? { value: o.h, rule: HeightRule.ATLEAST } : undefined,
    cantSplit: true,
    children: [
      celda([runs([{ t: etiqueta, b: true, s: 17, c: o.labelColor ?? MUTED, caps: true, sp: 8 }],
        { after: 0, keep: o.keep })], { w: C1, shade: o.shade ?? SH_HEAD }),
      celda(contenido, { w: C2, shade: o.shadeVal ?? SH_FILL }),
    ],
  });
}
function tabla(rows, o = {}) {
  return new Table({
    width: { size: o.w ?? W, type: WidthType.DXA },
    columnWidths: o.cols ?? [C1, C2],
    borders: bordesCaja(),
    rows,
  });
}

/* Fila de opciones con casillas */
const CAJA = '☐';
const NBSP = ' ';
const SEPARADOR = '  '; // dos cuadratines entre opciones
/* La casilla y su etiqueta van pegadas con espacio duro: si no, Word parte la
   línea entre el cuadrito y su texto y quedan casillas huérfanas al final. */
function opciones(items, o = {}) {
  return runs(
    items.flatMap((t, i) => ([
      { t: CAJA + NBSP + t.replace(/ /g, NBSP), s: o.s ?? 20, c: INK },
      ...(i < items.length - 1 ? [{ t: SEPARADOR }] : []),
    ])),
    { after: o.after ?? 0, line: 300, keep: o.keep },
  );
}

/* ── Encabezados ────────────────────────────────────────── */
/* El TÍTULO es el H1 (es lo que acaba en el índice); la línea de encima es un
   párrafo normal, para que el índice no se llene de «BLOQUE» y «ANEXO». */
function cejilla(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 0, after: 40 },
    children: [new TextRun({ text, size: 19, bold: true, color: ACC_DK, font: FONT, characterSpacing: 30 })],
  });
}
function tituloGrande(num, titulo, o = {}) {
  return new Paragraph({
    heading: o.enIndice === false ? undefined : HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 0, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACC } },
    children: [
      ...(num ? [new TextRun({ text: `${num}${NBSP}${NBSP}`, size: 40, bold: true, color: ACC, font: FONT })] : []),
      new TextRun({ text: titulo, size: 40, bold: true, color: INK, font: FONT }),
    ],
  });
}
function tituloBloque(id, titulo) {
  return [cejilla('BLOQUE'), tituloGrande(id, titulo)];
}
function tituloApartado(id, titulo) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 200, after: 60 },
    children: [
      new TextRun({ text: `${id}${NBSP}${NBSP}`, size: 24, bold: true, color: ACC_DK, font: FONT }),
      new TextRun({ text: titulo, size: 24, bold: true, color: INK, font: FONT }),
    ],
  });
}
function tituloAnexo(letra, titulo, o = {}) {
  return letra ? [cejilla('ANEXO'), tituloGrande(letra, titulo, o)]
    : [tituloGrande(null, titulo, o)];
}

/* ── La tabla de un apartado ────────────────────────────── */
const DECISION = ['Se queda igual', 'Retoque', 'Rediseño', 'Añadir algo nuevo', 'Eliminar', 'No lo tengo claro'];
const PRIORIDAD = ['P0 · Crítica', 'P1 · Alta', 'P2 · Media', 'P3 · Baja'];

/* Todas las filas menos la última llevan «mantener con la siguiente»: es la
   única forma de que Word no parta la ficha de un apartado en dos páginas.
   Las tablas miden ~9 cm, así que siempre caben enteras. */
function tablaApartado(a) {
  const K = { keep: true };
  const rows = [];

  rows.push(fila('Qué hay hoy',
    [p(a.hoy, { size: 18, color: MUTED, italics: true, after: 0, keep: true })],
    { shadeVal: SH_HOY, ...K }));

  if (a.piezas && a.piezas.length) {
    rows.push(fila('Piezas concretas', [
      p('Marca solo las que quieras tocar:', { size: 16, color: MUTED, after: 60, keep: true }),
      opciones(a.piezas, { s: 19, keep: true }),
    ], { shadeVal: SH_HOY, ...K }));
  }

  rows.push(fila('Decisión', [
    opciones(DECISION, { after: 120, keep: true }),
    runs([{ t: 'Prioridad:', b: true, s: 18, c: MUTED }], { after: 40, keep: true }),
    opciones(PRIORIDAD, { keep: true }),
  ], K));

  rows.push(fila('Qué falla o qué falta hoy', [vacio(0, true)], { h: 540, ...K }));
  rows.push(fila('Qué quiero exactamente', [
    p('Descríbelo como si se lo contaras a un ayudante nuevo: qué veo en pantalla, qué pulso, qué pasa después.',
      { size: 15, color: 'A8ADB5', italics: true, after: 0, keep: true }),
  ], { h: 1060, ...K }));

  if (a.libre) {
    rows.push(fila('Lo daré por bueno cuando…', [vacio(0, true)], { h: 500, ...K }));
    rows.push(fila('Espacio libre', [vacio(0)], { h: 2600 }));
  } else {
    rows.push(fila('Lo daré por bueno cuando…', [vacio(0)], { h: 500 }));
  }

  return tabla(rows);
}

/* ══════════════════════════════════════════════════════════
   PORTADA
   ══════════════════════════════════════════════════════════ */
const portada = [
  vacio(1400),
  runs([{ t: 'CLUB BALONCESTO PALENCIA', b: true, s: 20, c: ACC_DK, sp: 60 }], { after: 80 }),
  runs([{ t: 'Playbook CBP', b: true, s: 30, c: MUTED }], { after: 500 }),
  new Paragraph({
    spacing: { after: 0 },
    children: [new TextRun({ text: 'Informe de cambios', size: 68, bold: true, color: INK, font: FONT })],
  }),
  new Paragraph({
    spacing: { after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: ACC } },
    children: [new TextRun({ text: 'para la versión 3', size: 68, bold: true, color: ACC, font: FONT })],
  }),
  p('Documento de recogida de requisitos. Recorre todos los apartados de la aplicación tal y como está hoy y recoge, apartado por apartado, qué se mantiene, qué se cambia y qué se añade en la próxima versión.',
    { size: 22, color: MUTED, after: 700, line: 300 }),

  tabla([
    fila('Producto', [p('Playbook CBP — biblioteca de ejercicios, taller de animación y gestión de equipos, sesiones y partidos.', { after: 0 })]),
    fila('Versión actual', [p('v2 · en producción', { after: 0 })]),
    fila('Versión objetivo', [p('v3', { after: 0 })]),
    fila('Rellena', [vacio(0)], { h: 420 }),
    fila('Fecha', [vacio(0)], { h: 420 }),
    fila('Estado', [opciones(['Borrador', 'En revisión', 'Cerrado'])], { h: 420 }),
  ]),

  vacio(500),
  p('Cómo se usa: léelo de arriba abajo. En cada apartado hay una línea de decisión; si marcas «Se queda igual», pasa al siguiente sin escribir nada más. Solo se rellena el detalle de los apartados que quieras cambiar.',
    { size: 18, color: MUTED, italics: true, line: 280 }),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ══════════════════════════════════════════════════════════
   CÓMO RELLENARLO
   ══════════════════════════════════════════════════════════ */
const instrucciones = [
  ...tituloAnexo('', 'Cómo rellenar este informe'),

  p('Este documento tiene un solo objetivo: que al terminar de leerlo se sepa exactamente qué hay que construir, sin tener que adivinar nada. Está pensado para rellenarse en dos velocidades.',
    { after: 200 }),

  runs([{ t: 'Primera pasada — rápida', b: true, s: 24, c: INK }], { before: 160, after: 100 }),
  p('Recórrelo entero marcando solo la línea de Decisión de cada apartado. En los que marques «Se queda igual» no escribas nada más. Esta pasada debería llevarte menos de una hora y ya deja el mapa hecho.', { after: 160 }),

  runs([{ t: 'Segunda pasada — a fondo', b: true, s: 24, c: INK }], { before: 160, after: 100 }),
  p('Vuelve solo a los apartados marcados como cambio y rellena las tres filas de texto. Cuanto más concreto, menos preguntas después. Los cambios grandes se detallan además en una ficha del Anexo B.', { after: 240 }),

  runs([{ t: 'Las filas de cada apartado', b: true, s: 24, c: INK }], { before: 160, after: 120 }),
  tabla([
    fila('Qué hay hoy', [p('Ya está escrito. Es la descripción de lo que la aplicación hace hoy en ese apartado. No se rellena: sirve para que decidas sobre lo que hay de verdad y no sobre lo que recuerdas.', { size: 19, after: 0 })], { shadeVal: SH_HOY }),
    fila('Piezas concretas', [p('Casillas con los elementos sueltos de ese apartado. Marca solo los que quieras tocar. Es la forma más rápida de señalar con precisión sin escribir un párrafo.', { size: 19, after: 0 })], { shadeVal: SH_HOY }),
    fila('Decisión', [p('Obligatoria en TODOS los apartados. Es la única fila que hay que rellenar sí o sí.', { size: 19, after: 0 })]),
    fila('Qué falla o qué falta', [p('El problema, no la solución. Qué te molesta, qué te hace perder tiempo, qué te obliga a salirte de la aplicación.', { size: 19, after: 0 })]),
    fila('Qué quiero exactamente', [p('La solución tal y como la imaginas. Vale describir la pantalla, poner un ejemplo de otra aplicación o dibujarlo en una servilleta y adjuntar la foto.', { size: 19, after: 0 })]),
    fila('Lo daré por bueno cuando…', [p('La prueba de que está terminado. Una frase que se pueda comprobar: «cuando pueda imprimir la sesión del martes en una hoja y llevármela».', { size: 19, after: 0 })]),
  ]),

  runs([{ t: 'La escala de prioridad', b: true, s: 24, c: INK }], { before: 320, after: 120 }),
  tabla([
    new TableRow({
      children: [
        celda([runs([{ t: 'Nivel', b: true, s: 17, c: MUTED, caps: true, sp: 8 }], { after: 0 })], { w: 1500, shade: SH_HEAD }),
        celda([runs([{ t: 'Significado', b: true, s: 17, c: MUTED, caps: true, sp: 8 }], { after: 0 })], { w: 8360, shade: SH_HEAD }),
      ],
    }),
    ...[
      ['P0 · Crítica', 'Sin esto la v3 no sale. Hoy me está costando trabajo de verdad o me impide usar la aplicación.'],
      ['P1 · Alta', 'Lo quiero en la v3. Si al final no entra, quiero enterarme y decidirlo yo.'],
      ['P2 · Media', 'Mejoraría bastante, pero puede esperar a una v3.1.'],
      ['P3 · Baja', 'Me gustaría algún día. Que quede escrito para no olvidarlo.'],
    ].map(([n, d]) => new TableRow({
      children: [
        celda([runs([{ t: n, b: true, s: 19 }], { after: 0 })], { w: 1500 }),
        celda([p(d, { size: 19, after: 0 })], { w: 8360 }),
      ],
    })),
  ], { cols: [1500, 8360] }),

  runs([{ t: 'Un ejemplo bien rellenado', b: true, s: 24, c: INK }], { before: 320, after: 100 }),
  p('Así se ve un apartado que pide un cambio. Fíjate en que el «qué quiero» describe la pantalla y el «lo daré por bueno» se puede comprobar con el cronómetro en la mano.', { size: 19, color: MUTED, after: 120 }),
  tabla([
    fila('Apartado', [runs([{ t: '9.1 · Pasar lista', b: true, s: 20 }], { after: 0 })], { shadeVal: SH_HOY }),
    fila('Decisión', [runs([
      { t: '☒ ', s: 22, c: ACC_DK, b: true }, { t: 'Retoque' },
      { t: '  Prioridad: ', b: true, s: 18, c: MUTED },
      { t: '☒ ', s: 22, c: ACC_DK, b: true }, { t: 'P1 · Alta' },
    ], { after: 0 })]),
    fila('Qué falla hoy', [p('Paso lista de pie, con el móvil en una mano y el balón en la otra. Los nombres son pequeños y toco al de al lado. Y si un jugador está lesionado, tengo que acordarme de marcarlo cada día.', { size: 19, after: 0 })]),
    fila('Qué quiero exactamente', [p('La misma lista, pero con filas del alto de un dedo y el nombre en grande. Un toque en la fila entera marca presente. Los que están lesionados salen ya marcados en gris con su motivo, y no cuentan como falta. Arriba, un contador de «12 de 14» que se actualiza solo.', { size: 19, after: 0 })]),
    fila('Lo daré por bueno cuando…', [p('Pueda pasar lista a catorce jugadores en menos de veinte segundos, de pie, sin equivocarme de fila.', { size: 19, after: 0 })]),
  ]),

  runs([{ t: 'Y si algo no cabe en ninguna casilla', b: true, s: 24, c: INK }], { before: 320, after: 100 }),
  p('Está el apartado 15.7 para ideas sueltas y el Anexo B para las peticiones grandes. Nada de lo que escribas se pierde: si no cabe, va al anexo.', { after: 100 }),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ══════════════════════════════════════════════════════════
   RESUMEN EJECUTIVO
   ══════════════════════════════════════════════════════════ */
const resumen = [
  ...tituloAnexo('', 'Resumen de la v3'),
  p('Rellena esta página LA ÚLTIMA, cuando ya hayas recorrido todo el documento. Es la que se lee primero y la que decide el rumbo si hay que elegir.',
    { size: 19, color: MUTED, italics: true, after: 240 }),

  tabla([
    fila('La v3 en una frase', [
      p('Si solo se pudiera contar una cosa de la versión nueva, ¿cuál sería?', { size: 16, color: 'A8ADB5', italics: true, after: 0 }),
    ], { h: 900 }),
    fila('Los tres objetivos', [
      p('1.', { size: 19, color: MUTED, after: 260 }),
      p('2.', { size: 19, color: MUTED, after: 260 }),
      p('3.', { size: 19, color: MUTED, after: 0 }),
    ], { h: 1500 }),
    fila('Qué me duele más hoy', [
      p('Lo que te hace perder tiempo cada semana.', { size: 16, color: 'A8ADB5', italics: true, after: 0 }),
    ], { h: 1000 }),
    fila('Qué NO se toca', [
      p('Lo que funciona y no quieres que nadie mueva.', { size: 16, color: 'A8ADB5', italics: true, after: 0 }),
    ], { h: 900 }),
    fila('Quién la va a usar', [opciones(['Solo yo', 'El cuerpo técnico del club', 'Todos los entrenadores', 'También jugadores o familias'], { after: 0 })], { h: 500 }),
    fila('Para cuándo', [vacio(0)], { h: 500 }),
    fila('Qué prefiero si hay que elegir', [
      opciones(['Menos cosas, mejor acabadas', 'Más cosas, aunque queden más justas'], { after: 0 }),
    ], { h: 500 }),
  ]),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ══════════════════════════════════════════════════════════
   BLOQUES
   ══════════════════════════════════════════════════════════ */
const cuerpo = bloques.flatMap((b, i) => [
  ...tituloBloque(b.id, b.titulo),
  p(b.intro, { size: 20, color: MUTED, italics: true, after: 60, line: 280 }),
  ...b.apartados.flatMap((a) => [tituloApartado(a.id, a.titulo), tablaApartado(a), vacio(40)]),
  ...(i < bloques.length - 1 ? [new Paragraph({ children: [new PageBreak()] })] : []),
]);

/* ══════════════════════════════════════════════════════════
   ANEXO A · Tabla maestra
   ══════════════════════════════════════════════════════════ */
const COLS_A = [640, 1560, 4300, 1200, 2160];
const anexoA = [
  new Paragraph({ children: [new PageBreak()] }),
  ...tituloAnexo('A', 'Tabla maestra de peticiones'),
  p('Al terminar el documento, trae aquí todo lo que hayas marcado como cambio, ordenado de más a menos importante. Esta tabla es la que se convierte en el plan de trabajo: si algo no está aquí, no entra en la v3.',
    { size: 20, color: MUTED, after: 240, line: 280 }),
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: COLS_A,
    borders: bordesCaja(),
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['Nº', 'Apartado', 'Qué quiero', 'Prioridad', '¿Imprescindible?'].map((t, i) =>
          celda([runs([{ t, b: true, s: 17, c: MUTED, caps: true, sp: 8 }], { after: 0 })], { w: COLS_A[i], shade: SH_HEAD })),
      }),
      ...Array.from({ length: 16 }, (_, i) => new TableRow({
        height: { value: 560, rule: HeightRule.ATLEAST },
        children: [
          celda([runs([{ t: String(i + 1), s: 19, c: MUTED }], { after: 0 })], { w: COLS_A[0] }),
          celda([vacio(0)], { w: COLS_A[1] }),
          celda([vacio(0)], { w: COLS_A[2] }),
          celda([vacio(0)], { w: COLS_A[3] }),
          celda([opciones(['Sí', 'No'], { s: 19 })], { w: COLS_A[4] }),
        ],
      })),
    ],
  }),
];

/* ══════════════════════════════════════════════════════════
   ANEXO B · Fichas de petición
   ══════════════════════════════════════════════════════════ */
function fichaPeticion(n) {
  return [
    runs([{ t: `Petición nº ${n}`, b: true, s: 26, c: ACC_DK }], { before: n === 1 ? 0 : 360, after: 120 }),
    tabla([
      fila('Título', [vacio(0)], { h: 460 }),
      fila('Apartado(s) que toca', [vacio(0)], { h: 460 }),
      fila('Prioridad', [opciones(PRIORIDAD, { after: 0 })], { h: 440 }),
      fila('Qué problema resuelve', [vacio(0)], { h: 900 }),
      fila('Cómo lo hago hoy', [
        p('Paso a paso, incluyendo lo que haces fuera de la aplicación (papel, WhatsApp, Excel, cabeza).', { size: 15, color: 'A8ADB5', italics: true, after: 0 }),
      ], { h: 1200 }),
      fila('Cómo quiero hacerlo', [
        p('Paso a paso otra vez, pero ya con el cambio hecho.', { size: 15, color: 'A8ADB5', italics: true, after: 0 }),
      ], { h: 1300 }),
      fila('Quién lo usa y cuándo', [
        p('¿Entrenador, ayudante, coordinador? ¿Antes de entrenar, en la pista, en casa el domingo?', { size: 15, color: 'A8ADB5', italics: true, after: 0 }),
      ], { h: 700 }),
      fila('Un ejemplo real', [
        p('Un caso concreto que te haya pasado de verdad esta temporada.', { size: 15, color: 'A8ADB5', italics: true, after: 0 }),
      ], { h: 900 }),
      fila('Qué NO debe cambiar', [vacio(0)], { h: 620 }),
      fila('Lo daré por bueno cuando…', [vacio(0)], { h: 700 }),
    ]),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}
const anexoB = [
  new Paragraph({ children: [new PageBreak()] }),
  ...tituloAnexo('B', 'Fichas de petición en profundidad'),
  p('Para los cambios grandes: los que cambian una pantalla entera, los que añaden un módulo nuevo o los que afectan a varios sitios a la vez. Una ficha por petición. Hay cuatro en blanco; si necesitas más, se duplican.',
    { size: 20, color: MUTED, after: 300, line: 280 }),
  ...[1, 2, 3, 4].flatMap(fichaPeticion),
];

/* ══════════════════════════════════════════════════════════
   ANEXO C · Inventario técnico
   ══════════════════════════════════════════════════════════ */
function filaInv(a, b) {
  return new TableRow({
    children: [
      celda([runs([{ t: a, b: true, s: 19 }], { after: 0 })], { w: 2600 }),
      celda([p(b, { size: 19, after: 0 })], { w: 7260 }),
    ],
  });
}
const anexoC = [
  ...tituloAnexo('C', 'Inventario de lo que existe hoy'),
  p('Referencia, no se rellena. Sirve para consultar mientras decides y para que quede constancia de sobre qué se está construyendo la v3.',
    { size: 19, color: MUTED, italics: true, after: 240 }),

  runs([{ t: 'Las tres áreas de la aplicación', b: true, s: 24 }], { before: 100, after: 120 }),
  tabla([
    filaInv('Biblioteca', 'Los 204 ejercicios del club, con buscador, dos filtros y ficha de detalle con animación.'),
    filaInv('Taller', 'Asistente de cuatro pasos para crear ejercicios: pizarra, animación generada desde el texto, retoque manual y datos. Más el editor a pantalla completa y el proyector.'),
    filaInv('Equipos y Sesiones', 'Equipos, plantilla, horarios, calendario con auto-generación, planificador de sesión, post-sesión, partidos y dossier exportable.'),
  ], { cols: [2600, 7260] }),

  runs([{ t: 'Sobre qué está construido', b: true, s: 24 }], { before: 300, after: 120 }),
  tabla([
    filaInv('Interfaz', 'HTML, CSS y JavaScript directos, sin proceso de compilación. Tres aplicaciones de página única que comparten dominio y sesión.'),
    filaInv('Base de datos', 'Supabase (PostgreSQL) con seguridad por filas: los permisos los impone la base de datos, no la pantalla.'),
    filaInv('Publicación', 'Netlify. Una sola función de servidor, la que genera animaciones con IA.'),
    filaInv('Inteligencia artificial', 'Una única llamada en toda la aplicación: texto del ejercicio → animación. Todo lo demás es determinista y no cuesta nada.'),
    filaInv('Instalable', 'Se puede instalar como aplicación en el móvil. Sin conexión solo se ve lo ya visitado.'),
  ], { cols: [2600, 7260] }),

  runs([{ t: 'Lo que la aplicación guarda', b: true, s: 24 }], { before: 300, after: 120 }),
  tabla([
    filaInv('Ejercicios', 'Ficha completa, animación por fases, miniatura, clasificación y ejes de exigencia.'),
    filaInv('Equipos', 'Datos, color, cuerpo técnico, ajustes, plantilla de jugadores y sus fotos.'),
    filaInv('Calendario', 'Temporadas, horarios semanales, periodos sin entrenamiento y sesiones con su estado.'),
    filaInv('Sesiones', 'Bloques con ejercicio, duración e intensidad; objetivos congelados; carga total calculada.'),
    filaInv('Post-sesión', 'Asistencia por jugador y respuestas de reflexión, con su significado congelado.'),
    filaInv('Partidos', 'Rival, marcador, estado, cinco valoraciones, claves y foto del acta.'),
    filaInv('Objetivos', 'Título, categoría, estado y su progreso a partir de las reflexiones.'),
  ], { cols: [2600, 7260] }),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ══════════════════════════════════════════════════════════
   ANEXO D · Pendientes conocidos
   ══════════════════════════════════════════════════════════ */
const anexoD = [
  ...tituloAnexo('D', 'Pendientes ya conocidos'),
  p('Cosas que ya sabemos que están a medias en la v2. No hace falta que las apuntes: ya están en la lista. Se listan aquí para que no gastes casillas en ellas y para que decidas si alguna sube de prioridad.',
    { size: 20, color: MUTED, after: 240, line: 280 }),

  runs([{ t: 'Requieren una acción tuya', b: true, s: 24 }], { before: 100, after: 120 }),
  li('Poner la clave de IA (ANTHROPIC_API_KEY) en el servidor y volver a publicar. Mientras no esté, la generación de animaciones cae a un lector local más basto y lo avisa en ámbar.'),
  li('Regenerar las miniaturas: hay 107 ejercicios sin miniatura y unos cuantos con una antigua. La herramienta existe pero hay que abrirla con la sesión iniciada y pulsar el botón.'),
  li('Rotar dos claves antiguas que quedaron expuestas.'),

  runs([{ t: 'Trabajo pendiente de desarrollo', b: true, s: 24 }], { before: 300, after: 120 }),
  li('Dos migraciones de base de datos sin aplicar: las de partidos y notas de equipo. Bloquean las estadísticas de partido, el marcador por cuartos y la convocatoria.'),
  li('Medición y elección del modelo de IA con datos reales, en vez de a ojo.'),
  li('Purga de la biblioteca antigua (borrado real de lo que quedó de la primera importación, con copia previa).'),
  li('La escala de la pista se estira lejos del aro: una esquina de media pista mide 8,4 metros cuando en realidad son 6,6.'),

  runs([{ t: 'Decisiones congeladas en la v2', b: true, s: 24 }], { before: 300, after: 120 }),
  p('Se tomaron a propósito. Cambiarlas es legítimo, pero conviene hacerlo sabiendo lo que se cambia: apúntalo en el apartado 0.10 o en el 12.2.', { size: 19, color: MUTED, after: 120 }),
  li('Coste de IA prácticamente cero: solo se llama a un modelo para dibujar animaciones.'),
  li('El dossier es un documento que copias y pegas donde quieras, no un chat integrado.'),
  li('Las sugerencias de ejercicios y el guion en castellano son deterministas: siempre dan lo mismo y no cuestan nada.'),
  li('Papaya es el color de la acción y de nada más.'),

  new Paragraph({ children: [new PageBreak()] }),
];

/* ══════════════════════════════════════════════════════════
   ANEXO E · Glosario
   ══════════════════════════════════════════════════════════ */
const GLOSARIO = [
  ['Apartado', 'Cada una de las piezas numeradas de este informe. Se corresponde con una pantalla, una función o una decisión de la aplicación.'],
  ['Bloque (de sesión)', 'Cada tramo de un entrenamiento: un ejercicio con su duración, su intensidad y sus notas.'],
  ['Carga', 'Intensidad multiplicada por duración. Es lo que dibuja la curva del planificador.'],
  ['Determinista', 'Que con las mismas entradas da siempre exactamente el mismo resultado. No llama a ninguna IA y no cuesta dinero.'],
  ['Dossier', 'El documento con la memoria de la temporada de un equipo, que se copia o se descarga.'],
  ['Ficha', 'Todos los datos de un ejercicio: objetivos, material, desarrollo, variantes y clasificación.'],
  ['Fase', 'Cada tramo de la animación de un ejercicio. Una animación es una secuencia de fases encadenadas.'],
  ['Oposición', 'Si hay un rival que disputa de verdad la acción. Es un eje distinto de la presión.'],
  ['Presión', 'Exigencia sin rival: de espacio, de tiempo o de marcador.'],
  ['Preliminar', 'Estado de una sesión que el calendario ha generado sola pero que todavía no ha tocado nadie.'],
  ['Reflexión', 'El cuestionario que se rellena después de entrenar, propio de cada equipo.'],
  ['Slot / franja', 'Un hueco fijo de entrenamiento en la semana: día, hora de inicio, hora de fin y lugar.'],
  ['Visor', 'La ventana del planificador que enseña el ejercicio del bloque sin salir de la sesión.'],
];
const anexoE = [
  ...tituloAnexo('E', 'Glosario'),
  p('Las palabras que se usan en este documento, por si alguna se usa con un significado más estrecho del habitual.',
    { size: 19, color: MUTED, italics: true, after: 240 }),
  tabla(GLOSARIO.map(([t, d]) => new TableRow({
    children: [
      celda([runs([{ t, b: true, s: 19 }], { after: 0 })], { w: 2400 }),
      celda([p(d, { size: 19, after: 0 })], { w: 7460 }),
    ],
  })), { cols: [2400, 7460] }),

  vacio(400),
  p('Fin del informe. Cuando lo tengas rellenado, con la tabla maestra del Anexo A completa ya se puede empezar a trabajar en la v3.',
    { size: 20, color: MUTED, italics: true }),
];

/* ══════════════════════════════════════════════════════════
   ÍNDICE
   ══════════════════════════════════════════════════════════ */
const indice = [
  ...tituloAnexo('', 'Índice', { enIndice: false }),
  p('Si el índice aparece vacío o desactualizado, pulsa sobre él con el botón derecho y elige «Actualizar campos».',
    { size: 17, color: MUTED, italics: true, after: 200 }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
];

/* ══════════════════════════════════════════════════════════
   DOCUMENTO
   ══════════════════════════════════════════════════════════ */
const doc = new Document({
  creator: 'Playbook CBP',
  title: 'Informe de cambios para la v3 — Playbook CBP',
  description: 'Recogida de requisitos apartado por apartado para la versión 3.',
  numbering: {
    config: [{
      reference: 'vinetas',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 240 } }, run: { color: ACC_DK } },
      }],
    }],
  },
  styles: {
    default: {
      document: { run: { font: FONT, size: 20, color: INK } },
      heading1: { run: { font: FONT, size: 40, bold: true, color: INK } },
      heading2: { run: { font: FONT, size: 24, bold: true, color: INK } },
    },
  },
  sections: [{
    properties: {
      titlePage: true, // la portada va sin cabecera ni número
      page: {
        size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
        margin: { top: 1134, bottom: 1021, left: 1021, right: 1021, header: 567, footer: 567 },
      },
    },
    headers: {
      first: new Header({ children: [new Paragraph({ children: [] })] }),
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 0 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
          children: [
            new TextRun({ text: 'Playbook CBP', size: 15, color: MUTED, font: FONT, characterSpacing: 20 }),
            new TextRun({ text: '  ·  ', size: 15, color: LINE, font: FONT }),
            new TextRun({ text: 'Informe de cambios v3', size: 15, color: MUTED, font: FONT }),
          ],
        })],
      }),
    },
    footers: {
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '— ', size: 16, color: LINE, font: FONT }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: FONT }),
            new TextRun({ text: ' —', size: 16, color: LINE, font: FONT }),
          ],
        })],
      }),
    },
    children: [
      ...portada,
      ...indice,
      ...instrucciones,
      ...resumen,
      ...cuerpo,
      ...anexoA,
      ...anexoB,
      ...anexoC,
      ...anexoD,
      ...anexoE,
    ],
  }],
});

const salida = process.argv[2] || 'informe.docx';
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(salida, buf);
  const n = bloques.reduce((s, b) => s + b.apartados.length, 0);
  console.log(`OK -> ${salida}  (${bloques.length} bloques, ${n} apartados, ${Math.round(buf.length / 1024)} KB)`);
});
