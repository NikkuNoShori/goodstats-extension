-- Create transaction_type enum
create type public.transaction_type as enum ('stock', 'option');

-- Create transaction_side enum
create type public.transaction_side as enum ('Long', 'Short');

-- Create option_type enum
create type public.option_type as enum ('call', 'put');

-- Create option_details type
create type public.option_details as (
  strike decimal,
  expiration date,
  option_type option_type
);

-- Create transactions table
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

-- Enable RLS
alter table public.transactions enable row level security;

-- Create policies
create policy "Users can view their own transactions"
  on public.transactions for select
  using ( auth.uid() = user_id );

create policy "Users can create their own transactions"
  on public.transactions for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own transactions"
  on public.transactions for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own transactions"
  on public.transactions for delete
  using ( auth.uid() = user_id );

-- Create indexes
create index transactions_user_id_idx on public.transactions(user_id);
create index transactions_symbol_idx on public.transactions(symbol);
create index transactions_date_idx on public.transactions(date);

-- Create updated_at trigger
create trigger handle_transactions_updated_at
  before update on public.transactions
  for each row
  execute function public.handle_updated_at();