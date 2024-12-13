-- Create triggers for updated_at timestamps

-- Profiles trigger
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

-- Transactions trigger
create trigger handle_transactions_updated_at
  before update on public.transactions
  for each row
  execute function public.handle_updated_at();

-- Watchlists triggers
create trigger handle_watchlists_updated_at
  before update on public.watchlists
  for each row
  execute function public.handle_updated_at();

create trigger handle_watchlist_symbols_updated_at
  before update on public.watchlist_symbols
  for each row
  execute function public.handle_updated_at();

-- Screener presets trigger
create trigger handle_screener_presets_updated_at
  before update on public.screener_presets
  for each row
  execute function public.handle_updated_at();