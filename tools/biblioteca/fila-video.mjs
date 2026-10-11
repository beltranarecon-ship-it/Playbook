/* ============================================================
   fila-video.mjs — de un ejercicio de dev/ejercicios-video.js a la
   fila de `exercises` que guardaría la app. Módulo PURO: sin red.

   Lo usa guardar-video.mjs (que es quien habla con Supabase) y lo
   prueba tools/eval-guardar-video.mjs.

   ── LAS MISMAS REGLAS QUE EL TALLER ─────────────────────────
   La fila se construye como `guardarEjercicio`
   (taller/js/supabase/ejercicios.js): la ficha pasa a borrador, el
   borrador por `aRegistro` (taller/js/wizard/draft.js), que es quien
   decide la etiqueta de dificultad y qué viaja, y de ahí a columnas con
   el mismo mapeo. No se rellena nada que la ficha no traiga: un campo
   que falta va a `null` y lo dice el linter, no un valor «razonable».

   El dibujo sale del Tablero de la Pizarra en Node
   (taller/tools/tablero-node.mjs) y se compila con `compilar`, igual
   que hace el asistente al volcar la Pizarra.
   ============================================================ */

/* El Tablero primero: pone el DOM de mentira antes de que se cargue nada
   de la Pizarra. */
const { dibujar } = await import('../../taller/tools/tablero-node.mjs');
const { compilar } = await import('../../taller/js/pizarra/motor/compilar.js');
const { aRegistro } = await import('../../taller/js/wizard/draft.js');
const { revisaFicha, revisaGeometria } = await import('../../taller/js/wizard/lint.js');
const { nombreRepetido } = await import('../../taller/js/wizard/cargar.js');
const { MARCO_ACTUAL } = await import('../../taller/js/canvas/marco-lectura.js');

/* Los campos del molde que la app guarda. Uno de la ficha que no esté
   aquí (p. ej. `variantes`) no viajaría: `guardarEjercicio` no lo
   escribe, y perderlo en silencio es peor que negarse. */
const CAMPOS_DE_FICHA = [
  'name', 'type', 'category', 'tipo_pista', 'categoria_rama', 'categoria_nivel',
  'difficulty', 'intensidad', 'duration_min', 'duration_max', 'autor_nombre',
  'tags', 'description', 'objetivos', 'notas', 'descripcion_texto', 'requisitos',
];

/** Lo que el alta escribe, en el orden de `guardarEjercicio`. */
export const COLUMNAS_ALTA = [
  'name', 'type', 'category', 'difficulty', 'intensidad', 'duration_min', 'duration_max',
  'description', 'tags', 'created_by', 'animacion', 'jugada', 'tipo_pista', 'categoria_rama',
  'categoria_nivel', 'dificultad_label', 'autor_nombre', 'objetivos', 'notas',
  'descripcion_texto', 'requisitos', 'favorito', 'marco',
];

/**
 * El ejercicio a guardar: por su código («V1»), por el nombre del
 * ejercicio o por el de la ficha. Sin nada, el único que haya.
 */
export function elegir(lista, sel) {
  if (!sel) {
    if (lista.length === 1) return lista[0];
    throw new Error(`hay ${lista.length} ejercicios; di cuál: ${lista.map((e) => codigoDe(e)).join(', ')}`);
  }
  const k = String(sel).trim().toLowerCase();
  const e = lista.find((x) => codigoDe(x).toLowerCase() === k
    || x.nombre.toLowerCase() === k || String(x.ficha?.name || '').toLowerCase() === k);
  if (!e) throw new Error(`no hay ningún ejercicio «${sel}»; los que hay: ${lista.map((x) => codigoDe(x)).join(', ')}`);
  return e;
}
/** «V1 · Desmarque…» → «V1». */
export const codigoDe = (e) => String(e.nombre).split(' · ')[0].trim();

/** La ficha (campos del molde) como el borrador del asistente, sin inventar nada. */
export function borradorDeFicha(f, { jugada, animacion }) {
  return {
    nombre: f.name ?? '',
    tipo: f.type ?? null,
    category: f.category ?? null,
    tipo_pista: f.tipo_pista ?? null,
    categoria_rama: f.categoria_rama ?? null,
    categoria_nivel: f.categoria_nivel ?? [],
    dificultad_valor: f.difficulty ?? null,
    intensidad: f.intensidad ?? null,
    duracion_min: f.duration_min ?? null,
    duracion_max: f.duration_max ?? null,
    autor_nombre: f.autor_nombre ?? '',
    tags: f.tags ?? [],
    description: f.description ?? '',
    objetivos: f.objetivos ?? '',
    notas: f.notas ?? '',
    descripcion_texto: f.descripcion_texto ?? '',
    requisitos: f.requisitos ?? null,
    animacion,
    jugada,
  };
}

/** El registro de `aRegistro`, en columnas: el mismo mapeo que `guardarEjercicio`. */
export function filaDeAlta(r, { animacion, autor = null }) {
  return {
    name: r.nombre,
    type: r.tipo,
    category: r.category,
    difficulty: r.dificultad_valor,
    intensidad: r.intensidad,
    duration_min: r.duracion_min,
    duration_max: r.duracion_max,
    description: r.description || null,
    tags: r.tags,
    created_by: autor,
    animacion,
    jugada: r.jugada,
    tipo_pista: r.tipo_pista,
    categoria_rama: r.categoria_rama,
    categoria_nivel: r.categoria_nivel,
    dificultad_label: r.dificultad_label,
    autor_nombre: r.autor_nombre || null,
    objetivos: r.objetivos || null,
    notas: r.notas || null,
    descripcion_texto: r.descripcion_texto || null,
    requisitos: r.requisitos,
    favorito: false,
    marco: MARCO_ACTUAL,
  };
}

/**
 * Lo que escribe una CORRECCIÓN: lo mismo que `actualizarEjercicio` con
 * un borrador (sin autor ni favorito, que son del entrenador), y la
 * miniatura a `null`. La app la regenera al corregir; aquí no se puede
 * (ver guardar-video.mjs), y un póster del dibujo viejo enseñaría en la
 * biblioteca otro ejercicio. A `null`, la tarjeta sale sin imagen y
 * miniaturas.html la cuenta entre «las que faltan».
 */
export function camposDeActualizacion(fila) {
  const { created_by: _a, favorito: _f, ...campos } = fila;
  return { ...campos, poster: null, thumbnail: null };
}

/**
 * Dibuja, compila, revisa y construye la fila. No lanza por defectos de
 * la ficha: los devuelve en `errores`, y con uno solo no se guarda.
 */
export function preparar(ej, { autor = null } = {}) {
  const errores = [];
  const avisos = [];
  const { avisos: rechazos, jugada } = dibujar(ej);
  for (const r of rechazos) errores.push(`la Pizarra no dibuja: ${r}`);
  const animacion = compilar(jugada);
  for (const w of animacion.warnings || []) errores.push(`la animación compila con aviso: ${typeof w === 'string' ? w : JSON.stringify(w)}`);

  const f = ej.ficha || {};
  const sobran = Object.keys(f).filter((k) => !CAMPOS_DE_FICHA.includes(k));
  if (sobran.length) errores.push(`campos de la ficha que la app no guarda y se perderían: ${sobran.join(', ')}`);

  const rf = revisaFicha(f);
  const rg = revisaGeometria({ ...f, animacion });
  errores.push(...rf.errores, ...rg.errores);
  avisos.push(...rf.avisos, ...rg.avisos);

  const r = aRegistro(borradorDeFicha(f, { jugada, animacion }));
  const fila = filaDeAlta(r, { animacion, autor });
  return { jugada, animacion, fila, errores, avisos };
}

/**
 * Qué hacer con un nombre frente a los que ya hay, con la regla de la
 * app (`nombreRepetido`: sin mayúsculas ni espacios de sobra).
 *   · alta: si ya existe, se aborta.
 *   · --actualizar: tiene que existir UNO; se corrige ese, por su id.
 */
export function decidir(nombre, existentes, { actualizar = false } = {}) {
  const iguales = (existentes || []).filter((e) => nombreRepetido(nombre, [e]));
  if (!actualizar) {
    return iguales.length
      ? { accion: 'abortar', motivo: `ya existe «${iguales[0].name}» (id ${iguales[0].id}); para corregirlo, --actualizar` }
      : { accion: 'alta' };
  }
  if (!iguales.length) return { accion: 'abortar', motivo: `«${nombre}» no está en la base; sin --actualizar se da de alta` };
  if (iguales.length > 1) return { accion: 'abortar', motivo: `hay ${iguales.length} ejercicios llamados «${nombre}»: no sé cuál corregir (${iguales.map((e) => e.id).join(', ')})` };
  return { accion: 'actualizar', id: iguales[0].id, nombreEnBase: iguales[0].name };
}
