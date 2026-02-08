/**
 * ========================================================================
 * Trading Journal - Monte Carlo Simulation Page
 * ========================================================================
 * 
 * Simuliert zukünftige Portfolio-Entwicklung basierend auf:
 * - Echten historischen Trade-Daten
 * - Monte-Carlo-Simulation mit tausenden Durchläufen
 * - Integration mit calculations utilities
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Play, 
  RefreshCw, 
  TrendingUp,
  AlertTriangle,
  Target,
  Percent,
  DollarSign,
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { calculateTradeStatistics, calculateKellyCriterion } from '@/utils/calculations';

interface SimulationResult {
  paths: number[][];
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  stats: {
    avgFinal: number;
    maxDrawdown: number;
    profitProb: number;
    ruinProb: number;
    expectedR: number;
  };
}

const COLORS = {
  p5: '#ef4444',
  p25: '#f97316',
  p50: '#eab308',
  p75: '#22c55e',
  p95: '#10b981',
};

export function Simulation() {
  const { trades, loadTrades } = useTradeStore();
  const { configs, loadConfigs } = useAccountStore();
  
  const [numTrades, setNumTrades] = useState(100);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [startingBalance, setStartingBalance] = useState(10000);
  const [riskPerTrade, setRiskPerTrade] = useState(1); // % of balance
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Load data on mount
  useEffect(() => {
    loadTrades();
    loadConfigs();
  }, []);

  // Update starting balance from config
  useEffect(() => {
    if (configs?.ek?.currentBalance) {
      setStartingBalance(configs.ek.currentBalance);
    }
    if (configs?.ek?.defaultRiskPerTrade) {
      setRiskPerTrade(configs.ek.defaultRiskPerTrade);
    }
  }, [configs]);

  // Get only live trades for statistics
  const liveTrades = useMemo(() => 
    trades.filter(t => t.sessionType === 'live'),
    [trades]
  );

  // Calculate historical stats using utility function
  const historicalStats = useMemo(() => {
    const stats = calculateTradeStatistics(liveTrades);
    
    return {
      winRate: stats.winRate / 100, // Convert to 0-1
      avgWin: stats.avgWinR || 1.5,
      avgLoss: stats.avgLossR || 1,
      trades: stats.totalTrades,
      hasEnoughData: stats.totalTrades >= 30,
      expectancy: stats.expectancy,
      profitFactor: stats.profitFactor,
    };
  }, [liveTrades]);

  // Kelly Criterion
  const kellyCriterion = useMemo(() => {
    if (historicalStats.trades < 5) return null;
    return calculateKellyCriterion(
      historicalStats.winRate * 100, 
      historicalStats.avgWin, 
      historicalStats.avgLoss, 
      0.5
    );
  }, [historicalStats]);

  const runSimulation = useCallback(() => {
    setIsRunning(true);
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const { winRate, avgWin, avgLoss } = historicalStats;
      const paths: number[][] = [];
      
      // Run simulations
      for (let sim = 0; sim < numSimulations; sim++) {
        const path: number[] = [startingBalance];
        let balance = startingBalance;
        
        for (let trade = 0; trade < numTrades; trade++) {
          const riskAmount = balance * (riskPerTrade / 100);
          const isWin = Math.random() < winRate;
          
          // Add some variance to R-multiples (more realistic)
          const variance = 0.3;
          const rMultiple = isWin
            ? avgWin * (1 + (Math.random() - 0.5) * variance)
            : -avgLoss * (1 + (Math.random() - 0.5) * variance);
          
          balance += riskAmount * rMultiple;
          balance = Math.max(0, balance); // Can't go negative
          path.push(balance);
        }
        
        paths.push(path);
      }
      
      // Calculate percentiles
      const percentiles = {
        p5: [] as number[],
        p25: [] as number[],
        p50: [] as number[],
        p75: [] as number[],
        p95: [] as number[],
      };
      
      for (let i = 0; i <= numTrades; i++) {
        const values = paths.map(p => p[i]).sort((a, b) => a - b);
        percentiles.p5.push(values[Math.floor(values.length * 0.05)]);
        percentiles.p25.push(values[Math.floor(values.length * 0.25)]);
        percentiles.p50.push(values[Math.floor(values.length * 0.5)]);
        percentiles.p75.push(values[Math.floor(values.length * 0.75)]);
        percentiles.p95.push(values[Math.floor(values.length * 0.95)]);
      }
      
      // Calculate stats
      const finalBalances = paths.map(p => p[p.length - 1]);
      const avgFinal = finalBalances.reduce((a, b) => a + b, 0) / finalBalances.length;
      const profitCount = finalBalances.filter(b => b > startingBalance).length;
      const ruinCount = finalBalances.filter(b => b < startingBalance * 0.2).length;
      
      // Max drawdown across all paths
      let maxDrawdown = 0;
      for (const path of paths) {
        let peak = path[0];
        for (const value of path) {
          peak = Math.max(peak, value);
          const dd = (peak - value) / peak;
          maxDrawdown = Math.max(maxDrawdown, dd);
        }
      }
      
      const expectedR = winRate * avgWin + (1 - winRate) * avgLoss;
      
      setResult({
        paths: paths.slice(0, 20), // Keep only 20 paths for visualization
        percentiles,
        stats: {
          avgFinal,
          maxDrawdown,
          profitProb: profitCount / numSimulations,
          ruinProb: ruinCount / numSimulations,
          expectedR,
        },
      });
      
      setIsRunning(false);
    }, 100);
  }, [numTrades, numSimulations, startingBalance, riskPerTrade, historicalStats]);

  // Chart data
  const chartData = useMemo(() => {
    if (!result) return [];
    
    return result.percentiles.p50.map((_, i) => ({
      trade: i,
      p5: result.percentiles.p5[i],
      p25: result.percentiles.p25[i],
      p50: result.percentiles.p50[i],
      p75: result.percentiles.p75[i],
      p95: result.percentiles.p95[i],
    }));
  }, [result]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <Activity className="text-accent-primary" />
          Monte Carlo Simulation
        </h1>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Settings Panel */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Parameter</h3>
          
          {/* Historical Stats Info */}
          <div className={clsx(
            'p-3 rounded-lg mb-4',
            historicalStats.hasEnoughData ? 'bg-pnl-positive/10' : 'bg-yellow-500/10'
          )}>
            <div className="flex items-center gap-2 mb-2">
              {historicalStats.hasEnoughData ? (
                <TrendingUp className="text-pnl-positive" size={16} />
              ) : (
                <AlertTriangle className="text-yellow-500" size={16} />
              )}
              <span className="text-sm font-medium">
                Basierend auf {historicalStats.trades} Live-Trades
              </span>
            </div>
            <div className="text-xs text-text-muted grid grid-cols-2 gap-1">
              <span>Win-Rate: {(historicalStats.winRate * 100).toFixed(1)}%</span>
              <span>Ø Win: +{historicalStats.avgWin.toFixed(2)}R</span>
              <span>Ø Loss: -{historicalStats.avgLoss.toFixed(2)}R</span>
              <span>Expectancy: {historicalStats.expectancy.toFixed(2)}R</span>
            </div>
            {kellyCriterion && (
              <div className="mt-2 pt-2 border-t border-border/50 text-xs">
                <span className="text-text-muted">Kelly: </span>
                <span className="text-accent-primary font-semibold">{kellyCriterion.fractionalKelly.toFixed(2)}%</span>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">
                Startkapital (€)
              </label>
              <input
                type="number"
                value={startingBalance}
                onChange={(e) => setStartingBalance(Number(e.target.value))}
                className="input-field w-full"
                min={1000}
                step={1000}
              />
            </div>
            
            <div>
              <label className="block text-sm text-text-muted mb-1">
                Risiko pro Trade (%)
              </label>
              <input
                type="number"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                className="input-field w-full"
                min={0.1}
                max={10}
                step={0.1}
              />
            </div>
            
            <div>
              <label className="block text-sm text-text-muted mb-1">
                Anzahl Trades simulieren
              </label>
              <input
                type="number"
                value={numTrades}
                onChange={(e) => setNumTrades(Number(e.target.value))}
                className="input-field w-full"
                min={10}
                max={1000}
                step={10}
              />
            </div>
            
            <div>
              <label className="block text-sm text-text-muted mb-1">
                Anzahl Simulationen
              </label>
              <select
                value={numSimulations}
                onChange={(e) => setNumSimulations(Number(e.target.value))}
                className="input-field w-full"
              >
                <option value={100}>100 (Schnell)</option>
                <option value={500}>500</option>
                <option value={1000}>1.000 (Standard)</option>
                <option value={5000}>5.000 (Genau)</option>
                <option value={10000}>10.000 (Sehr genau)</option>
              </select>
            </div>
            
            <button
              onClick={runSimulation}
              disabled={isRunning}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Simuliere...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Simulation starten
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="col-span-3 space-y-6">
          {result ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="card text-center">
                  <DollarSign className="mx-auto text-accent-primary mb-2" size={24} />
                  <div className="text-2xl font-bold text-text-primary">
                    €{result.stats.avgFinal.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-sm text-text-muted">Ø Endkapital</div>
                  <div className={clsx(
                    'text-xs mt-1',
                    result.stats.avgFinal > startingBalance ? 'text-pnl-positive' : 'text-pnl-negative'
                  )}>
                    {((result.stats.avgFinal / startingBalance - 1) * 100).toFixed(1)}% Rendite
                  </div>
                </div>
                
                <div className="card text-center">
                  <Percent className="mx-auto text-pnl-positive mb-2" size={24} />
                  <div className="text-2xl font-bold text-pnl-positive">
                    {(result.stats.profitProb * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-text-muted">Gewinn-Wahrscheinlichkeit</div>
                </div>
                
                <div className="card text-center">
                  <AlertTriangle className="mx-auto text-pnl-negative mb-2" size={24} />
                  <div className="text-2xl font-bold text-pnl-negative">
                    {(result.stats.maxDrawdown * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-text-muted">Max Drawdown</div>
                </div>
                
                <div className="card text-center">
                  <Target className="mx-auto text-accent-primary mb-2" size={24} />
                  <div className="text-2xl font-bold text-text-primary">
                    {result.stats.expectedR.toFixed(2)}R
                  </div>
                  <div className="text-sm text-text-muted">Expected Value</div>
                  <div className={clsx(
                    'text-xs mt-1',
                    result.stats.ruinProb > 0.05 ? 'text-pnl-negative' : 'text-text-muted'
                  )}>
                    {(result.stats.ruinProb * 100).toFixed(1)}% Ruin-Risiko
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Portfolio-Entwicklung (Perzentile)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="trade" 
                        stroke="#888"
                        label={{ value: 'Trades', position: 'bottom', fill: '#888' }}
                      />
                      <YAxis 
                        stroke="#888"
                        tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [`€${value.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`, '']}
                        labelFormatter={(label) => `Trade ${label}`}
                      />
                      
                      {/* Areas from outer to inner */}
                      <Area 
                        type="monotone" 
                        dataKey="p95" 
                        stroke={COLORS.p95}
                        fill={COLORS.p95}
                        fillOpacity={0.1}
                        name="95. Perzentil"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="p75" 
                        stroke={COLORS.p75}
                        fill={COLORS.p75}
                        fillOpacity={0.2}
                        name="75. Perzentil"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="p50" 
                        stroke={COLORS.p50}
                        fill={COLORS.p50}
                        fillOpacity={0.3}
                        name="Median"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="p25" 
                        stroke={COLORS.p25}
                        fill={COLORS.p25}
                        fillOpacity={0.2}
                        name="25. Perzentil"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="p5" 
                        stroke={COLORS.p5}
                        fill={COLORS.p5}
                        fillOpacity={0.1}
                        name="5. Perzentil"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Legend */}
                <div className="flex justify-center gap-6 mt-4 text-sm">
                  {[
                    { key: 'p95', label: '95%', color: COLORS.p95 },
                    { key: 'p75', label: '75%', color: COLORS.p75 },
                    { key: 'p50', label: 'Median', color: COLORS.p50 },
                    { key: 'p25', label: '25%', color: COLORS.p25 },
                    { key: 'p5', label: '5%', color: COLORS.p5 },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }} 
                      />
                      <span className="text-text-muted">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-16">
              <Activity size={64} className="mx-auto text-text-muted/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Monte Carlo Simulation</h3>
              <p className="text-text-muted max-w-md mx-auto">
                Simuliere tausende mögliche Zukunftsszenarien basierend auf deiner 
                historischen Trading-Performance. Passe die Parameter an und starte 
                die Simulation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
