/**
 * ========================================================================
 * Trading Journal - Calendar Page
 * ========================================================================
 * 
 * Trade-Kalender mit:
 * - Monatsansicht mit Trades pro Tag
 * - Farbcodierung (Grün=Gewinn, Rot=Verlust)
 * - Tagesdetails bei Klick
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTradeStore } from '@/stores/tradeStore';
import type { Trade } from '@/types';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

// Hilfsfunktion für Kalenderwoche
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface DayData {
  date: Date;
  trades: Trade[];
  totalR: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function Calendar() {
  const { trades, loadTrades } = useTradeStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'year'>('month');
  const [accountFilter, setAccountFilter] = useState<'all' | 'ek' | 'funded'>('ek');

  useEffect(() => {
    loadTrades();
  }, []);

  // Filter trades by account
  const filteredTrades = useMemo(() => {
    return trades.filter(t => 
      (accountFilter === 'all' || t.type === accountFilter) && 
      t.sessionType === 'live'
    );
  }, [trades, accountFilter]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Monday (0 = Monday, 6 = Sunday)
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    
    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        trades: getTradesForDate(date, filteredTrades),
        totalR: getTotalRForDate(date, filteredTrades),
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      
      days.push({
        date,
        trades: getTradesForDate(date, filteredTrades),
        totalR: getTotalRForDate(date, filteredTrades),
        isCurrentMonth: true,
        isToday: dateOnly.getTime() === today.getTime(),
      });
    }
    
    // Next month days (fill to 42 = 6 weeks)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        trades: getTradesForDate(date, filteredTrades),
        totalR: getTotalRForDate(date, filteredTrades),
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    return days;
  }, [currentDate, filteredTrades]);

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const monthTrades = filteredTrades.filter(t => {
      const tradeDate = new Date(t.date);
      return tradeDate.getFullYear() === year && tradeDate.getMonth() === month;
    });
    
    const wins = monthTrades.filter(t => t.result === 'win').length;
    const losses = monthTrades.filter(t => t.result === 'loss').length;
    const totalR = monthTrades.reduce((sum, t) => sum + t.rMultiple, 0);
    const tradingDays = new Set(monthTrades.map(t => t.date)).size;
    
    return { totalTrades: monthTrades.length, wins, losses, totalR, tradingDays };
  }, [currentDate, filteredTrades]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (viewMode === 'week') {
        newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      } else if (viewMode === 'year') {
        newDate.setFullYear(prev.getFullYear() + (direction === 'next' ? 1 : -1));
      } else {
        newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  // Generate week days for week view
  const weekDays = useMemo(() => {
    const days: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get start of week (Monday)
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      
      days.push({
        date,
        trades: getTradesForDate(date, filteredTrades),
        totalR: getTotalRForDate(date, filteredTrades),
        isCurrentMonth: true,
        isToday: dateOnly.getTime() === today.getTime(),
      });
    }
    
    return days;
  }, [currentDate, filteredTrades]);

  // Generate year data
  const yearData = useMemo(() => {
    const year = currentDate.getFullYear();
    const months: { month: number; trades: Trade[]; totalR: number; wins: number; losses: number }[] = [];
    
    for (let month = 0; month < 12; month++) {
      const monthTrades = filteredTrades.filter(t => {
        const tradeDate = new Date(t.date);
        return tradeDate.getFullYear() === year && tradeDate.getMonth() === month;
      });
      
      months.push({
        month,
        trades: monthTrades,
        totalR: monthTrades.reduce((sum, t) => sum + t.rMultiple, 0),
        wins: monthTrades.filter(t => t.result === 'win').length,
        losses: monthTrades.filter(t => t.result === 'loss').length,
      });
    }
    
    return months;
  }, [currentDate, filteredTrades]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <CalendarIcon className="text-accent-primary" />
          Trade Kalender
        </h1>
        
        <div className="flex items-center gap-4">
          {/* Account Filter */}
          <select 
            className="select w-32"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value as 'all' | 'ek' | 'funded')}
          >
            <option value="ek">Eigenkapital</option>
            <option value="funded">Funded</option>
            <option value="all">Alle Konten</option>
          </select>
          
          {/* View Mode Toggle */}
          <div className="toggle-group">
            {(['week', 'month', 'year'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={clsx('toggle-btn px-4', viewMode === mode && 'active')}
              >
                {mode === 'week' ? 'Woche' : mode === 'month' ? 'Monat' : 'Jahr'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6 stagger-children">
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-text-primary">{monthlyStats.totalTrades}</div>
          <div className="text-sm text-text-muted">Trades</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-pnl-positive">{monthlyStats.wins}</div>
          <div className="text-sm text-text-muted">Wins</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-pnl-negative">{monthlyStats.losses}</div>
          <div className="text-sm text-text-muted">Losses</div>
        </div>
        <div className="stat-card text-center">
          <div className={clsx(
            'text-2xl font-bold font-mono',
            monthlyStats.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
          )}>
            {monthlyStats.totalR >= 0 ? '+' : ''}{monthlyStats.totalR.toFixed(1)}R
          </div>
          <div className="text-sm text-text-muted">Total R</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl font-bold text-accent-primary">{monthlyStats.tradingDays}</div>
          <div className="text-sm text-text-muted">Trading Tage</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Calendar */}
        <div className="glass-card p-4">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigateMonth('prev')}
              className="btn-icon"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="text-center">
              <h2 className="text-xl font-bold text-text-primary">
                {viewMode === 'year' 
                  ? currentDate.getFullYear()
                  : viewMode === 'week'
                  ? `KW ${getWeekNumber(currentDate)} • ${currentDate.getFullYear()}`
                  : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                }
              </h2>
              <button
                onClick={goToToday}
                className="text-sm text-accent-primary hover:underline"
              >
                Heute
              </button>
            </div>
            
            <button
              onClick={() => navigateMonth('next')}
              className="btn-icon"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDay(day)}
                  className={clsx(
                    'p-4 rounded-lg transition-all min-h-[120px] flex flex-col border border-border',
                    day.isToday && 'ring-2 ring-accent-primary',
                    'cursor-pointer hover:ring-2 hover:ring-accent-primary/50 hover:border-accent-primary/30',
                    selectedDay?.date.getTime() === day.date.getTime() && 'ring-2 ring-accent-primary bg-accent-primary/10',
                    'bg-background-surface'
                  )}
                >
                  <div className="text-xs text-text-muted mb-1">{WEEKDAYS[i]}</div>
                  <div className="text-lg font-bold text-text-primary">{day.date.getDate()}</div>
                  
                  {day.trades.length > 0 ? (
                    <div className="mt-auto">
                      <div className={clsx(
                        'text-lg font-bold font-mono',
                        day.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                      )}>
                        {day.totalR >= 0 ? '+' : ''}{day.totalR.toFixed(1)}R
                      </div>
                      <div className="text-xs text-text-muted">{day.trades.length} Trades</div>
                    </div>
                  ) : (
                    <div className="mt-auto text-xs text-text-muted">Kein Trade</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* YEAR VIEW */}
          {viewMode === 'year' && (
            <div className="grid grid-cols-4 gap-4">
              {yearData.map((monthData, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setCurrentDate(new Date(currentDate.getFullYear(), i, 1));
                    setViewMode('month');
                  }}
                  className={clsx(
                    'p-4 rounded-lg bg-glass-white hover:bg-glass-white transition-all text-left',
                    currentDate.getMonth() === i && 'ring-2 ring-accent-primary'
                  )}
                >
                  <div className="font-semibold mb-2">{MONTHS[i].slice(0, 3)}</div>
                  
                  {monthData.trades.length > 0 ? (
                    <>
                      <div className={clsx(
                        'text-xl font-bold',
                        monthData.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                      )}>
                        {monthData.totalR >= 0 ? '+' : ''}{monthData.totalR.toFixed(1)}R
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        {monthData.wins}W / {monthData.losses}L
                      </div>
                    </>
                  ) : (
                    <div className="text-text-muted text-sm">—</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* MONTH VIEW */}
          {viewMode === 'month' && (
            <>
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-text-muted py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    className={clsx(
                      'aspect-square p-2 rounded-lg transition-all relative border',
                      day.isCurrentMonth ? 'text-text-primary border-border' : 'text-text-muted/50 border-transparent',
                      day.isToday && 'ring-2 ring-accent-primary',
                      'cursor-pointer hover:ring-2 hover:ring-accent-primary/50 hover:border-accent-primary/30',
                      selectedDay?.date.getTime() === day.date.getTime() && 'ring-2 ring-accent-primary bg-accent-primary/10',
                      day.trades.length > 0 
                        ? day.totalR >= 0 ? 'bg-pnl-positive/10' : 'bg-pnl-negative/10'
                        : 'bg-background-surface hover:bg-background-surface-hover'
                    )}
                  >
                    <div className="text-sm font-medium">{day.date.getDate()}</div>
                    
                    {day.trades.length > 0 && (
                      <>
                        <div className={clsx(
                          'text-xs font-mono mt-1',
                          day.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                        )}>
                          {day.totalR >= 0 ? '+' : ''}{day.totalR.toFixed(1)}
                        </div>
                        <div className={clsx(
                          'absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full',
                          day.totalR > 0 ? 'bg-pnl-positive' : day.totalR < 0 ? 'bg-pnl-negative' : 'bg-text-muted'
                        )} />
                      </>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Day Details Popup Modal */}
      {selectedDay && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div 
            className="bg-background-card border border-border rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {selectedDay.date.toLocaleDateString('de-DE', { 
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

            {/* Summary Stats */}
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
                {selectedDay.trades.map(trade => (
                  <div
                    key={trade.id}
                    className="p-3 rounded-lg bg-background-surface flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        trade.direction === 'long' ? 'bg-pnl-positive/20' : 'bg-pnl-negative/20'
                      )}>
                        {trade.direction === 'long' ? (
                          <ArrowUpRight className="text-pnl-positive" size={16} />
                        ) : (
                          <ArrowDownRight className="text-pnl-negative" size={16} />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">{trade.pair}</div>
                        <div className="text-xs text-text-muted">
                          {trade.direction.toUpperCase()} • {trade.type.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className={clsx(
                      'text-sm font-semibold tabular-nums font-mono',
                      trade.rMultiple >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                    )}>
                      {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-muted">
                <CalendarIcon size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Keine Trades an diesem Tag</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-border flex gap-3">
              <button 
                onClick={() => {
                  setSelectedDay(null);
                  // Navigate to trade form with date pre-filled
                  const dateStr = selectedDay.date.toISOString().split('T')[0];
                  window.location.hash = `/ek?date=${dateStr}`;
                }}
                className="btn-primary flex-1"
              >
                <Plus size={16} />
                Trade hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTradesForDate(date: Date, trades: Trade[]): Trade[] {
  const dateStr = date.toISOString().split('T')[0];
  return trades.filter(t => t.date === dateStr);
}

function getTotalRForDate(date: Date, trades: Trade[]): number {
  return getTradesForDate(date, trades).reduce((sum, t) => sum + t.rMultiple, 0);
}
