/* ====================================================================== */
/* IMPORT/EXPORT MANAGER - Erweiterte Daten-Migration & Backup           */
/* CSV, JSON, MT4/MT5 Import, Multi-Format Export                         */
/* ====================================================================== */

const ImportExportManager = (function() {
    'use strict';

    // =====================================================================
    // CSV EXPORT
    // =====================================================================
    
    /**
     * Exportiert Trades als CSV
     */
    function exportTradesToCSV(trades, accountType = 'all') {
        const filteredTrades = accountType === 'all' 
            ? trades 
            : trades.filter(t => t.type === accountType);
        
        if (filteredTrades.length === 0) {
            throw new Error('Keine Trades zum Exportieren gefunden');
        }
        
        // CSV Header
        const headers = [
            'ID', 'Datum', 'Paar', 'Richtung', 'Entry', 'Exit', 'Stop Loss',
            'R-Multiple', 'Risiko %', 'Setup', 'Notes', 'Konto-Typ',
            'Erstelldatum', 'Bildpfad'
        ];
        
        // CSV Rows
        const rows = filteredTrades.map(trade => [
            trade.id,
            trade.date,
            trade.pair,
            trade.direction,
            trade.entry,
            trade.exit,
            trade.stopLoss,
            trade.rMultiple,
            trade.riskPercent,
            trade.setup,
            `"${(trade.notes || '').replace(/"/g, '""')}"`, // Escape quotes
            trade.type,
            trade.createdAt || '',
            trade.imagePath || ''
        ]);
        
        // Kombiniere zu CSV-String
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Download
        downloadFile(csvContent, `trades_export_${getTimestamp()}.csv`, 'text/csv');
        
        return true;
    }
    
    /**
     * Exportiert Account-Konfiguration als CSV
     */
    function exportAccountConfigToCSV(configs) {
        const headers = [
            'Konto-Typ', 'Start-Balance', 'Aktueller Saldo', 'Währung',
            'Standard-Risiko %', 'Profit-Target', 'Max Drawdown'
        ];
        
        const rows = Object.entries(configs).map(([type, config]) => [
            type,
            config.initialStartBalance,
            config.currentBalance,
            config.currency,
            config.defaultRiskPerTrade,
            config.profitTarget || 'N/A',
            config.maxDrawdown || 'N/A'
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        downloadFile(csvContent, `account_config_${getTimestamp()}.csv`, 'text/csv');
        
        return true;
    }

    // =====================================================================
    // CSV IMPORT
    // =====================================================================
    
    /**
     * Importiert Trades aus CSV
     */
    async function importTradesFromCSV(file) {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                throw new Error('CSV-Datei ist leer oder ungültig');
            }
            
            const headers = parseCSVLine(lines[0]);
            const trades = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                
                if (values.length !== headers.length) {
                    console.warn(`Zeile ${i + 1} übersprungen: Spaltenanzahl stimmt nicht`);
                    continue;
                }
                
                const trade = {};
                headers.forEach((header, index) => {
                    const key = mapCSVHeaderToTradeKey(header);
                    trade[key] = values[index];
                });
                
                // Konvertiere Datentypen
                trade.id = parseInt(trade.id) || Date.now() + Math.random();
                trade.rMultiple = parseFloat(trade.rMultiple) || 0;
                trade.riskPercent = parseFloat(trade.riskPercent) || 1;
                trade.entry = parseFloat(trade.entry) || 0;
                trade.exit = parseFloat(trade.exit) || 0;
                trade.stopLoss = parseFloat(trade.stopLoss) || 0;
                
                trades.push(trade);
            }
            
            console.log(`✅ ${trades.length} Trades aus CSV importiert`);
            return trades;
            
        } catch (error) {
            console.error('❌ CSV Import Fehler:', error);
            throw error;
        }
    }
    
    /**
     * Parst eine CSV-Zeile (berücksichtigt Quotes)
     */
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }
    
    /**
     * Mappt CSV-Header zu Trade-Keys
     */
    function mapCSVHeaderToTradeKey(header) {
        const mapping = {
            'ID': 'id',
            'Datum': 'date',
            'Paar': 'pair',
            'Richtung': 'direction',
            'Entry': 'entry',
            'Exit': 'exit',
            'Stop Loss': 'stopLoss',
            'R-Multiple': 'rMultiple',
            'Risiko %': 'riskPercent',
            'Setup': 'setup',
            'Notes': 'notes',
            'Konto-Typ': 'type',
            'Erstelldatum': 'createdAt',
            'Bildpfad': 'imagePath'
        };
        
        return mapping[header] || header.toLowerCase().replace(/\s+/g, '_');
    }

    // =====================================================================
    // MT4/MT5 IMPORT
    // =====================================================================
    
    /**
     * Importiert Trades aus MT4/MT5 History Report (HTML)
     */
    async function importFromMT4HTML(file) {
        try {
            const text = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            // Finde Trade-Tabelle
            const tables = doc.querySelectorAll('table');
            let tradesTable = null;
            
            for (const table of tables) {
                const headerText = table.textContent.toLowerCase();
                if (headerText.includes('position') || headerText.includes('trade')) {
                    tradesTable = table;
                    break;
                }
            }
            
            if (!tradesTable) {
                throw new Error('Keine Trade-Tabelle im MT4-Report gefunden');
            }
            
            const rows = tradesTable.querySelectorAll('tr');
            const trades = [];
            
            for (let i = 1; i < rows.length; i++) { // Skip header
                const cells = rows[i].querySelectorAll('td');
                
                if (cells.length < 8) continue;
                
                const ticket = cells[0]?.textContent.trim();
                const openTime = cells[1]?.textContent.trim();
                const type = cells[2]?.textContent.trim();
                const size = parseFloat(cells[3]?.textContent.trim()) || 0;
                const symbol = cells[4]?.textContent.trim();
                const openPrice = parseFloat(cells[5]?.textContent.trim()) || 0;
                const stopLoss = parseFloat(cells[6]?.textContent.trim()) || 0;
                const takeProfit = parseFloat(cells[7]?.textContent.trim()) || 0;
                const closeTime = cells[8]?.textContent.trim();
                const closePrice = parseFloat(cells[9]?.textContent.trim()) || 0;
                const profit = parseFloat(cells[13]?.textContent.trim()) || 0;
                
                // Konvertiere zu unserem Format
                const trade = {
                    id: parseInt(ticket) || Date.now() + Math.random(),
                    date: parseDate(closeTime || openTime),
                    pair: symbol.replace(/\./g, ''),
                    direction: type.toLowerCase().includes('buy') ? 'Long' : 'Short',
                    entry: openPrice,
                    exit: closePrice || openPrice,
                    stopLoss: stopLoss,
                    rMultiple: 0, // Wird berechnet
                    riskPercent: 1,
                    setup: 'MT4 Import',
                    notes: `Imported from MT4 - Ticket: ${ticket}, Size: ${size}`,
                    type: 'ek',
                    createdAt: new Date().toISOString(),
                    source: 'MT4'
                };
                
                // Berechne R-Multiple basierend auf Profit
                if (stopLoss && openPrice) {
                    const risk = Math.abs(openPrice - stopLoss) * size;
                    if (risk > 0) {
                        trade.rMultiple = (profit / risk).toFixed(2);
                    }
                }
                
                trades.push(trade);
            }
            
            console.log(`✅ ${trades.length} Trades aus MT4 importiert`);
            return trades;
            
        } catch (error) {
            console.error('❌ MT4 Import Fehler:', error);
            throw error;
        }
    }
    
    /**
     * Parst Datum aus verschiedenen Formaten
     */
    function parseDate(dateString) {
        if (!dateString) return new Date().toISOString().split('T')[0];
        
        // Versuche verschiedene Formate
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {}
        
        // Fallback
        return new Date().toISOString().split('T')[0];
    }

    // =====================================================================
    // JSON EXPORT/IMPORT (KOMPLETT)
    // =====================================================================
    
    /**
     * Exportiert alle Daten als JSON
     */
    function exportCompleteJSON() {
        const data = {
            version: '2.0.0',
            exportDate: new Date().toISOString(),
            trades: JSON.parse(localStorage.getItem('tradingJournalTrades') || '[]'),
            accountConfigs: JSON.parse(localStorage.getItem('tradingJournalAccountConfigs') || '{}'),
            cotData: JSON.parse(localStorage.getItem('tradingJournalCotData') || '[]'),
            biasData: JSON.parse(localStorage.getItem('tradingJournalBiasData') || '[]'),
            transactions: JSON.parse(localStorage.getItem('tradingJournalTransactions') || '[]'),
            newsData: JSON.parse(localStorage.getItem('tradingJournalNewsData') || '[]'),
            settings: {
                theme: localStorage.getItem('tradingJournalTheme'),
                sidebarCollapsed: localStorage.getItem('sidebarCollapsed')
            }
        };
        
        const jsonString = JSON.stringify(data, null, 2);
        downloadFile(jsonString, `trading_journal_complete_${getTimestamp()}.json`, 'application/json');
        
        return true;
    }
    
    /**
     * Importiert komplettes JSON-Backup
     */
    async function importCompleteJSON(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Validierung
            if (!data.version) {
                throw new Error('Ungültiges Backup-Format');
            }
            
            // Warnung anzeigen
            const confirmed = confirm(
                'WARNUNG: Dieser Import überschreibt ALLE aktuellen Daten!\n\n' +
                `Backup-Datum: ${new Date(data.exportDate).toLocaleString('de-DE')}\n` +
                `Trades: ${data.trades?.length || 0}\n` +
                `COT-Einträge: ${data.cotData?.length || 0}\n` +
                `News-Einträge: ${data.newsData?.length || 0}\n\n` +
                'Möchten Sie fortfahren?'
            );
            
            if (!confirmed) {
                throw new Error('Import abgebrochen');
            }
            
            // Erstelle Backup vor Import
            if (typeof BackupManager !== 'undefined') {
                await BackupManager.createBackup('Before JSON import - Safety backup');
            }
            
            // Importiere Daten
            if (data.trades) {
                localStorage.setItem('tradingJournalTrades', JSON.stringify(data.trades));
            }
            if (data.accountConfigs) {
                localStorage.setItem('tradingJournalAccountConfigs', JSON.stringify(data.accountConfigs));
            }
            if (data.cotData) {
                localStorage.setItem('tradingJournalCotData', JSON.stringify(data.cotData));
            }
            if (data.biasData) {
                localStorage.setItem('tradingJournalBiasData', JSON.stringify(data.biasData));
            }
            if (data.transactions) {
                localStorage.setItem('tradingJournalTransactions', JSON.stringify(data.transactions));
            }
            if (data.newsData) {
                localStorage.setItem('tradingJournalNewsData', JSON.stringify(data.newsData));
            }
            if (data.settings) {
                if (data.settings.theme) {
                    localStorage.setItem('tradingJournalTheme', data.settings.theme);
                }
                if (data.settings.sidebarCollapsed) {
                    localStorage.setItem('sidebarCollapsed', data.settings.sidebarCollapsed);
                }
            }
            
            // Neuberechnung der Salden
            if (typeof recalculateAllBalances === 'function') {
                recalculateAllBalances();
            }
            
            console.log('✅ JSON Import erfolgreich');
            return true;
            
        } catch (error) {
            console.error('❌ JSON Import Fehler:', error);
            throw error;
        }
    }

    // =====================================================================
    // EXCEL EXPORT (via CSV)
    // =====================================================================
    
    /**
     * Exportiert Trades für Excel (erweiterte CSV)
     */
    function exportTradesForExcel(trades) {
        const headers = [
            'Trade ID', 'Datum', 'Währungspaar', 'Richtung', 
            'Entry Preis', 'Exit Preis', 'Stop Loss', 
            'R-Multiple', 'Risiko %', 'Setup-Typ',
            'P&L (R)', 'Ergebnis', 'Konto-Typ', 'Notizen'
        ];
        
        const rows = trades.map(trade => {
            const r = parseFloat(trade.rMultiple) || 0;
            const result = r > 0 ? 'Gewinn' : r < 0 ? 'Verlust' : 'Breakeven';
            
            return [
                trade.id,
                trade.date,
                trade.pair,
                trade.direction,
                trade.entry,
                trade.exit,
                trade.stopLoss,
                trade.rMultiple,
                trade.riskPercent,
                trade.setup || 'N/A',
                r,
                result,
                trade.type,
                `"${(trade.notes || '').replace(/"/g, '""')}"`
            ];
        });
        
        const csvContent = '\uFEFF' + [ // BOM für Excel UTF-8
            headers.join(';'), // Semikolon für deutsche Excel-Version
            ...rows.map(row => row.join(';'))
        ].join('\n');
        
        downloadFile(csvContent, `trades_excel_${getTimestamp()}.csv`, 'text/csv;charset=utf-8');
        
        return true;
    }

    // =====================================================================
    // HELPER FUNCTIONS
    // =====================================================================
    
    /**
     * Download-Helper
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Timestamp für Dateinamen
     */
    function getTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    }
    
    /**
     * Validiert Import-Datei
     */
    function validateFile(file, allowedTypes) {
        if (!file) {
            throw new Error('Keine Datei ausgewählt');
        }
        
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExt)) {
            throw new Error(`Ungültiger Dateityp. Erlaubt: ${allowedTypes.join(', ')}`);
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB
            throw new Error('Datei ist zu groß (max. 50MB)');
        }
        
        return true;
    }

    // =====================================================================
    // DRAG & DROP HANDLER
    // =====================================================================
    
    /**
     * Initialisiert Drag & Drop für Import
     */
    function initDragAndDrop(dropZoneElement, onFileDropped) {
        if (!dropZoneElement) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZoneElement.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZoneElement.addEventListener(eventName, () => {
                dropZoneElement.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZoneElement.addEventListener(eventName, () => {
                dropZoneElement.classList.remove('drag-over');
            });
        });
        
        dropZoneElement.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0 && onFileDropped) {
                onFileDropped(files[0]);
            }
        });
    }

    // =====================================================================
    // PUBLIC API
    // =====================================================================
    return {
        // CSV
        exportTradesToCSV,
        exportAccountConfigToCSV,
        importTradesFromCSV,
        
        // MT4/MT5
        importFromMT4HTML,
        
        // JSON
        exportCompleteJSON,
        importCompleteJSON,
        
        // Excel
        exportTradesForExcel,
        
        // Utilities
        validateFile,
        initDragAndDrop,
        downloadFile,
        getTimestamp
    };
})();

// Globaler Export
window.ImportExportManager = ImportExportManager;
