-- Add reason column to room_swaps
ALTER TABLE room_swaps ADD COLUMN reason TEXT;

-- Update bed_count to match actual occupancy where it's lower
UPDATE room_capacity rc
SET bed_count = GREATEST(bed_count, (
  SELECT COUNT(*) 
  FROM participants p 
  WHERE p.cabin_id = rc.cabin_id 
    AND (
      (p.room = rc.room) OR 
      (p.room IS NULL AND rc.room IS NULL)
    )
))
WHERE EXISTS (
  SELECT 1 
  FROM participants p 
  WHERE p.cabin_id = rc.cabin_id 
    AND (
      (p.room = rc.room) OR 
      (p.room IS NULL AND rc.room IS NULL)
    )
);