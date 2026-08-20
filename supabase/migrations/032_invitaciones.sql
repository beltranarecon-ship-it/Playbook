-- ============================================================
-- 032_invitaciones.sql — Lista de invitaciones y alta automática
-- (Tramos 4.9 y 4.10).
--
-- DECISIÓN #31: lista de invitaciones en vez de contraseñas creadas por
-- el administrador. §5.10: «el administrador añade correo + equipos; la
-- persona entra con Google o se registra y ELIGE SU PROPIA CONTRASEÑA;
-- un disparador comprueba el correo contra la lista, crea el perfil y
-- asigna equipos. Sin clave maestra en el navegador, sin funciones de
-- servidor, sin manejar contraseñas ajenas».
--
-- Eso último es lo que más importa: nadie del club llega a ver ni a
-- teclear la contraseña de otro. El administrador escribe un correo; el
-- resto lo hace la persona.
--
-- ── EL DISPARADOR ES TAMBIÉN LA PUERTA (§5.10, fila 4.10) ───
-- «Acceso con Google restringido a los correos invitados». Como Google
-- deja entrar a cualquiera con cuenta, la puerta no puede estar en el
-- botón: tiene que estar aquí. Un alta cuyo correo no esté invitado
-- FALLA, y el usuario no llega a existir.
--
-- ── LA ESCOTILLA, QUE ES OBLIGATORIA ───────────────────────
-- Un disparador que rechaza altas puede dejar al club entero fuera. Dos
-- salidas, las dos a propósito:
--
--   1. si NO hay ni un perfil todavía, la primera persona que entra
--      pasa y se queda de administrador — es la instalación;
--   2. un administrador puede añadir invitaciones desde la app, y las
--      invitaciones se comprueban por correo en minúsculas y sin
--      espacios, que es como se equivoca la gente al escribirlas.
--
-- Idempotente. Depende de: 001 (profiles, handle_new_user), 007 (team_coaches).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invitaciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- siempre en minúsculas y sin espacios: se compara con el de Google,
  -- que llega como llega
  email       text NOT NULL,
  rol         text NOT NULL DEFAULT 'coach' CHECK (rol IN ('admin', 'coach')),
  -- a qué equipos entra al darse de alta
  equipos     uuid[] NOT NULL DEFAULT '{}',
  nombre      text,
  invita      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- cuándo la usó; null = sigue pendiente
  usada_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS invitaciones_email
  ON public.invitaciones (lower(trim(email)));

COMMENT ON TABLE public.invitaciones IS
  'Quién puede darse de alta (decisión #31). El disparador de auth.users la comprueba: un correo que no esté aquí no entra.';

/* Solo el administrador las ve y las toca. Una lista de correos del
   club no tiene por qué estar al alcance de cualquiera con sesión. */
DROP POLICY IF EXISTS "invitaciones: solo admin" ON public.invitaciones;
CREATE POLICY "invitaciones: solo admin" ON public.invitaciones
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ── El disparador de alta ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  correo   text := lower(trim(coalesce(NEW.email, '')));
  inv      public.invitaciones%ROWTYPE;
  primeros boolean;
  eq       uuid;
BEGIN
  -- ¿es la instalación? Sin ningún perfil, el primero que entra manda.
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO primeros;

  SELECT * INTO inv
  FROM public.invitaciones
  WHERE lower(trim(email)) = correo
  LIMIT 1;

  IF NOT primeros AND inv.id IS NULL THEN
    /* Aquí es donde se cierra la puerta de Google (fila 4.10). El
       mensaje se le enseña a la persona tal cual, así que dice qué
       hacer en vez de «error 500». */
    RAISE EXCEPTION 'Este correo no está invitado al Playbook del club. Pídele al administrador que te añada.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    CASE WHEN primeros THEN 'admin' ELSE coalesce(inv.rol, 'coach') END,
    coalesce(NEW.raw_user_meta_data->>'full_name', inv.nombre, NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  -- los equipos que dijera la invitación, ya asignados al entrar
  IF inv.id IS NOT NULL THEN
    FOREACH eq IN ARRAY coalesce(inv.equipos, '{}')
    LOOP
      INSERT INTO public.team_coaches (team_id, coach_id, rol)
      VALUES (eq, NEW.id, 'ayudante')
      ON CONFLICT DO NOTHING;
    END LOOP;

    UPDATE public.invitaciones SET usada_at = now() WHERE id = inv.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
