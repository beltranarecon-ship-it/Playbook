/* ============================================================
   pizarra/ramas.js — las jugadas con ramas (§6.7).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-ramas.mjs.

   ── EL MODELO (§11.1) ───────────────────────────────────────
   Las fases siguen siendo UNA lista plana, y tres campos dicen cómo se
   enlazan:
     · `rama_de`     en la primera fase de una rama, la fase de la que
                     cuelga (el cruce); null en las demás;
     · `rama_nombre` su nombre («si le niegan el pase»), obligatorio;
     · `reune`       las fases de las que se llega a esta cuando no es
                     la de siempre: varias si es continuación común de
                     varias ramas (una reunión), o una sola si lo que la
                     precede ya no es la anterior de la lista.
   Lo demás va por el orden de la lista: una fase sin `rama_de` ni
   `reune` sigue a la anterior. Lo nuevo se pone donde toca para que el
   orden lo siga diciendo, y cuando no puede decirlo —al quitar o separar
   una rama—, lo dice `reune`.

   ── LOS CAMINOS ─────────────────────────────────────────────
   Todo lo que ya sabía de fases —los arranques, los papeles, la
   posesión, la frase, las rondas, el compilador— trabaja sobre una
   SECUENCIA. Con ramas, lo que se le da es un camino: la lista de fases
   de la raíz a donde sea. El principal va siempre por la primera rama
   de cada cruce (§6.7). A una reunión se llega, primero, por el camino
   que va antes al recorrerlos —el principal, si pasa por ella—: desde
   ahí se dibuja, y por los demás se reancla (§6.7: «las posiciones de
   arranque son las de la rama que se esté reproduciendo»).

   Lo decidió el entrenador (2026-09-24): al abrir una rama, lo que ya
   venía detrás pasa a ser la primera; las ramas se ven en árbol; se
   pueden reunir; y en el proyector el cruce espera a que se elija.
   ============================================================ */

/** Como mucho, tres ramas en un cruce (§6.7). */
export const MAX_RAMAS = 3;

/** Como mucho, 64 caminos distintos de principio a fin: cada reunión
 *  multiplica los caminos, y cada uno se compila entero. */
export const MAX_CAMINOS = 64;

/* De dónde viene una fase sin `reune`: de su cruce si empieza una rama;
   si no, de la anterior de la lista. */
function naturalDe(lista, i, ids) {
  const f = lista[i];
  if (f.rama_de != null && ids.has(f.rama_de) && f.rama_de !== f.id) return f.rama_de;
  return i > 0 ? lista[i - 1].id : null;
}

/**
 * EL GRAFO de las fases.
 *
 * @returns { porId, antes, despues, raiz }
 *   antes    { id: [ids] } de dónde se llega a cada fase (la primera, por
 *            la que se llega antes al recorrer los caminos: desde ella se
 *            dibuja)
 *   despues  { id: [ids] } a dónde se va desde cada una (la primera, la
 *            del camino principal)
 */
export function grafoDe(fases = []) {
  const lista = (fases || []).filter((f) => f && f.id != null);
  const porId = new Map(lista.map((f) => [f.id, f]));
  const ids = new Set(porId.keys());
  const antes = new Map();
  const despues = new Map(lista.map((f) => [f.id, []]));
  lista.forEach((f, i) => {
    /* Lo que apunta a fases que no están no cuenta: se sigue a la anterior. */
    let de = Array.isArray(f.reune) ? f.reune.filter((id) => porId.has(id) && id !== f.id) : [];
    if (!de.length) { const n = naturalDe(lista, i, ids); de = n == null ? [] : [n]; }
    antes.set(f.id, [...new Set(de)]);
  });
  /* Lo que sale de cada fase, en el orden de la lista; lo que sigue sin
     ser rama va primero: es la continuación de siempre. */
  for (const f of lista) {
    for (const id of antes.get(f.id)) despues.get(id).push(f.id);
  }
  const indice = new Map(lista.map((f, i) => [f.id, i]));
  for (const [id, sale] of despues) {
    sale.sort((a, z) => {
      const ra = porId.get(a).rama_de === id ? 1 : 0;
      const rz = porId.get(z).rama_de === id ? 1 : 0;
      return ra - rz || indice.get(a) - indice.get(z);
    });
  }
  /* A una reunión se llega primero por donde la encuentra quien recorre
     los caminos en orden —la primera rama de cada cruce antes que las
     demás—. Así el camino hasta ella es el primero de los que pasan por
     ella, y el principal, si pasa, entra por donde se dibujó. */
  const orden = new Map();
  const padre = new Map();
  const raiz = lista.length ? lista[0].id : null;
  if (raiz != null) {
    const pila = [[raiz, 0]];
    orden.set(raiz, 0);
    while (pila.length) {
      const top = pila[pila.length - 1];
      const sale = despues.get(top[0]);
      if (top[1] >= sale.length) { pila.pop(); continue; }
      const s = sale[top[1]++];
      if (orden.has(s)) continue;
      orden.set(s, orden.size);
      padre.set(s, top[0]);
      pila.push([s, 0]);
    }
  }
  for (const [id, de] of antes) {
    if (de.length < 2) continue;
    const p = padre.get(id);
    const lugar = (x) => (x === p ? -1 : (orden.has(x) ? orden.get(x) : 1e9));
    de.sort((a, z) => lugar(a) - lugar(z));
  }
  return { porId, antes, despues, raiz };
}

/** Las fases a las que se va desde esta; la primera es la principal. */
export const siguientesDe = (fases, id) => grafoDe(fases).despues.get(id) || [];

/** ¿Se abren ramas en esta fase? */
export const esCruce = (fases, id) => siguientesDe(fases, id).length > 1;

/** ¿Hay alguna rama, o algo enlazado fuera del orden de la lista? Si
 *  lo hay, la jugada se recorre por caminos. */
export const tieneRamas = (fases) => (fases || []).some((f) => f && ((f.rama_de != null) || (Array.isArray(f.reune) && f.reune.length)));

/** Las reuniones a las que llega esta fase: las fases a las que se llega
 *  desde ella y desde otra. */
export function reunionesDe(fases, id) {
  const g = grafoDe(fases);
  return (g.despues.get(id) || []).filter((s) => (g.antes.get(s) || []).length > 1);
}

/** De la raíz a esta fase, llegando a cada reunión por donde se dibujó. */
export function caminoHasta(fases, id) {
  const g = grafoDe(fases);
  if (!g.porId.has(id)) return [];
  const camino = [id];
  const vistos = new Set([id]);
  let x = id;
  while ((g.antes.get(x) || []).length) {
    x = g.antes.get(x)[0];
    if (vistos.has(x)) break;
    vistos.add(x);
    camino.unshift(x);
  }
  return camino;
}

/** El camino que pasa por esta fase: hasta ella, y después por la
 *  primera rama de cada cruce. */
export function caminoPor(fases, id) {
  const g = grafoDe(fases);
  const camino = caminoHasta(fases, id);
  if (!camino.length) return [];
  const vistos = new Set(camino);
  let x = camino[camino.length - 1];
  while ((g.despues.get(x) || []).length) {
    x = g.despues.get(x)[0];
    if (vistos.has(x)) break;
    vistos.add(x);
    camino.push(x);
  }
  return camino;
}

/** El camino principal: la primera rama de cada cruce (§6.7). */
export function caminoPrincipal(fases) {
  const g = grafoDe(fases);
  return g.raiz == null ? [] : caminoPor(fases, g.raiz);
}

/**
 * TODOS LOS CAMINOS de la raíz a un final, con cada opción de cada cruce.
 * Una reunión sale en tantos caminos como ramas llegan a ella. El
 * principal va el primero.
 */
export function todosLosCaminos(fases, { tope = MAX_CAMINOS } = {}) {
  const g = grafoDe(fases);
  if (g.raiz == null) return [];
  const salida = [];
  const andar = (camino) => {
    if (salida.length >= tope) return;
    const x = camino[camino.length - 1];
    const sale = (g.despues.get(x) || []).filter((id) => !camino.includes(id));
    if (!sale.length) { salida.push(camino); return; }
    for (const id of sale) andar([...camino, id]);
  };
  andar([g.raiz]);
  return salida;
}

/** Cuántos caminos distintos hay, sin recorrerlos uno a uno. */
export function cuantosCaminos(fases) {
  const g = grafoDe(fases);
  if (g.raiz == null) return 0;
  const memo = new Map();
  const enCurso = new Set();
  const contar = (x) => {
    if (memo.has(x)) return memo.get(x);
    enCurso.add(x);
    const sale = (g.despues.get(x) || []).filter((s) => !enCurso.has(s));
    const n = sale.length ? sale.reduce((a, s) => a + contar(s), 0) : 1;
    enCurso.delete(x);
    memo.set(x, n);
    return n;
  };
  return contar(g.raiz);
}

const DEMASIADOS = `la jugada tendría más de ${MAX_CAMINOS} caminos distintos: son demasiados para verlos`;

/* Las fases que cuelgan de esta sin pasar por otra rama: las que se van
   con ella si se quita. */
function descendientesPropios(g, id) {
  const fuera = new Set([id]);
  const pila = [id];
  while (pila.length) {
    const x = pila.pop();
    for (const s of g.despues.get(x) || []) {
      if (fuera.has(s)) continue;
      /* Una reunión a la que se llega también por otro lado se queda. */
      if ((g.antes.get(s) || []).some((a) => !fuera.has(a))) continue;
      fuera.add(s);
      pila.push(s);
    }
  }
  return fuera;
}

/** Un `reune` de una sola fase que ya es la de siempre sobra: lo dice el
 *  orden de la lista, o el cruce. */
export function sinEnlacesDeMas(lista) {
  const ids = new Set(lista.map((f) => f.id));
  return lista.map((f, i) => {
    if (!Array.isArray(f.reune) || f.reune.length !== 1) return f;
    return f.reune[0] === naturalDe(lista, i, ids) ? { ...f, reune: [] } : f;
  });
}

/* Un cruce que se queda con una sola rama ya no es cruce: esa deja de ser
   rama y pasa a ser lo que sigue. Si no va justo detrás en la lista, lo
   dice `reune`. */
function unaSolaNoEsRama(lista, cruce) {
  const quedan = grafoDe(lista).despues.get(cruce) || [];
  if (quedan.length !== 1) return lista;
  return lista.map((x) => (x.id !== quedan[0] || x.rama_de !== cruce ? x : {
    ...x, rama_de: null, rama_nombre: null, reune: Array.isArray(x.reune) && x.reune.length ? x.reune : [cruce],
  }));
}

/* Un id de fase que no está: el siguiente número. */
export function nuevoIdDeFase(fases) {
  const n = Math.max(0, ...(fases || []).map((f) => Number(/^f(\d+)$/.exec(String(f && f.id))?.[1]) || 0));
  return `f${n + 1}`;
}

/**
 * ABRE UNA RAMA en esta fase (§6.7). Lo que ya venía detrás pasa a ser la
 * primera rama, con su nombre; la nueva empieza vacía. Si ya era un cruce,
 * se añade otra. Si detrás no había nada, salen las dos vacías.
 *
 * @param crear  (id) => fase nueva vacía, con lo que cada cual necesite
 * @returns { fases, nuevas: [ids] } o { motivo } si no se puede
 */
export function abrirRama(fases, id, { primera = '', nueva = '', crear } = {}) {
  const lista = fases || [];
  const g = grafoDe(lista);
  if (!g.porId.has(id)) return { motivo: 'esa fase no está' };
  const sale = g.despues.get(id) || [];
  if (sale.length >= MAX_RAMAS) return { motivo: `una fase abre como mucho ${MAX_RAMAS} ramas` };
  const n1 = String(primera || '').trim();
  const n2 = String(nueva || '').trim();
  const falta = !n2 || (sale.length <= 1 && !n1);
  if (falta) return { motivo: 'cada rama necesita su nombre' };
  /* Si lo único que sigue es una reunión a la que esta fase llega desde
     su rama, eso no puede ser la primera rama de aquí: es de otra. */
  if (sale.length === 1 && (g.antes.get(sale[0]) || []).length > 1) {
    const r = g.porId.get(sale[0]);
    const i = lista.indexOf(r);
    if (naturalDe(lista, i, new Set(g.porId.keys())) !== id) return { motivo: 'esta fase sigue por una reunión: sepárala antes de abrir ramas' };
  }
  let salida = [...lista];
  const nuevas = [];
  const hacer = (nombre) => {
    const idNuevo = nuevoIdDeFase(salida);
    const f = { ...(crear ? crear(idNuevo) : { id: idNuevo, tramos: [] }), id: idNuevo, rama_de: id, rama_nombre: nombre, reune: [] };
    /* Al final de la lista: una rama nueva no sigue a nadie por el orden,
       y lo que venga detrás de ella se pondrá justo después. */
    salida = [...salida, f];
    nuevas.push(idNuevo);
  };
  if (!sale.length) {
    hacer(n1);
  } else if (sale.length === 1) {
    /* Lo que ya venía pasa a ser la primera rama. */
    salida = salida.map((f) => (f.id === sale[0] ? { ...f, rama_de: id, rama_nombre: n1 } : f));
  }
  hacer(n2);
  salida = sinEnlacesDeMas(salida);
  if (cuantosCaminos(salida) > MAX_CAMINOS) return { motivo: DEMASIADOS };
  return { fases: salida, nuevas };
}

/** Cambia el nombre de una rama (el de su primera fase). */
export function renombrarRama(fases, id, nombre) {
  const n = String(nombre || '').trim();
  if (!n) return { motivo: 'cada rama necesita su nombre' };
  const f = (fases || []).find((x) => x && x.id === id);
  if (!f || f.rama_de == null) return { motivo: 'esa fase no empieza ninguna rama' };
  return { fases: fases.map((x) => (x.id === id ? { ...x, rama_nombre: n } : x)) };
}

/**
 * QUITA UNA RAMA: su primera fase y lo que cuelga solo de ella. Solo si
 * no tiene nada dibujado —se perdería trabajo—. Si el cruce se queda con
 * una sola, esa deja de ser rama. Si la rama empieza en una reunión, a la
 * que se llega también desde otra, la fase se queda: lo que se quita es
 * el paso del cruce a ella.
 */
export function quitarRama(fases, id) {
  const lista = fases || [];
  const g = grafoDe(lista);
  const f = g.porId.get(id);
  if (!f || f.rama_de == null) return { motivo: 'esa fase no empieza ninguna rama' };
  const cruce = f.rama_de;
  if ((g.antes.get(id) || []).length > 1) return separar(lista, cruce, id);
  const fuera = descendientesPropios(g, id);
  if ([...fuera].some((x) => ((g.porId.get(x).tramos) || []).length)) return { motivo: 'la rama tiene algo dibujado; bórralo antes' };
  let salida = lista.filter((x) => !fuera.has(x.id)).map((x) => {
    let y = x;
    /* Las reuniones pierden lo que se va; lo que queda lo dice `reune`. */
    if (Array.isArray(y.reune) && y.reune.some((r) => fuera.has(r))) y = { ...y, reune: y.reune.filter((r) => !fuera.has(r)) };
    /* Y quien colgaba de una fase que se va (una reunión con su cruce
       dentro de la rama) ya no empieza ninguna rama. */
    if (y.rama_de != null && fuera.has(y.rama_de)) y = { ...y, rama_de: null, rama_nombre: null };
    return y;
  });
  salida = unaSolaNoEsRama(salida, cruce);
  return { fases: sinEnlacesDeMas(salida) };
}

/**
 * REÚNE una rama con otra fase (§6.7): la última fase de una rama sigue
 * por `hasta`, que pasa a ser continuación común. Se dibuja desde la que
 * se recorre antes, y al reproducir, sus trazos salen de donde deje la
 * rama que se esté viendo.
 */
export function reunir(fases, desde, hasta) {
  const lista = fases || [];
  const g = grafoDe(lista);
  if (!g.porId.has(desde) || !g.porId.has(hasta)) return { motivo: 'esa fase no está' };
  if (desde === hasta) return { motivo: 'una fase no puede seguir por sí misma' };
  if ((g.despues.get(desde) || []).length) return { motivo: 'solo se reúne desde la última fase de una rama' };
  if (hasta === g.raiz) return { motivo: 'la primera fase no sigue a ninguna' };
  if (caminoHasta(lista, desde).includes(hasta)) return { motivo: 'esa fase va antes: se daría la vuelta' };
  /* Que desde `hasta` no se pueda llegar a `desde`: sería un círculo. */
  const alcanzables = new Set([hasta]);
  const pila = [hasta];
  while (pila.length) {
    const x = pila.pop();
    for (const s of g.despues.get(x) || []) if (!alcanzables.has(s)) { alcanzables.add(s); pila.push(s); }
  }
  if (alcanzables.has(desde)) return { motivo: 'se daría la vuelta' };
  const ya = g.antes.get(hasta) || [];
  const salida = lista.map((f) => (f.id === hasta ? { ...f, reune: [...new Set([...ya, desde])] } : f));
  if (cuantosCaminos(salida) > MAX_CAMINOS) return { motivo: DEMASIADOS };
  return { fases: salida };
}

/**
 * DESHACE UNA REUNIÓN: `desde` deja de seguir por `hasta` y acaba su rama.
 * Vale desde cualquiera de las que llegan, también desde la que llegaba
 * antes de reunir: la fase sigue con las demás. Si empezaba una rama de
 * `desde`, deja de serlo.
 */
export function separar(fases, desde, hasta) {
  const lista = fases || [];
  const g = grafoDe(lista);
  const entradas = g.antes.get(hasta) || [];
  if (entradas.length < 2 || !entradas.includes(desde)) return { motivo: 'esas fases no están reunidas' };
  const f = g.porId.get(hasta);
  let salida = lista.map((x) => (x.id !== hasta ? x : {
    ...x,
    reune: entradas.filter((r) => r !== desde),
    ...(x.rama_de === desde ? { rama_de: null, rama_nombre: null } : {}),
  }));
  if (f.rama_de === desde) salida = unaSolaNoEsRama(salida, desde);
  return { fases: sinEnlacesDeMas(salida) };
}

/* ── Insertar y borrar fases (§6.8) ────────────────────────────
   Con los enlaces escritos del todo —cada fase dice de cuáles viene— el
   orden de la lista deja de importar mientras se cambia, y al final se
   quita lo que el orden ya dice (`sinEnlacesDeMas`). Así una jugada sin
   ramas sigue siendo una lista sin más. */

/* Cada fase, con todas las que llegan a ella escritas en `reune`. */
function explicitar(lista) {
  const g = grafoDe(lista);
  return lista.map((f, i) => ({ ...f, reune: i === 0 ? [] : [...(g.antes.get(f.id) || [])] }));
}

/**
 * INSERTA UNA FASE antes o después de otra (§6.8). Después de un cruce,
 * la nueva pasa a ser el cruce: las ramas salen de ella. Antes de una
 * rama o de una reunión, es la nueva la que empieza la rama o reúne.
 * Antes de la primera, la nueva pasa a ser la primera.
 *
 * @param donde 'despues' | 'antes'
 * @returns { fases } o { motivo }
 */
export function insertarFase(fases, id, fase, donde = 'despues') {
  const lista = (fases || []).filter((f) => f && f.id != null);
  const i = lista.findIndex((f) => f.id === id);
  if (i < 0) return { motivo: 'esa fase no está' };
  if (!fase || fase.id == null || lista.some((f) => f.id === fase.id)) return { motivo: 'la fase nueva necesita un nombre que no esté' };
  const todas = explicitar(lista);
  const x = todas[i];
  let salida;
  if (donde === 'antes') {
    const nueva = { ...fase, rama_de: x.rama_de ?? null, rama_nombre: x.rama_nombre ?? null, reune: [...x.reune] };
    const vieja = { ...x, rama_de: null, rama_nombre: null, reune: [nueva.id] };
    salida = [...todas.slice(0, i), nueva, vieja, ...todas.slice(i + 1)];
  } else {
    const nueva = { ...fase, rama_de: null, rama_nombre: null, reune: [id] };
    const resto = todas.map((f) => (f.id === id ? f : {
      ...f,
      reune: f.reune.map((r) => (r === id ? nueva.id : r)),
      rama_de: f.rama_de === id ? nueva.id : f.rama_de,
    }));
    salida = [...resto.slice(0, i + 1), nueva, ...resto.slice(i + 1)];
  }
  return { fases: sinEnlacesDeMas(salida) };
}

/**
 * BORRA UNA FASE (§6.8), con lo dibujado en ella. Lo que venía detrás
 * pasa a seguir a lo que había delante; si empezaba una rama, la empieza
 * lo que venía detrás, y si era lo único de la rama, la rama se va. No
 * se borra una fase de la que salen ramas (antes hay que quitarlas), ni
 * la única que hay.
 *
 * @returns { fases, sigue } — `sigue`, la fase que ocupa su sitio (o null)
 */
export function borrarFase(fases, id) {
  const lista = (fases || []).filter((f) => f && f.id != null);
  const g = grafoDe(lista);
  if (!g.porId.has(id)) return { motivo: 'esa fase no está' };
  if (lista.length < 2) return { motivo: 'una jugada tiene al menos una fase' };
  const sale = g.despues.get(id) || [];
  if (sale.length > 1) return { motivo: 'de esta fase salen ramas: quítalas antes' };
  const todas = explicitar(lista);
  const x = todas.find((f) => f.id === id);
  const sigue = sale[0] ?? null;
  let salida = todas.filter((f) => f.id !== id).map((f) => {
    if (f.id !== sigue) return f;
    const reune = [...new Set(f.reune.flatMap((r) => (r === id ? x.reune : [r])))];
    /* Hereda la rama que empezaba la borrada. */
    const rama = x.rama_de != null && f.rama_de == null ? { rama_de: x.rama_de, rama_nombre: x.rama_nombre } : {};
    return { ...f, ...rama, reune };
  });
  /* Era la primera: la que seguía pasa a serlo, y va la primera. */
  if (lista[0].id === id) {
    const k = salida.findIndex((f) => f.id === sigue);
    const primera = { ...salida[k], rama_de: null, rama_nombre: null, reune: [] };
    salida = [primera, ...salida.slice(0, k), ...salida.slice(k + 1)];
  }
  /* Era lo único de una rama: el cruce se queda con una de menos. */
  if (sigue == null && x.rama_de != null) salida = unaSolaNoEsRama(salida, x.rama_de);
  return { fases: sinEnlacesDeMas(salida), sigue };
}

/**
 * DÓNDE PONER UNA FASE NUEVA que sigue a `id` sin ser rama: justo detrás
 * de ella en la lista, para que el orden lo diga.
 */
export function insertarDetras(fases, id, fase) {
  const lista = fases || [];
  const i = lista.findIndex((f) => f && f.id === id);
  if (i < 0) return [...lista, fase];
  return [...lista.slice(0, i + 1), fase, ...lista.slice(i + 1)];
}

/**
 * EL ÁRBOL para dibujarlo (la tira de fases de §2.4): una lista de tramos
 * de camino, cada uno con sus fases y, si acaba en un cruce, sus ramas.
 *
 * @returns [{ id, rama: { nombre }|null, reune: [ids] }...] anidado como
 *   { fases: [...], ramas: [{ nombre, desde, fases, ramas }] }
 */
export function arbolDe(fases) {
  const g = grafoDe(fases);
  if (g.raiz == null) return { fases: [], ramas: [] };
  const puestas = new Set();
  const tramo = (inicio, nombre = null) => {
    const r = { nombre, inicio, fases: [], ramas: [] };
    let x = inicio;
    while (x != null && !puestas.has(x)) {
      puestas.add(x);
      r.fases.push(x);
      const sale = g.despues.get(x) || [];
      if (sale.length > 1) {
        r.ramas = sale.map((s) => ({ ...tramo(s, g.porId.get(s).rama_nombre || null), desde: x }));
        break;
      }
      x = sale[0];
      /* Una reunión se dibuja una vez, donde se llega a ella primero. */
      if (x != null && (g.antes.get(x) || [])[0] !== r.fases[r.fases.length - 1]) {
        r.sigueEn = x;
        break;
      }
    }
    /* Una rama que empieza en una reunión ya dibujada: dice por dónde sigue. */
    if (!r.fases.length && inicio != null && puestas.has(inicio) && r.sigueEn == null) r.sigueEn = inicio;
    return r;
  };
  return tramo(g.raiz);
}
