/* ============================================================
   eval-medidas.mjs — banco Node de la pista en metros
   (taller/js/canvas/medidas.js y lo que se deriva de ella:
   anclas.js, escala.js y el registro de court.js). Sin red, sin DOM.

     node taller/tools/eval-medidas.mjs

   Lo que vigila este banco no es una función: es una PROMESA. Que un
   metro mida lo mismo en los dos ejes, en las cuatro pistas y en las
   tres vistas. Antes del Tramo 2.1 no se cumplía —la media pista
   estaba estirada 1,7× en un eje respecto al otro— y el precio fue
   que las distancias había que estimarlas a ojo y que trece fichas
   soltaban el balón a metros del aro creyendo que lo dejaban dentro.
   ============================================================ */

import { readFileSync } from 'node:fs';
import {
  REGLAS, PISTAS_M, PISTA_POR_DEFECTO, TRIPLE_LATERAL, TRIPLE_CORTE,
  marcoDe, pistaAMarco, pistaANorm, limitesCancha, escalaDe, radioPx, pasoNorm,
  escalaTrazo, pxPorMetro, TAMANOS, MATERIAL,
} from '../js/canvas/medidas.js';
import { ANCLAS, posicionesDe, aroExacto } from '../js/canvas/anclas.js';
import { metrosEntre, puntoADistanciaDe } from '../js/canvas/escala.js';
import { PISTAS } from '../js/canvas/court.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
function aprox(real, esperado, tol = 1e-6, msg = '') {
  if (!(Math.abs(real - esperado) <= tol)) {
    throw new Error(`${msg} esperado≈${esperado} real=${real} (tolerancia ${tol})`);
  }
}

const TODAS = Object.keys(PISTAS_M);

/* Las anclas se guardan con cuatro decimales, que sobre el eje largo de
   la pista entera son 3,2 mm. Las comprobaciones de distancia toleran
   ese redondeo (y no más): 5 mm en metros, una diezmilésima en
   coordenada normalizada. */
const MM = 5e-3;
const REDONDEO = 1e-4;

console.log('· el dibujo cuadra consigo mismo');

/* ── OJO CON ESTOS NÚMEROS ────────────────────────────────────
   No son de FIBA y no deben «corregirse» hacia FIBA. Están medidos
   sobre los cuatro SVG que dibujó el entrenador (dev/medir-pistas.html
   muestrea los arcos y les ajusta una circunferencia; el error del
   ajuste fue 0,1 mm). El dibujo es de minibasket, que es la categoría
   del club: pista de 24 × 14, tiro libre a 4,63 y un triple de 6,28 m
   de radio.

   Antes este banco exigía 6,60 y 2,99 —cancha FIBA— y por eso salía en
   rojo: no fallaba el código, fallaba la expectativa. */

test('el tramo recto del triple corta el arco a 2,10 m del fondo', () => {
  // Se cumple sobre el dibujo al milímetro. Si alguien toca el radio,
  // el centro o el lateral del triple, deja de cerrar y salta aquí.
  /* 2,0886 con los números redondeados a dos decimales; sobre el
     dibujo se midió 2,096. Los 8 mm de diferencia son ese redondeo. */
  aprox(TRIPLE_CORTE, 2.09, 0.02);
});

test('el tramo recto va a 6,14 m del eje largo', () => {
  aprox(TRIPLE_LATERAL, 6.14, 1e-9);
});

test('la pista dibujada mide 24 × 14 y el medio campo cae a 12', () => {
  aprox(REGLAS.largo, 24, 1e-9);
  aprox(REGLAS.ancho, 14, 1e-9);
  aprox(REGLAS.medioCampo, REGLAS.largo / 2, 1e-9);
});

test('el marco de cada pista es el viewBox de su SVG', () => {
  /* 10 unidades de dibujo = 1 metro. Si el marco y el viewBox se
     separan, las fichas se pintan desplazadas sobre el fondo y no hay
     forma de verlo salvo mirando. */
  const VIEWBOX = {                       // en metros: viewBox / 10
    entera: [18, 27], entera_fiba: [18, 27],
    media: [18, 18], media_fiba: [17, 18],
  };
  for (const [pista, [w, h]] of Object.entries(VIEWBOX)) {
    const m = marcoDe(pista);
    aprox(m.ancho, w, 1e-9, `${pista} ancho:`);
    aprox(m.alto, h, 1e-9, `${pista} alto:`);
  }
});

console.log('\n· el CSS no se queda con la proporción de otra pista');

test('ningún fichero conserva la proporción del folio A4', () => {
  /* ── DE DÓNDE SALE ESTA PRUEBA ────────────────────────────
     Los SVG antiguos estaban encajados en una hoja A4, así que 0,707
     y 297/210 acabaron escritos a mano por media docena de sitios:
     valores de reserva de --court-aspect, el fondo girado del visor y
     el ancho del proyector. Con las pistas dibujadas a mano ninguna de
     las cuatro mide eso, y el proyector se salía 296 px por debajo del
     borde con la media pista, que es el 86 % de las fichas.

     El runtime siempre estuvo bien —court.js lee medidas.js—, pero un
     número escrito a mano no avisa cuando deja de ser verdad. */
  const A4 = /(?<![.\d])(?:0?\.707\d*|297\s*\/\s*210|210\s*\/\s*297|70\.71%|141\.42%)/;
  const FICHEROS = [
    'taller/css/canvas.css', 'taller/css/base.css', 'taller/css/detalle.css',
    'taller/css/wizard.css', 'equipos/css/visor.css', 'equipos/css/panel.css',
    'css/app.css', 'taller/js/ui/components.js',
  ];
  /* Los comentarios SÍ nombran el A4: cuentan por qué se quitó. Se
     borran antes de mirar, conservando los saltos de línea para no
     perder la numeración. Un comentario de bloque puede ocupar diez
     líneas, así que no vale con partir cada línea por «/*». */
  const sinComentarios = (txt) => txt
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (t, p) => p + ' '.repeat(t.length - p.length));

  const malos = [];
  for (const f of FICHEROS) {
    const ruta = new URL(`../../${f}`, import.meta.url);
    let txt;
    try { txt = readFileSync(ruta, 'utf8'); } catch { continue; }
    const limpio = sinComentarios(txt).split('\n');
    txt.split('\n').forEach((linea, i) => {
      if (A4.test(limpio[i] || '')) malos.push(`${f}:${i + 1}  ${linea.trim().slice(0, 70)}`);
    });
  }
  ok(malos.length === 0, `queda proporción de A4 escrita a mano:\n      ${malos.join('\n      ')}`);
});

test('los valores de reserva son los de la pista por defecto', () => {
  /* Solo se ven hasta que CourtView pone la variable, pero mientras
     dura, la caja se reserva torcida y la pista salta al cargar. */
  const m = marcoDe(PISTA_POR_DEFECTO);
  const derecho = m.ancho / m.alto;            // retrato: 18/27 = 0,6667
  const girado = m.alto / m.ancho;             // proyector: 1,5
  const cerca = (v, esp) => Math.abs(v - esp) < 0.002;

  const leer = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
  const reservas = [...leer('taller/css/canvas.css').matchAll(/--court-(?:bg-)?aspect,\s*([\d.]+)/g),
                    ...leer('equipos/css/visor.css').matchAll(/--court-(?:bg-)?aspect,\s*([\d.]+)/g),
                    ...leer('equipos/css/panel.css').matchAll(/--court-aspect,\s*([\d.]+)/g)]
    .map((x) => Number(x[1]));
  ok(reservas.length >= 6, `solo se han encontrado ${reservas.length} valores de reserva`);
  for (const v of reservas) {
    ok(cerca(v, derecho) || cerca(v, girado),
      `${v} no es ni ${derecho.toFixed(4)} (retrato) ni ${girado.toFixed(4)} (girada)`);
  }
});

console.log('\n· el metro es cuadrado');

for (const pista of TODAS) {
  test(`${pista}: el marco en metros y el lienzo tienen la misma proporción`, () => {
    const m = marcoDe(pista);
    aprox(m.aspect, m.ancho / m.alto, 1e-12);
  });

  test(`${pista}: 14 m a lo ancho miden 14 m`, () => {
    const a = pistaAMarco(pista, 0, -REGLAS.ancho / 2);
    const b = pistaAMarco(pista, 0, REGLAS.ancho / 2);
    aprox(Math.hypot(b[0] - a[0], b[1] - a[1]), REGLAS.ancho, 1e-9);
  });

  test(`${pista}: un metro mide lo mismo vaya en la dirección que vaya`, () => {
    // Se toman dos puntos separados 5 m en diagonal y se comprueba que
    // metrosEntre() —que es lo que usa el compilador para decidir dónde
    // se suelta el balón— devuelve 5. Con los ejes a escalas distintas
    // esto daba entre 4 y 7 según hacia dónde apuntara la diagonal.
    const lado = 3, fondo = 4;                      // 3-4-5
    const a = pistaANorm(pista, 5, 0);
    const b = pistaANorm(pista, 5 + fondo, lado);
    aprox(metrosEntre(pista, a, b), 5, 1e-9);
  });
}

console.log('\n· las anclas caen donde dice el reglamento');

for (const pista of TODAS) {
  const pos = posicionesDe(pista, 'norte');
  const d = (n) => metrosEntre(pista, pos.aro, pos[n]);

  test(`${pista}: del aro a la línea de tiros libres, 3,41 m`, () => {
    // 4,63 − 1,22 sobre el dibujo. Antes eran 4,225 (5,80 − 1,575),
    // que es la cancha FIBA y no ésta.
    aprox(d('tiro_libre'), REGLAS.zonaFondo - REGLAS.aroRetranqueo, MM);
    aprox(d('tiro_libre'), 3.41, 0.01);
  });

  test(`${pista}: de codo a codo, el ancho de la zona (4,90 m)`, () => {
    aprox(metrosEntre(pista, pos.codo_izq, pos.codo_der), REGLAS.zonaAncho, MM);
  });

  test(`${pista}: la esquina cae 35 cm por fuera del tramo recto`, () => {
    // A la altura del aro, así que la distancia al aro es el lateral
    // limpio: 6,14 dibujados + 0,35 = 6,49. Y queda 51 cm de campo
    // hasta la banda, que es lo que hace que se vea como una esquina y
    // no como un pie fuera.
    aprox(d('esquina_der'), 6.49, 0.01);
    aprox(d('esquina_izq'), 6.49, 0.01);
    ok(Math.abs(pos.esquina_der[0] - pos.esquina_izq[0]) > 0
       || Math.abs(pos.esquina_der[1] - pos.esquina_izq[1]) > 0, 'no se distinguen');
  });

  test(`${pista}: los cuatro puestos de perímetro, a la misma distancia`, () => {
    /* Equidistantes del CENTRO DEL ARCO de triple, que en este dibujo
       no es el aro: hay 45 cm entre los dos. Medirlos desde el aro
       daría cuatro números distintos y no querría decir nada. */
    const centroArco = pistaANorm(pista, REGLAS.tripleCentro, 0);
    const R = REGLAS.tripleRadio + 0.35;
    for (const n of ['alero_der', 'alero_izq', 'escolta_der', 'escolta_izq', 'base']) {
      aprox(metrosEntre(pista, centroArco, pos[n]), R, MM, n);
    }
  });

  test(`${pista}: el perímetro queda POR FUERA de la línea de triple`, () => {
    const centroArco = pistaANorm(pista, REGLAS.tripleCentro, 0);
    for (const n of ['alero_der', 'escolta_der', 'base']) {
      const r = metrosEntre(pista, centroArco, pos[n]);
      ok(r > REGLAS.tripleRadio, `${n} está dentro del arco: ${r.toFixed(2)} m`);
    }
  });

  test(`${pista}: izquierda y derecha son simétricas`, () => {
    for (const base of ['poste_bajo', 'poste_alto', 'codo', 'esquina', 'alero', 'escolta']) {
      aprox(d(`${base}_izq`), d(`${base}_der`), 1e-6, base);
    }
  });
}

test('las cuatro pistas colocan cada ancla en el mismo sitio REAL', () => {
  // El dibujo anterior las medía una por una sobre cada SVG y no
  // coincidían: la media ponía el tiro libre a 3,9 m del fondo y la
  // entera, a 6,3. Ahora salen todas de la misma tabla.
  const ref = posicionesDe('entera', 'norte');
  for (const pista of TODAS) {
    const pos = posicionesDe(pista, 'norte');
    for (const nombre of Object.keys(ref)) {
      const a = metrosEntre('entera', ref.aro, ref[nombre]);
      const b = metrosEntre(pista, pos.aro, pos[nombre]);
      aprox(b, a, MM, `${pista}/${nombre}`);
    }
  }
});

test('la pista entera reconstruye sus 28 m de aro a aro', () => {
  const n = posicionesDe('entera', 'norte'), s = posicionesDe('entera', 'sur');
  aprox(metrosEntre('entera', n.aro, s.aro) + 2 * REGLAS.aroRetranqueo, REGLAS.largo, MM);
});

test('el aro de court.js y el de anclas.js son el mismo punto', () => {
  // Vivieron años separados —uno medido sobre el arte, otro estimado— y
  // en las medias diferían 3 centésimas, que caían entre tablero y aro.
  for (const pista of TODAS) {
    for (const canasta of marcoDe(pista).canastas) {
      const a = aroExacto(pista, canasta);
      const b = PISTAS[pista].baskets[canasta];
      aprox(a[0], b[0], 1e-9, `${pista}/${canasta}.x`);
      aprox(a[1], b[1], 1e-9, `${pista}/${canasta}.y`);
    }
  }
});

console.log('\n· la banda de 2 m');

for (const pista of TODAS) {
  /* Antes se exigían 2 m por los cuatro lados. En el dibujo no es así:
     2 m a los lados, 1,5 tras la línea de fondo, y en las medias un
     trozo de pista más allá del medio campo distinto en cada una —4,5 m
     la mini y 3,5 la FIBA—. Se comprueba contra esa tabla, que es de
     donde sale el marco. */
  test(`${pista}: la banda coincide con la que está dibujada`, () => {
    const m = marcoDe(pista);
    const lim = limitesCancha(pista);
    const e = escalaDe(pista);
    const largoEs = m.orientacion === 'retrato' ? 'y' : 'x';
    const anchoEs = largoEs === 'y' ? 'x' : 'y';
    aprox(lim[largoEs][0] * e[largoEs], m.antes, 1e-9, 'tras la línea de fondo');
    aprox((1 - lim[largoEs][1]) * e[largoEs], m.despues, 1e-9, 'al otro extremo');
    aprox(lim[anchoEs][0] * e[anchoEs], m.lados, 1e-9, 'lado');
    aprox((1 - lim[anchoEs][1]) * e[anchoEs], m.lados, 1e-9, 'lado');
  });

  test(`${pista}: queda banda de sobra para poner una cola`, () => {
    // El motivo por el que existe la banda. Menos de metro y medio no
    // da para una fila de espera sin pisar el campo.
    const m = marcoDe(pista);
    for (const [lado, v] of [['antes', m.antes], ['después', m.despues], ['lados', m.lados]]) {
      ok(v >= 1.5, `${lado} solo deja ${v} m`);
    }
  });

  test(`${pista}: todas las anclas caen dentro de la cancha`, () => {
    // `centro` cae JUSTO sobre la línea: en la entera es el círculo
    // central y en la media, el borde de medio campo. Está dentro por
    // definición, y solo se sale por el redondeo a cuatro decimales.
    const lim = limitesCancha(pista);
    for (const canasta of marcoDe(pista).canastas) {
      for (const [nombre, [x, y]] of Object.entries(posicionesDe(pista, canasta))) {
        if (x < lim.x[0] - REDONDEO || x > lim.x[1] + REDONDEO || y < lim.y[0] - REDONDEO || y > lim.y[1] + REDONDEO) {
          throw new Error(`${pista}/${canasta}/${nombre} en (${x}, ${y}) fuera de la cancha`);
        }
      }
    }
  });
}

console.log('\n· elementos en metros');

test('un jugador mide 1,30 m en las cuatro pistas', () => {
  // Lo que se comprueba no es el radio en píxeles —depende del tamaño
  // del lienzo— sino que ese radio, traducido a metros, sea el mismo.
  for (const pista of TODAS) {
    const W = 800;
    const r = radioPx(pista, 'jugador', W);
    const metros = (r * 2) / (W / marcoDe(pista).ancho);
    aprox(metros, TAMANOS.jugador, 1e-9, pista);
  }
});

test('el grosor de las flechas también es el mismo tamaño real', () => {
  // arrows.js está escrito en píxeles sueltos y los multiplica por `scale`.
  // Ese factor iba con el ancho del LIENZO, así que una flecha era más
  // gruesa en metros en la media que en la entera. Ahora va con el jugador.
  const W = 800;
  const anchura = TODAS.map((p) => escalaTrazo(p, W) / pxPorMetro(p, W));
  for (const a of anchura) aprox(a, anchura[0], 1e-9);
});

test('en la entera a 600 px el factor de trazo vale 1', () => {
  // La referencia con la que se eligieron los números de arrows.js: si
  // cambia, todas las flechas del sistema engordan o adelgazan a la vez.
  aprox(escalaTrazo('entera', 600), 1, 1e-9);
});

test('la escalera mide 4,00 × 0,50 m y la pelota es menor que el balón', () => {
  aprox(MATERIAL.escalera.largo, 4.00, 1e-9);
  aprox(MATERIAL.escalera.ancho, 0.50, 1e-9);
  if (!(TAMANOS.pelota < TAMANOS.balon)) throw new Error('la pelota de tenis no puede ser mayor que el balón');
});

test('la cola de una fila avanza en metros, no en unidades de lienzo', () => {
  // El paso de la cola SE DIBUJA en píxeles (symbols.js#drawFila) y se
  // CALCULA en normalizado (compilador#sintetizarJugadores). Con un
  // paso normalizado fijo los dos no coincidían y el jugador volvía a
  // un sitio que no era el final de su cola: con tres en la fila, la
  // diferencia llegaba a varios metros y el destino acababa recortado
  // contra el borde del lienzo.
  for (const pista of TODAS) {
    for (const grados of [0, 45, 90, 180, 270]) {
      const p = pasoNorm(pista, grados, 3);
      const e = escalaDe(pista);
      aprox(Math.hypot(p.dx * e.x, p.dy * e.y), 3, 1e-9, `${pista}@${grados}°`);
    }
  }
});

console.log('\n· la operación que decide dónde muere el balón');

test('puntoADistanciaDe deja al jugador a la distancia pedida', () => {
  for (const pista of TODAS) {
    const aro = aroExacto(pista, 'norte');
    const desde = posicionesDe(pista, 'norte').base;
    const p = puntoADistanciaDe(pista, desde, aro, 1.2);
    aprox(metrosEntre(pista, p, aro), 1.2, 1e-6, pista);
  }
});

test('si ya está más cerca, no le hace retroceder', () => {
  const aro = aroExacto('media', 'norte');
  const cerca = posicionesDe('media', 'norte').poste_bajo_der;
  const p = puntoADistanciaDe('media', cerca, aro, 8);
  aprox(p.x, cerca[0], 1e-12); aprox(p.y, cerca[1], 1e-12);
});

console.log('\n· forma pública');

test('ANCLAS tiene las cuatro pistas con sus canastas', () => {
  for (const pista of TODAS) {
    const canastas = Object.keys(ANCLAS[pista].pos);
    const esperadas = marcoDe(pista).canastas;
    if (canastas.join(',') !== esperadas.join(',')) {
      throw new Error(`${pista}: canastas ${canastas.join(',')} ≠ ${esperadas.join(',')}`);
    }
  }
});

test('posicionesDe con una canasta que no existe cae a la que hay', () => {
  const a = posicionesDe('media', 'sur');
  const b = posicionesDe('media', 'norte');
  aprox(a.aro[0], b.aro[0], 1e-12); aprox(a.aro[1], b.aro[1], 1e-12);
});

test('una pista desconocida no revienta: devuelve null', () => {
  if (posicionesDe('pista_que_no_existe', 'norte') !== null) throw new Error('debería ser null');
  if (aroExacto('pista_que_no_existe', 'norte') !== null) throw new Error('debería ser null');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
