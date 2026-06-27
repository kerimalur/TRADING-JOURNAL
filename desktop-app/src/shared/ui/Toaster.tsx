/**
 * ========================================================================
 * Trading Journal - Toast Notification Component
 * ========================================================================
 */

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/shared/stores/uiStore';
import type { ToastMessage } from '@/shared/types';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-pnl-positive/20 border-pnl-positive/30 text-pnl-positive',
  error: 'bg-pnl-negative/20 border-pnl-negative/30 text-pnl-negative',
  warning: 'bg-accent-gold/20 border-accent-gold/30 text-accent-gold',
  info: 'bg-accent-blue/20 border-accent-blue/30 text-accent-blue',
};

function Toast({ toast }: { toast: ToastMessage }) {
  const { removeToast } = useUIStore();
  const Icon = iconMap[toast.type];
  
  return (
    <div 
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm animate-slide-in-right',
        colorMap[toast.type]
      )}
    >
      <Icon size={20} className="flex-shrink-0" />
      <p className="flex-1 text-sm font-medium text-text-primary">{toast.message}</p>
      <button 
        onClick={() => removeToast(toast.id)}
        className="p-1 rounded hover:bg-white/10 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
