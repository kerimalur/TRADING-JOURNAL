/**
 * ========================================================================
 * Backtest – gemeinsame Typen & kleine Utilities
 * ========================================================================
 * Aus der früheren monolithischen Backtest.tsx extrahiert, damit Hook,
 * Stats-Helfer und View-Komponenten dieselben Definitionen teilen.
 */

export interface BacktestTrade {
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

export interface BacktestSession {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  trades: BacktestTrade[];
  isPaused: boolean;
  elapsedMs: number;
  isCompleted?: boolean;
  // Session-Konfiguration (im Wizard abgefragt)
  pair?: string;
  strategyId?: string;
  strategy?: string;
  defaultRR?: number;
  riskPercent?: number;
  accountSize?: number;
  startDate?: string;   // optionales Startdatum (Backtests weit in der Vergangenheit)
}

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  profitFactor: number;
  // €-Modell (nur wenn Account-Größe + Risiko% gesetzt)
  hasEur: boolean;
  eurRisk: number;
  totalEur: number;
  accountEnd: number;
  growthPct: number;
}

export const STORAGE_KEY = 'backtestSessions';

export const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Verkleinert ein Bild (DataURL) auf max. maxPx Kantenlänge und re-encodet als
 * JPEG. Hält localStorage klein (TradingView-Screenshots sind sonst MB-groß).
 * `window.Image` explizit, um Kollision mit dem lucide-Icon `Image` zu vermeiden.
 */
export function downscaleImage(src: string, maxPx = 900, quality = 0.7): Promise<string> {
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
