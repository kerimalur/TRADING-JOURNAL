/**
 * ========================================================================
 * Trading Journal - Trade Store (Zustand)
 * ========================================================================
 * 
 * Zentraler State für alle Trade-bezogenen Daten.
 * Mit Memoization für optimierte Performance.
 * Verwendet tradeService (Supabase) als Single Source of Truth.
 */

import { create } from 'zustand';
import type { Trade, TradeFilters, AccountType, DashboardMetrics } from '@/types';
import { calculateDashboardMetrics, createMemoizedCalculator } from '@/utils/calculations';
import * as tradeService from '@/services/tradeService';

interface TradeState {
  // Data
  trades: Trade[];
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: TradeFilters;
  
  // Cache invalidation
  _cacheKey: number;
  
  // Actions
  loadTrades: (accountType?: AccountType) => Promise<void>;
  saveTrade: (trade: Partial<Trade>, screenshot?: string | null) => Promise<Trade | null>;
  deleteTrade: (id: string) => Promise<boolean>;
  setFilters: (filters: Partial<TradeFilters>) => void;
  resetFilters: () => void;
  invalidateCache: () => void;
  
  // Computed
  getFilteredTrades: () => Trade[];
  getMetrics: () => DashboardMetrics;
}

const defaultFilters: TradeFilters = {
  result: 'all',
  pair: 'all',
  setup_daily_bos: false,
  setup_value_area: false,
  setup_market_structure: false,
  setup_weekly_gva: false,
  setup_3day_gva: false,
};

// Memoized metrics calculator
const memoizedMetrics = createMemoizedCalculator(calculateDashboardMetrics, 5000);

// Cache for filtered trades
let filteredTradesCache: { key: string; trades: Trade[] } | null = null;

export const useTradeStore = create<TradeState>((set, get) => ({
  // Initial State
  trades: [],
  isLoading: false,
  error: null,
  filters: defaultFilters,
  _cacheKey: 0,
  
  // Invalidate cache when data changes
  invalidateCache: () => {
    filteredTradesCache = null;
    set(state => ({ _cacheKey: state._cacheKey + 1 }));
  },

  // Load Trades
  loadTrades: async (accountType?: AccountType) => {
    set({ isLoading: true, error: null });
    
    try {
      const trades = await tradeService.loadTrades(accountType);
      get().invalidateCache();
      set({ trades: trades as Trade[], isLoading: false });
    } catch (error) {
      console.error('Error loading trades:', error);
      set({ error: 'Fehler beim Laden der Trades', isLoading: false, trades: [] });
    }
  },

  // Save Trade - gibt jetzt das Trade-Objekt zurück
  saveTrade: async (trade, screenshot) => {
    try {
      // saveTrade gibt das gespeicherte Trade zurück (mit ID)
      const savedTrade = await tradeService.saveTrade(trade as any);
      
      // Screenshot speichern wenn vorhanden (via webApi für Screenshots)
      if (savedTrade && screenshot) {
        const { getApi } = await import('@/services/webApi');
        const api = getApi();
        await api.saveScreenshot(String(savedTrade.id), screenshot);
      }
      
      // Reload trades and invalidate cache
      get().invalidateCache();
      await get().loadTrades();
      return savedTrade as Trade;
    } catch (error) {
      console.error('Error saving trade:', error);
      set({ error: 'Fehler beim Speichern des Trades' });
      return null;
    }
  },

  // Delete Trade - ID ist jetzt string
  deleteTrade: async (id: string) => {
    try {
      // Delete screenshot first (via webApi)
      const { getApi } = await import('@/services/webApi');
      const api = getApi();
      await api.deleteScreenshot(id);
      
      const success = await tradeService.deleteTrade(id);
      
      if (success) {
        get().invalidateCache();
        set(state => ({
          trades: state.trades.filter(t => String(t.id) !== id)
        }));
      }
      
      return success;
    } catch (error) {
      console.error('Error deleting trade:', error);
      set({ error: 'Fehler beim Löschen des Trades' });
      return false;
    }
  },

  // Filter Actions
  setFilters: (newFilters) => {
    filteredTradesCache = null; // Invalidate cache
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  resetFilters: () => {
    filteredTradesCache = null; // Invalidate cache
    set({ filters: defaultFilters });
  },

  // Get Filtered Trades (with caching)
  getFilteredTrades: () => {
    const { trades, filters, _cacheKey } = get();
    
    // Create cache key
    const cacheKey = `${_cacheKey}-${JSON.stringify(filters)}-${trades.length}`;
    
    // Return cached if valid
    if (filteredTradesCache && filteredTradesCache.key === cacheKey) {
      return filteredTradesCache.trades;
    }
    
    // Calculate filtered trades
    const filtered = trades.filter(trade => {
      // Result filter
      if (filters.result && filters.result !== 'all' && trade.result !== filters.result) {
        return false;
      }
      
      // Pair filter
      if (filters.pair && filters.pair !== 'all' && trade.pair !== filters.pair) {
        return false;
      }
      
      // Setup filters (ANY match)
      const setupFilters = [
        'setup_daily_bos',
        'setup_value_area', 
        'setup_market_structure',
        'setup_weekly_gva',
        'setup_3day_gva'
      ] as const;
      
      const activeSetupFilters = setupFilters.filter(key => filters[key]);
      
      if (activeSetupFilters.length > 0) {
        const hasMatchingSetup = activeSetupFilters.some(key => trade[key]);
        if (!hasMatchingSetup) return false;
      }
      
      return true;
    });
    
    // Cache result
    filteredTradesCache = { key: cacheKey, trades: filtered };
    return filtered;
  },

  // Calculate Metrics (with memoization)
  getMetrics: (): DashboardMetrics => {
    const trades = get().getFilteredTrades();
    return memoizedMetrics(trades);
  },
}));
