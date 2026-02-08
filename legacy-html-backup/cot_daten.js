// cot_daten.js - COT Daten Management (Überarbeitet)
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

// Close popups
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
// GLOBALE VARIABLEN
// ======================================================================
let currencyChart = null;
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

// ======================================================================
// INITIALISIERUNG
// ======================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Formular-Handler
    const cotForm = document.getElementById('cot-form');
    if (cotForm) {
        cotForm.addEventListener('submit', handleCotFormSubmit);
    }
    
    // JSON Import
    const jsonImportButton = document.getElementById('json-import-button');
    const jsonImportFile = document.getElementById('json-import-file');
    if (jsonImportButton && jsonImportFile) {
        jsonImportButton.addEventListener('click', () => {
            parseAndSaveJsonFile(jsonImportFile.files[0]);
            closePopup('cot-import-popup');
        });
    }
    
    // Filter-Handler
    const currencyFilter = document.getElementById('currency-filter');
    const timeFilter = document.getElementById('time-filter');
    
    if (currencyFilter) {
        currencyFilter.addEventListener('change', refreshDisplay);
    }
    if (timeFilter) {
        timeFilter.addEventListener('change', refreshDisplay);
    }
    
    // Initiales Laden
    refreshDisplay();
    updateApiStatusUI();
    
    // Auto-Load von API
    if (typeof ApiDataService !== 'undefined') {
        ApiDataService.updateCotData();
    }
});

// ======================================================================
// FORMULAR HANDLER
// ======================================================================
function handleCotFormSubmit(e) {
    e.preventDefault();
    
    const netPosition = parseInt(document.getElementById('net_position').value);
    const newEntry = {
        id: Date.now(),
        date: document.getElementById('cot_date').value,
        symbol: document.getElementById('cot_symbol').value,
        commercial_net_position: netPosition,
        source: 'Manuell'
    };
    
    if (!newEntry.symbol || isNaN(netPosition) || !newEntry.date) {
        alert('Bitte alle Felder ausfüllen.');
        return;
    }
    
    if (typeof addCotData === 'function') {
        addCotData(newEntry);
        e.target.reset();
        closePopup('cot-entry-popup');
        refreshDisplay();
        showToast('COT Eintrag gespeichert', 'success');
    }
}

function parseAndSaveJsonFile(file) {
    if (!file) {
        alert('Keine Datei ausgewählt.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const entries = JSON.parse(event.target.result);
            if (!Array.isArray(entries)) throw new Error('Ungültiges Format');
            
            const existingEntries = loadCotData();
            const existingKeys = new Set(existingEntries.map(e => `${e.date}_${e.symbol}`));
            
            let importedCount = 0;
            entries.forEach(entry => {
                if (entry.date && entry.symbol && typeof entry.commercial_net_position !== 'undefined') {
                    const key = `${entry.date}_${entry.symbol}`;
                    if (!existingKeys.has(key)) {
                        entry.id = Date.now() + Math.random();
                        entry.source = 'JSON Import';
                        addCotData(entry);
                        importedCount++;
                    }
                }
            });
            
            refreshDisplay();
            showToast(`${importedCount} Einträge importiert`, 'success');
        } catch (e) {
            alert('Fehler beim Importieren: ' + e.message);
        }
    };
    reader.readAsText(file);
}

// ======================================================================
// DISPLAY FUNKTIONEN
// ======================================================================
function refreshDisplay() {
    const currencyFilter = document.getElementById('currency-filter')?.value || 'all';
    const timeFilter = document.getElementById('time-filter')?.value || '4w';
    
    let cotData = typeof loadCotData === 'function' ? loadCotData() : [];
    
    // Zeitfilter anwenden
    const now = new Date();
    let startDate = null;
    
    switch (timeFilter) {
        case '4w': startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); break;
        case '3m': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        case '6m': startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); break;
        case '1y': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
    }
    
    if (startDate) {
        cotData = cotData.filter(e => new Date(e.date) >= startDate);
    }
    
    // Währungsfilter
    if (currencyFilter !== 'all') {
        cotData = cotData.filter(e => e.symbol === currencyFilter);
    }
    
    // Sortieren
    cotData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Displays aktualisieren
    renderHeatmap(cotData, currencyFilter);
    renderGroupedHistory(cotData);
    
    // Chart anzeigen bei Einzelwährung
    const chartSection = document.getElementById('currency-chart-section');
    if (currencyFilter !== 'all' && chartSection) {
        chartSection.style.display = 'block';
        document.getElementById('chart-currency-title').textContent = `${currencyFilter} Entwicklung`;
        renderCurrencyChart(cotData, currencyFilter);
    } else if (chartSection) {
        chartSection.style.display = 'none';
    }
    
    // History Count
    const historyCount = document.getElementById('history-count');
    if (historyCount) {
        historyCount.textContent = `${cotData.length} Einträge`;
    }
}

// ======================================================================
// HEATMAP
// ======================================================================
function renderHeatmap(cotData, currencyFilter) {
    const container = document.getElementById('cot-heatmap');
    if (!container) return;
    
    // Neueste Daten pro Währung
    const latestBySymbol = {};
    cotData.forEach(entry => {
        if (!latestBySymbol[entry.symbol] || new Date(entry.date) > new Date(latestBySymbol[entry.symbol].date)) {
            latestBySymbol[entry.symbol] = entry;
        }
    });
    
    // Datum Badge
    const latestDate = Object.values(latestBySymbol)[0]?.date || '--';
    const dateBadge = document.getElementById('heatmap-date');
    if (dateBadge) dateBadge.textContent = latestDate;
    
    // Currencies für Anzeige
    const displayCurrencies = currencyFilter !== 'all' ? [currencyFilter] : CURRENCIES;
    
    let html = '';
    displayCurrencies.forEach(symbol => {
        const entry = latestBySymbol[symbol];
        const netPosition = entry?.commercial_net_position || 0;
        const heatClass = getHeatClass(netPosition);
        const direction = getDirection(netPosition);
        
        html += `
            <div class="heatmap-card ${heatClass}" onclick="filterByCurrency('${symbol}')">
                <div class="heatmap-symbol">${symbol}</div>
                <div class="heatmap-value">${netPosition.toLocaleString('de-DE')}</div>
                <div class="heatmap-direction ${direction.class}">${direction.label}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getHeatClass(value) {
    if (value > 100000) return 'heat-strong-long';
    if (value > 50000) return 'heat-long';
    if (value > 0) return 'heat-slight-long';
    if (value < -100000) return 'heat-strong-short';
    if (value < -50000) return 'heat-short';
    if (value < 0) return 'heat-slight-short';
    return 'heat-neutral';
}

function getDirection(value) {
    if (value > 100000) return { label: 'STARK LONG', class: 'long' };
    if (value > 50000) return { label: 'LONG', class: 'long' };
    if (value > 0) return { label: 'LEICHT LONG', class: 'long' };
    if (value < -100000) return { label: 'STARK SHORT', class: 'short' };
    if (value < -50000) return { label: 'SHORT', class: 'short' };
    if (value < 0) return { label: 'LEICHT SHORT', class: 'short' };
    return { label: 'NEUTRAL', class: 'neutral' };
}

// ======================================================================
// GRUPPIERTE HISTORIE
// ======================================================================
function renderGroupedHistory(cotData) {
    const container = document.getElementById('cot-history-grouped');
    if (!container) return;
    
    // Nach Datum gruppieren
    const byDate = {};
    cotData.forEach(entry => {
        if (!byDate[entry.date]) byDate[entry.date] = [];
        byDate[entry.date].push(entry);
    });
    
    // Sortieren nach Datum (neueste zuerst)
    const sortedDates = Object.keys(byDate).sort((a, b) => new Date(b) - new Date(a));
    
    if (sortedDates.length === 0) {
        container.innerHTML = '<p style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">Keine COT-Daten vorhanden.</p>';
        return;
    }
    
    let html = '';
    sortedDates.forEach(date => {
        const entries = byDate[date];
        const formattedDate = new Date(date).toLocaleDateString('de-DE', { 
            weekday: 'short', 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        });
        
        // Mini-Badges für jede Währung
        const badges = entries.map(e => {
            const dir = getDirection(e.commercial_net_position);
            return `<span class="mini-badge ${dir.class}">${e.symbol}</span>`;
        }).join('');
        
        html += `
            <div class="history-date-row" onclick="showDateDetail('${date}')">
                <div class="history-date-info">
                    <span class="history-date">${formattedDate}</span>
                    <span class="history-count">${entries.length} Währung${entries.length > 1 ? 'en' : ''}</span>
                </div>
                <div class="history-badges">${badges}</div>
                <i class="fas fa-chevron-right"></i>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ======================================================================
// DATUM DETAIL POPUP
// ======================================================================
function showDateDetail(date) {
    const cotData = typeof loadCotData === 'function' ? loadCotData() : [];
    const entries = cotData.filter(e => e.date === date);
    
    const formattedDate = new Date(date).toLocaleDateString('de-DE', { 
        weekday: 'long', 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    });
    
    document.getElementById('date-detail-title').textContent = formattedDate;
    
    const content = document.getElementById('date-detail-content');
    let html = '';
    
    entries.forEach(entry => {
        const dir = getDirection(entry.commercial_net_position);
        const heatClass = getHeatClass(entry.commercial_net_position);
        
        html += `
            <div class="date-detail-card ${heatClass}">
                <div class="date-detail-header">
                    <span class="date-detail-symbol">${entry.symbol}</span>
                    <span class="date-detail-direction ${dir.class}">${dir.label}</span>
                </div>
                <div class="date-detail-value">${entry.commercial_net_position.toLocaleString('de-DE')}</div>
                <div class="date-detail-source">${entry.source || 'Manuell'}</div>
                <button class="delete-btn" onclick="deleteCotEntryAndRefresh(${entry.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    content.innerHTML = html;
    openPopup('date-detail-popup');
}

function deleteCotEntryAndRefresh(id) {
    if (confirm('Diesen Eintrag wirklich löschen?')) {
        if (typeof deleteCotEntry === 'function') {
            deleteCotEntry(id);
            closePopup('date-detail-popup');
            refreshDisplay();
            showToast('Eintrag gelöscht', 'success');
        }
    }
}

// ======================================================================
// WÄHRUNGS-CHART
// ======================================================================
function renderCurrencyChart(cotData, currency) {
    const canvas = document.getElementById('currency-chart');
    if (!canvas) return;
    
    // Filtern und sortieren
    const filtered = cotData
        .filter(e => e.symbol === currency)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = filtered.map(e => e.date);
    const data = filtered.map(e => e.commercial_net_position);
    
    // Alte Chart zerstören
    if (currencyChart) {
        currencyChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    currencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${currency} Commercial Net`,
                data: data,
                borderColor: 'rgba(212, 168, 83, 1)',
                backgroundColor: 'rgba(212, 168, 83, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointHoverRadius: 6
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
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    callbacks: {
                        label: (ctx) => `Net: ${ctx.parsed.y.toLocaleString('de-DE')}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', maxTicksLimit: 8 }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: 'rgba(255, 255, 255, 0.5)',
                        callback: (v) => (v / 1000) + 'K'
                    }
                }
            }
        }
    });
}

// ======================================================================
// HELPER FUNKTIONEN
// ======================================================================
function filterByCurrency(currency) {
    const filter = document.getElementById('currency-filter');
    if (filter) {
        filter.value = currency;
        refreshDisplay();
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ======================================================================
// API FUNKTIONEN
// ======================================================================
function updateApiStatusUI() {
    if (typeof ApiDataService === 'undefined') return;
    
    const status = ApiDataService.getUpdateStatus();
    
    const cotLastEl = document.getElementById('cot-last-update');
    const cotNextEl = document.getElementById('cot-next-update');
    
    if (cotLastEl) cotLastEl.textContent = `Letztes Update: ${status.cot.lastUpdate}`;
    if (cotNextEl) cotNextEl.textContent = `Nächstes: ${status.cot.nextUpdate}`;
}

async function forceApiUpdate() {
    showToast('Lade Daten von API...', 'info');
    
    try {
        if (typeof ApiDataService !== 'undefined') {
            await ApiDataService.updateCotData(true);
            refreshDisplay();
            updateApiStatusUI();
            showToast('Daten aktualisiert!', 'success');
        }
    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

// Expose globally
window.forceApiUpdate = forceApiUpdate;
window.filterByCurrency = filterByCurrency;
window.showDateDetail = showDateDetail;
window.deleteCotEntryAndRefresh = deleteCotEntryAndRefresh;
