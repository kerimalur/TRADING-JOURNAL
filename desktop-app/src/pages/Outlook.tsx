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
  Tag,
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
import { OUTLOOK_STATUS_CONFIG, OUTLOOK_TAGS, getAllPairs, addCustomPair } from '@/types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background-surface border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <Target className="text-accent-primary" size={24} />
            {isEditing ? 'Outlook bearbeiten' : 'Neue Trading-These'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-background-surface-hover rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Symbol & Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Symbol
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.symbol}
                  onChange={(e) => handleChange('symbol', e.target.value)}
                  className="input-field flex-1"
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
                  className="px-3 py-2 bg-background border border-border rounded-lg text-text-muted hover:text-accent-primary hover:border-accent-primary transition-colors"
                  title="Eigenes Pair hinzufügen"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Richtung
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('direction', 'long')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all',
                    formData.direction === 'long'
                      ? 'bg-pnl-positive/20 border-pnl-positive text-pnl-positive'
                      : 'bg-background border-border text-text-muted hover:border-border-hover'
                  )}
                >
                  <TrendingUp size={18} />
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('direction', 'short')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all',
                    formData.direction === 'short'
                      ? 'bg-pnl-negative/20 border-pnl-negative text-pnl-negative'
                      : 'bg-background border-border text-text-muted hover:border-border-hover'
                  )}
                >
                  <TrendingDown size={18} />
                  Short
                </button>
              </div>
            </div>
          </div>
          
          {/* COT Bias Preview */}
          {cotBias && (
            <div className="p-4 bg-background rounded-lg border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-secondary">COT Bias (automatisch)</span>
                <span className={clsx(
                  'text-sm font-semibold',
                  cotBias.divergenceScore > 20 ? 'text-pnl-positive' :
                  cotBias.divergenceScore < -20 ? 'text-pnl-negative' : 'text-text-muted'
                )}>
                  Divergenz: {cotBias.divergenceScore > 0 ? '+' : ''}{cotBias.divergenceScore}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getFlagEmoji(cotBias.base.currency)}</span>
                  <div>
                    <div className="text-sm font-medium text-text-primary">{cotBias.base.currency}</div>
                    <div className={clsx(
                      'text-xs font-medium',
                      getSignalColor(cotBias.base.signal)
                    )}>
                      {cotBias.base.signal.replace('_', ' ').toUpperCase()} ({cotBias.base.percentile}%)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getFlagEmoji(cotBias.quote.currency)}</span>
                  <div>
                    <div className="text-sm font-medium text-text-primary">{cotBias.quote.currency}</div>
                    <div className={clsx(
                      'text-xs font-medium',
                      getSignalColor(cotBias.quote.signal)
                    )}>
                      {cotBias.quote.signal.replace('_', ' ').toUpperCase()} ({cotBias.quote.percentile}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Thesis */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Trading-These
            </label>
            <textarea
              value={formData.thesis}
              onChange={(e) => handleChange('thesis', e.target.value)}
              placeholder="Beschreibe deine Trading-These... z.B. fundamentale Gründe, technische Setups, Marktbedingungen..."
              rows={4}
              className="input-field w-full resize-none"
              required
            />
          </div>
          
          {/* Confidence */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Confidence Level
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleChange('confidence', level as ConfidenceLevel)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-all',
                    formData.confidence === level
                      ? 'bg-accent-gold/20 border-accent-gold text-accent-gold'
                      : 'bg-background border-border text-text-muted hover:border-border-hover'
                  )}
                >
                  <Star 
                    size={16} 
                    className={formData.confidence! >= level ? 'fill-current' : ''} 
                  />
                  {level}
                </button>
              ))}
            </div>
          </div>
          
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {(['observation', 'waiting', 'active'] as OutlookStatus[]).map((status) => {
                const config = OUTLOOK_STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleChange('status', status)}
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
                      formData.status === status
                        ? `${config.bgColor} ${config.color} border-current`
                        : 'bg-background border-border text-text-muted hover:border-border-hover'
                    )}
                  >
                    {getStatusIcon(status)}
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {OUTLOOK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag as OutlookTag)}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all',
                    formData.tags?.includes(tag)
                      ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                      : 'bg-background border-border text-text-muted hover:border-border-hover'
                  )}
                >
                  <Tag size={12} />
                  {tag}
                </button>
              ))}
            </div>
          </div>
          
          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronDown 
              size={16} 
              className={clsx('transition-transform', showAdvanced && 'rotate-180')} 
            />
            Erweiterte Optionen
          </button>
          
          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 bg-background rounded-lg border border-border">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Entry (optional)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formData.targetEntry || ''}
                    onChange={(e) => handleChange('targetEntry', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0850"
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Stop Loss (optional)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formData.targetSL || ''}
                    onChange={(e) => handleChange('targetSL', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0800"
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    Take Profit (optional)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formData.targetTP || ''}
                    onChange={(e) => handleChange('targetTP', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1.0950"
                    className="input-field w-full text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Gültig bis (optional)
                </label>
                <input
                  type="date"
                  value={formData.expiresAt || ''}
                  onChange={(e) => handleChange('expiresAt', e.target.value || undefined)}
                  className="input-field w-full text-sm"
                />
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
            >
              <Save size={18} />
              {isEditing ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
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
}

function OutlookCard({ outlook, onEdit, onDelete, onStatusChange, onTransfer }: OutlookCardProps) {
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

  return (
    <div className="card hover:border-border-hover transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'flex items-center justify-center w-12 h-12 rounded-xl',
            outlook.direction === 'long' ? 'bg-pnl-positive/20' : 'bg-pnl-negative/20'
          )}>
            {outlook.direction === 'long' 
              ? <TrendingUp className="text-pnl-positive" size={24} /> 
              : <TrendingDown className="text-pnl-negative" size={24} />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-text-primary">
                {outlook.symbol}
              </h3>
              <span className={clsx(
                'text-sm font-medium',
                outlook.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative'
              )}>
                {outlook.direction.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {/* Confidence Stars */}
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(level => (
                  <Star
                    key={level}
                    size={12}
                    className={clsx(
                      level <= outlook.confidence 
                        ? 'text-accent-gold fill-accent-gold' 
                        : 'text-border'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-text-muted">
                {new Date(outlook.createdAt).toLocaleDateString('de-DE')}
              </span>
            </div>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {getStatusIcon(outlook.status)}
            {statusConfig.label}
            <ChevronDown size={14} />
          </button>
          
          {/* Status Dropdown */}
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 bg-background-surface border border-border rounded-lg shadow-xl z-10 py-1 min-w-[160px]">
              {Object.entries(OUTLOOK_STATUS_CONFIG).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => {
                    onStatusChange(status as OutlookStatus);
                    setShowStatusMenu(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-background-surface-hover transition-colors',
                    outlook.status === status && 'bg-background-surface-hover'
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
      
      {/* Thesis */}
      <p className="text-text-secondary text-sm leading-relaxed mb-4 line-clamp-3">
        {outlook.thesis}
      </p>
      
      {/* Tags */}
      {outlook.tags && outlook.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {outlook.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background text-xs text-text-muted"
            >
              <Tag size={10} />
              {tag}
            </span>
          ))}
        </div>
      )}
      
      {/* COT Bias */}
      {outlook.cotBias && (
        <div className="p-3 bg-background rounded-lg mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-muted">COT Bias</span>
            <span className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded',
              outlook.cotBias.divergenceScore > 20 
                ? 'bg-pnl-positive/20 text-pnl-positive' 
                : outlook.cotBias.divergenceScore < -20 
                  ? 'bg-pnl-negative/20 text-pnl-negative' 
                  : 'bg-background-surface text-text-muted'
            )}>
              {outlook.cotBias.divergenceScore > 0 ? '+' : ''}{outlook.cotBias.divergenceScore}% Divergenz
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">{getFlagEmoji(outlook.cotBias.base.currency)}</span>
              <div className="flex-1">
                <div className="text-xs font-medium text-text-primary">{outlook.cotBias.base.currency}</div>
                <div className={clsx('text-[10px]', getSignalColor(outlook.cotBias.base.signal))}>
                  {outlook.cotBias.base.signal.replace('_', ' ').toUpperCase()}
                </div>
              </div>
              <div className="text-xs text-text-muted">{outlook.cotBias.base.percentile}%</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{getFlagEmoji(outlook.cotBias.quote.currency)}</span>
              <div className="flex-1">
                <div className="text-xs font-medium text-text-primary">{outlook.cotBias.quote.currency}</div>
                <div className={clsx('text-[10px]', getSignalColor(outlook.cotBias.quote.signal))}>
                  {outlook.cotBias.quote.signal.replace('_', ' ').toUpperCase()}
                </div>
              </div>
              <div className="text-xs text-text-muted">{outlook.cotBias.quote.percentile}%</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Upcoming News */}
      {upcomingNews.length > 0 && (
        <div className="p-3 bg-pnl-negative/5 border border-pnl-negative/20 rounded-lg mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Newspaper size={14} className="text-pnl-negative" />
            <span className="text-xs font-medium text-pnl-negative">High Impact News</span>
          </div>
          <div className="space-y-1.5">
            {upcomingNews.map(event => (
              <div key={event.id} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-text-muted w-14">{formatDate(event.date)}</span>
                <span className="text-text-muted">{event.time}</span>
                <span className="font-medium text-text-primary">{event.currency}</span>
                <span className="text-text-secondary flex-1 truncate">{event.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Price Targets */}
      {(outlook.targetEntry || outlook.targetSL || outlook.targetTP) && (
        <div className="flex items-center gap-4 mb-4 text-xs">
          {outlook.targetEntry && (
            <div>
              <span className="text-text-muted">Entry:</span>
              <span className="ml-1 text-text-primary font-medium">{outlook.targetEntry}</span>
            </div>
          )}
          {outlook.targetSL && (
            <div>
              <span className="text-text-muted">SL:</span>
              <span className="ml-1 text-pnl-negative font-medium">{outlook.targetSL}</span>
            </div>
          )}
          {outlook.targetTP && (
            <div>
              <span className="text-text-muted">TP:</span>
              <span className="ml-1 text-pnl-positive font-medium">{outlook.targetTP}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Expiry Warning */}
      {outlook.expiresAt && new Date(outlook.expiresAt) < new Date(Date.now() + 86400000 * 2) && (
        <div className="flex items-center gap-2 mb-4 text-xs text-accent-gold">
          <AlertCircle size={14} />
          Läuft ab: {new Date(outlook.expiresAt).toLocaleDateString('de-DE')}
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 rounded-lg transition-colors"
            title="Bearbeiten"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-text-muted hover:text-pnl-negative hover:bg-pnl-negative/10 rounded-lg transition-colors"
            title="Löschen"
          >
            <Trash2 size={16} />
          </button>
        </div>
        
        {outlook.status !== 'executed' && outlook.status !== 'cancelled' && (
          <button
            onClick={onTransfer}
            className="btn-primary text-sm flex items-center gap-2"
          >
            <ArrowRight size={16} />
            In Journal übernehmen
          </button>
        )}
        
        {outlook.status === 'executed' && outlook.executedTradeId && (
          <span className="text-xs text-accent-primary flex items-center gap-1">
            <CheckCircle2 size={14} />
            Trade #{outlook.executedTradeId.slice(-6)}
          </span>
        )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background-surface border border-border rounded-xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <Upload className="text-accent-primary" size={24} />
            TradingView Symbole importieren
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-background-surface-hover rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4">
          {importedCount !== null ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-pnl-positive/20 flex items-center justify-center mx-auto mb-4">
                <Check className="text-pnl-positive" size={32} />
              </div>
              <p className="text-lg font-medium text-text-primary">
                {importedCount} Outlooks werden erstellt!
              </p>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="p-4 bg-accent-primary/10 border border-accent-primary/20 rounded-lg">
                <p className="text-sm text-text-secondary">
                  <strong className="text-accent-primary">Tipp:</strong> Kopiere deine TradingView Watchlist 
                  oder füge Symbole wie <code className="bg-background px-1 rounded">OANDA:EURUSD</code>, 
                  <code className="bg-background px-1 rounded">EURUSD</code> ein. Für jedes Symbol wird ein Outlook erstellt.
                </p>
              </div>
              
              {/* Input Area */}
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Symbole hier einfügen...&#10;&#10;OANDA:EURUSD&#10;GBPUSD&#10;BTCUSD&#10;..."
                  rows={8}
                  className="input-field w-full resize-none font-mono text-sm"
                />
                <button
                  onClick={handlePaste}
                  className="absolute top-2 right-2 p-2 text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 rounded-lg transition-colors"
                  title="Aus Zwischenablage einfügen"
                >
                  <Copy size={16} />
                </button>
              </div>
              
              {/* Preview */}
              {previewSymbols.length > 0 && (
                <div className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-secondary">
                      Erkannte Symbole
                    </span>
                    <span className="text-sm text-accent-primary font-medium">
                      {previewSymbols.length} gefunden
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewSymbols.slice(0, 20).map((symbol, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-background-surface text-text-primary text-xs rounded font-mono"
                      >
                        {symbol}
                      </span>
                    ))}
                    {previewSymbols.length > 20 && (
                      <span className="px-2 py-1 text-text-muted text-xs">
                        +{previewSymbols.length - 20} weitere
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
          <div className="flex justify-end gap-3 p-6 border-t border-border">
            <button onClick={onClose} className="btn-secondary">
              Abbrechen
            </button>
            <button
              onClick={handleImport}
              disabled={previewSymbols.length === 0}
              className="btn-primary flex items-center gap-2"
            >
              <Upload size={18} />
              {previewSymbols.length} Outlooks erstellen
            </button>
          </div>
        )}
      </div>
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
    EUR: '🇪🇺',
    USD: '🇺🇸',
    GBP: '🇬🇧',
    JPY: '🇯🇵',
    AUD: '🇦🇺',
    NZD: '🇳🇿',
    CAD: '🇨🇦',
    CHF: '🇨🇭',
  };
  return flags[currency] || '🏳️';
}

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
  } = useOutlookStore();
  
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  
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
  
  // Navigate to journal when prefill data is set
  useEffect(() => {
    if (prefillTradeData) {
      showToast('Outlook wird in Journal übernommen...', 'success');
      // Store prefill data in sessionStorage for TradeForm to pick up
      sessionStorage.setItem('tradePrefill', JSON.stringify(prefillTradeData));
      clearPrefillData();
      navigate('/ek'); // or /funded based on preference
    }
  }, [prefillTradeData, navigate, clearPrefillData, showToast]);
  
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
    showToast('Outlook gelöscht', 'success');
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
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Target className="text-accent-primary" />
            Trading Outlook
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Verwalte deine Trading-Thesen und Markteinschätzungen
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center gap-2"
            title="TradingView Watchlist importieren"
          >
            <Copy size={18} />
            TV Import
          </button>
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center gap-2"
            title="Als JSON exportieren"
          >
            <Download size={18} />
          </button>
          <button
            onClick={handleFileImport}
            className="btn-secondary flex items-center gap-2"
            title="JSON importieren"
          >
            <Upload size={18} />
          </button>
          <button
            onClick={() => openForm()}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            Neue These
          </button>
        </div>
      </div>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Gesamt', value: stats.total, color: 'text-text-primary' },
          { label: 'Aktiv', value: stats.active, color: 'text-pnl-positive' },
          { label: 'Wartend', value: stats.waiting, color: 'text-accent-gold' },
          { label: 'Beobachtung', value: stats.observation, color: 'text-accent-blue' },
          { label: 'Ausgeführt', value: stats.executed, color: 'text-accent-primary' },
        ].map(stat => (
          <div key={stat.label} className="card text-center">
            <div className={clsx('text-2xl font-bold', stat.color)}>{stat.value}</div>
            <div className="text-xs text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-text-muted" />
          <div className="flex gap-1 bg-background-surface rounded-lg p-1">
            {['all', 'observation', 'waiting', 'active'].map(status => (
              <button
                key={status}
                onClick={() => setFilters({ status: status as OutlookStatus | 'all' })}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm transition-all',
                  filters.status === status
                    ? 'bg-accent-primary text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-background-surface-hover'
                )}
              >
                {status === 'all' ? 'Alle' : OUTLOOK_STATUS_CONFIG[status as OutlookStatus].label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Direction Filter */}
        <div className="flex gap-1 bg-background-surface rounded-lg p-1">
          {[
            { value: 'all', label: 'Alle', icon: null },
            { value: 'long', label: 'Long', icon: <TrendingUp size={14} /> },
            { value: 'short', label: 'Short', icon: <TrendingDown size={14} /> },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setFilters({ direction: option.value as 'long' | 'short' | 'all' })}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all',
                filters.direction === option.value
                  ? 'bg-accent-primary text-white'
                  : 'text-text-muted hover:text-text-primary hover:bg-background-surface-hover'
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
          className="input-field text-sm"
        >
          <option value="date-desc">Neueste zuerst</option>
          <option value="date-asc">Älteste zuerst</option>
          <option value="confidence-desc">Höchste Confidence</option>
          <option value="confidence-asc">Niedrigste Confidence</option>
          <option value="symbol-asc">Symbol A-Z</option>
          <option value="symbol-desc">Symbol Z-A</option>
        </select>
        
        {/* Show Archived */}
        <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(e) => setFilters({ showArchived: e.target.checked })}
            className="rounded border-border"
          />
          Archiv anzeigen
        </label>
      </div>
      
      {/* Outlooks Grid */}
      {isLoading ? (
        <div className="card text-center py-16">
          <Loader2 size={48} className="text-accent-primary mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Laden...
          </h3>
          <p className="text-text-muted">
            Outlooks werden geladen
          </p>
        </div>
      ) : filteredOutlooks.length === 0 ? (
        <div className="card text-center py-12">
          <Target size={48} className="text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Keine Outlooks gefunden
          </h3>
          <p className="text-text-muted mb-4">
            {outlooks.length === 0 
              ? 'Erstelle deine erste Trading-These, um loszulegen.'
              : 'Keine Outlooks entsprechen den aktuellen Filtern.'}
          </p>
          {outlooks.length === 0 && (
            <button
              onClick={() => openForm()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus size={18} />
              Erste These erstellen
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOutlooks.map(outlook => (
            <OutlookCard
              key={outlook.id}
              outlook={outlook}
              onEdit={() => openForm(outlook)}
              onDelete={() => setDeleteConfirm(outlook.id)}
              onStatusChange={(status) => setStatus(outlook.id, status)}
              onTransfer={() => handleTransfer(outlook.id)}
            />
          ))}
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-background-surface border border-border rounded-xl shadow-2xl p-6 max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-pnl-negative/20 flex items-center justify-center">
                <Trash2 className="text-pnl-negative" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Outlook löschen?</h3>
                <p className="text-sm text-text-muted">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="bg-pnl-negative hover:bg-pnl-negative/90 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* TradingView Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleTradingViewImport}
        />
      )}
    </div>
  );
}
