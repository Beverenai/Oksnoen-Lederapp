-- Add is_active column to track if leader is active this session
ALTER TABLE public.leaders ADD COLUMN is_active boolean DEFAULT true;

-- Add has_car column to track if leader brought a car (different from driver's license)
ALTER TABLE public.leaders ADD COLUMN has_car boolean DEFAULT false;