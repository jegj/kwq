import { describe, expect, it, vi } from 'vitest';
import { TransactionsController } from './transactions.controller.js';

const user = { id: 'user-1', role: 'USER', email: 'user@example.com' };
const body = { merchant: 'Shop' } as any;

function controllerWith() {
  const service = {
    list: vi.fn().mockResolvedValue({ transactions: [], categories: [] }),
    get: vi
      .fn()
      .mockResolvedValue({ transaction: { merchant: 'Shop' }, categories: [] }),
    create: vi.fn().mockResolvedValue({ id: 'txn-1' }),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return { service, controller: new TransactionsController(service as any) };
}

describe('TransactionsController', () => {
  it('renders the list page with the user chrome and the service data', async () => {
    const { service, controller } = controllerWith();

    const result = await controller.getTransactions(user, { month: '2026-09' });

    expect(service.list).toHaveBeenCalledWith('user-1', { month: '2026-09' });
    expect(result).toMatchObject({
      title: 'Transactions',
      page: './pages/transactions',
      email: 'user@example.com',
      role: 'USER',
      currentPath: '/app/transactions',
      transactions: [],
    });
  });

  it('renders the detail page titled by the merchant', async () => {
    const { service, controller } = controllerWith();

    const result = await controller.getTransaction(user, 'txn-1');

    expect(service.get).toHaveBeenCalledWith('user-1', 'txn-1');
    expect(result).toMatchObject({
      title: 'Shop',
      page: './pages/transaction-detail',
      currentPath: '/app/transactions',
      transaction: { merchant: 'Shop' },
    });
  });

  it('delegates create, update and delete to the service for the user', async () => {
    const { service, controller } = controllerWith();

    expect(await controller.createTransaction(user, body)).toEqual({
      id: 'txn-1',
    });
    await controller.updateTransaction(user, 'txn-1', body);
    await controller.deleteTransaction(user, 'txn-1');

    expect(service.create).toHaveBeenCalledWith('user-1', body);
    expect(service.update).toHaveBeenCalledWith('user-1', 'txn-1', body);
    expect(service.remove).toHaveBeenCalledWith('user-1', 'txn-1');
  });
});
