/* ============================================================
   eval-destino.mjs — banco Node de los destinos que la app ya sabe
   (taller/js/pizarra/destino.js). Sin red, sin DOM.

     node taller/tools/eval-destino.mjs

   Lo que más se vigila aquí no es el número sino que sea EL MISMO
   número que usa el motor. La Pizarra calcula estos destinos mientras
   se dibuja y el compilador los vuelve a calcular al animar: con dos
   cuentas parecidas, el trazo que se ve al dibujar y el que se
   reproduce acabarían a distinta distancia del aro, y eso no se nota
   hasta que se proyecta en el pabellón.
   ============================================================ */

import {
  tieneDestinoPropio, destinoDe, METROS_FINALIZACION, METROS_RECOGIDA, trasElTiro, METROS_REBOTE, METROS_CAIDA,
  esAccionDeBloqueo, defensorSupuesto, sitioDelBloqueo, frenteDelBloqueo,
  METROS_BLOQUEO, METROS_PAR_CON_BALON, METROS_PAR_SIN_BALON,
} from '../js/pizarra/destino.js';
import { limitesCancha } from '../js/canvas/medidas.js';
import { CATALOGO_SISTEMA } from '../js/ia/acciones.js';
import { posicionesDe } from '../js/canvas/anclas.js';
import { metrosEntre, escalaDe } from '../js/canvas/escala.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  const r = JSON.stringify(real), e = JSON.stringify(esp);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
};
const aprox = (real, esp, tol = 1e-6, msg = '') => {
  if (!(Math.abs(real - esp) <= tol)) throw new Error(`${msg} esperado≈${esp} real=${real}`);
};
const de = (slug) => CATALOGO_SISTEMA.find((a) => a.slug === slug);
const jugador = { id: 'j1', kind: 'jugador', x: 0.30, y: 0.75 };

/* ── 1. Quién sabe sola a dónde va ───────────────────────── */

test('SALE DEL CATÁLOGO, no de una lista de slugs escrita a mano', () => {
  for (const a of CATALOGO_SISTEMA) {
    const p = a.parametros || {};
    const esperado = p.destino === 'aro' || p.destino === 'fila_propia' || p.modo === 'recoge';
    eq(tieneDestinoPropio(a), esperado, `${a.slug}:`);
  }
});

test('las tres del §4.4 saben a dónde van; bota y corta no', () => {
  for (const s of ['entra', 'recoge', 'vuelve_a_fila']) ok(tieneDestinoPropio(de(s)), `${s} debería saberlo`);
  for (const s of ['bota', 'corta']) ok(!tieneDestinoPropio(de(s)), `${s} tiene que preguntarlo`);
});

/* ── 2. Al aro ───────────────────────────────────────────── */

test('«entra» SE PARA DONDE SE APOYA, no encima del aro', () => {
  /* Con la ficha encima del aro, su símbolo tapa la canasta entera y no
     se ve si entra o no. La distancia es la del catálogo. */
  const r = destinoDe(de('entra'), jugador, { pista: 'entera', canasta: 'norte' });
  ok(r.punto, 'tiene que salir un punto');
  const aro = posicionesDe('entera', 'norte').aro;
  const d = metrosEntre('entera', r.punto, { x: aro[0], y: aro[1] });
  aprox(d, de('entra').parametros.separacion, 1e-6, 'la distancia al aro:');
});

test('Y ESA DISTANCIA ES LA DEL MOTOR, no una parecida', () => {
  /* La acción declara 1,1 y su familia lo declara de reserva: los dos
     números tienen que ser el mismo, o una acción sin `separacion`
     propia pararía a otra distancia que la que la declara. */
  eq(de('entra').parametros.separacion, METROS_FINALIZACION,
    'si esto falla, el trazo dibujado y el animado se separan:');
  // y sin `separacion`, se cae en la constante del motor
  const sinSep = { ...de('entra'), parametros: { destino: 'aro', alcance: 'pegado' } };
  const r = destinoDe(sinSep, jugador, { pista: 'entera', canasta: 'norte' });
  const aro = posicionesDe('entera', 'norte').aro;
  aprox(metrosEntre('entera', r.punto, { x: aro[0], y: aro[1] }), METROS_FINALIZACION, 1e-6);
});

test('el destino cae dentro de la pista, venga el jugador de donde venga', () => {
  for (const [x, y] of [[0.02, 0.02], [0.98, 0.98], [0.5, 0.5], [0.02, 0.98]]) {
    const r = destinoDe(de('entra'), { ...jugador, x, y }, { pista: 'entera', canasta: 'norte' });
    ok(r.punto.x >= 0 && r.punto.x <= 1 && r.punto.y >= 0 && r.punto.y <= 1,
      `desde ${x},${y} sale ${JSON.stringify(r.punto)}`);
  }
});

test('cada canasta tiene su aro, y media pista también', () => {
  const n = destinoDe(de('entra'), jugador, { pista: 'entera', canasta: 'norte' }).punto;
  const s = destinoDe(de('entra'), jugador, { pista: 'entera', canasta: 'sur' }).punto;
  ok(Math.abs(n.y - s.y) > 0.2, `norte y sur no pueden dar lo mismo: ${n.y} / ${s.y}`);
  const m = destinoDe(de('entra'), jugador, { pista: 'media', canasta: 'norte' }).punto;
  ok(Number.isFinite(m.x) && Number.isFinite(m.y), 'en media pista también sale un punto');
});

/* ── 3. A por el balón ───────────────────────────────────── */

const balon = (id, x, y, portador = null) => ({ id, kind: 'balon', x, y, portador_id: portador });

test('«recoge» va al balón SUELTO más cercano y se para al lado', () => {
  const elementos = [jugador, balon('b1', 0.50, 0.20), balon('b2', 0.32, 0.70)];
  const r = destinoDe(de('recoge'), jugador, { pista: 'entera', elementos });
  eq(r.balon, 'b2', 'el más cercano:');
  const d = metrosEntre('entera', r.punto, { x: 0.32, y: 0.70 });
  aprox(d, de('recoge').parametros.separacion, 1e-6, 'se para al lado, no encima:');
});

test('la distancia de recogida también es la del motor', () => {
  eq(de('recoge').parametros.separacion, METROS_RECOGIDA);
});

test('un balón que lleva alguien NO se puede recoger', () => {
  const elementos = [jugador, balon('b1', 0.31, 0.74, 'j9')];
  const r = destinoDe(de('recoge'), jugador, { pista: 'entera', elementos });
  ok(!r.punto, 'no debería dar destino');
  ok(/suelto/i.test(r.motivo), `y el motivo lo dice: ${r.motivo}`);
});

test('sin ningún balón suelto lo dice, en vez de inventarse un sitio', () => {
  const r = destinoDe(de('recoge'), jugador, { pista: 'entera', elementos: [jugador] });
  ok(!r.punto);
  ok(r.motivo && r.motivo.length > 8, `un motivo legible: ${r.motivo}`);
});

/* ── 4. Lo que todavía no se puede saber ─────────────────── */

test('«vuelve a la fila» DICE que no hay filas, no se inventa una esquina', () => {
  const r = destinoDe(de('vuelve_a_fila'), jugador, { pista: 'entera' });
  ok(!r.punto, 'no puede salir un punto');
  ok(/fila/i.test(r.motivo), `y el motivo nombra el problema: ${r.motivo}`);
});

test('una acción sin destino propio también lo dice', () => {
  for (const s of ['bota', 'corta', 'finta']) {
    const r = destinoDe(de(s), jugador, { pista: 'entera' });
    ok(!r.punto, `${s} no debería dar destino`);
    ok(r.motivo, `${s} tiene que decir por qué`);
  }
});

test('entradas imposibles no rompen nada', () => {
  ok(destinoDe(null, jugador, {}).motivo);
  ok(destinoDe(de('entra'), null, {}).motivo);
  ok(destinoDe(de('entra'), { id: 'x', kind: 'jugador' }, {}).motivo, 'sin coordenadas:');
  eq(tieneDestinoPropio(null), false);
  eq(tieneDestinoPropio({}), false);
});

/* ── 4. Después del tiro ─────────────────────────────────── */

const aroDe = (pista, canasta) => { const a = posicionesDe(pista, canasta).aro; return { x: a[0], y: a[1] }; };

test('UN TIRO QUE FALLA REBOTA A 2,5 M, hacia dentro y al lado CONTRARIO al tirador', () => {
  const aro = aroDe('entera', 'norte');
  const izq = trasElTiro({ pista: 'entera', canasta: 'norte', desde: { x: aro.x - 0.25, y: aro.y + 0.2 }, desenlace: 'falla' });
  aprox(metrosEntre('entera', izq, aro), METROS_REBOTE, 1e-6, 'a qué distancia del aro:');
  ok(izq.x > aro.x, `tirando desde la izquierda, rebota a la derecha: ${izq.x} frente a ${aro.x}`);
  ok(izq.y > aro.y, 'y hacia dentro de la pista, no fuera de la línea de fondo');
  const der = trasElTiro({ pista: 'entera', canasta: 'norte', desde: { x: aro.x + 0.25, y: aro.y + 0.2 }, desenlace: 'falla' });
  ok(der.x < aro.x, 'desde la derecha, a la izquierda');
});

test('en la OTRA canasta, dentro es hacia el otro lado', () => {
  const aro = aroDe('entera', 'sur');
  const p = trasElTiro({ pista: 'entera', canasta: 'sur', desde: { x: aro.x + 0.25, y: aro.y - 0.2 }, desenlace: 'falla' });
  aprox(metrosEntre('entera', p, aro), METROS_REBOTE, 1e-6);
  ok(p.y < aro.y && p.x < aro.x, `hacia dentro y al otro lado: ${JSON.stringify(p)}`);
});

test('desde el centro rebota recto; y un tiro que ENTRA cae bajo el aro', () => {
  const aro = aroDe('entera', 'norte');
  const recto = trasElTiro({ pista: 'entera', canasta: 'norte', desde: { x: aro.x, y: aro.y + 0.3 }, desenlace: 'falla' });
  aprox(recto.x, aro.x, 1e-9, 'sin elegir lado por un centímetro:');
  const cae = trasElTiro({ pista: 'entera', canasta: 'norte', desde: { x: aro.x - 0.3, y: aro.y + 0.2 }, desenlace: 'entra' });
  aprox(metrosEntre('entera', cae, aro), METROS_CAIDA, 1e-6, 'bajo el aro:');
  aprox(cae.x, aro.x, 1e-9, 'justo delante, venga de donde venga:');
});

test('EN LAS CUATRO PISTAS Y LAS DOS CANASTAS, el balón queda dentro de la cancha', () => {
  for (const pista of ['entera', 'media', 'entera_fiba', 'media_fiba']) {
    for (const canasta of ['norte', 'sur']) {
      const aro = aroDe(pista, canasta);
      const lim = limitesCancha(pista);
      for (const desenlace of ['entra', 'falla']) {
        for (const desde of [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: aro.x, y: aro.y }]) {
          const p = trasElTiro({ pista, canasta, desde, desenlace });
          ok(p && p.x >= lim.x[0] && p.x <= lim.x[1] && p.y >= lim.y[0] && p.y <= lim.y[1],
            `${pista} ${canasta} ${desenlace}: fuera de la cancha ${JSON.stringify(p)}`);
        }
      }
    }
  }
  ok(trasElTiro({ pista: 'no_existe', desenlace: 'falla' }) === null, 'sin aro conocido, null');
});

/* ── 6. El sitio del bloqueo (§4.4) ──────────────────────── */

test('ES UN BLOQUEO LO QUE DIBUJA LA RELACIÓN DE BLOQUEO, según el catálogo', () => {
  for (const a of CATALOGO_SISTEMA) {
    const esperado = a.familia === 'entre_dos' && a.parametros.simbolo_relacion === 'bloqueo';
    eq(esAccionDeBloqueo(a), esperado, `${a.slug}:`);
  }
  ok(esAccionDeBloqueo(de('bloquea')), 'bloquea lo es');
  ok(!esAccionDeBloqueo(de('defiende')) && !esAccionDeBloqueo(null), 'defiende no, y nada tampoco');
});

test('SIN DEFENSA, EL DEFENSOR SE SUPONE ENTRE EL COMPAÑERO Y EL ARO: 1,2 m con balón, 2,0 sin él', () => {
  const aro = aroDe('entera', 'norte');
  const par = { x: 0.5, y: 0.5 };
  for (const [conBalon, metros] of [[true, METROS_PAR_CON_BALON], [false, METROS_PAR_SIN_BALON]]) {
    const d = defensorSupuesto({ pista: 'entera', canasta: 'norte', par, conBalon });
    aprox(metrosEntre('entera', d, par), metros, 1e-6, `con balón ${conBalon}, a su par:`);
    aprox(metrosEntre('entera', d, aro) + metros, metrosEntre('entera', par, aro), 1e-6, 'y sobre la línea al aro:');
  }
});

/* El producto escalar de dos vectores medidos en METROS. */
const escalar = (pista, a, b, c, d) => {
  const e = escalaDe(pista);
  return (b.x - a.x) * e.x * (d.x - c.x) * e.x + (b.y - a.y) * e.y * (d.y - c.y) * e.y;
};

test('QUIEN BLOQUEA SE PLANTA AL LADO DE ESE DEFENSOR, a 0,7 m y del lado por el que llega', () => {
  const companero = { x: 0.5, y: 0.5 };
  const d = defensorSupuesto({ pista: 'entera', canasta: 'norte', par: companero, conBalon: false });
  for (const desde of [{ x: 0.85, y: 0.5 }, { x: 0.15, y: 0.5 }]) {
    const s = sitioDelBloqueo({ pista: 'entera', canasta: 'norte', desde, companero, conBalon: false });
    aprox(metrosEntre('entera', s, d), METROS_BLOQUEO, 1e-6, 'pegado a él:');
    aprox(escalar('entera', companero, d, d, s), 0, 1e-6, 'al LADO, no en la línea al aro:');
    ok(escalar('entera', d, s, d, desde) > 0, `del lado por el que llega (desde x=${desde.x}): ${JSON.stringify(s)}`);
  }
});

test('NO SE QUEDA ENCIMA DEL COMPAÑERO aunque llegue desde su misma altura', () => {
  /* Parándose en su camino hacia el defensor, el que venía desde la
     altura del compañero acababa a medio metro de él, ficha sobre ficha. */
  const companero = { x: 0.35, y: 0.30 };
  const s = sitioDelBloqueo({ pista: 'entera', canasta: 'norte', desde: { x: 0.12, y: 0.30 }, companero, conBalon: true });
  ok(metrosEntre('entera', s, companero) > 1.3, `a ${metrosEntre('entera', s, companero).toFixed(2)} m del compañero`);
});

test('con el compañero en el aro se acerca por su camino; sin compañero o sin aro, no se inventa', () => {
  const aro = aroDe('entera', 'norte');
  const desde = { x: 0.5, y: 0.5 };
  const s = sitioDelBloqueo({ pista: 'entera', canasta: 'norte', desde, companero: aro, conBalon: false });
  aprox(metrosEntre('entera', s, aro), METROS_BLOQUEO, 1e-6, 'se para antes de llegar:');
  const companero = { x: 0.5, y: 0.5 };
  eq(sitioDelBloqueo({ pista: 'entera', canasta: 'norte', desde: { x: 0.2, y: 0.2 }, companero: null }), null);
  eq(sitioDelBloqueo({ pista: 'no_existe', desde: { x: 0.2, y: 0.2 }, companero }), null);
  eq(sitioDelBloqueo({ pista: 'entera', desde: null, companero }), null);
});

test('EN LAS CUATRO PISTAS Y LAS DOS CANASTAS, el bloqueador acaba dentro de la cancha', () => {
  for (const pista of ['entera', 'media', 'entera_fiba', 'media_fiba']) {
    for (const canasta of ['norte', 'sur']) {
      const lim = limitesCancha(pista);
      for (const companero of [{ x: 0.02, y: 0.5 }, { x: 0.5, y: 0.5 }, aroDe(pista, canasta)]) {
        for (const desde of [{ x: 0.98, y: 0.02 }, { x: 0.1, y: 0.9 }]) {
          const p = sitioDelBloqueo({ pista, canasta, desde, companero, conBalon: false });
          ok(p && p.x >= lim.x[0] && p.x <= lim.x[1] && p.y >= lim.y[0] && p.y <= lim.y[1],
            `${pista} ${canasta}: fuera de la cancha ${JSON.stringify(p)}`);
        }
      }
    }
  }
});

test('LA BARRA MIRA HACIA DONDE LLEGA: un punto justo delante del final', () => {
  const N = (x, y) => ({ x, y, tipo_nodo: 'lineal', handle_in: null, handle_out: null });
  const f = frenteDelBloqueo([N(0.8, 0.5), N(0.6, 0.5)]);
  ok(f.x < 0.6 && Math.abs(f.y - 0.5) < 1e-9, `hacia la izquierda, que es por donde iba: ${JSON.stringify(f)}`);
  eq(frenteDelBloqueo([N(0.5, 0.5), N(0.5, 0.5)]), null, 'si no se ha movido, no tiene frente:');
  eq(frenteDelBloqueo(null), null);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
