import { join } from 'node:path';
import fastifyHelmet from '@fastify/helmet';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { helmetOptions } from './security-headers.js';

async function getCsp() {
  const app = Fastify();
  await app.register(fastifyHelmet, helmetOptions);
  app.get('/', async () => 'ok');
  const response = await app.inject({ method: 'GET', url: '/' });
  return response.headers['content-security-policy'] as string;
}

describe('security headers', () => {
  it('uses same-origin referrer policy so form POSTs carry a real Origin', async () => {
    const app = Fastify();
    await app.register(fastifyHelmet, helmetOptions);
    app.get('/', async () => 'ok');
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.headers['referrer-policy']).toBe('same-origin');
  });

  it('restricts scripts, framing, forms and base to the app itself', async () => {
    const csp = await getCsp();

    expect(csp).toContain("script-src 'self' 'unsafe-eval'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('does not allow inline scripts', async () => {
    const csp = await getCsp();

    const scriptSrc = csp
      .split(';')
      .find((part) => part.startsWith('script-src'));
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('does not force https upgrades (breaks plain-http dev)', async () => {
    expect(await getCsp()).not.toContain('upgrade-insecure-requests');
  });
});

describe('admin-users template', () => {
  it('escapes quotes in user data inside event attributes', async () => {
    const { default: ejs } = await import('ejs');
    const html = await ejs.renderFile(
      join(import.meta.dirname, '../views/pages/admin-users.ejs'),
      {
        users: [
          {
            id: 'id-1',
            email: `o'brien"@x.com`,
            role: 'USER',
            createdAt: new Date(),
          },
        ],
      },
    );

    expect(html).not.toContain(`o'brien`);
    expect(html).not.toContain(`o'brien"`);
  });
});
