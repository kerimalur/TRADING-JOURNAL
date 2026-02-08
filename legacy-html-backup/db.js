/**
 * ========================================================================
 * Trading Journal - IndexedDB Database Layer (Dexie.js)
 * ========================================================================
 * 
 * Robuste Datenbank-Implementierung mit IndexedDB und Dexie.js.
 * 
 * Features:
 * - Effiziente Speicherung von Tausenden Trades und Screenshots
 * - Blob-basierte Bildspeicherung (statt Base64)
 * - Automatische Migration von localStorage
 * - Versionierung und Schema-Upgrades
 * - Separate Tabelle für Backtests (Session-basiert)
 * 
 * Dexie.js CDN: https://unpkg.com/dexie@3.2.4/dist/dexie.js
 */

// ========================================================================
// 1. DATENBANK-DEFINITION
// ========================================================================

const db = new Dexie('TradingJournalDB');

// Schema-Definition (Version 1)
db.version(1).stores({
    // Haupttabellen
    trades: '++id, type, pair, date, sessionType, createdAt, updatedAt',
    backtests: '++id, sessionId, pair, date, createdAt',
    cotData: '++id, symbol, date',
    newsData: '++id, currency, date, createdAt',
    
    // Einstellungen und Konfigurationen
    settings: 'key',
    accountConfigs: 'type',
    transactions: '++id, type, date, createdAt',
    
    // Bilder separat (Blob-Speicherung)
    screenshots: '++id, tradeId, backtestId, type, createdAt',
    
    // Currency Analysis Settings
    interestRates: 'currency, updatedAt'
});

console.log('✅ Dexie Database initialized: TradingJournalDB');


// ========================================================================
// 2. DATENBANK-HELPER FUNKTIONEN
// ========================================================================

/**
 * Komprimiert ein Bild und konvertiert es in ein Blob für effiziente Speicherung.
 * @param {File|Blob|string} input - File, Blob oder Base64-String
 * @param {number} maxWidth - Maximale Breite (Standard: 1920px)
 * @param {number} quality - JPEG-Qualität 0-1 (Standard: 0.85)
 * @returns {Promise<Blob>} - Komprimiertes Bild als Blob
 */
async function compressImageToBlob(input, maxWidth = 1920, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = () => {
            // Berechne neue Dimensionen
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Zeichne und komprimiere
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        console.log(`📷 Image compressed: ${(blob.size / 1024).toFixed(2)} KB`);
                        resolve(blob);
                    } else {
                        reject(new Error('Image compression failed'));
                    }
                },
                'image/jpeg',
                quality
            );
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        
        // Handle verschiedene Input-Typen
        if (typeof input === 'string') {
            // Base64-String
            img.src = input;
        } else if (input instanceof Blob || input instanceof File) {
            // File oder Blob
            img.src = URL.createObjectURL(input);
        } else {
            reject(new Error('Invalid input type'));
        }
    });
}

/**
 * Konvertiert ein Blob zurück in eine Data-URL für Anzeige im Browser.
 * @param {Blob} blob - Das Bild-Blob
 * @returns {Promise<string>} - Data-URL
 */
async function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}


// ========================================================================
// 3. TRADE CRUD OPERATIONS
// ========================================================================

/**
 * Lädt alle Trades oder filtert nach Typ/Session.
 * @param {object} filters - {type: 'ek'|'funded', sessionType: 'live'|'backtest'}
 * @returns {Promise<Array>} - Array von Trades
 */
async function dbLoadTrades(filters = {}) {
    try {
        let query = db.trades;
        
        // Filter anwenden
        if (filters.type) {
            query = query.where('type').equals(filters.type);
        }
        if (filters.sessionType) {
            query = query.where('sessionType').equals(filters.sessionType);
        }
        
        const trades = await query.reverse().sortBy('date');
        console.log(`📊 Loaded ${trades.length} trades`, filters);
        return trades;
    } catch (error) {
        console.error('❌ Error loading trades:', error);
        return [];
    }
}

/**
 * Speichert einen neuen Trade.
 * @param {object} trade - Trade-Objekt
 * @param {File|Blob|string} screenshot - Optional: Screenshot
 * @returns {Promise<number>} - Trade-ID
 */
async function dbSaveTrade(trade, screenshot = null) {
    try {
        // Setze Metadaten
        trade.createdAt = new Date().toISOString();
        trade.sessionType = trade.sessionType || 'live'; // Default: live
        
        // Speichere Trade
        const tradeId = await db.trades.add(trade);
        console.log(`✅ Trade saved: ID ${tradeId}`);
        
        // Screenshot separat speichern (falls vorhanden)
        if (screenshot) {
            await dbSaveScreenshot(tradeId, screenshot, 'trade');
        }
        
        // Recalculate balances
        await dbRecalculateBalances();
        
        return tradeId;
    } catch (error) {
        console.error('❌ Error saving trade:', error);
        throw error;
    }
}

/**
 * Aktualisiert einen existierenden Trade.
 * @param {number} id - Trade-ID
 * @param {object} updates - Zu aktualisierende Felder
 * @returns {Promise<boolean>} - Erfolg
 */
async function dbUpdateTrade(id, updates) {
    try {
        updates.updatedAt = new Date().toISOString();
        await db.trades.update(id, updates);
        await dbRecalculateBalances();
        console.log(`✅ Trade updated: ID ${id}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating trade:', error);
        return false;
    }
}

/**
 * Löscht einen Trade und zugehörige Screenshots.
 * @param {number} id - Trade-ID
 * @returns {Promise<boolean>} - Erfolg
 */
async function dbDeleteTrade(id) {
    try {
        await db.trades.delete(id);
        
        // Lösche zugehörige Screenshots
        await db.screenshots.where('tradeId').equals(id).delete();
        
        await dbRecalculateBalances();
        console.log(`✅ Trade deleted: ID ${id}`);
        return true;
    } catch (error) {
        console.error('❌ Error deleting trade:', error);
        return false;
    }
}


// ========================================================================
// 4. BACKTEST CRUD OPERATIONS
// ========================================================================

/**
 * Lädt Backtest-Trades für eine bestimmte Session.
 * @param {string} sessionId - Session-ID (z.B. "backtest_2026-01-24_1")
 * @returns {Promise<Array>} - Array von Backtest-Trades
 */
async function dbLoadBacktests(sessionId = null) {
    try {
        let query = db.backtests;
        
        if (sessionId) {
            query = query.where('sessionId').equals(sessionId);
        }
        
        const backtests = await query.reverse().sortBy('date');
        console.log(`📊 Loaded ${backtests.length} backtest trades`);
        return backtests;
    } catch (error) {
        console.error('❌ Error loading backtests:', error);
        return [];
    }
}

/**
 * Speichert einen Backtest-Trade.
 * @param {object} backtest - Backtest-Objekt
 * @param {string} sessionId - Session-ID
 * @param {File|Blob} screenshot - Optional: Screenshot
 * @returns {Promise<number>} - Backtest-ID
 */
async function dbSaveBacktest(backtest, sessionId, screenshot = null) {
    try {
        backtest.sessionId = sessionId;
        backtest.createdAt = new Date().toISOString();
        
        const backtestId = await db.backtests.add(backtest);
        console.log(`✅ Backtest saved: ID ${backtestId}`);
        
        if (screenshot) {
            await dbSaveScreenshot(null, screenshot, 'backtest', backtestId);
        }
        
        return backtestId;
    } catch (error) {
        console.error('❌ Error saving backtest:', error);
        throw error;
    }
}

/**
 * Löscht alle Backtests einer Session.
 * @param {string} sessionId - Session-ID
 * @returns {Promise<boolean>} - Erfolg
 */
async function dbDeleteBacktestSession(sessionId) {
    try {
        const backtests = await db.backtests.where('sessionId').equals(sessionId).toArray();
        const backtestIds = backtests.map(b => b.id);
        
        // Lösche Backtests
        await db.backtests.where('sessionId').equals(sessionId).delete();
        
        // Lösche Screenshots
        for (const id of backtestIds) {
            await db.screenshots.where('backtestId').equals(id).delete();
        }
        
        console.log(`✅ Backtest session deleted: ${sessionId}`);
        return true;
    } catch (error) {
        console.error('❌ Error deleting backtest session:', error);
        return false;
    }
}


// ========================================================================
// 5. SCREENSHOT OPERATIONS (BLOB-BASIERT)
// ========================================================================

/**
 * Speichert einen Screenshot als komprimiertes Blob.
 * @param {number|null} tradeId - Trade-ID (null bei Backtest)
 * @param {File|Blob|string} image - Bild (File, Blob oder Base64)
 * @param {string} type - 'trade' oder 'backtest'
 * @param {number|null} backtestId - Backtest-ID (optional)
 * @returns {Promise<number>} - Screenshot-ID
 */
async function dbSaveScreenshot(tradeId, image, type = 'trade', backtestId = null) {
    try {
        // Komprimiere Bild zu Blob
        const blob = await compressImageToBlob(image);
        
        const screenshot = {
            tradeId: tradeId,
            backtestId: backtestId,
            type: type,
            blob: blob,
            size: blob.size,
            createdAt: new Date().toISOString()
        };
        
        const id = await db.screenshots.add(screenshot);
        console.log(`📷 Screenshot saved: ID ${id} (${(blob.size / 1024).toFixed(2)} KB)`);
        return id;
    } catch (error) {
        console.error('❌ Error saving screenshot:', error);
        throw error;
    }
}

/**
 * Lädt einen Screenshot für einen Trade.
 * @param {number} tradeId - Trade-ID
 * @returns {Promise<string|null>} - Data-URL oder null
 */
async function dbLoadTradeScreenshot(tradeId) {
    try {
        const screenshot = await db.screenshots.where('tradeId').equals(tradeId).first();
        
        if (screenshot && screenshot.blob) {
            return await blobToDataURL(screenshot.blob);
        }
        return null;
    } catch (error) {
        console.error('❌ Error loading screenshot:', error);
        return null;
    }
}

/**
 * Lädt mehrere Screenshots für mehrere Trades (optimiert).
 * @param {Array<number>} tradeIds - Array von Trade-IDs
 * @returns {Promise<Object>} - Map {tradeId: dataURL}
 */
async function dbLoadTradeScreenshots(tradeIds) {
    try {
        const screenshots = await db.screenshots.where('tradeId').anyOf(tradeIds).toArray();
        
        const result = {};
        for (const screenshot of screenshots) {
            if (screenshot.blob) {
                result[screenshot.tradeId] = await blobToDataURL(screenshot.blob);
            }
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error loading screenshots:', error);
        return {};
    }
}


// ========================================================================
// 6. COT DATA OPERATIONS
// ========================================================================

async function dbLoadCotData() {
    try {
        const data = await db.cotData.reverse().sortBy('date');
        return data;
    } catch (error) {
        console.error('❌ Error loading COT data:', error);
        return [];
    }
}

async function dbAddCotData(entry) {
    try {
        // Prüfe, ob Eintrag bereits existiert (Datum + Symbol)
        const existing = await db.cotData
            .where('[date+symbol]')
            .equals([entry.date, entry.symbol])
            .first();
        
        if (existing) {
            await db.cotData.update(existing.id, entry);
            console.log(`✅ COT data updated: ${entry.symbol}`);
        } else {
            await db.cotData.add(entry);
            console.log(`✅ COT data added: ${entry.symbol}`);
        }
        return true;
    } catch (error) {
        console.error('❌ Error adding COT data:', error);
        return false;
    }
}

async function dbDeleteCotEntry(id) {
    try {
        await db.cotData.delete(id);
        console.log(`✅ COT entry deleted: ID ${id}`);
        return true;
    } catch (error) {
        console.error('❌ Error deleting COT entry:', error);
        return false;
    }
}


// ========================================================================
// 7. NEWS DATA OPERATIONS
// ========================================================================

async function dbLoadNewsData() {
    try {
        const data = await db.newsData.reverse().sortBy('date');
        return data;
    } catch (error) {
        console.error('❌ Error loading news data:', error);
        return [];
    }
}

async function dbSaveNewsData(entry) {
    try {
        entry.createdAt = new Date().toISOString();
        await db.newsData.add(entry);
        console.log(`✅ News data saved`);
        return true;
    } catch (error) {
        console.error('❌ Error saving news data:', error);
        return false;
    }
}


// ========================================================================
// 8. ACCOUNT CONFIG & SETTINGS
// ========================================================================

/**
 * Lädt Account-Konfigurationen.
 * @returns {Promise<object>} - Account-Configs
 */
async function dbLoadAccountConfigs() {
    try {
        const configs = await db.accountConfigs.toArray();
        
        if (configs.length === 0) {
            // Erstelle Default-Config
            const defaultConfigs = getInitialConfig();
            await db.accountConfigs.bulkAdd([
                { type: 'ek', ...defaultConfigs.ek },
                { type: 'funded', ...defaultConfigs.funded }
            ]);
            return defaultConfigs;
        }
        
        // Konvertiere Array zu Object
        const result = {};
        configs.forEach(config => {
            result[config.type] = config;
        });
        
        return result;
    } catch (error) {
        console.error('❌ Error loading account configs:', error);
        return getInitialConfig();
    }
}

/**
 * Speichert Account-Konfigurationen.
 * @param {object} configs - {ek: {...}, funded: {...}}
 */
async function dbSaveAccountConfigs(configs) {
    try {
        for (const [type, config] of Object.entries(configs)) {
            await db.accountConfigs.put({ type, ...config });
        }
        console.log('✅ Account configs saved');
    } catch (error) {
        console.error('❌ Error saving account configs:', error);
    }
}

/**
 * Lädt eine generische Setting.
 * @param {string} key - Setting-Key
 * @param {any} defaultValue - Default-Wert
 * @returns {Promise<any>} - Setting-Wert
 */
async function dbLoadSetting(key, defaultValue = null) {
    try {
        const setting = await db.settings.get(key);
        return setting ? setting.value : defaultValue;
    } catch (error) {
        console.error(`❌ Error loading setting ${key}:`, error);
        return defaultValue;
    }
}

/**
 * Speichert eine generische Setting.
 * @param {string} key - Setting-Key
 * @param {any} value - Wert
 */
async function dbSaveSetting(key, value) {
    try {
        await db.settings.put({ key, value });
        console.log(`✅ Setting saved: ${key}`);
    } catch (error) {
        console.error(`❌ Error saving setting ${key}:`, error);
    }
}


// ========================================================================
// 9. TRANSACTIONS
// ========================================================================

async function dbLoadTransactions() {
    try {
        const transactions = await db.transactions.reverse().sortBy('date');
        return transactions;
    } catch (error) {
        console.error('❌ Error loading transactions:', error);
        return [];
    }
}

async function dbAddTransaction(transaction) {
    try {
        transaction.createdAt = new Date().toISOString();
        await db.transactions.add(transaction);
        await dbRecalculateBalances();
        console.log('✅ Transaction added');
        return true;
    } catch (error) {
        console.error('❌ Error adding transaction:', error);
        return false;
    }
}


// ========================================================================
// 10. BALANCE CALCULATION
// ========================================================================

/**
 * Berechnet PnL für einen Trade.
 * @param {object} trade - Trade-Objekt
 * @param {object} accountConfig - Account-Config
 * @returns {number} - PnL-Betrag
 */
function calculateTradePnL(trade, accountConfig) {
    const riskPercent = trade.riskPercent > 0 ? trade.riskPercent : accountConfig.defaultRiskPerTrade;
    const riskAmount = (accountConfig.initialStartBalance * (riskPercent / 100));
    const rMultiple = parseFloat(trade.rMultiple) || 0;
    return rMultiple * riskAmount;
}

/**
 * Re-kalkuliert alle Account-Balances basierend auf Trades und Transaktionen.
 */
async function dbRecalculateBalances() {
    try {
        const trades = await dbLoadTrades({ sessionType: 'live' }); // Nur Live-Trades
        const transactions = await dbLoadTransactions();
        const configs = await dbLoadAccountConfigs();
        
        let needsUpdate = false;
        
        for (const [accountType, config] of Object.entries(configs)) {
            let currentBalance = config.initialStartBalance;
            
            // Transaktionen
            transactions
                .filter(t => t.type === accountType)
                .forEach(t => {
                    currentBalance += t.amount;
                });
            
            // Trades
            trades
                .filter(t => t.type === accountType)
                .forEach(trade => {
                    const pnl = calculateTradePnL(trade, config);
                    currentBalance += pnl;
                });
            
            currentBalance = parseFloat(currentBalance.toFixed(2));
            
            if (config.currentBalance !== currentBalance) {
                config.currentBalance = currentBalance;
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            await dbSaveAccountConfigs(configs);
            console.log('✅ Balances recalculated');
        }
    } catch (error) {
        console.error('❌ Error recalculating balances:', error);
    }
}


// ========================================================================
// 11. INTEREST RATES (Currency Analysis)
// ========================================================================

/**
 * Lädt die Zinssätze für Währungen.
 * @returns {Promise<Array>} - Array von {currency, rate, updatedAt}
 */
async function dbLoadInterestRates() {
    try {
        const rates = await db.interestRates.toArray();
        return rates;
    } catch (error) {
        console.error('❌ Error loading interest rates:', error);
        return [];
    }
}

/**
 * Speichert/aktualisiert einen Zinssatz.
 * @param {string} currency - Währung (z.B. 'USD', 'EUR')
 * @param {number} rate - Zinssatz (z.B. 5.25)
 */
async function dbSaveInterestRate(currency, rate) {
    try {
        await db.interestRates.put({
            currency,
            rate: parseFloat(rate),
            updatedAt: new Date().toISOString()
        });
        console.log(`✅ Interest rate saved: ${currency} = ${rate}%`);
    } catch (error) {
        console.error('❌ Error saving interest rate:', error);
    }
}


// ========================================================================
// 12. UTILITY FUNCTIONS
// ========================================================================

/**
 * Berechnet Gesamt-R-Multiple für eine Liste von Trades.
 * @param {Array} trades - Array von Trades
 * @returns {number} - Gesamt-R
 */
function calculateTotalR(trades) {
    return trades.reduce((sum, trade) => sum + (parseFloat(trade.rMultiple) || 0), 0);
}

/**
 * Generiert eine eindeutige Session-ID für Backtests.
 * @returns {string} - Session-ID (z.B. "backtest_2026-01-24_1")
 */
function generateBacktestSessionId() {
    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    return `backtest_${date}_${timestamp}`;
}

/**
 * Liefert die initiale Konfiguration (für Kompatibilität).
 */
function getInitialConfig() {
    return {
        ek: {
            initialStartBalance: 10000.00,
            currentBalance: 10000.00,
            currency: 'USD',
            type: 'ek',
            defaultRiskPerTrade: 0.5
        },
        funded: {
            initialStartBalance: 100000.00,
            currentBalance: 100000.00,
            currency: 'USD',
            type: 'funded',
            enableGoals: true,
            profitTargetValue: 8.0,
            profitTargetType: 'percent',
            maxDrawdownValue: 5.0,
            maxDrawdownType: 'percent',
            profitTarget: 108000.00,
            maxDrawdown: 95000.00,
            defaultRiskPerTrade: 1.0
        }
    };
}


// ========================================================================
// 13. GLOBALE VERFÜGBARKEIT (Window Scope)
// ========================================================================

window.db = db;

// Trade Operations
window.dbLoadTrades = dbLoadTrades;
window.dbSaveTrade = dbSaveTrade;
window.dbUpdateTrade = dbUpdateTrade;
window.dbDeleteTrade = dbDeleteTrade;

// Backtest Operations
window.dbLoadBacktests = dbLoadBacktests;
window.dbSaveBacktest = dbSaveBacktest;
window.dbDeleteBacktestSession = dbDeleteBacktestSession;
window.generateBacktestSessionId = generateBacktestSessionId;

// Screenshot Operations
window.dbSaveScreenshot = dbSaveScreenshot;
window.dbLoadTradeScreenshot = dbLoadTradeScreenshot;
window.dbLoadTradeScreenshots = dbLoadTradeScreenshots;
window.compressImageToBlob = compressImageToBlob;
window.blobToDataURL = blobToDataURL;

// COT Data
window.dbLoadCotData = dbLoadCotData;
window.dbAddCotData = dbAddCotData;
window.dbDeleteCotEntry = dbDeleteCotEntry;

// News Data
window.dbLoadNewsData = dbLoadNewsData;
window.dbSaveNewsData = dbSaveNewsData;

// Account & Settings
window.dbLoadAccountConfigs = dbLoadAccountConfigs;
window.dbSaveAccountConfigs = dbSaveAccountConfigs;
window.dbLoadSetting = dbLoadSetting;
window.dbSaveSetting = dbSaveSetting;

// Transactions
window.dbLoadTransactions = dbLoadTransactions;
window.dbAddTransaction = dbAddTransaction;

// Balance
window.dbRecalculateBalances = dbRecalculateBalances;
window.calculateTradePnL = calculateTradePnL;
window.calculateTotalR = calculateTotalR;

// Interest Rates
window.dbLoadInterestRates = dbLoadInterestRates;
window.dbSaveInterestRate = dbSaveInterestRate;

// Helpers
window.getInitialConfig = getInitialConfig;

console.log('✅ Database layer loaded and ready!');
