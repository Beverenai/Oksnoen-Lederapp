-- Add styling columns to home_screen_config
ALTER TABLE home_screen_config 
ADD COLUMN bg_color text DEFAULT 'default',
ADD COLUMN text_size text DEFAULT 'md',
ADD COLUMN is_bold boolean DEFAULT false,
ADD COLUMN is_italic boolean DEFAULT false;