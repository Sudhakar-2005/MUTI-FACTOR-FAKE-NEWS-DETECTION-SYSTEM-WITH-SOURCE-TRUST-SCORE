-- Create webhook delivery logs table
CREATE TABLE public.webhook_delivery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event TEXT NOT NULL,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own delivery logs
CREATE POLICY "Users can view their own webhook logs"
ON public.webhook_delivery_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert logs (edge functions)
CREATE POLICY "Service can insert webhook logs"
ON public.webhook_delivery_logs
FOR INSERT
WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX idx_webhook_delivery_logs_webhook_id ON public.webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_delivery_logs_user_id ON public.webhook_delivery_logs(user_id);
CREATE INDEX idx_webhook_delivery_logs_created_at ON public.webhook_delivery_logs(created_at DESC);