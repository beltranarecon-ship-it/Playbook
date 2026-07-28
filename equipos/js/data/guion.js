/* ============================================================
   guion.js — motor PURO que traduce una animación del Taller a una
   explicación en castellano, fase a fase ("el 3 bota hacia el codo
   derecho · pasa al 5 · el 5 tira desde el poste bajo izquierdo").

   Por qué existe: en el planificador el entrenador ve la animación,
   pero una animación muda no se puede leer de un vistazo ni dictar a
   un ayudante. El guion la pone en palabras SIN llamar a ningún
   modelo: se deriva de la geometría ya compilada (fases, paths,
   pases, tiros), así que cuesta 0 € y siempre dice lo mismo para la
   misma animación — decisión congelada de v1 (coste de API cero).

   Sin DOM, sin red: lo importan el visor del planificador y el banco
   Node (equipos/tools/eval-guion.mjs). La única dependencia es la
   tabla de ANCLAS medidas del Taller, que es un objeto de datos puro.
   ============================================================ */

import { posicionesDe } from '../../../taller/js/canvas/anclas.js';

/* ── Nombres de zona ──────────────────────────────────────────
   Se escriben ENTEROS (con artículo y género ya resueltos) en vez de
   componer "base + lado": en castellano "la esquina izquierda" y "el
   codo izquierdo" no comparten terminación, y una tabla plana es más
   barata de leer que un motor de concordancia. */
const ZONA = {
  aro:            'el aro',
  tiro_libre:     'la línea de tiros libres',
  base:           'la punta',
  centro:         'el centro del campo',
  poste_bajo_izq: 'el poste bajo izquierdo',
  poste_bajo_der: 'el poste bajo derecho',
  poste_alto_izq: 'el poste alto izquierdo',
  poste_alto_der: 'el poste alto derecho',
  codo_izq:       'el codo izquierdo',
  codo_der:       'el codo derecho',
  escolta_izq:    'el 45 izquierdo',
  escolta_der:    'el 45 derecho',
  alero_izq:      'el alero izquierdo',
  alero_der:      'el alero derecho',
  esquina_izq:    'la esquina izquierda',
  esquina_der:    'la esquina derecha',
};

/* Radio de "esto ES esa zona", en coordenadas normalizadas [0-1] del
   lienzo. 0.09 ≈ 2,5 m en una pista entera: más lejos, nombrar la zona
   sería mentir, y preferimos no decir nada a decir algo falso. */
const RADIO_ZONA = 0.09;

/** Nombre humano de la zona más cercana a un punto, o null si ninguna
 *  ancla queda dentro del radio. Exportada para el banco de pruebas. */
export function zonaDe(pista, canasta, punto) {
  if (!punto) return null;
  const anclas = posicionesDe(pista || 'entera', canasta || 'norte');
  if (!anclas) return null;
  let mejor = null, mejorD = Infinity;
  for (const [slug, xy] of Object.entries(anclas)) {
    if (!ZONA[slug]) continue;
    const d = Math.hypot(punto.x - xy[0], punto.y - xy[1]);
    // empate: gana el slug alfabéticamente menor → guion determinista
    if (d < mejorD || (d === mejorD && slug < mejor)) { mejorD = d; mejor = slug; }
  }
  return mejorD <= RADIO_ZONA ? ZONA[mejor] : null;
}

/* ── Nombres de jugador ─────────────────────────────────────── */

const soloDigitos = (s) => String(s).match(/\d+/)?.[0] ?? String(s);

/** Etiqueta corta de un jugador: dorsal si lo tiene, si no los dígitos
 *  de su id ('A3' → '3'). Es la MISMA que pinta el motor sobre la
 *  ficha, así que lo que se lee casa con lo que se ve. */
export function etiquetaJugador(j) {
  return String(j?.dorsal ?? soloDigitos(j?.id ?? '?'));
}

const EQUIPO_ORDINAL = { A: '1', B: '2', C: '3', D: '4' };

/**
 * Referencias de todos los jugadores, resueltas de una vez para poder
 * DESAMBIGUAR: si el 3 existe en dos equipos, ambos pasan a llamarse
 * "el 3 del equipo 1" / "el 3 del equipo 2"; si no hay choque, se
 * quedan en "el 3" (más corto y es como habla un entrenador).
 * Un jugador con nombre propio siempre gana: "Marcos".
 */
function referencias(jugadores) {
  const veces = new Map();
  for (const j of jugadores) {
    const e = etiquetaJugador(j);
    veces.set(e, (veces.get(e) || new Set()).add(j.equipo || 'A'));
  }
  const ref = new Map();
  for (const j of jugadores) {
    const nombre = String(j.nombre || '').trim();
    if (nombre) { ref.set(j.id, { txt: nombre, propio: true }); continue; }
    const e = etiquetaJugador(j);
    const ambiguo = (veces.get(e)?.size ?? 0) > 1;
    const eq = EQUIPO_ORDINAL[j.equipo] || '1';
    ref.set(j.id, { txt: ambiguo ? `el ${e} del equipo ${eq}` : `el ${e}`, propio: false });
  }
  return ref;
}

/* "a" + "el 5" en castellano es "al 5". Los nombres propios no
   contraen ("a Marcos"), por eso la marca `propio`. */
const aRef = (r) => (r ? (r.txt.startsWith('el ') ? `al ${r.txt.slice(3)}` : `a ${r.txt}`) : 'a otro jugador');
const deRef = (r) => (r ? (r.txt.startsWith('el ') ? `del ${r.txt.slice(3)}` : `de ${r.txt}`) : 'de otro jugador');
const txt = (r) => (r ? r.txt : 'un jugador');

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const nodoFin = (path) => (path?.length ? path[path.length - 1] : null);
const nodoIni = (path) => (path?.length ? path[0] : null);

/* ── Reconstrucción de la posesión ───────────────────────────
   Quién lleva cada balón al EMPEZAR cada fase. Es la misma cadena que
   sigue el motor de animación (engine._build): arranca en
   balon.portador_id y cambia con los pases (nuevo dueño) y los tiros
   (el balón vuela: nadie lo lleva). Sin esto no se puede decir "bota"
   frente a "corta". */
function posesionPorFase(anim) {
  const owner = {};
  for (const b of anim.balones || []) owner[b.id] = b.portador_id || null;
  const porFase = [];
  for (const f of anim.fases || []) {
    porFase.push({ ...owner });
    for (const p of f.pases || []) owner[p.balon_id] = p.a_id || null;
    for (const t of f.tiros || []) owner[t.balon_id] = null;
  }
  return porFase;
}

/* ── Guion ───────────────────────────────────────────────────── */

/**
 * Explicación fase a fase de una animación.
 * @param anim JSON §10 del Taller ({pista, jugadores, balones, conos, fases})
 * @returns {{
 *   vacio: boolean,                       // sin fases que narrar
 *   resumen: {jugadores, porEquipo, balones, conos, filas, fases, duracionSeg, pista},
 *   fases: [{ n, ms, lineas: string[] }]  // n empieza en 1
 * }}
 */
export function guionDeAnimacion(anim) {
  const a = anim || {};
  const jugadores = a.jugadores || [];
  const balones = a.balones || [];
  const conos = a.conos || [];
  const fases = a.fases || [];
  const pista = a.pista || 'entera';
  const canastaGlobal = a.canasta || 'norte';

  const ref = referencias(jugadores);
  const porEquipo = {};
  for (const j of jugadores) porEquipo[j.equipo || 'A'] = (porEquipo[j.equipo || 'A'] || 0) + 1;

  // Los conos de tipo 'fila' son colas de espera, no material suelto:
  // se cuentan aparte porque el entrenador los prepara distinto.
  const filas = conos.filter((c) => c.funcion === 'fila').length;

  const resumen = {
    jugadores: jugadores.length,
    porEquipo,
    balones: balones.length,
    conos: conos.length - filas,
    filas,
    fases: fases.length,
    duracionSeg: Math.round(fases.reduce((s, f) => s + (f.duracion_ms || 0) + (f.pausa_post_ms ?? 0), 0) / 1000),
    pista,
  };

  if (!fases.length) return { vacio: true, resumen, fases: [] };

  const posesion = posesionPorFase(a);

  const guionFases = fases.map((f, k) => {
    const lineas = [];
    const defensores = new Set(f.defensores || []);
    const lleva = new Set(
      Object.entries(posesion[k] || {}).filter(([, id]) => id).map(([, id]) => id)
    );

    // 1) bloqueos: van primero porque explican el movimiento que sigue
    for (const b of f.bloqueos || []) {
      lineas.push(`${txt(ref.get(b.bloqueador_id))} bloquea para ${txt(ref.get(b.bloqueado_id))}`);
    }

    // 2) movimientos de jugador
    for (const m of f.movimientos || []) {
      if (m.tipo_elemento === 'balon') continue;      // el balón se narra en pases/tiros
      const r = ref.get(m.elemento_id);
      const destino = zonaDe(pista, canastaGlobal, nodoFin(m.path));
      const hacia = destino ? ` hacia ${destino}` : '';
      const verbo = defensores.has(m.elemento_id)
        ? 'ajusta el marcaje'
        : (m.tipo_movimiento === 'carrera_con_balon' || lleva.has(m.elemento_id))
          ? 'bota'
          : 'corta';
      lineas.push(`${txt(r)} ${verbo}${hacia}`);
    }

    // 3) pases
    for (const p of f.pases || []) {
      const de = ref.get(p.de_id);
      const para = ref.get(p.a_id);
      const donde = zonaDe(pista, canastaGlobal, nodoFin(p.path));
      // sin de_id (animaciones editadas a mano) el pase se narra en pasiva
      const base = de ? `${txt(de)} pasa ${aRef(para)}` : `el balón va ${aRef(para)}`;
      lineas.push(donde ? `${base}, que recibe en ${donde}` : base);
    }

    // 4) tiros
    for (const t of f.tiros || []) {
      const r = ref.get(t.jugador_id);
      const desde = zonaDe(pista, t.canasta || canastaGlobal, nodoIni(t.path));
      lineas.push(r
        ? `${txt(r)} tira${desde ? ` desde ${desde}` : ' a canasta'}`
        : `tiro a canasta${desde ? ` desde ${desde}` : ''}`);
    }

    return {
      n: k + 1,
      ms: (f.duracion_ms || 0) + (f.pausa_post_ms ?? 0),
      lineas: lineas.map(capital),
    };
  });

  return { vacio: false, resumen, fases: guionFases };
}

/** Línea de material para la cabecera del visor: "5 jugadores · 1 balón
 *  · 2 filas". Omite lo que vale cero en vez de escribir "0 conos". */
export function resumenMaterial(resumen) {
  if (!resumen) return '';
  const plural = (n, uno, muchos) => `${n} ${n === 1 ? uno : muchos}`;
  return [
    resumen.jugadores ? plural(resumen.jugadores, 'jugador', 'jugadores') : null,
    resumen.balones ? plural(resumen.balones, 'balón', 'balones') : null,
    resumen.conos ? plural(resumen.conos, 'cono', 'conos') : null,
    resumen.filas ? plural(resumen.filas, 'fila', 'filas') : null,
  ].filter(Boolean).join(' · ');
}
