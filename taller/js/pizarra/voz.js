/* ============================================================
   pizarra/voz.js — la narración (§9.3).

   Al empezar cada fase, en el proyector y en la ficha del ejercicio, la
   voz del navegador (`speechSynthesis`: 0 €, sin conexión) lee lo que
   pasa. Lee SIEMPRE la frase automática (`fase.frase`), no la reescrita,
   para que la narración suene igual en todos los ejercicios.

   LA ANIMACIÓN ESPERA A LA VOZ (lo decidió el entrenador, 2026-09-24):
   una fase dura dos o tres segundos y su frase, bastantes más. Si al
   acabar la fase la frase no ha terminado, el motor se queda quieto
   hasta que termine (`engine.retener`), y entonces sigue. Con la voz
   apagada, todo va como siempre.

   El interruptor y la velocidad van en los controles de reproducción y
   se recuerdan en el navegador. Empieza apagada: una pista que habla
   sola, sin pedirlo, en mitad de un pabellón es peor que una muda.

   Lo prueba en Node taller/tools/eval-voz.mjs, con un motor, una voz y
   un almacén de mentira.
   ============================================================ */

const CLAVE = 'cbp-voz';

/** Las velocidades de la voz que se ofrecen, de la más calmada a la más
 *  rápida. 1 es la del navegador. */
export const VELOCIDADES_VOZ = Object.freeze([0.8, 1, 1.25]);

/** Lo más que la animación espera a una frase: si la voz del navegador
 *  no avisa de que ha terminado —pasa—, no se queda parada para siempre. */
export const ESPERA_MAXIMA_MS = 20000;

/** ¿Hay voz en este navegador? */
export function hayVoz(g = globalThis) {
  return !!(g && g.speechSynthesis && typeof g.SpeechSynthesisUtterance === 'function');
}

/** Lo que se recuerda: si habla y a qué velocidad. */
export function leerPreferencias(almacen = globalThis.localStorage) {
  try {
    const p = JSON.parse((almacen && almacen.getItem(CLAVE)) || 'null');
    return { activa: !!(p && p.activa), velocidad: VELOCIDADES_VOZ.includes(p && p.velocidad) ? p.velocidad : 1 };
  } catch {
    return { activa: false, velocidad: 1 };
  }
}

export function guardarPreferencias(p, almacen = globalThis.localStorage) {
  try { almacen.setItem(CLAVE, JSON.stringify({ activa: !!p.activa, velocidad: p.velocidad })); } catch { /* sin almacén: no se recuerda */ }
}

/** Lo que se lee de una fase: la frase automática, siempre. */
export const fraseParaLeer = (fase) => (fase && typeof fase.frase === 'string' ? fase.frase.trim() : '');

/** ¿Tiene esta animación algo que leer? Las de antes de la Pizarra, no. */
export const tieneFrases = (anim) => ((anim && anim.fases) || []).some((f) => fraseParaLeer(f));

/* Lo que tarda en contarse «el principio de una fase»: darle al play
   justo al empezarla la lee; a mitad, no, que ya ha pasado. */
const AL_EMPEZAR_MS = 80;

/**
 * EL NARRADOR de un motor de reproducción: escucha sus fases y lee.
 *
 *   · al empezar una fase REPRODUCIENDO, lee su frase —también la
 *     primera, que el motor ya había empezado al montarse los mandos—;
 *   · al darle al play al principio de una fase, también;
 *   · mientras lee, la fase no se acaba: el motor espera;
 *   · al pausar, se calla. Arrastrar la barra no habla: pausa el motor.
 *
 * Las preferencias se leen del almacén cada vez: la ficha y el proyector
 * pueden estar vivos a la vez, y lo que se cambie en uno vale en el otro.
 */
export class Narrador {
  /**
   * @param engine   el motor (on/off, playing, k, phaseElapsed, fases, retener)
   * @param g        dónde están speechSynthesis y SpeechSynthesisUtterance
   * @param almacen  dónde se recuerdan las preferencias
   */
  constructor(engine, { g = globalThis, almacen } = {}) {
    this.engine = engine;
    this.g = g;
    this.almacen = almacen === undefined ? g.localStorage : almacen;
    this._pref = leerPreferencias(this.almacen);
    this.dicha = null;
    this._enCurso = null;   // { u, desde } — la frase que se está leyendo
    this._alCambiarDeFase = (p) => {
      if (this.engine.playing) this._leer(p.k);
      else this.dicha = null;
    };
    this._alReproducir = () => {
      if ((this.engine.phaseElapsed || 0) < AL_EMPEZAR_MS && this.dicha !== this.engine.k) this._leer(this.engine.k);
    };
    /* Pausar al principio de la fase —el vídeo de referencia del
       proyector lo hace nada más empezar— deja la fase por leer: al
       seguir, se lee. */
    this._alPausar = () => {
      this.callar();
      if ((this.engine.phaseElapsed || 0) < AL_EMPEZAR_MS) this.dicha = null;
    };
    engine.on('phase', this._alCambiarDeFase);
    engine.on('play', this._alReproducir);
    engine.on('pause', this._alPausar);
    /* La animación espera a que acabe la frase. */
    this._retener = () => this.hablando;
    engine.retener = this._retener;
    /* El motor arranca solo antes de que existan los mandos: la primera
       fase ya ha empezado y nadie la ha leído. */
    if (engine.playing && (engine.phaseElapsed || 0) < AL_EMPEZAR_MS) this._leer(engine.k);
  }

  /* Lo guardado, leído otra vez; sin almacén, lo de esta sesión. */
  _prefs() {
    if (this.almacen) this._pref = leerPreferencias(this.almacen);
    return this._pref;
  }

  get activa() { return this._prefs().activa; }
  get velocidad() { return this._prefs().velocidad; }

  /** ¿Se está leyendo algo, y la animación tiene que esperar? */
  get hablando() {
    const e = this._enCurso;
    if (!e) return false;
    if (this._ahora() - e.desde > ESPERA_MAXIMA_MS) { this._enCurso = null; return false; }
    return true;
  }

  _ahora() { return this.g.performance && typeof this.g.performance.now === 'function' ? this.g.performance.now() : Date.now(); }

  /** El interruptor. Se recuerda. */
  activar(on) {
    this._pref = { ...this._prefs(), activa: !!on };
    guardarPreferencias(this._pref, this.almacen);
    if (!on) this.callar();
  }

  /** La velocidad de la voz, de las de `VELOCIDADES_VOZ`. Se recuerda. */
  setVelocidad(v) {
    if (!VELOCIDADES_VOZ.includes(v)) return false;
    this._pref = { ...this._prefs(), velocidad: v };
    guardarPreferencias(this._pref, this.almacen);
    return true;
  }

  _leer(k) {
    this.dicha = k;
    const pref = this._prefs();
    if (!pref.activa || !hayVoz(this.g)) return;
    const texto = fraseParaLeer((this.engine.fases || [])[k]);
    this.callar();
    if (!texto) return;
    const u = new this.g.SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES';
    u.rate = pref.velocidad;
    const acaba = () => { if (this._enCurso && this._enCurso.u === u) this._enCurso = null; };
    u.onend = acaba;
    u.onerror = acaba;
    this._enCurso = { u, desde: this._ahora() };
    this.g.speechSynthesis.speak(u);
  }

  /** Corta lo que se esté leyendo, y la animación deja de esperar. */
  callar() {
    this._enCurso = null;
    try { if (hayVoz(this.g)) this.g.speechSynthesis.cancel(); } catch { /* nada que callar */ }
  }

  destroy() {
    this.engine.off('phase', this._alCambiarDeFase);
    this.engine.off('play', this._alReproducir);
    this.engine.off('pause', this._alPausar);
    if (this.engine.retener === this._retener) this.engine.retener = null;
    this.callar();
  }
}
