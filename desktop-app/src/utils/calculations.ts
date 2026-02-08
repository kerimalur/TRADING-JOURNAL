/**
 * ========================================================================
 * Trading Journal - Calculation Utilities
 * ========================================================================
 * 
 * Zentrale Berechnungslogik für Trades, Risk Management und Statistiken.
 * Kann von Stores, Components und Simulation verwendet werden.
 */

import type { Trade, DashboardMetrics } from '@/types';

// ============================================================
// BASIC TRADE STATISTICS
// ============================================================

export interface TradeStatistics {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  totalR: number;
  avgR: number;
  profitFactor: number;
  expectancy: number;
}

export function calculateTradeStatistics(trades: Trade[]): TradeStatistics {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      avgWinR: 0,
      avgLossR: 0,
      totalR: 0,
      avgR: 0,
      profitFactor: 0,
      expectancy: 0,
    };
  }

  const wins = trades.filter(t => t.result === 'win');
  const losses = trades.filter(t => t.result === 'loss');
  const breakevens = trades.filter(t => t.result === 'breakeven');
  
  const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
  const avgR = totalR / trades.length;
  
  const avgWinR = wins.length > 0 
    ? wins.reduce((sum, t) => sum + t.rMultiple, 0) / wins.length 
    : 0;
  const avgLossR = losses.length > 0 
    ? Math.abs(losses.reduce((sum, t) => sum + t.rMultiple, 0) / losses.length)
    : 0;
  
  const winRate = (wins.length + losses.length) > 0 
    ? (wins.length / (wins.length + losses.length)) * 100 
    : 0;
  
  // Profit Factor
  const grossProfit = trades.filter(t => t.rMultiple > 0).reduce((sum, t) => sum + t.rMultiple, 0);
  const grossLoss = Math.abs(trades.filter(t => t.rMultiple < 0).reduce((sum, t) => sum + t.rMultiple, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  
  // Expectancy (Mathematical Expectation)
  const expectancy = (winRate / 100) * avgWinR - ((100 - winRate) / 100) * avgLossR;

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRate,
    avgWinR,
    avgLossR,
    totalR,
    avgR,
    profitFactor,
    expectancy,
  };
}

// ============================================================
// DRAWDOWN & EQUITY CALCULATIONS
// ============================================================

export interface DrawdownData {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentDrawdown: number;
  equityCurve: number[];
  peakEquity: number;
}

export function calculateDrawdown(trades: Trade[]): DrawdownData {
  if (trades.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      currentDrawdown: 0,
      equityCurve: [0],
      peakEquity: 0,
    };
  }

  // Sort by date
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve: number[] = [0];

  sortedTrades.forEach(trade => {
    equity += trade.rMultiple;
    equityCurve.push(equity);
    
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  const currentDrawdown = peak - equity;

  return {
    maxDrawdown,
    maxDrawdownPercent: peak > 0 ? (maxDrawdown / peak) * 100 : 0,
    currentDrawdown,
    equityCurve,
    peakEquity: peak,
  };
}

// ============================================================
// STREAK CALCULATIONS
// ============================================================

export interface StreakData {
  currentStreak: number;
  streakType: 'win' | 'loss' | null;
  maxWinStreak: number;
  maxLossStreak: number;
}

export function calculateStreaks(trades: Trade[]): StreakData {
  if (trades.length === 0) {
    return {
      currentStreak: 0,
      streakType: null,
      maxWinStreak: 0,
      maxLossStreak: 0,
    };
  }

  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Current Streak (from end)
  let currentStreak = 0;
  let streakType: 'win' | 'loss' | null = null;
  
  for (let i = sortedTrades.length - 1; i >= 0; i--) {
    const trade = sortedTrades[i];
    if (trade.result === 'breakeven') continue;
    
    if (streakType === null) {
      streakType = trade.result as 'win' | 'loss';
      currentStreak = 1;
    } else if (trade.result === streakType) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Max Streaks
  let winStreak = 0;
  let lossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  sortedTrades.forEach(trade => {
    if (trade.result === 'win') {
      winStreak++;
      lossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, winStreak);
    } else if (trade.result === 'loss') {
      lossStreak++;
      winStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, lossStreak);
    }
  });

  return {
    currentStreak,
    streakType,
    maxWinStreak,
    maxLossStreak,
  };
}

// ============================================================
// RISK MANAGEMENT CALCULATIONS
// ============================================================

/**
 * Calculate Risk of Ruin
 * Wahrscheinlichkeit, das gesamte Kapital zu verlieren
 * 
 * Formula: ((1 - edge) / (1 + edge)) ^ capitalUnits
 * where edge = (winRate * avgWin - lossRate * avgLoss)
 */
export function calculateRiskOfRuin(
  winRate: number, // 0-100
  avgWinR: number,
  avgLossR: number,
  capitalUnits: number = 100 // Anzahl R-Einheiten im Konto
): number {
  const wr = winRate / 100;
  const lr = 1 - wr;
  
  // Edge per trade
  const edge = wr * avgWinR - lr * avgLossR;
  
  if (edge <= 0) return 1; // 100% ruin if no edge
  if (avgLossR === 0) return 0; // No risk if no loss
  
  // Simplified RoR formula
  const a = (1 - edge) / (1 + edge);
  const ror = Math.pow(a, capitalUnits);
  
  return Math.max(0, Math.min(1, ror));
}

/**
 * Calculate Kelly Criterion
 * Optimale Position-Größe für maximales Wachstum
 * 
 * Kelly % = W - [(1 - W) / R]
 * where W = win rate, R = win/loss ratio
 */
export function calculateKellyCriterion(
  winRate: number, // 0-100
  avgWinR: number,
  avgLossR: number,
  fraction: number = 0.5 // Half-Kelly für Sicherheit
): { fullKelly: number; fractionalKelly: number; recommendation: string } {
  const w = winRate / 100;
  
  if (avgLossR === 0) {
    return { fullKelly: 0, fractionalKelly: 0, recommendation: 'Unberechenbar - keine Verluste' };
  }
  
  const r = avgWinR / avgLossR; // Win/Loss Ratio
  
  // Kelly Formula
  const kelly = w - ((1 - w) / r);
  const fullKelly = Math.max(0, kelly * 100); // In Prozent
  const fractionalKelly = fullKelly * fraction;
  
  let recommendation: string;
  if (kelly <= 0) {
    recommendation = 'Nicht handeln! Negative Erwartung.';
  } else if (fractionalKelly < 1) {
    recommendation = `Sehr konservativ: ${fractionalKelly.toFixed(2)}% pro Trade`;
  } else if (fractionalKelly < 2) {
    recommendation = `Konservativ: ${fractionalKelly.toFixed(2)}% pro Trade`;
  } else if (fractionalKelly < 5) {
    recommendation = `Moderat: ${fractionalKelly.toFixed(2)}% pro Trade`;
  } else {
    recommendation = `Aggressiv: ${fractionalKelly.toFixed(2)}% pro Trade (Vorsicht!)`;
  }
  
  return { fullKelly, fractionalKelly, recommendation };
}

/**
 * Calculate Daily Loss Limit in Currency
 */
export function calculateDailyLossLimit(
  accountBalance: number,
  maxDailyLossPercent: number,
  riskPerTradePercent: number
): { amountLimit: number; rLimit: number; tradesAllowed: number } {
  const amountLimit = accountBalance * (maxDailyLossPercent / 100);
  const rLimit = maxDailyLossPercent / riskPerTradePercent;
  const tradesAllowed = Math.floor(rLimit);
  
  return { amountLimit, rLimit, tradesAllowed };
}

// ============================================================
// DASHBOARD METRICS AGGREGATOR
// ============================================================

export function calculateDashboardMetrics(trades: Trade[]): DashboardMetrics {
  const stats = calculateTradeStatistics(trades);
  const drawdown = calculateDrawdown(trades);
  const streaks = calculateStreaks(trades);
  
  const bestTrade = trades.length > 0 ? Math.max(...trades.map(t => t.rMultiple)) : 0;
  const worstTrade = trades.length > 0 ? Math.min(...trades.map(t => t.rMultiple)) : 0;

  return {
    totalTrades: stats.totalTrades,
    wins: stats.wins,
    losses: stats.losses,
    breakevens: stats.breakevens,
    winRate: stats.winRate,
    totalR: stats.totalR,
    avgR: stats.avgR,
    profitFactor: stats.profitFactor,
    maxDrawdown: drawdown.maxDrawdown,
    maxDrawdownPercent: drawdown.maxDrawdownPercent,
    currentStreak: streaks.currentStreak,
    streakType: streaks.streakType,
    bestTrade,
    worstTrade,
  };
}

// ============================================================
// PROFIT/LOSS CALCULATIONS
// ============================================================

/**
 * Calculate profit amount from R-Multiple and risk
 */
export function calculateProfitAmount(
  rMultiple: number,
  riskAmount: number,
  result: 'win' | 'loss' | 'breakeven'
): number {
  if (result === 'breakeven') return 0;
  
  const adjustedR = result === 'loss' ? -Math.abs(rMultiple) : Math.abs(rMultiple);
  return Math.round(riskAmount * adjustedR * 100) / 100;
}

/**
 * Calculate risk amount from balance and risk percent
 */
export function calculateRiskAmount(
  accountBalance: number,
  riskPercent: number
): number {
  return Math.round((accountBalance * riskPercent / 100) * 100) / 100;
}

/**
 * Calculate R-Multiple from profit and risk
 */
export function calculateRMultiple(
  profitAmount: number,
  riskAmount: number
): number {
  if (riskAmount === 0) return 0;
  return Math.round((profitAmount / riskAmount) * 100) / 100;
}

// ============================================================
// MEMOIZATION HELPER
// ============================================================

type CacheEntry<T> = { key: string; value: T; timestamp: number };

/**
 * Simple memoization cache with TTL
 */
export function createMemoizedCalculator<T>(
  calculator: (trades: Trade[]) => T,
  ttlMs: number = 5000
): (trades: Trade[]) => T {
  let cache: CacheEntry<T> | null = null;
  
  return (trades: Trade[]): T => {
    const key = trades.map(t => `${t.id}-${t.updatedAt}`).join('|');
    const now = Date.now();
    
    if (cache && cache.key === key && (now - cache.timestamp) < ttlMs) {
      return cache.value;
    }
    
    const value = calculator(trades);
    cache = { key, value, timestamp: now };
    return value;
  };
}
