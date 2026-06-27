/**
 * ========================================================================
 * Backtest – reine Auswertungs-Helfer (keine React-Abhängigkeit)
 * ========================================================================
 * Stats, Equity-Kurve nach Datum (mit Zeitraum-Filter), Setup-/Problem-
 * Performance und Trade-Filter. Alles pure Funktionen → leicht testbar.
 */

import { SETUP_DEFINITIONS } from '@/shared/types';
import type { BacktestTrade, BacktestStats } from './types';

export const MIN_SAMPLE = 20;

export type EquityPeriod = 'all' | '1y' | '6m' | '3m' | '1m' | '1w';

export const EQUITY_PERIODS: { key: EquityPeriod; label: string }[] = [
  { key: 'all', label: 'Alles' },
  { key: '1y', label: '1J' },
  { key: '6m', label: '6M' },
  { key: '3m', label: '3M' },
  { key: '1m', label: '1M' },
  { key: '1w', label: '1W' },
];

/** €-Risiko pro Trade: fix = Risiko% der START-Account-Größe (kein Compounding). */
export function computeEurRisk(accountSize?: number, riskPercent?: number): number {
  const a = accountSize || 0;
  const r = riskPercent || 0;
  return a > 0 && r > 0 ? (a * r) / 100 : 0;
}

export function computeStats(
  trades: BacktestTrade[],
  accountSize?: number,
  riskPercent?: number,
): BacktestStats {
  const acctSize = accountSize || 0;
  const eurRisk = computeEurRisk(accountSize, riskPercent);
  const base = { hasEur: eurRisk > 0, eurRisk, totalEur: 0, accountEnd: acctSize, growthPct: 0 };
  if (trades.length === 0) {
    return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalR: 0, avgR: 0, profitFactor: 0, ...base };
  }
  const wins = trades.filter(t => t.result === 'win').length;
  const losses = trades.filter(t => t.result === 'loss').length;
  const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
  const avgR = totalR / trades.length;
  const winRate = (wins / (wins + losses)) * 100 || 0;
  const grossProfit = trades.filter(t => t.rMultiple > 0).reduce((sum, t) => sum + t.rMultiple, 0);
  const grossLoss = Math.abs(trades.filter(t => t.rMultiple < 0).reduce((sum, t) => sum + t.rMultiple, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const totalEur = eurRisk * totalR;
  const accountEnd = acctSize + totalEur;
  const growthPct = acctSize > 0 ? (totalEur / acctSize) * 100 : 0;
  return { totalTrades: trades.length, wins, losses, winRate, totalR, avgR, profitFactor, hasEur: eurRisk > 0, eurRisk, totalEur, accountEnd, growthPct };
}

export interface EquityPoint {
  date: string;       // YYYY-MM-DD (oder Trade-Label als Fallback)
  equity: number;     // kumuliert: € wenn hasEur, sonst R
}

/**
 * Equity-Kurve nach Datum, ein Punkt pro Tag (End-of-Day kumuliert). Optional
 * auf einen Zeitraum begrenzt – gemessen RÜCKWÄRTS vom letzten Trade-Datum
 * (nicht von heute), weil Backtests historisch liegen können. Kumulation läuft
 * über die gesamte Historie weiter, der Filter zoomt nur das sichtbare Fenster.
 */
export function buildEquityByDate(
  trades: BacktestTrade[],
  period: EquityPeriod,
  accountSize?: number,
  riskPercent?: number,
): EquityPoint[] {
  if (trades.length === 0) return [];
  const eurRisk = computeEurRisk(accountSize, riskPercent);
  const hasEur = eurRisk > 0;
  const acctSize = accountSize || 0;

  // Nach Datum + Zeitstempel sortieren
  const sorted = [...trades].sort((a, b) =>
    a.date === b.date ? a.timestamp - b.timestamp : a.date.localeCompare(b.date),
  );

  // Pro Tag kumulieren
  let r = 0;
  const byDay = new Map<string, number>();
  for (const t of sorted) {
    r += t.rMultiple;
    const equity = hasEur ? acctSize + r * eurRisk : r;
    byDay.set(t.date, parseFloat(equity.toFixed(2)));
  }
  let points: EquityPoint[] = [...byDay.entries()].map(([date, equity]) => ({ date, equity }));

  if (period !== 'all') {
    const anchor = new Date(sorted[sorted.length - 1].date);
    const start = new Date(anchor);
    switch (period) {
      case '1y': start.setFullYear(start.getFullYear() - 1); break;
      case '6m': start.setMonth(start.getMonth() - 6); break;
      case '3m': start.setMonth(start.getMonth() - 3); break;
      case '1m': start.setMonth(start.getMonth() - 1); break;
      case '1w': start.setDate(start.getDate() - 7); break;
    }
    const startStr = start.toISOString().split('T')[0];
    points = points.filter(p => p.date >= startStr);
  }
  return points;
}

export interface CategoryStat {
  key: string;
  label: string;
  color?: string;
  n: number;
  winRate: number;
  totalR: number;
  expectancy: number;
  reliable: boolean;
}

/** Performance je Setup. Ein Trade mit mehreren Setups zählt bei jedem. */
export function computeSetupStats(trades: BacktestTrade[]): CategoryStat[] {
  const agg: Record<string, { n: number; wins: number; losses: number; totalR: number }> = {};
  for (const t of trades) {
    for (const key of (t.setups.length ? t.setups : ['(ohne Setup)'])) {
      if (!agg[key]) agg[key] = { n: 0, wins: 0, losses: 0, totalR: 0 };
      agg[key].n++;
      agg[key].totalR += t.rMultiple;
      if (t.result === 'win') agg[key].wins++;
      else if (t.result === 'loss') agg[key].losses++;
    }
  }
  return Object.entries(agg).map(([key, v]) => {
    const def = (SETUP_DEFINITIONS as any)[key];
    const decided = v.wins + v.losses;
    return {
      key,
      label: def?.short || def?.label || key,
      color: def?.color as string | undefined,
      n: v.n,
      winRate: decided > 0 ? (v.wins / decided) * 100 : 0,
      totalR: v.totalR,
      expectancy: v.n > 0 ? v.totalR / v.n : 0,
      reliable: v.n >= MIN_SAMPLE,
    };
  }).sort((a, b) => b.expectancy - a.expectancy);
}

/** Performance je Problem-Tag. Sortiert SCHLECHTESTE zuerst (Leaks finden). */
export function computeProblemStats(trades: BacktestTrade[]): CategoryStat[] {
  const agg: Record<string, { n: number; wins: number; losses: number; totalR: number }> = {};
  for (const t of trades) {
    for (const key of (t.problems.length ? t.problems : [])) {
      if (!agg[key]) agg[key] = { n: 0, wins: 0, losses: 0, totalR: 0 };
      agg[key].n++;
      agg[key].totalR += t.rMultiple;
      if (t.result === 'win') agg[key].wins++;
      else if (t.result === 'loss') agg[key].losses++;
    }
  }
  return Object.entries(agg).map(([key, v]) => {
    const decided = v.wins + v.losses;
    return {
      key,
      label: key,
      n: v.n,
      winRate: decided > 0 ? (v.wins / decided) * 100 : 0,
      totalR: v.totalR,
      expectancy: v.n > 0 ? v.totalR / v.n : 0,
      reliable: v.n >= MIN_SAMPLE,
    };
  }).sort((a, b) => a.expectancy - b.expectancy);
}

export interface TradeFilter {
  setups: string[];
  problems: string[];
  keyword: string;
}

export const EMPTY_FILTER: TradeFilter = { setups: [], problems: [], keyword: '' };

export function isFilterActive(f: TradeFilter): boolean {
  return f.setups.length > 0 || f.problems.length > 0 || f.keyword.trim().length > 0;
}

/** Trade besteht den Filter, wenn ALLE gesetzten Kriterien zutreffen. */
export function filterTrades(trades: BacktestTrade[], f: TradeFilter): BacktestTrade[] {
  const kw = f.keyword.trim().toLowerCase();
  return trades.filter(t => {
    if (f.setups.length && !f.setups.some(s => t.setups.includes(s))) return false;
    if (f.problems.length && !f.problems.some(p => t.problems.includes(p))) return false;
    if (kw) {
      const hay = `${t.notes || ''} ${(t.problems || []).join(' ')}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}
