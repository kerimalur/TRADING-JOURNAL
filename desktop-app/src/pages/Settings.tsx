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
  Info
} from 'lucide-react';
import { useAccountStore } from '@/stores/accountStore';
import { useUIStore } from '@/stores/uiStore';
import { getApi, isElectron } from '@/services/webApi';
import type { AccountConfig, TransactionType } from '@/types';
import { clsx } from 'clsx';

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

  useEffect(() => {
    loadConfigs();
    loadStoragePath();
  }, []);

  // Load current storage path
  const loadStoragePath = async () => {
    try {
      const api = getApi();
      const path = await api.getStoragePath();
      setStoragePath(path);
    } catch (error) {
      console.error('Failed to load storage path:', error);
    }
  };

  // Change storage path (only in Electron)
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
        // Reload window after short delay
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      showToast('Fehler beim Ändern des Speicherorts', 'error');
    }
    setIsChangingPath(false);
  };

  // Lade gespeicherte Werte wenn configs sich ändert
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
    
    // Reload configs to update balances
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
        showToast(result.message || 'Backup erfolgreich gespeichert', 'success');
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
        showToast(result.message || 'Daten erfolgreich importiert', 'success');
        loadConfigs();
      }
    } catch (error) {
      showToast('Fehler beim Import', 'error');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <SettingsIcon className="text-accent-primary" />
          Einstellungen
        </h1>
      </div>

      {/* Storage Location - Full Width Important Section */}
      <div className="glass-card mb-6 p-6 border-accent-primary/30 bg-gradient-to-r from-glass-accent to-transparent">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-primary/20 rounded-xl">
            <Cloud className="text-accent-primary" size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-text-primary">Datenspeicherort</h2>
              <span className="badge-accent">
                Cloud Sync
              </span>
            </div>
            <p className="text-sm text-text-muted mb-4">
              Speichere deine Daten in einem Cloud-Ordner (Google Drive, OneDrive, Dropbox), 
              um sie zwischen mehreren Geräten zu synchronisieren.
            </p>
            
            <div className="flex items-center gap-4 p-4 bg-glass-white rounded-xl border border-border">
              <HardDrive size={20} className="text-text-subtle flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text-muted mb-1">Aktueller Speicherort</div>
                <div className="text-sm font-mono text-text-primary truncate" title={storagePath}>
                  {storagePath || 'Wird geladen...'}
                </div>
              </div>
              <button
                onClick={handleChangeStoragePath}
                disabled={isChangingPath}
                className="btn-primary flex-shrink-0"
              >
                {isChangingPath ? (
                  <RefreshCw size={16} className="animate-spin mr-2" />
                ) : (
                  <FolderOpen size={16} className="mr-2" />
                )}
                Ordner ändern
              </button>
            </div>

            <div className="flex items-start gap-2 mt-3 p-3 bg-glass-blue rounded-xl border border-accent-secondary/20">
              <Info size={16} className="text-accent-secondary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-text-subtle">
                <strong className="text-text-primary">Tipp:</strong> Wähle deinen Google Drive oder Dropbox Ordner, 
                um deine Trades automatisch auf allen Geräten verfügbar zu haben. 
                Ein Unterordner "TradingJournal" wird automatisch erstellt.
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* EK Settings */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-accent-gold/20 rounded-xl">
              <Wallet className="text-accent-primary" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Eigenkapital Konto</h2>
              <p className="text-sm text-text-muted">Live/Demo Trading</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Startkapital</label>
                <input
                  type="number"
                  className="input"
                  placeholder="z.B. 1000"
                  value={ekForm.initialStartBalance || ''}
                  onChange={(e) => setEkForm({ ...ekForm, initialStartBalance: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="input-label">Aktueller Stand</label>
                <input
                  type="number"
                  className="input"
                  placeholder="z.B. 1250"
                  value={ekForm.currentBalance || ''}
                  onChange={(e) => setEkForm({ ...ekForm, currentBalance: Number(e.target.value) })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Risiko pro Trade (%)</label>
                <input
                  type="number"
                  className="input"
                  step="0.1"
                  placeholder="z.B. 1.0"
                  value={ekForm.defaultRiskPerTrade || ''}
                  onChange={(e) => setEkForm({ ...ekForm, defaultRiskPerTrade: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="input-label">Währung</label>
                <select
                  className="select"
                  value={ekForm.currency}
                  onChange={(e) => setEkForm({ ...ekForm, currency: e.target.value })}
                >
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="CHF">CHF (Fr.)</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleSaveEK} 
              disabled={isSaving}
              className="btn-primary w-full"
            >
              <Save size={18} className="mr-2 inline" />
              EK Einstellungen speichern
            </button>
          </div>
        </div>

        {/* Funded Settings */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-pnl-positive/20 rounded-lg">
              <DollarSign className="text-pnl-positive" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Funded Account</h2>
              <p className="text-sm text-text-muted">Challenge/Prop Firm</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Kontogröße</label>
                <input
                  type="number"
                  className="input"
                  placeholder="z.B. 50000"
                  value={fundedForm.initialStartBalance || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, initialStartBalance: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="input-label">Aktueller Stand</label>
                <input
                  type="number"
                  className="input"
                  placeholder="z.B. 52500"
                  value={fundedForm.currentBalance || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, currentBalance: Number(e.target.value) })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Risiko pro Trade (%)</label>
                <input
                  type="number"
                  className="input"
                  step="0.1"
                  placeholder="z.B. 0.5"
                  value={fundedForm.defaultRiskPerTrade || ''}
                  onChange={(e) => setFundedForm({ ...fundedForm, defaultRiskPerTrade: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="input-label">Währung</label>
                <select
                  className="select"
                  value={fundedForm.currency}
                  onChange={(e) => setFundedForm({ ...fundedForm, currency: e.target.value })}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CHF">CHF (Fr.)</option>
                </select>
              </div>
            </div>

            {/* Profit Target */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-pnl-positive" />
                <span className="text-sm font-medium text-text-primary">Profit Target</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Wert</label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    placeholder="z.B. 8"
                    value={fundedForm.profitTargetValue || ''}
                    onChange={(e) => setFundedForm({ ...fundedForm, profitTargetValue: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="input-label">Typ</label>
                  <select
                    className="select"
                    value={fundedForm.profitTargetType}
                    onChange={(e) => setFundedForm({ ...fundedForm, profitTargetType: e.target.value as 'percent' | 'absolute' })}
                  >
                    <option value="percent">Prozent (%)</option>
                    <option value="absolute">Absolut ($)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Max Drawdown */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-pnl-negative" />
                <span className="text-sm font-medium text-text-primary">Max Drawdown</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Wert</label>
                  <input
                    type="number"
                    className="input"
                    step="0.01"
                    placeholder="z.B. 10"
                    value={fundedForm.maxDrawdownValue || ''}
                    onChange={(e) => setFundedForm({ ...fundedForm, maxDrawdownValue: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="input-label">Typ</label>
                  <select
                    className="select"
                    value={fundedForm.maxDrawdownType}
                    onChange={(e) => setFundedForm({ ...fundedForm, maxDrawdownType: e.target.value as 'percent' | 'absolute' })}
                  >
                    <option value="percent">Prozent (%)</option>
                    <option value="absolute">Absolut ($)</option>
                  </select>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveFunded} 
              disabled={isSaving}
              className="btn-primary w-full"
            >
              <Save size={18} className="mr-2 inline" />
              Funded Einstellungen speichern
            </button>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Backup & Wiederherstellung</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-glass-white rounded-lg border border-border">
              <h3 className="font-medium text-text-primary mb-2">Daten exportieren</h3>
              <p className="text-sm text-text-muted mb-4">
                Exportiere alle Trades, Einstellungen und Marktdaten als JSON-Datei.
              </p>
              <button onClick={handleExport} className="btn-primary">
                <Download size={18} className="mr-2 inline" />
                Backup erstellen
              </button>
            </div>

            <div className="p-4 bg-glass-white rounded-lg border border-border">
              <h3 className="font-medium text-text-primary mb-2">Daten importieren</h3>
              <p className="text-sm text-text-muted mb-4">
                Importiere ein zuvor erstelltes Backup.
              </p>
              <button onClick={handleImport} className="btn-secondary">
                <Upload size={18} className="mr-2 inline" />
                Backup laden
              </button>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="card col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <History className="text-accent-primary" size={20} />
              <h2 className="text-lg font-semibold text-text-primary">Transaktionen</h2>
            </div>
            <button 
              onClick={() => setShowTransactionForm(true)}
              className="btn-primary"
            >
              <Plus size={16} className="mr-1" />
              Neue Transaktion
            </button>
          </div>

          {/* Transaction Form Modal */}
          {showTransactionForm && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="bg-background-surface rounded-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Neue Transaktion</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="input-label">Konto</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTransactionForm(prev => ({ ...prev, accountType: 'ek' }))}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-medium transition-all',
                          transactionForm.accountType === 'ek'
                            ? 'bg-accent-gold text-black'
                            : 'bg-background-surface-hover text-text-muted'
                        )}
                      >
                        EK
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransactionForm(prev => ({ ...prev, accountType: 'funded' }))}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-medium transition-all',
                          transactionForm.accountType === 'funded'
                            ? 'bg-pnl-positive text-white'
                            : 'bg-background-surface-hover text-text-muted'
                        )}
                      >
                        Funded
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Typ</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTransactionForm(prev => ({ ...prev, type: 'deposit' }))}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1',
                          transactionForm.type === 'deposit'
                            ? 'bg-pnl-positive text-white'
                            : 'bg-background-surface-hover text-text-muted'
                        )}
                      >
                        <Plus size={16} /> Einzahlung
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransactionForm(prev => ({ ...prev, type: 'withdrawal' }))}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1',
                          transactionForm.type === 'withdrawal'
                            ? 'bg-pnl-negative text-white'
                            : 'bg-background-surface-hover text-text-muted'
                        )}
                      >
                        <Minus size={16} /> Auszahlung
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransactionForm(prev => ({ ...prev, type: 'payout' }))}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1',
                          transactionForm.type === 'payout'
                            ? 'bg-accent-gold text-black'
                            : 'bg-background-surface-hover text-text-muted'
                        )}
                      >
                        <ArrowUpRight size={16} /> Payout
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="input-label">Betrag</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="z.B. 500"
                      value={transactionForm.amount || ''}
                      onChange={(e) => setTransactionForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    />
                  </div>

                  <div>
                    <label className="input-label">Notiz (optional)</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="z.B. Monatlicher Payout"
                      value={transactionForm.note}
                      onChange={(e) => setTransactionForm(prev => ({ ...prev, note: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setShowTransactionForm(false)}
                      className="btn-secondary flex-1"
                    >
                      Abbrechen
                    </button>
                    <button 
                      onClick={handleAddTransaction}
                      className="btn-primary flex-1"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction List */}
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                Keine Transaktionen vorhanden
              </div>
            ) : (
              <>
                {/* EK Transactions */}
                {getTransactions('ek').length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-text-muted mb-2">EK Konto</h4>
                    {getTransactions('ek').map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-glass-white rounded-lg mb-2">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'p-2 rounded-lg',
                            tx.transactionType === 'deposit' ? 'bg-pnl-positive/20' :
                            tx.transactionType === 'payout' ? 'bg-accent-gold/20' : 'bg-pnl-negative/20'
                          )}>
                            {tx.transactionType === 'deposit' ? <Plus size={16} className="text-pnl-positive" /> :
                             tx.transactionType === 'payout' ? <ArrowUpRight size={16} className="text-accent-primary" /> :
                             <Minus size={16} className="text-pnl-negative" />}
                          </div>
                          <div>
                            <div className="font-medium">
                              {tx.transactionType === 'deposit' ? 'Einzahlung' :
                               tx.transactionType === 'payout' ? 'Payout' : 'Auszahlung'}
                            </div>
                            <div className="text-xs text-text-muted">
                              {new Date(tx.date).toLocaleDateString('de-DE')}
                              {tx.note && ` • ${tx.note}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={clsx(
                            'font-bold',
                            tx.transactionType === 'deposit' ? 'text-pnl-positive' : 'text-pnl-negative'
                          )}>
                            {tx.transactionType === 'deposit' ? '+' : '-'}
                            {tx.amount.toLocaleString('de-DE')} €
                          </span>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1 hover:bg-pnl-negative/20 rounded"
                          >
                            <Trash2 size={14} className="text-text-muted hover:text-pnl-negative" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Funded Transactions */}
                {getTransactions('funded').length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-text-muted mb-2">Funded Konto</h4>
                    {getTransactions('funded').map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-glass-white rounded-lg mb-2">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'p-2 rounded-lg',
                            tx.transactionType === 'deposit' ? 'bg-pnl-positive/20' :
                            tx.transactionType === 'payout' ? 'bg-accent-gold/20' : 'bg-pnl-negative/20'
                          )}>
                            {tx.transactionType === 'deposit' ? <Plus size={16} className="text-pnl-positive" /> :
                             tx.transactionType === 'payout' ? <ArrowUpRight size={16} className="text-accent-primary" /> :
                             <Minus size={16} className="text-pnl-negative" />}
                          </div>
                          <div>
                            <div className="font-medium">
                              {tx.transactionType === 'deposit' ? 'Einzahlung' :
                               tx.transactionType === 'payout' ? 'Payout' : 'Auszahlung'}
                            </div>
                            <div className="text-xs text-text-muted">
                              {new Date(tx.date).toLocaleDateString('de-DE')}
                              {tx.note && ` • ${tx.note}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={clsx(
                            'font-bold',
                            tx.transactionType === 'deposit' ? 'text-pnl-positive' : 'text-pnl-negative'
                          )}>
                            {tx.transactionType === 'deposit' ? '+' : '-'}
                            ${tx.amount.toLocaleString('de-DE')}
                          </span>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="p-1 hover:bg-pnl-negative/20 rounded"
                          >
                            <Trash2 size={14} className="text-text-muted hover:text-pnl-negative" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* App Info */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent-purple/20 rounded-lg">
              <Info className="text-accent-purple" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">App-Information</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-glass-white rounded-lg">
              <span className="text-text-muted">Version</span>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-pnl-positive" />
                <span className="font-bold text-accent-primary">1.1.0</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-3 bg-glass-white rounded-lg">
              <span className="text-text-muted">Plattform</span>
              <span className="font-medium text-text-primary">Electron Desktop</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-glass-white rounded-lg">
              <span className="text-text-muted">Datenbank</span>
              <span className="font-medium text-text-primary">Lokale JSON-DB</span>
            </div>
            <div className="pt-4 mt-2 border-t border-border">
              <div className="flex items-start gap-2 p-3 bg-pnl-positive/10 rounded-lg border border-pnl-positive/20">
                <CheckCircle2 size={16} className="text-pnl-positive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-subtle">
                  <strong className="text-text-primary">100% Privat:</strong> Alle Daten werden lokal gespeichert. 
                  Keine Server, keine Drittanbieter. Deine Trades bleiben bei dir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
