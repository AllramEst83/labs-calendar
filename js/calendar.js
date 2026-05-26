/**
 * calendar.js — FullCalendar initialization and event management.
 *
 * FullCalendar loaded from npm (bundled by Vite).
 * Configures Month, Week, Day, and List views.
 * Custom event rendering with color-coded category dots.
 */

import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

import { fetchEvents } from './api.js';
import { showToast } from './toast.js';
import { getCategoryColor, formatTime, getEventTimeslots } from './utils.js';

/** @type {Calendar|null} */
let calendarInstance = null;

/** Callback for when user clicks on a date (to open add pane). */
let onDateClickCallback = null;

/** Callback for when user clicks on an event (to open view pane). */
let onEventClickCallback = null;

/**
 * Initialize the FullCalendar instance.
 * @param {{ onDateClick: Function, onEventClick: Function }} callbacks
 */
export function initCalendar({ onDateClick, onEventClick }) {
  onDateClickCallback = onDateClick;
  onEventClickCallback = onEventClick;

  const el = document.getElementById('calendar-container');
  if (!el) return;

  calendarInstance = new Calendar(el, {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
    },
    buttonText: {
      today:        'Today',
      month:        'Month',
      week:         'Week',
      day:          'Day',
      listWeek:     'Agenda',
    },
    height: '100%',
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 4,
    moreLinkClick: 'popover',

    // Load events from the server for the visible date range
    events: loadEventsForRange,

    // Custom event rendering
    eventContent: renderEventContent,

    // Callbacks
    dateClick: (info) => {
      onDateClickCallback?.(info.dateStr, info.allDay);
    },
    eventClick: (info) => {
      onEventClickCallback?.(buildEventPayload(info.event));
    },

    // Style tweaks applied after render
    eventDidMount: (info) => {
      const color = info.event.extendedProps.color;
      if (color) {
        info.el.style.backgroundColor = color;
        info.el.style.borderColor = color;
      }
    },
  });

  calendarInstance.render();
}


/**
 * FullCalendar event source function — fetches events for the current view range.
 */
async function loadEventsForRange(info, successCallback, failureCallback) {
  try {
    const start = info.startStr.slice(0, 10);
    const end   = info.endStr.slice(0, 10);
    const events = await fetchEvents(start, end);
    successCallback(transformEvents(events));
  } catch (err) {
    console.error('Failed to load events:', err);
    failureCallback(err);
    if (err.message !== 'Unauthorized') {
      showToast('Failed to load events. Check your connection.', 'warning');
    }
  }
}

/**
 * Map server event objects to FullCalendar event format.
 * @param {any[]} events
 * @returns {any[]}
 */
export function transformEvents(events) {
  if (!Array.isArray(events)) return [];

  const result = [];
  for (const ev of events) {
    const slots = getEventTimeslots(ev);
    if (slots.length === 0) continue;

    const multi = slots.length > 1;
    slots.forEach((slot, index) => {
      result.push({
        id:       multi ? `${ev.id}__${index}` : ev.id,
        groupId:  multi ? ev.id : undefined,
        title:    ev.title,
        start:    slot.start,
        end:      slot.end || undefined,
        allDay:   ev.allDay || false,
        backgroundColor: ev.color || getCategoryColor(ev.category),
        borderColor:     ev.color || getCategoryColor(ev.category),
        textColor: '#ffffff',
        extendedProps: {
          color:       ev.color || getCategoryColor(ev.category),
          category:    ev.category,
          serviceType: ev.serviceType || '',
          languages:   Array.isArray(ev.languages) ? ev.languages : [],
          slotIndex:   index,
          _raw:        ev,
        },
      });
    });
  }
  return result;
}

/**
 * Custom event content — title, time range, and languages (view-aware layout).
 * @param {import('@fullcalendar/core').EventContentArg} arg
 */
function renderEventContent(arg) {
  const { event, view } = arg;
  const languages = event.extendedProps?.languages || [];
  const serviceType = getServiceType(event);
  const compact = view.type === 'dayGridMonth';
  const times = formatEventTimeLabel(event, { compact });

  if (view.type === 'dayGridMonth') {
    return { domNodes: [buildMonthEventEl(event.title, times, serviceType, languages)] };
  }
  if (view.type.startsWith('timeGrid')) {
    return { domNodes: [buildTimeGridEventEl(event.title, times, serviceType, languages)] };
  }
  if (view.type.startsWith('list')) {
    return { domNodes: [buildListEventEl(event.title, serviceType, languages)] };
  }

  return { domNodes: [buildTimeGridEventEl(event.title, times, serviceType, languages)] };
}

function getServiceType(event) {
  return String(event.extendedProps?.serviceType || event.extendedProps?._raw?.serviceType || '').trim();
}

function formatEventTimeLabel(event, { compact = false } = {}) {
  if (event.allDay) return 'All day';
  const start = event.start ? formatTime(event.start) : '';
  if (compact || !event.end) return start || '';
  const end = formatTime(event.end);
  if (start && end) return `${start} – ${end}`;
  return start || '';
}

function formatLanguagesFull(languages) {
  if (!Array.isArray(languages) || languages.length === 0) return '';
  return languages
    .map((l) => {
      const code = String(l?.code || '').trim();
      const name = String(l?.name || '').trim();
      if (name && code) return `${name} (${code})`;
      return name || code;
    })
    .filter(Boolean)
    .join(' · ');
}

function formatLanguagesShort(languages) {
  if (!Array.isArray(languages) || languages.length === 0) return '';
  return languages
    .map((l) => String(l?.code || l?.name || '').trim())
    .filter(Boolean)
    .join(', ');
}

function buildMonthEventEl(title, times, serviceType, languages) {
  const el = document.createElement('div');
  el.className = 'cal-event-inner cal-event-inner--month';
  const langShort = formatLanguagesShort(languages);
  el.innerHTML = `
    <div class="cal-event-line">
      <span class="cal-event-dot" aria-hidden="true"></span>
      <span class="cal-event-title">${escapeHtml(title)}</span>
      ${times ? `<span class="cal-event-time">${escapeHtml(times)}</span>` : ''}
    </div>
    ${serviceType ? `<div class="cal-event-service">${escapeHtml(serviceType)}</div>` : ''}
    ${langShort ? `<div class="cal-event-langs">${escapeHtml(langShort)}</div>` : ''}
  `;
  return el;
}

function buildTimeGridEventEl(title, times, serviceType, languages) {
  const el = document.createElement('div');
  el.className = 'cal-event-inner cal-event-inner--timegrid';
  const langFull = formatLanguagesFull(languages);
  el.innerHTML = `
    <div class="cal-event-title">${escapeHtml(title)}</div>
    ${times ? `<div class="cal-event-time">${escapeHtml(times)}</div>` : ''}
    ${serviceType ? `<div class="cal-event-service">${escapeHtml(serviceType)}</div>` : ''}
    ${langFull ? `<div class="cal-event-langs">${escapeHtml(langFull)}</div>` : ''}
  `;
  return el;
}

function buildListEventEl(title, serviceType, languages) {
  const el = document.createElement('div');
  el.className = 'cal-event-inner cal-event-inner--list';
  const langFull = formatLanguagesFull(languages);
  // Time column is rendered separately by FullCalendar in list view.
  el.innerHTML = `
    <div class="cal-event-title">${escapeHtml(title)}</div>
    ${serviceType ? `<div class="cal-event-service">${escapeHtml(serviceType)}</div>` : ''}
    ${langFull ? `<div class="cal-event-langs">${escapeHtml(langFull)}</div>` : ''}
  `;
  return el;
}

/** Escape HTML entities for safe rendering in custom content. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Returns the latest server event payload for a calendar event id.
 * @param {string} id
 * @returns {object|null}
 */
export function getCalendarEventById(id) {
  const baseId = id.includes('__') ? id.split('__')[0] : id;
  const events = calendarInstance?.getEvents() || [];
  const fcEvent = events.find(
    (ev) => ev.id === id || ev.groupId === baseId || ev.id === baseId
  );
  return fcEvent ? buildEventPayload(fcEvent) : null;
}

/** Merge FullCalendar props with the stored server payload. */
function buildEventPayload(fcEvent) {
  const raw = fcEvent.extendedProps?._raw || {};
  const languages = fcEvent.extendedProps?.languages ?? raw.languages;
  const eventId = raw.id || fcEvent.groupId || fcEvent.id.split('__')[0];

  return {
    ...raw,
    id: eventId,
    title: fcEvent.title,
    start: raw.start ?? fcEvent.start?.toISOString?.(),
    end: raw.end ?? fcEvent.end?.toISOString?.(),
    allDay: fcEvent.allDay ?? raw.allDay,
    timeslots: raw.timeslots,
    languages,
  };
}

/**
 * Add a server event to the calendar immediately (after successful create).
 * @param {object} serverEvent
 */
export function addCalendarEvent(serverEvent) {
  if (!calendarInstance || !serverEvent) return;
  removeCalendarEvent(serverEvent.id);
  transformEvents([serverEvent]).forEach((fcEvent) => {
    calendarInstance.addEvent(fcEvent);
  });
}

/**
 * Replace an existing calendar event with updated server data.
 * @param {object} serverEvent
 */
export function updateCalendarEvent(serverEvent) {
  if (!calendarInstance || !serverEvent?.id) return;
  removeCalendarEvent(serverEvent.id);
  addCalendarEvent(serverEvent);
}

/**
 * Remove an event from the calendar by id.
 * @param {string} id
 */
export function removeCalendarEvent(id) {
  if (!calendarInstance) return;
  calendarInstance.getEvents().forEach((ev) => {
    if (ev.id === id || ev.groupId === id || ev.id.startsWith(`${id}__`)) {
      ev.remove();
    }
  });
}

/**
 * Refetch all events for the current view — called after create/update/delete.
 */
export function refreshCalendar() {
  calendarInstance?.refetchEvents();
}

/**
 * Navigate the calendar to a specific date.
 * @param {string} dateStr YYYY-MM-DD
 */
export function goToDate(dateStr) {
  calendarInstance?.gotoDate(dateStr);
}
