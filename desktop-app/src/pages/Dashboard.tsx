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

  // Outlooks fürs Dashboard: alle "lebenden" Thesen (auch frisch erstellte =
  // Beobachtung), nur erledigte/abgebrochene ausblenden. Neueste zuerst.
  const activeOutlooks = useMemo(() =>
    outlooks
      .filter(o => o.status !== 'executed' && o.status !== 'cancelled')
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5),
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

        </BentoGrid>
      </div>
    </PageTransition>
  );
}
