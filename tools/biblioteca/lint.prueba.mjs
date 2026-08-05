/* ============================================================
   lint.prueba.mjs — banco del linter de biblioteca.

   Un linter que no se comprueba a sí mismo da falsa seguridad sobre
   200 fichas: si una regla no dispara, el silencio parece aprobado.
   Cada caso de aquí introduce UN defecto sobre una ficha buena y
   exige que el linter lo cace, y que no cace nada más.

   node tools/biblioteca/lint.prueba.mjs
   ============================================================ */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { revisaFicha, revisaGeometria, revisaConjunto } from './lint.mjs';

/* Ficha de referencia: además de semilla de las pruebas, es el
   EJEMPLO CANÓNICO del molde. Si cambia el contrato, cambia aquí. */
export const FICHA_BUENA = {
  name: 'Entradas por parejas desde el 45',
  type: 'Tiro',
  category: 'entrada',
  tipo_pista: 'media',
  categoria_rama: 'Minibasket',
  categoria_nivel: ['Benjamín', 'Alevín'],
  difficulty: 2,
  intensidad: 3,
  duration_min: 8,
  duration_max: 12,
  description: 'Entradas a canasta en doble ritmo desde el 45, con pase previo y cola corta.',
  objetivos: 'Automatizar el doble ritmo por ambos lados partiendo de una recepción en movimiento.',
  descripcion_texto: 'Dos filas en los 45. El primero de la fila del lado derecho pasa al del lado izquierdo, que recibe en carrera y entra a canasta en doble ritmo. Cada uno va a la fila contraria.',
  notas: 'Puntos clave: paso largo de entrada y paso corto de impulso; extensión con la pierna contraria al brazo de tiro. Error frecuente: llegar frenando y saltar hacia delante en vez de hacia arriba.',
  tags: ['entrada', 'doble ritmo', 'recepción', 'finalización'],
  requisitos: {
    jugadores_min: 4,
    jugadores_max: 12,
    canastas: 1,
    estaciones: 2,
    material: ['balones'],
    densidad: 'alta',
    oposicion: 'nula',
    requisito_previo: 'coordinar dos apoyos con el balón en las manos sin dar pasos',
    dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 30 },
    organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación en dos filas de tres. Dos balones por estación para que no pare.',
    niveles: {
      base: 'sin pase, saliendo ya con el balón botado.',
      intermedio: 'con pase previo y cambiando el lado de entrada cada repetición.',
      avanzado: 'con un defensor que llega desde el fondo y obliga a decidir entrada o parada.',
    },
    criterio_exito: 'ocho de cada diez entradas terminan con el balón tocando tablero antes que el aro',
    aplicacion: '2c2 en media pista con entrada obligatoria tras pase',
  },
  animacion: {
    pista: 'media',
    canasta: 'norte',
    jugadores: [
      { id: 'A1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.62, 0.28], tiene_balon: true },
      { id: 'A2', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.62, 0.72], tiene_balon: false },
    ],
    balones: [{ id: 'balon_1', posicion_inicial: [0.62, 0.28], portador_id: 'A1' }],
    conos: [],
    fases: [
      {
        id: 'fase_1',
        duracion_ms: 1100,
        pausa_post_ms: 500,
        movimientos: [],
        pases: [{ id: 'pase_1', de_id: 'A1', a_id: 'A2', balon_id: 'balon_1', duracion_ms: 450, path: [{ x: 0.62, y: 0.28 }, { x: 0.62, y: 0.72 }] }],
        bloqueos: [], tiros: [], defensores: [],
      },
      {
        id: 'fase_2',
        duracion_ms: 1000,
        pausa_post_ms: 600,
        // La carrera TERMINA pegada al aro (0.21, 0.52 ≈ 1,1 m del centro
        // medido). Esta ficha de referencia acababa antes en (0.28, 0.56)
        // —a 3,1 m— y el banco la daba por buena: un ejemplo canónico que
        // dibujaba como tiro de media distancia el ejercicio que se llama
        // "entradas". La regla de finalización lo destapó.
        movimientos: [{ elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: [{ x: 0.62, y: 0.72, tipo_nodo: 'lineal' }, { x: 0.21, y: 0.52, tipo_nodo: 'lineal' }] }],
        pases: [],
        bloqueos: [],
        // el aro medido de 'media' está a la IZQUIERDA (0.172, 0.5), no arriba
        tiros: [{ id: 'tiro_1', de_id: 'A2', balon_id: 'balon_1', path: [{ x: 0.21, y: 0.52 }, { x: 0.172, y: 0.5 }] }],
        defensores: [],
      },
    ],
    warnings: [],
  },
};

const clona = () => JSON.parse(JSON.stringify(FICHA_BUENA));

/** Aplica una mutación y devuelve todos los mensajes (errores + avisos). */
function mensajes(mut) {
  const f = clona();
  mut(f);
  const a = revisaFicha(f);
  const b = revisaGeometria(f);
  return { errores: [...a.errores, ...b.errores], avisos: [...a.avisos, ...b.avisos] };
}

const CASOS = [
  // ---- la ficha buena pasa limpia ----
  { que: 'la ficha de referencia no da errores', mut: () => {}, espera: null },

  // ---- capa 1 · ficha ----
  { que: 'tag fuera de vocabulario', mut: (f) => { f.tags.push('tiros libres'); }, espera: /tag "tiros libres".*tiro libre/ },
  { que: 'sin tags', mut: (f) => { f.tags = []; }, espera: /sin tags/ },
  { que: 'category que no es bloque', mut: (f) => { f.category = 'Minibasket'; }, espera: /no es un bloque de contenido/ },
  { que: 'type fuera del vocabulario del Taller', mut: (f) => { f.type = 'técnico'; }, espera: /fuera del vocabulario/ },
  { que: 'nivel que no pertenece a la rama', mut: (f) => { f.categoria_nivel = ['Cadete']; }, espera: /no pertenece a la rama/ },
  { que: 'intensidad fuera de rango', mut: (f) => { f.intensidad = 7; }, espera: /intensidad 7/ },
  { que: 'duración máxima menor que la mínima', mut: (f) => { f.duration_max = 3; }, espera: /menor que la m[íi]nima/ },
  // (el caso de los niveles de exigencia vive más abajo, con los suyos:
  // dejó de mirar el párrafo de `variantes` y mira el dato)
  { que: 'requisito obligatorio vacío', mut: (f) => { delete f.requisitos.criterio_exito; }, espera: /criterio_exito vac/ },
  { que: 'densidad desconocida', mut: (f) => { f.requisitos.densidad = 'regular'; }, espera: /densidad "regular"/ },
  { que: 'oposición fuera de la escala D19', mut: (f) => { f.requisitos.oposicion = 'media'; }, espera: /fuera de la escala/ },
  { que: 'más canastas de las que hay', mut: (f) => { f.requisitos.canastas = 4; }, espera: /dispone de 2/ },
  { que: 'jugadores_min mayor que max', mut: (f) => { f.requisitos.jugadores_min = 20; }, espera: /mayor que jugadores_max/ },

  // ---- las reglas de la doctrina ----
  { que: 'D9 · requisito previo escrito como edad', mut: (f) => { f.requisitos.requisito_previo = 'ser alevín'; }, espera: /D9/ },
  { que: 'D9 · requisito previo escrito como años', mut: (f) => { f.requisitos.requisito_previo = 'tener 10 años'; }, espera: /D9/ },
  { que: 'D1 · analítico sin aplicación declarada', mut: (f) => { f.tags.push('analítico'); delete f.requisitos.aplicacion; }, espera: /aplicacion es obligatorio/ },
  { que: 'D4 · densidad baja sin justificar', mut: (f) => { f.requisitos.densidad = 'baja'; }, espera: /justificacion_densidad/ },
  { que: 'D4 · densidad baja justificada pasa', mut: (f) => { f.requisitos.densidad = 'baja'; f.requisitos.justificacion_densidad = 'el tiro libre exige esperar el turno'; }, espera: null },

  // ---- los tres niveles de exigencia como DATO (Prioridad 7) ----
  // Antes se comprobaba que las palabras "base/intermedio/avanzado"
  // aparecieran en el párrafo de `variantes`, y eso lo pasaba cualquier
  // texto que las mencionara de pasada.
  { que: 'NIVELES · sin el campo estructurado', mut: (f) => { delete f.requisitos.niveles; }, espera: /faltan los tres niveles/ },
  { que: 'NIVELES · un escalón vacío', mut: (f) => { f.requisitos.niveles.intermedio = '   '; }, espera: /niveles de exigencia vac[íi]os: intermedio/ },
  {
    que: 'NIVELES · dos escalones que dicen lo mismo',
    // tres peldaños iguales no son una escalera
    mut: (f) => { f.requisitos.niveles.avanzado = f.requisitos.niveles.base; },
    espera: /dos niveles de exigencia con el mismo texto/,
  },
  { que: 'NIVELES · un escalón inventado', mut: (f) => { f.requisitos.niveles.experto = 'con los ojos cerrados'; }, espera: /niveles desconocidos: experto/ },

  // ---- organización con el grupo entero (Prioridad 5 del informe) ----
  { que: 'ORGANIZACIÓN · falta el campo', mut: (f) => { delete f.requisitos.organizacion; }, espera: /requisitos\.organizacion vac[íi]o/ },
  {
    que: 'ORGANIZACIÓN · no dice qué hacer con el grupo de referencia',
    // El campo existe justo para eso: una frase bienintencionada que no
    // da un número deja el problema donde estaba.
    mut: (f) => { f.requisitos.organizacion = 'Se puede adaptar al número de jugadores que haya ese día.'; },
    espera: /no dice qu[ée] hacer con 12/,
  },
  {
    que: 'ORGANIZACIÓN · dice el número pero no el reparto: aviso',
    mut: (f) => { f.requisitos.organizacion = 'Con 12 sale bien.'; },
    espera: null,
    esperaAviso: /no concreta el reparto/,
  },

  // ---- capa 2 · geometría ----
  { que: 'jugador fuera de la pista', mut: (f) => { f.animacion.jugadores[0].posicion_inicial = [1.4, 0.3]; }, espera: /fuera de la pista/ },
  { que: 'la pista de la animación no casa con la ficha', mut: (f) => { f.animacion.pista = 'entera'; }, espera: /es de pista/ },
  { que: 'fase con duración imposible', mut: (f) => { f.animacion.fases[0].duracion_ms = 40; }, espera: /fuera de 200-8000/ },
  { que: 'pase a uno mismo', mut: (f) => { f.animacion.fases[0].pases[0].a_id = 'A1'; }, espera: /a s[íi] mismo/ },
  { que: 'movimiento con un solo nodo', mut: (f) => { f.animacion.fases[1].movimientos[0].path.pop(); }, espera: /menos de dos nodos/ },
  { que: 'cono de fila sin configurar', mut: (f) => { f.animacion.conos.push({ id: 'cono_1', posicion: [0.5, 0.5], funcion: 'fila', fila_config: null }); }, espera: /fila_config/ },
  // Encimarse es un juicio de montaje, no un fallo duro: sale como AVISO
  // (no debe tumbar la importación) y por eso se comprueba ahí.
  { que: 'jugadores encimados en la salida', mut: (f) => { f.animacion.jugadores[1].posicion_inicial = [0.62, 0.29]; }, espera: null, esperaAviso: /pr[áa]cticamente encima/ },
  {
    que: 'EL GORDO · tiro dirigido a la canasta equivocada de una media pista',
    // en 'media' el aro está a la IZQUIERDA (0.172, 0.5). Apuntar arriba
    // —como si fuera una pista entera— es el bug histórico del proyecto.
    mut: (f) => { f.animacion.fases[1].tiros[0].path[1] = { x: 0.5, y: 0.09 }; },
    espera: /el tiro acaba a .* del aro/,
  },
  { que: 'sin animación: aviso, no error', mut: (f) => { delete f.animacion; }, espera: null, esperaAviso: /sin animaci[óo]n/ },

  // ---- finalización y cierre de ciclo (auditoría de agosto 2026) ----
  // Las cuatro nacen de defectos que estaban DENTRO de la biblioteca y
  // que ninguna regla veía: todas miraban dónde ACABA el balón (siempre
  // en el aro) y ninguna de dónde SALE ni qué pasa después.
  {
    que: 'AUDITORÍA · una entrada que suelta el balón lejos del aro',
    // 3,1 m: exactamente donde acababa esta misma ficha de referencia
    // antes de la auditoría, y donde acababan otras doce.
    mut: (f) => {
      f.animacion.fases[1].movimientos[0].path[1] = { x: 0.28, y: 0.56, tipo_nodo: 'lineal' };
      f.animacion.fases[1].tiros[0].path[0] = { x: 0.28, y: 0.56 };
    },
    espera: /promete una finalizaci[óo]n y el tiro sale a/,
  },
  {
    que: 'AUDITORÍA · un tiro que no es una entrada NO dispara esa regla',
    // la regla se activa por el TEXTO de la ficha, no por la distancia:
    // un ejercicio de tiro puede y debe tirar de lejos.
    mut: (f) => {
      f.name = 'Tiro desde el 45';
      f.description = 'Serie de tiro desde el 45 con recepción.';
      f.tags = ['tiro', 'recepción'];
      f.animacion.fases[1].movimientos[0].path[1] = { x: 0.36, y: 0.56, tipo_nodo: 'lineal' };
      f.animacion.fases[1].tiros[0].path[0] = { x: 0.36, y: 0.56 };
    },
    espera: null,
  },
  {
    que: 'AUDITORÍA · tiro imposible para un alevín: aviso',
    mut: (f) => {
      f.name = 'Serie de tiro';
      f.description = 'Serie de tiro.';
      f.tags = ['tiro'];
      f.animacion.fases[1].movimientos[0].path[1] = { x: 0.62, y: 0.85, tipo_nodo: 'lineal' };
      f.animacion.fases[1].tiros[0].path[0] = { x: 0.62, y: 0.85 };
    },
    espera: null,
    esperaAviso: /muy lejos para minibasket/,
  },
  {
    que: 'AUDITORÍA · ejercicio de fila que acaba en tiro y nadie recoge',
    mut: (f) => {
      f.animacion.conos.push({ id: 'f1', posicion: [0.62, 0.28], funcion: 'fila', fila_config: { n_jugadores: 3, direccion_grados: 0, equipo: 'A' } });
    },
    espera: /nadie recoge el bal[óo]n/,
  },
  {
    que: 'AUDITORÍA · con recoge, el ejercicio de fila pasa',
    mut: (f) => {
      f.animacion.conos.push({ id: 'f1', posicion: [0.62, 0.28], funcion: 'fila', fila_config: { n_jugadores: 3, direccion_grados: 0, equipo: 'A' } });
      f.animacion.fases.push({
        id: 'fase_3', duracion_ms: 1200, pausa_post_ms: 200,
        movimientos: [{ elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_sin_balon', path: [{ x: 0.21, y: 0.52 }, { x: 0.2, y: 0.5 }] }],
        pases: [], bloqueos: [], tiros: [], recogidas: [{ jugador_id: 'A2', balon_id: 'balon_1' }], defensores: [],
      });
    },
    espera: null,
  },
  {
    que: 'AUDITORÍA · ficha dibujada que no participa en ninguna fase',
    mut: (f) => {
      f.animacion.jugadores.push({ id: 'A3', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.4, 0.2], tiene_balon: false });
    },
    espera: null,
    esperaAviso: /sin participar en ninguna fase: A3/,
  },

  // ---- lo que salió del piloto ----
  {
    // El compilador NO deduce el slalom de que haya conos: hay que
    // declarar los eventos rodea_cono. Sin ellos el jugador va recto y
    // la ficha promete un slalom que la animación no enseña.
    que: 'PILOTO · conos de rodear que nadie rodea',
    mut: (f) => { f.animacion.conos.push({ id: 'c1', posicion: [0.4, 0.5], funcion: 'rodear', fila_config: null }); },
    espera: /ning[úu]n recorrido los sortea/,
  },
  {
    que: 'PILOTO · dosis del contrato viejo pasaba en silencio',
    mut: (f) => { f.requisitos.dosis = { series: 3, repeticiones: 6, descanso: 30 }; },
    espera: /dosis sin `cantidad`.*contrato viejo/,
  },
  {
    que: 'PILOTO · unidad de dosis desconocida',
    mut: (f) => { f.requisitos.dosis = { series: 3, cantidad: 6, unidad: 'minutos', descanso: 30 }; },
    espera: /unidad "minutos" desconocida/,
  },
  {
    // En un juego continuo la cantidad son SEGUNDOS: tratarlos como
    // repeticiones multiplicaba el trabajo por cuatro y hacía saltar un
    // aviso falso de "no cabe en la duración".
    que: 'PILOTO · 90 segundos de juego continuo caben en 8 min',
    mut: (f) => { f.duration_max = 8; f.requisitos.dosis = { series: 3, cantidad: 90, unidad: 'segundos', descanso: 45 }; },
    espera: null,
  },
  {
    que: 'PILOTO · trabajo simultáneo no dispara el aviso de colas',
    mut: (f) => { f.requisitos.jugadores_max = 16; f.requisitos.estaciones = 1; f.requisitos.simultaneo = true; },
    espera: null,
  },
];

export function autoprueba() {
  let ok = 0;
  const fallos = [];

  for (const c of CASOS) {
    const { errores, avisos } = mensajes(c.mut);
    let bien;
    if (c.espera === null) {
      bien = errores.length === 0;
      if (bien && c.esperaAviso) bien = avisos.some((a) => c.esperaAviso.test(a));
      if (!bien) fallos.push(`${c.que} → esperaba limpio y salió: ${errores.join(' | ') || avisos.join(' | ')}`);
    } else {
      bien = errores.some((e) => c.espera.test(e));
      if (!bien) fallos.push(`${c.que} → no disparó. Errores: ${errores.join(' | ') || '(ninguno)'}`);
    }
    if (bien) ok++;
  }

  /* Capa 3 · invariantes del conjunto. */
  const conjunto = [
    {
      que: 'D1 · un bloque técnico sin oposición suficiente',
      fichas: Array.from({ length: 4 }, (_, i) => ({ ...clona(), name: `Bote ${i}`, category: 'bote', requisitos: { ...FICHA_BUENA.requisitos, oposicion: 'nula' } })),
      espera: /bote:.*oposici[óo]n/,
    },
    {
      que: 'duplicado encubierto por el nombre',
      fichas: [clona(), { ...clona(), name: 'entradas por parejas desde el 45' }],
      espera: /duplicado/,
    },
    {
      // 12 fichas: por encima de muestraMinimaGlobal (10). Con menos, la
      // invariante calla a propósito.
      que: 'D4 · demasiada densidad baja en el conjunto',
      fichas: Array.from({ length: 12 }, (_, i) => ({ ...clona(), name: `X${i}`, requisitos: { ...FICHA_BUENA.requisitos, densidad: 'baja' } })),
      espera: /densidad baja/,
    },
    {
      que: 'muestra pequeña: las proporciones NO se juzgan',
      fichas: [clona()],
      esperaLimpio: true,
    },
  ];

  for (const c of conjunto) {
    const { errores } = revisaConjunto(c.fichas);
    const bien = c.esperaLimpio ? errores.length === 0 : errores.some((e) => c.espera.test(e));
    if (bien) ok++;
    else fallos.push(`${c.que} → ${c.esperaLimpio ? 'esperaba limpio y salió' : 'no disparó. Errores'}: ${errores.join(' | ') || '(ninguno)'}`);
  }

  const total = CASOS.length + conjunto.length;
  console.log(`\nBanco del linter: ${ok}/${total}\n`);
  for (const f of fallos) console.log(`  FALLA  ${f}`);
  if (fallos.length) console.log('');
  return ok === total;
}

/* Punto de entrada propio. Comparar rutas RESUELTAS y no cadenas: en
   Windows conviven barras normales e invertidas y cualquier apaño con
   split() sobre la ruta es un accidente esperando. */
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(autoprueba() ? 0 : 1);
}
