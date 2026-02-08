/**
 * ========================================================================
 * Trading Journal - Global Search Component
 * ========================================================================
 * 
 * Globale Suchfunktion für Trades, Outlooks und Watchlist.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, TrendingUp, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useTradeStore } from '@/stores/tradeStore';
import { useOutlookStore } from '@/stores/outlookStore';

interface SearchResult {
  type: 'trade' | 'outlook';
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { trades } = useTradeStore();
  const { outlooks } = useOutlookStore();
  
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search results
  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    
    const q = query.toLowerCase();
    const searchResults: SearchResult[] = [];
    
    // Search Trades
    trades
      .filter(t => 
        t.pair.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.date.includes(q)
      )
      .slice(0, 5)
      .forEach(trade => {
        searchResults.push({
          type: 'trade',
          id: trade.id,
          title: `${trade.pair} - ${trade.direction.toUpperCase()}`,
          subtitle: `${format(new Date(trade.date), 'dd.MM.yyyy')} • ${trade.rMultiple > 0 ? '+' : ''}${trade.rMultiple.toFixed(2)}R`,
          icon: <TrendingUp size={16} className={trade.result === 'win' ? 'text-pnl-positive' : 'text-pnl-negative'} />,
          path: trade.type === 'ek' ? '/ek' : '/funded',
        });
      });
    
    // Search Outlooks
    outlooks
      .filter(o => 
        o.symbol.toLowerCase().includes(q) ||
        o.thesis.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach(outlook => {
        searchResults.push({
          type: 'outlook',
          id: outlook.id,
          title: `${outlook.symbol} - ${outlook.direction.toUpperCase()}`,
          subtitle: outlook.thesis.substring(0, 50) + (outlook.thesis.length > 50 ? '...' : ''),
          icon: <Target size={16} className="text-accent-primary" />,
          path: '/outlook',
        });
      });
    
    return searchResults;
  }, [query, trades, outlooks]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [results, selectedIndex, onClose]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-background-surface border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={20} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('common.search') + '...'}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-text-primary text-lg outline-none placeholder:text-text-muted"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-background-surface-hover rounded"
            >
              <X size={16} className="text-text-muted" />
            </button>
          )}
          <kbd className="px-2 py-1 text-xs bg-background-surface-dark rounded border border-border text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-text-muted">
              Keine Ergebnisse für "{query}"
            </div>
          )}
          
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                index === selectedIndex
                  ? 'bg-accent-primary/10'
                  : 'hover:bg-background-surface-hover'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-background-surface-dark flex items-center justify-center flex-shrink-0">
                {result.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate">
                  {result.title}
                </div>
                <div className="text-sm text-text-muted truncate">
                  {result.subtitle}
                </div>
              </div>
              <span className={clsx(
                'px-2 py-0.5 text-xs rounded',
                result.type === 'trade' && 'bg-pnl-positive/20 text-pnl-positive',
                result.type === 'outlook' && 'bg-accent-primary/20 text-accent-primary',
                result.type === 'watchlist' && 'bg-accent-gold/20 text-accent-gold'
              )}>
                {result.type === 'trade' ? 'Trade' : result.type === 'outlook' ? 'Outlook' : 'Watchlist'}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background-surface-dark rounded border border-border">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-background-surface-dark rounded border border-border">↓</kbd>
              Navigation
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background-surface-dark rounded border border-border">↵</kbd>
              Auswählen
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GlobalSearch;
