-- ============================================================
-- Playbook CBP — Migración 003 (miniaturas §19)
-- Póster estático (PNG) + GIF animado, generados en el cliente al
-- guardar. Se almacenan como data URLs. Idempotente.
-- Ejecútala en el mismo proyecto Supabase, tras la 002.
-- ============================================================

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS poster    text,   -- data:image/png — primer frame (reposo)
  ADD COLUMN IF NOT EXISTS thumbnail text;   -- data:image/gif — bucle corto (hover)
