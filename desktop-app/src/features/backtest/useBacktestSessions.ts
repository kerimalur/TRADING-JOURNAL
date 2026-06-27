/**
 * ========================================================================
 * Backtest – Session-State Hook
 * ========================================================================
 * Kapselt Laden (Hybrid: Supabase ⇄ localStorage), Persistenz und CRUD der
 * Backtest-Sessions. Die View-Komponenten bleiben dadurch reine UI.
 */

import { useState, useEffect, useCallback } from 'react';
import { loadBacktests, saveBacktest, removeBacktest, isLoggedIn } from '@/shared/services/backtestService';
import { STORAGE_KEY, isUuid, newId } from './types';
import type { BacktestSession } from './types';

export function useBacktestSessions() {
  const [sessions, setSessions] = useState<BacktestSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
            return;
          }
          if (localSessions.length > 0) {
            const migrated = localSessions.map(s => ({ ...s, id: isUuid(s.id) ? s.id : newId() }));
            setSessions(migrated);
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

      if (cancelled) return;
      setSessions(localSessions);
    })();
    return () => { cancelled = true; };
  }, []);

  const saveSessions = useCallback((next: BacktestSession[]) => {
    setSessions(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // Fire-and-forget Sync einer Session ins Backend (no-op wenn nicht eingeloggt).
  const persist = useCallback((session: BacktestSession) => {
    saveBacktest(session).catch(e => console.error('Backtest-Sync fehlgeschlagen:', e));
  }, []);

  /** Patcht die aktuelle Session und persistiert sie. */
  const updateSession = useCallback((id: string, patch: Partial<BacktestSession> | ((s: BacktestSession) => BacktestSession)) => {
    setSessions(prev => {
      const next = prev.map(s => {
        if (s.id !== id) return s;
        return typeof patch === 'function' ? patch(s) : { ...s, ...patch };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      const updated = next.find(s => s.id === id);
      if (updated) saveBacktest(updated).catch(e => console.error('Backtest-Sync fehlgeschlagen:', e));
      return next;
    });
  }, []);

  const addSession = useCallback((session: BacktestSession) => {
    saveSessions([session, ...sessions]);
    persist(session);
    setCurrentSessionId(session.id);
  }, [sessions, saveSessions, persist]);

  const deleteSession = useCallback((sessionId: string) => {
    const next = sessions.filter(s => s.id !== sessionId);
    saveSessions(next);
    removeBacktest(sessionId).catch(e => console.error('Backtest-Löschen (Backend) fehlgeschlagen:', e));
    if (currentSessionId === sessionId) setCurrentSessionId(null);
  }, [sessions, currentSessionId, saveSessions]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return {
    sessions,
    currentSession,
    currentSessionId,
    setCurrentSessionId,
    updateSession,
    addSession,
    deleteSession,
  };
}
