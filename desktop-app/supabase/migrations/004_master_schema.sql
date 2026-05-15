-- ============================================================
-- Trading Journal – Vollständiges Datenbankschema
-- Version: 4.0  (Mai 2026)
-- ============================================================
-- Dieses Skript erstellt die GESAMTE Datenbank von Grund auf.
-- Für eine leere Supabase-DB: einfach im SQL-Editor ausführen.
-- Reihenfolge: accounts → strategies → outlooks → trades → rest
-- (trades ↔ outlooks zirkulär → executed_trade_id per ALTER TABLE)
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
-- 1. USER_PROFILES  (Anzeigename, Profilbild)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  display_name  TEXT,                          -- "Max", "Kerim" – Begrüßung im Dashboard
  avatar_url    TEXT,                          -- optional: Profilbild-URL

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
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identifikation
  name              TEXT          NOT NULL,
  type              TEXT          NOT NULL CHECK (type IN ('ek', 'funded')),
  broker            TEXT          NOT NULL DEFAULT '',
  account_number    TEXT          NOT NULL DEFAULT '',

  -- Kapital
  currency          TEXT          NOT NULL DEFAULT 'USD',
  initial_balance   NUMERIC(15,2) NOT NULL DEFAULT 0,  -- Startkapital
  current_balance   NUMERIC(15,2) NOT NULL DEFAULT 0,  -- Aktuelle Balance

  -- Funded-Ziele
  enable_goals          BOOLEAN       DEFAULT false,
  profit_target_value   NUMERIC(10,4),           -- z.B. 8.0  (Prozent)
  profit_target_type    TEXT          CHECK (profit_target_type    IN ('percent', 'absolute')),
  profit_target         NUMERIC(15,2),           -- absoluter Zielwert in Währung
  max_drawdown_value    NUMERIC(10,4),           -- z.B. 5.0  (Prozent)
  max_drawdown_type     TEXT          CHECK (max_drawdown_type     IN ('percent', 'absolute')),
  max_drawdown          NUMERIC(15,2),           -- absoluter Drawdown-Wert
  daily_drawdown_value  NUMERIC(10,4),           -- z.B. 2.0  (Tages-DD %)
  daily_drawdown_type   TEXT          CHECK (daily_drawdown_type   IN ('percent', 'absolute')),

  -- Risiko-Standard
  default_risk_per_trade NUMERIC(6,3) NOT NULL DEFAULT 1.0,  -- % pro Trade

  -- Kapitel (Account-Neustarts, JSON-Array)
  -- [{id, startBalance, startDate, endDate?, reason}]
  chapters              JSONB         NOT NULL DEFAULT '[]',
  active_chapter_id     TEXT,

  -- Status
  is_active             BOOLEAN       NOT NULL DEFAULT true,
  is_default            BOOLEAN       NOT NULL DEFAULT false,
  notes                 TEXT          NOT NULL DEFAULT '',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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

  name         TEXT       NOT NULL,
  description  TEXT       NOT NULL DEFAULT '',
  direction    TEXT       NOT NULL DEFAULT 'both' CHECK (direction IN ('long', 'short', 'both')),
  rules        JSONB      NOT NULL DEFAULT '[]',   -- [{title, description}]
  pairs        TEXT[]     NOT NULL DEFAULT '{}',
  timeframes   TEXT[]     NOT NULL DEFAULT '{}',
  sessions     TEXT[]     NOT NULL DEFAULT '{}',
  is_active    BOOLEAN    NOT NULL DEFAULT true,
  stats        JSONB      NOT NULL DEFAULT '{}',   -- gecachte Statistiken
  notes        TEXT       NOT NULL DEFAULT '',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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
-- executed_trade_id (→ trades) wird NACH trades per ALTER TABLE
-- hinzugefügt, um die Zirkularität zu umgehen.
-- ============================================================

CREATE TABLE IF NOT EXISTS outlooks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Kern-These
  symbol      TEXT        NOT NULL,
  direction   TEXT        NOT NULL CHECK (direction IN ('long', 'short')),
  thesis      TEXT        NOT NULL DEFAULT '',
  confidence  INTEGER     NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  status      TEXT        NOT NULL DEFAULT 'observation'
                CHECK (status IN ('observation', 'waiting', 'active', 'cancelled', 'executed')),

  -- COT-Analyse (gespeicherter Bias zum Erstellungszeitpunkt)
  -- {base: {currency, signal, percentile}, quote: {…}, divergenceScore}
  cot_bias    JSONB,

  -- Preisniveaus
  target_entry  NUMERIC(18,6),
  target_sl     NUMERIC(18,6),
  target_tp     NUMERIC(18,6),

  -- Confluences & Schlagworte (gleiche Liste wie in Settings)
  -- Gespeichert als Text-Array, z.B. ['Fundamental', 'SMC']
  confluences   TEXT[]    NOT NULL DEFAULT '{}',
  tags          TEXT[]    NOT NULL DEFAULT '{}',   -- legacy

  -- Zeitstempel & Links
  started_at          TIMESTAMPTZ,
  -- executed_trade_id: wird unten als ALTER TABLE ergänzt
  journaled_to        TEXT[]    NOT NULL DEFAULT '{}',  -- ['ek', 'funded']
  expires_at          TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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
-- 5. TRADES  (Kern-Handelsdaten)
-- ============================================================

CREATE TABLE IF NOT EXISTS trades (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  UUID          REFERENCES accounts(id)   ON DELETE SET NULL,
  outlook_id  UUID          REFERENCES outlooks(id)   ON DELETE SET NULL,
  strategy_id UUID          REFERENCES strategies(id) ON DELETE SET NULL,

  -- Klassifikation
  type        TEXT          NOT NULL CHECK (type IN ('ek', 'funded')),
  symbol      TEXT          NOT NULL,                  -- Währungspaar, z.B. EURUSD
  side        TEXT          NOT NULL CHECK (side IN ('long', 'short')),
  date        TEXT          NOT NULL,                  -- YYYY-MM-DD
  result      TEXT          CHECK (result IN ('win', 'loss', 'breakeven')),
  status      TEXT          NOT NULL DEFAULT 'closed'  CHECK (status IN ('open', 'closed')),
  session_type TEXT         NOT NULL DEFAULT 'live'    CHECK (session_type IN ('live', 'backtest')),
  session     TEXT          NOT NULL DEFAULT '',        -- 'London', 'NY', 'Asia'

  -- R-Metrik & Risiko
  r_multiple          NUMERIC(10,4)  NOT NULL DEFAULT 0,
  risk_percent        NUMERIC(8,4),                    -- % des Kontos
  risk_amount         NUMERIC(15,2),                   -- absoluter Risikobetrag
  profit_amount       NUMERIC(15,2),                   -- Gewinn/Verlust
  pnl                 NUMERIC(15,2),                   -- realer P/L (falls abweichend)

  -- Preisniveaus
  entry_price         NUMERIC(18,6),
  exit_price          NUMERIC(18,6),
  stop_loss           NUMERIC(18,6),
  take_profit         NUMERIC(18,6),
  quantity            NUMERIC(15,6),
  lot_size            NUMERIC(10,4),

  -- Balance-Tracking
  account_balance_before  NUMERIC(15,2),
  account_balance_after   NUMERIC(15,2),
  running_balance         NUMERIC(15,2),

  -- Legacy Setup-Flags (Boolean-Schnellfilter)
  setup_daily_bos         BOOLEAN NOT NULL DEFAULT false,
  setup_value_area        BOOLEAN NOT NULL DEFAULT false,
  setup_market_structure  BOOLEAN NOT NULL DEFAULT false,
  setup_weekly_gva        BOOLEAN NOT NULL DEFAULT false,
  setup_3day_gva          BOOLEAN NOT NULL DEFAULT false,

  -- Confluences (dynamische Liste aus Settings)
  -- z.B. ['Fundamental', 'SMC', 'Liquidität']
  confluences             JSONB   NOT NULL DEFAULT '[]',

  -- Freitext
  notes       TEXT          NOT NULL DEFAULT '',
  comment     TEXT          NOT NULL DEFAULT '',
  chapter_id  TEXT,                                    -- Referenz auf accounts.chapters[].id

  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades: eigene Trades"
  ON trades FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trades_user     ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account  ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_type     ON trades(user_id, type);
CREATE INDEX IF NOT EXISTS idx_trades_date     ON trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_result   ON trades(user_id, result);
CREATE INDEX IF NOT EXISTS idx_trades_outlook  ON trades(outlook_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol   ON trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_trades_session  ON trades(user_id, session_type);

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
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id        UUID    NOT NULL REFERENCES trades(id)     ON DELETE CASCADE,

  label           TEXT    NOT NULL DEFAULT 'entry'
                  CHECK (label IN ('entry', 'exit', 'analysis', 'overview')),
  screenshot_data TEXT    NOT NULL,                    -- Base64-kodiertes Bild
  mime_type       TEXT    NOT NULL DEFAULT 'image/png',
  file_size_kb    INTEGER,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trade_screenshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenshots: eigene Screenshots"
  ON trade_screenshots FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_screenshots_trade ON trade_screenshots(trade_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_user  ON trade_screenshots(user_id);


-- ============================================================
-- 7. TRANSAKTIONEN  (Einzahlungen, Auszahlungen, Payouts)
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
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_id  UUID    REFERENCES strategies(id) ON DELETE SET NULL,

  name         TEXT    NOT NULL,
  pair         TEXT    NOT NULL,
  timeframe    TEXT    NOT NULL DEFAULT '1H',
  strategy     TEXT    NOT NULL DEFAULT '',
  start_date   TEXT,
  end_date     TEXT,
  status       TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes        TEXT    NOT NULL DEFAULT '',
  elapsed_ms   BIGINT  NOT NULL DEFAULT 0,

  -- Alle Trades und aggregierte Statistiken als JSON
  trades       JSONB   NOT NULL DEFAULT '[]',
  stats        JSONB   NOT NULL DEFAULT '{}',

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
-- 9. COT-VERLAUF  (Commitment of Traders)
-- ============================================================

CREATE TABLE IF NOT EXISTS cot_history (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  date      TEXT   NOT NULL,       -- YYYY-MM-DD (Berichtsdatum CFTC)
  currency  TEXT   NOT NULL,       -- 'EUR', 'GBP', ...

  -- Positionsdaten
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

  -- Berechnetes Signal
  signal           TEXT  CHECK (signal IN ('strong_long', 'long', 'neutral', 'short', 'strong_short')),
  percentile_rank  NUMERIC(5,2),   -- 0–100
  price_at_snapshot NUMERIC(18,6), -- Kurs zum Zeitpunkt des Snapshots

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, date, currency)
);

ALTER TABLE cot_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cot: eigene COT-Daten"
  ON cot_history FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cot_user_currency ON cot_history(user_id, currency);
CREATE INDEX IF NOT EXISTS idx_cot_user_date     ON cot_history(user_id, date DESC);


-- ============================================================
-- 10. FUNDAMENTALS-NOTIZEN
-- ============================================================

CREATE TABLE IF NOT EXISTS fundamentals_notes (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  section  TEXT    NOT NULL CHECK (section IN ('cot', 'news', 'currency', 'general')),
  currency TEXT,
  title    TEXT    NOT NULL DEFAULT '',
  content  TEXT    NOT NULL DEFAULT '',
  tags     TEXT[]  NOT NULL DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
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
-- 11. PAIR-NOTIZEN  (Währungspaar-spezifische Analyse)
-- ============================================================

CREATE TABLE IF NOT EXISTS pair_notes (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  pair        TEXT    NOT NULL,
  notes       TEXT    NOT NULL DEFAULT '',
  bias        TEXT    CHECK (bias IN ('bullish', 'bearish', 'neutral')),

  -- Schlüsselniveaus: [{price, label, type: 'support'|'resistance'|'target'}]
  key_levels  JSONB   NOT NULL DEFAULT '[]',

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, pair)
);

ALTER TABLE pair_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pair_notes: eigene Pair-Notizen"
  ON pair_notes FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pair_notes_user ON pair_notes(user_id);


-- ============================================================
-- 12. RISK-EINSTELLUNGEN
-- ============================================================
-- Gespeichert als flexibles JSONB-Objekt.
-- Beispielinhalt: {maxDailyLoss, maxWeeklyLoss, maxOpenTrades, ...}
-- ============================================================

CREATE TABLE IF NOT EXISTS risk_settings (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  settings JSONB   NOT NULL DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk: eigene Risikoeinstellungen"
  ON risk_settings FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_risk_updated_at
  BEFORE UPDATE ON risk_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- 13. USER_PREFERENCES  (Allgemeine App-Einstellungen)
-- ============================================================
-- Das preferences-JSONB speichert alles was bisher in
-- localStorage liegt (für Cloud-Sync).
--
-- Wichtige Keys im JSONB:
--   confluences       string[]   – Confluence-Liste (Settings)
--   customPairs       string[]   – eigene Währungspaare
--   dashboardPrefs    object     – Widget-Sichtbarkeit, Layout
--   theme             string     – 'dark' | 'light'
--   language          string     – 'de' | 'en'
--   defaultAccountType string    – 'ek' | 'funded'
-- ============================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  preferences JSONB   NOT NULL DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preferences: eigene Einstellungen"
  ON user_preferences FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE TRIGGER trg_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- VIEW: account_configs  (Abwärtskompatibilität)
-- ============================================================
-- Zeigt jeweils den Default-Account je Typ.

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

-- Gesamt-R eines Accounts (optional: Datumsbereich)
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

-- Win-Rate eines Accounts
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

-- Profit-Faktor eines Accounts
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
-- TABELLENÜBERSICHT (Referenz)
-- ============================================================
--
--  #  Tabelle                Inhalt
-- --  ---------------------  -----------------------------------
--  1  user_profiles          Anzeigename, Avatar
--  2  accounts               EK- und Funded-Konten (Multi)
--  3  strategies             Trading-Strategien + Regeln
--  4  outlooks               Trading-Thesen / Marktanalysen
--  5  trades                 Alle Live- und Backtest-Trades
--  6  trade_screenshots      Entry/Exit-Screenshots (Base64)
--  7  transactions           Einzahlungen, Auszahlungen, Payouts
--  8  backtest_sessions      Backtest-Läufe mit Trades + Stats
--  9  cot_history            CFTC COT-Verlauf je Währung
-- 10  fundamentals_notes     COT/News/Währungs-Analysenotizen
-- 11  pair_notes             Pair-spez. Bias + Schlüsselniveaus
-- 12  risk_settings          Risikomanagement-Konfiguration
-- 13  user_preferences       App-Settings (Confluences, Theme …)
-- ============================================================
