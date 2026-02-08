// ======================================
// TRADING JOURNAL - JOURNAL.JS (KOMPLETT ÜBERARBEITET)
// Mit Pop-up System und Karten-Ansicht
// ======================================

// Verwende PAIR_LIST und SETUP_DEFINITIONS aus config.js (falls geladen)
const JOURNAL_PAIR_LIST = typeof PAIR_LIST !== 'undefined' ? PAIR_LIST : [
    "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF",
    "EURAUD", "EURCAD", "EURCHF", "EURGBP", "EURJPY", "EURNZD",
    "GBPAUD", "GBPCAD", "GBPCHF", "GBPJPY", "GBPNZD",
    "AUDCAD", "AUDCHF", "AUDJPY", "AUDNZD",
    "CADCHF", "CADJPY",
    "CHFJPY",
    "NZDCAD", "NZDCHF", "NZDJPY"
];

const JOURNAL_SETUP_DEFINITIONS = typeof SETUP_DEFINITIONS !== 'undefined' ? SETUP_DEFINITIONS : {
    'setup_daily_bos': { label: 'Daily BOS', short: 'BOS', css: 'bos-active' },
    'setup_value_area': { label: 'Value Area', short: 'VA', css: 'va-active' },
    'setup_market_structure': { label: 'Market Structure', short: 'MS', css: 'ms-active' },
    'setup_weekly_gva': { label: 'Weekly GVA', short: 'W-GVA', css: 'gva-weekly-active' },
    'setup_3day_gva': { label: '3Day GVA', short: '3D-GVA', css: 'gva-3day-active' }
};

// Globale Filter-Zustandsvariable
let currentFilters = {
    result: 'all',
    pair: 'all',
    setup_daily_bos: false,
    setup_value_area: false,
    setup_market_structure: false,
    setup_weekly_gva: false,
    setup_3day_gva: false
};

// Globale Variable für Bearbeitungsmodus
let currentEditId = null;
let currentViewMode = 'cards'; // 'cards' oder 'table'
let currentDetailTradeId = null;

// ======================================
// INITIALISIERUNG
// ======================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof ACCOUNT_TYPE === 'undefined') {
        console.error("ACCOUNT_TYPE ist nicht in der HTML-Datei definiert!");
        return;
    }

    // Sicherstellen, dass die Bilanzen aktuell sind
    if (typeof recalculateAllBalances === 'function') {
        recalculateAllBalances();
    }

    populatePairSelect();
    renderAccountBalance();
    setupFormSubmission();
    renderTrades(ACCOUNT_TYPE);
    setupFilterControls();
    populatePairFilter(ACCOUNT_TYPE);
    setupPopups();
    setupViewToggle();
    setupTransactionPopup();
    renderTransactionHistory();

    // Auto-Datum
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    updateHeaderStyle();

    // Trade-Highlighting von Equity-Kurve
    const highlightId = sessionStorage.getItem('highlightTradeId');
    if (highlightId) {
        sessionStorage.removeItem('highlightTradeId');
        setTimeout(() => showTradeDetailPopup(parseInt(highlightId)), 500);
    }
});

// ======================================
// POPUP SYSTEM
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

// Global function for onclick handlers
window.closePopup = closePopup;

function setupPopups() {
    // Schließen bei Klick außerhalb
    document.querySelectorAll('.popup-overlay').forEach(popup => {
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // ESC zum Schließen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.popup-overlay.active').forEach(popup => {
                popup.classList.remove('active');
            });
            document.body.style.overflow = '';
        }
    });

    // Neuer Trade Button
    const addTradeBtn = document.getElementById('add-trade-btn');
    if (addTradeBtn) {
        addTradeBtn.addEventListener('click', () => {
            currentEditId = null;
            document.getElementById('form-popup-title').textContent = 'Neuer Trade';
            document.getElementById('trade-form').reset();
            const dateInput = document.getElementById('date');
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            showScreenshotPreview(null);
            openPopup('trade-form-popup');
        });
    }

    // Detail Popup Buttons
    const detailEditBtn = document.getElementById('detail-edit-btn');
    if (detailEditBtn) {
        detailEditBtn.addEventListener('click', () => {
            if (currentDetailTradeId) {
                closePopup('trade-detail-popup');
                editTrade(currentDetailTradeId);
            }
        });
    }

    const detailDeleteBtn = document.getElementById('detail-delete-btn');
    if (detailDeleteBtn) {
        detailDeleteBtn.addEventListener('click', () => {
            if (currentDetailTradeId) {
                handleDelete(currentDetailTradeId);
            }
        });
    }
}

// ======================================
// TOAST NOTIFICATIONS
// ======================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `
        <i class="fas ${icon} toast-icon"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ======================================
// VIEW TOGGLE (Cards / Table)
// ======================================
function setupViewToggle() {
    const toggleBtns = document.querySelectorAll('.view-toggle-btn');
    const cardsSection = document.getElementById('trades-cards-section');
    const tableSection = document.getElementById('trades-table-section');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentViewMode = btn.dataset.view;

            if (currentViewMode === 'cards') {
                if (cardsSection) cardsSection.style.display = 'block';
                if (tableSection) tableSection.style.display = 'none';
            } else {
                if (cardsSection) cardsSection.style.display = 'none';
                if (tableSection) tableSection.style.display = 'block';
            }

            renderTrades(ACCOUNT_TYPE);
        });
    });
}

// ======================================
// HILFSFUNKTIONEN
// ======================================
function populatePairSelect() {
    const selectEl = document.getElementById('pair');
    if (!selectEl) return;

    const pairList = typeof PAIR_LIST !== 'undefined' ? PAIR_LIST : JOURNAL_PAIR_LIST;
    [...pairList].sort().forEach(pair => {
        const option = document.createElement('option');
        option.value = pair;
        option.textContent = pair;
        selectEl.appendChild(option);
    });
}

function renderAccountBalance() {
    if (typeof loadAccountConfigs !== 'function') {
        const balanceEl = document.getElementById('current-balance');
        if (balanceEl) balanceEl.textContent = 'Fehler: data_manager.js nicht geladen.';
        return;
    }
    const configs = loadAccountConfigs();
    const config = configs[ACCOUNT_TYPE];
    if (config) {
        const balanceEl = document.getElementById('current-balance');
        if (balanceEl) balanceEl.textContent = `${config.currentBalance.toFixed(2).replace('.', ',')} ${config.currency}`;
        
        const quickBalanceEl = document.getElementById('quick-balance');
        if (quickBalanceEl) {
            quickBalanceEl.textContent = `${config.currentBalance.toFixed(0)} ${config.currency}`;
        }
    }

    updateQuickStats();
    updateHeaderStyle();

    if (ACCOUNT_TYPE === 'funded') {
        renderAccountGoals();
    }
}

function updateQuickStats() {
    const trades = loadTrades().filter(t => t.type === ACCOUNT_TYPE);
    
    const quickTradesEl = document.getElementById('quick-trades');
    const quickWinrateEl = document.getElementById('quick-winrate');
    const quickTotalREl = document.getElementById('quick-total-r');
    
    if (!quickTradesEl) return;
    
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === 'win').length;
    const winrate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(0) : 0;
    const totalR = trades.reduce((sum, t) => sum + (parseFloat(t.rMultiple) || 0), 0);
    
    quickTradesEl.textContent = totalTrades;
    quickWinrateEl.textContent = winrate + '%';
    quickWinrateEl.className = 'value ' + (winrate >= 50 ? 'positive' : 'negative');
    quickTotalREl.textContent = (totalR >= 0 ? '+' : '') + totalR.toFixed(1) + ' R';
    quickTotalREl.className = 'value ' + (totalR >= 0 ? 'positive' : 'negative');
}

// ======================================
// BILD-KOMPRIMIERUNG & VORSCHAU
// ======================================
function showScreenshotPreview(fileOrBase64) {
    const preview = document.getElementById('screenshot-preview');
    if (!preview) return;

    if (!fileOrBase64) {
        preview.style.display = 'none';
        preview.src = '';
        return;
    }

    if (typeof fileOrBase64 === 'string') {
        preview.src = fileOrBase64;
        preview.style.display = 'block';
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(fileOrBase64);
    }
}

function compressAndEncodeImage(file, quality = 0.7, maxWidth = 1920) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// ======================================
// TRADE SPEICHERN & BEARBEITEN
// ======================================
function setupFormSubmission() {
    const form = document.getElementById('trade-form');
    if (!form) return;

    const fileInput = document.getElementById('screenshot');
    const saveButton = form.querySelector('button[type="submit"]') || 
                       document.querySelector('button[form="trade-form"][type="submit"]');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                showScreenshotPreview(e.target.files[0]);
            } else {
                showScreenshotPreview(null);
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const file = formData.get('screenshot');
        let screenshotBase64 = null;

        if (file && file.size > 0) {
            if (file.size > 10 * 1024 * 1024) {
                showToast('Fehler: Das Bild ist zu groß (Max 10MB).', 'error');
                return;
            }

            if (saveButton) {
                saveButton.disabled = true;
                saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Speichern...';
            }

            try {
                screenshotBase64 = await compressAndEncodeImage(file, 0.7, 1920);
            } catch (error) {
                console.error("Fehler beim Komprimieren des Bildes:", error);
                showToast('Fehler beim Lesen der Bilddatei.', 'error');
                if (saveButton) {
                    saveButton.disabled = false;
                    saveButton.innerHTML = '<i class="fas fa-save"></i> Speichern';
                }
                return;
            }
        }

        const fullPairName = formData.get('pair').toUpperCase().trim();
        if (!fullPairName) {
            showToast('Bitte ein Währungspaar auswählen.', 'error');
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = '<i class="fas fa-save"></i> Speichern';
            }
            return;
        }

        const tagsInput = formData.get('tags').trim();
        const parsedTags = tagsInput ? tagsInput.split(/[,;]/).map(tag => tag.trim()).filter(tag => tag.length > 0) : [];

        let rMultiple = parseFloat(formData.get('r-multiple')) || 0;
        const result = formData.get('result');

        if (result === 'loss') {
            rMultiple = -Math.abs(rMultiple);
        } else if (result === 'win') {
            rMultiple = Math.abs(rMultiple);
        } else if (result === 'breakeven') {
            rMultiple = 0;
        }

        const tradeData = {
            id: currentEditId || Date.now(),
            type: ACCOUNT_TYPE,
            pair: fullPairName,
            date: formData.get('date'),
            result: result,
            rMultiple: rMultiple,
            riskPercent: parseFloat(formData.get('risk-percent')) || 0,
            notes: formData.get('notes').trim(),
            tags: parsedTags,
            screenshot: screenshotBase64,
            setup_daily_bos: formData.get('setup_daily_bos') === 'on',
            setup_value_area: formData.get('setup_value_area') === 'on',
            setup_market_structure: formData.get('setup_market_structure') === 'on',
            setup_weekly_gva: formData.get('setup_weekly_gva') === 'on',
            setup_3day_gva: formData.get('setup_3day_gva') === 'on'
        };

        if (currentEditId) {
            if (typeof updateTrade !== 'function') {
                showToast('Fehler: updateTrade Funktion nicht verfügbar.', 'error');
                return;
            }

            if (!screenshotBase64) {
                const preview = document.getElementById('screenshot-preview');
                const oldScreenshot = preview ? preview.src : null;
                if (oldScreenshot && oldScreenshot.startsWith('data:image')) {
                    tradeData.screenshot = oldScreenshot;
                } else {
                    tradeData.screenshot = null;
                }
            }

            updateTrade(tradeData);
            showToast('Trade erfolgreich aktualisiert!', 'success');
            currentEditId = null;

        } else {
            if (typeof saveTrade === 'function') {
                saveTrade(tradeData);
                showToast('Trade erfolgreich journalisiert!', 'success');
            } else {
                showToast('Fehler: saveTrade Funktion nicht verfügbar.', 'error');
                return;
            }
        }

        form.reset();
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        showScreenshotPreview(null);
        closePopup('trade-form-popup');
        renderTrades(ACCOUNT_TYPE);
        populatePairFilter(ACCOUNT_TYPE);
        renderAccountBalance();

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save"></i> Speichern';
        }
    });
}

// ======================================
// TRADE RENDERING (Cards + Table)
// ======================================
function renderTrades(accountType) {
    if (typeof loadTrades !== 'function') return;

    const allTrades = loadTrades();
    const trades = allTrades.filter(t => t.type === accountType);

    const filteredTrades = trades.filter(trade => {
        if (currentFilters.result !== 'all' && trade.result !== currentFilters.result) return false;
        if (currentFilters.pair !== 'all' && trade.pair !== currentFilters.pair) return false;
        if (currentFilters.setup_daily_bos && !trade.setup_daily_bos) return false;
        if (currentFilters.setup_value_area && !trade.setup_value_area) return false;
        if (currentFilters.setup_market_structure && !trade.setup_market_structure) return false;
        if (currentFilters.setup_weekly_gva && !trade.setup_weekly_gva) return false;
        if (currentFilters.setup_3day_gva && !trade.setup_3day_gva) return false;
        return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (currentViewMode === 'cards') {
        renderTradeCards(filteredTrades);
    } else {
        renderTradeTable(filteredTrades);
    }
}

function renderTradeCards(trades) {
    const container = document.getElementById('trade-cards-container');
    if (!container) return;

    if (trades.length === 0) {
        container.innerHTML = `
            <div class="no-trades-message" style="grid-column: 1 / -1;">
                <i class="fas fa-inbox"></i>
                <h3>Keine Trades gefunden</h3>
                <p>Journalisiere deinen ersten Trade oder ändere die Filter.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = trades.map(trade => {
        const rClass = trade.rMultiple > 0 ? 'positive' : trade.rMultiple < 0 ? 'negative' : 'neutral';
        
        let setupsHtml = '';
        Object.keys(SETUP_DEFINITIONS).forEach(key => {
            if (trade[key] === true) {
                const setup = SETUP_DEFINITIONS[key];
                setupsHtml += `<span class="setup-mini active">${setup.short}</span>`;
            }
        });

        const hasNotes = trade.notes && trade.notes.length > 0;
        const hasScreenshot = trade.screenshot && trade.screenshot.length > 0;

        return `
            <div class="trade-card ${trade.result}" onclick="showTradeDetailPopup(${trade.id})">
                <div class="trade-card-actions">
                    <button class="btn-icon btn-edit" onclick="event.stopPropagation(); editTrade(${trade.id})" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="event.stopPropagation(); handleDelete(${trade.id})" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="trade-card-header">
                    <span class="trade-card-pair">${trade.pair}</span>
                    <span class="trade-card-date">${trade.date}</span>
                </div>
                <div class="trade-card-body">
                    <div class="trade-card-stats">
                        <span class="trade-card-r ${rClass}">${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple} R</span>
                        <span class="trade-card-result ${trade.result}">${trade.result.toUpperCase()}</span>
                    </div>
                    ${setupsHtml ? `<div class="trade-card-setups">${setupsHtml}</div>` : ''}
                    ${(hasNotes || hasScreenshot) ? `
                        <div class="trade-card-preview">
                            ${hasNotes ? '<i class="fas fa-sticky-note"></i> Notizen' : ''}
                            ${hasScreenshot ? '<i class="fas fa-image"></i> Screenshot' : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderTradeTable(trades) {
    const tableBody = document.getElementById('trade-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (trades.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-text-subtle);">Keine Trades gefunden.</td></tr>`;
        return;
    }

    trades.forEach(trade => {
        const row = tableBody.insertRow();
        row.setAttribute('data-trade-id', trade.id);
        row.style.cursor = 'pointer';
        row.onclick = () => showTradeDetailPopup(trade.id);

        row.insertCell().textContent = trade.date;
        row.insertCell().textContent = trade.pair;

        const rCell = row.insertCell();
        rCell.textContent = `${trade.rMultiple} R`;
        rCell.className = trade.rMultiple > 0 ? 'pnl-positive' : trade.rMultiple < 0 ? 'pnl-negative' : '';

        const resultCell = row.insertCell();
        resultCell.textContent = trade.result.toUpperCase();
        if (trade.result === 'win') resultCell.className = 'pnl-positive';
        else if (trade.result === 'loss') resultCell.className = 'pnl-negative';

        row.insertCell().textContent = trade.riskPercent > 0 ? `${trade.riskPercent.toFixed(2)}%` : '-';

        const setupCell = row.insertCell();
        let setupBadgesHtml = '';
        Object.keys(SETUP_DEFINITIONS).forEach(key => {
            if (trade[key] === true) {
                const setup = SETUP_DEFINITIONS[key];
                setupBadgesHtml += `<span class="tag-badge ${setup.css}">${setup.short}</span>`;
            }
        });
        setupCell.innerHTML = setupBadgesHtml || '-';

        const tagsCell = row.insertCell();
        let tagBadgesHtml = '';
        if (Array.isArray(trade.tags)) {
            trade.tags.forEach(tag => {
                tagBadgesHtml += `<span class="tag-badge">${tag}</span>`;
            });
        }
        tagsCell.innerHTML = tagBadgesHtml || '-';

        const actionCell = row.insertCell();
        actionCell.innerHTML = `
            <div class="action-buttons" onclick="event.stopPropagation()">
                <button class="btn-icon btn-view" onclick="showTradeDetailPopup(${trade.id})" title="Details"><i class="fas fa-eye"></i></button>
                <button class="btn-icon btn-edit" onclick="editTrade(${trade.id})" title="Bearbeiten"><i class="fas fa-edit"></i></button>
                <button class="btn-icon btn-delete" onclick="handleDelete(${trade.id})" title="Löschen"><i class="fas fa-trash"></i></button>
            </div>
        `;
    });
}

// ======================================
// TRADE DETAIL POPUP
// ======================================
function showTradeDetailPopup(tradeId) {
    if (typeof loadTrades !== 'function') return;

    const trade = loadTrades().find(t => t.id === tradeId);
    if (!trade) {
        showToast('Trade nicht gefunden.', 'error');
        return;
    }

    currentDetailTradeId = tradeId;

    const configs = loadAccountConfigs();
    const accountConfig = configs[trade.type];

    let pnlAmount = 0;
    let currency = 'USD';
    if (accountConfig && typeof calculateTradePnL === 'function') {
        pnlAmount = calculateTradePnL(trade, accountConfig);
        currency = accountConfig.currency;
    }

    const rClass = trade.rMultiple > 0 ? 'positive' : trade.rMultiple < 0 ? 'negative' : 'neutral';

    // Setups sammeln
    let setupsHtml = '';
    Object.keys(SETUP_DEFINITIONS).forEach(key => {
        if (trade[key] === true) {
            const setup = SETUP_DEFINITIONS[key];
            setupsHtml += `<span class="tag-badge ${setup.css}">${setup.label}</span>`;
        }
    });

    // Tags
    let tagsHtml = '';
    if (Array.isArray(trade.tags) && trade.tags.length > 0) {
        tagsHtml = trade.tags.map(tag => `<span class="tag-badge">${tag}</span>`).join('');
    }

    const content = document.getElementById('trade-detail-content');
    content.innerHTML = `
        <div class="popup-trade-header">
            <div>
                <div class="popup-trade-pair">${trade.pair}</div>
                <div style="color: var(--color-text-muted); font-size: 0.85rem;">${trade.date}</div>
            </div>
            <div class="popup-trade-result ${rClass}">
                ${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple} R
            </div>
        </div>

        <div class="popup-info-grid">
            <div class="popup-info-item">
                <div class="label">Ergebnis</div>
                <div class="value" style="color: var(--color-pnl-${trade.result === 'win' ? 'positive' : trade.result === 'loss' ? 'negative' : 'neutral'});">
                    ${trade.result.toUpperCase()}
                </div>
            </div>
            <div class="popup-info-item">
                <div class="label">PnL</div>
                <div class="value" style="color: var(--color-pnl-${pnlAmount >= 0 ? 'positive' : 'negative'});">
                    ${pnlAmount >= 0 ? '+' : ''}${pnlAmount.toFixed(2)} ${currency}
                </div>
            </div>
            <div class="popup-info-item">
                <div class="label">Risiko</div>
                <div class="value">${trade.riskPercent > 0 ? trade.riskPercent.toFixed(2) + '%' : 'Standard'}</div>
            </div>
            <div class="popup-info-item">
                <div class="label">R-Multiple</div>
                <div class="value">${trade.rMultiple}</div>
            </div>
        </div>

        ${(setupsHtml || tagsHtml) ? `
            <div class="popup-section">
                <div class="popup-section-title"><i class="fas fa-tags"></i> Setups & Tags</div>
                <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
                    ${setupsHtml}
                    ${tagsHtml}
                </div>
            </div>
        ` : ''}

        ${trade.notes ? `
            <div class="popup-section">
                <div class="popup-section-title"><i class="fas fa-sticky-note"></i> Notizen & Learnings</div>
                <div class="popup-notes">${trade.notes}</div>
            </div>
        ` : ''}

        ${trade.screenshot ? `
            <div class="popup-section">
                <div class="popup-section-title"><i class="fas fa-image"></i> Screenshot</div>
                <a href="${trade.screenshot}" target="_blank">
                    <img src="${trade.screenshot}" class="popup-screenshot" alt="Trade Screenshot">
                </a>
            </div>
        ` : ''}
    `;

    openPopup('trade-detail-popup');
}

// Global function
window.showTradeDetailPopup = showTradeDetailPopup;

// ======================================
// FILTER CONTROLS
// ======================================
function setupFilterControls() {
    const resultFilter = document.getElementById('filter-result');
    const pairFilter = document.getElementById('filter-pair');
    const resetBtn = document.getElementById('reset-filters');
    const filterChips = document.querySelectorAll('.filter-chip');

    const applyFilters = () => {
        if (resultFilter) currentFilters.result = resultFilter.value;
        if (pairFilter) currentFilters.pair = pairFilter.value;
        renderTrades(ACCOUNT_TYPE);
    };

    if (resultFilter) resultFilter.addEventListener('change', applyFilters);
    if (pairFilter) pairFilter.addEventListener('change', applyFilters);

    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const filterKey = chip.dataset.filter;
            currentFilters[filterKey] = !currentFilters[filterKey];
            chip.classList.toggle('active', currentFilters[filterKey]);
            renderTrades(ACCOUNT_TYPE);
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (resultFilter) resultFilter.value = 'all';
            if (pairFilter) pairFilter.value = 'all';
            filterChips.forEach(chip => {
                chip.classList.remove('active');
                const filterKey = chip.dataset.filter;
                currentFilters[filterKey] = false;
            });
            currentFilters.result = 'all';
            currentFilters.pair = 'all';
            renderTrades(ACCOUNT_TYPE);
        });
    }
}

function populatePairFilter(accountType) {
    if (typeof loadTrades !== 'function') return;

    const trades = loadTrades().filter(t => t.type === accountType);
    const selectEl = document.getElementById('filter-pair');
    if (!selectEl) return;

    const pairs = [...new Set(trades.map(t => t.pair))].sort();
    const currentValue = selectEl.value;

    selectEl.innerHTML = '<option value="all">Alle Paare</option>';

    pairs.forEach(pair => {
        const option = document.createElement('option');
        option.value = pair;
        option.textContent = pair;
        selectEl.appendChild(option);
    });

    if (pairs.includes(currentValue)) {
        selectEl.value = currentValue;
    }
}

// ======================================
// EDIT & DELETE
// ======================================
function editTrade(tradeId) {
    if (typeof loadTrades !== 'function') return;

    const trade = loadTrades().find(t => t.id === tradeId);
    if (!trade) {
        showToast('Trade nicht gefunden.', 'error');
        return;
    }

    const form = document.getElementById('trade-form');
    currentEditId = trade.id;

    document.getElementById('form-popup-title').textContent = 'Trade bearbeiten';

    form.elements['pair'].value = trade.pair;
    form.elements['date'].value = trade.date;
    form.elements['result'].value = trade.result;
    form.elements['r-multiple'].value = Math.abs(trade.rMultiple);
    form.elements['risk-percent'].value = trade.riskPercent > 0 ? trade.riskPercent : '';
    form.elements['tags'].value = Array.isArray(trade.tags) ? trade.tags.join(', ') : '';
    form.elements['notes'].value = trade.notes || '';

    form.elements['setup_daily_bos'].checked = trade.setup_daily_bos;
    form.elements['setup_value_area'].checked = trade.setup_value_area;
    form.elements['setup_market_structure'].checked = trade.setup_market_structure;
    form.elements['setup_weekly_gva'].checked = trade.setup_weekly_gva;
    form.elements['setup_3day_gva'].checked = trade.setup_3day_gva;

    showScreenshotPreview(trade.screenshot);
    form.elements['screenshot'].value = null;

    openPopup('trade-form-popup');
}

window.editTrade = editTrade;

function handleDelete(tradeId) {
    if (confirm("Trade wirklich löschen?")) {
        if (typeof deleteTrade === 'function') {
            deleteTrade(tradeId);
            closePopup('trade-detail-popup');
            showToast('Trade gelöscht.', 'success');
            renderTrades(ACCOUNT_TYPE);
            renderAccountBalance();
            populatePairFilter(ACCOUNT_TYPE);
        } else {
            showToast('Fehler: Löschfunktion nicht verfügbar.', 'error');
        }
    }
}

window.handleDelete = handleDelete;

// ======================================
// TRANSAKTIONS-LOGIK
// ======================================
function setupTransactionPopup() {
    const openBtn = document.getElementById('add-transaction-btn');
    const form = document.getElementById('transaction-form');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            if (form) form.reset();
            const dateInput = document.getElementById('txn-date');
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            openPopup('transaction-popup');
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const type = formData.get('txn-type');
            let amount = parseFloat(formData.get('txn-amount'));

            if (isNaN(amount) || amount <= 0) {
                showToast('Bitte einen gültigen Betrag eingeben.', 'error');
                return;
            }

            if (type === 'withdrawal') {
                amount = -Math.abs(amount);
            }

            const transactionData = {
                id: Date.now(),
                type: ACCOUNT_TYPE,
                date: formData.get('txn-date'),
                amount: amount,
                note: formData.get('txn-note')
            };

            if (typeof addTransaction === 'function') {
                addTransaction(transactionData);
                closePopup('transaction-popup');
                showToast('Transaktion gespeichert.', 'success');
                renderAccountBalance();
                renderTransactionHistory();
            } else {
                showToast('Fehler: Transaktions-Funktion nicht verfügbar.', 'error');
            }
        });
    }
}

function renderTransactionHistory() {
    const historyList = document.getElementById('transaction-history');
    if (!historyList || typeof loadTransactions !== 'function') return;

    const transactions = loadTransactions()
        .filter(t => t.type === ACCOUNT_TYPE)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    historyList.innerHTML = '';

    if (transactions.length === 0) {
        historyList.innerHTML = `<li style="color: var(--color-text-subtle);">Keine Transaktionen gefunden.</li>`;
        return;
    }

    transactions.forEach(txn => {
        const li = document.createElement('li');
        const isPositive = txn.amount >= 0;

        li.innerHTML = `
            <span class="date">${txn.date}</span>
            <span class="note">${txn.note || (isPositive ? 'Einzahlung' : 'Auszahlung')}</span>
            <span class="amount ${isPositive ? 'positive' : 'negative'}">
                ${isPositive ? '+' : ''}${txn.amount.toFixed(2).replace('.', ',')}
            </span>
        `;
        historyList.appendChild(li);
    });
}

// ======================================
// HEADER STYLE & GOALS
// ======================================
function updateHeaderStyle() {
    const header = document.getElementById('header');
    if (!header || typeof loadTrades !== 'function' || typeof calculateTotalR !== 'function') return;

    const allTrades = loadTrades().filter(t => t.type === ACCOUNT_TYPE);
    const totalR = calculateTotalR(allTrades);

    header.classList.remove('pnl-positive', 'pnl-negative');
    if (totalR > 0) header.classList.add('pnl-positive');
    else if (totalR < 0) header.classList.add('pnl-negative');
}

function renderAccountGoals() {
    const container = document.getElementById('account-goals-container');
    if (!container || typeof loadAccountConfigs !== 'function') return;

    const config = loadAccountConfigs()[ACCOUNT_TYPE];
    if (!config || !config.enableGoals) {
        container.innerHTML = '';
        return;
    }

    const { initialStartBalance, currentBalance, profitTarget, maxDrawdown, currency } = config;

    // Profit-Ziel
    const profitMade = currentBalance - initialStartBalance;
    const profitNeeded = profitTarget - initialStartBalance;
    let profitPercent = profitNeeded > 0 ? (profitMade / profitNeeded) * 100 : (profitMade >= 0 ? 100 : 0);
    if (profitPercent < 0) profitPercent = 0;
    const profitClass = profitPercent >= 100 ? 'pnl-positive' : 'pnl-neutral';

    // Drawdown
    const drawdownBuffer = currentBalance - maxDrawdown;
    const totalBuffer = initialStartBalance - maxDrawdown;
    let drawdownPercent = totalBuffer > 0 ? (drawdownBuffer / totalBuffer) * 100 : 0;
    if (drawdownPercent < 0) drawdownPercent = 0;
    if (drawdownPercent > 100) drawdownPercent = 100;
    const drawdownClass = (drawdownBuffer <= 0 || drawdownPercent < 25) ? 'pnl-negative' : 'pnl-positive';

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
            <div class="goal-card ${profitClass}">
                <div class="goal-card-header">
                    <span class="label"><i class="fas fa-bullseye"></i> Profit-Ziel</span>
                    <span class="value">${profitMade.toFixed(0)} / ${profitNeeded.toFixed(0)} ${currency}</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-bar-inner" style="width: ${Math.min(profitPercent, 100)}%;"></div>
                </div>
            </div>
            <div class="goal-card ${drawdownClass}">
                <div class="goal-card-header">
                    <span class="label"><i class="fas fa-shield-alt"></i> DD-Puffer</span>
                    <span class="value">${drawdownBuffer.toFixed(0)} ${currency}</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-bar-inner" style="width: ${drawdownPercent}%;"></div>
                </div>
            </div>
        </div>
    `;
}

// ======================================
// TRADE-ZEILE MARKIEREN (für Equity Kurve)
// ======================================
function highlightTradeRow(tradeId) {
    if (!tradeId) return;
    showTradeDetailPopup(tradeId);
}
