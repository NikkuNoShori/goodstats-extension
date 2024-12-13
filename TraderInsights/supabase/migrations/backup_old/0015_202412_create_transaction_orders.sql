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
ALTER TABLE public.transaction_orders ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX transaction_orders_transaction_id_idx ON public.transaction_orders(transaction_id);
CREATE INDEX transaction_orders_date_idx ON public.transaction_orders(date);

-- Create policies
CREATE POLICY "Users can view their own transaction orders"
  ON public.transaction_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own transaction orders"
  ON public.transaction_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own transaction orders"
  ON public.transaction_orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own transaction orders"
  ON public.transaction_orders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_orders.transaction_id
      AND t.user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE TRIGGER handle_transaction_orders_updated_at
  BEFORE UPDATE ON public.transaction_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();