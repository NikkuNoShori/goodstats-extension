-- Function to check if request is from developer mode
create or replace function auth.is_dev_mode()
returns boolean as $$
  begin
    return current_setting('request.headers', true)::json->>'x-dev-mode' = 'true';
  end;
$$ language plpgsql security definer;

-- Update RLS policies for profiles table
create policy "Developer mode bypass for profiles"
  on public.profiles
  using (auth.is_dev_mode() or auth.uid() = id);

-- Update RLS policies for transactions table
create policy "Developer mode bypass for transactions"
  on public.transactions
  using (auth.is_dev_mode() or auth.uid() = user_id);

-- Update RLS policies for user_watchlists table
create policy "Developer mode bypass for watchlists"
  on public.user_watchlists
  using (auth.is_dev_mode() or auth.uid() = user_id);

-- Update RLS policies for symbols_watched table
create policy "Developer mode bypass for symbols"
  on public.symbols_watched
  using (auth.is_dev_mode() or auth.uid() = user_id);