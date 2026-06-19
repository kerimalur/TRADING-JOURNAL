/**
 * ========================================================================
 * Trading Journal - TypeScript Type Definitions
 * ========================================================================
 */

// ============================================================
// TRADE TYPES
// ============================================================

export type AccountType = 'ek' | 'funded';
export type TradeDirection = 'long' | 'short';
export type TradeResult = 'win' | 'loss' | 'breakeven';
export type SessionType = 'live' | 'backtest';

export interface Trade {
  id: string;  // Geändert zu string (UUID-Format)
  type: AccountType;
  pair: string;
  direction: TradeDirection;
  date: string;
  result: TradeResult;
  rMultiple: number;
  riskPercent?: number;
  riskAmount?: number;    // Risikobetrag in Kontowährung (z.B. 100 CHF)
  profitAmount?: number;  // Gewinn/Verlust in Kontowährung (rMultiple * riskAmount)
  notes?: string;
  comment?: string;       // Kommentar/Notizen zum Trade
  sessionType: SessionType;
  session?: string;       // Trading session (London, NY, Asia)
  // Balance tracking
  accountBalanceBefore?: number;
  accountBalanceAfter?: number;
  runningBalance?: number;
  // Price levels
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  quantity?: number;
  lotSize?: number;       // Lot Size des Trades
  // Status & P/L
  status?: 'open' | 'closed';
  pnl?: number;
  // Chapter
  chapterId?: string;
  // Setup flags (legacy)
  htfBias?: boolean;
  d1Zone?: boolean;
  d1Fib?: boolean;
  h4Zone?: boolean;
  m15Entry?: boolean;
  // Setup flags (new)
  setup_daily_bos?: boolean;
  setup_value_area?: boolean;
  setup_market_structure?: boolean;
  setup_weekly_gva?: boolean;
  setup_3day_gva?: boolean;
  // Confluences (new – same list as in Settings)
  confluences?: string[];
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface TradeFormData {
  type: AccountType;
  pair: string;
  direction: TradeDirection;
  date: string;
  result: TradeResult;
  rMultiple: number;
  riskPercent?: number;
  notes?: string;
  setup_daily_bos?: boolean;
  setup_value_area?: boolean;
  setup_market_structure?: boolean;
  setup_weekly_gva?: boolean;
  setup_3day_gva?: boolean;
  screenshot?: File | null;
}

export interface TradeFilters {
  result?: TradeResult | 'all';
  pair?: string | 'all';
  setup_daily_bos?: boolean;
  setup_value_area?: boolean;
  setup_market_structure?: boolean;
  setup_weekly_gva?: boolean;
  setup_3day_gva?: boolean;
}

// ============================================================
// ACCOUNT TYPES
// ============================================================

export interface AccountChapter {
  id: string;
  startBalance: number;
  startDate: string;
  endDate?: string;      // null = aktives Kapitel
  reason: string;        // z.B. "Neuer 50k Account", "Inaktivität - Neustart"
}

export interface AccountConfig {
  id?: string;              // UUID aus accounts-Tabelle
  name?: string;            // Anzeigename: "FTMO $100k #2"
  broker?: string;          // "FTMO", "MFT", "IC Markets"
  accountNumber?: string;   // Broker-Kontonummer
  initialStartBalance: number;
  currentBalance: number;
  currency: string;
  type: AccountType;
  defaultRiskPerTrade: number;
  enableGoals?: boolean;
  profitTargetValue?: number;
  profitTargetType?: 'percent' | 'absolute';
  maxDrawdownValue?: number;
  maxDrawdownType?: 'percent' | 'absolute';
  dailyDrawdownValue?: number;
  dailyDrawdownType?: 'percent' | 'absolute';
  profitTarget?: number;
  maxDrawdown?: number;
  chapters?: AccountChapter[];
  activeChapterId?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface AccountConfigs {
  ek: AccountConfig | null;
  funded: AccountConfig | null;
  ekAccounts?: AccountConfig[];       // Alle EK-Accounts (für Multi-Account)
  fundedAccounts?: AccountConfig[];   // Alle Funded-Accounts (für Multi-Account)
}

// ============================================================
// TRANSACTION TYPES
// ============================================================

export type TransactionType = 'deposit' | 'withdrawal' | 'payout';

export interface Transaction {
  id: string;  // UUID-Format für Konsistenz
  type: AccountType;
  transactionType: TransactionType;
  amount: number;
  date: string;
  note?: string;
  createdAt?: string;
}

// ============================================================
// MARKET DATA TYPES
// ============================================================

export interface CotData {
  id: number;
  symbol: string;
  date: string;
  commercial_long?: number;
  commercial_short?: number;
  commercial_net?: number;
  noncommercial_long?: number;
  noncommercial_short?: number;
  noncommercial_net?: number;
}

export interface NewsData {
  id: number;
  currency: string;
  date: string;
  sentiment: 'Long' | 'Short' | 'Neutral' | 'Stark Long' | 'Stark Short';
  report?: string;
  createdAt: string;
}

export interface InterestRate {
  currency: string;
  rate: number;
  trend: 'hiking' | 'cutting' | 'holding';
  updatedAt: string;
}

// ============================================================
// ANALYSIS TYPES
// ============================================================

export interface WeekdayStats {
  day: number;
  name: string;
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  winRate: number;
  avgR: number;
}

export interface SetupStats {
  key: string;
  name: string;
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  winRate: number;
  avgR: number;
}

export interface PairStats {
  pair: string;
  trades: number;
  wins: number;
  losses: number;
  totalR: number;
  winRate: number;
  avgR: number;
}

export interface DashboardMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  totalR: number;
  avgR: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentStreak: number;
  streakType: 'win' | 'loss' | null;
  bestTrade: number;
  worstTrade: number;
}

export interface ConfluenceScore {
  currency: string;
  score: number;
  bias: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  factors: string[];
  rate: number;
  trend: string;
}

export interface PairConfluence {
  pair: string;
  score: number;
  bias: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  baseAnalysis: ConfluenceScore;
  quoteAnalysis: ConfluenceScore;
}

// ============================================================
// UI TYPES
// ============================================================

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface PopupState {
  isOpen: boolean;
  data?: any;
}

// ============================================================
// CONFIG TYPES
// ============================================================

export interface SetupDefinition {
  key: string;
  label: string;
  short: string;
  css: string;
  color: string;
  description: string;
}

export const PAIR_LIST = [
  // Major Forex
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
  // Cross Pairs
  'EURAUD', 'EURCAD', 'EURCHF', 'EURGBP', 'EURJPY', 'EURNZD',
  'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPJPY', 'GBPNZD',
  'AUDCAD', 'AUDCHF', 'AUDJPY', 'AUDNZD',
  'CADCHF', 'CADJPY',
  'CHFJPY',
  'NZDCAD', 'NZDCHF', 'NZDJPY',
  // Metals
  'XAUUSD', 'XAGUSD',
  // Crypto
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'BNBUSD', 'ADAUSD', 'DOGEUSD', 'AVAXUSD', 'DOTUSD', 'LINKUSD',
] as const;

// Custom pairs stored in localStorage
const CUSTOM_PAIRS_KEY = 'tradingJournal_customPairs';

export const getCustomPairs = (): string[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_PAIRS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const addCustomPair = (pair: string): boolean => {
  const cleaned = pair.replace('/', '').toUpperCase();
  if (cleaned.length < 6) return false;
  
  const customs = getCustomPairs();
  if (customs.includes(cleaned) || PAIR_LIST.includes(cleaned as any)) return false;
  
  customs.push(cleaned);
  localStorage.setItem(CUSTOM_PAIRS_KEY, JSON.stringify(customs));
  return true;
};

export const removeCustomPair = (pair: string): void => {
  const customs = getCustomPairs().filter(p => p !== pair);
  localStorage.setItem(CUSTOM_PAIRS_KEY, JSON.stringify(customs));
};

export const getAllPairs = (): string[] => {
  return [...PAIR_LIST, ...getCustomPairs()];
};

export type CurrencyPair = typeof PAIR_LIST[number];

export const PAIR_GROUPS: Record<string, string[]> = {
  'EUR': ['EURUSD', 'EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'EURCHF'],
  'GBP': ['GBPUSD', 'GBPJPY', 'GBPAUD', 'GBPNZD', 'GBPCAD', 'GBPCHF'],
  'AUD': ['AUDUSD', 'AUDJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF'],
  'NZD': ['NZDUSD', 'NZDJPY', 'NZDCAD', 'NZDCHF'],
  'USD': ['USDJPY', 'USDCAD', 'USDCHF'],
  'CAD': ['CADJPY', 'CADCHF'],
  'CHF': ['CHFJPY'],
};

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'] as const;

export type Currency = typeof CURRENCIES[number];

// ============================================================
// OUTLOOK TYPES
// ============================================================

export type OutlookStatus = 'observation' | 'waiting' | 'active' | 'cancelled' | 'executed';
export type OutlookDirection = 'long' | 'short';
export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export interface CurrencyBias {
  currency: string;
  signal: 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short';
  percentile: number;
}

export interface StrategyChecklistItem {
  ruleId: string;
  text: string;
  type: 'entry' | 'exit' | 'filter' | 'risk';
  checked: boolean;
}

export interface Outlook {
  id: string;
  symbol: string;
  direction: OutlookDirection;
  thesis: string;
  confidence: ConfidenceLevel;
  status: OutlookStatus;
  cotBias?: {
    base: CurrencyBias;
    quote: CurrencyBias;
    divergenceScore: number;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  executedTradeId?: string;
  journaledTo?: ('ek' | 'funded')[];
  targetEntry?: number;
  targetSL?: number;
  targetTP?: number;
  interestingZone?: number;
  imageData?: string;
  tags?: string[];
  expiresAt?: string;
  isStarred?: boolean;
  setupId?: string;
  strategyChecklist?: StrategyChecklistItem[];
  fundamentalOutlook?: string;
}

export const OUTLOOK_STATUS_CONFIG: Record<OutlookStatus, { label: string; color: string; bgColor: string }> = {
  observation: { label: 'Beobachtung', color: 'text-accent-blue', bgColor: 'bg-accent-blue/20' },
  waiting: { label: 'Wartend', color: 'text-accent-gold', bgColor: 'bg-accent-gold/20' },
  active: { label: 'Aktiv', color: 'text-pnl-positive', bgColor: 'bg-pnl-positive/20' },
  cancelled: { label: 'Abgebrochen', color: 'text-text-muted', bgColor: 'bg-background-surface' },
  executed: { label: 'Ausgeführt', color: 'text-accent-primary', bgColor: 'bg-accent-primary/20' },
};

// Confluences – früher "Tags". Anpassbar über Settings (localStorage).
// Standard-Confluences ohne COT-Divergenz (auf Wunsch entfernt).
export const DEFAULT_CONFLUENCES = [
  'Fundamental',
  'Technisch',
  'Event-basiert',
  'Saisonal',
  'Intermarket',
  'SMC',
  'Liquidität',
  'Imbalance',
] as const;

const CONFLUENCES_STORAGE_KEY = 'tradingJournal_confluences';

export function getConfluences(): string[] {
  try {
    const stored = localStorage.getItem(CONFLUENCES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [...DEFAULT_CONFLUENCES];
  } catch {
    return [...DEFAULT_CONFLUENCES];
  }
}

export function saveConfluences(list: string[]): void {
  localStorage.setItem(CONFLUENCES_STORAGE_KEY, JSON.stringify(list));
}

// Abwärtskompatibilität
export const OUTLOOK_TAGS = DEFAULT_CONFLUENCES;
export type OutlookTag = string;

export const SETUP_DEFINITIONS: Record<string, SetupDefinition> = {
  setup_daily_bos: {
    key: 'setup_daily_bos',
    label: 'Daily BOS',
    short: 'BOS',
    css: 'bos-active',
    color: '#22C55E',
    description: 'Daily Break of Structure',
  },
  setup_value_area: {
    key: 'setup_value_area',
    label: 'Value Area',
    short: 'VA',
    css: 'va-active',
    color: '#4A9EFF',
    description: 'Value Area Entry',
  },
  setup_market_structure: {
    key: 'setup_market_structure',
    label: 'Market Structure',
    short: 'MS',
    css: 'ms-active',
    color: '#E67E22',
    description: 'Market Structure Shift',
  },
  setup_weekly_gva: {
    key: 'setup_weekly_gva',
    label: 'Weekly GVA',
    short: 'W-GVA',
    css: 'gva-weekly-active',
    color: '#9B59B6',
    description: 'Weekly GVA Entry',
  },
  setup_3day_gva: {
    key: 'setup_3day_gva',
    label: '3Day GVA',
    short: '3D-GVA',
    css: 'gva-3day-active',
    color: '#F1C40F',
    description: '3-Day GVA Entry',
  },
};
