/**
 * ========================================================================
 * Trading Journal - News Page
 * ========================================================================
 *
 * Wirtschaftsnachrichten und Events von offiziellen Quellen:
 * - ForexFactory Economic Calendar
 * - Investing.com News
 * - Central Bank Calendars
 */

import { useState, useEffect } from 'react';
import {
  Newspaper,
  Calendar,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Filter,
  Globe
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { getApi } from '@/services/webApi';
import { PageTransition } from '@/components/ui/PageTransition';

// Wirtschafts-Event Typen
interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  currency: string;
  impact: 'low' | 'medium' | 'high';
  event: string;
  actual?: string;
  forecast?: string;
  previous?: string;
}

// News-Artikel Typen
interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  relatedCurrencies: string[];
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];

const IMPACT_COLORS = {
  low: { bg: 'bg-accent-blue/20', text: 'text-accent-blue', border: 'border-accent-blue' },
  medium: { bg: 'bg-accent-gold/20', text: 'text-accent-primary', border: 'border-accent-gold' },
  high: { bg: 'bg-pnl-negative/20', text: 'text-pnl-negative', border: 'border-pnl-negative' },
};

const FALLBACK_EVENTS: EconomicEvent[] = [];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

export function News() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [news] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [activeTab, setActiveTab] = useState<'calendar' | 'news'>('calendar');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [dataSource, setDataSource] = useState<string>('loading');

  // Lade Wirtschaftskalender beim Start
  useEffect(() => {
    loadCalendar();
  }, []);

  const loadCalendar = async () => {
    setIsLoading(true);

    try {
      const api = getApi();
      // Nutze unified API für Wirtschaftskalender
      if (api.fetchEconomicCalendar) {
        console.log('📅 Fetching economic calendar...');
        const result = await api.fetchEconomicCalendar();

        if (result.success && result.data) {
          // Konvertiere Daten ins richtige Format
          let calendarEvents: EconomicEvent[] = [];

          if (result.source === 'scheduled') {
            // Scheduled Events kommen bereits im richtigen Format
            calendarEvents = result.data.map((item: any, index: number) => ({
              id: item.id || `sched-${index}`,
              date: item.date,
              time: item.time || '00:00',
              currency: item.currency,
              impact: item.impact as 'high' | 'medium' | 'low',
              event: item.event,
              forecast: item.forecast,
              previous: item.previous,
              actual: item.actual,
            }));
          } else if (result.source === 'forexfactory') {
            // Forex Factory Format
            calendarEvents = result.data.map((item: any, index: number) => ({
              id: item.id || `ff-${index}`,
              date: item.date,
              time: item.time || 'All Day',
              currency: item.currency,
              impact: item.impact as 'high' | 'medium' | 'low',
              event: item.event,
              forecast: item.forecast,
              previous: item.previous,
              actual: item.actual,
            }));
          } else if (result.source === 'fxstreet' || result.source === 'investing') {
            // Konvertiere von externem Format
            calendarEvents = result.data.map((item: any, index: number) => ({
              id: item.id || `event-${index}`,
              date: item.date || item.dateUtc?.split('T')[0],
              time: item.time || item.dateUtc?.split('T')[1]?.substring(0, 5) || '00:00',
              currency: item.currency || item.countryCode,
              impact: item.impact || (item.volatility === 3 ? 'high' : item.volatility === 2 ? 'medium' : 'low'),
              event: item.event || item.name,
              forecast: item.forecast,
              previous: item.previous,
              actual: item.actual,
            }));
          } else {
            // Web API format (Firefox Factory XML parsed)
            calendarEvents = result.data.map((item: any, index: number) => ({
              id: `event-${index}`,
              date: item.date,
              time: item.time || '00:00',
              currency: item.country,
              impact: item.impact as 'high' | 'medium' | 'low',
              event: item.title,
              forecast: item.forecast,
              previous: item.previous,
            }));
          }

          setEvents(calendarEvents);
          setDataSource(result.source || 'api');
          setLastUpdate(new Date());
          console.log(`✅ Calendar loaded: ${calendarEvents.length} events from ${result.source}`);
        }
      } else {
        console.log('⚠️ Electron API not available, using fallback');
        setEvents(FALLBACK_EVENTS);
        setDataSource('fallback');
      }
    } catch (error) {
      console.error('Calendar load error:', error);
      setEvents(FALLBACK_EVENTS);
      setDataSource('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    if (selectedCurrencies.length > 0 && !selectedCurrencies.includes(event.currency)) {
      return false;
    }
    if (impactFilter !== 'all' && event.impact !== impactFilter) {
      return false;
    }
    return true;
  });

  // Filter news
  const filteredNews = news.filter(article => {
    if (selectedCurrencies.length > 0) {
      return article.relatedCurrencies.some(c => selectedCurrencies.includes(c));
    }
    return true;
  });

  // Group events by date
  const eventsByDate = filteredEvents.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, EconomicEvent[]>);

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies(prev =>
      prev.includes(currency)
        ? prev.filter(c => c !== currency)
        : [...prev, currency]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Heute';
    }
    if (dateStr === tomorrow.toISOString().split('T')[0]) {
      return 'Morgen';
    }
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `vor ${diffMins} Min.`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    const diffDays = Math.floor(diffHours / 24);
    return `vor ${diffDays} Tagen`;
  };

  const impactDot = (impact: 'low' | 'medium' | 'high') => (
    <span className={clsx(
      'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
      impact === 'high' && 'bg-pnl-negative',
      impact === 'medium' && 'bg-accent-gold',
      impact === 'low' && 'bg-accent-blue',
    )} />
  );

  return (
    <PageTransition>
    <div className="page-container">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-1">Market Intelligence</p>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            News & Wirtschaftskalender
          </h1>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted">
            <span className="font-mono tabular-nums">
              {lastUpdate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {dataSource === 'scheduled' && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.06em] font-medium bg-pnl-positive/10 text-pnl-positive">
                Scheduled
              </span>
            )}
            {dataSource === 'fxstreet' && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.06em] font-medium bg-accent-blue/10 text-accent-blue">
                FXStreet
              </span>
            )}
            {dataSource === 'investing' && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.06em] font-medium bg-accent-gold/10 text-accent-gold">
                Investing.com
              </span>
            )}
            <span className="font-mono tabular-nums">{events.length} events</span>
          </div>
        </div>

        <button
          onClick={loadCalendar}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all disabled:opacity-40"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Laden...' : 'Aktualisieren'}
        </button>
      </div>

      {/* ── Segment Control (pill tabs) ── */}
      <div className="inline-flex items-center rounded-full bg-white/[0.03] p-0.5 mb-5">
        <button
          onClick={() => setActiveTab('calendar')}
          className={clsx(
            'relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all',
            activeTab === 'calendar'
              ? 'bg-accent-gold text-background shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Calendar size={13} />
          Wirtschaftskalender
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={clsx(
            'relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all',
            activeTab === 'news'
              ? 'bg-accent-gold text-background shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          <Globe size={13} />
          Marktnews
        </button>
      </div>

      {/* ── Compact Filter Bar ── */}
      <div className="flex items-center gap-3 flex-wrap mb-6 py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
        <Filter size={12} className="text-text-muted flex-shrink-0" />
        <div className="flex gap-1 flex-wrap">
          {CURRENCIES.map(currency => (
            <button
              key={currency}
              onClick={() => toggleCurrency(currency)}
              className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.06em] font-medium transition-all',
                selectedCurrencies.includes(currency)
                  ? 'bg-accent-gold text-background'
                  : 'bg-white/[0.04] text-text-muted hover:text-text-primary hover:bg-white/[0.08]'
              )}
            >
              {currency}
            </button>
          ))}
        </div>

        {activeTab === 'calendar' && (
          <>
            <div className="w-px h-4 bg-white/[0.06]" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.08em] text-text-muted">Impact</span>
              <select
                value={impactFilter}
                onChange={(e) => setImpactFilter(e.target.value as 'all' | 'high' | 'medium')}
                className="bg-white/[0.04] border border-white/[0.06] rounded-md text-[11px] text-text-primary px-1.5 py-0.5 focus:outline-none"
              >
                <option value="all">Alle</option>
                <option value="high">Nur High Impact</option>
                <option value="medium">Medium & High</option>
              </select>
            </div>
          </>
        )}

        {selectedCurrencies.length > 0 && (
          <button
            onClick={() => setSelectedCurrencies([])}
            className="text-[10px] uppercase tracking-[0.08em] text-accent-primary hover:underline ml-auto"
          >
            Reset
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          CALENDAR TAB  -  Vertical Timeline
         ══════════════════════════════════════════════════ */}
      {activeTab === 'calendar' && (
        <div>
          {Object.keys(eventsByDate).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Calendar size={40} className="text-text-muted/30 mb-3" />
              <p className="text-sm font-medium text-text-muted">Keine Events gefunden</p>
              <p className="text-[11px] text-text-muted/60 mt-1">Passe deine Filter an, um Events zu sehen.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {Object.entries(eventsByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, dayEvents]) => (
                  <div key={date}>
                    {/* ── Sticky Day Divider ── */}
                    <div className="sticky top-0 z-10 flex items-center gap-3 py-2 mb-1 bg-background/80 backdrop-blur-sm">
                      <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-accent-primary">
                        {formatDate(date)}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-text-muted">{date}</span>
                      <div className="flex-1 h-px bg-white/[0.04]" />
                      <span className="text-[10px] tabular-nums text-text-muted">{dayEvents.length}</span>
                    </div>

                    {/* ── Timeline Events ── */}
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="show"
                      className="relative ml-4 border-l border-white/[0.06] pl-6 pb-6"
                    >
                      {dayEvents
                        .sort((a, b) => a.time.localeCompare(b.time))
                        .map((event) => (
                          <motion.div
                            key={event.id}
                            variants={staggerItem}
                            className="relative group mb-3 last:mb-0"
                          >
                            {/* Timeline dot */}
                            <span className={clsx(
                              'absolute -left-[30.5px] top-2.5 w-2 h-2 rounded-full ring-2 ring-background',
                              event.impact === 'high' && 'bg-pnl-negative',
                              event.impact === 'medium' && 'bg-accent-gold',
                              event.impact === 'low' && 'bg-accent-blue',
                            )} />

                            <div className="flex items-start gap-4 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                              {/* Left column: time + currency */}
                              <div className="flex flex-col items-center gap-1 w-16 flex-shrink-0 pt-0.5">
                                <span className="font-mono tabular-nums text-xs text-text-muted">{event.time}</span>
                                <span className="text-[10px] uppercase tracking-[0.08em] font-semibold px-1.5 py-0.5 rounded bg-white/[0.06] text-text-primary">
                                  {event.currency}
                                </span>
                              </div>

                              {/* Right column: event details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {impactDot(event.impact)}
                                  <span className="text-sm font-medium text-text-primary truncate">{event.event}</span>
                                  {event.impact === 'high' && (
                                    <AlertTriangle size={12} className="text-pnl-negative animate-pulse flex-shrink-0" />
                                  )}
                                  <span className={clsx(
                                    'ml-auto text-[9px] uppercase tracking-[0.1em] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
                                    IMPACT_COLORS[event.impact].bg,
                                    IMPACT_COLORS[event.impact].text,
                                  )}>
                                    {event.impact === 'high' ? 'HIGH' : event.impact === 'medium' ? 'MED' : 'LOW'}
                                  </span>
                                </div>

                                {(event.forecast || event.previous || event.actual) && (
                                  <div className="flex gap-5 mt-1.5 text-[11px]">
                                    {event.actual && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Act</span>
                                        <span className="font-mono tabular-nums font-semibold text-pnl-positive">{event.actual}</span>
                                      </div>
                                    )}
                                    {event.forecast && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Fcst</span>
                                        <span className="font-mono tabular-nums font-semibold text-text-primary">{event.forecast}</span>
                                      </div>
                                    )}
                                    {event.previous && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Prev</span>
                                        <span className="font-mono tabular-nums text-text-muted">{event.previous}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                    </motion.div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          NEWS TAB  -  Feed / Ticker Style
         ══════════════════════════════════════════════════ */}
      {activeTab === 'news' && (
        <div>
          {filteredNews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Newspaper size={40} className="text-text-muted/30 mb-3" />
              <p className="text-sm font-medium text-text-muted">Keine News gefunden</p>
              <p className="text-[11px] text-text-muted/60 mt-1">Passe deine Filter an, um News zu sehen.</p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="divide-y divide-white/[0.04]"
            >
              {filteredNews.map(article => (
                <motion.div
                  key={article.id}
                  variants={staggerItem}
                  className="group flex items-center gap-4 py-3 px-3 -mx-1 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  {/* Source icon placeholder */}
                  <div className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-bold uppercase text-text-muted">
                      {article.source.charAt(0)}
                    </span>
                  </div>

                  {/* Time ago */}
                  <span className="font-mono tabular-nums text-[10px] text-text-muted w-20 flex-shrink-0">
                    {getTimeAgo(article.publishedAt)}
                  </span>

                  {/* Title + summary */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{article.title}</p>
                    <p className="text-[11px] text-text-muted/70 truncate mt-0.5">{article.summary}</p>
                  </div>

                  {/* Currency badges */}
                  <div className="flex gap-1 flex-shrink-0">
                    {article.relatedCurrencies.map(c => (
                      <span key={c} className="px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] font-semibold bg-accent-gold/10 text-accent-primary rounded-full">
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Source name + link */}
                  <span className="text-[10px] text-text-muted/50 w-16 text-right flex-shrink-0 hidden sm:block">
                    {article.source}
                  </span>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <ExternalLink size={12} className="text-text-muted" />
                  </a>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* ── Data Sources (subtle footer) ── */}
      <div className="mt-10 pt-4 border-t border-white/[0.04]">
        <p className="text-[10px] uppercase tracking-[0.1em] text-text-muted/40 mb-2">Datenquellen</p>
        <p className="text-[11px] text-text-muted/40 leading-relaxed">
          Die Wirtschaftsdaten stammen aus öffentlichen Quellen. Für Echtzeit-Daten empfehlen wir:
        </p>
        <div className="flex gap-4 mt-1.5">
          <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-muted/40 hover:text-accent-primary transition-colors">
            ForexFactory Calendar
          </a>
          <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-muted/40 hover:text-accent-primary transition-colors">
            Investing.com
          </a>
          <a href="https://www.myfxbook.com/forex-economic-calendar" target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-muted/40 hover:text-accent-primary transition-colors">
            MyFxBook
          </a>
        </div>
      </div>

    </div>
    </PageTransition>
  );
}
