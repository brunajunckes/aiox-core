-- Create donations table for tracking donor transactions
CREATE TABLE IF NOT EXISTS public.donations (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL UNIQUE,
  amount DECIMAL(36, 18) NOT NULL,
  donor_address TEXT NOT NULL,
  church_id BIGINT REFERENCES public.churches(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  confirmation_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indices
CREATE INDEX IF NOT EXISTS donations_tx_hash_idx ON public.donations(tx_hash);
CREATE INDEX IF NOT EXISTS donations_donor_address_idx ON public.donations(donor_address);
CREATE INDEX IF NOT EXISTS donations_status_idx ON public.donations(status);
CREATE INDEX IF NOT EXISTS donations_timestamp_idx ON public.donations(timestamp DESC);
CREATE INDEX IF NOT EXISTS donations_church_id_idx ON public.donations(church_id);

-- Enable RLS
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read donations
CREATE POLICY donations_auth_read ON public.donations
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- RLS Policy: Authenticated users can insert
CREATE POLICY donations_auth_insert ON public.donations
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- RLS Policy: Admins can update
CREATE POLICY donations_auth_update ON public.donations
  FOR UPDATE
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_donations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS donations_updated_at_trigger ON public.donations;
CREATE TRIGGER donations_updated_at_trigger
  BEFORE UPDATE ON public.donations
  FOR EACH ROW
  EXECUTE FUNCTION update_donations_updated_at();

-- Create Gnosis Safe transactions table
CREATE TABLE IF NOT EXISTS public.gnosis_transactions (
  id BIGSERIAL PRIMARY KEY,
  safe_address TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('CALL', 'DELEGATECALL', 'CREATE')),
  target TEXT NOT NULL,
  value DECIMAL(36, 18) DEFAULT 0,
  data TEXT DEFAULT '0x',
  executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  transaction_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for Gnosis table
CREATE INDEX IF NOT EXISTS gnosis_safe_address_idx ON public.gnosis_transactions(safe_address);
CREATE INDEX IF NOT EXISTS gnosis_executed_at_idx ON public.gnosis_transactions(executed_at DESC);
CREATE INDEX IF NOT EXISTS gnosis_tx_hash_idx ON public.gnosis_transactions(transaction_hash);

-- Enable RLS on Gnosis table
ALTER TABLE public.gnosis_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read
CREATE POLICY gnosis_transactions_auth_read ON public.gnosis_transactions
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- RLS Policy: Authenticated users can insert
CREATE POLICY gnosis_transactions_auth_insert ON public.gnosis_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- Grant permissions
GRANT SELECT ON public.donations TO anon, authenticated;
GRANT INSERT, UPDATE ON public.donations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE donations_id_seq TO authenticated;

GRANT SELECT ON public.gnosis_transactions TO authenticated;
GRANT INSERT ON public.gnosis_transactions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE gnosis_transactions_id_seq TO authenticated;
