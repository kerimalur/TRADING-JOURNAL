/**
 * ========================================================================
 * Trading Journal - Analytics Store (Zustand)
 * ========================================================================
 * 
 * Erweiterte Analyse-Funktionen:
 * - Zeitfilter (Monat, Quartal, Jahr, Custom)
 * - Performance-Berechnungen
 * - Export-Funktionen
 */

import { create } from 'zustand';
import type { Trade } from '@/shared/types';

export type TimeFilter = 'today' | 'week' | 'month' | 'quarter' | 'ytd' | 'year' | 'all' | 'custom';

export interface DateRange {
  start: string;
  end: string;
}

export interface PerformanceStats {
  totalTrades: number;
  winRate: number;
  totalR: number;
  avgR: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  expectancy: number;
  bestDay: { date: string; r: number } | null;
  worstDay: { date: string; r: number } | null;
  longestWinStreak: number;
  longestLoseStreak: number;
  tradingDays: number;
  avgTradesPerDay: number;
}

export interface SessionStats {
  session: string;
  trades: number;
  winRate: number;
  totalR: number;
  avgR: number;
}

export interface DayOfWeekStats {
  day: number;
  name: string;
  trades: number;
  winRate: number;
  totalR: number;
  avgR: number;
}

interface AnalyticsState {
  // Filters
  timeFilter: TimeFilter;
  customDateRange: DateRange;
  accountFilter: 'all' | 'ek' | 'funded';
  
  // Actions
  setTimeFilter: (filter: TimeFilter) => void;
  setCustomDateRange: (range: DateRange) => void;
  setAccountFilter: (account: 'all' | 'ek' | 'funded') => void;
  
  // Date Range Helpers
  getDateRange: () => DateRange;
  
  // Analytics Calculations
  calculatePerformance: (trades: Trade[]) => PerformanceStats;
  calculateSessionStats: (trades: Trade[]) => SessionStats[];
  calculateDayOfWeekStats: (trades: Trade[]) => DayOfWeekStats[];
  calculateEquityCurve: (trades: Trade[], startBalance: number) => { date: string; balance: number; r: number }[];
  calculateMonthlyReturns: (trades: Trade[]) => { month: string; r: number; trades: number; winRate: number }[];
}

const getToday = () => new Date().toISOString().split('T')[0];

const getWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().split('T')[0];
};

const getMonthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const getQuarterStart = () => {
  const d = new Date();
  const quarter = Math.floor(d.getMonth() / 3);
  return `${d.getFullYear()}-${String(quarter * 3 + 1).padStart(2, '0')}-01`;
};

const getYearStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
};

const getLastYearStart = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
};

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  timeFilter: 'month',
  customDateRange: { start: getMonthStart(), end: getToday() },
  accountFilter: 'all',
  
  setTimeFilter: (filter) => set({ timeFilter: filter }),
  
  setCustomDateRange: (range) => set({ customDateRange: range }),
  
  setAccountFilter: (account) => set({ accountFilter: account }),
  
  getDateRange: () => {
    const { timeFilter, customDateRange } = get();
    const today = getToday();
    
    switch (timeFilter) {
      case 'today':
        return { start: today, end: today };
      case 'week':
        return { start: getWeekStart(), end: today };
      case 'month':
        return { start: getMonthStart(), end: today };
      case 'quarter':
        return { start: getQuarterStart(), end: today };
      case 'ytd':
        return { start: getYearStart(), end: today };
      case 'year':
        return { start: getLastYearStart(), end: today };
      case 'custom':
        return customDateRange;
      case 'all':
      default:
        return { start: '2000-01-01', end: today };
    }
  },
  
  calculatePerformance: (trades): PerformanceStats => {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalR: 0,
        avgR: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        expectancy: 0,
        bestDay: null,
        worstDay: null,
        longestWinStreak: 0,
        longestLoseStreak: 0,
        tradingDays: 0,
        avgTradesPerDay: 0,
      };
    }
    
    const wins = trades.filter(t => t.result === 'win');
    const losses = trades.filter(t => t.result === 'loss');
    
    const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
    const avgR = totalR / trades.length;
    
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    
    const avgWin = wins.length > 0 
      ? wins.reduce((sum, t) => sum + t.rMultiple, 0) / wins.length 
      : 0;
    
    const avgLoss = losses.length > 0 
      ? Math.abs(losses.reduce((sum, t) => sum + t.rMultiple, 0) / losses.length)
      : 0;
    
    const grossProfit = wins.reduce((sum, t) => sum + t.rMultiple, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.rMultiple, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    // Drawdown calculation
    let equity = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    trades
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach(trade => {
        equity += trade.rMultiple;
        if (equity > peak) peak = equity;
        const dd = peak - equity;
        if (dd > maxDrawdown) maxDrawdown = dd;
      });
    
    // Daily aggregation
    const dailyR: Record<string, number> = {};
    trades.forEach(t => {
      dailyR[t.date] = (dailyR[t.date] || 0) + t.rMultiple;
    });
    
    const tradingDays = Object.keys(dailyR).length;
    const avgTradesPerDay = tradingDays > 0 ? trades.length / tradingDays : 0;
    
    let bestDay: { date: string; r: number } | null = null;
    let worstDay: { date: string; r: number } | null = null;
    
    Object.entries(dailyR).forEach(([date, r]) => {
      if (!bestDay || r > bestDay.r) bestDay = { date, r };
      if (!worstDay || r < worstDay.r) worstDay = { date, r };
    });
    
    // Streaks
    let currentWinStreak = 0;
    let currentLoseStreak = 0;
    let longestWinStreak = 0;
    let longestLoseStreak = 0;
    
    trades.forEach(t => {
      if (t.result === 'win') {
        currentWinStreak++;
        currentLoseStreak = 0;
        if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
      } else if (t.result === 'loss') {
        currentLoseStreak++;
        currentWinStreak = 0;
        if (currentLoseStreak > longestLoseStreak) longestLoseStreak = currentLoseStreak;
      }
    });
    
    // Sharpe Ratio (simplified using R-multiples)
    const rValues = trades.map(t => t.rMultiple);
    const rMean = avgR;
    const rVariance = rValues.reduce((sum, r) => sum + Math.pow(r - rMean, 2), 0) / rValues.length;
    const rStdDev = Math.sqrt(rVariance);
    const sharpeRatio = rStdDev > 0 ? rMean / rStdDev : 0;
    
    // Expectancy
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
    
    return {
      totalTrades: trades.length,
      winRate,
      totalR,
      avgR,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      maxDrawdownPercent: peak > 0 ? (maxDrawdown / peak) * 100 : 0,
      sharpeRatio,
      expectancy,
      bestDay,
      worstDay,
      longestWinStreak,
      longestLoseStreak,
      tradingDays,
      avgTradesPerDay,
    };
  },
  
  calculateSessionStats: (trades): SessionStats[] => {
    const sessions = ['London', 'New York', 'Asia', 'Overlap'];
    
    return sessions.map(session => {
      const sessionTrades = trades.filter(t => t.session === session);
      const wins = sessionTrades.filter(t => t.result === 'win').length;
      const totalR = sessionTrades.reduce((sum, t) => sum + t.rMultiple, 0);
      
      return {
        session,
        trades: sessionTrades.length,
        winRate: sessionTrades.length > 0 ? (wins / sessionTrades.length) * 100 : 0,
        totalR,
        avgR: sessionTrades.length > 0 ? totalR / sessionTrades.length : 0,
      };
    });
  },
  
  calculateDayOfWeekStats: (trades): DayOfWeekStats[] => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    
    return days.map((name, day) => {
      const dayTrades = trades.filter(t => new Date(t.date).getDay() === day);
      const wins = dayTrades.filter(t => t.result === 'win').length;
      const totalR = dayTrades.reduce((sum, t) => sum + t.rMultiple, 0);
      
      return {
        day,
        name,
        trades: dayTrades.length,
        winRate: dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0,
        totalR,
        avgR: dayTrades.length > 0 ? totalR / dayTrades.length : 0,
      };
    });
  },
  
  calculateEquityCurve: (trades, startBalance) => {
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const curve: { date: string; balance: number; r: number }[] = [
      { date: 'Start', balance: startBalance, r: 0 }
    ];
    
    let balance = startBalance;
    let cumulativeR = 0;
    
    sortedTrades.forEach(trade => {
      const riskAmount = balance * (trade.riskPercent || 1) / 100;
      balance += trade.rMultiple * riskAmount;
      cumulativeR += trade.rMultiple;
      
      curve.push({
        date: trade.date,
        balance: Math.round(balance * 100) / 100,
        r: Math.round(cumulativeR * 100) / 100,
      });
    });
    
    return curve;
  },
  
  calculateMonthlyReturns: (trades) => {
    const monthlyData: Record<string, { r: number; trades: number; wins: number }> = {};
    
    trades.forEach(trade => {
      const month = trade.date.substring(0, 7); // YYYY-MM
      
      if (!monthlyData[month]) {
        monthlyData[month] = { r: 0, trades: 0, wins: 0 };
      }
      
      monthlyData[month].r += trade.rMultiple;
      monthlyData[month].trades++;
      if (trade.result === 'win') monthlyData[month].wins++;
    });
    
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        r: Math.round(data.r * 100) / 100,
        trades: data.trades,
        winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : 0,
      }));
  },
}));
