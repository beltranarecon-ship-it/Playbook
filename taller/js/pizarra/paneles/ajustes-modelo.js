/* ============================================================
   pizarra/paneles/ajustes-modelo.js — qué enseña la pestaña «Ajustes»
   (§2.4) según lo seleccionado. Hoy, solo lo de la defensa (§8).

   Módulo PURO: sin DOM. Lo prueba en Node taller/tools/eval-ajustes.mjs.
   El panel (paneles/derecha.js) solo pinta lo que sale de aquí.

     nada seleccionado   los ajustes de la defensa del EJERCICIO: quién
                         ataca, la regla, la situación y los números
     un defensor         a quién defiende y con qué regla, y por qué está
                         ahí (§8.7)
     un atacante         quién le defiende
     otra cosa           una línea que dice dónde están los ajustes
   ============================================================ */

import {
  REGLAS, NOMBRE_REGLA, SITUACIONES, PARAMETROS, parametrosDe, defensaPorDefecto, quienAtaca, situacionDe,
  ACCIONES_DEFENSOR, SENALA,
} from '../motor/defensa.js';
import { EQUIPOS } from '../elementos.js';
import { CATALOGO_SISTEMA } from '../../ia/acciones.js';

/* Cómo se llama cada cosa que un defensor puede hacer distinto (§8.5).
   Sale del catálogo compartido: escribir aquí los nombres otra vez sería
   tener dos vocabularios. */
export const NOMBRE_ACCION = Object.fromEntries(CATALOGO_SISTEMA
  .filter((a) => ACCIONES_DEFENSOR.includes(a.slug))
  .map((a) => [a.slug, a.nombre]));

export const NOMBRE_EQUIPO = { A: 'Equipo 1', B: 'Equipo 2', C: 'Equipo 3', D: 'Equipo 4' };
export const NOMBRE_SITUACION = {
  igualdad: 'Igualdad',
  inferioridad: 'Inferioridad: menos defensores',
  superioridad: 'Superioridad: más defensores',
};

/** Los números ajustables, en el orden en que se enseñan y con su nombre. */
export const NUMEROS = [
  ['par_con_balon', 'Entre su par y el aro, con balón'],
  ['par_sin_balon', 'Entre su par y el aro, sin balón'],
  ['presion', 'Presión al balón'],
  ['niega_paso', 'Negar: paso hacia el balón'],
  ['niega_hasta', 'Negar: solo si su par está a menos de'],
  ['flota_hasta', 'Ayuda y flota: hasta'],
  ['retrasa_zona_tiro', 'Retrasa: zona de tiro'],
  ['trampa', 'Trampa: separación'],
  ['sobrepasado', 'Es sobrepasado: le persigue a'],
  ['cierra_rebote', 'Cierra el rebote: a'],
  ['bloqueo', 'Bloqueo: pegado al defensor, a'],
];

const opcion = (valor, nombre) => ({ valor, nombre });

/**
 * @param seleccion   ids seleccionados
 * @param elementos   la escena, con sus datos de defensa
 * @param papeles     los de la fase que se edita
 * @param defensa     los ajustes del ejercicio
 * @param nombreDe    (elemento) => cómo se le llama («A1»)
 * @param explicacion la frase de por qué está ahí el defensor, si lo es
 * @param puertas     [[a, b]] las puertas de la fase que se edita (§7.4.1)
 */
/* Las cadencias que se ofrecen para una fila por rondas (§7.4.2). */
const CADENCIAS = [1000, 1500, 2000, 2500, 3000, 4000, 5000];
const segundosDe = (ms) => `${String(ms / 1000).replace('.', ',')} s`;

export function modeloAjustes({
  seleccion = [], elementos = [], papeles = null, defensa = null, nombreDe = (e) => e.id, explicacion = null,
  puertas = [],
} = {}) {
  const d = defensa || defensaPorDefecto();
  const p = papeles || { ataca: null, atacantes: [], defensores: [], pares: {}, situacion: null };
  const porId = new Map((elementos || []).filter(Boolean).map((e) => [e.id, e]));
  const nombre = (id) => (porId.has(id) ? nombreDe(porId.get(id)) : id);
  const elegidos = (seleccion || []).map((id) => porId.get(id)).filter(Boolean);

  if (!elegidos.length) {
    /* Los equipos que hay en la pista, y el forzado aunque se haya quedado
       sin nadie: si no, el desplegable enseñaría otra opción y no habría
       forma de volver a la elegida. */
    const hay = EQUIPOS.filter((eq) => (elementos || []).some((e) => e && e.kind === 'jugador' && (e.equipo || 'A') === eq));
    const equipos = d.ataca && d.ataca !== 'nadie' && !hay.includes(d.ataca) ? [...hay, d.ataca] : hay;
    /* Quién atacaría solo: el de los papeles, que cuenta la posesión AL
       EMPEZAR. Mirando las fichas de la pista saldría la de después de lo
       dibujado, que no es la que manda. */
    const solo = d.ataca == null ? p.ataca : quienAtaca({ elementos, defensa: { ...d, ataca: null } });
    const calculada = situacionDe({ atacantes: p.atacantes, defensores: p.defensores, defensa: null });
    const numeros = parametrosDe(d);
    return {
      tipo: 'ejercicio',
      ataca: {
        valor: d.ataca,
        opciones: [
          opcion(null, `El que tiene el balón${solo ? ` (${NOMBRE_EQUIPO[solo]})` : ' (ahora mismo, nadie)'}`),
          ...equipos.map((eq) => opcion(eq, hay.includes(eq) ? NOMBRE_EQUIPO[eq] : `${NOMBRE_EQUIPO[eq]} (no hay nadie)`)),
          opcion('nadie', 'Nadie defiende'),
        ],
      },
      preajuste: { valor: d.preajuste, opciones: REGLAS.map((r) => opcion(r, NOMBRE_REGLA[r])) },
      situacion: {
        valor: d.situacion,
        opciones: [
          opcion(null, `La que toque${calculada ? ` (${NOMBRE_SITUACION[calculada].split(':')[0].toLowerCase()})` : ''}`),
          ...SITUACIONES.map((s) => opcion(s, NOMBRE_SITUACION[s])),
        ],
      },
      numeros: NUMEROS.map(([clave, texto]) => ({
        clave, nombre: texto, valor: numeros[clave], porDefecto: PARAMETROS[clave],
        cambiado: Object.prototype.hasOwnProperty.call(d.parametros || {}, clave),
      })),
      resumen: p.defensores.length
        ? `Defiende${p.defensores.length > 1 ? 'n' : ''} ${p.defensores.length} · ${NOMBRE_SITUACION[p.situacion].split(':')[0].toLowerCase()}`
        : 'Ahora mismo no defiende nadie.',
    };
  }

  /* Quien ESPERA en una fila no tiene papel: enseña la fila de su cono
     (más abajo). El que sale, sí, y tiene su panel de jugador. */
  const esperando = elegidos.length === 1 && elegidos[0].kind === 'jugador'
    && elegidos[0].fila_de && elegidos[0].en_juego === false;
  if (elegidos.length === 1 && elegidos[0].kind === 'jugador' && !esperando) {
    const j = elegidos[0];
    if (p.defensores.includes(j.id)) {
      const actual = p.pares[j.id] ?? null;
      /* Lo que hace DISTINTO en esta fase (§8.5). Las que hay que señalar
         a alguien se eligen pinchándole en la pista, así que aquí solo
         salen para verlas y para quitarlas. */
      const dicha = (p.acciones || {})[j.id] || null;
      const suelta = ACCIONES_DEFENSOR.filter((a) => !SENALA[a]);
      const hace = {
        valor: dicha ? dicha.accion : null,
        opciones: [
          opcion(null, 'Defender a su par'),
          ...suelta.map((a) => opcion(a, NOMBRE_ACCION[a] || a)),
          ...(dicha && SENALA[dicha.accion]
            ? [opcion(dicha.accion, `${NOMBRE_ACCION[dicha.accion]}${dicha.objetivo_id ? ` ${nombre(dicha.objetivo_id)}` : ''}`)]
            : []),
        ],
      };
      return {
        tipo: 'defensor',
        id: j.id,
        nombre: nombreDe(j),
        hace,
        par: {
          valor: j.defiende_a ?? null,
          opciones: [
            opcion(null, `El que le toque${!j.defiende_a ? (actual ? ` (${nombre(actual)})` : ' (ahora, ninguno)') : ''}`),
            ...p.atacantes.map((id) => opcion(id, nombre(id))),
          ],
        },
        regla: {
          valor: j.regla_defensa ?? null,
          opciones: [opcion(null, `La del ejercicio (${NOMBRE_REGLA[d.preajuste]})`), ...REGLAS.map((r) => opcion(r, NOMBRE_REGLA[r]))],
        },
        explicacion,
      };
    }
    if (p.atacantes.includes(j.id)) {
      const defensor = Object.keys(p.pares).find((k) => p.pares[k] === j.id);
      return { tipo: 'atacante', id: j.id, nombre: nombreDe(j), defensor: defensor ? nombre(defensor) : null };
    }
    return {
      tipo: 'sinPapel',
      id: j.id,
      nombre: nombreDe(j),
      texto: p.ataca
        ? `${nombreDe(j)} no está en juego: ni ataca ni defiende.`
        : 'Nadie ataca todavía: dale el balón a alguien, o elige quién ataca en los ajustes del ejercicio (sin nada seleccionado).',
    };
  }

  /* UN CONO (§7.4): qué papel le da lo dibujado. De momento, si forma
     una puerta, con quién —y cómo deshacerla, que es lo que pide el
     §7.4.1—. */
  /* Uno que ESPERA EN UNA FILA se configura desde su cono: el panel
     enseña la fila. */
  const cola = elegidos.length === 1 && elegidos[0].kind === 'jugador' && elegidos[0].fila_de
    ? porId.get(elegidos[0].fila_de) : null;
  if (elegidos.length === 1 && (elegidos[0].kind === 'cono' || (cola && cola.fila))) {
    const c = elegidos[0].kind === 'cono' ? elegidos[0] : cola;
    const par = (puertas || []).find((p) => p.includes(c.id));
    const otro = par ? par.find((id) => id !== c.id) : null;
    const f = c.fila || null;
    /* Las otras filas, por si se vuelve a otra cola (§7.4.2). */
    const otras = (elementos || []).filter((e) => e && e.kind === 'cono' && e.fila && e.id !== c.id);
    return {
      tipo: 'cono',
      id: c.id,
      nombre: nombreDe(c),
      puerta: otro ? { con: otro, nombre: nombre(otro) } : null,
      texto: f
        ? `Es una fila de ${f.n}: el primero sale y los demás esperan detrás, sin dorsal.`
        : otro
          ? `Forma una puerta con ${nombre(otro)}: el que la cruza pasa por dentro.`
          : 'Un cono se rodea, hace de slalom o de puerta según por dónde pase el trazo. Y puede ser una fila.',
      fila: f ? {
        n: { valor: String(f.n), opciones: Array.from({ length: 12 }, (_, i) => opcion(String(i + 1), String(i + 1))) },
        equipo: { valor: f.equipo, opciones: EQUIPOS.map((eq) => opcion(eq, NOMBRE_EQUIPO[eq])) },
        papel: { valor: f.papel, opciones: [opcion('atacante', 'Atacan'), opcion('defensor', 'Defienden')] },
        balon: { valor: f.balon ? 'si' : 'no', opciones: [opcion('no', 'Sin balón'), opcion('si', 'Un balón por cabeza')] },
        orientacion: {
          valor: String(f.orientacion),
          opciones: Array.from({ length: 24 }, (_, i) => opcion(String(i * 15), `${i * 15}°`))
            .concat(f.orientacion % 15 ? [opcion(String(f.orientacion), `${Math.round(f.orientacion)}°`)] : []),
        },
        vuelta: {
          valor: f.vuelta,
          opciones: [opcion(null, 'A su propia cola'), ...otras.map((o) => opcion(o.id, `A la de ${nombre(o.id)}`))],
        },
        /* LAS RONDAS (§7.4.2): salen todos, uno tras otro, repitiendo lo
           que se dibuje con el primero; o solo el primero. */
        rondas: {
          valor: f.rondas === false ? 'no' : 'si',
          opciones: [opcion('si', 'Todos, uno tras otro'), opcion('no', 'Solo el primero')],
        },
        cadencia: f.rondas === false ? null : {
          valor: f.cadencia_ms ? String(f.cadencia_ms) : null,
          opciones: [opcion(null, 'Al acabar el anterior'), ...CADENCIAS.map((ms) => opcion(String(ms), `Cada ${segundosDe(ms)}`))]
            .concat(f.cadencia_ms && !CADENCIAS.includes(f.cadencia_ms) ? [opcion(String(f.cadencia_ms), `Cada ${segundosDe(f.cadencia_ms)}`)] : []),
        },
      } : null,
    };
  }

  return { tipo: 'otro', texto: 'Los ajustes de la defensa salen sin nada seleccionado (los del ejercicio) o con un jugador seleccionado.' };
}
