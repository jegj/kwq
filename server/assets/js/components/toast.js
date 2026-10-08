const TOAST_KEY = 'kwq-toast';

// Shown by the toast in app-layout once the next page loads.
export function notifyAfterNavigation(message) {
  try {
    sessionStorage.setItem(TOAST_KEY, message);
  } catch {}
}

export default () => ({
  message: null,
  init() {
    try {
      this.message = sessionStorage.getItem(TOAST_KEY);
      sessionStorage.removeItem(TOAST_KEY);
    } catch {}
    if (this.message) setTimeout(() => (this.message = null), 3500);
  },
});
