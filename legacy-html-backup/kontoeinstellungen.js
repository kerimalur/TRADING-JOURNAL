// Trading Journal/kontoeinstellungen.js
// ======================================
// SCRIPT FÜR kontoeinstellungen.html
// ======================================

// Schlüssel für das Passwort-Hash im localStorage
const PASSWORD_HASH_KEY = 'tradingJournalPasswordHash';

document.addEventListener('DOMContentLoaded', () => {
    // Sicherstellen, dass data_manager.js geladen ist
    if (typeof loadAccountConfigs !== 'function') {
        console.error("Fehler: data_manager.js ist nicht geladen.");
        return;
    }
    
    // Konfigurationen laden und Formulare füllen
    loadAndPopulateForms();
    
    // Event-Listener für Formulare einrichten
    setupFormListeners();
    
    // NEU: Event-Listener für Passwort-Formular
    setupPasswordForm();
    
    // NEU: Event-Listener für Reset-Buttons (Idee 1.8)
    setupResetButtons();
    
    // NEU: Event-Listener für Import/Export (Hierher verschoben)
    setupImportExport();
});

// ======================================
// HILFSFUNKTIONEN ZUM LADEN UND SPEICHERN
// ======================================

function loadAndPopulateForms() {
    const configs = loadAccountConfigs();
    const ekConfig = configs.ek;
    const fundedConfig = configs.funded;

    // --- EK Formular füllen ---
    document.getElementById('ek-initial-balance').value = ekConfig.initialStartBalance;
    document.getElementById('ek-default-risk').value = ekConfig.defaultRiskPerTrade;
    document.getElementById('ek-currency').value = ekConfig.currency;

    // --- Funded Formular füllen ---
    document.getElementById('funded-initial-balance').value = fundedConfig.initialStartBalance;
    document.getElementById('funded-default-risk').value = fundedConfig.defaultRiskPerTrade;
    document.getElementById('funded-currency').value = fundedConfig.currency;
    
    // Flexible Ziel-Einstellungen
    document.getElementById('funded-profit-target-value').value = fundedConfig.profitTargetValue;
    document.getElementById('funded-profit-target-type').value = fundedConfig.profitTargetType;
    document.getElementById('funded-max-drawdown-value').value = fundedConfig.maxDrawdownValue;
    document.getElementById('funded-max-drawdown-type').value = fundedConfig.maxDrawdownType;
}

function setupFormListeners() {
    document.getElementById('ek-config-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveConfig('ek', e.target);
    });

    document.getElementById('funded-config-form').addEventListener('submit', function(e) {
        e.preventDefault();
        saveConfig('funded', e.target);
    });
}


/**
 * Konvertiert ein Ziel (R-Multiple, Prozent) in einen absoluten Saldo.
 * @returns {number} Der Ziel-Betrag als absoluter Saldo (z.B. 108000).
 */
function convertTargetToAbsolute(value, type, startBalance, riskPercent) {
    if (type === 'absolute') {
        return value;
    }
    
    const riskAmount = startBalance * (riskPercent / 100);

    if (type === 'r_multiple') {
        return startBalance + (value * riskAmount);
    } 
    
    if (type === 'percent') {
        return startBalance * (1 + value / 100);
    }
    
    return startBalance; 
}


/**
 * Konvertiert einen Drawdown-Wert (R-Multiple, Prozent) in einen maximal zulässigen Saldo.
 * @returns {number} Der maximal zulässige Drawdown-Saldo (z.B. 95000).
 */
function convertDrawdownToMaxBalance(value, type, startBalance, riskPercent) {
    if (type === 'absolute') {
        return value;
    }
    
    const riskAmount = startBalance * (riskPercent / 100);
    const lossValue = Math.abs(value); 

    if (type === 'r_multiple') {
        return startBalance - (lossValue * riskAmount);
    }
    
    if (type === 'percent') {
        return startBalance * (1 - lossValue / 100);
    }
    
    return startBalance; 
}


/**
 * Speichert die Konfiguration nach Berechnung der Ziele (falls Funded).
 */
function saveConfig(accountType, form) {
    const configs = loadAccountConfigs();
    const config = configs[accountType];
    
    const newStartBalance = parseFloat(form.elements['initialStartBalance'].value);
    const newDefaultRisk = parseFloat(form.elements['defaultRiskPerTrade'].value);
    const newCurrency = form.elements['currency'].value;
    
    if (isNaN(newStartBalance) || newStartBalance <= 0 || isNaN(newDefaultRisk) || newDefaultRisk < 0) {
        alert("Ungültige Eingabe für Startkapital (muss > 0) oder Risiko (muss >= 0 sein).");
        return;
    }

    // 1. Allgemeine Konfiguration speichern
    config.initialStartBalance = newStartBalance;
    config.defaultRiskPerTrade = newDefaultRisk;
    config.currency = newCurrency;
    
    // 2. Funded Account Ziele berechnen und speichern
    if (accountType === 'funded') {
        const profitTargetValue = parseFloat(form.elements['profitTargetValue'].value);
        const profitTargetType = form.elements['profitTargetType'].value;
        const maxDrawdownValue = parseFloat(form.elements['maxDrawdownValue'].value);
        const maxDrawdownType = form.elements['maxDrawdownType'].value;
        
        if (isNaN(profitTargetValue) || isNaN(maxDrawdownValue)) {
             alert("Ungültige Eingabe für Ziele.");
             return;
        }

        // Speichere die rohen Eingabewerte
        config.profitTargetValue = profitTargetValue;
        config.profitTargetType = profitTargetType;
        config.maxDrawdownValue = maxDrawdownValue;
        config.maxDrawdownType = maxDrawdownType;
        
        // Berechne die absoluten Werte, die im Code verwendet werden
        config.profitTarget = convertTargetToAbsolute(profitTargetValue, profitTargetType, newStartBalance, newDefaultRisk);
        
        // Nur statischer Drawdown
        config.maxDrawdown = convertDrawdownToMaxBalance(maxDrawdownValue, maxDrawdownType, newStartBalance, newDefaultRisk);
    
        if (config.maxDrawdown >= newStartBalance || config.maxDrawdown <= 0) {
             alert(`Fehler: Der maximale Drawdown-Salde (${config.maxDrawdown.toFixed(2)}) muss kleiner als das Startkapital (${newStartBalance.toFixed(2)}) sein und darf nicht Null sein.`);
             return;
        }
    }

    // 3. Speichern und Neuberechnung
    saveAccountConfigs(configs);
    recalculateAllBalances(); 
    
    alert(`Konfiguration für ${accountType.toUpperCase()} erfolgreich gespeichert.`);
    
    // UI neu laden, um alle Seiten zu aktualisieren
    location.reload(); 
}

// ======================================
// NEU: PASSWORT-LOGIK (Idee 2.4)
// ======================================

/**
 * Hash-Funktion (SHA-256)
 * Konvertiert einen String in einen hexadezimalen Hash-String.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Konvertiere Buffer zu Hex-String
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

function setupPasswordForm() {
    const form = document.getElementById('password-form');
    const errorMsg = document.getElementById('password-error-msg');
    if (!form || !errorMsg) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';
        
        const newPass = e.target.elements['new-password'].value;
        const confirmPass = e.target.elements['confirm-password'].value;

        if (newPass.length < 6) {
            errorMsg.textContent = 'Passwort muss mindestens 6 Zeichen lang sein.';
            return;
        }

        if (newPass !== confirmPass) {
            errorMsg.textContent = 'Passwörter stimmen nicht überein.';
            return;
        }

        // Hashen und Speichern
        try {
            const hash = await hashPassword(newPass);
            localStorage.setItem(PASSWORD_HASH_KEY, hash);
            alert('Passwort erfolgreich gespeichert! Du wirst beim nächsten Besuch eingeloggt.');
            form.reset();
        } catch (err) {
            console.error(err);
            errorMsg.textContent = 'Fehler beim Speichern des Passworts.';
        }
    });
}


// ======================================
// NEU: RESET-BUTTON LOGIK (Idee 1.8)
// ======================================
function setupResetButtons() {
    document.getElementById('reset-ek-btn').addEventListener('click', () => handleReset('ek'));
    document.getElementById('reset-funded-btn').addEventListener('click', () => handleReset('funded'));
}

function handleReset(accountType) {
    const typeName = (accountType === 'ek') ? "EK Journal" : "Funded Journal";
    
    // Doppelte Bestätigung
    if (!confirm(`Bist du sicher, dass du das ${typeName} zurücksetzen willst?`)) {
        return;
    }
    if (!confirm(`LETZTE WARNUNG: Alle Trades und Transaktionen für das ${typeName} werden unwiderruflich gelöscht. Fortfahren?`)) {
        return;
    }

    try {
        if (typeof resetAccount === 'function') {
            resetAccount(accountType);
            alert(`${typeName} wurde erfolgreich auf die Werkseinstellungen zurückgesetzt.`);
            location.reload();
        } else {
            alert('Fehler: resetAccount() Funktion nicht in data_manager.js gefunden.');
        }
    } catch (e) {
        alert('Ein Fehler ist aufgetreten: ' + e.message);
    }
}


// ======================================================================
// NEU: IMPORT/EXPORT LOGIK (VON uebersicht.js HIERHER VERSCHOBEN)
// ======================================================================

// Diese Konstanten werden für den Import benötigt.
const ACCOUNT_CONFIG_KEY = 'tradingJournalAccountConfigs';
const TRADES_STORAGE_KEY = 'tradingJournalTrades';
const COT_STORAGE_KEY = 'tradingJournalCotData';
const BIAS_STORAGE_KEY = 'tradingJournalBiasData';
const TRANSACTION_STORAGE_KEY = 'tradingJournalTransactions';
// (NEWS_STORAGE_KEY wird hier nicht benötigt, aber könnte hinzugefügt werden)


function setupImportExport() {
    const exportBtn = document.getElementById('export-button');
    const importBtn = document.getElementById('import-button');
    const importFileEl = document.getElementById('import-file');

    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }

    if (importBtn) {
        importBtn.addEventListener('click', () => {
            importFileEl.click();
        });
    }

    if (importFileEl) {
        importFileEl.addEventListener('change', importData);
    }
}

function exportData() {
    console.log("Exportiere Daten...");
    try {
        // Diese 'load...'-Funktionen sind dank data_manager.js global verfügbar
        const backupData = {
            accountConfigs: loadAccountConfigs(),
            trades: loadTrades(),
            cotData: loadCotData(),
            biasData: loadBiasData(),
            transactions: loadTransactions(),
            newsData: typeof loadNewsData === 'function' ? loadNewsData() : [] // Bonus: News auch sichern
        };
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `trading_journal_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Backup erfolgreich heruntergeladen!');
    } catch (e) {
        console.error("Fehler beim Exportieren der Daten:", e);
        alert('Fehler beim Exportieren der Daten. Siehe Konsole.');
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('Keine Datei ausgewählt.');
        return;
    }
    if (!confirm(`WARNUNG: Bist du sicher? Dies überschreibt ALLE deine aktuellen Trades, Kontostände und Analysen. Dieser Schritt kann nicht rückgängig gemacht werden.`)) {
        event.target.value = null;
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const jsonString = e.target.result;
            const importedData = JSON.parse(jsonString);
            
            // Überprüfe die wichtigsten Teile
            if (!importedData.accountConfigs || !importedData.trades) {
                throw new Error("Die JSON-Datei hat ein ungültiges Format (accountConfigs oder trades fehlen).");
            }
            
            // Verwende die oben definierten Konstanten, um die Daten zu speichern
            localStorage.setItem(ACCOUNT_CONFIG_KEY, JSON.stringify(importedData.accountConfigs));
            localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(importedData.trades));
            
            // Optionale Daten importieren, falls vorhanden
            if (importedData.cotData) {
                localStorage.setItem(COT_STORAGE_KEY, JSON.stringify(importedData.cotData));
            }
            if (importedData.biasData) {
                localStorage.setItem(BIAS_STORAGE_KEY, JSON.stringify(importedData.biasData));
            }
            if (importedData.transactions) {
                localStorage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(importedData.transactions));
            }
            if (importedData.newsData) {
                localStorage.setItem('tradingJournalNewsData', JSON.stringify(importedData.newsData)); // NEWS_STORAGE_KEY
            }

            alert('Import erfolgreich! Die Seite wird neu geladen, um die importierten Daten anzuzeigen.');
            location.reload(); 
            
        } catch (err) {
            console.error("Fehler beim Importieren der Daten:", err);
            alert('Fehler beim Importieren der Datei. Stelle sicher, dass es eine gültige Backup-JSON-Datei ist.');
        } finally {
            event.target.value = null;
        }
    };
    reader.readAsText(file);
}