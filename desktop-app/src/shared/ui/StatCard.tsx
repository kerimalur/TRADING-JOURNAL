/**
 * ========================================================================
 * Trading Journal - StatCard Component (Enhanced with Animations)
 * ========================================================================
 */

import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { SparklineChart } from './SparklineChart';

interface StatCardProps {
  label: string;
  value: number | string;
  format?: 'currency' | 'percent' | 'R' | 'decimal' | 'integer';
  prefix?: string;
  suffix?: string;
  decimals?: number;
  showSign?: boolean;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  sparklineData?: number[];
  accentTop?: boolean;
  className?: string;
  onClick?: () => void;
  delay?: number;
}

export function StatCard({
  label,
  value,
  format = 'decimal',
  prefix,
  suffix,
  decimals,
  showSign = false,
  icon,
  trend,
  trendValue,
  sparklineData,
  accentTop = false,
  className,
  onClick,
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1], delay }}
      className={clsx(
        'stat-card hover-lift',
        accentTop && 'card-accent-top',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="stat-label">{label}</p>
          <div className={clsx(
            'text-2xl font-bold tabular-nums mt-1',
            trend === 'up' && 'text-pnl-positive',
            trend === 'down' && 'text-pnl-negative',
            !trend && 'text-text-primary'
          )}>
            {typeof value === 'number' ? (
              <AnimatedNumber
                value={value as number}
                format={format}
                prefix={prefix}
                suffix={suffix}
                decimals={decimals}
                showSign={showSign}
              />
            ) : (
              <span>{value}</span>
            )}
          </div>
          {trendValue && (
            <p className={clsx(
              'text-xs mt-1 tabular-nums',
              trend === 'up' && 'text-pnl-positive',
              trend === 'down' && 'text-pnl-negative',
              trend === 'neutral' && 'text-text-muted'
            )}>
              {trendValue}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {icon && (
            <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
              {icon}
            </div>
          )}
          {sparklineData && sparklineData.length > 1 && (
            <SparklineChart data={sparklineData} width={64} height={24} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
