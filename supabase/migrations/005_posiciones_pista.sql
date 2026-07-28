-- ============================================================
-- Playbook CBP — Migración 005 (Tramo 2.3: posiciones con nombre)
-- Diccionario custom de posiciones de pista del entrenador: cuando
-- describe un ejercicio con un nombre de posición que el motor no
-- conoce ("el refugio"), se le pide marcarla con un clic y ese punto
-- se guarda aquí para reutilizarlo en futuros ejercicios.
--
-- La posición es ESPECÍFICA DE CADA PISTA: la clave única incluye
-- `pista`, así el mismo nombre en 'entera' y en 'media' son dos
-- filas distintas con coordenadas propias (los marcos normalizados
-- de cada pista no son intercambiables). Nunca se comparten.
--
-- Identidad: la app no tiene concepto de club en el esquema actual
-- (001–004); se ancla al usuario autenticado (created_by =
-- auth.uid()), igual que exercises.created_by. Idempotente.
-- Ejecútala en el mismo proyecto Supabase, tras la 004.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.posiciones_pista (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pista       text NOT NULL CHECK (pista IN ('entera', 'media', 'entera_fiba', 'media_fiba')),
  nombre      text NOT NULL,                -- slug normalizado (minúsculas, sin tildes, tokens_por_guion_bajo)
  x           float8 NOT NULL CHECK (x >= 0 AND x <= 1),  -- coords normalizadas [0,1],
  y           float8 NOT NULL CHECK (y >= 0 AND y <= 1),  -- mismo marco que court.js/anclas.js
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- un nombre por pista y por usuario; el upsert del cliente pisa aquí.
  CONSTRAINT posiciones_pista_unicas UNIQUE (pista, nombre, created_by)
);

ALTER TABLE public.posiciones_pista ENABLE ROW LEVEL SECURITY;

-- Cada entrenador ve y mantiene SOLO su diccionario (mismo criterio de
-- propiedad que exercises.created_by). DELETE no se expone al cliente.
DROP POLICY IF EXISTS "posiciones: lectura propia" ON public.posiciones_pista;
CREATE POLICY "posiciones: lectura propia" ON public.posiciones_pista
  FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "posiciones: alta propia" ON public.posiciones_pista;
CREATE POLICY "posiciones: alta propia" ON public.posiciones_pista
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "posiciones: edicion propia" ON public.posiciones_pista;
CREATE POLICY "posiciones: edicion propia" ON public.posiciones_pista
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

-- Consulta caliente del Taller: cargarPosiciones(pista) del usuario actual.
CREATE INDEX IF NOT EXISTS posiciones_pista_lookup
  ON public.posiciones_pista (created_by, pista);
