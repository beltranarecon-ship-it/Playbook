/* ============================================================
   perfil.js — /perfil · lo tuyo (Tramo 4.10).

   Tres cosas y ninguna más: cómo te llamas, tu contraseña y los avisos
   de ESTE dispositivo. Un perfil que crece acaba siendo el cajón donde
   se meten los ajustes que no se sabe dónde poner.

   ── LOS AVISOS SON POR DISPOSITIVO ──────────────────────────
   No es una preferencia del usuario: es una suscripción de ESTE
   navegador (4.7). El móvil puede estar suscrito y el portátil no, y
   eso es lo normal, no un fallo. Por eso el botón dice lo que hace en
   este aparato y no «activar avisos» en general.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { getState, setState } from '../store.js';
import { getSession, getProfile, cambiarNombre, cambiarClave, isAdmin } from '/js/auth.js';
import { situacion, suscribir, desuscribir, instalada } from '../data/push.js';
import { router } from '../main.js';

export function render(root) {
  const cont = h('div', { class: 'eq-page eq-perfil' });
  mount(root, cont);

  (async () => {
    const sesion = await getSession();
    if (!sesion) { window.location.replace('/index.html'); return; }

    let perfil = getState().perfil;
    if (!perfil) {
      try { perfil = await getProfile(sesion.user.id); setState({ perfil }); }
      catch { perfil = null; }
    }

    const nodoAvisos = h('div', { class: 'eq-perfil-avisos' });

    /* El estado de los avisos se MIRA cada vez que se pinta: el permiso
       del navegador se puede cambiar desde fuera de la app, y una
       pantalla que se fía de lo que recordaba dice mentiras. */
    async function pintaAvisos() {
      const s = await situacion();
      const boton = (txt, fn, clase = 'btn-primary') => h('button', {
        class: `btn ${clase}`, type: 'button',
        onClick: async () => {
          try { await fn(); await pintaAvisos(); }
          catch (e) { toast('Error: ' + e.message, 'error'); }
        },
      }, txt);

      const cuerpo = {
        suscrito: () => [
          h('p', { class: 'eq-acta-ok' }, 'Los avisos llegan a este dispositivo.'),
          boton('Dejar de recibirlos aquí', desuscribir, 'btn-secondary'),
        ],
        sin_permiso: () => [
          h('p', { class: 'eq-ayuda' },
            'Los avisos te dicen cuándo pasar lista, qué falta por cerrar y cuándo se acaba '
            + 'un bloque. Se pueden quitar en cualquier momento.'),
          boton('Recibir avisos en este dispositivo', () => suscribir()),
        ],
        denegado: () => [h('p', { class: 'eq-acta-descuadre' }, s.porque)],
        no_soportado: () => [h('p', { class: 'eq-ayuda' }, s.porque)],
        sin_claves: () => [h('p', { class: 'eq-ayuda' }, s.porque)],
      }[s.estado] || (() => [h('p', { class: 'eq-ayuda' }, s.porque || '')]);

      mount(nodoAvisos,
        ...cuerpo(),
        // dónde estás mirando esto, que es la mitad de la explicación
        h('p', { class: 'eq-ayuda' },
          instalada() ? 'Estás en la app instalada.' : 'Estás en el navegador.'),
      );
    }
    pintaAvisos();

    const nombre = h('input', {
      class: 'field-input', type: 'text', maxlength: 80,
      value: perfil?.full_name || '', placeholder: 'Tu nombre',
    });
    const clave1 = h('input', { class: 'field-input', type: 'password', autocomplete: 'new-password', placeholder: '••••••••' });
    const clave2 = h('input', { class: 'field-input', type: 'password', autocomplete: 'new-password', placeholder: '••••••••' });

    mount(cont,
      h('div', { class: 'view-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, isAdmin(perfil) ? 'Administrador' : 'Entrenador'),
          h('h1', { class: 'display view-title' }, perfil?.full_name || 'Tu perfil'),
          h('p', { class: 'view-meta' }, sesion.user.email || ''),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Cómo te llamas'),
        h('p', { class: 'eq-ayuda' }, 'Es el nombre que ven los demás entrenadores del club.'),
        h('div', { class: 'eq-perfil-fila' },
          nombre,
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              try {
                const puesto = await cambiarNombre(sesion.user.id, nombre.value);
                setState({ perfil: { ...perfil, full_name: puesto } });
                toast('Nombre guardado');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Guardar'),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Tu contraseña'),
        h('p', { class: 'eq-ayuda' },
          'La eliges tú y no la ve nadie del club, ni siquiera quien administra.'),
        h('div', { class: 'eq-perfil-fila' },
          h('label', { class: 'field-group' }, h('span', { class: 'field-label' }, 'Nueva'), clave1),
          h('label', { class: 'field-group' }, h('span', { class: 'field-label' }, 'Otra vez'), clave2),
          h('button', {
            class: 'btn btn-primary', type: 'button',
            onClick: async () => {
              if (clave1.value.length < 6) { toast('Al menos seis caracteres', 'error'); return; }
              if (clave1.value !== clave2.value) { toast('Las dos no coinciden', 'error'); return; }
              try {
                await cambiarClave(clave1.value);
                clave1.value = ''; clave2.value = '';
                toast('Contraseña cambiada');
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Cambiar'),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Avisos en este dispositivo'),
        nodoAvisos,
      ),

      isAdmin(perfil)
        ? h('section', { class: 'eq-cierre-seccion' },
            h('h2', { class: 'eq-zona-titulo' }, 'Administración'),
            h('button', {
              class: 'btn btn-secondary', type: 'button',
              onClick: () => router.navigate('/admin'),
            }, 'El club: invitaciones, temporadas y equipos'),
          )
        : null,
    );
  })();

  return { destroy() {} };
}
