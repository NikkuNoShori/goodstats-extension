-- Drop existing table if it exists
DROP TABLE IF EXISTS public.screener_presets CASCADE;

-- Create screener_presets table
CREATE TABLE IF NOT EXISTS public.screener_presets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.screener_presets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own screener presets"
  ON public.screener_presets FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can create their own screener presets"
  ON public.screener_presets FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own screener presets"
  ON public.screener_presets FOR UPDATE
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own screener presets"
  ON public.screener_presets FOR DELETE
  USING ( auth.uid() = user_id );

-- Create indexes
CREATE INDEX screener_presets_user_id_idx ON public.screener_presets(user_id);
