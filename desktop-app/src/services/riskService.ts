/**
 * ========================================================================
 * Trading Journal - Risk Settings Service (Supabase)
 * ========================================================================
 */

import { supabase } from '@/lib/supabase';
import { requireSession } from './supabaseService';

export interface RiskSettings {
  maxDailyLoss: number;
  maxWeeklyLoss: number;
  maxConsecutiveLosses: number;
  drawdownAlertPercent: number;
  tiltDetection: boolean;
  pauseAfterMaxLoss: boolean;
}

const TABLE = 'risk_settings';

const DEFAULT_SETTINGS: RiskSettings = {
  maxDailyLoss: 3,
  maxWeeklyLoss: 6,
  maxConsecutiveLosses: 3,
  drawdownAlertPercent: 5,
  tiltDetection: true,
  pauseAfterMaxLoss: false,
};

export async function loadRiskSettings(): Promise<RiskSettings> {
  try {
    const user = await requireSession();

    const { data, error } = await supabase
      .from(TABLE)
      .select('settings')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return DEFAULT_SETTINGS;
      throw error;
    }

    return { ...DEFAULT_SETTINGS, ...(data?.settings || {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveRiskSettings(settings: RiskSettings): Promise<boolean> {
  const user = await requireSession();

  const { error } = await supabase
    .from(TABLE)
    .upsert([{
      user_id: user.id,
      settings,
      updated_at: new Date().toISOString(),
    }], { onConflict: 'user_id' });

  if (error) throw error;
  return true;
}
