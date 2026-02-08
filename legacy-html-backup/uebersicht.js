// uebersicht.js - Dashboard mit Popup-System
// ======================================
// SCRIPT FÜR uebersicht.html (NEU)
// ======================================

// Verwende TRACKED_SYMBOLS aus config.js, falls verfügbar
const UEBERSICHT_TRACKED_SYMBOLS = typeof TRACKED_SYMBOLS !== 'undefined' 
    ? TRACKED_SYMBOLS 
    : ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'USD'];

// Verwende SETUP_DEFINITIONS aus config.js, falls verfügbar
const UEBERSICHT_SETUP_DEFINITIONS = (() => {
    if (typeof SETUP_DEFINITIONS !== 'undefined') {
        const simple = {};
        Object.keys(SETUP_DEFINITIONS).forEach(key => {
            simple[key] = SETUP_DEFINITIONS[key].label || SETUP_DEFINITIONS[key];
        });
        return simple;
    }
    return {
        'setup_daily_bos': 'Daily BOS',
        'setup_value_area': 'Value Area',
        'setup_market_structure': 'Market Structure',
        'setup_weekly_gva': 'Weekly GVA',
        'setup_3day_gva': '3Day GVA'
    };
})();

// Globale Variablen für gecachte Analyse-Daten
let cachedMetrics = null;
let cachedWeekdayData = null;
let cachedSetupData = null;
let cachedPairData = null;
let cachedTrades = [];

// ======================================
// POPUP SYSTEM (wie im Journal)
// ======================================
function openPopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) {
        popup.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closePopup(popupId) {
    const popup = document.getElementById(popupId);
    if (popup) {
        popup.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ESC-Taste und Klick außerhalb zum Schließen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.popup-overlay.active').forEach(popup => {
            popup.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('popup-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// ======================================
// TOAST NOTIFICATIONS
// ======================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ======================================
// INIT
// ======================================
document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('account-selector');
    
    if (selector) {
        selector.addEventListener('change', runAnalysis);
    }
    
    // Initiale Analyse
    if (typeof recalculateAllBalances === 'function') {
        recalculateAllBalances();
    }
    
    runAnalysis();
    renderLatestBias();
    renderLatestCot();
});

// ======================================
// HAUPTANALYSE FUNKTION
// ======================================
function runAnalysis() {
    const selectedAccount = document.getElementById('account-selector').value;
    const allTrades = loadTrades();
    
    let tradesToAnalyze = allTrades;
    
    if (selectedAccount !== 'all') {
        tradesToAnalyze = allTrades.filter(trade => trade.type === selectedAccount);
    }
    
    // Cache für Popups
    cachedTrades = tradesToAnalyze;
    
    // Alle Module berechnen und rendern
    cachedMetrics = calculateKeyMetrics(tradesToAnalyze);
    renderKeyMetrics(cachedMetrics);
    
    cachedWeekdayData = analyzeWeekdays(tradesToAnalyze);
    renderMiniWeekdayChart(cachedWeekdayData);
    
    cachedSetupData = analyzeSetups(tradesToAnalyze);
    renderMiniSetupList(cachedSetupData);
    
    cachedPairData = analyzePairs(tradesToAnalyze);
    renderMiniPairsList(cachedPairData);
    
    renderMiniRecentTrades(tradesToAnalyze);
    renderMiniBiasList();
}

// ======================================
// SCHLÜSSELKENNZAHLEN
// ======================================
function calculateKeyMetrics(trades) {
    const totalTrades = trades.length;
    let wins = 0;
    let losses = 0;
    let breakeven = 0;
    let totalR = 0;
    let totalWinR = 0;
    let totalLossR = 0;
    
    let peakBalanceR = 0;
    let maxDrawdownR = 0;
    let cumulativeR = 0;

    if (totalTrades === 0) {
        return { totalTrades: 0, wins: 0, losses: 0, breakeven: 0, winRate: 0, totalR: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, maxDrawdownR: 0 };
    }

    trades.forEach(trade => {
        const r = parseFloat(trade.rMultiple) || 0;
        totalR += r;
        
        // Drawdown Berechnung
        cumulativeR += r;
        if (cumulativeR > peakBalanceR) {
            peakBalanceR = cumulativeR;
        }
        const currentDrawdownR = peakBalanceR - cumulativeR;
        if (currentDrawdownR > maxDrawdownR) {
            maxDrawdownR = currentDrawdownR;
        }
        
        // Normale Metriken
        if (r > 0) {
            wins++;
            totalWinR += r;
        } else if (r < 0) {
            losses++;
            totalLossR += Math.abs(r);
        } else {
            breakeven++;
        }
    });

    const winRate = (wins / totalTrades) * 100;
    const profitFactor = (totalLossR > 0) ? (totalWinR / totalLossR) : (totalWinR > 0 ? Infinity : 0);
    const avgWin = (wins > 0) ? (totalWinR / wins) : 0;
    const avgLoss = (losses > 0) ? (totalLossR / losses) : 0;

    return {
        totalTrades,
        wins,
        losses,
        breakeven,
        winRate,
        totalR,
        profitFactor,
        avgWin,
        avgLoss: avgLoss * -1,
        maxDrawdownR: maxDrawdownR * -1
    };
}

function renderKeyMetrics(metrics) {
    // Quick Stats Banner
    document.getElementById('win-rate').textContent = `${metrics.winRate.toFixed(1)}%`;
    document.getElementById('total-trades').textContent = metrics.totalTrades;
    document.getElementById('total-r').textContent = `${metrics.totalR.toFixed(1)} R`;
    
    let pfText = metrics.profitFactor === Infinity ? "∞" : metrics.profitFactor.toFixed(2);
    document.getElementById('kpi-profit-factor').textContent = pfText;
    
    // Farbcodierung für Quick Stats
    const winRateEl = document.getElementById('win-rate');
    winRateEl.className = 'value ' + (metrics.winRate >= 50 ? 'positive' : metrics.winRate > 0 ? 'negative' : '');
    
    const totalREl = document.getElementById('total-r');
    totalREl.className = 'value ' + (metrics.totalR > 0 ? 'positive' : metrics.totalR < 0 ? 'negative' : '');
    
    // KPI Popup aktualisieren
    document.getElementById('popup-win-rate').textContent = `${metrics.winRate.toFixed(1)}%`;
    document.getElementById('popup-total-trades').textContent = metrics.totalTrades;
    document.getElementById('popup-wins').textContent = metrics.wins;
    document.getElementById('popup-losses').textContent = metrics.losses;
    document.getElementById('popup-be').textContent = metrics.breakeven;
    document.getElementById('popup-profit-factor').textContent = pfText;
    document.getElementById('popup-total-r').textContent = `${metrics.totalR.toFixed(1)} R`;
    document.getElementById('popup-avg-win').textContent = `${metrics.avgWin.toFixed(2)} R`;
    document.getElementById('popup-avg-loss').textContent = `${metrics.avgLoss.toFixed(2)} R`;
    document.getElementById('popup-max-dd').textContent = `${metrics.maxDrawdownR.toFixed(1)} R`;
}

// ======================================
// WOCHENTAGS-ANALYSE
// ======================================
const WEEKDAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEKDAY_FULL_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function analyzeWeekdays(trades) {
    const weekdayData = {};
    for (let i = 0; i < 7; i++) {
        weekdayData[i] = { trades: 0, wins: 0, totalR: 0 };
    }
    
    trades.forEach(trade => {
        if (!trade.date) return;
        const date = new Date(trade.date);
        const dayOfWeek = date.getDay();
        const r = parseFloat(trade.rMultiple) || 0;
        
        weekdayData[dayOfWeek].trades++;
        weekdayData[dayOfWeek].totalR += r;
        if (trade.result === 'win') {
            weekdayData[dayOfWeek].wins++;
        }
    });
    
    return weekdayData;
}

function renderMiniWeekdayChart(weekdayData) {
    const container = document.getElementById('mini-weekday-chart');
    if (!container) return;
    
    const tradingDays = [1, 2, 3, 4, 5]; // Mo-Fr
    const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
    
    let maxAbsR = 0;
    tradingDays.forEach(day => {
        const absR = Math.abs(weekdayData[day].totalR);
        if (absR > maxAbsR) maxAbsR = absR;
    });
    if (maxAbsR === 0) maxAbsR = 1;
    
    // Finde besten Tag
    let bestDay = { idx: -1, totalR: -Infinity };
    tradingDays.forEach((day, idx) => {
        if (weekdayData[day].totalR > bestDay.totalR && weekdayData[day].trades > 0) {
            bestDay = { idx: day, totalR: weekdayData[day].totalR };
        }
    });
    
    // Badge aktualisieren
    const badge = document.getElementById('best-day-badge');
    if (badge) {
        badge.textContent = bestDay.idx > 0 ? `${WEEKDAY_NAMES[bestDay.idx]} ist Top` : 'Keine Daten';
    }
    
    let html = '<div class="mini-bars">';
    tradingDays.forEach((day, idx) => {
        const data = weekdayData[day];
        const heightPercent = data.trades > 0 ? Math.max((Math.abs(data.totalR) / maxAbsR) * 100, 15) : 10;
        const colorClass = data.totalR > 0 ? 'positive' : data.totalR < 0 ? 'negative' : 'neutral';
        
        html += `
            <div class="mini-bar-item">
                <div class="mini-bar ${colorClass}" style="height: ${heightPercent}%;" title="${data.totalR.toFixed(1)} R"></div>
                <span class="mini-bar-label">${dayLabels[idx]}</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
    
    // Popup Weekday-Chart rendern
    renderFullWeekdayChart(weekdayData, bestDay);
}

function renderFullWeekdayChart(weekdayData, bestDay) {
    const container = document.getElementById('weekday-chart-full');
    if (!container) return;
    
    const tradingDays = [1, 2, 3, 4, 5];
    const dayLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
    
    let maxAbsR = 0;
    tradingDays.forEach(day => {
        const absR = Math.abs(weekdayData[day].totalR);
        if (absR > maxAbsR) maxAbsR = absR;
    });
    if (maxAbsR === 0) maxAbsR = 1;
    
    let html = '<div class="full-weekday-chart">';
    tradingDays.forEach((day, idx) => {
        const data = weekdayData[day];
        const heightPercent = data.trades > 0 ? Math.max((Math.abs(data.totalR) / maxAbsR) * 100, 10) : 5;
        const colorClass = data.totalR > 0 ? 'positive' : data.totalR < 0 ? 'negative' : 'neutral';
        const winRate = data.trades > 0 ? ((data.wins / data.trades) * 100).toFixed(0) : 0;
        
        html += `
            <div class="weekday-bar-item">
                <div class="weekday-bar-value ${colorClass}">${data.totalR.toFixed(1)} R</div>
                <div class="weekday-bar ${colorClass}" style="height: ${heightPercent}%;">
                    <span class="weekday-bar-trades">${data.trades}</span>
                </div>
                <div class="weekday-bar-label">${dayLabels[idx]}</div>
                <div class="weekday-bar-winrate">${winRate}% WR</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
    
    // Best Day Info
    const bestDayInfo = document.getElementById('popup-best-day-info');
    if (bestDayInfo) {
        if (bestDay.idx > 0) {
            const data = weekdayData[bestDay.idx];
            const winRate = ((data.wins / data.trades) * 100).toFixed(0);
            bestDayInfo.innerHTML = `<strong>${WEEKDAY_FULL_NAMES[bestDay.idx]}</strong> mit ${data.totalR.toFixed(1)} R aus ${data.trades} Trades (${winRate}% Win Rate)`;
        } else {
            bestDayInfo.textContent = 'Noch keine Trades vorhanden';
        }
    }
}

// ======================================
// SETUP-ANALYSE
// ======================================
function analyzeSetups(trades) {
    const setupResults = {};

    Object.keys(UEBERSICHT_SETUP_DEFINITIONS).forEach(key => {
        setupResults[key] = { name: UEBERSICHT_SETUP_DEFINITIONS[key], trades: 0, wins: 0, totalR: 0 };
    });

    trades.forEach(trade => {
        Object.keys(UEBERSICHT_SETUP_DEFINITIONS).forEach(setupKey => {
            if (trade[setupKey] === true) {
                const data = setupResults[setupKey];
                data.trades++;
                data.totalR += (parseFloat(trade.rMultiple) || 0);
                if (trade.result === 'win') {
                    data.wins++;
                }
            }
        });
    });
    
    return Object.values(setupResults)
        .map(data => ({
            name: data.name,
            trades: data.trades,
            wins: data.wins,
            totalR: data.totalR,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
            avgR: data.trades > 0 ? data.totalR / data.trades : 0
        }))
        .sort((a, b) => b.totalR - a.totalR);
}

function renderMiniSetupList(setupData) {
    const container = document.getElementById('mini-setup-list');
    if (!container) return;
    
    // Top 3 Setups zeigen
    const top3 = setupData.filter(s => s.trades > 0).slice(0, 3);
    
    // Badge aktualisieren
    const badge = document.getElementById('best-setup-badge');
    if (badge && top3.length > 0) {
        badge.textContent = `${top3[0].name} Top`;
    } else if (badge) {
        badge.textContent = 'Keine Daten';
    }
    
    if (top3.length === 0) {
        container.innerHTML = '<div class="mini-list-empty">Keine Setups markiert</div>';
    } else {
        let html = '';
        top3.forEach(setup => {
            const colorClass = setup.totalR > 0 ? 'positive' : setup.totalR < 0 ? 'negative' : '';
            html += `
                <div class="mini-list-item">
                    <span class="mini-list-name">${setup.name}</span>
                    <span class="mini-list-value ${colorClass}">${setup.totalR.toFixed(1)} R</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }
    
    // Popup Setup-Tabelle rendern
    renderSetupPopupTable(setupData);
}

function renderSetupPopupTable(setupData) {
    const tbody = document.getElementById('popup-setup-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (setupData.every(s => s.trades === 0)) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-subtle);">Keine Setups markiert</td></tr>';
        return;
    }
    
    setupData.forEach(setup => {
        if (setup.trades === 0) return;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><span class="tag-badge">${setup.name}</span></td>
            <td>${setup.trades}</td>
            <td class="${setup.winRate >= 50 ? 'pnl-positive' : 'pnl-negative'}">${setup.winRate.toFixed(1)}%</td>
            <td class="${setup.totalR > 0 ? 'pnl-positive' : 'pnl-negative'}">${setup.totalR.toFixed(1)} R</td>
            <td class="${setup.avgR > 0 ? 'pnl-positive' : 'pnl-negative'}">${setup.avgR.toFixed(2)} R</td>
        `;
    });
}

// ======================================
// WÄHRUNGSPAAR-ANALYSE
// ======================================
function analyzePairs(trades) {
    const pairData = {};
    
    trades.forEach(trade => {
        const pair = trade.pair;
        if (!pair) return;
        if (!pairData[pair]) {
            pairData[pair] = { trades: 0, wins: 0, totalR: 0 };
        }
        pairData[pair].trades++;
        pairData[pair].totalR += (parseFloat(trade.rMultiple) || 0);
        if (trade.result === 'win') {
            pairData[pair].wins++;
        }
    });
    
    return Object.keys(pairData).map(pair => {
        const data = pairData[pair];
        return {
            pair,
            trades: data.trades,
            wins: data.wins,
            totalR: data.totalR,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0,
            avgR: data.trades > 0 ? data.totalR / data.trades : 0
        };
    }).sort((a, b) => b.totalR - a.totalR);
}

function renderMiniPairsList(pairData) {
    const container = document.getElementById('mini-pairs-list');
    if (!container) return;
    
    const top3 = pairData.slice(0, 3);
    
    // Badge aktualisieren
    const badge = document.getElementById('best-pair-badge');
    if (badge && top3.length > 0) {
        badge.textContent = `${top3[0].pair} Top`;
    } else if (badge) {
        badge.textContent = 'Keine Daten';
    }
    
    if (top3.length === 0) {
        container.innerHTML = '<div class="mini-list-empty">Keine Trades</div>';
    } else {
        let html = '';
        top3.forEach(item => {
            const colorClass = item.totalR > 0 ? 'positive' : item.totalR < 0 ? 'negative' : '';
            html += `
                <div class="mini-list-item">
                    <span class="mini-list-name">${item.pair}</span>
                    <span class="mini-list-value ${colorClass}">${item.totalR.toFixed(1)} R</span>
                </div>
            `;
        });
        container.innerHTML = html;
    }
    
    // Popup Pairs-Tabelle rendern
    renderPairsPopupTable(pairData);
}

function renderPairsPopupTable(pairData) {
    const tbody = document.getElementById('popup-pairs-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (pairData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-subtle);">Keine Trades gefunden</td></tr>';
        return;
    }
    
    pairData.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${item.pair}</strong></td>
            <td>${item.trades}</td>
            <td class="${item.winRate >= 50 ? 'pnl-positive' : 'pnl-negative'}">${item.winRate.toFixed(1)}%</td>
            <td class="${item.totalR > 0 ? 'pnl-positive' : 'pnl-negative'}">${item.totalR.toFixed(1)} R</td>
            <td class="${item.avgR > 0 ? 'pnl-positive' : 'pnl-negative'}">${item.avgR.toFixed(2)} R</td>
        `;
    });
}

// ======================================
// LETZTE TRADES
// ======================================
function renderMiniRecentTrades(trades) {
    const container = document.getElementById('recent-trades-list');
    if (!container) return;
    
    // Sortiere nach Datum (neueste zuerst)
    const sortedTrades = [...trades].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent5 = sortedTrades.slice(0, 5);
    
    if (recent5.length === 0) {
        container.innerHTML = '<div class="mini-list-empty" style="text-align: center; padding: var(--space-lg);">Keine Trades vorhanden</div>';
    } else {
        let html = '';
        recent5.forEach(trade => {
            const r = parseFloat(trade.rMultiple) || 0;
            const colorClass = r > 0 ? 'positive' : r < 0 ? 'negative' : '';
            const resultIcon = trade.result === 'win' ? 'fa-check-circle' : trade.result === 'loss' ? 'fa-times-circle' : 'fa-minus-circle';
            const accountLabel = trade.type === 'funded' ? 'F' : 'EK';
            
            html += `
                <div class="recent-trade-item">
                    <div class="recent-trade-left">
                        <i class="fas ${resultIcon} ${colorClass}"></i>
                        <span class="recent-trade-pair">${trade.pair || '-'}</span>
                        <span class="recent-trade-date">${trade.date || '-'}</span>
                    </div>
                    <div class="recent-trade-right">
                        <span class="recent-trade-r ${colorClass}">${r.toFixed(1)} R</span>
                        <span class="recent-trade-account">${accountLabel}</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }
    
    // Popup Trades-Tabelle rendern
    renderTradesPopupTable(sortedTrades);
}

function renderTradesPopupTable(trades) {
    const tbody = document.getElementById('popup-trades-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (trades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-subtle);">Keine Trades gefunden</td></tr>';
        return;
    }
    
    trades.forEach(trade => {
        const r = parseFloat(trade.rMultiple) || 0;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${trade.date || '-'}</td>
            <td><strong>${trade.pair || '-'}</strong></td>
            <td><span class="result-badge ${trade.result}">${trade.result === 'win' ? 'Win' : trade.result === 'loss' ? 'Loss' : 'BE'}</span></td>
            <td class="${r > 0 ? 'pnl-positive' : r < 0 ? 'pnl-negative' : ''}">${r.toFixed(1)} R</td>
            <td>${trade.type === 'funded' ? 'Funded' : 'EK'}</td>
        `;
    });
}

// ======================================
// BIAS & COT
// ======================================
function createCompactPairCard(title, value, unit, directionClass) {
    return `
        <div class="compact-pair-card">
            <div class="label">${title}</div>
            <strong>${value}</strong>
            <span class="bias-indicator ${directionClass}">${unit}</span>
        </div>
    `;
}

function renderMiniBiasList() {
    if (typeof loadBiasData !== 'function') return;
    
    const container = document.getElementById('mini-bias-list');
    if (!container) return;
    
    const biasData = loadBiasData();
    const latestBias = {};
    
    biasData.sort((a, b) => b.id - a.id);
    biasData.forEach(entry => {
        if (!latestBias[entry.currency]) {
            latestBias[entry.currency] = entry;
        }
    });
    
    // Top 4 Währungen zeigen
    const majorCurrencies = ['EUR', 'USD', 'GBP', 'JPY'];
    let html = '';
    
    majorCurrencies.forEach(symbol => {
        const entry = latestBias[symbol];
        let directionText = 'N/A';
        let directionClass = 'neutral';
        
        if (entry) {
            if (entry.bias === 'Stark Long' || entry.bias === 'Long') {
                directionText = entry.bias === 'Stark Long' ? '↑↑' : '↑';
                directionClass = 'long';
            } else if (entry.bias === 'Stark Short' || entry.bias === 'Short') {
                directionText = entry.bias === 'Stark Short' ? '↓↓' : '↓';
                directionClass = 'short';
            } else {
                directionText = '—';
                directionClass = 'neutral';
            }
        }
        
        html += `
            <div class="mini-bias-item ${directionClass}">
                <span class="mini-bias-symbol">${symbol}</span>
                <span class="mini-bias-direction">${directionText}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderLatestBias() {
    if (typeof loadBiasData !== 'function') return;
    
    const container = document.getElementById('popup-bias-grid');
    if (!container) return;
    
    const biasData = loadBiasData();
    const latestBias = {};
    
    biasData.sort((a, b) => b.id - a.id);
    biasData.forEach(entry => {
        if (!latestBias[entry.currency]) {
            latestBias[entry.currency] = entry;
        }
    });
    
    let html = '';
    
    UEBERSICHT_TRACKED_SYMBOLS.forEach(symbol => {
        const entry = latestBias[symbol];
        let directionText = 'N/A';
        let directionClass = 'neutral';
        let date = '';
        
        if (entry) {
            if (entry.bias === 'Stark Long') { directionText = 'STARK LONG'; directionClass = 'long'; }
            else if (entry.bias === 'Long') { directionText = 'LONG'; directionClass = 'long'; }
            else if (entry.bias === 'Short') { directionText = 'SHORT'; directionClass = 'short'; }
            else if (entry.bias === 'Stark Short') { directionText = 'STARK SHORT'; directionClass = 'short'; }
            else { directionText = 'NEUTRAL'; directionClass = 'neutral'; }
            date = entry.date;
        }
        
        html += `
            <div class="stat-box">
                <span class="label">${symbol}</span>
                <span class="value bias-indicator ${directionClass}">${directionText}</span>
                ${date ? `<span class="sublabel">${date}</span>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderLatestCot() {
    if (typeof loadCotData !== 'function') return;
    
    const container = document.getElementById('popup-cot-grid');
    if (!container) return;
    
    const cotData = loadCotData();
    const latestCot = {};
    
    cotData.sort((a, b) => b.id - a.id);
    cotData.forEach(entry => {
        if (!latestCot[entry.symbol]) {
            latestCot[entry.symbol] = entry;
        }
    });
    
    let html = '';
    
    UEBERSICHT_TRACKED_SYMBOLS.forEach(symbol => {
        const entry = latestCot[symbol];
        let value = 'N/A';
        let unit = 'Netto';
        let directionClass = 'neutral';
        let date = '';
        
        if (entry) {
            const netPosition = entry.commercial_net_position;
            value = netPosition.toLocaleString('de-DE');
            date = entry.date;
            
            if (netPosition > 75000) { unit = 'STARK LONG'; directionClass = 'long'; }
            else if (netPosition > 25000) { unit = 'LONG'; directionClass = 'long'; }
            else if (netPosition < -75000) { unit = 'STARK SHORT'; directionClass = 'short'; }
            else if (netPosition < -25000) { unit = 'SHORT'; directionClass = 'short'; }
            else { unit = 'NEUTRAL'; directionClass = 'neutral'; }
        }
        
        html += `
            <div class="stat-box">
                <span class="label">${symbol}</span>
                <span class="value">${value}</span>
                <span class="sublabel bias-indicator ${directionClass}">${unit}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}
// ======================================
// DASHBOARD EQUITY CURVE
// ======================================
let dashboardEquityChart = null;

function initDashboardEquityCurve() {
    const canvas = document.getElementById('dashboard-equity-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Chart erstellen
    dashboardEquityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Equity (R)',
                data: [],
                borderColor: 'rgba(212, 168, 83, 1)',
                backgroundColor: 'rgba(212, 168, 83, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(30, 30, 30, 0.9)',
                    titleColor: '#D4A853',
                    bodyColor: '#fff',
                    borderColor: 'rgba(212, 168, 83, 0.5)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `Equity: ${context.parsed.y.toFixed(2)} R`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', maxTicksLimit: 8 }
                },
                y: {
                    display: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: 'rgba(255, 255, 255, 0.5)',
                        callback: function(value) { return value.toFixed(1) + ' R'; }
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
    
    // Period Filter
    const periodFilter = document.getElementById('equity-period-filter');
    if (periodFilter) {
        periodFilter.addEventListener('change', () => {
            updateDashboardEquityCurve(periodFilter.value);
        });
    }
    
    // Initial laden
    updateDashboardEquityCurve('all');
}

function updateDashboardEquityCurve(period = 'all') {
    if (!dashboardEquityChart || typeof loadTrades !== 'function') return;
    
    let trades = loadTrades();
    
    // Filtern nach Konto
    const accountSelector = document.getElementById('account-selector');
    if (accountSelector && accountSelector.value !== 'all') {
        const accountType = accountSelector.value;
        trades = trades.filter(t => t.accountType === accountType);
    }
    
    // Nach Datum sortieren
    trades.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Filtern nach Zeitraum
    const now = new Date();
    let startDate = null;
    
    switch (period) {
        case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90d':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'ytd':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
    }
    
    if (startDate) {
        trades = trades.filter(t => new Date(t.date) >= startDate);
    }
    
    // Equity Curve berechnen
    let equity = 0;
    const labels = [];
    const data = [];
    
    trades.forEach(trade => {
        const r = parseFloat(trade.rMultiple) || 0;
        equity += r;
        labels.push(trade.date);
        data.push(equity);
    });
    
    // Chart aktualisieren
    dashboardEquityChart.data.labels = labels;
    dashboardEquityChart.data.datasets[0].data = data;
    
    // Farbe basierend auf Performance
    const color = equity >= 0 ? 'rgba(0, 200, 150, 1)' : 'rgba(255, 82, 119, 1)';
    const bgColor = equity >= 0 ? 'rgba(0, 200, 150, 0.1)' : 'rgba(255, 82, 119, 0.1)';
    
    dashboardEquityChart.data.datasets[0].borderColor = color;
    dashboardEquityChart.data.datasets[0].backgroundColor = bgColor;
    
    dashboardEquityChart.update();
}

// Initialisierung erweitern
const originalDOMContentLoaded = document.addEventListener;
document.addEventListener('DOMContentLoaded', () => {
    // Kurze Verzögerung für Equity Curve
    setTimeout(() => {
        initDashboardEquityCurve();
    }, 100);
    
    // Neue Module initialisieren
    setTimeout(() => {
        renderWeeklyForecast();
        renderSetupHeatmap();
    }, 200);
});

// ======================================
// WEEKLY FORECAST (NEU)
// ======================================

async function renderWeeklyForecast() {
    const previewContainer = document.getElementById('weekly-forecast-preview');
    const fullListContainer = document.getElementById('forecast-full-list');
    
    if (!previewContainer) return;
    
    try {
        // Confluence Scores für alle Paare berechnen
        const pairScores = await window.InterestRatesModule.calculatePairConfluenceScores();
        
        // Sortieren nach Score (höchste zuerst)
        const sortedPairs = Object.values(pairScores).sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
        
        // Top 3 für Preview
        const top3 = sortedPairs.slice(0, 3);
        
        // Preview rendern
        let previewHtml = '<div class="forecast-preview-grid">';
        top3.forEach((item, index) => {
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            const biasClass = item.bias.toLowerCase().replace(' ', '-');
            const scoreColor = parseFloat(item.score) > 4 ? 'var(--color-pnl-positive)' : parseFloat(item.score) > 2 ? 'var(--color-accent)' : 'var(--color-text-muted)';
            
            previewHtml += `
                <div class="forecast-preview-card">
                    <div class="forecast-rank">${rankIcon}</div>
                    <div class="forecast-pair">${item.pair}</div>
                    <div class="forecast-bias bias-${biasClass}">${item.bias}</div>
                    <div class="forecast-score" style="color: ${scoreColor};">Score: ${item.score}</div>
                    <div class="forecast-details">
                        <small>${item.baseAnalysis.factors[0] || 'Keine Details'}</small>
                    </div>
                </div>
            `;
        });
        previewHtml += '</div>';
        previewContainer.innerHTML = previewHtml;
        
        // Vollständige Liste für Popup rendern
        if (fullListContainer) {
            let fullHtml = '';
            sortedPairs.forEach((item, index) => {
                const rankBadge = index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`;
                const biasClass = item.bias.toLowerCase().replace(' ', '-');
                const scoreColor = parseFloat(item.score) > 4 ? 'var(--color-pnl-positive)' : parseFloat(item.score) > 2 ? 'var(--color-accent)' : 'var(--color-text-muted)';
                
                fullHtml += `
                    <div class="forecast-item">
                        <div class="forecast-item-header">
                            <div class="forecast-item-rank">${rankBadge}</div>
                            <div class="forecast-item-pair">${item.pair}</div>
                            <div class="forecast-item-bias bias-${biasClass}">${item.bias}</div>
                            <div class="forecast-item-score" style="color: ${scoreColor};">${item.score}</div>
                        </div>
                        <div class="forecast-item-details">
                            <div class="forecast-currency-analysis">
                                <strong>${item.pair.substring(0, 3)}:</strong> ${item.baseAnalysis.factors.join(', ')}
                            </div>
                            <div class="forecast-currency-analysis">
                                <strong>${item.pair.substring(3, 6)}:</strong> ${item.quoteAnalysis.factors.join(', ')}
                            </div>
                        </div>
                    </div>
                `;
            });
            fullListContainer.innerHTML = fullHtml;
        }
        
    } catch (error) {
        console.error('❌ Fehler beim Rendern des Weekly Forecast:', error);
        previewContainer.innerHTML = '<div class="error-message">⚠️ Forecast konnte nicht geladen werden. Bitte Zinssätze pflegen.</div>';
    }
}

// ======================================
// SETUP HEATMAP (NEU)
// ======================================

async function renderSetupHeatmap() {
    const container = document.getElementById('setup-heatmap-container');
    if (!container) return;
    
    try {
        // Trades laden
        let trades = typeof loadTrades === 'function' ? loadTrades() : [];
        
        // Filtern nach Konto
        const accountSelector = document.getElementById('account-selector');
        if (accountSelector && accountSelector.value !== 'all') {
            const accountType = accountSelector.value;
            trades = trades.filter(t => t.accountType === accountType);
        }
        
        // Pairs und Setups extrahieren
        const pairs = [...new Set(trades.map(t => t.pair))].filter(p => p).sort();
        const setupKeys = Object.keys(UEBERSICHT_SETUP_DEFINITIONS);
        
        if (pairs.length === 0 || trades.length === 0) {
            container.innerHTML = '<div class="info-banner"><i class="fas fa-info-circle"></i> Noch keine Trades vorhanden. Starte mit deinem ersten Trade!</div>';
            return;
        }
        
        // Heatmap-Daten berechnen
        const heatmapData = {};
        
        pairs.forEach(pair => {
            heatmapData[pair] = {};
            
            setupKeys.forEach(setupKey => {
                const relevantTrades = trades.filter(t => t.pair === pair && t[setupKey] === true);
                const wins = relevantTrades.filter(t => t.result === 'win').length;
                const total = relevantTrades.length;
                const winRate = total > 0 ? (wins / total) * 100 : null;
                
                heatmapData[pair][setupKey] = {
                    winRate,
                    wins,
                    total
                };
            });
        });
        
        // Heatmap HTML rendern
        let html = '<div class="heatmap-wrapper"><table class="heatmap-table"><thead><tr><th>Pair / Setup</th>';
        
        // Setup-Header
        setupKeys.forEach(setupKey => {
            const setupName = UEBERSICHT_SETUP_DEFINITIONS[setupKey];
            html += `<th>${setupName}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        // Rows für jedes Pair
        pairs.forEach(pair => {
            html += `<tr><td class="heatmap-pair-label"><strong>${pair}</strong></td>`;
            
            setupKeys.forEach(setupKey => {
                const data = heatmapData[pair][setupKey];
                
                if (data.total === 0 || data.winRate === null) {
                    // Keine Trades
                    html += `<td class="heatmap-cell heatmap-empty" title="Keine Trades">-</td>`;
                } else {
                    // Farbe basierend auf Winrate
                    const winRate = data.winRate;
                    let colorClass = 'heatmap-neutral';
                    
                    if (winRate >= 70) {
                        colorClass = 'heatmap-excellent';
                    } else if (winRate >= 60) {
                        colorClass = 'heatmap-good';
                    } else if (winRate >= 50) {
                        colorClass = 'heatmap-ok';
                    } else if (winRate >= 40) {
                        colorClass = 'heatmap-poor';
                    } else {
                        colorClass = 'heatmap-bad';
                    }
                    
                    html += `<td class="heatmap-cell ${colorClass}" title="${data.wins}/${data.total} Wins (${winRate.toFixed(0)}% WR)">${winRate.toFixed(0)}%</td>`;
                }
            });
            
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        
        // Legende hinzufügen
        html += `
            <div class="heatmap-legend">
                <div class="legend-title">Legende:</div>
                <div class="legend-items">
                    <div class="legend-item"><span class="legend-color heatmap-excellent"></span> ≥ 70% WR</div>
                    <div class="legend-item"><span class="legend-color heatmap-good"></span> 60-69% WR</div>
                    <div class="legend-item"><span class="legend-color heatmap-ok"></span> 50-59% WR</div>
                    <div class="legend-item"><span class="legend-color heatmap-poor"></span> 40-49% WR</div>
                    <div class="legend-item"><span class="legend-color heatmap-bad"></span> < 40% WR</div>
                    <div class="legend-item"><span class="legend-color heatmap-empty"></span> Keine Trades</div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Fehler beim Rendern der Setup Heatmap:', error);
        container.innerHTML = '<div class="error-message">⚠️ Heatmap konnte nicht geladen werden.</div>';
    }
}

// Expose globally
window.renderWeeklyForecast = renderWeeklyForecast;
window.renderSetupHeatmap = renderSetupHeatmap;