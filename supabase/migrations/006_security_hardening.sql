-- ============================================================
-- 006_security_hardening.sql — Endurecimiento de RLS de base
-- Independiente del módulo Sesiones; cierra un agujero YA presente.
--
-- Hallazgo (revisión adversarial de RLS): la política de 001
-- "profiles: cada usuario edita el suyo" es UPDATE USING(id=auth.uid())
-- WITH CHECK(id=auth.uid()). RLS NO restringe por columna y Supabase
-- concede UPDATE de todas las columnas al rol `authenticated`, así que
-- un coach podía `update profiles set role='admin' where id=auth.uid()`
-- y auto-escalar a admin (llave maestra de todo el modelo por-equipo).
-- Idempotente: re-ejecutable sin efectos.
-- ============================================================

-- 1) Restringir el UPDATE de `authenticated` a la única columna editable.
--    (RLS sigue gobernando QUÉ filas; esto gobierna QUÉ columnas.)
--    CONTRATO CON EL FRONTEND: un UPDATE a profiles debe enviar SOLO
--    full_name en el SET (nada de upsert con el objeto entero): cualquier
--    otra columna referenciada da 'permission denied for column ...'.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT  UPDATE (full_name) ON public.profiles TO authenticated;

-- 2) Defensa en profundidad: aunque se re-concediera UPDATE por error,
--    cambiar `role` solo lo permite un admin. El admin sigue cambiando
--    roles por el SQL editor (service_role: auth.uid() NULL → no bloquea).
CREATE OR REPLACE FUNCTION public.guard_profiles_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'No autorizado a cambiar el rol del perfil.';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger-only: nadie la invoca directamente (ni como RPC).
REVOKE EXECUTE ON FUNCTION public.guard_profiles_role() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_guard_role ON public.profiles;
CREATE TRIGGER profiles_guard_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_role();

-- handle_new_user (001) también es trigger-only; se le retira el EXECUTE
-- público por defecto (defensa en profundidad, mismo criterio).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3) `current_user_role()` de 001 es SECURITY DEFINER SIN search_path fijo
--    (vector teórico de search_path hijack). Se re-crea idéntico + search_path,
--    coherente con los helpers nuevos del módulo.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
