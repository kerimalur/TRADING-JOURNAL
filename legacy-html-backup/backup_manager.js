/* ====================================================================== */
/* BACKUP MANAGER - IndexedDB Auto-Backup & Recovery System              */
/* Verhindert Datenverlust durch automatisches Backup aller Daten         */
/* ====================================================================== */

const BackupManager = (function() {
    'use strict';

    // =====================================================================
    // KONFIGURATION
    // =====================================================================
    const CONFIG = {
        DB_NAME: 'TradingJournalBackup',
        DB_VERSION: 1,
        STORES: {
            BACKUPS: 'backups',
            AUTO_SAVES: 'autoSaves'
        },
        AUTO_BACKUP_INTERVAL: 5 * 60 * 1000, // 5 Minuten
        MAX_AUTO_BACKUPS: 50, // Letzte 50 Auto-Saves behalten
        MAX_MANUAL_BACKUPS: 100 // Letzte 100 manuelle Backups
    };

    let db = null;
    let autoBackupTimer = null;

    // =====================================================================
    // INDEXEDDB INITIALISIERUNG
    // =====================================================================
    
    /**
     * Initialisiert die IndexedDB
     */
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
            
            request.onerror = () => {
                console.error('❌ IndexedDB open error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                db = request.result;
                console.log('✅ IndexedDB initialized');
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                
                // Backup Store
                if (!database.objectStoreNames.contains(CONFIG.STORES.BACKUPS)) {
                    const backupStore = database.createObjectStore(CONFIG.STORES.BACKUPS, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    backupStore.createIndex('timestamp', 'timestamp', { unique: false });
                    backupStore.createIndex('type', 'type', { unique: false });
                }
                
                // Auto-Save Store
                if (!database.objectStoreNames.contains(CONFIG.STORES.AUTO_SAVES)) {
                    const autoSaveStore = database.createObjectStore(CONFIG.STORES.AUTO_SAVES, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    autoSaveStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                console.log('✅ IndexedDB stores created');
            };
        });
    }

    // =====================================================================
    // BACKUP FUNKTIONEN
    // =====================================================================
    
    /**
     * Sammelt alle LocalStorage-Daten
     */
    function collectAllData() {
        const data = {
            trades: localStorage.getItem('tradingJournalTrades'),
            accountConfigs: localStorage.getItem('tradingJournalAccountConfigs'),
            cotData: localStorage.getItem('tradingJournalCotData'),
            biasData: localStorage.getItem('tradingJournalBiasData'),
            transactions: localStorage.getItem('tradingJournalTransactions'),
            newsData: localStorage.getItem('tradingJournalNewsData'),
            theme: localStorage.getItem('tradingJournalTheme'),
            passwordHash: localStorage.getItem('tradingJournalPasswordHash'),
            sidebarCollapsed: localStorage.getItem('sidebarCollapsed'),
            // API Cache
            cachedCotData: localStorage.getItem('apiService_cachedCotData'),
            cachedNewsData: localStorage.getItem('apiService_cachedNewsData'),
            lastCotUpdate: localStorage.getItem('apiService_lastCotUpdate'),
            lastNewsUpdate: localStorage.getItem('apiService_lastNewsUpdate')
        };
        
        // Statistiken
        const stats = {
            totalTrades: data.trades ? JSON.parse(data.trades).length : 0,
            totalCOT: data.cotData ? JSON.parse(data.cotData).length : 0,
            totalNews: data.newsData ? JSON.parse(data.newsData).length : 0,
            dataSize: JSON.stringify(data).length
        };
        
        return { data, stats };
    }
    
    /**
     * Erstellt ein manuelles Backup
     */
    async function createBackup(description = '') {
        try {
            if (!db) await initDB();
            
            const { data, stats } = collectAllData();
            
            const backup = {
                timestamp: Date.now(),
                date: new Date().toISOString(),
                type: 'manual',
                description: description || `Manual Backup ${new Date().toLocaleString('de-DE')}`,
                data: data,
                stats: stats,
                version: '2.0.0'
            };
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.BACKUPS], 'readwrite');
                const store = transaction.objectStore(CONFIG.STORES.BACKUPS);
                const request = store.add(backup);
                
                request.onsuccess = () => {
                    console.log('✅ Manual backup created:', request.result);
                    cleanupOldBackups(CONFIG.STORES.BACKUPS, CONFIG.MAX_MANUAL_BACKUPS);
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    console.error('❌ Backup creation failed:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ Create backup error:', error);
            throw error;
        }
    }
    
    /**
     * Erstellt ein automatisches Backup
     */
    async function createAutoSave() {
        try {
            if (!db) await initDB();
            
            const { data, stats } = collectAllData();
            
            // Prüfe ob sich Daten geändert haben
            const lastAutoSave = await getLatestAutoSave();
            if (lastAutoSave) {
                const lastDataHash = hashData(lastAutoSave.data);
                const currentDataHash = hashData(data);
                
                if (lastDataHash === currentDataHash) {
                    console.log('⏭️ No data changes, skipping auto-save');
                    return null;
                }
            }
            
            const autoSave = {
                timestamp: Date.now(),
                date: new Date().toISOString(),
                data: data,
                stats: stats
            };
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.AUTO_SAVES], 'readwrite');
                const store = transaction.objectStore(CONFIG.STORES.AUTO_SAVES);
                const request = store.add(autoSave);
                
                request.onsuccess = () => {
                    console.log('✅ Auto-save created:', request.result);
                    cleanupOldBackups(CONFIG.STORES.AUTO_SAVES, CONFIG.MAX_AUTO_BACKUPS);
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    console.error('❌ Auto-save failed:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ Create auto-save error:', error);
            return null;
        }
    }
    
    /**
     * Einfacher Hash für Daten-Vergleich
     */
    function hashData(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
    
    /**
     * Räumt alte Backups auf
     */
    async function cleanupOldBackups(storeName, maxCount) {
        try {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index('timestamp');
            
            const countRequest = store.count();
            countRequest.onsuccess = () => {
                const count = countRequest.result;
                
                if (count > maxCount) {
                    const deleteCount = count - maxCount;
                    const getAllRequest = index.openCursor();
                    let deleted = 0;
                    
                    getAllRequest.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && deleted < deleteCount) {
                            store.delete(cursor.primaryKey);
                            deleted++;
                            cursor.continue();
                        }
                    };
                }
            };
        } catch (error) {
            console.error('❌ Cleanup error:', error);
        }
    }

    // =====================================================================
    // WIEDERHERSTELLUNGS-FUNKTIONEN
    // =====================================================================
    
    /**
     * Listet alle Backups auf
     */
    async function listBackups() {
        try {
            if (!db) await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.BACKUPS], 'readonly');
                const store = transaction.objectStore(CONFIG.STORES.BACKUPS);
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const backups = request.result.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(backups);
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ List backups error:', error);
            return [];
        }
    }
    
    /**
     * Holt das letzte Auto-Save
     */
    async function getLatestAutoSave() {
        try {
            if (!db) await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.AUTO_SAVES], 'readonly');
                const store = transaction.objectStore(CONFIG.STORES.AUTO_SAVES);
                const index = store.index('timestamp');
                const request = index.openCursor(null, 'prev');
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    resolve(cursor ? cursor.value : null);
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Get latest auto-save error:', error);
            return null;
        }
    }
    
    /**
     * Stellt ein Backup wieder her
     */
    async function restoreBackup(backupId) {
        try {
            if (!db) await initDB();
            
            const backup = await new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.BACKUPS], 'readonly');
                const store = transaction.objectStore(CONFIG.STORES.BACKUPS);
                const request = store.get(backupId);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            if (!backup) {
                throw new Error('Backup not found');
            }
            
            // Erstelle Backup des aktuellen Zustands vor Wiederherstellung
            await createBackup('Before restore - Safety backup');
            
            // Stelle Daten wieder her
            const { data } = backup;
            Object.keys(data).forEach(key => {
                const storageKey = key.includes('_') 
                    ? key 
                    : key === 'trades' ? 'tradingJournalTrades'
                    : key === 'accountConfigs' ? 'tradingJournalAccountConfigs'
                    : key === 'cotData' ? 'tradingJournalCotData'
                    : key === 'biasData' ? 'tradingJournalBiasData'
                    : key === 'transactions' ? 'tradingJournalTransactions'
                    : key === 'newsData' ? 'tradingJournalNewsData'
                    : key === 'theme' ? 'tradingJournalTheme'
                    : key === 'passwordHash' ? 'tradingJournalPasswordHash'
                    : key === 'sidebarCollapsed' ? 'sidebarCollapsed'
                    : key;
                
                if (data[key] !== null) {
                    localStorage.setItem(storageKey, data[key]);
                }
            });
            
            console.log('✅ Backup restored successfully');
            return true;
        } catch (error) {
            console.error('❌ Restore backup error:', error);
            throw error;
        }
    }
    
    /**
     * Exportiert ein Backup als JSON-Datei
     */
    async function exportBackup(backupId) {
        try {
            const backup = await new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.BACKUPS], 'readonly');
                const store = transaction.objectStore(CONFIG.STORES.BACKUPS);
                const request = store.get(backupId);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            if (!backup) {
                throw new Error('Backup not found');
            }
            
            const blob = new Blob([JSON.stringify(backup, null, 2)], { 
                type: 'application/json' 
            });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `trading_journal_backup_${new Date(backup.timestamp).toISOString().split('T')[0]}_${backup.id}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('✅ Backup exported');
            return true;
        } catch (error) {
            console.error('❌ Export backup error:', error);
            throw error;
        }
    }
    
    /**
     * Importiert ein Backup aus JSON-Datei
     */
    async function importBackup(file) {
        try {
            const text = await file.text();
            const backup = JSON.parse(text);
            
            // Validierung
            if (!backup.data || !backup.timestamp) {
                throw new Error('Invalid backup file format');
            }
            
            // Füge als neues Backup hinzu
            backup.type = 'imported';
            backup.description = `Imported from ${file.name}`;
            delete backup.id; // Lasse DB neue ID generieren
            
            if (!db) await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.BACKUPS], 'readwrite');
                const store = transaction.objectStore(CONFIG.STORES.BACKUPS);
                const request = store.add(backup);
                
                request.onsuccess = () => {
                    console.log('✅ Backup imported:', request.result);
                    resolve(request.result);
                };
                
                request.onerror = () => {
                    console.error('❌ Import failed:', request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error('❌ Import backup error:', error);
            throw error;
        }
    }
    
    /**
     * Löscht ein Backup
     */
    async function deleteBackup(backupId) {
        try {
            if (!db) await initDB();
            
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([CONFIG.STORES.BACKUPS], 'readwrite');
                const store = transaction.objectStore(CONFIG.STORES.BACKUPS);
                const request = store.delete(backupId);
                
                request.onsuccess = () => {
                    console.log('✅ Backup deleted:', backupId);
                    resolve(true);
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('❌ Delete backup error:', error);
            throw error;
        }
    }

    // =====================================================================
    // AUTO-BACKUP TIMER
    // =====================================================================
    
    /**
     * Startet den automatischen Backup-Timer
     */
    function startAutoBackup() {
        console.log('🚀 Starting auto-backup timer...');
        
        // Sofortiges Backup beim Start
        setTimeout(() => createAutoSave(), 5000);
        
        // Periodisches Backup
        autoBackupTimer = setInterval(() => {
            createAutoSave();
        }, CONFIG.AUTO_BACKUP_INTERVAL);
    }
    
    /**
     * Stoppt den automatischen Backup-Timer
     */
    function stopAutoBackup() {
        if (autoBackupTimer) {
            clearInterval(autoBackupTimer);
            autoBackupTimer = null;
            console.log('⏹️ Auto-backup stopped');
        }
    }

    // =====================================================================
    // RECOVERY ASSISTANT
    // =====================================================================
    
    /**
     * Prüft ob Daten-Recovery nötig ist
     */
    async function checkForDataLoss() {
        try {
            // Prüfe ob wichtige Daten fehlen
            const trades = localStorage.getItem('tradingJournalTrades');
            const configs = localStorage.getItem('tradingJournalAccountConfigs');
            
            if (!trades || !configs) {
                console.warn('⚠️ Missing critical data in LocalStorage');
                
                // Versuche Auto-Recovery
                const latestAutoSave = await getLatestAutoSave();
                if (latestAutoSave) {
                    return {
                        dataLoss: true,
                        recoverable: true,
                        autoSave: latestAutoSave
                    };
                }
                
                return {
                    dataLoss: true,
                    recoverable: false
                };
            }
            
            return {
                dataLoss: false,
                recoverable: false
            };
        } catch (error) {
            console.error('❌ Check for data loss error:', error);
            return { dataLoss: false, recoverable: false };
        }
    }
    
    /**
     * Automatische Wiederherstellung aus letztem Auto-Save
     */
    async function autoRecover() {
        try {
            const latestAutoSave = await getLatestAutoSave();
            if (!latestAutoSave) {
                throw new Error('No auto-save available for recovery');
            }
            
            // Stelle Daten wieder her
            const { data } = latestAutoSave;
            Object.keys(data).forEach(key => {
                if (data[key] !== null) {
                    const storageKey = key.includes('_') ? key : 
                        key === 'trades' ? 'tradingJournalTrades' :
                        key === 'accountConfigs' ? 'tradingJournalAccountConfigs' :
                        key === 'cotData' ? 'tradingJournalCotData' :
                        key === 'biasData' ? 'tradingJournalBiasData' :
                        key === 'transactions' ? 'tradingJournalTransactions' :
                        key === 'newsData' ? 'tradingJournalNewsData' :
                        key === 'theme' ? 'tradingJournalTheme' :
                        key === 'passwordHash' ? 'tradingJournalPasswordHash' :
                        key === 'sidebarCollapsed' ? 'sidebarCollapsed' : key;
                    
                    localStorage.setItem(storageKey, data[key]);
                }
            });
            
            console.log('✅ Auto-recovery successful');
            return true;
        } catch (error) {
            console.error('❌ Auto-recovery error:', error);
            throw error;
        }
    }

    // =====================================================================
    // PUBLIC API
    // =====================================================================
    return {
        // Initialisierung
        init: initDB,
        
        // Backup
        createBackup,
        createAutoSave,
        listBackups,
        restoreBackup,
        exportBackup,
        importBackup,
        deleteBackup,
        
        // Auto-Backup
        startAutoBackup,
        stopAutoBackup,
        
        // Recovery
        checkForDataLoss,
        autoRecover,
        getLatestAutoSave,
        
        // Utilities
        collectAllData,
        
        // Config
        CONFIG
    };
})();

// Globaler Export
window.BackupManager = BackupManager;

// Auto-Init beim Laden
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await BackupManager.init();
        BackupManager.startAutoBackup();
        
        // Prüfe auf Datenverlust
        const { dataLoss, recoverable, autoSave } = await BackupManager.checkForDataLoss();
        if (dataLoss && recoverable) {
            console.warn('⚠️ Data loss detected, auto-recovery available');
            
            // Zeige Recovery-Dialog (wenn showRecoveryDialog existiert)
            if (typeof showRecoveryDialog === 'function') {
                showRecoveryDialog(autoSave);
            }
        }
    } catch (error) {
        console.error('❌ BackupManager init failed:', error);
    }
});
