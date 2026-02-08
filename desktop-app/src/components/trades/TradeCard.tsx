/**
 * ========================================================================
 * Trading Journal - Trade Card Component (Enhanced)
 * ========================================================================
 * 
 * Modernes Card-Design mit Screenshot-Hintergrund-Unterstützung
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { clsx } from 'clsx';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Edit,
  Trash2,
  Image,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import type { Trade } from '@/types';
import { SETUP_DEFINITIONS } from '@/types';
import { getApi } from '@/services/webApi';

interface TradeCardProps {
  trade: Trade;
  onEdit?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
  onView?: (trade: Trade) => void;
  compact?: boolean;
}

export function TradeCard({ trade, onEdit, onDelete, onView, compact = false }: TradeCardProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [hasScreenshot, setHasScreenshot] = useState(false);
  
  // Load screenshot on mount
  useEffect(() => {
    if (trade.id) {
      getApi().loadScreenshot(trade.id).then(data => {
        if (data) {
          setScreenshot(data);
          setHasScreenshot(true);
        }
      }).catch(() => {
        // Ignore errors - screenshot might not exist
      });
    }
  }, [trade.id]);

  const resultConfig = {
    win: { 
      icon: <TrendingUp size={16} />, 
      color: 'text-pnl-positive', 
      bg: 'bg-pnl-positive',
      borderColor: 'border-pnl-positive/50',
      label: 'Win',
      gradient: 'from-pnl-positive/20 to-transparent'
    },
    loss: { 
      icon: <TrendingDown size={16} />, 
      color: 'text-pnl-negative', 
      bg: 'bg-pnl-negative',
      borderColor: 'border-pnl-negative/50',
      label: 'Loss',
      gradient: 'from-pnl-negative/20 to-transparent'
    },
    breakeven: { 
      icon: <Minus size={16} />, 
      color: 'text-pnl-neutral', 
      bg: 'bg-pnl-neutral',
      borderColor: 'border-border',
      label: 'BE',
      gradient: 'from-pnl-neutral/20 to-transparent'
    },
  };

  const result = resultConfig[trade.result];
  
  // Get active setups
  const activeSetups = Object.entries(SETUP_DEFINITIONS)
    .filter(([key]) => trade[key as keyof Trade])
    .map(([_, def]) => def);

  // Calculate profit
  const riskAmt = trade.riskAmount || 100;
  const calculatedProfit = trade.profitAmount || (riskAmt * trade.rMultiple);

  if (compact) {
    return (
      <div 
        onClick={() => onView?.(trade)}
        className={clsx(
          'p-3 rounded-lg cursor-pointer transition-all duration-200 hover:scale-[1.02] border-l-4',
          result.borderColor,
          'bg-background-surface hover:bg-background-surface-dark'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{trade.pair}</span>
            <span className={clsx('text-xs', trade.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative')}>
              {trade.direction === 'long' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            </span>
          </div>
          <span className={clsx('font-bold font-mono', result.color)}>
            {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(2)}R
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={clsx(
        'relative overflow-hidden rounded-xl border transition-all duration-300',
        'hover:shadow-lg hover:scale-[1.02] cursor-pointer group',
        result.borderColor,
        'bg-background-surface'
      )}
      onClick={() => onView?.(trade)}
    >
      {/* Screenshot Background */}
      {hasScreenshot && screenshot && (
        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
          <img 
            src={screenshot} 
            alt="" 
            className="w-full h-full object-cover blur-sm"
          />
        </div>
      )}
      
      {/* Gradient Overlay */}
      <div className={clsx(
        'absolute inset-0 bg-gradient-to-br',
        result.gradient,
        'opacity-50'
      )} />
      
      {/* Content */}
      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Result Badge */}
            <div className={clsx(
              'w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg',
              result.bg
            )}>
              {result.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-text-primary">{trade.pair}</h3>
                <span className={clsx(
                  'px-2 py-0.5 rounded text-xs font-semibold',
                  trade.direction === 'long' 
                    ? 'bg-pnl-positive/20 text-pnl-positive' 
                    : 'bg-pnl-negative/20 text-pnl-negative'
                )}>
                  {trade.direction.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-text-muted">
                {format(new Date(trade.date), 'EEEE, dd. MMM yyyy', { locale: de })}
              </p>
            </div>
          </div>
          
          {/* Screenshot indicator */}
          {hasScreenshot && (
            <div className="p-2 rounded-lg bg-background-surface/80 text-text-muted">
              <Image size={16} />
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-background-surface/50">
            <p className="text-xs text-text-muted mb-1">R-Multiple</p>
            <p className={clsx(
              'font-bold text-xl font-mono',
              result.color
            )}>
              {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background-surface/50">
            <p className="text-xs text-text-muted mb-1">Risiko</p>
            <p className="font-semibold text-text-primary">
              {trade.riskPercent?.toFixed(1) || '-'}%
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-background-surface/50">
            <p className="text-xs text-text-muted mb-1">P/L</p>
            <p className={clsx(
              'font-bold font-mono',
              calculatedProfit > 0 && 'text-pnl-positive',
              calculatedProfit < 0 && 'text-pnl-negative'
            )}>
              {calculatedProfit > 0 ? '+' : ''}{calculatedProfit.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Setups */}
        {activeSetups.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {activeSetups.map(setup => (
              <span 
                key={setup.key}
                className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ 
                  backgroundColor: `${setup.color}20`, 
                  color: setup.color 
                }}
              >
                {setup.short}
              </span>
            ))}
          </div>
        )}

        {/* Notes Preview */}
        {trade.notes && (
          <p className="text-sm text-text-muted line-clamp-2 italic">
            "{trade.notes}"
          </p>
        )}

        {/* Actions - Show on hover */}
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(trade); }}
              className="p-2 rounded-lg bg-background-surface/90 hover:bg-accent-primary/20 text-text-muted hover:text-accent-primary transition-colors"
              title="Bearbeiten"
            >
              <Edit size={16} />
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(trade); }}
              className="p-2 rounded-lg bg-background-surface/90 hover:bg-pnl-negative/20 text-text-muted hover:text-pnl-negative transition-colors"
              title="Löschen"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
