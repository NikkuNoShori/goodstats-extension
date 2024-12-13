-- Create watchlists table
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

-- Create watchlist_symbols table
create table if not exists public.watchlist_symbols (
  id uuid default gen_random_uuid() primary key,
  watchlist_id uuid references public.watchlists(id) on delete cascade not null,
  symbol text not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (watchlist_id, symbol)
);

-- Enable RLS
alter table public.watchlists enable row level security;
alter table public.watchlist_symbols enable row level security;

-- Create policies for watchlists
create policy "Users can view their own watchlists"
  on public.watchlists for select
  using ( auth.uid() = user_id );

create policy "Users can create their own watchlists"
  on public.watchlists for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own watchlists"
  on public.watchlists for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own watchlists"
  on public.watchlists for delete
  using ( auth.uid() = user_id );

-- Create policies for watchlist_symbols
create policy "Users can view symbols in their watchlists"
  on public.watchlist_symbols for select
  using (
    exists (
      select 1 from public.watchlists
      where id = watchlist_symbols.watchlist_id
      and user_id = auth.uid()
    )
  );

create policy "Users can add symbols to their watchlists"
  on public.watchlist_symbols for insert
  with check (
    exists (
      select 1 from public.watchlists
      where id = watchlist_symbols.watchlist_id
      and user_id = auth.uid()
    )
  );

create policy "Users can update symbols in their watchlists"
  on public.watchlist_symbols for update
  using (
    exists (
      select 1 from public.watchlists
      where id = watchlist_symbols.watchlist_id
      and user_id = auth.uid()
    )
  );

create policy "Users can delete symbols from their watchlists"
  on public.watchlist_symbols for delete
  using (
    exists (
      select 1 from public.watchlists
      where id = watchlist_symbols.watchlist_id
      and user_id = auth.uid()
    )
  );

-- Create indexes
create index watchlists_user_id_idx on public.watchlists(user_id);
create index watchlist_symbols_watchlist_id_idx on public.watchlist_symbols(watchlist_id);
create index watchlist_symbols_symbol_idx on public.watchlist_symbols(symbol);

-- Create updated_at triggers
create trigger handle_watchlists_updated_at
  before update on public.watchlists
  for each row
  execute function public.handle_updated_at();

create trigger handle_watchlist_symbols_updated_at
  before update on public.watchlist_symbols
  for each row
  execute function public.handle_updated_at();