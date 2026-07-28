/* ============================================================
   partido.js — /partidos/:matchId · el partido de principio a fin.
   Marcador, estado, las cinco valoraciones de 1 a 5, las claves y
   la foto del acta. Es la otra mitad del calendario del entrenador:
   entrenamos (sesiones) y competimos (partidos).
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { confirmar } from '../ui/modal.js';
import { puntoEquipo, estrellas } from '../ui/components.js';
import { getMisEquipos } from '../data/teams.js';
import {
  getPartido, actualizarPartido, borrarPartido, subirActa, urlActa, borrarActa,
} from '../data/matches.js';
import {
  EJES_VALORACION, ESTADOS_PARTIDO, VALORACION_MAX,
  resultadoPartido, diferencia, mediaValoracion, validaPartido,
} from '../data/partidos.js';
import { WEEKDAYS } from '../config.js';
import { router } from '../main.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const isoWeekday = (iso) => { const d = new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay(); return d === 0 ? 7 : d; };
const hhmm = (t) => (t ? t.slice(0, 5) : '');

const RESULTADO_TXT = { victoria: 'Victoria', derrota: 'Derrota', empate: 'Empate' };

export function render(root, params) {
  const matchId = params.matchId;
  const cont = h('div', { class: 'eq-page eq-partido' });
  mount(root, cont);

  let p = null, color = 'var(--muted)', nombreEquipo = '—';
  // el estado tal y como está EN LA BASE DE DATOS. `p.estado` es el del chip,
  // que el usuario cambia sin guardar; las policies de 016 miran este.
  let estadoBD = null;
  let sucio = false;
  const marcaSucio = () => { sucio = true; };
  const nodoMarcador = h('div', { class: 'eq-marcador' });

  const onBeforeUnload = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  const salir = (destino) => {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir y descartarlos?')) return false;
    sucio = false; router.navigate(destino); return true;
  };

  // ── marcador (se re-pinta solo el resultado, no los inputs) ─
  function pintaResultado() {
    const res = resultadoPartido({ ...p, estado: 'jugado' });   // qué diría SI se cierra
    const dif = diferencia(p);
    const oficial = p.estado === 'jugado' ? resultadoPartido(p) : null;
    const marca = nodoMarcador.querySelector('.eq-marcador-res');
    if (!marca) return;
    marca.replaceChildren(
      oficial
        ? h('span', { class: `eq-res eq-res-${oficial}` }, RESULTADO_TXT[oficial])
        : res
          ? h('span', { class: 'eq-ayuda' }, `Sin cerrar · sería ${RESULTADO_TXT[res].toLowerCase()}`)
          : h('span', { class: 'eq-ayuda' }, 'Sin marcador'),
      dif != null ? h('span', { class: 'eq-marcador-dif' }, dif > 0 ? `+${dif}` : String(dif)) : null,
    );
  }

  function seccionMarcador() {
    const campo = (clave, etiqueta) => h('label', { class: 'eq-marcador-campo' },
      h('span', { class: 'eq-marcador-lbl' }, etiqueta),
      h('input', {
        class: 'field-input eq-marcador-num', type: 'number', min: 0, max: 300,
        value: p[clave] ?? '', 'aria-label': etiqueta, inputmode: 'numeric',
        onInput: (e) => {
          const v = e.target.value;
          p[clave] = v === '' ? null : Math.max(0, Math.min(300, Number(v)));
          marcaSucio(); pintaResultado();
        },
      }),
    );
    nodoMarcador.replaceChildren(
      h('div', { class: 'eq-marcador-fila' },
        campo('marcador_favor', nombreEquipo),
        h('span', { class: 'eq-marcador-sep' }, '–'),
        campo('marcador_contra', p.rival),
      ),
      h('div', { class: 'eq-marcador-res' }),
    );
    pintaResultado();
    return nodoMarcador;
  }

  // ── acta ───────────────────────────────────────────────────
  function seccionActa() {
    const zona = h('div', { class: 'eq-acta' });
    const pinta = async () => {
      if (!p.acta_path) {
        zona.replaceChildren(
          h('label', { class: 'btn btn-secondary eq-acta-subir' }, 'Subir acta (foto o PDF)',
            h('input', {
              type: 'file', accept: 'image/jpeg,image/png,image/webp,application/pdf',
              class: 'eq-acta-input',
              onChange: async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const path = await subirActa(p.team_id, file);
                  await actualizarPartido(matchId, { acta_path: path });
                  p.acta_path = path;
                  toast('Acta guardada'); pinta();
                } catch (err) { toast('Error: ' + err.message, 'error'); }
              },
            })),
          h('p', { class: 'eq-ayuda' }, 'Se guarda en privado: solo la ve el cuerpo técnico del equipo.'),
        );
        return;
      }
      let url = null;
      try { url = await urlActa(p.acta_path); } catch { /* enlace temporal fallido */ }
      const esPdf = p.acta_path.endsWith('.pdf');
      zona.replaceChildren(
        url
          ? (esPdf
              ? h('a', { class: 'btn btn-secondary', href: url, target: '_blank', rel: 'noopener' }, 'Ver acta (PDF)')
              : h('a', { href: url, target: '_blank', rel: 'noopener', class: 'eq-acta-thumb' },
                  h('img', { src: url, alt: 'Acta del partido', loading: 'lazy' })))
          : h('p', { class: 'eq-ayuda' }, 'Acta guardada (no se pudo generar el enlace ahora).'),
        h('button', {
          class: 'btn btn-secondary eq-btn-mini eq-btn-peligro', type: 'button',
          onClick: async () => {
            if (!(await confirmar({ titulo: 'Quitar acta', mensaje: 'Se borrará la imagen del acta. ¿Continuar?', textoOk: 'Quitar' }))) return;
            try {
              const path = p.acta_path;
              await actualizarPartido(matchId, { acta_path: null });
              p.acta_path = null;
              await borrarActa(path).catch(() => {});   // la fila ya no la referencia
              toast('Acta quitada'); pinta();
            } catch (err) { toast('Error: ' + err.message, 'error'); }
          },
        }, 'Quitar acta'),
      );
    };
    pinta();
    return zona;
  }

  // ── guardado ───────────────────────────────────────────────
  async function guardar({ volver = false } = {}) {
    const problema = validaPartido(p);
    if (problema) { toast(problema, 'error'); return; }
    try {
      await actualizarPartido(matchId, {
        fecha: p.fecha, hora: p.hora || null, lugar: p.lugar?.trim() || null,
        rival: p.rival.trim(), es_local: p.es_local, estado: p.estado,
        marcador_favor: p.marcador_favor, marcador_contra: p.marcador_contra,
        val_defensa: p.val_defensa, val_ataque: p.val_ataque, val_actitud: p.val_actitud,
        val_acierto: p.val_acierto, val_global: p.val_global,
        claves: p.claves?.trim() || null,
      });
      sucio = false;
      estadoBD = p.estado;             // ya está persistido: el botón puede fiarse
      toast('Partido guardado');
      if (volver) router.navigate(`/sesiones?equipo=${p.team_id}`);
      else pinta();
    } catch (e) { toast('Error al guardar: ' + e.message, 'error'); }
  }

  // ── pintado ────────────────────────────────────────────────
  function pinta() {
    const [, m, d] = p.fecha.split('-').map(Number);
    const fechaTxt = `${WEEKDAYS[isoWeekday(p.fecha) - 1].nombre} ${d} de ${MESES[m - 1]}`;
    const media = mediaValoracion(p);

    mount(cont,
      h('div', { class: 'eq-planner-top' },
        h('a', {
          class: 'eq-volver', href: `/sesiones?equipo=${p.team_id}`,
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); salir(`/sesiones?equipo=${p.team_id}`); },
        }, '‹ Calendario'),
        h('span', { class: `eq-estado-badge eq-part-${p.estado}` }, ESTADOS_PARTIDO[p.estado]),
      ),
      h('div', { class: 'view-hero eq-planner-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, puntoEquipo(color), ' ', nombreEquipo, p.es_local ? ' · local' : ' · visitante'),
          h('h1', { class: 'display view-title' }, p.es_local ? `vs ${p.rival}` : `@ ${p.rival}`),
          h('p', { class: 'view-meta' }, [fechaTxt, hhmm(p.hora), p.lugar].filter(Boolean).join(' · ')),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Marcador'),
        seccionMarcador(),
        h('div', { class: 'eq-part-estado', role: 'radiogroup', 'aria-label': 'Estado del partido' },
          // 016 impide que un partido ya no-programado vuelva a 'programado'
          // (era el camino para borrar el histórico en dos clics). Se apaga
          // aquí para que la regla se vea, en vez de saltar como error crudo
          // de Postgres al guardar.
          ...Object.entries(ESTADOS_PARTIDO).map(([k, txt]) => {
            const vetado = k === 'programado' && estadoBD !== 'programado';
            return h('button', {
              class: 'eq-catchip' + (p.estado === k ? ' sel' : ''), type: 'button',
              role: 'radio', 'aria-checked': String(p.estado === k),
              disabled: vetado || undefined,
              title: vetado ? 'Un partido que ya se jugó o se aplazó no vuelve a «programado»' : undefined,
              onClick: () => { if (vetado) return; p.estado = k; marcaSucio(); pinta(); },
            }, txt);
          }),
        ),
        // se puede corregir después: al crearlo desde el calendario es fácil
        // marcar mal quién juega en casa
        h('div', { class: 'eq-part-estado', role: 'radiogroup', 'aria-label': 'Local o visitante' },
          ...[[true, 'Local'], [false, 'Visitante']].map(([v, txt]) => h('button', {
            class: 'eq-catchip' + (p.es_local === v ? ' sel' : ''), type: 'button',
            role: 'radio', 'aria-checked': String(p.es_local === v),
            onClick: () => { p.es_local = v; marcaSucio(); pinta(); },
          }, txt)),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'Cómo salió'),
          media != null ? h('span', { class: 'eq-ayuda' }, `media ${media.toFixed(1)} / ${VALORACION_MAX}`) : null,
        ),
        h('div', { class: 'eq-ejes' },
          ...EJES_VALORACION.map((e) => h('div', { class: 'eq-eje' },
            h('span', { class: 'eq-eje-lbl' }, e.etiqueta),
            estrellas(p[e.clave], (v) => { p[e.clave] = v; marcaSucio(); }, { max: VALORACION_MAX }),
          )),
        ),
        h('div', { class: 'field-group eq-part-claves' },
          h('label', { class: 'field-label' }, 'Claves del partido'),
          h('textarea', {
            class: 'field-textarea', rows: 3,
            placeholder: 'Lo que te llevas: qué funcionó, qué corregir el lunes.',
            onInput: (e) => { p.claves = e.target.value; marcaSucio(); },
          }, p.claves || ''),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Acta'),
        seccionActa(),
      ),

      h('div', { class: 'eq-planner-barra' },
        h('div', { class: 'eq-planner-barra-sec' },
          // El botón se decide por el estado GUARDADO, no por el chip que el
          // usuario acaba de tocar: la policy de 016 mira la BD, así que un
          // "programado" sin guardar ofrecía un borrado que iba a fracasar.
          estadoBD === 'programado' ? h('button', {
            class: 'btn btn-secondary eq-btn-peligro', type: 'button',
            onClick: async () => {
              if (!(await confirmar({ titulo: 'Eliminar partido', mensaje: `Se eliminará el partido contra ${p.rival}. ¿Continuar?`, textoOk: 'Eliminar' }))) return;
              try {
                // un DELETE rechazado por RLS responde 0 filas y ningún error
                if (!(await borrarPartido(matchId, p.acta_path))) {
                  toast('No se eliminó: el partido ya no está programado', 'error');
                  return;
                }
                sucio = false;
                toast('Partido eliminado'); router.navigate(`/sesiones?equipo=${p.team_id}`);
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Eliminar') : null,
        ),
        h('div', { class: 'eq-planner-barra-sec' },
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => guardar() }, 'Guardar'),
          h('button', {
            class: 'btn btn-primary eq-planner-guardar', type: 'button',
            onClick: () => guardar({ volver: true }),
          }, 'Guardar y volver'),
        ),
      ),
    );
  }

  (async () => {
    try {
      p = await getPartido(matchId);
      estadoBD = p.estado;
      const equipos = await getMisEquipos();
      const eq = equipos.find((t) => t.id === p.team_id);
      color = eq?.color || 'var(--muted)';
      nombreEquipo = eq?.name || 'Nosotros';
      pinta();
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir el partido'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/sesiones', 'data-link': true }, 'Volver al calendario')));
    }
  })();

  return { destroy() { window.removeEventListener('beforeunload', onBeforeUnload); } };
}
