import { join } from 'node:path';
import fastifyView from '@fastify/view';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import ejs from 'ejs';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('AuthController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.register(fastifyView, {
      engine: { ejs },
      root: join(import.meta.dirname, './../src/views'),
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/auth/login (GET) returns the login page', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/login')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('<form');
  });

  afterEach(async () => {
    await app.close();
  });
});
