/**
 * ========================================================================
 * Trading Journal - Risk Management Store (Zustand)
 * ========================================================================
 * 
 * Zentrales Risk Management System:
 * - Daily/Weekly/Monthly Loss Limits
 * - Drawdown Alerts
 * - Risk Tracking & Notifications
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RiskSettings {
  // Daily Limits
  dailyLossLimitEnabled: boolean;
  dailyLossLimitR: number;        // Max R-Multiple Verlust pro Tag
  dailyLossLimitPercent: number;  // Max % Verlust pro Tag
  dailyTradeLimit: number;        // Max Trades pro Tag
  
  // Weekly Limits
  weeklyLossLimitEnabled: boolean;
  weeklyLossLimitR: number;
  weeklyLossLimitPercent: number;
  
  // Drawdown Alerts
  drawdownAlertEnabled: boolean;
  drawdownAlertThreshold: number; // % vom Peak
  
  // Consecutive Losses
  consecutiveLossAlertEnabled: boolean;
  consecutiveLossLimit: number;   // Nach X Verlusten warnen
  
  // Tilt Detection
  tiltDetectionEnabled: boolean;
  tiltTradeFrequency: number;     // Trades innerhalb von X Minuten
  tiltFrequencyWindow: number;    // Zeitfenster in Minuten
}

export interface RiskAlert {
  id: string;
  type: 'daily_loss' | 'weekly_loss' | 'drawdown' | 'consecutive_loss' | 'trade_limit' | 'tilt';
  message: string;
  severity: 'warning' | 'danger' | 'info';
  timestamp: string;
  acknowledged: boolean;
}

interface RiskState {
  settings: RiskSettings;
  alerts: RiskAlert[];
  
  // Daily Stats
  dailyStats: {
    date: string;
    trades: number;
    totalR: number;
    consecutiveLosses: number;
    lastTradeTime: string | null;
  };
  
  // Actions
  updateSettings: (settings: Partial<RiskSettings>) => void;
  addAlert: (alert: Omit<RiskAlert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;
  updateDailyStats: (r: number, isLoss: boolean) => void;
  resetDailyStats: () => void;
  
  // Risk Check Functions
  checkDailyLimits: (currentDayR: number, tradesCount: number) => RiskAlert | null;
  checkDrawdown: (currentBalance: number, peakBalance: number) => RiskAlert | null;
  checkConsecutiveLosses: (losses: number) => RiskAlert | null;
}

const defaultSettings: RiskSettings = {
  dailyLossLimitEnabled: true,
  dailyLossLimitR: 3,
  dailyLossLimitPercent: 2,
  dailyTradeLimit: 5,
  
  weeklyLossLimitEnabled: true,
  weeklyLossLimitR: 10,
  weeklyLossLimitPercent: 5,
  
  drawdownAlertEnabled: true,
  drawdownAlertThreshold: 5,
  
  consecutiveLossAlertEnabled: true,
  consecutiveLossLimit: 3,
  
  tiltDetectionEnabled: true,
  tiltTradeFrequency: 3,
  tiltFrequencyWindow: 30,
};

const generateId = () => `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useRiskStore = create<RiskState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      alerts: [],
      
      dailyStats: {
        date: new Date().toISOString().split('T')[0],
        trades: 0,
        totalR: 0,
        consecutiveLosses: 0,
        lastTradeTime: null,
      },
      
      updateSettings: (newSettings) => {
        set(state => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },
      
      addAlert: (alert) => {
        const newAlert: RiskAlert = {
          ...alert,
          id: generateId(),
          timestamp: new Date().toISOString(),
          acknowledged: false,
        };
        set(state => ({
          alerts: [newAlert, ...state.alerts].slice(0, 50) // Keep last 50 alerts
        }));
      },
      
      acknowledgeAlert: (id) => {
        set(state => ({
          alerts: state.alerts.map(a => 
            a.id === id ? { ...a, acknowledged: true } : a
          )
        }));
      },
      
      clearAlerts: () => {
        set({ alerts: [] });
      },
      
      updateDailyStats: (r, isLoss) => {
        const today = new Date().toISOString().split('T')[0];
        
        set(state => {
          // Reset if new day
          if (state.dailyStats.date !== today) {
            return {
              dailyStats: {
                date: today,
                trades: 1,
                totalR: r,
                consecutiveLosses: isLoss ? 1 : 0,
                lastTradeTime: new Date().toISOString(),
              }
            };
          }
          
          return {
            dailyStats: {
              ...state.dailyStats,
              trades: state.dailyStats.trades + 1,
              totalR: state.dailyStats.totalR + r,
              consecutiveLosses: isLoss ? state.dailyStats.consecutiveLosses + 1 : 0,
              lastTradeTime: new Date().toISOString(),
            }
          };
        });
      },
      
      resetDailyStats: () => {
        set({
          dailyStats: {
            date: new Date().toISOString().split('T')[0],
            trades: 0,
            totalR: 0,
            consecutiveLosses: 0,
            lastTradeTime: null,
          }
        });
      },
      
      checkDailyLimits: (currentDayR, tradesCount) => {
        const { settings } = get();
        
        if (settings.dailyLossLimitEnabled && currentDayR <= -settings.dailyLossLimitR) {
          return {
            id: `daily_loss_${Date.now()}`,
            type: 'daily_loss' as const,
            message: `Tages-Limit erreicht! Verlust: ${currentDayR.toFixed(1)}R (Limit: -${settings.dailyLossLimitR}R)`,
            severity: 'danger' as const,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          };
        }
        
        if (tradesCount >= settings.dailyTradeLimit) {
          return {
            id: `trade_limit_${Date.now()}`,
            type: 'trade_limit' as const,
            message: `Trade-Limit erreicht! ${tradesCount} von ${settings.dailyTradeLimit} Trades`,
            severity: 'warning' as const,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          };
        }
        
        return null;
      },
      
      checkDrawdown: (currentBalance, peakBalance) => {
        const { settings } = get();
        
        if (!settings.drawdownAlertEnabled) return null;
        
        const drawdownPercent = ((peakBalance - currentBalance) / peakBalance) * 100;
        
        if (drawdownPercent >= settings.drawdownAlertThreshold) {
          return {
            id: `drawdown_${Date.now()}`,
            type: 'drawdown' as const,
            message: `Drawdown Alert! ${drawdownPercent.toFixed(1)}% unter Peak (Threshold: ${settings.drawdownAlertThreshold}%)`,
            severity: 'danger' as const,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          };
        }
        
        return null;
      },
      
      checkConsecutiveLosses: (losses) => {
        const { settings } = get();
        
        if (!settings.consecutiveLossAlertEnabled) return null;
        
        if (losses >= settings.consecutiveLossLimit) {
          return {
            id: `consecutive_loss_${Date.now()}`,
            type: 'consecutive_loss' as const,
            message: `${losses} Verluste in Folge! Mache eine Pause.`,
            severity: 'warning' as const,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          };
        }
        
        return null;
      },
    }),
    {
      name: 'trading-journal-risk',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
