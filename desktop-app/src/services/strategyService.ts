/**
 * ========================================================================
 * Trading Journal - Strategy Service (Supabase)
 * ========================================================================
 */

import { fetchAll, insertOne, updateOne, deleteOne } from './supabaseService';

const TABLE = 'strategies';

export interface StrategyRecord {
  id?: string;
  name: string;
  description?: string;
  rules?: any[];
  entryCriteria?: any[];
  exitCriteria?: any[];
  riskRules?: Record<string, any>;
  pairs?: string[];
  timeframes?: string[];
  sessions?: string[];
  isActive?: boolean;
  stats?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export async function loadStrategies(): Promise<StrategyRecord[]> {
  return fetchAll<StrategyRecord>({ table: TABLE, orderBy: 'created_at' });
}

export async function saveStrategy(data: StrategyRecord): Promise<StrategyRecord> {
  if (data.id) {
    return updateOne(TABLE, data.id, data);
  }
  return insertOne(TABLE, data);
}

export async function removeStrategy(id: string): Promise<boolean> {
  return deleteOne(TABLE, id);
}
