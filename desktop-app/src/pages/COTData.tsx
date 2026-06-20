/**
 * ========================================================================
 * Trading Journal - Smart COT Page
 * ========================================================================
 * Smart COT Analysis:
 * - Momentum (1W/4W/8W) Analyse
 * - Extremzonen + Change of Character
 * - Spec vs. Commercial Divergenz
 * - Composite Smart Score pro Währung
 * - Pair-Empfehlungen mit Begründung
 */

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import {
  Database, RefreshCw, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  ExternalLink, ArrowRightLeft, Edit3, X, Save, Zap, Activity, AlertTriangle,
  Target, ArrowUpRight, ArrowDownRight, Minus, Brain, Lightbulb
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { getApi } from '@/services/webApi';
import { PageTransition } from '@/components/ui/PageTransition';
import { BentoGrid, BentoCell } from '@/components/ui/BentoGrid';
import {
  type COTSnapshot, type CurrencyAnalysis, type PairSignal,
  saveSnapshots, runSmartCOTAnalysis,
  loadCachedAnalyses, loadCachedPairSignals,
} from '@/services/smartCotService';
import {
  type MLPrediction,
  runMLPipeline, FEATURE_LABELS,
} from '@/services/smartCotML';
import { describeCurrency, describePairIdea } from '@/services/cotNarrative';
import {
  buildWeeklyOutlook, prepareWeeklyEvents, detectRiskRegime, type WeeklyEvent,
} from '@/services/weeklyOutlook';

const CURRENCIES = [
  { id: 'DXY', name: 'DXY', flag: '🇺🇸' },
  { id: 'EUR', name: 'EUR', flag: '🇪🇺' },
  { id: 'CHF', name: 'CHF', flag: '🇨🇭' },
  { id: 'GBP', name: 'GBP', flag: '🇬🇧' },
  { id: 'JPY', name: 'JPY', flag: '🇯🇵' },
  { id: 'CAD', name: 'CAD', flag: '🇨🇦' },
  { id: 'AUD', name: 'AUD', flag: '🇦🇺' },
  { id: 'NZD', name: 'NZD', flag: '🇳🇿' },
];

// Manual Input für Offline-Eingabe
const MANUAL_CURRENCIES = CURRENCIES.filter(c => c.id !== 'DXY');

export function COTData() {
  const [snapshots, setSnapshots] = useState<COTSnapshot[]>([]);
  const [analyses, setAnalyses] = useState<CurrencyAnalysis[]>([]);
  const [pairSignals, setPairSignals] = useState<PairSignal[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'cache' | 'manual' | 'none'>('none');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInputData, setManualInputData] = useState<Record<string, { long: string; short: string }>>({});
  const [activeTab, setActiveTab] = useState<'weekly' | 'overview' | 'pairs' | 'ml'>('weekly');
  const [weeklyEvents, setWeeklyEvents] = useState<WeeklyEvent[]>([]);
  const [mlPredictions, setMlPredictions] = useState<Record<string, MLPrediction>>({});
  const [mlLoading, setMlLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    loadData();
    loadCalendar();
    // News/Kalender stündlich aktualisieren
    const interval = setInterval(loadCalendar, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Wirtschaftskalender laden (stündlicher Cache) → Events der kommenden Woche
  const loadCalendar = async (force = false) => {
    try {
      // 1h-Cache prüfen
      const cachedRaw = localStorage.getItem('cotCalendarCache');
      if (!force && cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const ageMin = (Date.now() - (cached.timestamp || 0)) / 60000;
        if (ageMin < 60 && Array.isArray(cached.events)) {
          setWeeklyEvents(prepareWeeklyEvents(cached.events));
          return;
        }
      }
      const api = getApi() as any;
      if (!api.fetchEconomicCalendar) return;
      const res = await api.fetchEconomicCalendar();
      if (res?.success && Array.isArray(res.data)) {
        localStorage.setItem('cotCalendarCache', JSON.stringify({ events: res.data, timestamp: Date.now() }));
        setWeeklyEvents(prepareWeeklyEvents(res.data));
      } else if (cachedRaw) {
        // Fehlgeschlagen → alten Cache verwenden
        const cached = JSON.parse(cachedRaw);
        if (Array.isArray(cached.events)) setWeeklyEvents(prepareWeeklyEvents(cached.events));
      }
    } catch (err) {
      console.warn('Kalender konnte nicht geladen werden:', err);
    }
  };

  const loadData = async () => {
    try {
      // Erst Supabase-Cache laden
      const [cachedAnalyses, cachedPairs] = await Promise.all([
        loadCachedAnalyses().catch(() => []),
        loadCachedPairSignals().catch(() => []),
      ]);

      if (cachedAnalyses.length > 0) {
        setAnalyses(cachedAnalyses);
        setPairSignals(cachedPairs);
        setDataSource('cache');
        if (cachedAnalyses[0]?.latestDate) {
          setLastUpdate(new Date(cachedAnalyses[0].latestDate));
        }
      }

      // localStorage für Rohdaten prüfen (schnelle Anzeige)
      const cached = localStorage.getItem('cotData');
      const cachedDate = localStorage.getItem('cotLastUpdate');

      if (cached && cachedDate) {
        const lastUpdateDate = new Date(cachedDate);
        const daysSinceUpdate = Math.floor((Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceUpdate >= 7 && localStorage.getItem('cotDataSource') !== 'manual') {
          await fetchCOTData();
        } else if (cachedAnalyses.length === 0) {
          // Haben localStorage-Daten aber keine Supabase-Analyse → neu berechnen
          await fetchCOTData();
        }
      } else if (cachedAnalyses.length === 0) {
        await fetchCOTData();
      }
    } catch (err) {
      console.error('Error loading Smart COT data:', err);
      setError('Fehler beim Laden der COT-Daten');
    }
  };

  const fetchCOTData = async (force = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApi();
      if (!api.fetchCOTData) {
        setError('COT-Daten sind nur in der Desktop-App verfügbar.');
        return;
      }

      // Zinssätze IMMER zuerst laden — die Smart-COT-Analyse liest sie aus
      // localStorage. Ohne diesen Schritt ist die Zinsdifferenz 0.
      try {
        const anyApi = api as any;
        if (anyApi.fetchInterestRates) await anyApi.fetchInterestRates();
      } catch { /* Zinsen optional */ }

      if (force) {
        // Echter Refresh: alle COT/Preis-Caches verwerfen
        localStorage.removeItem('smartCotPrices');
        localStorage.removeItem('smartCotPricesDate');
        localStorage.removeItem('cotData');
        localStorage.removeItem('cotHistory');
        localStorage.removeItem('cotLastUpdate');
      }

      const result = await api.fetchCOTData();

      if (!result.success || !result.data) {
        setError(result.error || 'Keine COT-Daten erhalten.');
        return;
      }

      const dataArray = Array.isArray(result.data) ? result.data :
        Object.entries(result.data).map(([currency, data]: [string, any]) => ({ currency, ...data }));

      // Convert to snapshots (current week)
      const currentSnapshots: COTSnapshot[] = dataArray.map((d: any) => ({
        date: d.date,
        currency: d.currency,
        commercialsLong: d.commercialsLong || 0,
        commercialsShort: d.commercialsShort || 0,
        commercialsNet: d.commercialsNet || 0,
        nonCommercialsLong: d.nonCommercialsLong || 0,
        nonCommercialsShort: d.nonCommercialsShort || 0,
        nonCommercialsNet: d.nonCommercialsNet || 0,
        openInterest: d.openInterest || 0,
        percentileRank: d.percentileRank || 50,
        signal: d.signal || 'neutral',
        weeklyChange: d.weeklyChange || 0,
      }));

      // Convert history to snapshots
      const historySnapshots: COTSnapshot[] = [];
      if (result.history) {
        Object.entries(result.history).forEach(([currency, entries]) => {
          (entries as any[]).forEach(e => {
            const cLong = e.commercialsLong || 0;
            const cShort = e.commercialsShort || 0;
            historySnapshots.push({
              date: e.date,
              currency,
              commercialsLong: cLong,
              commercialsShort: cShort,
              commercialsNet: cLong - cShort,
              nonCommercialsLong: e.nonCommercialsLong || 0,
              nonCommercialsShort: e.nonCommercialsShort || 0,
              nonCommercialsNet: (e.nonCommercialsLong || 0) - (e.nonCommercialsShort || 0),
              openInterest: e.openInterest || 0,
              percentileRank: 50,
              signal: 'neutral',
              weeklyChange: 0,
            });
          });
        });
      }

      const allSnapshots = [...historySnapshots, ...currentSnapshots];

      // De-duplicate by date+currency (keep latest)
      const unique = new Map<string, COTSnapshot>();
      for (const s of allSnapshots) {
        unique.set(`${s.currency}:${s.date}`, s);
      }
      const deduped = Array.from(unique.values());

      setSnapshots(deduped);

      // Persist to Supabase
      saveSnapshots(deduped).catch(console.error);

      // Run Smart Analysis
      const { analyses: newAnalyses, pairSignals: newSignals } = await runSmartCOTAnalysis(deduped);
      setAnalyses(newAnalyses);
      setPairSignals(newSignals);
      setLastUpdate(new Date());
      setDataSource('live');

      // Cache in localStorage
      localStorage.setItem('cotData', JSON.stringify(result.data));
      localStorage.setItem('cotHistory', JSON.stringify(result.history || {}));
      localStorage.setItem('cotLastUpdate', new Date().toISOString());
      localStorage.removeItem('cotDataSource');

      // ML: Preise laden und Pipeline starten (async, blockiert UI nicht)
      loadPricesAndRunML(deduped, force).catch(console.error);

      // Kalender/News mitziehen (bei Force frisch)
      loadCalendar(force).catch(console.error);
    } catch (err) {
      console.error('COT fetch error:', err);
      setError('Fehler beim Laden der COT-Daten.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPricesAndRunML = async (allSnapshots: COTSnapshot[], force = false) => {
    setMlLoading(true);
    try {
      // Prüfe localStorage-Cache
      let priceData: Record<string, Array<{ date: string; price: number }>> = {};
      const cachedPrices = localStorage.getItem('smartCotPrices');
      const cachedPricesDate = localStorage.getItem('smartCotPricesDate');
      const daysSincePrices = cachedPricesDate
        ? Math.floor((Date.now() - new Date(cachedPricesDate).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (!force && cachedPrices && daysSincePrices < 7) {
        priceData = JSON.parse(cachedPrices);
      } else {
        const api = getApi() as any;
        if (api.fetchForexPrices) {
          const result = await api.fetchForexPrices('2020-01-01');
          if (result.success && result.data) {
            priceData = result.data;
            localStorage.setItem('smartCotPrices', JSON.stringify(priceData));
            localStorage.setItem('smartCotPricesDate', new Date().toISOString());
          }
        }
      }

      if (Object.keys(priceData).length === 0) {
        setMlLoading(false);
        return;
      }

      // ML für jede Währung laufen lassen
      const predictions: Record<string, MLPrediction> = {};
      for (const ccy of CURRENCIES.map(c => c.id)) {
        const ccyPrices = priceData[ccy] || [];
        if (ccyPrices.length < 20) continue;

        const result = runMLPipeline(allSnapshots, ccyPrices, ccy);
        if (result && result.dataPoints >= 30) {
          predictions[ccy] = result;
        }
      }

      setMlPredictions(predictions);
    } catch (err) {
      console.error('ML pipeline error:', err);
    } finally {
      setMlLoading(false);
    }
  };

  const openManualInput = () => {
    const initialData: Record<string, { long: string; short: string }> = {};
    MANUAL_CURRENCIES.forEach(currency => {
      const analysis = analyses.find(a => a.currency === currency.id);
      initialData[currency.id] = {
        long: analysis?.currentNet ? '' : '',
        short: '',
      };
    });
    setManualInputData(initialData);
    setShowManualInput(true);
  };

  const saveManualData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const newSnapshots: COTSnapshot[] = [];

    Object.entries(manualInputData).forEach(([currencyId, values]) => {
      const long = parseInt(values.long) || 0;
      const short = parseInt(values.short) || 0;

      newSnapshots.push({
        date: today,
        currency: currencyId,
        commercialsLong: long,
        commercialsShort: short,
        commercialsNet: long - short,
        nonCommercialsLong: 0,
        nonCommercialsShort: 0,
        nonCommercialsNet: 0,
        openInterest: 0,
        percentileRank: 50,
        signal: 'neutral',
        weeklyChange: 0,
      });
    });

    // Merge with existing snapshots
    const merged = [...snapshots.filter(s => s.date !== today), ...newSnapshots];
    setSnapshots(merged);

    saveSnapshots(newSnapshots).catch(console.error);

    const { analyses: newAnalyses, pairSignals: newSignals } = await runSmartCOTAnalysis(merged);
    setAnalyses(newAnalyses);
    setPairSignals(newSignals);
    setLastUpdate(new Date());
    setDataSource('manual');
    setShowManualInput(false);

    localStorage.setItem('cotLastUpdate', new Date().toISOString());
    localStorage.setItem('cotDataSource', 'manual');
  };

  const selectedAnalysis = useMemo(
    () => analyses.find(a => a.currency === selectedCurrency),
    [analyses, selectedCurrency]
  );

  const selectedHistory = useMemo(() => {
    if (!selectedCurrency) return [];
    return snapshots
      .filter(s => s.currency === selectedCurrency)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({ date: s.date, net: s.commercialsNet, oi: s.openInterest }));
  }, [snapshots, selectedCurrency]);

  // Aktuellster Roh-Snapshot der gewählten Währung (echte CFTC-Zahlen)
  const selectedRaw = useMemo(() => {
    if (!selectedCurrency) return null;
    const rows = snapshots
      .filter(s => s.currency === selectedCurrency && (s.commercialsLong || s.commercialsShort))
      .sort((a, b) => a.date.localeCompare(b.date));
    return rows.length > 0 ? rows[rows.length - 1] : null;
  }, [snapshots, selectedCurrency]);

  const sortedAnalyses = useMemo(() => {
    return [...analyses]
      .filter(a => a.latestDate)
      .sort((a, b) => Math.abs(b.smartScore) - Math.abs(a.smartScore));
  }, [analyses]);

  // Ranking stark → schwach nach Final Conviction (für Stärke-Leiter + Karten)
  const rankedAnalyses = useMemo(() => {
    return [...analyses]
      .filter(a => a.latestDate)
      .sort((a, b) => b.finalConviction - a.finalConviction);
  }, [analyses]);

  // Aktuellster Roh-Snapshot je Währung (für rohe COT-Zahlen in den Karten)
  const latestRawByCcy = useMemo(() => {
    const map: Record<string, COTSnapshot> = {};
    for (const s of snapshots) {
      if (!s.commercialsLong && !s.commercialsShort) continue;
      const prev = map[s.currency];
      if (!prev || s.date > prev.date) map[s.currency] = s;
    }
    return map;
  }, [snapshots]);

  const flagOf = (id: string) => CURRENCIES.find(c => c.id === id)?.flag ?? '';

  // Sonntags-Wochenausblick: fundamentaler Bias × Event-Risiko der Woche
  const weeklyOutlook = useMemo(
    () => buildWeeklyOutlook(analyses, pairSignals, weeklyEvents),
    [analyses, pairSignals, weeklyEvents]
  );

  // Risk-Off-Wächter (JPY/CHF-Stärke) → Carry-Warnung
  const riskRegime = useMemo(() => detectRiskRegime(analyses), [analyses]);

  const getScoreColor = (score: number) => {
    if (score >= 40) return '#22c55e';
    if (score >= 15) return '#86efac';
    if (score <= -40) return '#ef4444';
    if (score <= -15) return '#fca5a5';
    return '#d4d4d8';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 40) return 'STARK BULLISH';
    if (score >= 15) return 'BULLISH';
    if (score <= -40) return 'STARK BEARISH';
    if (score <= -15) return 'BEARISH';
    return 'NEUTRAL';
  };

  const getMomentumIcon = (signal: string) => {
    switch (signal) {
      case 'accelerating_long': return <ArrowUpRight size={10} className="text-pnl-positive" />;
      case 'long': return <TrendingUp size={10} className="text-pnl-positive/70" />;
      case 'accelerating_short': return <ArrowDownRight size={10} className="text-pnl-negative" />;
      case 'short': return <TrendingDown size={10} className="text-pnl-negative/70" />;
      default: return <Minus size={10} className="text-text-muted" />;
    }
  };

  const getMomentumLabel = (signal: string) => {
    switch (signal) {
      case 'accelerating_long': return 'Beschleunigt ↑';
      case 'long': return 'Aufwärts';
      case 'accelerating_short': return 'Beschleunigt ↓';
      case 'short': return 'Abwärts';
      default: return 'Flat';
    }
  };

  const nextRelease = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    return nextFriday;
  }, []);

  // Smart Score bar chart data
  const scoreChartData = useMemo(() => {
    return sortedAnalyses.map(a => ({
      currency: a.currency,
      score: a.smartScore,
      fill: getScoreColor(a.smartScore),
    }));
  }, [sortedAnalyses]);

  return (
    <PageTransition>
    <div className="page-container">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Brain size={18} className="text-accent-primary" />
          <h1 className="text-base font-semibold tracking-tight text-text-primary">Smart COT</h1>
          <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-medium bg-white/[0.04] px-2 py-0.5 rounded">
            Analyse Engine
          </span>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdate && analyses.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-text-muted mr-2">
              <span className="font-mono tabular-nums">{analyses[0]?.latestDate}</span>
              {dataSource === 'cache' && <span className="bg-white/[0.04] px-1.5 py-0.5 rounded">Cache</span>}
              {dataSource === 'live' && <span className="text-pnl-positive bg-pnl-positive/10 px-1.5 py-0.5 rounded">Live</span>}
              {dataSource === 'manual' && <span className="text-accent-gold bg-accent-gold/10 px-1.5 py-0.5 rounded">Manuell</span>}
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
            onClick={() => setShowInfoModal(true)}
            className="text-[10px] uppercase tracking-[0.1em] text-accent-gold hover:text-accent-gold/80 flex items-center gap-1 px-2 py-1 rounded bg-accent-gold/10 hover:bg-accent-gold/15 transition-colors"
            title="Wie funktioniert Smart COT?"
          >
            <Lightbulb size={10} />
          </button>

          <button
            onClick={openManualInput}
            className="text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary flex items-center gap-1 px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
          >
            <Edit3 size={10} /> Manuell
          </button>

          <button
            onClick={() => fetchCOTData(true)}
            disabled={isLoading}
            className="text-[10px] uppercase tracking-[0.1em] text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors disabled:opacity-40"
            title="Lädt CFTC-Daten, Forex-Preise und Zinssätze komplett neu (ignoriert Cache)"
          >
            <RefreshCw size={10} className={clsx(isLoading && 'animate-spin')} />
            {isLoading ? 'Analysiere...' : 'Refresh & Analyse'}
          </button>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-4 px-3 py-2 bg-accent-gold/5 border border-accent-gold/15 rounded-lg flex items-center gap-2"
      >
        <Zap className="text-accent-gold flex-shrink-0" size={12} />
        <p className="text-[10px] text-text-muted leading-relaxed">
          <span className="text-accent-gold font-semibold uppercase tracking-[0.05em]">Fundamentaler Kompass</span>{' '}
          — wer ist stark, wer schwach? Aus COT-Positionierung, Positions-Trend und Zins-Carry. Stärke gegen Schwäche = Trade-Idee.{' '}
          <span className="font-mono tabular-nums text-accent-gold">Nächster Report: {nextRelease.toLocaleDateString('de-DE')}</span>
        </p>
      </motion.div>

      {/* ── Error State ── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-3 bg-pnl-negative/5 border border-pnl-negative/20 rounded-lg"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="text-pnl-negative flex-shrink-0 mt-0.5" size={14} />
            <div>
              <p className="text-xs text-pnl-negative font-medium">{error}</p>
              <button
                onClick={() => fetchCOTData(true)}
                disabled={isLoading}
                className="mt-2 text-[10px] uppercase text-text-muted hover:text-text-primary flex items-center gap-1 px-2 py-1 rounded bg-white/[0.03]"
              >
                <RefreshCw size={10} className={clsx(isLoading && 'animate-spin')} />
                Erneut versuchen
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Loading ── */}
      {isLoading && analyses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-accent-primary mb-3" />
          <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Lade & analysiere COT-Daten...</p>
        </div>
      )}

      {/* ── No Data ── */}
      {!isLoading && analyses.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16">
          <Brain size={24} className="text-text-muted mb-3" />
          <p className="text-xs text-text-primary font-medium mb-1">Keine Smart COT Daten</p>
          <p className="text-[10px] text-text-muted mb-3">Klicke "Refresh & Analyse" um CFTC-Daten zu laden und analysieren.</p>
          <button onClick={() => fetchCOTData(true)} className="text-[10px] uppercase text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30">
            <RefreshCw size={10} /> Daten laden
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      {analyses.length > 0 && (
      <>
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mb-4 bg-white/[0.02] rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setActiveTab('weekly')}
            className={clsx(
              'text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 rounded transition-colors',
              activeTab === 'weekly' ? 'bg-accent-primary/20 text-text-primary font-semibold' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Target size={10} className="inline mr-1" /> Wochen-Ausblick
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={clsx(
              'text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 rounded transition-colors',
              activeTab === 'overview' ? 'bg-accent-primary/20 text-text-primary font-semibold' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Database size={10} className="inline mr-1" /> Währungen
          </button>
          <button
            onClick={() => setActiveTab('pairs')}
            className={clsx(
              'text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 rounded transition-colors',
              activeTab === 'pairs' ? 'bg-accent-primary/20 text-text-primary font-semibold' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <ArrowRightLeft size={10} className="inline mr-1" /> Pair Signale
            {pairSignals.length > 0 && (
              <span className="ml-1 bg-accent-primary/30 text-accent-primary px-1 py-0 rounded text-[8px]">{pairSignals.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ml')}
            className={clsx(
              'text-[10px] uppercase tracking-[0.12em] px-3 py-1.5 rounded transition-colors',
              activeTab === 'ml' ? 'bg-accent-primary/20 text-text-primary font-semibold' : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Brain size={10} className="inline mr-1" /> Experimentell
            {mlLoading && <RefreshCw size={8} className="inline ml-1 animate-spin" />}
          </button>
        </div>

        <AnimatePresence mode="wait">
        {activeTab === 'weekly' && (
          <motion.div key="weekly" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* Intro */}
            <div className="mb-4 px-3 py-2.5 bg-accent-primary/5 border border-accent-primary/15 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Target size={12} className="text-accent-primary" />
                <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-text-primary">Wochen-Ausblick</span>
                <span className="text-[9px] text-text-muted">— Sonntags-Check für die kommende Woche</span>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Fundamentaler Bias (COT-Positionierung + Trend + Zins-Carry) kombiniert mit dem <strong className="text-text-secondary">Event-Risiko der Woche</strong>.
                Die <strong className="text-text-secondary">Konfidenz</strong> zeigt, wie viele Treiber in dieselbe Richtung zeigen (Confluence) —
                <span className="text-accent-gold"> keine backgetestete Trefferquote.</span> Steht ein großes Event an, wird die Konfidenz gedeckelt (Ausgang offen).
              </p>
            </div>

            {/* Währungs-Stärke-Board: wer ist stark, wer schwach (rang-basiert) */}
            {rankedAnalyses.length > 0 && (() => {
              const strong = rankedAnalyses.filter(a => a.finalConviction > 0);
              const weak = [...rankedAnalyses].filter(a => a.finalConviction <= 0).sort((a, b) => a.finalConviction - b.finalConviction);
              const tagFor = (a: typeof rankedAnalyses[number]) => {
                const parts: string[] = [];
                parts.push(a.currentPercentile >= 60 ? 'COT long' : a.currentPercentile <= 40 ? 'COT short' : 'COT neutral');
                if (a.rateDifferential > 0.25) parts.push('Carry+');
                else if (a.rateDifferential < -0.25) parts.push('Carry−');
                if (a.momentumSignal.includes('accelerating')) parts.push('Momentum↑');
                return parts.join(' · ');
              };
              const Row = ({ a, strong: isStrong }: { a: typeof rankedAnalyses[number]; strong: boolean }) => (
                <button
                  onClick={() => { setActiveTab('overview'); setSelectedCurrency(a.currency); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.03] transition-colors text-left"
                >
                  <span className="text-base w-6 text-center">{flagOf(a.currency)}</span>
                  <span className="text-xs font-bold text-text-primary w-9">{a.currency}</span>
                  <span className="text-[9px] text-text-muted flex-1 truncate">{tagFor(a)}</span>
                  <span className="font-mono tabular-nums text-xs font-bold" style={{ color: isStrong ? '#22c55e' : '#ef4444' }}>
                    {a.finalConviction > 0 ? '+' : ''}{a.finalConviction}
                  </span>
                </button>
              );
              return (
                <div className="mb-4 rounded-xl border border-border bg-background-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp size={12} className="text-accent-primary" />
                    <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-text-primary">Währungs-Stärke</span>
                    <span className="text-[9px] text-text-muted">strukturell (Wochen–Monate) — Stärkste oben, Schwächste oben</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-pnl-positive font-bold mb-1 px-2">▲ Stark — kaufen</div>
                      {strong.length > 0 ? strong.map(a => <Row key={a.currency} a={a} strong />) : <div className="text-[10px] text-text-muted px-2 py-1">—</div>}
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-pnl-negative font-bold mb-1 px-2">▼ Schwach — verkaufen</div>
                      {weak.length > 0 ? weak.map(a => <Row key={a.currency} a={a} strong={false} />) : <div className="text-[10px] text-text-muted px-2 py-1">—</div>}
                    </div>
                  </div>
                  <p className="text-[9px] text-text-muted mt-2 px-2 leading-relaxed">
                    Trade-Idee = oben links (stark) gegen oben rechts (schwach). Klick auf eine Währung öffnet die Detail-Analyse.
                  </p>
                </div>
              );
            })()}

            {/* Risk-Regime-Wächter */}
            <div className={clsx(
              'mb-4 px-3 py-2 rounded-lg border flex items-start gap-2',
              riskRegime.riskOff ? 'bg-pnl-negative/5 border-pnl-negative/20'
                : riskRegime.strongHavens.length === 1 ? 'bg-accent-gold/5 border-accent-gold/15'
                : 'bg-pnl-positive/5 border-pnl-positive/15'
            )}>
              {riskRegime.riskOff
                ? <AlertTriangle size={12} className="text-pnl-negative flex-shrink-0 mt-0.5" />
                : <Activity size={12} className={clsx('flex-shrink-0 mt-0.5', riskRegime.strongHavens.length === 1 ? 'text-accent-gold' : 'text-pnl-positive')} />}
              <p className="text-[10px] text-text-muted leading-relaxed">
                <span className={clsx('font-semibold uppercase tracking-[0.05em]',
                  riskRegime.riskOff ? 'text-pnl-negative' : riskRegime.strongHavens.length === 1 ? 'text-accent-gold' : 'text-pnl-positive'
                )}>
                  {riskRegime.riskOff ? 'Risk-Off' : riskRegime.strongHavens.length === 1 ? 'Wachsam' : 'Risk-On / Neutral'}
                </span>{' '}
                {riskRegime.detail}
              </p>
            </div>

            {/* Event-Kalender der Woche */}
            {weeklyEvents.length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-background-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={12} className="text-accent-gold" />
                  <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-text-muted">Wichtige Events diese Woche</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {weeklyEvents.filter(e => e.impact === 'high').slice(0, 16).map((e, i) => (
                    <span key={i} className="text-[9px] px-2 py-1 rounded bg-pnl-negative/10 text-text-secondary border border-pnl-negative/15">
                      <span className="font-bold text-pnl-negative">{e.weekday}</span>{' '}
                      <span className="font-semibold">{e.currency}</span>{' '}
                      <span className="text-text-muted">{e.event}</span>
                    </span>
                  ))}
                  {weeklyEvents.filter(e => e.impact === 'high').length === 0 && (
                    <span className="text-[10px] text-text-muted">Keine High-Impact-Events — ruhigere Woche, fundamentaler Bias wiegt mehr.</span>
                  )}
                </div>
              </div>
            )}
            {weeklyEvents.length === 0 && (
              <div className="mb-4 px-3 py-2 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                <p className="text-[10px] text-text-muted">
                  Kalender noch nicht geladen. Klicke „Refresh & Analyse" — die Events werden dann mitgeladen (danach stündlich aktualisiert).
                </p>
              </div>
            )}

            {/* Pair-Ausblicke */}
            {weeklyOutlook.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Target size={24} className="text-text-muted mb-3" />
                <p className="text-xs text-text-primary font-medium mb-1">Kein klarer Wochen-Ausblick</p>
                <p className="text-[10px] text-text-muted">Aktuell zu geringe Divergenz zwischen den Währungen.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {weeklyOutlook.map((o, i) => {
                  const leanColor = o.lean === 'long' ? '#22c55e' : o.lean === 'short' ? '#ef4444' : '#d4d4d8';
                  return (
                    <motion.div
                      key={o.pair}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={clsx(
                        'rounded-xl border bg-background-card p-4',
                        o.lean === 'long' ? 'border-pnl-positive/15' : o.lean === 'short' ? 'border-pnl-negative/15' : 'border-border'
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold tracking-wide text-text-primary">{o.pair}</span>
                        <span className="text-[9px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${leanColor}1a`, color: leanColor }}>
                          {o.lean === 'long' ? '↑ LONG' : o.lean === 'short' ? '↓ SHORT' : '— ABWARTEN'}
                        </span>
                      </div>

                      {/* Konfidenz */}
                      <div className="mb-2.5" title="Confluence: wie viele Treiber in dieselbe Richtung zeigen. Keine statistische Trefferquote.">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px] uppercase tracking-[0.1em] text-text-muted">Konfidenz ({o.confidenceLabel})</span>
                          <span className="font-mono tabular-nums text-[10px] font-bold" style={{ color: leanColor }}>{o.confidence}%</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${o.confidence}%`, backgroundColor: leanColor }} />
                        </div>
                      </div>

                      {/* Treiber */}
                      <div className="space-y-1 mb-2">
                        {o.drivers.map((d, j) => (
                          <div key={j} className="flex items-start gap-1.5 text-[10px] text-text-muted leading-snug">
                            <span className="mt-1 w-1 h-1 rounded-full bg-text-muted flex-shrink-0" />
                            <span>{d}</span>
                          </div>
                        ))}
                      </div>

                      {/* Events der Woche */}
                      {o.events.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-white/[0.05]">
                          {o.events.slice(0, 5).map((e, j) => (
                            <span key={j} className={clsx(
                              'text-[8px] px-1.5 py-0.5 rounded',
                              e.impact === 'high' ? 'bg-pnl-negative/10 text-pnl-negative' : 'bg-white/[0.04] text-text-muted'
                            )}>
                              {e.weekday} {e.currency} {e.event}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Caution */}
                      {o.caution && (
                        <div className="mt-2 flex items-start gap-1.5 px-2 py-1.5 bg-accent-gold/5 border border-accent-gold/15 rounded">
                          <AlertTriangle size={10} className="text-accent-gold flex-shrink-0 mt-0.5" />
                          <span className="text-[9px] text-text-muted leading-snug">{o.caution}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

          </motion.div>
        )}
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* ── Stärke-Leiter ── */}
            <div className="mb-4 rounded-xl border border-border bg-background-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={12} className="text-accent-primary" />
                <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-text-primary">Stärke-Leiter</span>
              </div>
              <p className="text-[10px] text-text-muted mb-3">
                Wer ist fundamental stark, wer schwach? Sortiert nach Gesamt-Einschätzung (COT-Positionierung + Trend + Zins-Carry). Klick auf eine Währung für Details.
              </p>
              <div className="space-y-1">
                {rankedAnalyses.map((a) => {
                  const n = describeCurrency(a);
                  const color = getScoreColor(a.finalConviction);
                  const pct = Math.min(50, Math.abs(a.finalConviction) / 2);
                  const isSel = selectedCurrency === a.currency;
                  return (
                    <button
                      key={a.currency}
                      onClick={() => setSelectedCurrency(isSel ? null : a.currency)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors text-left',
                        isSel ? 'bg-white/[0.05] ring-1 ring-accent-primary/40' : 'hover:bg-white/[0.03]'
                      )}
                    >
                      <span className="text-base w-6 text-center">{flagOf(a.currency)}</span>
                      <span className="text-xs font-bold text-text-primary w-9">{a.currency}</span>
                      <span
                        className="text-[8px] uppercase tracking-[0.1em] font-bold px-1.5 py-0.5 rounded w-16 text-center"
                        style={{ backgroundColor: `${color}1a`, color }}
                      >
                        {n.verdict}
                      </span>
                      {/* zentrierte Balken-Achse */}
                      <div className="flex-1 h-2 bg-white/[0.04] rounded-full relative overflow-hidden">
                        <div className="absolute left-1/2 top-0 w-px h-full bg-white/15" />
                        <div
                          className="absolute top-0 h-full rounded-full"
                          style={{
                            left: a.finalConviction >= 0 ? '50%' : `${50 - pct}%`,
                            width: `${pct}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-xs font-bold w-9 text-right" style={{ color }}>
                        {a.finalConviction > 0 ? '+' : ''}{a.finalConviction}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Klartext-Karten pro Währung ── */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {rankedAnalyses.map((analysis, idx) => {
                const n = describeCurrency(analysis);
                const isSelected = selectedCurrency === analysis.currency;
                const color = getScoreColor(analysis.finalConviction);
                const raw = latestRawByCcy[analysis.currency];
                const toneColor = (t: string) => t === 'pos' ? 'bg-pnl-positive' : t === 'neg' ? 'bg-pnl-negative' : 'bg-text-muted';

                return (
                  <motion.button
                    key={analysis.currency}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => setSelectedCurrency(isSelected ? null : analysis.currency)}
                    className={clsx(
                      'text-left rounded-xl border bg-background-card p-3.5 transition-colors',
                      isSelected ? 'border-accent-primary/50 ring-1 ring-accent-primary/30' : 'border-border hover:border-white/[0.12]'
                    )}
                  >
                    {/* Header: Flag + Code + Verdict */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{flagOf(analysis.currency)}</span>
                        <span className="text-sm font-bold text-text-primary tracking-wide">{analysis.currency}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${color}1a`, color }}>
                          {n.verdict}
                        </span>
                        <span className="font-mono tabular-nums text-sm font-bold" style={{ color }}>
                          {analysis.finalConviction > 0 ? '+' : ''}{analysis.finalConviction}
                        </span>
                      </div>
                    </div>

                    {/* Headline */}
                    <p className="text-[11px] text-text-secondary leading-snug mb-2.5">{n.headline}</p>

                    {/* 3 Säulen in Klartext */}
                    <div className="space-y-1.5 mb-2.5">
                      {n.pillars.map((p, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span className={clsx('mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0', toneColor(p.tone))} />
                          <div className="min-w-0">
                            <span className="text-[9px] uppercase tracking-[0.08em] text-text-muted font-semibold">{p.label}: </span>
                            <span className="text-[10px] text-text-muted leading-snug">{p.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Rohe COT-Zahlen */}
                    {raw && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.05] text-[9px] font-mono tabular-nums">
                        <div>
                          <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Comm Net</div>
                          <div className={clsx('font-bold', raw.commercialsNet >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                            {raw.commercialsNet >= 0 ? '+' : ''}{raw.commercialsNet.toLocaleString('de-DE')}
                          </div>
                        </div>
                        <div>
                          <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Spec Net</div>
                          <div className={clsx('font-bold', raw.nonCommercialsNet >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                            {raw.nonCommercialsNet >= 0 ? '+' : ''}{raw.nonCommercialsNet.toLocaleString('de-DE')}
                          </div>
                        </div>
                        <div>
                          <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Open Interest</div>
                          <div className="text-text-secondary font-bold">{raw.openInterest.toLocaleString('de-DE')}</div>
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* ── Selected Currency Detail ── */}
            <AnimatePresence>
            {selectedCurrency && selectedAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 rounded-xl border border-border bg-background-card overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{CURRENCIES.find(c => c.id === selectedCurrency)?.flag}</span>
                    <div>
                      <span className="text-xs font-bold text-text-primary">{selectedCurrency}</span>
                      <span className="text-[10px] text-text-muted ml-2">Rohe Zahlen, Befund & Verlauf</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCurrency(null)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-white/[0.06]">
                    <X size={14} />
                  </button>
                </div>

                {/* Row 0: ROHE CFTC-ZAHLEN (echte Commercials/Non-Commercials/OI) */}
                {selectedRaw && (
                  <div className="px-4 py-3 border-b border-white/[0.04] bg-white/[0.015]">
                    <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-2">
                      Rohe CFTC-Positionen · Stand {selectedRaw.date}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Commercials */}
                      <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                        <div className="text-[8px] uppercase tracking-[0.1em] text-pnl-positive font-semibold mb-1.5">Commercials (Smart Money)</div>
                        <div className="space-y-0.5 text-[10px] font-mono tabular-nums">
                          <div className="flex justify-between"><span className="text-text-muted">Long</span><span className="text-text-secondary">{selectedRaw.commercialsLong.toLocaleString('de-DE')}</span></div>
                          <div className="flex justify-between"><span className="text-text-muted">Short</span><span className="text-text-secondary">{selectedRaw.commercialsShort.toLocaleString('de-DE')}</span></div>
                          <div className="flex justify-between border-t border-white/[0.06] pt-0.5 mt-0.5">
                            <span className="text-text-muted font-semibold">Net</span>
                            <span className={clsx('font-bold', selectedRaw.commercialsNet >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                              {selectedRaw.commercialsNet >= 0 ? '+' : ''}{selectedRaw.commercialsNet.toLocaleString('de-DE')}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Non-Commercials */}
                      <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                        <div className="text-[8px] uppercase tracking-[0.1em] text-pnl-negative font-semibold mb-1.5">Non-Comm. (Spekulanten)</div>
                        <div className="space-y-0.5 text-[10px] font-mono tabular-nums">
                          <div className="flex justify-between"><span className="text-text-muted">Long</span><span className="text-text-secondary">{selectedRaw.nonCommercialsLong.toLocaleString('de-DE')}</span></div>
                          <div className="flex justify-between"><span className="text-text-muted">Short</span><span className="text-text-secondary">{selectedRaw.nonCommercialsShort.toLocaleString('de-DE')}</span></div>
                          <div className="flex justify-between border-t border-white/[0.06] pt-0.5 mt-0.5">
                            <span className="text-text-muted font-semibold">Net</span>
                            <span className={clsx('font-bold', selectedRaw.nonCommercialsNet >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                              {selectedRaw.nonCommercialsNet >= 0 ? '+' : ''}{selectedRaw.nonCommercialsNet.toLocaleString('de-DE')}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Open Interest + Percentile */}
                      <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                        <div className="text-[8px] uppercase tracking-[0.1em] text-text-secondary font-semibold mb-1.5">Open Interest & Perzentil</div>
                        <div className="space-y-0.5 text-[10px] font-mono tabular-nums">
                          <div className="flex justify-between"><span className="text-text-muted">OI</span><span className="text-text-secondary">{selectedRaw.openInterest.toLocaleString('de-DE')}</span></div>
                          <div className="flex justify-between"><span className="text-text-muted">Comm. Perzentil</span><span className="text-text-secondary">{selectedAnalysis.currentPercentile}%</span></div>
                          <div className="flex justify-between border-t border-white/[0.06] pt-0.5 mt-0.5"><span className="text-text-muted">Spec Perzentil</span><span className="text-text-secondary">{selectedAnalysis.specPercentile}%</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Klartext-Befund: Headline + 3 Säulen */}
                {(() => {
                  const n = describeCurrency(selectedAnalysis);
                  const toneText = (t: string) => t === 'pos' ? 'text-pnl-positive' : t === 'neg' ? 'text-pnl-negative' : 'text-text-muted';
                  const toneDot = (t: string) => t === 'pos' ? 'bg-pnl-positive' : t === 'neg' ? 'bg-pnl-negative' : 'bg-text-muted';
                  return (
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <p className="text-xs text-text-secondary leading-relaxed mb-3">{n.headline}</p>
                      <div className="space-y-2">
                        {n.pillars.map((p, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className={clsx('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', toneDot(p.tone))} />
                            <div>
                              <span className={clsx('text-[10px] uppercase tracking-[0.08em] font-bold', toneText(p.tone))}>{p.label}</span>
                              <p className="text-[11px] text-text-muted leading-snug">{p.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Insights */}
                {(selectedAnalysis.cocDetected || selectedAnalysis.specCommercialDivergence || selectedAnalysis.isExtreme || selectedAnalysis.specCrowdingExtreme) && (
                  <div className="px-4 py-2 border-b border-white/[0.04] space-y-1">
                    {selectedAnalysis.cocDetected && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <Zap size={10} className="text-accent-gold" />
                        <span className="text-accent-gold font-semibold">Change of Character</span>
                        <span className="text-text-muted">
                          {selectedAnalysis.cocType === 'short_to_long' ? 'Short → Long' : 'Long → Short'} am {selectedAnalysis.cocDate}
                        </span>
                      </div>
                    )}
                    {selectedAnalysis.specCommercialDivergence && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <AlertTriangle size={10} className="text-accent-primary" />
                        <span className="text-accent-primary font-semibold">Spec-Divergenz</span>
                        <span className="text-text-muted">{selectedAnalysis.specCommercialDetail}</span>
                      </div>
                    )}
                    {selectedAnalysis.specCrowdingExtreme && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <AlertTriangle size={10} className="text-pnl-negative" />
                        <span className="text-pnl-negative font-semibold">Spec Crowding</span>
                        <span className="text-text-muted">
                          Spekulanten {selectedAnalysis.specCrowdingType === 'crowded_long' ? 'extrem long' : 'extrem short'} (P{selectedAnalysis.specPercentile}%) — Contrarian-Signal
                        </span>
                      </div>
                    )}
                    {selectedAnalysis.isExtreme && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <AlertCircle size={10} className={selectedAnalysis.extremeType === 'overbought' ? 'text-pnl-positive' : 'text-pnl-negative'} />
                        <span className={selectedAnalysis.extremeType === 'overbought' ? 'text-pnl-positive' : 'text-pnl-negative'}>
                          {selectedAnalysis.extremeType === 'overbought' ? 'Überkauft-Zone' : 'Überverkauft-Zone'}
                        </span>
                        <span className="text-text-muted font-semibold">seit {selectedAnalysis.weeksAtExtreme} Wochen</span>
                      </div>
                    )}
                  </div>
                )}

                {/* History Chart */}
                {selectedHistory.length > 0 && (
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">Commercial Net — Verlauf (Historie)</span>
                  </div>
                )}
                {selectedHistory.length > 0 && (
                  <div className="h-48 px-2 pb-3">
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
                          contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', fontSize: '11px' }}
                          formatter={(value: number) => [value.toLocaleString('de-DE'), 'Net']}
                          labelFormatter={(label) => new Date(label).toLocaleDateString('de-DE')}
                        />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="5 5" />
                        <Line
                          type="monotone"
                          dataKey="net"
                          stroke={getScoreColor(selectedAnalysis.smartScore)}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>

          </motion.div>
        )}

        {activeTab === 'pairs' && (
          <motion.div key="pairs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {pairSignals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Target size={24} className="text-text-muted mb-3" />
                <p className="text-xs text-text-primary font-medium mb-1">Keine Pair-Signale</p>
                <p className="text-[10px] text-text-muted">Smart Score Divergenz zwischen Währungen zu gering (&lt;15 Punkte).</p>
              </div>
            ) : (
              <>
                {/* Top Signals */}
                <div className="mb-3 flex items-center gap-2">
                  <Target size={12} className="text-accent-primary" />
                  <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-text-muted">
                    {pairSignals.length} Pair-Signale
                  </span>
                  <span className="text-[9px] text-text-muted">sortiert nach Smart Score Divergenz</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {pairSignals.map((signal, i) => (
                    <motion.div
                      key={signal.pair}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className={clsx(
                        'rounded-xl border bg-background-card p-4',
                        signal.direction === 'long' ? 'border-pnl-positive/15' : 'border-pnl-negative/15'
                      )}
                    >
                      {/* Pair Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold tracking-wide text-text-primary">{signal.pair}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono tabular-nums text-sm font-bold"
                            style={{ color: signal.direction === 'long' ? '#22c55e' : '#ef4444' }}
                          >
                            {signal.smartScore > 0 ? '+' : ''}{signal.smartScore}
                          </span>
                          <span className={clsx(
                            'text-[9px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded',
                            signal.direction === 'long' ? 'bg-pnl-positive/15 text-pnl-positive' : 'bg-pnl-negative/15 text-pnl-negative'
                          )}>
                            {signal.direction === 'long' ? '↑ LONG' : '↓ SHORT'}
                          </span>
                        </div>
                      </div>

                      {/* Klartext: was die Idee bedeutet */}
                      <p className="text-[11px] text-text-secondary leading-snug mb-3">
                        {describePairIdea(signal.pair, signal.direction, signal.baseCurrency, signal.quoteCurrency)}
                      </p>

                      {/* Score Comparison */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 bg-white/[0.02] rounded px-2 py-1.5 text-center">
                          <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted">{signal.baseCurrency}</div>
                          <div className="font-mono tabular-nums text-xs font-bold" style={{ color: getScoreColor(signal.baseSmartScore) }}>
                            {signal.baseSmartScore > 0 ? '+' : ''}{signal.baseSmartScore}
                          </div>
                        </div>
                        <span className="text-text-muted text-[10px]">vs</span>
                        <div className="flex-1 bg-white/[0.02] rounded px-2 py-1.5 text-center">
                          <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted">{signal.quoteCurrency}</div>
                          <div className="font-mono tabular-nums text-xs font-bold" style={{ color: getScoreColor(signal.quoteSmartScore) }}>
                            {signal.quoteSmartScore > 0 ? '+' : ''}{signal.quoteSmartScore}
                          </div>
                        </div>
                      </div>

                      {/* Strength + Momentum */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] uppercase tracking-[0.1em] text-text-muted mr-1">STR</span>
                          {[...Array(5)].map((_, j) => (
                            <div
                              key={j}
                              className={clsx(
                                'w-1.5 h-1.5 rounded-full',
                                j < signal.strength ? 'bg-accent-primary' : 'bg-white/[0.06]'
                              )}
                            />
                          ))}
                        </div>
                        {signal.momentumAligned && (
                          <span className="text-[8px] uppercase tracking-[0.1em] bg-pnl-positive/10 text-pnl-positive px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
                            <CheckCircle2 size={8} /> Momentum ✓
                          </span>
                        )}
                      </div>

                      {/* Reasons */}
                      <div className="space-y-1 mt-2 pt-2 border-t border-white/[0.04]">
                        {signal.reasons.slice(0, 6).map((reason, j) => (
                          <div key={j} className="flex items-start gap-1.5 text-[9px] text-text-muted leading-relaxed">
                            <span className={clsx(
                              'mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0',
                              reason.impact === 'positive' ? 'bg-pnl-positive' :
                              reason.impact === 'negative' ? 'bg-pnl-negative' : 'bg-text-muted'
                            )} />
                            <span>{reason.description}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

          </motion.div>
        )}

        {activeTab === 'ml' && (
          <motion.div key="ml" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* Ehrlicher Hinweis */}
            <div className="mb-4 px-3 py-2 bg-pnl-negative/5 border border-pnl-negative/15 rounded-lg flex items-start gap-2">
              <AlertTriangle className="text-pnl-negative flex-shrink-0 mt-0.5" size={12} />
              <p className="text-[10px] text-text-muted leading-relaxed">
                <span className="text-pnl-negative font-semibold">Experimentell — nicht für Trade-Entscheidungen.</span>{' '}
                Dieses Modell wird auf historischen COT- + Preisdaten trainiert und schätzt, ob der Preis 4 Wochen nach dem Report stieg.
                Forex ist überwiegend zufällig auf Wochenbasis — die Trefferquoten liegen meist nahe 50%. Nutze das Haupt-Dashboard (Währungen + Pair-Ideen) für deine fundamentale Einschätzung, nicht diesen Tab.
              </p>
            </div>


            {mlLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <RefreshCw size={24} className="animate-spin text-accent-primary mb-3" />
                <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Trainiere Logistic Regression + Backtester...</p>
              </div>
            ) : Object.keys(mlPredictions).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Brain size={24} className="text-text-muted mb-3" />
                <p className="text-xs text-text-primary font-medium mb-1">
                  {analyses.length > 0 ? 'Keine Preisdaten verfügbar' : 'ML-Modell noch nicht trainiert'}
                </p>
                <p className="text-[10px] text-text-muted mb-3">
                  {analyses.length > 0
                    ? 'Für die ML-Analyse werden historische Forex-Preise benötigt. Nur in der Desktop-App (Electron) verfügbar.'
                    : 'Klicke "Refresh & Analyse" um COT + Preisdaten zu laden und das Modell zu trainieren.'}
                </p>
                <p className="text-[9px] text-text-muted">Benötigt: 260 Wochen COT-Daten + historische Forex-Preise (frankfurter.app)</p>
              </div>
            ) : (
              <>
                {/* ML Overview */}
                <div className="mb-3 flex items-center gap-2">
                  <Brain size={12} className="text-accent-primary" />
                  <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-text-muted">
                    Logistic Regression — {Object.keys(mlPredictions).length} Modelle trainiert
                  </span>
                </div>

                {/* ML Cards per Currency */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {CURRENCIES.map((currency) => {
                    const ml = mlPredictions[currency.id];
                    if (!ml || ml.dataPoints < 30) return null;

                    return (
                      <motion.div
                        key={currency.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl border border-border bg-background-card p-4"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{currency.flag}</span>
                            <span className="text-xs font-bold text-text-primary">{currency.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={clsx(
                              'text-[9px] uppercase tracking-[0.1em] font-bold px-1.5 py-0.5 rounded',
                              ml.direction === 'bullish' ? 'bg-pnl-positive/15 text-pnl-positive' :
                              ml.direction === 'bearish' ? 'bg-pnl-negative/15 text-pnl-negative' :
                              'bg-white/[0.06] text-text-muted'
                            )}>
                              {ml.direction === 'bullish' ? '↑ BULLISH' : ml.direction === 'bearish' ? '↓ BEARISH' : '— NEUTRAL'}
                            </span>
                            <span className="font-mono tabular-nums text-xs font-bold text-text-secondary">
                              {Math.round(ml.probability * 100)}%
                            </span>
                          </div>
                        </div>

                        {/* Model Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-white/[0.02] rounded px-2 py-1">
                            <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted">Accuracy</div>
                            <div className={clsx('text-[10px] font-bold',
                              ml.modelAccuracy >= 55 ? 'text-pnl-positive' : 'text-text-muted'
                            )}>
                              {ml.modelAccuracy}%
                            </div>
                          </div>
                          <div className="bg-white/[0.02] rounded px-2 py-1">
                            <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted">Win Rate</div>
                            <div className={clsx('text-[10px] font-bold',
                              ml.backtest.winRate >= 55 ? 'text-pnl-positive' : 'text-text-muted'
                            )}>
                              {ml.backtest.winRate}%
                            </div>
                          </div>
                          <div className="bg-white/[0.02] rounded px-2 py-1">
                            <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted">Signale</div>
                            <div className="text-[10px] font-bold text-text-secondary">
                              {ml.backtest.totalSignals}
                            </div>
                          </div>
                        </div>

                        {/* Backtest Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-white/[0.02] rounded px-2 py-1">
                            <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted">Avg Win</div>
                            <div className="text-[10px] font-bold text-pnl-positive">+{ml.backtest.avgWinPct}%</div>
                          </div>
                          <div className="bg-white/[0.02] rounded px-2 py-1">
                            <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted">Avg Loss</div>
                            <div className="text-[10px] font-bold text-pnl-negative">-{ml.backtest.avgLossPct}%</div>
                          </div>
                        </div>

                        {/* Feature Importance (Top 5) */}
                        <div className="mb-2">
                          <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted mb-1">Top-Faktoren</div>
                          {ml.featureImportance.slice(0, 5).map((fi, j) => (
                            <div key={j} className="flex items-center justify-between py-0.5">
                              <span className="text-[9px] text-text-muted truncate flex-1">
                                {FEATURE_LABELS[fi.name] || fi.name}
                              </span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <div className="w-12 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(100, Math.abs(fi.contribution) * 200)}%`,
                                      backgroundColor: fi.contribution > 0 ? '#22c55e' : '#ef4444',
                                    }}
                                  />
                                </div>
                                <span className={clsx('text-[8px] font-mono tabular-nums w-8 text-right',
                                  fi.contribution > 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                                )}>
                                  {fi.contribution > 0 ? '+' : ''}{fi.contribution.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Score Distribution */}
                        {ml.backtest.byScore.length > 0 && (
                          <div>
                            <div className="text-[7px] uppercase tracking-[0.1em] text-text-muted mb-1">Score-Verteilung (Win Rate / Avg Return)</div>
                            <div className="flex gap-1">
                              {ml.backtest.byScore.map((b, j) => (
                                <div key={j} className="flex-1 bg-white/[0.02] rounded px-1 py-0.5 text-center">
                                  <div className="text-[7px] text-text-muted">{b.range}%</div>
                                  <div className={clsx('text-[8px] font-bold',
                                    b.winRate >= 55 ? 'text-pnl-positive' : b.winRate <= 45 ? 'text-pnl-negative' : 'text-text-muted'
                                  )}>
                                    {b.signals > 0 ? `${b.winRate}%` : '—'}
                                  </div>
                                  <div className={clsx('text-[7px] font-mono',
                                    b.avgReturn > 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                                  )}>
                                    {b.signals > 0 ? `${b.avgReturn > 0 ? '+' : ''}${b.avgReturn}%` : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Data Points */}
                        <div className="mt-2 text-[8px] text-text-muted text-right">
                          {ml.dataPoints} Datenpunkte trainiert
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ML Methodology */}
                <div className="px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Methodik</h4>
                  <div className="space-y-1.5 text-[10px] text-text-muted leading-relaxed">
                    <p>
                      <strong className="text-text-secondary">Modell:</strong> Logistic Regression mit L2-Regularisierung, trainiert auf {Object.values(mlPredictions)[0]?.dataPoints || '260'}+ Wochen historischer COT-Daten + Forex-Preisen.
                    </p>
                    <p>
                      <strong className="text-text-secondary">15 Features:</strong> Commercial-Perzentil, Momentum (4W/8W), Momentum-Beschleunigung, Spec-Perzentil, Spec-Commercial-Divergenz, OI-Änderung, OI/Comm-Ratio, Net-Null-Distanz, Volatilität, Trend-Konsistenz, Extremdauer, Short-Ratio, Spec/OI-Ratio, Mean Reversion.
                    </p>
                    <p>
                      <strong className="text-text-secondary">Label:</strong> 1 = Preis stieg 4 Wochen nach dem COT-Report. 0 = Preis fiel. Preisdaten von ECB/frankfurter.app.
                    </p>
                    <p>
                      <strong className="text-text-secondary">Backtest:</strong> Signal-Threshold 55%. Win Rate, Avg Win/Loss und Profit Factor basieren auf allen historischen Signalen über dem Threshold.
                    </p>
                    <p>
                      <strong className="text-text-secondary">Feature Importance:</strong> Zeigt welche Faktoren bei dieser Währung den größten Einfluss auf die aktuelle Prediction haben (Gewicht × Feature-Wert).
                    </p>
                  </div>
                </div>
              </>
            )}

          </motion.div>
        )}
        </AnimatePresence>
      </>
      )}

      {/* ── Info Modal (Lightbulb) ── */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-background-elevated border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] sticky top-0 bg-background-elevated z-10">
              <div className="flex items-center gap-2">
                <Lightbulb className="text-accent-gold" size={14} />
                <span className="text-xs font-semibold text-text-primary">Wie funktioniert Smart COT?</span>
              </div>
              <button onClick={() => setShowInfoModal(false)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-white/[0.06]">
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Update-Frequenz */}
              <div className="px-3 py-2 bg-accent-primary/5 rounded-lg border border-accent-primary/10">
                <p className="text-[10px] text-text-muted leading-relaxed">
                  <strong className="text-accent-primary">Aktualisierung:</strong> Daten werden neu geladen wenn du <strong className="text-text-secondary">"Refresh & Analyse"</strong> klickst.
                  Die CFTC veröffentlicht neue Daten jeden <strong className="text-text-secondary">Freitag um 21:30 CET</strong> (Positionsdaten vom Dienstag).
                  Empfehlung: einmal pro Woche am Wochenende refreshen.
                </p>
              </div>

              {/* Datenquelle */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Woher kommen die Daten?</h4>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Direkt von der CFTC (US-Aufsichtsbehörde). Smart COT lädt die letzten <strong className="text-text-secondary">260 Wochen (5 Jahre)</strong> für
                  8 Währungs-Futures (DXY, EUR, GBP, JPY, CAD, AUD, NZD, CHF). Daten werden in Supabase persistiert.
                </p>
              </div>

              {/* Positionen */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Was bedeuten die Positionen?</h4>
                <div className="space-y-1.5 text-[10px] text-text-muted leading-relaxed">
                  <p><strong className="text-pnl-positive">Commercials (Smart Money)</strong> — Banken und Hedger. Stark long = bullish für Währung.</p>
                  <p><strong className="text-pnl-negative">Non-Commercials (Spekulanten)</strong> — Hedge Funds. Wenn Specs ≠ Commercials = starkes Signal.</p>
                  <p><strong className="text-text-secondary">Open Interest</strong> — Steigendes OI + Net = Überzeugung. Fallendes OI = Schwäche.</p>
                </div>
              </div>

              {/* Smart Score */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Smart Score Berechnung</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Perzentil', 'Position vs. 52W-Range. 80%+ = bullish, 20%- = bearish.'],
                    ['Momentum', '1W/4W/8W Positionsänderung. Beschleunigung = starkes Signal.'],
                    ['Trend', 'Aufbau/Abbau seit X Wochen. Längerer Trend = mehr Gewicht.'],
                    ['Extremzonen', '>4 Wochen am Extrem → Reversionrisiko steigt.'],
                    ['Change of Character', 'Net-Position wechselt Vorzeichen → Umkehr-Signal.'],
                    ['Spec-Divergenz & OI', 'Smart Money ≠ Spekulanten → Score verstärkt.'],
                  ].map(([title, desc], i) => (
                    <div key={i} className="bg-white/[0.02] rounded-lg px-3 py-2">
                      <div className="text-[9px] uppercase tracking-[0.1em] text-accent-primary font-semibold mb-0.5">{title}</div>
                      <p className="text-[10px] text-text-muted">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pair Signale */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Pair-Signale</h4>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Basieren auf <strong className="text-text-secondary">Smart Score Divergenz</strong> zwischen zwei Währungen.
                  Momentum-Alignment ✓ = beide Währungen unterstützen die Richtung.
                  Stärke 1-5 basiert auf Score-Differenz (20+ pro Punkt). Min. Divergenz: 15.
                </p>
              </div>

              {/* ML */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">ML Analyse</h4>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Logistic Regression trainiert auf 260+ Wochen COT + Forex-Preise (ECB/frankfurter.app).
                  15 Features pro Währung. Backtest zeigt historische Win Rate, Avg Win/Loss, Profit Factor.
                  Feature Importance zeigt welche Faktoren bei welcher Währung am meisten zählen.
                </p>
              </div>

              {/* Zins-Carry */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Zins-Carry</h4>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Differenz zwischen dem Leitzins einer Währung und dem Durchschnitt der anderen G10-Währungen.
                  Positiver Carry (höherer Zins) zieht Käufer an → Rückenwind für Long. Fließt direkt in die <strong className="text-text-secondary">Final Conviction</strong> ein:
                  Carry in Score-Richtung verstärkt, Carry gegen den Score schwächt ab. Zinssätze werden bei jedem Refresh mitgeladen.
                </p>
              </div>

              {/* Welche Daten den Markt bewegen */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Welche Daten bewegen den Markt — und wie stark</h4>
                <div className="space-y-1.5">
                  {[
                    ['Zinsentscheid / Notenbank', 'Höchster Impact. Bestimmt den Carry-Trend. Nicht nur die Entscheidung — der TON (hawkish/dovish) und die Projektionen bewegen am meisten.', 'sehr hoch'],
                    ['CPI / Inflation', 'Sehr hoch. Treibt Zinserwartungen direkt. Überraschung nach oben = hawkisch = Währung stark (solange kein Stagflations-Schock).', 'sehr hoch'],
                    ['Arbeitsmarkt (NFP, Quote, Löhne)', 'Hoch — v.a. USA (NFP, erster Freitag). Löhne sind der Inflations-Vorlauf, oft wichtiger als die reine Quote.', 'hoch'],
                    ['BIP / Wachstum', 'Mittel-hoch. Mittelfristiger Treiber. Wachstumsvorsprung zieht Kapital an.', 'mittel'],
                    ['PMI (Einkaufsmanager)', 'Mittel. Frühindikator — zeigt Richtung der Wirtschaft vor den harten Daten.', 'mittel'],
                    ['Einzelhandel / Konsum', 'Mittel. Konsum = Großteil der Wirtschaft, beeinflusst die nächste Notenbank-Sitzung.', 'mittel'],
                    ['Risk-Sentiment (Aktien, VIX, Safe-Haven)', 'Situativ sehr hoch. In Risk-Off steigen JPY/CHF/USD, Carry-Trades brechen — überschreibt kurzfristig die Fundamentaldaten.', 'situativ'],
                  ].map(([title, desc, tag], i) => (
                    <div key={i} className="flex items-start gap-2 bg-white/[0.02] rounded-lg px-3 py-1.5">
                      <span className={clsx('text-[8px] uppercase tracking-[0.08em] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 w-16 text-center',
                        tag === 'sehr hoch' ? 'bg-pnl-negative/15 text-pnl-negative' :
                        tag === 'hoch' ? 'bg-accent-gold/15 text-accent-gold' :
                        tag === 'situativ' ? 'bg-accent-primary/15 text-accent-primary' : 'bg-white/[0.06] text-text-muted'
                      )}>{tag}</span>
                      <div>
                        <div className="text-[10px] text-text-secondary font-semibold">{title}</div>
                        <p className="text-[10px] text-text-muted leading-snug">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-text-muted mt-2 leading-relaxed">
                  <strong className="text-accent-gold">Faustregel:</strong> Nicht die Zahl selbst zählt, sondern die <strong className="text-text-secondary">Überraschung gegenüber dem Forecast</strong>. „Besser als erwartet" = Währung stark, egal ob absolut gut oder schlecht.
                </p>
              </div>

              {/* Sonntags-Routine */}
              <div className="px-3 py-2.5 bg-accent-primary/5 rounded-lg border border-accent-primary/15">
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Deine Sonntags-Routine</h4>
                <ol className="space-y-1 text-[10px] text-text-muted leading-relaxed list-decimal list-inside">
                  <li><strong className="text-text-secondary">„Refresh & Analyse"</strong> klicken — COT, Preise, Zinsen, Kalender frisch laden.</li>
                  <li><strong className="text-text-secondary">Währungs-Stärke-Board</strong> lesen: Wer ist stark, wer schwach? Notiere die 2 stärksten + 2 schwächsten.</li>
                  <li><strong className="text-text-secondary">Risk-Regime</strong> prüfen: Risk-Off? Dann Carry-Paare vorsichtig.</li>
                  <li><strong className="text-text-secondary">Event-Kalender</strong> scannen: Welche deiner Paare haben High-Impact-Events? Diese mit Vorsicht / nach dem Event traden.</li>
                  <li><strong className="text-text-secondary">Pair-Ausblick</strong>: Stärkste gegen schwächste Währung = deine Top-Idee. Konfidenz + Treiber lesen.</li>
                  <li><strong className="text-text-secondary">TradingView</strong>: Für die 2–3 besten Paare das Chart-Setup suchen (Zone, Struktur, Timing). Das Tool gibt die Richtung — den Einstieg machst du im Chart.</li>
                </ol>
              </div>

              {/* Was es NICHT ist — Ehrlichkeit */}
              <div className="px-3 py-2 bg-pnl-negative/5 rounded-lg border border-pnl-negative/15">
                <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-pnl-negative mb-1.5">Was Smart COT NICHT ist</h4>
                <div className="space-y-1 text-[10px] text-text-muted leading-relaxed">
                  <p>• <strong className="text-text-secondary">Kein Chart-Setup-Finder.</strong> Es liefert einen Wochen-Bias (welche Währung stark/schwach), nicht den konkreten Entry. Zone & Timing machst du im Chart.</p>
                  <p>• <strong className="text-text-secondary">Win Rate & KNN messen die COT-Position, nicht den Preis.</strong> „70% Win Rate" heißt: in 70% ähnlicher Fälle bauten die Commercials ihre Position weiter aus — keine Kurs-Trefferquote.</p>
                  <p>• <strong className="text-text-secondary">Wöchentlich.</strong> CFTC liefert Freitag 21:30 CET. Gleiche Zahlen Mo–Do sind korrekt. Zwischen-Dynamik kommt über Zinsen.</p>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="px-3 py-2 bg-accent-gold/5 rounded-lg border border-accent-gold/10">
                <p className="text-[9px] text-text-muted leading-relaxed">
                  <strong className="text-accent-gold">Hinweis:</strong> COT-Daten sind ein langfristiger Indikator (Wochen bis Monate).
                  Kein Ersatz für technische Analyse und Risikomanagement.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Manual Input Modal ── */}
      {showManualInput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-background-elevated border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Edit3 className="text-accent-primary" size={14} />
                <span className="text-xs font-semibold text-text-primary">COT Daten manuell eingeben</span>
              </div>
              <button onClick={() => setShowManualInput(false)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-white/[0.06]">
                <X size={14} />
              </button>
            </div>

            <div className="p-4">
              <p className="text-[10px] text-text-muted mb-3">
                Commercials Long/Short von{' '}
                <a href="https://www.cftc.gov/dea/futures/deacmesf.htm" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">CFTC</a>
                {' '}eingeben. Smart Analyse wird automatisch berechnet.
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3 px-2 mb-1">
                  <div className="w-10" />
                  <div className="flex-1 flex gap-3">
                    <span className="flex-1 text-[9px] uppercase tracking-[0.1em] text-text-muted">Long</span>
                    <span className="flex-1 text-[9px] uppercase tracking-[0.1em] text-text-muted">Short</span>
                    <span className="w-20 text-right text-[9px] uppercase tracking-[0.1em] text-text-muted">Net</span>
                  </div>
                </div>

                {MANUAL_CURRENCIES.map(currency => (
                  <div key={currency.id} className="flex items-center gap-3 px-2 py-1.5 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors">
                    <div className="w-10 text-[10px] font-bold text-text-primary tracking-wide">{currency.id}</div>
                    <div className="flex-1 flex gap-3 items-center">
                      <input
                        type="number"
                        value={manualInputData[currency.id]?.long || ''}
                        onChange={(e) => setManualInputData(prev => ({ ...prev, [currency.id]: { ...prev[currency.id], long: e.target.value } }))}
                        className="flex-1 px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-xs font-mono tabular-nums text-text-primary focus:border-accent-primary/50 focus:outline-none"
                        placeholder="556661"
                      />
                      <input
                        type="number"
                        value={manualInputData[currency.id]?.short || ''}
                        onChange={(e) => setManualInputData(prev => ({ ...prev, [currency.id]: { ...prev[currency.id], short: e.target.value } }))}
                        className="flex-1 px-2 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-xs font-mono tabular-nums text-text-primary focus:border-accent-primary/50 focus:outline-none"
                        placeholder="757245"
                      />
                      <div className={clsx(
                        'w-20 text-right font-mono tabular-nums text-xs font-semibold',
                        (parseInt(manualInputData[currency.id]?.long || '0') - parseInt(manualInputData[currency.id]?.short || '0')) >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                      )}>
                        {((parseInt(manualInputData[currency.id]?.long || '0') - parseInt(manualInputData[currency.id]?.short || '0')) || 0).toLocaleString('de-DE')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/[0.04]">
              <button onClick={() => setShowManualInput(false)} className="text-[10px] uppercase text-text-muted hover:text-text-primary px-3 py-1.5 rounded bg-white/[0.03] hover:bg-white/[0.06]">
                Abbrechen
              </button>
              <button onClick={saveManualData} className="text-[10px] uppercase text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30">
                <Save size={10} /> Speichern & Analysieren
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
