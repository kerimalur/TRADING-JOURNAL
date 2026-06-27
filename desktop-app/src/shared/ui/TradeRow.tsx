/**
 * TradeRow - Compact trade display row
 * Replaces verbose trade cards with a dense, scannable format
 */

import { clsx } from 'clsx';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Trade } from '@/shared/types';

interface TradeRowProps {
  trade: Trade;
  showAccount?: boolean;
  showDate?: boolean;
  compact?: boolean;
  onClick?: (trade: Trade) => void;
  className?: string;
}

export function TradeRow({
  trade,
  showAccount = false,
  showDate = true,
  compact = false,
  onClick,
  className,
}: TradeRowProps) {
  const profitAmount = trade.profitAmount || 0;
  const isWin = trade.result === 'win';
  const isLoss = trade.result === 'loss';

  return (
    <div
      onClick={() => onClick?.(trade)}
      className={clsx(
        'flex items-center gap-3 group transition-colors duration-150',
        compact ? 'py-1.5' : 'py-2.5 px-3',
        onClick && 'cursor-pointer hover:bg-background-surface-hover rounded-lg',
        className,
      )}
    >
      {/* Direction indicator */}
      <div className={clsx(
        'flex-shrink-0 rounded-md flex items-center justify-center',
        compact ? 'w-6 h-6' : 'w-8 h-8',
        trade.direction === 'long'
          ? 'bg-pnl-positive/10 text-pnl-positive'
          : 'bg-pnl-negative/10 text-pnl-negative'
      )}>
        {trade.direction === 'long'
          ? <ArrowUpRight size={compact ? 12 : 14} />
          : <ArrowDownRight size={compact ? 12 : 14} />
        }
      </div>

      {/* Pair + Direction */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={clsx('font-semibold text-text-primary', compact ? 'text-xs' : 'text-sm')}>
            {trade.pair}
          </span>
          {showAccount && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-background-surface text-text-muted">
              {trade.type === 'ek' ? 'EK' : 'F'}
            </span>
          )}
          {/* Setup dots */}
          <div className="flex gap-0.5 ml-1">
            {trade.setup_daily_bos && <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" title="Daily BOS" />}
            {trade.setup_value_area && <div className="w-1.5 h-1.5 rounded-full bg-[#4A9EFF]" title="Value Area" />}
            {trade.setup_market_structure && <div className="w-1.5 h-1.5 rounded-full bg-[#E67E22]" title="Market Structure" />}
            {trade.setup_weekly_gva && <div className="w-1.5 h-1.5 rounded-full bg-[#9B59B6]" title="Weekly GVA" />}
            {trade.setup_3day_gva && <div className="w-1.5 h-1.5 rounded-full bg-[#F1C40F]" title="3Day GVA" />}
          </div>
        </div>
        {showDate && (
          <span className="text-[10px] text-text-muted">
            {new Date(trade.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {/* R-Multiple */}
      <div className={clsx(
        'font-mono font-bold tabular-nums text-right',
        compact ? 'text-xs' : 'text-sm',
        isWin ? 'text-pnl-positive' : isLoss ? 'text-pnl-negative' : 'text-text-muted'
      )}>
        {trade.rMultiple > 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
      </div>

      {/* Profit amount (optional) */}
      {!compact && profitAmount !== 0 && (
        <div className={clsx(
          'text-xs font-mono tabular-nums text-right w-16',
          profitAmount > 0 ? 'text-pnl-positive/70' : 'text-pnl-negative/70'
        )}>
          {profitAmount > 0 ? '+' : ''}{profitAmount.toFixed(0)}
        </div>
      )}
    </div>
  );
}
