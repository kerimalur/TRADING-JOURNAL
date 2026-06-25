/**
 * ========================================================================
 * Weekly Snapshot Service — Validierungs-Rückgrat
 * ========================================================================
 * Speichert jede Woche EINMAL die komplette Stärke-Leiter + Pair-Leans +
 * einen Benchmark (reine Zins-Carry-Reihenfolge). Damit lässt sich später
 * ehrlich messen, ob die "starken" Währungen tatsächlich performt haben —
 * und ob das Tool den Münzwurf / die simple Zinsdifferenz schlägt.
 *
 * Ohne diese Datenbasis ist jede Konfidenz unbeweisbar. (Council-Priorität #1)
 */

import { supabase } from '@/lib/supabase';
import { requireSession } from './supabaseService';
import { isElectron } from './webApi';

const TABLE = 'cot_weekly_snapshots';
const LS_GUARD = 'cotLastSnapshotWeek';

export interface WeeklySnapshotPayload {
  strength: Array<{ currency: string; conviction: number; signal: string; percentile: number; stretched: boolean }>;
  benchmarkCarry: string[];      // Währungen nach reiner Zinsdifferenz sortiert (stark→schwach)
  leans: Array<{ pair: string; lean: string; confidenceLabel: string }>;
}

// ISO-Wochen-Kennung, z.B. "2026-W25"
export function isoWeek(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mo=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function isOffline(): boolean {
  try {
    return isElectron() || localStorage.getItem('trading-journal-offline-mode') === 'true';
  } catch {
    return true;
  }
}

/** Wurde für die laufende ISO-Woche schon ein Snapshot geschrieben? (lokaler Guard) */
export function getLastSnapshotWeek(): string | null {
  try {
    return localStorage.getItem(LS_GUARD);
  } catch {
    return null;
  }
}

/**
 * Speichert den Wochen-Snapshot — idempotent pro ISO-Woche (upsert).
 * No-op wenn diese Woche lokal bereits geloggt oder offline/nicht eingeloggt.
 */
export async function saveWeeklySnapshot(payload: WeeklySnapshotPayload): Promise<boolean> {
  const week = isoWeek();
  if (getLastSnapshotWeek() === week) return false; // schon erledigt
  if (isOffline()) {
    try { localStorage.setItem(LS_GUARD, week); } catch { /* ignore */ }
    return false;
  }

  try {
    const user = await requireSession();
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: user.id,
          iso_week: week,
          snapshot_date: new Date().toISOString().split('T')[0],
          data: payload,
        },
        { onConflict: 'user_id,iso_week' },
      );
    if (error) {
      console.warn('Snapshot-Sync übersprungen:', error.message);
      return false;
    }
    try { localStorage.setItem(LS_GUARD, week); } catch { /* ignore */ }
    return true;
  } catch (err: any) {
    console.warn('Snapshot nicht gespeichert (nicht eingeloggt?):', err?.message || err);
    return false;
  }
}

/** Lädt vergangene Snapshots (für spätere Auswertung „war meine Lean richtig?"). */
export async function loadSnapshots(): Promise<any[]> {
  if (isOffline()) return [];
  try {
    const user = await requireSession();
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('iso_week', { ascending: false });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
