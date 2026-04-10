# Igreja Cadastro System

Comprehensive registration system for Igreja nas Casas with KYC/AML verification, OTP email validation, and Sismo proof integration.

## Features

### Church Registration (`POST /api/cadastro/church`)

Register a new church with the following information:

- **CNPJ**: Brazilian company registration number (validated)
- **Legal Name**: Official registered name
- **Address**: Full street address
- **CEP**: Brazilian postal code (8 digits)
- **City**: Municipality name
- **State**: 2-letter state abbreviation
- **Phone**: Contact number (10-11 digits)
- **Email**: Contact email (verified via OTP)
- **Wallet Address**: Ethereum wallet for donations

**Request:**
```bash
POST /api/cadastro/church
Content-Type: application/json

{
  "cnpj": "11.222.333/0001-81",
  "legal_name": "Igreja Teste",
  "address": "Rua Principal, 123",
  "cep": "01310-100",
  "city": "São Paulo",
  "state": "SP",
  "phone": "1133334444",
  "email": "contact@igreja.com",
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc2e7B45E20b49"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "church": {
    "id": "uuid",
    "cnpj": "11222333000181",
    "legal_name": "Igreja Teste",
    "email": "contact@igreja.com",
    "status": "pending"
  },
  "message": "Church registered successfully. Please verify your email."
}
```

### Donor Registration (`POST /api/cadastro/donor`)

Register a new donor with KYC verification:

- **Name**: Full name
- **Email**: Contact email (verified via OTP)
- **Document ID**: CPF (Brazilian ID, 11 digits)
- **Country**: ISO 2-letter country code
- **Residency Proof**: S3 file key for document upload

**Request:**
```bash
POST /api/cadastro/donor
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@example.com",
  "document_id": "123.456.789-09",
  "country": "BR",
  "residency_proof": "s3://bucket/documents/residency-proof.pdf"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "donor": {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@example.com",
    "kyc_status": "pending"
  },
  "message": "Donor registered successfully. Please verify your email."
}
```

### Email Verification (`PUT /api/cadastro/verify-otp`)

Verify email address using OTP code:

**Request:**
```bash
PUT /api/cadastro/verify-otp
Content-Type: application/json

{
  "email": "contact@igreja.com",
  "otp": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### Sismo Proof Verification (`PUT /api/cadastro/sismo-proof`)

Submit Sismo attestation for zero-knowledge KYC:

**Request:**
```bash
PUT /api/cadastro/sismo-proof
Content-Type: application/json

{
  "donor_id": "uuid",
  "attestation": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sismo proof verified successfully"
}
```

### Check Church Status (`GET /api/cadastro/church/[cnpj]`)

Check church registration status:

**Request:**
```bash
GET /api/cadastro/church/11222333000181
```

**Response (200 OK):**
```json
{
  "success": true,
  "church": {
    "id": "uuid",
    "cnpj": "11222333000181",
    "legal_name": "Igreja Teste",
    "email": "contact@igreja.com",
    "status": "verified",
    "created_at": "2026-04-10T10:00:00Z"
  }
}
```

## Database Schema

### Churches Table

```sql
CREATE TABLE churches (
  id UUID PRIMARY KEY,
  cnpj VARCHAR(14) UNIQUE NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  cep VARCHAR(8) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  verified_at TIMESTAMP
);
```

### Donors Table

```sql
CREATE TABLE donors (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  document_id VARCHAR(11) NOT NULL,
  country VARCHAR(2) NOT NULL,
  residency_proof VARCHAR(255),
  kyc_status VARCHAR(20) CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  sismo_proof TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  verified_at TIMESTAMP
);
```

### OTP Verifications Table

```sql
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP
);
```

## Validation Rules

### CNPJ Validation

- 14 digits (with or without formatting)
- Valid check digits using modulo 11 algorithm
- No repeated digits (e.g., 11.111.111/1111-11 is invalid)

**Format:** `XX.XXX.XXX/XXXX-XX`

### CPF Validation

- 11 digits (with or without formatting)
- Valid check digits using modulo 11 algorithm
- No repeated digits (e.g., 111.111.111-11 is invalid)

**Format:** `XXX.XXX.XXX-XX`

### Email Validation

- Must follow standard email format
- Case-insensitive normalization

### CEP Validation

- 8 digits (with or without hyphen)
- Format: `XXXXX-XXX` or `XXXXXXXX`

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **3 requests per hour per IP** for registration endpoints
- **100 requests per minute** for other endpoints (via Traefik)

## Traefik Configuration

The system is configured with Traefik reverse proxy for:

- **HTTPS/TLS** with Let's Encrypt certificates
- **Security headers** (HSTS, CSP, X-Frame-Options)
- **Rate limiting** and DDoS protection
- **CORS** support for cross-origin requests
- **Health checks** for service availability

**Domains:**
- `admin.aigrejanascasas.com.br`
- `admin.igreja.hubme.tech`

## Integration with Sismo

The cadastro system integrates with Sismo Connect for zero-knowledge KYC:

1. User submits Sismo proof during registration
2. System verifies proof against Sismo attestation service
3. KYC status updates to "verified" upon successful proof

## Testing

Run tests with:

```bash
npm test -- lib/__tests__/cadastro-db.test.ts
```

Test coverage includes:

- CNPJ validation (valid, invalid, edge cases)
- CPF validation (valid, invalid, edge cases)
- Email validation and normalization
- CEP format validation
- OTP generation and verification
- Church and donor registration workflows
- Error handling and meaningful messages

## Development

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXTAUTH_SECRET=your-secret-key
SISMO_API_KEY=your-sismo-api-key
```

### Running the Application

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- **200 OK**: Successful GET request
- **201 Created**: Successful POST request (resource created)
- **400 Bad Request**: Invalid input or validation error
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side error

Error response format:

```json
{
  "error": "Descriptive error message",
  "success": false
}
```

## Security

- **Row Level Security (RLS)**: Database access controlled at row level
- **Input Validation**: All inputs validated before database operations
- **Rate Limiting**: IP-based rate limiting to prevent abuse
- **HTTPS/TLS**: All communications encrypted in transit
- **OTP Verification**: Email verification with time-limited OTP codes
- **CNPJ/CPF Validation**: Cryptographic check digit validation

## Deployment

Deployed using Docker Compose with:

- **Next.js** application server on port 3000
- **Traefik** reverse proxy with Let's Encrypt
- **Supabase** PostgreSQL database with RLS policies
- **Health checks** for automatic service restart

See `docker-compose.yml` for production deployment configuration.
