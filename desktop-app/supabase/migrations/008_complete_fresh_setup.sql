-- ============================================================
-- Trading Journal – Komplettes Datenbankschema
-- Version: 5.0  (Juni 2026)
-- ============================================================
-- Für eine NEUE, leere Supabase-DB:
--   → Im SQL-Editor ausführen → fertig.
--
-- Enthält ALLE 18 Tabellen + 1 View + Funktionen + RLS + Trigger.
-- Reihenfolge beachtet FK-Abhängigkeiten (accounts → strategies
-- → outlooks → trades → rest).
-- ============================================================


-- ============================================================
-- 0. HILFSFUNKTION: auto-updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 1. USER_PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_profiles: eigenes Profil"
  ON user_profiles FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 2. ACCOUNTS  (EK + Funded, Multi-Account)
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   TEXT          NOT NULL,
  type                   TEXT          NOT NULL CHECK (type IN ('ek', 'funded')),
  broker                 TEXT          NOT NULL DEFAULT '',
  account_number         TEXT          NOT NULL DEFAULT '',
  currency               TEXT          NOT NULL DEFAULT 'USD',
  initial_balance        NUMERIC(15,2) NOT NULL DEFAULT 0,
  current_balance        NUMERIC(15,2) NOT NULL DEFAULT 0,
  enable_goals           BOOLEAN       DEFAULT false,
  profit_target_value    NUMERIC(10,4),
  profit_target_type     TEXT          CHECK (profit_target_type IN ('percent', 'absolute')),
  profit_target          NUMERIC(15,2),
  max_drawdown_value     NUMERIC(10,4),
  max_drawdown_type      TEXT          CHECK (max_drawdown_type IN ('percent', 'absolute')),
  max_drawdown           NUMERIC(15,2),
  daily_drawdown_value   NUMERIC(10,4),
  daily_drawdown_type    TEXT          CHECK (daily_drawdown_type IN ('percent', 'absolute')),
  default_risk_per_trade NUMERIC(6,3)  NOT NULL DEFAULT 1.0,
  chapters               JSONB         NOT NULL DEFAULT '[]',
  active_chapter_id      TEXT,
  is_active              BOOLEAN       NOT NULL DEFAULT true,
  is_default             BOOLEAN       NOT NULL DEFAULT false,
  notes                  TEXT          NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts: eigene Konten"
  ON accounts FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user      ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, type);

CREATE OR REPLACE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 3. STRATEGIEN
-- ============================================================

CREATE TABLE IF NOT EXISTS strategies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  direction   TEXT        NOT NULL DEFAULT 'both' CHECK (direction IN ('long', 'short', 'both')),
  rules       JSONB       NOT NULL DEFAULT '[]',
  pairs       TEXT[]      NOT NULL DEFAULT '{}',
  timeframes  TEXT[]      NOT NULL DEFAULT '{}',
  sessions    TEXT[]      NOT NULL DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  stats       JSONB       NOT NULL DEFAULT '{}',
  notes       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategies: eigene Strategien"
  ON strategies FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_strategies_user   ON strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_strategies_active ON strategies(user_id, is_active);

CREATE OR REPLACE TRIGGER trg_strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 4. OUTLOOKS  (Trading-Thesen)
-- ============================================================

CREATE TABLE IF NOT EXISTS outlooks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol           TEXT        NOT NULL,
  direction        TEXT        NOT NULL CHECK (direction IN ('long', 'short')),
  thesis           TEXT        NOT NULL DEFAULT '',
  confidence       INTEGER     NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  status           TEXT        NOT NULL DEFAULT 'observation'
                   CHECK (status IN ('observation', 'waiting', 'active', 'cancelled', 'executed')),
  cot_bias         JSONB,
  target_entry     NUMERIC(18,6),
  target_sl        NUMERIC(18,6),
  target_tp        NUMERIC(18,6),
  interesting_zone NUMERIC(18,6),
  image_data       TEXT,
  confluences      TEXT[]      NOT NULL DEFAULT '{}',
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  started_at       TIMESTAMPTZ,
  journaled_to     TEXT[]      NOT NULL DEFAULT '{}',
  expires_at       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE outlooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outlooks: eigene Thesen"
  ON outlooks FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_outlooks_user   ON outlooks(user_id);
CREATE INDEX IF NOT EXISTS idx_outlooks_status ON outlooks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outlooks_symbol ON outlooks(user_id, symbol);

CREATE OR REPLACE TRIGGER trg_outlooks_updated_at
  BEFORE UPDATE ON outlooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 5. TRADES
-- ============================================================

CREATE TABLE IF NOT EXISTS trades (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id              UUID          REFERENCES accounts(id)   ON DELETE SET NULL,
  outlook_id              UUID          REFERENCES outlooks(id)   ON DELETE SET NULL,
  strategy_id             UUID          REFERENCES strategies(id) ON DELETE SET NULL,
  type                    TEXT          NOT NULL CHECK (type IN ('ek', 'funded')),
  symbol                  TEXT          NOT NULL,
  side                    TEXT          NOT NULL CHECK (side IN ('long', 'short')),
  date                    TEXT          NOT NULL,
  result                  TEXT          CHECK (result IN ('win', 'loss', 'breakeven')),
  status                  TEXT          NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'closed')),
  session_type            TEXT          NOT NULL DEFAULT 'live'   CHECK (session_type IN ('live', 'backtest')),
  session                 TEXT          NOT NULL DEFAULT '',
  r_multiple              NUMERIC(10,4) NOT NULL DEFAULT 0,
  risk_percent            NUMERIC(8,4),
  risk_amount             NUMERIC(15,2),
  profit_amount           NUMERIC(15,2),
  pnl                     NUMERIC(15,2),
  entry_price             NUMERIC(18,6),
  exit_price              NUMERIC(18,6),
  stop_loss               NUMERIC(18,6),
  take_profit             NUMERIC(18,6),
  quantity                NUMERIC(15,6),
  lot_size                NUMERIC(10,4),
  account_balance_before  NUMERIC(15,2),
  account_balance_after   NUMERIC(15,2),
  running_balance         NUMERIC(15,2),
  setup_daily_bos         BOOLEAN       NOT NULL DEFAULT false,
  setup_value_area        BOOLEAN       NOT NULL DEFAULT false,
  setup_market_structure  BOOLEAN       NOT NULL DEFAULT false,
  setup_weekly_gva        BOOLEAN       NOT NULL DEFAULT false,
  setup_3day_gva          BOOLEAN       NOT NULL DEFAULT false,
  confluences             JSONB         NOT NULL DEFAULT '[]',
  notes                   TEXT          NOT NULL DEFAULT '',
  comment                 TEXT          NOT NULL DEFAULT '',
  chapter_id              TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades: eigene Trades"
  ON trades FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trades_user    ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_type    ON trades(user_id, type);
CREATE INDEX IF NOT EXISTS idx_trades_date    ON trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_result  ON trades(user_id, result);
CREATE INDEX IF NOT EXISTS idx_trades_outlook ON trades(outlook_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol  ON trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_session ON trades(user_id, session_type);

CREATE OR REPLACE TRIGGER trg_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 5b. Zirkulärer FK: outlooks.executed_trade_id → trades
-- ============================================================

ALTER TABLE outlooks
  ADD COLUMN IF NOT EXISTS executed_trade_id UUID
  REFERENCES trades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_outlooks_trade ON outlooks(executed_trade_id);


-- ============================================================
-- 6. TRADE-SCREENSHOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS trade_screenshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id        UUID        NOT NULL REFERENCES trades(id)     ON DELETE CASCADE,
  label           TEXT        NOT NULL DEFAULT 'entry'
                  CHECK (label IN ('entry', 'exit', 'analysis', 'overview')),
  screenshot_data TEXT        NOT NULL,
  mime_type       TEXT        NOT NULL DEFAULT 'image/png',
  file_size_kb    INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trade_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenshots: eigene Screenshots"
  ON trade_screenshots FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_screenshots_trade ON trade_screenshots(trade_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_user  ON trade_screenshots(user_id);


-- ============================================================
-- 7. TRANSAKTIONEN
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id       UUID          REFERENCES accounts(id) ON DELETE CASCADE,
  type             TEXT          NOT NULL CHECK (type IN ('ek', 'funded')),
  transaction_type TEXT          NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'payout')),
  amount           NUMERIC(15,2) NOT NULL,
  date             TEXT          NOT NULL,
  note             TEXT          NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions: eigene Transaktionen"
  ON transactions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date    ON transactions(user_id, date DESC);


-- ============================================================
-- 8. BACKTEST-SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS backtest_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id  UUID        REFERENCES strategies(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  pair         TEXT        NOT NULL,
  timeframe    TEXT        NOT NULL DEFAULT '1H',
  strategy     TEXT        NOT NULL DEFAULT '',
  start_date   TEXT,
  end_date     TEXT,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes        TEXT        NOT NULL DEFAULT '',
  elapsed_ms   BIGINT      NOT NULL DEFAULT 0,
  trades       JSONB       NOT NULL DEFAULT '[]',
  stats        JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE backtest_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backtest: eigene Sessions"
  ON backtest_sessions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_backtest_user     ON backtest_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_sessions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_status   ON backtest_sessions(user_id, status);

CREATE OR REPLACE TRIGGER trg_backtest_updated_at
  BEFORE UPDATE ON backtest_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 9. SMART COT – SNAPSHOTS  (wöchentliche CFTC-Rohdaten)
-- ============================================================
-- Jede Woche ein Datensatz pro Währung.
-- 52+ Wochen History für Percentile, Momentum, Extremzonen.
-- ============================================================

CREATE TABLE IF NOT EXISTS cot_snapshots (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                   TEXT        NOT NULL,   -- YYYY-MM-DD (CFTC-Berichtsdatum)
  currency               TEXT        NOT NULL,   -- DXY, EUR, GBP, JPY, CAD, AUD, NZD, CHF

  -- Commercials (Smart Money / Hedger)
  commercials_long       NUMERIC     NOT NULL DEFAULT 0,
  commercials_short      NUMERIC     NOT NULL DEFAULT 0,
  commercials_net        NUMERIC     NOT NULL DEFAULT 0,

  -- Non-Commercials (Large Speculators)
  non_commercials_long   NUMERIC     NOT NULL DEFAULT 0,
  non_commercials_short  NUMERIC     NOT NULL DEFAULT 0,
  non_commercials_net    NUMERIC     NOT NULL DEFAULT 0,

  -- Open Interest
  open_interest          NUMERIC     NOT NULL DEFAULT 0,

  -- Per-Snapshot berechnete Metriken
  percentile_rank        NUMERIC(5,2),           -- 0-100 über verfügbare History
  signal                 TEXT        CHECK (signal IN ('strong_long', 'long', 'neutral', 'short', 'strong_short')),
  weekly_change          NUMERIC     NOT NULL DEFAULT 0,  -- Netto-Änderung vs. Vorwoche

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, date, currency)
);

ALTER TABLE cot_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cot_snapshots: eigene Daten"
  ON cot_snapshots FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cot_snap_user_ccy  ON cot_snapshots(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_cot_snap_user_date ON cot_snapshots(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cot_snap_lookup    ON cot_snapshots(user_id, currency, date DESC);


-- ============================================================
-- 10. SMART COT – CURRENCY ANALYSIS  (berechnete Intelligenz)
-- ============================================================
-- Pro Währung ein Datensatz: Momentum, Extremzonen, Trend,
-- Change of Character, Composite Score.
-- Wird bei jedem COT-Refresh neu berechnet (UPSERT).
-- ============================================================

CREATE TABLE IF NOT EXISTS cot_currency_analysis (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency            TEXT        NOT NULL,

  -- Aktueller Zustand
  current_signal      TEXT        CHECK (current_signal IN ('strong_long', 'long', 'neutral', 'short', 'strong_short')),
  current_percentile  NUMERIC(5,2),
  current_net         NUMERIC,
  latest_date         TEXT,                      -- Datum des letzten Snapshots

  -- Momentum (Geschwindigkeit der Positionsänderung)
  momentum_1w         NUMERIC     NOT NULL DEFAULT 0,  -- 1-Wochen-Änderung
  momentum_4w         NUMERIC     NOT NULL DEFAULT 0,  -- 4-Wochen-Momentum (Summe)
  momentum_8w         NUMERIC     NOT NULL DEFAULT 0,  -- 8-Wochen-Momentum (Summe)
  momentum_signal     TEXT        NOT NULL DEFAULT 'neutral'
                      CHECK (momentum_signal IN ('accelerating_long', 'long', 'neutral', 'short', 'accelerating_short')),

  -- Extremzonen-Erkennung
  is_extreme          BOOLEAN     NOT NULL DEFAULT false,
  extreme_type        TEXT        CHECK (extreme_type IN ('overbought', 'oversold')),
  weeks_at_extreme    INTEGER     NOT NULL DEFAULT 0,

  -- Trend
  trend_direction     TEXT        NOT NULL DEFAULT 'flat'
                      CHECK (trend_direction IN ('accumulating', 'distributing', 'flat')),
  trend_weeks         INTEGER     NOT NULL DEFAULT 0,

  -- Change of Character (Richtungswechsel)
  coc_detected        BOOLEAN     NOT NULL DEFAULT false,
  coc_type            TEXT        CHECK (coc_type IN ('long_to_short', 'short_to_long')),
  coc_date            TEXT,

  -- Spec vs. Commercial Divergenz
  spec_commercial_divergence BOOLEAN NOT NULL DEFAULT false,  -- Spekulanten ≠ Commercials
  spec_commercial_detail     TEXT,                             -- Beschreibung

  -- Composite Smart Score (-100 bis +100)
  smart_score         INTEGER     NOT NULL DEFAULT 0,

  -- Open Interest Analyse
  oi_trend            TEXT        NOT NULL DEFAULT 'flat'
                      CHECK (oi_trend IN ('rising', 'falling', 'flat')),
  oi_divergence       BOOLEAN     NOT NULL DEFAULT false,

  -- ══════════════════════════════════════════════════════════
  -- SMART COT v2 — Erweiterte Analyse
  -- ══════════════════════════════════════════════════════════

  -- Spec Crowding (Non-Commercials Extrempositionierung)
  spec_net             NUMERIC    NOT NULL DEFAULT 0,
  spec_percentile      NUMERIC(5,2) NOT NULL DEFAULT 50,
  spec_crowding_extreme BOOLEAN   NOT NULL DEFAULT false,
  spec_crowding_type   TEXT       CHECK (spec_crowding_type IN ('crowded_long', 'crowded_short')),

  -- Saisonalität
  seasonal_bias        TEXT       NOT NULL DEFAULT 'neutral'
                       CHECK (seasonal_bias IN ('bullish', 'bearish', 'neutral')),
  seasonal_strength    INTEGER    NOT NULL DEFAULT 0,  -- 0-100

  -- Zinsdifferenz
  rate_differential    NUMERIC    NOT NULL DEFAULT 0,
  rate_trend           TEXT       NOT NULL DEFAULT 'neutral'
                       CHECK (rate_trend IN ('hawkish', 'dovish', 'neutral')),
  rate_cot_confluence  BOOLEAN    NOT NULL DEFAULT false,

  -- Regime-Erkennung
  regime               TEXT       NOT NULL DEFAULT 'ranging'
                       CHECK (regime IN ('trending_bullish', 'trending_bearish', 'ranging', 'transitioning')),
  regime_confidence    INTEGER    NOT NULL DEFAULT 0,

  -- Historische Performance ähnlicher Setups
  historical_win_rate  NUMERIC(5,2),
  historical_avg_weeks INTEGER,  -- durchschnittliche Wochen bis Auflösung
  historical_sample_size INTEGER NOT NULL DEFAULT 0,

  -- ML / KNN Pattern Matching
  similar_setups       JSONB     NOT NULL DEFAULT '[]',
  -- [{date, percentile, momentum, outcome_4w, outcome_8w}]
  ml_direction         TEXT      CHECK (ml_direction IN ('bullish', 'bearish', 'neutral')),
  ml_confidence        NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Final Conviction Score (alles kombiniert, -100 bis +100)
  final_conviction     INTEGER   NOT NULL DEFAULT 0,

  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, currency)
);

ALTER TABLE cot_currency_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cot_currency_analysis: eigene Daten"
  ON cot_currency_analysis FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cot_analysis_user ON cot_currency_analysis(user_id);

CREATE OR REPLACE TRIGGER trg_cot_analysis_updated_at
  BEFORE UPDATE ON cot_currency_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 11. SMART COT – PAIR SIGNALS  (Pair-Empfehlungen)
-- ============================================================
-- Berechnete Pair-Richtungsempfehlungen basierend auf
-- Smart-Score-Divergenz zwischen Base und Quote.
-- ============================================================

CREATE TABLE IF NOT EXISTS cot_pair_signals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair                 TEXT        NOT NULL,     -- z.B. 'EUR/USD'

  -- Empfehlung
  direction            TEXT        NOT NULL CHECK (direction IN ('long', 'short')),
  strength             INTEGER     NOT NULL DEFAULT 0 CHECK (strength BETWEEN 0 AND 5),
  smart_score          INTEGER     NOT NULL DEFAULT 0,  -- -100 bis +100

  -- Komponenten
  base_currency        TEXT        NOT NULL,
  base_smart_score     INTEGER     NOT NULL DEFAULT 0,
  quote_currency       TEXT        NOT NULL,
  quote_smart_score    INTEGER     NOT NULL DEFAULT 0,
  divergence_score     INTEGER     NOT NULL DEFAULT 0,
  momentum_aligned     BOOLEAN     NOT NULL DEFAULT false,

  -- Begründung
  reasons              JSONB       NOT NULL DEFAULT '[]',
  -- [{factor: 'momentum', description: 'EUR 4W-Momentum +12k (bullish)', impact: 'positive'}]

  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, pair)
);

ALTER TABLE cot_pair_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cot_pair_signals: eigene Daten"
  ON cot_pair_signals FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cot_pairs_user   ON cot_pair_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_cot_pairs_score  ON cot_pair_signals(user_id, smart_score DESC);

CREATE OR REPLACE TRIGGER trg_cot_pairs_updated_at
  BEFORE UPDATE ON cot_pair_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 13. FUNDAMENTALS-NOTIZEN
-- ============================================================

CREATE TABLE IF NOT EXISTS fundamentals_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section    TEXT        NOT NULL CHECK (section IN ('cot', 'news', 'currency', 'general')),
  currency   TEXT,
  title      TEXT        NOT NULL DEFAULT '',
  content    TEXT        NOT NULL DEFAULT '',
  tags       TEXT[]      NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fundamentals_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fundamentals: eigene Notizen"
  ON fundamentals_notes FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fundamentals_user    ON fundamentals_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_fundamentals_section ON fundamentals_notes(user_id, section);

CREATE OR REPLACE TRIGGER trg_fundamentals_updated_at
  BEFORE UPDATE ON fundamentals_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 14. PAIR-NOTIZEN
-- ============================================================

CREATE TABLE IF NOT EXISTS pair_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair       TEXT        NOT NULL,
  notes      TEXT        NOT NULL DEFAULT '',
  bias       TEXT        CHECK (bias IN ('bullish', 'bearish', 'neutral')),
  key_levels JSONB       NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, pair)
);

ALTER TABLE pair_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pair_notes: eigene Pair-Notizen"
  ON pair_notes FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pair_notes_user ON pair_notes(user_id);


-- ============================================================
-- 15. RISK-EINSTELLUNGEN
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings   JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk: eigene Risikoeinstellungen"
  ON risk_settings FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_risk_updated_at
  BEFORE UPDATE ON risk_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 16. USER_PREFERENCES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preferences: eigene Einstellungen"
  ON user_preferences FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 17. USER_WATCHLISTS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_watchlists (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  watchlists      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  color_labels    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  dashboard_color TEXT        DEFAULT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_watchlists: eigene Daten"
  ON user_watchlists FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_user_watchlists_updated_at
  BEFORE UPDATE ON user_watchlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 18. USER_WIDGET_SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS user_widget_settings (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_widget_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_widget_settings: eigene Daten"
  ON user_widget_settings FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_user_widget_settings_updated_at
  BEFORE UPDATE ON user_widget_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- VIEW: account_configs  (Abwärtskompatibilität)
-- ============================================================

CREATE OR REPLACE VIEW account_configs AS
SELECT
  id,
  user_id,
  type,
  name,
  broker,
  initial_balance       AS initial_start_balance,
  current_balance,
  currency,
  default_risk_per_trade,
  enable_goals,
  profit_target_value,
  profit_target_type,
  profit_target,
  max_drawdown_value,
  max_drawdown_type,
  max_drawdown,
  daily_drawdown_value,
  daily_drawdown_type,
  chapters,
  active_chapter_id,
  is_active,
  is_default,
  created_at,
  updated_at
FROM accounts
WHERE is_default = true;


-- ============================================================
-- HILFSFUNKTIONEN
-- ============================================================

CREATE OR REPLACE FUNCTION get_account_total_r(
  p_account_id UUID,
  p_from_date  TEXT DEFAULT NULL,
  p_to_date    TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(r_multiple), 0)
  FROM trades
  WHERE account_id = p_account_id
    AND status = 'closed'
    AND (p_from_date IS NULL OR date >= p_from_date)
    AND (p_to_date   IS NULL OR date <= p_to_date)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_account_win_rate(
  p_account_id UUID,
  p_from_date  TEXT DEFAULT NULL,
  p_to_date    TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
  SELECT
    CASE COUNT(*) WHEN 0 THEN 0
    ELSE ROUND(COUNT(*) FILTER (WHERE result = 'win') * 100.0 / COUNT(*), 2)
    END
  FROM trades
  WHERE account_id = p_account_id
    AND status = 'closed'
    AND result IS NOT NULL
    AND (p_from_date IS NULL OR date >= p_from_date)
    AND (p_to_date   IS NULL OR date <= p_to_date)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_account_profit_factor(
  p_account_id UUID,
  p_from_date  TEXT DEFAULT NULL,
  p_to_date    TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
  SELECT
    CASE
      WHEN COALESCE(ABS(SUM(r_multiple) FILTER (WHERE r_multiple < 0)), 0) = 0 THEN NULL
      ELSE ROUND(
        COALESCE(SUM(r_multiple) FILTER (WHERE r_multiple > 0), 0) /
        ABS(SUM(r_multiple) FILTER (WHERE r_multiple < 0)), 2
      )
    END
  FROM trades
  WHERE account_id = p_account_id
    AND status = 'closed'
    AND result IS NOT NULL
    AND (p_from_date IS NULL OR date >= p_from_date)
    AND (p_to_date   IS NULL OR date <= p_to_date)
$$ LANGUAGE sql STABLE;


-- ============================================================
-- GRANTS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL   ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL   ON ALL ROUTINES  IN SCHEMA public TO authenticated;


-- ============================================================
-- TABELLENÜBERSICHT
-- ============================================================
--
--  #  Tabelle                  Inhalt
-- --  -----------------------  -----------------------------------
--  1  user_profiles            Anzeigename, Avatar
--  2  accounts                 EK- und Funded-Konten (Multi)
--  3  strategies               Trading-Strategien + Regeln
--  4  outlooks                 Trading-Thesen inkl. Zone + Bild
--  5  trades                   Alle Live- und Backtest-Trades
--  6  trade_screenshots        Entry/Exit-Screenshots (Base64)
--  7  transactions             Einzahlungen, Auszahlungen, Payouts
--  8  backtest_sessions        Backtest-Läufe mit Trades + Stats
--  9  cot_snapshots            Wöchentliche CFTC-Rohdaten (History)
-- 10  cot_currency_analysis    Smart COT Analyse pro Währung
-- 11  cot_pair_signals         Smart COT Pair-Empfehlungen
-- 12  fundamentals_notes       COT/News/Währungs-Analysenotizen
-- 13  pair_notes               Pair-spez. Bias + Schlüsselniveaus
-- 14  risk_settings            Risikomanagement-Konfiguration
-- 15  user_preferences         App-Settings (Confluences, Theme …)
-- 16  user_watchlists          Watchlists + Farblabels
-- 17  user_widget_settings     Dashboard-Widget-Config
-- --  -----------------------  -----------------------------------
--     account_configs          VIEW auf default-Accounts
-- ============================================================
