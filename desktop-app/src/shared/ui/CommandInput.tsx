/**
 * CommandInput - Terminal-style speed entry for backtesting
 * Format: EURUSD L W 2.3 or GBPJPY S L 1.0
 */

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Terminal, CornerDownLeft } from 'lucide-react';

interface ParsedCommand {
  pair: string;
  direction: 'long' | 'short';
  result: 'win' | 'loss' | 'breakeven';
  rMultiple: number;
  valid: boolean;
  error?: string;
}

interface CommandInputProps {
  onSubmit: (parsed: ParsedCommand) => void;
  placeholder?: string;
  className?: string;
}

function parseCommand(input: string): ParsedCommand {
  const parts = input.trim().toUpperCase().split(/\s+/);
  const invalid: ParsedCommand = { pair: '', direction: 'long', result: 'win', rMultiple: 0, valid: false };

  if (parts.length < 4) {
    return { ...invalid, error: 'Format: EURUSD L W 2.3' };
  }

  const [pair, dir, res, rStr] = parts;

  if (pair.length < 6) {
    return { ...invalid, error: 'Ungültiges Paar' };
  }

  const direction = dir === 'L' ? 'long' : dir === 'S' ? 'short' : null;
  if (!direction) {
    return { ...invalid, error: 'L = Long, S = Short' };
  }

  const result = res === 'W' ? 'win' : res === 'L' ? 'loss' : res === 'B' ? 'breakeven' : null;
  if (!result) {
    return { ...invalid, error: 'W = Win, L = Loss, B = BE' };
  }

  const rMultiple = parseFloat(rStr);
  if (isNaN(rMultiple)) {
    return { ...invalid, error: 'Ungültiges R-Multiple' };
  }

  const finalR = result === 'loss' ? -Math.abs(rMultiple) : result === 'breakeven' ? 0 : Math.abs(rMultiple);

  return { pair, direction, result, rMultiple: finalR, valid: true };
}

export function CommandInput({ onSubmit, placeholder, className }: CommandInputProps) {
  const [value, setValue] = useState('');
  const [preview, setPreview] = useState<ParsedCommand | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.trim()) {
      setPreview(parseCommand(value));
    } else {
      setPreview(null);
    }
  }, [value]);

  const handleSubmit = () => {
    const parsed = parseCommand(value);
    if (parsed.valid) {
      onSubmit(parsed);
      setHistory(prev => [value, ...prev].slice(0, 20));
      setValue('');
      setHistoryIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setValue(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setValue('');
      }
    }
  };

  return (
    <div className={clsx('rounded-xl bg-background-surface border border-border overflow-hidden', className)}>
      {/* Input row */}
      <div className="flex items-center px-4 py-3">
        <Terminal size={16} className="text-accent-primary mr-3 flex-shrink-0" />
        <span className="text-accent-primary font-mono text-sm mr-2">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'EURUSD L W 2.3'}
          className="flex-1 bg-transparent text-text-primary font-mono text-sm outline-none placeholder-text-muted/40"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={handleSubmit}
          disabled={!preview?.valid}
          className={clsx(
            'ml-2 p-1.5 rounded-md transition-colors',
            preview?.valid
              ? 'text-accent-primary hover:bg-accent-primary/10'
              : 'text-text-muted/30'
          )}
        >
          <CornerDownLeft size={14} />
        </button>
      </div>

      {/* Preview bar */}
      {preview && value.trim() && (
        <div className={clsx(
          'px-4 py-2 border-t border-border/50 flex items-center gap-3 text-xs font-mono',
          preview.valid ? 'bg-background-surface/50' : 'bg-pnl-negative/5'
        )}>
          {preview.valid ? (
            <>
              <span className="text-text-secondary font-semibold">{preview.pair}</span>
              <span className={preview.direction === 'long' ? 'text-pnl-positive' : 'text-pnl-negative'}>
                {preview.direction.toUpperCase()}
              </span>
              <span className={clsx(
                preview.result === 'win' ? 'text-pnl-positive' : preview.result === 'loss' ? 'text-pnl-negative' : 'text-text-muted'
              )}>
                {preview.rMultiple > 0 ? '+' : ''}{preview.rMultiple.toFixed(1)}R
              </span>
              <span className="text-text-muted ml-auto">Enter zum Einfügen</span>
            </>
          ) : (
            <span className="text-pnl-negative/70">{preview.error}</span>
          )}
        </div>
      )}
    </div>
  );
}
