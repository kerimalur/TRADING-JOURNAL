// ======================================
// SCRIPT FÜR waehrungsanalyse.html
// ======================================

// Globale Liste der Währungen
const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'];

// Popup helpers plus optional scroll for the confluence table
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

// Expose functions globally for onclick handlers in HTML
window.openPopup = openPopup;
window.closePopup = closePopup;
window.scrollToSection = scrollToSection;

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

// Hilfsfunktion zur Ermittlung der COT Klasse (Kopie aus cot_daten.html)
function getCotClass(position) {
    if (position > 75000) return 'cot-very-long';
    if (position > 25000) return 'cot-long';
    if (position < -75000) return 'cot-very-short';
    if (position < -25000) return 'cot-short';
    return 'cot-neutral';
}

// Hilfsfunktion zur Umwandlung der COT-Klasse in einen lesbaren Text
function getCotDirectionText(position) {
    if (position > 75000) return 'Stark Long';
    if (position > 25000) return 'Long';
    if (position < -75000) return 'Stark Short';
    if (position < -25000) return 'Short';
    return 'Neutral';
}

// ======================================================================
// AUTOMATISCHE NEWS-ANALYSE - ZINS- & FUNDAMENTALDATEN
// ======================================================================

// Aktuelle Leitzinsen (Stand: Januar 2025 - müssen regelmäßig aktualisiert werden)
const CENTRAL_BANK_RATES = {
    USD: { rate: 4.50, name: 'Federal Reserve (Fed)', trend: 'cutting', lastChange: '2024-12' },
    EUR: { rate: 3.15, name: 'Europäische Zentralbank (EZB)', trend: 'cutting', lastChange: '2024-12' },
    GBP: { rate: 4.75, name: 'Bank of England (BoE)', trend: 'cutting', lastChange: '2024-11' },
    JPY: { rate: 0.25, name: 'Bank of Japan (BoJ)', trend: 'hiking', lastChange: '2024-07' },
    AUD: { rate: 4.35, name: 'Reserve Bank of Australia (RBA)', trend: 'holding', lastChange: '2023-11' },
    CAD: { rate: 3.25, name: 'Bank of Canada (BoC)', trend: 'cutting', lastChange: '2024-12' },
    CHF: { rate: 0.50, name: 'Swiss National Bank (SNB)', trend: 'cutting', lastChange: '2024-12' },
    NZD: { rate: 4.25, name: 'Reserve Bank of New Zealand (RBNZ)', trend: 'cutting', lastChange: '2024-11' }
};

// Fundamentale Bewertungsfaktoren (vereinfacht)
function calculateAutoBias(currency) {
    const data = CENTRAL_BANK_RATES[currency];
    if (!data) return { bias: 'Neutral', score: 0, reason: 'Keine Daten' };
    
    let score = 0;
    let reasons = [];
    
    // 1. Absoluter Zinssatz (höher = attraktiver für Carry Trades)
    const avgRate = Object.values(CENTRAL_BANK_RATES).reduce((sum, d) => sum + d.rate, 0) / 8;
    if (data.rate > avgRate + 1) {
        score += 2;
        reasons.push(`Hoher Zins (${data.rate}%)`);
    } else if (data.rate > avgRate) {
        score += 1;
        reasons.push(`Über-Durchschnitt Zins`);
    } else if (data.rate < avgRate - 1) {
        score -= 2;
        reasons.push(`Niedriger Zins (${data.rate}%)`);
    } else if (data.rate < avgRate) {
        score -= 1;
        reasons.push(`Unter-Durchschnitt Zins`);
    }
    
    // 2. Zinstrend (hawkish vs dovish)
    if (data.trend === 'hiking') {
        score += 2;
        reasons.push('Zinserhöhungszyklus');
    } else if (data.trend === 'cutting') {
        score -= 1;
        reasons.push('Zinssenkungszyklus');
    } else if (data.trend === 'holding') {
        // Neutral, kein Score-Änderung
        reasons.push('Zinsen stabil');
    }
    
    // 3. Spezielle Faktoren
    if (currency === 'JPY') {
        // JPY ist traditionell Safe Haven
        reasons.push('Safe Haven Status');
    }
    if (currency === 'CHF') {
        reasons.push('Safe Haven Status');
    }
    if (currency === 'USD') {
        score += 0.5; // Reserve Currency Premium
        reasons.push('Reservewährung');
    }
    
    // Bias bestimmen
    let bias = 'Neutral';
    if (score >= 2.5) bias = 'Stark Long';
    else if (score >= 1) bias = 'Long';
    else if (score <= -2.5) bias = 'Stark Short';
    else if (score <= -1) bias = 'Short';
    
    return {
        bias: bias,
        score: score,
        rate: data.rate,
        trend: data.trend,
        centralBank: data.name,
        lastChange: data.lastChange,
        reasons: reasons
    };
}

function renderAutoAnalysisGrid() {
    const container = document.getElementById('auto-analysis-grid');
    if (!container) return;
    
    let html = '';
    CURRENCIES.forEach(currency => {
        const analysis = calculateAutoBias(currency);
        const biasClass = `bias-${analysis.bias.replace(' ', '-').toLowerCase()}`;
        const trendIcon = analysis.trend === 'hiking' ? 'arrow-up' : 
                         analysis.trend === 'cutting' ? 'arrow-down' : 'minus';
        const trendColor = analysis.trend === 'hiking' ? 'var(--color-pnl-positive)' : 
                          analysis.trend === 'cutting' ? 'var(--color-pnl-negative)' : 'var(--color-text-muted)';
        
        html += `
            <div class="auto-analysis-card">
                <div class="auto-analysis-header">
                    <span class="auto-analysis-currency">${currency}</span>
                    <span class="bias-direction ${biasClass}">${analysis.bias}</span>
                </div>
                <div class="auto-analysis-rate">
                    <i class="fas fa-${trendIcon}" style="color: ${trendColor}"></i>
                    ${analysis.rate}%
                </div>
                <div class="auto-analysis-info">
                    <small>${analysis.centralBank}</small>
                    <small style="color: var(--color-text-muted);">Letzte Änderung: ${analysis.lastChange}</small>
                </div>
                <div class="auto-analysis-reasons">
                    ${analysis.reasons.map(r => `<span class="reason-tag">${r}</span>`).join('')}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ======================================================================
// 1. BIAS FORMULAR ERSTELLEN UND SPEICHERN
// ======================================================================

function setupBiasForm() {
    const tbody = document.getElementById('bias-input-tbody');
    if (!tbody) return;
    tbody.innerHTML = ''; // Leeren

    CURRENCIES.forEach(currency => {
        const row = tbody.insertRow();
        
        row.insertCell().innerHTML = `<strong>${currency}</strong>`;
        
        const selectCell = row.insertCell();
        selectCell.innerHTML = `
            <select name="bias_${currency}" required>
                <option value="Neutral">Neutral</option>
                <option value="Long">Long</option>
                <option value="Short">Short</option>
                <option value="Stark Long">Stark Long</option>
                <option value="Stark Short">Stark Short</option>
            </select>
        `;
    });
}

document.getElementById('bias-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const form = e.target;
    const date = form.elements['bias_date'].value;
    
    if (!date) {
        alert("Bitte geben Sie ein Datum ein.");
        return;
    }

    CURRENCIES.forEach(currency => {
        const bias = form.elements[`bias_${currency}`].value;
        
        const newBiasEntry = {
            id: Date.now() + Math.random(), // Eindeutige ID
            date: date,
            currency: currency,
            bias: bias
        };
        
        if (typeof addBiasData === 'function') {
            addBiasData(newBiasEntry);
        } else {
            alert('Fehler: data_manager.js nicht gefunden.');
        }
    });
    
    alert(`Trading Bias für den ${date} erfolgreich gespeichert.`);
    renderDashboards();
});

// ======================================================================
// 2. BIAS & COT CONFLUENCE DASHBOARD RENDERN
// ======================================================================

// NEU: Logik zur Ermittlung des neuesten News-Bias pro Währung (F15)
function getLatestNewsBias() {
    if (typeof loadNewsData !== 'function') return {};
    const allNews = loadNewsData();
    const latestNewsBias = {};

    // Sortiere nach Datum, um sicherzustellen, dass die neueste News dominiert
    allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

    allNews.forEach(news => {
        // Nur die neueste News (basierend auf der sortierten Liste) für jede Währung speichern
        if (!latestNewsBias[news.currency]) {
            latestNewsBias[news.currency] = news;
        }
    });

    return latestNewsBias;
}


function renderConfluenceTable(latestBias, latestCotData) {
    const tbodyMain = document.getElementById('confluence-tbody');
    if (tbodyMain) tbodyMain.innerHTML = '';
    
    // NEU: News-Bias Daten laden
    const latestNewsBias = getLatestNewsBias(); 

    CURRENCIES.forEach(async (currency) => {
        const rowMain = tbodyMain ? tbodyMain.insertRow() : null;
        
        // Daten abrufen
        const biasEntry = latestBias.find(e => e.currency === currency) || { bias: 'Neutral', date: 'N/A' };
        const newsEntry = latestNewsBias[currency];
        
        // Confluence Score berechnen (mit neuer Logik)
        const confluenceAnalysis = await window.InterestRatesModule.calculateConfluenceScore(currency);
        
        // News Bias Daten formatieren
        const newsDirection = newsEntry ? newsEntry.sentiment : 'Neutral';
        const newsDate = newsEntry ? newsEntry.date : 'N/A';
        const newsReport = newsEntry ? newsEntry.report : 'Keine News';
        const newsClass = `bias-${newsDirection.replace(' ', '-').toLowerCase()}`;
        const newsText = newsEntry ? `${newsDirection}` : 'N/A';
        
        // System-Bias formatieren
        const systemClass = `bias-${confluenceAnalysis.bias.replace(' ', '-').toLowerCase()}`;

        if (rowMain) {
            rowMain.insertCell().innerHTML = `<strong>${currency}</strong>`;
            const biasCell = rowMain.insertCell();
            biasCell.innerHTML = `<span class="bias-direction bias-${biasEntry.bias.replace(' ', '-').toLowerCase()}">${biasEntry.bias}</span>`;
            const newsBiasCell = rowMain.insertCell();
            newsBiasCell.innerHTML = `<span class="bias-direction ${newsClass}" title="Zuletzt: ${newsReport} (${newsDate})">${newsText}</span>`;
            const systemCell = rowMain.insertCell();
            systemCell.innerHTML = `<span class="bias-direction ${systemClass}" title="${confluenceAnalysis.factors.join(' | ')}">${confluenceAnalysis.bias}</span>`;
            const scoreCell = rowMain.insertCell();
            scoreCell.innerHTML = `<span style="font-weight: bold; color: var(--color-accent);">${confluenceAnalysis.score}</span>`;
        }
    });
}

// ======================================================================
// 3. BIAS HISTORIE RENDERN
// ======================================================================

function renderBiasHistory(biasEntries) {
    const tbody = document.getElementById('bias-table-body');
    tbody.innerHTML = '';

    // Sortieren nach Datum (neueste zuerst)
    biasEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    biasEntries.forEach(entry => {
        const row = tbody.insertRow();
        row.insertCell().textContent = entry.date;
        row.insertCell().textContent = entry.currency;

        const biasCell = row.insertCell();
        biasCell.innerHTML = `<span class="bias-direction bias-${entry.bias.replace(' ', '-').toLowerCase()}">${entry.bias}</span>`;
        
        // Löschen Button
        const actionCell = row.insertCell();
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Löschen';
        deleteButton.classList.add('delete-button');
        deleteButton.onclick = () => handleDeleteBias(entry.id);
        actionCell.appendChild(deleteButton);
    });
}

function handleDeleteBias(id) {
    if (confirm("Sind Sie sicher, dass Sie diesen Bias-Eintrag löschen möchten?")) {
        if (typeof deleteBiasEntry === 'function') {
            deleteBiasEntry(id);
            renderDashboards();
        } else {
            alert('Fehler: Löschfunktion nicht verfügbar.');
        }
    }
}

// ======================================================================
// 4. HAUPTFUNKTION (Laden und Rendern)
// ======================================================================

function renderDashboards() {
    if (typeof loadBiasData !== 'function' || typeof loadCotData !== 'function') {
        console.error('data_manager.js Funktionen fehlen.');
        return;
    }

    // 1. Bias-Daten laden
    const allBiasEntries = loadBiasData();
    renderBiasHistory(allBiasEntries);

    // Extrahieren des letzten Bias für jede Währung
    const latestBias = {};
    allBiasEntries.sort((a, b) => b.id - a.id);
    CURRENCIES.forEach(currency => {
        const entry = allBiasEntries.find(e => e.currency === currency);
        if (entry) {
            latestBias[currency] = entry;
        }
    });
    const latestBiasArray = Object.values(latestBias);

    // 2. COT-Daten laden und den neuesten Eintrag pro Währung finden
    const allCotEntries = loadCotData();
    const latestCotData = {};
    allCotEntries.sort((a, b) => b.id - a.id);
    allCotEntries.forEach(entry => {
        if (!latestCotData[entry.symbol]) {
            latestCotData[entry.symbol] = entry;
        }
    });

    // 3. Confluence-Tabelle rendern
    renderConfluenceTable(latestBiasArray, latestCotData);
}


// ======================================================================
// 5. NEWS-BIAS FORMULAR (NEU)
// ======================================================================

function setupNewsForm() {
    const newsForm = document.getElementById('news-form');
    if (!newsForm) return;
    
    newsForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const form = e.target;
        const date = form.elements['news_date'].value;
        const currency = form.elements['news_currency'].value;
        const sentiment = form.elements['news_sentiment'].value;
        const report = form.elements['news_report'].value || 'Keine Beschreibung';
        
        if (!date || !currency || !sentiment) {
            alert("Bitte alle Pflichtfelder ausfüllen.");
            return;
        }
        
        const newsEntry = {
            id: Date.now() + Math.random(),
            date: date,
            currency: currency,
            sentiment: sentiment,
            report: report
        };
        
        if (typeof saveNewsData === 'function') {
            saveNewsData(newsEntry);
            alert(`News-Bias für ${currency} am ${date} gespeichert.`);
            form.reset();
            closePopup('news-popup');
            renderDashboards();
        } else {
            alert('Fehler: data_manager.js nicht gefunden.');
        }
    });
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    setupBiasForm();
    setupNewsForm();
    setupInterestRatesForm();
    renderDashboards();
    renderAutoAnalysisGrid();
});

// ======================================================================
// 6. ZINSSÄTZE VERWALTEN (NEU)
// ======================================================================

async function setupInterestRatesForm() {
    const tbody = document.getElementById('interest-rates-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const rates = await window.InterestRatesModule.loadInterestRates();
    
    window.InterestRatesModule.CURRENCIES_CONFIG.forEach(currency => {
        const currentRate = rates[currency.code] || { rate: 0, trend: 'holding' };
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${currency.flag} <strong>${currency.code}</strong></td>
            <td><small style="color: var(--color-text-muted);">${currency.centralBank}</small></td>
            <td>
                <input type="number" step="0.01" min="0" max="20" 
                       value="${currentRate.rate}" 
                       id="rate-${currency.code}" 
                       style="width: 100px; padding: 6px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-light);">
            </td>
            <td>
                <select id="trend-${currency.code}" style="padding: 6px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-light);">
                    <option value="holding" ${currentRate.trend === 'holding' ? 'selected' : ''}>Holding</option>
                    <option value="hiking" ${currentRate.trend === 'hiking' ? 'selected' : ''}>Hiking 📈</option>
                    <option value="cutting" ${currentRate.trend === 'cutting' ? 'selected' : ''}>Cutting 📉</option>
                </select>
            </td>
            <td>
                <button type="button" class="button primary-button" onclick="saveSingleRate('${currency.code}')" style="font-size: 0.8rem; padding: 6px 12px;">
                    <i class="fas fa-save"></i>
                </button>
            </td>
        `;
    });
}

async function saveSingleRate(currency) {
    const rateInput = document.getElementById(`rate-${currency}`);
    const trendSelect = document.getElementById(`trend-${currency}`);
    
    if (!rateInput || !trendSelect) return;
    
    const rate = parseFloat(rateInput.value);
    const trend = trendSelect.value;
    
    const success = await window.InterestRatesModule.saveInterestRate(currency, rate, trend);
    
    if (success) {
        showToast(`✅ ${currency} Zinssatz gespeichert: ${rate}%`, 'success');
        renderDashboards(); // Tabelle neu laden
    } else {
        showToast(`❌ Fehler beim Speichern`, 'error');
    }
}

async function saveAllInterestRates() {
    let savedCount = 0;
    
    for (const currency of window.InterestRatesModule.CURRENCIES_CONFIG) {
        const rateInput = document.getElementById(`rate-${currency.code}`);
        const trendSelect = document.getElementById(`trend-${currency.code}`);
        
        if (rateInput && trendSelect) {
            const rate = parseFloat(rateInput.value);
            const trend = trendSelect.value;
            
            const success = await window.InterestRatesModule.saveInterestRate(currency.code, rate, trend);
            if (success) savedCount++;
        }
    }
    
    showToast(`✅ ${savedCount} Zinssätze gespeichert`, 'success');
    renderDashboards();
}

// Expose globally
window.saveSingleRate = saveSingleRate;
window.saveAllInterestRates = saveAllInterestRates;