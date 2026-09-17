import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { signAuthToken } from '../src/auth/util/jwt.util.js';
import { createTestApp } from './bootstrap.js';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET) redirects to login when no session cookie is present', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(302);

    expect(response.headers.location).toBe('/auth/login');
  });

  it('/ (GET) redirects to the dashboard when a valid session cookie is present', async () => {
    const token = signAuthToken({
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
    });

    const response = await request(app.getHttpServer())
      .get('/')
      .set('Cookie', `session=${token}`)
      .expect(302);

    expect(response.headers.location).toBe('/app/dashboard');
  });
});
