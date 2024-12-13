-- Add new fields for average prices
ALTER TABLE public.transactions
ADD COLUMN avg_entry_price decimal,
ADD COLUMN avg_exit_price decimal;

-- Add function to calculate averages
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
    IF (NEW.side = 'Long' AND (order_record.value->>'action')::text = 'buy') OR
       (NEW.side = 'Short' AND (order_record.value->>'action')::text = 'sell') THEN
      total_entry_quantity := total_entry_quantity + ((order_record.value->>'quantity')::decimal);
      total_entry_value := total_entry_value + ((order_record.value->>'quantity')::decimal * (order_record.value->>'price')::decimal);
    ELSE
      total_exit_quantity := total_exit_quantity + ((order_record.value->>'quantity')::decimal);
      total_exit_value := total_exit_value + ((order_record.value->>'quantity')::decimal * (order_record.value->>'price')::decimal);
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

-- Create trigger for average calculations
CREATE TRIGGER update_transaction_averages
  BEFORE INSERT OR UPDATE OF orders ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_transaction_averages();