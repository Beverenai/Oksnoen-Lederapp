
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS native_token text,
  ADD COLUMN IF NOT EXISTS platform text;

ALTER TABLE public.push_subscriptions
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_channel_check CHECK (channel IN ('web','apns'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_channel ON public.push_subscriptions(channel);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_native_token ON public.push_subscriptions(native_token) WHERE native_token IS NOT NULL;
