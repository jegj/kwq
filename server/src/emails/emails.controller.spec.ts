import { describe, expect, it, vi } from 'vitest';
import { EmailsController } from './emails.controller.js';

const user = { id: 'user-1', role: 'USER', email: 'user@example.com' };

function controllerWith() {
  const service = {
    list: vi.fn().mockResolvedValue({ emails: [], parsers: ['bcp'] }),
    get: vi.fn().mockResolvedValue({ id: 'email-1', subject: 'Consumo' }),
  };
  return { service, controller: new EmailsController(service as any) };
}

describe('EmailsController', () => {
  it('renders the list page with the user chrome and the service data', async () => {
    const { service, controller } = controllerWith();

    const result = await controller.getEmails(user, { status: 'FAILED' });

    expect(service.list).toHaveBeenCalledWith('user-1', { status: 'FAILED' });
    expect(result).toMatchObject({
      title: 'Email Notifications',
      page: './pages/emails',
      email: 'user@example.com',
      role: 'USER',
      currentPath: '/app/emails',
      emails: [],
    });
  });

  it('renders the detail page titled by the subject', async () => {
    const { service, controller } = controllerWith();

    const result = await controller.getEmail(user, 'email-1');

    expect(service.get).toHaveBeenCalledWith('user-1', 'email-1');
    expect(result).toMatchObject({
      title: 'Consumo',
      page: './pages/email-detail',
      currentPath: '/app/emails',
      notification: { subject: 'Consumo' },
    });
  });
});
