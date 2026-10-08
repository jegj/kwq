// Shared state + requests for the add/edit/delete dialogs on list pages.
// Each page supplies what differs: URL, form shape, request body, 409 message.
export function crudDialog({
  path,
  blankForm,
  editForm,
  payload = (form) => form,
  conflictMessage,
}) {
  const failure = 'Something went wrong. Try again.';

  return {
    dialog: null,
    selected: null,
    form: blankForm(),
    submitting: false,
    error: null,
    openAdd() {
      this.selected = null;
      this.form = blankForm();
      this.error = null;
      this.dialog = 'add';
    },
    openEdit(item) {
      this.selected = item;
      this.form = editForm(item);
      this.error = null;
      this.dialog = 'edit';
    },
    openDelete(item) {
      this.selected = item;
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
      const editing = this.dialog === 'edit';
      try {
        const response = await fetch(
          editing ? `${path}/${this.selected.id}` : path,
          {
            method: editing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload(this.form, editing)),
          },
        );
        if (response.status === 409) {
          this.error = conflictMessage;
          return;
        }
        if (!response.ok) throw new Error('request failed');
        location.reload();
      } catch {
        this.error = failure;
      } finally {
        this.submitting = false;
      }
    },
    async remove() {
      this.submitting = true;
      this.error = null;
      try {
        const response = await fetch(`${path}/${this.selected.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('request failed');
        location.reload();
      } catch {
        this.error = failure;
      } finally {
        this.submitting = false;
      }
    },
  };
}
