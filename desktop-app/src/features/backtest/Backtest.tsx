/**
 * ========================================================================
 * Trading Journal - Backtest (Orchestrator)
 * ========================================================================
 * Drei Ansichten:
 *  - 'landing'  : Übersicht / Startseite (neue oder alte Session)
 *  - 'room'     : Fokus-Raum (Vollbild, verschlossener Raum, nur Eingabe)
 *  - 'analysis' : Auswertung (Equity, Setup-/Problem-Performance, Filter)
 *
 * Session-State steckt in useBacktestSessions, Stats in backtestStats,
 * die UI in den vier View-Komponenten. Backtest-Trades bleiben separat vom
 * Live-Journal (eigene Tabelle/Storage).
 */

import { useState } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import { useBacktestSessions } from './useBacktestSessions';
import { BacktestLanding } from './BacktestLanding';
import { BacktestRoom } from './BacktestRoom';
import { BacktestAnalysis } from './BacktestAnalysis';
import { BacktestWizard } from './BacktestWizard';
import type { BacktestSession, BacktestTrade } from './types';

type View = 'landing' | 'room' | 'analysis';

export function Backtest() {
  const { showToast } = useUIStore();
  const {
    sessions, currentSession, setCurrentSessionId,
    updateSession, addSession, deleteSession,
  } = useBacktestSessions();

  const [view, setView] = useState<View>('landing');
  const [showWizard, setShowWizard] = useState(false);

  const goLanding = () => { setView('landing'); setCurrentSessionId(null); };

  const createSession = (session: BacktestSession) => {
    addSession(session);
    setShowWizard(false);
    setView('room');
    showToast('Backtest-Session gestartet', 'success');
  };

  const continueSession = (id: string) => {
    setCurrentSessionId(id);
    // Timer fortsetzen, falls pausiert (und nicht abgeschlossen)
    updateSession(id, s => (s.isPaused && !s.isCompleted) ? { ...s, isPaused: false, updatedAt: Date.now() } : s);
    setView('room');
  };

  const analyzeSession = (id: string) => { setCurrentSessionId(id); setView('analysis'); };

  const addTrade = (trade: BacktestTrade) => {
    if (!currentSession) return;
    const id = currentSession.id;
    const now = Date.now();
    updateSession(id, s => ({
      ...s,
      trades: [...s.trades, trade],
      updatedAt: now,
      elapsedMs: s.isPaused ? s.elapsedMs : s.elapsedMs + (now - s.updatedAt),
    }));
  };

  const togglePause = () => {
    if (!currentSession) return;
    const now = Date.now();
    updateSession(currentSession.id, s => ({
      ...s,
      isPaused: !s.isPaused,
      elapsedMs: s.isPaused ? s.elapsedMs : s.elapsedMs + (now - s.updatedAt),
      updatedAt: now,
    }));
  };

  // Speichern & Schließen: Timer einfrieren, zurück zur Übersicht (Session bleibt offen)
  const closeRoom = () => {
    if (currentSession) {
      const now = Date.now();
      updateSession(currentSession.id, s => ({
        ...s,
        isPaused: true,
        elapsedMs: (s.isPaused || s.isCompleted) ? s.elapsedMs : s.elapsedMs + (now - s.updatedAt),
        updatedAt: now,
      }));
    }
    showToast('Session gespeichert', 'success');
    goLanding();
  };

  // Beenden: Session abschließen
  const finishSession = () => {
    if (currentSession) {
      const now = Date.now();
      updateSession(currentSession.id, s => ({
        ...s,
        isPaused: true,
        isCompleted: true,
        elapsedMs: s.isPaused ? s.elapsedMs : s.elapsedMs + (now - s.updatedAt),
        updatedAt: now,
      }));
    }
    showToast('Session beendet', 'info');
    goLanding();
  };

  const deleteTrade = (tradeId: string) => {
    if (!currentSession) return;
    updateSession(currentSession.id, s => ({ ...s, trades: s.trades.filter(t => t.id !== tradeId), updatedAt: Date.now() }));
    showToast('Trade gelöscht', 'info');
  };

  return (
    <>
      {view === 'landing' && (
        <BacktestLanding
          sessions={sessions}
          onNew={() => setShowWizard(true)}
          onContinue={continueSession}
          onAnalyze={analyzeSession}
          onDelete={deleteSession}
        />
      )}

      {view === 'analysis' && currentSession && (
        <BacktestAnalysis
          session={currentSession}
          onContinue={() => continueSession(currentSession.id)}
          onBack={goLanding}
          onDeleteTrade={deleteTrade}
        />
      )}

      {view === 'room' && currentSession && (
        <BacktestRoom
          session={currentSession}
          onAddTrade={addTrade}
          onTogglePause={togglePause}
          onClose={closeRoom}
          onFinish={finishSession}
        />
      )}

      {showWizard && (
        <BacktestWizard onClose={() => setShowWizard(false)} onCreate={createSession} />
      )}
    </>
  );
}
