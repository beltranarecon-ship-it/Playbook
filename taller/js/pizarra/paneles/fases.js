/* ============================================================
   pizarra/paneles/fases.js — la pestaña «Fases» del panel derecho
   (§2.4, §6): la fase que se edita, con lo que se le puede hacer y
   sus carriles.

   Antes todo esto vivía apilado bajo la pista, en la línea de tiempo, y
   se comía la pantalla: nombre, antes, después, duplicar, borrar,
   plantillas, ramas y siete carriles. Ahora la línea de tiempo se queda
   en una tira con lo de cada momento (reproducir, las fases y
   «Siguiente fase») y lo demás está aquí:

     · LA CABECERA: de qué fase se trata, cómo se llama y cuánto dura,
       con un menú «⋯» para lo que se hace pocas veces —fases antes y
       después, duplicar, borrar, ramas y plantillas— en vez de nueve
       botoncitos seguidos.
     · UN FORMULARIO, cuando lo que se elige del menú pide algo: un
       nombre, una fase, un «¿seguro?». Sale debajo de la cabecera, con
       su «Cancelar».
     · LOS CARRILES de la fase activa, una barra por ficha, que es donde
       se ve de un golpe quién se mueve, cuándo arranca cada uno y
       cuánto dura la fase. Debajo, en gris y sin poder tocarse, los
       AUTOMÁTICOS: la defensa que se mueve sola (§8.4). Están porque
       ocupan tiempo en la fase y se ven en el proyector; no se arrastran
       porque no los ha dibujado nadie.

   Toca el DOM, así que no tiene banco propio: lo que se puede probar en
   Node —los carriles, las duraciones, los arranques, las marcas de la
   regla— vive en fases.js, que sí lo tiene. Aquí solo queda el pegamento.

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

import { h } from '../../ui/dom.js';
import { carrilesDesde, duracionDeCarril, marcasDeTiempo } from '../fases.js';
import { numeroDe } from '../elementos.js';
import { icono } from '../iconos.js';

/** Cuánto hay que arrastrar para que sea mover y no un clic. */
const UMBRAL_PX = 4;

const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

export class PanelFases {
  /**
   * @param host     dónde se cuelga (el hueco de la pestaña)
   * @param tablero  de quien se lee todo; no se guarda copia de nada
   * @param opciones las fases guardadas (§7.8): { plantillas: () => lista,
   *   onGuardarFase(nombre), onInsertarFase(plantilla, mapa),
   *   onQuitarPlantilla(plantilla) }
   */
  constructor(host, tablero, opciones = {}) {
    this.host = host;
    this.tablero = tablero;
    this.opciones = opciones || {};
    this._plantilla = null;   // la fase guardada elegida para insertar
    /* Qué formulario está abierto: null, 'abrir', 'reunir', 'duplicar',
       'borrar', 'guardar' o 'plantilla'; y de qué fase, porque al ir a
       otra se cierra. */
    this._formulario = null;
    this._deFase = null;
    this._menu = false;
    this._alFuera = (ev) => {
      if (ev.type === 'keydown') { if (ev.key === 'Escape') this._cerrarMenu(true); return; }
      if (ev.target && ev.target.closest && ev.target.closest('.pz-menu')) return;
      this._cerrarMenu(true);
    };
    this.el = h('div', { class: 'pz-fases' });
    this.host.append(this.el);
    this.refrescar();
  }

  /** Vuelve a pintarse desde el estado del Tablero. Se llama en cada
   *  cambio: el panel no guarda nada suyo, y así no puede
   *  desincronizarse de lo que hay dibujado. */
  refrescar() {
    const t = this.tablero;
    /* Con las rondas de las filas (§7.4.2): la fase dura hasta que sale
       el último, y lo de cada ronda se ve en gris. */
    const { tramos, tiempos, rondas } = t.conRondasEn();
    const fase = { ...t.fases[t.iFase], carriles: carrilesDesde(tramos) };
    const id = t.fases[t.iFase] ? t.fases[t.iFase].id : null;
    if (this._formulario && this._deFase !== id) this._formulario = null;
    /* `replaceChildren` convierte un `null` en el texto «null»: lo que no
       hay, no se pasa. */
    this.el.replaceChildren(...[
      this._cabecera(tiempos),
      this._formularioAbierto(),
      this._carriles(fase, tiempos, rondas),
    ].filter(Boolean));
  }

  /* ---- la cabecera ------------------------------------------- */

  _cabecera(tiempos) {
    const t = this.tablero;
    const f = t.fases[t.iFase];
    if (!f) return h('div');
    const nombre = h('input', {
      class: 'pz-fases__nombre', type: 'text', value: f.nombre || '', maxlength: '40',
      placeholder: 'Ponle nombre a la fase', 'aria-label': 'Nombre de la fase',
    });
    nombre.addEventListener('change', () => t.renombrarFase(nombre.value));
    const n = (f.tramos || []).length;
    const datos = [
      tiempos.duracion_ms ? segundos(tiempos.duracion_ms) : 'sin duración',
      n ? `${n} ${n === 1 ? 'trazo' : 'trazos'}` : 'sin dibujar todavía',
    ].join(' · ');
    const cab = h('div', { class: 'pz-fases__cab' },
      h('div', { class: 'pz-fases__fila' },
        h('span', { class: 'pz-fases__num' }, `Fase ${t.numeroEnSuCamino(f.id)}`),
        nombre,
        this._menuDeFase(f)),
      h('p', { class: 'pz-fases__datos' }, datos));
    /* Si esta fase empieza una rama: su nombre (§6.7). */
    if (f.rama_de != null) {
      const rama = h('input', { class: 'pz-fases__nombre', type: 'text', value: f.rama_nombre || '', 'aria-label': 'Nombre de la rama' });
      rama.addEventListener('change', () => { if (!t.renombrarRama(f.id, rama.value)) rama.value = f.rama_nombre || ''; });
      cab.append(h('label', { class: 'pz-fases__rama' }, h('span', null, 'Rama'), rama));
    }
    return cab;
  }

  /* ---- el menú «⋯» ------------------------------------------- */

  _abrirMenu() {
    this._menu = true;
    document.addEventListener('pointerdown', this._alFuera, true);
    document.addEventListener('keydown', this._alFuera, true);
    this.refrescar();
  }

  _cerrarMenu(repintar = false) {
    if (!this._menu) return;
    this._menu = false;
    document.removeEventListener('pointerdown', this._alFuera, true);
    document.removeEventListener('keydown', this._alFuera, true);
    if (repintar) this.refrescar();
  }

  /** Lo que se hace con una fase, con el nombre dicho en palabras. */
  _menuDeFase(f) {
    const t = this.tablero;
    const boton = h('button', {
      class: 'pz-fases__mas' + (this._menu ? ' is-abierto' : ''), type: 'button',
      title: 'Más cosas que hacer con esta fase', 'aria-label': 'Más cosas que hacer con esta fase',
      'aria-haspopup': 'menu', 'aria-expanded': this._menu ? 'true' : 'false',
    }, icono('vertical', { size: 18 }));
    boton.addEventListener('click', () => { if (this._menu) this._cerrarMenu(true); else this._abrirMenu(); });
    const caja = h('div', { class: 'pz-menu' }, boton);
    if (!this._menu) return caja;

    const item = (texto, dibujo, alPulsar, { titulo = '', peligro = false } = {}) => {
      const b = h('button', { class: 'pz-menu__item' + (peligro ? ' is-peligro' : ''), type: 'button', role: 'menuitem', title: titulo || texto },
        icono(dibujo, { size: 16 }), h('span', null, texto));
      b.addEventListener('click', alPulsar);
      return b;
    };
    /* Un formulario se abre solo para esta fase. */
    const abrir = (cual) => () => { this._cerrarMenu(); this._formulario = cual; this._deFase = f.id; this.refrescar(); };
    /* Las acciones directas cierran el menú y quitan cualquier formulario. */
    const directa = (hacer) => () => { this._cerrarMenu(); this._formulario = null; hacer(); this.refrescar(); };

    const deLaFase = [
      item('Insertar una fase antes', 'antes', directa(() => t.insertarFase('antes')), { titulo: 'Mete una fase vacía antes de esta' }),
      item('Insertar una fase después', 'despues', directa(() => t.insertarFase('despues')), { titulo: 'Mete una fase vacía después de esta' }),
    ];
    if (t.iFase > 0) deLaFase.push(item('Duplicar como otra rama…', 'duplicar', abrir('duplicar'), { titulo: 'Copia esta fase como otra manera de seguir desde la anterior (una rama), para cambiarle algo' }));
    if (t.todasLasFases.length > 1) deLaFase.push(item('Borrar la fase…', 'papelera', abrir('borrar'), { titulo: 'Borra esta fase y lo dibujado en ella', peligro: true }));

    /* Las ramas (§6.7): abrir una, reunirla con otra fase, quitarla. */
    const sale = t.siguientesDeFase(f.id);
    const candidatas = !sale.length ? t.candidatasParaReunir() : [];
    const deLasRamas = [item('Abrir una rama…', 'rama', abrir('abrir'), { titulo: 'Abre otra manera de seguir desde esta fase («si le niegan el pase»)' })];
    /* Reunir solo tiene sentido si hay ramas, y desde la última fase de una. */
    if (candidatas.length && t.todasLasFases.some((x) => x.rama_de != null)) {
      deLasRamas.push(item('Reunir con otra fase…', 'reunir', abrir('reunir'), { titulo: 'Esta rama sigue por una fase de otra (§6.7)' }));
    }
    if (f.rama_de != null) {
      deLasRamas.push(item('Quitar la rama', 'cerrar', directa(() => t.quitarRama(f.id)), { titulo: 'Quita esta rama si no tiene nada dibujado', peligro: true }));
    }
    /* Las reuniones a las que llega esta fase se pueden deshacer desde
       cualquiera de las ramas que llegan: esa deja de seguir por ella. */
    for (const x of t.reunionesDeFase(f.id)) {
      deLasRamas.push(item(`Separar de la fase ${t.numeroEnSuCamino(x)}`, 'cerrar', directa(() => t.separarDe(x)), { titulo: 'Esta rama deja de seguir por esa fase' }));
    }

    /* Las fases guardadas (§7.8). */
    const dePlantillas = [];
    if (this.opciones.onGuardarFase && (f.tramos || []).length) {
      dePlantillas.push(item('Guardar como plantilla…', 'guardar', abrir('guardar'), { titulo: 'Guarda lo dibujado en esta fase, con un nombre, para usarlo en otras jugadas' }));
    }
    const guardadas = this.opciones.plantillas ? this.opciones.plantillas() : [];
    if (guardadas.length) dePlantillas.push(item('Insertar una plantilla…', 'mas_fase', abrir('plantilla'), { titulo: 'Inserta una fase guardada' }));

    const grupo = (titulo, items) => (items.length ? [h('p', { class: 'pz-menu__grupo' }, titulo), ...items] : []);
    caja.append(h('div', { class: 'pz-menu__lista', role: 'menu' },
      ...grupo('La fase', deLaFase), ...grupo('Ramas', deLasRamas), ...grupo('Plantillas', dePlantillas)));
    return caja;
  }

  /* ---- los formularios --------------------------------------- */

  _cerrarFormulario() { this._formulario = null; this.refrescar(); }

  /** Los botones de un formulario: «Cancelar» y el que lo hace. */
  _acciones(textoOk, { peligro = false, extra = null } = {}) {
    const cancelar = h('button', { class: 'pz-boton pz-boton--suave', type: 'button' }, 'Cancelar');
    cancelar.addEventListener('click', () => this._cerrarFormulario());
    return h('div', { class: 'pz-fases__acciones' }, extra, cancelar,
      h('button', { class: 'pz-boton ' + (peligro ? 'pz-boton--peligro' : 'pz-boton--primario'), type: 'submit' }, textoOk));
  }

  _tarjeta(titulo, ayuda, ...contenido) {
    return h('section', { class: 'pz-fases__form' }, h('h4', null, titulo), ayuda ? h('p', null, ayuda) : null, ...contenido);
  }

  _formularioAbierto() {
    const t = this.tablero;
    const f = t.fases[t.iFase];
    if (!f || !this._formulario) return null;
    const guardadas = this.opciones.plantillas ? this.opciones.plantillas() : [];
    switch (this._formulario) {
      case 'guardar':
        return this._tarjeta('Guardar como plantilla', 'Se guarda lo dibujado en esta fase, con un nombre, para usarlo en otras jugadas.', this._formGuardarFase());
      case 'plantilla':
        return guardadas.length ? this._tarjeta('Insertar una plantilla', null, this._formPlantilla(guardadas)) : null;
      case 'duplicar':
        return t.iFase > 0 ? this._tarjeta('Duplicar como otra rama', 'Copia esta fase como otra manera de seguir desde la anterior, para cambiarle algo.', this._formDuplicar()) : null;
      case 'borrar': return this._tarjeta('Borrar la fase', null, this._confirmarBorrar(f));
      case 'abrir': return this._tarjeta('Abrir una rama', 'Otra manera de seguir desde esta fase («si le niegan el pase»).', this._formAbrir(t.siguientesDeFase(f.id)));
      case 'reunir': return this._tarjeta('Reunir con otra fase', 'Esta rama sigue por una fase de otra.', this._formReunir(!t.siguientesDeFase(f.id).length ? t.candidatasParaReunir() : []));
      default: return null;
    }
  }

  _confirmarBorrar(f) {
    const t = this.tablero;
    const n = (f.tramos || []).length;
    const form = h('form', { class: 'pz-ramas__form' },
      h('p', null, `¿Borrar la fase ${t.numeroEnSuCamino(f.id)}${n ? ` y ${n === 1 ? 'su trazo' : `sus ${n} trazos`}` : ''}?`),
      this._acciones('Sí, borrarla', { peligro: true }));
    form.addEventListener('submit', (e) => { e.preventDefault(); this._formulario = null; if (!t.borrarFase()) this.refrescar(); });
    return form;
  }

  /* Guardar la fase como plantilla: su nombre. */
  _formGuardarFase() {
    const nombre = h('input', { class: 'pz-ramas__nombre', type: 'text', maxlength: '60', placeholder: 'bloqueo directo', 'aria-label': 'Nombre de la plantilla' });
    const form = h('form', { class: 'pz-ramas__form' }, h('label', { class: 'pz-ramas__campo' }, 'Se llama', nombre), this._acciones('Guardar'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await this.opciones.onGuardarFase(nombre.value)) { this._formulario = null; this.refrescar(); }
    });
    setTimeout(() => nombre.focus?.(), 0);
    return form;
  }

  /* Insertar una fase guardada: cuál, y qué ficha hace cada papel. */
  _formPlantilla(guardadas) {
    const t = this.tablero;
    const elegida = guardadas.find((p) => p.id === this._plantilla) || guardadas[0];
    const cual = h('select', { class: 'pz-ramas__sel', 'aria-label': 'Fase guardada' },
      ...guardadas.map((p) => h('option', { value: p.id, selected: p.id === elegida.id }, p.nombre)));
    cual.addEventListener('change', () => { this._plantilla = cual.value; this.refrescar(); });
    const jugadores = t.fichas.elementos.filter((e) => e.kind === 'jugador');
    const deSerie = t.papelesDe(elegida.datos);
    const papeles = (elegida.datos.papeles || []).map((p) => {
      const sel = h('select', { class: 'pz-ramas__sel', 'aria-label': `Quién hace de ${p.nombre}` },
        h('option', { value: '' }, '— elige —'),
        ...jugadores.map((e) => h('option', { value: e.id, selected: deSerie[p.clave] === e.id }, t.nombreDe(e))));
      return { clave: p.clave, sel, el: h('label', { class: 'pz-ramas__campo' }, `Hace de ${p.nombre}`, sel) };
    });
    const quitar = h('button', { class: 'pz-boton pz-boton--peligro-suave', type: 'button', title: 'La quita de las guardadas del club' }, 'Quitar');
    quitar.addEventListener('click', () => this.opciones.onQuitarPlantilla?.(elegida));
    const form = h('form', { class: 'pz-ramas__form' }, h('label', { class: 'pz-ramas__campo' }, 'Fase guardada', cual), ...papeles.map((p) => p.el),
      this._acciones('Insertar', { extra: quitar }));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const mapa = Object.fromEntries(papeles.map((p) => [p.clave, p.sel.value || null]));
      if (this.opciones.onInsertarFase?.(elegida, mapa)) { this._formulario = null; this.refrescar(); }
    });
    return form;
  }

  /* Duplicar es abrir otra rama con lo mismo: hacen falta sus nombres. */
  _formDuplicar() {
    const t = this.tablero;
    const anterior = t.fases[t.iFase - 1];
    const yaEsCruce = t.siguientesDeFase(anterior.id).length > 1;
    const campo = (texto, ejemplo) => {
      const i = h('input', { class: 'pz-ramas__nombre', type: 'text', placeholder: ejemplo, 'aria-label': texto });
      return { i, el: h('label', { class: 'pz-ramas__campo' }, texto, i) };
    };
    const primera = yaEsCruce ? null : campo('Esta fase', 'si le dejan');
    const nueva = campo('La copia', 'si le niegan');
    const form = h('form', { class: 'pz-ramas__form' }, primera ? primera.el : null, nueva.el, this._acciones('Duplicar'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (t.duplicarFase({ primera: primera ? primera.i.value : '', nueva: nueva.i.value })) { this._formulario = null; this.refrescar(); }
    });
    setTimeout(() => (primera ? primera.i : nueva.i).focus?.(), 0);
    return form;
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
    const primera = yaEsCruce ? null : campo(sale.length ? 'Lo que ya viene' : 'Primera rama', 'si le dejan');
    const nueva = campo(yaEsCruce || sale.length ? 'La rama nueva' : 'Segunda rama', 'si le niegan');
    const form = h('form', { class: 'pz-ramas__form' }, primera ? primera.el : null, nueva.el, this._acciones('Abrir'));
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
    const form = h('form', { class: 'pz-ramas__form' }, h('label', { class: 'pz-ramas__campo' }, 'Sigue por', sel), this._acciones('Reunir'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (t.reunirCon(sel.value)) { this._formulario = null; this.refrescar(); }
    });
    return form;
  }

  /* ---- los carriles ------------------------------------------ */

  _carriles(fase, tiempos, rondas = {}) {
    const t = this.tablero;
    const caja = h('section', { class: 'pz-tiempo__carriles' }, h('h4', { class: 'pz-fases__titulo' }, 'Quién se mueve'));
    if (!fase.carriles.length) {
      caja.append(h('p', { class: 'pz-tiempo__nada' }, 'Nadie se mueve en esta fase todavía. Pincha una ficha y elige qué hace.'));
      return caja;
    }
    const total = Math.max(1, tiempos.duracion_ms);
    const automaticos = t._defensaDeLasFases()[t.iFase] || {};
    const declaradas = t.declaradas();
    let hayManual = false;
    let hayAuto = false;

    /* La regla de tiempo, alineada con las barras de debajo: el mismo
       reparto de columnas, con las cifras donde van las barras. */
    const { paso_ms: paso, marcas } = marcasDeTiempo(total);
    caja.style.setProperty('--paso', `${(paso / total) * 100}%`);
    const regla = h('div', { class: 'pz-carril pz-carril--regla', 'aria-hidden': 'true' },
      h('span', { class: 'pz-carril__quien' }),
      h('div', { class: 'pz-carril__pista' }, ...marcas.map((m) => {
        const marca = h('span', { class: 'pz-regla__marca' }, m.texto);
        marca.style.left = `${(m.ms / total) * 100}%`;
        return marca;
      })),
      h('span', { class: 'pz-carril__dur' }));
    caja.append(regla);

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
          hayAuto = true;
          const copia = h('div', {
            class: 'pz-barra pz-barra--auto is-ronda',
            title: `ronda ${r.ronda + 1} · repite lo del primero de la fila: se cambia cambiando lo suyo`,
          }, tr.accion);
          copia.style.left = `${(m.inicio_ms / total) * 100}%`;
          copia.style.width = `${Math.max(2, (m.duracion_ms / total) * 100)}%`;
          pista.append(copia);
          continue;
        }
        if (tr.manual) hayManual = true;
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
      hayAuto = true;
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

    /* La leyenda, solo con lo que hay en esta fase: tres colores sin
       explicar se adivinan; con una línea, se leen. */
    const leyenda = [['dibujado', 'Dibujado'], hayManual ? ['manual', 'Arranque a mano'] : null, hayAuto ? ['auto', 'Automático'] : null].filter(Boolean);
    if (leyenda.length > 1) {
      caja.append(h('p', { class: 'pz-leyenda' }, ...leyenda.map(([clase, texto]) => h('span', { class: `pz-leyenda__dato pz-leyenda__dato--${clase}` }, texto))));
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

  destroy() {
    this._cerrarMenu();
    this.el.remove();
  }
}
