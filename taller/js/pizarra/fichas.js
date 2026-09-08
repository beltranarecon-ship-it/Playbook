/* ============================================================
   pizarra/fichas.js — colocar y arrastrar (§3.2, §3.3, §3.4, §3.5).

   La primera capa de verdad de la Pizarra: dibuja lo que hay puesto y
   deja moverlo. Se cuelga de un Lienzo y usa su enganche de gestos, su
   sistema de capas y sus conversores; no sabe nada de zoom ni de
   punteros.

   Toca el canvas, así que no tiene banco propio: lo que se puede
   probar en Node —el modelo, el acierto, el imán, las guías— vive en
   elementos.js, seleccion.js, iman.js y guias.js, que sí lo tienen.
   Aquí solo queda el pegamento.

   ── ARRASTRAR MUEVE, EL ANILLO DIBUJA (§3.3) ────────────────
   El botón izquierdo sobre una ficha la mueve, siempre. Sobre el suelo
   vacío, marca un marco de selección. Dibujar trazos NO se hace desde
   aquí: eso empieza después de elegir una acción, y es de la capa 2.

   ── EL CONFLICTO DE SHIFT, Y CÓMO SE RESUELVE ───────────────
   La especificación le da a Shift dos trabajos: sumar a la selección
   (§3.2) y activar el imán (§3.4). No se pisan porque se leen en
   momentos distintos:

     Shift AL PINCHAR      → suma o resta de la selección
     Shift MIENTRAS MUEVES → pega al punto más cercano

   Es coherente —la tecla dice «afina lo que estoy haciendo» en los dos
   casos— pero conviene saberlo: si mantienes Shift desde antes de
   pinchar hasta soltar, haces las dos cosas a la vez.
   ============================================================ */

import { COLORS } from '../canvas/colors.js';
import { drawPlayer, drawBall, drawCone, drawPelotaTenis, drawEscalera, drawZona } from '../canvas/symbols.js';
import { contornoDe, centroDe } from '../canvas/zonas.js';
import { mover, seguirAlPortador, soltarBalon, numeroDe, llevaBalon } from './elementos.js';
import { acierto, marcoDesde, enMarco, alPinchar, alMarcar } from './seleccion.js';
import { puntosDeIman, imantar } from './iman.js';
import { guiasDe, hayGuias } from './guias.js';

/* En qué orden se pintan. Las zonas son el suelo del dibujo y el balón
   va encima de todo, que es como se lee una pizarra de verdad. */
const ORDEN = { zona: 0, escalera: 1, pelota: 2, cono: 3, jugador: 4, balon: 5 };

export class Fichas {
  constructor(lienzo, { canasta = 'norte', posiciones = {} } = {}) {
    this.lienzo = lienzo;
    this.canasta = canasta;
    this.posiciones = posiciones;
    this.elementos = [];
    this.seleccion = new Set();
    this.onCambio = null;      // (elementos, seleccion)
    this.donde = null;         // (elemento) -> {x,y} para pintarlo en otro sitio
    /* TOCAR no es lo mismo que ARRASTRAR, y de esa diferencia vive el
       §3.3: arrastrar una ficha la mueve, tocarla abre su anillo. Los
       dos empiezan con el mismo `pointerdown`, así que quien quiera
       distinguirlos tiene que esperar a saber cómo acabó — y eso solo
       lo sabe el motor de gestos, que es quien avisa aquí. */
    this.onTocarFicha = null;  // (elemento, {tipoPuntero})
    this.onTocarSuelo = null;  // ({x,y,tipoPuntero}) donde y con que se toco

    this._marco = null;        // el marco de selección mientras se arrastra
    this._guias = null;        // las guías mientras se mueve algo
    this._pegado = null;       // a qué se ha pegado el imán

    this._quitarCapas = [
      lienzo.capa('fichas', (c) => this._dibujar(c), { tipo: 'mundo', orden: 10 }),
      lienzo.capa('ayudas', (c) => this._dibujarAyudas(c), { tipo: 'pantalla', orden: 10 }),
    ];
    this._quitarGesto = lienzo.gesto('fichas', (i) => this._atender(i), { orden: 0 });
  }

  /* ---- estado ------------------------------------------------ */

  poner(elementos) {
    this.elementos = elementos;
    this.lienzo.pintar();
  }

  _cambio(elementos) {
    this.elementos = seguirAlPortador(elementos, this.lienzo.vista.pistaKey);
    this.onCambio?.(this.elementos, this.seleccion);
    this.lienzo.pintar();
  }

  seleccionar(ids) {
    this.seleccion = new Set(ids);
    this.onCambio?.(this.elementos, this.seleccion);
    this.lienzo.pintar();
  }

  /* ---- el gesto ---------------------------------------------- */

  _atender(intento) {
    const l = this.lienzo;
    const pista = l.vista.pistaKey;
    /* El suelo de agarre del dedo llega en píxeles de PANTALLA y aquí
       se necesita en metros: es lo único que hay que traducir, y se
       traduce con el zoom de AHORA. */
    const minimoM = l.metros(intento.agarrePx);
    const bajoElDedo = acierto(this.elementos, intento, { pista, minimoM });

    if (!bajoElDedo) return this._marcar(intento);

    /* Si lo pinchado no estaba seleccionado, pasa a estarlo antes de
       moverse. Si ya lo estaba, se respeta la selección entera: es lo
       que permite coger cinco fichas y moverlas juntas. */
    if (!this.seleccion.has(bajoElDedo.id) || intento.shift) {
      this.seleccionar(alPinchar(this.seleccion, bajoElDedo.id, { shift: intento.shift }));
    }
    if (!this.seleccion.has(bajoElDedo.id)) return null;   // Shift lo ha quitado

    return this._arrastrar(intento, bajoElDedo);
  }

  /** Mover lo seleccionado. */
  _arrastrar(intento, agarrado) {
    const pista = this.lienzo.vista.pistaKey;
    const antes = new Map(this.elementos.map((e) => [e.id, { x: e.x, y: e.y }]));
    /* El desfase se guarda en NORMALIZADO y no en píxeles: si se
       guardara en píxeles, acercar a mitad de arrastre haría saltar la
       ficha, porque el mismo desfase valdría otra distancia. */
    const desfase = new Map();
    for (const id of this.seleccion) {
      const p = antes.get(id);
      if (p) desfase.set(id, { dx: p.x - intento.x, dy: p.y - intento.y });
    }
    const puntos = puntosDeIman({
      pista, canasta: this.canasta, elementos: this.elementos,
      posiciones: this.posiciones, excluir: [...this.seleccion],
    });

    /* Arrastrar un balón que llevaba alguien lo SUELTA (§7.3). Es lo
       que hace falta el balón al lado de la ficha y no encima: si
       estuviera centrado no habría dónde cogerlo. */
    const soltarAlMover = agarrado.kind === 'balon' && agarrado.portador_id;

    return {
      mover: (p) => {
        let ancla = { x: p.x, y: p.y };
        this._pegado = null;
        if (soltarAlMover && this.elementos.find((e) => e.id === agarrado.id)?.portador_id) {
          this.elementos = soltarBalon(this.elementos, agarrado.id);
        }
        /* El imán solo actúa sobre la ficha AGARRADA; las demás la
           siguen. Pegar cada una por su cuenta desharía la figura que
           el entrenador acababa de colocar. */
        if (p.shift) {
          const pegado = imantar(ancla, puntos, pista);
          if (pegado) { ancla = { x: pegado.x, y: pegado.y }; this._pegado = pegado; }
        }
        const destinos = {};
        for (const [id, d] of desfase) {
          destinos[id] = id === agarrado.id && this._pegado
            ? { x: ancla.x, y: ancla.y }
            : { x: ancla.x + d.dx, y: ancla.y + d.dy };
        }
        this._guias = this._pegado ? null : guiasDe(
          { id: agarrado.id, ...destinos[agarrado.id] },
          this.elementos.filter((e) => !this.seleccion.has(e.id)),
          pista, { conAnclas: true, canasta: this.canasta },
        );
        this._cambio(mover(this.elementos, destinos));
      },
      soltar: () => { this._guias = null; this._pegado = null; this.lienzo.pintar(); },
      tocar: (p) => { this._guias = null; this._pegado = null; this.onTocarFicha?.(agarrado, { tipoPuntero: p.tipoPuntero }); },
      abortar: () => {
        /* No ha pasado: todo vuelve a donde estaba. Es lo que hace que
           apoyar el meñique a mitad de un arrastre no deje la ficha en
           un sitio que nadie eligió. */
        this._guias = null; this._pegado = null;
        const destinos = {};
        for (const id of desfase.keys()) destinos[id] = antes.get(id);
        this._cambio(mover(this.elementos, destinos));
      },
    };
  }

  /** Marco de selección sobre el suelo vacío. */
  _marcar(intento) {
    const inicio = { x: intento.x, y: intento.y };
    const shift = intento.shift;
    const previa = new Set(this.seleccion);
    return {
      mover: (p) => {
        this._marco = marcoDesde(inicio, p);
        this.seleccion = alMarcar(previa, enMarco(this.elementos, this._marco), { shift });
        this.onCambio?.(this.elementos, this.seleccion);
        this.lienzo.pintar();
      },
      soltar: () => { this._marco = null; this.lienzo.pintar(); },
      tocar: (p) => { this._marco = null; this.seleccionar(alPinchar(this.seleccion, null, { shift })); this.onTocarSuelo?.({ x: p.x, y: p.y, tipoPuntero: p.tipoPuntero }); },
      abortar: () => { this._marco = null; this.seleccionar(previa); },
    };
  }

  /* ---- dibujo ------------------------------------------------ */

  _dibujar({ ctx, vista, R, toPx, seVe }) {
    const orden = [...this.elementos].sort((a, b) => (ORDEN[a.kind] ?? 9) - (ORDEN[b.kind] ?? 9));
    for (const e of orden) {
      if (e.kind === 'zona') { this._dibujarZona(ctx, vista, e, R); continue; }
      /* `donde` deja que otro diga en qué punto pintar una ficha SIN
         tocar el modelo. Lo usa el repaso del §5.4 —la ficha recorre
         el trazo recién dibujado mientras sus datos ya están en el
         final— y lo usará la reproducción de la fase. Que se pinte en
         otro sitio y que esté en otro sitio son cosas distintas, y
         mover el modelo para animar es lo que hace que una animación
         interrumpida deje las fichas a mitad de camino. */
      const p = this.donde?.(e) || e;
      if (!Number.isFinite(p.x) || !seVe(p.x, p.y, 0.05)) continue;
      const [px, py] = toPx(p.x, p.y);
      const sel = this.seleccion.has(e.id);
      switch (e.kind) {
        case 'jugador':
          drawPlayer(ctx, px, py, R.jugador, {
            color: COLORS[e.equipo] || COLORS.A,
            label: numeroDe(e),
            selected: sel,
            carrying: llevaBalon(this.elementos, e.id),
            alpha: e.en_juego === false ? 0.45 : 1,
          });
          break;
        case 'balon': drawBall(ctx, px, py, R.balon, { selected: sel }); break;
        case 'cono': drawCone(ctx, px, py, R.cono, { selected: sel }); break;
        case 'pelota': drawPelotaTenis(ctx, px, py, R.pelota, { selected: sel }); break;
        case 'escalera': drawEscalera(ctx, px, py, R.metro, (e.rot ?? 0) + (vista.rot || 0), { selected: sel }); break;
        default: break;
      }
    }
  }

  _dibujarZona(ctx, vista, z, R) {
    const { puntos, cerrado } = contornoDe(vista.pistaKey, z);
    const c = centroDe(vista.pistaKey, z);
    drawZona(ctx, {
      puntos: puntos.map((p) => { const [x, y] = vista.toPx(p.x, p.y); return { x, y }; }),
      cerrado,
      centro: (([x, y]) => ({ x, y }))(vista.toPx(c.x, c.y)),
      nombre: z.nombre,
    }, { selected: this.seleccion.has(z.id), trazo: R.metro * 0.08, texto: Math.max(11, R.metro * 0.9) });
  }

  /**
   * Las ayudas van en la capa de PANTALLA, y no es un detalle: el
   * marco de selección y las guías tienen que medir un píxel al 50 % y
   * al 400 %. Puestas en la capa de mundo, al acercar se volverían
   * franjas gordas.
   */
  _dibujarAyudas({ ctx, vista }) {
    if (this._guias && hayGuias(this._guias)) {
      ctx.save();
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = vista.hairline(1);
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      for (const g of this._guias.verticales) {
        const [x0, y0] = vista.toPx(g.x, 0);
        const [x1, y1] = vista.toPx(g.x, 1);
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      }
      for (const g of this._guias.horizontales) {
        const [x0, y0] = vista.toPx(0, g.y);
        const [x1, y1] = vista.toPx(1, g.y);
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (this._pegado) {
      const [px, py] = vista.toPx(this._pegado.x, this._pegado.y);
      ctx.save();
      ctx.strokeStyle = COLORS.ball;
      ctx.lineWidth = vista.hairline(2);
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.font = "600 12px 'Hanken Grotesk', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,25,56,.75)';
      ctx.strokeText(this._pegado.nombre, px, py - 15);
      ctx.fillStyle = '#fff';
      ctx.fillText(this._pegado.nombre, px, py - 15);
      ctx.restore();
    }

    if (this._marco) {
      const [x0, y0] = vista.toPx(this._marco.x0, this._marco.y0);
      const [x1, y1] = vista.toPx(this._marco.x1, this._marco.y1);
      ctx.save();
      ctx.fillStyle = 'rgba(0,111,148,.10)';
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = vista.hairline(1);
      ctx.setLineDash([4, 3]);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
  }

  destroy() {
    this._quitarCapas.forEach((f) => f());
    this._quitarGesto?.();
  }
}
