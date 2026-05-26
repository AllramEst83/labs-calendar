/**
 * auth.js — PIN input controller.
 *
 * - 6 individual digit inputs with auto-focus, backspace, and paste support.
 * - Auto-submits on the 6th digit entry.
 * - Shows error state with shake animation and toast on failure.
 */

import { verifyPin } from './api.js';
import { showToast } from './toast.js';

const PIN_LENGTH = 6;
let onSuccessCallback = null;
let isSubmitting = false;

/** Initialize the auth screen and wire up all events. */
export function initAuth(onSuccess) {
  onSuccessCallback = onSuccess;

  const inputs = getPinInputs();
  const submitBtn = document.getElementById('auth-submit-btn');

  // Wire up each input
  inputs.forEach((input, i) => {
    input.addEventListener('keydown', (e) => handleKeydown(e, i));
    input.addEventListener('input', (e) => handleInput(e, i));
    input.addEventListener('focus', () => input.select());
    input.addEventListener('paste', (e) => handlePaste(e));
  });

  // Submit button click
  submitBtn?.addEventListener('click', () => submitPin());

  // Focus first input
  inputs[0]?.focus();
}

/** Returns all 6 PIN input elements in order. */
function getPinInputs() {
  return Array.from({ length: PIN_LENGTH }, (_, i) => document.getElementById(`pin-${i}`));
}

/** Returns the current PIN string (empty string for missing digits). */
function getPinValue() {
  return getPinInputs().map((el) => el.value).join('');
}

/** Handles keydown for navigation. */
function handleKeydown(e, index) {
  const inputs = getPinInputs();
  if (e.key === 'Backspace') {
    if (!inputs[index].value && index > 0) {
      inputs[index - 1].value = '';
      inputs[index - 1].focus();
    }
  }
  if (e.key === 'ArrowLeft' && index > 0) {
    inputs[index - 1].focus();
  }
  if (e.key === 'ArrowRight' && index < PIN_LENGTH - 1) {
    inputs[index + 1].focus();
  }
  if (e.key === 'Enter') {
    submitPin();
  }
}

/** Handles single digit input and auto-advances focus. */
function handleInput(e, index) {
  const inputs = getPinInputs();
  const input = inputs[index];

  // Keep only last character (in case browser allows more)
  const val = input.value.replace(/\D/g, '').slice(-1);
  input.value = val;

  if (val) {
    input.classList.add('filled');
    clearError();
    if (index < PIN_LENGTH - 1) {
      inputs[index + 1].focus();
    } else {
      // Last digit entered — auto-submit
      submitPin();
    }
  } else {
    input.classList.remove('filled');
  }
}

/** Handles paste — fills all inputs from a pasted PIN. */
function handlePaste(e) {
  e.preventDefault();
  const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, PIN_LENGTH);
  const inputs = getPinInputs();
  pasted.split('').forEach((char, i) => {
    if (inputs[i]) {
      inputs[i].value = char;
      inputs[i].classList.add('filled');
    }
  });
  if (pasted.length === PIN_LENGTH) {
    submitPin();
  } else {
    inputs[pasted.length]?.focus();
  }
}

/** Submits the current PIN to the backend. */
async function submitPin() {
  const pin = getPinValue();
  if (pin.length < PIN_LENGTH || isSubmitting) return;

  isSubmitting = true;
  setLoading(true);

  try {
    await verifyPin(pin);
    // Keep loading state visible — auth screen is about to fade out.
    onSuccessCallback?.();
  } catch (err) {
    isSubmitting = false;
    setLoading(false);
    showError(err.message || 'Invalid PIN');
  }
}

/** Shows the error state with shake animation. */
function showError(message) {
  const container = document.getElementById('pin-inputs');
  const status = document.getElementById('auth-status');
  const inputs = getPinInputs();

  // Apply error styles
  inputs.forEach((el) => {
    el.classList.add('error');
    el.classList.remove('filled');
    el.value = '';
  });

  // Shake
  container?.classList.add('shake');
  container?.addEventListener('animationend', () => container.classList.remove('shake'), { once: true });

  // Status message
  if (status) {
    status.textContent = message;
    status.className = 'auth-status error';
  }

  // Toast
  showToast(
    'Access Denied. Kindly ensure you are authorized to be here and try again.',
    'error',
    'Access Denied'
  );

  // Re-focus first input
  inputs[0]?.focus();
}

/** Clears the error state. */
function clearError() {
  const status = document.getElementById('auth-status');
  const inputs = getPinInputs();
  inputs.forEach((el) => el.classList.remove('error'));
  if (status) {
    status.textContent = '';
    status.className = 'auth-status';
  }
}

/** Toggles the loading state of the submit button. */
function setLoading(loading) {
  const btn = document.getElementById('auth-submit-btn');
  const text = document.getElementById('auth-btn-text');
  const status = document.getElementById('auth-status');

  if (btn) btn.disabled = loading;

  if (loading) {
    if (text) text.innerHTML = '<div class="spinner" style="border-color:rgba(255,255,255,0.3);border-top-color:#fff;width:16px;height:16px"></div> Verifying...';
    if (status) {
      status.textContent = 'Verifying PIN…';
      status.className = 'auth-status loading';
    }
  } else {
    if (text) text.textContent = 'Verify Access';
    if (status) {
      status.textContent = '';
      status.className = 'auth-status';
    }
  }
}
