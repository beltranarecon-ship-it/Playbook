/* ============================================================
   admin.js — /admin · el panel del administrador (Tramo 4.9).

   §5.10 pide cuatro cosas, y tres ya existían repartidas por la app:
   los equipos (lista), las temporadas (modal, desde el calendario) y
   los periodos sin entrenamiento (ajustes del equipo). Lo que faltaba
   —y lo que es de verdad nuevo— es la LISTA DE INVITACIONES.

   Aquí se juntan las cuatro en una sola pantalla, porque un panel de
   administrador que obliga a acordarse de dónde está cada cosa no es un
   panel: es una lista de enlaces.

   ── LO QUE NO SE HACE AQUÍ (decisión #31) ───────────────────
   Crear contraseñas. El administrador escribe un correo y elige
   equipos; la persona entra por su cuenta y elige su propia clave. Sin
   clave maestra en el navegador y sin manejar contraseñas ajenas.

   ── Y SI NO ERES ADMINISTRADOR ──────────────────────────────
   La pantalla lo dice y no pinta nada. La puerta de verdad está en la
   RLS —la tabla solo la ve un admin— pero enseñar una pantalla vacía
   sin explicar por qué parece una avería.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { confirmar, confirmarEscribiendo } from '../ui/modal.js';
import { getState } from '../store.js';
import { isAdmin } from '/js/auth.js';
import {
  getMisEquipos, borrarEquipo, borrarEquipoConHistorial, queHayEnEquipo,
} from '../data/teams.js';
import {
  getInvitaciones, invitar, retirar, problemaDelCorreo, estadoDe, normaliza,
} from '../data/invitaciones.js';
import { modalTemporada } from './temporada-form.js';
import { router } from '../main.js';

export function render(root) {
  const cont = h('div', { class: 'eq-page eq-admin' });
  mount(root, cont);

  (async () => {
    if (!isAdmin(getState().perfil)) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'Solo para administradores'),
        h('p', {}, 'Esta pantalla gestiona las altas del club. Si crees que deberías verla, '
          + 'pídele a quien lo administre que te cambie el papel.'),
        h('a', { class: 'btn btn-secondary', href: '/inicio', 'data-link': true }, 'Volver al inicio')));
      return;
    }

    let equipos = [], invitaciones = null;
    try {
      [equipos, invitaciones] = await Promise.all([getMisEquipos(), getInvitaciones()]);
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }

    const nodoInv = h('div', { class: 'eq-inv' });

    /* Los equipos, con su borrado. Va aparte porque la lista se repinta
       sola al borrar uno, y porque antes de ofrecer el botón hay que
       preguntar qué historia tiene: un equipo con entrenamientos o
       partidos NO se borra, se archiva. */
    const nodoEquipos = h('div', {});

    /* Los chips de equipo del formulario de invitar. Se declara aquí
       arriba porque los botones de borrar —que están más arriba en la
       pantalla— tienen que poder repintarlos: al borrar un equipo su
       chip se quedaba en el formulario, invitando a asignar gente a algo
       que ya no existe. La función que los pinta se define abajo, con
       `chipEquipo` y la selección, que es de donde salen. */
    const chipsEquipos = h('div', { class: 'eq-catchips' });
    let pintaChipsEquipos = () => {};

    function pintaEquipos() {
      mount(nodoEquipos,
        equipos.length
          ? h('div', { class: 'eq-inv-lista' }, ...equipos.map((t) => h('div', { class: 'eq-inv-fila' },
              h('a', {
                class: 'eq-inv-mail', href: `/equipos/${t.id}`, 'data-link': true,
                onClick: (e) => { e.preventDefault(); router.navigate(`/equipos/${t.id}`); },
              }, t.name),
              h('span', { class: 'eq-ayuda' }, t.category || 'sin categoría'),
              h('span', { class: 'eq-ayuda' }, (t.coaches || []).join(', ') || 'sin entrenadores'),
              h('button', {
                class: 'eq-btn-icono', type: 'button',
                title: `Borrar ${t.name}`, 'aria-label': `Borrar el equipo ${t.name}`,
                onClick: async () => {
                  let dentro;
                  try { dentro = await queHayEnEquipo(t.id); }
                  catch (e) { toast('Error: ' + e.message, 'error'); return; }

                  /* null = no se ha podido contar. No se afirma que esté
                     vacío: se dice que no se sabe. */
                  const noSeSabe = dentro.sesiones === null || dentro.partidos === null;
                  const conHistoria = !!(dentro.sesiones || dentro.partidos);

                  const lleva = [
                    dentro.sesiones && `${dentro.sesiones} entrenamiento${dentro.sesiones === 1 ? '' : 's'}, con su lista y su reflexión`,
                    dentro.partidos && `${dentro.partidos} partido${dentro.partidos === 1 ? '' : 's'}, con su acta y sus estadísticas`,
                    dentro.jugadores && `${dentro.jugadores} jugador${dentro.jugadores === 1 ? '' : 'es'}, con su progresión`,
                    'los horarios, los objetivos y los ajustes del equipo',
                  ].filter(Boolean);

                  /* ── Sin historia: una confirmación basta ──────── */
                  if (!conHistoria && !noSeSabe) {
                    if (!(await confirmar({
                      titulo: `Borrar ${t.name}`,
                      mensaje: `Nunca ha entrenado ni jugado un partido.`
                        + (dentro.jugadores ? ` Se borrarán también sus ${dentro.jugadores} jugador(es), sus horarios y sus objetivos.` : ''),
                      textoOk: 'Borrar',
                    }))) return;
                    try {
                      if (await borrarEquipo(t.id)) {
                        equipos = equipos.filter((x) => x.id !== t.id);
                        pintaEquipos(); pintaChipsEquipos();
                        toast(`${t.name} borrado`);
                        return;
                      }
                      // la policy lo ha rechazado: se sigue por la puerta larga
                    } catch (e) { toast('Error: ' + e.message, 'error'); return; }
                  }

                  /* ── Con historia: dos puertas ─────────────────
                     La primera avisa de lo que hay dentro. La segunda
                     pide escribir el nombre, que es la única
                     confirmación que de verdad frena: un segundo
                     «¿seguro?» se pulsa con la misma inercia que el
                     primero. */
                  if (!(await confirmar({
                    titulo: `Borrar ${t.name} y toda su historia`,
                    mensaje: noSeSabe
                      ? 'No he podido comprobar qué tiene dentro, así que no puedo decirte qué se va a perder. '
                        + 'Se borrará el equipo entero con todo lo que cuelgue de él.'
                      : `${t.name} tiene historial en el club. Esto no se puede deshacer ni hay copia: `
                        + 'lo que se borre no vuelve.',
                    textoOk: 'Sí, quiero borrarlo',
                  }))) return;

                  const escrito = await confirmarEscribiendo({
                    titulo: `Borrar ${t.name} del todo`,
                    nombre: t.name,
                    queSeLleva: noSeSabe ? [] : lleva,
                    aviso: 'No hay papelera ni deshacer.',
                  });
                  if (!escrito) return;

                  try {
                    const r = await borrarEquipoConHistorial(t.id, escrito);
                    equipos = equipos.filter((x) => x.id !== t.id);
                    pintaEquipos(); pintaChipsEquipos();
                    /* El recuento de lo borrado es el único recibo que
                       queda de algo que no tiene vuelta atrás. */
                    toast(`${r.nombre} borrado · ${r.sesiones} entrenamiento(s), `
                      + `${r.partidos} partido(s) y ${r.jugadores} jugador(es)`);
                  } catch (e) { toast(e.message, 'error'); }
                },
              }, '×'),
            )))
          : h('p', { class: 'eq-ayuda' }, 'Todavía no hay equipos.'),
      );
    }
    pintaEquipos();

    /* El formulario de invitar. Los equipos se eligen aquí porque
       asignarlos DESPUÉS obliga a acordarse de una segunda tarea que
       nadie apunta, y la persona entra sin ver nada y cree que la app
       está rota. */
    function pintaInvitaciones() {
      if (invitaciones === null) {
        mount(nodoInv, h('p', { class: 'eq-ayuda' },
          'Para la lista de invitaciones falta aplicar la migración 032 en la base de datos.'));
        return;
      }

      const email = h('input', { class: 'field-input', type: 'email', placeholder: 'entrenador@correo.es', autocomplete: 'off' });
      const nombre = h('input', { class: 'field-input', type: 'text', placeholder: 'Nombre (opcional)' });
      const seleccion = new Set();
      let rol = 'coach';

      const chipEquipo = (t) => h('button', {
        class: 'eq-catchip', type: 'button',
        onClick: (e) => {
          if (seleccion.has(t.id)) seleccion.delete(t.id); else seleccion.add(t.id);
          e.target.classList.toggle('sel', seleccion.has(t.id));
        },
      }, t.name);

      pintaChipsEquipos = () => {
        /* Un equipo borrado no puede seguir seleccionado: la invitación
           saldría con un id que ya no existe. */
        for (const id of [...seleccion]) {
          if (!equipos.some((t) => t.id === id)) seleccion.delete(id);
        }
        mount(chipsEquipos, ...(equipos.length
          ? equipos.map(chipEquipo)
          : [h('p', { class: 'eq-ayuda' }, 'Todavía no hay equipos que asignar.')]));
      };
      pintaChipsEquipos();

      const chipRol = (v, txt) => h('button', {
        class: 'eq-catchip' + (rol === v ? ' sel' : ''), type: 'button',
        onClick: (e) => {
          rol = v;
          e.target.parentElement.querySelectorAll('.eq-catchip').forEach((b) => b.classList.toggle('sel', b === e.target));
        },
      }, txt);

      const alta = h('div', { class: 'eq-inv-alta' },
        h('div', { class: 'eq-inv-campos' },
          h('label', { class: 'field-group' }, h('span', { class: 'field-label' }, 'Correo'), email),
          h('label', { class: 'field-group' }, h('span', { class: 'field-label' }, 'Nombre'), nombre),
        ),
        h('div', { class: 'field-group' },
          h('span', { class: 'field-label' }, 'Papel'),
          h('div', { class: 'eq-catchips' }, chipRol('coach', 'Entrenador'), chipRol('admin', 'Administrador')),
        ),
        h('div', { class: 'field-group' },
          h('span', { class: 'field-label' }, 'Entra en estos equipos'),
          /* En su propio nodo para poder repintarlo: al borrar un equipo
             su chip se quedaba aquí, invitando a asignar gente a algo
             que ya no existe. */
          chipsEquipos,
        ),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onClick: async () => {
            const problema = problemaDelCorreo(email.value, { yaEstan: invitaciones.map((i) => i.email) });
            if (problema) { toast(problema, 'error'); return; }
            try {
              const nueva = await invitar({
                email: email.value, rol, equipos: [...seleccion], nombre: nombre.value,
              });
              invitaciones = [nueva, ...invitaciones];
              pintaInvitaciones();
              toast(`Invitado ${normaliza(nueva.email)}`);
            } catch (e) { toast('Error: ' + e.message, 'error'); }
          },
        }, 'Invitar'),
        h('p', { class: 'eq-ayuda' },
          'No se crea ninguna contraseña: la persona entra con Google o se registra '
          + 'con este correo y elige la suya. Un correo que no esté en esta lista no entra.'),
      );

      const fila = (i) => h('div', { class: 'eq-inv-fila' },
        h('span', { class: 'eq-inv-mail' }, i.email),
        h('span', { class: 'eq-obj-badge' + (estadoDe(i) === 'dentro' ? ' eq-obj-badge-ok' : '') },
          estadoDe(i) === 'dentro' ? 'dentro' : 'pendiente'),
        i.rol === 'admin' ? h('span', { class: 'eq-obj-badge eq-badge-alerta' }, 'administrador') : null,
        h('span', { class: 'eq-ayuda' },
          (i.equipos || []).map((id) => equipos.find((t) => t.id === id)?.name).filter(Boolean).join(', ')
          || 'sin equipos'),
        estadoDe(i) === 'pendiente'
          ? h('button', {
              class: 'eq-btn-icono', type: 'button', title: 'Retirar la invitación',
              onClick: async () => {
                if (!(await confirmar({
                  titulo: 'Retirar invitación',
                  mensaje: `${i.email} dejará de poder darse de alta.`, textoOk: 'Retirar',
                }))) return;
                try {
                  if (!(await retirar(i.id))) { toast('Ya se había usado: no se retira', 'error'); return; }
                  invitaciones = invitaciones.filter((x) => x.id !== i.id);
                  pintaInvitaciones();
                } catch (e) { toast('Error: ' + e.message, 'error'); }
              },
            }, '×')
          /* Al que ya entró no se le retira: tiene cuenta y equipos, y
             quitarle la invitación no le echaría. Daría la falsa
             sensación de haberlo hecho. */
          : h('span', { class: 'eq-ayuda', title: 'Ya tiene cuenta: para quitarle el acceso, sácalo de sus equipos' }, '—'),
      );

      mount(nodoInv,
        alta,
        invitaciones.length
          ? h('div', { class: 'eq-inv-lista' }, ...invitaciones.map(fila))
          : h('p', { class: 'eq-ayuda' }, 'Nadie invitado todavía.'),
      );
    }
    pintaInvitaciones();

    mount(cont,
      h('div', { class: 'view-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, 'Administración'),
          h('h1', { class: 'display view-title' }, 'El club'),
          h('p', { class: 'view-meta' }, `${equipos.length} equipos`),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Quién puede entrar'),
        nodoInv,
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Temporadas'),
        h('p', { class: 'eq-ayuda' },
          'Crear y eliminar temporadas es cosa del administrador. Cada entrenador ve las '
          + 'pasadas solo de sus equipos.'),
        h('button', {
          class: 'btn btn-secondary', type: 'button',
          onClick: () => modalTemporada({ onCambiada: () => toast('Temporadas actualizadas') }),
        }, 'Gestionar temporadas'),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Equipos'),
        nodoEquipos,
        h('p', { class: 'eq-ayuda' },
          'Los periodos sin entrenamiento se definen dentro de cada equipo, en Horarios: '
          + 'dependen de cuándo entrena cada uno.'),
      ),
    );
  })();

  return { destroy() {} };
}
