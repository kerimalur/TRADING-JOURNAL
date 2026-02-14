/**
 * ========================================================================
 * Trading Journal - Backtest Service (Supabase)
 * ========================================================================
 */

import { fetchAll, insertOne, updateOne, deleteOne } from './supabaseService';

const TABLE = 'backtest_sessions';

export interface BacktestSession {
  id?: string;
  name: string;
  pair: string;
  timeframe?: string;
  strategy?: string;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed';
  notes?: string;
  trades?: any[];
  stats?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export async function loadBacktests(): Promise<BacktestSession[]> {
  return fetchAll<BacktestSession>({ table: TABLE, orderBy: 'created_at' });
}

export async function saveBacktest(data: BacktestSession): Promise<BacktestSession> {
  if (data.id) {
    return updateOne(TABLE, data.id, data);
  }
  return insertOne(TABLE, data);
}

export async function removeBacktest(id: string): Promise<boolean> {
  return deleteOne(TABLE, id);
}
