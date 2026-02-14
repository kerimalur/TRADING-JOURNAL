/**
 * ========================================================================
 * Trading Journal - Outlook Service (Supabase)
 * ========================================================================
 */

import { fetchAll, insertOne, updateOne, deleteOne } from './supabaseService';

const TABLE = 'outlooks';

export interface OutlookRecord {
  id?: string;
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  timeframe?: string;
  thesis: string;
  confidence?: number;
  status?: 'active' | 'expired' | 'hit' | 'invalidated';
  cotBias?: string;
  entryZone?: string;
  invalidation?: string;
  target?: string;
  tags?: string[];
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function loadOutlooks(): Promise<OutlookRecord[]> {
  return fetchAll<OutlookRecord>({ table: TABLE, orderBy: 'created_at' });
}

export async function saveOutlook(data: OutlookRecord): Promise<OutlookRecord> {
  if (data.id) {
    return updateOne(TABLE, data.id, data);
  }
  return insertOne(TABLE, data);
}

export async function removeOutlook(id: string): Promise<boolean> {
  return deleteOne(TABLE, id);
}
