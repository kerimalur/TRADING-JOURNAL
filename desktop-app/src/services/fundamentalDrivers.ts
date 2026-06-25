/**
 * ========================================================================
 * Fundamental Drivers — zusätzliche fundamentale Treiber
 * ========================================================================
 * #3 Wachstums-Überraschung (LIVE aus Wirtschaftskalender).
 *
 * EHRLICH: Nicht der Absolutwert einer Zahl bewegt den Markt, sondern die
 * ÜBERRASCHUNG gegenüber dem Forecast. "Besser als erwartet" = Währung stark.
 * Deckt nur die jüngste Vergangenheit ab (Kalender liefert kein tiefes Archiv)
 * → als kurzfristiges "Daten-Momentum" verstehen, nicht als Langzeit-Signal.
 */

export interface CurrencySurprise {
  score: number;   // -100..+100
  label: string;   // Klartext
  count: number;   // Anzahl ausgewerteter Events
}

// Indikatoren, bei denen ein HÖHERER Wert die Währung stützt
const POSITIVE_IF_HIGHER = [
  'gdp', 'pmi', 'ism', 'retail', 'employment change', 'payroll', 'nonfarm', 'nfp',
  'cpi', 'inflation', 'ppi', 'wage', 'earnings', 'confidence', 'sentiment',
  'durable', 'trade balance', 'current account', 'building permits', 'housing',
  'industrial production', 'manufacturing',
];
// Indikatoren, bei denen ein HÖHERER Wert die Währung SCHWÄCHT
const NEGATIVE_IF_HIGHER = [
  'unemployment rate', 'jobless', 'initial claims', 'continuing claims',
];

// Robustes Parsen: "3.2%" -> 3.2, "250K" -> 250000, "-1.1" -> -1.1, "1.2M" -> 1200000
function parseNum(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'n/a') return null;
  let mult = 1;
  const lower = s.toLowerCase();
  if (lower.endsWith('k')) mult = 1e3;
  else if (lower.endsWith('m')) mult = 1e6;
  else if (lower.endsWith('b') || lower.endsWith('bn')) mult = 1e9;
  s = s.replace(/[%,]/g, '').replace(/[kmbn]$/i, '').replace(/bn$/i, '').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return n * mult;
}

function directionSign(eventName: string): number {
  const e = (eventName || '').toLowerCase();
  if (NEGATIVE_IF_HIGHER.some(k => e.includes(k))) return -1;
  if (POSITIVE_IF_HIGHER.some(k => e.includes(k))) return 1;
  return 0; // unbekannt → ignorieren
}

function surpriseLabel(score: number, count: number): string {
  if (count === 0) return 'keine Daten diese Woche';
  if (score >= 30) return 'Daten schlagen Forecast klar';
  if (score >= 10) return 'Daten leicht über Erwartung';
  if (score <= -30) return 'Daten enttäuschen klar';
  if (score <= -10) return 'Daten leicht unter Erwartung';
  return 'Daten gemischt / im Rahmen';
}

/**
 * Berechnet pro Währung einen Überraschungs-Score aus den rohen Kalender-Events.
 * Nur Events der letzten ~14 Tage mit vorhandenem actual UND forecast.
 */
export function growthSurprise(rawEvents: any[]): Record<string, CurrencySurprise> {
  const out: Record<string, { sum: number; count: number }> = {};
  if (!Array.isArray(rawEvents)) return {};

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 14);

  for (const e of rawEvents) {
    const impact = (e.impact || '').toLowerCase();
    if (impact !== 'high' && impact !== 'medium') continue;

    const actual = parseNum(e.actual);
    const forecast = parseNum(e.forecast);
    if (actual === null || forecast === null) continue;

    const d = e.date ? new Date(e.date) : null;
    if (!d || isNaN(d.getTime()) || d < from || d > now) continue;

    const dir = directionSign(e.event || e.title || '');
    if (dir === 0) continue;

    const ccy = (e.currency || e.country || '').toUpperCase();
    if (!ccy) continue;

    // Überraschungsrichtung relativ zum Forecast
    const beat = Math.sign(actual - forecast); // +1 besser, -1 schlechter
    if (beat === 0) continue;

    const weight = impact === 'high' ? 2 : 1;
    const contribution = beat * dir * weight;

    if (!out[ccy]) out[ccy] = { sum: 0, count: 0 };
    out[ccy].sum += contribution;
    out[ccy].count += 1;
  }

  const result: Record<string, CurrencySurprise> = {};
  for (const [ccy, v] of Object.entries(out)) {
    const score = Math.max(-100, Math.min(100, Math.round(v.sum * 14)));
    result[ccy] = { score, label: surpriseLabel(score, v.count), count: v.count };
  }
  return result;
}

// Für DXY = USD-Mapping beim Nachschlagen
export function surpriseFor(
  surprise: Record<string, CurrencySurprise>,
  cotCode: string,
): CurrencySurprise | null {
  const code = cotCode === 'DXY' ? 'USD' : cotCode;
  return surprise[code] ?? null;
}
