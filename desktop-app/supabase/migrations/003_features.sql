-- ============================================================
-- Migration 003: Confluences, Daily Drawdown, User Profiles
-- ============================================================

-- Add confluences column to trades table
ALTER TABLE trades ADD COLUMN IF NOT EXISTS confluences jsonb DEFAULT '[]'::jsonb;

-- Add daily drawdown columns to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS daily_drawdown_value numeric;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS daily_drawdown_type text
  CHECK (daily_drawdown_type IN ('percent', 'absolute'));

-- User profiles table for display name (cloud users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_own" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);
