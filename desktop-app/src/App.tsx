/**
 * ========================================================================
 * Trading Journal - App Entry Point
 * ========================================================================
 * 
 * Unterstützt Web (Vercel) und Desktop (Electron).
 * Web: Supabase Auth mit Magic Link
 * Desktop: Lokale Speicherung ohne Auth
 */

import { useState, useEffect } from 'react';
import { HashRouter, BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Components
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/Toaster';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { QueryProvider } from '@/providers';
import { AnimatePresence } from 'framer-motion';

// Pages
import { Dashboard } from '@/pages/Dashboard';
import { FundedJournal } from '@/pages/FundedJournal';
import { EKJournal } from '@/pages/EKJournal';
import { Settings } from '@/pages/Settings';
import { EquityCurve } from '@/pages/EquityCurve';
import { Backtest } from '@/pages/Backtest';
import { Calendar } from '@/pages/Calendar';
import { Outlook } from '@/pages/Outlook';
import { StrategyBuilder } from '@/pages/StrategyBuilder';
import { Fundamentals } from '@/pages/Fundamentals';
import { News } from '@/pages/News';
import { COTData } from '@/pages/COTData';
import { CurrencyAnalysis } from '@/pages/CurrencyAnalysis';

// Debug removed - AuthDebug no longer needed

// Utils
import { isElectron } from '@/services/webApi';

// i18n
import '@/i18n';

// ----------------------------------------------------------------------
// LOGIN SCREEN (nur für Web)
// ----------------------------------------------------------------------
interface LoginScreenProps {
  onSkipLogin: () => void;
}

function LoginScreen({ onSkipLogin }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) setError(error.message);
    } catch (err: any) {
      setError(err.message || 'Verbindung fehlgeschlagen');
    }
    setLoading(false);
  };

  const handleSkipWithName = () => {
    if (!displayName.trim()) {
      setNameError('Bitte gib deinen Namen ein');
      return;
    }
    localStorage.setItem('tradingJournal_displayName', displayName.trim());
    onSkipLogin();
  };

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary items-center justify-center">
      <div className="w-full max-w-sm p-8 bg-background-surface border border-border rounded-2xl shadow-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-glow-sm"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}>
            <span className="text-white font-bold text-xl">TJ</span>
          </div>
        </div>

        <h1 className="text-xl font-bold mb-1 text-center text-text-primary">Trading Journal</h1>
        <p className="text-sm text-text-muted text-center mb-6">Melde dich an, um fortzufahren</p>

        {/* Name input for skip login */}
        <div className="mb-4">
          <label className="input-label">Dein Name</label>
          <input
            type="text"
            className="input"
            placeholder="z.B. Max"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setNameError(''); }}
          />
          {nameError && <p className="mt-1 text-xs text-pnl-negative">{nameError}</p>}
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 p-3.5 rounded-xl bg-white text-gray-800 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? 'Weiterleitung...' : 'Mit Google anmelden'}
        </button>

        {error && (
          <p className="mt-3 text-xs text-pnl-negative text-center">{error}</p>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-muted">oder</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleSkipWithName}
          className="w-full p-3 bg-background border border-border hover:border-accent-primary/50 text-text-muted hover:text-text-primary rounded-xl transition-colors text-sm"
        >
          Ohne Login fortfahren (lokal)
        </button>
        <p className="mt-2 text-xs text-text-muted text-center">
          Daten werden nur im Browser gespeichert
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN APP CONTENT
// ----------------------------------------------------------------------
function AppContent() {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(() => {
    return localStorage.getItem('trading-journal-offline-mode') === 'true';
  });
  const inElectron = isElectron();

  // Auth Check – läuft IMMER (auch wenn offlineMode=true), damit OAuth-Callbacks
  // nach Google-Login korrekt verarbeitet werden. Wenn eine Session existiert,
  // wird offlineMode automatisch zurückgesetzt.
  useEffect(() => {
    if (inElectron) {
      setAuthLoading(false);
      return;
    }

    // Session beim Start prüfen (inkl. OAuth-Callback im URL-Hash)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Eingeloggt → offline-Flag entfernen, damit die App Cloud-Modus nutzt
        localStorage.removeItem('trading-journal-offline-mode');
        setOfflineMode(false);
      }
      setSession(session);
      setAuthLoading(false);
    });

    // Auth-Zustandsänderungen (Google-OAuth, Logout, Token-Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        localStorage.removeItem('trading-journal-offline-mode');
        setOfflineMode(false);
      }
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [inElectron]); // offlineMode NICHT als Dep – Auth immer überwachen

  // Keyboard Shortcuts
  useEffect(() => {
    if (!session && !offlineMode && !inElectron) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, offlineMode, inElectron]);

  // Skip Login Handler
  const handleSkipLogin = () => {
    localStorage.setItem('trading-journal-offline-mode', 'true');
    setOfflineMode(true);
  };

  // Loading State
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-text-primary">
        Loading...
      </div>
    );
  }

  // Show Login (nur für Web, nicht für Electron oder Offline-Mode)
  if (!inElectron && !session && !offlineMode) {
    return <LoginScreen onSkipLogin={handleSkipLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary overflow-hidden">
      {/* AuthDebug removed */}
      {/* Draggable Title Bar - nur für Electron */}
      {inElectron && (
        <div 
          className="h-9 w-full bg-background flex-shrink-0 border-b border-border/50"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      )}
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar /> 
        
        <main className="flex-1 overflow-y-auto bg-background">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/funded" element={<FundedJournal />} />
                <Route path="/ek" element={<EKJournal />} />
                <Route path="/equity" element={<EquityCurve />} />
                <Route path="/backtest" element={<Backtest />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/outlook" element={<Outlook />} />
                <Route path="/fundamentals" element={<Fundamentals />} />
                <Route path="/news"         element={<News />} />
                <Route path="/cot"          element={<COTData />} />
                <Route path="/zinsen"       element={<CurrencyAnalysis />} />
                <Route path="/strategy" element={<StrategyBuilder />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>
      
      <Toaster />
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

// ----------------------------------------------------------------------
// APP WRAPPER - Router auswählen basierend auf Umgebung
// ----------------------------------------------------------------------
function App() {
  const inElectron = isElectron();
  
  // Electron nutzt HashRouter, Web nutzt BrowserRouter
  const Router = inElectron ? HashRouter : BrowserRouter;

  return (
    <ErrorBoundary>
      <QueryProvider>
        <Router>
          <AppContent />
        </Router>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
