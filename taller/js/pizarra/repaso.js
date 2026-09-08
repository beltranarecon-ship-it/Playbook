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
    this.activo = null;   // { id, muestra, t0, dur }
    this._raf = null;
    this._reloj = null;
  }

  get corriendo() { return !!this.activo; }

  /**
   * Reproduce este tramo una vez.
   *
   * Volver a llamar mientras corre CORTA el anterior en vez de
   * encadenarlos: dibujando deprisa se sueltan dos trazos seguidos, y
   * ver el repaso del anterior mientras ya vas con el siguiente
   * confunde más de lo que ayuda.
   */
  reproducir({ elemento, trazo, ritmo = 'normal' }) {
    if (!trazo || trazo.length < 2 || !elemento) return;
    this.parar();
    this.activo = {
      id: elemento.id,
      muestra: makeSampler(trazo),
      dur: duracionRepaso(trazo, this.lienzo.vista.pistaKey, ritmo) * 1000,
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
    if (e.id === a.id) return this._punto();
    if (e.kind === 'balon' && e.portador_id === a.id) {
      const p = this._punto();
      return p && sitioDelBalon({ ...e, x: p.x, y: p.y }, this.lienzo.vista.pistaKey);
    }
    return null;
  };

  /** Dónde va el que corre, ahora mismo. Sale aparte para que un arnés
   *  pueda cronometrarlo sin pintar. */
  posicion() { return this._punto(); }

  _punto() {
    const a = this.activo;
    if (!a) return null;
    const u = Math.min(1, Math.max(0, (this._ahora() - a.t0) / a.dur));
    return a.muestra(easeInOut(u));
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
