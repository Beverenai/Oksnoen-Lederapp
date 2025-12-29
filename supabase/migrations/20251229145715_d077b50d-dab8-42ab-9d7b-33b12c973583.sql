-- Add index on participant_activities.participant_id for faster JOINs
CREATE INDEX IF NOT EXISTS idx_participant_activities_participant_id 
ON participant_activities(participant_id);

-- Add index on participants.cabin_id for faster cabin lookups
CREATE INDEX IF NOT EXISTS idx_participants_cabin_id 
ON participants(cabin_id);