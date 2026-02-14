/**
 * ========================================================================
 * Trading Journal - Unified Journal Page Component
 * ========================================================================
 * Shared journal page used by both FundedJournal and EKJournal.
 * Single Supabase logic for both account types.
 */

import { useEffect, useState, useMemo, type ReactNode } from 'react';
import {
  Plus, Filter, Grid, List, RefreshCw, Settings
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
  const { loadConfigs, configs, saveConfig } = useAccountStore();
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
  const handleSaveTrade = async (tradeData: Omit<Trade, 'id'> & { id?: string }) => {
    try {
      const isNewTrade = !tradeData.id;
      const oldTrade = isNewTrade ? null : trades.find(t => t.id === tradeData.id);
      
      await tradeService.saveTrade({ ...tradeData, type: accountType });
      
      // Get fresh config from store to ensure we have the latest balance
      const currentConfig = configs?.[accountType];
      
      // Calculate profit if not provided: profitAmount = riskAmount * rMultiple
      const calculatedProfit = tradeData.profitAmount ?? ((tradeData.riskAmount || 0) * (tradeData.rMultiple || 0));
      
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
    } catch (error: any) {
      console.error('Speicherfehler:', error);
      showToast('Speichern fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'), 'error');
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
          config={config}
          accountType={accountType}
          onSave={handleSaveConfig}
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
