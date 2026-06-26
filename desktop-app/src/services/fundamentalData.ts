/**
 * ========================================================================
 * Fundamental Data — Länder-Makrodaten aus dem Wirtschaftskalender
 * ========================================================================
 * Extrahiert je Währung die jüngsten Makro-Releases (BIP, Arbeitsmarkt,
 * Handelsbilanz/Import-Export, Inflation, Zinsen) mit actual vs. forecast.
 *
 * EHRLICH: Nicht der Absolutwert bewegt den Markt, sondern die ÜBERRASCHUNG
 * (actual vs. forecast). Quelle = derselbe Kalender wie growthSurprise; deckt
 * nur die jüngste Vergangenheit ab (kein tiefes Archiv).
 *
 * "Krieg"/Geopolitik gibt es NICHT als sauberen Daten-Feed → separat als
 * manueller Risiko-Schalter (siehe geoRisk in der COT-Seite).
 */

export type MacroCategory = 'Zinsen' | 'BIP' | 'Arbeitsmarkt' | 'Inflation' | 'Handel';

export interface MacroRelease {
  currency: string;
  category: MacroCategory;
  event: string;
  date: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  beat: number;        // +1 actual > forecast, -1 darunter, 0 = gleich/unbekannt
  higherIsGood: boolean; // ob höher die Währung stützt (Arbeitslosigkeit: false)
  impact: 'high' | 'medium' | 'low';
}

// Kategorien aus dem Event-Namen ableiten (Reihenfolge = Priorität)
function categorize(name: string): { cat: MacroCategory; higherIsGood: boolean } | null {
  const e = (name || '').toLowerCase();
  if (e.includes('rate decision') || e.includes('interest rate') || e.includes('rate statement')) return { cat: 'Zinsen', higherIsGood: true };
  if (e.includes('gdp') || e.includes('gross domestic')) return { cat: 'BIP', higherIsGood: true };
  if (e.includes('unemployment') || e.includes('jobless') || e.includes('claims')) return { cat: 'Arbeitsmarkt', higherIsGood: false };
  if (e.includes('payroll') || e.includes('nonfarm') || e.includes('nfp') || e.includes('employment change') || e.includes('employment')) return { cat: 'Arbeitsmarkt', higherIsGood: true };
  if (e.includes('cpi') || e.includes('inflation') || e.includes('ppi') || e.includes('price index')) return { cat: 'Inflation', higherIsGood: true };
  if (e.includes('trade balance') || e.includes('exports') || e.includes('imports') || e.includes('current account')) return { cat: 'Handel', higherIsGood: true };
  return null;
}

// Robustes Parsen: "3.2%" -> 3.2, "250K" -> 250000, "1.2M" -> 1200000
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

/**
 * Extrahiert die jüngsten Makro-Releases (letzte ~21 Tage) je Währung.
 * Nur Events mit erkennbarer Kategorie. Sortiert: neueste zuerst.
 */
export function extractReleases(rawEvents: any[], days = 21): MacroRelease[] {
  if (!Array.isArray(rawEvents)) return [];
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - days);

  const out: MacroRelease[] = [];
  for (const e of rawEvents) {
    const cat = categorize(e.event || e.title || '');
    if (!cat) continue;
    const d = e.date ? new Date(e.date) : null;
    if (!d || isNaN(d.getTime()) || d < from || d > now) continue;

    const ccy = (e.currency || e.country || '').toUpperCase();
    if (!ccy) continue;

    const actual = parseNum(e.actual);
    const forecast = parseNum(e.forecast);
    const previous = parseNum(e.previous);
    const beat = actual !== null && forecast !== null ? Math.sign(actual - forecast) : 0;
    const impactRaw = (e.impact || '').toLowerCase();
    const impact: MacroRelease['impact'] = impactRaw === 'high' ? 'high' : impactRaw === 'medium' ? 'medium' : 'low';

    out.push({
      currency: ccy,
      category: cat.cat,
      event: e.event || e.title || 'Release',
      date: e.date,
      actual, forecast, previous, beat,
      higherIsGood: cat.higherIsGood,
      impact,
    });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}

/** Gruppiert Releases je Währung (DXY = USD). */
export function releasesByCurrency(releases: MacroRelease[]): Record<string, MacroRelease[]> {
  const map: Record<string, MacroRelease[]> = {};
  for (const r of releases) {
    const code = r.currency === 'USD' ? 'USD' : r.currency;
    if (!map[code]) map[code] = [];
    map[code].push(r);
  }
  return map;
}

/** Ob ein Release fundamental stützt (+1), bremst (−1) oder neutral (0) ist. */
export function releaseSupport(r: MacroRelease): number {
  if (r.beat === 0) return 0;
  // beat = actual vs forecast; higherIsGood dreht das Vorzeichen für die Währung
  return r.beat * (r.higherIsGood ? 1 : -1);
}
