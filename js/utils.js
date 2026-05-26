/**
 * utils.js — Shared utility functions for the calendar app.
 */

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
 * Format a Date or ISO datetime string as a time.
 * @param {string|Date} value
 * @returns {string}
 */
export function formatTime(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
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
