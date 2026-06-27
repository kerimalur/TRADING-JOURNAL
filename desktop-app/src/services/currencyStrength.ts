/**
 * ========================================================================
 * Währungsstärke-Engine (intern für Outlook)
 * ========================================================================
 * Berechnet pro Währung eine fundamentale Stärke/Bias aus:
 *   - COT-Positionierung (Commercial-Net-Perzentil)
 *   - Zins-Differenz (Carry)
 *   - Saisonalität
 * Speist ausschließlich den Outlook (Bias-Anzeige + Herkunfts-Tabelle).
 * Hat KEINE eigene Seite/Navigation mehr.
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

  // v2: Spec Crowding
  specNet: number;
  specPercentile: number;
  specCrowdingExtreme: boolean;
  specCrowdingType: 'crowded_long' | 'crowded_short' | null;

  // v2: Saisonalität
  seasonalBias: 'bullish' | 'bearish' | 'neutral';
  seasonalStrength: number;

  // v2: Zinsdifferenz
  rateDifferential: number;
  rateTrend: 'hawkish' | 'dovish' | 'neutral';
  rateCotConfluence: boolean;

  // v2: Regime
  regime: 'trending_bullish' | 'trending_bearish' | 'ranging' | 'transitioning';
  regimeConfidence: number;

  // v2: Historical Performance
  historicalWinRate: number | null;
  historicalAvgWeeks: number | null;
  historicalSampleSize: number;

  // v2: ML / KNN
  similarSetups: SimilarSetup[];
  mlDirection: 'bullish' | 'bearish' | 'neutral';
  mlConfidence: number;

  // v2: Final Conviction
  finalConviction: number;
}

export interface SimilarSetup {
  date: string;
  percentile: number;
  momentum: number;
  outcome4w: number;
  outcome8w: number;
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

// Saisonale Bias-Daten pro Währung pro Monat (1=Jan, 12=Dez)
// Basierend auf 20-Jahres-Saisonalitäts-Studien von Kathy Lien, BK Asset Management
// Werte: -2=stark bearish, -1=bearish, 0=neutral, 1=bullish, 2=stark bullish
const SEASONAL_PATTERNS: Record<string, number[]> = {
  DXY: [ 1,  1,  0, -1, -1,  0,  1,  1,  0, -1,  0,  1],  // Jan-Dez
  EUR: [-1, -1,  0,  1,  1,  0, -1, -1,  0,  1,  0, -1],
  GBP: [ 1,  0, -1,  1,  0, -1,  0,  0,  1,  0, -1,  0],
  JPY: [ 1,  0, -1, -1,  0,  1,  1,  0, -1,  0,  1,  2],
  CAD: [ 0,  0,  1,  1,  0, -1, -1,  0,  0,  1,  0,  0],
  AUD: [ 1,  0,  0,  1,  0, -1, -1,  0,  0,  1,  1,  0],
  NZD: [ 1,  0,  0,  1,  0, -1, -1,  0,  0,  1,  1,  0],
  CHF: [ 0,  0,  0,  0,  1,  1,  0,  0, -1, -1,  0,  0],
};

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
// ANALYSIS ENGINE — Währungsstärke-Berechnung
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

  // --- Smart Score (v1) ---
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

  // --- v2: Spec Crowding ---
  const specCrowding = analyzeSpecCrowding(sorted);

  // --- v2: Saisonalität ---
  const seasonal = analyzeSeasonal(currency, latest.date);

  // --- v2: Zinsdifferenz ---
  const rateDiff = analyzeRateDifferential(currency);

  // --- v2: Regime ---
  const regime = detectRegime(sorted, percentile, momentumSignal);

  // --- v2: Historical Win Rate ---
  const historical = computeHistoricalPerformance(sorted, percentile, momentum4w);

  // --- v2: KNN Pattern Matching ---
  const knn = knnPatternMatch(sorted, percentile, momentum4w, momentum8w);

  // --- v2: Final Conviction ---
  const finalConviction = computeFinalConviction({
    smartScore,
    specCrowding,
    seasonal,
    rateDiff,
    regime,
    historical,
    knn,
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
    // v2
    specNet: specCrowding.specNet,
    specPercentile: specCrowding.specPercentile,
    specCrowdingExtreme: specCrowding.extreme,
    specCrowdingType: specCrowding.type,
    seasonalBias: seasonal.bias,
    seasonalStrength: seasonal.strength,
    rateDifferential: rateDiff.differential,
    rateTrend: rateDiff.trend,
    rateCotConfluence: rateDiff.cotConfluence,
    regime: regime.type,
    regimeConfidence: regime.confidence,
    historicalWinRate: historical.winRate,
    historicalAvgWeeks: historical.avgWeeks,
    historicalSampleSize: historical.sampleSize,
    similarSetups: knn.setups,
    mlDirection: knn.direction,
    mlConfidence: knn.confidence,
    finalConviction,
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

export async function runStrengthAnalysis(
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
      // v2
      spec_net: a.specNet,
      spec_percentile: a.specPercentile,
      spec_crowding_extreme: a.specCrowdingExtreme,
      spec_crowding_type: a.specCrowdingType,
      seasonal_bias: a.seasonalBias,
      seasonal_strength: a.seasonalStrength,
      rate_differential: a.rateDifferential,
      rate_trend: a.rateTrend,
      rate_cot_confluence: a.rateCotConfluence,
      regime: a.regime,
      regime_confidence: a.regimeConfidence,
      historical_win_rate: a.historicalWinRate,
      historical_avg_weeks: a.historicalAvgWeeks,
      historical_sample_size: a.historicalSampleSize,
      similar_setups: a.similarSetups,
      ml_direction: a.mlDirection,
      ml_confidence: a.mlConfidence,
      final_conviction: a.finalConviction,
    }));

  if (payloads.length === 0) return;

  const { error } = await supabase
    .from('cot_currency_analysis')
    .upsert(payloads, { onConflict: 'user_id,currency' });

  if (error) console.error('Strength analysis persist error:', error);
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

  if (error) console.error('Strength pair signals persist error:', error);
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
    // v2
    specNet: Number(row.spec_net ?? 0),
    specPercentile: Number(row.spec_percentile ?? 50),
    specCrowdingExtreme: row.spec_crowding_extreme ?? false,
    specCrowdingType: row.spec_crowding_type ?? null,
    seasonalBias: row.seasonal_bias ?? 'neutral',
    seasonalStrength: row.seasonal_strength ?? 0,
    rateDifferential: Number(row.rate_differential ?? 0),
    rateTrend: row.rate_trend ?? 'neutral',
    rateCotConfluence: row.rate_cot_confluence ?? false,
    regime: row.regime ?? 'ranging',
    regimeConfidence: row.regime_confidence ?? 0,
    historicalWinRate: row.historical_win_rate != null ? Number(row.historical_win_rate) : null,
    historicalAvgWeeks: row.historical_avg_weeks,
    historicalSampleSize: row.historical_sample_size ?? 0,
    similarSetups: row.similar_setups ?? [],
    mlDirection: row.ml_direction ?? 'neutral',
    mlConfidence: Number(row.ml_confidence ?? 0),
    finalConviction: row.final_conviction ?? 0,
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
    specNet: 0,
    specPercentile: 50,
    specCrowdingExtreme: false,
    specCrowdingType: null,
    seasonalBias: 'neutral',
    seasonalStrength: 0,
    rateDifferential: 0,
    rateTrend: 'neutral',
    rateCotConfluence: false,
    regime: 'ranging',
    regimeConfidence: 0,
    historicalWinRate: null,
    historicalAvgWeeks: null,
    historicalSampleSize: 0,
    similarSetups: [],
    mlDirection: 'neutral',
    mlConfidence: 0,
    finalConviction: 0,
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

  // v2: Spec Crowding
  if (base.specCrowdingExtreme || quote.specCrowdingExtreme) {
    const parts: string[] = [];
    if (base.specCrowdingExtreme) parts.push(`${base.currency} Specs ${base.specCrowdingType === 'crowded_long' ? 'überfüllt long' : 'überfüllt short'}`);
    if (quote.specCrowdingExtreme) parts.push(`${quote.currency} Specs ${quote.specCrowdingType === 'crowded_long' ? 'überfüllt long' : 'überfüllt short'}`);
    reasons.push({ factor: 'spec_crowding', description: parts.join(', '), impact: 'positive' });
  }

  // v2: Seasonality
  if (base.seasonalBias !== 'neutral' || quote.seasonalBias !== 'neutral') {
    const parts: string[] = [];
    if (base.seasonalBias !== 'neutral') parts.push(`${base.currency} saisonal ${base.seasonalBias}`);
    if (quote.seasonalBias !== 'neutral') parts.push(`${quote.currency} saisonal ${quote.seasonalBias}`);
    const aligned = (direction === 'long' && base.seasonalBias === 'bullish') ||
                    (direction === 'short' && base.seasonalBias === 'bearish');
    reasons.push({ factor: 'seasonal', description: parts.join(', '), impact: aligned ? 'positive' : 'negative' });
  }

  // v2: ML
  if (base.mlConfidence >= 60 || quote.mlConfidence >= 60) {
    reasons.push({
      factor: 'ml',
      description: `KNN: ${base.currency} ${base.mlDirection} (${base.mlConfidence}%) | ${quote.currency} ${quote.mlDirection} (${quote.mlConfidence}%)`,
      impact: 'positive',
    });
  }

  return reasons;
}


// ============================================================
// v2: SPEC CROWDING ANALYSIS
// ============================================================

function analyzeSpecCrowding(sorted: COTSnapshot[]): {
  specNet: number;
  specPercentile: number;
  extreme: boolean;
  type: 'crowded_long' | 'crowded_short' | null;
} {
  if (sorted.length === 0) {
    return { specNet: 0, specPercentile: 50, extreme: false, type: null };
  }

  const latest = sorted[sorted.length - 1];
  const specNets = sorted.map(s => s.nonCommercialsNet);

  const min = Math.min(...specNets);
  const max = Math.max(...specNets);
  const range = max - min;
  const specPercentile = range > 0
    ? Math.round(((latest.nonCommercialsNet - min) / range) * 100)
    : 50;

  const extreme = specPercentile >= 85 || specPercentile <= 15;
  const type = specPercentile >= 85 ? 'crowded_long' as const
    : specPercentile <= 15 ? 'crowded_short' as const
    : null;

  return {
    specNet: latest.nonCommercialsNet,
    specPercentile,
    extreme,
    type,
  };
}

// ============================================================
// v2: SEASONAL ANALYSIS
// ============================================================

function analyzeSeasonal(currency: string, dateStr: string): {
  bias: 'bullish' | 'bearish' | 'neutral';
  strength: number;
} {
  const pattern = SEASONAL_PATTERNS[currency];
  if (!pattern || !dateStr) return { bias: 'neutral', strength: 0 };

  const month = new Date(dateStr).getMonth(); // 0-11
  const value = pattern[month];

  const bias = value > 0 ? 'bullish' as const
    : value < 0 ? 'bearish' as const
    : 'neutral' as const;

  const strength = Math.abs(value) * 50; // 0, 50, 100

  return { bias, strength };
}

// ============================================================
// v2: INTEREST RATE DIFFERENTIAL
// ============================================================

// Liest die Zinssätze, die webApi.fetchInterestRates() bzw. die Electron-App
// unter 'trading-journal-interest-rates-cache' ablegen.
// Struktur: { data: { USD: { rate, change }, EUR: {...}, ... }, timestamp }
// Rückgabe: Carry-Differenz dieser Währung vs. Durchschnitt aller anderen G10.
function analyzeRateDifferential(currency: string): {
  differential: number;
  trend: 'hawkish' | 'dovish' | 'neutral';
  cotConfluence: boolean;
} {
  try {
    const rates = readInterestRates();
    if (!rates) return { differential: 0, trend: 'neutral', cotConfluence: false };

    // DXY repräsentiert USD
    const code = currency === 'DXY' ? 'USD' : currency;
    const self = rates[code];
    if (!self) return { differential: 0, trend: 'neutral', cotConfluence: false };

    const selfRate = self.rate;

    // Durchschnitt der ÜBRIGEN Währungen (Carry-Vergleich)
    const others = Object.entries(rates)
      .filter(([c]) => c !== code)
      .map(([, r]) => r.rate);
    const avgOthers = others.length > 0
      ? others.reduce((s, v) => s + v, 0) / others.length
      : 0;

    // Positiv = höherer Zins als der Rest → attraktiver Carry → bullish-Bias
    const differential = Math.round((selfRate - avgOthers) * 100) / 100;

    // Trend kommt aus der Richtung der letzten Zinsentscheidung (change-Feld)
    const trend: 'hawkish' | 'dovish' | 'neutral' =
      self.change === 'up' ? 'hawkish' :
      self.change === 'down' ? 'dovish' :
      'neutral';

    // Carry positiv = Rückenwind für Long-Bias dieser Währung
    const cotConfluence = differential > 0.25;

    return { differential, trend, cotConfluence };
  } catch {
    return { differential: 0, trend: 'neutral', cotConfluence: false };
  }
}

// Robustes Einlesen der Zinssätze aus localStorage (mehrere mögliche Keys/Formate)
function readInterestRates(): Record<string, { rate: number; change?: string }> | null {
  const KEYS = ['trading-journal-interest-rates-cache', 'interestRatesData'];
  for (const key of KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      // Format A: { data: { USD: {rate}, ... }, timestamp }
      const obj = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      if (!obj || typeof obj !== 'object') continue;

      const out: Record<string, { rate: number; change?: string }> = {};
      for (const [c, v] of Object.entries(obj as Record<string, any>)) {
        const rate = typeof v === 'object' ? parseFloat(v.rate) : parseFloat(v as any);
        if (!isNaN(rate)) out[c.toUpperCase()] = { rate, change: (v as any)?.change };
      }
      if (Object.keys(out).length > 0) return out;
    } catch {
      /* try next key */
    }
  }
  return null;
}

// ============================================================
// v2: REGIME DETECTION
// ============================================================

function detectRegime(
  sorted: COTSnapshot[],
  _percentile: number,
  _momentumSignal: MomentumSignal,
): { type: 'trending_bullish' | 'trending_bearish' | 'ranging' | 'transitioning'; confidence: number } {
  if (sorted.length < 12) return { type: 'ranging', confidence: 0 };

  const recent12 = sorted.slice(-12);
  const nets = recent12.map(s => s.commercialsNet);

  // Lineare Regression auf Nets → Steigung bestimmt Trend
  const n = nets.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += nets[i];
    sumXY += i * nets[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Standardabweichung der Nets (Volatilität)
  const mean = sumY / n;
  const variance = nets.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Slope normalisieren relativ zur Standardabweichung
  const normalizedSlope = stdDev > 0 ? slope / stdDev : 0;

  if (Math.abs(normalizedSlope) > 0.3) {
    const type = normalizedSlope > 0 ? 'trending_bullish' as const : 'trending_bearish' as const;
    const confidence = Math.min(100, Math.round(Math.abs(normalizedSlope) * 100));
    return { type, confidence };
  }

  // Check for transitioning: war gerade noch trending, jetzt flach oder umgedreht
  const first6Slope = computeSubSlope(nets.slice(0, 6));
  const last6Slope = computeSubSlope(nets.slice(-6));

  if (Math.sign(first6Slope) !== Math.sign(last6Slope) && Math.abs(first6Slope) > 0.15) {
    return { type: 'transitioning', confidence: 60 };
  }

  return { type: 'ranging', confidence: Math.max(0, 100 - Math.round(Math.abs(normalizedSlope) * 200)) };
}

function computeSubSlope(vals: number[]): number {
  const n = vals.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += vals[i]; sumXY += i * vals[i]; sumXX += i * i;
  }
  const mean = sumY / n;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return stdDev > 0 ? slope / stdDev : 0;
}

// ============================================================
// v2: HISTORICAL PERFORMANCE
// ============================================================

function computeHistoricalPerformance(
  sorted: COTSnapshot[],
  currentPercentile: number,
  currentMomentum4w: number,
): { winRate: number | null; avgWeeks: number | null; sampleSize: number } {
  if (sorted.length < 20) return { winRate: null, avgWeeks: null, sampleSize: 0 };

  const nets = sorted.map(s => s.commercialsNet);
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  const range = max - min;
  if (range === 0) return { winRate: null, avgWeeks: null, sampleSize: 0 };

  const isBullish = currentPercentile >= 60;
  const isBearish = currentPercentile <= 40;
  if (!isBullish && !isBearish) return { winRate: null, avgWeeks: null, sampleSize: 0 };

  let wins = 0;
  let total = 0;
  let totalWeeks = 0;

  // Scan history for similar setups
  for (let i = 8; i < sorted.length - 4; i++) {
    const p = Math.round(((sorted[i].commercialsNet - min) / range) * 100);
    const m4w = i >= 4 ? sorted[i].commercialsNet - sorted[i - 4].commercialsNet : 0;

    // Match: ähnliches Perzentil (±15) und gleiches Momentum-Vorzeichen
    const percentileMatch = Math.abs(p - currentPercentile) <= 15;
    const momentumMatch = Math.sign(m4w) === Math.sign(currentMomentum4w);

    if (!percentileMatch || !momentumMatch) continue;

    // Check outcome 4 weeks later
    const futureIdx = Math.min(i + 4, sorted.length - 1);
    const futureNet = sorted[futureIdx].commercialsNet;
    const moved = futureNet - sorted[i].commercialsNet;

    const isWin = (isBullish && moved > 0) || (isBearish && moved < 0);
    if (isWin) wins++;
    total++;

    // Wie viele Wochen bis Auflösung (Position-Reversal)
    for (let j = i + 1; j < Math.min(i + 12, sorted.length); j++) {
      if (Math.sign(sorted[j].commercialsNet - sorted[i].commercialsNet) !== Math.sign(moved)) {
        totalWeeks += j - i;
        break;
      }
      if (j === Math.min(i + 11, sorted.length - 1)) {
        totalWeeks += j - i;
      }
    }
  }

  if (total < 3) return { winRate: null, avgWeeks: null, sampleSize: total };

  return {
    winRate: Math.round((wins / total) * 100),
    avgWeeks: Math.round(totalWeeks / total),
    sampleSize: total,
  };
}

// ============================================================
// v2: KNN PATTERN MATCHING
// ============================================================

function knnPatternMatch(
  sorted: COTSnapshot[],
  currentPercentile: number,
  currentM4w: number,
  currentM8w: number,
): { setups: SimilarSetup[]; direction: 'bullish' | 'bearish' | 'neutral'; confidence: number } {
  if (sorted.length < 20) return { setups: [], direction: 'neutral', confidence: 0 };

  const nets = sorted.map(s => s.commercialsNet);
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  const range = max - min;
  if (range === 0) return { setups: [], direction: 'neutral', confidence: 0 };

  // Feature-Vektor des aktuellen Zustands
  const currentFeatures = [currentPercentile / 100, normalizeM(currentM4w, nets), normalizeM(currentM8w, nets)];

  interface Candidate {
    index: number;
    distance: number;
    date: string;
    percentile: number;
    momentum: number;
    outcome4w: number;
    outcome8w: number;
  }

  const candidates: Candidate[] = [];

  for (let i = 8; i < sorted.length - 8; i++) {
    const p = ((sorted[i].commercialsNet - min) / range);
    const m4 = normalizeM(sorted[i].commercialsNet - (i >= 4 ? sorted[i - 4].commercialsNet : 0), nets);
    const m8 = normalizeM(sorted[i].commercialsNet - (i >= 8 ? sorted[i - 8].commercialsNet : 0), nets);

    // Euklidische Distanz
    const dist = Math.sqrt(
      (currentFeatures[0] - p) ** 2 +
      (currentFeatures[1] - m4) ** 2 +
      (currentFeatures[2] - m8) ** 2
    );

    // Outcome: Netto-Positionsänderung nach 4 und 8 Wochen
    const future4 = Math.min(i + 4, sorted.length - 1);
    const future8 = Math.min(i + 8, sorted.length - 1);
    const o4w = sorted[future4].commercialsNet - sorted[i].commercialsNet;
    const o8w = sorted[future8].commercialsNet - sorted[i].commercialsNet;

    candidates.push({
      index: i,
      distance: dist,
      date: sorted[i].date,
      percentile: Math.round(p * 100),
      momentum: Math.round(m4 * 100),
      outcome4w: o4w,
      outcome8w: o8w,
    });
  }

  // K = 5 nächste Nachbarn
  candidates.sort((a, b) => a.distance - b.distance);
  const k = Math.min(5, candidates.length);
  const neighbors = candidates.slice(0, k);

  if (neighbors.length === 0) return { setups: [], direction: 'neutral', confidence: 0 };

  // Outcomes aggregieren
  let bullish4w = 0, bearish4w = 0;
  let bullish8w = 0, bearish8w = 0;

  for (const n of neighbors) {
    if (n.outcome4w > 0) bullish4w++;
    else if (n.outcome4w < 0) bearish4w++;
    if (n.outcome8w > 0) bullish8w++;
    else if (n.outcome8w < 0) bearish8w++;
  }

  const totalBullish = bullish4w + bullish8w;
  const totalBearish = bearish4w + bearish8w;
  const totalVotes = totalBullish + totalBearish;

  const direction: 'bullish' | 'bearish' | 'neutral' =
    totalVotes === 0 ? 'neutral' :
    totalBullish > totalBearish ? 'bullish' :
    totalBearish > totalBullish ? 'bearish' : 'neutral';

  const confidence = totalVotes > 0
    ? Math.round((Math.max(totalBullish, totalBearish) / totalVotes) * 100)
    : 0;

  const setups: SimilarSetup[] = neighbors.map(n => ({
    date: n.date,
    percentile: n.percentile,
    momentum: n.momentum,
    outcome4w: n.outcome4w,
    outcome8w: n.outcome8w,
  }));

  return { setups, direction, confidence };
}

function normalizeM(momentum: number, nets: number[]): number {
  const maxAbs = Math.max(...nets.map(Math.abs));
  return maxAbs > 0 ? momentum / maxAbs : 0;
}

// ============================================================
// v2: FINAL CONVICTION SCORE
// ============================================================

function computeFinalConviction(params: {
  smartScore: number;
  specCrowding: ReturnType<typeof analyzeSpecCrowding>;
  seasonal: ReturnType<typeof analyzeSeasonal>;
  rateDiff: ReturnType<typeof analyzeRateDifferential>;
  regime: ReturnType<typeof detectRegime>;
  historical: ReturnType<typeof computeHistoricalPerformance>;
  knn: ReturnType<typeof knnPatternMatch>;
}): number {
  let score = params.smartScore;

  // Spec Crowding: Contrarian-Boost wenn Specs extrem positioniert (gegen uns = gut)
  if (params.specCrowding.extreme) {
    const isContrarian = (score > 0 && params.specCrowding.type === 'crowded_short') ||
                          (score < 0 && params.specCrowding.type === 'crowded_long');
    score += isContrarian ? 8 : -5;
  }

  // Seasonal Confluence
  if (params.seasonal.bias !== 'neutral') {
    const aligned = (score > 0 && params.seasonal.bias === 'bullish') ||
                    (score < 0 && params.seasonal.bias === 'bearish');
    score += aligned ? Math.round(params.seasonal.strength * 0.08) : -3;
  }

  // Rate Differential (Carry): positiver Carry stützt Long, negativer stützt Short.
  const carry = params.rateDiff.differential;
  if (carry > 0.25 && score > 0) score += 6;        // Carry bestätigt Bullish
  else if (carry < -0.25 && score < 0) score -= 6;  // Carry bestätigt Bearish
  else if (carry > 0.25 && score < 0) score += 4;   // Carry arbeitet gegen den Short
  else if (carry < -0.25 && score > 0) score -= 4;  // Carry arbeitet gegen den Long
  // Zinstrend (letzte Entscheidung) als kleiner Zusatz
  if (params.rateDiff.trend === 'hawkish' && score > 0) score += 2;
  if (params.rateDiff.trend === 'dovish' && score < 0) score -= 2;

  // Regime: Trending = höhere Conviction, Ranging = niedrigere
  if (params.regime.type === 'trending_bullish' && score > 0) {
    score += Math.round(params.regime.confidence * 0.08);
  } else if (params.regime.type === 'trending_bearish' && score < 0) {
    score -= Math.round(params.regime.confidence * 0.08);
  } else if (params.regime.type === 'ranging') {
    score = Math.round(score * 0.85);
  }

  // Historical Win Rate
  if (params.historical.winRate !== null && params.historical.sampleSize >= 3) {
    if (params.historical.winRate >= 70) score += 5;
    else if (params.historical.winRate <= 30) score -= 5;
  }

  // ML/KNN
  if (params.knn.confidence >= 60) {
    const aligned = (score > 0 && params.knn.direction === 'bullish') ||
                    (score < 0 && params.knn.direction === 'bearish');
    score += aligned ? Math.round(params.knn.confidence * 0.06) : -3;
  }

  return Math.max(-100, Math.min(100, Math.round(score)));
}

// ============================================================
// WÄHRUNGSSTÄRKE-CACHE (für Outlook + Herkunfts-Tabelle)
// ============================================================

export interface StrengthRow {
  currency: string;
  signal: COTSignal;
  percentile: number;   // COT Commercial-Net-Perzentil
  rateDiff: number;     // Zins-Differenz (Carry)
  seasonal: number;     // -100..100 saisonaler Bias
  strength: number;     // kombinierte Stärke (-100..100)
}

/**
 * Lädt die gecachten Analysen (Supabase) und schreibt den schlanken Stärke-Cache,
 * den der Outlook liest: localStorage 'cotData' (Bias) + 'strengthBreakdown' (Tabelle).
 */
export async function refreshStrengthCache(): Promise<StrengthRow[]> {
  let analyses: CurrencyAnalysis[] = [];
  try { analyses = await loadCachedAnalyses(); } catch { analyses = []; }

  const rows: StrengthRow[] = analyses
    .filter(a => a.latestDate)
    .map(a => ({
      currency: a.currency,
      signal: a.currentSignal,
      percentile: Math.round(a.currentPercentile),
      rateDiff: a.rateDifferential ?? 0,
      seasonal: a.seasonalStrength
        ? (a.seasonalBias === 'bearish' ? -a.seasonalStrength : a.seasonalBias === 'bullish' ? a.seasonalStrength : 0)
        : 0,
      strength: a.finalConviction ?? 0,
    }));

  try {
    const cot = rows.map(r => ({ currency: r.currency, signal: r.signal, percentileRank: r.percentile }));
    localStorage.setItem('cotData', JSON.stringify(cot));
    localStorage.setItem('strengthBreakdown', JSON.stringify(rows));
  } catch { /* ignore */ }

  return rows;
}

/** Synchroner Zugriff auf die zuletzt berechnete Stärke-Aufschlüsselung (für die Tabelle). */
export function getStrengthBreakdown(): StrengthRow[] {
  try { return JSON.parse(localStorage.getItem('strengthBreakdown') || '[]'); } catch { return []; }
}
