/**
 * ========================================================================
 * Trading Journal - Unified Journal Page Component
 * ========================================================================
 * Shared journal page used by both FundedJournal and EKJournal.
 * Single Supabase logic for both account types.
 */

import { useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  Plus, Filter, Grid, List, RefreshCw, Settings, PlusCircle, ChevronDown, Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { TradeCard } from '@/components/trades/TradeCard';
import { TradeForm } from '@/components/trades/TradeForm';
import { TradeDetailModal } from '@/components/trades/TradeDetailModal';
import { AccountSettings } from './AccountSettings';
import { StatusDot } from '@/components/ui/StatusDot';
import { PageTransition } from '@/components/ui/PageTransition';
import * as tradeService from '@/services/tradeService';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import type { Trade, AccountType, TradeResult, AccountConfig } from '@/types';
import { PAIR_LIST, SETUP_DEFINITIONS } from '@/types';

type ViewMode = 'cards' | 'table';

interface JournalPageProps {
  accountType: AccountType;
  title: string;
  icon: ReactNode;
}

export function JournalPage({ accountType, title, icon }: JournalPageProps) {
  const { loadConfigs, configs, saveConfig, createAccount, deleteAccount, setActiveAccount, getFundedAccounts, getEkAccounts } = useAccountStore();
  const { showToast } = useUIStore();

  // Trade data state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>();
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);

  // Account-Setup & Switcher
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [setupForm, setSetupForm] = useState({
    name: accountType === 'ek' ? 'Eigenkapital' : 'Funded Account',
    broker: '',
    initialBalance: accountType === 'ek' ? 10000 : 100000,
    currency: 'USD',
    profitTarget: 8,
    maxDrawdown: 5,
    dailyDrawdown: 2,
  });
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  // Filters
  const [filters, setFilters] = useState<{
    result?: TradeResult | 'all';
    pair?: string | 'all';
    setup_daily_bos?: boolean;
    setup_value_area?: boolean;
    setup_market_structure?: boolean;
    setup_weekly_gva?: boolean;
    setup_3day_gva?: boolean;
  }>({});

  // ============================================================
  // DATA LOADING (FROM SUPABASE)
  // ============================================================
  const loadTradesData = async () => {
    setIsLoading(true);
    try {
      const data = await tradeService.loadTrades(accountType);
      setTrades(data);
    } catch (err: any) {
      console.error('Ladefehler:', err);
      showToast('Fehler beim Laden der Trades', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTradesData();
    loadConfigs();
  }, [accountType]);

  // ============================================================
  // FILTERING
  // ============================================================
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (filters.result && filters.result !== 'all' && trade.result !== filters.result) return false;
      if (filters.pair && filters.pair !== 'all' && trade.pair !== filters.pair) return false;
      // Setup filters
      if (filters.setup_daily_bos && !trade.setup_daily_bos) return false;
      if (filters.setup_value_area && !trade.setup_value_area) return false;
      if (filters.setup_market_structure && !trade.setup_market_structure) return false;
      if (filters.setup_weekly_gva && !trade.setup_weekly_gva) return false;
      if (filters.setup_3day_gva && !trade.setup_3day_gva) return false;
      return true;
    });
  }, [trades, filters]);

  const config = configs?.[accountType];

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleSaveTrade = async (tradeData: Omit<Trade, 'id'> & { id?: string }): Promise<Trade | null> => {
    try {
      const isNewTrade = !tradeData.id;
      const oldTrade = isNewTrade ? null : trades.find(t => t.id === tradeData.id);

      // Calculate profit before saving so we can set balance fields
      const calculatedProfit = tradeData.profitAmount ?? ((tradeData.riskAmount || 0) * (tradeData.rMultiple || 0));
      const currentConfig = configs?.[accountType];

      // Auto-fill accountBalanceBefore / accountBalanceAfter for new trades
      let enrichedTradeData = { ...tradeData, type: accountType };
      if (isNewTrade && currentConfig) {
        enrichedTradeData.accountBalanceBefore = currentConfig.currentBalance;
        enrichedTradeData.accountBalanceAfter = Math.round((currentConfig.currentBalance + calculatedProfit) * 100) / 100;
      }

      const savedTrade = await tradeService.saveTrade(enrichedTradeData);

      console.log('💰 Balance Update:', { 
        hasConfig: !!currentConfig,
        currentBalance: currentConfig?.currentBalance,
        result: tradeData.result, 
        profitAmount: tradeData.profitAmount,
        calculatedProfit,
        rMultiple: tradeData.rMultiple,
        riskAmount: tradeData.riskAmount,
        isNewTrade
      });
      
      // Update account balance based on profit/loss (except for breakeven)
      if (currentConfig && tradeData.result !== 'breakeven') {
        const profitAmount = calculatedProfit;
        let balanceChange = profitAmount;
        
        // If editing, reverse the old trade's effect first
        if (oldTrade && oldTrade.result !== 'breakeven') {
          const oldProfit = oldTrade.profitAmount || ((oldTrade.riskAmount || 0) * (oldTrade.rMultiple || 0));
          balanceChange = profitAmount - oldProfit;
        }
        
        const newBalance = currentConfig.currentBalance + (isNewTrade ? profitAmount : balanceChange);
        
        console.log('💰 Calculated balance change:', { 
          oldBalance: currentConfig.currentBalance, 
          profitAmount, 
          balanceChange,
          newBalance
        });
        
        if (balanceChange !== 0 || isNewTrade) {
          const success = await saveConfig({ ...currentConfig, currentBalance: Math.round(newBalance * 100) / 100 });
          console.log('💰 Balance update result:', success, 'New balance:', newBalance);
        }
      } else {
        console.log('⚠️ Balance not updated:', { hasConfig: !!currentConfig, result: tradeData.result });
      }
      
      showToast(tradeData.id ? 'Trade aktualisiert' : 'Trade gespeichert', 'success');
      setShowTradeForm(false);
      setEditingTrade(undefined);
      loadTradesData();
      await loadConfigs();
      return savedTrade ?? null;
    } catch (error: any) {
      console.error('Speicherfehler:', error);
      showToast('Speichern fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'), 'error');
      return null;
    }
  };

  const handleDeleteTrade = async (trade: Trade) => {
    if (confirm(`Trade vom ${trade.date} wirklich löschen?`)) {
      try {
        await tradeService.deleteTrade(trade.id);
        
        // Get fresh config from store
        const currentConfig = configs?.[accountType];
        
        // Reverse the balance change (except for breakeven)
        if (currentConfig && trade.result !== 'breakeven') {
          // Calculate profit if not stored
          const profitAmount = trade.profitAmount || ((trade.riskAmount || 0) * (trade.rMultiple || 0));
          const newBalance = currentConfig.currentBalance - profitAmount;
          
          console.log('💰 Delete - Reversing balance:', {
            oldBalance: currentConfig.currentBalance,
            profitAmount,
            newBalance
          });
          
          await saveConfig({ ...currentConfig, currentBalance: Math.round(newBalance * 100) / 100 });
        }
        
        showToast('Trade erfolgreich gelöscht', 'success');
        setTrades(prev => prev.filter(t => t.id !== trade.id));
        await loadConfigs();
      } catch (error) {
        console.error('Löschfehler:', error);
        showToast('Fehler beim Löschen', 'error');
      }
    }
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setShowTradeForm(true);
  };

  const handleViewTrade = (trade: Trade) => {
    setViewingTrade(trade);
  };

  const handleCloseForm = () => {
    setShowTradeForm(false);
    setEditingTrade(undefined);
  };

  const handleSaveConfig = async (updatedConfig: AccountConfig) => {
    return await saveConfig(updatedConfig);
  };

  const resetFilters = () => setFilters({});

  // ============================================================
  // ACCOUNT SETUP HANDLER
  // ============================================================
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSetup(true);
    try {
      const isFunded = accountType === 'funded';
      const profitTargetAbs = isFunded
        ? setupForm.initialBalance * (1 + setupForm.profitTarget / 100)
        : undefined;
      const maxDrawdownAbs = isFunded
        ? setupForm.initialBalance * (1 - setupForm.maxDrawdown / 100)
        : undefined;

      const success = await createAccount({
        name:                setupForm.name,
        broker:              setupForm.broker,
        type:                accountType,
        currency:            setupForm.currency,
        initialStartBalance: setupForm.initialBalance,
        currentBalance:      setupForm.initialBalance,
        enableGoals:         isFunded,
        profitTargetValue:   isFunded ? setupForm.profitTarget : undefined,
        profitTargetType:    isFunded ? 'percent' : undefined,
        profitTarget:        profitTargetAbs,
        maxDrawdownValue:    isFunded ? setupForm.maxDrawdown : undefined,
        maxDrawdownType:     isFunded ? 'percent' : undefined,
        maxDrawdown:         maxDrawdownAbs,
        dailyDrawdownValue:  isFunded ? setupForm.dailyDrawdown : undefined,
        dailyDrawdownType:   isFunded ? 'percent' : undefined,
        isActive:            true,
        isDefault:           true,
      });

      if (success) {
        showToast('Konto erfolgreich eingerichtet!', 'success');
        setShowSetupForm(false);
        await loadConfigs();
        loadTradesData();
      } else {
        showToast('Fehler beim Einrichten', 'error');
      }
    } catch {
      showToast('Fehler beim Einrichten', 'error');
    } finally {
      setIsSavingSetup(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    await deleteAccount(accountId, accountType);
    await loadConfigs();
    loadTradesData();
  };

  // Computed values für Account-Switcher
  const fundedAccounts = accountType === 'funded' ? getFundedAccounts() : [];
  const showSwitcher   = accountType === 'funded' && fundedAccounts.length > 1;

  // ============================================================
  // KEIN ACCOUNT → SETUP-BILDSCHIRM
  // ============================================================
  if (!isLoading && config === null && !configs?.ek && accountType === 'ek') {
    // handled below via unified check
  }
  if (!isLoading && config === null) {
    const label = accountType === 'ek' ? 'Eigenkapital-Konto' : 'Funded Account';
    return (
      <PageTransition>
        <div className="page-container">
          <div className="page-header">
            <h1 className="page-title">{icon}{title}</h1>
          </div>

          <div className="glass-card p-10 text-center max-w-lg mx-auto mt-12">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
              <PlusCircle size={32} className="text-accent-primary" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">Kein {label} vorhanden</h2>
            <p className="text-text-muted text-sm mb-6">
              Richte zuerst dein {label} ein, um Trades zu journalen.
            </p>

            {!showSetupForm ? (
              <button
                className="btn-primary mx-auto"
                onClick={() => setShowSetupForm(true)}
              >
                <PlusCircle size={16} />
                {label} einrichten
              </button>
            ) : (
              <form onSubmit={handleCreateAccount} className="text-left space-y-4 mt-4">
                <div>
                  <label className="input-label">Name</label>
                  <input
                    className="input"
                    value={setupForm.name}
                    onChange={e => setSetupForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                {accountType === 'funded' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="input-label">Broker</label>
                        <input
                          className="input"
                          placeholder="z.B. FTMO"
                          value={setupForm.broker}
                          onChange={e => setSetupForm(f => ({ ...f, broker: e.target.value }))}
                        />
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="input-label">Startkapital</label>
                    <input
                      type="number"
                      className="input"
                      value={setupForm.initialBalance}
                      onChange={e => setSetupForm(f => ({ ...f, initialBalance: Number(e.target.value) }))}
                      required
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="input-label">Währung</label>
                    <select
                      className="select"
                      value={setupForm.currency}
                      onChange={e => setSetupForm(f => ({ ...f, currency: e.target.value }))}
                    >
                      <option>USD</option>
                      <option>EUR</option>
                      <option>GBP</option>
                      <option>CHF</option>
                    </select>
                  </div>
                </div>
                {accountType === 'funded' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="input-label">Profit-Target (%)</label>
                      <input
                        type="number"
                        className="input"
                        value={setupForm.profitTarget}
                        step="0.5"
                        min="0"
                        onChange={e => setSetupForm(f => ({ ...f, profitTarget: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="input-label">Max. Drawdown (%)</label>
                      <input
                        type="number"
                        className="input"
                        value={setupForm.maxDrawdown}
                        step="0.5"
                        min="0"
                        onChange={e => setSetupForm(f => ({ ...f, maxDrawdown: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label className="input-label">Tages-Drawdown (%)</label>
                      <input
                        type="number"
                        className="input"
                        value={setupForm.dailyDrawdown}
                        step="0.5"
                        min="0"
                        onChange={e => setSetupForm(f => ({ ...f, dailyDrawdown: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" className="btn-secondary flex-1" onClick={() => setShowSetupForm(false)}>
                    Abbrechen
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={isSavingSetup}>
                    {isSavingSetup ? 'Wird gespeichert…' : 'Konto anlegen'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </PageTransition>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <PageTransition>
      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <h1 className="page-title">
              {icon}
              {title}
              <StatusDot color="green" size="sm" className="ml-2" />
            </h1>
            {config && (
              <div className="flex items-center gap-4 ml-4 pl-4 border-l border-border">
                <div>
                  <span className="text-sm text-text-muted">Balance: </span>
                  <span className="font-semibold font-mono text-accent-primary">
                    ${config.currentBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Account-Switcher – nur sichtbar wenn mehrere Funded Accounts */}
                {showSwitcher && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAccountSwitcher(v => !v)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary bg-background-surface-hover rounded-lg border border-border transition-colors"
                    >
                      {config.name || 'Account'}
                      <ChevronDown size={13} />
                    </button>
                    {showAccountSwitcher && (
                      <div className="absolute left-0 top-full mt-1 z-20 min-w-[180px] bg-background-surface border border-border rounded-lg shadow-xl py-1">
                        {fundedAccounts.map(acc => (
                          <button
                            key={acc.id}
                            onClick={async () => {
                              if (acc.id) {
                                await setActiveAccount('funded', acc.id);
                                setShowAccountSwitcher(false);
                                await loadConfigs();
                                loadTradesData();
                              }
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-background-surface-hover transition-colors"
                          >
                            <span className="truncate">{acc.name || acc.broker || 'Funded'}</span>
                            {acc.id === config.id && <Check size={13} className="text-accent-primary flex-shrink-0" />}
                          </button>
                        ))}
                        <div className="border-t border-border mt-1 pt-1">
                          <button
                            onClick={() => { setShowAccountSwitcher(false); setShowSetupForm(true); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-primary hover:bg-accent-primary/10 transition-colors"
                          >
                            <PlusCircle size={13} />
                            Neuer Account
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="toggle-group">
              <button
                onClick={() => setViewMode('cards')}
                className={clsx('toggle-btn', viewMode === 'cards' && 'active')}
                title="Kartenansicht"
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={clsx('toggle-btn', viewMode === 'table' && 'active')}
                title="Tabellenansicht"
              >
                <List size={18} />
              </button>
            </div>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={clsx('btn-secondary', showSettings && 'active')}
            >
              <Settings size={18} />
            </button>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx('btn-secondary', showFilters && 'active')}
            >
              <Filter size={18} />
              Filter
            </button>

            {/* Refresh */}
            <button
              onClick={loadTradesData}
              className="btn-secondary"
              disabled={isLoading}
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>

            {/* Add Trade Button */}
            <button className="btn-primary" onClick={() => setShowTradeForm(true)}>
              <Plus size={18} />
              Neuer Trade
            </button>
          </div>
        </div>

        {/* Account Settings Panel */}
        <AccountSettings
          accounts={accountType === 'ek' ? getEkAccounts() : getFundedAccounts()}
          accountType={accountType}
          onDeleteAccount={handleDeleteAccount}
          onAddAccount={() => setShowSetupForm(true)}
          showToast={showToast}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="glass-card p-6 mb-6">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="input-label">Ergebnis</label>
                    <select
                      className="select"
                      value={filters.result || 'all'}
                      onChange={(e) => setFilters(f => ({ ...f, result: e.target.value as any }))}
                    >
                      <option value="all">Alle</option>
                      <option value="win">Wins</option>
                      <option value="loss">Losses</option>
                      <option value="breakeven">Breakeven</option>
                    </select>
                  </div>

                  <div>
                    <label className="input-label">Währungspaar</label>
                    <select
                      className="select"
                      value={filters.pair || 'all'}
                      onChange={(e) => setFilters(f => ({ ...f, pair: e.target.value }))}
                    >
                      <option value="all">Alle Paare</option>
                      {PAIR_LIST.map(pair => (
                        <option key={pair} value={pair}>{pair}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="input-label">Setups</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(SETUP_DEFINITIONS).map(([key, setup]) => (
                        <button
                          key={key}
                          onClick={() => setFilters(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                          className={clsx('setup-badge', filters[key as keyof typeof filters] && 'active')}
                          style={filters[key as keyof typeof filters] ? {
                            backgroundColor: `${setup.color}15`,
                            borderColor: setup.color,
                            color: setup.color
                          } : undefined}
                        >
                          {setup.short}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-end">
                  <button onClick={resetFilters} className="btn-ghost">
                    Filter zurücksetzen
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trade Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-muted text-sm">
            {filteredTrades.length} {filteredTrades.length === 1 ? 'Trade' : 'Trades'} gefunden
          </p>
        </div>

        {/* Trades Display */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={32} className="animate-spin text-accent-primary" />
          </div>
        ) : filteredTrades.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-12 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
              <div className="text-accent-primary">{icon}</div>
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Keine Trades gefunden</h3>
            <p className="text-text-muted mb-6 max-w-md mx-auto">
              {trades.length === 0
                ? `Starte mit deinem ersten ${accountType === 'ek' ? 'EK' : 'Funded'} Trade!`
                : 'Keine Trades entsprechen deinen Filterkriterien.'}
            </p>
            <button className="btn-primary" onClick={() => setShowTradeForm(true)}>
              <Plus size={18} />
              Neuer Trade
            </button>
          </motion.div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrades.map((trade, i) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <TradeCard
                  trade={trade}
                  onEdit={handleEditTrade}
                  onDelete={handleDeleteTrade}
                  onView={handleViewTrade}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-0 overflow-hidden"
          >
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Paar</th>
                    <th>Richtung</th>
                    <th>Ergebnis</th>
                    <th>R-Multiple</th>
                    <th>Risiko</th>
                    <th>Setups</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map(trade => (
                    <tr key={trade.id}>
                      <td>{trade.date}</td>
                      <td className="font-semibold">{trade.pair}</td>
                      <td className={trade.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative'}>
                        {trade.direction.toUpperCase()}
                      </td>
                      <td>
                        <span className={clsx('badge',
                          trade.result === 'win' ? 'badge-success' :
                          trade.result === 'loss' ? 'badge-danger' : 'badge-neutral'
                        )}>
                          {trade.result === 'win' ? 'Win' : trade.result === 'loss' ? 'Loss' : 'BE'}
                        </span>
                      </td>
                      <td className={clsx(
                        'font-semibold font-mono',
                        trade.rMultiple > 0 && 'text-pnl-positive',
                        trade.rMultiple < 0 && 'text-pnl-negative'
                      )}>
                        {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(2)} R
                      </td>
                      <td className="text-text-muted">{trade.riskPercent || '-'}%</td>
                      <td>
                        <div className="flex gap-1">
                          {Object.entries(SETUP_DEFINITIONS)
                            .filter(([key]) => trade[key as keyof Trade])
                            .map(([_, setup]) => (
                              <span
                                key={setup.key}
                                className="px-2 py-0.5 rounded-md text-xs font-medium"
                                style={{ backgroundColor: `${setup.color}15`, color: setup.color }}
                              >
                                {setup.short}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleViewTrade(trade)}
                          className="btn-ghost py-1 px-3 text-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Trade Form Modal */}
        {showTradeForm && (
          <TradeForm
            trade={editingTrade}
            accountType={accountType}
            onSave={handleSaveTrade}
            onClose={handleCloseForm}
          />
        )}

        {/* Trade Detail Modal */}
        {viewingTrade && (
          <TradeDetailModal
            trade={viewingTrade}
            onClose={() => setViewingTrade(null)}
            onEdit={(t) => { setViewingTrade(null); handleEditTrade(t); }}
            onDelete={(t) => { handleDeleteTrade(t); setViewingTrade(null); }}
          />
        )}
      </div>
    </PageTransition>
  );
}
