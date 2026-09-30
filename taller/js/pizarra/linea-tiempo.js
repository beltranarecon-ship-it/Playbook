/* ============================================================
   pizarra/linea-tiempo.js — la tira de abajo (§2.5).

   Dos cosas, y las dos hacen falta para entender una jugada de un
   vistazo:

     · LA TIRA DE FASES, para saber por dónde vas y poder volver a
       cualquiera a corregirla (§6.5);
     · LOS CARRILES de la fase activa, una barra por ficha, que es donde
       se ve de un golpe quién se mueve, cuándo arranca cada uno y
       cuánto dura la fase. Debajo, en gris y sin poder tocarse, los
       AUTOMÁTICOS: la defensa que se mueve sola (§8.4). Están porque
       ocupan tiempo en la fase y se ven en el proyector; no se arrastran
       porque no los ha dibujado nadie.

   Toca el DOM, así que no tiene banco propio: lo que se puede probar en
   Node —los carriles, las duraciones, los arranques— vive en fases.js,
   que sí lo tiene. Aquí solo queda el pegamento.

   ── POR QUÉ LAS BARRAS Y NO UNA LISTA ───────────────────────
   Una lista dice lo mismo, pero en una lista «A1 arranca a 1,2 s» hay
   que leerlo y compararlo a mano con lo que hace A2. En barras se ve.
   Y arrastrar una barra es la única manera de decir «este sale un poco
   antes» sin escribir un número (§2.5).

   ── ARRASTRAR UNA BARRA LA MARCA A MANO ─────────────────────
   El §6.3 lo dice: al mover el arranque, ese tramo deja de
   recalcularse. Si no, el siguiente cambio en la fase lo devolvería a
   su sitio automático y el entrenador vería deshacerse lo que acaba de
   ajustar. Los tramos a mano se ven con un borde distinto, para que se
   sepa cuáles ya no siguen la corriente.
   ============================================================ */

import { h } from '../ui/dom.js';
import { carrilesDesde, duracionDeCarril } from './fases.js';
import { numeroDe } from './elementos.js';

/** Cuánto hay que arrastrar para que sea mover y no un clic. */
const UMBRAL_PX = 4;

const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

export class LineaTiempo {
  /**
   * @param host     dónde se cuelga
   * @param tablero  de quien se lee todo; no se guarda copia de nada
   */
  constructor(host, tablero) {
    this.host = host;
    this.tablero = tablero;
    /* Qué formulario de ramas está abierto: null, 'abrir' o 'reunir'. */
    this._formulario = null;
    this.el = h('div', { class: 'pz-tiempo' });
    this.host.append(this.el);
    this.refrescar();
  }

  /** Vuelve a pintarse desde el estado del Tablero. Se llama en cada
   *  cambio: la línea de tiempo no guarda nada suyo, y así no puede
   *  desincronizarse de lo que hay dibujado. */
  refrescar() {
    const t = this.tablero;
    /* Con las rondas de las filas (§7.4.2): la fase dura hasta que sale
       el último, y lo de cada ronda se ve en gris. */
    const { tramos, tiempos, rondas } = t.conRondasEn();
    const fase = { ...t.fases[t.iFase], carriles: carrilesDesde(tramos) };
    this.el.replaceChildren(
      this._mandos(tiempos),
      this._tira(),
      this._ramas(),
      this._carriles(fase, tiempos, rondas),
    );
  }

  /* ---- los mandos ------------------------------------------- */

  _mandos(tiempos) {
    const t = this.tablero;
    const ver = h('button', {
      class: 'pz-tiempo__mando', type: 'button',
      title: 'Reproducir esta fase',
      disabled: t.tramos.length ? null : '',
    }, '▶');
    ver.addEventListener('click', () => t.reproducirFase());

    /* «Desde el principio» solo tiene sentido con más de una fase: con
       una sola es lo mismo que reproducir, y un botón que hace lo mismo
       que el de al lado solo hace dudar. */
    const todo = h('button', {
      class: 'pz-tiempo__mando', type: 'button',
      title: 'Ver la jugada desde el principio',
      disabled: t.fases.length > 1 ? null : '',
    }, '↺');
    todo.addEventListener('click', () => t.reproducirJugada());

    return h('div', { class: 'pz-tiempo__mandos' },
      ver, todo,
      h('span', { class: 'pz-tiempo__dur' }, tiempos.duracion_ms ? segundos(tiempos.duracion_ms) : '—'));
  }

  /* ---- la tira de fases ------------------------------------- */

  _tira() {
    const t = this.tablero;
    const tira = h('div', { class: 'pz-tiempo__fases' });
    const actual = t.fases[t.iFase] ? t.fases[t.iFase].id : null;
    const enElCamino = new Set(t.fases.map((f) => f.id));
    const boton = (id) => {
      const f = t.faseDeId(id);
      const vacia = !(f.tramos || []).length;
      const b = h('button', {
        class: 'pz-fase'
          + (id === actual ? ' is-activa' : '')
          + (vacia ? ' is-vacia' : '')
          + (id !== actual && enElCamino.has(id) ? ' is-camino' : ''),
        type: 'button',
        /* Una fase vacía que no es la activa es la que se acaba de
           abrir y todavía no tiene nada: se dice, en vez de dejar un
           hueco que parece un fallo. */
        title: vacia ? 'sin dibujar todavía' : `${f.tramos.length} tramos`,
      }, `Fase ${t.numeroEnSuCamino(id)}`);
      b.addEventListener('click', () => { t.irAFaseId(id); });
      return b;
    };
    /* LAS RAMAS (§6.7), EN ÁRBOL (lo decidió el entrenador): tras la fase
       del cruce salen una debajo de otra, cada una con su nombre. Sin
       ramas, es la fila de siempre. */
    const tramo = (r) => {
      const fila = h('div', { class: 'pz-tira__tramo' }, ...r.fases.map(boton));
      if (r.sigueEn) fila.append(h('span', { class: 'pz-tira__sigue', title: 'Esta rama se reúne con otra' }, `→ sigue en la fase ${t.numeroEnSuCamino(r.sigueEn)}`));
      if (!r.ramas.length) return fila;
      return h('div', { class: 'pz-tira__cruce' }, fila,
        h('div', { class: 'pz-tira__ramas' }, ...r.ramas.map((x) => h('div', { class: 'pz-tira__rama' },
          h('span', { class: 'pz-tira__nombre' }, x.nombre || 'rama'), tramo(x)))));
    };
    tira.append(tramo(t.arbolDeFases()));
    const mas = h('button', { class: 'pz-fase pz-fase--mas', type: 'button' }, 'Siguiente fase →');
    mas.disabled = !t.tramos.length;
    mas.addEventListener('click', () => t.siguienteFase());
    tira.append(mas);
    return tira;
  }

  /* ---- las ramas (§6.7) ------------------------------------- */

  /* Lo que se puede hacer con ramas desde la fase que se edita: abrir una,
     reunir la rama con otra fase, cambiarle el nombre o quitarla. */
  _ramas() {
    const t = this.tablero;
    const f = t.fases[t.iFase];
    if (!f) return h('div');
    const sale = t.siguientesDeFase(f.id);
    const caja = h('div', { class: 'pz-ramas' });
    const accion = (texto, titulo, alHacer, clase = '') => {
      const b = h('button', { class: `pz-ramas__b ${clase}`.trim(), type: 'button', title: titulo }, texto);
      b.addEventListener('click', alHacer);
      return b;
    };
    caja.append(accion('⑂ Abrir rama', 'Abre otra manera de seguir desde esta fase («si le niegan el pase»)', () => { this._formulario = this._formulario === 'abrir' ? null : 'abrir'; this.refrescar(); }));
    const candidatas = !sale.length ? t.candidatasParaReunir() : [];
    /* Reunir solo tiene sentido si hay ramas, y desde la última fase de una. */
    if (candidatas.length && t.todasLasFases.some((x) => x.rama_de != null)) {
      caja.append(accion('⤳ Reunir con…', 'Esta rama sigue por una fase de otra (§6.7)', () => { this._formulario = this._formulario === 'reunir' ? null : 'reunir'; this.refrescar(); }));
    }
    /* Si esta fase empieza una rama: su nombre, y quitarla. */
    if (f.rama_de != null) {
      const nombre = h('input', { class: 'pz-ramas__nombre', type: 'text', value: f.rama_nombre || '', 'aria-label': 'Nombre de la rama' });
      nombre.addEventListener('change', () => { if (!t.renombrarRama(f.id, nombre.value)) nombre.value = f.rama_nombre || ''; });
      caja.append(h('label', { class: 'pz-ramas__campo' }, 'Rama:', nombre),
        accion('Quitar la rama', 'Quita esta rama si no tiene nada dibujado', () => t.quitarRama(f.id), 'pz-ramas__b--quitar'));
    }
    /* Las reuniones a las que llega esta fase se pueden deshacer desde
       cualquiera de las ramas que llegan: esa deja de seguir por ella. */
    for (const x of t.reunionesDeFase(f.id)) caja.append(accion(`Separar de la fase ${t.numeroEnSuCamino(x)}`, 'Esta rama deja de seguir por esa fase', () => t.separarDe(x)));

    if (this._formulario === 'abrir') caja.append(this._formAbrir(sale));
    if (this._formulario === 'reunir') caja.append(this._formReunir(candidatas));
    return caja;
  }

  /* Los nombres de las ramas, que son obligatorios (§6.7). Si detrás ya
     había algo, pasa a ser la primera rama y se le pone nombre también. */
  _formAbrir(sale) {
    const t = this.tablero;
    const campo = (texto, ejemplo) => {
      const i = h('input', { class: 'pz-ramas__nombre', type: 'text', placeholder: ejemplo, 'aria-label': texto });
      return { i, el: h('label', { class: 'pz-ramas__campo' }, texto, i) };
    };
    const yaEsCruce = sale.length > 1;
    const primera = yaEsCruce ? null : campo(sale.length ? 'Lo que ya viene:' : 'Primera rama:', 'si le dejan');
    const nueva = campo(yaEsCruce || sale.length ? 'La rama nueva:' : 'Segunda rama:', 'si le niegan');
    const ok = h('button', { class: 'pz-ramas__b pz-ramas__b--si', type: 'submit' }, 'Abrir');
    const form = h('form', { class: 'pz-ramas__form' }, primera ? primera.el : null, nueva.el, ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (t.abrirRama({ primera: primera ? primera.i.value : '', nueva: nueva.i.value })) { this._formulario = null; this.refrescar(); }
    });
    setTimeout(() => (primera ? primera.i : nueva.i).focus?.(), 0);
    return form;
  }

  _formReunir(candidatas) {
    const t = this.tablero;
    const nombreDe = (id) => {
      const rama = t.ramaDe(id);
      return `Fase ${t.numeroEnSuCamino(id)}${rama ? ` · ${rama}` : ''}`;
    };
    const sel = h('select', { class: 'pz-ramas__sel', 'aria-label': 'Fase por la que sigue' },
      ...candidatas.map((id) => h('option', { value: id }, nombreDe(id))));
    const ok = h('button', { class: 'pz-ramas__b pz-ramas__b--si', type: 'submit' }, 'Reunir');
    const form = h('form', { class: 'pz-ramas__form' }, h('label', { class: 'pz-ramas__campo' }, 'Sigue por:', sel), ok);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (t.reunirCon(sel.value)) { this._formulario = null; this.refrescar(); }
    });
    return form;
  }

  /* ---- los carriles ----------------------------------------- */

  _carriles(fase, tiempos, rondas = {}) {
    const t = this.tablero;
    const caja = h('div', { class: 'pz-tiempo__carriles' });
    if (!fase.carriles.length) {
      caja.append(h('p', { class: 'pz-tiempo__nada' }, 'Nadie se mueve en esta fase todavía.'));
      return caja;
    }
    const total = Math.max(1, tiempos.duracion_ms);
    const automaticos = t._defensaDeLasFases()[t.iFase] || {};
    const declaradas = t.declaradas();
    for (const c of fase.carriles) {
      const ficha = t.fichas.elementos.find((e) => e.id === c.elemento);
      const soloRondas = c.tramos.every((tr) => rondas[tr.id]);
      const fila = h('div', { class: 'pz-carril' + (soloRondas ? ' pz-carril--auto' : '') }, this._quien(ficha));
      const pista = h('div', { class: 'pz-carril__pista' });
      for (const tr of c.tramos) {
        const m = tiempos.tramos[tr.id];
        const r = rondas[tr.id];
        if (r) {
          /* LO DE UNA RONDA (§7.4.2) sale de lo del primero de la fila:
             no se dibuja ni se arrastra; se cambia cambiando lo suyo. */
          const copia = h('div', {
            class: 'pz-barra pz-barra--auto is-ronda',
            title: `ronda ${r.ronda + 1} · repite lo del primero de la fila: se cambia cambiando lo suyo`,
          }, tr.accion);
          copia.style.left = `${(m.inicio_ms / total) * 100}%`;
          copia.style.width = `${Math.max(2, (m.duracion_ms / total) * 100)}%`;
          pista.append(copia);
          continue;
        }
        const barra = h('div', {
          class: 'pz-barra' + (tr.manual ? ' is-manual' : ''),
          title: `${tr.accion} · ${segundos(m.duracion_ms)}`
            + (tr.manual ? ' · arranque a mano' : ''),
        }, tr.accion);
        barra.style.left = `${(m.inicio_ms / total) * 100}%`;
        barra.style.width = `${Math.max(2, (m.duracion_ms / total) * 100)}%`;
        this._arrastrable(barra, tr, total);
        pista.append(barra);
      }
      fila.append(pista, h('span', { class: 'pz-carril__dur' }, segundos(duracionDeCarril(c, tiempos))));
      caja.append(fila);
    }
    /* Y los que se mueven solos: toda la fase, en gris y quietos. El que
       hace algo DICHO por el entrenador (§8.5) se ve distinto: sigue sin
       poder arrastrarse, pero no es lo que saldría solo. */
    for (const id of [...new Set([...Object.keys(automaticos), ...Object.keys(declaradas)])]) {
      const ficha = t.fichas.elementos.find((e) => e.id === id);
      const dicha = declaradas[id] || null;
      const accion = dicha ? t._accionDe(dicha.accion) : null;
      const objetivo = dicha && dicha.objetivo_id ? t.fichas.elementos.find((e) => e.id === dicha.objetivo_id) : null;
      const conQuien = objetivo ? ` · ${t.nombreDe(objetivo)}` : '';
      const barra = h('div', {
        class: 'pz-barra pz-barra--auto' + (dicha ? ' is-dicha' : ''),
        title: dicha
          ? `lo has dicho tú (§8.5): ${(accion ? accion.nombre : dicha.accion).toLowerCase()}${objetivo ? ` a ${t.nombreDe(objetivo)}` : ''}`
          : 'la defensa sigue a su par (§8.4): no se dibuja ni se arrastra',
      }, dicha ? `${accion ? accion.nombre : dicha.accion}${conQuien}` : 'defiende');
      barra.style.left = '0%';
      barra.style.width = '100%';
      caja.append(h('div', { class: 'pz-carril pz-carril--auto' },
        h('span', { class: 'pz-carril__quien' }, ficha ? t.nombreDe(ficha) : '—'),
        h('div', { class: 'pz-carril__pista' }, barra),
        h('span', { class: 'pz-carril__dur' }, segundos(total))));
    }
    return caja;
  }

  /* Quién es el de cada carril. Quien espera en una fila no lleva dorsal
     (§7.1): se le ve por su puesto, que es como se le reconoce. */
  _quien(ficha) {
    const t = this.tablero;
    if (ficha && ficha.kind === 'jugador' && ficha.fila_de && !numeroDe(ficha)) {
      return h('span', { class: 'pz-carril__quien', title: t.nombreDe(ficha) }, `${(ficha.puesto ?? 0) + 1}.º`);
    }
    return h('span', { class: 'pz-carril__quien' }, ficha ? t.nombreDe(ficha) : '—');
  }

  /* Arrastrar una barra adelanta o retrasa ese tramo (§2.5), y al
     hacerlo queda marcado como «a mano» (§6.3). Se mide sobre el ancho
     de la pista de carriles y no sobre la barra: el porcentaje que se
     mueve tiene que ser el mismo mire donde mire el ratón. */
  _arrastrable(barra, tramo, total) {
    barra.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const pista = barra.parentElement;
      const ancho = pista.getBoundingClientRect().width || 1;
      const x0 = ev.clientX;
      const inicio0 = (parseFloat(barra.style.left) / 100) * total;
      let movido = false;
      /* Capturar el puntero puede lanzar si ya no está activo —uno
         sintético, o uno que se soltó entre el `down` y esta línea—, y
         al lanzar se lleva por delante el resto del manejador: el
         arrastre no llegaba ni a empezar. Es el mismo cuidado que ya
         tiene el Lienzo. */
      try { barra.setPointerCapture(ev.pointerId); } catch { /* puntero que ya no está */ }

      const mover = (e) => {
        const dx = e.clientX - x0;
        if (!movido && Math.abs(dx) < UMBRAL_PX) return;
        movido = true;
        const ms = Math.max(0, Math.round(inicio0 + (dx / ancho) * total));
        barra.style.left = `${(ms / total) * 100}%`;
        barra.dataset.ms = String(ms);
      };
      const soltar = () => {
        barra.removeEventListener('pointermove', mover);
        barra.removeEventListener('pointerup', soltar);
        barra.removeEventListener('pointercancel', soltar);
        if (!movido) return;
        this.tablero.moverArranque(tramo.id, Number(barra.dataset.ms || 0));
      };
      barra.addEventListener('pointermove', mover);
      barra.addEventListener('pointerup', soltar);
      barra.addEventListener('pointercancel', soltar);
    });
  }

  destroy() { this.el.remove(); }
}
