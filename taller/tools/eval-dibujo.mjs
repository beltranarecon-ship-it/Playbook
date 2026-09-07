/* ============================================================
   eval-dibujo.mjs — banco Node de la parte pura del modo destino
   (taller/js/pizarra/dibujo.js). Sin red, sin DOM.

     node taller/tools/eval-dibujo.mjs

   La clase `Dibujo` necesita un lienzo y se prueba en el navegador;
   aquí se prueban las dos decisiones que toma sola y que no se ven
   hasta que ya es tarde: QUÉ FLECHA y A QUÉ RITMO.

   Las dos son traducciones de una tabla a otra, y las traducciones
   silenciosas son el peor sitio para un fallo: si `ritmoDe` devuelve un
   ritmo que `duracionDe` no conoce, no hay error — salen unos segundos
   equivocados y nadie lo nota. Igual con la flecha: una acción con un
   símbolo nuevo cae en `run` y el fantasma enseña un trazo que luego no
   va a existir.

   Por eso el banco recorre el CATÁLOGO ENTERO en vez de unos cuantos
   ejemplos: lo que se vigila es que el club pueda añadir acciones sin
   que esto se quede atrás en silencio.
   ============================================================ */

import { tipoFlecha, ritmoDe } from '../js/pizarra/dibujo.js';
import { RITMOS, duracionDe } from '../js/pizarra/trazo.js';
import { MOV_TO_ARROW } from '../js/canvas/arrows.js';
import { CATALOGO_SISTEMA } from '../js/ia/acciones.js';

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

const porSlug = new Map(CATALOGO_SISTEMA.map((a) => [a.slug, a]));
const de = (slug) => porSlug.get(slug);
/** Los que `drawArrow` sabe dibujar. Cualquier otro se dibujaría como
 *  `run` sin avisar. */
const DIBUJABLES = ['run', 'pass', 'cut', 'gesto'];

/* ── 1. La flecha ────────────────────────────────────────── */

test('TODA acción del catálogo saca una flecha que drawArrow sabe dibujar', () => {
  for (const a of CATALOGO_SISTEMA) {
    const t = tipoFlecha(a);
    ok(DIBUJABLES.includes(t), `${a.slug} (símbolo ${a.simbolo}) saca "${t}", que nadie dibuja`);
  }
});

test('el pase y el tiro van con la flecha del balón, no con la de correr', () => {
  eq(tipoFlecha(de('pasa')), 'pass');
  eq(tipoFlecha(de('tira')), 'pass', 'un tiro es el balón viajando: naranja punteada');
});

test('con balón el trazo es sólido y sin balón discontinuo', () => {
  for (const s of ['bota', 'entra', 'rodea']) eq(tipoFlecha(de(s)), 'run', `${s}:`);
  for (const s of ['corta', 'recoge', 'vuelve_a_fila']) eq(tipoFlecha(de(s)), 'cut', `${s}:`);
});

test('un gesto en el sitio no lleva flecha de desplazamiento', () => {
  for (const s of ['finta', 'pivota', 'para', 'protege']) eq(tipoFlecha(de(s)), 'gesto', `${s}:`);
});

test('la flecha sale del símbolo, así que una acción nueva la hereda', () => {
  // el club puede añadir una acción al catálogo sin tocar dibujo.js
  eq(tipoFlecha({ simbolo: 'corte' }), 'cut');
  eq(tipoFlecha({ simbolo: 'carrera_con_balon' }), 'run');
  ok(Object.keys(MOV_TO_ARROW).length > 0, 'el mapa compartido tiene que seguir existiendo');
});

test('sin acción, o con un símbolo desconocido, cae en el trazo neutro', () => {
  eq(tipoFlecha(null), 'run');
  eq(tipoFlecha(undefined), 'run');
  eq(tipoFlecha({}), 'run');
  eq(tipoFlecha({ simbolo: 'algo_que_no_existe' }), 'run');
});

test('EL BLOQUEO NO ES UN TRAZO, y aquí se deja dicho', () => {
  /* «bloquea» es una relación entre dos fichas —el motor la dibuja con
     drawBloqueo entre bloqueador y compañero— y por eso pide compañero
     y no destino. Si algún día entra en el modo destino, el fantasma
     enseñaría esta flecha, que es mentira. Esta prueba está para que
     ese día alguien lo lea aquí en vez de descubrirlo dibujando. */
  eq(de('bloquea').simbolo, 'bloqueo');
  eq(tipoFlecha(de('bloquea')), 'run', 'hoy cae en el trazo neutro:');
  ok(!(de('bloquea').pide || []).includes('destino'),
    'mientras «bloquea» no pida destino, no debe entrar en este modo');
});

/* ── 2. El ritmo ─────────────────────────────────────────── */

test('TODO ritmo que salga de aquí lo entiende duracionDe', () => {
  const salidas = new Set(CATALOGO_SISTEMA.map(ritmoDe));
  salidas.add(ritmoDe(null));
  for (const r of salidas) {
    ok(r === 'pase' || r in RITMOS, `"${r}" no está en RITMOS: los segundos saldrían mal en silencio`);
    ok(Number.isFinite(duracionDe(10, r)) && duracionDe(10, r) > 0, `duracionDe(10, "${r}") no da un número`);
  }
});

test('lo que viaja es el balón, y el balón vuela', () => {
  eq(ritmoDe(de('pasa')), 'pase');
  eq(ritmoDe(de('tira')), 'pase');
  ok(duracionDe(10, 'pase') < duracionDe(10, 'sprint'), 'un pase llega antes que el más rápido corriendo');
});

test('el ritmo se lee del catálogo, no se inventa', () => {
  eq(ritmoDe({ parametros: { ritmo: 'sprint' } }), 'sprint');
  eq(ritmoDe({ parametros: { ritmo: 'lateral' } }), 'lateral');
  eq(ritmoDe({ parametros: { ritmo: 'espalda' } }), 'espalda');
});

test('UN RITMO NUEVO EN trazo.js FUNCIONA AQUÍ SIN TOCAR NADA', () => {
  /* La razón de preguntar a RITMOS en vez de repetir la lista. Con una
     lista escrita a mano, «andando» —que existe en RITMOS desde el
     principio— se aplanaba a «normal»: 1,5 m/s contra 4,0, casi el
     triple, y sin ningún error por ningún lado. */
  for (const r of Object.keys(RITMOS)) {
    eq(ritmoDe({ parametros: { ritmo: r } }), r, `el ritmo "${r}" de RITMOS:`);
  }
});

test('un ritmo que no existe no rompe los segundos: se anda a lo normal', () => {
  eq(ritmoDe({ parametros: { ritmo: 'volando' } }), 'normal');
  eq(ritmoDe({ parametros: {} }), 'normal');
  eq(ritmoDe({}), 'normal');
  eq(ritmoDe(null), 'normal');
});

test('defender no es pasar, aunque el defensor no lleve balón', () => {
  eq(ritmoDe(de('defiende')), 'normal');
  eq(tipoFlecha(de('defiende')), 'cut');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
