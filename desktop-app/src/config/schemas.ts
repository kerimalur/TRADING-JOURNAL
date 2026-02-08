/**
 * ========================================================================
 * Trading Journal - Zod Validation Schemas
 * ========================================================================
 * 
 * Runtime Type Validation für API Responses und Forms.
 */

import { z } from 'zod';
import { VALIDATION, LIMITS } from './constants';

// ============================================================
// BASIC SCHEMAS
// ============================================================

export const AccountTypeSchema = z.enum(['ek', 'funded']);
export const TradeDirectionSchema = z.enum(['long', 'short']);
export const TradeResultSchema = z.enum(['win', 'loss', 'breakeven']);
export const SessionTypeSchema = z.enum(['live', 'backtest']);
export const TransactionTypeSchema = z.enum(['deposit', 'withdrawal', 'payout']);
export const OutlookStatusSchema = z.enum(['observation', 'waiting', 'active', 'cancelled', 'executed']);
export const ConfidenceLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

// ============================================================
// TRADE SCHEMAS
// ============================================================

export const TradeSchema = z.object({
  id: z.string(),
  type: AccountTypeSchema,
  pair: z.string().min(1),
  direction: TradeDirectionSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  result: TradeResultSchema,
  rMultiple: z.number().min(VALIDATION.MIN_R_MULTIPLE).max(VALIDATION.MAX_R_MULTIPLE),
  riskPercent: z.number().min(VALIDATION.MIN_RISK_PERCENT).max(VALIDATION.MAX_RISK_PERCENT).optional(),
  riskAmount: z.number().positive().optional(),
  profitAmount: z.number().optional(),
  notes: z.string().max(LIMITS.MAX_NOTES_LENGTH).optional(),
  comment: z.string().max(LIMITS.MAX_NOTES_LENGTH).optional(),
  sessionType: SessionTypeSchema,
  session: z.string().optional(),
  accountBalanceBefore: z.number().optional(),
  accountBalanceAfter: z.number().optional(),
  runningBalance: z.number().optional(),
  entryPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  // Setup flags
  htfBias: z.boolean().optional(),
  d1Zone: z.boolean().optional(),
  d1Fib: z.boolean().optional(),
  h4Zone: z.boolean().optional(),
  m15Entry: z.boolean().optional(),
  setup_daily_bos: z.boolean().optional(),
  setup_value_area: z.boolean().optional(),
  setup_market_structure: z.boolean().optional(),
  setup_weekly_gva: z.boolean().optional(),
  setup_3day_gva: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TradeFormSchema = TradeSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).partial({
  riskPercent: true,
  riskAmount: true,
  notes: true,
});

export type ValidatedTrade = z.infer<typeof TradeSchema>;
export type ValidatedTradeForm = z.infer<typeof TradeFormSchema>;

// ============================================================
// ACCOUNT SCHEMAS
// ============================================================

export const AccountConfigSchema = z.object({
  initialStartBalance: z.number().positive(),
  currentBalance: z.number(),
  currency: z.string().length(3),
  type: AccountTypeSchema,
  defaultRiskPerTrade: z.number().min(VALIDATION.MIN_RISK_PERCENT).max(VALIDATION.MAX_RISK_PERCENT),
  enableGoals: z.boolean().optional(),
  profitTargetValue: z.number().optional(),
  profitTargetType: z.enum(['percent', 'absolute']).optional(),
  maxDrawdownValue: z.number().optional(),
  maxDrawdownType: z.enum(['percent', 'absolute']).optional(),
  profitTarget: z.number().optional(),
  maxDrawdown: z.number().optional(),
});

export const TransactionSchema = z.object({
  id: z.string(),
  type: AccountTypeSchema,
  transactionType: TransactionTypeSchema,
  amount: z.number().positive(),
  date: z.string(),
  note: z.string().optional(),
  createdAt: z.string().optional(),
});

export type ValidatedAccountConfig = z.infer<typeof AccountConfigSchema>;
export type ValidatedTransaction = z.infer<typeof TransactionSchema>;

// ============================================================
// OUTLOOK SCHEMAS
// ============================================================

export const OutlookSchema = z.object({
  id: z.string(),
  symbol: z.string().min(1),
  direction: TradeDirectionSchema,
  thesis: z.string().min(1).max(LIMITS.MAX_THESIS_LENGTH),
  confidence: ConfidenceLevelSchema,
  status: OutlookStatusSchema,
  cotBias: z.object({
    base: z.object({
      currency: z.string(),
      signal: z.enum(['strong_long', 'long', 'neutral', 'short', 'strong_short']),
      percentile: z.number(),
    }),
    quote: z.object({
      currency: z.string(),
      signal: z.enum(['strong_long', 'long', 'neutral', 'short', 'strong_short']),
      percentile: z.number(),
    }),
    divergenceScore: z.number(),
  }).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  executedTradeId: z.string().optional(),
  targetEntry: z.number().optional(),
  targetSL: z.number().optional(),
  targetTP: z.number().optional(),
  tags: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
});

export type ValidatedOutlook = z.infer<typeof OutlookSchema>;

// ============================================================
// WATCHLIST SCHEMAS
// ============================================================

export const WatchlistItemSchema = z.object({
  id: z.string(),
  symbol: z.string().min(1),
  displaySymbol: z.string(),
  base: z.string().length(3),
  quote: z.string().length(3),
  addedAt: z.string(),
  notes: z.string().max(LIMITS.MAX_NOTES_LENGTH).optional(),
  isFavorite: z.boolean().optional(),
  cotBias: z.object({
    base: z.object({
      signal: z.enum(['strong_long', 'long', 'neutral', 'short', 'strong_short']),
      percentile: z.number(),
    }),
    quote: z.object({
      signal: z.enum(['strong_long', 'long', 'neutral', 'short', 'strong_short']),
      percentile: z.number(),
    }),
  }).optional(),
});

export type ValidatedWatchlistItem = z.infer<typeof WatchlistItemSchema>;

// ============================================================
// COT DATA SCHEMAS
// ============================================================

export const CotDataSchema = z.object({
  currency: z.string(),
  date: z.string(),
  commercialsLong: z.number(),
  commercialsShort: z.number(),
  commercialsNet: z.number(),
  weeklyChange: z.number(),
  percentileRank: z.number(),
  signal: z.enum(['strong_long', 'long', 'neutral', 'short', 'strong_short']),
});

export const CotApiResponseSchema = z.array(z.object({
  report_date_as_yyyy_mm_dd: z.string(),
  comm_positions_long_all: z.string(),
  comm_positions_short_all: z.string(),
  cftc_contract_market_code: z.string().optional(),
}));

export type ValidatedCotData = z.infer<typeof CotDataSchema>;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validiert Daten mit einem Schema und gibt typsichere Daten zurück
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Validiert und sanitisiert eine Trade-Eingabe
 */
export function validateTradeInput(data: unknown): ValidatedTradeForm | null {
  const result = TradeFormSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validiert COT API Response
 */
export function validateCotApiResponse(data: unknown): z.infer<typeof CotApiResponseSchema> | null {
  const result = CotApiResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}
