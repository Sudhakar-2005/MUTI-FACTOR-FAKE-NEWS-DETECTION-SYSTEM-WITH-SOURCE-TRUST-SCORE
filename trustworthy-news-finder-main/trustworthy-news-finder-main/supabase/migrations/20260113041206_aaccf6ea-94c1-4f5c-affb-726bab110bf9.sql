-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service can insert webhook logs" ON public.webhook_delivery_logs;

-- No insert policy needed since edge functions use service role key which bypasses RLS