/**
 * Backtest – Übersicht / Startseite. Neue Session starten oder eine bestehende
 * weiter testen (Fokus-Raum) bzw. auswerten (Analyse).
 */

import { FlaskConical, Plus, Play, BarChart3, Trash2, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import type { BacktestSession } from './types';

interface Props {
  sessions: BacktestSession[];
  onNew: () => void;
  onContinue: (id: string) => void;
  onAnalyze: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BacktestLanding({ sessions, onNew, onContinue, onAnalyze, onDelete }: Props) {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <FlaskConical className="text-accent-primary" />
          High-Speed Backtesting
        </h1>
        <button onClick={onNew} className="btn btn-primary"><Plus size={16} /> Neue Session</button>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-16">
          <FlaskConical size={64} className="mx-auto text-text-muted/40 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Noch keine Session</h3>
          <p className="text-text-muted mb-4">Starte eine neue Backtest-Session und tauche in den Fokus-Raum ein.</p>
          <button onClick={onNew} className="btn btn-primary"><Plus size={16} /> Neue Session</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <FolderOpen size={16} /> Alte Session öffnen
          </div>
          {sessions.map(session => {
            const totalR = session.trades.reduce((s, t) => s + t.rMultiple, 0);
            return (
              <div key={session.id} className="card flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="font-semibold text-text-primary flex items-center gap-2 truncate">
                    {session.name}
                    {session.isCompleted && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-pnl-positive/15 text-pnl-positive shrink-0">Abgeschlossen</span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5 flex flex-wrap gap-x-3">
                    <span>{session.trades.length} Trades</span>
                    <span className={clsx(totalR >= 0 ? 'text-pnl-positive' : 'text-pnl-negative')}>
                      {totalR >= 0 ? '+' : ''}{totalR.toFixed(1)} R
                    </span>
                    <span>{new Date(session.createdAt).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => onContinue(session.id)} className="btn btn-secondary text-sm" title="Im Fokus-Raum weiter testen">
                    <Play size={14} /> Weiter testen
                  </button>
                  <button onClick={() => onAnalyze(session.id)} className="btn btn-secondary text-sm" title="Auswertung öffnen">
                    <BarChart3 size={14} /> Auswerten
                  </button>
                  <button onClick={() => { if (confirm('Session wirklich löschen?')) onDelete(session.id); }}
                    className="p-2 rounded-lg hover:bg-pnl-negative/10" title="Session löschen">
                    <Trash2 size={14} className="text-pnl-negative" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-background-surface rounded-lg border border-border text-sm text-text-muted">
        <h4 className="font-semibold text-text-primary mb-2">Über Backtest Sessions</h4>
        <p>
          Backtest-Trades werden <strong>separat</strong> von deinem Live-Journal gespeichert.
          Sie erscheinen nicht im EK- oder Funded-Journal. Beim Testen bist du im Fokus-Raum –
          ohne Ablenkung. Auswertungen (Equity-Kurve, Setup-/Problem-Performance) findest du unter „Auswerten".
        </p>
      </div>
    </div>
  );
}
