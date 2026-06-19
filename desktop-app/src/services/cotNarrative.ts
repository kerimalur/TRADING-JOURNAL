/**
 * ========================================================================
 * COT Narrative — Klartext-Generator
 * ========================================================================
 * Übersetzt die rohe CurrencyAnalysis in verständliche deutsche Sätze.
 * Ziel: Der Nutzer soll auf einen Blick verstehen, WAS die Daten aussagen,
 * ohne Fachbegriffe wie "momentum_8w" oder "regime" deuten zu müssen.
 *
 * 3 fundamentale Säulen:
 *   1. Positionierung — Sind die Großhändler (Commercials) long/short, wie extrem?
 *   2. Trend         — Bauen sie ihre Position auf oder ab, beschleunigt sich das?
 *   3. Zins-Carry    — Bietet die Währung Zinsvorteil ggü. dem Rest (Rückenwind)?
 */

import type { CurrencyAnalysis } from './smartCotService';

export type Tone = 'pos' | 'neg' | 'neutral';

export interface NarrativePillar {
  label: string;
  text: string;
  tone: Tone;
}

export interface CurrencyNarrative {
  verdict: 'STARK' | 'SCHWACH' | 'NEUTRAL';
  verdictTone: Tone;
  score: number;          // finalConviction (-100..+100)
  headline: string;       // ein Satz, der alles zusammenfasst
  pillars: NarrativePillar[];
}

// Vollständige Währungsnamen für lesbare Sätze
const FULL_NAME: Record<string, string> = {
  DXY: 'der US-Dollar',
  EUR: 'der Euro',
  GBP: 'das Pfund',
  JPY: 'der Yen',
  CHF: 'der Franken',
  CAD: 'der Kanada-Dollar',
  AUD: 'der Aussie-Dollar',
  NZD: 'der Kiwi-Dollar',
};

function fmtK(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Math.round(n / 1000)}K`;
}

// ── Säule 1: Positionierung ───────────────────────────────────────────
function positionPillar(a: CurrencyAnalysis): NarrativePillar {
  const p = a.currentPercentile;
  const net = a.currentNet;
  const longish = net >= 0;

  let text: string;
  let tone: Tone;

  if (a.isExtreme && a.extremeType === 'overbought') {
    text = `Großhändler extrem long (Netto ${fmtK(net)}, oberstes ${100 - p}% der letzten 52 Wochen). Sehr bullishe Aufstellung — aber bei ${a.weeksAtExtreme}+ Wochen am Extrem steigt das Umkehrrisiko.`;
    tone = 'pos';
  } else if (a.isExtreme && a.extremeType === 'oversold') {
    text = `Großhändler extrem short (Netto ${fmtK(net)}, unterstes ${p}% der letzten 52 Wochen). Sehr bearishe Aufstellung — bei ${a.weeksAtExtreme}+ Wochen am Extrem steigt die Chance auf eine Gegenbewegung.`;
    tone = 'neg';
  } else if (p >= 60) {
    text = `Großhändler sind netto long (${fmtK(net)}, Perzentil ${p}%). Smart Money positioniert sich bullish.`;
    tone = 'pos';
  } else if (p <= 40) {
    text = `Großhändler sind netto short (${fmtK(net)}, Perzentil ${p}%). Smart Money positioniert sich bearish.`;
    tone = 'neg';
  } else {
    text = `Positionierung neutral (Netto ${fmtK(net)}, Perzentil ${p}%). Keine klare Seite des Smart Money.`;
    tone = 'neutral';
  }

  return { label: 'Positionierung', text, tone };
}

// ── Säule 2: Trend der Positionierung ─────────────────────────────────
function trendPillar(a: CurrencyAnalysis): NarrativePillar {
  const sig = a.momentumSignal;

  if (sig === 'accelerating_long') {
    return { label: 'Trend', text: `Die Long-Position wächst beschleunigt — Smart Money kauft zunehmend (4W stärker als 8W).`, tone: 'pos' };
  }
  if (sig === 'long') {
    const since = a.trendDirection === 'accumulating' ? ` seit ${a.trendWeeks} Wochen` : '';
    return { label: 'Trend', text: `Die Position wird ausgebaut${since} — stetiger Kaufdruck.`, tone: 'pos' };
  }
  if (sig === 'accelerating_short') {
    return { label: 'Trend', text: `Die Short-Position wächst beschleunigt — Smart Money verkauft zunehmend (4W stärker als 8W).`, tone: 'neg' };
  }
  if (sig === 'short') {
    const since = a.trendDirection === 'distributing' ? ` seit ${a.trendWeeks} Wochen` : '';
    return { label: 'Trend', text: `Die Position wird abgebaut${since} — stetiger Verkaufsdruck.`, tone: 'neg' };
  }
  return { label: 'Trend', text: `Kein klarer Trend — die Position bewegt sich seitwärts.`, tone: 'neutral' };
}

// ── Säule 3: Zins-Carry ───────────────────────────────────────────────
function carryPillar(a: CurrencyAnalysis): NarrativePillar {
  const d = a.rateDifferential;
  const dir = a.rateTrend === 'hawkish' ? ' Die Notenbank hat zuletzt erhöht (hawkish).'
    : a.rateTrend === 'dovish' ? ' Die Notenbank hat zuletzt gesenkt (dovish).'
    : '';

  if (d > 0.25) {
    return { label: 'Zins-Carry', text: `Zins ${d.toFixed(2)}% über dem G10-Schnitt — attraktiver Carry, Rückenwind für Käufer (Long).${dir}`, tone: 'pos' };
  }
  if (d < -0.25) {
    return { label: 'Zins-Carry', text: `Zins ${d.toFixed(2)}% unter dem G10-Schnitt — Carry-Nachteil, Gegenwind für Käufer.${dir}`, tone: 'neg' };
  }
  if (d === 0 && a.rateTrend === 'neutral') {
    return { label: 'Zins-Carry', text: `Keine Zinsdaten geladen — bei „Refresh & Analyse" werden sie mitgeladen.`, tone: 'neutral' };
  }
  return { label: 'Zins-Carry', text: `Zins nahe dem G10-Schnitt (${d.toFixed(2)}%) — kein klarer Carry-Vorteil.${dir}`, tone: 'neutral' };
}

// ── Gesamt-Befund ─────────────────────────────────────────────────────
export function describeCurrency(a: CurrencyAnalysis): CurrencyNarrative {
  const pillars = [positionPillar(a), trendPillar(a), carryPillar(a)];
  const score = a.finalConviction;

  const verdict: CurrencyNarrative['verdict'] =
    score >= 15 ? 'STARK' : score <= -15 ? 'SCHWACH' : 'NEUTRAL';
  const verdictTone: Tone = score >= 15 ? 'pos' : score <= -15 ? 'neg' : 'neutral';

  const name = FULL_NAME[a.currency] || a.currency;

  // Headline aus den Säulen-Tönen
  const pos = pillars.filter(p => p.tone === 'pos').length;
  const neg = pillars.filter(p => p.tone === 'neg').length;

  let headline: string;
  if (verdict === 'STARK') {
    headline = pos >= 2
      ? `${cap(name)} ist fundamental stark: Smart Money long, ${pos === 3 ? 'Trend und Carry stützen' : 'Trend stützt'}.`
      : `${cap(name)} tendiert bullish — Positionierung überwiegt, aber nicht alle Säulen ziehen mit.`;
  } else if (verdict === 'SCHWACH') {
    headline = neg >= 2
      ? `${cap(name)} ist fundamental schwach: Smart Money short, ${neg === 3 ? 'Trend und Carry drücken' : 'Trend drückt'}.`
      : `${cap(name)} tendiert bearish — Positionierung überwiegt, aber nicht alle Säulen ziehen mit.`;
  } else {
    headline = `${cap(name)} ist fundamental gemischt — kein klares Bild, eher abwarten.`;
  }

  return { verdict, verdictTone, score, headline, pillars };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Pair-Idee als ein Satz ────────────────────────────────────────────
export function describePairIdea(
  pair: string,
  direction: 'long' | 'short',
  baseName: string,
  quoteName: string,
): string {
  const verb = direction === 'long' ? 'kaufen' : 'verkaufen';
  const strong = direction === 'long' ? baseName : quoteName;
  const weak = direction === 'long' ? quoteName : baseName;
  return `${pair} ${verb.toUpperCase()}: ${cap(FULL_NAME[strong] || strong)} ist fundamental stärker als ${FULL_NAME[weak] || weak} — Stärke gegen Schwäche.`;
}
