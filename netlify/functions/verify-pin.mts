/**
 * verify-pin.mts — Netlify Function for PIN verification and session management.
 *
 * POST /api/verify-pin  — Verifies PIN, issues HttpOnly JWT cookie
 * DELETE /api/verify-pin — Clears the session cookie (logout)
 *
 * Security:
 * - IP-based rate limiting: max 5 attempts per 15 minutes
 * - PIN compared in constant-time to prevent timing attacks
 * - Session issued as HttpOnly, Secure, SameSite=Strict cookie
 */

import { SignJWT } from 'jose';
import type { Context } from '@netlify/functions';
import { getCorsHeaders, handlePreflight } from './_shared/cors.mts';
import { buildSessionCookie, clearSessionCookie } from './_shared/auth.mts';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production'
);

// ============================================================
// IN-MEMORY RATE LIMITER
// ============================================================
// Note: In-memory rate limiting resets on function cold-starts.
// For production, consider a Redis-backed store or Netlify Blobs.

interface RateLimitEntry {
  count:     number;
  resetAt:   number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX    = 5;     // max attempts
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in ms

function getRateLimitEntry(ip: string): RateLimitEntry {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimitMap.set(ip, fresh);
    return fresh;
  }
  return entry;
}

function isRateLimited(ip: string): boolean {
  const entry = getRateLimitEntry(ip);
  return entry.count >= RATE_LIMIT_MAX;
}

function incrementRateLimit(ip: string): void {
  const entry = getRateLimitEntry(ip);
  entry.count += 1;
  rateLimitMap.set(ip, entry);
}

// ============================================================
// CONSTANT-TIME STRING COMPARISON
// ============================================================

function safeCompare(a: string, b: string): boolean {
  // Pad to same length to prevent short-circuit timing leaks
  const aBuf = new TextEncoder().encode(a.padEnd(64));
  const bBuf = new TextEncoder().encode(b.padEnd(64));
  let diff = 0;
  for (let i = 0; i < Math.max(aBuf.length, bBuf.length); i++) {
    diff |= (aBuf[i] ?? 0) ^ (bBuf[i] ?? 0);
  }
  return diff === 0 && a.length === b.length;
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default async (request: Request, context: Context) => {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  const corsHeaders = getCorsHeaders(request);

  // DELETE — Logout (clear cookie)
  if (request.method === 'DELETE') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type':  'application/json',
        'Set-Cookie':    clearSessionCookie(),
      },
    });
  }

  // POST — Verify PIN
  if (request.method === 'POST') {
    // Get client IP for rate limiting
    const ip = context.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // Check rate limit
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Please wait 15 minutes.' }), {
        status:  429,
        headers: {
          ...corsHeaders,
          'Content-Type':   'application/json',
          'Retry-After':    '900',
        },
      });
    }

    // Parse body
    let body: { pin?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { pin } = body;
    const expectedPin = process.env.AUTH_PIN || '000000';

    // Validate format
    if (!pin || typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: 'PIN must be exactly 6 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Constant-time comparison
    if (!safeCompare(pin, expectedPin)) {
      incrementRateLimit(ip);
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Success — issue JWT
    const token = await new SignJWT({ sub: 'calendar-user', role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie':   buildSessionCookie(token),
      },
    });
  }

  return new Response('Method not allowed', {
    status:  405,
    headers: corsHeaders,
  });
};
