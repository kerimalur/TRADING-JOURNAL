/**
 * ========================================================================
 * Trading Journal - Account Config Service (Supabase – accounts-Tabelle)
 * ========================================================================
 * Verwendet die neue "accounts"-Tabelle mit Multi-Account-Support.
 * Fällt bei Bedarf auf "account_configs" (View/Legacy) zurück.
 * Gibt null zurück wenn kein Account existiert – kein Auto-Default.
 */

import { supabase } from '@/lib/supabase';
import { requireSession } from './supabaseService';
import type { AccountConfig, AccountConfigs, AccountType, Transaction } from '@/types';

const ACCOUNTS_TABLE   = 'accounts';
const TRANSACTION_TABLE = 'transactions';

// ============================================================
// INTERNE HILFSFUNKTION
// ============================================================

function rowToConfig(row: any): AccountConfig {
  return {
    id:                   row.id,
    name:                 row.name       || '',
    broker:               row.broker     || '',
    accountNumber:        row.account_number || '',
    type:                 row.type as AccountType,
    currency:             row.currency   || 'USD',
    initialStartBalance:  Number(row.initial_balance ?? row.initial_start_balance ?? 0),
    currentBalance:       Number(row.current_balance ?? 0),
    defaultRiskPerTrade:  Number(row.default_risk_per_trade ?? 1),
    enableGoals:          row.enable_goals    ?? false,
    profitTargetValue:    row.profit_target_value  != null ? Number(row.profit_target_value)  : undefined,
    profitTargetType:     row.profit_target_type   ?? undefined,
    profitTarget:         row.profit_target         != null ? Number(row.profit_target)         : undefined,
    maxDrawdownValue:     row.max_drawdown_value    != null ? Number(row.max_drawdown_value)    : undefined,
    maxDrawdownType:      row.max_drawdown_type     ?? undefined,
    maxDrawdown:          row.max_drawdown           != null ? Number(row.max_drawdown)           : undefined,
    chapters:             Array.isArray(row.chapters) ? row.chapters : [],
    activeChapterId:      row.active_chapter_id ?? undefined,
    isActive:             row.is_active  ?? true,
    isDefault:            row.is_default ?? false,
  };
}

function configToRow(config: AccountConfig, userId: string): Record<string, any> {
  return {
    user_id:               userId,
    name:                  config.name          || (config.type === 'ek' ? 'Eigenkapital' : 'Funded Account'),
    type:                  config.type,
    broker:                config.broker        || '',
    account_number:        config.accountNumber || '',
    currency:              config.currency      || 'USD',
    initial_balance:       config.initialStartBalance,
    current_balance:       config.currentBalance,
    default_risk_per_trade: config.defaultRiskPerTrade,
    enable_goals:          config.enableGoals    ?? false,
    profit_target_value:   config.profitTargetValue  ?? null,
    profit_target_type:    config.profitTargetType   ?? null,
    profit_target:         config.profitTarget         ?? null,
    max_drawdown_value:    config.maxDrawdownValue    ?? null,
    max_drawdown_type:     config.maxDrawdownType     ?? null,
    max_drawdown:          config.maxDrawdown           ?? null,
    chapters:              config.chapters      ?? [],
    active_chapter_id:     config.activeChapterId ?? null,
    is_active:             config.isActive  ?? true,
    is_default:            config.isDefault ?? false,
    updated_at:            new Date().toISOString(),
  };
}

// ============================================================
// LADEN – alle Accounts des Nutzers
// ============================================================

export async function loadAccountConfigs(): Promise<AccountConfigs> {
  const user = await requireSession();

  const { data, error } = await supabase
    .from(ACCOUNTS_TABLE)
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = data || [];

  const ekRows     = rows.filter(r => r.type === 'ek');
  const fundedRows = rows.filter(r => r.type === 'funded');

  // Standard-EK: Zeile mit is_default=true, sonst erster Eintrag
  const ekDefault     = ekRows.find(r => r.is_default) ?? ekRows[0] ?? null;
  // Standard-Funded: Zeile mit is_default=true, sonst erster Eintrag
  const fundedDefault = fundedRows.find(r => r.is_default) ?? fundedRows[0] ?? null;

  return {
    ek:             ekDefault     ? rowToConfig(ekDefault)     : null,
    funded:         fundedDefault ? rowToConfig(fundedDefault) : null,
    fundedAccounts: fundedRows.map(rowToConfig),
  };
}

// ============================================================
// SPEICHERN – Upsert über id oder (user_id + type + is_default)
// ============================================================

export async function saveAccountConfig(config: AccountConfig): Promise<boolean> {
  const user = await requireSession();
  const payload = configToRow(config, user.id);

  if (config.id) {
    // Update bestehenden Account
    const { error } = await supabase
      .from(ACCOUNTS_TABLE)
      .update(payload)
      .eq('id', config.id)
      .eq('user_id', user.id);

    if (error) throw error;
  } else {
    // Neuen Account anlegen – ist automatisch Standard wenn kein anderer existiert
    const { data: existing } = await supabase
      .from(ACCOUNTS_TABLE)
      .select('id')
      .eq('user_id', user.id)
      .eq('type', config.type)
      .eq('is_active', true);

    payload.is_default = !existing || existing.length === 0;

    const { error } = await supabase
      .from(ACCOUNTS_TABLE)
      .insert([payload]);

    if (error) throw error;
  }

  return true;
}

// ============================================================
// NEUEN ACCOUNT ERSTELLEN
// ============================================================

export async function createAccount(config: Omit<AccountConfig, 'id'>): Promise<AccountConfig> {
  const user = await requireSession();
  const payload = configToRow(config as AccountConfig, user.id);
  delete payload.id;

  // Prüfen ob erster Account dieses Typs → automatisch Standard
  const { data: existing } = await supabase
    .from(ACCOUNTS_TABLE)
    .select('id')
    .eq('user_id', user.id)
    .eq('type', config.type)
    .eq('is_active', true);

  payload.is_default = !existing || existing.length === 0;

  const { data, error } = await supabase
    .from(ACCOUNTS_TABLE)
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return rowToConfig(data);
}

// ============================================================
// STANDARD-ACCOUNT WECHSELN (nur Funded mit mehreren Accounts)
// ============================================================

export async function setDefaultAccount(accountId: string, type: AccountType): Promise<void> {
  const user = await requireSession();

  // Alle anderen desselben Typs auf is_default=false setzen
  await supabase
    .from(ACCOUNTS_TABLE)
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', type);

  // Gewünschten als Standard setzen
  const { error } = await supabase
    .from(ACCOUNTS_TABLE)
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ============================================================
// ACCOUNT DEAKTIVIEREN (weich löschen)
// ============================================================

export async function deactivateAccount(accountId: string): Promise<void> {
  const user = await requireSession();

  const { error } = await supabase
    .from(ACCOUNTS_TABLE)
    .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ============================================================
// TRANSAKTIONEN
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
    id:              row.id,
    type:            row.type as AccountType,
    transactionType: row.transaction_type,
    amount:          Number(row.amount),
    date:            row.date,
    note:            row.note || '',
    createdAt:       row.created_at,
  })) as Transaction[];
}

export async function saveTransaction(
  tx: Omit<Transaction, 'id'> & { id?: string; accountId?: string }
): Promise<Transaction> {
  const user = await requireSession();

  const payload: Record<string, any> = {
    type:             tx.type,
    transaction_type: tx.transactionType,
    amount:           tx.amount,
    date:             tx.date,
    note:             tx.note || '',
    user_id:          user.id,
  };

  if (tx.accountId) payload.account_id = tx.accountId;

  if (tx.id) {
    const { data, error } = await supabase
      .from(TRANSACTION_TABLE)
      .update(payload)
      .eq('id', tx.id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, type: data.type, transactionType: data.transaction_type,
             amount: Number(data.amount), date: data.date, note: data.note || '' };
  } else {
    const { data, error } = await supabase
      .from(TRANSACTION_TABLE)
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return { id: data.id, type: data.type, transactionType: data.transaction_type,
             amount: Number(data.amount), date: data.date, note: data.note || '' };
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
