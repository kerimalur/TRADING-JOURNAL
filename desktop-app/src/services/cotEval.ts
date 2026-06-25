/**
 * ========================================================================
 * COT Eval — Trefferquote-Auswertung ("Wie oft lag das Tool richtig?")
 * ========================================================================
 * Mechanische, UNGETUNTE Simulation auf der vorhandenen COT-Historie + Preisen:
 *   Regel: jede Woche stärkste vs. schwächste Währung (nach Commercial-Net-
 *   Perzentil, NUR mit Vergangenheitsdaten = kein Lookahead) → Pair.
 *   Prüfe, ob sich das Pair in den nächsten N Wochen in die erwartete
 *   Richtung bewegt hat.
 *
 * EHRLICH: Das ist KEIN getuntes Backtest und kein Beweis. Es ist eine
 * mechanische Anwendung der Kernregel auf echte Historie → grobe Orientierung.
 * Der saubere Test sind die wöchentlichen Forward-Snapshots, die ab jetzt
 * akkumulieren. Benchmark bleibt: muss den Münzwurf (50%) schlagen.
 */

import type { COTSnapshot } from './smartCotService';

export interface PricePoint { date: string; price: number }

export interface EvalWeek {
  date: string;
  topCcy: string;
  bottomCcy: string;
  pair: string;
  correct: boolean;
  movePct: number; // (topReturn - bottomReturn) * 100
}

export interface DriverHit {
  driver: string;
  hitRate: number;
  sample: number;
}

export interface EvalResult {
  horizonWeeks: number;
  weeks: EvalWeek[];
  hitRate: number;          // % korrekt
  sample: number;
  avgMovePct: number;       // Durchschnitt der korrekten Richtung (Edge-Größe)
  perCurrency: Array<{ currency: string; hitRate: number; sample: number }>;
  byDriver: DriverHit[];
}

const CCYS = ['DXY', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'];

// USD-basierter Preis je Währung (USD für DXY-Serie)
function priceSeriesFor(priceData: Record<string, PricePoint[]>, ccy: string): PricePoint[] {
  if (ccy === 'USD' || ccy === 'DXY') return priceData['DXY'] || priceData['USD'] || [];
  return priceData[ccy] || [];
}

// Nächstgelegener Preis zu einem Datum (±10 Tage)
function priceAt(series: PricePoint[], date: string): number | null {
  if (series.length === 0) return null;
  const target = new Date(date).getTime();
  let best: PricePoint | null = null;
  let bestDiff = Infinity;
  for (const p of series) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  if (!best || bestDiff > 10 * 86400000) return null;
  return best.price;
}

// Return einer Währung über N Wochen ab Datum (in %)
function ccyReturn(priceData: Record<string, PricePoint[]>, ccy: string, date: string, weeks: number): number | null {
  const series = priceSeriesFor(priceData, ccy);
  const p0 = priceAt(series, date);
  const future = new Date(date);
  future.setDate(future.getDate() + weeks * 7);
  const p1 = priceAt(series, future.toISOString().split('T')[0]);
  if (p0 === null || p1 === null || p0 === 0) return null;
  return (p1 - p0) / p0;
}

/**
 * Baut pro Währung eine Zeitreihe mit trailing-52W-Perzentil (kein Lookahead)
 * und 4W-Momentum der Commercial-Net-Position.
 */
function strengthSeries(snapshots: COTSnapshot[]) {
  const byCcy: Record<string, Array<{ date: string; percentile: number; momentum4w: number }>> = {};
  for (const ccy of CCYS) {
    const rows = snapshots
      .filter(s => s.currency === ccy)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (rows.length === 0) continue;
    const out: Array<{ date: string; percentile: number; momentum4w: number }> = [];
    for (let i = 0; i < rows.length; i++) {
      const window = rows.slice(Math.max(0, i - 51), i + 1); // nur Vergangenheit inkl. heute
      const nets = window.map(r => r.commercialsNet);
      const min = Math.min(...nets);
      const max = Math.max(...nets);
      const range = max - min;
      const percentile = range > 0 ? ((rows[i].commercialsNet - min) / range) * 100 : 50;
      const momentum4w = i >= 4 ? rows[i].commercialsNet - rows[i - 4].commercialsNet : 0;
      out.push({ date: rows[i].date, percentile, momentum4w });
    }
    byCcy[ccy] = out;
  }
  return byCcy;
}

/**
 * Mechanische Auswertung: stärkste vs. schwächste Währung je Woche.
 */
export function evaluateMechanical(
  snapshots: COTSnapshot[],
  priceData: Record<string, PricePoint[]>,
  horizonWeeks = 4,
): EvalResult {
  const series = strengthSeries(snapshots);
  // alle Datumswerte (Wochen) sammeln
  const dateSet = new Set<string>();
  for (const ccy of Object.keys(series)) for (const r of series[ccy]) dateSet.add(r.date);
  const dates = Array.from(dateSet).sort();

  const weeks: EvalWeek[] = [];
  const perCcy: Record<string, { hit: number; total: number }> = {};
  // Treiber-Attribution: pro Währung-Woche prüft ein Treiber bullish/bearish vs. eigener Return
  const driverAgg: Record<string, { hit: number; total: number }> = {
    'COT-Positionierung': { hit: 0, total: 0 },
    'Momentum': { hit: 0, total: 0 },
  };

  for (const date of dates) {
    // Snapshot der Stärke an diesem Datum
    const ranked: Array<{ ccy: string; percentile: number; momentum4w: number }> = [];
    for (const ccy of Object.keys(series)) {
      const row = series[ccy].find(r => r.date === date);
      if (row) ranked.push({ ccy, percentile: row.percentile, momentum4w: row.momentum4w });
    }
    if (ranked.length < 4) continue;
    ranked.sort((a, b) => b.percentile - a.percentile);
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];

    const topRet = ccyReturn(priceData, top.ccy, date, horizonWeeks);
    const bottomRet = ccyReturn(priceData, bottom.ccy, date, horizonWeeks);

    if (topRet !== null && bottomRet !== null) {
      const spreadRet = topRet - bottomRet;
      const correct = spreadRet > 0;
      const code = (c: string) => (c === 'DXY' ? 'USD' : c);
      weeks.push({
        date,
        topCcy: code(top.ccy),
        bottomCcy: code(bottom.ccy),
        pair: `${code(top.ccy)}/${code(bottom.ccy)}`,
        correct,
        movePct: spreadRet * 100,
      });
      for (const c of [top.ccy, bottom.ccy]) {
        if (!perCcy[c]) perCcy[c] = { hit: 0, total: 0 };
        perCcy[c].total++;
        if (correct) perCcy[c].hit++;
      }
    }

    // Treiber-Attribution pro Währung an diesem Datum
    for (const r of ranked) {
      const ret = ccyReturn(priceData, r.ccy, date, horizonWeeks);
      if (ret === null) continue;
      // COT-Positionierung
      if (r.percentile >= 60 || r.percentile <= 40) {
        const bullish = r.percentile >= 60;
        driverAgg['COT-Positionierung'].total++;
        if ((bullish && ret > 0) || (!bullish && ret < 0)) driverAgg['COT-Positionierung'].hit++;
      }
      // Momentum
      if (Math.abs(r.momentum4w) > 0) {
        const bullish = r.momentum4w > 0;
        driverAgg['Momentum'].total++;
        if ((bullish && ret > 0) || (!bullish && ret < 0)) driverAgg['Momentum'].hit++;
      }
    }
  }

  const hit = weeks.filter(w => w.correct).length;
  const sample = weeks.length;
  const correctMoves = weeks.filter(w => w.correct).map(w => Math.abs(w.movePct));
  const avgMovePct = correctMoves.length > 0 ? correctMoves.reduce((s, v) => s + v, 0) / correctMoves.length : 0;

  const code = (c: string) => (c === 'DXY' ? 'USD' : c);
  const perCurrency = Object.entries(perCcy)
    .map(([c, v]) => ({ currency: code(c), hitRate: v.total > 0 ? Math.round((v.hit / v.total) * 100) : 0, sample: v.total }))
    .sort((a, b) => b.hitRate - a.hitRate);

  const byDriver = Object.entries(driverAgg)
    .filter(([, v]) => v.total > 0)
    .map(([driver, v]) => ({ driver, hitRate: Math.round((v.hit / v.total) * 100), sample: v.total }));

  return {
    horizonWeeks,
    weeks,
    hitRate: sample > 0 ? Math.round((hit / sample) * 100) : 0,
    sample,
    avgMovePct: Math.round(avgMovePct * 100) / 100,
    perCurrency,
    byDriver,
  };
}
