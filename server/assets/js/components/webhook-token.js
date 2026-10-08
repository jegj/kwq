export default (hasToken) => ({
  hasToken,
  token: null,
  confirmOpen: false,
  generating: false,
  error: null,
  async generate() {
    this.generating = true;
    this.error = null;
    try {
      const response = await fetch('/app/settings/webhook-token', { method: 'POST' });
      if (response.status === 409) {
        this.hasToken = true;
        this.confirmOpen = false;
        return;
      }
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      this.token = data.token;
      this.hasToken = true;
      this.confirmOpen = false;
    } catch {
      this.error = 'Something went wrong generating the token. Try again.';
    } finally {
      this.generating = false;
    }
  },
});
