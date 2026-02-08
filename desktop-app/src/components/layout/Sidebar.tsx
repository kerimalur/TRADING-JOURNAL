/**
 * ========================================================================
 * Trading Journal - Sidebar Component
 * ========================================================================
 */

import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  Globe2, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Calendar,
  Activity,
  Database,
  Brain,
  Newspaper,
  Lightbulb,
  Shield,
  Target,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  group?: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, group: 'Übersicht' },
  { path: '/equity', label: 'Equity Curve', icon: <TrendingUp size={18} />, group: 'Übersicht' },
  { path: '/calendar', label: 'Kalender', icon: <Calendar size={18} />, group: 'Übersicht' },
  { path: '/funded', label: 'Funded', icon: <DollarSign size={18} />, group: 'Trading' },
  { path: '/ek', label: 'Eigenkapital', icon: <Wallet size={18} />, group: 'Trading' },
  { path: '/backtest', label: 'Backtest', icon: <Zap size={18} />, group: 'Trading' },
  { path: '/currency', label: 'Währungen', icon: <Globe2 size={18} />, group: 'Markt' },
  { path: '/cot', label: 'COT Daten', icon: <Database size={18} />, group: 'Markt' },
  { path: '/news', label: 'News', icon: <Newspaper size={18} />, group: 'Markt' },
  { path: '/outlook', label: 'Outlook', icon: <Target size={18} />, group: 'Markt' },
  { path: '/simulation', label: 'Simulation', icon: <Activity size={18} />, group: 'Tools' },
  { path: '/strategy', label: 'Strategie', icon: <Lightbulb size={18} />, group: 'Tools' },
  { path: '/ml', label: 'ML Bereich', icon: <Brain size={18} />, group: 'Tools' },
  { path: '/risk', label: 'Risk Management', icon: <Shield size={18} />, group: 'Tools' },
  { path: '/settings', label: 'Einstellungen', icon: <Settings size={18} />, group: 'System' },
];

// Group nav items
const groupedItems = navItems.reduce((acc, item) => {
  const group = item.group || 'Other';
  if (!acc[group]) acc[group] = [];
  acc[group].push(item);
  return acc;
}, {} as Record<string, NavItem[]>);

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside 
      className={clsx(
        'flex flex-col transition-all duration-200',
        'bg-background-surface-solid border-r border-border',
        sidebarCollapsed ? 'w-[64px]' : 'w-[220px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-primary flex items-center justify-center">
              <span className="text-white font-bold text-xs">TJ</span>
            </div>
            <span className="font-semibold text-sm text-text-primary">Trading Journal</span>
          </div>
        )}
        
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
            {!sidebarCollapsed && (
              <div className="px-4 mb-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {group}
              </div>
            )}
            
            <div className="space-y-0.5 px-2">
              {items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-150',
                    isActive 
                      ? 'bg-accent-primary/15 text-accent-primary' 
                      : 'text-text-subtle hover:text-text-primary hover:bg-background-surface-hover',
                    sidebarCollapsed && 'justify-center px-0'
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {item.icon}
                  {!sidebarCollapsed && (
                    <span className="text-sm">{item.label}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        {!sidebarCollapsed ? (
          <div className="text-center text-xs text-text-muted">
            v1.3.0
          </div>
        ) : (
          <div className="text-center text-[10px] text-text-muted">
            1.3
          </div>
        )}
      </div>
    </aside>
  );
}
