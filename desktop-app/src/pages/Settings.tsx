/**
 * ========================================================================
 * Trading Journal - Settings Page
 * ========================================================================
 *
 * Kontoeinstellungen:
 * - Datenspeicherort für Cloud-Sync
 * - EK und Funded Account Konfiguration
 * - Profit Target und Drawdown Limits
 * - Transaktionen (Einzahlung/Auszahlung/Payout)
 * - Backup & Wiederherstellung
 */

import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  Wallet,
  DollarSign,
  Target,
  AlertTriangle,
  Plus,
  Minus,
  ArrowUpRight,
  Trash2,
  History,
  FolderOpen,
  Cloud,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  X,
  Shield,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import { getApi, isElectron } from '@/services/webApi';
import { supabase } from '@/lib/supabase';
import type { AccountConfig, TransactionType } from '@/types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';

export function Settings() {
  const { configs, loadConfigs, saveConfig, transactions, addTransaction, deleteTransaction, getTransactions } = useAccountStore();
  const { showToast } = useUIStore();

  // Storage Path State
  const [storagePath, setStoragePath] = useState<string>('');
  const [isChangingPath, setIsChangingPath] = useState(false);

  // Form states für beide Account-Typen
  const [ekForm, setEkForm] = useState<Partial<AccountConfig>>({
    initialStartBalance: 0,
    currentBalance: 0,
    defaultRiskPerTrade: 1,
    currency: 'EUR',
  });

  const [fundedForm, setFundedForm] = useState<Partial<AccountConfig>>({
    initialStartBalance: 0,
    currentBalance: 0,
    defaultRiskPerTrade: 1,
    currency: 'USD',
    profitTargetValue: 0,
    profitTargetType: 'percent',
    maxDrawdownValue: 0,
    maxDrawdownType: 'percent',
  });

  // Transaction form state
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    accountType: 'ek' as 'ek' | 'funded',
    type: 'deposit' as TransactionType,
    amount: 0,
    note: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const inElectron = isElectron();
  const offlineMode = localStorage.getItem('trading-journal-offline-mode') === 'true';

  useEffect(() => {
    loadConfigs();
    loadStoragePath();
    // Load auth user
    if (!inElectron) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setAuthUser(session?.user ?? null);
      });
    }
  }, []);

  const loadStoragePath = async () => {
    try {
      const api = getApi();
      const path = await api.getStoragePath();
      setStoragePath(path);
    } catch (error) {
      console.error('Failed to load storage path:', error);
    }
  };

  const handleChangeStoragePath = async () => {
    if (!isElectron()) {
      showToast('Speicherort ändern ist nur in der Desktop-Version verfügbar', 'info');
      return;
    }
    setIsChangingPath(true);
    try {
      const api = getApi();
      const newPath = await api.setStoragePath();
      if (newPath) {
        setStoragePath(newPath);
        showToast('Speicherort erfolgreich geändert! App wird neu gestartet...', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      showToast('Fehler beim Ändern des Speicherorts', 'error');
    }
    setIsChangingPath(false);
  };

  useEffect(() => {
    if (configs) {
      if (configs.ek) {
        setEkForm({
          initialStartBalance: configs.ek.initialStartBalance || 0,
          currentBalance: configs.ek.currentBalance || 0,
          defaultRiskPerTrade: configs.ek.defaultRiskPerTrade || 1,
          currency: configs.ek.currency || 'EUR',
        });
      }
      if (configs.funded) {
        setFundedForm({
          initialStartBalance: configs.funded.initialStartBalance || 0,
          currentBalance: configs.funded.currentBalance || 0,
          defaultRiskPerTrade: configs.funded.defaultRiskPerTrade || 1,
          currency: configs.funded.currency || 'USD',
          profitTargetValue: configs.funded.profitTargetValue || 0,
          profitTargetType: configs.funded.profitTargetType || 'percent',
          maxDrawdownValue: configs.funded.maxDrawdownValue || 0,
          maxDrawdownType: configs.funded.maxDrawdownType || 'percent',
        });
      }
    }
  }, [configs]);

  const handleSaveEK = async () => {
    setIsSaving(true);
    try {
      const configToSave: AccountConfig = {
        type: 'ek',
        initialStartBalance: ekForm.initialStartBalance || 0,
        currentBalance: ekForm.currentBalance || ekForm.initialStartBalance || 0,
        defaultRiskPerTrade: ekForm.defaultRiskPerTrade || 1,
        currency: ekForm.currency || 'EUR',
      };
      await saveConfig(configToSave);
      showToast('EK Einstellungen gespeichert', 'success');
    } catch (error) {
      showToast('Fehler beim Speichern', 'error');
    }
    setIsSaving(false);
  };

  const handleSaveFunded = async () => {
    setIsSaving(true);
    try {
      const configToSave: AccountConfig = {
        type: 'funded',
        initialStartBalance: fundedForm.initialStartBalance || 0,
        currentBalance: fundedForm.currentBalance || fundedForm.initialStartBalance || 0,
        defaultRiskPerTrade: fundedForm.defaultRiskPerTrade || 1,
        currency: fundedForm.currency || 'USD',
        profitTargetValue: fundedForm.profitTargetValue,
        profitTargetType: fundedForm.profitTargetType,
        maxDrawdownValue: fundedForm.maxDrawdownValue,
        maxDrawdownType: fundedForm.maxDrawdownType,
      };
      await saveConfig(configToSave);
      showToast('Funded Einstellungen gespeichert', 'success');
    } catch (error) {
      showToast('Fehler beim Speichern', 'error');
    }
    setIsSaving(false);
  };

  const handleAddTransaction = async () => {
    if (transactionForm.amount <= 0) {
      showToast('Bitte gib einen gültigen Betrag ein', 'error');
      return;
    }

    await addTransaction(
      transactionForm.accountType,
      transactionForm.type,
      transactionForm.amount,
      transactionForm.note
    );

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
    if (confirm('Transaktion wirklich löschen? Das Balance wird entsprechend angepasst.')) {
      await deleteTransaction(id);
      showToast('Transaktion gelöscht', 'info');
      loadConfigs();
    }
  };

  const handleExport = async () => {
    try {
      const api = getApi();
      const result = await api.exportDatabase();
      if (result.success) {
        showToast((result as any).message || 'Backup erfolgreich gespeichert', 'success');
      }
    } catch (error) {
      showToast('Fehler beim Export', 'error');
    }
  };

  const handleImport = async () => {
    try {
      const api = getApi();
      const result = await api.importDatabase();
      if (result.success) {
        showToast((result as any).message || 'Daten erfolgreich importiert', 'success');
        loadConfigs();
      }
    } catch (error) {
      showToast('Fehler beim Import', 'error');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('trading-journal-offline-mode');
    setAuthUser(null);
    showToast('Erfolgreich abgemeldet', 'success');
    setTimeout(() => window.location.reload(), 500);
  };

  // ── Shared input styling ──
  const inputClass = 'w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-text-primary text-sm focus:border-accent-primary focus:outline-none font-mono';
  const selectClass = 'w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-text-primary text-sm focus:border-accent-primary focus:outline-none';
  const labelClass = 'block text-[10px] font-semibold text-text-muted uppercase tracking-[0.1em] mb-1.5';

  const ekTransactions = getTransactions('ek');
  const fundedTransactions = getTransactions('funded');

  return (
    <PageTransition>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent-primary/10">
            <SettingsIcon size={20} className="text-accent-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Einstellungen</h1>
            <p className="text-[11px] text-text-muted">Konten, Speicher & Backup</p>
          </div>
        </div>
      </div>

      {/* Cloud Storage Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-gradient-to-r from-accent-primary/[0.08] to-transparent border border-accent-primary/20 p-5"
      >
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-accent-primary/20">
            <Cloud size={20} className="text-accent-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-bold text-text-primary">Datenspeicherort</h2>
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary">
                Cloud Sync
              </span>
            </div>
            <p className="text-xs text-text-muted mb-4">
              Speichere in einem Cloud-Ordner (Google Drive, OneDrive, Dropbox) für Synchronisation.
            </p>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <HardDrive size={16} className="text-text-muted flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Aktueller Pfad</div>
                <div className="text-xs font-mono text-text-primary truncate" title={storagePath}>
                  {storagePath || 'Wird geladen...'}
                </div>
              </div>
              <button
                onClick={handleChangeStoragePath}
                disabled={isChangingPath}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 transition-colors flex-shrink-0"
              >
                {isChangingPath ? <RefreshCw size={12} className="animate-spin" /> : <FolderOpen size={12} />}
                Ändern
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account / Login Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5"
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-1.5 rounded-lg bg-accent-blue/20">
            <User size={16} className="text-accent-blue" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Konto & Anmeldung</h2>
            <p className="text-[10px] text-text-muted">Login-Status und Synchronisation</p>
          </div>
        </div>

        {inElectron ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-pnl-positive/[0.05] border border-pnl-positive/10">
            <Shield size={16} className="text-pnl-positive flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-text-primary">Desktop-Modus (Lokal)</div>
              <div className="text-[10px] text-text-muted">Alle Daten werden lokal gespeichert. Kein Login erforderlich.</div>
            </div>
          </div>
        ) : authUser ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
                  <User size={14} className="text-accent-primary" />
                </div>
                <div>
                  <div className="text-xs font-medium text-text-primary">{authUser.email}</div>
                  <div className="text-[10px] text-text-muted flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-pnl-positive" />
                    Angemeldet (Cloud Sync aktiv)
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-text-muted text-xs font-medium hover:bg-pnl-negative/20 hover:text-pnl-negative transition-colors"
              >
                <LogOut size={12} />
                Abmelden
              </button>
            </div>
          </div>
        ) : offlineMode ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-gold/[0.05] border border-accent-gold/10">
            <HardDrive size={16} className="text-accent-gold flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-text-primary">Offline-Modus</div>
              <div className="text-[10px] text-text-muted">Daten werden lokal im Browser gespeichert.</div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('trading-journal-offline-mode');
                window.location.reload();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors flex-shrink-0"
            >
              <LogIn size={12} />
              Anmelden
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <User size={16} className="text-text-muted flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-text-primary">Nicht angemeldet</div>
              <div className="text-[10px] text-text-muted">Melde dich an, um Cloud-Sync zu nutzen.</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Account Settings - 2 Columns */}
      <div className="grid grid-cols-2 gap-5">
        {/* EK Account */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5"
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-1.5 rounded-lg bg-accent-gold/20">
              <Wallet size={16} className="text-accent-gold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Eigenkapital</h2>
              <p className="text-[10px] text-text-muted">Live / Demo Trading</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Startkapital</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="1000"
                  value={ekForm.initialStartBalance || ''}
                  onChange={(e) => setEkForm({ ...ekForm, initialStartBalance: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>Aktueller Stand</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="1250"
                  value={ekForm.currentBalance || ''}
                  onChange={(e) => setEkForm({ ...ekForm, currentBalance: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Risiko / Trade (%)</label>
                <input
                  type="number"
                  className={inputClass}
                  step="0.1"
                  placeholder="1.0"
                  value={ekForm.defaultRiskPerTrade || ''}
                  onChange={(e) => setEkForm({ ...ekForm, defaultRiskPerTrade: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>Währung</label>
                <select
                  className={selectClass}
                  value={ekForm.currency}
                  onChange={(e) => setEkForm({ ...ekForm, currency: e.target.value })}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="CHF">CHF</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveEK}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-gold/20 text-accent-gold text-sm font-medium hover:bg-accent-gold/30 transition-colors"
            >
              <Save size={14} />
              Speichern
            </button>
          </div>
        </motion.div>

        {/* Funded Account */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5"
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="p-1.5 rounded-lg bg-pnl-positive/20">
              <DollarSign size={16} className="text-pnl-positive" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Funded Account</h2>
              <p className="text-[10px] text-text-muted">Challenge / Prop Firm</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Kontogröße</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="50000"
                  value={fundedForm.initialStartBalance || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, initialStartBalance: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>Aktueller Stand</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="52500"
                  value={fundedForm.currentBalance || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, currentBalance: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Risiko / Trade (%)</label>
                <input
                  type="number"
                  className={inputClass}
                  step="0.1"
                  placeholder="0.5"
                  value={fundedForm.defaultRiskPerTrade || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, defaultRiskPerTrade: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>Währung</label>
                <select
                  className={selectClass}
                  value={fundedForm.currency}
                  onChange={(e) => setFundedForm({ ...fundedForm, currency: e.target.value })}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="CHF">CHF</option>
                </select>
              </div>
            </div>

            {/* Profit Target */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-2">
                <Target size={12} className="text-pnl-positive" />
                <span className={labelClass + ' mb-0'}>Profit Target</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className={inputClass}
                  step="0.01"
                  placeholder="8"
                  value={fundedForm.profitTargetValue || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, profitTargetValue: Number(e.target.value) })}
                />
                <select
                  className={selectClass}
                  value={fundedForm.profitTargetType}
                  onChange={(e) => setFundedForm({ ...fundedForm, profitTargetType: e.target.value as 'percent' | 'absolute' })}
                >
                  <option value="percent">Prozent (%)</option>
                  <option value="absolute">Absolut ($)</option>
                </select>
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={12} className="text-pnl-negative" />
                <span className={labelClass + ' mb-0'}>Max Drawdown</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className={inputClass}
                  step="0.01"
                  placeholder="10"
                  value={fundedForm.maxDrawdownValue || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, maxDrawdownValue: Number(e.target.value) })}
                />
                <select
                  className={selectClass}
                  value={fundedForm.maxDrawdownType}
                  onChange={(e) => setFundedForm({ ...fundedForm, maxDrawdownType: e.target.value as 'percent' | 'absolute' })}
                >
                  <option value="percent">Prozent (%)</option>
                  <option value="absolute">Absolut ($)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveFunded}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-pnl-positive/20 text-pnl-positive text-sm font-medium hover:bg-pnl-positive/30 transition-colors"
            >
              <Save size={14} />
              Speichern
            </button>
          </div>
        </motion.div>
      </div>

      {/* Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <History size={16} className="text-accent-primary" />
            <h2 className="text-sm font-bold text-text-primary">Transaktionen</h2>
            {transactions.length > 0 && (
              <span className="text-[10px] font-mono text-text-muted">{transactions.length}</span>
            )}
          </div>
          <button
            onClick={() => setShowTransactionForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
          >
            <Plus size={12} />
            Neue Transaktion
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <History size={28} className="mx-auto text-text-muted/30 mb-2" />
            <p className="text-xs text-text-muted">Keine Transaktionen vorhanden</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* EK Transactions */}
            {ekTransactions.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.1em] mb-2">EK Konto</div>
                <div className="space-y-1">
                  {ekTransactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-6 h-6 rounded-md flex items-center justify-center',
                          tx.transactionType === 'deposit' ? 'bg-pnl-positive/20' :
                          tx.transactionType === 'payout' ? 'bg-accent-gold/20' : 'bg-pnl-negative/20'
                        )}>
                          {tx.transactionType === 'deposit' ? <Plus size={12} className="text-pnl-positive" /> :
                           tx.transactionType === 'payout' ? <ArrowUpRight size={12} className="text-accent-gold" /> :
                           <Minus size={12} className="text-pnl-negative" />}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-text-primary">
                            {tx.transactionType === 'deposit' ? 'Einzahlung' :
                             tx.transactionType === 'payout' ? 'Payout' : 'Auszahlung'}
                          </span>
                          <span className="text-[10px] text-text-muted ml-2">
                            {new Date(tx.date).toLocaleDateString('de-DE')}
                            {tx.note && ` · ${tx.note}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'text-xs font-bold font-mono tabular-nums',
                          tx.transactionType === 'deposit' ? 'text-pnl-positive' : 'text-pnl-negative'
                        )}>
                          {tx.transactionType === 'deposit' ? '+' : '-'}{tx.amount.toLocaleString('de-DE')} €
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
            )}

            {/* Funded Transactions */}
            {fundedTransactions.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.1em] mb-2">Funded Konto</div>
                <div className="space-y-1">
                  {fundedTransactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          'w-6 h-6 rounded-md flex items-center justify-center',
                          tx.transactionType === 'deposit' ? 'bg-pnl-positive/20' :
                          tx.transactionType === 'payout' ? 'bg-accent-gold/20' : 'bg-pnl-negative/20'
                        )}>
                          {tx.transactionType === 'deposit' ? <Plus size={12} className="text-pnl-positive" /> :
                           tx.transactionType === 'payout' ? <ArrowUpRight size={12} className="text-accent-gold" /> :
                           <Minus size={12} className="text-pnl-negative" />}
                        </div>
                        <div>
                          <span className="text-xs font-medium text-text-primary">
                            {tx.transactionType === 'deposit' ? 'Einzahlung' :
                             tx.transactionType === 'payout' ? 'Payout' : 'Auszahlung'}
                          </span>
                          <span className="text-[10px] text-text-muted ml-2">
                            {new Date(tx.date).toLocaleDateString('de-DE')}
                            {tx.note && ` · ${tx.note}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          'text-xs font-bold font-mono tabular-nums',
                          tx.transactionType === 'deposit' ? 'text-pnl-positive' : 'text-pnl-negative'
                        )}>
                          {tx.transactionType === 'deposit' ? '+' : '-'}${tx.amount.toLocaleString('de-DE')}
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
            )}
          </div>
        )}
      </motion.div>

      {/* Bottom Row: Backup + App Info */}
      <div className="grid grid-cols-2 gap-5">
        {/* Backup & Restore */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5"
        >
          <h2 className="text-sm font-bold text-text-primary mb-4">Backup & Wiederherstellung</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
              <div>
                <div className="text-xs font-medium text-text-primary">Daten exportieren</div>
                <div className="text-[10px] text-text-muted">Alle Trades & Einstellungen als JSON</div>
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
                <div className="text-xs font-medium text-text-primary">Daten importieren</div>
                <div className="text-[10px] text-text-muted">Backup-Datei wiederherstellen</div>
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

        {/* App Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-5"
        >
          <h2 className="text-sm font-bold text-text-primary mb-4">App-Information</h2>

          <div className="space-y-2">
            {[
              { label: 'Version', value: '1.1.0', icon: <CheckCircle2 size={12} className="text-pnl-positive" /> },
              { label: 'Plattform', value: 'Electron Desktop', icon: null },
              { label: 'Datenbank', value: 'Lokale JSON-DB', icon: null },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  {item.icon}
                  <span className="text-xs font-medium font-mono text-text-primary">{item.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-pnl-positive/[0.05] border border-pnl-positive/10">
            <Shield size={14} className="text-pnl-positive flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-text-muted leading-relaxed">
              <strong className="text-text-primary">100% Privat:</strong> Alle Daten werden lokal gespeichert.
              Keine Server, keine Drittanbieter.
            </p>
          </div>
        </motion.div>
      </div>

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
              {/* Account Type */}
              <div>
                <label className={labelClass}>Konto</label>
                <div className="flex gap-2">
                  {(['ek', 'funded'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTransactionForm(prev => ({ ...prev, accountType: type }))}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                        transactionForm.accountType === type
                          ? type === 'ek' ? 'bg-accent-gold/20 text-accent-gold' : 'bg-pnl-positive/20 text-pnl-positive'
                          : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06]'
                      )}
                    >
                      {type === 'ek' ? 'Eigenkapital' : 'Funded'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Type */}
              <div>
                <label className={labelClass}>Typ</label>
                <div className="flex gap-2">
                  {[
                    { value: 'deposit' as const, label: 'Einzahlung', icon: <Plus size={12} />, activeClass: 'bg-pnl-positive/20 text-pnl-positive' },
                    { value: 'withdrawal' as const, label: 'Auszahlung', icon: <Minus size={12} />, activeClass: 'bg-pnl-negative/20 text-pnl-negative' },
                    { value: 'payout' as const, label: 'Payout', icon: <ArrowUpRight size={12} />, activeClass: 'bg-accent-gold/20 text-accent-gold' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTransactionForm(prev => ({ ...prev, type: opt.value }))}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all',
                        transactionForm.type === opt.value
                          ? opt.activeClass
                          : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06]'
                      )}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className={labelClass}>Betrag</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="500"
                  value={transactionForm.amount || ''}
                  onChange={(e) => setTransactionForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                />
              </div>

              {/* Note */}
              <div>
                <label className={labelClass}>Notiz (optional)</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="z.B. Monatlicher Payout"
                  value={transactionForm.note}
                  onChange={(e) => setTransactionForm(prev => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowTransactionForm(false)}
                  className="flex-1 py-2 rounded-lg bg-white/[0.03] text-text-muted text-xs font-medium hover:bg-white/[0.06] transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAddTransaction}
                  className="flex-1 py-2 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/90 transition-colors"
                >
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
