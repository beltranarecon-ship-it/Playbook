-- ============================================================
-- 039_invitaciones_email_unico.sql — que se pueda reinvitar.
--
-- ── EL FALLO ────────────────────────────────────────────────
-- La función que manda la invitación hace un upsert por correo, para
-- que reinvitar a alguien que ya está en la lista sirva para volver a
-- mandarle el enlace —que es justo lo que se hace cuando alguien dice
-- «no me ha llegado»—:
--
--   .upsert({ email, … }, { onConflict: 'email' })
--
-- Y eso, tal cual está la tabla, NO FUNCIONA. La 032 protege el correo
-- con un índice sobre una EXPRESIÓN:
--
--   CREATE UNIQUE INDEX invitaciones_email
--     ON public.invitaciones (lower(trim(email)));
--
-- Un `ON CONFLICT (email)` no puede resolverse contra un índice de
-- expresión: PostgreSQL busca un índice único sobre la COLUMNA `email`
-- y no lo encuentra. Resultado:
--
--   «there is no unique or exclusion constraint matching the
--    ON CONFLICT specification»
--
-- en TODAS las invitaciones, no en algunas. La función habría salido
-- muerta.
--
-- Es exactamente el mismo fallo que la 036 arregló en la reflexión —allí
-- eran índices PARCIALES, aquí es de expresión— y por el mismo motivo:
-- un índice que protege bien pero al que el upsert no puede apuntar.
--
-- ── EL ARREGLO ──────────────────────────────────────────────
-- Se podría dejar el índice de expresión y apuntar a él desde el SQL,
-- pero desde la API REST no se puede: `onConflict` solo admite nombres
-- de columna. Así que la garantía se mueve de sitio.
--
-- En vez de «el índice normaliza al comparar», ahora es «la columna
-- está SIEMPRE normalizada», y eso lo sujeta un CHECK. Con esa
-- garantía, un índice único sobre la columna pelada protege
-- exactamente lo mismo que el de expresión —no puede haber dos filas
-- que solo se diferencien en mayúsculas, porque no puede haber
-- mayúsculas— y además el upsert puede apuntarle.
--
-- Es más simple de leer, y la regla queda escrita donde se puede
-- comprobar en vez de escondida dentro de un índice.
--
-- Idempotente. Depende de: 032.
-- ============================================================

-- ── 1. Lo que ya hay, normalizado ───────────────────────────
/* El cliente ya normalizaba antes de insertar, así que esto no debería
   tocar ninguna fila. Se hace igual: si alguna se coló por otra vía, el
   CHECK de abajo fallaría y la migración no entraría, y arreglar eso a
   ciegas en producción es peor que hacerlo aquí.

   No puede crear duplicados: el índice de expresión de la 032 lleva
   desde el principio impidiendo que dos correos normalicen a lo mismo. */
UPDATE public.invitaciones
   SET email = lower(btrim(email))
 WHERE email IS DISTINCT FROM lower(btrim(email));

-- ── 2. Y que siga estándolo ─────────────────────────────────
ALTER TABLE public.invitaciones DROP CONSTRAINT IF EXISTS invitaciones_email_normalizado;
ALTER TABLE public.invitaciones
  ADD CONSTRAINT invitaciones_email_normalizado
  CHECK (email = lower(btrim(email)));

-- ── 3. El índice al que el upsert SÍ puede apuntar ──────────
/* Primero el nuevo y después se tira el viejo: entre las dos sentencias
   el correo sigue protegido por los dos a la vez, nunca por ninguno. */
CREATE UNIQUE INDEX IF NOT EXISTS invitaciones_email_unico
  ON public.invitaciones (email);

DROP INDEX IF EXISTS public.invitaciones_email;

COMMENT ON INDEX public.invitaciones_email_unico IS
  'Un correo, una invitación. Sobre la COLUMNA y no sobre lower(trim(email)) para que el upsert pueda apuntarle con onConflict; lo que garantiza que no haya mayúsculas es el CHECK invitaciones_email_normalizado (039).';

-- ── Y se dice cómo ha quedado ───────────────────────────────
SELECT
  (SELECT count(*) FROM public.invitaciones)                        AS invitaciones,
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = 'invitaciones_email_unico')  AS indice_nuevo,
  EXISTS (SELECT 1 FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = 'invitaciones_email')        AS queda_el_viejo;
