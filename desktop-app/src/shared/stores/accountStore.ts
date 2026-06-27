/**
 * ========================================================================
 * Trading Journal - Account Store (Zustand + Supabase)
 * ========================================================================
 * Multi-Account-Support: mehrere Funded-Accounts, Account-Wechsel.
 * Kein Auto-Default: configs.ek / configs.funded sind null bis ein
 * Account angelegt wird.
 */

import { create } from 'zustand';
import type { AccountConfigs, AccountConfig, AccountType, Transaction, TransactionType } from '@/shared/types';
import * as configService from '@/shared/services/accountConfigService';

interface AccountState {
  // Data
  configs: AccountConfigs | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  // Active account IDs (für Multi-Account-Switching)
  activeAccountId: { ek?: string; funded?: string };

  // Actions
  loadConfigs: () => Promise<void>;
  saveConfig: (config: AccountConfig) => Promise<boolean>;
  createAccount: (config: Omit<AccountConfig, 'id'>) => Promise<boolean>;
  deleteAccount: (accountId: string, accountType: AccountType) => Promise<boolean>;
  setActiveAccount: (type: AccountType, id: string) => Promise<void>;
  addTransaction: (type: AccountType, transactionType: TransactionType, amount: number, note?: string) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<void>;
  loadTransactions: () => Promise<void>;

  // Getters
  getConfig: (type: AccountType) => AccountConfig | null;
  getBalance: (type: AccountType) => number;
  getTransactions: (type: AccountType) => Transaction[];
  getFundedAccounts: () => AccountConfig[];
  getEkAccounts: () => AccountConfig[];
  hasAccount: (type: AccountType) => boolean;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  configs: null,
  transactions: [],
  isLoading: false,
  error: null,
  activeAccountId: {},

  // ============================================================
  // LOAD
  // ============================================================

  loadConfigs: async () => {
    set({ isLoading: true, error: null });
    try {
      const configs = await configService.loadAccountConfigs();

      // Aktive Account-IDs aus geladenen Configs ableiten
      const activeAccountId: { ek?: string; funded?: string } = {};
      if (configs.ek?.id)     activeAccountId.ek     = configs.ek.id;
      if (configs.funded?.id) activeAccountId.funded = configs.funded.id;

      set({ configs, activeAccountId, isLoading: false });
      get().loadTransactions();
    } catch (error) {
      console.error('loadConfigs Fehler:', error);
      // Kein Fallback auf Defaults – leer lassen bis Account angelegt wird
      set({ configs: { ek: null, funded: null }, error: null, isLoading: false });
    }
  },

  loadTransactions: async () => {
    try {
      const transactions = await configService.loadTransactions();
      set({ transactions });
    } catch (e) {
      console.error('loadTransactions Fehler:', e);
      try {
        const stored = localStorage.getItem('accountTransactions');
        if (stored) set({ transactions: JSON.parse(stored) });
      } catch {}
    }
  },

  // ============================================================
  // SAVE / CREATE
  // ============================================================

  saveConfig: async (config) => {
    try {
      await configService.saveAccountConfig(config);
      set(state => {
        if (!state.configs) return { configs: { ek: null, funded: null } };
        const updated: AccountConfigs = { ...state.configs };
        if (config.type === 'ek')     updated.ek     = config;
        if (config.type === 'funded') {
          updated.funded = config;
          // Auch in fundedAccounts aktualisieren
          updated.fundedAccounts = (state.configs.fundedAccounts || []).map(a =>
            a.id === config.id ? config : a
          );
        }
        return { configs: updated };
      });
      return true;
    } catch (error) {
      console.error('saveConfig Fehler:', error);
      set({ error: 'Fehler beim Speichern der Kontoeinstellungen' });
      return false;
    }
  },

  createAccount: async (configData) => {
    try {
      const created = await configService.createAccount(configData);
      set(state => {
        const current = state.configs ?? { ek: null, funded: null };
        const updated: AccountConfigs = { ...current };

        if (created.type === 'ek' && !current.ek) {
          updated.ek = created;
        } else if (created.type === 'funded') {
          if (!current.funded || created.isDefault) {
            updated.funded = created;
          }
          updated.fundedAccounts = [...(current.fundedAccounts || []), created];
        }

        const activeAccountId = { ...state.activeAccountId };
        if (created.id) activeAccountId[created.type] = created.id;

        return { configs: updated, activeAccountId };
      });
      return true;
    } catch (error) {
      console.error('createAccount Fehler:', error);
      set({ error: 'Fehler beim Erstellen des Kontos' });
      return false;
    }
  },

  // ============================================================
  // ACCOUNT WECHSELN (Multi-Funded)
  // ============================================================

  setActiveAccount: async (type, id) => {
    try {
      await configService.setDefaultAccount(id, type);
      set(state => {
        if (!state.configs) return {};
        const updated: AccountConfigs = { ...state.configs };

        if (type === 'funded') {
          const target = (state.configs.fundedAccounts || []).find(a => a.id === id);
          if (target) updated.funded = { ...target, isDefault: true };
        }

        return {
          configs: updated,
          activeAccountId: { ...state.activeAccountId, [type]: id },
        };
      });
    } catch (error) {
      console.error('setActiveAccount Fehler:', error);
    }
  },

  // ============================================================
  // ACCOUNT LÖSCHEN
  // ============================================================

  deleteAccount: async (accountId, accountType) => {
    try {
      await configService.deleteAccount(accountId, accountType);
      set(state => {
        if (!state.configs) return {};
        const updated: AccountConfigs = { ...state.configs };
        if (accountType === 'ek') {
          const remaining = (state.configs.ekAccounts || []).filter(a => a.id !== accountId);
          updated.ekAccounts = remaining;
          updated.ek = remaining[0] ?? null;
        } else {
          const remaining = (state.configs.fundedAccounts || []).filter(a => a.id !== accountId);
          updated.fundedAccounts = remaining;
          updated.funded = remaining[0] ?? null;
        }
        return { configs: updated };
      });
      return true;
    } catch (error) {
      console.error('deleteAccount Fehler:', error);
      return false;
    }
  },

  // ============================================================
  // TRANSAKTIONEN
  // ============================================================

  addTransaction: async (accountType, transactionType, amount, note) => {
    try {
      const config = get().getConfig(accountType);
      const tx = await configService.saveTransaction({
        type: accountType,
        transactionType,
        amount,
        date: new Date().toISOString(),
        note: note || '',
        accountId: config?.id,
      });

      set(state => ({ transactions: [tx, ...state.transactions] }));

      if (config) {
        let newBalance = config.currentBalance;
        if (transactionType === 'deposit')                                  newBalance += amount;
        else if (transactionType === 'withdrawal' || transactionType === 'payout') newBalance -= amount;
        await get().saveConfig({ ...config, currentBalance: newBalance });
      }
      return true;
    } catch (error) {
      console.error('addTransaction Fehler:', error);
      return false;
    }
  },

  deleteTransaction: async (id) => {
    const transaction = get().transactions.find(t => t.id === id);
    if (!transaction) return;
    try {
      await configService.removeTransaction(id);

      const config = get().getConfig(transaction.type);
      if (config) {
        let newBalance = config.currentBalance;
        if (transaction.transactionType === 'deposit')                                        newBalance -= transaction.amount;
        else if (transaction.transactionType === 'withdrawal' || transaction.transactionType === 'payout') newBalance += transaction.amount;
        await get().saveConfig({ ...config, currentBalance: newBalance });
      }

      set(state => ({ transactions: state.transactions.filter(t => t.id !== id) }));
    } catch (error) {
      console.error('deleteTransaction Fehler:', error);
    }
  },

  // ============================================================
  // GETTERS
  // ============================================================

  getConfig: (type) => get().configs?.[type] ?? null,
  getBalance: (type) => get().getConfig(type)?.currentBalance ?? 0,
  getTransactions: (type) => get().transactions.filter(t => t.type === type),
  getFundedAccounts: () => get().configs?.fundedAccounts ?? [],
  getEkAccounts: () => get().configs?.ekAccounts ?? [],
  hasAccount: (type) => get().getConfig(type) !== null,
}));
