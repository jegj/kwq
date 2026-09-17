import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service.js';
import { signAuthToken } from '../src/auth/util/jwt.util.js';
import { createTestApp } from './bootstrap.js';

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;
  let validateUser: (email: string, password: string) => Promise<unknown>;

  beforeEach(async () => {
    validateUser = async () => null;
    app = await createTestApp((builder) =>
      builder.overrideProvider(AuthService).useValue({
        validateUser: (email: string, password: string) =>
          validateUser(email, password),
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('/auth/login (GET) returns the login page', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/login')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('<form');
  });

  it('/auth/login (GET) redirects to the dashboard when already authenticated', async () => {
    const token = signAuthToken({
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
    });

    const response = await request(app.getHttpServer())
      .get('/auth/login')
      .set('Cookie', `session=${token}`)
      .expect(302);

    expect(response.headers.location).toBe('/app/dashboard');
  });

  it('/auth/login (POST) rejects a request missing the password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .type('form')
      .send({ email: 'javier@example.com' })
      .expect(400);
  });

  it('/auth/login (POST) rejects a malformed email', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .type('form')
      .send({ email: 'not-an-email', password: 'correct-horse' })
      .expect(400);
  });

  it('/auth/login (POST) rejects invalid credentials', async () => {
    validateUser = async () => null;

    await request(app.getHttpServer())
      .post('/auth/login')
      .type('form')
      .send({ email: 'javier@example.com', password: 'wrong' })
      .expect(401);
  });

  it('/auth/login (POST) sets the session cookie and redirects to the dashboard', async () => {
    validateUser = async () => ({
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .type('form')
      .send({ email: 'javier@example.com', password: 'correct-horse' })
      .expect(302);

    expect(response.headers.location).toBe('/app/dashboard');
    expect(response.headers['set-cookie']?.[0]).toContain('session=');
  });
});
