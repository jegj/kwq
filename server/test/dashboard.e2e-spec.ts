import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { signAuthToken } from '../src/auth/util/jwt.util.js';
import { createTestApp } from './bootstrap.js';

describe('DashboardController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/app/dashboard (GET) redirects to login when no session cookie is present', async () => {
    const response = await request(app.getHttpServer())
      .get('/app/dashboard')
      .expect(302);

    expect(response.headers.location).toBe('/auth/login');
  });

  it('/app/dashboard (GET) renders the dashboard for a valid session cookie', async () => {
    const token = signAuthToken({
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
    });

    const response = await request(app.getHttpServer())
      .get('/app/dashboard')
      .set('Cookie', `session=${token}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('javier@example.com');
  });
});
