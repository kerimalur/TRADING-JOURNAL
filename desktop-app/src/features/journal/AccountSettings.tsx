/**
 * ========================================================================
 * Trading Journal - Account Settings Panel (neu gestaltet)
 * ========================================================================
 * Zeigt alle Accounts des Typs + Löschen + Neuen Account hinzufügen
 */

import { useState } from 'react';
import { Settings, X, Plus, Trash2, DollarSign, Building2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AccountConfig, AccountType } from '@/shared/types';

interface AccountSettingsProps {
  accounts: AccountConfig[];
  accountType: AccountType;
  onDeleteAccount: (id: string) => Promise<void>;
  onAddAccount: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSettings({
  accounts,
  accountType,
  onDeleteAccount,
  onAddAccount,
  showToast,
  isOpen,
  onClose,
}: AccountSettingsProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteConfirm = async (account: AccountConfig) => {
    if (!account.id) return;
    setDeletingId(account.id);
    try {
      await onDeleteAccount(account.id);
      showToast('Konto und alle Trades wurden gelöscht', 'success');
      setConfirmDeleteId(null);
    } catch {
      showToast('Fehler beim Löschen', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const typeLabel = accountType === 'ek' ? 'Eigenkapital' : 'Funded';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="bg-background-surface border border-border rounded-xl p-5 mb-6 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Settings size={16} className="text-accent-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  {typeLabel} – Konten verwalten
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-background-surface-hover rounded-lg transition-colors"
              >
                <X size={16} className="text-text-muted" />
              </button>
            </div>

            {/* Account List */}
            <div className="space-y-2 mb-4">
              {accounts.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">
                  Keine Konten vorhanden.
                </p>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background-surface-dark border border-border hover:border-border-light transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
                        <DollarSign size={14} className="text-accent-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {account.name || (accountType === 'ek' ? 'Eigenkapital' : 'Funded Account')}
                          </span>
                          {account.isDefault && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent-primary/15 text-accent-primary flex-shrink-0">
                              Standard
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {account.broker && (
                            <span className="text-[11px] text-text-muted flex items-center gap-1">
                              <Building2 size={10} />
                              {account.broker}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-accent-primary">
                            {account.currentBalance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {account.currency}
                          </span>
                          {account.maxDrawdownValue != null && (
                            <span className="text-[11px] text-text-muted">
                              · DD {account.maxDrawdownValue}%
                            </span>
                          )}
                          {(account as any).dailyDrawdownValue != null && (
                            <span className="text-[11px] text-text-muted">
                              · Tages-DD {(account as any).dailyDrawdownValue}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delete Button / Confirm */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {confirmDeleteId === account.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-pnl-negative font-medium flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Sicher löschen?
                          </span>
                          <button
                            onClick={() => handleDeleteConfirm(account)}
                            disabled={deletingId === account.id}
                            className="px-2.5 py-1 rounded-lg bg-pnl-negative/20 text-pnl-negative text-xs font-semibold hover:bg-pnl-negative/30 transition-colors disabled:opacity-50"
                          >
                            {deletingId === account.id ? '...' : 'Ja, löschen'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 rounded-lg bg-background-surface text-text-muted text-xs hover:bg-background-surface-hover transition-colors"
                          >
                            Abbrechen
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(account.id!)}
                          className="p-1.5 rounded-lg text-text-muted/40 hover:text-pnl-negative hover:bg-pnl-negative/10 transition-all"
                          title="Konto löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Account Button */}
            <button
              onClick={() => { onClose(); onAddAccount(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-accent-primary/30 text-accent-primary text-xs font-semibold hover:bg-accent-primary/5 hover:border-accent-primary/50 transition-all"
            >
              <Plus size={14} />
              Neuen {typeLabel}-Account hinzufügen
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
