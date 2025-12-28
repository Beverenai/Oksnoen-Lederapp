-- Add title and icon columns to home_screen_config
ALTER TABLE home_screen_config 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS icon text DEFAULT 'info';

-- Update existing records with default values
UPDATE home_screen_config SET title = 'Din aktivitet', icon = 'activity' WHERE element_key = 'current_activity';
UPDATE home_screen_config SET title = 'Ekstra aktivitet', icon = 'plus' WHERE element_key = 'extra_activity';
UPDATE home_screen_config SET title = 'Notater til deg', icon = 'message' WHERE element_key = 'personal_notes';
UPDATE home_screen_config SET title = 'OBS', icon = 'alert-triangle' WHERE element_key = 'obs_message';
UPDATE home_screen_config SET title = 'Aktiviteter denne økten', icon = 'calendar' WHERE element_key = 'session_activities';