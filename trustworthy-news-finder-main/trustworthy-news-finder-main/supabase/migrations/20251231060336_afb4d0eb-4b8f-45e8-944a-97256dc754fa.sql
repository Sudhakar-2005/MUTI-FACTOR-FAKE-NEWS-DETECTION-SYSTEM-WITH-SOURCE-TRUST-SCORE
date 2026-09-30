-- Add more notification preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS low_score_alerts_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS low_score_threshold integer NOT NULL DEFAULT 40;