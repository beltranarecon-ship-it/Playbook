/* ============================================================
   paso3.js — Metadatos completos (§12).
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { field, chipsSingle, chipsMulti, slider, rangeSlider, spinner, tagInput } from '../ui/components.js';
import { CATEGORIAS, TIPOS_EJERCICIO, TAGS_SUGERIDOS, OBJETIVOS_TEMPORADA, dificultadDe } from '../config.js';
import { sugerirDificultad } from '../ia/client.js';

export function paso3(ctx) {
  const { draft, stage, goTo, onDraftChange } = ctx;

  // requisitos auto desde el canvas (§7.3) si no se editaron a mano
  if (!draft.requisitos_manual) draft.requisitos = stage.board.counts();
  // dificultad sugerida por IA (§12)
  draft.dificultad_sugerida = draft.animacion ? sugerirDificultad(draft.animacion) : null;

  /* ---- Sección A ---- */
  const tipoChips = chipsSingle(TIPOS_EJERCICIO, draft.tipo, (v) => { draft.tipo = v; onDraftChange?.(); });

  const nivelHost = h('div');
  const ramaChips = chipsSingle(['Minibasket', 'Basket'], draft.categoria_rama, (v) => {
    draft.categoria_rama = v; draft.categoria_nivel = [];
    mount(nivelHost, chipsMulti(CATEGORIAS[v], draft.categoria_nivel, (vals) => { draft.categoria_nivel = vals; }));
  });
  if (draft.categoria_rama) mount(nivelHost, chipsMulti(CATEGORIAS[draft.categoria_rama], draft.categoria_nivel, (vals) => { draft.categoria_nivel = vals; }));

  const difLabel = h('span', { class: 'dif-pill' });
  const setDif = (v) => { const d = dificultadDe(v); difLabel.textContent = `${d.label}`; difLabel.className = `dif-pill ${d.clase}`; };
  const difSlider = slider({ min: 1, max: 6, value: draft.dificultad_valor, onInput: (v) => { draft.dificultad_valor = v; setDif(v); }, format: (v) => String(v) });
  setDif(draft.dificultad_valor);
  const difSugerida = draft.dificultad_sugerida
    ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => { draft.dificultad_valor = draft.dificultad_sugerida; difSlider.setValue(draft.dificultad_sugerida); setDif(draft.dificultad_sugerida); } },
        `IA sugiere ${dificultadDe(draft.dificultad_sugerida).label}`)
    : null;

  // Intensidad FÍSICA 1-5 (carga · módulo Sesiones). Distinta de la dificultad técnica.
  const INT_LBL = { 1: 'Muy suave', 2: 'Suave', 3: 'Media', 4: 'Alta', 5: 'Máxima' };
  if (draft.intensidad == null) draft.intensidad = 3;
  const intLabel = h('span', { class: 'dif-pill' }, INT_LBL[draft.intensidad]);
  const intSlider = slider({ min: 1, max: 5, value: draft.intensidad, onInput: (v) => { draft.intensidad = v; intLabel.textContent = INT_LBL[v]; }, format: (v) => String(v) });

  const durSlider = rangeSlider({
    min: 1, max: 60, gap: 0,
    valueMin: draft.duracion_min, valueMax: draft.duracion_max ?? draft.duracion_min,
    onInput: ({ min, max }) => { draft.duracion_min = min; draft.duracion_max = max; },
    format: (a, b) => (a === b ? `${a} min` : `${a}–${b} min`),
  });
  const autor = h('input', { class: 'input', value: draft.autor_nombre, placeholder: 'Tu nombre', onInput: (e) => { draft.autor_nombre = e.target.value; } });
  const tags = tagInput({ value: draft.tags, suggestions: TAGS_SUGERIDOS, onChange: (v) => { draft.tags = v; } });
  const objetivo = h('select', { class: 'select', onChange: (e) => { draft.objetivo_temporada_id = e.target.value || null; } },
    h('option', { value: '' }, 'Sin objetivo de temporada'),
    ...OBJETIVOS_TEMPORADA.map((o) => h('option', { value: o.id }, o.nombre)));

  /* ---- Sección B ---- */
  const ta = (key, ph) => h('textarea', { class: 'textarea', rows: '3', placeholder: ph, value: draft[key], onInput: (e) => { draft[key] = e.target.value; } });

  /* ---- Sección C (requisitos §12) ---- */
  const jSpin = spinner({ min: 2, max: 16, value: draft.requisitos.jugadores || 2, onChange: (v) => { draft.requisitos.jugadores = v; draft.requisitos_manual = true; } });
  const bSpin = spinner({ min: 1, max: 8, value: draft.requisitos.balones || 1, onChange: (v) => { draft.requisitos.balones = v; draft.requisitos_manual = true; } });
  const conoSpin = spinner({ min: 1, max: 20, value: draft.requisitos.conos || 1, onChange: (v) => { draft.requisitos.conos = v; draft.requisitos_manual = true; } });
  conoSpin.style.display = draft.requisitos.conos ? '' : 'none';
  const usaConos = h('input', { type: 'checkbox', checked: draft.requisitos.conos ? true : null,
    onChange: (e) => { draft.requisitos.conos = e.target.checked ? (draft.requisitos.conos || 1) : 0; conoSpin.style.display = e.target.checked ? '' : 'none'; draft.requisitos_manual = true; } });

  const el = h('div', { class: 'flow' },
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Paso 3 · Identificación'),
      field('Tipo de ejercicio', tipoChips),
      field('Categoría', h('div', { class: 'flow' }, ramaChips, nivelHost)),
      field('Dificultad', h('div', { class: 'row row--wrap' }, difSlider, difLabel, difSugerida)),
      field('Intensidad física', h('div', { class: 'row row--wrap' }, intSlider, intLabel)),
      field('Duración estimada', durSlider),
      field('Autor', autor),
      field('Etiquetas', tags),
      field('Objetivo de temporada', objetivo),
    ),
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Descripción táctica'),
      field('Objetivos', ta('objetivos', '¿Qué trabaja este ejercicio?')),
      field('Variantes', ta('variantes', 'Modificaciones posibles del ejercicio base.')),
      field('Notas del entrenador', ta('notas', 'A quién va dirigido, errores frecuentes, cuándo usarlo.')),
    ),
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Requisitos'),
      h('div', { class: 'reqs-grid' },
        h('label', { class: 'field__label' }, 'Nº jugadores', jSpin),
        h('label', { class: 'field__label' }, 'Nº balones', bSpin),
        h('div', { class: 'field' },
          h('label', { class: 'check' }, usaConos, ' ¿Usa conos?'),
          conoSpin,
        ),
        h('div', { class: 'field' },
          h('span', { class: 'field__label' }, 'Tipo de pista'),
          h('p', { class: 'muted mono' }, draft.tipo_pista),
          h('a', { class: 'link', href: '#', onClick: (e) => { e.preventDefault(); goTo(0); } }, 'Cambiar pista'),
        ),
      ),
    ),
  );

  return { el };
}
