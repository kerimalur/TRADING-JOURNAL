/**
 * ========================================================================
 * Trading Journal - Analytics Page
 * ========================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download,
  TrendingUp,
  Target,
  Activity,
  Printer
} from 'lucide-react';
import { clsx } from '@/utils';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useAnalyticsStore, type TimeFilter } from '@/stores/analyticsStore';
import { useUIStore } from '@/stores/uiStore';
import { generateReportHTML, printReport, saveReportAsHTML } from '@/utils/reportGenerator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'today', label: 'Heute' },
  { value: 'week', label: 'Diese Woche' },
  { value: 'month', label: 'Dieser Monat' },
  { value: 'quarter', label: 'Quartal' },
  { value: 'ytd', label: 'YTD' },
  { value: 'year', label: '12 Monate' },
  { value: 'all', label: 'Alle' },
  { value: 'custom', label: 'Custom' },
];

export function Analytics() {
  const { trades, loadTrades } = useTradeStore();
  const { configs, loadConfigs } = useAccountStore();
  const { 
    timeFilter, 
    setTimeFilter, 
    customDateRange,
    setCustomDateRange,
    accountFilter,
    setAccountFilter,
    getDateRange,
    calculatePerformance,
    calculateDayOfWeekStats,
    calculateMonthlyReturns,
    calculateEquityCurve
  } = useAnalyticsStore();
  const { showToast } = useUIStore();
  
  const [showCustomRange, setShowCustomRange] = useState(false);

  useEffect(() => {
    loadTrades();
    loadConfigs();
  }, []);

  // Filter trades by date range and account
  const filteredTrades = useMemo(() => {
    const range = getDateRange();
    return trades.filter(t => {
      const inDateRange = t.date >= range.start && t.date <= range.end;
      const inAccount = accountFilter === 'all' || t.type === accountFilter;
      const isLive = t.sessionType === 'live';
      return inDateRange && inAccount && isLive;
    });
  }, [trades, timeFilter, customDateRange, accountFilter, getDateRange]);

  // Calculate stats
  const stats = useMemo(() => calculatePerformance(filteredTrades), [filteredTrades, calculatePerformance]);
  const dayStats = useMemo(() => calculateDayOfWeekStats(filteredTrades), [filteredTrades, calculateDayOfWeekStats]);
  const monthlyReturns = useMemo(() => calculateMonthlyReturns(filteredTrades), [filteredTrades, calculateMonthlyReturns]);
  const equityCurve = useMemo(() => 
    calculateEquityCurve(filteredTrades, configs?.ek?.initialStartBalance || 10000), 
    [filteredTrades, configs, calculateEquityCurve]
  );

  const handleTimeFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    if (filter === 'custom') {
      setShowCustomRange(true);
    } else {
      setShowCustomRange(false);
    }
  };

  const handleExportPDF = () => {
    const range = getDateRange();
    const html = generateReportHTML({
      title: 'Performance Report',
      dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats,
      trades: filteredTrades,
      equityCurve,
      monthlyReturns,
    });
    
    printReport(html);
    showToast('Report wird gedruckt...', 'info');
  };

  const handleSaveHTML = async () => {
    const range = getDateRange();
    const html = generateReportHTML({
      title: 'Performance Report',
      dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats,
      trades: filteredTrades,
      equityCurve,
      monthlyReturns,
    });
    
    const filename = `TradingJournal_Report_${range.start}_${range.end}.html`;
    await saveReportAsHTML(html, filename);
    showToast('Report gespeichert', 'success');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <BarChart3 className="text-accent-primary" />
          Analytics
        </h1>
        
        <div className="flex items-center gap-3">
          {/* Account Filter */}
          <select 
            className="select w-36"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value as 'all' | 'ek' | 'funded')}
          >
            <option value="all">Alle Konten</option>
            <option value="ek">Eigenkapital</option>
            <option value="funded">Funded</option>
          </select>
          
          {/* Export Buttons */}
          <button onClick={handleExportPDF} className="btn-secondary">
            <Printer size={16} />
            Drucken
          </button>
          <button onClick={handleSaveHTML} className="btn-secondary">
            <Download size={16} />
            Export HTML
          </button>
        </div>
      </div>

      {/* Time Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="toggle-group">
          {TIME_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleTimeFilterChange(filter.value)}
              className={clsx('toggle-btn', timeFilter === filter.value && 'active')}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        {showCustomRange && (
          <div className="flex items-center gap-2 ml-4">
            <input
              type="date"
              className="input w-36"
              value={customDateRange.start}
              onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
            />
            <span className="text-text-muted">bis</span>
            <input
              type="date"
              className="input w-36"
              value={customDateRange.end}
              onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Trades</div>
          <div className="text-2xl font-semibold tabular-nums text-text-primary">
            {stats.totalTrades}
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Win Rate</div>
          <div className="text-2xl font-semibold tabular-nums text-text-primary">
            {stats.winRate.toFixed(1)}%
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Total R</div>
          <div className={clsx(
            'text-2xl font-semibold tabular-nums',
            stats.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
          )}>
            {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(1)}R
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Profit Factor</div>
          <div className="text-2xl font-semibold tabular-nums text-text-primary">
            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Avg Win</div>
          <div className="text-2xl font-semibold tabular-nums text-pnl-positive">
            +{stats.avgWin.toFixed(2)}R
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Avg Loss</div>
          <div className="text-2xl font-semibold tabular-nums text-pnl-negative">
            -{stats.avgLoss.toFixed(2)}R
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Day of Week Performance */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-text-muted" />
            Performance nach Wochentag
          </h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayStats.filter(d => d.trades > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#666" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v) => v.substring(0, 2)}
                />
                <YAxis 
                  stroke="#666" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(v) => `${v}R`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a24', 
                    border: '1px solid #2a2a35',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}R`, 'Total R']}
                />
                <Bar dataKey="totalR" radius={[4, 4, 0, 0]}>
                  {dayStats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.totalR >= 0 ? '#22C55E' : '#EF4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Returns */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-text-muted" />
            Monatliche Returns
          </h3>
          
          {monthlyReturns.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-text-muted">
              Keine Daten im ausgewählten Zeitraum
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyReturns}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#666" 
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickFormatter={(v) => {
                      const d = new Date(v + '-01');
                      return d.toLocaleDateString('de-DE', { month: 'short' });
                    }}
                  />
                  <YAxis 
                    stroke="#666" 
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickFormatter={(v) => `${v}R`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a24', 
                      border: '1px solid #2a2a35',
                      borderRadius: '8px'
                    }}
                    labelFormatter={(label) => {
                      const d = new Date(label + '-01');
                      return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'r') return [`${value.toFixed(2)}R`, 'Total R'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="r" radius={[4, 4, 0, 0]}>
                    {monthlyReturns.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.r >= 0 ? '#22C55E' : '#EF4444'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Extended Stats */}
      <div className="grid grid-cols-3 gap-6">
        {/* Performance Details */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target size={20} className="text-text-muted" />
            Performance Details
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-text-muted">Expectancy</span>
              <span className={clsx(
                'font-semibold',
                stats.expectancy >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
              )}>
                {stats.expectancy.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Sharpe Ratio</span>
              <span className="font-semibold text-text-primary">{stats.sharpeRatio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Max Drawdown</span>
              <span className="font-semibold text-pnl-negative">{stats.maxDrawdown.toFixed(2)}R</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Trading Days</span>
              <span className="font-semibold text-text-primary">{stats.tradingDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Avg Trades/Day</span>
              <span className="font-semibold text-text-primary">{stats.avgTradesPerDay.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Streaks */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-text-muted" />
            Streaks
          </h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-pnl-positive/10 rounded-lg">
              <div className="text-sm text-text-muted mb-1">Längste Win Streak</div>
              <div className="text-2xl font-bold text-pnl-positive">{stats.longestWinStreak}</div>
            </div>
            <div className="p-4 bg-pnl-negative/10 rounded-lg">
              <div className="text-sm text-text-muted mb-1">Längste Lose Streak</div>
              <div className="text-2xl font-bold text-pnl-negative">{stats.longestLoseStreak}</div>
            </div>
          </div>
        </div>

        {/* Best/Worst Days */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-text-muted" />
            Extreme Tage
          </h3>
          
          <div className="space-y-4">
            {stats.bestDay && (
              <div className="p-4 bg-pnl-positive/10 rounded-lg">
                <div className="text-sm text-text-muted mb-1">Bester Tag</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">
                    {new Date(stats.bestDay.date).toLocaleDateString('de-DE')}
                  </span>
                  <span className="text-xl font-bold text-pnl-positive">
                    +{stats.bestDay.r.toFixed(1)}R
                  </span>
                </div>
              </div>
            )}
            {stats.worstDay && (
              <div className="p-4 bg-pnl-negative/10 rounded-lg">
                <div className="text-sm text-text-muted mb-1">Schlechtester Tag</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">
                    {new Date(stats.worstDay.date).toLocaleDateString('de-DE')}
                  </span>
                  <span className="text-xl font-bold text-pnl-negative">
                    {stats.worstDay.r.toFixed(1)}R
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
