/**
 * ========================================================================
 * Trading Journal - Migration Utility
 * Importiert Daten aus dem alten localStorage/IndexedDB Format
 * ========================================================================
 */

import type { Trade, AccountConfig } from '@/types';

interface OldTradeFormat {
  id?: string;
  date: string;
  pair: string;
  direction: string;
  type?: string;
  result: string;
  rMultiple: number;
  riskPercent?: number;
  riskUSD?: number;
  profit?: number;
  accountBalanceBefore?: number;
  accountBalanceAfter?: number;
  runningBalance?: number;
  
  // Setups
  htfBias?: boolean;
  d1Zone?: boolean;
  d1Fib?: boolean;
  h4Zone?: boolean;
  m15Entry?: boolean;
  
  // Optional fields
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  notes?: string;
  session?: string;
  screenshot?: string;
  
  createdAt?: string;
  updatedAt?: string;
}

interface OldAccountConfig {
  initialStartBalance?: number;
  startBalance?: number;
  currentBalance?: number;
  profitTarget?: number;
  maxDrawdown?: number;
  defaultRiskPerTrade?: number;
  autoCalculateRisk?: boolean;
}

/**
 * Konvertiert alte Trade-Daten ins neue Format
 */
export function migrateTradeData(oldTrade: OldTradeFormat, accountType: 'funded' | 'ek'): Trade {
  return {
    id: oldTrade.id || `migrated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: oldTrade.date,
    pair: oldTrade.pair.toUpperCase(),
    direction: (oldTrade.direction.toLowerCase() === 'long' ? 'long' : 'short') as 'long' | 'short',
    type: accountType,
    result: normalizeResult(oldTrade.result),
    rMultiple: Number(oldTrade.rMultiple) || 0,
    riskPercent: Number(oldTrade.riskPercent) || 1,
    riskAmount: Number(oldTrade.riskUSD) || 0,
    profitAmount: Number(oldTrade.profit) || 0,
    accountBalanceBefore: Number(oldTrade.accountBalanceBefore) || 0,
    accountBalanceAfter: Number(oldTrade.accountBalanceAfter) || 0,
    runningBalance: Number(oldTrade.runningBalance) || Number(oldTrade.accountBalanceAfter) || 0,
    
    // Setups
    htfBias: Boolean(oldTrade.htfBias),
    d1Zone: Boolean(oldTrade.d1Zone),
    d1Fib: Boolean(oldTrade.d1Fib),
    h4Zone: Boolean(oldTrade.h4Zone),
    m15Entry: Boolean(oldTrade.m15Entry),
    
    // Optional fields
    entryPrice: oldTrade.entryPrice,
    stopLoss: oldTrade.stopLoss,
    takeProfit: oldTrade.takeProfit,
    comment: oldTrade.comment || oldTrade.notes || '',
    session: oldTrade.session || 'NY',
    sessionType: 'live' as const,

    createdAt: oldTrade.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Normalisiert das Ergebnis-Feld
 */
function normalizeResult(result: string): 'win' | 'loss' | 'breakeven' {
  const normalized = result.toLowerCase();
  if (normalized === 'win' || normalized === 'gewinn') return 'win';
  if (normalized === 'loss' || normalized === 'verlust') return 'loss';
  return 'breakeven';
}

/**
 * Konvertiert alte Konto-Konfiguration
 */
export function migrateAccountConfig(oldConfig: OldAccountConfig, accountType: 'funded' | 'ek'): AccountConfig {
  return {
    type: accountType,
    initialStartBalance: Number(oldConfig.initialStartBalance || oldConfig.startBalance) || (accountType === 'funded' ? 100000 : 10000),
    currentBalance: Number(oldConfig.currentBalance) || Number(oldConfig.initialStartBalance || oldConfig.startBalance) || (accountType === 'funded' ? 100000 : 10000),
    profitTarget: oldConfig.profitTarget ? Number(oldConfig.profitTarget) : undefined,
    maxDrawdown: oldConfig.maxDrawdown ? Number(oldConfig.maxDrawdown) : undefined,
    defaultRiskPerTrade: Number(oldConfig.defaultRiskPerTrade) || (accountType === 'funded' ? 0.5 : 1),
    currency: 'USD'
  };
}

/**
 * Versucht Daten aus localStorage zu lesen und zu migrieren
 * Diese Funktion wird nur im Browser-Context funktionieren
 */
export async function attemptLocalStorageMigration(): Promise<{
  fundedTrades: Trade[];
  ekTrades: Trade[];
  fundedConfig: AccountConfig;
  ekConfig: AccountConfig;
} | null> {
  try {
    // Check if we're in a browser context
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.log('Migration: Kein Browser-Context verfügbar');
      return null;
    }
    
    const fundedTrades: Trade[] = [];
    const ekTrades: Trade[] = [];
    
    // Try to read from common localStorage keys
    const possibleKeys = [
      'fundedTrades',
      'ekTrades',
      'trades',
      'tradingJournal_trades',
      'journal_funded',
      'journal_ek'
    ];
    
    for (const key of possibleKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const trades = Array.isArray(parsed) ? parsed : (parsed.trades || []);
          
          for (const trade of trades) {
            const accountType = key.toLowerCase().includes('ek') ? 'ek' : 'funded';
            const migrated = migrateTradeData(trade, accountType);
            
            if (accountType === 'ek') {
              ekTrades.push(migrated);
            } else {
              fundedTrades.push(migrated);
            }
          }
        } catch {
          console.warn(`Migration: Konnte Daten für Key "${key}" nicht parsen`);
        }
      }
    }
    
    // Try to read account configs
    let fundedConfig: AccountConfig = {
      type: 'funded',
      initialStartBalance: 100000,
      currentBalance: 100000,
      defaultRiskPerTrade: 0.5,
      currency: 'USD'
    };

    let ekConfig: AccountConfig = {
      type: 'ek',
      initialStartBalance: 10000,
      currentBalance: 10000,
      defaultRiskPerTrade: 1,
      currency: 'USD'
    };
    
    const configKeys = ['fundedConfig', 'ekConfig', 'accountConfig', 'tradingJournal_config'];
    for (const key of configKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (key.toLowerCase().includes('funded')) {
            fundedConfig = migrateAccountConfig(parsed, 'funded');
          } else if (key.toLowerCase().includes('ek')) {
            ekConfig = migrateAccountConfig(parsed, 'ek');
          }
        } catch {
          console.warn(`Migration: Konnte Config für Key "${key}" nicht parsen`);
        }
      }
    }
    
    return {
      fundedTrades,
      ekTrades,
      fundedConfig,
      ekConfig
    };
  } catch (error) {
    console.error('Migration fehlgeschlagen:', error);
    return null;
  }
}

/**
 * Importiert eine JSON-Backup-Datei
 */
export function parseBackupFile(jsonContent: string): {
  fundedTrades: Trade[];
  ekTrades: Trade[];
  fundedConfig?: AccountConfig;
  ekConfig?: AccountConfig;
} {
  const data = JSON.parse(jsonContent);
  
  const result = {
    fundedTrades: [] as Trade[],
    ekTrades: [] as Trade[],
    fundedConfig: undefined as AccountConfig | undefined,
    ekConfig: undefined as AccountConfig | undefined
  };
  
  // Handle various backup formats
  if (data.trades) {
    // New unified format
    if (Array.isArray(data.trades)) {
      for (const trade of data.trades) {
        const migrated = migrateTradeData(trade, trade.type || 'funded');
        if (migrated.type === 'ek') {
          result.ekTrades.push(migrated);
        } else {
          result.fundedTrades.push(migrated);
        }
      }
    } else {
      // Object with funded/ek keys
      if (data.trades.funded) {
        result.fundedTrades = data.trades.funded.map((t: OldTradeFormat) => migrateTradeData(t, 'funded'));
      }
      if (data.trades.ek) {
        result.ekTrades = data.trades.ek.map((t: OldTradeFormat) => migrateTradeData(t, 'ek'));
      }
    }
  }
  
  // Handle account configs
  if (data.configs) {
    if (data.configs.funded) {
      result.fundedConfig = migrateAccountConfig(data.configs.funded, 'funded');
    }
    if (data.configs.ek) {
      result.ekConfig = migrateAccountConfig(data.configs.ek, 'ek');
    }
  }
  
  // Handle legacy formats
  if (data.fundedTrades) {
    result.fundedTrades = data.fundedTrades.map((t: OldTradeFormat) => migrateTradeData(t, 'funded'));
  }
  if (data.ekTrades) {
    result.ekTrades = data.ekTrades.map((t: OldTradeFormat) => migrateTradeData(t, 'ek'));
  }
  
  return result;
}
