/* ============================================================
   sample-animacion.js — animación de ejemplo conforme al §10.
   Sirve para probar el motor con JSON "hardcodeado" (Bloque 3):
   ejercita los 4 tipos de flecha — carrera con balón, pase, corte
   y bloqueo — además de un tiro a canasta.
   ============================================================ */

export const SAMPLE_ANIMACION = {
  pista: 'entera',
  jugadores: [
    { id: 'A1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.5, 0.86], tiene_balon: true, dorsal: null, nombre: null },
    { id: 'A2', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.24, 0.80], tiene_balon: false, dorsal: null, nombre: null },
    { id: 'A3', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.76, 0.80], tiene_balon: false, dorsal: null, nombre: null },
    { id: 'B1', equipo: 'B', tipo: 'defensor', posicion_inicial: [0.40, 0.42], tiene_balon: false, dorsal: null, nombre: null },
    { id: 'B2', equipo: 'B', tipo: 'defensor', posicion_inicial: [0.62, 0.42], tiene_balon: false, dorsal: null, nombre: null },
  ],
  balones: [
    { id: 'balon_1', posicion_inicial: [0.5, 0.84], portador_id: 'A1' },
  ],
  conos: [],
  fases: [
    {
      id: 'fase_1', duracion_ms: 1500, pausa_post_ms: 400,
      movimientos: [
        { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon',
          path: [{ x: 0.5, y: 0.86, tipo_nodo: 'lineal' }, { x: 0.5, y: 0.56, tipo_nodo: 'lineal' }] },
        { elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'corte',
          path: [{ x: 0.24, y: 0.80, tipo_nodo: 'lineal' }, { x: 0.17, y: 0.50, tipo_nodo: 'lineal' }] },
        { elemento_id: 'A3', tipo_elemento: 'jugador', tipo_movimiento: 'corte',
          path: [{ x: 0.76, y: 0.80, tipo_nodo: 'bezier', handle_out: { x: 0.88, y: 0.70 } }, { x: 0.83, y: 0.50, tipo_nodo: 'lineal' }] },
      ],
      pases: [],
      bloqueos: [{ bloqueador_id: 'A3', bloqueado_id: 'B2' }],
      tiros: [],
    },
    {
      id: 'fase_2', duracion_ms: 1200, pausa_post_ms: 400,
      movimientos: [
        { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte',
          path: [{ x: 0.5, y: 0.56, tipo_nodo: 'lineal' }, { x: 0.43, y: 0.34, tipo_nodo: 'lineal' }] },
      ],
      pases: [
        { id: 'pase_1', de_id: 'A1', balon_id: 'balon_1', a_id: 'A3', duracion_ms: 500,
          path: [{ x: 0.5, y: 0.56 }, { x: 0.83, y: 0.50 }] },
      ],
      bloqueos: [],
      tiros: [],
    },
    {
      id: 'fase_3', duracion_ms: 1100, pausa_post_ms: 600,
      movimientos: [
        { elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'corte',
          path: [{ x: 0.17, y: 0.50, tipo_nodo: 'lineal' }, { x: 0.40, y: 0.18, tipo_nodo: 'lineal' }] },
      ],
      pases: [],
      bloqueos: [],
      tiros: [
        { jugador_id: 'A3', balon_id: 'balon_1', canasta: 'norte', path: [] },
      ],
    },
  ],
  warnings: [],
};
