-- Add orders array to transactions table
ALTER TABLE public.transactions
ADD COLUMN orders jsonb[] DEFAULT '{}';

-- Add status fields
ALTER TABLE public.transactions
ADD COLUMN status text CHECK (status IN ('open', 'closed')) DEFAULT 'open',
ADD COLUMN remaining_quantity integer;

-- Create function to calculate remaining quantity and status
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

-- Create trigger to update status on changes
CREATE TRIGGER update_transaction_status
  BEFORE INSERT OR UPDATE OF orders, quantity ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_transaction_status();