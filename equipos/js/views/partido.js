/* ============================================================
   partido.js — /partidos/:matchId · el partido de principio a fin.
   Es la otra mitad del calendario del entrenador: entrenamos
   (sesiones) y competimos (partidos).

   ── QUÉ CABE AQUÍ (Tramo 4.1) ────────────────────────────────
   El acta entera, en el orden en que se rellena el lunes con el papel
   delante: marcador final → marcador por periodo → quién jugó qué
   periodos → puntos y faltas de cada uno → cómo salió → la foto.

   ── LO QUE NO CUADRA SE DICE, NO SE ARREGLA ─────────────────
   Los descuadres (`acta.descuadres`) salen en ámbar al pie, con los dos
   números que no coinciden. La pantalla NUNCA corrige uno por su
   cuenta: un acta copiada a mano con un número mal se arregla mirando
   el papel, y si la app elige por su cuenta cuál de los dos era el
   bueno, el error deja de verse y pasa a ser permanente.

   ── SI FALTA LA 028 ─────────────────────────────────────────
   Marcador, estado, valoraciones y foto siguen funcionando; la parte
   del acta dice que falta la migración. Un partido que no se puede
   abrir es peor que uno al que le falta media pantalla.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { confirmar, abrirModal } from '../ui/modal.js';
import { puntoEquipo, estrellas } from '../ui/components.js';
import { getMisEquipos } from '../data/teams.js';
import { getJugadores } from '../data/players.js';
import {
  getPartido, actualizarPartido, borrarPartido, subirActa, urlActa, borrarActa,
  hayActa, hayConvocatoria,
} from '../data/matches.js';
import {
  getEstadisticas, guardarEstadisticas, borrarEstadisticas, hayTabla,
} from '../data/estadisticas.js';
import {
  periodosDe, filaVacia, totales, sumaPeriodos, descuadres, loQueFalta,
  rejillaDe, jugoEn, alterna, recuenta, enPista, saneaFila, saneaCuartos,
} from '../data/acta.js';
import {
  armarEnvio, volcar, resumen as resumenPuente, avisos as avisosPuente,
} from '../data/acta-chat.js';
import { comprobar, veredicto, textoReglas } from '../data/reglamento.js';
import { avisarAlEquipo } from '../data/avisar.js';
import {
  CONVOCADOS_MAX, convocadosDe, convocables, gruposDe as gruposConv,
  loQueFalta as loQueFaltaConv, avisosDeCupo,
} from '../data/convocatoria.js';
import {
  EJES_VALORACION, ESTADOS_PARTIDO, VALORACION_MAX,
  resultadoPartido, diferencia, mediaValoracion, validaPartido,
} from '../data/partidos.js';
import { WEEKDAYS } from '../config.js';
import { router } from '../main.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const isoWeekday = (iso) => { const d = new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay(); return d === 0 ? 7 : d; };
const hhmm = (t) => (t ? t.slice(0, 5) : '');

const RESULTADO_TXT = { victoria: 'Victoria', derrota: 'Derrota', empate: 'Empate' };

export function render(root, params) {
  const matchId = params.matchId;
  const cont = h('div', { class: 'eq-page eq-partido' });
  mount(root, cont);

  let p = null, equipo = null, color = 'var(--muted)', nombreEquipo = '—', categoria = null;
  /* El acta. `filas` lleva UNA por jugador de la plantilla, aunque no
     jugara: la rejilla se rellena marcando, no dando de alta a nadie.
     `teniaFila` recuerda quién estaba ya guardado, para poder BORRAR al
     que se desmarca del todo —una fila a cero dice «vino y no jugó ni
     un periodo», que es una acusación; no estar dice «no vino»—. */
  let jugadores = [], filas = [], teniaFila = new Set();
  let conActa = true;
  /* Lo que ha entrado por el puente al chat (4.2) y todavía no ha
     mirado nadie. Un acta manuscrita leída por un modelo no es un dato,
     es una propuesta: se pinta en ámbar hasta que se toca el campo —que
     es la señal de que se ha mirado— o se da por repasada entera. */
  let dudosos = new Set();
  // el estado tal y como está EN LA BASE DE DATOS. `p.estado` es el del chip,
  // que el usuario cambia sin guardar; las policies de 016 miran este.
  let estadoBD = null;
  let sucio = false;
  const marcaSucio = () => { sucio = true; };
  const nodoMarcador = h('div', { class: 'eq-marcador' });

  const onBeforeUnload = (e) => { if (sucio) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  const salir = (destino) => {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir y descartarlos?')) return false;
    sucio = false; router.navigate(destino); return true;
  };

  // ── marcador (se re-pinta solo el resultado, no los inputs) ─
  function pintaResultado() {
    const res = resultadoPartido({ ...p, estado: 'jugado' });   // qué diría SI se cierra
    const dif = diferencia(p);
    const oficial = p.estado === 'jugado' ? resultadoPartido(p) : null;
    const marca = nodoMarcador.querySelector('.eq-marcador-res');
    if (!marca) return;
    // mount y NO marca.replaceChildren: el nativo no filtra null y lo pinta como
    // el texto "null" (así salía "Sin marcador null" en todo partido sin cerrar).
    mount(marca,
      oficial
        ? h('span', { class: `eq-res eq-res-${oficial}` }, RESULTADO_TXT[oficial])
        : res
          ? h('span', { class: 'eq-ayuda' }, `Sin cerrar · sería ${RESULTADO_TXT[res].toLowerCase()}`)
          : h('span', { class: 'eq-ayuda' }, 'Sin marcador'),
      // != null y no truthy: un empate son 0 puntos de diferencia y se pinta.
      dif != null ? h('span', { class: 'eq-marcador-dif' }, dif > 0 ? `+${dif}` : String(dif)) : null,
    );
  }

  function seccionMarcador() {
    const campo = (clave, etiqueta) => h('label', { class: 'eq-marcador-campo' },
      h('span', { class: 'eq-marcador-lbl' }, etiqueta),
      h('input', {
        class: 'field-input eq-marcador-num'
          + (dudosos.has(`marcador.${clave === 'marcador_favor' ? 'favor' : 'contra'}`) ? ' eq-acta-duda' : ''),
        type: 'number', min: 0, max: 300,
        value: p[clave] ?? '', 'aria-label': etiqueta, inputmode: 'numeric',
        onInput: (e) => {
          const v = e.target.value;
          p[clave] = v === '' ? null : Math.max(0, Math.min(300, Number(v)));
          dudosos.delete(`marcador.${clave === 'marcador_favor' ? 'favor' : 'contra'}`);
          e.target.classList.remove('eq-acta-duda');
          marcaSucio(); pintaResultado();
        },
      }),
    );
    nodoMarcador.replaceChildren(
      h('div', { class: 'eq-marcador-fila' },
        campo('marcador_favor', nombreEquipo),
        h('span', { class: 'eq-marcador-sep' }, '–'),
        campo('marcador_contra', p.rival),
      ),
      h('div', { class: 'eq-marcador-res' }),
    );
    pintaResultado();
    return nodoMarcador;
  }

  // ── el acta · números que se copian de un papel ────────────
  const nodoCuantos = h('div', { class: 'eq-acta-cuantos' });
  const nodoPeriodos = h('div', { class: 'eq-acta-bloque' });
  const nodoFilas = h('div', { class: 'eq-acta-bloque' });
  const nodoAvisos = h('div', { class: 'eq-acta-avisos' });
  const nodoReglamento = h('div', { class: 'eq-regl' });

  const P = () => periodosDe(p);
  const num = (x) => { const v = Math.round(Number(x)); return Number.isFinite(v) && v > 0 ? v : 0; };
  const soloCeros = (l) => (l || []).every((c) => !num(c?.favor) && !num(c?.contra));

  /** ¿Hay algo escrito más allá del periodo `k`? */
  const seVaAPerder = (k) => filas.some((f) => rejillaDe(f).some((x) => x > k))
    || ['marcador_cuartos', 'faltas_equipo', 'tiempos_muertos']
      .some((clave) => !soloCeros((p[clave] || []).slice(k)));

  /** Deja las tres listas del partido con tantas entradas como periodos. */
  function estiraListas() {
    for (const clave of ['marcador_cuartos', 'faltas_equipo', 'tiempos_muertos']) {
      p[clave] = saneaCuartos(p[clave], p);
    }
  }

  /* Un campo de número del acta. Vacío en vez de «0» a propósito: una
     rejilla de treinta y seis ceros no se lee, y lo que importa es lo
     que está escrito, no lo que está a cero. */
  const campoNum = (valor, { max = 200, clase = '', aria, duda = null, alCambiar }) => h('input', {
    class: `field-input eq-acta-num ${clase}` + (duda && dudosos.has(duda) ? ' eq-acta-duda' : ''),
    type: 'number', min: 0, max,
    inputmode: 'numeric', placeholder: '0', 'aria-label': aria,
    value: num(valor) ? String(num(valor)) : '',
    title: duda && dudosos.has(duda) ? 'Lo ha leído el chat: repásalo contra el papel' : undefined,
    onInput: (e) => {
      const v = e.target.value;
      alCambiar(v === '' ? 0 : Math.max(0, Math.min(max, Math.round(Number(v)) || 0)));
      // tocar el campo ES mirarlo: el ámbar de ese número se apaga
      if (duda && dudosos.delete(duda)) { e.target.classList.remove('eq-acta-duda'); e.target.removeAttribute('title'); }
      marcaSucio(); pintaAvisos(); pintaReglamento();
    },
  });

  /** Repinta el acta entera: cambia la FORMA de las dos rejillas. */
  function pintaActa() { pintaCuantos(); pintaPeriodos(); pintaFilas(); pintaAvisos(); pintaReglamento(); }

  function pintaCuantos() {
    mount(nodoCuantos,
      h('span', { class: 'eq-ayuda' }, 'Periodos'),
      ...[4, 6, 8, 10].map((k) => h('button', {
        class: 'eq-catchip' + (P() === k ? ' sel' : ''), type: 'button',
        onClick: async () => {
          if (P() === k) return;
          /* Bajar de seis a cuatro se lleva por delante lo que hubiera en
             el quinto y el sexto, y eso es un clic al lado del que se
             quería dar. Se pregunta antes. */
          if (k < P() && seVaAPerder(k)
              && !(await confirmar({
                titulo: 'Menos periodos',
                mensaje: `El acta pasa a ${k} periodos: se borra lo apuntado del ${k + 1} en adelante.`,
                textoOk: 'Cambiar',
              }))) return;
          p.periodos = k;
          filas = filas.map((f) => recuenta(f, p));
          marcaSucio(); pintaActa();
        },
      }, String(k))),
    );
  }

  /* Las claves con las que el puente marca lo dudoso (`acta-chat.js`). */
  const PREFIJO = { marcador_cuartos: 'periodo', faltas_equipo: 'faltas', tiempos_muertos: 'tm' };

  function pintaPeriodos() {
    estiraListas();
    const n = P();
    const s = sumaPeriodos(p.marcador_cuartos);
    const descuadra = (lado) => {
      const fin = lado === 'favor' ? p.marcador_favor : p.marcador_contra;
      return fin != null && !soloCeros(p.marcador_cuartos) && s[lado] !== num(fin);
    };
    const fila = (i) => h('tr', { class: 'eq-acta-fila' },
      h('th', { scope: 'row', class: 'eq-acta-per' }, `P${i + 1}`),
      ...[['marcador_cuartos', 'favor', 60], ['marcador_cuartos', 'contra', 60],
        ['faltas_equipo', 'favor', 20], ['faltas_equipo', 'contra', 20],
        ['tiempos_muertos', 'favor', 9], ['tiempos_muertos', 'contra', 9],
      ].map(([clave, lado, max]) => h('td', {},
        campoNum(p[clave][i][lado], {
          max, aria: `${clave} ${lado} periodo ${i + 1}`,
          duda: `${PREFIJO[clave]}.${i + 1}.${lado}`,
          alCambiar: (v) => { p[clave][i][lado] = v; if (clave === 'marcador_cuartos') pintaTotales(); },
        }))),
    );

    mount(nodoPeriodos,
      h('div', { class: 'eq-acta-scroll' },
        h('table', { class: 'eq-acta-tabla' },
          h('thead', {},
            h('tr', {},
              h('th', { scope: 'col' }, ''),
              h('th', { scope: 'col', colspan: 2 }, 'Puntos'),
              h('th', { scope: 'col', colspan: 2 }, 'Faltas eq.'),
              h('th', { scope: 'col', colspan: 2 }, 'T. muertos'),
            ),
            h('tr', { class: 'eq-acta-sub' },
              h('th', { scope: 'col' }, ''),
              ...[0, 1, 2].flatMap(() => [
                h('th', { scope: 'col', title: nombreEquipo }, 'Nos.'),
                h('th', { scope: 'col', title: p.rival }, 'Ellos'),
              ]),
            ),
          ),
          h('tbody', {}, ...Array.from({ length: n }, (_, i) => fila(i))),
          h('tfoot', {},
            h('tr', { class: 'eq-acta-total' },
              h('th', { scope: 'row' }, 'Suma'),
              h('td', { class: descuadra('favor') ? 'eq-acta-ojo' : '' }, String(s.favor)),
              h('td', { class: descuadra('contra') ? 'eq-acta-ojo' : '' }, String(s.contra)),
              h('td', { colspan: 4 }, ''),
            ),
          ),
        ),
      ),
    );
  }

  /* Solo la fila de sumas: repintar la tabla entera al teclear un número
     le quita el foco al campo que se está rellenando. */
  function pintaTotales() {
    const pie = nodoPeriodos.querySelector('.eq-acta-total');
    if (!pie) return;
    const s = sumaPeriodos(p.marcador_cuartos);
    const cel = pie.querySelectorAll('td');
    const vacio = soloCeros(p.marcador_cuartos);
    [['favor', p.marcador_favor], ['contra', p.marcador_contra]].forEach(([lado, fin], k) => {
      cel[k].textContent = String(s[lado]);
      cel[k].className = (fin != null && !vacio && s[lado] !== num(fin)) ? 'eq-acta-ojo' : '';
    });
    pintaAvisos();
  }

  // ── el acta · quién jugó qué periodos ──────────────────────
  /* La rejilla del acta oficial: una fila por jugador, una columna por
     periodo, y una X donde jugó. Se marca tocando, que es lo que se
     hace con el papel delante, y los contadores salen solos de ahí.
     Pedir «cuántos periodos jugó» en vez de «cuáles» ahorraría clics y
     dejaría sin poder comprobar la regla de los cinco primeros (4.3). */
  function pintaFilas() {
    const n = P();
    const t = totales(filas);
    const idx = new Map(filas.map((f, i) => [f.player_id, i]));

    const celdaPeriodo = (f, k) => {
      const dentro = jugoEn(f, k);
      const duda = `jugador.${f.player_id}.periodos`;
      return h('td', { class: 'eq-acta-cel' },
        h('button', {
          type: 'button',
          class: 'eq-acta-x' + (dentro ? ' sel' : '') + (dudosos.has(duda) ? ' eq-acta-duda' : ''),
          role: 'checkbox', 'aria-checked': String(dentro),
          'aria-label': `${f.nombre}, periodo ${k}`,
          onClick: (e) => {
            const i = idx.get(f.player_id);
            filas[i] = alterna(filas[i], k, p);
            const b = e.currentTarget;
            const ahora = jugoEn(filas[i], k);
            b.classList.toggle('sel', ahora);
            b.setAttribute('aria-checked', String(ahora));
            // tocar la rejilla de este jugador la da por repasada entera
            if (dudosos.delete(duda)) {
              nodoFilas.querySelectorAll(`[aria-label^="${f.nombre}, periodo"]`)
                .forEach((x) => x.classList.remove('eq-acta-duda'));
            }
            marcaSucio(); pintaPie(); pintaAvisos();
          },
        }, dentro ? '×' : ''),
      );
    };

    const fila = (f) => h('tr', { class: 'eq-acta-fila' },
      h('th', { scope: 'row', class: 'eq-acta-quien' },
        f.dorsal != null ? h('span', { class: 'eq-acta-dorsal' }, String(f.dorsal)) : null,
        h('span', { class: 'eq-acta-nombre' }, f.nombre),
      ),
      ...Array.from({ length: n }, (_, i) => celdaPeriodo(f, i + 1)),
      h('td', {}, campoNum(f.puntos, {
        max: 200, clase: 'eq-acta-pts', aria: `Puntos de ${f.nombre}`,
        duda: `jugador.${f.player_id}.puntos`,
        alCambiar: (v) => { filas[idx.get(f.player_id)].puntos = v; pintaPie(); },
      })),
      h('td', {}, campoNum(f.faltas, {
        max: 10, clase: 'eq-acta-fal', aria: `Faltas de ${f.nombre}`,
        duda: `jugador.${f.player_id}.faltas`,
        alCambiar: (v) => { filas[idx.get(f.player_id)].faltas = v; pintaPie(); },
      })),
    );

    mount(nodoFilas,
      h('div', { class: 'eq-acta-scroll' },
        h('table', { class: 'eq-acta-tabla eq-acta-rejilla' },
          h('thead', {},
            h('tr', {},
              h('th', { scope: 'col' }, 'Jugador'),
              ...Array.from({ length: n }, (_, i) => h('th', { scope: 'col' }, `P${i + 1}`)),
              h('th', { scope: 'col', title: 'Puntos' }, 'Pt'),
              h('th', { scope: 'col', title: 'Faltas' }, 'F'),
            ),
          ),
          h('tbody', {}, ...filas.map(fila)),
          h('tfoot', {},
            h('tr', { class: 'eq-acta-pie' },
              h('th', { scope: 'row' }, 'En pista'),
              /* Cinco por columna: la que no sume cinco está mal copiada.
                 Se enseña el número y ya — mientras se rellena ninguna
                 columna suma cinco, y un aviso que salta en cada clic no
                 lo lee nadie. */
              ...Array.from({ length: n }, (_, i) => h('td', { class: 'eq-acta-pista' }, String(enPista(filas, i + 1)))),
              h('td', { class: 'eq-acta-suma' }, String(t.puntos)),
              h('td', { class: 'eq-acta-suma' }, String(t.faltas)),
            ),
          ),
        ),
      ),
    );
  }

  /* Solo el pie de la rejilla, por lo mismo que las sumas del marcador:
     repintar la tabla al teclear un punto le quita el foco al campo. */
  function pintaPie() {
    const pie = nodoFilas.querySelector('.eq-acta-pie');
    if (!pie) return;
    const t = totales(filas);
    const n = P();
    const cel = pie.querySelectorAll('td');
    for (let i = 0; i < n; i++) if (cel[i]) cel[i].textContent = String(enPista(filas, i + 1));
    if (cel[n]) cel[n].textContent = String(t.puntos);
    if (cel[n + 1]) cel[n + 1].textContent = String(t.faltas);
    marcaSucio(); pintaAvisos(); pintaReglamento();
  }

  // ── la convocatoria (4.6) ──────────────────────────────────
  /* El evento del calendario no se guarda: se deduce del partido y del
     día de convocatoria del equipo (§5.9 dice «se crea sola», y una
     tabla que hay que mantener al día se olvida a la primera).

     ── POR QUÉ AQUÍ SOLO SE RESUME ─────────────────────────
     La convocatoria tiene pantalla propia desde que es el documento de
     verdad —tres grupos, desplazamiento y PDF—. Tener dos sitios donde
     marcar a la misma gente es tener dos sitios donde se puede quedar a
     medias. Aquí se ve cómo va y se entra; se hace allí. */
  const nodoConv = h('div', { class: 'eq-conv-resumen' });

  function pintaConvocatoria() {
    const g = gruposConv(p);
    const lista = convocables(jugadores);
    const falta = loQueFaltaConv(p, { ajustes: equipo || {} });
    const avisos = avisosDeCupo(p);

    const ir = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      /* El documento lee de la BASE DE DATOS: lo que no esté guardado
         no saldría. Se avisa en vez de enseñar un papel incompleto. */
      if (sucio) { toast('Guarda primero, que la convocatoria lee lo guardado', 'error'); return; }
      router.navigate(`/partidos/${matchId}/convocatoria`);
    };

    const cuenta = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

    mount(nodoConv,
      h('div', { class: 'eq-zona-head' },
        h('span', { class: 'eq-ayuda' },
          [
            `${g.convocados.length} de ${CONVOCADOS_MAX} convocados`,
            g.reservas.length ? cuenta(g.reservas.length, 'reserva', 'reservas') : null,
            g.descansan.length ? cuenta(g.descansan.length, 'descansa', 'descansan') : null,
          ].filter(Boolean).join(' · ')
          + (lista.length ? ` · plantilla de ${lista.length}` : '')),
        h('a', {
          class: 'btn btn-primary eq-btn-mini',
          href: `/partidos/${matchId}/convocatoria`, 'data-link': true, onClick: ir,
        }, g.convocados.length ? 'Abrir la convocatoria' : 'Hacer la convocatoria'),
      ),
      ...avisos.map((a) => h('p', { class: 'eq-acta-descuadre' }, a)),
      falta.length
        ? h('p', { class: 'eq-ayuda' }, `Falta por poner: ${falta.join(', ')}.`)
        : h('p', { class: 'eq-acta-ok' }, 'La convocatoria está lista.'),
    );
  }

  // ── el reglamento de la categoría (4.3) ──────────────
  /* Aritmética pura sobre lo que el acta demuestra (decisión #29). Va
     al pie porque se mira cuando el acta ya está puesta, no mientras se
     rellena: un recuadro rojo desde el primer número es ruido. */
  function pintaReglamento() {
    const r = comprobar(p, filas, { categoria });
    const v = veredicto(r);
    const linea = (t, clase) => h('li', { class: clase }, t);
    mount(nodoReglamento,
      h('div', { class: `eq-regl-cab eq-regl-${v.estado}` },
        h('h3', { class: 'eq-regl-titulo' }, 'Reglamento'),
        h('span', { class: 'eq-regl-veredicto' }, v.texto),
      ),
      r.reglas
        ? h('p', { class: 'eq-ayuda eq-regl-cual' }, textoReglas(r.reglas, categoria))
        : null,
      /* Lo que ya dice el titular no se repite debajo: un recuadro que
         dice dos veces lo mismo se lee la mitad de veces. */
      (() => {
        const falta = r.noSePuede.filter((t) => t !== v.texto);
        return (r.incumple.length || r.avisa.length || falta.length)
          ? h('ul', { class: 'eq-regl-lista' },
              ...r.incumple.map((x) => linea(x.texto, 'eq-regl-mal')),
              ...r.avisa.map((x) => linea(x.texto, 'eq-regl-ojo')),
              ...falta.map((t) => linea(t, 'eq-regl-falta')),
            )
          : null;
      })(),
    );
  }

  // ── el puente al chat (4.2) ────────────────────────────────
  /* La app arma el envío, el entrenador lo pega en su chat con la foto
     del acta y trae la respuesta. Sin red, sin clave, sin coste (§2), y
     sin un solo nombre de un crío en lo que sale de aquí. */
  function abrirPuente() {
    const envio = armarEnvio(p, jugadores, { nombreEquipo });
    const salida = h('textarea', {
      class: 'field-textarea eq-puente-envio', rows: 7, readonly: true,
      'aria-label': 'Lo que hay que pegar en el chat',
    }, envio);
    const entrada = h('textarea', {
      class: 'field-textarea', rows: 6,
      placeholder: 'Pega aquí la respuesta del chat, entera, con las llaves incluidas.',
      'aria-label': 'La respuesta del chat',
    });
    const parte = h('p', { class: 'eq-ayuda' });
    /* Repegar una respuesta corregida es el segundo uso más común del
       puente —se le pide al chat que mire otra vez una columna y se
       vuelve— y la regla de «no pisar lo escrito» la rechazaba entera.
       Se ofrece, apagado: pisar por defecto convertiría una ayuda en un
       secuestro, pero no poder hacerlo nunca obliga a borrar a mano. */
    const sustituir = h('input', { type: 'checkbox', id: 'eq-puente-pisar' });

    const copiar = async (e) => {
      try {
        await navigator.clipboard.writeText(envio);
        e.target.textContent = 'Copiado';
        setTimeout(() => { e.target.textContent = 'Copiar'; }, 1500);
      } catch {
        // sin permiso de portapapeles queda seleccionado, que es lo mismo
        salida.select();
        mount(parte, h('span', {}, 'No he podido copiarlo yo: está seleccionado, dale a copiar.'));
      }
    };

    const m = abrirModal({
      titulo: 'Leer el acta con el chat',
      clase: 'eq-puente-modal',
      cuerpo: h('div', { class: 'eq-puente' },
        h('p', { class: 'eq-ayuda' },
          'Pega esto en tu chat junto con la foto del acta. No lleva ningún nombre: '
          + 'va por dorsal, y el casado lo hace la app aquí dentro.'),
        h('div', { class: 'field-group' },
          h('div', { class: 'eq-puente-cab' },
            h('label', { class: 'field-label' }, '1 · Cópialo en tu chat'),
            h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: copiar }, 'Copiar'),
          ),
          salida,
        ),
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' }, '2 · Pega aquí lo que te devuelva'),
          entrada,
          h('label', { class: 'eq-puente-pisar', for: 'eq-puente-pisar' },
            sustituir, h('span', {}, 'Sustituir lo que ya haya escrito')),
          parte,
        ),
      ),
      pie: [
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => m.cerrar() }, 'Cancelar'),
        h('button', {
          class: 'btn btn-primary', type: 'button',
          onClick: () => {
            const r = volcar(p, filas, entrada.value, { pisar: sustituir.checked });
            if (r.error) { mount(parte, h('span', { class: 'eq-acta-descuadre' }, r.error)); return; }
            if (!r.puestos.length) {
              // el caso de repegar: todo lo que traía ya estaba escrito
              mount(parte, h('span', { class: 'eq-acta-descuadre' },
                r.ignorados.length
                  ? `Todo eso ya estaba escrito en el acta (${r.ignorados.length} campos). Marca «Sustituir lo que ya haya escrito» si quieres cambiarlo.`
                  : resumenPuente(r)));
              return;
            }
            /* Se sustituyen los objetos enteros: `volcar` devuelve copias
               a propósito, así que hasta este momento no se ha tocado
               nada de lo que hay en pantalla. */
            Object.assign(p, r.partido);
            filas = r.filas;
            dudosos = new Set(r.dudosos);
            delPuente = {
              resumen: resumenPuente(r),
              avisos: avisosPuente(r, { sinDorsal: jugadores.filter((x) => x.dorsal == null).length }),
            };
            marcaSucio(); m.cerrar(); pinta();
            toast(resumenPuente(r));
          },
        }, 'Volcar en el acta'),
      ],
    });
  }

  /* Lo que dejó el último volcado, para poder contarlo al pie del acta
     mientras quede algo por repasar. */
  let delPuente = null;

  // ── lo que no cuadra, y lo que falta ───────────────────────
  /* Dos cosas distintas, y se pintan distinto. Un DESCUADRE es un error
     de copia —dos números que no pueden ser los dos ciertos— y sale en
     ámbar con los dos. Lo que FALTA no es un error: un acta se puede
     dejar a medias el sábado y terminarse el lunes. */
  function pintaAvisos() {
    const malos = descuadres(p, filas);
    const falta = loQueFalta(p, filas);
    /* Lo que el chat dijo que no leyó seguro y los dorsales que no ha
       sabido casar: se dicen una vez, con el volcado reciente. */
    const delChat = delPuente ? delPuente.avisos.filter((a) => !malos.some((d) => d.texto === a)) : [];
    mount(nodoAvisos,
      dudosos.size
        ? h('div', { class: 'eq-acta-repasar' },
            h('span', {},
              `${dudosos.size} campo${dudosos.size === 1 ? '' : 's'} por repasar contra el papel.`),
            h('button', {
              class: 'btn btn-secondary eq-btn-mini', type: 'button',
              // repasar es mirar, y mirar no deja rastro: se apaga a mano.
              // El ámbar se quita del DOM entero y no solo repintando el
              // acta: los dos campos del marcador final viven en otra
              // sección, y se quedaban encendidos ahí.
              onClick: () => {
                dudosos = new Set(); delPuente = null;
                cont.querySelectorAll('.eq-acta-duda').forEach((x) => x.classList.remove('eq-acta-duda'));
                pintaActa();
              },
            }, 'Ya lo he repasado'),
          )
        : null,
      ...delChat.map((t) => h('p', { class: 'eq-acta-descuadre' }, t)),
      ...malos.map((d) => h('p', { class: 'eq-acta-descuadre' }, d.texto)),
      falta.length
        ? h('p', { class: 'eq-ayuda' }, `Falta por apuntar: ${falta.join(', ')}.`)
        : (malos.length ? null : h('p', { class: 'eq-acta-ok' }, 'El acta cuadra.')),
    );
  }

  // ── acta ───────────────────────────────────────────────────
  function seccionActa() {
    const zona = h('div', { class: 'eq-acta' });
    const pinta = async () => {
      if (!p.acta_path) {
        zona.replaceChildren(
          h('label', { class: 'btn btn-secondary eq-acta-subir' }, 'Subir acta (foto o PDF)',
            h('input', {
              type: 'file', accept: 'image/jpeg,image/png,image/webp,application/pdf',
              class: 'eq-acta-input',
              onChange: async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const path = await subirActa(p.team_id, file);
                  await actualizarPartido(matchId, { acta_path: path });
                  p.acta_path = path;
                  toast('Acta guardada'); pinta();
                } catch (err) { toast('Error: ' + err.message, 'error'); }
              },
            })),
          h('p', { class: 'eq-ayuda' }, 'Se guarda en privado: solo la ve el cuerpo técnico del equipo.'),
        );
        return;
      }
      let url = null;
      try { url = await urlActa(p.acta_path); } catch { /* enlace temporal fallido */ }
      const esPdf = p.acta_path.endsWith('.pdf');
      zona.replaceChildren(
        url
          ? (esPdf
              ? h('a', { class: 'btn btn-secondary', href: url, target: '_blank', rel: 'noopener' }, 'Ver acta (PDF)')
              : h('a', { href: url, target: '_blank', rel: 'noopener', class: 'eq-acta-thumb' },
                  h('img', { src: url, alt: 'Acta del partido', loading: 'lazy' })))
          : h('p', { class: 'eq-ayuda' }, 'Acta guardada (no se pudo generar el enlace ahora).'),
        h('button', {
          class: 'btn btn-secondary eq-btn-mini eq-btn-peligro', type: 'button',
          onClick: async () => {
            if (!(await confirmar({ titulo: 'Quitar acta', mensaje: 'Se borrará la imagen del acta. ¿Continuar?', textoOk: 'Quitar' }))) return;
            try {
              const path = p.acta_path;
              await actualizarPartido(matchId, { acta_path: null });
              p.acta_path = null;
              await borrarActa(path).catch(() => {});   // la fila ya no la referencia
              toast('Acta quitada'); pinta();
            } catch (err) { toast('Error: ' + err.message, 'error'); }
          },
        }, 'Quitar acta'),
      );
    };
    pinta();
    return zona;
  }

  // ── guardado ───────────────────────────────────────────────
  /* Una fila con algo escrito. La que no tiene nada NO se guarda: una
     fila a cero dice «vino y no jugó ni un periodo», que es una
     acusación; no estar en el acta dice «no vino», que suele ser la
     verdad. El reglamento (4.3) mira esa diferencia. */
  const tieneAlgo = (f) => rejillaDe(f).length || f.periodos_jugados || f.puntos || f.faltas;
  const hayAlgoDelActa = () => filas.some(tieneAlgo) || !soloCeros(p.marcador_cuartos);

  async function guardaFilas() {
    const conAlgo = filas.filter(tieneAlgo);
    // los que tenían fila y se han quedado en blanco: se van del acta
    const fuera = filas.filter((f) => !tieneAlgo(f) && teniaFila.has(f.player_id));
    await guardarEstadisticas(matchId, conAlgo.map((f) => saneaFila(f, p)));
    await borrarEstadisticas(matchId, fuera.map((f) => f.player_id));
    teniaFila = new Set(conAlgo.map((f) => f.player_id));
  }

  async function guardar({ volver = false } = {}) {
    const problema = validaPartido(p);
    if (problema) { toast(problema, 'error'); return; }
    try {
      await actualizarPartido(matchId, {
        fecha: p.fecha, hora: p.hora || null, lugar: p.lugar?.trim() || null,
        rival: p.rival.trim(), es_local: p.es_local, estado: p.estado,
        marcador_favor: p.marcador_favor, marcador_contra: p.marcador_contra,
        val_defensa: p.val_defensa, val_ataque: p.val_ataque, val_actitud: p.val_actitud,
        val_acierto: p.val_acierto, val_global: p.val_global,
        claves: p.claves?.trim() || null,
        // Una lista de ceros no es un marcador por periodos: es un acta
        // sin rellenar, y guardarla como si estuviera hecha le quitaría
        // de encima el «falta por apuntar» sin que nadie apuntara nada.
        marcador_cuartos: soloCeros(p.marcador_cuartos) ? [] : p.marcador_cuartos,
        faltas_equipo: soloCeros(p.faltas_equipo) ? [] : p.faltas_equipo,
        tiempos_muertos: soloCeros(p.tiempos_muertos) ? [] : p.tiempos_muertos,
        periodos: p.periodos ?? null,
        acta_origen: p.acta_origen || (hayAlgoDelActa() ? 'mano' : null),
        /* La convocatoria NO se guarda desde aquí: la edita su propia
           pantalla. Escribirla también desde ésta era la manera de que
           dos pestañas abiertas se pisaran la lista sin decir nada. */
      });
      if (conActa) await guardaFilas();
      sucio = false;
      estadoBD = p.estado;             // ya está persistido: el botón puede fiarse
      toast('Partido guardado');
      /* Y al otro entrenador del equipo (Tramo 4.13). Va sin await: el
         partido ya está guardado y el aviso no puede hacer esperar a
         nadie delante de una pantalla. */
      avisarAlEquipo(p.team_id, {
        que: `el partido contra ${p.rival}`,
        url: `/partidos/${matchId}`,
        nombreEquipo,
      });
      if (volver) router.navigate(`/sesiones?equipo=${p.team_id}`);
      else pinta();
    } catch (e) { toast('Error al guardar: ' + e.message, 'error'); }
  }

  // ── pintado ────────────────────────────────────────────────
  function pinta() {
    const [, m, d] = p.fecha.split('-').map(Number);
    const fechaTxt = `${WEEKDAYS[isoWeekday(p.fecha) - 1].nombre} ${d} de ${MESES[m - 1]}`;
    const media = mediaValoracion(p);

    mount(cont,
      h('div', { class: 'eq-planner-top' },
        h('a', {
          class: 'eq-volver', href: `/sesiones?equipo=${p.team_id}`,
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); salir(`/sesiones?equipo=${p.team_id}`); },
        }, '‹ Calendario'),
        h('span', { class: `eq-estado-badge eq-part-${p.estado}` }, ESTADOS_PARTIDO[p.estado]),
      ),
      h('div', { class: 'view-hero eq-planner-hero' },
        h('div', { class: 'view-hero-text' },
          h('span', { class: 'eyebrow' }, puntoEquipo(color), ' ', nombreEquipo, p.es_local ? ' · local' : ' · visitante'),
          h('h1', { class: 'display view-title' }, p.es_local ? `vs ${p.rival}` : `@ ${p.rival}`),
          h('p', { class: 'view-meta' }, [fechaTxt, hhmm(p.hora), p.lugar].filter(Boolean).join(' · ')),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Marcador'),
        seccionMarcador(),
        h('div', { class: 'eq-part-estado', role: 'radiogroup', 'aria-label': 'Estado del partido' },
          // 016 impide que un partido ya no-programado vuelva a 'programado'
          // (era el camino para borrar el histórico en dos clics). Se apaga
          // aquí para que la regla se vea, en vez de saltar como error crudo
          // de Postgres al guardar.
          ...Object.entries(ESTADOS_PARTIDO).map(([k, txt]) => {
            const vetado = k === 'programado' && estadoBD !== 'programado';
            return h('button', {
              class: 'eq-catchip' + (p.estado === k ? ' sel' : ''), type: 'button',
              role: 'radio', 'aria-checked': String(p.estado === k),
              disabled: vetado || undefined,
              title: vetado ? 'Un partido que ya se jugó o se aplazó no vuelve a «programado»' : undefined,
              onClick: () => { if (vetado) return; p.estado = k; marcaSucio(); pinta(); },
            }, txt);
          }),
        ),
        // se puede corregir después: al crearlo desde el calendario es fácil
        // marcar mal quién juega en casa
        h('div', { class: 'eq-part-estado', role: 'radiogroup', 'aria-label': 'Local o visitante' },
          ...[[true, 'Local'], [false, 'Visitante']].map(([v, txt]) => h('button', {
            class: 'eq-catchip' + (p.es_local === v ? ' sel' : ''), type: 'button',
            role: 'radio', 'aria-checked': String(p.es_local === v),
            onClick: () => { p.es_local = v; marcaSucio(); pinta(); },
          }, txt)),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Convocatoria'),
        hayConvocatoria()
          ? nodoConv
          : h('p', { class: 'eq-ayuda' },
              'Para la convocatoria falta aplicar la migración 030 en la base de datos.'),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'El acta'),
          conActa ? nodoCuantos : null,
        ),
        conActa
          ? h('div', {},
              h('div', { class: 'eq-acta-guia' },
                h('p', { class: 'eq-ayuda' },
                  'Se rellena con el papel delante: primero el marcador de cada periodo, '
                  + 'luego una cruz en los periodos que jugó cada uno.'
                  + (p.acta_origen === 'chat' ? ' Esta la leyó el chat.' : '')),
                h('button', {
                  class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: abrirPuente,
                }, 'Leerla con el chat'),
              ),
              nodoPeriodos,
              nodoFilas,
              nodoAvisos,
              nodoReglamento,
            )
          : h('p', { class: 'eq-ayuda' },
              'Para apuntar el acta (marcador por periodo, alineaciones y estadísticas) '
              + 'falta aplicar la migración 028 en la base de datos.'),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('div', { class: 'eq-zona-head' },
          h('h2', { class: 'eq-zona-titulo' }, 'Cómo salió'),
          media != null ? h('span', { class: 'eq-ayuda' }, `media ${media.toFixed(1)} / ${VALORACION_MAX}`) : null,
        ),
        h('div', { class: 'eq-ejes' },
          ...EJES_VALORACION.map((e) => h('div', { class: 'eq-eje' },
            h('span', { class: 'eq-eje-lbl' }, e.etiqueta),
            estrellas(p[e.clave], (v) => { p[e.clave] = v; marcaSucio(); }, { max: VALORACION_MAX }),
          )),
        ),
        h('div', { class: 'field-group eq-part-claves' },
          h('label', { class: 'field-label' }, 'Claves del partido'),
          h('textarea', {
            class: 'field-textarea', rows: 3,
            placeholder: 'Lo que te llevas: qué funcionó, qué corregir el lunes.',
            onInput: (e) => { p.claves = e.target.value; marcaSucio(); },
          }, p.claves || ''),
        ),
      ),

      h('section', { class: 'eq-cierre-seccion' },
        h('h2', { class: 'eq-zona-titulo' }, 'Acta'),
        seccionActa(),
      ),

      h('div', { class: 'eq-planner-barra' },
        h('div', { class: 'eq-planner-barra-sec' },
          // El botón se decide por el estado GUARDADO, no por el chip que el
          // usuario acaba de tocar: la policy de 016 mira la BD, así que un
          // "programado" sin guardar ofrecía un borrado que iba a fracasar.
          estadoBD === 'programado' ? h('button', {
            class: 'btn btn-secondary eq-btn-peligro', type: 'button',
            onClick: async () => {
              if (!(await confirmar({ titulo: 'Eliminar partido', mensaje: `Se eliminará el partido contra ${p.rival}. ¿Continuar?`, textoOk: 'Eliminar' }))) return;
              try {
                // un DELETE rechazado por RLS responde 0 filas y ningún error
                if (!(await borrarPartido(matchId, p.acta_path))) {
                  toast('No se eliminó: el partido ya no está programado', 'error');
                  return;
                }
                sucio = false;
                toast('Partido eliminado'); router.navigate(`/sesiones?equipo=${p.team_id}`);
              } catch (e) { toast('Error: ' + e.message, 'error'); }
            },
          }, 'Eliminar') : null,
        ),
        h('div', { class: 'eq-planner-barra-sec' },
          h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => guardar() }, 'Guardar'),
          h('button', {
            class: 'btn btn-primary eq-planner-guardar', type: 'button',
            onClick: () => guardar({ volver: true }),
          }, 'Guardar y volver'),
        ),
      ),
    );

    // los nodos del acta viven fuera del árbol que `pinta` reconstruye
    // (para no perder el foco al teclear), así que se rellenan aquí
    if (conActa) pintaActa();
    if (hayConvocatoria()) pintaConvocatoria();
  }

  (async () => {
    try {
      p = await getPartido(matchId);
      estadoBD = p.estado;
      const equipos = await getMisEquipos();
      const eq = equipos.find((t) => t.id === p.team_id);
      equipo = eq || null;                // los ajustes de la convocatoria salen de aquí
      color = eq?.color || 'var(--muted)';
      nombreEquipo = eq?.name || 'Nosotros';
      categoria = eq?.category || null;   // las reglas de 4.3 dependen de ella

      /* El acta: la plantilla manda el orden y las estadísticas guardadas
         rellenan lo que haya. Se listan TODOS los jugadores, también los
         que no jugaron: la rejilla se rellena marcando, no dando de alta
         a nadie, y buscar a un crío que falta en la lista es justo lo que
         no se quiere hacer un lunes. */
      try {
        jugadores = await getJugadores(p.team_id);
        const guardadas = await getEstadisticas(matchId);
        conActa = hayTabla() && hayActa();
        const porId = new Map(guardadas.map((f) => [f.player_id, f]));
        teniaFila = new Set(porId.keys());
        filas = jugadores.map((j) => {
          const g = porId.get(j.id);
          return g
            ? { ...filaVacia(j), ...g, nombre: j.nombre, dorsal: g.dorsal ?? j.dorsal ?? null }
            : filaVacia(j);
        });
      } catch (err) {
        // el acta es una parte de la pantalla, no la pantalla
        conActa = false;
        console.warn('[partido] sin acta:', err.message);
      }
      pinta();
    } catch (e) {
      mount(cont, h('div', { class: 'empty-state' },
        h('p', { class: 'empty-state-display' }, 'No se pudo abrir el partido'),
        h('p', {}, e.message),
        h('a', { class: 'btn btn-secondary', href: '/sesiones', 'data-link': true }, 'Volver al calendario')));
    }
  })();

  return { destroy() { window.removeEventListener('beforeunload', onBeforeUnload); } };
}
