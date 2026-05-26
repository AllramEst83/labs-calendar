/**
 * _shared/auth.mts — Session validation middleware.
 *
 * Verifies the HttpOnly JWT cookie on incoming requests.
 * Returns a 401 Response if the session is invalid or expired.
 */

import { jwtVerify } from 'jose';

const COOKIE_NAME  = 'labs-calendar-session';
const JWT_SECRET   = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production'
);

/**
 * Validates the session cookie on a request.
 * @param {Request} request
 * @returns {Promise<{ valid: boolean; error?: Response }>}
 */
export async function validateSession(request: Request): Promise<{ valid: true } | { valid: false; error: Response }> {
  const cookieHeader = request.headers.get('cookie') || '';
  const token = parseCookie(cookieHeader, COOKIE_NAME);

  if (!token) {
    return {
      valid: false,
      error: new Response('Unauthorized — no session', { status: 401 }),
    };
  }

  try {
    await jwtVerify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: new Response('Unauthorized — invalid or expired session', { status: 401 }),
    };
  }
}

/**
 * Parse a specific cookie value from a Cookie header string.
 */
function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key.trim() === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/**
 * Build a Set-Cookie header for the session JWT.
 * @param {string} token JWT string
 * @returns {string}
 */
export function buildSessionCookie(token: string): string {
  const maxAge = 60 * 60 * 24; // 24 hours
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  // Secure cookies on Netlify (HTTPS) — skip for local netlify dev
  if (process.env.NETLIFY && !process.env.NETLIFY_DEV) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Build a Set-Cookie header that clears the session cookie.
 * @returns {string}
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
}
