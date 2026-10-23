import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { createTestApp } from './bootstrap.js';

describe('PWA (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/sw.js (GET) is public, javascript and never cached', async () => {
    const response = await request(app.getHttpServer())
      .get('/sw.js')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/^text\/javascript/);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.text).toContain('addEventListener');
  });

  it('/manifest.webmanifest (GET) is public and installable', async () => {
    const response = await request(app.getHttpServer())
      .get('/manifest.webmanifest')
      .expect(200);

    expect(response.headers['content-type']).toMatch(
      /^application\/manifest\+json/,
    );
    const manifest = JSON.parse(response.text);
    expect(manifest).toMatchObject({
      name: 'kwq',
      start_url: '/app/dashboard',
      scope: '/',
      display: 'standalone',
    });
    const sizes = manifest.icons.map(
      (icon: { sizes: string; purpose?: string }) =>
        `${icon.sizes}:${icon.purpose ?? 'any'}`,
    );
    expect(sizes).toEqual(
      expect.arrayContaining([
        '192x192:any',
        '512x512:any',
        '512x512:maskable',
      ]),
    );
  });
});
