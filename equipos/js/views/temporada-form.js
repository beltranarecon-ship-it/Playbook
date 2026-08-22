/* ============================================================
   temporada-form.js — gestión de la temporada de trabajo.
   Todo el módulo cuelga de ella (horarios, objetivos, sesiones y su
   auto-generación), así que cuando la activa ya ha terminado hay que
   DECIRLO: generar sesiones en un rango pasado deja el calendario
   vacío sin explicar por qué.
   Escritura solo admin (RLS de 001); el resto ve el aviso sin botón.
   ============================================================ */

import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { abrirModal, confirmar, confirmarEscribiendo } from '../ui/modal.js';
import {
  getTemporadas, crearTemporada, activarTemporada,
  borrarTemporada, borrarTemporadaConHistorial, queHayEn,
} from '../data/seasons.js';
import { estadoTemporada, proponerTemporada } from '../data/programacion.js';
import { invalidarTemporada, esAdmin } from '../store.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const fechaLarga = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
};
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Banner de aviso si la temporada de trabajo no cubre hoy. Devuelve
 * null cuando todo está en orden (el caso normal: ningún ruido).
 */
export function avisoTemporada(temporada, { onCambiada } = {}) {
  if (!temporada) return null;
  const estado = estadoTemporada(temporada, hoyISO());
  if (estado === 'vigente') return null;

  const texto = estado === 'terminada'
    ? `La temporada ${temporada.label} terminó el ${fechaLarga(temporada.end_date)}. Todo lo que generes (sesiones, objetivos) se creará dentro de ese rango, en el pasado.`
    : estado === 'futura'
      ? `La temporada ${temporada.label} empieza el ${fechaLarga(temporada.start_date)}. Aún no hay nada que generar en las fechas de hoy.`
      : `La temporada ${temporada.label} no tiene fechas de inicio y fin, así que la generación automática no puede funcionar.`;

  return h('div', { class: 'eq-aviso eq-aviso-temporada', role: 'status' },
    h('span', {}, texto),
    esAdmin()
      ? h('button', {
          class: 'btn btn-primary eq-btn-mini', type: 'button',
          onClick: () => modalTemporada({ onCambiada }),
        }, estado === 'terminada' ? 'Nueva temporada' : 'Gestionar temporadas')
      : h('span', { class: 'eq-ayuda' }, 'Pídele a un administrador que abra la nueva temporada.'),
  );
}

/** Modal: lista de temporadas + alta de una nueva. Solo tiene sentido en admin. */
export function modalTemporada({ onCambiada } = {}) {
  const sug = proponerTemporada(hoyISO());
  const m0 = { label: sug.label, start_date: sug.start_date, end_date: sug.end_date };
  let lista, md;

  const refrescarLista = async () => {
    let temporadas = [];
    try { temporadas = await getTemporadas(); }
    catch (e) { lista.replaceChildren(h('p', { class: 'eq-ayuda' }, 'Error: ' + e.message)); return; }
    lista.replaceChildren(...temporadas.map((t) => h('div', { class: 'eq-temp' + (t.is_active ? ' activa' : '') },
      h('div', { class: 'eq-temp-datos' },
        h('span', { class: 'eq-temp-label' }, t.label),
        h('span', { class: 'eq-periodo-fechas' }, `${t.start_date || '—'} → ${t.end_date || '—'}`),
      ),
      t.is_active
        ? h('span', { class: 'eq-obj-badge eq-obj-badge-ok' }, 'de trabajo')
        : h('button', {
            class: 'btn btn-secondary eq-btn-mini', type: 'button',
            onClick: async () => {
              const ok = await confirmar({
                titulo: `Trabajar en ${t.label}`,
                mensaje: 'El calendario, los horarios y los objetivos pasarán a los de esta temporada. Nada se borra: lo de las otras sigue guardado.',
                textoOk: 'Cambiar',
              });
              if (!ok) return;
              try {
                await activarTemporada(t.id);
                invalidarTemporada();
                toast(`Trabajando en ${t.label}`);
                md.cerrar(); onCambiada?.();
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Trabajar en esta'),
      /* Borrar (§5.10: «crear y eliminar temporadas: solo el
         administrador»). La de trabajo NO se ofrece: borrar el suelo
         que pisas deja la app sin calendario y sin saber dónde está.
         Cambia primero a otra y después bórrala. */
      (!t.is_active && esAdmin()) ? h('button', {
        class: 'eq-btn-icono', type: 'button',
        title: `Borrar la temporada ${t.label}`, 'aria-label': `Borrar la temporada ${t.label}`,
        onClick: async () => {
          let dentro;
          try { dentro = await queHayEn(t.id); }
          catch (e) { toast('Error: ' + e.message, 'error'); return; }

          /* Se dice lo que hay DENTRO antes de preguntar. «Se borrará la
             temporada 2025/26» y «… con 112 entrenamientos y 18
             partidos» son la misma frase para la base de datos y dos
             decisiones muy distintas para una persona.

             null = no se ha podido contar: no se afirma que esté vacía. */
          const noSeSabe = dentro.sesiones === null || dentro.partidos === null;
          const conHistoria = !!(dentro.sesiones || dentro.partidos);

          /* ── Vacía: una confirmación basta ──────────────────── */
          if (!conHistoria && !noSeSabe) {
            if (!(await confirmar({
              titulo: `Borrar ${t.label}`,
              mensaje: 'Está vacía: no tiene entrenamientos ni partidos. '
                + 'Se borrarán también sus horarios y objetivos.',
              textoOk: 'Borrar',
            }))) return;
            try {
              if (await borrarTemporada(t.id)) {
                toast(`${t.label} borrada`);
                await refrescarLista(); onCambiada?.();
                return;
              }
              // la policy la ha rechazado: se sigue por la puerta larga
            } catch (e) { toast('Error: ' + e.message, 'error'); return; }
          }

          /* ── Con historia: dos puertas ─────────────────────── */
          if (!(await confirmar({
            titulo: `Borrar ${t.label} y todo lo suyo`,
            mensaje: noSeSabe
              ? 'No he podido comprobar qué tiene dentro, así que no puedo decirte qué se va a perder. '
                + 'Se borrará la temporada entera con todo lo que cuelgue de ella.'
              : `${t.label} tiene un año de trabajo dentro. Esto no se puede deshacer ni hay copia: `
                + 'lo que se borre no vuelve.',
            textoOk: 'Sí, quiero borrarla',
          }))) return;

          const escrito = await confirmarEscribiendo({
            titulo: `Borrar ${t.label} del todo`,
            nombre: t.label,
            queSeLleva: noSeSabe ? [] : [
              dentro.sesiones && `${dentro.sesiones} entrenamiento${dentro.sesiones === 1 ? '' : 's'} de todos los equipos, con su lista y su reflexión`,
              dentro.partidos && `${dentro.partidos} partido${dentro.partidos === 1 ? '' : 's'}, con su acta y sus estadísticas`,
              'los horarios semanales, los objetivos, las notas y los periodos sin entrenamiento',
            ].filter(Boolean),
            aviso: 'Los equipos y sus jugadores NO se borran: siguen ahí para la temporada que viene.',
          });
          if (!escrito) return;

          try {
            const r = await borrarTemporadaConHistorial(t.id, escrito);
            toast(`${r.nombre} borrada · ${r.sesiones} entrenamiento(s), `
              + `${r.partidos} partido(s) y ${r.objetivos} objetivo(s)`);
            await refrescarLista(); onCambiada?.();
          } catch (e) { toast(e.message, 'error'); }
        },
      }, '×') : null,
    )));
  };

  md = abrirModal({
    titulo: 'Temporadas',
    cuerpo: h('div', { class: 'eq-form-vertical' },
      lista = h('div', { class: 'eq-temps' }, h('p', { class: 'eq-ayuda' }, 'Cargando…')),
      h('div', { class: 'eq-form-seccion' }, 'Nueva temporada'),
      h('div', { class: 'field-row' },
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Nombre'),
          h('input', {
            class: 'field-input', type: 'text', value: m0.label, placeholder: '2026/27',
            onInput: (e) => { m0.label = e.target.value; },
          }),
        ),
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Desde'),
          h('input', {
            class: 'field-input', type: 'date', value: m0.start_date,
            onChange: (e) => { m0.start_date = e.target.value; },
          }),
        ),
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Hasta'),
          h('input', {
            class: 'field-input', type: 'date', value: m0.end_date,
            onChange: (e) => { m0.end_date = e.target.value; },
          }),
        ),
      ),
      h('p', { class: 'eq-ayuda' }, 'Los horarios semanales y los objetivos son de cada temporada: al abrir una nueva, la vuelves a montar desde la ficha del equipo. Las sesiones de las anteriores no se tocan.'),
    ),
    pie: [
      h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md.cerrar() }, 'Cerrar'),
      h('button', {
        class: 'btn btn-primary', type: 'button',
        onClick: async () => {
          if (!m0.label.trim()) { toast('Ponle nombre a la temporada', 'error'); return; }
          if (!m0.start_date || !m0.end_date) { toast('Faltan las fechas', 'error'); return; }
          if (m0.end_date <= m0.start_date) { toast('La fecha de fin va después de la de inicio', 'error'); return; }
          try {
            await crearTemporada({ ...m0, activar: true });
            invalidarTemporada();
            toast(`Temporada ${m0.label} creada y activa`);
            md.cerrar(); onCambiada?.();
          } catch (e) { toast('Error: ' + e.message, 'error'); }
        },
      }, 'Crear y trabajar en ella'),
    ],
  });
  refrescarLista();
  return md;
}
