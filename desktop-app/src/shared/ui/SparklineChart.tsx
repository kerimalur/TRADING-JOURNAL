import { useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showGradient?: boolean;
  strokeWidth?: number;
  className?: string;
}

export function SparklineChart({
  data,
  width = 80,
  height = 30,
  color = '#2563EB',
  showGradient = true,
  strokeWidth = 1.5,
  className = '',
}: SparklineChartProps) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true });

  const { linePath, areaPath, gradientId } = useMemo(() => {
    if (!data.length) return { linePath: '', areaPath: '', gradientId: '' };

    const id = `sparkline-${Math.random().toString(36).slice(2, 8)}`;
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((val, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - ((val - min) / range) * h,
    }));

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return { linePath: line, areaPath: area, gradientId: id };
  }, [data, width, height]);

  if (!data.length) return null;

  const isPositive = data.length >= 2 && data[data.length - 1] >= data[0];
  const activeColor = color === '#2563EB'
    ? (isPositive ? '#22C55E' : '#EF4444')
    : color;

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={activeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showGradient && (
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
      )}
      <motion.path
        d={linePath}
        fill="none"
        stroke={activeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={isInView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}
