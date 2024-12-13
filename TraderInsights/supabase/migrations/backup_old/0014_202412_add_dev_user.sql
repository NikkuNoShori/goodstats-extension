-- Insert developer user into profiles table
insert into public.profiles (
  id,
  email,
  first_name,
  last_name,
  created_at,
  role
)
values (
  '00000000-0000-0000-0000-000000000000',
  'developer@stackblitz.com',
  'Developer',
  'Mode',
  now(),
  'developer'
)
on conflict (id) do nothing;