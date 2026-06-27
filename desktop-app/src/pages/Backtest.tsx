/**
 * ========================================================================
 * Trading Journal - Backtest Page
 * ========================================================================
 *
 * High-Speed Backtesting Interface mit:
 * - Speed-optimiertes Eingabe-Formular
 * - Tastaturkürzel (L/S für Long/Short, Enter für Submit)
 * - Live-Statistiken (Winrate, R-Total, Equity Curve)
 * - Persistente Sessions (NICHT im EK Journal!)
 */

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import {
  FlaskConical,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Clock,
  Save,
  Keyboard,
  FolderOpen,
  Trash2,
  ChevronDown,
  X,
  Image,
  StopCircle,
  Download,
  BarChart3,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';
import { PAIR_LIST, SETUP_DEFINITIONS, getProblems, saveProblems } from '@/types';
import { loadBacktests, saveBacktest, removeBacktest, isLoggedIn } from '@/services/backtestService';
import { loadPref, savePref } from '@/services/preferencesService';
import { loadStrategies, type StrategyRecord } from '@/services/strategyService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface BacktestTrade {
  id: string;
  pair: string;
  direction: 'long' | 'short';
  result: 'win' | 'loss' | 'breakeven';
  rMultiple: number;
  date: string;
  setups: string[];
  problems: string[];
  timestamp: number;
  screenshot?: string;
  notes?: string;
}

interface BacktestSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  trades: BacktestTrade[];
  isPaused: boolean;
  elapsedMs: number;
  isCompleted?: boolean;
  // Session-Konfiguration (beim Erstellen abgefragt)
  pair?: string;
  strategyId?: string;      // Verknüpfung zur StrategyBuilder-Strategie
  strategy?: string;        // Name aus den eigenen Strategien, oder leer = "keine"
  defaultRR?: number;       // Standard Risk-Reward (z.B. 2 = 1:2)
  riskPercent?: number;     // Risiko pro Trade in %
  accountSize?: number;     // Account-Größe (Kontowährung)
}

interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  profitFactor: number;
  // €-Modell (nur wenn Account-Größe + Risiko% in der Session gesetzt)
  hasEur: boolean;
  eurRisk: number;     // €-Risiko pro Trade (fix = % der Start-Account-Größe)
  totalEur: number;    // Summe €-P&L
  accountEnd: number;  // Account-Größe + Summe €-P&L
  growthPct: number;   // Kontowachstum in %
}

const STORAGE_KEY = 'backtestSessions';

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Verkleinert ein Bild (DataURL) auf max. maxPx Kantenlänge und re-encodet als
 * JPEG. Hält localStorage klein (TradingView-Screenshots sind sonst MB-groß).
 * `window.Image` explizit, um Kollision mit dem lucide-Icon `Image` zu vermeiden.
 */
function downscaleImage(src: string, maxPx = 900, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(src); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(canvas.toDataURL('image/jpeg', quality)); }
      catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export function Backtest() {
  const { showToast } = useUIStore();

  const [sessions, setSessions] = useState<BacktestSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');

  const [formData, setFormData] = useState({
    pair: 'EURUSD',
    direction: 'long' as 'long' | 'short',
    result: 'win' as 'win' | 'loss' | 'breakeven',
    rMultiple: 1,
    date: new Date().toISOString().split('T')[0],
    setups: [] as string[],
    problems: [] as string[],
    screenshot: '' as string,
    notes: '' as string,
  });

  // Wiederverwendbare Problem-Tags (user-verwaltbar über Settings, hier nur lesen + inline ergänzen)
  const [problemOptions, setProblemOptions] = useState<string[]>(() => getProblems());
  const [newProblem, setNewProblem] = useState('');

  // Session-Erstellungs-Wizard: fragt Pair, Strategie, RR, Risiko, Account ab
  const [showWizard, setShowWizard] = useState(false);
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [wizardData, setWizardData] = useState({
    pair: 'EURUSD',
    strategyId: '',        // '' = keine
    defaultRR: 2,
    riskPercent: 1,
    accountSize: 10000,
  });

  // Strategien (eigene) für die Auswahl im Wizard laden
  useEffect(() => {
    loadStrategies().then(setStrategies).catch(() => { /* nicht eingeloggt / offline */ });
  }, []);

  const pairInputRef = useRef<HTMLSelectElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // Hybrid-Load: eingeloggt → Supabase (Quelle der Wahrheit), sonst localStorage.
  // Backend leer + lokale Sessions vorhanden → einmalige Migration nach Supabase.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let localSessions: BacktestSession[] = [];
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try { localSessions = JSON.parse(stored); } catch { /* ignore */ }
      }

      let loggedIn = false;
      try { loggedIn = await isLoggedIn(); } catch { /* offline */ }

      if (loggedIn) {
        try {
          const remote = await loadBacktests();
          if (cancelled) return;
          if (remote.length > 0) {
            setSessions(remote);
            setCurrentSessionId(remote[0].id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
            return;
          }
          if (localSessions.length > 0) {
            // Einmalige Migration: lokale Sessions hochschieben (Alt-IDs → UUID).
            const migrated = localSessions.map(s => ({ ...s, id: isUuid(s.id) ? s.id : newId() }));
            setSessions(migrated);
            setCurrentSessionId(migrated[0].id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            for (const s of migrated) {
              try { await saveBacktest(s); } catch (e) { console.error('Migration einer Session fehlgeschlagen:', e); }
            }
            return;
          }
        } catch (e) {
          console.error('Backend-Load fehlgeschlagen, nutze lokal:', e);
        }
      }

      // Offline / nicht eingeloggt → localStorage
      if (cancelled) return;
      setSessions(localSessions);
      if (localSessions.length > 0) setCurrentSessionId(localSessions[0].id);
    })();
    return () => { cancelled = true; };
  }, []);

  // Problem-Liste aus dem Backend hydrieren (überschreibt localStorage-Mirror).
  useEffect(() => {
    (async () => {
      try {
        const remote = await loadPref<string[]>('problems', []);
        if (Array.isArray(remote) && remote.length > 0) {
          setProblemOptions(remote);
          saveProblems(remote);
        }
      } catch { /* nicht kritisch */ }
    })();
  }, []);

  // Fire-and-forget Sync einer Session ins Backend (Hybrid; no-op wenn nicht eingeloggt).
  const persist = useCallback((session: BacktestSession) => {
    saveBacktest(session).catch(e => console.error('Backtest-Sync fehlgeschlagen:', e));
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const saveSessions = useCallback((newSessions: BacktestSession[]) => {
    setSessions(newSessions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentSession && !currentSession.isPaused) {
        const total = currentSession.elapsedMs + (Date.now() - currentSession.updatedAt);
        const minutes = Math.floor(total / 60000);
        const seconds = Math.floor((total % 60000) / 1000);
        setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentSession]);

  useEffect(() => {
    if (currentSession) {
      const total = currentSession.elapsedMs;
      const minutes = Math.floor(total / 60000);
      const seconds = Math.floor((total % 60000) / 1000);
      setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    } else {
      setElapsedTime('00:00');
    }
  }, [currentSessionId, currentSession?.elapsedMs]);

  // Beim Session-Wechsel das Pair der Session in die Eingabe übernehmen
  useEffect(() => {
    if (currentSession?.pair) setFormData(prev => ({ ...prev, pair: currentSession.pair! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]);

  const handleKeyboardShortcut = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Vorzeichen aus dem aktuellen Ergebnis: Win=+, Loss=−, BE=0
    const signFor = (r: 'win' | 'loss' | 'breakeven') => (r === 'win' ? 1 : r === 'loss' ? -1 : 0);
    // Ziffern 1–9 → R-Betrag direkt setzen (Vorzeichen aus Ergebnis)
    if (/^[1-9]$/.test(e.key)) {
      const mag = parseInt(e.key, 10);
      setFormData(prev => ({ ...prev, rMultiple: mag * (signFor(prev.result) || 1) }));
      return;
    }
    if (e.key === '+' || e.key === '=') {
      setFormData(prev => ({ ...prev, rMultiple: Math.round((prev.rMultiple + 0.5) * 10) / 10 }));
      return;
    }
    if (e.key === '-') {
      setFormData(prev => ({ ...prev, rMultiple: Math.round((prev.rMultiple - 0.5) * 10) / 10 }));
      return;
    }
    switch(e.key.toLowerCase()) {
      case 'l': setFormData(prev => ({ ...prev, direction: 'long' })); break;
      case 's': setFormData(prev => ({ ...prev, direction: 'short' })); break;
      case 'w': setFormData(prev => ({ ...prev, result: 'win', rMultiple: Math.abs(prev.rMultiple) || 1 })); break;
      case 'x': setFormData(prev => ({ ...prev, result: 'loss', rMultiple: -(Math.abs(prev.rMultiple) || 1) })); break;
      case 'b': setFormData(prev => ({ ...prev, result: 'breakeven', rMultiple: 0 })); break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [handleKeyboardShortcut]);

  // €-Risiko pro Trade: fix = Risiko% der START-Account-Größe (kein Compounding).
  // Ehrlich + einfach: macht Expectancy in € sichtbar, ohne Schein-Genauigkeit.
  const acctSize = currentSession?.accountSize || 0;
  const riskPct = currentSession?.riskPercent || 0;
  const eurRisk = acctSize > 0 && riskPct > 0 ? (acctSize * riskPct) / 100 : 0;

  const stats: BacktestStats = (() => {
    const trades = currentSession?.trades || [];
    const base = { hasEur: eurRisk > 0, eurRisk, totalEur: 0, accountEnd: acctSize, growthPct: 0 };
    if (trades.length === 0) return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalR: 0, avgR: 0, profitFactor: 0, ...base };
    const wins = trades.filter(t => t.result === 'win').length;
    const losses = trades.filter(t => t.result === 'loss').length;
    const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
    const avgR = totalR / trades.length;
    const winRate = (wins / (wins + losses)) * 100 || 0;
    const grossProfit = trades.filter(t => t.rMultiple > 0).reduce((sum, t) => sum + t.rMultiple, 0);
    const grossLoss = Math.abs(trades.filter(t => t.rMultiple < 0).reduce((sum, t) => sum + t.rMultiple, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const totalEur = eurRisk * totalR;
    const accountEnd = acctSize + totalEur;
    const growthPct = acctSize > 0 ? (totalEur / acctSize) * 100 : 0;
    return { totalTrades: trades.length, wins, losses, winRate, totalR, avgR, profitFactor, hasEur: eurRisk > 0, eurRisk, totalEur, accountEnd, growthPct };
  })();

  const equityCurve = (() => {
    let r = 0;
    return (currentSession?.trades || []).map((trade, i) => {
      r += trade.rMultiple;
      const equity = stats.hasEur ? parseFloat((acctSize + r * eurRisk).toFixed(2)) : parseFloat(r.toFixed(2));
      return { trade: i + 1, equity };
    });
  })();

  // Performance pro Setup: Winrate, Expectancy (ΣR/n), ΣR, Stichprobe n.
  // Ein Trade mit mehreren Setups zählt bei jedem Setup. BE zählt nicht als Win/Loss.
  const MIN_SAMPLE = 20;
  const setupStats = (() => {
    const trades = currentSession?.trades || [];
    const agg: Record<string, { n: number; wins: number; losses: number; totalR: number }> = {};
    for (const t of trades) {
      for (const key of (t.setups.length ? t.setups : ['(ohne Setup)'])) {
        if (!agg[key]) agg[key] = { n: 0, wins: 0, losses: 0, totalR: 0 };
        agg[key].n++;
        agg[key].totalR += t.rMultiple;
        if (t.result === 'win') agg[key].wins++;
        else if (t.result === 'loss') agg[key].losses++;
      }
    }
    return Object.entries(agg).map(([key, v]) => {
      const def = (SETUP_DEFINITIONS as any)[key];
      const decided = v.wins + v.losses;
      return {
        key,
        label: def?.short || def?.label || key,
        color: def?.color as string | undefined,
        n: v.n,
        winRate: decided > 0 ? (v.wins / decided) * 100 : 0,
        totalR: v.totalR,
        expectancy: v.n > 0 ? v.totalR / v.n : 0,
        reliable: v.n >= MIN_SAMPLE,
      };
    }).sort((a, b) => b.expectancy - a.expectancy);
  })();

  const exportSessionJSON = () => {
    if (!currentSession) return;
    const blob = new Blob([JSON.stringify(currentSession, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSession.name.replace(/[^\w-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Session als JSON exportiert', 'success');
  };

  // CSV-Export der Trade-Tabelle (öffnet direkt in Excel). Keine externe Library.
  const exportSessionCSV = () => {
    if (!currentSession || currentSession.trades.length === 0) return;
    const esc = (v: string | number) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const labelOf = (key: string) => (SETUP_DEFINITIONS as any)[key]?.label || key;
    const header = ['#', 'Datum', 'Pair', 'Richtung', 'Ergebnis', 'R-Multiple', 'Setups', 'Problem', 'Notizen'];
    const rows = currentSession.trades.map((t, i) => [
      i + 1,
      t.date,
      t.pair,
      t.direction === 'long' ? 'Long' : 'Short',
      t.result === 'win' ? 'Win' : t.result === 'loss' ? 'Loss' : 'Breakeven',
      t.rMultiple,
      (t.setups || []).map(labelOf).join('; '),
      (t.problems || []).join('; '),
      t.notes || '',
    ].map(esc).join(';'));
    // BOM für korrekte Umlaute in Excel
    const csv = '﻿' + [header.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSession.name.replace(/[^\w-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Session als CSV exportiert', 'success');
  };

  const handleSubmit = useCallback(() => {
    if (!currentSession || currentSession.isCompleted) return;
    const newTrade: BacktestTrade = {
      id: `bt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pair: formData.pair, direction: formData.direction, result: formData.result,
      rMultiple: formData.rMultiple, date: formData.date, setups: formData.setups,
      problems: formData.problems,
      timestamp: Date.now(), screenshot: formData.screenshot || undefined,
      notes: formData.notes || undefined,
    };
    const updatedSession: BacktestSession = {
      ...currentSession, trades: [...currentSession.trades, newTrade], updatedAt: Date.now(),
      elapsedMs: currentSession.elapsedMs + (Date.now() - currentSession.updatedAt),
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
    persist(updatedSession);
    setFormData(prev => ({ ...prev, rMultiple: prev.result === 'win' ? (currentSession?.defaultRR || 1) : prev.result === 'loss' ? -1 : 0, problems: [], screenshot: '', notes: '' }));
    pairInputRef.current?.focus();
  }, [formData, currentSession, currentSessionId, sessions, saveSessions, persist]);

  // Enter speichert (außer im Notizen-Feld → dort Zeilenumbruch via Shift+Enter)
  useEffect(() => {
    const onEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      handleSubmit();
    };
    window.addEventListener('keydown', onEnter);
    return () => window.removeEventListener('keydown', onEnter);
  }, [handleSubmit]);

  // Strg+V: Screenshot aus Zwischenablage direkt einfügen (TradingView-Workflow)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onloadend = async () => {
            const small = await downscaleImage(reader.result as string);
            setFormData(prev => ({ ...prev, screenshot: small }));
            showToast('Screenshot aus Zwischenablage übernommen', 'success');
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [showToast]);

  const togglePause = () => {
    if (!currentSession) return;
    const now = Date.now();
    const updatedSession: BacktestSession = {
      ...currentSession, isPaused: !currentSession.isPaused,
      elapsedMs: currentSession.isPaused ? currentSession.elapsedMs : currentSession.elapsedMs + (now - currentSession.updatedAt),
      updatedAt: now,
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
    persist(updatedSession);
  };

  // Öffnet den Wizard (statt direkt eine Session zu erstellen)
  const openWizard = () => {
    setShowSessionList(false);
    setWizardData({ pair: 'EURUSD', strategyId: '', defaultRR: 2, riskPercent: 1, accountSize: 10000 });
    setShowWizard(true);
  };

  // Erstellt die Session aus den Wizard-Eingaben
  const createSessionFromWizard = () => {
    const cfg = wizardData;
    const stratName = strategies.find(s => s.id === cfg.strategyId)?.name;
    const stratLabel = stratName ? ` · ${stratName}` : '';
    const newSession: BacktestSession = {
      id: newId(),
      name: `${cfg.pair}${stratLabel} · ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}`,
      createdAt: Date.now(), updatedAt: Date.now(), trades: [], isPaused: false, elapsedMs: 0,
      pair: cfg.pair,
      strategyId: cfg.strategyId || undefined,
      strategy: stratName || undefined,
      defaultRR: cfg.defaultRR,
      riskPercent: cfg.riskPercent,
      accountSize: cfg.accountSize,
    };
    saveSessions([newSession, ...sessions]);
    persist(newSession);
    setCurrentSessionId(newSession.id);
    setFormData(prev => ({ ...prev, pair: cfg.pair, rMultiple: cfg.defaultRR }));
    setShowWizard(false);
    showToast('Backtest-Session gestartet', 'success');
  };

  const deleteSession = (sessionId: string) => {
    const newSessions = sessions.filter(s => s.id !== sessionId);
    saveSessions(newSessions);
    removeBacktest(sessionId).catch(e => console.error('Backtest-Löschen (Backend) fehlgeschlagen:', e));
    if (currentSessionId === sessionId) setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
    showToast('Session gelöscht', 'info');
  };

  const handleResultChange = (result: 'win' | 'loss' | 'breakeven') => {
    const rr = currentSession?.defaultRR || 1;
    const defaultR = result === 'win' ? rr : result === 'loss' ? -1 : 0;
    setFormData(prev => ({ ...prev, result, rMultiple: defaultR }));
  };

  const toggleSetup = (setupKey: string) => {
    setFormData(prev => ({
      ...prev,
      setups: prev.setups.includes(setupKey) ? prev.setups.filter(s => s !== setupKey) : [...prev.setups, setupKey]
    }));
  };

  const toggleProblem = (problem: string) => {
    setFormData(prev => ({
      ...prev,
      problems: prev.problems.includes(problem) ? prev.problems.filter(p => p !== problem) : [...prev.problems, problem]
    }));
  };

  // Neues Problem-Tag: in die gespeicherte Liste aufnehmen (für künftige Trades)
  // UND direkt am aktuellen Trade aktivieren.
  const addNewProblem = () => {
    const val = newProblem.trim();
    if (!val) return;
    if (!problemOptions.includes(val)) {
      const updated = [...problemOptions, val];
      setProblemOptions(updated);
      saveProblems(updated);
      savePref('problems', updated).catch(e => console.error('Problem-Sync fehlgeschlagen:', e));
    }
    setFormData(prev => ({
      ...prev,
      problems: prev.problems.includes(val) ? prev.problems : [...prev.problems, val],
    }));
    setNewProblem('');
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const small = await downscaleImage(reader.result as string);
      setFormData(prev => ({ ...prev, screenshot: small }));
    };
    reader.readAsDataURL(file);
  };

  const stopSession = () => {
    if (!currentSession) return;
    const now = Date.now();
    const updatedSession: BacktestSession = {
      ...currentSession, isPaused: true, isCompleted: true,
      elapsedMs: currentSession.elapsedMs + (now - currentSession.updatedAt), updatedAt: now,
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
    persist(updatedSession);
    showToast('Session beendet', 'info');
  };

  const reopenSession = () => {
    if (!currentSession) return;
    const updatedSession: BacktestSession = {
      ...currentSession, isPaused: true, isCompleted: false, updatedAt: Date.now(),
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
    persist(updatedSession);
    showToast('Session wieder geöffnet', 'success');
  };

  const deleteTradeFromSession = (tradeId: string) => {
    if (!currentSession) return;
    const updatedSession: BacktestSession = {
      ...currentSession,
      trades: currentSession.trades.filter(t => t.id !== tradeId),
      updatedAt: Date.now(),
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
    persist(updatedSession);
    showToast('Trade gelöscht', 'info');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <FlaskConical className="text-accent-primary" />
          High-Speed Backtesting
        </h1>
        <div className="relative">
          <button onClick={() => setShowSessionList(!showSessionList)} className="btn-secondary">
            <FolderOpen size={16} />
            {currentSession ? currentSession.name : 'Session wählen'}
            <ChevronDown size={16} />
          </button>
          {showSessionList && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-background-surface border border-border rounded-lg shadow-xl z-50">
              <div className="p-2 border-b border-border">
                <button onClick={openWizard} className="w-full btn btn-primary text-sm">+ Neue Session</button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="p-4 text-center text-text-muted">Keine Sessions vorhanden</div>
                ) : sessions.map(session => (
                  <div key={session.id}
                    className={clsx('flex items-center justify-between p-3 hover:bg-white/[0.03] cursor-pointer', session.id === currentSessionId && 'bg-accent-primary/10')}
                    onClick={() => { setCurrentSessionId(session.id); setShowSessionList(false); }}>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {session.name}
                          {session.isCompleted && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-pnl-positive/20 text-pnl-positive">Abgeschlossen</span>
                          )}
                        </div>
                        <div className="text-xs text-text-muted">{session.trades.length} Trades • {new Date(session.createdAt).toLocaleDateString('de-DE')}</div>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Session wirklich löschen?')) deleteSession(session.id); }}
                      className="p-1 hover:bg-pnl-negative/20 rounded">
                      <Trash2 size={14} className="text-pnl-negative" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session-Erstellungs-Wizard */}
      {showWizard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowWizard(false)}>
          <div className="w-full max-w-md bg-background-surface border border-border rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><FlaskConical size={18} className="text-accent-primary" /> Neue Backtest-Session</h3>
              <button onClick={() => setShowWizard(false)} className="p-1 hover:bg-white/[0.06] rounded"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="input-label">Währungspaar</label>
                <select className="input" value={wizardData.pair} onChange={e => setWizardData(p => ({ ...p, pair: e.target.value }))}>
                  {PAIR_LIST.map(pair => <option key={pair} value={pair}>{pair}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Strategie</label>
                <select className="input" value={wizardData.strategyId} onChange={e => setWizardData(p => ({ ...p, strategyId: e.target.value }))}>
                  <option value="">— keine —</option>
                  {strategies.map(s => <option key={s.id || s.name} value={s.id || ''}>{s.name}</option>)}
                </select>
                {strategies.length === 0 && <p className="text-[11px] text-text-muted mt-1">Keine eigenen Strategien gefunden — im Strategie-Bereich anlegen, oder „keine" wählen.</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="input-label">Standard-RR (1:x)</label>
                  <input type="number" step="0.5" min="0.5" className="input" value={wizardData.defaultRR} onChange={e => setWizardData(p => ({ ...p, defaultRR: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="input-label">Risiko/Trade (%)</label>
                  <input type="number" step="0.1" min="0" className="input" value={wizardData.riskPercent} onChange={e => setWizardData(p => ({ ...p, riskPercent: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="input-label">Account (€)</label>
                  <input type="number" step="100" min="0" className="input" value={wizardData.accountSize} onChange={e => setWizardData(p => ({ ...p, accountSize: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              {wizardData.accountSize > 0 && wizardData.riskPercent > 0 && (
                <p className="text-[11px] text-text-muted">
                  Risiko/Trade = <span className="text-text-secondary font-medium">{((wizardData.accountSize * wizardData.riskPercent) / 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })} €</span>.
                  P&amp;L pro Trade = R-Multiple × dieser Betrag.
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowWizard(false)} className="btn btn-secondary flex-1">Abbrechen</button>
              <button onClick={createSessionFromWizard} disabled={!wizardData.pair} className="btn btn-primary flex-1"><Play size={16} /> Session starten</button>
            </div>
          </div>
        </div>
      )}

      {!currentSession ? (
        <div className="card text-center py-16">
          <FlaskConical size={64} className="mx-auto text-text-muted/50 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Keine aktive Session</h3>
          <p className="text-text-muted mb-4">Erstelle eine neue Backtest-Session um zu starten.</p>
          <button onClick={openWizard} className="btn btn-primary">Neue Session erstellen</button>
        </div>
      ) : (
        <>
          {/* Session Header */}
          <div className="card mb-6 bg-gradient-to-r from-pnl-positive/10 to-accent-primary/10 border-l-4 border-pnl-positive">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-pnl-positive">{currentSession.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-text-muted">
                  <span className="flex items-center gap-1"><Clock size={14} /> {elapsedTime}</span>
                  <span>{currentSession.trades.length} Trades</span>
                  {currentSession.pair && <span className="text-text-secondary font-medium">{currentSession.pair}</span>}
                  {currentSession.strategy && <span className="px-1.5 py-0.5 rounded bg-accent-primary/15 text-accent-primary text-xs">{currentSession.strategy}</span>}
                  {currentSession.defaultRR != null && <span>RR 1:{currentSession.defaultRR}</span>}
                  {currentSession.riskPercent != null && <span>{currentSession.riskPercent}% Risiko</span>}
                  {currentSession.accountSize != null && <span>{currentSession.accountSize.toLocaleString('de-DE')} Konto</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {!currentSession.isCompleted ? (
                  <>
                    <button onClick={togglePause} className={clsx('btn', currentSession.isPaused ? 'btn-primary' : 'btn-secondary')}>
                      {currentSession.isPaused ? <Play size={16} /> : <Pause size={16} />}
                      {currentSession.isPaused ? 'Fortsetzen' : 'Pause'}
                    </button>
                    <button onClick={() => confirm('Session wirklich beenden?') && stopSession()} className="btn btn-secondary text-pnl-negative hover:bg-pnl-negative/20">
                      <StopCircle size={16} /> Beenden
                    </button>
                  </>
                ) : (
                  <>
                    <span className="px-3 py-2 bg-pnl-positive/20 rounded-lg text-pnl-positive text-sm font-medium">✓ Abgeschlossen</span>
                    <button onClick={reopenSession} className="btn btn-secondary text-accent-primary hover:bg-accent-primary/20">
                      <Play size={16} /> Wieder öffnen
                    </button>
                  </>
                )}
                <button onClick={exportSessionJSON} className="btn btn-secondary" title="Session als JSON exportieren">
                  <Download size={16} /> JSON
                </button>
                <button onClick={exportSessionCSV} className="btn btn-secondary" title="Trade-Tabelle als CSV exportieren (öffnet in Excel)">
                  <Download size={16} /> CSV
                </button>
                <button onClick={openWizard} className="btn btn-secondary"><RotateCcw size={16} /> Neue Session</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Speed Entry Form */}
            <div className="col-span-2 card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Keyboard size={20} className="text-accent-primary" />
                  Speed Entry
                  <span className="text-xs text-text-muted ml-2">L/S=Richtung · W/X/B=Ergebnis · 1–9=R · +/− · Enter=Speichern · Strg+V=Bild</span>
                </h3>
                <span className="text-sm font-mono px-2.5 py-1 rounded bg-accent-primary/15 text-accent-primary whitespace-nowrap">
                  Eintrag #{currentSession.trades.length + 1}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="input-label">Währungspaar</label>
                  <select ref={pairInputRef} className="input" value={formData.pair}
                    onChange={(e) => setFormData(prev => ({ ...prev, pair: e.target.value }))}>
                    {PAIR_LIST.map(pair => <option key={pair} value={pair}>{pair}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Richtung</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, direction: 'long' }))}
                      className={clsx('flex-1 py-2 px-3 rounded-lg font-medium transition-all', formData.direction === 'long' ? 'bg-pnl-positive text-white' : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}>
                      <TrendingUp size={16} className="inline mr-1" /> Long
                    </button>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, direction: 'short' }))}
                      className={clsx('flex-1 py-2 px-3 rounded-lg font-medium transition-all', formData.direction === 'short' ? 'bg-pnl-negative text-white' : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}>
                      <TrendingDown size={16} className="inline mr-1" /> Short
                    </button>
                  </div>
                </div>
                <div>
                  <label className="input-label">Ergebnis</label>
                  <div className="flex gap-1">
                    {(['win', 'loss', 'breakeven'] as const).map(result => (
                      <button key={result} type="button" onClick={() => handleResultChange(result)}
                        className={clsx('flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-all',
                          formData.result === result
                            ? result === 'win' ? 'bg-pnl-positive text-white' : result === 'loss' ? 'bg-pnl-negative text-white' : 'bg-text-muted text-white'
                            : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}>
                        {result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'BE'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="input-label">R-Multiple</label>
                  <input type="number" step="0.1" className="input" value={formData.rMultiple}
                    onChange={(e) => setFormData(prev => ({ ...prev, rMultiple: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="input-label">Datum</label>
                  <input type="date" className="input" value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} />
                </div>
                <div className="col-span-3">
                  <label className="input-label">Setups</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SETUP_DEFINITIONS).map(([key, setup]) => (
                      <button key={key} type="button" onClick={() => toggleSetup(key)}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                          formData.setups.includes(key) ? 'text-white' : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}
                        style={{ backgroundColor: formData.setups.includes(key) ? setup.color : undefined }}>
                        {setup.short}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Problem-Tags (Mehrfachauswahl, wiederverwendbar) */}
                <div className="col-span-4">
                  <label className="input-label flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-accent-gold" /> Problem (optional, mehrfach)
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {problemOptions.map(problem => (
                      <button key={problem} type="button" onClick={() => toggleProblem(problem)}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                          formData.problems.includes(problem)
                            ? 'bg-accent-gold text-black'
                            : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}>
                        {problem}
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newProblem}
                        onChange={e => setNewProblem(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewProblem(); } }}
                        placeholder="+ neues Problem"
                        className="input py-1.5 text-sm w-40"
                      />
                      <button type="button" onClick={addNewProblem} disabled={!newProblem.trim()}
                        className="p-1.5 rounded-lg bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 disabled:opacity-40 transition-colors"
                        title="Problem hinzufügen (wird gespeichert)">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 mt-2">
                  <label className="input-label">Screenshot (optional)</label>
                  <div className="flex items-center gap-4">
                    <input ref={screenshotInputRef} type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                    <button type="button" onClick={() => screenshotInputRef.current?.click()} className="btn btn-secondary">
                      <Image size={16} /> Bild hochladen
                    </button>
                    {formData.screenshot && (
                      <div className="flex items-center gap-2">
                        <img src={formData.screenshot} alt="Screenshot Preview" className="h-10 w-16 object-cover rounded border border-border" />
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, screenshot: '' }))} className="p-1 hover:bg-pnl-negative/20 rounded">
                          <X size={14} className="text-pnl-negative" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes / Fehler */}
                <div className="col-span-4 mt-2">
                  <label className="input-label">Notizen / Fehler (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Was lief gut/schlecht? Fehler im Setup? Lessons learned..."
                    className="input min-h-[60px] text-sm"
                    rows={2}
                  />
                </div>
              </div>
              <button onClick={handleSubmit} disabled={currentSession.isCompleted}
                className={clsx('btn btn-primary w-full mt-4', currentSession.isCompleted && 'opacity-50 cursor-not-allowed')}>
                <Save size={16} /> Trade speichern
              </button>
            </div>

            {/* Live Stats */}
            <div className="space-y-4">
              <div className="card bg-gradient-to-br from-accent-gold/10 to-transparent">
                <div className="text-sm text-text-muted mb-1">Win Rate</div>
                <div className="text-3xl font-bold text-accent-primary">{stats.winRate.toFixed(1)}%</div>
                <div className="text-sm text-text-muted">{stats.wins}W / {stats.losses}L</div>
              </div>
              <div className="card">
                <div className="text-sm text-text-muted mb-1">Total R</div>
                <div className={clsx('text-3xl font-bold', stats.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                  {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(1)} R
                </div>
                <div className="text-sm text-text-muted">Ø {stats.avgR.toFixed(2)} R</div>
              </div>
              <div className="card">
                <div className="text-sm text-text-muted mb-1">Profit Factor</div>
                <div className="text-3xl font-bold text-text-primary">
                  {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                </div>
              </div>
              {stats.hasEur && (
                <div className="card bg-gradient-to-br from-pnl-positive/10 to-transparent">
                  <div className="text-sm text-text-muted mb-1">P&L (€)</div>
                  <div className={clsx('text-3xl font-bold', stats.totalEur >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                    {stats.totalEur >= 0 ? '+' : ''}{stats.totalEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                  </div>
                  <div className="text-sm text-text-muted">
                    {stats.growthPct >= 0 ? '+' : ''}{stats.growthPct.toFixed(1)}% · Konto {stats.accountEnd.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
                    <span className="block text-[11px] opacity-70">{stats.eurRisk.toLocaleString('de-DE', { maximumFractionDigits: 0 })} € Risiko/Trade</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Equity Curve */}
          {equityCurve.length > 0 && (
            <div className="card mt-6">
              <h3 className="text-lg font-semibold mb-4">Equity Curve (Session) {stats.hasEur ? '— €' : '— R'}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="trade" stroke="#666" />
                    <YAxis stroke="#666" tickFormatter={(v) => stats.hasEur ? `${(v / 1000).toFixed(1)}k` : `${v}`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} labelStyle={{ color: '#999' }}
                      formatter={(v: number) => [stats.hasEur ? `${v.toLocaleString('de-DE')} €` : `${v} R`, stats.hasEur ? 'Konto' : 'Equity']} />
                    <Line type="monotone" dataKey="equity" stroke="#FFD700" strokeWidth={2} dot={{ fill: '#FFD700', strokeWidth: 0, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Setup-Performance */}
          {setupStats.length > 0 && (
            <div className="card mt-6">
              <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <BarChart3 size={20} className="text-accent-primary" />
                Setup-Performance
              </h3>
              <p className="text-xs text-text-muted mb-4">
                Expectancy = Ø R pro Trade (ΣR ÷ Anzahl). Werte mit weniger als {MIN_SAMPLE} Trades sind statistisch
                unsicher (ausgegraut) — noch zu kleine Stichprobe für eine belastbare Aussage.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Setup</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">Trades (n)</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">Winrate</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">Expectancy</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">ΣR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setupStats.map(s => (
                      <tr key={s.key} className={clsx('border-b border-border/50 hover:bg-white/[0.03]', !s.reliable && 'opacity-50')}>
                        <td className="py-2 px-3 font-medium">
                          <span className="inline-flex items-center gap-2">
                            {s.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />}
                            {s.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {s.n}
                          {!s.reliable && <span className="ml-1 text-[10px] text-accent-gold" title={`Stichprobe < ${MIN_SAMPLE}`}>⚠</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{s.winRate.toFixed(0)}%</td>
                        <td className={clsx('py-2 px-3 text-right font-mono font-semibold', s.expectancy >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {s.expectancy >= 0 ? '+' : ''}{s.expectancy.toFixed(2)}R
                        </td>
                        <td className={clsx('py-2 px-3 text-right font-mono', s.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {s.totalR >= 0 ? '+' : ''}{s.totalR.toFixed(1)}R
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trade-Tabelle (Excel-Stil): alle Felder pro Trade vergleichbar */}
          {currentSession.trades.length > 0 && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Trade-Tabelle ({currentSession.trades.length})</h3>
                <button onClick={exportSessionCSV} className="btn btn-secondary text-sm" title="Als CSV exportieren (öffnet in Excel)">
                  <Download size={14} /> CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-text-muted font-medium">#</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Datum</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Pair</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Richtung</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Ergebnis</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">R</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Setups</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Problem</th>
                      <th className="text-center py-2 px-3 text-text-muted font-medium">Bild</th>
                      <th className="text-center py-2 px-3 text-text-muted font-medium">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentSession.trades].reverse().map((trade, i) => (
                      <Fragment key={trade.id}>
                      <tr className="border-b border-border/50 hover:bg-white/[0.03]">
                        <td className="py-2 px-3 text-text-muted">{currentSession.trades.length - i}</td>
                        <td className="py-2 px-3 font-mono text-xs text-text-muted whitespace-nowrap">{trade.date}</td>
                        <td className="py-2 px-3 font-medium">{trade.pair}</td>
                        <td className="py-2 px-3">
                          <span className={clsx('px-2 py-0.5 rounded text-xs', trade.direction === 'long' ? 'bg-pnl-positive/20 text-pnl-positive' : 'bg-pnl-negative/20 text-pnl-negative')}>
                            {trade.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={clsx('px-2 py-0.5 rounded text-xs',
                            trade.result === 'win' ? 'bg-pnl-positive/20 text-pnl-positive' :
                            trade.result === 'loss' ? 'bg-pnl-negative/20 text-pnl-negative' : 'bg-text-muted/20 text-text-muted')}>
                            {trade.result.toUpperCase()}
                          </span>
                        </td>
                        <td className={clsx('py-2 px-3 text-right font-mono', trade.rMultiple >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                          {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(trade.setups || []).map(key => {
                              const def = (SETUP_DEFINITIONS as any)[key];
                              return (
                                <span key={key} className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                                  style={{ backgroundColor: def?.color || '#666' }}>
                                  {def?.short || key}
                                </span>
                              );
                            })}
                            {(!trade.setups || trade.setups.length === 0) && <span className="text-text-muted/50">—</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(trade.problems || []).map(p => (
                              <span key={p} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-gold/20 text-accent-gold">
                                {p}
                              </span>
                            ))}
                            {(!trade.problems || trade.problems.length === 0) && <span className="text-text-muted/50">—</span>}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {trade.screenshot ? (
                            <img src={trade.screenshot} alt="Screenshot" className="h-8 w-12 object-cover rounded cursor-pointer hover:opacity-80"
                              onClick={() => window.open(trade.screenshot, '_blank')} />
                          ) : <span className="text-text-muted/50">—</span>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => confirm('Trade wirklich löschen?') && deleteTradeFromSession(trade.id)}
                            className="p-1 hover:bg-pnl-negative/20 rounded"
                            title="Trade löschen"
                          >
                            <Trash2 size={14} className="text-pnl-negative" />
                          </button>
                        </td>
                      </tr>
                      {trade.notes && (
                        <tr className="border-b border-border/30">
                          <td colSpan={10} className="px-3 py-1">
                            <span className="text-[10px] text-text-muted italic">📝 {trade.notes}</span>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 p-4 bg-background-surface rounded-lg border border-border text-sm text-text-muted">
        <h4 className="font-semibold text-text-primary mb-2">Über Backtest Sessions</h4>
        <p>
          Backtest-Trades werden <strong>separat</strong> von deinem Live-Journal gespeichert.
          Sie erscheinen nicht im EK- oder Funded-Journal. Du kannst beliebig viele Sessions
          erstellen und jederzeit wieder laden.
        </p>
      </div>
    </div>
  );
}
