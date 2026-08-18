/* ============================================================
   montaje.mjs — ayudantes compartidos por todas las tandas.

   Cada tanda declara el TABLERO (dónde se coloca cada cosa) y la
   INTENCIÓN (qué hace cada jugador, fase a fase). La geometría la
   calcula compilarAnimacion() de forma determinista, así que escribir
   ejercicios no cuesta API: lo que se escribe es baloncesto, no
   coordenadas de curvas.
   ============================================================ */

import { compilarAnimacion } from '../../taller/js/ia/compilador.js';
import { posicionesDe } from '../../taller/js/canvas/anclas.js';
import { crearZona, zonaGuardable } from '../../taller/js/canvas/zonas.js';

/* ---- tablero: mismas formas que usa el Taller ------------------

   El contador de ids se reinicia en CADA ficha (lo hace compilarFichas
   antes de llamar a su tablero). Antes era global a toda la biblioteca,
   y entonces añadir un balón en la ficha 8 renumeraba los conos de las
   otras 89: el diff contra la base decía que habían cambiado todas y no
   había forma de ver qué había cambiado de verdad. Con el contador por
   ficha los ids son estables y deterministas. */

let _n = 0;
export const reiniciarIds = () => { _n = 0; };

export const jug = (equipo, label, x, y, extra = {}) =>
  ({ id: `el_${++_n}`, kind: 'jugador', equipo, label: String(label), dorsal: null, nombre: null, x, y, ...extra });

/* El `id` es opcional, y se pone cuando la INTENCIÓN tiene que nombrar
   ese balón concreto: con dos balones que acaban en el mismo sitio —dos
   equipos tirando al mismo aro— el `recoge` por defecto elige el suelto
   más cercano, y los dos reboteadores irían a por el mismo. */
export const balon = (x, y, id = null) => ({ id: id || `el_balon_${++_n}`, kind: 'balon', x, y, portador_id: null });

/* El `id` es opcional salvo en los conos de RODEAR: el compilador no
   deduce el slalom de que haya conos en el tablero — la intención
   tiene que declarar un evento `rodea_cono` nombrando cada uno. Sin
   eso el jugador va en línea recta y se los salta, que es como el
   piloto acabó con un ejercicio llamado "Slalom" dibujando una recta. */
export const cono = (x, y, funcion = 'decorativo', fila_config = null, id = null) =>
  ({ id: id || `el_cono_${++_n}`, kind: 'cono', x, y, funcion, fila_config });

/* Material del suelo. No participa en ninguna acción —nadie lo pasa, lo
   rodea ni lo recoge—, pero ocupa sitio y se dibuja a su medida real, que
   es lo que deja ver si de verdad caben dos escaleras en paralelo.
   `grados` en la escalera: 0 = tumbada hacia la derecha. */
export const escalera = (x, y, grados = 0) =>
  ({ id: `el_esc_${++_n}`, kind: 'escalera', x, y, rot: grados });

export const pelota = (x, y) => ({ id: `el_pel_${++_n}`, kind: 'pelota', x, y });

/* Zona: un trozo de pista con nombre. Sirve para decir dónde («corta a la
   zona de tiro») y para verse difuminada de fondo. NO restringe
   trayectorias: la regla la escribe la ficha. */
export const zona = (tipo, x, y, x2, y2, nombre = null, visible = true) => {
  const z = crearZona(tipo, x, y, x2, y2);
  return { ...z, id: `el_zona_${++_n}`, nombre: nombre || z.nombre, visible };
};

/* Atajo: fila de n jugadores en (x,y) avanzando en `grados`
   (0 = hacia la derecha del lienzo, sentido horario). El primero sale
   a trabajar y la cola dibujada baja en uno. */
export const fila = (x, y, n, grados, equipo = 'A') =>
  cono(x, y, 'fila', { n_jugadores: n, direccion_grados: grados, equipo });

/* ---- anclas ----------------------------------------------------
   Se usan por nombre en vez de a ojo: son las mismas que nombra el
   guion automático (DOCTRINA D15), así que el texto de la ficha y el
   texto generado hablan igual. Y desde el Tramo 2.1 se calculan desde
   las medidas reales (canvas/medidas.js), así que escribir `M.codo_der`
   pone la ficha en el codo de verdad, en las cuatro pistas.

   OJO con la media: está dibujada en PAISAJE, el aro queda a la
   IZQUIERDA (0,199 · 0,50) y el campo va de x 0,111 (fondo) a 0,889
   (medio campo). Lo que queda fuera de esa caja —y hasta 0 y 1— es la
   banda de 2 m: sitio legítimo para una fila que espera turno. */
export const M = posicionesDe('media', 'norte');
export const E = posicionesDe('entera', 'norte');

/* ---- montaje estático -----------------------------------------
   Misma forma que animacionDesdeBoard() del Taller: posiciones sí,
   fases no. Para los juegos abiertos, que pueden acabar de mil
   maneras y donde animar una sola sería enseñar una jugada cerrada
   donde debe haber lectura. */
/* La clave `materiales` solo aparece si hay algo, igual que en el
   compilador: así las fichas que no llevan material siguen siendo
   byte a byte lo que eran. */
export function zonasDe(elementos) {
  const zs = elementos.filter((e) => e.kind === 'zona').map((z, i) => zonaGuardable(z, i));
  return zs.length ? { zonas: zs } : {};
}

export function materialesDe(elementos) {
  const mats = elementos
    .filter((e) => e.kind === 'escalera' || e.kind === 'pelota')
    .map((e, i) => ({
      id: e.id || `mat_${i + 1}`, tipo: e.kind, posicion: [e.x, e.y],
      ...(e.kind === 'escalera' ? { rot: e.rot ?? 0 } : {}),
    }));
  return mats.length ? { materiales: mats } : {};
}

export function soloMontaje(elementos, pista) {
  return {
    pista,
    jugadores: elementos.filter((e) => e.kind === 'jugador').map((e) => ({
      id: `${e.equipo}${e.label}`, equipo: e.equipo,
      tipo: e.equipo === 'A' ? 'atacante' : 'defensor',
      posicion_inicial: [e.x, e.y], tiene_balon: false, dorsal: null, nombre: null,
    })),
    balones: elementos.filter((e) => e.kind === 'balon').map((e, i) => ({ id: `balon_${i + 1}`, posicion_inicial: [e.x, e.y], portador_id: null })),
    conos: elementos.filter((e) => e.kind === 'cono').map((e, i) => ({ id: e.id || `cono_${i + 1}`, posicion: [e.x, e.y], funcion: e.funcion || 'decorativo', fila_config: e.fila_config || null })),
    ...zonasDe(elementos),
    ...materialesDe(elementos),
    fases: [],
    canasta: 'norte',
    warnings: [],
  };
}

/** Convierte fichas con `tablero`/`intent` en fichas listas para importar. */
export function compilarFichas(fichas) {
  return fichas.map((f) => {
    const { tablero, intent, ...ficha } = f;
    reiniciarIds();
    const elementos = tablero();
    ficha.animacion = intent
      ? compilarAnimacion(intent, elementos, ficha.tipo_pista)
      : soloMontaje(elementos, ficha.tipo_pista);
    ficha.autor_nombre = 'Biblioteca CBP';
    ficha.favorito = false;
    return ficha;
  });
}
