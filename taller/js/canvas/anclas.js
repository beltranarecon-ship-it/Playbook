/* ============================================================
   canvas/anclas.js — anclas MEDIDAS de las 4 pistas (Tramo 2).

   GENERADO por taller/tools/gen-anclas.mjs desde
   taller/tools/anclas-medidas.json — NO editar a mano: corrige el
   JSON y regenera con `node taller/tools/gen-anclas.mjs`.

   Coordenadas normalizadas [0,1] en el MISMO marco que court.js y
   el resto del motor (las medias van dibujadas en paisaje con el
   aro a la izquierda; izq/der de los nombres = arriba/abajo en
   pantalla, pero las coords ya lo llevan incorporado).

   Diferencia deliberada con court.js: en las MEDIAS el centro REAL
   del aro está en x≈0.172 (medido sobre el render), mientras
   PISTAS.media.baskets usa x≈0.143 (cae entre tablero y aro).
   court.js sigue mandando en la lógica de lado/orientación
   (canastaKey, haciaCanasta, resaltado del aro); estas anclas dan
   el ENDPOINT exacto del tiro y las posiciones con nombre.
   ============================================================ */

export const ANCLAS = {
  "entera": {
    "frame": {
      "sideline": [
        0.057,
        0.942
      ],
      "baseline": [
        0.02,
        0.98
      ],
      "centerX": 0.499,
      "key": [
        0.376,
        0.622
      ]
    },
    "pos": {
      "norte": {
        "aro": [
          0.499,
          0.091
        ],
        "poste_bajo_izq": [
          0.376,
          0.111
        ],
        "poste_bajo_der": [
          0.622,
          0.111
        ],
        "poste_alto_izq": [
          0.376,
          0.186
        ],
        "poste_alto_der": [
          0.622,
          0.186
        ],
        "codo_izq": [
          0.376,
          0.236
        ],
        "codo_der": [
          0.622,
          0.236
        ],
        "tiro_libre": [
          0.499,
          0.236
        ],
        "base": [
          0.499,
          0.306
        ],
        "escolta_izq": [
          0.339,
          0.286
        ],
        "escolta_der": [
          0.659,
          0.286
        ],
        "alero_izq": [
          0.107,
          0.266
        ],
        "alero_der": [
          0.892,
          0.266
        ],
        "esquina_izq": [
          0.087,
          0.08
        ],
        "esquina_der": [
          0.912,
          0.08
        ],
        "centro": [
          0.499,
          0.5
        ]
      },
      "sur": {
        "aro": [
          0.499,
          0.909
        ],
        "poste_bajo_izq": [
          0.376,
          0.889
        ],
        "poste_bajo_der": [
          0.622,
          0.889
        ],
        "poste_alto_izq": [
          0.376,
          0.814
        ],
        "poste_alto_der": [
          0.622,
          0.814
        ],
        "codo_izq": [
          0.376,
          0.764
        ],
        "codo_der": [
          0.622,
          0.764
        ],
        "tiro_libre": [
          0.499,
          0.764
        ],
        "base": [
          0.499,
          0.694
        ],
        "escolta_izq": [
          0.339,
          0.714
        ],
        "escolta_der": [
          0.659,
          0.714
        ],
        "alero_izq": [
          0.107,
          0.734
        ],
        "alero_der": [
          0.892,
          0.734
        ],
        "esquina_izq": [
          0.087,
          0.92
        ],
        "esquina_der": [
          0.912,
          0.92
        ],
        "centro": [
          0.499,
          0.5
        ]
      }
    }
  },
  "entera_fiba": {
    "frame": {
      "sideline": [
        0.0595,
        0.936
      ],
      "baseline": [
        0.084,
        0.907
      ],
      "centerX": 0.498,
      "key": [
        0.371,
        0.625
      ]
    },
    "pos": {
      "norte": {
        "aro": [
          0.499,
          0.096
        ],
        "poste_bajo_izq": [
          0.371,
          0.116
        ],
        "poste_bajo_der": [
          0.625,
          0.116
        ],
        "poste_alto_izq": [
          0.371,
          0.194
        ],
        "poste_alto_der": [
          0.625,
          0.194
        ],
        "codo_izq": [
          0.371,
          0.244
        ],
        "codo_der": [
          0.625,
          0.244
        ],
        "tiro_libre": [
          0.498,
          0.244
        ],
        "base": [
          0.498,
          0.314
        ],
        "escolta_izq": [
          0.338,
          0.294
        ],
        "escolta_der": [
          0.658,
          0.294
        ],
        "alero_izq": [
          0.11,
          0.274
        ],
        "alero_der": [
          0.886,
          0.274
        ],
        "esquina_izq": [
          0.089,
          0.144
        ],
        "esquina_der": [
          0.906,
          0.144
        ],
        "centro": [
          0.498,
          0.5
        ]
      },
      "sur": {
        "aro": [
          0.499,
          0.894
        ],
        "poste_bajo_izq": [
          0.371,
          0.874
        ],
        "poste_bajo_der": [
          0.625,
          0.874
        ],
        "poste_alto_izq": [
          0.371,
          0.797
        ],
        "poste_alto_der": [
          0.625,
          0.797
        ],
        "codo_izq": [
          0.371,
          0.747
        ],
        "codo_der": [
          0.625,
          0.747
        ],
        "tiro_libre": [
          0.498,
          0.747
        ],
        "base": [
          0.498,
          0.677
        ],
        "escolta_izq": [
          0.338,
          0.697
        ],
        "escolta_der": [
          0.658,
          0.697
        ],
        "alero_izq": [
          0.11,
          0.717
        ],
        "alero_der": [
          0.886,
          0.717
        ],
        "esquina_izq": [
          0.089,
          0.847
        ],
        "esquina_der": [
          0.906,
          0.847
        ],
        "centro": [
          0.498,
          0.5
        ]
      }
    }
  },
  "media": {
    "frame": {
      "baseline_x": 0.146,
      "halfcourt_x": 0.829,
      "sideline_y": [
        0.05,
        0.943
      ],
      "centerY": 0.496,
      "ft_x": 0.336,
      "key_y": [
        0.386,
        0.606
      ]
    },
    "pos": {
      "norte": {
        "aro": [
          0.172,
          0.5
        ],
        "poste_bajo_izq": [
          0.192,
          0.386
        ],
        "poste_bajo_der": [
          0.192,
          0.606
        ],
        "codo_izq": [
          0.336,
          0.386
        ],
        "codo_der": [
          0.336,
          0.606
        ],
        "tiro_libre": [
          0.336,
          0.496
        ],
        "base": [
          0.406,
          0.496
        ],
        "escolta_izq": [
          0.386,
          0.336
        ],
        "escolta_der": [
          0.386,
          0.656
        ],
        "alero_izq": [
          0.366,
          0.1
        ],
        "alero_der": [
          0.366,
          0.893
        ],
        "esquina_izq": [
          0.206,
          0.1
        ],
        "esquina_der": [
          0.206,
          0.893
        ],
        "centro": [
          0.487,
          0.496
        ]
      }
    }
  },
  "media_fiba": {
    "frame": {
      "baseline_x": 0.146,
      "halfcourt_x": 0.824,
      "sideline_y": [
        0.098,
        0.902
      ],
      "centerY": 0.5,
      "ft_x": 0.336,
      "key_y": [
        0.39,
        0.61
      ]
    },
    "pos": {
      "norte": {
        "aro": [
          0.172,
          0.499
        ],
        "poste_bajo_izq": [
          0.192,
          0.39
        ],
        "poste_bajo_der": [
          0.192,
          0.61
        ],
        "codo_izq": [
          0.336,
          0.39
        ],
        "codo_der": [
          0.336,
          0.61
        ],
        "tiro_libre": [
          0.336,
          0.5
        ],
        "base": [
          0.406,
          0.5
        ],
        "escolta_izq": [
          0.386,
          0.34
        ],
        "escolta_der": [
          0.386,
          0.66
        ],
        "alero_izq": [
          0.366,
          0.148
        ],
        "alero_der": [
          0.366,
          0.852
        ],
        "esquina_izq": [
          0.206,
          0.148
        ],
        "esquina_der": [
          0.206,
          0.852
        ],
        "centro": [
          0.485,
          0.5
        ]
      }
    }
  }
};

// posiciones de una pista+canasta; con una sola canasta (medias) se
// ignora la clave pedida y se usa la única existente. null si la
// pista no está en el registro.
export function posicionesDe(pista, canasta) {
  const p = ANCLAS[pista];
  if (!p || !p.pos) return null;
  return p.pos[canasta] || p.pos.norte || p.pos[Object.keys(p.pos)[0]] || null;
}

/** Centro EXACTO (medido) del aro de esa pista+canasta. [x,y] | null. */
export function aroExacto(pista, canasta) {
  const pos = posicionesDe(pista, canasta);
  return pos ? pos.aro : null;
}
