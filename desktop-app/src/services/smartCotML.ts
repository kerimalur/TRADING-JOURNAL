/**
 * ========================================================================
 * Smart COT – ML Engine
 * ========================================================================
 * Logistic Regression + Signal Backtester für Swing-Trading
 *
 * Features:
 *  - Logistic Regression (Gradient Descent, in-browser)
 *  - 15-Feature Vektor pro Datenpunkt
 *  - Signal-Backtester mit Preisdaten
 *  - Feature Importance
 *  - Ensemble Conviction Score
 */

import type { COTSnapshot } from './smartCotService';

// ============================================================
// TYPES
// ============================================================

export interface PricePoint {
  date: string;
  price: number;
}

export interface MLDataPoint {
  date: string;
  features: number[];
  label: number; // 1 = bullish (price went up 4W later), 0 = bearish
  priceChange4w: number;
  priceChange8w: number;
}

export interface MLModel {
  weights: number[];
  bias: number;
  accuracy: number;
  trainSize: number;
  featureNames: string[];
}

export interface BacktestResult {
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  bestSignal: { date: string; return4w: number } | null;
  worstSignal: { date: string; return4w: number } | null;
  byScore: ScoreBucket[];
}

export interface ScoreBucket {
  range: string;
  signals: number;
  winRate: number;
  avgReturn: number;
}

export interface MLPrediction {
  direction: 'bullish' | 'bearish' | 'neutral';
  probability: number;
  confidence: number;
  featureImportance: FeatureWeight[];
  backtest: BacktestResult;
  modelAccuracy: number;
  dataPoints: number;
}

export interface FeatureWeight {
  name: string;
  weight: number;
  contribution: number; // weight * feature value → actual contribution to this prediction
}

// ============================================================
// FEATURE ENGINEERING
// ============================================================

const FEATURE_NAMES = [
  'comm_percentile',      // 0: Commercial Net Perzentil (0-1)
  'comm_momentum_4w',     // 1: 4-Wochen Momentum (normalisiert)
  'comm_momentum_8w',     // 2: 8-Wochen Momentum
  'comm_acceleration',    // 3: Momentum-Beschleunigung (4W - 8W)
  'spec_percentile',      // 4: Speculator Net Perzentil
  'spec_comm_divergence', // 5: Spec vs Comm Divergenz
  'oi_change_4w',         // 6: Open Interest 4W Änderung
  'oi_comm_ratio',        // 7: OI vs Commercial Positionsänderung
  'net_zero_distance',    // 8: Entfernung der Net-Position von Null
  'weekly_change_std',    // 9: Volatilität der wöchentlichen Änderungen
  'trend_consistency',    // 10: Wie konsistent ist der aktuelle Trend
  'extreme_duration',     // 11: Wochen an Extremposition (normalisiert)
  'comm_short_ratio',     // 12: Commercial Short / (Long+Short)
  'spec_oi_ratio',        // 13: Spec Net / Open Interest
  'mean_reversion',       // 14: Distanz zum 20W-Durchschnitt
];

export function extractFeatures(
  sorted: COTSnapshot[],
  index: number,
): number[] | null {
  if (index < 20 || index >= sorted.length) return null;

  const current = sorted[index];
  const window = sorted.slice(Math.max(0, index - 52), index + 1);
  const nets = window.map(s => s.commercialsNet);
  const specNets = window.map(s => s.nonCommercialsNet);
  const ois = window.map(s => s.openInterest);

  const netMin = Math.min(...nets);
  const netMax = Math.max(...nets);
  const netRange = netMax - netMin || 1;

  const specMin = Math.min(...specNets);
  const specMax = Math.max(...specNets);
  const specRange = specMax - specMin || 1;

  const currentNet = current.commercialsNet;
  const specNet = current.nonCommercialsNet;

  // Percentiles
  const commPercentile = (currentNet - netMin) / netRange;
  const specPercentile = (specNet - specMin) / specRange;

  // Momentum
  const mom4w = index >= 4 ? currentNet - sorted[index - 4].commercialsNet : 0;
  const mom8w = index >= 8 ? currentNet - sorted[index - 8].commercialsNet : 0;
  const normMom4w = mom4w / netRange;
  const normMom8w = mom8w / netRange;
  const acceleration = normMom4w - normMom8w * 0.5;

  // Spec-Commercial Divergence
  const commDir = currentNet > 0 ? 1 : -1;
  const specDir = specNet > 0 ? 1 : -1;
  const specCommDiv = commDir !== specDir ? 1 : 0;

  // Open Interest
  const oi4w = index >= 4 ? (current.openInterest - sorted[index - 4].openInterest) / (Math.max(...ois) || 1) : 0;
  const oiCommRatio = current.openInterest > 0
    ? Math.abs(mom4w) / current.openInterest
    : 0;

  // Distance from zero
  const netZeroDistance = currentNet / netRange;

  // Weekly change volatility (std dev of last 12 weekly changes)
  const recentChanges: number[] = [];
  for (let i = Math.max(1, window.length - 12); i < window.length; i++) {
    recentChanges.push(window[i].commercialsNet - window[i - 1].commercialsNet);
  }
  const changeMean = recentChanges.reduce((s, v) => s + v, 0) / (recentChanges.length || 1);
  const changeStd = Math.sqrt(recentChanges.reduce((s, v) => s + (v - changeMean) ** 2, 0) / (recentChanges.length || 1));
  const normChangeStd = changeStd / netRange;

  // Trend consistency (ratio of same-direction weeks out of last 8)
  let sameDir = 0;
  const lastDir = mom4w > 0 ? 1 : -1;
  for (let i = Math.max(1, window.length - 8); i < window.length; i++) {
    const wc = window[i].commercialsNet - window[i - 1].commercialsNet;
    if (Math.sign(wc) === lastDir) sameDir++;
  }
  const trendConsistency = sameDir / 8;

  // Extreme duration
  let extremeWeeks = 0;
  for (let i = window.length - 1; i >= 0; i--) {
    const p = (window[i].commercialsNet - netMin) / netRange;
    if (p >= 0.8 || p <= 0.2) extremeWeeks++;
    else break;
  }
  const normExtreme = Math.min(extremeWeeks / 12, 1);

  // Commercial short ratio
  const total = current.commercialsLong + current.commercialsShort;
  const shortRatio = total > 0 ? current.commercialsShort / total : 0.5;

  // Spec / OI ratio
  const specOiRatio = current.openInterest > 0
    ? Math.abs(specNet) / current.openInterest
    : 0;

  // Mean reversion (distance from 20-week MA)
  const ma20 = window.slice(-20).reduce((s, v) => s + v.commercialsNet, 0) / Math.min(20, window.length);
  const meanReversion = (currentNet - ma20) / netRange;

  return [
    commPercentile,     // 0
    normMom4w,          // 1
    normMom8w,          // 2
    acceleration,       // 3
    specPercentile,     // 4
    specCommDiv,        // 5
    oi4w,               // 6
    oiCommRatio,        // 7
    netZeroDistance,     // 8
    normChangeStd,      // 9
    trendConsistency,   // 10
    normExtreme,        // 11
    shortRatio,         // 12
    specOiRatio,        // 13
    meanReversion,      // 14
  ];
}

// ============================================================
// DATA PREPARATION
// ============================================================

export function prepareMLData(
  snapshots: COTSnapshot[],
  prices: PricePoint[],
  currency: string,
): MLDataPoint[] {
  const sorted = [...snapshots]
    .filter(s => s.currency === currency)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 30) return [];

  // Build price lookup (find closest price for each COT date)
  const priceLookup = new Map<string, number>();
  for (const p of prices) {
    priceLookup.set(p.date, p.price);
  }

  const findPrice = (date: string): number | null => {
    if (priceLookup.has(date)) return priceLookup.get(date)!;
    // Find closest date within 5 days
    const d = new Date(date);
    for (let offset = 1; offset <= 5; offset++) {
      for (const dir of [-1, 1]) {
        const check = new Date(d);
        check.setDate(check.getDate() + offset * dir);
        const key = check.toISOString().split('T')[0];
        if (priceLookup.has(key)) return priceLookup.get(key)!;
      }
    }
    return null;
  };

  const dataPoints: MLDataPoint[] = [];

  for (let i = 20; i < sorted.length - 8; i++) {
    const features = extractFeatures(sorted, i);
    if (!features) continue;

    const currentPrice = findPrice(sorted[i].date);
    const price4w = findPrice(sorted[Math.min(i + 4, sorted.length - 1)].date);
    const price8w = findPrice(sorted[Math.min(i + 8, sorted.length - 1)].date);

    if (!currentPrice || !price4w) continue;

    const priceChange4w = (price4w - currentPrice) / currentPrice * 100;
    const priceChange8w = price8w ? (price8w - currentPrice) / currentPrice * 100 : 0;

    // Label: 1 if price went up in 4 weeks (for non-JPY currencies)
    // For JPY/CHF: inverse logic because they're quoted as USD/JPY
    const isInverse = currency === 'JPY' || currency === 'DXY';
    const label = isInverse
      ? (priceChange4w < 0 ? 1 : 0)  // For DXY/JPY: price drop = currency strength
      : (priceChange4w > 0 ? 1 : 0);

    dataPoints.push({
      date: sorted[i].date,
      features,
      label,
      priceChange4w,
      priceChange8w,
    });
  }

  return dataPoints;
}

// ============================================================
// LOGISTIC REGRESSION
// ============================================================

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

function predict(features: number[], weights: number[], bias: number): number {
  let z = bias;
  for (let i = 0; i < features.length; i++) {
    z += features[i] * weights[i];
  }
  return sigmoid(z);
}

export function trainLogisticRegression(
  data: MLDataPoint[],
  learningRate = 0.1,
  iterations = 500,
  l2Lambda = 0.01,
): MLModel {
  const n = data.length;
  const featureCount = data[0]?.features.length || FEATURE_NAMES.length;

  // Initialize weights
  const weights = new Array(featureCount).fill(0);
  let bias = 0;

  // Standardize features
  const means = new Array(featureCount).fill(0);
  const stds = new Array(featureCount).fill(1);

  for (let f = 0; f < featureCount; f++) {
    const vals = data.map(d => d.features[f]);
    means[f] = vals.reduce((s, v) => s + v, 0) / n;
    const variance = vals.reduce((s, v) => s + (v - means[f]) ** 2, 0) / n;
    stds[f] = Math.sqrt(variance) || 1;
  }

  const standardized = data.map(d => ({
    ...d,
    features: d.features.map((v, f) => (v - means[f]) / stds[f]),
  }));

  // Gradient Descent
  for (let iter = 0; iter < iterations; iter++) {
    const gradW = new Array(featureCount).fill(0);
    let gradB = 0;

    for (const point of standardized) {
      const pred = predict(point.features, weights, bias);
      const error = pred - point.label;

      for (let f = 0; f < featureCount; f++) {
        gradW[f] += error * point.features[f] + l2Lambda * weights[f];
      }
      gradB += error;
    }

    for (let f = 0; f < featureCount; f++) {
      weights[f] -= (learningRate / n) * gradW[f];
    }
    bias -= (learningRate / n) * gradB;
  }

  // Calculate accuracy
  let correct = 0;
  for (const point of standardized) {
    const pred = predict(point.features, weights, bias);
    if ((pred >= 0.5 && point.label === 1) || (pred < 0.5 && point.label === 0)) {
      correct++;
    }
  }

  // De-standardize weights for interpretation
  const realWeights = weights.map((w, f) => w / stds[f]);
  const realBias = bias - weights.reduce((s, w, f) => s + w * means[f] / stds[f], 0);

  return {
    weights: realWeights,
    bias: realBias,
    accuracy: Math.round((correct / n) * 100),
    trainSize: n,
    featureNames: FEATURE_NAMES,
  };
}

// ============================================================
// SIGNAL BACKTESTER
// ============================================================

export function backtestSignals(
  data: MLDataPoint[],
  model: MLModel,
  scoreThreshold = 0.55,
): BacktestResult {
  let wins = 0, losses = 0;
  let totalWinPct = 0, totalLossPct = 0;
  let bestSignal: { date: string; return4w: number } | null = null;
  let worstSignal: { date: string; return4w: number } | null = null;

  const buckets: Record<string, { signals: number; wins: number; totalReturn: number }> = {
    '0-20': { signals: 0, wins: 0, totalReturn: 0 },
    '20-40': { signals: 0, wins: 0, totalReturn: 0 },
    '40-60': { signals: 0, wins: 0, totalReturn: 0 },
    '60-80': { signals: 0, wins: 0, totalReturn: 0 },
    '80-100': { signals: 0, wins: 0, totalReturn: 0 },
  };

  for (const point of data) {
    const prob = predict(point.features, model.weights, model.bias);
    const scorePct = Math.round(prob * 100);

    // Bucket
    const bucketKey = scorePct < 20 ? '0-20' : scorePct < 40 ? '20-40' : scorePct < 60 ? '40-60' : scorePct < 80 ? '60-80' : '80-100';
    buckets[bucketKey].signals++;
    buckets[bucketKey].totalReturn += point.priceChange4w;

    // Only count signals above threshold
    if (prob < scoreThreshold && prob > (1 - scoreThreshold)) continue;

    const predictedBullish = prob >= scoreThreshold;
    const actualBullish = point.priceChange4w > 0;
    const isWin = predictedBullish === actualBullish;

    if (isWin) {
      wins++;
      totalWinPct += Math.abs(point.priceChange4w);
    } else {
      losses++;
      totalLossPct += Math.abs(point.priceChange4w);
    }

    if (predictedBullish) {
      buckets[bucketKey].wins += actualBullish ? 1 : 0;
    }

    if (!bestSignal || point.priceChange4w > bestSignal.return4w) {
      bestSignal = { date: point.date, return4w: point.priceChange4w };
    }
    if (!worstSignal || point.priceChange4w < worstSignal.return4w) {
      worstSignal = { date: point.date, return4w: point.priceChange4w };
    }
  }

  const totalSignals = wins + losses;
  const avgWinPct = wins > 0 ? totalWinPct / wins : 0;
  const avgLossPct = losses > 0 ? totalLossPct / losses : 0;

  return {
    totalSignals,
    wins,
    losses,
    winRate: totalSignals > 0 ? Math.round((wins / totalSignals) * 100) : 0,
    avgWinPct: Math.round(avgWinPct * 100) / 100,
    avgLossPct: Math.round(avgLossPct * 100) / 100,
    profitFactor: avgLossPct > 0 ? Math.round((avgWinPct / avgLossPct) * 100) / 100 : 0,
    bestSignal,
    worstSignal,
    byScore: Object.entries(buckets).map(([range, b]) => ({
      range,
      signals: b.signals,
      winRate: b.signals > 0 ? Math.round((b.wins / b.signals) * 100) : 0,
      avgReturn: b.signals > 0 ? Math.round((b.totalReturn / b.signals) * 100) / 100 : 0,
    })),
  };
}

// ============================================================
// PREDICTION WITH FEATURE IMPORTANCE
// ============================================================

export function predictWithExplanation(
  snapshots: COTSnapshot[],
  currency: string,
  model: MLModel,
): { probability: number; featureImportance: FeatureWeight[] } | null {
  const sorted = [...snapshots]
    .filter(s => s.currency === currency)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 21) return null;

  const features = extractFeatures(sorted, sorted.length - 1);
  if (!features) return null;

  const probability = predict(features, model.weights, model.bias);

  const featureImportance: FeatureWeight[] = model.featureNames.map((name, i) => ({
    name,
    weight: model.weights[i],
    contribution: model.weights[i] * features[i],
  }));

  featureImportance.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return { probability, featureImportance };
}

// ============================================================
// FULL ML PIPELINE
// ============================================================

export function runMLPipeline(
  snapshots: COTSnapshot[],
  prices: PricePoint[],
  currency: string,
): MLPrediction | null {
  const data = prepareMLData(snapshots, prices, currency);

  if (data.length < 30) {
    return {
      direction: 'neutral',
      probability: 0.5,
      confidence: 0,
      featureImportance: [],
      backtest: {
        totalSignals: 0, wins: 0, losses: 0, winRate: 0,
        avgWinPct: 0, avgLossPct: 0, profitFactor: 0,
        bestSignal: null, worstSignal: null, byScore: [],
      },
      modelAccuracy: 0,
      dataPoints: data.length,
    };
  }

  // Train model
  const model = trainLogisticRegression(data);

  // Backtest
  const backtest = backtestSignals(data, model);

  // Predict current
  const prediction = predictWithExplanation(snapshots, currency, model);

  if (!prediction) {
    return {
      direction: 'neutral',
      probability: 0.5,
      confidence: 0,
      featureImportance: [],
      backtest,
      modelAccuracy: model.accuracy,
      dataPoints: data.length,
    };
  }

  const prob = prediction.probability;
  const direction: 'bullish' | 'bearish' | 'neutral' =
    prob >= 0.6 ? 'bullish' : prob <= 0.4 ? 'bearish' : 'neutral';
  const confidence = Math.round(Math.abs(prob - 0.5) * 200);

  return {
    direction,
    probability: Math.round(prob * 100) / 100,
    confidence,
    featureImportance: prediction.featureImportance.slice(0, 8),
    backtest,
    modelAccuracy: model.accuracy,
    dataPoints: data.length,
  };
}

// ============================================================
// HUMAN-READABLE FEATURE NAMES
// ============================================================

export const FEATURE_LABELS: Record<string, string> = {
  'comm_percentile': 'Commercial Perzentil',
  'comm_momentum_4w': 'Momentum 4W',
  'comm_momentum_8w': 'Momentum 8W',
  'comm_acceleration': 'Momentum-Beschleunigung',
  'spec_percentile': 'Spec Perzentil',
  'spec_comm_divergence': 'Spec-Comm Divergenz',
  'oi_change_4w': 'OI Änderung 4W',
  'oi_comm_ratio': 'OI/Comm Verhältnis',
  'net_zero_distance': 'Abstand von Null',
  'weekly_change_std': 'Volatilität',
  'trend_consistency': 'Trend-Konsistenz',
  'extreme_duration': 'Extremdauer',
  'comm_short_ratio': 'Short-Ratio',
  'spec_oi_ratio': 'Spec/OI Ratio',
  'mean_reversion': 'Mean Reversion',
};
