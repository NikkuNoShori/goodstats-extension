-- Initial setup with base tables and types, RLS disabled

-- Create transaction_type enum
create type public.transaction_type as enum ('stock', 'option');
create type public.transaction_side as enum ('Long', 'Short');
create type public.option_type as enum ('call', 'put');

-- Create option_details composite type
create type public.option_details as (
  strike decimal,
  expiration date,
  option_type option_type
);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;