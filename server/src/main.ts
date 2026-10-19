import 'dotenv/config';
import { join } from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import ejs from 'ejs';
import { Logger } from 'nestjs-pino';
import { AppModule, ObserveInstrument } from './app.module.js';
import { RedirectExceptionFilter } from './auth/redirect/redirect.exception.js';
import { createAssetUrl } from './common/asset-url.util.js';
import {
  createDateFormatters,
  formatMoney,
  titleCase,
} from './common/format.util.js';
import { NotFoundExceptionFilter } from './common/not-found.filter.js';
import { helmetOptions } from './common/security-headers.js';
import type { EnvironmentVariables } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Explicit (same as Fastify's default): ~110k chars of body+html fit well under it.
    new FastifyAdapter({
      bodyLimit: 1_048_576,
      // Caddy runs on the same box; only trust X-Forwarded-For from loopback so
      // clients can't spoof their IP past the login throttle.
      trustProxy: 'loopback',
    }),
    {
      instrument: ObserveInstrument,
      bufferLogs: true,
    },
  );
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.useGlobalFilters(
    new RedirectExceptionFilter(),
    new NotFoundExceptionFilter(),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  await app.register(fastifyView, {
    engine: { ejs },
    root: join(import.meta.dirname, 'views'),
    defaultContext: {
      fmt: {
        formatMoney,
        titleCase,
        ...createDateFormatters(config.get('APP_TIMEZONE')),
      },
      asset: createAssetUrl(
        join(import.meta.dirname, 'public', 'manifest.json'),
      ),
    },
  });
  await app.register(fastifyHelmet, helmetOptions);
  await app.register(fastifyCookie);
  await app.register(fastifyStatic, {
    root: join(import.meta.dirname, 'public'),
    prefix: '/assets/',
  });

  const port: number = config.get('PORT');
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
