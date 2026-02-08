/**
 * ========================================================================
 * Trading Journal - Equity Curve Page (Complete)
 * ========================================================================
 */

import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, RefreshCw, Calendar, Target, Percent, BarChart3, Activity     } from 'lucide-react';
import { EquityChart, RMultipleChart, WinRateChart } from '@/components/charts';
import { StatCard } from '@/components/ui/StatCard';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { clsx } from '@/utils';

type AccountFilter = 'funded' | 'ek';
type TimeFilter = 'all' | 'month' | 'quarter' | 'year';

export function EquityCurve() {
  const { trades, loadTrades, isLoading } = useTradeStore();
  const { configs, loadConfigs } = useAccountStore();
  
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('funded');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showDrawdown, setShowDrawdown] = useState(true);

  useEffect(() => {
    loadTrades();
    loadConfigs();
  }, []);

  // Filter trades based on selections (live trades only)
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (trade.type !== accountFilter) return false;
      if (trade.sessionType !== 'live') return false;
      
      if (timeFilter !== 'all') {
        const tradeDate = new Date(trade.date);
        const now = new Date();
        
        switch (timeFilter) {
          case 'month':
            const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
            if (tradeDate < monthAgo) return false;
            break;
          case 'quarter':
            const quarterAgo = new Date(now.setMonth(now.getMonth() - 3));
            if (tradeDate < quarterAgo) return false;
            break;
          case 'year':
            const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1));
            if (tradeDate < yearAgo) return false;
            break;
        }
      }
      return true;
    });
  }, [trades, accountFilter, timeFilter]);

  // Calculate metrics for filtered trades
  const metrics = useMemo(() => {
    const wins = filteredTrades.filter(t => t.result === 'win').length;
    const losses = filteredTrades.filter(t => t.result === 'loss').length;
    const breakevens = filteredTrades.filter(t => t.result === 'breakeven').length;
    const total = filteredTrades.length;
    
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    
    const totalR = filteredTrades.reduce((sum, t) => sum + (t.rMultiple || 0), 0);
    const avgWin = wins > 0 
      ? filteredTrades.filter(t => t.result === 'win').reduce((sum, t) => sum + (t.rMultiple || 0), 0) / wins 
      : 0;
    const avgLoss = losses > 0 
      ? Math.abs(filteredTrades.filter(t => t.result === 'loss').reduce((sum, t) => sum + (t.rMultiple || 0), 0) / losses)
      : 0;
    
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : avgWin > 0 ? Infinity : 0;
    
    // Calculate max drawdown
    let peak = 0;
    let maxDD = 0;
    let runningR = 0;
    
    const sortedTrades = [...filteredTrades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    for (const trade of sortedTrades) {
      runningR += trade.rMultiple || 0;
      if (runningR > peak) peak = runningR;
      const dd = peak - runningR;
      if (dd > maxDD) maxDD = dd;
    }
    
    // Best and worst trade
    const bestTrade = filteredTrades.reduce((best, t) => 
      (t.rMultiple || 0) > (best?.rMultiple || -Infinity) ? t : best, filteredTrades[0]);
    const worstTrade = filteredTrades.reduce((worst, t) => 
      (t.rMultiple || 0) < (worst?.rMultiple || Infinity) ? t : worst, filteredTrades[0]);
    
    // Average R per trade
    const avgR = total > 0 ? totalR / total : 0;
    
    // Consecutive wins/losses
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    
    for (const trade of sortedTrades) {
      if (trade.result === 'win') {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else if (trade.result === 'loss') {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
        maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
      } else {
        currentStreak = 0;
      }
    }
    
    return {
      wins,
      losses,
      breakevens,
      total,
      winRate,
      totalR,
      avgWin,
      avgLoss,
      avgR,
      profitFactor,
      maxDrawdown: maxDD,
      bestTrade: bestTrade?.rMultiple || 0,
      worstTrade: worstTrade?.rMultiple || 0,
      maxWinStreak,
      maxLossStreak
    };
  }, [filteredTrades]);

  const startBalance = accountFilter === 'ek' 
    ? configs?.ek.initialStartBalance || 10000 
    : configs?.funded.initialStartBalance || 100000;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <TrendingUp className="text-accent-primary" />
          Equity Curve
        </h1>
        
        <div className="flex items-center gap-3">
          <div className="toggle-group">
            {(['funded', 'ek'] as AccountFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setAccountFilter(filter)}
                className={clsx('toggle-btn px-3', accountFilter === filter && 'active')}
              >
                {filter === 'funded' ? 'Funded' : 'Eigenkapital'}
              </button>
            ))}
          </div>

          <div className="toggle-group">
            {([
              { value: 'all', label: 'Alle' },
              { value: 'month', label: '1M' },
              { value: 'quarter', label: '3M' },
              { value: 'year', label: '1J' }
            ] as { value: TimeFilter; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeFilter(value)}
                className={clsx('toggle-btn px-3', timeFilter === value && 'active')}
              >
                {label}
              </button>
            ))}
          </div>

          <button onClick={() => loadTrades()} className="btn-secondary" disabled={isLoading}>
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Quick Stats - Row 1 */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <StatCard 
          label="Gesamt-R" 
          value={`${metrics.totalR >= 0 ? '+' : ''}${metrics.totalR.toFixed(2)} R`} 
          trend={metrics.totalR >= 0 ? 'up' : 'down'} 
          trendValue={`Ø ${metrics.avgR >= 0 ? '+' : ''}${metrics.avgR.toFixed(2)}R / Trade`}
        />
        <StatCard 
          label="Win Rate" 
          value={`${metrics.winRate.toFixed(1)}%`} 
          trend={metrics.winRate >= 50 ? 'up' : 'down'} 
          trendValue={`${metrics.wins}W / ${metrics.losses}L / ${metrics.breakevens}BE`}
        />
        <StatCard 
          label="Profit Factor" 
          value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)} 
          trend={metrics.profitFactor >= 1.5 ? 'up' : 'down'} 
          trendValue={`Ø Win: +${metrics.avgWin.toFixed(2)}R`}
        />
        <StatCard 
          label="Max Drawdown" 
          value={`${metrics.maxDrawdown.toFixed(2)} R`} 
          trend="down" 
          trendValue={`Ø Loss: ${metrics.avgLoss.toFixed(2)}R`}
        />
        <StatCard 
          label="Trades" 
          value={metrics.total} 
          trendValue={accountFilter === 'funded' ? 'Funded Account' : 'Eigenkapital'}
        />
      </div>

      {/* Quick Stats - Row 2 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard 
          label="Bester Trade" 
          value={`+${metrics.bestTrade.toFixed(2)} R`} 
          trend="up" 
        />
        <StatCard 
          label="Schlechtester Trade" 
          value={`${metrics.worstTrade.toFixed(2)} R`} 
          trend="down" 
        />
        <StatCard 
          label="Win Streak" 
          value={metrics.maxWinStreak} 
          trendValue="Trades in Folge"
          trend="up"
        />
        <StatCard 
          label="Loss Streak" 
          value={metrics.maxLossStreak} 
          trendValue="Trades in Folge"
          trend="down"
        />
        <StatCard 
          label="Startkapital" 
          value={`${startBalance.toLocaleString('de-DE')} €`} 
          trendValue={`Aktuell: ${(startBalance + (metrics.totalR * (startBalance * 0.01))).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`}
        />
      </div>

      {/* Main Equity Chart */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Equity Verlauf</h2>
          <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
            <input type="checkbox" checked={showDrawdown} onChange={(e) => setShowDrawdown(e.target.checked)} className="rounded border-border bg-glass-white" />
            Drawdown anzeigen
          </label>
        </div>
        
        {filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <Calendar size={48} className="mb-4 opacity-50" />
            <p>Keine Trades für den ausgewählten Zeitraum</p>
          </div>
        ) : (
          <EquityChart trades={filteredTrades} startBalance={startBalance} showDrawdown={showDrawdown} height={400} />
        )}
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card p-6 col-span-2">
          <h3 className="text-lg font-semibold text-text-primary mb-4">R-Multiple Verteilung</h3>
          <RMultipleChart trades={filteredTrades} height={280} />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Ergebnis-Verteilung</h3>
          <WinRateChart trades={filteredTrades} height={280} />
        </div>
      </div>
    </div>
  );
}
