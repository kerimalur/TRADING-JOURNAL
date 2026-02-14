/**
 * ========================================================================
 * Trading Journal - ML Service (Supabase)
 * ========================================================================
 */

import { fetchAll, insertOne } from './supabaseService';
import { supabase } from '@/lib/supabase';
import { requireSession } from './supabaseService';

// ============================================================
// COT HISTORY
// ============================================================

export interface COTHistoryRecord {
  id?: string;
  date: string;
  currency: string;
  commercialsNet: number;
  commercialsLong: number;
  commercialsShort: number;
  priceAtSnapshot?: number;
}

export async function loadCOTHistory(currency?: string): Promise<COTHistoryRecord[]> {
  const filters = currency ? { currency } : undefined;
  return fetchAll<COTHistoryRecord>({
    table: 'ml_cot_history',
    orderBy: 'date',
    filters,
  });
}

export async function saveCOTSnapshots(snapshots: COTHistoryRecord[]): Promise<void> {
  if (snapshots.length === 0) return;
  const user = await requireSession();

  // Upsert to avoid duplicates (unique on user_id, date, currency)
  const payloads = snapshots.map(s => ({
    user_id: user.id,
    date: s.date,
    currency: s.currency,
    commercials_net: s.commercialsNet,
    commercials_long: s.commercialsLong,
    commercials_short: s.commercialsShort,
    price_at_snapshot: s.priceAtSnapshot,
  }));

  const { error } = await supabase
    .from('ml_cot_history')
    .upsert(payloads, { onConflict: 'user_id,date,currency' });

  if (error) throw error;
}

// ============================================================
// PREDICTIONS
// ============================================================

export interface PredictionRecord {
  id?: string;
  currency: string;
  cotNetAtPrediction: number;
  cotChange: number;
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  timeframe: string;
  reasoning: string;
  outcome?: {
    actualDirection: 'up' | 'down' | 'flat';
    priceChange: number;
    wasCorrect: boolean;
    evaluatedAt: string;
  };
  createdAt?: string;
}

export async function loadPredictions(): Promise<PredictionRecord[]> {
  return fetchAll<PredictionRecord>({
    table: 'ml_predictions',
    orderBy: 'created_at',
  });
}

export async function savePrediction(data: PredictionRecord): Promise<PredictionRecord> {
  return insertOne('ml_predictions', data);
}

export async function updatePredictionOutcome(
  id: string,
  outcome: PredictionRecord['outcome']
): Promise<void> {
  const user = await requireSession();

  const { error } = await supabase
    .from('ml_predictions')
    .update({ outcome })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ============================================================
// LEARNED PATTERNS
// ============================================================

export interface PatternRecord {
  id?: string;
  patternId: string;
  name: string;
  description: string;
  conditions: Record<string, any>;
  stats: Record<string, any>;
  confidence: number;
  recommendation: 'trade' | 'avoid' | 'neutral';
}

export async function loadPatterns(): Promise<PatternRecord[]> {
  return fetchAll<PatternRecord>({
    table: 'ml_learned_patterns',
    orderBy: 'created_at',
  });
}

export async function savePatterns(patterns: PatternRecord[]): Promise<void> {
  if (patterns.length === 0) return;
  const user = await requireSession();

  // Delete old patterns and insert new ones
  await supabase
    .from('ml_learned_patterns')
    .delete()
    .eq('user_id', user.id);

  const payloads = patterns.map(p => ({
    user_id: user.id,
    pattern_id: p.patternId,
    name: p.name,
    description: p.description,
    conditions: p.conditions,
    stats: p.stats,
    confidence: p.confidence,
    recommendation: p.recommendation,
  }));

  const { error } = await supabase
    .from('ml_learned_patterns')
    .insert(payloads);

  if (error) throw error;
}
