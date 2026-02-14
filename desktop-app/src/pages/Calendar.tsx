/**
 * ========================================================================
 * Trading Journal - Calendar (Heatmap + Detail Panel)
 * ========================================================================
 * GitHub-style heatmap as main view. Click on day shows details
 * in bottom panel (not modal). Month view as alternative.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradeStore } from '@/stores/tradeStore';
import { useNavigate } from 'react-router-dom';
import type { Trade } from '@/types';
import { PageTransition } from '@/components/ui/PageTransition';
import { Heatmap, type HeatmapDay } from '@/components/ui/Heatmap';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { TradeRow } from '@/components/ui/TradeRow';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function Calendar() {
  const navigate = useNavigate();
  const { trades, loadTrades } = useTradeStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'heatmap' | 'month' | 'year'>('month');
  const [accountFilter, setAccountFilter] = useState<'all' | 'ek' | 'funded'>('all');

  useEffect(() => { loadTrades(); }, []);

  const filteredTrades = useMemo(() => {
    return trades.filter(t =>
      (accountFilter === 'all' || t.type === accountFilter) && t.sessionType === 'live'
    );
  }, [trades, accountFilter]);

  // Heatmap data
  const heatmapData = useMemo((): HeatmapDay[] => {
    const dayMap = new Map<string, { totalR: number; count: number }>();
    filteredTrades.forEach(t => {
      const existing = dayMap.get(t.date) || { totalR: 0, count: 0 };
      dayMap.set(t.date, { totalR: existing.totalR + t.rMultiple, count: existing.count + 1 });
    });
    return Array.from(dayMap.entries()).map(([date, d]) => ({
      date, value: d.totalR, trades: d.count,
    }));
  }, [filteredTrades]);

  // Selected day details
  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    const dayTrades = filteredTrades.filter(t => t.date === selectedDate);
    const totalR = dayTrades.reduce((sum, t) => sum + t.rMultiple, 0);
    const wins = dayTrades.filter(t => t.result === 'win').length;
    const winRate = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
    return { trades: dayTrades, totalR, wins, losses: dayTrades.length - wins, winRate };
  }, [selectedDate, filteredTrades]);

  // Month stats
  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthTrades = filteredTrades.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const totalR = monthTrades.reduce((sum, t) => sum + t.rMultiple, 0);
    const wins = monthTrades.filter(t => t.result === 'win').length;
    const tradingDays = new Set(monthTrades.map(t => t.date)).size;
    return { total: monthTrades.length, wins, losses: monthTrades.length - wins, totalR, tradingDays };
  }, [currentDate, filteredTrades]);

  // Year data for year view
  const yearData = useMemo(() => {
    const year = currentDate.getFullYear();
    return Array.from({ length: 12 }, (_, month) => {
      const monthTrades = filteredTrades.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      return {
        month,
        trades: monthTrades.length,
        totalR: monthTrades.reduce((sum, t) => sum + t.rMultiple, 0),
        wins: monthTrades.filter(t => t.result === 'win').length,
        losses: monthTrades.filter(t => t.result === 'loss').length,
      };
    });
  }, [currentDate, filteredTrades]);

  // Month calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean; trades: Trade[]; totalR: number }[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      const dateStr = date.toISOString().split('T')[0];
      const dayTrades = filteredTrades.filter(t => t.date === dateStr);
      days.push({ date, dateStr, isCurrentMonth: false, isToday: false, trades: dayTrades, totalR: dayTrades.reduce((s, t) => s + t.rMultiple, 0) });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      const dateStr = date.toISOString().split('T')[0];
      const dayTrades = filteredTrades.filter(t => t.date === dateStr);
      days.push({ date, dateStr, isCurrentMonth: true, isToday: dateStr === today, trades: dayTrades, totalR: dayTrades.reduce((s, t) => s + t.rMultiple, 0) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      const dateStr = date.toISOString().split('T')[0];
      const dayTrades = filteredTrades.filter(t => t.date === dateStr);
      days.push({ date, dateStr, isCurrentMonth: false, isToday: false, trades: dayTrades, totalR: dayTrades.reduce((s, t) => s + t.rMultiple, 0) });
    }
    return days;
  }, [currentDate, filteredTrades]);

  const navigateMonth = (dir: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'year') d.setFullYear(d.getFullYear() + (dir === 'next' ? 1 : -1));
      else d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
      return d;
    });
    setSelectedDate(null);
  };

  return (
    <PageTransition>
      <div className="page-container space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="page-title text-lg">
            <CalendarIcon size={20} className="text-accent-primary" />
            Trade Kalender
          </h1>
          <div className="flex items-center gap-2">
            <select className="select w-28 text-xs py-1.5" value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value as 'all' | 'ek' | 'funded')}>
              <option value="all">Alle</option>
              <option value="ek">EK</option>
              <option value="funded">Funded</option>
            </select>
            <div className="toggle-group text-xs">
              {(['heatmap', 'month', 'year'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={clsx('toggle-btn px-3 py-1 text-xs', viewMode === mode && 'active')}>
                  {mode === 'heatmap' ? 'Heatmap' : mode === 'month' ? 'Monat' : 'Jahr'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="flex items-center gap-6 px-1">
          <MetricDisplay label="Trades" value={monthStats.total} size="sm" />
          <MetricDisplay label="Total R" value={monthStats.totalR} format="R" showSign size="sm"
            trend={monthStats.totalR >= 0 ? 'up' : 'down'} />
          <MetricDisplay label="Win Rate" value={monthStats.total > 0 ? (monthStats.wins / monthStats.total) * 100 : 0}
            format="percent" size="sm" />
          <div className="text-[10px] text-text-muted ml-auto font-mono">
            {monthStats.tradingDays} Trading Tage
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* HEATMAP VIEW */}
          {viewMode === 'heatmap' && (
            <div className="rounded-xl border border-border bg-background-card p-5">
              <Heatmap
                data={heatmapData}
                weeks={26}
                colorMode="pnl"
                onDayClick={(day) => setSelectedDate(day.date)}
              />
            </div>
          )}

          {/* MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="rounded-xl border border-border bg-background-card p-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigateMonth('prev')} className="btn-icon w-8 h-8">
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <h2 className="text-base font-bold text-text-primary">
                    {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <button onClick={() => setCurrentDate(new Date())} className="text-[10px] text-accent-primary hover:underline">
                    Heute
                  </button>
                </div>
                <button onClick={() => navigateMonth('next')} className="btn-icon w-8 h-8">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-text-muted py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, i) => (
                  <button key={i} onClick={() => setSelectedDate(day.dateStr)}
                    className={clsx(
                      'min-h-[72px] p-2 rounded-lg transition-all relative text-left flex flex-col',
                      day.isCurrentMonth ? 'text-text-primary' : 'text-text-muted/30',
                      day.isToday && 'ring-2 ring-accent-primary',
                      selectedDate === day.dateStr && 'ring-2 ring-accent-primary bg-accent-primary/10',
                      day.trades.length > 0
                        ? day.totalR >= 0 ? 'bg-pnl-positive/10' : 'bg-pnl-negative/10'
                        : 'bg-background-surface hover:bg-background-surface-hover',
                      'cursor-pointer hover:ring-1 hover:ring-accent-primary/30'
                    )}>
                    <div className="text-sm font-medium">{day.date.getDate()}</div>
                    {day.trades.length > 0 && (
                      <>
                        <div className={clsx(
                          'text-xs font-mono font-bold mt-1',
                          day.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                        )}>
                          {day.totalR >= 0 ? '+' : ''}{day.totalR.toFixed(1)}R
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {day.trades.length} Trade{day.trades.length !== 1 ? 's' : ''}
                        </div>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* YEAR VIEW */}
          {viewMode === 'year' && (
            <div className="rounded-xl border border-border bg-background-card p-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigateMonth('prev')} className="btn-icon w-8 h-8">
                  <ChevronLeft size={16} />
                </button>
                <h2 className="text-base font-bold text-text-primary">{currentDate.getFullYear()}</h2>
                <button onClick={() => navigateMonth('next')} className="btn-icon w-8 h-8">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {yearData.map((m) => (
                  <button key={m.month} onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), m.month, 1)); setViewMode('month'); }}
                    className={clsx(
                      'p-3 rounded-lg text-left transition-all border border-border',
                      currentDate.getMonth() === m.month && 'ring-2 ring-accent-primary',
                      'hover:border-border-light cursor-pointer',
                      m.trades > 0 ? (m.totalR >= 0 ? 'bg-pnl-positive/5' : 'bg-pnl-negative/5') : 'bg-background-surface'
                    )}>
                    <div className="text-xs font-semibold text-text-muted">{MONTHS[m.month]}</div>
                    {m.trades > 0 ? (
                      <>
                        <div className={clsx('text-lg font-bold font-mono', m.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {m.totalR >= 0 ? '+' : ''}{m.totalR.toFixed(1)}R
                        </div>
                        <div className="text-[10px] text-text-muted">{m.wins}W / {m.losses}L</div>
                      </>
                    ) : (
                      <div className="text-sm text-text-muted/40 mt-1">—</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DETAIL PANEL (Bottom, not modal) */}
          <AnimatePresence>
            {selectedDate && selectedDayData && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="rounded-xl border border-border bg-background-card p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">
                    {new Date(selectedDate).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={() => navigate('/ek')} className="btn-primary btn-sm">
                      <Plus size={12} /> Trade
                    </button>
                    <button onClick={() => setSelectedDate(null)} className="btn-ghost btn-sm text-text-muted">
                      Schliessen
                    </button>
                  </div>
                </div>

                <div className="flex gap-6 mb-3">
                  <MetricDisplay label="Trades" value={selectedDayData.trades.length} size="sm" />
                  <MetricDisplay label="Result" value={selectedDayData.totalR} format="R" showSign size="sm"
                    trend={selectedDayData.totalR >= 0 ? 'up' : 'down'} />
                  <MetricDisplay label="Win Rate" value={selectedDayData.winRate} format="percent" size="sm" />
                </div>

                {selectedDayData.trades.length > 0 ? (
                  <div className="border-t border-border pt-2 space-y-0 max-h-48 overflow-y-auto">
                    {selectedDayData.trades.map(trade => (
                      <TradeRow key={trade.id} trade={trade} showAccount showDate={false} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-text-muted">Keine Trades an diesem Tag</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
