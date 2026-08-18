/* ============================================================
   draft.js — modelo del ejercicio en construcción (§13) y
   validaciones. Las posiciones de los elementos viven en el Board;
   aquí va el resto de la ficha.
   ============================================================ */

import { dificultadDe } from '../config.js';

export function nuevoDraft() {
  return {
    nombre: '',
    tipo: null,
    tipo_pista: 'entera',
    categoria_rama: null,
    categoria_nivel: [],
    descripcion_texto: '',
    /* Paso 2 (Tramo 2.9): una línea por fase, con sus ajustes. Es la
       FUENTE de la animación —se relee y se recompila entera cada vez—,
       así que vive en el borrador y viaja dentro de `animacion` al
       guardar (`_fases_texto`), para que reabrir el ejercicio devuelva
       el paso 2 tal como se dejó. */
    fases_texto: [{ texto: '', duracion_ms: null, pausa_post_ms: null }],
    /* Sitios marcados con un clic en la pista, { slug: [x,y] }. Valen
       en este ejercicio desde el primer momento; guardarlos para el
       club es una decisión aparte y explícita. */
    posiciones: {},
    canasta: null,           // aro al que ataca; null = el más cercano a lo colocado
    ediciones: [],           // retoques manuales de flechas (Tramo 6)
    animacion: null,         // JSON §10 una vez generada
    dificultad_valor: 3,
    dificultad_sugerida: null,
    intensidad: 3,           // intensidad física por defecto 1-5 (carga · módulo Sesiones)
    duracion_min: 10,
    duracion_max: 20,
    autor_nombre: '',
    tags: [],
    objetivos: '',
    notas: '',

    /* ---- El molde de la biblioteca (Tramo 2.12) ------------------
       Hasta ahora el paso 3 tenía tres cajas de texto y un conteo de
       fichas, y la biblioteca pedía veinte campos. Resultado: un
       ejercicio hecho en el Taller no pasaba su propio linter, y en la
       ficha se veía medio vacío al lado de los 204 importados.

       Ahora el paso 3 ES el molde. Lo que hay aquí es exactamente lo
       que `tools/biblioteca/lint-nucleo.mjs` exige, ni un campo más. */

    // La frase de la tarjeta: lo primero que se lee y lo que puntúa en
    // las sugerencias del planificador. No es el desarrollo.
    description: '',
    // El BLOQUE de contenido ('bote', 'tiro', 'defensa'…). Distinto del
    // `tipo` del paso 0, que es la forma del ejercicio.
    category: null,

    /* Todo empieza en null, y no en un valor «razonable». Un cero o un
       «media» de fábrica se ven exactamente igual que una decisión
       tomada: el linter los da por rellenos, el puente al chat no se
       atreve a tocarlos por no pisar lo escrito, y la ficha acaba
       diciendo cosas que nadie ha decidido. `null` significa «sin
       decidir», que es la verdad al abrir el paso 3. */
    requisitos: {
      jugadores_min: null, jugadores_max: null,
      canastas: null,
      estaciones: null,
      simultaneo: null,
      material: [],
      densidad: null,
      oposicion: null,
      presion: null,
      requisito_previo: '',
      organizacion: '',
      criterio_exito: '',
      // Los tres escalones que sustituyen a la edad (D8). Son un DATO,
      // no un párrafo, y tienen que decir tres cosas distintas.
      niveles: { base: '', intermedio: '', avanzado: '' },
      // Obligatorios solo en su caso: `aplicacion` si es analítico (D1),
      // `justificacion_densidad` si la densidad es baja (D4).
      aplicacion: '',
      justificacion_densidad: '',
    },
    requisitos_manual: false, // si el conteo de jugadores se editó a mano
  };
}

/** Validación del Paso 0 (§5): nombre, tipo y pista. */
export function validarPaso0(d) {
  return {
    nombre: !!d.nombre.trim(),
    tipo: !!d.tipo,
    pista: !!d.tipo_pista,
    ok() { return this.nombre && this.tipo && this.pista; },
  };
}

/** Bloqueo de guardado (§13): nombre y al menos un tipo. */
export function puedeGuardar(d) {
  return !!d.nombre.trim() && !!d.tipo;
}

export function etiquetaDificultad(v) { return dificultadDe(v).label; }

/**
 * Dificultad sugerida a partir de lo que la jugada tiene dentro (§12).
 * Es solo una propuesta: el paso 3 la enseña y el entrenador decide.
 *
 * Vivía en `ia/client.js`, con el puente hacia el modelo de pago, y no
 * pintaba nada allí: no interpreta nada, cuenta fases, acciones y
 * jugadores de una animación ya hecha. Al retirar el camino de IA
 * (Tramo 2.11) se ha venido aquí, con las otras dos funciones de
 * dificultad.
 */
export function sugerirDificultad(anim) {
  if (!anim || !anim.fases) return 3;
  const fases = anim.fases.length;
  const jugadores = (anim.jugadores || []).length;
  const acciones = anim.fases.reduce((n, f) => n + (f.pases?.length || 0) + (f.tiros?.length || 0) + (f.bloqueos?.length || 0), 0);
  return Math.max(1, Math.min(6, 1 + fases + (acciones >= 2 ? 1 : 0) + (jugadores > 4 ? 1 : 0)));
}

/** Serializa el ejercicio para Supabase (§13). */
export function aRegistro(d) {
  const dif = dificultadDe(d.dificultad_valor);
  return {
    nombre: d.nombre.trim(),
    tipo: d.tipo,
    categoria_rama: d.categoria_rama,
    categoria_nivel: d.categoria_nivel,
    dificultad_valor: d.dificultad_valor,
    dificultad_label: dif.label,
    intensidad: d.intensidad ?? null,
    duracion_min: d.duracion_min,
    duracion_max: d.duracion_max,
    autor_nombre: d.autor_nombre,
    tags: d.tags,
    /* `description` es la frase de la TARJETA y `descripcion_texto` el
       desarrollo. Antes no había la primera y se guardaba la segunda en
       su sitio, así que en la biblioteca las fichas del Taller salían
       con un párrafo entero donde las importadas tienen una línea.
       `category` es el BLOQUE de contenido: aquí se escribía la rama
       ('Minibasket'), que no es un bloque, y el ejercicio quedaba fuera
       de los filtros del planificador y de su propio linter. */
    description: d.description,
    category: d.category,
    objetivos: d.objetivos,
    notas: d.notas,
    descripcion_texto: d.descripcion_texto,
    animacion: d.animacion,
    tipo_pista: d.tipo_pista,
    requisitos: d.requisitos,
    favorito: false,
  };
}
