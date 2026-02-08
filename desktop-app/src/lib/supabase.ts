/**
 * Supabase Client für Trading Journal
 */

import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
const SUPABASE_URL = 'https://yahvhzywsynnsqznysfr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaHZoenl3c3lubnNxem55c2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjM5NjYsImV4cCI6MjA4NjEzOTk2Nn0.b-sbG4XPJV-_juB_B2NKA0hZelqT8RM_OH9MtumGRH4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
