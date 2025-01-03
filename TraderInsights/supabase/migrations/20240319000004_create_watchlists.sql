-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.watchlist_symbols CASCADE;
DROP TABLE IF EXISTS public.watchlists CASCADE;
DROP TABLE IF EXISTS public.symbols_watched CASCADE;
DROP TABLE IF EXISTS public.user_watchlists CASCADE;

-- Create user_watchlists table
CREATE TABLE public.user_watchlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, name)
);

-- Create symbols_watched table
CREATE TABLE public.symbols_watched (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  symbol text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, symbol)
);

-- Enable RLS
ALTER TABLE public.user_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbols_watched ENABLE ROW LEVEL SECURITY;

-- Create policies for user_watchlists
CREATE POLICY "Users can view their own watchlists"
  ON public.user_watchlists FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can create their own watchlists"
  ON public.user_watchlists FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own watchlists"
  ON public.user_watchlists FOR UPDATE
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own watchlists"
  ON public.user_watchlists FOR DELETE
  USING ( auth.uid() = user_id );

-- Create policies for symbols_watched
CREATE POLICY "Users can view their watched symbols"
  ON public.symbols_watched FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can add watched symbols"
  ON public.symbols_watched FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their watched symbols"
  ON public.symbols_watched FOR UPDATE
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their watched symbols"
  ON public.symbols_watched FOR DELETE
  USING ( auth.uid() = user_id );

-- Create indexes
CREATE INDEX user_watchlists_user_id_idx ON public.user_watchlists(user_id);
CREATE INDEX symbols_watched_user_id_idx ON public.symbols_watched(user_id);
CREATE INDEX symbols_watched_symbol_idx ON public.symbols_watched(symbol);

-- Create function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_watchlists (user_id, name, description, is_default)
  VALUES (NEW.id, 'Default Watchlist', 'Your default watchlist', true);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new users
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
