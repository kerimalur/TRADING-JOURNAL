/**
 * ========================================================================
 * Trading Journal - Win Rate Pie/Donut Chart Component
 * ========================================================================
 */

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import type { Trade } from '@/shared/types';

interface WinRateChartProps {
  trades: Trade[];
  height?: number;
}

export function WinRateChart({ trades, height = 250 }: WinRateChartProps) {
  const data = useMemo(() => {
    const wins = trades.filter(t => t.result === 'win').length;
    const losses = trades.filter(t => t.result === 'loss').length;
    const breakevens = trades.filter(t => t.result === 'breakeven').length;

    return [
      { name: 'Wins', value: wins, color: '#10b981' },
      { name: 'Losses', value: losses, color: '#ef4444' },
      { name: 'Breakeven', value: breakevens, color: '#666' }
    ].filter(d => d.value > 0);
  }, [trades]);

  const winRate = useMemo(() => {
    const winsAndLosses = trades.filter(t => t.result !== 'breakeven').length;
    const wins = trades.filter(t => t.result === 'win').length;
    return winsAndLosses > 0 ? (wins / winsAndLosses * 100) : 0;
  }, [trades]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background-surface border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold" style={{ color: data.color }}>
            {data.name}
          </p>
          <p className="text-text-primary font-mono">
            {data.value} Trades ({((data.value / trades.length) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy }: any) => {
    return (
      <g>
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fill="#888"
          fontSize={14}
        >
          Win Rate
        </text>
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          fill="#d4af37"
          fontSize={28}
          fontWeight="bold"
        >
          {winRate.toFixed(1)}%
        </text>
      </g>
    );
  };

  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        Keine Trade-Daten verfügbar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.color}
              stroke="#1a1a24"
              strokeWidth={2}
            />
          ))}
        </Pie>
        
        <Tooltip content={<CustomTooltip />} />
        
        <Legend 
          verticalAlign="bottom"
          formatter={(value, entry: any) => (
            <span className="text-text-subtle text-sm">
              {value} ({entry.payload.value})
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
