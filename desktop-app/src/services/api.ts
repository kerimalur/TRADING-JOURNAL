/**
 * ========================================================================
 * Trading Journal - Service Layer
 * ========================================================================
 * 
 * Abstraktionsschicht für Electron IPC und externe APIs.
 * Zentralisiert alle Datenoperationen mit Validierung.
 */

import { z } from 'zod';
import { 
  TradeSchema, 
  AccountConfigSchema, 
  validateCotApiResponse,
  type ValidatedTrade,
  type ValidatedAccountConfig,
} from '@/config/schemas';
import { API, CFTC_CODES } from '@/config/constants';

// ============================================================
// TRADE SERVICE
// ============================================================

export const tradeService = {
  async loadAll(filters?: { type?: 'ek' | 'funded' }): Promise<ValidatedTrade[]> {
    try {
      const trades = await window.electronAPI.loadTrades(filters || {});
      // Validiere jeden Trade
      return trades.filter((trade: unknown) => {
        const result = TradeSchema.safeParse(trade);
        if (!result.success) {
          console.warn('Invalid trade data:', result.error);
        }
        return result.success;
      }) as ValidatedTrade[];
    } catch (error) {
      console.error('Error loading trades:', error);
      throw new Error('Fehler beim Laden der Trades');
    }
  },

  async save(trade: Partial<ValidatedTrade>, screenshot?: string | null): Promise<ValidatedTrade | null> {
    try {
      const savedTrade = await window.electronAPI.saveTrade(trade as any);
      
      if (savedTrade && screenshot) {
        await window.electronAPI.saveScreenshot(String(savedTrade.id), screenshot);
      }
      
      const result = TradeSchema.safeParse(savedTrade);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error saving trade:', error);
      throw new Error('Fehler beim Speichern des Trades');
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await window.electronAPI.deleteScreenshot(id);
      return await window.electronAPI.deleteTrade(id);
    } catch (error) {
      console.error('Error deleting trade:', error);
      throw new Error('Fehler beim Löschen des Trades');
    }
  },

  async loadScreenshot(tradeId: string): Promise<string | null> {
    try {
      return await window.electronAPI.loadScreenshot(tradeId);
    } catch (error) {
      console.error('Error loading screenshot:', error);
      return null;
    }
  },

  async saveScreenshot(tradeId: string, data: string): Promise<boolean> {
    try {
      await window.electronAPI.saveScreenshot(tradeId, data);
      return true;
    } catch (error) {
      console.error('Error saving screenshot:', error);
      return false;
    }
  },
};

// ============================================================
// ACCOUNT SERVICE
// ============================================================

export const accountService = {
  async loadConfig(): Promise<{ ek: ValidatedAccountConfig; funded: ValidatedAccountConfig } | null> {
    try {
      const config = await window.electronAPI.loadAccountConfig();
      if (!config) return null;
      
      const ekResult = AccountConfigSchema.safeParse(config.ek);
      const fundedResult = AccountConfigSchema.safeParse(config.funded);
      
      if (ekResult.success && fundedResult.success) {
        return { ek: ekResult.data, funded: fundedResult.data };
      }
      
      console.warn('Invalid account config:', { ek: ekResult, funded: fundedResult });
      return config;
    } catch (error) {
      console.error('Error loading account config:', error);
      throw new Error('Fehler beim Laden der Kontoeinstellungen');
    }
  },

  async saveConfig(config: ValidatedAccountConfig): Promise<boolean> {
    try {
      const result = AccountConfigSchema.safeParse(config);
      if (!result.success) {
        console.error('Invalid config data:', result.error);
        return false;
      }
      
      await window.electronAPI.saveAccountConfig(result.data as any);
      return true;
    } catch (error) {
      console.error('Error saving account config:', error);
      throw new Error('Fehler beim Speichern der Kontoeinstellungen');
    }
  },

  async getStoragePath(): Promise<string> {
    try {
      return await window.electronAPI.getStoragePath();
    } catch (error) {
      console.error('Error getting storage path:', error);
      throw new Error('Fehler beim Laden des Speicherorts');
    }
  },

  async setStoragePath(): Promise<string | null> {
    try {
      return await window.electronAPI.setStoragePath();
    } catch (error) {
      console.error('Error setting storage path:', error);
      throw new Error('Fehler beim Ändern des Speicherorts');
    }
  },
};

// ============================================================
// COT SERVICE
// ============================================================

export interface CotCurrencyData {
  currency: string;
  date: string;
  commercialsLong: number;
  commercialsShort: number;
  commercialsNet: number;
  weeklyChange: number;
  percentileRank: number;
  signal: 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short';
}

export interface CotHistoryData {
  date: string;
  net: number;
}

export const cotService = {
  async fetchCurrencyData(currencyId: string): Promise<{ data: CotCurrencyData | null; history: CotHistoryData[] }> {
    const cftcCode = CFTC_CODES[currencyId as keyof typeof CFTC_CODES];
    if (!cftcCode) {
      return { data: null, history: [] };
    }

    try {
      const response = await fetch(
        `${API.CFTC_COT}?$where=cftc_contract_market_code='${cftcCode}'&$order=report_date_as_yyyy_mm_dd DESC&$limit=${API.COT_DATA_LIMIT}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const rawData = await response.json();
      const validatedData = validateCotApiResponse(rawData);
      
      if (!validatedData || validatedData.length === 0) {
        return { data: null, history: [] };
      }

      const historicalData: CotHistoryData[] = validatedData.map((row) => ({
        date: row.report_date_as_yyyy_mm_dd,
        net: parseInt(row.comm_positions_long_all) - parseInt(row.comm_positions_short_all)
      })).reverse();

      const latest = validatedData[0];
      const previous = validatedData[1];

      const commercialsLong = parseInt(latest.comm_positions_long_all) || 0;
      const commercialsShort = parseInt(latest.comm_positions_short_all) || 0;
      const commercialsNet = commercialsLong - commercialsShort;

      const previousNet = previous 
        ? parseInt(previous.comm_positions_long_all) - parseInt(previous.comm_positions_short_all)
        : 0;
      const weeklyChange = commercialsNet - previousNet;

      const sortedNets = [...historicalData].map(d => d.net).sort((a, b) => a - b);
      const rank = sortedNets.findIndex(n => n >= commercialsNet);
      const percentileRank = Math.round((rank / sortedNets.length) * 100);

      let signal: CotCurrencyData['signal'] = 'neutral';
      if (percentileRank >= 80) signal = 'strong_long';
      else if (percentileRank >= 60) signal = 'long';
      else if (percentileRank <= 20) signal = 'strong_short';
      else if (percentileRank <= 40) signal = 'short';

      return {
        data: {
          currency: currencyId,
          date: latest.report_date_as_yyyy_mm_dd,
          commercialsLong,
          commercialsShort,
          commercialsNet,
          weeklyChange,
          percentileRank,
          signal
        },
        history: historicalData
      };
    } catch (error) {
      console.error(`Failed to fetch COT data for ${currencyId}:`, error);
      return { data: null, history: [] };
    }
  },

  async fetchAllCurrencies(): Promise<{ data: CotCurrencyData[]; history: Map<string, CotHistoryData[]> }> {
    const currencies = Object.keys(CFTC_CODES);
    const data: CotCurrencyData[] = [];
    const history = new Map<string, CotHistoryData[]>();

    for (const currency of currencies) {
      const result = await this.fetchCurrencyData(currency);
      if (result.data) {
        data.push(result.data);
        history.set(currency, result.history);
      }
    }

    return { data, history };
  },
};

// ============================================================
// EXPORT SERVICE
// ============================================================

export const exportService = {
  exportToJSON<T>(data: T, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  importFromJSON<T>(schema: z.ZodSchema<T>): Promise<T | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const result = schema.safeParse(data);
          
          if (result.success) {
            resolve(result.data);
          } else {
            console.error('Invalid import data:', result.error);
            resolve(null);
          }
        } catch (error) {
          console.error('Error importing file:', error);
          resolve(null);
        }
      };
      
      input.click();
    });
  },
};
