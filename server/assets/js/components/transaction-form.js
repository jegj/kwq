import { notifyAfterNavigation } from './toast.js';

// Dates travel as zone-less "YYYY-MM-DDTHH:mm"; the server owns the timezone,
// so it passes in `nowInput` instead of the browser computing it.
export default (redirectAfterDelete, nowInput) => {
  const blankForm = () => ({
    merchant: '',
    amount: '',
    currency: 'PEN',
    transactionDate: nowInput,
    operationType: '',
    categoryId: '',
    description: '',
    cardLastFour: '',
    operationNumber: '',
    operationDescription: '',
  });

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
    openEdit(transaction) {
      this.selected = transaction;
      this.form = {
        merchant: transaction.merchant,
        amount: transaction.amount,
        currency: transaction.currency,
        transactionDate: transaction.transactionDate,
        operationType: transaction.operationType ?? '',
        categoryId: transaction.categoryId ?? '',
        description: transaction.description ?? '',
        cardLastFour: transaction.cardLastFour ?? '',
        operationNumber: transaction.operationNumber ?? '',
        operationDescription: transaction.operationDescription ?? '',
      };
      this.error = null;
      this.dialog = 'edit';
    },
    openDelete(transaction) {
      this.selected = transaction;
      this.error = null;
      this.dialog = 'delete';
    },
    close() {
      this.dialog = null;
      this.selected = null;
    },
    async send(url, options) {
      this.submitting = true;
      this.error = null;
      try {
        const response = await fetch(url, options);
        if (response.status === 400) {
          this.error = 'Some fields are invalid. Check them and try again.';
          return false;
        }
        if (!response.ok) throw new Error('request failed');
        return true;
      } catch {
        this.error = 'Something went wrong. Try again.';
        return false;
      } finally {
        this.submitting = false;
      }
    },
    async save() {
      const payload = JSON.stringify({
        merchant: this.form.merchant,
        amount: Number(this.form.amount),
        currency: this.form.currency.toUpperCase(),
        transactionDate: this.form.transactionDate,
        operationType: this.form.operationType || null,
        categoryId: this.form.categoryId || null,
        description: this.form.description || null,
        cardLastFour: this.form.cardLastFour || null,
        operationNumber: this.form.operationNumber || null,
        operationDescription: this.form.operationDescription || null,
      });
      const editing = this.dialog === 'edit';
      const ok = await this.send(
        editing ? `/app/transactions/${this.selected.id}` : '/app/transactions',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        },
      );
      if (!ok) return;
      notifyAfterNavigation(editing ? 'Transaction saved' : 'Transaction added');
      location.reload();
    },
    async remove() {
      const ok = await this.send(`/app/transactions/${this.selected.id}`, {
        method: 'DELETE',
      });
      if (!ok) return;
      notifyAfterNavigation('Transaction deleted');
      if (redirectAfterDelete) location.href = '/app/transactions';
      else location.reload();
    },
  };
};
