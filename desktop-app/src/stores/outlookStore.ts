/**
 * ========================================================================
 * Trading Journal - Outlook Store (Zustand)
 * ========================================================================
 * 
 * State Management für Trading-Thesen (Outlooks).
 * Mit localStorage Persistenz und COT/News Integration.
 */

import { create } from 'zustand';
import type { Outlook, OutlookStatus, CurrencyBias } from '@/types';
import * as outlookService from '@/services/outlookService';
import { updateOne as supabaseUpdateOne } from '@/services/supabaseService';
import { isElectron } from '@/services/webApi';

// ============================================================
// COT Data Interface (from localStorage cache)
// ============================================================

interface CachedCOTData {
  currency: string;
  signal: 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short';
  percentileRank: number;
}

// ============================================================
// News Event Interface (for filtering)
// ============================================================

export interface UpcomingNewsEvent {
  id: string;
  date: string;
  time: string;
  currency: string;
  impact: 'low' | 'medium' | 'high';
  event: string;
  forecast?: string;
  previous?: string;
}

// ============================================================
// Filters
// ============================================================

export interface OutlookFilters {
  status: OutlookStatus | 'all';
  direction: 'long' | 'short' | 'all';
  sortBy: 'date' | 'confidence' | 'symbol';
  sortOrder: 'asc' | 'desc';
  showArchived: boolean;
}

// ============================================================
// Store Interface
// ============================================================

interface OutlookState {
  // Data
  outlooks: Outlook[];
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: OutlookFilters;
  
  // Selected outlook for editing
  selectedOutlook: Outlook | null;
  
  // Modal states
  isFormOpen: boolean;
  
  // Prefill data for journal transfer
  prefillTradeData: Partial<{
    pair: string;
    direction: 'long' | 'short';
    notes: string;
    outlookId: string;
    targetAccounts: ('ek' | 'funded')[];
  }> | null;
  
  // Actions
  loadOutlooks: () => void;
  saveOutlook: (outlook: Partial<Outlook>) => Outlook;
  updateOutlook: (id: string, updates: Partial<Outlook>) => void;
  deleteOutlook: (id: string) => void;
  setStatus: (id: string, status: OutlookStatus) => void;
  
  // Form actions
  openForm: (outlook?: Outlook) => void;
  closeForm: () => void;
  
  // Filter actions
  setFilters: (filters: Partial<OutlookFilters>) => void;
  resetFilters: () => void;
  
  // Computed
  getFilteredOutlooks: () => Outlook[];
  getActiveOutlooks: () => Outlook[];
  
  // COT Integration
  getCOTBias: (symbol: string) => Outlook['cotBias'] | null;
  refreshCOTBias: (id: string) => void;
  
  // Journal Integration
  transferToJournal: (id: string) => void;
  clearPrefillData: () => void;

  // Trade Start / Close
  startTrade: (id: string) => void;
  closeTrade: (id: string, accounts: ('ek' | 'funded')[]) => void;
  
  // Star System
  toggleStar: (id: string) => void;
  getStarredOutlooks: () => Outlook[];

  // Export / Import
  exportOutlooks: () => string;
  importOutlooks: (jsonString: string, overwrite?: boolean) => { success: boolean; count: number; error?: string };
  downloadExport: () => void;
}

// ============================================================
// Storage Keys
// ============================================================

const STORAGE_KEY = 'tradingJournal_outlooks';

// Check if we should skip Supabase calls (Electron or offline mode)
const isOfflineMode = (): boolean => {
  try {
    return isElectron() || localStorage.getItem('trading-journal-offline-mode') === 'true';
  } catch {
    return true;
  }
};

// ============================================================
// Helper Functions
// ============================================================

// WICHTIG: Supabase-Spalte outlooks.id ist Typ uuid.
// Daher echte UUIDs erzeugen, sonst schlägt der Sync mit
// "invalid input syntax for type uuid" fehl.
const generateId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to manual uuid */
  }
  // Fallback: RFC4122 v4 UUID manuell
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const loadFromStorage = (): Outlook[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    console.error('Error loading outlooks from storage');
    return [];
  }
};

const saveToStorage = (outlooks: Outlook[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outlooks));
  } catch (error) {
    console.error('Error saving outlooks to storage:', error);
  }
};

// Parse currency pair into base and quote
const parsePair = (symbol: string): { base: string; quote: string } => {
  // Handle both formats: EURUSD and EUR/USD
  const cleanSymbol = symbol.replace('/', '');
  return {
    base: cleanSymbol.slice(0, 3).toUpperCase(),
    quote: cleanSymbol.slice(3, 6).toUpperCase()
  };
};

// Get COT data from localStorage cache
const getCachedCOTData = (): CachedCOTData[] => {
  try {
    const cached = localStorage.getItem('cotData');
    if (!cached) return [];
    return JSON.parse(cached);
  } catch {
    return [];
  }
};

// Calculate divergence score (-100 to +100)
const calculateDivergenceScore = (base: CurrencyBias | null, quote: CurrencyBias | null): number => {
  if (!base || !quote) return 0;
  
  // Convert signals to numeric values
  const signalValue = (signal: CurrencyBias['signal']): number => {
    const values = { strong_long: 2, long: 1, neutral: 0, short: -1, strong_short: -2 };
    return values[signal] || 0;
  };
  
  const baseBias = signalValue(base.signal);
  const quoteBias = signalValue(quote.signal);
  
  // Divergence is base bias minus quote bias, normalized to percentage
  // For LONG: we want base strong, quote weak (positive divergence)
  // For SHORT: we want base weak, quote strong (negative divergence)
  return Math.round((baseBias - quoteBias) * 25); // Scale to roughly -100 to +100
};

// ============================================================
// Default Filters
// ============================================================

const defaultFilters: OutlookFilters = {
  status: 'all',
  direction: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
  showArchived: false,
};

// ============================================================
// Store Implementation
// ============================================================

export const useOutlookStore = create<OutlookState>((set, get) => ({
  // Initial State
  outlooks: [],
  isLoading: false,
  error: null,
  filters: defaultFilters,
  selectedOutlook: null,
  isFormOpen: false,
  prefillTradeData: null,
  
  // Load Outlooks from Supabase (fallback localStorage)
  loadOutlooks: () => {
    set({ isLoading: true });

    if (isOfflineMode()) {
      // Skip Supabase in offline/Electron mode
      const outlooks = loadFromStorage();
      set({ outlooks, isLoading: false, error: null });
      return;
    }

    outlookService.loadOutlooks()
      .then(remote => {
        // Merge: lokale Outlooks dürfen NIE verschwinden, nur weil
        // Supabase (noch) leer ist oder ein Sync fehlschlug.
        const local = loadFromStorage();
        const byId = new Map<string, Outlook>();
        // Erst lokal, dann remote drüber (remote = source of truth, falls vorhanden)
        for (const o of local) byId.set(o.id, o);
        for (const o of (remote as unknown as Outlook[])) byId.set(o.id, o);
        const merged = Array.from(byId.values());
        saveToStorage(merged);
        set({ outlooks: merged, isLoading: false, error: null });
      })
      .catch(() => {
        // Fallback to localStorage
        try {
          const outlooks = loadFromStorage();
          set({ outlooks, isLoading: false, error: null });
        } catch {
          set({ error: 'Fehler beim Laden der Outlooks', isLoading: false });
        }
      });
  },

  // Save New Outlook
  saveOutlook: (outlookData) => {
    const isNew = !outlookData.id;
    const now = new Date().toISOString();

    const outlook: Outlook = {
      id: outlookData.id || generateId(),
      symbol: outlookData.symbol || '',
      direction: outlookData.direction || 'long',
      thesis: outlookData.thesis || '',
      confidence: outlookData.confidence || 3,
      status: outlookData.status || 'observation',
      cotBias: outlookData.cotBias,
      tags: outlookData.tags || [],
      targetEntry: outlookData.targetEntry,
      targetSL: outlookData.targetSL,
      targetTP: outlookData.targetTP,
      interestingZone: outlookData.interestingZone,
      imageData: outlookData.imageData,
      expiresAt: outlookData.expiresAt,
      createdAt: outlookData.createdAt || now,
      updatedAt: now,
      executedTradeId: outlookData.executedTradeId,
      isStarred: outlookData.isStarred ?? false,
      setupId: outlookData.setupId,
      strategyChecklist: outlookData.strategyChecklist,
      fundamentalOutlook: outlookData.fundamentalOutlook,
    };

    // Auto-populate COT bias if not provided
    if (!outlook.cotBias && outlook.symbol) {
      const cotBias = get().getCOTBias(outlook.symbol);
      if (cotBias) {
        outlook.cotBias = cotBias;
      }
    }

    // Update state optimistically
    set(state => {
      let newOutlooks: Outlook[];
      if (isNew) {
        newOutlooks = [...state.outlooks, outlook];
      } else {
        newOutlooks = state.outlooks.map(o =>
          o.id === outlook.id ? outlook : o
        );
      }
      saveToStorage(newOutlooks);
      return { outlooks: newOutlooks };
    });

    // Persist to Supabase in background (skip in offline mode)
    // Lokaler Save ist bereits erfolgt — Supabase-Fehler ist nicht kritisch
    if (!isOfflineMode()) {
      const payload: Record<string, any> = {
        id: outlook.id,
        symbol: outlook.symbol,
        direction: outlook.direction,
        thesis: outlook.thesis,
        confidence: outlook.confidence,
        status: outlook.status,
        cotBias: outlook.cotBias,
        tags: outlook.tags ?? [],
        targetEntry: outlook.targetEntry,
        targetSl: outlook.targetSL,
        targetTp: outlook.targetTP,
        interestingZone: outlook.interestingZone,
        imageData: outlook.imageData,
        expiresAt: outlook.expiresAt,
        executedTradeId: outlook.executedTradeId,
        isStarred: outlook.isStarred ?? false,
        setupId: outlook.setupId,
        strategyChecklist: outlook.strategyChecklist ?? [],
        fundamentalOutlook: outlook.fundamentalOutlook ?? '',
      };
      outlookService.saveOutlook(payload as any).catch(err =>
        console.warn('Outlook Supabase-Sync übersprungen (lokal gespeichert):', err?.message || err)
      );
    }

    return outlook;
  },

  // Update Existing Outlook
  updateOutlook: (id, updates) => {
    set(state => {
      const newOutlooks = state.outlooks.map(outlook => {
        if (outlook.id === id) {
          return {
            ...outlook,
            ...updates,
            updatedAt: new Date().toISOString()
          };
        }
        return outlook;
      });
      saveToStorage(newOutlooks);
      return { outlooks: newOutlooks };
    });

    // Persist to Supabase (skip in offline mode)
    if (!isOfflineMode()) {
      const updated = get().outlooks.find(o => o.id === id);
      if (updated) {
        outlookService.saveOutlook(updated as any).catch(err =>
          console.error('Supabase outlook update failed:', err)
        );
      }
    }
  },

  // Delete Outlook
  deleteOutlook: (id) => {
    set(state => {
      const newOutlooks = state.outlooks.filter(o => o.id !== id);
      saveToStorage(newOutlooks);
      return { outlooks: newOutlooks };
    });

    // Delete from Supabase (skip in offline mode)
    if (!isOfflineMode()) {
      outlookService.removeOutlook(id).catch(err =>
        console.error('Supabase outlook delete failed:', err)
      );
    }
  },
  
  // Set Status
  setStatus: (id, status) => {
    get().updateOutlook(id, { status });
  },
  
  // Form Actions
  openForm: (outlook) => {
    set({ 
      isFormOpen: true, 
      selectedOutlook: outlook || null 
    });
  },
  
  closeForm: () => {
    set({ 
      isFormOpen: false, 
      selectedOutlook: null 
    });
  },
  
  // Filter Actions
  setFilters: (newFilters) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },
  
  resetFilters: () => {
    set({ filters: defaultFilters });
  },
  
  // Get Filtered Outlooks
  getFilteredOutlooks: () => {
    const { outlooks, filters } = get();
    
    let filtered = outlooks.filter(outlook => {
      // Status filter
      if (filters.status !== 'all' && outlook.status !== filters.status) {
        return false;
      }
      
      // Direction filter
      if (filters.direction !== 'all' && outlook.direction !== filters.direction) {
        return false;
      }
      
      // Archive filter (hide cancelled and executed if not showing archived)
      if (!filters.showArchived && (outlook.status === 'cancelled' || outlook.status === 'executed')) {
        return false;
      }
      
      return true;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'confidence':
          comparison = b.confidence - a.confidence;
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
      }
      
      return filters.sortOrder === 'desc' ? comparison : -comparison;
    });
    
    return filtered;
  },
  
  // Get Active Outlooks (for quick access)
  getActiveOutlooks: () => {
    return get().outlooks.filter(o => 
      o.status === 'active' || o.status === 'waiting'
    );
  },
  
  // Get COT Bias for Symbol
  getCOTBias: (symbol) => {
    const cotData = getCachedCOTData();
    if (cotData.length === 0) return null;
    
    const { base, quote } = parsePair(symbol);
    
    const baseData = cotData.find(d => d.currency === base);
    const quoteData = cotData.find(d => d.currency === quote);
    
    if (!baseData && !quoteData) return null;
    
    const baseBias: CurrencyBias | null = baseData ? {
      currency: base,
      signal: baseData.signal,
      percentile: baseData.percentileRank
    } : null;
    
    const quoteBias: CurrencyBias | null = quoteData ? {
      currency: quote,
      signal: quoteData.signal,
      percentile: quoteData.percentileRank
    } : null;
    
    return {
      base: baseBias || { currency: base, signal: 'neutral' as const, percentile: 50 },
      quote: quoteBias || { currency: quote, signal: 'neutral' as const, percentile: 50 },
      divergenceScore: calculateDivergenceScore(baseBias, quoteBias)
    };
  },
  
  // Refresh COT Bias for Specific Outlook
  refreshCOTBias: (id) => {
    const outlook = get().outlooks.find(o => o.id === id);
    if (!outlook) return;
    
    const cotBias = get().getCOTBias(outlook.symbol);
    if (cotBias) {
      get().updateOutlook(id, { cotBias });
    }
  },
  
  // Transfer Outlook to Journal
  transferToJournal: (id) => {
    const outlook = get().outlooks.find(o => o.id === id);
    if (!outlook) return;
    
    // Format symbol for TradeForm (with slash)
    const formattedPair = outlook.symbol.includes('/') 
      ? outlook.symbol 
      : `${outlook.symbol.slice(0, 3)}/${outlook.symbol.slice(3)}`;
    
    // Prepare notes with thesis and COT info
    let notes = `📊 OUTLOOK TRANSFER\n\nThesis: ${outlook.thesis}`;
    
    if (outlook.cotBias) {
      notes += `\n\nCOT Bias:`;
      notes += `\n- ${outlook.cotBias.base.currency}: ${outlook.cotBias.base.signal.replace('_', ' ').toUpperCase()} (${outlook.cotBias.base.percentile}%)`;
      notes += `\n- ${outlook.cotBias.quote.currency}: ${outlook.cotBias.quote.signal.replace('_', ' ').toUpperCase()} (${outlook.cotBias.quote.percentile}%)`;
      notes += `\n- Divergenz-Score: ${outlook.cotBias.divergenceScore > 0 ? '+' : ''}${outlook.cotBias.divergenceScore}%`;
    }
    
    if (outlook.tags && outlook.tags.length > 0) {
      notes += `\n\nTags: ${outlook.tags.join(', ')}`;
    }
    
    if (outlook.confidence) {
      notes += `\n\nConfidence: ${'⭐'.repeat(outlook.confidence)}`;
    }
    
    // Set prefill data
    set({
      prefillTradeData: {
        pair: formattedPair,
        direction: outlook.direction,
        notes: notes,
        outlookId: outlook.id
      }
    });
    
    // Update outlook status
    get().updateOutlook(id, { status: 'executed' });
  },
  
  // Clear Prefill Data
  clearPrefillData: () => {
    set({ prefillTradeData: null });
  },

  // Start Trade: set status to active and record startedAt
  startTrade: (id) => {
    get().updateOutlook(id, {
      status: 'active',
      startedAt: new Date().toISOString(),
    });
  },

  // Close Trade: journal to selected accounts and mark as executed
  closeTrade: (id, accounts) => {
    const outlook = get().outlooks.find(o => o.id === id);
    if (!outlook) return;

    const formattedPair = outlook.symbol.includes('/')
      ? outlook.symbol
      : `${outlook.symbol.slice(0, 3)}/${outlook.symbol.slice(3)}`;

    let notes = `📊 OUTLOOK TRANSFER\n\nThesis: ${outlook.thesis}`;
    if (outlook.cotBias) {
      notes += `\n\nCOT Bias:`;
      notes += `\n- ${outlook.cotBias.base.currency}: ${outlook.cotBias.base.signal.replace('_', ' ').toUpperCase()} (${outlook.cotBias.base.percentile}%)`;
      notes += `\n- ${outlook.cotBias.quote.currency}: ${outlook.cotBias.quote.signal.replace('_', ' ').toUpperCase()} (${outlook.cotBias.quote.percentile}%)`;
    }
    if (outlook.tags && outlook.tags.length > 0) {
      notes += `\n\nTags: ${outlook.tags.join(', ')}`;
    }
    if (outlook.confidence) {
      notes += `\n\nConfidence: ${'⭐'.repeat(outlook.confidence)}`;
    }

    // Store prefill + target accounts so the page can navigate
    set({
      prefillTradeData: {
        pair: formattedPair,
        direction: outlook.direction,
        notes,
        outlookId: outlook.id,
        targetAccounts: accounts,
      },
    });

    get().updateOutlook(id, {
      status: 'executed',
      journaledTo: accounts,
    });
  },

  // ============================================================
  // Star System
  // ============================================================

  toggleStar: (id: string) => {
    const { outlooks } = get();
    const updated = outlooks.map(o =>
      o.id === id ? { ...o, isStarred: !o.isStarred } : o
    );
    set({ outlooks: updated });
    saveToStorage(updated);
    const outlook = updated.find(o => o.id === id);
    if (outlook && !isOfflineMode()) {
      supabaseUpdateOne('outlooks', id, { isStarred: outlook.isStarred }).catch(console.error);
    }
  },

  getStarredOutlooks: (): Outlook[] => {
    return get().outlooks.filter(o => o.isStarred && o.status !== 'cancelled' && o.status !== 'executed');
  },

  // Export / Import Functions
  // ============================================================

  // Export all outlooks to JSON
  exportOutlooks: (): string => {
    const { outlooks } = get();
    const exportData = {
      version: '1.0',
      type: 'tradingJournal_outlooks',
      exportedAt: new Date().toISOString(),
      count: outlooks.length,
      data: outlooks
    };
    return JSON.stringify(exportData, null, 2);
  },

  // Import outlooks from JSON (merges with existing)
  importOutlooks: (jsonString: string, overwrite: boolean = false): { success: boolean; count: number; error?: string } => {
    try {
      const importData = JSON.parse(jsonString);
      
      // Validate structure
      if (!importData.type || importData.type !== 'tradingJournal_outlooks') {
        return { success: false, count: 0, error: 'Invalid file format. Expected outlooks export file.' };
      }
      
      if (!Array.isArray(importData.data)) {
        return { success: false, count: 0, error: 'Invalid data structure. Expected array of outlooks.' };
      }
      
      const importedOutlooks: Outlook[] = importData.data.map((item: Outlook) => ({
        ...item,
        // Generate new ID to avoid conflicts if not overwriting
        id: overwrite ? item.id : generateId(),
        // Ensure dates are valid
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      const currentOutlooks = get().outlooks;
      
      if (overwrite) {
        // Replace all existing outlooks
        set({ outlooks: importedOutlooks });
      } else {
        // Merge - add imported outlooks to existing
        set({ outlooks: [...currentOutlooks, ...importedOutlooks] });
      }
      
      // Persist to storage
      saveToStorage(overwrite ? importedOutlooks : [...currentOutlooks, ...importedOutlooks]);
      
      return { success: true, count: importedOutlooks.length };
    } catch (error) {
      return { success: false, count: 0, error: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },

  // Download export file
  downloadExport: (): void => {
    const jsonString = get().exportOutlooks();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradingJournal_outlooks_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}));

// ============================================================
// Utility Functions for News Integration
// ============================================================

export const getUpcomingHighImpactNews = (
  currencies: string[],
  events: UpcomingNewsEvent[],
  limit: number = 3
): UpcomingNewsEvent[] => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  return events
    .filter(event => {
      // Only high impact
      if (event.impact !== 'high') return false;
      
      // Only for specified currencies
      if (!currencies.some(c => event.currency === c)) return false;
      
      // Only upcoming (today or future)
      if (event.date < todayStr) return false;
      
      // If today, check if time is in future
      if (event.date === todayStr) {
        const eventTime = event.time.split(':');
        const eventDate = new Date();
        eventDate.setHours(parseInt(eventTime[0]), parseInt(eventTime[1]), 0, 0);
        if (eventDate < now) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by date, then time
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    })
    .slice(0, limit);
};

// Helper to get currencies from symbol
export const getCurrenciesFromSymbol = (symbol: string): string[] => {
  const { base, quote } = parsePair(symbol);
  return [base, quote];
};
