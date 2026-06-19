-- ============================================================
-- TRADING JOURNAL — KOMPLETTES SETUP (idempotent)
-- ============================================================
-- DIESE DATEI EINMAL IM SUPABASE SQL-EDITOR AUSFÜHREN.
-- Kann beliebig oft wiederholt werden (DROP POLICY IF EXISTS).
-- Erstellt alle Tabellen + Smart-COT + Outlook-Erweiterungen.
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- BASIS-TABELLEN
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT, avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('ek','funded')),
  broker TEXT NOT NULL DEFAULT '', account_number TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  enable_goals BOOLEAN DEFAULT false,
  profit_target_value NUMERIC(10,4), profit_target_type TEXT, profit_target NUMERIC(15,2),
  max_drawdown_value NUMERIC(10,4), max_drawdown_type TEXT, max_drawdown NUMERIC(15,2),
  daily_drawdown_value NUMERIC(10,4), daily_drawdown_type TEXT,
  default_risk_per_trade NUMERIC(6,3) NOT NULL DEFAULT 1.0,
  chapters JSONB NOT NULL DEFAULT '[]', active_chapter_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true, is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'both',
  rules JSONB NOT NULL DEFAULT '[]', pairs TEXT[] NOT NULL DEFAULT '{}',
  timeframes TEXT[] NOT NULL DEFAULT '{}', sessions TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true, stats JSONB NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outlooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL, direction TEXT NOT NULL CHECK (direction IN ('long','short')),
  thesis TEXT NOT NULL DEFAULT '', confidence INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'observation',
  cot_bias JSONB,
  target_entry NUMERIC(18,6), target_sl NUMERIC(18,6), target_tp NUMERIC(18,6),
  interesting_zone NUMERIC(18,6), image_data TEXT,
  confluences TEXT[] NOT NULL DEFAULT '{}', tags TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ, journaled_to TEXT[] NOT NULL DEFAULT '{}', expires_at TEXT,
  executed_trade_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  outlook_id UUID REFERENCES outlooks(id) ON DELETE SET NULL,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('ek','funded')),
  symbol TEXT NOT NULL, side TEXT NOT NULL CHECK (side IN ('long','short')),
  date TEXT NOT NULL, result TEXT,
  status TEXT NOT NULL DEFAULT 'closed', session_type TEXT NOT NULL DEFAULT 'live',
  session TEXT NOT NULL DEFAULT '',
  r_multiple NUMERIC(10,4) NOT NULL DEFAULT 0,
  risk_percent NUMERIC(8,4), risk_amount NUMERIC(15,2), profit_amount NUMERIC(15,2), pnl NUMERIC(15,2),
  entry_price NUMERIC(18,6), exit_price NUMERIC(18,6), stop_loss NUMERIC(18,6), take_profit NUMERIC(18,6),
  quantity NUMERIC(15,6), lot_size NUMERIC(10,4),
  account_balance_before NUMERIC(15,2), account_balance_after NUMERIC(15,2), running_balance NUMERIC(15,2),
  setup_daily_bos BOOLEAN NOT NULL DEFAULT false, setup_value_area BOOLEAN NOT NULL DEFAULT false,
  setup_market_structure BOOLEAN NOT NULL DEFAULT false, setup_weekly_gva BOOLEAN NOT NULL DEFAULT false,
  setup_3day_gva BOOLEAN NOT NULL DEFAULT false,
  confluences JSONB NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '', comment TEXT NOT NULL DEFAULT '', chapter_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS executed_trade_id UUID REFERENCES trades(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS trade_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'entry', screenshot_data TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png', file_size_kb INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ek','funded')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit','withdrawal','payout')),
  amount NUMERIC(15,2) NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS backtest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  name TEXT NOT NULL, pair TEXT NOT NULL, timeframe TEXT NOT NULL DEFAULT '1H',
  strategy TEXT NOT NULL DEFAULT '', start_date TEXT, end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '',
  elapsed_ms BIGINT NOT NULL DEFAULT 0,
  trades JSONB NOT NULL DEFAULT '[]', stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fundamentals_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section TEXT NOT NULL, currency TEXT, title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '', tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pair_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', bias TEXT,
  key_levels JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, pair)
);

CREATE TABLE IF NOT EXISTS risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  dashboard_background TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS user_watchlists (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  watchlists JSONB NOT NULL DEFAULT '[]'::jsonb,
  color_labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  dashboard_color TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_widget_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SMART COT TABELLEN
-- ============================================================

CREATE TABLE IF NOT EXISTS cot_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL, currency TEXT NOT NULL,
  commercials_long NUMERIC NOT NULL DEFAULT 0, commercials_short NUMERIC NOT NULL DEFAULT 0,
  commercials_net NUMERIC NOT NULL DEFAULT 0,
  non_commercials_long NUMERIC NOT NULL DEFAULT 0, non_commercials_short NUMERIC NOT NULL DEFAULT 0,
  non_commercials_net NUMERIC NOT NULL DEFAULT 0, open_interest NUMERIC NOT NULL DEFAULT 0,
  percentile_rank NUMERIC(5,2), signal TEXT, weekly_change NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, currency)
);

CREATE TABLE IF NOT EXISTS cot_currency_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  current_signal TEXT, current_percentile NUMERIC(5,2), current_net NUMERIC, latest_date TEXT,
  momentum_1w NUMERIC NOT NULL DEFAULT 0, momentum_4w NUMERIC NOT NULL DEFAULT 0, momentum_8w NUMERIC NOT NULL DEFAULT 0,
  momentum_signal TEXT NOT NULL DEFAULT 'neutral',
  is_extreme BOOLEAN NOT NULL DEFAULT false, extreme_type TEXT, weeks_at_extreme INTEGER NOT NULL DEFAULT 0,
  trend_direction TEXT NOT NULL DEFAULT 'flat', trend_weeks INTEGER NOT NULL DEFAULT 0,
  coc_detected BOOLEAN NOT NULL DEFAULT false, coc_type TEXT, coc_date TEXT,
  spec_commercial_divergence BOOLEAN NOT NULL DEFAULT false, spec_commercial_detail TEXT,
  smart_score INTEGER NOT NULL DEFAULT 0,
  oi_trend TEXT NOT NULL DEFAULT 'flat', oi_divergence BOOLEAN NOT NULL DEFAULT false,
  spec_net NUMERIC NOT NULL DEFAULT 0, spec_percentile NUMERIC(5,2) NOT NULL DEFAULT 50,
  spec_crowding_extreme BOOLEAN NOT NULL DEFAULT false, spec_crowding_type TEXT,
  seasonal_bias TEXT NOT NULL DEFAULT 'neutral', seasonal_strength INTEGER NOT NULL DEFAULT 0,
  rate_differential NUMERIC NOT NULL DEFAULT 0, rate_trend TEXT NOT NULL DEFAULT 'neutral',
  rate_cot_confluence BOOLEAN NOT NULL DEFAULT false,
  regime TEXT NOT NULL DEFAULT 'ranging', regime_confidence INTEGER NOT NULL DEFAULT 0,
  historical_win_rate NUMERIC(5,2), historical_avg_weeks INTEGER, historical_sample_size INTEGER NOT NULL DEFAULT 0,
  similar_setups JSONB NOT NULL DEFAULT '[]', ml_direction TEXT, ml_confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  final_conviction INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, currency)
);

CREATE TABLE IF NOT EXISTS cot_pair_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long','short')),
  strength INTEGER NOT NULL DEFAULT 0, smart_score INTEGER NOT NULL DEFAULT 0,
  base_currency TEXT NOT NULL, base_smart_score INTEGER NOT NULL DEFAULT 0,
  quote_currency TEXT NOT NULL, quote_smart_score INTEGER NOT NULL DEFAULT 0,
  divergence_score INTEGER NOT NULL DEFAULT 0, momentum_aligned BOOLEAN NOT NULL DEFAULT false,
  reasons JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, pair)
);

-- ============================================================
-- OUTLOOK-ERWEITERUNGEN (Star-System, Strategy)
-- ============================================================

ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS setup_id TEXT;
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS strategy_checklist JSONB NOT NULL DEFAULT '[]';
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS fundamental_outlook TEXT NOT NULL DEFAULT '';

-- ============================================================
-- RLS AKTIVIEREN + POLICIES (idempotent via DROP IF EXISTS)
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_profiles','accounts','strategies','outlooks','trades','trade_screenshots',
    'transactions','backtest_sessions','fundamentals_notes','pair_notes','risk_settings',
    'user_preferences','user_watchlists','user_widget_settings',
    'cot_snapshots','cot_currency_analysis','cot_pair_signals'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "own_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "own_%s" ON %I FOR ALL USING (auth.uid() = user_id)', t, t);
  END LOOP;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_outlooks_user ON outlooks(user_id);
CREATE INDEX IF NOT EXISTS idx_outlooks_starred ON outlooks(user_id) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_cot_snap_lookup ON cot_snapshots(user_id, currency, date DESC);
CREATE INDEX IF NOT EXISTS idx_cot_analysis_user ON cot_currency_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_cot_pairs_user ON cot_pair_signals(user_id);

-- ============================================================
-- TRIGGERS (auto updated_at)
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_profiles','accounts','strategies','outlooks','trades','backtest_sessions',
    'fundamentals_notes','risk_settings','user_preferences','user_watchlists',
    'user_widget_settings','cot_currency_analysis','cot_pair_signals'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- ============================================================
-- FERTIG. Alle Tabellen + Smart COT + Outlook-Felder erstellt.
-- ============================================================
