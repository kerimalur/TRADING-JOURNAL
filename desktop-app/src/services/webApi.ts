/**
 * ========================================================================
 * Trading Journal - Web API Service
 * ========================================================================
 * 
 * Ersetzt Electron IPC mit localStorage für Web-Deployment.
 * Funktioniert komplett offline mit localStorage.
 * Supabase Cloud-Sync kann später hinzugefügt werden.
 */

// ============================================================
// LOCAL STORAGE KEYS
// ============================================================

const STORAGE_KEYS = {
  TRADES: 'trading-journal-trades',
  ACCOUNT_CONFIG: 'trading-journal-account-config',
  SCREENSHOTS: 'trading-journal-screenshots',
  BACKTESTS: 'trading-journal-backtests',
  STRATEGIES: 'trading-journal-strategies',
  PLAYBOOK: 'trading-journal-playbook',
  OUTLOOK: 'trading-journal-outlook',
  PAIR_NOTES: 'trading-journal-pair-notes',
  INTEREST_RATES: 'trading-journal-interest-rates-cache',
  COT: 'trading-journal-cot-cache',
  CALENDAR: 'trading-journal-calendar-cache',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('localStorage save error:', error);
  }
}

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

// ============================================================
// WEB API - TRADES
// ============================================================

export const webTradeApi = {
  async loadTrades(filters: { type?: 'ek' | 'funded' } = {}): Promise<any[]> {
    const trades = getFromStorage<any[]>(STORAGE_KEYS.TRADES, []);
    if (filters.type) {
      return trades.filter(t => t.type === filters.type);
    }
    return trades;
  },

  async saveTrade(trade: any): Promise<any> {
    const trades = getFromStorage<any[]>(STORAGE_KEYS.TRADES, []);
    const now = new Date().toISOString();
    
    if (trade.id) {
      // Update existing
      const index = trades.findIndex(t => t.id === trade.id);
      if (index !== -1) {
        trades[index] = { ...trades[index], ...trade, updatedAt: now };
        saveToStorage(STORAGE_KEYS.TRADES, trades);
        return trades[index];
      }
    }
    
    // New trade
    const newTrade = {
      ...trade,
      id: trade.id || generateId(),
      createdAt: now,
      updatedAt: now,
    };
    trades.push(newTrade);
    saveToStorage(STORAGE_KEYS.TRADES, trades);
    return newTrade;
  },

  async deleteTrade(id: string): Promise<boolean> {
    const trades = getFromStorage<any[]>(STORAGE_KEYS.TRADES, []);
    const filtered = trades.filter(t => t.id !== id);
    saveToStorage(STORAGE_KEYS.TRADES, filtered);
    return true;
  },
};

// ============================================================
// WEB API - SCREENSHOTS (Base64 in localStorage)
// ============================================================

export const webScreenshotApi = {
  async loadScreenshot(tradeId: string): Promise<string | null> {
    const screenshots = getFromStorage<Record<string, string>>(STORAGE_KEYS.SCREENSHOTS, {});
    return screenshots[tradeId] || null;
  },

  async saveScreenshot(tradeId: string, data: string): Promise<void> {
    const screenshots = getFromStorage<Record<string, string>>(STORAGE_KEYS.SCREENSHOTS, {});
    screenshots[tradeId] = data;
    saveToStorage(STORAGE_KEYS.SCREENSHOTS, screenshots);
  },

  async deleteScreenshot(tradeId: string): Promise<void> {
    const screenshots = getFromStorage<Record<string, string>>(STORAGE_KEYS.SCREENSHOTS, {});
    delete screenshots[tradeId];
    saveToStorage(STORAGE_KEYS.SCREENSHOTS, screenshots);
  },
};

// ============================================================
// WEB API - ACCOUNT CONFIG
// ============================================================

export const webAccountApi = {
  async loadAccountConfig(): Promise<any> {
    return getFromStorage(STORAGE_KEYS.ACCOUNT_CONFIG, {
      ek: {
        startingBalance: 10000,
        currentBalance: 10000,
        profitTarget: 20,
        maxDrawdown: 10,
        createdAt: new Date().toISOString(),
      },
      funded: {
        startingBalance: 100000,
        currentBalance: 100000,
        profitTarget: 10,
        maxDrawdown: 5,
        createdAt: new Date().toISOString(),
      },
    });
  },

  async saveAccountConfig(config: any): Promise<void> {
    const current = await this.loadAccountConfig();
    const updated = { ...current, ...config };
    // Handle nested update for ek/funded
    if (config.type === 'ek') {
      updated.ek = { ...current.ek, ...config };
    } else if (config.type === 'funded') {
      updated.funded = { ...current.funded, ...config };
    }
    saveToStorage(STORAGE_KEYS.ACCOUNT_CONFIG, updated);
  },

  async getStoragePath(): Promise<string> {
    return 'Browser localStorage';
  },

  async setStoragePath(): Promise<string | null> {
    // Not applicable for web
    return null;
  },
};

// ============================================================
// WEB API - BACKTESTS
// ============================================================

export const webBacktestApi = {
  async loadBacktests(): Promise<any[]> {
    return getFromStorage<any[]>(STORAGE_KEYS.BACKTESTS, []);
  },

  async saveBacktest(backtest: any): Promise<any> {
    const backtests = getFromStorage<any[]>(STORAGE_KEYS.BACKTESTS, []);
    const now = new Date().toISOString();
    
    if (backtest.id) {
      const index = backtests.findIndex(b => b.id === backtest.id);
      if (index !== -1) {
        backtests[index] = { ...backtests[index], ...backtest, updatedAt: now };
        saveToStorage(STORAGE_KEYS.BACKTESTS, backtests);
        return backtests[index];
      }
    }
    
    const newBacktest = {
      ...backtest,
      id: backtest.id || generateId(),
      createdAt: now,
      updatedAt: now,
    };
    backtests.push(newBacktest);
    saveToStorage(STORAGE_KEYS.BACKTESTS, backtests);
    return newBacktest;
  },

  async deleteBacktest(id: string): Promise<boolean> {
    const backtests = getFromStorage<any[]>(STORAGE_KEYS.BACKTESTS, []);
    saveToStorage(STORAGE_KEYS.BACKTESTS, backtests.filter(b => b.id !== id));
    return true;
  },
};

// ============================================================
// WEB API - STRATEGIES
// ============================================================

export const webStrategyApi = {
  async loadStrategies(): Promise<any[]> {
    return getFromStorage<any[]>(STORAGE_KEYS.STRATEGIES, []);
  },

  async saveStrategy(strategy: any): Promise<any> {
    const strategies = getFromStorage<any[]>(STORAGE_KEYS.STRATEGIES, []);
    const now = new Date().toISOString();
    
    if (strategy.id) {
      const index = strategies.findIndex(s => s.id === strategy.id);
      if (index !== -1) {
        strategies[index] = { ...strategies[index], ...strategy, updatedAt: now };
        saveToStorage(STORAGE_KEYS.STRATEGIES, strategies);
        return strategies[index];
      }
    }
    
    const newStrategy = {
      ...strategy,
      id: strategy.id || generateId(),
      createdAt: now,
      updatedAt: now,
    };
    strategies.push(newStrategy);
    saveToStorage(STORAGE_KEYS.STRATEGIES, strategies);
    return newStrategy;
  },

  async deleteStrategy(id: string): Promise<boolean> {
    const strategies = getFromStorage<any[]>(STORAGE_KEYS.STRATEGIES, []);
    saveToStorage(STORAGE_KEYS.STRATEGIES, strategies.filter(s => s.id !== id));
    return true;
  },
};

// ============================================================
// WEB API - OUTLOOK / PAIR NOTES
// ============================================================

export const webOutlookApi = {
  async loadOutlook(): Promise<any> {
    return getFromStorage(STORAGE_KEYS.OUTLOOK, {});
  },

  async saveOutlook(data: any): Promise<void> {
    const current = await this.loadOutlook();
    saveToStorage(STORAGE_KEYS.OUTLOOK, { ...current, ...data });
  },

  async loadPairNotes(): Promise<Record<string, any>> {
    return getFromStorage(STORAGE_KEYS.PAIR_NOTES, {});
  },

  async savePairNote(pair: string, note: any): Promise<void> {
    const notes = getFromStorage<Record<string, any>>(STORAGE_KEYS.PAIR_NOTES, {});
    notes[pair] = { ...note, updatedAt: new Date().toISOString() };
    saveToStorage(STORAGE_KEYS.PAIR_NOTES, notes);
  },
};

// ============================================================
// WEB API - EXTERNAL DATA (COT, Calendar, Interest Rates)
// ============================================================

export const webExternalApi = {
  // COT Data from CFTC
  async fetchCOTData(): Promise<any> {
    const CFTC_CODES: Record<string, string> = {
      EUR: '099741', GBP: '096742', JPY: '097741', CAD: '090741',
      AUD: '232741', NZD: '112741', CHF: '092741', USD: '098662',
    };

    try {
      const results: any[] = [];
      const historyMap: Record<string, any[]> = {};
      
      for (const [currency, code] of Object.entries(CFTC_CODES)) {
        const response = await fetch(
          `https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=${code}&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=52`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const latest = data[0];
            const previous = data[1];
            
            // Commercial positions
            const commercialsLong = parseInt(latest.comm_positions_long_all || 0);
            const commercialsShort = parseInt(latest.comm_positions_short_all || 0);
            const commercialsNet = commercialsLong - commercialsShort;
            
            // Previous week for change calculation
            const prevCommercialsNet = previous
              ? parseInt(previous.comm_positions_long_all || 0) - parseInt(previous.comm_positions_short_all || 0)
              : 0;
            const weeklyChange = commercialsNet - prevCommercialsNet;
            
            // Build history for charts
            const historicalData = data.map((row: any) => ({
              date: row.report_date_as_yyyy_mm_dd,
              commercialsLong: parseInt(row.comm_positions_long_all) || 0,
              commercialsShort: parseInt(row.comm_positions_short_all) || 0,
            })).reverse();
            
            historyMap[currency] = historicalData;
            
            // Calculate percentile rank
            const commNetHistory = data.map((row: any) => 
              parseInt(row.comm_positions_long_all || 0) - parseInt(row.comm_positions_short_all || 0)
            );
            const sortedNets = [...commNetHistory].sort((a, b) => a - b);
            const rank = sortedNets.findIndex(n => n >= commercialsNet);
            const percentileRank = Math.round((rank / Math.max(sortedNets.length, 1)) * 100);
            
            // Determine signal based on percentile
            let signal = 'neutral';
            if (percentileRank >= 80) signal = 'strong_long';
            else if (percentileRank >= 60) signal = 'long';
            else if (percentileRank <= 20) signal = 'strong_short';
            else if (percentileRank <= 40) signal = 'short';
            
            results.push({
              currency,
              date: latest.report_date_as_yyyy_mm_dd?.substring(0, 10),
              commercialsLong,
              commercialsShort,
              commercialsNet,
              weeklyChange,
              percentileRank,
              signal,
              openInterest: parseInt(latest.open_interest_all) || 0
            });
          }
        }
      }
      
      // Cache the results
      saveToStorage(STORAGE_KEYS.COT, { data: results, history: historyMap, timestamp: Date.now() });
      return { success: true, data: results, history: historyMap };
    } catch (error) {
      // Return cached data if available
      const cached = getFromStorage<any>(STORAGE_KEYS.COT, null);
      if (cached) return { success: true, data: cached.data, history: cached.history, cached: true };
      return { success: false, error: String(error) };
    }
  },

  // Economic Calendar from Forex Factory
  async fetchEconomicCalendar(): Promise<any> {
    try {
      const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.xml');
      if (!response.ok) throw new Error('Calendar fetch failed');
      
      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'text/xml');
      const events = xml.querySelectorAll('event');
      
      const calendarEvents: any[] = [];
      events.forEach((event, index) => {
        const title = event.querySelector('title')?.textContent || '';
        const country = event.querySelector('country')?.textContent || '';
        const dateStr = event.querySelector('date')?.textContent || '';
        const timeStr = event.querySelector('time')?.textContent || '';
        let impact = (event.querySelector('impact')?.textContent || '').toLowerCase();
        const forecast = event.querySelector('forecast')?.textContent || '';
        const previous = event.querySelector('previous')?.textContent || '';
        
        // Convert date from MM-DD-YYYY to ISO format
        let isoDate = '';
        if (dateStr) {
          const [month, day, year] = dateStr.split('-');
          if (month && day && year) {
            isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
        }
        
        // Convert time to 24h format
        let time24 = timeStr;
        if (timeStr && timeStr.includes('am')) {
          time24 = timeStr.replace('am', '').trim();
          const parts = time24.split(':');
          time24 = `${parts[0].padStart(2, '0')}:${parts[1] || '00'}`;
        } else if (timeStr && timeStr.includes('pm')) {
          time24 = timeStr.replace('pm', '').trim();
          const parts = time24.split(':');
          const hour = parseInt(parts[0]) === 12 ? 12 : parseInt(parts[0]) + 12;
          time24 = `${hour}:${parts[1] || '00'}`;
        }
        
        // Normalize impact
        if (impact !== 'high' && impact !== 'medium' && impact !== 'low') {
          impact = 'low';
        }
        
        calendarEvents.push({
          id: `ff-${index}`,
          event: title,
          currency: country,
          date: isoDate,
          time: time24,
          impact: impact as 'high' | 'medium' | 'low',
          forecast: forecast || undefined,
          previous: previous || undefined,
          source: 'forexfactory'
        });
      });
      
      saveToStorage(STORAGE_KEYS.CALENDAR, { data: calendarEvents, timestamp: Date.now() });
      return { success: true, data: calendarEvents, source: 'forexfactory' };
    } catch (error) {
      const cached = getFromStorage<any>(STORAGE_KEYS.CALENDAR, null);
      if (cached) return { success: true, data: cached.data, cached: true };
      return { success: false, error: String(error) };
    }
  },

  // Interest Rates (hardcoded current values - would need real API)
  async fetchInterestRates(): Promise<any> {
    const rates = {
      USD: { rate: 5.25, change: 0 },
      EUR: { rate: 4.50, change: 0 },
      GBP: { rate: 5.25, change: 0 },
      JPY: { rate: 0.25, change: 0.15 },
      CHF: { rate: 1.75, change: 0 },
      CAD: { rate: 5.00, change: -0.25 },
      AUD: { rate: 4.35, change: 0 },
      NZD: { rate: 5.50, change: 0 },
    };
    
    saveToStorage(STORAGE_KEYS.INTEREST_RATES, { data: rates, timestamp: Date.now() });
    return { success: true, data: rates };
  },
};

// ============================================================
// WEB API - DATABASE EXPORT/IMPORT
// ============================================================

export const webDatabaseApi = {
  async exportDatabase(): Promise<{ success: boolean; message?: string }> {
    try {
      const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        trades: getFromStorage(STORAGE_KEYS.TRADES, []),
        accountConfig: getFromStorage(STORAGE_KEYS.ACCOUNT_CONFIG, {}),
        backtests: getFromStorage(STORAGE_KEYS.BACKTESTS, []),
        strategies: getFromStorage(STORAGE_KEYS.STRATEGIES, []),
        outlook: getFromStorage(STORAGE_KEYS.OUTLOOK, {}),
        pairNotes: getFromStorage(STORAGE_KEYS.PAIR_NOTES, {}),
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trading-journal-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return { success: true, message: 'Export erfolgreich!' };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  },

  async importDatabase(): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve({ success: false, message: 'Keine Datei ausgewählt' });
          return;
        }
        
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          
          if (data.trades) saveToStorage(STORAGE_KEYS.TRADES, data.trades);
          if (data.accountConfig) saveToStorage(STORAGE_KEYS.ACCOUNT_CONFIG, data.accountConfig);
          if (data.backtests) saveToStorage(STORAGE_KEYS.BACKTESTS, data.backtests);
          if (data.strategies) saveToStorage(STORAGE_KEYS.STRATEGIES, data.strategies);
          if (data.outlook) saveToStorage(STORAGE_KEYS.OUTLOOK, data.outlook);
          if (data.pairNotes) saveToStorage(STORAGE_KEYS.PAIR_NOTES, data.pairNotes);
          
          resolve({ success: true, message: 'Import erfolgreich! Seite wird neu geladen...' });
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          resolve({ success: false, message: 'Fehler beim Lesen der Datei' });
        }
      };
      
      input.click();
    });
  },
};

// ============================================================
// UNIFIED WEB API OBJECT (mimics electronAPI interface)
// ============================================================

export const webAPI = {
  // Trades
  loadTrades: webTradeApi.loadTrades,
  saveTrade: webTradeApi.saveTrade,
  deleteTrade: webTradeApi.deleteTrade,
  
  // Screenshots
  loadScreenshot: webScreenshotApi.loadScreenshot,
  saveScreenshot: webScreenshotApi.saveScreenshot,
  deleteScreenshot: webScreenshotApi.deleteScreenshot,
  
  // Account
  loadAccountConfig: webAccountApi.loadAccountConfig,
  saveAccountConfig: webAccountApi.saveAccountConfig,
  getStoragePath: webAccountApi.getStoragePath,
  setStoragePath: webAccountApi.setStoragePath,
  
  // Backtests
  loadBacktests: webBacktestApi.loadBacktests,
  saveBacktest: webBacktestApi.saveBacktest,
  deleteBacktest: webBacktestApi.deleteBacktest,
  
  // Strategies
  loadStrategies: webStrategyApi.loadStrategies,
  saveStrategy: webStrategyApi.saveStrategy,
  deleteStrategy: webStrategyApi.deleteStrategy,
  
  // Outlook
  loadOutlook: webOutlookApi.loadOutlook,
  saveOutlook: webOutlookApi.saveOutlook,
  loadPairNotes: webOutlookApi.loadPairNotes,
  savePairNote: webOutlookApi.savePairNote,
  
  // External Data
  fetchCOTData: webExternalApi.fetchCOTData,
  fetchEconomicCalendar: webExternalApi.fetchEconomicCalendar,
  fetchInterestRates: webExternalApi.fetchInterestRates,
  
  // Database
  exportDatabase: webDatabaseApi.exportDatabase,
  importDatabase: webDatabaseApi.importDatabase,
  
  // Auth callback (not needed for web)
  onAuthCallback: () => () => {},
};

// ============================================================
// CHECK IF RUNNING IN ELECTRON
// ============================================================

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.electronAPI !== 'undefined' &&
         window.electronAPI !== null;
};

// ============================================================
// GET API (Auto-detect Electron or Web)
// ============================================================

export const getApi = () => {
  if (isElectron()) {
    return window.electronAPI;
  }
  return webAPI;
};
