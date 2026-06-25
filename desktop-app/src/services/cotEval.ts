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
  driversAgree: boolean; // COT-Ranking + 4W-Momentum bestätigen sich gegenseitig
  stretched: boolean;    // top >=90 oder bottom <=10 Perzentil (crowded)
}

export interface DriverHit {
  driver: string;
  hitRate: number;
  sample: number;
}

export interface Bucket {
  label: string;
  hitRate: number;
  sample: number;
  delta: number; // Differenz zur Gesamt-Trefferquote (Prozentpunkte)
}

export interface HorizonScore {
  horizonWeeks: number;
  hitRate: number;
  sample: number;
  avgMovePct: number;
}

export interface EvalResult {
  horizonWeeks: number;
  weeks: EvalWeek[];
  hitRate: number;          // % korrekt
  sample: number;
  avgMovePct: number;       // Durchschnitt der korrekten Richtung (Edge-Größe)
  perCurrency: Array<{ currency: string; hitRate: number; sample: number }>;
  byDriver: DriverHit[];
  buckets: {
    driverAgreement: Bucket[]; // [einig, uneinig]
    stretch: Bucket[];         // [ausgereizt, normal]
  };
  horizons: HorizonScore[];    // gleiche Regel bei 2/4/6/8 Wochen
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

// Kern: eine Auswertung bei festem Horizont. Liefert die rohen Aggregate.
function runEval(
  series: ReturnType<typeof strengthSeries>,
  priceData: Record<string, PricePoint[]>,
  horizonWeeks: number,
) {
  const dateSet = new Set<string>();
  for (const ccy of Object.keys(series)) for (const r of series[ccy]) dateSet.add(r.date);
  const dates = Array.from(dateSet).sort();

  const weeks: EvalWeek[] = [];
  const perCcy: Record<string, { hit: number; total: number }> = {};
  const driverAgg: Record<string, { hit: number; total: number }> = {
    'COT-Positionierung': { hit: 0, total: 0 },
    'Momentum': { hit: 0, total: 0 },
  };
  const code = (c: string) => (c === 'DXY' ? 'USD' : c);

  for (const date of dates) {
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
      // Treiber einig: Momentum bestätigt das COT-Ranking (top stärkt, bottom schwächt)
      const driversAgree = top.momentum4w >= 0 && bottom.momentum4w <= 0;
      // ausgereizt: eine Seite an einem Extrem (crowded)
      const stretched = top.percentile >= 90 || bottom.percentile <= 10;
      weeks.push({
        date,
        topCcy: code(top.ccy),
        bottomCcy: code(bottom.ccy),
        pair: `${code(top.ccy)}/${code(bottom.ccy)}`,
        correct,
        movePct: spreadRet * 100,
        driversAgree,
        stretched,
      });
      for (const c of [top.ccy, bottom.ccy]) {
        if (!perCcy[c]) perCcy[c] = { hit: 0, total: 0 };
        perCcy[c].total++;
        if (correct) perCcy[c].hit++;
      }
    }

    for (const r of ranked) {
      const ret = ccyReturn(priceData, r.ccy, date, horizonWeeks);
      if (ret === null) continue;
      if (r.percentile >= 60 || r.percentile <= 40) {
        const bullish = r.percentile >= 60;
        driverAgg['COT-Positionierung'].total++;
        if ((bullish && ret > 0) || (!bullish && ret < 0)) driverAgg['COT-Positionierung'].hit++;
      }
      if (Math.abs(r.momentum4w) > 0) {
        const bullish = r.momentum4w > 0;
        driverAgg['Momentum'].total++;
        if ((bullish && ret > 0) || (!bullish && ret < 0)) driverAgg['Momentum'].hit++;
      }
    }
  }

  return { weeks, perCcy, driverAgg };
}

// Trefferquote einer Teilmenge von Wochen → Bucket (mit Abstand zur Gesamtquote).
function bucketOf(label: string, subset: EvalWeek[], overallHitRate: number): Bucket {
  const sample = subset.length;
  const hit = subset.filter(w => w.correct).length;
  const hitRate = sample > 0 ? Math.round((hit / sample) * 100) : 0;
  return { label, sample, hitRate, delta: sample > 0 ? hitRate - overallHitRate : 0 };
}

/**
 * Mechanische Auswertung: stärkste vs. schwächste Währung je Woche.
 * Zusätzlich: Fehler-Buckets (Treiber-Einigkeit, ausgereizt) + Horizont-Scan.
 * WICHTIG: Buckets sind In-Sample → Hypothesen, KEIN Beweis. Erst out-of-sample
 * (Walk-Forward / Forward-Snapshots) bestätigen, bevor man danach handelt.
 */
export function evaluateMechanical(
  snapshots: COTSnapshot[],
  priceData: Record<string, PricePoint[]>,
  horizonWeeks = 4,
): EvalResult {
  const series = strengthSeries(snapshots);
  const { weeks, perCcy, driverAgg } = runEval(series, priceData, horizonWeeks);

  const hit = weeks.filter(w => w.correct).length;
  const sample = weeks.length;
  const hitRate = sample > 0 ? Math.round((hit / sample) * 100) : 0;
  const correctMoves = weeks.filter(w => w.correct).map(w => Math.abs(w.movePct));
  const avgMovePct = correctMoves.length > 0 ? correctMoves.reduce((s, v) => s + v, 0) / correctMoves.length : 0;

  const code = (c: string) => (c === 'DXY' ? 'USD' : c);
  const perCurrency = Object.entries(perCcy)
    .map(([c, v]) => ({ currency: code(c), hitRate: v.total > 0 ? Math.round((v.hit / v.total) * 100) : 0, sample: v.total }))
    .sort((a, b) => b.hitRate - a.hitRate);

  const byDriver = Object.entries(driverAgg)
    .filter(([, v]) => v.total > 0)
    .map(([driver, v]) => ({ driver, hitRate: Math.round((v.hit / v.total) * 100), sample: v.total }));

  // Fehler-Buckets (In-Sample-Hypothesen)
  const buckets = {
    driverAgreement: [
      bucketOf('Treiber einig (COT + Momentum)', weeks.filter(w => w.driversAgree), hitRate),
      bucketOf('Treiber uneinig', weeks.filter(w => !w.driversAgree), hitRate),
    ],
    stretch: [
      bucketOf('Normal (nicht ausgereizt)', weeks.filter(w => !w.stretched), hitRate),
      bucketOf('Ausgereizt / crowded', weeks.filter(w => w.stretched), hitRate),
    ],
  };

  // Horizont-Scan: gleiche Regel bei 2/4/6/8 Wochen
  const horizons: HorizonScore[] = [2, 4, 6, 8].map(h => {
    const r = runEval(series, priceData, h);
    const s = r.weeks.length;
    const hh = r.weeks.filter(w => w.correct).length;
    const moves = r.weeks.filter(w => w.correct).map(w => Math.abs(w.movePct));
    return {
      horizonWeeks: h,
      hitRate: s > 0 ? Math.round((hh / s) * 100) : 0,
      sample: s,
      avgMovePct: moves.length > 0 ? Math.round((moves.reduce((a, b) => a + b, 0) / moves.length) * 100) / 100 : 0,
    };
  });

  return {
    horizonWeeks,
    weeks,
    hitRate,
    sample,
    avgMovePct: Math.round(avgMovePct * 100) / 100,
    perCurrency,
    byDriver,
    buckets,
    horizons,
  };
}
