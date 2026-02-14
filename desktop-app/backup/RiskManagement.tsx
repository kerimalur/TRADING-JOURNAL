/**
 * Risk Management - Cockpit with Gauges & Tilt Meter
 * Bloomberg-style risk dashboard
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  AlertTriangle,
  TrendingDown,
  Activity,
  Save,
  Bell,
  BellOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react';
import { clsx } from '@/utils';
import { useRiskStore, type RiskSettings } from '@/stores/riskStore';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import {
  calculateTradeStatistics,
  calculateRiskOfRuin,
  calculateKellyCriterion,
  calculateDailyLossLimit,
  calculateDrawdown
} from '@/utils/calculations';
import { PageTransition } from '@/components/ui/PageTransition';
import { Gauge } from '@/components/ui/Gauge';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { TradeStreak } from '@/components/ui/TradeStreak';
import { BentoGrid, BentoCell } from '@/components/ui/BentoGrid';

export function RiskManagement() {
  const { settings, updateSettings, alerts, acknowledgeAlert, clearAlerts } = useRiskStore();
  const { trades, loadTrades } = useTradeStore();
  const { configs, loadConfigs } = useAccountStore();
  const { showToast } = useUIStore();

  const [formData, setFormData] = useState<RiskSettings>(settings);
  const [activeView, setActiveView] = useState<'cockpit' | 'settings' | 'alerts'>('cockpit');

  useEffect(() => {
    loadTrades();
    loadConfigs();
  }, []);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const liveTrades = useMemo(() =>
    trades.filter(t => t.sessionType === 'live'),
    [trades]
  );

  const stats = useMemo(() =>
    calculateTradeStatistics(liveTrades),
    [liveTrades]
  );

  const riskOfRuin = useMemo(() => {
    if (stats.wins === 0 || stats.losses === 0) return null;
    const capitalUnits = 100 / (formData.dailyLossLimitPercent || 1);
    return calculateRiskOfRuin(stats.winRate, stats.avgWinR, stats.avgLossR, capitalUnits);
  }, [stats, formData.dailyLossLimitPercent]);

  const kellyCriterion = useMemo(() => {
    if (stats.wins === 0 || stats.losses === 0) return null;
    return calculateKellyCriterion(stats.winRate, stats.avgWinR, stats.avgLossR, 0.5);
  }, [stats]);

  const dailyLossLimit = useMemo(() => {
    const balance = configs?.ek?.currentBalance || 10000;
    const riskPerTrade = configs?.ek?.defaultRiskPerTrade || 1;
    return calculateDailyLossLimit(balance, formData.dailyLossLimitPercent || 2, riskPerTrade);
  }, [configs?.ek, formData.dailyLossLimitPercent]);

  const drawdownData = useMemo(() =>
    calculateDrawdown(liveTrades),
    [liveTrades]
  );

  const today = new Date().toISOString().split('T')[0];
  const todayTrades = liveTrades.filter(t => t.date === today);
  const todayR = todayTrades.reduce((sum, t) => sum + t.rMultiple, 0);

  const consecutiveLosses = useMemo(() => {
    const sorted = [...liveTrades].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    let count = 0;
    for (const t of sorted) {
      if (t.result === 'loss') count++;
      else break;
    }
    return count;
  }, [liveTrades]);

  const peakBalance = Math.max(
    configs?.ek?.initialStartBalance || 0,
    configs?.ek?.currentBalance || 0
  );
  const currentBalance = configs?.ek?.currentBalance || 0;
  const drawdownPercent = peakBalance > 0 ? ((peakBalance - currentBalance) / peakBalance) * 100 : 0;

  const handleSave = () => {
    updateSettings(formData);
    showToast('Risk-Einstellungen gespeichert', 'success');
  };

  const getRiskStatus = () => {
    if (todayR <= -settings.dailyLossLimitR) return 'danger';
    if (consecutiveLosses >= settings.consecutiveLossLimit) return 'warning';
    if (drawdownPercent >= settings.drawdownAlertThreshold) return 'warning';
    if (todayTrades.length >= settings.dailyTradeLimit) return 'warning';
    return 'ok';
  };

  const riskStatus = getRiskStatus();

  // Tilt meter: 0 = calm, 100 = tilted
  const tiltScore = useMemo(() => {
    let score = 0;
    // Consecutive losses contribute heavily
    score += Math.min(consecutiveLosses * 20, 40);
    // Daily loss
    if (todayR < 0) score += Math.min(Math.abs(todayR / settings.dailyLossLimitR) * 30, 30);
    // Trade count today
    score += Math.min((todayTrades.length / settings.dailyTradeLimit) * 20, 20);
    // Drawdown
    score += Math.min((drawdownPercent / settings.drawdownAlertThreshold) * 10, 10);
    return Math.min(Math.round(score), 100);
  }, [consecutiveLosses, todayR, todayTrades.length, drawdownPercent, settings]);

  // Trade results for streak
  const tradeResults = useMemo(() =>
    liveTrades.slice(-30).map(t => t.result as 'win' | 'loss' | 'breakeven'),
    [liveTrades]
  );

  // Last 7 days data
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toISOString().split('T')[0];
      const dayTrades = liveTrades.filter(t => t.date === dateStr);
      const dayR = dayTrades.reduce((sum, t) => sum + t.rMultiple, 0);
      return {
        label: date.toLocaleDateString('de-DE', { weekday: 'short' }),
        trades: dayTrades.length,
        r: dayR,
      };
    });
  }, [liveTrades]);

  const unreadAlerts = alerts.filter(a => !a.acknowledged).length;

  return (
    <PageTransition>
    <div className="page-container">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={22} className={clsx(
            riskStatus === 'ok' && 'text-pnl-positive',
            riskStatus === 'warning' && 'text-yellow-500',
            riskStatus === 'danger' && 'text-pnl-negative'
          )} />
          <h1 className="text-xl font-bold text-text-primary">Risk Management</h1>
          <div className={clsx(
            'px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5',
            riskStatus === 'ok' && 'bg-pnl-positive/15 text-pnl-positive',
            riskStatus === 'warning' && 'bg-yellow-500/15 text-yellow-500',
            riskStatus === 'danger' && 'bg-pnl-negative/15 text-pnl-negative'
          )}>
            {riskStatus === 'ok' && <CheckCircle size={12} />}
            {riskStatus === 'warning' && <AlertTriangle size={12} />}
            {riskStatus === 'danger' && <XCircle size={12} />}
            {riskStatus === 'ok' ? 'OK' : riskStatus === 'warning' ? 'VORSICHT' : 'STOP'}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(['cockpit', 'settings', 'alerts'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                activeView === view
                  ? 'bg-accent-primary text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/5'
              )}
            >
              {view === 'cockpit' && <Activity size={13} />}
              {view === 'settings' && <Zap size={13} />}
              {view === 'alerts' && <Bell size={13} />}
              {view === 'cockpit' ? 'Cockpit' : view === 'settings' ? 'Settings' : 'Alerts'}
              {view === 'alerts' && unreadAlerts > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-pnl-negative text-white text-[10px] rounded-full leading-none">
                  {unreadAlerts}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* COCKPIT VIEW */}
      {activeView === 'cockpit' && (
        <>
          {/* Warning Banner */}
          {riskStatus !== 'ok' && (
            <div className={clsx(
              'mb-5 p-4 rounded-xl border flex items-center gap-3',
              riskStatus === 'warning' && 'bg-yellow-500/5 border-yellow-500/30',
              riskStatus === 'danger' && 'bg-pnl-negative/5 border-pnl-negative/30'
            )}>
              <AlertTriangle className={clsx(
                riskStatus === 'warning' ? 'text-yellow-500' : 'text-pnl-negative'
              )} size={20} />
              <div className="flex-1">
                <span className={clsx(
                  'font-semibold text-sm',
                  riskStatus === 'warning' ? 'text-yellow-500' : 'text-pnl-negative'
                )}>
                  {riskStatus === 'danger' ? 'STOP TRADING!' : 'Vorsicht!'}
                </span>
                <span className="text-xs text-text-muted ml-3">
                  {todayR <= -settings.dailyLossLimitR && `Tages-Limit erreicht (${todayR.toFixed(1)}R) `}
                  {consecutiveLosses >= settings.consecutiveLossLimit && `${consecutiveLosses}x Verluste in Folge `}
                  {drawdownPercent >= settings.drawdownAlertThreshold && `DD ${drawdownPercent.toFixed(1)}% `}
                  {todayTrades.length >= settings.dailyTradeLimit && 'Trade-Limit erreicht'}
                </span>
              </div>
            </div>
          )}

          <BentoGrid cols={4}>
            {/* Gauges Row */}
            <BentoCell>
              <Gauge
                value={Math.abs(todayR)}
                max={settings.dailyLossLimitR}
                label="Tages-P&L"
                sublabel={`${todayR >= 0 ? '+' : ''}${todayR.toFixed(1)}R / -${settings.dailyLossLimitR}R`}
                size="lg"
              />
            </BentoCell>

            <BentoCell>
              <Gauge
                value={todayTrades.length}
                max={settings.dailyTradeLimit}
                label="Trades heute"
                sublabel={`${todayTrades.length} / ${settings.dailyTradeLimit}`}
                size="lg"
              />
            </BentoCell>

            <BentoCell>
              <Gauge
                value={drawdownPercent}
                max={settings.drawdownAlertThreshold * 1.5}
                label="Drawdown"
                sublabel={`${drawdownPercent.toFixed(1)}% / ${settings.drawdownAlertThreshold}%`}
                size="lg"
              />
            </BentoCell>

            {/* Tilt Meter */}
            <BentoCell>
              <div className="flex flex-col items-center">
                <Gauge
                  value={tiltScore}
                  max={100}
                  label="Tilt Meter"
                  sublabel={tiltScore < 30 ? 'Ruhig' : tiltScore < 60 ? 'Aufpassen' : tiltScore < 80 ? 'Gefährlich' : 'STOP!'}
                  size="lg"
                />
              </div>
            </BentoCell>

            {/* Trade Streak - wide */}
            <BentoCell size="wide">
              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">
                  Trade History
                </span>
                <TradeStreak results={tradeResults} maxDots={30} showLabels size="md" />
              </div>
            </BentoCell>

            {/* Consecutive Losses */}
            <BentoCell>
              <MetricDisplay
                label="Verluste in Folge"
                value={consecutiveLosses}
                size="lg"
                showSign={false}
              />
              <div className="mt-2 text-xs text-text-muted">
                Limit: {settings.consecutiveLossLimit}
              </div>
            </BentoCell>

            {/* Peak Equity */}
            <BentoCell>
              <MetricDisplay
                label="Peak Equity"
                value={drawdownData.peakEquity}
                format="R"
                size="lg"
                showSign
              />
            </BentoCell>

            {/* Last 7 Days - wide */}
            <BentoCell size="wide">
              <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em] mb-3 block">
                Letzte 7 Tage
              </span>
              <div className="grid grid-cols-7 gap-2">
                {last7Days.map((day, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[10px] text-text-muted mb-1">{day.label}</div>
                    <div className={clsx(
                      'py-2.5 rounded-lg font-semibold text-sm font-mono tabular-nums',
                      day.trades === 0 && 'bg-white/[0.03] text-text-muted',
                      day.r > 0 && 'bg-pnl-positive/15 text-pnl-positive',
                      day.r < 0 && 'bg-pnl-negative/15 text-pnl-negative',
                      day.r === 0 && day.trades > 0 && 'bg-white/[0.03] text-text-muted'
                    )}>
                      {day.trades > 0 ? `${day.r >= 0 ? '+' : ''}${day.r.toFixed(1)}R` : '-'}
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">{day.trades}T</div>
                  </div>
                ))}
              </div>
            </BentoCell>

            {/* Risk Analysis - wide */}
            <BentoCell size="wide">
              <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em] mb-3 block">
                Risk Analyse
              </span>
              <div className="grid grid-cols-3 gap-4">
                {/* Risk of Ruin */}
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Risk of Ruin</div>
                  {riskOfRuin !== null ? (
                    <>
                      <div className={clsx(
                        'text-2xl font-bold font-mono tabular-nums',
                        riskOfRuin < 0.01 ? 'text-pnl-positive' :
                        riskOfRuin < 0.05 ? 'text-yellow-500' : 'text-pnl-negative'
                      )}>
                        {(riskOfRuin * 100).toFixed(2)}%
                      </div>
                      <div className="w-full bg-white/[0.04] rounded-full h-1.5 mt-2">
                        <div
                          className={clsx(
                            'h-1.5 rounded-full',
                            riskOfRuin < 0.01 ? 'bg-pnl-positive' :
                            riskOfRuin < 0.05 ? 'bg-yellow-500' : 'bg-pnl-negative'
                          )}
                          style={{ width: `${Math.min(riskOfRuin * 100, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-text-muted">Mehr Trades benötigt</div>
                  )}
                </div>

                {/* Kelly Criterion */}
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Kelly (Half)</div>
                  {kellyCriterion !== null ? (
                    <>
                      <div className="text-2xl font-bold font-mono tabular-nums text-accent-primary">
                        {kellyCriterion.fractionalKelly.toFixed(2)}%
                      </div>
                      <div className="text-xs text-text-muted mt-1">
                        Full: {kellyCriterion.fullKelly.toFixed(2)}% | Aktuell: {configs?.ek?.defaultRiskPerTrade || 1}%
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-text-muted">Mehr Trades benötigt</div>
                  )}
                </div>

                {/* Daily Loss Limit */}
                <div className="p-3 rounded-lg bg-white/[0.03]">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Tages-Verlust-Limit</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-accent-gold">
                    ${dailyLossLimit.amountLimit.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    -{dailyLossLimit.rLimit.toFixed(1)}R | Max {dailyLossLimit.tradesAllowed} Trades
                  </div>
                </div>
              </div>
            </BentoCell>

            {/* Trading Stats */}
            <BentoCell size="wide">
              <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em] mb-3 block">
                Basis-Statistiken (Live)
              </span>
              <div className="grid grid-cols-6 gap-3">
                {[
                  { label: 'Trades', value: stats.totalTrades.toString() },
                  { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, color: 'text-accent-primary' },
                  { label: 'Avg Win', value: `+${stats.avgWinR.toFixed(2)}R`, color: 'text-pnl-positive' },
                  { label: 'Avg Loss', value: `-${stats.avgLossR.toFixed(2)}R`, color: 'text-pnl-negative' },
                  { label: 'PF', value: stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2) },
                  { label: 'Expectancy', value: `${stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}R`, color: stats.expectancy >= 0 ? 'text-pnl-positive' : 'text-pnl-negative' },
                ].map((item) => (
                  <div key={item.label} className="text-center p-2.5 rounded-lg bg-white/[0.03]">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">{item.label}</div>
                    <div className={clsx('text-lg font-bold font-mono tabular-nums mt-0.5', item.color || 'text-text-primary')}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </BentoCell>

            {/* Drawdown Stats */}
            <BentoCell size="wide">
              <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em] mb-3 block">
                Drawdown Analyse
              </span>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Max DD (R)', value: `-${drawdownData.maxDrawdown.toFixed(2)}R`, color: 'text-pnl-negative' },
                  { label: 'Max DD (%)', value: `${drawdownData.maxDrawdownPercent.toFixed(1)}%`, color: 'text-pnl-negative' },
                  { label: 'Aktuell', value: `${drawdownData.currentDrawdown.toFixed(2)}R` },
                  { label: 'Peak', value: `+${drawdownData.peakEquity.toFixed(2)}R`, color: 'text-accent-primary' },
                ].map((item) => (
                  <div key={item.label} className="text-center p-2.5 rounded-lg bg-white/[0.03]">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">{item.label}</div>
                    <div className={clsx('text-lg font-bold font-mono tabular-nums mt-0.5', item.color || 'text-text-primary')}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </BentoCell>
          </BentoGrid>
        </>
      )}

      {/* SETTINGS VIEW */}
      {activeView === 'settings' && (
        <div className="space-y-5 max-w-3xl">
          {/* Daily Limits */}
          <div className="rounded-xl bg-background-surface border border-border p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <TrendingDown size={15} className="text-pnl-negative" />
              Tages-Limits
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Max Verlust (R)</label>
                <input
                  type="number" step="0.5" className="input w-full"
                  value={formData.dailyLossLimitR}
                  onChange={(e) => setFormData(f => ({ ...f, dailyLossLimitR: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Max Verlust (%)</label>
                <input
                  type="number" step="0.5" className="input w-full"
                  value={formData.dailyLossLimitPercent}
                  onChange={(e) => setFormData(f => ({ ...f, dailyLossLimitPercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Max Trades/Tag</label>
                <input
                  type="number" className="input w-full"
                  value={formData.dailyTradeLimit}
                  onChange={(e) => setFormData(f => ({ ...f, dailyTradeLimit: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end pb-1">
                <button
                  onClick={() => setFormData(f => ({ ...f, dailyLossLimitEnabled: !f.dailyLossLimitEnabled }))}
                  className={clsx(
                    'w-full py-2 rounded-lg text-xs font-semibold transition-colors',
                    formData.dailyLossLimitEnabled
                      ? 'bg-pnl-positive/15 text-pnl-positive'
                      : 'bg-white/[0.04] text-text-muted'
                  )}
                >
                  {formData.dailyLossLimitEnabled ? 'AKTIV' : 'INAKTIV'}
                </button>
              </div>
            </div>
          </div>

          {/* Drawdown & Streak */}
          <div className="rounded-xl bg-background-surface border border-border p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <AlertTriangle size={15} className="text-yellow-500" />
              Drawdown & Streak Alerts
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">DD Threshold (%)</label>
                <input
                  type="number" step="0.5" className="input w-full"
                  value={formData.drawdownAlertThreshold}
                  onChange={(e) => setFormData(f => ({ ...f, drawdownAlertThreshold: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Consecutive Loss Limit</label>
                <input
                  type="number" className="input w-full"
                  value={formData.consecutiveLossLimit}
                  onChange={(e) => setFormData(f => ({ ...f, consecutiveLossLimit: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex flex-col gap-2 justify-end">
                <button
                  onClick={() => setFormData(f => ({ ...f, drawdownAlertEnabled: !f.drawdownAlertEnabled }))}
                  className={clsx(
                    'w-full py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    formData.drawdownAlertEnabled
                      ? 'bg-pnl-positive/15 text-pnl-positive'
                      : 'bg-white/[0.04] text-text-muted'
                  )}
                >
                  DD Alerts {formData.drawdownAlertEnabled ? 'AN' : 'AUS'}
                </button>
                <button
                  onClick={() => setFormData(f => ({ ...f, consecutiveLossAlertEnabled: !f.consecutiveLossAlertEnabled }))}
                  className={clsx(
                    'w-full py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    formData.consecutiveLossAlertEnabled
                      ? 'bg-pnl-positive/15 text-pnl-positive'
                      : 'bg-white/[0.04] text-text-muted'
                  )}
                >
                  Streak Alerts {formData.consecutiveLossAlertEnabled ? 'AN' : 'AUS'}
                </button>
              </div>
            </div>
          </div>

          {/* Weekly Limits */}
          <div className="rounded-xl bg-background-surface border border-border p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Activity size={15} className="text-accent-primary" />
              Wochen-Limits
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Max Wochen-Verlust (R)</label>
                <input
                  type="number" step="1" className="input w-full"
                  value={formData.weeklyLossLimitR}
                  onChange={(e) => setFormData(f => ({ ...f, weeklyLossLimitR: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Max Wochen-Verlust (%)</label>
                <input
                  type="number" step="0.5" className="input w-full"
                  value={formData.weeklyLossLimitPercent}
                  onChange={(e) => setFormData(f => ({ ...f, weeklyLossLimitPercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end pb-1">
                <button
                  onClick={() => setFormData(f => ({ ...f, weeklyLossLimitEnabled: !f.weeklyLossLimitEnabled }))}
                  className={clsx(
                    'w-full py-2 rounded-lg text-xs font-semibold transition-colors',
                    formData.weeklyLossLimitEnabled
                      ? 'bg-pnl-positive/15 text-pnl-positive'
                      : 'bg-white/[0.04] text-text-muted'
                  )}
                >
                  {formData.weeklyLossLimitEnabled ? 'AKTIV' : 'INAKTIV'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Save size={15} />
              Speichern
            </button>
          </div>
        </div>
      )}

      {/* ALERTS VIEW */}
      {activeView === 'alerts' && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex justify-between items-center">
            <p className="text-xs text-text-muted">
              {alerts.length} Alert{alerts.length !== 1 ? 's' : ''} ({unreadAlerts} ungelesen)
            </p>
            {alerts.length > 0 && (
              <button onClick={clearAlerts} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1.5">
                <RefreshCw size={12} />
                Alle löschen
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="rounded-xl bg-background-surface border border-border text-center py-16">
              <BellOff size={40} className="mx-auto text-text-muted/30 mb-3" />
              <p className="text-sm text-text-muted">Keine Alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={clsx(
                    'p-3 rounded-lg border flex items-center justify-between transition-opacity',
                    alert.acknowledged && 'opacity-40',
                    alert.severity === 'danger' && 'bg-pnl-negative/5 border-pnl-negative/20',
                    alert.severity === 'warning' && 'bg-yellow-500/5 border-yellow-500/20',
                    alert.severity === 'info' && 'bg-accent-primary/5 border-accent-primary/20'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className={clsx(
                      alert.severity === 'danger' && 'text-pnl-negative',
                      alert.severity === 'warning' && 'text-yellow-500',
                      alert.severity === 'info' && 'text-accent-primary'
                    )} />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{alert.message}</p>
                      <p className="text-[10px] text-text-muted">
                        {new Date(alert.timestamp).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="text-xs px-2.5 py-1 rounded-md bg-white/[0.05] text-text-muted hover:text-text-primary"
                    >
                      OK
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
