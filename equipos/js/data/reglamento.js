/* ============================================================
   reglamento.js — LO QUE EL ACTA DEMUESTRA (Tramo 4.3).
   Módulo PURO: sin DOM, sin red. Aritmética, y nada más que
   aritmética (decisión #29: «reglamento, solo lo comprobable del
   acta»).

   ── QUÉ COMPRUEBA, Y QUÉ NO ────────────────────────────────
   Comprueba lo que se puede DEMOSTRAR con los números del acta:
   cuántos periodos de los cinco primeros jugó cada uno, cuántos
   descansó, cuántos venían inscritos, las faltas de equipo por periodo
   y la diferencia final. No opina sobre el partido, no mira si alguien
   estaba lesionado y no sabe si el árbitro anotó bien: dice qué números
   no encajan con la regla de la categoría.

   ── UNA ALINEACIÓN INDEBIDA SE EXPLICA ─────────────────────
   Cada incumplimiento dice QUIÉN, QUÉ periodos y CUÁL es la regla, en
   ese orden. «Ana jugó 1 de los cinco primeros (solo el P3) y el mínimo
   son 2» se puede llevar al comité; «alineación indebida» no.

   ── Y ANTES DE ACUSAR, SE MIRA SI LA REGLA CABÍA ───────────
   La regla de los dos periodos tiene una aritmética implacable: en
   minibasket hay 5 en pista durante los 5 primeros periodos, o sea 25
   puestos. Si cada jugador puede jugar como mucho 3 —porque tiene que
   descansar 2—, con 8 inscritos solo se llega a 24 y ALGUIEN tiene que
   incumplir. Y con 13 inscritos no hay 26 puestos para dar dos a cada
   uno. Cuando la regla no cabe, se dice eso, que es la verdad, en vez
   de señalar a un crío.

   ── LOS NÚMEROS SON DE LAS BASES DE COMPETICIÓN ────────────
   Cambian por categoría y por temporada, así que viven en una sola
   tabla, `REGLAS`, y la pantalla enseña cuál ha usado. Corregir una
   temporada es tocar aquí y nada más.
   ============================================================ */

import { periodosDe, rejillaDe, enLosPrimeros } from './acta.js';

/**
 * Las reglas de cada categoría.
 *
 * `rotacion: null` significa que en esa categoría no hay obligación de
 * repartir minutos: de infantil para arriba se juega a ganar y el
 * entrenador decide. No es un hueco por rellenar, es la regla.
 */
export const REGLAS = {
  babybasket: { periodos: 6, enPista: 5, rotacion: { deLosPrimeros: 5, jugarMin: 2, descansarMin: 2 }, inscritosMin: 10, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: 50 },
  premini: { periodos: 6, enPista: 5, rotacion: { deLosPrimeros: 5, jugarMin: 2, descansarMin: 2 }, inscritosMin: 10, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: 50 },
  minibasket: { periodos: 6, enPista: 5, rotacion: { deLosPrimeros: 5, jugarMin: 2, descansarMin: 2 }, inscritosMin: 10, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: 50 },
  alevin: { periodos: 6, enPista: 5, rotacion: { deLosPrimeros: 5, jugarMin: 2, descansarMin: 2 }, inscritosMin: 10, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: 50 },
  infantil: { periodos: 4, enPista: 5, rotacion: null, inscritosMin: 5, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: null },
  cadete: { periodos: 4, enPista: 5, rotacion: null, inscritosMin: 5, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: null },
  junior: { periodos: 4, enPista: 5, rotacion: null, inscritosMin: 5, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: null },
  senior: { periodos: 4, enPista: 5, rotacion: null, inscritosMin: 5, inscritosMax: 12, faltasEquipoBonus: 5, topeDiferencia: null },
};

/**
 * Las reglas de una categoría, o null si no la conocemos.
 *
 * Devolver null y callarse es lo correcto: inventarse una regla para
 * una categoría que no está en la tabla acusaría a gente con un número
 * que nadie ha escrito en ningún sitio.
 */
export const reglasDe = (categoria) => REGLAS[String(categoria || '').toLowerCase()] || null;

/* ── ¿Cabía la regla? ──────────────────────────────────────── */

/**
 * Si la regla de rotación es siquiera POSIBLE con esos inscritos.
 *
 * Los puestos que hay que repartir son `enPista × deLosPrimeros`. Cada
 * jugador puede ocupar como mucho `deLosPrimeros − descansarMin` y
 * tiene que ocupar al menos `jugarMin`. De ahí salen los dos límites, y
 * por eso el mínimo y el máximo de inscritos no son un capricho.
 *
 * @returns {posible, porque} — `porque` explica cuál de los dos falla
 */
export function cabeLaRegla(inscritos, reglas) {
  const r = reglas?.rotacion;
  if (!r) return { posible: true, porque: '' };
  const puestos = reglas.enPista * r.deLosPrimeros;
  const techo = r.deLosPrimeros - r.descansarMin;   // lo máximo que puede jugar uno
  if (inscritos * techo < puestos) {
    return {
      posible: false,
      porque: `Con ${inscritos} en el acta no llega: hay ${puestos} puestos en los ${r.deLosPrimeros} primeros periodos y cada uno puede jugar como mucho ${techo}.`,
    };
  }
  if (inscritos * r.jugarMin > puestos) {
    return {
      posible: false,
      porque: `Con ${inscritos} en el acta no cabe: harían falta ${inscritos * r.jugarMin} puestos para dar ${r.jugarMin} a cada uno y solo hay ${puestos}.`,
    };
  }
  return { posible: true, porque: '' };
}

/* ── La comprobación ───────────────────────────────────────── */

const listaPeriodos = (ks) => (ks.length === 1 ? `solo el P${ks[0]}` : `los P${ks.join(', P')}`);

/**
 * Qué dice el acta sobre el reglamento de esta categoría.
 *
 * @param partido   el partido (marcador, faltas de equipo)
 * @param filas     las filas del acta (`acta.filaVacia` + rejilla)
 * @param opts.categoria  la del equipo
 *
 * @returns {
 *   reglas,               // las que se han usado, para poder enseñarlas
 *   inscritos,            // cuántos aparecen en el acta
 *   incumple: [{regla, texto, quien}],   // lo que NO cuadra con la regla
 *   avisa: [{regla, texto}],             // lo que hay que saber, sin ser falta
 *   noSePuede: [texto],                  // lo que el acta no permite mirar
 * }
 */
export function comprobar(partido, filas, { categoria } = {}) {
  const reglas = reglasDe(categoria);
  const incumple = [], avisa = [], noSePuede = [];

  if (!reglas) {
    return {
      reglas: null, inscritos: 0, incumple, avisa,
      noSePuede: [categoria
        ? `No tengo las reglas de la categoría «${categoria}».`
        : 'El equipo no tiene categoría puesta, y las reglas dependen de ella.'],
    };
  }

  const P = periodosDe(partido);
  /* Inscrito = el que aparece en el acta. Una fila en blanco no es un
     jugador que no jugó: es un crío que no vino, y el reglamento no
     habla de los que no vinieron. */
  const enActa = (filas || []).filter((f) => rejillaDe(f).length || f.periodos_jugados || f.puntos || f.faltas);
  const inscritos = enActa.length;

  /* Un acta sin empezar no tiene nada que comprobar, y enumerarle a
     alguien las cuatro cosas que le faltan un sábado por la tarde, antes
     de escribir el primer número, es ruido. Se dice una cosa y se
     calla: el «falta por apuntar» del acta ya lleva esa cuenta. */
  if (!inscritos) {
    return { reglas, inscritos: 0, incumple, avisa, noSePuede: ['El acta no dice todavía quién jugó.'] };
  }

  // ── 1. mínimo de inscritos ──
  if (inscritos < reglas.inscritosMin) {
    incumple.push({
      regla: 'inscritos',
      texto: `En el acta hay ${inscritos} jugador${inscritos === 1 ? '' : 'es'} y el mínimo de la categoría son ${reglas.inscritosMin}.`,
    });
  } else if (inscritos > reglas.inscritosMax) {
    incumple.push({
      regla: 'inscritos',
      texto: `En el acta hay ${inscritos} jugadores y el máximo son ${reglas.inscritosMax}.`,
    });
  }

  // ── 2. la rotación de los primeros periodos ──
  if (reglas.rotacion) {
    const r = reglas.rotacion;
    const conRejilla = enActa.filter((f) => rejillaDe(f).length);
    if (!conRejilla.length) {
      /* Sin saber QUÉ periodos jugó cada uno, la regla de los cinco
         primeros no se puede mirar. Decirlo es la única respuesta
         honesta: un acta dictada al chat (4.2) da el total y no la
         rejilla, y contestar «todo bien» sería mentir. */
      noSePuede.push(`Sin la rejilla de periodos no se puede mirar la regla de los ${r.deLosPrimeros} primeros: marca en qué periodos jugó cada uno.`);
    } else {
      const cabe = cabeLaRegla(inscritos, reglas);
      if (!cabe.posible) {
        /* La regla no cabía: se dice, y NO se señala a nadie. Acusar a
           un crío de una imposibilidad aritmética del equipo entero es
           exactamente el error que este módulo no puede cometer. */
        avisa.push({ regla: 'rotacion', texto: `${cabe.porque} Con esos números la regla no se puede cumplir, así que no miro quién se pasa.` });
      } else {
        if (conRejilla.length < inscritos) {
          noSePuede.push(`Hay ${inscritos - conRejilla.length} jugador(es) del acta sin rejilla: de esos no se puede decir nada.`);
        }
        for (const f of conRejilla) {
          const e = enLosPrimeros(f, r.deLosPrimeros, partido);
          if (!e) continue;
          const suyos = rejillaDe(f).filter((k) => k <= e.de);
          const quien = f.nombre || `dorsal ${f.dorsal ?? '?'}`;
          if (e.jugados < r.jugarMin) {
            incumple.push({
              regla: 'rotacion', quien: f.player_id,
              texto: `${quien} jugó ${e.jugados} de los ${e.de} primeros periodos${suyos.length ? ` (${listaPeriodos(suyos)})` : ''} y el mínimo son ${r.jugarMin}.`,
            });
          }
          if (e.descansados < r.descansarMin) {
            incumple.push({
              regla: 'rotacion', quien: f.player_id,
              texto: `${quien} descansó ${e.descansados} de los ${e.de} primeros periodos y tiene que descansar ${r.descansarMin}.`,
            });
          }
        }
      }
    }
  }

  // ── 3. los cinco en pista ──
  /* No es una regla de reparto: es que en baloncesto hay cinco. Una
     columna que no suma cinco es un acta mal copiada casi siempre, así
     que se avisa y no se acusa. */
  {
    const malas = [];
    for (let k = 1; k <= P; k++) {
      const n = enActa.filter((f) => rejillaDe(f).includes(k)).length;
      if (n && n !== reglas.enPista) malas.push(`P${k} (${n})`);
    }
    if (malas.length) {
      avisa.push({
        regla: 'en_pista',
        texto: `En ${malas.join(', ')} no hay ${reglas.enPista} jugadores marcados. Repasa esas columnas contra el papel.`,
      });
    }
  }

  // ── 4. faltas de equipo ──
  const fe = Array.isArray(partido?.faltas_equipo) ? partido.faltas_equipo : [];
  if (fe.some((c) => Number(c?.favor) || Number(c?.contra))) {
    const nuestros = [], suyos = [];
    fe.forEach((c, i) => {
      if (Number(c?.favor) >= reglas.faltasEquipoBonus) nuestros.push(`P${i + 1}`);
      if (Number(c?.contra) >= reglas.faltasEquipoBonus) suyos.push(`P${i + 1}`);
    });
    /* Llegar al bonus no es una infracción: son tiros libres. Se cuenta
       porque es lo que el entrenador quiere saber el lunes. */
    if (nuestros.length) avisa.push({ regla: 'faltas_equipo', texto: `Llegamos al bonus (${reglas.faltasEquipoBonus} faltas de equipo) en ${nuestros.join(', ')}.` });
    if (suyos.length) avisa.push({ regla: 'faltas_equipo', texto: `El rival llegó al bonus en ${suyos.join(', ')}.` });
  } else if (fe.length) {
    noSePuede.push('Las faltas de equipo por periodo están sin apuntar.');
  }

  // ── 5. la regla de los 50 puntos ──
  if (reglas.topeDiferencia != null) {
    const a = partido?.marcador_favor, b = partido?.marcador_contra;
    if (a != null && b != null) {
      const dif = Math.abs(Number(a) - Number(b));
      if (dif > reglas.topeDiferencia) {
        incumple.push({
          regla: 'tope',
          texto: `El acta dice ${a}-${b}, ${dif} de diferencia, y en esta categoría el marcador no pasa de ${reglas.topeDiferencia}.`,
        });
      }
    } else {
      noSePuede.push('Sin marcador final no se puede mirar la regla de los 50 puntos.');
    }
  }

  return { reglas, inscritos, incumple, avisa, noSePuede };
}

/* ── Cómo se cuenta ────────────────────────────────────────── */

/** El titular del recuadro: verde, ámbar o rojo, en una frase. */
export function veredicto(r) {
  if (!r?.reglas) return { estado: 'sin', texto: r?.noSePuede?.[0] || 'No se puede comprobar.' };
  if (r.incumple.length) {
    return {
      estado: 'incumple',
      texto: `${r.incumple.length} cosa${r.incumple.length === 1 ? '' : 's'} no cuadra${r.incumple.length === 1 ? '' : 'n'} con el reglamento.`,
    };
  }
  /* El acta vacía va ANTES que «a medias»: un acta sin empezar no es
     una comprobación incompleta, es una comprobación que aún no toca, y
     decirle a alguien que «no da para comprobarlo todo» un sábado por
     la tarde, antes de apuntar nada, es ruido. */
  if (!r.inscritos) return { estado: 'sin', texto: 'El acta no dice todavía quién jugó.' };
  if (r.noSePuede.length) return { estado: 'a_medias', texto: 'El acta no da para comprobarlo todo.' };
  return { estado: 'cumple', texto: 'El acta cumple el reglamento de la categoría.' };
}

/** «6 periodos · 5 en pista · 2 de los 5 primeros · 10 a 12 inscritos» */
export function textoReglas(reglas, categoria) {
  if (!reglas) return '';
  const partes = [
    categoria || null,
    `${reglas.enPista} en pista`,
    reglas.rotacion
      ? `${reglas.rotacion.jugarMin} jugados y ${reglas.rotacion.descansarMin} descansados de los ${reglas.rotacion.deLosPrimeros} primeros`
      : 'sin regla de rotación',
    `${reglas.inscritosMin} a ${reglas.inscritosMax} inscritos`,
    reglas.topeDiferencia != null ? `tope de ${reglas.topeDiferencia}` : null,
  ];
  return partes.filter(Boolean).join(' · ');
}
