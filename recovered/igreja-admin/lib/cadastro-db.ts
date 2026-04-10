/**
 * Igreja Cadastro Database - KYC/AML Registration
 *
 * Schemas for church and donor registration with verification workflows
 */

import { createClient } from '@supabase/supabase-js';

// Database schema types
export interface Church {
  id: string;
  cnpj: string;
  legal_name: string;
  address: string;
  cep: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  wallet_address: string;
  status: 'pending' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Donor {
  id: string;
  name: string;
  email: string;
  document_id: string;
  country: string;
  residency_proof: string; // S3 file key
  kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected';
  sismo_proof?: string; // Sismo attestation
  created_at: string;
  updated_at: string;
  verified_at?: string;
}

export interface OTPVerification {
  id: string;
  email: string;
  otp_code: string;
  expires_at: string;
  verified: boolean;
  created_at: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Validate CNPJ format
 * Brazilian CNPJ validation using check digits
 */
export function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');

  if (clean.length !== 14) return false;

  // Check for repeated digits
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Validate first check digit
  let sum = 0;
  let multiplier = 5;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(clean[i]) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }

  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(clean[8]) !== firstDigit) return false;

  // Validate second check digit
  sum = 0;
  multiplier = 6;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]) * multiplier;
    multiplier = multiplier === 2 ? 9 : multiplier - 1;
  }

  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(clean[9]) !== secondDigit) return false;

  return true;
}

/**
 * Validate CPF format
 * Brazilian CPF validation using check digits
 */
export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');

  if (clean.length !== 11) return false;

  // Check for repeated digits
  if (/^(\d)\1{10}$/.test(clean)) return false;

  // Validate first check digit
  let sum = 0;
  let multiplier = 10;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]) * multiplier;
    multiplier--;
  }

  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(clean[9]) !== firstDigit) return false;

  // Validate second check digit
  sum = 0;
  multiplier = 11;

  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i]) * multiplier;
    multiplier--;
  }

  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;

  if (parseInt(clean[10]) !== secondDigit) return false;

  return true;
}

/**
 * Register a new church
 */
export async function registerChurch(data: {
  cnpj: string;
  legal_name: string;
  address: string;
  cep: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  wallet_address: string;
}): Promise<Church> {
  // Validate CNPJ
  if (!validateCNPJ(data.cnpj)) {
    throw new Error('Invalid CNPJ format');
  }

  // Check if church already exists
  const { data: existing } = await supabase
    .from('churches')
    .select('id')
    .eq('cnpj', data.cnpj.replace(/\D/g, ''))
    .single();

  if (existing) {
    throw new Error('Church already registered with this CNPJ');
  }

  // Validate address
  if (!data.address || data.address.trim().length === 0) {
    throw new Error('Address is required');
  }

  // Validate CEP format (Brazilian)
  if (!/^\d{5}-?\d{3}$/.test(data.cep)) {
    throw new Error('Invalid CEP format');
  }

  // Insert new church
  const { data: church, error } = await supabase
    .from('churches')
    .insert({
      cnpj: data.cnpj.replace(/\D/g, ''),
      legal_name: data.legal_name,
      address: data.address,
      cep: data.cep.replace('-', ''),
      city: data.city,
      state: data.state,
      phone: data.phone,
      email: data.email,
      wallet_address: data.wallet_address,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to register church: ${error.message}`);
  }

  return church as Church;
}

/**
 * Register a new donor
 */
export async function registerDonor(data: {
  name: string;
  email: string;
  document_id: string;
  country: string;
  residency_proof: string; // S3 file key
}): Promise<Donor> {
  // Validate document ID based on country
  if (data.country === 'BR' || data.country === 'Brazil') {
    if (!validateCPF(data.document_id)) {
      throw new Error('Invalid Brazilian CPF format');
    }
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    throw new Error('Invalid email address');
  }

  // Check if donor already exists
  const { data: existing } = await supabase
    .from('donors')
    .select('id')
    .eq('email', data.email)
    .single();

  if (existing) {
    throw new Error('Donor already registered with this email');
  }

  // Insert new donor
  const { data: donor, error } = await supabase
    .from('donors')
    .insert({
      name: data.name,
      email: data.email,
      document_id: data.document_id.replace(/\D/g, ''),
      country: data.country,
      residency_proof: data.residency_proof,
      kyc_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to register donor: ${error.message}`);
  }

  return donor as Donor;
}

/**
 * Send OTP verification email
 */
export async function sendOTPVerification(email: string): Promise<void> {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in database (expires in 15 minutes)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('otp_verifications')
    .insert({
      email,
      otp_code: otp,
      expires_at: expiresAt,
      verified: false,
    });

  if (error) {
    throw new Error(`Failed to generate OTP: ${error.message}`);
  }

  // TODO: Send email with OTP (integrate with email service)
  console.log(`OTP for ${email}: ${otp}`);
}

/**
 * Verify OTP code
 */
export async function verifyOTP(email: string, otpCode: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('otp_verifications')
    .select('id, otp_code, expires_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('No OTP found for this email');
  }

  // Check if OTP is expired
  if (new Date(data.expires_at) < new Date()) {
    throw new Error('OTP has expired');
  }

  // Verify OTP code
  if (data.otp_code !== otpCode) {
    throw new Error('Invalid OTP code');
  }

  // Mark as verified
  await supabase
    .from('otp_verifications')
    .update({ verified: true })
    .eq('id', data.id);

  return true;
}

/**
 * Verify Sismo attestation
 */
export async function verifySismoProof(
  donorId: string,
  sismoAttestation: string
): Promise<void> {
  // TODO: Call Sismo proof verification service
  // For now, just store the attestation

  const { error } = await supabase
    .from('donors')
    .update({
      sismo_proof: sismoAttestation,
      kyc_status: 'verified',
      verified_at: new Date().toISOString(),
    })
    .eq('id', donorId);

  if (error) {
    throw new Error(`Failed to update donor verification: ${error.message}`);
  }
}

/**
 * Get church registration status
 */
export async function getChurchStatus(cnpj: string): Promise<Church | null> {
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  const { data, error } = await supabase
    .from('churches')
    .select('*')
    .eq('cnpj', cleanCNPJ)
    .single();

  if (error) {
    return null;
  }

  return data as Church;
}

/**
 * Get donor KYC status
 */
export async function getDonorKYCStatus(donorId: string): Promise<Donor | null> {
  const { data, error } = await supabase
    .from('donors')
    .select('*')
    .eq('id', donorId)
    .single();

  if (error) {
    return null;
  }

  return data as Donor;
}

/**
 * Update donor KYC status
 */
export async function updateDonorKYCStatus(
  donorId: string,
  status: 'pending' | 'submitted' | 'verified' | 'rejected',
  proof?: string
): Promise<Donor> {
  const updateData: Partial<Donor> = {
    kyc_status: status,
    updated_at: new Date().toISOString(),
  };

  if (proof) {
    updateData.sismo_proof = proof;
  }

  if (status === 'verified') {
    updateData.verified_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('donors')
    .update(updateData)
    .eq('id', donorId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update donor KYC status: ${error.message}`);
  }

  return data as Donor;
}
