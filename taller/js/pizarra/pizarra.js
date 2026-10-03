/* ============================================================
   pizarra/pizarra.js — la pantalla de la Pizarra (§2.1).

   Monta lo que ya existía suelto —el Lienzo, el Tablero, la línea de
   tiempo— y le pone alrededor lo que le faltaba para poder CREAR un
   ejercicio: el panel de las fichas (§2.3) y la barra de arriba con sus
   herramientas y la ayuda (§2.2).

   Es el único sitio que sabe que existen todas las piezas. Cada una
   sigue sin saber nada de las demás: el Tablero no conoce el panel, y
   el panel no conoce la pista. Aquí se cablean.

   ── LO QUE TODAVÍA NO ESTÁ, Y DÓNDE LLEGA ───────────────────
   El panel derecho tiene de momento la pestaña «Ajustes», y solo con lo
   de la defensa (capa 5). Sus otras pestañas, los paneles
   redimensionables, las zonas y «Traer», deshacer y rehacer: capas 6, 7
   y 10. La canasta, que en el §2.4 vive en «Ajustes del ejercicio», va de
   momento en la barra de arriba.

   Toca el DOM, así que no tiene banco propio. Se prueba en
   dev/pizarra.html y dentro del asistente.
   ============================================================ */

import { h } from '../ui/dom.js';
import { Lienzo } from './lienzo.js';
import { Tablero } from './tablero.js';
import { LineaTiempo } from './linea-tiempo.js';
import { Descripcion } from './paneles/descripcion.js';
import { PanelIzquierdo } from './paneles/izquierda.js';
import { PanelDerecho } from './paneles/derecha.js';
import { modeloAjustes } from './paneles/ajustes-modelo.js';
import { recuento } from './elementos.js';
import { History } from '../history.js';
import { ponerVariantesDelClub, variantesDelClub } from './repertorio.js';
import { claveDeVideo, videoDeLoEscrito, validarVarianteNueva } from './variantes.js';
import { nombreDePlantilla } from './plantillas.js';

/* Los aros se llaman por su número, que es como los ve el entrenador
   sobre la pista (la misma convención que el resto del Taller). */
const NOMBRE_CANASTA = { norte: 'Canasta 1', sur: 'Canasta 2' };

/** Cuánto se queda a la vista un aviso: lo bastante para leer una línea
 *  con calma, y no tanto como para tapar la pista. */
const AVISO_MS = 6000;

/** El HTML de un aviso: el texto escapado, salvo las negritas <b></b> con
 *  las que los avisos resaltan. Lo que venga de los datos —el nombre de una
 *  plantilla de otro entrenador, un dorsal, un mensaje de error— se pinta
 *  como texto. */
export function htmlDeAviso(texto) {
  return String(texto ?? '')
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    .replace(/&lt;(\/?)b&gt;/g, '<$1b>');
}

/** Lo que se espera sin cambios antes de apuntar un punto al que volver
 *  con «deshacer»: arrastrar una ficha son decenas de cambios seguidos, y
 *  deshacer tiene que devolverla a donde estaba, no un píxel atrás. */
const ESPERA_HISTORIAL_MS = 400;

/** Cómo se nombra lo que se va a poner, para la barra de ayuda. */
const queEs = (f) => (f.kind === 'jugador'
  ? `un jugador del ${f.nombre}`
  : ({ balon: 'un balón', cono: 'un cono', escalera: 'una escalera', pelota: 'una pelota de tenis' })[f.kind] || f.nombre);

export class Pizarra {
  /**
   * @param pista    clave de pista
   * @param canasta  el aro al que se ataca, si la pista tiene dos
   * @param onCambio () — algo de la jugada ha cambiado (para autoguardar)
   * @param datos    lo que habla con la base de datos (las variantes del
   *   club y los vídeos, §4.3 y §10.1; las plantillas, §7.8):
   *   { cargarVariantes, crearVariante, cargarVideos, guardarVideo,
   *   borrarVideo, cargarPlantillas, crearPlantilla, borrarPlantilla }.
   *   Sin él, la Pizarra funciona con las variantes de serie, sin vídeos
   *   y sin plantillas.
   */
  constructor({ pista = 'entera', canasta = 'norte', onCambio = null, datos = null } = {}) {
    this.onCambio = null;   // se pone al final: montar no es cambiar nada
    this.datos = datos;
    this.videos = {};
    /* Lo guardado desde aquí antes de que llegue la carga de fondo: no se
       pierde cuando llega. */
    this._videosTocados = new Map();   // clave -> vídeo, o null si se quitó
    this._variantesCreadas = [];
    /* Las colocaciones y fases guardadas del club (§7.8). */
    this.plantillas = [];
    this._plantillasTocadas = new Map();   // id -> plantilla, o null si se quitó
    this._relojAviso = null;
    this._ayudaTablero = '';

    this.lienzo = new Lienzo({ pista });
    this.panel = new PanelIzquierdo({
      onArmar: (f) => this._armar(f),
      onSoltar: (f, ev) => this._soltarDelPanel(f, ev),
      /* Las colocaciones guardadas (§7.8). */
      onGuardarColocacion: (nombre) => this.guardarPlantilla('colocacion', nombre),
      onPonerColocacion: (p, modo) => this.ponerColocacion(p, modo),
      onQuitarPlantilla: (p) => this.quitarPlantilla(p),
    });

    /* Antes que el Tablero: al montarse ya avisa de cambios, y el panel
       tiene que estar para enterarse. */
    this.derecha = new PanelDerecho({
      onDefensa: (parcial) => this.tablero.setDefensa(parcial),
      onParDe: (defensor, atacante) => this.tablero.setParDe(defensor, atacante),
      onReglaDe: (defensor, regla) => this.tablero.setReglaDe(defensor, regla),
      onHaceDe: (defensor, accion) => this.tablero.declararDefensa(defensor, accion ? { accion } : null),
      onDeshacerPuerta: (cono) => this.tablero.deshacerPuerta(cono),
      onDarBalon: (jugador) => { this.tablero.darBalon(jugador); this._cambio(); },
      /* La fila (§7.4.2): girarla no la rehace —conserva a los que
         esperan—; todo lo demás, sí. */
      onFila: (cono, parcial) => {
        if (parcial === null) this.tablero.deshacerFila(cono);
        else if (Object.keys(parcial).length === 1 && 'orientacion' in parcial) this.tablero.orientarFila(cono, parcial.orientacion);
        /* Cómo salen —por rondas, su cadencia— tampoco la rehace (§7.4.2). */
        else if (Object.keys(parcial).length && Object.keys(parcial).every((k) => k === 'rondas' || k === 'cadencia_ms')) this.tablero.ajustarFila(cono, parcial);
        /* Ni sus balones: se dan o se quitan a quien no ha salido (§7.3). */
        else if (Object.keys(parcial).length === 1 && 'balon' in parcial) this.tablero.balonesDeLaFila(cono, parcial.balon);
        else this.tablero.hacerFila(cono, parcial);
        this._cambio();
      },
      /* El trazo pinchado (§4.3, §10.1). */
      onVariante: (tramo, variante) => { if (this.tablero.cambiarVariante(tramo, variante)) this._cambio(); },
      onVideo: (clave, escrito) => this.guardarVideo(clave, escrito),
      onQuitarVideo: (clave) => this.quitarVideo(clave),
      onNuevaVariante: (accion, escrito, tramo) => this.nuevaVariante(accion, escrito, tramo),
    });

    const aros = Object.keys(this.lienzo.vista.pista?.baskets || {});
    this.tablero = new Tablero(this.lienzo, {
      canasta: aros.includes(canasta) ? canasta : (aros[0] || 'norte'),
      onAyuda: (t) => { this._ayudaTablero = t || ''; this._pintarAyuda(); },
      onTramos: () => { this.linea?.refrescar(); this.descripcion?.refrescar(); this._cambio(); },
      onFases: (fases, enCurso, huerfanos) => {
        this.linea?.refrescar();
        this.descripcion?.refrescar();
        if (huerfanos && huerfanos.length) {
          const n = huerfanos.length;
          this.avisar(`<b>${n} tramo${n > 1 ? 's' : ''}</b> de fases posteriores ya no encaja${n > 1 ? 'n' : ''}: su protagonista no está en la pista.`);
        }
        this._cambio();
      },
      onSinSoporte: (a) => this.avisar(`<b>«${a.nombre}»</b> todavía no se puede dibujar en la Pizarra: llega en una capa posterior.`),
      onNoPuede: (a, motivo) => this.avisar(`<b>«${a.nombre}»</b> no se puede: ${motivo}.`),
      onAviso: (html) => this.avisar(html),
      onEscena: (elementos) => { this.panel.recuento(recuento(elementos)); this.descripcion?.refrescar(); this._cambio(); },
      onSeleccion: () => this._refrescarAjustes(),
      onEditando: () => this._refrescarAjustes(),
    });

    /* ---- la barra de arriba (§2.2) ---- */
    this.elAyuda = h('span', { class: 'pz-arriba__ayuda', 'aria-live': 'polite' });
    const boton = (texto, titulo, alHacer) => h('button', {
      class: 'pz-arriba__b', type: 'button', title: titulo, 'aria-label': titulo, onClick: alHacer,
    }, texto);
    /* Deshacer y rehacer (§2.2). */
    this._bDeshacer = boton('↶', 'Deshacer (Ctrl+Z)', () => this.deshacer());
    this._bRehacer = boton('↷', 'Rehacer (Ctrl+Mayús+Z)', () => this.rehacer());
    const herramientas = h('div', { class: 'pz-arriba__herramientas' },
      this._bDeshacer, this._bRehacer,
      h('span', { class: 'pz-arriba__sep' }),
      boton('−', 'Alejar (−)', () => this.lienzo.alejar()),
      boton('+', 'Acercar (+)', () => this.lienzo.acercar()),
      boton('⛶', 'Encajar la pista (0)', () => this.lienzo.encajar()),
      h('span', { class: 'pz-arriba__sep' }),
      boton('▶', 'Ver la jugada desde el principio (Espacio)', () => this.ver()),
      boton('👻', 'Ver u ocultar el fantasma de la fase anterior (G)', () => this.tablero.verFantasma(!this.tablero.fantasma)));
    /* Solo con dos aros hay nada que elegir: en media pista sobra. */
    if (aros.length > 1) {
      const sel = h('select', { 'aria-label': 'Canasta a la que se ataca' },
        ...aros.map((k) => h('option', { value: k, selected: k === this.tablero.canasta }, NOMBRE_CANASTA[k] || k)));
      /* La frase nombra las zonas respecto al aro que se ataca (§9.1). */
      sel.addEventListener('change', () => { this.tablero.setCanasta(sel.value); this.descripcion?.refrescar(); this._cambio(); });
      herramientas.append(h('span', { class: 'pz-arriba__sep' }), h('label', { class: 'pz-arriba__canasta' }, 'Ataca a', sel));
    }

    this.elAviso = h('div', { class: 'pz-aviso', role: 'status' });
    this.elAviso.hidden = true;
    const tiempo = h('div', { class: 'pz-centro__tiempo' });
    this.el = h('div', { class: 'pz-pantalla' },
      h('div', { class: 'pz-arriba' }, herramientas, this.elAyuda),
      h('div', { class: 'pz-cuerpo' },
        this.panel.el,
        h('div', { class: 'pz-centro' }, this.lienzo.el, this.elAviso, tiempo),
        this.derecha.el));
    this.linea = new LineaTiempo(tiempo, this.tablero, {
      /* Las fases guardadas (§7.8). */
      plantillas: () => this.plantillasDe('fase'),
      onGuardarFase: (nombre) => this.guardarPlantilla('fase', nombre),
      onInsertarFase: (p, mapa) => this.insertarFaseGuardada(p, mapa),
      onQuitarPlantilla: (p) => this.quitarPlantilla(p),
    });
    /* Y debajo, lo que pasa en la fase, en palabras (§9.1). */
    this.descripcion = new Descripcion(tiempo, this.tablero);

    /* Con una ficha pulsada en el panel, pinchar la pista la pone. Va por
       delante de todo —dibujar incluido— porque mientras hay una
       pulsada, pinchar la pista significa eso y nada más. */
    this._quitarGesto = this.lienzo.gesto('colocar', (i) => this._atenderColocar(i), { orden: 200 });

    this._onTecla = (ev) => this._atenderTecla(ev);
    this.el.addEventListener('keydown', this._onTecla);
    /* Con el foco en la pista, el Espacio es también el modo mano (para
       desplazarla): el Lienzo lo atiende primero, y solo si al soltarlo no
       ha movido nada era un «reproducir». */
    this.lienzo.onEspacio = () => this._espacioSolo();

    this.tablero.poner([]);
    this.panel.recuento(recuento([]));
    this._montarHistorial();
    this.onCambio = onCambio;
    this.listo = this._cargarVariantesYVideos();
  }

  /* Las variantes del club y los vídeos, de fondo: hasta que llegan, las
     de serie y sin vídeos. Nunca falla (quien los carga no lanza). */
  async _cargarVariantesYVideos() {
    if (!this.datos) return;
    const [variantes, videos, plantillas] = await Promise.all([
      this.datos.cargarVariantes ? this.datos.cargarVariantes().catch(() => null) : null,
      this.datos.cargarVideos ? this.datos.cargarVideos().catch(() => ({})) : {},
      this.datos.cargarPlantillas ? this.datos.cargarPlantillas().catch(() => null) : null,
    ]);
    if (Array.isArray(plantillas)) {
      /* Una fila que no se entiende no rompe la lista, pero se dice. */
      const n = plantillas.descartadas || 0;
      if (n) this.avisar(n === 1 ? 'Una plantilla del club no se ha podido leer y no sale.' : `${n} plantillas del club no se han podido leer y no salen.`);
      const tocadas = this._plantillasTocadas || new Map();
      this.plantillas = [...plantillas.filter((p) => !tocadas.has(p.id)), ...[...tocadas.values()].filter(Boolean)];
      this._pintarPlantillas();
    }
    /* `null` es «no se ha podido saber» (sin red, sin la tabla): se sigue
       con las que hubiera, en vez de quedarse sin ninguna. */
    if (Array.isArray(variantes)) ponerVariantesDelClub([...variantes, ...(this._variantesCreadas || [])]);
    const todos = { ...(videos || {}) };
    for (const [clave, video] of this._videosTocados || []) {
      if (video) todos[clave] = video; else delete todos[clave];
    }
    this.videos = todos;
    this.descripcion?.refrescar();
    this._refrescarAjustes();
  }

  /* ---- plantillas: colocaciones y fases guardadas (§7.8) ----- */

  /** Las de un tipo, para la pista que hay delante: sus sitios son de esa. */
  plantillasDe(tipo) {
    const pista = this.lienzo.vista.pistaKey;
    return (this.plantillas || []).filter((p) => p.tipo === tipo && p.pista === pista);
  }

  _pintarPlantillas() {
    this.panel?.colocaciones?.(this.plantillasDe('colocacion'));
    this.linea?.refrescar();
  }

  /**
   * GUARDA la colocación de ahora o la fase que se edita, con un nombre,
   * para todo el club.
   * @returns la plantilla guardada, o null
   */
  async guardarPlantilla(tipo, nombre) {
    if (this._guardandoPlantilla) return null;
    const n = nombreDePlantilla(nombre);
    const que = tipo === 'fase' ? 'La fase' : 'La colocación';
    if (n.error) { this.avisar(`${que} no se ha guardado: ${n.error}.`); return null; }
    let datos;
    let avisos = [];
    if (tipo === 'fase') {
      const r = this.tablero.plantillaDeFase();
      if (!r.datos.tramos.length) { this.avisar('La fase no se ha guardado: no tiene nada dibujado que se pueda llevar a otra jugada.'); return null; }
      datos = r.datos;
      avisos = r.avisos;
    } else {
      datos = this.tablero.colocacion();
      if (!datos.elementos.length) { this.avisar('La colocación no se ha guardado: no hay ninguna ficha en la pista.'); return null; }
    }
    if (!this.datos?.crearPlantilla) { this.avisar('Aquí no se pueden guardar plantillas.'); return null; }
    let creada;
    this._guardandoPlantilla = true;
    try {
      creada = await this.datos.crearPlantilla({ tipo, nombre: n.nombre, pista: this.lienzo.vista.pistaKey, datos });
    } catch (e) { this.avisar(`${que} no se ha guardado: ${e.message}`); return null; } finally { this._guardandoPlantilla = false; }
    if (!creada) { this.avisar(`${que} no se ha guardado.`); return null; }
    this.plantillas = [...this.plantillas, creada];
    (this._plantillasTocadas ||= new Map()).set(creada.id, creada);
    this._pintarPlantillas();
    this.avisar([`«${creada.nombre}» guardada para todo el club.`, ...avisos].join(' '));
    return creada;
  }

  /** Quita una plantilla del club (solo quien la guardó, o un administrador). */
  async quitarPlantilla(plantilla) {
    if (!plantilla || !this.datos?.borrarPlantilla) { this.avisar('Aquí no se pueden quitar plantillas.'); return false; }
    let borrada;
    try { borrada = await this.datos.borrarPlantilla(plantilla.id); } catch (e) { this.avisar(`«${plantilla.nombre}» no se ha quitado: ${e.message}`); return false; }
    if (borrada === false) { this.avisar(`«${plantilla.nombre}» no se ha quitado: solo puede quitarla quien la guardó, o un administrador.`); return false; }
    this.plantillas = this.plantillas.filter((p) => p.id !== plantilla.id);
    (this._plantillasTocadas ||= new Map()).set(plantilla.id, null);
    this._pintarPlantillas();
    return true;
  }

  /** Pone una colocación guardada: `sustituir` o `anadir`. */
  ponerColocacion(plantilla, modo = 'anadir') {
    const n = this.tablero.ponerColocacion(plantilla.datos, modo);
    if (!n) return false;
    this.panel.recuento(recuento(this.tablero.fichas.elementos));
    this.linea.refrescar();
    this.descripcion.refrescar();
    this._cambio();
    return true;
  }

  /** Inserta una fase guardada con cada papel en su ficha. */
  insertarFaseGuardada(plantilla, mapa) {
    const r = this.tablero.insertarPlantilla(plantilla.datos, mapa);
    if (!r.ok) return false;
    if (r.avisos.length) this.avisar(r.avisos.join(' '));
    this._cambio();
    return true;
  }

  /**
   * PONE EL VÍDEO de una variante (o de una acción), para todo el club
   * (§10.1). Lo escrito se comprueba antes de mandarlo.
   * @returns si se ha guardado
   */
  async guardarVideo(clave, escrito) {
    const { video, error } = videoDeLoEscrito(escrito);
    if (error || !video) { this.avisar(`El vídeo no se ha guardado: ${error || 'pega antes su enlace'}.`); return false; }
    if (!this.datos?.guardarVideo) { this.avisar('Aquí no se pueden guardar vídeos.'); return false; }
    try { await this.datos.guardarVideo(clave, video); } catch (e) { this.avisar(`El vídeo no se ha guardado: ${e.message}`); return false; }
    this._ponerVideo(clave, video);
    this.derecha?.limpiarEscrito?.();
    this._refrescarAjustes();
    this.avisar('Vídeo guardado: sale en todos los ejercicios que usan esta variante.');
    return true;
  }

  /** Quita el vídeo de una variante. */
  async quitarVideo(clave) {
    if (!this.datos?.borrarVideo) { this.avisar('Aquí no se pueden quitar vídeos.'); return false; }
    let borrado;
    try { borrado = await this.datos.borrarVideo(clave); } catch (e) { this.avisar(`El vídeo no se ha quitado: ${e.message}`); return false; }
    /* La base de datos no da error si no deja borrarlo: dice que no ha
       borrado nada. */
    if (borrado === false) { this.avisar('El vídeo no se ha quitado: solo puede quitarlo quien lo puso, o un administrador.'); return false; }
    this._ponerVideo(clave, null);
    this._refrescarAjustes();
    return true;
  }

  /* Apunta un vídeo puesto (o quitado, con null) desde aquí. */
  _ponerVideo(clave, video) {
    const { [clave]: _fuera, ...resto } = this.videos;
    this.videos = video ? { ...resto, [clave]: video } : resto;
    (this._videosTocados ||= new Map()).set(clave, video);
  }

  /**
   * CREA UNA VARIANTE DEL CLUB (§4.3) —y su vídeo, si se ha pegado— y se
   * la pone al trazo desde el que se creó (el pinchado, si no se dice).
   * @returns la variante creada, o null
   */
  async nuevaVariante(accion, escrito, tramo = (this.tablero.tramoEditado || {}).id) {
    /* Un segundo clic mientras se crea no la crea dos veces. */
    if (this._creando) return null;
    const r = validarVarianteNueva({ accion, ...escrito });
    if (!r.ok) { this.avisar(`La variante no se ha creado: ${r.errores.join('; ')}.`); return null; }
    if (!this.datos?.crearVariante) { this.avisar('Aquí no se pueden crear variantes.'); return null; }
    let creada;
    this._creando = true;
    try { creada = (await this.datos.crearVariante(r.variante)) || r.variante; } catch (e) { this.avisar(`La variante no se ha creado: ${e.message}`); return null; } finally { this._creando = false; }
    (this._variantesCreadas ||= []).push(creada);
    ponerVariantesDelClub([...variantesDelClub(), creada]);
    let aviso = `«${creada.nombre}» ya sale en el anillo, para todo el club.`;
    if (r.video) {
      const clave = claveDeVideo(accion, creada.slug);
      try { await this.datos.guardarVideo(clave, r.video); this._ponerVideo(clave, r.video); } catch (e) { aviso += ` Su vídeo no se ha guardado: ${e.message}`; }
    }
    /* Al trazo desde el que se pidió, aunque mientras tanto se haya
       pinchado otro; si ya no está en la fase que se ve, a ninguno. */
    if (tramo) this.tablero.cambiarVariante(tramo, creada.slug);
    this.derecha?.limpiarEscrito?.();
    this.descripcion?.refrescar();
    this._cambio();
    this.avisar(aviso);
    return creada;
  }

  /** Mide y pinta. Hay que llamarla DESPUÉS de meter `el` en el DOM,
   *  por lo mismo que `Lienzo.medir`. */
  medir() {
    this.lienzo.medir();
    this.linea.refrescar();
    this.descripcion.refrescar();
  }

  /** Una escena nueva, sin nada dibujado. */
  poner(elementos) {
    this.tablero.poner(elementos);
    this.panel.recuento(recuento(this.tablero.fichas.elementos));
  }

  /**
   * Reabre una jugada guardada; sin ella, la animación de un ejercicio de
   * antes de la Pizarra, con sus posiciones iniciales (§11.4).
   * @returns { ok, avisos }
   */
  cargar(jugada, { animacion = null } = {}) {
    const r = this.tablero.cargar(jugada, { animacion });
    /* El Tablero adopta la canasta de la jugada: el selector tiene que
       decir lo mismo, o enseñaría un aro y se atacaría el otro. */
    this._sincronizarCanasta();
    this.panel.recuento(recuento(this.tablero.fichas.elementos));
    this.linea.refrescar();
    this.descripcion.refrescar();
    this._refrescarAjustes();
    /* Los avisos de la carga y el de la defensa, JUNTOS: al abrir ya se ha
       dicho lo de la defensa, y el aviso de la carga lo tapaba para
       siempre, porque no se repite mientras no cambie. */
    const papeles = this._mensajePapeles();
    this._noEncajan = papeles.clave;
    const textos = [...r.avisos, papeles.html].filter(Boolean);
    if (textos.length) this.avisar(textos.join(' '));
    /* Lo que se abre es el principio: no se deshace hasta antes de abrirlo. */
    this._montarHistorial();
    return r;
  }

  /** La jugada tal y como se guarda (§11.1). */
  jugada() { return this.tablero.jugada(); }

  /* El selector de la canasta dice lo mismo que el Tablero: al reabrir o
     al deshacer, el Tablero puede haber vuelto a otro aro. */
  _sincronizarCanasta() {
    const sel = this.el.querySelector('.pz-arriba__canasta select');
    if (sel) sel.value = this.tablero.canasta;
  }

  /* ---- deshacer y rehacer (§2.2) ----------------------------- */

  /* El historial guarda FOTOS de la jugada entera y de la fase que se
     veía: volver a una es reabrirla, con las mismas piezas con las que
     se reabre un ejercicio guardado. Empieza con la de ahora. */
  _montarHistorial() {
    clearTimeout(this._relojHistorial);
    this._relojHistorial = null;
    this.historial = new History(() => this._foto(), (f) => this._ponerFoto(f));
    this.historial.onChange = () => this._pintarHistorial();
    this.historial.push();
  }

  _foto() {
    const t = this.tablero;
    return { jugada: JSON.stringify(t.jugada()), fase: (t.fases[t.iFase] || {}).id || null };
  }

  _ponerFoto(foto) {
    const t = this.tablero;
    this._restaurando = true;
    try {
      t.cargar(JSON.parse(foto.jugada));
      if (foto.fase) t.irAFaseId(foto.fase);
      this._sincronizarCanasta();
      this.panel.recuento(recuento(t.fichas.elementos));
      this.linea?.refrescar();
      this.descripcion?.refrescar();
      this._vigilarPapeles();
      this._refrescarAjustes();
      /* La foto, como ha quedado al reabrirla: reabrir sanea y completa
         lo guardado, y comparando con la de antes parecería un cambio. */
      this.historial.stack[this.historial.idx] = this._foto();
    } finally { this._restaurando = false; }
    this.onCambio?.();
  }

  /* Apunta la jugada de ahora, si ha cambiado desde la última apuntada. */
  _apuntar() {
    clearTimeout(this._relojHistorial);
    this._relojHistorial = null;
    if (!this.historial || this._restaurando) return;
    const h0 = this.historial;
    const ultima = h0.stack[h0.idx];
    const ahora = this._foto();
    if (ultima && ultima.jugada === ahora.jugada) { h0.stack[h0.idx] = ahora; this._pintarHistorial(); return; }
    h0.push();
  }

  /** Vuelve a como estaba antes de lo último que se hizo. Con un trazo a
   *  medias, lo que se deshace es ese trazo —como Esc— y no el paso de antes. */
  deshacer() {
    if (!this.historial) return false;
    this._apuntar();   // lo que estuviera a medias cuenta como un paso
    if (this._cancelarLoQueHayEntreManos()) return true;
    if (!this.historial.undo()) { this.avisar('No hay nada que deshacer.'); return false; }
    return true;
  }

  /** Vuelve a hacer lo que se acaba de deshacer. */
  rehacer() {
    if (!this.historial) return false;
    this._apuntar();
    if (this._cancelarLoQueHayEntreManos()) return true;
    if (!this.historial.redo()) { this.avisar('No hay nada que rehacer.'); return false; }
    return true;
  }

  /* Corta los gestos vivos —un arrastre a medias seguiría moviendo fichas
     ya restauradas— y cierra lo abierto. Devuelve si había un trazo a
     medias o una elección en marcha: entonces no se retrocede ningún paso. */
  _cancelarLoQueHayEntreManos() {
    const t = this.tablero;
    const aMedias = t.dibujo.dibujando || t.companero.eligiendo;
    this.lienzo?.cancelarGestos?.();
    t.cerrar();
    return !!aMedias;
  }

  /* Las teclas de la Pizarra (§2.2): deshacer, rehacer, reproducir y el fantasma. */
  _atenderTecla(ev) {
    if (ev.key === 'Escape' && this.panel.armada) { ev.preventDefault(); this.panel.armar(null); return; }
    if (ev.defaultPrevented) return;
    /* Escribiendo en una casilla, las teclas son suyas (también Ctrl+Z). */
    const en = ev.target && ev.target.tagName;
    if (en === 'INPUT' || en === 'TEXTAREA' || en === 'SELECT') return;
    const k = String(ev.key || '').toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (k === 'z' || k === 'y')) {
      ev.preventDefault();
      if (k === 'y' || ev.shiftKey) this.rehacer(); else this.deshacer();
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    /* Espacio reproduce y G enseña u oculta el fantasma (§2.2). Mientras
       se dibuja o se corrige un trazo, no: ahí las teclas son de eso. */
    const t = this.tablero;
    if (t.dibujo.dibujando || t.nodos.editando || t.companero.eligiendo) return;
    /* Mantener la tecla pulsada no repite: una pulsación, una vez. */
    if (ev.key === ' ') { ev.preventDefault(); if (!ev.repeat) this.ver(); }
    else if (k === 'g') { ev.preventDefault(); if (!ev.repeat) t.verFantasma(!t.fantasma); }
  }

  /* El Espacio suelto, sin haber movido la pista, reproduce. */
  _espacioSolo() {
    const t = this.tablero;
    if (t.dibujo.dibujando || t.nodos.editando || t.companero.eligiendo) return;
    this.ver();
  }

  _pintarHistorial() {
    /* Con un cambio por apuntar, ↶ ya vale: deshacer lo apunta antes. */
    if (this._bDeshacer) this._bDeshacer.disabled = !this.historial.canUndo() && !this._relojHistorial;
    if (this._bRehacer) this._bRehacer.disabled = !this.historial.canRedo();
  }

  /** Cuántos hay de cada cosa, para los requisitos del paso 3. */
  recuento() { return recuento(this.tablero.fichas.elementos); }

  /** El ▶ de la barra: la jugada entera si hay varias fases, y si no la única. */
  ver() {
    const t = this.tablero;
    const hecho = t.fases.length > 1 ? t.reproducirJugada() : t.reproducirFase();
    if (!hecho) this.avisar('Todavía no hay nada dibujado que ver.');
  }

  /** Una línea encima de la pista, que se va sola. La ayuda de la barra
   *  nunca es un aviso de error (§2.2): lo que no se ha podido hacer se
   *  dice aquí. */
  avisar(html) {
    clearTimeout(this._relojAviso);
    /* El aviso resalta con <b> y nada más: lo demás —el nombre de una
       plantilla de otro entrenador, un dorsal, un mensaje de error— se
       pinta como texto, no como HTML. */
    this.elAviso.innerHTML = htmlDeAviso(html);
    this.elAviso.hidden = false;
    this._relojAviso = setTimeout(() => { this.elAviso.hidden = true; }, AVISO_MS);
  }

  _cambio() {
    this._vigilarPapeles();
    this._refrescarAjustes();
    /* Un punto al que volver, cuando deje de cambiar (§2.2). */
    if (this.historial && !this._restaurando) {
      clearTimeout(this._relojHistorial);
      this._relojHistorial = setTimeout(() => this._apuntarSiSuelto(), ESPERA_HISTORIAL_MS);
      this._pintarHistorial();
    }
    this.onCambio?.();
  }

  /* Con un dedo o el ratón arrastrando no se apunta: pararse a mitad de un
     arrastre no es el final, y un solo «deshacer» tiene que devolver la
     ficha a donde estaba antes de cogerla. Se espera a que se suelte. */
  _apuntarSiSuelto() {
    if (this.lienzo?.gestoVivo) {
      this._relojHistorial = setTimeout(() => this._apuntarSiSuelto(), ESPERA_HISTORIAL_MS);
      return;
    }
    this._apuntar();
  }

  /* La pestaña «Ajustes», con lo seleccionado ahora. El panel solo se
     rehace si lo que enseña ha cambiado. */
  _refrescarAjustes() {
    if (!this.tablero || !this.derecha) return;
    const t = this.tablero;
    const seleccion = [...t.fichas.seleccion];
    const explicada = seleccion.length === 1 ? t.explicarSeleccion() : null;
    this.derecha.pintar(modeloAjustes({
      seleccion,
      elementos: t.fichas.elementos,
      papeles: t.papelesDeFase(),
      defensa: t.defensa,
      nombreDe: (e) => t.nombreDe(e),
      explicacion: explicada ? explicada.texto : null,
      puertas: t.puertasDeLaFase(),
      porQueNoDarBalon: (id) => t.porQueNoDarBalon(id),
      tramo: t.tramoEditado,
      videos: this.videos,
    }));
  }

  /* Si quien defiende tiene trazos de ataque dibujados —pasa al dar el
     balón a otro equipo cuando ya había cortes—, se dice UNA vez por cada
     cambio de lo que no encaja. No se borra nada: lo decide el entrenador. */
  _vigilarPapeles() {
    if (!this.tablero) return;
    const { clave, html } = this._mensajePapeles();
    if (clave && clave !== this._noEncajan) this.avisar(html);
    this._noEncajan = clave;
  }

  /** Qué hay que decir de la defensa, y la clave para no repetirlo. */
  _mensajePapeles() {
    const malos = this.tablero ? this.tablero.tramosQueNoEncajan() : [];
    const clave = malos.map((m) => m.tramo.id).join(',');
    if (!clave) return { clave, html: null };
    const quienes = [...new Set(malos.map((m) => this.tablero.nombreDe(this.tablero.fichas.elementos.find((e) => e.id === m.tramo.elemento_id))))];
    const varios = quienes.length > 1;
    return {
      clave,
      html: `<b>${quienes.join(', ')}</b> ${varios ? 'defienden y tienen' : 'defiende y tiene'} trazos de ataque dibujados: la defensa no corta ni bota. Bórralos, o cambia quién tiene el balón al empezar.`,
    };
  }

  _pintarAyuda() {
    const f = this.panel.armada;
    this.elAyuda.innerHTML = f
      ? `Pincha en la pista para poner <b>${queEs(f)}</b> · puedes poner varios seguidos · <b>Esc</b> termina`
      : this._ayudaTablero;
  }

  _armar(f) {
    /* Pulsar una ficha cierra lo que hubiera abierto: con el anillo a la
       vista, el siguiente clic en la pista sería a la vez «pon aquí» y
       «dibuja hasta aquí». */
    if (f) { this.tablero.cerrar(); this.tablero.fichas.seleccionar([]); }
    this.lienzo.el.classList.toggle('is-colocando', !!f);
    this._pintarAyuda();
    if (f) this.lienzo.el.focus?.({ preventScroll: true });
  }

  _atenderColocar(intento) {
    const f = this.panel.armada;
    if (!f) return null;
    const poner = (p) => this._poner(f, p);
    return { mover: () => {}, soltar: poner, tocar: poner, abortar: () => {} };
  }

  _soltarDelPanel(f, ev) {
    /* Soltarla fuera del lienzo —otra vez en el panel, en la barra— es
       arrepentirse, y no hay nada que decir. */
    const r = this.lienzo.el.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
    const [x, y] = this.lienzo.vista.pointerNormRaw(ev);
    this._poner(f, { x, y });
    this.lienzo.el.focus?.({ preventScroll: true });
  }

  _poner(f, { x, y }) {
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) { this.avisar('Pon la ficha dentro de la pista.'); return; }
    this.tablero.anadirFicha({ kind: f.kind, equipo: f.equipo }, { x, y });
  }

  destroy() {
    clearTimeout(this._relojAviso);
    clearTimeout(this._relojHistorial);
    this._quitarGesto?.();
    this.el.removeEventListener('keydown', this._onTecla);
    this.linea.destroy();
    this.descripcion.destroy();
    this.tablero.destroy();
    this.lienzo.destroy();
    this.el.remove();
  }
}
