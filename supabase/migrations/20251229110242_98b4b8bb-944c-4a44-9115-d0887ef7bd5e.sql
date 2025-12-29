-- Add registered_by column to track which leader registered the activity
ALTER TABLE participant_activities 
ADD COLUMN registered_by uuid REFERENCES leaders(id);