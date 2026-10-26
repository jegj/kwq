import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import webpush from 'web-push';
import { AuthService } from '../src/auth/auth.service.js';
import { DashboardService } from '../src/dashboard/dashboard.service.js';
import { createTestApp, signTestToken } from './bootstrap.js';

describe('DashboardController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(AuthService)
        .useValue({
          findSessionUser: async (id: string) => ({
            id,
            role: 'USER',
            email: 'javier@example.com',
          }),
        })
        .overrideProvider(DashboardService)
        .useValue({
          getMonthNav: () => ({
            month: '2026-10',
            label: 'October 2026',
            prev: '2026-09',
            next: null,
          }),
          getSummaries: async () => [],
        }),
    );
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
    const token = signTestToken(app, {
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

describe('DashboardController push opt-in (e2e)', () => {
  const VAPID_VARS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
  let app: NestFastifyApplication;

  async function renderDashboard() {
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(AuthService)
        .useValue({
          findSessionUser: async (id: string) => ({
            id,
            role: 'USER',
            email: 'javier@example.com',
          }),
        })
        .overrideProvider(DashboardService)
        .useValue({
          getMonthNav: () => ({
            month: '2026-10',
            label: 'October 2026',
            prev: '2026-09',
            next: null,
          }),
          getSummaries: async () => [],
        }),
    );
    const token = signTestToken(app, {
      id: 'user-1',
      role: 'USER',
      email: 'javier@example.com',
    });
    return request(app.getHttpServer())
      .get('/app/dashboard')
      .set('Cookie', `session=${token}`)
      .expect(200);
  }

  afterEach(async () => {
    for (const name of VAPID_VARS) delete process.env[name];
    await app.close();
  });

  it('offers the enable-alerts button with the public key when VAPID is configured', async () => {
    const keys = webpush.generateVAPIDKeys();
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.VAPID_SUBJECT = 'mailto:admin@kwq.local';

    const response = await renderDashboard();

    expect(response.text).toContain(`pushToggle('${keys.publicKey}')`);
  });

  it('hides the button when VAPID is not configured', async () => {
    for (const name of VAPID_VARS) delete process.env[name];

    const response = await renderDashboard();

    expect(response.text).not.toContain('pushToggle');
  });
});
