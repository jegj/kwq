import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyView from '@fastify/view';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import ejs from 'ejs';
import { AppModule } from '../src/app.module.js';
import { signAuthToken } from '../src/auth/util/jwt.util.js';
import { helmetOptions } from '../src/common/security-headers.js';
import type { EnvironmentVariables } from '../src/config/env.validation.js';

export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });

  const moduleFixture = await (configure
    ? configure(builder)
    : builder
  ).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.register(fastifyView, {
    engine: { ejs },
    root: join(import.meta.dirname, '../src/views'),
    defaultContext: { asset: (name: string) => `/assets/${name}` },
  });
  await app.register(fastifyHelmet, helmetOptions);
  await app.register(fastifyCookie);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

// Session token signed with the secret the app under test was booted with.
export function signTestToken(
  app: NestFastifyApplication,
  payload: Parameters<typeof signAuthToken>[0],
): string {
  return signAuthToken(
    payload,
    app.get(ConfigService<EnvironmentVariables, true>).get('JWT_SECRET'),
  );
}
