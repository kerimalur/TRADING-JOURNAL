/**
 * ========================================================================
 * Trading Journal - Card Component
 * ========================================================================
 */

import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'bordered';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'bg-background-surface rounded-lg',
          variant === 'default' && 'border border-border',
          variant === 'elevated' && 'shadow-lg border border-border',
          variant === 'bordered' && 'border-2 border-border',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
