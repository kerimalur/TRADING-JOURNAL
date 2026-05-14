/**
 * ========================================================================
 * Trading Journal - Equity Curve (Chart-First Layout)
 * ========================================================================
 * Chart takes 60% of the page. Only 3-4 key metrics underneath.
 * Stats as overlay-style, minimal stat cards removed.
 */

import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, RefreshCw, Calendar } from 'lucide-react';
import { EquityChart, RMultipleChart, WinRateChart } from '@/components/charts';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { clsx } from '@/utils';
import { PageTransition } from '@/components/ui/PageTransition';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { TradeStreak } from '@/components/ui/TradeStreak';

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

  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (trade.type !== accountFilter) return false;
      if (trade.sessionType !== 'live') return false;
      if (timeFilter !== 'all') {
        const tradeDate = new Date(trade.date);
        const now = new Date();
        switch (timeFilter) {
          case 'month': { const d = new Date(now); d.setMonth(d.getMonth() - 1); if (tradeDate < d) return false; break; }
          case 'quarter': { const d = new Date(now); d.setMonth(d.getMonth() - 3); if (tradeDate < d) return false; break; }
          case 'year': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); if (tradeDate < d) return false; break; }
        }
      }
      return true;
    });
  }, [trades, accountFilter, timeFilter]);

  const metrics = useMemo(() => {
    const wins = filteredTrades.filter(t => t.result === 'win').length;
    const losses = filteredTrades.filter(t => t.result === 'loss').length;
    const total = filteredTrades.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    const totalR = filteredTrades.reduce((sum, t) => sum + (t.rMultiple || 0), 0);
    const avgWin = wins > 0 ? filteredTrades.filter(t => t.result === 'win').reduce((sum, t) => sum + (t.rMultiple || 0), 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(filteredTrades.filter(t => t.result === 'loss').reduce((sum, t) => sum + (t.rMultiple || 0), 0) / losses) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : avgWin > 0 ? Infinity : 0;

    let peak = 0, maxDD = 0, runningR = 0;
    const sorted = [...filteredTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const t of sorted) {
      runningR += t.rMultiple || 0;
      if (runningR > peak) peak = runningR;
      const dd = peak - runningR;
      if (dd > maxDD) maxDD = dd;
    }

    const bestTrade = filteredTrades.reduce((best, t) => (t.rMultiple || 0) > (best?.rMultiple || -Infinity) ? t : best, filteredTrades[0]);
    const worstTrade = filteredTrades.reduce((worst, t) => (t.rMultiple || 0) < (worst?.rMultiple || Infinity) ? t : worst, filteredTrades[0]);
    const avgR = total > 0 ? totalR / total : 0;

    let currentStreak = 0, maxWinStreak = 0, maxLossStreak = 0;
    for (const t of sorted) {
      if (t.result === 'win') { currentStreak = currentStreak > 0 ? currentStreak + 1 : 1; maxWinStreak = Math.max(maxWinStreak, currentStreak); }
      else if (t.result === 'loss') { currentStreak = currentStreak < 0 ? currentStreak - 1 : -1; maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak)); }
      else { currentStreak = 0; }
    }

    return { wins, losses, total, winRate, totalR, avgWin, avgLoss, avgR, profitFactor, maxDrawdown: maxDD, bestTrade: bestTrade?.rMultiple || 0, worstTrade: worstTrade?.rMultiple || 0, maxWinStreak, maxLossStreak };
  }, [filteredTrades]);

  const streakResults = useMemo(() => {
    return [...filteredTrades]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => t.result);
  }, [filteredTrades]);

  const startBalance = accountFilter === 'ek'
    ? configs?.ek?.initialStartBalance || 10000
    : configs?.funded?.initialStartBalance || 100000;

  return (
    <PageTransition>
      <div className="page-container space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <h1 className="page-title text-lg">
            <TrendingUp size={20} className="text-accent-primary" />
            Equity Curve
          </h1>
          <div className="flex items-center gap-2">
            <div className="toggle-group text-xs">
              {(['funded', 'ek'] as AccountFilter[]).map((f) => (
                <button key={f} onClick={() => setAccountFilter(f)}
                  className={clsx('toggle-btn px-3 py-1 text-xs', accountFilter === f && 'active')}>
                  {f === 'funded' ? 'Funded' : 'EK'}
                </button>
              ))}
            </div>
            <div className="toggle-group text-xs">
              {[{ v: 'all', l: 'Alle' }, { v: 'month', l: '1M' }, { v: 'quarter', l: '3M' }, { v: 'year', l: '1J' }].map(({ v, l }) => (
                <button key={v} onClick={() => setTimeFilter(v as TimeFilter)}
                  className={clsx('toggle-btn px-2.5 py-1 text-xs', timeFilter === v && 'active')}>
                  {l}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
              <input type="checkbox" checked={showDrawdown} onChange={(e) => setShowDrawdown(e.target.checked)}
                className="rounded border-border bg-background-surface w-3.5 h-3.5" />
              DD
            </label>
            <button onClick={() => loadTrades()} className="btn-icon w-8 h-8" disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Overlay Stats Bar */}
        <div className="flex items-end gap-6 px-1">
          <MetricDisplay label="Total R" value={metrics.totalR} format="R" showSign size="lg"
            trend={metrics.totalR >= 0 ? 'up' : 'down'} trendLabel={`Ø ${metrics.avgR >= 0 ? '+' : ''}${metrics.avgR.toFixed(2)}R`} />
          <MetricDisplay label="Win Rate" value={metrics.winRate} format="percent" size="md"
            trend={metrics.winRate >= 50 ? 'up' : 'down'} trendLabel={`${metrics.wins}W / ${metrics.losses}L`} />
          <MetricDisplay label="Profit Factor" value={metrics.profitFactor === Infinity ? 99 : metrics.profitFactor}
            decimals={2} size="md" />
          <MetricDisplay label="Max DD" value={metrics.maxDrawdown} format="R" size="md" />
          <div className="ml-auto">
            <TradeStreak results={streakResults} maxDots={25} size="sm" showLabels />
          </div>
        </div>

        {/* MAIN CHART - Takes ~60% of page */}
        <div className="rounded-xl border border-border bg-background-card p-4" style={{ minHeight: '55vh' }}>
          {filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-24 text-text-muted">
              <Calendar size={48} className="mb-4 opacity-50" />
              <p>Keine Trades für den ausgewählten Zeitraum</p>
            </div>
          ) : (
            <EquityChart trades={filteredTrades} startBalance={startBalance} showDrawdown={showDrawdown} height={450} />
          )}
        </div>

        {/* Secondary: R-Distribution + Win/Loss Pie - compact row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 rounded-xl border border-border bg-background-card p-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">R-Multiple Verteilung</h3>
            <RMultipleChart trades={filteredTrades} height={200} />
          </div>
          <div className="rounded-xl border border-border bg-background-card p-4">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Ergebnis</h3>
            <WinRateChart trades={filteredTrades} height={200} />
            {/* Compact stat list below pie */}
            <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Best Trade</span>
                <span className="font-mono text-pnl-positive">+{metrics.bestTrade.toFixed(1)}R</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Worst Trade</span>
                <span className="font-mono text-pnl-negative">{metrics.worstTrade.toFixed(1)}R</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Win Streak</span>
                <span className="font-mono text-pnl-positive">{metrics.maxWinStreak}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Loss Streak</span>
                <span className="font-mono text-pnl-negative">{metrics.maxLossStreak}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
