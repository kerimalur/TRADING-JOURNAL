/**
 * ========================================================================
 * Trading Journal - Dashboard (Combined with Analytics)
 * ========================================================================
 */

import { useEffect, useState, useMemo } from 'react';
import { 
  Calendar,
  Plus,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Download,
  Target,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useAnalyticsStore, type TimeFilter } from '@/stores/analyticsStore';
import { useUIStore } from '@/stores/uiStore';
import { generateReportHTML, printReport, saveReportAsHTML } from '@/utils/reportGenerator';
import { clsx } from 'clsx';
import type { Trade } from '@/types';

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

interface CalendarDay {
  date: string;
  result: 'win' | 'loss' | 'mixed' | null;
  dayNum: number;
  isToday: boolean;
  trades: Trade[];
  totalR: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { loadTrades, trades } = useTradeStore();
  const { loadConfigs, configs } = useAccountStore();
  const { 
    timeFilter, 
    setTimeFilter, 
    customDateRange,
    setCustomDateRange,
    accountFilter,
    setAccountFilter,
    getDateRange,
    calculatePerformance,
    calculateMonthlyReturns,
    calculateEquityCurve
  } = useAnalyticsStore();
  const { showToast } = useUIStore();
  
  const [greeting, setGreeting] = useState('');
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [showCustomRange, setShowCustomRange] = useState(false);

  useEffect(() => {
    loadTrades();
    loadConfigs();
    
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Guten Morgen');
    else if (hour < 18) setGreeting('Guten Tag');
    else setGreeting('Guten Abend');
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
  const monthlyReturns = useMemo(() => calculateMonthlyReturns(filteredTrades), [filteredTrades, calculateMonthlyReturns]);
  const equityCurve = useMemo(() => 
    calculateEquityCurve(filteredTrades, configs?.ek?.initialStartBalance || 10000), 
    [filteredTrades, configs, calculateEquityCurve]
  );

  // Account balances
  const ekBalance = configs?.ek?.currentBalance || 0;
  const fundedBalance = configs?.funded?.currentBalance || 0;
  const totalBalance = ekBalance + fundedBalance;

  // Recent trades (last 5, filtered by account)
  const recentTrades = useMemo(() => {
    return [...filteredTrades]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [filteredTrades]);

  // Calculate total profit in CHF
  const totalProfitCHF = useMemo(() => {
    return filteredTrades.reduce((sum, t) => {
      const activeConfig = configs?.[t.type];
      const accountBalance = activeConfig?.currentBalance || 10000;
      const riskAmount = t.riskAmount || (accountBalance * (t.riskPercent || 1) / 100);
      return sum + (riskAmount * t.rMultiple);
    }, 0);
  }, [filteredTrades, configs]);

  // Calendar data - last 21 days with today marker (filtered by account)
  const todayStr = new Date().toISOString().split('T')[0];
  
  const calendarData = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();
    
    // Filter trades by account for calendar
    const accountTrades = trades.filter(t => 
      accountFilter === 'all' || t.type === accountFilter
    );
    
    for (let i = 20; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTrades = accountTrades.filter(t => t.date === dateStr && t.sessionType === 'live');
      let result: 'win' | 'loss' | 'mixed' | null = null;
      const totalR = dayTrades.reduce((sum, t) => sum + t.rMultiple, 0);
      
      if (dayTrades.length > 0) {
        const wins = dayTrades.filter(t => t.result === 'win').length;
        const losses = dayTrades.filter(t => t.result === 'loss').length;
        
        if (wins > 0 && losses > 0) result = 'mixed';
        else if (wins > 0) result = 'win';
        else if (losses > 0) result = 'loss';
      }
      
      days.push({ 
        date: dateStr, 
        result, 
        dayNum: date.getDate(),
        isToday: dateStr === todayStr,
        trades: dayTrades,
        totalR
      });
    }
    
    return days;
  }, [trades, accountFilter]);

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
    const currentBalance = accountFilter === 'all' 
      ? totalBalance 
      : accountFilter === 'ek' 
        ? ekBalance 
        : fundedBalance;
        
    const html = generateReportHTML({
      title: 'Performance Report',
      dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats: { ...stats, currentBalance },
      trades: filteredTrades,
      equityCurve,
      monthlyReturns,
    });
    
    printReport(html);
    showToast('Report wird gedruckt...', 'info');
  };

  const handleSaveHTML = async () => {
    const range = getDateRange();
    const currentBalance = accountFilter === 'all' 
      ? totalBalance 
      : accountFilter === 'ek' 
        ? ekBalance 
        : fundedBalance;
        
    const html = generateReportHTML({
      title: 'Performance Report',
      dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats: { ...stats, currentBalance },
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary mb-1">Dashboard</h1>
          <p className="text-sm text-text-muted">{greeting}, Trader</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Account Filter */}
          <select 
            className="select w-32"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value as 'all' | 'ek' | 'funded')}
          >
            <option value="all">Alle Konten</option>
            <option value="ek">Eigenkapital</option>
            <option value="funded">Funded</option>
          </select>
          
          {/* Export Buttons */}
          <button onClick={handleExportPDF} className="btn-secondary" title="Drucken">
            <Printer size={16} />
          </button>
          <button onClick={handleSaveHTML} className="btn-secondary" title="Export HTML">
            <Download size={16} />
          </button>
          
          <button 
            onClick={() => navigate('/ek')} 
            className="btn-primary"
          >
            <Plus size={16} />
            Add Trade
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
        
        {/* Date Range Indicator */}
        <div className="ml-auto flex items-center gap-2 text-sm bg-background-surface px-4 py-2 rounded-lg border border-border">
          <Calendar size={16} className="text-accent-primary" />
          <span className="text-text-muted">Zeitraum:</span>
          <span className="font-semibold text-text-primary">
            {(() => {
              const range = getDateRange();
              const startDate = new Date(range.start);
              const endDate = new Date(range.end);
              
              return `${startDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - ${endDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}`;
            })()}
          </span>
          <span className="text-xs text-text-muted">
            ({filteredTrades.length} Trades)
          </span>
        </div>
      </div>

      {/* Main Stats Grid - 6 columns */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Kontostand</div>
          <div className="text-xl font-semibold tabular-nums text-text-primary">
            {(accountFilter === 'all' ? totalBalance : accountFilter === 'ek' ? ekBalance : fundedBalance).toLocaleString('de-DE', { minimumFractionDigits: 0 })} CHF
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Gewinn/Verlust</div>
          <div className={clsx(
            'text-xl font-semibold tabular-nums font-mono',
            totalProfitCHF >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
          )}>
            {totalProfitCHF >= 0 ? '+' : ''}{totalProfitCHF.toLocaleString('de-DE', { minimumFractionDigits: 0 })} CHF
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Total R</div>
          <div className={clsx(
            'text-xl font-semibold tabular-nums font-mono',
            stats.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
          )}>
            {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(1)}R
          </div>
          <div className="text-xs text-text-muted mt-1">{stats.totalTrades} Trades</div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Win Rate</div>
          <div className="text-xl font-semibold tabular-nums text-text-primary">
            {stats.winRate.toFixed(0)}%
          </div>
          <div className="text-xs text-text-muted mt-1">
            {Math.round(stats.winRate * stats.totalTrades / 100)}W / {stats.totalTrades - Math.round(stats.winRate * stats.totalTrades / 100)}L
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Profit Factor</div>
          <div className="text-xl font-semibold tabular-nums text-text-primary">
            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          </div>
        </div>
        
        <div className="stat-card">
          <div className="text-xs text-text-muted mb-2">Max Drawdown</div>
          <div className="text-xl font-semibold tabular-nums text-pnl-negative">
            {stats.maxDrawdown.toFixed(1)}R
          </div>
        </div>
      </div>

      {/* Second Row - Performance Details + Recent Trades + Calendar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Performance Details */}
        <div className="card">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Target size={16} className="text-text-muted" />
            Performance Details
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Expectancy</span>
              <span className={clsx(
                'font-semibold font-mono',
                stats.expectancy >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
              )}>
                {stats.expectancy.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Sharpe Ratio</span>
              <span className="font-semibold font-mono text-text-primary">{stats.sharpeRatio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Avg Win</span>
              <span className="font-semibold font-mono text-pnl-positive">+{stats.avgWin.toFixed(2)}R</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Avg Loss</span>
              <span className="font-semibold font-mono text-pnl-negative">-{stats.avgLoss.toFixed(2)}R</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Trading Tage</span>
              <span className="font-semibold text-text-primary">{stats.tradingDays}</span>
            </div>
            
            <div className="pt-3 border-t border-border">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-pnl-positive/10 rounded-lg text-center">
                  <div className="text-xs text-text-muted">Win Streak</div>
                  <div className="text-lg font-bold text-pnl-positive">{stats.longestWinStreak}</div>
                </div>
                <div className="p-2 bg-pnl-negative/10 rounded-lg text-center">
                  <div className="text-xs text-text-muted">Lose Streak</div>
                  <div className="text-lg font-bold text-pnl-negative">{stats.longestLoseStreak}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-text-primary">Recent Trades</span>
            <button 
              onClick={() => navigate(accountFilter === 'funded' ? '/funded' : '/ek')}
              className="text-xs text-accent-primary hover:underline"
            >
              Alle anzeigen
            </button>
          </div>
          
          <div className="space-y-2">
            {recentTrades.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">
                Keine Trades im Zeitraum
              </div>
            ) : (
              recentTrades.map((trade) => {
                const activeConfig = configs?.[trade.type];
                const accountBalance = activeConfig?.currentBalance || 10000;
                const riskAmount = trade.riskAmount || (accountBalance * (trade.riskPercent || 1) / 100);
                const profitAmount = trade.profitAmount || (riskAmount * trade.rMultiple);
                
                return (
                  <div key={trade.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium',
                        trade.result === 'win' ? 'bg-pnl-positive-dim text-pnl-positive' :
                        trade.result === 'loss' ? 'bg-pnl-negative-dim text-pnl-negative' :
                        'bg-background-surface text-text-muted'
                      )}>
                        {trade.pair.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          {trade.pair}
                          <span className="ml-1 text-xs text-text-muted">
                            ({trade.type === 'ek' ? 'EK' : 'F'})
                          </span>
                        </div>
                        <div className="text-xs text-text-muted capitalize">{trade.direction}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={clsx(
                        'text-sm tabular-nums font-medium font-mono',
                        trade.rMultiple > 0 ? 'text-pnl-positive' : 
                        trade.rMultiple < 0 ? 'text-pnl-negative' : 'text-text-muted'
                      )}>
                        {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                      </div>
                      <div className={clsx(
                        'text-xs tabular-nums font-mono',
                        profitAmount > 0 ? 'text-pnl-positive' : 
                        profitAmount < 0 ? 'text-pnl-negative' : 'text-text-muted'
                      )}>
                        {profitAmount > 0 ? '+' : ''}{profitAmount.toFixed(0)} CHF
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Calendar Mini */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-text-muted" />
            <span className="text-sm font-medium text-text-primary">Trade Calendar</span>
          </div>
          
          {/* Last 21 Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarData.map((day, i) => (
              <button 
                key={i}
                onClick={() => setSelectedDay(day)}
                className={clsx(
                  'aspect-square rounded flex items-center justify-center text-[10px] tabular-nums cursor-pointer transition-all hover:scale-110',
                  day.result === 'win' ? 'bg-pnl-positive/20 text-pnl-positive hover:bg-pnl-positive/30' :
                  day.result === 'loss' ? 'bg-pnl-negative/20 text-pnl-negative hover:bg-pnl-negative/30' :
                  day.result === 'mixed' ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30' :
                  'bg-background-surface text-text-muted hover:bg-background-surface-hover',
                  day.isToday && 'ring-2 ring-accent-primary ring-offset-1 ring-offset-background-card'
                )}
                title={day.date}
              >
                {day.dayNum}
              </button>
            ))}
          </div>
          
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-pnl-positive" />
              <span className="text-text-muted">Win</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-pnl-negative" />
              <span className="text-text-muted">Loss</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-background-surface" />
              <span className="text-text-muted">No trade</span>
            </div>
          </div>
          
          {/* Best/Worst Day */}
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {stats.bestDay && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Bester Tag</span>
                <span className="text-pnl-positive font-mono font-semibold">+{stats.bestDay.r.toFixed(1)}R</span>
              </div>
            )}
            {stats.worstDay && (
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Schlechtester Tag</span>
                <span className="text-pnl-negative font-mono font-semibold">{stats.worstDay.r.toFixed(1)}R</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Day Popup */}
      {selectedDay && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setSelectedDay(null)}
        >
          <div 
            className="bg-background-card border border-border rounded-xl p-6 w-full max-w-md animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {new Date(selectedDay.date).toLocaleDateString('de-DE', { 
                    weekday: 'long',
                    day: 'numeric', 
                    month: 'long',
                    year: 'numeric'
                  })}
                </h3>
                {selectedDay.isToday && (
                  <span className="text-xs text-accent-primary">Heute</span>
                )}
              </div>
              <button 
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-lg hover:bg-background-surface transition-colors"
              >
                <X size={18} className="text-text-muted" />
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 bg-background-surface rounded-lg text-center">
                <div className="text-xs text-text-muted mb-1">Trades</div>
                <div className="text-xl font-semibold tabular-nums text-text-primary">
                  {selectedDay.trades.length}
                </div>
              </div>
              <div className="p-3 bg-background-surface rounded-lg text-center">
                <div className="text-xs text-text-muted mb-1">Result</div>
                <div className={clsx(
                  'text-xl font-semibold tabular-nums font-mono',
                  selectedDay.totalR > 0 ? 'text-pnl-positive' :
                  selectedDay.totalR < 0 ? 'text-pnl-negative' : 'text-text-muted'
                )}>
                  {selectedDay.totalR > 0 ? '+' : ''}{selectedDay.totalR.toFixed(1)}R
                </div>
              </div>
              <div className="p-3 bg-background-surface rounded-lg text-center">
                <div className="text-xs text-text-muted mb-1">Win Rate</div>
                <div className="text-xl font-semibold tabular-nums text-text-primary">
                  {selectedDay.trades.length > 0 
                    ? Math.round((selectedDay.trades.filter(t => t.result === 'win').length / selectedDay.trades.length) * 100)
                    : 0}%
                </div>
              </div>
            </div>

            {/* Trades List */}
            {selectedDay.trades.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <div className="text-xs text-text-muted mb-2">Trades an diesem Tag:</div>
                {selectedDay.trades.map((trade) => (
                  <div 
                    key={trade.id} 
                    className="flex items-center justify-between p-3 bg-background-surface rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        trade.direction === 'long' ? 'bg-pnl-positive/20' : 'bg-pnl-negative/20'
                      )}>
                        {trade.direction === 'long' 
                          ? <ArrowUpRight size={16} className="text-pnl-positive" />
                          : <ArrowDownRight size={16} className="text-pnl-negative" />
                        }
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          {trade.pair}
                          <span className="ml-1 text-xs text-text-muted">
                            ({trade.type === 'ek' ? 'EK' : 'F'})
                          </span>
                        </div>
                        <div className="text-xs text-text-muted capitalize">{trade.direction}</div>
                      </div>
                    </div>
                    <div className={clsx(
                      'text-sm font-semibold tabular-nums font-mono',
                      trade.rMultiple > 0 ? 'text-pnl-positive' :
                      trade.rMultiple < 0 ? 'text-pnl-negative' : 'text-text-muted'
                    )}>
                      {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Trades an diesem Tag</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-border flex gap-3">
              <button 
                onClick={() => {
                  setSelectedDay(null);
                  navigate('/ek');
                }}
                className="btn-primary flex-1"
              >
                <Plus size={16} />
                Trade hinzufügen
              </button>
              <button 
                onClick={() => {
                  setSelectedDay(null);
                  navigate('/calendar');
                }}
                className="btn-secondary flex-1"
              >
                Kalender öffnen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
