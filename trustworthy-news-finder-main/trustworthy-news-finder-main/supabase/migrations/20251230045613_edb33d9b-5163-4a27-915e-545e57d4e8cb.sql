-- Add email preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN weekly_digest_enabled boolean NOT NULL DEFAULT true;

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;