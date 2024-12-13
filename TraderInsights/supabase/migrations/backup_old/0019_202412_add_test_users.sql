-- Create test users in auth.users with metadata
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
)
VALUES 
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
