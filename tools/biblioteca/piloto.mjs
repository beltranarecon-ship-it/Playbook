#!/usr/bin/env node
/* ============================================================
   piloto.mjs — primera tanda de la biblioteca (Bloque B).

   Dieciocho fichas escritas contra DOCTRINA.md. Deliberadamente
   variadas: analíticos de repetición, series con filas, 1c1, juego
   de dos, defensa, contraataque, un juego reducido y psicomotricidad.
   Si el molde falla, falla dieciocho veces y no doscientas.

   Las animaciones NO cuestan API: se declara la INTENCIÓN como
   entrenador y compilarAnimacion() calcula la geometría de forma
   determinista. Los juegos abiertos llevan solo el montaje, sin
   fases, por decisión del entrenador: un 3c3 con límite de botes
   puede acabar de mil maneras y animar una sola sería mentir.

     node tools/biblioteca/piloto.mjs            → escribe piloto.json
     node tools/biblioteca/piloto.mjs --lint     → lo escribe y lo revisa
   ============================================================ */

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jug, balon, cono, fila, M, E, compilarFichas } from './montaje.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));

/* Final de cada una de las dos colas de "Entradas por parejas": el cono
   está en el 45 y la cola crece hacia el fondo (dirección 180), un paso
   de 0,06 por jugador. Se calcula en vez de escribirse a mano para que
   mover la fila no deje la vuelta apuntando al vacío. */
const PASO_COLA = 0.06;
const COLA_DER = { x: M.escolta_der[0] + 0.06 - PASO_COLA * 4, y: M.escolta_der[1] };
const COLA_IZQ = { x: M.escolta_izq[0] + 0.06 - PASO_COLA * 4, y: M.escolta_izq[1] };

/* Y el final de las colas del triángulo de pase, que crecen al revés
   (dirección 0, hacia medio campo) y son de tres. */
const COLA_PUNTA = { x: M.base[0] + PASO_COLA * 3, y: M.base[1] };
const COLA_IZQ_TRI = { x: M.escolta_izq[0] + PASO_COLA * 3, y: M.escolta_izq[1] };

/* ---- las fichas ------------------------------------------------- */

export const PILOTO = [

  /* ═══ MANEJO ═══════════════════════════════════════════════ */
  {
    name: 'Los cuatro cuadrantes',
    type: 'Bote', category: 'manejo', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Bote libre por cuatro zonas cambiando de mano al cruzar, mirando al entrenador para saber adónde ir.',
    objetivos: 'Botar sin mirar el balón manteniendo el control en espacio compartido, con una decisión externa que obligue a levantar la cabeza.',
    descripcion_texto: 'Se divide la media pista en cuatro cuadrantes con conos. Todos botan a la vez, cada uno con su balón, dentro del cuadrante que el entrenador indica levantando dedos. Al cambiar de cuadrante hay que cruzar por el centro y cambiar de mano al hacerlo. Nadie puede chocar con nadie: si hay contacto, los dos implicados hacen tres cambios de mano en el sitio antes de seguir.',
    notas: 'Puntos clave: balón por debajo de la cintura y a un lado del cuerpo, no delante; la mano que no bota protege. Lo que hay que mirar como entrenador es la CABEZA, no la mano: si el niño acierta el cuadrante es que está mirando. Error frecuente en los pequeños: golpear el balón en vez de acompañarlo con la muñeca.',
    variantes: 'Base: cuadrantes fijos y cambio de mano libre, sin límite de tiempo. Intermedio: el entrenador cambia el cuadrante cada 5 segundos y obliga a cruzar por el centro. Avanzado: dos jugadores sin balón hacen de perseguidores e intentan tocar balones ajenos; quien pierde el suyo pasa a perseguir.',
    tags: ['bote', 'cabeza levantada', 'cambio de mano', 'coordinación', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva',
      requisito_previo: 'botar en el sitio con una mano sin perder el balón',
      dosis: { series: 3, cantidad: 60, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: los doce a la vez, un balón cada uno, tres por cuadrante. No usa canastas, así que puede ir en paralelo con algo de tiro en los aros.',
      criterio_exito: 'completar 60 segundos sin perder el balón ni chocar, acertando siempre el cuadrante indicado',
    },
    tablero: () => [
      jug('A', 1, 0.30, 0.25), jug('A', 2, 0.30, 0.72),
      jug('A', 3, 0.55, 0.25), jug('A', 4, 0.55, 0.72),
      cono(0.42, 0.20), cono(0.42, 0.77), cono(0.22, 0.49), cono(0.62, 0.49),
      balon(0.30, 0.25), balon(0.30, 0.72), balon(0.55, 0.25), balon(0.55, 0.72),
    ],
    intent: null,
  },

  /* ═══ BOTE ═════════════════════════════════════════════════ */
  {
    name: 'Slalom y entrada',
    type: 'Bote', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Serie clásica: slalom entre conos cambiando de mano y entrada a canasta al salir del último.',
    objetivos: 'Encadenar cambios de mano en carrera y terminar en canasta sin perder velocidad, automatizando el gesto antes de meterle un defensor.',
    descripcion_texto: 'Fila en el medio campo con tres conos separados dos metros en diagonal hacia la canasta. El primero sale botando y sortea los conos cambiando de mano en cada uno, siempre pasando el balón por delante del cuerpo y por fuera del cono. Al salir del último ataca la canasta en doble ritmo. Coge su rebote y vuelve al final de la fila por fuera.',
    notas: 'Puntos clave: el cambio de mano se hace ANTES de llegar al cono, no encima; el cuerpo se mete entre el cono y el balón. Errores frecuentes: pasar el balón por detrás del cono (no protege nada), frenar para cambiar de mano, y llegar a la canasta con dos botes de más. Si el niño mira el balón al cambiar, acorta la distancia entre conos antes que corregirle verbalmente.',
    variantes: 'Base: dos conos separados y sin entrada, terminando con parada bajo el aro. Intermedio: tres conos y entrada en doble ritmo. Avanzado: los conos se sustituyen por tres compañeros con las manos activas, que pueden tocar el balón si pasa a su alcance.',
    tags: ['bote', 'cambio de mano', 'entrada', 'doble ritmo', 'analítico', 'series'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula',
      requisito_previo: 'botar en carrera con la mano derecha y con la izquierda sin perder el balón',
      dosis: { series: 4, cantidad: 5, unidad: 'repeticiones', descanso: 40 },
      organizacion: 'Con 12: dos estaciones, una en cada canasta, seis por estación en dos filas de tres. Cada fila con su juego de conos; el que termina vuelve a la suya.',
      criterio_exito: 'cuatro de cada cinco recorridos sin perder el balón y terminando la entrada sin pasos',
      aplicacion: '1c1 en pasillo desde medio campo, donde el cambio de mano sirve para superar de verdad a alguien',
    },
    /* Cola de 4 (D5) y arrancando en 0,58: con 4 esperando y paso de
       0,06, el último cae en 0,82 — justo dentro del medio campo. A
       0,62 la cola se salía del campo. */
    tablero: () => [
      fila(0.58, 0.50, 4, 0),
      cono(0.50, 0.40, 'rodear', null, 'slalom_1'),
      cono(0.40, 0.60, 'rodear', null, 'slalom_2'),
      cono(0.30, 0.44, 'rodear', null, 'slalom_3'),
      balon(0.58, 0.50),
    ],
    intent: {
      canasta: 'norte',
      /* 'aro', no 'canasta': la ficha dice "ataca la canasta en doble
         ritmo" y con 'canasta' el bote se paraba en la línea de tiros
         libres y el tiro salía de ahí — el ejercicio se llamaba
         "Slalom y entrada" y dibujaba un tiro de 4,8 m.
         Y termina el ciclo (rebote + vuelta a la fila) porque la ficha
         lo describe: "coge su rebote y vuelve al final de la fila". */
      fases: [
        {
          eventos: [
            { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'slalom_1' },
            { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'slalom_2' },
            { jugador: 'fila1', tipo: 'rodea_cono', cono_id: 'slalom_3' },
            { jugador: 'fila1', tipo: 'bote', hacia: 'aro' },
          ],
        },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },
  {
    name: '1c1 en pasillo',
    type: '1vs1', category: 'bote', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 14,
    description: 'Uno contra uno en un pasillo estrecho: el atacante tiene que superar botando, sin espacio para rodear.',
    objetivos: 'Usar el cambio de mano y el cambio de ritmo para superar a un defensor real, no a un cono.',
    descripcion_texto: 'Se marca con conos un pasillo de unos tres metros de ancho desde medio campo hasta la canasta. Atacante con balón en un extremo, defensor delante. El atacante tiene que llegar a canasta sin salirse del pasillo; el defensor defiende de verdad pero no puede robar de espaldas. Si el atacante pisa fuera, cambio de rol. Se juega a punto: canasta vale 1, robo o salida vale 1 para el defensor.',
    notas: 'Puntos clave: el primer bote decide; si sale botando de frente y despacio, ya ha perdido. Se busca cambio de ritmo, no solo cambio de mano — un cambio de mano lento no supera a nadie. Error frecuente: botar hacia el defensor en vez de hacia el espacio que deja. Como entrenador, mira los PIES del defensor: si no ha tenido que girar la cadera, el atacante no le ha atacado de verdad.',
    variantes: 'Base: pasillo ancho de cinco metros y defensor que solo puede desplazarse lateralmente. Intermedio: pasillo de tres metros y defensa completa. Avanzado: el atacante empieza de espaldas a la canasta y tiene que girarse antes de atacar, con dos botes como máximo.',
    tags: ['bote', 'cambio de ritmo', '1c1', 'defensa del bote', 'competición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'botar con las dos manos en carrera y cambiar de mano sin frenar',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos pasillos de conos, uno hacia cada canasta, seis en cada uno. Tres parejas por pasillo que se turnan; los que esperan, detrás del cono de salida.',
      criterio_exito: 'el atacante gana más puntos que el defensor en la serie; se cambia de pareja cada serie',
    },
    tablero: () => [
      jug('A', 1, 0.62, 0.50), jug('B', 1, 0.50, 0.50),
      cono(0.62, 0.36), cono(0.62, 0.64), cono(0.30, 0.36), cono(0.30, 0.64),
      balon(0.62, 0.50),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ PASE ═════════════════════════════════════════════════ */
  {
    name: 'Triángulo de pase y sigue',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 2, duration_min: 6, duration_max: 10,
    description: 'Tres posiciones en triángulo, pase y voy detrás del que recibe, con un defensor pasivo que obliga a elegir el tipo de pase.',
    objetivos: 'Automatizar el pase de pecho y el picado eligiendo cuál según dónde estén las manos del defensor.',
    descripcion_texto: 'Tres filas cortas en el 45 derecho, el 45 izquierdo y la punta. Se pasa y se corre detrás de la fila a la que se ha pasado. En el centro del triángulo hay un jugador con las manos arriba que no roba, solo estorba: si tiene las manos altas hay que pasar picado, si las tiene bajas hay que pasar de pecho. El pasador dice en voz alta qué pase va a hacer antes de hacerlo.',
    notas: 'Puntos clave: paso adelante con la pierna contraria y extensión de brazos hasta dejar los pulgares hacia abajo; el picado bota a dos tercios de la distancia, no a la mitad. Errores frecuentes: pasar con las dos manos desde el pecho sin dar el paso, y pasar a donde está el compañero en vez de a donde va. Es el ejercicio donde más rápido se instala la pereza: si el pase no llega tenso, córtalo y repite.',
    variantes: 'Base: sin defensor central, alternando un tipo de pase por vuelta. Intermedio: con defensor pasivo que decide el tipo de pase. Avanzado: dos balones a la vez en el triángulo, obligando a recibir y pasar sin mirar dónde está el segundo balón.',
    tags: ['pase', 'pase de pecho', 'pase picado', 'recepción', 'toma de decisiones'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 15, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'media', oposicion: 'pasiva',
      requisito_previo: 'recibir con las dos manos sin que se le caiga el balón',
      dosis: { series: 3, cantidad: 20, unidad: 'repeticiones', descanso: 30 },
      organizacion: 'Con 12: dos triángulos en paralelo, uno en cada media pista, seis en cada uno (tres filas de dos). No usa canastas.',
      criterio_exito: 'veinte pases seguidos del tipo correcto sin que el balón toque el suelo fuera del picado',
    },
    /* TRES FILAS, como dice la ficha, no tres jugadores sueltos: el
       tablero enseñaba tres fichas y el texto prometía "tres filas
       cortas", así que el entrenador no veía dónde se pone el resto del
       grupo — que es justo lo que hay que saber para montarlo. */
    tablero: () => [
      fila(M.escolta_der[0], M.escolta_der[1], 3, 0),
      fila(M.base[0], M.base[1], 3, 0),
      fila(M.escolta_izq[0], M.escolta_izq[1], 3, 0),
      jug('B', 1, 0.37, 0.496),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      /* El "y sigue" es la mitad del ejercicio: cada uno corre detrás
         de la fila A LA QUE HA PASADO (no a la suya), así que la vuelta
         va a un punto explícito y no con 'vuelve_a_fila'.
         La animación se para cuando el balón llega a la tercera fila:
         cerrar el triángulo obligaría a sacar al siguiente de la primera
         cola (fila1_2), que arranca EN el cono y se dibujaría encima del
         que aún no se ha ido. Con las colas a la vista se entiende igual
         que el ciclo sigue.
         Y el defensor central estorba de verdad —se mete en cada línea
         de pase—, que es lo que obliga a elegir entre picado y de pecho. */
      fases: [
        {
          eventos: [
            { jugador: 'fila1', tipo: 'pase', a: 'fila2' },
            { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.392, y: 0.575 } },
          ],
        },
        {
          eventos: [
            { jugador: 'fila1', tipo: 'corte', hacia: { x: COLA_PUNTA.x, y: COLA_PUNTA.y } },
            { jugador: 'fila2', tipo: 'pase', a: 'fila3' },
            { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.392, y: 0.418 } },
          ],
        },
        {
          eventos: [
            { jugador: 'fila2', tipo: 'corte', hacia: { x: COLA_IZQ_TRI.x, y: COLA_IZQ_TRI.y } },
            { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.375, y: 0.496 } },
          ],
        },
      ],
    },
  },
  {
    name: 'Cuatro esquinas con intruso',
    type: 'Pase', category: 'pase', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Cuatro atacantes en las esquinas de un cuadrado y dos defensores dentro: hay que conservar el balón leyendo dónde no están.',
    objetivos: 'Entrenar la decisión de pasar —cuándo, a quién y de qué forma— con presión real y sin bote.',
    descripcion_texto: 'Cuadrado de unos seis metros marcado con conos. Cuatro atacantes en las esquinas, dos defensores dentro. No se puede botar y no se puede devolver el balón a quien te lo ha pasado. Los atacantes pueden desplazarse por su lado del cuadrado pero no cruzarlo. Diez pases seguidos es un punto; robo o balón fuera y entra a defender quien lo perdió.',
    notas: 'Puntos clave: pedir el balón con la mano lejos del defensor, y recibir con los pies ya orientados al siguiente pase. Lo que hay que corregir no es el pase malo, es la recepción parada: casi siempre el problema estaba un segundo antes. Error frecuente: pasar en cuanto reciben, sin mirar; obliga a que digan el número del compañero al que pasan.',
    variantes: 'Base: un solo defensor y sí se puede devolver el pase. Intermedio: dos defensores y prohibido devolver. Avanzado: dos defensores y máximo dos segundos con el balón en las manos.',
    tags: ['pase', 'recepción', 'toma de decisiones', 'lectura', 'espaciado', 'oposición'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 0, estaciones: 2,
      material: ['balones', 'conos', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'pasar de pecho y picado a cinco metros sin que el balón pierda dirección',
      dosis: { series: 4, cantidad: 3, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos cuadrados, uno en cada media pista, seis por cuadrado: cuatro en las esquinas y dos de intrusos. Los intrusos cambian cada minuto.',
      criterio_exito: 'llegar a diez pases seguidos al menos dos veces por serie',
    },
    tablero: () => [
      jug('A', 1, 0.30, 0.30), jug('A', 2, 0.30, 0.70),
      jug('A', 3, 0.58, 0.30), jug('A', 4, 0.58, 0.70),
      jug('B', 1, 0.40, 0.44), jug('B', 2, 0.48, 0.56),
      cono(0.30, 0.30), cono(0.30, 0.70), cono(0.58, 0.30), cono(0.58, 0.70),
      balon(0.30, 0.30),
    ],
    intent: null,
  },

  /* ═══ TIRO ═════════════════════════════════════════════════ */
  {
    name: 'Mecánica bajo el aro',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 2, duration_min: 5, duration_max: 8,
    description: 'Tiro desde debajo del aro, tan cerca que no haga falta empujar el balón, por parejas y con corrección inmediata.',
    objetivos: 'Instalar la mecánica de tiro sin que la distancia obligue a compensar con el cuerpo.',
    descripcion_texto: 'Por parejas, uno tira y el otro coge el rebote y devuelve. El tirador se coloca a un metro del aro, en el lado del poste bajo. Diez tiros y se cambia. La distancia no aumenta hasta que el gesto se mantiene: pies orientados, balón que baja y sube por delante del cuerpo, mano de tiro debajo y mano guía al lado, extensión completa y muñeca que acaba colgando.',
    notas: 'PUNTO CLAVE del bloque: a esta edad se PERMITE el codo más bajo y pegado al cuerpo. Forzar la mecánica del adulto a un niño sin fuerza produce el empujón desde el pecho, que es el hábito que después cuesta años quitar. Errores frecuentes: la mano guía empuja y desvía el balón; los pies acaban cruzados; el niño mira el balón en lugar del aro. Corrección que más rinde: que se quede quieto con el brazo arriba hasta que el balón toque el aro.',
    variantes: 'Base: a un metro del aro y sin saltar, sentado o de rodillas si hace falta para quitar las piernas de la ecuación. Intermedio: de pie, a dos metros, alternando los dos lados del poste bajo. Avanzado: desde el codo, y cada dos tiros uno tras recepción del compañero.',
    tags: ['tiro', 'mecánica de tiro', 'analítico', 'series'],
    requisitos: {
      jugadores_min: 2, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula',
      requisito_previo: 'sostener el balón con una mano debajo y la otra al lado sin que se caiga',
      dosis: { series: 4, cantidad: 10, unidad: 'repeticiones', descanso: 30 },
      organizacion: 'Con 12: seis parejas, tres en cada canasta, repartidas a un metro del aro por los dos lados y el frontal. Diez tiros y cambio dentro de la pareja.',
      criterio_exito: 'siete de cada diez entran, y el brazo se queda arriba en las diez',
      aplicacion: 'tiro tras recepción con cierre del defensor, donde el mismo gesto tiene que salir con prisa',
    },
    /* El tirador, a UN METRO del aro: es lo que dice la ficha palabra
       por palabra ("el tirador se coloca a un metro del aro"), y antes
       la pizarra lo ponía a 2,7 m — la distancia a la que este ejercicio
       deja de tener sentido, porque a esa distancia ya hay que empujar
       el balón, que es justo lo que viene a corregir. */
    tablero: () => [
      jug('A', 1, 0.192, 0.545),
      jug('A', 2, M.poste_bajo_izq[0] + 0.03, M.poste_bajo_izq[1]),
      balon(0.192, 0.545),
    ],
    intent: {
      canasta: 'norte',
      /* Las tres fases son el ciclo de la pareja: tiro, el compañero
         coge el rebote y devuelve. Antes había UNA fase con el tiro y un
         corte, y se veía un tiro suelto: no se entendía que el ejercicio
         es por parejas y que no para. */
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'A2', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
      ],
    },
  },
  {
    name: 'Tiro tras recepción con cierre',
    type: 'Tiro', category: 'tiro', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Recepción en el codo con un defensor que sale a cerrar: tirar si llega tarde, botar y entrar si llega a tiempo.',
    objetivos: 'Que el mismo gesto de tiro salga con prisa, y que el jugador decida entre tirar y penetrar leyendo al defensor.',
    descripcion_texto: 'Un pasador en la punta, un tirador en el codo y un defensor que parte desde debajo del aro. Al pase, el defensor sale a cerrar. El tirador tiene que decidir: si el defensor llega con las manos bajas o tarde, tira; si llega a tiempo y frenando, finta y entra con un bote. Se rotan las tres posiciones cada cinco repeticiones.',
    notas: 'Puntos clave: los pies se orientan al aro ANTES de que llegue el balón, no después; la lectura se hace sobre las manos y la velocidad del defensor, no sobre la distancia. Error frecuente: decidir antes de recibir — se nota porque tiran igual aunque el defensor les haya llegado encima. Regla útil para ellos: "si le ves las manos, entra; si le ves el pecho, tira".',
    variantes: 'Base: sin decisión, el defensor sale siempre tarde y el tirador siempre tira. Intermedio: el defensor elige y el tirador lee. Avanzado: el defensor puede salir a cerrar o quedarse; si se queda, el tirador tiene dos segundos para decidir.',
    tags: ['tiro', 'tiro tras recepción', 'recepción', 'lectura', 'toma de decisiones', 'finta'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'semiactiva',
      requisito_previo: 'tirar desde el codo con la mecánica estable y sin empujar',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos que rotan tirador, pasador y defensor.',
      criterio_exito: 'acierta la decisión (tirar o entrar) en cuatro de cada cinco, aunque falle el tiro',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.codo_der[0], M.codo_der[1]),
      jug('B', 1, 0.22, 0.55),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ ENTRADA ══════════════════════════════════════════════ */
  {
    name: 'Entradas por parejas desde el 45',
    type: 'Tiro', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Entradas a canasta en doble ritmo desde el 45, con pase previo y cola corta.',
    objetivos: 'Automatizar el doble ritmo por ambos lados partiendo de una recepción en movimiento.',
    descripcion_texto: 'Dos filas en los 45. El primero de la fila derecha pasa al primero de la izquierda, que recibe en carrera y entra a canasta en doble ritmo. Cada uno va a la fila contraria a la suya, de modo que todos entran por los dos lados. Con dos balones el ejercicio no para.',
    notas: 'Puntos clave: paso largo de entrada y paso corto de impulso; la extensión sube con la pierna contraria al brazo de tiro. Errores frecuentes: llegar frenando y saltar hacia delante en vez de hacia arriba; coger el balón con las dos manos demasiado tarde. Corrección que más rinde: marcar en el suelo con dos conos dónde caen los dos apoyos.',
    variantes: 'Base: sin pase, saliendo ya botando desde tres metros. Intermedio: con pase previo y cambiando el lado de entrada cada repetición. Avanzado: con un defensor que persigue desde atrás y obliga a decidir entrada o parada y tiro.',
    tags: ['entrada', 'doble ritmo', 'recepción', 'finalización', 'analítico', 'series'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'nula',
      requisito_previo: 'coordinar dos apoyos con el balón en las manos sin dar pasos',
      dosis: { series: 3, cantidad: 6, unidad: 'repeticiones', descanso: 30 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación en dos filas de tres (una en cada 45). Dos balones por estación para que no pare.',
      criterio_exito: 'ocho de cada diez entradas terminan con el balón tocando el tablero antes que el aro',
      aplicacion: '2c2 en media pista con entrada obligatoria tras el pase',
    },
    /* Dos balones, como dice la ficha ("con dos balones el ejercicio no
       para"): uno por fila. Antes el tablero solo tenía uno y el texto
       prometía algo que la pizarra no enseñaba. */
    tablero: () => [
      fila(M.escolta_der[0] + 0.06, M.escolta_der[1], 4, 180),
      fila(M.escolta_izq[0] + 0.06, M.escolta_izq[1], 4, 180),
      balon(M.escolta_der[0] + 0.06, M.escolta_der[1]),
      balon(M.escolta_izq[0] + 0.06, M.escolta_izq[1]),
    ],
    intent: {
      canasta: 'norte',
      /* 'aro': es una ENTRADA. Con 'canasta' el receptor se paraba en el
         codo y tiraba desde ahí — 3,2 m, un tiro de media distancia en
         un ejercicio cuyo criterio de éxito habla del tablero.

         La vuelta va a la fila CONTRARIA, que es la gracia del ejercicio
         ("todos entran por los dos lados"), así que no vale
         'vuelve_a_fila' —que devuelve a cada uno a SU cola— sino un
         destino explícito al final de la otra. */
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'pase', a: 'fila2' }] },
        { eventos: [{ jugador: 'fila2', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'fila2', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila2', tipo: 'recoge' }] },
        {
          eventos: [
            { jugador: 'fila2', tipo: 'bote', hacia: { x: COLA_DER.x, y: COLA_DER.y } },
            { jugador: 'fila1', tipo: 'corte', hacia: { x: COLA_IZQ.x, y: COLA_IZQ.y } },
          ],
        },
      ],
    },
  },
  {
    name: 'Entrada con perseguidor',
    type: '1vs1', category: 'entrada', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 4, duration_min: 8, duration_max: 12,
    description: 'Entrada a canasta con un defensor que sale un segundo después: hay que llegar antes o resolver con el cuerpo.',
    objetivos: 'Finalizar bajo presión, decidiendo entre entrar directo, cambiar de mano o parar y tirar.',
    descripcion_texto: 'Atacante en la punta con balón; defensor un paso por detrás. A la señal el atacante ataca la canasta y el defensor le persigue. El defensor no puede tocar el brazo de tiro pero sí acompañar y molestar. Se rotan los papeles en cada repetición y se cuenta cuántas canastas mete cada uno como atacante.',
    notas: 'Puntos clave: proteger el balón con el cuerpo entre el defensor y el balón durante todo el trayecto; la última mano es la de fuera. Error frecuente: mirar al defensor por encima del hombro, que frena la carrera. Si el atacante llega siempre y el defensor nunca, adelanta la salida del defensor medio segundo hasta que sea de verdad una carrera.',
    variantes: 'Base: el defensor sale dos segundos después y solo persigue, sin saltar. Intermedio: un segundo de ventaja y defensa completa. Avanzado: salen a la vez y el atacante empieza de espaldas.',
    tags: ['entrada', 'finalización', '1c1', 'bote de protección', 'competición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'alta', oposicion: 'semiactiva',
      requisito_previo: 'entrar en doble ritmo por los dos lados sin defensa',
      dosis: { series: 3, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación. Tres parejas que se turnan; se cambia atacante y perseguidor cada tres entradas.',
      criterio_exito: 'anotar más de la mitad de las entradas como atacante contra un defensor que sale un segundo después',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('B', 1, M.base[0] + 0.06, M.base[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      /* 'aro': el perseguidor persigue hasta el final. Con 'canasta' el
         atacante frenaba a 2,3 m y tiraba — y entonces el defensor de
         atrás no molesta nada, que es todo el ejercicio. */
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro' }] },
      ],
    },
  },

  /* ═══ JUEGO DE PIES ════════════════════════════════════════ */
  {
    name: 'Parada y salida ante el cono',
    type: 'Bote', category: 'juego-de-pies', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 2, intensidad: 3, duration_min: 6, duration_max: 10,
    description: 'Llegar botando, parar en dos tiempos ante el cono, pivotar y salir por el lado contrario.',
    objetivos: 'Parar equilibrado con el balón en las manos y salir sin pasos, que es lo que permite jugar después de haber botado.',
    descripcion_texto: 'Fila con balón en medio campo y un cono a la altura del tiro libre. Se llega botando, se para en dos tiempos justo antes del cono, se pivota sobre el pie de atrás y se sale botando por el lado contrario hacia la canasta. Un compañero al lado del cono levanta un brazo u otro para indicar hacia qué lado hay que salir.',
    notas: 'Puntos clave: la parada baja el centro de gravedad, con los pies a la anchura de los hombros; el pie de pivote no se levanta hasta que el balón sale de las manos. Error frecuente y muy caro: arrastrar el pie de pivote al salir, que es pasos y no lo ven. Como entrenador, mírale el PIE, no el balón. Segundo error: parar de pie, alto y rígido, con lo que la salida es lentísima.',
    variantes: 'Base: sin bote, llegando andando y practicando solo la parada y el pivote. Intermedio: llegando botando y saliendo hacia el lado que indica el compañero. Avanzado: el compañero pasa a defender pasivamente después de indicar, y hay que salir de verdad.',
    tags: ['parada', 'pivote', 'salida en bote', 'bote', 'coordinación'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'pasiva',
      requisito_previo: 'botar en carrera y recoger el balón con las dos manos sin que se le escape',
      dosis: { series: 3, cantidad: 8, unidad: 'repeticiones', descanso: 40 },
      organizacion: 'Con 12: dos estaciones, una por canasta, seis por estación: fila de cinco y el compañero que señala el lado. El que señala cambia cada vuelta.',
      criterio_exito: 'ocho paradas seguidas sin arrastrar el pie de pivote, comprobadas por el compañero',
    },
    /* La cola arranca en 0,58 y no en 0,66: con 4 esperando y paso de
       0,06, el último caía en 0,90 y el medio campo acaba en 0,829 — el
       que volvía a la fila se salía de la pista. */
    tablero: () => [
      fila(0.58, 0.50, 4, 0),
      jug('B', 1, M.tiro_libre[0] - 0.03, M.tiro_libre[1]),
      cono(M.tiro_libre[0], M.tiro_libre[1]),
      balon(0.58, 0.50),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'tiro_libre' }] },
        // "se sale botando por el lado contrario HACIA LA CANASTA": la
        // salida termina en el aro, no en el ancla del poste bajo.
        { eventos: [{ jugador: 'fila1', tipo: 'bote', hacia: 'aro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'tiro' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'recoge' }] },
        { eventos: [{ jugador: 'fila1', tipo: 'vuelve_a_fila' }] },
      ],
    },
  },

  /* ═══ 1c1 ══════════════════════════════════════════════════ */
  {
    name: '1c1 desde el 45 con dos botes',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 10, duration_max: 15,
    description: 'Uno contra uno desde el 45 con un máximo de dos botes, para obligar a atacar de verdad en lugar de bailar.',
    objetivos: 'Resolver el uno contra uno con una intención clara desde el primer apoyo, sin gastar botes en tantear.',
    descripcion_texto: 'Atacante en el 45 con balón, defensor delante. Máximo dos botes para terminar. Se puede tirar, entrar o parar y tirar, pero no se puede volver atrás. El defensor defiende completo. Cinco ataques cada uno y se cambia de pareja. La restricción de dos botes es el corazón del ejercicio: sin ella se convierte en un concurso de botes.',
    notas: 'Puntos clave: el primer apoyo ya va hacia el aro; el balón se protege bajo y lejos del defensor. Lo que hay que corregir no es la finta, es la SALIDA: casi todos fintan bien y luego salen despacio y de frente. Error frecuente: botar antes de decidir. Regla que ayuda: "mira el aro antes del primer bote".',
    variantes: 'Base: tres botes y defensor que no puede robar. Intermedio: dos botes y defensa completa. Avanzado: un solo bote, y si el defensor gana la posición hay que buscar el pase a un compañero en la esquina.',
    tags: ['1c1', 'bote', 'finta', 'toma de decisiones', 'ventaja', 'competición'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'real',
      requisito_previo: 'salir en bote con las dos manos y parar en dos tiempos sin pasos',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos canastas, seis por canasta. Tres parejas que se turnan; las que esperan, en el 45 contrario y listas para entrar sin pausa.',
      criterio_exito: 'terminar la jugada dentro de los dos botes en cinco de cada cinco, aunque no se anote',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'codo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },
  {
    name: 'Desmarque para recibir',
    type: '1vs1', category: '1c1', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Uno contra uno sin balón: ganar la posición para recibir ante un defensor que lo impide.',
    objetivos: 'Aprender a aparecer donde el pase es posible, cambiando de ritmo y de dirección para separarse del defensor.',
    descripcion_texto: 'Pasador en la punta con balón. Atacante en el 45 y defensor pegado. El atacante tiene cinco segundos para recibir; puede usar cualquier recurso —cambio de ritmo, corte a canasta y vuelta, ir al fondo— pero no salirse de su mitad de la pista. Si recibe, ataca inmediatamente el 1c1. Se rota pasador, atacante y defensor.',
    notas: 'Puntos clave: el desmarque empieza yendo hacia el defensor y no huyendo de él; se pide el balón con la mano de fuera y con las palmas, no con el dedo. Error frecuente: ir siempre al mismo sitio a la misma velocidad, con lo que el defensor lo aprende en dos repeticiones. Si el atacante nunca recibe, deja que el pasador se mueva un paso: casi siempre el problema es el ángulo, no el desmarque.',
    variantes: 'Base: el defensor solo puede seguir, sin anticipar, y el atacante tiene ocho segundos. Intermedio: cinco segundos y defensa completa. Avanzado: dos atacantes y dos defensores en el mismo lado, con lo que aparece el espacio del compañero.',
    tags: ['desmarque', 'recepción', 'corte', '1c1', 'cambio de ritmo', 'lectura'],
    requisitos: {
      jugadores_min: 3, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones'], densidad: 'media', oposicion: 'semiactiva',
      requisito_previo: 'correr cambiando de dirección sin perder el equilibrio',
      dosis: { series: 3, cantidad: 5, unidad: 'repeticiones', descanso: 45 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta, en tríos: pasador, atacante y defensor. Rotan las tres posiciones.',
      criterio_exito: 'recibir dentro de los cinco segundos en cuatro de cada cinco intentos',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]),
      jug('A', 2, M.alero_der[0], M.alero_der[1]),
      jug('B', 1, M.alero_der[0] - 0.05, M.alero_der[1] - 0.03),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'esquina_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'corte', hacia: 'escolta_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
      ],
    },
  },

  /* ═══ JUEGO DE DOS ═════════════════════════════════════════ */
  {
    name: 'Pasar y cortar en 2c2',
    type: '2vs2', category: 'juego-de-2', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 10, duration_max: 15,
    description: 'Dos contra dos donde el que pasa está obligado a cortar a canasta: la ventaja aparece sin necesidad de bloqueos.',
    objetivos: 'Entender que después de pasar hay que moverse, y que el corte al aro es la forma más simple de generar ventaja entre dos.',
    descripcion_texto: 'Dos atacantes —punta y 45— contra dos defensores. Quien pasa está obligado a cortar hacia canasta, y el receptor tiene que mirarle: si el corte queda libre, pase y canasta. Si no, el cortador sale al lado contrario y se vuelve a empezar. Máximo tres pases antes de terminar la jugada. Se juega a tres canastas y rotan.',
    notas: 'Puntos clave: el corte pasa POR DELANTE del defensor si este mira el balón, y por detrás si le está mirando a él; el receptor bota una vez hacia el centro para abrir el ángulo de pase. Error frecuente: cortar despacio y con la mano baja, con lo que el pase nunca llega. Otro error, del receptor: mirar al aro en lugar de mirar el corte. En minibasket este ejercicio da más rendimiento que cualquier bloqueo (D23).',
    variantes: 'Base: los defensores solo pueden defender al de balón, y el corte va siempre libre. Intermedio: defensa completa y máximo tres pases. Avanzado: si el corte no recibe, el cortador tiene que salir a la esquina contraria y el ataque continúa con dos pases más.',
    tags: ['pasar y cortar', 'corte', 'espaciado', 'pase', 'lectura', 'ventaja'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'pasar en movimiento y recibir orientado al aro',
      dosis: { series: 4, cantidad: 3, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan fuera; entran cada dos ataques.',
      criterio_exito: 'al menos una canasta de cada tres nace del corte y no del uno contra uno',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.escolta_der[0], M.escolta_der[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]), jug('B', 2, M.escolta_der[0] - 0.05, M.escolta_der[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A2', tipo: 'pase', a: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ DEFENSA ══════════════════════════════════════════════ */
  {
    name: 'Ayuda y recuperación en 2c2',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 4, duration_min: 10, duration_max: 15,
    description: 'Dos contra dos donde el defensor del lado contrario tiene que ayudar en la penetración y volver a su par.',
    objetivos: 'Que la ayuda se entienda como una ida y una vuelta, no como un sitio donde quedarse.',
    descripcion_texto: 'Dos atacantes, uno en el 45 con balón y otro en la esquina contraria; sus dos defensores. El atacante con balón penetra obligatoriamente. El defensor del atacante sin balón tiene que salir a cortar la penetración y volver corriendo a su par, que buscará el hueco. El ataque solo puede terminar con entrada o con tiro del que estaba en la esquina.',
    notas: 'PUNTO CLAVE del bloque, y además es reglamento: la ayuda SIEMPRE lleva su recuperación. Quedarse dentro de la zona sin defender a nadie más de tres segundos está sancionado (D11). Puntos clave: se ayuda con el pecho y los pies, no con las manos; se sale a ayudar antes de que el atacante llegue, no cuando ya está. Error frecuente: ayudar y quedarse mirando. En este ejercicio NO se entrena negar la línea de pase: a esta edad son tres tareas a la vez y no salen (D22).',
    variantes: 'Base: el atacante de la esquina no se mueve y solo hay que ayudar y volver. Intermedio: el de la esquina se desplaza para buscar el hueco. Avanzado: los dos atacantes pueden intercambiar posiciones antes de empezar, y el ataque tiene libertad total.',
    tags: ['ayuda', 'recuperación', 'defensa individual', 'desplazamiento defensivo', 'lectura'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'mantener la postura defensiva y desplazarse lateralmente sin cruzar los pies',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos grupos de seis, uno por canasta. Juegan cuatro y dos esperan; se cambia ataque y defensa cada cuatro posesiones.',
      criterio_exito: 'la defensa evita la canasta en tres de cada cuatro, y el ayudante llega siempre a recuperar a su par',
    },
    tablero: () => [
      jug('A', 1, M.escolta_der[0], M.escolta_der[1]), jug('A', 2, M.esquina_izq[0], M.esquina_izq[1]),
      jug('B', 1, M.escolta_der[0] - 0.05, M.escolta_der[1]), jug('B', 2, M.esquina_izq[0] + 0.05, M.esquina_izq[1] + 0.05),
      balon(M.escolta_der[0], M.escolta_der[1]),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }, { jugador: 'B2', tipo: 'defiende', marca: 'A2' }] },
        { eventos: [{ jugador: 'B2', tipo: 'defiende', hacia: { x: M.poste_bajo_izq[0] + 0.04, y: M.poste_bajo_izq[1] } }] },
        /* De las dos salidas que permite la ficha —entrada o tiro del de
           la esquina— se dibuja la ENTRADA: el de la esquina ataca el
           hueco que acaba de dejar el ayudante. Antes se dibujaba el
           tiro, y salía desde la esquina, a 6,6 m del aro: una distancia
           a la que un alevín no llega, así que el ejercicio terminaba
           enseñando algo que en el partido no va a pasar.
           El corte va PRIMERO en la fase para que el pase y la
           recuperación de B2 lean ya su posición de llegada. */
        {
          eventos: [
            { jugador: 'A2', tipo: 'corte', hacia: 'aro' },
            { jugador: 'A1', tipo: 'pase', a: 'A2' },
            { jugador: 'B2', tipo: 'defiende', marca: 'A2' },
          ],
        },
        { eventos: [{ jugador: 'A2', tipo: 'tiro' }] },
      ],
    },
  },
  {
    name: 'Defensa del bote en pasillo',
    type: 'Defensa', category: 'defensa', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 6, duration_max: 10,
    description: 'El mismo pasillo del 1c1, visto desde la defensa: frenar el avance sin cruzar los pies ni tocar.',
    objetivos: 'Sostener la postura y el desplazamiento defensivo contra un atacante que avanza de verdad.',
    descripcion_texto: 'Pasillo de tres metros con conos. El atacante avanza botando hacia la canasta a ritmo constante, sin fintas, y el defensor tiene que mantenerse delante todo el recorrido sin tocarle. Ida defendiendo, vuelta atacando. Se cuenta cuántas veces el defensor llega a la canasta habiendo estado siempre por delante.',
    notas: 'Puntos clave: pies más anchos que los hombros, peso en la planta, y desplazamiento sin juntar nunca los pies. Error frecuente: cruzar los pies al girar, que es exactamente cuando el atacante pasa; y mirar el balón en vez del pecho del atacante. Corrección útil: que el defensor lleve las manos a la espalda las dos primeras series, para que defienda con los pies y no con los brazos.',
    variantes: 'Base: el atacante avanza andando y en línea recta. Intermedio: el atacante corre y puede hacer un cambio de mano. Avanzado: el atacante ataca libre y el defensor puede robar.',
    tags: ['postura defensiva', 'desplazamiento defensivo', 'defensa del bote', 'defensa individual'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 14, canastas: 1, estaciones: 2,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'mantenerse en postura defensiva diez segundos sin levantarse',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 60 },
      organizacion: 'Con 12: dos pasillos de conos, uno hacia cada canasta, seis en cada uno. Tres parejas que se turnan atacante y defensor.',
      criterio_exito: 'llegar a la canasta por delante del atacante en tres de cada cuatro recorridos, sin tocar',
    },
    tablero: () => [
      jug('A', 1, 0.66, 0.50), jug('B', 1, 0.56, 0.50),
      cono(0.66, 0.36), cono(0.66, 0.64), cono(0.28, 0.36), cono(0.28, 0.64),
      balon(0.66, 0.50),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'tiro_libre' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
      ],
    },
  },

  /* ═══ CONTRAATAQUE ═════════════════════════════════════════ */
  {
    name: 'Dos contra uno continuo',
    type: 'Contraataque', category: 'contraataque', tipo_pista: 'entera',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 3, intensidad: 5, duration_min: 10, duration_max: 15,
    description: 'Superioridad de dos contra uno de canasta a canasta, encadenada para que no pare nunca.',
    objetivos: 'Resolver la superioridad numérica sin precipitarse: correr los carriles, atacar al defensor y decidir tarde.',
    descripcion_texto: 'Dos atacantes salen desde el fondo hacia la canasta contraria con un defensor esperando. Al terminar la jugada, el que ha tirado se queda de defensor y los otros dos vuelven atacando hacia la otra canasta con el que estaba defendiendo. Así el ejercicio no se detiene y todos pasan por los tres papeles.',
    notas: 'Puntos clave: los dos atacantes corren por carriles separados, no juntos; el que lleva el balón ataca al defensor y NO pasa hasta que el defensor se compromete. Error frecuentísimo: pasar demasiado pronto, con lo que el defensor recupera y la superioridad se evapora. Regla que ayuda: "no pases hasta que le veas los pies quietos". Segundo error: llegar los dos por el centro.',
    variantes: 'Base: dos contra uno con el defensor obligado a quedarse debajo del aro. Intermedio: defensor libre. Avanzado: tres contra dos, que obliga a leer a dos defensores en lugar de a uno.',
    tags: ['contraataque', 'transición', 'superioridad', 'carriles', 'toma de decisiones', 'pase'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 15, canastas: 2, estaciones: 1,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'botar en carrera a velocidad alta y pasar sin frenar',
      dosis: { series: 4, cantidad: 4, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: un solo grupo en pista entera con las dos canastas. Salen de tres en tres sin parar; los otros nueve esperan por orden en la línea de fondo.',
      criterio_exito: 'anotar en tres de cada cuatro superioridades, y que la mitad de las canastas nazcan de pase y no de entrada directa',
    },
    tablero: () => [
      jug('A', 1, E.escolta_izq[0], 0.72), jug('A', 2, E.escolta_der[0], 0.72),
      jug('B', 1, E.tiro_libre[0], E.tiro_libre[1]),
      balon(E.escolta_izq[0], 0.72),
    ],
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'tiro_libre' }, { jugador: 'A2', tipo: 'corte', hacia: 'poste_bajo_der' }, { jugador: 'B1', tipo: 'defiende', marca: 'A1' }] },
        { eventos: [{ jugador: 'A1', tipo: 'pase', a: 'A2' }] },
        { eventos: [{ jugador: 'A2', tipo: 'tiro', hacia: 'canasta' }] },
      ],
    },
  },

  /* ═══ JUEGO REDUCIDO ═══════════════════════════════════════ */
  {
    name: '3c3 con dos botes',
    type: '3vs3', category: 'juego-reducido', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 5, duration_min: 10, duration_max: 20,
    description: 'Tres contra tres en media pista con un máximo de dos botes por posesión: obliga a pasar, cortar y ocupar espacios.',
    objetivos: 'Jugar con ventaja colectiva en lugar de resolver todo con el bote, en el formato que más contactos con balón da por jugador.',
    descripcion_texto: 'Tres contra tres en media pista. Cada jugador puede dar como máximo dos botes cada vez que recibe. Tras rebote defensivo o robo hay que sacar el balón por encima de la línea de tiros libres antes de atacar. Se juega a cinco canastas o a cuatro minutos. Los equipos rotan para que todos jueguen contra todos.',
    notas: 'Puntos clave: los tres no pueden estar en el mismo lado; después de pasar, o cortas o te separas. La restricción de dos botes no es un capricho: es lo que convierte el ejercicio en un ejercicio de decisiones. Error frecuente al empezar: quedarse quietos mirando al que tiene el balón. Si pasa eso, prohíbe también el bote durante dos posesiones y verás cómo empiezan a moverse.\n\nEste ejercicio lleva solo el montaje, sin animación: un 3c3 abierto puede terminar de mil maneras y dibujar una sola sería enseñar una jugada cerrada donde debe haber lectura.',
    variantes: 'Base: 3c3 sin límite de botes, solo con la regla de sacar el balón fuera tras rebote. Intermedio: máximo dos botes. Avanzado: máximo un bote y la canasta vale doble si llega tras un corte.',
    tags: ['juego reducido', 'espaciado', 'pasar y cortar', 'toma de decisiones', 'competición', 'lectura'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 12, canastas: 1, estaciones: 2,
      material: ['balones', 'petos'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'pasar y recibir en movimiento y defender individualmente a un par',
      dosis: { series: 4, cantidad: 1, unidad: 'repeticiones', descanso: 90 },
      organizacion: 'Con 12: dos partidos de 3c3 a la vez, uno en cada canasta. Nadie fuera.',
      criterio_exito: 'más de la mitad de las canastas del equipo nacen después de un pase, no de un uno contra uno',
    },
    tablero: () => [
      jug('A', 1, M.base[0], M.base[1]), jug('A', 2, M.alero_der[0], M.alero_der[1]), jug('A', 3, M.alero_izq[0], M.alero_izq[1]),
      jug('B', 1, M.base[0] - 0.05, M.base[1]), jug('B', 2, M.alero_der[0] - 0.05, M.alero_der[1]), jug('B', 3, M.alero_izq[0] - 0.05, M.alero_izq[1]),
      balon(M.base[0], M.base[1]),
    ],
    intent: null,
  },

  /* ═══ CALENTAMIENTO ════════════════════════════════════════ */
  {
    name: 'Pilla-pilla con balón',
    type: 'Calentamiento', category: 'calentamiento', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 1, intensidad: 3, duration_min: 5, duration_max: 8,
    description: 'Todos botando dentro de media pista mientras dos la ligan e intentan tocar a los demás sin dejar de botar ellos.',
    objetivos: 'Activar con el balón en las manos desde el primer minuto, botando bajo presión real y con la cabeza levantada.',
    descripcion_texto: 'Todos con balón dentro de la media pista. Dos la ligan, también con balón, e intentan tocar a los demás. Quien es tocado o pierde el balón o se sale de la pista pasa a ligarla. Nadie puede dejar de botar en ningún momento, incluidos los que persiguen.',
    notas: 'Puntos clave: se bota bajo y protegido cuando alguien se acerca, y alto y largo cuando hay espacio. Es el mejor momento de la sesión para observar sin corregir: aquí se ve de verdad quién bota con la cabeza levantada. Si el espacio se queda pequeño, quita jugadores en lugar de agrandarlo: la presión es el objetivo.',
    variantes: 'Base: los que la ligan van sin balón y solo hay que huir. Intermedio: todos con balón. Avanzado: quien es tocado no sale, sino que se une a los que la ligan, con lo que la presión crece hasta el final.',
    tags: ['calentamiento', 'activación', 'bote', 'cabeza levantada', 'bote de protección'],
    requisitos: {
      jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones'], densidad: 'alta', oposicion: 'real',
      requisito_previo: 'botar en movimiento sin perder el balón',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 45 },
      organizacion: 'Con 12: los doce a la vez en una media pista, con dos que la ligan. Si se hace fácil, se estrecha el espacio en vez de añadir gente que liga.',
      criterio_exito: 'aguantar noventa segundos sin ser tocado ni perder el balón',
    },
    tablero: () => [
      jug('A', 1, 0.30, 0.25), jug('A', 2, 0.30, 0.72), jug('A', 3, 0.55, 0.30),
      jug('A', 4, 0.60, 0.68), jug('B', 1, 0.42, 0.42), jug('B', 2, 0.48, 0.60),
      balon(0.30, 0.25), balon(0.30, 0.72), balon(0.55, 0.30), balon(0.60, 0.68),
    ],
    intent: null,
  },

  /* ═══ PSICOMOTRICIDAD ══════════════════════════════════════ */
  {
    name: 'El semáforo con balón',
    type: 'Calentamiento', category: 'psicomotricidad', tipo_pista: 'media',
    categoria_rama: 'Minibasket', categoria_nivel: ['Escuela'],
    difficulty: 1, intensidad: 2, duration_min: 5, duration_max: 8,
    description: 'Desplazarse con el balón respondiendo a colores y a números: lateralidad, ritmo y control en el mismo juego.',
    objetivos: 'Trabajar lateralidad, equilibrio y respuesta a un estímulo externo con el balón siempre en las manos.',
    descripcion_texto: 'Todos con balón repartidos por la media pista. El entrenador levanta un cono de color o dice un número. Verde: botar avanzando. Amarillo: botar en el sitio y bajo. Rojo: parar en dos tiempos y quedarse quietos con el balón cogido. Un número: botar esa cantidad de veces con la mano izquierda y luego seguir. Quien se equivoca da una vuelta al cono central sin dejar de botar.',
    notas: 'Puntos clave: en rojo se para de verdad, con los dos pies y equilibrado, no frenando poco a poco. En estas edades el balón es casi una excusa: lo que se entrena es la lateralidad y la respuesta a un estímulo. No corrijas la técnica del bote aquí; corrígela en su ejercicio. Lo que sí se vigila es que la mano izquierda se use tanto como la derecha.',
    variantes: 'Base: solo tres colores y sin números. Intermedio: colores y números, con la mano no dominante. Avanzado: los colores significan lo contrario de lo que dicen (verde es parar, rojo es avanzar), que es donde de verdad aparece la inhibición.',
    tags: ['lateralidad', 'ritmo', 'equilibrio', 'coordinación', 'bote', 'mano no dominante'],
    requisitos: {
      jugadores_min: 4, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
      material: ['balones', 'conos'], densidad: 'alta', oposicion: 'nula',
      requisito_previo: 'botar el balón en el sitio con cualquiera de las dos manos',
      dosis: { series: 3, cantidad: 90, unidad: 'segundos', descanso: 40 },
      organizacion: 'Con 12: los doce a la vez en una media pista, un balón cada uno. Sin canastas.',
      criterio_exito: 'responder correctamente a nueve de cada diez señales sin perder el balón',
      aplicacion: 'los cuatro cuadrantes, donde la misma respuesta al estímulo ya se hace en espacio compartido',
    },
    tablero: () => [
      jug('A', 1, 0.30, 0.25), jug('A', 2, 0.30, 0.72), jug('A', 3, 0.58, 0.30), jug('A', 4, 0.58, 0.70),
      cono(0.44, 0.50),
      balon(0.30, 0.25), balon(0.30, 0.72), balon(0.58, 0.30), balon(0.58, 0.70),
    ],
    intent: null,
  },
];

/** Fichas listas para el linter y para el importador. */
export const construir = () => compilarFichas(PILOTO);

/* ---- CLI --------------------------------------------------------- */

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fichas = construir();
  const destino = join(AQUI, 'piloto.json');
  writeFileSync(destino, JSON.stringify(fichas, null, 2), 'utf8');
  console.log(`${fichas.length} fichas → ${destino}`);

  const conAnimacion = fichas.filter((f) => f.animacion?.fases?.length).length;
  console.log(`  ${conAnimacion} con animación · ${fichas.length - conAnimacion} solo montaje`);

  if (process.argv.includes('--lint')) {
    const { lint } = await import('./lint.mjs');
    const r = lint(fichas);
    console.log(`\n${r.nErrores} error(es) · ${r.nAvisos} aviso(s)\n`);
    for (const f of r.porFicha) {
      if (!f.errores.length) continue;
      console.log(`  ${f.nombre}`);
      for (const e of f.errores) console.log(`    ERROR  ${e}`);
    }
    for (const e of r.conjunto.errores) console.log(`  CONJUNTO  ${e}`);
    process.exit(r.nErrores ? 1 : 0);
  }
}
