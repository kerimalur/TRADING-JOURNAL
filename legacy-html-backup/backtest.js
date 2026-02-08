/**
 * ========================================================================
 * Trading Journal - High-Speed Backtesting Module
 * ========================================================================
 * 
 * Features:
 * - Speed-optimiertes Eingabe-Formular
 * - Tastaturkürzel (L/S/Enter)
 * - Live-Statistiken (Winrate, Equity Curve)
 * - Screenshot Paste-Funktion
 * - Session-basiertes Tracking (separiert von Live-Trades)
 * - Keine Beeinflussung der Live-Performance
 */

// ========================================================================
// GLOBALE VARIABLEN
// ========================================================================

let currentSession = {
    id: null,
    name: '',
    startTime: null,
    trades: [],
    isPaused: false
};

let sessionTimer = null;
let pendingScreenshot = null;
let equityChart = null;

// ========================================================================
// INITIALIZATION
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Backtest Module initialisiert');
    
    // Prüfe ob Datenbank bereit ist
    await db.open();
    
    // Initialisiere neue Session
    await initNewSession();
    
    // Event Listeners
    setupEventListeners();
    
    // Initialisiere Chart
    initEquityChart();
    
    // Setze heutiges Datum als Standard
    document.getElementById('date').valueAsDate = new Date();
    
    // Fokus auf erstes Feld
    document.getElementById('pair').focus();
    
    console.log('✅ Backtest Module bereit');
});

// ========================================================================
// SESSION MANAGEMENT
// ========================================================================

/**
 * Initialisiert eine neue Backtest-Session.
 */
async function initNewSession() {
    const sessionId = generateBacktestSessionId();
    const timestamp = new Date().toLocaleString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    currentSession = {
        id: sessionId,
        name: `Backtest ${timestamp}`,
        startTime: Date.now(),
        trades: [],
        isPaused: false
    };
    
    document.getElementById('session-name').textContent = currentSession.name;
    document.getElementById('session-trades').textContent = '0';
    
    // Starte Timer
    startSessionTimer();
    
    console.log(`📊 Neue Session: ${currentSession.id}`);
}

/**
 * Startet den Session-Timer.
 */
function startSessionTimer() {
    if (sessionTimer) clearInterval(sessionTimer);
    
    sessionTimer = setInterval(() => {
        if (!currentSession.isPaused) {
            const elapsed = Date.now() - currentSession.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('session-time').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

/**
 * Pausiert/Resumed die Session.
 */
function togglePause() {
    currentSession.isPaused = !currentSession.isPaused;
    const btn = document.getElementById('pause-btn');
    
    if (currentSession.isPaused) {
        btn.innerHTML = '<i class="fas fa-play"></i> Fortsetzen';
        btn.classList.add('primary-button');
    } else {
        btn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        btn.classList.remove('primary-button');
    }
}

/**
 * Speichert die aktuelle Session und startet eine neue.
 */
async function saveAndNewSession() {
    if (currentSession.trades.length === 0) {
        showToast('Keine Trades zum Speichern', 'warning');
        return;
    }
    
    // Session ist bereits in DB gespeichert (Trades wurden einzeln gespeichert)
    showToast(`Session gespeichert: ${currentSession.trades.length} Trades`, 'success');
    
    // Neue Session starten
    await initNewSession();
    resetForm();
    updateLiveStats();
}

// ========================================================================
// EVENT LISTENERS
// ========================================================================

function setupEventListeners() {
    // Form Submit
    document.getElementById('backtest-form').addEventListener('submit', handleFormSubmit);
    
    // Direction Buttons (L/S)
    document.querySelectorAll('.direction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.direction-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Screenshot Paste
    document.addEventListener('paste', handlePaste);
    
    // Screenshot Upload
    document.getElementById('paste-zone').addEventListener('click', () => {
        document.getElementById('screenshot-file').click();
    });
    
    document.getElementById('screenshot-file').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleScreenshotUpload(e.target.files[0]);
        }
    });
    
    // Top Bar Buttons
    document.getElementById('new-session-btn').addEventListener('click', async () => {
        if (confirm('Neue Session starten? Die aktuelle Session wird gespeichert.')) {
            await saveAndNewSession();
        }
    });
    
    document.getElementById('save-session-btn').addEventListener('click', async () => {
        await saveAndNewSession();
    });
    
    document.getElementById('pause-btn').addEventListener('click', togglePause);
    
    document.getElementById('history-btn').addEventListener('click', showSessionHistory);
}

/**
 * Keyboard Shortcuts Handler.
 */
function handleKeyboardShortcuts(event) {
    // Ignore wenn in einem Input-Feld
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.tagName === 'SELECT') {
        return;
    }
    
    switch(event.key.toLowerCase()) {
        case 'l':
            // Long
            event.preventDefault();
            document.querySelector('.direction-btn.long').click();
            document.getElementById('pair').focus();
            break;
        case 's':
            // Short
            event.preventDefault();
            document.querySelector('.direction-btn.short').click();
            document.getElementById('pair').focus();
            break;
    }
}

// ========================================================================
// FORM HANDLING
// ========================================================================

/**
 * Verarbeitet Form-Submit.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (currentSession.isPaused) {
        showToast('Session ist pausiert', 'warning');
        return;
    }
    
    // Sammle Form-Daten
    const direction = document.querySelector('.direction-btn.active')?.dataset.direction;
    
    if (!direction) {
        showToast('Bitte Richtung auswählen (L/S)', 'warning');
        return;
    }
    
    const backtestTrade = {
        pair: document.getElementById('pair').value,
        date: document.getElementById('date').value,
        direction: direction,
        rMultiple: parseFloat(document.getElementById('rMultiple').value),
        setup: document.getElementById('setup').value,
        timeframe: document.getElementById('timeframe').value,
        riskPercent: parseFloat(document.getElementById('riskPercent').value) || 1.0,
        notes: document.getElementById('notes').value.trim()
    };
    
    // Validierung
    if (!backtestTrade.pair || !backtestTrade.date || isNaN(backtestTrade.rMultiple)) {
        showToast('Bitte alle Pflichtfelder ausfüllen', 'error');
        return;
    }
    
    try {
        // Speichere in IndexedDB
        const backtestId = await dbSaveBacktest(
            backtestTrade, 
            currentSession.id, 
            pendingScreenshot
        );
        
        // Füge zur Session hinzu
        backtestTrade.id = backtestId;
        currentSession.trades.push(backtestTrade);
        
        // Visual Feedback
        document.getElementById('backtest-form').classList.add('pulse-on-save');
        setTimeout(() => {
            document.getElementById('backtest-form').classList.remove('pulse-on-save');
        }, 600);
        
        // Update UI
        updateLiveStats();
        updateRecentTrades();
        
        // Reset Form
        resetForm();
        
        // Fokus zurück auf Pair für schnelle Eingabe
        document.getElementById('pair').focus();
        
        console.log(`✅ Backtest-Trade gespeichert: ${backtestTrade.pair} ${backtestTrade.direction} R${backtestTrade.rMultiple}`);
        
    } catch (error) {
        console.error('❌ Fehler beim Speichern:', error);
        showToast('Fehler beim Speichern des Trades', 'error');
    }
}

/**
 * Setzt das Formular zurück.
 */
function resetForm() {
    // Behalte Datum und Risiko
    const currentDate = document.getElementById('date').value;
    const currentRisk = document.getElementById('riskPercent').value;
    
    document.getElementById('backtest-form').reset();
    
    // Restore Datum und Risiko
    document.getElementById('date').value = currentDate;
    document.getElementById('riskPercent').value = currentRisk;
    
    // Remove Screenshot
    pendingScreenshot = null;
    const pasteZone = document.getElementById('paste-zone');
    pasteZone.classList.remove('has-image');
    pasteZone.innerHTML = `
        <div class="paste-instruction">
            <i class="fas fa-paste" style="font-size: 2em; opacity: 0.5; margin-bottom: 8px;"></i>
            <p>Screenshot hier einfügen (Strg+V)<br>oder klicken zum Hochladen</p>
        </div>
    `;
    
    // Reset Direction
    document.querySelectorAll('.direction-btn').forEach(b => b.classList.remove('active'));
}

// ========================================================================
// SCREENSHOT HANDLING
// ========================================================================

/**
 * Verarbeitet Paste-Event (Strg+V).
 */
async function handlePaste(event) {
    const items = event.clipboardData?.items;
    if (!items) return;
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            event.preventDefault();
            
            const blob = items[i].getAsFile();
            await handleScreenshotUpload(blob);
            
            showToast('Screenshot eingefügt', 'success');
            break;
        }
    }
}

/**
 * Verarbeitet Screenshot-Upload.
 */
async function handleScreenshotUpload(file) {
    try {
        // Preview anzeigen
        const previewUrl = URL.createObjectURL(file);
        const pasteZone = document.getElementById('paste-zone');
        
        pasteZone.classList.add('has-image');
        pasteZone.innerHTML = `
            <img src="${previewUrl}" alt="Screenshot Preview">
            <div style="position: absolute; top: 8px; right: 8px;">
                <button type="button" onclick="removeScreenshot()" class="button danger-button" style="padding: 6px 12px; font-size: 0.9em;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Speichere Blob für späteren Upload
        pendingScreenshot = file;
        
    } catch (error) {
        console.error('❌ Fehler beim Screenshot-Upload:', error);
        showToast('Fehler beim Screenshot-Upload', 'error');
    }
}

/**
 * Entfernt den aktuellen Screenshot.
 */
window.removeScreenshot = function() {
    pendingScreenshot = null;
    const pasteZone = document.getElementById('paste-zone');
    pasteZone.classList.remove('has-image');
    pasteZone.innerHTML = `
        <div class="paste-instruction">
            <i class="fas fa-paste" style="font-size: 2em; opacity: 0.5; margin-bottom: 8px;"></i>
            <p>Screenshot hier einfügen (Strg+V)<br>oder klicken zum Hochladen</p>
        </div>
    `;
}

// ========================================================================
// LIVE STATISTICS
// ========================================================================

/**
 * Aktualisiert die Live-Statistiken.
 */
function updateLiveStats() {
    const trades = currentSession.trades;
    const totalTrades = trades.length;
    
    if (totalTrades === 0) {
        // Reset Stats
        document.getElementById('winrate-percent').textContent = '-%';
        document.getElementById('wins-count').textContent = '0';
        document.getElementById('losses-count').textContent = '0';
        document.getElementById('total-r').textContent = '0.0';
        document.getElementById('avg-r').textContent = '0.0';
        document.getElementById('best-r').textContent = '0.0';
        document.getElementById('worst-r').textContent = '0.0';
        document.getElementById('session-trades').textContent = '0';
        return;
    }
    
    // Berechne Statistiken
    const wins = trades.filter(t => t.rMultiple > 0).length;
    const losses = trades.filter(t => t.rMultiple <= 0).length;
    const winrate = totalTrades > 0 ? (wins / totalTrades * 100).toFixed(1) : 0;
    
    const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
    const avgR = (totalR / totalTrades).toFixed(2);
    const bestR = Math.max(...trades.map(t => t.rMultiple)).toFixed(2);
    const worstR = Math.min(...trades.map(t => t.rMultiple)).toFixed(2);
    
    // Update UI
    document.getElementById('winrate-percent').textContent = `${winrate}%`;
    document.getElementById('wins-count').textContent = wins;
    document.getElementById('losses-count').textContent = losses;
    document.getElementById('total-r').textContent = totalR.toFixed(1);
    document.getElementById('avg-r').textContent = avgR;
    document.getElementById('best-r').textContent = `+${bestR}`;
    document.getElementById('worst-r').textContent = worstR;
    document.getElementById('session-trades').textContent = totalTrades;
    
    // Farbcodierung
    const totalRElement = document.getElementById('total-r');
    totalRElement.classList.remove('positive', 'negative');
    if (totalR > 0) {
        totalRElement.classList.add('positive');
    } else if (totalR < 0) {
        totalRElement.classList.add('negative');
    }
    
    const avgRElement = document.getElementById('avg-r');
    avgRElement.classList.remove('positive', 'negative');
    if (avgR > 0) {
        avgRElement.classList.add('positive');
    } else if (avgR < 0) {
        avgRElement.classList.add('negative');
    }
    
    // Update Equity Chart
    updateEquityChart();
}

/**
 * Aktualisiert die Liste der letzten Trades.
 */
function updateRecentTrades() {
    const container = document.getElementById('recent-trades');
    const trades = currentSession.trades.slice().reverse().slice(0, 10); // Letzte 10
    
    if (trades.length === 0) {
        container.innerHTML = `
            <p style="text-align: center; color: var(--color-text-secondary); padding: var(--space-md);">
                Keine Trades in dieser Session
            </p>
        `;
        return;
    }
    
    container.innerHTML = trades.map(trade => {
        const isWin = trade.rMultiple > 0;
        const rClass = isWin ? 'win' : 'loss';
        const rColor = isWin ? 'var(--color-success)' : 'var(--color-danger)';
        
        return `
            <div class="trade-item ${rClass}">
                <div class="trade-info">
                    <span class="trade-pair">${trade.pair}</span>
                    <span class="trade-direction ${trade.direction}">${trade.direction.toUpperCase()}</span>
                </div>
                <span class="trade-r" style="color: ${rColor};">${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple.toFixed(1)}R</span>
            </div>
        `;
    }).join('');
}

// ========================================================================
// EQUITY CHART
// ========================================================================

/**
 * Initialisiert den Equity Chart.
 */
function initEquityChart() {
    const ctx = document.getElementById('equity-chart').getContext('2d');
    
    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Equity (R)',
                data: [],
                borderColor: 'rgba(76, 175, 80, 1)',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.2,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(76, 175, 80, 0.5)',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: false,
                    grid: {
                        display: false
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        callback: function(value) {
                            return value.toFixed(1) + 'R';
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

/**
 * Aktualisiert den Equity Chart.
 */
function updateEquityChart() {
    if (!equityChart) return;
    
    const trades = currentSession.trades;
    
    if (trades.length === 0) {
        equityChart.data.labels = [];
        equityChart.data.datasets[0].data = [];
        equityChart.update('none');
        return;
    }
    
    // Berechne kumulative Equity
    let cumulativeR = 0;
    const equityData = [0]; // Start bei 0
    const labels = ['Start'];
    
    trades.forEach((trade, index) => {
        cumulativeR += trade.rMultiple;
        equityData.push(cumulativeR);
        labels.push(`#${index + 1}`);
    });
    
    equityChart.data.labels = labels;
    equityChart.data.datasets[0].data = equityData;
    
    // Farbcodierung (Grün wenn positiv, Rot wenn negativ)
    const finalR = equityData[equityData.length - 1];
    if (finalR >= 0) {
        equityChart.data.datasets[0].borderColor = 'rgba(76, 175, 80, 1)';
        equityChart.data.datasets[0].backgroundColor = 'rgba(76, 175, 80, 0.1)';
    } else {
        equityChart.data.datasets[0].borderColor = 'rgba(244, 67, 54, 1)';
        equityChart.data.datasets[0].backgroundColor = 'rgba(244, 67, 54, 0.1)';
    }
    
    equityChart.update('none'); // Kein Animation für Performance
}

// ========================================================================
// SESSION HISTORY
// ========================================================================

/**
 * Zeigt die Session-Historie an.
 */
async function showSessionHistory() {
    try {
        // Lade alle Backtests
        const allBacktests = await dbLoadBacktests();
        
        if (allBacktests.length === 0) {
            showToast('Keine gespeicherten Sessions gefunden', 'info');
            return;
        }
        
        // Gruppiere nach Session-ID
        const sessions = {};
        allBacktests.forEach(trade => {
            if (!sessions[trade.sessionId]) {
                sessions[trade.sessionId] = [];
            }
            sessions[trade.sessionId].push(trade);
        });
        
        // Erstelle HTML
        let html = `
            <div style="max-height: 500px; overflow-y: auto;">
                <h3 style="margin-top: 0;">📊 Backtest Sessions</h3>
        `;
        
        Object.entries(sessions).forEach(([sessionId, trades]) => {
            const totalR = trades.reduce((sum, t) => sum + (parseFloat(t.rMultiple) || 0), 0);
            const wins = trades.filter(t => t.rMultiple > 0).length;
            const winrate = trades.length > 0 ? (wins / trades.length * 100).toFixed(1) : 0;
            
            html += `
                <div style="background: rgba(255,255,255,0.05); padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 3px solid ${totalR >= 0 ? '#4CAF50' : '#F44336'};">
                    <strong>${sessionId}</strong><br>
                    <small style="color: #9E9E9E;">
                        ${trades.length} Trades • 
                        ${winrate}% WR • 
                        ${totalR >= 0 ? '+' : ''}${totalR.toFixed(1)}R
                    </small>
                    <br>
                    <button onclick="loadSession('${sessionId}')" class="button primary-button" style="margin-top: 10px; padding: 6px 12px; font-size: 0.9em;">
                        <i class="fas fa-folder-open"></i> Laden
                    </button>
                    <button onclick="deleteSession('${sessionId}')" class="button danger-button" style="margin-top: 10px; padding: 6px 12px; font-size: 0.9em;">
                        <i class="fas fa-trash"></i> Löschen
                    </button>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Zeige Modal (nutze existierendes Toast-System oder erstelle einfaches Modal)
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--color-card);
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            z-index: 10000;
            max-width: 600px;
            width: 90%;
        `;
        modal.innerHTML = html + `
            <button onclick="this.parentElement.remove(); document.getElementById('modal-overlay').remove();" class="button secondary-button" style="width: 100%; margin-top: 20px;">
                Schließen
            </button>
        `;
        
        const overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        `;
        overlay.onclick = () => {
            modal.remove();
            overlay.remove();
        };
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Session-Historie:', error);
        showToast('Fehler beim Laden der Sessions', 'error');
    }
}

/**
 * Lädt eine gespeicherte Session.
 */
window.loadSession = async function(sessionId) {
    try {
        const trades = await dbLoadBacktests(sessionId);
        
        if (trades.length === 0) {
            showToast('Session nicht gefunden', 'error');
            return;
        }
        
        // Setze als aktuelle Session
        currentSession.id = sessionId;
        currentSession.name = sessionId;
        currentSession.trades = trades;
        currentSession.startTime = Date.now();
        
        document.getElementById('session-name').textContent = sessionId;
        
        // Update UI
        updateLiveStats();
        updateRecentTrades();
        
        // Schließe Modal
        document.querySelector('[id="modal-overlay"]')?.remove();
        document.body.querySelectorAll('div').forEach(div => {
            if (div.style.position === 'fixed' && div.style.zIndex === '10000') {
                div.remove();
            }
        });
        
        showToast(`Session geladen: ${trades.length} Trades`, 'success');
        
    } catch (error) {
        console.error('❌ Fehler beim Laden der Session:', error);
        showToast('Fehler beim Laden der Session', 'error');
    }
}

/**
 * Löscht eine Session.
 */
window.deleteSession = async function(sessionId) {
    if (!confirm(`Session "${sessionId}" wirklich löschen?`)) return;
    
    try {
        await dbDeleteBacktestSession(sessionId);
        showToast('Session gelöscht', 'success');
        
        // Schließe Modal und öffne neu
        document.querySelector('[id="modal-overlay"]')?.remove();
        document.body.querySelectorAll('div').forEach(div => {
            if (div.style.position === 'fixed' && div.style.zIndex === '10000') {
                div.remove();
            }
        });
        
        // Öffne History neu
        setTimeout(() => showSessionHistory(), 300);
        
    } catch (error) {
        console.error('❌ Fehler beim Löschen der Session:', error);
        showToast('Fehler beim Löschen der Session', 'error');
    }
}

// ========================================================================
// UTILITY
// ========================================================================

/**
 * Zeigt Toast-Benachrichtigung (fallback falls ui_feedback.js nicht geladen).
 */
if (typeof showToast === 'undefined') {
    window.showToast = function(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    };
}

console.log('✅ Backtest.js geladen');
