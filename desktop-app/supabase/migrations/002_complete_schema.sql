-- ============================================================
-- Trading Journal - Vollständiges Datenbankschema v2
-- ============================================================
-- Enthält: Accounts (Multi), Trades, Screenshots, Transaktionen,
--          Outlooks, Backtest, Strategien, Risk, COT, Fundamentals,
--          Pair-Notizen, Benutzereinstellungen.
--
-- Ausführung: Supabase SQL Editor
-- Reihenfolge: accounts → strategies → trades → rest
-- ============================================================

-- Hilfsfunktion für auto-updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. ACCOUNTS (Multi-Account-Unterstützung)
-- ============================================================
-- Ersetzt account_configs als zentrale Kontoqelle.
-- Unterstützt beliebig viele Funded-Accounts pro Nutzer.
-- EK: typischerweise 1 Konto. Funded: beliebig viele.
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identität
  name          TEXT        NOT NULL,              -- z.B. "FTMO $100k #2", "Eigenkapital"
  type          TEXT        NOT NULL CHECK (type IN ('ek', 'funded')),
  broker        TEXT        NOT NULL DEFAULT '',   -- z.B. "FTMO", "MFT", "IC Markets"
  account_number TEXT       NOT NULL DEFAULT '',   -- Broker-Kontonummer

  -- Balance
  currency      TEXT        NOT NULL DEFAULT 'USD',
  initial_balance  NUMERIC(15,2) NOT NULL DEFAULT 0,
  current_balance  NUMERIC(15,2) NOT NULL DEFAULT 0,

  -- Funded-Ziele (nur für funded relevant)
  enable_goals            BOOLEAN DEFAULT false,
  profit_target_value     NUMERIC(10,4),
  profit_target_type      TEXT CHECK (profit_target_type IN ('percent', 'absolute')),
  profit_target           NUMERIC(15,2),     -- Berechneter absoluter Zielwert
  max_drawdown_value      NUMERIC(10,4),
  max_drawdown_type       TEXT CHECK (max_drawdown_type IN ('percent', 'absolute')),
  max_drawdown            NUMERIC(15,2),     -- Berechneter absoluter Drawdown-Floor

  -- Trade-Einstellungen
  default_risk_per_trade  NUMERIC(6,3) NOT NULL DEFAULT 1.0,

  -- Kapitel/Perioden (z.B. nach Payout, Reset)
  chapters                JSONB  NOT NULL DEFAULT '[]',
  active_chapter_id       TEXT,

  -- Status
  is_active               BOOLEAN NOT NULL DEFAULT true,
  is_default              BOOLEAN NOT NULL DEFAULT false,  -- Standardkonto für diesen Typ

  -- Notizen
  notes                   TEXT    NOT NULL DEFAULT '',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts: Nutzer verwalten eigene Konten"
  ON accounts FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user        ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_type   ON accounts(user_id, type);
CREATE INDEX IF NOT EXISTS idx_accounts_default     ON accounts(user_id, type) WHERE is_default = true;

CREATE OR REPLACE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. STRATEGIEN
-- ============================================================
-- Muss vor backtest_sessions kommen (FK).
-- ============================================================

CREATE TABLE IF NOT EXISTS strategies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name         TEXT       NOT NULL,
  description  TEXT       NOT NULL DEFAULT '',
  direction    TEXT       NOT NULL DEFAULT 'both' CHECK (direction IN ('long', 'short', 'both')),

  -- Regeln als JSONB-Arrays: [{ id, text, type, required }]
  rules        JSONB      NOT NULL DEFAULT '[]',

  -- Instrumente & Sessions
  pairs        TEXT[]     NOT NULL DEFAULT '{}',
  timeframes   TEXT[]     NOT NULL DEFAULT '{}',
  sessions     TEXT[]     NOT NULL DEFAULT '{}',

  -- Status
  is_active    BOOLEAN    NOT NULL DEFAULT true,

  -- Performance-Statistiken (aus verknüpften Backtests/Trades)
  stats        JSONB      NOT NULL DEFAULT '{}',

  notes        TEXT       NOT NULL DEFAULT '',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategies: Nutzer verwalten eigene Strategien"
  ON strategies FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_strategies_user     ON strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_strategies_active   ON strategies(user_id, is_active);

CREATE OR REPLACE TRIGGER trg_strategies_updated_at
  BEFORE UPDATE ON strategies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. TRADES (Kern-Handelsdaten)
-- ============================================================
-- Zentrale Tabelle aller Live-Trades.
-- account_id verknüpft mit accounts.id für Multi-Account.
-- type bleibt für Abwärtskompatibilität erhalten.
-- ============================================================

CREATE TABLE IF NOT EXISTS trades (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  UUID        REFERENCES accounts(id) ON DELETE SET NULL,

  -- Abwärtskompatibilität
  type        TEXT        NOT NULL CHECK (type IN ('ek', 'funded')),

  -- Trade-Grunddaten
  pair        TEXT        NOT NULL,
  direction   TEXT        NOT NULL CHECK (direction IN ('long', 'short')),
  date        TEXT        NOT NULL,               -- ISO-Datum: YYYY-MM-DD
  result      TEXT        CHECK (result IN ('win', 'loss', 'breakeven')),

  -- Performance
  r_multiple          NUMERIC(10,4)  NOT NULL DEFAULT 0,
  risk_percent        NUMERIC(8,4),
  risk_amount         NUMERIC(15,2),
  profit_amount       NUMERIC(15,2),
  pnl                 NUMERIC(15,2),

  -- Preisniveaus
  entry_price         NUMERIC(18,6),
  exit_price          NUMERIC(18,6),
  stop_loss           NUMERIC(18,6),
  take_profit         NUMERIC(18,6),
  quantity            NUMERIC(15,6),
  lot_size            NUMERIC(10,4),

  -- Balance-Tracking (Snapshot für Equity-Kurve)
  account_balance_before  NUMERIC(15,2),
  account_balance_after   NUMERIC(15,2),
  running_balance         NUMERIC(15,2),

  -- Session
  session_type        TEXT        NOT NULL DEFAULT 'live' CHECK (session_type IN ('live', 'backtest')),
  session             TEXT        NOT NULL DEFAULT '',  -- London / NY / Asia / Overlap

  -- Status
  status              TEXT        NOT NULL DEFAULT 'closed' CHECK (status IN ('open', 'closed')),

  -- Setup-Flags
  setup_daily_bos         BOOLEAN NOT NULL DEFAULT false,
  setup_value_area        BOOLEAN NOT NULL DEFAULT false,
  setup_market_structure  BOOLEAN NOT NULL DEFAULT false,
  setup_weekly_gva        BOOLEAN NOT NULL DEFAULT false,
  setup_3day_gva          BOOLEAN NOT NULL DEFAULT false,

  -- Freitext
  notes               TEXT        NOT NULL DEFAULT '',
  comment             TEXT        NOT NULL DEFAULT '',

  -- Verknüpfungen
  chapter_id          TEXT,                              -- Kapitel-ID (aus Account)
  outlook_id          UUID        REFERENCES outlooks(id) ON DELETE SET NULL,
  strategy_id         UUID        REFERENCES strategies(id) ON DELETE SET NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades: Nutzer verwalten eigene Trades"
  ON trades FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trades_user        ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account     ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_type        ON trades(user_id, type);
CREATE INDEX IF NOT EXISTS idx_trades_date        ON trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_result      ON trades(user_id, result);
CREATE INDEX IF NOT EXISTS idx_trades_outlook     ON trades(outlook_id);

CREATE OR REPLACE TRIGGER trg_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. TRADE-SCREENSHOTS
-- ============================================================
-- Trennt Bilder von Trade-Daten für bessere Performance.
-- Bilder werden als Base64-Text gespeichert.
-- Alternativ: Supabase Storage (empfohlen für > 1 MB Bilder).
-- ============================================================

CREATE TABLE IF NOT EXISTS trade_screenshots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id      UUID        NOT NULL REFERENCES trades(id) ON DELETE CASCADE,

  label         TEXT        NOT NULL DEFAULT 'entry' CHECK (label IN ('entry', 'exit', 'analysis', 'overview')),
  screenshot_data TEXT      NOT NULL,              -- Base64-kodiertes Bild
  mime_type     TEXT        NOT NULL DEFAULT 'image/png',
  file_size_kb  INTEGER,                           -- Dateigröße (optional)

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trade_screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "screenshots: Nutzer verwalten eigene Screenshots"
  ON trade_screenshots FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_screenshots_trade  ON trade_screenshots(trade_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_user   ON trade_screenshots(user_id);

-- ============================================================
-- 5. TRANSAKTIONEN (Einzahlungen, Auszahlungen, Payouts)
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id      UUID        REFERENCES accounts(id) ON DELETE CASCADE,

  -- Abwärtskompatibilität
  type            TEXT        NOT NULL CHECK (type IN ('ek', 'funded')),
  transaction_type TEXT       NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'payout')),

  amount          NUMERIC(15,2) NOT NULL,
  date            TEXT          NOT NULL,
  note            TEXT          NOT NULL DEFAULT '',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions: Nutzer verwalten eigene Transaktionen"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user     ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account  ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(user_id, date DESC);

-- ============================================================
-- 6. OUTLOOKS (Trading-Thesen)
-- ============================================================
-- Vollständig überarbeitetes Schema passend zur App-Logik.
-- Status-Werte: observation → waiting → active → executed/cancelled
-- ============================================================

CREATE TABLE IF NOT EXISTS outlooks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  symbol      TEXT        NOT NULL,
  direction   TEXT        NOT NULL CHECK (direction IN ('long', 'short')),
  thesis      TEXT        NOT NULL DEFAULT '',
  confidence  INTEGER     NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  status      TEXT        NOT NULL DEFAULT 'observation'
                          CHECK (status IN ('observation', 'waiting', 'active', 'cancelled', 'executed')),

  -- COT-Bias als JSONB: { base: {currency, signal, percentile}, quote: {...}, divergenceScore }
  cot_bias    JSONB,

  -- Preisniveaus
  target_entry  NUMERIC(18,6),
  target_sl     NUMERIC(18,6),
  target_tp     NUMERIC(18,6),

  -- Tags (Fundamental, Technisch, COT-Divergenz, ...)
  tags          TEXT[]    NOT NULL DEFAULT '{}',

  -- Lebenszyklus
  started_at          TIMESTAMPTZ,                -- Wann Trade gestartet wurde
  executed_trade_id   UUID REFERENCES trades(id) ON DELETE SET NULL,
  journaled_to        TEXT[]  NOT NULL DEFAULT '{}',  -- ['ek', 'funded']

  -- Ablauf
  expires_at    TEXT,                             -- ISO-Datum

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE outlooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outlooks: Nutzer verwalten eigene Thesen"
  ON outlooks FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_outlooks_user    ON outlooks(user_id);
CREATE INDEX IF NOT EXISTS idx_outlooks_status  ON outlooks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outlooks_symbol  ON outlooks(user_id, symbol);

CREATE OR REPLACE TRIGGER trg_outlooks_updated_at
  BEFORE UPDATE ON outlooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Jetzt den FK in trades nachtragen (outlooks existiert jetzt)
-- Wird beim ersten CREATE bereits referenziert; kein ALTER nötig wenn Schema neu.
-- Beim Upgrade einer bestehenden DB:
-- ALTER TABLE trades ADD COLUMN IF NOT EXISTS outlook_id UUID REFERENCES outlooks(id) ON DELETE SET NULL;

-- ============================================================
-- 7. BACKTEST-SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS backtest_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id  UUID        REFERENCES strategies(id) ON DELETE SET NULL,

  name         TEXT        NOT NULL,
  pair         TEXT        NOT NULL,
  timeframe    TEXT        NOT NULL DEFAULT '1H',
  strategy     TEXT        NOT NULL DEFAULT '',   -- Strategie-Name (Freitext-Fallback)

  start_date   TEXT,
  end_date     TEXT,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes        TEXT        NOT NULL DEFAULT '',

  elapsed_ms   BIGINT      NOT NULL DEFAULT 0,   -- Gesamte Sitzungszeit in ms

  -- Trades als JSONB für schnelle Abfrage ohne JOIN
  -- Format: [{ id, pair, direction, result, rMultiple, date, setups[], timestamp, screenshot? }]
  trades       JSONB       NOT NULL DEFAULT '[]',

  -- Berechnete Statistiken (Cache)
  stats        JSONB       NOT NULL DEFAULT '{}',
  -- { totalTrades, wins, losses, winRate, totalR, avgR, profitFactor, maxDrawdown }

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE backtest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backtest: Nutzer verwalten eigene Sessions"
  ON backtest_sessions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_backtest_user      ON backtest_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy  ON backtest_sessions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_status    ON backtest_sessions(user_id, status);

CREATE OR REPLACE TRIGGER trg_backtest_updated_at
  BEFORE UPDATE ON backtest_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. RISK-EINSTELLUNGEN
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_settings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Alle Einstellungen als JSONB für Flexibilität:
  -- { dailyLossLimitEnabled, dailyLossLimitR, dailyLossLimitPercent,
  --   dailyTradeLimit, weeklyLossLimitEnabled, weeklyLossLimitR,
  --   weeklyLossLimitPercent, drawdownAlertEnabled, drawdownAlertThreshold,
  --   consecutiveLossAlertEnabled, consecutiveLossLimit,
  --   tiltDetectionEnabled, tiltTradeFrequency, tiltFrequencyWindow }
  settings    JSONB       NOT NULL DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risk: Nutzer verwalten eigene Einstellungen"
  ON risk_settings FOR ALL
  USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_risk_updated_at
  BEFORE UPDATE ON risk_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. COT-VERLAUF (Commitment of Traders – Fundamentals)
-- ============================================================

CREATE TABLE IF NOT EXISTS cot_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  date        TEXT        NOT NULL,              -- ISO-Datum der Veröffentlichung
  currency    TEXT        NOT NULL,              -- EUR, USD, GBP, JPY, AUD, CAD, CHF, NZD

  -- Positionsdaten (aus CFTC-Report)
  commercials_net     NUMERIC,
  commercials_long    NUMERIC,
  commercials_short   NUMERIC,
  large_specs_net     NUMERIC,
  large_specs_long    NUMERIC,
  large_specs_short   NUMERIC,
  small_specs_net     NUMERIC,
  small_specs_long    NUMERIC,
  small_specs_short   NUMERIC,
  open_interest       NUMERIC,

  -- Abgeleitete Signale
  signal              TEXT CHECK (signal IN ('strong_long', 'long', 'neutral', 'short', 'strong_short')),
  percentile_rank     NUMERIC(5,2),              -- 0–100 (historischer Vergleich)

  -- Preis zum Zeitpunkt des Snapshots (optional)
  price_at_snapshot   NUMERIC(18,6),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, date, currency)
);

ALTER TABLE cot_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cot: Nutzer verwalten eigene COT-Daten"
  ON cot_history FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cot_user_currency  ON cot_history(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_cot_user_date      ON cot_history(user_id, date DESC);

-- ============================================================
-- 10. FUNDAMENTALS-NOTIZEN (COT + News + Währungsanalyse)
-- ============================================================

CREATE TABLE IF NOT EXISTS fundamentals_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  section     TEXT        NOT NULL CHECK (section IN ('cot', 'news', 'currency', 'general')),
  currency    TEXT,                              -- Bezieht sich auf diese Währung (optional)
  title       TEXT        NOT NULL DEFAULT '',
  content     TEXT        NOT NULL DEFAULT '',
  tags        TEXT[]      NOT NULL DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fundamentals_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fundamentals: Nutzer verwalten eigene Notizen"
  ON fundamentals_notes FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fundamentals_user      ON fundamentals_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_fundamentals_section   ON fundamentals_notes(user_id, section);

CREATE OR REPLACE TRIGGER trg_fundamentals_updated_at
  BEFORE UPDATE ON fundamentals_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. PAIR-NOTIZEN (Währungsanalyse pro Pair)
-- ============================================================

CREATE TABLE IF NOT EXISTS pair_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  pair        TEXT        NOT NULL,              -- z.B. "EURUSD"
  notes       TEXT        NOT NULL DEFAULT '',
  bias        TEXT        CHECK (bias IN ('bullish', 'bearish', 'neutral')),
  key_levels  JSONB       NOT NULL DEFAULT '[]', -- [{ level, label, type }]

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, pair)
);

ALTER TABLE pair_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pair_notes: Nutzer verwalten eigene Pair-Notizen"
  ON pair_notes FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pair_notes_user  ON pair_notes(user_id);

-- ============================================================
-- 12. BENUTZEREINSTELLUNGEN (UI & App-Präferenzen)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Alle UI-Einstellungen als JSONB:
  -- { theme, sidebarCollapsed, defaultAccountId, defaultRisk,
  --   activeAccountIds: { ek: uuid, funded: uuid } }
  preferences JSONB       NOT NULL DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferences: Nutzer verwalten eigene Einstellungen"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION: account_configs → accounts
-- ============================================================
-- Falls account_configs bereits existiert: Daten übernehmen.
-- Danach kann account_configs als View oder Alias dienen.
-- ============================================================

DO $$
BEGIN
  -- Nur ausführen wenn account_configs existiert
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'account_configs') THEN

    -- Bestehende Konfigurationen in accounts übertragen
    INSERT INTO accounts (
      user_id, name, type, currency,
      initial_balance, current_balance,
      default_risk_per_trade,
      enable_goals,
      profit_target_value, profit_target_type, profit_target,
      max_drawdown_value, max_drawdown_type, max_drawdown,
      chapters, active_chapter_id,
      is_active, is_default,
      created_at, updated_at
    )
    SELECT
      user_id,
      CASE type WHEN 'ek' THEN 'Eigenkapital' ELSE 'Funded Account' END,
      type,
      COALESCE(currency, 'USD'),
      COALESCE(initial_start_balance, 10000),
      COALESCE(current_balance, 10000),
      COALESCE(default_risk_per_trade, 1.0),
      COALESCE(enable_goals, false),
      profit_target_value, profit_target_type, profit_target,
      max_drawdown_value, max_drawdown_type, max_drawdown,
      COALESCE(chapters, '[]'),
      active_chapter_id,
      true,   -- is_active
      true,   -- is_default (erster Account pro Typ)
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM account_configs
    ON CONFLICT DO NOTHING;

  END IF;
END $$;

-- ============================================================
-- MIGRATION: Trades – account_id nachtragen
-- ============================================================
-- Verknüpft bestehende Trades mit dem Standard-Account.
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  acc_id UUID;
BEGIN
  -- Für jeden Nutzer + Typ: Standard-Account finden und Trades verknüpfen
  FOR rec IN
    SELECT DISTINCT user_id, type FROM trades WHERE account_id IS NULL
  LOOP
    SELECT id INTO acc_id
    FROM accounts
    WHERE user_id = rec.user_id
      AND type = rec.type
      AND is_default = true
    LIMIT 1;

    IF acc_id IS NOT NULL THEN
      UPDATE trades
      SET account_id = acc_id
      WHERE user_id = rec.user_id
        AND type = rec.type
        AND account_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- MIGRATION: Transaktionen – account_id nachtragen
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  acc_id UUID;
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id, type FROM transactions WHERE account_id IS NULL
  LOOP
    SELECT id INTO acc_id
    FROM accounts
    WHERE user_id = rec.user_id
      AND type = rec.type
      AND is_default = true
    LIMIT 1;

    IF acc_id IS NOT NULL THEN
      UPDATE transactions
      SET account_id = acc_id
      WHERE user_id = rec.user_id
        AND type = rec.type
        AND account_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- VIEW: account_configs (Abwärtskompatibilität)
-- ============================================================
-- Falls alter Code noch account_configs liest, liefert diese
-- View den Standard-Account pro Nutzer und Typ.
-- ============================================================

CREATE OR REPLACE VIEW account_configs AS
SELECT
  id,
  user_id,
  type,
  initial_balance    AS initial_start_balance,
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
  chapters,
  active_chapter_id,
  created_at,
  updated_at
FROM accounts
WHERE is_default = true;

-- ============================================================
-- STORAGE: Supabase Storage Bucket für Screenshots
-- ============================================================
-- Alternativer Ansatz zu Base64 in trade_screenshots:
-- Supabase Storage speichert Bilder effizienter.
-- Uncomment bei Bedarf:
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('trade-screenshots', 'trade-screenshots', false)
-- ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY "screenshots_storage: Nutzer sehen eigene Bilder"
--   ON storage.objects FOR SELECT
--   USING (auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "screenshots_storage: Nutzer laden hoch"
--   ON storage.objects FOR INSERT
--   WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "screenshots_storage: Nutzer löschen eigene"
--   ON storage.objects FOR DELETE
--   USING (auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- HILFSFUNKTIONEN
-- ============================================================

-- Berechnet Gesamt-R für einen Account in einem Zeitraum
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

-- Win-Rate für einen Account
CREATE OR REPLACE FUNCTION get_account_win_rate(
  p_account_id UUID,
  p_from_date  TEXT DEFAULT NULL,
  p_to_date    TEXT DEFAULT NULL
)
RETURNS NUMERIC AS $$
  SELECT
    CASE COUNT(*) WHEN 0 THEN 0
    ELSE ROUND(
      COUNT(*) FILTER (WHERE result = 'win') * 100.0 / COUNT(*),
      2
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
-- GRANT: Supabase anon / authenticated Rollen
-- ============================================================
-- Supabase setzt dies normalerweise automatisch.
-- Bei manueller Installation:
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO authenticated;
