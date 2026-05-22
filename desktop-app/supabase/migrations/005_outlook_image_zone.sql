-- Migration: 005_outlook_image_zone
-- Adds interesting_zone (price level) and image_data (base64 chart screenshot) to outlooks

ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS interesting_zone NUMERIC(18,6);
ALTER TABLE outlooks ADD COLUMN IF NOT EXISTS image_data       TEXT;
