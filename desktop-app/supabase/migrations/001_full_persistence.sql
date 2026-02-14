-- ============================================================
-- Trading Journal - Full Persistence Migration
-- ============================================================
-- Adds tables for all features that currently only use localStorage.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. ACCOUNT TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('funded', 'ek')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'payout')),
  amount NUMERIC NOT NULL,
  date TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

-- 2. OUTLOOKS / TRADING THESES
CREATE TABLE IF NOT EXISTS outlooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'neutral')),
  timeframe TEXT DEFAULT '1W',
  thesis TEXT DEFAULT '',
  confidence INTEGER DEFAULT 50,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'hit', 'invalidated')),
  cot_bias TEXT,
  entry_zone TEXT,
  invalidation TEXT,
  target TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TEXT
);

ALTER TABLE outlooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own outlooks" ON outlooks
  FOR ALL USING (auth.uid() = user_id);

-- 3. ACCOUNT CONFIGS
CREATE TABLE IF NOT EXISTS account_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('funded', 'ek')),
  initial_start_balance NUMERIC DEFAULT 10000,
  current_balance NUMERIC DEFAULT 10000,
  currency TEXT DEFAULT 'USD',
  default_risk_per_trade NUMERIC DEFAULT 0.5,
  enable_goals BOOLEAN DEFAULT false,
  profit_target_value NUMERIC,
  profit_target_type TEXT,
  max_drawdown_value NUMERIC,
  max_drawdown_type TEXT,
  profit_target NUMERIC,
  max_drawdown NUMERIC,
  chapters JSONB DEFAULT '[]',
  active_chapter_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, type)
);

ALTER TABLE account_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own account configs" ON account_configs
  FOR ALL USING (auth.uid() = user_id);

-- 4. BACKTEST SESSIONS
CREATE TABLE IF NOT EXISTS backtest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pair TEXT NOT NULL,
  timeframe TEXT DEFAULT '1H',
  strategy TEXT DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  notes TEXT DEFAULT '',
  trades JSONB DEFAULT '[]',
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE backtest_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own backtest sessions" ON backtest_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 5. TRADING STRATEGIES
CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  rules JSONB DEFAULT '[]',
  entry_criteria JSONB DEFAULT '[]',
  exit_criteria JSONB DEFAULT '[]',
  risk_rules JSONB DEFAULT '{}',
  pairs TEXT[] DEFAULT '{}',
  timeframes TEXT[] DEFAULT '{}',
  sessions TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own strategies" ON strategies
  FOR ALL USING (auth.uid() = user_id);

-- 6. RISK SETTINGS
CREATE TABLE IF NOT EXISTS risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own risk settings" ON risk_settings
  FOR ALL USING (auth.uid() = user_id);

-- 7. ML DATA (predictions, COT history, patterns)
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  cot_net_at_prediction NUMERIC,
  cot_change NUMERIC,
  prediction TEXT CHECK (prediction IN ('bullish', 'bearish', 'neutral')),
  confidence INTEGER DEFAULT 50,
  timeframe TEXT DEFAULT '2weeks',
  reasoning TEXT DEFAULT '',
  outcome JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ml_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ml predictions" ON ml_predictions
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ml_cot_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  currency TEXT NOT NULL,
  commercials_net NUMERIC,
  commercials_long NUMERIC,
  commercials_short NUMERIC,
  price_at_snapshot NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date, currency)
);

ALTER TABLE ml_cot_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ml cot history" ON ml_cot_history
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ml_learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  conditions JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{}',
  confidence INTEGER DEFAULT 50,
  recommendation TEXT DEFAULT 'neutral',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ml_learned_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ml patterns" ON ml_learned_patterns
  FOR ALL USING (auth.uid() = user_id);

-- 8. PAIR NOTES (Currency Analysis)
CREATE TABLE IF NOT EXISTS pair_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  notes TEXT DEFAULT '',
  bias TEXT,
  key_levels JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, pair)
);

ALTER TABLE pair_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pair notes" ON pair_notes
  FOR ALL USING (auth.uid() = user_id);

-- INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_outlooks_user ON outlooks(user_id);
CREATE INDEX IF NOT EXISTS idx_account_configs_user ON account_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_sessions_user ON backtest_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_strategies_user ON strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_user ON ml_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_cot_history_user ON ml_cot_history(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_pair_notes_user ON pair_notes(user_id);
