/**
 * ========================================================================
 * Trading Journal - COT Data Page (Market Intelligence Design)
 * ========================================================================
 *
 * Commitment of Traders Daten per Währung (nicht per Pair):
 * - EUR, USD, GBP, JPY, CAD, AUD, NZD, CHF
 * - Nur Commercials (Smart Money)
 * - Echte CFTC API Integration
 * - Automatische Empfehlungen
 */

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  Database,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ArrowRightLeft,
  Edit3,
  X,
  Save
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { getApi } from '@/services/webApi';
import { PageTransition } from '@/components/ui/PageTransition';
import { BentoGrid, BentoCell } from '@/components/ui/BentoGrid';
import { MetricDisplay } from '@/components/ui/MetricDisplay';

// Währungen und ihre CFTC Codes
// Reihenfolge: Dollar Index, Euro FX, Swiss Franc, British Pound, JPY, CAD, AUD, NZD
const CURRENCIES = [
  { id: 'DXY', name: 'DXY',  cftcCode: '098662', flag: '🇺🇸' },
  { id: 'EUR', name: 'EUR',  cftcCode: '099741', flag: '🇪🇺' },
  { id: 'CHF', name: 'CHF',  cftcCode: '092741', flag: '🇨🇭' },
  { id: 'GBP', name: 'GBP',  cftcCode: '096742', flag: '🇬🇧' },
  { id: 'JPY', name: 'JPY',  cftcCode: '097741', flag: '🇯🇵' },
  { id: 'CAD', name: 'CAD',  cftcCode: '090741', flag: '🇨🇦' },
  { id: 'AUD', name: 'AUD',  cftcCode: '232741', flag: '🇦🇺' },
  { id: 'NZD', name: 'NZD',  cftcCode: '112741', flag: '🇳🇿' },
];

interface CurrencyCOT {
  currency: string;
  date: string;
  commercialsLong: number;
  commercialsShort: number;
  commercialsNet: number;
  weeklyChange: number;
  percentileRank: number;
  signal: 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short';
}

interface COTHistory {
  date: string;
  net: number;
}

export function COTData() {
  const [cotData, setCotData] = useState<CurrencyCOT[]>([]);
  const [historyData, setHistoryData] = useState<Map<string, COTHistory[]>>(new Map());
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'cache' | 'manual' | 'none'>('none');

  // Manual Input States
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputData, setManualInputData] = useState<Record<string, { long: string; short: string }>>({});

  useEffect(() => {
    loadData();
  }, []);

  // Lade Daten: Erst Cache prüfen, dann ggf. frische Daten holen
  const loadData = async () => {
    try {
      const cached = localStorage.getItem('cotData');
      const cachedHistory = localStorage.getItem('cotHistory');
      const cachedDate = localStorage.getItem('cotLastUpdate');

      if (cached && cachedDate) {
        const lastUpdateDate = new Date(cachedDate);
        const now = new Date();

        // Prüfe ob Cache-Daten noch aktuell sind (weniger als 7 Tage alt)
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24));
        const isStale = daysSinceUpdate >= 7;

        // Lade gecachte Daten sofort (für schnelle Anzeige)
        setCotData(JSON.parse(cached));

        // Lade und konvertiere history (unterstützt altes und neues Format)
        if (cachedHistory) {
          const rawHistory = JSON.parse(cachedHistory) as Record<string, any[]>;
          const convertedHistory = new Map<string, COTHistory[]>();
          Object.entries(rawHistory).forEach(([currency, entries]) => {
            convertedHistory.set(currency, entries.map((e: any) => ({
              date: e.date,
              // Unterstütze beide Formate: net (alt) oder commercialsLong/Short (neu)
              net: e.net ?? (e.commercialsLong - e.commercialsShort)
            })));
          });
          setHistoryData(convertedHistory);
        }

        setLastUpdate(lastUpdateDate);

        // Prüfe ob manuell eingegeben
        const cachedSource = localStorage.getItem('cotDataSource');
        setDataSource(cachedSource === 'manual' ? 'manual' : 'cache');

        // Wenn veraltet UND nicht manuell, lade automatisch neue Daten
        if (isStale && cachedSource !== 'manual') {
          await fetchCOTData();
        }
      } else {
        // Kein Cache vorhanden - lade direkt von der API
        await fetchCOTData();
      }
    } catch (err) {
      console.error('Error loading COT data:', err);
      setError('Fehler beim Laden der COT-Daten');
    }
  };

  const fetchCOTData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApi();
      // Nutze unified API für CORS-freien Zugriff auf CFTC
      if (api.fetchCOTData) {
        console.log('📊 Fetching COT data...');
        const result = await api.fetchCOTData();

        if (result.success && result.data) {
          // Web API returns different format than Electron
          const dataArray = Array.isArray(result.data) ? result.data :
            Object.entries(result.data).map(([currency, data]: [string, any]) => ({
              currency,
              ...data
            }));

          setCotData(dataArray as CurrencyCOT[]);

          // Konvertiere history: Backend sendet commercialsLong/Short, UI braucht net
          if (result.history) {
            const convertedHistory = new Map<string, COTHistory[]>();
            Object.entries(result.history).forEach(([currency, entries]) => {
              convertedHistory.set(currency, (entries as any[]).map(e => ({
                date: e.date,
                net: e.commercialsLong - e.commercialsShort
              })));
            });
            setHistoryData(convertedHistory);
          }

          setLastUpdate(new Date());
          setDataSource('live');

          // Cache speichern
          localStorage.setItem('cotData', JSON.stringify(result.data));
          localStorage.setItem('cotHistory', JSON.stringify(result.history || {}));
          localStorage.setItem('cotLastUpdate', new Date().toISOString());
          localStorage.removeItem('cotDataSource'); // Live-Daten überschreiben manuelle

          console.log(`✅ COT data loaded`);
        } else {
          setError(result.error || 'Keine COT-Daten erhalten. CFTC Server möglicherweise nicht erreichbar.');
        }
      } else {
        // Fallback für Browser-Entwicklung (ohne Electron)
        setError('COT-Daten sind nur in der Desktop-App verfügbar. Bitte starte die App über "npm run electron:dev".');
      }
    } catch (err) {
      console.error('COT fetch error:', err);
      setError('Fehler beim Laden der COT-Daten. Bitte Internetverbindung prüfen.');
    } finally {
      setIsLoading(false);
    }
  };

  // Öffne manuelles Eingabe-Modal mit aktuellen oder leeren Werten
  const openManualInput = () => {
    const initialData: Record<string, { long: string; short: string }> = {};
    CURRENCIES.filter(c => c.id !== 'USD').forEach(currency => {
      const existing = cotData.find(d => d.currency === currency.id);
      initialData[currency.id] = {
        long: existing?.commercialsLong?.toString() || '',
        short: existing?.commercialsShort?.toString() || ''
      };
    });
    setManualInputData(initialData);
    setShowManualInput(true);
  };

  // Speichere manuell eingegebene COT-Daten
  const saveManualData = () => {
    const manualCotData: CurrencyCOT[] = [];
    const today = new Date().toISOString().split('T')[0];

    Object.entries(manualInputData).forEach(([currencyId, values]) => {
      const long = parseInt(values.long) || 0;
      const short = parseInt(values.short) || 0;
      const net = long - short;

      // Einfache Perzentil-Berechnung basierend auf Net-Position
      // Positiv = bullish (höheres Perzentil), Negativ = bearish
      let percentileRank = 50;
      let signal: CurrencyCOT['signal'] = 'neutral';

      // Verhältnis-basierte Signal-Berechnung
      const total = long + short;
      if (total > 0) {
        const longRatio = long / total;
        if (longRatio >= 0.6) {
          signal = 'strong_long';
          percentileRank = 85;
        } else if (longRatio >= 0.55) {
          signal = 'long';
          percentileRank = 70;
        } else if (longRatio <= 0.4) {
          signal = 'strong_short';
          percentileRank = 15;
        } else if (longRatio <= 0.45) {
          signal = 'short';
          percentileRank = 30;
        }
      }

      manualCotData.push({
        currency: currencyId,
        date: today,
        commercialsLong: long,
        commercialsShort: short,
        commercialsNet: net,
        weeklyChange: 0,
        percentileRank,
        signal
      });
    });

    // Speichern in State und LocalStorage
    setCotData(manualCotData);
    setLastUpdate(new Date());
    setDataSource('manual');
    setShowManualInput(false);

    localStorage.setItem('cotData', JSON.stringify(manualCotData));
    localStorage.setItem('cotLastUpdate', new Date().toISOString());
    localStorage.setItem('cotDataSource', 'manual');

    console.log('✅ Manuell eingegebene COT-Daten gespeichert');
  };

  const sortedCurrencies = useMemo(() => {
    return [...cotData].sort((a, b) => {
      const signalOrder = { strong_long: 2, long: 1, neutral: 0, short: -1, strong_short: -2 };
      return signalOrder[b.signal] - signalOrder[a.signal];
    });
  }, [cotData]);

  const pairRecommendations = useMemo(() => {
    const recommendations: { pair: string; direction: string; strength: number; reason: string }[] = [];

    for (let i = 0; i < sortedCurrencies.length; i++) {
      for (let j = i + 1; j < sortedCurrencies.length; j++) {
        const curr1 = sortedCurrencies[i];
        const curr2 = sortedCurrencies[j];

        const signalValue = (s: CurrencyCOT['signal']) => {
          return { strong_long: 2, long: 1, neutral: 0, short: -1, strong_short: -2 }[s];
        };

        const diff = signalValue(curr1.signal) - signalValue(curr2.signal);

        if (Math.abs(diff) >= 2) {
          const isLong = diff > 0;
          let pair = '';
          let direction = '';

          if (curr1.currency === 'USD' || curr2.currency === 'USD') {
            if (curr1.currency === 'USD') {
              pair = `USD/${curr2.currency}`;
              direction = isLong ? 'LONG' : 'SHORT';
            } else {
              pair = `${curr1.currency}/USD`;
              direction = isLong ? 'LONG' : 'SHORT';
            }
          } else {
            pair = `${curr1.currency}/${curr2.currency}`;
            direction = isLong ? 'LONG' : 'SHORT';
          }

          recommendations.push({
            pair,
            direction,
            strength: Math.abs(diff),
            reason: `${curr1.currency}: ${curr1.signal.replace('_', ' ').toUpperCase()} | ${curr2.currency}: ${curr2.signal.replace('_', ' ').toUpperCase()}`
          });
        }
      }
    }

    return recommendations.sort((a, b) => b.strength - a.strength).slice(0, 6);
  }, [sortedCurrencies]);

  const getSignalColor = (signal: CurrencyCOT['signal']) => {
    switch (signal) {
      case 'strong_long': return '#22c55e';
      case 'long': return '#86efac';
      case 'neutral': return '#9ca3af';
      case 'short': return '#fca5a5';
      case 'strong_short': return '#ef4444';
    }
  };

  const getSignalLabel = (signal: CurrencyCOT['signal']) => {
    switch (signal) {
      case 'strong_long': return 'STARK LONG';
      case 'long': return 'LONG';
      case 'neutral': return 'NEUTRAL';
      case 'short': return 'SHORT';
      case 'strong_short': return 'STARK SHORT';
    }
  };

  const selectedHistory = selectedCurrency ? historyData.get(selectedCurrency) || [] : [];
  const selectedData = cotData.find(d => d.currency === selectedCurrency);
  const selectedCurrencyInfo = CURRENCIES.find(c => c.id === selectedCurrency);

  // Berechne nächsten Freitag (CFTC veröffentlicht freitags)
  const getNextCOTRelease = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(21, 30, 0, 0); // CFTC veröffentlicht ca. 21:30 CET
    return nextFriday;
  };

  const nextRelease = getNextCOTRelease();
  const isDataFresh = lastUpdate && (new Date().getTime() - lastUpdate.getTime()) < 7 * 24 * 60 * 60 * 1000;

  return (
    <PageTransition>
    <div className="page-container">

      {/* ── Compact Header Bar ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Database size={18} className="text-accent-primary" />
          <h1 className="text-base font-semibold tracking-tight text-text-primary">Market Intelligence</h1>
          <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium bg-white/[0.04] px-2 py-0.5 rounded">
            COT Commercials
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Pills */}
          {lastUpdate && cotData.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-text-muted mr-2">
              <span className="font-mono tabular-nums">{cotData[0]?.date}</span>
              {dataSource === 'cache' && <span className="text-text-muted bg-white/[0.04] px-1.5 py-0.5 rounded">Cache</span>}
              {dataSource === 'live' && <span className="text-pnl-positive bg-pnl-positive/10 px-1.5 py-0.5 rounded">Live</span>}
              {dataSource === 'manual' && <span className="text-accent-gold bg-accent-gold/10 px-1.5 py-0.5 rounded">Manuell</span>}
              {isDataFresh && dataSource === 'live' && <CheckCircle2 size={10} className="text-pnl-positive" />}
            </div>
          )}

          <a
            href="https://www.cftc.gov/dea/futures/deacmesf.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-accent-primary flex items-center gap-1 px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
          >
            CFTC <ExternalLink size={10} />
          </a>

          <button
            onClick={openManualInput}
            className="text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary flex items-center gap-1 px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            title="COT-Daten manuell eingeben (offline)"
          >
            <Edit3 size={10} />
            Manuell
          </button>

          <button
            onClick={fetchCOTData}
            disabled={isLoading}
            className="text-[10px] uppercase tracking-[0.1em] text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={10} className={clsx(isLoading && 'animate-spin')} />
            {isLoading ? 'Laden...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Compact Error State ── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-3 bg-pnl-negative/5 border border-pnl-negative/20 rounded-lg"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="text-pnl-negative flex-shrink-0 mt-0.5" size={14} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-pnl-negative font-medium">{error}</p>
              <ul className="text-[10px] text-text-muted mt-1 flex gap-3">
                <li>Internetverbindung prüfen</li>
                <li>Später erneut versuchen</li>
                <li>VPN deaktivieren</li>
              </ul>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={fetchCOTData}
                  disabled={isLoading}
                  className="text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary flex items-center gap-1 px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <RefreshCw size={10} className={clsx(isLoading && 'animate-spin')} />
                  Erneut versuchen
                </button>
                <a
                  href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary flex items-center gap-1 px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                >
                  <ExternalLink size={10} />
                  CFTC Webseite
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Compact Info Banner ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-4 px-3 py-2 bg-accent-gold/5 border border-accent-gold/15 rounded-lg flex items-center gap-2"
      >
        <AlertCircle className="text-accent-gold flex-shrink-0" size={12} />
        <p className="text-[10px] text-text-muted leading-relaxed">
          <span className="text-accent-gold font-semibold uppercase tracking-[0.05em]">COT Report</span>{' '}
          Veröffentlichung jeden <strong className="text-text-secondary">Freitag 21:30 CET</strong> (Daten vom Dienstag).{' '}
          <span className="font-mono tabular-nums text-accent-gold">Nächste: {nextRelease.toLocaleDateString('de-DE')}</span>
        </p>
      </motion.div>

      {/* ── Loading State ── */}
      {isLoading && cotData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-accent-primary mb-3" />
          <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Lade COT-Daten von der CFTC...</p>
        </div>
      )}

      {/* ── No Data State ── */}
      {!isLoading && cotData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle size={24} className="text-pnl-negative mb-3" />
          <p className="text-xs text-text-primary font-medium mb-1">Keine COT-Daten verfügbar</p>
          <p className="text-[10px] text-text-muted mb-3">Klicke auf "Refresh" um die Daten von der CFTC zu laden.</p>
          <button
            onClick={fetchCOTData}
            disabled={isLoading}
            className="text-[10px] uppercase tracking-[0.1em] text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors"
          >
            <RefreshCw size={10} />
            Daten laden
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      {cotData.length > 0 && (
      <>

        {/* ── Horizontal Bar Visualization ── */}
        <BentoGrid cols={2} className="mb-4">
          {CURRENCIES.map((currency, idx) => {
            const data = cotData.find(d => d.currency === currency.id);
            const isSelected = selectedCurrency === currency.id;
            const total = data ? data.commercialsLong + data.commercialsShort : 1;
            const longPct = data ? (data.commercialsLong / total) * 100 : 50;
            const shortPct = data ? (data.commercialsShort / total) * 100 : 50;

            return (
              <BentoCell
                key={currency.id}
                delay={idx * 0.04}
                className={clsx(
                  'cursor-pointer !p-0 overflow-hidden group',
                  isSelected && 'ring-1 ring-accent-primary/60'
                )}
              >
                <button
                  onClick={() => setSelectedCurrency(isSelected ? null : currency.id)}
                  className="w-full h-full text-left p-3"
                >
                  {/* Top row: Currency ID + Signal Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-primary tracking-wide">{currency.id}</span>
                      {data && (
                        <span className="font-mono tabular-nums text-[10px] text-text-muted">
                          {data.commercialsNet >= 0 ? '+' : ''}{data.commercialsNet.toLocaleString('de-DE')}
                        </span>
                      )}
                    </div>
                    {data && (
                      <span
                        className="text-[9px] uppercase tracking-[0.1em] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `${getSignalColor(data.signal)}15`,
                          color: getSignalColor(data.signal)
                        }}
                      >
                        {getSignalLabel(data.signal)}
                      </span>
                    )}
                  </div>

                  {data ? (
                    <>
                      {/* Horizontal Stacked Bar */}
                      <div className="relative w-full h-5 rounded overflow-hidden bg-white/[0.02] mb-2">
                        {/* Long bar (from left) */}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${longPct}%` }}
                          transition={{ duration: 0.6, delay: idx * 0.04, ease: 'easeOut' }}
                          className="absolute left-0 top-0 h-full rounded-l"
                          style={{ backgroundColor: '#22c55e', opacity: 0.6 }}
                        />
                        {/* Short bar (from right) */}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${shortPct}%` }}
                          transition={{ duration: 0.6, delay: idx * 0.04, ease: 'easeOut' }}
                          className="absolute right-0 top-0 h-full rounded-r"
                          style={{ backgroundColor: '#ef4444', opacity: 0.6 }}
                        />
                        {/* Center divider */}
                        <div className="absolute left-1/2 top-0 w-px h-full bg-white/20 z-10" />
                        {/* Long label */}
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono tabular-nums text-white/80 z-10">
                          {data.commercialsLong.toLocaleString('de-DE')}
                        </span>
                        {/* Short label */}
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono tabular-nums text-white/80 z-10">
                          {data.commercialsShort.toLocaleString('de-DE')}
                        </span>
                      </div>

                      {/* Bottom stats row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase tracking-[0.1em] text-text-muted">Chg</span>
                          <span className={clsx(
                            'font-mono tabular-nums text-[10px] flex items-center gap-0.5',
                            data.weeklyChange >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                          )}>
                            {data.weeklyChange >= 0 ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
                            {data.weeklyChange >= 0 ? '+' : ''}{data.weeklyChange.toLocaleString('de-DE')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase tracking-[0.1em] text-text-muted">P</span>
                          <div className="w-12 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${data.percentileRank}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.04 + 0.2 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: getSignalColor(data.signal) }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-[10px] text-text-muted">{data.percentileRank}%</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-text-muted uppercase tracking-[0.1em]">Keine Daten</div>
                  )}
                </button>
              </BentoCell>
            );
          })}
        </BentoGrid>

        {/* ── Selected Currency Detail (Full Width Chart) ── */}
        {selectedCurrency && selectedData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-4 rounded-xl border border-border bg-background-card overflow-hidden"
          >
            {/* Compact Stats Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <span className="text-lg">{selectedCurrencyInfo?.flag}</span>
                <div>
                  <span className="text-xs font-bold text-text-primary tracking-wide">{selectedCurrencyInfo?.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted ml-2">Net Position 52W</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <MetricDisplay
                  label="Long"
                  value={selectedData.commercialsLong}
                  size="sm"
                  className="items-end"
                />
                <MetricDisplay
                  label="Short"
                  value={selectedData.commercialsShort}
                  size="sm"
                  className="items-end"
                />
                <MetricDisplay
                  label="Net"
                  value={selectedData.commercialsNet}
                  size="sm"
                  showSign
                  className="items-end"
                />
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-56 px-2 py-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString('de-DE', { month: 'short' })}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.15)"
                    tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }}
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15,15,15,0.95)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '6px',
                      fontSize: '11px',
                    }}
                    formatter={(value: number) => [value.toLocaleString('de-DE'), 'Net']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('de-DE')}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke={getSignalColor(selectedData.signal)}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {/* ── Pair Recommendations ── */}
        {pairRecommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="mb-4 rounded-xl border border-border bg-background-card p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft size={12} className="text-accent-primary" />
              <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-text-muted">Pair Empfehlungen</span>
              <span className="text-[9px] text-text-muted ml-1">basierend auf divergierenden Commercial-Positionen</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {pairRecommendations.map((rec, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 + i * 0.04, duration: 0.25 }}
                  className={clsx(
                    'px-3 py-2.5 rounded-lg border bg-white/[0.03]',
                    rec.direction === 'LONG'
                      ? 'border-pnl-positive/15'
                      : 'border-pnl-negative/15'
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold tracking-wide text-text-primary">{rec.pair}</span>
                    <div className="flex items-center gap-1.5">
                      {/* Direction arrow */}
                      <span className={clsx(
                        'text-sm',
                        rec.direction === 'LONG' ? 'text-pnl-positive' : 'text-pnl-negative'
                      )}>
                        {rec.direction === 'LONG' ? '\u2191' : '\u2193'}
                      </span>
                      <span className={clsx(
                        'text-[9px] uppercase tracking-[0.1em] font-bold px-1.5 py-0.5 rounded',
                        rec.direction === 'LONG'
                          ? 'bg-pnl-positive/15 text-pnl-positive'
                          : 'bg-pnl-negative/15 text-pnl-negative'
                      )}>
                        {rec.direction}
                      </span>
                    </div>
                  </div>
                  <div className="text-[9px] text-text-muted leading-relaxed mb-1.5">{rec.reason}</div>
                  {/* Strength dots */}
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] uppercase tracking-[0.1em] text-text-muted mr-1">STR</span>
                    {[...Array(4)].map((_, j) => (
                      <div
                        key={j}
                        className={clsx(
                          'w-1.5 h-1.5 rounded-full',
                          j < rec.strength ? 'bg-accent-primary' : 'bg-white/[0.06]'
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

      </>
      )}

      {/* ── Über COT Daten (Info Footer) ── */}
      <div className="mt-4 px-3 py-2.5 bg-white/[0.02] rounded-lg border border-white/[0.04]">
        <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-text-muted mb-1">Über COT Daten</h4>
        <p className="text-[10px] text-text-muted leading-relaxed">
          Die Commitment of Traders (COT) Reports werden jeden Freitag von der CFTC veröffentlicht.
          <strong className="text-text-secondary"> Commercials</strong> sind typischerweise Hedger (Banken, große Institutionen) und gelten als "Smart Money".
          Ein hoher Perzentilrang (80%+) bedeutet, dass Commercials stark long positioniert sind im historischen Vergleich.
        </p>
      </div>

      {/* ── Manual Input Modal ── */}
      {showManualInput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-background-elevated border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Edit3 className="text-accent-primary" size={14} />
                <span className="text-xs font-semibold text-text-primary">COT Daten manuell eingeben</span>
              </div>
              <button
                onClick={() => setShowManualInput(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-white/[0.06] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              <p className="text-[10px] text-text-muted mb-3 leading-relaxed">
                Gib die Commercials Long/Short Positionen für jede Währung ein.
                Diese Daten kannst du von der{' '}
                <a
                  href="https://www.cftc.gov/dea/futures/deacmesf.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:underline"
                >
                  CFTC Webseite
                </a>
                {' '}oder von{' '}
                <a
                  href="https://www.barchart.com/futures/commitment-of-traders"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-primary hover:underline"
                >
                  Barchart
                </a>
                {' '}ablesen.
              </p>

              <div className="space-y-1.5">
                {/* Column Headers */}
                <div className="flex items-center gap-3 px-2 mb-1">
                  <div className="w-10" />
                  <div className="flex-1 flex gap-3">
                    <span className="flex-1 text-[9px] uppercase tracking-[0.1em] text-text-muted">Long</span>
                    <span className="flex-1 text-[9px] uppercase tracking-[0.1em] text-text-muted">Short</span>
                    <span className="w-20 text-right text-[9px] uppercase tracking-[0.1em] text-text-muted">Net</span>
                  </div>
                </div>

                {CURRENCIES.filter(c => c.id !== 'USD').map(currency => (
                  <div key={currency.id} className="flex items-center gap-3 px-2 py-1.5 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors">
                    <div className="w-10 text-[10px] font-bold text-text-primary tracking-wide">{currency.id}</div>
                    <div className="flex-1 flex gap-3 items-center">
                      <input
                        type="number"
                        value={manualInputData[currency.id]?.long || ''}
                        onChange={(e) => setManualInputData(prev => ({
                          ...prev,
                          [currency.id]: { ...prev[currency.id], long: e.target.value }
                        }))}
                        className="flex-1 px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-xs
                                 font-mono tabular-nums text-text-primary focus:border-accent-primary/50 focus:outline-none transition-colors"
                        placeholder="556661"
                      />
                      <input
                        type="number"
                        value={manualInputData[currency.id]?.short || ''}
                        onChange={(e) => setManualInputData(prev => ({
                          ...prev,
                          [currency.id]: { ...prev[currency.id], short: e.target.value }
                        }))}
                        className="flex-1 px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-xs
                                 font-mono tabular-nums text-text-primary focus:border-accent-primary/50 focus:outline-none transition-colors"
                        placeholder="757245"
                      />
                      <div className={clsx(
                        'w-20 text-right font-mono tabular-nums text-xs font-semibold',
                        (parseInt(manualInputData[currency.id]?.long || '0') - parseInt(manualInputData[currency.id]?.short || '0')) >= 0
                          ? 'text-pnl-positive'
                          : 'text-pnl-negative'
                      )}>
                        {((parseInt(manualInputData[currency.id]?.long || '0') - parseInt(manualInputData[currency.id]?.short || '0')) || 0).toLocaleString('de-DE')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/[0.04]">
              <button
                onClick={() => setShowManualInput(false)}
                className="text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary px-3 py-1.5 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={saveManualData}
                className="text-[10px] uppercase tracking-[0.1em] text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors"
              >
                <Save size={10} />
                Speichern
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
