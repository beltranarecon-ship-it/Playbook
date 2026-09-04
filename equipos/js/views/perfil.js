/* ============================================================
   perfil.js — /perfil · lo tuyo (Tramo 4.10).

   Cuatro cosas y ninguna más: cómo te llamas, tu cara, tu contraseña y
   los avisos de ESTE dispositivo. Un perfil que crece acaba siendo el
   cajón donde se meten los ajustes que no se sabe dónde poner.

   La foto entra por lo mismo que el nombre: es cómo te ven los demás
   entrenadores del club, no un ajuste. Todo lo que no sea eso, fuera.

   ── LOS AVISOS SON POR DISPOSITIVO ──────────────────────────
   No es una preferencia del usuario: es una suscripción de ESTE
   navegador (4.7). El móvil puede estar suscrito y el portátil no, y
   eso es lo normal, no un fallo. Por eso el botón dice lo que hace en
   este aparato y no «activar avisos» en general.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { confirmar } from '../ui/modal.js';
import { avatar } from '../ui/components.js';
import { getState, setState } from '../store.js';
import { getSession, getProfile, cambiarNombre, cambiarClave, isAdmin } from '/js/auth.js';
import { situacion, suscribir, desuscribir, instalada } from '../data/push.js';
import {
  subirFotoPerfil, urlFotoPerfil, borrarFotoPerfil, guardarRutaFoto,
} from '../data/perfil-foto.js';
import { estadoFoto, TIPOS_FOTO } from '../data/perfil-foto-reglas.js';
import { router } from '../main.js';

const AVISO_041 = 'Falta aplicar la migración 041: hasta entonces no se puede guardar la foto. '
  + 'El resto del perfil funciona igual.';

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

    /* ---- la foto (Tramo 1.4, migración 041) -------------------------
       Dos nodos repintables, como los avisos de aquí al lado: la cara
       en la cabecera y sus botones en su sección. */
    const nodoFoto = h('div', { class: 'eq-perfil-foto' });
    const nodoFotoCtrl = h('div', { class: 'eq-perfil-foto-ctrl' });
    let fotoPath = perfil?.foto_path ?? null;
    let sin041 = false;      // se apaga en cuanto la base lo diga una vez
    let subiendo = false;
    const comoTeLlamas = () => perfil?.full_name || sesion.user.email || 'Tu perfil';

    async function pintaFoto() {
      const estado = estadoFoto(perfil, sin041);

      /* La cara: la foto si la hay, y si no las iniciales de siempre.
         `onError` cae al avatar sin ruido: la URL firmada dura una hora
         y un perfil abierto toda la tarde se queda con la imagen rota,
         que es peor que no tenerla. */
      let cara = avatar(comoTeLlamas(), null, 96);
      if (estado === 'lista' && fotoPath) {
        const url = await urlFotoPerfil(fotoPath).catch(() => null);
        if (url) {
          cara = h('img', {
            class: 'eq-perfil-foto-img', src: url, alt: '',
            onError: (e) => e.target.replaceWith(avatar(comoTeLlamas(), null, 96)),
          });
        }
      }
      mount(nodoFoto, cara);

      if (estado === 'sin_perfil') {
        mount(nodoFotoCtrl, h('p', { class: 'eq-ayuda' },
          'No se ha podido leer tu perfil. Vuelve a entrar y lo intentamos otra vez.'));
        return;
      }
      if (estado === 'sin_migracion') {
        mount(nodoFotoCtrl, h('p', { class: 'eq-acta-descuadre' }, AVISO_041));
        return;
      }

      const elegir = h('input', {
        class: 'eq-acta-input', type: 'file',
        accept: Object.keys(TIPOS_FOTO).join(','),
        onChange: (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sube(f); },
      });
      mount(nodoFotoCtrl,
        h('label', { class: 'btn btn-secondary eq-acta-subir' },
          subiendo ? 'Subiendo…' : (fotoPath ? 'Cambiar la foto' : 'Subir una foto'), elegir),
        fotoPath ? h('button', {
          class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: quita,
        }, 'Quitarla') : null,
      );
    }

    /* Se sube al elegir el fichero, no al pulsar un «guardar» que aquí
       no existe. El orden importa: primero el fichero, después la ruta,
       y la foto ANTERIOR solo se borra cuando la nueva ya está escrita.
       Al revés se pierde la que había si algo falla por el camino. */
    async function sube(file) {
      if (subiendo) return;
      subiendo = true; await pintaFoto();
      let nueva = null;
      try {
        nueva = await subirFotoPerfil(sesion.user.id, file);
        const { guardado, sin041: falta } = await guardarRutaFoto(sesion.user.id, nueva);
        if (!guardado) {
          /* En un bucket privado un huérfano no se puede borrar después:
             nadie conoce su nombre. Se recoge ahora o no se recoge. */
          await borrarFotoPerfil(nueva).catch(() => {});
          sin041 = falta; toast(AVISO_041, 'error');
          return;
        }
        const vieja = fotoPath;
        fotoPath = nueva;
        perfil = { ...perfil, foto_path: nueva };
        setState({ perfil });
        if (vieja) await borrarFotoPerfil(vieja).catch(() => {});
        toast('Foto guardada');
      } catch (e) {
        if (nueva) await borrarFotoPerfil(nueva).catch(() => {});
        toast('No se ha podido subir: ' + e.message, 'error');
      } finally {
        subiendo = false; await pintaFoto();
      }
    }

    async function quita() {
      if (!(await confirmar({
        titulo: 'Quitar la foto',
        mensaje: 'Volverán a salir tus iniciales. Puedes subir otra cuando quieras.',
        textoOk: 'Quitar',
      }))) return;
      try {
        // primero la fila, después el fichero: al revés queda apuntando a nada
        const { guardado } = await guardarRutaFoto(sesion.user.id, null);
        if (!guardado) { toast(AVISO_041, 'error'); return; }
        const vieja = fotoPath;
        fotoPath = null;
        perfil = { ...perfil, foto_path: null };
        setState({ perfil });
        await borrarFotoPerfil(vieja).catch(() => {});
        toast('Foto quitada');
      } catch (e) { toast('Error: ' + e.message, 'error'); }
      await pintaFoto();
    }
    pintaFoto();

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
        nodoFoto,
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Tu foto'),
        h('p', { class: 'eq-ayuda' },
          'Solo la ves tú: cada entrenador guarda la suya en su carpeta y nadie entra en la de otro.'),
        nodoFotoCtrl,
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
                perfil = { ...perfil, full_name: puesto };
                setState({ perfil });
                // las iniciales de la cabecera salen del nombre: se repintan
                pintaFoto();
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
