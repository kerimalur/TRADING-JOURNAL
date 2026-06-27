/**
 * Gauge - Semi-circular gauge for risk/progress visualization
 */

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GaugeProps {
  value: number; // 0-100
  max?: number;
  label: string;
  sublabel?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'success' | 'warning' | 'danger';
  showValue?: boolean;
  className?: string;
}

function getAutoColor(value: number): string {
  if (value < 40) return '#22C55E'; // green
  if (value < 70) return '#F59E0B'; // yellow
  return '#EF4444'; // red
}

const COLORS = {
  default: '#2563EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export function Gauge({
  value,
  max = 100,
  label,
  sublabel,
  size = 'md',
  color = 'default',
  showValue = true,
  className,
}: GaugeProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const strokeColor = color === 'default' ? getAutoColor(percent) : COLORS[color];

  const sizes = {
    sm: { width: 80, strokeWidth: 6, fontSize: 'text-sm', labelSize: 'text-[9px]' },
    md: { width: 110, strokeWidth: 8, fontSize: 'text-xl', labelSize: 'text-[10px]' },
    lg: { width: 150, strokeWidth: 10, fontSize: 'text-2xl', labelSize: 'text-xs' },
  }[size];

  const radius = (sizes.width - sizes.strokeWidth) / 2;

  return (
    <div className={clsx('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: sizes.width, height: sizes.width / 2 + 10 }}>
        <svg
          width={sizes.width}
          height={sizes.width / 2 + 10}
          viewBox={`0 0 ${sizes.width} ${sizes.width / 2 + 10}`}
        >
          {/* Background arc */}
          <path
            d={describeArc(sizes.width / 2, sizes.width / 2 + 5, radius, 180, 360)}
            fill="none"
            stroke="rgba(15,23,42,0.08)"
            strokeWidth={sizes.strokeWidth}
            strokeLinecap="round"
          />

          {/* Value arc */}
          <motion.path
            d={describeArc(sizes.width / 2, sizes.width / 2 + 5, radius, 180, 180 + (percent / 100) * 180)}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sizes.strokeWidth}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }}
          />
        </svg>

        {/* Center value */}
        {showValue && (
          <div className="absolute inset-0 flex items-end justify-center pb-0">
            <span className={clsx('font-bold font-mono tabular-nums', sizes.fontSize)}
              style={{ color: strokeColor }}
            >
              {Math.round(percent)}%
            </span>
          </div>
        )}
      </div>

      <span className={clsx('font-semibold text-text-muted uppercase tracking-wider mt-1', sizes.labelSize)}>
        {label}
      </span>
      {sublabel && (
        <span className="text-[10px] text-text-muted">{sublabel}</span>
      )}
    </div>
  );
}

// Helper to describe SVG arc path
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}
