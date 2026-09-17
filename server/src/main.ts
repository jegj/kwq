import 'dotenv/config';
import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyView from '@fastify/view';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import ejs from 'ejs';
import { Logger } from 'nestjs-pino';
import { AppModule, ObserveInstrument } from './app.module.js';
import { RedirectExceptionFilter } from './auth/redirect/redirect.exception.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      instrument: ObserveInstrument,
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new RedirectExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.register(fastifyView, {
    engine: { ejs },
    root: join(import.meta.dirname, 'views'),
  });
  await app.register(fastifyCookie);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
