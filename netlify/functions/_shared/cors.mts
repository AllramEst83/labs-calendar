/**
 * _shared/cors.mts — CORS headers helper for Netlify Functions.
 *
 * Allowed origins come from CORS_ALLOWED_ORIGINS (comma-separated in .env).
 * Netlify URL, DEPLOY_URL, and DEPLOY_PRIME_URL are added automatically when set.
 */

function parseCommaSeparatedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    ...parseCommaSeparatedOrigins(process.env.CORS_ALLOWED_ORIGINS),
  ]);

  for (const key of ['URL', 'DEPLOY_URL', 'DEPLOY_PRIME_URL'] as const) {
    const value = process.env[key];
    if (value) origins.add(value);
  }

  return [...origins];
}

/**
 * Returns CORS headers appropriate for the given request origin.
 * @param {Request} request
 * @returns {Record<string, string>}
 */
export function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allowed = getAllowedOrigins();
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    'Access-Control-Allow-Origin':      allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods':     'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, Authorization',
    'Vary':                             'Origin',
  };
}

/**
 * Returns a preflight response for OPTIONS requests.
 * @param {Request} request
 * @returns {Response}
 */
export function handlePreflight(request: Request): Response {
  return new Response(null, {
    status:  204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Adds CORS headers to an existing Response object.
 * Returns a new Response with the combined headers.
 */
export function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(getCorsHeaders(request))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers,
  });
}
