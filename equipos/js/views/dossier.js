/* ============================================================
   dossier.js (vista) — /dossier/:teamId · la memoria del equipo.
   Elige el periodo, mira el resumen, escribe las notas que explican
   los números y llévate el Markdown: copiar al portapapeles (para
   pegárselo a Claude) o descargar el .md.
   Decisión congelada: NO hay chat integrado ni llamadas a ninguna IA
   — coste cero. El documento es el producto; tú decides dónde lo usas.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { abrirModal, confirmar } from '../ui/modal.js';
import { puntoEquipo } from '../ui/components.js';
import { getTemporadaActiva } from '../data/sessions.js';
import { recopilarDossier } from '../data/dossier-fuente.js';
import { crearNota, actualizarNota, borrarNota } from '../data/notes.js';
import {
  construirDossier, resumenTemporada, nombreFicheroDossier, fechaLegible,
} from '../data/dossier.js';
import { router } from '../main.js';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const uno = (n) => (n == null ? '—' : (Math.round(n * 10) / 10).toString());

export function render(root, params) {
  const teamId = params.teamId;
  const cont = h('div', { class: 'eq-page eq-dossier' });
  mount(root, cont);

  let temporada = null, datos = null, md = '';
  const qs = new URLSearchParams(location.search);
  // por defecto, la temporada entera: es la memoria de la temporada
  const rango = { desde: qs.get('desde') || '', hasta: qs.get('hasta') || '' };
  const opciones = { detalle: true, generado: true };

  const dato = (n, lbl) => h('div', { class: 'eq-carga-dato' },
    h('span', { class: 'eq-carga-num' }, n),
    h('span', { class: 'eq-carga-lbl' }, lbl));

  // ── notas del cuerpo técnico ───────────────────────────────
  function modalNota(nota = null) {
    const m0 = { fecha: nota?.fecha || '', titulo: nota?.titulo || '', cuerpo: nota?.cuerpo || '' };
    let ta;
    const md2 = abrirModal({
      titulo: nota ? 'Editar nota' : 'Nueva nota',
      cuerpo: h('div', { class: 'eq-form-vertical' },
        h('div', { class: 'field-row' },
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Fecha (opcional)'),
            h('input', {
              class: 'field-input', type: 'date', value: m0.fecha,
              onChange: (e) => { m0.fecha = e.target.value; },
            }),
          ),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Título (opcional)'),
            h('input', {
              class: 'field-input', type: 'text', value: m0.titulo, placeholder: 'Pabellón, lesiones…',
              onInput: (e) => { m0.titulo = e.target.value; },
            }),
          ),
        ),
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Nota'),
          ta = h('textarea', {
            class: 'field-textarea', rows: 4,
            placeholder: 'Lo que explica la temporada y no cabe en una sesión: incorporaciones, lesiones largas, cambios de pabellón, lo que pide el club…',
          }, m0.cuerpo),
        ),
        h('p', { class: 'eq-ayuda' }, 'Las notas salen al final del dossier, como contexto.'),
      ),
      pie: [
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => md2.cerrar() }, 'Cancelar'),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          // el `await` dura lo que dura: sin bloquear el botón, dos clics
          // seguidos creaban DOS notas idénticas
          onClick: async (e) => {
            const btn = e.currentTarget;
            if (btn.disabled) return;
            const cuerpo = ta.value.trim();
            if (!cuerpo) { toast('La nota está vacía', 'error'); return; }
            btn.disabled = true;
            try {
              if (nota) await actualizarNota(nota.id, { fecha: m0.fecha || null, titulo: m0.titulo.trim() || null, cuerpo });
              else await crearNota({ team_id: teamId, season_id: temporada.id, fecha: m0.fecha, titulo: m0.titulo, cuerpo });
              md2.cerrar(); toast(nota ? 'Nota actualizada' : 'Nota añadida'); cargar();
            } catch (err) {
              btn.disabled = false;
              toast('Error: ' + err.message, 'error');
            }
          },
        }, 'Guardar'),
      ],
    });
    ta.focus();
  }

  function seccionNotas() {
    if (!datos.disponible.notas) {
      return h('p', { class: 'eq-ayuda' }, 'Las notas del cuerpo técnico todavía no están disponibles en esta base de datos.');
    }
    return h('div', {},
      datos.notas.length
        ? h('div', { class: 'eq-notas' }, datos.notas.map((n) => h('div', { class: 'eq-nota' },
            h('div', { class: 'eq-nota-info' },
              h('span', { class: 'eq-nota-cab' },
                n.fecha ? h('span', { class: 'eq-periodo-fechas' }, n.fecha) : h('span', { class: 'eq-obj-badge' }, 'toda la temporada'),
                n.titulo ? h('strong', {}, n.titulo) : null),
              h('span', { class: 'eq-nota-cuerpo' }, n.cuerpo)),
            h('div', { class: 'eq-obj-acciones' },
              h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: () => modalNota(n) }, 'Editar'),
              h('button', {
                class: 'eq-slot-quitar', type: 'button', 'aria-label': 'Eliminar nota',
                onClick: async () => {
                  if (!(await confirmar({ titulo: 'Eliminar nota', mensaje: '¿Eliminar esta nota?', textoOk: 'Eliminar' }))) return;
                  try { await borrarNota(n.id); toast('Nota eliminada'); cargar(); }
                  catch (e) { toast('Error: ' + e.message, 'error'); }
                },
              }, '×'),
            ),
          )))
        : h('p', { class: 'eq-ayuda' }, 'Sin notas todavía. Son el contexto que hace que los números se entiendan.'),
      h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => modalNota() }, '+ Añadir nota'),
    );
  }

  // ── exportación ────────────────────────────────────────────
  async function copiar() {
    try {
      await navigator.clipboard.writeText(md);
      toast('Dossier copiado: pégalo donde quieras');
    } catch {
      // sin permiso de portapapeles: se selecciona para que lo copie a mano
      const ta = cont.querySelector('.eq-dossier-md');
      if (ta) { ta.focus(); ta.select(); }
      toast('Selecciónalo y cópialo con Ctrl+C', 'error');
    }
  }

  function descargar() {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: nombreFicheroDossier(datos.equipo, rango) });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── pintado ────────────────────────────────────────────────
  function pinta() {
    md = construirDossier(datos, {
      detalle: opciones.detalle,
      generadoEl: opciones.generado ? hoyISO() : null,
    });
    const r = resumenTemporada(datos);

    mount(cont,
      h('div', { class: 'eq-planner-top' },
        h('a', {
          class: 'eq-volver', href: `/equipos/${teamId}`, 'data-link': true,
        }, '‹ Ficha del equipo'),
      ),
      h('div', { class: 'view-hero eq-planner-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, puntoEquipo(datos.equipo.color), ' ', `Temporada ${temporada.label}`),
          h('h1', { class: 'display view-title' },
            h('span', { class: 'solid' }, 'Dossier'),
            h('span', { class: 'ghost' }, datos.equipo.name)),
          h('p', { class: 'view-meta' }, `${fechaLegible(rango.desde)} → ${fechaLegible(rango.hasta)}`),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'Periodo'),
        ),
        h('div', { class: 'field-row eq-dossier-rango' },
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Desde'),
            h('input', {
              class: 'field-input', type: 'date', value: rango.desde,
              onChange: (e) => { rango.desde = e.target.value; cargar(); },
            }),
          ),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Hasta'),
            h('input', {
              class: 'field-input', type: 'date', value: rango.hasta,
              onChange: (e) => { rango.hasta = e.target.value; cargar(); },
            }),
          ),
          h('div', { class: 'field-group' },
            h('label', { class: 'field-label' }, 'Atajos'),
            h('div', { class: 'eq-catchips' },
              h('button', {
                class: 'eq-catchip', type: 'button',
                onClick: () => { rango.desde = temporada.start_date; rango.hasta = temporada.end_date; cargar(); },
              }, 'Toda la temporada'),
              h('button', {
                class: 'eq-catchip', type: 'button',
                onClick: () => {
                  const hoy = hoyISO();
                  const d = new Date(Date.parse(hoy + 'T00:00:00Z') - 29 * 86400000).toISOString().slice(0, 10);
                  rango.desde = d; rango.hasta = hoy; cargar();
                },
              }, 'Últimos 30 días'),
            ),
          ),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Lo que dice el periodo'),
        h('div', { class: 'eq-as-resumen' },
          dato(String(r.sesiones.realizadas), 'entrenos hechos'),
          dato(r.asistencia.media != null ? `${Math.round(r.asistencia.media)}%` : '—', 'asistencia media'),
          dato(uno(r.cumplimiento.media), 'cumplimiento /5'),
          dato(r.carga.media != null ? String(Math.round(r.carga.media)) : '—', 'carga media'),
          r.partidos.jugados
            ? dato(`${r.partidos.victorias}-${r.partidos.derrotas}${r.partidos.empates ? '-' + r.partidos.empates : ''}`, 'balance')
            : null,
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'Notas del cuerpo técnico'),
        ),
        seccionNotas(),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'El documento'),
          h('div', { class: 'eq-zona-acciones' },
            h('label', { class: 'eq-check' },
              h('input', {
                type: 'checkbox', checked: opciones.detalle,
                onChange: (e) => { opciones.detalle = e.target.checked; pinta(); },
              }), ' Detallar los bloques'),
            h('label', { class: 'eq-check' },
              h('input', {
                type: 'checkbox', checked: opciones.generado,
                onChange: (e) => { opciones.generado = e.target.checked; pinta(); },
              }), ' Fecha de generación'),
          ),
        ),
        h('p', { class: 'eq-ayuda' },
          `${md.split('\n').length} líneas · ${md.length.toLocaleString('es-ES')} caracteres. `
          + 'Es texto plano: pégalo en un chat, en un correo o guárdalo con la temporada.'),
        h('textarea', {
          class: 'field-textarea eq-dossier-md', rows: 22, readOnly: true,
          'aria-label': 'Dossier en Markdown', spellcheck: 'false',
        }, md),
        h('div', { class: 'eq-planner-barra' },
          h('div', { class: 'eq-planner-barra-sec' },
            h('button', { class: 'btn btn-secondary', type: 'button', onClick: descargar }, 'Descargar .md'),
          ),
          h('button', { class: 'btn btn-primary eq-planner-guardar', type: 'button', onClick: copiar },
            'Copiar al portapapeles'),
        ),
      ),
    );
  }

  // ── carga ──────────────────────────────────────────────────
  // Cada cargar() se queda con un turno. Si mientras vuela llega otra (el
  // usuario cambia la fecha dos veces, o pulsa un atajo), la vieja se
  // descarta al volver: si no, una respuesta lenta pisaba `datos` con el
  // periodo anterior y el dossier salía rotulado con un rango y relleno
  // con otro — y ese texto es el que se copia y se pega.
  let turno = 0;
  let vivo = true;

  async function cargar() {
    const mio = ++turno;
    try {
      if (!temporada) {
        temporada = await getTemporadaActiva();
        if (!rango.desde) rango.desde = temporada.start_date || hoyISO();
        if (!rango.hasta) rango.hasta = temporada.end_date || hoyISO();
      }
      if (rango.hasta < rango.desde) { toast('El «hasta» va después del «desde»', 'error'); return; }
      const frescos = await recopilarDossier({ teamId, temporada, desde: rango.desde, hasta: rango.hasta });
      if (!vivo || mio !== turno) return;          // llegó tarde: no manda
      datos = frescos;
      pinta();
    } catch (e) {
      if (!vivo || mio !== turno) return;
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo montar el dossier'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/equipos', 'data-link': true }, 'Volver a equipos')));
    }
  }
  cargar();

  return { destroy() { vivo = false; } };
}
