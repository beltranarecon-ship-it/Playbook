/* ============================================================
   equipo-nuevo.js — /equipos/nuevo · alta de equipo en una página:
   datos + color + día de convocatoria + horarios semanales.
   Al guardar: crear equipo → guardar slots → PREVISUALIZAR la
   auto-generación (nada se genera sin confirmar) → aplicar plan.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { abrirModal } from '../ui/modal.js';
import { colorPicker, diaChips, slotsEditor } from '../ui/components.js';
import { crearEquipo } from '../data/teams.js';
import { explica } from '../data/migraciones.js';
import { guardarSlots, previewRegeneracion, getPeriodos } from '../data/schedules.js';
import { getTemporadaActiva, aplicarPlan } from '../data/sessions.js';
import { invalidarEquipos } from '../store.js';
import { CATEGORIAS_EQUIPO, TEAM_COLORS } from '../config.js';
import { router } from '../main.js';

export function render(root) {
  const modelo = { name: '', category: '', color: TEAM_COLORS[0], dia_convocatoria: null };
  const editor = slotsEditor([{ weekday: 1, hora_inicio: '18:00', hora_fin: '19:30', lugar: '' }]);
  let guardando = false;

  const inputNombre = h('input', {
    class: 'field-input', type: 'text', id: 'eq-nombre', maxlength: 80,
    placeholder: 'Infantil A', required: true,
    onInput: (e) => { modelo.name = e.target.value; },
  });

  async function guardar() {
    if (guardando) return;
    if (!modelo.name.trim()) { inputNombre.focus(); inputNombre.classList.add('animate-shake'); return; }
    guardando = true;

    /* ── EL EQUIPO YA ESTÁ CREADO: NO SE PUEDE DECIR QUE NO ──────
       Crear un equipo son tres pasos —el equipo, sus horarios y el
       calendario— y solo el primero es «crear el equipo». Antes, un
       fallo en el tercero se contaba como «No se pudo crear el equipo»,
       y era mentira: el equipo estaba creado. El entrenador volvía a
       intentarlo y acababa con dos. Desde aquí abajo, cualquier fallo
       se cuenta como lo que es —un paso que no salió— y se entra al
       equipo igual. */
    let equipo = null;
    try {
      equipo = await crearEquipo(modelo);
      invalidarEquipos();
    } catch (e) {
      toast('No se pudo crear el equipo: ' + explica(e), 'error');
      guardando = false;
      return;
    }

    try {
      const slots = editor.leer();
      const temporada = await getTemporadaActiva();
      if (slots.length) {
        await guardarSlots(equipo.id, temporada.id, slots);
        const { plan, resumen } = await previewRegeneracion(equipo.id, temporada);
        const periodos = await getPeriodos(temporada.id, equipo.id);
        await new Promise((fin) => {
          const m = abrirModal({
            titulo: 'Generar calendario',
            cuerpo: h('div', {},
              h('p', { class: 'eq-confirm-text' },
                `Se crearán ${resumen.insertar} sesiones preliminares para la temporada ${temporada.label}`,
                resumen.saltadas ? `, saltando ${resumen.saltadas} en días sin entreno` : '',
                '.'),
              !periodos.length
                ? h('p', { class: 'eq-aviso' }, 'Aún no hay periodos sin entreno cargados (calendario escolar): se generará también en festivos. Puedes cargarlos después en Ajustes y regenerar.')
                : null,
            ),
            pie: [
              h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { m.cerrar(); fin(); } }, 'Ahora no'),
              h('button', {
                class: 'btn btn-primary', type: 'button',
                onClick: async () => {
                  try {
                    const r = await aplicarPlan(equipo.id, temporada.id, plan);
                    toast(`${r.insertadas} sesiones preliminares creadas`);
                  } catch (e) { toast('Error al generar: ' + e.message, 'error'); }
                  m.cerrar(); fin();
                },
              }, 'Generar'),
            ],
            alCerrar: fin,
          });
        });
      }
      toast(`Equipo «${equipo.name}» creado`);
    } catch (e) {
      /* El equipo está creado; lo que ha fallado son los horarios o el
         calendario. Se dice ASÍ y se entra al equipo, donde se pueden
         arreglar. */
      toast(`«${equipo.name}» se ha creado, pero los horarios no: `
        + explica(e) + ' Puedes ponerlos desde la pestaña Horarios.', 'error');
    }
    router.navigate(`/equipos/${equipo.id}`);
  }

  mount(root, h('div', { class: 'eq-page eq-page-estrecha' },
    h('div', { class: 'view-hero' },
      h('div', { class: 'view-hero-text' },
        h('span', { class: 'eyebrow' }, 'Gestión'),
        h('h1', { class: 'display view-title' },
          h('span', { class: 'solid' }, 'Nuevo'),
          h('span', { class: 'ghost' }, 'equipo')),
      ),
    ),

    h('div', { class: 'eq-form-card' },
      h('h2', { class: 'eq-form-seccion' }, 'Datos'),
      h('div', { class: 'field-group' },
        h('label', { class: 'field-label', for: 'eq-nombre' }, 'Nombre ', h('span', { class: 'required' }, '*')),
        inputNombre,
      ),
      h('div', { class: 'field-row' },
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label', for: 'eq-cat' }, 'Categoría'),
          h('select', {
            class: 'field-select', id: 'eq-cat',
            onChange: (e) => { modelo.category = e.target.value; },
          },
            h('option', { value: '' }, 'Sin categoría'),
            ...CATEGORIAS_EQUIPO.map((c) => h('option', { value: c }, c)),
          ),
        ),
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, 'Color en el calendario'),
          colorPicker(modelo.color, (c) => { modelo.color = c; }),
        ),
      ),
      h('div', { class: 'field-group' },
        h('label', { class: 'field-label' }, 'Día de convocatoria (partidos)'),
        diaChips(null, (d) => { modelo.dia_convocatoria = d; }),
        h('p', { class: 'eq-ayuda' }, 'El día de la semana en que preparas la convocatoria. Opcional; se usará en la fase de partidos.'),
      ),

      h('h2', { class: 'eq-form-seccion' }, 'Horario semanal'),
      h('p', { class: 'eq-ayuda' }, 'Cada día de entreno generará sesiones preliminares en el calendario para toda la temporada.'),
      editor,

      h('div', { class: 'eq-form-acciones' },
        h('a', { class: 'btn btn-secondary', href: '/equipos', 'data-link': true }, 'Cancelar'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: guardar }, 'Crear equipo'),
      ),
    ),
  ));

  return { destroy() {} };
}
