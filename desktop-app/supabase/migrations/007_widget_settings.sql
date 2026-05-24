-- ============================================================
-- 007: User Widget Settings  (Mai 2026)
-- ============================================================
-- Speichert Dashboard-Widget-Einstellungen pro User:
--   cot.currencies     → welche Währungen im COT-Widget
--   zinsen.currencies  → welche Währungen im Zinsen-Widget
--   news.currencies    → Währungsfilter im News-Widget ([] = alle)
--   news.impact        → Mindest-Impact-Level ('high'|'medium'|'all')
-- ============================================================

-- Stelle sicher, dass die Helper-Funktion existiert (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
