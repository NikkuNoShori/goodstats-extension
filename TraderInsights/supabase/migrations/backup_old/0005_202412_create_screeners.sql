-- Create screener_presets table
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

-- Enable RLS
alter table public.screener_presets enable row level security;

-- Create policies
create policy "Users can view their own screener presets"
  on public.screener_presets for select
  using ( auth.uid() = user_id );

create policy "Users can create their own screener presets"
  on public.screener_presets for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own screener presets"
  on public.screener_presets for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own screener presets"
  on public.screener_presets for delete
  using ( auth.uid() = user_id );

-- Create indexes
create index screener_presets_user_id_idx on public.screener_presets(user_id);

-- Create updated_at trigger
create trigger handle_screener_presets_updated_at
  before update on public.screener_presets
  for each row
  execute function public.handle_updated_at();