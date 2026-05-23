/**
 * ========================================================================
 * Trading Journal - Wirtschaftskalender (ForexFactory)
 * ========================================================================
 * Tag-Navigation: Vor / Heute / Weiter
 * ========================================================================
 */

import { useState, useEffect } from 'react';
import {
  Calendar,
  AlertTriangle,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { getApi } from '@/services/webApi';
import { PageTransition } from '@/components/ui/PageTransition';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TYPES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface EconomicEvent {
  id: string;
  date: string;       // 'YYYY-MM-DD'
  time: string;
  currency: string;
  impact: 'low' | 'medium' | 'high';
  event: string;
  actual?: string;
  forecast?: string;
  previous?: string;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];

function toIsoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return toIsoDate(d);
}

function formatDayLabel(dateStr: string) {
  const today = toIsoDate(new Date());
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  if (dateStr === today)     return 'Heute';
  if (dateStr === tomorrow)  return 'Morgen';
  if (dateStr === yesterday) return 'Gestern';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const staggerItem = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// COMPONENT
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function News() {
  const today = toIsoDate(new Date());

  const [allEvents, setAllEvents]                   = useState<EconomicEvent[]>([]);
  const [selectedDate, setSelectedDate]             = useState<string>(today);
  const [isLoading, setIsLoading]                   = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [impactFilter, setImpactFilter]             = useState<'all' | 'high' | 'medium'>('all');
  const [lastUpdate, setLastUpdate]                 = useState<Date>(new Date());
  const [dataSource, setDataSource]                 = useState<string>('loading');

  useEffect(() => {
    const todayStr = toIsoDate(new Date());
    const lastLoad = localStorage.getItem('ff_calendar_last_load_date');
    if (lastLoad !== todayStr) {
      loadCalendar().then(() => {
        localStorage.setItem('ff_calendar_last_load_date', todayStr);
      });
    } else {
      loadCalendar();
    }
  }, []);

  const loadCalendar = async () => {
    setIsLoading(true);
    try {
      const api = getApi();
      if (api.fetchEconomicCalendar) {
        const result = await api.fetchEconomicCalendar();
        if (result.success) {
          const events: EconomicEvent[] = (result.data || []).map((item: any, idx: number) => ({
            id:       item.id || `ff-${idx}`,
            date:     item.date,
            time:     item.time || 'All Day',
            currency: item.currency || item.country || '–',
            impact:   (item.impact || 'low') as 'high' | 'medium' | 'low',
            event:    item.event || item.title || '–',
            forecast: item.forecast,
            previous: item.previous,
            actual:   item.actual,
          }));
          setAllEvents(events);
          setDataSource(result.cached ? 'cache' : (result.source || 'forexfactory'));
          setLastUpdate(new Date());
        } else {
          setDataSource('offline');
        }
      } else {
        setDataSource('offline');
      }
    } catch (err) {
      console.error('Kalender Fehler:', err);
      setDataSource('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-Refresh alle 5 Minuten – holt aktualisierte Ist-Werte für bereits veröffentlichte Events
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const api = getApi();
        if (!api.fetchEconomicCalendar) return;
        const result = await api.fetchEconomicCalendar();
        if (result.success && result.data) {
          setAllEvents(result.data.map((item: any, idx: number) => ({
            id:       item.id || `ff-${idx}`,
            date:     item.date,
            time:     item.time || 'All Day',
            currency: item.currency || item.country || '–',
            impact:   (item.impact || 'low') as 'high' | 'medium' | 'low',
            event:    item.event || item.title || '–',
            forecast: item.forecast,
            previous: item.previous,
            actual:   item.actual,
          })));
          setLastUpdate(new Date());
        }
      } catch { /* silent */ }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const navigateDay = (delta: number) => {
    setSelectedDate(prev => addDays(prev, delta));
  };

  const dayEvents = allEvents
    .filter(e => {
      if (e.date !== selectedDate) return false;
      if (selectedCurrencies.length > 0 && !selectedCurrencies.includes(e.currency)) return false;
      if (impactFilter === 'high'   && e.impact !== 'high') return false;
      if (impactFilter === 'medium' && e.impact === 'low')  return false;
      return true;
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const toggleCurrency = (c: string) =>
    setSelectedCurrencies(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  return (
    <PageTransition>
      <div className="page-container">

        {/* â”€â”€ Header â”€â”€ */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-1">Markt</p>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Wirtschaftskalender
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-white/50">
              <span className="font-mono tabular-nums">
                {lastUpdate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {dataSource === 'forexfactory' && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium bg-green-500/15 text-green-400">
                  ForexFactory
                </span>
              )}
              {dataSource === 'cache' && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium bg-white/10 text-white/50">
                  Cache
                </span>
              )}
              {(dataSource === 'offline' || dataSource === 'error') && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium bg-red-500/15 text-red-400">
                  Offline
                </span>
              )}
              <span className="font-mono tabular-nums text-white/40">{allEvents.length} Events geladen</span>
            </div>
          </div>

          <button
            onClick={loadCalendar}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white/60 hover:text-white hover:bg-white/[0.08] transition-all disabled:opacity-40"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            {isLoading ? 'Laden...' : 'Aktualisieren'}
          </button>
        </div>

        {/* â”€â”€ Tag-Navigation â”€â”€ */}
        <div className="flex items-center justify-between mb-5 py-3 px-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <button
            onClick={() => navigateDay(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline text-xs text-white/50">{formatDayLabel(addDays(selectedDate, -1))}</span>
          </button>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-base font-semibold text-white">{formatDayLabel(selectedDate)}</span>
            <span className="text-[11px] font-mono text-white/40 tabular-nums">{selectedDate}</span>
          </div>

          <div className="flex items-center gap-2">
            {selectedDate !== today && (
              <button
                onClick={() => setSelectedDate(today)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 transition-all"
              >
                Heute
              </button>
            )}
            <button
              onClick={() => navigateDay(1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <span className="hidden sm:inline text-xs text-white/50">{formatDayLabel(addDays(selectedDate, 1))}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* â”€â”€ Filter Bar â”€â”€ */}
        <div className="flex items-center gap-3 flex-wrap mb-5 py-2 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
          <Filter size={12} className="text-white/40 flex-shrink-0" />
          <div className="flex gap-1 flex-wrap">
            {CURRENCIES.map(c => (
              <button
                key={c}
                onClick={() => toggleCurrency(c)}
                className={clsx(
                  'px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold transition-all',
                  selectedCurrencies.includes(c)
                    ? 'bg-accent-primary text-white'
                    : 'bg-white/[0.05] text-white/50 hover:text-white hover:bg-white/[0.10]'
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-white/[0.06]" />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-white/40">Impact</span>
            <select
              value={impactFilter}
              onChange={e => setImpactFilter(e.target.value as 'all' | 'high' | 'medium')}
              className="bg-white/[0.05] border border-white/[0.08] rounded-md text-xs text-white px-1.5 py-0.5 focus:outline-none"
            >
              <option value="all">Alle</option>
              <option value="medium">Medium &amp; High</option>
              <option value="high">Nur High</option>
            </select>
          </div>
          {selectedCurrencies.length > 0 && (
            <button
              onClick={() => setSelectedCurrencies([])}
              className="text-[10px] uppercase tracking-wide text-accent-primary hover:underline ml-auto"
            >
              Reset
            </button>
          )}
        </div>

        {/* â”€â”€ Events â”€â”€ */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-white/40">
            <RefreshCw size={20} className="animate-spin mr-2" />
            <span className="text-sm">Lade Daten von ForexFactory…</span>
          </div>
        ) : dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Calendar size={40} className="text-white/20 mb-3" />
            <p className="text-sm font-medium text-white/50">Keine Events für {formatDayLabel(selectedDate)}</p>
            <p className="text-[11px] text-white/30 mt-1">
              {allEvents.length === 0
                ? 'Daten werden geladen. Klicke auf „Aktualisieren".'  
                : 'Kein Ereignis an diesem Tag oder Filter zu eng.'}
            </p>
          </div>
        ) : (
          <motion.div
            key={selectedDate}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {/* Tages-Zusammenfassung */}
            <div className="flex items-center gap-3 mb-4 text-xs text-white/40">
              <span className="tabular-nums font-mono">{dayEvents.length} Events</span>
              <span>·</span>
              <span className="text-red-400 font-medium">{dayEvents.filter(e => e.impact === 'high').length} High</span>
              <span>·</span>
              <span className="text-yellow-400">{dayEvents.filter(e => e.impact === 'medium').length} Medium</span>
              <span>·</span>
              <span>{dayEvents.filter(e => e.impact === 'low').length} Low</span>
            </div>

            {dayEvents.map(event => (
              <motion.div
                key={event.id}
                variants={staggerItem}
                className={clsx(
                  'flex items-start gap-4 px-4 py-3 rounded-xl border transition-colors',
                  event.impact === 'high'
                    ? 'bg-red-500/[0.07] border-red-500/25 hover:bg-red-500/[0.11]'
                    : event.impact === 'medium'
                    ? 'bg-yellow-500/[0.05] border-yellow-500/20 hover:bg-yellow-500/[0.09]'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                )}
              >
                {/* Impact-Punkt */}
                <div className="flex flex-col items-center gap-1.5 pt-1 flex-shrink-0 w-3">
                  <span className={clsx(
                    'w-2 h-2 rounded-full',
                    event.impact === 'high'   && 'bg-red-400',
                    event.impact === 'medium' && 'bg-yellow-400',
                    event.impact === 'low'    && 'bg-white/20',
                  )} />
                  {event.impact === 'high' && (
                    <AlertTriangle size={11} className="text-red-400/70" />
                  )}
                </div>

                {/* Zeit + Währung */}
                <div className="flex flex-col items-center gap-1 w-14 flex-shrink-0 pt-0.5">
                  <span className="font-mono tabular-nums text-xs text-white/60">{event.time}</span>
                  <span className={clsx(
                    'text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded',
                    event.impact === 'high'   ? 'bg-red-500/20 text-red-300'      :
                    event.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-white/[0.08] text-white/55',
                  )}>
                    {event.currency}
                  </span>
                </div>

                {/* Event-Name + Zahlen */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx(
                      'text-sm font-semibold leading-snug',
                      event.impact === 'high'   ? 'text-white'    :
                      event.impact === 'medium' ? 'text-white/90' : 'text-white/70',
                    )}>
                      {event.event}
                    </span>
                    <span className={clsx(
                      'text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                      event.impact === 'high'   ? 'bg-red-500/20 text-red-300'      :
                      event.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                  'bg-white/[0.08] text-white/35',
                    )}>
                      {event.impact === 'high' ? 'HIGH' : event.impact === 'medium' ? 'MED' : 'LOW'}
                    </span>
                  </div>

                  {(event.forecast || event.previous || event.actual) && (
                    <div className="flex gap-5 mt-1.5 text-xs flex-wrap">
                      {event.actual && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase tracking-wide text-white/40">Ist</span>
                          <span className="font-mono tabular-nums font-semibold text-green-400">{event.actual}</span>
                        </div>
                      )}
                      {event.forecast && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase tracking-wide text-white/40">Prog</span>
                          <span className="font-mono tabular-nums font-semibold text-white/80">{event.forecast}</span>
                        </div>
                      )}
                      {event.previous && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] uppercase tracking-wide text-white/40">Vor</span>
                          <span className="font-mono tabular-nums text-white/50">{event.previous}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

      </div>
    </PageTransition>
  );
}
