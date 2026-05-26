/**
 * app.js — Entry point for the Labs Calendar SPA.
 *
 * Orchestrates:
 * 1. Theme initialization
 * 2. Auth check — show auth screen or calendar
 * 3. Calendar initialization
 * 4. Panes initialization
 * 5. Header controls (logout, refresh)
 */

import { initTheme } from './theme.js';
import { initAuth } from './auth.js';
import { initCalendar, refreshCalendar } from './calendar.js';
import { initPanes, openAddPane, openViewPane } from './panes.js';
import { checkAuth, logout } from './api.js';
import { showToast } from './toast.js';

// Initialize theme immediately (before auth check) to prevent flash
initTheme();

// Boot the app
boot();

async function boot() {
  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    showApp();
  } else {
    showAuthScreen();
  }
}

/** Transition from auth screen to the main calendar app. */
function showApp() {
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  authScreen?.classList.add('hidden');
  appScreen?.classList.add('visible');

  // Initialize panes first — no dependency on calendar module
  initPanes();
  initCalendar({
    onDateClick: (dateStr) => openAddPane(dateStr),
    onEventClick: (event) => openViewPane(event),
  });

  // Header controls
  document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    refreshCalendar();
    showToast('Calendar refreshed.', 'success');
  });

  // FAB opens add pane
  document.getElementById('fab-add')?.addEventListener('click', () => openAddPane());
}

/** Show the auth screen (first visit or session expired). */
function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  authScreen?.classList.remove('hidden');
  authScreen?.classList.add('visible');
  initAuth(onAuthSuccess);
}

/** Called by auth.js after a successful PIN verification. */
function onAuthSuccess() {
  showApp();
}

/** Logs out the user by clearing the session cookie and reloading. */
async function handleLogout() {
  await logout();
  window.location.reload();
}
