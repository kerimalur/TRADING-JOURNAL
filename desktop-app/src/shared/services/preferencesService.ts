/**
 * ========================================================================
 * Trading Journal - User Preferences Service (Supabase)
 * ========================================================================
 * Generischer Key/Value-Speicher pro User (Tabelle user_preferences).
 * Hybrid: eingeloggt → Supabase, sonst no-op (Aufrufer nutzt localStorage-Mirror).
 */

import { supabase } from '@/shared/lib/supabase';
import { getSessionUser } from './supabaseService';

const TABLE = 'user_preferences';

/** Lädt einen Pref-Wert. Nicht eingeloggt oder nicht vorhanden → fallback. */
export async function loadPref<T>(key: string, fallback: T): Promise<T> {
  const user = await getSessionUser();
  if (!user) return fallback;
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return fallback;
  return (data.value as T) ?? fallback;
}

/** Schreibt einen Pref-Wert (Upsert). Nicht eingeloggt → no-op. */
export async function savePref(key: string, value: unknown): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  await supabase
    .from(TABLE)
    .upsert(
      { user_id: user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' },
    );
}
