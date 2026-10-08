export default () => ({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  saving: false,
  error: null,
  success: false,
  async changePassword() {
    this.error = null;
    this.success = false;
    if (this.newPassword !== this.confirmPassword) {
      this.error = "New password and confirmation don't match.";
      return;
    }
    this.saving = true;
    try {
      const response = await fetch('/app/settings/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: this.currentPassword,
          newPassword: this.newPassword,
        }),
      });
      if (response.status === 401) {
        this.error = 'Current password is incorrect.';
        return;
      }
      if (!response.ok) throw new Error('request failed');
      this.success = true;
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } catch {
      this.error = 'Something went wrong changing your password. Try again.';
    } finally {
      this.saving = false;
    }
  },
});
