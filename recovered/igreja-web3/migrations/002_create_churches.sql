-- Create churches table for church registration
CREATE TABLE IF NOT EXISTS public.churches (
  id BIGSERIAL PRIMARY KEY,
  legal_name TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  signer_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);

-- Create indices
CREATE INDEX IF NOT EXISTS churches_cnpj_idx ON public.churches(cnpj);
CREATE INDEX IF NOT EXISTS churches_signer_address_idx ON public.churches(signer_address);
CREATE INDEX IF NOT EXISTS churches_created_at_idx ON public.churches(created_at DESC);

-- Enable RLS
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can read active churches
CREATE POLICY churches_auth_read ON public.churches
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- RLS Policy: Authenticated users can insert
CREATE POLICY churches_auth_insert ON public.churches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- RLS Policy: Admins can update
CREATE POLICY churches_auth_update ON public.churches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_churches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS churches_updated_at_trigger ON public.churches;
CREATE TRIGGER churches_updated_at_trigger
  BEFORE UPDATE ON public.churches
  FOR EACH ROW
  EXECUTE FUNCTION update_churches_updated_at();

-- Grant permissions
GRANT SELECT ON public.churches TO anon, authenticated;
GRANT INSERT, UPDATE ON public.churches TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE churches_id_seq TO authenticated;
