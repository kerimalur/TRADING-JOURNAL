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

import { useState, useEffect, useCallback, useRef } from 'react';
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
  StopCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/stores/uiStore';
import { PAIR_LIST, SETUP_DEFINITIONS } from '@/types';
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
  timestamp: number;
  screenshot?: string;
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
}

interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  profitFactor: number;
}

const STORAGE_KEY = 'backtestSessions';

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
    screenshot: '' as string,
  });

  const pairInputRef = useRef<HTMLSelectElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) {
        console.error('Error loading backtest sessions:', e);
      }
    }
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

  const handleKeyboardShortcut = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch(e.key.toLowerCase()) {
      case 'l': setFormData(prev => ({ ...prev, direction: 'long' })); break;
      case 's': setFormData(prev => ({ ...prev, direction: 'short' })); break;
      case 'w': setFormData(prev => ({ ...prev, result: 'win', rMultiple: Math.abs(prev.rMultiple) })); break;
      case 'x': setFormData(prev => ({ ...prev, result: 'loss', rMultiple: -Math.abs(prev.rMultiple) })); break;
      case 'b': setFormData(prev => ({ ...prev, result: 'breakeven', rMultiple: 0 })); break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [handleKeyboardShortcut]);

  const stats: BacktestStats = (() => {
    const trades = currentSession?.trades || [];
    if (trades.length === 0) return { totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalR: 0, avgR: 0, profitFactor: 0 };
    const wins = trades.filter(t => t.result === 'win').length;
    const losses = trades.filter(t => t.result === 'loss').length;
    const totalR = trades.reduce((sum, t) => sum + t.rMultiple, 0);
    const avgR = totalR / trades.length;
    const winRate = (wins / (wins + losses)) * 100 || 0;
    const grossProfit = trades.filter(t => t.rMultiple > 0).reduce((sum, t) => sum + t.rMultiple, 0);
    const grossLoss = Math.abs(trades.filter(t => t.rMultiple < 0).reduce((sum, t) => sum + t.rMultiple, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    return { totalTrades: trades.length, wins, losses, winRate, totalR, avgR, profitFactor };
  })();

  const equityCurve = (() => {
    let equity = 0;
    return (currentSession?.trades || []).map((trade, i) => {
      equity += trade.rMultiple;
      return { trade: i + 1, equity: parseFloat(equity.toFixed(2)) };
    });
  })();

  const handleSubmit = useCallback(() => {
    if (!currentSession || currentSession.isCompleted) return;
    const newTrade: BacktestTrade = {
      id: `bt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pair: formData.pair, direction: formData.direction, result: formData.result,
      rMultiple: formData.rMultiple, date: formData.date, setups: formData.setups,
      timestamp: Date.now(), screenshot: formData.screenshot || undefined,
    };
    const updatedSession: BacktestSession = {
      ...currentSession, trades: [...currentSession.trades, newTrade], updatedAt: Date.now(),
      elapsedMs: currentSession.elapsedMs + (Date.now() - currentSession.updatedAt),
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
    setFormData(prev => ({ ...prev, rMultiple: prev.result === 'win' ? 1 : prev.result === 'loss' ? -1 : 0, screenshot: '' }));
    pairInputRef.current?.focus();
  }, [formData, currentSession, currentSessionId, sessions, saveSessions]);

  const togglePause = () => {
    if (!currentSession) return;
    const now = Date.now();
    const updatedSession: BacktestSession = {
      ...currentSession, isPaused: !currentSession.isPaused,
      elapsedMs: currentSession.isPaused ? currentSession.elapsedMs : currentSession.elapsedMs + (now - currentSession.updatedAt),
      updatedAt: now,
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
  };

  const createNewSession = () => {
    const newSession: BacktestSession = {
      id: `backtest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Backtest ${new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(), updatedAt: Date.now(), trades: [], isPaused: false, elapsedMs: 0,
    };
    saveSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setShowSessionList(false);
    showToast('Neue Backtest-Session erstellt', 'success');
  };

  const deleteSession = (sessionId: string) => {
    const newSessions = sessions.filter(s => s.id !== sessionId);
    saveSessions(newSessions);
    if (currentSessionId === sessionId) setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
    showToast('Session gelöscht', 'info');
  };

  const handleResultChange = (result: 'win' | 'loss' | 'breakeven') => {
    const defaultR = result === 'win' ? 1 : result === 'loss' ? -1 : 0;
    setFormData(prev => ({ ...prev, result, rMultiple: defaultR }));
  };

  const toggleSetup = (setupKey: string) => {
    setFormData(prev => ({
      ...prev,
      setups: prev.setups.includes(setupKey) ? prev.setups.filter(s => s !== setupKey) : [...prev.setups, setupKey]
    }));
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setFormData(prev => ({ ...prev, screenshot: reader.result as string })); };
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
    showToast('Session beendet', 'info');
  };

  const reopenSession = () => {
    if (!currentSession) return;
    const updatedSession: BacktestSession = {
      ...currentSession, isPaused: true, isCompleted: false, updatedAt: Date.now(),
    };
    saveSessions(sessions.map(s => s.id === currentSessionId ? updatedSession : s));
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
                <button onClick={createNewSession} className="w-full btn btn-primary text-sm">+ Neue Session</button>
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

      {!currentSession ? (
        <div className="card text-center py-16">
          <FlaskConical size={64} className="mx-auto text-text-muted/50 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Keine aktive Session</h3>
          <p className="text-text-muted mb-4">Erstelle eine neue Backtest-Session um zu starten.</p>
          <button onClick={createNewSession} className="btn btn-primary">Neue Session erstellen</button>
        </div>
      ) : (
        <>
          {/* Session Header */}
          <div className="card mb-6 bg-gradient-to-r from-pnl-positive/10 to-accent-primary/10 border-l-4 border-pnl-positive">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-pnl-positive">{currentSession.name}</h3>
                <div className="flex gap-4 mt-1 text-sm text-text-muted">
                  <span className="flex items-center gap-1"><Clock size={14} /> {elapsedTime}</span>
                  <span>{currentSession.trades.length} Trades</span>
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
                <button onClick={createNewSession} className="btn btn-secondary"><RotateCcw size={16} /> Neue Session</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Speed Entry Form */}
            <div className="col-span-2 card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Keyboard size={20} className="text-accent-primary" />
                Speed Entry
                <span className="text-xs text-text-muted ml-2">(L=Long, S=Short, W=Win, X=Loss, B=BE)</span>
              </h3>
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
            </div>
          </div>

          {/* Equity Curve */}
          {equityCurve.length > 0 && (
            <div className="card mt-6">
              <h3 className="text-lg font-semibold mb-4">Equity Curve (Session)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="trade" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} labelStyle={{ color: '#999' }} />
                    <Line type="monotone" dataKey="equity" stroke="#FFD700" strokeWidth={2} dot={{ fill: '#FFD700', strokeWidth: 0, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Trades */}
          {currentSession.trades.length > 0 && (
            <div className="card mt-6">
              <h3 className="text-lg font-semibold mb-4">Session Trades ({currentSession.trades.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-text-muted font-medium">#</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Pair</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Direction</th>
                      <th className="text-left py-2 px-3 text-text-muted font-medium">Result</th>
                      <th className="text-right py-2 px-3 text-text-muted font-medium">R</th>
                      <th className="text-center py-2 px-3 text-text-muted font-medium">Bild</th>
                      <th className="text-center py-2 px-3 text-text-muted font-medium">Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentSession.trades].reverse().slice(0, 10).map((trade, i) => (
                      <tr key={trade.id} className="border-b border-border/50 hover:bg-white/[0.03]">
                        <td className="py-2 px-3 text-text-muted">{currentSession.trades.length - i}</td>
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
