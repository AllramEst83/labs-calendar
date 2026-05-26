/**
 * api.js — Fetch wrappers for all backend API calls.
 * All functions throw on non-2xx responses so callers can catch & handle errors.
 */

import { showToast } from './toast.js';

const BASE = '/api';

/**
 * Generic fetch helper with error handling.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include', // Send HttpOnly cookies
  });

  if (response.status === 401) {
    // Session expired — reload to show auth screen
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Request failed');
    throw new Error(text || `HTTP ${response.status}`);
  }

  // Handle empty body (e.g. 204)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

/**
 * Verify the user's PIN.
 * @param {string} pin 6-digit string
 * @returns {Promise<{ ok: boolean }>}
 */
export async function verifyPin(pin) {
  const response = await fetch(`${BASE}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
    credentials: 'include',
  });

  if (response.status === 429) {
    throw new Error('Too many attempts. Please wait before trying again.');
  }
  if (!response.ok) {
    throw new Error('Invalid PIN');
  }
  return response.json();
}

/**
 * Check if the current session is valid via the dedicated session-check endpoint.
 * Returns true if authenticated, false if not.
 * @returns {Promise<boolean>}
 */
export async function checkAuth() {
  try {
    const response = await fetch(`${BASE}/check-session`, {
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch events within a date range.
 * @param {string} start ISO date
 * @param {string} end ISO date
 * @returns {Promise<CalendarEvent[]>}
 */
export async function fetchEvents(start, end) {
  return apiFetch(`/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

/**
 * Create a new event.
 * @param {Omit<CalendarEvent, 'id'|'createdAt'|'updatedAt'>} data
 * @returns {Promise<CalendarEvent>}
 */
export async function createEvent(data) {
  return apiFetch('/events', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing event.
 * @param {string} id
 * @param {Partial<CalendarEvent>} data
 * @returns {Promise<CalendarEvent>}
 */
export async function updateEvent(id, data) {
  return apiFetch(`/events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete an event.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteEvent(id) {
  return apiFetch(`/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Clear the session cookie (logout).
 */
export async function logout() {
  try {
    await fetch(`${BASE}/verify-pin`, {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // Ignore errors — just reload
  }
}
