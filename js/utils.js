/**
 * utils.js — Shared utility functions for the calendar app.
 */

/**
 * Whether the user's browser locale uses 12-hour time.
 *
 * Detected once at module load using `Intl.DateTimeFormat.resolvedOptions()`.
 * All time formatters in this module read this value so the display is
 * consistent across every surface (event labels, view pane, FullCalendar axis,
 * and the Flatpickr date-time picker).
 *
 * @type {boolean}
 */
export const is12Hour = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false;

/**
 * Strip HTML tags from a string to prevent XSS before sending to the server.
 * @param {string} str
 * @returns {string}
 */
export function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Format an ISO datetime string for display.
 * Converts to user's local timezone.
 * @param {string} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Format a Date or ISO datetime string as a localized time string.
 *
 * Uses `is12Hour` to explicitly set the hour cycle so the output is consistent
 * with every other time surface in the app regardless of how the browser
 * locale normally renders `Intl` options.
 *
 * @param {string|Date} value
 * @returns {string}
 */
export function formatTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: is12Hour,
    }).format(value instanceof Date ? value : new Date(value));
  } catch {
    return String(value);
  }
}

/**
 * Format a date range for display.
 * @param {string} start ISO string
 * @param {string} end ISO string (optional)
 * @param {boolean} allDay
 * @returns {string}
 */
export function formatDateRange(start, end, allDay = false) {
  if (!start) return '';
  const startDate = formatDate(start);
  const startTime = allDay ? '' : formatTime(start);

  if (!end) return allDay ? startDate : `${startDate} · ${startTime}`;

  const endDate = formatDate(end);
  const endTime = allDay ? '' : formatTime(end);

  if (startDate === endDate) {
    return allDay ? startDate : `${startDate} · ${startTime} – ${endTime}`;
  }
  return allDay
    ? `${startDate} – ${endDate}`
    : `${startDate} ${startTime} – ${endDate} ${endTime}`;
}

/**
 * Returns all time slots for an event (supports legacy single start/end).
 * @param {{ start?: string, end?: string, timeslots?: { start: string, end?: string }[] }} event
 * @returns {{ start: string, end?: string }[]}
 */
export function getEventTimeslots(event) {
  if (!event) return [];
  if (Array.isArray(event.timeslots) && event.timeslots.length > 0) {
    return event.timeslots;
  }
  if (event.start) {
    return [{ start: event.start, end: event.end }];
  }
  return [];
}

/**
 * Formats all event time slots for display.
 * @param {{ start?: string, end?: string, timeslots?: { start: string, end?: string }[], allDay?: boolean }} event
 * @returns {string}
 */
export function formatEventTimeslots(event) {
  const slots = getEventTimeslots(event);
  const allDay = !!event?.allDay;

  if (slots.length === 0) return '';
  if (slots.length === 1) {
    return formatDateRange(slots[0].start, slots[0].end, allDay);
  }

  return slots
    .map((slot) => formatDateRange(slot.start, slot.end, allDay))
    .join(' · ');
}

/**
 * Generate a Netlify Blob key for a given date.
 * @param {string|Date} date
 * @returns {string} e.g. "events-2026-05"
 */
export function generateMonthKey(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `events-${year}-${month}`;
}

/**
 * Returns the CSS variable name for a given category color.
 * @param {string} category
 * @returns {string} CSS color value
 */
export function getCategoryColor(category) {
  const colors = {
    meeting:  '#6c5ce7',
    workshop: '#00b894',
    deadline: '#e17055',
    social:   '#fd79a8',
    personal: '#fdcb6e',
    rtmp:     '#a29bfe',
    internal: '#55efc4',
    other:    '#74b9ff',
  };
  return colors[category] || colors.other;
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Returns a local datetime string suitable for <input type="datetime-local">.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalDatetimeString(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
