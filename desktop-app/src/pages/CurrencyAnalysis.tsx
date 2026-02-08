/**
 * ========================================================================
 * Trading Journal - Currency Analysis Page
 * ========================================================================
 * 
 * Kombinierte Analyse für Währungen:
 * - Zinssätze aller Zentralbanken
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
import { getApi } from '@/services/webApi';

// Währungen mit Zentralbank-Info
const CURRENCIES = [
  { id: 'USD', name: 'USD', centralBank: 'Federal Reserve', flag: '🇺🇸' },
  { id: 'EUR', name: 'EUR', centralBank: 'ECB', flag: '🇪🇺' },
  { id: 'GBP', name: 'GBP', centralBank: 'Bank of England', flag: '🇬🇧' },
  { id: 'JPY', name: 'JPY', centralBank: 'Bank of Japan', flag: '🇯🇵' },
  { id: 'CAD', name: 'CAD', centralBank: 'Bank of Canada', flag: '🇨🇦' },
  { id: 'AUD', name: 'AUD', centralBank: 'RBA', flag: '🇦🇺' },
  { id: 'NZD', name: 'NZD', centralBank: 'RBNZ', flag: '🇳🇿' },
  { id: 'CHF', name: 'CHF', centralBank: 'SNB', flag: '🇨🇭' },
];

// Gängige Pairs
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
    
    // Default/Fallback Zinssätze (Stand: Februar 2026)
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
    
    // Versuche Zinssätze über unified API zu laden (falls verfügbar)
    try {
      const api = getApi();
      if (api.fetchInterestRates) {
        console.log('💰 Fetching interest rates...');
        const result = await api.fetchInterestRates();
        if (result.success && result.data) {
          interestRates = result.data;
          console.log('✅ Interest rates loaded from API');
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
        console.log('📅 Fetching economic calendar for currency analysis...');
        const calResult = await api.fetchEconomicCalendar();
        if (calResult.success && calResult.data) {
          // Filtere nur High-Impact Events für die nächsten Tage
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
          console.log(`✅ Loaded ${loadedEvents.length} high-impact events`);
        }
      }
    } catch (e) {
      console.log('Calendar API not available');
    }
    setUpcomingEvents(loadedEvents);

    // News Bias basierend auf Zinspolitik und Wirtschaftslage (deterministisch!)
    // Diese Funktion gibt auch eine detaillierte Begründung zurück
    const getNewsBiasFromRates = (currency: string, rateChange: 'up' | 'down' | 'hold', rate: number): { bias: Bias; strength: SignalStrength; reason: string } => {
      // JPY ist speziell - Zinserhöhung stärkt Yen (Umkehrung des Carry Trades)
      if (currency === 'JPY') {
        if (rateChange === 'up') {
          return { 
            bias: 'bullish', 
            strength: 'strong',
            reason: 'BoJ normalisiert Geldpolitik nach Jahren der Negativzinsen. Zinserhöhung reduziert Carry-Trade-Attraktivität gegen JPY, was den Yen stärkt. Historische Wende in der japanischen Geldpolitik.'
          };
        }
        if (rateChange === 'down') {
          return { bias: 'bearish', strength: 'moderate', reason: 'Lockere BoJ-Politik schwächt den Yen.' };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'BoJ hält Politik stabil.' };
      }
      
      // USD als Reservewährung - globale Bedeutung
      if (currency === 'USD') {
        if (rateChange === 'down') {
          return { 
            bias: 'bearish', 
            strength: 'moderate',
            reason: 'Fed senkt Zinsen im Rahmen des Lockerungszyklus. Niedrigere Zinsen reduzieren die Attraktivität von US-Anleihen für internationale Investoren. Dollar verliert an relativer Renditestärke.'
          };
        }
        if (rateChange === 'up') {
          return { bias: 'bullish', strength: 'strong', reason: 'Fed erhöht Zinsen - USD wird attraktiver.' };
        }
        if (rate >= 4.0) {
          return { 
            bias: 'bullish', 
            strength: 'weak',
            reason: `Mit ${rate}% bietet der USD weiterhin attraktive Renditen im globalen Vergleich. Safe-Haven-Status bleibt intakt.`
          };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'Fed hält Zinsen stabil.' };
      }
      
      // EUR - EZB Politik
      if (currency === 'EUR') {
        if (rateChange === 'down') {
          return { 
            bias: 'bearish', 
            strength: 'moderate',
            reason: 'EZB setzt Lockerungszyklus fort wegen schwachem Wachstum in der Eurozone. Besonders Deutschland kämpft mit industrieller Rezession. Niedrigere Zinsen belasten EUR.'
          };
        }
        if (rateChange === 'up') {
          return { bias: 'bullish', strength: 'strong', reason: 'EZB strafft Geldpolitik - EUR wird gestärkt.' };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'EZB hält Zinsen stabil.' };
      }
      
      // GBP - BoE Politik
      if (currency === 'GBP') {
        if (rateChange === 'down') {
          return { 
            bias: 'bearish', 
            strength: 'moderate',
            reason: 'Bank of England senkt Zinsen vorsichtig. UK-Wirtschaft kämpft mit hoher Inflation und schwachem Wachstum. Graduelle Lockerung belastet das Pfund.'
          };
        }
        if (rateChange === 'up') {
          return { bias: 'bullish', strength: 'strong', reason: 'BoE erhöht Zinsen - GBP wird gestärkt.' };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'BoE hält Zinsen stabil.' };
      }
      
      // CHF als Safe Haven - besondere Dynamik
      if (currency === 'CHF') {
        return { 
          bias: 'neutral', 
          strength: 'weak',
          reason: 'SNB verfolgt stabile Politik. CHF profitiert von Safe-Haven-Flows in Krisenzeiten, ist aber durch niedrige Zinsen weniger attraktiv für Carry Trades.'
        };
      }
      
      // Rohstoffwährungen (AUD, CAD, NZD)
      if (['AUD', 'CAD', 'NZD'].includes(currency)) {
        const commodityName = currency === 'AUD' ? 'Eisenerz/Gold' : currency === 'CAD' ? 'Öl' : 'Milchprodukte';
        if (rateChange === 'down') {
          return { 
            bias: 'bearish', 
            strength: rate >= 3.5 ? 'weak' : 'moderate',
            reason: `Zentralbank senkt Zinsen. Als Rohstoffwährung abhängig von ${commodityName}-Preisen und China-Nachfrage. Niedrigere Zinsen reduzieren Carry-Trade-Attraktivität.`
          };
        }
        if (rateChange === 'up') {
          return { 
            bias: 'bullish', 
            strength: rate >= 4.0 ? 'strong' : 'moderate',
            reason: `Zinserhöhung macht ${currency} attraktiver. Rohstoffpreise und China-Wirtschaft als zusätzliche Faktoren beachten.`
          };
        }
        return { bias: 'neutral', strength: 'weak', reason: 'Zentralbank hält Zinsen stabil.' };
      }
      
      // Fallback für andere
      if (rateChange === 'down') {
        return { bias: 'bearish', strength: rate >= 3.5 ? 'weak' : 'moderate', reason: 'Zinssenkung belastet die Währung.' };
      }
      if (rateChange === 'up') {
        return { bias: 'bullish', strength: rate >= 4.0 ? 'strong' : 'moderate', reason: 'Zinserhöhung stärkt die Währung.' };
      }
      return { bias: 'neutral', strength: 'weak', reason: 'Stabile Zinspolitik.' };
    };

    const data: CurrencyData[] = CURRENCIES.map(curr => {
      const rates = interestRates[curr.id];
      const cot = cotParsed.find((c: any) => c.currency === curr.id);
      
      // News-Bias aus Zinspolitik ableiten (deterministisch, nicht zufällig)
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
              'w-1.5 h-3 rounded-sm',
              i <= count ? 'bg-accent-gold' : 'bg-gray-600'
            )}
          />
        ))}
      </div>
    );
  };

  const currencyInfo = (id: string) => CURRENCIES.find(c => c.id === id);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Globe2 className="text-accent-primary" />
            Währungsanalyse
          </h1>
          {lastUpdate && (
            <p className="text-sm text-text-muted mt-1">
              Letztes Update: {lastUpdate.toLocaleDateString('de-DE')} {lastUpdate.toLocaleTimeString('de-DE')}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-background-surface rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={clsx(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                activeTab === 'overview' ? 'bg-accent-gold text-black' : 'text-text-muted hover:text-white'
              )}
            >
              Übersicht
            </button>
            <button
              onClick={() => setActiveTab('pairs')}
              className={clsx(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                activeTab === 'pairs' ? 'bg-accent-gold text-black' : 'text-text-muted hover:text-white'
              )}
            >
              Pair Empfehlungen
            </button>
          </div>
          
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={18} className={clsx(isLoading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Info Banner */}
          <div className="card mb-6 bg-accent-blue/10 border-accent-blue/30">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-accent-blue mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-text-primary mb-1">So funktioniert die Analyse</h4>
                <ul className="text-sm text-text-muted space-y-1">
                  <li><strong>Zinssätze:</strong> Höhere Zinsen → Währung attraktiver (außer JPY-Sonderfall)</li>
                  <li><strong>Zinspolitik:</strong> Zinserhöhung = bullish, Zinssenkung = bearish</li>
                  <li><strong>COT-Daten:</strong> Positionierung der Commercials (Smart Money) aus CFTC-Berichten</li>
                  <li><strong>Overall Score:</strong> Kombination aus Zinsen, Zinspolitik und COT-Positionierung</li>
                </ul>
                <p className="text-xs text-text-muted mt-2 flex items-center gap-2">
                  <AlertTriangle size={12} />
                  COT-Daten müssen zuerst auf der COT-Seite geladen werden. Zinssätze: Stand Februar 2026.
                </p>
              </div>
            </div>
          </div>
          
          {/* Currency Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {currencyData.map(data => {
              return (
                <button 
                  key={data.currency} 
                  onClick={() => setSelectedCurrency(data)}
                  className="card text-left transition-all hover:ring-2 hover:ring-accent-primary/50 hover:scale-[1.02]"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{data.currency}</span>
                      <Info size={14} className="text-text-muted" />
                    </div>
                    <div className={clsx(
                      'px-2 py-1 rounded text-xs font-bold flex items-center gap-1',
                      data.overallBias === 'bullish' && 'bg-pnl-positive/20 text-pnl-positive',
                      data.overallBias === 'bearish' && 'bg-pnl-negative/20 text-pnl-negative',
                      data.overallBias === 'neutral' && 'bg-gray-500/20 text-gray-400'
                    )}>
                      {getBiasIcon(data.overallBias)}
                      {data.overallBias.toUpperCase()}
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-text-muted mb-1">
                      <span>Bearish</span>
                      <span className="font-semibold">{data.overallScore > 0 ? '+' : ''}{data.overallScore}</span>
                      <span>Bullish</span>
                    </div>
                    <div className="h-2 bg-background rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 flex">
                        <div className="w-1/2 bg-pnl-negative/30" />
                        <div className="w-1/2 bg-pnl-positive/30" />
                      </div>
                      <div 
                        className="absolute h-full w-1 bg-white rounded"
                        style={{ left: `${50 + data.overallScore / 2}%`, transform: 'translateX(-50%)' }}
                      />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 text-sm">
                    {/* Interest Rate */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-text-muted">
                        <Percent size={14} />
                        <span>Zinssatz</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{data.interestRate}%</span>
                        {data.rateChange === 'up' && <TrendingUp size={14} className="text-pnl-positive" />}
                        {data.rateChange === 'down' && <TrendingDown size={14} className="text-pnl-negative" />}
                      </div>
                    </div>

                    {/* News */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-text-muted">
                        <Newspaper size={14} />
                        <span>News</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx('font-semibold capitalize', getBiasColor(data.newsBias))}>
                          {data.newsBias}
                        </span>
                        {getStrengthBars(data.newsStrength)}
                      </div>
                    </div>

                    {/* COT */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-text-muted">
                        <Database size={14} />
                        <span>COT</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx('font-semibold capitalize', getBiasColor(data.cotBias))}>
                          {data.cotBias}
                        </span>
                        {getStrengthBars(data.cotStrength)}
                      </div>
                    </div>
                  </div>

                  {/* Next Meeting */}
                  <div className="mt-4 pt-3 border-t border-border text-xs text-text-muted">
                    Nächstes Meeting: {new Date(data.nextMeeting).toLocaleDateString('de-DE')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="card">
            <h4 className="font-semibold mb-3">Legende</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="flex items-center gap-2 text-pnl-positive mb-1">
                  <TrendingUp size={16} />
                  <span className="font-medium">Bullish</span>
                </div>
                <p className="text-text-muted text-xs">Positive Erwartung, Long-Bias</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Minus size={16} />
                  <span className="font-medium">Neutral</span>
                </div>
                <p className="text-text-muted text-xs">Keine klare Richtung</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-pnl-negative mb-1">
                  <TrendingDown size={16} />
                  <span className="font-medium">Bearish</span>
                </div>
                <p className="text-text-muted text-xs">Negative Erwartung, Short-Bias</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Pair Recommendations */}
          <div className="space-y-4">
            {pairRecommendations.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {pairRecommendations.map((rec) => (
                    <button 
                      key={rec.pair}
                      onClick={() => setSelectedPair(rec)}
                      className={clsx(
                        'card border-2 text-left transition-all hover:scale-[1.02] cursor-pointer',
                        rec.direction === 'LONG' 
                          ? 'border-pnl-positive/50 hover:border-pnl-positive' 
                          : 'border-pnl-negative/50 hover:border-pnl-negative'
                      )}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center">
                            <span className="text-2xl">{currencyInfo(rec.pair.split('/')[0])?.flag}</span>
                            <ArrowRightLeft size={16} className="mx-1 text-text-muted" />
                            <span className="text-2xl">{currencyInfo(rec.pair.split('/')[1])?.flag}</span>
                          </div>
                          <div>
                            <div className="font-bold text-lg">{rec.pair}</div>
                            <div className="text-xs text-text-muted">
                              Zinsdiff: {rec.interestDiff >= 0 ? '+' : ''}{rec.interestDiff.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={clsx(
                            'px-3 py-1 rounded-lg text-lg font-bold inline-block',
                            rec.direction === 'LONG' 
                              ? 'bg-pnl-positive text-white' 
                              : 'bg-pnl-negative text-white'
                          )}>
                            {rec.direction}
                          </div>
                        </div>
                      </div>

                      {/* Confidence Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-text-muted">Konfidenz</span>
                          <span className="font-semibold">{rec.confidence}%</span>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden">
                          <div 
                            className={clsx(
                              'h-full rounded-full transition-all',
                              rec.direction === 'LONG' ? 'bg-pnl-positive' : 'bg-pnl-negative'
                            )}
                            style={{ width: `${rec.confidence}%` }}
                          />
                        </div>
                      </div>

                      {/* Reasons */}
                      <div className="space-y-2">
                        {rec.reasons.map((reason, j) => (
                          <div key={j} className="flex items-center gap-2 text-sm">
                            <CheckCircle2 size={14} className="text-accent-primary flex-shrink-0" />
                            <span className="text-text-muted">{reason}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* Click hint */}
                      <div className="mt-4 pt-3 border-t border-white/10 text-center">
                        <span className="text-xs text-accent-primary">Klicke für detaillierte Analyse →</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="card bg-background-surface">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-accent-primary flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-text-primary mb-1">Hinweis</p>
                      <p className="text-text-muted">
                        Diese Empfehlungen basieren auf fundamentalen Faktoren (Zinsen, COT, News) und ersetzen 
                        keine technische Analyse. Immer mit eigenem Setup und Risikomanagement traden!
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card text-center py-12">
                <Target size={48} className="mx-auto text-text-muted/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine starken Empfehlungen</h3>
                <p className="text-text-muted">
                  Aktuell gibt es keine Pairs mit ausreichend hoher Konfidenz.
                  Aktualisiere die Daten oder warte auf klarere Signale.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Upcoming High-Impact Events */}
      {upcomingEvents.length > 0 && (
        <div className="mt-6 card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="text-pnl-negative" size={20} />
            <h3 className="text-lg font-semibold">Kommende High-Impact Events (Forex Factory)</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {upcomingEvents.slice(0, 8).map((event, i) => (
              <div 
                key={i}
                className="p-3 rounded-lg bg-pnl-negative/10 border border-pnl-negative/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold">{event.currency}</span>
                  <span className="text-xs text-pnl-negative font-medium">HIGH</span>
                </div>
                <div className="text-sm text-text-primary mb-1 line-clamp-2">{event.event}</div>
                <div className="text-xs text-text-muted">
                  {new Date(event.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })} 
                  {event.time !== 'All Day' && ` • ${event.time}`}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-3 flex items-center gap-2">
            <AlertTriangle size={12} />
            Vorsicht beim Traden um High-Impact Events – hohe Volatilität erwartet!
          </p>
        </div>
      )}

      {/* Data Sources */}
      <div className="mt-6 p-4 bg-background-surface rounded-lg border border-border text-sm text-text-muted">
        <h4 className="font-semibold text-text-primary mb-2">Datenquellen</h4>
        <div className="flex flex-wrap gap-4">
          <a href="https://www.forexfactory.com" target="_blank" rel="noopener noreferrer" 
             className="flex items-center gap-1 hover:text-accent-primary">
            News Kalender <ExternalLink size={12} />
          </a>
          <a href="https://www.cftc.gov" target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1 hover:text-accent-primary">
            CFTC COT Reports <ExternalLink size={12} />
          </a>
          <a href="https://www.tradingeconomics.com" target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1 hover:text-accent-primary">
            Interest Rates <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Currency Detail Modal */}
      {selectedCurrency && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCurrency(null)}
        >
          <div 
            className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{selectedCurrency.currency}</span>
                <div className={clsx(
                  'px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1',
                  selectedCurrency.overallBias === 'bullish' && 'bg-pnl-positive/20 text-pnl-positive',
                  selectedCurrency.overallBias === 'bearish' && 'bg-pnl-negative/20 text-pnl-negative',
                  selectedCurrency.overallBias === 'neutral' && 'bg-gray-500/20 text-gray-400'
                )}>
                  {getBiasIcon(selectedCurrency.overallBias)}
                  {selectedCurrency.overallBias.toUpperCase()}
                </div>
              </div>
              <button onClick={() => setSelectedCurrency(null)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            {/* Bias Reasoning */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Warum {selectedCurrency.overallBias.toUpperCase()}?</h3>
              
              {/* Factors */}
              <div className="space-y-3">
                {/* Interest Rate Factor */}
                <div className={clsx(
                  'p-4 rounded-lg border-l-4',
                  selectedCurrency.rateChange === 'up' ? 'bg-pnl-positive/10 border-pnl-positive' :
                  selectedCurrency.rateChange === 'down' ? 'bg-pnl-negative/10 border-pnl-negative' :
                  'bg-background-surface border-gray-500'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Percent size={18} />
                    <span className="font-semibold">Zinssatz: {selectedCurrency.interestRate}%</span>
                    {selectedCurrency.rateChange === 'up' && <TrendingUp size={16} className="text-pnl-positive" />}
                    {selectedCurrency.rateChange === 'down' && <TrendingDown size={16} className="text-pnl-negative" />}
                  </div>
                  <p className="text-sm text-text-muted">
                    {selectedCurrency.rateChange === 'up' 
                      ? `Die Zentralbank hat die Zinsen erhöht. Höhere Zinsen machen ${selectedCurrency.currency} attraktiver für Investoren, da sie höhere Renditen auf Einlagen bieten. Dies stärkt die Währung.`
                      : selectedCurrency.rateChange === 'down'
                      ? `Die Zentralbank hat die Zinsen gesenkt. Niedrigere Zinsen machen ${selectedCurrency.currency} weniger attraktiv für Investoren. Kapital fließt in Währungen mit höheren Renditen.`
                      : `Die Zentralbank hält die Zinsen stabil bei ${selectedCurrency.interestRate}%. Dies signalisiert eine abwartende Haltung der Zentralbank.`
                    }
                  </p>
                  <p className="text-xs text-text-muted mt-2">
                    Nächstes Meeting: {new Date(selectedCurrency.nextMeeting).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>

                {/* News Factor */}
                <div className={clsx(
                  'p-4 rounded-lg border-l-4',
                  selectedCurrency.newsBias === 'bullish' ? 'bg-pnl-positive/10 border-pnl-positive' :
                  selectedCurrency.newsBias === 'bearish' ? 'bg-pnl-negative/10 border-pnl-negative' :
                  'bg-background-surface border-gray-500'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Newspaper size={18} />
                    <span className="font-semibold">News-Sentiment: {selectedCurrency.newsBias.toUpperCase()}</span>
                    {getStrengthBars(selectedCurrency.newsStrength)}
                  </div>
                  <p className="text-sm text-text-muted">
                    {selectedCurrency.newsReason || (
                      selectedCurrency.newsBias === 'bullish' 
                        ? `Positive Wirtschaftsnachrichten für ${selectedCurrency.currency}.`
                        : selectedCurrency.newsBias === 'bearish'
                        ? `Negative Wirtschaftsnachrichten für ${selectedCurrency.currency}.`
                        : `Gemischte Nachrichtenlage für ${selectedCurrency.currency}.`
                    )}
                  </p>
                </div>

                {/* COT Factor */}
                <div className={clsx(
                  'p-4 rounded-lg border-l-4',
                  selectedCurrency.cotBias === 'bullish' ? 'bg-pnl-positive/10 border-pnl-positive' :
                  selectedCurrency.cotBias === 'bearish' ? 'bg-pnl-negative/10 border-pnl-negative' :
                  'bg-background-surface border-gray-500'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={18} />
                    <span className="font-semibold">COT-Positionierung: {selectedCurrency.cotBias.toUpperCase()}</span>
                    {getStrengthBars(selectedCurrency.cotStrength)}
                  </div>
                  <p className="text-sm text-text-muted">
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

              {/* Score Summary */}
              <div className="mt-6 p-4 rounded-lg bg-background-surface">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">Gesamt-Score</span>
                  <span className={clsx(
                    'text-xl font-bold',
                    selectedCurrency.overallScore > 20 ? 'text-pnl-positive' :
                    selectedCurrency.overallScore < -20 ? 'text-pnl-negative' :
                    'text-gray-400'
                  )}>
                    {selectedCurrency.overallScore > 0 ? '+' : ''}{selectedCurrency.overallScore}
                  </span>
                </div>
                <div className="h-3 bg-background rounded-full overflow-hidden relative">
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 bg-pnl-negative/30" />
                    <div className="w-1/2 bg-pnl-positive/30" />
                  </div>
                  <div 
                    className="absolute h-full w-2 bg-white rounded shadow-lg"
                    style={{ left: `${50 + selectedCurrency.overallScore / 2}%`, transform: 'translateX(-50%)' }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted mt-1">
                  <span>-100 (Bearish)</span>
                  <span>0 (Neutral)</span>
                  <span>+100 (Bullish)</span>
                </div>
              </div>

              {/* Trading Implication */}
              <div className={clsx(
                'p-4 rounded-lg border',
                selectedCurrency.overallBias === 'bullish' ? 'border-pnl-positive bg-pnl-positive/5' :
                selectedCurrency.overallBias === 'bearish' ? 'border-pnl-negative bg-pnl-negative/5' :
                'border-gray-500 bg-gray-500/5'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={18} />
                  <span className="font-semibold">Trading-Implikation</span>
                </div>
                <p className="text-sm">
                  {selectedCurrency.overallBias === 'bullish' 
                    ? `Suche Long-Einstiege in Pairs wo ${selectedCurrency.currency} die Basiswährung ist (z.B. ${selectedCurrency.currency}/JPY) oder Short-Einstiege wo ${selectedCurrency.currency} die Gegenwährung ist.`
                    : selectedCurrency.overallBias === 'bearish'
                    ? `Suche Short-Einstiege in Pairs wo ${selectedCurrency.currency} die Basiswährung ist oder Long-Einstiege wo ${selectedCurrency.currency} die Gegenwährung ist.`
                    : `Keine klare Richtung. Fokussiere dich auf andere Währungen mit stärkerem Bias oder warte auf klarere Signale.`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pair Recommendation Detail Modal */}
      {selectedPair && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPair(null)}
        >
          <div 
            className="card w-full max-w-3xl max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-4xl">{currencyInfo(selectedPair.pair.split('/')[0])?.flag}</span>
                  <ArrowRightLeft size={24} className="text-text-muted" />
                  <span className="text-4xl">{currencyInfo(selectedPair.pair.split('/')[1])?.flag}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{selectedPair.pair}</h2>
                  <div className={clsx(
                    'inline-block px-3 py-1 rounded-lg text-sm font-bold mt-1',
                    selectedPair.direction === 'LONG' 
                      ? 'bg-pnl-positive text-white' 
                      : 'bg-pnl-negative text-white'
                  )}>
                    {selectedPair.direction} EMPFEHLUNG
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPair(null)}
                className="text-text-muted hover:text-text-primary p-2"
              >
                <X size={24} />
              </button>
            </div>

            {/* Confidence */}
            <div className="mb-6 p-4 rounded-lg bg-background-surface">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold">Konfidenz-Level</span>
                <span className="text-2xl font-bold">{selectedPair.confidence}%</span>
              </div>
              <div className="h-4 bg-background rounded-full overflow-hidden">
                <div 
                  className={clsx(
                    'h-full rounded-full transition-all',
                    selectedPair.direction === 'LONG' ? 'bg-pnl-positive' : 'bg-pnl-negative'
                  )}
                  style={{ width: `${selectedPair.confidence}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-2">
                {selectedPair.confidence >= 70 ? 'Hohe Konfidenz - Starke fundamentale Übereinstimmung' :
                 selectedPair.confidence >= 50 ? 'Mittlere Konfidenz - Gute fundamentale Basis' :
                 'Niedrige Konfidenz - Schwächere fundamentale Signale'}
              </p>
            </div>

            {/* Detailed Analysis */}
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Info size={18} className="text-accent-primary" />
                Warum macht dieser Trade Sinn?
              </h3>
              
              {(() => {
                const [base, quote] = selectedPair.pair.split('/');
                const baseData = currencyData.find(c => c.currency === base);
                const quoteData = currencyData.find(c => c.currency === quote);
                
                if (!baseData || !quoteData) return null;
                
                return (
                  <div className="space-y-4">
                    {/* Interest Rate Analysis */}
                    <div className="p-4 rounded-lg border border-border bg-background-surface">
                      <div className="flex items-center gap-2 mb-3">
                        <Percent size={18} className="text-accent-gold" />
                        <span className="font-semibold">Zinsdifferenz-Analyse</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="text-center p-3 rounded bg-background">
                          <div className="text-2xl font-bold">{baseData.interestRate}%</div>
                          <div className="text-sm text-text-muted">{base} Zinssatz</div>
                          <div className={clsx('text-xs mt-1', 
                            baseData.rateChange === 'up' ? 'text-pnl-positive' :
                            baseData.rateChange === 'down' ? 'text-pnl-negative' : 'text-text-muted'
                          )}>
                            {baseData.rateChange === 'up' ? '↑ Steigend' : 
                             baseData.rateChange === 'down' ? '↓ Sinkend' : '→ Stabil'}
                          </div>
                        </div>
                        <div className="text-center p-3 rounded bg-background">
                          <div className="text-2xl font-bold">{quoteData.interestRate}%</div>
                          <div className="text-sm text-text-muted">{quote} Zinssatz</div>
                          <div className={clsx('text-xs mt-1', 
                            quoteData.rateChange === 'up' ? 'text-pnl-positive' :
                            quoteData.rateChange === 'down' ? 'text-pnl-negative' : 'text-text-muted'
                          )}>
                            {quoteData.rateChange === 'up' ? '↑ Steigend' : 
                             quoteData.rateChange === 'down' ? '↓ Sinkend' : '→ Stabil'}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary">
                        <strong>Differenz: {selectedPair.interestDiff >= 0 ? '+' : ''}{selectedPair.interestDiff.toFixed(2)}%</strong>
                        {selectedPair.interestDiff > 0.5 
                          ? ` - ${base} bietet höhere Rendite. Carry-Trade favorisiert ${selectedPair.direction === 'LONG' ? 'Long' : 'Short'}.`
                          : selectedPair.interestDiff < -0.5
                          ? ` - ${quote} bietet höhere Rendite. Carry-Trade-Dynamik beachten.`
                          : ' - Geringe Zinsdifferenz. Andere Faktoren dominieren.'}
                      </p>
                    </div>

                    {/* News/Fundamental Bias */}
                    <div className="p-4 rounded-lg border border-border bg-background-surface">
                      <div className="flex items-center gap-2 mb-3">
                        <Newspaper size={18} className="text-accent-blue" />
                        <span className="font-semibold">Fundamentale Einschätzung</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className={clsx(
                          'p-3 rounded border',
                          baseData.newsBias === 'bullish' ? 'border-pnl-positive bg-pnl-positive/10' :
                          baseData.newsBias === 'bearish' ? 'border-pnl-negative bg-pnl-negative/10' :
                          'border-gray-500 bg-gray-500/10'
                        )}>
                          <div className="font-bold flex items-center gap-2">
                            {base} {getBiasIcon(baseData.newsBias)}
                            <span className={getBiasColor(baseData.newsBias)}>{baseData.newsBias.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-2 line-clamp-3">{baseData.newsReason}</p>
                        </div>
                        <div className={clsx(
                          'p-3 rounded border',
                          quoteData.newsBias === 'bullish' ? 'border-pnl-positive bg-pnl-positive/10' :
                          quoteData.newsBias === 'bearish' ? 'border-pnl-negative bg-pnl-negative/10' :
                          'border-gray-500 bg-gray-500/10'
                        )}>
                          <div className="font-bold flex items-center gap-2">
                            {quote} {getBiasIcon(quoteData.newsBias)}
                            <span className={getBiasColor(quoteData.newsBias)}>{quoteData.newsBias.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-2 line-clamp-3">{quoteData.newsReason}</p>
                        </div>
                      </div>
                    </div>

                    {/* COT Analysis */}
                    <div className="p-4 rounded-lg border border-border bg-background-surface">
                      <div className="flex items-center gap-2 mb-3">
                        <Database size={18} className="text-accent-primary" />
                        <span className="font-semibold">COT-Positionierung (Smart Money)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className={clsx(
                          'p-3 rounded border',
                          baseData.cotBias === 'bullish' ? 'border-pnl-positive bg-pnl-positive/10' :
                          baseData.cotBias === 'bearish' ? 'border-pnl-negative bg-pnl-negative/10' :
                          'border-gray-500 bg-gray-500/10'
                        )}>
                          <div className="font-bold flex items-center gap-2">
                            {base} {getBiasIcon(baseData.cotBias)}
                            <span className={getBiasColor(baseData.cotBias)}>{baseData.cotBias.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-2">{baseData.cotReason}</p>
                        </div>
                        <div className={clsx(
                          'p-3 rounded border',
                          quoteData.cotBias === 'bullish' ? 'border-pnl-positive bg-pnl-positive/10' :
                          quoteData.cotBias === 'bearish' ? 'border-pnl-negative bg-pnl-negative/10' :
                          'border-gray-500 bg-gray-500/10'
                        )}>
                          <div className="font-bold flex items-center gap-2">
                            {quote} {getBiasIcon(quoteData.cotBias)}
                            <span className={getBiasColor(quoteData.cotBias)}>{quoteData.cotBias.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-2">{quoteData.cotReason}</p>
                        </div>
                      </div>
                    </div>

                    {/* Score Comparison */}
                    <div className="p-4 rounded-lg border border-border bg-background-surface">
                      <div className="flex items-center gap-2 mb-3">
                        <Target size={18} className="text-pnl-positive" />
                        <span className="font-semibold">Score-Vergleich</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="text-center p-3 rounded bg-background">
                          <div className={clsx('text-3xl font-bold', 
                            baseData.overallScore > 0 ? 'text-pnl-positive' : 
                            baseData.overallScore < 0 ? 'text-pnl-negative' : 'text-text-muted'
                          )}>
                            {baseData.overallScore > 0 ? '+' : ''}{baseData.overallScore}
                          </div>
                          <div className="text-sm text-text-muted">{base} Score</div>
                        </div>
                        <div className="text-center p-3 rounded bg-background">
                          <div className={clsx('text-3xl font-bold', 
                            quoteData.overallScore > 0 ? 'text-pnl-positive' : 
                            quoteData.overallScore < 0 ? 'text-pnl-negative' : 'text-text-muted'
                          )}>
                            {quoteData.overallScore > 0 ? '+' : ''}{quoteData.overallScore}
                          </div>
                          <div className="text-sm text-text-muted">{quote} Score</div>
                        </div>
                      </div>
                      <p className="text-sm text-text-secondary text-center">
                        <strong>Differenz: {baseData.overallScore - quoteData.overallScore > 0 ? '+' : ''}{baseData.overallScore - quoteData.overallScore}</strong>
                        {' → '}
                        {selectedPair.direction === 'LONG' 
                          ? `${base} ist fundamentaler stärker als ${quote}`
                          : `${quote} ist fundamental stärker als ${base}`}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Trading Recommendation Box */}
            <div className={clsx(
              'p-4 rounded-lg border-2',
              selectedPair.direction === 'LONG' 
                ? 'border-pnl-positive bg-pnl-positive/10' 
                : 'border-pnl-negative bg-pnl-negative/10'
            )}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={20} className={selectedPair.direction === 'LONG' ? 'text-pnl-positive' : 'text-pnl-negative'} />
                <span className="font-bold text-lg">Fazit</span>
              </div>
              <p className="text-sm">
                Die fundamentale Analyse spricht für einen <strong>{selectedPair.direction}</strong> Trade in {selectedPair.pair}. 
                {selectedPair.confidence >= 60 
                  ? ' Die Konfluenz mehrerer Faktoren (Zinsen, COT, News-Bias) gibt diesem Setup eine solide Grundlage.'
                  : ' Obwohl einige Faktoren übereinstimmen, warte idealerweise auf technische Bestätigung.'}
              </p>
              <div className="mt-3 p-3 rounded bg-background/50">
                <div className="text-xs text-text-muted">
                  <strong>Wichtig:</strong> Dies ist eine fundamentale Einschätzung. Kombiniere sie immer mit technischer Analyse 
                  (Support/Resistance, Price Action, Trend) und solidem Risikomanagement!
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
