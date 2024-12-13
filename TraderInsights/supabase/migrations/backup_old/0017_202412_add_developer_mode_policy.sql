-- Add developer mode policy for transaction_orders
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