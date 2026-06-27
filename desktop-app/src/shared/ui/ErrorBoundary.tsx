/**
 * ========================================================================
 * Trading Journal - Error Boundary Component
 * ========================================================================
 * 
 * Fängt JavaScript-Fehler ab und verhindert App-Abstürze.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Hier könnte man einen Error Reporting Service einbinden
    // z.B. Sentry, LogRocket, etc.
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.hash = '#/dashboard';
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-background-surface border border-border rounded-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-pnl-negative/20 flex items-center justify-center">
              <AlertTriangle size={32} className="text-pnl-negative" />
            </div>
            
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Etwas ist schiefgelaufen
            </h1>
            
            <p className="text-text-muted mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Bitte versuche die Seite neu zu laden.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-pnl-negative/10 rounded-lg text-left overflow-auto max-h-48">
                <p className="text-sm font-mono text-pnl-negative">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs text-text-muted mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleGoHome}
                className="btn-secondary flex items-center gap-2"
              >
                <Home size={16} />
                Zum Dashboard
              </button>
              <button
                onClick={this.handleReload}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Seite neu laden
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Kleinere Error Boundary für einzelne Komponenten
 */
export class ComponentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ComponentErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-pnl-negative/10 border border-pnl-negative/30 rounded-lg text-center">
          <AlertTriangle size={24} className="text-pnl-negative mx-auto mb-2" />
          <p className="text-sm text-text-muted mb-3">
            Fehler beim Laden dieser Komponente
          </p>
          <button
            onClick={this.handleRetry}
            className="btn-secondary text-sm py-1 px-3"
          >
            Erneut versuchen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
