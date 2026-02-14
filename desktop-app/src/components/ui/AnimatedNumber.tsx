import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring, motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: 'currency' | 'percent' | 'R' | 'decimal' | 'integer';
  prefix?: string;
  suffix?: string;
  showSign?: boolean;
  className?: string;
  duration?: number;
  locale?: string;
  decimals?: number;
}

export function AnimatedNumber({
  value,
  format = 'decimal',
  prefix = '',
  suffix = '',
  showSign = false,
  className = '',
  duration = 0.8,
  locale = 'de-DE',
  decimals,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    duration: duration * 1000,
  });
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      const formatted = formatValue(latest, format, locale, decimals);
      const sign = showSign && value > 0 ? '+' : '';
      setDisplayValue(`${sign}${prefix}${formatted}${suffix}`);
    });
    return unsubscribe;
  }, [spring, format, prefix, suffix, showSign, value, locale, decimals]);

  return (
    <motion.span
      ref={ref}
      className={`tabular-nums ${className}`}
      initial={{ opacity: 0, y: 4 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3 }}
    >
      {displayValue}
    </motion.span>
  );
}

function formatValue(
  val: number,
  format: string,
  locale: string,
  decimals?: number
): string {
  switch (format) {
    case 'currency':
      return val.toLocaleString(locale, {
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 0,
      });
    case 'percent':
      return val.toFixed(decimals ?? 0);
    case 'R':
      return val.toFixed(decimals ?? 1);
    case 'integer':
      return Math.round(val).toLocaleString(locale);
    case 'decimal':
    default:
      return val.toFixed(decimals ?? 2);
  }
}
