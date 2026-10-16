import { describe, expect, it, vi } from 'vitest';
import { SettingsController } from './settings.controller.js';

const user = { id: 'user-1', role: 'USER', email: 'javier@example.com' };

function controllerWith() {
  const service = {
    hasWebhookToken: vi.fn().mockResolvedValue(true),
    generateWebhookToken: vi.fn().mockResolvedValue({ token: 'plain' }),
    changePassword: vi.fn().mockResolvedValue(undefined),
  };
  return { service, controller: new SettingsController(service as any) };
}

describe('SettingsController', () => {
  it('renders the page with the user chrome and the token flag', async () => {
    const { service, controller } = controllerWith();

    const result = await controller.getSettings(user);

    expect(service.hasWebhookToken).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      title: 'Settings',
      page: './pages/settings',
      email: 'javier@example.com',
      role: 'USER',
      currentPath: '/app/settings',
      hasWebhookToken: true,
    });
  });

  it('returns the generated token', async () => {
    const { service, controller } = controllerWith();

    expect(await controller.generateWebhookToken(user)).toEqual({
      token: 'plain',
    });
    expect(service.generateWebhookToken).toHaveBeenCalledWith('user-1');
  });

  it('changes the password and reports success', async () => {
    const { service, controller } = controllerWith();
    const body = { currentPassword: 'old', newPassword: 'new' };

    expect(await controller.changePassword(user, body)).toEqual({
      success: true,
    });
    expect(service.changePassword).toHaveBeenCalledWith('user-1', body);
  });
});
