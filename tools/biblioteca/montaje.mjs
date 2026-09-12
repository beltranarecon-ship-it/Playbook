/* ============================================================
   montaje.mjs — ayudantes compartidos por todas las tandas.

   Cada tanda declara el TABLERO (dónde se coloca cada cosa), y de ahí
   sale la ficha: SOLO CON POSICIONES. El movimiento ya no se calcula
   aquí, se dibuja a mano en la Pizarra, que es quien manda sobre la
   animación desde que se retiró el motor viejo.

   La `intent` que todavía traen muchas tandas se IGNORA. No se borra
   de las tandas porque sigue valiendo como referencia escrita de lo
   que el ejercicio quería enseñar cuando toque dibujarlo.
   ============================================================ */

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

/* El `id` es opcional. Lo traen escrito los balones que alguna tanda
   necesitaba nombrar uno por uno —dos equipos tirando al mismo aro—, y
   se respeta: un id fijo no se mueve aunque cambie el orden del
   tablero, y así las fichas ya importadas no se renumeran solas. */
export const balon = (x, y, id = null) => ({ id: id || `el_balon_${++_n}`, kind: 'balon', x, y, portador_id: null });

/* El `id` también es opcional aquí. Lo llevan sobre todo los conos de
   RODEAR, porque el motor viejo exigía nombrarlos uno a uno para
   dibujar el slalom; se conserva por lo mismo que en el balón: para
   que un cono no cambie de nombre al retocar el tablero. */
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
   fases no. Es lo que sale de TODAS las fichas desde que la animación
   se dibuja en la Pizarra; antes solo lo llevaban los juegos abiertos,
   donde animar un 3c3 sería enseñar una jugada cerrada donde tiene que
   haber lectura. */
/* La clave `materiales` solo aparece si hay algo: así las fichas que
   no llevan material siguen siendo byte a byte lo que eran. */
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

export function soloMontaje(elementos, pista, { canasta = 'norte' } = {}) {
  return {
    pista,
    jugadores: elementos.filter((e) => e.kind === 'jugador').map((e) => ({
      id: `${e.equipo}${e.label}`, equipo: e.equipo,
      tipo: e.equipo === 'A' ? 'atacante' : 'defensor',
      posicion_inicial: [e.x, e.y], tiene_balon: false, dorsal: null, nombre: null,
    })),
    balones: elementos.filter((e) => e.kind === 'balon').map((e, i) => ({ id: e.id || `balon_${i + 1}`, posicion_inicial: [e.x, e.y], portador_id: null })),
    conos: elementos.filter((e) => e.kind === 'cono').map((e, i) => ({ id: e.id || `cono_${i + 1}`, posicion: [e.x, e.y], funcion: e.funcion || 'decorativo', fila_config: e.fila_config || null })),
    ...zonasDe(elementos),
    ...materialesDe(elementos),
    fases: [],
    canasta,
    warnings: [],
  };
}

/** Convierte fichas con `tablero` en fichas listas para importar.
    Conserva el nombre `compilarFichas` porque lo usan sus tres
    llamadores (construir, piloto y lint-tanda) y renombrarlo solo
    serviría para tocar tres ficheros más. */
export function compilarFichas(fichas) {
  return fichas.map((f) => {
    /* `intent` se desestructura para SACARLA de la ficha que se
       importa: sigue escrita en la tanda como referencia, pero ya no
       se compila. La animación se dibuja en la Pizarra. */
    const { tablero, intent, ...ficha } = f;
    reiniciarIds();
    const elementos = tablero();
    /* La canasta SÍ se lee de la intención: no es movimiento, es a qué
       aro se ataca, y sin ella las fichas que atacan la canasta 2 se
       montaban mirando a la 1. */
    ficha.animacion = soloMontaje(elementos, ficha.tipo_pista, {
      canasta: intent?.canasta === 'sur' ? 'sur' : 'norte',
    });
    ficha.autor_nombre = 'Biblioteca CBP';
    ficha.favorito = false;
    return ficha;
  });
}
