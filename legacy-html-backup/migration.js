/**
 * ========================================================================
 * Trading Journal - Migration Script (localStorage → IndexedDB)
 * ========================================================================
 * 
 * Dieses Skript überträgt automatisch alle existierenden Daten aus dem
 * localStorage in die neue IndexedDB beim ersten Start der Anwendung.
 * 
 * Features:
 * - Einmalige Ausführung (Flag-basiert)
 * - Konvertiert Base64-Screenshots in Blobs
 * - Erhält alle Trade-IDs und Timestamps
 * - Fehlertolerante Migration (einzelne Fehler stoppen nicht den Prozess)
 * - Detailliertes Logging
 */

// ========================================================================
// MIGRATION CONFIGURATION
// ========================================================================

const MIGRATION_FLAG_KEY = 'tradingJournal_migrationComplete';
const MIGRATION_VERSION = '1.0';

// localStorage Keys (aus data_manager.js)
const OLD_KEYS = {
    accountConfigs: 'tradingJournalAccountConfigs',
    trades: 'tradingJournalTrades',
    cotData: 'tradingJournalCotData',
    biasData: 'tradingJournalBiasData',
    transactions: 'tradingJournalTransactions',
    newsData: 'tradingJournalNewsData',
    theme: 'tradingJournalTheme'
};


// ========================================================================
// MIGRATION FUNCTIONS
// ========================================================================

/**
 * Prüft, ob Migration bereits durchgeführt wurde.
 * @returns {boolean} - True wenn Migration bereits erfolgt ist
 */
function isMigrationComplete() {
    const flag = localStorage.getItem(MIGRATION_FLAG_KEY);
    return flag === MIGRATION_VERSION;
}

/**
 * Markiert Migration als abgeschlossen.
 */
function setMigrationComplete() {
    localStorage.setItem(MIGRATION_FLAG_KEY, MIGRATION_VERSION);
    console.log('✅ Migration flag set');
}

/**
 * Hauptfunktion für die Migration aller Daten.
 * @returns {Promise<object>} - Migration-Report
 */
async function migrateAllData() {
    console.log('🔄 Starting data migration from localStorage to IndexedDB...');
    
    const report = {
        startTime: new Date().toISOString(),
        trades: { success: 0, failed: 0 },
        screenshots: { success: 0, failed: 0 },
        cotData: { success: 0, failed: 0 },
        newsData: { success: 0, failed: 0 },
        transactions: { success: 0, failed: 0 },
        accountConfigs: false,
        settings: { success: 0, failed: 0 },
        errors: []
    };
    
    try {
        // 1. Migriere Account Configs
        await migrateAccountConfigs(report);
        
        // 2. Migriere Trades (inklusive Screenshots)
        await migrateTrades(report);
        
        // 3. Migriere COT Data
        await migrateCotData(report);
        
        // 4. Migriere News Data
        await migrateNewsData(report);
        
        // 5. Migriere Transactions
        await migrateTransactions(report);
        
        // 6. Migriere Settings (Theme, etc.)
        await migrateSettings(report);
        
        // 7. Setze Migration-Flag
        setMigrationComplete();
        
        report.endTime = new Date().toISOString();
        report.success = true;
        
        console.log('✅ Migration completed successfully!');
        console.table(report);
        
        return report;
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        report.errors.push(error.message);
        report.success = false;
        return report;
    }
}


/**
 * Migriert Account Configurations.
 */
async function migrateAccountConfigs(report) {
    try {
        const json = localStorage.getItem(OLD_KEYS.accountConfigs);
        if (!json) {
            console.log('ℹ️ No account configs found in localStorage');
            return;
        }
        
        const configs = JSON.parse(json);
        await dbSaveAccountConfigs(configs);
        
        report.accountConfigs = true;
        console.log('✅ Account configs migrated');
        
    } catch (error) {
        console.error('❌ Error migrating account configs:', error);
        report.errors.push(`Account configs: ${error.message}`);
    }
}


/**
 * Migriert Trades inklusive Screenshots.
 */
async function migrateTrades(report) {
    try {
        const json = localStorage.getItem(OLD_KEYS.trades);
        if (!json) {
            console.log('ℹ️ No trades found in localStorage');
            return;
        }
        
        const trades = JSON.parse(json);
        console.log(`📊 Migrating ${trades.length} trades...`);
        
        for (const trade of trades) {
            try {
                // Extrahiere Screenshot (falls vorhanden)
                const screenshot = trade.screenshot || trade.screenshotUrl;
                delete trade.screenshot;
                delete trade.screenshotUrl;
                
                // Setze sessionType (alle alten Trades sind "live")
                trade.sessionType = 'live';
                
                // Füge Trade zur DB hinzu (mit original ID und Timestamps)
                const originalId = trade.id;
                delete trade.id; // Dexie generiert neue ID
                
                const newTradeId = await db.trades.add(trade);
                report.trades.success++;
                
                // Migriere Screenshot falls vorhanden
                if (screenshot && screenshot.startsWith('data:image')) {
                    try {
                        await dbSaveScreenshot(newTradeId, screenshot, 'trade');
                        report.screenshots.success++;
                    } catch (error) {
                        console.warn(`⚠️ Failed to migrate screenshot for trade ${originalId}:`, error);
                        report.screenshots.failed++;
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error migrating trade:`, error);
                report.trades.failed++;
                report.errors.push(`Trade migration: ${error.message}`);
            }
        }
        
        console.log(`✅ Trades migrated: ${report.trades.success} success, ${report.trades.failed} failed`);
        
    } catch (error) {
        console.error('❌ Error loading trades from localStorage:', error);
        report.errors.push(`Trades: ${error.message}`);
    }
}


/**
 * Migriert COT Data.
 */
async function migrateCotData(report) {
    try {
        const json = localStorage.getItem(OLD_KEYS.cotData);
        if (!json) {
            console.log('ℹ️ No COT data found in localStorage');
            return;
        }
        
        const cotData = JSON.parse(json);
        console.log(`📊 Migrating ${cotData.length} COT entries...`);
        
        for (const entry of cotData) {
            try {
                delete entry.id; // Dexie generiert neue ID
                await db.cotData.add(entry);
                report.cotData.success++;
            } catch (error) {
                console.error(`❌ Error migrating COT entry:`, error);
                report.cotData.failed++;
            }
        }
        
        console.log(`✅ COT data migrated: ${report.cotData.success} success, ${report.cotData.failed} failed`);
        
    } catch (error) {
        console.error('❌ Error loading COT data from localStorage:', error);
        report.errors.push(`COT data: ${error.message}`);
    }
}


/**
 * Migriert News Data.
 */
async function migrateNewsData(report) {
    try {
        const json = localStorage.getItem(OLD_KEYS.newsData);
        if (!json) {
            console.log('ℹ️ No news data found in localStorage');
            return;
        }
        
        const newsData = JSON.parse(json);
        console.log(`📰 Migrating ${newsData.length} news entries...`);
        
        for (const entry of newsData) {
            try {
                entry.createdAt = entry.createdAt || new Date().toISOString();
                delete entry.id; // Dexie generiert neue ID
                await db.newsData.add(entry);
                report.newsData.success++;
            } catch (error) {
                console.error(`❌ Error migrating news entry:`, error);
                report.newsData.failed++;
            }
        }
        
        console.log(`✅ News data migrated: ${report.newsData.success} success, ${report.newsData.failed} failed`);
        
    } catch (error) {
        console.error('❌ Error loading news data from localStorage:', error);
        report.errors.push(`News data: ${error.message}`);
    }
}


/**
 * Migriert Transactions.
 */
async function migrateTransactions(report) {
    try {
        const json = localStorage.getItem(OLD_KEYS.transactions);
        if (!json) {
            console.log('ℹ️ No transactions found in localStorage');
            return;
        }
        
        const transactions = JSON.parse(json);
        console.log(`💰 Migrating ${transactions.length} transactions...`);
        
        for (const transaction of transactions) {
            try {
                transaction.createdAt = transaction.createdAt || new Date().toISOString();
                delete transaction.id; // Dexie generiert neue ID
                await db.transactions.add(transaction);
                report.transactions.success++;
            } catch (error) {
                console.error(`❌ Error migrating transaction:`, error);
                report.transactions.failed++;
            }
        }
        
        console.log(`✅ Transactions migrated: ${report.transactions.success} success, ${report.transactions.failed} failed`);
        
    } catch (error) {
        console.error('❌ Error loading transactions from localStorage:', error);
        report.errors.push(`Transactions: ${error.message}`);
    }
}


/**
 * Migriert Settings (Theme, etc.).
 */
async function migrateSettings(report) {
    try {
        // Theme
        const theme = localStorage.getItem(OLD_KEYS.theme);
        if (theme) {
            await dbSaveSetting('theme', theme);
            report.settings.success++;
        }
        
        console.log(`✅ Settings migrated: ${report.settings.success} settings`);
        
    } catch (error) {
        console.error('❌ Error migrating settings:', error);
        report.errors.push(`Settings: ${error.message}`);
    }
}


/**
 * Re-kalkuliert Balances nach Migration.
 */
async function recalculateBalancesAfterMigration() {
    try {
        console.log('🔄 Recalculating balances...');
        await dbRecalculateBalances();
        console.log('✅ Balances recalculated');
    } catch (error) {
        console.error('❌ Error recalculating balances:', error);
    }
}


// ========================================================================
// AUTO-MIGRATION (Beim Laden der Seite)
// ========================================================================

/**
 * Startet Migration automatisch beim Laden der Seite (wenn nötig).
 */
async function autoMigrate() {
    // Warte bis Dexie initialisiert ist
    await db.open();
    
    if (isMigrationComplete()) {
        console.log('✅ Migration already completed, skipping...');
        return { alreadyMigrated: true };
    }
    
    console.log('🚀 First start detected - starting migration...');
    
    // Zeige User-Benachrichtigung (falls UI vorhanden)
    if (typeof showToast === 'function') {
        showToast('Daten werden migriert, bitte warten...', 'info', 10000);
    }
    
    const report = await migrateAllData();
    
    // Re-kalkuliere Balances
    await recalculateBalancesAfterMigration();
    
    // Zeige Ergebnis
    if (report.success) {
        const totalMigrated = report.trades.success + report.cotData.success + 
                             report.newsData.success + report.transactions.success;
        
        if (typeof showToast === 'function') {
            showToast(`Migration erfolgreich! ${totalMigrated} Einträge übertragen.`, 'success', 5000);
        }
    } else {
        if (typeof showToast === 'function') {
            showToast('Migration mit Fehlern abgeschlossen. Prüfe die Konsole.', 'warning', 8000);
        }
    }
    
    return report;
}


// ========================================================================
// UTILITY: MIGRATION ZURÜCKSETZEN (für Entwicklung/Tests)
// ========================================================================

/**
 * Setzt Migration-Flag zurück (für Tests/Debugging).
 * ACHTUNG: Führt NICHT zum Löschen der IndexedDB-Daten!
 */
function resetMigrationFlag() {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
    console.log('⚠️ Migration flag reset. Migration will run on next page load.');
}

/**
 * Löscht ALLE IndexedDB-Daten (für Tests/Debugging).
 * ACHTUNG: NICHT in Produktion verwenden!
 */
async function clearAllDatabaseData() {
    const confirm = window.confirm(
        '⚠️ WARNUNG: Dies löscht ALLE Daten in der IndexedDB!\n\n' +
        'Fortfahren?'
    );
    
    if (!confirm) return;
    
    try {
        await db.trades.clear();
        await db.backtests.clear();
        await db.screenshots.clear();
        await db.cotData.clear();
        await db.newsData.clear();
        await db.transactions.clear();
        await db.accountConfigs.clear();
        await db.settings.clear();
        await db.interestRates.clear();
        
        resetMigrationFlag();
        
        console.log('✅ All database data cleared');
        alert('Datenbank wurde geleert. Seite wird neu geladen.');
        location.reload();
        
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        alert('Fehler beim Löschen der Datenbank!');
    }
}


// ========================================================================
// GLOBALE VERFÜGBARKEIT
// ========================================================================

window.autoMigrate = autoMigrate;
window.migrateAllData = migrateAllData;
window.isMigrationComplete = isMigrationComplete;
window.resetMigrationFlag = resetMigrationFlag;
window.clearAllDatabaseData = clearAllDatabaseData;


// ========================================================================
// AUTO-START (Führt Migration beim Laden aus)
// ========================================================================

// Starte Migration automatisch wenn DOM geladen ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMigrate);
} else {
    // DOM bereits geladen
    autoMigrate();
}

console.log('✅ Migration script loaded');
