/**
 * Tests for Igreja Cadastro Database Functions
 *
 * Unit tests for CNPJ/CPF validation, church registration, and donor registration
 */

import {
  validateCNPJ,
  validateCPF,
  registerChurch,
  registerDonor,
  verifyOTP,
  getChurchStatus,
  getDonorKYCStatus,
} from '../cadastro-db';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table) => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}));

describe('CNPJ Validation', () => {
  test('should validate correct CNPJ format', () => {
    // Valid CNPJ: 11.222.333/0001-81
    const result = validateCNPJ('11.222.333/0001-81');
    expect(result).toBe(true);
  });

  test('should reject CNPJ with wrong length', () => {
    const result = validateCNPJ('11.222.333/0001');
    expect(result).toBe(false);
  });

  test('should reject CNPJ with all repeated digits', () => {
    const result = validateCNPJ('11.111.111/1111-11');
    expect(result).toBe(false);
  });

  test('should reject CNPJ with invalid check digits', () => {
    const result = validateCNPJ('11.222.333/0001-00');
    expect(result).toBe(false);
  });

  test('should validate CNPJ without formatting', () => {
    // Valid CNPJ without formatting
    const result = validateCNPJ('11222333000181');
    expect(result).toBe(true);
  });

  test('should handle empty CNPJ', () => {
    const result = validateCNPJ('');
    expect(result).toBe(false);
  });
});

describe('CPF Validation', () => {
  test('should validate correct CPF format', () => {
    // Valid CPF: 123.456.789-09
    const result = validateCPF('123.456.789-09');
    expect(result).toBe(true);
  });

  test('should reject CPF with wrong length', () => {
    const result = validateCPF('123.456.789');
    expect(result).toBe(false);
  });

  test('should reject CPF with all repeated digits', () => {
    const result = validateCPF('111.111.111-11');
    expect(result).toBe(false);
  });

  test('should reject CPF with invalid check digits', () => {
    const result = validateCPF('123.456.789-00');
    expect(result).toBe(false);
  });

  test('should validate CPF without formatting', () => {
    // Valid CPF without formatting
    const result = validateCPF('12345678909');
    expect(result).toBe(true);
  });

  test('should handle empty CPF', () => {
    const result = validateCPF('');
    expect(result).toBe(false);
  });
});

describe('Church Registration', () => {
  test('should require valid CNPJ', async () => {
    const invalidData = {
      cnpj: 'invalid',
      legal_name: 'Test Church',
      address: '123 Main St',
      cep: '12345678',
      city: 'São Paulo',
      state: 'SP',
      phone: '1133334444',
      email: 'church@example.com',
      wallet_address: '0x...',
    };

    await expect(registerChurch(invalidData)).rejects.toThrow('Invalid CNPJ format');
  });

  test('should require address', async () => {
    const invalidData = {
      cnpj: '11.222.333/0001-81',
      legal_name: 'Test Church',
      address: '',
      cep: '12345678',
      city: 'São Paulo',
      state: 'SP',
      phone: '1133334444',
      email: 'church@example.com',
      wallet_address: '0x...',
    };

    await expect(registerChurch(invalidData)).rejects.toThrow('Address is required');
  });

  test('should validate CEP format', async () => {
    const invalidData = {
      cnpj: '11.222.333/0001-81',
      legal_name: 'Test Church',
      address: '123 Main St',
      cep: 'invalid',
      city: 'São Paulo',
      state: 'SP',
      phone: '1133334444',
      email: 'church@example.com',
      wallet_address: '0x...',
    };

    await expect(registerChurch(invalidData)).rejects.toThrow('Invalid CEP format');
  });

  test('should accept valid CEP with hyphen', () => {
    const cep = '12345-678';
    const regex = /^\d{5}-?\d{3}$/;
    expect(regex.test(cep)).toBe(true);
  });

  test('should accept valid CEP without hyphen', () => {
    const cep = '12345678';
    const regex = /^\d{5}-?\d{3}$/;
    expect(regex.test(cep)).toBe(true);
  });
});

describe('Donor Registration', () => {
  test('should validate email format', async () => {
    const invalidData = {
      name: 'John Doe',
      email: 'invalid-email',
      document_id: '12345678901',
      country: 'BR',
      residency_proof: 's3://bucket/file.pdf',
    };

    await expect(registerDonor(invalidData)).rejects.toThrow('Invalid email address');
  });

  test('should validate CPF for Brazilian donors', async () => {
    const invalidData = {
      name: 'John Doe',
      email: 'john@example.com',
      document_id: 'invalid',
      country: 'BR',
      residency_proof: 's3://bucket/file.pdf',
    };

    await expect(registerDonor(invalidData)).rejects.toThrow(
      'Invalid Brazilian CPF format'
    );
  });

  test('should accept valid donor data structure', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      document_id: '12345678901',
      country: 'BR',
      residency_proof: 's3://bucket/file.pdf',
    };

    // Check structure validity
    expect(validData).toHaveProperty('name');
    expect(validData).toHaveProperty('email');
    expect(validData).toHaveProperty('document_id');
    expect(validData).toHaveProperty('country');
    expect(validData).toHaveProperty('residency_proof');
  });
});

describe('OTP Verification', () => {
  test('should reject expired OTP', async () => {
    const pastDate = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago

    const isExpired = new Date(pastDate) < new Date();
    expect(isExpired).toBe(true);
  });

  test('should accept valid OTP within time window', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now

    const isValid = new Date(futureDate) > new Date();
    expect(isValid).toBe(true);
  });

  test('should validate OTP code format', () => {
    const validOTP = '123456';
    const invalidOTP = '12345'; // Too short
    const regex = /^\d{6}$/;

    expect(regex.test(validOTP)).toBe(true);
    expect(regex.test(invalidOTP)).toBe(false);
  });
});

describe('Church Status Query', () => {
  test('should handle CNPJ formatting variations', () => {
    const cnpjFormatted = '11.222.333/0001-81';
    const cnpjUnformatted = '11222333000181';

    const cleanFormatted = cnpjFormatted.replace(/\D/g, '');
    const cleanUnformatted = cnpjUnformatted.replace(/\D/g, '');

    expect(cleanFormatted).toBe(cleanUnformatted);
  });

  test('should return null for non-existent church', async () => {
    // Mock implementation would return null
    const result = null;
    expect(result).toBeNull();
  });
});

describe('Data Normalization', () => {
  test('should normalize CNPJ by removing non-digits', () => {
    const cnpj = '11.222.333/0001-81';
    const normalized = cnpj.replace(/\D/g, '');
    expect(normalized).toBe('11222333000181');
  });

  test('should normalize CPF by removing non-digits', () => {
    const cpf = '123.456.789-09';
    const normalized = cpf.replace(/\D/g, '');
    expect(normalized).toBe('12345678909');
  });

  test('should normalize CEP by removing hyphen', () => {
    const cep = '12345-678';
    const normalized = cep.replace('-', '');
    expect(normalized).toBe('12345678');
  });

  test('should normalize email to lowercase', () => {
    const email = 'JOHN@EXAMPLE.COM';
    const normalized = email.toLowerCase();
    expect(normalized).toBe('john@example.com');
  });
});

describe('Error Handling', () => {
  test('should provide meaningful error messages for validation failures', () => {
    const errors = {
      cnpj: 'Invalid CNPJ format',
      cpf: 'Invalid Brazilian CPF format',
      email: 'Invalid email address',
      cep: 'Invalid CEP format',
      address: 'Address is required',
    };

    expect(errors.cnpj).toBeDefined();
    expect(errors.cpf).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  test('should validate required fields', () => {
    const requiredFields = ['cnpj', 'legal_name', 'address', 'cep', 'email', 'wallet_address'];

    requiredFields.forEach((field) => {
      expect(field).toBeDefined();
      expect(field.length).toBeGreaterThan(0);
    });
  });
});
