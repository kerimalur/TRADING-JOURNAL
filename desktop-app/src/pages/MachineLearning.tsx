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

import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Brain,
  Database,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Zap,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Lightbulb,
  History,
  LineChart,
  ArrowRight,
  ChevronRight,
  Percent,
  BookOpen,
  Sparkles,
  Download,
  Calendar,
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTradeStore } from '@/stores/tradeStore';
import { getApi } from '@/services/webApi';

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

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Brain className="text-accent-primary" />
            ML Intelligence Center
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Selbstlernendes System für Marktanalyse und Trade-Optimierung
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={collectCOTData}
            disabled={isCollecting}
            className="btn-secondary flex items-center gap-2"
          >
            <Download size={16} className={isCollecting ? 'animate-spin' : ''} />
            COT Daten sammeln
          </button>
          <button
            onClick={analyzeTradePatterns}
            className="btn-primary flex items-center gap-2"
          >
            <Sparkles size={16} />
            Patterns analysieren
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="card text-center">
          <Database size={20} className="mx-auto text-accent-primary mb-2" />
          <div className="text-2xl font-bold">{stats.cotDataPoints}</div>
          <div className="text-xs text-text-muted">COT Datenpunkte</div>
        </div>
        <div className="card text-center">
          <Target size={20} className="mx-auto text-accent-blue mb-2" />
          <div className="text-2xl font-bold">{stats.totalPredictions}</div>
          <div className="text-xs text-text-muted">Predictions</div>
        </div>
        <div className="card text-center">
          <Percent size={20} className="mx-auto text-pnl-positive mb-2" />
          <div className="text-2xl font-bold">{stats.predictionAccuracy}%</div>
          <div className="text-xs text-text-muted">Trefferquote</div>
        </div>
        <div className="card text-center">
          <CheckCircle2 size={20} className="mx-auto text-pnl-positive mb-2" />
          <div className="text-2xl font-bold">{stats.evaluatedPredictions}</div>
          <div className="text-xs text-text-muted">Evaluiert</div>
        </div>
        <div className="card text-center">
          <Activity size={20} className="mx-auto text-accent-gold mb-2" />
          <div className="text-2xl font-bold">{stats.tradeContexts}</div>
          <div className="text-xs text-text-muted">Trade Contexts</div>
        </div>
        <div className="card text-center">
          <Lightbulb size={20} className="mx-auto text-accent-primary mb-2" />
          <div className="text-2xl font-bold">{stats.learnedPatterns}</div>
          <div className="text-xs text-text-muted">Gelernte Muster</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border pb-2">
        {[
          { id: 'overview', label: 'Übersicht', icon: <BarChart3 size={16} /> },
          { id: 'cot-learning', label: 'COT Learning', icon: <Database size={16} /> },
          { id: 'trade-patterns', label: 'Trade Patterns', icon: <Lightbulb size={16} /> },
          { id: 'predictions', label: 'Predictions', icon: <Target size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all',
              activeTab === tab.id 
                ? 'bg-accent-primary/20 text-accent-primary border-b-2 border-accent-primary' 
                : 'text-text-muted hover:text-text-primary hover:bg-white/5'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Pending Evaluations */}
          {pendingPredictions.length > 0 && (
            <div className="col-span-2 card border-l-4 border-l-accent-gold bg-accent-gold/5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-accent-gold" />
                <span className="font-semibold">Predictions zur Evaluierung bereit</span>
                <span className="text-sm text-text-muted">({pendingPredictions.length})</span>
              </div>
              <div className="space-y-2">
                {pendingPredictions.slice(0, 3).map(pred => (
                  <div key={pred.id} className="flex items-center justify-between p-3 rounded-lg bg-background-surface">
                    <div>
                      <span className="font-medium">{pred.currency}</span>
                      <span className="text-text-muted mx-2">•</span>
                      <span className={clsx(
                        'text-sm',
                        pred.prediction === 'bullish' && 'text-pnl-positive',
                        pred.prediction === 'bearish' && 'text-pnl-negative',
                        pred.prediction === 'neutral' && 'text-text-muted'
                      )}>
                        {pred.prediction}
                      </span>
                      <span className="text-text-muted mx-2">•</span>
                      <span className="text-sm text-text-muted">
                        {new Date(pred.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => evaluatePrediction(pred.id, 'up', 0)}
                        className="px-2 py-1 text-xs rounded bg-pnl-positive/20 text-pnl-positive hover:bg-pnl-positive/30"
                      >
                        ↑ Gestiegen
                      </button>
                      <button
                        onClick={() => evaluatePrediction(pred.id, 'down', 0)}
                        className="px-2 py-1 text-xs rounded bg-pnl-negative/20 text-pnl-negative hover:bg-pnl-negative/30"
                      >
                        ↓ Gefallen
                      </button>
                      <button
                        onClick={() => evaluatePrediction(pred.id, 'flat', 0)}
                        className="px-2 py-1 text-xs rounded bg-text-muted/20 text-text-muted hover:bg-text-muted/30"
                      >
                        — Neutral
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learned Patterns */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Lightbulb size={18} className="text-accent-primary" />
              Gelernte Trading-Muster
            </h3>
            {mlData.learnedPatterns.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Brain size={32} className="mx-auto mb-2 opacity-50" />
                <p>Noch keine Muster gelernt.</p>
                <p className="text-sm">Klicke "Patterns analysieren" um deine Trades zu analysieren.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mlData.learnedPatterns.map(pattern => (
                  <div 
                    key={pattern.id}
                    className={clsx(
                      'p-3 rounded-lg border',
                      pattern.recommendation === 'trade' && 'bg-pnl-positive/5 border-pnl-positive/30',
                      pattern.recommendation === 'avoid' && 'bg-pnl-negative/5 border-pnl-negative/30',
                      pattern.recommendation === 'neutral' && 'bg-background-surface border-border'
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium">{pattern.name}</span>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded',
                        pattern.recommendation === 'trade' && 'bg-pnl-positive/20 text-pnl-positive',
                        pattern.recommendation === 'avoid' && 'bg-pnl-negative/20 text-pnl-negative'
                      )}>
                        {pattern.confidence}% Konfidenz
                      </span>
                    </div>
                    <p className="text-sm text-text-muted">{pattern.description}</p>
                    <div className="flex gap-4 mt-2 text-xs text-text-muted">
                      <span>{pattern.stats.occurrences} Trades</span>
                      <span>{pattern.stats.wins}W / {pattern.stats.losses}L</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Predictions */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target size={18} className="text-accent-blue" />
              Letzte Predictions
            </h3>
            {mlData.predictions.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Target size={32} className="mx-auto mb-2 opacity-50" />
                <p>Noch keine Predictions erstellt.</p>
                <p className="text-sm">Gehe zu "COT Learning" um Predictions zu erstellen.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mlData.predictions.slice(0, 6).map(pred => (
                  <div 
                    key={pred.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-background-surface"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium w-10">{pred.currency}</span>
                      <span className={clsx(
                        'text-sm px-2 py-0.5 rounded',
                        pred.prediction === 'bullish' && 'bg-pnl-positive/20 text-pnl-positive',
                        pred.prediction === 'bearish' && 'bg-pnl-negative/20 text-pnl-negative',
                        pred.prediction === 'neutral' && 'bg-text-muted/20 text-text-muted'
                      )}>
                        {pred.prediction}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pred.outcome ? (
                        pred.outcome.wasCorrect ? (
                          <CheckCircle2 size={16} className="text-pnl-positive" />
                        ) : (
                          <XCircle size={16} className="text-pnl-negative" />
                        )
                      ) : (
                        <Clock size={16} className="text-text-muted" />
                      )}
                      <span className="text-xs text-text-muted">
                        {new Date(pred.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ML Insight */}
          <div className="col-span-2 card bg-gradient-to-r from-accent-primary/10 to-accent-blue/10">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-accent-primary/20">
                <Brain size={24} className="text-accent-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">So funktioniert das System</h3>
                <p className="text-sm text-text-muted mb-3">
                  Das ML Intelligence Center sammelt Daten und lernt aus deinen Trades:
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-accent-primary">1. Daten Sammeln</div>
                    <p className="text-text-muted">COT-Daten werden wöchentlich gespeichert und historisch analysiert.</p>
                  </div>
                  <div>
                    <div className="font-medium text-accent-primary">2. Predictions Erstellen</div>
                    <p className="text-text-muted">Basierend auf COT-Positioning werden Markterwartungen erstellt.</p>
                  </div>
                  <div>
                    <div className="font-medium text-accent-primary">3. Lernen & Verbessern</div>
                    <p className="text-text-muted">Durch Evaluierung der Predictions verbessert sich die Trefferquote.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cot-learning' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Currency Selector & History */}
          <div className="col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <History size={18} />
                COT History
              </h3>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>

            {currencyCOTHistory.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Database size={32} className="mx-auto mb-2 opacity-50" />
                <p>Keine COT-Daten für {selectedCurrency}.</p>
                <p className="text-sm">Klicke "COT Daten sammeln" um zu starten.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 text-left">Datum</th>
                      <th className="py-2 text-right">Comm Long</th>
                      <th className="py-2 text-right">Comm Short</th>
                      <th className="py-2 text-right">Net Position</th>
                      <th className="py-2 text-right">Veränderung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currencyCOTHistory.map((snapshot, i) => {
                      const prev = currencyCOTHistory[i + 1];
                      const change = prev ? snapshot.commercialsNet - prev.commercialsNet : 0;
                      
                      return (
                        <tr key={`${snapshot.date}-${snapshot.currency}`} className="border-b border-border/50">
                          <td className="py-2">{new Date(snapshot.date).toLocaleDateString('de-DE')}</td>
                          <td className="py-2 text-right text-pnl-positive">{snapshot.commercialsLong.toLocaleString()}</td>
                          <td className="py-2 text-right text-pnl-negative">{snapshot.commercialsShort.toLocaleString()}</td>
                          <td className={clsx('py-2 text-right font-medium', snapshot.commercialsNet >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                            {snapshot.commercialsNet.toLocaleString()}
                          </td>
                          <td className={clsx('py-2 text-right', change > 0 ? 'text-pnl-positive' : change < 0 ? 'text-pnl-negative' : 'text-text-muted')}>
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

          {/* Create Prediction */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Target size={18} className="text-accent-primary" />
              Neue Prediction
            </h3>

            {currencyCOTHistory.length < 2 ? (
              <p className="text-sm text-text-muted">Mindestens 2 Datenpunkte benötigt.</p>
            ) : newPrediction ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-background-surface">
                  <div className="text-sm text-text-muted mb-1">Währung</div>
                  <div className="font-medium">{newPrediction.currency}</div>
                </div>

                <div className="p-3 rounded-lg bg-background-surface">
                  <div className="text-sm text-text-muted mb-1">COT Net Position</div>
                  <div className={clsx('font-medium', (newPrediction.cotNetAtPrediction || 0) >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                    {newPrediction.cotNetAtPrediction?.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-background-surface">
                  <div className="text-sm text-text-muted mb-1">Wöchentliche Veränderung</div>
                  <div className={clsx('font-medium', (newPrediction.cotChange || 0) >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                    {(newPrediction.cotChange || 0) > 0 ? '+' : ''}{newPrediction.cotChange?.toLocaleString()}
                  </div>
                </div>

                <div className={clsx(
                  'p-3 rounded-lg border-2',
                  newPrediction.prediction === 'bullish' && 'bg-pnl-positive/10 border-pnl-positive',
                  newPrediction.prediction === 'bearish' && 'bg-pnl-negative/10 border-pnl-negative',
                  newPrediction.prediction === 'neutral' && 'bg-text-muted/10 border-text-muted'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-lg capitalize">{newPrediction.prediction}</span>
                    <span className="text-sm">{newPrediction.confidence}% Konfidenz</span>
                  </div>
                  <p className="text-sm text-text-muted">{newPrediction.reasoning}</p>
                </div>

                <div>
                  <label className="block text-sm text-text-muted mb-1">Timeframe</label>
                  <select
                    value={newPrediction.timeframe}
                    onChange={(e) => setNewPrediction(prev => prev ? { ...prev, timeframe: e.target.value as COTPrediction['timeframe'] } : null)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                  >
                    <option value="1week">1 Woche</option>
                    <option value="2weeks">2 Wochen</option>
                    <option value="1month">1 Monat</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setNewPrediction(null)} className="btn-secondary flex-1">
                    Abbrechen
                  </button>
                  <button onClick={savePrediction} className="btn-primary flex-1">
                    Prediction speichern
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-text-muted">
                  Erstelle eine Prediction basierend auf den aktuellen COT-Daten für {selectedCurrency}.
                </p>
                <button
                  onClick={() => createPrediction(selectedCurrency)}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  Prediction generieren
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'trade-patterns' && (
        <div className="space-y-6">
          {/* Info */}
          <div className="card bg-accent-primary/5 border border-accent-primary/20">
            <div className="flex items-start gap-3">
              <BookOpen size={20} className="text-accent-primary mt-0.5" />
              <div>
                <h4 className="font-medium mb-1">Trade Pattern Erkennung</h4>
                <p className="text-sm text-text-muted">
                  Das System analysiert deine geschlossenen Trades und erkennt Muster wie:
                  Direction-Bias pro Pair, Session-Stärken/Schwächen, Tilt-Erkennung nach Verlustserien.
                  Je mehr Trades du hast, desto genauer werden die Erkenntnisse.
                </p>
              </div>
            </div>
          </div>

          {/* Patterns Grid */}
          {mlData.learnedPatterns.length === 0 ? (
            <div className="card text-center py-12">
              <Brain size={48} className="mx-auto text-text-muted/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Muster erkannt</h3>
              <p className="text-text-muted mb-4">
                Du benötigst mindestens 10 geschlossene Trades für die Mustererkennung.
                Aktuell hast du {allTrades.filter(t => t.status === 'closed').length} geschlossene Trades.
              </p>
              <button onClick={analyzeTradePatterns} className="btn-primary">
                <Sparkles size={16} />
                Jetzt analysieren
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {mlData.learnedPatterns.map(pattern => (
                <div 
                  key={pattern.id}
                  className={clsx(
                    'card border-l-4',
                    pattern.recommendation === 'trade' && 'border-l-pnl-positive bg-pnl-positive/5',
                    pattern.recommendation === 'avoid' && 'border-l-pnl-negative bg-pnl-negative/5',
                    pattern.recommendation === 'neutral' && 'border-l-accent-primary bg-accent-primary/5'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {pattern.recommendation === 'trade' && <TrendingUp size={18} className="text-pnl-positive" />}
                      {pattern.recommendation === 'avoid' && <AlertTriangle size={18} className="text-pnl-negative" />}
                      {pattern.recommendation === 'neutral' && <Zap size={18} className="text-accent-primary" />}
                      <span className="font-semibold">{pattern.name}</span>
                    </div>
                    <div className={clsx(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      pattern.recommendation === 'trade' && 'bg-pnl-positive/20 text-pnl-positive',
                      pattern.recommendation === 'avoid' && 'bg-pnl-negative/20 text-pnl-negative',
                      pattern.recommendation === 'neutral' && 'bg-accent-primary/20 text-accent-primary'
                    )}>
                      {pattern.confidence}% Konfidenz
                    </div>
                  </div>

                  <p className="text-sm text-text-primary mb-4">{pattern.description}</p>

                  <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-lg bg-background-surface/50">
                    <div>
                      <div className="text-lg font-bold">{pattern.stats.occurrences}</div>
                      <div className="text-xs text-text-muted">Trades</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-pnl-positive">{pattern.stats.wins}</div>
                      <div className="text-xs text-text-muted">Wins</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-pnl-negative">{pattern.stats.losses}</div>
                      <div className="text-xs text-text-muted">Losses</div>
                    </div>
                  </div>

                  {pattern.recommendation === 'trade' && (
                    <div className="mt-3 p-2 rounded bg-pnl-positive/10 text-sm text-pnl-positive">
                      <CheckCircle2 size={14} className="inline mr-1" />
                      Empfehlung: Diese Bedingungen bevorzugen
                    </div>
                  )}
                  {pattern.recommendation === 'avoid' && (
                    <div className="mt-3 p-2 rounded bg-pnl-negative/10 text-sm text-pnl-negative">
                      <AlertTriangle size={14} className="inline mr-1" />
                      Empfehlung: Diese Bedingungen meiden
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pair Performance */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <LineChart size={18} />
              Pair Performance Analysis
            </h3>
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
                return <p className="text-text-muted">Keine Trades vorhanden.</p>;
              }

              return (
                <div className="grid grid-cols-4 gap-3">
                  {sortedPairs.map((pair, i) => (
                    <div 
                      key={pair.pair}
                      className={clsx(
                        'p-3 rounded-lg border',
                        i === 0 && pair.pnl > 0 && 'bg-pnl-positive/10 border-pnl-positive/30',
                        i === sortedPairs.length - 1 && pair.pnl < 0 && 'bg-pnl-negative/10 border-pnl-negative/30',
                        i !== 0 && i !== sortedPairs.length - 1 && 'bg-background-surface border-border'
                      )}
                    >
                      <div className="font-medium mb-1">{pair.pair}</div>
                      <div className={clsx('text-lg font-bold', pair.pnl >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                        {pair.pnl >= 0 ? '+' : ''}{pair.pnl.toFixed(2)}
                      </div>
                      <div className="text-xs text-text-muted">
                        {pair.wins}W / {pair.losses}L ({(pair.wins / pair.total * 100).toFixed(0)}%)
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="space-y-6">
          {/* Prediction Stats */}
          {mlData.predictions.filter(p => p.outcome).length >= 5 && (
            <div className="card bg-gradient-to-r from-accent-primary/10 to-accent-blue/10">
              <h3 className="font-semibold mb-4">Prediction Accuracy Breakdown</h3>
              <div className="grid grid-cols-4 gap-4">
                {CURRENCIES.slice(0, 8).map(currency => {
                  const preds = mlData.predictions.filter(p => p.currency === currency.code && p.outcome);
                  const correct = preds.filter(p => p.outcome?.wasCorrect).length;
                  const accuracy = preds.length > 0 ? (correct / preds.length * 100) : 0;
                  
                  return (
                    <div key={currency.code} className="p-3 rounded-lg bg-background/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{currency.code}</span>
                        <span className="text-xs text-text-muted">{preds.length} eval.</span>
                      </div>
                      <div className={clsx(
                        'text-xl font-bold',
                        accuracy >= 60 ? 'text-pnl-positive' : accuracy >= 50 ? 'text-accent-gold' : 'text-pnl-negative'
                      )}>
                        {preds.length > 0 ? `${accuracy.toFixed(0)}%` : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Predictions */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History size={18} />
              Alle Predictions ({mlData.predictions.length})
            </h3>

            {mlData.predictions.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                <Target size={32} className="mx-auto mb-2 opacity-50" />
                <p>Noch keine Predictions erstellt.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 text-left">Datum</th>
                      <th className="py-2 text-left">Währung</th>
                      <th className="py-2 text-left">Prediction</th>
                      <th className="py-2 text-right">COT Net</th>
                      <th className="py-2 text-right">Change</th>
                      <th className="py-2 text-center">Konfidenz</th>
                      <th className="py-2 text-center">Ergebnis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mlData.predictions.map(pred => (
                      <tr key={pred.id} className="border-b border-border/50 hover:bg-white/5">
                        <td className="py-2">{new Date(pred.createdAt).toLocaleDateString('de-DE')}</td>
                        <td className="py-2 font-medium">{pred.currency}</td>
                        <td className="py-2">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs',
                            pred.prediction === 'bullish' && 'bg-pnl-positive/20 text-pnl-positive',
                            pred.prediction === 'bearish' && 'bg-pnl-negative/20 text-pnl-negative',
                            pred.prediction === 'neutral' && 'bg-text-muted/20 text-text-muted'
                          )}>
                            {pred.prediction}
                          </span>
                        </td>
                        <td className={clsx('py-2 text-right', pred.cotNetAtPrediction >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {pred.cotNetAtPrediction.toLocaleString()}
                        </td>
                        <td className={clsx('py-2 text-right', pred.cotChange >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {pred.cotChange >= 0 ? '+' : ''}{pred.cotChange.toLocaleString()}
                        </td>
                        <td className="py-2 text-center">{pred.confidence}%</td>
                        <td className="py-2 text-center">
                          {pred.outcome ? (
                            pred.outcome.wasCorrect ? (
                              <CheckCircle2 size={16} className="inline text-pnl-positive" />
                            ) : (
                              <XCircle size={16} className="inline text-pnl-negative" />
                            )
                          ) : (
                            <Clock size={16} className="inline text-text-muted" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
