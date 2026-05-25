/**
 * ========================================================================
 * Trading Journal - Watchlist Store (Zustand)
 * ========================================================================
 * Verwaltet Watchlists, Symbole, Abschnitte, Farblabels und Intervallalarme.
 * Primärspeicher: localStorage. Sekundär: Supabase (Sync beim Login).
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// ============================================================
// CONSTANTS
// ============================================================

export const WATCHLIST_COLORS = [
  { name: 'Kein',   value: undefined },
  { name: 'Rot',    value: '#F23645' },
  { name: 'Orange', value: '#FF9800' },
  { name: 'Gelb',   value: '#FFD700' },
  { name: 'Grün',   value: '#089981' },
  { name: 'Cyan',   value: '#00BCD4' },
  { name: 'Blau',   value: '#2962FF' },
  { name: 'Lila',   value: '#9C27B0' },
  { name: 'Pink',   value: '#E91E63' },
  { name: 'Grau',   value: '#787B86' },
] as const;

const STORAGE_KEY    = 'tradingJournal_watchlists_v2';
const LABELS_KEY     = 'tradingJournal_colorLabels';
const DASH_COLOR_KEY = 'tradingJournal_dashboardColor';

// ============================================================
// TYPES
// ============================================================

export interface WatchlistAlert {
  id: string;
  type: 'once' | 'daily' | 'weekly';
  time: string;           // "HH:MM"
  date?: string;          // ISO date "YYYY-MM-DD" for 'once'
  weekDays?: number[];    // 0=Mo, 1=Di, ..., 6=So for 'weekly'
  label?: string;
  active: boolean;
  lastTriggeredDate?: string; // "YYYY-MM-DD" – prevents double-firing per day
}

// ── Pair status & detail types ──────────────────────────────

export type PairStatus = 'active' | 'watching' | 'waiting' | 'executed' | 'inactive';
export type PairBias   = 'bullish' | 'bearish' | 'neutral';
export type LevelType  = 'support' | 'resistance' | 'entry' | 'target' | 'stopLoss' | 'gva' | 'custom';

export const PAIR_STATUS_CONFIG: Record<PairStatus, { label: string; color: string; bg: string }> = {
  active:   { label: 'Aktiv',      color: '#22C55E', bg: 'rgba(34,197,94,0.14)' },
  watching: { label: 'Beobachten', color: '#06B6D4', bg: 'rgba(6,182,212,0.14)' },
  waiting:  { label: 'Wartend',    color: '#F59E0B', bg: 'rgba(245,158,11,0.14)' },
  executed: { label: 'Ausgeführt', color: '#8B5CF6', bg: 'rgba(139,92,246,0.14)' },
  inactive: { label: 'Inaktiv',    color: '#52525B', bg: 'rgba(82,82,91,0.10)' },
};

export const LEVEL_TYPE_CONFIG: Record<LevelType, { label: string; color: string }> = {
  support:    { label: 'Support',    color: '#22C55E' },
  resistance: { label: 'Resistance', color: '#EF4444' },
  entry:      { label: 'Entry',      color: '#8B5CF6' },
  target:     { label: 'Target',     color: '#06B6D4' },
  stopLoss:   { label: 'Stop Loss',  color: '#FF5722' },
  gva:        { label: 'GVA',        color: '#FFD700' },
  custom:     { label: 'Custom',     color: '#787B86' },
};

export interface PairLevel {
  id: string;
  price: number;
  label: string;
  type: LevelType;
}

export interface PairImage {
  id: string;
  dataUrl: string;    // base64 JPEG thumbnail
  caption: string;
  timeframe?: string; // e.g. 'H4', 'D1'
  createdAt: string;
}

export interface WatchlistSymbol {
  id: string;
  symbol: string;        // e.g. "EURUSD"
  displayName: string;   // e.g. "EUR/USD"
  category: 'forex' | 'crypto' | 'futures' | 'indices';
  color?: string;        // hex colour or undefined
  alerts: WatchlistAlert[];
  addedAt: number;
  sectionId?: string;    // which section this symbol belongs to
  // ── Outlook / Detail fields ──
  status?: PairStatus;
  bias?: PairBias;
  notes?: string;
  levels?: PairLevel[];
  images?: PairImage[];
}

export interface WatchlistSection {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: WatchlistSymbol[];
  sections: WatchlistSection[];
  createdAt: number;
}

// ============================================================
// PERSISTENCE HELPERS
// ============================================================

function load(): Watchlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: Watchlist[] = raw ? JSON.parse(raw) : [];
    // migration: ensure every watchlist has `sections` field
    return data.map(w => ({ ...w, sections: w.sections ?? [] }));
  } catch {
    return [];
  }
}

function persist(data: Watchlist[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

function loadColorLabels(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LABELS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function persistColorLabels(labels: Record<string, string>): void {
  try { localStorage.setItem(LABELS_KEY, JSON.stringify(labels)); } catch { /* ignore */ }
}

function loadDashboardColor(): string | undefined {
  try { return localStorage.getItem(DASH_COLOR_KEY) ?? undefined; } catch { return undefined; }
}

function persistDashboardColor(color: string | undefined): void {
  try {
    if (color) localStorage.setItem(DASH_COLOR_KEY, color);
    else localStorage.removeItem(DASH_COLOR_KEY);
  } catch { /* ignore */ }
}

function genId(): string {
  return (crypto as Crypto & { randomUUID?: () => string }).randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ============================================================
// SUPABASE SYNC
// ============================================================

async function syncUp(
  watchlists: Watchlist[],
  colorLabels: Record<string, string>,
  dashboardColor: string | undefined
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_watchlists').upsert(
      { user_id: user.id, watchlists, color_labels: colorLabels, dashboard_color: dashboardColor ?? null },
      { onConflict: 'user_id' }
    );
  } catch { /* fire-and-forget */ }
}

export async function loadWatchlistsFromSupabase(): Promise<{
  watchlists: Watchlist[];
  colorLabels: Record<string, string>;
  dashboardColor: string | undefined;
} | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_watchlists')
      .select('watchlists, color_labels, dashboard_color')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) return null;
    const watchlists = ((data.watchlists as Watchlist[]) ?? []).map(w => ({ ...w, sections: w.sections ?? [] }));
    return {
      watchlists,
      colorLabels:    (data.color_labels as Record<string, string>) ?? {},
      dashboardColor: (data.dashboard_color as string | null) ?? undefined,
    };
  } catch { return null; }
}

// ============================================================
// STORE
// ============================================================

interface WatchlistState {
  watchlists: Watchlist[];
  activeId: string | null;

  // Color labels
  colorLabels: Record<string, string>;   // { "#F23645": "Kein Setup", ... }
  dashboardColor: string | undefined;    // symbols with this color appear in Dashboard widget

  // Watchlist management
  createWatchlist:    (name: string) => void;
  deleteWatchlist:    (id: string) => void;
  renameWatchlist:    (id: string, name: string) => void;
  setActiveId:        (id: string) => void;

  // Symbol management
  addSymbol:          (watchlistId: string, data: Omit<WatchlistSymbol, 'id' | 'addedAt' | 'alerts'>) => void;
  removeSymbol:       (watchlistId: string, symbolId: string) => void;
  updateSymbolColor:  (watchlistId: string, symbolId: string, color: string | undefined) => void;
  reorderSymbols:     (watchlistId: string, fromIdx: number, toIdx: number) => void;
  setSymbolSection:   (watchlistId: string, symbolId: string, sectionId: string | undefined) => void;

  // Section management
  createSection:      (watchlistId: string, name: string) => void;
  deleteSection:      (watchlistId: string, sectionId: string) => void;
  renameSection:      (watchlistId: string, sectionId: string, name: string) => void;
  toggleSection:      (watchlistId: string, sectionId: string) => void;

  // Alert management
  addAlert:           (watchlistId: string, symbolId: string, alert: Omit<WatchlistAlert, 'id'>) => void;
  updateAlert:        (watchlistId: string, symbolId: string, alertId: string, updates: Partial<WatchlistAlert>) => void;
  removeAlert:        (watchlistId: string, symbolId: string, alertId: string) => void;
  markAlertTriggered: (watchlistId: string, symbolId: string, alertId: string, date: string) => void;

  // Symbol detail (status / bias / notes / levels / images)
  updateSymbolDetail: (watchlistId: string, symbolId: string, patch: Partial<Pick<WatchlistSymbol, 'status' | 'bias' | 'notes'>>) => void;
  addPairLevel:       (watchlistId: string, symbolId: string, level: Omit<PairLevel, 'id'>) => void;
  removePairLevel:    (watchlistId: string, symbolId: string, levelId: string) => void;
  updatePairLevel:    (watchlistId: string, symbolId: string, levelId: string, patch: Partial<Omit<PairLevel, 'id'>>) => void;
  addPairImage:       (watchlistId: string, symbolId: string, image: Omit<PairImage, 'id'>) => void;
  removePairImage:    (watchlistId: string, symbolId: string, imageId: string) => void;

  // Color label management
  setColorLabel:      (colorValue: string | undefined, label: string) => void;
  setDashboardColor:  (colorValue: string | undefined) => void;

  // Supabase sync
  loadFromSupabase:   () => Promise<void>;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => {
  const withPersist = (fn: (state: WatchlistState) => Partial<WatchlistState>) =>
    set(state => {
      const updates = fn(state);
      const nextWatchlists  = updates.watchlists  ?? state.watchlists;
      const nextColorLabels = updates.colorLabels ?? state.colorLabels;
      const nextDashColor   = 'dashboardColor' in updates ? updates.dashboardColor : state.dashboardColor;
      persist(nextWatchlists);
      if (updates.colorLabels)         persistColorLabels(nextColorLabels);
      if ('dashboardColor' in updates) persistDashboardColor(nextDashColor);
      syncUp(nextWatchlists, nextColorLabels, nextDashColor);
      return updates;
    });

  const initial       = load();
  const initLabels    = loadColorLabels();
  const initDashColor = loadDashboardColor();

  return {
    watchlists:     initial,
    activeId:       initial[0]?.id ?? null,
    colorLabels:    initLabels,
    dashboardColor: initDashColor,

    // ── Watchlist management ───────────────────────────────────

    createWatchlist: (name) => {
      const wl: Watchlist = { id: genId(), name, symbols: [], sections: [], createdAt: Date.now() };
      withPersist(s => {
        const watchlists = [...s.watchlists, wl];
        return { watchlists, activeId: wl.id };
      });
    },

    deleteWatchlist: (id) => {
      withPersist(s => {
        const watchlists = s.watchlists.filter(w => w.id !== id);
        return { watchlists, activeId: watchlists[0]?.id ?? null };
      });
    },

    renameWatchlist: (id, name) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w => w.id === id ? { ...w, name } : w),
      }));
    },

    setActiveId: (id) => set({ activeId: id }),

    // ── Symbol management ──────────────────────────────────────

    addSymbol: (watchlistId, data) => {
      const sym: WatchlistSymbol = { ...data, id: genId(), alerts: [], addedAt: Date.now() };
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId ? { ...w, symbols: [...w.symbols, sym] } : w
        ),
      }));
    },

    removeSymbol: (watchlistId, symbolId) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? { ...w, symbols: w.symbols.filter(sym => sym.id !== symbolId) }
            : w
        ),
      }));
    },

    updateSymbolColor: (watchlistId, symbolId, color) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? { ...w, symbols: w.symbols.map(sym => sym.id === symbolId ? { ...sym, color } : sym) }
            : w
        ),
      }));
    },

    reorderSymbols: (watchlistId, fromIdx, toIdx) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w => {
          if (w.id !== watchlistId) return w;
          const syms = [...w.symbols];
          const [item] = syms.splice(fromIdx, 1);
          syms.splice(toIdx, 0, item);
          return { ...w, symbols: syms };
        }),
      }));
    },

    setSymbolSection: (watchlistId, symbolId, sectionId) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? { ...w, symbols: w.symbols.map(sym => sym.id === symbolId ? { ...sym, sectionId } : sym) }
            : w
        ),
      }));
    },

    // ── Section management ─────────────────────────────────────

    createSection: (watchlistId, name) => {
      const section: WatchlistSection = { id: genId(), name, collapsed: false };
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId ? { ...w, sections: [...(w.sections ?? []), section] } : w
        ),
      }));
    },

    deleteSection: (watchlistId, sectionId) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w => {
          if (w.id !== watchlistId) return w;
          return {
            ...w,
            sections: (w.sections ?? []).filter(sec => sec.id !== sectionId),
            symbols:  w.symbols.map(sym =>
              sym.sectionId === sectionId ? { ...sym, sectionId: undefined } : sym
            ),
          };
        }),
      }));
    },

    renameSection: (watchlistId, sectionId, name) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? { ...w, sections: (w.sections ?? []).map(sec => sec.id === sectionId ? { ...sec, name } : sec) }
            : w
        ),
      }));
    },

    toggleSection: (watchlistId, sectionId) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? { ...w, sections: (w.sections ?? []).map(sec => sec.id === sectionId ? { ...sec, collapsed: !sec.collapsed } : sec) }
            : w
        ),
      }));
    },

    // ── Alert management ───────────────────────────────────────

    addAlert: (watchlistId, symbolId, alertData) => {
      const alert: WatchlistAlert = { ...alertData, id: genId() };
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? {
                ...w,
                symbols: w.symbols.map(sym =>
                  sym.id === symbolId ? { ...sym, alerts: [...sym.alerts, alert] } : sym
                ),
              }
            : w
        ),
      }));
    },

    updateAlert: (watchlistId, symbolId, alertId, updates) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? {
                ...w,
                symbols: w.symbols.map(sym =>
                  sym.id === symbolId
                    ? { ...sym, alerts: sym.alerts.map(a => a.id === alertId ? { ...a, ...updates } : a) }
                    : sym
                ),
              }
            : w
        ),
      }));
    },

    removeAlert: (watchlistId, symbolId, alertId) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? {
                ...w,
                symbols: w.symbols.map(sym =>
                  sym.id === symbolId
                    ? { ...sym, alerts: sym.alerts.filter(a => a.id !== alertId) }
                    : sym
                ),
              }
            : w
        ),
      }));
    },

    markAlertTriggered: (watchlistId, symbolId, alertId, date) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id === watchlistId
            ? {
                ...w,
                symbols: w.symbols.map(sym =>
                  sym.id === symbolId
                    ? {
                        ...sym,
                        alerts: sym.alerts.map(a =>
                          a.id === alertId
                            ? { ...a, lastTriggeredDate: date, ...(a.type === 'once' ? { active: false } : {}) }
                            : a
                        ),
                      }
                    : sym
                ),
              }
            : w
        ),
      }));
    },

    // ── Symbol detail management ───────────────────────────────

    updateSymbolDetail: (watchlistId, symbolId, patch) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id !== watchlistId ? w : {
            ...w, symbols: w.symbols.map(sym =>
              sym.id === symbolId ? { ...sym, ...patch } : sym
            ),
          }
        ),
      }));
    },

    addPairLevel: (watchlistId, symbolId, level) => {
      const newLevel: PairLevel = { ...level, id: genId() };
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id !== watchlistId ? w : {
            ...w, symbols: w.symbols.map(sym =>
              sym.id !== symbolId ? sym : { ...sym, levels: [...(sym.levels ?? []), newLevel] }
            ),
          }
        ),
      }));
    },

    removePairLevel: (watchlistId, symbolId, levelId) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id !== watchlistId ? w : {
            ...w, symbols: w.symbols.map(sym =>
              sym.id !== symbolId ? sym : { ...sym, levels: (sym.levels ?? []).filter(l => l.id !== levelId) }
            ),
          }
        ),
      }));
    },

    updatePairLevel: (watchlistId, symbolId, levelId, patch) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id !== watchlistId ? w : {
            ...w, symbols: w.symbols.map(sym =>
              sym.id !== symbolId ? sym : {
                ...sym,
                levels: (sym.levels ?? []).map(l => l.id === levelId ? { ...l, ...patch } : l),
              }
            ),
          }
        ),
      }));
    },

    addPairImage: (watchlistId, symbolId, image) => {
      const newImage: PairImage = { ...image, id: genId() };
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id !== watchlistId ? w : {
            ...w, symbols: w.symbols.map(sym =>
              sym.id !== symbolId ? sym : { ...sym, images: [...(sym.images ?? []), newImage] }
            ),
          }
        ),
      }));
    },

    removePairImage: (watchlistId, symbolId, imageId) => {
      withPersist(s => ({
        watchlists: s.watchlists.map(w =>
          w.id !== watchlistId ? w : {
            ...w, symbols: w.symbols.map(sym =>
              sym.id !== symbolId ? sym : { ...sym, images: (sym.images ?? []).filter(i => i.id !== imageId) }
            ),
          }
        ),
      }));
    },

    // ── Color label management ─────────────────────────────────

    setColorLabel: (colorValue, label) => {
      if (colorValue === undefined) return;
      withPersist(s => {
        const next = { ...s.colorLabels };
        if (label.trim()) next[colorValue] = label.trim();
        else delete next[colorValue];
        return { colorLabels: next };
      });
    },

    setDashboardColor: (colorValue) => {
      withPersist(() => ({ dashboardColor: colorValue }));
    },

    // ── Supabase sync ──────────────────────────────────────────

    loadFromSupabase: async () => {
      const cloud = await loadWatchlistsFromSupabase();
      if (!cloud) return;
      persist(cloud.watchlists);
      persistColorLabels(cloud.colorLabels);
      persistDashboardColor(cloud.dashboardColor);
      set({
        watchlists:     cloud.watchlists,
        activeId:       get().activeId ?? cloud.watchlists[0]?.id ?? null,
        colorLabels:    cloud.colorLabels,
        dashboardColor: cloud.dashboardColor,
      });
    },
  };
});

// ============================================================
// ALERT CHECKER UTILITY (called from App.tsx every minute)
// ============================================================

export function checkAndFireAlerts(
  watchlists: Watchlist[],
  markTriggered: (wlId: string, symId: string, alertId: string, date: string) => void,
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
): void {
  const now   = new Date();
  const today = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const hhmm  = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  // JS: 0=Su,1=Mo,...6=Sa  → convert to 0=Mo..6=Su
  const jsDow = now.getDay();
  const dow   = jsDow === 0 ? 6 : jsDow - 1; // 0=Mo, 6=Su

  for (const wl of watchlists) {
    for (const sym of wl.symbols) {
      for (const alert of sym.alerts) {
        if (!alert.active) continue;
        if (alert.time !== hhmm) continue;
        if (alert.lastTriggeredDate === today) continue;

        let shouldFire = false;
        if (alert.type === 'daily') {
          shouldFire = true;
        } else if (alert.type === 'weekly') {
          shouldFire = (alert.weekDays ?? []).includes(dow);
        } else if (alert.type === 'once') {
          shouldFire = alert.date === today;
        }

        if (shouldFire) {
          const title = `Watchlist-Alarm: ${sym.displayName}`;
          const body  = alert.label || `${sym.displayName} – ${alert.time} Uhr`;

          // Try browser notification first, fallback to in-app toast
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(title, { body, icon: '/favicon.ico' });
            } else {
              showToast?.(`${title}: ${body}`, 'info');
            }
          } catch {
            showToast?.(`${title}: ${body}`, 'info');
          }

          markTriggered(wl.id, sym.id, alert.id, today);
        }
      }
    }
  }
}
