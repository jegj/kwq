import { crudDialog } from './crud-dialog.js';

const DEFAULT_COLOR = '#64748b';

export default () =>
  crudDialog({
    path: '/app/categories',
    blankForm: () => ({ name: '', icon: '', color: DEFAULT_COLOR }),
    editForm: (category) => ({
      name: category.name,
      icon: category.icon ?? '',
      color: category.color ?? DEFAULT_COLOR,
    }),
    payload: (form) => ({
      name: form.name,
      icon: form.icon || null,
      color: form.color,
    }),
    conflictMessage: 'A category with that name already exists.',
  });
