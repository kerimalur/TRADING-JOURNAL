/**
 * ========================================================================
 * Trading Journal - Equity Curve Chart Component
 * ========================================================================
 */

import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import type { Trade } from '@/types';

interface EquityChartProps {
  trades: Trade[];
  startBalance: number;
  showDrawdown?: boolean;
  height?: number;
}

interface ChartDataPoint {
  index: number;
  date: string;
  balance: number;
  rCumulative: number;
  drawdown: number;
  drawdownPercent: number;
  tradeResult: 'win' | 'loss' | 'breakeven';
  rMultiple: number;
  peak: number;
}

export function EquityChart({ 
  trades, 
  startBalance, 
  showDrawdown = true,
  height = 400 
}: EquityChartProps) {
  
  const chartData = useMemo(() => {
    if (trades.length === 0) return [];

    // Sort trades by date
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let balance = startBalance;
    let rCumulative = 0;
    let peak = startBalance;
    
    const data: ChartDataPoint[] = [{
      index: 0,
      date: 'Start',
      balance: startBalance,
      rCumulative: 0,
      drawdown: 0,
      drawdownPercent: 0,
      tradeResult: 'breakeven',
      rMultiple: 0,
      peak: startBalance
    }];

    sortedTrades.forEach((trade, i) => {
      const riskAmount = balance * (trade.riskPercent || 1) / 100;
      const pnl = riskAmount * trade.rMultiple;
      
      balance += pnl;
      rCumulative += trade.rMultiple;
      
      if (balance > peak) {
        peak = balance;
      }
      
      const drawdown = peak - balance;
      const drawdownPercent = (drawdown / peak) * 100;

      data.push({
        index: i + 1,
        date: trade.date,
        balance: Math.round(balance * 100) / 100,
        rCumulative: Math.round(rCumulative * 100) / 100,
        drawdown: Math.round(drawdown * 100) / 100,
        drawdownPercent: Math.round(drawdownPercent * 100) / 100,
        tradeResult: trade.result,
        rMultiple: trade.rMultiple,
        peak
      });
    });

    return data;
  }, [trades, startBalance]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDataPoint;
      return (
        <div className="bg-background-surface border border-border rounded-lg p-3 shadow-xl">
          <p className="font-semibold text-text-primary mb-2">{data.date}</p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between gap-4">
              <span className="text-text-muted">Balance:</span>
              <span className="font-mono font-semibold text-accent-gold">
                ${data.balance.toLocaleString('de-DE')}
              </span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-text-muted">R kumuliert:</span>
              <span className={`font-mono font-semibold ${data.rCumulative >= 0 ? 'text-pnl-positive' : 'text-pnl-negative'}`}>
                {data.rCumulative > 0 ? '+' : ''}{data.rCumulative} R
              </span>
            </p>
            {data.rMultiple !== 0 && (
              <p className="flex justify-between gap-4">
                <span className="text-text-muted">Trade:</span>
                <span className={`font-mono font-semibold ${data.rMultiple > 0 ? 'text-pnl-positive' : 'text-pnl-negative'}`}>
                  {data.rMultiple > 0 ? '+' : ''}{data.rMultiple} R
                </span>
              </p>
            )}
            {showDrawdown && data.drawdown > 0 && (
              <p className="flex justify-between gap-4">
                <span className="text-text-muted">Drawdown:</span>
                <span className="font-mono text-pnl-negative">
                  -{data.drawdownPercent.toFixed(1)}%
                </span>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        Keine Daten für die Equity Curve verfügbar
      </div>
    );
  }

  const minBalance = Math.min(...chartData.map(d => d.balance)) * 0.98;
  const maxBalance = Math.max(...chartData.map(d => d.balance)) * 1.02;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
          </linearGradient>
        </defs>
        
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="#2a2a35" 
          vertical={false}
        />
        
        <XAxis 
          dataKey="date" 
          stroke="#666"
          tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}
          tickLine={{ stroke: '#444' }}
          axisLine={{ stroke: '#333' }}
        />
        
        <YAxis 
          yAxisId="balance"
          domain={[minBalance, maxBalance]}
          stroke="#666"
          tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tickLine={{ stroke: '#444' }}
          axisLine={{ stroke: '#333' }}
        />
        
        {showDrawdown && (
          <YAxis 
            yAxisId="drawdown"
            orientation="right"
            domain={[0, 'dataMax']}
            stroke="#666"
            tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'Inter, system-ui, sans-serif' }}
            tickFormatter={(value) => `${value.toFixed(0)}%`}
            tickLine={{ stroke: '#444' }}
            axisLine={{ stroke: '#333' }}
          />
        )}
        
        <Tooltip content={<CustomTooltip />} />
        
        <Legend 
          wrapperStyle={{ paddingTop: '10px', fontFamily: 'Inter, system-ui, sans-serif' }}
          formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif' }}>{value}</span>}
        />

        {/* Reference line at start balance */}
        <ReferenceLine 
          yAxisId="balance"
          y={startBalance} 
          stroke="#666" 
          strokeDasharray="5 5" 
          label={{ 
            value: 'Start', 
            fill: '#888', 
            fontSize: 10,
            position: 'left'
          }}
        />

        {/* Drawdown area */}
        {showDrawdown && (
          <Area
            yAxisId="drawdown"
            type="monotone"
            dataKey="drawdownPercent"
            name="Drawdown %"
            fill="url(#drawdownGradient)"
            stroke="#ef4444"
            strokeWidth={1}
            fillOpacity={1}
          />
        )}

        {/* Balance area */}
        <Area
          yAxisId="balance"
          type="monotone"
          dataKey="balance"
          name="Balance"
          fill="url(#balanceGradient)"
          stroke="#d4af37"
          strokeWidth={2}
          fillOpacity={1}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            if (payload.index === 0) return <circle cx={0} cy={0} r={0} fill="transparent" />;
            
            const color = payload.tradeResult === 'win' 
              ? '#10b981' 
              : payload.tradeResult === 'loss' 
                ? '#ef4444' 
                : '#666';
            
            return (
              <circle 
                cx={cx} 
                cy={cy} 
                r={4} 
                fill={color} 
                stroke="#1a1a24" 
                strokeWidth={2}
              />
            );
          }}
          activeDot={{ r: 6, stroke: '#d4af37', strokeWidth: 2, fill: '#1a1a24' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
