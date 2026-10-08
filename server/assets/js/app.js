import Alpine from 'alpinejs';
import categoryManager from './components/category-manager.js';
import changePassword from './components/change-password.js';
import toast from './components/toast.js';
import transactionForm from './components/transaction-form.js';
import userManager from './components/user-manager.js';
import webhookToken from './components/webhook-token.js';

Alpine.data('categoryManager', categoryManager);
Alpine.data('changePassword', changePassword);
Alpine.data('toast', toast);
Alpine.data('transactionForm', transactionForm);
Alpine.data('userManager', userManager);
Alpine.data('webhookToken', webhookToken);

window.Alpine = Alpine;
Alpine.start();
