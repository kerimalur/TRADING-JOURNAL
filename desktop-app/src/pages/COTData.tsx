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
  Target, ArrowUpRight, ArrowDownRight, Minus, Brain
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
  const [activeTab, setActiveTab] = useState<'overview' | 'pairs'>('overview');

  useEffect(() => {
    loadData();
  }, []);

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

  const fetchCOTData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const api = getApi();
      if (!api.fetchCOTData) {
        setError('COT-Daten sind nur in der Desktop-App verfügbar.');
        return;
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
    } catch (err) {
      console.error('COT fetch error:', err);
      setError('Fehler beim Laden der COT-Daten.');
    } finally {
      setIsLoading(false);
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

  const sortedAnalyses = useMemo(() => {
    return [...analyses]
      .filter(a => a.latestDate)
      .sort((a, b) => Math.abs(b.smartScore) - Math.abs(a.smartScore));
  }, [analyses]);

  const getScoreColor = (score: number) => {
    if (score >= 40) return '#22c55e';
    if (score >= 15) return '#86efac';
    if (score <= -40) return '#ef4444';
    if (score <= -15) return '#fca5a5';
    return '#9ca3af';
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
            onClick={openManualInput}
            className="text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-text-primary flex items-center gap-1 px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
          >
            <Edit3 size={10} /> Manuell
          </button>

          <button
            onClick={fetchCOTData}
            disabled={isLoading}
            className="text-[10px] uppercase tracking-[0.1em] text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors disabled:opacity-40"
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
          <span className="text-accent-gold font-semibold uppercase tracking-[0.05em]">Smart COT</span>{' '}
          analysiert Momentum, Extremzonen, Change of Character und Spec-Divergenz.{' '}
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
                onClick={fetchCOTData}
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
          <button onClick={fetchCOTData} className="text-[10px] uppercase text-text-primary flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-primary/20 hover:bg-accent-primary/30">
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
        </div>

        <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* ── Smart Score Overview Bar Chart ── */}
            <div className="mb-4 rounded-xl border border-border bg-background-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={12} className="text-accent-primary" />
                <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-text-muted">Smart Score Übersicht</span>
                <span className="text-[9px] text-text-muted ml-1">(-100 bearish ... +100 bullish)</span>
              </div>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreChartData} layout="vertical" margin={{ left: 30, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" domain={[-100, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)' }} stroke="rgba(255,255,255,0.1)" />
                    <YAxis type="category" dataKey="currency" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)', fontWeight: 600 }} stroke="rgba(255,255,255,0.1)" width={30} />
                    <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', fontSize: '11px' }}
                      formatter={(value: number) => [`Score: ${value}`, 'Smart Score']}
                    />
                    <Bar dataKey="score" radius={[2, 2, 2, 2]} barSize={12}>
                      {scoreChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Currency Analysis Cards ── */}
            <BentoGrid cols={2} className="mb-4">
              {CURRENCIES.map((currency, idx) => {
                const analysis = analyses.find(a => a.currency === currency.id);
                const isSelected = selectedCurrency === currency.id;

                if (!analysis || !analysis.latestDate) {
                  return (
                    <BentoCell key={currency.id} delay={idx * 0.04} className="!p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-text-primary">{currency.flag} {currency.id}</span>
                        <span className="text-[10px] text-text-muted">Keine Daten</span>
                      </div>
                    </BentoCell>
                  );
                }

                return (
                  <BentoCell
                    key={currency.id}
                    delay={idx * 0.04}
                    className={clsx('cursor-pointer !p-0 overflow-hidden', isSelected && 'ring-1 ring-accent-primary/60')}
                  >
                    <button
                      onClick={() => setSelectedCurrency(isSelected ? null : currency.id)}
                      className="w-full h-full text-left p-3"
                    >
                      {/* Row 1: Currency + Smart Score */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{currency.flag}</span>
                          <span className="text-xs font-bold text-text-primary tracking-wide">{currency.id}</span>
                          {analysis.cocDetected && (
                            <span className="text-[8px] uppercase tracking-[0.1em] bg-accent-gold/20 text-accent-gold px-1 py-0.5 rounded font-semibold">
                              CoC
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[9px] uppercase tracking-[0.1em] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${getScoreColor(analysis.smartScore)}15`,
                              color: getScoreColor(analysis.smartScore),
                            }}
                          >
                            {getScoreLabel(analysis.smartScore)}
                          </span>
                          <span
                            className="font-mono tabular-nums text-sm font-bold"
                            style={{ color: getScoreColor(analysis.smartScore) }}
                          >
                            {analysis.smartScore > 0 ? '+' : ''}{analysis.smartScore}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Key Metrics */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {/* Momentum */}
                        <div className="bg-white/[0.02] rounded px-2 py-1.5">
                          <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Momentum</div>
                          <div className="flex items-center gap-1">
                            {getMomentumIcon(analysis.momentumSignal)}
                            <span className="text-[10px] text-text-secondary font-medium">
                              {getMomentumLabel(analysis.momentumSignal)}
                            </span>
                          </div>
                        </div>

                        {/* Trend */}
                        <div className="bg-white/[0.02] rounded px-2 py-1.5">
                          <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Trend</div>
                          <div className="text-[10px] text-text-secondary font-medium">
                            {analysis.trendDirection === 'accumulating' ? `Aufbau ${analysis.trendWeeks}W` :
                             analysis.trendDirection === 'distributing' ? `Abbau ${analysis.trendWeeks}W` :
                             'Flat'}
                          </div>
                        </div>

                        {/* Percentile */}
                        <div className="bg-white/[0.02] rounded px-2 py-1.5">
                          <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Perzentil</div>
                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${analysis.currentPercentile}%`,
                                  backgroundColor: getScoreColor(analysis.smartScore),
                                }}
                              />
                            </div>
                            <span className="font-mono tabular-nums text-[10px] text-text-muted">{analysis.currentPercentile}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Alerts / Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {analysis.isExtreme && (
                          <span className={clsx(
                            'text-[8px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5',
                            analysis.extremeType === 'overbought' ? 'bg-pnl-positive/15 text-pnl-positive' : 'bg-pnl-negative/15 text-pnl-negative'
                          )}>
                            <AlertTriangle size={8} />
                            {analysis.extremeType === 'overbought' ? 'Überkauft' : 'Überverkauft'} ({analysis.weeksAtExtreme}W)
                          </span>
                        )}
                        {analysis.specCommercialDivergence && (
                          <span className="text-[8px] uppercase tracking-[0.1em] bg-accent-primary/15 text-accent-primary px-1.5 py-0.5 rounded font-semibold">
                            Spec-Divergenz
                          </span>
                        )}
                        {analysis.oiDivergence && (
                          <span className="text-[8px] uppercase tracking-[0.1em] bg-accent-gold/15 text-accent-gold px-1.5 py-0.5 rounded font-semibold">
                            OI-Divergenz
                          </span>
                        )}
                        <span className="text-[9px] font-mono tabular-nums text-text-muted ml-auto">
                          Net: {analysis.currentNet >= 0 ? '+' : ''}{analysis.currentNet.toLocaleString('de-DE')}
                        </span>
                      </div>
                    </button>
                  </BentoCell>
                );
              })}
            </BentoGrid>

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
                      <span className="text-[10px] text-text-muted ml-2">Smart Analyse Detail</span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCurrency(null)} className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-white/[0.06]">
                    <X size={14} />
                  </button>
                </div>

                {/* Analysis Detail Grid */}
                <div className="grid grid-cols-4 gap-3 px-4 py-3 border-b border-white/[0.04]">
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-1">Momentum 1W</div>
                    <div className={clsx('font-mono tabular-nums text-xs font-semibold', selectedAnalysis.momentum1w >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                      {selectedAnalysis.momentum1w >= 0 ? '+' : ''}{selectedAnalysis.momentum1w.toLocaleString('de-DE')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-1">Momentum 4W</div>
                    <div className={clsx('font-mono tabular-nums text-xs font-semibold', selectedAnalysis.momentum4w >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                      {selectedAnalysis.momentum4w >= 0 ? '+' : ''}{selectedAnalysis.momentum4w.toLocaleString('de-DE')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-1">Momentum 8W</div>
                    <div className={clsx('font-mono tabular-nums text-xs font-semibold', selectedAnalysis.momentum8w >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                      {selectedAnalysis.momentum8w >= 0 ? '+' : ''}{selectedAnalysis.momentum8w.toLocaleString('de-DE')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.1em] text-text-muted mb-1">OI Trend</div>
                    <div className="text-xs text-text-secondary font-medium">
                      {selectedAnalysis.oiTrend === 'rising' ? '↑ Steigend' :
                       selectedAnalysis.oiTrend === 'falling' ? '↓ Fallend' : '→ Flat'}
                    </div>
                  </div>
                </div>

                {/* Insights */}
                {(selectedAnalysis.cocDetected || selectedAnalysis.specCommercialDivergence || selectedAnalysis.isExtreme) && (
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
                  <div className="h-48 px-2 py-3">
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
                        {signal.reasons.slice(0, 4).map((reason, j) => (
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
        </AnimatePresence>
      </>
      )}

      {/* ── Erklärung: Datenquelle & Bedeutung ── */}
      <div className="mt-4 space-y-3">

        {/* Datenquelle */}
        <div className="px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
          <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Woher kommen die Daten?</h4>
          <p className="text-[10px] text-text-muted leading-relaxed mb-2">
            Die Daten stammen direkt von der{' '}
            <a href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">
              CFTC (Commodity Futures Trading Commission)
            </a>
            {' '}— der US-Behörde, die alle Futures-Positionen überwacht.
            Jeden <strong className="text-text-secondary">Freitag um 21:30 CET</strong> veröffentlicht die CFTC den "Commitment of Traders" Report
            mit Positionsdaten vom <strong className="text-text-secondary">Dienstag</strong> derselben Woche (3 Tage Verzögerung).
          </p>
          <p className="text-[10px] text-text-muted leading-relaxed">
            Smart COT lädt automatisch die letzten <strong className="text-text-secondary">52 Wochen</strong> Daten für 8 Währungs-Futures
            (DXY, EUR, GBP, JPY, CAD, AUD, NZD, CHF) von der CFTC-API.
            Die Daten werden lokal gecacht und in Supabase persistiert, damit die History wächst und
            die Analyse mit jeder Woche präziser wird.
          </p>
        </div>

        {/* Was sind Commercials? */}
        <div className="px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
          <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Was bedeuten die Positionen?</h4>
          <div className="space-y-2 text-[10px] text-text-muted leading-relaxed">
            <p>
              <strong className="text-pnl-positive">Commercials (Smart Money)</strong> — Banken, große Institutionen und Hedger.
              Sie nutzen Futures zur Absicherung ihres echten Geschäfts. Wenn Commercials <em>stark long</em> sind,
              positionieren sie sich für eine Aufwertung der Währung. Ihre Positionen gelten als verlässlichster Indikator,
              weil sie am besten informiert sind.
            </p>
            <p>
              <strong className="text-pnl-negative">Non-Commercials (Spekulanten)</strong> — Hedge Funds und große Trader.
              Sie spekulieren auf Preisbewegungen. Wenn Spekulanten und Commercials in <em>entgegengesetzte Richtungen</em> positioniert sind
              ("Spec-Divergenz"), ist das ein starkes Signal — denn historisch liegen die Commercials häufiger richtig.
            </p>
            <p>
              <strong className="text-text-secondary">Open Interest</strong> — Gesamtzahl offener Kontrakte.
              Steigendes OI + steigende Net-Position = <em>überzeugte Positionierung</em>.
              Fallendes OI bei steigender Net-Position = <em>OI-Divergenz</em> = weniger Überzeugung.
            </p>
          </div>
        </div>

        {/* Smart Score Erklärung */}
        <div className="px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
          <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Wie berechnet Smart COT den Score?</h4>
          <div className="space-y-2 text-[10px] text-text-muted leading-relaxed">
            <p>
              Der <strong className="text-text-secondary">Smart Score (-100 bis +100)</strong> kombiniert mehrere Faktoren
              zu einem einzigen Wert pro Währung:
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.1em] text-accent-primary font-semibold mb-1">Perzentil (Basis)</div>
                <p>Wo steht die aktuelle Net-Position im Vergleich zur 52-Wochen-Range?
                  80%+ = überkauft (bullish), 20%- = überverkauft (bearish).</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.1em] text-accent-primary font-semibold mb-1">Momentum (1W/4W/8W)</div>
                <p>Wie schnell ändern Commercials ihre Positionen?
                  4W beschleunigend = starkes Signal. Misst Geschwindigkeit UND Richtung der Positionsänderung.</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.1em] text-accent-primary font-semibold mb-1">Trend</div>
                <p>"Aufbau" = Commercials erhöhen Positionen seit X Wochen.
                  "Abbau" = sie reduzieren. Je länger der Trend, desto mehr Gewicht.</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.1em] text-accent-primary font-semibold mb-1">Extremzonen</div>
                <p>Wenn Commercials &gt;4 Wochen am Extrem stehen, steigt das Reversionrisiko.
                  Score wird leicht abgeschwächt — übertriebene Positionierung = Vorsicht.</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.1em] text-accent-primary font-semibold mb-1">Change of Character</div>
                <p>Wenn die Net-Position das Vorzeichen wechselt (Long→Short oder umgekehrt)
                  oder das Perzentil innerhalb von 4 Wochen von &gt;75% auf &lt;25% flippt — starkes Umkehr-Signal.</p>
              </div>
              <div className="bg-white/[0.02] rounded-lg px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.1em] text-accent-primary font-semibold mb-1">Spec-Divergenz & OI</div>
                <p>Wenn Smart Money ≠ Spekulanten → Score wird verstärkt (Commercials "wissen es besser").
                  OI-Divergenz (OI fällt, Net steigt) → Score wird abgeschwächt.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pair Signale Erklärung */}
        <div className="px-4 py-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
          <h4 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-accent-primary mb-2">Pair-Signale</h4>
          <p className="text-[10px] text-text-muted leading-relaxed mb-2">
            Pair-Empfehlungen entstehen aus der <strong className="text-text-secondary">Smart Score Divergenz</strong> zwischen zwei Währungen.
            Beispiel: EUR Smart Score +45 und USD Smart Score -30 → EUR/USD LONG mit Score +75.
          </p>
          <p className="text-[10px] text-text-muted leading-relaxed mb-2">
            <strong className="text-text-secondary">Momentum-Alignment ✓</strong> erscheint, wenn beide Währungen
            ein Momentum in die gleiche Trade-Richtung haben (Base-Momentum bullish + Quote-Momentum bearish für LONG).
            Pairs mit Momentum-Alignment haben historisch eine höhere Trefferquote.
          </p>
          <p className="text-[10px] text-text-muted leading-relaxed">
            <strong className="text-text-secondary">Stärke (1-5 Punkte)</strong> basiert auf der absoluten Score-Differenz:
            20+ = 1 Punkt, 40+ = 2, 60+ = 3, 80+ = 4, 100+ = 5. Nur Pairs mit Divergenz ≥15 werden angezeigt.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="px-4 py-2 bg-accent-gold/5 rounded-xl border border-accent-gold/10">
          <p className="text-[9px] text-text-muted leading-relaxed">
            <strong className="text-accent-gold">Hinweis:</strong> COT-Daten sind ein langfristiger Indikator (Wochen bis Monate).
            Sie ersetzen keine technische Analyse und kein Risikomanagement.
            Commercials können über Wochen "falsch" liegen, bevor sich ihre Position auszahlt.
            Nutze Smart COT als einen von mehreren Confluences in deiner Analyse.
          </p>
        </div>
      </div>

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
