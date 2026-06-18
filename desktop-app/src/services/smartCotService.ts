/**
 * ========================================================================
 * Smart COT Analysis Engine
 * ========================================================================
 * Analysiert CFTC COT-Daten und berechnet:
 * - Momentum (1W/4W/8W)
 * - Extremzonen + Wochen-an-Extrem
 * - Change of Character (Richtungswechsel)
 * - Spec vs. Commercial Divergenz
 * - Open Interest Trend + Divergenz
 * - Composite Smart Score (-100 bis +100)
 * - Pair-Empfehlungen mit Begründung
 */

import { supabase } from '@/lib/supabase';
import { requireSession } from './supabaseService';

// ============================================================
// TYPES
// ============================================================

export interface COTSnapshot {
  date: string;
  currency: string;
  commercialsLong: number;
  commercialsShort: number;
  commercialsNet: number;
  nonCommercialsLong: number;
  nonCommercialsShort: number;
  nonCommercialsNet: number;
  openInterest: number;
  percentileRank: number;
  signal: COTSignal;
  weeklyChange: number;
}

export type COTSignal = 'strong_long' | 'long' | 'neutral' | 'short' | 'strong_short';
export type MomentumSignal = 'accelerating_long' | 'long' | 'neutral' | 'short' | 'accelerating_short';
export type TrendDirection = 'accumulating' | 'distributing' | 'flat';
export type OITrend = 'rising' | 'falling' | 'flat';

export interface CurrencyAnalysis {
  currency: string;
  currentSignal: COTSignal;
  currentPercentile: number;
  currentNet: number;
  latestDate: string;

  momentum1w: number;
  momentum4w: number;
  momentum8w: number;
  momentumSignal: MomentumSignal;

  isExtreme: boolean;
  extremeType: 'overbought' | 'oversold' | null;
  weeksAtExtreme: number;

  trendDirection: TrendDirection;
  trendWeeks: number;

  cocDetected: boolean;
  cocType: 'long_to_short' | 'short_to_long' | null;
  cocDate: string | null;

  specCommercialDivergence: boolean;
  specCommercialDetail: string | null;

  smartScore: number;

  oiTrend: OITrend;
  oiDivergence: boolean;
}

export interface PairSignal {
  pair: string;
  direction: 'long' | 'short';
  strength: number;
  smartScore: number;
  baseCurrency: string;
  baseSmartScore: number;
  quoteCurrency: string;
  quoteSmartScore: number;
  divergenceScore: number;
  momentumAligned: boolean;
  reasons: PairReason[];
}

export interface PairReason {
  factor: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

// ============================================================
// CONSTANTS
// ============================================================

const SMART_COT_CURRENCIES = ['DXY', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF'];

const FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'AUD/USD', 'NZD/USD',
  'USD/JPY', 'USD/CAD', 'USD/CHF',
  'EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/NZD', 'EUR/CAD', 'EUR/CHF',
  'GBP/JPY', 'GBP/AUD', 'GBP/NZD', 'GBP/CAD', 'GBP/CHF',
  'AUD/JPY', 'AUD/NZD', 'AUD/CAD', 'AUD/CHF',
  'NZD/JPY', 'NZD/CAD', 'NZD/CHF',
  'CAD/JPY', 'CAD/CHF',
  'CHF/JPY',
];

// ============================================================
// PERSISTENCE — Snapshots speichern & laden
// ============================================================

export async function saveSnapshots(snapshots: COTSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;
  const user = await requireSession();

  const payloads = snapshots.map(s => ({
    user_id: user.id,
    date: s.date,
    currency: s.currency,
    commercials_long: s.commercialsLong,
    commercials_short: s.commercialsShort,
    commercials_net: s.commercialsNet,
    non_commercials_long: s.nonCommercialsLong,
    non_commercials_short: s.nonCommercialsShort,
    non_commercials_net: s.nonCommercialsNet,
    open_interest: s.openInterest,
    percentile_rank: s.percentileRank,
    signal: s.signal,
    weekly_change: s.weeklyChange,
  }));

  const { error } = await supabase
    .from('cot_snapshots')
    .upsert(payloads, { onConflict: 'user_id,date,currency' });

  if (error) throw error;
}

export async function loadSnapshots(currency?: string): Promise<COTSnapshot[]> {
  const user = await requireSession();

  let query = supabase
    .from('cot_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true });

  if (currency) {
    query = query.eq('currency', currency);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(row => ({
    date: row.date,
    currency: row.currency,
    commercialsLong: Number(row.commercials_long),
    commercialsShort: Number(row.commercials_short),
    commercialsNet: Number(row.commercials_net),
    nonCommercialsLong: Number(row.non_commercials_long),
    nonCommercialsShort: Number(row.non_commercials_short),
    nonCommercialsNet: Number(row.non_commercials_net),
    openInterest: Number(row.open_interest),
    percentileRank: Number(row.percentile_rank),
    signal: row.signal as COTSignal,
    weeklyChange: Number(row.weekly_change),
  }));
}

// ============================================================
// ANALYSIS ENGINE — Smart COT Berechnung
// ============================================================

export function analyzeCurrency(
  currency: string,
  history: COTSnapshot[],
): CurrencyAnalysis {
  const sorted = [...history]
    .filter(s => s.currency === currency)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    return emptyAnalysis(currency);
  }

  const latest = sorted[sorted.length - 1];
  const nets = sorted.map(s => s.commercialsNet);

  // --- Percentile ---
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  const range = max - min;
  const percentile = range > 0
    ? Math.round(((latest.commercialsNet - min) / range) * 100)
    : 50;

  const signal = percentileToSignal(percentile);

  // --- Momentum ---
  const momentum1w = getMomentum(nets, 1);
  const momentum4w = getMomentum(nets, 4);
  const momentum8w = getMomentum(nets, 8);
  const momentumSignal = computeMomentumSignal(momentum4w, momentum8w);

  // --- Extremzonen ---
  const isExtreme = percentile >= 80 || percentile <= 20;
  const extremeType = percentile >= 80 ? 'overbought' as const
    : percentile <= 20 ? 'oversold' as const
    : null;
  const weeksAtExtreme = countWeeksAtExtreme(sorted);

  // --- Trend ---
  const { direction: trendDirection, weeks: trendWeeks } = computeTrend(sorted);

  // --- Change of Character ---
  const coc = detectChangeOfCharacter(sorted);

  // --- Spec vs. Commercial Divergenz ---
  const specDiv = detectSpecDivergence(latest);

  // --- Open Interest ---
  const oiTrend = computeOITrend(sorted);
  const oiDivergence = detectOIDivergence(sorted);

  // --- Smart Score ---
  const smartScore = computeSmartScore({
    percentile,
    momentum4w,
    momentum8w,
    momentumSignal,
    isExtreme,
    extremeType,
    weeksAtExtreme,
    trendDirection,
    trendWeeks,
    cocDetected: coc.detected,
    specDivergence: specDiv.divergence,
    oiDivergence,
    nets,
  });

  return {
    currency,
    currentSignal: signal,
    currentPercentile: percentile,
    currentNet: latest.commercialsNet,
    latestDate: latest.date,
    momentum1w,
    momentum4w,
    momentum8w,
    momentumSignal,
    isExtreme,
    extremeType,
    weeksAtExtreme,
    trendDirection,
    trendWeeks,
    cocDetected: coc.detected,
    cocType: coc.type,
    cocDate: coc.date,
    specCommercialDivergence: specDiv.divergence,
    specCommercialDetail: specDiv.detail,
    smartScore,
    oiTrend,
    oiDivergence,
  };
}

export function generatePairSignals(
  analyses: CurrencyAnalysis[],
): PairSignal[] {
  const byCode = new Map<string, CurrencyAnalysis>();
  for (const a of analyses) {
    byCode.set(a.currency, a);
    if (a.currency === 'DXY') byCode.set('USD', a);
  }

  const signals: PairSignal[] = [];

  for (const pair of FOREX_PAIRS) {
    const [baseCode, quoteCode] = pair.split('/');
    const base = byCode.get(baseCode);
    const quote = byCode.get(quoteCode);
    if (!base || !quote) continue;

    const divergence = base.smartScore - quote.smartScore;
    const absDivergence = Math.abs(divergence);

    if (absDivergence < 15) continue;

    const direction: 'long' | 'short' = divergence > 0 ? 'long' : 'short';
    const strength = Math.min(5, Math.floor(absDivergence / 20) + 1);

    const momentumAligned = direction === 'long'
      ? isLongMomentum(base.momentumSignal) && isShortMomentum(quote.momentumSignal)
      : isShortMomentum(base.momentumSignal) && isLongMomentum(quote.momentumSignal);

    const reasons = buildReasons(base, quote, direction, momentumAligned);

    const smartScore = Math.round(divergence * (momentumAligned ? 1.3 : 1.0));

    signals.push({
      pair,
      direction,
      strength,
      smartScore: Math.max(-100, Math.min(100, smartScore)),
      baseCurrency: baseCode,
      baseSmartScore: base.smartScore,
      quoteCurrency: quoteCode,
      quoteSmartScore: quote.smartScore,
      divergenceScore: divergence,
      momentumAligned,
      reasons,
    });
  }

  signals.sort((a, b) => Math.abs(b.smartScore) - Math.abs(a.smartScore));
  return signals;
}

// ============================================================
// FULL REFRESH — Analyse + Persistenz
// ============================================================

export async function runSmartCOTAnalysis(
  allSnapshots: COTSnapshot[],
): Promise<{ analyses: CurrencyAnalysis[]; pairSignals: PairSignal[] }> {
  const analyses = SMART_COT_CURRENCIES.map(ccy =>
    analyzeCurrency(ccy, allSnapshots)
  );

  const pairSignals = generatePairSignals(analyses);

  // Persist to Supabase (fire & forget, don't block UI)
  persistAnalyses(analyses).catch(console.error);
  persistPairSignals(pairSignals).catch(console.error);

  return { analyses, pairSignals };
}

async function persistAnalyses(analyses: CurrencyAnalysis[]): Promise<void> {
  const user = await requireSession();

  const payloads = analyses
    .filter(a => a.latestDate)
    .map(a => ({
      user_id: user.id,
      currency: a.currency,
      current_signal: a.currentSignal,
      current_percentile: a.currentPercentile,
      current_net: a.currentNet,
      latest_date: a.latestDate,
      momentum_1w: a.momentum1w,
      momentum_4w: a.momentum4w,
      momentum_8w: a.momentum8w,
      momentum_signal: a.momentumSignal,
      is_extreme: a.isExtreme,
      extreme_type: a.extremeType,
      weeks_at_extreme: a.weeksAtExtreme,
      trend_direction: a.trendDirection,
      trend_weeks: a.trendWeeks,
      coc_detected: a.cocDetected,
      coc_type: a.cocType,
      coc_date: a.cocDate,
      spec_commercial_divergence: a.specCommercialDivergence,
      spec_commercial_detail: a.specCommercialDetail,
      smart_score: a.smartScore,
      oi_trend: a.oiTrend,
      oi_divergence: a.oiDivergence,
    }));

  if (payloads.length === 0) return;

  const { error } = await supabase
    .from('cot_currency_analysis')
    .upsert(payloads, { onConflict: 'user_id,currency' });

  if (error) console.error('Smart COT analysis persist error:', error);
}

async function persistPairSignals(signals: PairSignal[]): Promise<void> {
  const user = await requireSession();

  const payloads = signals.map(s => ({
    user_id: user.id,
    pair: s.pair,
    direction: s.direction,
    strength: s.strength,
    smart_score: s.smartScore,
    base_currency: s.baseCurrency,
    base_smart_score: s.baseSmartScore,
    quote_currency: s.quoteCurrency,
    quote_smart_score: s.quoteSmartScore,
    divergence_score: s.divergenceScore,
    momentum_aligned: s.momentumAligned,
    reasons: s.reasons,
  }));

  if (payloads.length === 0) return;

  const { error } = await supabase
    .from('cot_pair_signals')
    .upsert(payloads, { onConflict: 'user_id,pair' });

  if (error) console.error('Smart COT pair signals persist error:', error);
}

export async function loadCachedAnalyses(): Promise<CurrencyAnalysis[]> {
  const user = await requireSession();

  const { data, error } = await supabase
    .from('cot_currency_analysis')
    .select('*')
    .eq('user_id', user.id);

  if (error || !data) return [];

  return data.map(row => ({
    currency: row.currency,
    currentSignal: row.current_signal,
    currentPercentile: Number(row.current_percentile),
    currentNet: Number(row.current_net),
    latestDate: row.latest_date,
    momentum1w: Number(row.momentum_1w),
    momentum4w: Number(row.momentum_4w),
    momentum8w: Number(row.momentum_8w),
    momentumSignal: row.momentum_signal,
    isExtreme: row.is_extreme,
    extremeType: row.extreme_type,
    weeksAtExtreme: row.weeks_at_extreme,
    trendDirection: row.trend_direction,
    trendWeeks: row.trend_weeks,
    cocDetected: row.coc_detected,
    cocType: row.coc_type,
    cocDate: row.coc_date,
    specCommercialDivergence: row.spec_commercial_divergence,
    specCommercialDetail: row.spec_commercial_detail,
    smartScore: row.smart_score,
    oiTrend: row.oi_trend,
    oiDivergence: row.oi_divergence,
  }));
}

export async function loadCachedPairSignals(): Promise<PairSignal[]> {
  const user = await requireSession();

  const { data, error } = await supabase
    .from('cot_pair_signals')
    .select('*')
    .eq('user_id', user.id)
    .order('smart_score', { ascending: false });

  if (error || !data) return [];

  return data.map(row => ({
    pair: row.pair,
    direction: row.direction,
    strength: row.strength,
    smartScore: row.smart_score,
    baseCurrency: row.base_currency,
    baseSmartScore: row.base_smart_score,
    quoteCurrency: row.quote_currency,
    quoteSmartScore: row.quote_smart_score,
    divergenceScore: row.divergence_score,
    momentumAligned: row.momentum_aligned,
    reasons: row.reasons || [],
  }));
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

function emptyAnalysis(currency: string): CurrencyAnalysis {
  return {
    currency,
    currentSignal: 'neutral',
    currentPercentile: 50,
    currentNet: 0,
    latestDate: '',
    momentum1w: 0,
    momentum4w: 0,
    momentum8w: 0,
    momentumSignal: 'neutral',
    isExtreme: false,
    extremeType: null,
    weeksAtExtreme: 0,
    trendDirection: 'flat',
    trendWeeks: 0,
    cocDetected: false,
    cocType: null,
    cocDate: null,
    specCommercialDivergence: false,
    specCommercialDetail: null,
    smartScore: 0,
    oiTrend: 'flat',
    oiDivergence: false,
  };
}

function percentileToSignal(p: number): COTSignal {
  if (p >= 80) return 'strong_long';
  if (p >= 60) return 'long';
  if (p <= 20) return 'strong_short';
  if (p <= 40) return 'short';
  return 'neutral';
}

function getMomentum(nets: number[], weeks: number): number {
  if (nets.length < weeks + 1) return 0;
  return nets[nets.length - 1] - nets[nets.length - 1 - weeks];
}

function computeMomentumSignal(m4w: number, m8w: number): MomentumSignal {
  if (m4w === 0 && m8w === 0) return 'neutral';

  const m4Abs = Math.abs(m4w);
  const m8Abs = Math.abs(m8w);

  if (m4w > 0 && m8w > 0) {
    return m4Abs > m8Abs * 0.6 ? 'accelerating_long' : 'long';
  }
  if (m4w < 0 && m8w < 0) {
    return m4Abs > m8Abs * 0.6 ? 'accelerating_short' : 'short';
  }

  if (m4w > 0) return 'long';
  if (m4w < 0) return 'short';
  return 'neutral';
}

function countWeeksAtExtreme(sorted: COTSnapshot[]): number {
  if (sorted.length === 0) return 0;
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i].percentileRank;
    if (p >= 80 || p <= 20) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function computeTrend(sorted: COTSnapshot[]): { direction: TrendDirection; weeks: number } {
  if (sorted.length < 3) return { direction: 'flat', weeks: 0 };

  let consecutiveUp = 0;
  let consecutiveDown = 0;

  for (let i = sorted.length - 1; i >= 1; i--) {
    const diff = sorted[i].commercialsNet - sorted[i - 1].commercialsNet;
    if (diff > 0) {
      if (consecutiveDown > 0) break;
      consecutiveUp++;
    } else if (diff < 0) {
      if (consecutiveUp > 0) break;
      consecutiveDown++;
    } else {
      break;
    }
  }

  if (consecutiveUp >= 3) return { direction: 'accumulating', weeks: consecutiveUp };
  if (consecutiveDown >= 3) return { direction: 'distributing', weeks: consecutiveDown };
  return { direction: 'flat', weeks: 0 };
}

function detectChangeOfCharacter(sorted: COTSnapshot[]): {
  detected: boolean;
  type: 'long_to_short' | 'short_to_long' | null;
  date: string | null;
} {
  if (sorted.length < 4) return { detected: false, type: null, date: null };

  // Check last 8 weeks for a net-position zero-cross
  const recent = sorted.slice(-8);
  for (let i = recent.length - 1; i >= 1; i--) {
    const curr = recent[i].commercialsNet;
    const prev = recent[i - 1].commercialsNet;

    if (prev >= 0 && curr < 0) {
      return { detected: true, type: 'long_to_short', date: recent[i].date };
    }
    if (prev <= 0 && curr > 0) {
      return { detected: true, type: 'short_to_long', date: recent[i].date };
    }
  }

  // Check for extreme reversal (percentile flip from >75 to <25 or vice versa within 4 weeks)
  if (sorted.length >= 4) {
    const last = sorted[sorted.length - 1];
    const fourAgo = sorted[sorted.length - 4];
    if (fourAgo.percentileRank >= 75 && last.percentileRank <= 25) {
      return { detected: true, type: 'long_to_short', date: last.date };
    }
    if (fourAgo.percentileRank <= 25 && last.percentileRank >= 75) {
      return { detected: true, type: 'short_to_long', date: last.date };
    }
  }

  return { detected: false, type: null, date: null };
}

function detectSpecDivergence(latest: COTSnapshot): {
  divergence: boolean;
  detail: string | null;
} {
  const commDir = latest.commercialsNet > 0 ? 'long' : latest.commercialsNet < 0 ? 'short' : 'neutral';
  const specDir = latest.nonCommercialsNet > 0 ? 'long' : latest.nonCommercialsNet < 0 ? 'short' : 'neutral';

  if (commDir !== 'neutral' && specDir !== 'neutral' && commDir !== specDir) {
    return {
      divergence: true,
      detail: `Commercials ${commDir.toUpperCase()}, Spekulanten ${specDir.toUpperCase()} → Smart Money weicht ab`,
    };
  }

  return { divergence: false, detail: null };
}

function computeOITrend(sorted: COTSnapshot[]): OITrend {
  if (sorted.length < 4) return 'flat';

  const recent4 = sorted.slice(-4);
  let rising = 0;
  let falling = 0;

  for (let i = 1; i < recent4.length; i++) {
    if (recent4[i].openInterest > recent4[i - 1].openInterest) rising++;
    else if (recent4[i].openInterest < recent4[i - 1].openInterest) falling++;
  }

  if (rising >= 3) return 'rising';
  if (falling >= 3) return 'falling';
  return 'flat';
}

function detectOIDivergence(sorted: COTSnapshot[]): boolean {
  if (sorted.length < 4) return false;

  const recent4 = sorted.slice(-4);
  const netRising = recent4[recent4.length - 1].commercialsNet > recent4[0].commercialsNet;
  const oiFalling = recent4[recent4.length - 1].openInterest < recent4[0].openInterest;

  return netRising && oiFalling;
}

function computeSmartScore(params: {
  percentile: number;
  momentum4w: number;
  momentum8w: number;
  momentumSignal: MomentumSignal;
  isExtreme: boolean;
  extremeType: 'overbought' | 'oversold' | null;
  weeksAtExtreme: number;
  trendDirection: TrendDirection;
  trendWeeks: number;
  cocDetected: boolean;
  specDivergence: boolean;
  oiDivergence: boolean;
  nets: number[];
}): number {
  let score = 0;

  // 1. Percentile-basierter Basis-Score (-40 bis +40)
  score += Math.round((params.percentile - 50) * 0.8);

  // 2. Momentum-Bonus (-25 bis +25)
  const momBonus = params.momentumSignal === 'accelerating_long' ? 25
    : params.momentumSignal === 'long' ? 15
    : params.momentumSignal === 'accelerating_short' ? -25
    : params.momentumSignal === 'short' ? -15
    : 0;
  score += momBonus;

  // 3. Trend-Bonus (-15 bis +15)
  if (params.trendDirection === 'accumulating') {
    score += Math.min(15, params.trendWeeks * 3);
  } else if (params.trendDirection === 'distributing') {
    score -= Math.min(15, params.trendWeeks * 3);
  }

  // 4. Extreme-Warnung: Extremzonen >4 Wochen → Abschwächung (Reversion-Risiko)
  if (params.isExtreme && params.weeksAtExtreme > 4) {
    const penalty = Math.min(10, (params.weeksAtExtreme - 4) * 3);
    score += params.extremeType === 'overbought' ? -penalty : penalty;
  }

  // 5. Change of Character → starker Impuls
  if (params.cocDetected) {
    score += score > 0 ? 10 : -10;
  }

  // 6. Spec-Commercial-Divergenz → Bestätigung (Smart Money vs. Herde)
  if (params.specDivergence) {
    score += score > 0 ? 5 : -5;
  }

  // 7. OI-Divergenz → Schwäche-Signal
  if (params.oiDivergence) {
    score = Math.round(score * 0.85);
  }

  return Math.max(-100, Math.min(100, Math.round(score)));
}

function isLongMomentum(signal: MomentumSignal): boolean {
  return signal === 'long' || signal === 'accelerating_long';
}

function isShortMomentum(signal: MomentumSignal): boolean {
  return signal === 'short' || signal === 'accelerating_short';
}

function buildReasons(
  base: CurrencyAnalysis,
  quote: CurrencyAnalysis,
  direction: 'long' | 'short',
  momentumAligned: boolean,
): PairReason[] {
  const reasons: PairReason[] = [];

  // Smart Score Divergenz
  reasons.push({
    factor: 'smart_score',
    description: `${base.currency}: ${base.smartScore > 0 ? '+' : ''}${base.smartScore} | ${quote.currency}: ${quote.smartScore > 0 ? '+' : ''}${quote.smartScore}`,
    impact: Math.abs(base.smartScore - quote.smartScore) >= 40 ? 'positive' : 'neutral',
  });

  // Momentum
  if (momentumAligned) {
    reasons.push({
      factor: 'momentum',
      description: `Momentum beider Währungen unterstützt ${direction.toUpperCase()}-Richtung`,
      impact: 'positive',
    });
  }

  // Extremzonen
  if (base.isExtreme || quote.isExtreme) {
    const parts: string[] = [];
    if (base.isExtreme) parts.push(`${base.currency} ${base.extremeType === 'overbought' ? 'überkauft' : 'überverkauft'}`);
    if (quote.isExtreme) parts.push(`${quote.currency} ${quote.extremeType === 'overbought' ? 'überkauft' : 'überverkauft'}`);
    reasons.push({
      factor: 'extreme',
      description: parts.join(', '),
      impact: 'positive',
    });
  }

  // Change of Character
  if (base.cocDetected) {
    reasons.push({
      factor: 'coc',
      description: `${base.currency}: Change of Character (${base.cocType === 'short_to_long' ? 'Short→Long' : 'Long→Short'})`,
      impact: 'positive',
    });
  }
  if (quote.cocDetected) {
    reasons.push({
      factor: 'coc',
      description: `${quote.currency}: Change of Character (${quote.cocType === 'short_to_long' ? 'Short→Long' : 'Long→Short'})`,
      impact: 'positive',
    });
  }

  // Spec vs. Commercial Divergenz
  if (base.specCommercialDivergence) {
    reasons.push({
      factor: 'spec_divergence',
      description: `${base.currency}: ${base.specCommercialDetail}`,
      impact: 'positive',
    });
  }

  // Trend
  if (base.trendDirection !== 'flat') {
    reasons.push({
      factor: 'trend',
      description: `${base.currency}: ${base.trendDirection === 'accumulating' ? 'Aufbau' : 'Abbau'} seit ${base.trendWeeks} Wochen`,
      impact: base.trendDirection === 'accumulating' && direction === 'long' ? 'positive'
        : base.trendDirection === 'distributing' && direction === 'short' ? 'positive'
        : 'negative',
    });
  }

  return reasons;
}
