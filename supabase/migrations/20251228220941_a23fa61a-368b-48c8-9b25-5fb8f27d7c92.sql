-- Step 1: Update participants from all Seilern cabins to use the main cabin
-- Set room names based on original cabin names

-- Seilern Maui -> room = 'Maui' (this will be the main cabin, keep cabin_id)
UPDATE participants 
SET room = 'Maui' 
WHERE cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60';

-- Seilern Waikikii -> move to main cabin with room = 'Waikikii'
UPDATE participants 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60', room = 'Waikikii' 
WHERE cabin_id = '524aede3-996e-4b2b-8f16-49a45f0f74a6';

-- Seilern Haui -> move to main cabin with room = 'Haui'
UPDATE participants 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60', room = 'Haui' 
WHERE cabin_id = 'd60a6f67-22dd-4ba2-a86b-a0f71f1f3e64';

-- Seilern Oahu -> move to main cabin with room = 'Oahu'
UPDATE participants 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60', room = 'Oahu' 
WHERE cabin_id = 'bc2b93f3-98d9-47a0-bd39-9c7f2f1c6e8b';

-- Seilern Honolulu -> move to main cabin with room = 'Honolulu'
UPDATE participants 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60', room = 'Honolulu' 
WHERE cabin_id = '24ff5a10-c395-462e-9b98-9d464fc9deb3';

-- Seilern Hawaii -> move to main cabin with room = 'Hawaii'
UPDATE participants 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60', room = 'Hawaii' 
WHERE cabin_id = '5dbd5376-b6d9-4bb6-8d63-ba53e08f3697';

-- Seilern Tipi -> move to main cabin with room = 'Tipi'
UPDATE participants 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60', room = 'Tipi' 
WHERE cabin_id = 'a474ac28-3a67-439e-86a4-5beb2f1a1c80';

-- Seilern Halua -> move to main cabin with room = 'Halua'
UPDATE participants 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60', room = 'Halua' 
WHERE cabin_id = 'a2e3b13c-78ae-4aaf-92d7-f6d0d1b87aec';

-- Step 2: Update all leader_cabins to point to the main Seileren cabin
UPDATE leader_cabins 
SET cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60' 
WHERE cabin_id IN (
  '524aede3-996e-4b2b-8f16-49a45f0f74a6',
  'd60a6f67-22dd-4ba2-a86b-a0f71f1f3e64',
  'bc2b93f3-98d9-47a0-bd39-9c7f2f1c6e8b',
  '24ff5a10-c395-462e-9b98-9d464fc9deb3',
  '5dbd5376-b6d9-4bb6-8d63-ba53e08f3697',
  'a474ac28-3a67-439e-86a4-5beb2f1a1c80',
  'a2e3b13c-78ae-4aaf-92d7-f6d0d1b87aec'
);

-- Remove duplicate leader_cabins entries (keep unique leader-cabin pairs)
DELETE FROM leader_cabins a
USING leader_cabins b
WHERE a.id > b.id 
  AND a.leader_id = b.leader_id 
  AND a.cabin_id = b.cabin_id;

-- Step 3: Delete room_swaps referencing old cabins (update to new cabin first)
UPDATE room_swaps 
SET from_cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60' 
WHERE from_cabin_id IN (
  '524aede3-996e-4b2b-8f16-49a45f0f74a6',
  'd60a6f67-22dd-4ba2-a86b-a0f71f1f3e64',
  'bc2b93f3-98d9-47a0-bd39-9c7f2f1c6e8b',
  '24ff5a10-c395-462e-9b98-9d464fc9deb3',
  '5dbd5376-b6d9-4bb6-8d63-ba53e08f3697',
  'a474ac28-3a67-439e-86a4-5beb2f1a1c80',
  'a2e3b13c-78ae-4aaf-92d7-f6d0d1b87aec'
);

UPDATE room_swaps 
SET to_cabin_id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60' 
WHERE to_cabin_id IN (
  '524aede3-996e-4b2b-8f16-49a45f0f74a6',
  'd60a6f67-22dd-4ba2-a86b-a0f71f1f3e64',
  'bc2b93f3-98d9-47a0-bd39-9c7f2f1c6e8b',
  '24ff5a10-c395-462e-9b98-9d464fc9deb3',
  '5dbd5376-b6d9-4bb6-8d63-ba53e08f3697',
  'a474ac28-3a67-439e-86a4-5beb2f1a1c80',
  'a2e3b13c-78ae-4aaf-92d7-f6d0d1b87aec'
);

-- Step 4: Delete cabin_reports for old cabins
DELETE FROM cabin_reports 
WHERE cabin_id IN (
  '524aede3-996e-4b2b-8f16-49a45f0f74a6',
  'd60a6f67-22dd-4ba2-a86b-a0f71f1f3e64',
  'bc2b93f3-98d9-47a0-bd39-9c7f2f1c6e8b',
  '24ff5a10-c395-462e-9b98-9d464fc9deb3',
  '5dbd5376-b6d9-4bb6-8d63-ba53e08f3697',
  'a474ac28-3a67-439e-86a4-5beb2f1a1c80',
  'a2e3b13c-78ae-4aaf-92d7-f6d0d1b87aec'
);

-- Step 5: Delete room_capacity for old cabins
DELETE FROM room_capacity 
WHERE cabin_id IN (
  '524aede3-996e-4b2b-8f16-49a45f0f74a6',
  'd60a6f67-22dd-4ba2-a86b-a0f71f1f3e64',
  'bc2b93f3-98d9-47a0-bd39-9c7f2f1c6e8b',
  '24ff5a10-c395-462e-9b98-9d464fc9deb3',
  '5dbd5376-b6d9-4bb6-8d63-ba53e08f3697',
  'a474ac28-3a67-439e-86a4-5beb2f1a1c80',
  'a2e3b13c-78ae-4aaf-92d7-f6d0d1b87aec'
);

-- Step 6: Delete the old Seilern cabins
DELETE FROM cabins 
WHERE id IN (
  '524aede3-996e-4b2b-8f16-49a45f0f74a6',
  'd60a6f67-22dd-4ba2-a86b-a0f71f1f3e64',
  'bc2b93f3-98d9-47a0-bd39-9c7f2f1c6e8b',
  '24ff5a10-c395-462e-9b98-9d464fc9deb3',
  '5dbd5376-b6d9-4bb6-8d63-ba53e08f3697',
  'a474ac28-3a67-439e-86a4-5beb2f1a1c80',
  'a2e3b13c-78ae-4aaf-92d7-f6d0d1b87aec'
);

-- Step 7: Rename the main cabin to "Seileren"
UPDATE cabins 
SET name = 'Seileren', sort_order = 2 
WHERE id = 'b32bc44c-e0a8-405f-91cb-2328172b0a60';