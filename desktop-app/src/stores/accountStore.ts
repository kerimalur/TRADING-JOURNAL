/**
 * ========================================================================
 * Trading Journal - Account Store (Zustand + Supabase)
 * ========================================================================
 * State Management für Account-Konfigurationen, Balances und Transaktionen.
 * Persistence via Supabase.
 */

import { create } from 'zustand';
import type { AccountConfigs, AccountConfig, AccountType, Transaction, TransactionType } from '@/types';
import * as configService from '@/services/accountConfigService';

interface AccountState {
  // Data
  configs: AccountConfigs | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConfigs: () => Promise<void>;
  saveConfig: (config: AccountConfig) => Promise<boolean>;
  addTransaction: (type: AccountType, transactionType: TransactionType, amount: number, note?: string) => Promise<boolean>;
  deleteTransaction: (id: string) => Promise<void>;
  loadTransactions: () => Promise<void>;

  // Getters
  getConfig: (type: AccountType) => AccountConfig | null;
  getBalance: (type: AccountType) => number;
  getTransactions: (type: AccountType) => Transaction[];
}

const defaultConfigs: AccountConfigs = {
  ek: {
    initialStartBalance: 10000,
    currentBalance: 10000,
    currency: 'USD',
    type: 'ek',
    defaultRiskPerTrade: 0.5,
  },
  funded: {
    initialStartBalance: 100000,
    currentBalance: 100000,
    currency: 'USD',
    type: 'funded',
    enableGoals: true,
    profitTargetValue: 8,
    profitTargetType: 'percent',
    maxDrawdownValue: 5,
    maxDrawdownType: 'percent',
    profitTarget: 108000,
    maxDrawdown: 95000,
    defaultRiskPerTrade: 1.0,
  },
};

export const useAccountStore = create<AccountState>((set, get) => ({
  configs: null,
  transactions: [],
  isLoading: false,
  error: null,

  loadTransactions: async () => {
    try {
      const transactions = await configService.loadTransactions();
      set({ transactions });
    } catch (e) {
      console.error('Error loading transactions:', e);
      // Fallback: try localStorage
      try {
        const stored = localStorage.getItem('accountTransactions');
        if (stored) set({ transactions: JSON.parse(stored) });
      } catch {}
    }
  },

  loadConfigs: async () => {
    set({ isLoading: true, error: null });

    try {
      const configs = await configService.loadAccountConfigs();
      set({ configs, isLoading: false });
      // Also load transactions
      get().loadTransactions();
    } catch (error) {
      console.error('Error loading configs:', error);
      set({
        configs: defaultConfigs,
        error: 'Fehler beim Laden der Kontoeinstellungen',
        isLoading: false,
      });
    }
  },

  saveConfig: async (config) => {
    try {
      await configService.saveAccountConfig(config);
      set(state => ({
        configs: state.configs
          ? { ...state.configs, [config.type]: config }
          : defaultConfigs,
      }));
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      set({ error: 'Fehler beim Speichern der Kontoeinstellungen' });
      return false;
    }
  },

  addTransaction: async (accountType, transactionType, amount, note) => {
    try {
      const tx = await configService.saveTransaction({
        type: accountType,
        transactionType,
        amount,
        date: new Date().toISOString(),
        note: note || '',
      });

      set(state => ({
        transactions: [tx, ...state.transactions],
      }));

      // Update balance
      const config = get().getConfig(accountType);
      if (config) {
        let newBalance = config.currentBalance;
        if (transactionType === 'deposit') newBalance += amount;
        else if (transactionType === 'withdrawal' || transactionType === 'payout') newBalance -= amount;

        await get().saveConfig({ ...config, currentBalance: newBalance });
      }

      return true;
    } catch (error) {
      console.error('Error adding transaction:', error);
      return false;
    }
  },

  deleteTransaction: async (id) => {
    const transaction = get().transactions.find(t => t.id === id);
    if (!transaction) return;

    try {
      await configService.removeTransaction(id);

      // Reverse balance change
      const config = get().getConfig(transaction.type);
      if (config) {
        let newBalance = config.currentBalance;
        if (transaction.transactionType === 'deposit') newBalance -= transaction.amount;
        else if (transaction.transactionType === 'withdrawal' || transaction.transactionType === 'payout') newBalance += transaction.amount;

        await get().saveConfig({ ...config, currentBalance: newBalance });
      }

      set(state => ({
        transactions: state.transactions.filter(t => t.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  },

  getConfig: (type) => {
    const configs = get().configs;
    return configs ? configs[type] : null;
  },

  getBalance: (type) => {
    const config = get().getConfig(type);
    return config?.currentBalance || 0;
  },

  getTransactions: (type) => {
    return get().transactions.filter(t => t.type === type);
  },
}));
