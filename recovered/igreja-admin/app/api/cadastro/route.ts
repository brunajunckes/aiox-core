/**
 * Igreja Cadastro API Routes
 *
 * Endpoints for church and donor registration with rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  registerChurch,
  registerDonor,
  verifyOTP,
  verifySismoProof,
  getChurchStatus,
  getDonorKYCStatus,
  updateDonorKYCStatus,
  sendOTPVerification,
} from '@/lib/cadastro-db';

// Rate limiting store (in-memory, replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check rate limit for IP
 */
function checkRateLimit(ip: string, maxRequests: number = 3, windowMs: number = 3600000): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(ip);

  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (limit.count >= maxRequests) {
    return false;
  }

  limit.count++;
  return true;
}

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'unknown'
  );
}

/**
 * POST /api/cadastro/church
 * Register a new church
 */
export async function POST(request: NextRequest) {
  const path = new URL(request.url).pathname;

  // Rate limiting
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp, 3, 3600000)) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (
      !body.cnpj ||
      !body.legal_name ||
      !body.address ||
      !body.cep ||
      !body.email ||
      !body.wallet_address
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (path.includes('/church')) {
      const church = await registerChurch(body);

      // Send verification email
      await sendOTPVerification(body.email);

      return NextResponse.json(
        {
          success: true,
          church: {
            id: church.id,
            cnpj: church.cnpj,
            legal_name: church.legal_name,
            email: church.email,
            status: church.status,
          },
          message: 'Church registered successfully. Please verify your email.',
        },
        { status: 201 }
      );
    }

    if (path.includes('/donor')) {
      // Validate donor fields
      if (!body.name || !body.document_id || !body.country) {
        return NextResponse.json({ error: 'Missing required donor fields' }, { status: 400 });
      }

      const donor = await registerDonor(body);

      // Send OTP
      await sendOTPVerification(body.email);

      return NextResponse.json(
        {
          success: true,
          donor: {
            id: donor.id,
            name: donor.name,
            email: donor.email,
            kyc_status: donor.kyc_status,
          },
          message: 'Donor registered successfully. Please verify your email.',
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';

    return NextResponse.json(
      {
        error: message,
        success: false,
      },
      { status: 400 }
    );
  }
}

/**
 * POST /api/cadastro/verify-otp
 * Verify OTP code
 */
export async function PUT(request: NextRequest) {
  const path = new URL(request.url).pathname;

  if (path.includes('/verify-otp')) {
    try {
      const body = await request.json();

      if (!body.email || !body.otp) {
        return NextResponse.json(
          { error: 'Email and OTP are required' },
          { status: 400 }
        );
      }

      const verified = await verifyOTP(body.email, body.otp);

      return NextResponse.json({
        success: verified,
        message: 'Email verified successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';

      return NextResponse.json(
        {
          error: message,
          success: false,
        },
        { status: 400 }
      );
    }
  }

  if (path.includes('/sismo-proof')) {
    try {
      const body = await request.json();

      if (!body.donor_id || !body.attestation) {
        return NextResponse.json(
          { error: 'Donor ID and attestation are required' },
          { status: 400 }
        );
      }

      await verifySismoProof(body.donor_id, body.attestation);

      return NextResponse.json({
        success: true,
        message: 'Sismo proof verified successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';

      return NextResponse.json(
        {
          error: message,
          success: false,
        },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
}

/**
 * GET /api/cadastro/church/[cnpj]
 * Get church registration status
 */
export async function GET(request: NextRequest) {
  const path = new URL(request.url).pathname;
  const cnpj = path.split('/').pop();

  if (!cnpj) {
    return NextResponse.json({ error: 'CNPJ is required' }, { status: 400 });
  }

  try {
    const church = await getChurchStatus(cnpj);

    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      church: {
        id: church.id,
        cnpj: church.cnpj,
        legal_name: church.legal_name,
        email: church.email,
        status: church.status,
        created_at: church.created_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed';

    return NextResponse.json(
      {
        error: message,
        success: false,
      },
      { status: 500 }
    );
  }
}
