/* ============================================================
   ia/validador.js — valida y repara el Intent que devuelve la IA
   (Fase 2b) ANTES de compilarlo a geometría. Un LLM puede alucinar
   ids, tipos de evento o coordenadas: aquí lo inválido se descarta
   o degrada (con warning §8.4) para que al entrenador nunca le
   llegue una animación rota — solo se rinde ({ error }) si tras
   sanear no queda ningún evento utilizable.
   ============================================================ */

import { PISTAS, clamp01 } from '../canvas/court.js';
import { sintetizarJugadores, balonesDelTablero } from './compilador.js';
import { resolverPosicionDetallada, slugPosicion } from './posiciones.js';

const TIPOS = new Set(['bote', 'corte', 'pase', 'tiro', 'bloqueo', 'defiende', 'rodea_cono', 'vuelve_a_fila']);

/**
 * @param intent el objeto { canasta, fases } tal cual llegó de la IA
 * @param opts.posiciones diccionario custom { slug: [x,y] } de ESTA pista
 *        (Supabase + respuestas q_pos_* ya fusionadas por el llamador).
 * @returns { intent, warnings } con el Intent saneado, { preguntas } si hay
 *          posiciones con nombre DESCONOCIDO que el entrenador debe marcar
 *          (tipo A, Tramo 2.3), o { error } si no queda nada utilizable.
 */
export function validarIntent(intent, elementos = [], pista = 'entera', opts = {}) {
  if (!intent || !Array.isArray(intent.fases) || !intent.fases.length) {
    return { error: 'La IA no devolvió una interpretación utilizable. Detalla más el ejercicio y regenera.' };
  }
  const ids = new Set(sintetizarJugadores(elementos).map((j) => j.id));
  const conos = elementos.filter((e) => e.kind === 'cono');
  // id → función del cono, con el MISMO fallback de id (`cono_${i+1}`) que usan
  // la function y el compilador — así un cono sin id sigue siendo direccionable.
  const conoFuncion = new Map(conos.map((c, i) => [c.id || `cono_${i + 1}`, c.funcion || 'decorativo']));
  const warnings = [];
  const drop = (ev, motivo) => warnings.push({
    texto_original: `${ev.tipo || '(sin tipo)'} de ${ev.jugador || '(sin jugador)'}`,
    interpretacion: `evento descartado: ${motivo}`,
    campo: 'evento',
  });

  // canasta ANTES de recorrer eventos: las posiciones con nombre de las
  // pistas de dos aros dependen del lado atacado (el poste bajo de 'norte'
  // no es el de 'sur'). Debe existir en esta pista; si no, la primera
  // válida (con warning) — misma regla de siempre, solo que adelantada.
  const baskets = (PISTAS[pista] && PISTAS[pista].baskets) || {};
  let canasta = intent.canasta;
  if (!canasta || !baskets[canasta]) {
    const fallback = Object.keys(baskets)[0] || 'norte';
    if (canasta) warnings.push({ texto_original: `canasta "${canasta}"`, interpretacion: `no existe en esta pista; se usa "${fallback}"`, campo: 'canasta' });
    canasta = fallback;
  }

  // posiciones con nombre DESCONOCIDO encontradas en `hacia` (ni ANCLAS ni
  // custom): slug → texto original. Al final generan preguntas tipo A
  // ("Marca la posición «X» en la pista") en vez de degradar a canasta.
  const pendientes = new Map();

  // poseedores INICIALES declarados por el modelo (Tramo 3a: intent.balones
  // = [{id, portador}]). Se respetan si balón y portador existen; lo
  // inválido se descarta CON warning y manda la inferencia determinista
  // del compilador (cadena de eventos). Duplicados (mismo balón o mismo
  // portador dos veces): se queda la primera declaración.
  const balonesTablero = balonesDelTablero(elementos);
  const balonIds = new Set(balonesTablero.map((b) => b.id));
  const balonesDecl = [];
  const declPorBalon = new Set();
  const declPortadores = new Set();
  for (const d of (Array.isArray(intent.balones) ? intent.balones : [])) {
    if (!d || typeof d !== 'object') continue;
    if (!balonIds.has(d.id)) {
      warnings.push({ texto_original: `balón "${d.id}"`, interpretacion: 'no existe en el tablero: se ignora su poseedor declarado', campo: 'balon' });
      continue;
    }
    if (!ids.has(d.portador)) {
      warnings.push({ texto_original: `poseedor "${d.portador}" del balón "${d.id}"`, interpretacion: 'jugador inexistente: el poseedor inicial se infiere de los eventos', campo: 'balon' });
      continue;
    }
    if (declPorBalon.has(d.id) || declPortadores.has(d.portador)) continue;
    declPorBalon.add(d.id);
    declPortadores.add(d.portador);
    balonesDecl.push({ id: d.id, portador: d.portador });
  }

  const fases = [];
  // posesión SOLO para avisar (§8.4) de tiros sin recepción previa, ahora
  // con N balones: mismo criterio que la cadena del compilador — quien
  // bota/pasa/tira sin balón "toma" uno si queda alguno libre (sin aviso);
  // el pase transfiere; el tiro lo suelta (el siguiente de una serie puede
  // coger el rebote sin falso aviso). Solo el TIRO sin balón disponible
  // avisa. La geometría NO se corrige aquí: es aviso, no reparación.
  const conBalon = new Set(balonesDecl.map((d) => d.portador));
  const nBalones = balonesTablero.length;
  for (const f of intent.fases) {
    const eventos = [];
    const movidos = new Set(); // jugadores con bote/corte YA aceptado esta fase
    // eventos truthy pero no-array ({}, 42, 'hola'…): la fase se trata como
    // sin eventos (con warning) en vez de crashear el for-of / iterar chars.
    const lista = Array.isArray(f && f.eventos) ? f.eventos : [];
    if (f && f.eventos && !Array.isArray(f.eventos)) {
      warnings.push({ texto_original: 'fase con "eventos" malformados', interpretacion: 'fase descartada: no es una lista de eventos', campo: 'fase' });
    }
    for (const raw of lista) {
      if (!raw || typeof raw !== 'object') continue;
      const ev = {
        jugador: raw.jugador, tipo: raw.tipo,
        hacia: raw.hacia ?? null, a: raw.a ?? null, cono_id: raw.cono_id ?? null,
        marca: raw.marca ?? null, bloqueado_id: raw.bloqueado_id ?? null,
      };
      if (!TIPOS.has(ev.tipo)) { drop(ev, 'acción desconocida'); continue; }
      if (!ids.has(ev.jugador)) { drop(ev, 'jugador inexistente en el tablero'); continue; }
      if (ev.tipo === 'pase' && !ids.has(ev.a)) { drop(ev, 'receptor inexistente'); continue; }
      if (ev.tipo === 'bloqueo' && !ids.has(ev.bloqueado_id)) { drop(ev, 'bloqueado inexistente'); continue; }
      // auto-eventos: pasarse/bloquearse/marcarse a uno mismo no es una acción.
      if (ev.tipo === 'pase' && ev.a === ev.jugador) { drop(ev, 'un jugador no puede pasarse el balón a sí mismo'); continue; }
      if (ev.tipo === 'bloqueo' && ev.bloqueado_id === ev.jugador) { drop(ev, 'un jugador no puede bloquearse a sí mismo'); continue; }
      if (ev.tipo === 'defiende' && ev.marca === ev.jugador) { drop(ev, 'un jugador no puede marcarse a sí mismo'); continue; }
      if (ev.tipo === 'rodea_cono') {
        const fn = conoFuncion.get(ev.cono_id);
        if (fn === undefined) { drop(ev, 'cono inexistente'); continue; }
        if (fn !== 'rodear') { drop(ev, `el cono no es de rodear (función "${fn}")`); continue; }
      }
      // doble movimiento del mismo jugador en la misma fase: el motor indexa
      // por elemento y el segundo machacaría al primero → se queda el PRIMERO.
      if (ev.tipo === 'bote' || ev.tipo === 'corte') {
        if (movidos.has(ev.jugador)) { drop(ev, 'el jugador ya tiene un movimiento en esta fase'); continue; }
        movidos.add(ev.jugador);
      }
      // "defiende" con marca fantasma se degrada, no se descarta: el rol de
      // defensor sigue contando (fase.defensores), solo que no se moverá.
      if (ev.tipo === 'defiende' && ev.marca && !ids.has(ev.marca)) ev.marca = null;
      // destino explícito: números finitos, recortados a [0,1]; si no, a canasta.
      if (ev.hacia && typeof ev.hacia === 'object') {
        const fx = Number(ev.hacia.x), fy = Number(ev.hacia.y);
        ev.hacia = (Number.isFinite(fx) && Number.isFinite(fy)) ? { x: clamp01(fx), y: clamp01(fy) } : 'canasta';
      } else if (typeof ev.hacia === 'string' && ev.hacia !== 'canasta') {
        // posición con nombre (Tramo 2.2): custom del entrenador primero,
        // luego las ANCLAS medidas. Un nombre lateral sin lado ("la
        // esquina") resuelve a la DERECHA con aviso (es interpretación).
        const r = resolverPosicionDetallada(pista, ev.hacia, canasta, opts.posiciones || null);
        if (r) {
          if (r.ladoPorDefecto) {
            warnings.push({ texto_original: `hacia "${ev.hacia}"`, interpretacion: `sin lado especificado: se usa "${r.clave}" (lado derecho)`, campo: 'posicion' });
          }
          ev.hacia = { x: clamp01(r.xy[0]), y: clamp01(r.xy[1]) };
        } else {
          // desconocida de verdad: ambigüedad REAL → pregunta tipo A
          // (Tramo 2.3), nunca degradar a canasta en silencio. Se apunta y
          // se sigue saneando (si aparece varias veces, UNA sola pregunta).
          const slug = slugPosicion(ev.hacia);
          if (slug) { if (!pendientes.has(slug)) pendientes.set(slug, String(ev.hacia)); }
          ev.hacia = 'canasta'; // que no quede un string colgando si alguien compila igualmente
        }
      } else if (ev.hacia != null && ev.hacia !== 'canasta') {
        // escalar no-string (42, true…): sin significado posicional — se
        // degrada CON warning, como siempre.
        warnings.push({ texto_original: `hacia "${ev.hacia}"`, interpretacion: `destino no reconocido, se dirige a canasta`, campo: 'hacia' });
        ev.hacia = 'canasta';
      }
      // aviso de posesión (ver comentario de `conBalon` arriba)
      if (ev.tipo === 'bote' || ev.tipo === 'pase' || ev.tipo === 'tiro') {
        if (!conBalon.has(ev.jugador)) {
          if (conBalon.size < nBalones) conBalon.add(ev.jugador); // toma un balón libre
          else if (ev.tipo === 'tiro') {
            warnings.push({ texto_original: `tiro de ${ev.jugador}`, interpretacion: `${ev.jugador} tira sin haber recibido el balón`, campo: 'posesion' });
          }
        }
        if (ev.tipo === 'pase') { conBalon.delete(ev.jugador); conBalon.add(ev.a); }
        if (ev.tipo === 'tiro') conBalon.delete(ev.jugador); // el balón vuela al aro
      }
      eventos.push(ev);
    }
    if (!eventos.length) continue; // fases que quedan vacías al sanear: fuera
    // fase muerta: ningún evento produce geometría (defiende con marca null no
    // mueve a nadie; rodea_cono sin bote/corte del mismo jugador se ignora en
    // el compilador) → segundos de animación donde no pasa nada. Fuera, con aviso.
    const produce = eventos.some((e) =>
      e.tipo === 'bote' || e.tipo === 'corte' || e.tipo === 'pase' || e.tipo === 'tiro'
      || e.tipo === 'bloqueo' || e.tipo === 'vuelve_a_fila' || (e.tipo === 'defiende' && e.marca));
    if (!produce) {
      warnings.push({ texto_original: 'fase sin acción visible', interpretacion: 'fase descartada: ninguno de sus eventos produce movimiento', campo: 'fase' });
      continue;
    }
    fases.push({ eventos });
  }
  if (!fases.length) return { error: 'Ninguna acción de la IA encaja con este tablero. Revisa la descripción y regenera.' };

  // posiciones desconocidas pendientes: el entrenador las marca con un clic
  // (pregunta tipo A — paso2.js#askOne ya lo soporta) y paso2 las persiste
  // en Supabase (guardarPosicion) para reutilizarlas. El id q_pos_<slug> es
  // estable: el dedupe de rondas de paso2 no re-pregunta lo respondido.
  if (pendientes.size) {
    return {
      preguntas: [...pendientes].map(([slug, original]) => ({
        id: `q_pos_${slug}`, tipo: 'A',
        texto: `Marca la posición «${original}» en la pista`,
        nombre: slug,
      })),
    };
  }

  return { intent: { canasta, fases, ...(balonesDecl.length ? { balones: balonesDecl } : {}) }, warnings };
}
