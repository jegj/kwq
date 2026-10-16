import { describe, expect, it, vi } from 'vitest';
import { CategoriesController } from './categories.controller.js';

const user = { id: 'user-1', role: 'USER', email: 'user@example.com' };
const body = { name: 'Gym' };

function controllerWith() {
  const service = {
    list: vi.fn().mockResolvedValue([{ id: 'cat-1', isOwnCategory: false }]),
    create: vi.fn().mockResolvedValue({ id: 'cat-2' }),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return { service, controller: new CategoriesController(service as any) };
}

describe('CategoriesController', () => {
  it('renders the page with the user chrome and the listed categories', async () => {
    const { service, controller } = controllerWith();

    const result = await controller.getCategories(user);

    expect(service.list).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      title: 'Categories',
      page: './pages/categories',
      email: 'user@example.com',
      role: 'USER',
      currentPath: '/app/categories',
      categories: [{ id: 'cat-1', isOwnCategory: false }],
    });
  });

  it('delegates create, update and delete to the service for the user', async () => {
    const { service, controller } = controllerWith();

    expect(await controller.createCategory(user, body)).toEqual({
      id: 'cat-2',
    });
    await controller.updateCategory(user, 'cat-2', body);
    await controller.deleteCategory(user, 'cat-2');

    expect(service.create).toHaveBeenCalledWith('user-1', body);
    expect(service.update).toHaveBeenCalledWith('user-1', 'cat-2', body);
    expect(service.remove).toHaveBeenCalledWith('user-1', 'cat-2');
  });
});
