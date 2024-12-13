-- Rename the table
ALTER TABLE IF EXISTS public.watchlists RENAME TO symbols_watched;

-- Update the sequence if it exists
ALTER SEQUENCE IF EXISTS watchlists_id_seq RENAME TO symbols_watched_id_seq;

-- Update existing indexes
ALTER INDEX IF EXISTS watchlists_user_id_idx RENAME TO symbols_watched_user_id_idx;
ALTER INDEX IF EXISTS watchlists_pkey RENAME TO symbols_watched_pkey;

-- Recreate the RLS policies for the renamed table
DROP POLICY IF EXISTS "Users can view their own watchlists" ON public.symbols_watched;
DROP POLICY IF EXISTS "Users can create their own watchlists" ON public.symbols_watched;
DROP POLICY IF EXISTS "Users can update their own watchlists" ON public.symbols_watched;
DROP POLICY IF EXISTS "Users can delete their own watchlists" ON public.symbols_watched;

CREATE POLICY "Users can view their own symbols"
  ON public.symbols_watched FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can add their own symbols"
  ON public.symbols_watched FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own symbols"
  ON public.symbols_watched FOR UPDATE
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own symbols"
  ON public.symbols_watched FOR DELETE
  USING ( auth.uid() = user_id );