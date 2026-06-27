
-- Consolidate Seileren/Seilern cabins to single rooms (not Høyre/Venstre)
-- Move all participants in these cabins to single-room (room = NULL)
UPDATE participants p
SET room = NULL
FROM cabins c
WHERE p.cabin_id = c.id
  AND (c.name ILIKE 'seileren%' OR c.name ILIKE 'seilern%');

-- For Seileren, Seilern Bahamas, Seilern Waikikii: merge høyre+venstre into single null-room
-- Sum bed_count per cabin, delete rows, insert one null-room row
DO $$
DECLARE
  c RECORD;
  total INT;
BEGIN
  FOR c IN
    SELECT id, name FROM cabins
    WHERE name ILIKE 'seileren%' OR name ILIKE 'seilern%'
  LOOP
    SELECT COALESCE(SUM(bed_count),0) INTO total
    FROM room_capacity WHERE cabin_id = c.id;
    DELETE FROM room_capacity WHERE cabin_id = c.id;
    IF total > 0 THEN
      INSERT INTO room_capacity (cabin_id, room, bed_count) VALUES (c.id, NULL, total);
    ELSE
      -- preserve a single null-row even if no beds set, so UI shows it as single room
      INSERT INTO room_capacity (cabin_id, room, bed_count) VALUES (c.id, NULL, 0);
    END IF;
  END LOOP;
END $$;
