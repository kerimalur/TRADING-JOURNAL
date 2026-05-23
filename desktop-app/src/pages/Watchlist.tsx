/**
 * ========================================================================
 * Trading Journal - Watchlist (TradingView-Style)
 * ========================================================================
 * Real-time prices via Yahoo Finance API, multiple watchlists,
 * drag-to-reorder, sparklines, TradingView-like layout.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Star,
  Plus,
  Trash2,
  Search,
  X,
  RefreshCw,
  GripVertical,
  ChevronDown,
  Edit2,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Clock,
  List,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { SparklineChart } from '@/components/ui/SparklineChart';

// ============================================================
// TYPES
// ============================================================

interface WatchlistSymbol {
  symbol: string;
  customName?: string;
  starred?: boolean;
}

interface WatchlistData {
  id: string;
  name: string;
  symbols: WatchlistSymbol[];
}

interface QuoteData {
  symbol: string;
  shortName: string;
  longName?: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  dayHigh?: number;
  dayLow?: number;
  open?: number;
  prevClose?: number;
  currency: string;
  marketState?: string;
  sparkline: number[];
  fetchedAt: number;
}

type SortField = 'symbol' | 'price' | 'change' | 'changePercent';
type SortDir = 'asc' | 'desc';

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEY = 'tradingJournal_watchlists';
const PRICES_KEY  = 'tradingJournal_watchlist_prices';
const POLL_INTERVAL = 30_000; // 30 seconds
const SPARK_INTERVAL = 5 * 60_000; // 5 minutes for sparkline refresh

const SUGGESTED_SYMBOLS = [
  // Forex
  { symbol: 'EURUSD=X', name: 'EUR/USD',  group: 'Forex' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD',  group: 'Forex' },
  { symbol: 'USDJPY=X', name: 'USD/JPY',  group: 'Forex' },
  { symbol: 'AUDUSD=X', name: 'AUD/USD',  group: 'Forex' },
  { symbol: 'USDCHF=X', name: 'USD/CHF',  group: 'Forex' },
  { symbol: 'USDCAD=X', name: 'USD/CAD',  group: 'Forex' },
  { symbol: 'NZDUSD=X', name: 'NZD/USD',  group: 'Forex' },
  { symbol: 'EURGBP=X', name: 'EUR/GBP',  group: 'Forex' },
  { symbol: 'EURJPY=X', name: 'EUR/JPY',  group: 'Forex' },
  { symbol: 'GBPJPY=X', name: 'GBP/JPY',  group: 'Forex' },
  { symbol: 'XAUUSD=X', name: 'Gold',     group: 'Commodities' },
  { symbol: 'XAGUSD=X', name: 'Silver',   group: 'Commodities' },
  { symbol: 'USOIL=X',  name: 'WTI Oil',  group: 'Commodities' },
  // Indices
  { symbol: '^GSPC',    name: 'S&P 500',  group: 'Indices' },
  { symbol: '^NDX',     name: 'NASDAQ 100', group: 'Indices' },
  { symbol: '^DJI',     name: 'Dow Jones', group: 'Indices' },
  { symbol: '^FTSE',    name: 'FTSE 100', group: 'Indices' },
  { symbol: '^GDAXI',   name: 'DAX',      group: 'Indices' },
  { symbol: '^N225',    name: 'Nikkei 225', group: 'Indices' },
  // Crypto
  { symbol: 'BTC-USD',  name: 'Bitcoin',  group: 'Crypto' },
  { symbol: 'ETH-USD',  name: 'Ethereum', group: 'Crypto' },
  { symbol: 'SOL-USD',  name: 'Solana',   group: 'Crypto' },
  { symbol: 'BNB-USD',  name: 'BNB',      group: 'Crypto' },
  // Stocks
  { symbol: 'AAPL',     name: 'Apple',    group: 'Stocks' },
  { symbol: 'MSFT',     name: 'Microsoft', group: 'Stocks' },
  { symbol: 'GOOGL',    name: 'Alphabet', group: 'Stocks' },
  { symbol: 'AMZN',     name: 'Amazon',   group: 'Stocks' },
  { symbol: 'TSLA',     name: 'Tesla',    group: 'Stocks' },
  { symbol: 'NVDA',     name: 'NVIDIA',   group: 'Stocks' },
  { symbol: 'META',     name: 'Meta',     group: 'Stocks' },
];

const DEFAULT_WATCHLISTS: WatchlistData[] = [
  {
    id: 'forex',
    name: 'Forex',
    symbols: [
      { symbol: 'EURUSD=X' },
      { symbol: 'GBPUSD=X' },
      { symbol: 'USDJPY=X' },
      { symbol: 'AUDUSD=X' },
      { symbol: 'XAUUSD=X' },
    ],
  },
  {
    id: 'indices',
    name: 'Indizes',
    symbols: [
      { symbol: '^GSPC' },
      { symbol: '^NDX' },
      { symbol: '^GDAXI' },
    ],
  },
  {
    id: 'crypto',
    name: 'Crypto',
    symbols: [
      { symbol: 'BTC-USD' },
      { symbol: 'ETH-USD' },
      { symbol: 'SOL-USD' },
    ],
  },
];

// ============================================================
// HELPERS
// ============================================================

function loadWatchlists(): WatchlistData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_WATCHLISTS;
  } catch {
    return DEFAULT_WATCHLISTS;
  }
}

function saveWatchlists(data: WatchlistData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function loadCachedPrices(): Record<string, QuoteData> {
  try {
    const raw = localStorage.getItem(PRICES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCachedPrices(data: Record<string, QuoteData>): void {
  try {
    localStorage.setItem(PRICES_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function formatPrice(price: number, symbol: string): string {
  if (!price || isNaN(price)) return '—';
  // Forex prices (4-5 decimal places for non-JPY)
  if (symbol.includes('=X')) {
    if (symbol.includes('JPY') || symbol.includes('jpy')) return price.toFixed(3);
    if (symbol.includes('XAU') || symbol.includes('XAG')) return price.toFixed(2);
    return price.toFixed(5);
  }
  if (symbol.startsWith('^')) return price.toFixed(2);
  if (price < 1) return price.toFixed(4);
  if (price >= 10000) return price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toFixed(2);
}

function formatChange(change: number, symbol: string): string {
  if (!change || isNaN(change)) return '—';
  const prefix = change >= 0 ? '+' : '';
  if (symbol.includes('=X')) {
    if (symbol.includes('JPY')) return prefix + change.toFixed(3);
    if (symbol.includes('XAU') || symbol.includes('XAG')) return prefix + change.toFixed(2);
    return prefix + change.toFixed(5);
  }
  return prefix + change.toFixed(2);
}

function formatVolume(vol?: number): string {
  if (!vol) return '—';
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(0) + 'K';
  return vol.toString();
}

function getDisplayName(symbol: string, quote?: QuoteData): string {
  if (quote?.shortName) return quote.shortName;
  const found = SUGGESTED_SYMBOLS.find(s => s.symbol === symbol);
  if (found) return found.name;
  // Fallback: clean up symbol
  return symbol.replace('=X', '').replace('-USD', '/USD').replace('^', '');
}

function getExchangeBadge(symbol: string, quote?: QuoteData): string {
  if (symbol.includes('=X')) return 'FX';
  if (symbol.startsWith('^')) return 'IDX';
  if (symbol.endsWith('-USD')) return 'CRYPTO';
  return quote?.exchange?.substring(0, 3).toUpperCase() ?? 'STK';
}

// ============================================================
// YAHOO FINANCE API
// ============================================================

async function fetchQuotes(symbols: string[]): Promise<Partial<QuoteData>[]> {
  if (!symbols.length) return [];
  const encoded = symbols.map(encodeURIComponent).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encoded}&formatted=false`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': '*/*' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const results: any[] = json?.quoteResponse?.result ?? [];
    return results.map(r => ({
      symbol: r.symbol,
      shortName: r.shortName ?? r.displayName ?? r.symbol,
      longName: r.longName,
      exchange: r.exchange ?? r.fullExchangeName ?? '',
      price: r.regularMarketPrice,
      change: r.regularMarketChange,
      changePercent: r.regularMarketChangePercent,
      volume: r.regularMarketVolume,
      dayHigh: r.regularMarketDayHigh,
      dayLow: r.regularMarketDayLow,
      open: r.regularMarketOpen,
      prevClose: r.regularMarketPreviousClose,
      currency: r.currency ?? 'USD',
      marketState: r.marketState,
      sparkline: [],
      fetchedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('[Watchlist] Quote fetch failed:', err);
    return [];
  }
}

async function fetchSparkline(symbol: string): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=1d&formatted=false`;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': '*/*' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const closes: number[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return closes.filter((v: number | null) => v !== null) as number[];
  } catch {
    return [];
  }
}

// ============================================================
// MINI SPARKLINE (inline, no external component needed)
// ============================================================

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) {
    return <div className="w-16 h-8 flex items-center justify-center text-text-muted text-[9px]">—</div>;
  }
  return (
    <SparklineChart
      data={data}
      width={64}
      height={28}
      strokeWidth={1.2}
      showGradient
      color={positive ? '#22C55E' : '#EF4444'}
    />
  );
}

// ============================================================
// ADD SYMBOL MODAL
// ============================================================

interface AddSymbolModalProps {
  onAdd: (symbol: string) => void;
  onClose: () => void;
  existingSymbols: string[];
}

function AddSymbolModal({ onAdd, onClose, existingSymbols }: AddSymbolModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = query.trim()
    ? SUGGESTED_SYMBOLS.filter(
        s =>
          !existingSymbols.includes(s.symbol) &&
          (s.symbol.toLowerCase().includes(query.toLowerCase()) ||
           s.name.toLowerCase().includes(query.toLowerCase()))
      )
    : SUGGESTED_SYMBOLS.filter(s => !existingSymbols.includes(s.symbol));

  const groups = [...new Set(filtered.map(s => s.group))];

  const handleCustomAdd = () => {
    const sym = query.trim().toUpperCase();
    if (sym && !existingSymbols.includes(sym)) {
      onAdd(sym);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -8 }}
        transition={{ duration: 0.18 }}
        className="bg-background-surface-solid border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCustomAdd();
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Symbol suchen oder eingeben (z.B. AAPL, EURUSD=X)"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-80">
          {groups.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-muted">
              <p>Kein Vorschlag gefunden.</p>
              {query.trim() && (
                <button
                  onClick={handleCustomAdd}
                  className="mt-2 text-accent-primary hover:underline text-xs"
                >
                  „{query.trim().toUpperCase()}" direkt hinzufügen
                </button>
              )}
            </div>
          ) : (
            groups.map(group => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider bg-background">
                  {group}
                </div>
                {filtered
                  .filter(s => s.group === group)
                  .map(s => (
                    <button
                      key={s.symbol}
                      onClick={() => { onAdd(s.symbol); onClose(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background-surface-hover transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                        <p className="text-xs text-text-muted font-mono">{s.symbol}</p>
                      </div>
                      <span className="text-[10px] font-medium text-text-muted bg-background-elevated px-1.5 py-0.5 rounded">
                        {group.substring(0, 2).toUpperCase()}
                      </span>
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>

        {query.trim() && (
          <div className="border-t border-border px-4 py-3">
            <button
              onClick={handleCustomAdd}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent-primary/10 border border-accent-primary/30 hover:bg-accent-primary/20 text-accent-secondary text-sm transition-colors"
            >
              <Plus size={14} />
              „{query.trim().toUpperCase()}" hinzufügen
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// WATCHLIST ROW
// ============================================================

interface RowProps {
  sym: WatchlistSymbol;
  quote?: QuoteData;
  loading: boolean;
  onRemove: () => void;
  onToggleStar: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  showVolume: boolean;
}

function WatchlistRow({
  sym, quote, loading, onRemove, onToggleStar,
  onDragStart, onDragOver, onDrop, showVolume,
}: RowProps) {
  const [hovered, setHovered] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const positive = (quote?.changePercent ?? 0) >= 0;
  const neutral = !quote?.changePercent;
  const displayName = getDisplayName(sym.symbol, quote);
  const badge = getExchangeBadge(sym.symbol, quote);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver(e); }}
      onDrop={e => { e.preventDefault(); onDrop(e); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowRemoveConfirm(false); }}
      className={clsx(
        'group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-default',
        'border border-transparent',
        hovered ? 'bg-background-surface-hover border-border/50' : 'hover:bg-background-surface-hover',
      )}
    >
      {/* Drag Handle */}
      <div className={clsx('text-text-muted flex-shrink-0 cursor-grab active:cursor-grabbing', hovered ? 'opacity-100' : 'opacity-0')}>
        <GripVertical size={13} />
      </div>

      {/* Star */}
      <button
        onClick={onToggleStar}
        className={clsx(
          'flex-shrink-0 transition-colors',
          sym.starred ? 'text-yellow-400' : 'text-text-muted opacity-0 group-hover:opacity-100',
        )}
      >
        <Star size={11} fill={sym.starred ? 'currentColor' : 'none'} />
      </button>

      {/* Symbol Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-text-primary truncate leading-tight">
            {sym.customName ?? displayName}
          </span>
          <span className="text-[9px] font-medium text-text-muted bg-background-elevated px-1 py-px rounded flex-shrink-0">
            {badge}
          </span>
        </div>
        <div className="text-[10px] text-text-muted font-mono truncate leading-tight">
          {sym.symbol}
        </div>
      </div>

      {/* Sparkline */}
      <div className="flex-shrink-0">
        {loading && !quote ? (
          <div className="w-16 h-7 flex items-center justify-center">
            <div className="w-8 h-0.5 bg-border rounded animate-pulse" />
          </div>
        ) : (
          <MiniSparkline data={quote?.sparkline ?? []} positive={positive} />
        )}
      </div>

      {/* Volume (optional) */}
      {showVolume && (
        <div className="w-12 text-right flex-shrink-0">
          <span className="text-[10px] text-text-muted">{formatVolume(quote?.volume)}</span>
        </div>
      )}

      {/* Price & Change */}
      <div className="flex flex-col items-end flex-shrink-0 w-24">
        {loading && !quote ? (
          <>
            <div className="h-3.5 w-16 bg-border rounded animate-pulse mb-0.5" />
            <div className="h-3 w-12 bg-border/60 rounded animate-pulse" />
          </>
        ) : (
          <>
            <span className={clsx(
              'text-[13px] font-semibold font-mono leading-tight',
              neutral ? 'text-text-primary' : positive ? 'text-pnl-positive' : 'text-pnl-negative',
            )}>
              {quote ? formatPrice(quote.price, sym.symbol) : '—'}
            </span>
            <span className={clsx(
              'text-[11px] font-mono leading-tight',
              neutral ? 'text-text-muted' : positive ? 'text-pnl-positive' : 'text-pnl-negative',
            )}>
              {quote ? (
                <>
                  {positive ? '+' : ''}{quote.changePercent?.toFixed(2)}%
                </>
              ) : '—'}
            </span>
          </>
        )}
      </div>

      {/* Remove Button */}
      <div className={clsx('flex-shrink-0 transition-opacity', hovered ? 'opacity-100' : 'opacity-0')}>
        {showRemoveConfirm ? (
          <button
            onClick={onRemove}
            className="text-pnl-negative hover:text-red-400 transition-colors"
          >
            <Check size={13} />
          </button>
        ) : (
          <button
            onClick={() => setShowRemoveConfirm(true)}
            className="text-text-muted hover:text-pnl-negative transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WATCHLIST NAME EDITOR
// ============================================================

function WatchlistNameEditor({
  name,
  onSave,
  onCancel,
}: { name: string; onSave: (n: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      value={value}
      onChange={e => setValue(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSave(value.trim() || name);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(value.trim() || name)}
      className="bg-background-elevated border border-accent-primary/50 rounded px-2 py-0.5 text-xs text-text-primary outline-none w-24"
    />
  );
}

// ============================================================
// MAIN WATCHLIST PAGE
// ============================================================

export function Watchlist() {
  const [watchlists, setWatchlists] = useState<WatchlistData[]>(loadWatchlists);
  const [activeId, setActiveId] = useState(() => loadWatchlists()[0]?.id ?? '');
  const [prices, setPrices] = useState<Record<string, QuoteData>>(loadCachedPrices);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apiError, setApiError] = useState(false);

  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [showAddWatchlist, setShowAddWatchlist] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [searchFilter, setSearchFilter] = useState('');
  const [showVolume, setShowVolume] = useState(false);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const activeWatchlist = watchlists.find(w => w.id === activeId) ?? watchlists[0];
  const allSymbols = activeWatchlist?.symbols.map(s => s.symbol) ?? [];

  // Persist watchlists
  useEffect(() => {
    saveWatchlists(watchlists);
  }, [watchlists]);

  // Fetch prices + sparklines
  const fetchPrices = useCallback(async (showLoader = false) => {
    if (!allSymbols.length) return;
    if (showLoader) setLoading(true);
    setApiError(false);

    const quotes = await fetchQuotes(allSymbols);
    if (!quotes.length && allSymbols.length > 0) {
      setApiError(true);
      if (showLoader) setLoading(false);
      return;
    }

    const now = Date.now();
    const updated: Record<string, QuoteData> = { ...prices };

    for (const q of quotes) {
      if (!q.symbol) continue;
      const prev = updated[q.symbol];
      updated[q.symbol] = {
        ...q,
        sparkline: prev?.sparkline ?? [],
        fetchedAt: now,
      } as QuoteData;
    }

    // Fetch sparklines (only if older than SPARK_INTERVAL)
    await Promise.all(
      allSymbols.map(async sym => {
        const prev = updated[sym];
        if (!prev || now - (prev.fetchedAt ?? 0) > SPARK_INTERVAL || !prev.sparkline?.length) {
          const spark = await fetchSparkline(sym);
          if (spark.length > 0 && updated[sym]) {
            updated[sym] = { ...updated[sym], sparkline: spark };
          }
        }
      })
    );

    setPrices(updated);
    saveCachedPrices(updated);
    setLastUpdated(new Date());
    if (showLoader) setLoading(false);
  }, [allSymbols, prices]);

  // Initial fetch
  useEffect(() => {
    fetchPrices(true);
  }, [activeId]); // re-fetch when switching watchlists

  // Polling
  useEffect(() => {
    const timer = setInterval(() => fetchPrices(false), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchPrices]);

  // ── Symbol management ─────────────────────────────────────

  const addSymbol = (symbol: string) => {
    setWatchlists(wls =>
      wls.map(wl =>
        wl.id === activeId
          ? { ...wl, symbols: [...wl.symbols, { symbol }] }
          : wl
      )
    );
    // Fetch price for new symbol
    setTimeout(() => fetchPrices(false), 300);
  };

  const removeSymbol = (symbol: string) => {
    setWatchlists(wls =>
      wls.map(wl =>
        wl.id === activeId
          ? { ...wl, symbols: wl.symbols.filter(s => s.symbol !== symbol) }
          : wl
      )
    );
  };

  const toggleStar = (symbol: string) => {
    setWatchlists(wls =>
      wls.map(wl =>
        wl.id === activeId
          ? {
              ...wl,
              symbols: wl.symbols.map(s =>
                s.symbol === symbol ? { ...s, starred: !s.starred } : s
              ),
            }
          : wl
      )
    );
  };

  // ── Drag & Drop reorder ────────────────────────────────────

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragOver = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    setWatchlists(wls =>
      wls.map(wl => {
        if (wl.id !== activeId) return wl;
        const syms = [...wl.symbols];
        const dragged = syms.splice(dragItem.current!, 1)[0];
        syms.splice(dragOverItem.current!, 0, dragged);
        dragItem.current = null;
        dragOverItem.current = null;
        return { ...wl, symbols: syms };
      })
    );
  };

  // ── Watchlist management ──────────────────────────────────

  const addWatchlist = () => {
    const name = newWatchlistName.trim() || `Watchlist ${watchlists.length + 1}`;
    const newWl: WatchlistData = {
      id: crypto.randomUUID(),
      name,
      symbols: [],
    };
    setWatchlists(wls => [...wls, newWl]);
    setActiveId(newWl.id);
    setNewWatchlistName('');
    setShowAddWatchlist(false);
  };

  const removeWatchlist = (id: string) => {
    if (watchlists.length <= 1) return;
    setWatchlists(wls => {
      const updated = wls.filter(w => w.id !== id);
      if (activeId === id) setActiveId(updated[0]?.id ?? '');
      return updated;
    });
  };

  const renameWatchlist = (id: string, name: string) => {
    setWatchlists(wls =>
      wls.map(w => w.id === id ? { ...w, name } : w)
    );
    setEditingWatchlistId(null);
  };

  // ── Sort & filter symbols ──────────────────────────────────

  const sortedSymbols = [...(activeWatchlist?.symbols ?? [])]
    .filter(s =>
      !searchFilter ||
      s.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
      getDisplayName(s.symbol, prices[s.symbol]).toLowerCase().includes(searchFilter.toLowerCase())
    )
    .sort((a, b) => {
      if (sortField === 'symbol') {
        return sortDir === 'asc'
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      }
      const qa = prices[a.symbol];
      const qb = prices[b.symbol];
      const va = qa ? (sortField === 'price' ? qa.price : sortField === 'change' ? qa.change : qa.changePercent) : 0;
      const vb = qb ? (sortField === 'price' ? qb.price : sortField === 'change' ? qb.change : qb.changePercent) : 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // ── Market overview stats ──────────────────────────────────
  const allQuotes = Object.values(prices);
  const up = allQuotes.filter(q => q.changePercent > 0).length;
  const down = allQuotes.filter(q => q.changePercent < 0).length;

  // ── Time formatting ────────────────────────────────────────
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <PageTransition className="h-full flex flex-col">
      <div className="flex flex-col h-full bg-background">

        {/* ── Page Header ──────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
                <List size={16} className="text-accent-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary leading-tight">Watchlist</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {timeStr && (
                    <div className="flex items-center gap-1 text-[11px] text-text-muted">
                      <Clock size={10} />
                      <span>{timeStr}</span>
                    </div>
                  )}
                  {apiError && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-400">
                      <AlertCircle size={10} />
                      <span>API nicht erreichbar – Cache</span>
                    </div>
                  )}
                  {!apiError && up > 0 && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-pnl-positive flex items-center gap-0.5">
                        <TrendingUp size={10} /> {up}
                      </span>
                      <span className="text-pnl-negative flex items-center gap-0.5">
                        <TrendingDown size={10} /> {down}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVolume(v => !v)}
                className={clsx(
                  'text-[11px] px-2.5 py-1 rounded-lg border transition-colors',
                  showVolume
                    ? 'bg-accent-primary/15 border-accent-primary/40 text-accent-secondary'
                    : 'border-border text-text-muted hover:text-text-primary hover:border-border-light'
                )}
              >
                Vol
              </button>
              <button
                onClick={() => fetchPrices(true)}
                disabled={loading}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-border text-text-muted hover:text-text-primary hover:border-border-light transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Aktualisieren
              </button>
              <button
                onClick={() => setShowAddSymbol(true)}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-accent-primary/10 border border-accent-primary/30 text-accent-secondary hover:bg-accent-primary/20 transition-colors"
              >
                <Plus size={12} />
                Symbol
              </button>
            </div>
          </div>

          {/* Watchlist Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {watchlists.map(wl => (
              <div key={wl.id} className="flex-shrink-0 group/tab relative">
                {editingWatchlistId === wl.id ? (
                  <WatchlistNameEditor
                    name={wl.name}
                    onSave={name => renameWatchlist(wl.id, name)}
                    onCancel={() => setEditingWatchlistId(null)}
                  />
                ) : (
                  <button
                    onClick={() => setActiveId(wl.id)}
                    onDoubleClick={() => setEditingWatchlistId(wl.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                      activeId === wl.id
                        ? 'bg-accent-primary/15 border border-accent-primary/40 text-accent-secondary'
                        : 'text-text-muted hover:text-text-primary hover:bg-background-surface-hover border border-transparent'
                    )}
                  >
                    {wl.name}
                    <span className="text-[10px] opacity-60">
                      {wl.symbols.length}
                    </span>
                  </button>
                )}
                {watchlists.length > 1 && (
                  <button
                    onClick={() => removeWatchlist(wl.id)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-background-elevated border border-border text-text-muted hover:text-pnl-negative flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity"
                  >
                    <X size={8} />
                  </button>
                )}
              </div>
            ))}

            {/* Add Watchlist */}
            {showAddWatchlist ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input
                  autoFocus
                  value={newWatchlistName}
                  onChange={e => setNewWatchlistName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addWatchlist();
                    if (e.key === 'Escape') { setShowAddWatchlist(false); setNewWatchlistName(''); }
                  }}
                  onBlur={() => { if (!newWatchlistName.trim()) { setShowAddWatchlist(false); } }}
                  placeholder="Name..."
                  className="bg-background-elevated border border-accent-primary/50 rounded px-2 py-1 text-xs text-text-primary outline-none w-24"
                />
                <button onClick={addWatchlist} className="text-pnl-positive">
                  <Check size={13} />
                </button>
                <button onClick={() => { setShowAddWatchlist(false); setNewWatchlistName(''); }} className="text-text-muted">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddWatchlist(true)}
                className="flex-shrink-0 w-6 h-6 rounded-lg border border-dashed border-border hover:border-accent-primary/50 text-text-muted hover:text-accent-primary flex items-center justify-center transition-colors"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Search + Column Headers ───────────────────────── */}
        <div className="flex-shrink-0 px-3 pt-2 pb-1">
          {/* Search Filter */}
          <div className="relative mb-2">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter..."
              className="w-full pl-7 pr-8 py-1.5 bg-background-surface border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-primary/50 transition-colors"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Column Headers */}
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-4 flex-shrink-0" />
            <div className="w-3 flex-shrink-0" />
            <button
              onClick={() => handleSort('symbol')}
              className="flex-1 flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors text-left uppercase tracking-wider"
            >
              Symbol {sortField === 'symbol' && <ChevronDown size={9} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
            </button>
            {/* Sparkline header */}
            <div className="w-16 flex-shrink-0" />
            {showVolume && <div className="w-12 text-[10px] font-medium text-text-muted uppercase tracking-wider text-right flex-shrink-0">Vol</div>}
            <button
              onClick={() => handleSort('changePercent')}
              className="w-24 flex items-center justify-end gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors uppercase tracking-wider flex-shrink-0"
            >
              {sortField === 'changePercent' && <ChevronDown size={9} className={sortDir === 'desc' ? 'rotate-180' : ''} />}
              Letzte / Chg%
            </button>
            <div className="w-4 flex-shrink-0" />
          </div>
        </div>

        {/* ── Symbol List ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sortedSymbols.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-10 h-10 rounded-xl bg-background-elevated border border-border flex items-center justify-center">
                <List size={20} className="text-text-muted" />
              </div>
              <p className="text-sm text-text-muted text-center">
                {searchFilter ? 'Kein Symbol gefunden' : 'Watchlist ist leer'}
              </p>
              {!searchFilter && (
                <button
                  onClick={() => setShowAddSymbol(true)}
                  className="flex items-center gap-2 text-sm text-accent-secondary hover:text-accent-primary transition-colors"
                >
                  <Plus size={14} />
                  Symbol hinzufügen
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              <AnimatePresence mode="popLayout">
                {sortedSymbols.map((sym, idx) => {
                  const originalIdx = activeWatchlist?.symbols.findIndex(s => s.symbol === sym.symbol) ?? idx;
                  return (
                    <motion.div
                      key={sym.symbol}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                    >
                      <WatchlistRow
                        sym={sym}
                        quote={prices[sym.symbol]}
                        loading={loading}
                        showVolume={showVolume}
                        onRemove={() => removeSymbol(sym.symbol)}
                        onToggleStar={() => toggleStar(sym.symbol)}
                        onDragStart={() => handleDragStart(originalIdx)}
                        onDragOver={() => handleDragOver(originalIdx)}
                        onDrop={handleDrop}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-border px-4 py-2 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            {sortedSymbols.length} Symbol{sortedSymbols.length !== 1 ? 'e' : ''}
          </span>
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="text-pnl-positive">{up} ↑</span>
            <span className="text-pnl-negative">{down} ↓</span>
            <span className="text-text-muted">{allQuotes.filter(q => q.changePercent === 0).length} =</span>
          </div>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddSymbol && (
          <AddSymbolModal
            onAdd={addSymbol}
            onClose={() => setShowAddSymbol(false)}
            existingSymbols={activeWatchlist?.symbols.map(s => s.symbol) ?? []}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
