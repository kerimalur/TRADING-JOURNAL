/**
 * Backtest – Fokus-Raum (Vollbild). „Verschlossener Raum": deckt Sidebar +
 * App-Header zu (fixed inset-0). Nur Speed-Eingabe + minimale Live-Stats.
 * Verlassen über „Speichern & Schließen" oder „Beenden" → zurück zur Übersicht.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Keyboard, TrendingUp, TrendingDown, Save, Image as ImageIcon, X, Plus,
  AlertTriangle, Clock, Pause, Play, StopCircle, DoorOpen, Star,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useUIStore } from '@/shared/stores/uiStore';
import {
  PAIR_LIST, SETUP_DEFINITIONS,
  getProblems, saveProblems, getNoteSnippets, saveNoteSnippets,
} from '@/shared/types';
import { loadPref, savePref } from '@/shared/services/preferencesService';
import { computeStats } from './backtestStats';
import { downscaleImage } from './types';
import type { BacktestSession, BacktestTrade } from './types';

interface Props {
  session: BacktestSession;
  onAddTrade: (trade: BacktestTrade) => void;
  onTogglePause: () => void;
  onClose: () => void;   // Speichern & Schließen (Session bleibt offen)
  onFinish: () => void;  // Beenden (Session abschließen)
}

const today = () => new Date().toISOString().split('T')[0];

export function BacktestRoom({ session, onAddTrade, onTogglePause, onClose, onFinish }: Props) {
  const { showToast } = useUIStore();

  // Startdatum: letztes Trade-Datum → sonst Session-Startdatum → sonst heute.
  // Bleibt nach Speichern stehen (springt nie auf heute).
  const initialDate =
    session.trades.length > 0 ? session.trades[session.trades.length - 1].date
    : session.startDate || today();

  const [formData, setFormData] = useState({
    pair: session.pair || 'EURUSD',
    direction: 'long' as 'long' | 'short',
    result: 'win' as 'win' | 'loss' | 'breakeven',
    rMultiple: session.defaultRR || 1,
    date: initialDate,
    setups: [] as string[],
    problems: [] as string[],
    screenshot: '' as string,
    notes: '' as string,
  });

  const [problemOptions, setProblemOptions] = useState<string[]>(() => getProblems());
  const [newProblem, setNewProblem] = useState('');
  const [noteSnippets, setNoteSnippets] = useState<string[]>(() => getNoteSnippets());
  const [elapsed, setElapsed] = useState('00:00');

  const pairRef = useRef<HTMLSelectElement>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);

  // Wiederverwendbare Listen aus dem Backend hydrieren (überschreibt localStorage-Mirror).
  useEffect(() => {
    (async () => {
      try {
        const p = await loadPref<string[]>('problems', []);
        if (Array.isArray(p) && p.length > 0) { setProblemOptions(p); saveProblems(p); }
      } catch { /* nicht kritisch */ }
      try {
        const n = await loadPref<string[]>('noteSnippets', []);
        if (Array.isArray(n) && n.length > 0) { setNoteSnippets(n); saveNoteSnippets(n); }
      } catch { /* nicht kritisch */ }
    })();
  }, []);

  const stats = computeStats(session.trades, session.accountSize, session.riskPercent);
  const completed = !!session.isCompleted;

  // Timer
  useEffect(() => {
    const tick = () => {
      const total = session.isPaused ? session.elapsedMs : session.elapsedMs + (Date.now() - session.updatedAt);
      const m = Math.floor(total / 60000);
      const s = Math.floor((total % 60000) / 1000);
      setElapsed(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session.isPaused, session.elapsedMs, session.updatedAt]);

  const handleResultChange = (result: 'win' | 'loss' | 'breakeven') => {
    const rr = session.defaultRR || 1;
    const defaultR = result === 'win' ? rr : result === 'loss' ? -1 : 0;
    setFormData(prev => ({ ...prev, result, rMultiple: defaultR }));
  };

  const handleSubmit = useCallback(() => {
    if (completed) return;
    const trade: BacktestTrade = {
      id: `bt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pair: formData.pair, direction: formData.direction, result: formData.result,
      rMultiple: formData.rMultiple, date: formData.date, setups: formData.setups,
      problems: formData.problems, timestamp: Date.now(),
      screenshot: formData.screenshot || undefined, notes: formData.notes || undefined,
    };
    onAddTrade(trade);
    // Reset für nächsten Eintrag — Datum/Pair/Setups bleiben stehen.
    setFormData(prev => ({
      ...prev,
      rMultiple: prev.result === 'win' ? (session.defaultRR || 1) : prev.result === 'loss' ? -1 : 0,
      problems: [], screenshot: '', notes: '',
    }));
    pairRef.current?.focus();
  }, [completed, formData, onAddTrade, session.defaultRR]);

  // Tastaturkürzel: L/S Richtung, W/X/B Ergebnis, 1–9 R-Betrag, +/− Feinjustage.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const signFor = (r: 'win' | 'loss' | 'breakeven') => (r === 'win' ? 1 : r === 'loss' ? -1 : 0);
      if (/^[1-9]$/.test(e.key)) {
        const mag = parseInt(e.key, 10);
        setFormData(prev => ({ ...prev, rMultiple: mag * (signFor(prev.result) || 1) }));
        return;
      }
      if (e.key === '+' || e.key === '=') { setFormData(prev => ({ ...prev, rMultiple: Math.round((prev.rMultiple + 0.5) * 10) / 10 })); return; }
      if (e.key === '-') { setFormData(prev => ({ ...prev, rMultiple: Math.round((prev.rMultiple - 0.5) * 10) / 10 })); return; }
      switch (e.key.toLowerCase()) {
        case 'l': setFormData(prev => ({ ...prev, direction: 'long' })); break;
        case 's': setFormData(prev => ({ ...prev, direction: 'short' })); break;
        case 'w': setFormData(prev => ({ ...prev, result: 'win', rMultiple: Math.abs(prev.rMultiple) || 1 })); break;
        case 'x': setFormData(prev => ({ ...prev, result: 'loss', rMultiple: -(Math.abs(prev.rMultiple) || 1) })); break;
        case 'b': setFormData(prev => ({ ...prev, result: 'breakeven', rMultiple: 0 })); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Enter speichert (außer im Textarea → Shift+Enter für Zeilenumbruch)
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

  // Strg+V: Screenshot aus Zwischenablage
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

  const toggleSetup = (key: string) => setFormData(prev => ({
    ...prev, setups: prev.setups.includes(key) ? prev.setups.filter(s => s !== key) : [...prev.setups, key],
  }));

  const toggleProblem = (p: string) => setFormData(prev => ({
    ...prev, problems: prev.problems.includes(p) ? prev.problems.filter(x => x !== p) : [...prev.problems, p],
  }));

  const addNewProblem = () => {
    const val = newProblem.trim();
    if (!val) return;
    if (!problemOptions.includes(val)) {
      const updated = [...problemOptions, val];
      setProblemOptions(updated);
      saveProblems(updated);
      savePref('problems', updated).catch(e => console.error('Problem-Sync fehlgeschlagen:', e));
    }
    setFormData(prev => ({ ...prev, problems: prev.problems.includes(val) ? prev.problems : [...prev.problems, val] }));
    setNewProblem('');
  };

  const saveNoteAsSnippet = () => {
    const val = formData.notes.trim();
    if (!val || noteSnippets.includes(val)) return;
    const updated = [...noteSnippets, val];
    setNoteSnippets(updated);
    saveNoteSnippets(updated);
    savePref('noteSnippets', updated).catch(e => console.error('Notiz-Baustein-Sync fehlgeschlagen:', e));
    showToast('Notiz als Baustein gespeichert', 'success');
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

  return (
    <div className="fixed inset-0 z-[110] bg-background overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        {/* Schlanke Topbar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-text-primary truncate">{session.name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted mt-0.5">
              <span className="flex items-center gap-1"><Clock size={14} /> {elapsed}</span>
              <span>Eintrag #{session.trades.length + 1}</span>
              {session.pair && <span className="text-text-secondary font-medium">{session.pair}</span>}
              {session.defaultRR != null && <span>RR 1:{session.defaultRR}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!completed && (
              <button onClick={onTogglePause} className={clsx('btn', session.isPaused ? 'btn-primary' : 'btn-secondary')}>
                {session.isPaused ? <Play size={16} /> : <Pause size={16} />}
                {session.isPaused ? 'Fortsetzen' : 'Pause'}
              </button>
            )}
            {!completed && (
              <button onClick={() => confirm('Session beenden (abschließen)?') && onFinish()} className="btn btn-secondary text-pnl-negative hover:bg-pnl-negative/10">
                <StopCircle size={16} /> Beenden
              </button>
            )}
            <button onClick={onClose} className="btn btn-primary">
              <DoorOpen size={16} /> Speichern &amp; Schließen
            </button>
          </div>
        </div>

        {/* Mini-Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="stat-card">
            <div className="stat-label">Win Rate</div>
            <div className="text-2xl font-bold text-accent-primary">{stats.winRate.toFixed(1)}%</div>
            <div className="text-xs text-text-muted">{stats.wins}W / {stats.losses}L</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total R</div>
            <div className={clsx('text-2xl font-bold', stats.totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
              {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(1)} R
            </div>
            <div className="text-xs text-text-muted">Ø {stats.avgR.toFixed(2)} R</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Profit Factor</div>
            <div className="text-2xl font-bold text-text-primary">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}</div>
          </div>
          {stats.hasEur ? (
            <div className="stat-card">
              <div className="stat-label">P&L (€)</div>
              <div className={clsx('text-2xl font-bold', stats.totalEur >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                {stats.totalEur >= 0 ? '+' : ''}{stats.totalEur.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €
              </div>
              <div className="text-xs text-text-muted">{stats.growthPct >= 0 ? '+' : ''}{stats.growthPct.toFixed(1)}%</div>
            </div>
          ) : (
            <div className="stat-card">
              <div className="stat-label">Trades</div>
              <div className="text-2xl font-bold text-text-primary">{stats.totalTrades}</div>
            </div>
          )}
        </div>

        {/* Speed Entry */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Keyboard size={20} className="text-accent-primary" />
              Speed Entry
              <span className="text-xs text-text-muted ml-2 hidden lg:inline">L/S · W/X/B · 1–9=R · +/− · Enter=Speichern · Strg+V=Bild</span>
            </h3>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="input-label">Währungspaar</label>
              <select ref={pairRef} className="input select" value={formData.pair} onChange={e => setFormData(prev => ({ ...prev, pair: e.target.value }))}>
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
                        ? result === 'win' ? 'bg-pnl-positive text-white' : result === 'loss' ? 'bg-pnl-negative text-white' : 'bg-be text-white'
                        : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}>
                    {result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'BE'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="input-label">R-Multiple</label>
              <input type="number" step="0.1" className="input" value={formData.rMultiple}
                onChange={e => setFormData(prev => ({ ...prev, rMultiple: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="input-label">Datum</label>
              <input type="date" className="input" value={formData.date}
                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} />
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

            {/* Probleme & Fehler (gemeinsamer Tag-Block, wiederverwendbar) */}
            <div className="col-span-4">
              <label className="input-label flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-be" /> Probleme &amp; Fehler (optional, mehrfach)
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {problemOptions.map(problem => (
                  <button key={problem} type="button" onClick={() => toggleProblem(problem)}
                    className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      formData.problems.includes(problem) ? 'bg-be text-white' : 'bg-background-surface-hover text-text-muted hover:text-text-primary')}>
                    {problem}
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input type="text" value={newProblem} onChange={e => setNewProblem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewProblem(); } }}
                    placeholder="+ neues Problem" className="input py-1.5 text-sm w-40" />
                  <button type="button" onClick={addNewProblem} disabled={!newProblem.trim()}
                    className="p-1.5 rounded-lg bg-be/15 text-be hover:bg-be/25 disabled:opacity-40 transition-colors" title="Problem hinzufügen (wird gespeichert)">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Screenshot */}
            <div className="col-span-4 mt-2">
              <label className="input-label">Screenshot (optional)</label>
              <div className="flex items-center gap-4">
                <input ref={screenshotRef} type="file" accept="image/*" onChange={handleScreenshotUpload} className="hidden" />
                <button type="button" onClick={() => screenshotRef.current?.click()} className="btn btn-secondary">
                  <ImageIcon size={16} /> Bild hochladen
                </button>
                {formData.screenshot && (
                  <div className="flex items-center gap-2">
                    <img src={formData.screenshot} alt="Vorschau" className="h-10 w-16 object-cover rounded border border-border" />
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, screenshot: '' }))} className="p-1 hover:bg-pnl-negative/10 rounded">
                      <X size={14} className="text-pnl-negative" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notizen (separat) + wiederverwendbare Bausteine */}
            <div className="col-span-4 mt-2">
              <div className="flex items-center justify-between">
                <label className="input-label mb-0">Notizen (optional, separat)</label>
                <button type="button" onClick={saveNoteAsSnippet} disabled={!formData.notes.trim()}
                  className="flex items-center gap-1 text-xs text-accent-primary hover:text-accent-primary-dim disabled:opacity-40">
                  <Star size={13} /> als Baustein speichern
                </button>
              </div>
              <textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Was lief gut/schlecht? Lessons learned..." className="input min-h-[60px] text-sm mt-1.5" rows={2} />
              {noteSnippets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {noteSnippets.map(sn => (
                    <button key={sn} type="button"
                      onClick={() => setFormData(prev => ({ ...prev, notes: prev.notes ? `${prev.notes}\n${sn}` : sn }))}
                      className="px-2 py-1 rounded-md text-[11px] bg-background-surface-hover text-text-secondary border border-border hover:border-accent-primary/40 hover:text-text-primary transition-colors max-w-[220px] truncate"
                      title={sn}>
                      {sn}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={completed}
            className={clsx('btn btn-primary w-full mt-4', completed && 'opacity-50 cursor-not-allowed')}>
            <Save size={16} /> Trade speichern
          </button>
        </div>
      </div>
    </div>
  );
}
