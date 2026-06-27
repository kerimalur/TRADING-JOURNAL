/**
 * Backtest – Auswertung. Filterbare Analyse einer Session: Stat-Cards,
 * Equity-Kurve (Zeitraum umschaltbar), Setup- & Problem-Performance und die
 * Trade-Tabelle. Filter wirken auf Tabelle UND auf die berechneten Kennzahlen.
 */

import { useMemo, useState, Fragment } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Play, Download, BarChart3, AlertTriangle, Filter, X, Trash2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/shared/stores/uiStore';
import { SETUP_DEFINITIONS, getProblems } from '@/shared/types';
import {
  computeStats, buildEquityByDate, computeSetupStats, computeProblemStats,
  filterTrades, isFilterActive, EMPTY_FILTER, EQUITY_PERIODS, MIN_SAMPLE,
  type EquityPeriod, type TradeFilter, type CategoryStat,
} from './backtestStats';
import type { BacktestSession } from './types';

interface Props {
  session: BacktestSession;
  onContinue: () => void;
  onBack: () => void;
  onDeleteTrade: (tradeId: string) => void;
}

const labelOf = (key: string) => (SETUP_DEFINITIONS as any)[key]?.label || key;

export function BacktestAnalysis({ session, onContinue, onBack, onDeleteTrade }: Props) {
  const { showToast } = useUIStore();
  const [filter, setFilter] = useState<TradeFilter>(EMPTY_FILTER);
  const [period, setPeriod] = useState<EquityPeriod>('all');

  const filtered = useMemo(() => filterTrades(session.trades, filter), [session.trades, filter]);
  const stats = useMemo(() => computeStats(filtered, session.accountSize, session.riskPercent), [filtered, session.accountSize, session.riskPercent]);
  const equity = useMemo(() => buildEquityByDate(filtered, period, session.accountSize, session.riskPercent), [filtered, period, session.accountSize, session.riskPercent]);
  const setupStats = useMemo(() => computeSetupStats(filtered), [filtered]);
  const problemStats = useMemo(() => computeProblemStats(filtered), [filtered]);

  // Filter-Optionen: gespeicherte Probleme + alle in den Trades vorkommenden.
  const problemChoices = useMemo(() => {
    const set = new Set<string>(getProblems());
    session.trades.forEach(t => t.problems.forEach(p => set.add(p)));
    return [...set];
  }, [session.trades]);

  const toggle = (field: 'setups' | 'problems', val: string) =>
    setFilter(f => ({ ...f, [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val] }));

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${session.name.replace(/[^\w-]+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('Session als JSON exportiert', 'success');
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['#', 'Datum', 'Pair', 'Richtung', 'Ergebnis', 'R-Multiple', 'Setups', 'Problem', 'Notizen'];
    const rows = filtered.map((t, i) => [
      i + 1, t.date, t.pair,
      t.direction === 'long' ? 'Long' : 'Short',
      t.result === 'win' ? 'Win' : t.result === 'loss' ? 'Loss' : 'Breakeven',
      t.rMultiple, (t.setups || []).map(labelOf).join('; '),
      (t.problems || []).join('; '), t.notes || '',
    ].map(esc).join(';'));
    const csv = '﻿' + [header.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${session.name.replace(/[^\w-]+/g, '_')}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast('Session als CSV exportiert', 'success');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">
            <BarChart3 className="text-accent-primary" /> Auswertung
          </h1>
          <p className="page-subtitle truncate">{session.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="btn btn-secondary"><ArrowLeft size={16} /> Übersicht</button>
          {!session.isCompleted && <button onClick={onContinue} className="btn btn-secondary"><Play size={16} /> Weiter testen</button>}
          <button onClick={exportJSON} className="btn btn-secondary" title="Session als JSON"><Download size={16} /> JSON</button>
          <button onClick={exportCSV} className="btn btn-secondary" title="Trades als CSV"><Download size={16} /> CSV</button>
        </div>
      </div>

      {/* Filterleiste */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><Filter size={16} className="text-accent-primary" /> Filter</h3>
          {isFilterActive(filter) && (
            <button onClick={() => setFilter(EMPTY_FILTER)} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1">
              <X size={13} /> zurücksetzen ({filtered.length}/{session.trades.length})
            </button>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-text-muted mb-1.5">Setups</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SETUP_DEFINITIONS).map(([key, setup]) => (
                <button key={key} type="button" onClick={() => toggle('setups', key)}
                  className={clsx('px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                    filter.setups.includes(key) ? 'text-white' : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}
                  style={{ backgroundColor: filter.setups.includes(key) ? setup.color : undefined }}>
                  {setup.short}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted mb-1.5">Probleme</div>
            <div className="flex flex-wrap gap-2">
              {problemChoices.map(p => (
                <button key={p} type="button" onClick={() => toggle('problems', p)}
                  className={clsx('px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                    filter.problems.includes(p) ? 'bg-be text-white' : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}>
                  {p}
                </button>
              ))}
              {problemChoices.length === 0 && <span className="text-xs text-text-muted/60">keine Probleme erfasst</span>}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted mb-1.5">Stichwort (Notizen &amp; Probleme)</div>
            <input type="text" value={filter.keyword} onChange={e => setFilter(f => ({ ...f, keyword: e.target.value }))}
              placeholder="z.B. FOMO, zu früh, Plan…" className="input py-2 text-sm max-w-sm" />
          </div>
        </div>
      </div>

      {/* Stat-Cards (auf gefilterter Teilmenge) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-label">Win Rate</div>
          <div className="text-2xl font-bold text-accent-primary">{stats.winRate.toFixed(1)}%</div>
          <div className="text-xs text-text-muted">{stats.wins}W / {stats.losses}L</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total R</div>
          <div className={clsx('text-2xl font-bold', stats.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
            {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(1)} R
          </div>
          <div className="text-xs text-text-muted">Ø {stats.avgR.toFixed(2)} R</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profit Factor</div>
          <div className="text-2xl font-bold text-text-primary">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</div>
        </div>
        {stats.hasEur ? (
          <div className="stat-card">
            <div className="stat-label">P&L (€)</div>
            <div className={clsx('text-2xl font-bold', stats.totalEur >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
              {stats.totalEur >= 0 ? '+' : ''}{stats.totalEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
            </div>
            <div className="text-xs text-text-muted">{stats.growthPct >= 0 ? '+' : ''}{stats.growthPct.toFixed(1)}%</div>
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-label">Trades</div>
            <div className="text-2xl font-bold text-text-primary">{stats.totalTrades}</div>
          </div>
        )}
      </div>

      {/* Equity-Kurve mit Zeitraum */}
      {equity.length > 0 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-lg font-semibold">Equity-Kurve {stats.hasEur ? '— €' : '— R'}</h3>
            <div className="toggle-group">
              {EQUITY_PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={clsx('toggle-btn', period === p.key && 'active')}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equity}>
                <defs>
                  <linearGradient id="btEquityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={{ stroke: '#CBD5E1' }} axisLine={{ stroke: '#E2E8F0' }} minTickGap={24} />
                <YAxis stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={{ stroke: '#CBD5E1' }} axisLine={{ stroke: '#E2E8F0' }}
                  tickFormatter={(v) => stats.hasEur ? `${(v / 1000).toFixed(1)}k` : `${v}`} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8 }} labelStyle={{ color: '#64748B' }}
                  formatter={(v: number) => [stats.hasEur ? `${v.toLocaleString('de-DE')} €` : `${v} R`, stats.hasEur ? 'Konto' : 'Equity']} />
                <Line type="monotone" dataKey="equity" stroke="#2563EB" strokeWidth={2} dot={{ fill: '#2563EB', strokeWidth: 0, r: 2 }} activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2, fill: '#2563EB' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Setup- & Problem-Performance nebeneinander */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PerformanceTable
          title="Setup-Performance"
          icon={<BarChart3 size={18} className="text-accent-primary" />}
          rows={setupStats}
          withColorDot
          emptyHint="Keine Setups erfasst."
        />
        <PerformanceTable
          title="Problem-Performance (Leaks)"
          icon={<AlertTriangle size={18} className="text-be" />}
          rows={problemStats}
          emptyHint="Keine Probleme erfasst — kein Leak gefunden."
        />
      </div>

      {/* Trade-Tabelle (gefiltert) */}
      {filtered.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Trades ({filtered.length}{isFilterActive(filter) ? ` / ${session.trades.length}` : ''})</h3>
            <button onClick={exportCSV} className="btn btn-secondary text-sm"><Download size={14} /> CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['#', 'Datum', 'Pair', 'Richtung', 'Ergebnis', 'R', 'Setups', 'Problem', 'Bild', 'Aktion'].map((h, i) => (
                    <th key={h} className={clsx('py-2 px-3 text-text-muted font-medium', i === 5 ? 'text-right' : i >= 8 ? 'text-center' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered].reverse().map((trade, i) => (
                  <Fragment key={trade.id}>
                    <tr className="border-b border-border/50 hover:bg-black/[0.03]">
                      <td className="py-2 px-3 text-text-muted">{filtered.length - i}</td>
                      <td className="py-2 px-3 font-mono text-xs text-text-muted whitespace-nowrap">{trade.date}</td>
                      <td className="py-2 px-3 font-medium">{trade.pair}</td>
                      <td className="py-2 px-3">
                        <span className={clsx('px-2 py-0.5 rounded text-xs', trade.direction === 'long' ? 'bg-pnl-positive/15 text-pnl-positive' : 'bg-pnl-negative/15 text-pnl-negative')}>
                          {trade.direction.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={clsx('px-2 py-0.5 rounded text-xs',
                          trade.result === 'win' ? 'bg-pnl-positive/15 text-pnl-positive' :
                          trade.result === 'loss' ? 'bg-pnl-negative/15 text-pnl-negative' : 'bg-be/15 text-be')}>
                          {trade.result.toUpperCase()}
                        </span>
                      </td>
                      <td className={clsx('py-2 px-3 text-right font-mono', trade.rMultiple >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                        {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(trade.setups || []).map(key => {
                            const def = (SETUP_DEFINITIONS as any)[key];
                            return <span key={key} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: def?.color || '#94A3B8' }}>{def?.short || key}</span>;
                          })}
                          {(!trade.setups || trade.setups.length === 0) && <span className="text-text-muted/50">—</span>}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(trade.problems || []).map(p => (
                            <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-be/15 text-be">{p}</span>
                          ))}
                          {(!trade.problems || trade.problems.length === 0) && <span className="text-text-muted/50">—</span>}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {trade.screenshot
                          ? <img src={trade.screenshot} alt="Screenshot" className="h-8 w-12 object-cover rounded cursor-pointer hover:opacity-80 inline-block" onClick={() => window.open(trade.screenshot, '_blank')} />
                          : <span className="text-text-muted/50">—</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => confirm('Trade wirklich löschen?') && onDeleteTrade(trade.id)} className="p-1 hover:bg-pnl-negative/10 rounded" title="Trade löschen">
                          <Trash2 size={14} className="text-pnl-negative" />
                        </button>
                      </td>
                    </tr>
                    {trade.notes && (
                      <tr className="border-b border-border/30">
                        <td colSpan={10} className="px-3 py-1">
                          <span className="text-[10px] text-text-muted italic">📝 {trade.notes}</span>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PerformanceTable({ title, icon, rows, withColorDot, emptyHint }: {
  title: string; icon: React.ReactNode; rows: CategoryStat[]; withColorDot?: boolean; emptyHint: string;
}) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">{icon}{title}</h3>
      <p className="text-xs text-text-muted mb-4">Expectancy = Ø R/Trade. Werte mit &lt; {MIN_SAMPLE} Trades sind statistisch unsicher (ausgegraut).</p>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted/70 py-4">{emptyHint}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-text-muted font-medium">{withColorDot ? 'Setup' : 'Problem'}</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">n</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">Winrate</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">Expectancy</th>
                <th className="text-right py-2 px-3 text-text-muted font-medium">ΣR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.key} className={clsx('border-b border-border/50 hover:bg-black/[0.03]', !s.reliable && 'opacity-50')}>
                  <td className="py-2 px-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {withColorDot && s.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />}
                      {s.label}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {s.n}{!s.reliable && <span className="ml-1 text-[10px] text-be" title={`Stichprobe < ${MIN_SAMPLE}`}>⚠</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{s.winRate.toFixed(0)}%</td>
                  <td className={clsx('py-2 px-3 text-right font-mono font-semibold', s.expectancy >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                    {s.expectancy >= 0 ? '+' : ''}{s.expectancy.toFixed(2)}R
                  </td>
                  <td className={clsx('py-2 px-3 text-right font-mono', s.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                    {s.totalR >= 0 ? '+' : ''}{s.totalR.toFixed(1)}R
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
