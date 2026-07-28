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
    animacion: null,         // JSON §10 una vez generada
    dificultad_valor: 3,
    dificultad_sugerida: null,
    intensidad: 3,           // intensidad física por defecto 1-5 (carga · módulo Sesiones)
    duracion_min: 10,
    duracion_max: 20,
    autor_nombre: '',
    tags: [],
    objetivo_temporada_id: null,
    objetivos: '',
    variantes: '',
    notas: '',
    requisitos: { jugadores: 0, balones: 0, conos: 0 },
    requisitos_manual: false, // si el usuario los editó a mano
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
    objetivo_temporada_id: d.objetivo_temporada_id,
    objetivos: d.objetivos,
    variantes: d.variantes,
    notas: d.notas,
    descripcion_texto: d.descripcion_texto,
    animacion: d.animacion,
    tipo_pista: d.tipo_pista,
    requisitos: d.requisitos,
    favorito: false,
  };
}
