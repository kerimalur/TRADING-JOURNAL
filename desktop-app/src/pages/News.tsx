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
  Clock, 
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Filter,
  Globe
} from 'lucide-react';
import { clsx } from 'clsx';
import { getApi } from '@/services/webApi';

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

// Fallback Events für den Fall dass API nicht verfügbar ist
const FALLBACK_EVENTS: EconomicEvent[] = [];

const SAMPLE_NEWS: NewsArticle[] = [
  {
    id: '1',
    title: 'Fed Signals Potential Rate Cut in March',
    summary: 'Federal Reserve officials have indicated they may continue cutting interest rates as inflation cools toward 2% target.',
    source: 'Reuters',
    url: 'https://reuters.com',
    publishedAt: new Date().toISOString(),
    relatedCurrencies: ['USD'],
  },
  {
    id: '2',
    title: 'ECB Continues Rate Cuts Amid Weak Growth',
    summary: 'The European Central Bank cut rates again as eurozone growth remains sluggish.',
    source: 'Bloomberg',
    url: 'https://bloomberg.com',
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    relatedCurrencies: ['EUR'],
  },
  {
    id: '3',
    title: 'BoJ Normalizes Policy - Rates at 0.5%',
    summary: 'Bank of Japan continues policy normalization, raising rates to highest level since 2008.',
    source: 'FXStreet',
    url: 'https://fxstreet.com',
    publishedAt: new Date(Date.now() - 7200000).toISOString(),
    relatedCurrencies: ['JPY'],
  },
];

export function News() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [news] = useState<NewsArticle[]>(SAMPLE_NEWS);
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

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Newspaper className="text-accent-primary" />
            News & Wirtschaftskalender
          </h1>
          <p className="text-sm text-text-muted mt-1 flex items-center gap-2">
            <Clock size={14} />
            Daten-Stand: {lastUpdate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            {dataSource === 'scheduled' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-pnl-positive/20 text-pnl-positive">
                GEPLANTE EVENTS
              </span>
            )}
            {dataSource === 'fxstreet' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-blue/20 text-accent-blue">
                FXStreet
              </span>
            )}
            {dataSource === 'investing' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-gold/20 text-accent-gold">
                Investing.com
              </span>
            )}
            <span className="text-text-muted">• {events.length} Events</span>
          </p>
        </div>
        <button 
          onClick={loadCalendar}
          disabled={isLoading}
          className="btn-secondary"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Laden...' : 'Aktualisieren'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('calendar')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-all',
            activeTab === 'calendar'
              ? 'bg-accent-gold text-background'
              : 'bg-background-surface-hover text-text-muted hover:text-text-primary'
          )}
        >
          <Calendar size={18} className="inline mr-2" />
          Wirtschaftskalender
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-all',
            activeTab === 'news'
              ? 'bg-accent-gold text-background'
              : 'bg-background-surface-hover text-text-muted hover:text-text-primary'
          )}
        >
          <Globe size={18} className="inline mr-2" />
          Marktnews
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-text-muted" />
            <span className="text-sm text-text-muted">Währungen:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {CURRENCIES.map(currency => (
              <button
                key={currency}
                onClick={() => toggleCurrency(currency)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  selectedCurrencies.includes(currency)
                    ? 'bg-accent-gold text-background'
                    : 'bg-background-surface-hover text-text-muted hover:text-text-primary'
                )}
              >
                {currency}
              </button>
            ))}
          </div>
          
          {activeTab === 'calendar' && (
            <>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">Impact:</span>
                <select
                  value={impactFilter}
                  onChange={(e) => setImpactFilter(e.target.value as 'all' | 'high' | 'medium')}
                  className="select text-sm py-1"
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
              className="text-sm text-accent-primary hover:underline"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Economic Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {Object.keys(eventsByDate).length === 0 ? (
            <div className="card text-center py-16">
              <Calendar size={64} className="mx-auto text-text-muted/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Keine Events gefunden</h3>
              <p className="text-text-muted">Passe deine Filter an, um Events zu sehen.</p>
            </div>
          ) : (
            Object.entries(eventsByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, dayEvents]) => (
                <div key={date} className="card">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-accent-primary" />
                    {formatDate(date)}
                    <span className="text-sm font-normal text-text-muted ml-2">({date})</span>
                  </h3>
                  
                  <div className="space-y-2">
                    {dayEvents
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map(event => (
                        <div
                          key={event.id}
                          className={clsx(
                            'p-4 rounded-lg border-l-4 bg-background-surface-hover',
                            IMPACT_COLORS[event.impact].border
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Clock size={14} className="text-text-muted" />
                                <span className="font-mono text-sm">{event.time}</span>
                              </div>
                              
                              <span className="px-2 py-1 rounded bg-background-surface text-sm font-semibold">
                                {event.currency}
                              </span>
                              
                              <span className={clsx(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                IMPACT_COLORS[event.impact].bg,
                                IMPACT_COLORS[event.impact].text
                              )}>
                                {event.impact === 'high' ? 'HIGH' : event.impact === 'medium' ? 'MED' : 'LOW'}
                              </span>
                            </div>
                            
                            {event.impact === 'high' && (
                              <AlertTriangle size={18} className="text-pnl-negative animate-pulse" />
                            )}
                          </div>
                          
                          <h4 className="font-semibold mt-2">{event.event}</h4>
                          
                          {(event.forecast || event.previous || event.actual) && (
                            <div className="flex gap-6 mt-2 text-sm">
                              {event.actual && (
                                <div>
                                  <span className="text-text-muted">Actual: </span>
                                  <span className="font-semibold text-pnl-positive">{event.actual}</span>
                                </div>
                              )}
                              {event.forecast && (
                                <div>
                                  <span className="text-text-muted">Forecast: </span>
                                  <span className="font-semibold">{event.forecast}</span>
                                </div>
                              )}
                              {event.previous && (
                                <div>
                                  <span className="text-text-muted">Previous: </span>
                                  <span className="text-text-muted">{event.previous}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* News Tab */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          {filteredNews.length === 0 ? (
            <div className="card text-center py-16">
              <Newspaper size={64} className="mx-auto text-text-muted/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Keine News gefunden</h3>
              <p className="text-text-muted">Passe deine Filter an, um News zu sehen.</p>
            </div>
          ) : (
            filteredNews.map(article => (
              <div key={article.id} className="card hover:bg-glass-white transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-text-muted">{article.source}</span>
                      <span className="text-text-muted">•</span>
                      <span className="text-sm text-text-muted">{getTimeAgo(article.publishedAt)}</span>
                      <div className="flex gap-1 ml-2">
                        {article.relatedCurrencies.map(c => (
                          <span key={c} className="px-1.5 py-0.5 text-xs bg-accent-gold/20 text-accent-primary rounded">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-2">{article.title}</h3>
                    <p className="text-text-muted">{article.summary}</p>
                  </div>
                  
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-background-surface rounded-lg transition-colors"
                  >
                    <ExternalLink size={18} className="text-text-muted" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-background-surface rounded-lg border border-border text-sm text-text-muted">
        <h4 className="font-semibold text-text-primary mb-2">Datenquellen</h4>
        <p>
          Die Wirtschaftsdaten stammen aus öffentlichen Quellen. Für Echtzeit-Daten empfehlen wir:
        </p>
        <div className="flex gap-4 mt-2">
          <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
            ForexFactory Calendar
          </a>
          <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
            Investing.com
          </a>
          <a href="https://www.myfxbook.com/forex-economic-calendar" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
            MyFxBook
          </a>
        </div>
      </div>
    </div>
  );
}
