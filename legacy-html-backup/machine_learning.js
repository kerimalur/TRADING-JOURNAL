// ======================================================================
// MACHINE LEARNING PAGE - JavaScript
// ======================================================================

// Popup helpers
function openPopup(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closePopup(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Expose globally
window.openPopup = openPopup;
window.closePopup = closePopup;
window.scrollToSection = scrollToSection;

// Close popups on overlay click or Escape
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('popup-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.popup-overlay.active').forEach(el => el.classList.remove('active'));
        document.body.style.overflow = '';
    }
});

// ======================================================================
// DATA LOADING & DISPLAY
// ======================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});

/**
 * Lädt alle Daten und zeigt sie an
 */
function loadAllData() {
    // COT Daten
    const cotData = typeof loadCotData === 'function' ? loadCotData() : [];
    displayCotData(cotData);
    
    // News Daten
    const newsData = typeof loadNewsData === 'function' ? loadNewsData() : [];
    displayNewsData(newsData);
    
    // Trades
    const trades = typeof loadTrades === 'function' ? loadTrades() : [];
    displayTradesData(trades);
    
    // Stats aktualisieren
    updateStats(cotData, newsData, trades);
}

/**
 * Aktualisiert die Statistik-Karten
 */
function updateStats(cotData, newsData, trades) {
    const cotCountEl = document.getElementById('ml-cot-count');
    const newsCountEl = document.getElementById('ml-news-count');
    const tradesCountEl = document.getElementById('ml-trades-count');
    
    if (cotCountEl) cotCountEl.textContent = cotData.length;
    if (newsCountEl) newsCountEl.textContent = newsData.length;
    if (tradesCountEl) tradesCountEl.textContent = trades.length;
}

/**
 * Zeigt COT-Daten in der Tabelle
 */
function displayCotData(cotData) {
    const tbody = document.getElementById('ml-cot-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Nach Datum sortieren (neueste zuerst)
    cotData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Letzte Position pro Währung für Trend-Berechnung
    const lastPositions = {};
    
    cotData.slice(0, 50).forEach(entry => {
        const row = tbody.insertRow();
        
        // Datum
        row.insertCell().textContent = entry.date;
        
        // Währung
        row.insertCell().textContent = entry.symbol;
        
        // Commercial Net Position
        const netCell = row.insertCell();
        const netValue = entry.commercial_net_position;
        netCell.textContent = netValue.toLocaleString('de-DE');
        netCell.style.color = netValue > 0 ? 'var(--color-pnl-positive)' : 'var(--color-pnl-negative)';
        netCell.style.fontWeight = '600';
        
        // Trend (basierend auf vorherigem Wert)
        const trendCell = row.insertCell();
        const prevPosition = lastPositions[entry.symbol];
        if (prevPosition !== undefined) {
            const change = netValue - prevPosition;
            if (change > 0) {
                trendCell.innerHTML = '<i class="fas fa-arrow-up" style="color: var(--color-pnl-positive);"></i> Steigend';
            } else if (change < 0) {
                trendCell.innerHTML = '<i class="fas fa-arrow-down" style="color: var(--color-pnl-negative);"></i> Fallend';
            } else {
                trendCell.innerHTML = '<i class="fas fa-minus" style="color: var(--color-text-muted);"></i> Unverändert';
            }
        } else {
            trendCell.innerHTML = '<span style="color: var(--color-text-muted);">--</span>';
        }
        lastPositions[entry.symbol] = netValue;
        
        // Quelle
        const sourceCell = row.insertCell();
        const source = entry.source || 'Manuell';
        const isAuto = source.includes('AUTO');
        sourceCell.innerHTML = `<span class="badge ${isAuto ? 'badge-success' : 'badge-default'}">${isAuto ? '🤖 API' : '✏️ Manuell'}</span>`;
    });
    
    if (cotData.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: var(--space-md);">Keine COT-Daten vorhanden. Klicke auf "Daten aktualisieren" um Daten von der API zu laden.</p>';
    }
}

/**
 * Zeigt News-Daten in der Tabelle
 */
function displayNewsData(newsData) {
    const tbody = document.getElementById('ml-news-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Nach Datum sortieren (neueste zuerst)
    newsData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    newsData.slice(0, 50).forEach(entry => {
        const row = tbody.insertRow();
        
        // Datum
        row.insertCell().textContent = entry.date;
        
        // Währung
        row.insertCell().textContent = entry.currency;
        
        // Event/Report
        const eventCell = row.insertCell();
        eventCell.textContent = entry.report || entry.title || 'N/A';
        eventCell.style.maxWidth = '200px';
        eventCell.style.overflow = 'hidden';
        eventCell.style.textOverflow = 'ellipsis';
        eventCell.style.whiteSpace = 'nowrap';
        
        // Sentiment
        const sentimentCell = row.insertCell();
        const sentiment = entry.sentiment || 'Neutral';
        const sentimentClass = {
            'Stark Long': 'badge-success',
            'Long': 'badge-success',
            'Neutral': 'badge-default',
            'Short': 'badge-danger',
            'Stark Short': 'badge-danger'
        }[sentiment] || 'badge-default';
        sentimentCell.innerHTML = `<span class="badge ${sentimentClass}">${sentiment}</span>`;
        
        // Impact
        const impactCell = row.insertCell();
        const impact = entry.impact || 'Medium';
        const impactIcon = impact.toLowerCase() === 'high' ? '🔴' : (impact.toLowerCase() === 'medium' ? '🟡' : '🟢');
        impactCell.innerHTML = `${impactIcon} ${impact}`;
    });
    
    if (newsData.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: var(--space-md);">Keine News-Daten vorhanden. Daten werden automatisch von der API geladen.</p>';
    }
}

/**
 * Zeigt Trade-Daten in der Tabelle
 */
function displayTradesData(trades) {
    const tbody = document.getElementById('ml-trades-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Nach Datum sortieren (neueste zuerst)
    trades.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    trades.slice(0, 50).forEach(trade => {
        const row = tbody.insertRow();
        
        // Datum
        row.insertCell().textContent = trade.date;
        
        // Paar
        row.insertCell().textContent = trade.pair;
        
        // Richtung
        const dirCell = row.insertCell();
        const dir = trade.direction || trade.type || 'N/A';
        dirCell.innerHTML = dir.toLowerCase() === 'long' 
            ? '<span style="color: var(--color-pnl-positive);"><i class="fas fa-arrow-up"></i> Long</span>'
            : '<span style="color: var(--color-pnl-negative);"><i class="fas fa-arrow-down"></i> Short</span>';
        
        // R-Multiple
        const rCell = row.insertCell();
        const rValue = parseFloat(trade.rMultiple) || 0;
        rCell.textContent = rValue.toFixed(2) + 'R';
        rCell.style.color = rValue >= 0 ? 'var(--color-pnl-positive)' : 'var(--color-pnl-negative)';
        rCell.style.fontWeight = '600';
        
        // Ergebnis
        const resultCell = row.insertCell();
        resultCell.innerHTML = rValue >= 0 
            ? '<span class="badge badge-success">Win</span>'
            : '<span class="badge badge-danger">Loss</span>';
    });
    
    if (trades.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: var(--space-md);">Keine Trades vorhanden. Trades werden als Labels für supervised Learning verwendet.</p>';
    }
}

// ======================================================================
// EXPORT FUNCTIONS
// ======================================================================

/**
 * Aktualisiert alle Daten von der API
 */
async function refreshAllData() {
    const statusEl = document.createElement('div');
    statusEl.className = 'info-banner';
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lade Daten von API...';
    statusEl.style.position = 'fixed';
    statusEl.style.top = '20px';
    statusEl.style.right = '20px';
    statusEl.style.zIndex = '9999';
    document.body.appendChild(statusEl);
    
    try {
        if (typeof ApiDataService !== 'undefined') {
            await Promise.all([
                ApiDataService.updateCotData(true),
                ApiDataService.updateNewsData(true)
            ]);
            
            loadAllData();
            
            statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Daten erfolgreich aktualisiert!';
            statusEl.classList.add('success');
        }
    } catch (error) {
        statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Fehler beim Laden: ' + error.message;
        statusEl.classList.add('warning');
    }
    
    setTimeout(() => statusEl.remove(), 3000);
}

/**
 * Lädt das ML-Dataset als JSON herunter
 */
function downloadMLDataset() {
    if (typeof ApiDataService !== 'undefined' && typeof ApiDataService.exportForMachineLearning === 'function') {
        const mlData = ApiDataService.exportForMachineLearning();
        downloadJSON(mlData, 'trading_ml_data');
    } else {
        // Fallback
        const cotData = typeof loadCotData === 'function' ? loadCotData() : [];
        const newsData = typeof loadNewsData === 'function' ? loadNewsData() : [];
        const trades = typeof loadTrades === 'function' ? loadTrades() : [];
        
        const exportData = {
            metadata: {
                exported_at: new Date().toISOString(),
                total_cot_entries: cotData.length,
                total_news_entries: newsData.length,
                total_trades: trades.length
            },
            cot_data: cotData,
            news_data: newsData,
            trades: trades
        };
        
        downloadJSON(exportData, 'trading_ml_data');
    }
}

/**
 * Hilfsfunktion zum JSON-Download
 */
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Exportiert Daten als CSV
 */
function downloadCSV() {
    const cotData = typeof loadCotData === 'function' ? loadCotData() : [];
    const newsData = typeof loadNewsData === 'function' ? loadNewsData() : [];
    const trades = typeof loadTrades === 'function' ? loadTrades() : [];
    
    // COT CSV
    let cotCSV = 'date,symbol,commercial_net_position,source\n';
    cotData.forEach(entry => {
        cotCSV += `${entry.date},${entry.symbol},${entry.commercial_net_position},${entry.source || 'manual'}\n`;
    });
    downloadFile(cotCSV, 'cot_data.csv', 'text/csv');
    
    // News CSV (verzögert)
    setTimeout(() => {
        let newsCSV = 'date,currency,sentiment,report,impact\n';
        newsData.forEach(entry => {
            const report = (entry.report || '').replace(/,/g, ';').replace(/\n/g, ' ');
            newsCSV += `${entry.date},${entry.currency},${entry.sentiment || 'Neutral'},${report},${entry.impact || 'Medium'}\n`;
        });
        downloadFile(newsCSV, 'news_data.csv', 'text/csv');
    }, 500);
    
    // Trades CSV (verzögert)
    setTimeout(() => {
        let tradesCSV = 'date,pair,direction,rMultiple,result\n';
        trades.forEach(trade => {
            const rVal = parseFloat(trade.rMultiple) || 0;
            tradesCSV += `${trade.date},${trade.pair},${trade.direction || trade.type},${rVal},${rVal >= 0 ? 'win' : 'loss'}\n`;
        });
        downloadFile(tradesCSV, 'trades_data.csv', 'text/csv');
    }, 1000);
}

/**
 * Hilfsfunktion zum Datei-Download
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

// Expose functions globally
window.refreshAllData = refreshAllData;
window.downloadMLDataset = downloadMLDataset;
window.downloadCSV = downloadCSV;
