/**
 * ========================================================================
 * Trading Journal - Outlook Page (Trading-Thesen)
 * ========================================================================
 *
 * Verwaltet Trading-Thesen mit:
 * - Symbol, Richtung, Thesis, Confidence, Status
 * - Automatische COT-Bias Anzeige
 * - Upcoming High-Impact News
 * - Journal-Integration
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Plus,
  X,
  Save,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ChevronDown,
  Edit2,
  Trash2,
  ArrowRight,
  Filter,
  Star,
  Eye,
  Pause,
  Play,
  XCircle,
  CheckCircle2,
  Newspaper,
  Download,
  Upload,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useOutlookStore, getUpcomingHighImpactNews, getCurrenciesFromSymbol, type UpcomingNewsEvent } from '@/stores/outlookStore';
import { useUIStore } from '@/stores/uiStore';
import type { Outlook, OutlookStatus, ConfidenceLevel, OutlookTag } from '@/types';
import { OUTLOOK_STATUS_CONFIG, getConfluences, getAllPairs, addCustomPair } from '@/types';
import { PageTransition } from '@/components/ui/PageTransition';
import { MetricDisplay } from '@/components/ui/MetricDisplay';
import { motion } from 'framer-motion';

// ============================================================
// Sample News Events (would come from News.tsx logic in production)
// ============================================================

const SAMPLE_NEWS_EVENTS: UpcomingNewsEvent[] = [
  {
    id: '1',
    date: new Date().toISOString().split('T')[0],
    time: '14:30',
    currency: 'USD',
    impact: 'high',
    event: 'Non-Farm Payrolls',
    forecast: '180K',
    previous: '175K',
  },
  {
    id: '2',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    currency: 'EUR',
    impact: 'high',
    event: 'EZB Zinsentscheidung',
    forecast: '4.50%',
    previous: '4.50%',
  },
  {
    id: '3',
    date: new Date().toISOString().split('T')[0],
    time: '08:30',
    currency: 'GBP',
    impact: 'high',
    event: 'BoE Interest Rate Decision',
    forecast: '5.25%',
    previous: '5.25%',
  },
  {
    id: '4',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '02:00',
    currency: 'JPY',
    impact: 'high',
    event: 'BOJ Monetary Policy Statement',
  },
  {
    id: '5',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '13:30',
    currency: 'USD',
    impact: 'high',
    event: 'Core PCE Price Index',
    forecast: '0.2%',
    previous: '0.3%',
  },
  {
    id: '6',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    time: '04:30',
    currency: 'AUD',
    impact: 'high',
    event: 'RBA Rate Decision',
    forecast: '4.35%',
    previous: '4.35%',
  },
  {
    id: '7',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    time: '14:00',
    currency: 'CAD',
    impact: 'high',
    event: 'BoC Rate Statement',
  },
];

// ============================================================
// Tag color mapping for dot indicators
// ============================================================

const TAG_DOT_COLORS: Record<string, string> = {
  'Breakout': 'bg-blue-400',
  'Trend': 'bg-emerald-400',
  'Reversal': 'bg-amber-400',
  'Range': 'bg-purple-400',
  'News': 'bg-red-400',
  'Fundamental': 'bg-cyan-400',
  'Technical': 'bg-indigo-400',
  'Sentiment': 'bg-pink-400',
  'COT': 'bg-orange-400',
  'Seasonal': 'bg-teal-400',
  'Intermarket': 'bg-rose-400',
  'Scalp': 'bg-lime-400',
  'Swing': 'bg-violet-400',
  'Position': 'bg-sky-400',
};

function getTagDotColor(tag: string): string {
  return TAG_DOT_COLORS[tag] || 'bg-text-muted';
}

// ============================================================
// Outlook Form Modal Component
// ============================================================

interface OutlookFormProps {
  outlook?: Outlook;
  onSave: (data: Partial<Outlook>) => void;
  onClose: () => void;
}

function OutlookForm({ outlook, onSave, onClose }: OutlookFormProps) {
  const isEditing = !!outlook;
  const { getCOTBias } = useOutlookStore();
  const confluences = getConfluences();

  const [formData, setFormData] = useState<Partial<Outlook>>(() => ({
    symbol: 'EURUSD',
    direction: 'long',
    thesis: '',
    confidence: 3,
    status: 'observation',
    tags: [],
    targetEntry: undefined,
    targetSL: undefined,
    targetTP: undefined,
    expiresAt: undefined,
    ...outlook,
  }));

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Auto-update COT bias when symbol changes
  const cotBias = useMemo(() => {
    if (!formData.symbol) return null;
    return getCOTBias(formData.symbol);
  }, [formData.symbol, getCOTBias]);

  const handleChange = (field: keyof Outlook, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTagToggle = (tag: OutlookTag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...(prev.tags || []), tag]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      cotBias: cotBias || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-[#0d0f14] border border-white/[0.06] rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Target className="text-accent-primary" size={18} />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide">
              {isEditing ? 'Outlook bearbeiten' : 'Neue Trading-These'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Symbol & Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1.5">
                Symbol
              </label>
              <div className="flex gap-1.5">
                <select
                  value={formData.symbol}
                  onChange={(e) => handleChange('symbol', e.target.value)}
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-primary/50 transition-colors"
                >
                  {getAllPairs().map(pair => (
                    <option key={pair} value={pair}>{pair}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const newPair = prompt('Neues Pair eingeben (z.B. USDSEK oder US30USD):');
                    if (newPair && addCustomPair(newPair)) {
                      handleChange('symbol', newPair.replace('/', '').toUpperCase());
                    }
                  }}
                  className="px-2.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded text-text-muted hover:text-accent-primary hover:border-accent-primary/30 transition-colors"
                  title="Eigenes Pair hinzufuegen"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1.5">
                Richtung
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChange('direction', 'long')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-all',
                    formData.direction === 'long'
                      ? 'bg-pnl-positive/15 border border-pnl-positive/40 text-pnl-positive'
                      : 'bg-white/[0.03] border border-white/[0.06] text-text-muted hover:border-white/[0.1]'
                  )}
                >
                  <TrendingUp size={14} />
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('direction', 'short')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-all',
                    formData.direction === 'short'
                      ? 'bg-pnl-negative/15 border border-pnl-negative/40 text-pnl-negative'
                      : 'bg-white/[0.03] border border-white/[0.06] text-text-muted hover:border-white/[0.1]'
                  )}
                >
                  <TrendingDown size={14} />
                  Short
                </button>
              </div>
            </div>
          </div>

          {/* COT Bias Preview */}
          {cotBias && (
            <div className="p-3 bg-white/[0.03] rounded border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted">COT Bias (auto)</span>
                <span className={clsx(
                  'text-xs font-mono tabular-nums font-semibold',
                  cotBias.divergenceScore > 20 ? 'text-pnl-positive' :
                  cotBias.divergenceScore < -20 ? 'text-pnl-negative' : 'text-text-muted'
                )}>
                  {cotBias.divergenceScore > 0 ? '+' : ''}{cotBias.divergenceScore}%
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getFlagEmoji(cotBias.base.currency)}</span>
                  <span className="text-xs font-medium text-text-primary">{cotBias.base.currency}</span>
                  <span className={clsx('text-[10px] font-mono', getSignalColor(cotBias.base.signal))}>
                    {cotBias.base.signal.replace('_', ' ').toUpperCase()} ({cotBias.base.percentile}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{getFlagEmoji(cotBias.quote.currency)}</span>
                  <span className="text-xs font-medium text-text-primary">{cotBias.quote.currency}</span>
                  <span className={clsx('text-[10px] font-mono', getSignalColor(cotBias.quote.signal))}>
                    {cotBias.quote.signal.replace('_', ' ').toUpperCase()} ({cotBias.quote.percentile}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Thesis */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1.5">
              Trading-These
            </label>
            <textarea
              value={formData.thesis}
              onChange={(e) => handleChange('thesis', e.target.value)}
              placeholder="Beschreibe deine Trading-These..."
              rows={3}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-text-muted/40"
              required
            />
          </div>

          {/* Confidence */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1.5">
              Confidence
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleChange('confidence', level as ConfidenceLevel)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded text-xs font-medium transition-all',
                    formData.confidence === level
                      ? 'bg-accent-gold/15 border border-accent-gold/40 text-accent-gold'
                      : 'bg-white/[0.03] border border-white/[0.06] text-text-muted hover:border-white/[0.1]'
                  )}
                >
                  <Star
                    size={12}
                    className={formData.confidence! >= level ? 'fill-current' : ''}
                  />
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1.5">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['observation', 'waiting', 'active'] as OutlookStatus[]).map((status) => {
                const config = OUTLOOK_STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleChange('status', status)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all',
                      formData.status === status
                        ? `${config.bgColor} ${config.color} border border-current/30`
                        : 'bg-white/[0.03] border border-white/[0.06] text-text-muted hover:border-white/[0.1]'
                    )}
                  >
                    {getStatusIcon(status)}
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confluences */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1.5">
              Confluences
            </label>
            <div className="flex flex-wrap gap-1.5">
              {confluences.map((tag: string) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag as OutlookTag)}
                  className={clsx(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all',
                    formData.tags?.includes(tag)
                      ? 'bg-accent-primary/15 border border-accent-primary/40 text-accent-primary'
                      : 'bg-white/[0.03] border border-white/[0.06] text-text-muted hover:border-white/[0.1]'
                  )}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full', getTagDotColor(tag))} />
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronDown
              size={12}
              className={clsx('transition-transform', showAdvanced && 'rotate-180')}
            />
            Erweiterte Optionen
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-3 p-3 bg-white/[0.03] rounded border border-white/[0.06]">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1">
                    Entry
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formData.targetEntry || ''}
                    onChange={(e) => handleChange('targetEntry', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0850"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-1.5 text-xs text-text-primary font-mono tabular-nums focus:outline-none focus:border-accent-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1">
                    Stop Loss
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formData.targetSL || ''}
                    onChange={(e) => handleChange('targetSL', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0800"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-1.5 text-xs text-text-primary font-mono tabular-nums focus:outline-none focus:border-accent-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1">
                    Take Profit
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formData.targetTP || ''}
                    onChange={(e) => handleChange('targetTP', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0950"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-1.5 text-xs text-text-primary font-mono tabular-nums focus:outline-none focus:border-accent-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted mb-1">
                  Gueltig bis
                </label>
                <input
                  type="date"
                  value={formData.expiresAt || ''}
                  onChange={(e) => handleChange('expiresAt', e.target.value || undefined)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/[0.1] transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2"
            >
              <Save size={14} />
              {isEditing ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================================
// Outlook Card Component
// ============================================================

interface OutlookCardProps {
  outlook: Outlook;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: OutlookStatus) => void;
  onTransfer: () => void;
  onStart: () => void;
  onClose: () => void;
}

function OutlookCard({ outlook, onEdit, onDelete, onStatusChange, onTransfer, onStart, onClose }: OutlookCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusConfig = OUTLOOK_STATUS_CONFIG[outlook.status];

  // Get upcoming news for this pair's currencies
  const currencies = getCurrenciesFromSymbol(outlook.symbol);
  const upcomingNews = getUpcomingHighImpactNews(currencies, SAMPLE_NEWS_EVENTS, 3);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Heute';
    if (date.toDateString() === tomorrow.toDateString()) return 'Morgen';
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const directionColor = outlook.direction === 'long' ? 'border-l-pnl-positive' : 'border-l-pnl-negative';

  return (
    <div className={clsx(
      'bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden transition-all hover:border-white/[0.1] hover:bg-white/[0.04]',
      'border-l-2',
      directionColor
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="text-sm font-bold font-mono tracking-wide text-text-primary">
            {outlook.symbol}
          </h3>
          <span className={clsx(
            'text-[10px] uppercase tracking-[0.1em] font-bold',
            outlook.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative'
          )}>
            {outlook.direction}
          </span>
          {/* Confidence dots */}
          <div className="flex items-center gap-0.5 ml-1">
            {[1, 2, 3, 4, 5].map(level => (
              <span
                key={level}
                className={clsx(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  level <= outlook.confidence
                    ? 'bg-accent-gold'
                    : 'bg-white/[0.08]'
                )}
              />
            ))}
          </div>
          {/* Tags as colored dots */}
          {outlook.tags && outlook.tags.length > 0 && (
            <div className="flex items-center gap-0.5 ml-1" title={outlook.tags.join(', ')}>
              {outlook.tags.map(tag => (
                <span
                  key={tag}
                  className={clsx('w-1.5 h-1.5 rounded-full', getTagDotColor(tag))}
                  title={tag}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status pill */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.05em] transition-all',
              statusConfig.bgColor,
              statusConfig.color,
              'opacity-80 hover:opacity-100'
            )}
          >
            {getStatusIcon(outlook.status)}
            {statusConfig.label}
            <ChevronDown size={10} />
          </button>

          {/* Status Dropdown */}
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[#0d0f14] border border-white/[0.08] rounded-lg shadow-xl z-10 py-0.5 min-w-[140px]">
              {Object.entries(OUTLOOK_STATUS_CONFIG).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => {
                    onStatusChange(status as OutlookStatus);
                    setShowStatusMenu(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-left hover:bg-white/[0.05] transition-colors',
                    outlook.status === status && 'bg-white/[0.05]'
                  )}
                >
                  {getStatusIcon(status as OutlookStatus)}
                  <span className={config.color}>{config.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Thesis - compact */}
      <p className="text-text-secondary text-xs leading-relaxed px-3.5 pb-2 line-clamp-2">
        {outlook.thesis}
      </p>

      {/* COT Bias - horizontal compact */}
      {outlook.cotBias && (
        <div className="mx-3.5 mb-2 px-2.5 py-1.5 bg-white/[0.02] rounded border border-white/[0.04] flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted">COT</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">{getFlagEmoji(outlook.cotBias.base.currency)}</span>
              <span className="text-[10px] font-mono text-text-primary">{outlook.cotBias.base.currency}</span>
              <span className={clsx('text-[10px] font-mono', getSignalColor(outlook.cotBias.base.signal))}>
                {outlook.cotBias.base.signal.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-text-muted">{outlook.cotBias.base.percentile}%</span>
            </div>
            <div className="w-px h-3 bg-white/[0.06]" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">{getFlagEmoji(outlook.cotBias.quote.currency)}</span>
              <span className="text-[10px] font-mono text-text-primary">{outlook.cotBias.quote.currency}</span>
              <span className={clsx('text-[10px] font-mono', getSignalColor(outlook.cotBias.quote.signal))}>
                {outlook.cotBias.quote.signal.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-[10px] font-mono tabular-nums text-text-muted">{outlook.cotBias.quote.percentile}%</span>
            </div>
            <div className="w-px h-3 bg-white/[0.06]" />
            <span className={clsx(
              'text-[10px] font-mono tabular-nums font-bold',
              outlook.cotBias.divergenceScore > 20
                ? 'text-pnl-positive'
                : outlook.cotBias.divergenceScore < -20
                  ? 'text-pnl-negative'
                  : 'text-text-muted'
            )}>
              {outlook.cotBias.divergenceScore > 0 ? '+' : ''}{outlook.cotBias.divergenceScore}%
            </span>
          </div>
        </div>
      )}

      {/* Upcoming News - inline badges */}
      {upcomingNews.length > 0 && (
        <div className="mx-3.5 mb-2 flex items-center gap-1.5 flex-wrap">
          <Newspaper size={10} className="text-pnl-negative/70 flex-shrink-0" />
          {upcomingNews.map(event => (
            <span
              key={event.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-pnl-negative/8 border border-pnl-negative/15 text-[10px] text-pnl-negative/80"
            >
              <span className="font-medium">{event.currency}</span>
              <span className="opacity-60">{formatDate(event.date)} {event.time}</span>
            </span>
          ))}
        </div>
      )}

      {/* Price targets - inline */}
      {(outlook.targetEntry || outlook.targetSL || outlook.targetTP) && (
        <div className="mx-3.5 mb-2 flex items-center gap-3 text-[10px] font-mono tabular-nums">
          {outlook.targetEntry && (
            <span>
              <span className="text-text-muted uppercase tracking-[0.05em]">E </span>
              <span className="text-text-primary font-semibold">{outlook.targetEntry}</span>
            </span>
          )}
          {outlook.targetSL && (
            <span>
              <span className="text-text-muted uppercase tracking-[0.05em]">SL </span>
              <span className="text-pnl-negative font-semibold">{outlook.targetSL}</span>
            </span>
          )}
          {outlook.targetTP && (
            <span>
              <span className="text-text-muted uppercase tracking-[0.05em]">TP </span>
              <span className="text-pnl-positive font-semibold">{outlook.targetTP}</span>
            </span>
          )}
        </div>
      )}

      {/* Expiry Warning */}
      {outlook.expiresAt && new Date(outlook.expiresAt) < new Date(Date.now() + 86400000 * 2) && (
        <div className="mx-3.5 mb-2 flex items-center gap-1 text-[10px] text-accent-gold">
          <AlertCircle size={10} />
          <span>Ablauf: {new Date(outlook.expiresAt).toLocaleDateString('de-DE')}</span>
        </div>
      )}

      {/* Actions row - subtle */}
      <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-text-muted font-mono tabular-nums mr-1.5">
            {new Date(outlook.createdAt).toLocaleDateString('de-DE')}
          </span>
          <button
            onClick={onEdit}
            className="p-1 text-text-muted/50 hover:text-accent-primary rounded transition-colors"
            title="Bearbeiten"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-text-muted/50 hover:text-pnl-negative rounded transition-colors"
            title="Loeschen"
          >
            <Trash2 size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Start button for observation / waiting */}
          {(outlook.status === 'observation' || outlook.status === 'waiting') && (
            <button
              onClick={onStart}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-[0.05em] font-semibold text-pnl-positive hover:bg-pnl-positive/10 rounded transition-colors"
              title="Trade starten"
            >
              <Play size={10} />
              Starten
            </button>
          )}

          {/* Close button for active trades */}
          {outlook.status === 'active' && (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-[0.05em] font-semibold text-accent-gold hover:bg-accent-gold/10 rounded transition-colors"
              title="Trade abschliessen"
            >
              <CheckCircle2 size={10} />
              Abschließen
            </button>
          )}

          {/* Legacy journal transfer (non-active, non-executed, non-cancelled) */}
          {outlook.status !== 'executed' && outlook.status !== 'cancelled' && outlook.status !== 'active' && outlook.status !== 'observation' && outlook.status !== 'waiting' && (
            <button
              onClick={onTransfer}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-[0.05em] font-semibold text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
            >
              Journal
              <ArrowRight size={10} />
            </button>
          )}

          {outlook.status === 'executed' && outlook.executedTradeId && (
            <span className="text-[10px] text-accent-primary/70 flex items-center gap-1 font-mono">
              <CheckCircle2 size={10} />
              #{outlook.executedTradeId.slice(-6)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TradingView Import Modal Component
// ============================================================

interface ImportModalProps {
  onClose: () => void;
  onImport: (symbols: string[]) => void;
}

function ImportModal({ onClose, onImport }: ImportModalProps) {
  const [inputText, setInputText] = useState('');
  const [previewSymbols, setPreviewSymbols] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  // Parse import text for symbols
  const parseImportText = (text: string): string[] => {
    const lines = text.split(/[\n,;\t]+/).map(line => line.trim()).filter(Boolean);
    const symbols: string[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      for (const part of parts) {
        let cleaned = part.trim().toUpperCase();
        if (cleaned.includes(':')) {
          cleaned = cleaned.split(':')[1];
        }
        cleaned = cleaned.replace('/', '');
        if (cleaned.length >= 6) {
          symbols.push(cleaned);
        }
      }
    }

    return [...new Set(symbols)];
  };

  // Preview parsed symbols
  useEffect(() => {
    if (inputText.trim()) {
      const parsed = parseImportText(inputText);
      setPreviewSymbols(parsed);
    } else {
      setPreviewSymbols([]);
    }
  }, [inputText]);

  const handleImport = () => {
    onImport(previewSymbols);
    setImportedCount(previewSymbols.length);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText(text);
    } catch (err) {
      console.error('Paste failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-[#0d0f14] border border-white/[0.06] rounded-lg shadow-2xl w-full max-w-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Upload className="text-accent-primary" size={18} />
            <h2 className="text-sm font-semibold text-text-primary tracking-wide">
              TradingView Import
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {importedCount !== null ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-pnl-positive/15 flex items-center justify-center mx-auto mb-3">
                <Check className="text-pnl-positive" size={24} />
              </div>
              <p className="text-sm font-semibold text-text-primary">
                {importedCount} Outlooks werden erstellt!
              </p>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="p-3 bg-accent-primary/5 border border-accent-primary/10 rounded">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  <strong className="text-accent-primary">Tipp:</strong> Kopiere deine TradingView Watchlist
                  oder fuege Symbole wie <code className="bg-white/[0.05] px-1 rounded font-mono text-[10px]">OANDA:EURUSD</code>,
                  <code className="bg-white/[0.05] px-1 rounded font-mono text-[10px]">EURUSD</code> ein.
                </p>
              </div>

              {/* Input Area */}
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Symbole hier einfuegen...&#10;&#10;OANDA:EURUSD&#10;GBPUSD&#10;BTCUSD&#10;..."
                  rows={7}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded px-3 py-2 text-xs text-text-primary font-mono resize-none focus:outline-none focus:border-accent-primary/50 transition-colors placeholder:text-text-muted/30"
                />
                <button
                  onClick={handlePaste}
                  className="absolute top-2 right-2 p-1.5 text-text-muted/40 hover:text-accent-primary rounded transition-colors"
                  title="Aus Zwischenablage einfuegen"
                >
                  <Copy size={14} />
                </button>
              </div>

              {/* Preview */}
              {previewSymbols.length > 0 && (
                <div className="p-3 bg-white/[0.03] rounded border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted">
                      Erkannte Symbole
                    </span>
                    <span className="text-[10px] text-accent-primary font-mono font-semibold">
                      {previewSymbols.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {previewSymbols.slice(0, 20).map((symbol, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 bg-white/[0.05] text-text-primary text-[10px] rounded font-mono"
                      >
                        {symbol}
                      </span>
                    ))}
                    {previewSymbols.length > 20 && (
                      <span className="px-1.5 py-0.5 text-text-muted text-[10px]">
                        +{previewSymbols.length - 20}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {importedCount === null && (
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/[0.1] transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleImport}
              disabled={previewSymbols.length === 0}
              className="btn-primary flex items-center gap-1.5 text-xs px-4 py-2 disabled:opacity-30"
            >
              <Upload size={14} />
              {previewSymbols.length} importieren
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ============================================================
// Helper Functions
// ============================================================

function getStatusIcon(status: OutlookStatus) {
  switch (status) {
    case 'observation': return <Eye size={14} />;
    case 'waiting': return <Pause size={14} />;
    case 'active': return <Play size={14} />;
    case 'cancelled': return <XCircle size={14} />;
    case 'executed': return <CheckCircle2 size={14} />;
  }
}

function getSignalColor(signal: string): string {
  switch (signal) {
    case 'strong_long': return 'text-pnl-positive';
    case 'long': return 'text-pnl-positive/80';
    case 'neutral': return 'text-text-muted';
    case 'short': return 'text-pnl-negative/80';
    case 'strong_short': return 'text-pnl-negative';
    default: return 'text-text-muted';
  }
}

function getFlagEmoji(currency: string): string {
  const flags: Record<string, string> = {
    EUR: '\u{1F1EA}\u{1F1FA}',
    USD: '\u{1F1FA}\u{1F1F8}',
    GBP: '\u{1F1EC}\u{1F1E7}',
    JPY: '\u{1F1EF}\u{1F1F5}',
    AUD: '\u{1F1E6}\u{1F1FA}',
    NZD: '\u{1F1F3}\u{1F1FF}',
    CAD: '\u{1F1E8}\u{1F1E6}',
    CHF: '\u{1F1E8}\u{1F1ED}',
  };
  return flags[currency] || '\u{1F3F3}\u{FE0F}';
}

// ============================================================
// Stagger animation variants
// ============================================================

const cardContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const cardItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

// ============================================================
// Main Outlook Page Component
// ============================================================

export function Outlook() {
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const {
    loadOutlooks,
    outlooks,
    isLoading,
    getFilteredOutlooks,
    saveOutlook,
    deleteOutlook,
    setStatus,
    filters,
    setFilters,
    isFormOpen,
    openForm,
    closeForm,
    selectedOutlook,
    transferToJournal,
    prefillTradeData,
    clearPrefillData,
    downloadExport,
    importOutlooks,
    startTrade,
    closeTrade,
  } = useOutlookStore();

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [closeDialog, setCloseDialog] = useState<string | null>(null);
  const [closeAccounts, setCloseAccounts] = useState<{ ek: boolean; funded: boolean }>({ ek: false, funded: false });

  useEffect(() => {
    loadOutlooks();
  }, []);

  // Handle TradingView import - create outlook for each symbol
  const handleTradingViewImport = (symbols: string[]) => {
    let created = 0;
    for (const symbol of symbols) {
      // Only create if not already exists
      const exists = outlooks.some(o => o.symbol === symbol && o.status !== 'executed' && o.status !== 'cancelled');
      if (!exists) {
        saveOutlook({
          symbol,
          direction: 'long',
          thesis: `Imported from TradingView - Analyse pending`,
          confidence: 3,
          status: 'observation',
          tags: [],
        });
        created++;
      }
    }
    showToast(`${created} neue Outlooks erstellt`, 'success');
    loadOutlooks();
  };

  // Navigate to journal when prefill data is set (after closeTrade)
  useEffect(() => {
    if (prefillTradeData) {
      showToast('Outlook wird in Journal übernommen...', 'success');
      sessionStorage.setItem('tradePrefill', JSON.stringify(prefillTradeData));
      const targets = prefillTradeData.targetAccounts ?? ['ek'];
      clearPrefillData();
      navigate(targets[0] === 'funded' ? '/funded' : '/ek');
    }
  }, [prefillTradeData, navigate, clearPrefillData, showToast]);

  // Close-Trade-Handler: ruft closeTrade auf und schließt Dialog
  const handleConfirmClose = () => {
    if (!closeDialog) return;
    const accounts: ('ek' | 'funded')[] = [];
    if (closeAccounts.ek)     accounts.push('ek');
    if (closeAccounts.funded) accounts.push('funded');
    if (accounts.length === 0) {
      showToast('Bitte mindestens ein Konto auswählen', 'error');
      return;
    }
    closeTrade(closeDialog, accounts);
    setCloseDialog(null);
    setCloseAccounts({ ek: false, funded: false });
    showToast('Trade abgeschlossen – Journal wird geöffnet', 'success');
  };

  const filteredOutlooks = getFilteredOutlooks();

  const handleSave = (data: Partial<Outlook>) => {
    saveOutlook(data);
    showToast(
      selectedOutlook ? 'Outlook aktualisiert' : 'Neuer Outlook erstellt',
      'success'
    );
  };

  const handleDelete = (id: string) => {
    deleteOutlook(id);
    setDeleteConfirm(null);
    showToast('Outlook geloescht', 'success');
  };

  const handleTransfer = (id: string) => {
    transferToJournal(id);
  };

  // Handle JSON Export
  const handleExport = () => {
    downloadExport();
    showToast('Outlooks exportiert', 'success');
  };

  // Handle JSON Import
  const handleFileImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = importOutlooks(text);
        if (result.success) {
          showToast(`${result.count} Outlooks importiert`, 'success');
          loadOutlooks(); // Refresh the list
        } else {
          showToast(result.error || 'Import fehlgeschlagen', 'error');
        }
      } catch (error) {
        showToast('Fehler beim Lesen der Datei', 'error');
      }
    };
    input.click();
  };

  // Stats
  const stats = useMemo(() => ({
    total: outlooks.length,
    active: outlooks.filter(o => o.status === 'active').length,
    waiting: outlooks.filter(o => o.status === 'waiting').length,
    observation: outlooks.filter(o => o.status === 'observation').length,
    executed: outlooks.filter(o => o.status === 'executed').length,
  }), [outlooks]);

  return (
    <PageTransition>
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Target className="text-accent-primary" size={20} />
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">
              Market Intelligence
            </h1>
            <p className="text-[10px] uppercase tracking-[0.1em] text-text-muted font-semibold">
              Trading Outlook & Thesen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-text-muted hover:text-text-primary bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/[0.1] transition-colors"
            title="TradingView Watchlist importieren"
          >
            <Copy size={13} />
            TV Import
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 text-text-muted hover:text-text-primary bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/[0.1] transition-colors"
            title="Als JSON exportieren"
          >
            <Download size={14} />
          </button>
          <button
            onClick={handleFileImport}
            className="p-1.5 text-text-muted hover:text-text-primary bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/[0.1] transition-colors"
            title="JSON importieren"
          >
            <Upload size={14} />
          </button>
          <button
            onClick={() => openForm()}
            className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
          >
            <Plus size={14} />
            Neue These
          </button>
        </div>
      </div>

      {/* Compact Stats Strip */}
      <div className="flex items-end gap-8 px-4 py-3 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
        <MetricDisplay label="Gesamt" value={stats.total} size="sm" />
        <MetricDisplay label="Aktiv" value={stats.active} size="sm" />
        <MetricDisplay label="Wartend" value={stats.waiting} size="sm" />
        <MetricDisplay label="Beobachtung" value={stats.observation} size="sm" />
        <MetricDisplay label="Ausgefuehrt" value={stats.executed} size="sm" />
      </div>

      {/* Filter Bar - pill style */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <Filter size={12} className="text-text-muted/50" />
          <div className="flex gap-0.5">
            {['all', 'observation', 'waiting', 'active'].map(status => (
              <button
                key={status}
                onClick={() => setFilters({ status: status as OutlookStatus | 'all' })}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                  filters.status === status
                    ? 'bg-accent-primary text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.05]'
                )}
              >
                {status === 'all' ? 'Alle' : OUTLOOK_STATUS_CONFIG[status as OutlookStatus].label}
              </button>
            ))}
          </div>
        </div>

        {/* Direction Filter */}
        <div className="flex gap-0.5">
          {[
            { value: 'all', label: 'Alle', icon: null },
            { value: 'long', label: 'Long', icon: <TrendingUp size={11} /> },
            { value: 'short', label: 'Short', icon: <TrendingDown size={11} /> },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setFilters({ direction: option.value as 'long' | 'short' | 'all' })}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                filters.direction === option.value
                  ? 'bg-accent-primary text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-white/[0.05]'
              )}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={(e) => {
            const [sortBy, sortOrder] = e.target.value.split('-') as ['date' | 'confidence' | 'symbol', 'asc' | 'desc'];
            setFilters({ sortBy, sortOrder });
          }}
          className="bg-white/[0.03] border border-white/[0.06] rounded-full px-2.5 py-1 text-[11px] text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
        >
          <option value="date-desc">Neueste zuerst</option>
          <option value="date-asc">Aelteste zuerst</option>
          <option value="confidence-desc">Hoechste Confidence</option>
          <option value="confidence-asc">Niedrigste Confidence</option>
          <option value="symbol-asc">Symbol A-Z</option>
          <option value="symbol-desc">Symbol Z-A</option>
        </select>

        {/* Show Archived */}
        <label className="flex items-center gap-1.5 text-[11px] text-text-muted cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(e) => setFilters({ showArchived: e.target.checked })}
            className="rounded border-white/[0.1] bg-white/[0.03] w-3 h-3"
          />
          Archiv
        </label>
      </div>

      {/* Outlooks Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 size={32} className="text-accent-primary/50 mb-3 animate-spin" />
          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-text-muted">
            Laden...
          </span>
        </div>
      ) : filteredOutlooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Target size={32} className="text-text-muted/30 mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            Keine Outlooks
          </h3>
          <p className="text-[11px] text-text-muted mb-4">
            {outlooks.length === 0
              ? 'Erstelle deine erste Trading-These.'
              : 'Keine Outlooks entsprechen den Filtern.'}
          </p>
          {outlooks.length === 0 && (
            <button
              onClick={() => openForm()}
              className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Plus size={14} />
              Erste These
            </button>
          )}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-3"
          variants={cardContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredOutlooks.map(outlook => (
            <motion.div key={outlook.id} variants={cardItemVariants}>
              <OutlookCard
                outlook={outlook}
                onEdit={() => openForm(outlook)}
                onDelete={() => setDeleteConfirm(outlook.id)}
                onStatusChange={(status) => setStatus(outlook.id, status)}
                onTransfer={() => handleTransfer(outlook.id)}
                onStart={() => startTrade(outlook.id)}
                onClose={() => setCloseDialog(outlook.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <OutlookForm
          outlook={selectedOutlook || undefined}
          onSave={handleSave}
          onClose={closeForm}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="bg-[#0d0f14] border border-white/[0.06] rounded-lg shadow-2xl p-5 max-w-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-pnl-negative/15 flex items-center justify-center">
                <Trash2 className="text-pnl-negative" size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Outlook loeschen?</h3>
                <p className="text-[11px] text-text-muted">Kann nicht rueckgaengig gemacht werden.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/[0.1] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-3 py-1.5 text-xs font-medium bg-pnl-negative hover:bg-pnl-negative/90 text-white rounded transition-colors"
              >
                Loeschen
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* TradingView Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleTradingViewImport}
        />
      )}

      {/* ── Close-Trade-Dialog ── */}
      {closeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="bg-[#0d0f14] border border-white/[0.06] rounded-lg shadow-2xl p-5 max-w-sm w-full"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-accent-gold/15 flex items-center justify-center">
                <CheckCircle2 className="text-accent-gold" size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Trade abschließen</h3>
                <p className="text-[11px] text-text-muted">In welche(s) Journal soll der Trade eingetragen werden?</p>
              </div>
            </div>

            {/* Account-Auswahl */}
            <div className="space-y-2 mb-5">
              {(
                [
                  { key: 'ek'     as const, label: 'Eigenkapital-Journal' },
                  { key: 'funded' as const, label: 'Funded-Journal'       },
                ] as const
              ).map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.06] hover:border-accent-primary/30 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={closeAccounts[key]}
                    onChange={e => setCloseAccounts(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-3.5 h-3.5 rounded accent-accent-primary"
                  />
                  <span className="text-sm text-text-primary">{label}</span>
                </label>
              ))}
            </div>

            {/* Aktionen */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setCloseDialog(null); setCloseAccounts({ ek: false, funded: false }); }}
                className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary bg-white/[0.03] border border-white/[0.06] rounded hover:border-white/[0.1] transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmClose}
                disabled={!closeAccounts.ek && !closeAccounts.funded}
                className="px-3 py-1.5 text-xs font-medium bg-accent-gold hover:bg-accent-gold/90 disabled:opacity-40 text-black rounded transition-colors"
              >
                Abschließen & Journalen
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
