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
import { mismoPanel } from './ajustes-modelo.js';

const ANCHO_PLEGADO_BAJO = 1100;

export class PanelDerecho {
  /**
   * @param onDefensa  (parcial) — cambiar los ajustes del ejercicio
   * @param onParDe    (defensor, atacante|null)
   * @param onReglaDe  (defensor, regla|null)
   * @param onHaceDe   (defensor, accion|null) — lo que hace distinto en
   *                   esta fase (§8.5); `null` es defender a su par
   * @param onDeshacerPuerta (cono) — deshacer la puerta de ese cono (§7.4.1)
   * @param onFila     (cono, parcial|null) — hacer, cambiar o deshacer
   *                   (con null) la fila de un cono (§7.4.2)
   * @param onDarBalon (jugador) — «dale un balón» (§7.3)
   * @param onVariante (tramo, variante) — la variante técnica de un trazo (§4.3)
   * @param onVideo   (clave, { enlace, desde, hasta }) — poner el vídeo de una variante (§10.1)
   * @param onQuitarVideo (clave)
   * @param onNuevaVariante (accion, { nombre, descripcion, enlace, desde, hasta }) (§4.3)
   */
  constructor({
    onDefensa = null, onParDe = null, onReglaDe = null, onHaceDe = null, onDeshacerPuerta = null, onFila = null, onDarBalon = null,
    onVariante = null, onVideo = null, onQuitarVideo = null, onNuevaVariante = null,
  } = {}) {
    this.onVariante = onVariante;
    this.onVideo = onVideo;
    this.onQuitarVideo = onQuitarVideo;
    this.onNuevaVariante = onNuevaVariante;
    this.onDarBalon = onDarBalon;
    this.onDeshacerPuerta = onDeshacerPuerta;
    this.onFila = onFila;
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
    /* Lo abierto y lo escrito a medias solo se reponen si el panel es el
       mismo que había (ajustes-modelo.js#mismoPanel). */
    const mismo = mismoPanel(this._modelo, modelo);
    this._modelo = modelo;
    const abierto = mismo && !!this._cuerpo.querySelector('details[open]');
    const foco = document.activeElement;
    const etiqueta = mismo && foco && this._cuerpo.contains(foco) ? foco.getAttribute('aria-label') : null;
    /* Lo escrito a medias en las casillas de texto (el enlace de un
       vídeo, el nombre de una variante) tampoco se pierde. */
    const escrito = new Map(mismo ? [...this._cuerpo.querySelectorAll('input[type="text"][aria-label], textarea[aria-label]')]
      .filter((x) => x.value).map((x) => [x.getAttribute('aria-label'), x.value]) : []);
    mount(this._cuerpo, ...this._contenido(modelo));
    const det = this._cuerpo.querySelector('details');
    if (abierto && det) det.open = true;
    for (const [k, v] of escrito) {
      const x = this._cuerpo.querySelector(`[aria-label="${k}"]`);
      if (x && !x.value) { x.value = v; x.closest('details')?.setAttribute('open', ''); }
    }
    if (etiqueta) this._cuerpo.querySelector(`[aria-label="${etiqueta}"]`)?.focus?.();
  }

  /** Vacía las casillas de texto: lo escrito ya se ha guardado. */
  limpiarEscrito() {
    for (const x of this._cuerpo.querySelectorAll('input[type="text"], textarea')) x.value = '';
  }

  _contenido(m) {
    switch (m && m.tipo) {
      case 'ejercicio': return this._ejercicio(m);
      case 'defensor': return this._defensor(m);
      case 'cono': {
        /* «el cono 2» va bien dentro de una frase; como título, «Cono 2». */
        const titulo = String(m.nombre || '').replace(/^el /, '');
        return [
          h('h4', { class: 'pz-der__titulo' }, titulo.charAt(0).toUpperCase() + titulo.slice(1)),
          h('p', { class: 'pz-der__nota' }, m.texto),
          m.puerta ? h('button', {
            class: 'pz-der__serie', type: 'button',
            onClick: () => this.onDeshacerPuerta?.(m.id),
          }, 'Deshacer la puerta') : null,
          ...this._fila(m),
        ];
      }
      case 'atacante':
        return [h('h4', { class: 'pz-der__titulo' }, m.nombre),
          h('p', { class: 'pz-der__nota' }, m.defensor ? `Le defiende ${m.defensor}. Para cambiarlo, selecciona al defensor o arrastra su línea discontinua.` : 'Nadie le defiende.'),
          this._darBalon(m)];
      case 'tramo': return this._tramo(m);
      case 'sinPapel':
        return [h('h4', { class: 'pz-der__titulo' }, m.nombre), h('p', { class: 'pz-der__nota' }, m.texto), this._darBalon(m)];
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
      this._darBalon(m),
      h('p', { class: 'pz-der__nota' }, 'También se cambia el par arrastrando su línea discontinua hasta otro atacante. Ayudar y cambiar el par con otro defensor se eligen en el anillo, pinchando a quién.'),
    ];
  }

  /* UN TRAZO PINCHADO: su variante, el vídeo de la variante y «Nueva
     variante» (§4.3, §10.1). Guardar el vídeo y crear la variante
     escriben para todo el club: lo hace quien pinta el panel. */
  _tramo(m) {
    const texto = (etiqueta, ejemplo = '') => h('input', { type: 'text', 'aria-label': etiqueta, placeholder: ejemplo, class: 'pz-der__texto' });
    const partes = [h('h4', { class: 'pz-der__titulo' }, m.titulo)];
    if (m.variante) partes.push(this._campoSelect('Variante', m.variante, (v) => this.onVariante?.(m.id, v)));
    else partes.push(h('p', { class: 'pz-der__nota' }, 'Esta acción no tiene variantes técnicas.'));
    if (m.descripcion) partes.push(h('p', { class: 'pz-der__nota' }, m.descripcion));
    if (m.video) {
      const v = m.video;
      const enlace = texto('Enlace del vídeo', 'https://youtu.be/…');
      const desde = texto('Desde', '0:07');
      const hasta = texto('Hasta', '0:14');
      partes.push(h('div', { class: 'pz-der__video' },
        h('h5', { class: 'pz-der__sub' }, `Vídeo de «${v.de}»`),
        v.actual
          ? h('p', { class: 'pz-der__nota' }, h('a', { href: v.actual.url, target: '_blank', rel: 'noopener noreferrer' }, v.actual.tipo === 'tiktok' ? 'Ver en TikTok' : 'Ver en YouTube'), v.actual.tramo ? ` · ${v.actual.tramo}` : '')
          : h('p', { class: 'pz-der__nota' }, 'Todavía no tiene. Se pone una vez y sale en todos los ejercicios que la usan.'),
        this._campo(v.actual ? 'Cambiarlo' : 'Enlace', enlace),
        h('div', { class: 'pz-der__tramo' }, this._campo('Desde', desde), this._campo('Hasta', hasta)),
        h('div', { class: 'pz-der__botones' },
          h('button', { class: 'pz-der__serie', type: 'button', onClick: () => this.onVideo?.(v.clave, { enlace: enlace.value, desde: desde.value, hasta: hasta.value }) }, 'Guardar el vídeo'),
          v.actual ? h('button', { class: 'pz-der__serie', type: 'button', onClick: () => this.onQuitarVideo?.(v.clave) }, 'Quitar el vídeo') : null)));
    }
    if (m.nuevaVariante) {
      const nombre = texto('Nombre de la variante', 'por detrás');
      const descripcion = h('textarea', { 'aria-label': 'Descripción de la variante', rows: '2', class: 'pz-der__texto', placeholder: 'Cómo se hace, en una línea' });
      const enlace = texto('Enlace del vídeo de la variante', 'https://youtu.be/…');
      const desde = texto('Desde (variante)', '0:07');
      const hasta = texto('Hasta (variante)', '0:14');
      partes.push(h('details', { class: 'pz-der__mas' },
        h('summary', null, 'Nueva variante'),
        h('p', { class: 'pz-der__nota' }, 'Queda en el anillo para todo el club.'),
        this._campo('Nombre', nombre),
        this._campo('Descripción', descripcion),
        this._campo('Vídeo (si quieres)', enlace),
        h('div', { class: 'pz-der__tramo' }, this._campo('Desde', desde), this._campo('Hasta', hasta)),
        h('button', {
          class: 'pz-der__serie', type: 'button',
          onClick: () => this.onNuevaVariante?.(m.accion, { nombre: nombre.value, descripcion: descripcion.value, enlace: enlace.value, desde: desde.value, hasta: hasta.value }, m.id),
        }, 'Crear la variante')));
    }
    return partes;
  }

  /* «Dale un balón» (§7.3): solo sale si se puede dar. */
  _darBalon(m) {
    return m.darBalon
      ? h('button', { class: 'pz-der__serie', type: 'button', onClick: () => this.onDarBalon?.(m.id) }, 'Dale un balón')
      : null;
  }

  /* LA FILA DE UN CONO (§7.4.2): hacerla, sus datos y deshacerla. La
     orientación también se cambia con el tirador de la pista. */
  _fila(m) {
    if (!m.fila) {
      return [h('button', { class: 'pz-der__serie', type: 'button', onClick: () => this.onFila?.(m.id, {}) }, 'Hacer fila')];
    }
    const f = m.fila;
    const cambiar = (clave, traducir = (v) => v) => (v) => this.onFila?.(m.id, { [clave]: traducir(v) });
    return [
      this._campoSelect('Cuántos', f.n, cambiar('n', Number)),
      this._campoSelect('Equipo', f.equipo, cambiar('equipo')),
      this._campoSelect('Papel', f.papel, cambiar('papel')),
      this._campoSelect('Balones', f.balon, cambiar('balon', (v) => v === 'si')),
      this._campoSelect('Orientación', f.orientacion, cambiar('orientacion', Number)),
      this._campoSelect('Vuelve', f.vuelta, cambiar('vuelta')),
      this._campoSelect('Salen', f.rondas, cambiar('rondas', (v) => v === 'si')),
      f.cadencia ? this._campoSelect('Cadencia', f.cadencia, cambiar('cadencia_ms', (v) => (v == null ? null : Number(v)))) : null,
      h('button', { class: 'pz-der__serie', type: 'button', onClick: () => this.onFila?.(m.id, null) }, 'Deshacer la fila'),
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
