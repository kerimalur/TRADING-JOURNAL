/**
 * ========================================================================
 * Trading Journal - Funded Journal Page (SUPABASE CONNECTED & FIXED)
 * ========================================================================
 */

import { useEffect, useState } from 'react';
import { 
  DollarSign, Plus, Filter, Grid, List, RefreshCw
} from 'lucide-react';
import { clsx } from '@/utils';
import { TradeCard } from '@/components/trades/TradeCard';
import { TradeForm } from '@/components/trades/TradeForm';
import { TradeDetailModal } from '@/components/trades/TradeDetailModal';
// Wir nutzen den Store nur noch für UI-Status (Filter), nicht mehr für Daten!
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import type { Trade } from '@/types';
import { PAIR_LIST, SETUP_DEFINITIONS } from '@/types';

// SUPABASE IMPORT
import { supabase } from '@/lib/supabase';

type ViewMode = 'cards' | 'table';

export function FundedJournal() {
  // Store nur für Filter-Status nutzen
  const { filters, setFilters, resetFilters } = useTradeStore();
  const { loadConfigs, configs } = useAccountStore();
  const { showToast } = useUIStore();
  
  // LOKALER STATE für Supabase Daten
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showFilters, setShowFilters] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>();
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);

  // ============================================================
  // 1. DATEN LADEN (VON SUPABASE)
  // ============================================================
  const loadTradesFromSupabase = async () => {
    setIsLoading(true);
    try {
      // FIX: getSession ist robuster als getUser für Client-Side Checks
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log("Nicht eingeloggt - keine Trades geladen");
        setTrades([]);
        return;
      }

      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('type', 'funded') // Nur Funded Trades
        .order('created_at', { ascending: false });

      if (error) throw error;

      // MAPPING: DB (snake_case) -> APP (camelCase)
      const mappedTrades: Trade[] = (data || []).map(t => ({
        id: t.id,
        date: t.date || t.created_at.split('T')[0],
        pair: t.symbol, // DB: symbol -> App: pair
        direction: t.side as 'long' | 'short',
        entryPrice: t.entry_price,
        exitPrice: t.exit_price,
        quantity: t.quantity,
        result: t.result as 'win' | 'loss' | 'breakeven',
        rMultiple: t.r_multiple || 0,
        riskPercent: t.risk_percent,
        notes: t.notes,
        status: t.status,
        type: 'funded',
        setups: [], // Platzhalter
        images: []
      }));

      setTrades(mappedTrades);
    } catch (err: any) {
      console.error('Ladefehler:', err);
      showToast('Fehler beim Laden der Trades', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTradesFromSupabase();
    loadConfigs();
  }, []);

  // ============================================================
  // 2. SPEICHERN (ROBUST & MIT DEBUGGING)
  // ============================================================
  const handleSaveTrade = async (tradeData: Omit<Trade, 'id'> & { id?: string }) => {
    console.log("Versuche zu speichern...", tradeData);

    try {
      // FIX: Wir nutzen getSession() statt getUser()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error("Keine Session gefunden:", sessionError);
        showToast('Fehler: Du scheinst ausgeloggt zu sein. Bitte Seite neu laden.', 'error');
        return;
      }

      const user = session.user;
      
      // MAPPING: APP -> DB
      const dbPayload = {
  // 1. Die fehlenden Pflichtfelder (Die Ursache für deinen Fehler)
  entry_price: Number(tradeData.entryPrice), 
  exit_price: Number(tradeData.exitPrice),
  quantity: Number(tradeData.quantity),
  symbol: tradeData.pair,     // Prüfe kurz: heißt es bei dir .pair oder .symbol?
  direction: tradeData.direction,
  quantity: Number(tradeData.quantity),
  
  // 2. Deine bestehenden Felder
  date: tradeData.date,
  notes: tradeData.notes || '',
  status: 'closed',
  type: 'funded',
  
  // 3. WICHTIG: Damit der Trade dir gehört (falls nicht anders gelöst)
  // user_id: session.user.id  <-- Falls du die user_id hier griffbereit hast, füge sie ein.
};
      };

      let error;
      if (tradeData.id) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('trades')
          .update(dbPayload)
          .eq('id', tradeData.id);
        error = updateError;
      } else {
        // INSERT
        const { error: insertError } = await supabase
          .from('trades')
          .insert([dbPayload]);
        error = insertError;
      }

      if (error) {
        console.error("Supabase DB Fehler:", error);
        throw error;
      }

      showToast(tradeData.id ? 'Trade aktualisiert' : 'Trade gespeichert', 'success');
      setShowTradeForm(false);
      setEditingTrade(undefined);
      loadTradesFromSupabase(); // Liste neu laden
      await loadConfigs(); // Balance update

    } catch (error: any) {
      console.error('Speicherfehler Details:', error);
      showToast('Speichern fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler'), 'error');
    }
  };

  // ============================================================
  // 3. LÖSCHEN (AUS SUPABASE)
  // ============================================================
  const handleDeleteTrade = async (trade: Trade) => {
    if (confirm(`Trade vom ${trade.date} wirklich löschen?`)) {
      try {
        const { error } = await supabase
          .from('trades')
          .delete()
          .eq('id', trade.id);

        if (error) throw error;

        showToast('Trade erfolgreich gelöscht', 'success');
        setTrades(prev => prev.filter(t => t.id !== trade.id));
      } catch (error) {
        console.error("Löschfehler:", error);
        showToast('Fehler beim Löschen', 'error');
      }
    }
  };

  // ============================================================
  // 4. FILTERING & UI
  // ============================================================
  const getFilteredTrades = () => {
    return trades.filter(trade => {
      // Result Filter
      if (filters.result && filters.result !== 'all' && trade.result !== filters.result) return false;
      // Pair Filter
      if (filters.pair && filters.pair !== 'all' && trade.pair !== filters.pair) return false;
      return true;
    });
  };

  const filteredTrades = getFilteredTrades();
  const fundedConfig = configs?.funded;

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

  // ============================================================
  // 5. RENDER
  // ============================================================
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <h1 className="page-title">
            <DollarSign className="text-accent-primary" />
            Funded Journal <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded ml-2">CLOUD</span>
          </h1>
          {fundedConfig && (
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-border">
              <div>
                <span className="text-sm text-text-muted">Balance: </span>
                <span className="font-semibold text-accent-primary">
                  ${fundedConfig.currentBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
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
            onClick={loadTradesFromSupabase}
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

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="grid grid-cols-4 gap-4">
            {/* Result Filter */}
            <div>
              <label className="input-label">Ergebnis</label>
              <select
                className="select"
                value={filters.result || 'all'}
                onChange={(e) => setFilters({ result: e.target.value as any })}
              >
                <option value="all">Alle</option>
                <option value="win">Wins</option>
                <option value="loss">Losses</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </div>

            {/* Pair Filter */}
            <div>
              <label className="input-label">Währungspaar</label>
              <select
                className="select"
                value={filters.pair || 'all'}
                onChange={(e) => setFilters({ pair: e.target.value })}
              >
                <option value="all">Alle Paare</option>
                {PAIR_LIST.map(pair => (
                  <option key={pair} value={pair}>{pair}</option>
                ))}
              </select>
            </div>

            {/* Setup Filters */}
            <div className="col-span-2">
              <label className="input-label">Setups</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SETUP_DEFINITIONS).map(([key, setup]) => (
                  <button
                    key={key}
                    onClick={() => setFilters({ [key]: !filters[key as keyof typeof filters] })}
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

          {/* Reset Filters */}
          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <button onClick={resetFilters} className="btn-ghost">
              Filter zurücksetzen
            </button>
          </div>
        </div>
      )}

      {/* Trade Count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-muted">
          {filteredTrades.length} {filteredTrades.length === 1 ? 'Trade' : 'Trades'} gefunden
        </p>
      </div>

      {/* Trades Display */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={32} className="animate-spin text-accent-primary" />
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-glass-accent flex items-center justify-center">
            <DollarSign size={40} className="text-accent-primary" />
          </div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">Keine Trades gefunden</h3>
          <p className="text-text-muted mb-6 max-w-md mx-auto">
            Starte mit deinem ersten Cloud-Trade!
          </p>
          <button className="btn-primary" onClick={() => setShowTradeForm(true)}>
            <Plus size={18} />
            Neuer Trade
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {filteredTrades.map(trade => (
            <TradeCard
              key={trade.id}
              trade={trade}
              onEdit={handleEditTrade}
              onDelete={handleDeleteTrade}
              onView={handleViewTrade}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card p-0 overflow-hidden">
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
                      <span className={clsx('badge', trade.result === 'win' ? 'badge-success' : trade.result === 'loss' ? 'badge-danger' : 'badge-neutral')}>
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
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleViewTrade(trade)}
                          className="btn-ghost py-1 px-3 text-sm"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade Form Modal */}
      {showTradeForm && (
        <TradeForm
          trade={editingTrade}
          accountType="funded"
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
  );
}