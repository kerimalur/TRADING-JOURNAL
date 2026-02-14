/**
 * BentoGrid - Asymmetric grid layout system
 * Supports varying cell sizes for visual interest
 */

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface BentoGridProps {
  children: React.ReactNode;
  cols?: 2 | 3 | 4 | 6;
  className?: string;
}

export function BentoGrid({ children, cols = 4, className }: BentoGridProps) {
  const colsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
  }[cols];

  return (
    <div className={clsx('grid gap-3 auto-rows-[minmax(120px,auto)]', colsClass, className)}>
      {children}
    </div>
  );
}

type BentoCellSize = 'default' | 'hero' | 'wide' | 'tall' | 'wide-tall';

interface BentoCellProps {
  children: React.ReactNode;
  size?: BentoCellSize;
  className?: string;
  delay?: number;
  noPadding?: boolean;
  glass?: boolean;
  accent?: boolean;
}

export function BentoCell({
  children,
  size = 'default',
  className,
  delay = 0,
  noPadding = false,
  glass = false,
  accent = false,
}: BentoCellProps) {
  const sizeClass = {
    default: '',
    hero: 'col-span-2 row-span-2',
    wide: 'col-span-2',
    tall: 'row-span-2',
    'wide-tall': 'col-span-2 row-span-2',
  }[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className={clsx(
        'rounded-xl border border-border overflow-hidden',
        'transition-all duration-200 hover:border-border-light',
        glass ? 'bg-background-card/80 backdrop-blur-sm' : 'bg-background-card',
        accent && 'card-accent-top',
        !noPadding && 'p-4',
        sizeClass,
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
