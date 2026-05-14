/**
 * Supabase Client für Trading Journal
 */

import { createClient } from '@supabase/supabase-js';

// Trailing /rest/v1/, /auth/v1/ etc. entfernen – der JS-Client setzt diese selbst
function normalizeSupabaseUrl(url: string): string {
  return url ? url.replace(/\/(rest|auth|storage|realtime)\/v\d+\/?$/, '').replace(/\/$/, '') : url;
}

const SUPABASE_URL      = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL      as string);
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase-Umgebungsvariablen fehlen: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
