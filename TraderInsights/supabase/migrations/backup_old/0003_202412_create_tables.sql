-- Create base tables without RLS

-- Profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Transactions table
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  time time not null,
  symbol text not null,
  type transaction_type not null,
  side transaction_side not null,
  quantity integer not null check (quantity > 0),
  price decimal not null check (price > 0),
  total decimal not null check (total > 0),
  notes text,
  chart_image text,
  option_details option_details,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Watchlists table
create table if not exists public.watchlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  is_default boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, name)
);

-- Watchlist symbols table
create table if not exists public.watchlist_symbols (
  id uuid default gen_random_uuid() primary key,
  watchlist_id uuid references public.watchlists(id) on delete cascade not null,
  symbol text not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (watchlist_id, symbol)
);

-- Screener presets table
create table if not exists public.screener_presets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  is_default boolean default false,
  filters jsonb not null default '[]'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, name)
);