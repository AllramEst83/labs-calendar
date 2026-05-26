/**
 * toast.js — Lightweight toast notification system.
 * Usage: showToast('Message', 'success' | 'error' | 'warning' | 'info')
 */

const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};

const TITLES = {
  success: 'Success',
  error:   'Error',
  warning: 'Warning',
  info:    'Info',
};

const DURATION_MS = 4000;

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {string} [title] - Optional custom title
 */
export function showToast(message, type = 'info', title = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${ICONS[type] ?? 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${title || TITLES[type]}</div>
      <div>${message}</div>
    </div>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(() => dismiss(toast), DURATION_MS);

  // Click to dismiss early
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss(toast);
  });
}

function dismiss(toast) {
  toast.classList.add('hiding');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}
