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
import { isElectron } from './webApi';
import type { AccountConfig, AccountConfigs, AccountType, Transaction } from '@/types';

const ACCOUNTS_TABLE    = 'accounts';
const TRANSACTION_TABLE = 'transactions';

// Offline = Electron-Desktop oder "Ohne Login"-Modus im Browser
const isOffline = (): boolean => {
  try {
    return isElectron() || localStorage.getItem('trading-journal-offline-mode') === 'true';
  } catch {
    return true;
  }
};

// ── localStorage-Schlüssel ──
const LS_ACCOUNTS     = 'tradingJournal_accounts_v2';
const LS_TRANSACTIONS = 'tradingJournal_transactions_v2';

function lsGetAccounts(): AccountConfig[] {
  try { return JSON.parse(localStorage.getItem(LS_ACCOUNTS) || '[]'); }
  catch { return []; }
}
function lsSaveAccounts(list: AccountConfig[]): void {
  localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list));
}
function lsGetTransactions(): Transaction[] {
  try { return JSON.parse(localStorage.getItem(LS_TRANSACTIONS) || '[]'); }
  catch { return []; }
}
function lsSaveTransactions(list: Transaction[]): void {
  localStorage.setItem(LS_TRANSACTIONS, JSON.stringify(list));
}
function lsGenId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

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
  // ── Offline: localStorage ──
  if (isOffline()) {
    const all      = lsGetAccounts();
    const ekRows     = all.filter(a => a.type === 'ek'     && a.isActive !== false);
    const fundedRows = all.filter(a => a.type === 'funded' && a.isActive !== false);
    return {
      ek:             ekRows.find(a => a.isDefault) ?? ekRows[0] ?? null,
      funded:         fundedRows.find(a => a.isDefault) ?? fundedRows[0] ?? null,
      fundedAccounts: fundedRows,
    };
  }

  // ── Online: Supabase ──
  const user = await requireSession();

  const { data, error } = await supabase
    .from(ACCOUNTS_TABLE)
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows       = data || [];
  const ekRows     = rows.filter(r => r.type === 'ek');
  const fundedRows = rows.filter(r => r.type === 'funded');

  return {
    ek:             (ekRows.find(r => r.is_default)     ?? ekRows[0]     ?? null) ? rowToConfig(ekRows.find(r => r.is_default) ?? ekRows[0])     : null,
    funded:         (fundedRows.find(r => r.is_default) ?? fundedRows[0] ?? null) ? rowToConfig(fundedRows.find(r => r.is_default) ?? fundedRows[0]) : null,
    fundedAccounts: fundedRows.map(rowToConfig),
  };
}

// ============================================================
// SPEICHERN
// ============================================================

export async function saveAccountConfig(config: AccountConfig): Promise<boolean> {
  // ── Offline ──
  if (isOffline()) {
    const all = lsGetAccounts();
    const idx = config.id ? all.findIndex(a => a.id === config.id) : -1;
    if (idx >= 0) { all[idx] = { ...all[idx], ...config }; }
    else          { all.push({ ...config, id: lsGenId(), isActive: true }); }
    lsSaveAccounts(all);
    return true;
  }

  // ── Online ──
  const user = await requireSession();
  const payload = configToRow(config, user.id);

  if (config.id) {
    const { error } = await supabase.from(ACCOUNTS_TABLE).update(payload).eq('id', config.id).eq('user_id', user.id);
    if (error) throw error;
  } else {
    const { data: existing } = await supabase.from(ACCOUNTS_TABLE).select('id').eq('user_id', user.id).eq('type', config.type).eq('is_active', true);
    payload.is_default = !existing || existing.length === 0;
    const { error } = await supabase.from(ACCOUNTS_TABLE).insert([payload]);
    if (error) throw error;
  }
  return true;
}

// ============================================================
// NEUEN ACCOUNT ERSTELLEN
// ============================================================

export async function createAccount(config: Omit<AccountConfig, 'id'>): Promise<AccountConfig> {
  // ── Offline ──
  if (isOffline()) {
    const all      = lsGetAccounts();
    const sameType = all.filter(a => a.type === config.type && a.isActive !== false);
    const newAcc: AccountConfig = {
      ...config,
      id:        lsGenId(),
      isActive:  true,
      isDefault: sameType.length === 0,
    };
    // Wenn erster Account → alle anderen des Typs deselektieren (keiner vorhanden)
    lsSaveAccounts([...all, newAcc]);
    return newAcc;
  }

  // ── Online ──
  const user = await requireSession();
  const payload = configToRow(config as AccountConfig, user.id);
  delete payload.id;

  const { data: existing } = await supabase.from(ACCOUNTS_TABLE).select('id').eq('user_id', user.id).eq('type', config.type).eq('is_active', true);
  payload.is_default = !existing || existing.length === 0;

  const { data, error } = await supabase.from(ACCOUNTS_TABLE).insert([payload]).select().single();
  if (error) throw error;
  return rowToConfig(data);
}

// ============================================================
// STANDARD-ACCOUNT WECHSELN
// ============================================================

export async function setDefaultAccount(accountId: string, type: AccountType): Promise<void> {
  if (isOffline()) {
    const all = lsGetAccounts().map(a =>
      a.type === type ? { ...a, isDefault: a.id === accountId } : a
    );
    lsSaveAccounts(all);
    return;
  }

  const user = await requireSession();
  await supabase.from(ACCOUNTS_TABLE).update({ is_default: false, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('type', type);
  const { error } = await supabase.from(ACCOUNTS_TABLE).update({ is_default: true, updated_at: new Date().toISOString() }).eq('id', accountId).eq('user_id', user.id);
  if (error) throw error;
}

// ============================================================
// ACCOUNT DEAKTIVIEREN
// ============================================================

export async function deactivateAccount(accountId: string): Promise<void> {
  if (isOffline()) {
    const all = lsGetAccounts().map(a => a.id === accountId ? { ...a, isActive: false, isDefault: false } : a);
    lsSaveAccounts(all);
    return;
  }

  const user = await requireSession();
  const { error } = await supabase.from(ACCOUNTS_TABLE).update({ is_active: false, is_default: false, updated_at: new Date().toISOString() }).eq('id', accountId).eq('user_id', user.id);
  if (error) throw error;
}

// ============================================================
// TRANSAKTIONEN
// ============================================================

export async function loadTransactions(): Promise<Transaction[]> {
  if (isOffline()) return lsGetTransactions();

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
  // ── Offline ──
  if (isOffline()) {
    const all = lsGetTransactions();
    if (tx.id) {
      const idx = all.findIndex(t => t.id === tx.id);
      if (idx >= 0) all[idx] = { ...all[idx], ...tx } as Transaction;
      lsSaveTransactions(all);
      return all[idx >= 0 ? idx : 0];
    }
    const newTx: Transaction = { id: lsGenId(), type: tx.type, transactionType: tx.transactionType, amount: tx.amount, date: tx.date, note: tx.note || '', createdAt: new Date().toISOString() };
    lsSaveTransactions([newTx, ...all]);
    return newTx;
  }

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
  if (isOffline()) {
    lsSaveTransactions(lsGetTransactions().filter(t => t.id !== id));
    return true;
  }

  const user = await requireSession();

  const { error } = await supabase
    .from(TRANSACTION_TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  return true;
}
