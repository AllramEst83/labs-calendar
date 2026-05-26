/**
 * check-session.mts — Lightweight session validation endpoint.
 *
 * GET /api/check-session
 *   → 200 { ok: true }  if the session cookie is valid
 *   → 401               if not authenticated
 *
 * Used by the client on page load to decide whether to show the auth screen.
 */

import type { Context } from '@netlify/functions';
import { getCorsHeaders, handlePreflight } from './_shared/cors.mts';
import { validateSession } from './_shared/auth.mts';

export default async (request: Request, context: Context) => {
  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  const corsHeaders = getCorsHeaders(request);

  const session = await validateSession(request);
  if (!session.valid) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};
