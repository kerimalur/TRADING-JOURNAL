-- ============================================================
-- 006: User Watchlists  (Mai 2026)
-- ============================================================
-- Speichert Watchlist-Daten als JSONB pro User.
-- Enthält alle Watchlists, Symbole, Abschnitte, Alarme.
-- Dazu Farblabels (was bedeutet jede Farbe?) und eine
-- "Dashboard-Farbe" (Symbole mit dieser Farbe → Widget).
-- ============================================================

CREATE TABLE IF NOT EXISTS user_watchlists (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  watchlists      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  color_labels    JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- { "#F23645": "Kein Setup", ... }
  dashboard_color TEXT        DEFAULT NULL,                  -- Farb-Hex, z.B. "#089981"
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_watchlists: eigene Daten"
  ON user_watchlists FOR ALL USING (auth.uid() = user_id);

-- auto-updated_at trigger (Funktion aus 004_master_schema.sql)
CREATE OR REPLACE TRIGGER trg_user_watchlists_updated_at
  BEFORE UPDATE ON user_watchlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
