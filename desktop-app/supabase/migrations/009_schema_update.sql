-- ============================================================
-- 009: Schema Update – Trading Journal v5.1  (Juni 2026)
-- ============================================================
-- Voraussetzung: 008_complete_fresh_setup.sql muss zuerst
-- ausgeführt worden sein (erstellt alle Basistabellen).
--
-- Änderungen:
--   1. outlooks: Star-System + Strategy-Integration
--   2. user_preferences: Dashboard-Hintergrundbild
-- ============================================================


-- ============================================================
-- 1. OUTLOOKS: Star-System & Strategy-Integration
-- ============================================================

-- Favoriten-Markierung für Dashboard-Widget
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;

-- Verknüpfung mit einer Strategie/Setup
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS setup_id TEXT;

-- Strategy-Checkliste (Regeln als Checkboxen)
-- Format: [{ruleId, text, type, checked}]
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS strategy_checklist JSONB NOT NULL DEFAULT '[]';

-- Fundamentale Einschätzung (Freitext)
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS fundamental_outlook TEXT NOT NULL DEFAULT '';

-- Partial-Index für schnelle Abfrage der Favoriten
CREATE INDEX IF NOT EXISTS idx_outlooks_starred
  ON outlooks(user_id) WHERE is_starred = true;


-- ============================================================
-- 2. USER_PREFERENCES: Dashboard-Hintergrundbild
-- ============================================================

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS dashboard_background TEXT;


-- ============================================================
-- HINWEIS: backtest_sessions.trades ist JSONB
-- ============================================================
-- Das neue "notes"-Feld für Backtest-Trades wird auf
-- Applikationsebene hinzugefügt (TypeScript Interface).
-- JSONB ist schemaless — alte Einträge ohne notes
-- werden als undefined gelesen. Kein SQL nötig.
-- ============================================================
