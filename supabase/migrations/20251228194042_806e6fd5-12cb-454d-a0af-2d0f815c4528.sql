-- Create room_capacity table for bed counts per cabin/room
CREATE TABLE public.room_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabin_id UUID NOT NULL REFERENCES public.cabins(id) ON DELETE CASCADE,
  room TEXT, -- 'høyre', 'venstre', eller NULL for hytter uten rom
  bed_count INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cabin_id, room)
);

-- Enable RLS
ALTER TABLE public.room_capacity ENABLE ROW LEVEL SECURITY;

-- RLS policies for room_capacity
CREATE POLICY "Allow public read room_capacity" ON public.room_capacity FOR SELECT USING (true);
CREATE POLICY "Allow public insert room_capacity" ON public.room_capacity FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update room_capacity" ON public.room_capacity FOR UPDATE USING (true);
CREATE POLICY "Allow public delete room_capacity" ON public.room_capacity FOR DELETE USING (true);

-- Create room_swaps table for tracking room changes
CREATE TABLE public.room_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  from_cabin_id UUID REFERENCES public.cabins(id),
  from_room TEXT,
  to_cabin_id UUID NOT NULL REFERENCES public.cabins(id),
  to_room TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' or 'approved'
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.leaders(id)
);

-- Enable RLS
ALTER TABLE public.room_swaps ENABLE ROW LEVEL SECURITY;

-- RLS policies for room_swaps
CREATE POLICY "Allow public read room_swaps" ON public.room_swaps FOR SELECT USING (true);
CREATE POLICY "Allow public insert room_swaps" ON public.room_swaps FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update room_swaps" ON public.room_swaps FOR UPDATE USING (true);
CREATE POLICY "Allow public delete room_swaps" ON public.room_swaps FOR DELETE USING (true);

-- Insert default capacity for existing cabins (6 beds per room)
INSERT INTO public.room_capacity (cabin_id, room, bed_count)
SELECT c.id, r.room, 6
FROM public.cabins c
CROSS JOIN (VALUES ('høyre'), ('venstre')) AS r(room)
ON CONFLICT (cabin_id, room) DO NOTHING;