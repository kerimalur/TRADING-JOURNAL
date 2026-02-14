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
import { HashRouter, BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Components
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/Toaster';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { QueryProvider } from '@/providers';

// Pages
import { Dashboard } from '@/pages/Dashboard';
import { FundedJournal } from '@/pages/FundedJournal';
import { EKJournal } from '@/pages/EKJournal';
import { CurrencyAnalysis } from '@/pages/CurrencyAnalysis';
import { Settings } from '@/pages/Settings';
import { EquityCurve } from '@/pages/EquityCurve';
import { Backtest } from '@/pages/Backtest';
import { Calendar } from '@/pages/Calendar';
import { Simulation } from '@/pages/Simulation';
import { COTData } from '@/pages/COTData';
import { MachineLearning } from '@/pages/MachineLearning';
import { News } from '@/pages/News';
import { Outlook } from '@/pages/Outlook';
import { StrategyBuilder } from '@/pages/StrategyBuilder';
import { RiskManagement } from '@/pages/RiskManagement';

// Debug
import { AuthDebug } from '@/components/AuthDebug';

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
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
   try {
      // Redirect URL = aktuelle URL (für localhost oder Vercel)
  const redirectUrl = window.location.origin;
      console.log('🔐 Magic Link redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOtp({ 
        email,
    options: {
      emailRedirectTo: redirectUrl,
        }
  });
  
      if (error) {
        console.error('❌ Supabase Auth Error:', error);
        setMessage(`Fehler: ${error.message}`);
      } else {
        setMessage('✅ Magic Link gesendet! Prüfe deine E-Mails und klicke auf den Link.');
      }
    } catch (err: any) {
      console.error('❌ Network Error:', err);
      setMessage(`Netzwerkfehler: ${err.message || 'Verbindung fehlgeschlagen'}`);
    }
    
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary items-center justify-center">
      <div className="w-full max-w-md p-8 bg-background-surface border border-border rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center">Trading Journal</h1>
        <p className="text-sm text-text-muted text-center mb-6">Melde dich an um fortzufahren</p>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            className="p-3 rounded bg-background border border-border focus:border-accent-primary outline-none transition-colors"
            type="email"
            placeholder="deine@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button 
            className="p-3 bg-accent-primary hover:bg-accent-primary/90 text-white rounded font-bold transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Sende Link...' : 'Magic Link anfordern'}
          </button>
        </form>
        
        {message && (
          <div className={`mt-4 p-3 rounded text-sm ${message.startsWith('✅') ? 'bg-pnl-positive/20 text-pnl-positive' : 'bg-pnl-negative/20 text-pnl-negative'}`}>
            {message}
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={onSkipLogin}
            className="w-full p-3 bg-background border border-border hover:border-accent-primary/50 text-text-muted hover:text-text-primary rounded transition-colors text-sm"
          >
            🔓 Ohne Login fortfahren (nur lokal)
          </button>
          <p className="mt-2 text-xs text-text-muted text-center">
            Daten werden im Browser gespeichert
          </p>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN APP CONTENT
// ----------------------------------------------------------------------
function AppContent() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(() => {
    return localStorage.getItem('trading-journal-offline-mode') === 'true';
  });
  const inElectron = isElectron();

  // Auth Check (nur für Web)
  useEffect(() => {
    if (inElectron || offlineMode) {
      setAuthLoading(false);
      return;
    }

    // Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Listen for Auth Changes (Magic Link Callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔐 Auth state changed:', _event);
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [inElectron, offlineMode]);

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
      <AuthDebug />
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
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/funded" element={<FundedJournal />} />
              <Route path="/ek" element={<EKJournal />} />
              <Route path="/equity" element={<EquityCurve />} />
              <Route path="/currency" element={<CurrencyAnalysis />} />
              <Route path="/backtest" element={<Backtest />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/simulation" element={<Simulation />} />
              <Route path="/cot" element={<COTData />} />
              <Route path="/news" element={<News />} />
              <Route path="/outlook" element={<Outlook />} />
              <Route path="/strategy" element={<StrategyBuilder />} />
              <Route path="/ml" element={<MachineLearning />} />
              <Route path="/risk" element={<RiskManagement />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
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
