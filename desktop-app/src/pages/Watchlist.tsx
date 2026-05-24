/**
 * ========================================================================
 * Trading Journal - Watchlist (TradingView-Style, ohne Preise)
 * ========================================================================
 * Symbole verwalten, Abschnitte anlegen, Farblabels vergeben, Alarme.
 * Keine Kursdaten – dient als persönliche Beobachtungsliste.
 */

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, Search, X, Bell, BellOff, Edit2, Check,
  GripVertical, List, ChevronRight, ChevronDown, Tag, Palette,
  RotateCcw, Repeat, Repeat2, Folder, FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import {
  useWatchlistStore,
  WATCHLIST_COLORS,
  type WatchlistSymbol,
  type WatchlistAlert,
  type WatchlistSection,
} from '@/stores/watchlistStore';

// ============================================================
// SYMBOL DATABASE
// ============================================================

type SymbolCategory = 'forex' | 'crypto' | 'futures' | 'indices';

interface SymbolEntry {
  symbol: string;
  displayName: string;
  category: SymbolCategory;
  subgroup?: string;
}

const SYMBOL_DB: SymbolEntry[] = [
  // Forex – G8 (alle 28 Paare)
  { symbol: 'EURUSD', displayName: 'EUR/USD', category: 'forex', subgroup: 'Major' },
  { symbol: 'GBPUSD', displayName: 'GBP/USD', category: 'forex', subgroup: 'Major' },
  { symbol: 'USDJPY', displayName: 'USD/JPY', category: 'forex', subgroup: 'Major' },
  { symbol: 'USDCHF', displayName: 'USD/CHF', category: 'forex', subgroup: 'Major' },
  { symbol: 'USDCAD', displayName: 'USD/CAD', category: 'forex', subgroup: 'Major' },
  { symbol: 'AUDUSD', displayName: 'AUD/USD', category: 'forex', subgroup: 'Major' },
  { symbol: 'NZDGBP', displayName: 'NZD/GBP', category: 'forex', subgroup: 'Cross' },
  { symbol: 'NZDUSD', displayName: 'NZD/USD', category: 'forex', subgroup: 'Major' },
  { symbol: 'EURGBP', displayName: 'EUR/GBP', category: 'forex', subgroup: 'Cross' },
  { symbol: 'EURJPY', displayName: 'EUR/JPY', category: 'forex', subgroup: 'Cross' },
  { symbol: 'EURAUD', displayName: 'EUR/AUD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'EURCAD', displayName: 'EUR/CAD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'EURCHF', displayName: 'EUR/CHF', category: 'forex', subgroup: 'Cross' },
  { symbol: 'EURNZD', displayName: 'EUR/NZD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'GBPJPY', displayName: 'GBP/JPY', category: 'forex', subgroup: 'Cross' },
  { symbol: 'GBPAUD', displayName: 'GBP/AUD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'GBPCAD', displayName: 'GBP/CAD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'GBPCHF', displayName: 'GBP/CHF', category: 'forex', subgroup: 'Cross' },
  { symbol: 'GBPNZD', displayName: 'GBP/NZD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'AUDJPY', displayName: 'AUD/JPY', category: 'forex', subgroup: 'Cross' },
  { symbol: 'AUDCAD', displayName: 'AUD/CAD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'AUDCHF', displayName: 'AUD/CHF', category: 'forex', subgroup: 'Cross' },
  { symbol: 'AUDNZD', displayName: 'AUD/NZD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'NZDJPY', displayName: 'NZD/JPY', category: 'forex', subgroup: 'Cross' },
  { symbol: 'NZDCAD', displayName: 'NZD/CAD', category: 'forex', subgroup: 'Cross' },
  { symbol: 'NZDCHF', displayName: 'NZD/CHF', category: 'forex', subgroup: 'Cross' },
  { symbol: 'CADJPY', displayName: 'CAD/JPY', category: 'forex', subgroup: 'Cross' },
  { symbol: 'CADCHF', displayName: 'CAD/CHF', category: 'forex', subgroup: 'Cross' },
  { symbol: 'CHFJPY', displayName: 'CHF/JPY', category: 'forex', subgroup: 'Cross' },
  { symbol: 'XAUUSD', displayName: 'XAU/USD', category: 'forex', subgroup: 'Metalle' },
  { symbol: 'XAGUSD', displayName: 'XAG/USD', category: 'forex', subgroup: 'Metalle' },
  // Crypto
  { symbol: 'BTCUSD',   displayName: 'BTC/USD',   category: 'crypto' },
  { symbol: 'ETHUSD',   displayName: 'ETH/USD',   category: 'crypto' },
  { symbol: 'SOLUSD',   displayName: 'SOL/USD',   category: 'crypto' },
  { symbol: 'BNBUSD',   displayName: 'BNB/USD',   category: 'crypto' },
  { symbol: 'XRPUSD',   displayName: 'XRP/USD',   category: 'crypto' },
  { symbol: 'ADAUSD',   displayName: 'ADA/USD',   category: 'crypto' },
  { symbol: 'AVAXUSD',  displayName: 'AVAX/USD',  category: 'crypto' },
  { symbol: 'DOTUSD',   displayName: 'DOT/USD',   category: 'crypto' },
  { symbol: 'MATICUSD', displayName: 'MATIC/USD', category: 'crypto' },
  { symbol: 'LINKUSD',  displayName: 'LINK/USD',  category: 'crypto' },
  // Futures
  { symbol: 'GC1',  displayName: 'Gold (GC)',       category: 'futures' },
  { symbol: 'SI1',  displayName: 'Silber (SI)',      category: 'futures' },
  { symbol: 'CL1',  displayName: 'WTI Oel (CL)',    category: 'futures' },
  { symbol: 'BZ1',  displayName: 'Brent Oel (BZ)',  category: 'futures' },
  { symbol: 'NG1',  displayName: 'Erdgas (NG)',      category: 'futures' },
  { symbol: 'HG1',  displayName: 'Kupfer (HG)',      category: 'futures' },
  { symbol: 'ZC1',  displayName: 'Mais (ZC)',        category: 'futures' },
  { symbol: 'ZW1',  displayName: 'Weizen (ZW)',      category: 'futures' },
  { symbol: 'ZS1',  displayName: 'Soja (ZS)',        category: 'futures' },
  { symbol: 'ES1',  displayName: 'E-Mini S&P (ES)',  category: 'futures' },
  { symbol: 'NQ1',  displayName: 'E-Mini NQ (NQ)',   category: 'futures' },
  // Indizes
  { symbol: 'US500', displayName: 'S&P 500 (US500)',    category: 'indices' },
  { symbol: 'US100', displayName: 'Nasdaq 100 (US100)', category: 'indices' },
  { symbol: 'US30',  displayName: 'Dow Jones (US30)',   category: 'indices' },
  { symbol: 'DE40',  displayName: 'DAX (DE40)',         category: 'indices' },
  { symbol: 'UK100', displayName: 'FTSE 100 (UK100)',   category: 'indices' },
  { symbol: 'JP225', displayName: 'Nikkei 225 (JP225)', category: 'indices' },
  { symbol: 'FR40',  displayName: 'CAC 40 (FR40)',      category: 'indices' },
  { symbol: 'AU200', displayName: 'ASX 200 (AU200)',    category: 'indices' },
  { symbol: 'HK50',  displayName: 'Hang Seng (HK50)',   category: 'indices' },
];

const CATEGORY_LABELS: Record<SymbolCategory, string> = {
  forex:   'Forex',
  crypto:  'Crypto',
  futures: 'Futures',
  indices: 'Indizes',
};

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!name.trim()) { setError('Bitte einen Namen eingeben'); return; }
    onCreate(name.trim());
    setName(''); setError('');
  };

  return (
    <div className="flex flex-col items-center justify-center h-full py-24 px-8">
      <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mb-6">
        <List size={28} className="text-accent-primary" />
      </div>
      <h2 className="text-xl font-bold text-text-primary mb-2">Neue Watchlist erstellen</h2>
      <p className="text-sm text-text-muted text-center mb-8 max-w-xs">
        Beobachte Symbole, vergib Farblabels und richte Alarme ein.
      </p>
      <div className="w-full max-w-sm space-y-3">
        <div>
          <label className="text-xs font-medium text-text-muted mb-1.5 block">Name der Watchlist</label>
          <input
            type="text" value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="z.B. Forex, Crypto, Meine Setups..."
            autoFocus
            className="w-full px-3.5 py-2.5 bg-background-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-primary/60 transition-colors"
          />
          {error && <p className="mt-1 text-xs text-pnl-negative">{error}</p>}
        </div>
        <button onClick={handleCreate}
          className="w-full py-2.5 bg-accent-primary hover:bg-accent-primary-dim rounded-xl text-sm font-semibold text-white transition-colors">
          Erstellen
        </button>
      </div>
    </div>
  );
}

// ============================================================
// COLOR PICKER (inline dropdown)
// ============================================================

interface ColorPickerProps {
  anchorRect: DOMRect;
  current?: string;
  onChange: (color: string | undefined) => void;
  onClose: () => void;
}

function ColorPicker({ anchorRect, current, onChange, onClose }: ColorPickerProps) {
  const pickerWidth  = 228;
  const pickerHeight = 148;
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const spaceRight = window.innerWidth  - anchorRect.left;
  const left = spaceRight < pickerWidth  ? Math.max(4, anchorRect.right - pickerWidth) : anchorRect.left;
  const top  = spaceBelow < pickerHeight ? anchorRect.top - pickerHeight - 6 : anchorRect.bottom + 6;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.12 }}
        style={{ position: 'fixed', top, left, zIndex: 9999, minWidth: pickerWidth }}
        className="bg-background-surface-solid border border-border rounded-xl shadow-2xl p-3"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2.5">Farbe</p>
        <div className="grid grid-cols-5 gap-2">
          {WATCHLIST_COLORS.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <button
                onClick={() => { onChange(c.value); onClose(); }}
                title={c.name}
                className={clsx(
                  'w-8 h-8 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center',
                  current === c.value ? 'border-white scale-110' : 'border-transparent',
                  !c.value && 'bg-background-elevated'
                )}
                style={c.value ? { backgroundColor: c.value } : {}}
              >
                {!c.value && <X size={12} className="text-text-muted" />}
              </button>
              <span className="text-[9px] text-text-muted leading-none">{c.name}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </>,
    document.body
  );
}

// ============================================================
// COLOR LABEL SETTINGS MODAL
// ============================================================

interface ColorLabelModalProps {
  onClose: () => void;
}

function ColorLabelModal({ onClose }: ColorLabelModalProps) {
  const { colorLabels, dashboardColor, setColorLabel, setDashboardColor } = useWatchlistStore();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="bg-background-surface-solid border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center">
              <Palette size={14} className="text-accent-primary" />
            </div>
            <p className="text-sm font-semibold text-text-primary">Farb-Labels</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Dashboard color selector */}
          <div>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              Dashboard-Farbe <span className="text-text-muted/60 font-normal normal-case">(Symbole mit dieser Farbe → Widget)</span>
            </p>
            <div className="flex gap-2 flex-wrap">
              {WATCHLIST_COLORS.map((c, i) => (
                <button key={i} onClick={() => setDashboardColor(c.value)}
                  title={c.name}
                  className={clsx(
                    'w-7 h-7 rounded-full border-2 transition-all hover:scale-110',
                    dashboardColor === c.value ? 'border-white scale-110' : 'border-transparent'
                  )}
                  style={c.value ? { backgroundColor: c.value } : { backgroundColor: 'rgba(255,255,255,0.12)' }}
                >
                  {!c.value && <X size={10} className="text-text-muted mx-auto" />}
                </button>
              ))}
            </div>
            {dashboardColor && (
              <p className="mt-1.5 text-[11px] text-text-muted">
                Aktiv: <span className="font-medium" style={{ color: dashboardColor }}>{dashboardColor}</span>
                {' '}— Symbole mit dieser Farbe erscheinen im Dashboard-Widget.
              </p>
            )}
          </div>

          <div className="border-t border-border/50 pt-4">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
              Farb-Beschriftungen
            </p>
            <div className="space-y-2">
              {WATCHLIST_COLORS.filter(c => c.value !== undefined).map((c, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                    style={{ backgroundColor: c.value }} />
                  <input
                    type="text"
                    defaultValue={colorLabels[c.value!] ?? ''}
                    onBlur={e => setColorLabel(c.value, e.target.value)}
                    placeholder={`z.B. "Kein Setup", "Long Bias"...`}
                    className="flex-1 px-2.5 py-1 bg-background border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted/60 outline-none focus:border-accent-primary/50 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border">
          <button onClick={onClose}
            className="w-full py-2 bg-accent-primary/10 border border-accent-primary/30 hover:bg-accent-primary/20 text-accent-secondary rounded-xl text-sm font-medium transition-colors">
            Fertig
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// SECTION ASSIGN DROPDOWN (portal)
// ============================================================

interface SectionAssignProps {
  anchorRect: DOMRect;
  watchlistId: string;
  symbolId: string;
  currentSectionId: string | undefined;
  sections: WatchlistSection[];
  onClose: () => void;
}

function SectionAssignDropdown({ anchorRect, watchlistId, symbolId, currentSectionId, sections, onClose }: SectionAssignProps) {
  const { setSymbolSection } = useWatchlistStore();
  const pickerWidth = 180;
  const spaceRight  = window.innerWidth - anchorRect.left;
  const left = spaceRight < pickerWidth ? Math.max(4, anchorRect.right - pickerWidth) : anchorRect.left;
  const spaceBelow  = window.innerHeight - anchorRect.bottom;
  const top  = spaceBelow < 180 ? anchorRect.top - 180 - 6 : anchorRect.bottom + 4;

  const assign = (sectionId: string | undefined) => {
    setSymbolSection(watchlistId, symbolId, sectionId);
    onClose();
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.1 }}
        style={{ position: 'fixed', top, left, zIndex: 9999, minWidth: pickerWidth }}
        className="bg-background-surface-solid border border-border rounded-xl shadow-2xl py-1 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <p className="px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Abschnitt</p>
        <button onClick={() => assign(undefined)}
          className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
            !currentSectionId ? 'text-accent-secondary bg-accent-primary/10' : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]')}>
          <X size={11} />Kein Abschnitt
        </button>
        {sections.map(sec => (
          <button key={sec.id} onClick={() => assign(sec.id)}
            className={clsx('w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
              currentSectionId === sec.id ? 'text-accent-secondary bg-accent-primary/10' : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]')}>
            <Folder size={11} />
            <span className="truncate">{sec.name}</span>
          </button>
        ))}
        {sections.length === 0 && (
          <p className="px-3 py-1.5 text-[11px] text-text-muted/60">Noch keine Abschnitte</p>
        )}
      </motion.div>
    </>,
    document.body
  );
}

// ============================================================
// SECTION HEADER
// ============================================================

interface SectionHeaderProps {
  section: WatchlistSection;
  watchlistId: string;
  symbolCount: number;
}

function SectionHeader({ section, watchlistId, symbolCount }: SectionHeaderProps) {
  const { toggleSection, renameSection, deleteSection } = useWatchlistStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(section.name);
  const [hovered, setHovered] = useState(false);

  const saveRename = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== section.name) renameSection(watchlistId, section.id, trimmed);
    setEditing(false);
  };

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1.5 group/sec cursor-pointer select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editing) toggleSection(watchlistId, section.id); }}
    >
      <span className="text-text-muted flex-shrink-0 transition-transform">
        {section.collapsed
          ? <ChevronRight size={13} />
          : <ChevronDown size={13} />}
      </span>

      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={saveRename}
          onClick={e => e.stopPropagation()}
          className="flex-1 bg-background-elevated border border-accent-primary/50 rounded px-1.5 py-0.5 text-xs text-text-primary outline-none"
        />
      ) : (
        <span className="flex-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          {section.name}
        </span>
      )}

      <span className="text-[10px] text-text-muted/60 flex-shrink-0">{symbolCount}</span>

      {hovered && !editing && (
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setValue(section.name); setEditing(true); }}
            className="p-0.5 text-text-muted hover:text-text-primary transition-colors">
            <Edit2 size={10} />
          </button>
          <button onClick={() => deleteSection(watchlistId, section.id)}
            className="p-0.5 text-text-muted hover:text-pnl-negative transition-colors">
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ALERT MODAL
// ============================================================

interface AlertModalProps {
  symbol: WatchlistSymbol;
  watchlistId: string;
  onClose: () => void;
}

function AlertModal({ symbol, watchlistId, onClose }: AlertModalProps) {
  const { addAlert, updateAlert, removeAlert } = useWatchlistStore();
  const [form, setForm] = useState({
    type: 'daily' as 'once' | 'daily' | 'weekly',
    time: '09:00',
    date: new Date().toISOString().split('T')[0],
    weekDays: [0, 1, 2, 3, 4] as number[],
    label: '',
  });

  const toggleDay = (d: number) =>
    setForm(f => ({ ...f, weekDays: f.weekDays.includes(d) ? f.weekDays.filter(x => x !== d) : [...f.weekDays, d] }));

  const handleAdd = () => {
    addAlert(watchlistId, symbol.id, {
      type: form.type,
      time: form.time,
      date: form.type === 'once' ? form.date : undefined,
      weekDays: form.type === 'weekly' ? form.weekDays : undefined,
      label: form.label.trim() || undefined,
      active: true,
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="bg-background-surface-solid border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-primary/10 flex items-center justify-center">
              <Bell size={14} className="text-accent-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Alarme – {symbol.displayName}</p>
              <p className="text-xs text-text-muted">{symbol.symbol}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Existing alerts */}
          {symbol.alerts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Bestehende Alarme</p>
              {symbol.alerts.map(alert => (
                <div key={alert.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-background border border-border/50">
                  <button onClick={() => updateAlert(watchlistId, symbol.id, alert.id, { active: !alert.active })}
                    className={clsx('flex-shrink-0', alert.active ? 'text-accent-primary' : 'text-text-muted')}>
                    {alert.active ? <Bell size={13} /> : <BellOff size={13} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        alert.type === 'once'   ? 'bg-accent-cyan/10 text-accent-cyan' :
                        alert.type === 'daily'  ? 'bg-pnl-positive-dim text-pnl-positive' :
                                                  'bg-accent-primary/10 text-accent-secondary')}>
                        {alert.type === 'once' ? 'Einmalig' : alert.type === 'daily' ? 'Taeglich' : 'Woechentlich'}
                      </span>
                      <span className="text-xs font-mono text-text-primary">{alert.time}</span>
                      {alert.type === 'once' && alert.date && <span className="text-xs text-text-muted">{alert.date}</span>}
                      {alert.type === 'weekly' && (
                        <span className="text-xs text-text-muted">{(alert.weekDays ?? []).map(d => WEEKDAY_LABELS[d]).join(', ')}</span>
                      )}
                    </div>
                    {alert.label && <p className="text-xs text-text-muted mt-0.5 truncate">{alert.label}</p>}
                  </div>
                  <button onClick={() => removeAlert(watchlistId, symbol.id, alert.id)}
                    className="flex-shrink-0 text-text-muted hover:text-pnl-negative transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New alert form */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Neuer Alarm</p>
            {/* Type */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-background rounded-xl border border-border">
              {([
                { key: 'once',   label: 'Einmalig',    icon: <RotateCcw size={11} /> },
                { key: 'daily',  label: 'Taeglich',    icon: <Repeat size={11} /> },
                { key: 'weekly', label: 'Woechentl.',  icon: <Repeat2 size={11} /> },
              ] as const).map(({ key, label, icon }) => (
                <button key={key} onClick={() => setForm(f => ({ ...f, type: key }))}
                  className={clsx('flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    form.type === key ? 'bg-accent-primary/15 text-accent-secondary border border-accent-primary/30' : 'text-text-muted hover:text-text-primary')}>
                  {icon}{label}
                </button>
              ))}
            </div>
            {/* Date */}
            {form.type === 'once' && (
              <div>
                <label className="text-xs text-text-muted mb-1 block">Datum</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary outline-none focus:border-accent-primary/50 transition-colors" />
              </div>
            )}
            {/* Weekdays */}
            {form.type === 'weekly' && (
              <div>
                <label className="text-xs text-text-muted mb-1.5 block">Wochentage</label>
                <div className="flex gap-1">
                  {WEEKDAY_LABELS.map((d, i) => (
                    <button key={i} onClick={() => toggleDay(i)}
                      className={clsx('flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                        form.weekDays.includes(i)
                          ? 'bg-accent-primary/15 text-accent-secondary border border-accent-primary/30'
                          : 'bg-background text-text-muted border border-border hover:border-border-light')}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Time */}
            <div>
              <label className="text-xs text-text-muted mb-1 block">Uhrzeit</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary outline-none focus:border-accent-primary/50 transition-colors" />
            </div>
            {/* Label */}
            <div>
              <label className="text-xs text-text-muted mb-1 block">Beschriftung (optional)</label>
              <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="z.B. London Open Check"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-primary/50 transition-colors" />
            </div>
            <button onClick={handleAdd}
              className="w-full py-2.5 bg-accent-primary/10 border border-accent-primary/30 hover:bg-accent-primary/20 text-accent-secondary rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Plus size={14} />Alarm hinzufuegen
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// ADD SYMBOL MODAL
// ============================================================

interface AddSymbolModalProps {
  watchlistId: string;
  existingSymbols: string[];
  onClose: () => void;
}

function AddSymbolModal({ watchlistId, existingSymbols, onClose }: AddSymbolModalProps) {
  const { addSymbol } = useWatchlistStore();
  const [query, setQuery]         = useState('');
  const [activeCategory, setActiveCategory] = useState<SymbolCategory | 'all'>('all');
  const [selected, setSelected]   = useState<Set<string>>(new Set());

  const filtered = SYMBOL_DB.filter(s => {
    if (existingSymbols.includes(s.symbol)) return false;
    if (activeCategory !== 'all' && s.category !== activeCategory) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return s.symbol.toLowerCase().includes(q) || s.displayName.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, SymbolEntry[]>>((acc, s) => {
    const key = s.subgroup ?? CATEGORY_LABELS[s.category];
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const allVisibleSelected = filtered.length > 0 && filtered.every(s => selected.has(s.symbol));

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach(s => next.delete(s.symbol));
      } else {
        filtered.forEach(s => next.add(s.symbol));
      }
      return next;
    });
  };

  const toggleSymbol = (symbol: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const handleConfirm = () => {
    const toAdd = SYMBOL_DB.filter(s => selected.has(s.symbol) && !existingSymbols.includes(s.symbol));
    for (const entry of toAdd) {
      addSymbol(watchlistId, { symbol: entry.symbol, displayName: entry.displayName, category: entry.category });
    }
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="bg-background-surface-solid border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
          <Search size={15} className="text-text-muted flex-shrink-0" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            placeholder="Symbol suchen..." autoFocus
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none" />
          {query && <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-primary"><X size={14} /></button>}
          <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-1 transition-colors"><X size={15} /></button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border flex-shrink-0 overflow-x-auto">
          {(['all', 'forex', 'crypto', 'futures', 'indices'] as const).map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0',
                activeCategory === cat
                  ? 'bg-accent-primary/15 border border-accent-primary/30 text-accent-secondary'
                  : 'text-text-muted hover:text-text-primary')}>
              {cat === 'all' ? 'Alle' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Select-all bar */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-background/40 border-b border-border/50 flex-shrink-0">
            <span className="text-[11px] text-text-muted">
              {selected.size > 0 ? `${selected.size} ausgewählt` : 'Klicken zum Auswählen'}
            </span>
            <button onClick={toggleAll}
              className="text-[11px] font-medium text-accent-primary hover:text-accent-secondary transition-colors">
              {allVisibleSelected ? 'Alle abwählen' : 'Alle auswählen'}
            </button>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {Object.keys(grouped).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">Kein Symbol gefunden</div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider bg-background/60 sticky top-0">
                  {group}
                </div>
                {items.map(entry => {
                  const isSelected = selected.has(entry.symbol);
                  return (
                    <button key={entry.symbol} onClick={() => toggleSymbol(entry.symbol)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left',
                        isSelected ? 'bg-accent-primary/[0.08]' : 'hover:bg-background-surface-hover'
                      )}>
                      {/* Checkbox */}
                      <div className={clsx(
                        'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all',
                        isSelected ? 'bg-accent-primary border-accent-primary' : 'border-border'
                      )}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{entry.displayName}</p>
                        <p className="text-[11px] text-text-muted font-mono">{entry.symbol}</p>
                      </div>
                      <span className="text-[10px] text-text-muted bg-background-elevated px-1.5 py-0.5 rounded flex-shrink-0">
                        {CATEGORY_LABELS[entry.category]}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-xs text-text-muted">
            {selected.size > 0
              ? `${selected.size} Symbol${selected.size !== 1 ? 'e' : ''} zum Hinzufügen`
              : 'Symbole oben auswählen'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-text-muted border border-border hover:border-white/20 transition-colors">
              Abbrechen
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className={clsx(
                'px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5',
                selected.size > 0
                  ? 'bg-accent-primary hover:bg-accent-primary/90 text-white'
                  : 'bg-background-elevated text-text-muted cursor-not-allowed opacity-50'
              )}>
              <Check size={13} />
              {selected.size > 0 ? `${selected.size} hinzufügen` : 'Hinzufügen'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// SYMBOL ROW
// ============================================================

interface SymbolRowProps {
  sym: WatchlistSymbol;
  watchlistId: string;
  sections: WatchlistSection[];
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}

function SymbolRow({ sym, watchlistId, sections, onDragStart, onDragOver, onDrop }: SymbolRowProps) {
  const { removeSymbol, updateSymbolColor } = useWatchlistStore();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerAnchor, setColorPickerAnchor] = useState<DOMRect | null>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showSectionAssign, setShowSectionAssign] = useState(false);
  const [sectionAnchor, setSectionAnchor] = useState<DOMRect | null>(null);
  const sectionBtnRef = useRef<HTMLButtonElement>(null);

  const activeAlerts = sym.alerts.filter(a => a.active).length;

  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={e => { e.preventDefault(); onDragOver(); }}
        onDrop={e => { e.preventDefault(); onDrop(); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setConfirmRemove(false); }}
        className={clsx(
          'group flex items-center gap-2 px-2 py-2 rounded-lg transition-colors border border-transparent',
          'hover:border-border/40 hover:bg-background-surface-hover',
        )}
      >
        {/* Drag handle */}
        <span className={clsx('text-text-muted cursor-grab active:cursor-grabbing flex-shrink-0 transition-opacity', hovered ? 'opacity-100' : 'opacity-0')}>
          <GripVertical size={13} />
        </span>

        {/* Color dot */}
        <div className="flex-shrink-0">
          <button
            ref={colorBtnRef}
            onClick={() => {
              const rect = colorBtnRef.current?.getBoundingClientRect();
              if (rect) setColorPickerAnchor(rect);
              setShowColorPicker(v => !v);
            }}
            className="w-4 h-4 rounded-full border border-white/20 transition-transform hover:scale-125"
            style={{ backgroundColor: sym.color ?? 'rgba(255,255,255,0.15)' }}
            title="Farbe ändern"
          />
          <AnimatePresence>
            {showColorPicker && colorPickerAnchor && (
              <ColorPicker
                anchorRect={colorPickerAnchor}
                current={sym.color}
                onChange={color => updateSymbolColor(watchlistId, sym.id, color)}
                onClose={() => setShowColorPicker(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Symbol info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-text-primary font-mono">{sym.displayName}</span>
            <span className="text-[9px] text-text-muted bg-background-elevated px-1 py-px rounded flex-shrink-0">
              {CATEGORY_LABELS[sym.category]}
            </span>
          </div>
        </div>

        {/* Section assign button */}
        <button
          ref={sectionBtnRef}
          onClick={() => {
            const rect = sectionBtnRef.current?.getBoundingClientRect();
            if (rect) setSectionAnchor(rect);
            setShowSectionAssign(v => !v);
          }}
          className={clsx(
            'flex-shrink-0 p-0.5 rounded transition-all',
            sym.sectionId
              ? 'text-accent-primary opacity-100'
              : 'text-text-muted opacity-0 group-hover:opacity-100 hover:text-text-primary'
          )}
          title="Abschnitt zuweisen"
        >
          <Folder size={11} />
        </button>

        <AnimatePresence>
          {showSectionAssign && sectionAnchor && (
            <SectionAssignDropdown
              anchorRect={sectionAnchor}
              watchlistId={watchlistId}
              symbolId={sym.id}
              currentSectionId={sym.sectionId}
              sections={sections}
              onClose={() => setShowSectionAssign(false)}
            />
          )}
        </AnimatePresence>

        {/* Alert indicator */}
        <button
          onClick={() => setShowAlertModal(true)}
          className={clsx(
            'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors flex-shrink-0',
            activeAlerts > 0
              ? 'text-accent-primary bg-accent-primary/10 hover:bg-accent-primary/20'
              : 'text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-primary'
          )}
        >
          <Bell size={11} />
          {activeAlerts > 0 && <span className="font-medium">{activeAlerts}</span>}
        </button>

        {/* Remove */}
        <div className={clsx('flex-shrink-0 transition-opacity', hovered ? 'opacity-100' : 'opacity-0')}>
          {confirmRemove ? (
            <button onClick={() => removeSymbol(watchlistId, sym.id)}
              className="text-pnl-negative hover:text-red-400 transition-colors p-0.5">
              <Check size={13} />
            </button>
          ) : (
            <button onClick={() => setConfirmRemove(true)}
              className="text-text-muted hover:text-pnl-negative transition-colors p-0.5">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAlertModal && (
          <AlertModal symbol={sym} watchlistId={watchlistId} onClose={() => setShowAlertModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ============================================================
// TAB NAME EDITOR
// ============================================================

function TabNameEditor({ name, onSave, onCancel }: { name: string; onSave: (n: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  return (
    <input autoFocus value={value} onChange={e => setValue(e.target.value)}
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
  const {
    watchlists, activeId, setActiveId,
    createWatchlist, deleteWatchlist, renameWatchlist,
    reorderSymbols, createSection,
  } = useWatchlistStore();

  const [showAddSymbol, setShowAddSymbol]       = useState(false);
  const [showCreateForm, setShowCreateForm]     = useState(false);
  const [newName, setNewName]                   = useState('');
  const [editingTabId, setEditingTabId]         = useState<string | null>(null);
  const [searchFilter, setSearchFilter]         = useState('');
  const [showColorLabels, setShowColorLabels]   = useState(false);
  const [showAddSection, setShowAddSection]     = useState(false);
  const [newSectionName, setNewSectionName]     = useState('');

  const dragItem     = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const activeWatchlist = watchlists.find(w => w.id === activeId) ?? watchlists[0];

  const filteredSymbols = (activeWatchlist?.symbols ?? []).filter(s =>
    !searchFilter ||
    s.displayName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.symbol.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleCreateWatchlist = (name: string) => {
    createWatchlist(name);
    setShowCreateForm(false);
    setNewName('');
  };

  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null || !activeWatchlist) return;
    if (dragItem.current === dragOverItem.current) return;
    reorderSymbols(activeWatchlist.id, dragItem.current, dragOverItem.current);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // No watchlists: full-page empty state
  if (watchlists.length === 0) {
    return (
      <PageTransition className="h-full">
        <EmptyState onCreate={handleCreateWatchlist} />
      </PageTransition>
    );
  }

  const cats = (activeWatchlist?.symbols ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1;
    return acc;
  }, {});

  const totalActiveAlerts = (activeWatchlist?.symbols ?? [])
    .reduce((n, s) => n + s.alerts.filter(a => a.active).length, 0);

  return (
    <PageTransition className="h-full flex flex-col">
      <div className="flex flex-col h-full bg-background">

        {/* Page Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
                <List size={16} className="text-accent-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary leading-tight">Watchlist</h1>
                <p className="text-xs text-text-muted">Symbole beobachten · Abschnitte · Farblabels · Alarme</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowColorLabels(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-background-surface border border-border text-text-muted hover:text-text-primary hover:border-white/20 transition-colors"
                title="Farb-Labels konfigurieren">
                <Palette size={14} />Labels
              </button>
              <button onClick={() => setShowAddSymbol(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-accent-primary/10 border border-accent-primary/30 text-accent-secondary hover:bg-accent-primary/20 transition-colors">
                <Plus size={14} />Symbol hinzufuegen
              </button>
            </div>
          </div>

          {/* Watchlist Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {watchlists.map(wl => (
              <div key={wl.id} className="flex-shrink-0 group/tab relative">
                {editingTabId === wl.id ? (
                  <TabNameEditor
                    name={wl.name}
                    onSave={name => { renameWatchlist(wl.id, name); setEditingTabId(null); }}
                    onCancel={() => setEditingTabId(null)}
                  />
                ) : (
                  <button
                    onClick={() => setActiveId(wl.id)}
                    onDoubleClick={() => setEditingTabId(wl.id)}
                    title="Doppelklick zum Umbenennen"
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                      (activeId === wl.id || activeWatchlist?.id === wl.id)
                        ? 'bg-accent-primary/15 border border-accent-primary/40 text-accent-secondary'
                        : 'text-text-muted hover:text-text-primary hover:bg-background-surface-hover border border-transparent'
                    )}
                  >
                    {wl.name}
                    <span className="text-[10px] opacity-60">{wl.symbols.length}</span>
                  </button>
                )}
                {watchlists.length > 1 && (
                  <button
                    onClick={() => deleteWatchlist(wl.id)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-background-elevated border border-border text-text-muted hover:text-pnl-negative flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity"
                  >
                    <X size={8} />
                  </button>
                )}
              </div>
            ))}

            {/* Add watchlist */}
            {showCreateForm ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateWatchlist(newName || `Watchlist ${watchlists.length + 1}`);
                    if (e.key === 'Escape') { setShowCreateForm(false); setNewName(''); }
                  }}
                  onBlur={() => { if (!newName.trim()) setShowCreateForm(false); }}
                  placeholder="Name..."
                  className="bg-background-elevated border border-accent-primary/50 rounded px-2 py-1 text-xs text-text-primary outline-none w-24"
                />
                <button onClick={() => handleCreateWatchlist(newName || `Watchlist ${watchlists.length + 1}`)} className="text-pnl-positive"><Check size={13} /></button>
                <button onClick={() => { setShowCreateForm(false); setNewName(''); }} className="text-text-muted"><X size={13} /></button>
              </div>
            ) : (
              <button onClick={() => setShowCreateForm(true)} title="Neue Watchlist"
                className="flex-shrink-0 w-7 h-7 rounded-lg border border-dashed border-border hover:border-accent-primary/50 text-text-muted hover:text-accent-primary flex items-center justify-center transition-colors">
                <Plus size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Search + Category chips */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input type="text" value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
              placeholder="Filter..."
              className="w-full pl-7 pr-8 py-1.5 bg-background-surface border border-border rounded-lg text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent-primary/50 transition-colors" />
            {searchFilter && (
              <button onClick={() => setSearchFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                <X size={11} />
              </button>
            )}
          </div>
          {Object.keys(cats).length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(cats).map(([cat, count]) => (
                <span key={cat} className="text-[10px] font-medium text-text-muted bg-background-elevated px-2 py-0.5 rounded-full">
                  {CATEGORY_LABELS[cat as SymbolCategory]} · {count}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Symbol list with sections */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {filteredSymbols.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-10 h-10 rounded-xl bg-background-elevated border border-border flex items-center justify-center">
                <List size={18} className="text-text-muted" />
              </div>
              <p className="text-sm text-text-muted">{searchFilter ? 'Kein Symbol gefunden' : 'Noch keine Symbole'}</p>
              {!searchFilter && (
                <button onClick={() => setShowAddSymbol(true)}
                  className="flex items-center gap-2 text-sm text-accent-secondary hover:text-accent-primary transition-colors">
                  <Plus size={14} />Symbol hinzufuegen
                </button>
              )}
            </div>
          ) : (
            <div className="pt-1">
              {/* Render sections */}
              {(activeWatchlist?.sections ?? []).map(section => {
                const sectionSymbols = filteredSymbols.filter(s => s.sectionId === section.id);
                return (
                  <div key={section.id} className="mb-1">
                    <SectionHeader section={section} watchlistId={activeWatchlist!.id} symbolCount={sectionSymbols.length} />
                    <AnimatePresence>
                      {!section.collapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden pl-3 space-y-0.5"
                        >
                          {sectionSymbols.length === 0 ? (
                            <p className="px-2 py-2 text-[11px] text-text-muted/60 italic">Leer – ziehe Symbole hierher oder weise sie zu</p>
                          ) : (
                            sectionSymbols.map(sym => {
                              const originalIdx = activeWatchlist!.symbols.findIndex(s => s.id === sym.id);
                              return (
                                <motion.div key={sym.id} layout
                                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.12 }}>
                                  <SymbolRow
                                    sym={sym}
                                    watchlistId={activeWatchlist!.id}
                                    sections={activeWatchlist?.sections ?? []}
                                    onDragStart={() => { dragItem.current = originalIdx; }}
                                    onDragOver={() => { dragOverItem.current = originalIdx; }}
                                    onDrop={handleDrop}
                                  />
                                </motion.div>
                              );
                            })
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Ungrouped symbols */}
              {(() => {
                const ungrouped = filteredSymbols.filter(s => !s.sectionId);
                if (ungrouped.length === 0 && (activeWatchlist?.sections ?? []).length > 0) return null;
                return (
                  <div className="space-y-0.5">
                    {(activeWatchlist?.sections ?? []).length > 0 && ungrouped.length > 0 && (
                      <div className="px-2 py-1.5">
                        <span className="text-[11px] font-semibold text-text-muted/60 uppercase tracking-wider">Ohne Abschnitt</span>
                      </div>
                    )}
                    <AnimatePresence mode="popLayout">
                      {ungrouped.map((sym, idx) => {
                        const originalIdx = activeWatchlist!.symbols.findIndex(s => s.id === sym.id);
                        return (
                          <motion.div key={sym.id} layout
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8, scale: 0.95 }}
                            transition={{ duration: 0.15, delay: idx * 0.015 }}>
                            <SymbolRow
                              sym={sym}
                              watchlistId={activeWatchlist!.id}
                              sections={activeWatchlist?.sections ?? []}
                              onDragStart={() => { dragItem.current = originalIdx; }}
                              onDragOver={() => { dragOverItem.current = originalIdx; }}
                              onDrop={handleDrop}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                );
              })()}

              {/* Add section row */}
              <div className="mt-3 px-2">
                {showAddSection ? (
                  <div className="flex items-center gap-1.5">
                    <Folder size={12} className="text-text-muted flex-shrink-0" />
                    <input autoFocus value={newSectionName} onChange={e => setNewSectionName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (newSectionName.trim() && activeWatchlist) {
                            createSection(activeWatchlist.id, newSectionName.trim());
                          }
                          setShowAddSection(false); setNewSectionName('');
                        }
                        if (e.key === 'Escape') { setShowAddSection(false); setNewSectionName(''); }
                      }}
                      onBlur={() => { setShowAddSection(false); setNewSectionName(''); }}
                      placeholder="Abschnitt-Name..."
                      className="flex-1 bg-background-elevated border border-accent-primary/50 rounded px-2 py-1 text-xs text-text-primary outline-none"
                    />
                  </div>
                ) : (
                  <button onClick={() => setShowAddSection(true)}
                    className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors py-1">
                    <Folder size={11} /><span>Abschnitt hinzufügen</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-4 py-2 flex items-center justify-between">
          <span className="text-[11px] text-text-muted">
            {activeWatchlist?.symbols.length ?? 0} Symbol{(activeWatchlist?.symbols.length ?? 0) !== 1 ? 'e' : ''}
          </span>
          <div className="flex items-center gap-3">
            {totalActiveAlerts > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-accent-primary">
                <Bell size={10} />
                <span>{totalActiveAlerts} {totalActiveAlerts === 1 ? 'Alarm' : 'Alarme'} aktiv</span>
              </div>
            )}
            <span className="text-[11px] text-text-muted">Doppelklick Tab = umbenennen</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddSymbol && activeWatchlist && (
          <AddSymbolModal
            watchlistId={activeWatchlist.id}
            existingSymbols={activeWatchlist.symbols.map(s => s.symbol)}
            onClose={() => setShowAddSymbol(false)}
          />
        )}
        {showColorLabels && (
          <ColorLabelModal onClose={() => setShowColorLabels(false)} />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
