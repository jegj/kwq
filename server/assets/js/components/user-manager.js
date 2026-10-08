export default () => ({
  dialog: null,
  selected: null,
  form: { email: '', password: '', role: 'USER' },
  submitting: false,
  error: null,
  openAdd() {
    this.selected = null;
    this.form = { email: '', password: '', role: 'USER' };
    this.error = null;
    this.dialog = 'add';
  },
  openEdit(user) {
    this.selected = user;
    this.form = { email: user.email, password: '', role: user.role };
    this.error = null;
    this.dialog = 'edit';
  },
  openDelete(user) {
    this.selected = user;
    this.error = null;
    this.dialog = 'delete';
  },
  close() {
    this.dialog = null;
    this.selected = null;
  },
  async save() {
    this.submitting = true;
    this.error = null;
    try {
      const response =
        this.dialog === 'edit'
          ? await fetch(`/app/admin/users/${this.selected.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: this.form.role }),
            })
          : await fetch('/app/admin/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(this.form),
            });
      if (response.status === 409) {
        this.error = 'A user with that email already exists.';
        return;
      }
      if (!response.ok) throw new Error('request failed');
      location.reload();
    } catch {
      this.error = 'Something went wrong. Try again.';
    } finally {
      this.submitting = false;
    }
  },
  async remove() {
    this.submitting = true;
    this.error = null;
    try {
      const response = await fetch(`/app/admin/users/${this.selected.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('request failed');
      location.reload();
    } catch {
      this.error = 'Something went wrong. Try again.';
    } finally {
      this.submitting = false;
    }
  },
});
