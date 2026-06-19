/**
 * ========================================================================
 * Weekly Outlook — Sonntags-Wochenausblick
 * ========================================================================
 * Beantwortet die Frage: "Welche Paare laufen die KOMMENDE Woche
 * wahrscheinlich wie — und warum?"
 *
 * EHRLICH: Die größte *bekannte* Triebkraft einer einzelnen Woche sind
 * terminierte High-Impact-Events (Zinsentscheide, CPI, NFP, GDP). Die
 * Richtung der Überraschung ist NICHT vorhersagbar — aber dass das Event
 * kommt, ist bekannt und verändert das Chance/Risiko-Profil.
 *
 * Daher: fundamentaler Bias (COT-Positionierung + Trend + Zins-Carry)
 *   ×  Event-Risiko der Woche  →  Lean + heuristische Konfidenz + Treiber.
 *
 * Die "Konfidenz" ist eine FAKTOR-CONFLUENCE (wie viele Treiber zeigen in
 * dieselbe Richtung), KEINE backgetestete Trefferquote. Das ehrliche
 * Messen der echten Trefferquote ist Aufgabe des separaten Python-Tests.
 */

import type { CurrencyAnalysis, PairSignal } from './smartCotService';

export interface WeeklyEvent {
  date: string;       // ISO
  weekday: string;    // "Mo", "Di", ...
  currency: string;
  impact: 'high' | 'medium';
  event: string;
  time?: string;
}

export interface WeeklyPairOutlook {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  lean: 'long' | 'short' | 'neutral';
  confidence: number;        // 0-100, heuristische Confluence
  confidenceLabel: string;   // "stark" | "moderat" | "schwach" | "abwarten"
  drivers: string[];         // Klartext, warum
  events: WeeklyEvent[];     // High/Medium-Impact-Events der kommenden Woche
  caution: string | null;    // Warnung bei großem Event-Risiko
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// Welche Kalender-Währung gehört zu welchem COT-Code (DXY = USD)
function matchesCurrency(eventCcy: string, cotCode: string): boolean {
  const e = (eventCcy || '').toUpperCase();
  if (cotCode === 'DXY') return e === 'USD';
  return e === cotCode;
}

// Events der kommenden 8 Tage für eine Währung (high/medium)
function eventsForCurrency(
  allEvents: WeeklyEvent[],
  cotCode: string,
): WeeklyEvent[] {
  return allEvents.filter(e => matchesCurrency(e.currency, cotCode));
}

/**
 * Normalisiert rohe Kalender-Events (aus webApi.fetchEconomicCalendar)
 * auf die kommende Woche, nur high/medium Impact.
 */
export function prepareWeeklyEvents(rawEvents: any[]): WeeklyEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 8);

  const out: WeeklyEvent[] = [];
  for (const e of rawEvents || []) {
    const impact = (e.impact || '').toLowerCase();
    if (impact !== 'high' && impact !== 'medium') continue;
    if (!e.date) continue;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    if (d < today || d > horizon) continue;
    out.push({
      date: e.date,
      weekday: WEEKDAYS[d.getDay()],
      currency: (e.currency || e.country || '').toUpperCase(),
      impact: impact === 'high' ? 'high' : 'medium',
      event: e.event || e.title || 'Event',
      time: e.time,
    });
  }
  // nach Datum sortieren
  out.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  return out;
}

function confidenceLabel(c: number): string {
  if (c >= 70) return 'stark';
  if (c >= 60) return 'moderat';
  if (c >= 53) return 'schwach';
  return 'abwarten';
}

/**
 * Baut den Wochenausblick für alle Pair-Signale.
 */
export function buildWeeklyOutlook(
  analyses: CurrencyAnalysis[],
  pairSignals: PairSignal[],
  weeklyEvents: WeeklyEvent[],
): WeeklyPairOutlook[] {
  const byCode = new Map<string, CurrencyAnalysis>();
  for (const a of analyses) {
    byCode.set(a.currency, a);
    if (a.currency === 'DXY') byCode.set('USD', a);
  }

  const result: WeeklyPairOutlook[] = [];

  for (const sig of pairSignals) {
    const base = byCode.get(sig.baseCurrency);
    const quote = byCode.get(sig.quoteCurrency);

    // Events beider Währungen
    const events = [
      ...eventsForCurrency(weeklyEvents, sig.baseCurrency),
      ...eventsForCurrency(weeklyEvents, sig.quoteCurrency),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const highEvents = events.filter(e => e.impact === 'high');

    // ── Konfidenz aus Confluence ──
    let conf = 45 + Math.min(40, Math.abs(sig.smartScore) * 0.4); // 45..85
    if (sig.momentumAligned) conf += 5;

    // Reversion-Risiko: ist die starke Seite überdehnt? → Bias unsicherer
    const strongSide = sig.direction === 'long' ? base : quote;
    if (strongSide?.isExtreme && strongSide.weeksAtExtreme > 4) conf -= 8;

    // Carry-Bestätigung
    if (base && quote) {
      const carryDiff = base.rateDifferential - quote.rateDifferential;
      const carryAlignsLong = carryDiff > 0.25 && sig.direction === 'long';
      const carryAlignsShort = carryDiff < -0.25 && sig.direction === 'short';
      if (carryAlignsLong || carryAlignsShort) conf += 4;
    }

    // ── Event-Risiko: deckelt die Konfidenz, da Ausgang offen ──
    let caution: string | null = null;
    if (highEvents.length > 0) {
      conf = Math.min(conf, 60);
      const list = highEvents.slice(0, 2).map(e => `${e.event} (${e.currency}, ${e.weekday})`).join(', ');
      caution = `High-Impact diese Woche: ${list}. Ausgang offen — Ausbruch in beide Richtungen möglich. Lieber das Event abwarten oder Risiko klein halten.`;
    }

    conf = Math.max(0, Math.min(85, Math.round(conf)));

    const lean: WeeklyPairOutlook['lean'] = conf < 53 ? 'neutral' : sig.direction;

    // ── Treiber in Klartext ──
    const drivers: string[] = [];
    if (base && quote) {
      // Positionierung
      const strongName = sig.direction === 'long' ? sig.baseCurrency : sig.quoteCurrency;
      const weakName = sig.direction === 'long' ? sig.quoteCurrency : sig.baseCurrency;
      drivers.push(`COT: ${strongName} stärker positioniert als ${weakName} (Score-Differenz ${Math.abs(Math.round(sig.divergenceScore))}).`);

      if (sig.momentumAligned) {
        drivers.push(`Trend bestätigt: Beide Währungen bewegen sich in Richtung ${sig.direction === 'long' ? 'Long' : 'Short'}.`);
      }

      const carryDiff = base.rateDifferential - quote.rateDifferential;
      if (Math.abs(carryDiff) > 0.25) {
        const favored = carryDiff > 0 ? sig.baseCurrency : sig.quoteCurrency;
        drivers.push(`Zins-Carry: ${favored} hat ${Math.abs(carryDiff).toFixed(2)}% Zinsvorteil — ${(carryDiff > 0) === (sig.direction === 'long') ? 'stützt' : 'bremst'} die Idee.`);
      }

      if (strongSide?.isExtreme && strongSide.weeksAtExtreme > 4) {
        drivers.push(`Warnung: ${strongSide.currency} ist seit ${strongSide.weeksAtExtreme} Wochen am Extrem — erhöhtes Rückschlagrisiko.`);
      }
    }

    result.push({
      pair: sig.pair,
      baseCurrency: sig.baseCurrency,
      quoteCurrency: sig.quoteCurrency,
      lean,
      confidence: conf,
      confidenceLabel: confidenceLabel(conf),
      drivers,
      events,
      caution,
    });
  }

  // Sortierung: erst nach Konfidenz (stark zuerst)
  result.sort((a, b) => b.confidence - a.confidence);
  return result;
}
