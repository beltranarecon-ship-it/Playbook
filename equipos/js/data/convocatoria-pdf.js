/* ============================================================
   convocatoria-pdf.js — el PDF que se manda al grupo.

   ── POR QUÉ SE DIBUJA Y NO SE RELLENA UNA PLANTILLA ─────────
   La otra opción era coger el documento del club y escribir encima.
   Eso exige saber en qué milímetro exacto cae cada campo de ESE
   fichero, calibrarlo a mano una vez por equipo, y volver a
   calibrarlo el día que la federación cambie el papel. Dibujarlo aquí
   da el mismo documento, sale hoy, y cuando cambie algo se cambia en
   un sitio.

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

/* Medidas en milímetros sobre A4 (210 × 297).

   Están apretadas a propósito: una convocatoria de doce niños, con su
   reserva y su descanso, tiene que caber en UNA hoja. Con dos páginas,
   la segunda es la que lleva los nombres y es justo la que la gente no
   abre en el móvil. Con estos números el peor caso —partido fuera, con
   las dos filas de desplazamiento y la cabecera larga— se queda en
   torno a 250 de los 265 mm útiles. Si algún día no cupiera, el corte
   de página está puesto y sale entero en dos hojas: eso es feo, pero
   un nombre cortado por la mitad es un niño que no sabe si va. */
const M = {
  izq: 18, der: 18, arriba: 15, abajo: 15,
  etiqueta: 52,          // ancho de la columna de la izquierda
  linea: 4.4,            // alto de una línea de texto
  padY: 1.4,             // aire arriba y abajo de cada celda
  base: 3.1,             // de la parte de arriba de la celda a la base del texto
};
const ANCHO = 210;
const ALTO = 297;

/* Gris de las líneas y negro del texto. Sin papaya: esto es un
   documento oficial que a veces se imprime en blanco y negro. */
const LINEA = 170;

let cargando = null;
async function jsPDF() {
  if (!cargando) cargando = import(/* @vite-ignore */ JSPDF).then((m) => m.jsPDF || m.default?.jsPDF || m.default);
  const F = await cargando;
  if (typeof F !== 'function') throw new Error('No se pudo cargar el generador de PDF.');
  return F;
}

/** Las filas de la cabecera, en el orden del papel del club. */
export function filasCabecera(d) {
  const filas = [
    ['Equipo del Club', d.club || d.equipo],
    ['Categoría', d.categoria],
    ['Competición', d.competicion],
    ['Partido', d.partido],
    ['Fecha', d.fecha],
    ['Cancha de juego', d.cancha],
    ['Hora del partido', d.hora],
    ['Hora de llegada a la cancha de juego', d.horaLlegada],
  ];
  /* El desplazamiento solo cuando se juega fuera: en casa nadie se
     desplaza junto, y tres filas vacías en el papel invitan a
     preguntar «¿y esto?» a catorce familias. */
  if (d.donde === 'fuera' || d.salida || d.regreso) {
    filas.push(['Hora y Lugar de Salida', d.salida]);
    filas.push(['Hora y Lugar de Regreso (aproximado)', d.regreso]);
  }
  filas.push(['Qué llevar al partido', d.llevar]);
  // las filas sin nada no se imprimen: un hueco no informa de nada
  return filas.filter(([, v]) => String(v ?? '').trim() !== '');
}

/**
 * Compone el documento y devuelve el objeto de jsPDF, sin guardarlo.
 * Está separado del guardado para poder MIRARLO: un PDF que se descarga
 * y no se abre nunca es un PDF que nadie ha comprobado.
 * @param d  la salida de `datosDelDocumento`
 */
export async function componerPDF(d) {
  const Doc = await jsPDF();
  const doc = new Doc({ unit: 'mm', format: 'a4', compress: true });

  const anchoUtil = ANCHO - M.izq - M.der;
  const anchoValor = anchoUtil - M.etiqueta;
  let y = M.arriba;

  const saltoSiHaceFalta = (alto) => {
    if (y + alto <= ALTO - M.abajo) return;
    doc.addPage();
    y = M.arriba;
  };

  /* ── Título ─────────────────────────────────────────────── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Convocatoria de partido', M.izq, y + 4);
  y += 10;

  /* ── La cabecera, en dos columnas ───────────────────────── */
  doc.setFontSize(9.5);
  doc.setDrawColor(LINEA);
  doc.setLineWidth(0.2);

  for (const [etiqueta, valor] of filasCabecera(d)) {
    doc.setFont('helvetica', 'normal');
    const lineasEt = doc.splitTextToSize(String(etiqueta), M.etiqueta - 4);
    doc.setFont('helvetica', 'bold');
    const lineasVal = doc.splitTextToSize(String(valor), anchoValor - 4);
    const alto = Math.max(lineasEt.length, lineasVal.length) * M.linea + M.padY * 2;

    saltoSiHaceFalta(alto);
    doc.rect(M.izq, y, M.etiqueta, alto);
    doc.rect(M.izq + M.etiqueta, y, anchoValor, alto);

    doc.setFont('helvetica', 'normal');
    doc.text(lineasEt, M.izq + 2, y + M.padY + M.base);
    doc.setFont('helvetica', 'bold');
    doc.text(lineasVal, M.izq + M.etiqueta + 2, y + M.padY + M.base);
    y += alto;
  }

  /* ── Los tres grupos ────────────────────────────────────── */
  const bloque = (titulo, gente, { tabla }) => {
    if (!gente.length) return;
    y += 6;
    saltoSiHaceFalta(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${titulo}:`, M.izq, y + 4);
    y += 7;
    doc.setFontSize(9.5);

    if (tabla) {
      /* Convocados: rejilla con el dorsal a la izquierda, como el acta.
         En la mesa se busca por número, no por nombre. */
      const anchoDorsal = 16;
      for (const j of gente) {
        const alto = M.linea + M.padY * 2;
        saltoSiHaceFalta(alto);
        doc.rect(M.izq, y, anchoDorsal, alto);
        doc.rect(M.izq + anchoDorsal, y, anchoUtil - anchoDorsal, alto);
        doc.setFont('helvetica', 'bold');
        doc.text(j.dorsal == null ? '—' : String(j.dorsal), M.izq + anchoDorsal / 2, y + M.padY + M.base, { align: 'center' });
        doc.text(String(j.nombre || ''), M.izq + anchoDorsal + 2, y + M.padY + M.base);
        y += alto;
      }
    } else {
      /* Reserva y descanso: una línea suelta cada uno, «13.- Álvaro
         Salas», que es como los escribe el club. */
      doc.setFont('helvetica', 'bold');
      for (const j of gente) {
        saltoSiHaceFalta(M.linea);
        const dorsal = j.dorsal == null ? '' : `${j.dorsal}.- `;
        doc.text(`${dorsal}${j.nombre || ''}`, M.izq, y + M.base);
        y += M.linea;
      }
    }
  };

  bloque('CONVOCADOS', d.convocados, { tabla: true });
  bloque('RESERVA', d.reservas, { tabla: false });
  bloque('DESCANSO', d.descansan, { tabla: false });

  return doc;
}

/** Compone y descarga. Es lo que hace el botón. */
export async function descargarPDF(d) {
  const doc = await componerPDF(d);
  doc.save(nombreFichero(d));
  return true;
}
