-- Create test user in auth.users
insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now()
);

-- Create test profile
insert into public.profiles (id, email, first_name, last_name, date_of_birth)
values 
  ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'Test', 'User', '1990-01-01');

-- Create a test watchlist
insert into public.watchlists (id, user_id, name, description)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'Tech Stocks',
  'Major technology companies'
);

-- Add some symbols to the watchlist
insert into public.watchlist_symbols (watchlist_id, symbol, notes)
values 
  ('00000000-0000-0000-0000-000000000001', 'AAPL', 'Apple Inc.'),
  ('00000000-0000-0000-0000-000000000001', 'MSFT', 'Microsoft Corporation'),
  ('00000000-0000-0000-0000-000000000001', 'GOOGL', 'Alphabet Inc.');

-- Create some test transactions
insert into public.transactions (
  user_id,
  date,
  time,
  symbol,
  type,
  side,
  quantity,
  price,
  total,
  notes
)
values 
  (
    '00000000-0000-0000-0000-000000000000',
    current_date - interval '7 days',
    '10:30:00',
    'AAPL',
    'stock',
    'Long',
    100,
    150.00,
    15000.00,
    'Initial position in Apple'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    current_date - interval '3 days',
    '14:45:00',
    'MSFT',
    'stock',
    'Long',
    50,
    280.00,
    14000.00,
    'Adding Microsoft to portfolio'
  );