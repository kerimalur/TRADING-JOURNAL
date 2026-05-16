/**
 * ========================================================================
 * Trading Journal - Trade Detail Modal
 * ========================================================================
 */

import { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar,
  Clock,
  Target,
  Edit,
  Trash2,
  Maximize2
} from 'lucide-react';
import { clsx } from '@/utils';
import type { Trade } from '@/types';
import { SETUP_DEFINITIONS } from '@/types';
import { getApi } from '@/services/webApi';

interface TradeDetailModalProps {
  trade: Trade;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
}

export function TradeDetailModal({ trade, onClose, onEdit, onDelete }: TradeDetailModalProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);

  useEffect(() => {
    if (trade.id) {
      getApi().loadScreenshot(trade.id).then(data => {
        if (data) setScreenshot(data);
      }).catch(() => {
        // Ignore errors - screenshot might not exist
      });
    }
  }, [trade.id]);

  const ResultIcon = trade.result === 'win' 
    ? TrendingUp 
    : trade.result === 'loss' 
      ? TrendingDown 
      : Minus;

  const activeSetups = Object.entries(SETUP_DEFINITIONS)
    .filter(([key]) => trade[key as keyof Trade])
    .map(([_, setup]) => setup);

  const handleDelete = () => {
    if (confirm(`Trade vom ${trade.date} wirklich löschen?`)) {
      onDelete(trade);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-background-surface border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background-surface z-10">
          <div className="flex items-center gap-4">
            <div className={clsx(
              'p-3 rounded-xl',
              trade.result === 'win' && 'bg-pnl-positive/20',
              trade.result === 'loss' && 'bg-pnl-negative/20',
              trade.result === 'breakeven' && 'bg-text-muted/20'
            )}>
              <ResultIcon 
                size={28} 
                className={clsx(
                  trade.result === 'win' && 'text-pnl-positive',
                  trade.result === 'loss' && 'text-pnl-negative',
                  trade.result === 'breakeven' && 'text-text-muted'
                )}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                {trade.pair}
                <span className={clsx(
                  'ml-2 text-sm font-medium',
                  trade.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative'
                )}>
                  {trade.direction.toUpperCase()}
                </span>
              </h2>
              <p className="text-text-muted flex items-center gap-2">
                <Calendar size={14} />
                {trade.date}
                {trade.session && (
                  <>
                    <span className="text-border">•</span>
                    <Clock size={14} />
                    {trade.session}
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { onEdit(trade); onClose(); }}
              className="btn-secondary"
            >
              <Edit size={16} />
              Bearbeiten
            </button>
            <button 
              onClick={handleDelete}
              className="btn-secondary text-pnl-negative hover:bg-pnl-negative/10 hover:border-pnl-negative"
            >
              <Trash2 size={16} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-glass-white text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-background-surface-dark rounded-lg p-4 border border-border">
              <p className="text-text-muted text-sm mb-1">Ergebnis</p>
              <p className={clsx(
                'text-2xl font-bold font-mono',
                trade.result === 'win' && 'text-pnl-positive',
                trade.result === 'loss' && 'text-pnl-negative',
                trade.result === 'breakeven' && 'text-text-muted'
              )}>
                {trade.result === 'win' ? 'WIN' : trade.result === 'loss' ? 'LOSS' : 'BREAKEVEN'}
              </p>
            </div>
            
            <div className="bg-background-surface-dark rounded-lg p-4 border border-border">
              <p className="text-text-muted text-sm mb-1">R-Multiple</p>
              <p className={clsx(
                'text-2xl font-bold font-mono',
                trade.rMultiple > 0 && 'text-pnl-positive',
                trade.rMultiple < 0 && 'text-pnl-negative'
              )}>
                {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(2)} R
              </p>
            </div>
            
            <div className="bg-background-surface-dark rounded-lg p-4 border border-border">
              <p className="text-text-muted text-sm mb-1">Risiko</p>
              <p className="text-xl font-semibold font-mono text-text-primary">
                {trade.riskPercent || 1}% 
                {trade.riskAmount && (
                  <span className="text-text-muted text-sm ml-1">({trade.riskAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF)</span>
                )}
              </p>
            </div>
            
            <div className="bg-background-surface-dark rounded-lg p-4 border border-border">
              <p className="text-text-muted text-sm mb-1">Profit/Loss</p>
              {(() => {
                // Calculate profit if not stored
                const riskAmt = trade.riskAmount || 100; // Default risk
                const calculatedProfit = trade.profitAmount || (riskAmt * trade.rMultiple);
                return (
                  <p className={clsx(
                    'text-xl font-semibold font-mono',
                    calculatedProfit > 0 && 'text-pnl-positive',
                    calculatedProfit < 0 && 'text-pnl-negative',
                    calculatedProfit === 0 && 'text-text-muted'
                  )}>
                    {calculatedProfit > 0 ? '+' : ''}{calculatedProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                  </p>
                );
              })()}
            </div>
          </div>

          {/* Price Levels */}
          {(trade.entryPrice || trade.stopLoss || trade.takeProfit) && (
            <div className="bg-background-surface-dark rounded-lg p-4 border border-border">
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Target size={18} />
                Preisniveaus
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {trade.entryPrice && (
                  <div>
                    <p className="text-text-muted text-sm">Entry</p>
                    <p className="font-mono font-semibold text-text-primary">{trade.entryPrice}</p>
                  </div>
                )}
                {trade.stopLoss && (
                  <div>
                    <p className="text-text-muted text-sm">Stop Loss</p>
                    <p className="font-mono font-semibold text-pnl-negative">{trade.stopLoss}</p>
                  </div>
                )}
                {trade.takeProfit && (
                  <div>
                    <p className="text-text-muted text-sm">Take Profit</p>
                    <p className="font-mono font-semibold text-pnl-positive">{trade.takeProfit}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Setups */}
          {activeSetups.length > 0 && (
            <div>
              <h3 className="font-semibold text-text-primary mb-3">Confluence Setups</h3>
              <div className="flex flex-wrap gap-2">
                {activeSetups.map(setup => (
                  <span
                    key={setup.key}
                    className="px-4 py-2 rounded-lg font-medium border-2"
                    style={{
                      backgroundColor: `${setup.color}20`,
                      borderColor: setup.color,
                      color: setup.color
                    }}
                  >
                    {setup.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Screenshot */}
          {screenshot && (
            <div>
              <h3 className="font-semibold text-text-primary mb-3">Screenshot</h3>
              <div className="relative group">
                <img 
                  src={screenshot} 
                  alt="Trade Screenshot" 
                  className="w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setShowFullscreenImage(true)}
                />
                <button
                  onClick={() => setShowFullscreenImage(true)}
                  className="absolute top-2 right-2 p-2 bg-background-surface/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background-surface"
                  title="Vollbild anzeigen"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Comment */}
          {trade.comment && (
            <div>
              <h3 className="font-semibold text-text-primary mb-3">Notizen</h3>
              <div className="bg-background-surface-dark rounded-lg p-4 border border-border">
                <p className="text-text-subtle whitespace-pre-wrap">{trade.comment}</p>
              </div>
            </div>
          )}

          {/* Balance Info */}
          <div className="bg-background-surface-dark rounded-lg p-4 border border-border">
            <h3 className="font-semibold text-text-primary mb-3">Kontostand</h3>
            {(() => {
              // Calculate values if not stored
              const riskAmt = trade.riskAmount || 100;
              const profit = trade.profitAmount || (riskAmt * trade.rMultiple);
              const balanceAfter = trade.accountBalanceAfter || trade.runningBalance;
              const balanceBefore = trade.accountBalanceBefore || (balanceAfter ? balanceAfter - profit : null);
              
              return (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-text-muted mb-1">Vorher</p>
                    <p className="font-mono font-semibold text-text-primary text-lg">
                      {balanceBefore 
                        ? `${balanceBefore.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1">Nachher</p>
                    <p className="font-mono font-semibold text-text-primary text-lg">
                      {balanceAfter 
                        ? `${balanceAfter.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted mb-1">Profit/Loss</p>
                    <p className={clsx(
                      'font-mono font-semibold text-lg',
                      profit > 0 && 'text-pnl-positive',
                      profit < 0 && 'text-pnl-negative',
                      profit === 0 && 'text-text-muted'
                    )}>
                      {profit > 0 ? '+' : ''}{profit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Meta Info */}
          <div className="text-xs text-text-muted flex justify-between pt-4 border-t border-border">
            <span>ID: {trade.id}</span>
            <span>Erstellt: {trade.createdAt ? new Date(trade.createdAt).toLocaleString('de-DE') : '-'}</span>
          </div>
        </div>
      </div>

      {/* Fullscreen Screenshot Modal */}
      {showFullscreenImage && screenshot && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center cursor-pointer"
          onClick={() => setShowFullscreenImage(false)}
        >
          <button
            onClick={() => setShowFullscreenImage(false)}
            className="absolute top-4 right-4 p-3 bg-background-surface/80 rounded-lg hover:bg-background-surface transition-colors z-10"
          >
            <X size={24} className="text-text-primary" />
          </button>
          <img 
            src={screenshot} 
            alt="Trade Screenshot Vollbild" 
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
