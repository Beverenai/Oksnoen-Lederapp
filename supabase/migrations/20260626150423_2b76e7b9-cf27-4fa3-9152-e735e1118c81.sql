
ALTER TABLE public.dynga_cards ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id) ON DELETE SET NULL;

UPDATE public.dynga_cards SET period_id = public.get_active_period_id() WHERE period_id IS NULL;

DROP TRIGGER IF EXISTS set_period_id_dynga_cards ON public.dynga_cards;
CREATE TRIGGER set_period_id_dynga_cards
BEFORE INSERT ON public.dynga_cards
FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();

CREATE INDEX IF NOT EXISTS idx_dynga_cards_period ON public.dynga_cards(period_id);
