/**
 * ========================================================================
 * Trading Journal - Account Settings Panel (neu gestaltet)
 * ========================================================================
 * Zeigt alle Accounts des Typs + Löschen + Neuen Account hinzufügen
 */

import { useState } from 'react';
import { Settings, X, Plus, Trash2, DollarSign, Building2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AccountConfig, AccountType } from '@/types';

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


  const [newChapter, setNewChapter] = useState({
    startBalance: 0,
    reason: '',
  });
  const [showNewChapter, setShowNewChapter] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        initialStartBalance: config.initialStartBalance,
        currentBalance: config.currentBalance,
        defaultRiskPerTrade: config.defaultRiskPerTrade || 0.5,
      });
    }
  }, [config]);

  const chapters = config?.chapters || [];

  const handleSave = async () => {
    if (!config) return;

    const updated: AccountConfig = {
      ...config,
      initialStartBalance: form.initialStartBalance,
      currentBalance: form.currentBalance,
      defaultRiskPerTrade: form.defaultRiskPerTrade,
    };

    const success = await onSave(updated);
    if (success) {
      showToast('Einstellungen gespeichert', 'success');
      onClose();
    } else {
      showToast('Fehler beim Speichern', 'error');
    }
  };

  const handleCreateChapter = async () => {
    if (!config || !newChapter.reason.trim()) return;

    const chapter: AccountChapter = {
      id: uuidv4(),
      startBalance: newChapter.startBalance,
      startDate: new Date().toISOString().split('T')[0],
      reason: newChapter.reason.trim(),
    };

    // Close current active chapter
    const updatedChapters = (config.chapters || []).map(c =>
      c.id === config.activeChapterId
        ? { ...c, endDate: new Date().toISOString().split('T')[0] }
        : c
    );

    const updated: AccountConfig = {
      ...config,
      chapters: [...updatedChapters, chapter],
      activeChapterId: chapter.id,
      initialStartBalance: chapter.startBalance,
      currentBalance: chapter.startBalance,
    };

    const success = await onSave(updated);
    if (success) {
      showToast('Neues Kapitel erstellt', 'success');
      setShowNewChapter(false);
      setNewChapter({ startBalance: 0, reason: '' });
    } else {
      showToast('Fehler beim Erstellen', 'error');
    }
  };

  const handleSelectChapter = async (chapter: AccountChapter) => {
    if (!config) return;

    const updated: AccountConfig = {
      ...config,
      activeChapterId: chapter.id,
      initialStartBalance: chapter.startBalance,
    };

    const success = await onSave(updated);
    if (success) {
      showToast(`Kapitel "${chapter.reason}" ausgewählt`, 'success');
    }
  };

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
          <div className="glass-card p-6 mb-6 border-accent-primary/30">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Settings size={18} className="text-accent-primary" />
                  {config?.name || (accountType === 'ek' ? 'Eigenkapital' : 'Funded')} – Einstellungen
                </h3>
                {(config?.broker || config?.accountNumber) && (
                  <p className="text-xs text-text-muted mt-0.5 ml-7">
                    {[config.broker, config.accountNumber].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {accountType === 'funded' && onAddAccount && (
                  <button
                    onClick={() => { onClose(); onAddAccount(); }}
                    className="btn-ghost btn-sm flex items-center gap-1.5 text-accent-primary"
                    title="Weiteren Funded Account hinzufügen"
                  >
                    <PlusCircle size={14} />
                    Neuer Account
                  </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-background-surface-hover rounded-lg transition-colors">
                  <X size={18} className="text-text-muted" />
                </button>
              </div>
            </div>

            {/* Settings Form */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="input-label">Startkapital</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                  <input
                    type="number"
                    className="input pl-7"
                    value={form.initialStartBalance}
                    onChange={(e) => setForm(s => ({ ...s, initialStartBalance: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Aktuelle Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                  <input
                    type="number"
                    className="input pl-7"
                    value={form.currentBalance}
                    onChange={(e) => setForm(s => ({ ...s, currentBalance: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Standard Risiko pro Trade</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    className="input pr-7"
                    value={form.defaultRiskPerTrade}
                    onChange={(e) => setForm(s => ({ ...s, defaultRiskPerTrade: parseFloat(e.target.value) || 0.5 }))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
                </div>
              </div>
            </div>

            {/* P/L Display + Save */}
            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-muted">P/L:</span>
                <span className={clsx(
                  'font-semibold text-lg font-mono',
                  form.currentBalance >= form.initialStartBalance ? 'text-pnl-positive' : 'text-pnl-negative'
                )}>
                  {form.currentBalance >= form.initialStartBalance ? '+' : ''}
                  ${(form.currentBalance - form.initialStartBalance).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                </span>
                <span className={clsx(
                  'badge',
                  form.currentBalance >= form.initialStartBalance ? 'badge-success' : 'badge-danger'
                )}>
                  {((form.currentBalance / form.initialStartBalance - 1) * 100).toFixed(2)}%
                </span>
              </div>
              <button onClick={handleSave} className="btn-primary">
                <Save size={18} />
                Speichern
              </button>
            </div>

            {/* Chapters Section */}
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <BookOpen size={16} className="text-accent-primary" />
                  Account-Kapitel
                </h4>
                <button
                  onClick={() => setShowNewChapter(!showNewChapter)}
                  className="btn-ghost btn-sm"
                >
                  <Plus size={14} />
                  Neues Kapitel
                </button>
              </div>

              {/* Chapter List */}
              {chapters.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {chapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => handleSelectChapter(chapter)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        chapter.id === config?.activeChapterId
                          ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                          : 'bg-background-surface text-text-muted border border-border hover:border-border-light hover:text-text-secondary'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span>${chapter.startBalance.toLocaleString('de-DE')}</span>
                        <span className="text-text-muted">·</span>
                        <span>{chapter.reason}</span>
                        {!chapter.endDate && (
                          <span className="w-1.5 h-1.5 rounded-full bg-pnl-positive animate-pulse" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted mb-3">
                  Noch keine Kapitel. Erstelle ein Kapitel wenn du z.B. einen neuen Account startest.
                </p>
              )}

              {/* New Chapter Form */}
              <AnimatePresence>
                {showNewChapter && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-background-surface rounded-lg border border-border">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="input-label">Account-Größe</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                            <input
                              type="number"
                              className="input pl-7"
                              value={newChapter.startBalance}
                              onChange={(e) => setNewChapter(s => ({ ...s, startBalance: parseFloat(e.target.value) || 0 }))}
                              placeholder="z.B. 50000"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="input-label">Grund</label>
                          <input
                            type="text"
                            className="input"
                            value={newChapter.reason}
                            onChange={(e) => setNewChapter(s => ({ ...s, reason: e.target.value }))}
                            placeholder="z.B. Neuer 50k Account"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowNewChapter(false)} className="btn-ghost btn-sm">Abbrechen</button>
                        <button
                          onClick={handleCreateChapter}
                          className="btn-primary btn-sm"
                          disabled={!newChapter.reason.trim() || newChapter.startBalance <= 0}
                        >
                          Kapitel erstellen
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
