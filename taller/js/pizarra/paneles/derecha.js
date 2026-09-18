/* ============================================================
   pizarra/paneles/derecha.js — el panel derecho (§2.4), hoy con una
   sola pestaña, «Ajustes», y solo con lo de la defensa (§8). Las de
   «Fases» y «Texto» llegan en sus capas.

   Toca el DOM, así que no tiene banco propio: QUÉ se enseña lo decide
   ajustes-modelo.js, que sí lo tiene. Aquí solo se pinta, y se pinta
   solo cuando cambia: se pregunta en cada movimiento de la pista, y
   rehacer un formulario en cada fotograma se come el foco de un número
   a medio escribir.

   Se pliega a una tira estrecha; por debajo de 1100 px empieza plegado
   (§2.6).
   ============================================================ */

import { h, mount } from '../../ui/dom.js';

const ANCHO_PLEGADO_BAJO = 1100;

export class PanelDerecho {
  /**
   * @param onDefensa  (parcial) — cambiar los ajustes del ejercicio
   * @param onParDe    (defensor, atacante|null)
   * @param onReglaDe  (defensor, regla|null)
   * @param onHaceDe   (defensor, accion|null) — lo que hace distinto en
   *                   esta fase (§8.5); `null` es defender a su par
   */
  constructor({ onDefensa = null, onParDe = null, onReglaDe = null, onHaceDe = null } = {}) {
    this.onDefensa = onDefensa;
    this.onParDe = onParDe;
    this.onReglaDe = onReglaDe;
    this.onHaceDe = onHaceDe;
    this._clave = null;
    this._modelo = null;

    this._cuerpo = h('div', { class: 'pz-der__cuerpo' });
    this._boton = h('button', {
      class: 'pz-der__plegar', type: 'button', title: 'Plegar el panel', 'aria-label': 'Plegar el panel',
      onClick: () => this.plegar(!this.plegado),
    }, '›');
    this.el = h('aside', { class: 'pz-der', 'aria-label': 'Ajustes' },
      h('div', { class: 'pz-der__cabecera' },
        h('span', { class: 'pz-der__pestana', role: 'tab', 'aria-selected': 'true' }, 'Ajustes'),
        this._boton),
      this._cuerpo);
    const ancho = typeof window !== 'undefined' ? window.innerWidth : 0;
    this.plegar(ancho > 0 && ancho < ANCHO_PLEGADO_BAJO);
  }

  plegar(on) {
    this.plegado = !!on;
    this.el.classList.toggle('is-plegado', this.plegado);
    this._boton.textContent = this.plegado ? '‹' : '›';
    this._boton.title = this.plegado ? 'Abrir los ajustes' : 'Plegar el panel';
    this._boton.setAttribute('aria-label', this._boton.title);
    this._boton.setAttribute('aria-expanded', this.plegado ? 'false' : 'true');
  }

  /**
   * Pinta un modelo de ajustes-modelo.js, si ha cambiado.
   *
   * Rehacer el formulario se lleva por delante lo que el entrenador tenía
   * a medias: el bloque de números abierto y el control donde estaba
   * escribiendo. Los dos se reponen, porque casi todos los repintados los
   * dispara el propio panel al cambiar algo.
   */
  pintar(modelo) {
    const clave = JSON.stringify(modelo);
    if (clave === this._clave) return;
    this._clave = clave;
    this._modelo = modelo;
    const abierto = !!this._cuerpo.querySelector('details[open]');
    const foco = document.activeElement;
    const etiqueta = foco && this._cuerpo.contains(foco) ? foco.getAttribute('aria-label') : null;
    mount(this._cuerpo, ...this._contenido(modelo));
    const det = this._cuerpo.querySelector('details');
    if (abierto && det) det.open = true;
    if (etiqueta) this._cuerpo.querySelector(`[aria-label="${etiqueta}"]`)?.focus?.();
  }

  _contenido(m) {
    switch (m && m.tipo) {
      case 'ejercicio': return this._ejercicio(m);
      case 'defensor': return this._defensor(m);
      case 'atacante':
        return [h('h4', { class: 'pz-der__titulo' }, m.nombre),
          h('p', { class: 'pz-der__nota' }, m.defensor ? `Le defiende ${m.defensor}. Para cambiarlo, selecciona al defensor o arrastra su línea discontinua.` : 'Nadie le defiende.')];
      case 'sinPapel':
        return [h('h4', { class: 'pz-der__titulo' }, m.nombre), h('p', { class: 'pz-der__nota' }, m.texto)];
      default:
        return [h('p', { class: 'pz-der__nota' }, (m && m.texto) || '')];
    }
  }

  _ejercicio(m) {
    const numeros = h('div', { class: 'pz-der__numeros' },
      ...m.numeros.map((n) => this._numero(n, m)));
    const alguno = m.numeros.some((n) => n.cambiado);
    return [
      h('h4', { class: 'pz-der__titulo' }, 'Defensa del ejercicio'),
      h('p', { class: 'pz-der__nota' }, m.resumen),
      this._campoSelect('Quién ataca', m.ataca, (v) => this.onDefensa?.({ ataca: v })),
      this._campoSelect('Regla', m.preajuste, (v) => this.onDefensa?.({ preajuste: v })),
      this._campoSelect('Situación', m.situacion, (v) => this.onDefensa?.({ situacion: v })),
      h('details', { class: 'pz-der__mas' },
        h('summary', null, 'Números de la defensa'),
        numeros,
        alguno ? h('button', { class: 'pz-der__serie', type: 'button', onClick: () => this.onDefensa?.({ parametros: {} }) }, 'Volver a los de serie') : null),
    ];
  }

  _defensor(m) {
    return [
      h('h4', { class: 'pz-der__titulo' }, `${m.nombre} · defiende`),
      this._campoSelect('Defiende a…', m.par, (v) => this.onParDe?.(m.id, v)),
      this._campoSelect('Regla', m.regla, (v) => this.onReglaDe?.(m.id, v)),
      m.hace ? this._campoSelect('En esta fase', m.hace, (v) => this.onHaceDe?.(m.id, v)) : null,
      m.explicacion ? h('p', { class: 'pz-der__porque' }, m.explicacion) : null,
      h('p', { class: 'pz-der__nota' }, 'También se cambia el par arrastrando su línea discontinua hasta otro atacante. Ayudar y cambiar el par con otro defensor se eligen en el anillo, pinchando a quién.'),
    ];
  }

  _campo(texto, control) {
    return h('label', { class: 'pz-der__campo' }, h('span', null, texto), control);
  }

  /* El campo y su desplegable, con el nombre puesto también en el control:
     es lo que permite devolverle el foco después de repintar. */
  _campoSelect(texto, dato, alCambiar) {
    return this._campo(texto, this._select(dato, alCambiar, texto));
  }

  /* Un desplegable con valores que pueden ser `null`: en el DOM viajan
     como '' y vuelven a ser null al elegir. */
  _select(dato, alCambiar, etiqueta = null) {
    const s = h('select', { 'aria-label': etiqueta }, ...dato.opciones.map((o) => h('option', {
      value: o.valor == null ? '' : o.valor, selected: (o.valor ?? null) === (dato.valor ?? null),
    }, o.nombre)));
    s.addEventListener('change', () => alCambiar(s.value === '' ? null : s.value));
    return s;
  }

  _numero(n, m) {
    const input = h('input', {
      type: 'number', min: '0.1', max: '15', step: '0.05', value: String(n.valor),
      'aria-label': n.nombre, class: n.cambiado ? 'is-cambiado' : null,
    });
    input.addEventListener('change', () => {
      const v = Number(input.value);
      const actuales = Object.fromEntries(m.numeros.filter((x) => x.cambiado).map((x) => [x.clave, x.valor]));
      if (!(Number.isFinite(v) && v > 0)) { input.value = String(n.valor); return; }
      if (v === n.porDefecto) delete actuales[n.clave]; else actuales[n.clave] = v;
      this.onDefensa?.({ parametros: actuales });
    });
    return h('label', { class: 'pz-der__numero' }, h('span', null, n.nombre), h('span', { class: 'pz-der__unidad' }, input, ' m'));
  }
}
