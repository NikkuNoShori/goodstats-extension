-- Create updated_at triggers for all tables
CREATE OR REPLACE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER handle_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER handle_transaction_orders_updated_at
  BEFORE UPDATE ON public.transaction_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER handle_user_watchlists_updated_at
  BEFORE UPDATE ON public.user_watchlists
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER handle_symbols_watched_updated_at
  BEFORE UPDATE ON public.symbols_watched
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER handle_screener_presets_updated_at
  BEFORE UPDATE ON public.screener_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create developer mode function
CREATE OR REPLACE FUNCTION auth.is_dev_mode()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.headers', true)::json->>'x-dev-mode' = 'true';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add developer mode policies
CREATE POLICY "Developer mode bypass for profiles"
  ON public.profiles
  USING (auth.is_dev_mode() OR auth.uid() = id);

CREATE POLICY "Developer mode bypass for transactions"
  ON public.transactions
  USING (auth.is_dev_mode() OR auth.uid() = user_id);

CREATE POLICY "Developer mode bypass for transaction orders"
  ON public.transaction_orders
  USING (
    auth.is_dev_mode() OR
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Developer mode bypass for watchlists"
  ON public.user_watchlists
  USING (auth.is_dev_mode() OR auth.uid() = user_id);

CREATE POLICY "Developer mode bypass for symbols"
  ON public.symbols_watched
  USING (auth.is_dev_mode() OR auth.uid() = user_id);

CREATE POLICY "Developer mode bypass for screener presets"
  ON public.screener_presets
  USING (auth.is_dev_mode() OR auth.uid() = user_id);

-- Create test users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES 
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin@test.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    jsonb_build_object(
      'first_name', 'Admin',
      'last_name', 'User',
      'username', 'admin_test',
      'role', 'admin'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'user@test.com',
    crypt('user123', gen_salt('bf')),
    now(),
    jsonb_build_object(
      'first_name', 'Regular',
      'last_name', 'User',
      'username', 'user_test',
      'role', 'user'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'developer@test.com',
    crypt('dev123', gen_salt('bf')),
    now(),
    jsonb_build_object(
      'first_name', 'Dev',
      'last_name', 'User',
      'username', 'dev_test',
      'role', 'developer'
    ),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- Insert developer user into profiles if not exists
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  username,
  role,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'developer@stackblitz.com',
  'Developer',
  'Mode',
  'developer',
  'developer',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;
