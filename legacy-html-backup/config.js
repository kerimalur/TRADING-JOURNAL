/* ====================================================================== */
/* TRADING JOURNAL - ZENTRALE KONFIGURATION                               */
/* Alle globalen Konstanten, Einstellungen und Definitionen               */
/* ====================================================================== */

// ======================================================================
// 1. TRADING PAARE
// ======================================================================
const PAIR_LIST = [
    "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "NZDUSD", "USDCAD", "USDCHF",
    "EURAUD", "EURCAD", "EURCHF", "EURGBP", "EURJPY", "EURNZD",
    "GBPAUD", "GBPCAD", "GBPCHF", "GBPJPY", "GBPNZD",
    "AUDCAD", "AUDCHF", "AUDJPY", "AUDNZD",
    "CADCHF", "CADJPY",
    "CHFJPY",
    "NZDCAD", "NZDCHF", "NZDJPY"
];

// Währungssymbole für Analysen
const TRACKED_SYMBOLS = ['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'USD'];

// ======================================================================
// 2. SETUP DEFINITIONEN (Deine 5 Trading Setups)
// ======================================================================
const SETUP_DEFINITIONS = {
    'setup_daily_bos': { 
        label: 'Daily BOS', 
        short: 'BOS', 
        css: 'bos-active',
        color: 'var(--color-pnl-positive)',
        description: 'Daily Break of Structure'
    },
    'setup_value_area': { 
        label: 'Value Area', 
        short: 'VA', 
        css: 'va-active',
        color: 'var(--color-accent-secondary)',
        description: 'Value Area Entry'
    },
    'setup_market_structure': { 
        label: 'Market Structure', 
        short: 'MS', 
        css: 'ms-active',
        color: '#E67E22',
        description: 'Market Structure Shift'
    },
    'setup_weekly_gva': { 
        label: 'Weekly GVA', 
        short: 'W-GVA', 
        css: 'gva-weekly-active',
        color: '#9B59B6',
        description: 'Weekly GVA Entry'
    },
    'setup_3day_gva': { 
        label: '3Day GVA', 
        short: '3D-GVA', 
        css: 'gva-3day-active',
        color: '#F1C40F',
        description: '3-Day GVA Entry'
    }
};

// ======================================================================
// 3. LOKALE SPEICHER-SCHLÜSSEL
// ======================================================================
const STORAGE_KEYS = {
    ACCOUNT_CONFIG: 'tradingJournalAccountConfigs',
    TRADES: 'tradingJournalTrades',
    COT_DATA: 'tradingJournalCotData',
    BIAS_DATA: 'tradingJournalBiasData',
    TRANSACTIONS: 'tradingJournalTransactions',
    NEWS_DATA: 'tradingJournalNewsData',
    THEME: 'tradingJournalTheme',
    PASSWORD_HASH: 'tradingJournalPasswordHash',
    SESSION: 'tradingJournalSessionActive',
    SIDEBAR_COLLAPSED: 'sidebarCollapsed'
};

// ======================================================================
// 4. APP-EINSTELLUNGEN
// ======================================================================
const APP_CONFIG = {
    // Version für Cache-Busting und Migrations
    VERSION: '2.0.0',
    
    // Bild-Komprimierung
    IMAGE: {
        MAX_SIZE_MB: 10,
        COMPRESSION_QUALITY: 0.7,
        MAX_WIDTH: 1920
    },
    
    // Animation Timings (in ms)
    ANIMATIONS: {
        FAST: 200,
        NORMAL: 300,
        SLOW: 500,
        VERY_SLOW: 800
    },
    
    // Toast/Notification Einstellungen
    NOTIFICATIONS: {
        DURATION: 3000,
        POSITION: 'bottom-right'
    },
    
    // Autosave Intervall (in ms)
    AUTOSAVE_INTERVAL: 30000
};

// ======================================================================
// 5. THEME KONFIGURATION
// ======================================================================
const THEMES = {
    dark: {
        name: 'Dark Mode',
        icon: 'fa-moon',
        colors: {
            background: '#1A1D20',
            surface: '#24282F',
            surfaceHover: '#353A43',
            textLight: '#F8F9FA',
            textSubtle: '#9EA0A8',
            accentMain: '#00FFD1',
            accentSecondary: '#00C8FF'
        }
    },
    light: {
        name: 'Light Mode',
        icon: 'fa-sun',
        colors: {
            background: '#F5F7FA',
            surface: '#FFFFFF',
            surfaceHover: '#E8ECF0',
            textLight: '#1A1D20',
            textSubtle: '#6B7280',
            accentMain: '#00B894',
            accentSecondary: '#0984E3'
        }
    }
};

// ======================================================================
// 6. HILFSFUNKTIONEN
// ======================================================================

/**
 * Formatiert eine Zahl als Währung
 * @param {number} value - Der Wert
 * @param {string} currency - Die Währung (USD, EUR, etc.)
 * @returns {string} Formatierter String
 */
function formatCurrency(value, currency = 'USD') {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

/**
 * Formatiert ein Datum
 * @param {string|Date} date - Das Datum
 * @param {string} format - 'short', 'long', 'relative'
 * @returns {string} Formatiertes Datum
 */
function formatDate(date, format = 'short') {
    const d = new Date(date);
    
    if (format === 'relative') {
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Heute';
        if (diffDays === 1) return 'Gestern';
        if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    }
    
    if (format === 'long') {
        return d.toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    return d.toLocaleDateString('de-DE');
}

/**
 * Formatiert R-Multiple mit Vorzeichen und Farbe
 * @param {number} rValue - Das R-Multiple
 * @returns {object} { text, cssClass }
 */
function formatRMultiple(rValue) {
    const r = parseFloat(rValue) || 0;
    const sign = r >= 0 ? '+' : '';
    
    return {
        text: `${sign}${r.toFixed(2)}R`,
        cssClass: r > 0 ? 'pnl-positive' : r < 0 ? 'pnl-negative' : 'pnl-neutral'
    };
}

/**
 * Debounce Funktion für Performance
 * @param {Function} func - Die Funktion
 * @param {number} wait - Wartezeit in ms
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle Funktion für Performance
 * @param {Function} func - Die Funktion
 * @param {number} limit - Limit in ms
 */
function throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Zeigt eine Toast-Benachrichtigung
 * @param {string} message - Die Nachricht
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showToast(message, type = 'info') {
    // Entferne alte Toasts
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(toast);
    
    // Animation einblenden
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });
    
    // Auto-Hide
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, APP_CONFIG.NOTIFICATIONS.DURATION);
}

/**
 * Sichere JSON Parse Funktion
 * @param {string} jsonString - Der JSON String
 * @param {any} fallback - Fallback-Wert bei Fehler
 */
function safeJsonParse(jsonString, fallback = null) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.warn('JSON Parse Error:', error);
        return fallback;
    }
}

/**
 * Generiert eine eindeutige ID
 * @returns {string} Unique ID
 */
function generateUniqueId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ======================================================================
// 7. THEME MANAGEMENT
// ======================================================================

/**
 * Initialisiert das Theme System
 */
function initThemeSystem() {
    // Lade gespeichertes Theme oder nutze System-Präferenz
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'dark'); // Default: Dark
    
    applyTheme(currentTheme, false);
    
    // Listener für System Theme Änderungen
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
            applyTheme(e.matches ? 'dark' : 'light', true);
        }
    });
}

/**
 * Wendet ein Theme an
 * @param {string} themeName - 'dark' oder 'light'
 * @param {boolean} animate - Mit Animation?
 */
function applyTheme(themeName, animate = true) {
    const theme = THEMES[themeName];
    if (!theme) return;
    
    const root = document.documentElement;
    
    if (animate) {
        root.classList.add('theme-transitioning');
    }
    
    // Setze Theme-Attribut
    root.setAttribute('data-theme', themeName);
    
    // Setze CSS Variablen
    Object.entries(theme.colors).forEach(([key, value]) => {
        const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVarName, value);
    });
    
    // Speichere Theme
    localStorage.setItem(STORAGE_KEYS.THEME, themeName);
    
    // Update Toggle Button Icons
    updateThemeToggleIcon(themeName);
    
    if (animate) {
        setTimeout(() => {
            root.classList.remove('theme-transitioning');
        }, 500);
    }
}

/**
 * Wechselt zwischen Dark und Light Theme
 */
function toggleTheme() {
    const currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme, true);
    
    // Zeige Toast
    const theme = THEMES[newTheme];
    showToast(`${theme.name} aktiviert`, 'success');
}

/**
 * Aktualisiert das Theme Toggle Icon
 * @param {string} themeName - Aktuelles Theme
 */
function updateThemeToggleIcon(themeName) {
    const toggleBtns = document.querySelectorAll('.theme-toggle, #theme-toggle-sidebar');
    const icon = themeName === 'dark' ? 'fa-sun' : 'fa-moon';
    const title = themeName === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren';
    const text = themeName === 'dark' ? 'Light Mode' : 'Dark Mode';
    
    toggleBtns.forEach(btn => {
        const iconEl = btn.querySelector('i');
        const textEl = btn.querySelector('span');
        if (iconEl) {
            iconEl.className = `fas ${icon}`;
        }
        if (textEl) {
            textEl.textContent = text;
        }
        btn.title = title;
    });
}

/**
 * Erstellt und fügt den Theme Toggle Button ein (nur für alte Seiten ohne Sidebar)
 */
function createThemeToggle() {
    // Bei neuer Sidebar-Struktur nicht automatisch erstellen
    if (document.querySelector('#theme-toggle-sidebar') || document.querySelector('.sidebar')) {
        // Update das Icon falls Sidebar vorhanden
        const currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
        updateThemeToggleIcon(currentTheme);
        return;
    }
    
    // Prüfe ob bereits vorhanden
    if (document.querySelector('.theme-toggle')) return;
    
    const toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.setAttribute('aria-label', 'Theme wechseln');
    toggle.title = 'Theme wechseln';
    toggle.innerHTML = '<i class="fas fa-sun"></i>';
    toggle.addEventListener('click', toggleTheme);
    
    // Füge zum Header hinzu (falls vorhanden)
    const header = document.querySelector('header');
    if (header) {
        header.appendChild(toggle);
    } else {
        document.body.appendChild(toggle);
    }
    
    // Aktualisiere Icon basierend auf aktuellem Theme
    const currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    updateThemeToggleIcon(currentTheme);
}

// Theme System automatisch initialisieren wenn DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initThemeSystem();
        createThemeToggle();
    });
} else {
    initThemeSystem();
    // createThemeToggle wird später aufgerufen wenn DOM vollständig ist
    setTimeout(createThemeToggle, 100);
}

// ======================================================================
// 8. EXPORT FÜR MODULE (falls benötigt)
// ======================================================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PAIR_LIST,
        TRACKED_SYMBOLS,
        SETUP_DEFINITIONS,
        STORAGE_KEYS,
        APP_CONFIG,
        THEMES,
        formatCurrency,
        formatDate,
        formatRMultiple,
        debounce,
        throttle,
        showToast,
        safeJsonParse,
        generateUniqueId
    };
}
