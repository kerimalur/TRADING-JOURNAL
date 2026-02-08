/**
 * ========================================================================
 * Trading Journal - Global Type Declarations
 * ========================================================================
 */

import type { Trade, AccountConfig, MarketData } from '@/types';

export interface ElectronAPI {
  // ────────────────────────────────────────────────────────────
  // STORAGE PATH MANAGEMENT (Herzstück für Google Drive Sync)
  // ────────────────────────────────────────────────────────────
  
  /**
   * Gibt den aktuellen Speicherpfad zurück.
   * Standard: userData, oder benutzerdefinierter Ordner (z.B. Google Drive)
   */
  getStoragePath: () => Promise<string>;
  
  /**
   * Öffnet einen Ordner-Auswahl-Dialog.
   * Gibt den gewählten Pfad zurück oder null bei Abbruch.
   */
  setStoragePath: () => Promise<string | null>;

  // ────────────────────────────────────────────────────────────
  // Trade Operations
  // ────────────────────────────────────────────────────────────
  
  loadTrades: (filters?: {
    type?: 'funded' | 'ek';
    startDate?: string;
    endDate?: string;
    pair?: string;
    result?: 'win' | 'loss' | 'breakeven';
  }) => Promise<Trade[]>;
  
  saveTrade: (trade: Omit<Trade, 'id'> & { id?: string }) => Promise<Trade>;
  deleteTrade: (id: string) => Promise<boolean>;
  
  // ────────────────────────────────────────────────────────────
  // Account Operations
  // ────────────────────────────────────────────────────────────
  
  loadAccountConfig: () => Promise<{
    funded: AccountConfig;
    ek: AccountConfig;
  }>;
  saveAccountConfig: (config: AccountConfig) => Promise<void>;
  
  // ────────────────────────────────────────────────────────────
  // Market Data
  // ────────────────────────────────────────────────────────────
  
  loadMarketData: () => Promise<MarketData>;
  saveMarketData: (data: MarketData) => Promise<void>;
  
  // ────────────────────────────────────────────────────────────
  // Screenshot Operations (Speichert im benutzerdefinierten Ordner!)
  // ────────────────────────────────────────────────────────────
  
  saveScreenshot: (tradeId: string, imageData: string) => Promise<string>;
  loadScreenshot: (tradeId: string) => Promise<string | null>;
  deleteScreenshot: (tradeId: string) => Promise<boolean>;
  
  // ────────────────────────────────────────────────────────────
  // Backup/Export Operations
  // ────────────────────────────────────────────────────────────
  
  exportDatabase: () => Promise<{ success: boolean; path?: string }>;
  importDatabase: () => Promise<{ success: boolean }>;
  
  // ────────────────────────────────────────────────────────────
  // External Data APIs (CORS-freie Aufrufe via Main Process)
  // ────────────────────────────────────────────────────────────
  
  fetchCOTData: () => Promise<{
    success: boolean;
    data?: Array<{
      currency: string;
      date: string;
      commercialsLong: number;
      commercialsShort: number;
      commercialsNet: number;
      nonCommercialsLong?: number;
      nonCommercialsShort?: number;
      nonCommercialsNet?: number;
      weeklyChange: number;
      percentileRank: number;
      signal: 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short';
      openInterest?: number;
    }>;
    history?: Record<string, Array<{ 
      date: string; 
      commercialsLong: number;
      commercialsShort: number;
      openInterest?: number;
    }>>;
    source?: string;
    lastUpdate?: string;
    error?: string;
  }>;
  
  fetchEconomicCalendar: () => Promise<{
    success: boolean;
    source?: 'forexfactory' | 'fxstreet' | 'investing' | 'scheduled';
    data?: Array<{
      id: string;
      date: string;
      time: string;
      currency: string;
      event: string;
      impact: 'high' | 'medium' | 'low';
      forecast?: string;
      previous?: string;
      actual?: string;
      url?: string;
      source?: string;
    }>;
    error?: string;
  }>;
  
  fetchInterestRates: () => Promise<{
    success: boolean;
    data?: Record<string, {
      rate: number;
      change: 'up' | 'down' | 'hold';
      next: string;
      lastMeeting?: string;
      centralBank?: string;
    }>;
    error?: string;
  }>;
  
  // ────────────────────────────────────────────────────────────
  // System
  // ────────────────────────────────────────────────────────────
  
  getAppPath: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  showSaveDialog: (options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (options: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }) => Promise<{ canceled: boolean; filePaths?: string[] }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
