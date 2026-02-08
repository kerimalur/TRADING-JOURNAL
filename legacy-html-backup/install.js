/* ====================================================================== */
/* INSTALLATION SCRIPT - Automatische Integration aller neuen Module     */
/* Führe dieses Script einmalig aus um alle Features zu aktivieren       */
/* ====================================================================== */

(function() {
    'use strict';

    console.log('🚀 Starting Trading Journal v2.0 Installation...');

    // =====================================================================
    // SCHRITT 1: Service Worker Registrierung
    // =====================================================================
    
    function installServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg => {
                    console.log('✅ Service Worker registered');
                })
                .catch(err => {
                    console.warn('⚠️ Service Worker registration failed:', err);
                });
        }
    }

    // =====================================================================
    // SCHRITT 2: Manifest Link hinzufügen
    // =====================================================================
    
    function addManifest() {
        if (!document.querySelector('link[rel="manifest"]')) {
            const link = document.createElement('link');
            link.rel = 'manifest';
            link.href = './manifest.json';
            document.head.appendChild(link);
            console.log('✅ Manifest added');
        }
    }

    // =====================================================================
    // SCHRITT 3: Module Verifizieren
    // =====================================================================
    
    function verifyModules() {
        const requiredModules = [
            'BackupManager',
            'PerformanceManager',
            'ImportExportManager',
            'EnhancedAuth',
            'UIFeedback'
        ];
        
        const missing = [];
        
        requiredModules.forEach(module => {
            if (typeof window[module] === 'undefined') {
                missing.push(module);
            }
        });
        
        if (missing.length > 0) {
            console.warn('⚠️ Missing modules:', missing);
            console.warn('Please ensure all script tags are in your HTML files');
            return false;
        }
        
        console.log('✅ All modules loaded');
        return true;
    }

    // =====================================================================
    // SCHRITT 4: Daten-Migration
    // =====================================================================
    
    async function migrateData() {
        console.log('🔄 Checking for data migration...');
        
        try {
            // Auth-Migration
            const needsAuthMigration = await EnhancedAuth.migrateFromOldAuth();
            if (needsAuthMigration) {
                console.log('ℹ️ Auth migration will occur on next login');
            }
            
            // Erstelle initiales Backup wenn noch keines vorhanden
            await BackupManager.init();
            const backups = await BackupManager.listBackups();
            
            if (backups.length === 0) {
                console.log('Creating initial backup...');
                await BackupManager.createBackup('Initial v2.0 backup');
                console.log('✅ Initial backup created');
            }
            
            console.log('✅ Data migration complete');
        } catch (error) {
            console.error('❌ Migration error:', error);
        }
    }

    // =====================================================================
    // SCHRITT 5: Feature-Konfiguration
    // =====================================================================
    
    function configureFeatures() {
        // Auto-Save aktivieren
        if (typeof BackupManager !== 'undefined') {
            BackupManager.startAutoBackup();
            console.log('✅ Auto-backup enabled');
        }
        
        // Session-Management aktivieren
        if (typeof EnhancedAuth !== 'undefined' && EnhancedAuth.isSessionActive()) {
            EnhancedAuth.startSession();
            console.log('✅ Session management active');
        }
        
        // API Service starten
        if (typeof ApiDataService !== 'undefined') {
            setTimeout(() => {
                ApiDataService.startAutoUpdate();
                console.log('✅ API auto-update enabled');
            }, 2000);
        }
    }

    // =====================================================================
    // SCHRITT 6: UI Initialisierung
    // =====================================================================
    
    function initializeUI() {
        // Toast Container
        if (typeof UIFeedback !== 'undefined') {
            console.log('✅ UI Feedback system ready');
        }
        
        // Performance Monitor
        if (typeof PerformanceManager !== 'undefined') {
            window.perfMonitor = new PerformanceManager.PerformanceMonitor();
            console.log('✅ Performance monitoring enabled');
        }
        
        // Zeige Welcome Message
        setTimeout(() => {
            if (typeof UIFeedback !== 'undefined') {
                UIFeedback.toast.success('Trading Journal v2.0 bereit!', 3000);
            }
        }, 1000);
    }

    // =====================================================================
    // SCHRITT 7: Diagnose & Status
    // =====================================================================
    
    function printStatus() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TRADING JOURNAL v2.0 - INSTALLATION STATUS');
        console.log('='.repeat(60));
        
        const status = {
            'Service Worker': 'serviceWorker' in navigator ? '✅' : '❌',
            'IndexedDB': 'indexedDB' in window ? '✅' : '❌',
            'LocalStorage': typeof localStorage !== 'undefined' ? '✅' : '❌',
            'Crypto API': typeof crypto !== 'undefined' && crypto.subtle ? '✅' : '❌',
            'Fetch API': typeof fetch !== 'undefined' ? '✅' : '❌',
            'BackupManager': typeof BackupManager !== 'undefined' ? '✅' : '❌',
            'EnhancedAuth': typeof EnhancedAuth !== 'undefined' ? '✅' : '❌',
            'PerformanceManager': typeof PerformanceManager !== 'undefined' ? '✅' : '❌',
            'UIFeedback': typeof UIFeedback !== 'undefined' ? '✅' : '❌',
            'ImportExport': typeof ImportExportManager !== 'undefined' ? '✅' : '❌'
        };
        
        Object.entries(status).forEach(([feature, icon]) => {
            console.log(`${icon} ${feature}`);
        });
        
        console.log('='.repeat(60));
        
        // Storage Info
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(({usage, quota}) => {
                const usedMB = (usage / 1024 / 1024).toFixed(2);
                const totalMB = (quota / 1024 / 1024).toFixed(2);
                const percent = ((usage / quota) * 100).toFixed(1);
                
                console.log(`\n💾 Storage: ${usedMB} MB / ${totalMB} MB (${percent}%)`);
            });
        }
        
        // Connection Status
        if (navigator.onLine !== undefined) {
            console.log(`🌐 Connection: ${navigator.onLine ? 'Online' : 'Offline'}`);
        }
        
        console.log('\n✅ Installation complete! App ready to use.\n');
    }

    // =====================================================================
    // HAUPTINSTALLATION
    // =====================================================================
    
    async function install() {
        try {
            // Warte bis DOM ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Führe Installation aus
            installServiceWorker();
            addManifest();
            
            if (verifyModules()) {
                await migrateData();
                configureFeatures();
                initializeUI();
            }
            
            printStatus();
            
        } catch (error) {
            console.error('❌ Installation failed:', error);
        }
    }

    // Starte Installation
    install();

    // =====================================================================
    // GLOBALE UTILITY FUNKTIONEN
    // =====================================================================
    
    /**
     * Diagnostik-Funktion für Support
     */
    window.diagnose = function() {
        console.log('\n🔍 SYSTEM DIAGNOSTICS\n');
        
        console.log('Browser:', navigator.userAgent);
        console.log('Language:', navigator.language);
        console.log('Platform:', navigator.platform);
        console.log('Cookies Enabled:', navigator.cookieEnabled);
        console.log('Online:', navigator.onLine);
        
        console.log('\n📦 LocalStorage:');
        console.log('- Trades:', localStorage.getItem('tradingJournalTrades')?.length || 0, 'bytes');
        console.log('- COT Data:', localStorage.getItem('tradingJournalCotData')?.length || 0, 'bytes');
        console.log('- News:', localStorage.getItem('tradingJournalNewsData')?.length || 0, 'bytes');
        
        if (typeof BackupManager !== 'undefined') {
            BackupManager.listBackups().then(backups => {
                console.log('\n💾 Backups:', backups.length);
                if (backups.length > 0) {
                    const latest = backups[0];
                    console.log('- Latest:', new Date(latest.timestamp).toLocaleString());
                    console.log('- Size:', JSON.stringify(latest).length, 'bytes');
                }
            });
        }
        
        if (typeof ApiDataService !== 'undefined') {
            const status = ApiDataService.getUpdateStatus();
            console.log('\n📡 API Status:');
            console.log('- COT Last Update:', status.cot.lastUpdate);
            console.log('- News Last Update:', status.news.lastUpdate);
            
            const errorLog = ApiDataService.getErrorLog ? ApiDataService.getErrorLog() : [];
            console.log('- API Errors:', errorLog.length);
        }
        
        console.log('\n');
    };
    
    /**
     * Performance-Report
     */
    window.performanceReport = function() {
        if (typeof PerformanceManager === 'undefined' || !window.perfMonitor) {
            console.warn('Performance Monitor not available');
            return;
        }
        
        const stats = window.perfMonitor.getStats();
        if (!stats) {
            console.log('No performance data collected yet');
            return;
        }
        
        console.log('\n⚡ PERFORMANCE REPORT\n');
        console.log('Measurements:', stats.count);
        console.log('Total Time:', stats.total.toFixed(2), 'ms');
        console.log('Average:', stats.average.toFixed(2), 'ms');
        console.log('Min:', stats.min.toFixed(2), 'ms');
        console.log('Max:', stats.max.toFixed(2), 'ms');
        console.log('\n');
    };
    
    /**
     * Backup erstellen
     */
    window.createBackupNow = async function(description) {
        if (typeof BackupManager === 'undefined') {
            console.error('BackupManager not available');
            return;
        }
        
        try {
            const id = await BackupManager.createBackup(description || 'Manual backup via console');
            console.log('✅ Backup created:', id);
            return id;
        } catch (error) {
            console.error('❌ Backup failed:', error);
        }
    };
    
    /**
     * Cache leeren
     */
    window.clearAllCaches = async function() {
        if (confirm('Wirklich alle Caches löschen? Die App muss neu geladen werden.')) {
            // Service Worker Cache
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const channel = new MessageChannel();
                navigator.serviceWorker.controller.postMessage(
                    { action: 'CLEAR_CACHE' },
                    [channel.port2]
                );
            }
            
            // LocalStorage
            const preserve = ['tradingJournalPasswordHash_v2', 'tradingJournalSalt'];
            Object.keys(localStorage).forEach(key => {
                if (!preserve.includes(key)) {
                    localStorage.removeItem(key);
                }
            });
            
            console.log('✅ Caches cleared. Reloading...');
            setTimeout(() => window.location.reload(), 1000);
        }
    };

})();
