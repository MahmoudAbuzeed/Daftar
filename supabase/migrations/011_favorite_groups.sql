-- Add favorite groups support
ALTER TABLE group_members ADD COLUMN is_favorite BOOLEAN DEFAULT false;
