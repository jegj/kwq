import { crudDialog } from './crud-dialog.js';

export default () =>
  crudDialog({
    path: '/app/admin/users',
    blankForm: () => ({ email: '', password: '', role: 'USER' }),
    editForm: (user) => ({ email: user.email, password: '', role: user.role }),
    // Only the role is editable after creation.
    payload: (form, editing) => (editing ? { role: form.role } : form),
    conflictMessage: 'A user with that email already exists.',
  });
