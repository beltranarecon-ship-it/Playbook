import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SESSION_STORAGE_KEY } from './config.js';
import { limpiaSesionRota } from './sesion-sana.js';

/* ANTES de crear el cliente, no después: una vez creado, Supabase ya ha
   leído lo que hubiera guardado y lo usa en la primera consulta. Con una
   sesión ilegible —la que deja el arnés de desarrollo, por ejemplo— eso
   son todas las pantallas cayéndose con «Expected 3 parts in JWT». */
limpiaSesionRota();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: SESSION_STORAGE_KEY,
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
