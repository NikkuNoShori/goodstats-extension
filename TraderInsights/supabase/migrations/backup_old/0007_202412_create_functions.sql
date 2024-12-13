-- Create helper functions

-- Function to create default watchlist for new users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.watchlists (user_id, name, description, is_default)
  values (new.id, 'Default Watchlist', 'Your default watchlist', true);
  
  return new;
end;
$$;

-- Trigger to create default watchlist when a new profile is created
create trigger on_auth_user_created
  after insert on public.profiles
  for each row execute function public.handle_new_user();

-- Function to search transactions
create or replace function public.search_transactions(
  p_user_id uuid,
  p_search text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_type transaction_type default null,
  p_side transaction_side default null
)
returns setof public.transactions
language sql
security definer
as $$
  select *
  from public.transactions
  where user_id = p_user_id
    and (
      p_search is null
      or symbol ilike '%' || p_search || '%'
      or notes ilike '%' || p_search || '%'
    )
    and (p_start_date is null or date >= p_start_date)
    and (p_end_date is null or date <= p_end_date)
    and (p_type is null or type = p_type)
    and (p_side is null or side = p_side)
  order by date desc, time desc;
$$;