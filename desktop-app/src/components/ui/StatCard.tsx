/**
 * ========================================================================
 * Trading Journal - StatCard Component
 * ========================================================================
 */

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({ 
  label, 
  value, 
  icon, 
  trend, 
  trendValue,
  className,
  onClick 
}: StatCardProps) {
  return (
    <div 
      className={clsx(
        'stat-card',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className={clsx(
            'text-2xl font-semibold tabular-nums mt-1',
            trend === 'up' && 'text-pnl-positive',
            trend === 'down' && 'text-pnl-negative',
            !trend && 'text-text-primary'
          )}>
            {value}
          </p>
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
        {icon && (
          <div className="p-2 rounded-lg bg-accent-primary/10 text-accent-primary">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
