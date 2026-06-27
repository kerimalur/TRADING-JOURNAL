/**
 * ========================================================================
 * Trading Journal - Button Component
 * ========================================================================
 */

import { clsx } from 'clsx';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = 'primary', size = 'md', loading, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          
          // Variants
          variant === 'primary' && [
            'bg-accent-primary text-white',
            'hover:bg-accent-primary/90',
            'active:bg-accent-primary/80'
          ],
          variant === 'secondary' && [
            'bg-background-surface-hover text-text-primary border border-border',
            'hover:bg-background-surface-active',
            'active:bg-background-surface'
          ],
          variant === 'ghost' && [
            'bg-transparent text-text-subtle',
            'hover:bg-background-surface-hover hover:text-text-primary',
            'active:bg-background-surface-active'
          ],
          variant === 'danger' && [
            'bg-status-loss text-white',
            'hover:bg-status-loss/90',
            'active:bg-status-loss/80'
          ],
          
          // Sizes
          size === 'sm' && 'px-3 py-1.5 text-xs gap-1.5',
          size === 'md' && 'px-4 py-2 text-sm gap-2',
          size === 'lg' && 'px-6 py-3 text-base gap-2.5',
          
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
