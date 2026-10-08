const DEFAULT_COLOR = '#64748b';

export default () => ({
  dialog: null,
  selected: null,
  form: { name: '', icon: '', color: DEFAULT_COLOR },
  submitting: false,
  error: null,
  openAdd() {
    this.selected = null;
    this.form = { name: '', icon: '', color: DEFAULT_COLOR };
    this.error = null;
    this.dialog = 'add';
  },
  openEdit(category) {
    this.selected = category;
    this.form = {
      name: category.name,
      icon: category.icon ?? '',
      color: category.color ?? DEFAULT_COLOR,
    };
    this.error = null;
    this.dialog = 'edit';
  },
  openDelete(category) {
    this.selected = category;
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
    const payload = JSON.stringify({
      name: this.form.name,
      icon: this.form.icon || null,
      color: this.form.color,
    });
    try {
      const response =
        this.dialog === 'edit'
          ? await fetch(`/app/categories/${this.selected.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
            })
          : await fetch('/app/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payload,
            });
      if (response.status === 409) {
        this.error = 'A category with that name already exists.';
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
      const response = await fetch(`/app/categories/${this.selected.id}`, {
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
