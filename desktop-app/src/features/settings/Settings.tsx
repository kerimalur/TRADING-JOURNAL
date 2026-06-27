/**
 * ========================================================================
 * Trading Journal - Settings Page
 * ========================================================================
 * Globale Einstellungen: Speichermodus, Login, Backup, Transaktionen.
 * Account-Einstellungen (EK/Funded) sind direkt in den Journal-Seiten.
 */

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Download,
  Upload,
  Plus,
  Minus,
  ArrowUpRight,
  Trash2,
  History,
  Cloud,
  HardDrive,
  CheckCircle2,
  X,
  Shield,
  User,
  LogOut,
  LogIn,
  Database,
  RefreshCw,
  Tag,
  Edit2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAccountStore } from '@/shared/stores/accountStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { getApi, isElectron } from '@/shared/services/webApi';
import { supabase } from '@/shared/lib/supabase';
import { getConfluences, saveConfluences, getProblems, saveProblems } from '@/shared/types';
import { loadPref, savePref } from '@/shared/services/preferencesService';
import type { TransactionType } from '@/shared/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { clsx } from 'clsx';
import { PageTransition } from '@/shared/ui/PageTransition';

export function Settings() {
  const { loadConfigs, transactions, addTransaction, deleteTransaction, getTransactions } = useAccountStore();
  const { showToast } = useUIStore();

  const [authUser, setAuthUser]         = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const inElectron = isElectron();

  // Speichermodus: Cloud wenn eingeloggt, sonst Lokal
  // authLoading=true → noch unbekannt (zeige nichts Falsches)
  const isCloud = !inElectron && !!authUser;

  // Confluence management
  const [confluences, setConfluences]     = useState<string[]>(() => getConfluences());
  const [newConfluence, setNewConfluence] = useState('');
  const [editingIdx, setEditingIdx]       = useState<number | null>(null);
  const [editValue, setEditValue]         = useState('');

  const handleAddConfluence = () => {
    const val = newConfluence.trim();
    if (!val || confluences.includes(val)) return;
    const updated = [...confluences, val];
    setConfluences(updated);
    saveConfluences(updated);
    setNewConfluence('');
    showToast('Confluence hinzugefügt', 'success');
  };

  const handleDeleteConfluence = (idx: number) => {
    const updated = confluences.filter((_, i) => i !== idx);
    setConfluences(updated);
    saveConfluences(updated);
  };

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(confluences[idx]);
  };

  const handleSaveEdit = () => {
    if (editingIdx === null) return;
    const val = editValue.trim();
    if (!val) return;
    const updated = confluences.map((c, i) => (i === editingIdx ? val : c));
    setConfluences(updated);
    saveConfluences(updated);
    setEditingIdx(null);
    showToast('Confluence aktualisiert', 'success');
  };

  // Problem-Tags (für Backtest-Trades) — gleiches Muster wie Confluences
  const [problems, setProblems]             = useState<string[]>(() => getProblems());
  const [newProblem, setNewProblem]         = useState('');
  const [editingProblemIdx, setEditingProblemIdx] = useState<number | null>(null);
  const [editProblemValue, setEditProblemValue]   = useState('');

  // Backend → localStorage-Mirror beim Laden (eingeloggt). Sonst bleibt lokal.
  useEffect(() => {
    (async () => {
      try {
        const remote = await loadPref<string[]>('problems', []);
        if (Array.isArray(remote) && remote.length > 0) {
          setProblems(remote);
          saveProblems(remote);
        }
      } catch { /* nicht kritisch */ }
    })();
  }, []);

  const persistProblems = (list: string[]) => {
    saveProblems(list);
    savePref('problems', list).catch(e => console.error('Problem-Sync fehlgeschlagen:', e));
  };

  const handleAddProblem = () => {
    const val = newProblem.trim();
    if (!val || problems.includes(val)) return;
    const updated = [...problems, val];
    setProblems(updated);
    persistProblems(updated);
    setNewProblem('');
    showToast('Problem hinzugefügt', 'success');
  };

  const handleDeleteProblem = (idx: number) => {
    const updated = problems.filter((_, i) => i !== idx);
    setProblems(updated);
    persistProblems(updated);
  };

  const handleStartEditProblem = (idx: number) => {
    setEditingProblemIdx(idx);
    setEditProblemValue(problems[idx]);
  };

  const handleSaveEditProblem = () => {
    if (editingProblemIdx === null) return;
    const val = editProblemValue.trim();
    if (!val) return;
    const updated = problems.map((p, i) => (i === editingProblemIdx ? val : p));
    setProblems(updated);
    persistProblems(updated);
    setEditingProblemIdx(null);
    showToast('Problem aktualisiert', 'success');
  };

  // Transaction form
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    accountType: 'ek' as 'ek' | 'funded',
    type: 'deposit' as TransactionType,
    amount: 0,
    note: '',
  });

  useEffect(() => {
    loadConfigs();

    if (inElectron) {
      setAuthLoading(false);
      return;
    }

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Immer auf Änderungen reagieren (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [inElectron]);

  // ── Handlers ──

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    localStorage.removeItem('trading-journal-offline-mode');
    setAuthUser(null);
    showToast('Erfolgreich abgemeldet', 'success');
    setTimeout(() => window.location.reload(), 500);
  };

  const handleSwitchToCloud = async () => {
    // Offline-Flag entfernen und direkt Google-OAuth starten – KEIN reload()
    localStorage.removeItem('trading-journal-offline-mode');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSwitchToLocal = async () => {
    // Ausloggen und auf lokalen Speicher wechseln
    await supabase.auth.signOut();
    localStorage.setItem('trading-journal-offline-mode', 'true');
    showToast('Auf lokalen Speicher umgestellt', 'success');
    setTimeout(() => window.location.reload(), 600);
  };

  const handleAddTransaction = async () => {
    if (transactionForm.amount <= 0) {
      showToast('Bitte gib einen gültigen Betrag ein', 'error');
      return;
    }
    await addTransaction(transactionForm.accountType, transactionForm.type, transactionForm.amount, transactionForm.note);
    showToast(
      transactionForm.type === 'deposit' ? 'Einzahlung erfasst' :
      transactionForm.type === 'withdrawal' ? 'Auszahlung erfasst' : 'Payout erfasst',
      'success'
    );
    setShowTransactionForm(false);
    setTransactionForm({ accountType: 'ek', type: 'deposit', amount: 0, note: '' });
    loadConfigs();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Transaktion wirklich löschen? Balance wird entsprechend angepasst.')) {
      await deleteTransaction(id);
      showToast('Transaktion gelöscht', 'success');
      loadConfigs();
    }
  };

  const handleExport = async () => {
    try {
      const api = getApi();
      const result = await api.exportDatabase();
      if (result.success) showToast((result as any).message || 'Backup gespeichert', 'success');
    } catch { showToast('Fehler beim Export', 'error'); }
  };

  const handleImport = async () => {
    try {
      const api = getApi();
      const result = await api.importDatabase();
      if (result.success) { showToast((result as any).message || 'Daten importiert', 'success'); loadConfigs(); }
    } catch { showToast('Fehler beim Import', 'error'); }
  };

  const ekTransactions     = getTransactions('ek');
  const fundedTransactions = getTransactions('funded');

  const labelClass = 'block text-[10px] font-semibold text-text-muted uppercase tracking-[0.1em] mb-1.5';
  const inputClass = 'w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-text-primary text-sm focus:border-accent-primary focus:outline-none font-mono';

  return (
    <PageTransition>
    <div className="p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-accent-primary/10">
          <SettingsIcon size={20} className="text-accent-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Einstellungen</h1>
          <p className="text-[11px] text-text-muted">Speicher, Login & Backup</p>
        </div>
      </div>

      {/* ── PROMINENTER ANMELDEN / ABMELDEN BUTTON ── */}
      {!inElectron && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <LogIn size={15} className="text-accent-primary" />
            <span className="text-sm font-bold text-text-primary">Konto</span>
          </div>
          <div className="p-5">
            {authUser ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold">
                    {authUser.email?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-primary">{authUser.user_metadata?.full_name || authUser.email}</div>
                    <div className="text-xs text-text-muted flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-pnl-positive" />
                      Angemeldet · Cloud Sync aktiv
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pnl-negative/10 text-pnl-negative text-sm font-semibold hover:bg-pnl-negative/20 transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? <RefreshCw size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Abmelden
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-text-primary">Nicht angemeldet</div>
                  <div className="text-xs text-text-muted">Lokal gespeichert · kein Sync</div>
                </div>
                <a
                  href="/"
                  onClick={e => { e.preventDefault(); localStorage.removeItem('trading-journal-offline-mode'); window.location.reload(); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/10 text-accent-primary text-sm font-semibold hover:bg-accent-primary/20 transition-colors"
                >
                  <LogIn size={14} />
                  Anmelden
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SPEICHERMODUS ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/[0.06] overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Database size={15} className="text-accent-primary" />
          <span className="text-sm font-bold text-text-primary">Datenspeicher</span>
        </div>

        <div className="p-5 space-y-3">
          {/* Ladeindikator während Auth-Status noch unbekannt */}
          {authLoading ? (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <RefreshCw size={16} className="text-text-muted animate-spin" />
              <span className="text-xs text-text-muted">Verbindung wird geprüft…</span>
            </div>
          ) : (
            <>
              {/* Aktueller Modus */}
              <div className={clsx(
                'flex items-center justify-between p-4 rounded-xl border',
                isCloud
                  ? 'bg-accent-primary/[0.06] border-accent-primary/20'
                  : 'bg-accent-gold/[0.05] border-accent-gold/15'
              )}>
                <div className="flex items-center gap-3">
                  {isCloud
                    ? <Cloud size={18} className="text-accent-primary flex-shrink-0" />
                    : <HardDrive size={18} className="text-accent-gold flex-shrink-0" />
                  }
                  <div>
                    <div className="text-sm font-semibold text-text-primary">
                      {isCloud ? 'Supabase Cloud' : 'Lokaler Speicher'}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {isCloud
                        ? `Daten werden in Supabase synchronisiert · ${authUser?.email}`
                        : inElectron
                          ? 'Desktop-App: Daten lokal auf diesem Gerät'
                          : 'Daten im Browser gespeichert (kein Sync)'}
                    </div>
                  </div>
                </div>
                <span className={clsx(
                  'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full',
                  isCloud ? 'bg-accent-primary/20 text-accent-primary' : 'bg-accent-gold/20 text-accent-gold'
                )}>
                  {isCloud ? 'Cloud' : 'Lokal'}
                </span>
              </div>

              {/* Wechsel-Buttons – nur für Web, nicht Electron */}
              {!inElectron && (
                <div className="flex gap-3">
                  {!isCloud ? (
                    <button
                      onClick={handleSwitchToCloud}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-primary/90 transition-colors"
                    >
                      <Cloud size={13} />
                      Mit Google anmelden &amp; Cloud nutzen
                    </button>
                  ) : (
                    <button
                      onClick={handleSwitchToLocal}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-muted text-xs font-semibold hover:text-text-primary hover:bg-white/[0.08] transition-colors"
                    >
                      <HardDrive size={13} />
                      Abmelden &amp; lokal speichern
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* ── LOGIN / ACCOUNT ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="rounded-xl border border-white/[0.06] overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <User size={15} className="text-accent-blue" />
          <span className="text-sm font-bold text-text-primary">Konto & Login</span>
        </div>

        <div className="p-5">
          {inElectron ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-pnl-positive/[0.05] border border-pnl-positive/10">
              <Shield size={15} className="text-pnl-positive flex-shrink-0" />
              <div>
                <div className="text-xs font-medium text-text-primary">Desktop-Modus</div>
                <div className="text-[10px] text-text-muted">Kein Login nötig – Daten lokal.</div>
              </div>
            </div>
          ) : authUser ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-sm">
                  {authUser.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div>
                  <div className="text-xs font-medium text-text-primary">{authUser.email}</div>
                  <div className="text-[10px] text-text-muted flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-pnl-positive" />
                    Angemeldet · Cloud Sync aktiv
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-text-muted text-xs font-medium hover:bg-pnl-negative/20 hover:text-pnl-negative transition-colors"
              >
                {isLoggingOut ? <RefreshCw size={12} className="animate-spin" /> : <LogOut size={12} />}
                Abmelden
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-gold/[0.05] border border-accent-gold/10">
              <HardDrive size={15} className="text-accent-gold flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs font-medium text-text-primary">Nicht angemeldet</div>
                <div className="text-[10px] text-text-muted">Wechsle zu Cloud um Google-Login zu nutzen.</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── TRANSAKTIONEN ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-xl border border-white/[0.06] overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={15} className="text-accent-primary" />
            <span className="text-sm font-bold text-text-primary">Transaktionen</span>
          </div>
          <button
            onClick={() => setShowTransactionForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
          >
            <Plus size={12} />
            Neue Transaktion
          </button>
        </div>

        <div className="p-5">
          {transactions.length === 0 ? (
            <div className="text-center py-6">
              <History size={24} className="mx-auto text-text-muted/30 mb-2" />
              <p className="text-xs text-text-muted">Keine Transaktionen vorhanden</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Eigenkapital', list: ekTransactions, currency: '€' },
                { label: 'Funded',       list: fundedTransactions, currency: '$' },
              ].map(({ label, list, currency }) => list.length > 0 && (
                <div key={label}>
                  <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.1em] mb-2">{label}</div>
                  <div className="space-y-1">
                    {list.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-6 h-6 rounded-md flex items-center justify-center',
                            tx.transactionType === 'deposit'    ? 'bg-pnl-positive/20' :
                            tx.transactionType === 'payout'     ? 'bg-accent-gold/20'  : 'bg-pnl-negative/20'
                          )}>
                            {tx.transactionType === 'deposit'    ? <Plus size={12} className="text-pnl-positive" /> :
                             tx.transactionType === 'payout'     ? <ArrowUpRight size={12} className="text-accent-gold" /> :
                             <Minus size={12} className="text-pnl-negative" />}
                          </div>
                          <div>
                            <span className="text-xs font-medium text-text-primary">
                              {tx.transactionType === 'deposit' ? 'Einzahlung' :
                               tx.transactionType === 'payout'  ? 'Payout' : 'Auszahlung'}
                            </span>
                            <span className="text-[10px] text-text-muted ml-2">
                              {new Date(tx.date).toLocaleDateString('de-DE')}
                              {tx.note && ` · ${tx.note}`}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={clsx('text-xs font-bold font-mono',
                            tx.transactionType === 'deposit' ? 'text-pnl-positive' : 'text-pnl-negative')}>
                            {tx.transactionType === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString('de-DE')} {currency}
                          </span>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-pnl-negative/20 transition-all"
                          >
                            <Trash2 size={12} className="text-text-muted hover:text-pnl-negative" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── CONFLUENCES ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-white/[0.06] overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Tag size={15} className="text-accent-primary" />
          <span className="text-sm font-bold text-text-primary">Confluences</span>
          <span className="text-[10px] text-text-muted ml-1">— für Trades &amp; Outlooks</span>
        </div>

        <div className="p-5 space-y-3">
          {/* Neue Confluence hinzufügen */}
          <div className="flex gap-2">
            <input
              className={inputClass + ' flex-1'}
              placeholder="Neue Confluence (z.B. HTF Bias)"
              value={newConfluence}
              onChange={e => setNewConfluence(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddConfluence()}
            />
            <button
              onClick={handleAddConfluence}
              disabled={!newConfluence.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-primary/20 text-accent-primary text-xs font-semibold hover:bg-accent-primary/30 disabled:opacity-40 transition-colors"
            >
              <Plus size={13} />
              Hinzufügen
            </button>
          </div>

          {/* Liste */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {confluences.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] group transition-colors">
                {editingIdx === idx ? (
                  <>
                    <input
                      className="flex-1 bg-transparent text-xs text-text-primary outline-none border-b border-accent-primary/50"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingIdx(null); }}
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="p-1 text-pnl-positive hover:text-pnl-positive/80 transition-colors">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingIdx(null)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs text-text-primary">{c}</span>
                    <button
                      onClick={() => handleStartEdit(idx)}
                      className="p-1 text-text-muted/40 opacity-0 group-hover:opacity-100 hover:text-accent-primary transition-all"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteConfluence(idx)}
                      className="p-1 text-text-muted/40 opacity-0 group-hover:opacity-100 hover:text-pnl-negative transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── PROBLEME (Backtest) ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.11 }}
        className="rounded-xl border border-white/[0.06] overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <AlertTriangle size={15} className="text-accent-gold" />
          <span className="text-sm font-bold text-text-primary">Probleme</span>
          <span className="text-[10px] text-text-muted ml-1">— Fehler-Tags für Backtest-Trades</span>
        </div>

        <div className="p-5 space-y-3">
          {/* Neues Problem hinzufügen */}
          <div className="flex gap-2">
            <input
              className={inputClass + ' flex-1'}
              placeholder="Neues Problem (z.B. Stop zu eng)"
              value={newProblem}
              onChange={e => setNewProblem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddProblem()}
            />
            <button
              onClick={handleAddProblem}
              disabled={!newProblem.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-gold/20 text-accent-gold text-xs font-semibold hover:bg-accent-gold/30 disabled:opacity-40 transition-colors"
            >
              <Plus size={13} />
              Hinzufügen
            </button>
          </div>

          {/* Liste */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {problems.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] group transition-colors">
                {editingProblemIdx === idx ? (
                  <>
                    <input
                      className="flex-1 bg-transparent text-xs text-text-primary outline-none border-b border-accent-gold/50"
                      value={editProblemValue}
                      onChange={e => setEditProblemValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEditProblem(); if (e.key === 'Escape') setEditingProblemIdx(null); }}
                      autoFocus
                    />
                    <button onClick={handleSaveEditProblem} className="p-1 text-pnl-positive hover:text-pnl-positive/80 transition-colors">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingProblemIdx(null)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs text-text-primary">{p}</span>
                    <button
                      onClick={() => handleStartEditProblem(idx)}
                      className="p-1 text-text-muted/40 opacity-0 group-hover:opacity-100 hover:text-accent-gold transition-all"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteProblem(idx)}
                      className="p-1 text-text-muted/40 opacity-0 group-hover:opacity-100 hover:text-pnl-negative transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── BACKUP ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="rounded-xl border border-white/[0.06] overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <Download size={15} className="text-text-muted" />
          <span className="text-sm font-bold text-text-primary">Backup & Wiederherstellung</span>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
            <div>
              <div className="text-xs font-medium text-text-primary">Exportieren</div>
              <div className="text-[10px] text-text-muted">Alle Daten als JSON</div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
            >
              <Download size={12} />
              Export
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
            <div>
              <div className="text-xs font-medium text-text-primary">Importieren</div>
              <div className="text-[10px] text-text-muted">Backup wiederherstellen</div>
            </div>
            <button
              onClick={handleImport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-text-secondary text-xs font-medium hover:bg-white/[0.1] transition-colors"
            >
              <Upload size={12} />
              Import
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── APP INFO ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="rounded-xl border border-white/[0.06] overflow-hidden"
      >
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <span className="text-sm font-bold text-text-primary">App-Info</span>
        </div>
        <div className="p-5 space-y-2">
          {[
            { label: 'Version',   value: '1.2.0' },
            { label: 'Speicher',  value: authLoading ? '…' : isCloud ? 'Supabase Cloud' : 'Lokal' },
            { label: 'Login',     value: authUser ? `Google · ${authUser.email}` : (inElectron ? 'Desktop' : 'Nicht angemeldet') },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
              <span className="text-[10px] text-text-muted uppercase tracking-wider">{item.label}</span>
              <span className="text-xs font-medium font-mono text-text-primary">{item.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl bg-background-surface border border-border p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-text-primary">Neue Transaktion</h3>
              <button onClick={() => setShowTransactionForm(false)} className="p-1 rounded-lg hover:bg-white/[0.06]">
                <X size={16} className="text-text-muted" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Konto</label>
                <div className="flex gap-2">
                  {(['ek', 'funded'] as const).map(type => (
                    <button key={type} type="button"
                      onClick={() => setTransactionForm(p => ({ ...p, accountType: type }))}
                      className={clsx('flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                        transactionForm.accountType === type
                          ? type === 'ek' ? 'bg-accent-gold/20 text-accent-gold' : 'bg-pnl-positive/20 text-pnl-positive'
                          : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06]'
                      )}>
                      {type === 'ek' ? 'Eigenkapital' : 'Funded'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Typ</label>
                <div className="flex gap-2">
                  {[
                    { value: 'deposit' as const,    label: 'Einzahlung', icon: <Plus size={12} />,        activeClass: 'bg-pnl-positive/20 text-pnl-positive' },
                    { value: 'withdrawal' as const, label: 'Auszahlung', icon: <Minus size={12} />,       activeClass: 'bg-pnl-negative/20 text-pnl-negative' },
                    { value: 'payout' as const,     label: 'Payout',     icon: <ArrowUpRight size={12} />, activeClass: 'bg-accent-gold/20 text-accent-gold' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setTransactionForm(p => ({ ...p, type: opt.value }))}
                      className={clsx('flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all',
                        transactionForm.type === opt.value ? opt.activeClass : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06]'
                      )}>
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Betrag</label>
                <input type="number" className={inputClass} placeholder="500"
                  value={transactionForm.amount || ''}
                  onChange={e => setTransactionForm(p => ({ ...p, amount: Number(e.target.value) }))}
                />
              </div>

              <div>
                <label className={labelClass}>Notiz (optional)</label>
                <input type="text" className={inputClass} placeholder="z.B. Monatlicher Payout"
                  value={transactionForm.note}
                  onChange={e => setTransactionForm(p => ({ ...p, note: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowTransactionForm(false)}
                  className="flex-1 py-2 rounded-lg bg-white/[0.03] text-text-muted text-xs font-medium hover:bg-white/[0.06] transition-colors">
                  Abbrechen
                </button>
                <button onClick={handleAddTransaction}
                  className="flex-1 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 transition-colors">
                  Speichern
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
