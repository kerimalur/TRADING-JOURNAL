/**
 * Heatmap - GitHub-style contribution heatmap
 * Shows trading activity/performance over time
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export interface HeatmapDay {
  date: string;
  value: number; // R-Multiple or trade count
  trades: number;
}

interface HeatmapProps {
  data: HeatmapDay[];
  weeks?: number; // How many weeks to show
  onDayClick?: (day: HeatmapDay) => void;
  colorMode?: 'pnl' | 'intensity'; // pnl = green/red, intensity = single color
  className?: string;
}

const DAY_LABELS = ['Mo', '', 'Mi', '', 'Fr', '', ''];

function getColor(value: number, mode: 'pnl' | 'intensity'): string {
  if (value === 0) return 'bg-background-surface';

  if (mode === 'pnl') {
    if (value > 3) return 'bg-pnl-positive';
    if (value > 1.5) return 'bg-pnl-positive/70';
    if (value > 0) return 'bg-pnl-positive/40';
    if (value > -1.5) return 'bg-pnl-negative/40';
    if (value > -3) return 'bg-pnl-negative/70';
    return 'bg-pnl-negative';
  }

  // intensity mode
  if (value > 5) return 'bg-accent-primary';
  if (value > 3) return 'bg-accent-primary/70';
  if (value > 1) return 'bg-accent-primary/40';
  return 'bg-accent-primary/20';
}

export function Heatmap({
  data,
  weeks = 20,
  onDayClick,
  colorMode = 'pnl',
  className,
}: HeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  const grid = useMemo(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
    const totalDays = weeks * 7;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + (6 - dayOfWeek));

    const dataMap = new Map(data.map(d => [d.date, d]));
    const cells: (HeatmapDay & { isEmpty: boolean })[][] = [];

    let currentWeek: (HeatmapDay & { isEmpty: boolean })[] = [];

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dataMap.get(dateStr);

      currentWeek.push({
        date: dateStr,
        value: dayData?.value || 0,
        trades: dayData?.trades || 0,
        isEmpty: !dayData || dayData.trades === 0,
      });

      if (currentWeek.length === 7) {
        cells.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) cells.push(currentWeek);

    return cells;
  }, [data, weeks]);

  return (
    <div className={clsx('relative', className)}>
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1 pt-0">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-[14px] flex items-center">
              <span className="text-[9px] text-text-muted w-4">{label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <motion.button
                key={day.date}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: wi * 0.01 + di * 0.005 }}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => onDayClick?.(day)}
                className={clsx(
                  'w-[14px] h-[14px] rounded-[3px] transition-all duration-150',
                  day.isEmpty
                    ? 'bg-background-surface/50'
                    : getColor(day.value, colorMode),
                  onDayClick && 'cursor-pointer hover:ring-1 hover:ring-text-muted',
                  hoveredDay?.date === day.date && 'ring-1 ring-text-secondary scale-125',
                )}
                title={`${day.date}: ${day.value > 0 ? '+' : ''}${day.value.toFixed(1)}R (${day.trades} trades)`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-10 pointer-events-none">
          <div className="bg-background-elevated border border-border rounded-lg px-3 py-2 text-xs shadow-depth whitespace-nowrap">
            <div className="font-medium text-text-primary">
              {new Date(hoveredDay.date).toLocaleDateString('de-DE', {
                weekday: 'short', day: 'numeric', month: 'short'
              })}
            </div>
            <div className={clsx(
              'font-mono font-bold',
              hoveredDay.value > 0 ? 'text-pnl-positive' : hoveredDay.value < 0 ? 'text-pnl-negative' : 'text-text-muted'
            )}>
              {hoveredDay.value > 0 ? '+' : ''}{hoveredDay.value.toFixed(1)}R
            </div>
            <div className="text-text-muted">{hoveredDay.trades} Trade{hoveredDay.trades !== 1 ? 's' : ''}</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-text-muted">
        <span>Weniger</span>
        <div className="w-[10px] h-[10px] rounded-[2px] bg-background-surface/50" />
        {colorMode === 'pnl' ? (
          <>
            <div className="w-[10px] h-[10px] rounded-[2px] bg-pnl-negative/40" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-pnl-negative" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-pnl-positive/40" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-pnl-positive" />
          </>
        ) : (
          <>
            <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-primary/20" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-primary/40" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-primary/70" />
            <div className="w-[10px] h-[10px] rounded-[2px] bg-accent-primary" />
          </>
        )}
        <span>Mehr</span>
      </div>
    </div>
  );
}
