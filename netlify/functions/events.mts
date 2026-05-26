/**
 * events.mts — CRUD Netlify Function for calendar events.
 *
 * Routes:
 *   GET    /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD   — Fetch events in range
 *   POST   /api/events                                    — Create new event
 *   PUT    /api/events/:id                                — Update event
 *   DELETE /api/events/:id                                — Delete event
 *
 * Storage strategy:
 *   Events are stored in Netlify Blobs using YYYY-MM keys (e.g. "events-2026-05").
 *   Each blob contains an array of CalendarEvent objects for that month.
 *   Queries spanning multiple months aggregate across blobs.
 *
 * All requests require a valid session cookie (validated via _shared/auth.mts).
 */

import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { getCorsHeaders, handlePreflight } from './_shared/cors.mts';
import { validateSession } from './_shared/auth.mts';
import { CreateEventSchema, UpdateEventSchema, CalendarEvent } from './_shared/schema.mts';

const MAX_EVENTS_PER_MONTH = 100;

// ============================================================
// BLOB STORE HELPERS
// ============================================================

function getEventStore() {
  return getStore('calendar-events');
}

/**
 * Generates the blob key for a given date string or ISO datetime.
 * @param {string} dateStr YYYY-MM-DD or ISO datetime
 * @returns {string} "events-YYYY-MM"
 */
function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `events-${year}-${month}`;
}

/**
 * Returns all YYYY-MM keys between two dates (inclusive).
 */
function monthKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  const s = new Date(start);
  const e = new Date(end);

  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  const endMonth = new Date(e.getFullYear(), e.getMonth(), 1);

  while (cur <= endMonth) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    keys.push(`events-${y}-${m}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

/**
 * Reads all events from a specific month blob.
 */
async function readMonthEvents(store: ReturnType<typeof getStore>, key: string): Promise<CalendarEvent[]> {
  const data = await store.get(key, { type: 'json' }) as CalendarEvent[] | null;
  return Array.isArray(data) ? data : [];
}

/**
 * Writes an array of events to a specific month blob.
 */
async function writeMonthEvents(store: ReturnType<typeof getStore>, key: string, events: CalendarEvent[]): Promise<void> {
  await store.set(key, JSON.stringify(events), { metadata: { contentType: 'application/json' } });
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

  // Auth check
  const session = await validateSession(request);
  if (!session.valid) {
    return new Response(session.error.body, {
      status:  session.error.status,
      headers: corsHeaders,
    });
  }

  const store = getEventStore();
  const url   = new URL(request.url);

  // Extract event ID from path, e.g. /api/events/uuid-here
  // URL pattern: /.netlify/functions/events or /.netlify/functions/events/id
  const pathParts  = url.pathname.split('/').filter(Boolean);
  const eventId    = pathParts[pathParts.length - 1];
  const hasEventId = eventId && eventId !== 'events' && eventId.length > 10;

  // ── GET /api/events?start=...&end=... ──────────────────────
  if (request.method === 'GET') {
    const startParam = url.searchParams.get('start');
    const endParam   = url.searchParams.get('end');

    if (!startParam || !endParam) {
      return json({ error: 'start and end query params required' }, 400, corsHeaders);
    }

    const keys = monthKeysBetween(startParam, endParam);
    const allEvents: CalendarEvent[] = [];

    await Promise.all(
      keys.map(async (key) => {
        const events = await readMonthEvents(store, key);
        allEvents.push(...events);
      })
    );

    // Filter to strictly within the requested range
    const start = new Date(startParam).getTime();
    const end   = new Date(endParam).getTime();

    const filtered = allEvents.filter((ev) => {
      const evStart = new Date(ev.start).getTime();
      return evStart >= start && evStart <= end;
    });

    return json(filtered, 200, corsHeaders);
  }

  // ── POST /api/events ───────────────────────────────────────
  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Validation failed', details: parsed.error.flatten() }, 400, corsHeaders);
    }

    const data = parsed.data;
    const key  = monthKey(data.start);
    const existingEvents = await readMonthEvents(store, key);

    if (existingEvents.length >= MAX_EVENTS_PER_MONTH) {
      return json({ error: `Storage limit reached (max ${MAX_EVENTS_PER_MONTH} events per month)` }, 400, corsHeaders);
    }

    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      ...data,
      id:        crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as CalendarEvent;

    await writeMonthEvents(store, key, [...existingEvents, newEvent]);

    return json(newEvent, 201, corsHeaders);
  }

  // ── PUT /api/events/:id ────────────────────────────────────
  if (request.method === 'PUT' && hasEventId) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, corsHeaders);
    }

    const parsed = UpdateEventSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Validation failed', details: parsed.error.flatten() }, 400, corsHeaders);
    }

    const updates = parsed.data;

    // Find the event — we need to scan blobs to find which month it lives in.
    // Strategy: if start date is being updated, it may move to a different month blob.
    const { found, foundKey, foundEvent } = await findEventById(store, eventId);
    if (!found || !foundEvent || !foundKey) {
      return json({ error: 'Event not found' }, 404, corsHeaders);
    }

    const now = new Date().toISOString();
    const updatedEvent: CalendarEvent = {
      ...foundEvent,
      ...updates,
      id:        foundEvent.id,
      createdAt: foundEvent.createdAt,
      updatedAt: now,
    } as CalendarEvent;

    const newKey = monthKey(updatedEvent.start);

    if (newKey === foundKey) {
      // Same month — update in place
      const events = await readMonthEvents(store, foundKey);
      const idx = events.findIndex((e) => e.id === eventId);
      if (idx !== -1) events[idx] = updatedEvent;
      await writeMonthEvents(store, foundKey, events);
    } else {
      // Start date changed — move to new month blob
      const oldEvents = await readMonthEvents(store, foundKey);
      await writeMonthEvents(store, foundKey, oldEvents.filter((e) => e.id !== eventId));

      const newEvents = await readMonthEvents(store, newKey);
      await writeMonthEvents(store, newKey, [...newEvents, updatedEvent]);
    }

    return json(updatedEvent, 200, corsHeaders);
  }

  // ── DELETE /api/events/:id ─────────────────────────────────
  if (request.method === 'DELETE' && hasEventId) {
    const { found, foundKey } = await findEventById(store, eventId);
    if (!found || !foundKey) {
      return json({ error: 'Event not found' }, 404, corsHeaders);
    }

    const events = await readMonthEvents(store, foundKey);
    await writeMonthEvents(store, foundKey, events.filter((e) => e.id !== eventId));

    return json({ ok: true }, 200, corsHeaders);
  }

  return json({ error: 'Method not allowed or missing event ID' }, 405, corsHeaders);
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Finds an event by ID by scanning recent months (up to 12 months back + 3 forward).
 * This avoids loading all blobs at once while still handling most real-world cases.
 */
async function findEventById(
  store: ReturnType<typeof getStore>,
  id: string
): Promise<{ found: boolean; foundKey?: string; foundEvent?: CalendarEvent }> {
  // Generate keys for the past 12 months and next 3 months
  const now = new Date();
  const keys: string[] = [];
  for (let i = -12; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`events-${y}-${m}`);
  }

  for (const key of keys) {
    const events = await readMonthEvents(store, key);
    const event  = events.find((e) => e.id === id);
    if (event) {
      return { found: true, foundKey: key, foundEvent: event };
    }
  }
  return { found: false };
}

/** Builds a JSON response. */
function json(data: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
