/**
 * panes.js — Add/Edit and View pane controllers.
 *
 * Manages the slide-in panes:
 * - Add/Edit pane (slides from right) — triggered by FAB or clicking an event's Edit button
 * - View pane (slides from left) — triggered by clicking an event on the calendar
 */

import { createEvent, updateEvent, deleteEvent } from './api.js';
import { getCalendarEventById, addCalendarEvent, updateCalendarEvent, removeCalendarEvent, goToDate } from './calendar.js';
import { showToast } from './toast.js';
import { stripHtml, getCategoryColor, formatDateRange, formatDate, formatTime } from './utils.js';
import {
  initDatetimePickers,
  setDatetimeValue,
  clearDatetimePickers,
  closeDatetimePickers,
  getDatetimeValue,
} from './datetime-picker.js';


// ============================================================
// STATE
// ============================================================

/** The raw server event object currently shown in the view pane. */
let currentViewEvent = null;

/** The raw server event object being edited (null when adding new). */
let currentEditEvent = null;

/** Collected languages for the form. */
let formLanguages = [];

// ============================================================
// OVERLAY & PANE HELPERS
// ============================================================

function openOverlay() {
  const overlay = document.getElementById('overlay');
  overlay?.classList.add('visible');
  overlay?.removeEventListener('click', onOverlayClick);
  overlay?.addEventListener('click', onOverlayClick);
}

function closeOverlay() {
  document.getElementById('overlay')?.classList.remove('visible');
}

function onOverlayClick() {
  closeAllPanes();
}

export function closeAllPanes() {
  closeAddPane();
  closeViewPane();
  closeOverlay();
}

// ============================================================
// ADD / EDIT PANE
// ============================================================

/** Opens the Add pane for a new event, optionally pre-filling the start date. */
export function openAddPane(dateStr = null) {
  currentEditEvent = null;
  resetForm();

  // Pre-fill date if provided
  if (dateStr) {
    const dt = dateStr.includes('T') ? dateStr : `${dateStr}T09:00`;
    setDatetimeValue('event-start', new Date(dt));
    const end = new Date(dt);
    end.setHours(end.getHours() + 1);
    setDatetimeValue('event-end', end);
  }

  document.getElementById('add-pane-title').textContent = 'New Event';
  document.getElementById('event-submit-text').textContent = 'Create Event';
  document.getElementById('add-pane').setAttribute('aria-hidden', 'false');
  document.getElementById('add-pane').classList.add('open');
  openOverlay();

  document.getElementById('event-title')?.focus();
}

/** Opens the Edit pane pre-filled with an existing event's data. */
export function openEditPane(event) {
  const normalized = normalizeEvent(event);
  currentEditEvent = normalized;
  resetFormFields();
  populateForm(normalized);

  document.getElementById('add-pane-title').textContent = 'Edit Event';
  document.getElementById('event-submit-text').textContent = 'Save Changes';
  document.getElementById('add-pane').setAttribute('aria-hidden', 'false');
  document.getElementById('add-pane').classList.add('open');
  openOverlay();

  // Close view pane if open
  document.getElementById('view-pane')?.classList.remove('open');
  document.getElementById('view-pane')?.setAttribute('aria-hidden', 'true');

  document.getElementById('event-title')?.focus();
}

export function closeAddPane() {
  closeDatetimePickers();
  document.getElementById('add-pane')?.classList.remove('open');
  document.getElementById('add-pane')?.setAttribute('aria-hidden', 'true');
}

// ============================================================
// VIEW PANE
// ============================================================

/** Opens the View pane showing full event details. */
export function openViewPane(event) {
  currentViewEvent = normalizeEvent(event);
  renderViewPane(currentViewEvent);

  document.getElementById('view-pane').setAttribute('aria-hidden', 'false');
  document.getElementById('view-pane').classList.add('open');
  openOverlay();
}

export function closeViewPane() {
  document.getElementById('view-pane')?.classList.remove('open');
  document.getElementById('view-pane')?.setAttribute('aria-hidden', 'true');
}

/** Renders the view pane content for a given event. */
function renderViewPane(event) {
  const color = event.color || getCategoryColor(event.category);
  const accentEl = document.getElementById('view-pane-accent');
  if (accentEl) accentEl.style.background = color;

  const content = document.getElementById('view-pane-content');
  if (!content) return;

  const langs = parseEventLanguages(event);

  content.innerHTML = `
    <div class="event-detail-header">
      <h3 class="event-detail-title">${escapeHtml(event.title)}</h3>
      <div class="event-detail-time">
        <span class="event-detail-icon">🕐</span>
        <span>${formatDateRange(event.start, event.end, event.allDay)}</span>
      </div>
    </div>

    <div class="detail-rows">
      ${detailRow('🎙️', 'Service Type', displayText(event.serviceType))}
      ${detailRow('📝', 'Description', displayText(event.description))}
      ${detailRow('🔗', 'Event Link', displayLink(event.rtmpLink))}
      ${detailRow('📡', 'Stream URL (RTMP)', displayMono(event.streamUrl))}
      ${detailRow('🔑', 'Stream Key', displayMono(event.streamKey))}
      ${detailRow('🌐', 'Languages', langs.length > 0 ? langTagsHtml(langs) : emptyValue())}
      ${detailRow('📅', 'All-day', event.allDay ? 'Yes' : 'No')}
      ${detailRow('▶️', 'Start', displayDateTime(event.start, event.allDay))}
      ${detailRow('⏹️', 'End', displayDateTime(event.end, event.allDay))}
      ${detailRow('🕐', 'Created', formatDateTime(event.createdAt))}
      ${detailRow('✏️', 'Updated', formatDateTime(event.updatedAt))}
    </div>
  `;
}

function emptyValue() {
  return '<span class="detail-empty">—</span>';
}

function displayText(value) {
  const text = String(value || '').trim();
  return text ? escapeHtml(text) : emptyValue();
}

function displayMono(value) {
  const text = String(value || '').trim();
  return text ? `<span class="monospace">${escapeHtml(text)}</span>` : emptyValue();
}

function displayLink(url) {
  const text = String(url || '').trim();
  if (!text) return emptyValue();
  return `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
}

function displayDateTime(iso, allDay = false) {
  if (!iso) return emptyValue();
  return allDay ? formatDate(iso) : `${formatDate(iso)} · ${formatTime(iso)}`;
}

function formatDateTime(iso) {
  if (!iso) return emptyValue();
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

function detailRow(icon, label, valueHtml) {
  return `
    <div class="detail-row">
      <span class="detail-row-icon">${icon}</span>
      <div class="detail-row-content">
        <div class="detail-row-label">${label}</div>
        <div class="detail-row-value">${valueHtml}</div>
      </div>
    </div>
  `;
}

function langTagsHtml(langs) {
  return `<div class="lang-tags-view">${langs.map((l) =>
    `<span class="lang-tag">${escapeHtml(formatLanguageLabel(l))}</span>`
  ).join('')}</div>`;
}

function formatLanguageLabel(lang) {
  const name = String(lang?.name || '').trim();
  const code = String(lang?.code || '').trim();
  if (name && code) return `${name} (${code})`;
  return name || code;
}

function parseEventLanguages(event) {
  let langs = event?.languages;
  if (typeof langs === 'string') {
    try {
      langs = JSON.parse(langs);
    } catch {
      langs = [];
    }
  }
  return Array.isArray(langs) ? langs.filter((l) => l?.code || l?.name) : [];
}

function normalizeEvent(event) {
  if (!event) return event;
  return {
    ...event,
    languages: parseEventLanguages(event).map((l) => normalizeLanguageEntry(l.code, l.name)),
  };
}

function normalizeLanguageEntry(code, name) {
  return {
    code: stripHtml(String(code || '').trim()),
    name: stripHtml(String(name || '').trim()),
  };
}

function syncLanguageHiddenInput() {
  const el = document.getElementById('event-languages');
  if (el) el.value = JSON.stringify(formLanguages);
}

/** Adds pending code/name inputs to the list, if any. Returns true when added. */
function commitPendingLanguage() {
  const code = document.getElementById('lang-code')?.value.trim() || '';
  const name = document.getElementById('lang-name')?.value.trim() || '';
  if (!code && !name) return false;

  const entry = normalizeLanguageEntry(code, name);
  const exists = formLanguages.some(
    (l) => l.code === entry.code && l.name === entry.name
  );
  if (!exists) formLanguages.push(entry);

  const codeEl = document.getElementById('lang-code');
  const nameEl = document.getElementById('lang-name');
  if (codeEl) codeEl.value = '';
  if (nameEl) nameEl.value = '';

  syncLanguageHiddenInput();
  renderLangTags();
  return !exists;
}

function getLanguagesForSubmit() {
  commitPendingLanguage();
  return formLanguages
    .map((l) => normalizeLanguageEntry(l.code, l.name))
    .filter((l) => l.code || l.name);
}

// ============================================================
// FORM MANAGEMENT
// ============================================================

/** Resets the event form to empty state (new event). */
function resetForm() {
  resetFormFields();
  clearLanguageList();
  document.getElementById('add-pane-accent').style.background = getCategoryColor('other');
}

/** Clears form fields without wiping an in-progress language list. */
function resetFormFields() {
  document.getElementById('event-form')?.reset();
  clearDatetimePickers();
  document.getElementById('event-id').value = '';
  document.getElementById('lang-code').value = '';
  document.getElementById('lang-name').value = '';
}

function clearLanguageList() {
  formLanguages = [];
  syncLanguageHiddenInput();
  renderLangTags();
}

/** Populates the form with an existing event's data. */
function populateForm(event) {
  setValue('event-id', event.id || '');
  setValue('event-title', event.title || '');
  setValue('event-description', event.description || '');
  setValue('event-service-type', event.serviceType || '');
  setValue('event-rtmp-link', event.rtmpLink || '');
  setValue('event-stream-url', event.streamUrl || '');
  setValue('event-stream-key', event.streamKey || '');

  if (event.start) setDatetimeValue('event-start', event.start);
  if (event.end) setDatetimeValue('event-end', event.end);

  const alldayChk = document.getElementById('event-allday');
  if (alldayChk) alldayChk.checked = !!event.allDay;

  document.getElementById('add-pane-accent').style.background = event.color || getCategoryColor(event.category);

  // Languages — clone so edits don't mutate the stored view copy
  formLanguages = parseEventLanguages(event).map((l) => normalizeLanguageEntry(l.code, l.name));
  syncLanguageHiddenInput();
  renderLangTags();
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/** Collects and sanitizes the form data into a plain object. */
function collectFormData() {
  const getValue = (id) => stripHtml(document.getElementById(id)?.value?.trim() || '');

  const allDay = document.getElementById('event-allday')?.checked || false;
  const start = getDatetimeValue('event-start') || undefined;
  const end = getDatetimeValue('event-end') || undefined;

  return {
    title:       getValue('event-title'),
    description: getValue('event-description'),
    serviceType: getValue('event-service-type'),
    rtmpLink:    getValue('event-rtmp-link'),
    streamUrl:   getValue('event-stream-url'),
    streamKey:   getValue('event-stream-key'),
    category:    'other',
    color:       getCategoryColor('other'),
    start,
    end:         end || undefined,
    allDay,
    languages:   getLanguagesForSubmit(),
  };
}

/** Basic client-side validation. Returns error message or null. */
function validateForm(data) {
  if (!data.title) return 'Event title is required.';
  if (!data.start) return 'Start date and time is required.';
  if (data.end && data.start > data.end) return 'End time must be after start time.';
  return null;
}

// ============================================================
// FORM SUBMISSION
// ============================================================

/** Handles the Add/Edit form submission. */
async function handleFormSubmit() {
  const data = collectFormData();
  const validationError = validateForm(data);
  if (validationError) {
    showToast(validationError, 'warning');
    return;
  }

  const btn = document.getElementById('event-submit-btn');
  const btnText = document.getElementById('event-submit-text');
  btn.disabled = true;
  const prevText = btnText.textContent;
  btnText.textContent = 'Saving…';

  try {
    if (currentEditEvent) {
      const updated = await updateEvent(currentEditEvent.id, data);
      updateCalendarEvent(updated);
      showToast('Event updated successfully.', 'success');
    } else {
      const created = await createEvent(data);
      addCalendarEvent(created);
      if (created?.start) goToDate(created.start.slice(0, 10));
      showToast('Event created successfully.', 'success');
    }
    closeAddPane();
    closeOverlay();
  } catch (err) {
    showToast(err.message || 'Failed to save event.', 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = prevText;
  }
}

// ============================================================
// DELETE WITH CONFIRM DIALOG
// ============================================================

function showConfirmDialog({ icon, title, message, confirmLabel, onConfirm }) {
  const dialog = document.getElementById('confirm-dialog');
  document.getElementById('confirm-icon').textContent = icon || '⚠️';
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok').textContent = confirmLabel || 'Confirm';

  dialog.classList.add('visible');

  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  const cleanup = () => {
    dialog.classList.remove('visible');
    okBtn.replaceWith(okBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  };

  document.getElementById('confirm-ok').addEventListener('click', () => {
    cleanup();
    onConfirm?.();
  }, { once: true });

  document.getElementById('confirm-cancel').addEventListener('click', cleanup, { once: true });
}

async function handleDeleteEvent() {
  if (!currentViewEvent) return;

  showConfirmDialog({
    icon: '🗑️',
    title: 'Delete Event',
    message: `Are you sure you want to delete "${currentViewEvent.title}"? This cannot be undone.`,
    confirmLabel: 'Delete',
    onConfirm: async () => {
      try {
        await deleteEvent(currentViewEvent.id);
        removeCalendarEvent(currentViewEvent.id);
        showToast('Event deleted.', 'success');
        closeViewPane();
        closeOverlay();
        currentViewEvent = null;
      } catch (err) {
        showToast(err.message || 'Failed to delete event.', 'error');
      }
    },
  });
}

// ============================================================
// LANGUAGES
// ============================================================

function initLanguageControls() {
  document.getElementById('add-lang-btn')?.addEventListener('click', () => {
    if (!commitPendingLanguage()) {
      showToast('Enter a language code or name first.', 'warning');
    }
  });

  const onEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitPendingLanguage();
    }
  };
  document.getElementById('lang-code')?.addEventListener('keydown', onEnter);
  document.getElementById('lang-name')?.addEventListener('keydown', onEnter);
}

function renderLangTags() {
  const container = document.getElementById('lang-tags-container');
  if (!container) return;
  container.innerHTML = formLanguages.map((lang, i) => `
    <span class="lang-tag">
      ${escapeHtml(formatLanguageLabel(lang))}
      <span class="lang-tag-remove" data-index="${i}" title="Remove" role="button" aria-label="Remove ${formatLanguageLabel(lang)}">×</span>
    </span>
  `).join('');

  container.querySelectorAll('.lang-tag-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      formLanguages.splice(Number(btn.dataset.index), 1);
      syncLanguageHiddenInput();
      renderLangTags();
    });
  });
}

// ============================================================
// INITIALIZATION
// ============================================================

/** Initialize all pane event listeners. */
export function initPanes() {
  initDatetimePickers();

  // Close buttons
  document.getElementById('add-pane-close')?.addEventListener('click', () => {
    closeAddPane();
    closeOverlay();
  });
  document.getElementById('add-pane-cancel-btn')?.addEventListener('click', () => {
    closeAddPane();
    closeOverlay();
  });
  document.getElementById('view-pane-close')?.addEventListener('click', () => {
    closeViewPane();
    closeOverlay();
  });

  // Form submission
  document.getElementById('event-submit-btn')?.addEventListener('click', handleFormSubmit);
  document.getElementById('event-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit();
  });

  // View pane actions
  document.getElementById('delete-event-btn')?.addEventListener('click', handleDeleteEvent);
  document.getElementById('edit-event-btn')?.addEventListener('click', () => {
    if (!currentViewEvent) return;
    const fresh = getCalendarEventById(currentViewEvent.id);
    openEditPane(fresh || currentViewEvent);
  });

  // Languages
  initLanguageControls();
}

// ============================================================
// UTILITIES
// ============================================================

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
