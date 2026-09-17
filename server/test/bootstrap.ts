import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyView from '@fastify/view';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import ejs from 'ejs';
import { AppModule } from '../src/app.module.js';
import { RedirectExceptionFilter } from '../src/auth/redirect/redirect.exception.js';

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
  app.useGlobalFilters(new RedirectExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.register(fastifyView, {
    engine: { ejs },
    root: join(import.meta.dirname, '../src/views'),
  });
  await app.register(fastifyCookie);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
