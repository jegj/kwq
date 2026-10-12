import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { GmailWebhookDto } from './email-webhook.dto.js';

// Mirrors the caps the kwq_watcher gscript enforces (config.gs).
const WATCHER_BODY_CHAR_LIMIT = 10000;
const WATCHER_BODY_HTML_CHAR_LIMIT = 100000;

const validPayload = {
  messageId: '18c1a0ed1f03668a',
  threadId: '18c1a0ed1f03668a',
  receivedAt: '2026-10-01T12:00:00.000Z',
  from: 'Banco <notificaciones@bcp.com.pe>',
  to: 'javier@example.com',
  subject: 'Constancia de operación',
  body: 'x'.repeat(WATCHER_BODY_CHAR_LIMIT),
  bodyHtml: 'x'.repeat(WATCHER_BODY_HTML_CHAR_LIMIT),
  attachments: [{ name: 'a.pdf', size: 1024, contentType: 'application/pdf' }],
};

async function invalidProperties(overrides: Record<string, unknown>) {
  const dto = plainToInstance(GmailWebhookDto, {
    ...validPayload,
    ...overrides,
  });
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('GmailWebhookDto limits', () => {
  it('accepts a payload at the exact limits the watcher sends', async () => {
    expect(await invalidProperties({})).toEqual([]);
  });

  it('rejects a body over the watcher limit', async () => {
    expect(
      await invalidProperties({
        body: 'x'.repeat(WATCHER_BODY_CHAR_LIMIT + 1),
      }),
    ).toEqual(['body']);
  });

  it('rejects bodyHtml over the watcher limit', async () => {
    expect(
      await invalidProperties({
        bodyHtml: 'x'.repeat(WATCHER_BODY_HTML_CHAR_LIMIT + 1),
      }),
    ).toEqual(['bodyHtml']);
  });

  it('rejects too many attachments', async () => {
    const attachments = Array.from({ length: 51 }, () => ({
      name: 'a.pdf',
      size: 1,
      contentType: 'application/pdf',
    }));
    expect(await invalidProperties({ attachments })).toEqual(['attachments']);
  });

  it('rejects overlong header fields', async () => {
    expect(
      await invalidProperties({
        messageId: 'x'.repeat(201),
        threadId: 'x'.repeat(201),
        from: 'x'.repeat(1001),
        to: 'x'.repeat(5001),
        subject: 'x'.repeat(1001),
      }),
    ).toEqual(['messageId', 'threadId', 'from', 'to', 'subject']);
  });

  it('rejects a negative attachment size', async () => {
    expect(
      await invalidProperties({
        attachments: [{ name: 'a', size: -1, contentType: 'x/y' }],
      }),
    ).toEqual(['attachments']);
  });
});
