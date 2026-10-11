/* ============================================================
   dev/ejercicios-video.js — ejercicios sacados de vídeos (Reels,
   TikTok) y dibujados con el motor de la Pizarra.

   NO se sirve en producción. Cada ejercicio se construye con los mismos
   gestos de dev/jugadas-referencia.js, y se enseña en dev/jugadas.html.
   Sirve para ENTRENAR el motor: lo que el vídeo pide y la Pizarra no
   sabe hacer queda anotado en `notas`, no se arregla a escondidas.
   ============================================================ */

import { sitios, jugador, balon, cono, va, pasa, hace, siguiente } from './jugadas-referencia.js';

export const EJERCICIOS_DE_VIDEO = [
  {
    nombre: 'V1 · Desmarque en V al cono con pase de pecho',
    fuente: 'https://www.instagram.com/p/C-E7IxTt_0O/ (@500bballdrills)',
    pista: 'media',
    /* La ficha, con los campos de tools/biblioteca/MOLDE.md. Se revisa con
       el linter de fichas de la app (taller/js/wizard/lint.js). */
    ficha: {
      name: 'Desmarque en V al cono con pase de pecho',
      type: 'Pase',
      category: 'pase',
      tipo_pista: 'media',
      categoria_rama: 'Basket',
      categoria_nivel: [],
      difficulty: 3,
      intensidad: 4,
      duration_min: 6,
      duration_max: 10,
      description: 'Tres jugadores en cuatro posiciones se pasan el balón de pecho y, tras pasar, cortan en V por el cono al hueco libre.',
      objetivos: 'Trabajar el desmarque en V sin balón y el timing entre el pase y el corte, para llegar al hueco libre justo cuando llega el balón.',
      descripcion_texto: 'Tres jugadores ocupan tres de las cuatro posiciones (punta, ala izquierda, poste bajo y ala derecha) y hay un cono en la línea de tiros libres. El balón empieza en la punta. Quien tiene el balón pasa de pecho al siguiente de la cadena (punta, ala izquierda, poste, ala derecha, punta) y, nada más pasar, corre al cono, planta y corta en V al hueco libre, de modo que recibe el siguiente pase al llegar a su sitio. Mientras el balón está en el aire, el siguiente jugador ya se mueve a su nueva posición. El hueco libre cambia de sitio a cada pase y se sigue sin parar: el ciclo completo son 12 pases, en el que cada jugador pasa por las cuatro posiciones y acaba donde empezó.',
      notas: 'Puntos clave: el cono se toca antes de cortar (no se corta en diagonal sin llegar); el pase sale fuerte y a las manos del que llega, no al sitio vacío; quien va a recibir enseña la mano objetivo al cortar. Errores frecuentes: cortar antes de pasar, pasar blando por miedo a que no llegue, parar en el hueco esperando el balón. Qué NO corregir al principio: la velocidad del corte; primero el sitio y el orden. Si no sale: bajar a trote y pase sin fuerza hasta que nadie dude de a quién pasa.',
      tags: ['pase', 'pase de pecho', 'recepción', 'desmarque', 'corte', 'coordinación'],
      requisitos: {
        jugadores_min: 3,
        jugadores_max: 12,
        canastas: 1,
        estaciones: 4,
        simultaneo: true,
        material: ['balones', 'conos'],
        densidad: 'alta',
        oposicion: 'nula',
        presion: 'tiempo',
        requisito_previo: 'pasar de pecho con precisión y recibir en movimiento',
        organizacion: 'Con 12: cuatro tríos, uno por canasta, cada trío con su balón y su cono en la línea de tiros libres. Si solo hay dos canastas, trabajan dos tríos y los otros dos rotan cada dos minutos.',
        niveles: {
          base: 'Cortes trotando y pases sin fuerza; el cono es solo una referencia.',
          intermedio: 'Cortes a sprint y pase fuerte: el balón llega justo después de que llegue quien corta (como en el vídeo).',
          avanzado: 'Igual que el intermedio, con un defensor pasivo en el cono que el que corta tiene que rodear y con el pase picado.',
        },
        criterio_exito: 'Un ciclo completo (12 pases) sin que el balón caiga ni que nadie espere parado en el hueco.',
        videos: ['https://www.instagram.com/p/C-E7IxTt_0O/'],
      },
    },
    montar(t) {
      /* Vista desde el centro, como en el diagrama del vídeo: la «izquierda»
         del diagrama es alero_der en la media pista (que se dibuja de lado). */
      const S = sitios('media');
      const alaIzq = S.alero_der;        // ala izquierda del diagrama
      const alaDer = S.alero_izq;        // ala derecha del diagrama (la que empieza vacía)
      const punta = S.base;              // la posición «top»
      const poste = S.poste_bajo_der;    // poste bajo, el del lado de la ala izquierda
      const cc = S.tiro_libre;           // el cono, en la línea de tiros libres
      cono(t, cc);

      const a1 = jugador(t, 'A', punta);
      const a2 = jugador(t, 'A', alaIzq);
      const a3 = jugador(t, 'A', poste);
      balon(t, a1);

      /* Cada fase es continua, como en el vídeo: el pase siguiente sale en
         cuanto el receptor tiene el balón, y el que ha pasado corre al cono
         y corta en V al hueco libre mientras el balón sigue en el aire.

         Regla del ejercicio: el balón da la vuelta punta → ala izquierda →
         poste → ala derecha → punta, y quien pasa va (por el cono) al hueco
         que queda libre. Son 12 pases y 12 cortes en 3 fases de 4: cada
         jugador pasa por las cuatro posiciones y vuelve a la suya. */
      const paso = (de, a, hueco) => {
        pasa(t, de, a, 'pecho');
        va(t, de, 'toca', cc, null, 'sprint');
        va(t, de, 'corta', hueco, 'en_v', 'sprint');
      };

      /* Fase 1 · A1 sale con el balón desde la punta. */
      paso(a1, a2, alaDer);   // punta → ala izq; A1 al ala derecha (libre)
      paso(a2, a3, punta);    // ala izq → poste; A2 a la punta
      paso(a3, a1, alaIzq);   // poste → ala der; A3 al ala izquierda
      paso(a1, a2, poste);    // ala der → punta; A1 al poste
      siguiente(t);

      /* Fase 2 · el balón lo tiene A2 en la punta. */
      paso(a2, a3, alaDer);   // punta → ala izq; A2 al ala derecha
      paso(a3, a1, punta);    // ala izq → poste; A3 a la punta
      paso(a1, a2, alaIzq);   // poste → ala der; A1 al ala izquierda
      paso(a2, a3, poste);    // ala der → punta; A2 al poste
      siguiente(t);

      /* Fase 3 · el balón lo tiene A3 en la punta; al acabar, todos están
         donde empezaron y el balón vuelve a A1. */
      paso(a3, a1, alaDer);   // punta → ala izq; A3 al ala derecha
      paso(a1, a2, punta);    // ala izq → poste; A1 vuelve a la punta
      paso(a2, a3, alaIzq);   // poste → ala der; A2 vuelve al ala izquierda
      paso(a3, a1, poste);    // ala der → punta; A3 vuelve al poste
    },
  },
  {
    nombre: 'V2 · Mano a mano continuo y ataque al aro',
    fuente: 'https://www.tiktok.com/@one.of1.hoops/video/7638521559556132110 (Continuous DHO Attacking Drill)',
    pista: 'media',
    /* La ficha: lo del entrenador (nombre, bloque, nivel, reparto con 12,
       rotación) y, marcado como propuesta, el oficio de las notas. */
    ficha: {
      name: 'Continuous DHO Attacking Drill',
      type: 'Otro',
      category: 'entrada',
      tipo_pista: 'media',
      categoria_rama: 'Basket',
      categoria_nivel: [],
      difficulty: 3,
      intensidad: 4,
      duration_min: 8,
      duration_max: 12,
      description: 'Dos filas con balón, una a cada lado, y un jugador en cada esquina: el de la fila bota, entrega a mano al de la esquina, que sale por su espalda y finaliza en el aro.',
      objetivos: 'Trabajar el mano a mano en continuo y la finalización a canasta tras recibir en carrera, con recogida del balón y cambio de lado.',
      descripcion_texto: 'Se montan dos estaciones iguales, una a cada lado de la pista. Cada una tiene una fila de jugadores con balón en el ala, orientada hacia medio campo, un jugador en la esquina y un cono en cada sitio de salida. El primero de la fila da un bote hacia el cono de la esquina y, a medio camino entre los dos conos, entrega el balón a mano al jugador de la esquina, que sale a su encuentro, recoge el balón por detrás de quien se lo entrega y ataca el aro. Quien ha entregado rodea el cono de la esquina y sale ya a por el siguiente mano a mano, que empieza en cuanto él rodea el cono. Quien recibe finaliza con una entrada o bandeja, recoge el balón (su propio rebote si falla) y va, con él, al final de la fila del otro lado. Se repite en continuo hasta que han salido todos.',
      notas: 'Puntos clave: la entrega es a la mano, no lanzada; quien recibe sale por detrás para proteger el balón; el que entrega bota una sola vez y rodea el cono entero antes de volver. Errores frecuentes: entregar antes de llegar al punto medio, cortar el camino al rodear el cono, y no esperar el balón en la esquina. Qué NO corregir al principio: la finalización (primero el orden y el ritmo). Si no sale: salir uno a uno, esperando a que el anterior haya rodeado el cono.',
      tags: ['entrada', 'finalización', 'bandeja', 'bote', 'rebote ofensivo', 'coordinación'],
      requisitos: {
        jugadores_min: 6,
        jugadores_max: 12,
        canastas: 1,
        estaciones: 1,
        simultaneo: true,
        material: ['balones', 'conos'],
        densidad: 'alta',
        oposicion: 'nula',
        presion: 'tiempo',
        requisito_previo: 'botar con las dos manos y finalizar en bandeja en carrera',
        organizacion: 'Con 12: dos lados, cada uno con una fila de 5 con balón y uno en la esquina, que atacan el mismo aro de forma escalonada; quien remata va a la fila del otro lado.',
        niveles: {
          base: 'Entrega a paso, esperando a que el anterior haya rodeado el cono, y bandeja con la mano de siempre.',
          intermedio: 'Entrega a ritmo de partido, sin esperar, y bandeja alternando manos.',
          avanzado: 'Igual, con un cambio de ritmo en la entrega y finalización con la mano contraria.',
        },
        criterio_exito: 'Cada jugador pasa por los dos papeles sin que se caiga un balón ni se pise la entrega.',
        videos: ['https://www.tiktok.com/@one.of1.hoops/video/7638521559556132110'],
      },
    },
    montar(t) {
      /* Lo que se ve en el vídeo y cuenta el entrenador, duplicado a los dos
         lados de la pista: la fila de balones, orientada hacia medio campo,
         sale del cono del ala; el de la cabeza BOTA hacia el cono de la
         esquina y entrega a mano a medio camino al que sale de la esquina; el
         que recibe sale POR DETRÁS del que entrega y ataca el aro; el que
         entrega rodea el cono y se va ya a por el siguiente. Al acabar, quien
         ha rematado coge su rebote y va, con balón, a la fila del OTRO lado.
         Un trazo simple por movimiento. */
      const lado = (s, salida_ms) => {
        const y = (v) => +(0.5 + (v - 0.5) * s).toFixed(4);     // s = 1 abajo, -1 arriba
        const cabeza = { x: 0.36, y: y(0.80) };      // el cono de la cabeza de la fila (ala)
        const rincon = { x: 0.15, y: y(0.91) };      // el de la esquina, junto a su cono
        const entrega = { x: 0.29, y: y(0.82) };     // donde llega el que bota: a medio camino
        const recibe = { x: 0.25, y: y(0.845) };    // entre los dos conos
        const k1 = cono(t, cabeza);
        const k2 = cono(t, { x: 0.19, y: y(0.86) }); // el cono de la esquina
        /* El siguiente de la fila sale en cuanto el que ha entregado rodea el
           cono (≈2,5 s), y éste sale ya al encuentro. Separados 1,7 m y todos
           con su número. */
        t.hacerFila(k1, { n: 5, equipo: 'A', balon: true, orientacion: 0, cadencia_ms: 3000, hueco_m: 1.7, dorsales: 'todos' });
        const h = t.fichas.elementos.find((e) => e.fila_de === k1 && e.puesto === 0).id;
        const c = jugador(t, 'A', rincon);

        va(t, c, 'corta', recibe);                          // el de la esquina sale al encuentro
        const cId = t.tramos[t.tramos.length - 1].id;
        va(t, h, 'bota', entrega);                          // el de la fila da un bote hacia él…
        const hId = t.tramos[t.tramos.length - 1].id;
        pasa(t, h, c, 'mano_a_mano');                       // …y le entrega a mano
        t.tramos = t.tramos.map((x, i, arr) => (i === arr.length - 1 ? { ...x, duracion_ms: 650 } : x));
        va(t, h, 'rodea', [{ x: 0.19, y: y(0.79) }, { x: 0.13, y: y(0.87) }, rincon]);   // rodea el cono entero y queda listo para el siguiente
        /* Quien recibe sale por detrás del que entrega y ataca el aro. */
        va(t, c, 'entra', [{ x: 0.35, y: y(0.76) }, { x: 0.151, y: 0.5 }], 'bandeja');
        hace(t, c, 'tira', { variante: 'suspension', desenlace: 'entra' });   // la entrada entra
        hace(t, c, 'recoge');
        hace(t, c, 'vuelve_a_fila');
        /* El cono de la esquina solo marca la posición: lo que el camino de
           quien sale lo lea como rodeo se anula, como haría el entrenador con
           dos clics en el iconito (el primero cambia el lado, el segundo anula). */
        for (const x of t.tramos) {
          if (x.elemento_id !== c || !(x.sorteando || []).some((o) => o.cono === k2 && !o.anulado)) continue;
          t.cambiarSorteo(x.id, k2);
          t.cambiarSorteo(x.id, k2);
        }
        /* El segundo lado empieza un poco después, para que no ataquen el
           mismo aro a la vez. */
        if (salida_ms) t.tramos = t.tramos.map((x) => ((x.id === cId || x.id === hId) ? { ...x, manual: true, inicio_ms: salida_ms } : x));
        return { k1 };
      };
      const abajo = lado(1, 0);
      const arriba = lado(-1, 1500);
      /* La rotación: quien remata en un lado va a la fila del otro. */
      t.ajustarFila(abajo.k1, { vuelta: arriba.k1 });
      t.ajustarFila(arriba.k1, { vuelta: abajo.k1 });
    },
  },
  {
    nombre: 'V3 · Cyclone: transición continua a los dos aros',
    fuente: 'https://www.tiktok.com/@championship_hoops_3191/video/7663113968721956126 (Cyclone Basketball Transition Drill)',
    pista: 'entera',
    ficha: {
      name: 'Cyclone Basketball Transition Drill',
      type: 'Contraataque',
      category: 'contraataque',
      tipo_pista: 'entera',
      categoria_rama: 'Basket',
      categoria_nivel: [],
      difficulty: 2,
      intensidad: 4,
      duration_min: 8,
      duration_max: 10,
      description: 'Transición continua de un aro al otro: el que saca a la banda sale en curva rodeando el cono, recibe el pase largo y finaliza; después coge su rebote y va a la fila de enfrente.',
      objetivos: 'Trabajar la transición ofensiva a pista entera: pase de salida a la banda, carrera en curva, pase largo, finalización en el aro y comunicación entre los que salen.',
      descripcion_texto: 'Dos filas con balón, una bajo cada aro, y dos jugadores en la banda derecha a la altura de medio campo; dos conos en la banda izquierda. El primero de la fila de abajo saca a la banda y sale en curva por la izquierda rodeando el cono hasta el aro de arriba; el de la banda le da el pase largo y él finaliza con una bandeja. Coge su propio rebote y va a la fila de enfrente. A continuación sale el primero de la fila de arriba, con el mismo recorrido hacia el aro de abajo. Se repite en continuo, un aro y otro, hasta que han salido todos.',
      notas: 'Puntos clave: el pase de salida a la banda es inmediato, antes de arrancar; la carrera en curva sin frenar al rodear el cono; el pase largo se da a la carrera, delante del que corre. Errores frecuentes: arrancar sin sacar, rodear el cono muy abierto y llegar tarde, y pasar al sitio donde ya no está. Qué NO corregir al principio: la finalización (primero el orden y el ritmo). Si no sale: salir uno a uno, esperando a que el anterior haya finalizado.',
      tags: ['contraataque', 'transición', 'pase', 'bandeja', 'finalización', 'ritmo'],
      requisitos: {
        jugadores_min: 7,
        jugadores_max: 12,
        canastas: 1,
        estaciones: 2,
        simultaneo: false,
        material: ['balones', 'conos'],
        densidad: 'alta',
        oposicion: 'nula',
        presion: 'tiempo',
        requisito_previo: 'pasar de pecho en carrera y finalizar en bandeja a pista entera',
        organizacion: 'Con 12: dos filas de 5 con balón, una bajo cada aro, y dos en la banda a medio campo; un cono en cada lado. Salen de uno en uno, alternando aro.',
        niveles: {
          base: 'Salen uno a uno, esperando a que el anterior finalice; pase de pecho y bandeja con la mano de siempre.',
          intermedio: 'Sale el siguiente en cuanto el anterior pasa de medio campo; bandeja alternando manos.',
          avanzado: 'Pase largo de béisbol a la carrera y finalización con la mano contraria, sin esperar.',
        },
        criterio_exito: 'Cada jugador sale dos veces sin que se caiga un balón ni se cruce con quien viene del otro aro.',
        videos: ['https://www.tiktok.com/@championship_hoops_3191/video/7663113968721956126'],
      },
    },
    montar(t) {
      /* Borrador a partir del diagrama del vídeo (7 jugadores en pista
         entera: tres bajo el aro de abajo, dos bajo el de arriba y dos en la
         banda derecha a la altura de medio campo; dos conos en la banda
         izquierda). El de abajo, con balón, saca a la banda y sale en curva
         por la izquierda rodeando el cono hasta el aro de arriba, donde le
         llega el pase largo y finaliza; coge su rebote y va a la fila de
         enfrente. En la jugada siguiente, el de arriba hace lo mismo hacia
         el aro de abajo. */
      /* Del diagrama (píxeles) a la pista entera de la app. */
      const D = (px, py) => ({ x: +(0.057 + ((px - 22) / 271) * 0.885).toFixed(3), y: +(0.02 + ((py - 33) / 510) * 0.96).toFixed(3) });
      cono(t, D(50, 177));                       // el cono de arriba, en la banda izquierda
      cono(t, D(60, 415));                       // el de abajo, en la banda izquierda

      /* Las dos filas, cada una bajo su aro y con balón para cada uno. */
      const kAbajo = cono(t, { x: 0.30, y: 0.90 });
      t.hacerFila(kAbajo, { n: 3, equipo: 'A', balon: true, orientacion: 0, hueco_m: 2, dorsales: 'todos' });
      const kArriba = cono(t, { x: 0.70, y: 0.07 });
      t.hacerFila(kArriba, { n: 2, equipo: 'A', balon: true, orientacion: 180, hueco_m: 2, dorsales: 'todos' });
      const p1 = t.fichas.elementos.find((e) => e.fila_de === kAbajo && e.puesto === 0).id;
      const t1 = t.fichas.elementos.find((e) => e.fila_de === kArriba && e.puesto === 0).id;
      /* La rotación: quien finaliza va a la fila del otro lado. */
      t.ajustarFila(kAbajo, { vuelta: kArriba });
      t.ajustarFila(kArriba, { vuelta: kAbajo });
      const s1 = jugador(t, 'A', { x: 0.88, y: 0.50 });   // los dos de la banda, a medio campo
      const s2 = jugador(t, 'A', { x: 0.88, y: 0.57 });

      /* 1 · Hacia el aro de arriba: saca a la banda, sale en curva por la
         izquierda rodeando el cono, recibe el pase largo y finaliza. */
      pasa(t, p1, s1, 'pecho');
      va(t, p1, 'rodea', [{ x: 0.20, y: 0.52 }, { x: 0.20, y: 0.28 }, { x: 0.42, y: 0.16 }], null, 'sprint');
      pasa(t, s1, p1, 'pecho');
      hace(t, p1, 'entra', { variante: 'bandeja' });
      hace(t, p1, 'tira', { variante: 'suspension', desenlace: 'entra' });
      siguiente(t);
      /* …coge su rebote y va a la fila de enfrente. */
      hace(t, p1, 'recoge');
      hace(t, p1, 'vuelve_a_fila');
      siguiente(t);

      /* 2 · Hacia el aro de abajo, lo mismo desde arriba: el mismo equipo
         ataca ahora al otro aro, y la fase lo dice. */
      t.ponerCanastaDeFase('sur');
      pasa(t, t1, s2, 'pecho');
      va(t, t1, 'rodea', [{ x: 0.20, y: 0.50 }, { x: 0.22, y: 0.72 }, { x: 0.45, y: 0.84 }], null, 'sprint');
      pasa(t, s2, t1, 'pecho');
      hace(t, t1, 'entra', { variante: 'bandeja' });
      hace(t, t1, 'tira', { variante: 'suspension', desenlace: 'entra' });
      siguiente(t);
      hace(t, t1, 'recoge');
      hace(t, t1, 'vuelve_a_fila');
    },
  },
];
