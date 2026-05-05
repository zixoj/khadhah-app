-- Wallet: prevent client from inserting debit transactions directly
-- All debits go through secure server-side RPCs only

DROP POLICY IF EXISTS "Users can insert own wallet transactions" ON wallet_transactions;

-- Clients can only insert credit (top-up) transactions with positive amount
CREATE POLICY "Users can insert own credit transactions"
  ON wallet_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND amount > 0
    AND type = 'credit'
  );
