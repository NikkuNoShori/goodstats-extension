-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.transaction_orders CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  symbol text NOT NULL,
  type transaction_type NOT NULL,
  side transaction_side NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price decimal NOT NULL CHECK (price > 0),
  total decimal NOT NULL CHECK (total > 0),
  notes text,
  chart_image text,
  option_details option_details,
  orders jsonb[] DEFAULT ''{}''::jsonb[],
  status text CHECK (status IN (''open'', ''closed'')) DEFAULT ''open'',
  remaining_quantity integer,
  avg_entry_price decimal,
  avg_exit_price decimal,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create transaction_orders table
CREATE TABLE IF NOT EXISTS public.transaction_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  type text CHECK (type IN (''entry'', ''exit'')) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price decimal NOT NULL CHECK (price > 0),
  total decimal NOT NULL CHECK (total > 0),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can create their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own transactions"
  ON public.transactions FOR UPDATE
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own transactions"
  ON public.transactions FOR DELETE
  USING ( auth.uid() = user_id );

-- Create policies for transaction_orders
CREATE POLICY "Users can view their own transaction orders"
  ON public.transaction_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own transaction orders"
  ON public.transaction_orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own transaction orders"
  ON public.transaction_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own transaction orders"
  ON public.transaction_orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

-- Create functions for transaction calculations
CREATE OR REPLACE FUNCTION calculate_transaction_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total exit quantity from orders
  WITH exit_quantities AS (
    SELECT COALESCE(SUM((value->>''quantity'')::integer), 0) as total_exits
    FROM unnest(NEW.orders) as value
    WHERE value->>''type'' = ''exit''
  )
  SELECT
    CASE
      WHEN total_exits >= NEW.quantity THEN ''closed''
      ELSE ''open''
    END,
    GREATEST(NEW.quantity - total_exits, 0)
  INTO NEW.status, NEW.remaining_quantity
  FROM exit_quantities;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_transaction_averages()
RETURNS TRIGGER AS $$
DECLARE
  total_entry_quantity decimal := 0;
  total_entry_value decimal := 0;
  total_exit_quantity decimal := 0;
  total_exit_value decimal := 0;
  order_record record;
BEGIN
  -- Calculate entry and exit averages from orders
  FOR order_record IN SELECT * FROM jsonb_array_elements(NEW.orders)
  LOOP
    IF (NEW.side = ''Long'' AND (order_record.value->>''action'')::text = ''buy'') OR
       (NEW.side = ''Short'' AND (order_record.value->>''action'')::text = ''sell'') THEN
      total_entry_quantity := total_entry_quantity + ((order_record.value->>''quantity'')::decimal);
      total_entry_value := total_entry_value + ((order_record.value->>''quantity'')::decimal * (order_record.value->>''price'')::decimal);
    ELSE
      total_exit_quantity := total_exit_quantity + ((order_record.value->>''quantity'')::decimal);
      total_exit_value := total_exit_value + ((order_record.value->>''quantity'')::decimal * (order_record.value->>''price'')::decimal);
    END IF;
  END LOOP;

  -- Calculate averages
  NEW.avg_entry_price := CASE 
    WHEN total_entry_quantity > 0 THEN total_entry_value / total_entry_quantity
    ELSE NULL
  END;
  
  NEW.avg_exit_price := CASE 
    WHEN total_exit_quantity > 0 THEN total_exit_value / total_exit_quantity
    ELSE NULL
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX transactions_user_id_idx ON public.transactions(user_id);
CREATE INDEX transactions_symbol_idx ON public.transactions(symbol);
CREATE INDEX transactions_date_idx ON public.transactions(date);
CREATE INDEX transaction_orders_transaction_id_idx ON public.transaction_orders(transaction_id);
CREATE INDEX transaction_orders_date_idx ON public.transaction_orders(date);

-- Create triggers for status and average calculations
CREATE TRIGGER update_transaction_status
  BEFORE INSERT OR UPDATE OF orders, quantity ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_transaction_status();

CREATE TRIGGER update_transaction_averages
  BEFORE INSERT OR UPDATE OF orders ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_transaction_averages();
-- Create transaction_orders table
CREATE TABLE IF NOT EXISTS public.transaction_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  type text CHECK (type IN ('entry', 'exit')) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price decimal NOT NULL CHECK (price > 0),
  total decimal NOT NULL CHECK (total > 0),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_orders ENABLE ROW LEVEL SECURITY;
-- Create policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can create their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update their own transactions"
  ON public.transactions FOR UPDATE
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete their own transactions"
  ON public.transactions FOR DELETE
  USING ( auth.uid() = user_id );
-- Create policies for transaction_orders
CREATE POLICY "Users can view their own transaction orders"
  ON public.transaction_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own transaction orders"
  ON public.transaction_orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own transaction orders"
  ON public.transaction_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own transaction orders"
  ON public.transaction_orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );
-- Create functions for transaction calculations
CREATE OR REPLACE FUNCTION calculate_transaction_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total exit quantity from orders
  WITH exit_quantities AS (
    SELECT COALESCE(SUM((value->>'quantity')::integer), 0) as total_exits
    FROM unnest(NEW.orders) as value
    WHERE value->>'type' = 'exit'
  )
  SELECT
    CASE
      WHEN total_exits >= NEW.quantity THEN 'closed'
      ELSE 'open'
    END,
    GREATEST(NEW.quantity - total_exits, 0)
  INTO NEW.status, NEW.remaining_quantity
  FROM exit_quantities;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
