/* ============================================================
   pizarra/gestos.js — quién manda sobre cada dedo (§2.6, §3.1).

   Módulo PURO: no toca el DOM ni conoce la pista. Recibe eventos de
   puntero ya normalizados y devuelve ÓRDENES; `lienzo.js` los traduce
   y las ejecuta. Lo prueba en Node taller/tools/eval-punteros.mjs.

   ── POR QUÉ SEPARADO Y PURO ─────────────────────────────────
   Los fallos de los gestos multitáctiles no se ven leyendo el código:
   aparecen cuando alguien apoya el canto de la mano, cuando el
   navegador se lleva el gesto a mitad, o cuando levanta un dedo de
   dos. Comprobar eso con dedos de verdad es lento y no se puede
   repetir igual dos veces. Aquí se comprueba con secuencias de
   eventos escritas a mano, y cada caso que aparezca en la pista se
   añade como una prueba más.

   ── EL PROBLEMA CENTRAL ─────────────────────────────────────
   En el mismo lienzo conviven cosas que se hacen con UN dedo —mover
   una ficha, dibujar un trazo a pulso de tres segundos, marcar una
   selección— y cosas que se hacen con DOS —acercar y desplazar la
   vista—. Cuando aparece el segundo dedo hay que decidir, en un
   instante, si es un pellizco deliberado o un meñique apoyado sin
   querer. Y decidir mal cuesta caro: o se pierde un trazo largo, o se
   deja escrita en la jugada una posición que nadie eligió.

   La regla es el tiempo. Un gesto que todavía no ha hecho nada se
   revoca sin más. Uno que ya está trabajando solo se revoca si el
   segundo dedo llega DENTRO de los primeros 120 ms — que es lo que
   tardan en aterrizar los dos dedos de una misma mano. Pasado eso, el
   segundo dedo sobra y el trabajo se respeta.

   ── UN GESTO SE REVOCA, NO SE PAUSA ─────────────────────────
   El único canal hacia arriba es `abortar`. Quien atiende el gesto
   decide qué significa: la ficha vuelve a donde estaba, el trazo se
   descarta, la selección no cambia. El Lienzo no sabe qué se estaba
   haciendo, y por eso no tiene que decidirlo.
   ============================================================ */

import { ZOOM_MIN, ZOOM_MAX } from '../canvas/encuadre.js';

/* ── Los números, y de dónde sale cada uno ─────────────────── */

/**
 * Cuánto hay que mover un puntero para que deje de ser un toque y pase
 * a ser un arrastre, en píxeles de PANTALLA.
 *
 * Con el dedo, 10: Android usa 8 dp para lo mismo e iOS reconoce la
 * panorámica alrededor de los 10 pt, y aquí conviene el extremo
 * conservador porque un falso positivo no es un desplazamiento torpe
 * —mueve un jugador y lo deja escrito—. Un toque con el pulgar recorre
 * entre 4 y 12 px solo al presionar y soltar.
 *
 * Con ratón y lápiz, 4: es el umbral de arrastre del propio Windows
 * (SM_CXDRAG), o sea lo que el entrenador ya tiene en todas las demás
 * aplicaciones. El lápiz va con el ratón y no con el dedo porque su
 * punta mide dos milímetros y no rueda como una yema.
 *
 * EN PÍXELES DE PANTALLA, nunca en normalizado: el editor viejo usa
 * 0,01 normalizado, que al 100 % son 4,4 px y al 400 % son 1,1 — el
 * mismo gesto se comporta distinto según el zoom.
 */
export const UMBRAL_PX = { touch: 10, pen: 4, mouse: 4 };

/**
 * Cuánto tiempo puede un segundo dedo revocar un gesto que ya está
 * trabajando. Los dos dedos de una mano que baja a pellizcar aterrizan
 * con 30-80 ms de diferencia; 120 los cubre con margen. Por arriba lo
 * acota lo que hay que proteger: un trazo a pulso dura entre uno y
 * varios segundos, un orden de magnitud más.
 */
export const VENTANA_ARME = 120;

/**
 * Radio mínimo de acierto con el dedo (44 px de diámetro, §2.6 y WCAG
 * 2.5.5). Es SUELO y no techo: un jugador de 1,30 m se dibuja con
 * radio 15,7 px al 100 % y 62,8 px al 400 %, así que por debajo del
 * 140 % el suelo ayuda y por encima estorbaría. Con ratón y lápiz no
 * se aplica: vale el radio de verdad.
 */
export const AGARRE_DEDO = 22;

/**
 * Separación mínima entre dos contactos para que puedan pellizcar. En
 * una tablet, 40 px son unos 8,6 mm: menos que el ancho de contacto de
 * UNA yema. Dos manchas más juntas no son dos dedos, son un dedo y su
 * nudillo, y calcular una razón con esa base es lo que hace que la
 * pista pegue un salto. Es además la guarda contra dividir por cero.
 */
export const SEP_MIN = 40;

/**
 * Cuánto tiene que cambiar la separación antes de que el zoom se arme.
 * La separación es la diferencia de dos posiciones independientes, así
 * que su ruido es √2 veces el de un dedo: 10·√2 ≈ 14, redondeado a 16.
 * Por debajo de eso no se está midiendo una mano que se abre, sino el
 * balanceo de la muñeca mientras se arrastra con dos dedos.
 */
export const SEP_ARRANQUE = 16;

export const umbralDe = (tipo) => UMBRAL_PX[tipo] ?? UMBRAL_PX.mouse;

/** El radio con el que hay que acertar, según con qué se señale. */
export const radioAcierto = (radioPx, tipo) => (tipo === 'touch' ? Math.max(radioPx, AGARRE_DEDO) : radioPx);

export const separacion = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const centroide = (ps) => ({
  x: ps.reduce((s, p) => s + p.x, 0) / (ps.length || 1),
  y: ps.reduce((s, p) => s + p.y, 0) / (ps.length || 1),
});

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TACTIL = (p) => p.tipo === 'touch';

/* ── El estado ─────────────────────────────────────────────── */

/**
 * `reducir` MUTA el estado que recibe y lo devuelve. No es un desliz:
 * un mapa de dedos vivos es estado por naturaleza, y clonarlo en cada
 * `pointermove` —que llegan a sesenta por segundo y por dedo— sería
 * gastar por gusto. Lo que sí se mantiene puro es que no toca nada de
 * fuera: mismas entradas, mismas órdenes.
 */
export function nuevoEstado() {
  return {
    modo: 'libre',        // libre · mano · arme · uno · ver · restos
    punteros: new Map(),  // id → { id, tipo, papel, orden, x0, y0, t0, x, y, promovido }
    mano: null,           // { id, x, y } — el arrastre con ratón, que ya existía
    orden: 0,
    ancla: null,          // { d0, e0, cx, cy, zoomArmado }
  };
}

const vivos = (e) => [...e.punteros.values()];
const deVer = (e) => vivos(e).filter((p) => p.papel === 'ver').sort((a, b) => a.orden - b.orden);
const elGesto = (e) => vivos(e).find((p) => p.papel === 'gesto') || null;

/** Tras la salida o entrada de un dedo, la referencia del pellizco se
 *  rehace con los que hay AHORA y la escala de AHORA. Arrastrar una
 *  medida tomada con una pareja que ya no existe es lo que hace que la
 *  escala salte por un factor de dos o tres. */
function rebasar(e, escalaActual) {
  const par = deVer(e).slice(0, 2);
  const c = centroide(par.length ? par : [{ x: 0, y: 0 }]);
  const seguia = e.ancla?.zoomArmado && par.length === 2;
  e.ancla = {
    d0: par.length === 2 ? separacion(par[0], par[1]) : 0,
    e0: escalaActual,
    cx: c.x,
    cy: c.y,
    zoomArmado: !!seguia,
  };
}

/* Las teclas modificadoras viajan CON el punto, no se consultan
   aparte. Es lo que permite que el imán (Shift mientras mueves, §3.4)
   se entere: leer el teclado por su cuenta obligaría a cada capa a
   escuchar keydown y a acordarse de soltarlo, y el estado de la tecla
   en el instante del movimiento es justo el que importa. */
const punto = (p) => ({
  id: p.id, tipoPuntero: p.tipo,
  px: p.x, py: p.y, px0: p.x0, py0: p.y0,
  dpx: p.x - p.x0, dpy: p.y - p.y0,
  t: p.t, dt: p.t - p.t0,
  shift: !!p.shift, alt: !!p.alt, ctrl: !!p.ctrl, meta: !!p.meta,
});

/**
 * Un evento dentro, una lista de órdenes fuera.
 *
 * evento = { tipo:'down'|'move'|'up'|'cancel'|'perdida'|'purga',
 *            id, tipoPuntero, x, y, t, boton, botones, espacio,
 *            escalaActual }
 *
 * orden  = { tipo:'capturar'|'abrir'|'mover'|'tocar'|'soltar'
 *                |'abortar'|'pellizco'|'desplazar'|'clase', … }
 */
export function reducir(estado, ev) {
  const ordenes = [];
  const esc = Number.isFinite(ev.escalaActual) ? ev.escalaActual : 1;

  /* Cierra un puntero y decide a dónde va la máquina. */
  const cerrar = (p, como) => {
    if (p.papel === 'gesto') {
      if (como === 'cancel') ordenes.push({ tipo: 'abortar', id: p.id });
      else if (p.promovido) ordenes.push({ tipo: 'soltar', id: p.id, p: punto(p) });
      else ordenes.push({ tipo: 'tocar', id: p.id, p: punto(p) });
    }
    estado.punteros.delete(p.id);
  };
  const asentar = () => {
    if (estado.punteros.size === 0 && !estado.mano) {
      estado.modo = 'libre';
      estado.ancla = null;
    } else if (estado.modo !== 'ver') {
      estado.modo = elGesto(estado) ? estado.modo : 'restos';
    }
  };

  /* ---- purga: se pierde el foco, se abre un modal, Escape ---- */
  if (ev.tipo === 'purga') {
    for (const p of vivos(estado)) {
      if (p.papel === 'gesto') ordenes.push({ tipo: 'abortar', id: p.id });
    }
    if (estado.mano) ordenes.push({ tipo: 'clase', clase: 'is-arrastrando', on: false });
    estado.punteros.clear();
    estado.mano = null;
    estado.ancla = null;
    estado.modo = 'libre';
    return { estado, ordenes };
  }

  /* ---- abajo ------------------------------------------------- */
  if (ev.tipo === 'down') {
    /* Un id repetido NO se ignora: los de dedo se reciclan y el del
       ratón es siempre el mismo, así que ignorarlo haría que el dedo
       nuevo heredara el origen de un gesto muerto. Se reemplaza,
       abortando antes lo que hubiera. */
    const previo = estado.punteros.get(ev.id);
    if (previo) {
      if (previo.papel === 'gesto') ordenes.push({ tipo: 'abortar', id: previo.id });
      estado.punteros.delete(ev.id);
      /* Y hay que recolocar el modo, no solo borrar la entrada: si el
         que se reemplaza era el único gesto vivo, el mapa queda vacío
         pero el modo seguiría en «uno», y entonces el dedo nuevo caería
         en la rama de «sobra» y no abriría nada. Se ve con un dedo que
         arrastra y un `down` repetido: el gesto muere y ya no se puede
         empezar otro hasta levantar. */
      if (estado.punteros.size === 0 && !estado.mano) {
        estado.modo = 'libre';
        estado.ancla = null;
      }
    }

    // 1) la rama del ratón, la PRIMERA y sin cambios respecto a hoy
    const conMano = ev.boton === 1 || (ev.boton === 0 && ev.espacio && ev.tipoPuntero !== 'touch');
    if (estado.modo === 'libre' && conMano) {
      estado.mano = { id: ev.id, x: ev.x, y: ev.y };
      estado.modo = 'mano';
      ordenes.push({ tipo: 'capturar', id: ev.id }, { tipo: 'clase', clase: 'is-arrastrando', on: true });
      return { estado, ordenes };
    }

    const p = {
      id: ev.id, tipo: ev.tipoPuntero, papel: 'sobra', orden: ++estado.orden,
      x0: ev.x, y0: ev.y, t0: ev.t, x: ev.x, y: ev.y, t: ev.t, promovido: false,
      shift: !!ev.shift, alt: !!ev.alt, ctrl: !!ev.ctrl, meta: !!ev.meta,
    };

    // 2) ya estamos viendo: todo dedo nuevo se suma a la vista
    if (estado.modo === 'ver') {
      if (TACTIL(p)) { p.papel = 'ver'; estado.punteros.set(p.id, p); rebasar(estado, esc); }
      else estado.punteros.set(p.id, p);
      return { estado, ordenes };
    }

    // 3) el segundo dedo: ¿pellizco o meñique apoyado?
    const enCurso = elGesto(estado);
    if (TACTIL(p) && enCurso && TACTIL(enCurso)) {
      const aTiempo = !enCurso.promovido || (ev.t - enCurso.t0) < VENTANA_ARME;
      if (aTiempo) {
        ordenes.push({ tipo: 'abortar', id: enCurso.id });
        enCurso.papel = 'ver';
        enCurso.promovido = false;
        p.papel = 'ver';
        estado.punteros.set(p.id, p);
        estado.modo = 'ver';
        rebasar(estado, esc);
        return { estado, ordenes };
      }
      estado.punteros.set(p.id, p);      // sobra: no roba el trazo
      return { estado, ordenes };
    }

    // 4) el primero: nace un gesto de un dedo
    if (estado.modo === 'libre') {
      p.papel = 'gesto';
      estado.punteros.set(p.id, p);
      estado.modo = 'arme';
      ordenes.push({ tipo: 'capturar', id: p.id }, { tipo: 'abrir', id: p.id, p: punto(p) });
      return { estado, ordenes };
    }

    // 5) cualquier otro caso: sobra y solo ocupa sitio
    estado.punteros.set(p.id, p);
    return { estado, ordenes };
  }

  /* ---- movimiento -------------------------------------------- */
  if (ev.tipo === 'move') {
    if (estado.mano && ev.id === estado.mano.id) {
      ordenes.push({ tipo: 'desplazar', dx: ev.x - estado.mano.x, dy: ev.y - estado.mano.y });
      estado.mano.x = ev.x; estado.mano.y = ev.y;
      return { estado, ordenes };
    }
    const p = estado.punteros.get(ev.id);
    if (!p) return { estado, ordenes };   // el lápiz en vuelo manda moves sin haber bajado

    /* Con ratón o lápiz, `botones === 0` significa que se soltó fuera
       de la ventana y el `up` se perdió. Con el dedo no vale: ahí
       `botones` es 1 mientras esté apoyado. */
    if (p.tipo !== 'touch' && ev.botones === 0) {
      cerrar(p, 'up');
      asentar();
      return { estado, ordenes };
    }

    p.x = ev.x; p.y = ev.y; p.t = ev.t;
    p.shift = !!ev.shift; p.alt = !!ev.alt; p.ctrl = !!ev.ctrl; p.meta = !!ev.meta;

    if (p.papel === 'ver') {
      const par = deVer(estado).slice(0, 2);
      if (!par.some((q) => q.id === p.id)) return { estado, ordenes };
      const c = centroide(par);
      const a = estado.ancla;
      let escala = esc;
      if (par.length === 2) {
        const d = separacion(par[0], par[1]);
        if (!a.zoomArmado && d >= SEP_MIN && Math.abs(d - a.d0) >= SEP_ARRANQUE) {
          /* Al armarse se rebasa aquí mismo, así que el zoom arranca
             en ×1,00 y no da el salto de todo lo que se abrió mientras
             se decidía. */
          a.zoomArmado = true; a.d0 = d; a.e0 = esc;
        }
        if (a.zoomArmado && a.d0 > 0) escala = a.e0 * (d / a.d0);
        const recortada = clamp(escala, ZOOM_MIN, ZOOM_MAX);
        if (recortada !== escala) { a.d0 = d; a.e0 = recortada; escala = recortada; }
      }
      ordenes.push({ tipo: 'pellizco', escala, cx: c.x, cy: c.y, dx: c.x - a.cx, dy: c.y - a.cy });
      a.cx = c.x; a.cy = c.y;
      return { estado, ordenes };
    }

    if (p.papel !== 'gesto') return { estado, ordenes };

    if (!p.promovido) {
      if (Math.hypot(p.x - p.x0, p.y - p.y0) < umbralDe(p.tipo)) return { estado, ordenes };
      p.promovido = true;
      estado.modo = 'uno';
    }
    ordenes.push({ tipo: 'mover', id: p.id, p: punto(p) });
    return { estado, ordenes };
  }

  /* ---- arriba y cancelación ---------------------------------- */
  if (ev.tipo === 'up' || ev.tipo === 'cancel' || ev.tipo === 'perdida') {
    if (estado.mano && ev.id === estado.mano.id) {
      /* El encuadre se QUEDA donde esté, también al cancelarse: es
         vista, y devolverla a su sitio se lee como un fallo. */
      estado.mano = null;
      ordenes.push({ tipo: 'clase', clase: 'is-arrastrando', on: false });
      asentar();
      return { estado, ordenes };
    }
    const p = estado.punteros.get(ev.id);
    if (!p) return { estado, ordenes };
    const eraVer = p.papel === 'ver';
    cerrar(p, ev.tipo === 'up' ? 'up' : 'cancel');
    if (estado.punteros.size === 0) {
      estado.modo = 'libre'; estado.ancla = null;
    } else if (estado.modo === 'ver') {
      if (eraVer) rebasar(estado, esc);
      if (deVer(estado).length < 2 && estado.ancla) estado.ancla.zoomArmado = false;
    } else {
      asentar();
    }
    return { estado, ordenes };
  }

  return { estado, ordenes };
}
