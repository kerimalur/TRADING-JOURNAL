-- ============================================================================
-- Trading Journal — Strategie-Verknüpfung + Strategie-Felder
-- ============================================================================
-- Im SQL-Editor des echten Trading-Journal-Projekts ausführen.
-- Idempotent. WICHTIG: vor dem Taggen von Trades/Sessions mit einer Strategie
-- ausführen, sonst schlägt das Speichern eines strategie-getaggten Trades fehl.
-- ============================================================================

-- 1) strategyId-Verknüpfung an Trades und Backtest-Sessions
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL;

ALTER TABLE backtest_sessions
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL;

-- 2) Strategie-Seite: Bilder + Notizen + Regeln (falls noch nicht vorhanden)
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'both';

-- 3) Cleanup (optional): alter Geopolitik-Flag aus der COT-Zeit.
-- Sicher gegen abweichende user_preferences-Schemata (nur löschen wenn key-Spalte existiert).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'key'
  ) THEN
    DELETE FROM user_preferences WHERE key = 'geoRisk';
  END IF;
END $$;

-- Indizes für die Verknüpfungs-Abfragen
CREATE INDEX IF NOT EXISTS idx_trades_strategy   ON trades(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_sessions(strategy_id);
