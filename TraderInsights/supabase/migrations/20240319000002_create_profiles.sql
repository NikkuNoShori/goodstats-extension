-- Drop existing table if it exists
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  username text UNIQUE,
  username_changes_remaining INTEGER DEFAULT 2,
  last_username_change TIMESTAMPTZ,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'developer')),
  date_of_birth date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING ( auth.uid() = id );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- Create username validation function
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

-- Create username validation trigger
CREATE TRIGGER validate_username_trigger
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_username();

-- Create username changes tracking function
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

-- Create username changes tracking trigger
CREATE TRIGGER track_username_changes_trigger
  BEFORE UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION track_username_changes();

-- Create index
CREATE INDEX profiles_username_idx ON public.profiles(username);
