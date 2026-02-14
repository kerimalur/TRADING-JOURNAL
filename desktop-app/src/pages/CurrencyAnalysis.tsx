/**
 * ========================================================================
 * Trading Journal - Currency Analysis Page
 * ========================================================================
 *
 * "Market Intelligence" Design mit Waage-Visualisierung
 * BentoGrid Layout, horizontale Score-Bars, Balance-Scale Pairs
 *
 * Kombinierte Analyse fuer Waehrungen:
 * - Zinssaetze aller Zentralbanken
 * - News-Bias (bullish/bearish)
 * - COT-Daten Integration
 * - Finale Pair-Empfehlungen
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Globe2,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Newspaper,
  Percent,
  Database,
  ArrowRightLeft,
  Target,
  ExternalLink,
  X,
  Info
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { getApi } from '@/services/webApi';
import { PageTransition } from '@/components/ui/PageTransition';
import { BentoGrid, BentoCell } from '@/components/ui/BentoGrid';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { Gauge } from '@/components/ui/Gauge';

// Waehrungen mit Zentralbank-Info
const CURRENCIES = [
  { id: 'USD', name: 'USD', centralBank: 'Federal Reserve', flag: '\u{1F1FA}\u{1F1F8}' },
  { id: 'EUR', name: 'EUR', centralBank: 'ECB', flag: '\u{1F1EA}\u{1F1FA}' },
  { id: 'GBP', name: 'GBP', centralBank: 'Bank of England', flag: '\u{1F1EC}\u{1F1E7}' },
  { id: 'JPY', name: 'JPY', centralBank: 'Bank of Japan', flag: '\u{1F1EF}\u{1F1F5}' },
  { id: 'CAD', name: 'CAD', centralBank: 'Bank of Canada', flag: '\u{1F1E8}\u{1F1E6}' },
  { id: 'AUD', name: 'AUD', centralBank: 'RBA', flag: '\u{1F1E6}\u{1F1FA}' },
  { id: 'NZD', name: 'NZD', centralBank: 'RBNZ', flag: '\u{1F1F3}\u{1F1FF}' },
  { id: 'CHF', name: 'CHF', centralBank: 'SNB', flag: '\u{1F1E8}\u{1F1ED}' },
];

// Gaengige Pairs
const MAJOR_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
  'AUD/USD', 'NZD/USD', 'USD/CAD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY',
  'AUD/JPY', 'CAD/JPY', 'EUR/AUD', 'GBP/AUD'
];

type Bias = 'bullish' | 'neutral' | 'bearish';
type SignalStrength = 'strong' | 'moderate' | 'weak';

interface CurrencyData {
  currency: string;
  interestRate: number;
  rateChange: 'up' | 'down' | 'hold';
  nextMeeting: string;
  centralBank?: string;
  lastMeeting?: string;
  newsBias: Bias;
  newsStrength: SignalStrength;
  newsReason: string;
  cotBias: Bias;
  cotStrength: SignalStrength;
  cotReason: string;
  overallBias: Bias;
  overallScore: number; // -100 to 100
}

interface PairRecommendation {
  pair: string;
  direction: 'LONG' | 'SHORT';
  confidence: number; // 0-100
  reasons: string[];
  interestDiff: number;
}

interface UpcomingEvent {
  currency: string;
  event: string;
  time: string;
  date: string;
  impact: 'high' | 'medium' | 'low';
}

export function CurrencyAnalysis() {
  const [currencyData, setCurrencyData] = useState<CurrencyData[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pairs'>('overview');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyData | null>(null);
  const [selectedPair, setSelectedPair] = useState<PairRecommendation | null>(null);

  useEffect(() => {
    // Immer neu berechnen beim Laden (Daten sind Zeit-sensitiv)
    refreshData();
  }, []);

  const refreshData = async () => {
    setIsLoading(true);

    // Default/Fallback Zinssaetze (Stand: Februar 2026)
    let interestRates: Record<string, { rate: number; change: 'up' | 'down' | 'hold'; next: string; lastMeeting?: string; centralBank?: string }> = {
      'USD': { rate: 4.25, change: 'down', next: '2026-03-19', lastMeeting: '2026-01-29', centralBank: 'Federal Reserve' },
      'EUR': { rate: 2.75, change: 'down', next: '2026-03-06', lastMeeting: '2026-01-30', centralBank: 'ECB' },
      'GBP': { rate: 4.00, change: 'down', next: '2026-03-20', lastMeeting: '2026-02-06', centralBank: 'Bank of England' },
      'JPY': { rate: 0.50, change: 'up', next: '2026-03-14', lastMeeting: '2026-01-24', centralBank: 'Bank of Japan' },
      'CAD': { rate: 3.50, change: 'down', next: '2026-03-12', lastMeeting: '2026-01-29', centralBank: 'Bank of Canada' },
      'AUD': { rate: 3.60, change: 'down', next: '2026-03-04', lastMeeting: '2026-02-04', centralBank: 'RBA' },
      'NZD': { rate: 4.25, change: 'down', next: '2026-04-09', lastMeeting: '2026-02-19', centralBank: 'RBNZ' },
      'CHF': { rate: 0.75, change: 'hold', next: '2026-03-20', lastMeeting: '2025-12-12', centralBank: 'SNB' },
    };

    // Versuche Zinssaetze ueber unified API zu laden (falls verfuegbar)
    try {
      const api = getApi();
      if (api.fetchInterestRates) {
        console.log('Fetching interest rates...');
        const result = await api.fetchInterestRates();
        if (result.success && result.data) {
          interestRates = result.data;
          console.log('Interest rates loaded from API');
        }
      }
    } catch (e) {
      console.log('Interest rates API not available, using cached data');
    }

    // Lade COT-Daten aus Cache
    const cotData = localStorage.getItem('cotData');
    const cotParsed = cotData ? JSON.parse(cotData) : [];
    const cotLastUpdate = localStorage.getItem('cotLastUpdate');
    const cotIsRecent = cotLastUpdate && (Date.now() - new Date(cotLastUpdate).getTime()) < 7 * 24 * 60 * 60 * 1000;

    // Lade Forex Factory Events
    let loadedEvents: UpcomingEvent[] = [];
    try {
      const api = getApi();
      if (api.fetchEconomicCalendar) {
        console.log('Fetching economic calendar for currency analysis...');
        const calResult = await api.fetchEconomicCalendar();
        if (calResult.success && calResult.data) {
          // Filtere nur High-Impact Events fuer die naechsten Tage
          const today = new Date().toISOString().split('T')[0];
          loadedEvents = (calResult.data as any[])
            .filter((e: any) => e.impact === 'high' && e.date >= today)
            .slice(0, 20) // Max 20 Events
            .map((e: any) => ({
              currency: e.currency,
              event: e.event || e.title,
              time: e.time || 'All Day',
              date: e.date,
              impact: e.impact
            }));
          console.log(`Loaded ${loadedEvents.length} high-impact events`);
        }
      }
    } catch (e) {
      console.log('Calendar API not available');
    }
    setUpcomingEvents(loadedEvents);

    // News Bias basierend auf Zinspolitik und Wirtschaftslage (deterministisch!)
    // Diese Funktion gibt auch eine detaillierte Begruendung zurueck
    const getNewsBiasFromRates = (currency: string, rateChange: 'up' | 'down' | 'hold', rate: number): { bias: Bias; strength: SignalStrength; reason: string } => {
      // JPY ist speziell - Zinserhoehung staerkt Yen (Umkehrung des Carry Trades)
      if (currency === 'JPY') {
        if (rateChange === 'up') {
          return {
            bias: 'bullish',
            strength: 'strong',
            reason: 'BoJ normalisiert Geldpolitik nach Jahren der Negativzinsen. Zinserhoehung reduziert Carry-Trade-Attraktivitaet gegen JPY, was den Yen staerkt. Historische Wende in der japanischen Geldpolitik.'
          };
        }
        if (rateChange === 'down') {
          return { bias: 'bearish', strength: 'moderate', reason: 'Lockere BoJ-Politik schwaecht den Yen.' };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'BoJ haelt Politik stabil.' };
      }

      // USD als Reservewaehrung - globale Bedeutung
      if (currency === 'USD') {
        if (rateChange === 'down') {
          return {
            bias: 'bearish',
            strength: 'moderate',
            reason: 'Fed senkt Zinsen im Rahmen des Lockerungszyklus. Niedrigere Zinsen reduzieren die Attraktivitaet von US-Anleihen fuer internationale Investoren. Dollar verliert an relativer Renditestaerke.'
          };
        }
        if (rateChange === 'up') {
          return { bias: 'bullish', strength: 'strong', reason: 'Fed erhoeht Zinsen - USD wird attraktiver.' };
        }
        if (rate >= 4.0) {
          return {
            bias: 'bullish',
            strength: 'weak',
            reason: `Mit ${rate}% bietet der USD weiterhin attraktive Renditen im globalen Vergleich. Safe-Haven-Status bleibt intakt.`
          };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'Fed haelt Zinsen stabil.' };
      }

      // EUR - EZB Politik
      if (currency === 'EUR') {
        if (rateChange === 'down') {
          return {
            bias: 'bearish',
            strength: 'moderate',
            reason: 'EZB setzt Lockerungszyklus fort wegen schwachem Wachstum in der Eurozone. Besonders Deutschland kaempft mit industrieller Rezession. Niedrigere Zinsen belasten EUR.'
          };
        }
        if (rateChange === 'up') {
          return { bias: 'bullish', strength: 'strong', reason: 'EZB strafft Geldpolitik - EUR wird gestaerkt.' };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'EZB haelt Zinsen stabil.' };
      }

      // GBP - BoE Politik
      if (currency === 'GBP') {
        if (rateChange === 'down') {
          return {
            bias: 'bearish',
            strength: 'moderate',
            reason: 'Bank of England senkt Zinsen vorsichtig. UK-Wirtschaft kaempft mit hoher Inflation und schwachem Wachstum. Graduelle Lockerung belastet das Pfund.'
          };
        }
        if (rateChange === 'up') {
          return { bias: 'bullish', strength: 'strong', reason: 'BoE erhoeht Zinsen - GBP wird gestaerkt.' };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'BoE haelt Zinsen stabil.' };
      }

      // CHF als Safe Haven - besondere Dynamik
      if (currency === 'CHF') {
        return {
          bias: 'neutral',
          strength: 'weak',
          reason: 'SNB verfolgt stabile Politik. CHF profitiert von Safe-Haven-Flows in Krisenzeiten, ist aber durch niedrige Zinsen weniger attraktiv fuer Carry Trades.'
        };
      }

      // Rohstoffwaehrungen (AUD, CAD, NZD)
      if (['AUD', 'CAD', 'NZD'].includes(currency)) {
        const commodityName = currency === 'AUD' ? 'Eisenerz/Gold' : currency === 'CAD' ? 'Oel' : 'Milchprodukte';
        if (rateChange === 'down') {
          return {
            bias: 'bearish',
            strength: rate >= 3.5 ? 'weak' : 'moderate',
            reason: `Zentralbank senkt Zinsen. Als Rohstoffwaehrung abhaengig von ${commodityName}-Preisen und China-Nachfrage. Niedrigere Zinsen reduzieren Carry-Trade-Attraktivitaet.`
          };
        }
        if (rateChange === 'up') {
          return {
            bias: 'bullish',
            strength: rate >= 4.0 ? 'strong' : 'moderate',
            reason: `Zinserhoehung macht ${currency} attraktiver. Rohstoffpreise und China-Wirtschaft als zusaetzliche Faktoren beachten.`
          };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'Zentralbank haelt Zinsen stabil.' };
      }

      // Fallback fuer andere
      if (rateChange === 'down') {
        return { bias: 'bearish', strength: rate >= 3.5 ? 'weak' : 'moderate', reason: 'Zinssenkung belastet die Waehrung.' };
      }
      if (rateChange === 'up') {
        return { bias: 'bullish', strength: rate >= 4.0 ? 'strong' : 'moderate', reason: 'Zinserhoehung staerkt die Waehrung.' };
      }
      return { bias: 'neutral', strength: 'weak', reason: 'Stabile Zinspolitik.' };
    };

    const data: CurrencyData[] = CURRENCIES.map(curr => {
      const rates = interestRates[curr.id];
      const cot = cotParsed.find((c: any) => c.currency === curr.id);

      // News-Bias aus Zinspolitik ableiten (deterministisch, nicht zufaellig)
      const newsBiasData = getNewsBiasFromRates(curr.id, rates.change, rates.rate);

      // COT-Bias aus gespeicherten Daten
      let cotBias: Bias = 'neutral';
      let cotStrength: SignalStrength = 'weak';
      let cotReason = 'Keine aktuellen COT-Daten. Bitte COT-Seite besuchen und Daten laden.';

      if (cot && cotIsRecent) {
        if (cot.signal === 'strong_long') {
          cotBias = 'bullish';
          cotStrength = 'strong';
          cotReason = `Commercials sind stark long (${cot.percentileRank}% Perzentil). Smart Money erwartet Aufwertung.`;
        }
        else if (cot.signal === 'long') {
          cotBias = 'bullish';
          cotStrength = 'moderate';
          cotReason = `Commercials sind long (${cot.percentileRank}% Perzentil). Positive Positionierung.`;
        }
        else if (cot.signal === 'strong_short') {
          cotBias = 'bearish';
          cotStrength = 'strong';
          cotReason = `Commercials sind stark short (${cot.percentileRank}% Perzentil). Smart Money erwartet Abwertung.`;
        }
        else if (cot.signal === 'short') {
          cotBias = 'bearish';
          cotStrength = 'moderate';
          cotReason = `Commercials sind short (${cot.percentileRank}% Perzentil). Negative Positionierung.`;
        }
        else {
          cotReason = `Neutrale Positionierung der Commercials (${cot.percentileRank}% Perzentil).`;
        }
      }

      // Berechne Overall Score
      const biasToScore = (bias: Bias, strength: SignalStrength) => {
        const base = bias === 'bullish' ? 1 : bias === 'bearish' ? -1 : 0;
        const mult = strength === 'strong' ? 40 : strength === 'moderate' ? 25 : 10;
        return base * mult;
      };

      const rateScore = rates.change === 'up' ? 20 : rates.change === 'down' ? -20 : 0;
      const newsScore = biasToScore(newsBiasData.bias, newsBiasData.strength);
      const cotScore = biasToScore(cotBias, cotStrength);

      const overallScore = Math.max(-100, Math.min(100, rateScore + newsScore + cotScore));
      const overallBias: Bias = overallScore > 20 ? 'bullish' : overallScore < -20 ? 'bearish' : 'neutral';

      return {
        currency: curr.id,
        interestRate: rates.rate,
        rateChange: rates.change,
        nextMeeting: rates.next,
        centralBank: rates.centralBank,
        lastMeeting: rates.lastMeeting,
        newsBias: newsBiasData.bias,
        newsStrength: newsBiasData.strength,
        newsReason: newsBiasData.reason,
        cotBias,
        cotStrength,
        cotReason,
        overallBias,
        overallScore
      };
    });

    setCurrencyData(data);
    setLastUpdate(new Date());

    localStorage.setItem('currencyAnalysis', JSON.stringify(data));
    localStorage.setItem('currencyAnalysisDate', new Date().toISOString());

    setIsLoading(false);
  };

  // Generiere Pair-Empfehlungen
  const pairRecommendations = useMemo((): PairRecommendation[] => {
    if (currencyData.length === 0) return [];

    return MAJOR_PAIRS.map(pair => {
      const [base, quote] = pair.split('/');
      const baseData = currencyData.find(c => c.currency === base);
      const quoteData = currencyData.find(c => c.currency === quote);

      if (!baseData || !quoteData) {
        return null;
      }

      const scoreDiff = baseData.overallScore - quoteData.overallScore;
      const interestDiff = baseData.interestRate - quoteData.interestRate;

      // Bei sehr kleinem Score-Unterschied = keine klare Empfehlung
      if (Math.abs(scoreDiff) < 10) {
        return null;
      }

      const reasons: string[] = [];

      // Interest Rate
      if (Math.abs(interestDiff) >= 1) {
        reasons.push(`Zinsdifferenz: ${interestDiff > 0 ? '+' : ''}${interestDiff.toFixed(2)}%`);
      }

      // News
      if (baseData.newsBias !== quoteData.newsBias) {
        reasons.push(`News: ${base} ${baseData.newsBias}, ${quote} ${quoteData.newsBias}`);
      }

      // COT
      if (baseData.cotBias !== quoteData.cotBias) {
        reasons.push(`COT: ${base} ${baseData.cotBias}, ${quote} ${quoteData.cotBias}`);
      }

      const confidence = Math.min(100, Math.abs(scoreDiff) * 1.2);

      return {
        pair,
        direction: scoreDiff > 0 ? 'LONG' : 'SHORT',
        confidence: Math.round(confidence),
        reasons,
        interestDiff
      } as PairRecommendation;
    })
    .filter((r): r is PairRecommendation => r !== null && r.confidence >= 30)
    .sort((a, b) => b.confidence - a.confidence);
  }, [currencyData]);

  const getBiasColor = (bias: Bias) => {
    switch (bias) {
      case 'bullish': return 'text-pnl-positive';
      case 'bearish': return 'text-pnl-negative';
      default: return 'text-text-muted';
    }
  };

  const getBiasIcon = (bias: Bias) => {
    switch (bias) {
      case 'bullish': return <TrendingUp size={16} />;
      case 'bearish': return <TrendingDown size={16} />;
      default: return <Minus size={16} />;
    }
  };

  const getStrengthBars = (strength: SignalStrength) => {
    const count = strength === 'strong' ? 3 : strength === 'moderate' ? 2 : 1;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={clsx(
              'w-1 h-2.5 rounded-[1px]',
              i <= count ? 'bg-accent-gold' : 'bg-white/[0.06]'
            )}
          />
        ))}
      </div>
    );
  };

  const currencyInfo = (id: string) => CURRENCIES.find(c => c.id === id);

  // --- Horizontal score bar for currency rows ---
  const ScoreBar = ({ score, compact = false }: { score: number; compact?: boolean }) => {
    const barH = compact ? 'h-1' : 'h-1.5';
    const pct = 50 + score / 2; // map -100..100 to 0..100
    return (
      <div className={clsx('w-full relative', barH, 'rounded-full overflow-hidden bg-white/[0.04]')}>
        {/* centre tick */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 z-10" />
        {/* filled bar from centre */}
        {score !== 0 && (
          <motion.div
            className={clsx(
              'absolute top-0 bottom-0 rounded-full',
              score > 0 ? 'bg-pnl-positive/70' : 'bg-pnl-negative/70'
            )}
            initial={{ width: 0 }}
            animate={{
              width: `${Math.abs(score) / 2}%`,
              left: score > 0 ? '50%' : undefined,
              right: score < 0 ? '50%' : undefined,
            }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            style={score > 0 ? { left: '50%' } : { right: '50%' }}
          />
        )}
        {/* needle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full z-20"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    );
  };

  // --- Balance scale visual for pair recommendations ---
  const BalanceScale = ({ baseScore, quoteScore, base, quote }: { baseScore: number; quoteScore: number; base: string; quote: string }) => {
    const diff = baseScore - quoteScore;
    // tilt: -1 (left heavy = base stronger) to +1 (right heavy = quote stronger)
    // If base > quote, beam tilts left-down (base heavier = stronger)
    const tiltDeg = Math.max(-12, Math.min(12, -diff * 0.12));

    return (
      <div className="flex flex-col items-center gap-1 py-2">
        {/* Beam */}
        <motion.div
          className="relative w-full h-8 flex items-center"
          initial={{ rotate: 0 }}
          animate={{ rotate: tiltDeg }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{ transformOrigin: 'center center' }}
        >
          <div className="absolute inset-x-4 top-1/2 h-px bg-white/20" />
          {/* Left pan (base) */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border',
              baseScore >= quoteScore
                ? 'bg-pnl-positive/20 border-pnl-positive/40 text-pnl-positive'
                : 'bg-white/[0.03] border-white/10 text-text-muted'
            )}>
              {base}
            </div>
          </div>
          {/* Centre pivot */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent-gold/60" />
          {/* Right pan (quote) */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className={clsx(
              'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border',
              quoteScore > baseScore
                ? 'bg-pnl-positive/20 border-pnl-positive/40 text-pnl-positive'
                : 'bg-white/[0.03] border-white/10 text-text-muted'
            )}>
              {quote}
            </div>
          </div>
        </motion.div>
        {/* Score labels underneath */}
        <div className="flex justify-between w-full px-2">
          <span className={clsx('font-mono tabular-nums text-[10px]', baseScore > 0 ? 'text-pnl-positive' : baseScore < 0 ? 'text-pnl-negative' : 'text-text-muted')}>
            {baseScore > 0 ? '+' : ''}{baseScore}
          </span>
          <span className="text-[9px] text-text-muted uppercase tracking-widest">vs</span>
          <span className={clsx('font-mono tabular-nums text-[10px]', quoteScore > 0 ? 'text-pnl-positive' : quoteScore < 0 ? 'text-pnl-negative' : 'text-text-muted')}>
            {quoteScore > 0 ? '+' : ''}{quoteScore}
          </span>
        </div>
      </div>
    );
  };

  return (
    <PageTransition>
    <div className="page-container">
      {/* ================================================================
          HEADER
          ================================================================ */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <Globe2 size={18} className="text-accent-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">Market Intelligence</h1>
            {lastUpdate && (
              <p className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-mono tabular-nums">
                Updated {lastUpdate.toLocaleDateString('de-DE')} {lastUpdate.toLocaleTimeString('de-DE')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Pill segment control */}
          <div className="flex bg-white/[0.03] rounded-full p-0.5 border border-white/[0.06]">
            {(['overview', 'pairs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'relative px-4 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.08em] transition-all duration-200',
                  activeTab === tab
                    ? 'text-black'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-accent-gold"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{tab === 'overview' ? 'Currencies' : 'Pairs'}</span>
              </button>
            ))}
          </div>

          <button
            onClick={refreshData}
            disabled={isLoading}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium uppercase tracking-[0.06em]',
              'bg-white/[0.03] border border-white/[0.06] text-text-secondary',
              'hover:bg-white/[0.06] hover:text-text-primary transition-all',
              isLoading && 'opacity-60 pointer-events-none'
            )}
          >
            <RefreshCw size={13} className={clsx(isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <BentoGrid cols={4} className="mb-6">
              {/* ================================================================
                  INFO CARD (wide)
                  ================================================================ */}
              <BentoCell size="wide" delay={0} className="bg-white/[0.03]">
                <div className="flex items-start gap-2.5">
                  <Info size={14} className="text-accent-blue mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-accent-blue font-semibold">Analyse-Methodik</span>
                    <ul className="text-[11px] text-text-muted mt-1.5 space-y-0.5 leading-relaxed">
                      <li><span className="text-text-secondary font-medium">Zinsen:</span> Hoehere Zinsen = attraktivere Waehrung</li>
                      <li><span className="text-text-secondary font-medium">Zinspolitik:</span> Erhoehung = bullish, Senkung = bearish</li>
                      <li><span className="text-text-secondary font-medium">COT:</span> Commercials (Smart Money) Positionierung</li>
                      <li><span className="text-text-secondary font-medium">Score:</span> Kombination aller Faktoren (-100 bis +100)</li>
                    </ul>
                    <p className="text-[10px] text-text-muted mt-1.5 flex items-center gap-1.5 opacity-60">
                      <AlertTriangle size={10} />
                      COT-Daten muessen auf der COT-Seite geladen werden
                    </p>
                  </div>
                </div>
              </BentoCell>

              {/* ================================================================
                  SUMMARY METRICS
                  ================================================================ */}
              <BentoCell delay={0.05} className="bg-white/[0.03] flex flex-col justify-center">
                <MetricDisplay
                  label="Bullish"
                  value={currencyData.filter(d => d.overallBias === 'bullish').length}
                  size="lg"
                  icon={<TrendingUp size={12} />}
                  trend="up"
                  trendLabel="Currencies"
                />
              </BentoCell>

              <BentoCell delay={0.1} className="bg-white/[0.03] flex flex-col justify-center">
                <MetricDisplay
                  label="Bearish"
                  value={currencyData.filter(d => d.overallBias === 'bearish').length}
                  size="lg"
                  icon={<TrendingDown size={12} />}
                  trend="down"
                  trendLabel="Currencies"
                />
              </BentoCell>

              {/* ================================================================
                  CURRENCY TABLE (full width, 4-col span)
                  ================================================================ */}
              <BentoCell size="wide-tall" delay={0.15} noPadding className="bg-white/[0.03] col-span-4 !row-span-1">
                <div className="px-4 pt-3 pb-1 flex items-center justify-between border-b border-white/[0.04]">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">Currency Scores</span>
                  <div className="flex items-center gap-3 text-[9px] text-text-muted uppercase tracking-widest">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-pnl-negative/70" /> Bearish</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white/30" /> Neutral</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-pnl-positive/70" /> Bullish</span>
                  </div>
                </div>
                <div className="divide-y divide-white/[0.03]">
                  {currencyData.map((data, idx) => (
                    <motion.button
                      key={data.currency}
                      onClick={() => setSelectedCurrency(data)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors text-left group"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                    >
                      {/* Currency ID + Flag */}
                      <div className="w-16 flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-base">{currencyInfo(data.currency)?.flag}</span>
                        <span className="font-mono text-xs font-bold text-text-primary">{data.currency}</span>
                      </div>

                      {/* Rate */}
                      <div className="w-14 flex-shrink-0 text-right">
                        <span className="font-mono tabular-nums text-xs text-text-secondary">{data.interestRate}%</span>
                        {data.rateChange === 'up' && <TrendingUp size={10} className="inline ml-1 text-pnl-positive" />}
                        {data.rateChange === 'down' && <TrendingDown size={10} className="inline ml-1 text-pnl-negative" />}
                      </div>

                      {/* Bias pills */}
                      <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                        <span className={clsx(
                          'text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                          data.newsBias === 'bullish' && 'bg-pnl-positive/10 text-pnl-positive',
                          data.newsBias === 'bearish' && 'bg-pnl-negative/10 text-pnl-negative',
                          data.newsBias === 'neutral' && 'bg-white/[0.04] text-text-muted'
                        )}>
                          <Newspaper size={8} className="inline mr-0.5 -mt-px" />{data.newsBias.slice(0, 4)}
                        </span>
                        <span className={clsx(
                          'text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                          data.cotBias === 'bullish' && 'bg-pnl-positive/10 text-pnl-positive',
                          data.cotBias === 'bearish' && 'bg-pnl-negative/10 text-pnl-negative',
                          data.cotBias === 'neutral' && 'bg-white/[0.04] text-text-muted'
                        )}>
                          <Database size={8} className="inline mr-0.5 -mt-px" />{data.cotBias.slice(0, 4)}
                        </span>
                      </div>

                      {/* Score bar */}
                      <div className="flex-1 min-w-0">
                        <ScoreBar score={data.overallScore} />
                      </div>

                      {/* Score number */}
                      <div className={clsx(
                        'w-10 text-right font-mono tabular-nums text-xs font-bold',
                        data.overallScore > 20 ? 'text-pnl-positive' :
                        data.overallScore < -20 ? 'text-pnl-negative' : 'text-text-muted'
                      )}>
                        {data.overallScore > 0 ? '+' : ''}{data.overallScore}
                      </div>

                      {/* Bias badge */}
                      <div className={clsx(
                        'w-16 text-center text-[9px] uppercase tracking-wider font-bold py-0.5 rounded flex-shrink-0',
                        data.overallBias === 'bullish' && 'bg-pnl-positive/15 text-pnl-positive',
                        data.overallBias === 'bearish' && 'bg-pnl-negative/15 text-pnl-negative',
                        data.overallBias === 'neutral' && 'bg-white/[0.04] text-text-muted'
                      )}>
                        {data.overallBias}
                      </div>

                      {/* Arrow hint */}
                      <div className="w-4 flex-shrink-0 text-text-muted opacity-0 group-hover:opacity-60 transition-opacity">
                        <Info size={12} />
                      </div>
                    </motion.button>
                  ))}
                </div>
                {/* Scale footer */}
                <div className="px-4 py-1.5 flex justify-between text-[9px] text-text-muted font-mono tabular-nums border-t border-white/[0.04]">
                  <span>-100</span>
                  <span>0</span>
                  <span>+100</span>
                </div>
              </BentoCell>
            </BentoGrid>
          </motion.div>
        ) : (
          <motion.div
            key="pairs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* ================================================================
                PAIR RECOMMENDATIONS
                ================================================================ */}
            {pairRecommendations.length > 0 ? (
              <BentoGrid cols={3} className="mb-6">
                {pairRecommendations.map((rec, idx) => {
                  const [base, quote] = rec.pair.split('/');
                  const baseData = currencyData.find(c => c.currency === base);
                  const quoteData = currencyData.find(c => c.currency === quote);

                  return (
                    <BentoCell
                      key={rec.pair}
                      delay={idx * 0.05}
                      className={clsx(
                        'bg-white/[0.03] cursor-pointer group',
                        'hover:border-white/20'
                      )}
                    >
                      <button onClick={() => setSelectedPair(rec)} className="w-full text-left">
                        {/* Pair header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{currencyInfo(base)?.flag}</span>
                            <span className="font-mono text-xs font-bold text-text-primary">{rec.pair}</span>
                            <span className="text-sm">{currencyInfo(quote)?.flag}</span>
                          </div>
                          <span className={clsx(
                            'text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full',
                            rec.direction === 'LONG'
                              ? 'bg-pnl-positive text-white'
                              : 'bg-pnl-negative text-white'
                          )}>
                            {rec.direction}
                          </span>
                        </div>

                        {/* Balance scale visual */}
                        {baseData && quoteData && (
                          <BalanceScale
                            baseScore={baseData.overallScore}
                            quoteScore={quoteData.overallScore}
                            base={base}
                            quote={quote}
                          />
                        )}

                        {/* Confidence gauge */}
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex-1">
                            <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Konfidenz</span>
                            <div className="mt-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                              <motion.div
                                className={clsx(
                                  'h-full rounded-full',
                                  rec.direction === 'LONG' ? 'bg-pnl-positive' : 'bg-pnl-negative'
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${rec.confidence}%` }}
                                transition={{ duration: 0.8, delay: idx * 0.05 + 0.2 }}
                              />
                            </div>
                          </div>
                          <span className="font-mono tabular-nums text-sm font-bold text-text-primary ml-3">
                            {rec.confidence}%
                          </span>
                        </div>

                        {/* Reasons */}
                        <div className="mt-2 space-y-1">
                          {rec.reasons.map((reason, j) => (
                            <div key={j} className="flex items-center gap-1.5 text-[10px] text-text-muted">
                              <CheckCircle2 size={9} className="text-accent-primary flex-shrink-0" />
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>

                        {/* Click hint */}
                        <div className="mt-2 pt-2 border-t border-white/[0.04] text-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] text-accent-primary uppercase tracking-widest">Details</span>
                        </div>
                      </button>
                    </BentoCell>
                  );
                })}

                {/* Disclaimer cell */}
                <BentoCell delay={pairRecommendations.length * 0.05} className="bg-white/[0.03]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={13} className="text-accent-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.1em] text-text-secondary font-semibold">Hinweis</span>
                      <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                        Diese Empfehlungen basieren auf fundamentalen Faktoren (Zinsen, COT, News) und ersetzen
                        keine technische Analyse. Immer mit eigenem Setup und Risikomanagement traden!
                      </p>
                    </div>
                  </div>
                </BentoCell>
              </BentoGrid>
            ) : (
              <BentoGrid cols={4}>
                <BentoCell size="wide-tall" className="bg-white/[0.03] flex flex-col items-center justify-center col-span-4">
                  <Target size={36} className="text-text-muted/30 mb-3" />
                  <h3 className="text-sm font-semibold text-text-secondary mb-1">Keine starken Empfehlungen</h3>
                  <p className="text-[11px] text-text-muted text-center max-w-xs">
                    Aktuell gibt es keine Pairs mit ausreichend hoher Konfidenz.
                    Aktualisiere die Daten oder warte auf klarere Signale.
                  </p>
                </BentoCell>
              </BentoGrid>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================
          UPCOMING HIGH-IMPACT EVENTS
          ================================================================ */}
      {upcomingEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3 }}
          className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04]">
            <AlertTriangle size={13} className="text-pnl-negative" />
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-secondary font-semibold">High-Impact Events</span>
            <span className="text-[9px] text-text-muted font-mono ml-auto">{upcomingEvents.length} events</span>
          </div>
          <div className="grid grid-cols-4 gap-px bg-white/[0.02]">
            {upcomingEvents.slice(0, 8).map((event, i) => (
              <div
                key={i}
                className="px-3 py-2.5 bg-pnl-negative/[0.04] hover:bg-pnl-negative/[0.08] transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] font-bold text-text-primary">{event.currency}</span>
                  <span className="text-[8px] text-pnl-negative font-bold uppercase tracking-widest">High</span>
                </div>
                <div className="text-[11px] text-text-secondary mb-1 line-clamp-2 leading-tight">{event.event}</div>
                <div className="text-[10px] text-text-muted font-mono tabular-nums">
                  {new Date(event.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {event.time !== 'All Day' && ` ${event.time}`}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-1.5 border-t border-white/[0.04]">
            <p className="text-[9px] text-text-muted flex items-center gap-1 opacity-60">
              <AlertTriangle size={8} />
              Vorsicht beim Traden um High-Impact Events
            </p>
          </div>
        </motion.div>
      )}

      {/* ================================================================
          DATA SOURCES FOOTER
          ================================================================ */}
      <div className="mt-4 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
        <div className="flex items-center gap-6">
          <span className="text-[9px] uppercase tracking-[0.1em] text-text-muted font-semibold">Sources</span>
          <div className="flex flex-wrap gap-4">
            <a href="https://www.forexfactory.com" target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors">
              News Kalender <ExternalLink size={9} />
            </a>
            <a href="https://www.cftc.gov" target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors">
              CFTC COT Reports <ExternalLink size={9} />
            </a>
            <a href="https://www.tradingeconomics.com" target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors">
              Interest Rates <ExternalLink size={9} />
            </a>
          </div>
        </div>
      </div>

      {/* ================================================================
          CURRENCY DETAIL MODAL
          ================================================================ */}
      <AnimatePresence>
        {selectedCurrency && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCurrency(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d0f12] p-5"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{currencyInfo(selectedCurrency.currency)?.flag}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-text-primary">{selectedCurrency.currency}</span>
                      <span className={clsx(
                        'text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full',
                        selectedCurrency.overallBias === 'bullish' && 'bg-pnl-positive/15 text-pnl-positive',
                        selectedCurrency.overallBias === 'bearish' && 'bg-pnl-negative/15 text-pnl-negative',
                        selectedCurrency.overallBias === 'neutral' && 'bg-white/[0.06] text-text-muted'
                      )}>
                        {getBiasIcon(selectedCurrency.overallBias)}
                        <span className="ml-1">{selectedCurrency.overallBias}</span>
                      </span>
                    </div>
                    <span className="text-[10px] text-text-muted">{selectedCurrency.centralBank || currencyInfo(selectedCurrency.currency)?.centralBank}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedCurrency(null)} className="w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors">
                  <X size={14} className="text-text-muted" />
                </button>
              </div>

              {/* Score + Gauge row */}
              <div className="flex items-center gap-5 mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <Gauge
                  value={Math.abs(selectedCurrency.overallScore)}
                  label="Score"
                  sublabel={selectedCurrency.overallScore > 0 ? 'Bullish' : selectedCurrency.overallScore < 0 ? 'Bearish' : 'Neutral'}
                  size="md"
                  color={selectedCurrency.overallScore > 20 ? 'success' : selectedCurrency.overallScore < -20 ? 'danger' : 'warning'}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Gesamt-Score</span>
                    <span className={clsx(
                      'font-mono tabular-nums text-lg font-bold',
                      selectedCurrency.overallScore > 20 ? 'text-pnl-positive' :
                      selectedCurrency.overallScore < -20 ? 'text-pnl-negative' : 'text-text-muted'
                    )}>
                      {selectedCurrency.overallScore > 0 ? '+' : ''}{selectedCurrency.overallScore}
                    </span>
                  </div>
                  <ScoreBar score={selectedCurrency.overallScore} />
                  <div className="flex justify-between text-[9px] text-text-muted font-mono tabular-nums mt-1">
                    <span>-100</span>
                    <span>0</span>
                    <span>+100</span>
                  </div>
                </div>
              </div>

              {/* Factor comparison - side by side */}
              <div className="mb-5">
                <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold mb-2 block">Faktoren-Analyse</span>
                <div className="grid grid-cols-3 gap-2">
                  {/* Interest Rate Factor */}
                  <div className={clsx(
                    'p-3 rounded-xl border',
                    selectedCurrency.rateChange === 'up' ? 'bg-pnl-positive/[0.05] border-pnl-positive/20' :
                    selectedCurrency.rateChange === 'down' ? 'bg-pnl-negative/[0.05] border-pnl-negative/20' :
                    'bg-white/[0.02] border-white/[0.06]'
                  )}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Percent size={12} className="text-accent-gold" />
                      <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-text-muted">Zinssatz</span>
                    </div>
                    <div className="font-mono tabular-nums text-xl font-bold text-text-primary">
                      {selectedCurrency.interestRate}%
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {selectedCurrency.rateChange === 'up' && <TrendingUp size={10} className="text-pnl-positive" />}
                      {selectedCurrency.rateChange === 'down' && <TrendingDown size={10} className="text-pnl-negative" />}
                      {selectedCurrency.rateChange === 'hold' && <Minus size={10} className="text-text-muted" />}
                      <span className={clsx('text-[10px]',
                        selectedCurrency.rateChange === 'up' ? 'text-pnl-positive' :
                        selectedCurrency.rateChange === 'down' ? 'text-pnl-negative' : 'text-text-muted'
                      )}>
                        {selectedCurrency.rateChange === 'up' ? 'Steigend' : selectedCurrency.rateChange === 'down' ? 'Sinkend' : 'Stabil'}
                      </span>
                    </div>
                  </div>

                  {/* News Factor */}
                  <div className={clsx(
                    'p-3 rounded-xl border',
                    selectedCurrency.newsBias === 'bullish' ? 'bg-pnl-positive/[0.05] border-pnl-positive/20' :
                    selectedCurrency.newsBias === 'bearish' ? 'bg-pnl-negative/[0.05] border-pnl-negative/20' :
                    'bg-white/[0.02] border-white/[0.06]'
                  )}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Newspaper size={12} className="text-accent-blue" />
                      <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-text-muted">News</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={clsx('font-bold text-sm capitalize', getBiasColor(selectedCurrency.newsBias))}>
                        {selectedCurrency.newsBias}
                      </span>
                      {getStrengthBars(selectedCurrency.newsStrength)}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed line-clamp-3">
                      {selectedCurrency.newsReason || (
                        selectedCurrency.newsBias === 'bullish'
                          ? `Positive Wirtschaftsnachrichten fuer ${selectedCurrency.currency}.`
                          : selectedCurrency.newsBias === 'bearish'
                          ? `Negative Wirtschaftsnachrichten fuer ${selectedCurrency.currency}.`
                          : `Gemischte Nachrichtenlage fuer ${selectedCurrency.currency}.`
                      )}
                    </p>
                  </div>

                  {/* COT Factor */}
                  <div className={clsx(
                    'p-3 rounded-xl border',
                    selectedCurrency.cotBias === 'bullish' ? 'bg-pnl-positive/[0.05] border-pnl-positive/20' :
                    selectedCurrency.cotBias === 'bearish' ? 'bg-pnl-negative/[0.05] border-pnl-negative/20' :
                    'bg-white/[0.02] border-white/[0.06]'
                  )}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Database size={12} className="text-accent-primary" />
                      <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-text-muted">COT</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={clsx('font-bold text-sm capitalize', getBiasColor(selectedCurrency.cotBias))}>
                        {selectedCurrency.cotBias}
                      </span>
                      {getStrengthBars(selectedCurrency.cotStrength)}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed line-clamp-3">
                      {selectedCurrency.cotReason || (
                        selectedCurrency.cotBias === 'bullish'
                          ? `Commercials (Smart Money) sind netto long positioniert.`
                          : selectedCurrency.cotBias === 'bearish'
                          ? `Commercials (Smart Money) sind netto short positioniert.`
                          : `Neutrale COT-Positionierung. Kein klares Signal.`
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed reasoning */}
              <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info size={12} className="text-accent-primary" />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">
                    Warum {selectedCurrency.overallBias.toUpperCase()}?
                  </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {selectedCurrency.rateChange === 'up'
                    ? `Die Zentralbank hat die Zinsen erhoeht. Hoehere Zinsen machen ${selectedCurrency.currency} attraktiver fuer Investoren, da sie hoehere Renditen auf Einlagen bieten. Dies staerkt die Waehrung.`
                    : selectedCurrency.rateChange === 'down'
                    ? `Die Zentralbank hat die Zinsen gesenkt. Niedrigere Zinsen machen ${selectedCurrency.currency} weniger attraktiv fuer Investoren. Kapital fliesst in Waehrungen mit hoeheren Renditen.`
                    : `Die Zentralbank haelt die Zinsen stabil bei ${selectedCurrency.interestRate}%. Dies signalisiert eine abwartende Haltung der Zentralbank.`
                  }
                </p>
                <p className="text-[10px] text-text-muted mt-1.5 font-mono tabular-nums opacity-60">
                  Naechstes Meeting: {new Date(selectedCurrency.nextMeeting).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>

              {/* Trading Implication */}
              <div className={clsx(
                'p-3 rounded-xl border',
                selectedCurrency.overallBias === 'bullish' ? 'border-pnl-positive/30 bg-pnl-positive/[0.05]' :
                selectedCurrency.overallBias === 'bearish' ? 'border-pnl-negative/30 bg-pnl-negative/[0.05]' :
                'border-white/[0.08] bg-white/[0.02]'
              )}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target size={12} />
                  <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-text-secondary">Trading-Implikation</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  {selectedCurrency.overallBias === 'bullish'
                    ? `Suche Long-Einstiege in Pairs wo ${selectedCurrency.currency} die Basiswaehrung ist (z.B. ${selectedCurrency.currency}/JPY) oder Short-Einstiege wo ${selectedCurrency.currency} die Gegenwaehrung ist.`
                    : selectedCurrency.overallBias === 'bearish'
                    ? `Suche Short-Einstiege in Pairs wo ${selectedCurrency.currency} die Basiswaehrung ist oder Long-Einstiege wo ${selectedCurrency.currency} die Gegenwaehrung ist.`
                    : `Keine klare Richtung. Fokussiere dich auf andere Waehrungen mit staerkerem Bias oder warte auf klarere Signale.`
                  }
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================
          PAIR RECOMMENDATION DETAIL MODAL
          ================================================================ */}
      <AnimatePresence>
        {selectedPair && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPair(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d0f12] p-5"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header - Face-off style */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{currencyInfo(selectedPair.pair.split('/')[0])?.flag}</span>
                    <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      <ArrowRightLeft size={14} className="text-text-muted" />
                    </div>
                    <span className="text-3xl">{currencyInfo(selectedPair.pair.split('/')[1])?.flag}</span>
                  </div>
                  <div>
                    <h2 className="font-mono text-xl font-bold text-text-primary">{selectedPair.pair}</h2>
                    <span className={clsx(
                      'inline-block text-[9px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full mt-0.5',
                      selectedPair.direction === 'LONG'
                        ? 'bg-pnl-positive text-white'
                        : 'bg-pnl-negative text-white'
                    )}>
                      {selectedPair.direction} Empfehlung
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPair(null)}
                  className="w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                >
                  <X size={14} className="text-text-muted" />
                </button>
              </div>

              {/* Confidence */}
              <div className="mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">Konfidenz-Level</span>
                  <span className="font-mono tabular-nums text-xl font-bold text-text-primary">{selectedPair.confidence}%</span>
                </div>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    className={clsx(
                      'h-full rounded-full',
                      selectedPair.direction === 'LONG' ? 'bg-pnl-positive' : 'bg-pnl-negative'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedPair.confidence}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <p className="text-[10px] text-text-muted mt-1.5">
                  {selectedPair.confidence >= 70 ? 'Hohe Konfidenz - Starke fundamentale Uebereinstimmung' :
                   selectedPair.confidence >= 50 ? 'Mittlere Konfidenz - Gute fundamentale Basis' :
                   'Niedrige Konfidenz - Schwaechere fundamentale Signale'}
                </p>
              </div>

              {/* Face-off comparison */}
              <div className="mb-5">
                <div className="flex items-center gap-1.5 mb-3">
                  <Info size={12} className="text-accent-primary" />
                  <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">
                    Warum macht dieser Trade Sinn?
                  </span>
                </div>

                {(() => {
                  const [base, quote] = selectedPair.pair.split('/');
                  const baseData = currencyData.find(c => c.currency === base);
                  const quoteData = currencyData.find(c => c.currency === quote);

                  if (!baseData || !quoteData) return null;

                  return (
                    <div className="space-y-3">
                      {/* Score face-off */}
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Target size={12} className="text-pnl-positive" />
                          <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">Score-Vergleich</span>
                        </div>
                        <div className="flex items-stretch gap-3">
                          {/* Base side */}
                          <div className="flex-1 text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <span className="text-lg">{currencyInfo(base)?.flag}</span>
                            <div className="font-mono text-xs font-bold text-text-muted mt-1">{base}</div>
                            <div className={clsx('font-mono tabular-nums text-2xl font-bold mt-1',
                              baseData.overallScore > 0 ? 'text-pnl-positive' :
                              baseData.overallScore < 0 ? 'text-pnl-negative' : 'text-text-muted'
                            )}>
                              {baseData.overallScore > 0 ? '+' : ''}{baseData.overallScore}
                            </div>
                          </div>
                          {/* VS divider */}
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-px h-full bg-white/[0.06]" />
                            <span className="text-[9px] text-text-muted uppercase tracking-widest my-2 font-bold">vs</span>
                            <div className="w-px h-full bg-white/[0.06]" />
                          </div>
                          {/* Quote side */}
                          <div className="flex-1 text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <span className="text-lg">{currencyInfo(quote)?.flag}</span>
                            <div className="font-mono text-xs font-bold text-text-muted mt-1">{quote}</div>
                            <div className={clsx('font-mono tabular-nums text-2xl font-bold mt-1',
                              quoteData.overallScore > 0 ? 'text-pnl-positive' :
                              quoteData.overallScore < 0 ? 'text-pnl-negative' : 'text-text-muted'
                            )}>
                              {quoteData.overallScore > 0 ? '+' : ''}{quoteData.overallScore}
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-text-muted text-center mt-2 font-mono tabular-nums">
                          <strong>Differenz: {baseData.overallScore - quoteData.overallScore > 0 ? '+' : ''}{baseData.overallScore - quoteData.overallScore}</strong>
                          {' -- '}
                          {selectedPair.direction === 'LONG'
                            ? `${base} ist fundamental staerker als ${quote}`
                            : `${quote} ist fundamental staerker als ${base}`}
                        </p>
                      </div>

                      {/* Interest Rate face-off */}
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Percent size={12} className="text-accent-gold" />
                          <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">Zinsdifferenz-Analyse</span>
                        </div>
                        <div className="flex items-stretch gap-3">
                          <div className="flex-1 text-center p-3 rounded-xl bg-white/[0.02]">
                            <div className="font-mono tabular-nums text-xl font-bold text-text-primary">{baseData.interestRate}%</div>
                            <div className="text-[10px] text-text-muted">{base} Zinssatz</div>
                            <div className={clsx('text-[10px] mt-0.5',
                              baseData.rateChange === 'up' ? 'text-pnl-positive' :
                              baseData.rateChange === 'down' ? 'text-pnl-negative' : 'text-text-muted'
                            )}>
                              {baseData.rateChange === 'up' ? 'Steigend' :
                               baseData.rateChange === 'down' ? 'Sinkend' : 'Stabil'}
                            </div>
                          </div>
                          <div className="flex items-center">
                            <div className="w-px h-full bg-white/[0.06]" />
                          </div>
                          <div className="flex-1 text-center p-3 rounded-xl bg-white/[0.02]">
                            <div className="font-mono tabular-nums text-xl font-bold text-text-primary">{quoteData.interestRate}%</div>
                            <div className="text-[10px] text-text-muted">{quote} Zinssatz</div>
                            <div className={clsx('text-[10px] mt-0.5',
                              quoteData.rateChange === 'up' ? 'text-pnl-positive' :
                              quoteData.rateChange === 'down' ? 'text-pnl-negative' : 'text-text-muted'
                            )}>
                              {quoteData.rateChange === 'up' ? 'Steigend' :
                               quoteData.rateChange === 'down' ? 'Sinkend' : 'Stabil'}
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] text-text-muted text-center mt-2">
                          <strong>Differenz: {selectedPair.interestDiff >= 0 ? '+' : ''}{selectedPair.interestDiff.toFixed(2)}%</strong>
                          {selectedPair.interestDiff > 0.5
                            ? ` - ${base} bietet hoehere Rendite. Carry-Trade favorisiert ${selectedPair.direction === 'LONG' ? 'Long' : 'Short'}.`
                            : selectedPair.interestDiff < -0.5
                            ? ` - ${quote} bietet hoehere Rendite. Carry-Trade-Dynamik beachten.`
                            : ' - Geringe Zinsdifferenz. Andere Faktoren dominieren.'}
                        </p>
                      </div>

                      {/* Fundamental face-off */}
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Newspaper size={12} className="text-accent-blue" />
                          <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">Fundamentale Einschaetzung</span>
                        </div>
                        <div className="flex items-stretch gap-3">
                          <div className={clsx(
                            'flex-1 p-3 rounded-xl border',
                            baseData.newsBias === 'bullish' ? 'border-pnl-positive/20 bg-pnl-positive/[0.04]' :
                            baseData.newsBias === 'bearish' ? 'border-pnl-negative/20 bg-pnl-negative/[0.04]' :
                            'border-white/[0.06] bg-white/[0.02]'
                          )}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-mono text-[10px] font-bold text-text-secondary">{base}</span>
                              {getBiasIcon(baseData.newsBias)}
                              <span className={clsx('text-[9px] uppercase tracking-wider font-bold', getBiasColor(baseData.newsBias))}>
                                {baseData.newsBias}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted line-clamp-3 leading-relaxed">{baseData.newsReason}</p>
                          </div>
                          <div className={clsx(
                            'flex-1 p-3 rounded-xl border',
                            quoteData.newsBias === 'bullish' ? 'border-pnl-positive/20 bg-pnl-positive/[0.04]' :
                            quoteData.newsBias === 'bearish' ? 'border-pnl-negative/20 bg-pnl-negative/[0.04]' :
                            'border-white/[0.06] bg-white/[0.02]'
                          )}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-mono text-[10px] font-bold text-text-secondary">{quote}</span>
                              {getBiasIcon(quoteData.newsBias)}
                              <span className={clsx('text-[9px] uppercase tracking-wider font-bold', getBiasColor(quoteData.newsBias))}>
                                {quoteData.newsBias}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted line-clamp-3 leading-relaxed">{quoteData.newsReason}</p>
                          </div>
                        </div>
                      </div>

                      {/* COT face-off */}
                      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Database size={12} className="text-accent-primary" />
                          <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">COT-Positionierung (Smart Money)</span>
                        </div>
                        <div className="flex items-stretch gap-3">
                          <div className={clsx(
                            'flex-1 p-3 rounded-xl border',
                            baseData.cotBias === 'bullish' ? 'border-pnl-positive/20 bg-pnl-positive/[0.04]' :
                            baseData.cotBias === 'bearish' ? 'border-pnl-negative/20 bg-pnl-negative/[0.04]' :
                            'border-white/[0.06] bg-white/[0.02]'
                          )}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-mono text-[10px] font-bold text-text-secondary">{base}</span>
                              {getBiasIcon(baseData.cotBias)}
                              <span className={clsx('text-[9px] uppercase tracking-wider font-bold', getBiasColor(baseData.cotBias))}>
                                {baseData.cotBias}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted leading-relaxed">{baseData.cotReason}</p>
                          </div>
                          <div className={clsx(
                            'flex-1 p-3 rounded-xl border',
                            quoteData.cotBias === 'bullish' ? 'border-pnl-positive/20 bg-pnl-positive/[0.04]' :
                            quoteData.cotBias === 'bearish' ? 'border-pnl-negative/20 bg-pnl-negative/[0.04]' :
                            'border-white/[0.06] bg-white/[0.02]'
                          )}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-mono text-[10px] font-bold text-text-secondary">{quote}</span>
                              {getBiasIcon(quoteData.cotBias)}
                              <span className={clsx('text-[9px] uppercase tracking-wider font-bold', getBiasColor(quoteData.cotBias))}>
                                {quoteData.cotBias}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted leading-relaxed">{quoteData.cotReason}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Trading Recommendation Box */}
              <div className={clsx(
                'p-3 rounded-xl border',
                selectedPair.direction === 'LONG'
                  ? 'border-pnl-positive/30 bg-pnl-positive/[0.06]'
                  : 'border-pnl-negative/30 bg-pnl-negative/[0.06]'
              )}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CheckCircle2 size={14} className={selectedPair.direction === 'LONG' ? 'text-pnl-positive' : 'text-pnl-negative'} />
                  <span className="font-bold text-sm text-text-primary">Fazit</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Die fundamentale Analyse spricht fuer einen <strong className="text-text-primary">{selectedPair.direction}</strong> Trade in {selectedPair.pair}.
                  {selectedPair.confidence >= 60
                    ? ' Die Konfluenz mehrerer Faktoren (Zinsen, COT, News-Bias) gibt diesem Setup eine solide Grundlage.'
                    : ' Obwohl einige Faktoren uebereinstimmen, warte idealerweise auf technische Bestaetigung.'}
                </p>
                <div className="mt-2 p-2 rounded-lg bg-black/20">
                  <p className="text-[10px] text-text-muted">
                    <strong>Wichtig:</strong> Dies ist eine fundamentale Einschaetzung. Kombiniere sie immer mit technischer Analyse
                    (Support/Resistance, Price Action, Trend) und solidem Risikomanagement!
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </PageTransition>
  );
}
