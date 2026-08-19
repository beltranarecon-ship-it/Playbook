/* ============================================================
   equipo-progresion.js — pestaña PROGRESIÓN de un equipo (Tramo 3.8).

   §5.7: «se selecciona un jugador, arriba sus datos, debajo sus
   gráficas». Literalmente eso, y en ese orden: los cuatro números que
   se leen de un vistazo antes de hablar con el crío, y debajo lo que
   hay que mirar despacio.

   ── DE DÓNDE SALE CADA COSA ─────────────────────────────────
   De las tres capas de §5.7, que cuestan cosas distintas:

     automática · asistencia — ya se recogía
     un toque   · estrellas  — desde la sesión activa (3.5)
     rúbrica    · niveles y movimientos — desde el cierre (3.7)

   Ninguna se inventa: si una capa está vacía se dice que está vacía.
   Durante el primer trimestre habrá pocos movimientos de rúbrica y eso
   ya estaba previsto como riesgo — se avisa en pantalla en vez de
   enseñar un cero que parece un suspenso.

   ── LAS GRÁFICAS SON SVG A MANO ─────────────────────────────
   Sin librería. Son dos formas —barras de cuatro escalones y una línea
   escalonada— y cada una son veinte líneas de código; traerse una
   librería de gráficas para esto pesaría más que todo el módulo de
   sesiones junto.
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { avatar } from '../ui/components.js';
import { getRubricaEquipo, getFilasClub } from '../data/rubrica.js';
import { getObjetivos, crearObjetivo, actualizarObjetivo } from '../data/objectives.js';
import { toast } from '../ui/toast.js';
import { getEstrellasJugadores } from '../data/estrellas.js';
import { getAsistenciaEquipo } from '../data/attendance.js';
import { estadisticasJugadores } from '../data/asistencia.js';
import {
  NIVELES, NIVEL_MAX, filasDeRubrica, estadoDe, movimiento,
  diasSinMirar, textoSinMirar, resumenDe, serieDe, esConducta,
  proponerObjetivos, tituloPropuesta,
} from '../../../taller/js/rubrica.js';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export async function pintaProgresion(zona, { teamId, seasonId = null }) {
  const { getJugadores } = await import('../data/players.js');
  const jugadores = (await getJugadores(teamId).catch(() => []))
    .filter((j) => j.estado !== 'baja');

  if (!jugadores.length) {
    mount(zona, h('p', { class: 'eq-ayuda' },
      'Este equipo no tiene jugadores todavía. La progresión se construye jugador a jugador.'));
    return;
  }

  const ids = jugadores.map((j) => j.id);
  const [series, filasClub, estrellas, asistencia, objetivos] = await Promise.all([
    getRubricaEquipo(ids),
    getFilasClub(),
    getEstrellasJugadores(ids),
    getAsistenciaEquipo(teamId, seasonId).catch(() => []),
    getObjetivos(teamId, seasonId).catch(() => []),
  ]);
  // los individuales (Tramo 3.10), por jugador
  let porJugadorObj = {};
  const reagrupaObjetivos = (lista) => {
    porJugadorObj = {};
    for (const o of lista) if (o.player_id) (porJugadorObj[o.player_id] ||= []).push(o);
  };
  reagrupaObjetivos(objetivos);
  const filas = filasDeRubrica(filasClub);
  const asisPorJugador = estadisticasJugadores(jugadores, asistencia);

  let selId = jugadores[0].id;
  let filaAbierta = null;   // qué fila se está mirando en la línea

  const nodoLista = h('div', { class: 'eq-prog-lista' });
  const nodoFicha = h('div', { class: 'eq-prog-ficha' });

  function pintaLista() {
    mount(nodoLista, ...jugadores.map((j) => {
      const dias = diasSinMirar(series[j.id]);
      return h('button', {
        class: 'eq-prog-jug' + (j.id === selId ? ' is-sel' : ''), type: 'button',
        onClick: () => { selId = j.id; filaAbierta = null; pintaLista(); pintaFicha(); },
      },
        avatar(j.nombre),
        h('span', { class: 'eq-prog-jug-n' }, j.nombre),
        h('span', { class: 'eq-prog-jug-d' + (dias == null ? ' is-nunca' : '') }, textoSinMirar(dias)),
      );
    }));
  }

  function pintaFicha() {
    const j = jugadores.find((x) => x.id === selId);
    const valores = series[j.id] || [];
    const estado = estadoDe(valores);
    const r = resumenDe(estado);
    const asis = asisPorJugador.find((a) => a.player_id === j.id) || null;
    const nEstrellas = (estrellas[j.id] || []).length;

    mount(nodoFicha,
      /* ── arriba, sus datos ── */
      h('div', { class: 'eq-prog-cab' },
        avatar(j.nombre),
        h('div', { class: 'eq-prog-cab-txt' },
          h('h3', { class: 'eq-prog-nombre' }, j.nombre),
          h('span', { class: 'eq-ayuda' },
            [j.dorsal != null ? `dorsal ${j.dorsal}` : null, j.posicion, textoSinMirar(diasSinMirar(valores))]
              .filter(Boolean).join(' · ')),
        ),
      ),
      h('div', { class: 'eq-prog-datos' },
        dato(asis ? `${asis.pct} %` : '—', 'asistencia', asis ? `${asis.entrenaron} de ${asis.total} sesiones` : 'sin datos todavía'),
        dato(String(nEstrellas), nEstrellas === 1 ? 'estrella' : 'estrellas', 'las que se le han puesto en caliente'),
        dato(String(r.miradas), r.miradas === 1 ? 'fila mirada' : 'filas miradas', 'de la rúbrica'),
        dato(movimientoTexto(r), 'movimiento', 'cuántas filas han subido o bajado de nivel'),
      ),

      /* ── sus objetivos (Tramo 3.10) ── */
      seccionObjetivos(j, estado),

      /* ── debajo, sus gráficas ── */
      r.miradas
        ? h('div', { class: 'flow' },
            grafico('Dónde está ahora', graficaNiveles(estado, filas)),
            filaAbierta
              ? grafico(`Cómo ha ido en «${nombreDe(filaAbierta, filas)}»`, graficaLinea(serieDe(valores, filaAbierta)))
              : h('p', { class: 'eq-ayuda' }, 'Toca una fila de arriba para ver cómo ha ido en el tiempo.'),
            grafico('Asistencia por mes', graficaAsistencia(asistencia.filter((a) => a.player_id === j.id))),
          )
        : h('div', { class: 'eq-prog-vacio' },
            h('p', {}, 'A este jugador todavía no se le ha mirado ninguna fila de la rúbrica.'),
            h('p', { class: 'eq-ayuda' },
              'Se hace al cerrar una sesión, y con dos minutos dan para cinco jugadores. '
              + 'Hasta que haya dos valoraciones de la misma fila no hay movimiento que enseñar: '
              + 'una progresión necesita al menos dos puntos.'),
          ),
    );
  }

  /* ---- objetivos individuales (Tramo 3.10) ------------------------
     «Uno o dos vivos por niño, propuestos desde su propia rúbrica»
     (§5.7). La propuesta sale de lo que YA se ha medido en él: la fila
     donde está más bajo es, por definición, donde más tiene que ganar.

     El «uno o dos» se dice, no se impide. Un entrenador que en una
     semana rara tenga tres abiertos está trabajando, no corrompiendo
     nada. */
  function seccionObjetivos(j, estado) {
    const suyos = (porJugadorObj[j.id] || []).filter((o) => o.estado !== 'archivado');
    const vivos = suyos.filter((o) => o.estado === 'activo');
    const todas = proponerObjetivos(estado, filas, { cuantos: 3 });
    const propuestas = todas.filter((p) => !vivos.some((o) => (o.dianas || []).includes(p.fila.clave)));

    const crear = async (p) => {
      const hoy = new Date();
      const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const fin = new Date(hoy.getTime() + 60 * 86400000);
      try {
        const nuevo = await crearObjetivo({
          team_id: teamId, season_id: seasonId, player_id: j.id,
          titulo: tituloPropuesta(p),
          descripcion: null,
          categoria: esConducta(p.fila.clave) ? 'conducta' : 'técnico',
          fecha_inicio: iso(hoy), fecha_fin: iso(fin),
          dianas: [p.fila.clave],
        });
        (porJugadorObj[j.id] ||= []).push(nuevo);
        toast('Objetivo puesto');
        pintaFicha();
      } catch (e) { toast(`No se ha podido crear: ${e.message}`, 'error'); }
    };

    const cerrar = async (o, estadoNuevo) => {
      try {
        await actualizarObjetivo(o.id, { estado: estadoNuevo });
        o.estado = estadoNuevo;
        pintaFicha();
      } catch (e) { toast(`Error: ${e.message}`, 'error'); }
    };

    return h('section', { class: 'eq-prog-graf' },
      h('h4', { class: 'eq-prog-graf-t' }, 'Sus objetivos'),
      vivos.length > 2
        ? h('p', { class: 'eq-ayuda eq-prog-aviso' },
            `${vivos.length} objetivos vivos. Con uno o dos se sigue la pista; con cinco no se sigue ninguno.`)
        : null,
      suyos.length
        ? h('div', { class: 'eq-prog-objs' }, ...suyos.map((o) => h('div', {
            class: 'eq-prog-obj' + (o.estado === 'conseguido' ? ' es-hecho' : ''),
          },
          h('span', { class: 'eq-prog-obj-t' }, o.titulo),
          o.estado === 'activo'
            ? h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', onClick: () => cerrar(o, 'conseguido') }, '✓')
            : h('span', { class: 'eq-obj-badge eq-obj-badge-ok' }, '✓ conseguido'),
          o.estado === 'activo'
            ? h('button', { class: 'btn btn-secondary eq-btn-mini', type: 'button', title: 'Archivar', onClick: () => cerrar(o, 'archivado') }, '×')
            : null,
        )))
        : h('p', { class: 'eq-ayuda' }, 'Todavía no tiene ninguno.'),
      propuestas.length
        ? h('div', { class: 'eq-prog-props' },
            h('span', { class: 'eq-ayuda' }, 'De su propia rúbrica:'),
            ...propuestas.map((p) => h('button', {
              class: 'eq-prog-prop', type: 'button',
              title: 'Ponérselo como objetivo, para los próximos dos meses',
              onClick: () => crear(p),
            }, '+ ', tituloPropuesta(p))),
          )
        : h('p', { class: 'eq-ayuda' }, todas.length
            ? 'Ya tiene objetivo en todo lo que se le ha mirado y está por debajo del tope.'
            : 'Para proponerle objetivos hace falta haberle mirado alguna fila de la rúbrica '
              + 'en la que no esté ya arriba del todo.'),
    );
  }

  const dato = (num, lbl, titulo) => h('div', { class: 'eq-prog-dato', title: titulo || '' },
    h('span', { class: 'eq-prog-num' }, num),
    h('span', { class: 'eq-prog-lbl' }, lbl));

  const movimientoTexto = (r) => {
    if (!r.subidas && !r.bajadas) return '—';
    return [r.subidas ? `↑${r.subidas}` : null, r.bajadas ? `↓${r.bajadas}` : null].filter(Boolean).join(' ');
  };

  const nombreDe = (clave, todas) => todas.find((f) => f.clave === clave)?.nombre || clave;

  const grafico = (titulo, cuerpo) => h('section', { class: 'eq-prog-graf' },
    h('h4', { class: 'eq-prog-graf-t' }, titulo), cuerpo);

  /* ---- gráfica 1: dónde está ahora --------------------------------
     Una barra de cuatro escalones por fila mirada, conductas primero.
     No es un ranking: es un mapa de por dónde va, y por eso se lee de
     un vistazo cuáles están abajo. */
  function graficaNiveles(estado, todas) {
    const mirados = todas.filter((f) => estado[f.clave]);
    mirados.sort((a, b) => {
      const ca = esConducta(a.clave) ? 0 : 1, cb = esConducta(b.clave) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return estado[a.clave].nivel - estado[b.clave].nivel;
    });

    return h('div', { class: 'eq-prog-barras' }, ...mirados.map((f) => {
      const e = estado[f.clave];
      const mov = movimiento(estado, f.clave);
      return h('button', {
        class: 'eq-prog-barra' + (filaAbierta === f.clave ? ' is-sel' : ''), type: 'button',
        title: `${NIVELES[e.nivel].nombre} — ${NIVELES[e.nivel].nota}`,
        onClick: () => { filaAbierta = filaAbierta === f.clave ? null : f.clave; pintaFicha(); },
      },
        h('span', { class: 'eq-prog-barra-t' + (esConducta(f.clave) ? ' es-conducta' : '') }, f.nombre),
        h('span', { class: 'eq-prog-esc' }, ...NIVELES.map((n) => h('span', {
          class: 'eq-prog-paso' + (n.valor <= e.nivel ? ' is-on' : ''),
        }))),
        mov ? h('span', { class: 'eq-prog-mov' + (mov > 0 ? ' es-sube' : ' es-baja') }, mov > 0 ? '↑' : '↓') : null,
      );
    }));
  }

  /* ---- gráfica 2: cómo ha ido en el tiempo ------------------------
     Escalonada y no suave: entre dos valoraciones no hay nada medido,
     y una línea recta entre ellas dibujaría un progreso que nadie ha
     visto. El nivel se mantiene hasta que alguien mira otra vez. */
  function graficaLinea(puntos) {
    if (puntos.length < 2) {
      return h('p', { class: 'eq-ayuda' },
        'Solo hay una valoración de esta fila. Una progresión necesita al menos dos puntos.');
    }
    const W = 520, H = 130, padL = 92, padB = 26, padT = 10;
    const x0 = padL, x1 = W - 12, y1 = H - padB, y0 = padT;
    const X = (i) => x0 + (puntos.length === 1 ? 0 : (i / (puntos.length - 1)) * (x1 - x0));
    const Y = (n) => y1 - (n / NIVEL_MAX) * (y1 - y0);

    const hijos = [];
    for (const n of NIVELES) {
      hijos.push(h('line', { class: 'eq-prog-guia', x1: x0, y1: Y(n.valor), x2: x1, y2: Y(n.valor) }));
      hijos.push(h('text', { class: 'eq-prog-eje', x: x0 - 8, y: Y(n.valor) + 4, 'text-anchor': 'end' }, n.nombre));
    }
    const pts = [];
    puntos.forEach((p, i) => {
      if (i) { pts.push(`${X(i).toFixed(1)},${Y(puntos[i - 1].nivel).toFixed(1)}`); }
      pts.push(`${X(i).toFixed(1)},${Y(p.nivel).toFixed(1)}`);
    });
    hijos.push(h('polyline', { class: 'eq-prog-linea', points: pts.join(' ') }));
    puntos.forEach((p, i) => {
      hijos.push(h('circle', { class: 'eq-prog-punto', cx: X(i), cy: Y(p.nivel), r: 4 },
        h('title', {}, `${p.fecha} · ${NIVELES[p.nivel].nombre}`)));
    });
    hijos.push(h('text', { class: 'eq-prog-eje', x: x0, y: H - 6 }, puntos[0].fecha));
    hijos.push(h('text', { class: 'eq-prog-eje', x: x1, y: H - 6, 'text-anchor': 'end' }, puntos[puntos.length - 1].fecha));

    return h('svg', { class: 'eq-prog-svg', viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `De ${NIVELES[puntos[0].nivel].nombre} a ${NIVELES[puntos[puntos.length - 1].nivel].nombre}` }, ...hijos);
  }

  /* ---- gráfica 3: asistencia por mes ------------------------------ */
  function graficaAsistencia(filasJugador) {
    const porMes = new Map();
    for (const f of filasJugador || []) {
      const fecha = f.sessions?.fecha || f.fecha;
      if (!fecha) continue;
      const k = String(fecha).slice(0, 7);
      const m = porMes.get(k) || { total: 0, vino: 0 };
      m.total += 1;
      if (f.estado === 'presente' || f.estado === 'tarde') m.vino += 1;
      porMes.set(k, m);
    }
    const meses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (!meses.length) return h('p', { class: 'eq-ayuda' }, 'Todavía no hay sesiones con lista pasada.');

    return h('div', { class: 'eq-prog-meses' }, ...meses.map(([k, m]) => {
      const pct = m.total ? Math.round((m.vino / m.total) * 100) : 0;
      return h('div', { class: 'eq-prog-mes', title: `${m.vino} de ${m.total} sesiones` },
        h('div', { class: 'eq-prog-mes-barra' }, h('div', { class: 'eq-prog-mes-relleno', style: { height: `${pct}%` } })),
        h('span', { class: 'eq-prog-mes-n' }, `${pct}%`),
        h('span', { class: 'eq-prog-mes-t' }, MESES[Number(k.slice(5, 7)) - 1]),
      );
    }));
  }

  mount(zona, h('div', { class: 'eq-prog' }, nodoLista, nodoFicha));
  pintaLista();
  pintaFicha();
}
