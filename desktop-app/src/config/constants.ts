/**
 * ========================================================================
 * Trading Journal - Zentrale Konstanten & Konfiguration
 * ========================================================================
 * 
 * Alle Magic Numbers und Strings zentral verwaltet.
 */

// ============================================================
// CACHE & TIMING
// ============================================================

export const CACHE = {
  /** Memoization TTL in Millisekunden */
  MEMOIZATION_TTL: 5000,
  /** COT Daten Cache-Dauer in Tagen */
  COT_CACHE_DAYS: 7,
  /** Toast Anzeigedauer in Millisekunden */
  TOAST_DURATION: 4000,
  /** Max gespeicherte Alerts */
  MAX_ALERTS: 50,
} as const;

// ============================================================
// PAGINATION
// ============================================================

export const PAGINATION = {
  /** Trades pro Seite */
  TRADES_PER_PAGE: 20,
  /** Outlooks pro Seite */
  OUTLOOKS_PER_PAGE: 12,
  /** Watchlist Items pro Seite */
  WATCHLIST_PER_PAGE: 24,
  /** Transaktionen pro Seite */
  TRANSACTIONS_PER_PAGE: 10,
} as const;

// ============================================================
// LIMITS
// ============================================================

export const LIMITS = {
  /** Max Zeichen für Trade-Notizen */
  MAX_NOTES_LENGTH: 2000,
  /** Max Zeichen für Outlook-These */
  MAX_THESIS_LENGTH: 5000,
  /** Max Screenshot Größe in Bytes (5MB) */
  MAX_SCREENSHOT_SIZE: 5 * 1024 * 1024,
  /** Max Simulation Durchläufe */
  MAX_SIMULATION_RUNS: 10000,
  /** Min Trades für aussagekräftige Statistiken */
  MIN_TRADES_FOR_STATS: 30,
} as const;

// ============================================================
// RISK MANAGEMENT DEFAULTS
// ============================================================

export const RISK_DEFAULTS = {
  /** Standard tägliches R-Limit */
  DAILY_LOSS_LIMIT_R: 3,
  /** Standard tägliches %-Limit */
  DAILY_LOSS_LIMIT_PERCENT: 2,
  /** Max Trades pro Tag */
  DAILY_TRADE_LIMIT: 5,
  /** Wöchentliches R-Limit */
  WEEKLY_LOSS_LIMIT_R: 10,
  /** Wöchentliches %-Limit */
  WEEKLY_LOSS_LIMIT_PERCENT: 5,
  /** Drawdown Alert Schwelle % */
  DRAWDOWN_ALERT_THRESHOLD: 5,
  /** Consecutive Loss Warnung nach X Verlusten */
  CONSECUTIVE_LOSS_LIMIT: 3,
  /** Tilt Detection: Trades in X Minuten */
  TILT_TRADE_FREQUENCY: 3,
  /** Tilt Detection: Zeitfenster in Minuten */
  TILT_FREQUENCY_WINDOW: 30,
} as const;

// ============================================================
// ACCOUNT DEFAULTS
// ============================================================

export const ACCOUNT_DEFAULTS = {
  EK: {
    INITIAL_BALANCE: 10000,
    CURRENCY: 'USD',
    DEFAULT_RISK: 0.5,
  },
  FUNDED: {
    INITIAL_BALANCE: 100000,
    CURRENCY: 'USD',
    DEFAULT_RISK: 1.0,
    PROFIT_TARGET_PERCENT: 8,
    MAX_DRAWDOWN_PERCENT: 5,
  },
} as const;

// ============================================================
// API ENDPOINTS
// ============================================================

export const API = {
  /** CFTC COT Data API */
  CFTC_COT: 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json',
  /** COT Datenpunkte zu laden */
  COT_DATA_LIMIT: 52,
} as const;

// ============================================================
// LOCAL STORAGE KEYS
// ============================================================

export const STORAGE_KEYS = {
  COT_DATA: 'cotData',
  COT_HISTORY: 'cotHistory',
  COT_LAST_UPDATE: 'cotLastUpdate',
  CURRENCY_ANALYSIS: 'currencyAnalysis',
  CURRENCY_ANALYSIS_DATE: 'currencyAnalysisDate',
  ACCOUNT_TRANSACTIONS: 'accountTransactions',
  BACKTEST_SESSIONS: 'backtestSessions',
  OUTLOOKS: 'outlooks',
  WATCHLIST: 'watchlist',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebarCollapsed',
} as const;

// ============================================================
// DATE FORMATS
// ============================================================

export const DATE_FORMATS = {
  /** ISO Date Format (YYYY-MM-DD) */
  ISO: 'yyyy-MM-dd',
  /** Deutsches Datum */
  DE_SHORT: 'dd.MM.yyyy',
  /** Deutsches Datum mit Wochentag */
  DE_FULL: 'EEEE, dd. MMM yyyy',
  /** Monat Jahr */
  MONTH_YEAR: 'MMMM yyyy',
  /** Kurz Monat Tag */
  SHORT_MONTH_DAY: 'dd. MMM',
} as const;

// ============================================================
// UI COLORS (für programmatische Verwendung)
// ============================================================

export const COLORS = {
  POSITIVE: '#22C55E',
  NEGATIVE: '#EF4444',
  NEUTRAL: '#6B7280',
  PRIMARY: '#4A9EFF',
  GOLD: '#F59E0B',
  
  CHART: {
    P5: '#ef4444',
    P25: '#f97316',
    P50: '#eab308',
    P75: '#22c55e',
    P95: '#10b981',
  },
} as const;

// ============================================================
// VALIDATION
// ============================================================

export const VALIDATION = {
  /** Min R-Multiple */
  MIN_R_MULTIPLE: -10,
  /** Max R-Multiple */
  MAX_R_MULTIPLE: 20,
  /** Min Risk Percent */
  MIN_RISK_PERCENT: 0.01,
  /** Max Risk Percent */
  MAX_RISK_PERCENT: 10,
  /** Min Confidence Level */
  MIN_CONFIDENCE: 1,
  /** Max Confidence Level */
  MAX_CONFIDENCE: 5,
} as const;

// ============================================================
// CFTC CODES FÜR WÄHRUNGEN
// ============================================================

export const CFTC_CODES = {
  EUR: '099741',
  GBP: '096742',
  JPY: '097741',
  CAD: '090741',
  AUD: '232741',
  NZD: '112741',
  CHF: '092741',
  USD: '098662',
} as const;

// ============================================================
// SUPPORTED LANGUAGES
// ============================================================

export const LANGUAGES = {
  DE: 'de',
  EN: 'en',
} as const;

export type SupportedLanguage = typeof LANGUAGES[keyof typeof LANGUAGES];
