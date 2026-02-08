/**
 * ========================================================================
 * Trading Journal - COT Data Page (Überarbeitet)
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
import { getApi } from '@/services/webApi';

// Währungen und ihre CFTC Codes
const CURRENCIES = [
  { id: 'EUR', name: 'EUR', cftcCode: '099741', flag: '🇪🇺' },
  { id: 'GBP', name: 'GBP', cftcCode: '096742', flag: '🇬🇧' },
  { id: 'JPY', name: 'JPY', cftcCode: '097741', flag: '🇯🇵' },
  { id: 'CAD', name: 'CAD', cftcCode: '090741', flag: '🇨🇦' },
  { id: 'AUD', name: 'AUD', cftcCode: '232741', flag: '🇦🇺' },
  { id: 'NZD', name: 'NZD', cftcCode: '112741', flag: '🇳🇿' },
  { id: 'CHF', name: 'CHF', cftcCode: '092741', flag: '🇨🇭' },
  { id: 'USD', name: 'USD', cftcCode: '098662', flag: '🇺🇸' },
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
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Database className="text-accent-primary" />
            COT Daten (Commercials)
          </h1>
          <div className="flex items-center gap-4 mt-1">
            {lastUpdate && cotData.length > 0 && (
              <p className="text-sm text-text-muted">
                Report vom: <span className="text-text-primary font-medium">{cotData[0]?.date}</span>
                {dataSource === 'cache' && <span className="text-text-muted"> (Cache)</span>}
                {dataSource === 'live' && <span className="text-pnl-positive"> (Live)</span>}
                {dataSource === 'manual' && <span className="text-accent-gold"> (Manuell)</span>}
              </p>
            )}
            <p className="text-sm text-text-muted">
              Nächste Veröffentlichung: <span className="text-accent-gold font-medium">{nextRelease.toLocaleDateString('de-DE')} ~21:30</span>
            </p>
            {isDataFresh && dataSource === 'live' && (
              <span className="inline-flex items-center gap-1 text-xs text-pnl-positive">
                <CheckCircle2 size={12} /> Aktuell
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <a 
            href="https://www.cftc.gov/dea/futures/deacmesf.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-muted hover:text-accent-primary flex items-center gap-1"
          >
            CFTC Quelle <ExternalLink size={14} />
          </a>
          
          <button
            onClick={openManualInput}
            className="btn-secondary flex items-center gap-2"
            title="COT-Daten manuell eingeben (offline)"
          >
            <Edit3 size={18} />
            Manuell
          </button>
          
          <button
            onClick={fetchCOTData}
            disabled={isLoading}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={18} className={clsx(isLoading && 'animate-spin')} />
            {isLoading ? 'Laden...' : 'Aktualisieren'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-pnl-negative/10 border border-pnl-negative/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-pnl-negative flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-pnl-negative font-medium">{error}</p>
              <p className="text-sm text-text-muted mt-1">
                Mögliche Lösungen:
              </p>
              <ul className="text-sm text-text-muted list-disc ml-5 mt-1">
                <li>Internetverbindung prüfen</li>
                <li>Später erneut versuchen (CFTC-Server könnte überlastet sein)</li>
                <li>VPN deaktivieren falls aktiv</li>
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={fetchCOTData}
                  disabled={isLoading}
                  className="btn-secondary text-sm py-1.5"
                >
                  <RefreshCw size={14} className={clsx(isLoading && 'animate-spin')} />
                  Erneut versuchen
                </button>
                <a 
                  href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm py-1.5"
                >
                  <ExternalLink size={14} />
                  CFTC Webseite
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-accent-gold/10 border border-accent-gold/30 rounded-lg flex items-start gap-3">
        <AlertCircle className="text-accent-gold flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-text-secondary">
          <p className="font-medium text-accent-gold mb-1">COT Report Info</p>
          <p>Die CFTC veröffentlicht die COT-Daten jeden <strong>Freitag um 21:30 CET</strong> mit Daten vom Dienstag. 
          Die Daten ändern sich nur wöchentlich. Die Daten werden automatisch beim Start geladen und gecacht.</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && cotData.length === 0 && (
        <div className="text-center py-12">
          <RefreshCw size={48} className="animate-spin text-accent-primary mx-auto mb-4" />
          <p className="text-text-muted">Lade COT-Daten von der CFTC...</p>
        </div>
      )}

      {/* No Data State */}
      {!isLoading && cotData.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle size={48} className="text-pnl-negative mx-auto mb-4" />
          <p className="text-text-primary font-medium mb-2">Keine COT-Daten verfügbar</p>
          <p className="text-text-muted mb-4">Bitte klicke auf "Aktualisieren" um die Daten von der CFTC zu laden.</p>
          <button
            onClick={fetchCOTData}
            disabled={isLoading}
            className="btn-primary"
          >
            <RefreshCw size={18} />
            Daten laden
          </button>
        </div>
      )}

      {/* Currency Grid */}
      {cotData.length > 0 && (
      <>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {CURRENCIES.map(currency => {
          const data = cotData.find(d => d.currency === currency.id);
          const isSelected = selectedCurrency === currency.id;
          
          return (
            <button
              key={currency.id}
              onClick={() => setSelectedCurrency(isSelected ? null : currency.id)}
              className={clsx(
                'card text-left transition-all hover:scale-[1.02]',
                isSelected && 'ring-2 ring-accent-primary'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{currency.id}</span>
                </div>
                {data && (
                  <div 
                    className="px-2 py-1 rounded text-xs font-bold"
                    style={{ 
                      backgroundColor: `${getSignalColor(data.signal)}20`,
                      color: getSignalColor(data.signal)
                    }}
                  >
                    {getSignalLabel(data.signal)}
                  </div>
                )}
              </div>
              
              {data ? (
                <div className="space-y-2">
                  {/* Long/Short Positionen */}
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Long:</span>
                    <span className="font-semibold text-pnl-positive">
                      {data.commercialsLong.toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Short:</span>
                    <span className="font-semibold text-pnl-negative">
                      {data.commercialsShort.toLocaleString('de-DE')}
                    </span>
                  </div>
                  
                  {/* Trennlinie */}
                  <div className="border-t border-white/10 my-2" />
                  
                  {/* Net Position */}
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Net:</span>
                    <span className={clsx(
                      'font-semibold',
                      data.commercialsNet >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                    )}>
                      {data.commercialsNet >= 0 ? '+' : ''}{data.commercialsNet.toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Änderung:</span>
                    <span className={clsx(
                      'font-semibold flex items-center gap-1',
                      data.weeklyChange >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
                    )}>
                      {data.weeklyChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {data.weeklyChange >= 0 ? '+' : ''}{data.weeklyChange.toLocaleString('de-DE')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Perzentil:</span>
                    <span className="font-semibold">{data.percentileRank}%</span>
                  </div>
                  
                  <div className="h-2 bg-background rounded-full overflow-hidden mt-2">
                    <div 
                      className="h-full transition-all rounded-full"
                      style={{ 
                        width: `${data.percentileRank}%`,
                        backgroundColor: getSignalColor(data.signal)
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-text-muted text-sm">Keine Daten</div>
              )}
            </button>
          );
        })}
      </div>
      </>
      )}

      {/* Selected Currency Detail */}
      {selectedCurrency && selectedData && (
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{selectedCurrencyInfo?.flag}</span>
            <div>
              <h3 className="text-lg font-semibold">{selectedCurrencyInfo?.name} ({selectedCurrency})</h3>
              <p className="text-sm text-text-muted">Commercials Net Position - 52 Wochen</p>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selectedHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis 
                  dataKey="date" 
                  stroke="#888"
                  tickFormatter={(d) => new Date(d).toLocaleDateString('de-DE', { month: 'short' })}
                />
                <YAxis 
                  stroke="#888"
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #333',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [value.toLocaleString('de-DE'), 'Net']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('de-DE')}
                />
                <ReferenceLine y={0} stroke="#555" strokeDasharray="5 5" />
                <Line 
                  type="monotone" 
                  dataKey="net" 
                  stroke={getSignalColor(selectedData.signal)} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pair Recommendations */}
      {pairRecommendations.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRightLeft className="text-accent-primary" size={20} />
            <h3 className="text-lg font-semibold">Pair Empfehlungen (COT basiert)</h3>
          </div>
          <p className="text-sm text-text-muted mb-4">
            Basierend auf divergierenden Commercial-Positionen zwischen Währungen
          </p>
          
          <div className="grid grid-cols-3 gap-4">
            {pairRecommendations.map((rec, i) => (
              <div 
                key={i}
                className={clsx(
                  'p-4 rounded-lg border',
                  rec.direction === 'LONG' 
                    ? 'bg-pnl-positive/10 border-pnl-positive/30' 
                    : 'bg-pnl-negative/10 border-pnl-negative/30'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-lg">{rec.pair}</span>
                  <span className={clsx(
                    'px-2 py-1 rounded text-sm font-bold',
                    rec.direction === 'LONG' ? 'bg-pnl-positive text-white' : 'bg-pnl-negative text-white'
                  )}>
                    {rec.direction}
                  </span>
                </div>
                <div className="text-xs text-text-muted">{rec.reason}</div>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-xs text-text-muted">Stärke:</span>
                  {[...Array(rec.strength)].map((_, j) => (
                    <CheckCircle2 key={j} size={12} className="text-accent-primary" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-background-surface rounded-lg border border-border text-sm text-text-muted">
        <h4 className="font-semibold text-text-primary mb-2">Über COT Daten</h4>
        <p>
          Die Commitment of Traders (COT) Reports werden jeden Freitag von der CFTC veröffentlicht.
          <strong> Commercials</strong> sind typischerweise Hedger (Banken, große Institutionen) und gelten als "Smart Money".
          Ein hoher Perzentilrang (80%+) bedeutet, dass Commercials stark long positioniert sind im historischen Vergleich.
        </p>
      </div>

      {/* Manual Input Modal */}
      {showManualInput && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-background-elevated border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Edit3 className="text-accent-primary" size={20} />
                <h2 className="text-lg font-semibold">COT Daten manuell eingeben</h2>
              </div>
              <button
                onClick={() => setShowManualInput(false)}
                className="text-text-muted hover:text-text-primary p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-text-muted mb-4">
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

              <div className="space-y-3">
                {CURRENCIES.filter(c => c.id !== 'USD').map(currency => (
                  <div key={currency.id} className="flex items-center gap-4 p-3 bg-background rounded-lg">
                    <div className="w-16 font-bold">{currency.id}</div>
                    <div className="flex-1 flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-text-muted mb-1 block">Long</label>
                        <input
                          type="number"
                          value={manualInputData[currency.id]?.long || ''}
                          onChange={(e) => setManualInputData(prev => ({
                            ...prev,
                            [currency.id]: { ...prev[currency.id], long: e.target.value }
                          }))}
                          className="w-full px-3 py-2 bg-background-surface border border-border rounded 
                                   text-text-primary focus:border-accent-primary focus:outline-none"
                          placeholder="z.B. 556661"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-text-muted mb-1 block">Short</label>
                        <input
                          type="number"
                          value={manualInputData[currency.id]?.short || ''}
                          onChange={(e) => setManualInputData(prev => ({
                            ...prev,
                            [currency.id]: { ...prev[currency.id], short: e.target.value }
                          }))}
                          className="w-full px-3 py-2 bg-background-surface border border-border rounded 
                                   text-text-primary focus:border-accent-primary focus:outline-none"
                          placeholder="z.B. 757245"
                        />
                      </div>
                      <div className="w-28 text-right">
                        <label className="text-xs text-text-muted mb-1 block">Net</label>
                        <div className={clsx(
                          'py-2 font-semibold',
                          (parseInt(manualInputData[currency.id]?.long || '0') - parseInt(manualInputData[currency.id]?.short || '0')) >= 0 
                            ? 'text-pnl-positive' 
                            : 'text-pnl-negative'
                        )}>
                          {((parseInt(manualInputData[currency.id]?.long || '0') - parseInt(manualInputData[currency.id]?.short || '0')) || 0).toLocaleString('de-DE')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-border">
              <button
                onClick={() => setShowManualInput(false)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button
                onClick={saveManualData}
                className="btn-primary flex items-center gap-2"
              >
                <Save size={18} />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
