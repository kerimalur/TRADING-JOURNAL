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
  // COT Data from CFTC — 260 Wochen (5 Jahre), volle Commercials + Non-Commercials + OI
  async fetchCOTData(): Promise<any> {
    // Reihenfolge: Dollar Index, Euro FX, CHF, GBP, JPY, CAD, AUD, NZD
    // 098662 = aktueller ICE USD INDEX Kontrakt (aktiv)
    const CFTC_CODES: Record<string, string> = {
      DXY: '098662', EUR: '099741', CHF: '092741', GBP: '096742',
      JPY: '097741', CAD: '090741', AUD: '232741', NZD: '112741',
    };

    try {
      const results: any[] = [];
      const historyMap: Record<string, any[]> = {};

      for (const [currency, code] of Object.entries(CFTC_CODES)) {
        const response = await fetch(
          `https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=${code}&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=260`
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

            // Non-Commercial positions (Spekulanten)
            const nonCommercialsLong = parseInt(latest.noncomm_positions_long_all || 0);
            const nonCommercialsShort = parseInt(latest.noncomm_positions_short_all || 0);
            const nonCommercialsNet = nonCommercialsLong - nonCommercialsShort;

            // Previous week for change calculation
            const prevCommercialsNet = previous
              ? parseInt(previous.comm_positions_long_all || 0) - parseInt(previous.comm_positions_short_all || 0)
              : 0;
            const weeklyChange = commercialsNet - prevCommercialsNet;

            // Build full history for charts + ML (with nonComm + OI)
            const historicalData = data.map((row: any) => ({
              date: (row.report_date_as_yyyy_mm_dd || '').substring(0, 10),
              commercialsLong: parseInt(row.comm_positions_long_all) || 0,
              commercialsShort: parseInt(row.comm_positions_short_all) || 0,
              nonCommercialsLong: parseInt(row.noncomm_positions_long_all) || 0,
              nonCommercialsShort: parseInt(row.noncomm_positions_short_all) || 0,
              openInterest: parseInt(row.open_interest_all) || 0,
            })).reverse();

            historyMap[currency] = historicalData;

            // Calculate percentile rank (52W window for current signal)
            const window = data.slice(0, 52);
            const commNetHistory = window.map((row: any) =>
              parseInt(row.comm_positions_long_all || 0) - parseInt(row.comm_positions_short_all || 0)
            );
            const minNet = Math.min(...commNetHistory);
            const maxNet = Math.max(...commNetHistory);
            const range = maxNet - minNet;
            const percentileRank = range > 0
              ? Math.round(((commercialsNet - minNet) / range) * 100)
              : 50;

            // Determine signal based on percentile
            let signal = 'neutral';
            if (percentileRank >= 80) signal = 'strong_long';
            else if (percentileRank >= 60) signal = 'long';
            else if (percentileRank <= 20) signal = 'strong_short';
            else if (percentileRank <= 40) signal = 'short';

            results.push({
              currency,
              date: (latest.report_date_as_yyyy_mm_dd || '').substring(0, 10),
              commercialsLong,
              commercialsShort,
              commercialsNet,
              nonCommercialsLong,
              nonCommercialsShort,
              nonCommercialsNet,
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

  // Historische Forex-Preise von frankfurter.dev (ECB, CORS-frei, kein API-Key)
  async fetchForexPrices(startDate?: string): Promise<any> {
    try {
      const start = startDate || '2020-01-01';
      const end = new Date().toISOString().split('T')[0];
      // WICHTIG: api.frankfurter.app macht 301 -> api.frankfurter.dev (Redirect bricht CORS).
      // Daher direkt das neue /v1-Endpoint mit base/symbols. Antwort-Format ist identisch.
      const url = `https://api.frankfurter.dev/v1/${start}..${end}?base=EUR&symbols=USD,GBP,JPY,CAD,AUD,NZD,CHF`;

      const response = await fetch(url);
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };

      const json = await response.json();
      const rates = json.rates as Record<string, Record<string, number>>;
      if (!rates || Object.keys(rates).length === 0) {
        return { success: false, error: 'Keine Preisdaten' };
      }

      const dates = Object.keys(rates).sort();
      const daily: Record<string, Array<{ date: string; price: number }>> = {
        EUR: [], GBP: [], JPY: [], CAD: [], AUD: [], NZD: [], CHF: [], DXY: [],
      };

      for (const date of dates) {
        const r = rates[date];
        if (!r || !r.USD) continue;
        const eurUsd = r.USD;
        daily.EUR.push({ date, price: eurUsd });
        daily.GBP.push({ date, price: r.GBP ? eurUsd / r.GBP : 0 });
        daily.JPY.push({ date, price: r.JPY ? eurUsd / r.JPY : 0 });
        daily.CAD.push({ date, price: r.CAD ? eurUsd / r.CAD : 0 });
        daily.AUD.push({ date, price: r.AUD ? eurUsd / r.AUD : 0 });
        daily.NZD.push({ date, price: r.NZD ? eurUsd / r.NZD : 0 });
        daily.CHF.push({ date, price: r.CHF ? eurUsd / r.CHF : 0 });
        daily.DXY.push({ date, price: 1 / eurUsd }); // höher = USD stärker
      }

      // Auf Freitag (COT-Tag) heruntersamplen
      const weekly: Record<string, Array<{ date: string; price: number }>> = {};
      for (const [ccy, arr] of Object.entries(daily)) {
        const w: Array<{ date: string; price: number }> = [];
        let lastFriday: { date: string; price: number } | null = null;
        for (const d of arr) {
          const dow = new Date(d.date).getDay();
          if (dow === 5) lastFriday = d;
          else if (dow === 1 && lastFriday) { w.push(lastFriday); lastFriday = null; }
        }
        if (arr.length > 0) w.push(arr[arr.length - 1]);
        weekly[ccy] = w;
      }

      return { success: true, data: weekly };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  // Economic Calendar from Forex Factory (JSON)
  async fetchEconomicCalendar(): Promise<any> {
    try {
      // Use server-side proxy to avoid CORS restrictions in web deployment
      const proxyUrl = '/api/calendar';
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Calendar fetch failed');
      
      const rawEvents: any[] = await response.json();
      
      const calendarEvents = rawEvents
        .filter((e: any) => (e.impact || '').toLowerCase() !== 'holiday')
        .map((e: any, index: number) => {
          const dt = new Date(e.date);
          const isoDate = dt.toISOString().split('T')[0];
          const time24 = dt.toLocaleTimeString('de-DE', {
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Europe/Berlin'
          });
          const impact = (e.impact || '').toLowerCase();
          return {
            id: `ff-${index}`,
            event: e.title,
            currency: e.country,
            date: isoDate,
            time: time24,
            impact: impact === 'high' ? 'high' : impact === 'medium' ? 'medium' : 'low',
            forecast: e.forecast || undefined,
            previous: e.previous || undefined,
            actual: e.actual || undefined,
            source: 'forexfactory'
          } as any;
        });
      
      saveToStorage(STORAGE_KEYS.CALENDAR, { data: calendarEvents, timestamp: Date.now() });
      return { success: true, data: calendarEvents, source: 'forexfactory' };
    } catch (error) {
      const cached = getFromStorage<any>(STORAGE_KEYS.CALENDAR, null);
      if (cached) return { success: true, data: cached.data, cached: true, source: 'cache' };
      return { success: false, error: String(error) };
    }
  },

  // Interest Rates (hardcoded current values – Stand Mai 2026)
  async fetchInterestRates(): Promise<any> {
    const rates = {
      USD: { rate: 4.50, change: 'down', centralBank: 'Federal Reserve', lastMeeting: '2026-05-07', next: '2026-06-11' },
      EUR: { rate: 2.25, change: 'down', centralBank: 'ECB',              lastMeeting: '2026-04-17', next: '2026-06-05' },
      GBP: { rate: 4.25, change: 'down', centralBank: 'Bank of England', lastMeeting: '2026-05-08', next: '2026-06-19' },
      JPY: { rate: 0.50, change: 'up',   centralBank: 'Bank of Japan',   lastMeeting: '2026-04-30', next: '2026-06-17' },
      CHF: { rate: 0.25, change: 'down', centralBank: 'SNB',             lastMeeting: '2026-03-20', next: '2026-06-19' },
      CAD: { rate: 2.75, change: 'down', centralBank: 'Bank of Canada',  lastMeeting: '2026-04-16', next: '2026-06-04' },
      AUD: { rate: 4.10, change: 'down', centralBank: 'RBA',             lastMeeting: '2026-05-06', next: '2026-06-03' },
      NZD: { rate: 3.50, change: 'down', centralBank: 'RBNZ',            lastMeeting: '2026-04-09', next: '2026-07-09' },
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
  fetchForexPrices: webExternalApi.fetchForexPrices,
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
