/**
 * ========================================================================
 * Trading Journal - Backtest Service (Supabase)
 * ========================================================================
 * Persistiert Backtest-Sessions in der Tabelle backtest_sessions.
 * Shape passt zum Session-Modell der Backtest-Seite (kein Session-Pair;
 * Pair ist pro Trade). Hybrid: nicht eingeloggt → no-op / leer.
 */

import { supabase } from '@/shared/lib/supabase';
import { getSessionUser } from './supabaseService';

const TABLE = 'backtest_sessions';

// Entspricht dem BacktestSession-Interface der Backtest-Seite.
export interface BacktestSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  trades: any[];
  isPaused: boolean;
  elapsedMs: number;
  isCompleted?: boolean;
  // Session-Konfiguration (im stats-JSONB unter config gespeichert, da die
  // Tabelle keine eigenen Spalten dafür hat → keine zusätzliche Migration nötig)
  pair?: string;
  strategyId?: string;
  strategy?: string;
  defaultRR?: number;
  riskPercent?: number;
  accountSize?: number;
}

function rowToSession(r: any): BacktestSession {
  const config = (r.stats && r.stats.config) || {};
  return {
    id: r.id,
    name: r.name || '',
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
    trades: Array.isArray(r.trades) ? r.trades : [],
    isPaused: true, // beim Laden immer pausiert (Timer läuft erst bei Aktion weiter)
    elapsedMs: Number(r.elapsed_ms) || 0,
    isCompleted: r.status === 'completed',
    pair: config.pair,
    strategyId: config.strategyId,
    strategy: config.strategy,
    defaultRR: config.defaultRR,
    riskPercent: config.riskPercent,
    accountSize: config.accountSize,
  };
}

function sessionToRow(s: BacktestSession, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    name: s.name || '',
    status: s.isCompleted ? 'completed' : 'active',
    elapsed_ms: s.elapsedMs || 0,
    trades: s.trades || [],
    stats: {
      config: {
        pair: s.pair,
        strategyId: s.strategyId,
        strategy: s.strategy,
        defaultRR: s.defaultRR,
        riskPercent: s.riskPercent,
        accountSize: s.accountSize,
      },
    },
    created_at: new Date(s.createdAt || Date.now()).toISOString(),
    updated_at: new Date(s.updatedAt || Date.now()).toISOString(),
  };
}

/** Alle Sessions des Users laden. Nicht eingeloggt → []. */
export async function loadBacktests(): Promise<BacktestSession[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToSession);
}

/** Eine Session anlegen/aktualisieren (Upsert per id). Nicht eingeloggt → no-op. */
export async function saveBacktest(session: BacktestSession): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert(sessionToRow(session, user.id), { onConflict: 'id' });
  if (error) throw error;
}

/** Session löschen. Nicht eingeloggt → no-op. */
export async function removeBacktest(id: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}

/** Ob aktuell ein eingeloggter User existiert (für Hybrid-Entscheidung). */
export async function isLoggedIn(): Promise<boolean> {
  return !!(await getSessionUser());
}
