-- Add username fields to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN username TEXT UNIQUE,
  ADD COLUMN username_changes_remaining INTEGER DEFAULT 2,
  ADD COLUMN last_username_change TIMESTAMPTZ,
  ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'developer'));

-- Create function to validate username format
CREATE OR REPLACE FUNCTION validate_username()
RETURNS TRIGGER AS $$
BEGIN
  -- Check username format (alphanumeric, underscores, 3-20 chars)
  IF NOT NEW.username ~ '^[a-zA-Z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'Username must be 3-20 characters and contain only letters, numbers, and underscores';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for username validation
CREATE TRIGGER validate_username_trigger
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_username();

-- Create function to track username changes
CREATE OR REPLACE FUNCTION track_username_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    IF NEW.username_changes_remaining <= 0 THEN
      RAISE EXCEPTION 'No username changes remaining';
    END IF;
    NEW.username_changes_remaining := NEW.username_changes_remaining - 1;
    NEW.last_username_change := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tracking username changes
CREATE TRIGGER track_username_changes_trigger
  BEFORE UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION track_username_changes();