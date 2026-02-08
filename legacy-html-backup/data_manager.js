/* Trading Journal/data_manager.js */
/**
 * ========================================================================
 * Trading Journal - Data Manager (Compatibility Layer)
 * ========================================================================
 * 
 * Dieser File dient als Kompatibilitäts-Layer für existierenden Code.
 * Alle Funktionen leiten jetzt auf die neue IndexedDB (db.js) weiter.
 * 
 * WICHTIG: Neue Features sollten direkt die db.js Funktionen nutzen!
 * Diese Datei existiert nur für Abwärtskompatibilität.
 */

// ======================================================================
// 0. LEGACY KEYS (nur für Migration relevant)
// ======================================================================
const ACCOUNT_CONFIG_KEY = 'tradingJournalAccountConfigs';
const TRADES_STORAGE_KEY = 'tradingJournalTrades';
const COT_STORAGE_KEY = 'tradingJournalCotData';
const BIAS_STORAGE_KEY = 'tradingJournalBiasData';
const TRANSACTION_STORAGE_KEY = 'tradingJournalTransactions';
const NEWS_STORAGE_KEY = 'tradingJournalNewsData';
const THEME_KEY = 'tradingJournalTheme'; 


// ======================================================================
// 1. KONTOKONFIGURATION UND BILANZ
// ======================================================================

/**
 * Erstellt eine initiale Kontokonfiguration.
 * Trailing DD wurde entfernt.
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
            // --- NEUE FLEXIBLE ZIEL-FELDER ---
            enableGoals: true,
            profitTargetValue: 8.0, 
            profitTargetType: 'percent', 
            maxDrawdownValue: 5.0, 
            maxDrawdownType: 'percent',
            
            // --- ABSOLUTE FELDER (Wird von kontoeinstellungen.js berechnet) ---
            profitTarget: 108000.00,
            maxDrawdown: 95000.00, // Statischer DD
            defaultRiskPerTrade: 1.0 
        }
    };
}

/**
 * Lädt die Kontokonfigurationen (ASYNC via IndexedDB).
 * @returns {Promise<object>} - Account Configs
 */
async function loadAccountConfigs() {
    return await dbLoadAccountConfigs();
}

/**
 * Speichert die Kontokonfigurationen (ASYNC via IndexedDB).
 * @param {object} configs - Account Configs
 */
async function saveAccountConfigs(configs) {
    await dbSaveAccountConfigs(configs);
}



/**
 * Berechnet den PnL-Betrag für einen einzelnen Trade basierend auf dem R-Multiple.
 * @param {object} trade - Der Trade-Eintrag.
 * @param {object} accountConfig - Die Konfiguration des Kontos.
 * @returns {number} Der PnL-Betrag in der Kontowährung.
 */
function calculateTradePnL(trade, accountConfig) {
    const riskPercent = trade.riskPercent > 0 ? trade.riskPercent : accountConfig.defaultRiskPerTrade;
    
    // Berechne den absoluten Risiko-Betrag
    // Basis ist der Startsaldo, da der Risiko-Betrag in der Regel zu Beginn des Kontos festgelegt wird
    const riskAmount = (accountConfig.initialStartBalance * (riskPercent / 100));
    
    const rMultiple = parseFloat(trade.rMultiple) || 0;
    
    // PnL = R-Multiple * Risiko-Betrag
    return rMultiple * riskAmount;
}


/**
 * Re-Kalkuliert alle aktuellen Kontostände (ASYNC via IndexedDB).
 */
async function recalculateAllBalances() {
    await dbRecalculateBalances();
}

/**
 * Berechnet das Gesamt-R-Multiple für eine Liste von Trades (für Header-Style F3).
 */
function calculateTotalR(trades) {
    return trades.reduce((sum, trade) => sum + (parseFloat(trade.rMultiple) || 0), 0);
}


// ======================================================================
// 2. TRADE CRUD (ASYNC via IndexedDB)
// ======================================================================

/**
 * Lädt alle Trades (ASYNC).
 * @returns {Promise<Array>} - Array von Trades
 */
async function loadTrades() {
    try {
        const trades = await dbLoadTrades({ sessionType: 'live' });
        return trades;
    } catch (error) {
        console.error('Error loading trades:', error);
        if (typeof showToast === 'function') {
            showToast('Fehler beim Laden der Trades', 'error');
        }
        return [];
    }
}

/**
 * Speichert einen Trade (ASYNC).
 * @param {object} trade - Trade-Objekt
 * @param {File|Blob|string} screenshot - Optional: Screenshot
 * @returns {Promise<boolean>} - Erfolg
 */
async function saveTrade(trade, screenshot = null) {
    try {
        await dbSaveTrade(trade, screenshot);
        
        if (typeof showToast === 'function') {
            showToast('Trade erfolgreich gespeichert', 'success');
        }
        return true;
    } catch (error) {
        console.error('Error saving trade:', error);
        if (typeof showToast === 'function') {
            showToast('Fehler beim Speichern des Trades', 'error');
        }
        return false;
    }
}

/**
 * Löscht einen Trade (ASYNC).
 * @param {number} id - Trade-ID
 * @returns {Promise<boolean>} - Erfolg
 */
async function deleteTrade(id) {
    try {
        const success = await dbDeleteTrade(id);
        
        if (!success) {
            console.warn('Trade not found for deletion:', id);
            return false;
        }
        
        if (typeof showToast === 'function') {
            showToast('Trade gelöscht', 'success');
        }
        return true;
    } catch (error) {
        console.error('Error deleting trade:', error);
        if (typeof showToast === 'function') {
            showToast('Fehler beim Löschen des Trades', 'error');
        }
        return false;
    }
}

/**
 * Aktualisiert einen Trade (ASYNC).
 * @param {object} updatedTrade - Trade-Objekt mit ID
 * @returns {Promise<boolean>} - Erfolg
 */
async function updateTrade(updatedTrade) {
    try {
        const success = await dbUpdateTrade(updatedTrade.id, updatedTrade);
        
        if (!success) {
            console.warn('Trade not found for update:', updatedTrade.id);
            return false;
        }
        
        if (typeof showToast === 'function') {
            showToast('Trade aktualisiert', 'success');
        }
        return true;
    } catch (error) {
        console.error('Error updating trade:', error);
        if (typeof showToast === 'function') {
            showToast('Fehler beim Aktualisieren des Trades', 'error');
        }
        return false;
    }
}


// ======================================================================
// 3. COT-DATEN CRUD (ASYNC via IndexedDB)
// ======================================================================

async function loadCotData() {
    return await dbLoadCotData();
}

async function addCotData(entry) {
    return await dbAddCotData(entry);
}

async function deleteCotEntry(id) {
    return await dbDeleteCotEntry(id);
}


// ======================================================================
// 4. BIAS-DATEN (LEGACY - wird nicht mehr verwendet)
// ======================================================================

function loadBiasData() {
    console.warn('loadBiasData is deprecated');
    return [];
}

function addBiasData(entry) {
    console.warn('addBiasData is deprecated');
}

function deleteBiasEntry(id) {
    console.warn('deleteBiasEntry is deprecated');
}

// ======================================================================
// 5. TRANSAKTIONEN CRUD (ASYNC via IndexedDB)
// ======================================================================

async function loadTransactions() {
    return await dbLoadTransactions();
}

async function addTransaction(transaction) {
    return await dbAddTransaction(transaction);
}


// ======================================================================
// 6. NEWS-DATEN CRUD (ASYNC via IndexedDB)
// ======================================================================

async function loadNewsData() {
    return await dbLoadNewsData();
}

async function saveNewsData(entry) {
    return await dbSaveNewsData(entry);
}


// ======================================================================
// 7. DATEN-RESET FUNKTIONEN (ASYNC via IndexedDB)
// ======================================================================

/**
 * Löscht alle Trades und Transaktionen für einen bestimmten Kontotyp.
 */
async function clearAccountData(accountType) {
    try {
        // Trades löschen
        const trades = await dbLoadTrades({ type: accountType, sessionType: 'live' });
        for (const trade of trades) {
            await dbDeleteTrade(trade.id);
        }
        
        // Transaktionen löschen
        const transactions = await dbLoadTransactions();
        for (const transaction of transactions.filter(t => t.type === accountType)) {
            await db.transactions.delete(transaction.id);
        }
        
        console.log(`✅ Account data cleared: ${accountType}`);
    } catch (error) {
        console.error('❌ Error clearing account data:', error);
    }
}

/**
 * Setzt die Konfiguration eines Kontos auf die Werkseinstellungen zurück
 * UND löscht alle zugehörigen Daten.
 */
async function resetAccount(accountType) {
    const initialConfig = getInitialConfig();
    const configs = await loadAccountConfigs();
    
    // 1. Konfiguration zurücksetzen
    configs[accountType] = initialConfig[accountType];
    await saveAccountConfigs(configs);
    
    // 2. Daten löschen
    await clearAccountData(accountType);
    
    // 3. Salden neu berechnen (setzt currentBalance auf initialStartBalance)
    await recalculateAllBalances();
    
    console.log(`✅ Account reset: ${accountType}`);
}


// ======================================================================
// 8. GLOBALE VERFÜGBARKEIT (Window Scope)
// ======================================================================

// Exportiere alle Funktionen zur globalen Verwendung in anderen Skripten
window.loadTrades = loadTrades;
window.saveTrade = saveTrade;
window.deleteTrade = deleteTrade;
window.updateTrade = updateTrade;

window.loadCotData = loadCotData;
window.addCotData = addCotData;
window.deleteCotEntry = deleteCotEntry;

window.loadBiasData = loadBiasData;
window.addBiasData = addBiasData;
window.deleteBiasEntry = deleteBiasEntry;

window.loadAccountConfigs = loadAccountConfigs;
window.saveAccountConfigs = saveAccountConfigs;
window.calculateTradePnL = calculateTradePnL;
window.recalculateAllBalances = recalculateAllBalances;
window.calculateTotalR = calculateTotalR;

window.loadTransactions = loadTransactions;
window.addTransaction = addTransaction;

window.loadNewsData = loadNewsData;
window.saveNewsData = saveNewsData;

window.resetAccount = resetAccount;
window.clearAccountData = clearAccountData;

window.getInitialConfig = getInitialConfig;

console.log('✅ Data Manager (Compatibility Layer) loaded');
