/**
 * ========================================================================
 * Trading Journal - Dashboard
 * ========================================================================
 * Anpassbares Bento-Grid: Widgets ein-/ausblendbar über Einstellungen.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import {
  Calendar, Plus, Printer, Download, TrendingUp,
  SlidersHorizontal, X, Check, Target, Star,
  List, Globe2, Newspaper, BarChart2, Percent, Bell, Settings2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTradeStore } from '@/stores/tradeStore';
import { useAccountStore } from '@/stores/accountStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useOutlookStore } from '@/stores/outlookStore';
import { useUIStore } from '@/stores/uiStore';
import { supabase } from '@/lib/supabase';
import { generateReportHTML, printReport, saveReportAsHTML } from '@/utils/reportGenerator';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { BentoGrid, BentoCell } from '@/components/ui/BentoGrid';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { Heatmap, type HeatmapDay } from '@/components/ui/Heatmap';
import { TradeStreak } from '@/components/ui/TradeStreak';
import { TradeRow } from '@/components/ui/TradeRow';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SparklineChart } from '@/components/ui/SparklineChart';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { OUTLOOK_STATUS_CONFIG } from '@/types';
import { useWidgetSettingsStore, DEFAULT_WIDGET_SETTINGS } from '@/stores/widgetSettingsStore';

// ── Dashboard-Präferenzen (localStorage) ──────────────────────────────
const PREFS_KEY = 'tradingJournal_dashboardPrefs';

interface DashboardPrefs {
  showWinRate:          boolean;
  showSparkline:        boolean;
  showProfitLoss:       boolean;
  showProfitFactor:     boolean;
  showStreak:           boolean;
  showRecentTrades:     boolean;
  showHeatmap:          boolean;
  showDetails:          boolean;
  showOutlooks:         boolean;
  showMonthCalendar:    boolean;
  showWidgetUebersicht: boolean;
  showWidgetNews:       boolean;
  showWidgetCOT:        boolean;
  showWidgetZinsen:     boolean;
}

const DEFAULT_PREFS: DashboardPrefs = {
  showWinRate:          true,
  showSparkline:        true,
  showProfitLoss:       true,
  showProfitFactor:     true,
  showStreak:           true,
  showRecentTrades:     true,
  showHeatmap:          true,
  showDetails:          true,
  showOutlooks:         true,
  showMonthCalendar:    true,
  showWidgetUebersicht: false,
  showWidgetNews:       false,
  showWidgetCOT:        false,
  showWidgetZinsen:     false,
};

const PREF_LABELS: Record<keyof DashboardPrefs, string> = {
  showWinRate:          'Win Rate',
  showSparkline:        'Total R Kurve',
  showProfitLoss:       'Gewinn / Verlust',
  showProfitFactor:     'Profit Factor & Expectancy',
  showStreak:           'Trade Streak',
  showRecentTrades:     'Letzte Trades',
  showHeatmap:          'Aktivitäts-Heatmap',
  showDetails:          'Performance Details',
  showOutlooks:         'Aktive Outlooks',
  showMonthCalendar:    'Monats-Kalender',
  showWidgetUebersicht: 'Markt: Übersicht',
  showWidgetNews:       'Markt: News',
  showWidgetCOT:        'Markt: COT',
  showWidgetZinsen:     'Markt: Zinsen',
};

function loadPrefs(): DashboardPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch { return DEFAULT_PREFS; }
}
function savePrefs(p: DashboardPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

async function loadPrefsFromSupabase(): Promise<DashboardPrefs | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (data?.preferences?.dashboardPrefs) {
      return { ...DEFAULT_PREFS, ...data.preferences.dashboardPrefs };
    }
  } catch { /* ignore, fallback to localStorage */ }
  return null;
}

async function savePrefsToSupabase(p: DashboardPrefs): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const userId = session.user.id;
    // Merge with existing preferences so we don't overwrite other keys
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();
    const merged = { ...(existing?.preferences ?? {}), dashboardPrefs: p };
    await supabase
      .from('user_preferences')
      .upsert({ user_id: userId, preferences: merged }, { onConflict: 'user_id' });
  } catch { /* ignore, prefs already saved to localStorage */ }
}

// ── Monatskalender-Komponente ──────────────────────────────────────────
function MonthCalendar({ heatmapData }: { heatmapData: HeatmapDay[] }) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = new Date(year, month, 1).getDay(); // 0=So
  const startOffset = (firstDow + 6) % 7;               // Mo=0

  const dayData = new Map(heatmapData.map(d => [d.date, d]));
  const HEADS   = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {HEADS.map(h => (
          <div key={h} className="text-center text-[9px] font-semibold text-text-muted">{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day     = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const data    = dayData.get(dateStr);
          const isToday = day === now.getDate();

          return (
            <div
              key={day}
              className={clsx(
                'rounded text-center py-0.5 px-0.5',
                data
                  ? data.value > 0 ? 'bg-pnl-positive/15' : data.value < 0 ? 'bg-pnl-negative/15' : 'bg-accent-gold/15'
                  : 'bg-white/[0.02]',
                isToday && 'ring-1 ring-accent-primary ring-offset-0'
              )}
            >
              <div className={clsx(
                'text-[10px] font-mono leading-none',
                isToday ? 'text-accent-primary font-bold' :
                data ? (data.value > 0 ? 'text-pnl-positive' : data.value < 0 ? 'text-pnl-negative' : 'text-accent-gold') :
                'text-text-muted/40'
              )}>
                {day}
              </div>
              {data && (
                <div className="text-[7px] tabular-nums leading-none mt-0.5 opacity-80">
                  {data.value > 0 ? '+' : ''}{data.value.toFixed(1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Widget-Customizer Panel ────────────────────────────────────────────
function WidgetCustomizer({
  prefs, onChange, onClose, dashboardBg, onBgChange,
}: {
  prefs: DashboardPrefs;
  onChange: (p: DashboardPrefs) => void;
  onClose: () => void;
  dashboardBg: string | null;
  onBgChange: (bg: string | null) => void;
}) {
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const maxW = 1920;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        onBgChange(compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-4 top-16 z-40 w-64 bg-[#0d0f14] border border-white/[0.08] rounded-xl shadow-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-text-primary">Dashboard anpassen</span>
        <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary rounded transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Background Image */}
      <div className="mb-3 pb-3 border-b border-white/[0.06]">
        <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">Hintergrundbild</span>
        <div className="flex items-center gap-2 mt-1.5">
          <input ref={bgInputRef} type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
          <button
            onClick={() => bgInputRef.current?.click()}
            className="text-[10px] px-2 py-1 rounded bg-white/[0.06] text-text-muted hover:text-text-primary hover:bg-white/[0.1] transition-colors"
          >
            {dashboardBg ? 'Ändern' : 'Bild wählen'}
          </button>
          {dashboardBg && (
            <button
              onClick={() => onBgChange(null)}
              className="text-[10px] px-2 py-1 rounded bg-pnl-negative/10 text-pnl-negative hover:bg-pnl-negative/20 transition-colors"
            >
              Entfernen
            </button>
          )}
        </div>
        {dashboardBg && (
          <img src={dashboardBg} alt="" className="mt-1.5 w-full h-12 object-cover rounded border border-white/[0.06]" />
        )}
      </div>

      <div className="space-y-1">
        {(Object.keys(DEFAULT_PREFS) as (keyof DashboardPrefs)[]).map(key => (
          <label key={key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors">
            <div
              onClick={() => onChange({ ...prefs, [key]: !prefs[key] })}
              className={clsx(
                'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors',
                prefs[key] ? 'bg-accent-primary' : 'bg-white/[0.06] border border-white/[0.1]'
              )}
            >
              {prefs[key] && <Check size={10} className="text-white" />}
            </div>
            <span className="text-xs text-text-secondary">{PREF_LABELS[key]}</span>
          </label>
        ))}
      </div>
    </motion.div>
  );
}

// ── News Mini-Widget ──────────────────────────────────────────────────
const IMPACT_COLORS = { high: '#EF4444', medium: '#FF9800', low: '#787B86' } as const;
const ALL_NEWS_CCY = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];

function NewsWidget({ navigate }: { navigate: (p: string) => void }) {
  const { settings, updateNews } = useWidgetSettingsStore();
  const ns = settings.news;
  const [showSettings, setShowSettings] = useState(false);

  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

  const events = (() => {
    try {
      const raw = localStorage.getItem('trading-journal-calendar-cache');
      if (!raw) return [];
      const cache = JSON.parse(raw);
      const allEvents: any[] = cache.data ?? [];
      return allEvents
        .filter((e: any) => {
          const inDates = e.date === today || e.date === tomorrow;
          const inImpact = ns.impact === 'all' ? true : e.impact === ns.impact || (ns.impact === 'medium' && e.impact === 'high');
          const inCcy = ns.currencies.length === 0 || ns.currencies.includes(e.currency);
          return inDates && inImpact && inCcy;
        })
        .sort((a: any, b: any) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
        .slice(0, 4);
    } catch { return []; }
  })();

  const toggleCcy = (ccy: string) => {
    const next = ns.currencies.includes(ccy)
      ? ns.currencies.filter(c => c !== ccy)
      : [...ns.currencies, ccy];
    updateNews({ currencies: next });
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate('/news')} className="flex items-center gap-1.5 flex-1 text-left group">
          <div className="p-1.5 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/15 transition-colors">
            <Newspaper size={14} className="text-amber-400" />
          </div>
          <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">News / Kalender</span>
        </button>
        <button onClick={() => setShowSettings(p => !p)} className="p-1 rounded hover:bg-white/5 transition-colors flex-shrink-0">
          <Settings2 size={11} className={showSettings ? 'text-accent-primary' : 'text-text-muted/50'} />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.07] space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {ALL_NEWS_CCY.map(ccy => {
              const active = ns.currencies.includes(ccy) || ns.currencies.length === 0;
              return (
                <button key={ccy} onClick={() => toggleCcy(ccy)}
                  className={clsx('text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors',
                    ns.currencies.length === 0 ? 'bg-amber-500/20 text-amber-400' :
                    active ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-text-muted/50')}>
                  {ccy}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1">
            {(['high', 'medium', 'all'] as const).map(lvl => (
              <button key={lvl} onClick={() => updateNews({ impact: lvl })}
                className={clsx('text-[9px] px-1.5 py-0.5 rounded capitalize transition-colors',
                  ns.impact === lvl ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-text-muted/50')}>
                {lvl === 'high' ? 'Hoch' : lvl === 'medium' ? 'Mittel' : 'Alle'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events */}
      <div className="flex-1 space-y-1 overflow-hidden">
        {events.length === 0 ? (
          <p className="text-[11px] text-text-muted/60 italic">Keine Events heute/morgen{ns.currencies.length > 0 ? ' (Filter aktiv)' : ''} — News-Seite öffnen zum Laden</p>
        ) : (
          events.map((e: any, i: number) => (
            <button key={i} onClick={() => navigate('/news')} className="flex items-center gap-1.5 w-full text-left hover:opacity-80">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: IMPACT_COLORS[e.impact as keyof typeof IMPACT_COLORS] ?? '#787B86' }} />
              <span className="text-[10px] font-mono text-text-muted w-10 flex-shrink-0">{e.time ?? '??:??'}</span>
              <span className="text-[10px] font-semibold text-text-muted flex-shrink-0 w-7">{e.currency}</span>
              <span className="text-[10px] text-text-primary truncate">{e.event}</span>
            </button>
          ))
        )}
      </div>
      <button onClick={() => navigate('/news')} className="text-[11px] text-accent-primary hover:text-accent-secondary transition-colors font-medium mt-1 text-left">
        Öffnen →
      </button>
    </div>
  );
}

// ── Zinsen Mini-Widget ────────────────────────────────────────────────
const ALL_ZINSEN_CCY = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];

function ZinsenWidget({ navigate }: { navigate: (p: string) => void }) {
  const { settings, updateZinsen } = useWidgetSettingsStore();
  const zs = settings.zinsen;
  const [showSettings, setShowSettings] = useState(false);

  const rates = (() => {
    try {
      const raw = localStorage.getItem('trading-journal-interest-rates-cache');
      if (!raw) return null;
      const cache = JSON.parse(raw);
      return cache.data as Record<string, { rate: number; change: string }> | null;
    } catch { return null; }
  })();

  const toggleCcy = (ccy: string) => {
    const next = zs.currencies.includes(ccy)
      ? zs.currencies.filter(c => c !== ccy)
      : [...zs.currencies, ccy];
    updateZinsen({ currencies: next });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate('/zinsen')} className="flex items-center gap-1.5 flex-1 text-left group">
          <div className="p-1.5 rounded-lg bg-accent-primary/10 group-hover:bg-accent-primary/15 transition-colors">
            <Percent size={14} className="text-accent-primary" />
          </div>
          <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Zinsen</span>
        </button>
        <button onClick={() => setShowSettings(p => !p)} className="p-1 rounded hover:bg-white/5 transition-colors flex-shrink-0">
          <Settings2 size={11} className={showSettings ? 'text-accent-primary' : 'text-text-muted/50'} />
        </button>
      </div>

      {showSettings && (
        <div className="mb-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.07] flex flex-wrap gap-1">
          {ALL_ZINSEN_CCY.map(ccy => (
            <button key={ccy} onClick={() => toggleCcy(ccy)}
              className={clsx('text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors',
                zs.currencies.includes(ccy) ? 'bg-accent-primary/20 text-accent-secondary' : 'bg-white/5 text-text-muted/50')}>
              {ccy}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-0.5 overflow-hidden">
        {!rates ? (
          <p className="text-[11px] text-text-muted/60 italic">Zinsdaten noch nicht geladen</p>
        ) : (
          zs.currencies.map(ccy => {
            const r = rates[ccy];
            if (!r) return null;
            const changeColor = r.change === 'up' ? '#22C55E' : r.change === 'down' ? '#EF4444' : '#787B86';
            const arrow = r.change === 'up' ? '↑' : r.change === 'down' ? '↓' : '→';
            return (
              <div key={ccy} className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-text-muted w-8 flex-shrink-0">{ccy}</span>
                <span className="flex-1 text-[10px] font-mono text-text-primary">{r.rate.toFixed(2)}%</span>
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: changeColor }}>{arrow}</span>
              </div>
            );
          })
        )}
      </div>
      <button onClick={() => navigate('/zinsen')} className="text-[11px] text-accent-primary hover:text-accent-secondary transition-colors font-medium mt-1 text-left">
        Öffnen →
      </button>
    </div>
  );
}

// ── Smart COT Mini-Widget ─────────────────────────────────────────────
const ALL_COT_CCY = ['DXY', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];

function COTWidget({ navigate }: { navigate: (p: string) => void }) {
  const { settings, updateCOT } = useWidgetSettingsStore();
  const cs = settings.cot;
  const [showSettings, setShowSettings] = useState(false);

  const allRows = (() => {
    try {
      const raw = localStorage.getItem('cotData');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return null;
      return data as Array<{ currency: string; commercialsNet: number; weeklyChange: number; percentileRank?: number; signal?: string }>;
    } catch { return null; }
  })();

  const rows = allRows
    ? allRows.filter(r => cs.currencies.includes(r.currency))
    : null;

  const toggleCcy = (ccy: string) => {
    const next = cs.currencies.includes(ccy)
      ? cs.currencies.filter(c => c !== ccy)
      : [...cs.currencies, ccy];
    updateCOT({ currencies: next });
  };

  const getScoreColor = (net: number, signal?: string) => {
    if (signal === 'strong_long') return '#22C55E';
    if (signal === 'long') return '#86efac';
    if (signal === 'strong_short') return '#EF4444';
    if (signal === 'short') return '#fca5a5';
    if (net > 0) return '#22C55E';
    if (net < 0) return '#EF4444';
    return '#787B86';
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate('/cot')} className="flex items-center gap-1.5 flex-1 text-left group">
          <div className="p-1.5 rounded-lg bg-pnl-positive/10 group-hover:bg-pnl-positive/15 transition-colors">
            <BarChart2 size={14} className="text-pnl-positive" />
          </div>
          <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Smart COT</span>
        </button>
        <button onClick={() => setShowSettings(p => !p)} className="p-1 rounded hover:bg-white/5 transition-colors flex-shrink-0">
          <Settings2 size={11} className={showSettings ? 'text-accent-primary' : 'text-text-muted/50'} />
        </button>
      </div>

      {showSettings && (
        <div className="mb-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.07] flex flex-wrap gap-1">
          {ALL_COT_CCY.map(ccy => (
            <button key={ccy} onClick={() => toggleCcy(ccy)}
              className={clsx('text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors',
                cs.currencies.includes(ccy) ? 'bg-pnl-positive/20 text-pnl-positive' : 'bg-white/5 text-text-muted/50')}>
              {ccy}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-0.5 overflow-hidden">
        {!rows ? (
          <p className="text-[11px] text-text-muted/60 italic">COT-Daten noch nicht geladen — COT-Seite öffnen</p>
        ) : rows.length === 0 ? (
          <p className="text-[11px] text-text-muted/60 italic">Keine Währungen ausgewählt</p>
        ) : (
          rows.map(({ currency, commercialsNet, weeklyChange, signal }) => {
            const color = getScoreColor(commercialsNet, signal);
            const label = `${commercialsNet > 0 ? '+' : ''}${(commercialsNet / 1000).toFixed(0)}K`;
            const chgColor = weeklyChange > 0 ? '#22C55E' : weeklyChange < 0 ? '#EF4444' : '#787B86';
            return (
              <div key={currency} className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-text-muted w-8 flex-shrink-0">{currency}</span>
                <span className="flex-1 text-[10px] font-mono" style={{ color }}>{label}</span>
                <span className="text-[9px] flex-shrink-0" style={{ color: chgColor }}>
                  {weeklyChange > 0 ? '+' : ''}{(weeklyChange / 1000).toFixed(0)}K
                </span>
              </div>
            );
          })
        )}
      </div>
      <button onClick={() => navigate('/cot')} className="text-[11px] text-accent-primary hover:text-accent-secondary transition-colors font-medium mt-1 text-left">
        Smart COT →
      </button>
    </div>
  );
}

// ── Übersicht Mini-Widget ─────────────────────────────────────────────
function UebersichtWidget({ navigate }: { navigate: (p: string) => void }) {
  return (
    <button onClick={() => navigate('/fundamentals')} className="flex flex-col h-full w-full text-left group">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="p-1.5 rounded-lg bg-accent-cyan/10 group-hover:bg-accent-cyan/15 transition-colors">
          <Globe2 size={14} className="text-accent-cyan" />
        </div>
        <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Markt-Übersicht</span>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1.5">
        {['Fundamentaldaten', 'Währungsstärke', 'Marktstruktur', 'Saisonalität'].map(item => (
          <div key={item} className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-accent-cyan/60 flex-shrink-0" />
            <span className="text-[11px] text-text-muted">{item}</span>
          </div>
        ))}
      </div>
      <span className="text-[11px] text-accent-primary group-hover:text-accent-secondary transition-colors font-medium mt-1">
        Öffnen →
      </span>
    </button>
  );
}

// ── Markt-Navigation Widget (generisch) ──────────────────────────────
function DashNavWidget({
  navigate, path, title, description, icon,
}: {
  navigate: (p: string) => void;
  path: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={() => navigate(path)}
      className="flex flex-col h-full w-full items-start gap-3 group text-left"
    >
      <div className="flex items-center gap-1.5">
        <div className="p-1.5 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.09] transition-colors">
          {icon}
        </div>
        <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">{title}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-xs text-text-muted leading-relaxed">{description}</p>
      </div>
      <span className="text-[11px] text-accent-primary group-hover:text-accent-secondary transition-colors font-medium">
        Öffnen →
      </span>
    </button>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────
export function Dashboard() {
  const navigate  = useNavigate();
  const { loadTrades, trades }  = useTradeStore();
  const { loadConfigs, configs } = useAccountStore();
  const { accountFilter, setAccountFilter, getDateRange,
          calculatePerformance, calculateMonthlyReturns, calculateEquityCurve } = useAnalyticsStore();
  const { outlooks, loadOutlooks, getStarredOutlooks } = useOutlookStore();
  const { showToast } = useUIStore();

  const [greeting, setGreeting]         = useState('');
  const [userName, setUserName]         = useState('Trader');
  const [prefs, setPrefs]               = useState<DashboardPrefs>(loadPrefs);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [dashboardBg, setDashboardBg] = useState<string | null>(() => localStorage.getItem('tradingJournal_dashboardBg'));

  useEffect(() => {
    loadTrades();
    loadConfigs();
    loadOutlooks();

    const hour = new Date().getHours();
    if (hour < 12)       setGreeting('Guten Morgen');
    else if (hour < 18)  setGreeting('Guten Tag');
    else                 setGreeting('Guten Abend');

    // Google-Name aus Supabase-Session + Dashboard Prefs laden
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const name = session.user.user_metadata?.full_name
          || session.user.user_metadata?.name
          || session.user.email?.split('@')[0]
          || 'Trader';
        setUserName(name);
        // Load dashboard prefs from Supabase (overrides localStorage if available)
        loadPrefsFromSupabase().then(cloudPrefs => {
          if (cloudPrefs) {
            setPrefs(cloudPrefs);
            savePrefs(cloudPrefs); // keep localStorage in sync
          }
        });
      } else {
        // Offline mode: use locally saved name
        const localName = localStorage.getItem('tradingJournal_displayName');
        if (localName) setUserName(localName);
      }
    });
  }, []);

  const handlePrefsChange = (newPrefs: DashboardPrefs) => {
    setPrefs(newPrefs);
    savePrefs(newPrefs);
    savePrefsToSupabase(newPrefs); // fire-and-forget
  };

  // Immer alle Trades (kein Zeitfilter mehr in der UI)
  const filteredTrades = useMemo(() => {
    const range = getDateRange();
    return trades.filter(t => {
      const inDateRange = t.date >= range.start && t.date <= range.end;
      const inAccount   = accountFilter === 'all' || t.type === accountFilter;
      return inDateRange && inAccount && t.sessionType === 'live';
    });
  }, [trades, accountFilter, getDateRange]);

  const stats          = useMemo(() => calculatePerformance(filteredTrades),  [filteredTrades, calculatePerformance]);
  const monthlyReturns = useMemo(() => calculateMonthlyReturns(filteredTrades), [filteredTrades, calculateMonthlyReturns]);
  const equityCurve    = useMemo(() =>
    calculateEquityCurve(filteredTrades, configs?.ek?.initialStartBalance || 10000),
    [filteredTrades, configs, calculateEquityCurve]
  );

  const ekBalance     = configs?.ek?.currentBalance     || 0;
  const fundedBalance = configs?.funded?.currentBalance || 0;
  const totalBalance  = ekBalance + fundedBalance;
  const currentBalance = accountFilter === 'all' ? totalBalance
    : accountFilter === 'ek' ? ekBalance : fundedBalance;

  const recentTrades = useMemo(() =>
    [...filteredTrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
    [filteredTrades]
  );

  const totalProfitCHF = useMemo(() =>
    filteredTrades.reduce((sum, t) => {
      const cfg = configs?.[t.type];
      const bal = cfg?.currentBalance || 10000;
      return sum + ((t.riskAmount || bal * (t.riskPercent || 1) / 100) * t.rMultiple);
    }, 0),
    [filteredTrades, configs]
  );

  const rSparkline = useMemo(() =>
    filteredTrades
      .sort((a, b) => a.date.localeCompare(b.date))
      .reduce((acc, t) => { acc.push((acc.at(-1) ?? 0) + t.rMultiple); return acc; }, [] as number[]),
    [filteredTrades]
  );

  const heatmapData = useMemo((): HeatmapDay[] => {
    const dayMap = new Map<string, { totalR: number; count: number }>();
    trades.filter(t => (accountFilter === 'all' || t.type === accountFilter) && t.sessionType === 'live')
      .forEach(t => {
        const ex = dayMap.get(t.date) || { totalR: 0, count: 0 };
        dayMap.set(t.date, { totalR: ex.totalR + t.rMultiple, count: ex.count + 1 });
      });
    return Array.from(dayMap.entries()).map(([date, d]) => ({ date, value: d.totalR, trades: d.count }));
  }, [trades, accountFilter]);

  const streakResults = useMemo(() =>
    [...filteredTrades]
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
      .map(t => t.result),
    [filteredTrades]
  );

  // Aktive & wartende Outlooks für Dashboard-Widget
  const activeOutlooks = useMemo(() =>
    outlooks.filter(o => o.status === 'active' || o.status === 'waiting').slice(0, 5),
    [outlooks]
  );

  const handleExportPDF = () => {
    const range = getDateRange();
    const html  = generateReportHTML({
      title: 'Performance Report', dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats: { ...stats, currentBalance }, trades: filteredTrades, equityCurve, monthlyReturns,
    });
    printReport(html);
    showToast('Report wird gedruckt...', 'info');
  };

  const handleSaveHTML = async () => {
    const range    = getDateRange();
    const html     = generateReportHTML({
      title: 'Performance Report', dateRange: range,
      accountType: accountFilter === 'all' ? 'Alle Konten' : accountFilter === 'ek' ? 'Eigenkapital' : 'Funded',
      stats: { ...stats, currentBalance }, trades: filteredTrades, equityCurve, monthlyReturns,
    });
    await saveReportAsHTML(html, `TradingJournal_Report_${range.start}_${range.end}.html`);
    showToast('Report gespeichert', 'success');
  };

  const monthName = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <PageTransition>
      <div className="page-container space-y-4 relative">
        {/* Dezenter Hintergrund: eigene Ebene hinter dem Inhalt.
            Bild leicht gedimmt + weich, sodass die vorderen Karten
            (opake bg-background-card) nie beeinflusst werden. */}
        {dashboardBg && (
          <>
            <div
              className="fixed inset-0 pointer-events-none z-0"
              style={{
                backgroundImage: `url(${dashboardBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
                opacity: 0.28,
                filter: 'blur(1px)',
              }}
            />
            {/* Sanfter Verlauf für Lesbarkeit an Rändern */}
            <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-background/70 via-background/40 to-background/80" />
          </>
        )}

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-gradient">{greeting}</span>
            <span className="text-text-primary">, {userName}</span>
          </h1>

          <div className="flex items-center gap-2">
            <select
              className="select w-28 text-xs py-1.5"
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value as 'all' | 'ek' | 'funded')}
            >
              <option value="all">Alle Konten</option>
              <option value="ek">Eigenkapital</option>
              <option value="funded">Funded</option>
            </select>

            <button
              onClick={() => setShowCustomizer(v => !v)}
              className={clsx('btn-icon w-8 h-8', showCustomizer && 'bg-accent-primary/20 text-accent-primary')}
              title="Dashboard anpassen"
            >
              <SlidersHorizontal size={14} />
            </button>
            <button onClick={handleExportPDF} className="btn-icon w-8 h-8" title="Drucken">
              <Printer size={14} />
            </button>
            <button onClick={handleSaveHTML} className="btn-icon w-8 h-8" title="Export">
              <Download size={14} />
            </button>
            <button onClick={() => navigate('/ek')} className="btn-primary btn-sm">
              <Plus size={14} /> Trade
            </button>
          </div>
        </motion.div>

        {/* ── Widget-Customizer ── */}
        <AnimatePresence>
          {showCustomizer && (
            <WidgetCustomizer
              prefs={prefs}
              onChange={handlePrefsChange}
              onClose={() => setShowCustomizer(false)}
              dashboardBg={dashboardBg}
              onBgChange={(bg) => {
                setDashboardBg(bg);
                if (bg) localStorage.setItem('tradingJournal_dashboardBg', bg);
                else localStorage.removeItem('tradingJournal_dashboardBg');
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Bento Grid ── */}
        <BentoGrid cols={4} className="auto-rows-[minmax(140px,auto)]">

          {/* HERO: Kontostand (immer sichtbar) */}
          <BentoCell size="tall" delay={0.05} accent>
            <div className="flex flex-col justify-between h-full">
              <MetricDisplay label="Kontostand" value={currentBalance} format="currency" suffix=" CHF" size="xl" />
              <div className="mt-auto pt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">EK</span>
                  <span className="font-mono font-semibold text-text-primary">{ekBalance.toLocaleString('de-CH')} CHF</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Funded</span>
                  <span className="font-mono font-semibold text-text-primary">{fundedBalance.toLocaleString('de-CH')} CHF</span>
                </div>
              </div>
            </div>
          </BentoCell>

          {/* WIN RATE */}
          {prefs.showWinRate && (
            <BentoCell delay={0.1}>
              <div className="flex flex-col items-center justify-center h-full">
                <ProgressRing value={stats.winRate} size={90} strokeWidth={7} color="#8B5CF6" label="WIN RATE" />
                <p className="text-xs text-text-muted mt-2 tabular-nums font-mono">
                  {Math.round(stats.winRate * stats.totalTrades / 100)}W / {stats.totalTrades - Math.round(stats.winRate * stats.totalTrades / 100)}L
                </p>
              </div>
            </BentoCell>
          )}

          {/* EQUITY SPARKLINE */}
          {prefs.showSparkline && (
            <BentoCell size="wide" delay={0.15} noPadding>
              <div className="p-4 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <MetricDisplay label="Total R" value={stats.totalR} format="R" showSign size="md" />
                  <button onClick={() => navigate('/equity')} className="text-[10px] text-accent-primary hover:underline">Details →</button>
                </div>
                <div className="flex-1 min-h-0">
                  {rSparkline.length > 2
                    ? <SparklineChart data={rSparkline} width={400} height={70} strokeWidth={2} className="w-full h-full" />
                    : <div className="h-full flex items-center justify-center text-xs text-text-muted">Noch nicht genug Daten</div>
                  }
                </div>
              </div>
            </BentoCell>
          )}

          {/* PROFIT/LOSS */}
          {prefs.showProfitLoss && (
            <BentoCell delay={0.2}>
              <MetricDisplay label="Gewinn/Verlust" value={totalProfitCHF} format="currency" suffix=" CHF"
                showSign size="md" trend={totalProfitCHF >= 0 ? 'up' : 'down'} />
            </BentoCell>
          )}

          {/* PROFIT FACTOR + EXPECTANCY */}
          {prefs.showProfitFactor && (
            <BentoCell delay={0.25}>
              <div className="space-y-4">
                <MetricDisplay label="Profit Factor"
                  value={stats.profitFactor === Infinity ? 99 : stats.profitFactor}
                  format="number" decimals={2} size="md" icon={<TrendingUp size={12} />} />
                <div className="border-t border-border pt-3">
                  <MetricDisplay label="Expectancy" value={stats.expectancy} format="number" decimals={3} showSign size="sm" />
                </div>
              </div>
            </BentoCell>
          )}

          {/* STREAK */}
          {prefs.showStreak && (
            <BentoCell delay={0.3}>
              <div className="space-y-3">
                <div>
                  <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Trade Streak</span>
                  <div className="mt-2">
                    <TradeStreak results={streakResults} maxDots={15} size="md" showLabels />
                  </div>
                </div>
                <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
                  <div className="p-2 bg-pnl-positive/10 rounded-lg text-center">
                    <div className="text-[10px] text-text-muted">Best Day</div>
                    <div className="text-sm font-bold text-pnl-positive font-mono">
                      {stats.bestDay ? `+${stats.bestDay.r.toFixed(1)}R` : '–'}
                    </div>
                  </div>
                  <div className="p-2 bg-pnl-negative/10 rounded-lg text-center">
                    <div className="text-[10px] text-text-muted">Worst Day</div>
                    <div className="text-sm font-bold text-pnl-negative font-mono">
                      {stats.worstDay ? `${stats.worstDay.r.toFixed(1)}R` : '–'}
                    </div>
                  </div>
                </div>
              </div>
            </BentoCell>
          )}

          {/* RECENT TRADES */}
          {prefs.showRecentTrades && (
            <BentoCell size="tall" delay={0.35} noPadding>
              <div className="p-3 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Letzte Trades</span>
                  <button onClick={() => navigate(accountFilter === 'funded' ? '/funded' : '/ek')}
                    className="text-[10px] text-accent-primary hover:underline">Alle →</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-0">
                  {recentTrades.length === 0
                    ? <div className="flex items-center justify-center h-full text-xs text-text-muted">Keine Trades</div>
                    : recentTrades.map(trade => (
                        <TradeRow key={trade.id} trade={trade} showAccount={accountFilter === 'all'} compact />
                      ))
                  }
                </div>
              </div>
            </BentoCell>
          )}

          {/* HEATMAP */}
          {prefs.showHeatmap && (
            <BentoCell size="wide" delay={0.4}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-accent-primary" />
                <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Trading Aktivität</span>
                <button onClick={() => navigate('/calendar')} className="text-[10px] text-accent-primary hover:underline ml-auto">Kalender →</button>
              </div>
              <Heatmap data={heatmapData} weeks={16} colorMode="pnl"
                onDayClick={(day) => { if (day.trades > 0) navigate('/calendar'); }} />
            </BentoCell>
          )}

          {/* AKTIVE OUTLOOKS */}
          {prefs.showOutlooks && (
            <BentoCell delay={0.42} noPadding>
              <div className="p-3 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-1.5">
                    <Target size={12} className="text-accent-primary" />
                    <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Outlooks</span>
                  </div>
                  <button onClick={() => navigate('/outlook')} className="text-[10px] text-accent-primary hover:underline">Alle →</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {activeOutlooks.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-text-muted">
                      Keine aktiven Outlooks
                    </div>
                  ) : (
                    activeOutlooks.map(outlook => {
                      const cfg = OUTLOOK_STATUS_CONFIG[outlook.status];
                      return (
                        <div key={outlook.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                          <span className={clsx(
                            'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0',
                            cfg.bgColor, cfg.color
                          )}>
                            {outlook.status === 'active' ? 'Aktiv' : 'Wartet'}
                          </span>
                          <span className="text-xs font-mono font-semibold text-text-primary flex-shrink-0">{outlook.symbol}</span>
                          <span className={clsx(
                            'text-[10px] font-bold flex-shrink-0',
                            outlook.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative'
                          )}>
                            {outlook.direction.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-text-muted truncate">{outlook.thesis}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </BentoCell>
          )}

          {/* STARRED OUTLOOKS */}
          {(() => {
            const starred = getStarredOutlooks();
            if (starred.length === 0) return null;
            return (
              <BentoCell delay={0.43} noPadding>
                <div className="p-3 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <Star size={12} className="text-accent-gold fill-accent-gold" />
                      <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">Favoriten</span>
                    </div>
                    <button onClick={() => navigate('/outlook')} className="text-[10px] text-accent-primary hover:underline">Alle →</button>
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {starred.slice(0, 6).map(o => (
                      <div key={o.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/[0.03]">
                        <span className={clsx('text-[10px] font-bold', o.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {o.direction === 'long' ? '↑' : '↓'}
                        </span>
                        <span className="text-[11px] font-semibold text-text-primary">{o.symbol}</span>
                        <span className={clsx('text-[9px] px-1 py-0.5 rounded',
                          o.status === 'active' ? 'bg-pnl-positive/15 text-pnl-positive' :
                          o.status === 'waiting' ? 'bg-accent-gold/15 text-accent-gold' :
                          'bg-accent-blue/15 text-accent-blue'
                        )}>
                          {o.status === 'active' ? 'Aktiv' : o.status === 'waiting' ? 'Wartend' : 'Beobachtung'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </BentoCell>
            );
          })()}

          {/* MONATS-KALENDER */}
          {prefs.showMonthCalendar && (
            <BentoCell delay={0.44}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={12} className="text-accent-primary" />
                <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">
                  {monthName}
                </span>
              </div>
              <MonthCalendar heatmapData={heatmapData} />
            </BentoCell>
          )}

          {/* PERFORMANCE DETAILS */}
          {prefs.showDetails && (
            <BentoCell delay={0.45}>
              <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em] block mb-3">Details</span>
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Sharpe Ratio',  value: <AnimatedNumber value={stats.sharpeRatio} decimals={2} />,                            color: '' },
                  { label: 'Avg Win',       value: <><span className="text-pnl-positive">+</span><AnimatedNumber value={stats.avgWin} decimals={2} suffix="R" /></>,  color: 'text-pnl-positive' },
                  { label: 'Avg Loss',      value: <><span className="text-pnl-negative">-</span><AnimatedNumber value={stats.avgLoss} decimals={2} suffix="R" /></>, color: 'text-pnl-negative' },
                  { label: 'Max Drawdown',  value: <AnimatedNumber value={stats.maxDrawdown} decimals={1} suffix="R" />,                  color: 'text-pnl-negative' },
                  { label: 'Trading Tage',  value: <span>{stats.tradingDays}</span>,                                                       color: '' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-text-muted">{label}</span>
                    <span className={clsx('font-mono font-semibold text-text-primary', color)}>{value}</span>
                  </div>
                ))}
              </div>
            </BentoCell>
          )}

          {/* MARKT: ÜBERSICHT */}
          {prefs.showWidgetUebersicht && (
            <BentoCell delay={0.48}>
              <UebersichtWidget navigate={navigate} />
            </BentoCell>
          )}

          {/* MARKT: NEWS */}
          {prefs.showWidgetNews && (
            <BentoCell delay={0.49}>
              <NewsWidget navigate={navigate} />
            </BentoCell>
          )}

          {/* MARKT: COT */}
          {prefs.showWidgetCOT && (
            <BentoCell delay={0.50}>
              <COTWidget navigate={navigate} />
            </BentoCell>
          )}

          {/* MARKT: ZINSEN */}
          {prefs.showWidgetZinsen && (
            <BentoCell delay={0.51}>
              <ZinsenWidget navigate={navigate} />
            </BentoCell>
          )}

        </BentoGrid>
      </div>
    </PageTransition>
  );
}
