-- Igreja Cadastro Database Schema
-- Create tables for church and donor registration with KYC/AML verification

-- Create churches table
CREATE TABLE IF NOT EXISTS churches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  cep VARCHAR(8) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT valid_cep CHECK (cep ~ '^\d{8}$'),
  CONSTRAINT valid_phone CHECK (phone IS NULL OR phone ~ '^\d{10,11}$')
);

-- Create donors table
CREATE TABLE IF NOT EXISTS donors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  document_id VARCHAR(11) NOT NULL,
  country VARCHAR(2) NOT NULL,
  residency_proof VARCHAR(255),
  kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  sismo_proof TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT valid_document_id CHECK (document_id ~ '^\d{11}$')
);

-- Create OTP verification table
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT valid_otp CHECK (otp_code ~ '^\d{6}$')
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_churches_cnpj ON churches(cnpj);
CREATE INDEX idx_churches_email ON churches(email);
CREATE INDEX idx_churches_status ON churches(status);
CREATE INDEX idx_churches_created_at ON churches(created_at);

CREATE INDEX idx_donors_email ON donors(email);
CREATE INDEX idx_donors_document_id ON donors(document_id);
CREATE INDEX idx_donors_kyc_status ON donors(kyc_status);
CREATE INDEX idx_donors_created_at ON donors(created_at);

CREATE INDEX idx_otp_email ON otp_verifications(email);
CREATE INDEX idx_otp_created_at ON otp_verifications(created_at);
CREATE INDEX idx_otp_expires_at ON otp_verifications(expires_at);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_churches_updated_at
BEFORE UPDATE ON churches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donors_updated_at
BEFORE UPDATE ON donors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Churches: Anyone can read public info, authenticated users can update own
CREATE POLICY "churches_read" ON churches
  FOR SELECT USING (true);

CREATE POLICY "churches_insert" ON churches
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "churches_update" ON churches
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Donors: Users can only see their own records
CREATE POLICY "donors_read" ON donors
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "donors_insert" ON donors
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "donors_update" ON donors
  FOR UPDATE USING (auth.uid()::text = id::text);

-- OTP: Only accessible during verification process
CREATE POLICY "otp_read" ON otp_verifications
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "otp_insert" ON otp_verifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Audit logs: Insert-only, system access
CREATE POLICY "audit_read" ON audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "audit_insert" ON audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
