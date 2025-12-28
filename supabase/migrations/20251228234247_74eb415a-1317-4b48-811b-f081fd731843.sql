-- Create push_subscriptions table for storing push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups by leader_id
CREATE INDEX idx_push_subscriptions_leader_id ON public.push_subscriptions(leader_id);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow leaders to view their own subscriptions
CREATE POLICY "Leaders can view own subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (true);

-- Allow leaders to insert their own subscriptions
CREATE POLICY "Leaders can insert subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (true);

-- Allow leaders to delete their own subscriptions
CREATE POLICY "Leaders can delete own subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (true);

-- Allow updates for last_used_at tracking
CREATE POLICY "Leaders can update subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (true);