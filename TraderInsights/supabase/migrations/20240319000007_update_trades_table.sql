-- Add PnL calculation
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS pnl DECIMAL(10,2) GENERATED ALWAYS AS (
  CASE 
    WHEN status = 'closed' THEN
      CASE 
        WHEN side = 'Long' THEN (total - (quantity * price)) 
        WHEN side = 'Short' THEN ((quantity * price) - total)
      END
    ELSE NULL
  END
) STORED;

-- Add index for faster recent trades query if not exists
CREATE INDEX IF NOT EXISTS trades_date_idx ON trades(date DESC); 