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
    try {
      const equipo = await crearEquipo(modelo);
      invalidarEquipos();
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
      router.navigate(`/equipos/${equipo.id}`);
    } catch (e) {
      toast('No se pudo crear el equipo: ' + e.message, 'error');
      guardando = false;
    }
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
