import { describe, expect, it } from 'vitest';
import { hashWebhookToken } from './webhook-token.util.js';

describe('webhook-token.util', () => {
  it('hashes the same token to the same value', () => {
    expect(hashWebhookToken('a-token')).toBe(hashWebhookToken('a-token'));
  });

  it('hashes different tokens to different values', () => {
    expect(hashWebhookToken('a-token')).not.toBe(
      hashWebhookToken('another-token'),
    );
  });
});
