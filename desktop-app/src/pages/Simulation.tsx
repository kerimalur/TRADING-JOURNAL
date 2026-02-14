/**
 * Monte Carlo Simulation - Simple RR & Win Rate based
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Play,
  RefreshCw,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAccountStore } from '@/stores/accountStore';
import { PageTransition } from '@/components/ui/PageTransition';
import { MetricDisplay } from '@/components/ui/MetricDisplay';

interface SimulationResult {
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
  const { configs, loadConfigs } = useAccountStore();

  const [numTrades, setNumTrades] = useState(100);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [startingBalance, setStartingBalance] = useState(10000);
  const [riskPerTrade, setRiskPerTrade] = useState(1);
  const [winRate, setWinRate] = useState(50);
  const [riskReward, setRiskReward] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (configs?.ek?.currentBalance) setStartingBalance(configs.ek.currentBalance);
    if (configs?.ek?.defaultRiskPerTrade) setRiskPerTrade(configs.ek.defaultRiskPerTrade);
  }, [configs]);

  // Expectancy berechnen
  const expectancy = useMemo(() => {
    const wr = winRate / 100;
    return wr * riskReward - (1 - wr);
  }, [winRate, riskReward]);

  const runSimulation = useCallback(() => {
    setIsRunning(true);

    setTimeout(() => {
      const wr = winRate / 100;
      const paths: number[][] = [];

      for (let sim = 0; sim < numSimulations; sim++) {
        const path: number[] = [startingBalance];
        let balance = startingBalance;

        for (let trade = 0; trade < numTrades; trade++) {
          const riskAmount = balance * (riskPerTrade / 100);
          const isWin = Math.random() < wr;

          if (isWin) {
            balance += riskAmount * riskReward;
          } else {
            balance -= riskAmount;
          }

          balance = Math.max(0, balance);
          path.push(balance);
        }

        paths.push(path);
      }

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

      const finalBalances = paths.map(p => p[p.length - 1]);
      const avgFinal = finalBalances.reduce((a, b) => a + b, 0) / finalBalances.length;
      const profitCount = finalBalances.filter(b => b > startingBalance).length;
      const ruinCount = finalBalances.filter(b => b < startingBalance * 0.2).length;

      let maxDrawdown = 0;
      for (const path of paths) {
        let peak = path[0];
        for (const value of path) {
          peak = Math.max(peak, value);
          const dd = (peak - value) / peak;
          maxDrawdown = Math.max(maxDrawdown, dd);
        }
      }

      setResult({
        percentiles,
        stats: {
          avgFinal,
          maxDrawdown,
          profitProb: profitCount / numSimulations,
          ruinProb: ruinCount / numSimulations,
          expectedR: expectancy,
        },
      });

      setIsRunning(false);
    }, 100);
  }, [numTrades, numSimulations, startingBalance, riskPerTrade, winRate, riskReward, expectancy]);

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
    <PageTransition>
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-accent-primary" />
          <h1 className="text-xl font-bold text-text-primary">Monte Carlo Simulation</h1>
        </div>

        <button
          onClick={() => setShowControls(!showControls)}
          className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1"
        >
          <Settings size={13} />
          Parameter
          {showControls ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Controls Panel */}
      {showControls && (
        <div className="mb-4 rounded-xl bg-background-surface border border-border p-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Startkapital</label>
              <input
                type="number" value={startingBalance}
                onChange={(e) => setStartingBalance(Number(e.target.value))}
                className="input w-full" min={100} step={1000}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Risiko/Trade (%)</label>
              <input
                type="number" value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                className="input w-full" min={0.1} max={100} step={0.1}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Win Rate (%)</label>
              <input
                type="number" value={winRate}
                onChange={(e) => setWinRate(Number(e.target.value))}
                className="input w-full" min={1} max={99} step={1}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Risk:Reward</label>
              <input
                type="number" value={riskReward}
                onChange={(e) => setRiskReward(Number(e.target.value))}
                className="input w-full" min={0.1} max={50} step={0.1}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Trades</label>
              <input
                type="number" value={numTrades}
                onChange={(e) => setNumTrades(Number(e.target.value))}
                className="input w-full" min={10} max={1000} step={10}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Simulationen</label>
              <select
                value={numSimulations}
                onChange={(e) => setNumSimulations(Number(e.target.value))}
                className="input w-full"
              >
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1.000</option>
                <option value={5000}>5.000</option>
                <option value={10000}>10.000</option>
              </select>
            </div>
            <button
              onClick={runSimulation}
              disabled={isRunning}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {isRunning ? (
                <><RefreshCw size={15} className="animate-spin" /> Läuft...</>
              ) : (
                <><Play size={15} /> Starten</>
              )}
            </button>
          </div>

          {/* Expectancy info */}
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-border/50 text-xs">
            <span className="text-text-muted">Parameter:</span>
            <span>Win Rate: <strong className="text-accent-primary">{winRate}%</strong></span>
            <span>RR: <strong className="text-accent-primary">1:{riskReward}</strong></span>
            <span>Expectancy: <strong className={expectancy >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'}>
              {expectancy >= 0 ? '+' : ''}{expectancy.toFixed(2)}R
            </strong></span>
            <span className="text-text-muted ml-auto">
              Win = +{riskReward}R | Loss = -1R
            </span>
          </div>
        </div>
      )}

      {result ? (
        <>
          {/* Stats Bar */}
          <div className="flex items-center gap-6 mb-4 px-2">
            <MetricDisplay
              label="Ø Endkapital"
              value={result.stats.avgFinal}
              format="currency"
              prefix="€"
              size="md"
              showSign={false}
            />
            <div className="w-px h-8 bg-border" />
            <MetricDisplay
              label="Gewinn-Wahr."
              value={result.stats.profitProb * 100}
              format="percent"
              size="md"
            />
            <div className="w-px h-8 bg-border" />
            <MetricDisplay
              label="Max Drawdown"
              value={result.stats.maxDrawdown * 100}
              format="percent"
              size="md"
            />
            <div className="w-px h-8 bg-border" />
            <MetricDisplay
              label="Expectancy"
              value={result.stats.expectedR}
              format="R"
              size="md"
              showSign
            />
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col">
              <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">
                Ruin Risiko
              </span>
              <span className={clsx(
                'text-2xl font-extrabold font-mono tabular-nums',
                result.stats.ruinProb > 0.05 ? 'text-pnl-negative' : 'text-text-primary'
              )}>
                {(result.stats.ruinProb * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-xl bg-background-surface border border-border p-4" style={{ height: 'calc(100vh - 340px)', minHeight: '400px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradP95" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.p95} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={COLORS.p95} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradP75" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.p75} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS.p75} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradP50" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.p50} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.p50} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="trade"
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.15)"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15,15,20,0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    fontSize: '12px',
                    backdropFilter: 'blur(8px)',
                  }}
                  formatter={(value: number) => [`€${value.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`, '']}
                  labelFormatter={(label) => `Trade ${label}`}
                />

                <Area type="monotone" dataKey="p95" stroke={COLORS.p95} fill="url(#gradP95)" strokeWidth={1.5} name="95%" />
                <Area type="monotone" dataKey="p75" stroke={COLORS.p75} fill="url(#gradP75)" strokeWidth={1.5} name="75%" />
                <Area type="monotone" dataKey="p50" stroke={COLORS.p50} fill="url(#gradP50)" strokeWidth={2.5} name="Median" />
                <Area type="monotone" dataKey="p25" stroke={COLORS.p25} fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="25%" />
                <Area type="monotone" dataKey="p5" stroke={COLORS.p5} fill="none" strokeWidth={1.5} strokeDasharray="4 4" name="5%" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-3 text-xs">
            {[
              { label: '95%', color: COLORS.p95 },
              { label: '75%', color: COLORS.p75 },
              { label: 'Median', color: COLORS.p50 },
              { label: '25%', color: COLORS.p25 },
              { label: '5%', color: COLORS.p5 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-text-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center" style={{ height: 'calc(100vh - 220px)' }}>
          <div className="w-20 h-20 rounded-2xl bg-accent-primary/10 flex items-center justify-center mb-4">
            <TrendingUp size={36} className="text-accent-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Monte Carlo Simulation</h3>
          <p className="text-sm text-text-muted max-w-md text-center mb-6">
            Simuliere tausende Zukunftsszenarien. Gib Win Rate und Risk:Reward ein um zu sehen wie sich dein Konto entwickeln koennte.
          </p>
          <button
            onClick={runSimulation}
            disabled={isRunning}
            className="btn-primary flex items-center gap-2"
          >
            {isRunning ? (
              <><RefreshCw size={16} className="animate-spin" /> Simuliere...</>
            ) : (
              <><Play size={16} /> Simulation starten</>
            )}
          </button>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
