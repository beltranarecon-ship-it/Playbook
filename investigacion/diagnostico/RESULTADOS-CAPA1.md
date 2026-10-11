# Resultados de la capa 1 — banco de diagnóstico

Fecha: 2026-10-04. Script: `investigacion/diagnostico/banco-clasicos.mjs` (`node investigacion/diagnostico/banco-clasicos.mjs`). No es un banco de pruebas: no falla por lo que encuentra, solo informa. No modifica nada de la app.

## Qué hace

Monta los diez ejercicios clásicos sobre un Tablero real (con un DOM de mentira, como `eval-referencia.mjs`), los compila y los recorre con el mismo `AnimationEngine` que reproduce. Mide en cada fase:

- que el balón de quien lo lleva esté en sus manos al acabar la fase y a mitad de cada recorrido suyo;
- que cada pase llegue donde está el receptor en el instante en que llega;
- que tras un tiro el balón quede suelto;
- que ningún jugador lleve dos balones;
- que cada defensor acabe cerca de algún atacante.

## Resultado

**10 ejercicios · 2 fallos medidos · 11 capacidades que faltan.** Los diez se pueden dibujar y compilar sin avisos, salvo un paso rechazado (más abajo).

### Fallos medidos

| # | Dónde | Qué pasa |
|---|---|---|
| F1 | Ejercicio 1 | Tras **«Entra a canasta»** el balón sigue siendo del jugador al acabar la fase. La fase siguiente no puede «Recoger»: el paso se rechaza con «no hay ningún balón suelto que recoger». Es lo que decía el entrenador: la entrada no suelta el balón. |
| F2 | Ejercicio 2 | El **pase al que está cortando** cae a 0,07 del receptor. El pase sale cuando el receptor ya corre (los tiempos se solapan: pase 968–1577 ms, corte 968–2042 ms), pero el balón va al punto donde se dibujó, no a donde está él cuando llega. |

### Capacidades que faltan

| Capacidad | Ejercicios que la piden |
|---|---|
| Entrada con desenlace (suelta el balón como un tiro) | 1 |
| Establecer rotación en conos y rotar de fila | 1, 2, 3, 4 |
| Papel y equipo de la fila de destino al rotar | 4, 7 |
| Acción «Cambia de equipo» | 4 |
| Pase en carrera (punto del corte del receptor) | 2, 6, 10 |
| Colocaciones de serie (1-4 alto, etc.) | 9 |
| Bote que guarda qué conos sortea | 5 (sin verificar, ver límites) |

## Lo que este diagnóstico NO ve

- **Las interacciones.** Monta los ejercicios con llamadas internas del Tablero (`_trazoHecho`, `_elegir`…), no con gestos. Los fallos que cuenta el entrenador de la pantalla —no mover una ficha en fases posteriores, «Siguiente fase» sin efecto con la fase vacía, el cúmulo de flechas, el anillo con variantes— se reprodujeron a mano en `dev/pizarra.html` y están en `DISENO-MOTOR.md`.
- **Los balones que el entrenador dice que fallan.** Con la API interna los balones salen coherentes en los diez. Eso apunta a que el fallo está en cómo se **dan, quitan o mueven** los balones desde la pantalla (dar un balón, soltarlo sobre otra ficha, varios balones a la vez). Hay que reproducirlos con gestos, en `dev/pizarra.html`.
- **La defensa.** No hay en el banco ningún defensor lejos del atacante, pero la medida es tosca (distancia al atacante más cercano). «Marca a quien debe» y «se coloca en sitios absurdos» pedirán ejercicios con defensa concreta y una medida mejor.
- **El zigzag del ejercicio 5.** El diagnóstico no comprueba si la curva rodea los conos; solo que se dibuja y se compila.

## Conclusión para el plan

La capa 2 (balones) no tiene por dónde empezar con este banco, salvo F1 y F2. Antes de arreglar «los balones» hay que **reproducirlos con gestos en la pantalla**. Propuesta: una sesión corta en `dev/pizarra.html` con el entrenador, o con descripciones paso a paso de cuándo falla el balón.
