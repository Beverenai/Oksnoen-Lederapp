ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS native_token TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_channel_check;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_channel_check
  CHECK (channel IN ('web', 'apns'));

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_channel
  ON public.push_subscriptions(channel);
