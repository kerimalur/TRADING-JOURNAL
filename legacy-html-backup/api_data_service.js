// ======================================================================
// API DATA SERVICE - Automatisches Laden von COT & News Daten
// ======================================================================
// Dieses Modul holt automatisch:
// 1. COT-Daten von der CFTC (via CORS-Proxy)
// 2. Wirtschaftsnews/Kalender-Daten von öffentlichen APIs
// ======================================================================

const ApiDataService = (function() {
    'use strict';

    // =====================================================================
    // KONFIGURATION
    // =====================================================================
    const CONFIG = {
        // CORS Proxy für CFTC-Daten (da CFTC kein CORS unterstützt)
        CORS_PROXY: 'https://corsproxy.io/?',
        CORS_PROXY_FALLBACK: 'https://api.allorigins.win/raw?url=', // Backup Proxy
        
        // CFTC COT Report URL (Disaggregated Futures)
        CFTC_URL: 'https://www.cftc.gov/dea/futures/financial_lf.htm',
        
        // Alternative: Quandl/Nasdaq Data Link (benötigt API Key für mehr Anfragen)
        // Kostenlos: 50 API calls/day
        NASDAQ_DATA_LINK_URL: 'https://data.nasdaq.com/api/v3/datasets/CFTC/',
        NASDAQ_API_KEY: '', // Optional: Eigenen Key hier eintragen für mehr Requests
        
        // Forex Factory Calendar (via Proxy)
        FOREX_FACTORY_URL: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
        
        // Update Intervalle (in Millisekunden)
        COT_UPDATE_INTERVAL: 6 * 60 * 60 * 1000, // 6 Stunden
        NEWS_UPDATE_INTERVAL: 30 * 60 * 1000,    // 30 Minuten
        
        // Retry-Konfiguration
        MAX_RETRIES: 3,
        RETRY_DELAY: 2000, // 2 Sekunden
        RETRY_BACKOFF: 1.5, // Exponentieller Backoff-Faktor
        REQUEST_TIMEOUT: 30000 // 30 Sekunden Timeout
        
        // Währungs-Codes für COT
        COT_CURRENCY_CODES: {
            'EUR': { quandl: '099741', name: 'EURO FX' },
            'GBP': { quandl: '096742', name: 'BRITISH POUND' },
            'JPY': { quandl: '097741', name: 'JAPANESE YEN' },
            'CHF': { quandl: '092741', name: 'SWISS FRANC' },
            'CAD': { quandl: '090741', name: 'CANADIAN DOLLAR' },
            'AUD': { quandl: '232741', name: 'AUSTRALIAN DOLLAR' },
            'NZD': { quandl: '112741', name: 'NEW ZEALAND DOLLAR' },
            'USD': { quandl: '098662', name: 'USD INDEX' }
        },
        
        // News-relevante Währungen
        NEWS_CURRENCIES: {
            'USD': ['United States', 'US', 'Fed', 'Federal Reserve', 'FOMC'],
            'EUR': ['Euro', 'European', 'ECB', 'Eurozone', 'Germany', 'France'],
            'GBP': ['United Kingdom', 'UK', 'British', 'BOE', 'Bank of England'],
            'JPY': ['Japan', 'Japanese', 'BOJ', 'Bank of Japan'],
            'AUD': ['Australia', 'Australian', 'RBA'],
            'CAD': ['Canada', 'Canadian', 'BOC', 'Bank of Canada'],
            'CHF': ['Switzerland', 'Swiss', 'SNB'],
            'NZD': ['New Zealand', 'RBNZ']
        }
    };

    // =====================================================================
    // STORAGE KEYS
    // =====================================================================
    const STORAGE_KEYS = {
        LAST_COT_UPDATE: 'apiService_lastCotUpdate',
        LAST_NEWS_UPDATE: 'apiService_lastNewsUpdate',
        CACHED_COT_DATA: 'apiService_cachedCotData',
        CACHED_NEWS_DATA: 'apiService_cachedNewsData',
        ERROR_LOG: 'apiService_errorLog'
    };

    // =====================================================================
    // ERROR HANDLING & RETRY UTILITIES
    // =====================================================================
    
    /**
     * Fetch mit Timeout
     */
    async function fetchWithTimeout(url, options = {}, timeout = CONFIG.REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    
    /**
     * Retry-Logik mit exponentieller Backoff
     */
    async function retryWithBackoff(fn, maxRetries = CONFIG.MAX_RETRIES, context = '') {
        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = CONFIG.RETRY_DELAY * Math.pow(CONFIG.RETRY_BACKOFF, attempt - 1);
                    console.log(`⏳ Retry ${attempt}/${maxRetries} for ${context} in ${delay}ms...`);
                    await sleep(delay);
                }
                
                const result = await fn();
                
                if (attempt > 0) {
                    console.log(`✅ ${context} succeeded after ${attempt} retries`);
                }
                
                return result;
            } catch (error) {
                lastError = error;
                console.warn(`❌ ${context} attempt ${attempt + 1} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    logError(context, error);
                    break;
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Sleep Utility
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Loggt API-Fehler
     */
    function logError(context, error) {
        try {
            const errorLog = JSON.parse(localStorage.getItem(STORAGE_KEYS.ERROR_LOG) || '[]');
            
            errorLog.push({
                timestamp: Date.now(),
                date: new Date().toISOString(),
                context: context,
                error: error.message,
                stack: error.stack
            });
            
            // Behalte nur die letzten 100 Fehler
            if (errorLog.length > 100) {
                errorLog.splice(0, errorLog.length - 100);
            }
            
            localStorage.setItem(STORAGE_KEYS.ERROR_LOG, JSON.stringify(errorLog));
        } catch (e) {
            console.error('Failed to log error:', e);
        }
    }
    
    /**
     * Zeigt User-freundliche Fehlermeldung
     */
    function showApiError(type, error) {
        const messages = {
            cot: 'COT-Daten konnten nicht geladen werden. Verwende gecachte Daten.',
            news: 'Nachrichten konnten nicht geladen werden. Verwende gecachte Daten.',
            general: 'API-Fehler aufgetreten. Bitte später erneut versuchen.'
        };
        
        const message = messages[type] || messages.general;
        
        if (typeof showToast === 'function') {
            showToast(`⚠️ ${message}`, 'warning');
        } else {
            console.warn('⚠️', message, error);
        }
    }
    
    /**
     * Gibt Error-Log zurück
     */
    function getErrorLog() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.ERROR_LOG) || '[]');
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Löscht Error-Log
     */
    function clearErrorLog() {
        localStorage.removeItem(STORAGE_KEYS.ERROR_LOG);
    }

    // =====================================================================
    // COT DATEN ABRUFEN
    // =====================================================================
    
    /**
     * Holt COT-Daten direkt von der CFTC Website mit Retry
     */
    async function fetchCotDataFromCFTC() {
        console.log('🔄 Fetching COT data from CFTC...');
        
        return await retryWithBackoff(async () => {
            // Versuche primären Proxy
            try {
                const proxyUrl = CONFIG.CORS_PROXY + encodeURIComponent(CONFIG.CFTC_URL);
                const response = await fetchWithTimeout(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const htmlText = await response.text();
                const data = parseCFTCHtml(htmlText);
                
                if (!data || data.length === 0) {
                    throw new Error('No data parsed from CFTC HTML');
                }
                
                return data;
            } catch (primaryError) {
                console.warn('Primary proxy failed, trying fallback...', primaryError.message);
                
                // Versuche Fallback-Proxy
                const fallbackUrl = CONFIG.CORS_PROXY_FALLBACK + encodeURIComponent(CONFIG.CFTC_URL);
                const response = await fetchWithTimeout(fallbackUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Fallback proxy HTTP ${response.status}`);
                }
                
                const htmlText = await response.text();
                const data = parseCFTCHtml(htmlText);
                
                if (!data || data.length === 0) {
                    // Versuche CSV als letzte Alternative
                    return await fetchCotDataAlternative();
                }
                
                return data;
            }
        }, CONFIG.MAX_RETRIES, 'CFTC COT fetch');
    }
    
    /**
     * Alternative COT-Datenquelle (falls CFTC nicht erreichbar)
     */
    async function fetchCotDataAlternative() {
        console.log('🔄 Trying alternative COT data source...');
        
        try {
            // Versuche die offiziellen CFTC CSV-Daten
            const csvUrl = 'https://www.cftc.gov/dea/newcot/f_disagg.txt';
            const proxyUrl = CONFIG.CORS_PROXY + encodeURIComponent(csvUrl);
            
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const csvText = await response.text();
            return parseCFTCCsv(csvText);
            
        } catch (error) {
            console.error('❌ Alternative COT source failed:', error);
            return null;
        }
    }
    
    /**
     * Parst die CFTC HTML-Seite und extrahiert COT-Daten
     */
    function parseCFTCHtml(htmlText) {
        const results = [];
        const today = new Date().toISOString().split('T')[0];
        
        // Datum aus dem Report extrahieren
        const dateMatch = htmlText.match(/as of\s+(\w+)\s+(\d+),\s+(\d{4})/i);
        let reportDate = today;
        if (dateMatch) {
            const months = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December'];
            const monthIdx = months.findIndex(m => m.toLowerCase().startsWith(dateMatch[1].toLowerCase()));
            if (monthIdx !== -1) {
                reportDate = `${dateMatch[3]}-${String(monthIdx + 1).padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
            }
        }
        
        // Für jede Währung die Daten extrahieren
        for (const [symbol, info] of Object.entries(CONFIG.COT_CURRENCY_CODES)) {
            try {
                const regex = new RegExp(
                    info.name.replace(/\s+/g, '\\s+') + 
                    '[\\s\\S]*?Positions[\\s\\n]+([\\d,\\-\\s]+)',
                    'i'
                );
                
                const match = htmlText.match(regex);
                if (match) {
                    const numbers = match[1].match(/-?[\d,]+/g);
                    if (numbers && numbers.length >= 6) {
                        // Commercial Net Position = Long - Short (Spalten variieren je nach Format)
                        const dealerLong = parseInt(numbers[0].replace(/,/g, '')) || 0;
                        const dealerShort = parseInt(numbers[1].replace(/,/g, '')) || 0;
                        const assetLong = parseInt(numbers[3].replace(/,/g, '')) || 0;
                        const assetShort = parseInt(numbers[4].replace(/,/g, '')) || 0;
                        
                        const commercialNet = (dealerLong + assetLong) - (dealerShort + assetShort);
                        
                        results.push({
                            id: Date.now() + Math.random(),
                            date: reportDate,
                            symbol: symbol,
                            commercial_net_position: commercialNet,
                            source: 'CFTC_AUTO'
                        });
                    }
                }
            } catch (e) {
                console.warn(`Could not parse ${symbol}:`, e);
            }
        }
        
        console.log(`✅ Parsed ${results.length} COT entries from CFTC`);
        return results.length > 0 ? results : null;
    }
    
    /**
     * Parst die CFTC CSV-Datei
     */
    function parseCFTCCsv(csvText) {
        const results = [];
        const lines = csvText.split('\n');
        
        if (lines.length < 2) return null;
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const dateIdx = headers.findIndex(h => h.includes('report_date') || h.includes('as_of_date'));
        const nameIdx = headers.findIndex(h => h.includes('market_and_exchange_names') || h.includes('name'));
        
        // Finde relevante Spalten für Commercial Positions
        const commLongIdx = headers.findIndex(h => h.includes('comm_positions_long') || h.includes('commercial_long'));
        const commShortIdx = headers.findIndex(h => h.includes('comm_positions_short') || h.includes('commercial_short'));
        
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length < Math.max(dateIdx, nameIdx, commLongIdx, commShortIdx)) continue;
            
            const marketName = cols[nameIdx]?.toUpperCase() || '';
            
            // Prüfe ob es eine Währung ist
            for (const [symbol, info] of Object.entries(CONFIG.COT_CURRENCY_CODES)) {
                if (marketName.includes(info.name.toUpperCase()) || marketName.includes(symbol)) {
                    const commLong = parseInt(cols[commLongIdx]?.replace(/,/g, '')) || 0;
                    const commShort = parseInt(cols[commShortIdx]?.replace(/,/g, '')) || 0;
                    const netPosition = commLong - commShort;
                    
                    let reportDate = cols[dateIdx] || new Date().toISOString().split('T')[0];
                    // Formatiere Datum falls nötig
                    if (reportDate.includes('/')) {
                        const parts = reportDate.split('/');
                        reportDate = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
                    }
                    
                    results.push({
                        id: Date.now() + Math.random(),
                        date: reportDate,
                        symbol: symbol,
                        commercial_net_position: netPosition,
                        source: 'CFTC_CSV_AUTO'
                    });
                    break;
                }
            }
        }
        
        console.log(`✅ Parsed ${results.length} COT entries from CSV`);
        return results.length > 0 ? results : null;
    }

    // =====================================================================
    // NEWS/ECONOMIC CALENDAR DATEN
    // =====================================================================
    
    /**
     * Holt Wirtschaftskalender-Daten
     */
    async function fetchEconomicNews() {
        console.log('🔄 Fetching economic news...');
        
        try {
            // Forex Factory Calendar (CORS-freundlich)
            const response = await fetch(CONFIG.FOREX_FACTORY_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const newsData = await response.json();
            return parseForexFactoryNews(newsData);
            
        } catch (error) {
            console.error('❌ News fetch error:', error);
            return await fetchNewsAlternative();
        }
    }
    
    /**
     * Alternative News-Quelle
     */
    async function fetchNewsAlternative() {
        console.log('🔄 Trying alternative news source...');
        
        try {
            // Trading Economics oder ähnliche freie API
            // Hier könnte man auch andere Quellen einbinden
            return null;
        } catch (error) {
            console.error('❌ Alternative news source failed:', error);
            return null;
        }
    }
    
    /**
     * Parst Forex Factory News-Daten
     */
    function parseForexFactoryNews(newsData) {
        if (!Array.isArray(newsData)) return null;
        
        const results = [];
        const today = new Date();
        
        newsData.forEach(event => {
            try {
                // Bestimme die Währung basierend auf dem Land
                const currency = detectCurrencyFromEvent(event);
                if (!currency) return;
                
                // Bestimme das Sentiment basierend auf dem Impact und Actual vs Forecast
                const sentiment = determineSentiment(event);
                
                // Datum formatieren
                let eventDate = event.date || today.toISOString().split('T')[0];
                if (eventDate.includes('T')) {
                    eventDate = eventDate.split('T')[0];
                }
                
                results.push({
                    id: Date.now() + Math.random(),
                    date: eventDate,
                    currency: currency,
                    sentiment: sentiment,
                    report: event.title || event.event || 'Economic Event',
                    impact: event.impact || 'Medium',
                    actual: event.actual || null,
                    forecast: event.forecast || null,
                    previous: event.previous || null,
                    source: 'FOREX_FACTORY_AUTO'
                });
            } catch (e) {
                console.warn('Could not parse news event:', e);
            }
        });
        
        console.log(`✅ Parsed ${results.length} news events`);
        return results.length > 0 ? results : null;
    }
    
    /**
     * Erkennt die Währung aus einem News-Event
     */
    function detectCurrencyFromEvent(event) {
        const country = (event.country || event.currency || '').toUpperCase();
        const title = (event.title || event.event || '').toLowerCase();
        
        // Direktes Mapping
        const directMap = {
            'USD': 'USD', 'US': 'USD', 'USA': 'USD',
            'EUR': 'EUR', 'EU': 'EUR',
            'GBP': 'GBP', 'UK': 'GBP', 'GB': 'GBP',
            'JPY': 'JPY', 'JP': 'JPY', 'JAPAN': 'JPY',
            'AUD': 'AUD', 'AU': 'AUD', 'AUSTRALIA': 'AUD',
            'CAD': 'CAD', 'CA': 'CAD', 'CANADA': 'CAD',
            'CHF': 'CHF', 'CH': 'CHF', 'SWITZERLAND': 'CHF',
            'NZD': 'NZD', 'NZ': 'NZD'
        };
        
        if (directMap[country]) return directMap[country];
        
        // Suche in Keywords
        for (const [curr, keywords] of Object.entries(CONFIG.NEWS_CURRENCIES)) {
            for (const keyword of keywords) {
                if (title.includes(keyword.toLowerCase()) || country.includes(keyword.toUpperCase())) {
                    return curr;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Bestimmt das Sentiment basierend auf News-Daten
     */
    function determineSentiment(event) {
        const impact = (event.impact || '').toLowerCase();
        const actual = parseFloat(event.actual);
        const forecast = parseFloat(event.forecast);
        const previous = parseFloat(event.previous);
        
        // Wenn wir Actual vs Forecast haben
        if (!isNaN(actual) && !isNaN(forecast)) {
            const diff = actual - forecast;
            const percentDiff = Math.abs(diff / forecast) * 100;
            
            if (percentDiff > 20) {
                return diff > 0 ? 'Stark Long' : 'Stark Short';
            } else if (percentDiff > 5) {
                return diff > 0 ? 'Long' : 'Short';
            }
        }
        
        // Basierend auf Impact
        if (impact === 'high' || impact === 'red') {
            return 'Neutral'; // High impact aber unbekannte Richtung
        }
        
        return 'Neutral';
    }

    // =====================================================================
    // HAUPTFUNKTIONEN
    // =====================================================================
    
    /**
     * Aktualisiert COT-Daten wenn nötig
     */
    async function updateCotData(force = false) {
        const lastUpdate = localStorage.getItem(STORAGE_KEYS.LAST_COT_UPDATE);
        const now = Date.now();
        
        // Prüfe ob Update nötig
        if (!force && lastUpdate && (now - parseInt(lastUpdate)) < CONFIG.COT_UPDATE_INTERVAL) {
            console.log('⏭️ COT data still fresh, skipping update');
            return getCachedCotData();
        }
        
        const cotData = await fetchCotDataFromCFTC();
        
        if (cotData && cotData.length > 0) {
            // Speichere in localStorage
            localStorage.setItem(STORAGE_KEYS.CACHED_COT_DATA, JSON.stringify(cotData));
            localStorage.setItem(STORAGE_KEYS.LAST_COT_UPDATE, now.toString());
            
            // In die Hauptdatenbank einfügen
            if (typeof addCotData === 'function' && typeof loadCotData === 'function') {
                const existingKeys = new Set(loadCotData().map(e => `${e.date}_${e.symbol}`));
                let newCount = 0;
                
                cotData.forEach(entry => {
                    const key = `${entry.date}_${entry.symbol}`;
                    if (!existingKeys.has(key)) {
                        addCotData(entry);
                        newCount++;
                    }
                });
                
                console.log(`✅ Added ${newCount} new COT entries to database`);
            }
            
            return cotData;
        }
        
        return getCachedCotData();
    }
    
    /**
     * Aktualisiert News-Daten wenn nötig
     */
    async function updateNewsData(force = false) {
        const lastUpdate = localStorage.getItem(STORAGE_KEYS.LAST_NEWS_UPDATE);
        const now = Date.now();
        
        // Prüfe ob Update nötig
        if (!force && lastUpdate && (now - parseInt(lastUpdate)) < CONFIG.NEWS_UPDATE_INTERVAL) {
            console.log('⏭️ News data still fresh, skipping update');
            return getCachedNewsData();
        }
        
        const newsData = await fetchEconomicNews();
        
        if (newsData && newsData.length > 0) {
            // Speichere in localStorage
            localStorage.setItem(STORAGE_KEYS.CACHED_NEWS_DATA, JSON.stringify(newsData));
            localStorage.setItem(STORAGE_KEYS.LAST_NEWS_UPDATE, now.toString());
            
            // In die Hauptdatenbank einfügen
            if (typeof saveNewsData === 'function' && typeof loadNewsData === 'function') {
                const existingNews = loadNewsData();
                const existingKeys = new Set(existingNews.map(e => `${e.date}_${e.currency}_${e.report}`));
                let newCount = 0;
                
                newsData.forEach(entry => {
                    const key = `${entry.date}_${entry.currency}_${entry.report}`;
                    if (!existingKeys.has(key)) {
                        saveNewsData(entry);
                        newCount++;
                    }
                });
                
                console.log(`✅ Added ${newCount} new news entries to database`);
            }
            
            return newsData;
        }
        
        return getCachedNewsData();
    }
    
    /**
     * Gibt gecachte COT-Daten zurück
     */
    function getCachedCotData() {
        try {
            const cached = localStorage.getItem(STORAGE_KEYS.CACHED_COT_DATA);
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Gibt gecachte News-Daten zurück
     */
    function getCachedNewsData() {
        try {
            const cached = localStorage.getItem(STORAGE_KEYS.CACHED_NEWS_DATA);
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Initialisiert den automatischen Update-Service
     */
    function startAutoUpdate() {
        console.log('🚀 Starting API Data Service auto-update...');
        
        // Initiales Update
        updateCotData();
        updateNewsData();
        
        // Periodische Updates
        setInterval(() => updateCotData(), CONFIG.COT_UPDATE_INTERVAL);
        setInterval(() => updateNewsData(), CONFIG.NEWS_UPDATE_INTERVAL);
    }
    
    /**
     * Gibt den letzten Update-Status zurück
     */
    function getUpdateStatus() {
        const lastCot = localStorage.getItem(STORAGE_KEYS.LAST_COT_UPDATE);
        const lastNews = localStorage.getItem(STORAGE_KEYS.LAST_NEWS_UPDATE);
        
        return {
            cot: {
                lastUpdate: lastCot ? new Date(parseInt(lastCot)).toLocaleString('de-DE') : 'Nie',
                nextUpdate: lastCot ? new Date(parseInt(lastCot) + CONFIG.COT_UPDATE_INTERVAL).toLocaleString('de-DE') : 'Bald'
            },
            news: {
                lastUpdate: lastNews ? new Date(parseInt(lastNews)).toLocaleString('de-DE') : 'Nie',
                nextUpdate: lastNews ? new Date(parseInt(lastNews) + CONFIG.NEWS_UPDATE_INTERVAL).toLocaleString('de-DE') : 'Bald'
            }
        };
    }

    // =====================================================================
    // MACHINE LEARNING DATEN-EXPORT
    // =====================================================================
    
    /**
     * Exportiert alle Daten im ML-freundlichen Format
     */
    function exportForMachineLearning() {
        const cotData = typeof loadCotData === 'function' ? loadCotData() : getCachedCotData();
        const newsData = typeof loadNewsData === 'function' ? loadNewsData() : getCachedNewsData();
        const trades = typeof loadTrades === 'function' ? loadTrades() : [];
        
        // COT Daten nach Währung gruppieren
        const cotBySymbol = {};
        cotData.forEach(entry => {
            if (!cotBySymbol[entry.symbol]) {
                cotBySymbol[entry.symbol] = [];
            }
            cotBySymbol[entry.symbol].push({
                date: entry.date,
                net_position: entry.commercial_net_position,
                source: entry.source || 'manual'
            });
        });
        
        // News nach Währung gruppieren
        const newsBySymbol = {};
        newsData.forEach(entry => {
            if (!newsBySymbol[entry.currency]) {
                newsBySymbol[entry.currency] = [];
            }
            newsBySymbol[entry.currency].push({
                date: entry.date,
                sentiment: entry.sentiment,
                report: entry.report,
                impact: entry.impact || 'Medium'
            });
        });
        
        // Kombiniertes Dataset erstellen
        const mlDataset = {
            metadata: {
                exported_at: new Date().toISOString(),
                total_cot_entries: cotData.length,
                total_news_entries: newsData.length,
                total_trades: trades.length,
                currencies: Object.keys(CONFIG.COT_CURRENCY_CODES)
            },
            cot_data: cotBySymbol,
            news_data: newsBySymbol,
            trades: trades.map(t => ({
                date: t.date,
                pair: t.pair,
                direction: t.direction,
                r_multiple: t.rMultiple,
                setup: t.setup,
                result: parseFloat(t.rMultiple) > 0 ? 'win' : 'loss'
            })),
            // Zeitreihen-Features für ML
            features: generateMLFeatures(cotData, newsData)
        };
        
        return mlDataset;
    }
    
    /**
     * Generiert ML-Features aus den Daten
     */
    function generateMLFeatures(cotData, newsData) {
        const features = [];
        const currencies = Object.keys(CONFIG.COT_CURRENCY_CODES);
        
        // Gruppiere nach Datum
        const dateMap = new Map();
        
        cotData.forEach(entry => {
            if (!dateMap.has(entry.date)) {
                dateMap.set(entry.date, { cot: {}, news: {} });
            }
            dateMap.get(entry.date).cot[entry.symbol] = entry.commercial_net_position;
        });
        
        newsData.forEach(entry => {
            if (!dateMap.has(entry.date)) {
                dateMap.set(entry.date, { cot: {}, news: {} });
            }
            if (!dateMap.get(entry.date).news[entry.currency]) {
                dateMap.get(entry.date).news[entry.currency] = [];
            }
            dateMap.get(entry.date).news[entry.currency].push(entry);
        });
        
        // Sortiere nach Datum
        const sortedDates = Array.from(dateMap.keys()).sort();
        
        sortedDates.forEach((date, idx) => {
            const data = dateMap.get(date);
            const feature = { date };
            
            currencies.forEach(curr => {
                // COT Features
                feature[`${curr}_cot_net`] = data.cot[curr] || 0;
                
                // News Sentiment (numerisch)
                const sentimentMap = {
                    'Stark Long': 2, 'Long': 1, 'Neutral': 0, 'Short': -1, 'Stark Short': -2
                };
                const newsEntries = data.news[curr] || [];
                const avgSentiment = newsEntries.length > 0
                    ? newsEntries.reduce((sum, n) => sum + (sentimentMap[n.sentiment] || 0), 0) / newsEntries.length
                    : 0;
                feature[`${curr}_news_sentiment`] = avgSentiment;
                feature[`${curr}_news_count`] = newsEntries.length;
                
                // COT Change (wenn vorheriger Tag verfügbar)
                if (idx > 0) {
                    const prevData = dateMap.get(sortedDates[idx - 1]);
                    const prevCot = prevData?.cot[curr] || 0;
                    const currCot = data.cot[curr] || 0;
                    feature[`${curr}_cot_change`] = currCot - prevCot;
                } else {
                    feature[`${curr}_cot_change`] = 0;
                }
            });
            
            features.push(feature);
        });
        
        return features;
    }
    
    /**
     * Downloadet die ML-Daten als JSON
     */
    function downloadMLData() {
        const mlData = exportForMachineLearning();
        const blob = new Blob([JSON.stringify(mlData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading_ml_data_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ ML data downloaded');
    }

    // =====================================================================
    // PUBLIC API
    // =====================================================================
    return {
        // Daten abrufen
        updateCotData,
        updateNewsData,
        getCachedCotData,
        getCachedNewsData,
        
        // Auto-Update
        startAutoUpdate,
        getUpdateStatus,
        
        // ML Export
        exportForMachineLearning,
        downloadMLData,
        generateMLFeatures,
        
        // Konfiguration
        CONFIG
    };
})();

// Globaler Export
window.ApiDataService = ApiDataService;

// Auto-Start wenn DOM bereit
document.addEventListener('DOMContentLoaded', () => {
    // Starte auto-update nach kurzer Verzögerung
    setTimeout(() => {
        ApiDataService.startAutoUpdate();
    }, 2000);
});
