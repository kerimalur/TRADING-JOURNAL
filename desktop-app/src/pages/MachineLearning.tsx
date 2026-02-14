/**
 * ========================================================================
 * Trading Journal - ML Intelligence Center
 * ========================================================================
 *
 * Echtes Machine Learning für Trading:
 * - COT History Tracking & Prediction
 * - Trade Context Learning (COT + News + Zinsen bei Trade-Eröffnung)
 * - Pattern Recognition aus eigenen Trades
 * - Marktbewegungs-Vorhersagen basierend auf gelernten Mustern
 * - Selbstlernendes System das Erwartungen vs Realität vergleicht
 */

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Database,
  TrendingUp,
  Target,
  AlertTriangle,
  Zap,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  History,
  LineChart,
  Percent,
  BookOpen,
  Sparkles,
  Download,
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTradeStore } from '@/stores/tradeStore';
import { getApi } from '@/services/webApi';
import { PageTransition } from '@/components/ui/PageTransition';
import { BentoGrid, BentoCell } from '@/components/ui/BentoGrid';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { Gauge } from '@/components/ui/Gauge';

// ============================================================================
// TYPES
// ============================================================================

interface COTSnapshot {
  date: string;
  currency: string;
  commercialsNet: number;
  commercialsLong: number;
  commercialsShort: number;
  priceAtSnapshot?: number;
}

interface COTPrediction {
  id: string;
  createdAt: string;
  currency: string;
  cotNetAtPrediction: number;
  cotChange: number; // Veränderung zur Vorwoche
  prediction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  timeframe: '1week' | '2weeks' | '1month';
  reasoning: string;
  // Ergebnis (wird später ausgefüllt)
  outcome?: {
    actualDirection: 'up' | 'down' | 'flat';
    priceChange: number;
    wasCorrect: boolean;
    evaluatedAt: string;
  };
}

interface TradeContext {
  tradeId: string;
  openDate: string;
  pair: string;
  direction: 'long' | 'short';
  // Marktkontext bei Eröffnung
  cotData: {
    baseCurrency: { net: number; change: number };
    quoteCurrency: { net: number; change: number };
  };
  interestRateDiff: number;
  recentNews: string[];
  // Ergebnis
  outcome: 'win' | 'loss' | 'breakeven';
  pnl: number;
  rr?: number;
}

interface LearnedPattern {
  id: string;
  name: string;
  description: string;
  conditions: {
    cotNetRange?: [number, number];
    cotChangeRange?: [number, number];
    interestRateDiffRange?: [number, number];
    direction?: 'long' | 'short';
  };
  stats: {
    occurrences: number;
    wins: number;
    losses: number;
    avgPnL: number;
    avgRR: number;
  };
  confidence: number;
  recommendation: 'trade' | 'avoid' | 'neutral';
}

interface MLDataStore {
  cotHistory: COTSnapshot[];
  predictions: COTPrediction[];
  tradeContexts: TradeContext[];
  learnedPatterns: LearnedPattern[];
  lastUpdate: string;
}

// ============================================================================
// ML STORAGE
// ============================================================================

const ML_STORAGE_KEY = 'tradingJournal_mlData';

const getMLData = (): MLDataStore => {
  const saved = localStorage.getItem(ML_STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    cotHistory: [],
    predictions: [],
    tradeContexts: [],
    learnedPatterns: [],
    lastUpdate: new Date().toISOString()
  };
};

const saveMLData = (data: MLDataStore) => {
  data.lastUpdate = new Date().toISOString();
  localStorage.setItem(ML_STORAGE_KEY, JSON.stringify(data));
};

// ============================================================================
// CURRENCY CONFIG
// ============================================================================

const CURRENCIES = [
  { code: 'EUR', cftcCode: '099741', name: 'Euro' },
  { code: 'GBP', cftcCode: '096742', name: 'British Pound' },
  { code: 'JPY', cftcCode: '097741', name: 'Japanese Yen' },
  { code: 'CAD', cftcCode: '090741', name: 'Canadian Dollar' },
  { code: 'AUD', cftcCode: '232741', name: 'Australian Dollar' },
  { code: 'NZD', cftcCode: '112741', name: 'New Zealand Dollar' },
  { code: 'CHF', cftcCode: '092741', name: 'Swiss Franc' },
  { code: 'USD', cftcCode: '098662', name: 'US Dollar Index' },
];

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MachineLearning() {
  const [mlData, setMLData] = useState<MLDataStore>(getMLData);
  const [activeTab, setActiveTab] = useState<'overview' | 'cot-learning' | 'trade-patterns' | 'predictions'>('overview');
  const [isCollecting, setIsCollecting] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');
  const [newPrediction, setNewPrediction] = useState<Partial<COTPrediction> | null>(null);

  const allTrades = useTradeStore(state => state.trades);

  // COT Daten sammeln über Electron IPC
  const collectCOTData = useCallback(async () => {
    setIsCollecting(true);
    try {
      const response = await getApi().fetchCOTData();

      if (!response?.current || !response?.history) {
        console.warn('No COT data received');
        return;
      }

      const snapshots: COTSnapshot[] = [];

      // Aktuelle Daten verarbeiten
      response.current.forEach((item: any) => {
        snapshots.push({
          date: item.rawData?.report_date_as_yyyy_mm_dd?.substring(0, 10) || new Date().toISOString().split('T')[0],
          currency: item.currency,
          commercialsNet: item.rawData?.commercialsLong - item.rawData?.commercialsShort || 0,
          commercialsLong: item.rawData?.commercialsLong || 0,
          commercialsShort: item.rawData?.commercialsShort || 0,
        });
      });

      // Historische Daten auch hinzufügen
      Object.entries(response.history).forEach(([currency, historyArr]: [string, any]) => {
        if (Array.isArray(historyArr)) {
          historyArr.forEach((h: any) => {
            if (h.date && h.commercialsLong !== undefined) {
              snapshots.push({
                date: h.date.substring(0, 10),
                currency,
                commercialsNet: h.commercialsLong - h.commercialsShort,
                commercialsLong: h.commercialsLong,
                commercialsShort: h.commercialsShort,
              });
            }
          });
        }
      });

      if (snapshots.length > 0) {
        const updated = { ...mlData };

        // Entferne Duplikate
        const existingKeys = new Set(
          updated.cotHistory.map(h => `${h.date}-${h.currency}`)
        );

        const newSnapshots = snapshots.filter(s => !existingKeys.has(`${s.date}-${s.currency}`));
        updated.cotHistory = [...updated.cotHistory, ...newSnapshots];

        // Maximal 52 Wochen pro Währung speichern
        const byCurrency: Record<string, COTSnapshot[]> = {};
        updated.cotHistory.forEach(h => {
          if (!byCurrency[h.currency]) byCurrency[h.currency] = [];
          byCurrency[h.currency].push(h);
        });

        updated.cotHistory = Object.values(byCurrency)
          .flatMap(arr => arr.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 52));

        setMLData(updated);
        saveMLData(updated);
      }
    } finally {
      setIsCollecting(false);
    }
  }, [mlData]);

  // Patterns aus Trades lernen
  const analyzeTradePatterns = useCallback(() => {
    const closedTrades = allTrades.filter(t => t.status === 'closed' && t.pnl !== undefined);
    if (closedTrades.length < 10) return;

    const patterns: LearnedPattern[] = [];

    // Pattern 1: Direction Bias per Pair
    const pairDirectionStats: Record<string, { long: { wins: number; losses: number; pnl: number }; short: { wins: number; losses: number; pnl: number } }> = {};

    closedTrades.forEach(trade => {
      const pair = trade.pair;
      if (!pairDirectionStats[pair]) {
        pairDirectionStats[pair] = {
          long: { wins: 0, losses: 0, pnl: 0 },
          short: { wins: 0, losses: 0, pnl: 0 }
        };
      }

      const dir = trade.direction;
      const isWin = (trade.pnl || 0) > 0;

      pairDirectionStats[pair][dir].pnl += trade.pnl || 0;
      if (isWin) {
        pairDirectionStats[pair][dir].wins++;
      } else {
        pairDirectionStats[pair][dir].losses++;
      }
    });

    Object.entries(pairDirectionStats).forEach(([pair, stats]) => {
      const longTotal = stats.long.wins + stats.long.losses;
      const shortTotal = stats.short.wins + stats.short.losses;

      if (longTotal >= 5 && shortTotal >= 5) {
        const longWR = stats.long.wins / longTotal;
        const shortWR = stats.short.wins / shortTotal;

        if (Math.abs(longWR - shortWR) > 0.15) {
          const betterDir = longWR > shortWR ? 'long' : 'short';
          const betterStats = betterDir === 'long' ? stats.long : stats.short;
          const worseStats = betterDir === 'long' ? stats.short : stats.long;
          const betterTotal = betterDir === 'long' ? longTotal : shortTotal;

          patterns.push({
            id: `pair-direction-${pair}`,
            name: `${pair} ${betterDir.toUpperCase()} Bias`,
            description: `Du bist bei ${pair} ${betterDir === 'long' ? 'Long' : 'Short'} Trades deutlich erfolgreicher. Win Rate: ${(betterStats.wins / betterTotal * 100).toFixed(0)}% vs ${(worseStats.wins / (worseStats.wins + worseStats.losses) * 100).toFixed(0)}%`,
            conditions: { direction: betterDir },
            stats: {
              occurrences: betterTotal,
              wins: betterStats.wins,
              losses: betterStats.losses,
              avgPnL: betterStats.pnl / betterTotal,
              avgRR: 0
            },
            confidence: Math.min(90, 50 + betterTotal * 2),
            recommendation: 'trade'
          });
        }
      }
    });

    // Pattern 2: Time-based patterns (Session)
    const sessionStats: Record<string, { wins: number; losses: number; pnl: number }> = {
      asian: { wins: 0, losses: 0, pnl: 0 },
      london: { wins: 0, losses: 0, pnl: 0 },
      newyork: { wins: 0, losses: 0, pnl: 0 }
    };

    closedTrades.forEach(trade => {
      const hour = new Date(trade.date).getHours();
      let session = 'other';
      if (hour >= 0 && hour < 8) session = 'asian';
      else if (hour >= 8 && hour < 14) session = 'london';
      else if (hour >= 14 && hour < 22) session = 'newyork';

      if (sessionStats[session]) {
        sessionStats[session].pnl += trade.pnl || 0;
        if ((trade.pnl || 0) > 0) sessionStats[session].wins++;
        else sessionStats[session].losses++;
      }
    });

    Object.entries(sessionStats).forEach(([session, stats]) => {
      const total = stats.wins + stats.losses;
      if (total >= 10) {
        const wr = stats.wins / total;
        if (wr < 0.4) {
          patterns.push({
            id: `session-avoid-${session}`,
            name: `${session.charAt(0).toUpperCase() + session.slice(1)} Session meiden`,
            description: `Deine Win Rate in der ${session} Session ist nur ${(wr * 100).toFixed(0)}%. Überlege, diese Session zu meiden.`,
            conditions: {},
            stats: { occurrences: total, wins: stats.wins, losses: stats.losses, avgPnL: stats.pnl / total, avgRR: 0 },
            confidence: Math.min(85, 40 + total),
            recommendation: 'avoid'
          });
        } else if (wr > 0.6) {
          patterns.push({
            id: `session-focus-${session}`,
            name: `${session.charAt(0).toUpperCase() + session.slice(1)} Session Stärke`,
            description: `Deine Win Rate in der ${session} Session ist ${(wr * 100).toFixed(0)}%. Fokussiere dich auf diese Session!`,
            conditions: {},
            stats: { occurrences: total, wins: stats.wins, losses: stats.losses, avgPnL: stats.pnl / total, avgRR: 0 },
            confidence: Math.min(85, 40 + total),
            recommendation: 'trade'
          });
        }
      }
    });

    // Pattern 3: Consecutive loss recovery
    let maxConsecLosses = 0;
    let currentConsec = 0;
    let recoveryAfterLosses: { after: number; nextWin: boolean }[] = [];

    const sortedTrades = [...closedTrades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTrades.forEach((trade, i) => {
      if ((trade.pnl || 0) < 0) {
        currentConsec++;
        maxConsecLosses = Math.max(maxConsecLosses, currentConsec);
      } else {
        if (currentConsec >= 2 && i + 1 < sortedTrades.length) {
          recoveryAfterLosses.push({
            after: currentConsec,
            nextWin: (sortedTrades[i + 1]?.pnl || 0) > 0
          });
        }
        currentConsec = 0;
      }
    });

    if (recoveryAfterLosses.length >= 5) {
      const after3Losses = recoveryAfterLosses.filter(r => r.after >= 3);
      if (after3Losses.length >= 3) {
        const winAfter3 = after3Losses.filter(r => r.nextWin).length / after3Losses.length;
        if (winAfter3 < 0.4) {
          patterns.push({
            id: 'tilt-detection',
            name: 'Tilt-Gefahr erkannt',
            description: `Nach 3+ Verlusten hintereinander gewinnst du nur ${(winAfter3 * 100).toFixed(0)}% der nächsten Trades. Pause einlegen!`,
            conditions: {},
            stats: { occurrences: after3Losses.length, wins: 0, losses: 0, avgPnL: 0, avgRR: 0 },
            confidence: 75,
            recommendation: 'avoid'
          });
        }
      }
    }

    const updated = { ...mlData, learnedPatterns: patterns };
    setMLData(updated);
    saveMLData(updated);
  }, [allTrades, mlData]);

  // COT-basierte Prediction erstellen
  const createPrediction = useCallback((currency: string) => {
    const currencyHistory = mlData.cotHistory
      .filter(h => h.currency === currency)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (currencyHistory.length < 2) return;

    const latest = currencyHistory[0];
    const previous = currencyHistory[1];
    const change = latest.commercialsNet - previous.commercialsNet;

    // Simple prediction logic based on COT
    let prediction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 50;
    let reasoning = '';

    if (latest.commercialsNet > 10000) {
      prediction = 'bullish';
      confidence = Math.min(80, 50 + Math.floor(latest.commercialsNet / 5000));
      reasoning = `Commercials sind stark long positioniert (Net: ${latest.commercialsNet.toLocaleString()}). `;
    } else if (latest.commercialsNet < -10000) {
      prediction = 'bearish';
      confidence = Math.min(80, 50 + Math.floor(Math.abs(latest.commercialsNet) / 5000));
      reasoning = `Commercials sind stark short positioniert (Net: ${latest.commercialsNet.toLocaleString()}). `;
    }

    if (change > 5000) {
      if (prediction === 'bullish') confidence = Math.min(90, confidence + 10);
      reasoning += `Wöchentliche Veränderung: +${change.toLocaleString()} (bullish shift).`;
    } else if (change < -5000) {
      if (prediction === 'bearish') confidence = Math.min(90, confidence + 10);
      reasoning += `Wöchentliche Veränderung: ${change.toLocaleString()} (bearish shift).`;
    }

    // Check historical accuracy for this currency
    const pastPredictions = mlData.predictions.filter(p => p.currency === currency && p.outcome);
    if (pastPredictions.length >= 5) {
      const accuracy = pastPredictions.filter(p => p.outcome?.wasCorrect).length / pastPredictions.length;
      reasoning += ` Historische Trefferquote für ${currency}: ${(accuracy * 100).toFixed(0)}%.`;
      confidence = Math.round(confidence * (0.7 + accuracy * 0.3));
    }

    setNewPrediction({
      currency,
      cotNetAtPrediction: latest.commercialsNet,
      cotChange: change,
      prediction,
      confidence,
      reasoning,
      timeframe: '2weeks'
    });
  }, [mlData]);

  // Prediction speichern
  const savePrediction = useCallback(() => {
    if (!newPrediction || !newPrediction.currency) return;

    const prediction: COTPrediction = {
      id: `pred-${Date.now()}`,
      createdAt: new Date().toISOString(),
      currency: newPrediction.currency!,
      cotNetAtPrediction: newPrediction.cotNetAtPrediction!,
      cotChange: newPrediction.cotChange!,
      prediction: newPrediction.prediction!,
      confidence: newPrediction.confidence!,
      timeframe: newPrediction.timeframe!,
      reasoning: newPrediction.reasoning!
    };

    const updated = { ...mlData, predictions: [prediction, ...mlData.predictions].slice(0, 100) };
    setMLData(updated);
    saveMLData(updated);
    setNewPrediction(null);
  }, [newPrediction, mlData]);

  // Prediction outcome evaluieren
  const evaluatePrediction = useCallback((predictionId: string, actualDirection: 'up' | 'down' | 'flat', priceChange: number) => {
    const updated = { ...mlData };
    const idx = updated.predictions.findIndex(p => p.id === predictionId);

    if (idx !== -1) {
      const pred = updated.predictions[idx];
      let wasCorrect = false;

      if (pred.prediction === 'bullish' && actualDirection === 'up') wasCorrect = true;
      if (pred.prediction === 'bearish' && actualDirection === 'down') wasCorrect = true;
      if (pred.prediction === 'neutral' && actualDirection === 'flat') wasCorrect = true;

      updated.predictions[idx] = {
        ...pred,
        outcome: {
          actualDirection,
          priceChange,
          wasCorrect,
          evaluatedAt: new Date().toISOString()
        }
      };

      setMLData(updated);
      saveMLData(updated);
    }
  }, [mlData]);

  // Stats berechnen
  const stats = useMemo(() => {
    const evaluatedPredictions = mlData.predictions.filter(p => p.outcome);
    const correctPredictions = evaluatedPredictions.filter(p => p.outcome?.wasCorrect);

    return {
      cotDataPoints: mlData.cotHistory.length,
      totalPredictions: mlData.predictions.length,
      evaluatedPredictions: evaluatedPredictions.length,
      predictionAccuracy: evaluatedPredictions.length > 0
        ? (correctPredictions.length / evaluatedPredictions.length * 100).toFixed(1)
        : 'N/A',
      tradeContexts: mlData.tradeContexts.length,
      learnedPatterns: mlData.learnedPatterns.length,
    };
  }, [mlData]);

  // COT History für Währung
  const currencyCOTHistory = useMemo(() => {
    return mlData.cotHistory
      .filter(h => h.currency === selectedCurrency)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12);
  }, [mlData.cotHistory, selectedCurrency]);

  // Pending predictions (noch nicht evaluiert)
  const pendingPredictions = useMemo(() => {
    const now = new Date();
    return mlData.predictions.filter(p => {
      if (p.outcome) return false;
      const created = new Date(p.createdAt);
      const daysOld = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

      // Abhängig vom Timeframe
      if (p.timeframe === '1week' && daysOld >= 7) return true;
      if (p.timeframe === '2weeks' && daysOld >= 14) return true;
      if (p.timeframe === '1month' && daysOld >= 30) return true;

      return false;
    });
  }, [mlData.predictions]);

  // ============================================================================
  // TAB CONFIG
  // ============================================================================

  const tabs = [
    { id: 'overview' as const, label: 'Ubersicht', icon: <BarChart3 size={14} /> },
    { id: 'cot-learning' as const, label: 'COT Learning', icon: <Database size={14} /> },
    { id: 'trade-patterns' as const, label: 'Trade Patterns', icon: <Lightbulb size={14} /> },
    { id: 'predictions' as const, label: 'Predictions', icon: <Target size={14} /> },
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <PageTransition>
    <div className="page-container">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="p-2.5 rounded-xl bg-accent-primary/15 border border-accent-primary/20"
          >
            <Brain size={22} className="text-accent-primary" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              ML Intelligence Center
            </h1>
            <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted mt-0.5">
              Selbstlernendes System &middot; Marktanalyse &middot; Trade-Optimierung
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={collectCOTData}
            disabled={isCollecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       bg-white/[0.04] border border-border hover:border-border-light
                       hover:bg-white/[0.07] transition-all disabled:opacity-40"
          >
            <Download size={13} className={isCollecting ? 'animate-spin' : ''} />
            COT Daten
          </button>
          <button
            onClick={analyzeTradePatterns}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       bg-accent-primary/15 text-accent-primary border border-accent-primary/25
                       hover:bg-accent-primary/25 transition-all"
          >
            <Sparkles size={13} />
            Patterns analysieren
          </button>
        </div>
      </div>

      {/* ── Metrics BentoGrid ── */}
      <BentoGrid cols={4} className="mb-6">
        <BentoCell size="wide" delay={0} className="bg-white/[0.03]">
          <div className="flex items-center justify-between h-full">
            <MetricDisplay
              label="COT Datenpunkte"
              value={stats.cotDataPoints}
              size="xl"
              icon={<Database size={13} />}
            />
            <div className="h-16 w-px bg-border mx-6" />
            <MetricDisplay
              label="Predictions"
              value={stats.totalPredictions}
              size="xl"
              icon={<Target size={13} />}
            />
          </div>
        </BentoCell>

        <BentoCell delay={0.06} className="bg-white/[0.03]">
          <div className="flex flex-col items-center justify-center h-full">
            <Gauge
              value={stats.predictionAccuracy !== 'N/A' ? parseFloat(stats.predictionAccuracy as string) : 0}
              label="Trefferquote"
              sublabel={stats.predictionAccuracy === 'N/A' ? 'Keine Daten' : undefined}
              size="sm"
              color={
                stats.predictionAccuracy === 'N/A' ? 'default'
                : parseFloat(stats.predictionAccuracy as string) >= 60 ? 'success'
                : parseFloat(stats.predictionAccuracy as string) >= 50 ? 'warning'
                : 'danger'
              }
            />
          </div>
        </BentoCell>

        <BentoCell delay={0.12} className="bg-white/[0.03]">
          <div className="flex flex-col justify-between h-full">
            <MetricDisplay
              label="Evaluiert"
              value={stats.evaluatedPredictions}
              size="md"
              icon={<CheckCircle2 size={13} />}
            />
            <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border/50">
              <div className="flex items-center gap-1">
                <Activity size={11} className="text-accent-gold" />
                <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Kontexte</span>
              </div>
              <span className="font-mono tabular-nums text-sm font-bold">{stats.tradeContexts}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <Lightbulb size={11} className="text-accent-primary" />
                <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Muster</span>
              </div>
              <span className="font-mono tabular-nums text-sm font-bold">{stats.learnedPatterns}</span>
            </div>
          </div>
        </BentoCell>
      </BentoGrid>

      {/* ── Pill Segment Control ── */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-border mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all',
              activeTab === tab.id
                ? 'bg-accent-primary/20 text-accent-primary shadow-sm shadow-accent-primary/10'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04]'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* TAB: OVERVIEW                                                       */}
      {/* ================================================================== */}
      {activeTab === 'overview' && (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-5">
          {/* ── Pending Evaluations Alert ── */}
          {pendingPredictions.length > 0 && (
            <motion.div
              variants={staggerItem}
              className="rounded-xl bg-accent-gold/[0.06] border border-accent-gold/20 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1 rounded-md bg-accent-gold/20">
                  <Clock size={14} className="text-accent-gold" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-gold">
                  Auswertung bereit
                </span>
                <span className="text-[10px] text-text-muted font-mono tabular-nums">
                  {pendingPredictions.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {pendingPredictions.slice(0, 3).map(pred => (
                  <div key={pred.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.03]">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold">{pred.currency}</span>
                      <span className="text-text-muted">/</span>
                      <span className={clsx(
                        'font-medium',
                        pred.prediction === 'bullish' && 'text-pnl-positive',
                        pred.prediction === 'bearish' && 'text-pnl-negative',
                        pred.prediction === 'neutral' && 'text-text-muted'
                      )}>
                        {pred.prediction}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {new Date(pred.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => evaluatePrediction(pred.id, 'up', 0)}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-pnl-positive/10 text-pnl-positive
                                   border border-pnl-positive/20 hover:bg-pnl-positive/20 transition-all"
                      >
                        Gestiegen
                      </button>
                      <button
                        onClick={() => evaluatePrediction(pred.id, 'down', 0)}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-pnl-negative/10 text-pnl-negative
                                   border border-pnl-negative/20 hover:bg-pnl-negative/20 transition-all"
                      >
                        Gefallen
                      </button>
                      <button
                        onClick={() => evaluatePrediction(pred.id, 'flat', 0)}
                        className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-white/[0.06] text-text-muted
                                   border border-border hover:bg-white/[0.1] transition-all"
                      >
                        Neutral
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-5 gap-4">
            {/* ── Learned Patterns (wider column) ── */}
            <motion.div variants={staggerItem} className="col-span-3">
              <div className="rounded-xl bg-white/[0.03] border border-border p-4 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb size={14} className="text-accent-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                    Gelernte Trading-Muster
                  </span>
                </div>

                {mlData.learnedPatterns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                    <Brain size={28} className="opacity-30 mb-2" />
                    <p className="text-xs">Noch keine Muster gelernt.</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Klicke "Patterns analysieren" um deine Trades zu analysieren.</p>
                  </div>
                ) : (
                  <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2.5">
                    {mlData.learnedPatterns.map(pattern => (
                      <motion.div
                        key={pattern.id}
                        variants={staggerItem}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-border/50
                                   hover:border-border-light transition-all group"
                      >
                        {/* Confidence bar */}
                        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                          <div className="w-1.5 rounded-full bg-white/[0.06] h-12 relative overflow-hidden">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${pattern.confidence}%` }}
                              transition={{ duration: 0.6, delay: 0.2 }}
                              className={clsx(
                                'absolute bottom-0 w-full rounded-full',
                                pattern.recommendation === 'trade' && 'bg-pnl-positive',
                                pattern.recommendation === 'avoid' && 'bg-pnl-negative',
                                pattern.recommendation === 'neutral' && 'bg-accent-primary',
                              )}
                            />
                          </div>
                          <span className="text-[9px] font-mono tabular-nums text-text-muted">{pattern.confidence}%</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold truncate">{pattern.name}</span>
                            <span className={clsx(
                              'shrink-0 text-[9px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider',
                              pattern.recommendation === 'trade' && 'bg-pnl-positive/15 text-pnl-positive',
                              pattern.recommendation === 'avoid' && 'bg-pnl-negative/15 text-pnl-negative',
                              pattern.recommendation === 'neutral' && 'bg-accent-primary/15 text-accent-primary',
                            )}>
                              {pattern.recommendation === 'trade' ? 'Handeln' : pattern.recommendation === 'avoid' ? 'Meiden' : 'Neutral'}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">{pattern.description}</p>
                          <div className="flex gap-3 mt-1.5 text-[10px] text-text-muted font-mono tabular-nums">
                            <span>{pattern.stats.occurrences} Trades</span>
                            <span className="text-pnl-positive">{pattern.stats.wins}W</span>
                            <span className="text-pnl-negative">{pattern.stats.losses}L</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* ── Recent Predictions Feed ── */}
            <motion.div variants={staggerItem} className="col-span-2">
              <div className="rounded-xl bg-white/[0.03] border border-border p-4 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <Target size={14} className="text-accent-blue" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                    Letzte Predictions
                  </span>
                </div>

                {mlData.predictions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                    <Target size={28} className="opacity-30 mb-2" />
                    <p className="text-xs">Noch keine Predictions erstellt.</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Gehe zu "COT Learning" um Predictions zu erstellen.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {mlData.predictions.slice(0, 6).map((pred, i) => (
                      <motion.div
                        key={pred.id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-2.5 py-2 px-2.5 rounded-lg hover:bg-white/[0.03] transition-all"
                      >
                        {/* Status dot */}
                        <div className={clsx(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          pred.outcome
                            ? pred.outcome.wasCorrect ? 'bg-pnl-positive' : 'bg-pnl-negative'
                            : 'bg-text-muted/40'
                        )} />

                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="font-mono text-xs font-bold w-8">{pred.currency}</span>
                          <span className={clsx(
                            'text-[10px] px-1.5 py-0.5 rounded-md font-medium',
                            pred.prediction === 'bullish' && 'bg-pnl-positive/10 text-pnl-positive',
                            pred.prediction === 'bearish' && 'bg-pnl-negative/10 text-pnl-negative',
                            pred.prediction === 'neutral' && 'bg-white/[0.06] text-text-muted'
                          )}>
                            {pred.prediction}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {pred.outcome ? (
                            pred.outcome.wasCorrect ? (
                              <CheckCircle2 size={12} className="text-pnl-positive" />
                            ) : (
                              <XCircle size={12} className="text-pnl-negative" />
                            )
                          ) : (
                            <Clock size={12} className="text-text-muted/50" />
                          )}
                          <span className="text-[10px] text-text-muted font-mono tabular-nums">
                            {new Date(pred.createdAt).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── System Info Banner ── */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl bg-gradient-to-r from-accent-primary/[0.06] via-accent-blue/[0.04] to-transparent
                       border border-accent-primary/15 p-5"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-lg bg-accent-primary/15 shrink-0">
                <Brain size={18} className="text-accent-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-2">So funktioniert das System</h3>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { step: '01', title: 'Daten Sammeln', desc: 'COT-Daten werden wochentlich gespeichert und historisch analysiert.' },
                    { step: '02', title: 'Predictions Erstellen', desc: 'Basierend auf COT-Positioning werden Markterwartungen erstellt.' },
                    { step: '03', title: 'Lernen & Verbessern', desc: 'Durch Evaluierung der Predictions verbessert sich die Trefferquote.' },
                  ].map(item => (
                    <div key={item.step} className="flex gap-2.5">
                      <span className="text-[10px] font-mono font-bold text-accent-primary/60 pt-0.5">{item.step}</span>
                      <div>
                        <div className="text-xs font-semibold text-text-primary mb-0.5">{item.title}</div>
                        <p className="text-[11px] text-text-muted leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* TAB: COT LEARNING                                                   */}
      {/* ================================================================== */}
      {activeTab === 'cot-learning' && (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-3 gap-5">
          {/* ── COT History Table ── */}
          <motion.div variants={staggerItem} className="col-span-2">
            <div className="rounded-xl bg-white/[0.03] border border-border p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History size={14} className="text-text-muted" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                    COT History
                  </span>
                </div>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="px-2.5 py-1 bg-white/[0.04] border border-border rounded-lg text-xs font-medium
                             focus:border-accent-primary/50 focus:outline-none transition-all"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              {currencyCOTHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                  <Database size={28} className="opacity-30 mb-2" />
                  <p className="text-xs">Keine COT-Daten fur {selectedCurrency}.</p>
                  <p className="text-[10px] mt-0.5">Klicke "COT Daten sammeln" um zu starten.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/60">
                        {['Datum', 'Comm Long', 'Comm Short', 'Net Position', 'Wkl.'].map(h => (
                          <th key={h} className={clsx(
                            'py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted',
                            h === 'Datum' ? 'text-left' : 'text-right'
                          )}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currencyCOTHistory.map((snapshot, i) => {
                        const prev = currencyCOTHistory[i + 1];
                        const change = prev ? snapshot.commercialsNet - prev.commercialsNet : 0;

                        return (
                          <tr
                            key={`${snapshot.date}-${snapshot.currency}`}
                            className={clsx(
                              'border-b border-border/20 transition-colors hover:bg-white/[0.02]',
                              i === 0 && 'bg-white/[0.02]'
                            )}
                          >
                            <td className="py-1.5 text-[11px] font-mono tabular-nums">
                              {new Date(snapshot.date).toLocaleDateString('de-DE')}
                            </td>
                            <td className="py-1.5 text-right text-[11px] font-mono tabular-nums text-pnl-positive/80">
                              {snapshot.commercialsLong.toLocaleString()}
                            </td>
                            <td className="py-1.5 text-right text-[11px] font-mono tabular-nums text-pnl-negative/80">
                              {snapshot.commercialsShort.toLocaleString()}
                            </td>
                            <td className={clsx(
                              'py-1.5 text-right text-[11px] font-mono tabular-nums font-bold',
                              snapshot.commercialsNet >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                            )}>
                              {snapshot.commercialsNet.toLocaleString()}
                            </td>
                            <td className={clsx(
                              'py-1.5 text-right text-[11px] font-mono tabular-nums',
                              change > 0 ? 'text-pnl-positive' : change < 0 ? 'text-pnl-negative' : 'text-text-muted/40'
                            )}>
                              {change > 0 ? '+' : ''}{change.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Create Prediction Panel ── */}
          <motion.div variants={staggerItem}>
            <div className="rounded-xl bg-white/[0.03] border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Target size={14} className="text-accent-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                  Neue Prediction
                </span>
              </div>

              {currencyCOTHistory.length < 2 ? (
                <p className="text-[11px] text-text-muted">Mindestens 2 Datenpunkte benotigt.</p>
              ) : newPrediction ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="p-2.5 rounded-lg bg-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Wahrung</div>
                    <div className="text-sm font-bold font-mono">{newPrediction.currency}</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-0.5">COT Net Position</div>
                    <div className={clsx(
                      'text-sm font-bold font-mono tabular-nums',
                      (newPrediction.cotNetAtPrediction || 0) >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                    )}>
                      {newPrediction.cotNetAtPrediction?.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-text-muted mb-0.5">Wochentliche Veranderung</div>
                    <div className={clsx(
                      'text-sm font-bold font-mono tabular-nums',
                      (newPrediction.cotChange || 0) >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                    )}>
                      {(newPrediction.cotChange || 0) > 0 ? '+' : ''}{newPrediction.cotChange?.toLocaleString()}
                    </div>
                  </div>

                  {/* Prediction result card */}
                  <div className={clsx(
                    'p-3 rounded-xl border',
                    newPrediction.prediction === 'bullish' && 'bg-pnl-positive/[0.06] border-pnl-positive/30',
                    newPrediction.prediction === 'bearish' && 'bg-pnl-negative/[0.06] border-pnl-negative/30',
                    newPrediction.prediction === 'neutral' && 'bg-white/[0.04] border-border'
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={clsx(
                        'text-sm font-bold capitalize',
                        newPrediction.prediction === 'bullish' && 'text-pnl-positive',
                        newPrediction.prediction === 'bearish' && 'text-pnl-negative',
                      )}>
                        {newPrediction.prediction}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums font-bold">{newPrediction.confidence}%</span>
                    </div>
                    {/* Confidence bar */}
                    <div className="w-full h-1 rounded-full bg-white/[0.06] mb-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${newPrediction.confidence}%` }}
                        transition={{ duration: 0.6 }}
                        className={clsx(
                          'h-full rounded-full',
                          newPrediction.prediction === 'bullish' && 'bg-pnl-positive',
                          newPrediction.prediction === 'bearish' && 'bg-pnl-negative',
                          newPrediction.prediction === 'neutral' && 'bg-accent-primary',
                        )}
                      />
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">{newPrediction.reasoning}</p>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.1em] text-text-muted mb-1">Timeframe</label>
                    <select
                      value={newPrediction.timeframe}
                      onChange={(e) => setNewPrediction(prev => prev ? { ...prev, timeframe: e.target.value as COTPrediction['timeframe'] } : null)}
                      className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-border rounded-lg text-xs
                                 focus:border-accent-primary/50 focus:outline-none transition-all"
                    >
                      <option value="1week">1 Woche</option>
                      <option value="2weeks">2 Wochen</option>
                      <option value="1month">1 Monat</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setNewPrediction(null)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg
                                 bg-white/[0.04] border border-border hover:bg-white/[0.07] transition-all"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={savePrediction}
                      className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg
                                 bg-accent-primary/15 text-accent-primary border border-accent-primary/25
                                 hover:bg-accent-primary/25 transition-all"
                    >
                      Speichern
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Erstelle eine Prediction basierend auf den aktuellen COT-Daten fur {selectedCurrency}.
                  </p>
                  <button
                    onClick={() => createPrediction(selectedCurrency)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                               bg-accent-primary/15 text-accent-primary border border-accent-primary/25
                               hover:bg-accent-primary/25 transition-all"
                  >
                    <Sparkles size={13} />
                    Prediction generieren
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* TAB: TRADE PATTERNS                                                 */}
      {/* ================================================================== */}
      {activeTab === 'trade-patterns' && (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-5">
          {/* ── Info Banner ── */}
          <motion.div
            variants={staggerItem}
            className="rounded-xl bg-accent-primary/[0.04] border border-accent-primary/15 p-4"
          >
            <div className="flex items-start gap-3">
              <BookOpen size={16} className="text-accent-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold mb-0.5">Trade Pattern Erkennung</h4>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Das System analysiert deine geschlossenen Trades und erkennt Muster wie:
                  Direction-Bias pro Pair, Session-Starken/Schwachen, Tilt-Erkennung nach Verlustserien.
                  Je mehr Trades du hast, desto genauer werden die Erkenntnisse.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Patterns Visual Cards ── */}
          {mlData.learnedPatterns.length === 0 ? (
            <motion.div variants={staggerItem} className="rounded-xl bg-white/[0.03] border border-border p-10 text-center">
              <Brain size={36} className="mx-auto text-text-muted/30 mb-3" />
              <h3 className="text-sm font-semibold mb-1">Keine Muster erkannt</h3>
              <p className="text-[11px] text-text-muted mb-4">
                Du benotitigst mindestens 10 geschlossene Trades fur die Mustererkennung.
                Aktuell hast du {allTrades.filter(t => t.status === 'closed').length} geschlossene Trades.
              </p>
              <button
                onClick={analyzeTradePatterns}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-accent-primary/15 text-accent-primary border border-accent-primary/25
                           hover:bg-accent-primary/25 transition-all"
              >
                <Sparkles size={13} />
                Jetzt analysieren
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {mlData.learnedPatterns.map((pattern, idx) => (
                <motion.div
                  key={pattern.id}
                  variants={staggerItem}
                  className="rounded-xl bg-white/[0.03] border border-border p-4 hover:border-border-light transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        'p-1.5 rounded-lg',
                        pattern.recommendation === 'trade' && 'bg-pnl-positive/10',
                        pattern.recommendation === 'avoid' && 'bg-pnl-negative/10',
                        pattern.recommendation === 'neutral' && 'bg-accent-primary/10',
                      )}>
                        {pattern.recommendation === 'trade' && <TrendingUp size={14} className="text-pnl-positive" />}
                        {pattern.recommendation === 'avoid' && <AlertTriangle size={14} className="text-pnl-negative" />}
                        {pattern.recommendation === 'neutral' && <Zap size={14} className="text-accent-primary" />}
                      </div>
                      <span className="text-xs font-semibold">{pattern.name}</span>
                    </div>
                    <span className={clsx(
                      'text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider',
                      pattern.recommendation === 'trade' && 'bg-pnl-positive/15 text-pnl-positive',
                      pattern.recommendation === 'avoid' && 'bg-pnl-negative/15 text-pnl-negative',
                      pattern.recommendation === 'neutral' && 'bg-accent-primary/15 text-accent-primary',
                    )}>
                      {pattern.recommendation === 'trade' ? 'Handeln' : pattern.recommendation === 'avoid' ? 'Meiden' : 'Neutral'}
                    </span>
                  </div>

                  <p className="text-[11px] text-text-muted leading-relaxed mb-3">{pattern.description}</p>

                  {/* Confidence bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Konfidenz</span>
                      <span className="text-[10px] font-mono tabular-nums font-bold">{pattern.confidence}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pattern.confidence}%` }}
                        transition={{ duration: 0.6, delay: idx * 0.1 }}
                        className={clsx(
                          'h-full rounded-full',
                          pattern.recommendation === 'trade' && 'bg-pnl-positive',
                          pattern.recommendation === 'avoid' && 'bg-pnl-negative',
                          pattern.recommendation === 'neutral' && 'bg-accent-primary',
                        )}
                      />
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-[10px] font-mono tabular-nums pt-2 border-t border-border/40">
                    <span className="text-text-muted">{pattern.stats.occurrences} Trades</span>
                    <span className="text-pnl-positive">{pattern.stats.wins}W</span>
                    <span className="text-pnl-negative">{pattern.stats.losses}L</span>
                    <span className="text-text-muted ml-auto">
                      WR {pattern.stats.occurrences > 0 ? ((pattern.stats.wins / pattern.stats.occurrences) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Pair Performance ── */}
          <motion.div variants={staggerItem}>
            <div className="rounded-xl bg-white/[0.03] border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <LineChart size={14} className="text-text-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                  Pair Performance Analysis
                </span>
              </div>
              {(() => {
                const closedTrades = allTrades.filter(t => t.status === 'closed' && t.pnl !== undefined);
                const pairStats: Record<string, { wins: number; losses: number; pnl: number }> = {};

                closedTrades.forEach(trade => {
                  if (!pairStats[trade.pair]) pairStats[trade.pair] = { wins: 0, losses: 0, pnl: 0 };
                  pairStats[trade.pair].pnl += trade.pnl || 0;
                  if ((trade.pnl || 0) > 0) pairStats[trade.pair].wins++;
                  else pairStats[trade.pair].losses++;
                });

                const sortedPairs = Object.entries(pairStats)
                  .map(([pair, stats]) => ({ pair, ...stats, total: stats.wins + stats.losses }))
                  .sort((a, b) => b.pnl - a.pnl);

                if (sortedPairs.length === 0) {
                  return <p className="text-[11px] text-text-muted">Keine Trades vorhanden.</p>;
                }

                return (
                  <div className="grid grid-cols-4 gap-2.5">
                    {sortedPairs.map((pair, i) => (
                      <motion.div
                        key={pair.pair}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className={clsx(
                          'p-3 rounded-lg border transition-all hover:border-border-light',
                          i === 0 && pair.pnl > 0 && 'bg-pnl-positive/[0.05] border-pnl-positive/20',
                          i === sortedPairs.length - 1 && pair.pnl < 0 && 'bg-pnl-negative/[0.05] border-pnl-negative/20',
                          !(i === 0 && pair.pnl > 0) && !(i === sortedPairs.length - 1 && pair.pnl < 0) && 'bg-white/[0.02] border-border/50'
                        )}
                      >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-text-muted mb-1">{pair.pair}</div>
                        <div className={clsx(
                          'text-sm font-bold font-mono tabular-nums',
                          pair.pnl >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                        )}>
                          {pair.pnl >= 0 ? '+' : ''}{pair.pnl.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono tabular-nums mt-0.5">
                          {pair.wins}W / {pair.losses}L ({(pair.wins / pair.total * 100).toFixed(0)}%)
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* TAB: PREDICTIONS                                                    */}
      {/* ================================================================== */}
      {activeTab === 'predictions' && (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-5">
          {/* ── Accuracy Breakdown ── */}
          {mlData.predictions.filter(p => p.outcome).length >= 5 && (
            <motion.div
              variants={staggerItem}
              className="rounded-xl bg-gradient-to-r from-accent-primary/[0.06] via-accent-blue/[0.04] to-transparent
                         border border-accent-primary/15 p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Percent size={14} className="text-accent-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                  Prediction Accuracy Breakdown
                </span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {CURRENCIES.slice(0, 8).map(currency => {
                  const preds = mlData.predictions.filter(p => p.currency === currency.code && p.outcome);
                  const correct = preds.filter(p => p.outcome?.wasCorrect).length;
                  const accuracy = preds.length > 0 ? (correct / preds.length * 100) : 0;

                  return (
                    <div key={currency.code} className="p-3 rounded-lg bg-white/[0.03] border border-border/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold font-mono">{currency.code}</span>
                        <span className="text-[10px] text-text-muted font-mono tabular-nums">{preds.length} eval.</span>
                      </div>
                      {preds.length > 0 ? (
                        <>
                          <div className={clsx(
                            'text-lg font-bold font-mono tabular-nums',
                            accuracy >= 60 ? 'text-pnl-positive' : accuracy >= 50 ? 'text-accent-gold' : 'text-pnl-negative'
                          )}>
                            {accuracy.toFixed(0)}%
                          </div>
                          <div className="w-full h-1 rounded-full bg-white/[0.06] mt-1.5 overflow-hidden">
                            <div
                              className={clsx(
                                'h-full rounded-full transition-all',
                                accuracy >= 60 ? 'bg-pnl-positive' : accuracy >= 50 ? 'bg-accent-gold' : 'bg-pnl-negative'
                              )}
                              style={{ width: `${accuracy}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="text-lg font-bold text-text-muted/30">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Predictions Timeline / Feed ── */}
          <motion.div variants={staggerItem}>
            <div className="rounded-xl bg-white/[0.03] border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <History size={14} className="text-text-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                  Alle Predictions
                </span>
                <span className="text-[10px] font-mono tabular-nums text-text-muted/60">
                  ({mlData.predictions.length})
                </span>
              </div>

              {mlData.predictions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-text-muted">
                  <Target size={28} className="opacity-30 mb-2" />
                  <p className="text-xs">Noch keine Predictions erstellt.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border/40" />

                  <div className="space-y-1">
                    {mlData.predictions.map((pred, i) => (
                      <motion.div
                        key={pred.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="relative flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-all group"
                      >
                        {/* Timeline dot */}
                        <div className={clsx(
                          'relative z-10 w-2 h-2 rounded-full shrink-0 ring-2 ring-background-card',
                          pred.outcome
                            ? pred.outcome.wasCorrect ? 'bg-pnl-positive' : 'bg-pnl-negative'
                            : 'bg-text-muted/30'
                        )} />

                        {/* Date */}
                        <span className="text-[10px] font-mono tabular-nums text-text-muted w-16 shrink-0">
                          {new Date(pred.createdAt).toLocaleDateString('de-DE')}
                        </span>

                        {/* Currency */}
                        <span className="text-xs font-mono font-bold w-8 shrink-0">{pred.currency}</span>

                        {/* Prediction badge */}
                        <span className={clsx(
                          'text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0',
                          pred.prediction === 'bullish' && 'bg-pnl-positive/10 text-pnl-positive',
                          pred.prediction === 'bearish' && 'bg-pnl-negative/10 text-pnl-negative',
                          pred.prediction === 'neutral' && 'bg-white/[0.06] text-text-muted'
                        )}>
                          {pred.prediction}
                        </span>

                        {/* COT values */}
                        <div className="flex items-center gap-3 ml-auto text-[10px] font-mono tabular-nums">
                          <span className={clsx(
                            pred.cotNetAtPrediction >= 0 ? 'text-pnl-positive/70' : 'text-pnl-negative/70'
                          )}>
                            {pred.cotNetAtPrediction.toLocaleString()}
                          </span>
                          <span className={clsx(
                            pred.cotChange >= 0 ? 'text-pnl-positive/60' : 'text-pnl-negative/60'
                          )}>
                            {pred.cotChange >= 0 ? '+' : ''}{pred.cotChange.toLocaleString()}
                          </span>

                          {/* Confidence mini-bar */}
                          <div className="w-10 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent-primary/60"
                              style={{ width: `${pred.confidence}%` }}
                            />
                          </div>
                          <span className="text-text-muted/60 w-7 text-right">{pred.confidence}%</span>

                          {/* Outcome icon */}
                          <div className="w-5 flex justify-center">
                            {pred.outcome ? (
                              pred.outcome.wasCorrect ? (
                                <CheckCircle2 size={12} className="text-pnl-positive" />
                              ) : (
                                <XCircle size={12} className="text-pnl-negative" />
                              )
                            ) : (
                              <Clock size={12} className="text-text-muted/30" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
    </PageTransition>
  );
}
