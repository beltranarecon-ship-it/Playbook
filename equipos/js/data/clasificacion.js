/* ============================================================
   clasificacion.js — LA CLASIFICACIÓN DE LA LIGA (Tramo 4.5).
   Este fichero tiene DOS mitades bien separadas:

     · el motor PURO (ordenar, contar puntos, pegar una tabla), que no
       toca la red y lo prueba un banco Node;
     · el cliente de `clasificacion` (migración 029), al final.

   Están juntos porque el motor son cuarenta líneas y partirlo en dos
   ficheros costaría más de leer que de escribir.

   ── POR QUÉ A MANO (decisión #28) ───────────────────────────
   La federación la publica en una web que hoy no sabemos leer. Se copia
   a mano —doce filas cada dos semanas, un minuto— y el día que llegue
   el enlace se rellenan estas mismas filas sin cambiar ni una consulta.

   ── LA POSICIÓN NO SE GUARDA ────────────────────────────────
   Es una consecuencia del orden, no un dato. Guardarla obligaría a
   renumerar doce filas cada vez que se corrige un resultado, y a la
   primera que se olvide la tabla miente. Se calcula al pintar.

   ── LOS PUNTOS DE CLASIFICACIÓN ─────────────────────────────
   En baloncesto son 2 por victoria y 1 por derrota: el que pierde
   también puntúa, y por eso jugar un partido más cambia la tabla
   aunque se pierda. Un módulo que diera 3-0 como en el fútbol
   ordenaría mal media liga.
   ============================================================ */

import { supabase } from './_client.js';

/* ── El motor (puro) ───────────────────────────────────────── */

export const PUNTOS_VICTORIA = 2;
export const PUNTOS_DERROTA = 1;

const n = (x) => { const v = Math.round(Number(x)); return Number.isFinite(v) && v > 0 ? v : 0; };

/** Los puntos de clasificación de una fila: 2 por ganado, 1 por perdido. */
export const puntosDe = (f) => n(f?.ganados) * PUNTOS_VICTORIA + n(f?.perdidos) * PUNTOS_DERROTA;

/** La diferencia de puntos (el «basket average» de toda la vida). */
export const diferenciaDe = (f) => n(f?.puntos_favor) - n(f?.puntos_contra);

/**
 * Ordena la clasificación y le pone la posición.
 *
 * Por puntos, y a igualdad por diferencia y por puntos a favor. El
 * desempate de verdad en una liga es el resultado particular entre los
 * empatados, que el acta de la app no conoce: por eso los empatados
 * salen MARCADOS (`empatadoCon`) en vez de ordenados a ciegas. Poner
 * uno encima de otro sin saberlo sería inventarse la clasificación.
 *
 * @returns [{...fila, pos, puntos, dif, empatadoCon}]
 */
export function ordenar(filas) {
  const conCuentas = (filas || []).map((f) => ({
    ...f, puntos: puntosDe(f), dif: diferenciaDe(f),
  }));
  conCuentas.sort((a, b) => b.puntos - a.puntos
    || b.dif - a.dif
    || n(b.puntos_favor) - n(a.puntos_favor)
    || String(a.nombre || '').localeCompare(String(b.nombre || '')));

  return conCuentas.map((f, i, todas) => ({
    ...f,
    pos: i + 1,
    // empatado a puntos Y a diferencia: ahí manda el particular, que no sabemos
    empatadoCon: todas.filter((o, k) => k !== i && o.puntos === f.puntos && o.dif === f.dif).length,
  }));
}

/** Nuestra fila, si está marcada. */
export const nuestra = (ordenadas) => (ordenadas || []).find((f) => f.es_nuestro) || null;

/**
 * Lo que no cuadra en una fila copiada a mano.
 *
 * Aritmética, como en el acta (4.1): ganados + perdidos tienen que ser
 * los jugados. No se corrige solo — se copió de una pantalla y se
 * arregla mirándola otra vez.
 */
export function descuadres(filas) {
  const out = [];
  for (const f of filas || []) {
    const j = n(f.jugados), g = n(f.ganados), p = n(f.perdidos);
    if (g + p !== j) {
      out.push(`${f.nombre}: ${g} ganados y ${p} perdidos son ${g + p}, y pone ${j} jugados.`);
    }
  }
  return out;
}

/**
 * Lee una clasificación pegada de la web de la federación.
 *
 * Una línea por equipo, con los números separados por espacios o
 * tabuladores, y el nombre al principio (con o sin la posición
 * delante). Copiar doce filas a mano son setenta y dos números; pegar
 * la tabla es un gesto.
 *
 * Solo se acepta una línea si trae al menos CINCO números al final:
 * jugados, ganados, perdidos, favor y contra. Con menos no se adivina —
 * una tabla mal leída es peor que copiarla a mano.
 *
 * @returns [{nombre, jugados, ganados, perdidos, puntos_favor, puntos_contra}]
 */
export function leerPegado(texto) {
  const out = [];
  for (const linea of String(texto || '').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t) continue;
    const nums = t.match(/-?\d+/g);
    if (!nums || nums.length < 5) continue;
    const cinco = nums.slice(-5).map(Number);
    /* El nombre es lo que queda al quitar los cinco números del final y
       la posición de delante si la hubiera. */
    let nombre = t;
    for (let k = 0; k < 5; k++) nombre = nombre.replace(/[\s\t]*-?\d+\s*$/, '');
    nombre = nombre.replace(/^\s*\d+[.ºª)\-\s]+/, '').trim();
    if (!nombre) continue;
    const [jugados, ganados, perdidos, puntos_favor, puntos_contra] = cinco;
    out.push({
      nombre,
      jugados: Math.max(0, jugados),
      ganados: Math.max(0, ganados),
      perdidos: Math.max(0, perdidos),
      puntos_favor: Math.max(0, puntos_favor),
      puntos_contra: Math.max(0, puntos_contra),
    });
  }
  return out;
}

/* ── El cliente (migración 029) ────────────────────────────── */

const COLS = 'id, team_id, season_id, nombre, es_nuestro, jugados, ganados, perdidos, puntos_favor, puntos_contra';

let sinTabla = false;

/** Si la 029 está aplicada. La pantalla lo pregunta antes de ofrecer nada. */
export const hayTabla = () => !sinTabla;

const faltaTabla = (error) => {
  if (error?.code === '42P01' || error?.code === 'PGRST205') return true;
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return m.includes('clasificacion') && (m.includes('does not exist') || m.includes('not find'));
};

export async function getClasificacion(teamId, seasonId) {
  let q = supabase.from('clasificacion').select(COLS).eq('team_id', teamId);
  q = seasonId ? q.eq('season_id', seasonId) : q.is('season_id', null);
  const { data, error } = await q;
  if (error) {
    if (faltaTabla(error)) { sinTabla = true; return []; }
    throw error;
  }
  return data ?? [];
}

export async function crearFilas(teamId, seasonId, filas) {
  if (sinTabla) throw new Error('Falta aplicar la migración 029 para guardar la clasificación.');
  const payload = (filas || []).map((f) => ({ ...f, team_id: teamId, season_id: seasonId || null }));
  if (!payload.length) return [];
  const { data, error } = await supabase.from('clasificacion').insert(payload).select(COLS);
  if (error) {
    if (faltaTabla(error)) { sinTabla = true; throw new Error('Falta aplicar la migración 029 para guardar la clasificación.'); }
    throw error;
  }
  return data ?? [];
}

export async function actualizarFila(id, patch) {
  const { error } = await supabase.from('clasificacion').update(patch).eq('id', id);
  if (error && !faltaTabla(error)) throw error;
}

export async function borrarFila(id) {
  const { error } = await supabase.from('clasificacion').delete().eq('id', id);
  if (error && !faltaTabla(error)) throw error;
}

/** Borra la clasificación entera del equipo, para volver a pegarla. */
export async function borrarTodo(teamId, seasonId) {
  let q = supabase.from('clasificacion').delete().eq('team_id', teamId);
  q = seasonId ? q.eq('season_id', seasonId) : q.is('season_id', null);
  const { error } = await q;
  if (error && !faltaTabla(error)) throw error;
}
