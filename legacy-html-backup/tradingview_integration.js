/**
 * ========================================================================
 * Trading Journal - TradingView Integration
 * ========================================================================
 * 
 * Dieses Modul ermöglicht nahtlose Integration mit TradingView:
 * 
 * 1. Bookmarklet zum Extrahieren von Chart-Daten
 * 2. Paste-Event-Listener für automatisches Formular-Ausfüllen
 * 3. URL-Parameter-Parsing für Deep-Links
 * 
 * Verwendung:
 * - Füge Bookmarklet zu Lesezeichen hinzu
 * - Klicke in TradingView auf das Bookmarklet
 * - Daten werden automatisch ins Journal übertragen
 */

// ========================================================================
// 1. BOOKMARKLET CODE
// ========================================================================

/**
 * Dieser Code wird als Bookmarklet verwendet.
 * 
 * Installation:
 * 1. Erstelle neues Lesezeichen
 * 2. Kopiere den Code unten (zwischen START und END)
 * 3. Füge als URL ein (mit javascript: Prefix)
 * 4. Name: "TJ Export"
 * 
 * Verwendung:
 * - Öffne Chart in TradingView
 * - Klicke auf Bookmarklet
 * - Daten werden extrahiert und in Zwischenablage kopiert
 */

// ===== BOOKMARKLET CODE START =====
const BOOKMARKLET_CODE = `
javascript:(function(){
    try {
        // Extrahiere Symbol
        const symbolElement = document.querySelector('[data-name="legend-source-title"]') || 
                            document.querySelector('.chart-markup-table .symbolName-container') ||
                            document.querySelector('[class*="symbol"]');
        const symbol = symbolElement ? symbolElement.textContent.trim() : '';
        
        // Extrahiere Preis (Close)
        const priceElement = document.querySelector('[data-name="legend-source-item"][data-title="close"]') ||
                           document.querySelector('.valueValue-pricescale');
        let price = priceElement ? priceElement.textContent.trim() : '';
        price = price.replace(/[^0-9.]/g, '');
        
        // Extrahiere Datum
        const dateElement = document.querySelector('[data-name="legend-date-title"]') ||
                          document.querySelector('.dateValue');
        let date = dateElement ? dateElement.textContent.trim() : '';
        
        // Aktuelles Datum als Fallback
        if (!date) {
            const today = new Date();
            date = today.toISOString().split('T')[0];
        }
        
        // Erstelle JSON
        const data = {
            pair: symbol.replace(/\\//, '').toUpperCase(),
            price: parseFloat(price),
            date: date,
            source: 'TradingView',
            timestamp: new Date().toISOString()
        };
        
        // Kopiere in Zwischenablage
        const jsonString = JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            // Success-Benachrichtigung
            const notification = document.createElement('div');
            notification.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                font-weight: 600;
                animation: slideIn 0.3s ease-out;
            \`;
            notification.innerHTML = \`
                ✅ Daten kopiert!<br>
                <small style="font-weight: normal; opacity: 0.9;">\${data.pair} @ \${data.price}</small>
            \`;
            
            // Animation
            const style = document.createElement('style');
            style.textContent = \`
                @keyframes slideIn {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            \`;
            document.head.appendChild(style);
            
            document.body.appendChild(notification);
            
            // Entferne nach 3 Sekunden
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
            
            // Öffne Trading Journal (optional)
            const openJournal = confirm('Daten kopiert! Trading Journal öffnen?');
            if (openJournal) {
                const journalUrl = \`http://localhost:5500/EK_journal.html?pair=\${data.pair}&price=\${data.price}&date=\${data.date}\`;
                window.open(journalUrl, 'TradingJournal');
            }
        }).catch(err => {
            alert('Fehler beim Kopieren: ' + err.message);
        });
        
    } catch (error) {
        alert('Fehler beim Extrahieren der Daten: ' + error.message);
    }
})();
`;
// ===== BOOKMARKLET CODE END =====


// ========================================================================
// 2. URL PARAMETER PARSING
// ========================================================================

/**
 * Liest URL-Parameter und füllt Formular automatisch aus.
 * 
 * Verwendung:
 * http://localhost/journal.html?pair=EURUSD&price=1.0850&date=2026-01-24
 */
function parseURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const params = {
        pair: urlParams.get('pair'),
        price: urlParams.get('price'),
        date: urlParams.get('date'),
        direction: urlParams.get('direction'), // 'long' oder 'short'
        setup: urlParams.get('setup')
    };
    
    // Filter leere Werte
    Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
    });
    
    if (Object.keys(params).length > 0) {
        console.log('📊 URL-Parameter gefunden:', params);
        return params;
    }
    
    return null;
}

/**
 * Füllt Formular mit URL-Parametern.
 */
function fillFormFromURLParams() {
    const params = parseURLParameters();
    if (!params) return false;
    
    // Warte bis Formular geladen ist
    const waitForForm = setInterval(() => {
        const pairField = document.getElementById('pair');
        if (pairField) {
            clearInterval(waitForForm);
            
            // Fülle Felder
            if (params.pair) {
                pairField.value = params.pair;
            }
            
            if (params.date) {
                const dateField = document.getElementById('date');
                if (dateField) dateField.value = params.date;
            }
            
            if (params.direction) {
                const directionBtn = document.querySelector(\`.direction-btn.\${params.direction}\`);
                if (directionBtn) directionBtn.click();
            }
            
            if (params.setup) {
                const setupField = document.getElementById('setup');
                if (setupField) setupField.value = params.setup;
            }
            
            // Zeige Benachrichtigung
            if (typeof showToast === 'function') {
                showToast(\`Daten aus TradingView importiert: \${params.pair}\`, 'success');
            }
            
            // Fokus auf erstes leeres Pflichtfeld
            const rMultipleField = document.getElementById('rMultiple');
            if (rMultipleField) rMultipleField.focus();
            
            console.log('✅ Formular mit URL-Parametern gefüllt');
        }
    }, 100);
    
    // Timeout nach 5 Sekunden
    setTimeout(() => clearInterval(waitForForm), 5000);
    
    return true;
}


// ========================================================================
// 3. ENHANCED PASTE-EVENT (JSON-Daten)
// ========================================================================

/**
 * Erweitert Paste-Event um JSON-Daten-Erkennung.
 * 
 * Wenn JSON-Daten (vom Bookmarklet) eingefügt werden,
 * wird das Formular automatisch ausgefüllt.
 */
function setupEnhancedPasteListener() {
    document.addEventListener('paste', async (event) => {
        try {
            // Versuche JSON aus Zwischenablage zu lesen
            const text = event.clipboardData.getData('text');
            
            if (!text) return;
            
            // Prüfe ob JSON
            if (text.trim().startsWith('{') && text.includes('pair')) {
                try {
                    const data = JSON.parse(text);
                    
                    // Prüfe ob TradingView-Daten
                    if (data.pair && data.source === 'TradingView') {
                        event.preventDefault();
                        
                        // Fülle Formular
                        fillFormWithData(data);
                        
                        if (typeof showToast === 'function') {
                            showToast(\`📊 TradingView-Daten eingefügt: \${data.pair}\`, 'success');
                        }
                        
                        return;
                    }
                } catch (e) {
                    // Kein gültiges JSON, ignorieren
                }
            }
            
        } catch (error) {
            console.error('❌ Fehler beim Paste-Event:', error);
        }
    });
}

/**
 * Füllt Formular mit extrahierten Daten.
 */
function fillFormWithData(data) {
    // Pair
    if (data.pair) {
        const pairField = document.getElementById('pair');
        if (pairField) {
            // Prüfe ob Pair in Dropdown existiert
            const option = Array.from(pairField.options).find(opt => 
                opt.value.toUpperCase() === data.pair.toUpperCase()
            );
            if (option) {
                pairField.value = option.value;
            }
        }
    }
    
    // Date
    if (data.date) {
        const dateField = document.getElementById('date');
        if (dateField) {
            // Konvertiere Datum-Format falls nötig
            const dateStr = data.date.split('T')[0]; // ISO format
            dateField.value = dateStr;
        }
    }
    
    // Price (optional, als Notiz speichern)
    if (data.price) {
        const notesField = document.getElementById('notes');
        if (notesField && !notesField.value) {
            notesField.value = \`Entry Price: \${data.price}\`;
        }
    }
    
    // Fokus auf R-Multiple (nächstes Pflichtfeld)
    const rMultipleField = document.getElementById('rMultiple');
    if (rMultipleField) {
        rMultipleField.focus();
        rMultipleField.select();
    }
}


// ========================================================================
// 4. QUICK-PASTE BUTTON (Alternative zum Bookmarklet)
// ========================================================================

/**
 * Fügt einen "Paste TradingView Data" Button zum Formular hinzu.
 */
function addPasteButton() {
    // Prüfe ob Formular existiert
    const form = document.getElementById('backtest-form') || document.getElementById('journal-form');
    if (!form) return;
    
    // Erstelle Button
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary-button';
    button.style.cssText = 'margin-bottom: var(--space-md); width: 100%;';
    button.innerHTML = '<i class="fas fa-paste"></i> TradingView-Daten einfügen (Strg+Shift+V)';
    
    button.onclick = async () => {
        try {
            // Lese Zwischenablage
            const text = await navigator.clipboard.readText();
            
            if (text.trim().startsWith('{')) {
                const data = JSON.parse(text);
                fillFormWithData(data);
                
                if (typeof showToast === 'function') {
                    showToast('Daten eingefügt', 'success');
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast('Keine gültigen Daten in Zwischenablage', 'warning');
                }
            }
        } catch (error) {
            console.error('Fehler beim Paste:', error);
            if (typeof showToast === 'function') {
                showToast('Fehler beim Einfügen der Daten', 'error');
            }
        }
    };
    
    // Füge Button vor dem Formular ein
    form.parentNode.insertBefore(button, form);
}

/**
 * Keyboard Shortcut für Quick-Paste (Strg+Shift+V).
 */
function setupQuickPasteShortcut() {
    document.addEventListener('keydown', async (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'V') {
            event.preventDefault();
            
            try {
                const text = await navigator.clipboard.readText();
                if (text.trim().startsWith('{')) {
                    const data = JSON.parse(text);
                    fillFormWithData(data);
                    
                    if (typeof showToast === 'function') {
                        showToast('📊 TradingView-Daten eingefügt', 'success');
                    }
                }
            } catch (error) {
                console.error('Fehler beim Quick-Paste:', error);
            }
        }
    });
}


// ========================================================================
// 5. AUTO-INITIALIZATION
// ========================================================================

/**
 * Initialisiert TradingView-Integration automatisch.
 */
(function initTradingViewIntegration() {
    // Warte auf DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    function init() {
        console.log('🔌 TradingView Integration initialisiert');
        
        // 1. URL-Parameter prüfen
        fillFormFromURLParams();
        
        // 2. Enhanced Paste-Listener
        setupEnhancedPasteListener();
        
        // 3. Quick-Paste Shortcut
        setupQuickPasteShortcut();
        
        // 4. Optional: Paste-Button hinzufügen
        // addPasteButton(); // Auskommentiert, kann aktiviert werden
        
        console.log('✅ TradingView Integration bereit');
    }
})();


// ========================================================================
// 6. EXPORT FÜR GLOBALEN ZUGRIFF
// ========================================================================

window.TradingViewIntegration = {
    parseURLParameters,
    fillFormFromURLParams,
    fillFormWithData,
    BOOKMARKLET_CODE
};

console.log('✅ TradingView Integration Module geladen');
