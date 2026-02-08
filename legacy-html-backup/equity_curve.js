// Trading Journal/equity_curve.js
// ======================================
// SCRIPT FÜR equity_curve.html
// ======================================

// Globale Variable für das Chart
let equityChart = null;
// Globaler Status für den Zeitfilter
let currentChartTimeFilter = 'all'; 
// Globaler Status für das Konto
let selectedAccount = 'ek'; // Standardmäßig EK anzeigen
// Globaler Status für Chart-Typ (PnL oder R)
let chartType = 'pnl'; // 'pnl' or 'r'
// NEU: Benutzerdefinierter Datumsbereich
let customDateFrom = null;
let customDateTo = null;

document.addEventListener('DOMContentLoaded', () => {
    // Klick-Handler für Konto-Auswahl
    const selector = document.getElementById('account-selector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            selectedAccount = e.target.value;
            runChartUpdate();
        });
    }
    
    // NEU: Klick-Handler für R-Multiple Toggle (Funktion 1)
    const rToggle = document.getElementById('r-multiple-toggle');
    if (rToggle) {
        rToggle.addEventListener('change', (e) => {
            chartType = e.target.checked ? 'r' : 'pnl';
            runChartUpdate();
        });
    }
    
    // Klick-Handler für Zeitfilter-Buttons
    setupTimeFilterButtons();
    
    // NEU: Datumsfilter-Handler
    setupDateFilter();
    
    // Sicherstellen, dass die Datenbasis (Startkapital) korrekt ist
    if (typeof recalculateAllBalances === 'function') {
        recalculateAllBalances();
    }
    
    // Chart beim ersten Laden zeichnen
    runChartUpdate(); 
});

// ======================================
// NEU: DATUMSFILTER SETUP
// ======================================
function setupDateFilter() {
    const applyBtn = document.getElementById('apply-date-filter');
    const resetBtn = document.getElementById('reset-date-filter');
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');
    
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const fromValue = dateFromInput.value;
            const toValue = dateToInput.value;
            
            if (fromValue) {
                customDateFrom = new Date(fromValue);
            }
            if (toValue) {
                customDateTo = new Date(toValue);
                customDateTo.setHours(23, 59, 59, 999); // Ende des Tages
            }
            
            // Quick-Filter zurücksetzen
            currentChartTimeFilter = 'custom';
            updateTimeFilterButtonStyles();
            
            runChartUpdate();
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            customDateFrom = null;
            customDateTo = null;
            dateFromInput.value = '';
            dateToInput.value = '';
            currentChartTimeFilter = 'all';
            updateTimeFilterButtonStyles();
            runChartUpdate();
        });
    }
}

function updateTimeFilterButtonStyles() {
    const buttons = document.querySelectorAll('#time-filter-controls .time-filter-btn');
    buttons.forEach(btn => {
        const filter = btn.getAttribute('data-filter');
        if (filter === currentChartTimeFilter || (currentChartTimeFilter === 'custom' && filter === 'all')) {
            btn.classList.remove('secondary-button');
            btn.classList.add('primary-button');
            btn.classList.add('active');
        } else {
            btn.classList.add('secondary-button');
            btn.classList.remove('primary-button');
            btn.classList.remove('active');
        }
    });
}

// ======================================
// ZEITFILTER-BUTTONS
// ======================================
function setupTimeFilterButtons() {
    const buttons = document.querySelectorAll('#time-filter-controls .time-filter-btn');
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // 1. Globalen Filter-Status setzen
            currentChartTimeFilter = button.getAttribute('data-filter');
            
            // Benutzerdefinierter Datumsfilter zurücksetzen
            customDateFrom = null;
            customDateTo = null;
            const dateFromInput = document.getElementById('date-from');
            const dateToInput = document.getElementById('date-to');
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            
            // 2. Button-Stile umschalten (Aktiv/Inaktiv)
            updateTimeFilterButtonStyles();
            
            // 3. Chart neu zeichnen
            runChartUpdate();
        });
    });
}

// ======================================
// HAUPTFUNKTION (Chart zeichnen)
// ======================================
function runChartUpdate() {
    const accountStatusEl = document.getElementById('account-status');
    if (accountStatusEl) {
        accountStatusEl.textContent = selectedAccount === 'ek' ? 'EK Account' : 'Funded Account';
    }

    const allTrades = loadTrades();
    const accountConfigs = loadAccountConfigs(); 
    
    let tradesToAnalyze = allTrades.filter(trade => trade.type === selectedAccount);
    let accountConfig = accountConfigs[selectedAccount];
    
    // Wende den Zeitfilter an
    const filteredTrades = filterTradesByTime(tradesToAnalyze);
    
    // Sortiere alle gefilterten Events chronologisch
    filteredTrades.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // NEU: Statistiken aktualisieren
    updatePeriodStats(filteredTrades);
    
    // Entscheide, welchen Chart wir zeichnen (Funktion 1)
    if (chartType === 'r') {
        renderREquityChart(filteredTrades, selectedAccount);
    } else {
        renderPnLEquityChart(filteredTrades, accountConfig, selectedAccount);
    }
}

/**
 * Filtert Trades basierend auf dem globalen Zeitfilter
 */
function filterTradesByTime(trades) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(new Date().setDate(today.getDate() - 7));
    const monthAgo = new Date(new Date().setMonth(today.getMonth() - 1));

    // Benutzerdefinierter Datumsfilter hat Priorität
    if (currentChartTimeFilter === 'custom' || (customDateFrom || customDateTo)) {
        return trades.filter(e => {
            const tradeDate = new Date(e.date);
            if (customDateFrom && tradeDate < customDateFrom) return false;
            if (customDateTo && tradeDate > customDateTo) return false;
            return true;
        });
    }

    if (currentChartTimeFilter === 'day') {
        return trades.filter(e => new Date(e.date) >= today);
    } else if (currentChartTimeFilter === 'week') {
        return trades.filter(e => new Date(e.date) >= weekAgo);
    } else if (currentChartTimeFilter === 'month') {
        return trades.filter(e => new Date(e.date) >= monthAgo);
    } else {
        return trades; // 'all'
    }
}

/**
 * NEU: Statistiken für den aktuellen Zeitraum berechnen und anzeigen
 */
function updatePeriodStats(trades) {
    const totalTrades = trades.length;
    let wins = 0;
    let totalR = 0;
    let peakR = 0;
    let maxDrawdown = 0;
    let cumR = 0;

    trades.forEach(trade => {
        const r = parseFloat(trade.rMultiple) || 0;
        totalR += r;
        cumR += r;
        
        if (r > 0) wins++;
        
        if (cumR > peakR) peakR = cumR;
        const dd = peakR - cumR;
        if (dd > maxDrawdown) maxDrawdown = dd;
    });

    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
    
    // UI aktualisieren
    const statTrades = document.getElementById('stat-trades');
    const statWinrate = document.getElementById('stat-winrate');
    const statTotalR = document.getElementById('stat-total-r');
    const statDrawdown = document.getElementById('stat-drawdown');
    
    if (statTrades) statTrades.textContent = totalTrades;
    if (statWinrate) {
        statWinrate.textContent = winRate + '%';
        statWinrate.style.color = winRate >= 50 ? 'var(--color-pnl-positive)' : 'var(--color-pnl-negative)';
    }
    if (statTotalR) {
        const prefix = totalR > 0 ? '+' : '';
        statTotalR.textContent = prefix + totalR.toFixed(1) + ' R';
        statTotalR.style.color = totalR >= 0 ? 'var(--color-pnl-positive)' : 'var(--color-pnl-negative)';
    }
    if (statDrawdown) {
        statDrawdown.textContent = '-' + maxDrawdown.toFixed(1) + ' R';
        statDrawdown.style.color = 'var(--color-pnl-negative)';
    }
}


// ======================================================================
// PNL (WÄHRUNG) EQUITY CURVE LOGIK
// ======================================================================
function renderPnLEquityChart(filteredTrades, accountConfig, selectedAccount) {
    const ctx = document.getElementById('equity-chart').getContext('2d');
    const initialBalance = accountConfig.initialStartBalance;
    
    // 1. Sicherstellen, dass der Startsaldo gültig ist
    if (initialBalance <= 0) {
        showChartError(ctx, 'Fehler: Startkapital ist 0. PnL kann nicht berechnet werden.');
        return;
    }

    // 2. Transaktionen für dieses Konto laden und filtern
    const transactions = filterTradesByTime(
        loadTransactions().filter(t => t.type === selectedAccount)
    );
    
    // 3. Alle Events (Trades + Transaktionen) kombinieren und sortieren
    const allEvents = [...filteredTrades, ...transactions];
    allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 4. Baue die Datenpunkte auf
    let currentPnLBalance = initialBalance; // Dies ist die PnL-Linie
    const labels = ['Start'];
    const dataPoints = [initialBalance.toFixed(2)];
    const colors = ['var(--color-accent-main)'];
    const tradeIds = [null]; // NEU: Für Interaktivität (Design 2)

    allEvents.forEach(event => {
        if (typeof event.rMultiple !== 'undefined') {
            // Es ist ein TRADE
            const pnl = calculateTradePnL(event, accountConfig);
            currentPnLBalance += pnl; // PnL zur Kurve hinzufügen
            
            labels.push(`Trade ${event.pair || 'N/A'} (${event.date})`);
            dataPoints.push(currentPnLBalance.toFixed(2));
            colors.push(pnl >= 0 ? 'var(--color-pnl-positive)' : 'var(--color-pnl-negative)');
            tradeIds.push(event.id); // NEU
            
        } else if (typeof event.amount !== 'undefined') {
            // Es ist eine TRANSAKTION (Ein-/Auszahlung)
            const txnType = event.amount > 0 ? 'Einzahlung' : 'Auszahlung';
            labels.push(`${txnType} (${event.amount.toFixed(2)}) (${event.date})`);
            
            // PnL-Kurve ignoriert diesen Betrag und bleibt horizontal
            dataPoints.push(currentPnLBalance.toFixed(2));
            colors.push('var(--color-accent-secondary)'); 
            tradeIds.push(null); // NEU
        }
    });

    // 5. Zerstöre altes Chart, bevor neues gezeichnet wird
    if (equityChart) {
        equityChart.destroy();
    }
    
    // 6. Prüfen, ob Daten vorhanden sind
    if (dataPoints.length <= 1) {
        showChartError(ctx, 'Keine Trades in diesem Zeitraum gefunden.');
        return;
    }
    
    // 7. Theme-Farben bestimmen (Vereinfacht für das fixe Dark Theme)
    const gridColor = 'rgba(58, 64, 74, 0.5)';
    const tickColor = 'var(--color-text-subtle)';

    // 8. Neues Chart zeichnen
    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Kontoperformance (PnL in ${accountConfig.currency})`,
                data: dataPoints,
                borderColor: 'var(--color-accent-main)',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.1,
                pointBackgroundColor: colors,
                pointBorderColor: colors,
                pointRadius: 3,
                pointHoverRadius: 6,
                // NEU: Trade-IDs an die Daten anhängen (Design 2)
                tradeIds: tradeIds, 
                accountType: selectedAccount
            }]
        },
        options: {
            maintainAspectRatio: false, // Wichtig für die <div height>
            // NEU: onClick-Handler für Interaktivität (Design 2)
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const elementIndex = elements[0].index;
                    const dataset = e.chart.data.datasets[0];
                    const tradeId = dataset.tradeIds[elementIndex];
                    const accountType = dataset.accountType;
                    
                    if (tradeId) {
                        handleChartClick(tradeId, accountType);
                    }
                }
            },
            onHover: (e, elements) => {
                // Mauszeiger zu "pointer" ändern, wenn über einem Trade
                const canvas = e.chart.canvas;
                if (elements.length > 0) {
                    const tradeId = e.chart.data.datasets[0].tradeIds[elements[0].index];
                    canvas.style.cursor = tradeId ? 'pointer' : 'default';
                } else {
                    canvas.style.cursor = 'default';
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            return `Performance: ${context.formattedValue} ${accountConfig.currency}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: tickColor,
                        callback: function(value) {
                            return value.toLocaleString('de-DE') + ' ' + accountConfig.currency;
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                x: {
                    ticks: {
                        display: false 
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ======================================================================
// R-MULTIPLE EQUITY CURVE LOGIK (NEU: Funktion 1)
// ======================================================================
function renderREquityChart(filteredTrades, selectedAccount) {
    const ctx = document.getElementById('equity-chart').getContext('2d');

    // 1. Baue die Datenpunkte auf
    let currentR = 0;
    const labels = ['Start'];
    const dataPoints = [0]; // Startet immer bei 0 R
    const colors = ['var(--color-accent-main)'];
    const tradeIds = [null]; // NEU: Für Interaktivität (Design 2)

    filteredTrades.forEach(trade => {
        const r = parseFloat(trade.rMultiple) || 0;
        currentR += r;
            
        labels.push(`Trade ${trade.pair || 'N/A'} (${trade.date})`);
        dataPoints.push(currentR.toFixed(1));
        colors.push(r >= 0 ? 'var(--color-pnl-positive)' : 'var(--color-pnl-negative)');
        tradeIds.push(trade.id); // NEU
    });

    // 2. Zerstöre altes Chart, bevor neues gezeichnet wird
    if (equityChart) {
        equityChart.destroy();
    }
    
    // 3. Prüfen, ob Daten vorhanden sind
    if (dataPoints.length <= 1) {
        showChartError(ctx, 'Keine Trades in diesem Zeitraum gefunden.');
        return;
    }
    
    // 4. Theme-Farben bestimmen (Vereinfacht für das fixe Dark Theme)
    const gridColor = 'rgba(58, 64, 74, 0.5)';
    const tickColor = 'var(--color-text-subtle)';

    // 5. Neues Chart zeichnen
    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Kumulative R-Multiple`,
                data: dataPoints,
                borderColor: 'var(--color-accent-main)',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.1,
                pointBackgroundColor: colors,
                pointBorderColor: colors,
                pointRadius: 3,
                pointHoverRadius: 6,
                // NEU: Trade-IDs an die Daten anhängen (Design 2)
                tradeIds: tradeIds, 
                accountType: selectedAccount
            }]
        },
        options: {
            maintainAspectRatio: false,
            // NEU: onClick-Handler für Interaktivität (Design 2)
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const elementIndex = elements[0].index;
                    const dataset = e.chart.data.datasets[0];
                    const tradeId = dataset.tradeIds[elementIndex];
                    const accountType = dataset.accountType;
                    
                    if (tradeId) {
                        handleChartClick(tradeId, accountType);
                    }
                }
            },
            onHover: (e, elements) => {
                // Mauszeiger zu "pointer" ändern, wenn über einem Trade
                const canvas = e.chart.canvas;
                if (elements.length > 0) {
                    const tradeId = e.chart.data.datasets[0].tradeIds[elements[0].index];
                    canvas.style.cursor = tradeId ? 'pointer' : 'default';
                } else {
                    canvas.style.cursor = 'default';
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            return `Performance: ${context.formattedValue} R`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        color: tickColor,
                        callback: function(value) {
                            return value.toLocaleString('de-DE') + ' R';
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                x: {
                    ticks: {
                        display: false 
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}


/**
 * Zeigt eine Fehlermeldung im Canvas an
 */
function showChartError(ctx, message) {
    if (equityChart) equityChart.destroy();
    equityChart = null;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    ctx.fillStyle = 'var(--color-text-subtle)';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(message, ctx.canvas.width / 2, 190);
}

/**
 * NEU: Behandelt Klick auf einen Chart-Punkt (Design 2)
 * Leitet zur Journal-Seite weiter und markiert den Trade.
 */
function handleChartClick(tradeId, accountType) {
    console.log(`Chart-Klick: Leite zu ${accountType} weiter, markiere Trade ${tradeId}`);
    
    // Speichere die ID im sessionStorage, um sie auf der nächsten Seite zu lesen
    sessionStorage.setItem('highlightTradeId', tradeId);
    
    // Leite zur entsprechenden Journal-Seite weiter
    window.location.href = `${accountType}_journal.html`;
}