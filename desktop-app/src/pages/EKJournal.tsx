/**
 * ========================================================================
 * Trading Journal - EK (Eigenkapital) Journal Page
 * ========================================================================
 */

import { useEffect, useState } from 'react';
import { Wallet, Plus, Filter, Grid, List, RefreshCw, Settings, Save, X } from 'lucide-react';
import { clsx } from '@/utils';
import { TradeCard } from '@/components/trades/TradeCard';
import { TradeForm } from '@/components/trades/TradeForm';
import { TradeDetailModal } from '@/components/trades/TradeDetailModal';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import type { Trade, AccountConfig } from '@/types';
import { PAIR_LIST, SETUP_DEFINITIONS } from '@/types';

type ViewMode = 'cards' | 'table';

export function EKJournal() {
  const { trades, isLoading, loadTrades, filters, setFilters, resetFilters, getFilteredTrades, deleteTrade, saveTrade } = useTradeStore();
  const { loadConfigs, configs, saveConfig } = useAccountStore();
  const { showToast } = useUIStore();
  
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>();
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  
  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    initialStartBalance: 10000,
    currentBalance: 10000,
    defaultRiskPerTrade: 0.5,
  });

  useEffect(() => { loadTrades('ek'); loadConfigs(); }, []);
  
  // Sync settings form when config loads
  useEffect(() => {
    if (configs?.ek) {
      setSettingsForm({
        initialStartBalance: configs.ek.initialStartBalance,
        currentBalance: configs.ek.currentBalance,
        defaultRiskPerTrade: configs.ek.defaultRiskPerTrade || 0.5,
      });
    }
  }, [configs?.ek]);

  const filteredTrades = getFilteredTrades().filter(t => t.type === 'ek');
  const ekConfig = configs?.ek;

  const handleDeleteTrade = async (trade: Trade) => {
    if (confirm(`Trade vom ${trade.date} wirklich löschen?`)) {
      const success = await deleteTrade(trade.id);
      showToast(success ? 'Trade gelöscht' : 'Fehler beim Löschen', success ? 'success' : 'error');
    }
  };

  const handleEditTrade = (trade: Trade) => { setEditingTrade(trade); setShowTradeForm(true); };
  const handleViewTrade = (trade: Trade) => { setViewingTrade(trade); };
  const handleCloseForm = () => { setShowTradeForm(false); setEditingTrade(undefined); };

  const handleSaveTrade = async (tradeData: Omit<Trade, 'id'> & { id?: string }) => {
    try {
      await saveTrade(tradeData);
      showToast(tradeData.id ? 'Trade aktualisiert' : 'Trade gespeichert', 'success');
      handleCloseForm();
      loadTrades('ek');
      // Kontostand aktualisieren nach Trade-Speicherung
      await loadConfigs();
    } catch { showToast('Fehler beim Speichern', 'error'); }
  };

  const handleSaveSettings = async () => {
    if (!configs?.ek) return;
    
    const updatedConfig: AccountConfig = {
      ...configs.ek,
      initialStartBalance: settingsForm.initialStartBalance,
      currentBalance: settingsForm.currentBalance,
      defaultRiskPerTrade: settingsForm.defaultRiskPerTrade,
    };
    
    const success = await saveConfig(updatedConfig);
    if (success) {
      showToast('Einstellungen gespeichert', 'success');
      setShowSettings(false);
    } else {
      showToast('Fehler beim Speichern', 'error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <h1 className="page-title"><Wallet className="text-accent-primary" />Eigenkapital Journal</h1>
          {ekConfig && (
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-border">
              <span className="text-sm text-text-muted">Balance: </span>
              <span className="font-semibold text-accent-primary">${ekConfig.currentBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="toggle-group">
            <button onClick={() => setViewMode('cards')} className={clsx('toggle-btn', viewMode === 'cards' && 'active')}><Grid size={18} /></button>
            <button onClick={() => setViewMode('table')} className={clsx('toggle-btn', viewMode === 'table' && 'active')}><List size={18} /></button>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className={clsx('btn-secondary', showSettings && 'active')}><Settings size={18} /></button>
          <button onClick={() => setShowFilters(!showFilters)} className={clsx('btn-secondary', showFilters && 'active')}><Filter size={18} />Filter</button>
          <button onClick={() => loadTrades('ek')} className="btn-secondary" disabled={isLoading}><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
          <button className="btn-primary" onClick={() => setShowTradeForm(true)}><Plus size={18} />Neuer Trade</button>
        </div>
      </div>

      {/* INLINE SETTINGS PANEL */}
      {showSettings && (
        <div className="glass-card p-6 mb-6 animate-slide-up border-accent-primary/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings size={20} className="text-accent-primary" />
              EK Kontoeinstellungen
            </h3>
            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-glass-white rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="input-label">Startkapital</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input 
                  type="number" 
                  className="input pl-7" 
                  value={settingsForm.initialStartBalance}
                  onChange={(e) => setSettingsForm(s => ({ ...s, initialStartBalance: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <p className="text-xs text-text-muted mt-1">Dein ursprüngliches Startkapital</p>
            </div>
            
            <div>
              <label className="input-label">Aktuelle Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input 
                  type="number" 
                  className="input pl-7" 
                  value={settingsForm.currentBalance}
                  onChange={(e) => setSettingsForm(s => ({ ...s, currentBalance: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <p className="text-xs text-text-muted mt-1">Manuell anpassen bei Bedarf</p>
            </div>
            
            <div>
              <label className="input-label">Standard Risiko pro Trade</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.1" 
                  min="0.1" 
                  max="10" 
                  className="input pr-7" 
                  value={settingsForm.defaultRiskPerTrade}
                  onChange={(e) => setSettingsForm(s => ({ ...s, defaultRiskPerTrade: parseFloat(e.target.value) || 0.5 }))}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">%</span>
              </div>
              <p className="text-xs text-text-muted mt-1">Vorausgefüllt bei neuen Trades</p>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-border flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">P/L:</span>
              <span className={clsx(
                'font-semibold text-lg',
                settingsForm.currentBalance >= settingsForm.initialStartBalance ? 'text-pnl-positive' : 'text-pnl-negative'
              )}>
                {settingsForm.currentBalance >= settingsForm.initialStartBalance ? '+' : ''}
                ${(settingsForm.currentBalance - settingsForm.initialStartBalance).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
              </span>
              <span className={clsx(
                'badge',
                settingsForm.currentBalance >= settingsForm.initialStartBalance ? 'badge-success' : 'badge-danger'
              )}>
                {((settingsForm.currentBalance / settingsForm.initialStartBalance - 1) * 100).toFixed(2)}%
              </span>
            </div>
            <button onClick={handleSaveSettings} className="btn-primary">
              <Save size={18} />
              Speichern
            </button>
          </div>
        </div>
      )}

      {showFilters && (
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="grid grid-cols-4 gap-4">
            <div><label className="input-label">Ergebnis</label><select className="select" value={filters.result || 'all'} onChange={(e) => setFilters({ result: e.target.value as any })}><option value="all">Alle</option><option value="win">Wins</option><option value="loss">Losses</option><option value="breakeven">Breakeven</option></select></div>
            <div><label className="input-label">Währungspaar</label><select className="select" value={filters.pair || 'all'} onChange={(e) => setFilters({ pair: e.target.value })}><option value="all">Alle Paare</option>{PAIR_LIST.map(pair => <option key={pair} value={pair}>{pair}</option>)}</select></div>
            <div className="col-span-2"><label className="input-label">Setups</label><div className="flex flex-wrap gap-2">{Object.entries(SETUP_DEFINITIONS).map(([key, setup]) => (<button key={key} onClick={() => setFilters({ [key]: !filters[key as keyof typeof filters] })} className={clsx('setup-badge', filters[key as keyof typeof filters] && 'active')} style={filters[key as keyof typeof filters] ? { backgroundColor: `${setup.color}15`, borderColor: setup.color, color: setup.color } : undefined}>{setup.short}</button>))}</div></div>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-end"><button onClick={resetFilters} className="btn-ghost">Filter zurücksetzen</button></div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4"><p className="text-text-muted">{filteredTrades.length} {filteredTrades.length === 1 ? 'Trade' : 'Trades'} gefunden</p></div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw size={32} className="animate-spin text-accent-primary" /></div>
      ) : filteredTrades.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-glass-accent flex items-center justify-center">
            <Wallet size={40} className="text-accent-primary" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">Keine Trades gefunden</h3>
          <p className="text-text-muted mb-6 max-w-md mx-auto">{trades.length === 0 ? 'Starte mit deinem ersten EK Trade!' : 'Keine Trades entsprechen deinen Filterkriterien.'}</p>
          <button className="btn-primary" onClick={() => setShowTradeForm(true)}><Plus size={18} />Neuer Trade</button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">{filteredTrades.map(trade => <TradeCard key={trade.id} trade={trade} onEdit={handleEditTrade} onDelete={handleDeleteTrade} onView={handleViewTrade} />)}</div>
      ) : (
        <div className="glass-card p-0 overflow-hidden">
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Datum</th><th>Paar</th><th>Richtung</th><th>Ergebnis</th><th>R-Multiple</th><th>Risiko</th><th>Setups</th><th>Aktionen</th></tr></thead>
              <tbody>
                {filteredTrades.map(trade => (
                  <tr key={trade.id}>
                    <td>{trade.date}</td>
                    <td className="font-semibold">{trade.pair}</td>
                    <td className={trade.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative'}>{trade.direction.toUpperCase()}</td>
                    <td><span className={clsx('badge', trade.result === 'win' ? 'badge-success' : trade.result === 'loss' ? 'badge-danger' : 'badge-neutral')}>{trade.result === 'win' ? 'Win' : trade.result === 'loss' ? 'Loss' : 'BE'}</span></td>
                    <td className={clsx('font-semibold font-mono', trade.rMultiple > 0 && 'text-pnl-positive', trade.rMultiple < 0 && 'text-pnl-negative')}>{trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(2)} R</td>
                    <td className="text-text-muted">{trade.riskPercent || '-'}%</td>
                    <td><div className="flex gap-1">{Object.entries(SETUP_DEFINITIONS).filter(([key]) => trade[key as keyof Trade]).map(([_, setup]) => <span key={setup.key} className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: `${setup.color}15`, color: setup.color }}>{setup.short}</span>)}</div></td>
                    <td><button onClick={() => handleViewTrade(trade)} className="btn-ghost py-1 px-3 text-sm">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showTradeForm && <TradeForm trade={editingTrade} accountType="ek" onSave={handleSaveTrade} onClose={handleCloseForm} />}
      {viewingTrade && <TradeDetailModal trade={viewingTrade} onClose={() => setViewingTrade(null)} onEdit={(t) => { setViewingTrade(null); handleEditTrade(t); }} onDelete={(t) => { handleDeleteTrade(t); setViewingTrade(null); }} />}
    </div>
  );
}
