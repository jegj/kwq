import { describe, expect, it, vi } from 'vitest';
import { PushController } from './push.controller.js';

const user = { id: 'user-1', role: 'USER', email: 'user@example.com' };

describe('PushController', () => {
  it('saves the subscription for the current user', async () => {
    const store = { save: vi.fn().mockResolvedValue(undefined) };
    const controller = new PushController(store as any);
    const body = { endpoint: 'https://push/1', p256dh: 'key', auth: 'auth' };

    await controller.subscribe(user, body);

    expect(store.save).toHaveBeenCalledWith('user-1', body);
  });
});
