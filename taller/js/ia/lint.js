/* ============================================================
   ia/lint.js — EL LISTÓN DE LA BIBLIOTECA, en el navegador.

   Dos de las tres capas del control de calidad: la FICHA (campos,
   vocabulario, coherencia) y la GEOMETRÍA (mide la animación ya
   compilada). La tercera —el CONJUNTO: proporciones, huecos de
   cobertura, duplicados— vive en tools/biblioteca/lint.mjs, porque
   solo tiene sentido sobre la biblioteca entera y un ejercicio que se
   está escribiendo no la puede evaluar.

   ── POR QUÉ ESTÁ AQUÍ Y NO EN tools/ ────────────────────────
   Porque el paso 3 enseña, mientras se escribe la ficha, lo que el
   linter va a decir de ella (Tramo 2.12). Y tiene que decir
   EXACTAMENTE lo mismo: dos copias de las reglas serían dos listones,
   y el entrenador vería pasar en el Taller lo que la biblioteca luego
   rechaza.

   La dirección importa. La app no depende de sus herramientas: son
   las herramientas las que importan de la app — igual que lint.mjs ya
   importaba las anclas y la escala de canvas/. Aquí se une el
   vocabulario, que además es el que §3 comparte con las etiquetas,
   los objetivos y la rúbrica.

   Módulo PURO: sin DOM, sin red, sin Node.
   ============================================================ */


import {
  TIPOS, RAMAS, NIVELES, PISTAS, BLOQUE_KEYS, DENSIDAD_KEYS, OPOSICION, PRESION,
  NIVELES_EXIGENCIA, REQUISITOS_OBLIGATORIOS, REQUISITOS_CONDICIONALES,
  DOSIS_UNIDADES, ORGANIZACION_REFERENCIA, tagsDesconocidos,
} from './vocabulario.js';
import { aroExacto } from '../canvas/anclas.js';
import { metrosEntre } from '../canvas/escala.js';
import { limitesCancha } from '../canvas/medidas.js';

/* Una ficha que promete una FINALIZACIÓN: si el texto dice entrada,
   doble ritmo o bandeja, el balón tiene que salir pegado al aro. */
const ES_FINALIZACION = /\bentrada|entradas|doble ritmo|bandeja|finaliza|finalizaci|mano cambiada|termina en el aro|ataca el aro/i;

/* Distancia máxima, en metros REALES, a la que puede soltarse el balón
   en una finalización. Una entrada se termina entre 0,6 y 1,3 m del
   aro; 1,6 deja margen para el paso de más sin dejar pasar un tiro. */
const METROS_ENTRADA = 1.6;

/* Y el techo de un tiro de minibasket. Desde el Tramo 2.1 las pistas
   están a escala real y la distancia es exacta en todo el campo, así
   que este número ya no lleva el margen que llevaba para compensar el
   estirado del dibujo. Sigue siendo un aviso: caza disparates. */
const METROS_TIRO_MAX = 7.5;

/* Dos cajas distintas, y la diferencia importa:

   · la CANCHA — de banda a banda y de fondo a fondo. Salirse de aquí
     ya no es un error: para eso se dibujó la banda de 2 m en el Tramo
     2.1, que es donde va la fila que espera turno. Se avisa, porque
     conviene saberlo, pero es sitio legítimo.
   · el LIENZO — [0,1]. Salirse de aquí sí es un error: la ficha no se
     ve, está recortada fuera del dibujo.

   Se deja holgura para el jugador que saca de banda o de fondo. */
const HOLGURA = 0.04;

function limites(pista) {
  try { return limitesCancha(pista); } catch { return null; }
}

const enRango = (v, [a, b]) => typeof v === 'number' && v >= a - HOLGURA && v <= b + HOLGURA;
const enLienzo = (v) => typeof v === 'number' && v >= -HOLGURA && v <= 1 + HOLGURA;

/* Dos jugadores más cerca que esto se pintan encima y no se lee nada. */
const SEPARACION_MINIMA = 0.035;

/* Una fase de menos de 200 ms no se ve; de más de 8 s aburre y casi
   siempre significa un path mal calculado. */
const FASE_MS = { min: 200, max: 8000 };

/* Cuánto puede alejarse el final de un tiro del centro medido del aro. */
const TOLERANCIA_ARO = 0.06;

/* Una edad donde debería haber un requisito previo (D9). */
const HUELE_A_EDAD = /\b(a[ñn]os?|benjam[ií]n|alev[ií]n|infantil|cadete|junior|escuela|prebenjam[ií]n|sub-?\d+|u\d{1,2})\b/i;
/* ---------- capa 1 · la ficha ---------------------------------- */

export function revisaFicha(f) {
  const errores = [];
  const avisos = [];
  const E = (m) => errores.push(m);
  const A = (m) => avisos.push(m);

  if (!f.name?.trim()) E('sin nombre');
  if (!f.description?.trim()) E('sin `description` (es lo que se ve en la tarjeta y puntúa en las sugerencias)');
  if (!f.objetivos?.trim()) E('sin `objetivos`: qué se entrena y para qué');
  if (!f.descripcion_texto?.trim()) E('sin `descripcion_texto`: organización y desarrollo');
  if (!f.notas?.trim()) E('sin `notas`: puntos clave y errores frecuentes');

  if (!TIPOS.includes(f.type)) E(`type "${f.type}" fuera del vocabulario del Taller`);
  if (!BLOQUE_KEYS.includes(f.category)) E(`category "${f.category}" no es un bloque de contenido`);
  if (!PISTAS.includes(f.tipo_pista)) E(`tipo_pista "${f.tipo_pista}" desconocido`);
  if (!RAMAS.includes(f.categoria_rama)) E(`categoria_rama "${f.categoria_rama}" desconocida`);

  for (const n of f.categoria_nivel || []) {
    if (!(NIVELES[f.categoria_rama] || []).includes(n)) E(`nivel "${n}" no pertenece a la rama ${f.categoria_rama}`);
  }

  if (!(f.difficulty >= 1 && f.difficulty <= 6)) E(`difficulty ${f.difficulty} fuera de 1-6`);
  if (!(f.intensidad >= 1 && f.intensidad <= 5)) E(`intensidad ${f.intensidad} fuera de 1-5`);
  if (!(f.duration_min > 0)) E('duration_min debe ser positiva');
  if (f.duration_max != null && f.duration_min != null && f.duration_max < f.duration_min) {
    E(`duración máxima (${f.duration_max}) menor que la mínima (${f.duration_min})`);
  }

  /* Tags: el campo de más palanca. Un tag fuera de vocabulario saca
     al ejercicio de las sugerencias del planificador (D16). */
  if (!f.tags?.length) E('sin tags — quedaría invisible para el planificador');
  for (const { tag, sugerencia } of tagsDesconocidos(f.tags)) {
    E(`tag "${tag}" fuera del vocabulario${sugerencia ? ` — ¿querías "${sugerencia}"?` : ''}`);
  }

  /* Los tres niveles de exigencia (D8): es lo que sustituye a la edad, y
     por eso es un DATO y no un párrafo. Antes se comprobaba que las tres
     palabras aparecieran en el texto de `variantes`, que pasaba con
     escribir "base" en cualquier sitio; ahora cada escalón tiene que
     existir y decir algo. */
  const niv = f.requisitos?.niveles;
  if (!niv || typeof niv !== 'object') {
    E('faltan los tres niveles de exigencia en `requisitos.niveles` (D8)');
  } else {
    const vacios = NIVELES_EXIGENCIA.filter((n) => !String(niv[n] || '').trim());
    if (vacios.length) E(`niveles de exigencia vacíos: ${vacios.join(', ')} (D8)`);
    /* Tres escalones que dicen lo mismo no son tres escalones. */
    const textos = NIVELES_EXIGENCIA.map((n) => String(niv[n] || '').trim().toLowerCase()).filter(Boolean);
    if (new Set(textos).size < textos.length) E('hay dos niveles de exigencia con el mismo texto (D8)');
    const sobran = Object.keys(niv).filter((k) => !NIVELES_EXIGENCIA.includes(k));
    if (sobran.length) E(`niveles desconocidos: ${sobran.join(', ')} — solo ${NIVELES_EXIGENCIA.join('/')}`);
  }

  /* Requisitos. */
  const r = f.requisitos;
  if (!r || typeof r !== 'object') {
    E('sin `requisitos`');
  } else {
    for (const campo of REQUISITOS_OBLIGATORIOS) {
      if (r[campo] === undefined || r[campo] === null || r[campo] === '') E(`requisitos.${campo} vacío`);
    }
    for (const { campo, cuando, porque } of REQUISITOS_CONDICIONALES) {
      if (cuando(r, f.tags) && !r[campo]) E(`requisitos.${campo} es obligatorio aquí — ${porque}`);
    }
    if (r.densidad && !DENSIDAD_KEYS.includes(r.densidad)) E(`densidad "${r.densidad}" desconocida`);
    if (r.oposicion && !OPOSICION.includes(r.oposicion)) E(`oposicion "${r.oposicion}" fuera de la escala de D19`);
    if (r.presion && !PRESION.includes(r.presion)) E(`presion "${r.presion}" fuera de la escala (${PRESION.join(', ')})`);
    if (r.jugadores_min > r.jugadores_max) E(`jugadores_min (${r.jugadores_min}) mayor que jugadores_max (${r.jugadores_max})`);
    if (r.canastas > 2) E(`canastas ${r.canastas}: el entrenador dispone de 2`);

    /* La organización tiene que ser una RESPUESTA, no una intención.
       El campo existe para que el entrenador sepa qué hacer con doce
       niños delante, así que si no dice el número de referencia y algún
       reparto concreto no sirve: "se puede adaptar al grupo" ocupa una
       línea y deja el problema donde estaba. */
    if (typeof r.organizacion === 'string' && r.organizacion) {
      const o = r.organizacion;
      if (!new RegExp(`\\b${ORGANIZACION_REFERENCIA}\\b`).test(o)) {
        E(`organizacion no dice qué hacer con ${ORGANIZACION_REFERENCIA}: "${o.slice(0, 60)}…"`);
      }
      if (!/\b(grupo|grupos|pareja|parejas|tr[íi]o|tr[íi]os|fila|filas|estaci[óo]n|estaciones|equipo|equipos|reino|reinos|cuadrado|cuadrados|rondo|rondos|pasillo|pasillos|recorrido|recorridos|tri[áa]ngulo|tri[áa]ngulos|t[úu]nel|t[úu]neles|c[íi]rculo|a la vez|cada uno)\b/i.test(o)) {
        A('organizacion no concreta el reparto (grupos, parejas, filas, estaciones…)');
      }
    }

    /* D9 · el "desde cuándo" es un requisito, jamás una edad. */
    if (typeof r.requisito_previo === 'string' && HUELE_A_EDAD.test(r.requisito_previo)) {
      E(`requisito_previo menciona una edad o categoría ("${r.requisito_previo}") — D9 pide saber hacer, no cumplir años`);
    }

    /* D5 · con dos canastas y pista entera no hay excusa para una cola
       larga. No aplica cuando todos trabajan a la vez: ahí no hay cola. */
    const porEstacion = r.jugadores_max / Math.max(1, r.estaciones || 1);
    if (!r.simultaneo && r.oposicion === 'nula' && porEstacion > 8) {
      A(`${r.jugadores_max} jugadores sin oposición y sin declarar estaciones: revisa que no salgan filas de más de 4 (D5)`);
    }

    /* La dosis tiene que caber en la duración declarada. Ojo con la
       unidad: en un juego continuo la cantidad son SEGUNDOS, no
       repeticiones, y confundirlas multiplicaba el trabajo por cuatro. */
    const d = r.dosis;
    if (d && (d.cantidad === undefined || d.cantidad === null)) {
      /* El contrato viejo decía `repeticiones`. Sin este aviso, una ficha
         antigua pasaba entera en silencio: Number(undefined)||0 daba cero
         y el cálculo de si cabe en la duración nunca saltaba. */
      E(`dosis sin \`cantidad\`${d.repeticiones !== undefined ? ' (¿viene del contrato viejo, que la llamaba `repeticiones`?)' : ''}`);
    }
    if (d && f.duration_max) {
      const u = DOSIS_UNIDADES[d.unidad || 'repeticiones'];
      if (!u) {
        E(`dosis.unidad "${d.unidad}" desconocida (${Object.keys(DOSIS_UNIDADES).join(' | ')})`);
      } else {
        const seg = (Number(d.series) || 1) * ((Number(d.cantidad) || 0) * u.segundosPorRepeticion + (Number(d.descanso) || 0));
        if (seg > f.duration_max * 60 * 1.5) {
          A(`la dosis (${d.series}x${d.cantidad} ${u.label}, ${d.descanso}s de descanso) no cabe en ${f.duration_max} min`);
        }
      }
    }
  }

  /* D1 · el analítico introduce, el juego consolida. */
  if ((f.tags || []).includes('analítico') && r?.oposicion === 'real') {
    A('etiquetado como analítico pero con oposición real: revisa la clasificación');
  }

  return { errores, avisos };
}

/* ---------- capa 2 · la geometría ------------------------------ */

export function revisaGeometria(f) {
  const errores = [];
  const avisos = [];
  const a = f.animacion;

  if (!a) { avisos.push('sin animación (montaje pendiente)'); return { errores, avisos }; }
  if (a.pista && a.pista !== f.tipo_pista) errores.push(`la animación es de pista "${a.pista}" y la ficha dice "${f.tipo_pista}"`);

  const lim = limites(a.pista || f.tipo_pista);
  if (!lim) avisos.push(`sin marco medido para la pista "${a.pista || f.tipo_pista}": no se comprueban los límites`);

  /* Dos listas, no una: salirse de la CANCHA es legítimo desde el
     Tramo 2.1 —la banda de 2 m es donde va la fila que espera turno—
     y salirse del LIENZO no lo es nunca, porque la ficha se recorta y
     deja de verse. */
  const enLaBanda = [];
  const fuera = [];
  const mira = (p, qué) => {
    if (!p) return;
    const [x, y] = Array.isArray(p) ? p : [p.x, p.y];
    const donde = `${qué} en (${Number(x).toFixed(2)}, ${Number(y).toFixed(2)})`;
    if (!enLienzo(x) || !enLienzo(y)) { fuera.push(donde); return; }
    if (lim && (!enRango(x, lim.x) || !enRango(y, lim.y))) enLaBanda.push(donde);
  };

  for (const j of a.jugadores || []) mira(j.posicion_inicial, `jugador ${j.id}`);
  for (const c of a.conos || []) mira(c.posicion, `cono ${c.id}`);
  for (const b of a.balones || []) mira(b.posicion_inicial, `balón ${b.id}`);

  /* Jugadores encimados en la salida: se pintan uno sobre otro. */
  const js = a.jugadores || [];
  for (let i = 0; i < js.length; i++) {
    for (let k = i + 1; k < js.length; k++) {
      const [x1, y1] = js[i].posicion_inicial || [];
      const [x2, y2] = js[k].posicion_inicial || [];
      if (x1 == null || x2 == null) continue;
      if (Math.hypot(x1 - x2, y1 - y2) < SEPARACION_MINIMA) {
        avisos.push(`${js[i].id} y ${js[k].id} salen prácticamente encima`);
      }
    }
  }

  /* Conos de fila sin configurar: la cola no se dibuja. */
  for (const c of a.conos || []) {
    if (c.funcion === 'fila' && !c.fila_config) errores.push(`cono ${c.id} es de fila y no tiene fila_config`);
  }

  /* Conos de rodear que nadie rodea. El compilador NO deduce el slalom
     de que haya conos en el tablero: la intención tiene que declarar un
     evento `rodea_cono` por cada uno. Si no, el jugador va en línea
     recta y se los salta — y la ficha promete un slalom que la
     animación no enseña. Un recorrido que de verdad sortea conos tiene
     más de dos nodos. */
  const aRodear = (a.conos || []).filter((c) => c.funcion === 'rodear');
  if (aRodear.length) {
    const haySlalom = (a.fases || []).some((fa) => (fa.movimientos || []).some((m) => (m.path || []).length > 2));
    if (!haySlalom) {
      errores.push(`${aRodear.length} cono(s) de rodear y ningún recorrido los sortea: falta declarar los eventos rodea_cono`);
    }
  }

  const aro = aroExacto(a.pista || f.tipo_pista, a.canasta || 'norte');

  for (const fase of a.fases || []) {
    if (!(fase.duracion_ms >= FASE_MS.min && fase.duracion_ms <= FASE_MS.max)) {
      errores.push(`${fase.id}: duración ${fase.duracion_ms} ms fuera de ${FASE_MS.min}-${FASE_MS.max}`);
    }
    for (const m of fase.movimientos || []) {
      for (const n of m.path || []) mira(n, `${fase.id} · path de ${m.elemento_id}`);
      if ((m.path || []).length < 2) errores.push(`${fase.id}: movimiento de ${m.elemento_id} con menos de dos nodos`);
    }
    for (const p of fase.pases || []) {
      for (const n of p.path || []) mira(n, `${fase.id} · pase ${p.id}`);
      if (p.de_id === p.a_id) errores.push(`${fase.id}: ${p.de_id} se pasa el balón a sí mismo`);
    }
    /* Los tiros tienen que acabar en el aro MEDIDO de esa pista. Es la
       comprobación que cazó el bug histórico de "todas las pistas
       iguales": en las medias el aro está a la izquierda, no arriba. */
    for (const t of fase.tiros || []) {
      const fin = (t.path || []).at(-1);
      if (!fin || !aro) continue;
      const d = Math.hypot(fin.x - aro[0], fin.y - aro[1]);
      if (d > TOLERANCIA_ARO) {
        errores.push(`${fase.id}: el tiro acaba a ${d.toFixed(3)} del aro (tope ${TOLERANCIA_ARO})`);
      }
    }
  }

  const recorta = (l) => `${l.slice(0, 5).join('; ')}${l.length > 5 ? ` y ${l.length - 5} más` : ''}`;
  if (fuera.length) errores.push(`fuera de la pista, ni siquiera se ve: ${recorta(fuera)}`);
  if (enLaBanda.length) avisos.push(`en la banda, fuera de la cancha: ${recorta(enLaBanda)}`);

  /* Animación donde nadie se mueve nunca. A veces es legítimo —una
     serie de tiro desde un sitio fijo— pero casi siempre significa que
     falta la mitad del ejercicio: un "pase y sigue" sin el "sigue" es
     un triángulo de estatuas. Por eso avisa y no falla. */
  if ((a.fases || []).length) {
    const movs = (a.fases || []).reduce((n, fa) => n + (fa.movimientos || []).length, 0);
    if (!movs) avisos.push('nadie se mueve en toda la animación: ¿falta alguna fase de desplazamiento?');
  }

  /* ── Reglas de finalización y de ciclo ─────────────────────────
     Las cuatro salen de defectos que estaban DENTRO de la biblioteca y
     que ninguna comprobación anterior veía, porque todas miraban el
     final del tiro (el balón siempre acaba en el aro) y ninguna miraba
     de DÓNDE sale ni qué pasa después. */

  const pista = a.pista || f.tipo_pista;

  /* 1 · Una entrada tiene que terminar como una entrada.
     Trece fichas llamadas "entrada", "doble ritmo" o "finalización"
     soltaban el balón a 2, 3 y hasta 9 metros del aro: el compilador
     avanza solo una FRACCIÓN del camino con `hacia: 'canasta'`, y para
     llegar de verdad hace falta `hacia: 'aro'`. */
  if (aro && ES_FINALIZACION.test(`${f.name} ${f.description || ''} ${(f.tags || []).join(' ')}`)) {
    for (const fase of a.fases || []) {
      for (const t of fase.tiros || []) {
        const ini = (t.path || [])[0];
        if (!ini) continue;
        const m = metrosEntre(pista, ini, aro);
        if (m > METROS_ENTRADA) {
          errores.push(`${fase.id}: la ficha promete una finalización y el tiro sale a ${m.toFixed(1)} m del aro (tope ${METROS_ENTRADA}); usa hacia: 'aro'`);
        }
      }
    }
  }

  /* 2 · Tiros que ningún alevín puede meter. El tope es generoso a
     propósito: la escala se calibra junto al aro y hacia fuera el
     dibujo se estira, así que un tiro de verdad a 5 m puede medir 6,5
     aquí. Lo que caza son los disparates — un calentamiento que
     terminaba con un tiro a 9,3 m. */
  if (aro) {
    for (const fase of a.fases || []) {
      for (const t of fase.tiros || []) {
        const ini = (t.path || [])[0];
        if (!ini) continue;
        const m = metrosEntre(pista, ini, aro);
        if (m > METROS_TIRO_MAX) avisos.push(`${fase.id}: tiro desde ${m.toFixed(1)} m — muy lejos para minibasket`);
      }
    }
  }

  /* 3 · Un ejercicio de fila que acaba tirando tiene que cerrar el
     ciclo. Si nadie recoge, el balón se queda en el aro y el jugador
     plantado debajo hasta que el bucle lo teletransporta a su sitio:
     el entrenador ve un ejercicio que no se puede repetir. */
  const hayFila = (a.conos || []).some((c) => c.funcion === 'fila');
  const fases = a.fases || [];
  if (hayFila && fases.length) {
    const ultima = fases[fases.length - 1];
    const hayRecogida = fases.some((fa) => (fa.recogidas || []).length);
    if ((ultima.tiros || []).length && !hayRecogida) {
      errores.push('acaba en tiro y nadie recoge el balón: falta el evento recoge (y normalmente el vuelve_a_fila)');
    }
  }

  /* 4 · Fichas dibujadas que no participan en ninguna fase. Puede ser
     legítimo —quien espera su turno en un tiro libre, el compañero que
     solo levanta un brazo— así que avisa. Pero fue lo que destapó dos
     ejercicios de rebote en los que los que NO se movían eran
     justamente los que tenían que ir al rebote. */
  if (fases.length) {
    const actuan = new Set();
    for (const fa of fases) {
      for (const m of fa.movimientos || []) actuan.add(m.elemento_id);
      for (const p of fa.pases || []) { actuan.add(p.de_id); actuan.add(p.a_id); }
      for (const t of fa.tiros || []) actuan.add(t.jugador_id);
      for (const b of fa.bloqueos || []) { actuan.add(b.bloqueador_id); actuan.add(b.bloqueado_id); }
      for (const r of fa.recogidas || []) actuan.add(r.jugador_id);
    }
    const quietos = (a.jugadores || []).filter((j) => !actuan.has(j.id)).map((j) => j.id);
    if (quietos.length) avisos.push(`sin participar en ninguna fase: ${quietos.join(', ')} — ¿es a propósito?`);
  }

  /* 5 · La oposición declarada tiene que estar DIBUJADA.
     `oposicion` había acabado significando dos cosas a la vez: "hay un
     rival" y "esto aprieta". Diez fichas declaraban oposición y no
     tenían un solo defensor que enseñar — el compañero que levanta
     dedos, el que devuelve el rebote, el equipo que tira en la otra
     canasta. Ninguno disputa nada. Lo que aprieta sin oponer vive
     ahora en `presion`, y esta regla impide que vuelvan a mezclarse:
     si la ficha dice que hay oposición, en la pizarra hay un defensor.
     Al revés solo avisa: un defensor dibujado con `oposicion: 'nula'`
     puede ser un compañero al que se le ha puesto peto por claridad. */
  const op = f.requisitos?.oposicion;
  const hayDefensor = (a.jugadores || []).some((j) => j.tipo === 'defensor');
  if (op && op !== 'nula' && !hayDefensor) {
    errores.push(`declara oposicion "${op}" y no hay ningún defensor en la pizarra: o se dibuja, o es presión (${PRESION.join('/')}) y no oposición`);
  }
  if ((!op || op === 'nula') && hayDefensor) {
    avisos.push('oposicion "nula" pero hay un defensor dibujado — ¿es un compañero con peto?');
  }

  return { errores, avisos };
}

/* La capa 3 (el conjunto: invariantes, huecos, duplicados) vive en
   tools/biblioteca/lint.mjs: necesita el mapa de cobertura y solo
   significa algo sobre la biblioteca entera. */
