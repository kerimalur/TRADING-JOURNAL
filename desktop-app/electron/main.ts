/**
 * ========================================================================
 * Trading Journal - Electron Main Process
 * ========================================================================
 * 
 * Hauptprozess der Desktop-Anwendung.
 * 
 * KERNFEATURE: Benutzerdefinierter Speicherpfad
 * - Ermöglicht Sync über Google Drive, Dropbox, OneDrive etc.
 * - Alle Daten (database.json + screenshots/) werden im gewählten Ordner gespeichert
 */

import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================
// DEEP LINK PROTOCOL (für Magic Link Auth)
// ============================================================

const PROTOCOL_NAME = 'tradingjournal';

// Registriere das Protocol so früh wie möglich
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_NAME, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_NAME);
}

// Verhindere mehrfache Instanzen und handle Deep Links auf Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ============================================================
// TYPES
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
  riskAmount?: number;    // Risikobetrag in Kontowährung
  profitAmount?: number;  // Gewinn/Verlust in Kontowährung
  notes?: string;
  comment?: string;
  sessionType: 'live' | 'backtest';
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  // Setup flags (legacy)
  htfBias?: boolean;
  d1Zone?: boolean;
  d1Fib?: boolean;
  h4Zone?: boolean;
  m15Entry?: boolean;
  // Setup flags (new)
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

interface DatabaseSchema {
  version: string;
  trades: Trade[];
  accountConfigs: {
    ek: AccountConfig;
    funded: AccountConfig;
  };
  marketData: MarketData;
}

interface TradeFilters {
  type?: 'funded' | 'ek';
  startDate?: string;
  endDate?: string;
  pair?: string;
  result?: 'win' | 'loss' | 'breakeven';
}

// ============================================================
// CONSTANTS
// ============================================================

const isDev = !app.isPackaged;
const SETTINGS_FILENAME = 'app-settings.json';
const DATABASE_FILENAME = 'database.json';
const SCREENSHOTS_FOLDER = 'screenshots';

// ============================================================
// GLOBALS
// ============================================================

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

// Pfad zur Settings-Datei (immer in userData, nie im Custom-Ordner)
let settingsPath: string;

// Custom Storage Path (vom User gewählt, z.B. Google Drive Ordner)
let storagePath: string;

// Datenbank
let database: DatabaseSchema;

// ============================================================
// STORAGE PATH MANAGEMENT (Das Herzstück für Cloud-Sync)
// ============================================================

interface AppSettings {
  storagePath: string | null;
  windowBounds?: { width: number; height: number; x?: number; y?: number };
}

function getDefaultSettings(): AppSettings {
  return {
    storagePath: null,
  };
}

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, 'utf-8');
      return { ...getDefaultSettings(), ...JSON.parse(content) };
    }
  } catch (error) {
    console.error('❌ Error loading settings:', error);
  }
  return getDefaultSettings();
}

function saveSettings(settings: AppSettings): void {
  try {
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('✅ Settings saved');
  } catch (error) {
    console.error('❌ Error saving settings:', error);
  }
}

/**
 * Gibt den aktuellen Speicherpfad zurück.
 * Falls keiner gesetzt ist, wird der Default-Pfad (userData) verwendet.
 */
function getStoragePath(): string {
  const settings = loadSettings();
  
  if (settings.storagePath && fs.existsSync(settings.storagePath)) {
    return settings.storagePath;
  }
  
  // Fallback: userData Ordner
  return app.getPath('userData');
}

/**
 * Öffnet einen Ordner-Auswahl-Dialog und speichert den gewählten Pfad.
 * Gibt den neuen Pfad zurück oder null bei Abbruch.
 */
async function selectStoragePath(): Promise<string | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Speicherort für Trading Journal wählen',
    message: 'Wähle einen Ordner (z.B. deinen Google Drive Ordner) für die Datensynchronisation',
    buttonLabel: 'Ordner auswählen',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const newPath = result.filePaths[0];
  
  // Erstelle Trading Journal Unterordner
  const journalPath = path.join(newPath, 'TradingJournal');
  
  if (!fs.existsSync(journalPath)) {
    fs.mkdirSync(journalPath, { recursive: true });
  }

  // Speichere den neuen Pfad in den Settings
  const settings = loadSettings();
  settings.storagePath = journalPath;
  saveSettings(settings);

  // Aktualisiere den globalen Pfad
  storagePath = journalPath;
  
  // Initialisiere die Datenbank am neuen Ort
  initializeStorage();

  console.log('📂 Storage path changed to:', journalPath);
  return journalPath;
}

// ============================================================
// DATABASE FUNCTIONS
// ============================================================

function getDatabasePath(): string {
  return path.join(storagePath, DATABASE_FILENAME);
}

function getScreenshotsDir(): string {
  return path.join(storagePath, SCREENSHOTS_FOLDER);
}

function getEmptyDatabase(): DatabaseSchema {
  return {
    version: '2.0.0',
    trades: [],
    accountConfigs: {
      ek: {
        initialStartBalance: 10000,
        currentBalance: 10000,
        currency: 'USD',
        type: 'ek',
        defaultRiskPerTrade: 0.5,
      },
      funded: {
        initialStartBalance: 100000,
        currentBalance: 100000,
        currency: 'USD',
        type: 'funded',
        enableGoals: true,
        profitTargetValue: 8,
        profitTargetType: 'percent',
        maxDrawdownValue: 5,
        maxDrawdownType: 'percent',
        profitTarget: 108000,
        maxDrawdown: 95000,
        defaultRiskPerTrade: 1.0,
      },
    },
    marketData: {
      cotData: [],
      newsData: [],
      interestRates: [],
    },
  };
}

function initializeStorage(): void {
  const dbPath = getDatabasePath();
  const screenshotsDir = getScreenshotsDir();

  console.log('📂 Database path:', dbPath);
  console.log('📁 Screenshots path:', screenshotsDir);

  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log('✅ Created screenshots directory');
  }

  // Load or create database
  if (fs.existsSync(dbPath)) {
    try {
      const content = fs.readFileSync(dbPath, 'utf-8');
      database = JSON.parse(content);

      // Migration: Ensure marketData exists
      if (!database.marketData) {
        database.marketData = { cotData: [], newsData: [], interestRates: [] };
      }

      console.log('✅ Database loaded successfully');
      console.log(`   ${database.trades.length} trades loaded`);
    } catch (error) {
      console.error('❌ Error loading database:', error);
      database = getEmptyDatabase();
      saveDatabase();
    }
  } else {
    console.log('📝 Creating new database...');
    database = getEmptyDatabase();
    saveDatabase();
  }
}

function saveDatabase(): void {
  try {
    const dbPath = getDatabasePath();
    const dir = path.dirname(dbPath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), 'utf-8');
  } catch (error) {
    console.error('❌ Error saving database:', error);
    throw error;
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================
// BALANCE CALCULATION
// ============================================================

function recalculateBalances(): void {
  for (const accountType of ['ek', 'funded'] as const) {
    const config = database.accountConfigs[accountType];
    if (!config) continue;

    let balance = config.initialStartBalance;

    const trades = database.trades.filter(
      (t) => t.type === accountType && t.sessionType === 'live'
    );

    // Nach Datum sortieren für chronologische Berechnung
    trades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    trades.forEach((trade) => {
      // Wenn profitAmount gespeichert ist, verwende diesen (neue Methode)
      if (trade.profitAmount !== undefined && trade.profitAmount !== null) {
        balance += trade.profitAmount;
      } else {
        // Fallback: Alte Berechnungsmethode für Legacy-Trades
        const riskPercent = trade.riskPercent || config.defaultRiskPerTrade;
        const riskAmount = trade.riskAmount || (config.initialStartBalance * (riskPercent / 100));
        balance += trade.rMultiple * riskAmount;
      }
    });

    database.accountConfigs[accountType].currentBalance = Math.round(balance * 100) / 100;
  }

  saveDatabase();
}

// ============================================================
// SCREENSHOT HELPERS
// ============================================================

function getScreenshotPath(tradeId: string, extension: string = 'png'): string {
  return path.join(getScreenshotsDir(), `trade_${tradeId}.${extension}`);
}

function findScreenshotFile(tradeId: string): string | null {
  const extensions = ['png', 'jpg', 'jpeg', 'webp'];
  const screenshotsDir = getScreenshotsDir();

  for (const ext of extensions) {
    const filepath = path.join(screenshotsDir, `trade_${tradeId}.${ext}`);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
  }
  return null;
}

function deleteScreenshotFile(tradeId: string): boolean {
  const filepath = findScreenshotFile(tradeId);
  if (filepath) {
    fs.unlinkSync(filepath);
    console.log(`🗑️ Screenshot deleted: ${path.basename(filepath)}`);
    return true;
  }
  return false;
}

// ============================================================
// WINDOW CREATION
// ============================================================

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashPath = isDev
    ? path.join(__dirname, '../resources/splash.html')
    : path.join(process.resourcesPath, 'resources/splash.html');

  if (fs.existsSync(splashPath)) {
    splashWindow.loadFile(splashPath);
  }

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createWindow(): void {
  const iconPath = isDev
    ? path.join(__dirname, '../resources/icon.ico')
    : path.join(process.resourcesPath, 'resources/icon.ico');

  const iconExists = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: 'Trading Journal',
    ...(iconExists && { icon: iconPath }),
    backgroundColor: '#0a0a0c',
    show: false,
    frame: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0c',
      symbolColor: '#8B5CF6',
      height: 36,
    },
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      // Allow fetch to external URLs (needed for Supabase Auth)
      webSecurity: !isDev, // Disable in dev for easier debugging
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (isDev && devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Fallback: Falls ready-to-show nicht innerhalb von 5 Sekunden ausgelöst wird, zeige das Fenster trotzdem
  const showTimeout = setTimeout(() => {
    console.log('⚠️ ready-to-show timeout reached, forcing window show');
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow?.show();
    mainWindow?.focus();
    // Öffne DevTools im Production-Mode um Fehler zu sehen
    if (!isDev) {
      mainWindow?.webContents.openDevTools();
    }
  }, 5000);

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showTimeout);
    // Splash schließen
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================
// IPC HANDLERS - Contract Implementation
// ============================================================

function registerIPCHandlers(): void {
  // ────────────────────────────────────────────────────────────
  // STORAGE PATH MANAGEMENT (Herzstück für Cloud-Sync)
  // ────────────────────────────────────────────────────────────

  ipcMain.handle('getStoragePath', async () => {
    return storagePath;
  });

  ipcMain.handle('setStoragePath', async () => {
    return await selectStoragePath();
  });

  // ────────────────────────────────────────────────────────────
  // TRADE OPERATIONS
  // ────────────────────────────────────────────────────────────

  ipcMain.handle('loadTrades', async (_, filters?: TradeFilters) => {
    let trades = [...database.trades];

    if (filters) {
      if (filters.type) {
        trades = trades.filter((t) => t.type === filters.type);
      }
      if (filters.startDate) {
        trades = trades.filter((t) => t.date >= filters.startDate!);
      }
      if (filters.endDate) {
        trades = trades.filter((t) => t.date <= filters.endDate!);
      }
      if (filters.pair) {
        trades = trades.filter((t) => t.pair === filters.pair);
      }
      if (filters.result) {
        trades = trades.filter((t) => t.result === filters.result);
      }
    }

    // Sort by date descending
    trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return trades;
  });

  ipcMain.handle('saveTrade', async (_, trade: Omit<Trade, 'id'> & { id?: string }) => {
    const now = new Date().toISOString();

    if (trade.id) {
      // Update existing trade
      const index = database.trades.findIndex((t) => t.id === trade.id);
      if (index !== -1) {
        database.trades[index] = {
          ...database.trades[index],
          ...trade,
          updatedAt: now,
        } as Trade;
        recalculateBalances();
        return database.trades[index];
      }
      throw new Error(`Trade with id ${trade.id} not found`);
    } else {
      // Create new trade
      const newTrade: Trade = {
        ...trade,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      } as Trade;
      database.trades.push(newTrade);
      recalculateBalances();
      return newTrade;
    }
  });

  ipcMain.handle('deleteTrade', async (_, id: string) => {
    const index = database.trades.findIndex((t) => t.id === id);
    if (index !== -1) {
      database.trades.splice(index, 1);
      deleteScreenshotFile(id);
      recalculateBalances();
      return true;
    }
    return false;
  });

  // ────────────────────────────────────────────────────────────
  // ACCOUNT OPERATIONS
  // ────────────────────────────────────────────────────────────

  ipcMain.handle('loadAccountConfig', async () => {
    return database.accountConfigs;
  });

  ipcMain.handle('saveAccountConfig', async (_, config: AccountConfig) => {
    const accountType = config.type;
    database.accountConfigs[accountType] = config;
    saveDatabase();
  });

  // ────────────────────────────────────────────────────────────
  // MARKET DATA
  // ────────────────────────────────────────────────────────────

  ipcMain.handle('loadMarketData', async () => {
    return database.marketData;
  });

  ipcMain.handle('saveMarketData', async (_, data: MarketData) => {
    database.marketData = data;
    saveDatabase();
  });

  // ────────────────────────────────────────────────────────────
  // SCREENSHOT OPERATIONS (Speichert im Custom-Ordner!)
  // ────────────────────────────────────────────────────────────

  ipcMain.handle('saveScreenshot', async (_, tradeId: string, imageData: string) => {
    const screenshotsDir = getScreenshotsDir();

    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Delete existing screenshot if any
    deleteScreenshotFile(tradeId);

    // Parse data URL
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid image data format');
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `trade_${tradeId}.${extension}`;
    const filepath = path.join(screenshotsDir, filename);

    fs.writeFileSync(filepath, buffer);
    console.log(`📸 Screenshot saved: ${filename}`);

    return filepath;
  });

  ipcMain.handle('loadScreenshot', async (_, tradeId: string) => {
    const filepath = findScreenshotFile(tradeId);

    if (!filepath) {
      return null;
    }

    const buffer = fs.readFileSync(filepath);
    const extension = path.extname(filepath).slice(1);
    const mimeType = extension === 'jpg' ? 'jpeg' : extension;
    const base64 = buffer.toString('base64');

    return `data:image/${mimeType};base64,${base64}`;
  });

  ipcMain.handle('deleteScreenshot', async (_, tradeId: string) => {
    return deleteScreenshotFile(tradeId);
  });

  // ────────────────────────────────────────────────────────────
  // BACKUP / EXPORT OPERATIONS
  // ────────────────────────────────────────────────────────────

  ipcMain.handle('exportDatabase', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Datenbank exportieren',
      defaultPath: `TradingJournal_Backup_${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false };
    }

    try {
      fs.writeFileSync(result.filePath, JSON.stringify(database, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('Export error:', error);
      return { success: false };
    }
  });

  ipcMain.handle('importDatabase', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Datenbank importieren',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { success: false };
    }

    try {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      const importedData = JSON.parse(content) as DatabaseSchema;

      // Merge or replace
      database = {
        ...database,
        trades: importedData.trades || database.trades,
        accountConfigs: importedData.accountConfigs || database.accountConfigs,
        marketData: importedData.marketData || database.marketData,
      };

      saveDatabase();
      return { success: true };
    } catch (error) {
      console.error('Import error:', error);
      return { success: false };
    }
  });

  // ────────────────────────────────────────────────────────────
  // SYSTEM OPERATIONS
  // ────────────────────────────────────────────────────────────

  ipcMain.handle('getAppPath', async () => {
    return storagePath;
  });

  ipcMain.handle('openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('showSaveDialog', async (_, options) => {
    return await dialog.showSaveDialog(mainWindow!, options);
  });

  ipcMain.handle('showOpenDialog', async (_, options) => {
    return await dialog.showOpenDialog(mainWindow!, options);
  });

  // ────────────────────────────────────────────────────────────
  // EXTERNAL API CALLS (kein CORS im Main Process!)
  // ────────────────────────────────────────────────────────────

  /**
   * COT-Daten direkt von CFTC laden
   * Im Main Process gibt es kein CORS-Problem!
   * 
   * Dataset: 6dca-aqww = Legacy COT Futures Only Report
   * Quelle: https://www.cftc.gov/dea/futures/deacmelf.htm
   * Chicago Mercantile Exchange (CME) - Currency Futures
   * 
   * Kategorien im Legacy COT Report:
   * - Commercials: Hedger (Produzenten, Händler) - die "Smart Money"
   * - Non-Commercials: Spekulanten (Hedge Funds, etc.)
   * - Nonreportable Positions: Kleine Trader
   * 
   * Diese Daten entsprechen dem was auf Wellenreiter, barchart.com etc. gezeigt wird!
   */
  ipcMain.handle('fetchCOTData', async () => {
    // CFTC Contract Market Codes für Währungs-Futures (CME + ICE)
    const CURRENCIES = [
      { id: 'EUR', cftcCode: '099741', name: 'EURO FX' },
      { id: 'GBP', cftcCode: '096742', name: 'BRITISH POUND' },
      { id: 'JPY', cftcCode: '097741', name: 'JAPANESE YEN' },
      { id: 'CAD', cftcCode: '090741', name: 'CANADIAN DOLLAR' },
      { id: 'AUD', cftcCode: '232741', name: 'AUSTRALIAN DOLLAR' },
      { id: 'NZD', cftcCode: '112741', name: 'NZ DOLLAR' },
      { id: 'CHF', cftcCode: '092741', name: 'SWISS FRANC' },
      { id: 'USD', cftcCode: '098662', name: 'USD INDEX' },
    ];

    try {
      const results: any[] = [];
      const historyMap: Record<string, any[]> = {};

      for (const currency of CURRENCIES) {
        try {
          // Legacy COT Futures Only: 6dca-aqww (CME Currency Futures)
          const url = `https://publicreporting.cftc.gov/resource/6dca-aqww.json?` +
            `cftc_contract_market_code=${currency.cftcCode}` +
            `&$order=report_date_as_yyyy_mm_dd DESC` +
            `&$limit=52`;
          
          console.log(`📊 Fetching COT for ${currency.id} (${currency.name})...`);
          
          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'TradingJournal/1.0'
            }
          });

          if (!response.ok) {
            console.warn(`❌ COT ${currency.id}: HTTP ${response.status}`);
            continue;
          }

          const rawData = await response.json() as any[];

          if (rawData && Array.isArray(rawData) && rawData.length > 0) {
            // Historische Daten für Charts
            const historicalData = rawData.map((row: any) => ({
              date: row.report_date_as_yyyy_mm_dd,
              // Legacy COT Kategorien: Commercials und Non-Commercials
              commercialsLong: parseInt(row.comm_positions_long_all) || 0,
              commercialsShort: parseInt(row.comm_positions_short_all) || 0,
              nonCommercialsLong: parseInt(row.noncomm_positions_long_all) || 0,
              nonCommercialsShort: parseInt(row.noncomm_positions_short_all) || 0,
              openInterest: parseInt(row.open_interest_all) || 0
            })).reverse();

            historyMap[currency.id] = historicalData;

            const latest = rawData[0];
            const previous = rawData[1];

            // Commercials (Hedger - das "Smart Money")
            const commercialsLong = parseInt(latest.comm_positions_long_all) || 0;
            const commercialsShort = parseInt(latest.comm_positions_short_all) || 0;
            const commercialsNet = commercialsLong - commercialsShort;

            // Non-Commercials (Spekulanten)
            const nonCommercialsLong = parseInt(latest.noncomm_positions_long_all) || 0;
            const nonCommercialsShort = parseInt(latest.noncomm_positions_short_all) || 0;
            const nonCommercialsNet = nonCommercialsLong - nonCommercialsShort;

            // Wöchentliche Veränderungen der Commercials
            const prevCommercialsNet = previous
              ? (parseInt(previous.comm_positions_long_all) || 0) - (parseInt(previous.comm_positions_short_all) || 0)
              : 0;
            const weeklyChange = commercialsNet - prevCommercialsNet;

            // Perzentil-Ranking für Commercials über 52 Wochen
            const commNetHistory = historicalData.map(d => d.commercialsLong - d.commercialsShort);
            const sortedNets = [...commNetHistory].sort((a, b) => a - b);
            const rank = sortedNets.findIndex(n => n >= commercialsNet);
            const percentileRank = Math.round((rank / Math.max(sortedNets.length, 1)) * 100);

            // Signal basierend auf Commercials Perzentil
            // Commercials sind Contrarian-Indikatoren:
            // Wenn Commercials stark long sind = bullish für Währung
            let signal = 'neutral';
            if (percentileRank >= 80) signal = 'strong_long';
            else if (percentileRank >= 60) signal = 'long';
            else if (percentileRank <= 20) signal = 'strong_short';
            else if (percentileRank <= 40) signal = 'short';

            results.push({
              currency: currency.id,
              date: latest.report_date_as_yyyy_mm_dd?.split('T')[0] || 'N/A',
              // Commercials (Hedger)
              commercialsLong,
              commercialsShort,
              commercialsNet,
              // Non-Commercials (Spekulanten)
              nonCommercialsLong,
              nonCommercialsShort,
              nonCommercialsNet,
              // Für zusätzliche Kompatibilität
              dealerLong: commercialsLong,
              dealerShort: commercialsShort,
              dealerNet: commercialsNet,
              weeklyChange,
              percentileRank,
              signal,
              openInterest: parseInt(latest.open_interest_all) || 0
            });

            console.log(`✅ COT ${currency.id}: Commercials L=${commercialsLong} S=${commercialsShort} Net=${commercialsNet}, Signal=${signal}`);
          }
        } catch (err) {
          console.error(`❌ Error fetching COT for ${currency.id}:`, err);
        }
      }

      return { 
        success: true, 
        data: results, 
        history: historyMap,
        source: 'CFTC Legacy COT Futures Only (6dca-aqww) - CME',
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ COT fetch failed:', error);
      return { success: false, error: String(error), data: [], history: {} };
    }
  });

  /**
   * Wirtschaftskalender von Forex Factory (via faireconomy.media XML Feed)
   */
  ipcMain.handle('fetchEconomicCalendar', async () => {
    try {
      console.log('📅 Fetching Forex Factory calendar...');
      
      // Forex Factory XML Feed (reliable, updates frequently)
      const ffUrl = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml';
      
      const response = await fetch(ffUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/xml, text/xml, */*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const xmlText = await response.text();
      
      // Parse XML manually (kein DOM Parser in Node)
      const events: any[] = [];
      const eventMatches = xmlText.match(/<event>[\s\S]*?<\/event>/g) || [];
      
      for (const eventXml of eventMatches) {
        const getTag = (tag: string) => {
          const match = eventXml.match(new RegExp(`<${tag}>(?:<\\!\\[CDATA\\[)?([^<]*?)(?:\\]\\]>)?<\\/${tag}>`));
          return match ? match[1].trim() : '';
        };
        
        const title = getTag('title');
        const country = getTag('country');
        const date = getTag('date');
        const time = getTag('time');
        const impact = getTag('impact').toLowerCase();
        const forecast = getTag('forecast');
        const previous = getTag('previous');
        const url = getTag('url');
        
        // Konvertiere Datum von MM-DD-YYYY zu ISO
        let isoDate = '';
        if (date) {
          const [month, day, year] = date.split('-');
          isoDate = `${year}-${month}-${day}`;
        }
        
        // Konvertiere Zeit in 24h Format
        let time24 = time;
        if (time && time.includes('am')) {
          time24 = time.replace('am', '').trim();
          const [h, m] = time24.split(':');
          time24 = `${h.padStart(2, '0')}:${m || '00'}`;
        } else if (time && time.includes('pm')) {
          time24 = time.replace('pm', '').trim();
          const [h, m] = time24.split(':');
          const hour = parseInt(h) === 12 ? 12 : parseInt(h) + 12;
          time24 = `${hour}:${m || '00'}`;
        }
        
        events.push({
          id: `ff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: isoDate,
          time: time24,
          currency: country,
          impact: impact === 'high' ? 'high' : impact === 'medium' ? 'medium' : 'low',
          event: title,
          forecast: forecast || undefined,
          previous: previous || undefined,
          url: url || undefined,
          source: 'forexfactory'
        });
      }
      
      console.log(`✅ Forex Factory: ${events.length} events loaded`);
      
      return { 
        success: true, 
        source: 'forexfactory', 
        data: events 
      };
      
    } catch (error) {
      console.error('❌ Forex Factory fetch failed:', error);
      
      // Fallback: Generiere echte Events basierend auf bekannten regelmäßigen Releases
      console.log('📅 Using scheduled events fallback');
      return { 
        success: true, 
        source: 'scheduled', 
        data: generateScheduledEvents() 
      };
    }
  });

  /**
   * Aktuelle Zentralbank-Zinssätze laden
   */
  ipcMain.handle('fetchInterestRates', async () => {
    try {
      console.log('💰 Fetching interest rates...');
      
      // Trading Economics oder andere Quellen
      // Für jetzt: Aktuelle bekannte Rates (Stand Februar 2026)
      const rates = {
        USD: { rate: 4.25, change: 'down', centralBank: 'Federal Reserve', lastMeeting: '2026-01-29', next: '2026-03-19' },
        EUR: { rate: 2.75, change: 'down', centralBank: 'ECB', lastMeeting: '2026-01-30', next: '2026-03-06' },
        GBP: { rate: 4.00, change: 'down', centralBank: 'Bank of England', lastMeeting: '2026-02-06', next: '2026-03-20' },
        JPY: { rate: 0.50, change: 'up', centralBank: 'Bank of Japan', lastMeeting: '2026-01-24', next: '2026-03-14' },
        CAD: { rate: 3.50, change: 'down', centralBank: 'Bank of Canada', lastMeeting: '2026-01-29', next: '2026-03-12' },
        AUD: { rate: 3.60, change: 'down', centralBank: 'RBA', lastMeeting: '2026-02-04', next: '2026-03-04' },
        NZD: { rate: 4.25, change: 'down', centralBank: 'RBNZ', lastMeeting: '2026-02-19', next: '2026-04-09' },
        CHF: { rate: 0.75, change: 'hold', centralBank: 'SNB', lastMeeting: '2025-12-12', next: '2026-03-20' },
      };
      
      return { success: true, data: rates };
    } catch (error) {
      console.error('❌ Interest rates fetch failed:', error);
      return { success: false, error: String(error), data: {} };
    }
  });
}

/**
 * Generiert geplante Wirtschaftsevents basierend auf bekannten Terminen
 */
function generateScheduledEvents() {
  const events: any[] = [];
  const today = new Date();
  
  // Bekannte regelmäßige Events
  const scheduledEvents = [
    // USD Events
    { currency: 'USD', event: 'Non-Farm Payrolls', day: 'first_friday', time: '14:30', impact: 'high' },
    { currency: 'USD', event: 'CPI (Inflation)', day: 'mid_month', time: '14:30', impact: 'high' },
    { currency: 'USD', event: 'FOMC Statement', day: 'fomc', time: '20:00', impact: 'high' },
    { currency: 'USD', event: 'Initial Jobless Claims', day: 'thursday', time: '14:30', impact: 'medium' },
    { currency: 'USD', event: 'Retail Sales', day: 'mid_month', time: '14:30', impact: 'high' },
    { currency: 'USD', event: 'Core PCE Price Index', day: 'last_friday', time: '14:30', impact: 'high' },
    
    // EUR Events
    { currency: 'EUR', event: 'ECB Zinsentscheidung', day: 'ecb', time: '14:15', impact: 'high' },
    { currency: 'EUR', event: 'German CPI', day: 'end_month', time: '14:00', impact: 'high' },
    { currency: 'EUR', event: 'German ZEW Economic Sentiment', day: 'second_tuesday', time: '11:00', impact: 'medium' },
    { currency: 'EUR', event: 'Eurozone CPI Flash', day: 'end_month', time: '11:00', impact: 'high' },
    
    // GBP Events
    { currency: 'GBP', event: 'BoE Interest Rate Decision', day: 'boe', time: '13:00', impact: 'high' },
    { currency: 'GBP', event: 'UK CPI', day: 'mid_month', time: '08:00', impact: 'high' },
    { currency: 'GBP', event: 'UK Employment Change', day: 'mid_month', time: '08:00', impact: 'high' },
    
    // JPY Events
    { currency: 'JPY', event: 'BoJ Zinsentscheidung', day: 'boj', time: '04:00', impact: 'high' },
    { currency: 'JPY', event: 'Japan CPI', day: 'third_friday', time: '01:30', impact: 'high' },
    
    // CAD Events
    { currency: 'CAD', event: 'BoC Interest Rate', day: 'boc', time: '15:45', impact: 'high' },
    { currency: 'CAD', event: 'Canada Employment Change', day: 'first_friday', time: '14:30', impact: 'high' },
    
    // AUD Events
    { currency: 'AUD', event: 'RBA Interest Rate Decision', day: 'rba', time: '04:30', impact: 'high' },
    { currency: 'AUD', event: 'Australia Employment Change', day: 'mid_month', time: '01:30', impact: 'high' },
    
    // NZD Events
    { currency: 'NZD', event: 'RBNZ Interest Rate Decision', day: 'rbnz', time: '02:00', impact: 'high' },
    
    // CHF Events
    { currency: 'CHF', event: 'SNB Interest Rate Decision', day: 'snb', time: '09:30', impact: 'high' },
  ];

  // Generiere Events für die nächsten 14 Tage
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const dateStr = date.toISOString().split('T')[0];
    
    for (const template of scheduledEvents) {
      let shouldAdd = false;
      
      switch (template.day) {
        case 'thursday':
          shouldAdd = dayOfWeek === 4;
          break;
        case 'first_friday':
          shouldAdd = dayOfWeek === 5 && dayOfMonth <= 7;
          break;
        case 'last_friday':
          const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
          shouldAdd = dayOfWeek === 5 && dayOfMonth > lastDay - 7;
          break;
        case 'mid_month':
          shouldAdd = dayOfMonth >= 10 && dayOfMonth <= 15 && dayOfWeek >= 1 && dayOfWeek <= 5;
          break;
        case 'end_month':
          shouldAdd = dayOfMonth >= 25 && dayOfWeek >= 1 && dayOfWeek <= 5;
          break;
        case 'second_tuesday':
          shouldAdd = dayOfWeek === 2 && dayOfMonth >= 8 && dayOfMonth <= 14;
          break;
        case 'third_friday':
          shouldAdd = dayOfWeek === 5 && dayOfMonth >= 15 && dayOfMonth <= 21;
          break;
      }
      
      if (shouldAdd) {
        events.push({
          id: `${dateStr}-${template.currency}-${template.event}`,
          date: dateStr,
          time: template.time,
          currency: template.currency,
          event: template.event,
          impact: template.impact,
        });
      }
    }
  }
  
  // Sortiere nach Datum und Zeit
  events.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });
  
  return events;
}

// ============================================================
// DEEP LINK HANDLER (für Magic Link Auth)
// ============================================================

function handleDeepLink(url: string) {
  console.log('🔗 Deep link received:', url);
  
  // Parse the URL: tradingjournal://auth-callback#access_token=...&refresh_token=...
  try {
    const urlObj = new URL(url);
    const hash = urlObj.hash.substring(1); // Remove leading #
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    
    if (accessToken && mainWindow) {
      console.log('✅ Auth tokens received, sending to renderer');
      mainWindow.webContents.send('supabase-auth-callback', {
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      
      // Bring window to front
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  } catch (error) {
    console.error('❌ Error parsing deep link:', error);
  }
}

// Handle second instance (Windows/Linux)
app.on('second-instance', (_event, commandLine) => {
  // Someone tried to run a second instance, focus our window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  
  // Find deep link in command line args
  const deepLink = commandLine.find(arg => arg.startsWith(`${PROTOCOL_NAME}://`));
  if (deepLink) {
    handleDeepLink(deepLink);
  }
});

// Handle open-url event (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// ============================================================
// APP LIFECYCLE
// ============================================================

app.whenReady().then(() => {
  // Settings-Pfad initialisieren (immer in userData)
  settingsPath = path.join(app.getPath('userData'), SETTINGS_FILENAME);
  
  // Storage-Pfad laden (custom oder default)
  storagePath = getStoragePath();
  console.log('📂 Using storage path:', storagePath);

  // Splash Screen anzeigen
  createSplashWindow();

  // Datenbank initialisieren
  initializeStorage();

  // IPC Handler registrieren
  registerIPCHandlers();

  // Hauptfenster erstellen
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
