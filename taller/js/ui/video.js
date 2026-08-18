/* ============================================================
   ui/video.js — enseñar el vídeo de una acción (Tramo 2.14).

   La parte con pantalla. La que sabe de URLs y de tramos es
   `ia/video.js`, que es pura y la prueba un banco Node; aquí solo se
   monta lo que se ve y se cuenta el tiempo para volver.

   ── LO QUE TIENE QUE PASAR EN EL PABELLÓN ───────────────────
   La animación va sola en la pared. Llega la fase de «entra», se
   para, salen los siete segundos del doble ritmo, y la animación
   sigue. Sin tocar nada, porque quien proyecta tiene un balón en la
   mano y doce críos delante.

   ── EL TIEMPO SE CUENTA, NO SE PREGUNTA ─────────────────────
   YouTube avisa de que un vídeo ha terminado solo si se carga SU
   librería, que es una llamada a un tercero desde la pantalla del
   pabellón. No se carga. En su lugar se cuenta `hasta - desde`, que
   es un dato que ya tenemos y es exacto.

   Y si no hay `hasta` —el vídeo entero— no se cuenta nada: se queda
   abierto con un botón de «seguir». Es la diferencia entre no saber y
   fingir que se sabe.
   ============================================================ */

import { h } from './dom.js';
import { urlIncrustado, urlPublica, textoTramo, duracionMs, seIncrusta } from '../ia/video.js';

/**
 * Abre el vídeo encima de lo que haya.
 *
 * @param video       {tipo:'youtube'|'tiktok', …} ya saneado
 * @param opts.titulo nombre de la acción, para saber de qué es
 * @param opts.host   dónde colgarlo. En el proyector TIENE que ser el
 *   elemento en pantalla completa: lo que cuelga del body queda DEBAJO
 *   de la pantalla completa y no se ve.
 * @param opts.alCerrar (motivo) — 'fin' si se agotó el tramo, 'manual'
 *   si lo cerró alguien. Es donde el proyector vuelve a darle al play.
 * @returns { el, cerrar }
 */
export function abrirVideo(video, { titulo = '', host = document.body, alCerrar = null } = {}) {
  let cerrado = false;
  let reloj = null;

  const tramo = textoTramo(video);
  const espera = duracionMs(video);

  const cuerpo = seIncrusta(video)
    ? h('iframe', {
      class: 'video-frame', src: urlIncrustado(video),
      title: titulo ? `Vídeo de ${titulo}` : 'Vídeo de referencia',
      allow: 'autoplay; encrypted-media; picture-in-picture',
      // el iframe es de un tercero: se le deja lo justo para reproducir
      sandbox: 'allow-scripts allow-same-origin allow-presentation',
      referrerpolicy: 'strict-origin-when-cross-origin',
      allowfullscreen: 'true', frameborder: '0',
    })
    /* TikTok no admite tramo ni mando a distancia (§12.36): se abre
       aparte, en otra pestaña, y la proyección no se toca. */
    : h('div', { class: 'video-enlace' },
      h('p', null, 'TikTok no deja empezar en un segundo concreto ni volver solo, así que se abre aparte.'),
      h('a', {
        class: 'btn btn--primary', href: urlPublica(video) || '#',
        target: '_blank', rel: 'noopener noreferrer',
      }, 'Abrir el vídeo'),
    );

  const el = h('div', { class: 'video-capa', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo ? `Vídeo de ${titulo}` : 'Vídeo de referencia' },
    h('div', { class: 'video-caja' },
      h('div', { class: 'video-cab' },
        h('div', { class: 'video-tit' },
          h('strong', null, titulo || 'Vídeo'),
          tramo ? h('small', null, tramo) : null,
        ),
        h('button', {
          class: 'btn btn--primary btn--sm', type: 'button',
          onClick: () => cerrar('manual'),
        }, espera ? 'Seguir ahora' : 'Seguir'),
      ),
      cuerpo,
    ),
  );

  // Un clic fuera de la caja también sigue: en el pabellón se toca la
  // pared de la pantalla, no un botón concreto.
  el.addEventListener('click', (ev) => { if (ev.target === el) cerrar('manual'); });

  const onKey = (ev) => {
    if (ev.key !== 'Escape' && ev.key !== ' ') return;
    ev.preventDefault();
    ev.stopPropagation();
    cerrar('manual');
  };
  // en captura: el proyector también escucha Espacio y Escape, y mientras
  // el vídeo está delante manda el vídeo
  document.addEventListener('keydown', onKey, true);

  function cerrar(motivo = 'manual') {
    if (cerrado) return;
    cerrado = true;
    clearTimeout(reloj);
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    alCerrar?.(motivo);
  }

  (host || document.body).append(el);
  if (espera) reloj = setTimeout(() => cerrar('fin'), espera);

  return { el, cerrar };
}

/**
 * El chip de «esta acción tiene vídeo», para la ficha y el paso 2.
 * Abre el vídeo en una capa; no para ninguna animación, porque aquí
 * nadie está proyectando.
 */
export function chipVideo(accion, { host = document.body } = {}) {
  if (!accion?.video) return null;
  const tramo = textoTramo(accion.video);
  return h('button', {
    class: 'chip chip--video', type: 'button',
    title: tramo ? `${accion.nombre} · ${tramo}` : accion.nombre,
    onClick: () => abrirVideo(accion.video, { titulo: accion.nombre, host }),
  }, '▶ ', accion.nombre, tramo ? h('small', null, ` ${tramo}`) : null);
}
