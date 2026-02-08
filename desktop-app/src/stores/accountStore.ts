/**
 * ========================================================================
 * Trading Journal - Account Store (Zustand)
 * ========================================================================
 * 
 * State Management für Account-Konfigurationen, Balances und Transaktionen.
 * Unterstützt Electron und Web (Vercel).
 */

import { create } from 'zustand';
import type { AccountConfigs, AccountConfig, AccountType, Transaction, TransactionType } from '@/types';
import { getApi } from '@/services/webApi';

// Lokaler Transaktions-Speicher Key
const TRANSACTIONS_KEY = 'accountTransactions';

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
  loadTransactions: () => void;

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
  // Initial State
  configs: null,
  transactions: [],
  isLoading: false,
  error: null,

  // Load Transactions from localStorage
  loadTransactions: () => {
    try {
      const stored = localStorage.getItem(TRANSACTIONS_KEY);
      if (stored) {
        set({ transactions: JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Error loading transactions:', e);
    }
  },

  // Load Configs - verwendet loadAccountConfig (Singular!)
  loadConfigs: async () => {
    set({ isLoading: true, error: null });

    // Also load transactions
    get().loadTransactions();

    try {
      const api = getApi();
      const configs = await api.loadAccountConfig();
      set({ 
        configs: configs || defaultConfigs, 
        isLoading: false 
      });
    } catch (error) {
      console.error('Error loading configs:', error);
      set({ 
        configs: defaultConfigs, 
        error: 'Fehler beim Laden der Kontoeinstellungen', 
        isLoading: false 
      });
    }
  },

  // Save Config - speichert EINE Config (ek oder funded)
  saveConfig: async (config) => {
    try {
      const api = getApi();
      await api.saveAccountConfig(config);
      // Update local state
      set(state => ({
        configs: state.configs ? {
          ...state.configs,
          [config.type]: config
        } : defaultConfigs
      }));
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      set({ error: 'Fehler beim Speichern der Kontoeinstellungen' });
      return false;
    }
  },

  // Add Transaction
  addTransaction: async (accountType, transactionType, amount, note) => {
    const transaction: Transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: accountType,
      transactionType,
      amount,
      date: new Date().toISOString(),
      note: note || '',
    };

    const newTransactions = [...get().transactions, transaction];
    set({ transactions: newTransactions });
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(newTransactions));

    // Update balance
    const config = get().getConfig(accountType);
    if (config) {
      let newBalance = config.currentBalance;
      
      if (transactionType === 'deposit') {
        newBalance += amount;
      } else if (transactionType === 'withdrawal' || transactionType === 'payout') {
        newBalance -= amount;
      }

      const updatedConfig = { ...config, currentBalance: newBalance };
      await get().saveConfig(updatedConfig);
    }

    return true;
  },

  // Delete Transaction
  deleteTransaction: async (id) => {
    const transaction = get().transactions.find(t => t.id === id);
    if (!transaction) return;

    // Reverse the balance change
    const config = get().getConfig(transaction.type);
    if (config) {
      let newBalance = config.currentBalance;
      
      if (transaction.transactionType === 'deposit') {
        newBalance -= transaction.amount;
      } else if (transaction.transactionType === 'withdrawal' || transaction.transactionType === 'payout') {
        newBalance += transaction.amount;
      }

      await get().saveConfig({ ...config, currentBalance: newBalance });
    }

    const newTransactions = get().transactions.filter(t => t.id !== id);
    set({ transactions: newTransactions });
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(newTransactions));
  },

  // Getters
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
