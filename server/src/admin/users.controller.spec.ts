import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller.js';

const admin = { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' };

function controllerWith() {
  const service = {
    list: vi.fn().mockResolvedValue([{ id: 'user-2' }]),
    create: vi.fn().mockResolvedValue({ id: 'user-3' }),
    updateRole: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  return { service, controller: new UsersController(service as any) };
}

describe('UsersController', () => {
  it('renders the page with the admin chrome and the other users', async () => {
    const { service, controller } = controllerWith();

    const result = await controller.getUsers(admin);

    expect(service.list).toHaveBeenCalledWith('admin-1');
    expect(result).toEqual({
      title: 'Users',
      page: './pages/admin-users',
      email: 'admin@example.com',
      role: 'ADMIN',
      currentPath: '/app/admin/users',
      users: [{ id: 'user-2' }],
    });
  });

  it('delegates create, role update and delete to the service', async () => {
    const { service, controller } = controllerWith();
    const created = {
      email: 'a@b.co',
      password: 'password123',
      role: 'USER',
    } as const;

    expect(await controller.createUser(created)).toEqual({ id: 'user-3' });
    await controller.updateUser(admin, 'user-2', { role: 'ADMIN' });
    await controller.deleteUser(admin, 'user-2');

    expect(service.create).toHaveBeenCalledWith(created);
    expect(service.updateRole).toHaveBeenCalledWith('admin-1', 'user-2', {
      role: 'ADMIN',
    });
    expect(service.remove).toHaveBeenCalledWith('admin-1', 'user-2');
  });
});
