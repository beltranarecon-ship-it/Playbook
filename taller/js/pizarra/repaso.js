/* ============================================================
   pizarra/repaso.js — el tramo se ve al soltarlo (§5.4, principio 4).

   Terminado un trazo, la ficha lo recorre UNA VEZ a 1,5× y se queda en
   el final. Nada entra en bucle.

   ── NO MUEVE NADA: SOLO DICE DÓNDE PINTAR ───────────────────
   Los datos de la ficha ya están en el final del trazo desde que se
   suelta, que es lo único que se guarda. Esto solo contesta «en este
   instante, píntala aquí», y Fichas lo obedece por su gancho `donde`.

   Es la diferencia entre estar en un sitio y pintarse en otro, y no es
   una sutileza: moviendo el modelo para animar, un repaso cortado a
   mitad —porque llega otro trazo, porque se cambia de fase, porque el
   navegador pausa la pestaña— dejaría la ficha plantada en medio de la
   pista. Así, cortarlo no tiene ninguna consecuencia.

   ── POR QUÉ ESTO NO ES EL MOTOR ─────────────────────────────
   El motor (canvas/engine.js) sabe de fases, carriles, balones en
   vuelo, defensores y rastros. Aquí es UNA ficha recorriendo UN trazo
   mientras se dibuja, y pasarlo por el motor obligaría a montar una
   animación entera y a desmontarla para cada flecha. Lo que sí se
   comparte es lo que importa que sea igual: el muestreado por longitud
   de arco y la curva de aceleración de geometry.js, y los tiempos de
   trazo.js. Si el repaso y la animación de verdad contaran distinto,
   se vería una cosa al dibujar y otra al reproducir — que es el fallo
   que el principio 4 existe para evitar.

   ── EL RELOJ, POR DOS SITIOS ────────────────────────────────
   Igual que el pintado del Lienzo: hay entornos —paneles incrustados,
   pestañas que no componen— donde `requestAnimationFrame` no dispara
   nunca. Un repaso que no avanza dejaría el fantasma congelado a mitad
   del trazo. Va por fotograma y por reloj, y gana el primero.
   ============================================================ */

import { makeSampler, easeInOut } from '../canvas/geometry.js';
import { longitudMetros, duracionDe } from './trazo.js';
import { sitioDelBalon } from './elementos.js';

/** A qué velocidad se repasa lo que acabas de dibujar (§5.4). Más
 *  rápido que de verdad: es una confirmación, no una reproducción. */
export const VELOCIDAD_REPASO = 1.5;

/** Un suelo, porque un tramo de medio metro duraría un parpadeo: mejor
 *  un golpe de vista corto que un salto. */
export const MINIMO_S = 0.28;

/** Cuánto dura el repaso de este trazo, en segundos. */
export function duracionRepaso(trazo, pista = 'entera', ritmo = 'normal') {
  const s = duracionDe(longitudMetros(trazo, pista), ritmo) / VELOCIDAD_REPASO;
  return Math.max(MINIMO_S, s);
}

export class Repaso {
  /** @param onFin () — terminó; no hay nada que recolocar */
  constructor(lienzo, { onFin } = {}) {
    this.lienzo = lienzo;
    this.onFin = onFin;
    this.activo = null;   // { porElemento, dur, t0 }
    this._raf = null;
    this._reloj = null;
  }

  get corriendo() { return !!this.activo; }

  /**
   * Reproduce UN tramo una vez, a 1,5×: la confirmación de lo que se
   * acaba de soltar (§5.4).
   *
   * Volver a llamar mientras corre CORTA el anterior en vez de
   * encadenarlos: dibujando deprisa se sueltan dos trazos seguidos, y
   * ver el repaso del anterior mientras ya vas con el siguiente
   * confunde más de lo que ayuda.
   */
  reproducir({ elemento, trazo, ritmo = 'normal' }) {
    if (!trazo || trazo.length < 2 || !elemento) return;
    const pista = this.lienzo.vista.pistaKey;
    /* UN TRAZO SIN LONGITUD NO SE REPASA. Pasa con soltar el destino
       justo encima de la ficha, que es un resbalón de lo más normal.
       Y no es solo que no haya nada que enseñar: `makeSampler` reparte
       por longitud de arco, con longitud cero se sale de su propia
       tabla y revienta a mitad del recorrido, dejando el fotograma a
       medio pintar. */
    if (longitudMetros(trazo, pista) < 1e-6) { this.parar(); this.onFin?.(); return; }
    this.reproducirFase({
      tramos: [{
        corre_id: elemento.id,
        trazo,
        inicio_ms: 0,
        duracion_ms: duracionRepaso(trazo, pista, ritmo) * 1000,
      }],
    });
  }

  /**
   * Reproduce una FASE ENTERA: varios carriles a la vez, cada uno
   * arrancando cuando le toca (§6.1, §6.4).
   *
   * Un tramo suelto es el caso degenerado de esto —uno solo, arrancando
   * en cero—, y por eso no hay dos relojes: el de arriba llama aquí. Un
   * segundo reloj significaría un segundo sitio donde equivocarse con
   * las cancelaciones, y ya costó caro una vez.
   *
   * @param tramos  [{ corre_id, trazo, inicio_ms, duracion_ms }]
   * @param velocidad  1 = a su ritmo (una fase); 1,5 lo trae ya hecho
   *                   el repaso de un tramo en su duración
   */
  reproducirFase({ tramos, velocidad = 1 }) {
    this.parar();
    const pista = this.lienzo.vista.pistaKey;
    const buenos = (tramos || []).filter((t) => t && t.trazo && t.trazo.length > 1
      && t.corre_id && longitudMetros(t.trazo, pista) >= 1e-6);
    if (!buenos.length) { this.onFin?.(); return; }

    /* Agrupados por QUIEN VIAJA, y en orden: para saber dónde pintar a
       alguien en un instante hay que mirar todos sus tramos, no solo el
       que esté activo — entre dos tramos suyos se queda donde acabó el
       primero, y antes del primero, en su arranque. */
    const porElemento = new Map();
    for (const t of buenos) {
      const paso = {
        muestra: makeSampler(t.trazo),
        inicio: Math.max(0, t.inicio_ms || 0) / velocidad,
        dur: Math.max(1, t.duracion_ms || 0) / velocidad,
      };
      paso.fin = paso.inicio + paso.dur;
      if (!porElemento.has(t.corre_id)) porElemento.set(t.corre_id, []);
      porElemento.get(t.corre_id).push(paso);
    }
    for (const lista of porElemento.values()) lista.sort((a, b) => a.inicio - b.inicio);

    this.activo = {
      porElemento,
      dur: Math.max(...buenos.map((t) => (Math.max(0, t.inicio_ms || 0) + Math.max(1, t.duracion_ms || 0)) / velocidad)),
      t0: this._ahora(),
    };
    this._latir();
  }

  /** Corta el repaso. Como no ha tocado ningún dato, no hay nada que
   *  deshacer: la ficha se pinta ya donde dice el modelo. */
  parar() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._reloj) clearTimeout(this._reloj);
    this._raf = null; this._reloj = null;
    const habia = !!this.activo;
    this.activo = null;
    if (habia) this.lienzo.pintar();
  }

  /**
   * El gancho para `Fichas.donde`: dónde pintar esta ficha ahora.
   * `null` para todo lo demás, que se pinta donde está.
   *
   * El balón que lleva la ficha va con ella. Si no, el jugador correría
   * el trazo y el balón se quedaría en el sitio de antes, botando solo.
   */
  donde = (e) => {
    const a = this.activo;
    if (!a || !e) return null;
    const suyo = this.posicion(e.id);
    if (suyo) return suyo;
    /* El balón que lleva alguien va con él. Si no, el jugador correría
       el trazo y el balón se quedaría en el sitio de antes, botando
       solo. Un balón en vuelo tiene su propio tramo y ya ha contestado
       arriba. */
    if (e.kind === 'balon' && e.portador_id) {
      const p = this.posicion(e.portador_id);
      return p && sitioDelBalon({ ...e, x: p.x, y: p.y }, this.lienzo.vista.pistaKey);
    }
    return null;
  };

  /**
   * Dónde pintar a este elemento en este instante, o `null` si en esta
   * reproducción no le toca moverse y vale su sitio del modelo.
   *
   * Los tres casos, y los tres importan: mientras uno de sus tramos está
   * activo se muestrea; ANTES de su primer tramo se le pinta en su
   * arranque —si no, esperaría de pie en el destino, que es donde le ha
   * dejado el modelo—; y ENTRE dos tramos suyos, donde acabó el
   * anterior.
   */
  posicion(id) {
    const a = this.activo;
    if (!a) return null;
    const suyos = id === undefined ? [...a.porElemento.values()][0] : a.porElemento.get(id);
    if (!suyos || !suyos.length) return null;
    const t = this._ahora() - a.t0;

    let ultimoAcabado = null;
    for (const p of suyos) {
      if (t < p.inicio) break;
      if (t < p.fin) return p.muestra(easeInOut((t - p.inicio) / p.dur));
      ultimoAcabado = p;
    }
    if (ultimoAcabado) return ultimoAcabado.muestra(1);
    return suyos[0].muestra(0);
  }

  _ahora() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  _latir() {
    const paso = () => {
      /* GANA EL PRIMERO QUE LLEGUE, Y EL OTRO SE CANCELA AQUÍ.
         Poniendo solo las referencias a null, el que quedaba pendiente
         disparaba también, y cada uno de los dos volvía a programar
         otros dos: dos bucles, luego cuatro, luego ocho. En un repaso
         de un segundo eso son miles de temporizadores vivos, la
         pizarra se atasca, y como todos pintan lo mismo no se ve nada
         raro hasta que el ventilador se dispara. */
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._reloj) clearTimeout(this._reloj);
      this._raf = null; this._reloj = null;
      if (!this.activo) return;
      if (this._ahora() - this.activo.t0 >= this.activo.dur) {
        this.activo = null;
        this.lienzo.pintar();
        this.onFin?.();
        return;
      }
      this.lienzo.pintar();
      this._latir();
    };
    this._raf = requestAnimationFrame(paso);
    this._reloj = setTimeout(paso, 16);
  }

  destroy() { this.parar(); }
}
