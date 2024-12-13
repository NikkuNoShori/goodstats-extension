-- Create base functions first
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing types if they exist
DROP TYPE IF EXISTS public.option_details CASCADE;
DROP TYPE IF EXISTS public.option_type CASCADE;
DROP TYPE IF EXISTS public.transaction_side CASCADE;
DROP TYPE IF EXISTS public.transaction_type CASCADE;

-- Create all your ENUMs and types
CREATE TYPE public.transaction_type AS ENUM ('stock', 'option');
CREATE TYPE public.transaction_side AS ENUM ('Long', 'Short');
CREATE TYPE public.option_type AS ENUM ('call', 'put');

-- Create option_details composite type
CREATE TYPE public.option_details AS (
  strike decimal,
  expiration date,
  option_type option_type
);
