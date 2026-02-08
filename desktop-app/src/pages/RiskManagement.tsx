/**
 * ========================================================================
 * Trading Journal - Risk Management Page (Enhanced)
 * ========================================================================
 * 
 * Umfassende Risk-Analyse:
 * - Risk of Ruin Berechnung
 * - Kelly Criterion
 * - Daily/Weekly Loss Limits
 * - Drawdown Tracking
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
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Calculator,
  Target,
  DollarSign,
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

export function RiskManagement() {
  const { settings, updateSettings, alerts, acknowledgeAlert, clearAlerts } = useRiskStore();
  const { trades, loadTrades } = useTradeStore();
  const { configs, loadConfigs } = useAccountStore();
  const { showToast } = useUIStore();
  
  const [formData, setFormData] = useState<RiskSettings>(settings);
  const [activeTab, setActiveTab] = useState<'status' | 'analysis' | 'settings' | 'alerts'>('status');

  useEffect(() => {
    loadTrades();
    loadConfigs();
  }, []);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  // Get live trades only
  const liveTrades = useMemo(() => 
    trades.filter(t => t.sessionType === 'live'),
    [trades]
  );

  // Trade Statistics
  const stats = useMemo(() => 
    calculateTradeStatistics(liveTrades),
    [liveTrades]
  );

  // Risk of Ruin
  const riskOfRuin = useMemo(() => {
    if (stats.wins === 0 || stats.losses === 0) return null;
    const capitalUnits = 100 / (formData.dailyLossLimitPercent || 1);
    return calculateRiskOfRuin(stats.winRate, stats.avgWinR, stats.avgLossR, capitalUnits);
  }, [stats, formData.dailyLossLimitPercent]);

  // Kelly Criterion
  const kellyCriterion = useMemo(() => {
    if (stats.wins === 0 || stats.losses === 0) return null;
    return calculateKellyCriterion(stats.winRate, stats.avgWinR, stats.avgLossR, 0.5);
  }, [stats]);

  // Daily Loss Limit
  const dailyLossLimit = useMemo(() => {
    const balance = configs?.ek?.currentBalance || 10000;
    const riskPerTrade = configs?.ek?.defaultRiskPerTrade || 1;
    return calculateDailyLossLimit(balance, formData.dailyLossLimitPercent || 2, riskPerTrade);
  }, [configs?.ek, formData.dailyLossLimitPercent]);

  // Drawdown Data
  const drawdownData = useMemo(() => 
    calculateDrawdown(liveTrades),
    [liveTrades]
  );

  // Calculate current risk metrics
  const today = new Date().toISOString().split('T')[0];
  const todayTrades = liveTrades.filter(t => t.date === today);
  const todayR = todayTrades.reduce((sum, t) => sum + t.rMultiple, 0);
  
  // Consecutive Losses
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

  // Peak balance calculation
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <Shield className={clsx(
            riskStatus === 'ok' && 'text-pnl-positive',
            riskStatus === 'warning' && 'text-yellow-500',
            riskStatus === 'danger' && 'text-pnl-negative'
          )} />
          Risk Management
        </h1>
        
        <div className="flex items-center gap-3">
          <div className={clsx(
            'px-4 py-2 rounded-lg font-medium flex items-center gap-2',
            riskStatus === 'ok' && 'bg-pnl-positive/20 text-pnl-positive',
            riskStatus === 'warning' && 'bg-yellow-500/20 text-yellow-500',
            riskStatus === 'danger' && 'bg-pnl-negative/20 text-pnl-negative'
          )}>
            {riskStatus === 'ok' && <CheckCircle size={16} />}
            {riskStatus === 'warning' && <AlertTriangle size={16} />}
            {riskStatus === 'danger' && <XCircle size={16} />}
            {riskStatus === 'ok' ? 'Alles OK' : riskStatus === 'warning' ? 'Vorsicht' : 'STOP TRADING'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'status', label: 'Status', icon: Activity },
          { id: 'analysis', label: 'Risk Analyse', icon: Calculator },
          { id: 'settings', label: 'Einstellungen', icon: Settings },
          { id: 'alerts', label: 'Alerts', icon: Bell, badge: alerts.filter(a => !a.acknowledged).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={clsx(
              'btn flex items-center gap-2',
              activeTab === tab.id ? 'btn-primary' : 'btn-secondary'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-pnl-negative text-white text-xs rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {/* Current Risk Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="text-xs text-text-muted mb-2">Heute P&L</div>
              <div className={clsx(
                'text-2xl font-semibold tabular-nums',
                todayR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'
              )}>
                {todayR >= 0 ? '+' : ''}{todayR.toFixed(1)}R
              </div>
              <div className="text-xs text-text-muted mt-1">
                Limit: -{settings.dailyLossLimitR}R
              </div>
            </div>

            <div className="stat-card">
              <div className="text-xs text-text-muted mb-2">Trades Heute</div>
              <div className="text-2xl font-semibold tabular-nums text-text-primary">
                {todayTrades.length} / {settings.dailyTradeLimit}
              </div>
              <div className="w-full bg-background-surface rounded-full h-2 mt-2">
                <div 
                  className={clsx(
                    'h-2 rounded-full transition-all',
                    todayTrades.length >= settings.dailyTradeLimit ? 'bg-pnl-negative' : 'bg-accent-primary'
                  )}
                  style={{ width: `${Math.min((todayTrades.length / settings.dailyTradeLimit) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="stat-card">
              <div className="text-xs text-text-muted mb-2">Consecutive Losses</div>
              <div className={clsx(
                'text-2xl font-semibold tabular-nums',
                consecutiveLosses >= settings.consecutiveLossLimit ? 'text-pnl-negative' : 'text-text-primary'
              )}>
                {consecutiveLosses}
              </div>
              <div className="text-xs text-text-muted mt-1">
                Limit: {settings.consecutiveLossLimit}
              </div>
            </div>

            <div className="stat-card">
              <div className="text-xs text-text-muted mb-2">Drawdown</div>
              <div className={clsx(
                'text-2xl font-semibold tabular-nums',
                drawdownPercent >= settings.drawdownAlertThreshold ? 'text-pnl-negative' : 'text-text-primary'
              )}>
                {drawdownPercent.toFixed(1)}%
              </div>
              <div className="text-xs text-text-muted mt-1">
                Threshold: {settings.drawdownAlertThreshold}%
              </div>
            </div>
          </div>

          {/* Risk Warnings */}
          {riskStatus !== 'ok' && (
            <div className={clsx(
              'p-6 rounded-xl border-2',
              riskStatus === 'warning' && 'bg-yellow-500/10 border-yellow-500',
              riskStatus === 'danger' && 'bg-pnl-negative/10 border-pnl-negative'
            )}>
              <div className="flex items-start gap-4">
                <AlertTriangle className={clsx(
                  'flex-shrink-0',
                  riskStatus === 'warning' && 'text-yellow-500',
                  riskStatus === 'danger' && 'text-pnl-negative'
                )} size={32} />
                <div>
                  <h3 className={clsx(
                    'text-lg font-semibold mb-2',
                    riskStatus === 'warning' && 'text-yellow-500',
                    riskStatus === 'danger' && 'text-pnl-negative'
                  )}>
                    {riskStatus === 'danger' ? 'STOP TRADING!' : 'Vorsicht!'}
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {todayR <= -settings.dailyLossLimitR && (
                      <li>• Tages-Verlust-Limit erreicht ({todayR.toFixed(1)}R)</li>
                    )}
                    {consecutiveLosses >= settings.consecutiveLossLimit && (
                      <li>• {consecutiveLosses} Verluste in Folge - Mache eine Pause!</li>
                    )}
                    {drawdownPercent >= settings.drawdownAlertThreshold && (
                      <li>• Drawdown über Threshold ({drawdownPercent.toFixed(1)}%)</li>
                    )}
                    {todayTrades.length >= settings.dailyTradeLimit && (
                      <li>• Tägliches Trade-Limit erreicht</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock size={20} className="text-text-muted" />
              Letzte 7 Tage
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                const dateStr = date.toISOString().split('T')[0];
                const dayTrades = liveTrades.filter(t => t.date === dateStr);
                const dayR = dayTrades.reduce((sum, t) => sum + t.rMultiple, 0);
                
                return (
                  <div key={i} className="text-center">
                    <div className="text-xs text-text-muted mb-1">
                      {date.toLocaleDateString('de-DE', { weekday: 'short' })}
                    </div>
                    <div className={clsx(
                      'p-3 rounded-lg font-semibold',
                      dayTrades.length === 0 && 'bg-background-surface text-text-muted',
                      dayR > 0 && 'bg-pnl-positive/20 text-pnl-positive',
                      dayR < 0 && 'bg-pnl-negative/20 text-pnl-negative',
                      dayR === 0 && dayTrades.length > 0 && 'bg-background-surface text-text-muted'
                    )}>
                      {dayTrades.length > 0 ? `${dayR >= 0 ? '+' : ''}${dayR.toFixed(1)}R` : '-'}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      {dayTrades.length} Trade{dayTrades.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Risk Metrics Cards */}
          <div className="grid grid-cols-3 gap-6">
            {/* Risk of Ruin */}
            <div className="card border-2 border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-pnl-negative/20">
                  <AlertTriangle size={24} className="text-pnl-negative" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Risk of Ruin</h3>
                  <p className="text-xs text-text-muted">Wahrscheinlichkeit des Totalverlusts</p>
                </div>
              </div>
              
              {riskOfRuin !== null ? (
                <div className="space-y-3">
                  <div className={clsx(
                    'text-4xl font-bold tabular-nums',
                    riskOfRuin < 0.01 ? 'text-pnl-positive' :
                    riskOfRuin < 0.05 ? 'text-yellow-500' : 'text-pnl-negative'
                  )}>
                    {(riskOfRuin * 100).toFixed(2)}%
                  </div>
                  <div className="w-full bg-background-surface rounded-full h-3">
                    <div 
                      className={clsx(
                        'h-3 rounded-full transition-all',
                        riskOfRuin < 0.01 ? 'bg-pnl-positive' :
                        riskOfRuin < 0.05 ? 'bg-yellow-500' : 'bg-pnl-negative'
                      )}
                      style={{ width: `${Math.min(riskOfRuin * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted">
                    {riskOfRuin < 0.01 ? '✅ Sehr gut! Niedriges Ruin-Risiko' :
                     riskOfRuin < 0.05 ? '⚠️ Moderates Risiko - Vorsicht geboten' :
                     '🚨 Hohes Risiko! Reduziere Position-Größe'}
                  </p>
                </div>
              ) : (
                <p className="text-text-muted text-sm">Mindestens 5 Trades (Win + Loss) benötigt</p>
              )}
            </div>

            {/* Kelly Criterion */}
            <div className="card border-2 border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-accent-primary/20">
                  <Target size={24} className="text-accent-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Kelly Criterion</h3>
                  <p className="text-xs text-text-muted">Optimale Position-Größe</p>
                </div>
              </div>
              
              {kellyCriterion !== null ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold tabular-nums text-accent-primary">
                      {kellyCriterion.fractionalKelly.toFixed(2)}%
                    </span>
                    <span className="text-sm text-text-muted">
                      (Half-Kelly)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-text-muted">Full Kelly:</span>
                      <span className="ml-2 font-semibold">{kellyCriterion.fullKelly.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Aktuell:</span>
                      <span className="ml-2 font-semibold">{configs?.ek?.defaultRiskPerTrade || 1}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted p-2 bg-background-surface rounded-lg">
                    💡 {kellyCriterion.recommendation}
                  </p>
                </div>
              ) : (
                <p className="text-text-muted text-sm">Mindestens 5 Trades (Win + Loss) benötigt</p>
              )}
            </div>

            {/* Daily Loss Limit */}
            <div className="card border-2 border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-accent-gold/20">
                  <DollarSign size={24} className="text-accent-gold" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">Daily Loss Limit</h3>
                  <p className="text-xs text-text-muted">Max. Tagesverlust in {configs?.ek?.currency || 'USD'}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="text-4xl font-bold tabular-nums text-accent-gold">
                  ${dailyLossLimit.amountLimit.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-muted">In R:</span>
                    <span className="ml-2 font-semibold text-pnl-negative">-{dailyLossLimit.rLimit.toFixed(1)}R</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Max Trades:</span>
                    <span className="ml-2 font-semibold">{dailyLossLimit.tradesAllowed}</span>
                  </div>
                </div>
                <p className="text-xs text-text-muted">
                  Basierend auf {formData.dailyLossLimitPercent}% Max-Tagesverlust
                </p>
              </div>
            </div>
          </div>

          {/* Trading Statistics */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap size={20} className="text-accent-primary" />
              Trading Statistiken (Basis für Berechnungen)
            </h3>
            <div className="grid grid-cols-6 gap-4">
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Total Trades</div>
                <div className="text-2xl font-bold">{stats.totalTrades}</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Win Rate</div>
                <div className="text-2xl font-bold text-accent-primary">{stats.winRate.toFixed(1)}%</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Avg Win</div>
                <div className="text-2xl font-bold text-pnl-positive">+{stats.avgWinR.toFixed(2)}R</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Avg Loss</div>
                <div className="text-2xl font-bold text-pnl-negative">-{stats.avgLossR.toFixed(2)}R</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Profit Factor</div>
                <div className="text-2xl font-bold">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Expectancy</div>
                <div className={clsx('text-2xl font-bold', stats.expectancy >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                  {stats.expectancy >= 0 ? '+' : ''}{stats.expectancy.toFixed(2)}R
                </div>
              </div>
            </div>
          </div>

          {/* Max Drawdown Info */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingDown size={20} className="text-pnl-negative" />
              Drawdown Analyse
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Max Drawdown (R)</div>
                <div className="text-2xl font-bold text-pnl-negative">-{drawdownData.maxDrawdown.toFixed(2)}R</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Max Drawdown (%)</div>
                <div className="text-2xl font-bold text-pnl-negative">{drawdownData.maxDrawdownPercent.toFixed(1)}%</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Aktueller Drawdown</div>
                <div className="text-2xl font-bold">{drawdownData.currentDrawdown.toFixed(2)}R</div>
              </div>
              <div className="text-center p-4 bg-background-surface rounded-xl">
                <div className="text-xs text-text-muted mb-1">Peak Equity</div>
                <div className="text-2xl font-bold text-accent-primary">+{drawdownData.peakEquity.toFixed(2)}R</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Daily Limits */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingDown size={20} className="text-pnl-negative" />
              Tages-Limits
            </h3>
            
            <div className="grid grid-cols-4 gap-6">
              <div>
                <label className="input-label">Max Tages-Verlust (R)</label>
                <input
                  type="number"
                  step="0.5"
                  className="input"
                  value={formData.dailyLossLimitR}
                  onChange={(e) => setFormData(f => ({ ...f, dailyLossLimitR: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div>
                <label className="input-label">Max Tages-Verlust (%)</label>
                <input
                  type="number"
                  step="0.5"
                  className="input"
                  value={formData.dailyLossLimitPercent}
                  onChange={(e) => setFormData(f => ({ ...f, dailyLossLimitPercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div>
                <label className="input-label">Max Trades pro Tag</label>
                <input
                  type="number"
                  className="input"
                  value={formData.dailyTradeLimit}
                  onChange={(e) => setFormData(f => ({ ...f, dailyTradeLimit: parseInt(e.target.value) || 0 }))}
                />
              </div>
              
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.dailyLossLimitEnabled}
                    onChange={(e) => setFormData(f => ({ ...f, dailyLossLimitEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-text-primary">Aktiv</span>
                </label>
              </div>
            </div>
          </div>

          {/* Drawdown Alerts */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-yellow-500" />
              Drawdown & Streak Alerts
            </h3>
            
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="input-label">Drawdown Threshold (%)</label>
                <input
                  type="number"
                  step="0.5"
                  className="input"
                  value={formData.drawdownAlertThreshold}
                  onChange={(e) => setFormData(f => ({ ...f, drawdownAlertThreshold: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div>
                <label className="input-label">Consecutive Loss Limit</label>
                <input
                  type="number"
                  className="input"
                  value={formData.consecutiveLossLimit}
                  onChange={(e) => setFormData(f => ({ ...f, consecutiveLossLimit: parseInt(e.target.value) || 0 }))}
                />
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.drawdownAlertEnabled}
                    onChange={(e) => setFormData(f => ({ ...f, drawdownAlertEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-text-primary">Drawdown Alerts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.consecutiveLossAlertEnabled}
                    onChange={(e) => setFormData(f => ({ ...f, consecutiveLossAlertEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-text-primary">Loss Streak Alerts</span>
                </label>
              </div>
            </div>
          </div>

          {/* Weekly Limits */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity size={20} className="text-accent-primary" />
              Wochen-Limits
            </h3>
            
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="input-label">Max Wochen-Verlust (R)</label>
                <input
                  type="number"
                  step="1"
                  className="input"
                  value={formData.weeklyLossLimitR}
                  onChange={(e) => setFormData(f => ({ ...f, weeklyLossLimitR: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div>
                <label className="input-label">Max Wochen-Verlust (%)</label>
                <input
                  type="number"
                  step="0.5"
                  className="input"
                  value={formData.weeklyLossLimitPercent}
                  onChange={(e) => setFormData(f => ({ ...f, weeklyLossLimitPercent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.weeklyLossLimitEnabled}
                    onChange={(e) => setFormData(f => ({ ...f, weeklyLossLimitEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-text-primary">Aktiv</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleSave} className="btn-primary">
              <Save size={16} />
              Speichern
            </button>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-text-muted">
              {alerts.length} Alert{alerts.length !== 1 ? 's' : ''} 
              ({alerts.filter(a => !a.acknowledged).length} ungelesen)
            </p>
            {alerts.length > 0 && (
              <button onClick={clearAlerts} className="btn-secondary">
                <RefreshCw size={16} />
                Alle löschen
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="card text-center py-12">
              <BellOff size={48} className="mx-auto text-text-muted mb-4" />
              <p className="text-text-muted">Keine Alerts vorhanden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={clsx(
                    'p-4 rounded-lg border flex items-center justify-between',
                    alert.acknowledged && 'opacity-50',
                    alert.severity === 'danger' && 'bg-pnl-negative/10 border-pnl-negative/30',
                    alert.severity === 'warning' && 'bg-yellow-500/10 border-yellow-500/30',
                    alert.severity === 'info' && 'bg-accent-primary/10 border-accent-primary/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={clsx(
                      alert.severity === 'danger' && 'text-pnl-negative',
                      alert.severity === 'warning' && 'text-yellow-500',
                      alert.severity === 'info' && 'text-accent-primary'
                    )} size={20} />
                    <div>
                      <p className="font-medium text-text-primary">{alert.message}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(alert.timestamp).toLocaleString('de-DE')}
                      </p>
                    </div>
                  </div>
                  
                  {!alert.acknowledged && (
                    <button 
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="btn-secondary text-sm"
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
  );
}
