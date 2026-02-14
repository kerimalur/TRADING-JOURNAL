/**
 * TradeStreak - Colored dot sequence for Win/Loss streaks
 * Shows last N trades as colored indicators
 */

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface TradeStreakProps {
  results: ('win' | 'loss' | 'breakeven')[];
  maxDots?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  className?: string;
}

export function TradeStreak({
  results,
  maxDots = 20,
  size = 'md',
  showLabels = false,
  className,
}: TradeStreakProps) {
  const displayed = results.slice(-maxDots);

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }[size];

  const gapSize = {
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1.5',
  }[size];

  // Calculate current streak
  let currentStreak = 0;
  let streakType: 'win' | 'loss' | null = null;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === 'breakeven') continue;
    if (streakType === null) {
      streakType = results[i] as 'win' | 'loss';
      currentStreak = 1;
    } else if (results[i] === streakType) {
      currentStreak++;
    } else {
      break;
    }
  }

  return (
    <div className={clsx('flex flex-col', className)}>
      <div className={clsx('flex items-center flex-wrap', gapSize)}>
        {displayed.map((result, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
            className={clsx(
              'rounded-full transition-transform hover:scale-125',
              dotSizes,
              result === 'win' ? 'bg-pnl-positive' :
              result === 'loss' ? 'bg-pnl-negative' :
              'bg-text-muted/40',
            )}
            title={result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Breakeven'}
          />
        ))}
      </div>

      {showLabels && currentStreak > 0 && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={clsx(
            'text-xs font-semibold',
            streakType === 'win' ? 'text-pnl-positive' : 'text-pnl-negative'
          )}>
            {currentStreak}x {streakType === 'win' ? 'Win' : 'Loss'} Streak
          </span>
        </div>
      )}
    </div>
  );
}
