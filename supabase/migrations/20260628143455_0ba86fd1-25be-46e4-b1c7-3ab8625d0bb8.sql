ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS gift_card_number text;
CREATE INDEX IF NOT EXISTS idx_participants_gift_card_number ON public.participants(gift_card_number);