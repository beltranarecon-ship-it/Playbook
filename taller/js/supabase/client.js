/* ============================================================
   supabase/client.js — cliente singleton de Supabase para el Taller.
   Reutiliza el mismo proyecto y la misma sesión que cbp-v2.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SESSION_STORAGE_KEY } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: SESSION_STORAGE_KEY,
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
