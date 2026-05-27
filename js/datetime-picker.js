/**
 * datetime-picker.js — Flatpickr wrappers for event start/end fields.
 *
 * Provides a calendar + time picker UI that works inside the slide-in pane.
 */

import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
import { onThemeChange } from './theme.js';
import { is12Hour } from './utils.js';

/** @type {Map<string, import('flatpickr').Instance>} */
const pickers = new Map();
let themeListenerReady = false;

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function syncPickerTheme(fp) {
  fp.calendarContainer?.classList.toggle('labs-flatpickr-dark', getTheme() === 'dark');
}

function baseOptions(id) {
  return {
    enableTime: true,
    time_24hr: !is12Hour,
    // dateFormat is the internal value format — always stored as 24-hour ISO-like.
    dateFormat: 'Y-m-d H:i',
    altInput: true,
    // altFormat is the human-visible display: switch between 12-hour (g:i A)
    // and 24-hour (H:i) to match the browser locale detected by is12Hour.
    altFormat: is12Hour ? 'D, M j, Y · g:i A' : 'D, M j, Y · H:i',
    minuteIncrement: 5,
    allowInput: false,
    static: true,
    disableMobile: true,
    defaultHour: id.endsWith('-start') ? 9 : 10,
    defaultMinute: 0,
    onReady(_selectedDates, _dateStr, fp) {
      fp.calendarContainer.classList.add('labs-flatpickr');
      syncPickerTheme(fp);
    },
    onOpen(_selectedDates, _dateStr, fp) {
      syncPickerTheme(fp);
      pickers.forEach((other) => {
        if (other !== fp && other.isOpen) other.close();
      });
    },
  };
}

function ensureThemeListener() {
  if (themeListenerReady) return;
  onThemeChange(() => syncDatetimePickerTheme());
  themeListenerReady = true;
}

/** Initialize date/time picker support (theme sync only). */
export function initDatetimePickers() {
  ensureThemeListener();
}

/** Mount a flatpickr instance on a field by element id. */
export function mountDatetimePicker(id) {
  ensureThemeListener();
  const el = document.getElementById(id);
  if (!el || pickers.has(id)) return;
  pickers.set(id, flatpickr(el, baseOptions(id)));
}

/** Destroy a picker and remove it from the registry. */
export function destroyDatetimePicker(id) {
  const fp = pickers.get(id);
  if (!fp) return;
  fp.destroy();
  pickers.delete(id);
}

/** Destroy all mounted pickers. */
export function destroyAllDatetimePickers() {
  pickers.forEach((fp) => fp.destroy());
  pickers.clear();
}

/** Sync picker theme when the app theme toggles. */
export function syncDatetimePickerTheme() {
  pickers.forEach((fp) => syncPickerTheme(fp));
}

/** Set a picker value from a Date or ISO string. */
export function setDatetimeValue(id, value) {
  const fp = pickers.get(id);
  if (!fp) return;
  if (!value) {
    fp.clear();
    return;
  }
  fp.setDate(value instanceof Date ? value : new Date(value), true);
}

/** Clear all mounted pickers. */
export function clearDatetimePickers() {
  pickers.forEach((fp) => fp.clear());
}

/** Close open picker dropdowns (e.g. when the add pane closes). */
export function closeDatetimePickers() {
  pickers.forEach((fp) => fp.close());
}

/** Returns an ISO string for the selected date/time, or empty string. */
export function getDatetimeValue(id) {
  const fp = pickers.get(id);
  const date = fp?.selectedDates?.[0];
  return date ? date.toISOString() : '';
}
