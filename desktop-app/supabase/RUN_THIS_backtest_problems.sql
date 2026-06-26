-- ============================================================================
-- Trading Journal — Backend für Backtest-Sessions + Problem-Tags
-- ============================================================================
-- Im Supabase SQL-Editor des Trading-Journal-Projekts ausführen.
-- Idempotent: kann gefahrlos mehrfach laufen.
-- ============================================================================

-- ── 1. Backtest-Sessions ──────────────────────────────────────────────────
-- Passt zum Session-Modell der App: kein Session-Pair (Pair ist pro Trade),
-- volle Trades inkl. problems[] als JSONB.
CREATE TABLE IF NOT EXISTS backtest_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'completed'
  elapsed_ms  BIGINT      NOT NULL DEFAULT 0,
  trades      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  stats       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE backtest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own backtest sessions" ON backtest_sessions;
CREATE POLICY "own backtest sessions"
  ON backtest_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_backtest_sessions_user ON backtest_sessions(user_id);


-- ── 2. User-Preferences (generischer Settings-Speicher) ───────────────────
-- Key/Value je User. Hier: Problem-Tag-Liste unter key = 'problems'.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        TEXT        NOT NULL,
  value      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own prefs" ON user_preferences;
CREATE POLICY "own prefs"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
