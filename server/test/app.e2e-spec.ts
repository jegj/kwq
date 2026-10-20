import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { createTestApp, signTestToken } from './bootstrap.js';

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
    const token = signTestToken(app, {
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

  it('/hooks/email (POST) skips the origin check and rejects a missing token with 401', async () => {
    await request(app.getHttpServer())
      .post('/hooks/email')
      .send({})
      .expect(401);
  });

  it('/hooks/email (POST) is rate limited per token, not per IP', async () => {
    const server = app.getHttpServer();
    for (let hit = 0; hit < 60; hit++) {
      await request(server)
        .post('/hooks/email')
        .set('X-Kwq-Token', 'noisy-token')
        .send({})
        .expect(401);
    }

    await request(server)
      .post('/hooks/email')
      .set('X-Kwq-Token', 'noisy-token')
      .send({})
      .expect(429);
    await request(server)
      .post('/hooks/email')
      .set('X-Kwq-Token', 'other-token')
      .send({})
      .expect(401);
  });

  it('/health (GET) is public and reports ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('/health (GET) is rate limited per client', async () => {
    const server = app.getHttpServer();
    for (let hit = 0; hit < 60; hit++) {
      await request(server).get('/health').expect(200);
    }

    await request(server).get('/health').expect(429);
  });
});
