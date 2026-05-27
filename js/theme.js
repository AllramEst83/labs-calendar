/**
 * theme.js — Dark/light mode toggle
 * Persists preference in localStorage, respects prefers-color-scheme on first load.
 */

const STORAGE_KEY = 'labs-calendar-theme';
const ICON_SRC_DARK = '/icons/dark.svg';
const ICON_SRC_LIGHT = '/icons/light.svg';

/** @type {Set<(theme: string) => void>} */
const listeners = new Set();

/** Register a callback that runs whenever the theme changes. */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Returns the stored theme or falls back to system preference. */
function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the given theme and updates the toggle button icon. */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon instanceof HTMLImageElement) {
    icon.src = theme === 'dark' ? ICON_SRC_DARK : ICON_SRC_LIGHT;
  }
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach((fn) => fn(theme));
}

/** Initializes the theme and wires up the toggle button. */
export function initTheme() {
  applyTheme(getInitialTheme());

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
}
