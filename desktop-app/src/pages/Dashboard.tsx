/**
 * ========================================================================
 * Trading Journal - Dashboard (Bento Grid Command Center)
 * ========================================================================
 * Asymmetric bento grid with hero metrics, heatmap calendar,
 * trade streak, and compact trade timeline.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Printer,
  Download,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useAnalyticsStore, type TimeFilter } from '@/stores/analyticsStore';
import { useUIStore } from '@/stores/uiStore';
import { generateReportHTML, printReport, saveReportAsHTML } from '@/utils/reportGenerator';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { BentoGrid, BentoCell } from '@/components/ui/BentoGrid';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { Heatmap, type HeatmapDay } from '@/components/ui/Heatmap';
import { TradeStreak } from '@/components/ui/TradeStreak';
import { TradeRow } from '@/components/ui/TradeRow';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SparklineChart } from '@/components/ui/SparklineChart';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'today', label: 'Heute' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
  { value: 'quarter', label: 'Quartal' },
  { value: 'ytd', label: 'YTD' },
  { value: 'year', label: '12M' },
  { value: 'all', label: 'Alle' },
  { value: 'custom', label: 'Custom' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { loadTrades, trades } = useTradeStore();
  const { loadConfigs, configs } = useAccountStore();
  const {
    timeFilter, setTimeFilter, customDateRange, setCustomDateRange,
    accountFilter, setAccountFilter, getDateRange,
    calculatePerformance, calculateMonthlyReturns, calculateEquityCurve
  } = useAnalyticsStore();
  const { showToast } = useUIStore();

  const [greeting, setGreeting] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  useEffect(() => {
    loadTrades();
    loadConfigs();
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Guten Morgen');
    else if (hour < 18) setGreeting('Guten Tag');
    else setGreeting('Guten Abend');
  }, []);

  const filteredTrades = useMemo(() => {
    const range = getDateRange();
    return trades.filter(t => {
      const inDateRange = t.date >= range.start && t.date <= range.end;
      const inAccount = accountFilter === 'all' || t.type === accountFilter;
      const isLive = t.sessionType === 'live';
      return inDateRange && inAccount && isLive;
    });
  }, [trades, timeFilter, customDateRange, accountFilter, getDateRange]);

  const stats = useMemo(() => calculatePerformance(filteredTrades), [filteredTrades, calculatePerformance]);
  const monthlyReturns = useMemo(() => calculateMonthlyReturns(filteredTrades), [filteredTrades, calculateMonthlyReturns]);
  const equityCurve = useMemo(() =>
    calculateEquityCurve(filteredTrades, configs?.ek?.initialStartBalance || 10000),
    [filteredTrades, configs, calculateEquityCurve]
  );

  const ekBalance = configs?.ek?.currentBalance || 0;
  const fundedBalance = configs?.funded?.currentBalance || 0;
  const totalBalance = ekBalance + fundedBalance;

  const recentTrades = useMemo(() => {
    return [...filteredTrades]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [filteredTrades]);

  const totalProfitCHF = useMemo(() => {
    return filteredTrades.reduce((sum, t) => {
      const activeConfig = configs?.[t.type];
      const accountBalance = activeConfig?.currentBalance || 10000;
      const riskAmount = t.riskAmount || (accountBalance * (t.riskPercent || 1) / 100);
      return sum + (riskAmount * t.rMultiple);
    }, 0);
  }, [filteredTrades, configs]);

  const rSparkline = useMemo(() => {
    return filteredTrades
      .sort((a, b) => a.date.localeCompare(b.date))
      .reduce((acc, t) => {
        const last = acc.length > 0 ? acc[acc.length - 1] : 0;
        acc.push(last + t.rMultiple);
        return acc;
      }, [] as number[]);
  }, [filteredTrades]);

  const heatmapData = useMemo((): HeatmapDay[] => {
    const accountTrades = trades.filter(t =>
      (accountFilter === 'all' || t.type === accountFilter) && t.sessionType === 'live'
    );
    const dayMap = new Map<string, { totalR: number; count: number }>();
    accountTrades.forEach(t => {
      const existing = dayMap.get(t.date) || { totalR: 0, count: 0 };
      dayMap.set(t.date, { totalR: existing.totalR + t.rMultiple, count: existing.count + 1 });
    });
    return Array.from(dayMap.entries()).map(([date, d]) => ({
      date, value: d.totalR, trades: d.count,
    }));
  }, [trades, accountFilter]);

  const streakResults = useMemo(() => {
    return [...filteredTrades]
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .map(t => t.result);
  }, [filteredTrades]);

  const handleTimeFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    setShowCustomRange(filter === 'custom');
  };

  const currentBalance = accountFilter === 'all' ? totalBalance
    : accountFilter === 'ek' ? ekBalance : fundedBalance;

  const handleExportPDF = () => {
    const range = getDateRange();
    const html = generateReportHTML({
      title: 'Performance Report', dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats: { ...stats, currentBalance }, trades: filteredTrades, equityCurve, monthlyReturns,
    });
    printReport(html);
    showToast('Report wird gedruckt...', 'info');
  };

  const handleSaveHTML = async () => {
    const range = getDateRange();
    const html = generateReportHTML({
      title: 'Performance Report', dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats: { ...stats, currentBalance }, trades: filteredTrades, equityCurve, monthlyReturns,
    });
    const filename = `TradingJournal_Report_${range.start}_${range.end}.html`;
    await saveReportAsHTML(html, filename);
    showToast('Report gespeichert', 'success');
  };

  return (
    <PageTransition>
      <div className="page-container space-y-4">
        {/* Compact Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-gradient">{greeting}</span>
            <span className="text-text-primary">, Trader</span>
          </h1>
          <div className="flex items-center gap-2">
            <select
              className="select w-28 text-xs py-1.5"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value as 'all' | 'ek' | 'funded')}
            >
              <option value="all">Alle Konten</option>
              <option value="ek">Eigenkapital</option>
              <option value="funded">Funded</option>
            </select>
            <button onClick={handleExportPDF} className="btn-icon w-8 h-8" title="Drucken">
              <Printer size={14} />
            </button>
            <button onClick={handleSaveHTML} className="btn-icon w-8 h-8" title="Export">
              <Download size={14} />
            </button>
            <button onClick={() => navigate('/ek')} className="btn-primary btn-sm">
              <Plus size={14} /> Trade
            </button>
          </div>
        </motion.div>

        {/* Time Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="flex items-center gap-2"
        >
          <div className="toggle-group text-xs">
            {TIME_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => handleTimeFilterChange(filter.value)}
                className={clsx('toggle-btn px-2.5 py-1 text-xs', timeFilter === filter.value && 'active')}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {showCustomRange && (
            <div className="flex items-center gap-1.5 ml-2">
              <input type="date" className="input w-32 text-xs py-1"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
              />
              <span className="text-text-muted text-xs">–</span>
              <input type="date" className="input w-32 text-xs py-1"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
              />
            </div>
          )}
          <div className="ml-auto text-[11px] text-text-muted font-mono tabular-nums">
            {filteredTrades.length} Trades
          </div>
        </motion.div>

        {/* ============================================ */}
        {/* BENTO GRID                                   */}
        {/* ============================================ */}
        <BentoGrid cols={4} className="auto-rows-[minmax(140px,auto)]">

          {/* HERO: Kontostand */}
          <BentoCell size="tall" delay={0.05} accent>
            <div className="flex flex-col justify-between h-full">
              <MetricDisplay
                label="Kontostand"
                value={currentBalance}
                format="currency"
                suffix=" CHF"
                size="xl"
              />
              <div className="mt-auto pt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">EK</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {ekBalance.toLocaleString('de-CH')} CHF
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Funded</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {fundedBalance.toLocaleString('de-CH')} CHF
                  </span>
                </div>
              </div>
            </div>
          </BentoCell>

          {/* WIN RATE Ring */}
          <BentoCell delay={0.1}>
            <div className="flex flex-col items-center justify-center h-full">
              <ProgressRing
                value={stats.winRate}
                size={90}
                strokeWidth={7}
                color="#8B5CF6"
                label="WIN RATE"
              />
              <p className="text-xs text-text-muted mt-2 tabular-nums font-mono">
                {Math.round(stats.winRate * stats.totalTrades / 100)}W / {stats.totalTrades - Math.round(stats.winRate * stats.totalTrades / 100)}L
              </p>
            </div>
          </BentoCell>

          {/* EQUITY SPARKLINE */}
          <BentoCell size="wide" delay={0.15} noPadding>
            <div className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <MetricDisplay
                  label="Total R"
                  value={stats.totalR}
                  format="R"
                  showSign
                  size="md"
                />
                <button
                  onClick={() => navigate('/equity')}
                  className="text-[10px] text-accent-primary hover:underline"
                >
                  Details →
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {rSparkline.length > 2 ? (
                  <SparklineChart data={rSparkline} width={400} height={70} strokeWidth={2} className="w-full h-full" />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-text-muted">
                    Noch nicht genug Daten
                  </div>
                )}
              </div>
            </div>
          </BentoCell>

          {/* PROFIT/LOSS */}
          <BentoCell delay={0.2}>
            <MetricDisplay
              label="Gewinn/Verlust"
              value={totalProfitCHF}
              format="currency"
              suffix=" CHF"
              showSign
              size="md"
              trend={totalProfitCHF >= 0 ? 'up' : 'down'}
            />
          </BentoCell>

          {/* PROFIT FACTOR + EXPECTANCY */}
          <BentoCell delay={0.25}>
            <div className="space-y-4">
              <MetricDisplay
                label="Profit Factor"
                value={stats.profitFactor === Infinity ? 99 : stats.profitFactor}
                format="number"
                decimals={2}
                size="md"
                icon={<TrendingUp size={12} />}
              />
              <div className="border-t border-border pt-3">
                <MetricDisplay
                  label="Expectancy"
                  value={stats.expectancy}
                  format="number"
                  decimals={3}
                  showSign
                  size="sm"
                />
              </div>
            </div>
          </BentoCell>

          {/* STREAK + Best/Worst */}
          <BentoCell delay={0.3}>
            <div className="space-y-3">
              <div>
                <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">
                  Trade Streak
                </span>
                <div className="mt-2">
                  <TradeStreak results={streakResults} maxDots={15} size="md" showLabels />
                </div>
              </div>
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
                <div className="p-2 bg-pnl-positive/10 rounded-lg text-center">
                  <div className="text-[10px] text-text-muted">Best Day</div>
                  <div className="text-sm font-bold text-pnl-positive font-mono">
                    {stats.bestDay ? `+${stats.bestDay.r.toFixed(1)}R` : '–'}
                  </div>
                </div>
                <div className="p-2 bg-pnl-negative/10 rounded-lg text-center">
                  <div className="text-[10px] text-text-muted">Worst Day</div>
                  <div className="text-sm font-bold text-pnl-negative font-mono">
                    {stats.worstDay ? `${stats.worstDay.r.toFixed(1)}R` : '–'}
                  </div>
                </div>
              </div>
            </div>
          </BentoCell>

          {/* RECENT TRADES */}
          <BentoCell size="tall" delay={0.35} noPadding>
            <div className="p-3 h-full flex flex-col">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">
                  Letzte Trades
                </span>
                <button
                  onClick={() => navigate(accountFilter === 'funded' ? '/funded' : '/ek')}
                  className="text-[10px] text-accent-primary hover:underline"
                >
                  Alle →
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0">
                {recentTrades.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-text-muted">
                    Keine Trades
                  </div>
                ) : (
                  recentTrades.map((trade) => (
                    <TradeRow key={trade.id} trade={trade} showAccount={accountFilter === 'all'} compact />
                  ))
                )}
              </div>
            </div>
          </BentoCell>

          {/* HEATMAP CALENDAR */}
          <BentoCell size="wide" delay={0.4}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-accent-primary" />
              <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">
                Trading Aktivität
              </span>
              <button
                onClick={() => navigate('/calendar')}
                className="text-[10px] text-accent-primary hover:underline ml-auto"
              >
                Kalender →
              </button>
            </div>
            <Heatmap
              data={heatmapData}
              weeks={16}
              colorMode="pnl"
              onDayClick={(day) => { if (day.trades > 0) navigate('/calendar'); }}
            />
          </BentoCell>

          {/* PERFORMANCE DETAILS */}
          <BentoCell delay={0.45}>
            <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em] block mb-3">
              Details
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Sharpe Ratio</span>
                <span className="font-mono font-semibold text-text-primary">
                  <AnimatedNumber value={stats.sharpeRatio} decimals={2} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Avg Win</span>
                <span className="font-mono font-semibold text-pnl-positive">
                  +<AnimatedNumber value={stats.avgWin} decimals={2} suffix="R" />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Avg Loss</span>
                <span className="font-mono font-semibold text-pnl-negative">
                  -<AnimatedNumber value={stats.avgLoss} decimals={2} suffix="R" />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Max Drawdown</span>
                <span className="font-mono font-semibold text-pnl-negative">
                  <AnimatedNumber value={stats.maxDrawdown} decimals={1} suffix="R" />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Trading Tage</span>
                <span className="font-semibold text-text-primary">{stats.tradingDays}</span>
              </div>
            </div>
          </BentoCell>

        </BentoGrid>
      </div>
    </PageTransition>
  );
}
