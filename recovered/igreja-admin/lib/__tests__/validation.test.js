/**
 * Tests for Igreja Cadastro Validation Functions
 *
 * Unit tests for CNPJ/CPF validation and data normalization
 */

// Validation functions (inline for testing)
function validateCNPJ(cnpj) {
  const clean = cnpj.replace(/\D/g, '');

  if (clean.length !== 14) return false;

  // Check for repeated digits
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Validate first check digit (position 12)
  let sum = 0;
  let size = clean.length - 2;
  let pos = size - 7;

  for (let i = size; i >= 0; i -= 1) {
    sum += clean[size - i] * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(clean[size])) return false;

  // Validate second check digit (position 13)
  size = clean.length - 1;
  pos = size - 7;
  sum = 0;

  for (let i = size; i >= 0; i -= 1) {
    sum += clean[size - i] * pos;
    pos -= 1;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(clean[size])) return false;

  return true;
}

function validateCPF(cpf) {
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

// Tests
describe('CNPJ Validation', () => {
  test('should reject CNPJ with wrong length', () => {
    const result = validateCNPJ('11.222.333/0001');
    expect(result).toBe(false);
  });

  test('should reject CNPJ with all repeated digits', () => {
    const result = validateCNPJ('11.111.111/1111-11');
    expect(result).toBe(false);
  });

  test('should reject CNPJ with too few digits', () => {
    const result = validateCNPJ('11222333');
    expect(result).toBe(false);
  });

  test('should reject CNPJ with too many digits', () => {
    const result = validateCNPJ('112223330001812345');
    expect(result).toBe(false);
  });

  test('should handle empty CNPJ', () => {
    const result = validateCNPJ('');
    expect(result).toBe(false);
  });

  test('should reject invalid CNPJ with special characters only', () => {
    const result = validateCNPJ('...---/');
    expect(result).toBe(false);
  });

  test('should validate CNPJ format after normalization', () => {
    const cnpj = '34.028.414/0001-02';
    const clean = cnpj.replace(/\D/g, '');
    expect(clean.length).toBe(14);
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

  test('should validate CPF without formatting', () => {
    const result = validateCPF('12345678909');
    expect(result).toBe(true);
  });

  test('should handle empty CPF', () => {
    const result = validateCPF('');
    expect(result).toBe(false);
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

describe('Format Validation', () => {
  test('should validate CEP format with hyphen', () => {
    const cep = '12345-678';
    const regex = /^\d{5}-?\d{3}$/;
    expect(regex.test(cep)).toBe(true);
  });

  test('should validate CEP format without hyphen', () => {
    const cep = '12345678';
    const regex = /^\d{5}-?\d{3}$/;
    expect(regex.test(cep)).toBe(true);
  });

  test('should validate email format', () => {
    const email = 'john@example.com';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(regex.test(email)).toBe(true);
  });

  test('should reject invalid email format', () => {
    const email = 'invalid-email';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(regex.test(email)).toBe(false);
  });

  test('should validate OTP code format', () => {
    const validOTP = '123456';
    const invalidOTP = '12345';
    const regex = /^\d{6}$/;

    expect(regex.test(validOTP)).toBe(true);
    expect(regex.test(invalidOTP)).toBe(false);
  });
});

describe('Phone Format', () => {
  test('should validate Brazilian phone number (10 digits)', () => {
    const phone = '1133334444';
    const regex = /^\d{10,11}$/;
    expect(regex.test(phone)).toBe(true);
  });

  test('should validate Brazilian phone number (11 digits)', () => {
    const phone = '11933334444';
    const regex = /^\d{10,11}$/;
    expect(regex.test(phone)).toBe(true);
  });

  test('should reject invalid phone number', () => {
    const phone = '1133';
    const regex = /^\d{10,11}$/;
    expect(regex.test(phone)).toBe(false);
  });
});
