/**
 * ========================================================================
 * Trading Journal - Electron Preload Script
 * ========================================================================
 * 
 * Sichere Brücke zwischen Main Process (Node.js) und Renderer (React).
 * Implementiert die ElectronAPI Schnittstelle aus electron.d.ts
 * 
 * WICHTIG: Alle Funktionen verwenden den benutzerdefinierten Speicherpfad!
 */

import { contextBridge, ipcRenderer } from 'electron';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface Trade {
  id: string;
  type: 'ek' | 'funded';
  pair: string;
  direction: 'long' | 'short';
  date: string;
  result: 'win' | 'loss' | 'breakeven';
  rMultiple: number;
  riskPercent?: number;
  notes?: string;
  sessionType: 'live' | 'backtest';
  setup_daily_bos?: boolean;
  setup_value_area?: boolean;
  setup_market_structure?: boolean;
  setup_weekly_gva?: boolean;
  setup_3day_gva?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AccountConfig {
  initialStartBalance: number;
  currentBalance: number;
  currency: string;
  type: 'ek' | 'funded';
  defaultRiskPerTrade: number;
  enableGoals?: boolean;
  profitTargetValue?: number;
  profitTargetType?: 'percent' | 'absolute';
  maxDrawdownValue?: number;
  maxDrawdownType?: 'percent' | 'absolute';
  profitTarget?: number;
  maxDrawdown?: number;
}

interface MarketData {
  cotData: any[];
  newsData: any[];
  interestRates: any[];
}

interface TradeFilters {
  type?: 'funded' | 'ek';
  startDate?: string;
  endDate?: string;
  pair?: string;
  result?: 'win' | 'loss' | 'breakeven';
}

interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

interface OpenDialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: string[];
}

// ============================================================
// ELECTRON API - Contract Implementation
// ============================================================

const electronAPI = {
  // ────────────────────────────────────────────────────────────
  // STORAGE PATH MANAGEMENT (Herzstück für Google Drive Sync)
  // ────────────────────────────────────────────────────────────

  /**
   * Gibt den aktuellen Speicherpfad zurück.
   * Standard: userData, oder benutzerdefinierter Ordner (z.B. Google Drive)
   */
  getStoragePath: (): Promise<string> =>
    ipcRenderer.invoke('getStoragePath'),

  /**
   * Öffnet einen Ordner-Auswahl-Dialog.
   * Gibt den gewählten Pfad zurück oder null bei Abbruch.
   */
  setStoragePath: (): Promise<string | null> =>
    ipcRenderer.invoke('setStoragePath'),

  // ────────────────────────────────────────────────────────────
  // TRADE OPERATIONS
  // ────────────────────────────────────────────────────────────

  loadTrades: (filters?: TradeFilters): Promise<Trade[]> =>
    ipcRenderer.invoke('loadTrades', filters),

  saveTrade: (trade: Omit<Trade, 'id'> & { id?: string }): Promise<Trade> =>
    ipcRenderer.invoke('saveTrade', trade),

  deleteTrade: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('deleteTrade', id),

  // ────────────────────────────────────────────────────────────
  // ACCOUNT OPERATIONS
  // ────────────────────────────────────────────────────────────

  loadAccountConfig: (): Promise<{ funded: AccountConfig; ek: AccountConfig }> =>
    ipcRenderer.invoke('loadAccountConfig'),

  saveAccountConfig: (config: AccountConfig): Promise<void> =>
    ipcRenderer.invoke('saveAccountConfig', config),

  // ────────────────────────────────────────────────────────────
  // MARKET DATA
  // ────────────────────────────────────────────────────────────

  loadMarketData: (): Promise<MarketData> =>
    ipcRenderer.invoke('loadMarketData'),

  saveMarketData: (data: MarketData): Promise<void> =>
    ipcRenderer.invoke('saveMarketData', data),

  // ────────────────────────────────────────────────────────────
  // SCREENSHOT OPERATIONS (Speichert im benutzerdefinierten Ordner!)
  // ────────────────────────────────────────────────────────────

  /**
   * Speichert einen Screenshot für einen Trade.
   * @param tradeId - Die ID des Trades
   * @param imageData - Base64-kodiertes Bild (data:image/png;base64,...)
   * @returns Der Dateipfad zum gespeicherten Screenshot
   */
  saveScreenshot: (tradeId: string, imageData: string): Promise<string> =>
    ipcRenderer.invoke('saveScreenshot', tradeId, imageData),

  /**
   * Lädt einen Screenshot für einen Trade.
   * @param tradeId - Die ID des Trades
   * @returns Base64-kodiertes Bild oder null
   */
  loadScreenshot: (tradeId: string): Promise<string | null> =>
    ipcRenderer.invoke('loadScreenshot', tradeId),

  /**
   * Löscht einen Screenshot.
   * @param tradeId - Die ID des Trades
   * @returns true wenn gelöscht, false wenn nicht gefunden
   */
  deleteScreenshot: (tradeId: string): Promise<boolean> =>
    ipcRenderer.invoke('deleteScreenshot', tradeId),

  // ────────────────────────────────────────────────────────────
  // BACKUP / EXPORT OPERATIONS
  // ────────────────────────────────────────────────────────────

  exportDatabase: (): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('exportDatabase'),

  importDatabase: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('importDatabase'),

  // ────────────────────────────────────────────────────────────
  // SYSTEM OPERATIONS
  // ────────────────────────────────────────────────────────────

  getAppPath: (): Promise<string> =>
    ipcRenderer.invoke('getAppPath'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('openExternal', url),

  showSaveDialog: (options: SaveDialogOptions): Promise<{ canceled: boolean; filePath?: string }> =>
    ipcRenderer.invoke('showSaveDialog', options),

  showOpenDialog: (options: OpenDialogOptions): Promise<{ canceled: boolean; filePaths?: string[] }> =>
    ipcRenderer.invoke('showOpenDialog', options),

  // ────────────────────────────────────────────────────────────
  // EXTERNAL API CALLS (über Main Process - kein CORS!)
  // ────────────────────────────────────────────────────────────

  /**
   * COT-Daten von CFTC laden (über Main Process)
   */
  fetchCOTData: (): Promise<{
    success: boolean;
    data: any[];
    history: Record<string, any[]>;
    error?: string;
  }> => ipcRenderer.invoke('fetchCOTData'),

  fetchForexPrices: (startDate?: string): Promise<{
    success: boolean;
    data?: Record<string, Array<{ date: string; price: number }>>;
    error?: string;
  }> => ipcRenderer.invoke('fetchForexPrices', startDate),

  /**
   * Wirtschaftskalender laden
   */
  fetchEconomicCalendar: (): Promise<{
    success: boolean;
    source?: string;
    data: any[];
    error?: string;
  }> => ipcRenderer.invoke('fetchEconomicCalendar'),

  /**
   * Aktuelle Zentralbank-Zinssätze laden
   */
  fetchInterestRates: (): Promise<{
    success: boolean;
    data: Record<string, any>;
    error?: string;
  }> => ipcRenderer.invoke('fetchInterestRates'),

  // ────────────────────────────────────────────────────────────
  // AUTH CALLBACK (für Magic Link Deep Links)
  // ────────────────────────────────────────────────────────────

  /**
   * Listener für Supabase Auth Callback (Magic Link)
   */
  onAuthCallback: (callback: (tokens: { access_token: string; refresh_token: string }) => void) => {
    const handler = (_event: any, tokens: { access_token: string; refresh_token: string }) => {
      callback(tokens);
    };
    ipcRenderer.on('supabase-auth-callback', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('supabase-auth-callback', handler);
  },
};

// ============================================================
// EXPOSE API TO RENDERER
// ============================================================

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ============================================================
// TYPE EXPORT
// ============================================================

export type ElectronAPI = typeof electronAPI;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
