/**
 * ========================================================================
 * Trading Journal - R-Multiple Bar Chart Component
 * ========================================================================
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import type { Trade } from '@/shared/types';

interface RMultipleChartProps {
  trades: Trade[];
  height?: number;
  limit?: number;
}

export function RMultipleChart({ trades, height = 300, limit = 50 }: RMultipleChartProps) {
  const chartData = useMemo(() => {
    // Sort trades by date and take latest 'limit' trades
    const sortedTrades = [...trades]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-limit);

    return sortedTrades.map((trade, index) => ({
      index: index + 1,
      date: trade.date,
      pair: trade.pair,
      rMultiple: trade.rMultiple,
      result: trade.result
    }));
  }, [trades, limit]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background-surface border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-text-primary">{data.pair}</p>
          <p className="text-sm text-text-muted">{data.date}</p>
          <p className={`font-mono font-bold text-lg mt-1 ${data.rMultiple >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'}`}>
            {data.rMultiple > 0 ? '+' : ''}{data.rMultiple.toFixed(2)} R
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        Keine Trade-Daten verfügbar
      </div>
    );
  }

  const maxR = Math.max(...chartData.map(d => Math.abs(d.rMultiple)), 3);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#2a2a35" 
          vertical={false}
        />
        
        <XAxis 
          dataKey="index"
          stroke="#666"
          tick={{ fill: '#888', fontSize: 11 }}
          tickLine={{ stroke: '#444' }}
          axisLine={{ stroke: '#333' }}
        />
        
        <YAxis 
          domain={[-maxR, maxR]}
          stroke="#666"
          tick={{ fill: '#888', fontSize: 12 }}
          tickFormatter={(value) => `${value}R`}
          tickLine={{ stroke: '#444' }}
          axisLine={{ stroke: '#333' }}
        />
        
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        
        <ReferenceLine y={0} stroke="#666" />
        
        <Bar 
          dataKey="rMultiple" 
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        >
          {chartData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`}
              fill={entry.rMultiple >= 0 ? '#10b981' : '#ef4444'}
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
