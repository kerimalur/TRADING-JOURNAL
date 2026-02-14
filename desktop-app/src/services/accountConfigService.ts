/**
 * ========================================================================
 * Trading Journal - Account Config Service (Supabase)
 * ========================================================================
 */

import { supabase } from '@/lib/supabase';
import { requireSession, objectToSnake, objectToCamel } from './supabaseService';
import type { AccountConfig, AccountConfigs, Transaction } from '@/types';

const CONFIG_TABLE = 'account_configs';
const TRANSACTION_TABLE = 'transactions';

// ============================================================
// ACCOUNT CONFIGS
// ============================================================

export async function loadAccountConfigs(): Promise<AccountConfigs> {
  const user = await requireSession();

  const { data, error } = await supabase
    .from(CONFIG_TABLE)
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;

  const defaults: AccountConfigs = {
    ek: {
      type: 'ek',
      initialStartBalance: 10000,
      currentBalance: 10000,
      currency: 'USD',
      defaultRiskPerTrade: 1,
    },
    funded: {
      type: 'funded',
      initialStartBalance: 100000,
      currentBalance: 100000,
      currency: 'USD',
      defaultRiskPerTrade: 0.5,
    },
  };

  if (data) {
    for (const row of data) {
      const config = objectToCamel(row) as any;
      const type = config.type as 'ek' | 'funded';
      if (type === 'ek' || type === 'funded') {
        defaults[type] = { ...defaults[type], ...config };
      }
    }
  }

  return defaults;
}

export async function saveAccountConfig(config: AccountConfig): Promise<boolean> {
  const user = await requireSession();

  const payload = objectToSnake(config) as Record<string, any>;
  payload.user_id = user.id;
  payload.updated_at = new Date().toISOString();
  delete payload.id;

  const { error } = await supabase
    .from(CONFIG_TABLE)
    .upsert([payload], { onConflict: 'user_id,type' });

  if (error) throw error;
  return true;
}

// ============================================================
// TRANSACTIONS
// ============================================================

export async function loadTransactions(): Promise<Transaction[]> {
  const user = await requireSession();

  const { data, error } = await supabase
    .from(TRANSACTION_TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    transactionType: row.transaction_type,
    amount: row.amount,
    date: row.date,
    note: row.note || '',
    createdAt: row.created_at,
  })) as Transaction[];
}

export async function saveTransaction(tx: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
  const user = await requireSession();

  const payload = {
    type: tx.type,
    transaction_type: tx.transactionType,
    amount: tx.amount,
    date: tx.date,
    note: tx.note || '',
    user_id: user.id,
  };

  if (tx.id) {
    const { data, error } = await supabase
      .from(TRANSACTION_TABLE)
      .update(payload)
      .eq('id', tx.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return objectToCamel(data) as any;
  } else {
    const { data, error } = await supabase
      .from(TRANSACTION_TABLE)
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return objectToCamel(data) as any;
  }
}

export async function removeTransaction(id: string): Promise<boolean> {
  const user = await requireSession();

  const { error } = await supabase
    .from(TRANSACTION_TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  return true;
}
