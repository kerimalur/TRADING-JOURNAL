/**
 * ========================================================================
 * Trading Journal - Interest Rates Settings Module
 * ========================================================================
 * 
 * Verwaltung der Zinssätze für die automatisierte Währungsanalyse.
 * Ersetzt hardcodierte Werte durch bearbeitbare Settings.
 */

// ========================================================================
// CURRENCY DEFINITIONS
// ========================================================================

const CURRENCIES_CONFIG = [
    { code: 'USD', name: 'US Dollar', centralBank: 'Federal Reserve (Fed)', flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', centralBank: 'Europäische Zentralbank (EZB)', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', centralBank: 'Bank of England (BoE)', flag: '🇬🇧' },
    { code: 'JPY', name: 'Japanese Yen', centralBank: 'Bank of Japan (BoJ)', flag: '🇯🇵' },
    { code: 'AUD', name: 'Australian Dollar', centralBank: 'Reserve Bank of Australia (RBA)', flag: '🇦🇺' },
    { code: 'CAD', name: 'Canadian Dollar', centralBank: 'Bank of Canada (BoC)', flag: '🇨🇦' },
    { code: 'CHF', name: 'Swiss Franc', centralBank: 'Swiss National Bank (SNB)', flag: '🇨🇭' },
    { code: 'NZD', name: 'New Zealand Dollar', centralBank: 'Reserve Bank of New Zealand (RBNZ)', flag: '🇳🇿' }
];

// ========================================================================
// LOAD & SAVE INTEREST RATES
// ========================================================================

/**
 * Lädt alle gespeicherten Zinssätze aus der Datenbank.
 * @returns {Promise<Object>} - Map {currency: {rate, trend, lastUpdate}}
 */
async function loadInterestRates() {
    try {
        const rates = await dbLoadInterestRates();
        const ratesMap = {};
        
        rates.forEach(r => {
            ratesMap[r.currency] = {
                rate: r.rate,
                trend: r.trend || 'holding',
                lastUpdate: r.updatedAt
            };
        });
        
        return ratesMap;
    } catch (error) {
        console.error('❌ Fehler beim Laden der Zinssätze:', error);
        return {};
    }
}

/**
 * Speichert einen Zinssatz in der Datenbank.
 * @param {string} currency - Währungscode
 * @param {number} rate - Zinssatz
 * @param {string} trend - 'hiking', 'cutting', 'holding'
 */
async function saveInterestRate(currency, rate, trend = 'holding') {
    try {
        await db.interestRates.put({
            currency,
            rate: parseFloat(rate),
            trend,
            updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Zinssatz gespeichert: ${currency} = ${rate}%`);
        return true;
    } catch (error) {
        console.error('❌ Fehler beim Speichern des Zinssatzes:', error);
        return false;
    }
}

// ========================================================================
// DEFAULT RATES (Fallback)
// ========================================================================

const DEFAULT_RATES = {
    USD: { rate: 4.50, trend: 'holding' },
    EUR: { rate: 3.15, trend: 'cutting' },
    GBP: { rate: 4.75, trend: 'holding' },
    JPY: { rate: 0.25, trend: 'hiking' },
    AUD: { rate: 4.35, trend: 'holding' },
    CAD: { rate: 3.25, trend: 'cutting' },
    CHF: { rate: 0.50, trend: 'cutting' },
    NZD: { rate: 4.25, trend: 'cutting' }
};

/**
 * Initialisiert die Datenbank mit Default-Werten (falls leer).
 */
async function initializeDefaultRates() {
    try {
        const existingRates = await dbLoadInterestRates();
        
        if (existingRates.length === 0) {
            console.log('📊 Initialisiere Default-Zinssätze...');
            
            for (const [currency, data] of Object.entries(DEFAULT_RATES)) {
                await saveInterestRate(currency, data.rate, data.trend);
            }
            
            console.log('✅ Default-Zinssätze initialisiert');
        }
    } catch (error) {
        console.error('❌ Fehler beim Initialisieren der Default-Zinssätze:', error);
    }
}

// ========================================================================
// CONFLUENCE SCORE CALCULATION
// ========================================================================

/**
 * Berechnet den Confluence Score für eine Währung.
 * 
 * Formel:
 * Score = (Zinsdifferenz-Score * 2) + (COT-Net-Position * 1.5) + (News-Sentiment * 1)
 * 
 * @param {string} currency - Währungscode
 * @param {Object} rates - Zinssätze-Map
 * @param {Object} cotData - COT-Daten (optional)
 * @returns {Object} - {score, bias, factors}
 */
async function calculateConfluenceScore(currency, rates = null, cotData = null) {
    if (!rates) {
        rates = await loadInterestRates();
    }
    
    const currencyData = rates[currency];
    if (!currencyData) {
        return { score: 0, bias: 'NEUTRAL', factors: ['Keine Daten verfügbar'] };
    }
    
    let score = 0;
    const factors = [];
    
    // ===== 1. ZINSDIFFERENZ-SCORE (Gewichtung: 2x) =====
    const avgRate = Object.values(rates).reduce((sum, d) => sum + (d.rate || 0), 0) / Object.keys(rates).length;
    const rateDiff = currencyData.rate - avgRate;
    
    let rateScore = 0;
    if (rateDiff > 1.5) {
        rateScore = 2;
        factors.push(`Sehr hoher Zins (+${rateDiff.toFixed(2)}%)`);
    } else if (rateDiff > 0.5) {
        rateScore = 1;
        factors.push(`Hoher Zins (+${rateDiff.toFixed(2)}%)`);
    } else if (rateDiff < -1.5) {
        rateScore = -2;
        factors.push(`Sehr niedriger Zins (${rateDiff.toFixed(2)}%)`);
    } else if (rateDiff < -0.5) {
        rateScore = -1;
        factors.push(`Niedriger Zins (${rateDiff.toFixed(2)}%)`);
    }
    
    // Zinstrend berücksichtigen
    if (currencyData.trend === 'hiking') {
        rateScore += 1;
        factors.push('Zinserhöhungszyklus 📈');
    } else if (currencyData.trend === 'cutting') {
        rateScore -= 0.5;
        factors.push('Zinssenkungszyklus 📉');
    }
    
    score += rateScore * 2; // Gewichtung: 2x
    
    // ===== 2. COT-NET-POSITION SCORE (Gewichtung: 1.5x) =====
    let cotScore = 0;
    if (cotData) {
        const cotEntry = cotData[currency];
        if (cotEntry && cotEntry.netPosition !== undefined) {
            const netPos = cotEntry.netPosition;
            
            if (netPos > 75000) {
                cotScore = 2;
                factors.push(`COT: Stark Long (${(netPos / 1000).toFixed(0)}k)`);
            } else if (netPos > 25000) {
                cotScore = 1;
                factors.push(`COT: Long (${(netPos / 1000).toFixed(0)}k)`);
            } else if (netPos < -75000) {
                cotScore = -2;
                factors.push(`COT: Stark Short (${(netPos / 1000).toFixed(0)}k)`);
            } else if (netPos < -25000) {
                cotScore = -1;
                factors.push(`COT: Short (${(netPos / 1000).toFixed(0)}k)`);
            } else {
                factors.push('COT: Neutral');
            }
        }
    }
    
    score += cotScore * 1.5; // Gewichtung: 1.5x
    
    // ===== 3. SPEZIELLE FAKTOREN =====
    
    // Safe Haven Status
    if (currency === 'JPY' || currency === 'CHF') {
        factors.push('Safe Haven Status 🛡️');
    }
    
    // Reserve Currency Premium
    if (currency === 'USD') {
        score += 0.5;
        factors.push('Reservewährung 💵');
    }
    
    // ===== 4. BIAS BESTIMMEN =====
    let bias = 'NEUTRAL';
    if (score >= 4) {
        bias = 'STRONG BUY';
    } else if (score >= 2) {
        bias = 'BUY';
    } else if (score <= -4) {
        bias = 'STRONG SELL';
    } else if (score <= -2) {
        bias = 'SELL';
    }
    
    return {
        score: score.toFixed(2),
        bias,
        rate: currencyData.rate,
        trend: currencyData.trend,
        factors,
        lastUpdate: currencyData.lastUpdate
    };
}

/**
 * Berechnet Confluence Scores für alle Währungspaare.
 * @returns {Promise<Object>} - Map {pair: confluenceScore}
 */
async function calculatePairConfluenceScores() {
    const rates = await loadInterestRates();
    const cotData = await loadCOTDataMap(); // Hilfsfunktion (siehe unten)
    
    const pairs = [
        'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD',
        'EURGBP', 'EURJPY', 'GBPJPY', 'AUDJPY', 'EURAUD', 'GBPAUD'
    ];
    
    const results = {};
    
    for (const pair of pairs) {
        const base = pair.substring(0, 3);
        const quote = pair.substring(3, 6);
        
        const baseAnalysis = await calculateConfluenceScore(base, rates, cotData);
        const quoteAnalysis = await calculateConfluenceScore(quote, rates, cotData);
        
        // Relative Stärke: Base vs Quote
        const relativeScore = parseFloat(baseAnalysis.score) - parseFloat(quoteAnalysis.score);
        
        let pairBias = 'NEUTRAL';
        if (relativeScore >= 4) {
            pairBias = 'STRONG BUY';
        } else if (relativeScore >= 2) {
            pairBias = 'BUY';
        } else if (relativeScore <= -4) {
            pairBias = 'STRONG SELL';
        } else if (relativeScore <= -2) {
            pairBias = 'SELL';
        }
        
        results[pair] = {
            pair,
            score: relativeScore.toFixed(2),
            bias: pairBias,
            baseAnalysis,
            quoteAnalysis
        };
    }
    
    return results;
}

/**
 * Lädt COT-Daten und erstellt Map für schnellen Zugriff.
 */
async function loadCOTDataMap() {
    try {
        const cotData = await dbLoadCotData();
        const map = {};
        
        // Nimm nur neueste Einträge pro Symbol
        const latestEntries = {};
        cotData.forEach(entry => {
            if (!latestEntries[entry.symbol] || entry.date > latestEntries[entry.symbol].date) {
                latestEntries[entry.symbol] = entry;
            }
        });
        
        // Konvertiere zu Map (Symbol -> netPosition)
        Object.entries(latestEntries).forEach(([symbol, entry]) => {
            // Symbol ist z.B. "EUR", wir wollen die Währung extrahieren
            const currency = symbol.substring(0, 3);
            map[currency] = {
                netPosition: entry.commercial_net || 0,
                date: entry.date
            };
        });
        
        return map;
    } catch (error) {
        console.error('❌ Fehler beim Laden der COT-Daten:', error);
        return {};
    }
}

// ========================================================================
// EXPORTS
// ========================================================================

window.InterestRatesModule = {
    loadInterestRates,
    saveInterestRate,
    calculateConfluenceScore,
    calculatePairConfluenceScores,
    initializeDefaultRates,
    CURRENCIES_CONFIG,
    DEFAULT_RATES
};

// Auto-Initialisierung
(async function() {
    await db.open();
    await initializeDefaultRates();
    console.log('✅ Interest Rates Module geladen');
})();
