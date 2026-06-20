/**
 * Widget Settings Store
 * Persistiert Dashboard-Widget-Konfigurationen lokal (localStorage) + Supabase.
 */
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────

export interface COTWidgetSettings {
  currencies: string[]; // Welche Währungen anzeigen
}

export interface ZinsenWidgetSettings {
  currencies: string[]; // Welche Währungen anzeigen
}

export interface NewsWidgetSettings {
  currencies: string[];              // [] = alle Währungen
  impact: 'high' | 'medium' | 'all';
}

export interface WidgetSettings {
  cot:    COTWidgetSettings;
  zinsen: ZinsenWidgetSettings;
  news:   NewsWidgetSettings;
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  cot:    { currencies: ['DXY', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'] },
  zinsen: { currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD'] },
  news:   { currencies: [], impact: 'high' },
};

// ── Persistence helpers ────────────────────────────────────────────────

const STORAGE_KEY = 'tradingJournal_widgetSettings_v1';

function loadFromStorage(): WidgetSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WidgetSettings>;
    return {
      cot:    { ...DEFAULT_WIDGET_SETTINGS.cot,    ...(parsed.cot    ?? {}) },
      zinsen: { ...DEFAULT_WIDGET_SETTINGS.zinsen, ...(parsed.zinsen ?? {}) },
      news:   { ...DEFAULT_WIDGET_SETTINGS.news,   ...(parsed.news   ?? {}) },
    };
  } catch {
    return DEFAULT_WIDGET_SETTINGS;
  }
}

function saveToStorage(s: WidgetSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ── Supabase sync ──────────────────────────────────────────────────────

async function syncUp(settings: WidgetSettings) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_widget_settings').upsert(
      { user_id: user.id, settings },
      { onConflict: 'user_id' }
    );
  } catch { /* fire-and-forget */ }
}

async function loadFromSupabaseDB(): Promise<WidgetSettings | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_widget_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) return null;
    const remote = data.settings as Partial<WidgetSettings>;
    return {
      cot:    { ...DEFAULT_WIDGET_SETTINGS.cot,    ...(remote.cot    ?? {}) },
      zinsen: { ...DEFAULT_WIDGET_SETTINGS.zinsen, ...(remote.zinsen ?? {}) },
      news:   { ...DEFAULT_WIDGET_SETTINGS.news,   ...(remote.news   ?? {}) },
    };
  } catch {
    return null;
  }
}

// ── Store ──────────────────────────────────────────────────────────────

interface WidgetSettingsStore {
  settings: WidgetSettings;
  updateCOT:    (patch: Partial<COTWidgetSettings>)    => void;
  updateZinsen: (patch: Partial<ZinsenWidgetSettings>) => void;
  updateNews:   (patch: Partial<NewsWidgetSettings>)   => void;
  loadFromSupabase: () => Promise<void>;
}

export const useWidgetSettingsStore = create<WidgetSettingsStore>((set, get) => ({
  settings: loadFromStorage(),

  updateCOT: (patch) => {
    const s = { ...get().settings, cot: { ...get().settings.cot, ...patch } };
    set({ settings: s });
    saveToStorage(s);
    syncUp(s);
  },

  updateZinsen: (patch) => {
    const s = { ...get().settings, zinsen: { ...get().settings.zinsen, ...patch } };
    set({ settings: s });
    saveToStorage(s);
    syncUp(s);
  },

  updateNews: (patch) => {
    const s = { ...get().settings, news: { ...get().settings.news, ...patch } };
    set({ settings: s });
    saveToStorage(s);
    syncUp(s);
  },

  loadFromSupabase: async () => {
    const remote = await loadFromSupabaseDB();
    if (remote) {
      set({ settings: remote });
      saveToStorage(remote);
    }
  },
}));
