/**
 * ========================================================================
 * Trading Journal - Unified Trade Service
 * ========================================================================
 * Single source of truth for trade CRUD operations.
 * Used by both FundedJournal and EKJournal.
 */

import { supabase } from '@/lib/supabase';
import { getSessionUser } from './supabaseService';
import type { Trade, AccountType } from '@/types';

// ============================================================
// DB <-> APP FIELD MAPPING
// ============================================================

function mapDbToApp(row: any): Trade {
  return {
    id: row.id,
    type: row.type as AccountType,
    pair: row.symbol || row.pair,
    direction: (row.side || row.direction) as 'long' | 'short',
    date: row.date || (row.created_at ? row.created_at.split('T')[0] : ''),
    result: row.result as 'win' | 'loss' | 'breakeven',
    rMultiple: row.r_multiple ?? row.rMultiple ?? 0,
    riskPercent: row.risk_percent ?? row.riskPercent,
    riskAmount: row.risk_amount ?? row.riskAmount,
    profitAmount: row.profit_amount ?? row.profitAmount,
    notes: row.notes || '',
    comment: row.comment || '',
    sessionType: (row.session_type || row.sessionType || 'live') as 'live' | 'backtest',
    session: row.session || '',
    accountBalanceBefore: row.account_balance_before ?? row.accountBalanceBefore,
    accountBalanceAfter: row.account_balance_after ?? row.accountBalanceAfter,
    runningBalance: row.running_balance ?? row.runningBalance,
    entryPrice: row.entry_price ?? row.entryPrice,
    stopLoss: row.stop_loss ?? row.stopLoss,
    takeProfit: row.take_profit ?? row.takeProfit,
    exitPrice: row.exit_price ?? row.exitPrice,
    setup_daily_bos: row.setup_daily_bos ?? false,
    setup_value_area: row.setup_value_area ?? false,
    setup_market_structure: row.setup_market_structure ?? false,
    setup_weekly_gva: row.setup_weekly_gva ?? false,
    setup_3day_gva: row.setup_3day_gva ?? false,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    // Chapter support
    chapterId: row.chapter_id ?? row.chapterId,
  } as Trade;
}

function mapAppToDb(trade: Partial<Trade> & { id?: string }) {
  return {
    symbol: trade.pair,
    side: trade.direction,
    date: trade.date,
    result: trade.result,
    r_multiple: trade.rMultiple,
    risk_percent: trade.riskPercent,
    risk_amount: trade.riskAmount,
    profit_amount: trade.profitAmount,
    notes: trade.notes || ''   ,
    session_type: trade.sessionType || 'live',
    session: trade.session || '',
    type: trade.type,
    status: 'closed',
    entry_price: trade.entryPrice ? Number(trade.entryPrice) : null,
    exit_price: trade.exitPrice ? Number(trade.exitPrice) : null,
    stop_loss: trade.stopLoss ? Number(trade.stopLoss) : null,
    take_profit: trade.takeProfit ? Number(trade.takeProfit) : null,
    quantity: trade.quantity ? Number(trade.quantity) : 0,
    account_balance_before: trade.accountBalanceBefore,
    account_balance_after: trade.accountBalanceAfter,
    running_balance: trade.runningBalance,
    setup_daily_bos: trade.setup_daily_bos ?? false,
    setup_value_area: trade.setup_value_area ?? false,
    setup_market_structure: trade.setup_market_structure ?? false,
    setup_weekly_gva: trade.setup_weekly_gva ?? false,
    setup_3day_gva: trade.setup_3day_gva ?? false,
    chapter_id: trade.chapterId,
  };
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

export async function loadTrades(accountType?: AccountType): Promise<Trade[]> {
  const user = await getSessionUser();
  if (!user) return [];

  let query = supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (accountType) {
    query = query.eq('type', accountType);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapDbToApp);
}

export async function saveTrade(tradeData: Omit<Trade, 'id'> & { id?: string }): Promise<Trade> {
  const user = await getSessionUser();
  if (!user) throw new Error('Nicht eingeloggt');

  const dbPayload = mapAppToDb(tradeData);

  // Clean undefined values
  for (const key of Object.keys(dbPayload)) {
    if ((dbPayload as any)[key] === undefined) delete (dbPayload as any)[key];
  }

  if (tradeData.id) {
    // UPDATE
    const { data, error } = await supabase
      .from('trades')
      .update(dbPayload)
      .eq('id', tradeData.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return mapDbToApp(data);
  } else {
    // INSERT
    const { data, error } = await supabase
      .from('trades')
      .insert([{ ...dbPayload, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return mapDbToApp(data);
  }
}

export async function deleteTrade(tradeId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) throw new Error('Nicht eingeloggt');

  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', user.id);

  if (error) throw error;
  return true;
}
