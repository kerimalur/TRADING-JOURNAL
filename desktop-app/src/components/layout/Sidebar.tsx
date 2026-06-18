/**
 * ========================================================================
 * Trading Journal - Sidebar Component (Enhanced with Animations)
 * ========================================================================
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  DollarSign,
  TrendingUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Calendar,
  Lightbulb,
  Crosshair,
  Brain,
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/stores/uiStore';
import { useAccountStore } from '@/stores/accountStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  group?: string;
  accountId?: string; // für Multi-Funded-Switcher
}

// Statische Items ohne Funded (wird dynamisch eingefügt)
const BASE_ITEMS: NavItem[] = [
  { path: '/dashboard',   label: 'Dashboard',     icon: <LayoutDashboard size={18} />, group: 'Übersicht' },
  { path: '/equity',      label: 'Equity Curve',  icon: <TrendingUp size={18} />,      group: 'Übersicht' },
  { path: '/calendar',    label: 'Kalender',       icon: <Calendar size={18} />,        group: 'Übersicht' },
  { path: '/ek',          label: 'Eigenkapital',   icon: <Wallet size={18} />,          group: 'Trading'   },
  { path: '/outlook',     label: 'Outlook',         icon: <Crosshair size={18} />,       group: 'Trading'   },
  { path: '/cot',         label: 'Smart COT',      icon: <Brain size={18} />,           group: 'Markt'     },
  { path: '/strategy',    label: 'Strategie',      icon: <Lightbulb size={18} />,       group: 'Tools'     },
  { path: '/backtest',    label: 'Backtest',       icon: <Zap size={18} />,             group: 'Tools'     },
  { path: '/settings',    label: 'Einstellungen',  icon: <Settings size={18} />,        group: 'System'    },
];

const GROUP_ORDER = ['Übersicht', 'Trading', 'Markt', 'Tools', 'System'];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { configs, setActiveAccount } = useAccountStore();
  const location = useLocation();

  // Funded-Accounts dynamisch als Nav-Items einbauen
  const fundedAccounts = configs?.fundedAccounts ?? [];
  const fundedItems: NavItem[] = fundedAccounts.length > 0
    ? fundedAccounts.map(acc => ({
        path: '/funded',
        label: acc.broker
          ? `Funded ${acc.broker}`
          : acc.name ?? 'Funded',
        icon: <DollarSign size={18} />,
        group: 'Trading',
        accountId: acc.id,
      }))
    : [{ path: '/funded', label: 'Funded', icon: <DollarSign size={18} />, group: 'Trading' }];

  // Alle Items zusammenführen: Trading-Reihenfolge EK → Funded
  const tradingEk  = BASE_ITEMS.filter(i => i.group === 'Trading' && i.path === '/ek');
  const nonTrading = BASE_ITEMS.filter(i => i.group !== 'Trading');
  const allItems = [...nonTrading, ...tradingEk, ...fundedItems];
  const groupedItems = GROUP_ORDER.reduce((acc, group) => {
    acc[group] = allItems.filter(i => i.group === group);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 220 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col bg-background-surface-solid border-r border-border overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-glow-sm"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}
              >
                <span className="text-white font-bold text-xs">TJ</span>
              </div>
              <span className="font-semibold text-sm text-text-primary whitespace-nowrap">Trading Journal</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={toggleSidebar}
          className={clsx(
            'p-1.5 rounded-lg text-text-muted',
            'hover:text-text-primary hover:bg-background-surface-hover',
            'transition-colors duration-200',
            sidebarCollapsed && 'mx-auto'
          )}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group} className="mb-4">
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="px-4 mb-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider"
                >
                  {group}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-0.5 px-2">
              {items.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.accountId ?? item.path + item.label}
                    to={item.path}
                    onClick={() => {
                      if (item.accountId) setActiveAccount('funded', item.accountId);
                    }}
                    className={clsx(
                      'relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150',
                      isActive
                        ? 'text-accent-primary'
                        : 'text-text-subtle hover:text-text-primary hover:bg-background-surface-hover',
                      sidebarCollapsed && 'justify-center px-0'
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {/* Active indicator line */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, #8B5CF6, #06B6D4)' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}

                    {/* Active background */}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-bg"
                        className="absolute inset-0 bg-accent-primary/10 rounded-lg"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}

                    <span className="relative z-10">{item.icon}</span>
                    <AnimatePresence mode="wait">
                      {!sidebarCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="relative z-10 text-sm whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed ? (
            <motion.div
              key="full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-text-muted"
            >
              v1.4.0
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-[10px] text-text-muted"
            >
              1.4
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
