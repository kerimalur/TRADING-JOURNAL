/**
 * MetricDisplay - Large, prominent number display
 * Replaces StatCard for hero-sized metrics
 */

import { clsx } from 'clsx';
import { AnimatedNumber } from './AnimatedNumber';

interface MetricDisplayProps {
  label: string;
  value: number;
  format?: 'number' | 'currency' | 'percent' | 'R';
  suffix?: string;
  prefix?: string;
  decimals?: number;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  trend?: 'up' | 'down' | null;
  trendLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricDisplay({
  label,
  value,
  format = 'number',
  suffix = '',
  prefix = '',
  decimals,
  showSign = false,
  size = 'lg',
  trend,
  trendLabel,
  icon,
  className,
}: MetricDisplayProps) {
  const effectiveDecimals = decimals ?? (format === 'currency' ? 0 : format === 'percent' ? 1 : format === 'R' ? 1 : 0);
  const effectiveSuffix = suffix || (format === 'percent' ? '%' : format === 'R' ? 'R' : '');
  const effectivePrefix = prefix || (format === 'currency' ? '' : '');

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  }[size];

  const isPositive = value > 0;
  const isNegative = value < 0;
  const colorClass = showSign
    ? isPositive ? 'text-pnl-positive' : isNegative ? 'text-pnl-negative' : 'text-text-primary'
    : 'text-text-primary';

  return (
    <div className={clsx('flex flex-col', className)}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-text-muted">{icon}</span>}
        <span className="text-[0.65rem] font-semibold text-text-muted uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>

      <div className={clsx('font-extrabold tabular-nums tracking-tight font-mono', sizeClasses, colorClass)}>
        {showSign && isPositive && '+'}
        {effectivePrefix}
        <AnimatedNumber value={value} decimals={effectiveDecimals} />
        {effectiveSuffix}
      </div>

      {(trend || trendLabel) && (
        <div className="flex items-center gap-1 mt-1">
          {trend && (
            <span className={clsx(
              'text-xs font-medium',
              trend === 'up' ? 'text-pnl-positive' : 'text-pnl-negative'
            )}>
              {trend === 'up' ? '↑' : '↓'}
            </span>
          )}
          {trendLabel && (
            <span className="text-xs text-text-muted">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
